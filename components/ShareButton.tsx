'use client';
import { Share } from './Icons';
import { toast } from './Toaster';

export function ShareButton({ title, path }: { title: string; path: string }) {
  async function share() {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try { await navigator.share({ title, text: title, url }); return; } catch { /* dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link copied. Paste it in your WhatsApp groups.', action: { label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}` } });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, '_blank');
    }
  }
  return (
    <button onClick={share} aria-label="Share" className="w-11 h-11 shrink-0 rounded-full border-2 border-ink bg-card grid place-items-center shadow-hard-sm">
      <Share size={20} />
    </button>
  );
}
