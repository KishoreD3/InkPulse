import Link from 'next/link';
import { Bag, Bell, Search } from './Icons';
import { BagCount } from './BagCount';

const NAV = [
  { href: '/', label: 'Live drop' },
  { href: '/pulse', label: 'The Pulse' },
  { href: '/causes', label: 'Causes' },
  { href: '/artists', label: 'Artists' },
  { href: '/how-it-works', label: 'How it works' },
];

export function Header({ signedIn, handle, isAdmin, isArtist, unread }: {
  signedIn: boolean; handle?: string; isAdmin: boolean; isArtist: boolean; unread: number;
}) {
  return (
    <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur border-b-2 border-ink">
      <div className="container-page flex items-center gap-4 md:gap-8 py-3">
        <Link href="/" className="font-display text-[30px] md:text-[34px] leading-none tracking-wide misprint">
          INKPULSE
        </Link>
        <nav aria-label="Primary" className="hidden md:flex gap-6 font-mono font-bold text-[13px] tracking-widest uppercase">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="py-2 border-b-[3px] border-transparent hover:border-pink">
              {n.label}
            </Link>
          ))}
          {isArtist && <Link href="/studio" className="py-2 border-b-[3px] border-transparent hover:border-pink">Studio</Link>}
          {isAdmin && <Link href="/admin" className="py-2 border-b-[3px] border-transparent hover:border-pink text-cobalt">Admin</Link>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/search" aria-label="Search" className="w-11 h-11 rounded-full border-2 border-ink bg-card grid place-items-center">
            <Search size={20} />
          </Link>
          {signedIn ? (
            <>
              <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
                className="relative w-11 h-11 rounded-full border-2 border-ink bg-acid grid place-items-center">
                <Bell size={20} />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-pink border-2 border-ink font-mono font-bold text-[10px] grid place-items-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <Link href="/me" className="hidden md:inline-flex chip-off">@{handle}</Link>
            </>
          ) : (
            <Link href="/signin" className="chip-off">Sign in</Link>
          )}
          <Link href="/bag" className="hidden md:inline-flex items-center gap-2 h-11 px-4 rounded-full border-2 border-ink bg-ink text-acid font-display text-lg">
            <Bag size={18} /> BAG <BagCount />
          </Link>
        </div>
      </div>
      <Ticker />
    </header>
  );
}

function Ticker() {
  const line = 'NEW DROP EVERY MONDAY ✦ VOTE ✦ BACK EARLY ✦ TOP 3 PRINT FRIDAY ✦ 15% OF PROFIT TO A CAUSE ✦ ';
  return (
    <div className="bg-ink text-acid h-9 overflow-hidden flex items-center border-t-2 border-ink" aria-hidden="true">
      <div className="flex whitespace-nowrap font-display text-[17px] tracking-[2px] animate-tick">
        <span className="pr-8">{line}</span>
        <span className="pr-8">{line}</span>
      </div>
    </div>
  );
}
