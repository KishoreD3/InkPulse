import Link from 'next/link';
import { requireArtist } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getSettings } from '@/lib/data';
import { DESIGN_STATUS_LABEL, dateShort, inr } from '@/lib/format';
import { savePayoutDetails } from '@/app/actions/profile';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { Tee, colourway } from '@/components/Tee';
import { ShareKit } from '@/components/ShareKit';
import type { Design, DropTopic } from '@/lib/types';
import { getOpenTopics, topicTitle } from '@/lib/topics';
import { dayTime } from '@/lib/format';

export const metadata = { title: 'Artist studio' };
export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const session = await requireArtist('/studio');
  const supabase = createClient();
  const [settings, { data: designs }, { data: earnings }, { data: payouts }, { data: priv }, { data: sources }] = await Promise.all([
    getSettings(),
    supabase.from('designs').select('*').eq('artist_id', session.user.id).order('created_at', { ascending: false }),
    supabase.from('artist_earnings').select('amount, status, design_id').eq('artist_id', session.user.id),
    supabase.from('artist_payouts').select('*').eq('artist_id', session.user.id).order('paid_at', { ascending: false }),
    supabase.from('profile_private').select('pan, payout_upi, bank_account, bank_ifsc, kyc_status').eq('id', session.user.id).maybeSingle(),
    supabase.rpc('artist_source_stats'),
  ]);
  const open = await getOpenTopics();
  const topicIds = Array.from(new Set(((designs ?? []) as Design[]).map((d) => d.submitted_for ?? d.drop_id).filter(Boolean))) as string[];
  const { data: topicRows } = topicIds.length ? await supabase.from('drop_topics').select('*').in('drop_id', topicIds) : { data: [] };
  const topicOf = new Map(((topicRows ?? []) as DropTopic[]).map((t) => [t.drop_id, t]));
  const bySource = new Map<string, { source: string; votes: number; backers: number }[]>();
  ((sources ?? []) as { design_id: string; source: string; votes: number; backers: number }[]).forEach((r) => {
    bySource.set(r.design_id, [...(bySource.get(r.design_id) ?? []), r]);
  });
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
      {open.map((t) => {
        const mine = list.filter((d) => d.submitted_for === t.id && d.status !== 'withdrawn').length;
        return (
          <section key={t.id} className="bg-acid border-2 border-ink rounded-[18px] shadow-hard-sm p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="label-mono">Open topic · drop {String(t.number).padStart(3, '0')} · closes {dayTime(t.submissions_close_at)} IST</p>
              <p className="font-display text-3xl uppercase leading-none">{topicTitle(t.topic)}</p>
              <p className="text-sm pt-1">You&apos;ve sent {mine} of {settings.max_designs_per_artist}.</p>
            </div>
            {mine < settings.max_designs_per_artist && <Link href={`/submit?topic=${t.id}`} className="btn-ink">Submit for this topic</Link>}
            <Link href="/topics" className="text-sm font-bold underline">Read the brief</Link>
          </section>
        );
      })}
      {open.length === 0 && <p className="card-flat p-3 text-sm">No topic is open right now — <Link href="/topics" className="underline font-bold">see when the next one drops</Link>. You can still save drafts.</p>}
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
                <p className="label-mono text-muted">{DESIGN_STATUS_LABEL[d.status]} · {dateShort(d.created_at)}{(d.submitted_for ?? d.drop_id) ? ` · ${topicTitle(topicOf.get((d.submitted_for ?? d.drop_id)!))}` : ''}</p>
                {d.review_note && ['changes_requested', 'rejected'].includes(d.status) && <p className="text-sm pt-1"><strong>Note:</strong> {d.review_note}</p>}
              </div>
              <div className="text-right font-mono text-sm">
                {['live', 'won', 'lost'].includes(d.status) && <p><strong>{d.vote_count.toLocaleString('en-IN')}</strong> votes · {d.backer_count} backers</p>}
                {earned > 0 && <p>Earned {inr(earned)}</p>}
              </div>
              <div className="flex gap-2">
                {['draft', 'changes_requested'].includes(d.status) && <Link href={`/submit?edit=${d.id}`} className="chip-off">Edit</Link>}
                {['live', 'won', 'lost'].includes(d.status) && <Link href={`/d/${d.slug}`} className="chip-off">View</Link>}
              </div>
              {['live', 'won'].includes(d.status) && (
                <div className="basis-full flex flex-col gap-3 border-t-2 border-dashed border-ink pt-3">
                  <p className="text-sm font-semibold">Share kit — each button uses its own tracked link, so you can see what works.</p>
                  <ShareKit slug={d.slug} name={d.name} kind="artist" live={d.status === 'live'} />
                  {(bySource.get(d.id) ?? []).length > 0 && (
                    <table className="w-full max-w-md font-mono text-sm">
                      <caption className="text-left label-mono text-muted pb-1">Where your votes came from</caption>
                      <thead><tr className="text-left"><th className="font-bold">Source</th><th className="text-right">Votes</th><th className="text-right">Backers</th></tr></thead>
                      <tbody>
                        {(bySource.get(d.id) ?? []).map((r) => (
                          <tr key={r.source} className="border-t border-dashed border-ink">
                            <td>{r.source}</td><td className="text-right">{r.votes.toLocaleString('en-IN')}</td><td className="text-right">{r.backers}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
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
