'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { inr, num } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dateTime } from '@/lib/dnd/cycle';
import { useNow, useStore, type LineStatus, type Order, type OrderLine } from '@/lib/dnd/store';
import { Btn, Empty, Icon, Photo } from '../ui';
import { AfterSales } from './AfterSales';

export function Track({ title, status, s, href }: { title: string; status: string; s: LineStatus; href?: string }) {
  return (
    <article className="track">
      <div><h3>{href ? <Link href={href}>{title}</Link> : title}</h3><span>{status}</span></div>
      <div className="track-line" style={{ gridTemplateColumns: `repeat(${s.steps.length}, 1fr)` }}>
        {s.steps.map((x, i) => <div key={x} className={i <= s.step ? 'on' : ''}><i /><span>{x}</span></div>)}
      </div>
    </article>
  );
}

export function useShare() {
  const { toast, session, mode } = useStore();
  return async (text: string, path: string, via: 'native' | 'whatsapp' | 'copy') => {
    // Members share with their invite code, so a friend's first order earns them a reward.
    const url = `${window.location.origin}${path}${session ? `${path.includes('?') ? '&' : '?'}ref=${session.handle}` : ''}`;
    if (via === 'whatsapp') { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener'); return; }
    if (via === 'native' && navigator.share) {
      try { await navigator.share({ title: 'The DND Club', text, url }); return; } catch { /* cancelled */ return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied', mode === 'demo' ? 'Share it anywhere. Friends who vote earn you 50 points.' : 'Share it anywhere. A friend’s first order gets you ₹100 off.'); } catch { toast('Copy this link', url); }
  };
}

export function OrderView({ id }: { id: string }) {
  const { state, hydrated, board: rank, lineStatus, mode } = useStore();
  const { battle } = useCatalog();
  const params = useSearchParams();
  const now = useNow(30_000);
  const share = useShare();
  if (!hydrated) return <div className="page-width confirmed"><div className="skeleton" /></div>;
  const order = state.orders.find((o) => o.id === id || o.lines.some((l) => l.orderUuid === id));
  if (!order) {
    return <div className="page-width confirmed"><Empty title="We can’t find that order." body={mode === 'live' ? 'Sign in with the account you ordered from to see it.' : 'Orders placed on this device show up in your account.'}><Btn v="dark" href="/account?tab=orders">Your orders</Btn></Empty></div>;
  }
  const placed = params.get('placed') === '1';
  const t = now ?? order.createdAt;
  const buys = order.lines.filter((l) => l.kind === 'buy');
  const backs = order.lines.filter((l) => l.kind === 'back');
  const firstBack = backs[0];
  const board = rank(now);
  const me = firstBack ? board.find((s) => s.id === firstBack.id) : undefined;
  const behind = me ? (me.rank === 1 ? 0 : board[0].live - me.live) : 0;
  const what = [buys.length ? `${buys.reduce((n, l) => n + l.qty, 0)} tee${buys.length > 1 || buys[0].qty > 1 ? 's' : ''} paid` : '', backs.length ? `${backs.length} design${backs.length > 1 ? 's' : ''} backed` : ''].filter(Boolean).join(', ');

  return (
    <div className="page-width confirmed">
      <div className="ok"><Icon name="check" size={32} /></div>
      <p className="eyebrow">ORDER {order.id} · {placed ? 'CONFIRMED' : dateTime(order.createdAt).toUpperCase()}</p>
      <h1>{placed ? 'You’re in the club.' : 'Order details'}</h1>
      <p className="muted">{what[0].toUpperCase() + what.slice(1)}. Confirmation sent to {order.contact.email}{order.points ? ` · +${order.points} club points` : ''}</p>
      <div className="track-grid">
        {buys.map((l) => <Track key={l.key} title={`${l.name}${l.qty > 1 ? ` ×${l.qty}` : ''}`} href={`/design/${l.id}`} status={`Paid · ${l.size}`} s={lineStatus(l, order.createdAt, t)} />)}
        {backs.map((l) => <Track key={l.key} title={l.name} href={`/design/${l.id}`} status={`${inr(l.unit)} hold · ${lineStatus(l, order.createdAt, t).label}`} s={lineStatus(l, order.createdAt, t)} />)}
      </div>
      <AfterSales order={order} delivered={order.lines.filter((l) => ['Delivered', 'Printed & delivered'].includes(lineStatus(l, order.createdAt, t).label))} />
      <OrderSummary order={order} />
      {firstBack && me && !firstBack.outcome && (
        <div className="share-card">
          <div className="hanger mini"><span className="hole" /><b>PLEASE</b><strong>DO NOT DISTURB</strong><small>I backed {firstBack.name}</small></div>
          <div>
            <h2>{me.rank <= battle.winners ? 'Keep it in the print zone.' : 'Push it over the line.'}</h2>
            <p>{firstBack.name} is #{me.rank}{behind ? `, ${num(behind)} votes behind #1` : ' and leading'}.{mode === 'demo' ? ' Every friend who votes through your link earns you 50 club points.' : ' Friends who join through your link and order get you ₹100 off.'}</p>
            <div className="row">
              <Btn v="dark" onClick={() => share(`I backed ${firstBack.name} on The DND Club. Vote before Thursday 9 PM!`, `/design/${firstBack.id}`, 'native')}><Icon name="share" /> Share</Btn>
              <Btn v="outline" onClick={() => share(`I backed ${firstBack.name} on The DND Club. Vote before Thursday 9 PM!`, `/design/${firstBack.id}`, 'whatsapp')}>WhatsApp</Btn>
              <Btn v="outline" onClick={() => share('', `/design/${firstBack.id}`, 'copy')}>Copy link</Btn>
            </div>
          </div>
        </div>
      )}
      <div className="row center-row">
        {backs.length > 0 && <Btn v="yellow" href={`/result/${order.id}`}>Backing result</Btn>}
        <Btn v="outline" href="/account?tab=orders">All orders</Btn>
        <Btn v="ghost" href="/shop">Keep shopping</Btn>
      </div>
    </div>
  );
}

function OrderSummary({ order }: { order: Order }) {
  return (
    <section className="order-summary">
      <div>
        <p className="eyebrow">DELIVER TO</p>
        <p><b>{order.address.name}</b><br />{[order.address.line1, order.address.line2].filter(Boolean).join(', ')}<br />{order.address.city}, {order.address.state} {order.address.pin}</p>
      </div>
      <div>
        <p className="eyebrow">PAYMENT</p>
        <p>{order.payment}</p>
        {order.coupon && <p className="muted">Code {order.coupon}</p>}
      </div>
      <div className="os-lines">
        {order.lines.map((l: OrderLine) => (
          <p key={l.key}><Photo src={l.image} alt="" className="os-photo" /><span>{l.name} · {l.size}{l.qty > 1 ? ` ×${l.qty}` : ''}</span><b>{l.kind === 'back' ? `${inr(l.unit)} hold` : inr(l.unit * l.qty)}</b></p>
        ))}
        {order.discount > 0 && <p><span>Discount</span><b className="green">− {inr(order.discount)}</b></p>}
        {order.reward > 0 && <p><span>Club reward</span><b className="green">− {inr(order.reward)}</b></p>}
        <p className="total"><span>Paid</span><b>{inr(order.payNow)}</b></p>
      </div>
    </section>
  );
}
