'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from './Toaster';

type Result = { ok: boolean; error?: string; message?: string };

/** A button that runs a server action and reports the result. */
export function ActionButton({ run, children, className = 'chip-off', confirm }: {
  run: () => Promise<Result>; children: React.ReactNode; className?: string; confirm?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          const r = await run();
          toast(r.ok ? { message: r.message ?? 'Done.' } : { message: r.error ?? 'Failed.', tone: 'error' });
          router.refresh();
        });
      }}
    >
      {pending ? 'Working…' : children}
    </button>
  );
}

export function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'warn' }) {
  return (
    <div className={`border-2 border-ink rounded-2xl p-4 ${tone === 'warn' ? 'bg-pink' : 'bg-card'}`}>
      <p className="font-display text-3xl">{value}</p>
      <p className="label-mono">{label}</p>
    </div>
  );
}
