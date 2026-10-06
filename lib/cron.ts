import 'server-only';
import crypto from 'node:crypto';

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Other schedulers can do the same. */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
