'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setWaitlist } from '@/app/actions/growth';
import { toast } from './Toaster';

export function WaitlistButton({ designId, slug, initial, count, signedIn }: {
  designId: string; slug: string; initial: boolean; count: number; signedIn: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [n, setN] = useState(count);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-col gap-2 p-4 border-2 border-ink rounded-[18px] bg-card shadow-hard-sm">
      <p className="font-display text-xl">WANT THIS ONE PRINTED?</p>
      <p className="text-sm text-body">
        {n > 0 ? `${n.toLocaleString('en-IN')} ${n === 1 ? 'person has' : 'people have'} asked. ` : ''}
        Enough requests and we bring it back for a short run. We&apos;ll tell you the moment it&apos;s on sale.
      </p>
      <button
        className={on ? 'btn-white self-start' : 'btn-pink self-start'}
        disabled={pending}
        onClick={() => {
          if (!signedIn) { router.push(`/signin?next=/d/${slug}`); return; }
          start(async () => {
            const r = await setWaitlist(designId, !on);
            if (!r.ok) { toast({ message: r.error, tone: 'error' }); return; }
            setN(n + (on ? -1 : 1)); setOn(!on);
            toast({ message: on ? 'Removed from the list.' : 'You’re on the list. We’ll notify you.' });
          });
        }}
      >
        {on ? 'On the list ✓ (tap to leave)' : 'Notify me if it comes back'}
      </button>
    </div>
  );
}
