'use client';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addComment } from '@/app/actions/social';
import { toast } from './Toaster';

export function CommentForm({ designId, postId, signedIn }: { designId?: string; postId?: string; signedIn: boolean }) {
  const [body, setBody] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!signedIn) {
    return <Link href="/signin" className="card-flat p-3 text-sm font-semibold">Sign in to join the conversation</Link>;
  }
  const id = `c-${designId ?? postId}`;
  return (
    <form
      className="flex gap-2.5 items-center p-1.5 pl-4 card-flat shadow-hard-sm"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await addComment({ body, designId, postId });
          if (res.ok) { setBody(''); router.refresh(); } else toast({ message: res.error, tone: 'error' });
        });
      }}
    >
      <label htmlFor={id} className="sr-only">Add a comment</label>
      <input id={id} value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Add a comment"
        className="flex-1 min-w-0 h-10 bg-transparent outline-none text-[15px]" />
      <button disabled={pending || !body.trim()} className="btn-ink btn-sm">POST</button>
    </form>
  );
}
