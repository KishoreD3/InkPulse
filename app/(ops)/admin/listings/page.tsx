import { createAdminClient } from '@/lib/supabase/server';
import { saveListing } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { PhotoField } from '@/components/admin-photos';
import { HouseTeeForm } from '@/components/admin-house-tee';
import { COLLECTIONS, FITS, moods } from '@/lib/dnd/catalog';
import { dropLabel } from '@/lib/format';

export const metadata = { title: 'Store listings' };

type Row = {
  id: string; slug: string; name: string; status: string; mood: string | null; fit: string; collections: string[];
  photo_urls: string[]; mockup_url: string | null; care_label: string | null; badge: string | null; art_front_url: string;
  drop: { number: number } | null; artist: { name: string | null; handle: string } | null;
};

export default async function Listings({ searchParams }: { searchParams: { show?: string } }) {
  const show = searchParams.show === 'all' ? ['approved', 'live', 'won', 'lost'] : ['approved', 'live', 'won'];
  const { data } = await createAdminClient().from('designs')
    .select('id, slug, name, status, mood, fit, collections, photo_urls, mockup_url, care_label, badge, art_front_url, drop:drops!designs_drop_id_fkey(number), artist:profiles!designs_artist_id_fkey(name, handle)')
    .in('status', show).order('created_at', { ascending: false }).limit(60);
  const rows = (data ?? []) as unknown as Row[];
  const { data: artistRows } = await createAdminClient().from('profiles').select('id, name, handle')
    .eq('is_artist', true).eq('banned', false).order('name').limit(200);
  const artists = ((artistRows ?? []) as { id: string; name: string | null; handle: string }[])
    .map((a) => ({ id: a.id, label: a.name ? `${a.name} (@${a.handle})` : `@${a.handle}` }));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Store listings</h1>
      <p className="text-body text-sm">
        What each design looks like in the shop: mood, fit, photos and labels. Finalists use the mockup on their card; winners show the photos
        (model shot first, then flat-lay, print close-up, lifestyle). “New” and “Bestsellers” are also added automatically.
        {' '}<a className="underline" href={searchParams.show === 'all' ? '/admin/listings' : '/admin/listings?show=all'}>{searchParams.show === 'all' ? 'Hide finished losers' : 'Show all'}</a>
      </p>
      <details className="card p-4 flex flex-col gap-3">
        <summary className="font-display text-2xl uppercase cursor-pointer">Add a house tee</summary>
        <p className="text-body text-sm pb-3">
          A tee that goes on sale right away, without a battle, and stays on sale. The shop labels it a DND Studio original, not a community winner.
          It is printed with the next weekly batch like any other order.
        </p>
        <HouseTeeForm artists={artists} />
      </details>
      {rows.length === 0 && <p className="card-flat p-6">No approved, live or winning designs yet.</p>}
      {rows.map((d) => (
        <article key={d.id} className="card p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-display text-2xl uppercase">{d.name}</p>
            <span className="sticker bg-acid !text-[11px]">{d.status}{d.drop ? ` · ${dropLabel(d.drop.number)}` : ''}</span>
            <span className="label-mono text-muted">{d.artist?.name ?? `@${d.artist?.handle}`} · <a className="underline" href={`/design/${d.slug}`}>view in store</a> · <a className="underline" href={d.art_front_url} target="_blank" rel="noreferrer">artwork</a></span>
          </div>
          <ActionForm action={saveListing} className="grid gap-3 md:grid-cols-2" success="Listing saved.">
            <input type="hidden" name="id" value={d.id} />
            <label className="flex flex-col gap-1"><span className="label-mono">Mood</span>
              <select name="mood" className="input" defaultValue={d.mood ?? ''}><option value="">None</option>{moods.filter((m) => !['under-999', 'oversized'].includes(m.slug)).map((m) => <option key={m.slug}>{m.name}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1"><span className="label-mono">Fit</span>
              <select name="fit" className="input" defaultValue={d.fit}>{FITS.map((f) => <option key={f.name}>{f.name}</option>)}</select>
            </label>
            <label className="flex flex-col gap-1"><span className="label-mono">Care label (on the tag)</span><input name="care" className="input" maxLength={30} defaultValue={d.care_label ?? ''} placeholder="DO NOT DISTURB" /></label>
            <label className="flex flex-col gap-1"><span className="label-mono">Badge (empty = automatic)</span><input name="badge" className="input" maxLength={30} defaultValue={d.badge ?? ''} placeholder="BACK IN STOCK" /></label>
            <fieldset className="flex flex-wrap gap-3 md:col-span-2"><legend className="label-mono">Collections</legend>
              {COLLECTIONS.map((c) => <label key={c.slug} className="flex items-center gap-2 font-semibold"><input type="checkbox" name="collections" value={c.slug} defaultChecked={d.collections.includes(c.slug)} className="w-5 h-5" />{c.name}</label>)}
            </fieldset>
            <div className="md:col-span-2"><PhotoField designId={d.id} mockup={d.mockup_url ?? ''} photos={d.photo_urls} /></div>
            <SubmitButton className="btn-ink self-start">Save listing</SubmitButton>
          </ActionForm>
        </article>
      ))}
    </div>
  );
}
