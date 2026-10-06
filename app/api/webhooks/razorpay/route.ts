import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { applyPayment } from '@/lib/orders';
import { verifyWebhookSignature, type RzpPayment } from '@/lib/payments/razorpay';

/**
 * Razorpay → Settings → Webhooks. URL: https://<your-domain>/api/webhooks/razorpay
 * Events: payment.authorized, payment.captured, payment.failed, refund.processed
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get('x-razorpay-signature') ?? '';
  if (!signature || !verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 });
  }
  const event = JSON.parse(raw) as {
    event: string;
    payload: { payment?: { entity: RzpPayment }; refund?: { entity: { payment_id: string } } };
  };
  const eventId = request.headers.get('x-razorpay-event-id') ?? `${event.event}:${event.payload.payment?.entity.id ?? Date.now()}`;

  const admin = createAdminClient();
  const { error: dup } = await admin.from('webhook_events').insert({ id: eventId, source: 'razorpay', type: event.event, payload: event });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  if (event.payload.payment?.entity) {
    await applyPayment(event.payload.payment.entity);
  } else if (event.event === 'refund.processed' && event.payload.refund) {
    await admin.from('orders').update({ payment_status: 'refunded', status: 'refunded' })
      .eq('gateway_payment_id', event.payload.refund.entity.payment_id).eq('payment_status', 'captured');
  }
  return NextResponse.json({ ok: true });
}
