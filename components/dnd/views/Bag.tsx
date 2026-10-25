'use client';
import Link from 'next/link';
import { useState } from 'react';
import { COLOURS, SIZES, colourOf, inr } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { useStore, type BagLine } from '@/lib/dnd/store';
import { Btn, Empty, Icon, Photo } from '../ui';
import { sizesFor } from './Shop';

export function BagItem({ l, editable = true }: { l: BagLine; editable?: boolean }) {
  const { setQty, removeLine, update, state, lineInfo } = useStore();
  const { prices, productById, finalistById } = useCatalog();
  const info = lineInfo(l);
  const p = l.kind === 'buy' ? productById(l.id) : undefined;
  const f = l.kind === 'back' ? finalistById(l.id) : undefined;
  const sizes = p ? sizesFor(p) : [...SIZES];
  const colours = COLOURS.filter((c) => (p ?? f)?.colours.includes(c.key) ?? true);
  const href = `/design/${l.id}`;
  // Changing size or colour rewrites the line key; merge with an identical line if one exists.
  const change = (patch: Partial<BagLine>) => {
    const next = { ...l, ...patch };
    const key = `${next.kind}:${next.id}:${next.size}:${next.colour}`;
    const twin = state.bag.find((b) => b.key === key && b.key !== l.key);
    update({
      bag: twin
        ? state.bag.filter((b) => b.key !== l.key).map((b) => (b.key === key ? { ...b, qty: Math.min(5, b.qty + l.qty) } : b))
        : state.bag.map((b) => (b.key === l.key ? { ...next, key } : b)),
    });
  };
  return (
    <div className="bag-item">
      <Link href={href}><Photo src={info.image} alt={info.name} className="bi-photo" /></Link>
      <div>
        {l.kind === 'back' && <span className="sticker red">BACKING · LIVE</span>}
        <h3><Link href={href}>{info.name}</Link></h3>
        {editable ? (
          <div className="bi-opts">
            <select aria-label="Colour" value={l.colour} onChange={(e) => change({ colour: e.target.value as BagLine['colour'] })}>{colours.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
            <select aria-label="Size" value={l.size} onChange={(e) => change({ size: e.target.value })}>{sizes.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
        ) : <p>{colourOf(l.colour).name} · {l.size}{l.qty > 1 ? ` · ×${l.qty}` : ''}</p>}
        {editable && (
          <div className="bi-actions">
            {l.kind === 'buy' ? (
              <div className="qty">
                <button aria-label="Decrease quantity" disabled={l.qty <= 1} onClick={() => setQty(l.key, l.qty - 1)}>−</button><b aria-live="polite">{l.qty}</b>
                <button aria-label="Increase quantity" disabled={l.qty >= 5} onClick={() => setQty(l.key, l.qty + 1)}>+</button>
              </div>
            ) : <span className="muted small">One backing per design</span>}
            <button className="link small" onClick={() => removeLine(l.key)}>Remove</button>
          </div>
        )}
      </div>
      <strong>{l.kind === 'back' ? `${inr(prices.back)} hold` : inr(info.unit * l.qty)}</strong>
    </div>
  );
}

export function BagView() {
  const { state, hydrated, applyCoupon, clearCoupon, setUseReward, quote } = useStore();
  const { prices } = useCatalog();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const q = quote();
  const backs = state.bag.filter((l) => l.kind === 'back');
  const buys = state.bag.filter((l) => l.kind === 'buy');

  if (!hydrated) return <div className="page-width bag"><h1>Your bag</h1><div className="skeleton" /></div>;
  if (!state.bag.length) {
    return (
      <div className="page-width bag">
        <h1>Your bag <span>(0)</span></h1>
        <Empty emoji="😴" title="Your bag is on snooze." body={`Back a live design for ${inr(prices.back)}, or pick up a winner that’s already printed.`}>
          <div className="row"><Btn v="dark" href="/battle">Enter the battle</Btn><Btn v="outline" href="/shop">Shop winners</Btn></div>
        </Empty>
      </div>
    );
  }
  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const r = await applyCoupon(code);
    setBusy(false);
    setErr(r ?? '');
    if (!r) setCode('');
  };
  return (
    <div className="page-width bag">
      <h1>Your bag <span>({q.items})</span></h1>
      <div className="bag-grid">
        <div>
          {backs.length > 0 && (
            <section className="bag-group hold">
              <div className="bg-head"><Icon name="moon" /><div><b>Backing holds</b><small>Snoozed until Thursday · charged only if it prints</small></div><em>₹0 today</em></div>
              {backs.map((l) => <BagItem key={l.key} l={l} />)}
            </section>
          )}
          {buys.length > 0 && (
            <section className="bag-group">
              <div className="bg-head"><Icon name="bag" /><div><b>Ready to ship</b><small>Printed to order · ships in 5–7 days</small></div></div>
              {buys.map((l) => <BagItem key={l.key} l={l} />)}
            </section>
          )}
          <div className="upsell">
            <span>🌙</span>
            <p>{q.giftWrap ? <><b>Free gift wrap unlocked.</b> Because some tees deserve a ceremony.</> : <><b>Add one more, get free gift wrap.</b> Because some tees deserve a ceremony.</>}</p>
            <Link className="link" href="/shop">Keep shopping →</Link>
          </div>
        </div>
        <aside className="summary">
          <h2>Price details</h2>
          <p><span>Merchandise</span><b>{inr(q.merch)}</b></p>
          <p><span>Shipping</span><b className="green">FREE</b></p>
          {q.giftWrap && <p><span>Gift wrap</span><b className="green">FREE</b></p>}
          {q.discount > 0 && <p><span>{state.coupon} · {q.couponLabel}</span><b className="green">− {inr(q.discount)}</b></p>}
          {q.reward > 0 && <p><span>Club reward</span><b className="green">− {inr(q.reward)}</b></p>}
          {state.coupon ? (
            <div className="coupon applied"><span>✓ {state.coupon} applied</span><button onClick={clearCoupon}>Remove</button></div>
          ) : (
            <form className="coupon" onSubmit={apply}><input value={code} onChange={(e) => { setCode(e.target.value); setErr(''); }} placeholder="Coupon code (try SNOOZE10)" aria-label="Coupon code" /><button type="submit" disabled={busy}>{busy ? '…' : 'Apply'}</button></form>
          )}
          {err && <p className="field-error" role="alert">{err}</p>}
          <label className={`toggle-row ${state.points < 100 || q.merch === 0 ? 'disabled' : ''}`}>
            <span><b>Use ₹100 club reward</b><small>{q.merch === 0 ? 'Applies to tees you buy now' : `Balance: ${state.points} points`}</small></span>
            <input type="checkbox" checked={state.useReward && q.reward > 0} disabled={state.points < 100 || q.merch === 0} onChange={(e) => setUseReward(e.target.checked)} /><i />
          </label>
          <hr />
          <p className="total"><span>Pay today</span><b>{inr(q.payNow)}</b></p>
          {q.holds > 0 && <p className="muted"><span>Hold (not charged now)</span><b>{inr(q.holds)}</b></p>}
          <Btn v="dark" href="/checkout">Checkout securely <Icon name="arrow" /></Btn>
          <small className="secure"><Icon name="shield" size={14} /> Secure UPI & card payments · No COD</small>
        </aside>
      </div>
    </div>
  );
}
