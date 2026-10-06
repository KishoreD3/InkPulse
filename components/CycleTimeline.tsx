import { dayLabel } from '@/lib/format';
import type { Drop, DropPhase } from '@/lib/types';

const ORDER: DropPhase[] = ['upcoming', 'submissions', 'review', 'voting', 'locked', 'printing', 'shipped'];

/**
 * The five stages every drop moves through, with real dates:
 * topic → submissions → review → voting → print.
 */
export function CycleTimeline({ drop, phase, compact = false, dark = false }: {
  drop: Pick<Drop, 'topic_at' | 'submissions_close_at' | 'opens_at' | 'locks_at' | 'prints_at'>;
  phase: DropPhase; compact?: boolean; dark?: boolean;
}) {
  const reviewEnd = new Date(new Date(drop.opens_at).getTime() - 60_000).toISOString();
  const stages: { key: DropPhase; title: string; when: string }[] = [
    { key: 'upcoming', title: 'Topic out', when: dayLabel(drop.topic_at) },
    { key: 'submissions', title: 'Artists submit', when: `till ${dayLabel(drop.submissions_close_at)}` },
    { key: 'review', title: 'Review', when: `till ${dayLabel(reviewEnd)}` },
    { key: 'voting', title: 'Voting', when: `${dayLabel(drop.opens_at)} – ${dayLabel(drop.locks_at)}` },
    { key: 'printing', title: 'Print', when: dayLabel(drop.prints_at) },
  ];
  const at = ORDER.indexOf(phase);
  const stageIndex = (k: DropPhase) => ORDER.indexOf(k);
  const current = phase === 'upcoming' ? -1 : phase === 'locked' ? 3.5 : phase === 'shipped' ? 5 : stages.findIndex((s) => s.key === phase);

  return (
    <ol className={`grid gap-1.5 ${compact ? 'grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'}`} aria-label="Drop timeline">
      {stages.map((s, i) => {
        const done = i < current || (s.key === 'upcoming' && at > stageIndex('upcoming'));
        const now = i === current;
        const base = dark
          ? now ? 'bg-pink border-pink text-ink' : done ? 'border-acid text-acid' : 'border-mist text-mist'
          : now ? 'bg-pink border-ink' : done ? 'bg-acid border-ink' : 'bg-card border-ink opacity-70';
        return (
          <li key={s.key} aria-current={now ? 'step' : undefined}
            className={`rounded-lg border-2 px-2 py-1.5 font-mono ${compact ? 'text-[9px]' : 'text-[11px]'} ${base}`}>
            <strong className={`block font-display font-normal tracking-wider ${compact ? 'text-[13px]' : 'text-base'}`}>{s.title.toUpperCase()}</strong>
            {s.when}
          </li>
        );
      })}
    </ol>
  );
}
