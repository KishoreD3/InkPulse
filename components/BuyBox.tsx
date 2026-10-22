'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tee } from './Tee';
import { toast } from './Toaster';
import { sendVote } from '@/lib/votes';
import { addToBag } from '@/lib/cart';
import { tileFor } from '@/lib/colourway';
import { inr, num } from '@/lib/format';
import { Clock, Truck } from './Icons';
import type { Colourway, PriceType } from '@/lib/types';

interface Props {
  design: { id: string; slug: string; name: string; colours: Colourway[]; art_front_url: string; vote_count: number; backer_count?: number };
  sizes: string[];
  quote: { price: number; price_type: PriceType; order_type: 'backing' | 'retail' } | null;
  retailPrice: number;
  threshold: number;
  winners?: number;
  votingOpen: boolean;
  voted: boolean;
  signedIn: boolean;
  rankLabel?: string;
  stamp?: string;
  locksAt?: string | null;
  /** Title, artist and share row, shown above the price. */
  header?: React.ReactNode;
  /** Story, money split etc., shown under the buttons. */
  children?: React.ReactNode;
}

/**
 * Product page body: gallery on the left, a sticky details column on the right with
 * colour + size pickers and the vote / back / buy actions. Two-column ≥ md, stacked on phones
 * with a sticky buy bar above the tab bar.
 */
export function BuyBox(p: Props) {
  const router = useRouter();
  const colours = p.design.colours.length ? p.design.colours : [{ name: 'Default', hex: '#FFFFFF' }];
  const [ci, setCi] = useState(0);
  const [size, setSize] = useState(p.sizes.includes('M') ? 'M' : p.sizes[0]);
  const [voted, setVoted] = useState(p.voted);
  const [votes, setVotes] = useState(p.design.vote_count);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'back' | 'vote'>('back');
  const c = colours[ci];
  const bg = tileFor(p.design.slug).bg;
  const backing = p.quote?.order_type === 'backing';
  const off = p.quote && p.quote.price < p.retailPrice ? Math.round(((p.retailPrice - p.quote.price) / p.retailPrice) * 100) : 0;

  async function vote() {
    if (!p.signedIn) { router.push(`/signin?next=/d/${p.design.slug}`); return; }
    setBusy(true);
    const n = await sendVote(p.design.id, !voted);
    setBusy(false);
    if (n !== null) {
      if (!voted) {
        toast({ message: 'Voted! Get your friends in before Thursday.', action: { label: 'Story card', href: `/d/${p.design.slug}/card?size=story&kind=voted&download=1` } });
      }
      setVoted(!voted); setVotes(n);
    }
  }

  function act() {
    if (!p.quote) return;
    if (backing && mode === 'vote') { if (!voted) vote(); return; }
    if (backing) {
      const q = new URLSearchParams({ design: p.design.slug, colour: c.name, size, qty: '1' });
      router.push(`/checkout?${q}`);
    } else {
      addToBag({ designId: p.design.id, slug: p.design.slug, name: p.design.name, colour: c.name, size, qty: 1 });
      toast({ message: `${p.design.name} added to your bag.`, action: { label: 'View bag', href: '/bag' } });
    }
  }

  const ctaLabel = !p.quote ? '' : backing
    ? mode === 'vote' ? (voted ? '✓ Voted' : 'Vote free') : `Back it · ${size} · ${inr(p.quote.price)}`
    : `Add to bag · ${inr(p.quote.price)}`;

  return (
    <div className="grid gap-8 md:gap-12 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start">
      {/* Gallery */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-[4/5] rounded-xl overflow-hidden grid place-items-center" style={{ backgroundColor: bg }}>
          <Tee shirt={c.hex} art={c.art || p.design.art_front_url} size="84%" label={`${p.design.name} on a ${c.name} tee`} />
          {p.rankLabel && (
            <span className={`absolute left-3 top-3 rounded px-2.5 py-1.5 text-[11px] font-black tracking-[0.06em] ${p.stamp === 'PRINT ZONE' ? 'bg-red text-white' : 'bg-white text-ink'}`}>
              {p.rankLabel} · {p.stamp}
            </span>
          )}
        </div>
        {colours.length > 1 && (
          <div className="grid grid-cols-3 gap-3">
            {colours.slice(0, 3).map((x, i) => (
              <button key={x.name} onClick={() => setCi(i)} aria-label={`Show ${x.name}`}
                className={`aspect-square rounded-lg grid place-items-center ${i === ci ? 'ring-2 ring-ink' : ''}`} style={{ backgroundColor: bg }}>
                <Tee shirt={x.hex} art={x.art || p.design.art_front_url} size="80%" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-col gap-5 md:sticky md:top-4">
        {p.header}

        {p.votingOpen && (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <strong className="text-[22px] font-black tracking-[-0.02em]">{num(votes)}</strong>
              <span className="text-[13px] text-muted">votes{p.design.backer_count ? ` · ${num(p.design.backer_count)} backers` : ''}</span>
            </div>
            {p.threshold > 0 && (
              <div className="h-1.5 rounded-full bg-[#E7E7E2] overflow-hidden"><div className="h-full bg-ink rounded-full" style={{ width: `${Math.min(100, Math.round((votes / p.threshold) * 100))}%` }} /></div>
            )}
            {p.locksAt && (
              <p className="flex items-center justify-between rounded-lg bg-red-soft text-red px-3 py-2.5 text-[13px] font-bold">
                <span className="flex items-center gap-2"><Clock size={17} /> Voting closes</span>
                <span>{new Intl.DateTimeFormat('en-IN', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(p.locksAt))} IST</span>
              </p>
            )}
          </div>
        )}

        {p.quote ? (
          backing ? (
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="How do you want to support it?">
              <Choice on={mode === 'back'} onClick={() => setMode('back')} title={<>Back it <strong className="text-[17px]">{inr(p.quote.price)}</strong>{off > 0 && <> <s className="text-muted font-normal text-[13px]">{inr(p.retailPrice)}</s> <span className="price-off">{off}% OFF</span></>}</>}
                body={`Your vote + this tee reserved in your size. Charged only if it finishes top ${p.winners ?? 3}.`} tag="MOST POPULAR" />
              <Choice on={mode === 'vote'} onClick={() => setMode('vote')} title={<>Just vote — Free</>} body="Support the artist. One vote per design. Buy later if it wins." />
              {p.quote.price_type === 'full' && <p className="text-[12px] text-muted">This design passed {num(p.threshold)} votes, so backing is now {inr(p.quote.price)}.</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="flex items-baseline gap-2"><strong className="text-[28px] font-black tracking-[-0.02em]">{inr(p.quote.price)}</strong><span className="text-[12px] text-muted">incl. of all taxes</span></p>
              <p className="text-[13px] font-semibold text-green">Printed winner · ships in 5–7 days</p>
            </div>
          )
        ) : (
          <p className="card-flat p-4 font-semibold text-[14px]">This design is not on sale right now.</p>
        )}

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-[13px] font-bold pb-2.5">Colour: <span className="font-normal text-muted">{c.name}</span></legend>
          <div className="flex gap-2.5">
            {colours.map((x, i) => (
              <button key={x.name} onClick={() => setCi(i)} aria-label={x.name} aria-pressed={i === ci}
                className="w-8 h-8 rounded-full border-2 border-white"
                style={{ background: x.hex, boxShadow: i === ci ? '0 0 0 2px #11120F' : '0 0 0 1px #AAAAAA' }} />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="flex w-full justify-between text-[13px] font-bold pb-2.5">
            Select size <a href="/legal/size-guide" className="font-semibold underline">Size guide</a>
          </legend>
          <div className="flex flex-wrap gap-2">
            {p.sizes.map((s) => (
              <button key={s} onClick={() => setSize(s)} aria-pressed={s === size}
                className={`w-[52px] h-[42px] rounded-md border text-[13px] font-semibold ${s === size ? 'bg-ink text-white border-ink' : 'bg-white border-[#CCC] hover:border-ink'}`}>{s}</button>
            ))}
          </div>
          <p className="text-[12px] text-muted">240 GSM oversized cotton · printed to order</p>
        </fieldset>

        {p.quote && (
          <div className="fixed md:static bottom-[72px] inset-x-0 z-20 bg-white md:bg-transparent border-t md:border-0 border-line px-4 md:px-0 py-3 md:py-0 flex gap-2.5 items-center">
            <div className="md:hidden min-w-[78px]">
              <small className="block text-[9px] font-black tracking-[0.1em] text-muted">{backing ? 'BACK IF IT PRINTS' : 'TOTAL'}</small>
              <b className="text-[18px]">{inr(p.quote.price)}</b>
            </div>
            <button onClick={act} disabled={busy || (mode === 'vote' && voted)} className="btn-ink flex-1 !min-h-[50px] !text-[15px]">{ctaLabel}</button>
            {p.votingOpen && backing && mode === 'back' && (
              <button onClick={vote} disabled={busy} aria-pressed={voted}
                className={`hidden md:inline-flex btn !min-h-[50px] border ${voted ? 'border-green bg-green-soft text-green' : 'border-red text-red bg-white'}`}>
                {voted ? `✓ Voted · ${num(votes)}` : `Vote · ${num(votes)}`}
              </button>
            )}
          </div>
        )}
        {p.votingOpen && !backing && (
          <button onClick={vote} disabled={busy} aria-pressed={voted}
            className={`btn !min-h-[46px] border ${voted ? 'border-green bg-green-soft text-green' : 'border-red text-red bg-white'}`}>{voted ? `✓ Voted · ${num(votes)}` : `Vote · ${num(votes)}`}</button>
        )}

        <p className="flex items-center gap-3 rounded-lg border border-line p-3 text-[13px]">
          <Truck size={20} /><span><b className="block">Free shipping across India</b><span className="text-muted">{backing ? 'Winners print Friday and ship within a week.' : 'Printed to order, dispatched in 5–7 days.'}</span></span>
        </p>

        {p.children}
      </div>
    </div>
  );
}

function Choice({ on, onClick, title, body, tag }: { on: boolean; onClick: () => void; title: React.ReactNode; body: string; tag?: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={`text-left rounded-[9px] p-3.5 flex gap-3 items-start ${on ? 'border-[2px] border-strong' : 'border border-[#DDD]'}`}>
      <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${on ? 'border-ink shadow-[inset_0_0_0_3px_#fff] bg-ink' : 'border-[#BBB]'}`} aria-hidden />
      <span className="flex flex-col gap-1">
        <b className="text-[14px]">{title}</b>
        <span className="text-[12px] text-[#666]">{body}</span>
        {tag && <span className="self-start bg-yellow text-[9px] font-black px-1.5 py-0.5">{tag}</span>}
      </span>
    </button>
  );
}
