'use client';
import { toast } from './Toaster';

const CHANNELS = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['x', 'X'],
] as const;

/**
 * Share links with a campaign tag (?src=…) so artists see which channel brought votes,
 * plus downloadable story cards.
 */
export function ShareKit({ slug, name, kind, live }: { slug: string; name: string; kind: 'design' | 'voted' | 'backed' | 'artist'; live: boolean }) {
  const text = kind === 'artist'
    ? `My design ${name} is in this week's INKPULSE drop. Only the top 3 get printed — vote before Thursday!`
    : live ? `Vote for ${name} on INKPULSE — only the top 3 get printed.` : `${name} on INKPULSE`;

  function link(src: string) {
    return `${window.location.origin}/d/${slug}?src=${src}`;
  }

  async function share(src: string) {
    const url = link(src);
    if (src === 'whatsapp') { window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank'); return; }
    if (src === 'x') { window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank'); return; }
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: 'Link copied — paste it in your bio or story link sticker.' });
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map(([src, label]) => (
          <button key={src} type="button" className="chip-off" onClick={() => share(src)}>{label}</button>
        ))}
        <a className="chip-on" href={`/d/${slug}/card?size=story&kind=${kind}&download=1`} download>Story card ↓</a>
      </div>
    </div>
  );
}
