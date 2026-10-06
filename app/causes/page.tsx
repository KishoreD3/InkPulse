import { createClient } from '@/lib/supabase/server';
import { getCause, getLiveDrop, getSettings } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { dateShort, dropLabel, inr } from '@/lib/format';
import { CauseVote } from './CauseVote';

export const metadata = { title: 'Causes & impact ledger' };
export const dynamic = 'force-dynamic';

export default async function CausesPage() {
  const supabase = createClient();
  const [settings, drop, session] = await Promise.all([getSettings(), getLiveDrop(), getSession()]);
  const cause = await getCause(drop?.cause_id ?? null);

  const [{ data: shortlist }, { data: tally }, { data: myVote }, { data: ledger }, { data: totals }] = await Promise.all([
    drop ? supabase.from('cause_shortlist').select('cause:causes(id, name, description)').eq('drop_id', drop.id) : Promise.resolve({ data: [] }),
    drop ? supabase.rpc('cause_vote_tally', { p_drop: drop.id }) : Promise.resolve({ data: [] }),
    session && drop ? supabase.from('cause_votes').select('cause_id').eq('drop_id', drop.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('cause_payouts').select('amount, paid_at, utr, receipt_url, drop:drops(number), cause:causes(name)')
      .eq('published', true).order('paid_at', { ascending: false }),
    supabase.rpc('impact_totals'),
  ]);

  const counts = new Map(((tally ?? []) as { cause_id: string; votes: number }[]).map((t) => [t.cause_id, t.votes]));
  const options = ((shortlist ?? []) as unknown as { cause: { id: string; name: string; description: string | null } }[])
    .map((s) => ({ ...s.cause, votes: counts.get(s.cause.id) ?? 0 }));
  const t = ((totals ?? []) as { total_given: number; causes_funded: number; drops_run: number }[])[0];
  const rows = (ledger ?? []) as unknown as { amount: number; paid_at: string | null; utr: string | null; receipt_url: string | null; drop: { number: number }; cause: { name: string } }[];

  return (
    <div className="container-page py-6 flex flex-col gap-10 max-w-4xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <h1 className="h-display text-[48px] misprint-blue">Causes</h1>
        <span className="label-mono">{settings.cause_pct_of_profit}% of net profit · every drop</span>
      </header>

      {cause && (
        <section className="relative bg-cobalt halftone-dark text-white border-2 border-ink rounded-[22px] shadow-hard p-6 flex flex-col gap-3">
          <span className="self-start -rotate-3 bg-acid text-ink border-2 border-ink px-2.5 py-1 rounded font-display tracking-wider">THIS DROP’S CAUSE</span>
          <p className="font-display text-[44px] leading-[0.95] uppercase">{cause.name}</p>
          <p className="text-cobalt-soft">With {cause.partner?.name ?? 'our partner'} {drop ? `· ${dropLabel(drop.number)}` : ''}</p>
          {cause.description && <p className="max-w-xl">{cause.description}</p>}
          <p className="font-marker text-lg -rotate-2 self-end">paid when the drop ships</p>
        </section>
      )}

      {drop && options.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-end">
            <h2 className="h-display text-[30px]"><span className="highlight">Pick the next one</span></h2>
            <span className="label-mono text-muted">Locks Thursday</span>
          </div>
          <CauseVote options={options} mine={(myVote as { cause_id: string } | null)?.cause_id ?? null} signedIn={Boolean(session)} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="h-display text-[30px]"><span className="highlight">The receipts</span></h2>
        <div className="bg-card border-2 border-ink rounded-md p-5 font-mono text-sm flex flex-col gap-3 shadow-hard">
          <p className="text-center font-bold tracking-[2px]">INKPULSE IMPACT LEDGER</p>
          <p className="text-center text-muted">EVERY RUPEE · PUBLIC · VERIFIED</p>
          {t && (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="font-display text-2xl">{inr(t.total_given)}</p><p className="text-[10px]">GIVEN</p></div>
              <div><p className="font-display text-2xl">{t.causes_funded}</p><p className="text-[10px]">CAUSES FUNDED</p></div>
              <div><p className="font-display text-2xl">{t.drops_run}</p><p className="text-[10px]">DROPS RUN</p></div>
            </div>
          )}
          <div className="border-t-2 border-dashed border-ink" />
          {rows.length === 0 && <p className="text-center text-muted">The first payout appears after the first drop ships.</p>}
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="font-bold w-12">D{r.drop?.number}</span>
              <span className="flex-1">
                <span className="block font-sans font-semibold text-sm">{r.cause?.name}</span>
                <span className="text-[11px] text-muted">{r.paid_at ? dateShort(r.paid_at) : 'Pending'} · UTR {r.utr ?? '—'}</span>
                {r.receipt_url && <a className="block font-bold text-cobalt underline" href={r.receipt_url} target="_blank" rel="noreferrer">VIEW TRANSFER RECEIPT</a>}
              </span>
              <span className="font-bold">{inr(r.amount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
