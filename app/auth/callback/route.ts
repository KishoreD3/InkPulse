import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { claimReferral } from '@/app/actions/growth';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/';
  if (code) {
    const { error } = await createClient().auth.exchangeCodeForSession(code);
    if (!error) {
      // A friend's invite link (?ref=) counts once the new member is signed in.
      await claimReferral().catch(() => null);
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/signin?error=callback', url.origin));
}
