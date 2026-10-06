-- INKPULSE · growth & ops for the MVP:
-- discount codes, referrals, campaign sources (artist links), "notify me" waitlist,
-- return/exchange requests and reviews with photos.

-- ─── Settings ─────────────────────────────────────────────────────────
alter table public.settings
  add column referral_reward    int not null default 100 check (referral_reward >= 0),  -- ₹ off for the inviter once the friend's first order is paid
  add column welcome_reward     int not null default 100 check (welcome_reward >= 0),   -- ₹ off for a friend who joins through an invite link
  add column return_window_days int not null default 7   check (return_window_days >= 0),
  add column reopen_days        int not null default 7   check (reopen_days > 0);      -- "back by demand" sale window

-- ─── Campaign sources (?src=instagram on any link) ────────────────────
alter table public.votes  add column source text check (source ~ '^[a-z0-9_-]{1,32}$');
alter table public.orders add column source text check (source ~ '^[a-z0-9_-]{1,32}$');

create or replace function public.clean_source(p text) returns text
language sql immutable as $$
  select case when lower(p) ~ '^[a-z0-9_-]{1,32}$' then lower(p) end;
$$;

-- ─── Referrals ────────────────────────────────────────────────────────
alter table public.profiles
  add column referred_by          uuid references public.profiles (id) on delete set null,
  add column referral_rewarded_at timestamptz;
create index profiles_referred_by_idx on public.profiles (referred_by);

-- ─── Discount codes ───────────────────────────────────────────────────
create table public.discount_codes (
  code            citext primary key check (code ~* '^[a-z0-9-]{3,24}$'),
  kind            text not null check (kind in ('percent', 'flat')),
  value           int not null check (value > 0 and (kind <> 'percent' or value <= 90)),
  applies_to      text not null default 'all' check (applies_to in ('all', 'backing', 'retail')),
  min_subtotal    int not null default 0 check (min_subtotal >= 0),
  max_uses        int check (max_uses is null or max_uses > 0),       -- null = unlimited
  per_user_limit  int not null default 1 check (per_user_limit > 0),
  owner_id        uuid references public.profiles (id) on delete cascade,  -- set = only this person can use it (rewards)
  expires_at      timestamptz,
  active          boolean not null default true,
  note            text check (char_length(note) <= 120),
  created_at      timestamptz not null default now()
);
create index discount_codes_owner_idx on public.discount_codes (owner_id) where owner_id is not null;

-- A redemption exists while the order is a live commitment (backed / paid onwards).
-- Released, failed, cancelled or refunded orders give the code back.
create table public.discount_redemptions (
  order_id    uuid primary key references public.orders (id) on delete cascade,
  code        citext not null references public.discount_codes (code) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      int not null check (amount >= 0),
  created_at  timestamptz not null default now()
);
create index discount_redemptions_code_idx on public.discount_redemptions (code, user_id);

alter table public.orders add column discount_code citext references public.discount_codes (code) on delete set null;

-- Server-side quote. Raises a readable error code when the code can't be used.
create or replace function public.quote_discount(p_code text, p_user uuid, p_type public.order_type, p_subtotal int)
returns int language plpgsql stable security definer set search_path = public as $$
declare
  c public.discount_codes;
  v_used int;
  v_mine int;
  v_amount int;
begin
  select * into c from public.discount_codes where code = p_code::citext;
  if not found or not c.active or (c.expires_at is not null and c.expires_at <= now())
     or (c.owner_id is not null and c.owner_id <> p_user) then
    raise exception 'code_invalid' using errcode = 'P0001';
  end if;
  if c.applies_to <> 'all' and c.applies_to <> p_type::text then raise exception 'code_wrong_type' using errcode = 'P0001'; end if;
  if p_subtotal < c.min_subtotal then raise exception 'code_min_subtotal:%', c.min_subtotal using errcode = 'P0001'; end if;
  select count(*) into v_used from public.discount_redemptions where code = c.code;
  if c.max_uses is not null and v_used >= c.max_uses then raise exception 'code_used_up' using errcode = 'P0001'; end if;
  select count(*) into v_mine from public.discount_redemptions where code = c.code and user_id = p_user;
  if v_mine >= c.per_user_limit then raise exception 'code_already_used' using errcode = 'P0001'; end if;
  v_amount := case when c.kind = 'percent' then floor(p_subtotal * c.value / 100.0)::int else c.value end;
  return least(v_amount, greatest(p_subtotal - 1, 0));   -- the gateway needs at least ₹1
end $$;

create or replace function public.reward_code(p_prefix text) returns text
language sql volatile as $$
  select p_prefix || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
$$;

-- Link a new account to the person who invited them (once, within 7 days of joining,
-- before any order). The new member gets a welcome code straight away.
create or replace function public.claim_referral(p_handle text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles;
  v_ref public.profiles;
  v_s public.settings;
  v_code text;
begin
  if v_uid is null then return false; end if;
  select * into v_me from public.profiles where id = v_uid;
  if v_me.referred_by is not null or v_me.created_at < now() - interval '7 days' then return false; end if;
  if exists (select 1 from public.orders where user_id = v_uid and payment_status in ('authorized', 'captured')) then return false; end if;
  select * into v_ref from public.profiles where handle = p_handle::citext and not banned;
  if not found or v_ref.id = v_uid then return false; end if;

  update public.profiles set referred_by = v_ref.id where id = v_uid;
  select * into v_s from public.settings;
  if v_s.welcome_reward > 0 then
    v_code := public.reward_code('HI');
    insert into public.discount_codes (code, kind, value, owner_id, max_uses, per_user_limit, expires_at, note)
    values (v_code, 'flat', v_s.welcome_reward, v_uid, 1, 1, now() + interval '60 days', 'Welcome · invited by @' || v_ref.handle);
    perform public.notify_user(v_uid, 'welcome_reward', public.inr(v_s.welcome_reward) || ' off your first tee',
      'Invited by @' || v_ref.handle || '. Use code ' || v_code || ' at checkout.', '/me#rewards');
  end if;
  return true;
end $$;

create or replace function public.my_referrals()
returns table (joined int, converted int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, count(referral_rewarded_at)::int from public.profiles where referred_by = auth.uid();
$$;

-- ─── Order side-effects for codes and referrals ───────────────────────
create or replace function public.orders_growth() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_ref uuid;
  v_s public.settings;
  v_code text;
begin
  if old.status is distinct from new.status and new.discount_code is not null then
    if new.status in ('backed', 'paid') then
      insert into public.discount_redemptions (order_id, code, user_id, amount)
      values (new.id, new.discount_code, new.user_id, new.discount) on conflict (order_id) do nothing;
    elsif new.status in ('released', 'failed', 'cancelled', 'refunded') then
      delete from public.discount_redemptions where order_id = new.id;
    end if;
  end if;

  -- The inviter is rewarded when the friend's first order is actually paid.
  if new.payment_status = 'captured' and old.payment_status <> 'captured' then
    update public.profiles set referral_rewarded_at = now()
    where id = new.user_id and referred_by is not null and referral_rewarded_at is null
    returning referred_by into v_ref;
    if v_ref is not null then
      select * into v_s from public.settings;
      if v_s.referral_reward > 0 then
        v_code := public.reward_code('THX');
        insert into public.discount_codes (code, kind, value, owner_id, max_uses, per_user_limit, expires_at, note)
        values (v_code, 'flat', v_s.referral_reward, v_ref, 1, 1, now() + interval '90 days',
                'Referral reward · @' || (select handle from public.profiles where id = new.user_id));
        perform public.notify_user(v_ref, 'referral_reward', 'Your invite paid off: ' || public.inr(v_s.referral_reward) || ' off',
          '@' || (select handle from public.profiles where id = new.user_id) || ' got their first tee. Use code ' || v_code || '.',
          '/me#rewards', '{push,email}');
      end if;
    end if;
  end if;
  return null;
end $$;

create trigger orders_growth after update on public.orders
  for each row execute function public.orders_growth();

-- ─── Voting with a campaign source ────────────────────────────────────
drop function public.cast_vote(uuid);
create or replace function public.cast_vote(p_design uuid, p_source text default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_design public.designs;
  v_drop public.drops;
  v_settings public.settings;
  v_recent int;
  v_count int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.phone_verified() then raise exception 'phone_not_verified' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where id = v_uid and banned) then raise exception 'banned' using errcode = '42501'; end if;

  select * into v_design from public.designs where id = p_design for update;
  if not found or v_design.status <> 'live' then raise exception 'design_not_live' using errcode = 'P0001'; end if;

  select * into v_drop from public.drops where id = v_design.drop_id;
  if v_drop.status <> 'live' or now() >= v_drop.locks_at then raise exception 'voting_locked' using errcode = 'P0001'; end if;

  select * into v_settings from public.settings;
  select count(*) into v_recent from public.votes where user_id = v_uid and created_at > now() - interval '1 hour';
  if v_recent >= v_settings.votes_per_hour then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  insert into public.votes (design_id, drop_id, user_id, source)
  values (p_design, v_design.drop_id, v_uid, public.clean_source(p_source))
  on conflict (design_id, user_id) where withdrawn_at is null do nothing;

  if not found then
    return v_design.vote_count;   -- already voted: idempotent
  end if;

  select vote_count into v_count from public.designs where id = p_design;

  if v_settings.milestone_heads_up > 0 and v_count = v_settings.backer_threshold - v_settings.milestone_heads_up then
    insert into public.notifications (user_id, kind, title, body, link)
    select distinct v.user_id, 'backer_window_closing',
           v_design.name || ' is ' || v_settings.milestone_heads_up || ' votes from closing early-backer price',
           'Back it now to lock ' || public.inr(v_settings.backer_price) || '.',
           '/d/' || v_design.slug
    from public.votes v
    where v.design_id = p_design and v.withdrawn_at is null
      and not exists (
        select 1 from public.orders o join public.order_items i on i.order_id = o.id
        where o.user_id = v.user_id and i.design_id = p_design and o.status in ('pending', 'backed'));
  end if;

  if v_count = v_settings.backer_threshold then
    insert into public.posts (kind, body, design_id)
    values ('system', upper(v_design.name) || ' HIT ' || to_char(v_settings.backer_threshold, 'FM99,999') || '. Early-backer price is now closed.', p_design);
    perform public.notify_user(v_design.artist_id, 'milestone', v_design.name || ' hit ' || v_settings.backer_threshold || ' votes', 'Keep pushing for the top 3.', '/studio');
  end if;

  return v_count;
end $$;

-- Where an artist's votes and backers came from.
create or replace function public.artist_source_stats()
returns table (design_id uuid, source text, votes int, backers int)
language sql stable security definer set search_path = public as $$
  with mine as (select id from public.designs where artist_id = auth.uid()),
  v as (
    select design_id, coalesce(source, 'direct') as src, count(*)::int as n
    from public.votes where withdrawn_at is null and design_id in (select id from mine) group by 1, 2
  ), b as (
    select i.design_id, coalesce(o.source, 'direct') as src, sum(i.qty)::int as n
    from public.orders o join public.order_items i on i.order_id = o.id
    where i.design_id in (select id from mine) and o.payment_status in ('authorized', 'captured') group by 1, 2
  )
  select coalesce(v.design_id, b.design_id), coalesce(v.src, b.src), coalesce(v.n, 0), coalesce(b.n, 0)
  from v full join b on b.design_id = v.design_id and b.src = v.src
  order by 1, 3 desc;
$$;

-- ─── "Notify me" waitlist + back by demand ────────────────────────────
create table public.design_waitlist (
  design_id   uuid not null references public.designs (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (design_id, user_id)
);

create or replace function public.waitlist_count(p_design uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.design_waitlist where design_id = p_design;
$$;

-- Put a lost (or sold-out) design on sale again and tell everyone who asked.
create or replace function public.reopen_design(p_design uuid, p_days int default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_design public.designs;
  v_days int := coalesce(p_days, (select reopen_days from public.settings));
  v_n int;
begin
  -- Admins, the service role, or a direct database session (the request role GUC is unset there).
  if not (public.is_admin() or coalesce(nullif(current_setting('role', true), 'none'), 'postgres') not in ('anon', 'authenticated')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.designs set status = 'won', retail_until = now() + make_interval(days => v_days)
  where id = p_design and status in ('won', 'lost') returning * into v_design;
  if not found then raise exception 'design_not_reopenable' using errcode = 'P0001'; end if;

  insert into public.notifications (user_id, kind, title, body, link, channels)
  select w.user_id, 'back_in_stock', v_design.name || ' is back',
         'You asked, it is printing. On sale for ' || v_days || ' days.', '/d/' || v_design.slug, '{push,email,whatsapp}'
  from public.design_waitlist w where w.design_id = p_design;
  get diagnostics v_n = row_count;
  delete from public.design_waitlist where design_id = p_design;

  perform public.notify_user(v_design.artist_id, 'back_by_demand', v_design.name || ' is back by demand',
    v_n || ' people asked for it. On sale for ' || v_days || ' days.', '/d/' || v_design.slug, '{push,email}');
  insert into public.posts (kind, body, design_id)
  values ('system', 'BACK BY DEMAND: ' || upper(v_design.name) || ' is on sale for ' || v_days || ' days.', p_design);
  return v_n;
end $$;

-- Same as before, except a "back by demand" reopen (lost → won) is announced by reopen_design().
create or replace function public.designs_after_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status is not distinct from new.status then return null; end if;
  if old.status = 'lost' and new.status = 'won' then return null; end if;
  if new.status = 'approved' then
    perform public.notify_user(new.artist_id, 'design_approved', new.name || ' passed review',
      case when new.drop_id is null then 'It will be scheduled into an upcoming Monday drop.'
           else 'It is scheduled for an upcoming Monday drop. Get your audience ready.' end, '/studio', '{push,email}');
  elsif new.status = 'changes_requested' then
    perform public.notify_user(new.artist_id, 'design_changes', 'Changes requested on ' || new.name, new.review_note, '/studio', '{push,email}');
  elsif new.status = 'rejected' then
    perform public.notify_user(new.artist_id, 'design_rejected', new.name || ' was not approved', new.review_note, '/studio', '{push,email}');
  elsif new.status = 'live' then
    perform public.notify_user(new.artist_id, 'design_live', new.name || ' is live', 'Voting is open until Thursday. Share your link.', '/d/' || new.slug, '{push,email,whatsapp}');
    insert into public.notifications (user_id, kind, title, body, link)
    select f.follower_id, 'artist_live', 'New drop from an artist you follow', new.name || ' is live for voting.', '/d/' || new.slug
    from public.follows f where f.artist_id = new.artist_id;
  elsif new.status = 'won' then
    perform public.notify_user(new.artist_id, 'design_won', new.name || ' finished #' || new.final_rank || ' — it prints Friday!', 'Thank your backers on The Pulse.', '/studio', '{push,email,whatsapp}');
  elsif new.status = 'lost' then
    perform public.notify_user(new.artist_id, 'design_lost', new.name || ' finished #' || new.final_rank, 'You can refine it and resubmit to a later drop.', '/studio', '{push,email}');
  end if;
  return null;
end $$;

-- ─── Photo URLs must point at the member's own upload folder ──────────
create or replace function public.own_upload_urls(p_urls text[], p_user uuid) returns boolean
language sql immutable as $$
  select coalesce(bool_and(u ~ ('^https?://[^/]+/storage/v1/object/public/posts/' || p_user::text || '/[A-Za-z0-9._-]+$')), true)
  from unnest(coalesce(p_urls, '{}')) as u;
$$;

-- ─── Returns & exchanges ──────────────────────────────────────────────
create table public.return_requests (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('exchange', 'return')),
  reason       text not null check (reason in ('size', 'damaged', 'misprint', 'wrong_item', 'other')),
  new_size     text,
  details      text check (char_length(details) <= 500),
  photo_urls   text[] not null default '{}' check (cardinality(photo_urls) <= 3),
  status       text not null default 'open' check (status in ('open', 'approved', 'rejected', 'completed')),
  admin_note   text check (char_length(admin_note) <= 300),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  check (kind <> 'exchange' or new_size is not null)
);
create unique index return_requests_one_active on public.return_requests (order_id) where status in ('open', 'approved');
create index return_requests_status_idx on public.return_requests (status, created_at);

create or replace function public.request_return(p_order uuid, p_kind text, p_reason text, p_new_size text,
                                                 p_details text, p_photos text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_order public.orders;
  v_s public.settings;
  v_delivered timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into v_order from public.orders where id = p_order and user_id = v_uid;
  if not found then raise exception 'order_not_found' using errcode = 'P0001'; end if;
  if v_order.status <> 'delivered' then raise exception 'not_delivered' using errcode = 'P0001'; end if;
  select * into v_s from public.settings;
  select coalesce(delivered_at, shipped_at) into v_delivered from public.shipments where order_id = p_order;
  if coalesce(v_delivered, v_order.updated_at) < now() - make_interval(days => v_s.return_window_days) then
    raise exception 'window_closed' using errcode = 'P0001';
  end if;
  if p_kind = 'exchange' and not (p_new_size = any (v_s.sizes)) then raise exception 'bad_size' using errcode = 'P0001'; end if;
  if not public.own_upload_urls(p_photos, v_uid) then raise exception 'bad_photo' using errcode = 'P0001'; end if;
  if exists (select 1 from public.return_requests where order_id = p_order and status in ('open', 'approved')) then
    raise exception 'already_requested' using errcode = 'P0001';
  end if;

  insert into public.return_requests (order_id, user_id, kind, reason, new_size, details, photo_urls)
  values (p_order, v_uid, p_kind, p_reason, case when p_kind = 'exchange' then p_new_size end,
          nullif(trim(p_details), ''), coalesce(p_photos, '{}'))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.returns_after_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_number bigint;
begin
  if old.status is not distinct from new.status then return null; end if;
  select number into v_number from public.orders where id = new.order_id;
  perform public.notify_user(new.user_id, 'return_' || new.status,
    case new.status
      when 'approved'  then initcap(new.kind) || ' approved · order #' || v_number
      when 'rejected'  then initcap(new.kind) || ' request declined · order #' || v_number
      when 'completed' then initcap(new.kind) || ' completed · order #' || v_number
      else 'Request updated' end,
    new.admin_note, '/orders/' || new.order_id, '{push,email}');
  return null;
end $$;
create trigger returns_status after update of status on public.return_requests
  for each row execute function public.returns_after_status();

-- ─── Reviews ──────────────────────────────────────────────────────────
create table public.reviews (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null unique references public.order_items (id) on delete cascade,
  design_id      uuid not null references public.designs (id) on delete cascade,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  rating         int not null check (rating between 1 and 5),
  fit            text check (fit in ('small', 'true', 'large')),
  size           text,
  body           text check (char_length(body) <= 500),
  photo_urls     text[] not null default '{}' check (cardinality(photo_urls) <= 3),
  hidden         boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index reviews_design_idx on public.reviews (design_id, created_at desc) where not hidden;

create or replace function public.post_review(p_item uuid, p_rating int, p_fit text, p_body text, p_photos text[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item record;
  v_id uuid;
  v_new boolean;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select i.id, i.design_id, i.size, o.status, g.artist_id, g.name, g.slug into v_item
  from public.order_items i join public.orders o on o.id = i.order_id join public.designs g on g.id = i.design_id
  where i.id = p_item and o.user_id = v_uid;
  if not found then raise exception 'item_not_found' using errcode = 'P0001'; end if;
  if v_item.status <> 'delivered' then raise exception 'not_delivered' using errcode = 'P0001'; end if;
  if exists (select 1 from public.profiles where id = v_uid and banned) then raise exception 'banned' using errcode = '42501'; end if;
  if not public.own_upload_urls(p_photos, v_uid) then raise exception 'bad_photo' using errcode = 'P0001'; end if;

  v_new := not exists (select 1 from public.reviews where order_item_id = p_item);
  insert into public.reviews (order_item_id, design_id, user_id, rating, fit, size, body, photo_urls)
  values (p_item, v_item.design_id, v_uid, p_rating, p_fit, v_item.size, nullif(trim(p_body), ''), coalesce(p_photos, '{}'))
  on conflict (order_item_id) do update
    set rating = excluded.rating, fit = excluded.fit, body = excluded.body, photo_urls = excluded.photo_urls, updated_at = now()
  returning id into v_id;

  if v_new then
    perform public.notify_user(v_item.artist_id, 'review', repeat('★', p_rating) || ' on ' || v_item.name,
      left(coalesce(nullif(trim(p_body), ''), 'A buyer rated your tee.'), 120), '/d/' || v_item.slug);
  end if;
  return v_id;
end $$;

create or replace function public.design_review_summary(p_design uuid)
returns table (reviews int, avg_rating numeric, runs_small int, true_to_size int, runs_large int)
language sql stable security definer set search_path = public as $$
  select count(*)::int, round(avg(rating), 1),
         count(*) filter (where fit = 'small')::int, count(*) filter (where fit = 'true')::int, count(*) filter (where fit = 'large')::int
  from public.reviews where design_id = p_design and not hidden;
$$;

alter table public.reports drop constraint reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'design', 'profile', 'review'));

-- ─── Security ─────────────────────────────────────────────────────────
alter table public.discount_codes       enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.design_waitlist      enable row level security;
alter table public.return_requests      enable row level security;
alter table public.reviews              enable row level security;

revoke insert, update, delete on public.discount_codes, public.discount_redemptions, public.design_waitlist,
  public.return_requests, public.reviews from anon, authenticated;

-- Members see only codes issued to them (public promo codes stay secret until shared).
create policy codes_read_own on public.discount_codes for select using (owner_id = auth.uid() or public.is_admin());
create policy redemptions_read_own on public.discount_redemptions for select using (user_id = auth.uid() or public.is_admin());

create policy waitlist_own on public.design_waitlist for select using (user_id = auth.uid());
create policy waitlist_join on public.design_waitlist for insert with check (
  user_id = auth.uid() and exists (select 1 from public.designs g where g.id = design_id and g.status in ('won', 'lost')));
create policy waitlist_leave on public.design_waitlist for delete using (user_id = auth.uid());
grant insert (design_id, user_id), delete on public.design_waitlist to authenticated;

create policy returns_read_own on public.return_requests for select using (user_id = auth.uid() or public.is_admin());

create policy reviews_read on public.reviews for select using (not hidden or user_id = auth.uid() or public.is_admin());
create policy reviews_delete_own on public.reviews for delete using (user_id = auth.uid());
grant delete on public.reviews to authenticated;

revoke execute on function public.quote_discount(text, uuid, public.order_type, int) from public, anon, authenticated;
revoke execute on function public.reopen_design(uuid, int) from public, anon;
revoke execute on function public.reward_code(text) from public, anon, authenticated;
revoke execute on function public.claim_referral(text) from public, anon;
revoke execute on function public.my_referrals() from public, anon;
revoke execute on function public.artist_source_stats() from public, anon;
revoke execute on function public.request_return(uuid, text, text, text, text, text[]) from public, anon;
revoke execute on function public.post_review(uuid, int, text, text, text[]) from public, anon;
revoke execute on function public.cast_vote(uuid, text) from public, anon;
grant execute on function public.quote_discount(text, uuid, public.order_type, int) to service_role;
grant execute on function public.reward_code(text) to service_role;
grant execute on function public.reopen_design(uuid, int) to authenticated, service_role;
grant execute on function public.claim_referral(text) to authenticated;
grant execute on function public.my_referrals() to authenticated;
grant execute on function public.artist_source_stats() to authenticated;
grant execute on function public.request_return(uuid, text, text, text, text, text[]) to authenticated;
grant execute on function public.post_review(uuid, int, text, text, text[]) to authenticated;
grant execute on function public.cast_vote(uuid, text) to authenticated;
grant execute on function public.waitlist_count(uuid) to anon, authenticated;
grant execute on function public.design_review_summary(uuid) to anon, authenticated;
