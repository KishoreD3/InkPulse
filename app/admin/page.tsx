import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { dropLabel, inr, num } from '@/lib/format';
import { ActionButton, Stat } from '@/components/admin';
import { reopenDesign, runScheduler } from '@/app/actions/admin';
import type { Drop, Settings } from '@/lib/types';

export const metadata = { title: 'Admin' };

export default async function AdminDashboard() {
  const db = createAdminClient();
  const [{ data: s }, { data: live }] = await Promise.all([
    db.from('settings').select('*').single(),
    db.from('drops').select('*').eq('status', 'live').maybeSingle(),
  ]);
  const settings = s as Settings;
  const drop = live as Drop | null;
  const since = new Date(Date.now() - 3600_000).toISOString();

  const [voters, votesHour, backed, reviews, reports, failures, notifErr, designs] = await Promise.all([
    drop ? db.rpc('drop_voter_count', { p_drop: drop.id }).then((r) => (r.data as number) ?? 0) : 0,
    drop ? db.from('votes').select('id', { count: 'exact', head: true }).eq('drop_id', drop.id).gte('created_at', since).then((r) => r.count ?? 0) : 0,
    drop ? db.from('orders').select('total, user_id').eq('drop_id', drop.id).eq('status', 'backed').then((r) => r.data ?? []) : [],
    db.from('designs').select('id', { count: 'exact', head: true }).eq('status', 'in_review').then((r) => r.count ?? 0),
    db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').then((r) => r.count ?? 0),
    db.from('orders').select('id, number, failure_reason').not('failure_reason', 'is', null).in('status', ['backed', 'pending', 'won']).limit(10).then((r) => r.data ?? []),
    db.from('notifications').select('id', { count: 'exact', head: true }).not('dispatch_error', 'is', null).then((r) => r.count ?? 0),
    drop ? db.from('designs').select('name, vote_count, backer_count, slug').eq('drop_id', drop.id).eq('status', 'live').order('vote_count', { ascending: false }).then((r) => r.data ?? []) : [],
  ]);
  // Most wanted: finished designs people asked to bring back.
  const { data: wl } = await db.from('design_waitlist').select('design_id');
  const wanted = new Map<string, number>();
  ((wl ?? []) as { design_id: string }[]).forEach((w) => wanted.set(w.design_id, (wanted.get(w.design_id) ?? 0) + 1));
  const wantedIds = Array.from(wanted.keys());
  const { data: wantedDesigns } = wantedIds.length
    ? await db.from('designs').select('id, name, slug, status').in('id', wantedIds)
    : { data: [] };
  const mostWanted = ((wantedDesigns ?? []) as { id: string; name: string; slug: string; status: string }[])
    .map((d) => ({ ...d, n: wanted.get(d.id) ?? 0 })).sort((a, b) => b.n - a.n).slice(0, 8);
  const { count: openReturns } = await db.from('return_requests').select('id', { count: 'exact', head: true }).eq('status', 'open');

  const backers = new Set((backed as { user_id: string }[]).map((b) => b.user_id)).size;
  const backedValue = (backed as { total: number }[]).reduce((t, o) => t + o.total, 0);
  const max = Math.max(1, ...(designs as { vote_count: number }[]).map((d) => d.vote_count));
  const placeholders = [!settings.unit_cost && 'unit cost', !settings.shipping_cost && 'shipping cost', !settings.artist_pct && 'artist %'].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap justify-between items-center gap-3">
        <h1 className="h-display text-[40px]">{drop ? `${dropLabel(drop.number)} · live` : 'No live drop'}</h1>
        <ActionButton run={runScheduler} className="btn-ink btn-sm">Run scheduler now</ActionButton>
      </header>
      {placeholders.length > 0 && (
        <Link href="/admin/settings" className="bg-acid border-2 border-ink rounded-xl p-3 font-semibold">
          Set real numbers before launch: {placeholders.join(', ')} are still 0 — net profit and the cause amount are overstated until you do. →
        </Link>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Voters this drop" value={num(voters)} />
        <Stat label="Votes last hour" value={num(votesHour)} />
        <Stat label="Backers" value={num(backers)} />
        <Stat label="Reserved value" value={inr(backedValue)} />
        <Stat label="Vote → back" value={voters ? `${Math.round((backers / voters) * 100)}%` : '—'} />
        <Stat label="Awaiting review" value={<Link href="/admin/submissions" className="underline">{reviews}</Link>} tone={reviews ? 'warn' : undefined} />
        <Stat label="Open reports" value={<Link href="/admin/moderation" className="underline">{reports}</Link>} tone={reports ? 'warn' : undefined} />
        <Stat label="Delivery errors" value={notifErr} tone={notifErr ? 'warn' : undefined} />
        <Stat label="Open returns" value={<Link href="/admin/returns" className="underline">{openReturns ?? 0}</Link>} tone={openReturns ? 'warn' : undefined} />
      </div>

      {designs.length > 0 && (
        <section className="card p-5 flex flex-col gap-2">
          <h2 className="h-display text-2xl pb-1">Leaderboard</h2>
          {(designs as { name: string; vote_count: number; backer_count: number; slug: string }[]).map((d, i) => (
            <div key={d.slug} className="grid grid-cols-[28px_1fr_90px_70px] items-center gap-3 text-sm">
              <span className="font-display">#{i + 1}</span>
              <span className="h-6 bg-paper border-2 border-ink rounded-md overflow-hidden relative">
                <span className={`absolute inset-y-0 left-0 ${i < settings.winners_per_drop ? 'bg-pink' : 'bg-mist'}`} style={{ width: `${(d.vote_count / max) * 100}%` }} />
                <span className="relative px-2 font-semibold leading-5">{d.name}</span>
              </span>
              <span className="font-mono text-right">{num(d.vote_count)}</span>
              <span className="font-mono text-right text-muted">{d.backer_count} bk</span>
            </div>
          ))}
        </section>
      )}

      {mostWanted.length > 0 && (
        <section className="card p-5 flex flex-col gap-2">
          <h2 className="h-display text-2xl">Most wanted</h2>
          <p className="text-sm text-body">Finished designs people asked to bring back. Reopening puts it on sale for {settings.reopen_days} days and notifies everyone on the list.</p>
          {mostWanted.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b-2 border-dashed border-ink py-2">
              <Link href={`/d/${d.slug}`} className="flex-1 font-semibold underline">{d.name}</Link>
              <span className="font-mono text-sm">{num(d.n)} waiting</span>
              <ActionButton run={reopenDesign.bind(null, d.id)} className="chip-on" confirm={`Put ${d.name} back on sale and notify ${d.n} people?`}>Bring it back</ActionButton>
            </div>
          ))}
        </section>
      )}

      {failures.length > 0 && (
        <section className="card p-5">
          <h2 className="h-display text-2xl pb-2">Payment issues</h2>
          {(failures as { id: string; number: number; failure_reason: string }[]).map((f) => (
            <p key={f.id} className="font-mono text-sm border-b-2 border-dashed border-ink py-1.5">#{f.number} · {f.failure_reason}</p>
          ))}
        </section>
      )}
    </div>
  );
}
