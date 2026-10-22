import Link from 'next/link';

/** INK in a black block, PULSE in ink, a yellow dot after: the wordmark from the Figma Make theme. */
export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <Link href="/" aria-label="INKPULSE home" className={`relative inline-flex w-fit items-center text-[19px] md:text-[22px] font-black tracking-[-0.06em] leading-none ${className}`}>
      <span className={`px-[3px] pl-[6px] py-[4px] mr-[3px] ${light ? 'bg-white text-ink' : 'bg-ink text-white'}`}>INK</span>
      <span className={light ? 'text-white' : 'text-ink'}>PULSE</span>
      <i aria-hidden className="absolute -right-[10px] top-0 w-1.5 h-1.5 rounded-full bg-yellow" />
    </Link>
  );
}
