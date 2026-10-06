'use client';
import { toast } from './Toaster';

/** Copy a link (or share it through the phone's share sheet). */
export function CopyLink({ url, label = 'Copy', text, className = 'chip-off' }: { url: string; label?: string; text?: string; className?: string }) {
  async function go() {
    const full = url.startsWith('/') ? `${window.location.origin}${url}` : url;
    if (text && navigator.share) {
      try { await navigator.share({ text, url: full }); return; } catch { /* dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(full);
      toast({ message: 'Link copied.' });
    } catch {
      window.prompt('Copy this link', full);
    }
  }
  return <button type="button" onClick={go} className={className}>{label}</button>;
}
