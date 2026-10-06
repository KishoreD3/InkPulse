import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { CodeError, quoteCode } from '@/lib/discounts';

const schema = z.object({
  code: z.string().min(1).max(24),
  type: z.enum(['backing', 'retail']),
  subtotal: z.number().int().min(1).max(1_000_000),
});

/** Preview a discount code at checkout. The real amount is recomputed when the order is created. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to use a code.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Enter a code.' }, { status: 400 });
  try {
    const q = await quoteCode(session.user.id, parsed.data.code, parsed.data.type, parsed.data.subtotal);
    return NextResponse.json(q);
  } catch (e) {
    if (e instanceof CodeError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('code preview failed', e);
    return NextResponse.json({ error: 'Could not check that code right now.' }, { status: 502 });
  }
}
