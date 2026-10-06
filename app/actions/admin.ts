'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { currentAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { printDueDrops, settleBackings, tick } from '@/lib/jobs';
import { refundPayment } from '@/lib/payments/razorpay';
import { dispatchPending } from '@/lib/notify/dispatch';

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function guard() {
  const admin = await currentAdmin();
  if (!admin) throw new Error('forbidden');
  return { session: admin, db: createAdminClient() };
}

async function audit(actor: string, action: string, target: string, detail?: object) {
  await createAdminClient().from('audit_log').insert({ actor_id: actor, action, target, detail: detail ?? null });
}

// ─── Scheduler ───────────────────────────────────────────────────────
export async function runScheduler(): Promise<Result> {
  const { session } = await guard();
  try {
    const log = await tick();
    await audit(session.user.id, 'scheduler.run', 'tick', log);
    revalidatePath('/admin');
    return { ok: true, message: `Done: ${JSON.stringify(log)}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Submissions (curated entry) ─────────────────────────────────────
const reviewSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(['approve', 'changes', 'reject']),
  note: z.string().trim().max(500).optional(),
  dropId: z.string().uuid().optional().or(z.literal('')),
});

export async function reviewDesign(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, decision, note, dropId } = parsed.data;
  if (decision !== 'approve' && !note) return { ok: false, error: 'Add a note for the artist.' };

  const { data: design } = await db.from('designs').select('id, artist_id, status').eq('id', id).single();
  if (!design || design.status !== 'in_review') return { ok: false, error: 'Already reviewed.' };

  if (decision === 'approve' && dropId) {
    const [{ data: s }, { count: mine }, { count: total }, { data: drop }] = await Promise.all([
      db.from('settings').select('max_designs_per_artist, designs_per_drop').single(),
      db.from('designs').select('id', { count: 'exact', head: true }).eq('drop_id', dropId).eq('artist_id', design.artist_id).in('status', ['approved', 'live']),
      db.from('designs').select('id', { count: 'exact', head: true }).eq('drop_id', dropId).in('status', ['approved', 'live']),
      db.from('drops').select('status').eq('id', dropId).single(),
    ]);
    if (drop?.status !== 'scheduled') return { ok: false, error: 'Designs can only be scheduled into a drop that has not opened.' };
    if ((mine ?? 0) >= (s?.max_designs_per_artist ?? 2)) return { ok: false, error: 'This artist already has the maximum designs in that drop.' };
    if ((total ?? 0) >= (s?.designs_per_drop ?? 12)) return { ok: false, error: 'That drop line-up is full.' };
  }

  const status = decision === 'approve' ? 'approved' : decision === 'changes' ? 'changes_requested' : 'rejected';
  const { error } = await db.from('designs').update({
    status, review_note: note || null, reviewed_by: session.user.id, reviewed_at: new Date().toISOString(),
    drop_id: decision === 'approve' && dropId ? dropId : null,
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(session.user.id, `design.${decision}`, id, { note, dropId });
  dispatchPending().catch(() => {});
  revalidatePath('/admin/submissions');
  return { ok: true, message: `Design ${status.replace('_', ' ')}.` };
}

export async function scheduleDesign(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const id = String(form.get('id')); const dropId = String(form.get('dropId') || '');
  const { error } = await db.from('designs').update({ drop_id: dropId || null }).eq('id', id).eq('status', 'approved');
  if (error) return { ok: false, error: error.message };
  await audit(session.user.id, 'design.schedule', id, { dropId });
  revalidatePath('/admin/drops');
  return { ok: true };
}

// ─── Drops ───────────────────────────────────────────────────────────
export async function createNextDrop(): Promise<Result> {
  const { session, db } = await guard();
  const { data, error } = await db.rpc('ensure_next_drop');
  if (error) return { ok: false, error: error.message };
  await audit(session.user.id, 'drop.ensure_next', String(data));
  revalidatePath('/admin/drops');
  return { ok: true, message: 'Next drop is scheduled.' };
}

/** Manual overrides for launch week or emergencies; they reuse the scheduler code paths. */
export async function forceDropStep(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const id = String(form.get('id')); const step = String(form.get('step'));
  const now = new Date();
  try {
    if (step === 'open') {
      const { data: d } = await db.from('drops').select('locks_at').eq('id', id).single();
      if (!d || new Date(d.locks_at) <= now) return { ok: false, error: 'Lock time is already past — edit the drop dates first.' };
      await db.from('drops').update({ opens_at: now.toISOString() }).eq('id', id).eq('status', 'scheduled');
      const { error } = await db.rpc('open_due_drops');
      if (error) return { ok: false, error: error.message };
    } else if (step === 'lock') {
      await db.from('drops').update({ locks_at: new Date(now.getTime() - 1000).toISOString() }).eq('id', id).eq('status', 'live');
      await db.rpc('lock_due_drops');
      await settleBackings();
    } else if (step === 'print') {
      await printDueDrops(true);
    } else if (step === 'shipped') {
      await db.from('drops').update({ status: 'shipped', shipped_at: now.toISOString() }).eq('id', id).eq('status', 'printing');
    }
    await audit(session.user.id, `drop.force_${step}`, id);
    await dispatchPending().catch(() => {});
    revalidatePath('/admin/drops');
    return { ok: true, message: `Drop ${step} done.` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ─── Orders & shipping ───────────────────────────────────────────────
const shipSchema = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().trim().min(2).max(40),
  awb: z.string().trim().min(4).max(40),
  trackingUrl: z.string().url().optional().or(z.literal('')),
});

export async function markShipped(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const parsed = shipSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;
  const now = new Date().toISOString();
  await db.from('shipments').upsert({ order_id: v.orderId, carrier: v.carrier, awb: v.awb, tracking_url: v.trackingUrl || null, shipped_at: now });
  await db.from('orders').update({ status: 'shipped' }).eq('id', v.orderId).in('status', ['printing', 'won', 'paid']);
  await audit(session.user.id, 'order.shipped', v.orderId, v);
  dispatchPending().catch(() => {});
  revalidatePath('/admin/orders');
  return { ok: true, message: 'Marked shipped.' };
}

export async function markDelivered(orderId: string): Promise<Result> {
  const { session, db } = await guard();
  await db.from('shipments').update({ delivered_at: new Date().toISOString() }).eq('order_id', orderId);
  await db.from('orders').update({ status: 'delivered' }).eq('id', orderId).eq('status', 'shipped');
  await audit(session.user.id, 'order.delivered', orderId);
  revalidatePath('/admin/orders');
  return { ok: true };
}

export async function refundOrder(orderId: string): Promise<Result> {
  const { session, db } = await guard();
  const { data: o } = await db.from('orders').select('gateway_payment_id, payment_status').eq('id', orderId).single();
  if (!o?.gateway_payment_id || o.payment_status !== 'captured') return { ok: false, error: 'Only captured payments can be refunded.' };
  try {
    await refundPayment(o.gateway_payment_id);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  await db.from('orders').update({ payment_status: 'refunded', status: 'refunded' }).eq('id', orderId);
  await audit(session.user.id, 'order.refund', orderId);
  revalidatePath('/admin/orders');
  return { ok: true, message: 'Refund requested.' };
}

// ─── Artist payouts ──────────────────────────────────────────────────
export async function recordArtistPayout(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const artistId = String(form.get('artistId'));
  const utr = String(form.get('utr') || '').trim();
  if (!utr) return { ok: false, error: 'Add the UTR / transfer reference.' };
  const { data: rows } = await db.from('artist_earnings').select('id, amount').eq('artist_id', artistId).in('status', ['pending', 'payable']);
  const amount = (rows ?? []).reduce((s, r) => s + (r.amount as number), 0);
  if (amount <= 0) return { ok: false, error: 'Nothing to pay.' };
  const { data: payout, error } = await db.from('artist_payouts').insert({ artist_id: artistId, amount, utr, created_by: session.user.id }).select('id').single();
  if (error || !payout) return { ok: false, error: error?.message ?? 'Failed.' };
  await db.from('artist_earnings').update({ status: 'paid', payout_id: payout.id }).in('id', (rows ?? []).map((r) => r.id));
  await db.rpc('notify_user', { p_user: artistId, p_kind: 'payout', p_title: `Payout sent: ₹${amount.toLocaleString('en-IN')}`, p_body: `Reference ${utr}`, p_link: '/studio', p_channels: ['push', 'email'] });
  await audit(session.user.id, 'artist.payout', artistId, { amount, utr });
  revalidatePath('/admin/payouts');
  return { ok: true, message: `Recorded ₹${amount.toLocaleString('en-IN')}.` };
}

export async function setKyc(artistId: string, status: 'verified' | 'rejected'): Promise<Result> {
  const { session, db } = await guard();
  await db.from('profile_private').update({ kyc_status: status }).eq('id', artistId);
  await audit(session.user.id, `kyc.${status}`, artistId);
  revalidatePath('/admin/payouts');
  return { ok: true };
}

// ─── Moderation & users ──────────────────────────────────────────────
export async function resolveReport(reportId: string, action: 'hide' | 'dismiss'): Promise<Result> {
  const { session, db } = await guard();
  const { data: r } = await db.from('reports').select('target_type, target_id').eq('id', reportId).single();
  if (!r) return { ok: false, error: 'Report not found.' };
  if (action === 'hide') {
    if (r.target_type === 'post') await db.from('posts').update({ hidden: true }).eq('id', r.target_id);
    if (r.target_type === 'comment') await db.from('comments').update({ hidden: true }).eq('id', r.target_id);
    if (r.target_type === 'review') await db.from('reviews').update({ hidden: true }).eq('id', r.target_id);
    if (r.target_type === 'design') await db.from('designs').update({ status: 'withdrawn', review_note: 'Removed after a report.' }).eq('id', r.target_id).neq('status', 'won');
  }
  await db.from('reports').update({ status: action === 'hide' ? 'actioned' : 'dismissed' })
    .eq('target_type', r.target_type).eq('target_id', r.target_id).eq('status', 'open');
  await audit(session.user.id, `report.${action}`, reportId);
  revalidatePath('/admin/moderation');
  return { ok: true };
}

export async function setUserFlag(userId: string, flag: 'is_admin' | 'is_artist' | 'banned', value: boolean): Promise<Result> {
  const { session, db } = await guard();
  if (userId === session.user.id && flag !== 'is_artist') return { ok: false, error: 'You cannot change that on your own account.' };
  await db.from('profiles').update({ [flag]: value }).eq('id', userId);
  await audit(session.user.id, `user.${flag}`, userId, { value });
  revalidatePath('/admin/users');
  return { ok: true };
}

// ─── Settings ────────────────────────────────────────────────────────
const int = z.coerce.number().int().min(0);
const pct = z.coerce.number().min(0).max(100);
const settingsSchema = z.object({
  backer_price: int.min(1), retail_price: int.min(1), backer_threshold: int.min(1), winners_per_drop: int.min(1),
  artist_pct: pct, unit_cost: int, shipping_cost: int, gateway_fee_pct: pct, gst_pct: pct,
  shipping_fee: int, free_shipping_over: int, retail_window_days: int, max_designs_per_artist: int.min(1),
  designs_per_drop: int.min(1), votes_per_hour: int.min(1), milestone_heads_up: int,
  lock_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/), print_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  sizes: z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  categories: z.string().transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean)),
  support_email: z.string().email(),
  require_phone_for_votes: z.enum(['true', 'false']).transform((v) => v === 'true'),
  referral_reward: int, welcome_reward: int, return_window_days: int, reopen_days: int.min(1),
});

export async function saveSettings(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: `${parsed.error.issues[0].path.join('.')}: ${parsed.error.issues[0].message}` };
  if (parsed.data.backer_price >= parsed.data.retail_price) return { ok: false, error: 'Backer price must be lower than retail price.' };
  const { error } = await db.from('settings').update(parsed.data).eq('id', true);
  if (error) return { ok: false, error: error.message };
  await audit(session.user.id, 'settings.update', 'settings', parsed.data);
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Settings saved.' };
}

// ─── Discount codes ──────────────────────────────────────────────────
const codeSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,24}$/, 'Code: 3–24 letters, numbers or -'),
  kind: z.enum(['percent', 'flat']),
  value: z.coerce.number().int().min(1),
  applies_to: z.enum(['all', 'backing', 'retail']),
  min_subtotal: z.coerce.number().int().min(0).default(0),
  max_uses: z.coerce.number().int().min(0).default(0),
  per_user_limit: z.coerce.number().int().min(1).default(1),
  expires_at: z.string().optional(),
  note: z.string().trim().max(120).optional(),
});

export async function createCode(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const parsed = codeSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const c = parsed.data;
  if (c.kind === 'percent' && c.value > 90) return { ok: false, error: 'Percent codes can be at most 90%.' };
  const { error } = await db.from('discount_codes').insert({
    code: c.code, kind: c.kind, value: c.value, applies_to: c.applies_to, min_subtotal: c.min_subtotal,
    max_uses: c.max_uses || null, per_user_limit: c.per_user_limit, note: c.note || null,
    expires_at: c.expires_at ? new Date(`${c.expires_at}T23:59:59+05:30`).toISOString() : null,
  });
  if (error) return { ok: false, error: error.message.includes('duplicate') ? 'That code already exists.' : error.message };
  await audit(session.user.id, 'code.create', c.code, c);
  revalidatePath('/admin/codes');
  return { ok: true };
}

export async function setCodeActive(code: string, active: boolean): Promise<Result> {
  const { session, db } = await guard();
  await db.from('discount_codes').update({ active }).eq('code', code);
  await audit(session.user.id, active ? 'code.enable' : 'code.disable', code);
  revalidatePath('/admin/codes');
  return { ok: true };
}

// ─── Back by demand ──────────────────────────────────────────────────
export async function reopenDesign(designId: string): Promise<Result> {
  const { session, db } = await guard();
  const { data, error } = await db.rpc('reopen_design', { p_design: designId });
  if (error) return { ok: false, error: error.message.includes('not_reopenable') ? 'Only finished designs can be reopened.' : error.message };
  await audit(session.user.id, 'design.reopen', designId, { notified: data });
  revalidatePath('/admin');
  return { ok: true, message: `Back on sale. ${data} people notified.` };
}

// ─── Returns & exchanges ─────────────────────────────────────────────
const returnSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['approved', 'rejected', 'completed']),
  admin_note: z.string().trim().max(300).optional(),
});

export async function resolveReturn(_: unknown, form: FormData): Promise<Result> {
  const { session, db } = await guard();
  const parsed = returnSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { id, status, admin_note } = parsed.data;
  if (status === 'rejected' && !admin_note) return { ok: false, error: 'Tell the member why.' };
  const { error } = await db.from('return_requests').update({
    status, admin_note: admin_note || null, resolved_at: status === 'approved' ? null : new Date().toISOString(),
  }).eq('id', id);
  if (error) return { ok: false, error: error.message };
  await audit(session.user.id, `return.${status}`, id, { admin_note });
  revalidatePath('/admin/returns');
  return { ok: true };
}

export async function hideReview(reviewId: string): Promise<Result> {
  const { session, db } = await guard();
  await db.from('reviews').update({ hidden: true }).eq('id', reviewId);
  await audit(session.user.id, 'review.hide', reviewId);
  revalidatePath('/admin/moderation');
  return { ok: true };
}
