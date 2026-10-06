'use client';
import { useEffect, useState } from 'react';
import { readBag } from '@/lib/cart';

export function BagCount() {
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
  return <span>· {n}</span>;
}
