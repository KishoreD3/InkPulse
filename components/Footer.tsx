import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-ink text-haze border-t-2 border-ink mt-16">
      <div className="container-page py-10 flex flex-wrap justify-between gap-6 text-sm">
        <nav aria-label="Footer" className="flex flex-wrap gap-x-7 gap-y-2">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/legal/artist-terms">Artist terms</Link>
          <Link href="/legal/shipping-returns">Shipping &amp; returns</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/drops">Past drops</Link>
        </nav>
        <p className="font-marker text-acid text-base">screen-printed in Tamil Nadu</p>
      </div>
      <div className="container-page pb-8 overflow-hidden whitespace-nowrap font-display leading-[0.85] tracking-[2px]
        text-transparent [-webkit-text-stroke:2px_#FF3EA5] text-[clamp(64px,17vw,236px)]" aria-hidden="true">
        INKPULSE
      </div>
    </footer>
  );
}
