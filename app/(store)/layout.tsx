import './dnd.css';
import { CatalogProvider } from '@/lib/dnd/catalog-context';
import { StoreProvider } from '@/lib/dnd/store';
import { getCatalog } from '@/lib/dnd/load';
import { getStoreSession } from '@/lib/dnd/session';
import { Shell } from '@/components/dnd/shell';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [catalog, session] = await Promise.all([getCatalog(), getStoreSession()]);
  return (
    <CatalogProvider initial={catalog}>
      <StoreProvider session={session}>
        <Shell>{children}</Shell>
      </StoreProvider>
    </CatalogProvider>
  );
}
