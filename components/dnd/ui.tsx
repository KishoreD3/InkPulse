'use client';
import Link from 'next/link';
import { tints } from '@/lib/dnd/catalog';
import { hms, votingClosesAt } from '@/lib/dnd/cycle';
import { useNow } from '@/lib/dnd/store';

export type IconName = 'search' | 'heart' | 'bag' | 'user' | 'home' | 'zap' | 'plus' | 'grid' | 'arrow' | 'check' | 'clock' |
  'truck' | 'shield' | 'star' | 'close' | 'filter' | 'upload' | 'share' | 'pin' | 'card' | 'moon' | 'bell' | 'scissors' | 'trash';

export function Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  const p: Record<IconName, JSX.Element> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    bag: <><path d="M5 8h14l-1 13H6L5 8Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v11h14V10" /></>,
    zap: <path d="m13 2-9 12h8l-1 8 9-12h-8l1-8Z" />,
    plus: <path d="M12 5v14M5 12h14" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    truck: <><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z" /><circle cx="7" cy="19" r="2" /><circle cx="18" cy="19" r="2" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    star: <path d="m12 2 3 6 7 .9-5 4.8 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5-4.8L9 8l3-6Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    filter: <path d="M4 5h16M7 12h10M10 19h4" />,
    upload: <><path d="M12 16V3M7 8l5-5 5 5" /><path d="M4 15v6h16v-6" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    pin: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    card: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></>,
    moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
    bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2z" /><path d="M10 21h4" /><path d="M3 3l18 18" /></>,
    scissors: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M8.5 7.5 20 18M8.5 16.5 20 6" /></>,
    trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  };
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p[name]}</svg>;
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`logo ${light ? 'light' : ''}`} aria-label="The DND Club home">
      <span className="logo-moon"><Icon name="moon" size={18} /></span>
      <span className="logo-the">the</span>
      <span className="logo-dnd">DND</span>
      <span className="logo-club">club</span>
    </Link>
  );
}

export function CareTag({ text, tilt = -3 }: { text: string; tilt?: number }) {
  return <span className="care-tag" style={{ transform: `rotate(${tilt}deg)` }}><i>◯ △ ▢</i>{text}</span>;
}

export function Photo({ src, alt, className = '', tint = 0, eager = false }: { src: string; alt: string; className?: string; tint?: number; eager?: boolean }) {
  return (
    <div className={`photo ${className}`} style={{ background: tints[tint % tints.length] }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} />
    </div>
  );
}

type BtnProps = {
  children: React.ReactNode; onClick?: () => void; href?: string; v?: 'primary' | 'dark' | 'outline' | 'ghost' | 'yellow';
  className?: string; type?: 'button' | 'submit'; disabled?: boolean;
};
export function Btn({ children, onClick, href, v = 'primary', className = '', type = 'button', disabled }: BtnProps) {
  const cls = `btn btn-${v} ${className}`;
  if (href) return <Link href={href} className={cls} onClick={onClick}>{children}</Link>;
  return <button type={type} onClick={onClick} className={cls} disabled={disabled}>{children}</button>;
}

export function SectionHead({ eyebrow, title, action, href, light }: { eyebrow?: string; title: React.ReactNode; action?: string; href?: string; light?: boolean }) {
  return (
    <div className={`section-head ${light ? 'light' : ''}`}>
      <div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div>
      {action && href && <Link className="link" href={href}>{action} <Icon name="arrow" size={16} /></Link>}
    </div>
  );
}

/** Live countdown to `to` (defaults to this week's voting lock). */
export function Countdown({ to }: { to?: number }) {
  const now = useNow(1000);
  if (now == null) return <span className="tabular">--:--:--</span>;
  return <span className="tabular" suppressHydrationWarning>{hms((to ?? votingClosesAt(now)) - now)}</span>;
}

export function Empty({ emoji = '🌙', title, body, children }: { emoji?: string; title: string; body?: string; children?: React.ReactNode }) {
  return <div className="empty"><span>{emoji}</span><h3>{title}</h3>{body && <p className="muted">{body}</p>}{children}</div>;
}

export function Crumbs({ items }: { items: [string, string?][] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {items.map(([label, href], i) => (
        <span key={label}>{i > 0 && ' / '}{href ? <Link href={href}>{label}</Link> : label}</span>
      ))}
    </nav>
  );
}
