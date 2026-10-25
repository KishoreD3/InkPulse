import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getStoreSession } from '@/lib/dnd/session';

export const dynamic = 'force-dynamic';

const schema = z.object({
  contact: z.object({ name: z.string().trim().min(2).max(60), email: z.string(), phone: z.string() }).optional(),
  address: z.object({
    name: z.string().trim().min(2).max(80), line1: z.string().trim().min(3).max(120), line2: z.string().trim().max(120),
    city: z.string().trim().min(2).max(60), state: z.string().trim().min(2).max(60), pin: z.string().trim().regex(/^[1-9]\d{5}$/),
  }).optional(),
  artistBio: z.string().trim().min(10).max(240).optional(),
  payoutUpi: z.string().trim().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/, 'Use the name@bank format.').optional(),
});

/** Name, default address, artist bio and payout UPI. Email and phone change through sign-in, not here. */
export async function POST(request: Request) {
  const session = await getStoreSession();
  if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the details.' }, { status: 400 });
  const { contact, address, artistBio, payoutUpi } = parsed.data;
  const db = createClient();

  if (contact) await db.from('profiles').update({ name: contact.name }).eq('id', session.id);
  if (artistBio !== undefined) await db.from('profiles').update({ bio: artistBio }).eq('id', session.id);
  if (payoutUpi !== undefined) {
    const { error } = await db.from('profile_private').update({ payout_upi: payoutUpi }).eq('id', session.id);
    if (error) return NextResponse.json({ error: 'Couldn’t save the payout account.' }, { status: 500 });
  }
  if (address) {
    const phone = (contact?.phone ?? session.phone ?? '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) return NextResponse.json({ error: 'Add a 10-digit mobile number for delivery.' }, { status: 400 });
    const row = { label: 'Home', name: address.name, phone, line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, pin: address.pin };
    const { data: existing } = await db.from('addresses').select('id').eq('user_id', session.id).order('is_default', { ascending: false }).limit(1).maybeSingle();
    const { error } = existing
      ? await db.from('addresses').update(row).eq('id', existing.id)
      : await db.from('addresses').insert({ ...row, user_id: session.id, is_default: true });
    if (error) return NextResponse.json({ error: 'Couldn’t save the address.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
