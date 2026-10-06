import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { resolveReturn } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { timeAgo } from '@/lib/format';
import type { ReturnRequest } from '@/lib/types';

export const metadata = { title: 'Returns & exchanges' };

const REASONS: Record<ReturnRequest['reason'], string> = {
  size: 'Size doesn’t fit', damaged: 'Damaged', misprint: 'Print defect', wrong_item: 'Wrong item', other: 'Other',
};

export default async function ReturnsAdmin({ searchParams }: { searchParams: { status?: string } }) {
  const status = ['open', 'approved', 'rejected', 'completed'].includes(searchParams.status ?? '') ? searchParams.status! : 'open';
  const db = createAdminClient();
  const { data } = await db.from('return_requests')
    .select('*, order:orders(number, total, ship_to, items:order_items(size, colour, qty, design:designs(name)))')
    .eq('status', status).order('created_at', { ascending: true }).limit(100);
  const rows = (data ?? []) as (ReturnRequest & {
    order: { number: number; total: number; ship_to: { name: string; city: string; phone: string }; items: { size: string; colour: string; qty: number; design: { name: string } | null }[] } | null;
  })[];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Returns &amp; exchanges</h1>
      <nav className="flex gap-2 flex-wrap" aria-label="Filter">
        {['open', 'approved', 'completed', 'rejected'].map((s) => (
          <Link key={s} href={`/admin/returns?status=${s}`} className={s === status ? 'chip-on' : 'chip-off'}>{s}</Link>
        ))}
      </nav>
      <p className="text-sm text-body">
        Approve → book the courier pickup (and for exchanges, send the new size). Refunds for approved returns are issued from Orders. Mark completed once it&apos;s done.
      </p>
      {rows.length === 0 && <p className="card-flat p-5">Nothing {status}.</p>}
      {rows.map((r) => (
        <section key={r.id} className="card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="font-display text-xl">
              {r.kind === 'exchange' ? `Exchange → ${r.new_size}` : 'Return'} · order #{r.order?.number}
            </p>
            <span className="label-mono text-muted">{timeAgo(r.created_at)}</span>
          </div>
          <p className="text-sm">
            <strong>{REASONS[r.reason]}</strong>{r.details ? ` — ${r.details}` : ''}<br />
            <span className="text-body">
              {r.order?.items.map((i) => `${i.design?.name} ${i.colour} ${i.size} ×${i.qty}`).join(', ')} · {r.order?.ship_to.name}, {r.order?.ship_to.city} · {r.order?.ship_to.phone}
            </span>
          </p>
          {r.photo_urls.length > 0 && (
            <div className="flex gap-2">
              {r.photo_urls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="Photo from the member" className="w-24 h-24 object-cover border-2 border-ink rounded-lg" /></a>
              ))}
            </div>
          )}
          {r.admin_note && <p className="text-sm font-mono">Note: {r.admin_note}</p>}
          {(r.status === 'open' || r.status === 'approved') && (
            <ActionForm action={resolveReturn} className="flex flex-wrap gap-2 items-center" success="Updated. The member has been notified.">
              <input type="hidden" name="id" value={r.id} />
              <input name="admin_note" className="input !w-72" placeholder="Note to the member (pickup date, reason…)" maxLength={300} aria-label="Note" />
              <select name="status" className="input !w-40" aria-label="Decision" defaultValue={r.status === 'open' ? 'approved' : 'completed'}>
                {r.status === 'open' && <option value="approved">Approve</option>}
                {r.status === 'open' && <option value="rejected">Decline</option>}
                <option value="completed">Completed</option>
              </select>
              <SubmitButton className="chip-on">Save</SubmitButton>
            </ActionForm>
          )}
        </section>
      ))}
    </div>
  );
}
