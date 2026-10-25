-- The DND Club · storefront data for the new design.
-- Adds the product details the store shows (mood, fit, colours, collections, photos),
-- artist profile fields, wishlist, topic reminders, newsletter, club points, grouped
-- orders, a test payment mode, and read-only catalogue functions for the store.

-- ─── Weekly clock: voting opens Monday 10 AM IST, locks Thursday 9 PM IST ─
alter table public.settings
  add column open_time       time not null default '10:00',
  add column mrp             int  not null default 1349 check (mrp > 0),
  add column points_per_100  int  not null default 10 check (points_per_100 >= 0),   -- club points earned per ₹100 paid
  add column reward_points   int  not null default 100 check (reward_points > 0),    -- points needed for one reward
  add column reward_value    int  not null default 100 check (reward_value >= 0),    -- ₹ off for one reward
  add column welcome_points  int  not null default 0 check (welcome_points >= 0);
alter table public.settings alter column lock_time set default '21:00';
alter table public.settings alter column sizes set default '{XS,S,M,L,XL,2XL,3XL}';
update public.settings set lock_time = '21:00', sizes = '{XS,S,M,L,XL,2XL,3XL}';

create or replace function public.ensure_next_drop() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_s public.settings;
  v_last timestamptz;
  v_now timestamp := now() at time zone 'Asia/Kolkata';
  v_min timestamp;
  v_monday timestamp;
  v_number int;
begin
  select * into v_s from public.settings;
  while (select count(*) from public.drops where status = 'scheduled') < 2 loop
    select max(opens_at) into v_last from public.drops;
    v_min := date_trunc('week', v_now + make_interval(days => v_s.topic_lead_days - 1));
    if v_min < v_now + make_interval(days => v_s.topic_lead_days - 1) then v_min := v_min + interval '7 days'; end if;
    v_monday := greatest(coalesce(date_trunc('week', v_last at time zone 'Asia/Kolkata') + interval '7 days', v_min), v_min);
    select coalesce(max(number), 0) + 1 into v_number from public.drops;
    insert into public.drops (number, opens_at, locks_at, prints_at)
    values (v_number,
            (v_monday + v_s.open_time) at time zone 'Asia/Kolkata',
            (v_monday + interval '3 days' + v_s.lock_time) at time zone 'Asia/Kolkata',
            (v_monday + interval '4 days' + v_s.print_time) at time zone 'Asia/Kolkata');
  end loop;
  return (select id from public.drops where status = 'scheduled' order by opens_at limit 1);
end $$;
revoke execute on function public.ensure_next_drop() from public, anon, authenticated;
grant execute on function public.ensure_next_drop() to service_role;

-- ─── Artist profile ───────────────────────────────────────────────────
alter table public.profiles
  add column tagline    text check (char_length(tagline) <= 40),
  add column styles     text[] not null default '{}' check (cardinality(styles) <= 4),
  add column cover_url  text;
grant update (tagline, styles, cover_url) on public.profiles to authenticated;

-- ─── Product details ──────────────────────────────────────────────────
alter table public.designs
  add column mood         text check (char_length(mood) <= 40),
  add column fit          text not null default 'Oversized' check (fit in ('Oversized', 'Classic Crew', 'Boxy Crop', 'Relaxed Fit')),
  add column collections  text[] not null default '{}',
  add column photo_urls   text[] not null default '{}' check (cardinality(photo_urls) <= 6),  -- model, flat-lay, close-up, lifestyle
  add column mockup_url   text,                                                                -- card image while it is a finalist
  add column care_label   text check (char_length(care_label) <= 30),
  add column badge        text check (char_length(badge) <= 30);
grant insert (mood, fit), update (mood, fit) on public.designs to authenticated;

-- ─── Wishlist, topic reminders, newsletter ────────────────────────────
create table public.wishlist (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  design_id   uuid not null references public.designs (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, design_id)
);

create table public.topic_reminders (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  drop_id     uuid not null references public.drops (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, drop_id)
);

create table public.newsletter_signups (
  email       citext primary key check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  user_id     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Remind people who asked when voting opens on the topic they care about.
create or replace function public.drops_remind_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'scheduled' and new.status = 'live' then
    insert into public.notifications (user_id, kind, title, body, link, channels)
    select r.user_id, 'voting_open',
           'Voting is open: ' || coalesce((select title from public.drop_topics where drop_id = new.id), 'Drop ' || lpad(new.number::text, 3, '0')),
           'Pick your favourites before Thursday 9 PM.', '/battle', '{push,email}'
    from public.topic_reminders r where r.drop_id = new.id;
  end if;
  return null;
end $$;
create trigger drops_remind after update of status on public.drops
  for each row execute function public.drops_remind_open();

-- ─── Orders: one checkout can create several orders (each backing is its own) ─
alter table public.orders
  add column group_ref       text check (group_ref ~ '^DND-[0-9]{5,8}$'),
  add column gift_wrap       boolean not null default false,
  add column points_redeemed int not null default 0 check (points_redeemed >= 0),
  add column contact_email   text;
create index orders_group_idx on public.orders (group_ref);

-- ─── Club points ──────────────────────────────────────────────────────
create table public.points_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  delta       int not null check (delta <> 0),
  note        text not null check (char_length(note) <= 80),
  order_id    uuid references public.orders (id) on delete set null,
  kind        text not null check (kind in ('welcome', 'earned', 'redeemed', 'reversed', 'adjustment')),
  created_at  timestamptz not null default now()
);
create index points_user_idx on public.points_ledger (user_id, created_at desc);
create unique index points_once_per_order on public.points_ledger (order_id, kind) where order_id is not null;

create or replace function public.points_balance(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta), 0)::int from public.points_ledger where user_id = p_user;
$$;

create or replace function public.orders_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_s public.settings;
  v_ref text := coalesce(new.group_ref, '#' || new.number);
  v_pts int;
begin
  select * into v_s from public.settings;
  -- Earn on money actually taken.
  if new.payment_status = 'captured' and (tg_op = 'INSERT' or old.payment_status <> 'captured') then
    v_pts := floor(new.total * v_s.points_per_100 / 100.0)::int;
    if v_pts > 0 then
      insert into public.points_ledger (user_id, delta, note, order_id, kind)
      values (new.user_id, v_pts, 'Earned on ' || v_ref, new.id, 'earned') on conflict do nothing;
    end if;
  end if;
  -- Give redeemed points back, and take earned ones away, when an order doesn't stand.
  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status in ('failed', 'cancelled', 'refunded', 'released') then
    if new.points_redeemed > 0 then
      insert into public.points_ledger (user_id, delta, note, order_id, kind)
      values (new.user_id, new.points_redeemed, 'Returned from ' || v_ref, new.id, 'reversed') on conflict do nothing;
    end if;
    if new.status = 'refunded' then
      insert into public.points_ledger (user_id, delta, note, order_id, kind)
      select new.user_id, -l.delta, 'Refunded ' || v_ref, new.id, 'adjustment'
      from public.points_ledger l where l.order_id = new.id and l.kind = 'earned'
      on conflict do nothing;
    end if;
  end if;
  return null;
end $$;
create trigger orders_points after insert or update on public.orders
  for each row execute function public.orders_points();

create or replace function public.profiles_welcome_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_pts int := (select welcome_points from public.settings);
begin
  if v_pts > 0 then
    insert into public.points_ledger (user_id, delta, note, kind) values (new.id, v_pts, 'Welcome to the club', 'welcome');
  end if;
  return null;
end $$;
create trigger profiles_welcome after insert on public.profiles
  for each row execute function public.profiles_welcome_points();

-- ─── Test payments (no gateway yet) ───────────────────────────────────
-- Orders placed while the store runs without Razorpay carry gateway = 'test'. They move
-- through the same statuses so the whole flow can be tried, and are never sent to print
-- unless PRINT_TEST_ORDERS=true.
alter table public.orders add constraint orders_gateway_check check (gateway in ('razorpay', 'test'));

-- ─── Public catalogue for the store ───────────────────────────────────
create or replace function public.store_designs()
returns table (
  id uuid, slug text, name text, story text, status public.design_status,
  artist_id uuid, artist_handle text, artist_name text, artist_city text,
  drop_id uuid, drop_number int, topic text, mood text, fit text, colours jsonb, collections text[],
  photo_urls text[], mockup_url text, art_front_url text, care_label text, badge text,
  vote_count int, backer_count int, count_reached_at timestamptz, final_rank int, retail_until timestamptz,
  sold int, rating numeric, reviews int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select g.id, g.slug, g.name, g.story, g.status,
         p.id, p.handle::text, coalesce(p.name, p.handle::text), p.location,
         d.id, d.number, t.title, g.mood, g.fit, g.colours, g.collections,
         g.photo_urls, g.mockup_url, g.art_front_url, g.care_label, g.badge,
         g.vote_count, g.backer_count, g.count_reached_at, g.final_rank, g.retail_until,
         coalesce((select sum(i.qty) from public.order_items i join public.orders o on o.id = i.order_id
                   where i.design_id = g.id and o.payment_status = 'captured'), 0)::int,
         (select round(avg(r.rating), 1) from public.reviews r where r.design_id = g.id and not r.hidden),
         (select count(*) from public.reviews r where r.design_id = g.id and not r.hidden)::int,
         g.created_at
  from public.designs g
  join public.profiles p on p.id = g.artist_id and not p.banned
  left join public.drops d on d.id = g.drop_id
  left join public.drop_topics t on t.drop_id = g.drop_id
  where g.status in ('live', 'won', 'lost');
$$;

create or replace function public.store_artists()
returns table (
  id uuid, handle text, name text, city text, tagline text, styles text[], bio text, avatar_url text, cover_url text,
  wins int, finalists int, votes int, sold int, followers int)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle::text, coalesce(p.name, p.handle::text), p.location, p.tagline, p.styles, p.bio, p.avatar_url, p.cover_url,
         count(distinct g.id) filter (where g.status = 'won')::int,
         count(distinct g.id) filter (where g.status in ('live', 'won', 'lost'))::int,
         coalesce((select sum(x.vote_count) from public.designs x where x.artist_id = p.id and x.status in ('live', 'won', 'lost')), 0)::int,
         coalesce((select sum(i.qty) from public.order_items i join public.orders o on o.id = i.order_id
                   join public.designs x on x.id = i.design_id where x.artist_id = p.id and o.payment_status = 'captured'), 0)::int,
         (select count(*) from public.follows f where f.artist_id = p.id)::int
  from public.profiles p
  left join public.designs g on g.artist_id = p.id
  where p.is_artist and not p.banned
  group by p.id
  having count(distinct g.id) filter (where g.status in ('live', 'won', 'lost')) > 0;
$$;

-- Finished drops with their topic and total votes, newest first.
create or replace function public.store_archive(p_limit int default 6)
returns table (drop_number int, title text, votes int)
language sql stable security definer set search_path = public as $$
  select d.number, coalesce(t.title, 'Open theme'),
         coalesce((select sum(vote_count) from public.designs g where g.drop_id = d.id), 0)::int
  from public.drops d left join public.drop_topics t on t.drop_id = d.id
  where d.status in ('locked', 'printing', 'shipped')
  order by d.number desc limit least(greatest(p_limit, 1), 24);
$$;

-- What the signed-in member has done before this week (account overview).
create or replace function public.my_vote_history()
returns table (votes int, battles int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, count(distinct drop_id)::int from public.votes where user_id = auth.uid() and withdrawn_at is null;
$$;

-- ─── Security ─────────────────────────────────────────────────────────
alter table public.wishlist            enable row level security;
alter table public.topic_reminders     enable row level security;
alter table public.newsletter_signups  enable row level security;
alter table public.points_ledger       enable row level security;
revoke insert, update, delete on public.wishlist, public.topic_reminders, public.newsletter_signups, public.points_ledger
  from anon, authenticated;

create policy wishlist_own on public.wishlist for select using (user_id = auth.uid());
create policy wishlist_add on public.wishlist for insert with check (user_id = auth.uid());
create policy wishlist_remove on public.wishlist for delete using (user_id = auth.uid());
grant insert (user_id, design_id), delete on public.wishlist to authenticated;

create policy reminders_own on public.topic_reminders for select using (user_id = auth.uid());
create policy reminders_add on public.topic_reminders for insert with check (
  user_id = auth.uid() and exists (select 1 from public.drops d where d.id = drop_id and d.status = 'scheduled'));
create policy reminders_remove on public.topic_reminders for delete using (user_id = auth.uid());
grant insert (user_id, drop_id), delete on public.topic_reminders to authenticated;

-- Newsletter sign-ups go through the server (service role); nobody reads the list from the browser.
create policy points_own on public.points_ledger for select using (user_id = auth.uid() or public.is_admin());

revoke execute on function public.points_balance(uuid) from public, anon, authenticated;
grant execute on function public.points_balance(uuid) to service_role;
grant execute on function public.store_designs() to anon, authenticated;
grant execute on function public.store_artists() to anon, authenticated;
grant execute on function public.store_archive(int) to anon, authenticated;
revoke execute on function public.my_vote_history() from public, anon;
grant execute on function public.my_vote_history() to authenticated;

-- Artwork: JPEG is accepted too (the studio checks print size before upload).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    update storage.buckets set allowed_mime_types = array['image/png', 'image/jpeg', 'image/svg+xml'], file_size_limit = 52428800
    where id = 'artwork';
  end if;
end $$;

-- ─── Backer Pass: a lost backing earns 48 hours at the backer price ───
-- When a backing hold is released, its owner gets a one-time code worth the gap between the
-- retail and backer prices, usable on any winner for 48 hours.
create or replace function public.orders_backer_pass() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s public.settings;
  v_code text;
begin
  if new.type <> 'backing' or new.status <> 'released' or old.status = 'released' then return null; end if;
  select * into s from public.settings where id = true;
  if s.retail_price <= s.backer_price then return null; end if;
  v_code := 'PASS-' || new.number;
  insert into public.discount_codes (code, kind, value, applies_to, max_uses, per_user_limit, owner_id, expires_at, note)
  values (v_code, 'flat', s.retail_price - s.backer_price, 'retail', 1, 1, new.user_id, now() + interval '48 hours', 'Backer Pass')
  on conflict (code) do nothing;
  -- Add the code to the release notice (sent by the orders_change trigger, which fires first: triggers run in name order), or send one.
  update public.notifications
     set body = body || ' Your Backer Pass: use code ' || v_code || ' within 48 hours to get any winner at ' || public.inr(s.backer_price) || '.'
   where user_id = new.user_id and kind = 'order_released' and link = '/orders/' || new.id and dispatched_at is null;
  if not found then
    perform public.notify_user(new.user_id, 'backer_pass', 'Your Backer Pass',
      'Use code ' || v_code || ' within 48 hours to get any winner at ' || public.inr(s.backer_price) || '.', '/shop?collection=new', '{push,email}');
  end if;
  return null;
end $$;
create trigger orders_pass after update of status on public.orders
  for each row execute function public.orders_backer_pass();

-- ─── Club promo codes shown in the store ──────────────────────────────
insert into public.discount_codes (code, kind, value, applies_to, per_user_limit, note) values
  ('SNOOZE10', 'percent', 10, 'retail', 1, '10% off your drop'),
  ('NIGHTOWL15', 'percent', 15, 'retail', 1, '15% off for night owls')
on conflict (code) do nothing;
