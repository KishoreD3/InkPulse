'use client';
import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, '0');

/** Days:hours:minutes until `to`. Renders a stable value on the server, ticks on the client. */
export function Countdown({ to, className, unitsClassName }: { to: string; className?: string; unitsClassName?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = parts(target - (now ?? target - 1));
  const done = now !== null && target <= now;
  return (
    <div>
      <div className={className} aria-live="off" suppressHydrationWarning>
        {now === null ? '--:--:--' : done ? '00:00:00' : `${pad(p.d)}:${pad(p.h)}:${pad(p.m)}`}
      </div>
      <div className={unitsClassName}>DAYS · HRS · MIN</div>
    </div>
  );
}
