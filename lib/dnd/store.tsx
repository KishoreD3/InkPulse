'use client';
// Client-side state for the storefront: bag, votes, backings, orders, wishlist, follows,
// club points, artist submissions and DND mode.
//
// Two modes, picked by the catalogue:
//  - demo: everything lives in this browser (localStorage), seeded with a sample member.
//  - live: the signed-in member's data comes from Supabase (/api/store/*, RLS-checked
//    writes from the browser); only the bag, coupon and drafts stay on this device.
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { COUPONS, colourOf, type Catalog, type ColourKey } from './catalog';
import { useCatalog } from './catalog-context';
import { DAY, standings, votingClosesAt } from './cycle';

export type LineKind = 'buy' | 'back';
export type BagLine = { key: string; kind: LineKind; id: string; size: string; colour: ColourKey; qty: number };
/** Order status from the database (live mode). Demo orders move along by time instead. */
export type DbStatus = 'pending' | 'backed' | 'won' | 'released' | 'paid' | 'printing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded' | 'failed';
export type Fit = 'small' | 'true' | 'large';
export type Review = { rating: number; fit: Fit | null; body: string | null };
export type OrderLine = BagLine & {
  name: string; image: string; unit: number; drop?: number; closesAt?: number; outcome?: 'won' | 'lost'; status?: DbStatus;
  /** Live mode: the database order this line belongs to (one checkout can hold several). */
  orderUuid?: string;
  review?: Review | null;
};
export type ReturnKind = 'exchange' | 'return';
export type ReturnReason = 'size' | 'damaged' | 'misprint' | 'wrong_item' | 'other';
export type ReturnRequest = { kind: ReturnKind; status: 'open' | 'approved' | 'rejected' | 'completed'; newSize: string | null; at: number };
export type Address = { name: string; line1: string; line2: string; city: string; state: string; pin: string };
export type Contact = { name: string; email: string; phone: string };
export type Tracking = { carrier: string | null; awb: string | null; url: string | null };
export type Order = {
  id: string; createdAt: number; lines: OrderLine[]; merch: number; discount: number; reward: number; payNow: number;
  holds: number; coupon: string | null; giftWrap: boolean; payment: string; contact: Contact; address: Address; points: number;
  tracking?: Tracking | null;
  deliveredAt?: number | null;
  returns?: ReturnRequest[];
};
export type Submission = {
  id: string; createdAt: number; title: string; mood: string; story: string; tags: string; colours: ColourKey[];
  image: string | null; fileName: string | null; drop: number; status: 'Submitted' | 'In review' | 'Winner' | 'Changes requested' | 'Not selected' | 'Live';
};
export type Draft = Omit<Submission, 'id' | 'createdAt' | 'status' | 'drop'> & { step: number; pledge: boolean; checks: Check[] | null; savedAt: number };
export type Check = { label: string; ok: boolean; note: string };
export type PointsEntry = { at: number; delta: number; note: string };
export type Note = { id: string; title: string; body: string | null; link: string | null; at: number; read: boolean };
export type Toast = { id: number; title: string; body: string; action?: { label: string; href: string } };
export type NotifyPrefs = { push: boolean; email: boolean; whatsapp: boolean };
export type CouponInfo = { kind: 'percent' | 'flat'; value: number; label: string };
/** A Backer Pass: a one-time code after a backed design didn't print (live mode). */
export type Pass = { code: string; value: number; expiresAt: number };

export type State = {
  bag: BagLine[]; votes: string[]; wishlist: string[]; follows: string[]; orders: Order[];
  points: number; pointsLog: PointsEntry[]; pastVotes: number; pastBattles: number;
  coupon: string | null; couponInfo: CouponInfo | null; useReward: boolean; submissions: Submission[]; draft: Draft | null;
  contact: Contact; address: Address; upi: string; autopay: boolean; newsletter: string | null; reminders: string[];
  pincode: string; payoutUpi: string; artistBio: string; notifications: Note[]; passes: Pass[]; notify: NotifyPrefs;
  /** Live mode: designs whose server vote count already includes this member's vote. */
  counted: string[];
};

/** The signed-in member (live mode). */
export type StoreSession = {
  id: string; handle: string; name: string | null; email: string | null; phone: string | null; phoneVerified: boolean;
  isArtist: boolean; isAdmin: boolean; since: number;
} | null;

const DEMO_KEY = 'dnd-club-v1';
const LIVE_KEY = 'dnd-club-live-v1';
const NIGHT_KEY = 'dnd-night';
/** What live mode keeps on this device; everything else comes from the server. */
const LOCAL_FIELDS = ['bag', 'coupon', 'couponInfo', 'useReward', 'draft', 'upi', 'autopay', 'pincode', 'newsletter'] as const;
const REWARD_POINTS = 100;
const REWARD_VALUE = 100;

// Fixed dates keep the server render and the first client render identical.
const SEED_DAY = Date.UTC(2026, 8, 6, 6);
const SEED_CONTACT: Contact = { name: 'Riya Menon', email: 'riya.menon@gmail.com', phone: '+91 98765 43210' };
const SEED_ADDRESS: Address = { name: 'Riya Menon', line1: '14, 2nd Cross', line2: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038' };

const seedOrders = (back: number): Order[] => [
  {
    id: 'DND-26117', createdAt: SEED_DAY,
    lines: [{ key: 'seed-1', kind: 'back', id: 'kaapi-futures', size: 'M', colour: 'cream', qty: 1, name: 'Kaapi Futures', image: '/dnd/kaapi-futures-1.jpg', unit: back, drop: 41, closesAt: SEED_DAY + 3 * DAY, outcome: 'won' }],
    merch: 0, discount: 0, reward: 0, payNow: 0, holds: back, coupon: null, giftWrap: false, payment: 'UPI · riya@okhdfcbank',
    contact: SEED_CONTACT, address: SEED_ADDRESS, points: 90,
  },
  {
    id: 'DND-27342', createdAt: SEED_DAY + 14 * DAY,
    lines: [{ key: 'seed-2', kind: 'back', id: 'local-frequency', size: 'M', colour: 'navy', qty: 1, name: 'Local Frequency', image: '/dnd/local-frequency-1.jpg', unit: back, drop: 43, closesAt: SEED_DAY + 17 * DAY, outcome: 'lost' }],
    merch: 0, discount: 0, reward: 0, payNow: 0, holds: back, coupon: null, giftWrap: false, payment: 'UPI · riya@okhdfcbank',
    contact: SEED_CONTACT, address: SEED_ADDRESS, points: 0,
  },
];

const emptyContact: Contact = { name: '', email: '', phone: '' };
const emptyAddress: Address = { name: '', line1: '', line2: '', city: '', state: '', pin: '' };

/** A fresh member: what live mode starts from before the server answers. */
export const blankState: State = {
  bag: [], votes: [], wishlist: [], follows: [], orders: [], points: 0, pointsLog: [], pastVotes: 0, pastBattles: 0,
  coupon: null, couponInfo: null, useReward: true, submissions: [], draft: null, contact: emptyContact, address: emptyAddress,
  upi: '', autopay: false, newsletter: null, reminders: [], pincode: '', payoutUpi: '', artistBio: '', notifications: [], passes: [], counted: [],
  notify: { push: true, email: true, whatsapp: true },
};

/** The demo member, Riya, with two past backings. */
export const demoState = (back = 899): State => ({
  ...blankState,
  orders: seedOrders(back),
  points: 240, pointsLog: [{ at: SEED_DAY, delta: 150, note: 'Welcome to the club' }, { at: SEED_DAY + 9 * DAY, delta: 90, note: 'Kaapi Futures printed' }],
  pastVotes: 24, pastBattles: 6,
  contact: SEED_CONTACT, address: SEED_ADDRESS,
  upi: 'riya@okhdfcbank', autopay: true, pincode: '560038',
  payoutUpi: 'nilofer@upi', artistBio: 'Independent designer from Chennai exploring type, local language and everyday city rituals.',
});

/* ───────── pure helpers ───────── */

type Cat = Catalog & { productById: (id: string) => Catalog['winners'][number] | undefined; finalistById: (id: string) => Catalog['finalists'][number] | undefined };

function lineInfoFor(cat: Cat, l: BagLine) {
  if (l.kind === 'back') {
    const f = cat.finalistById(l.id);
    return { name: f?.name ?? l.id, image: f?.card ?? '', unit: cat.prices.back, artist: f?.artist ?? '' };
  }
  const p = cat.productById(l.id);
  return { name: p?.name ?? l.id, image: p?.photos[0] ?? '', unit: cat.prices.retail, artist: p?.artist ?? '' };
}

export type Quote = { merch: number; holds: number; discount: number; reward: number; payNow: number; giftWrap: boolean; items: number; couponLabel: string | null };
function quoteFor(prices: Catalog['prices'], s: Pick<State, 'bag' | 'couponInfo' | 'useReward' | 'points'>): Quote {
  const buys = s.bag.filter((l) => l.kind === 'buy');
  const backs = s.bag.filter((l) => l.kind === 'back');
  const merch = buys.reduce((n, l) => n + l.qty * prices.retail, 0);
  const holds = backs.reduce((n, l) => n + l.qty * prices.back, 0);
  const c = s.couponInfo;
  const discount = c && merch > 0 ? Math.min(merch - 1, c.kind === 'percent' ? Math.floor((merch * c.value) / 100) : c.value) : 0;
  const reward = s.useReward && s.points >= REWARD_POINTS && merch - discount > REWARD_VALUE ? REWARD_VALUE : 0;
  const qty = buys.reduce((n, l) => n + l.qty, 0);
  return {
    merch, holds, discount, reward, payNow: Math.max(0, merch - discount - reward), giftWrap: qty >= 2,
    items: s.bag.reduce((n, l) => n + l.qty, 0), couponLabel: c ? c.label : null,
  };
}

export type LineStatus = { label: string; step: number; steps: string[]; tone: 0 | 1 | 2 };
const SHIP_STEPS = ['Placed', 'Printing', 'Shipped', 'Delivered'];
const BACK_STEPS = ['Backed', 'Result Thu', 'Printing', 'Ships'];
const WON_STEPS = ['Backed', 'Won', 'Printing', 'Shipped', 'Delivered'];
const SHIP_INDEX: Partial<Record<DbStatus, number>> = { pending: 0, paid: 0, won: 0, printing: 1, shipped: 2, delivered: 3 };

function shipStep(since: number, now: number) {
  const e = now - since;
  return e >= 6 * DAY ? 3 : e >= 2 * DAY ? 2 : e >= 10 * 60_000 ? 1 : 0;
}

/** Where an order line is now. Live orders follow their database status; demo ones move along by time. */
function lineStatusFor(cat: Catalog, l: OrderLine, createdAt: number, now: number, votes: string[], counted: string[]): LineStatus {
  if (l.status) {
    const st = l.status;
    if (st === 'cancelled' || st === 'failed') return { label: st === 'failed' ? 'Payment failed' : 'Cancelled', step: 0, steps: SHIP_STEPS, tone: 1 };
    if (st === 'refunded') return { label: 'Refunded', step: 0, steps: SHIP_STEPS, tone: 1 };
    if (l.kind === 'buy') {
      const step = SHIP_INDEX[st] ?? 0;
      return { label: SHIP_STEPS[step], step, steps: SHIP_STEPS, tone: step === 3 ? 2 : 0 };
    }
    if (st === 'released') return { label: 'Hold released', step: 1, steps: BACK_STEPS, tone: 1 };
    if (st === 'backed' || st === 'pending') {
      const rank = standings(cat, now, votes, [l.id], counted).find((s) => s.id === l.id)?.rank ?? 99;
      if (!cat.battle.live || !cat.finalists.some((f) => f.id === l.id)) return { label: 'Result coming', step: 1, steps: BACK_STEPS, tone: 0 };
      return { label: rank <= cat.battle.winners ? 'In print zone' : 'Below the print line', step: 1, steps: BACK_STEPS, tone: rank <= cat.battle.winners ? 0 : 1 };
    }
    const step = (SHIP_INDEX[st] ?? 0) + 1;
    return { label: step >= 4 ? 'Printed & delivered' : step >= 2 ? 'Printing' : 'Won · charged', step: Math.min(4, step), steps: WON_STEPS, tone: 2 };
  }
  if (l.kind === 'buy') {
    const step = shipStep(createdAt, now);
    return { label: SHIP_STEPS[step], step, steps: SHIP_STEPS, tone: step === 3 ? 2 : 0 };
  }
  const closes = l.closesAt ?? votingClosesAt(createdAt);
  let outcome = l.outcome;
  if (!outcome && now >= closes) {
    const rank = standings(cat, closes - 1, votes, [l.id]).find((s) => s.id === l.id)?.rank ?? 99;
    outcome = rank <= cat.battle.winners ? 'won' : 'lost';
  }
  if (outcome === 'lost') return { label: 'Hold released', step: 1, steps: BACK_STEPS, tone: 1 };
  if (outcome === 'won') {
    const step = shipStep(closes + DAY, now);
    return { label: step >= 3 ? 'Printed & delivered' : step >= 1 ? 'Printing' : 'Won · charged', step: Math.min(4, step + 1), steps: WON_STEPS, tone: 2 };
  }
  const rank = standings(cat, now, votes, [l.id]).find((s) => s.id === l.id)?.rank ?? 99;
  return { label: rank <= cat.battle.winners ? 'In print zone' : 'Below the print line', step: 1, steps: BACK_STEPS, tone: rank <= cat.battle.winners ? 0 : 1 };
}

const VOTE_ERRORS: Record<string, string> = {
  phone_not_verified: 'Verify your phone number to vote. It keeps the battle fair.',
  voting_locked: 'Voting for this battle is closed.',
  rate_limited: 'Easy! That’s the hourly vote limit. Try again in a bit.',
  design_not_live: 'This design isn’t open for voting.',
  banned: 'This account can’t vote.',
};

/** Turns a database error code (raised by our functions) into words for the shopper. */
function rpcError(message: string, map: Record<string, string>, fallback: string) {
  const key = Object.keys(map).find((k) => message.includes(k));
  return key ? map[key] : fallback;
}

async function postJson<T>(url: string, body: unknown): Promise<T & { error?: string }> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok && !json.error) json.error = 'Something went wrong. Try again.';
  return json;
}

/* ───────── provider ───────── */

type SubmitInput = Omit<Submission, 'id' | 'createdAt' | 'status' | 'drop'>;
type Api = {
  state: State; hydrated: boolean; night: boolean; toasts: Toast[]; mode: Catalog['mode']; session: StoreSession;
  setNight: (on: boolean) => void;
  toast: (title: string, body: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
  addToBag: (l: Omit<BagLine, 'key' | 'qty'> & { qty?: number }) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  toggleVote: (id: string) => void;
  toggleWish: (id: string) => void;
  toggleFollow: (slug: string) => void;
  toggleReminder: (key: string) => void;
  applyCoupon: (code: string) => Promise<string | null>;
  clearCoupon: () => void;
  setUseReward: (on: boolean) => void;
  placeOrder: (input: { contact: Contact; address: Address; payment: string }) => Promise<{ order: Order } | { error: string }>;
  update: (patch: Partial<State>) => void;
  saveProfile: (patch: Partial<Pick<State, 'contact' | 'address' | 'artistBio' | 'payoutUpi'>>) => Promise<string | null>;
  /** `file` is the original artwork (live mode uploads it at full size; `image` is only a preview). */
  submitDesign: (s: SubmitInput, file?: File | null) => Promise<{ submission: Submission } | { error: string }>;
  subscribe: (email: string) => Promise<string | null>;
  /** Rate a delivered tee. Resolves with an error message, or null when saved. */
  postReview: (order: Order, line: OrderLine, review: Review) => Promise<string | null>;
  /** Ask for a size exchange or a return on a delivered order. */
  requestReturn: (order: Order, input: { line: OrderLine; kind: ReturnKind; reason: ReturnReason; newSize: string | null; details: string; photos: File[] }) => Promise<string | null>;
  setNotify: (prefs: NotifyPrefs) => Promise<string | null>;
  refresh: () => Promise<Partial<State> | null>;
  resetDemo: () => void;
  signOut: () => Promise<void>;
  /** Bound helpers that need the catalogue. */
  quote: () => Quote;
  lineInfo: (l: BagLine) => ReturnType<typeof lineInfoFor>;
  lineStatus: (l: OrderLine, createdAt: number, now: number) => LineStatus;
  board: (now: number | null) => ReturnType<typeof standings>;
};

const Ctx = createContext<Api | null>(null);

export function StoreProvider({ session = null, children }: { session?: StoreSession; children: React.ReactNode }) {
  const cat = useCatalog();
  const live = cat.mode === 'live';
  const key = live ? LIVE_KEY : DEMO_KEY;
  const initial = useMemo(() => (live ? blankState : demoState(cat.prices.back)), [live, cat.prices.back]);
  const [state, setState] = useState<State>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [night, setNightState] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const catRef = useRef(cat);
  catRef.current = cat;
  const path = usePathname();

  const readLocal = useCallback((raw: string | null): Partial<State> => {
    if (!raw) return {};
    const saved = JSON.parse(raw) as Partial<State>;
    if (!live) return saved;
    return Object.fromEntries(LOCAL_FIELDS.filter((k) => k in saved).map((k) => [k, saved[k]])) as Partial<State>;
  }, [live]);

  /** Reloads the member's data from the server; resolves with it (null when offline or signed out). */
  const refresh = useCallback(async (): Promise<Partial<State> | null> => {
    if (!live || !session) return null;
    try {
      const res = await fetch('/api/store/me', { cache: 'no-store' });
      if (!res.ok) return null;
      const me = (await res.json()) as Partial<State>;
      setState((s) => ({ ...s, ...me, counted: me.votes ?? s.counted }));
      return me;
    } catch {
      return null; // offline: keep what we have
    }
  }, [live, session]);

  useEffect(() => {
    try {
      setState({ ...initial, ...readLocal(localStorage.getItem(key)) });
      setNightState(document.documentElement.classList.contains('night'));
    } catch {
      /* storage blocked: the session still works, it just isn't saved */
    }
    setHydrated(true);
    void refresh();
  }, [initial, key, readLocal, refresh]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const keep = live ? Object.fromEntries(LOCAL_FIELDS.map((k) => [k, state[k]])) : state;
      localStorage.setItem(key, JSON.stringify(keep));
    } catch {
      /* quota or private mode */
    }
  }, [state, hydrated, key, live]);

  // Keep tabs in sync: a bag change in one tab shows up in the others.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === key && e.newValue) setState((s) => ({ ...s, ...readLocal(e.newValue) }));
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [key, readLocal]);

  // A server count that changed (our vote, or Realtime) now reflects our current vote on that design.
  useEffect(() => cat.onCounts((id) => setState((s) => ({
    ...s, counted: s.votes.includes(id) ? Array.from(new Set([...s.counted, id])) : s.counted.filter((x) => x !== id),
  }))), [cat]);

  const toast = useCallback((title: string, body: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, body, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const setNight = useCallback((on: boolean) => {
    setNightState(on);
    document.documentElement.classList.toggle('night', on);
    try { localStorage.setItem(NIGHT_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const update = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  /** Live mode: send people to sign in, then bring them back here. */
  const needSession = useCallback((why: string) => {
    if (!live || session) return false;
    toast('Sign in first', why, { label: 'Sign in', href: `/signin?next=${encodeURIComponent(path)}` });
    window.location.href = `/signin?next=${encodeURIComponent(path)}`;
    return true;
  }, [live, session, path, toast]);

  /** Live vote: optimistic, then the server's count. */
  const sendVote = useCallback(async (id: string, on: boolean, quiet = false) => {
    const f = catRef.current.finalistById(id);
    if (!f?.uuid) return;
    setState((x) => ({ ...x, votes: on ? Array.from(new Set([...x.votes, id])) : x.votes.filter((v) => v !== id) }));
    const supabase = getBrowserClient();
    const { data, error } = on
      ? await supabase.rpc('cast_vote', { p_design: f.uuid, p_source: document.cookie.match(/(?:^|;\s*)ink_src=([a-z0-9_-]{1,32})/)?.[1] ?? null })
      : await supabase.rpc('withdraw_vote', { p_design: f.uuid });
    if (error) {
      setState((x) => ({ ...x, votes: on ? x.votes.filter((v) => v !== id) : [...x.votes, id] }));
      const code = Object.keys(VOTE_ERRORS).find((k) => error.message.includes(k));
      toast('Vote not counted', code ? VOTE_ERRORS[code] : 'Something went wrong. Try again.',
        code === 'phone_not_verified' ? { label: 'Verify phone', href: '/account?tab=overview#phone' } : undefined);
      return;
    }
    catRef.current.patchCounts(id, data as number);
    if (on && !quiet) toast('Vote counted', `${f.name} · one vote per design`);
  }, [toast]);

  const api = useMemo<Api>(() => {
    const quote = () => quoteFor(cat.prices, state);
    const lineInfo = (l: BagLine) => lineInfoFor(cat, l);
    return {
      state, hydrated, night, toasts, mode: cat.mode, session, setNight, toast, dismissToast, update, refresh, quote, lineInfo,
      lineStatus: (l, createdAt, now) => lineStatusFor(cat, l, createdAt, now, state.votes, state.counted),
      board: (now) => standings(cat, now, state.votes, state.bag.filter((b) => b.kind === 'back').map((b) => b.id), state.counted),

      addToBag: ({ qty = 1, ...l }) => {
        const s = stateRef.current;
        const k = `${l.kind}:${l.id}:${l.size}:${l.colour}`;
        const info = lineInfo({ ...l, key: k, qty });
        // Backing a design also counts as your vote for it.
        const voteToo = l.kind === 'back' && !s.votes.includes(l.id);
        if (l.kind === 'back' && s.bag.some((b) => b.kind === 'back' && b.id === l.id)) {
          // One backing per design: change the size/colour instead of adding a second.
          setState((x) => ({ ...x, bag: x.bag.map((b) => (b.kind === 'back' && b.id === l.id ? { ...b, key: k, size: l.size, colour: l.colour } : b)) }));
          toast('Backing updated', `${info.name} · ${l.size}`, { label: 'View bag', href: '/bag' });
          return;
        }
        setState((x) => {
          const same = x.bag.find((b) => b.key === k);
          const bag = same ? x.bag.map((b) => (b.key === k ? { ...b, qty: Math.min(5, b.qty + qty) } : b)) : [...x.bag, { ...l, key: k, qty }];
          return { ...x, bag, votes: voteToo && !live ? [...x.votes, l.id] : x.votes };
        });
        if (voteToo && live && session) void sendVote(l.id, true, true);
        toast(
          l.kind === 'back' ? 'Backed · we’ll hold, not charge' : 'Added to bag',
          `${info.name} · ${l.size}`,
          { label: 'View bag', href: '/bag' },
        );
      },
      setQty: (k, qty) => setState((x) => ({ ...x, bag: x.bag.map((b) => (b.key === k ? { ...b, qty: Math.max(1, Math.min(5, qty)) } : b)) })),
      removeLine: (k) => setState((x) => ({ ...x, bag: x.bag.filter((b) => b.key !== k) })),

      toggleVote: (id) => {
        const s = stateRef.current;
        const on = !s.votes.includes(id);
        if (!on && s.bag.some((b) => b.kind === 'back' && b.id === id)) {
          toast('You’re backing this one', 'Remove the backing from your bag to take back your vote.');
          return;
        }
        if (live) {
          if (needSession('Voting needs an account: one person, one vote.')) return;
          void sendVote(id, on);
          return;
        }
        setState((x) => ({ ...x, votes: on ? [...x.votes, id] : x.votes.filter((v) => v !== id) }));
        if (on) toast('Vote counted', `${cat.finalistById(id)?.name ?? 'Design'} · one vote per design`);
      },

      toggleWish: (id) => {
        const on = !stateRef.current.wishlist.includes(id);
        const p = cat.productById(id);
        if (live && needSession('Sign in to keep a wishlist on every device.')) return;
        setState((x) => ({ ...x, wishlist: on ? [...x.wishlist, id] : x.wishlist.filter((v) => v !== id) }));
        if (on) toast('Saved to wishlist', p?.name ?? '', { label: 'Wishlist', href: '/account?tab=wishlist' });
        if (live && session && p?.uuid) {
          const table = getBrowserClient().from('wishlist');
          void (on ? table.insert({ user_id: session.id, design_id: p.uuid }) : table.delete().match({ user_id: session.id, design_id: p.uuid }))
            .then(({ error }) => { if (error) { toast('Wishlist not saved', 'Try again in a moment.'); void refresh(); } });
        }
      },

      toggleFollow: (slug) => {
        const on = !stateRef.current.follows.includes(slug);
        const a = cat.artistBySlug(slug);
        if (live && needSession('Sign in to follow artists and hear when they’re live.')) return;
        setState((x) => ({ ...x, follows: on ? [...x.follows, slug] : x.follows.filter((v) => v !== slug) }));
        if (live && session && a?.uuid) {
          if (a.uuid === session.id) { toast('That’s you', 'You can’t follow yourself.'); void refresh(); return; }
          const table = getBrowserClient().from('follows');
          void (on ? table.insert({ follower_id: session.id, artist_id: a.uuid }) : table.delete().match({ follower_id: session.id, artist_id: a.uuid }))
            .then(({ error }) => { if (error) { toast('Couldn’t update', 'Try again in a moment.'); void refresh(); } });
        }
      },

      toggleReminder: (k) => {
        const on = !stateRef.current.reminders.includes(k);
        if (live && needSession('Sign in so we know where to send the reminder.')) return;
        setState((x) => ({ ...x, reminders: on ? [...x.reminders, k] : x.reminders.filter((r) => r !== k) }));
        if (on) toast('Reminder set', live ? 'We’ll nudge you when voting opens. Only this once.' : 'We’ll nudge you Monday at 10 AM. Only this once.');
        // The next battle to open: the scheduled one if none is live, else the topic taking entries.
        const drop = (!cat.battle.live && cat.battle.uuid) || cat.openTopic?.uuid;
        if (live && session && drop) {
          const table = getBrowserClient().from('topic_reminders');
          void (on ? table.insert({ user_id: session.id, drop_id: drop }) : table.delete().match({ user_id: session.id, drop_id: drop }))
            .then(({ error }) => { if (error) { toast('Reminder not saved', 'Try again in a moment.'); void refresh(); } });
        }
      },

      applyCoupon: async (raw) => {
        const code = raw.trim().toUpperCase();
        if (!code) return 'Enter a code.';
        const s = stateRef.current;
        if (!s.bag.some((b) => b.kind === 'buy')) return 'Codes apply to tees you buy now, not backing holds.';
        if (!live) {
          const c = COUPONS[code];
          if (!c) return 'That code isn’t valid.';
          setState((x) => ({ ...x, coupon: code, couponInfo: { kind: 'percent', value: c.pct, label: c.label } }));
          return null;
        }
        const r = await postJson<{ code: string; info: CouponInfo }>('/api/store/coupon', { code, subtotal: quoteFor(cat.prices, s).merch });
        if (r.error) return r.error;
        setState((x) => ({ ...x, coupon: r.code, couponInfo: r.info }));
        return null;
      },
      clearCoupon: () => setState((x) => ({ ...x, coupon: null, couponInfo: null })),
      setUseReward: (on) => setState((x) => ({ ...x, useReward: on })),

      placeOrder: async ({ contact, address, payment }) => {
        const s = stateRef.current;
        const q = quoteFor(cat.prices, s);
        if (live) {
          if (!session) return { error: 'Sign in to place your order.' };
          const r = await postJson<{ ref: string }>('/api/store/checkout', {
            lines: s.bag.map(({ kind, id, size, colour, qty }) => ({ kind, id, size, colour: colourOf(colour).name, qty })),
            contact, address, coupon: s.coupon, useReward: s.useReward && q.reward > 0, payment,
          });
          if (r.error) return { error: r.error };
          setState((x) => ({ ...x, bag: [], coupon: null, couponInfo: null, contact, address }));
          const me = await refresh();
          const order = me?.orders?.find((o) => o.id === r.ref);
          return order ? { order } : { error: 'Your order was placed, but we couldn’t load it. Check your account.' };
        }
        const now = Date.now();
        const lines: OrderLine[] = s.bag.map((l) => {
          const info = lineInfo(l);
          return { ...l, name: info.name, image: info.image, unit: info.unit, ...(l.kind === 'back' ? { drop: cat.battle.drop, closesAt: cat.battle.closesAt } : {}) };
        });
        const points = Math.floor(q.payNow / 10);
        const order: Order = {
          id: `DND-${String(28000 + (Math.floor(now / 1000) % 9000)).padStart(5, '0')}`, createdAt: now, lines,
          merch: q.merch, discount: q.discount, reward: q.reward, payNow: q.payNow, holds: q.holds, coupon: s.coupon,
          giftWrap: q.giftWrap, payment, contact, address, points,
        };
        const log: PointsEntry[] = [];
        if (q.reward) log.push({ at: now, delta: -REWARD_POINTS, note: `Redeemed on ${order.id}` });
        if (points) log.push({ at: now, delta: points, note: `Earned on ${order.id}` });
        setState((x) => ({
          ...x, orders: [order, ...x.orders], bag: [], coupon: null, couponInfo: null, contact, address,
          points: x.points - (q.reward ? REWARD_POINTS : 0) + points, pointsLog: [...log, ...x.pointsLog],
        }));
        return { order };
      },

      postReview: async (order, line, review) => {
        const save = () => setState((x) => ({
          ...x, orders: x.orders.map((o) => (o.id !== order.id ? o : { ...o, lines: o.lines.map((l) => (l.key === line.key ? { ...l, review } : l)) })),
        }));
        if (!live) { save(); return null; }
        if (!session) return 'Sign in again.';
        const { error } = await getBrowserClient().rpc('post_review', {
          p_item: line.key, p_rating: review.rating, p_fit: review.fit, p_body: review.body, p_photos: [],
        });
        if (error) return rpcError(error.message, { not_delivered: 'You can review once it’s delivered.', banned: 'This account can’t post reviews.' }, 'Couldn’t save your review. Try again.');
        save();
        return null;
      },

      requestReturn: async (order, input) => {
        const entry: ReturnRequest = { kind: input.kind, status: 'open', newSize: input.kind === 'exchange' ? input.newSize : null, at: Date.now() };
        const save = () => setState((x) => ({ ...x, orders: x.orders.map((o) => (o.id === order.id ? { ...o, returns: [entry, ...(o.returns ?? [])] } : o)) }));
        if (!live) { save(); return null; }
        if (!session) return 'Sign in again.';
        const orderUuid = input.line.orderUuid;
        if (!orderUuid) return 'Reload the page and try again.';
        // Photos go to the member's own folder; the database checks the links point there.
        const supabase = getBrowserClient();
        const photos: string[] = [];
        for (const [i, f] of input.photos.slice(0, 3).entries()) {
          const filePath = `${session.id}/return-${Date.now()}-${i}.${f.type === 'image/png' ? 'png' : f.type === 'image/webp' ? 'webp' : 'jpg'}`;
          const up = await supabase.storage.from('posts').upload(filePath, f, { contentType: f.type });
          if (up.error) return `Photo upload failed: ${up.error.message}`;
          photos.push(supabase.storage.from('posts').getPublicUrl(filePath).data.publicUrl);
        }
        const { error } = await supabase.rpc('request_return', {
          p_order: orderUuid, p_kind: input.kind, p_reason: input.reason, p_new_size: input.kind === 'exchange' ? input.newSize : null,
          p_details: input.details.trim() || null, p_photos: photos,
        });
        if (error) {
          return rpcError(error.message, {
            window_closed: 'The exchange window for this order has closed.', not_delivered: 'You can ask once the order is delivered.',
            already_requested: 'There’s already a request open for this order.', bad_size: 'That size isn’t available.',
          }, 'Couldn’t send your request. Try again.');
        }
        save();
        return null;
      },

      setNotify: async (prefs) => {
        const before = stateRef.current.notify;
        setState((x) => ({ ...x, notify: prefs }));
        if (!live) return null;
        if (!session) return 'Sign in again.';
        const { error } = await getBrowserClient().from('profiles').update({ notify: prefs }).eq('id', session.id);
        if (error) { setState((x) => ({ ...x, notify: before })); return 'Couldn’t save. Try again.'; }
        return null;
      },

      saveProfile: async (patch) => {
        setState((x) => ({ ...x, ...patch }));
        if (!live) return null;
        if (!session) return 'Sign in again.';
        const r = await postJson('/api/store/profile', patch);
        if (r.error) { void refresh(); return r.error; }
        return null;
      },

      submitDesign: async (sub, file) => {
        if (!live) {
          const entry: Submission = { ...sub, id: `sub-${Date.now()}`, createdAt: Date.now(), status: 'Submitted', drop: cat.openTopic?.drop ?? 0 };
          setState((x) => ({ ...x, submissions: [entry, ...x.submissions], draft: null }));
          return { submission: entry };
        }
        if (!session) return { error: 'Sign in to submit.' };
        if (!file) return { error: 'Attach your artwork file again to submit.' };
        if (!cat.openTopic) return { error: 'Submissions are closed right now. The next brief goes up Monday at 10 AM.' };
        // The original file goes straight to Storage, into the artist's own folder.
        const blob: Blob = file;
        const ext = blob.type === 'image/svg+xml' ? 'svg' : blob.type === 'image/jpeg' ? 'jpg' : 'png';
        const filePath = `${session.id}/${Date.now()}.${ext}`;
        const supabase = getBrowserClient();
        const up = await supabase.storage.from('artwork').upload(filePath, blob, { contentType: blob.type, upsert: false });
        if (up.error) return { error: `Upload failed: ${up.error.message}` };
        const artUrl = supabase.storage.from('artwork').getPublicUrl(filePath).data.publicUrl;
        const r = await postJson<{ id: string }>('/api/store/designs', {
          title: sub.title, mood: sub.mood, story: sub.story, tags: sub.tags, colours: sub.colours.map((c) => colourOf(c).name), artUrl,
        });
        if (r.error) return { error: r.error };
        setState((x) => ({ ...x, draft: null }));
        const me = await refresh();
        const entry = me?.submissions?.find((x) => x.id === r.id)
          ?? { ...sub, id: r.id, createdAt: Date.now(), status: 'Submitted' as const, drop: cat.openTopic?.drop ?? 0, image: artUrl };
        return { submission: entry };
      },

      subscribe: async (email) => {
        setState((x) => ({ ...x, newsletter: email }));
        if (!live) return null;
        const r = await postJson('/api/store/newsletter', { email });
        if (r.error) { setState((x) => ({ ...x, newsletter: null })); return r.error; }
        return null;
      },

      resetDemo: () => setState(demoState(cat.prices.back)),
      signOut: async () => {
        await getBrowserClient().auth.signOut();
        try { localStorage.removeItem(LIVE_KEY); } catch { /* ignore */ }
        window.location.href = '/';
      },
    };
  }, [state, hydrated, night, toasts, session, live, cat, setNight, toast, dismissToast, update, refresh, needSession, sendVote]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

/** Current time, ticking every `ms`. Null until mounted so server and client renders match. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
