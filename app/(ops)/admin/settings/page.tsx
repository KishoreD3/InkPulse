import { createAdminClient } from '@/lib/supabase/server';
import { saveSettings } from '@/app/actions/admin';
import { ActionForm, Field, SubmitButton } from '@/components/forms';
import type { Settings } from '@/lib/types';

export const metadata = { title: 'Settings' };

const GROUPS: { title: string; fields: [keyof Settings, string, string?][] }[] = [
  { title: 'Pricing', fields: [['backer_price', 'Early-backer price ₹'], ['retail_price', 'Retail price ₹'], ['backer_threshold', 'Early-backer vote cut-off'], ['shipping_fee', 'Shipping fee charged ₹'], ['free_shipping_over', 'Free shipping over ₹ (0 = off)']] },
  { title: 'Costs (from your print partner & courier quotes)', fields: [['unit_cost', 'Blank + DTG print + packaging per tee ₹', 'Placeholder until you have quotes'], ['shipping_cost', 'Courier cost per order ₹'], ['gateway_fee_pct', 'Payment gateway fee %'], ['gst_pct', 'GST % (confirm HSN/rate with your CA)']] },
  { title: 'Artists', fields: [['artist_pct', 'Artist share % of every tee sold (price before GST)']] },
  { title: 'Topic cycle (applies to drops created from now on)', fields: [['topic_lead_days', 'Topic published this many days before voting opens', 'Default 14: Monday topic → voting two Mondays later'], ['review_days', 'Review days between submissions closing and voting', 'Default 4: submissions close Wednesday 23:59'], ['topic_time', 'Topic reveal time on Monday (IST, HH:MM)']] },
  { title: 'Drops', fields: [['winners_per_drop', 'Winners per drop'], ['designs_per_drop', 'Designs per drop'], ['max_designs_per_artist', 'Max designs per artist per drop'], ['lock_time', 'Thursday lock time (IST, HH:MM)'], ['print_time', 'Friday print time (IST, HH:MM)'], ['retail_window_days', 'Days winners stay on sale']] },
  { title: 'Growth & after-sales', fields: [['welcome_reward', '₹ off for a friend who joins via an invite (0 = off)'], ['referral_reward', '₹ off for the inviter after the friend’s first paid order'], ['return_window_days', 'Days after delivery to ask for a return/exchange'], ['reopen_days', 'Days a “back by demand” design stays on sale']] },
  { title: 'Fair play & alerts', fields: [['votes_per_hour', 'Max votes per user per hour'], ['milestone_heads_up', 'Heads-up N votes before cut-off']] },
];

export default async function SettingsAdmin() {
  const { data } = await createAdminClient().from('settings').select('*').single();
  const s = data as Settings;
  return (
    <div className="flex flex-col gap-5">
      <h1 className="h-display text-[40px]">Settings</h1>
      <ActionForm action={saveSettings} className="flex flex-col gap-5" success="Settings saved.">
        {GROUPS.map((g) => (
          <section key={g.title} className="card p-5">
            <h2 className="h-display text-xl pb-3">{g.title}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {g.fields.map(([k, label, hint]) => (
                <Field key={k} name={k} label={label} defaultValue={String(s[k] ?? '').slice(0, k.endsWith('_time') ? 5 : undefined)} hint={hint && !s[k] ? hint : undefined} />
              ))}
            </div>
          </section>
        ))}
        <section className="card p-5 grid gap-3">
          <h2 className="h-display text-xl">Catalogue &amp; support</h2>
          <Field name="sizes" label="Sizes (comma separated)" defaultValue={s.sizes.join(', ')} />
          <Field name="categories" label="Categories (comma separated)" defaultValue={s.categories.join(', ')} />
          <Field name="support_email" label="Support email" defaultValue={s.support_email} type="email" />
          <div>
            <label htmlFor="require_phone_for_votes" className="field-label">Voting needs a verified phone</label>
            <select id="require_phone_for_votes" name="require_phone_for_votes" className="input" defaultValue={String(s.require_phone_for_votes)}>
              <option value="true">Yes — one person, one vote (production)</option>
              <option value="false">No — test mode, any signed-in account can vote</option>
            </select>
          </div>
        </section>
        <SubmitButton className="btn-pink self-start">Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
