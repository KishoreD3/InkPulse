'use client';
import Link from 'next/link';
import { useState } from 'react';
import { claimReferral } from '@/app/actions/growth';
import { getBrowserClient } from '@/lib/supabase/client';
import { Btn, Empty, Icon } from '../ui';
import { Field } from './Checkout';

/** Phone OTP (can vote straight away), Google, or an email magic link. */
export function SignInView({ next, error: initial, configured }: { next: string; error: string | null; configured: boolean }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState<'' | 'phone' | 'code' | 'email' | 'google'>('');
  const [error, setError] = useState<string | null>(initial);

  if (!configured) {
    return (
      <div className="page-width">
        <Empty title="This is the demo store." body="Accounts switch on once the store is connected to its database. Everything you do here stays in this browser.">
          <Btn v="dark" href="/account">Open the demo account</Btn>
        </Empty>
      </div>
    );
  }

  const digits = phone.replace(/\D/g, '').slice(-10);
  const e164 = `+91${digits}`;
  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const done = async () => {
    await claimReferral().catch(() => null);
    window.location.href = next;
  };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) { setError('Enter a valid 10-digit mobile number.'); return; }
    setBusy('phone'); setError(null);
    const { error: err } = await getBrowserClient().auth.signInWithOtp({ phone: e164 });
    setBusy('');
    if (err) setError(err.message); else setStep('code');
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('code'); setError(null);
    const { error: err } = await getBrowserClient().auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
    if (err) { setBusy(''); setError('That code didn’t work. Check it and try again.'); return; }
    await done();
  };
  const google = async () => {
    setBusy('google'); setError(null);
    const { error: err } = await getBrowserClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } });
    if (err) { setBusy(''); setError(err.message); }
  };
  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('email'); setError(null);
    const { error: err } = await getBrowserClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback() } });
    setBusy('');
    if (err) setError(err.message); else setEmailSent(true);
  };

  return (
    <div className="page-width signin">
      <div className="page-title"><p className="eyebrow">MEMBERS ONLY · NO SPAM, EVER</p><h1>Join the club.</h1><p className="muted">Vote, back designs and follow artists. One person, one vote, so voting needs a verified Indian mobile.</p></div>
      <div className="signin-grid">
        <section className="co-card">
          <h2>Mobile number <span className="sticker">CAN VOTE</span></h2>
          {step === 'phone' ? (
            <form onSubmit={sendCode} className="signin-form">
              <Field label="Indian mobile"><div className="upi"><span className="prefix">+91</span><input inputMode="numeric" autoComplete="tel-national" placeholder="98XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={14} required /></div></Field>
              <Btn v="dark" type="submit" disabled={busy === 'phone'}>{busy === 'phone' ? 'Sending…' : <>Send code <Icon name="arrow" /></>}</Btn>
            </form>
          ) : (
            <form onSubmit={verify} className="signin-form">
              <Field label={`6-digit code sent to ${e164}`}><input inputMode="numeric" autoComplete="one-time-code" className="otp" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required autoFocus /></Field>
              <Btn v="dark" type="submit" disabled={busy === 'code' || code.length < 6}>{busy === 'code' ? 'Checking…' : 'Verify & continue'}</Btn>
              <button type="button" className="link small" onClick={() => { setStep('phone'); setCode(''); }}>Change number</button>
            </form>
          )}
        </section>
        <section className="co-card">
          <h2>Or use</h2>
          <Btn v="outline" onClick={google} disabled={busy === 'google'}>{busy === 'google' ? 'Opening Google…' : 'Continue with Google'}</Btn>
          <form onSubmit={magic} className="signin-form">
            <Field label="Email magic link"><input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailSent(false); }} required /></Field>
            <Btn v="outline" type="submit" disabled={busy === 'email' || emailSent}>{emailSent ? 'Link sent · check your inbox' : busy === 'email' ? 'Sending…' : 'Email me a link'}</Btn>
          </form>
          <p className="muted small">Signed in with Google or email? Add a mobile number in your account before your first vote.</p>
        </section>
      </div>
      {error && <p className="field-error center" role="alert">{error}</p>}
      <p className="muted small center">By continuing you agree to our <Link className="link" href="/legal/terms">Terms</Link> and <Link className="link" href="/legal/privacy">Privacy policy</Link>.</p>
    </div>
  );
}
