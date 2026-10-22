import Link from 'next/link';
import { inr } from '@/lib/format';
import { Shield } from './Icons';

export function HowItWorksStrip({ backerPrice, winners, artistPct }: { backerPrice: number; retailPrice?: number; winners: number; artistPct: number }) {
  const steps = [
    ['01', 'Topic drops', 'A fresh creative brief every Monday, 10 AM.'],
    ['02', 'Artists create', '~10 days to submit. Curators shortlist the finalists.'],
    ['03', 'You decide', `Vote free, or back for ${inr(backerPrice)}. Top ${winners} win.`],
    ['04', 'We print', 'Winners print Friday and ship in 5–7 days.'],
    ['05', 'Artists get paid', `${artistPct}% of every tee goes to the person who drew it.`],
  ];
  return (
    <section aria-label="How it works" className="bg-cream py-14 md:py-16">
      <div className="container-page">
        <p className="eyebrow pb-2">NO GATEKEEPERS. JUST GREAT ART.</p>
        <h2 className="text-[26px] md:text-[30px] font-extrabold tracking-[-0.03em] leading-none pb-8">You pick it. We print it.</h2>
        <ol className="grid gap-7 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {steps.map(([n, t, d]) => (
            <li key={n} className="border-t-2 border-strong pt-4 flex flex-col gap-2">
              <span className="w-8 h-8 rounded-full bg-yellow grid place-items-center text-[10px] font-black" aria-hidden>{n}</span>
              <p className="text-[18px] font-extrabold pt-4">{t}</p>
              <p className="text-[13px] leading-relaxed text-[#6D6F68]">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ArtistPanel({ compact = false, artistPct }: { compact?: boolean; artistPct?: number }) {
  if (compact) {
    return (
      <section className="rounded-[14px] bg-yellow p-5 flex flex-col gap-3">
        <p className="text-[24px] font-black tracking-[-0.03em] leading-none">MAKE ART?<br />MAKE IT WEARABLE.</p>
        {artistPct ? <p className="text-sm font-semibold">You earn {artistPct}% of every tee sold — winners, reprints and back-by-demand runs.</p> : null}
        <Link href="/submit" className="btn-ink self-start">Submit your design →</Link>
      </section>
    );
  }
  return (
    <section id="for-artists" className="container-page pt-14">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div className="rounded-[14px] bg-cream p-7 md:p-10 flex flex-col gap-5">
          <p className="eyebrow">FOR ARTISTS · ZERO RISK</p>
          <h2 className="text-[34px] md:text-[44px] font-black tracking-[-0.04em] leading-[0.95]">Your art. Your crowd.<br />Paid on every tee.</h2>
          <p className="max-w-[520px] text-[15px] leading-relaxed text-body">No inventory, no upfront cost, no logistics. You earn {artistPct ? `${artistPct}% of` : 'on'} every tee sold — the winning run, the retail window and every back-by-demand reprint.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 flex flex-col gap-1.5 text-[14px]">
              <p className="eyebrow pb-1">YOU BRING</p>
              {['The design', 'Your Instagram / YouTube audience', 'Hype during drop week'].map((x) => <p key={x}>— {x}</p>)}
            </div>
            <div className="bg-ink text-white rounded-xl p-4 flex flex-col gap-1.5 text-[14px]">
              <p className="eyebrow !text-yellow pb-1">WE HANDLE</p>
              {['Payments & UPI AutoPay', 'DTG printing & quality checks', 'Packing, shipping, returns', 'Support & your payouts'].map((x) => <p key={x}>— {x}</p>)}
            </div>
          </div>
          <p className="flex flex-wrap gap-x-4 gap-y-1 items-center text-[12px] font-semibold text-muted">
            <span className="flex items-center gap-1.5 text-ink"><Shield size={15} /> Curated entry</span>
            <span>01 Submit</span><span aria-hidden>→</span><span>02 Human review: IP, stolen art, spam</span><span aria-hidden>→</span><span>03 Into a Monday drop</span>
          </p>
        </div>
        <aside className="rounded-[14px] bg-yellow p-7 md:p-8 flex flex-col justify-between gap-6">
          <p className="text-[34px] font-black tracking-[-0.04em] leading-[0.95]">MAKE ART?<br />MAKE IT<br />WEARABLE.</p>
          <div className="flex flex-col gap-3">
            <p className="text-[14px] font-semibold">Submissions for the open topic are live now.</p>
            <Link href="/submit" className="btn-ink self-start">Submit your design →</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** Three drops overlap every week: one voting, one in submissions/review, one whose topic just went out. */
export function CycleRhythm({ reviewDays = 4 }: { reviewDays?: number }) {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // phase per day for a drop whose topic is revealed on day 0 (Monday of week 1)
  const closeDay = 14 - reviewDays - 1; // last submission day (Wed of week 2 by default)
  const phaseOf = (day: number) =>
    day < 0 ? null : day <= closeDay ? 'S' : day < 14 ? 'R' : day <= 17 ? 'V' : day === 18 ? 'P' : null;
  const style: Record<string, string> = { S: 'bg-yellow', R: 'bg-haze', V: 'bg-red text-white', P: 'bg-ink text-white' };
  const rows = [
    { label: 'Drop N', offset: 14 },   // voting this week
    { label: 'Drop N+1', offset: 7 },
    { label: 'Drop N+2', offset: 0 },  // topic out this Monday
  ];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] w-full border-separate border-spacing-[3px] font-mono text-[11px]">
        <caption className="text-left label-mono pb-2">Three weeks of INKPULSE — every row is one drop</caption>
        <thead>
          <tr><th />{[1, 2, 3].map((w) => <th key={w} colSpan={7} className="text-left font-display text-base font-normal">THIS WEEK{w > 1 ? ` +${w - 1}` : ''}</th>)}</tr>
          <tr><th />{[0, 1, 2].flatMap((w) => days.map((d, i) => <th key={`${w}${i}`} className="font-bold">{d}</th>))}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th className="text-left pr-2 whitespace-nowrap">{r.label}</th>
              {Array.from({ length: 21 }, (_, i) => {
                const p = phaseOf(i + r.offset);
                return <td key={i} className={`h-7 border-2 border-ink rounded text-center ${p ? style[p] : 'bg-card opacity-40'}`}>{p ?? ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="flex flex-wrap gap-3 pt-2 text-xs">
        <span><span className="inline-block w-3 h-3 border-2 border-ink bg-acid align-middle" /> S · artists submit</span>
        <span><span className="inline-block w-3 h-3 border-2 border-ink bg-haze align-middle" /> R · review</span>
        <span><span className="inline-block w-3 h-3 border-2 border-ink bg-red align-middle" /> V · voting</span>
        <span><span className="inline-block w-3 h-3 border-2 border-ink bg-ink align-middle" /> P · print</span>
      </p>
    </div>
  );
}
