import 'server-only';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export interface Session {
  user: User;
  profile: Profile;
  phoneVerified: boolean;
}

export async function getSession(): Promise<Session | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return null;
  return { user, profile: profile as Profile, phoneVerified: Boolean(user.phone_confirmed_at) };
}

export async function requireSession(next = '/'): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/signin?next=${encodeURIComponent(next)}`);
  if (session.profile.banned) redirect('/signin?error=banned');
  return session;
}

export async function requireArtist(next = '/studio'): Promise<Session> {
  const session = await requireSession(next);
  if (!session.profile.is_artist) redirect('/submit/become-artist');
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession('/admin');
  if (!session.profile.is_admin) redirect('/');
  return session;
}

/** For server actions / route handlers: returns null instead of redirecting. */
export async function currentAdmin(): Promise<Session | null> {
  const session = await getSession();
  return session?.profile.is_admin ? session : null;
}
