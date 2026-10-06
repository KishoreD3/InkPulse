'use client';
import { useState } from 'react';
import { ActionForm, SubmitButton } from '@/components/forms';
import { PhotoPicker } from '@/components/PhotoPicker';
import { postReview, requestReturn } from '@/app/actions/growth';

export function ReviewForm({ orderId, itemId, name, existing }: {
  orderId: string; itemId: string; name: string;
  existing: { rating: number; fit: string | null; body: string | null; photo_urls: string[] } | null;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  return (
    <ActionForm action={postReview} className="card p-4 flex flex-col gap-3" success="Thanks! Your review is live.">
      <p className="font-display text-xl uppercase">{existing ? 'Your review' : 'Rate'} · {name}</p>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <input type="hidden" name="rating" value={rating || ''} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)} className={`text-3xl leading-none ${n <= rating ? 'text-pink' : 'text-mist'}`}>★</button>
        ))}
      </div>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="field-label">How does it fit?</legend>
        {[['small', 'Runs small'], ['true', 'True to size'], ['large', 'Runs large']].map(([v, l]) => (
          <label key={v} className="chip-off cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-acid">
            <input type="radio" name="fit" value={v} defaultChecked={existing?.fit === v} className="sr-only" />{l}
          </label>
        ))}
      </fieldset>
      <div>
        <label htmlFor={`body-${itemId}`} className="field-label">Tell other buyers (optional)</label>
        <textarea id={`body-${itemId}`} name="body" className="input py-3 min-h-[80px]" maxLength={500} defaultValue={existing?.body ?? ''}
          placeholder="Print quality, fabric, how the colour looks in person…" />
      </div>
      <div><p className="field-label">Fit pics (optional)</p><PhotoPicker initial={existing?.photo_urls ?? []} /></div>
      <SubmitButton className="btn-ink self-start">{existing ? 'Update review' : 'Post review'}</SubmitButton>
    </ActionForm>
  );
}

export function ReturnForm({ orderId, sizes, days }: { orderId: string; sizes: string[]; days: number }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'exchange' | 'return'>('exchange');
  if (!open) {
    return (
      <button type="button" className="text-sm font-bold underline self-start" onClick={() => setOpen(true)}>
        Wrong size or something off? Request an exchange or return ({days} days after delivery)
      </button>
    );
  }
  return (
    <ActionForm action={requestReturn} className="card p-4 flex flex-col gap-3" success="Request sent. We’ll reply within 2 working days.">
      <p className="font-display text-xl">EXCHANGE OR RETURN</p>
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex gap-2">
        {(['exchange', 'return'] as const).map((k) => (
          <label key={k} className={kind === k ? 'chip-on cursor-pointer' : 'chip-off cursor-pointer'}>
            <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
            {k === 'exchange' ? 'Exchange size' : 'Return'}
          </label>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="reason" className="field-label">What happened?</label>
          <select id="reason" name="reason" className="input" defaultValue="size">
            <option value="size">Size doesn’t fit</option>
            <option value="damaged">Arrived damaged</option>
            <option value="misprint">Print defect</option>
            <option value="wrong_item">Wrong item</option>
            <option value="other">Something else</option>
          </select>
        </div>
        {kind === 'exchange' && (
          <div>
            <label htmlFor="newSize" className="field-label">Send me size</label>
            <select id="newSize" name="newSize" className="input" required>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="details" className="field-label">Details (optional)</label>
        <textarea id="details" name="details" className="input py-3 min-h-[72px]" maxLength={500} />
      </div>
      <div><p className="field-label">Photos (helps for damage or print defects)</p><PhotoPicker /></div>
      <div className="flex gap-2">
        <SubmitButton className="btn-ink">Send request</SubmitButton>
        <button type="button" className="chip-off" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </ActionForm>
  );
}
