'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toaster';
import { inr } from '@/lib/format';

/** Shown when a winning backer's bank released the hold before Thursday: pay now to claim the shirt. */
export function PayToClaim({ orderId, total }: { orderId: string; total: number }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function pay() {
    setBusy(true);
    const res = await fetch(`/api/orders/${orderId}/pay`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setBusy(false); toast({ message: data.error ?? 'Could not start payment.', tone: 'error' }); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => {
      const rzp = new window.Razorpay!({
        key: data.keyId, order_id: data.gatewayOrderId, amount: data.amountPaise, currency: 'INR', name: 'INKPULSE',
        description: 'Claim your winning shirt', theme: { color: '#FF3EA5' }, modal: { ondismiss: () => setBusy(false) },
        handler: async (r: Record<string, string>) => {
          await fetch('/api/payments/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(r) });
          router.refresh();
        },
      });
      rzp.open();
    };
    document.body.appendChild(s);
  }
  return (
    <div className="bg-pink border-2 border-ink rounded-2xl shadow-hard p-5 flex flex-col gap-3">
      <p className="h-display text-2xl">It won! Complete payment</p>
      <p className="text-sm">Your bank released the reservation before the result came in. Pay {inr(total)} now to keep your early-backer price.</p>
      <button className="btn-ink" onClick={pay} disabled={busy}>{busy ? 'Opening…' : `Pay ${inr(total)}`}</button>
    </div>
  );
}
