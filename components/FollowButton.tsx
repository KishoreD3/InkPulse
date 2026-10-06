'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleFollow } from '@/app/actions/social';
import { toast } from './Toaster';

export function FollowButton({ artistId, initial, signedIn }: { artistId: string; initial: boolean; signedIn: boolean }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        if (!signedIn) { router.push('/signin'); return; }
        const next = !on; setOn(next);
        start(async () => {
          const res = await toggleFollow(artistId, next);
          if (!res.ok) { setOn(!next); toast({ message: res.error, tone: 'error' }); }
        });
      }}
      className={`h-10 px-4 rounded-full border-2 border-ink font-bold text-sm ${on ? 'bg-ink text-acid' : 'bg-card shadow-hard-sm'}`}
    >
      {on ? 'Following' : 'Follow'}
    </button>
  );
}
