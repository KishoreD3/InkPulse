-- The DND Club · storefront tests, run on a fresh database with supabase/seed_dnd.sql loaded.
\set ON_ERROR_STOP on
\set shopper '''eeeeeeee-0000-4000-8000-000000000001'''
\set other   '''eeeeeeee-0000-4000-8000-000000000002'''

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('eeeeeeee-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'riya@example.com', '{"full_name":"Riya Menon"}', now(), now()),
       ('eeeeeeee-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'kabir@example.com', '{}', now(), now());

-- ─── Catalogue ────────────────────────────────────────────────────────
do $$
declare s public.settings;
begin
  assert (select count(*) from public.store_designs() where status = 'won') = 8, 'eight winners on sale';
  assert (select count(*) from public.store_designs() where status = 'live') = 8, 'eight live finalists';
  assert (select count(*) from public.store_artists()) = 13, 'every artist with a public design is listed';
  assert (select wins from public.store_artists() where handle = 'nilofer') = 2, 'artist wins counted';
  assert (select count(*) from public.store_archive()) = 5, 'finished drops in the archive';
  assert (select topic from public.store_designs() where slug = 'puddle-theory') = 'Monsoon Mood', 'design carries its topic';
  assert (select colours -> 0 ->> 'name' from public.store_designs() where slug = 'midnight-auto') = 'Washed Black', 'colours keep their order';
  select * into s from public.settings;
  assert s.lock_time = '21:00' and s.open_time = '10:00', 'battle runs Monday 10 AM to Thursday 9 PM IST';
  assert s.sizes = '{XS,S,M,L,XL,2XL,3XL}', 'sizes match the store';
  assert (select count(*) from public.discount_codes where code in ('SNOOZE10', 'NIGHTOWL15') and applies_to = 'retail') = 2, 'store promo codes';
end $$;

-- Drafts and designs in review are not in the public catalogue.
update public.designs set status = 'in_review' where slug = 'wet-streets';
do $$ begin
  assert not exists (select 1 from public.store_designs() where slug = 'wet-streets'), 'in-review design hidden';
end $$;
update public.designs set status = 'live' where slug = 'wet-streets';

-- ─── Wishlist, reminders, votes as a shopper ──────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :shopper, true);
do $$
declare n int;
begin
  insert into public.wishlist (user_id, design_id) select auth.uid(), id from public.designs where slug = 'midnight-auto';
  assert (select count(*) from public.wishlist) = 1, 'wishlist saved';
  begin
    insert into public.wishlist (user_id, design_id) select 'eeeeeeee-0000-4000-8000-000000000002', id from public.designs where slug = 'soft-riot';
    raise exception 'must not write someone else''s wishlist';
  exception when insufficient_privilege then null;
  end;

  insert into public.topic_reminders (user_id, drop_id) select auth.uid(), id from public.drops where number = 46;
  begin
    insert into public.topic_reminders (user_id, drop_id) select auth.uid(), id from public.drops where number = 44;
    raise exception 'no reminder for a battle that is already live';
  exception when insufficient_privilege then null;
  end;

  n := public.cast_vote((select id from public.designs where slug = 'petrichor'));
  assert n = 2703, 'vote on a finalist: ' || n;
  assert (select votes from public.my_vote_history()) = 1, 'vote history';

  insert into public.follows (follower_id, artist_id) values (auth.uid(), 'd0000000-0000-4000-8000-000000000001');
  begin
    insert into public.newsletter_signups (email) values ('x@example.com');
    raise exception 'newsletter goes through the server';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

do $$ begin
  assert (select followers from public.store_artists() where handle = 'nilofer') = 1, 'followers counted';
end $$;

-- Reminder fires when the drop opens.
update public.drops set status = 'locked', locked_at = now() where number = 44;
update public.drops set status = 'live', opened_at = now() where number = 46;
do $$ begin
  assert exists (select 1 from public.notifications where user_id = 'eeeeeeee-0000-4000-8000-000000000001'
                 and kind = 'voting_open' and title like '%Beautiful Chaos%'), 'reminder sent when voting opens';
end $$;

-- ─── Grouped test-mode orders and club points ─────────────────────────
do $$
declare
  o1 uuid; o2 uuid;
  d uuid := (select id from public.designs where slug = 'midnight-auto');
begin
  update public.settings set points_per_100 = 10, welcome_points = 0;
  insert into public.orders (user_id, type, status, ship_to, subtotal, discount, total, payment_status, gateway, group_ref, gift_wrap, points_redeemed)
  values ('eeeeeeee-0000-4000-8000-000000000001', 'retail', 'pending', '{"name":"Riya"}', 2198, 220, 1878, 'created', 'test', 'DND-20001', true, 100)
  returning id into o1;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type) values (o1, d, 'Washed Black', 'M', 2, 1099, 'retail');
  insert into public.points_ledger (user_id, delta, note, order_id, kind) values ('eeeeeeee-0000-4000-8000-000000000001', -100, 'Redeemed on DND-20001', o1, 'redeemed');

  update public.orders set status = 'paid', payment_status = 'captured', captured_at = now() where id = o1;
  assert public.points_balance('eeeeeeee-0000-4000-8000-000000000001') = -100 + 187, 'earned 10 points per ₹100 paid';
  assert (select sold from public.store_designs() where slug = 'midnight-auto') = 2, 'sold count from paid orders';

  update public.orders set status = 'refunded', payment_status = 'refunded' where id = o1;
  assert public.points_balance('eeeeeeee-0000-4000-8000-000000000001') = 0, 'refund returns redeemed points and removes earned ones';

  insert into public.orders (user_id, type, status, ship_to, subtotal, total, payment_status, gateway, group_ref)
  values ('eeeeeeee-0000-4000-8000-000000000001', 'retail', 'pending', '{"name":"Riya"}', 1099, 1099, 'created', 'paypal', 'DND-20002');
  raise exception 'unknown gateway must be rejected';
exception when check_violation then null;
end $$;

-- A released backing hands out a 48-hour Backer Pass.
do $$
declare
  o uuid; n int;
  d uuid := (select id from public.designs where slug = 'puddle-theory');
  c public.discount_codes;
begin
  insert into public.orders (user_id, type, status, ship_to, subtotal, total, payment_status, gateway, drop_id)
  values ('eeeeeeee-0000-4000-8000-000000000001', 'backing', 'backed', '{"name":"Riya"}', 899, 899, 'authorized', 'test',
          (select drop_id from public.designs where id = d))
  returning id, number into o, n;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type) values (o, d, 'Washed Black', 'M', 1, 899, 'backer');
  update public.orders set status = 'released', payment_status = 'released' where id = o;
  select * into c from public.discount_codes where code = 'PASS-' || n;
  assert c.owner_id = 'eeeeeeee-0000-4000-8000-000000000001' and c.kind = 'flat' and c.value = 1099 - 899
     and c.applies_to = 'retail' and c.max_uses = 1 and c.expires_at > now() + interval '47 hours', 'backer pass code';
  assert exists (select 1 from public.notifications where user_id = 'eeeeeeee-0000-4000-8000-000000000001'
                  and kind = 'order_released' and body like '%PASS-' || n || '%'), 'release notice carries the pass code';
end $$;

-- Delivered notices point at the order page (reviews and exchanges), not the old Pulse feed.
do $$
declare o uuid;
begin
  insert into public.orders (user_id, type, status, ship_to, subtotal, total, payment_status, gateway)
  values ('eeeeeeee-0000-4000-8000-000000000001', 'retail', 'shipped', '{"name":"Riya"}', 1099, 1099, 'captured', 'test')
  returning id into o;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type)
  values (o, (select id from public.designs where slug = 'midnight-auto'), 'Washed Black', 'M', 1, 1099, 'retail');
  update public.orders set status = 'delivered' where id = o;
  assert exists (select 1 from public.notifications where kind = 'order_delivered' and link = '/orders/' || o and body like 'How does it fit%'),
    'delivered notice links to the order';
end $$;

-- Members only read their own points.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :other, true);
do $$ begin
  assert (select count(*) from public.points_ledger) = 0, 'points are private';
  assert (select count(*) from public.wishlist) = 0, 'wishlist is private';
end $$;
commit;

-- ─── Next drops open Monday 10 AM and lock Thursday 9 PM IST ──────────
select public.ensure_next_drop();
do $$
declare d public.drops;
begin
  select * into d from public.drops where number = (select max(number) from public.drops);
  assert extract(isodow from d.opens_at at time zone 'Asia/Kolkata') = 1
     and to_char(d.opens_at at time zone 'Asia/Kolkata', 'HH24:MI') = '10:00', 'opens Monday 10:00 IST';
  assert extract(isodow from d.locks_at at time zone 'Asia/Kolkata') = 4
     and to_char(d.locks_at at time zone 'Asia/Kolkata', 'HH24:MI') = '21:00', 'locks Thursday 21:00 IST';
end $$;

select 'all store tests passed' as result;
