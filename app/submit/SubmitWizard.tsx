'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { saveDesign } from '@/app/actions/designs';
import { BLANKS } from '@/lib/blanks';
import { Tee } from '@/components/Tee';
import { toast } from '@/components/Toaster';
import type { Design } from '@/lib/types';

const STEPS = ['Artwork', 'Details', 'Colours', 'Terms', 'Review'];
const MIN_W = 4500;
const MIN_H = 5400;

async function checkImage(file: File): Promise<string | null> {
  if (!['image/png', 'image/svg+xml'].includes(file.type)) return 'Upload a PNG (transparent background) or SVG.';
  if (file.size > 25 * 1024 * 1024) return 'Max file size is 25 MB.';
  if (file.type === 'image/svg+xml') return null;
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((r) => { img.onload = r; img.onerror = r; img.src = url; });
  URL.revokeObjectURL(url);
  if (img.naturalWidth < MIN_W || img.naturalHeight < MIN_H) {
    return `Artwork is ${img.naturalWidth}×${img.naturalHeight}px. Print needs at least ${MIN_W}×${MIN_H}px (15×18 in at 300 dpi).`;
  }
  return null;
}

export function SubmitWizard({ userId, categories, existing }: { userId: string; categories: string[]; existing: Design | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [art, setArt] = useState(existing?.art_front_url ?? '');
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(existing?.name ?? '');
  const [story, setStory] = useState(existing?.story ?? '');
  const [category, setCategory] = useState(existing?.category ?? categories[0]);
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [perk, setPerk] = useState(existing?.perk ?? '');
  const [colours, setColours] = useState<string[]>(existing?.colours.map((c) => c.name) ?? ['Ink black']);
  const [preview, setPreview] = useState(colours[0] ?? 'Ink black');
  const [original, setOriginal] = useState(existing?.originality_confirmed ?? false);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const problem = await checkImage(file);
    if (problem) { toast({ message: problem, tone: 'error' }); return; }
    setUploading(true);
    const ext = file.type === 'image/svg+xml' ? 'svg' : 'png';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const supabase = getBrowserClient();
    const { error } = await supabase.storage.from('artwork').upload(path, file, { contentType: file.type, upsert: false });
    setUploading(false);
    if (error) { toast({ message: 'Upload failed. Try again.', tone: 'error' }); return; }
    setArt(supabase.storage.from('artwork').getPublicUrl(path).data.publicUrl);
  }

  async function save(submit: boolean) {
    setBusy(true);
    const res = await saveDesign({
      id: existing?.id, name, story, category, perk, colours, artFrontUrl: art, originality: original as true, submit,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (!res.ok) { toast({ message: res.error, tone: 'error' }); return; }
    toast({ message: submit ? 'Submitted for review. We will notify you.' : 'Draft saved.' });
    router.push('/studio');
  }

  const canNext = [Boolean(art), name.trim().length >= 2 && Boolean(category), colours.length > 0, original, true][step];
  const shirt = BLANKS.find((b) => b.name === preview) ?? BLANKS[1];

  return (
    <div className="flex flex-col gap-6 pt-6">
      <ol className="grid grid-cols-5 gap-1.5" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`border-2 border-ink rounded-lg px-1.5 py-1 text-center font-mono font-bold text-[10px] tracking-wider ${i === step ? 'bg-pink' : i < step ? 'bg-acid' : 'bg-card'}`}
            aria-current={i === step ? 'step' : undefined}>{i + 1}. {s.toUpperCase()}</li>
        ))}
      </ol>

      <div className="grid gap-6 md:grid-cols-[1fr_280px] items-start">
        <div className="flex flex-col gap-4">
          {step === 0 && (
            <section className="card p-5 flex flex-col gap-3">
              <h2 className="h-display text-2xl">Upload artwork</h2>
              <p className="text-sm text-body">PNG with a transparent background, at least {MIN_W}×{MIN_H}px, or an SVG. Max 25 MB. Artwork goes through human review for originality before it can go live.</p>
              <label className="btn-white cursor-pointer self-start">
                {uploading ? 'Uploading…' : art ? 'Replace file' : 'Choose file'}
                <input type="file" accept="image/png,image/svg+xml" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </label>
              {art && <p className="sticker bg-acid self-start">Artwork uploaded ✓</p>}
            </section>
          )}
          {step === 1 && (
            <section className="card p-5 flex flex-col gap-4">
              <h2 className="h-display text-2xl">Details</h2>
              <div><label htmlFor="n" className="field-label">Name</label><input id="n" className="input" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} /></div>
              <div><label htmlFor="s" className="field-label">Story <span className="font-sans text-xs text-muted normal-case">({500 - story.length} left)</span></label>
                <textarea id="s" className="input py-3 min-h-[110px]" value={story} maxLength={500} onChange={(e) => setStory(e.target.value)} /></div>
              <div><label htmlFor="c" className="field-label">Category</label>
                <select id="c" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></div>
              <div><label htmlFor="t" className="field-label">Tags</label><input id="t" className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="kolam, chennai, geometry" /></div>
              <div><label htmlFor="p" className="field-label">Backer perk (optional)</label><input id="p" className="input" value={perk} maxLength={140} onChange={(e) => setPerk(e.target.value)} placeholder="Signed print card for backers before 5K" /></div>
            </section>
          )}
          {step === 2 && (
            <section className="card p-5 flex flex-col gap-3">
              <h2 className="h-display text-2xl">Shirt colours</h2>
              <p className="text-sm text-body">Pick 1–4 blanks your art works on. Tap a colour to preview.</p>
              <div className="flex flex-wrap gap-3">
                {BLANKS.map((b) => {
                  const on = colours.includes(b.name);
                  return (
                    <button key={b.name} aria-pressed={on} onClick={() => {
                      setPreview(b.name);
                      setColours((c) => on ? c.filter((x) => x !== b.name) : c.length >= 4 ? c : [...c, b.name]);
                    }} className={`flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-full border-2 border-ink ${on ? 'bg-ink text-acid' : 'bg-card'}`}>
                      <span className="w-7 h-7 rounded-full border-2 border-ink" style={{ background: b.hex }} />{b.name}
                    </button>
                  );
                })}
              </div>
            </section>
          )}
          {step === 3 && (
            <section className="card p-5 flex flex-col gap-3">
              <h2 className="h-display text-2xl">Terms</h2>
              <ul className="text-sm text-body list-disc pl-5 flex flex-col gap-1">
                <li>The artwork is 100% yours — no traced, AI-copied, stock or licensed characters, logos or film stills.</li>
                <li>Every submission is reviewed by a person before it can reach the leaderboard.</li>
                <li>If it prints, you earn the published artist share on every shirt sold, paid after the return window.</li>
              </ul>
              <label className="flex gap-3 items-start font-semibold">
                <input type="checkbox" className="w-6 h-6 mt-0.5 accent-[#FF3EA5]" checked={original} onChange={(e) => setOriginal(e.target.checked)} />
                I confirm this is my original work and I accept the <Link href="/legal/artist-terms" className="underline" target="_blank">artist terms</Link>.
              </label>
            </section>
          )}
          {step === 4 && (
            <section className="card p-5 flex flex-col gap-2 text-sm">
              <h2 className="h-display text-2xl">Review</h2>
              <p><strong>Name:</strong> {name}</p>
              <p><strong>Category:</strong> {category}</p>
              <p><strong>Colours:</strong> {colours.join(', ')}</p>
              {perk && <p><strong>Perk:</strong> {perk}</p>}
              <p className="text-body pt-2">After review we schedule it into an upcoming Monday drop and send you a share kit.</p>
            </section>
          )}

          <div className="flex gap-3 flex-wrap">
            {step > 0 && <button className="btn-white" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 4 && <button className="btn-pink" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</button>}
            {step === 4 && <button className="btn-pink" disabled={busy} onClick={() => save(true)}>{busy ? 'Submitting…' : 'Submit for review'}</button>}
            {art && name && <button className="btn-white" disabled={busy || !original} onClick={() => save(false)} title={!original ? 'Confirm originality to save' : undefined}>Save draft</button>}
          </div>
        </div>

        <aside className="card p-3 flex flex-col items-center gap-2 md:sticky md:top-32">
          <span className="w-full aspect-square border-2 border-ink rounded-xl bg-paper halftone-light grid place-items-center">
            <Tee shirt={shirt.hex} art={art || undefined} size="92%" label="Live preview" />
          </span>
          <span className="label-mono">{shirt.name.toUpperCase()} · PREVIEW</span>
        </aside>
      </div>
    </div>
  );
}
