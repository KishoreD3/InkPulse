import 'server-only';
import crypto from 'node:crypto';
import { publicEnv, serverEnv } from '@/lib/env';

/**
 * Thin Razorpay REST client (no SDK dependency).
 *
 * Backing ("charged only if it prints") uses an order with MANUAL capture:
 *   1. the customer authorises the amount (UPI / card) at checkout,
 *   2. on Thursday's lock we CAPTURE winners and leave losers uncaptured,
 *   3. uncaptured payments are reversed by Razorpay after the manual expiry period.
 *
 * ⚠ Before going live, confirm with Razorpay that manual capture is enabled on
 * your account for UPI as well as cards, and the maximum manual_expiry_period
 * (it must cover Monday → Thursday lock). If your account uses UPI one-time
 * mandates ("UPI AutoPay / block"), swap createBackingOrder/capture/release
 * below for those APIs — nothing else in the app needs to change.
 */

const API = 'https://api.razorpay.com/v1';

function auth() {
  const id = publicEnv.razorpayKeyId || serverEnv('NEXT_PUBLIC_RAZORPAY_KEY_ID');
  return 'Basic ' + Buffer.from(`${id}:${serverEnv('RAZORPAY_KEY_SECRET')}`).toString('base64');
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: auth(), 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string; code?: string } };
  if (!res.ok) {
    const err = new Error(json.error?.description || `Razorpay ${res.status}`) as Error & { code?: string; status?: number };
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}

export interface RzpOrder { id: string; amount: number; currency: string; status: string; receipt: string }
export interface RzpPayment {
  id: string; order_id: string; amount: number; status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string; captured: boolean; error_description?: string | null; email?: string; contact?: string;
}

export const toPaise = (rupees: number) => Math.round(rupees * 100);

export function createBackingOrder(p: { amount: number; receipt: string; notes: Record<string, string> }) {
  const expiry = Number(process.env.RAZORPAY_MANUAL_EXPIRY_MINUTES || 7200);
  return call<RzpOrder>('/orders', {
    method: 'POST',
    body: {
      amount: toPaise(p.amount), currency: 'INR', receipt: p.receipt, notes: p.notes,
      payment: { capture: 'manual', capture_options: { manual_expiry_period: expiry, refund_speed: 'optimum' } },
    },
  });
}

export function createRetailOrder(p: { amount: number; receipt: string; notes: Record<string, string> }) {
  return call<RzpOrder>('/orders', {
    method: 'POST',
    body: { amount: toPaise(p.amount), currency: 'INR', receipt: p.receipt, notes: p.notes, payment_capture: 1 },
  });
}

export const fetchPayment = (id: string) => call<RzpPayment>(`/payments/${id}`);

export const capturePayment = (id: string, amountRupees: number) =>
  call<RzpPayment>(`/payments/${id}/capture`, { method: 'POST', body: { amount: toPaise(amountRupees), currency: 'INR' } });

export const refundPayment = (id: string, amountRupees?: number) =>
  call<{ id: string; status: string }>(`/payments/${id}/refund`, {
    method: 'POST', body: amountRupees ? { amount: toPaise(amountRupees), speed: 'optimum' } : { speed: 'optimum' },
  });

/**
 * Release a backing that did not print. Authorised-but-uncaptured payments are
 * reversed automatically by Razorpay at the end of the manual expiry window, so
 * there is nothing to call; anything already captured by mistake is refunded.
 */
export async function releasePayment(id: string): Promise<'auto_reversal' | 'refunded'> {
  const p = await fetchPayment(id);
  if (p.status === 'captured') {
    await refundPayment(id);
    return 'refunded';
  }
  return 'auto_reversal';
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = crypto.createHmac('sha256', serverEnv('RAZORPAY_KEY_SECRET')).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string) {
  const expected = crypto.createHmac('sha256', serverEnv('RAZORPAY_WEBHOOK_SECRET')).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}
