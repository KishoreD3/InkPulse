'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BACK, BATTLE, img, inr, num } from '@/lib/dnd/catalog';
import { standings } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { BackBtn, FinalistCard, VoteBtn } from '../cards';
import { Countdown, Icon, Photo } from '../ui';

export function BattleView() {
  const { state } = useStore();
  const router = useRouter();
  const now = useNow(15_000);
  const backing = state.bag.filter((b) => b.kind === 'back').map((b) => b.id);
  const placed = state.orders.flatMap((o) => o.lines.filter((l) => l.kind === 'back' && !l.outcome).map((l) => l.id));
  const myBacks = new Set([...backing, ...placed]);
  const board = standings(now, state.votes, [...myBacks]);
  const leader = board[0].live;
  const total = board.reduce((n, f) => n + f.live, 0);
  const gap = board[2].live - board[3].live;

  return (
    <div>
      <section className="battle-banner">
        <div className="page-width bb-grid">
          <div>
            <span className="door-sign">🚪 DO NOT DISTURB · VOTING IN PROGRESS</span>
            <h1>Monsoon<br />Mood</h1>
            <p>{BATTLE.brief} Top 3 by votes print this Friday. No minimum, no unlock.</p>
          </div>
          <div className="count-card"><small>VOTING ENDS THU · 9 PM</small><b><Countdown /></b><em>hrs · min · sec</em><p>{num(total / 2.6)} people voting</p></div>
        </div>
      </section>
      <div className="page-width">
        <div className="timeline">{['Topic revealed', 'Submissions', 'Curator review', 'Vote & back · NOW', 'Print · Fri', 'Ships'].map((x, i) => <div key={x} className={i < 3 ? 'done' : i === 3 ? 'now' : ''}><i>{i < 3 ? '✓' : i + 1}</i><span>{x}</span></div>)}</div>
        <section className="print-zone">
          <div className="pz-head"><div><p className="eyebrow">PRINT ZONE</p><h2>These 3 print if voting ended now</h2></div><p className="live-note"><i className="live-dot" /> Updates live</p></div>
          <div className="pz-grid">
            {board.slice(0, 3).map((f) => <FinalistCard key={f.id} s={f} leader={leader} />)}
            <article className="activity">
              <p className="eyebrow">YOUR ACTIVITY</p><h3>You’re shaping<br />this drop.</h3>
              <div><b>{state.votes.length}</b><small>votes cast</small></div>
              <div><b>{myBacks.size}</b><small>design{myBacks.size === 1 ? '' : 's'} backed</small></div>
              <div><b>{inr(myBacks.size * BACK)}</b><small>hold · not charged</small></div>
              <p className="fine">Not top 3? Your hold is released the same night, plus a 48-hour Backer Pass.</p>
            </article>
          </div>
        </section>
        <div className="print-line"><span><Icon name="scissors" size={14} /> PRINT LINE</span><p>#3 leads #4 by <b>{num(gap)} votes</b></p></div>
        <section className="rank-list">
          {board.slice(3).map((f) => (
            <article key={f.id} onClick={() => router.push(`/design/${f.id}`)}>
              <b className="r">#{f.rank}</b><Photo src={img.finalist(f.id)} tint={f.image} alt={f.name} className="thumb" />
              <div className="who"><h3><Link href={`/design/${f.id}`} onClick={(e) => e.stopPropagation()}>{f.name}</Link></h3><p>{f.artist} · {f.city}</p></div>
              <div className="meter wide"><i style={{ width: `${Math.round((f.live / (leader * 1.05)) * 100)}%` }} /></div>
              <strong>{num(f.live)} votes</strong><span className="muted">{num(f.backersLive)} backers</span>
              <VoteBtn id={f.id} votes={f.live} compact /><BackBtn id={f.id} />
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
