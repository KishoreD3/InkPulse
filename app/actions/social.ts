'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';

type Result = { ok: true } | { ok: false; error: string };

const postSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(280, 'Keep it under 280 characters'),
  designId: z.string().uuid().optional().or(z.literal('')),
  imageUrls: z.array(z.string().url()).max(4).default([]),
});

export async function createPost(input: { body: string; designId?: string; imageUrls?: string[] }): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in to post.' };
  const parsed = postSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { error } = await createClient().from('posts').insert({
    author_id: session.user.id,
    kind: session.profile.is_artist ? 'artist' : 'member',
    body: parsed.data.body,
    design_id: parsed.data.designId || null,
    image_urls: parsed.data.imageUrls,
  });
  if (error) return { ok: false, error: 'Could not post. Try again.' };
  revalidatePath('/pulse');
  return { ok: true };
}

const commentSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(500),
  postId: z.string().uuid().optional(),
  designId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
});

export async function addComment(input: z.input<typeof commentSchema>): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in to comment.' };
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!parsed.data.postId === !parsed.data.designId) return { ok: false, error: 'Bad request.' };
  const { error } = await createClient().from('comments').insert({
    author_id: session.user.id,
    body: parsed.data.body,
    post_id: parsed.data.postId ?? null,
    design_id: parsed.data.designId ?? null,
    parent_id: parsed.data.parentId ?? null,
  });
  if (error) return { ok: false, error: 'Could not comment. Try again.' };
  if (parsed.data.postId) revalidatePath(`/pulse/${parsed.data.postId}`);
  return { ok: true };
}

export async function reportContent(targetType: 'post' | 'comment' | 'design' | 'profile' | 'review', targetId: string, reason: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in to report.' };
  if (!reason || reason.length < 3) return { ok: false, error: 'Pick a reason.' };
  const { error } = await createClient().from('reports').insert({
    reporter_id: session.user.id, target_type: targetType, target_id: targetId, reason: reason.slice(0, 300),
  });
  if (error && !error.message.includes('duplicate')) return { ok: false, error: 'Could not send the report.' };
  return { ok: true };
}

export async function toggleFollow(artistId: string, follow: boolean): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in to follow.' };
  const supabase = createClient();
  const { error } = follow
    ? await supabase.from('follows').insert({ follower_id: session.user.id, artist_id: artistId })
    : await supabase.from('follows').delete().eq('follower_id', session.user.id).eq('artist_id', artistId);
  if (error && !error.message.includes('duplicate')) return { ok: false, error: 'Could not update.' };
  return { ok: true };
}

export async function voteCause(causeId: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in to vote.' };
  const { error } = await createClient().rpc('vote_cause', { p_cause: causeId });
  if (error) {
    if (error.message.includes('phone_not_verified')) return { ok: false, error: 'Verify your phone number to vote.' };
    if (error.message.includes('voting_locked')) return { ok: false, error: 'The cause vote for this drop is closed.' };
    return { ok: false, error: 'Could not record your vote.' };
  }
  revalidatePath('/causes');
  return { ok: true };
}

export async function markAllRead(): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Sign in.' };
  await createClient().from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', session.user.id).is('read_at', null);
  revalidatePath('/notifications');
  return { ok: true };
}
