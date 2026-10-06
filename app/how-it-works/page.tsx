import Link from 'next/link';
import { getSettings } from '@/lib/data';
import { inr } from '@/lib/format';
import { HowItWorksStrip, ArtistPanel } from '@/components/Panels';

export const metadata = { title: 'How it works' };
export const dynamic = 'force-dynamic';

export default async function HowItWorks() {
  const s = await getSettings();
  const faqs: [string, string][] = [
    ['When am I charged?', `When you back a design we reserve ${inr(s.backer_price)} with UPI AutoPay (or a card hold). It is debited only if the design finishes in the top ${s.winners_per_drop} when voting locks on Thursday. If it does not, nothing is debited and your bank releases the reservation.`],
    ['Why no cash on delivery?', 'We print only what is already paid for. That is how there is no unsold stock, and why early backers get a better price.'],
    ['What is the early-backer price?', `Back a design before it reaches ${s.backer_threshold.toLocaleString('en-IN')} votes and you lock ${inr(s.backer_price)}. After that, and after the drop, it costs ${inr(s.retail_price)}.`],
    ['How do causes work?', `${s.cause_pct_of_profit}% of our net profit from every drop goes to a cause the community votes on. Every payout is published with its bank reference on the Causes page.`],
    ['Who can vote?', 'Anyone with a verified Indian mobile number. One person, one vote per design. Votes are rate-limited and checked for abuse.'],
    ['What about sizes and returns?', 'Oversized 240 GSM cotton tees. Each shirt is printed to order, so we exchange sizes and replace defects — see Shipping & returns.'],
  ];
  return (
    <>
      <div className="container-page py-10 max-w-3xl">
        <h1 className="h-display text-[clamp(52px,8vw,96px)] leading-[0.9] misprint">How it<br />works</h1>
        <p className="pt-4 text-lg text-body">A new drop every Monday. Voting locks Thursday. The top {s.winners_per_drop} print Friday. Nothing is printed until it is paid for.</p>
      </div>
      <HowItWorksStrip backerPrice={s.backer_price} retailPrice={s.retail_price} winners={s.winners_per_drop} />
      <div className="container-page py-10 max-w-3xl flex flex-col gap-3">
        {faqs.map(([q, a]) => (
          <details key={q} className="card p-4 group">
            <summary className="font-display text-xl uppercase cursor-pointer list-none flex justify-between">{q}<span className="group-open:rotate-45 transition-transform">+</span></summary>
            <p className="pt-2 text-body leading-relaxed">{a}</p>
          </details>
        ))}
        <Link href="/" className="btn-pink self-start mt-4">See the live drop</Link>
      </div>
      <ArtistPanel />
    </>
  );
}
