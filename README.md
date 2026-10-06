# INKPULSE

Weekly community-voted t-shirt drops. One codebase is both the **website** and the **installable mobile app** (PWA for Android and iPhone).

- **Monday**: drop opens. **Thursday 23:59 IST**: voting locks and the top 3 win. **Friday**: winners go to print.
- Early backers lock **₹899** (₹1,099 after 5,000 votes or after the drop). Backers are **debited only if the design prints**.
- **15% of net profit** from every drop goes to a cause the community votes on, published with receipts.
- **Curated entry**: every design is human-reviewed before it can reach the leaderboard.

Stack: Next.js 14 (App Router, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage, Realtime) · Razorpay · Resend (email) · Web Push · any WhatsApp BSP · Vercel.

---

## What is in the box

| Area | What works |
|---|---|
| Shoppers | Live board with realtime vote counts, print line, early-backer meter, category filters · design page with colourway/size pickers and tee mockups · backing checkout (Razorpay, manual capture) · bag + checkout for printed winners · order tracking · The Pulse feed (posts, likes, comments, reposts, reports) · cause vote + public impact ledger · artist profiles, follow · search · notifications centre · profile, addresses, phone verification · install-app + push opt-in |
| Artists | Become-an-artist flow · 5-step submit wizard (upload ≥4500×5400 PNG/SVG, live mockup preview, colours, originality terms) · studio with statuses, votes, backers, earnings, payout details (PAN/UPI/bank) · share kit |
| Admin | Dashboard (voters, backers, reserved ₹, conversion, alerts) · curated submissions queue with reverse-image-search link · drops (line-up, cause, next-cause shortlist, manual open/lock/print/ship) · orders + print summary + AWB entry + refunds · per-drop financials (net profit → cause amount) + payout recording with receipt upload · artist KYC + payouts · moderation · users (artist/admin/ban) · all business numbers in Settings |
| Automation | `/api/cron/tick` every 15 min: opens Monday drops, locks Thursday, ranks, captures winners / releases losers, sends Friday print batch, dispatches notifications. Idempotent — safe to re-run. |
| Notifications | In-app always; push (VAPID), email (Resend) and WhatsApp (generic BSP adapter) per user preference |
| Safety | Row Level Security on every table · browser can only write its own rows/columns · votes only via `cast_vote()` (phone-verified, rate-limited, one per design) · money and drop changes only server-side with the service role · signed Razorpay callbacks + webhooks, idempotent · admin actions audit-logged |

### What was verified here
- `npm run typecheck`, `npm run lint` and `npm run build` pass.
- `npm run db:test` applies all migrations + seed to a real Postgres 16 and runs `supabase/tests/smoke.sql`: voting, idempotency, withdraw, rate limit, phone-verification guard, RLS guards, price quotes, backer counts, Thursday lock + ranking + tie-break, cause vote roll-over, artist earnings, net-profit maths, Monday open, IST scheduling.
- Screens were rendered and checked at 390 px and 1440 px.

### What needs your accounts before it is live (not testable without your keys)
- Supabase project (auth SMS provider, Google OAuth), Razorpay keys + webhook, Resend domain, VAPID keys, WhatsApp BSP, print partner.
- **Razorpay manual capture for UPI**: confirm with Razorpay that manual capture (or UPI one-time mandate / "block") is enabled on your account and the maximum authorisation window covers Monday → Thursday. Only `lib/payments/razorpay.ts` changes if they give you a different API. If an authorisation expires before Thursday, the app already handles it: the winner gets a "complete payment to claim" link.
- **Print partner API**: Qikink/Printrove API formats were not available here. `PRINT_PARTNER_MODE=csv` works today (CSV to Storage + email to ops). For API ordering, set `PRINT_PARTNER_MODE=webhook` and map the JSON in `lib/print/index.ts` to their order API.
- Legal pages under `/legal/*` are drafts. Size guide values are placeholders.

---

## Set up (about 30 minutes)

### 1. Install
```bash
npm install
cp .env.example .env.local
```

### 2. Supabase
1. Create a project at supabase.com (region: Mumbai `ap-south-1`).
2. Put the project URL, `anon` key and `service_role` key in `.env.local`.
3. Apply the schema — either paste each file in `supabase/migrations/` (in order) into the SQL editor, or with the CLI:
   ```bash
   npx supabase link --project-ref YOUR_REF
   npx supabase db push
   ```
4. **Demo data (optional, staging only)**: run `supabase/seed.sql` in the SQL editor.
5. **Auth → Providers**
   - **Phone**: enable, pick an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Indian SMS needs DLT-registered templates with your provider.
   - **Google**: enable, add OAuth client ID/secret.
   - **Email**: magic link on.
   - **URL configuration**: Site URL = your domain; add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to redirect URLs.
6. **Make yourself admin** (after signing in once):
   ```sql
   update public.profiles set is_admin = true where handle = 'your_handle';
   ```

### 3. Razorpay
1. Dashboard → API keys → copy test keys into `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. Settings → Webhooks → add `https://YOUR-DOMAIN/api/webhooks/razorpay`, events `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`; put the secret in `RAZORPAY_WEBHOOK_SECRET`.
3. Ask Razorpay to enable **manual capture** (see above) and set `RAZORPAY_MANUAL_EXPIRY_MINUTES`.

### 4. Notifications
- Push: `npm run vapid` → put keys in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`.
- Email: create a Resend API key, verify your domain, set `EMAIL_FROM`.
- WhatsApp: set `WHATSAPP_API_URL` / `WHATSAPP_API_KEY` and adapt the payload in `lib/notify/dispatch.ts` to your BSP's approved templates (template names = notification `kind`).

### 5. Run
```bash
npm run dev        # http://localhost:3000
```

### 6. Deploy (Vercel)
1. Import the repo in Vercel, add every variable from `.env.local` (set `NEXT_PUBLIC_SITE_URL` to your domain) and a long random `CRON_SECRET`.
2. `vercel.json` schedules `/api/cron/tick` every 15 minutes and `/api/cron/notify` every 10. **Sub-daily crons need Vercel Pro.** On Hobby, use Supabase instead:
   ```sql
   -- Supabase → Database → Extensions: enable pg_cron and pg_net, then:
   select cron.schedule('inkpulse-tick', '*/15 * * * *', $$
     select net.http_get(url := 'https://YOUR-DOMAIN/api/cron/tick',
                         headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'));
   $$);
   ```

---

## How the weekly cycle runs

```
Mon 00:00 IST  open_due_drops()    approved designs in the drop go live, counters reset, next drop scheduled
Mon–Thu        cast_vote()         phone-verified, 1 per design, rate-limited; realtime counts on the board
               checkout            backing = Razorpay order with manual capture → order "backed"
Thu 23:59 IST  lock_due_drops()    rank by votes (tie → reached count first), top N won, cause vote → next drop
               settleBackings()    capture winners → "won"; leave losers uncaptured → "released"
Fri 10:00 IST  printDueDrops()     all captured/paid, unbatched orders → print batch (CSV or partner API) → "printing"
Admin          AWB → "shipped" → "delivered"; financials → cause payout + receipt → ledger
```
Everything above can also be triggered from **Admin → Drops** (useful for launch week).

## Money
- Prices, threshold, winners, shares, costs and GST live in **Admin → Settings**.
- **Before launch**, set `unit_cost` (blank + DTG + packaging), `shipping_cost`, `artist_pct` and confirm `gst_pct`/HSN with your CA. While these are 0 the admin shows warnings and net profit is overstated.
- Net profit per drop = captured revenue − GST − product cost − shipping cost − gateway fees − artist share. Cause amount = `cause_pct_of_profit` of that.

## Project map
```
app/                 pages (shopper, studio, admin) + API routes + server actions
components/          UI (Tee mockup, Board, BuyBox, PostCard, …)
lib/                 data access, auth, orders, Razorpay, jobs, print, notifications
supabase/migrations  schema, business logic (SQL), RLS, public aggregates
supabase/seed.sql    demo data (staging only)
supabase/tests       smoke tests  (npm run db:test)
public/              PWA manifest, service worker, icons, demo artwork
```

## Growth & after-sales
- **Share cards** — every design has a link-preview image at `/d/<slug>/card` and a 1080×1920 story card (`?size=story&kind=voted|backed|artist`). Voting, backing and the artist studio all offer a "Story card" download.
- **Tracked links** — add `?src=<tag>` to any link (the share buttons do this for WhatsApp, Instagram, X). Votes and orders remember the tag; artists see votes and backers by source in the studio.
- **Invites** — every member has `/?ref=<handle>`. The friend gets a one-time welcome code (`HI-…`); the inviter gets a code (`THX-…`) once the friend's first order is paid. Amounts in Admin → Settings (0 turns it off).
- **Promo codes** — Admin → Codes: % or ₹ off, backing/retail/all, minimum order, total and per-person limits, expiry. A code is only "used" while the order stands; released backings give it back. Test seed includes `LAUNCH10`.
- **Notify me / back by demand** — finished designs show a waitlist button. Admin → Dashboard → Most wanted → "Bring it back" reopens retail for N days and notifies everyone on the list.
- **Reviews** — after delivery, buyers rate each item (stars, fit, text, up to 3 photos). Shown on the design page with an average and a fit verdict; reportable, hideable in Moderation.
- **Exchanges & returns** — after delivery (within the window in Settings) buyers request a size exchange or return with photos; Admin → Returns approves/declines/completes and the member is notified. Refunds are still issued from Orders.

## Install as an app
- **Android/Chrome**: “Install the INKPULSE app” button on the Profile page, or the browser's install prompt.
- **iPhone**: Safari → Share → Add to Home Screen (push works on iOS 16.4+ once installed).
- Need store listings later? Wrap the PWA with a Trusted Web Activity (Play Store) or Capacitor — no rewrite needed.

## Launch checklist
- [ ] Supabase migrations applied, seed **not** applied in production
- [ ] Phone OTP working with a DLT-approved SMS template
- [ ] Razorpay live keys, webhook, manual capture confirmed for UPI + cards
- [ ] Costs, artist %, GST set in Admin → Settings
- [ ] Print partner: CSV flow tested end-to-end, or webhook adapter mapped
- [ ] Resend domain verified; VAPID keys set; WhatsApp templates approved
- [ ] Legal pages replaced with lawyer-reviewed versions; size guide filled in
- [ ] Cron running (Vercel Pro or Supabase pg_cron)
- [ ] 20–30 artists' designs reviewed and scheduled into the first drop
- [ ] One full test drop on staging: vote → back (test card/UPI) → force lock → capture → print CSV → ship
