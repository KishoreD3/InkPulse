# The DND Club

Original Indian art on tees, picked by the community every week. (Formerly InkPulse.) One codebase is both the **website** and the **installable mobile app** (PWA for Android and iPhone).

- **Monday 10 AM IST**: the weekly battle opens. **Thursday 9 PM IST**: voting locks and the top 3 finalists win. **Friday**: winners go to print.
- **Back it** at **₹899** (₹1,099 retail later). Backers are charged **only if the design finishes top 3**; otherwise the hold is released.
- **Artist-first:** every tee pays the artist who drew it **15%**, forever.
- **Curated entry**: every design is human-reviewed before it reaches the battle.

Stack: Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage, Realtime) · Razorpay · Resend (email) · Web Push · any WhatsApp BSP · Vercel.

---

## Storefront (new design)

The shopper and artist screens are built from the Figma Make design **“The DND Club — Store v3”**. They run fully in the browser today, on the design's catalogue, with all state saved in `localStorage` (key `dnd-club-v1`):

| Screen | Route | What works |
|---|---|---|
| Home | `/` | Hero that rotates through the live leaders, battle strip with live countdown, winners, artists, moods |
| Shop | `/shop` | Winners and live finalists, URL-driven filters (mood, fit, colour, size, price, collection), sort, load more, mobile filter sheet |
| Battle | `/battle` | Live standings re-ranked as votes come in, top-3 print zone, vote and back |
| Design | `/design/[id]` | Gallery, colour and size (per fit), size guide, PIN code delivery check, back or vote, add to bag, buy now |
| Bag / Checkout | `/bag`, `/checkout` | Edit size, colour and qty, coupons (`SNOOZE10`, `NIGHTOWL15`), club reward, contact/address validation, UPI verify or card (Luhn) in **test mode** |
| Orders | `/orders/[id]`, `/result/[id]` | Tracking timeline, backing result after Thursday's lock, share via Web Share/WhatsApp/link |
| Account | `/account?tab=…` | Overview, backings, orders, votes, wishlist, rewards, addresses, payments; reset demo |
| Artists | `/artists`, `/artists/[slug]` | Filters, search, follow, profile with winners and live designs |
| Topics | `/topics` | Upcoming topics with reminders |
| Studio | `/studio` | 5-step submission wizard: real file checks (print size, transparency, print area, size), live tee preview, autosaved draft, 2 entries per topic |
| Artist dashboard | `/dashboard` | Earnings, monthly sales chart, submissions, payouts UPI, public bio |
| Legal | `/legal/[slug]` | Terms, privacy, artist terms, shipping & returns, size guide, contact |

Night mode (the **DND** switch), search (`/` to open, Esc to close) and toasts work on every page. Store code lives in `lib/dnd/` (catalogue, weekly cycle maths, store) and `components/dnd/`.

**Next step:** connect the storefront to the Supabase backend below (catalogue from `drops`/`submissions`, votes via `cast_vote()`, Razorpay checkout). Admin, API routes, cron, payments and the database schema are unchanged and still run against Supabase.

## Backend (unchanged)

| Area | What works |
|---|---|
| Admin | Dashboard (voters, backers, reserved ₹, conversion, alerts) · curated submissions queue with reverse-image-search link · drops (line-up, manual open/lock/print/ship) · orders + print summary + AWB entry + refunds · per-drop financials (revenue, costs, paid to artists, net profit) · artist KYC + payouts · moderation · users (artist/admin/ban) · all business numbers in Settings |
| Automation | `/api/cron/tick` every 15 min: opens Monday drops, locks Thursday, ranks, captures winners / releases losers, sends Friday print batch, dispatches notifications. Idempotent — safe to re-run. |
| Notifications | In-app always; push (VAPID), email (Resend) and WhatsApp (generic BSP adapter) per user preference |
| Safety | Row Level Security on every table · browser can only write its own rows/columns · votes only via `cast_vote()` (phone-verified, rate-limited, one per design) · money and drop changes only server-side with the service role · signed Razorpay callbacks + webhooks, idempotent · admin actions audit-logged |

### What was verified here
- `npm run typecheck`, `npm run lint` and `npm run build` pass.
- The storefront was driven end to end in Chromium: add to bag, back a finalist, vote, coupons, checkout to an order page, order persistence, account tabs, shop filters, search, night mode and studio upload, with no console errors and no horizontal scroll at 390 px.
- `npm run db:test` applies all migrations + seed to a real Postgres 16 and runs `supabase/tests/smoke.sql`: voting, idempotency, withdraw, rate limit, phone-verification guard, RLS guards, price quotes, backer counts, Thursday lock + ranking + tie-break, artist earnings, net-profit maths, Monday open, IST scheduling.
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
Thu 23:59 IST  lock_due_drops()    rank by votes (tie → reached count first), top N won
               settleBackings()    capture winners → "won"; leave losers uncaptured → "released"
Fri 10:00 IST  printDueDrops()     all captured/paid, unbatched orders → print batch (CSV or partner API) → "printing"
Admin          AWB → "shipped" → "delivered"; Money page shows each drop's numbers
```
Everything above can also be triggered from **Admin → Drops** (useful for launch week).

## Money
- Prices, threshold, winners, shares, costs and GST live in **Admin → Settings**.
- **Before launch**, set `unit_cost` (blank + DTG + packaging), `shipping_cost`, `artist_pct` and confirm `gst_pct`/HSN with your CA. While these are 0 the admin shows warnings and net profit is overstated.
- Net profit per drop = captured revenue − GST − product cost − shipping cost − gateway fees − artist share. Artist share = `artist_pct` of each captured tee's price before GST, accrued per item and paid out from Admin → Artist payouts.

## Project map
```
app/(store)          storefront pages (new design) + dnd.css
app/(ops)            admin + sign-in (Tailwind)
app/api, app/actions API routes + server actions
components/dnd       storefront UI: shell, cards, views
components/          admin UI, Tee mockup, toaster
lib/dnd              catalogue, weekly cycle maths, browser store
lib/                 data access, auth, orders, Razorpay, jobs, print, notifications
supabase/migrations  schema, business logic (SQL), RLS, public aggregates
supabase/seed.sql    demo data (staging only)
supabase/tests       smoke tests  (npm run db:test)
public/              PWA manifest, service worker, icons, design images (public/dnd)
```

## The topic cycle
Every drop answers a topic. Defaults (Admin → Settings → Topic cycle):

```
Mon 10:00  (2 weeks before)  topic revealed, submissions open   → system post + artists notified
Tue (day 9) 23:59            last-day reminder to artists who haven't submitted
Wed 23:59                    submissions close
Thu → Sun                    review (Admin → Submissions, grouped by topic)
Mon 00:00                    voting opens (drop goes live)
Thu 23:59                    voting locks
Fri 10:00                    top designs print
```
A new topic goes up every Monday, so three drops always overlap: one voting, one in submissions/review, one just announced. The scheduler keeps two drops scheduled ahead; set each one's title, brief and idea sparks in Admin → Drops before its reveal (unset = "Open theme"). Topics stay hidden until their reveal time. Members can only send a design for review while its topic is open, up to `max_designs_per_artist` per topic; approved designs go into their topic's drop automatically.

## Growth & after-sales
- **Share cards** — every design has a link-preview image at `/d/<slug>/card` and a 1080×1920 story card (`?size=story&kind=voted|backed|artist`). Voting, backing and the artist studio all offer a "Story card" download.
- **Tracked links** — add `?src=<tag>` to any link (the share buttons do this for WhatsApp, Instagram, X). Votes and orders remember the tag; artists see votes and backers by source in the studio.
- **Invites** — every member has `/?ref=<handle>`. The friend gets a one-time welcome code (`HI-…`); the inviter gets a code (`THX-…`) once the friend's first order is paid. Amounts in Admin → Settings (0 turns it off).
- **Promo codes** — Admin → Codes: % or ₹ off, backing/retail/all, minimum order, total and per-person limits, expiry. A code is only "used" while the order stands; released backings give it back. Test seed includes `LAUNCH10`.
- **Notify me / back by demand** — finished designs show a waitlist button. Admin → Dashboard → Most wanted → "Bring it back" reopens retail for N days and notifies everyone on the list.
- **Reviews** — after delivery, buyers rate each item (stars, fit, text, up to 3 photos). Shown on the design page with an average and a fit verdict; reportable, hideable in Moderation.
- **Exchanges & returns** — after delivery (within the window in Settings) buyers request a size exchange or return with photos; Admin → Returns approves/declines/completes and the member is notified. Refunds are still issued from Orders.

## Install as an app
- **Android/Chrome**: the browser's install prompt (the manifest and service worker make the store installable).
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
