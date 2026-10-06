import 'server-only';
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

interface Pending {
  id: string; user_id: string; kind: string; title: string; body: string | null; link: string | null; channels: string[];
}

const site = () => publicEnv.siteUrl.replace(/\/$/, '');

// ─── Channels (each is a no-op until its env vars are set) ─────────────
let vapidReady: boolean | null = null;
function pushReady() {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY; const priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = Boolean(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:support@example.com', pub!, priv!);
  return vapidReady;
}

async function sendPush(subs: { endpoint: string; p256dh: string; auth: string }[], n: Pending) {
  if (!pushReady() || subs.length === 0) return;
  const admin = createAdminClient();
  const payload = JSON.stringify({ title: n.title, body: n.body ?? '', link: n.link ?? '/', tag: n.kind });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
    }
  }));
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.EMAIL_FROM || 'INKPULSE <onboarding@resend.dev>', to, subject, text, html }),
  });
  if (!res.ok) throw new Error(`email ${res.status}`);
}

function emailHtml(n: Pending) {
  const link = n.link ? `${site()}${n.link}` : site();
  return `<div style="font-family:Arial,sans-serif;background:#E4DEFF;padding:24px">
  <div style="max-width:520px;margin:auto;background:#fff;border:2px solid #111;border-radius:16px;padding:24px">
    <p style="font:700 22px Impact,Arial Black,sans-serif;letter-spacing:1px;margin:0 0 12px">INKPULSE</p>
    <h1 style="font-size:22px;margin:0 0 8px">${escapeHtml(n.title)}</h1>
    <p style="font-size:15px;line-height:1.5;color:#36324D">${escapeHtml(n.body ?? '')}</p>
    <a href="${link}" style="display:inline-block;margin-top:12px;background:#FF3EA5;color:#111;border:2px solid #111;border-radius:12px;padding:12px 18px;font-weight:700;text-decoration:none">Open INKPULSE</a>
  </div></div>`;
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * WhatsApp via any BSP that accepts a JSON POST (Gupshup, Interakt, AiSensy, Meta Cloud API proxy…).
 * The payload below is deliberately generic — map it to your provider's approved template format.
 */
async function sendWhatsApp(phone: string, n: Pending) {
  const url = process.env.WHATSAPP_API_URL; const key = process.env.WHATSAPP_API_KEY;
  if (!url || !key) return;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: phone.replace(/\D/g, ''), template: n.kind, params: [n.title, n.body ?? '', `${site()}${n.link ?? ''}`] }),
  });
  if (!res.ok) throw new Error(`whatsapp ${res.status}`);
}

/** Sends queued notifications on the channels each user has enabled. Safe to run concurrently-ish; marks rows first. */
export async function dispatchPending(limit = 200) {
  const admin = createAdminClient();
  const { data: rows } = await admin.from('notifications').select('id, user_id, kind, title, body, link, channels')
    .is('dispatched_at', null).order('created_at').limit(limit);
  const pending = (rows ?? []) as Pending[];
  if (pending.length === 0) return { sent: 0 };

  // Claim the batch so an overlapping run does not double-send.
  const ids = pending.map((n) => n.id);
  await admin.from('notifications').update({ dispatched_at: new Date().toISOString() }).in('id', ids).is('dispatched_at', null);

  const userIds = Array.from(new Set(pending.map((n) => n.user_id)));
  const [{ data: profiles }, { data: priv }, { data: subs }] = await Promise.all([
    admin.from('profiles').select('id, notify').in('id', userIds),
    admin.from('profile_private').select('id, phone, email').in('id', userIds),
    admin.from('push_subscriptions').select('user_id, endpoint, p256dh, auth').in('user_id', userIds),
  ]);
  const prefs = new Map((profiles ?? []).map((p) => [p.id as string, p.notify as { push: boolean; email: boolean; whatsapp: boolean }]));
  const contact = new Map((priv ?? []).map((p) => [p.id as string, p as { phone: string | null; email: string | null }]));

  for (const n of pending) {
    const pref = prefs.get(n.user_id) ?? { push: true, email: true, whatsapp: true };
    const c = contact.get(n.user_id);
    const errors: string[] = [];
    const run = async (label: string, fn: () => Promise<void>) => { try { await fn(); } catch (e) { errors.push(`${label}: ${(e as Error).message}`); } };
    if (n.channels.includes('push') && pref.push) {
      await run('push', () => sendPush((subs ?? []).filter((s) => s.user_id === n.user_id) as { endpoint: string; p256dh: string; auth: string }[], n));
    }
    if (n.channels.includes('email') && pref.email && c?.email) {
      await run('email', () => sendEmail(c.email!, n.title, `${n.body ?? ''}\n\n${site()}${n.link ?? ''}`, emailHtml(n)));
    }
    if (n.channels.includes('whatsapp') && pref.whatsapp && c?.phone) {
      await run('whatsapp', () => sendWhatsApp(c.phone!, n));
    }
    if (errors.length) await admin.from('notifications').update({ dispatch_error: errors.join('; ') }).eq('id', n.id);
  }
  return { sent: pending.length };
}
