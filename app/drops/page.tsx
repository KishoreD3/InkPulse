import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { dateShort, dropLabel } from '@/lib/format';
import type { Drop } from '@/lib/types';

export const metadata = { title: 'Past drops' };
export const dynamic = 'force-dynamic';

export default async function DropsPage() {
  const { data } = await createClient().from('drops').select('*').neq('status', 'scheduled').order('number', { ascending: false }).limit(60);
  return (
    <div className="container-page py-6 max-w-3xl flex flex-col gap-4">
      <h1 className="h-display text-[48px] misprint">Past drops</h1>
      {((data ?? []) as Drop[]).map((d) => (
        <Link key={d.id} href={`/drops/${d.number}`} className="card p-4 flex justify-between items-center">
          <span className="font-display text-2xl">{dropLabel(d.number)}</span>
          <span className="label-mono text-muted">{dateShort(d.opens_at)} · {d.status}</span>
        </Link>
      ))}
    </div>
  );
}
