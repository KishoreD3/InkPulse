import { getSettings } from '@/lib/data';
import { isConfigured } from '@/lib/env';
import { BagClient } from './BagClient';

export const metadata = { title: 'Bag' };
export const dynamic = 'force-dynamic';

export default async function BagPage() {
  const price = isConfigured() ? (await getSettings()).retail_price : 0;
  return (
    <div className="container-page py-6 max-w-3xl">
      <h1 className="h-display text-[40px] misprint pb-2">Your bag</h1>
      <p className="text-body pb-6">Printed winners you can buy now. Backing a live design happens from its page — it is reserved separately and only debited if it prints.</p>
      <BagClient price={price} />
    </div>
  );
}
