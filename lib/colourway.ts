// Plain (non-client) helpers so both server and client components can call them.
// They used to live in components/Tee.tsx, which is a 'use client' module — calling
// them from a server component threw "colourway is not a function" at runtime.

/** Pick the shirt colour + artwork for a colourway (falls back to the first colour). */
export function colourway(design: { colours: { name: string; hex: string; art?: string }[]; art_front_url: string }, name?: string) {
  const c = design.colours.find((x) => x.name === name) ?? design.colours[0] ?? { name: 'Default', hex: '#FFFFFF' };
  return { name: c.name, hex: c.hex, art: c.art || design.art_front_url };
}

/** Soft studio backdrops for product shots; rotate per design so a grid doesn't look flat. */
const TILES = [
  { bg: '#EFEDE6', dark: false },
  { bg: '#E6EEF2', dark: false },
  { bg: '#F3E9DC', dark: false },
  { bg: '#E8F0E6', dark: false },
  { bg: '#F1E6EF', dark: false },
  { bg: '#ECECEA', dark: false },
];
export function tileFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TILES[h % TILES.length];
}
