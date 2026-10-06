import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Avatar } from '@/components/PostCard';
import { ArtistPanel } from '@/components/Panels';

export const metadata = { title: 'Artists' };
export const dynamic = 'force-dynamic';

export default async function ArtistsPage({ searchParams }: { searchParams: { q?: string } }) {
  const supabase = createClient();
  let q = supabase.from('profiles').select('id, handle, name, avatar_url, bio, location').eq('is_artist', true).eq('banned', false).limit(60);
  if (searchParams.q) q = q.ilike('handle', `%${searchParams.q.replace(/[%_]/g, '')}%`);
  const { data: artists } = await q;
  const { data: printed } = await supabase.from('designs').select('artist_id').eq('status', 'won');
  const wins = new Map<string, number>();
  (printed ?? []).forEach((d) => wins.set(d.artist_id as string, (wins.get(d.artist_id as string) ?? 0) + 1));
  const list = ((artists ?? []) as { id: string; handle: string; name: string | null; avatar_url: string | null; bio: string | null; location: string | null }[])
    .sort((a, b) => (wins.get(b.id) ?? 0) - (wins.get(a.id) ?? 0));

  return (
    <>
      <div className="container-page py-6 flex flex-col gap-6">
        <header className="flex flex-wrap justify-between items-end gap-4">
          <h1 className="h-display text-[48px] misprint">Artists</h1>
          <form className="flex gap-2"><label htmlFor="q" className="sr-only">Search artists</label>
            <input id="q" name="q" defaultValue={searchParams.q} className="input !w-56" placeholder="Search handle" />
            <button className="btn-ink btn-sm">Go</button></form>
        </header>
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
      <ArtistPanel />
    </>
  );
}
