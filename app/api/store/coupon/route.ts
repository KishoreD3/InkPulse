import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStoreSession } from '@/lib/dnd/session';
import { CodeError, cleanCode, quoteCode } from '@/lib/discounts';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({ code: z.string().max(24), subtotal: z.number().int().min(0).max(100_000) });

/** Checks a code against the bag's buy-now subtotal. The checkout checks it again before charging. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a code.' }, { status: 400 });
  const code = cleanCode(parsed.data.code);
  if (!code) return NextResponse.json({ error: 'That code isn’t valid.' }, { status: 400 });
  const session = await getStoreSession();
  try {
    await quoteCode(session?.id ?? '00000000-0000-0000-0000-000000000000', code, 'retail', Math.max(parsed.data.subtotal, 1));
  } catch (e) {
    if (e instanceof CodeError) return NextResponse.json({ error: e.message }, { status: 409 });
    return NextResponse.json({ error: 'Couldn’t check that code. Try again.' }, { status: 500 });
  }
  const { data } = await createAdminClient().from('discount_codes').select('code, kind, value, note').eq('code', code).single();
  const c = data as { code: string; kind: 'percent' | 'flat'; value: number; note: string | null };
  const label = c.note ?? (c.kind === 'percent' ? `${c.value}% off` : `₹${c.value} off`);
  return NextResponse.json({ code: String(c.code).toUpperCase(), info: { kind: c.kind, value: c.value, label } });
}
