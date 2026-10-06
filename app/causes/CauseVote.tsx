'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { voteCause } from '@/app/actions/social';
import { toast } from '@/components/Toaster';

export function CauseVote({ options, mine, signedIn }: {
  options: { id: string; name: string; description: string | null; votes: number }[]; mine: string | null; signedIn: boolean;
}) {
  const [pick, setPick] = useState(mine);
  const [pending, start] = useTransition();
  const router = useRouter();
  const total = options.reduce((s, o) => s + o.votes, 0) - (mine ? 1 : 0) + (pick ? 1 : 0);
  return (
    <div className="flex flex-col gap-3" role="radiogroup" aria-label="Vote for the next cause">
      {options.map((o) => {
        const on = pick === o.id;
        const v = o.votes - (mine === o.id ? 1 : 0) + (on ? 1 : 0);
        const pct = total ? Math.round((v / total) * 100) : 0;
        return (
          <button key={o.id} role="radio" aria-checked={on} disabled={pending}
            onClick={() => {
              if (!signedIn) { router.push('/signin?next=/causes'); return; }
              const prev = pick; setPick(o.id);
              start(async () => {
                const r = await voteCause(o.id);
                if (!r.ok) { setPick(prev); toast({ message: r.error, tone: 'error', action: r.error.includes('phone') ? { label: 'Verify', href: '/me#phone' } : undefined }); }
              });
            }}
            className={`text-left w-full p-4 rounded-[14px] border-2 border-ink flex flex-col gap-2 ${on ? 'bg-acid shadow-hard' : 'bg-card shadow-hard-sm'}`}>
            <span className="flex justify-between items-center gap-3 w-full">
              <span className="font-display text-xl uppercase">{o.name}</span>
              <span className="font-display text-2xl">{pct}%</span>
            </span>
            <span className="h-3 border-2 border-ink rounded-md bg-card overflow-hidden w-full block">
              <span className={`block h-full ${on ? 'bg-cobalt' : 'bg-ink'}`} style={{ width: `${pct}%` }} />
            </span>
            {o.description && <span className="text-sm text-body">{o.description}</span>}
          </button>
        );
      })}
    </div>
  );
}
