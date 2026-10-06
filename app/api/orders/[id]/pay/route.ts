import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { createRetailOrder } from '@/lib/payments/razorpay';
import { publicEnv } from '@/lib/env';

/** Re-open payment for a winning backing whose authorisation expired (immediate capture). */
export async function POST(_: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, number, user_id, total, status, type, failure_reason')
    .eq('id', params.id).maybeSingle();
  if (!order || order.user_id !== session.user.id) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.status !== 'pending' || order.failure_reason !== 'authorisation_expired') {
    return NextResponse.json({ error: 'This order does not need payment.' }, { status: 409 });
  }
  const gw = await createRetailOrder({ amount: order.total, receipt: `INK-${order.number}-claim`, notes: { order_id: order.id, claim: 'true' } });
  await admin.from('orders').update({ gateway_order_id: gw.id, gateway_payment_id: null, payment_status: 'created' }).eq('id', order.id);
  return NextResponse.json({ keyId: publicEnv.razorpayKeyId, gatewayOrderId: gw.id, amountPaise: gw.amount });
}
