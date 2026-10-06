'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPost } from '@/app/actions/social';
import { Avatar } from '@/components/PostCard';
import { toast } from '@/components/Toaster';

export function Composer({ handle }: { handle: string }) {
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="flex gap-2.5 items-center p-1.5 pl-2 card shadow-hard-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createPost({ body });
          if (res.ok) { setBody(''); router.refresh(); } else toast({ message: res.error, tone: 'error' });
        });
      }}
    >
      <Avatar handle={handle} size={36} />
      <label htmlFor="composer" className="sr-only">Write a post</label>
      <input id="composer" value={body} onChange={(e) => setBody(e.target.value)} maxLength={280}
        placeholder="Hype a design, tag an artist…" className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[15px]" />
      <span className="font-mono text-[10px] text-muted hidden sm:inline">{280 - body.length}</span>
      <button className="btn-ink btn-sm" disabled={pending || !body.trim()}>POST</button>
    </form>
  );
}
