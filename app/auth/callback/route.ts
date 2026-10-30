import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { claimReferral } from '@/app/actions/growth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  // Email links carry a token hash (see the email templates in README.md), so they work in any browser,
  // not only the one that asked for the link. Google sign-in comes back with a code instead.
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  const supabase = createClient();
  const { error } = tokenHash && type
    ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    : code
      ? await supabase.auth.exchangeCodeForSession(code)
      : { error: true };
  if (!error) {
    // A friend's invite link (?ref=) counts once the new member is signed in.
    await claimReferral().catch(() => null);
    return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/signin?error=callback', url.origin));
}
