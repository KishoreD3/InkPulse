import 'server-only';
// Builds the store catalogue from Supabase (or the demo catalogue when no database is set up).
// Public data only, read with the anon key and cached for a short while.
import { unstable_cache } from 'next/cache';
import { createClient as createPlainClient } from '@supabase/supabase-js';
import { isConfigured, publicEnv } from '@/lib/env';
import { COLOURS, NO_PHOTO, type Artist, type Catalog, type ColourKey, type Fit, type Product, type Stage } from './catalog';
import { demoCatalog } from './demo';

export const CATALOG_TAG = 'catalog';

type DesignRow = {
  id: string; slug: string; name: string; story: string | null; status: 'live' | 'won' | 'lost';
  artist_id: string; artist_handle: string; artist_name: string; artist_city: string | null;
  drop_id: string | null; drop_number: number | null; topic: string | null; mood: string | null; fit: Fit;
  colours: { name: string; hex: string }[]; collections: string[]; photo_urls: string[]; mockup_url: string | null;
  art_front_url: string; care_label: string | null; badge: string | null; vote_count: number; backer_count: number;
  final_rank: number | null; retail_until: string | null; sold: number; rating: number | null; reviews: number;
};
type ArtistRow = {
  id: string; handle: string; name: string; city: string | null; tagline: string | null; styles: string[]; bio: string | null;
  avatar_url: string | null; cover_url: string | null; wins: number; finalists: number; votes: number; sold: number; followers: number;
};
type DropRow = {
  id: string; number: number; status: string; opens_at: string; locks_at: string; prints_at: string; topic_at: string; submissions_close_at: string;
};
type TopicRow = { drop_id: string; title: string; brief: string | null; prompts: string[] };

const t = (iso: string) => new Date(iso).getTime();
const pad = (n: number) => String(n).padStart(3, '0');
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n));
const colourKeys = (list: { name: string }[]): ColourKey[] => {
  const keys = list.map((c) => COLOURS.find((x) => x.name === c.name)?.key).filter(Boolean) as ColourKey[];
  return keys.length ? keys : ['black'];
};
const styleList = (s: string[]) => s.filter((x): x is 'Typography' | 'Illustration' => x === 'Typography' || x === 'Illustration');

function anon() {
  return createPlainClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function fetchLive(): Promise<Catalog> {
  const db = anon();
  const now = Date.now();
  const [settingsRes, designsRes, artistsRes, archiveRes, dropsRes] = await Promise.all([
    db.from('settings').select('backer_price, retail_price, mrp, artist_pct, winners_per_drop, max_designs_per_artist, require_phone_for_votes').single(),
    db.rpc('store_designs'),
    db.rpc('store_artists'),
    db.rpc('store_archive', { p_limit: 6 }),
    db.from('drops').select('id, number, status, opens_at, locks_at, prints_at, topic_at, submissions_close_at')
      .in('status', ['scheduled', 'live', 'locked', 'printing']).order('opens_at'),
  ]);
  for (const r of [settingsRes, designsRes, artistsRes, archiveRes, dropsRes]) if (r.error) throw new Error(`catalogue: ${r.error.message}`);

  const s = settingsRes.data as { backer_price: number; retail_price: number; mrp: number; artist_pct: number; winners_per_drop: number; max_designs_per_artist: number; require_phone_for_votes: boolean };
  const designs = (designsRes.data ?? []) as DesignRow[];
  const drops = (dropsRes.data ?? []) as DropRow[];
  const { data: topicRows } = drops.length
    ? await db.from('drop_topics').select('drop_id, title, brief, prompts').in('drop_id', drops.map((d) => d.id))
    : { data: [] };
  const topics = new Map(((topicRows ?? []) as TopicRow[]).map((x) => [x.drop_id, x]));

  const liveDrop = drops.find((d) => d.status === 'live');
  const scheduled = drops.filter((d) => d.status === 'scheduled');
  const openDrop = scheduled.find((d) => t(d.topic_at) <= now && now < t(d.submissions_close_at));
  const reviewDrop = scheduled.find((d) => t(d.submissions_close_at) <= now);
  const printing = [...drops].reverse().find((d) => d.status === 'locked' || d.status === 'printing');
  const nextVote = liveDrop ?? reviewDrop ?? scheduled[0];

  const prices = {
    back: s.backer_price, retail: s.retail_price, mrp: s.mrp, artistPct: Number(s.artist_pct),
    artistShare: Math.round((s.retail_price * Number(s.artist_pct)) / 100),
  };

  // "New" is the latest printed drop and "Bestsellers" the top sellers, on top of what admins tag by hand.
  const onSale = designs.filter((d) => d.status === 'won' && (!d.retail_until || t(d.retail_until) > now));
  const newest = Math.max(0, ...onSale.map((d) => d.drop_number ?? 0));
  const best = new Set(onSale.filter((d) => d.sold > 0).sort((a, b) => b.sold - a.sold).slice(0, 4).map((d) => d.id));
  const collectionsOf = (d: DesignRow) => Array.from(new Set([
    ...d.collections, ...(d.drop_number === newest ? ['new'] : []), ...(best.has(d.id) ? ['bestsellers'] : []),
  ]));

  const winners: Product[] = onSale
    .sort((a, b) => (b.drop_number ?? 0) - (a.drop_number ?? 0) || (a.final_rank ?? 9) - (b.final_rank ?? 9))
    .map((d, i) => ({
      id: d.slug, uuid: d.id, name: d.name, artist: d.artist_name, artistSlug: d.artist_handle, city: d.artist_city ?? '', image: i % 8,
      photos: d.photo_urls.length ? d.photo_urls : [d.mockup_url ?? d.art_front_url],
      badge: d.badge ?? (!d.drop_number ? 'DND STUDIO' : d.final_rank === 1 ? `WINNER · DROP ${pad(d.drop_number)}` : 'WINNER'),
      rating: Number(d.rating ?? 0), reviews: d.reviews, mood: d.mood ?? '', care: d.care_label ?? 'DO NOT DISTURB',
      fit: d.fit, colours: colourKeys(d.colours), collections: collectionsOf(d), drop: d.drop_number ?? 0, topic: d.topic ?? 'Open theme',
      sold: d.sold, story: d.story ?? '',
    }));

  const finalists = liveDrop
    ? designs.filter((d) => d.status === 'live' && d.drop_id === liveDrop.id).map((d, i) => {
      const card = d.mockup_url ?? d.photo_urls[0] ?? d.art_front_url;
      return {
        id: d.slug, uuid: d.id, name: d.name, artist: d.artist_name, artistSlug: d.artist_handle, city: d.artist_city ?? '',
        votes: d.vote_count, backers: d.backer_count, image: i % 8, rate: 0, story: d.story ?? '',
        card, photos: d.photo_urls.length ? d.photo_urls : [card], colours: colourKeys(d.colours),
      };
    })
    : [];

  const artists: Artist[] = ((artistsRes.data ?? []) as ArtistRow[])
    .sort((a, b) => b.followers - a.followers || b.wins - a.wins)
    .map((a, i) => ({
      uuid: a.id, slug: a.handle, name: a.name, city: a.city ?? '', wins: a.wins, finalists: a.finalists, followers: a.followers,
      image: i % 8, styles: styleList(a.styles ?? []), tagline: a.tagline ?? '', bio: a.bio ?? '',
      votes: compact(a.votes), sold: compact(a.sold), photo: a.avatar_url, cover: a.cover_url,
    }));

  const battleTopic = nextVote ? topics.get(nextVote.id) : undefined;
  const battle = nextVote
    ? {
      uuid: nextVote.id, drop: nextVote.number, topic: battleTopic?.title ?? 'Open theme', brief: battleTopic?.brief ?? '',
      winners: s.winners_per_drop, opensAt: t(nextVote.opens_at), closesAt: t(nextVote.locks_at), printsAt: t(nextVote.prints_at),
      live: Boolean(liveDrop),
    }
    : { drop: 0, topic: 'Next battle', brief: '', winners: s.winners_per_drop, opensAt: now, closesAt: now, printsAt: now, live: false };

  let openTopic: Catalog['openTopic'] = null;
  if (openDrop) {
    const topic = topics.get(openDrop.id);
    const { data: entries } = await db.rpc('topic_submission_count', { p_drop: openDrop.id });
    openTopic = {
      uuid: openDrop.id, drop: openDrop.number, title: topic?.title ?? 'Open theme', brief: topic?.brief ?? 'Any idea, any style.',
      prompts: topic?.prompts ?? [], entries: (entries as number) ?? 0, maxEntries: s.max_designs_per_artist, closesAt: t(openDrop.submissions_close_at),
    };
  }

  const title = (d: DropRow) => topics.get(d.id)?.title ?? 'Open theme';
  const stages: Stage[] = [
    ...(openDrop ? [{ drop: openDrop.number, title: title(openDrop), phase: 'submissions' as const, at: t(openDrop.submissions_close_at) }] : []),
    ...(reviewDrop && reviewDrop !== openDrop ? [{ drop: reviewDrop.number, title: title(reviewDrop), phase: 'review' as const, at: t(reviewDrop.opens_at) }] : []),
    ...(liveDrop ? [{ drop: liveDrop.number, title: title(liveDrop), phase: 'voting' as const, at: t(liveDrop.locks_at) }] : []),
    ...(printing ? [{ drop: printing.number, title: title(printing), phase: 'printing' as const, at: null }] : []),
  ];

  const archive = ((archiveRes.data ?? []) as { drop_number: number; title: string; votes: number }[]).slice(0, 3).map((a) => ({
    drop: a.drop_number, title: a.title, votes: a.votes,
    thumbs: designs.filter((d) => d.drop_number === a.drop_number && d.status === 'won')
      .sort((x, y) => (x.final_rank ?? 9) - (y.final_rank ?? 9)).slice(0, 3)
      .map((d) => d.photo_urls[0] ?? d.mockup_url ?? d.art_front_url),
  })).map((a) => ({ ...a, thumbs: a.thumbs.length ? a.thumbs : [NO_PHOTO] }));

  return { mode: 'live', prices, winners, finalists, artists, battle, openTopic, stages, archive, requirePhone: s.require_phone_for_votes };
}

const cachedLive = unstable_cache(fetchLive, ['dnd-catalog'], { revalidate: 30, tags: [CATALOG_TAG] });

/** The catalogue for this request. Never throws: a database problem falls back to an empty live catalogue. */
export async function getCatalog(): Promise<Catalog> {
  if (!isConfigured()) return demoCatalog();
  try {
    const cat = await cachedLive();
    if (await advanceIfDue(cat)) return await fetchLive();
    return cat;
  } catch (e) {
    console.error('[catalog] could not load from Supabase', e);
    const demo = demoCatalog();
    return { ...demo, mode: 'live', winners: [], finalists: [], artists: [], stages: [], archive: [], openTopic: null, battle: { ...demo.battle, live: false, drop: 0, topic: 'Next battle' } };
  }
}

/**
 * The weekly scheduler runs once a day on Vercel's free plan. When a battle is due to open
 * or lock before then, the first visitor after that moment moves it along (service role).
 * Returns true when the cached catalogue is out of date and should be read fresh.
 */
let lastCatchUp = 0;
async function advanceIfDue(cat: Catalog): Promise<boolean> {
  const now = Date.now();
  const due = (cat.battle.live && cat.battle.closesAt <= now) || (!cat.battle.live && cat.battle.drop > 0 && cat.battle.opensAt <= now);
  if (!due || !(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)) return false;
  if (now - lastCatchUp < 60_000) return true;
  lastCatchUp = now;
  try {
    const { tick } = await import('@/lib/jobs');
    await tick();
  } catch (e) {
    console.error('[catalog] scheduler catch-up failed', e);
  }
  return true;
}
