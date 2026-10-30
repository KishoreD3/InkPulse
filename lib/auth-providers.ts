import { publicEnv } from './env';

export type SignInProviders = { phone: boolean; google: boolean; email: boolean };

/** Which sign-in methods Supabase Auth has switched on, so the sign-in page only offers working ones. */
export async function getSignInProviders(): Promise<SignInProviders> {
  const all = { phone: true, google: true, email: true };
  try {
    const res = await fetch(`${publicEnv.supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: publicEnv.supabaseAnonKey },
      next: { revalidate: 300 },
    });
    if (!res.ok) return all;
    const { external = {} } = (await res.json()) as { external?: Record<string, boolean> };
    return { phone: Boolean(external.phone), google: Boolean(external.google), email: external.email !== false };
  } catch {
    // If Supabase can't be asked, show everything rather than hide a working method.
    return all;
  }
}
