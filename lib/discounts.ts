import 'server-only';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { OrderType } from '@/lib/types';

export class CodeError extends Error {}

const MESSAGES: Record<string, string> = {
  code_invalid: 'That code isn’t valid.',
  code_wrong_type: 'That code doesn’t apply to this kind of order.',
  code_used_up: 'That code has been fully used.',
  code_already_used: 'You’ve already used that code.',
};

export function cleanCode(raw: string | null | undefined): string | null {
  const c = (raw ?? '').trim().toUpperCase();
  return /^[A-Z0-9-]{3,24}$/.test(c) ? c : null;
}

/** ₹ discount for this user, order type and subtotal. Throws CodeError with a readable message. */
export async function quoteCode(userId: string, rawCode: string, type: OrderType, subtotal: number): Promise<{ code: string; amount: number }> {
  const code = cleanCode(rawCode);
  if (!code) throw new CodeError(MESSAGES.code_invalid);
  const { data, error } = await createAdminClient().rpc('quote_discount', {
    p_code: code, p_user: userId, p_type: type, p_subtotal: subtotal,
  });
  if (error) {
    const min = error.message.match(/code_min_subtotal:(\d+)/);
    if (min) throw new CodeError(`Spend at least ₹${Number(min[1]).toLocaleString('en-IN')} to use this code.`);
    const key = Object.keys(MESSAGES).find((k) => error.message.includes(k));
    if (key) throw new CodeError(MESSAGES[key]);
    throw new Error(`quote_discount failed: ${error.message}`);
  }
  return { code, amount: data as number };
}

export interface RewardCode { code: string; kind: 'percent' | 'flat'; value: number; expires_at: string | null; note: string | null }

/** Unused personal codes (welcome + referral rewards) for the signed-in member. */
export async function myRewardCodes(userId: string): Promise<RewardCode[]> {
  const supabase = createClient();
  const [{ data: codes }, { data: used }] = await Promise.all([
    supabase.from('discount_codes').select('code, kind, value, expires_at, note, max_uses')
      .eq('owner_id', userId).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('discount_redemptions').select('code').eq('user_id', userId),
  ]);
  const usedSet = new Set((used ?? []).map((u) => String(u.code).toUpperCase()));
  const now = Date.now();
  return ((codes ?? []) as (RewardCode & { max_uses: number | null })[])
    .filter((c) => !usedSet.has(c.code.toUpperCase()) && (!c.expires_at || new Date(c.expires_at).getTime() > now))
    .map(({ code, kind, value, expires_at, note }) => ({ code, kind, value, expires_at, note }));
}

export function describeCode(c: { kind: 'percent' | 'flat'; value: number }) {
  return c.kind === 'percent' ? `${c.value}% off` : `₹${c.value.toLocaleString('en-IN')} off`;
}
