'use client';
import { publicEnv } from '@/lib/env';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'This browser does not support push. On iPhone, install the app to your Home Screen first.' };
  }
  if (!publicEnv.vapidPublicKey) return { ok: false, error: 'Push is not configured on the server yet.' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, error: 'Notifications are blocked for this site.' };
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register('/sw.js'));
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicEnv.vapidPublicKey),
  }));
  const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(sub) });
  return res.ok ? { ok: true } : { ok: false, error: 'Could not save this device.' };
}
