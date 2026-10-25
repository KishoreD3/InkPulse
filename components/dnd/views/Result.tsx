'use client';
import { useState } from 'react';
import { inr, num } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { DAY, dayRange, standings, votingClosesAt } from '@/lib/dnd/cycle';
import { useNow, useStore } from '@/lib/dnd/store';
import { Btn, Countdown, Empty, Icon, Photo } from '../ui';

export function ResultView({ id }: { id: string }) {
  const { state, hydrated, toast } = useStore();
  const cat = useCatalog();
  const { battle, prices, productById, finalistById } = cat;
  const now = useNow(1000);
  const [preview, setPreview] = useState<boolean | null>(null);
  if (!hydrated) return <div className="result"><div className="skeleton" /></div>;
  const order = state.orders.find((o) => o.id === id);
  const line = order?.lines.find((l) => l.kind === 'back');
  if (!order || !line) return <div className="page-width"><Empty title="No backing on this order." body="Backing results show up here after Thursday’s lock."><Btn v="dark" href="/battle">Enter the battle</Btn></Empty></div>;

  const closes = line.closesAt ?? votingClosesAt(order.createdAt);
  const t = now ?? order.createdAt;
  const settled = line.status === 'released' ? 'lost' : line.status && !['backed', 'pending'].includes(line.status) ? 'won' : line.outcome;
  const final = Boolean(settled) || (cat.mode === 'demo' && t >= closes);
  const board = standings(cat, final ? closes - 1 : now, state.votes, [line.id], state.counted);
  const me = board.find((s) => s.id === line.id);
  const N = battle.winners;
  const rank = settled ? (settled === 'won' ? Math.min(2, N) : N + 1) : me?.rank ?? N + 1;
  const projected = rank <= N;
  const won = final ? (settled ? settled === 'won' : projected) : preview ?? projected;
  const photo = productById(line.id)?.photos[1] ?? finalistById(line.id)?.photos[1] ?? line.image;
  const votes = me?.live ?? 0;
  const short = me && !projected && board[N - 1] ? board[N - 1].live - me.live + 1 : 0;
  const pass = state.passes[0];
  const BACK = line.unit;
  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast('Code copied', `Use ${code} at checkout.`); } catch { toast('Your code', code); }
  };

  return (
    <div className={`result ${won ? 'won' : 'lost'}`}>
      {!final && (
        <>
          <p className="muted result-note">Voting closes Thursday 9 PM · <b><Countdown /></b> to go. Preview both outcomes:</p>
          <div className="seg-toggle" role="tablist">
            <button role="tab" aria-selected={won} className={won ? 'on' : ''} onClick={() => setPreview(true)}>It printed</button>
            <button role="tab" aria-selected={!won} className={!won ? 'on' : ''} onClick={() => setPreview(false)}>Didn’t make top {N}</button>
          </div>
        </>
      )}
      <div className="result-card">
        <p className="eyebrow">{won ? `BACKING UPDATE · DROP ${String(line.drop ?? battle.drop).padStart(3, '0')}` : `HOLD RELEASED · DROP ${String(line.drop ?? battle.drop).padStart(3, '0')}`}</p>
        <h1>{won ? 'It’s printing!' : 'So close.'}</h1>
        <Photo src={photo} alt={line.name} className="result-photo" />
        <h2>{line.name}</h2>
        <p>
          {won
            ? `${final ? 'Your pick finished' : 'If voting ended now, your pick finishes'} #${Math.min(rank, N)}${votes ? ` with ${num(votes)} votes` : ''}. Your ${inr(BACK)} hold ${final ? 'is now charged' : 'gets charged'} and your tee heads to the press.`
            : `${line.name} ${final ? 'finished' : 'would finish'} #${Math.max(rank, N + 1)}${short ? ` — just ${num(short)} votes short` : ''}. Your ${inr(BACK)} hold ${final ? 'has been' : 'gets'} released. Nothing is charged.`}
        </p>
        {won
          ? <div className="ship"><Icon name="truck" /><span><b>Ships {dayRange(closes + DAY, 3, 7)}</b><small>Tracking arrives the moment it moves.</small></span></div>
          : cat.mode === 'live' && final && !pass
            ? <div className="pass"><p className="eyebrow">YOUR BACKER PASS</p><p>Your pass code has been used or has expired. New winners drop every Friday.</p><Btn v="yellow" href="/shop?collection=new">Shop new winners</Btn></div>
            : <div className="pass"><p className="eyebrow">YOUR 48-HOUR BACKER PASS</p><b><Countdown to={pass?.expiresAt ?? closes + 2 * DAY} /></b>
              <p>Buy any new winner at your backer price of {inr(pass ? prices.retail - pass.value : BACK)}.{pass ? <> Code <button className="link" onClick={() => copy(pass.code)}>{pass.code}</button>, applied at checkout.</> : ''}</p>
              <Btn v="yellow" href="/shop?collection=new">Use my {inr(pass ? prices.retail - pass.value : BACK)} pass</Btn></div>}
        <Btn v="outline" href={`/orders/${order.id}`}>Back to order</Btn>
      </div>
    </div>
  );
}
