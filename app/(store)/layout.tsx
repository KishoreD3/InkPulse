import './dnd.css';
import { StoreProvider } from '@/lib/dnd/store';
import { Shell } from '@/components/dnd/shell';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreProvider>
      <Shell>{children}</Shell>
    </StoreProvider>
  );
}
