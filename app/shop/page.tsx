import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DESIGN_SELECT, getCurrentDrop, getSettings } from '@/lib/data';
import { ProductCard } from '@/components/ProductCard';
import type { DesignWithArtist } from '@/lib/types';

export const metadata = { title: 'Shop graphic tees' };
export const dynamic = 'force-dynamic';

type View = 'all' | 'winners' | 'live';
const SORTS = { popular: 'Popular first', newest: 'Newest' } as const;
type Sort = keyof typeof SORTS;

/**
 * The store listing. Two kinds of stock share one grid:
 *  - printed winners still in their retail window (₹1,099, add to bag)
 *  - this week's live finalists (back for ₹899, charged only if they print)
 * Filters are plain links so the page works without JavaScript and is shareable.
 */
export default async function ShopPage({ searchParams }: { searchParams: { view?: string; cat?: string; sort?: string } }) {
  const view: View = searchParams.view === 'winners' || searchParams.view === 'live' ? searchParams.view : 'all';
  const sort: Sort = searchParams.sort === 'newest' ? 'newest' : 'popular';
  const [settings, drop] = await Promise.all([getSettings(), getCurrentDrop()]);
  const cat = settings.categories.includes(searchParams.cat ?? '') ? searchParams.cat! : null;
  const supabase = createClient();
  const now = new Date().toISOString();

  const sortCol = sort === 'newest' ? 'created_at' : 'vote_count';

  const [winnersRes, liveRes] = await Promise.all([
    view === 'live'
      ? Promise.resolve({ data: [] })
      : supabase.from('designs').select(DESIGN_SELECT).eq('status', 'won').gt('retail_until', now).order(sortCol, { ascending: false }).limit(60),
    view === 'winners' || drop?.status !== 'live'
      ? Promise.resolve({ data: [] })
      : supabase.from('designs').select(DESIGN_SELECT).eq('status', 'live').eq('drop_id', drop.id).order(sortCol, { ascending: false }).limit(60),
  ]);
  let winners = (winnersRes.data ?? []) as DesignWithArtist[];
  let live = (liveRes.data ?? []) as DesignWithArtist[];
  if (cat) {
    winners = winners.filter((d) => d.category === cat);
    live = live.filter((d) => d.category === cat);
  }
  const items: { d: DesignWithArtist; live: boolean }[] = [
    ...live.map((d) => ({ d, live: true })),
    ...winners.map((d) => ({ d, live: false })),
  ];
  if (sort === 'popular') items.sort((a, b) => b.d.vote_count - a.d.vote_count);

  const href = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const next = { view: view === 'all' ? null : view, cat, sort: sort === 'popular' ? null : sort, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    const s = p.toString();
    return `/shop${s ? `?${s}` : ''}`;
  };

  return (
    <div className="container-page py-6 md:py-8">
      <nav aria-label="Breadcrumb" className="text-[12px] text-muted pb-4">
        <Link href="/">Home</Link> / <span className="text-ink">Shop{view !== 'all' ? ` / ${view === 'winners' ? 'Winners' : 'Live finalists'}` : ''}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-5 pb-6">
        <div>
          <h1 className="text-[32px] md:text-[44px] font-black tracking-[-0.04em] leading-none">Graphic tees, picked by you.</h1>
          <p className="text-muted pt-2">Original Indian art. Every sale pays the artist {settings.artist_pct}%.</p>
        </div>
        <div className="flex bg-[#EEEEEA] rounded-[9px] p-1" role="group" aria-label="What to show">
          {([['all', 'Everything', null], ['winners', 'Winners', settings.retail_price], ['live', 'Live finalists', settings.backer_price]] as const).map(([v, label, price]) => (
            <Link key={v} href={href({ view: v === 'all' ? null : v })} aria-current={view === v ? 'true' : undefined}
              className={`px-3.5 py-2 rounded-md text-[12px] font-bold leading-tight ${view === v ? 'bg-white shadow-hard-sm' : 'text-body'}`}>
              {v === 'live' && <i className="live-dot mr-1.5 align-middle" />}{label}
              {price ? <b className="block text-[10px] font-extrabold text-muted">₹{price.toLocaleString('en-IN')}</b> : <b className="block text-[10px] font-extrabold text-muted">All</b>}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-[220px_1fr] gap-8 items-start">
        <aside className="md:sticky md:top-4 flex md:flex-col gap-2 md:gap-0 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0" aria-label="Filters">
          <h2 className="hidden md:block text-[12px] font-extrabold pb-3 border-b border-line">Category</h2>
          <Link href={href({ cat: null })} className={`md:hidden ${!cat ? 'chip-on' : 'chip-off'}`}>All</Link>
          <Link href={href({ cat: null })} className={`hidden md:flex items-center gap-2 py-2 text-[13px] ${!cat ? 'font-extrabold' : ''}`}>
            <span className={`w-4 h-4 rounded-[3px] border ${!cat ? 'bg-ink border-ink shadow-[inset_0_0_0_3px_#fff]' : 'border-[#BBB]'}`} /> All categories
          </Link>
          {settings.categories.map((c) => (
            <span key={c} className="contents">
              <Link href={href({ cat: c })} className={`md:hidden ${cat === c ? 'chip-on' : 'chip-off'}`}>{c}</Link>
              <Link href={href({ cat: c })} className={`hidden md:flex items-center gap-2 py-2 text-[13px] ${cat === c ? 'font-extrabold' : ''}`}>
                <span className={`w-4 h-4 rounded-[3px] border ${cat === c ? 'bg-ink border-ink shadow-[inset_0_0_0_3px_#fff]' : 'border-[#BBB]'}`} /> {c}
              </Link>
            </span>
          ))}
          <div className="hidden md:block border-t border-line mt-4 pt-4 text-[12px] text-muted leading-relaxed">
            Live finalists are backed, not bought: we place a {`₹${settings.backer_price.toLocaleString('en-IN')}`} hold and charge it only if the design finishes top {settings.winners_per_drop}.
          </div>
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
            <div className="flex items-center gap-2 text-[13px]">
              <b>{items.length} design{items.length === 1 ? '' : 's'}</b>
              {cat && <Link href={href({ cat: null })} className="rounded-full bg-[#F2F2EE] px-3 py-1.5 text-[12px] font-semibold">{cat} ✕</Link>}
            </div>
            <div className="flex gap-1.5 text-[12px]" role="group" aria-label="Sort">
              {(Object.keys(SORTS) as Sort[]).map((k) => (
                <Link key={k} href={href({ sort: k === 'popular' ? null : k })} className={sort === k ? 'chip-on !h-8 !px-3 !text-[12px]' : 'chip-off !h-8 !px-3 !text-[12px]'}>{SORTS[k]}</Link>
              ))}
            </div>
          </div>

          {items.length === 0 ? (
            <div className="card-flat p-10 text-center">
              <p className="font-extrabold text-lg">Nothing here right now</p>
              <p className="text-sm text-muted pt-1">{view === 'live' ? 'No drop is voting at the moment — the next one opens Monday.' : 'Winners appear here after each Friday print.'}</p>
              <Link href={href({ view: null, cat: null })} className="btn-white mt-5">See everything</Link>
            </div>
          ) : (
            <div className="grid gap-x-4 gap-y-8 grid-cols-2 lg:grid-cols-4">
              {items.map(({ d, live: isLive }) => (
                <ProductCard key={d.id} d={d}
                  live={isLive}
                  badge={isLive ? 'LIVE · BACK IT' : d.final_rank ? `WINNER · #${d.final_rank}` : 'WINNER'}
                  price={isLive && d.vote_count < settings.backer_threshold ? settings.backer_price : settings.retail_price}
                  mrp={settings.retail_price} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
