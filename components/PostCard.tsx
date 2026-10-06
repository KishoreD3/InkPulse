'use client';
import Link from 'next/link';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';
import { Tee, colourway } from './Tee';
import { Bolt, Comment, Heart, Repost } from './Icons';
import { ReportButton } from './ReportButton';
import { toast } from './Toaster';
import type { Post } from '@/lib/types';

const AVATAR_BG = ['#2F4BFF', '#E4FF3B', '#FF3EA5', '#8A2414', '#BFEBD6'];

export function Avatar({ handle, url, size = 40 }: { handle: string; url?: string | null; size?: number }) {
  const bg = AVATAR_BG[handle.length % AVATAR_BG.length];
  const dark = bg === '#2F4BFF' || bg === '#8A2414';
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className="rounded-full border-2 border-ink object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="rounded-full border-2 border-ink grid place-items-center font-display shrink-0"
      style={{ width: size, height: size, background: bg, color: dark ? '#fff' : '#111', fontSize: size * 0.42 }}>
      {handle.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function PostCard({ post, liked: likedInit, reposted: repostedInit, userId }: {
  post: Post; liked: boolean; reposted: boolean; userId: string | null;
}) {
  const [liked, setLiked] = useState(likedInit);
  const [likes, setLikes] = useState(post.like_count);
  const [reposted, setReposted] = useState(repostedInit);
  const [reposts, setReposts] = useState(post.repost_count);

  if (post.kind === 'system') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 border-2 border-ink rounded-[14px] bg-acid -rotate-[0.6deg]">
        <Bolt size={24} filled />
        <p className="flex-1 font-display text-[17px] leading-tight tracking-wide uppercase">{post.body}</p>
        <span className="font-mono text-[11px]">{timeAgo(post.created_at)}</span>
      </div>
    );
  }

  async function toggle(kind: 'likes' | 'reposts', on: boolean) {
    if (!userId) { window.location.href = '/signin?next=/pulse'; return; }
    const supabase = getBrowserClient();
    const { error } = on
      ? await supabase.from(kind).insert({ user_id: userId, post_id: post.id })
      : await supabase.from(kind).delete().eq('user_id', userId).eq('post_id', post.id);
    if (error) toast({ message: 'That did not go through. Try again.', tone: 'error' });
    return !error;
  }

  const handle = post.author?.handle ?? 'someone';
  return (
    <article className="card p-3.5 flex flex-col gap-2.5">
      <header className="flex items-center gap-2.5">
        <Link href={`/a/${handle}`}><Avatar handle={handle} url={post.author?.avatar_url} /></Link>
        <div className="flex-1 min-w-0">
          <Link href={`/a/${handle}`} className="font-bold text-[15px] flex items-center gap-2">
            @{handle}
            {post.kind === 'artist' && <span className="-rotate-3 sticker bg-pink !text-[10px] !px-1.5 !py-0.5">Artist</span>}
          </Link>
          <p className="font-mono text-[11px] text-muted">{timeAgo(post.created_at)}</p>
        </div>
        <ReportButton targetType="post" targetId={post.id} signedIn={Boolean(userId)} />
      </header>
      <Link href={`/pulse/${post.id}`} className="text-[15px] leading-relaxed whitespace-pre-line">{post.body}</Link>
      {post.image_urls.length > 0 && (
        <div className={`grid gap-2 ${post.image_urls.length > 1 ? 'grid-cols-2' : ''}`}>
          {post.image_urls.map((src) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} src={src} alt="" className="w-full rounded-xl border-2 border-ink object-cover max-h-80" loading="lazy" />
          ))}
        </div>
      )}
      {post.design && (
        <Link href={`/d/${post.design.slug}`} className="flex items-center gap-3 p-2 border-2 border-ink rounded-xl bg-paper">
          <span className="w-16 h-16 border-2 border-ink rounded-[10px] bg-ink halftone-dark grid place-items-center shrink-0">
            <Tee {...(() => { const c = colourway(post.design!); return { shirt: c.hex, art: c.art }; })()} size={60} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-display text-lg uppercase truncate">{post.design.name}</span>
            <span className="block font-mono text-[11px] text-body">{post.design.vote_count.toLocaleString('en-IN')} VOTES</span>
          </span>
          {post.design.status === 'live' && <span className="bg-pink border-2 border-ink rounded-[10px] px-2.5 py-2 font-display text-[15px]">BACK</span>}
        </Link>
      )}
      <footer className="flex gap-1 -mx-2">
        <button aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'} className="h-10 px-2.5 flex items-center gap-1.5 font-mono font-bold text-xs"
          onClick={async () => {
            const on = !liked; setLiked(on); setLikes((n) => n + (on ? 1 : -1));
            if (!(await toggle('likes', on))) { setLiked(!on); setLikes((n) => n + (on ? -1 : 1)); }
          }}>
          <Heart size={18} filled={liked} />{likes.toLocaleString('en-IN')}
        </button>
        <Link href={`/pulse/${post.id}`} className="h-10 px-2.5 flex items-center gap-1.5 font-mono font-bold text-xs" aria-label="Comments">
          <Comment size={18} />{post.comment_count.toLocaleString('en-IN')}
        </Link>
        <button aria-pressed={reposted} className={`h-10 px-2.5 flex items-center gap-1.5 font-mono font-bold text-xs ${reposted ? 'text-cobalt' : ''}`}
          onClick={async () => {
            const on = !reposted; setReposted(on); setReposts((n) => n + (on ? 1 : -1));
            if (!(await toggle('reposts', on))) { setReposted(!on); setReposts((n) => n + (on ? -1 : 1)); }
          }}>
          <Repost size={18} />{reposts > 0 ? reposts.toLocaleString('en-IN') : 'REPOST'}
        </button>
      </footer>
    </article>
  );
}
