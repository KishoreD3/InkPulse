import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { CheckoutError, checkoutSchema, startCheckout } from '@/lib/orders';
import { publicEnv } from '@/lib/env';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  if (session.profile.banned) return NextResponse.json({ error: 'This account cannot place orders.' }, { status: 403 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check your size, colour and address.' }, { status: 400 });

  try {
    const result = await startCheckout(session.user.id, parsed.data);
    return NextResponse.json({ ...result, keyId: publicEnv.razorpayKeyId, email: session.user.email ?? undefined });
  } catch (e) {
    if (e instanceof CheckoutError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error('checkout failed', e);
    return NextResponse.json({ error: 'Payments are unavailable right now. Please try again in a minute.' }, { status: 502 });
  }
}
