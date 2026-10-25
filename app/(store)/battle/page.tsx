import type { Metadata } from 'next';
import { BattleView } from '@/components/dnd/views/Battle';
import { getCatalog } from '@/lib/dnd/load';

export async function generateMetadata(): Promise<Metadata> {
  const { battle, prices } = await getCatalog();
  return {
    title: battle.live ? `Live battle · ${battle.topic}` : 'The weekly battle',
    description: `Vote free or back a design for ₹${prices.back}. The top ${battle.winners} print on Friday.`,
  };
}

export default function BattlePage() {
  return <BattleView />;
}
