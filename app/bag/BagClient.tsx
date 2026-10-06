'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readBag, writeBag } from '@/lib/cart';
import { getBrowserClient } from '@/lib/supabase/client';
import { Tee } from '@/components/Tee';
import { inr } from '@/lib/format';
import type { CartLine, Colourway } from '@/lib/types';

export function BagClient({ price }: { price: number }) {
  const [lines, setLines] = useState<CartLine[] | null>(null);
  const [designs, setDesigns] = useState<Record<string, { colours: Colourway[]; art_front_url: string; status: string }>>({});

  useEffect(() => {
    const l = readBag(); setLines(l);
    if (l.length) getBrowserClient().from('designs').select('id, colours, art_front_url, status').in('id', l.map((x) => x.designId))
      .then(({ data }) => setDesigns(Object.fromEntries((data ?? []).map((d) => [d.id, d]))));
  }, []);

  const update = (next: CartLine[]) => { setLines(next); writeBag(next); };
  if (lines === null) return <div className="h-40 card-flat animate-pulse" aria-busy="true" />;
  if (lines.length === 0) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-4">
        <p className="h-display text-3xl">Bag is empty</p>
        <p className="text-body">Vote on the live drop, or grab a printed winner while it is still on sale.</p>
        <Link href="/" className="btn-pink">See the live drop</Link>
      </div>
    );
  }
  const total = lines.reduce((s, l) => s + l.qty * price, 0);
  return (
    <div className="flex flex-col gap-4">
      {lines.map((l, i) => {
        const d = designs[l.designId];
        const c = d?.colours.find((x) => x.name === l.colour) ?? d?.colours[0];
        return (
          <div key={`${l.designId}-${l.colour}-${l.size}`} className="card p-3 flex gap-3 items-center">
            <span className="w-[76px] h-[76px] border-2 border-ink rounded-xl bg-acid halftone-light grid place-items-center shrink-0">
              <Tee shirt={c?.hex ?? '#fff'} art={c?.art || d?.art_front_url} size={72} />
            </span>
            <div className="flex-1 min-w-0">
              <Link href={`/d/${l.slug}`} className="font-display text-xl uppercase">{l.name}</Link>
              <p className="font-mono text-[11px] text-body">{l.colour.toUpperCase()} · {l.size} · {inr(price)}</p>
              {d && d.status !== 'won' && <p className="text-xs font-bold text-pink">No longer on sale — remove it to continue.</p>}
            </div>
            <div className="flex items-center border-2 border-ink rounded-xl">
              <button aria-label="Decrease" className="w-9 h-10 font-display text-xl" onClick={() => update(lines.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>−</button>
              <span className="w-5 text-center font-display">{l.qty}</span>
              <button aria-label="Increase" className="w-9 h-10 font-display text-xl" onClick={() => update(lines.map((x, j) => (j === i ? { ...x, qty: Math.min(5, x.qty + 1) } : x)))}>+</button>
            </div>
            <button className="text-sm underline" onClick={() => update(lines.filter((_, j) => j !== i))}>Remove</button>
          </div>
        );
      })}
      <div className="flex items-center justify-between card-flat p-4">
        <span className="font-display text-2xl">{inr(total)}</span>
        <Link href="/checkout?from=bag" className="btn-pink">Checkout</Link>
      </div>
    </div>
  );
}
