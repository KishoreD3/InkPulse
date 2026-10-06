import { createAdminClient } from '@/lib/supabase/server';
import { dropLabel, inr } from '@/lib/format';
import { createCause, createPartner, recordCausePayout } from '@/app/actions/admin';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import type { Cause, Drop } from '@/lib/types';

export const metadata = { title: 'Causes & money' };

type Fin = { units: number; orders: number; revenue: number; gst: number; product_cost: number; shipping_cost: number; gateway_fees: number; artist_share: number; net_profit: number; cause_amount: number };

export default async function CausesAdmin() {
  const db = createAdminClient();
  const [{ data: drops }, { data: causes }, { data: partners }, { data: payouts }, { data: s }] = await Promise.all([
    db.from('drops').select('*').in('status', ['locked', 'printing', 'shipped']).order('number', { ascending: false }).limit(8),
    db.from('causes').select('*').order('created_at', { ascending: false }),
    db.from('partners').select('*').order('name'),
    db.from('cause_payouts').select('*'),
    db.from('settings').select('unit_cost, shipping_cost, artist_pct, cause_pct_of_profit').single(),
  ]);
  const fins = await Promise.all(((drops ?? []) as Drop[]).map(async (d) => {
    const { data } = await db.rpc('drop_financials', { p_drop: d.id });
    return { drop: d, fin: ((data ?? []) as Fin[])[0] };
  }));
  const paid = new Map(((payouts ?? []) as { drop_id: string; amount: number; utr: string | null; published: boolean }[]).map((p) => [p.drop_id, p]));
  const cs = (causes ?? []) as Cause[];
  const estimate = !s?.unit_cost || !s?.shipping_cost;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="h-display text-[40px]">Causes &amp; money</h1>
      {estimate && <p className="bg-acid border-2 border-ink rounded-xl p-3 text-sm font-semibold">Unit or shipping cost is 0 in Settings, so net profit below is overstated. Enter your print-partner quotes first.</p>}

      {fins.map(({ drop, fin }) => {
        const p = paid.get(drop.id);
        const cause = cs.find((c) => c.id === drop.cause_id);
        return (
          <section key={drop.id} className="card p-5 flex flex-col gap-3">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-display text-2xl">{dropLabel(drop.number)} · {cause?.name ?? 'no cause set'}</h2>
              {p && <span className={`sticker ${p.published ? 'bg-acid' : 'bg-card'}`}>{p.published ? `Published · ${inr(p.amount)}` : 'Saved, not public'}</span>}
            </div>
            {fin && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 font-mono text-xs">
                {([['Units', fin.units], ['Revenue', inr(fin.revenue)], ['GST', inr(fin.gst)], ['Product cost', inr(fin.product_cost)], ['Shipping', inr(fin.shipping_cost)],
                  ['Gateway fees', inr(fin.gateway_fees)], ['Artist share', inr(fin.artist_share)], ['Net profit', inr(fin.net_profit)], [`Cause (${s?.cause_pct_of_profit}%)`, inr(fin.cause_amount)]] as [string, string | number][])
                  .map(([k, v]) => <div key={k} className="border-2 border-ink rounded-lg p-2"><p className="text-muted">{k}</p><p className="font-bold text-sm">{v}</p></div>)}
              </div>
            )}
            <ActionForm action={recordCausePayout} className="grid gap-3 md:grid-cols-4 items-end" success="Saved.">
              <input type="hidden" name="dropId" value={drop.id} />
              <input type="hidden" name="netProfit" value={fin?.net_profit ?? 0} />
              <Field label="Amount paid ₹" name="amount" defaultValue={String(p?.amount ?? fin?.cause_amount ?? 0)} inputMode="numeric" />
              <Field label="UTR / reference" name="utr" defaultValue={p?.utr} />
              <div><label className="field-label" htmlFor={`rc-${drop.id}`}>Receipt</label><input id={`rc-${drop.id}`} type="file" name="receipt" accept="application/pdf,image/png,image/jpeg" className="text-sm" /></div>
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="publish" defaultChecked={p?.published} className="w-5 h-5" />Publish to ledger</label>
              <SubmitButton className="btn-ink btn-sm md:col-span-4 justify-self-start">Save payout</SubmitButton>
            </ActionForm>
          </section>
        );
      })}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="h-display text-2xl">Add a cause</h2>
          <ActionForm action={createCause} className="flex flex-col gap-3" success="Cause added.">
            <Field label="Name" name="name" required />
            <div><label className="field-label" htmlFor="cdesc">Description</label><textarea id="cdesc" name="description" className="input py-2 min-h-[70px]" /></div>
            <div><label className="field-label" htmlFor="cp">Partner</label>
              <select id="cp" name="partner_id" className="input"><option value="">—</option>{((partners ?? []) as { id: string; name: string }[]).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <SubmitButton className="btn-ink btn-sm">Add cause</SubmitButton>
          </ActionForm>
        </section>
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="h-display text-2xl">Add a partner</h2>
          <ActionForm action={createPartner} className="flex flex-col gap-3" success="Partner added.">
            <Field label="Organisation name" name="name" required />
            <Field label="Registration no. (12A/80G/CSR-1)" name="registration_no" />
            <Field label="Website" name="website" type="url" />
            <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name="verified" className="w-5 h-5" />Documents verified</label>
            <SubmitButton className="btn-ink btn-sm">Add partner</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </div>
  );
}
