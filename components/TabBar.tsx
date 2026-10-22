'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bolt, Grid, Home, Plus, User } from './Icons';

const TABS = [
  { href: '/', label: 'Home', Icon: Home, match: (p: string) => p === '/' || p.startsWith('/shop') || p.startsWith('/d/') },
  { href: '/#board', label: 'Battle', Icon: Bolt, match: (p: string) => p.startsWith('/drops') },
  { href: '/topics', label: 'Topics', Icon: Grid, match: (p: string) => p.startsWith('/topics') },
  { href: '/me', label: 'Me', Icon: User, match: (p: string) => p.startsWith('/me') || p.startsWith('/orders') || p.startsWith('/studio') },
];

/** Mobile bottom tab bar (hidden ≥ md, where the header nav takes over). */
export function TabBar() {
  const path = usePathname();
  if (path.startsWith('/admin') || path.startsWith('/checkout')) return null;
  const tab = (t: (typeof TABS)[number]) => {
    const on = t.match(path);
    return (
      <Link key={t.label} href={t.href} aria-current={on ? 'page' : undefined}
        className={`flex flex-col items-center gap-1 min-w-[56px] py-2 text-[10px] font-bold ${on ? 'text-ink' : 'text-muted'}`}>
        <t.Icon size={21} className={on && t.label === 'Battle' ? 'text-red' : undefined} />{t.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line h-[72px] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-2">
      {tab(TABS[0])}
      {tab(TABS[1])}
      <Link href="/submit" aria-label="Submit a design" className="flex flex-col items-center gap-1 -mt-5 text-[10px] font-bold">
        <span className="w-[48px] h-[48px] rounded-full bg-yellow grid place-items-center shadow-lift ring-4 ring-white"><Plus size={22} /></span>
        Submit
      </Link>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  );
}
