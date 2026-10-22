import Link from 'next/link';
import { Tee } from './Tee';
import { colourway, tileFor } from '@/lib/colourway';
import { inr, num } from '@/lib/format';
import type { DesignWithArtist } from '@/lib/types';

/** Percent saved vs the retail price, rounded the way Indian stores show it. */
export const pctOff = (price: number, mrp: number) => (mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

/** The product photo slot: a soft studio backdrop with the tee mockup. 4:5 like a store photo. */
export function TeeTile({ d, className = '', children }: { d: DesignWithArtist | { slug: string; colours: DesignWithArtist['colours']; art_front_url: string }; className?: string; children?: React.ReactNode }) {
  const c = colourway(d);
  const t = tileFor(d.slug);
  return (
    <div className={`relative aspect-[4/5] rounded-[10px] overflow-hidden grid place-items-center ${className}`} style={{ backgroundColor: t.bg }}>
      <Tee shirt={c.hex} art={c.art} size="86%" className="transition-transform duration-300 group-hover:scale-[1.03]" />
      {children}
    </div>
  );
}

/**
 * Store card for a design.
 * - `price` + `mrp` show the yellow-store price row (₹899 ~~₹1,099~~ 18% OFF).
 * - `badge` is the top-left tag; `live` makes it red.
 */
export function ProductCard({ d, price, mrp, badge, live = false, meta }: {
  d: DesignWithArtist; price?: number | null; mrp?: number; badge?: string; live?: boolean; meta?: React.ReactNode;
}) {
  const off = price && mrp ? pctOff(price, mrp) : 0;
  return (
    <article className="group min-w-0">
      <Link href={`/d/${d.slug}`} aria-label={`${d.name} by @${d.artist?.handle}`}>
        <TeeTile d={d}>
          {badge && <span className={live ? 'badge-red' : 'badge'}>{badge}</span>}
        </TeeTile>
      </Link>
      <div className="pt-2.5 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/d/${d.slug}`} className="font-bold text-[14px] leading-snug truncate">{d.name}</Link>
          {d.vote_count > 0 && (
            <span className="shrink-0 rounded bg-green-soft text-green text-[10px] font-extrabold px-1.5 py-0.5">{num(d.vote_count)} votes</span>
          )}
        </div>
        <Link href={`/a/${d.artist?.handle}`} className="block text-[12px] text-muted pt-0.5 truncate">by @{d.artist?.handle} · {d.category}</Link>
        {price ? (
          <p className="pt-1.5 flex items-baseline gap-1.5">
            <strong className="text-[15px]">{inr(price)}</strong>
            {off > 0 && mrp && <><s className="text-[12px] text-[#8B8C87]">{inr(mrp)}</s><span className="price-off">{off}% OFF</span></>}
          </p>
        ) : null}
        {meta}
      </div>
    </article>
  );
}

/** Section heading used across the store: small grey eyebrow, bold title, optional link on the right. */
export function SectionHead({ eyebrow, title, href, action, dark = false }: { eyebrow?: string; title: React.ReactNode; href?: string; action?: string; dark?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        {eyebrow && <p className={`eyebrow pb-2 ${dark ? '!text-[#B9BAB4]' : ''}`}>{eyebrow}</p>}
        <h2 className={`text-[26px] md:text-[30px] font-extrabold tracking-[-0.03em] leading-none ${dark ? 'text-white' : ''}`}>{title}</h2>
      </div>
      {href && action && (
        <Link href={href} className={`shrink-0 text-[13px] font-extrabold flex items-center gap-1 hover:underline ${dark ? 'text-white' : ''}`}>{action} →</Link>
      )}
    </div>
  );
}

/** The five store promises, as a bordered strip. */
export function TrustStrip() {
  const items = ['Printed to order', '7-day size exchange', 'Free shipping', 'UPI & cards', '15% to artists'];
  return (
    <section aria-label="Why INKPULSE" className="container-page">
      <ul className="grid grid-cols-2 md:grid-cols-5 border border-line rounded-[10px] py-5 gap-y-3">
        {items.map((t, i) => (
          <li key={t} className={`flex items-center justify-center gap-2 text-[12px] font-bold ${i < items.length - 1 ? 'md:border-r border-line' : ''}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-yellow" aria-hidden /> {t}
          </li>
        ))}
      </ul>
    </section>
  );
}
