import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/PostCard';
import { ArtistPanel } from '@/components/Panels';
import { getSettings } from '@/lib/data';
import { inr, num } from '@/lib/format';

export const metadata = { title: 'Artists' };
export const dynamic = 'force-dynamic';

export default async function ArtistsPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  let q = supabase.from('profiles').select('id, handle, name, avatar_url, bio, location').eq('is_artist', true).eq('banned', false).limit(60);
  if (searchParams.q) q = q.ilike('handle', `%${searchParams.q.replace(/[%_]/g, '')}%`);
  const { data: artists } = await q;
  const [{ data: printed }, { data: totals }, settings] = await Promise.all([
    supabase.from('designs').select('artist_id').eq('status', 'won'),
    supabase.rpc('artist_totals'),
    getSettings(),
  ]);
  const t = (totals as { earned: number; artists_printed: number; tees_sold: number }[] | null)?.[0] ?? { earned: 0, artists_printed: 0, tees_sold: 0 };
  const wins = new Map<string, number>();
  (printed ?? []).forEach((d) => wins.set(d.artist_id as string, (wins.get(d.artist_id as string) ?? 0) + 1));
  const list = ((artists ?? []) as { id: string; handle: string; name: string | null; avatar_url: string | null; bio: string | null; location: string | null }[])
    .sort((a, b) => (wins.get(b.id) ?? 0) - (wins.get(a.id) ?? 0));

  return (
    <>
      <div className="container-page py-6 flex flex-col gap-6">
        <header className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h1 className="h-display text-[48px] misprint">Artists</h1>
            <p className="text-body max-w-xl">Every tee pays the artist who drew it {settings.artist_pct}% of its price. No middlemen deciding taste — the crowd does.</p>
          </div>
          <form className="flex gap-2"><label htmlFor="q" className="sr-only">Search artists</label>
            <input id="q" name="q" defaultValue={searchParams.q} className="input !w-56" placeholder="Search handle" />
            <button className="btn-ink btn-sm">Go</button></form>
        </header>
        <div className="grid grid-cols-3 gap-3">
          {[[inr(t.earned), 'Earned by artists'], [num(t.artists_printed), 'Artists printed'], [num(t.tees_sold), 'Tees sold']].map(([v, l]) => (
            <div key={l} className="card p-4"><p className="font-display text-[clamp(24px,4vw,40px)] leading-none">{v}</p><p className="label-mono text-muted pt-1">{l}</p></div>
          ))}
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          {list.map((a, i) => (
            <Link key={a.id} href={`/a/${a.handle}`} className="card p-4 flex gap-3 items-start">
              <span className="font-display text-[34px] leading-none text-transparent [-webkit-text-stroke:1.5px_#111] w-10">{i + 1}</span>
              <Avatar handle={a.handle} url={a.avatar_url} size={48} />
              <span className="flex-1 min-w-0">
                <span className="block font-bold">@{a.handle}</span>
                <span className="block label-mono text-muted">{wins.get(a.id) ?? 0} printed{a.location ? ` · ${a.location}` : ''}</span>
                {a.bio && <span className="block text-sm text-body pt-1 line-clamp-2">{a.bio}</span>}
              </span>
            </Link>
          ))}
        </div>
      </div>
      <ArtistPanel artistPct={settings.artist_pct} />
    </>
  );
}
