import 'server-only';
import { isConfigured } from '@/lib/env';
import { getSession } from '@/lib/auth';
import type { StoreSession } from './store';

/** The signed-in member for the store, or null (always null without a database). */
export async function getStoreSession(): Promise<StoreSession> {
  if (!isConfigured()) return null;
  const s = await getSession().catch(() => null);
  if (!s || s.profile.banned) return null;
  return {
    id: s.user.id,
    handle: s.profile.handle,
    since: new Date(s.profile.created_at).getTime(),
    name: s.profile.name,
    email: s.user.email ?? null,
    phone: s.user.phone ? `+${s.user.phone.replace(/^\+/, '')}` : null,
    phoneVerified: s.phoneVerified,
    isArtist: s.profile.is_artist,
    isAdmin: s.profile.is_admin,
  };
}
