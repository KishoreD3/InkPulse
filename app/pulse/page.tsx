import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getLiveDrop } from '@/lib/data';
import { loadPosts } from '@/lib/feed';
import { dropLabel } from '@/lib/format';
import { PostCard } from '@/components/PostCard';
import { Composer } from './Composer';

export const metadata = { title: 'The Pulse' };
export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'all', label: 'For you' },
  { key: 'following', label: 'Following' },
  { key: 'artists', label: 'Artists only' },
] as const;

export default async function PulsePage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = (TABS.find((t) => t.key === searchParams.tab)?.key ?? 'all') as 'all' | 'following' | 'artists';
  const [session, drop] = await Promise.all([getSession(), getLiveDrop()]);
  const { posts, liked, reposted } = await loadPosts({ tab, userId: session?.user.id, limit: 40 });

  return (
    <div className="container-page py-6 max-w-2xl flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="h-display text-[40px] misprint">The Pulse</h1>
        {drop && <span className="rotate-[4deg] sticker bg-acid">{dropLabel(drop.number)}</span>}
      </header>
      {session ? <Composer handle={session.profile.handle} /> : (
        <Link href="/signin?next=/pulse" className="card-flat p-4 font-semibold">Sign in to hype a design or tag an artist →</Link>
      )}
      <nav className="flex gap-2" aria-label="Feed">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === 'all' ? '/pulse' : `/pulse?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}
            className={tab === t.key ? 'chip-on' : 'chip-off'}>{t.label}</Link>
        ))}
      </nav>
      {posts.length === 0 && (
        <p className="card-flat p-6 text-center">{tab === 'following' ? 'Follow some artists to fill this tab.' : 'Quiet in here. Be the first to post.'}</p>
      )}
      {posts.map((p) => (
        <PostCard key={p.id} post={p} liked={liked.has(p.id)} reposted={reposted.has(p.id)} userId={session?.user.id ?? null} />
      ))}
    </div>
  );
}
