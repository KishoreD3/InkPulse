import Link from 'next/link';
import { requireSession } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { markAllRead } from '@/app/actions/social';
import { timeAgo } from '@/lib/format';
import type { Notification } from '@/lib/types';

export const metadata = { title: 'Notifications' };
export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireSession('/notifications');
  const { data } = await createClient().from('notifications').select('*').order('created_at', { ascending: false }).limit(80);
  const items = (data ?? []) as Notification[];
  const today = new Date().toDateString();
  const groups = [
    ['Today', items.filter((n) => new Date(n.created_at).toDateString() === today)],
    ['Earlier', items.filter((n) => new Date(n.created_at).toDateString() !== today)],
  ] as const;
  return (
    <div className="container-page py-6 max-w-2xl flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="h-display text-[40px] misprint">Alerts</h1>
        <form action={async () => { 'use server'; await markAllRead(); }}><button className="chip-off">Mark all read</button></form>
      </header>
      {items.length === 0 && <p className="card-flat p-6 text-center">Nothing yet. Vote on something and we will keep you posted.</p>}
      {groups.map(([label, list]) => list.length > 0 && (
        <section key={label} className="flex flex-col gap-2">
          <h2 className="label-mono text-muted">{label}</h2>
          {list.map((n) => (
            <Link key={n.id} href={n.link ?? '#'} className={`flex gap-3 p-3.5 border-2 border-ink rounded-xl ${n.read_at ? 'bg-card/60' : 'bg-card shadow-hard-sm'}`}>
              {!n.read_at && <span className="w-2.5 h-2.5 mt-1.5 rounded-full bg-pink border border-ink shrink-0" aria-label="Unread" />}
              <span className="flex-1">
                <span className="block font-bold">{n.title}</span>
                {n.body && <span className="block text-sm text-body">{n.body}</span>}
              </span>
              <span className="font-mono text-[11px] text-muted">{timeAgo(n.created_at)}</span>
            </Link>
          ))}
        </section>
      ))}
    </div>
  );
}
