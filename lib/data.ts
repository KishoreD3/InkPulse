import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { DesignWithArtist, Drop, Settings } from '@/lib/types';

export const DESIGN_SELECT = '*, artist:profiles!designs_artist_id_fkey(id, handle, name, avatar_url)';

export const getSettings = cache(async (): Promise<Settings> => {
  const { data, error } = await createClient().from('settings').select('*').single();
  if (error || !data) throw new Error('Settings row missing — run the Supabase migrations.');
  return data as Settings;
});

export const getLiveDrop = cache(async (): Promise<Drop | null> => {
  const { data } = await createClient().from('drops').select('*').eq('status', 'live').maybeSingle();
  return (data as Drop) ?? null;
});

/** The drop people should see: the live one, else the most recent locked/printing, else the next scheduled. */
export const getCurrentDrop = cache(async (): Promise<Drop | null> => {
  const live = await getLiveDrop();
  if (live) return live;
  const supabase = createClient();
  const { data: recent } = await supabase.from('drops').select('*')
    .in('status', ['locked', 'printing']).order('number', { ascending: false }).limit(1).maybeSingle();
  if (recent) return recent as Drop;
  const { data: next } = await supabase.from('drops').select('*')
    .eq('status', 'scheduled').order('opens_at').limit(1).maybeSingle();
  return (next as Drop) ?? null;
});

export const getNextDrop = cache(async (): Promise<Drop | null> => {
  const { data } = await createClient().from('drops').select('*')
    .eq('status', 'scheduled').order('opens_at').limit(1).maybeSingle();
  return (data as Drop) ?? null;
});

export async function getDropDesigns(dropId: string): Promise<DesignWithArtist[]> {
  const { data } = await createClient().from('designs').select(DESIGN_SELECT)
    .eq('drop_id', dropId).in('status', ['live', 'won', 'lost'])
    .order('vote_count', { ascending: false }).order('count_reached_at', { ascending: true });
  return (data ?? []) as DesignWithArtist[];
}

export async function getRetailWinners(): Promise<DesignWithArtist[]> {
  const { data } = await createClient().from('designs').select(DESIGN_SELECT)
    .eq('status', 'won').gt('retail_until', new Date().toISOString())
    .order('retail_until', { ascending: false }).limit(8);
  return (data ?? []) as DesignWithArtist[];
}

/** Rank designs the same way the database does at lock time. */
export function rankDesigns<T extends { vote_count: number; count_reached_at: string }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    b.vote_count - a.vote_count || new Date(a.count_reached_at).getTime() - new Date(b.count_reached_at).getTime());
}
