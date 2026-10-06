import { fallbackCard, loadCardDesign, renderCard, type CardKind } from '@/lib/og/card';

export const runtime = 'edge';

const KINDS: CardKind[] = ['design', 'voted', 'backed', 'artist'];

/**
 * Share image for a design.
 *   /d/<slug>/card                → 1200×630 link preview
 *   /d/<slug>/card?size=story&kind=voted|backed|artist → 1080×1920 for Instagram/WhatsApp stories
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  const url = new URL(request.url);
  const kindParam = url.searchParams.get('kind') as CardKind | null;
  const kind = kindParam && KINDS.includes(kindParam) ? kindParam : 'design';
  const size = url.searchParams.get('size') === 'story' ? 'story' : 'og';
  const design = await loadCardDesign(params.slug);
  if (!design) return fallbackCard();
  const res = await renderCard(url.origin, design, kind, size);
  if (url.searchParams.get('download')) {
    res.headers.set('content-disposition', `attachment; filename="inkpulse-${design.slug}-${kind}.png"`);
  }
  return res;
}
