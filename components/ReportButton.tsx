'use client';
import { useState } from 'react';
import { Flag } from './Icons';
import { toast } from './Toaster';
import { reportContent } from '@/app/actions/social';

export function ReportButton({ targetType, targetId, signedIn }: {
  targetType: 'post' | 'comment' | 'design' | 'profile' | 'review'; targetId: string; signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  if (!signedIn) return null;
  return (
    <div className="relative">
      <button aria-label="Report" onClick={() => setOpen((o) => !o)} className="w-10 h-10 grid place-items-center text-muted hover:text-ink">
        <Flag size={18} />
      </button>
      {open && (
        <form
          className="absolute right-0 top-11 z-20 w-64 card p-3 flex flex-col gap-2"
          action={async () => {
            const res = await reportContent(targetType, targetId, reason);
            toast(res.ok ? { message: 'Thanks — our team will review it.' } : { message: res.error, tone: 'error' });
            setOpen(false); setReason('');
          }}
        >
          <label htmlFor={`r-${targetId}`} className="label-mono">Why are you reporting this?</label>
          <select id={`r-${targetId}`} className="input" value={reason} onChange={(e) => setReason(e.target.value)} required>
            <option value="">Choose a reason</option>
            <option>Copied or stolen artwork</option>
            <option>Trademark or copyright infringement</option>
            <option>Spam or scam</option>
            <option>Harassment or hate</option>
            <option>Something else</option>
          </select>
          <button className="btn-ink btn-sm">Send report</button>
        </form>
      )}
    </div>
  );
}
