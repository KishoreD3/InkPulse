import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = ['/checkout', '/orders', '/me', '/notifications', '/submit', '/studio', '/admin'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie; must run before any redirect decision.
  const { data: { user } } = await supabase.auth.getUser();

  // Invite links (?ref=handle) and campaign links (?src=instagram) are remembered for a while.
  const ref = request.nextUrl.searchParams.get('ref')?.toLowerCase();
  const src = request.nextUrl.searchParams.get('src')?.toLowerCase();
  const month = 60 * 60 * 24 * 30;
  if (ref && /^[a-z0-9_]{3,24}$/.test(ref)) response.cookies.set('ink_ref', ref, { maxAge: month, sameSite: 'lax', path: '/' });
  if (src && /^[a-z0-9_-]{1,32}$/.test(src)) response.cookies.set('ink_src', src, { maxAge: 60 * 60 * 24 * 7, sameSite: 'lax', path: '/' });

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const signin = request.nextUrl.clone();
    signin.pathname = '/signin';
    signin.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(signin);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|seed/|sw.js|manifest.webmanifest|api/webhooks|api/cron).*)'],
};
