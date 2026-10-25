import { Suspense } from 'react';
import { ShopView } from '@/components/dnd/views/Shop';

export const metadata = { title: 'Shop tees' };

export default function ShopPage() {
  return <Suspense><ShopView /></Suspense>;
}
