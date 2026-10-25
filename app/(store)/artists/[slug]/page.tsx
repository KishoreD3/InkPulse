import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArtistProfileView } from '@/components/dnd/views/Artists';
import { artistBySlug, artists, img } from '@/lib/dnd/catalog';

export function generateStaticParams() {
  return artists.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = artistBySlug(params.slug);
  return a ? { title: `${a.name} · ${a.city}`, description: a.bio, openGraph: { images: [img.artist(a.slug)] } } : {};
}

export default function ArtistPage({ params }: { params: { slug: string } }) {
  if (!artistBySlug(params.slug)) notFound();
  return <ArtistProfileView key={params.slug} slug={params.slug} />;
}
