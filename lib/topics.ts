import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Drop, DropPhase, DropTopic } from '@/lib/types';

export type DropWithTopic = Drop & { topic: DropTopic | null };

export function dropPhase(d: Pick<Drop, 'status' | 'topic_at' | 'submissions_close_at'>, now = Date.now()): DropPhase {
  if (d.status === 'live') return 'voting';
  if (d.status !== 'scheduled') return d.status;
  if (now < new Date(d.topic_at).getTime()) return 'upcoming';
  if (now < new Date(d.submissions_close_at).getTime()) return 'submissions';
  return 'review';
}

/** Every drop that is still in flight (scheduled or live), oldest first, with its topic if published. */
export const getPipeline = cache(async (): Promise<DropWithTopic[]> => {
  const supabase = createClient();
  const { data: drops } = await supabase.from('drops').select('*').in('status', ['scheduled', 'live']).order('opens_at');
  const list = (drops ?? []) as Drop[];
  if (!list.length) return [];
  const { data: topics } = await supabase.from('drop_topics').select('*').in('drop_id', list.map((d) => d.id));
  const byDrop = new Map(((topics ?? []) as DropTopic[]).map((t) => [t.drop_id, t]));
  return list.map((d) => ({ ...d, topic: byDrop.get(d.id) ?? null }));
});

/** Drops currently taking submissions. */
export async function getOpenTopics(): Promise<DropWithTopic[]> {
  return (await getPipeline()).filter((d) => dropPhase(d) === 'submissions');
}

export async function getTopic(dropId: string | null | undefined): Promise<DropTopic | null> {
  if (!dropId) return null;
  const { data } = await createClient().from('drop_topics').select('*').eq('drop_id', dropId).maybeSingle();
  return (data as DropTopic) ?? null;
}

export const topicTitle = (t: DropTopic | null | undefined) => t?.title ?? 'Open theme';
