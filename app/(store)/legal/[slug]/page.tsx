import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SIZE_CHART } from '@/lib/dnd/catalog';

// Starter drafts so the links work and cover how the store actually behaves. Have a lawyer adapt
// them to your entity before launch. Fill BUSINESS from your registration documents: Indian
// e-commerce rules ask for the seller's name, address, GSTIN and a grievance officer on the site.
const BUSINESS = {
  name: process.env.NEXT_PUBLIC_BUSINESS_NAME || '[Registered business name]',
  address: process.env.NEXT_PUBLIC_BUSINESS_ADDRESS || '[Registered address]',
  gstin: process.env.NEXT_PUBLIC_BUSINESS_GSTIN || '[GSTIN]',
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'hello@thedndclub.in',
  grievance: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER || '[Grievance officer name]',
};

const DOCS: Record<string, { title: string; body: string[] }> = {
  terms: {
    title: 'Terms of use',
    body: [
      '[DRAFT — replace with lawyer-reviewed terms for your registered entity.]',
      `The DND Club is run by ${BUSINESS.name}, ${BUSINESS.address} (GSTIN ${BUSINESS.gstin}). By using the store you agree to these terms.`,
      'Accounts: you sign in with your mobile number, Google or email. Voting needs a verified Indian mobile number. One person, one account.',
      'Voting: one vote per design per account. Votes can be withdrawn until voting locks on Thursday at 9 PM IST. We may remove votes and suspend accounts involved in fake accounts, bots or paid voting.',
      'Backing: backing a finalist places a hold for the backer price shown. The hold is charged only if the design finishes in the winning positions when voting locks. Otherwise it is released and you receive a Backer Pass: a one-time code, valid for 48 hours, to buy any current winner at the backer price.',
      'Prices include GST. Tees are printed to order after each drop, so delivery dates start from the print day.',
      'Club points: you earn points on paid orders and can redeem them as shown at checkout. Points have no cash value, are removed if the order is refunded, and may expire or change with notice.',
      'Invites: if a friend joins with your link and pays for their first order, you receive a one-time discount code. Self-referrals and duplicate accounts are not eligible.',
      'Reviews: only buyers of a delivered tee can review it. We may hide reviews that are abusive, off-topic or not about the product.',
      `Questions and complaints: write to ${BUSINESS.email}. Grievance officer: ${BUSINESS.grievance}, ${BUSINESS.email}. We acknowledge complaints within 48 hours and resolve them within one month.`,
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: [
      '[DRAFT — replace with a policy compliant with the Digital Personal Data Protection Act, 2023.]',
      `${BUSINESS.name} is responsible for your personal data on The DND Club.`,
      'What we collect: your mobile number and email (to sign you in and verify votes), your name and delivery address (to ship orders), your votes, backings, orders, reviews and wishlist, and payment references from our payment gateway. We never see or store card or UPI credentials.',
      'Why: to run the battle fairly, deliver your orders, send the alerts you choose (push, email, WhatsApp; change them in Account → Notifications), pay artists, and prevent fraud.',
      'Who we share with: our hosting and database providers, the payment gateway, our print partner and courier (name, address and phone, only for your order), and messaging providers for the alerts you turned on. We do not sell your data.',
      'Artists see sales counts and ratings for their designs, never buyers’ contact details.',
      `Your rights: you can ask for a copy of your data, a correction, or deletion of your account by writing to ${BUSINESS.email}. Order records are kept as long as tax law requires.`,
    ],
  },
  'artist-terms': {
    title: 'Artist terms',
    body: [
      '[DRAFT — replace with lawyer-reviewed artist agreement.]',
      'You confirm every submission is your original work and does not infringe anyone’s copyright or trademark. No fan art, no AI-generated art, no third-party IP. Submissions are reviewed before they go live, and we may decline any design.',
      'You keep ownership of your artwork and grant The DND Club a non-exclusive licence to print and sell it on apparel for the drop and while it is on sale, and to show it in the store and our marketing with credit to you.',
      'You earn the artist share shown in the store (currently 15%) of the price of every tee sold with your design, paid monthly after the return window to your verified payout account. Payouts may need PAN and KYC under Indian tax law.',
      'If a design is found to infringe someone’s rights, we will take it down and may withhold earnings on it.',
    ],
  },
  'shipping-returns': {
    title: 'Shipping & exchanges',
    body: [
      '[DRAFT — set your actual courier timelines and policy.]',
      'Winning designs print on Friday and ship within 5–7 working days. Retail orders ship with the next print batch. Shipping is free across India. You get a tracking link as soon as the parcel moves.',
      'Because every tee is printed to order, we offer one free size exchange within 7 days of delivery. Ask from your order page; keep the tag on and we pick the old tee up when the new one arrives.',
      'Damaged, misprinted or wrong items are replaced or refunded in full. Add a photo when you ask from your order page.',
      'Cancellations: retail orders can be cancelled until they go to print. Backing holds are released automatically if the design does not win.',
      'Refunds go back to the original payment method within 5–7 working days of approval.',
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
      `Questions about an order, a backing or your art? Write to ${BUSINESS.email} with your order number (it starts with DND-).`,
      'We reply within one working day, Monday to Saturday.',
      `${BUSINESS.name} · ${BUSINESS.address} · GSTIN ${BUSINESS.gstin}`,
      `Grievance officer: ${BUSINESS.grievance} · ${BUSINESS.email}`,
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
