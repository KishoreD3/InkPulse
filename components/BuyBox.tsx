'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tee, tileFor } from './Tee';
import { toast } from './Toaster';
import { sendVote } from '@/lib/votes';
import { addToBag } from '@/lib/cart';
import { inr, num } from '@/lib/format';
import type { Colourway, PriceType } from '@/lib/types';

const HERO_TILES: Record<number, { bg: string; dark: boolean }> = {
  0: { bg: '#111111', dark: true },
  1: { bg: '#FF3EA5', dark: false },
  2: { bg: '#2F4BFF', dark: true },
  3: { bg: '#E4FF3B', dark: false },
};

interface Props {
  design: { id: string; slug: string; name: string; colours: Colourway[]; art_front_url: string; vote_count: number };
  sizes: string[];
  quote: { price: number; price_type: PriceType; order_type: 'backing' | 'retail' } | null;
  retailPrice: number;
  threshold: number;
  votingOpen: boolean;
  voted: boolean;
  signedIn: boolean;
  rankLabel?: string;
  stamp?: string;
  hero?: 'mobile' | 'desktop';
}

/** Colourway + size pickers, live mockup, vote and back/buy actions. */
export function BuyBox(p: Props) {
  const router = useRouter();
  const colours = p.design.colours.length ? p.design.colours : [{ name: 'Default', hex: '#FFFFFF' }];
  const [ci, setCi] = useState(0);
  const [size, setSize] = useState(p.sizes.includes('L') ? 'L' : p.sizes[0]);
  const [voted, setVoted] = useState(p.voted);
  const [votes, setVotes] = useState(p.design.vote_count);
  const [busy, setBusy] = useState(false);
  const c = colours[ci];
  const tile = HERO_TILES[ci % 4] ?? tileFor(p.design.slug);

  async function vote() {
    if (!p.signedIn) { router.push(`/signin?next=/d/${p.design.slug}`); return; }
    setBusy(true);
    const n = await sendVote(p.design.id, !voted);
    setBusy(false);
    if (n !== null) { setVoted(!voted); setVotes(n); }
  }

  function act() {
    if (!p.quote) return;
    if (p.quote.order_type === 'backing') {
      const q = new URLSearchParams({ design: p.design.slug, colour: c.name, size, qty: '1' });
      router.push(`/checkout?${q}`);
    } else {
      addToBag({ designId: p.design.id, slug: p.design.slug, name: p.design.name, colour: c.name, size, qty: 1 });
      toast({ message: `${p.design.name} added to your bag.`, action: { label: 'View bag', href: '/bag' } });
    }
  }

  const pct = Math.min(100, Math.round((votes / p.threshold) * 100));
  const left = Math.max(0, p.threshold - votes);

  return (
    <div className="flex flex-col gap-6">
      <div className={`relative h-[400px] md:h-[560px] border-2 border-ink rounded-[26px] md:shadow-hard-lg grid place-items-center overflow-hidden ${tile.dark ? 'halftone-dark' : 'halftone-light'}`}
        style={{ backgroundColor: tile.bg }}>
        <Tee shirt={c.hex} art={c.art || p.design.art_front_url} size="min(88%, 460px)" label={`${p.design.name} on a ${c.name} tee`} />
        {p.rankLabel && (
          <div className="absolute top-5 left-5 w-[92px] h-[92px] rounded-full bg-acid border-2 border-ink -rotate-[10deg] grid place-items-center text-center font-display leading-none">
            <span><span className="block text-[30px]">{p.rankLabel}</span><span className="block text-[11px] tracking-wider">{p.stamp}</span></span>
          </div>
        )}
      </div>

      {p.quote ? (
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-display text-[48px] leading-none highlight">{inr(p.quote.price)}</span>
          {p.quote.price_type === 'backer' && <span className="font-mono text-lg text-muted line-through">{inr(p.retailPrice)}</span>}
          <span className="label-mono">{p.quote.price_type === 'backer' ? 'Early-backer price' : p.quote.price_type === 'full' ? 'Backer window closed' : 'Printed · buy now'}</span>
        </div>
      ) : (
        <p className="card-flat p-4 font-semibold">This design is not on sale right now.</p>
      )}

      {p.votingOpen && (
        <section className="card p-4 flex flex-col gap-2.5">
          <div className="flex justify-between items-baseline">
            <h2 className="font-display text-xl tracking-wide">BACKER WINDOW</h2>
            <span className="font-mono text-sm"><strong>{num(votes)}</strong> / {num(p.threshold)}</span>
          </div>
          <div className="h-4 border-2 border-ink rounded-lg bg-card overflow-hidden"><div className={`h-full ${left > 0 ? 'stripes' : 'bg-ink'}`} style={{ width: `${pct}%` }} /></div>
          <p className="text-sm text-body">
            {left > 0 ? <><strong className="text-ink">{num(left)} votes left.</strong> </> : null}
            UPI AutoPay reserves it now and debits only if it makes the top 3 when voting locks on Thursday.
          </p>
        </section>
      )}

      <fieldset className="flex flex-col gap-2.5">
        <legend className="flex w-full justify-between font-display text-xl tracking-wide">
          COLOURWAY <span className="font-mono text-xs text-muted self-center">{c.name.toUpperCase()}</span>
        </legend>
        <div className="flex gap-3.5 pt-2">
          {colours.map((x, i) => (
            <button key={x.name} onClick={() => setCi(i)} aria-label={x.name} aria-pressed={i === ci}
              className="w-12 h-12 rounded-full border-2 border-ink"
              style={{ background: x.hex, boxShadow: i === ci ? '0 0 0 3px #E4DEFF, 0 0 0 5px #111' : '2px 2px 0 #111' }} />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="flex w-full justify-between font-display text-xl tracking-wide">
          SIZE · 240 GSM OVERSIZED <a href="/legal/size-guide" className="font-sans text-sm font-bold underline self-center">Size guide</a>
        </legend>
        <div className="grid grid-cols-5 gap-2 pt-2">
          {p.sizes.map((s) => (
            <button key={s} onClick={() => setSize(s)} aria-pressed={s === size}
              className={`h-[52px] rounded-xl border-2 border-ink font-display text-lg ${s === size ? 'bg-ink text-acid' : 'bg-card shadow-hard-sm'}`}>{s}</button>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-3 flex-wrap sticky bottom-[84px] md:static bg-paper py-2 md:py-0 -mx-4 px-4 md:mx-0 md:px-0 border-t-2 border-ink md:border-0 z-10">
        {p.votingOpen && (
          <button onClick={vote} disabled={busy} aria-pressed={voted}
            className={`btn min-h-[58px] w-[130px] text-2xl ${voted ? 'bg-ink text-acid' : 'bg-card shadow-hard'}`}>
            {voted ? 'VOTED' : 'VOTE'}
          </button>
        )}
        {p.quote && (
          <button onClick={act} className="btn-pink flex-1 min-h-[58px] text-xl md:text-2xl whitespace-nowrap">
            {p.quote.order_type === 'backing' ? `BACK IT · ${inr(p.quote.price)}` : `ADD TO BAG · ${inr(p.quote.price)}`}
          </button>
        )}
      </div>
    </div>
  );
}
