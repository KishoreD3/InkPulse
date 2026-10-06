'use client';
import { useEffect, useState } from 'react';
import { updateNotifyPrefs } from '@/app/actions/profile';
import { enablePush } from '@/lib/push-client';
import { toast } from '@/components/Toaster';

interface BeforeInstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export function AppSettings({ notify }: { notify: { push: boolean; email: boolean; whatsapp: boolean } }) {
  const [prefs, setPrefs] = useState(notify);
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const on = (e: Event) => { e.preventDefault(); setInstallEvt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);

  async function set(key: keyof typeof prefs, value: boolean) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    await updateNotifyPrefs(next);
  }

  return (
    <div className="flex flex-col gap-4">
      {(['push', 'email', 'whatsapp'] as const).map((k) => (
        <label key={k} className="flex items-center justify-between gap-4 border-b-2 border-dashed border-ink pb-3">
          <span>
            <span className="block font-bold capitalize">{k === 'whatsapp' ? 'WhatsApp' : k}</span>
            <span className="block text-sm text-muted">
              {k === 'push' && 'Vote milestones, results, shipping updates on this device.'}
              {k === 'email' && 'Receipts, results and payouts.'}
              {k === 'whatsapp' && 'Only the big ones: it printed, it shipped.'}
            </span>
          </span>
          <input type="checkbox" className="w-6 h-6 accent-[#FF3EA5]" checked={prefs[k]} onChange={(e) => set(k, e.target.checked)} />
        </label>
      ))}
      <button className="btn-white" onClick={async () => {
        const res = await enablePush();
        toast(res.ok ? { message: 'Notifications on for this device.' } : { message: res.error, tone: 'error' });
      }}>Turn on notifications on this device</button>

      {!standalone && (
        installEvt ? (
          <button className="btn-pink" onClick={async () => { await installEvt.prompt(); setInstallEvt(null); }}>Install the INKPULSE app</button>
        ) : ios ? (
          <p className="text-sm bg-acid border-2 border-ink rounded-xl p-3"><strong>Install on iPhone:</strong> tap Share, then “Add to Home Screen”.</p>
        ) : null
      )}
    </div>
  );
}
