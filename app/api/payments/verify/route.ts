import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { applyPayment } from '@/lib/orders';
import { fetchPayment, verifyCheckoutSignature } from '@/lib/payments/razorpay';
import { dispatchPending } from '@/lib/notify/dispatch';

const schema = z.object({
  razorpay_order_id: z.string().min(5),
  razorpay_payment_id: z.string().min(5),
  razorpay_signature: z.string().min(10),
});

/** Called by the checkout page right after Razorpay's success handler. The webhook is the backstop. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Sign in again.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Bad payment response.' }, { status: 400 });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = parsed.data;

  if (!verifyCheckoutSignature(orderId, paymentId, sig)) {
    return NextResponse.json({ error: 'Payment signature mismatch.' }, { status: 400 });
  }
  const payment = await fetchPayment(paymentId);
  if (payment.order_id !== orderId) return NextResponse.json({ error: 'Payment does not match order.' }, { status: 400 });
  const res = await applyPayment(payment);
  if (!res.ok) return NextResponse.json({ error: 'Could not confirm payment. We will update your order shortly.' }, { status: 409 });
  dispatchPending().catch(() => {});
  return NextResponse.json({ orderId: res.orderId, status: payment.status });
}
