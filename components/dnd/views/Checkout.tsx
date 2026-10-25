'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { inr } from '@/lib/dnd/catalog';
import { useCatalog } from '@/lib/dnd/catalog-context';
import { useStore, type Address, type Contact } from '@/lib/dnd/store';
import { Btn, Empty, Icon } from '../ui';
import { BagItem } from './Bag';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
const VPA = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const PIN = /^[1-9]\d{5}$/;

export function contactErrors(c: Contact) {
  const e: Partial<Record<keyof Contact, string>> = {};
  if (c.name.trim().length < 2) e.name = 'Enter your name.';
  if (!EMAIL.test(c.email.trim())) e.email = 'Enter a valid email.';
  if (!PHONE.test(c.phone.trim())) e.phone = 'Enter a 10-digit Indian mobile number.';
  return e;
}
export function addressErrors(a: Address) {
  const e: Partial<Record<keyof Address, string>> = {};
  if (a.name.trim().length < 2) e.name = 'Enter the recipient’s name.';
  if (a.line1.trim().length < 3) e.line1 = 'Enter house / flat and street.';
  if (a.city.trim().length < 2) e.city = 'Enter a city.';
  if (a.state.trim().length < 2) e.state = 'Enter a state.';
  if (!PIN.test(a.pin.trim())) e.pin = 'Enter a 6-digit PIN code.';
  return e;
}
function luhn(n: string) {
  const d = n.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let x = Number(d[d.length - 1 - i]);
    if (i % 2) { x *= 2; if (x > 9) x -= 9; }
    sum += x;
  }
  return sum % 10 === 0;
}
function expiryOk(v: string) {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const month = Number(m[1]); const year = 2000 + Number(m[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
}

export function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className={`field ${error ? 'bad' : ''}`}><span>{label}</span>{children}{error && <em className="field-error">{error}</em>}</label>;
}

export function CheckoutView() {
  const { state, hydrated, placeOrder, quote, mode, session } = useStore();
  const { prices, battle } = useCatalog();
  const router = useRouter();
  const q = quote();
  const [orderErr, setOrderErr] = useState('');
  const [contact, setContact] = useState<Contact>(state.contact);
  const [address, setAddress] = useState<Address>(state.address);
  const [edit, setEdit] = useState<'contact' | 'address' | null>(null);
  const [pay, setPay] = useState<'upi' | 'card'>('upi');
  const [vpa, setVpa] = useState(state.upi);
  const [vpaOk, setVpaOk] = useState(false);
  const [vpaErr, setVpaErr] = useState('');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    setContact(state.contact);
    setAddress(state.address);
    setVpa(state.upi);
    // Only on hydration: later edits stay in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) return <div className="page-width checkout"><div className="skeleton" /></div>;
  if (!state.bag.length && !busy) {
    return <div className="page-width checkout"><Empty emoji="🛍️" title="Nothing to check out." body="Your bag is empty."><Btn v="dark" href="/shop">Shop tees</Btn></Empty></div>;
  }

  const cErr = contactErrors(contact);
  const aErr = addressErrors(address);
  const cardErr = {
    number: luhn(card.number) ? '' : 'Enter a valid card number.',
    expiry: expiryOk(card.expiry) ? '' : 'Use MM/YY, not in the past.',
    cvv: /^\d{3,4}$/.test(card.cvv) ? '' : '3 or 4 digits.',
    name: card.name.trim().length >= 2 ? '' : 'Name on card.',
  };
  const payOk = pay === 'upi' ? vpaOk : !Object.values(cardErr).some(Boolean);
  const detailsOk = !Object.keys(cErr).length && !Object.keys(aErr).length;
  const backingNames = state.bag.filter((l) => l.kind === 'back').map((l) => l.id);
  const hasBacking = backingNames.length > 0;
  const step = !detailsOk ? (Object.keys(cErr).length ? 0 : 1) : 2;

  const verify = () => {
    if (!VPA.test(vpa.trim())) { setVpaErr('That doesn’t look like a UPI ID (name@bank).'); setVpaOk(false); return; }
    setVpaErr(''); setVpaOk(true);
  };
  const submit = () => {
    setTried(true);
    if (!detailsOk) { setEdit(Object.keys(cErr).length ? 'contact' : 'address'); return; }
    if (!payOk) return;
    if (mode === 'live' && !session) { router.push('/signin?next=/checkout'); return; }
    setBusy(true);
    setOrderErr('');
    const payment = pay === 'upi' ? `UPI · ${vpa.trim()}` : `Card · •••• ${card.number.replace(/\D/g, '').slice(-4)}`;
    window.setTimeout(async () => {
      const r = await placeOrder({ contact, address, payment });
      if ('error' in r) { setOrderErr(r.error); setBusy(false); return; }
      router.push(`/orders/${r.order.id}?placed=1`);
    }, mode === 'demo' ? 1200 : 0);
  };

  const payLabel = q.payNow > 0
    ? (hasBacking ? `Pay ${inr(q.payNow)} & authorise hold` : `Pay ${inr(q.payNow)}`)
    : `Authorise ${inr(q.holds)} hold`;

  return (
    <div className="page-width checkout">
      <Link className="link" href="/bag">← Back to bag</Link>
      <div className="checkout-grid">
        <div>
          <div className="steps-bar">{['Contact', 'Address', 'Payment'].map((x, i) => <div key={x} className={i < step ? 'done' : i === step ? 'now' : ''}><b>{i < step ? '✓' : i + 1}</b><span>{x}</span></div>)}</div>

          {edit === 'contact' ? (
            <section className="co-card">
              <h2>Contact</h2>
              <div className="form-grid">
                <Field label="Full name" error={tried || contact.name ? cErr.name : undefined}><input autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></Field>
                <Field label="Email" error={tried || contact.email ? cErr.email : undefined}><input type="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></Field>
                <Field label="Mobile" error={tried || contact.phone ? cErr.phone : undefined}><input type="tel" autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
              </div>
              <Btn v="dark" disabled={Object.keys(cErr).length > 0} onClick={() => setEdit(null)}>Save contact</Btn>
            </section>
          ) : (
            <section className="co-card compact"><div><b>Contact</b><p>{contact.email} · {contact.phone}</p></div><button className="link" onClick={() => setEdit('contact')}>Change</button></section>
          )}

          {edit === 'address' ? (
            <section className="co-card">
              <h2>Deliver to</h2>
              <div className="form-grid">
                <Field label="Recipient" error={tried ? aErr.name : undefined}><input autoComplete="name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} /></Field>
                <Field label="House / flat, street" error={tried || address.line1 ? aErr.line1 : undefined}><input autoComplete="address-line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} /></Field>
                <Field label="Area / landmark (optional)"><input autoComplete="address-line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} /></Field>
                <Field label="City" error={tried || address.city ? aErr.city : undefined}><input autoComplete="address-level2" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} /></Field>
                <Field label="State" error={tried || address.state ? aErr.state : undefined}><input autoComplete="address-level1" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} /></Field>
                <Field label="PIN code" error={tried || address.pin ? aErr.pin : undefined}><input inputMode="numeric" maxLength={6} autoComplete="postal-code" value={address.pin} onChange={(e) => setAddress({ ...address, pin: e.target.value.replace(/\D/g, '') })} /></Field>
              </div>
              <Btn v="dark" disabled={Object.keys(aErr).length > 0} onClick={() => setEdit(null)}>Deliver here</Btn>
            </section>
          ) : (
            <section className="co-card compact"><div><b>Deliver to</b><p>{address.name} · {[address.line1, address.line2, address.city].filter(Boolean).join(', ')} {address.pin}</p></div><button className="link" onClick={() => setEdit('address')}>Change</button></section>
          )}

          <section className="co-card">
            <h2>Payment</h2>
            <button className={`pay ${pay === 'upi' ? 'on' : ''}`} aria-pressed={pay === 'upi'} onClick={() => setPay('upi')}><i /><span className="pay-badge">UPI</span><div><b>UPI</b><small>Google Pay, PhonePe, Paytm or any UPI app</small></div></button>
            {pay === 'upi' && (
              <>
                <div className="upi"><input placeholder="yourname@upi" aria-label="UPI ID" value={vpa} onChange={(e) => { setVpa(e.target.value); setVpaOk(false); }} /><button onClick={verify}>{vpaOk ? '✓ Verified' : 'Verify'}</button></div>
                {vpaErr && <p className="field-error" role="alert">{vpaErr}</p>}
                {vpaOk && <p className="ok-note">✓ {contact.name} · you’ll approve the request in your UPI app.</p>}
                {tried && !vpaOk && !vpaErr && <p className="field-error">Verify your UPI ID to continue.</p>}
              </>
            )}
            <button className={`pay ${pay === 'card' ? 'on' : ''}`} aria-pressed={pay === 'card'} onClick={() => setPay('card')}><i /><Icon name="card" /><div><b>Credit or debit card</b><small>Visa, Mastercard, RuPay</small></div></button>
            {pay === 'card' && (
              <div className="form-grid">
                <Field label="Card number" error={(tried || card.number.length > 15) ? cardErr.number || undefined : undefined}><input inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d ]/g, '').slice(0, 23) })} /></Field>
                <Field label="Expiry" error={(tried || card.expiry.length >= 5) ? cardErr.expiry || undefined : undefined}><input autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value.replace(/[^\d/]/g, '').slice(0, 5) })} /></Field>
                <Field label="CVV" error={tried ? cardErr.cvv || undefined : undefined}><input inputMode="numeric" autoComplete="cc-csc" placeholder="•••" type="password" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></Field>
                <Field label="Name on card" error={tried ? cardErr.name || undefined : undefined}><input autoComplete="cc-name" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></Field>
              </div>
            )}
            {hasBacking && <div className="hold-note"><Icon name="moon" /><p><b>About your {inr(q.holds)} hold</b><br />We authorise a hold now and charge it only if your backed design{backingNames.length > 1 ? 's finish' : ' finishes'} top {battle.winners}. Otherwise it’s released the same night.</p></div>}
            <p className="test-note">Test mode: no real payment is taken. Live Razorpay checkout switches on when the store is connected to your account.</p>
          </section>
        </div>
        <aside className="summary">
          <h2>Your order</h2>
          {state.bag.map((l) => <BagItem key={l.key} l={l} editable={false} />)}
          <hr />
          {q.discount > 0 && <p><span>{state.coupon}</span><b className="green">− {inr(q.discount)}</b></p>}
          {q.reward > 0 && <p><span>Club reward</span><b className="green">− {inr(q.reward)}</b></p>}
          <p><span>Pay today</span><b>{inr(q.payNow)}</b></p>
          {hasBacking && <p className="muted"><span>Authorise hold</span><b>{inr(q.holds || prices.back)}</b></p>}
          {orderErr && <p className="field-error" role="alert">{orderErr}</p>}
          <Btn v="dark" onClick={submit} disabled={busy}>{busy ? 'Processing…' : <>{payLabel} <Icon name="arrow" /></>}</Btn>
          <small className="secure">By continuing, you agree to our <Link href="/legal/terms">backing & payment terms</Link>.</small>
        </aside>
      </div>
    </div>
  );
}
