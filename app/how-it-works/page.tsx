import Link from 'next/link';
import { getSettings } from '@/lib/data';
import { inr } from '@/lib/format';
import { HowItWorksStrip, ArtistPanel, CycleRhythm } from '@/components/Panels';

export const metadata = { title: 'How it works' };
export const dynamic = 'force-dynamic';

export default async function HowItWorks() {
  const s = await getSettings();
  const faqs: [string, string][] = [
    ['What is a topic?', `Every Monday at ${s.topic_time.slice(0, 5)} IST we publish a topic — a theme with a short brief. Artists have until Wednesday of the following week (about ${s.topic_lead_days - s.review_days - 2} days, two weekends) to submit up to ${s.max_designs_per_artist} designs each. We review them for originality over the next ${s.review_days} days, and the approved ones go up for voting the Monday after.`],
    ['Why two weeks between a topic and the vote?', 'Good art takes time. Two weekends to make something, a few days for us to check every entry is original, and a full Monday-to-Thursday vote — while a new topic, a new vote and a new print run happen every single week.'],
    ['When am I charged?', `When you back a design we reserve ${inr(s.backer_price)} with UPI AutoPay (or a card hold). It is debited only if the design finishes in the top ${s.winners_per_drop} when voting locks on Thursday. If it does not, nothing is debited and your bank releases the reservation.`],
    ['Why no cash on delivery?', 'We print only what is already paid for. That is how there is no unsold stock, and why early backers get a better price.'],
    ['What is the early-backer price?', `Back a design before it reaches ${s.backer_threshold.toLocaleString('en-IN')} votes and you lock ${inr(s.backer_price)}. After that, and after the drop, it costs ${inr(s.retail_price)}.`],
    ['How do artists get paid?', `The artist earns ${s.artist_pct}% of every tee sold (price before GST) — the winning run, the retail window after it, and any back-by-demand reprint. Earnings show in their studio and are paid out to their UPI or bank account.`],
    ['Who chooses what gets printed?', `You do. No buyer or brand picks the designs — the top ${s.winners_per_drop} by votes each week print. We only review submissions for stolen art and IP before they go live.`],
    ['Who can vote?', 'Anyone with a verified Indian mobile number. One person, one vote per design. Votes are rate-limited and checked for abuse.'],
    ['What about sizes and returns?', 'Oversized 240 GSM cotton tees. Each shirt is printed to order, so we exchange sizes and replace defects — see Shipping & returns.'],
  ];
  return (
    <>
      <div className="container-page py-10 max-w-3xl">
        <h1 className="h-display text-[clamp(52px,8vw,96px)] leading-[0.9] misprint">How it<br />works</h1>
        <p className="pt-4 text-lg text-body">A new topic every Monday. Artists answer it, we review, you vote Monday to Thursday, and the top {s.winners_per_drop} print Friday. Nothing is printed until it is paid for.</p>
      </div>
      <HowItWorksStrip backerPrice={s.backer_price} retailPrice={s.retail_price} winners={s.winners_per_drop} artistPct={s.artist_pct} />
      <div className="container-page pt-10 max-w-4xl flex flex-col gap-3">
        <h2 className="h-display text-4xl">The weekly rhythm</h2>
        <p className="text-body">Every week, one drop is being voted on, the next is in review, and a fresh topic has just gone out. <Link href="/topics" className="underline font-bold">See this week&apos;s topics</Link>.</p>
        <CycleRhythm reviewDays={s.review_days} />
      </div>
      <div className="container-page py-10 max-w-3xl flex flex-col gap-3">
        {faqs.map(([q, a]) => (
          <details key={q} className="card p-4 group">
            <summary className="font-display text-xl uppercase cursor-pointer list-none flex justify-between">{q}<span className="group-open:rotate-45 transition-transform">+</span></summary>
            <p className="pt-2 text-body leading-relaxed">{a}</p>
          </details>
        ))}
        <Link href="/" className="btn-pink self-start mt-4">See the live drop</Link>
      </div>
      <ArtistPanel artistPct={s.artist_pct} />
    </>
  );
}
