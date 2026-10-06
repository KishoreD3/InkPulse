// Share images for designs: 1200×630 link previews and 1080×1920 story cards.
// Rendered with next/og (Satori) on the edge runtime, so: inline styles, flexbox only.
import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const BRAND = { lavender: '#E4DEFF', ink: '#111111', pink: '#FF3EA5', acid: '#E4FF3B', cobalt: '#2F4BFF', paper: '#FFFFFF' };

const TILES = ['#FF3EA5', '#E4FF3B', '#111111', '#BFEBD6', '#2F4BFF', '#FFFFFF'];
function tileFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TILES[h % TILES.length];
}

const TEE_BODY =
  'M72 24 C80 31 90 34 100 34 C110 34 120 31 128 24 L157 33 C166 36 172 41 176 48 L191 84 C183 89 174 92 165 93 L156 73 C155 100 156 140 158 186 C120 190 80 190 42 186 C44 140 45 100 44 73 L35 93 C26 92 17 89 9 84 L24 48 C28 41 34 36 43 33 Z';
const TEE_NECK = 'M72 24 C82 16 118 16 128 24 C120 31 110 34 100 34 C90 34 80 31 72 24Z';

function teeSvg(hex: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs><linearGradient id="s" x1="0" x2="1"><stop offset="0" stop-opacity="0.28"/><stop offset="0.25" stop-opacity="0"/><stop offset="0.75" stop-opacity="0"/><stop offset="1" stop-opacity="0.28"/></linearGradient></defs>
  <path d="${TEE_NECK}" fill="${hex}"/><path d="${TEE_NECK}" fill="#000" opacity="0.38"/>
  <path d="${TEE_BODY}" fill="${hex}" stroke="#111" stroke-width="2"/>
  <path d="${TEE_BODY}" fill="url(#s)"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type')?.split(';')[0] || (url.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(type)) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > 4_000_000) return null;
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `data:${type};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

export interface CardDesign {
  slug: string; name: string; status: string; vote_count: number; backer_count: number; final_rank: number | null;
  colours: { name: string; hex: string; art?: string }[]; art_front_url: string;
  artist: { handle: string } | null; drop: { number: number; locks_at: string } | null;
}

export async function loadCardDesign(slug: string): Promise<CardDesign | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await db.from('designs')
    .select('slug, name, status, vote_count, backer_count, final_rank, colours, art_front_url, artist:profiles!designs_artist_id_fkey(handle), drop:drops(number, locks_at)')
    .eq('slug', slug).in('status', ['live', 'won', 'lost']).maybeSingle();
  return (data as unknown as CardDesign) ?? null;
}

let font: Promise<ArrayBuffer> | null = null;
function anton() {
  font ??= fetch(new URL('./anton.woff', import.meta.url)).then((r) => r.arrayBuffer());
  return font;
}

export type CardKind = 'design' | 'voted' | 'backed' | 'artist';

const HEADLINES: Record<CardKind, string> = {
  design: '', voted: 'I VOTED FOR', backed: 'I BACKED', artist: 'VOTE FOR MY DESIGN',
};

function statusLine(d: CardDesign) {
  if (d.status === 'won') return d.final_rank ? `PRINTED · FINISHED #${d.final_rank}` : 'BACK BY DEMAND';
  if (d.status === 'lost') return `FINISHED #${d.final_rank ?? '—'}`;
  return 'ONLY THE TOP 3 GET PRINTED';
}

function cta(d: CardDesign) {
  if (d.status === 'live') return 'VOTE BEFORE THURSDAY';
  if (d.status === 'won') return 'ON SALE NOW';
  return 'SEE THIS WEEK’S DROP';
}

export async function renderCard(origin: string, d: CardDesign, kind: CardKind, size: 'og' | 'story') {
  const c = d.colours[0] ?? { name: 'Default', hex: '#FFFFFF' };
  const artUrl = c.art || d.art_front_url;
  const art = await toDataUri(artUrl.startsWith('http') ? artUrl : `${origin}${artUrl}`);
  const tile = tileFor(d.slug);
  const story = size === 'story';
  const W = story ? 1080 : 1200;
  const H = story ? 1920 : 630;
  const teeSize = story ? 860 : 520;
  const dropNo = d.drop ? `DROP ${String(d.drop.number).padStart(3, '0')}` : 'INKPULSE';
  const headline = HEADLINES[kind];
  const nameSize = Math.max(story ? 96 : 64, Math.min(story ? 170 : 120, Math.floor((story ? 1500 : 1100) / Math.max(d.name.length, 6))));

  const teeBlock = (
    <div style={{ display: 'flex', position: 'relative', width: teeSize, height: teeSize, background: tile, border: `6px solid ${BRAND.ink}`, borderRadius: 36, boxShadow: `14px 14px 0 ${BRAND.ink}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img src={teeSvg(c.hex)} width={teeSize - 40} height={teeSize - 40} style={{ position: 'absolute', left: 14, top: 18 }} />
      {art && (
        // Chest print area of the 200×200 tee: x 62–138, y 52–164.
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={art} width={(teeSize - 40) * 0.38} height={(teeSize - 40) * 0.56}
          style={{ position: 'absolute', left: 14 + (teeSize - 40) * 0.31, top: 18 + (teeSize - 40) * 0.26, objectFit: 'contain' }} />
      )}
    </div>
  );

  const stats = (
    <div style={{ display: 'flex', gap: 18 }}>
      {[[d.vote_count.toLocaleString('en-IN'), 'VOTES'], [d.backer_count.toLocaleString('en-IN'), 'BACKERS']].map(([v, l]) => (
        <div key={l} style={{ display: 'flex', flexDirection: 'column', background: BRAND.paper, border: `5px solid ${BRAND.ink}`, borderRadius: 22, padding: story ? '18px 30px' : '10px 22px' }}>
          <span style={{ fontSize: story ? 84 : 52, lineHeight: 1 }}>{v}</span>
          <span style={{ fontSize: story ? 30 : 20, letterSpacing: 2 }}>{l}</span>
        </div>
      ))}
    </div>
  );

  const body = story ? (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', height: '100%', padding: '90px 70px', gap: 44 }}>
      <div style={{ display: 'flex', fontSize: 44, letterSpacing: 6, background: BRAND.ink, color: BRAND.acid, padding: '0px 30px 18px', borderRadius: 999 }}>{dropNo} · INKPULSE</div>
      {headline && <div style={{ display: 'flex', fontSize: 96, color: BRAND.pink, transform: 'rotate(-3deg)', textShadow: `5px 5px 0 ${BRAND.ink}` }}>{headline}</div>}
      {teeBlock}
      <div style={{ display: 'flex', fontSize: nameSize, lineHeight: 0.95, textAlign: 'center', textTransform: 'uppercase' }}>{d.name}</div>
      <div style={{ display: 'flex', fontSize: 52 }}>BY @{d.artist?.handle ?? 'artist'}</div>
      {stats}
      <div style={{ display: 'flex', marginTop: 'auto', fontSize: 58, background: BRAND.pink, border: `6px solid ${BRAND.ink}`, borderRadius: 26, padding: '0px 44px 32px', boxShadow: `10px 10px 0 ${BRAND.ink}` }}>{cta(d)}</div>
    </div>
  ) : (
    <div style={{ display: 'flex', width: '100%', height: '100%', padding: 50, gap: 54, alignItems: 'center' }}>
      {teeBlock}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
        <div style={{ display: 'flex', alignSelf: 'flex-start', fontSize: 28, letterSpacing: 4, background: BRAND.ink, color: BRAND.acid, padding: '0px 20px 8px', borderRadius: 999 }}>{headline || dropNo}</div>
        <div style={{ display: 'flex', fontSize: nameSize, lineHeight: 0.92, textTransform: 'uppercase' }}>{d.name}</div>
        <div style={{ display: 'flex', fontSize: 34 }}>BY @{d.artist?.handle ?? 'artist'}</div>
        {stats}
        <div style={{ display: 'flex', fontSize: 30, color: BRAND.cobalt }}>{statusLine(d)}</div>
        <div style={{ display: 'flex', alignSelf: 'flex-start', fontSize: 36, background: BRAND.pink, border: `5px solid ${BRAND.ink}`, borderRadius: 20, padding: '0px 24px 12px', boxShadow: `7px 7px 0 ${BRAND.ink}` }}>{cta(d)} · INKPULSE</div>
      </div>
    </div>
  );

  return new ImageResponse(
    <div style={{ display: 'flex', width: W, height: H, background: BRAND.lavender, color: BRAND.ink, fontFamily: 'Anton' }}>{body}</div>,
    {
      width: W, height: H,
      fonts: [{ name: 'Anton', data: await anton(), weight: 400, style: 'normal' }],
      headers: { 'cache-control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600' },
    },
  );
}

export async function fallbackCard() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: 1200, height: 630, background: BRAND.lavender, alignItems: 'center', justifyContent: 'center', fontFamily: 'Anton', fontSize: 140, color: BRAND.ink }}>
      INKPULSE
    </div>,
    { width: 1200, height: 630, fonts: [{ name: 'Anton', data: await anton(), weight: 400, style: 'normal' }] },
  );
}
