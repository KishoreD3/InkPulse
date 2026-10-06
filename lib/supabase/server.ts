import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createPlainClient, type SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { publicEnv, serverEnv } from '@/lib/env';

/** Supabase client bound to the signed-in user's session (RLS applies). */
export function createClient(): SupabaseClient {
  const cookieStore = cookies();
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — use only in server code after you have
 * checked who the caller is (route handlers, server actions, cron jobs).
 */
export function createAdminClient(): SupabaseClient {
  // Older projects call it the service-role key; newer ones the secret key. Either bypasses RLS.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || serverEnv('SUPABASE_SECRET_KEY');
  return createPlainClient(publicEnv.supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
