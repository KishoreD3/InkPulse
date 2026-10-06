import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { ORDER_STATUS_LABEL, dateTime, inr } from '@/lib/format';
import { Tee } from '@/components/Tee';
import { ShareKit } from '@/components/ShareKit';
import { ReturnForm, ReviewForm } from './AfterSales';
import { PayToClaim } from './PayToClaim';
import type { Order, ReturnRequest, Review } from '@/lib/types';

export const metadata = { title: 'Order' };
export const dynamic = 'force-dynamic';

const STEPS_BACKING = ['backed', 'won', 'printing', 'shipped', 'delivered'] as const;
const STEPS_RETAIL = ['paid', 'printing', 'shipped', 'delivered'] as const;
const STEP_LABEL: Record<string, string> = {
  backed: 'Backed (mandate set)', won: 'Won · debited', paid: 'Paid', printing: 'Printing (Friday)', shipped: 'Shipped', delivered: 'Delivered',
};

export default async function OrderPage({ params, searchParams }: { params: { id: string }; searchParams: { new?: string; pending?: string } }) {
  await requireSession(`/orders/${params.id}`);
  const { data } = await createClient().from('orders')
    .select('*, items:order_items(*, design:designs(id, slug, name, colours, art_front_url, status)), shipment:shipments(*)')
    .eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const order = data as Order;
  const settings = await getSettings();
  const delivered = order.status === 'delivered';
  const supabase = createClient();
  const [{ data: rr }, { data: rv }] = delivered
    ? await Promise.all([
        supabase.from('return_requests').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').in('order_item_id', (order.items ?? []).map((i) => i.id)),
      ])
    : [{ data: [] }, { data: [] }];
  const requests = (rr ?? []) as ReturnRequest[];
  const activeRequest = requests.find((r) => r.status === 'open' || r.status === 'approved');
  const reviews = new Map(((rv ?? []) as Review[]).map((r) => [r.order_item_id, r]));
  const deliveredAt = order.shipment?.delivered_at ?? order.shipment?.shipped_at ?? null;
  const windowOpen = delivered && (!deliveredAt || Date.now() - new Date(deliveredAt).getTime() < settings.return_window_days * 86400_000);
  const steps = order.type === 'backing' ? STEPS_BACKING : STEPS_RETAIL;
  const reached = (steps as readonly string[]).indexOf(order.status);
  const first = order.items?.[0];
  const cw = first?.design?.colours.find((c) => c.name === first.colour) ?? first?.design?.colours[0];

  return (
    <div className="container-page py-6 max-w-3xl flex flex-col gap-6">
      {searchParams.new && (
        <div className="bg-acid border-2 border-ink rounded-2xl shadow-hard p-5 flex flex-col gap-3">
          <p className="h-display text-3xl">{order.type === 'backing' ? 'You backed it!' : 'Order placed!'}</p>
          <p className="text-sm">{order.type === 'backing'
            ? `${inr(order.total)} is reserved. Help it reach the top ${settings.winners_per_drop} — share it with your people.`
            : 'It ships with the next print batch. We will send tracking when it leaves the printer.'}
            {searchParams.pending ? ' Your payment is still confirming; this page updates shortly.' : ''}</p>
          {order.type === 'backing' && first?.design && (
            <ShareKit slug={first.design.slug} name={first.design.name} kind="backed" live />
          )}
        </div>
      )}

      <header className="flex items-center gap-4">
        <span className="w-24 h-24 border-2 border-ink rounded-2xl bg-ink halftone-dark grid place-items-center">
          {cw && <Tee shirt={cw.hex} art={cw.art || first?.design?.art_front_url} size={90} />}
        </span>
        <div>
          <h1 className="h-display text-[36px]">Order #{order.number}</h1>
          <p className="sticker bg-acid">{ORDER_STATUS_LABEL[order.status]}</p>
        </div>
      </header>

      {order.status === 'pending' && order.type === 'backing' && (
        <PayToClaim orderId={order.id} total={order.total} />
      )}

      {order.status !== 'released' && order.status !== 'failed' && order.status !== 'pending' && (
        <ol className="flex flex-col gap-2" aria-label="Order progress">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-3 p-3 border-2 border-ink rounded-xl ${i <= reached ? 'bg-card' : 'bg-transparent opacity-60'}`}>
              <span className={`w-7 h-7 rounded-full border-2 border-ink grid place-items-center font-display ${i <= reached ? 'bg-pink' : ''}`}>{i + 1}</span>
              <span className="font-semibold">{STEP_LABEL[s]}</span>
              {s === 'shipped' && order.shipment?.awb && (
                <a className="ml-auto text-sm underline font-bold" href={order.shipment.tracking_url ?? '#'} target="_blank" rel="noreferrer">Track {order.shipment.carrier} {order.shipment.awb}</a>
              )}
            </li>
          ))}
        </ol>
      )}
      {order.status === 'released' && (
        <p className="card-flat p-4">This design didn&apos;t make the top {settings.winners_per_drop}. <strong>Nothing was debited</strong> — your bank releases the reservation automatically. <Link href="/" className="underline font-bold">Back something in the next drop</Link>.</p>
      )}

      <section className="bg-card border-2 border-ink rounded-md p-4 font-mono text-sm flex flex-col gap-2">
        {order.items?.map((i) => (
          <div key={i.id} className="flex justify-between gap-3"><span>{i.design?.name} · {i.colour} · {i.size} ×{i.qty}</span><span>{inr(i.unit_price * i.qty)}</span></div>
        ))}
        {order.discount > 0 && <div className="flex justify-between"><span>CODE {order.discount_code ?? ''}</span><span>−{inr(order.discount)}</span></div>}
        <div className="flex justify-between"><span>SHIPPING</span><span>{order.shipping ? inr(order.shipping) : 'FREE'}</span></div>
        <div className="border-t-2 border-dashed border-ink my-1" />
        <div className="flex justify-between font-bold"><span>TOTAL</span><span>{inr(order.total)}</span></div>
        <div className="flex justify-between text-muted"><span>INCLUDES GST</span><span>{inr(order.gst_included)}</span></div>
        <div className="flex justify-between text-muted"><span>PAYMENT</span><span>{order.payment_method?.toUpperCase() ?? '—'} · {order.payment_status.toUpperCase()}</span></div>
        <div className="flex justify-between text-muted"><span>PLACED</span><span>{dateTime(order.created_at)}</span></div>
      </section>

      {delivered && (
        <section className="flex flex-col gap-3" aria-label="After delivery">
          {order.items?.map((i) => (
            <ReviewForm key={i.id} orderId={order.id} itemId={i.id} name={i.design?.name ?? 'Your tee'}
              existing={reviews.get(i.id) ? { rating: reviews.get(i.id)!.rating, fit: reviews.get(i.id)!.fit, body: reviews.get(i.id)!.body, photo_urls: reviews.get(i.id)!.photo_urls } : null} />
          ))}
          {activeRequest ? (
            <p className="card-flat p-4 text-sm">
              <strong>{activeRequest.kind === 'exchange' ? `Exchange to ${activeRequest.new_size}` : 'Return'}: {activeRequest.status === 'open' ? 'we’re reviewing it' : 'approved'}</strong>
              {activeRequest.admin_note ? <><br />{activeRequest.admin_note}</> : null}
            </p>
          ) : windowOpen ? (
            <ReturnForm orderId={order.id} sizes={settings.sizes} days={settings.return_window_days} />
          ) : null}
          {requests.filter((r) => r !== activeRequest).map((r) => (
            <p key={r.id} className="text-sm text-body">Earlier {r.kind}: {r.status}{r.admin_note ? ` — ${r.admin_note}` : ''}</p>
          ))}
        </section>
      )}

      <section className="card-flat p-4 text-sm">
        <p className="font-bold">Shipping to</p>
        <p>{order.ship_to.name} · {order.ship_to.phone}</p>
        <p className="text-body">{order.ship_to.line1}{order.ship_to.line2 ? `, ${order.ship_to.line2}` : ''}, {order.ship_to.city}, {order.ship_to.state} {order.ship_to.pin}</p>
      </section>
      <p className="text-sm text-body">Need help? Email <a className="underline" href={`mailto:${settings.support_email}`}>{settings.support_email}</a> with order #{order.number}.</p>
    </div>
  );
}
