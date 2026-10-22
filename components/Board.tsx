'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase/client';
import { sendVote } from '@/lib/votes';
import { inr, num } from '@/lib/format';
import { Tee } from './Tee';
import { colourway, tileFor } from '@/lib/colourway';
import { toast } from './Toaster';
import { Scissors, Shield } from './Icons';
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
    <section aria-labelledby="board-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow pb-2 flex items-center gap-2"><i className="live-dot" /> {votingOpen ? 'LIVE BATTLE · VOTING NOW' : 'THIS DROP'}</p>
          <h2 id="board-title" className="text-[28px] md:text-[34px] font-extrabold tracking-[-0.03em] leading-none">The leaderboard</h2>
          <p className="flex items-center gap-1.5 text-[12px] text-muted pt-2"><Shield size={15} /> Every design human-reviewed · original art only · top {winners} print</p>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 pb-1" role="group" aria-label="Filter by category">
          {['All', ...usedCategories].map((c) => (
            <button key={c} onClick={() => setFilter(c)} aria-pressed={filter === c} className={filter === c ? 'chip-on' : 'chip-off'}>{c}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 && (
        <div className="card-flat p-8 text-center">
          <p className="font-extrabold text-xl">Nothing here yet</p>
          <p className="text-sm text-muted pt-1">Designs appear when the drop opens on Monday.</p>
        </div>
      )}

      {/* Phone: ranked list with a print line. Desktop: store grid, print zone highlighted. One realtime subscription feeds both. */}
      <div className={layout === 'grid'
        ? 'grid gap-x-4 gap-y-7 grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]'
        : 'flex flex-col gap-2.5 md:grid md:gap-x-4 md:gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]'}>
        {shown.map((d) => {
          const position = designs.indexOf(d) + 1;
          const top = position <= winners;
          const showLine = filter === 'All' && position === winners + 1;
          const lead = designs[winners - 1] && designs[winners] ? designs[winners - 1].vote_count - designs[winners].vote_count : null;
          const props = { d, position, top, voted: mine.has(d.id), busy: pending === d.id, votingOpen, threshold, backerPrice, onVote: () => toggle(d) };
          return (
            <div key={d.id} className="contents">
              {showLine && <PrintLine lead={lead} winners={winners} />}
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
  return d.vote_count < threshold ? `${num(threshold - d.vote_count)} votes left at ${inr(backerPrice)}` : 'Backer price closed';
}

function Meter({ d, threshold }: { d: DesignWithArtist; threshold: number }) {
  const pct = Math.min(100, Math.round((d.vote_count / threshold) * 100));
  return (
    <div className="h-1 rounded-full bg-[#E7E7E2] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={d.vote_count} aria-label="Votes toward the early-backer cut-off">
      <div className={`h-full rounded-full ${d.vote_count < threshold ? 'bg-ink' : 'bg-green'}`} style={{ width: `${pct}%` }} />
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
      className={`shrink-0 rounded-lg border font-extrabold text-[12px] inline-flex items-center justify-center gap-1.5 transition
        ${wide ? 'h-9 px-3 flex-1' : 'h-10 px-3'}
        ${voted ? 'border-green bg-green-soft text-green' : 'border-red bg-white text-red hover:bg-red-soft'} disabled:opacity-60`}
    >
      {voted ? '✓ Voted' : 'Vote'} · {num(d.vote_count)}
    </button>
  );
}

function BackBtn({ d, backerPrice, threshold, wide }: CardProps & { wide?: boolean }) {
  return (
    <Link href={`/d/${d.slug}`} className={`shrink-0 rounded-lg bg-yellow font-extrabold text-[12px] inline-flex items-center justify-center hover:brightness-95 ${wide ? 'h-9 px-3 flex-1' : 'h-10 px-3'}`}>
      {d.vote_count < threshold ? `Back ${inr(backerPrice)}` : 'Back it'}
    </Link>
  );
}

function ListCard(p: CardProps) {
  const { d, position, top, threshold, backerPrice } = p;
  const tile = tileFor(d.slug);
  const cw = colourway(d);
  return (
    <article className={`flex items-center gap-3 p-2.5 rounded-xl border ${top ? 'border-strong bg-white' : 'border-line bg-white'}`}>
      <span className={`w-7 text-center text-[17px] font-black ${top ? 'text-ink' : 'text-muted'}`}>#{position}</span>
      <Link href={`/d/${d.slug}`} aria-label={`Open ${d.name}`} className="w-[60px] h-[72px] shrink-0 rounded-lg grid place-items-center" style={{ backgroundColor: tile.bg }}>
        <Tee shirt={cw.hex} art={cw.art} size={58} />
      </Link>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Link href={`/d/${d.slug}`} className="font-bold text-[15px] leading-tight truncate">{d.name}</Link>
        <span className="text-[11px] text-muted truncate">@{d.artist?.handle} · {backerNote(d, threshold, backerPrice)}</span>
        <Meter d={d} threshold={threshold} />
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
    <article className="group flex flex-col gap-2.5 min-w-0">
      <Link href={`/d/${d.slug}`} aria-label={`Open ${d.name}`}
        className={`relative aspect-[4/5] rounded-[10px] grid place-items-center overflow-hidden ${top ? 'ring-2 ring-ink ring-offset-2' : ''}`}
        style={{ backgroundColor: tile.bg }}>
        <Tee shirt={cw.hex} art={cw.art} size="86%" className="transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className={`absolute left-2 top-2 rounded px-2 py-1 text-[10px] font-black ${top ? 'bg-ink text-white' : 'bg-white text-ink'}`}>#{position}</span>
        {top && <span className="badge-red !left-auto right-2">PRINT ZONE</span>}
      </Link>
      <div className="px-0.5 flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Link href={`/d/${d.slug}`} className="font-bold text-[14px] truncate">{d.name}</Link>
          <span className="text-[11px] font-bold text-muted shrink-0">{num(d.backer_count)} backers</span>
        </div>
        <span className="text-[12px] text-muted truncate">by @{d.artist?.handle} · {d.category}</span>
        <Meter d={d} threshold={threshold} />
        <span className="text-[11px] text-muted">{backerNote(d, threshold, backerPrice)}</span>
        <div className="flex gap-1.5 pt-0.5">
          <VoteBtn {...p} wide />
          {p.votingOpen && <BackBtn {...p} wide />}
        </div>
      </div>
    </article>
  );
}

function PrintLine({ lead, winners }: { lead: number | null; winners: number }) {
  return (
    <div className="col-span-full flex items-center justify-between gap-3 border-t-[2px] border-dashed border-red pt-2 mt-1 text-[11px] text-red" role="separator" aria-label={`Print line: the top ${winners} get printed`}>
      <span className="font-black tracking-[0.1em] flex items-center gap-1.5"><Scissors size={14} /> PRINT LINE</span>
      {lead !== null && <span>#{winners} leads #{winners + 1} by <b>{num(lead)} votes</b></span>}
    </div>
  );
}
