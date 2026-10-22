'use client';
import { useEffect, useState } from 'react';
import { readBag } from '@/lib/cart';

export function BagCount({ bare = false }: { bare?: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const sync = () => setN(readBag().reduce((s, l) => s + l.qty, 0));
    sync();
    window.addEventListener('ink-bag', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('ink-bag', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  if (bare) return n > 0 ? <em className="absolute -right-1 -top-1 min-w-[17px] h-[17px] px-1 rounded-full bg-yellow text-ink text-[9px] not-italic font-extrabold grid place-items-center">{n}</em> : null;
  return <span>· {n}</span>;
}
