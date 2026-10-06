'use client';
import { getBrowserClient } from '@/lib/supabase/client';
import { toast } from '@/components/Toaster';

const MESSAGES: Record<string, string> = {
  phone_not_verified: 'Verify your phone number to vote — it keeps the board fair.',
  voting_locked: 'Voting for this drop is locked.',
  rate_limited: 'Easy! You have hit the hourly vote limit. Try again shortly.',
  design_not_live: 'This design is not open for voting.',
  banned: 'Your account cannot vote.',
};

/** Returns the new vote count, or null if the vote did not go through. */
export async function sendVote(designId: string, on: boolean): Promise<number | null> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase.rpc(on ? 'cast_vote' : 'withdraw_vote', { p_design: designId });
  if (!error) return data as number;
  const code = Object.keys(MESSAGES).find((k) => error.message.includes(k));
  if (error.message.includes('not_signed_in')) {
    window.location.href = `/signin?next=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  toast({
    message: code ? MESSAGES[code] : 'Could not record your vote. Try again.',
    tone: 'error',
    action: code === 'phone_not_verified' ? { label: 'Verify', href: '/me#phone' } : undefined,
  });
  return null;
}
