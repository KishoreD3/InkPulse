'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

/** Adds a phone to an email/Google account and verifies it (Supabase phone_change OTP). */
export function PhoneVerify() {
  const supabase = getBrowserClient();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const e164 = `+91${phone.replace(/\D/g, '').slice(-10)}`;

  return sent ? (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      const { error } = await supabase.auth.verifyOtp({ phone: e164, token: code, type: 'phone_change' });
      if (error) setMsg('That code did not work.'); else window.location.reload();
    }}>
      <label htmlFor="pv-code" className="label-mono">Code sent to {e164}</label>
      <input id="pv-code" className="input font-mono tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code"
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
      <button className="btn-pink">Verify</button>
      {msg && <p role="alert" className="text-sm font-semibold">{msg}</p>}
    </form>
  ) : (
    <form className="flex flex-col gap-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!/^[6-9]\d{9}$/.test(phone.replace(/\D/g, '').slice(-10))) { setMsg('Enter a valid 10-digit mobile number.'); return; }
      const { error } = await supabase.auth.updateUser({ phone: e164 });
      if (error) setMsg(error.message); else { setSent(true); setMsg(null); }
    }}>
      <p className="text-sm text-body">Voting needs a verified Indian mobile number — it keeps the board fair (one person, one vote).</p>
      <div className="flex gap-2">
        <span className="input !w-auto grid place-items-center font-mono">+91</span>
        <label htmlFor="pv-phone" className="sr-only">Mobile number</label>
        <input id="pv-phone" className="input" inputMode="numeric" autoComplete="tel-national" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <button className="btn-pink">Send code</button>
      {msg && <p role="alert" className="text-sm font-semibold">{msg}</p>}
    </form>
  );
}
