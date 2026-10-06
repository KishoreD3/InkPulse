import { createAdminClient } from '@/lib/supabase/server';
import { inr } from '@/lib/format';
import { recordArtistPayout, setKyc } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';
import { ActionForm, SubmitButton } from '@/components/forms';

export const metadata = { title: 'Artist payouts' };

export default async function PayoutsAdmin() {
  const db = createAdminClient();
  const { data: earnings } = await db.from('artist_earnings').select('artist_id, amount').in('status', ['pending', 'payable']);
  const due = new Map<string, number>();
  ((earnings ?? []) as { artist_id: string; amount: number }[]).forEach((e) => due.set(e.artist_id, (due.get(e.artist_id) ?? 0) + e.amount));
  const ids = Array.from(due.keys());
  const [{ data: profiles }, { data: priv }] = await Promise.all([
    ids.length ? db.from('profiles').select('id, handle').in('id', ids) : Promise.resolve({ data: [] }),
    ids.length ? db.from('profile_private').select('id, pan, payout_upi, bank_account, bank_ifsc, kyc_status').in('id', ids) : Promise.resolve({ data: [] }),
  ]);
  const p = new Map(((priv ?? []) as { id: string; pan: string | null; payout_upi: string | null; bank_account: string | null; bank_ifsc: string | null; kyc_status: string }[]).map((x) => [x.id, x]));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Artist payouts</h1>
      <p className="text-sm text-body">Pay after the return window. Earnings accrue when a winner&apos;s payment is captured; refunds void unpaid earnings automatically.</p>
      {ids.length === 0 && <p className="card-flat p-5">Nothing due.</p>}
      {((profiles ?? []) as { id: string; handle: string }[]).map((a) => {
        const k = p.get(a.id);
        return (
          <section key={a.id} className="card p-4 flex flex-col gap-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-display text-xl">@{a.handle} · {inr(due.get(a.id) ?? 0)} due</p>
              <span className={`sticker ${k?.kyc_status === 'verified' ? 'bg-acid' : 'bg-pink'}`}>KYC {k?.kyc_status ?? 'not started'}</span>
            </div>
            <p className="font-mono text-xs">PAN {k?.pan ?? '—'} · UPI {k?.payout_upi ?? '—'} · A/C {k?.bank_account ? `••••${k.bank_account.slice(-4)}` : '—'} {k?.bank_ifsc ?? ''}</p>
            <div className="flex flex-wrap gap-2 items-end">
              <ActionButton run={setKyc.bind(null, a.id, 'verified')}>Mark KYC verified</ActionButton>
              <ActionButton run={setKyc.bind(null, a.id, 'rejected')}>Reject KYC</ActionButton>
              {k?.kyc_status === 'verified' && (
                <ActionForm action={recordArtistPayout} className="flex gap-2" success="Payout recorded.">
                  <input type="hidden" name="artistId" value={a.id} />
                  <input name="utr" className="input !w-48" placeholder="UTR after transfer" required aria-label="UTR" />
                  <SubmitButton className="chip-on">Record payout</SubmitButton>
                </ActionForm>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
