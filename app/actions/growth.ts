'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

type Result = { ok: true; message?: string } | { ok: false; error: string };

function readable(message: string, map: Record<string, string>, fallback: string) {
  const key = Object.keys(map).find((k) => message.includes(k));
  return key ? map[key] : fallback;
}

// ─── Invites ─────────────────────────────────────────────────────────
/** Links a newly signed-up member to whoever invited them (cookie set by middleware from ?ref=). */
export async function claimReferral(): Promise<{ claimed: boolean }> {
  const store = cookies();
  const ref = store.get('ink_ref')?.value;
  store.delete('ink_ref');
  const session = await getSession();
  if (!ref || !session || ref === session.profile.handle) return { claimed: false };
  const { data } = await createClient().rpc('claim_referral', { p_handle: ref });
  if (data) revalidatePath('/', 'layout');
  return { claimed: Boolean(data) };
}

// ─── Notify me ───────────────────────────────────────────────────────
export async function setWaitlist(designId: string, on: boolean): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in first.' };
  const supabase = createClient();
  const { error } = on
    ? await supabase.from('design_waitlist').insert({ design_id: designId, user_id: session.user.id })
    : await supabase.from('design_waitlist').delete().eq('design_id', designId).eq('user_id', session.user.id);
  if (error && !error.message.includes('duplicate')) return { ok: false, error: 'Could not update. Try again.' };
  revalidatePath('/d/[slug]', 'page');
  return { ok: true };
}

// ─── Returns & exchanges ─────────────────────────────────────────────
const photos = z.preprocess(
  (v) => (typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : []),
  z.array(z.string().url()).max(3),
);

const returnSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(['exchange', 'return']),
  reason: z.enum(['size', 'damaged', 'misprint', 'wrong_item', 'other']),
  newSize: z.string().max(8).optional(),
  details: z.string().trim().max(500).optional(),
  photos,
});

export async function requestReturn(_: unknown, form: FormData): Promise<Result> {
  const parsed = returnSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: 'Check the form and try again.' };
  const r = parsed.data;
  if (r.kind === 'exchange' && !r.newSize) return { ok: false, error: 'Pick the size you want instead.' };
  const { error } = await createClient().rpc('request_return', {
    p_order: r.orderId, p_kind: r.kind, p_reason: r.reason, p_new_size: r.newSize ?? null, p_details: r.details ?? null, p_photos: r.photos,
  });
  if (error) {
    return {
      ok: false,
      error: readable(error.message, {
        window_closed: 'The return window for this order has closed.',
        not_delivered: 'You can ask once the order is delivered.',
        already_requested: 'There is already a request open for this order.',
        bad_size: 'That size isn’t available.',
        bad_photo: 'Upload photos again and retry.',
      }, 'Could not send your request. Try again.'),
    };
  }
  revalidatePath(`/orders/${r.orderId}`);
  return { ok: true };
}

// ─── Reviews ─────────────────────────────────────────────────────────
const reviewSchema = z.object({
  itemId: z.string().uuid(),
  orderId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  fit: z.enum(['small', 'true', 'large']).optional().or(z.literal('')),
  body: z.string().trim().max(500).optional(),
  photos,
});

export async function postReview(_: unknown, form: FormData): Promise<Result> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: 'Pick a star rating.' };
  const r = parsed.data;
  const { error } = await createClient().rpc('post_review', {
    p_item: r.itemId, p_rating: r.rating, p_fit: r.fit || null, p_body: r.body ?? null, p_photos: r.photos,
  });
  if (error) {
    return {
      ok: false,
      error: readable(error.message, {
        not_delivered: 'You can review once it’s delivered.',
        bad_photo: 'Upload photos again and retry.',
        banned: 'This account cannot post reviews.',
      }, 'Could not save your review.'),
    };
  }
  revalidatePath(`/orders/${r.orderId}`);
  revalidatePath('/d/[slug]', 'page');
  return { ok: true };
}
