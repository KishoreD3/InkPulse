import 'server-only';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { gstPart } from '@/lib/format';
import * as rzp from '@/lib/payments/razorpay';
import type { Address, Design, OrderType, PriceType, Settings } from '@/lib/types';

export const checkoutSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('back'),
    addressId: z.string().uuid(),
    design: z.string().min(3),
    colour: z.string().min(1),
    size: z.string().min(1),
    qty: z.coerce.number().int().min(1).max(5),
  }),
  z.object({
    mode: z.literal('bag'),
    addressId: z.string().uuid(),
    lines: z.array(z.object({
      designId: z.string().uuid(), colour: z.string().min(1), size: z.string().min(1), qty: z.coerce.number().int().min(1).max(5),
    })).min(1).max(10),
  }),
]);
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export class CheckoutError extends Error {}

interface Line { design: Design; colour: string; size: string; qty: number; price: number; priceType: PriceType; orderType: OrderType }

async function priceLine(supabase: SupabaseClient, settings: Settings, design: Design, colour: string, size: string, qty: number): Promise<Line> {
  if (!design.colours.some((c) => c.name === colour)) throw new CheckoutError(`${design.name} is not available in ${colour}.`);
  if (!settings.sizes.includes(size)) throw new CheckoutError(`Size ${size} is not available.`);
  const { data } = await supabase.rpc('price_quote', { p_design: design.id });
  const quote = (data as { price: number; price_type: PriceType; order_type: OrderType }[] | null)?.[0];
  if (!quote) throw new CheckoutError(`${design.name} is not on sale right now.`);
  return { design, colour, size, qty, price: quote.price, priceType: quote.price_type, orderType: quote.order_type };
}

/**
 * Validates prices server-side, writes the order, opens a Razorpay order.
 * Backing = one design per order (one authorisation each), manual capture.
 * Retail  = a bag of printed winners, captured immediately.
 */
export async function startCheckout(userId: string, input: CheckoutInput) {
  const supabase = createClient();
  const admin = createAdminClient();
  const { data: s } = await supabase.from('settings').select('*').single();
  const settings = s as Settings;

  const { data: addr } = await supabase.from('addresses').select('*').eq('id', input.addressId).eq('user_id', userId).maybeSingle();
  if (!addr) throw new CheckoutError('Choose a delivery address.');
  const address = addr as Address;

  let lines: Line[];
  if (input.mode === 'back') {
    const { data: d } = await supabase.from('designs').select('*').eq('slug', input.design).maybeSingle();
    if (!d) throw new CheckoutError('Design not found.');
    lines = [await priceLine(supabase, settings, d as Design, input.colour, input.size, input.qty)];
    if (lines[0].orderType !== 'backing') throw new CheckoutError('This design is no longer open for backing.');
  } else {
    const ids = Array.from(new Set(input.lines.map((l) => l.designId)));
    const { data: ds } = await supabase.from('designs').select('*').in('id', ids);
    const byId = new Map(((ds ?? []) as Design[]).map((d) => [d.id, d]));
    lines = [];
    for (const l of input.lines) {
      const d = byId.get(l.designId);
      if (!d) throw new CheckoutError('A design in your bag is no longer available.');
      const line = await priceLine(supabase, settings, d, l.colour, l.size, l.qty);
      if (line.orderType !== 'retail') throw new CheckoutError(`${d.name} is still in voting — back it from its page instead.`);
      lines.push(line);
    }
  }

  const type: OrderType = lines[0].orderType;
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shipping = settings.free_shipping_over && subtotal >= settings.free_shipping_over ? 0 : settings.shipping_fee;
  const total = subtotal + shipping;

  const shipTo = { name: address.name, phone: address.phone, line1: address.line1, line2: address.line2, city: address.city, state: address.state, pin: address.pin };
  const { data: order, error } = await admin.from('orders').insert({
    user_id: userId, type, drop_id: type === 'backing' ? lines[0].design.drop_id : null,
    ship_to: shipTo, subtotal, shipping, total, gst_included: gstPart(total, settings.gst_pct),
  }).select('id, number').single();
  if (error || !order) throw new Error(`order insert failed: ${error?.message}`);

  const { error: itemsErr } = await admin.from('order_items').insert(lines.map((l) => ({
    order_id: order.id, design_id: l.design.id, colour: l.colour, size: l.size, qty: l.qty, unit_price: l.price, price_type: l.priceType,
  })));
  if (itemsErr) throw new Error(`order items insert failed: ${itemsErr.message}`);

  const notes = { order_id: order.id as string, order_number: String(order.number), type };
  const gw = type === 'backing'
    ? await rzp.createBackingOrder({ amount: total, receipt: `INK-${order.number}`, notes })
    : await rzp.createRetailOrder({ amount: total, receipt: `INK-${order.number}`, notes });
  await admin.from('orders').update({ gateway_order_id: gw.id }).eq('id', order.id);

  return {
    orderId: order.id as string,
    orderNumber: order.number as number,
    type,
    total,
    gatewayOrderId: gw.id,
    amountPaise: gw.amount,
    description: type === 'backing' ? `Back ${lines[0].design.name} — debited only if it prints` : `INKPULSE order #${order.number}`,
    prefill: { name: address.name, contact: `+91${address.phone}` },
  };
}

/**
 * Apply a payment state from Razorpay to our order. Idempotent: the checkout
 * callback and the webhook may both call this for the same payment.
 */
export async function applyPayment(p: rzp.RzpPayment) {
  const admin = createAdminClient();
  const { data: order } = await admin.from('orders').select('id, type, status, payment_status, total')
    .eq('gateway_order_id', p.order_id).maybeSingle();
  if (!order) return { ok: false as const, reason: 'unknown order' };
  if (p.amount !== rzp.toPaise(order.total as number)) {
    await admin.from('audit_log').insert({ action: 'payment.amount_mismatch', target: order.id as string, detail: p as unknown as object });
    return { ok: false as const, reason: 'amount mismatch' };
  }

  const now = new Date().toISOString();
  const base = { gateway_payment_id: p.id, payment_method: p.method };

  if (p.status === 'authorized' && order.payment_status === 'created') {
    await admin.from('orders').update({
      ...base, payment_status: 'authorized', authorized_at: now,
      status: order.type === 'backing' ? 'backed' : order.status,
    }).eq('id', order.id).eq('payment_status', 'created');
  } else if (p.status === 'captured' && order.payment_status !== 'captured' && order.payment_status !== 'refunded') {
    await admin.from('orders').update({
      ...base, payment_status: 'captured', captured_at: now,
      authorized_at: order.payment_status === 'created' ? now : undefined,
      status: order.type === 'retail' ? 'paid' : 'won',
    }).eq('id', order.id);
  } else if (p.status === 'failed' && order.payment_status === 'created') {
    await admin.from('orders').update({ ...base, payment_status: 'failed', status: 'failed', failure_reason: p.error_description ?? null })
      .eq('id', order.id).eq('payment_status', 'created');
  } else if (p.status === 'refunded' && order.payment_status === 'captured') {
    // Only money we actually took counts as a refund. An uncaptured backing that the
    // gateway auto-reverses stays "released" (it never printed, nothing was debited).
    await admin.from('orders').update({ payment_status: 'refunded', status: 'refunded' }).eq('id', order.id);
  }
  return { ok: true as const, orderId: order.id as string };
}
