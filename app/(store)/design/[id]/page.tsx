import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignView } from '@/components/dnd/views/Design';
import { lookups } from '@/lib/dnd/catalog';
import { getCatalog } from '@/lib/dnd/load';

async function find(id: string) {
  const cat = await getCatalog();
  const { productById, finalistById } = lookups(cat);
  return { cat, p: productById(id), f: finalistById(id) };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { cat, p, f } = await find(params.id);
  if (!p && !f) return {};
  const name = (p ?? f)!.name;
  const by = (p ?? f)!.artist;
  return {
    title: name,
    description: p ? `${name} by ${by}. A crowd-picked graphic tee, printed to order.` : `${name} by ${by} is a live finalist. Vote free or back it for ₹${cat.prices.back}.`,
    openGraph: { images: [p ? p.photos[0] : f!.card] },
  };
}

export default async function DesignPage({ params }: { params: { id: string } }) {
  const { p, f } = await find(params.id);
  if (!p && !f) notFound();
  return <DesignView key={params.id} id={params.id} />;
}
