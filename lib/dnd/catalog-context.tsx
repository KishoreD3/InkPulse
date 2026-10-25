'use client';
// Hands the catalogue (demo or live) to every store screen. In live mode it also keeps
// vote and backer counts current through Supabase Realtime.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { lookups, type Catalog } from './catalog';
import { demoCatalog } from './demo';

type CountListener = (id: string) => void;
type Api = Catalog & ReturnType<typeof lookups> & {
  /** Set a finalist's server counts (after a vote, or from Realtime). */
  patchCounts: (id: string, votes: number, backers?: number) => void;
  /** Called with a design slug whenever its server count changes. */
  onCounts: (fn: CountListener) => () => void;
};

const Ctx = createContext<Api | null>(null);

export function CatalogProvider({ initial, children }: { initial: Catalog; children: React.ReactNode }) {
  const [cat, setCat] = useState(initial);
  const listeners = useRef(new Set<CountListener>());

  // A fresh server render (navigation, router.refresh) brings a newer catalogue. Demo pages can be
  // prerendered at build time, so the demo rebuilds its weekly clock from the browser's time.
  useEffect(() => setCat(initial.mode === 'demo' ? demoCatalog() : initial), [initial]);

  const patchCounts = useCallback((id: string, votes: number, backers?: number) => {
    setCat((c) => ({ ...c, finalists: c.finalists.map((f) => (f.id === id ? { ...f, votes, backers: backers ?? f.backers } : f)) }));
    listeners.current.forEach((fn) => fn(id));
  }, []);
  const onCounts = useCallback((fn: CountListener) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const live = cat.mode === 'live' && cat.battle.live;
  const battleId = cat.battle.uuid;
  useEffect(() => {
    if (!live || !battleId) return;
    const supabase = getBrowserClient();
    const channel = supabase.channel(`battle-${battleId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'designs', filter: `drop_id=eq.${battleId}` }, (payload) => {
        const row = payload.new as { slug: string; vote_count: number; backer_count: number };
        if (row?.slug) patchCounts(row.slug, row.vote_count, row.backer_count);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [live, battleId, patchCounts]);

  const api = useMemo<Api>(() => ({ ...cat, ...lookups(cat), patchCounts, onCounts }), [cat, patchCounts, onCounts]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useCatalog() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return v;
}
