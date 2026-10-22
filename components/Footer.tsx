import Link from 'next/link';
import { Logo } from './Logo';
import { Bolt, Heart, Shield, Truck } from './Icons';

const COLUMNS: [string, [string, string][]][] = [
  ['SHOP', [['Shop all', '/shop'], ['Printed winners', '/shop?view=winners'], ['Live finalists', '/shop?view=live'], ['Past drops', '/drops']]],
  ['BATTLES', [['Vote now', '/#board'], ['Topics', '/topics'], ['How it works', '/how-it-works'], ['The Pulse', '/pulse']]],
  ['HELP', [['My orders', '/orders'], ['Size guide', '/legal/size-guide'], ['Shipping & returns', '/legal/shipping-returns'], ['Privacy', '/legal/privacy'], ['Terms', '/legal/terms']]],
  ['ARTISTS', [['Meet the artists', '/artists'], ['Submit a design', '/submit'], ['Artist terms', '/legal/artist-terms'], ['Artist studio', '/studio']]],
];

export function Footer() {
  return (
    <footer className="bg-[#171815] text-white mt-16">
      <div className="container-page">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 py-6 border-b border-white/10 text-[12px] font-semibold text-white/80">
          <span className="flex items-center gap-2"><Truck size={18} /> Free shipping across India</span>
          <span className="flex items-center gap-2"><Shield size={18} /> Secure UPI &amp; card checkout</span>
          <span className="flex items-center gap-2"><Bolt size={18} /> Printed to order</span>
          <span className="flex items-center gap-2"><Heart size={18} /> 15% to the artist</span>
        </div>
        <div className="grid gap-8 py-12 grid-cols-2 md:grid-cols-[2fr_repeat(4,1fr)]">
          <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
            <Logo light />
            <p className="text-[13px] leading-relaxed text-[#96978F] max-w-[260px]">Original Indian art, chosen by the community. Printed in Tamil Nadu.</p>
          </div>
          {COLUMNS.map(([head, links]) => (
            <nav key={head} aria-label={head} className="flex flex-col gap-2.5">
              <b className="text-[10px] tracking-[0.12em] text-[#77786F] pb-1">{head}</b>
              {links.map(([label, href]) => (
                <Link key={href} href={href} className="text-[13px] text-[#C9CAC4] hover:text-white">{label}</Link>
              ))}
            </nav>
          ))}
        </div>
        <div className="border-t border-white/10 py-5 flex flex-wrap gap-3 justify-between text-[11px] text-[#77786F]">
          <span>UPI · RuPay · Visa · Mastercard</span>
          <span>© {new Date().getFullYear()} INKPULSE · Made for India</span>
        </div>
      </div>
    </footer>
  );
}
