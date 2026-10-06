import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { dateShort } from '@/lib/format';
import { hideReview, resolveReport } from '@/app/actions/admin';
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
    if (r.target_type === 'review') { const { data: x } = await db.from('reviews').select('rating, body').eq('id', r.target_id).maybeSingle(); previews.set(r.id, x ? `${'★'.repeat(x.rating)} ${x.body ?? ''}` : '(deleted)'); }
    if (r.target_type === 'design') { const { data: x } = await db.from('designs').select('name, slug').eq('id', r.target_id).maybeSingle(); previews.set(r.id, x ? `${x.name} → /d/${x.slug}` : '(deleted)'); }
  }));

  const { data: latest } = await db.from('reviews')
    .select('id, rating, body, photo_urls, created_at, author:profiles!reviews_user_id_fkey(handle), design:designs(name, slug)')
    .eq('hidden', false).order('created_at', { ascending: false }).limit(15);
  const reviews = (latest ?? []) as unknown as { id: string; rating: number; body: string | null; photo_urls: string[]; created_at: string; author: { handle: string } | null; design: { name: string; slug: string } | null }[];

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

      <h2 className="h-display text-3xl pt-4">Latest reviews</h2>
      {reviews.length === 0 && <p className="card-flat p-5">No reviews yet.</p>}
      {reviews.map((r) => (
        <article key={r.id} className="card p-4 flex flex-wrap gap-3 items-start">
          <div className="flex-1 min-w-[220px]">
            <p className="label-mono text-muted">@{r.author?.handle} · <Link href={`/d/${r.design?.slug}`} className="underline">{r.design?.name}</Link> · {dateShort(r.created_at)}</p>
            <p><span aria-label={`${r.rating} out of 5`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> {r.body}</p>
          </div>
          {r.photo_urls.map((u) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt="" className="w-16 h-16 object-cover border-2 border-ink rounded-lg" />
          ))}
          <ActionButton run={hideReview.bind(null, r.id)} confirm="Hide this review?">Hide</ActionButton>
        </article>
      ))}
    </div>
  );
}
