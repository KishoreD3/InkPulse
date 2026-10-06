import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { POST_SELECT } from '@/lib/feed';
import { timeAgo } from '@/lib/format';
import { Avatar, PostCard } from '@/components/PostCard';
import { CommentForm } from '@/components/CommentForm';
import { ReportButton } from '@/components/ReportButton';
import type { Comment, Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const session = await getSession();
  const { data } = await supabase.from('posts').select(POST_SELECT).eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const post = data as Post;
  const { data: comments } = await supabase.from('comments')
    .select('*, author:profiles!comments_author_id_fkey(id, handle, name, avatar_url, is_artist)')
    .eq('post_id', post.id).order('created_at');
  let liked = false; let reposted = false;
  if (session) {
    const [{ count: l }, { count: r }] = await Promise.all([
      supabase.from('likes').select('post_id', { count: 'exact', head: true }).eq('post_id', post.id).eq('user_id', session.user.id),
      supabase.from('reposts').select('post_id', { count: 'exact', head: true }).eq('post_id', post.id).eq('user_id', session.user.id),
    ]);
    liked = (l ?? 0) > 0; reposted = (r ?? 0) > 0;
  }
  return (
    <div className="container-page py-6 max-w-2xl flex flex-col gap-5">
      <PostCard post={post} liked={liked} reposted={reposted} userId={session?.user.id ?? null} />
      <CommentForm postId={post.id} signedIn={Boolean(session)} />
      <div className="flex flex-col gap-4">
        {((comments ?? []) as Comment[]).map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar handle={c.author?.handle ?? '?'} url={c.author?.avatar_url} size={36} />
            <div className="flex-1 text-[15px]">
              <span className="font-bold">@{c.author?.handle}</span> <span className="font-mono text-[11px] text-muted">{timeAgo(c.created_at)}</span>
              <p className="leading-relaxed">{c.body}</p>
            </div>
            <ReportButton targetType="comment" targetId={c.id} signedIn={Boolean(session)} />
          </div>
        ))}
      </div>
    </div>
  );
}
