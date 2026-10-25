import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';
import { getCatalog } from '@/lib/dnd/load';

export const revalidate = 3600;

/** Public store pages, every design on sale or in the battle, and every artist. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl.replace(/\/$/, '');
  const cat = await getCatalog();
  const pages = ['', '/shop', '/battle', '/topics', '/artists', '/legal/terms', '/legal/privacy', '/legal/shipping-returns', '/legal/size-guide', '/legal/contact'];
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: 'daily' as const, priority: p ? 0.7 : 1 })),
    ...[...cat.winners, ...cat.finalists].map((d) => ({ url: `${base}/design/${d.id}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...cat.artists.map((a) => ({ url: `${base}/artists/${a.slug}`, changeFrequency: 'weekly' as const, priority: 0.5 })),
  ];
}
