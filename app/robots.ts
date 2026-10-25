import type { MetadataRoute } from 'next';
import { publicEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = publicEnv.siteUrl.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/account', '/bag', '/checkout', '/orders', '/result', '/studio', '/dashboard', '/signin'] },
    sitemap: `${base}/sitemap.xml`,
  };
}
