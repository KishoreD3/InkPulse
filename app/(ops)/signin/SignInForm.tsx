'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

export function SignInForm({ next }: { next: string }) {
  const supabase = getBrowserClient();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = `+91${phone.replace(/\D/g, '').slice(-10)}`;
  const redirect = `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) { setError('Enter a valid 10-digit mobile number.'); return; }
    setBusy(true); setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) setError(error.message); else setStep('code');
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'sms' });
    setBusy(false);
    if (error) setError('That code did not work. Check it and try again.');
    else window.location.href = next;
  }

  return (
    <div className="flex flex-col gap-6 pt-8">
      <section className="card p-5 flex flex-col gap-4">
        <h2 className="h-display text-2xl">Mobile number <span className="sticker bg-acid align-middle ml-1">Can vote</span></h2>
        {step === 'phone' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <label htmlFor="phone" className="label-mono">Indian mobile</label>
            <div className="flex gap-2">
              <span className="input !w-auto grid place-items-center font-mono">+91</span>
              <input id="phone" inputMode="numeric" autoComplete="tel-national" className="input" placeholder="98XXXXXXXX"
                value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={14} required />
            </div>
            <button className="btn-pink" disabled={busy}>{busy ? 'Sending…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <label htmlFor="code" className="label-mono">6-digit code sent to {e164}</label>
            <input id="code" inputMode="numeric" autoComplete="one-time-code" className="input font-mono tracking-[0.5em] text-xl"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} required />
            <button className="btn-pink" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Verify & continue'}</button>
            <button type="button" className="text-sm underline self-start" onClick={() => { setStep('phone'); setCode(''); }}>Change number</button>
          </form>
        )}
      </section>

      <div className="flex items-center gap-3 label-mono text-muted"><span className="flex-1 border-t-2 border-dashed border-ink" />or<span className="flex-1 border-t-2 border-dashed border-ink" /></div>

      <button className="btn-white" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect } })}>
        Continue with Google
      </button>

      <form className="card-flat p-4 flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect } });
        setBusy(false);
        if (error) setError(error.message); else setEmailSent(true);
      }}>
        <label htmlFor="email" className="label-mono">Email magic link</label>
        <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn-ink btn-sm" disabled={busy}>{emailSent ? 'Link sent — check your inbox' : 'Email me a link'}</button>
        <p className="text-xs text-muted">Signed in with Google or email? You will be asked to verify a mobile number before your first vote.</p>
      </form>

      {error && <p role="alert" className="bg-pink border-2 border-ink rounded-xl p-3 font-semibold">{error}</p>}
      <p className="text-xs text-muted">By continuing you agree to our <a className="underline" href="/legal/terms">Terms</a> and <a className="underline" href="/legal/privacy">Privacy policy</a>.</p>
    </div>
  );
}
