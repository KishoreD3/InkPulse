'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { createHouseTee } from '@/app/actions/admin';
import { ActionForm, SubmitButton } from '@/components/forms';
import { PhotoField } from '@/components/admin-photos';
import { COLOURS, FITS, moods } from '@/lib/dnd/catalog';

const ART_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml'];

/** Admin form for a tee that goes on sale straight away, without a battle. */
export function HouseTeeForm({ artists }: { artists: { id: string; label: string }[] }) {
  const [art, setArt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [draftId] = useState(() => `house-${Date.now()}`);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (!ART_TYPES.includes(file.type)) { setError('Use a PNG, JPG or SVG print file.'); return; }
    if (file.size > 50 * 1024 * 1024) { setError('That file is over 50 MB.'); return; }
    setBusy(true);
    const supabase = getBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError('Sign in again.'); return; }
    const ext = file.type === 'image/svg+xml' ? 'svg' : file.type === 'image/jpeg' ? 'jpg' : 'png';
    const path = `${user.id}/house/${Date.now()}.${ext}`;
    const { error: err } = await supabase.storage.from('artwork').upload(path, file, { contentType: file.type });
    setBusy(false);
    if (err) { setError(`Upload failed: ${err.message}`); return; }
    setArt(supabase.storage.from('artwork').getPublicUrl(path).data.publicUrl);
  };

  if (!artists.length) {
    return <p className="text-body text-sm">First pick the account these tees are credited to: Admin → Users → turn on <b>artist</b> for it (for example a “DND Studio” account).</p>;
  }

  return (
    <ActionForm action={createHouseTee} className="grid gap-3 md:grid-cols-2" success="House tee is on sale.">
      <label className="flex flex-col gap-1"><span className="label-mono">Name (shown in the shop)</span><input name="name" className="input" maxLength={40} required placeholder="Kaapi Club" /></label>
      <label className="flex flex-col gap-1"><span className="label-mono">Credited to</span>
        <select name="artistId" className="input">{artists.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1 md:col-span-2"><span className="label-mono">Story (one or two sentences)</span><textarea name="story" className="input py-2 min-h-[70px]" maxLength={500} /></label>
      <label className="flex flex-col gap-1"><span className="label-mono">Mood</span>
        <select name="mood" className="input">{moods.filter((m) => !['under-999', 'oversized'].includes(m.slug)).map((m) => <option key={m.slug}>{m.name}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1"><span className="label-mono">Fit</span>
        <select name="fit" className="input">{FITS.map((f) => <option key={f.name}>{f.name}</option>)}</select>
      </label>
      <fieldset className="flex flex-wrap gap-3 md:col-span-2"><legend className="label-mono">Tee colours</legend>
        {COLOURS.map((c) => <label key={c.key} className="flex items-center gap-2 font-semibold"><input type="checkbox" name="colours" value={c.name} defaultChecked={c.key === 'black'} className="w-5 h-5" />{c.name}</label>)}
      </fieldset>
      <label className="flex flex-col gap-1"><span className="label-mono">Badge (empty = DND STUDIO)</span><input name="badge" className="input" maxLength={30} placeholder="DND STUDIO" /></label>
      <div className="flex flex-col gap-1"><span className="label-mono">Print file (transparent PNG, 4500 × 5400 px)</span>
        <input type="hidden" name="art" value={art} />
        <div className="flex items-center gap-2">
          <label className="btn-white btn-sm cursor-pointer">{busy ? 'Uploading…' : art ? 'Replace file' : 'Upload print file'}<input type="file" accept={ART_TYPES.join(',')} hidden disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {art && <img src={art} alt="" className="w-14 h-14 object-contain rounded-lg border-2 border-ink bg-white" />}
        </div>
      </div>
      <div className="md:col-span-2"><PhotoField designId={draftId} mockup="" photos={[]} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700 md:col-span-2">{error}</p>}
      <SubmitButton className="btn-ink self-start">Put on sale</SubmitButton>
    </ActionForm>
  );
}
