import { notFound } from 'next/navigation';

// Starter drafts so the links work. Have a lawyer adapt these to your entity before launch.
const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of use',
    body: [
      '[DRAFT — replace with lawyer-reviewed terms for your registered entity.]',
      'Backing a design reserves the displayed amount through UPI AutoPay or a card hold. The amount is debited only if the design finishes within the winning positions when voting locks. Otherwise nothing is debited and the reservation is released by your bank.',
      'Votes are limited to one per verified mobile number per design. We may remove votes and accounts involved in manipulation.',
      'Products are printed to order. Delivery estimates start after the print day of each drop.',
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      '[DRAFT — replace with a policy compliant with the Digital Personal Data Protection Act, 2023.]',
      'We collect your mobile number to verify votes, your delivery address to ship orders, and payment references from our payment gateway. We do not store card or UPI credentials.',
      'You can download or delete your data by writing to our support email.',
    ],
  },
  'artist-terms': {
    title: 'Artist terms',
    body: [
      '[DRAFT — replace with lawyer-reviewed artist agreement.]',
      'You confirm every submission is your original work and does not infringe anyone’s copyright or trademark. Submissions are reviewed before they go live.',
      'You keep ownership of your artwork and grant INKPULSE a licence to print and sell it on apparel for the drop and its retail window.',
      'You earn the published artist share of net sale price on every winning shirt sold, paid after the return window, to your verified payout account.',
    ],
  },
  'shipping-returns': {
    title: 'Shipping & returns',
    body: [
      '[DRAFT — set your actual courier timelines and policy.]',
      'Winning designs print on Friday and ship within [N] working days. Retail orders ship with the next print batch.',
      'Because every shirt is printed to order, we offer a one-time size exchange within [7] days of delivery and replace any misprint or defect.',
    ],
  },
  'size-guide': {
    title: 'Size guide',
    body: [
      'Oversized fit, 240 GSM cotton. Measurements below are placeholders — replace them with your print partner’s blank size chart.',
      'S [chest × length] · M [chest × length] · L [chest × length] · XL [chest × length] · XXL [chest × length]',
    ],
  },
};

export const dynamic = 'force-dynamic';

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = DOCS[params.slug];
  if (!doc) notFound();
  return (
    <article className="container-page py-10 max-w-2xl flex flex-col gap-4">
      <h1 className="h-display text-[44px] misprint">{doc.title}</h1>
      {doc.body.map((p, i) => <p key={i} className="leading-relaxed text-body">{p}</p>)}
    </article>
  );
}
