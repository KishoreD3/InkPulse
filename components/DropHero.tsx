import { Countdown } from './Countdown';
import { dropLabel, inr, weekday } from '@/lib/format';
import type { Drop, Settings } from '@/lib/types';

/** Dark countdown card: drop number, time to Thursday's lock, Mon/Thu/Fri strip. */
export function DropHero({ drop, settings, voters, slotsLocked, topic }: {
  drop: Drop; settings: Settings; voters: number; slotsLocked: number; topic?: string;
}) {
  const live = drop.status === 'live';
  const target = live ? drop.locks_at : drop.status === 'scheduled' ? drop.opens_at : drop.prints_at;
  const label = live ? 'VOTING CLOSES IN' : drop.status === 'scheduled' ? 'NEXT DROP OPENS IN' : 'WINNERS PRINT IN';
  const stage = live ? 1 : drop.status === 'scheduled' ? 0 : 2;

  return (
    <section className="relative bg-ink text-white rounded-[14px] shadow-hard-pink p-5 md:p-6 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`rounded px-2 py-1 text-[10px] font-black tracking-[0.1em] ${live ? 'bg-red text-white' : 'bg-yellow text-ink'}`}>
          {dropLabel(drop.number)} · {live ? 'VOTING NOW' : drop.status.toUpperCase()}
        </span>
        {live && <span className="text-[11px] text-[#AAA] font-semibold">{voters.toLocaleString('en-IN')} voters so far</span>}
      </div>
      {topic && <p className="text-[28px] md:text-[32px] font-black tracking-[-0.03em] leading-none pt-1">{topic}</p>}
      <p className="eyebrow !text-[#AAA] pt-2">{label}</p>
      <Countdown to={target} className="text-[52px] md:text-[60px] font-black tracking-[-0.04em] leading-none text-yellow tabular-nums" unitsClassName="text-[9px] font-bold tracking-[0.2em] text-[#777] pt-1" />
      <ol className="grid grid-cols-3 gap-2 pt-1" aria-label="Weekly schedule">
        {[
          ['MON', 'Voting opens'],
          ['THU', 'Voting closes'],
          ['FRI', `Top ${settings.winners_per_drop} print`],
        ].map(([d, t], i) => (
          <li key={d} className={`rounded-lg px-2.5 py-2 text-[11px] ${i === stage ? 'bg-yellow text-ink' : i < stage ? 'bg-white/10 text-white' : 'bg-white/5 text-[#999]'}`}>
            <strong className="block text-[13px] font-black">{d}</strong>{t}
          </li>
        ))}
      </ol>
      {live && (
        <p className="text-[13px] text-[#CFCFC9] pt-1 leading-relaxed">
          Back a design for <strong className="text-yellow">{inr(settings.backer_price)}</strong> — charged only if it finishes top {settings.winners_per_drop}.
          {settings.backer_threshold > 0 && <> Backer price closes for a design at {settings.backer_threshold.toLocaleString('en-IN')} votes ({inr(settings.retail_price)} after){slotsLocked > 0 ? `; ${slotsLocked} of ${settings.winners_per_drop} print-zone designs are past it` : ''}.</>}
        </p>
      )}
      {!live && drop.status !== 'scheduled' && (
        <p className="text-[13px] text-[#CFCFC9]">Voting closed {weekday(drop.locks_at)}. Winners hit the press soon.</p>
      )}
    </section>
  );
}
