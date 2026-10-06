-- INKPULSE · business logic: counters, voting, weekly drop lifecycle, notifications, money.

-- ─── Helpers ──────────────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger designs_touch before update on public.designs for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();
create trigger shipments_touch before update on public.shipments for each row execute function public.touch_updated_at();
create trigger private_touch before update on public.profile_private for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_artist() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_artist and not banned from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.phone_verified() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select not (select require_phone_for_votes from public.settings)
      or exists (select 1 from auth.users where id = auth.uid() and phone_confirmed_at is not null);
$$;

create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text, p_link text, p_channels text[] default '{push}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link, channels)
  values (p_user, p_kind, p_title, p_body, p_link, p_channels);
$$;

create or replace function public.inr(p int) returns text
language sql immutable as $$
  select '₹' || to_char(p, 'FM99,99,99,999');
$$;

-- ─── New user → profile ───────────────────────────────────────────────
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_handle text := 'ink_' || substr(md5(new.id::text), 1, 12);
begin
  insert into public.profiles (id, handle, name, is_admin)
  values (new.id, v_handle, nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
          coalesce(lower(new.email) = any (select lower(unnest(admin_emails)) from public.settings), false))
  on conflict (id) do nothing;
  insert into public.profile_private (id, phone, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.sync_user_contact() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.profile_private set phone = new.phone, email = new.email where id = new.id;
  return new;
end $$;

create trigger on_auth_user_updated after update of phone, email on auth.users
  for each row execute function public.sync_user_contact();

-- ─── Vote counters ────────────────────────────────────────────────────
create or replace function public.votes_counter() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.designs set vote_count = vote_count + 1, count_reached_at = now() where id = new.design_id;
  elsif tg_op = 'UPDATE' and old.withdrawn_at is null and new.withdrawn_at is not null then
    update public.designs set vote_count = greatest(vote_count - 1, 0), count_reached_at = now() where id = new.design_id;
  end if;
  return null;
end $$;

create trigger votes_count after insert or update of withdrawn_at on public.votes
  for each row execute function public.votes_counter();

-- ─── Voting ───────────────────────────────────────────────────────────
create or replace function public.cast_vote(p_design uuid) returns int
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

  insert into public.votes (design_id, drop_id, user_id)
  values (p_design, v_design.drop_id, v_uid)
  on conflict (design_id, user_id) where withdrawn_at is null do nothing;

  if not found then
    return v_design.vote_count;   -- already voted: idempotent
  end if;

  select vote_count into v_count from public.designs where id = p_design;

  -- Heads-up to voters who haven't backed yet: backer window about to close.
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

create or replace function public.withdraw_vote(p_design uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_drop public.drops;
  v_count int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select d.* into v_drop from public.drops d join public.designs g on g.drop_id = d.id where g.id = p_design;
  if not found or v_drop.status <> 'live' or now() >= v_drop.locks_at then raise exception 'voting_locked' using errcode = 'P0001'; end if;
  update public.votes set withdrawn_at = now()
  where design_id = p_design and user_id = v_uid and withdrawn_at is null;
  select vote_count into v_count from public.designs where id = p_design;
  return v_count;
end $$;

create or replace function public.vote_cause(p_cause uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_drop public.drops;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if not public.phone_verified() then raise exception 'phone_not_verified' using errcode = '42501'; end if;
  select * into v_drop from public.drops where status = 'live';
  if not found or now() >= v_drop.locks_at then raise exception 'voting_locked' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.cause_shortlist where drop_id = v_drop.id and cause_id = p_cause) then
    raise exception 'cause_not_on_shortlist' using errcode = 'P0001';
  end if;
  insert into public.cause_votes (drop_id, user_id, cause_id) values (v_drop.id, v_uid, p_cause)
  on conflict (drop_id, user_id) do update set cause_id = excluded.cause_id, created_at = now();
end $$;

-- ─── Pricing (single source of truth; the checkout API calls this) ────
-- price_type: 'backer' (under threshold, during voting), 'full' (backing after threshold),
--             'retail' (winner, after the drop). order_type follows: backer/full → backing.
create or replace function public.price_quote(p_design uuid)
returns table (price int, price_type text, order_type public.order_type)
language plpgsql stable security definer set search_path = public as $$
declare
  v_design public.designs;
  v_drop public.drops;
  v_settings public.settings;
begin
  select * into v_settings from public.settings;
  select * into v_design from public.designs where id = p_design;
  if not found then return; end if;
  select * into v_drop from public.drops where id = v_design.drop_id;

  if v_design.status = 'live' and v_drop.status = 'live' and now() < v_drop.locks_at then
    if v_design.vote_count < v_settings.backer_threshold then
      return query select v_settings.backer_price, 'backer'::text, 'backing'::public.order_type;
    else
      return query select v_settings.retail_price, 'full'::text, 'backing'::public.order_type;
    end if;
  elsif v_design.status = 'won' and (v_design.retail_until is null or now() < v_design.retail_until) then
    return query select v_settings.retail_price, 'retail'::text, 'retail'::public.order_type;
  end if;
end $$;

-- ─── Backer counter + order notifications + artist earnings ───────────
create or replace function public.orders_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.settings;
  v_name text;
  v_slug text;
begin
  select * into v_settings from public.settings;
  select g.name, g.slug into v_name, v_slug
  from public.order_items i join public.designs g on g.id = i.design_id
  where i.order_id = new.id limit 1;

  -- backer_count: count backing orders that are live commitments
  if new.type = 'backing' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    if new.status = 'backed' and (tg_op = 'INSERT' or old.status <> 'backed') then
      update public.designs g set backer_count = backer_count + i.qty
      from public.order_items i where i.order_id = new.id and g.id = i.design_id;
    elsif tg_op = 'UPDATE' and old.status = 'backed' and new.status in ('cancelled', 'failed', 'refunded') then
      update public.designs g set backer_count = greatest(backer_count - i.qty, 0)
      from public.order_items i where i.order_id = new.id and g.id = i.design_id;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'backed' then
      perform public.notify_user(new.user_id, 'order_backed', 'You backed ' || v_name,
        public.inr(new.total) || ' is reserved. It is only debited if the design makes the top 3.', '/orders/' || new.id, '{push,email}');
    elsif new.status = 'won' then
      perform public.notify_user(new.user_id, 'order_won', 'It printed! ' || v_name || ' made the top 3',
        public.inr(new.total) || ' debited. Printing starts Friday.', '/orders/' || new.id, '{push,email,whatsapp}');
    elsif new.status = 'released' then
      perform public.notify_user(new.user_id, 'order_released', v_name || ' didn''t print',
        'Nothing was debited. Your reservation has been released.', '/orders/' || new.id, '{push,email}');
    elsif new.status = 'paid' then
      perform public.notify_user(new.user_id, 'order_paid', 'Order #' || new.number || ' confirmed',
        'It ships with the next print batch.', '/orders/' || new.id, '{push,email}');
    elsif new.status = 'shipped' then
      perform public.notify_user(new.user_id, 'order_shipped', 'Shipped · ' || v_name,
        'Track your order.', '/orders/' || new.id, '{push,email,whatsapp}');
    elsif new.status = 'delivered' then
      perform public.notify_user(new.user_id, 'order_delivered', 'Delivered · ' || v_name,
        'Post a fit pic on The Pulse and tag the artist.', '/pulse', '{push}');
    end if;
  end if;

  -- Artist earnings accrue when money is actually captured.
  if new.payment_status = 'captured' and (tg_op = 'INSERT' or old.payment_status <> 'captured') then
    insert into public.artist_earnings (artist_id, design_id, order_item_id, amount)
    select g.artist_id, g.id, i.id,
           floor((i.unit_price * i.qty) / (1 + v_settings.gst_pct / 100.0) * v_settings.artist_pct / 100.0)::int
    from public.order_items i join public.designs g on g.id = i.design_id
    where i.order_id = new.id
    on conflict (order_item_id) do nothing;
  end if;
  if tg_op = 'UPDATE' and new.payment_status = 'refunded' and old.payment_status <> 'refunded' then
    update public.artist_earnings e set status = 'void'
    from public.order_items i where i.order_id = new.id and e.order_item_id = i.id and e.status <> 'paid';
  end if;
  return null;
end $$;

create trigger orders_change after insert or update on public.orders
  for each row execute function public.orders_after_change();

-- ─── Design review notifications ─────────────────────────────────────
create or replace function public.designs_after_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status is not distinct from new.status then return null; end if;
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

create trigger designs_status after update of status on public.designs
  for each row execute function public.designs_after_status();

-- ─── Social counters ──────────────────────────────────────────────────
create or replace function public.social_counters() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_delta int := case when tg_op = 'INSERT' then 1 else -1 end;
declare v_post uuid := coalesce(new.post_id, old.post_id);
begin
  if tg_table_name = 'likes' then
    update public.posts set like_count = greatest(like_count + v_delta, 0) where id = v_post;
  elsif tg_table_name = 'reposts' then
    update public.posts set repost_count = greatest(repost_count + v_delta, 0) where id = v_post;
  elsif tg_table_name = 'comments' and v_post is not null then
    update public.posts set comment_count = greatest(comment_count + v_delta, 0) where id = v_post;
  end if;
  return null;
end $$;

create trigger likes_count after insert or delete on public.likes for each row execute function public.social_counters();
create trigger reposts_count after insert or delete on public.reposts for each row execute function public.social_counters();
create trigger comments_count after insert or delete on public.comments for each row execute function public.social_counters();

create or replace function public.notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_link text;
begin
  if new.post_id is not null then
    select author_id into v_owner from public.posts where id = new.post_id;
    v_link := '/pulse/' || new.post_id;
  else
    select artist_id into v_owner from public.designs where id = new.design_id;
    select '/d/' || slug into v_link from public.designs where id = new.design_id;
  end if;
  if v_owner is not null and v_owner <> new.author_id then
    perform public.notify_user(v_owner, 'comment', 'New comment', left(new.body, 120), v_link);
  end if;
  return null;
end $$;

create trigger comments_notify after insert on public.comments for each row execute function public.notify_on_comment();

-- ─── Weekly drop lifecycle (called by the scheduler with the service role) ─
-- Next Monday 00:00 IST after p_after; locks Thursday <lock_time>; prints Friday <print_time>.
create or replace function public.ensure_next_drop() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_settings public.settings;
  v_existing uuid;
  v_base timestamptz;
  v_monday timestamp;
  v_number int;
  v_id uuid;
begin
  select id into v_existing from public.drops where status = 'scheduled' order by opens_at limit 1;
  if v_existing is not null then return v_existing; end if;
  select * into v_settings from public.settings;
  select greatest(now(), coalesce(max(locks_at), now())) into v_base from public.drops;
  v_monday := date_trunc('week', v_base at time zone 'Asia/Kolkata') + interval '7 days';
  select coalesce(max(number), 0) + 1 into v_number from public.drops;
  insert into public.drops (number, opens_at, locks_at, prints_at)
  values (v_number,
          v_monday at time zone 'Asia/Kolkata',
          (v_monday + interval '3 days' + v_settings.lock_time) at time zone 'Asia/Kolkata',
          (v_monday + interval '4 days' + v_settings.print_time) at time zone 'Asia/Kolkata')
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.open_due_drops() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare v_drop public.drops;
begin
  for v_drop in
    select * from public.drops
    where status = 'scheduled' and opens_at <= now()
      and not exists (select 1 from public.drops where status = 'live')
    order by opens_at limit 1
  loop
    update public.drops set status = 'live', opened_at = now() where id = v_drop.id;
    update public.designs set status = 'live', vote_count = 0, backer_count = 0, count_reached_at = now()
    where drop_id = v_drop.id and status = 'approved';
    insert into public.posts (kind, body)
    values ('system', 'DROP ' || lpad(v_drop.number::text, 3, '0') || ' IS LIVE. Voting locks Thursday. Back early to lock ' ||
            public.inr((select backer_price from public.settings)) || '.');
    return next v_drop.id;
  end loop;
  perform public.ensure_next_drop();
end $$;

-- Locks voting, ranks designs, decides winners, rolls the community cause vote
-- into the next drop. Payment capture/release is done by the app (gateway calls),
-- driven by orders in status 'backed' whose design is now won/lost.
create or replace function public.lock_due_drops() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  v_drop public.drops;
  v_settings public.settings;
  v_next uuid;
  v_cause uuid;
begin
  select * into v_settings from public.settings;
  for v_drop in
    select * from public.drops where status = 'live' and locks_at <= now() for update
  loop
    update public.drops set status = 'locked', locked_at = now() where id = v_drop.id;

    with ranked as (
      select id, row_number() over (order by vote_count desc, count_reached_at asc, created_at asc) as rn
      from public.designs where drop_id = v_drop.id and status = 'live'
    )
    update public.designs g
    set final_rank = r.rn,
        status = case when r.rn <= v_settings.winners_per_drop then 'won'::public.design_status else 'lost'::public.design_status end,
        retail_until = case when r.rn <= v_settings.winners_per_drop
                            then v_drop.prints_at + make_interval(days => v_settings.retail_window_days) end
    from ranked r where g.id = r.id;

    -- Community cause vote decides the next drop's cause.
    select cause_id into v_cause from public.cause_votes where drop_id = v_drop.id
    group by cause_id order by count(*) desc, min(created_at) asc limit 1;
    v_next := public.ensure_next_drop();
    if v_cause is not null then
      update public.drops set cause_id = v_cause where id = v_next and cause_id is null;
    end if;

    insert into public.posts (kind, body)
    values ('system', 'DROP ' || lpad(v_drop.number::text, 3, '0') || ' RESULTS ARE IN. ' ||
      coalesce((select string_agg(upper(name), ' · ' order by final_rank) from public.designs
                where drop_id = v_drop.id and status = 'won'), 'No winners') || ' go to print Friday.');
    return next v_drop.id;
  end loop;
end $$;

-- ─── Money: per-drop financials (estimate until real costs are entered) ─
create or replace function public.drop_financials(p_drop uuid)
returns table (units int, orders int, revenue int, gst int, product_cost int, shipping_cost int,
               gateway_fees int, artist_share int, net_profit int, cause_amount int)
language plpgsql stable security definer set search_path = public as $$
declare v_s public.settings;
begin
  if not (public.is_admin() or coalesce(auth.jwt() ->> 'role', '') = 'service_role' or session_user = 'postgres') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select * into v_s from public.settings;
  return query
  with o as (
    select o.id, o.total from public.orders o
    where o.drop_id = p_drop and o.payment_status = 'captured'
  ), u as (
    select coalesce(sum(i.qty), 0)::int as units from public.order_items i where i.order_id in (select id from o)
  ), r as (
    select coalesce(sum(total), 0)::int as revenue, count(*)::int as n from o
  ), a as (
    select coalesce(sum(e.amount), 0)::int as artist
    from public.artist_earnings e join public.order_items i on i.id = e.order_item_id
    where i.order_id in (select id from o) and e.status <> 'void'
  ), calc as (
    select u.units, r.n, r.revenue,
           round(r.revenue - r.revenue / (1 + v_s.gst_pct / 100.0))::int as gst,
           (u.units * v_s.unit_cost)::int as product_cost,
           (r.n * v_s.shipping_cost)::int as ship,
           round(r.revenue * v_s.gateway_fee_pct / 100.0)::int as fees,
           a.artist
    from u, r, a
  )
  select c.units, c.n, c.revenue, c.gst, c.product_cost, c.ship, c.fees, c.artist,
         (c.revenue - c.gst - c.product_cost - c.ship - c.fees - c.artist) as net_profit,
         greatest(round((c.revenue - c.gst - c.product_cost - c.ship - c.fees - c.artist) * v_s.cause_pct_of_profit / 100.0), 0)::int
  from calc c;
end $$;

-- ─── Lock down who can call what ──────────────────────────────────────
-- Supabase grants EXECUTE to anon/authenticated by default, so revoke explicitly.
revoke execute on function public.ensure_next_drop() from public, anon, authenticated;
revoke execute on function public.open_due_drops() from public, anon, authenticated;
revoke execute on function public.lock_due_drops() from public, anon, authenticated;
revoke execute on function public.notify_user(uuid, text, text, text, text, text[]) from public, anon, authenticated;
revoke execute on function public.drop_financials(uuid) from public, anon;
grant execute on function public.ensure_next_drop() to service_role;
grant execute on function public.open_due_drops() to service_role;
grant execute on function public.lock_due_drops() to service_role;
grant execute on function public.notify_user(uuid, text, text, text, text, text[]) to service_role;
grant execute on function public.drop_financials(uuid) to authenticated, service_role;
grant execute on function public.cast_vote(uuid) to authenticated;
grant execute on function public.withdraw_vote(uuid) to authenticated;
grant execute on function public.vote_cause(uuid) to authenticated;
grant execute on function public.price_quote(uuid) to anon, authenticated;
