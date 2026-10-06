import { createAdminClient } from '@/lib/supabase/server';
import { createCode, setCodeActive } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import { describeCode } from '@/lib/discounts';
import { inr, num } from '@/lib/format';

export const metadata = { title: 'Codes & referrals' };

interface CodeRow {
  code: string; kind: 'percent' | 'flat'; value: number; applies_to: string; min_subtotal: number; max_uses: number | null;
  per_user_limit: number; owner_id: string | null; expires_at: string | null; active: boolean; note: string | null;
}

export default async function CodesAdmin() {
  const db = createAdminClient();
  const [{ data: codes }, { data: redemptions }, { count: referred }, { count: converted }] = await Promise.all([
    db.from('discount_codes').select('*').is('owner_id', null).order('created_at', { ascending: false }),
    db.from('discount_redemptions').select('code, amount'),
    db.from('profiles').select('id', { count: 'exact', head: true }).not('referred_by', 'is', null),
    db.from('profiles').select('id', { count: 'exact', head: true }).not('referral_rewarded_at', 'is', null),
  ]);
  const uses = new Map<string, { n: number; amount: number }>();
  let rewardSpend = 0;
  ((redemptions ?? []) as { code: string; amount: number }[]).forEach((r) => {
    const key = r.code.toUpperCase();
    const u = uses.get(key) ?? { n: 0, amount: 0 };
    uses.set(key, { n: u.n + 1, amount: u.amount + r.amount });
    if (/^(HI|THX)-/.test(key)) rewardSpend += r.amount;
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Codes &amp; referrals</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4"><p className="font-display text-3xl">{num(referred ?? 0)}</p><p className="label-mono text-muted">Joined via invites</p></div>
        <div className="card p-4"><p className="font-display text-3xl">{num(converted ?? 0)}</p><p className="label-mono text-muted">…who paid for a tee</p></div>
        <div className="card p-4"><p className="font-display text-3xl">{inr(rewardSpend)}</p><p className="label-mono text-muted">Spent on invite rewards</p></div>
      </div>
      <p className="text-sm text-body">Invite rewards (HI-… for the friend, THX-… for the inviter) are created automatically. Change their value in Settings.</p>

      <section className="card p-5 flex flex-col gap-3">
        <h2 className="h-display text-2xl">New promo code</h2>
        <ActionForm action={createCode} className="grid gap-3 sm:grid-cols-3" success="Code created.">
          <Field label="Code" name="code" required placeholder="DIWALI15" maxLength={24} />
          <div>
            <label htmlFor="kind" className="field-label">Type</label>
            <select id="kind" name="kind" className="input"><option value="percent">% off</option><option value="flat">₹ off</option></select>
          </div>
          <Field label="Value" name="value" type="number" required placeholder="15" />
          <div>
            <label htmlFor="applies_to" className="field-label">Works on</label>
            <select id="applies_to" name="applies_to" className="input">
              <option value="all">Backing + retail</option><option value="backing">Backing only</option><option value="retail">Retail only</option>
            </select>
          </div>
          <Field label="Minimum order ₹" name="min_subtotal" type="number" defaultValue="0" />
          <Field label="Total uses (0 = unlimited)" name="max_uses" type="number" defaultValue="0" />
          <Field label="Uses per person" name="per_user_limit" type="number" defaultValue="1" />
          <Field label="Expires (optional)" name="expires_at" type="date" />
          <Field label="Note (for you)" name="note" placeholder="Instagram collab with @artist" maxLength={120} />
          <div className="sm:col-span-3"><SubmitButton>Create code</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card p-5 flex flex-col gap-1">
        <h2 className="h-display text-2xl pb-2">Promo codes</h2>
        {(codes ?? []).length === 0 && <p className="text-body">No promo codes yet.</p>}
        {((codes ?? []) as CodeRow[]).map((c) => {
          const u = uses.get(c.code.toUpperCase()) ?? { n: 0, amount: 0 };
          const expired = c.expires_at && new Date(c.expires_at) < new Date();
          return (
            <div key={c.code} className="flex flex-wrap items-center gap-3 border-b-2 border-dashed border-ink py-2.5">
              <span className="font-mono font-bold text-lg min-w-[120px]">{c.code}</span>
              <span className="sticker bg-acid">{describeCode(c)}</span>
              <span className="text-sm text-body flex-1 min-w-[200px]">
                {c.applies_to === 'all' ? 'Any order' : `${c.applies_to} only`}
                {c.min_subtotal ? ` · min ${inr(c.min_subtotal)}` : ''} · used {u.n}{c.max_uses ? `/${c.max_uses}` : ''} · {inr(u.amount)} off given
                {c.expires_at ? ` · ${expired ? 'expired' : 'until'} ${new Date(c.expires_at).toLocaleDateString('en-IN')}` : ''}
                {c.note ? ` · ${c.note}` : ''}
              </span>
              <ActionButton run={setCodeActive.bind(null, c.code, !c.active)} className={c.active ? 'chip-off' : 'chip-on'}>
                {c.active ? 'Disable' : 'Enable'}
              </ActionButton>
            </div>
          );
        })}
      </section>
    </div>
  );
}
