# The DND Club

Original Indian art on tees, picked by the community every week. (Formerly InkPulse.) One codebase is both the **website** and the **installable mobile app** (PWA for Android and iPhone).

- **Monday 10 AM IST**: the weekly battle opens. **Thursday 9 PM IST**: voting locks and the top 3 finalists win. **Friday**: winners go to print.
- **Back it** at **₹899** (₹1,099 retail later). Backers are charged **only if the design finishes top 3**; otherwise the hold is released.
- **Artist-first:** every tee pays the artist who drew it **15%**, forever.
- **Curated entry**: every design is human-reviewed before it reaches the battle.

Stack: Next.js 14 (App Router, TypeScript) · Supabase (Postgres, Auth, Storage, Realtime) · Razorpay · Resend (email) · Web Push · any WhatsApp BSP · Vercel.

---

## Storefront

The shopper and artist screens are built from the Figma Make design **“The DND Club — Store v3”**. The store runs in one of two modes, picked automatically:

- **Live** (Supabase keys set): catalogue, votes, wishlist, follows, reminders, orders, points, uploads and the artist dashboard all come from the database. Only the bag, the studio draft and the night-mode switch stay in the browser.
- **Demo** (no Supabase keys): the design's sample catalogue on a weekly clock that always has a live battle, with everything saved in `localStorage`. Handy for design reviews and previews.

| Screen | Route | What works (live) |
|---|---|---|
| Home | `/` | Hero rotating through the current leader, newest winner and the open topic; battle strip; bestsellers; featured artist |
| Shop | `/shop` | Winners and live finalists from the database, URL filters (mood, fit, colour, size, price, collection), sort. “New” and “Bestsellers” fill themselves |
| Battle | `/battle` | Live standings with Realtime vote counts, print zone, vote (one per design via `cast_vote()`) and back. Between battles: next date and a reminder |
| Design | `/design/[id]` | Photos, colours and sizes per design, PIN code check (India Post + regional transit estimate), back or vote, add to bag, real buyer reviews with a fit verdict |
| Bag / Checkout | `/bag`, `/checkout` | Server-checked codes (`SNOOZE10`, `NIGHTOWL15`, Backer Passes, invite rewards), club points, saved address. **Test payments**: orders are created and moved on as if paid; no money moves |
| Orders | `/orders/[id]`, `/result/[id]` | One reference per checkout (each backing is its own order underneath), status from the database, backing result after Thursday, Backer Pass code. Once delivered: star rating + fit review, and a size exchange or return request with photos (7-day window) |
| Account | `/account?tab=…` | Backings, orders, votes, wishlist, points + invite link, address, notifications with channel choices (push, email, WhatsApp) and push opt-in, mobile verification, sign out |
| Sign in | `/signin` | Phone OTP (can vote straight away), Google, or email magic link. `/account`, `/checkout`, `/orders`, `/studio`, `/dashboard` need sign-in |
| Artists | `/artists`, `/artists/[slug]` | Artists with real wins, followers, votes and tees sold; follow |
| Topics | `/topics` | The four drops in flight (submissions, review, voting, printing), archive with winners, reminders |
| Studio | `/studio` | 5-step submission: file checks, the original file uploads to Storage, the design goes into the admin review queue for the open topic |
| Artist dashboard | `/dashboard` | Earnings by month and by design, submissions with status, payouts, payout UPI and bio |
| Admin | `/admin/…` | Everything below, plus **Store listings** for each design's photos, mockup, mood, fit, collections, care label and badge |

Store code lives in `lib/dnd/` (catalogue loading, store state, weekly cycle maths) and `components/dnd/`; its API routes are under `app/api/store/`.

### Payments are in test mode
`PAYMENTS_MODE` is unset, so checkout creates real orders marked `gateway = 'test'`: retail orders go straight to *paid*, backings to *backed*, and Thursday's settle step marks them won or released without calling a gateway. Test orders are left out of the print batch unless `PRINT_TEST_ORDERS=true`, so nothing is printed by accident. Switching to Razorpay later means setting `PAYMENTS_MODE=razorpay` and wiring the store checkout to the existing `/api/checkout` flow.

## Backend

| Area | What works |
|---|---|
| Admin | Dashboard (voters, backers, reserved ₹, conversion, alerts) · curated submissions queue with reverse-image-search link · drops (line-up, manual open/lock/print/ship) · store listings · orders + print summary + AWB entry + refunds · per-drop financials · artist KYC + payouts · moderation · users · all business numbers in Settings |
| Automation | `/api/cron/tick`: opens Monday 10 AM drops, locks Thursday 9 PM, ranks, settles backings (lost backings get a 48-hour Backer Pass code), sends Friday's print batch, dispatches notifications. Idempotent. On Vercel Hobby it runs daily, and the first visitor after a battle is due to open or lock moves it along |
| Notifications | In-app always; push (VAPID), email (Resend) and WhatsApp (generic BSP adapter) once their keys are set. Reminders fire when a battle opens |
| Safety | Row Level Security on every table · the browser only writes its own rows · votes only via `cast_vote()` (rate-limited, one per design, optional phone check) · prices and codes are checked on the server · admin actions audit-logged |

### What was verified here
- `npm run typecheck`, `npm run lint` and `npm run build` pass.
- `npm run db:test` runs every migration on Postgres 16 with four test suites, including `supabase/tests/store.sql`: catalogue functions, RLS on wishlist/reminders/points, votes, follower counts, reminder notifications, points earn and refund, Backer Pass on release, Monday 10 AM / Thursday 9 PM timing.
- **Live mode end to end** against a local Supabase-style stack (Postgres + Supabase Auth + PostgREST + a file store) with the demo catalogue: phone OTP sign-in, vote saved and shown after reload, review and size exchange on a delivered order, review shown on the design page, notification choices saved, wishlist, follow, reminder, server-checked coupon, checkout creating one retail and two backing orders under one reference, points earned, account, studio upload into the review queue, artist dashboard, admin listing edit showing in the shop, Thursday lock settling one backing as won and one as released with a Backer Pass, notifications, sign out.
- **Demo mode** driven in Chromium: bag, backing, vote, coupons, checkout, account, filters, search, night mode, studio upload, no horizontal scroll at 390 px.
- Not tested here (needs your accounts): real SMS delivery, Google sign-in, Supabase Storage limits, Realtime vote updates, email/push/WhatsApp delivery.

### What I need from you to go live
| What | Why | Where it goes |
|---|---|---|
| **Supabase project** (Mumbai region) | Database, sign-in, uploads | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel. Migrations apply on deploy |
| **SMS provider with DLT** (MSG91, Twilio, Textlocal…) | Phone OTP sign-in. Indian SMS needs a DLT-registered sender ID and OTP template | Supabase → Auth → Phone |
| **Google OAuth client** | “Continue with Google” | Supabase → Auth → Google |
| **Domain** | Store URL, email sender, sign-in redirects | Vercel domains, `NEXT_PUBLIC_SITE_URL`, Supabase redirect URLs |
| **Print partner** (Qikink, Printrove or a local printer) | Friday's print batch | `PRINT_PARTNER_MODE=csv` + `PRINT_OPS_EMAIL` works today; for an API, `webhook` + `PRINT_PARTNER_URL`/`_API_KEY`, mapped in `lib/print/index.ts` |
| **Courier** (Shiprocket, Delhivery…) | Live serviceability and tracking. Today: India Post PIN lookup + regional estimate; AWB and tracking link are entered in Admin → Orders | Swap `checkPincode` in `lib/shipping.ts` for the courier API |
| **Resend** domain + key, **VAPID** keys, **WhatsApp BSP** templates | Email, push and WhatsApp notifications | See *Notifications* below |
| **Business details**: registered name, address, GSTIN, support email, grievance officer | Shown on the legal and contact pages (Indian e-commerce rules) | `NEXT_PUBLIC_BUSINESS_*`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_GRIEVANCE_OFFICER` |
| **Legal review** of the drafted terms, privacy, artist terms and returns, and the real **size chart** | Required before taking orders | `app/(store)/legal/[slug]/page.tsx`, `SIZE_CHART` in `lib/dnd/catalog.ts` |
| **Business numbers**: prices, artist %, GST, shipping fee, points rate | Already editable | Admin → Settings |
| **Razorpay** (later) | Real payments | See *Razorpay* below, then `PAYMENTS_MODE=razorpay` |
| **First artists and designs** | Something to vote on in week one | Artists submit at `/studio`; you approve in Admin → Submissions and add photos in Admin → Store listings |

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
4. **Demo data (optional, staging only)**: set `SEED_DEMO=true` on a staging deploy (or run `supabase/seed_dnd.sql` in the SQL editor on an empty database). It loads the design's sample artists, winners and a live battle.
5. **Auth → Providers**
   - **Phone**: enable, pick an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Indian SMS needs DLT-registered templates with your provider.
   - **Google**: enable, add OAuth client ID/secret.
   - **Email**: magic link on.
   - **URL configuration**: Site URL = your domain; add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback`) to redirect URLs.
   - **Email templates** (Auth → Emails → Templates): in both **Magic link** and **Confirm signup**, make the link
     `<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Sign in</a>`
     so the link works in any browser or device, not only the one that asked for it.
   - **SMTP** (Auth → Emails → SMTP Settings): Supabase's built-in mailer sends only a couple of emails an hour. Use Resend (`smtp.resend.com`, port 465, user `resend`, your API key as the password), then raise the email limit under Auth → Rate Limits.
6. **Make yourself admin**: set `ADMIN_EMAILS=you@example.com` in Vercel (applied on the next deploy), or after signing in once:
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
2. `vercel.json` runs `/api/cron/tick` and `/api/cron/notify` once a day (the Hobby plan limit); the store also moves a due battle along on the first visit. For on-time reminders and print batches, run the tick every 15 minutes with Vercel Pro or Supabase pg_cron:
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
