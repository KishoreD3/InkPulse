import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { getStoreSession } from '@/lib/dnd/session';
import { COLOURS, moods } from '@/lib/dnd/catalog';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

const schema = z.object({
  title: z.string().trim().min(2, 'Give it a title.').max(40),
  mood: z.string().refine((m) => moods.some((x) => x.name === m), 'Pick a mood.'),
  story: z.string().trim().max(500).default(''),
  tags: z.string().trim().max(200).default(''),
  colours: z.array(z.string()).min(1, 'Pick at least one tee colour.').max(5),
  artUrl: z.string().url(),
});

function topicError(message: string): string {
  if (message.includes('topic_closed')) return 'Submissions for this topic have closed.';
  const limit = message.match(/topic_limit:(\d+)/);
  if (limit) return `You can send up to ${limit[1]} designs per topic.`;
  return 'Couldn’t submit. Try again.';
}

/** A studio submission: artwork already uploaded to Storage, sent for review against the open topic. */
export async function POST(request: Request) {
  const session = await getStoreSession();
  if (!session) return NextResponse.json({ error: 'Sign in to submit.' }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the details.' }, { status: 400 });
  const v = parsed.data;

  // Only artwork in this member's own upload folder.
  const url = new URL(v.artUrl);
  if (url.host !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host || !url.pathname.includes(`/artwork/${session.id}/`)) {
    return NextResponse.json({ error: 'Upload the artwork through the studio.' }, { status: 400 });
  }

  const db = createClient();
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: open } = await db.from('drops').select('id').eq('status', 'scheduled')
    .lte('topic_at', now).gt('submissions_close_at', now).order('opens_at').limit(1).maybeSingle();
  if (!open) return NextResponse.json({ error: 'No topic is taking submissions right now.' }, { status: 409 });

  // Accepting the originality pledge in the studio is accepting the artist terms.
  if (!session.isArtist) {
    await admin.from('profiles').update({ is_artist: true }).eq('id', session.id);
    await admin.from('audit_log').insert({ actor_id: session.id, action: 'artist.enable', target: session.id, detail: { via: 'studio' } });
  }

  const colours = v.colours.map((name) => COLOURS.find((c) => c.name === name)).filter(Boolean).map((c) => ({ name: c!.name, hex: c!.hex }));
  const { data, error } = await db.from('designs').insert({
    slug: `${slugify(v.title) || 'design'}-${crypto.randomBytes(2).toString('hex')}`.slice(0, 80),
    artist_id: session.id, name: v.title, story: v.story || null, category: v.mood, mood: v.mood,
    tags: v.tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 8).map((t) => t.slice(0, 24)),
    colours, art_front_url: v.artUrl, originality_confirmed: true, status: 'in_review', submitted_for: open.id,
  }).select('id').single();
  if (error || !data) return NextResponse.json({ error: topicError(error?.message ?? '') }, { status: 409 });
  return NextResponse.json({ id: data.id });
}
