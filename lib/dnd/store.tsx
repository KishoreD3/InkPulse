'use client';
// Client-side state for the storefront: bag, votes, backings, orders, wishlist, follows,
// club points, artist submissions and DND mode. Saved to localStorage so it survives reloads.
// Swap these actions for Supabase calls when the store is wired to the backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BACK, COUPONS, RETAIL, finalistById, img, productById, type ColourKey } from './catalog';
import { DAY, standings, votingClosesAt } from './cycle';

export type LineKind = 'buy' | 'back';
export type BagLine = { key: string; kind: LineKind; id: string; size: string; colour: ColourKey; qty: number };
export type OrderLine = BagLine & { name: string; image: string; unit: number; drop?: number; closesAt?: number; outcome?: 'won' | 'lost' };
export type Address = { name: string; line1: string; line2: string; city: string; state: string; pin: string };
export type Contact = { name: string; email: string; phone: string };
export type Order = {
  id: string; createdAt: number; lines: OrderLine[]; merch: number; discount: number; reward: number; payNow: number;
  holds: number; coupon: string | null; giftWrap: boolean; payment: string; contact: Contact; address: Address; points: number;
};
export type Submission = {
  id: string; createdAt: number; title: string; mood: string; story: string; tags: string; colours: ColourKey[];
  image: string | null; fileName: string | null; drop: number; status: 'Submitted' | 'In review' | 'Winner';
};
export type Draft = Omit<Submission, 'id' | 'createdAt' | 'status' | 'drop'> & { step: number; pledge: boolean; checks: Check[] | null; savedAt: number };
export type Check = { label: string; ok: boolean; note: string };
export type PointsEntry = { at: number; delta: number; note: string };
export type Toast = { id: number; title: string; body: string; action?: { label: string; href: string } };

export type State = {
  bag: BagLine[]; votes: string[]; wishlist: string[]; follows: string[]; orders: Order[];
  points: number; pointsLog: PointsEntry[]; pastVotes: number; pastBattles: number;
  coupon: string | null; useReward: boolean; submissions: Submission[]; draft: Draft | null;
  contact: Contact; address: Address; upi: string; autopay: boolean; newsletter: string | null; reminders: string[];
  pincode: string; payoutUpi: string; artistBio: string;
};

const KEY = 'dnd-club-v1';
const NIGHT_KEY = 'dnd-night';
// Fixed dates keep the server render and the first client render identical.
const SEED_DAY = Date.UTC(2026, 8, 6, 6);

const seedOrders: Order[] = [
  {
    id: 'DND-26117', createdAt: SEED_DAY,
    lines: [{ key: 'seed-1', kind: 'back', id: 'kaapi-futures', size: 'M', colour: 'cream', qty: 1, name: 'Kaapi Futures', image: img.product('kaapi-futures', 1), unit: BACK, drop: 41, closesAt: SEED_DAY + 3 * DAY, outcome: 'won' }],
    merch: 0, discount: 0, reward: 0, payNow: 0, holds: BACK, coupon: null, giftWrap: false, payment: 'UPI · riya@okhdfcbank',
    contact: { name: 'Riya Menon', email: 'riya.menon@gmail.com', phone: '+91 98765 43210' },
    address: { name: 'Riya Menon', line1: '14, 2nd Cross', line2: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038' },
    points: 90,
  },
  {
    id: 'DND-27342', createdAt: SEED_DAY + 14 * DAY,
    lines: [{ key: 'seed-2', kind: 'back', id: 'local-frequency', size: 'M', colour: 'navy', qty: 1, name: 'Local Frequency', image: img.product('local-frequency', 1), unit: BACK, drop: 43, closesAt: SEED_DAY + 17 * DAY, outcome: 'lost' }],
    merch: 0, discount: 0, reward: 0, payNow: 0, holds: BACK, coupon: null, giftWrap: false, payment: 'UPI · riya@okhdfcbank',
    contact: { name: 'Riya Menon', email: 'riya.menon@gmail.com', phone: '+91 98765 43210' },
    address: { name: 'Riya Menon', line1: '14, 2nd Cross', line2: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038' },
    points: 0,
  },
];

export const initialState: State = {
  bag: [], votes: [], wishlist: [], follows: [], orders: seedOrders,
  points: 240, pointsLog: [{ at: SEED_DAY, delta: 150, note: 'Welcome to the club' }, { at: SEED_DAY + 9 * DAY, delta: 90, note: 'Kaapi Futures printed' }],
  pastVotes: 24, pastBattles: 6,
  coupon: null, useReward: true, submissions: [], draft: null,
  contact: { name: 'Riya Menon', email: 'riya.menon@gmail.com', phone: '+91 98765 43210' },
  address: { name: 'Riya Menon', line1: '14, 2nd Cross', line2: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pin: '560038' },
  upi: 'riya@okhdfcbank', autopay: true, newsletter: null, reminders: [], pincode: '560038',
  payoutUpi: 'nilofer@upi', artistBio: 'Independent designer from Chennai exploring type, local language and everyday city rituals.',
};

/* ───────── pure helpers ───────── */

export function lineInfo(l: BagLine) {
  if (l.kind === 'back') {
    const f = finalistById(l.id);
    return { name: f?.name ?? l.id, image: img.finalist(l.id), unit: BACK, artist: f?.artist ?? '' };
  }
  const p = productById(l.id);
  return { name: p?.name ?? l.id, image: img.product(l.id, 1), unit: RETAIL, artist: p?.artist ?? '' };
}

export type Quote = { merch: number; holds: number; discount: number; reward: number; payNow: number; giftWrap: boolean; items: number; couponLabel: string | null };
export function quote(s: Pick<State, 'bag' | 'coupon' | 'useReward' | 'points'>): Quote {
  const buys = s.bag.filter((l) => l.kind === 'buy');
  const backs = s.bag.filter((l) => l.kind === 'back');
  const merch = buys.reduce((n, l) => n + l.qty * RETAIL, 0);
  const holds = backs.reduce((n, l) => n + l.qty * BACK, 0);
  const c = s.coupon ? COUPONS[s.coupon] : null;
  const discount = c && merch > 0 ? Math.round((merch * c.pct) / 100) : 0;
  const reward = s.useReward && s.points >= 100 && merch - discount >= 100 ? 100 : 0;
  const qty = buys.reduce((n, l) => n + l.qty, 0);
  return {
    merch, holds, discount, reward, payNow: Math.max(0, merch - discount - reward), giftWrap: qty >= 2,
    items: s.bag.reduce((n, l) => n + l.qty, 0), couponLabel: c ? c.label : null,
  };
}

export type LineStatus = { label: string; step: number; steps: string[]; tone: 0 | 1 | 2 };
const SHIP_STEPS = ['Placed', 'Printing', 'Shipped', 'Delivered'];
const BACK_STEPS = ['Backed', 'Result Thu', 'Printing', 'Ships'];

function shipStep(since: number, now: number) {
  const e = now - since;
  return e >= 6 * DAY ? 3 : e >= 2 * DAY ? 2 : e >= 10 * 60_000 ? 1 : 0;
}

/** Where an order line is now. Backings resolve from the leaderboard once voting has closed. */
export function lineStatus(l: OrderLine, createdAt: number, now: number, votes: string[]): LineStatus {
  if (l.kind === 'buy') {
    const step = shipStep(createdAt, now);
    return { label: SHIP_STEPS[step], step, steps: SHIP_STEPS, tone: step === 3 ? 2 : 0 };
  }
  const closes = l.closesAt ?? votingClosesAt(createdAt);
  let outcome = l.outcome;
  if (!outcome && now >= closes) {
    const rank = standings(closes - 1, votes, [l.id]).find((s) => s.id === l.id)?.rank ?? 99;
    outcome = rank <= 3 ? 'won' : 'lost';
  }
  if (outcome === 'lost') return { label: 'Hold released', step: 1, steps: BACK_STEPS, tone: 1 };
  if (outcome === 'won') {
    const step = shipStep(closes + DAY, now);
    const steps = ['Backed', 'Won', 'Printing', 'Shipped', 'Delivered'];
    return { label: step >= 3 ? 'Printed & delivered' : step >= 1 ? 'Printing' : 'Won · charged', step: Math.min(4, step + 1), steps, tone: 2 };
  }
  const rank = standings(now, votes, [l.id]).find((s) => s.id === l.id)?.rank ?? 99;
  return { label: rank <= 3 ? 'In print zone' : 'Below the print line', step: 1, steps: BACK_STEPS, tone: rank <= 3 ? 0 : 1 };
}

/* ───────── provider ───────── */

type Api = {
  state: State; hydrated: boolean; night: boolean; toasts: Toast[];
  setNight: (on: boolean) => void;
  toast: (title: string, body: string, action?: Toast['action']) => void;
  dismissToast: (id: number) => void;
  addToBag: (l: Omit<BagLine, 'key' | 'qty'> & { qty?: number }) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  toggleVote: (id: string) => void;
  toggleWish: (id: string) => void;
  toggleFollow: (slug: string) => void;
  applyCoupon: (code: string) => string | null;
  clearCoupon: () => void;
  setUseReward: (on: boolean) => void;
  placeOrder: (input: { contact: Contact; address: Address; payment: string }) => Order;
  update: (patch: Partial<State>) => void;
  submitDesign: (s: Omit<Submission, 'id' | 'createdAt' | 'status' | 'drop'>) => Submission;
  resetDemo: () => void;
};

const Ctx = createContext<Api | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [night, setNightState] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState({ ...initialState, ...(JSON.parse(raw) as Partial<State>) });
      setNightState(document.documentElement.classList.contains('night'));
    } catch {
      /* storage blocked: the session still works, it just isn't saved */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota or private mode */
    }
  }, [state, hydrated]);

  // Keep tabs in sync: a bag change in one tab shows up in the others.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) setState({ ...initialState, ...(JSON.parse(e.newValue) as Partial<State>) });
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, []);

  const toast = useCallback((title: string, body: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, title, body, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const setNight = useCallback((on: boolean) => {
    setNightState(on);
    document.documentElement.classList.toggle('night', on);
    try { localStorage.setItem(NIGHT_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  }, []);

  const update = useCallback((patch: Partial<State>) => setState((s) => ({ ...s, ...patch })), []);

  const api = useMemo<Api>(() => ({
    state, hydrated, night, toasts, setNight, toast, dismissToast, update,
    addToBag: ({ qty = 1, ...l }) => {
      const s = stateRef.current;
      const key = `${l.kind}:${l.id}:${l.size}:${l.colour}`;
      if (l.kind === 'back' && s.bag.some((b) => b.kind === 'back' && b.id === l.id)) {
        // One backing per design: change the size/colour instead of adding a second.
        setState((x) => ({ ...x, bag: x.bag.map((b) => (b.kind === 'back' && b.id === l.id ? { ...b, key, size: l.size, colour: l.colour } : b)), votes: x.votes.includes(l.id) ? x.votes : [...x.votes, l.id] }));
        toast('Backing updated', `${lineInfo({ ...l, key, qty }).name} · ${l.size}`, { label: 'View bag', href: '/bag' });
        return;
      }
      setState((x) => {
        const same = x.bag.find((b) => b.key === key);
        const bag = same ? x.bag.map((b) => (b.key === key ? { ...b, qty: Math.min(5, b.qty + qty) } : b)) : [...x.bag, { ...l, key, qty }];
        // Backing a design also counts as your vote for it.
        const votes = l.kind === 'back' && !x.votes.includes(l.id) ? [...x.votes, l.id] : x.votes;
        return { ...x, bag, votes };
      });
      toast(
        l.kind === 'back' ? 'Backed · we’ll hold, not charge' : 'Added to bag',
        `${lineInfo({ ...l, key, qty }).name} · ${l.size}`,
        { label: 'View bag', href: '/bag' },
      );
    },
    setQty: (key, qty) => setState((x) => ({ ...x, bag: x.bag.map((b) => (b.key === key ? { ...b, qty: Math.max(1, Math.min(5, qty)) } : b)) })),
    removeLine: (key) => setState((x) => ({ ...x, bag: x.bag.filter((b) => b.key !== key) })),
    toggleVote: (id) => {
      const s = stateRef.current;
      const on = !s.votes.includes(id);
      if (!on && s.bag.some((b) => b.kind === 'back' && b.id === id)) {
        toast('You’re backing this one', 'Remove the backing from your bag to take back your vote.');
        return;
      }
      setState((x) => ({ ...x, votes: on ? [...x.votes, id] : x.votes.filter((v) => v !== id) }));
      if (on) toast('Vote counted', `${finalistById(id)?.name ?? 'Design'} · one vote per design`);
    },
    toggleWish: (id) => {
      const on = !stateRef.current.wishlist.includes(id);
      setState((x) => ({ ...x, wishlist: on ? [...x.wishlist, id] : x.wishlist.filter((v) => v !== id) }));
      if (on) toast('Saved to wishlist', productById(id)?.name ?? '', { label: 'Wishlist', href: '/account?tab=wishlist' });
    },
    toggleFollow: (slug) => setState((x) => ({ ...x, follows: x.follows.includes(slug) ? x.follows.filter((v) => v !== slug) : [...x.follows, slug] })),
    applyCoupon: (raw) => {
      const code = raw.trim().toUpperCase();
      if (!code) return 'Enter a code.';
      if (!COUPONS[code]) return 'That code isn’t valid.';
      if (!stateRef.current.bag.some((b) => b.kind === 'buy')) return 'Codes apply to tees you buy now, not backing holds.';
      setState((x) => ({ ...x, coupon: code }));
      return null;
    },
    clearCoupon: () => setState((x) => ({ ...x, coupon: null })),
    setUseReward: (on) => setState((x) => ({ ...x, useReward: on })),
    placeOrder: ({ contact, address, payment }) => {
      const s = stateRef.current;
      const q = quote(s);
      const now = Date.now();
      const closes = votingClosesAt(now);
      const lines: OrderLine[] = s.bag.map((l) => {
        const info = lineInfo(l);
        return { ...l, name: info.name, image: info.image, unit: info.unit, ...(l.kind === 'back' ? { drop: 44, closesAt: closes } : {}) };
      });
      const points = Math.floor(q.payNow / 10);
      const order: Order = {
        id: `DND-${String(28000 + (Math.floor(now / 1000) % 9000)).padStart(5, '0')}`, createdAt: now, lines,
        merch: q.merch, discount: q.discount, reward: q.reward, payNow: q.payNow, holds: q.holds, coupon: s.coupon,
        giftWrap: q.giftWrap, payment, contact, address, points,
      };
      const log: PointsEntry[] = [];
      if (q.reward) log.push({ at: now, delta: -q.reward, note: `Redeemed on ${order.id}` });
      if (points) log.push({ at: now, delta: points, note: `Earned on ${order.id}` });
      setState((x) => ({
        ...x, orders: [order, ...x.orders], bag: [], coupon: null, contact, address,
        points: x.points - q.reward + points, pointsLog: [...log, ...x.pointsLog],
      }));
      return order;
    },
    submitDesign: (sub) => {
      const entry: Submission = { ...sub, id: `sub-${Date.now()}`, createdAt: Date.now(), status: 'Submitted', drop: 46 };
      setState((x) => ({ ...x, submissions: [entry, ...x.submissions], draft: null }));
      return entry;
    },
    resetDemo: () => setState(initialState),
  }), [state, hydrated, night, toasts, setNight, toast, dismissToast, update]);

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
