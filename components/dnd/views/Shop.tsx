'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { COLLECTIONS, COLOURS, FITS, SIZES, inr, moodBySlug, moods, type Product } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { useNow, useStore } from '@/lib/dnd/store';
import { FinalistCard, ProductCard } from '../cards';
import { Btn, Crumbs, Empty, Icon } from '../ui';

const PAGE = 6;
const SORTS = [['popular', 'Popular first'], ['newest', 'Newest'], ['rating', 'Top rated'], ['price', 'Price: low to high']] as const;

/** Sizes each fit is cut in. */
export const sizesFor = (p: Product) =>
  p.fit === 'Boxy Crop' ? SIZES.filter((s) => s !== '2XL' && s !== '3XL') : p.fit === 'Classic Crew' ? SIZES.filter((s) => s !== 'XS') : [...SIZES];

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function ShopView() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const { board: rank } = useStore();
  const { winners, prices, battle } = useCatalog();
  const RETAIL = prices.retail;
  const BACK = prices.back;
  const now = useNow(30_000);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const moodParam = list(params.get('mood'));
  const collection = params.get('collection');
  const live = params.get('view') === 'live' || collection === 'under-999' || moodParam.includes('under-999');
  const moodNames = moodParam.filter((m) => m !== 'under-999' && m !== 'oversized').map((m) => moodBySlug(m)?.name).filter(Boolean) as string[];
  const fits = [...list(params.get('fit')), ...(moodParam.includes('oversized') ? ['Oversized'] : [])];
  const colours = list(params.get('colour'));
  const sizes = list(params.get('size'));
  const max = Number(params.get('max') ?? 1499);
  const sort = params.get('sort') ?? 'popular';

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setShown(PAGE);
    router.replace(`${path}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
  const toggleIn = (key: string, current: string[], value: string) =>
    set({ [key]: (current.includes(value) ? current.filter((x) => x !== value) : [...current, value]).join(',') || null });
  const toggleMood = (slug: string) => toggleIn('mood', moodParam, slug);

  const products = (() => {
    let r = winners.filter((p) =>
      (!moodNames.length || moodNames.includes(p.mood)) &&
      (!fits.length || fits.includes(p.fit)) &&
      (!colours.length || p.colours.some((c) => colours.includes(c))) &&
      (!sizes.length || sizes.every((s) => sizesFor(p).includes(s as never))) &&
      (!collection || p.collections.includes(collection)) &&
      RETAIL <= max);
    r = [...r].sort((a, b) =>
      sort === 'newest' ? b.drop - a.drop : sort === 'rating' ? b.rating - a.rating || b.reviews - a.reviews : sort === 'price' ? 0 : b.sold - a.sold);
    return r;
  })();

  const board = rank(now);
  const liveList = sort === 'newest' ? [...board].reverse() : board;
  const count = live ? board.length : products.length;
  const activeChips: [string, () => void][] = [
    ...moodNames.map((m) => [m, () => toggleMood(moods.find((x) => x.name === m)!.slug)] as [string, () => void]),
    ...list(params.get('fit')).map((f) => [f, () => toggleIn('fit', list(params.get('fit')), f)] as [string, () => void]),
    ...colours.map((c) => [COLOURS.find((x) => x.key === c)?.name ?? c, () => toggleIn('colour', colours, c)] as [string, () => void]),
    ...sizes.map((s) => [`Size ${s}`, () => toggleIn('size', sizes, s)] as [string, () => void]),
    ...(collection && collection !== 'under-999' ? [[COLLECTIONS.find((c) => c.slug === collection)?.name ?? collection, () => set({ collection: null })] as [string, () => void]] : []),
    ...(max < 1499 ? [[`Under ${inr(max)}`, () => set({ max: null })] as [string, () => void]] : []),
  ];
  const clearAll = () => router.replace(live ? `${path}?view=live` : path, { scroll: false });
  const heading = collection ? COLLECTIONS.find((c) => c.slug === collection)?.name : live ? 'Live finalists' : 'All tees';

  return (
    <div className="page-width shop">
      <Crumbs items={[['Home', '/'], ['Shop', '/shop'], [heading ?? 'All tees']]} />
      <div className="shop-top">
        <div><h1>Tees that <span className="hl">do not</span> blend in.</h1><p>Original Indian art. Every sale pays the artist {prices.artistPct}%.</p></div>
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={!live} className={!live ? 'on' : ''} onClick={() => set({ view: null, collection: collection === 'under-999' ? null : collection, mood: moodParam.filter((m) => m !== 'under-999').join(',') || null })}>Winners<b>{inr(RETAIL)}</b></button>
          <button role="tab" aria-selected={live} className={live ? 'on' : ''} onClick={() => set({ view: 'live' })}><i className="live-dot" /> Live finalists<b>{inr(BACK)}</b></button>
        </div>
      </div>
      <div className="mobile-tools">
        <button onClick={() => setOpen(true)}><Icon name="filter" /> Filters{activeChips.length ? ` · ${activeChips.length}` : ''}</button>
        <label className="sort-mobile"><span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => set({ sort: e.target.value === 'popular' ? null : e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>Sort: {l}</option>)}</select>
        </label>
      </div>
      <div className="shop-layout">
        <aside className={`filters ${open ? 'open' : ''}`} aria-label="Filters">
          <div className="filters-head"><b>Filters</b><button onClick={() => setOpen(false)} aria-label="Close filters"><Icon name="close" /></button></div>
          <div className="fg"><h3>Mood</h3>{moods.slice(0, 6).map((m) => (
            <label key={m.slug}><input type="checkbox" checked={moodNames.includes(m.name)} onChange={() => toggleMood(m.slug)} /><span />{m.emoji} {m.name}</label>
          ))}</div>
          <div className="fg"><h3>Fit</h3>{FITS.map((f) => (
            <label key={f.name}><input type="checkbox" checked={fits.includes(f.name)} onChange={() => toggleIn('fit', list(params.get('fit')), f.name)} /><span />{f.name}</label>
          ))}</div>
          <div className="fg"><h3>Colour</h3><div className="swatch-row">{COLOURS.map((c) => (
            <button key={c.key} style={{ background: c.hex }} aria-label={c.name} title={c.name} aria-pressed={colours.includes(c.key)} className={colours.includes(c.key) ? 'on' : ''} onClick={() => toggleIn('colour', colours, c.key)} />
          ))}</div></div>
          <div className="fg"><h3>Size</h3><div className="size-row">{SIZES.map((s) => (
            <button key={s} aria-pressed={sizes.includes(s)} className={sizes.includes(s) ? 'on' : ''} onClick={() => toggleIn('size', sizes, s)}>{s}</button>
          ))}</div></div>
          <div className="fg"><h3>Price · up to {inr(max)}</h3><input type="range" min={699} max={1499} step={50} value={max} aria-label="Maximum price" onChange={(e) => set({ max: Number(e.target.value) >= 1499 ? null : e.target.value })} /><p className="range"><span>₹699</span><span>₹1,499</span></p></div>
          {activeChips.length > 0 && <button className="link small" onClick={clearAll}>Clear all filters</button>}
          <Btn v="dark" onClick={() => setOpen(false)} className="mobile-only">Show {count} {live ? 'designs' : 'tees'}</Btn>
        </aside>
        <div>
          <div className="list-head">
            <div className="chip-line"><b>{count} designs</b>{!live && activeChips.map(([label, remove]) => <button key={label} className="chip" onClick={remove}>{label} ✕</button>)}</div>
            <select value={sort} aria-label="Sort" onChange={(e) => set({ sort: e.target.value === 'popular' ? null : e.target.value })}>{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          {live && !board.length ? (
            <Empty title="No battle on right now." body={battle.drop ? `Drop ${battle.drop} opens for voting soon. Shop past winners meanwhile.` : 'The next battle opens Monday at 10 AM.'}>
              <Btn v="outline" onClick={() => set({ view: null })}>Shop winners</Btn>
            </Empty>
          ) : live ? (
            <div className="grid3">{liveList.map((f) => <FinalistCard key={f.id} s={f} leader={board[0].live} />)}</div>
          ) : products.length ? (
            <>
              <div className="grid3">{products.slice(0, shown).map((p, i) => <ProductCard key={p.id} p={p} tilt={i === 1 ? -3 : 0} />)}</div>
              {shown < products.length && <div className="center"><Btn v="outline" onClick={() => setShown((n) => n + PAGE)}>Load more · {products.length - shown} left</Btn></div>}
            </>
          ) : (
            <Empty title={max < RETAIL ? `Winners are ${inr(RETAIL)}.` : 'Nothing in this mood yet.'} body={max < RETAIL ? `Back a live finalist at ${inr(BACK)} instead.` : 'It’s sleeping. Try another one.'}>
              {max < RETAIL ? <Btn v="outline" onClick={() => set({ view: 'live', max: null })}>See live finalists</Btn> : <Btn v="outline" onClick={clearAll}>Clear filters</Btn>}
            </Empty>
          )}
        </div>
      </div>
      {open && <div className="sheet-bg" onClick={() => setOpen(false)} />}
    </div>
  );
}
