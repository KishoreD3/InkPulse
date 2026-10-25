import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DesignView } from '@/components/dnd/views/Design';
import { finalistById, finalists, img, productById, winners } from '@/lib/dnd/catalog';

export function generateStaticParams() {
  return [...winners, ...finalists].map((d) => ({ id: d.id }));
}

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const p = productById(params.id);
  const f = finalistById(params.id);
  if (!p && !f) return {};
  const name = (p ?? f)!.name;
  const by = (p ?? f)!.artist;
  return {
    title: name,
    description: p ? `${name} by ${by}. A crowd-picked graphic tee, printed to order.` : `${name} by ${by} is a live finalist. Vote free or back it for ₹899.`,
    openGraph: { images: [p ? img.product(p.id, 1) : img.finalist(f!.id)] },
  };
}

export default function DesignPage({ params }: { params: { id: string } }) {
  if (!productById(params.id) && !finalistById(params.id)) notFound();
  return <DesignView key={params.id} id={params.id} />;
}
