'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

type Result = { ok: true } | { ok: false; error: string };

const profileSchema = z.object({
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Handle: 3–24 letters, numbers or _'),
  name: z.string().trim().max(60).optional(),
  bio: z.string().trim().max(280).optional(),
  location: z.string().trim().max(60).optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
});

export async function updateProfile(_: unknown, form: FormData): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in again.' };
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await createClient().from('profiles').update({
    ...parsed.data, avatar_url: parsed.data.avatar_url || null,
  }).eq('id', session.user.id);
  if (error) return { ok: false, error: error.message.includes('duplicate') ? 'That handle is taken.' : 'Could not save.' };
  revalidatePath('/me');
  return { ok: true };
}

export async function updateNotifyPrefs(prefs: { push: boolean; email: boolean; whatsapp: boolean }): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in again.' };
  await createClient().from('profiles').update({ notify: prefs }).eq('id', session.user.id);
  return { ok: true };
}

const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default('Home'),
  name: z.string().trim().min(2, 'Name is required').max(80),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, '10-digit mobile number'),
  line1: z.string().trim().min(3, 'Address is required').max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  pin: z.string().trim().regex(/^[1-9]\d{5}$/, '6-digit PIN code'),
});

export async function saveAddress(_: unknown, form: FormData): Promise<Result & { id?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in again.' };
  const parsed = addressSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = createClient();
  const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id);
  const { data, error } = await supabase.from('addresses')
    .insert({ ...parsed.data, user_id: session.user.id, is_default: (count ?? 0) === 0 }).select('id').single();
  if (error) return { ok: false, error: 'Could not save the address.' };
  revalidatePath('/me'); revalidatePath('/checkout');
  return { ok: true, id: data.id as string };
}

export async function deleteAddress(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in again.' };
  await createClient().from('addresses').delete().eq('id', id);
  revalidatePath('/me');
  return { ok: true };
}

const payoutSchema = z.object({
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'PAN format: ABCDE1234F').optional().or(z.literal('')),
  payout_upi: z.string().trim().regex(/^[\w.-]{2,}@[a-zA-Z]{2,}$/, 'UPI ID like name@bank').optional().or(z.literal('')),
  bank_account: z.string().trim().regex(/^\d{9,18}$/, 'Account number: 9–18 digits').optional().or(z.literal('')),
  bank_ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'IFSC like HDFC0001234').optional().or(z.literal('')),
});

export async function savePayoutDetails(_: unknown, form: FormData): Promise<Result> {
  const session = await getSession();
  if (!session?.profile.is_artist) return { ok: false, error: 'Artists only.' };
  const parsed = payoutSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const clean = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v || null]));
  const { error } = await createClient().from('profile_private').update(clean).eq('id', session.user.id);
  if (error) return { ok: false, error: 'Could not save payout details.' };
  revalidatePath('/studio');
  return { ok: true };
}

export async function becomeArtist(_: unknown, form: FormData): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in again.' };
  if (form.get('agree') !== 'on') return { ok: false, error: 'Please accept the artist terms.' };
  // is_artist is not writable by the browser; flip it with the service role after the check above.
  const { createAdminClient } = await import('@/lib/supabase/server');
  const { error } = await createAdminClient().from('profiles').update({ is_artist: true }).eq('id', session.user.id);
  if (error) return { ok: false, error: 'Could not enable artist mode.' };
  await createAdminClient().from('audit_log').insert({ actor_id: session.user.id, action: 'artist.enable', target: session.user.id });
  redirect('/submit');
}

export async function signOut() {
  await createClient().auth.signOut();
  redirect('/');
}
