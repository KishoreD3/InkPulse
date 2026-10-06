import { createAdminClient } from '@/lib/supabase/server';
import { dropLabel, inr } from '@/lib/format';
import type { Drop } from '@/lib/types';

export const metadata = { title: 'Money' };

type Fin = { units: number; orders: number; revenue: number; gst: number; product_cost: number; shipping_cost: number; gateway_fees: number; artist_share: number; net_profit: number };

export default async function MoneyAdmin() {
  const db = createAdminClient();
  const [{ data: drops }, { data: s }] = await Promise.all([
    db.from('drops').select('*').in('status', ['locked', 'printing', 'shipped']).order('number', { ascending: false }).limit(12),
    db.from('settings').select('unit_cost, shipping_cost, artist_pct').single(),
  ]);
  const fins = await Promise.all(((drops ?? []) as Drop[]).map(async (d) => {
    const { data } = await db.rpc('drop_financials', { p_drop: d.id });
    return { drop: d, fin: ((data ?? []) as Fin[])[0] };
  }));
  const estimate = !s?.unit_cost || !s?.shipping_cost;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="h-display text-[40px]">Money</h1>
      <p className="text-sm text-body">Per drop, from captured payments only. Artists earn {s?.artist_pct}% of each tee&apos;s price before GST; pay them from Artist payouts.</p>
      {estimate && <p className="bg-acid border-2 border-ink rounded-xl p-3 text-sm font-semibold">Unit or shipping cost is 0 in Settings, so net profit below is overstated. Enter your print-partner quotes first.</p>}
      {fins.length === 0 && <p className="card-flat p-5">No finished drops yet.</p>}
      {fins.map(({ drop, fin }) => (
        <section key={drop.id} className="card p-5 flex flex-col gap-3">
          <h2 className="font-display text-2xl">{dropLabel(drop.number)}</h2>
          {fin && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs">
              {([['Tees', fin.units], ['Orders', fin.orders], ['Revenue', inr(fin.revenue)], ['GST', inr(fin.gst)], ['Product cost', inr(fin.product_cost)],
                ['Shipping', inr(fin.shipping_cost)], ['Gateway fees', inr(fin.gateway_fees)], ['Paid to artists', inr(fin.artist_share)], ['Net profit', inr(fin.net_profit)]] as [string, string | number][])
                .map(([k, v]) => <div key={k} className={`border-2 border-ink rounded-lg p-2 ${k === 'Paid to artists' ? 'bg-pink' : ''}`}><p className="text-muted">{k}</p><p className="font-bold text-sm">{v}</p></div>)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
