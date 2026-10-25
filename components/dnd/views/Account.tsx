'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { inr, num } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { dateTime, shortDate } from '@/lib/dnd/cycle';
import { getBrowserClient } from '@/lib/supabase/client';
import { useNow, useStore, type Address, type Contact, type OrderLine } from '@/lib/dnd/store';
import { ProductCard, VoteBtn } from '../cards';
import { Btn, Empty, Icon, Photo } from '../ui';
import { Field, addressErrors, contactErrors } from './Checkout';
import { Track } from './Order';

const TABS = [
  ['overview', 'Overview'], ['backings', 'My backings'], ['orders', 'Orders & tracking'], ['votes', 'Votes'],
  ['wishlist', 'Wishlist'], ['rewards', 'Club rewards'], ['addresses', 'Addresses'], ['alerts', 'Notifications'], ['payments', 'Payments & AutoPay'],
] as const;
type Tab = (typeof TABS)[number][0];

export function AccountView() {
  const { state, hydrated, mode, session, signOut } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const raw = params.get('tab');
  const tab: Tab = TABS.some(([k]) => k === raw) ? (raw as Tab) : 'overview';
  const go = (t: Tab) => router.replace(t === 'overview' ? path : `${path}?tab=${t}`, { scroll: false });
  const first = (state.contact.name || session?.name || '').split(' ')[0] || 'there';
  const unread = state.notifications.filter((n) => !n.read).length;
  const member = mode === 'demo' ? 'MEMBER #2841 · SINCE 2024'
    : `${session?.phoneVerified ? 'VERIFIED MEMBER' : 'MEMBER'}${session ? ` · SINCE ${new Date(session.since).getFullYear()}` : ''}`;

  return (
    <div className="page-width account">
      <div className="hello"><p className="eyebrow">{member}</p><h1>Hey, {hydrated ? first : mode === 'demo' ? 'Riya' : 'there'}. 🌙</h1><p className="muted">{state.points} club points · DND mode loyalist</p></div>
      <div className="account-grid">
        <aside aria-label="Account sections">
          {TABS.map(([k, label]) => <button key={k} aria-current={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{label}{k === 'alerts' && unread ? ` · ${unread}` : ''}<Icon name="arrow" size={14} /></button>)}
          <hr />
          <Link className="aside-link" href="/dashboard">Artist dashboard<Icon name="arrow" size={14} /></Link>
          {session?.isAdmin && <Link className="aside-link" href="/admin">Admin<Icon name="arrow" size={14} /></Link>}
          {mode === 'live' && session && <button className="aside-link" onClick={() => void signOut()}>Sign out<Icon name="arrow" size={14} /></button>}
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
  const { state, lineInfo } = useStore();
  const { battle, prices } = useCatalog();
  const inBag: BackRow[] = state.bag.filter((l) => l.kind === 'back').map((l) => {
    const info = lineInfo(l);
    return { line: { ...l, name: info.name, image: info.image, unit: prices.back, drop: battle.drop }, orderId: null, createdAt: Date.now() };
  });
  const placed = state.orders.flatMap((o) => o.lines.filter((l) => l.kind === 'back').map((line) => ({ line, orderId: o.id, createdAt: o.createdAt })));
  return [...inBag, ...placed];
}

const pad = (n: number) => String(n).padStart(3, '0');

function BackList() {
  const { lineStatus } = useStore();
  const { battle, prices } = useCatalog();
  const now = useNow(30_000) ?? 0;
  const rows = useBackings();
  if (!rows.length) return <Empty title="No backings yet." body={`Back a live design for ${inr(prices.back)}. Pay only if it prints.`}><Btn v="dark" href="/battle">Enter the battle</Btn></Empty>;
  return (
    <div className="backing-list">
      {rows.map(({ line, orderId, createdAt }) => {
        const s = orderId ? lineStatus(line, createdAt, now || createdAt) : { label: 'In your bag · not placed', tone: 1 as const };
        const money = s.label === 'Hold released' ? 'Not charged' : s.tone === 2 ? `${inr(line.unit)} paid` : `${inr(line.unit)} hold`;
        const href = orderId ? `/result/${orderId}` : '/bag';
        return (
          <Link key={`${orderId}-${line.key}`} href={href} className="bl-row">
            <Photo src={line.image} alt="" className="bl-photo" />
            <div><h3>{line.name}</h3><span className={`status s${s.tone}`}>{s.label}</span><p>{money} · Drop {pad(line.drop ?? battle.drop)}</p></div>
            <Icon name="arrow" />
          </Link>
        );
      })}
    </div>
  );
}

function Section({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const { state, toast, resetDemo, toggleVote, lineStatus, board: rank, mode, session } = useStore();
  const { battle, productById } = useCatalog();
  const now = useNow(30_000);
  const t = now ?? 0;
  const backings = useBackings();
  const active = backings.filter((b) => !b.line.outcome && (!b.line.status || b.line.status === 'backed') && (!b.orderId || t < (b.line.closesAt ?? Infinity)));
  const board = rank(now);
  const latestOrder = state.orders[0];
  const latestBack = active[0];
  const lb = latestBack ? board.find((s) => s.id === latestBack.line.id) : undefined;

  if (tab === 'overview') {
    const printing = state.orders.filter((o) => o.lines.some((l) => l.kind === 'buy' && lineStatus(l, o.createdAt, t || o.createdAt).step < 3)).length;
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
            <Track title={latestOrder.lines[0].name} href={`/orders/${latestOrder.id}`} status={`Order ${latestOrder.id} · ${lineStatus(latestOrder.lines[0], latestOrder.createdAt, t || latestOrder.createdAt).label}`} s={lineStatus(latestOrder.lines[0], latestOrder.createdAt, t || latestOrder.createdAt)} />
          ) : <Empty title="No orders yet." />}
          <div className="latest">
            <p className="eyebrow">LATEST BACKING</p>
            {latestBack && lb ? (
              <><h3>{latestBack.line.name}</h3><p className="muted">#{lb.rank} · {lb.rank <= battle.winners ? 'safely in the print zone' : 'below the print line — rally some votes'}</p><VoteBtn id={lb.id} votes={lb.live} compact /></>
            ) : (
              <><h3>Nothing live.</h3><p className="muted">{battle.live ? `Back a ${battle.topic} finalist before Thursday.` : 'The next battle opens Monday at 10 AM.'}</p><Btn v="dark" href="/battle">Enter the battle</Btn></>
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
          const s = lineStatus(o.lines[0], o.createdAt, t || o.createdAt);
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
                <Photo src={s.card} alt="" className="bl-photo" />
                <div><h3><Link href={`/design/${s.id}`}>{s.name}</Link></h3><span className={`status ${s.rank <= battle.winners ? 's2' : 's1'}`}>#{s.rank} · {num(s.live)} votes</span><p>{s.artist}{s.city ? ` · ${s.city}` : ''}</p></div>
                <button className="link small" onClick={() => toggleVote(s.id)}>Withdraw</button>
              </div>
            ))}
          </div>
        ) : <Empty title={battle.live ? `No votes in ${battle.topic} yet.` : 'No battle on right now.'} body="Voting is free. One vote per design."><Btn v="dark" href="/battle">Vote now</Btn></Empty>}
      </>
    );
  }
  if (tab === 'wishlist') {
    const items = state.wishlist.map((id) => productById(id)).filter(Boolean);
    return items.length
      ? <div className="grid3">{items.map((p) => <ProductCard key={p!.id} p={p!} />)}</div>
      : <Empty emoji="😴" title="Your wishlist is snoozing here." body="Tap the heart on any tee to save it."><Btn v="dark" href="/shop">Browse tees</Btn></Empty>;
  }
  if (tab === 'rewards') {
    return (
      <>
        <div className="acc-cards two">
          <article><span>BALANCE</span><b>{state.points}</b><p>{inr(Math.floor(state.points / 100) * 100)} off, ₹100 per order</p></article>
          <article><span>HOW TO EARN</span><b>1 pt / ₹10</b><p>{mode === 'demo' ? 'Plus 50 for every friend who votes via your link' : 'Plus ₹100 off when a friend you invite places their first order'}</p></article>
        </div>
        {mode === 'live' && session && <InviteLink handle={session.handle} />}
        <div className="points-log">
          {state.pointsLog.map((p, i) => <p key={i}><span>{p.note}<small>{dateTime(p.at)}</small></span><b className={p.delta > 0 ? 'green' : ''}>{p.delta > 0 ? '+' : ''}{p.delta}</b></p>)}
        </div>
      </>
    );
  }
  if (tab === 'addresses') return <ProfileForm onSaved={() => toast('Saved', 'Your default address and contact are updated.')} />;
  if (tab === 'alerts') return <Alerts />;
  return (
    <div className="co-card">
      {mode === 'live' && <><PhoneVerify /><hr className="dash" /></>}
      <PaymentsForm />
      {mode === 'demo' && <>
        <hr className="dash" />
        <p className="muted small">Demo data lives in this browser only.</p>
        <button className="link small danger" onClick={() => { if (window.confirm('Reset your bag, votes, orders and settings on this device?')) { resetDemo(); toast('Reset', 'Demo data cleared on this device.'); } }}>Reset demo data</button>
      </>}
    </div>
  );
}

function InviteLink({ handle }: { handle: string }) {
  const { toast } = useStore();
  const [url, setUrl] = useState('');
  useEffect(() => setUrl(`${window.location.origin}/?ref=${handle}`), [handle]);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Invite link copied', 'Share it with a friend.'); } catch { toast('Your invite link', url); }
  };
  return <div className="upi invite"><input readOnly value={url} aria-label="Your invite link" /><button onClick={copy}>Copy</button></div>;
}

/** Notifications from the club: battle reminders, results, shipping. Opening the tab marks them read. */
function Alerts() {
  const { state, mode, session, update } = useStore();
  const unread = state.notifications.filter((n) => !n.read).map((n) => n.id);
  useEffect(() => {
    if (mode !== 'live' || !session || !unread.length) return;
    void getBrowserClient().from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread)
      .then(({ error }) => { if (!error) update({ notifications: state.notifications.map((n) => ({ ...n, read: true })) }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, session, unread.join()]);
  return (
    <>
      <NotifyPrefsForm />
      {state.notifications.length ? <NoteList /> : <Empty emoji="🔕" title="All quiet." body="Battle reminders, results and shipping updates show up here." />}
    </>
  );
}

/** Which channels the club may use, and push on this device. */
function NotifyPrefsForm() {
  const { state, setNotify, toast, mode } = useStore();
  const [pushing, setPushing] = useState(false);
  const toggle = async (k: keyof typeof state.notify) => {
    const err = await setNotify({ ...state.notify, [k]: !state.notify[k] });
    if (err) toast('Not saved', err);
  };
  const enable = async () => {
    setPushing(true);
    const { enablePush } = await import('@/lib/push-client');
    const r = mode === 'live' ? await enablePush() : { ok: false as const, error: 'Push works once the store is connected to its database.' };
    setPushing(false);
    if (r.ok) toast('Push is on', 'This device will get battle and order alerts.'); else toast('Push not turned on', r.error);
  };
  const rows: [keyof typeof state.notify, string, string][] = [
    ['push', 'Push', 'On this phone or browser'], ['email', 'Email', state.contact.email || 'Add an email at checkout'], ['whatsapp', 'WhatsApp', state.contact.phone || 'Your verified mobile'],
  ];
  return (
    <div className="co-card prefs">
      <h3>How we reach you</h3>
      {rows.map(([k, label, sub]) => (
        <label key={k} className="toggle-row"><span><b>{label}</b><small>{sub}</small></span><input type="checkbox" checked={state.notify[k]} onChange={() => void toggle(k)} /><i /></label>
      ))}
      <Btn v="outline" onClick={enable} disabled={pushing}>{pushing ? 'Asking…' : 'Turn on push for this device'}</Btn>
    </div>
  );
}

function NoteList() {
  const { state } = useStore();
  return (
    <div className="points-log">
      {state.notifications.map((n) => {
        const body = <span>{!n.read && <b className="green">● </b>}{n.title}<small>{n.body ? `${n.body} · ` : ''}{dateTime(n.at)}</small></span>;
        return n.link ? <Link key={n.id} href={n.link} className="note-row"><p>{body}<Icon name="arrow" size={14} /></p></Link> : <p key={n.id}>{body}</p>;
      })}
    </div>
  );
}

/** Voting needs a verified mobile number. Members who signed in by email or Google add one here. */
function PhoneVerify() {
  const { session, toast, refresh } = useStore();
  const { requirePhone } = useCatalog();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  if (session.phoneVerified) return <><h3>Mobile</h3><p className="ok-note">✓ {session.phone} is verified.</p></>;
  const e164 = `+91${phone.replace(/\D/g, '').slice(-10)}`;
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) { setErr('Enter a valid 10-digit mobile number.'); return; }
    setBusy(true); setErr('');
    const { error } = await getBrowserClient().auth.updateUser({ phone: e164 });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setStep('code');
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const { error } = await getBrowserClient().auth.verifyOtp({ phone: e164, token: code.trim(), type: 'phone_change' });
    setBusy(false);
    if (error) { setErr('That code didn’t work. Check it and try again.'); return; }
    toast('Mobile verified', 'You can vote in every battle now.');
    await refresh();
    window.location.reload();
  };
  return (
    <>
      <h3>Verify your mobile</h3>
      <p className="muted small">{requirePhone ? 'One verified number per member keeps the battle fair. You need it to vote.' : 'We text you shipping updates. One verified number per member.'}</p>
      {step === 'phone' ? (
        <form className="upi" onSubmit={send}><input type="tel" inputMode="numeric" placeholder="98XXXXXXXX" aria-label="Mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={14} /><button disabled={busy}>{busy ? '…' : 'Send code'}</button></form>
      ) : (
        <form className="upi" onSubmit={verify}><input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" aria-label="Code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} /><button disabled={busy || code.length < 6}>{busy ? '…' : 'Verify'}</button></form>
      )}
      {err && <p className="field-error" role="alert">{err}</p>}
    </>
  );
}

function ProfileForm({ onSaved }: { onSaved: () => void }) {
  const { state, update, saveProfile, toast } = useStore();
  const [c, setC] = useState<Contact>(state.contact);
  const [a, setA] = useState<Address>(state.address);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setC(state.contact); setA(state.address); }, [state.contact, state.address]);
  const ce = contactErrors(c);
  const ae = addressErrors(a);
  const ok = !Object.keys(ce).length && !Object.keys(ae).length;
  return (
    <form className="co-card" onSubmit={async (e) => {
      e.preventDefault();
      if (!ok || busy) return;
      setBusy(true);
      const err = await saveProfile({ contact: c, address: a });
      setBusy(false);
      if (err) { toast('Not saved', err); return; }
      update({ pincode: a.pin });
      onSaved();
    }}>
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
      <Btn v="dark" type="submit" disabled={!ok || busy}>{busy ? 'Saving…' : 'Save'}</Btn>
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
