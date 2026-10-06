import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { dateShort } from '@/lib/format';
import { resolveReport } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';

export const metadata = { title: 'Moderation' };

export default async function Moderation() {
  const db = createAdminClient();
  const { data } = await db.from('reports').select('*, reporter:profiles!reports_reporter_id_fkey(handle)').eq('status', 'open').order('created_at').limit(100);
  const reports = (data ?? []) as { id: string; target_type: string; target_id: string; reason: string; created_at: string; reporter: { handle: string } }[];

  // Resolve a preview for each target.
  const previews = new Map<string, string>();
  await Promise.all(reports.map(async (r) => {
    if (r.target_type === 'post') { const { data: x } = await db.from('posts').select('body').eq('id', r.target_id).maybeSingle(); previews.set(r.id, x?.body ?? '(deleted)'); }
    if (r.target_type === 'comment') { const { data: x } = await db.from('comments').select('body').eq('id', r.target_id).maybeSingle(); previews.set(r.id, x?.body ?? '(deleted)'); }
    if (r.target_type === 'design') { const { data: x } = await db.from('designs').select('name, slug').eq('id', r.target_id).maybeSingle(); previews.set(r.id, x ? `${x.name} → /d/${x.slug}` : '(deleted)'); }
  }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Moderation</h1>
      {reports.length === 0 && <p className="card-flat p-5">No open reports.</p>}
      {reports.map((r) => (
        <article key={r.id} className="card p-4 flex flex-col gap-2">
          <p className="label-mono text-muted">{r.target_type} · reported by @{r.reporter?.handle} · {dateShort(r.created_at)}</p>
          <p className="font-semibold">{r.reason}</p>
          <blockquote className="border-l-4 border-pink pl-3 text-sm">
            {previews.get(r.id)?.startsWith('/') ? <Link href={previews.get(r.id)!}>{previews.get(r.id)}</Link> : previews.get(r.id)}
          </blockquote>
          <div className="flex gap-2">
            <ActionButton run={resolveReport.bind(null, r.id, 'hide')} className="chip-on">{r.target_type === 'design' ? 'Withdraw design' : 'Hide'}</ActionButton>
            <ActionButton run={resolveReport.bind(null, r.id, 'dismiss')}>Dismiss</ActionButton>
          </div>
        </article>
      ))}
    </div>
  );
}
