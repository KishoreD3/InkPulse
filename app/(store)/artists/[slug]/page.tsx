import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArtistProfileView } from '@/components/dnd/views/Artists';
import { lookups } from '@/lib/dnd/catalog';
import { getCatalog } from '@/lib/dnd/load';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const a = lookups(await getCatalog()).artistBySlug(params.slug);
  return a ? { title: `${a.name}${a.city ? ` · ${a.city}` : ''}`, description: a.bio, openGraph: a.photo ? { images: [a.photo] } : undefined } : {};
}

export default async function ArtistPage({ params }: { params: { slug: string } }) {
  if (!lookups(await getCatalog()).artistBySlug(params.slug)) notFound();
  return <ArtistProfileView key={params.slug} slug={params.slug} />;
}
