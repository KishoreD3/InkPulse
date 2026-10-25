import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { ORDER_STATUS_LABEL, dateShort, inr } from '@/lib/format';
import { markDelivered, markShipped, refundOrder } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import type { Order } from '@/lib/types';

export const metadata = { title: 'Orders & print' };

const FILTERS = ['printing', 'backed', 'won', 'paid', 'shipped', 'delivered', 'released', 'refunded', 'failed', 'pending'];

export default async function OrdersAdmin({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const status = FILTERS.includes(searchParams.status ?? '') ? searchParams.status! : 'printing';
  const db = createAdminClient();
  let q = db.from('orders').select('*, items:order_items(*, design:designs(slug, name)), shipment:shipments(*)')
    .eq('status', status).order('created_at', { ascending: false }).limit(100);
  if (searchParams.q && /^\d+$/.test(searchParams.q)) q = q.eq('number', Number(searchParams.q));
  const [{ data }, { data: batches }] = await Promise.all([
    q,
    db.from('print_batches').select('*').order('created_at', { ascending: false }).limit(8),
  ]);
  const orders = (data ?? []) as Order[];

  // Print summary: design × colour × size for orders currently printing.
  const summary = new Map<string, number>();
  if (status === 'printing') orders.forEach((o) => o.items?.forEach((i) => {
    const k = `${i.design?.name} · ${i.colour} · ${i.size}`; summary.set(k, (summary.get(k) ?? 0) + i.qty);
  }));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-[40px]">Orders &amp; print</h1>
        <form className="flex gap-2"><input name="q" className="input !w-40" placeholder="Order #" defaultValue={searchParams.q} /><input type="hidden" name="status" value={status} /><button className="chip-on">Find</button></form>
      </header>
      <nav className="flex flex-wrap gap-2">{FILTERS.map((f) => <Link key={f} href={`/admin/orders?status=${f}`} className={f === status ? 'chip-on' : 'chip-off'}>{f}</Link>)}</nav>

      {summary.size > 0 && (
        <section className="card p-4">
          <h2 className="h-display text-xl pb-2">Print summary</h2>
          <div className="grid sm:grid-cols-2 gap-1 font-mono text-sm">
            {Array.from(summary).sort().map(([k, v]) => <div key={k} className="flex justify-between border-b border-dashed border-ink"><span>{k}</span><strong>{v}</strong></div>)}
          </div>
        </section>
      )}

      <section className="card p-4">
        <h2 className="h-display text-xl pb-2">Recent print batches</h2>
        {((batches ?? []) as { id: string; created_at: string; status: string; mode: string; file_path: string | null; error: string | null }[]).map((b) => (
          <div key={b.id} className="flex flex-wrap justify-between gap-2 font-mono text-xs border-b border-dashed border-ink py-1.5">
            <span>{dateShort(b.created_at)} · {b.mode} · {b.status}{b.error ? ` · ${b.error}` : ''}</span>
            {b.file_path && <a className="underline font-bold" href={`/api/admin/print-batch/${b.id}`}>Download CSV</a>}
          </div>
        ))}
      </section>

      {orders.length === 0 && <p className="card-flat p-5">No {status} orders.</p>}
      {orders.map((o) => (
        <article key={o.id} className="card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-display text-xl">#{o.number} · {inr(o.total)} <span className="sticker bg-acid align-middle">{ORDER_STATUS_LABEL[o.status]}</span></p>
            <p className="font-mono text-xs text-muted">{o.type} · {o.payment_method ?? '—'} · {o.payment_status} · {dateShort(o.created_at)}</p>
          </div>
          <p className="text-sm">{o.items?.map((i) => `${i.design?.name} (${i.colour}, ${i.size}) ×${i.qty}`).join(' · ')}</p>
          <p className="text-sm text-body">{o.ship_to.name} · {o.ship_to.phone} · {o.ship_to.line1}, {o.ship_to.city} {o.ship_to.pin}</p>
          {['printing', 'won', 'paid'].includes(o.status) && (
            <ActionForm action={markShipped} className="flex flex-wrap gap-2 items-end" success="Shipped.">
              <input type="hidden" name="orderId" value={o.id} />
              <input name="carrier" className="input !w-36" placeholder="Courier" required aria-label="Courier" />
              <input name="awb" className="input !w-44" placeholder="AWB / tracking no." required aria-label="AWB" />
              <input name="trackingUrl" className="input !w-64" placeholder="Tracking URL (optional)" aria-label="Tracking URL" />
              <SubmitButton className="chip-on">Mark shipped</SubmitButton>
            </ActionForm>
          )}
          <div className="flex gap-2">
            {o.status === 'shipped' && <ActionButton run={markDelivered.bind(null, o.id)}>Mark delivered</ActionButton>}
            {o.payment_status === 'captured' && <ActionButton run={refundOrder.bind(null, o.id)} confirm={`Refund ${inr(o.total)} for order #${o.number}?`}>Refund</ActionButton>}
          </div>
        </article>
      ))}
    </div>
  );
}
