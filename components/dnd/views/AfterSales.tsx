'use client';
import { useState } from 'react';
import { SIZES } from '@/lib/dnd/catalog';
import { DAY, dateTime } from '@/lib/dnd/cycle';
import { useStore, type Fit, type Order, type OrderLine, type ReturnKind, type ReturnReason } from '@/lib/dnd/store';
import { Btn, Photo } from '../ui';

const FIT_LABEL: [Fit, string][] = [['small', 'Runs small'], ['true', 'True to size'], ['large', 'Runs large']];
const REASONS: [ReturnReason, string][] = [['size', 'Size doesn’t fit'], ['damaged', 'Arrived damaged'], ['misprint', 'Print looks wrong'], ['wrong_item', 'Wrong item'], ['other', 'Something else']];
const STATUS: Record<string, string> = { open: 'Requested · we reply within 2 days', approved: 'Approved · pickup being arranged', rejected: 'Declined', completed: 'Completed' };
const WINDOW_DAYS = 7;

/** Reviews and size exchanges for delivered tees. */
export function AfterSales({ order, delivered }: { order: Order; delivered: OrderLine[] }) {
  if (!delivered.length) return null;
  const deliveredAt = order.deliveredAt ?? order.createdAt + 6 * DAY;
  return (
    <section className="after-sales">
      <div className="as-reviews">
        <p className="eyebrow">HOW DID IT FIT?</p>
        {delivered.map((l) => <ReviewForm key={l.key} order={order} line={l} />)}
      </div>
      <ReturnForm order={order} lines={delivered} closesAt={deliveredAt + WINDOW_DAYS * DAY} />
    </section>
  );
}

function ReviewForm({ order, line }: { order: Order; line: OrderLine }) {
  const { postReview, toast } = useStore();
  const [rating, setRating] = useState(line.review?.rating ?? 0);
  const [fit, setFit] = useState<Fit | null>(line.review?.fit ?? null);
  const [body, setBody] = useState(line.review?.body ?? '');
  const [editing, setEditing] = useState(!line.review);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (!editing && line.review) {
    return (
      <div className="as-card">
        <Photo src={line.image} alt="" className="os-photo" />
        <div><b>{line.name}</b><p><span className="as-stars">{'★'.repeat(line.review.rating)}{'☆'.repeat(5 - line.review.rating)}</span> {line.review.body ?? ''}</p></div>
        <button className="link small" onClick={() => setEditing(true)}>Edit</button>
      </div>
    );
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setErr('Pick a star rating.'); return; }
    setBusy(true); setErr('');
    const r = await postReview(order, line, { rating, fit, body: body.trim() || null });
    setBusy(false);
    if (r) { setErr(r); return; }
    setEditing(false);
    toast('Thanks for the review', 'It helps the next person pick a size, and the artist sees it too.');
  };
  return (
    <form className="as-card as-form" onSubmit={submit}>
      <Photo src={line.image} alt="" className="os-photo" />
      <div>
        <b>{line.name} · {line.size}</b>
        <div className="as-stars-input" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>)}
        </div>
        <div className="chips">{FIT_LABEL.map(([k, label]) => <button key={k} type="button" aria-pressed={fit === k} className={fit === k ? 'on' : ''} onClick={() => setFit(fit === k ? null : k)}>{label}</button>)}</div>
        <textarea maxLength={500} placeholder="What do you love about it? (optional)" aria-label="Review" value={body} onChange={(e) => setBody(e.target.value)} />
        {err && <p className="field-error" role="alert">{err}</p>}
        <Btn v="dark" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Post review'}</Btn>
      </div>
    </form>
  );
}

function ReturnForm({ order, lines, closesAt }: { order: Order; lines: OrderLine[]; closesAt: number }) {
  const { requestReturn, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ReturnKind>('exchange');
  const [reason, setReason] = useState<ReturnReason>('size');
  const [lineKey, setLineKey] = useState(lines[0].key);
  const line = lines.find((l) => l.key === lineKey) ?? lines[0];
  const [newSize, setNewSize] = useState(lines[0].size === 'M' ? 'L' : 'M');
  const [details, setDetails] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const active = (order.returns ?? []).find((r) => r.status === 'open' || r.status === 'approved') ?? order.returns?.[0];
  const closed = Date.now() > closesAt;

  if (active) {
    return (
      <div className="as-return">
        <p className="eyebrow">{active.kind === 'exchange' ? 'SIZE EXCHANGE' : 'RETURN'}</p>
        <h3>{STATUS[active.status]}</h3>
        <p className="muted">{active.kind === 'exchange' && active.newSize ? `New size ${active.newSize} · ` : ''}asked {dateTime(active.at)}</p>
      </div>
    );
  }
  if (closed) return <div className="as-return"><p className="eyebrow">EXCHANGES</p><p className="muted">The {WINDOW_DAYS}-day exchange window for this order has closed. Something wrong with the print? Write to us from the contact page.</p></div>;
  if (!open) {
    return (
      <div className="as-return">
        <p className="eyebrow">WRONG SIZE?</p>
        <h3>One free size exchange.</h3>
        <p className="muted">Until {dateTime(closesAt)}. We pick up the old one when the new one arrives.</p>
        <Btn v="outline" onClick={() => setOpen(true)}>Exchange or return</Btn>
      </div>
    );
  }
  const needsPhoto = reason === 'damaged' || reason === 'misprint' || reason === 'wrong_item';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (needsPhoto && !photos.length) { setErr('Add a photo so we can sort it quickly.'); return; }
    setBusy(true); setErr('');
    const r = await requestReturn(order, { line, kind, reason, newSize: kind === 'exchange' ? newSize : null, details, photos });
    setBusy(false);
    if (r) { setErr(r); return; }
    toast('Request sent', 'We’ll reply within 2 days. Keep the tag on.');
  };
  return (
    <form className="as-return as-form" onSubmit={submit}>
      <p className="eyebrow">EXCHANGE OR RETURN</p>
      <div className="seg-toggle" role="tablist">
        <button type="button" role="tab" aria-selected={kind === 'exchange'} className={kind === 'exchange' ? 'on' : ''} onClick={() => setKind('exchange')}>Swap size</button>
        <button type="button" role="tab" aria-selected={kind === 'return'} className={kind === 'return' ? 'on' : ''} onClick={() => setKind('return')}>Return</button>
      </div>
      {lines.length > 1 && <label className="field"><span>Which tee</span><select value={lineKey} onChange={(e) => setLineKey(e.target.value)}>{lines.map((l) => <option key={l.key} value={l.key}>{l.name} · {l.size}</option>)}</select></label>}
      <label className="field"><span>Reason</span><select value={reason} onChange={(e) => setReason(e.target.value as ReturnReason)}>{REASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
      {kind === 'exchange' && <label className="field"><span>New size</span><select value={newSize} onChange={(e) => setNewSize(e.target.value)}>{SIZES.map((s) => <option key={s}>{s}</option>)}</select></label>}
      <label className="field"><span>Details (optional)</span><textarea maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} /></label>
      <label className="field"><span>Photos {needsPhoto ? '(needed)' : '(optional)'} · up to 3</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []).filter((f) => f.size <= 5 * 1024 * 1024).slice(0, 3))} /></label>
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="row"><Btn v="dark" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</Btn><Btn v="ghost" onClick={() => setOpen(false)}>Cancel</Btn></div>
    </form>
  );
}
