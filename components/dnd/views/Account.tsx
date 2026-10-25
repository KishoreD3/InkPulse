'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BACK, BATTLE, inr, num, productById } from '@/lib/dnd/catalog';
import { dateTime, shortDate, standings } from '@/lib/dnd/cycle';
import { lineInfo, lineStatus, useNow, useStore, type Address, type Contact, type OrderLine } from '@/lib/dnd/store';
import { ProductCard, VoteBtn } from '../cards';
import { Btn, Empty, Icon, Photo } from '../ui';
import { Field, addressErrors, contactErrors } from './Checkout';
import { Track } from './Order';

const TABS = [
  ['overview', 'Overview'], ['backings', 'My backings'], ['orders', 'Orders & tracking'], ['votes', 'Votes'],
  ['wishlist', 'Wishlist'], ['rewards', 'Club rewards'], ['addresses', 'Addresses'], ['payments', 'Payments & AutoPay'],
] as const;
type Tab = (typeof TABS)[number][0];

export function AccountView() {
  const { state, hydrated } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get('tab');
  const tab: Tab = TABS.some(([k]) => k === raw) ? (raw as Tab) : 'overview';
  const go = (t: Tab) => router.replace(t === 'overview' ? path : `${path}?tab=${t}`, { scroll: false });
  const first = state.contact.name.split(' ')[0] || 'there';

  return (
    <div className="page-width account">
      <div className="hello"><p className="eyebrow">MEMBER #2841 · SINCE 2024</p><h1>Hey, {hydrated ? first : 'Riya'}. 🌙</h1><p className="muted">{state.points} club points · DND mode loyalist</p></div>
      <div className="account-grid">
        <aside aria-label="Account sections">
          {TABS.map(([k, label]) => <button key={k} aria-current={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{label}<Icon name="arrow" size={14} /></button>)}
          <hr />
          <Link className="aside-link" href="/dashboard">Artist dashboard<Icon name="arrow" size={14} /></Link>
        </aside>
        <div>
          <h2>{TABS.find(([k]) => k === tab)![1]}</h2>
          {!hydrated ? <div className="skeleton" /> : <Section tab={tab} go={go} />}
        </div>
      </div>
    </div>
  );
}

type BackRow = { line: OrderLine; orderId: string | null; createdAt: number };

function useBackings(): BackRow[] {
  const { state } = useStore();
  const inBag: BackRow[] = state.bag.filter((l) => l.kind === 'back').map((l) => {
    const info = lineInfo(l);
    return { line: { ...l, name: info.name, image: info.image, unit: BACK, drop: BATTLE.drop }, orderId: null, createdAt: Date.now() };
  });
  const placed = state.orders.flatMap((o) => o.lines.filter((l) => l.kind === 'back').map((line) => ({ line, orderId: o.id, createdAt: o.createdAt })));
  return [...inBag, ...placed];
}

function BackList() {
  const { state } = useStore();
  const now = useNow(30_000) ?? 0;
  const rows = useBackings();
  if (!rows.length) return <Empty title="No backings yet." body={`Back a live design for ${inr(BACK)}. Pay only if it prints.`}><Btn v="dark" href="/battle">Enter the battle</Btn></Empty>;
  return (
    <div className="backing-list">
      {rows.map(({ line, orderId, createdAt }) => {
        const s = orderId ? lineStatus(line, createdAt, now || createdAt, state.votes) : { label: 'In your bag · not placed', tone: 1 as const };
        const money = s.label === 'Hold released' ? 'Not charged' : s.tone === 2 ? `${inr(line.unit)} paid` : `${inr(line.unit)} hold`;
        const href = orderId ? `/result/${orderId}` : '/bag';
        return (
          <Link key={`${orderId}-${line.key}`} href={href} className="bl-row">
            <Photo src={line.image} alt="" className="bl-photo" />
            <div><h3>{line.name}</h3><span className={`status s${s.tone}`}>{s.label}</span><p>{money} · Drop 0{line.drop ?? BATTLE.drop}</p></div>
            <Icon name="arrow" />
          </Link>
        );
      })}
    </div>
  );
}

function Section({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const { state, update, toast, resetDemo, toggleVote } = useStore();
  const now = useNow(30_000);
  const t = now ?? 0;
  const backings = useBackings();
  const active = backings.filter((b) => !b.line.outcome && (!b.orderId || t < (b.line.closesAt ?? Infinity)));
  const board = standings(now, state.votes, active.map((a) => a.line.id));
  const latestOrder = state.orders[0];
  const latestBack = active[0];
  const lb = latestBack ? board.find((s) => s.id === latestBack.line.id) : undefined;

  if (tab === 'overview') {
    const printing = state.orders.filter((o) => o.lines.some((l) => l.kind === 'buy' && lineStatus(l, o.createdAt, t || o.createdAt, state.votes).step < 3)).length;
    return (
      <>
        <div className="acc-cards">
          {([
            ['ACTIVE BACKINGS', String(active.length), latestBack ? `${latestBack.line.name}${lb ? ` · #${lb.rank}` : ''}` : 'None this week', 'backings'],
            ['CLUB POINTS', String(state.points), `${inr(Math.floor(state.points / 100) * 100)} to spend`, 'rewards'],
            ['ORDERS', String(state.orders.length), printing ? `${printing} in progress` : 'All delivered', 'orders'],
            ['VOTES CAST', String(state.pastVotes + state.votes.length), `across ${state.pastBattles + (state.votes.length ? 1 : 0)} battles`, 'votes'],
          ] as [string, string, string, Tab][]).map(([a, b, c, k]) => <button key={a} onClick={() => go(k)}><span>{a}</span><b>{b}</b><p>{c}</p></button>)}
        </div>
        <div className="acc-two">
          {latestOrder ? (
            <Track title={latestOrder.lines[0].name} href={`/orders/${latestOrder.id}`} status={`Order ${latestOrder.id} · ${lineStatus(latestOrder.lines[0], latestOrder.createdAt, t || latestOrder.createdAt, state.votes).label}`} s={lineStatus(latestOrder.lines[0], latestOrder.createdAt, t || latestOrder.createdAt, state.votes)} />
          ) : <Empty title="No orders yet." />}
          <div className="latest">
            <p className="eyebrow">LATEST BACKING</p>
            {latestBack && lb ? (
              <><h3>{latestBack.line.name}</h3><p className="muted">#{lb.rank} · {lb.rank <= 3 ? 'safely in the print zone' : 'below the print line — rally some votes'}</p><VoteBtn id={lb.id} votes={lb.live} compact /></>
            ) : (
              <><h3>Nothing live.</h3><p className="muted">Back a {BATTLE.topic} finalist before Thursday.</p><Btn v="dark" href="/battle">Enter the battle</Btn></>
            )}
          </div>
        </div>
        <BackList />
      </>
    );
  }
  if (tab === 'backings') return <BackList />;
  if (tab === 'orders') {
    if (!state.orders.length) return <Empty title="No orders yet." body="Your orders and tracking live here."><Btn v="dark" href="/shop">Shop tees</Btn></Empty>;
    return (
      <div className="backing-list">
        {state.orders.map((o) => {
          const s = lineStatus(o.lines[0], o.createdAt, t || o.createdAt, state.votes);
          return (
            <Link key={o.id} href={`/orders/${o.id}`} className="bl-row">
              <Photo src={o.lines[0].image} alt="" className="bl-photo" />
              <div><h3>{o.id} · {o.lines.map((l) => l.name).join(', ')}</h3><span className={`status s${s.tone}`}>{s.label}</span><p>{shortDate(o.createdAt)} · {o.payNow ? `${inr(o.payNow)} paid` : 'Backing hold'}{o.holds && o.payNow ? ` + ${inr(o.holds)} hold` : ''}</p></div>
              <Icon name="arrow" />
            </Link>
          );
        })}
      </div>
    );
  }
  if (tab === 'votes') {
    const mine = board.filter((s) => state.votes.includes(s.id));
    return (
      <>
        <p className="muted tab-intro">{state.pastVotes} votes in {state.pastBattles} past battles. This week: {state.votes.length} of {board.length} finalists.</p>
        {mine.length ? (
          <div className="backing-list">
            {mine.map((s) => (
              <div key={s.id} className="bl-row">
                <Photo src={`/dnd/${s.id === 'puddle-theory' ? 'puddle-theory-1' : s.id}.jpg`} alt="" className="bl-photo" />
                <div><h3><Link href={`/design/${s.id}`}>{s.name}</Link></h3><span className={`status ${s.rank <= 3 ? 's2' : 's1'}`}>#{s.rank} · {num(s.live)} votes</span><p>{s.artist} · {s.city}</p></div>
                <button className="link small" onClick={() => toggleVote(s.id)}>Withdraw</button>
              </div>
            ))}
          </div>
        ) : <Empty title={`No votes in ${BATTLE.topic} yet.`} body="Voting is free. One vote per design."><Btn v="dark" href="/battle">Vote now</Btn></Empty>}
      </>
    );
  }
  if (tab === 'wishlist') {
    const items = state.wishlist.map(productById).filter(Boolean);
    return items.length
      ? <div className="grid3">{items.map((p) => <ProductCard key={p!.id} p={p!} />)}</div>
      : <Empty emoji="😴" title="Your wishlist is snoozing here." body="Tap the heart on any tee to save it."><Btn v="dark" href="/shop">Browse tees</Btn></Empty>;
  }
  if (tab === 'rewards') {
    return (
      <>
        <div className="acc-cards two">
          <article><span>BALANCE</span><b>{state.points}</b><p>{inr(Math.floor(state.points / 100) * 100)} off, ₹100 per order</p></article>
          <article><span>HOW TO EARN</span><b>1 pt / ₹10</b><p>Plus 50 for every friend who votes via your link</p></article>
        </div>
        <div className="points-log">
          {state.pointsLog.map((p, i) => <p key={i}><span>{p.note}<small>{dateTime(p.at)}</small></span><b className={p.delta > 0 ? 'green' : ''}>{p.delta > 0 ? '+' : ''}{p.delta}</b></p>)}
        </div>
      </>
    );
  }
  if (tab === 'addresses') return <ProfileForm onSaved={() => toast('Saved', 'Your default address and contact are updated.')} />;
  return (
    <div className="co-card">
      <PaymentsForm />
      <hr className="dash" />
      <p className="muted small">Demo data lives in this browser only.</p>
      <button className="link small danger" onClick={() => { if (window.confirm('Reset your bag, votes, orders and settings on this device?')) { resetDemo(); toast('Reset', 'Demo data cleared on this device.'); } }}>Reset demo data</button>
    </div>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => void }) {
  const { state, update } = useStore();
  const [c, setC] = useState<Contact>(state.contact);
  const [a, setA] = useState<Address>(state.address);
  useEffect(() => { setC(state.contact); setA(state.address); }, [state.contact, state.address]);
  const ce = contactErrors(c);
  const ae = addressErrors(a);
  const ok = !Object.keys(ce).length && !Object.keys(ae).length;
  return (
    <form className="co-card" onSubmit={(e) => { e.preventDefault(); if (!ok) return; update({ contact: c, address: a, pincode: a.pin }); onSaved(); }}>
      <h3>Contact</h3>
      <div className="form-grid">
        <Field label="Full name" error={ce.name}><input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></Field>
        <Field label="Email" error={ce.email}><input type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} /></Field>
        <Field label="Mobile" error={ce.phone}><input type="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} /></Field>
      </div>
      <h3>Default address</h3>
      <div className="form-grid">
        <Field label="Recipient" error={ae.name}><input value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></Field>
        <Field label="House / flat, street" error={ae.line1}><input value={a.line1} onChange={(e) => setA({ ...a, line1: e.target.value })} /></Field>
        <Field label="Area / landmark"><input value={a.line2} onChange={(e) => setA({ ...a, line2: e.target.value })} /></Field>
        <Field label="City" error={ae.city}><input value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} /></Field>
        <Field label="State" error={ae.state}><input value={a.state} onChange={(e) => setA({ ...a, state: e.target.value })} /></Field>
        <Field label="PIN code" error={ae.pin}><input inputMode="numeric" maxLength={6} value={a.pin} onChange={(e) => setA({ ...a, pin: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      <Btn v="dark" type="submit" disabled={!ok}>Save</Btn>
    </form>
  );
}

function PaymentsForm() {
  const { state, update, toast } = useStore();
  const [upi, setUpi] = useState(state.upi);
  const valid = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upi.trim());
  return (
    <>
      <h3>Saved UPI</h3>
      <div className="upi"><input value={upi} onChange={(e) => setUpi(e.target.value)} aria-label="UPI ID" /><button disabled={!valid} onClick={() => { update({ upi: upi.trim() }); toast('Saved', `UPI ID ${upi.trim()} will be suggested at checkout.`); }}>Save</button></div>
      {!valid && <p className="field-error">Use the name@bank format.</p>}
      <label className="toggle-row">
        <span><b>UPI AutoPay for backings</b><small>Approve once; holds are placed automatically when you back a design.</small></span>
        <input type="checkbox" checked={state.autopay} onChange={(e) => update({ autopay: e.target.checked })} /><i />
      </label>
    </>
  );
}
