import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { dateShort, dropLabel } from '@/lib/format';
import { reviewDesign } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { Tee } from '@/components/Tee';
import type { Design, Drop, DropTopic } from '@/lib/types';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Submissions' };

export default async function Submissions() {
  const db = createAdminClient();
  const [{ data: queue }, { data: drops }] = await Promise.all([
    db.from('designs').select('*, artist:profiles!designs_artist_id_fkey(handle, created_at)').eq('status', 'in_review').order('created_at'),
    db.from('drops').select('id, number, opens_at, submissions_close_at').eq('status', 'scheduled').order('opens_at'),
  ]);
  const { data: topicRows } = await db.from('drop_topics').select('*');
  const topics = new Map(((topicRows ?? []) as DropTopic[]).map((t) => [t.drop_id, t]));
  const list = (queue ?? []) as (Design & { artist: { handle: string; created_at: string } })[];
  const upcoming = (drops ?? []) as Pick<Drop, 'id' | 'number' | 'opens_at' | 'submissions_close_at'>[];
  const dropOf = (id: string | null) => upcoming.find((u) => u.id === id);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Submissions <span className="sticker bg-acid align-middle">{list.length} waiting</span></h1>
      <p className="text-body text-sm">Curated entry: nothing reaches the leaderboard without passing review. Check originality (reverse image search), trademarks, print resolution and quality.</p>
      {upcoming.filter((u) => list.some((d) => d.submitted_for === u.id)).map((u) => (
        <p key={u.id} className="bg-acid border-2 border-ink rounded-xl p-3 text-sm font-semibold">
          {dropLabel(u.number)} · “{topics.get(u.id)?.title ?? 'Open theme'}”: {list.filter((d) => d.submitted_for === u.id).length} to review.
          Submissions close {dateTime(u.submissions_close_at)}; finish review before voting opens {dateTime(u.opens_at)}.
        </p>
      ))}
      {list.length === 0 && <p className="card-flat p-6">Queue is clear.</p>}
      {list.map((d) => (
        <article key={d.id} className="card p-4 grid gap-4 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              {d.colours.slice(0, 4).map((c) => (
                <span key={c.name} className="aspect-square border-2 border-ink rounded-xl bg-paper grid place-items-center">
                  <Tee shirt={c.hex} art={c.art || d.art_front_url} size="92%" />
                </span>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              <a href={d.art_front_url} target="_blank" rel="noreferrer" className="chip-off">Open full artwork</a>
              <a href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(d.art_front_url)}`} target="_blank" rel="noreferrer" className="chip-off">Reverse image search</a>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <p className="font-display text-2xl uppercase">{d.name}</p>
              <p className="sticker bg-acid !text-[11px]">
                Topic: {d.submitted_for ? `${topics.get(d.submitted_for)?.title ?? 'Open theme'}${dropOf(d.submitted_for) ? ` · ${dropLabel(dropOf(d.submitted_for)!.number)}` : ' · drop already started'}` : 'none'}
              </p>
              <p className="label-mono text-muted">
                <Link href={`/a/${d.artist.handle}`} className="underline">@{d.artist.handle}</Link> · joined {dateShort(d.artist.created_at)} · submitted {dateShort(d.created_at)} · {d.category}
              </p>
              {d.story && <p className="text-sm pt-2">{d.story}</p>}
              <p className="text-sm pt-1">Originality confirmed: <strong>{d.originality_confirmed ? 'yes' : 'NO'}</strong>{d.perk ? ` · Perk: ${d.perk}` : ''}</p>
            </div>
            <ActionForm action={reviewDesign} className="flex flex-col gap-3" success="Review saved.">
              <input type="hidden" name="id" value={d.id} />
              <div className="flex flex-wrap gap-3">
                {[['approve', 'Approve'], ['changes', 'Request changes'], ['reject', 'Reject']].map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2 font-semibold"><input type="radio" name="decision" value={v} defaultChecked={v === 'approve'} className="w-5 h-5" />{l}</label>
                ))}
              </div>
              <div>
                <label htmlFor={`drop-${d.id}`} className="label-mono">Goes into (on approve)</label>
                <select id={`drop-${d.id}`} name="dropId" className="input" defaultValue="">
                  <option value="">{dropOf(d.submitted_for) ? `Its topic's drop (${dropLabel(dropOf(d.submitted_for)!.number)})` : 'Approve without scheduling'}</option>
                  {upcoming.map((u) => <option key={u.id} value={u.id}>{dropLabel(u.number)} · opens {dateShort(u.opens_at)}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={`note-${d.id}`} className="label-mono">Note to artist (required for changes / reject)</label>
                <textarea id={`note-${d.id}`} name="note" className="input py-2 min-h-[70px]" maxLength={500} />
              </div>
              <SubmitButton className="btn-ink self-start">Save review</SubmitButton>
            </ActionForm>
          </div>
        </article>
      ))}
    </div>
  );
}
