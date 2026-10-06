'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface ToastDetail { message: string; action?: { label: string; href: string }; tone?: 'ok' | 'error' }

/** Fire a toast from any client component. */
export function toast(detail: ToastDetail) {
  window.dispatchEvent(new CustomEvent<ToastDetail>('ink-toast', { detail }));
}

export function Toaster() {
  const [items, setItems] = useState<(ToastDetail & { id: number })[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<ToastDetail>).detail;
      const id = Date.now() + Math.random();
      setItems((x) => [...x.slice(-2), { ...d, id }]);
      setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 5000);
    };
    window.addEventListener('ink-toast', on);
    return () => window.removeEventListener('ink-toast', on);
  }, []);
  return (
    <div aria-live="polite" className="fixed z-50 left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 flex flex-col gap-2 w-[min(92vw,420px)]">
      {items.map((t) => (
        <div key={t.id} className={`animate-pop flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-ink shadow-hard ${t.tone === 'error' ? 'bg-pink' : 'bg-acid'}`}>
          <p className="flex-1 text-sm font-semibold">{t.message}</p>
          {t.action && <Link href={t.action.href} className="btn-ink btn-sm">{t.action.label}</Link>}
        </div>
      ))}
    </div>
  );
}
