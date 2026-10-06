import Link from 'next/link';
import { inr } from '@/lib/format';
import { Shield } from './Icons';

export function HowItWorksStrip({ backerPrice, retailPrice, winners, artistPct }: { backerPrice: number; retailPrice: number; winners: number; artistPct: number }) {
  const steps = [
    ['01', 'Vote', 'New designs drop every Monday. Vote till Thursday.'],
    ['02', 'Back early', `Lock ${inr(backerPrice)} before 5,000 votes (${inr(retailPrice)} after). UPI AutoPay debits only if it prints.`],
    ['03', `Top ${winners} print`, 'Winners print Friday, made to order. Zero inventory.'],
    ['04', 'Artists get paid', `${artistPct}% of every tee goes straight to the artist who drew it.`],
  ];
  return (
    <section aria-label="How it works" className="bg-acid border-y-2 border-ink">
      <ol className="container-page py-7 grid gap-6 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {steps.map(([n, t, d]) => (
          <li key={n} className="flex gap-3.5 items-start">
            <span className="font-display text-[52px] leading-[0.85] text-transparent [-webkit-text-stroke:2px_#111111]" aria-hidden>{n}</span>
            <div><p className="font-display text-[22px] uppercase tracking-wide">{t}</p><p className="text-sm leading-snug">{d}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ArtistPanel({ compact = false, artistPct }: { compact?: boolean; artistPct?: number }) {
  if (compact) {
    return (
      <section className="border-2 border-ink rounded-[18px] bg-pink shadow-hard p-4 flex flex-col gap-3">
        <p className="font-display text-[30px] leading-[0.95]">GOT A DESIGN?<br />GET PAID. ZERO RISK.</p>
        {artistPct ? <p className="text-sm font-bold">You earn {artistPct}% of every tee sold — winners, reprints and back-by-demand runs.</p> : null}
        <div className="grid grid-cols-2 gap-2.5 text-[13px] leading-snug">
          <div className="bg-card border-2 border-ink rounded-xl p-2.5"><p className="label-mono pb-1">You bring</p>The art and your Insta / YouTube crowd</div>
          <div className="bg-ink text-white border-2 border-ink rounded-xl p-2.5"><p className="label-mono pb-1 text-acid">We handle</p>Payments, printing, shipping, support</div>
        </div>
        <Link href="/submit" className="btn-ink">Submit for review</Link>
      </section>
    );
  }
  return (
    <section id="for-artists" className="border-t-2 border-ink bg-pink halftone-light">
      <div className="container-page py-14 flex flex-wrap gap-10 items-center">
        <div className="flex-[1_1_360px] flex flex-col gap-4">
          <span className="self-start -rotate-3 sticker bg-acid">For artists</span>
          <h2 className="h-display text-[clamp(48px,6vw,80px)] leading-[0.9]">Your art.<br />Your crowd.<br />Zero risk.</h2>
          <p className="max-w-[460px] text-[17px] leading-relaxed">Turn your Instagram or YouTube following into income. No inventory, no upfront cost, no logistics. You earn {artistPct ? `${artistPct}% of` : 'on'} every tee sold — the winning run, the retail window and every back-by-demand reprint.</p>
          <Link href="/submit" className="self-start btn-ink shadow-[5px_5px_0_#fff]">Submit for review</Link>
        </div>
        <div className="flex-[1_1_460px] min-w-0 grid grid-cols-2 gap-4">
          <div className="bg-card border-2 border-ink rounded-[18px] shadow-hard p-5 flex flex-col gap-2">
            <p className="font-display text-[28px] pb-1">YOU BRING</p>
            {['The design', 'Your Instagram / YouTube audience', 'Hype during drop week'].map((x) => (
              <p key={x} className="border-t-2 border-dashed border-ink pt-2">{x}</p>
            ))}
          </div>
          <div className="bg-ink text-white border-2 border-ink rounded-[18px] shadow-[5px_5px_0_#fff] p-5 flex flex-col gap-2">
            <p className="font-display text-[28px] pb-1 text-acid">WE HANDLE</p>
            {['Payments & UPI AutoPay', 'DTG printing & quality checks', 'Packing, shipping, returns', 'Customer support & your payouts'].map((x) => (
              <p key={x} className="border-t-2 border-dashed border-[#6E6A85] pt-2">{x}</p>
            ))}
          </div>
        </div>
        <div className="basis-full flex flex-wrap gap-x-5 gap-y-2 items-center label-mono">
          <span className="bg-ink text-acid px-2 py-1 rounded flex items-center gap-1.5"><Shield size={14} /> Curated entry</span>
          <span>01 Submit</span><span aria-hidden>→</span><span>02 Human review: IP, stolen art, spam</span><span aria-hidden>→</span><span>03 Scheduled into a Monday drop</span>
        </div>
      </div>
    </section>
  );
}
