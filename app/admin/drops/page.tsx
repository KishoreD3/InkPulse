import { createAdminClient } from '@/lib/supabase/server';
import { dateTime, dropLabel } from '@/lib/format';
import { createNextDrop, forceDropStep, scheduleDesign, updateDrop } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import type { Cause, Design, Drop } from '@/lib/types';

export const metadata = { title: 'Drops' };

export default async function DropsAdmin() {
  const db = createAdminClient();
  const [{ data: drops }, { data: causes }, { data: shortlist }, { data: approved }] = await Promise.all([
    db.from('drops').select('*').order('number', { ascending: false }).limit(12),
    db.from('causes').select('*').eq('active', true).order('name'),
    db.from('cause_shortlist').select('drop_id, cause_id'),
    db.from('designs').select('id, name, drop_id, artist:profiles!designs_artist_id_fkey(handle)').eq('status', 'approved'),
  ]);
  const list = (drops ?? []) as Drop[];
  const cs = (causes ?? []) as Cause[];
  const sl = (shortlist ?? []) as { drop_id: string; cause_id: string }[];
  const ready = (approved ?? []) as unknown as (Pick<Design, 'id' | 'name' | 'drop_id'> & { artist: { handle: string } })[];
  const scheduled = list.filter((d) => d.status === 'scheduled');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="h-display text-[40px]">Drops</h1>
        <ActionButton run={createNextDrop} className="btn-ink btn-sm">Ensure next drop exists</ActionButton>
      </header>

      {ready.length > 0 && (
        <section className="card p-5 flex flex-col gap-3">
          <h2 className="h-display text-2xl">Approved designs · line-up</h2>
          {ready.map((d) => (
            <ActionForm key={d.id} action={scheduleDesign} className="flex flex-wrap items-center gap-3 border-b-2 border-dashed border-ink pb-2" success="Line-up updated.">
              <input type="hidden" name="id" value={d.id} />
              <span className="flex-1 font-semibold">{d.name} <span className="text-muted font-mono text-xs">@{d.artist?.handle}</span></span>
              <select name="dropId" defaultValue={d.drop_id ?? ''} className="input !w-auto" aria-label={`Drop for ${d.name}`}>
                <option value="">Not scheduled</option>
                {scheduled.map((s) => <option key={s.id} value={s.id}>{dropLabel(s.number)}</option>)}
              </select>
              <SubmitButton className="chip-on">Save</SubmitButton>
            </ActionForm>
          ))}
        </section>
      )}

      {list.map((d) => {
        const lineup = ready.filter((r) => r.drop_id === d.id).length;
        return (
          <section key={d.id} className="card p-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl">{dropLabel(d.number)}</h2>
              <span className={`sticker ${d.status === 'live' ? 'bg-pink' : 'bg-acid'}`}>{d.status}</span>
              {d.status === 'scheduled' && <span className="label-mono text-muted">{lineup} approved in line-up</span>}
            </div>
            <p className="font-mono text-xs text-body">Opens {dateTime(d.opens_at)} · Locks {dateTime(d.locks_at)} · Prints {dateTime(d.prints_at)}</p>
            {['scheduled', 'live'].includes(d.status) && (
              <ActionForm action={updateDrop} className="grid gap-3 md:grid-cols-2" success="Drop updated.">
                <input type="hidden" name="id" value={d.id} />
                <div>
                  <label className="label-mono" htmlFor={`cause-${d.id}`}>This drop&apos;s cause</label>
                  <select id={`cause-${d.id}`} name="causeId" defaultValue={d.cause_id ?? ''} className="input">
                    <option value="">— none —</option>
                    {cs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <fieldset>
                  <legend className="label-mono">Next-cause shortlist (voted during this drop)</legend>
                  <div className="flex flex-col gap-1 pt-1 max-h-40 overflow-auto">
                    {cs.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="shortlist" value={c.id} defaultChecked={sl.some((x) => x.drop_id === d.id && x.cause_id === c.id)} />{c.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SubmitButton className="chip-on self-start">Save causes</SubmitButton>
              </ActionForm>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {d.status === 'scheduled' && <StepButton id={d.id} step="open" label="Open now" />}
              {d.status === 'live' && <StepButton id={d.id} step="lock" label="Lock now & settle payments" danger />}
              {d.status === 'locked' && <StepButton id={d.id} step="print" label="Send to print now" />}
              {d.status === 'printing' && <StepButton id={d.id} step="shipped" label="Mark drop shipped" />}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StepButton({ id, step, label, danger }: { id: string; step: string; label: string; danger?: boolean }) {
  return (
    <ActionForm action={forceDropStep} success="Done.">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      <SubmitButton className={danger ? 'btn-pink btn-sm' : 'btn-white btn-sm'}>{label}</SubmitButton>
    </ActionForm>
  );
}
