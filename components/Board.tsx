'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/client';
import { sendVote } from '@/lib/votes';
import { inr, num } from '@/lib/format';
import { Tee, colourway, tileFor } from './Tee';
import { toast } from './Toaster';
import { Scissors, Shield, Up } from './Icons';
import type { DesignWithArtist } from '@/lib/types';

interface Props {
  dropId: string;
  initial: DesignWithArtist[];
  voted: string[];
  signedIn: boolean;
  votingOpen: boolean;
  threshold: number;
  backerPrice: number;
  winners: number;
  categories: string[];
  layout?: 'list' | 'grid';
}

const rank = (list: DesignWithArtist[]) =>
  [...list].sort((a, b) => b.vote_count - a.vote_count || +new Date(a.count_reached_at) - +new Date(b.count_reached_at));

/** The live leaderboard: realtime counts, optimistic votes, print line under the winners. */
export function Board({ dropId, initial, voted, signedIn, votingOpen, threshold, backerPrice, winners, categories, layout = 'list' }: Props) {
  const [designs, setDesigns] = useState(() => rank(initial));
  const [mine, setMine] = useState(() => new Set(voted));
  const [pending, setPending] = useState<string | null>(null);
  const [filter, setFilter] = useState('All');

  // Live counts from every other voter.
  useEffect(() => {
    const supabase = getBrowserClient();
    const channel = supabase
      .channel(`drop-${dropId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'designs', filter: `drop_id=eq.${dropId}` }, (payload) => {
        const row = payload.new as DesignWithArtist;
        setDesigns((list) => rank(list.map((d) => (d.id === row.id ? { ...d, ...row, artist: d.artist } : d))));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dropId]);

  const shown = useMemo(() => (filter === 'All' ? designs : designs.filter((d) => d.category === filter)), [designs, filter]);
  const usedCategories = useMemo(() => categories.filter((c) => designs.some((d) => d.category === c)), [categories, designs]);

  async function toggle(d: DesignWithArtist) {
    if (!signedIn) {
      window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    if (!votingOpen || pending) return;
    const on = !mine.has(d.id);
    setPending(d.id);
    // optimistic
    setMine((s) => { const n = new Set(s); on ? n.add(d.id) : n.delete(d.id); return n; });
    setDesigns((l) => rank(l.map((x) => (x.id === d.id ? { ...x, vote_count: x.vote_count + (on ? 1 : -1) } : x))));
    const count = await sendVote(d.id, on);
    setPending(null);
    if (count === null) {
      setMine((s) => { const n = new Set(s); on ? n.delete(d.id) : n.add(d.id); return n; });
      setDesigns((l) => rank(l.map((x) => (x.id === d.id ? { ...x, vote_count: x.vote_count + (on ? -1 : 1) } : x))));
      return;
    }
    setDesigns((l) => rank(l.map((x) => (x.id === d.id ? { ...x, vote_count: count } : x))));
    if (on && count < threshold) {
      toast({ message: `Voted. Back it before ${num(threshold)} to lock ${inr(backerPrice)}.`, action: { label: 'Back it', href: `/d/${d.slug}` } });
    }
  }

  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="board-title" className="h-display text-[34px] md:text-[56px]"><span className="highlight">The board</span></h2>
          <p className="flex items-center gap-2 label-mono pt-2"><Shield size={16} /> Every design human-reviewed · original art only</p>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1" role="group" aria-label="Filter by category">
          {['All', ...usedCategories].map((c) => (
            <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c} className={filter === c ? 'chip-on' : 'chip-off'}>{c}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <div className="card-flat p-6 text-center">
          <p className="h-display text-2xl">Nothing here yet</p>
          <p className="text-sm text-body pt-1">Designs appear when the drop opens on Monday.</p>
        </div>
      )}

      {/* Phone: ranked list with a print line. Desktop: poster grid. One realtime subscription feeds both. */}
      <div className={layout === 'grid'
        ? 'grid gap-5 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]'
        : 'flex flex-col gap-3.5 md:grid md:gap-5 md:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]'}>
        {shown.map((d) => {
          const position = designs.indexOf(d) + 1;
          const top = position <= winners;
          const showLine = layout === 'list' && filter === 'All' && position === winners + 1;
          const props = { d, position, top, voted: mine.has(d.id), busy: pending === d.id, votingOpen, threshold, backerPrice, onVote: () => toggle(d) };
          return (
            <div key={d.id} className="contents">
              {showLine && <div className="md:hidden"><PrintLine /></div>}
              {layout === 'grid' ? <GridCard {...props} /> : (
                <>
                  <div className="md:hidden"><ListCard {...props} /></div>
                  <div className="hidden md:block"><GridCard {...props} /></div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

type CardProps = {
  d: DesignWithArtist; position: number; top: boolean; voted: boolean; busy: boolean;
  votingOpen: boolean; threshold: number; backerPrice: number; onVote: () => void;
};

function backerNote(d: DesignWithArtist, threshold: number, backerPrice: number) {
  return d.vote_count < threshold ? `${num(threshold - d.vote_count)} LEFT TO LOCK ${inr(backerPrice)}` : 'BACKER PRICE CLOSED';
}

function Meter({ d, threshold }: { d: DesignWithArtist; threshold: number }) {
  const pct = Math.min(100, Math.round((d.vote_count / threshold) * 100));
  return (
    <div className="h-[10px] border-2 border-ink rounded-md bg-card overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={d.vote_count} aria-label="Votes toward early-backer cut-off">
      <div className={`h-full ${d.vote_count < threshold ? 'stripes' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function VoteBtn({ d, voted, busy, votingOpen, onVote, wide }: CardProps & { wide?: boolean }) {
  return (
    <button
      onClick={onVote}
      disabled={!votingOpen || busy}
      aria-pressed={voted}
      aria-label={`${voted ? 'Remove vote for' : 'Vote for'} ${d.name}`}
      className={`shrink-0 border-2 border-ink rounded-xl font-mono font-bold text-xs flex items-center justify-center gap-1.5
        ${wide ? 'h-11 px-3.5' : 'w-[58px] h-[66px] flex-col'}
        ${voted ? 'bg-ink text-acid' : 'bg-card text-ink shadow-hard-sm active:shadow-none'} disabled:opacity-60`}
    >
      <Up size={wide ? 14 : 16} />{num(d.vote_count)}
    </button>
  );
}

function ListCard(p: CardProps) {
  const { d, position, top, threshold, backerPrice } = p;
  const tile = tileFor(d.slug);
  const cw = colourway(d);
  return (
    <article className={`flex items-center gap-3 p-2.5 bg-card border-2 border-ink rounded-2xl ${top ? 'shadow-hard' : 'shadow-hard-sm'}`}>
      <Link href={`/d/${d.slug}`} aria-label={`Open ${d.name}`}
        className={`relative w-[84px] h-[84px] shrink-0 border-2 border-ink rounded-xl grid place-items-center ${tile.dark ? 'halftone-dark' : 'halftone-light'}`}
        style={{ backgroundColor: tile.bg }}>
        <Tee shirt={cw.hex} art={cw.art} size={80} />
        <span className={`absolute -top-2 -left-2 min-w-[26px] h-[26px] px-1 rounded-full border-2 border-ink grid place-items-center font-display text-[13px] -rotate-6 ${top ? 'bg-acid' : 'bg-card'}`}>#{position}</span>
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Link href={`/d/${d.slug}`} className="font-display text-xl leading-none uppercase truncate">{d.name}</Link>
        <span className="font-mono text-[11px] text-muted truncate">@{d.artist?.handle}</span>
        <Meter d={d} threshold={threshold} />
        <span className="font-mono text-[10px] text-body">{backerNote(d, threshold, backerPrice)}</span>
      </div>
      <VoteBtn {...p} />
    </article>
  );
}

function GridCard(p: CardProps) {
  const { d, position, top, threshold, backerPrice } = p;
  const tile = tileFor(d.slug);
  const cw = colourway(d);
  return (
    <article className={`flex flex-col gap-3 p-3 bg-card border-2 border-ink rounded-[20px] ${top ? 'shadow-hard-lg' : 'shadow-hard'}`}>
      <Link href={`/d/${d.slug}`} aria-label={`Open ${d.name}`}
        className={`relative h-[250px] border-2 border-ink rounded-2xl grid place-items-center ${tile.dark ? 'halftone-dark' : 'halftone-light'}`}
        style={{ backgroundColor: tile.bg }}>
        <Tee shirt={cw.hex} art={cw.art} size={210} />
        <span className={`absolute top-3 left-3 w-[52px] h-[52px] rounded-full border-2 border-ink grid place-items-center font-display text-[22px] -rotate-[10deg] ${top ? 'bg-acid' : 'bg-card'}`}>#{position}</span>
        {top && <span className="absolute bottom-3 right-3 -rotate-6 sticker bg-card">Print zone</span>}
      </Link>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <Link href={`/d/${d.slug}`} className="block font-display text-2xl leading-none uppercase">{d.name}</Link>
          <span className="block font-mono text-[11px] text-muted pt-1">@{d.artist?.handle} · {d.category}</span>
        </div>
        <VoteBtn {...p} wide />
      </div>
      <Meter d={d} threshold={threshold} />
      <span className="font-mono text-[11px] text-body">{backerNote(d, threshold, backerPrice)}</span>
    </article>
  );
}

function PrintLine() {
  return (
    <div className="flex items-center gap-2 py-0.5 col-span-full" role="separator" aria-label="Print line: designs above this get printed">
      <Scissors />
      <div className="flex-1 border-t-2 border-dashed border-ink" />
      <span className="label-mono">Print line</span>
      <div className="flex-1 border-t-2 border-dashed border-ink" />
    </div>
  );
}
