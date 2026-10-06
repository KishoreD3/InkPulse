import { Countdown } from './Countdown';
import { dropLabel, inr, weekday } from '@/lib/format';
import type { Drop, Settings } from '@/lib/types';

/** Black poster card: drop number, countdown to Thursday's lock, Mon/Thu/Fri strip. */
export function DropHero({ drop, settings, voters, slotsLocked }: {
  drop: Drop; settings: Settings; voters: number; slotsLocked: number;
}) {
  const live = drop.status === 'live';
  const target = live ? drop.locks_at : drop.status === 'scheduled' ? drop.opens_at : drop.prints_at;
  const label = live ? 'VOTING LOCKS THURSDAY IN' : drop.status === 'scheduled' ? 'NEXT DROP OPENS IN' : 'WINNERS PRINT IN';
  const stage = live ? 1 : drop.status === 'scheduled' ? 0 : 2;

  return (
    <section className="relative bg-ink halftone-dark text-haze border-2 border-ink rounded-[22px] shadow-hard-pink p-5 md:p-7 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="-rotate-3 bg-acid text-ink font-display text-[15px] tracking-wider px-3 py-1 rounded">
          {dropLabel(drop.number)} · {live ? 'LIVE' : drop.status.toUpperCase()}
        </span>
        {live && <span className="font-mono text-[11px] text-mist">{voters.toLocaleString('en-IN')} VOTERS SO FAR</span>}
      </div>
      <div aria-hidden className="absolute top-3 right-3 w-[86px] h-[86px] md:w-[104px] md:h-[104px] rounded-full bg-pink text-ink rotate-12 grid place-items-center font-marker text-sm md:text-base leading-tight text-center">
        TOP {settings.winners_per_drop}<br />GET<br />PRINTED
      </div>
      <p className="label-mono text-mist pt-2">{label}</p>
      <Countdown to={target} className="font-display text-[64px] md:text-[80px] leading-[0.9] text-acid" unitsClassName="font-mono text-[10px] tracking-[3px] text-mist" />
      <ol className="grid grid-cols-3 gap-2 pt-1" aria-label="Weekly schedule">
        {[
          ['MON', 'VOTING OPENS'],
          ['THU', 'VOTING LOCKS'],
          ['FRI', `TOP ${settings.winners_per_drop} PRINT`],
        ].map(([d, t], i) => (
          <li key={d} className={`rounded-lg border-2 px-2 py-1.5 font-mono text-[10px] ${i === stage ? 'bg-pink border-pink text-ink' : i < stage ? 'border-acid text-acid' : 'border-mist text-mist'}`}>
            <strong className="block font-display font-normal text-base tracking-wider">{d}</strong>{t}
          </li>
        ))}
      </ol>
      {live && (
        <p className="text-sm text-haze pt-1">
          Back before {settings.backer_threshold.toLocaleString('en-IN')} votes to lock{' '}
          <strong className="text-acid">{inr(settings.backer_price)}</strong> ({inr(settings.retail_price)} after). UPI AutoPay debits only if it prints.
          {' '}{slotsLocked} of {settings.winners_per_drop} print slots held past {settings.backer_threshold.toLocaleString('en-IN')} votes.
        </p>
      )}
      {!live && drop.status !== 'scheduled' && (
        <p className="text-sm">Voting locked {weekday(drop.locks_at)}. Winners hit the press soon.</p>
      )}
    </section>
  );
}
