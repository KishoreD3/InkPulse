// The weekly clock: voting opens Monday 10 AM IST, locks Thursday 9 PM IST, the top 3 print Friday.
import { BATTLE, finalists, type Finalist } from './catalog';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const IST_OFFSET = 5.5 * HOUR;

/** The next Thursday 9 PM IST after `now`. */
export function votingClosesAt(now = Date.now()): number {
  const ist = new Date(now + IST_OFFSET);
  const target = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 21) - IST_OFFSET;
  const daysAhead = (4 - ist.getUTCDay() + 7) % 7;
  let t = target + daysAhead * DAY;
  if (t <= now) t += 7 * DAY;
  return t;
}

/** Monday 10 AM IST of the current battle. */
export const votingOpenedAt = (now = Date.now()) => votingClosesAt(now) - 3 * DAY - 11 * HOUR;
export const printDay = (now = Date.now()) => votingClosesAt(now) + DAY - 9 * HOUR;
/** Submissions for the open topic close a week after this battle locks. */
export const submissionsCloseAt = (now = Date.now()) => votingClosesAt(now) + 7 * DAY;

/** Hours into the battle; null (before the page has mounted) means the published counts. */
const battleHours = (now: number | null) => (now == null ? 0 : Math.max(0, (now - votingOpenedAt(now)) / HOUR));

export function liveVotes(f: Finalist, now: number | null, mine = false) {
  const hours = battleHours(now);
  return f.votes + Math.floor(f.rate * hours) + (mine ? 1 : 0);
}
export function liveBackers(f: Finalist, now: number | null, backedByMe = false) {
  const hours = battleHours(now);
  return f.backers + Math.floor(f.rate * hours * 0.12) + (backedByMe ? 1 : 0);
}

export type Standing = Finalist & { live: number; backersLive: number; rank: number };

/** Finalists ranked by live votes, including the visitor's own votes and backings. */
export function standings(now: number | null, myVotes: string[], myBackings: string[] = []): Standing[] {
  return finalists
    .map((f) => ({ ...f, live: liveVotes(f, now, myVotes.includes(f.id)), backersLive: liveBackers(f, now, myBackings.includes(f.id)) }))
    .sort((a, b) => b.live - a.live)
    .map((f, i) => ({ ...f, rank: i + 1 }));
}
export const inPrintZone = (s: Standing) => s.rank <= BATTLE.winners;

export function hms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
}
export function dh(ms: number) {
  const h = Math.max(0, Math.floor(ms / HOUR));
  return `${Math.floor(h / 24)}d ${String(h % 24).padStart(2, '0')}h`;
}

const dayMonth = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
const dayOnly = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' });
/** "28–30 Oct" for a window that starts `from` days after `base`. */
export function dayRange(base: number, from: number, to: number) {
  const a = base + from * DAY;
  const b = base + to * DAY;
  const sameMonth = new Date(a + IST_OFFSET).getUTCMonth() === new Date(b + IST_OFFSET).getUTCMonth();
  return sameMonth ? `${dayOnly.format(a)}–${dayMonth.format(b)}` : `${dayMonth.format(a)} – ${dayMonth.format(b)}`;
}
export const shortDate = (t: number) => dayMonth.format(t);
export const dateTime = (t: number) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).format(t);
export { DAY, HOUR };
