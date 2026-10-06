import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Post } from '@/lib/types';

export const POST_SELECT =
  '*, author:profiles!posts_author_id_fkey(id, handle, name, avatar_url, is_artist), design:designs(id, slug, name, colours, art_front_url, vote_count, status)';

export async function loadPosts(opts: { limit?: number; tab?: 'all' | 'following' | 'artists'; userId?: string | null; authorId?: string } = {}) {
  const supabase = createClient();
  let q = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(opts.limit ?? 30);
  if (opts.tab === 'artists') q = q.in('kind', ['artist', 'system']);
  if (opts.authorId) q = q.eq('author_id', opts.authorId);
  if (opts.tab === 'following' && opts.userId) {
    const { data: f } = await supabase.from('follows').select('artist_id').eq('follower_id', opts.userId);
    const ids = (f ?? []).map((x) => x.artist_id as string);
    if (ids.length === 0) return { posts: [] as Post[], liked: new Set<string>(), reposted: new Set<string>() };
    q = q.in('author_id', ids);
  }
  const { data } = await q;
  const posts = (data ?? []) as Post[];
  const liked = new Set<string>();
  const reposted = new Set<string>();
  if (opts.userId && posts.length) {
    const ids = posts.map((p) => p.id);
    const [{ data: l }, { data: r }] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', opts.userId).in('post_id', ids),
      supabase.from('reposts').select('post_id').eq('user_id', opts.userId).in('post_id', ids),
    ]);
    (l ?? []).forEach((x) => liked.add(x.post_id as string));
    (r ?? []).forEach((x) => reposted.add(x.post_id as string));
  }
  return { posts, liked, reposted };
}
