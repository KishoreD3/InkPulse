const inrFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹1,00,000 style. */
export const inr = (n: number) => `₹${inrFormatter.format(Math.round(n))}`;
export const num = (n: number) => inrFormatter.format(n);

const IST = 'Asia/Kolkata';

export const dateShort = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST }).format(new Date(iso));

export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST,
  }).format(new Date(iso)) + ' IST';

export const weekday = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: IST }).format(new Date(iso));

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'NOW';
  if (s < 3600) return `${Math.floor(s / 60)}M`;
  if (s < 86400) return `${Math.floor(s / 3600)}H`;
  if (s < 604800) return `${Math.floor(s / 86400)}D`;
  return dateShort(iso).toUpperCase();
}

export const dropLabel = (n: number) => `DROP ${String(n).padStart(3, '0')}`;

/** Indian GST is included in our prices; extract the tax part. */
export const gstPart = (gross: number, pct: number) => Math.round(gross - gross / (1 + pct / 100));

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting payment',
  backed: 'Backed · reserved',
  won: 'It printed · debited',
  released: "Didn't print · not debited",
  paid: 'Paid',
  printing: 'Printing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
  failed: 'Payment failed',
};

export const DESIGN_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In review',
  changes_requested: 'Changes requested',
  approved: 'Approved · scheduled',
  rejected: 'Rejected',
  live: 'Live',
  won: 'Printed',
  lost: "Didn't make the cut",
  withdrawn: 'Withdrawn',
};

/** ₹ the artist earns on one tee at this price (their % of the price before GST, as the database computes it). */
export function artistCut(price: number, gstPct: number, artistPct: number) {
  return Math.floor((price / (1 + gstPct / 100)) * (artistPct / 100));
}
