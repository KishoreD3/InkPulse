// The built-in demo catalogue: the store design's sample artists, winners and finalists,
// on a weekly clock that always has a live battle. Used when no database is connected.
import {
  DEFAULT_PRICES, DEMO_ARTISTS, DEMO_FINALISTS, DEMO_WINNERS, img, type Catalog, type ColourKey,
} from './catalog';
import { DAY, printDay, submissionsCloseAt, votingClosesAt, votingOpenedAt } from './cycle';

const slugOf = (name: string) => DEMO_ARTISTS.find((a) => a.name === name)?.slug ?? '';

export function demoCatalog(now = Date.now()): Catalog {
  const closesAt = votingClosesAt(now);
  return {
    mode: 'demo',
    prices: DEFAULT_PRICES,
    artists: DEMO_ARTISTS.map((a) => ({ ...a, photo: img.artist(a.slug), cover: img.cover(a.slug) })),
    winners: DEMO_WINNERS.map((p) => ({ ...p, artistSlug: slugOf(p.artist), photos: ([1, 2, 3, 4] as const).map((n) => img.product(p.id, n)) })),
    finalists: DEMO_FINALISTS.map((f) => ({
      ...f,
      artistSlug: slugOf(f.artist),
      card: img.finalist(f.id),
      photos: f.id === 'puddle-theory' ? [1, 2, 3, 4].map((n) => `/dnd/puddle-theory-${n}.jpg`) : [img.finalist(f.id)],
      colours: ['black', 'cream', 'purple', 'navy'] as ColourKey[],
    })),
    battle: {
      drop: 44, topic: 'Monsoon Mood', brief: 'Design the feeling between the first cloud and the last chai.', winners: 3,
      opensAt: votingOpenedAt(now), closesAt, printsAt: printDay(now), live: true,
    },
    openTopic: {
      drop: 46, title: 'Beautiful Chaos', entries: 73, maxEntries: 2, closesAt: submissionsCloseAt(now),
      brief: 'Find the systems inside the mess: traffic, tangled wires, family group chats, local markets, a desk at 2 AM.',
      prompts: ['Traffic as a pattern', 'Tangled wires', 'Family group chat', 'A desk at 2 AM'],
    },
    stages: [
      { drop: 46, title: 'Beautiful Chaos', phase: 'submissions', at: submissionsCloseAt(now) },
      { drop: 45, title: 'Night Shift', phase: 'review', at: closesAt + 4 * DAY - 11 * 3_600_000 },
      { drop: 44, title: 'Monsoon Mood', phase: 'voting', at: closesAt },
      { drop: 43, title: 'Future Folklore', phase: 'printing', at: null },
    ],
    archive: [
      { drop: 42, title: 'Street Signals', votes: 24891, thumbs: [1, 2, 3].map((n) => img.archive(42, n)) },
      { drop: 41, title: 'Good Trouble', votes: 23657, thumbs: [1, 2, 3].map((n) => img.archive(41, n)) },
      { drop: 40, title: 'Home Frequency', votes: 22423, thumbs: [1, 2, 3].map((n) => img.archive(40, n)) },
    ],
    requirePhone: false,
  };
}
