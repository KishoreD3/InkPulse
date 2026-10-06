'use client';
import { useState } from 'react';
import { getBrowserClient } from '@/lib/supabase/client';
import { toast } from './Toaster';

/**
 * Uploads up to `max` photos into the member's own folder in the public "posts" bucket
 * and exposes their URLs to the surrounding form as a newline-separated hidden field.
 */
export function PhotoPicker({ name = 'photos', max = 3, initial = [] }: { name?: string; max?: number; initial?: string[] }) {
  const [urls, setUrls] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const supabase = getBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast({ message: 'Sign in again to upload.', tone: 'error' }); return; }
    setBusy(true);
    const next = [...urls];
    for (const file of Array.from(files).slice(0, max - urls.length)) {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast({ message: 'Photos must be JPG, PNG or WebP.', tone: 'error' }); continue; }
      if (file.size > 5 * 1024 * 1024) { toast({ message: 'Each photo must be under 5 MB.', tone: 'error' }); continue; }
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('posts').upload(path, file, { contentType: file.type });
      if (error) { toast({ message: 'Upload failed. Try again.', tone: 'error' }); continue; }
      next.push(supabase.storage.from('posts').getPublicUrl(path).data.publicUrl);
    }
    setUrls(next);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={urls.join('\n')} />
      <div className="flex flex-wrap gap-2 items-center">
        {urls.map((u) => (
          <span key={u} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="Your upload" className="w-20 h-20 object-cover border-2 border-ink rounded-lg" />
            <button type="button" aria-label="Remove photo" onClick={() => setUrls(urls.filter((x) => x !== u))}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-ink text-white text-xs grid place-items-center">✕</button>
          </span>
        ))}
        {urls.length < max && (
          <label className="chip-off cursor-pointer">
            {busy ? 'Uploading…' : '+ Photo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={busy}
              onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
          </label>
        )}
      </div>
    </div>
  );
}
