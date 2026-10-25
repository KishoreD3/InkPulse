import { NextResponse } from 'next/server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getStoreSession } from '@/lib/dnd/session';
import { COLOURS, type ColourKey } from '@/lib/dnd/catalog';
import type { DbStatus, NotifyPrefs, Note, Order, OrderLine, Pass, PointsEntry, ReturnRequest, Review, State, Submission } from '@/lib/dnd/store';

export const dynamic = 'force-dynamic';

type ItemRow = { id: string; colour: string; size: string; qty: number; unit_price: number; review: Review | Review[] | null; design: { slug: string; name: string; status: string; photo_urls: string[]; mockup_url: string | null; art_front_url: string } | null };
type OrderRow = {
  id: string; number: number; type: 'backing' | 'retail'; status: DbStatus; created_at: string; group_ref: string | null; subtotal: number; discount: number;
  total: number; discount_code: string | null; gift_wrap: boolean; points_redeemed: number; payment_method: string | null; contact_email: string | null;
  ship_to: Record<string, string | null>; drop: { number: number; locks_at: string } | null; items: ItemRow[];
  shipment: { carrier: string | null; awb: string | null; tracking_url: string | null; delivered_at: string | null } | null;
  returns: { kind: ReturnRequest['kind']; status: ReturnRequest['status']; new_size: string | null; created_at: string }[];
};

const colourKey = (name: string): ColourKey => COLOURS.find((c) => c.name === name)?.key ?? 'black';
const DESIGN_STATUS: Record<string, Submission['status']> = {
  draft: 'Submitted', in_review: 'In review', changes_requested: 'Changes requested', approved: 'In review',
  rejected: 'Not selected', live: 'Live', won: 'Winner', lost: 'Not selected', withdrawn: 'Not selected',
};

/** Everything the store shows about the signed-in member. */
export async function GET() {
  const session = await getStoreSession();
  if (!session) return NextResponse.json({ error: 'Sign in.' }, { status: 401 });
  const db = createClient();
  const uid = session.id;

  const [votes, history, wish, follows, reminders, orders, points, profile, priv, address, designs, notes, passes] = await Promise.all([
    db.from('votes').select('design:designs(slug, status)').eq('user_id', uid).is('withdrawn_at', null),
    db.rpc('my_vote_history'),
    db.from('wishlist').select('design:designs(slug)').eq('user_id', uid),
    db.from('follows').select('artist:profiles!follows_artist_id_fkey(handle)').eq('follower_id', uid),
    db.from('topic_reminders').select('drop_id, drop:drops(status)').eq('user_id', uid),
    db.from('orders').select(`id, number, type, status, created_at, group_ref, subtotal, discount, total, discount_code, gift_wrap, points_redeemed,
      payment_method, contact_email, ship_to, drop:drops(number, locks_at),
      items:order_items(id, colour, size, qty, unit_price, review:reviews(rating, fit, body), design:designs(slug, name, status, photo_urls, mockup_url, art_front_url)),
      shipment:shipments(carrier, awb, tracking_url, delivered_at), returns:return_requests(kind, status, new_size, created_at)`).eq('user_id', uid).order('created_at', { ascending: false }).limit(100),
    db.from('points_ledger').select('delta, note, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(200),
    db.from('profiles').select('name, bio, notify').eq('id', uid).single(),
    db.from('profile_private').select('email, phone, payout_upi').eq('id', uid).maybeSingle(),
    db.from('addresses').select('name, phone, line1, line2, city, state, pin').eq('user_id', uid).order('is_default', { ascending: false }).limit(1).maybeSingle(),
    db.from('designs').select('id, name, story, mood, tags, colours, art_front_url, status, created_at, submitted:drops!designs_submitted_for_fkey(number)')
      .eq('artist_id', uid).neq('status', 'withdrawn').order('created_at', { ascending: false }),
    db.from('notifications').select('id, title, body, link, read_at, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
    // Backer Passes still to use. Codes are server-only, so read them with the service role, for this member only.
    createAdminClient().from('discount_codes').select('code, value, expires_at, redemptions:discount_redemptions(order_id)')
      .eq('owner_id', uid).eq('note', 'Backer Pass').eq('active', true).gt('expires_at', new Date().toISOString()),
  ]);

  const slugs = (rows: unknown, key: 'design' | 'artist', field: 'slug' | 'handle') =>
    ((rows ?? []) as Record<string, Record<string, string> | null>[]).map((r) => r[key]?.[field]).filter(Boolean) as string[];

  // One checkout can create several orders (each backing is its own); show them as one.
  const groups = new Map<string, OrderRow[]>();
  for (const o of (orders.data ?? []) as unknown as OrderRow[]) {
    const ref = o.group_ref ?? `DND-${20000 + o.number}`;
    groups.set(ref, [...(groups.get(ref) ?? []), o]);
  }
  const myOrders: Order[] = Array.from(groups, ([ref, rows]) => {
    const first = rows[rows.length - 1];
    const retail = rows.filter((r) => r.type === 'retail');
    const backing = rows.filter((r) => r.type === 'backing');
    const lines: OrderLine[] = rows.flatMap((r) => r.items.map((i) => ({
      key: i.id, kind: r.type === 'backing' ? 'back' as const : 'buy' as const, id: i.design?.slug ?? '', size: i.size, colour: colourKey(i.colour), qty: i.qty,
      name: i.design?.name ?? 'Design', image: i.design?.mockup_url ?? i.design?.photo_urls?.[0] ?? i.design?.art_front_url ?? '', unit: i.unit_price,
      drop: r.drop?.number, closesAt: r.drop ? new Date(r.drop.locks_at).getTime() : undefined, status: r.status,
      outcome: i.design?.status === 'won' && r.type === 'backing' ? 'won' as const : i.design?.status === 'lost' && r.type === 'backing' ? 'lost' as const : undefined,
      orderUuid: r.id, review: (Array.isArray(i.review) ? i.review[0] : i.review) ?? null,
    })));
    const ship = first.ship_to;
    const shipment = rows.map((r) => r.shipment).find((s) => s?.awb);
    const payNow = retail.reduce((n, r) => n + r.total, 0);
    return {
      id: ref, createdAt: new Date(first.created_at).getTime(), lines,
      merch: retail.reduce((n, r) => n + r.subtotal, 0), discount: retail.reduce((n, r) => n + r.discount - r.points_redeemed, 0),
      reward: retail.reduce((n, r) => n + (r.points_redeemed > 0 ? r.points_redeemed : 0), 0), payNow,
      holds: backing.reduce((n, r) => n + r.total, 0), coupon: retail.find((r) => r.discount_code)?.discount_code ?? null,
      giftWrap: rows.some((r) => r.gift_wrap), payment: first.payment_method ?? 'Test payment',
      contact: { name: ship.name ?? '', email: first.contact_email ?? '', phone: ship.phone ?? '' },
      address: { name: ship.name ?? '', line1: ship.line1 ?? '', line2: ship.line2 ?? '', city: ship.city ?? '', state: ship.state ?? '', pin: ship.pin ?? '' },
      points: Math.floor(payNow / 10),
      tracking: shipment ? { carrier: shipment.carrier, awb: shipment.awb, url: shipment.tracking_url } : null,
      deliveredAt: (() => { const d = rows.map((r) => r.shipment?.delivered_at).find(Boolean); return d ? new Date(d).getTime() : null; })(),
      returns: rows.flatMap((r) => (r.returns ?? []).map((x) => ({ kind: x.kind, status: x.status, newSize: x.new_size, at: new Date(x.created_at).getTime() }))),
    };
  });

  const ledger = (points.data ?? []) as { delta: number; note: string; created_at: string }[];
  const pointsLog: PointsEntry[] = ledger.map((p) => ({ at: new Date(p.created_at).getTime(), delta: p.delta, note: p.note }));
  const h = (history.data as { votes: number; battles: number }[] | null)?.[0];
  const myVotes = ((votes.data ?? []) as unknown as { design: { slug: string; status: string } | null }[]);
  const liveVotes = myVotes.filter((v) => v.design?.status === 'live').map((v) => v.design!.slug);
  const a = address.data as Record<string, string | null> | null;
  const p = priv.data as { email: string | null; phone: string | null; payout_upi: string | null } | null;

  const submissions: Submission[] = ((designs.data ?? []) as unknown as {
    id: string; name: string; story: string | null; mood: string | null; tags: string[]; colours: { name: string }[]; art_front_url: string;
    status: string; created_at: string; submitted: { number: number } | null;
  }[]).map((d) => ({
    id: d.id, createdAt: new Date(d.created_at).getTime(), title: d.name, mood: d.mood ?? '', story: d.story ?? '', tags: d.tags.join(', '),
    colours: d.colours.map((c) => colourKey(c.name)), image: d.art_front_url, fileName: null, drop: d.submitted?.number ?? 0,
    status: DESIGN_STATUS[d.status] ?? 'Submitted',
  }));

  const body: Partial<State> = {
    votes: liveVotes,
    pastVotes: Math.max(0, (h?.votes ?? 0) - liveVotes.length),
    pastBattles: h?.battles ?? 0,
    wishlist: slugs(wish.data, 'design', 'slug'),
    follows: slugs(follows.data, 'artist', 'handle'),
    reminders: ((reminders.data ?? []) as unknown as { drop: { status: string } | null }[]).some((r) => r.drop?.status === 'scheduled') ? ['next-topic'] : [],
    orders: myOrders,
    points: ledger.reduce((n, x) => n + x.delta, 0),
    pointsLog,
    contact: { name: profile.data?.name ?? a?.name ?? '', email: p?.email ?? session.email ?? '', phone: p?.phone ? `+${p.phone.replace(/^\+/, '')}` : a?.phone ?? '' },
    address: a
      ? { name: a.name ?? '', line1: a.line1 ?? '', line2: a.line2 ?? '', city: a.city ?? '', state: a.state ?? '', pin: a.pin ?? '' }
      : { name: profile.data?.name ?? '', line1: '', line2: '', city: '', state: '', pin: '' },
    submissions,
    payoutUpi: p?.payout_upi ?? '',
    artistBio: profile.data?.bio ?? '',
    notify: ((profile.data as { notify?: NotifyPrefs } | null)?.notify) ?? { push: true, email: true, whatsapp: true },
    passes: ((passes.data ?? []) as { code: string; value: number; expires_at: string; redemptions: unknown[] }[])
      .filter((x) => !x.redemptions?.length)
      .map((x): Pass => ({ code: x.code, value: x.value, expiresAt: new Date(x.expires_at).getTime() })),
    notifications: ((notes.data ?? []) as { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }[])
      .map((n): Note => ({ id: n.id, title: n.title, body: n.body, link: n.link, at: new Date(n.created_at).getTime(), read: Boolean(n.read_at) })),
  };
  return NextResponse.json(body);
}
