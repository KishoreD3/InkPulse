'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bag, Bolt, Brush, Plus, Pulse } from './Icons';

const TABS = [
  { href: '/', label: 'LIVE', Icon: Bolt },
  { href: '/pulse', label: 'PULSE', Icon: Pulse },
  { href: '/artists', label: 'ARTISTS', Icon: Brush },
  { href: '/bag', label: 'BAG', Icon: Bag },
];

/** Mobile bottom tab bar (hidden ≥ md, where the header nav takes over). */
export function TabBar() {
  const path = usePathname();
  if (path.startsWith('/admin')) return null;
  const active = (href: string) => (href === '/' ? path === '/' || path.startsWith('/d/') : path.startsWith(href));
  const tab = (t: (typeof TABS)[number]) => (
    <Link key={t.href} href={t.href} aria-current={active(t.href) ? 'page' : undefined}
      className={`flex flex-col items-center gap-1 min-w-[56px] py-2 font-mono font-bold text-[10px] tracking-widest ${active(t.href) ? 'text-acid' : 'text-mist'}`}>
      <t.Icon size={22} />{t.label}
    </Link>
  );
  return (
    <nav aria-label="Primary" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-ink h-[76px] pb-[env(safe-area-inset-bottom)] flex items-center justify-around px-2">
      {tab(TABS[0])}
      {tab(TABS[1])}
      <Link href="/submit" aria-label="Submit a design"
        className="-mt-7 w-[60px] h-[60px] rounded-full bg-pink border-2 border-ink grid place-items-center text-ink ring-4 ring-paper">
        <Plus size={26} />
      </Link>
      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  );
}
