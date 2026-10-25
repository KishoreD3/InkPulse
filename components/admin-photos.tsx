'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Mockup and product photo links for a listing. Files go straight from the browser to Storage
 * (the admin's own folder in the public "posts" bucket) and their links are added to the list.
 */
export function PhotoField({ designId, mockup: initialMockup, photos: initial }: { designId: string; mockup: string; photos: string[] }) {
  const [mockup, setMockup] = useState(initialMockup);
  const [photos, setPhotos] = useState(initial.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (files: FileList | null, target: 'mockup' | 'photos') => {
    if (!files?.length) return;
    setBusy(true); setError('');
    const supabase = getBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError('Sign in again.'); return; }
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      if (!TYPES.includes(f.type)) { setError(`${f.name}: use JPG, PNG or WebP.`); continue; }
      if (f.size > 5 * 1024 * 1024) { setError(`${f.name} is over 5 MB.`); continue; }
      const path = `${user.id}/listings/${designId}/${Date.now()}-${urls.length}.${f.type.split('/')[1].replace('jpeg', 'jpg')}`;
      const { error: err } = await supabase.storage.from('posts').upload(path, f, { contentType: f.type });
      if (err) { setError(`Upload failed: ${err.message}`); continue; }
      urls.push(supabase.storage.from('posts').getPublicUrl(path).data.publicUrl);
    }
    setBusy(false);
    if (!urls.length) return;
    if (target === 'mockup') setMockup(urls[0]);
    else setPhotos((p) => [p.trim(), ...urls].filter(Boolean).join('\n'));
  };

  const list = photos.split('\n').map((x) => x.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1"><span className="label-mono">Card mockup (finalists)</span>
        <div className="flex gap-2"><input name="mockup" className="input" value={mockup} onChange={(e) => setMockup(e.target.value)} placeholder="https://…" />
          <label className="btn-white btn-sm cursor-pointer whitespace-nowrap">Upload<input type="file" accept={TYPES.join(',')} hidden onChange={(e) => void upload(e.target.files, 'mockup')} /></label></div>
      </label>
      <label className="flex flex-col gap-1"><span className="label-mono">Product photos, one link per line (first = main photo)</span>
        <textarea name="photos" className="input py-2 min-h-[90px] font-mono text-xs" value={photos} onChange={(e) => setPhotos(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="btn-white btn-sm cursor-pointer">{busy ? 'Uploading…' : 'Upload photos'}<input type="file" accept={TYPES.join(',')} multiple hidden disabled={busy} onChange={(e) => void upload(e.target.files, 'photos')} /></label>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {[mockup, ...list].filter(Boolean).slice(0, 9).map((src, i) => <img key={i} src={src} alt="" className="w-14 h-14 object-cover rounded-lg border-2 border-ink" />)}
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
