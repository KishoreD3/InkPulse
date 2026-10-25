import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getStoreSession } from '@/lib/dnd/session';
import { CodeError, quoteCode } from '@/lib/discounts';
import { gstPart } from '@/lib/format';
import { paymentsMode } from '@/lib/payments/mode';
import type { PriceType, Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PHONE = /^[6-9]\d{9}$/;
const digits = (s: string) => s.replace(/\D/g, '').slice(-10);

const schema = z.object({
  lines: z.array(z.object({
    kind: z.enum(['buy', 'back']), id: z.string().min(2).max(80), size: z.string().min(1).max(4),
    colour: z.string().min(2).max(30), qty: z.number().int().min(1).max(5),
  })).min(1).max(12),
  contact: z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().email(), phone: z.string().trim() }),
  address: z.object({
    name: z.string().trim().min(2).max(80), line1: z.string().trim().min(3).max(120), line2: z.string().trim().max(120).default(''),
    city: z.string().trim().min(2).max(60), state: z.string().trim().min(2).max(60), pin: z.string().trim().regex(/^[1-9]\d{5}$/),
  }),
  coupon: z.string().max(24).nullable().optional(),
  useReward: z.boolean().default(false),
  payment: z.string().max(80).default('Test payment'),
});

type DesignRow = { id: string; slug: string; name: string; drop_id: string | null; colours: { name: string }[]; status: string };

/**
 * Places the bag as orders. Each backing is its own order (one hold per design); everything
 * bought now goes in one retail order. All of them share a DND-xxxxx reference.
 * Test payments only for now: orders are marked as held / paid without a gateway.
 */
export async function POST(request: Request) {
  const session = await getStoreSession();
  if (!session) return NextResponse.json({ error: 'Sign in to place your order.' }, { status: 401 });
  if (paymentsMode() !== 'test') {
    return NextResponse.json({ error: 'Card and UPI payments are being switched on. Please try again soon.' }, { status: 503 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Check your details and try again.' }, { status: 400 });
  const { lines, contact, address, coupon, useReward, payment } = parsed.data;
  const phone = digits(contact.phone);
  if (!PHONE.test(phone)) return NextResponse.json({ error: 'Enter a 10-digit Indian mobile number.' }, { status: 400 });

  const db = createClient();
  const admin = createAdminClient();
  const uid = session.id;
  const { data: s } = await db.from('settings').select('*').single();
  const settings = s as Settings & { reward_points: number; reward_value: number };

  const slugs = Array.from(new Set(lines.map((l) => l.id)));
  const { data: ds } = await db.from('designs').select('id, slug, name, drop_id, colours, status').in('slug', slugs);
  const bySlug = new Map(((ds ?? []) as DesignRow[]).map((d) => [d.slug, d]));

  type Priced = (typeof lines)[number] & { design: DesignRow; price: number; priceType: PriceType };
  const priced: Priced[] = [];
  for (const l of lines) {
    const d = bySlug.get(l.id);
    if (!d) return NextResponse.json({ error: 'A design in your bag is no longer available.' }, { status: 409 });
    if (!settings.sizes.includes(l.size)) return NextResponse.json({ error: `Size ${l.size} isn’t available.` }, { status: 409 });
    if (!d.colours.some((c) => c.name === l.colour)) return NextResponse.json({ error: `${d.name} isn’t made in ${l.colour}.` }, { status: 409 });
    const { data: q } = await db.rpc('price_quote', { p_design: d.id });
    const quote = (q as { price: number; price_type: PriceType; order_type: 'backing' | 'retail' }[] | null)?.[0];
    if (!quote) return NextResponse.json({ error: `${d.name} isn’t on sale right now.` }, { status: 409 });
    if (l.kind === 'back' && quote.order_type !== 'backing') return NextResponse.json({ error: `Voting on ${d.name} has closed, so it can’t be backed.` }, { status: 409 });
    if (l.kind === 'buy' && quote.order_type !== 'retail') return NextResponse.json({ error: `${d.name} is still in the battle. Back it instead.` }, { status: 409 });
    priced.push({ ...l, design: d, price: quote.price, priceType: quote.price_type });
  }

  // Save the delivery address as the member's default.
  const addrRow = { label: 'Home', name: address.name, phone, line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, pin: address.pin };
  const { data: existing } = await db.from('addresses').select('id').eq('user_id', uid).order('is_default', { ascending: false }).limit(1).maybeSingle();
  if (existing) await db.from('addresses').update(addrRow).eq('id', existing.id);
  else await db.from('addresses').insert({ ...addrRow, user_id: uid, is_default: true });
  if (!session.name) await db.from('profiles').update({ name: contact.name }).eq('id', uid);

  const shipTo = { name: address.name, phone, line1: address.line1, line2: address.line2 || null, city: address.city, state: address.state, pin: address.pin };
  const source = cookies().get('ink_src')?.value;
  const common = {
    user_id: uid, ship_to: shipTo, gateway: 'test', payment_method: payment, contact_email: contact.email,
    source: source && /^[a-z0-9_-]{1,32}$/.test(source) ? source : null,
  };

  // Buy-now tees: one retail order with any code and club reward.
  const buys = priced.filter((l) => l.kind === 'buy');
  const backs = priced.filter((l) => l.kind === 'back');
  const created: string[] = [];
  let retailId: string | null = null;
  let pointsUsed = 0;

  if (buys.length) {
    const subtotal = buys.reduce((n, l) => n + l.price * l.qty, 0);
    let discount = 0;
    let code: string | null = null;
    if (coupon) {
      try {
        const r = await quoteCode(uid, coupon, 'retail', subtotal);
        discount = r.amount; code = r.code;
      } catch (e) {
        if (e instanceof CodeError) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }
    }
    let reward = 0;
    if (useReward) {
      const { data: bal } = await admin.rpc('points_balance', { p_user: uid });
      if ((bal as number) >= settings.reward_points && subtotal - discount > settings.reward_value) {
        reward = settings.reward_value; pointsUsed = settings.reward_points;
      }
    }
    const shipping = settings.free_shipping_over && subtotal >= settings.free_shipping_over ? 0 : settings.shipping_fee;
    const total = subtotal - discount - reward + shipping;
    const qty = buys.reduce((n, l) => n + l.qty, 0);
    const { data: o, error } = await admin.from('orders').insert({
      ...common, type: 'retail', subtotal, discount: discount + reward, discount_code: code, shipping, total,
      gst_included: gstPart(total, settings.gst_pct), gift_wrap: qty >= 2, points_redeemed: pointsUsed,
    }).select('id').single();
    if (error || !o) return NextResponse.json({ error: 'Could not place the order. Try again.' }, { status: 500 });
    retailId = o.id as string;
    created.push(retailId);
    await admin.from('order_items').insert(buys.map((l) => ({
      order_id: retailId, design_id: l.design.id, colour: l.colour, size: l.size, qty: l.qty, unit_price: l.price, price_type: l.priceType,
    })));
  }

  // Each backing is its own order: one hold, charged only if that design prints.
  for (const l of backs) {
    const total = l.price * l.qty;
    const { data: o, error } = await admin.from('orders').insert({
      ...common, type: 'backing', drop_id: l.design.drop_id, subtotal: total, total, gst_included: gstPart(total, settings.gst_pct),
    }).select('id').single();
    if (error || !o) return NextResponse.json({ error: 'Could not place the backing. Try again.' }, { status: 500 });
    created.push(o.id as string);
    await admin.from('order_items').insert({
      order_id: o.id, design_id: l.design.id, colour: l.colour, size: l.size, qty: l.qty, unit_price: l.price, price_type: l.priceType,
    });
    // Backing a design also counts as your vote (ignored if you already voted, or can't yet).
    await db.rpc('cast_vote', { p_design: l.design.id, p_source: common.source });
  }

  const { data: firstRow } = await admin.from('orders').select('number').eq('id', created[0]).single();
  const ref = `DND-${20000 + Number(firstRow?.number ?? 0)}`;
  await admin.from('orders').update({ group_ref: ref }).in('id', created);
  if (retailId && pointsUsed) {
    await admin.from('points_ledger').insert({ user_id: uid, delta: -pointsUsed, note: `Redeemed on ${ref}`, order_id: retailId, kind: 'redeemed' });
  }

  // Test payment: move each order on as the gateway callback would.
  const now = new Date().toISOString();
  for (const id of created) {
    const isRetail = id === retailId;
    await admin.from('orders').update(isRetail
      ? { status: 'paid', payment_status: 'captured', authorized_at: now, captured_at: now, gateway_payment_id: `test_${id}` }
      : { status: 'backed', payment_status: 'authorized', authorized_at: now, gateway_payment_id: `test_${id}` }).eq('id', id);
  }
  return NextResponse.json({ ref });
}
