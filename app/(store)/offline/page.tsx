import { Empty } from '@/components/dnd/ui';

export const metadata = { title: 'Offline' };

export default function Offline() {
  return (
    <div className="page-width section">
      <Empty emoji="📴" title="You’re offline." body="Vote counts need a connection. Reconnect and pull to refresh." />
    </div>
  );
}
