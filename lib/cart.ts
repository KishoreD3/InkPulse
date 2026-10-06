'use client';
import type { CartLine } from '@/lib/types';

// The bag holds retail items (past winners). Backing a live design skips the
// bag and goes straight to checkout, because each backing is its own mandate.
const KEY = 'inkpulse-bag-v1';

export function readBag(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

export function writeBag(lines: CartLine[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    /* storage unavailable (private mode) — bag lives for this page only */
  }
  window.dispatchEvent(new Event('ink-bag'));
}

export function addToBag(line: CartLine) {
  const lines = readBag();
  const same = lines.find((l) => l.designId === line.designId && l.colour === line.colour && l.size === line.size);
  if (same) same.qty = Math.min(5, same.qty + line.qty);
  else lines.push(line);
  writeBag(lines);
}

export function clearBag() {
  writeBag([]);
}
