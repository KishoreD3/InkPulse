// The DND Club catalogue: types shared by every store screen, the fixed option lists
// (sizes, colours, fits, moods) and the demo catalogue the store runs on when no
// database is connected. With Supabase configured, lib/dnd/load.ts builds the same
// shapes from the database. Ids are design slugs, so links work in both modes.

export const BACK = 899;
export const RETAIL = 1099;
export const MRP = 1349;
export const ARTIST_PCT = 15;
export const ARTIST_SHARE = Math.round((RETAIL * ARTIST_PCT) / 100);
export const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'] as const;
export type Size = (typeof SIZES)[number];

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
export const num = (n: number) => Math.round(n).toLocaleString('en-IN');
export const off = (p: number, mrp = MRP) => Math.round(((mrp - p) / mrp) * 100);

export type ColourKey = 'black' | 'cream' | 'purple' | 'navy' | 'yellow';
export const COLOURS: { key: ColourKey; name: string; hex: string }[] = [
  { key: 'black', name: 'Washed Black', hex: '#1b1a1f' },
  { key: 'cream', name: 'Moon Cream', hex: '#F4ECDD' },
  { key: 'purple', name: 'DND Purple', hex: '#6C4BFF' },
  { key: 'navy', name: 'Night Navy', hex: '#16123A' },
  { key: 'yellow', name: 'Moon Yellow', hex: '#FFD23F' },
];
export const colourOf = (k: string) => COLOURS.find((c) => c.key === k) ?? COLOURS[0];

export const FITS = [
  { name: 'Oversized', sub: '240 GSM heavy' },
  { name: 'Classic Crew', sub: 'Everyday regular' },
  { name: 'Boxy Crop', sub: 'Dropped shoulder' },
  { name: 'Relaxed Fit', sub: 'Soft bio-wash' },
] as const;
export type Fit = (typeof FITS)[number]['name'];

export const COLLECTIONS = [
  { slug: 'new', name: 'New Winners', tag: 'Drop 043' },
  { slug: 'bestsellers', name: 'Club Bestsellers', tag: 'Top rated' },
  { slug: 'back-in-stock', name: 'Back in Stock', tag: 'Freshly restocked' },
  { slug: 'under-999', name: 'Under ₹999', tag: 'Backer deals' },
] as const;

/** Soft backdrops behind each photo, shown while an image loads. */
export const tints = ['#EDE8FF', '#FFF1C7', '#DFF5E8', '#FFE1E6', '#E2EEFF', '#F4ECDD', '#E9F7C9', '#FBE3D2'];

export const img = {
  /** Winner tee shots: 1 model (card + gallery main), 2 flat-lay (hover), 3 print close-up, 4 lifestyle */
  product: (id: string, n: 1 | 2 | 3 | 4) => `/dnd/${id}-${n}.jpg`,
  /** Live finalist card mockup */
  finalist: (id: string) => (id === 'puddle-theory' ? '/dnd/puddle-theory-1.jpg' : `/dnd/${id}.jpg`),
  artist: (slug: string) => `/dnd/artist-${slug}.jpg`,
  cover: (slug: string) => `/dnd/cover-${slug}.jpg`,
  archive: (drop: number, n: number) => `/dnd/archive-0${drop}-${n}.jpg`,
  mood: (slug: string) => `/dnd/mood-${slug}.png`,
  hero: '/dnd/hero-your-design.jpg',
  file: (name: string) => `/dnd/${name}.jpg`,
};

export type Mood = { name: string; slug: string; emoji: string; color: string };
export const moods: Mood[] = [
  { name: 'Snooze Mode', slug: 'snooze-mode', emoji: '😴', color: '#EDE8FF' },
  { name: 'Main Character', slug: 'main-character', emoji: '🎬', color: '#FFF1C7' },
  { name: 'Overthinker', slug: 'overthinker', emoji: '🌀', color: '#FFE1E6' },
  { name: 'Desi Drip', slug: 'desi-drip', emoji: '🪔', color: '#FBE3D2' },
  { name: 'Silent Mode', slug: 'silent-mode', emoji: '🔕', color: '#E2EEFF' },
  { name: 'Night Owl', slug: 'night-owl', emoji: '🦉', color: '#DFF5E8' },
  { name: 'Oversized', slug: 'oversized', emoji: '🧺', color: '#F4ECDD' },
  { name: 'Under ₹999', slug: 'under-999', emoji: '🏷️', color: '#E9F7C9' },
];
export const moodBySlug = (slug: string | null | undefined) => moods.find((m) => m.slug === slug);

export type Artist = {
  /** Database id (live mode only). */
  uuid?: string;
  name: string; slug: string; city: string; wins: number; finalists: number; followers: number;
  image: number; styles: ('Typography' | 'Illustration')[]; tagline: string; bio: string; votes: string; sold: string;
  photo: string | null; cover: string | null;
};

export const DEMO_ARTISTS: Omit<Artist, 'photo' | 'cover'>[] = [
  { name: 'Nilofer S.', slug: 'nilofer', city: 'Chennai', wins: 4, finalists: 12, followers: 18400, image: 2, styles: ['Typography'], tagline: 'TYPOGRAPHY + CULTURE', bio: 'I draw loud little love letters to the streets, signs and sounds I grew up around.', votes: '86k', sold: '3.8k' },
  { name: 'Meera D.', slug: 'meera', city: 'Kochi', wins: 1, finalists: 3, followers: 4100, image: 1, styles: ['Illustration'], tagline: 'ILLUSTRATION + WEATHER', bio: 'Monsoon kid. I paint clouds, coconut trees and everything that smells like wet earth.', votes: '21k', sold: '640' },
  { name: 'Aarav S.', slug: 'aarav', city: 'Jaipur', wins: 2, finalists: 7, followers: 9800, image: 4, styles: ['Illustration'], tagline: 'FOLK ART + NOISE', bio: 'Rajasthani folk motifs, run through a broken photocopier and a lot of chai.', votes: '48k', sold: '1.9k' },
  { name: 'Lakshmi P.', slug: 'lakshmi', city: 'Madurai', wins: 1, finalists: 5, followers: 6200, image: 5, styles: ['Illustration', 'Typography'], tagline: 'TEMPLES + GRIDS', bio: 'Architecture student who sees a design system in every gopuram.', votes: '31k', sold: '920' },
  { name: 'Dev R.', slug: 'dev', city: 'Mumbai', wins: 1, finalists: 6, followers: 7700, image: 6, styles: ['Typography'], tagline: 'RADIO + STREET TYPE', bio: 'Hand-painted signs, local trains and the radio that never switches off.', votes: '37k', sold: '1.1k' },
  { name: 'Karthik M.', slug: 'karthik', city: 'Hyderabad', wins: 3, finalists: 9, followers: 12900, image: 3, styles: ['Illustration'], tagline: 'SOFT SHAPES + LOUD IDEAS', bio: 'Overthinker by day, overthinker by night. I draw what my head sounds like.', votes: '64k', sold: '2.7k' },
  { name: 'Studio Puli', slug: 'studio-puli', city: 'Chennai', wins: 2, finalists: 8, followers: 10300, image: 7, styles: ['Illustration', 'Typography'], tagline: 'TWO-PERSON STUDIO', bio: 'A tiny studio obsessed with filter coffee, tigers and bold two-colour prints.', votes: '52k', sold: '2.2k' },
  { name: 'Riya K.', slug: 'riya', city: 'Bengaluru', wins: 0, finalists: 2, followers: 2600, image: 0, styles: ['Typography'], tagline: 'SLEEPY TYPE', bio: 'Designer, professional snoozer. Making type that feels like a Sunday morning.', votes: '9k', sold: '210' },
];
const SOUTH = ['Chennai', 'Kochi', 'Madurai', 'Hyderabad', 'Bengaluru'];
export const isSouth = (a: Artist) => SOUTH.includes(a.city);

export type Product = {
  id: string; uuid?: string; name: string; artist: string; artistSlug: string; city: string; image: number;
  /** Model shot, flat-lay, print close-up, lifestyle. */
  photos: string[];
  badge: string; rating: number; reviews: number; mood: string; care: string;
  fit: Fit; colours: ColourKey[]; collections: string[]; drop: number; topic: string;
  sold: number; story: string; low?: { size: Size; left: number };
};

export const DEMO_WINNERS: Omit<Product, 'photos' | 'artistSlug'>[] = [
  { id: 'midnight-auto', name: 'Midnight Auto', artist: 'Nilofer S.', city: 'Chennai', image: 0, badge: 'WINNER · DROP 043', rating: 4.8, reviews: 312, mood: 'Night Owl', care: 'DO NOT DRY-CLEAN', fit: 'Oversized', colours: ['black', 'navy', 'purple'], collections: ['new', 'bestsellers'], drop: 43, topic: 'Future Folklore', sold: 1208, story: 'The auto stand outside Central station at 2 AM: neon, chai steam and a driver who never sleeps.', low: { size: 'M', left: 4 } },
  { id: 'kaapi-futures', name: 'Kaapi Futures', artist: 'Nilofer S.', city: 'Chennai', image: 1, badge: 'BESTSELLER', rating: 4.9, reviews: 268, mood: 'Desi Drip', care: 'DO NOT SPILL', fit: 'Classic Crew', colours: ['cream', 'black'], collections: ['bestsellers'], drop: 41, topic: 'Good Trouble', sold: 874, story: 'A stock ticker for filter coffee. Decoction is up, chicory is volatile, sugar is a hedge.' },
  { id: 'folk-static', name: 'Folk Static', artist: 'Aarav S.', city: 'Jaipur', image: 2, badge: 'WINNER · DROP 042', rating: 4.7, reviews: 144, mood: 'Main Character', care: 'DO NOT DUPE', fit: 'Oversized', colours: ['cream', 'yellow'], collections: ['new'], drop: 42, topic: 'Street Signals', sold: 512, story: 'Phad painting meets a TV with no signal. The heroes are still on screen, just a little fuzzy.' },
  { id: 'soft-riot', name: 'Soft Riot', artist: 'Karthik M.', city: 'Hyderabad', image: 3, badge: 'ONLY 4 LEFT IN M', rating: 4.8, reviews: 301, mood: 'Overthinker', care: 'DO NOT OVERTHINK', fit: 'Boxy Crop', colours: ['purple', 'cream'], collections: ['bestsellers'], drop: 40, topic: 'Home Frequency', sold: 990, story: 'A protest where every placard is a polite suggestion. Loud ideas, gentle shapes.', low: { size: 'M', left: 4 } },
  { id: 'gopuram-grid', name: 'Gopuram Grid', artist: 'Lakshmi P.', city: 'Madurai', image: 4, badge: 'WINNER · DROP 041', rating: 4.9, reviews: 140, mood: 'Desi Drip', care: 'DO NOT DISTURB', fit: 'Relaxed Fit', colours: ['yellow', 'black'], collections: ['new'], drop: 41, topic: 'Good Trouble', sold: 433, story: 'The Meenakshi temple tower, rebuilt as a modular grid of tiny gods and tidy squares.' },
  { id: 'local-frequency', name: 'Local Frequency', artist: 'Dev R.', city: 'Mumbai', image: 5, badge: 'TRENDING', rating: 4.6, reviews: 88, mood: 'Silent Mode', care: 'DO NOT MUTE', fit: 'Classic Crew', colours: ['navy', 'cream'], collections: [], drop: 42, topic: 'Street Signals', sold: 301, story: 'The Vividh Bharati dial, hand-painted like a Bombay shop sign. Tune in, zone out.' },
  { id: 'snooze-button', name: 'Snooze Button', artist: 'Riya K.', city: 'Bengaluru', image: 6, badge: 'NEW', rating: 4.7, reviews: 61, mood: 'Snooze Mode', care: 'DO NOT WAKE', fit: 'Oversized', colours: ['purple', 'navy', 'cream'], collections: ['new'], drop: 43, topic: 'Future Folklore', sold: 198, story: 'Five more minutes, rendered in very serious type. For people who negotiate with alarms.' },
  { id: 'filter-club', name: 'Filter Club', artist: 'Studio Puli', city: 'Chennai', image: 7, badge: 'BACK IN STOCK', rating: 4.8, reviews: 190, mood: 'Desi Drip', care: 'DO NOT DILUTE', fit: 'Boxy Crop', colours: ['cream', 'black', 'yellow'], collections: ['back-in-stock', 'bestsellers'], drop: 39, topic: 'Morning Rituals', sold: 655, story: 'A members-only crest for people who take their filter coffee strong and their mornings slow.' },
];

export type Finalist = {
  id: string; uuid?: string; name: string; artist: string; artistSlug: string; city: string; votes: number; backers: number; image: number;
  /** Demo only: votes per hour, so the leaderboard moves while the battle is live. Zero with real votes. */
  rate: number; story: string;
  /** Card mockup, and the gallery on its page. */
  card: string; photos: string[]; colours: ColourKey[];
};

export const DEMO_FINALISTS: Omit<Finalist, 'card' | 'photos' | 'artistSlug' | 'colours'>[] = [
  { id: 'cloudburst-club', name: 'Cloudburst Club', artist: 'Meera D.', city: 'Kochi', votes: 4382, backers: 612, image: 1, rate: 9, story: 'A members-only club for people who run outside when it starts pouring.' },
  { id: 'puddle-theory', name: 'Puddle Theory', artist: 'Aman Narang', city: 'Delhi', votes: 4106, backers: 540, image: 3, rate: 10, story: 'Every puddle is a portal. Some lead to school, most lead to trouble.' },
  { id: 'after-the-rain', name: 'After the Rain', artist: 'Neel Bose', city: 'Kolkata', votes: 3840, backers: 498, image: 5, rate: 6, story: 'Tram lines, wet rooftops and the first hot jhalmuri after a storm.' },
  { id: 'chai-weather', name: 'Chai Weather', artist: 'Studio Puli', city: 'Chennai', votes: 3661, backers: 455, image: 4, rate: 7, story: 'The official forecast: 100% chance of chai, scattered pakoras.' },
  { id: 'wiper-blues', name: 'Wiper Blues', artist: 'Riya K.', city: 'Bengaluru', votes: 3214, backers: 388, image: 6, rate: 5, story: 'A love song for the bus driver whose wipers keep perfect time.' },
  { id: 'power-cut', name: 'Power Cut', artist: 'Faiz A.', city: 'Lucknow', votes: 2980, backers: 301, image: 0, rate: 4, story: 'Candles, antakshari and the collective cheer when the fan comes back on.' },
  { id: 'petrichor', name: 'Petrichor', artist: 'Anushka T.', city: 'Pune', votes: 2702, backers: 276, image: 2, rate: 4, story: 'A botanical study of the smell of first rain, if smells had leaves.' },
  { id: 'wet-streets', name: 'Wet Streets', artist: 'Joel M.', city: 'Shillong', votes: 2415, backers: 230, image: 7, rate: 3, story: 'Hill-town streets that turn into mirrors for an hour every evening.' },
];


export const reviews = [
  { quote: 'Exactly the oversized fit I wanted. The print is even better in person.', name: 'Aarushi · Pune' },
  { quote: 'Heavy fabric, clean print, and I know the artist got paid. Love that.', name: 'Kabir · Mumbai' },
  { quote: 'My new everyday tee. Got asked “where’s this from?” three times.', name: 'Deepti · Chennai' },
];

export const SIZE_CHART = [['XS', '38', '27', '17'], ['S', '40', '28', '18'], ['M', '42', '29', '19'], ['L', '44', '30', '20'], ['XL', '46', '31', '21'], ['2XL', '48', '32', '22'], ['3XL', '50', '33', '23']];

/** Coupon codes the demo bag accepts (live mode checks codes on the server). */
export const COUPONS: Record<string, { pct: number; label: string }> = {
  SNOOZE10: { pct: 10, label: '10% off your drop' },
  NIGHTOWL15: { pct: 15, label: '15% off for night owls' },
};

/* ───────── the catalogue every screen reads ───────── */

export type Prices = { back: number; retail: number; mrp: number; artistPct: number; artistShare: number };
export const DEFAULT_PRICES: Prices = { back: BACK, retail: RETAIL, mrp: MRP, artistPct: ARTIST_PCT, artistShare: ARTIST_SHARE };

/** This week's battle. `live` is false between battles (finalists is then empty). */
export type Battle = { uuid?: string; drop: number; topic: string; brief: string; winners: number; opensAt: number; closesAt: number; printsAt: number; live: boolean };
/** The topic taking submissions, if any. */
export type OpenTopic = { uuid?: string; drop: number; title: string; brief: string; prompts: string[]; entries: number; maxEntries: number; closesAt: number };
export type Stage = { drop: number; title: string; phase: 'submissions' | 'review' | 'voting' | 'printing'; at: number | null };
export type ArchiveEntry = { drop: number; title: string; votes: number; thumbs: string[] };

export type Catalog = {
  /** demo: built-in sample data, state in the browser. live: Supabase. */
  mode: 'demo' | 'live';
  prices: Prices;
  winners: Product[];
  finalists: Finalist[];
  artists: Artist[];
  battle: Battle;
  openTopic: OpenTopic | null;
  stages: Stage[];
  archive: ArchiveEntry[];
  /** Voting needs a verified phone number (live mode). */
  requirePhone: boolean;
};

export const lookups = (c: Pick<Catalog, 'winners' | 'finalists' | 'artists'>) => ({
  productById: (id: string) => c.winners.find((p) => p.id === id),
  finalistById: (id: string) => c.finalists.find((f) => f.id === id),
  artistBySlug: (slug: string) => c.artists.find((a) => a.slug === slug),
  artistByName: (name: string) => c.artists.find((a) => a.name === name),
});

/** Placeholder for a missing photo: the page shows the tint behind it. */
export const NO_PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
