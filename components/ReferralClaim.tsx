'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { claimReferral } from '@/app/actions/growth';
import { toast } from './Toaster';

/** Rendered only when an invite cookie is present and the member is signed in. */
export function ReferralClaim() {
  const ran = useRef(false);
  const router = useRouter();
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    claimReferral().then((r) => {
      if (r.claimed) {
        toast({ message: 'Welcome in! Your first-tee discount is waiting.', action: { label: 'See it', href: '/me#rewards' } });
        router.refresh();
      }
    }).catch(() => {});
  }, [router]);
  return null;
}
