import Link from 'next/link';
import { requireArtist } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { DESIGN_STATUS_LABEL, dateShort, inr } from '@/lib/format';
import { savePayoutDetails } from '@/app/actions/profile';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { Tee, colourway } from '@/components/Tee';
import { ShareButton } from '@/components/ShareButton';
import type { Design } from '@/lib/types';

export const metadata = { title: 'Artist studio' };
export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const session = await requireArtist('/studio');
  const supabase = createClient();
  const [settings, { data: designs }, { data: earnings }, { data: payouts }, { data: priv }] = await Promise.all([
    getSettings(),
    supabase.from('designs').select('*').eq('artist_id', session.user.id).order('created_at', { ascending: false }),
    supabase.from('artist_earnings').select('amount, status, design_id').eq('artist_id', session.user.id),
    supabase.from('artist_payouts').select('*').eq('artist_id', session.user.id).order('paid_at', { ascending: false }),
    supabase.from('profile_private').select('pan, payout_upi, bank_account, bank_ifsc, kyc_status').eq('id', session.user.id).maybeSingle(),
  ]);
  const list = (designs ?? []) as Design[];
  const e = (earnings ?? []) as { amount: number; status: string; design_id: string }[];
  const sum = (s: string[]) => e.filter((x) => s.includes(x.status)).reduce((t, x) => t + x.amount, 0);
  const p = priv as { pan: string | null; payout_upi: string | null; bank_account: string | null; bank_ifsc: string | null; kyc_status: string } | null;

  return (
    <div className="container-page py-6 flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="h-display text-[44px] misprint">Artist studio</h1>
        <Link href="/submit" className="btn-pink">Submit a design</Link>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Live now', list.filter((d) => d.status === 'live').length],
          ['Printed', list.filter((d) => d.status === 'won').length],
          ['Earnings pending', inr(sum(['pending', 'payable']))],
          ['Paid out', inr(sum(['paid']))],
        ].map(([k, v]) => (
          <div key={k as string} className="card-flat p-4"><p className="font-display text-3xl">{v}</p><p className="label-mono">{k}</p></div>
        ))}
      </div>
      {!settings.artist_pct && <p className="bg-acid border-2 border-ink rounded-xl p-3 text-sm">The artist share percentage has not been published yet. Earnings will show once it is set.</p>}

      <section className="flex flex-col gap-3">
        <h2 className="h-display text-3xl"><span className="highlight">Your designs</span></h2>
        {list.length === 0 && <p className="card-flat p-5">No designs yet. Your first submission is one upload away.</p>}
        {list.map((d) => {
          const c = colourway(d);
          const earned = e.filter((x) => x.design_id === d.id && x.status !== 'void').reduce((t, x) => t + x.amount, 0);
          return (
            <div key={d.id} className="card p-3 flex flex-wrap items-center gap-4">
              <span className="w-20 h-20 border-2 border-ink rounded-xl bg-paper halftone-light grid place-items-center"><Tee shirt={c.hex} art={c.art} size={76} /></span>
              <div className="flex-1 min-w-[180px]">
                <p className="font-display text-xl uppercase">{d.name}</p>
                <p className="label-mono text-muted">{DESIGN_STATUS_LABEL[d.status]} · {dateShort(d.created_at)}</p>
                {d.review_note && ['changes_requested', 'rejected'].includes(d.status) && <p className="text-sm pt-1"><strong>Note:</strong> {d.review_note}</p>}
              </div>
              <div className="text-right font-mono text-sm">
                {['live', 'won', 'lost'].includes(d.status) && <p><strong>{d.vote_count.toLocaleString('en-IN')}</strong> votes · {d.backer_count} backers</p>}
                {earned > 0 && <p>Earned {inr(earned)}</p>}
              </div>
              <div className="flex gap-2">
                {['draft', 'changes_requested'].includes(d.status) && <Link href={`/submit?edit=${d.id}`} className="chip-off">Edit</Link>}
                {['live', 'won'].includes(d.status) && (
                  <>
                    <Link href={`/d/${d.slug}`} className="chip-off">View</Link>
                    <ShareButton title={`My design ${d.name} is live on INKPULSE — vote and back it before 5,000 votes`} path={`/d/${d.slug}`} />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="h-display text-2xl pb-1">Payout details</h2>
          <p className="text-sm text-body pb-3">KYC: <strong>{p?.kyc_status?.replace('_', ' ') ?? 'not started'}</strong>. Needed before your first payout.</p>
          <ActionForm action={savePayoutDetails} className="flex flex-col gap-3" success="Payout details saved.">
            <Field label="PAN" name="pan" defaultValue={p?.pan} placeholder="ABCDE1234F" maxLength={10} />
            <Field label="UPI ID" name="payout_upi" defaultValue={p?.payout_upi} placeholder="name@bank" />
            <Field label="Bank account" name="bank_account" defaultValue={p?.bank_account} inputMode="numeric" />
            <Field label="IFSC" name="bank_ifsc" defaultValue={p?.bank_ifsc} placeholder="HDFC0001234" maxLength={11} />
            <SubmitButton className="btn-ink">Save payout details</SubmitButton>
          </ActionForm>
        </section>
        <section className="card p-5">
          <h2 className="h-display text-2xl pb-3">Payout history</h2>
          {(payouts ?? []).length === 0 && <p className="text-sm text-body">No payouts yet.</p>}
          {((payouts ?? []) as { id: string; amount: number; utr: string | null; paid_at: string }[]).map((x) => (
            <div key={x.id} className="flex justify-between font-mono text-sm border-b-2 border-dashed border-ink py-2">
              <span>{dateShort(x.paid_at)} · UTR {x.utr ?? '—'}</span><strong>{inr(x.amount)}</strong>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
