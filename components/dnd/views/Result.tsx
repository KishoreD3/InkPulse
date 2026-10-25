'use client';
import { useState } from 'react';
import { BACK, BATTLE, finalistGallery, inr, num, productById, img } from '@/lib/dnd/catalog';
import { DAY, dayRange, standings, votingClosesAt } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { Btn, Countdown, Empty, Icon, Photo } from '../ui';

export function ResultView({ id }: { id: string }) {
  const { state, hydrated } = useStore();
  const now = useNow(1000);
  const [preview, setPreview] = useState<boolean | null>(null);
  if (!hydrated) return <div className="result"><div className="skeleton" /></div>;
  const order = state.orders.find((o) => o.id === id);
  const line = order?.lines.find((l) => l.kind === 'back');
  if (!order || !line) return <div className="page-width"><Empty title="No backing on this order." body="Backing results show up here after Thursday’s lock."><Btn v="dark" href="/battle">Enter the battle</Btn></Empty></div>;

  const closes = line.closesAt ?? votingClosesAt(order.createdAt);
  const t = now ?? order.createdAt;
  const final = Boolean(line.outcome) || t >= closes;
  const board = standings(final ? closes - 1 : now, state.votes, [line.id]);
  const me = board.find((s) => s.id === line.id);
  const rank = line.outcome ? (line.outcome === 'won' ? 2 : 4) : me?.rank ?? 4;
  const projected = rank <= BATTLE.winners;
  const won = final ? (line.outcome ? line.outcome === 'won' : projected) : preview ?? projected;
  const photo = productById(line.id) ? img.product(line.id, 2) : finalistGallery(line.id)[1] ?? line.image;
  const votes = me?.live ?? 0;
  const short = me && !projected ? board[2].live - me.live + 1 : 0;

  return (
    <div className={`result ${won ? 'won' : 'lost'}`}>
      {!final && (
        <>
          <p className="muted result-note">Voting closes Thursday 9 PM · <b><Countdown /></b> to go. Preview both outcomes:</p>
          <div className="seg-toggle" role="tablist">
            <button role="tab" aria-selected={won} className={won ? 'on' : ''} onClick={() => setPreview(true)}>It printed</button>
            <button role="tab" aria-selected={!won} className={!won ? 'on' : ''} onClick={() => setPreview(false)}>Didn’t make top 3</button>
          </div>
        </>
      )}
      <div className="result-card">
        <p className="eyebrow">{won ? `BACKING UPDATE · DROP 0${line.drop ?? BATTLE.drop}` : `HOLD RELEASED · DROP 0${line.drop ?? BATTLE.drop}`}</p>
        <h1>{won ? 'It’s printing!' : 'So close.'}</h1>
        <Photo src={photo} alt={line.name} className="result-photo" />
        <h2>{line.name}</h2>
        <p>
          {won
            ? `${final ? 'Your pick finished' : 'If voting ended now, your pick finishes'} #${Math.min(rank, 3)}${votes ? ` with ${num(votes)} votes` : ''}. Your ${inr(BACK)} hold ${final ? 'is now charged' : 'gets charged'} and your tee heads to the press.`
            : `${line.name} ${final ? 'finished' : 'would finish'} #${Math.max(rank, 4)}${short ? ` — just ${num(short)} votes short` : ''}. Your ${inr(BACK)} hold ${final ? 'has been' : 'gets'} released. Nothing is charged.`}
        </p>
        {won
          ? <div className="ship"><Icon name="truck" /><span><b>Ships {dayRange(closes + DAY, 3, 7)}</b><small>Tracking arrives the moment it moves.</small></span></div>
          : <div className="pass"><p className="eyebrow">YOUR 48-HOUR BACKER PASS</p><b><Countdown to={closes + 2 * DAY} /></b><p>Buy any new winner at your backer price of {inr(BACK)}.</p><Btn v="yellow" href="/shop?collection=new">Use my {inr(BACK)} pass</Btn></div>}
        <Btn v="outline" href={`/orders/${order.id}`}>Back to order</Btn>
      </div>
    </div>
  );
}
