'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inr, num } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dateTime } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { BackBtn, FinalistCard, VoteBtn } from '../cards';
import { Btn, Countdown, Empty, Icon, Photo } from '../ui';

export function BattleView() {
  const { state, board: rank, toggleReminder } = useStore();
  const { battle, prices, mode } = useCatalog();
  const router = useRouter();
  const now = useNow(15_000);
  const backing = state.bag.filter((b) => b.kind === 'back').map((b) => b.id);
  const placed = state.orders.flatMap((o) => o.lines.filter((l) => l.kind === 'back' && !l.outcome && (!l.status || l.status === 'backed')).map((l) => l.id));
  const myBacks = new Set([...backing, ...placed]);
  const board = rank(now);
  const n = battle.winners;

  if (!board.length) {
    const reminded = state.reminders.includes('next-topic');
    return (
      <div className="page-width">
        <Empty
          title={battle.drop ? `Drop ${String(battle.drop).padStart(3, '0')} · ${battle.topic}` : 'No battle on right now.'}
          body={battle.drop && battle.opensAt > Date.now() ? `Voting opens ${dateTime(battle.opensAt)}. Finalists are announced when it does.` : 'The next battle opens Monday at 10 AM. Shop past winners meanwhile.'}
        >
          <div className="row">
            <Btn v="dark" onClick={() => toggleReminder('next-topic')}>{reminded ? 'Reminder set ✓' : 'Remind me'}</Btn>
            <Btn v="outline" href="/shop">Shop winners</Btn>
          </div>
        </Empty>
      </div>
    );
  }

  const leader = board[0].live;
  const total = board.reduce((x, f) => x + f.live, 0);
  const gap = board.length > n ? board[n - 1].live - board[n].live : 0;

  return (
    <div>
      <section className="battle-banner">
        <div className="page-width bb-grid">
          <div>
            <span className="door-sign">🚪 DO NOT DISTURB · VOTING IN PROGRESS</span>
            <h1>{battle.topic.split(' ').map((w, i) => <span key={i}>{i ? <br /> : null}{w}</span>)}</h1>
            <p>{battle.brief} Top {n} by votes print this Friday. No minimum, no unlock.</p>
          </div>
          <div className="count-card"><small>VOTING ENDS THU · 9 PM</small><b><Countdown /></b><em>hrs · min · sec</em><p>{mode === 'demo' ? `${num(total / 2.6)} people voting` : `${num(total)} votes so far`}</p></div>
        </div>
      </section>
      <div className="page-width">
        <div className="timeline">{['Topic revealed', 'Submissions', 'Curator review', 'Vote & back · NOW', 'Print · Fri', 'Ships'].map((x, i) => <div key={x} className={i < 3 ? 'done' : i === 3 ? 'now' : ''}><i>{i < 3 ? '✓' : i + 1}</i><span>{x}</span></div>)}</div>
        <section className="print-zone">
          <div className="pz-head"><div><p className="eyebrow">PRINT ZONE</p><h2>These {n} print if voting ended now</h2></div><p className="live-note"><i className="live-dot" /> Updates live</p></div>
          <div className="pz-grid">
            {board.slice(0, n).map((f) => <FinalistCard key={f.id} s={f} leader={leader} />)}
            <article className="activity">
              <p className="eyebrow">YOUR ACTIVITY</p><h3>You’re shaping<br />this drop.</h3>
              <div><b>{state.votes.length}</b><small>votes cast</small></div>
              <div><b>{myBacks.size}</b><small>design{myBacks.size === 1 ? '' : 's'} backed</small></div>
              <div><b>{inr(myBacks.size * prices.back)}</b><small>hold · not charged</small></div>
              <p className="fine">Not top {n}? Your hold is released the same night, plus a 48-hour Backer Pass.</p>
            </article>
          </div>
        </section>
        {board.length > n && <div className="print-line"><span><Icon name="scissors" size={14} /> PRINT LINE</span><p>#{n} leads #{n + 1} by <b>{num(gap)} votes</b></p></div>}
        <section className="rank-list">
          {board.slice(n).map((f) => (
            <article key={f.id} onClick={() => router.push(`/design/${f.id}`)}>
              <b className="r">#{f.rank}</b><Photo src={f.card} tint={f.image} alt={f.name} className="thumb" />
              <div className="who"><h3><Link href={`/design/${f.id}`} onClick={(e) => e.stopPropagation()}>{f.name}</Link></h3><p>{f.artist}{f.city ? ` · ${f.city}` : ''}</p></div>
              <div className="meter wide"><i style={{ width: `${Math.round((f.live / Math.max(1, leader * 1.05)) * 100)}%` }} /></div>
              <strong>{num(f.live)} votes</strong><span className="muted">{num(f.backersLive)} backers</span>
              <VoteBtn id={f.id} votes={f.live} compact /><BackBtn id={f.id} />
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
