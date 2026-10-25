import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStoreSession } from '@/lib/dnd/session';

export const dynamic = 'force-dynamic';

export type ArtistDashboard = {
  name: string;
  designs: { id: string; slug: string; title: string; drop: number | null; status: string; votes: number; sold: number; earned: number; thumb: string; at: number }[];
  lifetime: number; lifetimeTees: number; thisMonth: number; lastMonth: number; nextPayout: number;
  months: { label: string; tees: number; amount: number }[];
  payouts: { at: number; amount: number; utr: string | null }[];
};

const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' });
const ym = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);

/** The signed-in artist's designs, earnings and payouts. */
export async function GET() {
  const session = await getStoreSession();
  if (!session) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  const db = createClient();
  const [profile, designs, earnings, payouts] = await Promise.all([
    db.from('profiles').select('name, handle').eq('id', session.id).single(),
    db.from('designs').select('id, slug, name, status, vote_count, photo_urls, mockup_url, art_front_url, created_at, drop:drops!designs_drop_id_fkey(number), topic:drops!designs_submitted_for_fkey(number)')
      .eq('artist_id', session.id).neq('status', 'withdrawn').order('created_at', { ascending: false }),
    db.from('artist_earnings').select('design_id, amount, status, created_at, item:order_items(qty)').eq('artist_id', session.id).neq('status', 'void'),
    db.from('artist_payouts').select('amount, utr, paid_at').eq('artist_id', session.id).order('paid_at', { ascending: false }),
  ]);

  type E = { design_id: string; amount: number; status: string; created_at: string; item: { qty: number } | null };
  const rows = (earnings.data ?? []) as unknown as E[];
  const now = new Date();
  const thisYm = ym(now);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 15);
    const inMonth = rows.filter((r) => ym(new Date(r.created_at)) === ym(d));
    return { label: MONTH.format(d), tees: inMonth.reduce((n, r) => n + (r.item?.qty ?? 1), 0), amount: inMonth.reduce((n, r) => n + r.amount, 0) };
  });
  const byDesign = new Map<string, { sold: number; earned: number }>();
  for (const r of rows) {
    const x = byDesign.get(r.design_id) ?? { sold: 0, earned: 0 };
    byDesign.set(r.design_id, { sold: x.sold + (r.item?.qty ?? 1), earned: x.earned + r.amount });
  }

  const body: ArtistDashboard = {
    name: profile.data?.name ?? profile.data?.handle ?? 'Artist',
    designs: ((designs.data ?? []) as unknown as {
      id: string; slug: string; name: string; status: string; vote_count: number; photo_urls: string[]; mockup_url: string | null; art_front_url: string;
      created_at: string; drop: { number: number } | null; topic: { number: number } | null;
    }[]).map((d) => ({
      id: d.id, slug: d.slug, title: d.name, drop: d.drop?.number ?? d.topic?.number ?? null, status: d.status, votes: d.vote_count,
      sold: byDesign.get(d.id)?.sold ?? 0, earned: byDesign.get(d.id)?.earned ?? 0,
      thumb: d.photo_urls[0] ?? d.mockup_url ?? d.art_front_url, at: new Date(d.created_at).getTime(),
    })),
    lifetime: rows.reduce((n, r) => n + r.amount, 0),
    lifetimeTees: rows.reduce((n, r) => n + (r.item?.qty ?? 1), 0),
    thisMonth: rows.filter((r) => ym(new Date(r.created_at)) === thisYm).reduce((n, r) => n + r.amount, 0),
    lastMonth: rows.filter((r) => ym(new Date(r.created_at)) === ym(last)).reduce((n, r) => n + r.amount, 0),
    nextPayout: rows.filter((r) => r.status === 'pending' || r.status === 'payable').reduce((n, r) => n + r.amount, 0),
    months,
    payouts: ((payouts.data ?? []) as { amount: number; utr: string | null; paid_at: string }[]).map((p) => ({ at: new Date(p.paid_at).getTime(), amount: p.amount, utr: p.utr })),
  };
  return NextResponse.json(body);
}
