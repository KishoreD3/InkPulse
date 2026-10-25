'use client';
import { useState } from 'react';
import { isSouth } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { useNow, useStore } from '@/lib/dnd/store';
import { ArtistCard, FinalistCard, ProductCard, fans } from '../cards';
import { Btn, Empty, Icon, Photo } from '../ui';

const CHIPS = ['All artists', 'Following', 'Most wins', 'Rising', 'Typography', 'Illustration', 'South India'] as const;

export function ArtistsView() {
  const { state } = useStore();
  const { artists, prices } = useCatalog();
  const ARTIST_PCT = prices.artistPct;
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<(typeof CHIPS)[number]>('All artists');
  const term = q.trim().toLowerCase();
  let list = artists.filter((a) => !term || `${a.name} ${a.city} ${a.styles.join(' ')}`.toLowerCase().includes(term));
  if (chip === 'Following') list = list.filter((a) => state.follows.includes(a.slug));
  if (chip === 'Most wins') list = [...list].sort((a, b) => b.wins - a.wins || b.finalists - a.finalists);
  if (chip === 'Rising') list = list.filter((a) => a.wins <= 1).sort((a, b) => b.finalists - a.finalists);
  if (chip === 'Typography' || chip === 'Illustration') list = list.filter((a) => a.styles.includes(chip));
  if (chip === 'South India') list = list.filter(isSouth);

  return (
    <div className="page-width artists">
      <div className="page-title"><p className="eyebrow">DO NOT DUPE · ORIGINAL ART ONLY</p><h1>Meet the artists.</h1><p className="muted">Illustrators, typographers and beautiful weirdos from across India. They earn {ARTIST_PCT}% of every tee, forever.</p></div>
      <div className="artist-search"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by artist or city" aria-label="Search artists" /></div>
      <div className="chips">{CHIPS.map((x) => <button key={x} aria-pressed={chip === x} className={chip === x ? 'on' : ''} onClick={() => setChip(x)}>{x}{x === 'Following' && state.follows.length ? ` · ${state.follows.length}` : ''}</button>)}</div>
      {list.length ? <div className="artist-grid">{list.map((a) => <ArtistCard key={a.slug} a={a} />)}</div>
        : !artists.length ? <Empty title="No artists yet." body="Submit your art to be the first one here." />
        : <Empty title={chip === 'Following' ? 'You’re not following anyone yet.' : 'No artists match that.'} body={chip === 'Following' ? 'Follow artists to hear when their designs hit the battle.' : 'Try a city, or clear the search.'}><Btn v="outline" onClick={() => { setQ(''); setChip('All artists'); }}>Show all artists</Btn></Empty>}
    </div>
  );
}

export function ArtistProfileView({ slug }: { slug: string }) {
  const { artistBySlug, winners, prices, mode } = useCatalog();
  const ARTIST_PCT = prices.artistPct;
  const a = artistBySlug(slug)!;
  const { state, toggleFollow, board: rank } = useStore();
  const now = useNow(30_000);
  const [tab, setTab] = useState('Winners');
  const following = state.follows.includes(slug);
  const own = winners.filter((w) => w.artistSlug === slug);
  const board = rank(now);
  const theirFinalists = board.filter((f) => f.artistSlug === slug);
  const first = a.name.split(' ')[0];

  return (
    <div>
      <section className="profile-head">
        <div className="page-width ph-grid">
          <Photo src={a.photo} tint={a.image} alt={a.name} className="ph-photo" eager />
          <div>
            <p className="eyebrow light">{[a.city.toUpperCase(), a.tagline].filter(Boolean).join(' · ')}</p><h1>{a.name}</h1><p>{a.bio}</p>
            <Btn v="yellow" onClick={() => toggleFollow(slug)}>{following ? '✓ Following' : 'Follow'} · {fans(a.followers + (following && mode === 'demo' ? 1 : 0))}</Btn>
          </div>
          <div className="ph-stats">{[[String(a.wins), 'WINS'], [String(a.finalists), 'FINALISTS'], [a.votes, 'VOTES'], [a.sold, 'TEES SOLD']].map(([n, l]) => <div key={l}><b>{n}</b><span>{l}</span></div>)}</div>
        </div>
      </section>
      <div className="page-width section">
        <div className="tabs" role="tablist">{['Winners', 'Live now', 'About'].map((x) => <button key={x} role="tab" aria-selected={tab === x} className={tab === x ? 'on' : ''} onClick={() => setTab(x)}>{x}{x === 'Winners' ? ` · ${own.length}` : x === 'Live now' ? ` · ${theirFinalists.length}` : ''}</button>)}</div>
        {tab === 'About' ? (
          <div className="bio"><h2>About {first}</h2><p className="muted">{a.bio}{a.city ? ` Based in ${a.city}.` : ''} Every purchase supports {first}’s studio directly — {ARTIST_PCT}% of every tee, for as long as it sells.</p></div>
        ) : tab === 'Live now' ? (
          theirFinalists.length
            ? <div className="grid4">{theirFinalists.map((f) => <FinalistCard key={f.id} s={f} leader={board[0].live} />)}</div>
            : <Empty title={`${first} isn’t in this week’s battle.`} body="Follow to hear when their next design goes live."><Btn v="outline" href="/battle">See this week’s finalists</Btn></Empty>
        ) : own.length ? (
          <div className="grid4">{own.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <Empty title="No printed winners yet." body={`${first}’s first win could be one vote away.`}><Btn v="outline" href="/battle">Vote in the battle</Btn></Empty>
        )}
      </div>
    </div>
  );
}
