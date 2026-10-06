import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { capturePayment, releasePayment } from '@/lib/payments/razorpay';
import { submitBatch, type PrintLine } from '@/lib/print';
import { dispatchPending } from '@/lib/notify/dispatch';
import type { Colourway } from '@/lib/types';

/**
 * The weekly heartbeat. Safe to run as often as you like (every 15 min in vercel.json):
 * every step only acts on rows whose time has come and that have not been processed.
 */
export async function tick() {
  const log: Record<string, unknown> = {};
  const admin = createAdminClient();

  const { data: opened, error: openErr } = await admin.rpc('open_due_drops');
  if (openErr) throw openErr;
  log.opened = opened;

  const { data: locked, error: lockErr } = await admin.rpc('lock_due_drops');
  if (lockErr) throw lockErr;
  log.locked = locked;

  // Keep two drops scheduled ahead, publish topics whose time has come, nudge artists on the last day.
  await admin.rpc('ensure_next_drop');
  const [{ data: topics }, { data: reminders }] = await Promise.all([admin.rpc('publish_due_topics'), admin.rpc('remind_closing_topics')]);
  log.topics = topics;
  log.reminders = reminders;

  log.settled = await settleBackings();
  log.printed = await printDueDrops();
  log.notified = await dispatchPending();
  return log;
}

/** After lock: capture winners' backings, release the rest. Retries failures on the next tick. */
export async function settleBackings() {
  const admin = createAdminClient();
  const { data } = await admin.from('orders')
    .select('id, total, gateway_payment_id, items:order_items(design:designs(status))')
    .eq('type', 'backing').eq('status', 'backed').eq('payment_status', 'authorized').limit(500);
  const orders = (data ?? []) as unknown as { id: string; total: number; gateway_payment_id: string | null; items: { design: { status: string } | null }[] }[];
  let captured = 0, released = 0, failed = 0;

  for (const o of orders) {
    const status = o.items[0]?.design?.status;
    if (status !== 'won' && status !== 'lost') continue; // drop still live
    if (!o.gateway_payment_id) continue;
    try {
      if (status === 'won') {
        await capturePayment(o.gateway_payment_id, o.total);
        await admin.from('orders').update({ status: 'won', payment_status: 'captured', captured_at: new Date().toISOString() })
          .eq('id', o.id).eq('status', 'backed');
        captured++;
      } else {
        await releasePayment(o.gateway_payment_id);
        await admin.from('orders').update({ status: 'released', payment_status: 'released', released_at: new Date().toISOString() })
          .eq('id', o.id).eq('status', 'backed');
        released++;
      }
    } catch (e) {
      failed++;
      const msg = (e as Error).message;
      // An expired authorisation cannot be captured: ask the backer to pay for their (winning) shirt.
      if (status === 'won' && /expired|not.*authorized|already/i.test(msg)) {
        await admin.from('orders').update({ status: 'pending', payment_status: 'created', failure_reason: 'authorisation_expired' }).eq('id', o.id);
        const { data: ord } = await admin.from('orders').select('user_id').eq('id', o.id).single();
        if (ord) await admin.rpc('notify_user', {
          p_user: ord.user_id, p_kind: 'pay_to_claim', p_title: 'Your design won — complete payment to get it',
          p_body: 'Your bank released the hold before the result. Pay now to keep your early-backer price.', p_link: `/orders/${o.id}`,
          p_channels: ['push', 'email', 'whatsapp'],
        });
      } else {
        await admin.from('orders').update({ failure_reason: msg.slice(0, 300) }).eq('id', o.id);
      }
      await admin.from('audit_log').insert({ action: 'settle.error', target: o.id, detail: { message: msg } });
    }
  }
  return { captured, released, failed };
}

/** Friday: everything paid and not yet batched goes to the printer; the drop moves to "printing". */
export async function printDueDrops(force = false) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: drops } = await admin.from('drops').select('id, number').eq('status', 'locked').lte('prints_at', force ? '9999-12-31' : now);
  const dueDrops = (drops ?? []) as { id: string; number: number }[];
  // Print runs once a week (Friday) with the drop; retail orders placed in between wait for it.
  if (dueDrops.length === 0 && !force) return { batched: 0 };

  // Do not print while winners still have backings waiting to be captured.
  for (const d of dueDrops) {
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
      .eq('drop_id', d.id).eq('type', 'backing').eq('status', 'backed');
    if ((count ?? 0) > 0) return { skipped: `drop ${d.number} still settling` };
  }

  const { data: orders } = await admin.from('orders')
    .select('id, number, ship_to, items:order_items(colour, size, qty, design:designs(slug, name, colours, art_front_url))')
    .in('status', ['won', 'paid']).is('print_batch_id', null).limit(2000);
  const rows = (orders ?? []) as unknown as {
    id: string; number: number; ship_to: Record<string, string | null>;
    items: { colour: string; size: string; qty: number; design: { slug: string; name: string; colours: Colourway[]; art_front_url: string } }[];
  }[];
  if (rows.length === 0 && dueDrops.length === 0) return { batched: 0 };

  let batched = 0;
  if (rows.length > 0) {
    const mode = process.env.PRINT_PARTNER_MODE || 'csv';
    const { data: batch } = await admin.from('print_batches').insert({ mode, drop_id: dueDrops[0]?.id ?? null }).select('id').single();
    const lines: PrintLine[] = rows.flatMap((o) => o.items.map((i) => {
      const cw = i.design.colours.find((c) => c.name === i.colour) ?? i.design.colours[0];
      return {
        order_number: o.number, order_id: o.id, design_slug: i.design.slug, design_name: i.design.name,
        artwork_url: cw?.art || i.design.art_front_url, shirt_colour: i.colour, shirt_hex: cw?.hex ?? '', size: i.size, qty: i.qty,
        ship_name: o.ship_to.name ?? '', ship_phone: o.ship_to.phone ?? '', ship_line1: o.ship_to.line1 ?? '', ship_line2: o.ship_to.line2 ?? '',
        ship_city: o.ship_to.city ?? '', ship_state: o.ship_to.state ?? '', ship_pin: o.ship_to.pin ?? '',
      };
    }));
    try {
      const res = await submitBatch(batch!.id, lines);
      await admin.from('print_batches').update({ status: 'sent', file_path: res.filePath ?? null, partner_ref: res.partnerRef ?? null }).eq('id', batch!.id);
      await admin.from('orders').update({ status: 'printing', print_batch_id: batch!.id }).in('id', rows.map((r) => r.id));
      batched = rows.length;
    } catch (e) {
      await admin.from('print_batches').update({ status: 'failed', error: (e as Error).message }).eq('id', batch!.id);
      throw e;
    }
  }
  if (dueDrops.length) await admin.from('drops').update({ status: 'printing', printed_at: now }).in('id', dueDrops.map((d) => d.id));
  return { batched };
}
