'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inr, num, off, type Artist, type Product } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import type { Standing } from '@/lib/dnd/cycle';
import { useStore } from '@/lib/dnd/store';
import { CareTag, Icon, Photo, type IconName } from './ui';

export function ProductCard({ p, tilt = 0 }: { p: Product; tilt?: number }) {
  const { state, toggleWish, addToBag } = useStore();
  const { prices } = useCatalog();
  const router = useRouter();
  const liked = state.wishlist.includes(p.id);
  const href = `/design/${p.id}`;
  return (
    <article className="product-card">
      <div className="pc-image" onClick={() => router.push(href)}>
        <Photo src={p.photos[0]} tint={p.image} alt={`${p.name} graphic t-shirt`} />
        <Photo src={p.photos[1] ?? p.photos[0]} tint={p.image} alt="" className="alt" />
        <span className="sticker">{p.badge}</span>
        <button className={`heart ${liked ? 'on' : ''}`} aria-label={liked ? `Remove ${p.name} from wishlist` : `Save ${p.name}`} aria-pressed={liked} onClick={(e) => { e.stopPropagation(); toggleWish(p.id); }}><Icon name="heart" size={17} /></button>
        <div className="quick" onClick={(e) => e.stopPropagation()}>
          <span>QUICK ADD</span>
          <div>{['S', 'M', 'L', 'XL'].map((s) => <button key={s} aria-label={`Add ${p.name} in ${s}`} onClick={() => addToBag({ kind: 'buy', id: p.id, size: s, colour: p.colours[0] })}>{s}</button>)}</div>
        </div>
      </div>
      <Link href={href} className="pc-copy">
        <div className="pc-row"><h3>{p.name}</h3>{p.reviews > 0 && <span className="rating"><Icon name="star" size={11} /> {p.rating}</span>}</div>
        <p>by {p.artist}{p.city ? ` · ${p.city}` : ''}</p>
        <div className="price"><strong>{inr(prices.retail)}</strong> <s>{inr(prices.mrp)}</s> <span>{off(prices.retail, prices.mrp)}% OFF</span></div>
      </Link>
      {tilt !== 0 && <CareTag text={p.care} tilt={tilt} />}
    </article>
  );
}

export function VoteBtn({ id, votes, compact = false }: { id: string; votes: number; compact?: boolean }) {
  const { state, toggleVote } = useStore();
  const on = state.votes.includes(id);
  return (
    <button className={`vote ${on ? 'on' : ''} ${compact ? 'compact' : ''}`} aria-pressed={on} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleVote(id); }}>
      {on ? <><Icon name="check" size={14} /> Voted · {num(votes)}</> : <>Vote · {num(votes)}</>}
    </button>
  );
}

export function BackBtn({ id, label }: { id: string; label?: string }) {
  const { state, addToBag } = useStore();
  const { prices, finalistById } = useCatalog();
  const colour = finalistById(id)?.colours[0] ?? 'black';
  const backed = state.bag.some((b) => b.kind === 'back' && b.id === id);
  return (
    <button className="back" onClick={(e) => { e.preventDefault(); e.stopPropagation(); addToBag({ kind: 'back', id, size: 'M', colour }); }}>
      {backed ? '✓ Backed' : label ?? `Back ${inr(prices.back)}`}
    </button>
  );
}

export function FinalistCard({ s, leader, dark = false }: { s: Standing; leader: number; dark?: boolean }) {
  const router = useRouter();
  const { battle } = useCatalog();
  return (
    <article className={`finalist ${dark ? 'dark' : ''}`} onClick={() => router.push(`/design/${s.id}`)}>
      <div className="fi-image"><Photo src={s.card} tint={s.image} alt={s.name} /><span className="rank">#{s.rank}</span>{s.rank <= battle.winners && <span className="sticker red zone">PRINT ZONE</span>}</div>
      <div className="fi-body">
        <h3><Link href={`/design/${s.id}`} onClick={(e) => e.stopPropagation()}>{s.name}</Link></h3><p>{s.artist}{s.city ? ` · ${s.city}` : ''}</p>
        <div className="meter"><i style={{ width: `${leader > 0 ? Math.round((s.live / (leader * 1.05)) * 100) : 0}%` }} /></div>
        <div className="fi-meta"><b>{num(s.live)} votes</b><span>{num(s.backersLive)} backers</span></div>
        <div className="fi-actions"><VoteBtn id={s.id} votes={s.live} compact /><BackBtn id={s.id} /></div>
      </div>
    </article>
  );
}

export function ArtistCard({ a }: { a: Artist }) {
  const { state, toggleFollow, mode } = useStore();
  const f = state.follows.includes(a.slug);
  const initials = a.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <article className="artist-card">
      <Photo src={a.cover} tint={a.image} alt="" className="cover" />
      <div className="ac-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <span className="avatar">{a.photo ? <img src={a.photo} alt="" /> : <b className="initials">{initials}</b>}</span>
        <h3><Link href={`/artists/${a.slug}`}>{a.name}</Link></h3><p>{a.city || 'India'}</p>
        <div className="ac-stats"><span><b>{a.wins}</b> wins</span><span><b>{a.finalists}</b> finalists</span><span><b>{fans(a.followers + (f && mode === 'demo' ? 1 : 0))}</b> fans</span></div>
        <button className={`follow ${f ? 'on' : ''}`} aria-pressed={f} onClick={() => toggleFollow(a.slug)}>{f ? '✓ Following' : 'Follow'}</button>
      </div>
    </article>
  );
}

export const fans = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/** Link to an artist's profile when they have one in the directory. */
export function ArtistLink({ name, className = '' }: { name: string; className?: string }) {
  const a = useCatalog().artistByName(name);
  return a ? <Link className={className} href={`/artists/${a.slug}`}>{name}</Link> : <span className={className}>{name}</span>;
}

export function Trust() {
  const { prices } = useCatalog();
  return (
    <section className="page-width trust">
      {([['zap', 'Printed to order'], ['shield', '7-day size exchange'], ['truck', 'Free shipping'], ['card', 'UPI & cards'], ['heart', `${prices.artistPct}% to artists`]] as [IconName, string][]).map(([i, t]) => (
        <div key={t}><Icon name={i} /><span>{t}</span></div>
      ))}
    </section>
  );
}
