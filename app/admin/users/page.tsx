import { createAdminClient } from '@/lib/supabase/server';
import { dateShort } from '@/lib/format';
import { setUserFlag } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';
import type { Profile } from '@/lib/types';

export const metadata = { title: 'Users' };

export default async function UsersAdmin({ searchParams }: { searchParams: { q?: string } }) {
  const db = createAdminClient();
  let q = db.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
  if (searchParams.q) q = q.ilike('handle', `%${searchParams.q.replace(/[%_]/g, '')}%`);
  const { data } = await q;
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap justify-between gap-3 items-center">
        <h1 className="h-display text-[40px]">Users</h1>
        <form className="flex gap-2"><input name="q" defaultValue={searchParams.q} className="input !w-56" placeholder="Search handle" aria-label="Search handle" /><button className="chip-on">Search</button></form>
      </header>
      {((data ?? []) as Profile[]).map((u) => (
        <div key={u.id} className="card p-3 flex flex-wrap items-center gap-3">
          <span className="flex-1 min-w-[160px]"><strong>@{u.handle}</strong> <span className="font-mono text-xs text-muted">joined {dateShort(u.created_at)}</span></span>
          {u.is_admin && <span className="sticker bg-cobalt text-white">admin</span>}
          {u.is_artist && <span className="sticker bg-acid">artist</span>}
          {u.banned && <span className="sticker bg-pink">banned</span>}
          <ActionButton run={setUserFlag.bind(null, u.id, 'is_artist', !u.is_artist)}>{u.is_artist ? 'Remove artist' : 'Make artist'}</ActionButton>
          <ActionButton run={setUserFlag.bind(null, u.id, 'banned', !u.banned)} confirm={u.banned ? undefined : `Ban @${u.handle}? They will not be able to vote, post or buy.`}>{u.banned ? 'Unban' : 'Ban'}</ActionButton>
          <ActionButton run={setUserFlag.bind(null, u.id, 'is_admin', !u.is_admin)} confirm={`${u.is_admin ? 'Remove' : 'Grant'} admin for @${u.handle}?`}>{u.is_admin ? 'Remove admin' : 'Make admin'}</ActionButton>
        </div>
      ))}
    </div>
  );
}
