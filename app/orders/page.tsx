import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ORDER_STATUS_LABEL, dateShort, inr } from '@/lib/format';
import type { Order } from '@/lib/types';

export const metadata = { title: 'My orders' };
export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  await requireSession('/orders');
  const { data } = await createClient().from('orders')
    .select('*, items:order_items(*, design:designs(id, slug, name, colours, art_front_url, status))')
    .neq('status', 'pending').order('created_at', { ascending: false }).limit(50);
  const { data: pending } = await createClient().from('orders').select('id, number, failure_reason')
    .eq('status', 'pending').eq('failure_reason', 'authorisation_expired');
  const orders = (data ?? []) as Order[];

  return (
    <div className="container-page py-6 max-w-3xl flex flex-col gap-4">
      <h1 className="h-display text-[40px] misprint">My orders</h1>
      {(pending ?? []).map((p) => (
        <Link key={p.id} href={`/orders/${p.id}`} className="bg-pink border-2 border-ink rounded-xl p-4 font-semibold shadow-hard">
          Order #{p.number} won! Complete payment to claim your shirt →
        </Link>
      ))}
      {orders.length === 0 && (
        <div className="card p-8 text-center">
          <p className="h-display text-3xl">No orders yet</p>
          <Link href="/" className="btn-pink mt-4">Back a design</Link>
        </div>
      )}
      {orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`} className="card p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl uppercase truncate">{o.items?.map((i) => i.design?.name).join(', ')}</p>
            <p className="font-mono text-[11px] text-muted">#{o.number} · {dateShort(o.created_at)} · {o.type === 'backing' ? 'BACKED' : 'RETAIL'}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl">{inr(o.total)}</p>
            <p className={`sticker ${o.status === 'released' ? 'bg-card' : o.status === 'failed' ? 'bg-pink' : 'bg-acid'} !text-[10px]`}>{ORDER_STATUS_LABEL[o.status]}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
