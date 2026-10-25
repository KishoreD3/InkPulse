import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SIZE_CHART } from '@/lib/dnd/catalog';

// Starter drafts so the links work. Have a lawyer adapt these to your entity before launch.
const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of use',
    body: [
      '[DRAFT — replace with lawyer-reviewed terms for your registered entity.]',
      'Backing a design reserves the displayed amount through UPI AutoPay or a card hold. The amount is debited only if the design finishes within the winning positions when voting locks on Thursday at 9 PM IST. Otherwise nothing is debited and the reservation is released by your bank.',
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
      'You confirm every submission is your original work and does not infringe anyone’s copyright or trademark. No fan art, no AI-generated art, no third-party IP. Submissions are reviewed before they go live.',
      'You keep ownership of your artwork and grant The DND Club a licence to print and sell it on apparel for the drop and its retail window.',
      'You earn 15% of the price of every tee sold with your design, paid monthly after the return window, to your verified payout account.',
    ],
  },
  'shipping-returns': {
    title: 'Shipping & exchanges',
    body: [
      '[DRAFT — set your actual courier timelines and policy.]',
      'Winning designs print on Friday and ship within 5–7 working days. Retail orders ship with the next print batch. Shipping is free across India.',
      'Because every tee is printed to order, we offer a one-time size exchange within 7 days of delivery and replace any misprint or defect.',
    ],
  },
  'size-guide': {
    title: 'Size guide',
    body: [
      'Measurements in inches, laid flat. 240 GSM combed cotton, pre-shrunk. For an oversized look, pick your usual size.',
      ...SIZE_CHART.map(([s, chest, length, shoulder]) => `${s} · chest ${chest} · length ${length} · shoulder ${shoulder}`),
    ],
  },
  contact: {
    title: 'Contact',
    body: [
      'Questions about an order, a backing or your art? Write to hello@thedndclub.in with your order number (it starts with DND-).',
      'We reply within one working day, Monday to Saturday.',
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  return { title: DOCS[params.slug]?.title };
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const doc = DOCS[params.slug];
  if (!doc) notFound();
  return (
    <article className="page-width legal">
      <p className="eyebrow">THE DND CLUB</p>
      <h1>{doc.title}</h1>
      {doc.body.map((p, i) => <p key={i}>{p}</p>)}
    </article>
  );
}
