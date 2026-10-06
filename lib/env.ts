// Central, typed access to environment variables. Server-only values throw
// a clear error when used without being configured.

export const publicEnv = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  siteName: process.env.NEXT_PUBLIC_SITE_NAME || 'INKPULSE',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  // Supabase's Vercel integration may provide the newer "publishable" key name instead of the anon key.
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
};

export function serverEnv(name: string, { optional = false } = {}): string {
  const value = process.env[name];
  if (!value && !optional) {
    throw new Error(`Missing environment variable ${name}. See .env.example and README.md.`);
  }
  return value || '';
}

export const isConfigured = () => Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
