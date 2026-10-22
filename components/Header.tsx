import Link from 'next/link';
import { Bag, Bell, Search, User } from './Icons';
import { BagCount } from './BagCount';
import { Countdown } from './Countdown';
import { Logo } from './Logo';

export interface HeaderDrop {
  live: boolean;
  topic: string;
  locksAt: string;
}

export function Header({ signedIn, handle, isAdmin, isArtist, unread, drop, backerPrice, categories }: {
  signedIn: boolean; handle?: string; isAdmin: boolean; isArtist: boolean; unread: number;
  drop?: HeaderDrop | null; backerPrice?: number; categories?: string[];
}) {
  return (
    <header className="bg-white">
      <OfferStrip drop={drop} backerPrice={backerPrice} />
      <div className="container-page h-[60px] md:h-[72px] flex items-center gap-4 md:gap-9">
        <Logo />
        <Link href="/search" className="hidden md:flex flex-1 max-w-[540px] mx-auto h-[42px] items-center gap-2.5 rounded-[9px] border border-[#D8D8D2] bg-soft px-3.5 text-[#777] text-sm hover:border-ink">
          <Search size={18} />
          <span className="flex-1">Search designs, artists, topics</span>
        </Link>
        <div className="ml-auto md:ml-0 flex items-center gap-1 md:gap-3">
          <Link href="/search" aria-label="Search" className="md:hidden p-2"><Search size={21} /></Link>
          {signedIn && (
            <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative p-2">
              <Bell size={21} />
              {unread > 0 && (
                <em className="absolute right-0.5 top-0.5 min-w-[17px] h-[17px] px-1 rounded-full bg-red text-white text-[9px] not-italic font-extrabold grid place-items-center">
                  {unread > 9 ? '9+' : unread}
                </em>
              )}
            </Link>
          )}
          <Link href={signedIn ? '/me' : '/signin'} aria-label={signedIn ? `Your account, @${handle}` : 'Sign in'} className="p-2 flex items-center gap-2">
            <User size={21} />
            <span className="hidden lg:inline text-[13px] font-bold">{signedIn ? `@${handle}` : 'Sign in'}</span>
          </Link>
          <Link href="/bag" aria-label="Bag" className="relative p-2">
            <Bag size={21} />
            <BagCount bare />
          </Link>
        </div>
      </div>
      <nav aria-label="Primary" className="hidden md:flex h-[44px] border-t border-line items-center justify-center gap-10 text-[13px] font-bold">
        <Link href="/shop" className="hover:underline underline-offset-4">Shop</Link>
        <Link href="/shop?view=winners" className="hover:underline underline-offset-4">New Winners</Link>
        <Link href="/#board" className="flex items-center gap-2 hover:underline underline-offset-4"><i className="live-dot" /> Live Battle</Link>
        <Link href="/topics" className="hover:underline underline-offset-4">Topics</Link>
        <Link href="/artists" className="hover:underline underline-offset-4">Artists</Link>
        <Link href="/pulse" className="hover:underline underline-offset-4">The Pulse</Link>
        {isArtist && <Link href="/studio" className="hover:underline underline-offset-4">Studio</Link>}
        {isAdmin && <Link href="/admin" className="text-red hover:underline underline-offset-4">Admin</Link>}
        <Link href="/submit" className="btn-pink !min-h-[32px] !px-3.5 !text-[12px]">Submit Design</Link>
      </nav>
      {categories && categories.length > 0 && (
        <div className="h-[38px] bg-ink text-white flex items-center md:justify-center gap-7 md:gap-9 overflow-x-auto no-scrollbar px-4 text-[11px] font-semibold whitespace-nowrap">
          {categories.map((c) => (
            <Link key={c} href={`/shop?cat=${encodeURIComponent(c)}`} className="hover:text-yellow">{c}</Link>
          ))}
          <Link href="/shop?view=winners" className="text-yellow">Printed winners</Link>
        </div>
      )}
    </header>
  );
}

function OfferStrip({ drop, backerPrice }: { drop?: HeaderDrop | null; backerPrice?: number }) {
  const price = backerPrice ? `₹${backerPrice.toLocaleString('en-IN')}` : 'the backer price';
  const items = (
    <>
      {drop?.live ? (
        <span>LIVE: {drop.topic} voting closes in <Countdown to={drop.locksAt} inline /></span>
      ) : (
        <span>NEW TOPIC EVERY MONDAY, 10 AM</span>
      )}
      <b className="mx-5">·</b>
      <span>Back at {price}, pay only if it prints</span>
      <b className="mx-5">·</b>
      <span>Top 3 print every Friday</span>
      <b className="mx-5">·</b>
      <span>Free shipping across India</span>
      <b className="mx-5">·</b>
      <span>15% of every tee goes to the artist</span>
      <b className="mx-5">·</b>
    </>
  );
  return (
    <div className="h-[34px] bg-yellow flex items-center overflow-hidden text-[12px] font-bold whitespace-nowrap" aria-label="Offers">
      <div className="flex min-w-max animate-tick">
        <span className="flex">{items}</span>
        <span className="flex" aria-hidden>{items}</span>
      </div>
    </div>
  );
}
