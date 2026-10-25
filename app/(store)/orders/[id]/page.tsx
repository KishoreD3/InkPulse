import { Suspense } from 'react';
import { OrderView } from '@/components/dnd/views/Order';

export const metadata = { title: 'Order' };

export default function OrderPage({ params }: { params: { id: string } }) {
  return <Suspense><OrderView id={params.id} /></Suspense>;
}
