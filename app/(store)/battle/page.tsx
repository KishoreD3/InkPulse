import { BattleView } from '@/components/dnd/views/Battle';
import { BATTLE } from '@/lib/dnd/catalog';

export const metadata = { title: `Live battle · ${BATTLE.topic}`, description: 'Vote free or back a design for ₹899. The top 3 print on Friday.' };

export default function BattlePage() {
  return <BattleView />;
}
