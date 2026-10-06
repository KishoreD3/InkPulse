'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tee } from '@/components/Tee';
import { Lock, Pin } from '@/components/Icons';
import { AddressForm } from '@/components/AddressBook';
import { toast } from '@/components/Toaster';
import { clearBag, readBag } from '@/lib/cart';
import { getBrowserClient } from '@/lib/supabase/client';
import { inr } from '@/lib/format';
import type { Address, CartLine, Colourway, PriceType } from '@/lib/types';

declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: (r: unknown) => void) => void } }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

interface Props {
  mode: 'back' | 'bag';
  addresses: Address[];
  backing: null | {
    design: { id: string; slug: string; name: string; colours: Colourway[]; art_front_url: string };
    price: number; priceType: PriceType; colour: string; size: string; qty: number;
  };
  settings: { retail_price: number; shipping_fee: number; free_shipping_over: number; cause_pct: number; sizes: string[] };
  initialCode: string | null;
  rewards: { code: string; label: string }[];
}

export function CheckoutClient({ mode, addresses, backing, settings, initialCode, rewards }: Props) {
  const router = useRouter();
  const [addressId, setAddressId] = useState(addresses[0]?.id ?? '');
  const [adding, setAdding] = useState(addresses.length === 0);
  const [qty, setQty] = useState(backing?.qty ?? 1);
  const [bag, setBag] = useState<CartLine[]>([]);
  const [bagDesigns, setBagDesigns] = useState<Record<string, { colours: Colourway[]; art_front_url: string }>>({});
  const [busy, setBusy] = useState(false);
  const [codeInput, setCodeInput] = useState(initialCode ?? '');
  const [applied, setApplied] = useState<{ code: string; amount: number } | null>(null);
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { if (addresses.length && !addressId) setAddressId(addresses[0].id); }, [addresses, addressId]);
  useEffect(() => {
    if (mode !== 'bag') return;
    const lines = readBag(); setBag(lines);
    if (lines.length) {
      getBrowserClient().from('designs').select('id, colours, art_front_url').in('id', lines.map((l) => l.designId))
        .then(({ data }) => setBagDesigns(Object.fromEntries((data ?? []).map((d) => [d.id, d]))));
    }
  }, [mode]);

  const subtotal = useMemo(() => (backing ? backing.price * qty : bag.reduce((s, l) => s + settings.retail_price * l.qty, 0)), [backing, qty, bag, settings.retail_price]);
  const shipping = settings.free_shipping_over && subtotal >= settings.free_shipping_over ? 0 : settings.shipping_fee;
  const discount = applied?.amount ?? 0;
  const total = subtotal - discount + shipping;
  const fullPrice = backing ? settings.retail_price * qty : subtotal;
  const orderType = backing ? 'backing' : 'retail';

  async function applyCode(raw: string) {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    setChecking(true); setCodeMsg(null);
    const res = await fetch('/api/checkout/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, type: orderType, subtotal }) });
    const data = await res.json().catch(() => ({}));
    setChecking(false);
    if (!res.ok) { setApplied(null); setCodeMsg(data.error ?? 'That code isn’t valid.'); return; }
    setApplied(data); setCodeInput(data.code);
  }

  // Re-check the code when the subtotal changes (quantity, bag contents).
  useEffect(() => {
    const code = applied?.code ?? (initialCode && !codeMsg ? initialCode : null);
    if (code && subtotal > 0) void applyCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function pay() {
    if (!addressId) { toast({ message: 'Add a delivery address first.', tone: 'error' }); return; }
    setBusy(true);
    const body = backing
      ? { mode: 'back', addressId, design: backing.design.slug, colour: backing.colour, size: backing.size, qty, code: applied?.code ?? null }
      : { mode: 'bag', addressId, lines: bag.map((l) => ({ designId: l.designId, colour: l.colour, size: l.size, qty: l.qty })), code: applied?.code ?? null };
    const res = await fetch('/api/checkout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { setBusy(false); toast({ message: data.error ?? 'Could not start payment.', tone: 'error' }); return; }
    if (!(await loadRazorpay()) || !window.Razorpay) { setBusy(false); toast({ message: 'Could not load the payment window. Check your connection.', tone: 'error' }); return; }

    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.gatewayOrderId,
      amount: data.amountPaise,
      currency: 'INR',
      name: 'INKPULSE',
      description: data.description,
      prefill: { ...data.prefill, email: data.email },
      theme: { color: '#FF3EA5' },
      config: { display: { preferences: { show_default_blocks: true } } },
      modal: { ondismiss: () => setBusy(false) },
      handler: async (r: Record<string, string>) => {
        const v = await fetch('/api/payments/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) });
        if (mode === 'bag') clearBag();
        router.push(`/orders/${data.orderId}?new=1${v.ok ? '' : '&pending=1'}`);
      },
    });
    rzp.on('payment.failed', () => { setBusy(false); toast({ message: 'Payment failed. Nothing was charged — try again.', tone: 'error' }); });
    rzp.open();
  }

  return (
    <div className="flex flex-col gap-6">
      {mode === 'back' && (
        <div className="flex gap-3 items-center p-4 border-2 border-ink rounded-[14px] bg-acid shadow-hard">
          <Lock size={28} />
          <p className="text-sm leading-snug"><span className="font-display text-lg tracking-wide">CHARGED ONLY IF IT PRINTS.</span><br />
            The amount is reserved now. It is debited on Thursday only if {backing?.design.name} makes the top 3. Otherwise it is released.</p>
        </div>
      )}

      <section className="flex flex-col gap-3">
        {backing ? (
          <Item name={backing.design.name} colours={backing.design.colours} art={backing.design.art_front_url} colour={backing.colour} size={backing.size}
            qty={qty} onQty={setQty} />
        ) : bag.length === 0 ? (
          <p className="card-flat p-4">Your bag is empty.</p>
        ) : bag.map((l) => (
          <Item key={`${l.designId}-${l.colour}-${l.size}`} name={l.name} colours={bagDesigns[l.designId]?.colours ?? []} art={bagDesigns[l.designId]?.art_front_url}
            colour={l.colour} size={l.size} qty={l.qty} />
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-xl tracking-wide">SHIP TO</h2>
        {addresses.map((a) => (
          <label key={a.id} className={`flex items-center gap-3 p-3.5 border-2 border-ink rounded-[14px] cursor-pointer ${addressId === a.id ? 'bg-card shadow-hard-sm' : 'bg-card/60'}`}>
            <input type="radio" name="addr" className="w-5 h-5 accent-[#111]" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
            <Pin size={20} />
            <span className="flex-1 text-sm"><strong>{a.label}</strong> · {a.name}<br /><span className="text-body">{a.line1}, {a.city} {a.pin}</span></span>
          </label>
        ))}
        {adding ? <div className="card-flat p-4"><AddressForm onSaved={() => { setAdding(false); router.refresh(); }} /></div>
          : <button className="text-sm font-bold underline self-start" onClick={() => setAdding(true)}>+ Add a new address</button>}
        <p className="label-mono text-body">{mode === 'back' ? 'Prints Friday after voting locks · ships in a few days' : 'Ships with the next print batch'}</p>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="code-title">
        <h2 id="code-title" className="font-display text-xl tracking-wide">CODE</h2>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void applyCode(codeInput); }}>
          <label htmlFor="promo" className="sr-only">Discount code</label>
          <input id="promo" value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeMsg(null); }}
            className="input flex-1 font-mono uppercase" placeholder="LAUNCH10" maxLength={24} autoComplete="off" />
          {applied
            ? <button type="button" className="btn-white whitespace-nowrap" onClick={() => { setApplied(null); setCodeInput(''); }}>Remove</button>
            : <button type="submit" className="btn-white whitespace-nowrap" disabled={checking || !codeInput.trim()}>{checking ? 'Checking…' : 'Apply'}</button>}
        </form>
        {codeMsg && <p className="text-sm text-[#B00020]" role="alert">{codeMsg}</p>}
        {applied && <p className="text-sm font-bold" role="status">{applied.code} applied · you save {inr(applied.amount)}</p>}
        {!applied && rewards.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rewards.map((r) => (
              <button key={r.code} type="button" className="chip" onClick={() => { setCodeInput(r.code); void applyCode(r.code); }}>
                {r.label} · <span className="font-mono">{r.code}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="bg-card border-2 border-ink rounded-md p-4 font-mono text-sm flex flex-col gap-2">
        <Row k="PRICE" v={inr(fullPrice)} />
        {backing && backing.priceType === 'backer' && <Row k="EARLY-BACKER PRICE" v={`−${inr(fullPrice - subtotal)}`} bold />}
        {applied && <Row k={`CODE ${applied.code}`} v={`−${inr(applied.amount)}`} bold />}
        <Row k="SHIPPING" v={shipping ? inr(shipping) : 'FREE'} />
        <div className="border-t-2 border-dashed border-ink my-1" />
        <Row k="TOTAL (GST INCL.)" v={inr(total)} bold />
        <p className="bg-cobalt text-white border-2 border-ink rounded-lg px-3 py-2.5 font-bold text-xs mt-1">
          {settings.cause_pct}% OF OUR NET PROFIT FUNDS THIS DROP’S CAUSE · ₹ ON YOUR RECEIPT
        </p>
      </section>

      <div className="sticky bottom-[84px] md:bottom-0 bg-ink -mx-4 px-4 py-3 md:rounded-xl md:mx-0 flex items-center gap-4">
        <div><p className="font-mono text-[11px] text-mist">TOTAL</p><p className="font-display text-3xl text-acid leading-none">{inr(total)}</p></div>
        <button onClick={pay} disabled={busy || (!backing && bag.length === 0)} className="btn flex-1 bg-pink text-ink border-paper min-h-[56px] text-xl">
          {busy ? 'Opening…' : mode === 'back' ? `Reserve ${inr(total)}` : `Pay ${inr(total)}`}
        </button>
      </div>
      <p className="text-xs text-muted">Payments by Razorpay: UPI, cards and net banking. No cash on delivery — it is what lets us print only what is already paid for.</p>
    </div>
  );
}

function Row({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <div className={`flex justify-between ${bold ? 'font-bold' : ''}`}><span>{k}</span><span>{v}</span></div>;
}

function Item({ name, colours, art, colour, size, qty, onQty }: {
  name: string; colours: Colourway[]; art?: string; colour: string; size: string; qty: number; onQty?: (n: number) => void;
}) {
  const c = colours.find((x) => x.name === colour) ?? colours[0];
  return (
    <div className="flex gap-3 items-center">
      <span className="w-[76px] h-[76px] border-2 border-ink rounded-xl bg-ink halftone-dark grid place-items-center shrink-0">
        <Tee shirt={c?.hex ?? '#fff'} art={c?.art || art} size={72} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-display text-xl uppercase truncate">{name}</p>
        <p className="font-mono text-[11px] text-body">{colour.toUpperCase()} · {size} · 240 GSM</p>
      </div>
      {onQty ? (
        <div className="flex items-center border-2 border-ink rounded-xl bg-card">
          <button aria-label="Decrease quantity" className="w-10 h-11 font-display text-xl" onClick={() => onQty(Math.max(1, qty - 1))}>−</button>
          <span className="font-display text-lg w-5 text-center" aria-live="polite">{qty}</span>
          <button aria-label="Increase quantity" className="w-10 h-11 font-display text-xl" onClick={() => onQty(Math.min(5, qty + 1))}>+</button>
        </div>
      ) : <span className="font-display text-lg">×{qty}</span>}
    </div>
  );
}
