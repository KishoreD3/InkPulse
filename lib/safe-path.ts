/**
 * A same-site path to send someone to after sign-in, or the fallback.
 * Browsers read "\" as "/" and drop tabs and newlines, so "/\evil.com" or "/\t/evil.com"
 * would leave the site; anything like that is refused along with "//host" and full URLs.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}

/** An http(s) link that is safe to put in an href, or null (blocks javascript:, data: and the like). */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}
