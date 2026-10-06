import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DESIGN_SELECT } from '@/lib/data';
import { getSession } from '@/lib/auth';
import { loadPosts } from '@/lib/feed';
import { Avatar, PostCard } from '@/components/PostCard';
import { FollowButton } from '@/components/FollowButton';
import { Tee, colourway, tileFor } from '@/components/Tee';
import { DESIGN_STATUS_LABEL } from '@/lib/format';
import type { DesignWithArtist, Profile } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { handle: string } }) {
  return { title: `@${params.handle}` };
}

export default async function ArtistPage({ params }: { params: { handle: string } }) {
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').eq('handle', params.handle.toLowerCase()).maybeSingle();
  if (!data) notFound();
  const artist = data as Profile;
  const session = await getSession();
  const [{ data: designs }, { data: stats }, feed, following] = await Promise.all([
    supabase.from('designs').select(DESIGN_SELECT).eq('artist_id', artist.id).in('status', ['live', 'won', 'lost']).order('created_at', { ascending: false }),
    supabase.rpc('artist_stats', { p_artist: artist.id }),
    loadPosts({ authorId: artist.id, userId: session?.user.id, limit: 10 }),
    session ? supabase.from('follows').select('artist_id', { count: 'exact', head: true }).eq('follower_id', session.user.id).eq('artist_id', artist.id).then((r) => (r.count ?? 0) > 0) : Promise.resolve(false),
  ]);
  const s = ((stats ?? []) as { printed: number; total_votes: number; followers: number }[])[0] ?? { printed: 0, total_votes: 0, followers: 0 };

  return (
    <div className="container-page py-6 flex flex-col gap-8">
      <header className="flex flex-wrap items-center gap-5">
        <Avatar handle={artist.handle} url={artist.avatar_url} size={96} />
        <div className="flex-1 min-w-0">
          <h1 className="h-display text-[48px] misprint">@{artist.handle}</h1>
          {artist.name && <p className="font-semibold">{artist.name}{artist.location ? ` · ${artist.location}` : ''}</p>}
          {artist.bio && <p className="text-body pt-1 max-w-xl">{artist.bio}</p>}
        </div>
        {artist.is_artist && session?.user.id !== artist.id && <FollowButton artistId={artist.id} initial={following} signedIn={Boolean(session)} />}
      </header>
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        {[['Printed', s.printed], ['Votes', s.total_votes.toLocaleString('en-IN')], ['Followers', s.followers]].map(([k, v]) => (
          <div key={k as string} className="card-flat p-3 text-center"><p className="font-display text-3xl">{v}</p><p className="label-mono">{k}</p></div>
        ))}
      </div>
      <section className="flex flex-col gap-4">
        <h2 className="h-display text-3xl"><span className="highlight">Designs</span></h2>
        <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {((designs ?? []) as DesignWithArtist[]).map((d) => {
            const c = colourway(d); const t = tileFor(d.slug);
            return (
              <Link key={d.id} href={`/d/${d.slug}`} className="card p-3 flex flex-col gap-2">
                <span className={`h-[200px] border-2 border-ink rounded-xl grid place-items-center ${t.dark ? 'halftone-dark' : 'halftone-light'}`} style={{ backgroundColor: t.bg }}>
                  <Tee shirt={c.hex} art={c.art} size={180} />
                </span>
                <span className="font-display text-xl uppercase">{d.name}</span>
                <span className="sticker bg-acid self-start">{DESIGN_STATUS_LABEL[d.status]}</span>
              </Link>
            );
          })}
        </div>
      </section>
      {feed.posts.length > 0 && (
        <section className="flex flex-col gap-3 max-w-2xl">
          <h2 className="h-display text-3xl">Posts</h2>
          {feed.posts.map((p) => <PostCard key={p.id} post={p} liked={feed.liked.has(p.id)} reposted={feed.reposted.has(p.id)} userId={session?.user.id ?? null} />)}
        </section>
      )}
    </div>
  );
}
