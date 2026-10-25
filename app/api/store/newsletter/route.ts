import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStoreSession } from '@/lib/dnd/session';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(120) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email.' }, { status: 400 });
  const session = await getStoreSession();
  const { error } = await createAdminClient().from('newsletter_signups')
    .upsert({ email: parsed.data.email, user_id: session?.id ?? null }, { onConflict: 'email', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: 'Couldn’t sign you up. Try again.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
