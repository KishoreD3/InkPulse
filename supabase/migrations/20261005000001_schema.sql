-- INKPULSE · core schema
-- Money is stored in whole rupees (int). Convert to paise only at the gateway edge.

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ─── Enums ────────────────────────────────────────────────────────────
create type public.drop_status    as enum ('scheduled', 'live', 'locked', 'printing', 'shipped');
create type public.design_status  as enum ('draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'live', 'won', 'lost', 'withdrawn');
create type public.order_type     as enum ('backing', 'retail');
create type public.order_status   as enum ('pending', 'backed', 'won', 'released', 'paid', 'printing', 'shipped', 'delivered', 'cancelled', 'refunded', 'failed');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'released', 'refunded', 'failed');
create type public.post_kind      as enum ('member', 'artist', 'system');
create type public.report_status  as enum ('open', 'actioned', 'dismissed');
create type public.earning_status as enum ('pending', 'payable', 'paid', 'void');

-- ─── Settings (single row; every business number lives here) ──────────
create table public.settings (
  id                    boolean primary key default true check (id),
  backer_price          int not null default 899 check (backer_price > 0),
  retail_price          int not null default 1099 check (retail_price > 0),
  backer_threshold      int not null default 5000 check (backer_threshold > 0),
  winners_per_drop      int not null default 3 check (winners_per_drop > 0),
  cause_pct_of_profit   numeric(5,2) not null default 15 check (cause_pct_of_profit between 0 and 100),
  -- Placeholders: set from real quotes before launch (admin › settings warns while 0).
  artist_pct            numeric(5,2) not null default 0 check (artist_pct between 0 and 100),
  unit_cost             int not null default 0 check (unit_cost >= 0),      -- blank + DTG print + packaging, per tee
  shipping_cost         int not null default 0 check (shipping_cost >= 0),  -- what we pay the courier, per order
  gateway_fee_pct       numeric(5,2) not null default 2 check (gateway_fee_pct >= 0),
  gst_pct               numeric(5,2) not null default 5 check (gst_pct >= 0),  -- confirm rate + HSN with your CA
  shipping_fee          int not null default 0 check (shipping_fee >= 0),   -- what the customer pays
  free_shipping_over    int not null default 0 check (free_shipping_over >= 0),
  retail_window_days    int not null default 14 check (retail_window_days >= 0),
  max_designs_per_artist int not null default 2 check (max_designs_per_artist > 0),
  designs_per_drop      int not null default 12 check (designs_per_drop > 0),
  votes_per_hour        int not null default 60 check (votes_per_hour > 0),
  milestone_heads_up    int not null default 250 check (milestone_heads_up >= 0),
  lock_time             time not null default '23:59',   -- Thursday, IST
  print_time            time not null default '10:00',   -- Friday, IST
  sizes                 text[] not null default '{S,M,L,XL,XXL}',
  categories            text[] not null default '{"Trader culture","Tamil heritage","Streetwear","Minimal","Typography","Anime-inspired originals"}',
  support_email         text not null default 'support@example.com',
  require_phone_for_votes boolean not null default true,  -- turn off only in test mode (no SMS provider yet)
  admin_emails          text[] not null default '{}',     -- users signing in with these emails become admins
  updated_at            timestamptz not null default now()
);
insert into public.settings default values;

-- ─── People ───────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      citext not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  name        text check (char_length(name) <= 60),
  bio         text check (char_length(bio) <= 280),
  avatar_url  text,
  location    text check (char_length(location) <= 60),
  links       jsonb not null default '[]'::jsonb,
  is_artist   boolean not null default false,
  is_admin    boolean not null default false,
  banned      boolean not null default false,
  notify      jsonb not null default '{"push": true, "email": true, "whatsapp": true}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Private details (contact, KYC, payout). Owner + service role only.
create table public.profile_private (
  id            uuid primary key references public.profiles (id) on delete cascade,
  phone         text,
  email         text,
  pan           text check (pan is null or pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  payout_upi    text,
  bank_account  text,
  bank_ifsc     text check (bank_ifsc is null or bank_ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'),
  kyc_status    text not null default 'not_started' check (kyc_status in ('not_started', 'submitted', 'verified', 'rejected')),
  updated_at    timestamptz not null default now()
);

create table public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  label       text not null default 'Home' check (char_length(label) <= 30),
  name        text not null check (char_length(name) between 2 and 80),
  phone       text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1       text not null check (char_length(line1) between 3 and 120),
  line2       text check (char_length(line2) <= 120),
  city        text not null check (char_length(city) between 2 and 60),
  state       text not null check (char_length(state) between 2 and 60),
  pin         text not null check (pin ~ '^[1-9][0-9]{5}$'),
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ─── Causes ───────────────────────────────────────────────────────────
create table public.partners (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  registration_no  text,
  website          text,
  docs_urls        text[] not null default '{}',
  verified         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.causes (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) <= 80),
  description  text,
  partner_id   uuid references public.partners (id) on delete set null,
  image_url    text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ─── Weekly drops ─────────────────────────────────────────────────────
create table public.drops (
  id          uuid primary key default gen_random_uuid(),
  number      int not null unique check (number > 0),
  status      public.drop_status not null default 'scheduled',
  opens_at    timestamptz not null,
  locks_at    timestamptz not null,
  prints_at   timestamptz not null,
  cause_id    uuid references public.causes (id) on delete set null,
  opened_at   timestamptz,
  locked_at   timestamptz,
  printed_at  timestamptz,
  shipped_at  timestamptz,
  created_at  timestamptz not null default now(),
  check (opens_at < locks_at and locks_at < prints_at)
);
create unique index drops_single_live on public.drops ((true)) where status = 'live';

-- Causes shortlisted for the community vote that runs during a drop.
-- The winner becomes the cause of the following drop.
create table public.cause_shortlist (
  drop_id   uuid not null references public.drops (id) on delete cascade,
  cause_id  uuid not null references public.causes (id) on delete cascade,
  primary key (drop_id, cause_id)
);

create table public.cause_votes (
  drop_id     uuid not null references public.drops (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  cause_id    uuid not null references public.causes (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (drop_id, user_id)
);

-- ─── Designs ──────────────────────────────────────────────────────────
create table public.designs (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  artist_id              uuid not null references public.profiles (id) on delete restrict,
  drop_id                uuid references public.drops (id) on delete set null,
  name                   text not null check (char_length(name) between 2 and 60),
  story                  text check (char_length(story) <= 500),
  category               text not null,
  tags                   text[] not null default '{}',
  -- [{ "name": "Acid", "hex": "#E4FF3B", "art": "<optional per-colour artwork url>" }]
  colours                jsonb not null default '[]'::jsonb check (jsonb_typeof(colours) = 'array'),
  art_front_url          text not null,
  art_back_url           text,
  perk                   text check (char_length(perk) <= 140),
  originality_confirmed  boolean not null default false,
  status                 public.design_status not null default 'draft',
  review_note            text,
  reviewed_by            uuid references public.profiles (id),
  reviewed_at            timestamptz,
  vote_count             int not null default 0 check (vote_count >= 0),
  count_reached_at       timestamptz not null default now(),
  backer_count           int not null default 0 check (backer_count >= 0),
  final_rank             int,
  retail_until           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index designs_drop_idx on public.designs (drop_id, status);
create index designs_artist_idx on public.designs (artist_id);
create index designs_status_idx on public.designs (status);

-- Append-only. A withdrawn vote keeps its row (withdrawn_at set) for audit.
create table public.votes (
  id            bigint generated always as identity primary key,
  design_id     uuid not null references public.designs (id) on delete cascade,
  drop_id       uuid not null references public.drops (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  withdrawn_at  timestamptz
);
create unique index votes_one_active on public.votes (design_id, user_id) where withdrawn_at is null;
create index votes_user_time_idx on public.votes (user_id, created_at desc);
create index votes_design_idx on public.votes (design_id) where withdrawn_at is null;

-- ─── Commerce ─────────────────────────────────────────────────────────
create table public.print_batches (
  id           uuid primary key default gen_random_uuid(),
  drop_id      uuid references public.drops (id) on delete set null,
  mode         text not null,
  status       text not null default 'created' check (status in ('created', 'sent', 'failed', 'acknowledged')),
  file_path    text,
  partner_ref  text,
  error        text,
  created_at   timestamptz not null default now()
);

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  number              bigint generated always as identity unique,
  user_id             uuid not null references public.profiles (id) on delete restrict,
  type                public.order_type not null,
  status              public.order_status not null default 'pending',
  drop_id             uuid references public.drops (id) on delete set null,
  ship_to             jsonb not null,
  subtotal            int not null check (subtotal >= 0),
  discount            int not null default 0 check (discount >= 0),
  shipping            int not null default 0 check (shipping >= 0),
  total               int not null check (total >= 0),
  gst_included        int not null default 0,
  payment_status      public.payment_status not null default 'created',
  gateway             text not null default 'razorpay',
  gateway_order_id    text unique,
  gateway_payment_id  text unique,
  payment_method      text,
  authorized_at       timestamptz,
  captured_at         timestamptz,
  released_at         timestamptz,
  failure_reason      text,
  print_batch_id      uuid references public.print_batches (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_drop_idx on public.orders (drop_id, status);
create index orders_payment_idx on public.orders (payment_status);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  design_id   uuid not null references public.designs (id) on delete restrict,
  colour      text not null,
  size        text not null,
  qty         int not null check (qty between 1 and 5),
  unit_price  int not null check (unit_price > 0),
  price_type  text not null check (price_type in ('backer', 'full', 'retail'))
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_design_idx on public.order_items (design_id);

create table public.shipments (
  order_id      uuid primary key references public.orders (id) on delete cascade,
  carrier       text,
  awb           text,
  tracking_url  text,
  shipped_at    timestamptz,
  delivered_at  timestamptz,
  updated_at    timestamptz not null default now()
);

create table public.cause_payouts (
  id            uuid primary key default gen_random_uuid(),
  drop_id       uuid not null unique references public.drops (id) on delete restrict,
  cause_id      uuid not null references public.causes (id) on delete restrict,
  net_profit    int not null,
  amount        int not null check (amount >= 0),
  utr           text,
  receipt_url   text,
  paid_at       timestamptz,
  published     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.artist_payouts (
  id          uuid primary key default gen_random_uuid(),
  artist_id   uuid not null references public.profiles (id) on delete restrict,
  amount      int not null check (amount > 0),
  utr         text,
  paid_at     timestamptz not null default now(),
  created_by  uuid references public.profiles (id)
);

create table public.artist_earnings (
  id             uuid primary key default gen_random_uuid(),
  artist_id      uuid not null references public.profiles (id) on delete restrict,
  design_id      uuid not null references public.designs (id) on delete restrict,
  order_item_id  uuid not null unique references public.order_items (id) on delete cascade,
  amount         int not null check (amount >= 0),
  status         public.earning_status not null default 'pending',
  payout_id      uuid references public.artist_payouts (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index artist_earnings_artist_idx on public.artist_earnings (artist_id, status);

-- ─── Social ───────────────────────────────────────────────────────────
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid references public.profiles (id) on delete cascade,   -- null for system posts
  kind           public.post_kind not null default 'member',
  body           text not null check (char_length(body) between 1 and 280),
  image_urls     text[] not null default '{}' check (cardinality(image_urls) <= 4),
  design_id      uuid references public.designs (id) on delete set null,
  like_count     int not null default 0,
  comment_count  int not null default 0,
  repost_count   int not null default 0,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now(),
  check ((kind = 'system') = (author_id is null))
);
create index posts_feed_idx on public.posts (created_at desc) where not hidden;
create index posts_author_idx on public.posts (author_id, created_at desc);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts (id) on delete cascade,
  design_id   uuid references public.designs (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 500),
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  check ((post_id is null) <> (design_id is null))
);
create index comments_post_idx on public.comments (post_id, created_at);
create index comments_design_idx on public.comments (design_id, created_at);

create table public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.reposts (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  artist_id    uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, artist_id),
  check (follower_id <> artist_id)
);

-- ─── Notifications ────────────────────────────────────────────────────
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  kind              text not null,
  title             text not null,
  body              text,
  link              text,
  channels          text[] not null default '{push}',  -- extra channels: push, email, whatsapp
  read_at           timestamptz,
  dispatched_at     timestamptz,
  dispatch_error    text,
  created_at        timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (created_at) where dispatched_at is null;

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- ─── Trust & safety / ops ─────────────────────────────────────────────
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('post', 'comment', 'design', 'profile')),
  target_id    uuid not null,
  reason       text not null check (char_length(reason) between 3 and 300),
  status       public.report_status not null default 'open',
  created_at   timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create table public.webhook_events (
  id           text primary key,          -- gateway event id (idempotency)
  source       text not null,
  type         text not null,
  payload      jsonb not null,
  received_at  timestamptz not null default now()
);
