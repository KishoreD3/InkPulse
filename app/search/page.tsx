import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { DESIGN_SELECT } from '@/lib/data';
import { Tee, colourway, tileFor } from '@/components/Tee';
import { Avatar } from '@/components/PostCard';
import type { DesignWithArtist } from '@/lib/types';

export const metadata = { title: 'Search' };
export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim().slice(0, 60).replace(/[%_,()]/g, '');
  const supabase = createClient();
  const [designs, artists] = q
    ? await Promise.all([
        supabase.from('designs').select(DESIGN_SELECT).in('status', ['live', 'won', 'lost'])
          .or(`name.ilike.%${q}%,category.ilike.%${q}%`).limit(24).then((r) => (r.data ?? []) as DesignWithArtist[]),
        supabase.from('profiles').select('id, handle, avatar_url').eq('is_artist', true).ilike('handle', `%${q}%`).limit(12)
          .then((r) => (r.data ?? []) as { id: string; handle: string; avatar_url: string | null }[]),
      ])
    : [[], []];
  return (
    <div className="container-page py-6 flex flex-col gap-6">
      <form className="flex gap-2 max-w-xl" role="search">
        <label htmlFor="sq" className="sr-only">Search designs and artists</label>
        <input id="sq" name="q" defaultValue={q} autoFocus className="input" placeholder="Search designs, artists, categories" />
        <button className="btn-ink">Search</button>
      </form>
      {q && designs.length === 0 && artists.length === 0 && <p className="card-flat p-5">No matches for “{q}”.</p>}
      {artists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {artists.map((a) => <Link key={a.id} href={`/a/${a.handle}`} className="chip-off gap-2"><Avatar handle={a.handle} url={a.avatar_url} size={24} />@{a.handle}</Link>)}
        </div>
      )}
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {designs.map((d) => {
          const c = colourway(d); const t = tileFor(d.slug);
          return (
            <Link key={d.id} href={`/d/${d.slug}`} className="card p-3 flex flex-col gap-2">
              <span className={`h-[200px] border-2 border-ink rounded-xl grid place-items-center ${t.dark ? 'halftone-dark' : 'halftone-light'}`} style={{ backgroundColor: t.bg }}>
                <Tee shirt={c.hex} art={c.art} size={180} />
              </span>
              <span className="font-display text-xl uppercase">{d.name}</span>
              <span className="font-mono text-[11px] text-muted">@{d.artist?.handle} · {d.category}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
