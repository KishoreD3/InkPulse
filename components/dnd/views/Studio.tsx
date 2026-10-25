'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { COLOURS, OPEN_TOPIC, moods, type ColourKey } from '@/lib/dnd/catalog';
import { dh, submissionsCloseAt } from '@/lib/dnd/cycle';
import { useNow, useStore, type Check, type Draft } from '@/lib/dnd/store';
import { Btn, Icon, Logo } from '../ui';

const STEPS = ['Brief', 'Artwork', 'Details', 'Colours', 'Review'];
const MAX_BYTES = 100 * 1024 * 1024;
const blank: Draft = { step: 1, pledge: false, title: '', mood: moods[1].name, story: '', tags: '', colours: ['black'], image: null, fileName: null, checks: null, savedAt: 0 };

/** Reads an image file, checks it against the print spec and returns a small preview for the browser to keep. */
async function inspect(file: File): Promise<{ image: string; checks: Check[] }> {
  const url = URL.createObjectURL(file);
  try {
    const el = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('unreadable'));
      i.src = url;
    });
    const w = el.naturalWidth || 4500;
    const h = el.naturalHeight || 5400;
    const scale = Math.min(1, 600 / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    let transparent = file.type === 'image/svg+xml';
    if (!transparent && file.type === 'image/png') {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 16) if (data[i] < 250) { transparent = true; break; }
    }
    const vector = file.type === 'image/svg+xml';
    const bigEnough = vector || (w >= 4500 && h >= 5400);
    const ratio = w / h;
    return {
      image: canvas.toDataURL(transparent ? 'image/png' : 'image/jpeg', 0.85),
      checks: [
        { label: 'Print size', ok: bigEnough, note: bigEnough ? 'Passed' : `${w}×${h} px · needs 4500×5400` },
        { label: 'Transparent', ok: transparent, note: transparent ? 'Passed' : 'Has a background' },
        { label: 'Print area', ok: Math.abs(ratio - 5 / 6) < 0.2, note: Math.abs(ratio - 5 / 6) < 0.2 ? 'Passed' : 'Crop to 5:6' },
        { label: 'File size', ok: file.size <= MAX_BYTES, note: `${(file.size / 1024 / 1024).toFixed(1)} MB` },
      ],
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StudioView() {
  const { state, hydrated, update, submitDesign, toast } = useStore();
  const now = useNow(60_000);
  const [d, setD] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!hydrated || loaded.current) return;
    loaded.current = true;
    if (state.draft) setD(state.draft);
  }, [hydrated, state.draft]);

  // Autosave the draft a moment after each change.
  useEffect(() => {
    if (!loaded.current) return;
    const t = window.setTimeout(() => update({ draft: { ...d, savedAt: Date.now() } }), 400);
    return () => window.clearTimeout(t);
  }, [d, update]);

  const used = state.submissions.filter((s) => s.drop === OPEN_TOPIC.drop).length;
  const full = used >= OPEN_TOPIC.maxEntries;
  const set = (patch: Partial<Draft>) => { setErr(''); setD((x) => ({ ...x, ...patch })); };
  const valid = [
    d.pledge,
    Boolean(d.image) && !(d.checks ?? []).some((c) => c.label === 'File size' && !c.ok),
    d.title.trim().length >= 2 && d.story.trim().length >= 20,
    d.colours.length >= 1,
  ];
  const blocker = ['Confirm this is your original work to continue.', 'Upload your artwork to continue.', 'Add a title and at least a sentence of story (20+ characters).', 'Pick at least one colour.'];
  const maxStep = valid.findIndex((v) => !v) === -1 ? 5 : valid.findIndex((v) => !v) + 1;
  const next = () => {
    if (!valid[d.step - 1]) { setErr(blocker[d.step - 1]); return; }
    set({ step: Math.min(5, d.step + 1) });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(f.type)) { setErr('Upload a PNG, JPG or SVG. (Export PSDs to PNG first.)'); return; }
    if (f.size > MAX_BYTES) { setErr('That file is over 100 MB.'); return; }
    setBusy(true);
    try {
      const r = await inspect(f);
      set({ image: r.image, checks: r.checks, fileName: f.name });
    } catch {
      setErr('We couldn’t read that image. Try exporting it again.');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (valid.some((v) => !v)) { setErr('A step above still needs something.'); set({ step: maxStep }); return; }
    const s = submitDesign({ title: d.title.trim(), mood: d.mood, story: d.story.trim(), tags: d.tags.trim(), colours: d.colours, image: d.image, fileName: d.fileName });
    setD(blank);
    setDone(s.title);
    toast('Submitted to Drop 046', 'Curators review every entry. We’ll ping you either way.', { label: 'Dashboard', href: '/dashboard' });
  };

  const tee = (cls = '') => (
    <div className={`tee ${d.colours[0] ?? 'black'} ${cls}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {d.image ? <img src={d.image} alt="Your artwork on the tee" /> : d.step > 2 && d.title ? d.title.toUpperCase() : <>YOUR ART<br />HERE</>}
    </div>
  );
  const savedLabel = !d.savedAt ? 'Not saved yet' : now && now - d.savedAt < 60_000 ? 'Saved just now' : 'Autosaved';

  return (
    <div className="studio">
      <header className="studio-top"><Logo /><div>Entry {Math.min(used + 1, OPEN_TOPIC.maxEntries)} of {OPEN_TOPIC.maxEntries} · <b>{savedLabel}</b></div><Link className="link" href="/dashboard">Dashboard</Link></header>
      {done || full ? (
        <main className="studio-main studio-done">
          <div className="ok"><Icon name="check" size={32} /></div>
          <h1>{done ? `“${done}” is in.` : 'Both entries used.'}</h1>
          <p className="muted">{done ? 'Curators review every entry for originality and print quality. Finalists are announced Monday 10 AM.' : `You’ve sent ${OPEN_TOPIC.maxEntries} designs to ${OPEN_TOPIC.title}. Track them in your dashboard.`}</p>
          <div className="row center-row">
            <Btn v="dark" href="/dashboard">Go to dashboard</Btn>
            {done && !full && used < OPEN_TOPIC.maxEntries && <Btn v="outline" onClick={() => setDone(null)}>Submit another</Btn>}
            <Btn v="ghost" href="/">Back to store</Btn>
          </div>
        </main>
      ) : (
        <>
          <div className="studio-grid">
            <aside className="studio-steps"><p className="eyebrow">SUBMIT A DESIGN</p>{STEPS.map((x, i) => (
              <button key={x} disabled={i + 1 > maxStep} aria-current={d.step === i + 1 ? 'step' : undefined} className={d.step === i + 1 ? 'now' : valid[i] && i + 1 < d.step ? 'done' : ''} onClick={() => set({ step: i + 1 })}><b>{valid[i] && i + 1 < d.step ? '✓' : i + 1}</b>{x}</button>
            ))}</aside>
            <main className="studio-main">
              <div className="deadline"><Icon name="clock" /><b>{OPEN_TOPIC.title} · closes in {now ? dh(submissionsCloseAt(now) - now) : '…'}</b></div>
              {d.step === 1 && (
                <div className="sf"><p className="eyebrow">STEP 1 OF 5</p><h1>Read the brief.<br />Make it yours.</h1>
                  <div className="brief"><span className="sticker">DROP 0{OPEN_TOPIC.drop}</span><h2>{OPEN_TOPIC.title}</h2><p>{OPEN_TOPIC.brief}</p><b>What we’re looking for</b><ul><li>A strong idea that reads from 2 metres away</li><li>Original work — no fan art, no AI, no third-party IP</li><li>Up to 6 print colours</li></ul></div>
                  <label className="pledge"><input type="checkbox" checked={d.pledge} onChange={(e) => set({ pledge: e.target.checked })} /><span /><p><b>This is my original work.</b><br />I own the rights and didn’t copy anyone. Do not dupe. <Link className="link small" href="/legal/artist-terms">Artist terms</Link></p></label>
                </div>
              )}
              {d.step === 2 && (
                <div className="sf"><p className="eyebrow">STEP 2 OF 5</p><h1>Upload your artwork.</h1>
                  <div
                    className={`upload ${drag ? 'drag' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files[0]); }}
                  >
                    {d.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img className="upload-preview" src={d.image} alt="Uploaded artwork" />
                      : <Icon name="upload" size={38} />}
                    <h3>{busy ? 'Checking your file…' : d.fileName ?? 'Drop a PNG, JPG or SVG here'}</h3>
                    <p>Transparent background · 4500 × 5400 px · max 100 MB</p>
                    <Btn v="outline" onClick={() => file.current?.click()}>{d.image ? 'Replace file' : 'Choose file'}</Btn>
                    <input ref={file} type="file" accept="image/png,image/jpeg,image/svg+xml" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
                  </div>
                  {d.checks && <div className="checks">{d.checks.map((c) => <p key={c.label} className={c.ok ? '' : 'warn'}>{c.ok ? <Icon name="check" /> : '!'} {c.label} <b>{c.note}</b></p>)}</div>}
                  {d.checks?.some((c) => !c.ok) && <p className="muted small">Warnings won’t block you, but curators may ask for a print-ready file before the vote.</p>}
                </div>
              )}
              {d.step === 3 && (
                <div className="sf"><p className="eyebrow">STEP 3 OF 5</p><h1>Tell the story.</h1>
                  <label>Design title<input maxLength={40} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Rush Hour Raga" /></label>
                  <label>Mood<select value={d.mood} onChange={(e) => set({ mood: e.target.value })}>{moods.slice(0, 6).map((m) => <option key={m.name}>{m.name}</option>)}</select></label>
                  <label>Story <small className="muted">{d.story.trim().length}/280</small><textarea maxLength={280} value={d.story} onChange={(e) => set({ story: e.target.value })} placeholder="What inspired this piece? What should the club notice?" /></label>
                  <label>Tags<input value={d.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="city, chaos, type, Bengaluru" /></label>
                </div>
              )}
              {d.step === 4 && (
                <div className="sf"><p className="eyebrow">STEP 4 OF 5</p><h1>Pick up to 3 colours.</h1>
                  <div className="colour-picks">{COLOURS.map((c) => {
                    const on = d.colours.includes(c.key);
                    return <button key={c.key} aria-pressed={on} className={on ? 'on' : ''} onClick={() => set({ colours: on ? d.colours.filter((x) => x !== c.key) : d.colours.length < 3 ? [...d.colours, c.key as ColourKey] : d.colours })}><i style={{ background: c.hex }} />{c.name}</button>;
                  })}</div>
                  <p className="muted small">{d.colours.length} of 3 selected{d.colours.length === 3 ? ' · deselect one to swap' : ''}. The first one is shown in the preview.</p>
                </div>
              )}
              {d.step === 5 && (
                <div className="sf"><p className="eyebrow">STEP 5 OF 5</p><h1>One last look.</h1>
                  <div className="review-art">{tee()}<div><h2>{d.title || 'Untitled entry'}</h2><p className="muted">{d.mood} · {d.colours.map((c) => COLOURS.find((x) => x.key === c)?.name).join(', ')}</p><p className="muted small">{d.story}</p>{d.checks?.every((c) => c.ok) ? <b className="green">All checks passed</b> : <b className="warn-text">Passed with warnings</b>}</div></div>
                  <div className="hold-note"><Icon name="shield" /><p>Once submitted, your artwork can’t be edited while curators review it.</p></div>
                  <Btn v="dark" onClick={submit}>Submit to Drop 0{OPEN_TOPIC.drop} <Icon name="arrow" /></Btn>
                </div>
              )}
              {err && <p className="field-error studio-err" role="alert">{err}</p>}
            </main>
            <aside className="studio-preview"><p className="eyebrow">LIVE PREVIEW</p><div className="stage-box">{tee()}</div><h3>Oversized tee</h3><p className="muted">{d.colours.length} of 3 colours selected</p></aside>
          </div>
          <footer className="studio-foot">
            <Btn v="outline" onClick={() => set({ step: Math.max(1, d.step - 1) })} disabled={d.step === 1}>Back</Btn>
            <span className="muted">{savedLabel}</span>
            {d.step < 5 ? <Btn v="dark" onClick={next}>Continue <Icon name="arrow" /></Btn> : <span />}
          </footer>
        </>
      )}
    </div>
  );
}
