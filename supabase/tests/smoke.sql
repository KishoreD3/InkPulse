-- INKPULSE · database smoke tests. Run via: npm run db:test
\set ON_ERROR_STOP on
\set voter   '''aaaaaaaa-0000-4000-8000-000000000001'''
\set noPhone '''aaaaaaaa-0000-4000-8000-000000000002'''

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '919800000001', now(), '{"full_name":"Test Voter"}', now(), now()),
       ('aaaaaaaa-0000-4000-8000-000000000002', 'authenticated', 'authenticated', null, null, '{}', now(), now());

do $$ begin
  assert (select count(*) from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001') = 1, 'profile auto-created';
  assert (select count(*) from public.drops where status = 'scheduled') = 2, 'two drops scheduled ahead by seed';
end $$;

update public.settings set require_phone_for_votes = true;

-- ─── Voting as a verified user ────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :voter, true);
do $$
declare d uuid := (select id from public.designs where slug = 'theta-decay');
declare n int;
declare q record;
begin
  n := public.cast_vote(d);       assert n = 4311, 'vote counted: ' || n;
  n := public.cast_vote(d);       assert n = 4311, 'second vote is idempotent: ' || n;
  select * into q from public.price_quote(d);
  assert q.price = 899 and q.price_type = 'backer' and q.order_type = 'backing', 'backer price under threshold';
  n := public.withdraw_vote(d);   assert n = 4310, 'withdraw decrements: ' || n;
  n := public.cast_vote(d);       assert n = 4311, 're-vote after withdraw: ' || n;
  select * into q from public.price_quote((select id from public.designs where slug = 'kolam-grid'));
  assert q.price = 1099 and q.price_type = 'full', 'full price after threshold';
  select * into q from public.price_quote((select id from public.designs where slug = 'madras-heat'));
  assert q.price = 1099 and q.order_type = 'retail', 'past winner sells at retail';
  perform public.vote_cause('33333333-3333-4333-8333-000000000003');
  perform public.vote_cause('33333333-3333-4333-8333-000000000004');   -- changing mind replaces the vote
  assert (select count(*) from public.cause_votes) = 1, 'one cause vote per user per drop';
end $$;
commit;

-- ─── Guards ───────────────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :noPhone, true);
do $$ begin
  begin
    perform public.cast_vote((select id from public.designs where slug = 'theta-decay'));
    raise exception 'unverified phone must not vote';
  exception when insufficient_privilege then null;  -- phone_not_verified
  end;
  begin
    update public.designs set vote_count = 999999 where slug = 'theta-decay';
    raise exception 'browser must not edit vote counts';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.designs (slug, artist_id, name, category, art_front_url, status)
    values ('sneaky', auth.uid(), 'Sneaky', 'Minimal', '/x.png', 'in_review');
    raise exception 'non-artist must not submit';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lock_due_drops();
    raise exception 'browser must not lock drops';
  exception when insufficient_privilege then null;
  end;
  assert (select count(*) from public.votes) = 0, 'cannot read other people''s votes';
  assert (select count(*) from public.profile_private) = 1, 'sees only own private row';
end $$;
commit;

-- Rate limit (the voter already has 2 vote rows this hour: vote + re-vote)
update public.settings set votes_per_hour = 3;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', :voter, true);
do $$ begin
  perform public.cast_vote((select id from public.designs where slug = 'kolam-grid'));
  begin
    perform public.cast_vote((select id from public.designs where slug = 'monsoon-static'));
    raise exception 'rate limit should trip';
  exception when raise_exception then
    if sqlerrm <> 'rate_limited' then raise; end if;
  end;
end $$;
commit;
update public.settings set require_phone_for_votes = true, votes_per_hour = 60, artist_pct = 15, unit_cost = 380, shipping_cost = 70;

-- ─── A backing order through its life ─────────────────────────────────
do $$
declare
  v_order uuid;
  v_design uuid := (select id from public.designs where slug = 'theta-decay');
  v_before int := (select backer_count from public.designs where slug = 'theta-decay');
begin
  insert into public.orders (user_id, type, drop_id, ship_to, subtotal, total, gst_included)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'backing', '44444444-4444-4444-8444-000000000042',
          '{"name":"Test","line1":"1 Test St","city":"Chennai","state":"Tamil Nadu","pin":"600001","phone":"9800000001"}', 899, 899, 43)
  returning id into v_order;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type)
  values (v_order, v_design, 'Acid', 'L', 1, 899, 'backer');
  update public.orders set status = 'backed', payment_status = 'authorized', authorized_at = now() where id = v_order;
  assert (select backer_count from public.designs where id = v_design) = v_before + 1, 'backer counted';
  assert exists (select 1 from public.notifications where kind = 'order_backed'), 'backed notification queued';
end $$;

-- ─── Thursday lock ────────────────────────────────────────────────────
update public.drops set locks_at = now() - interval '1 minute', opens_at = now() - interval '4 days' where number = 42;
set role service_role;
select count(*) as locked from public.lock_due_drops();
reset role;
do $$ begin
  assert (select status from public.drops where number = 42) = 'locked', 'drop locked';
  assert (select string_agg(slug, ',' order by final_rank) from public.designs where status = 'won' and drop_id = '44444444-4444-4444-8444-000000000042')
         = 'kolam-grid,expiry-thursday,theta-decay', 'top 3 by votes';
  assert (select status from public.designs where slug = 'monsoon-static') = 'lost', 'rank 4 lost';
  assert exists (select 1 from public.notifications where kind = 'design_won'), 'artists told';
  assert exists (select 1 from public.posts where body like 'DROP 042 RESULTS%'), 'results posted';
  begin
    perform 1 from public.price_quote((select id from public.designs where slug = 'monsoon-static')) having count(*) > 0;
    if found then raise exception 'losers are not for sale'; end if;
  end;
end $$;

-- Capture the winner's backing order (what the app does after the gateway capture succeeds).
do $$
declare v_order uuid := (select id from public.orders where status = 'backed' limit 1);
begin
  update public.orders set status = 'won', payment_status = 'captured', captured_at = now() where id = v_order;
  assert (select amount from public.artist_earnings) = floor(899 / 1.05 * 0.15), 'artist earns pct of ex-GST price';
  assert exists (select 1 from public.notifications where kind = 'order_won'), 'buyer told it printed';
end $$;

-- Financials are admin/service only and compute net profit → cause amount.
set role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', false);
select units, revenue, gst, product_cost, shipping_cost, gateway_fees, artist_share, net_profit, cause_amount
from public.drop_financials('44444444-4444-4444-8444-000000000042');
reset role;
do $$
declare f record;
begin
  perform set_config('request.jwt.claims', '{"role":"service_role"}', false);
  select * into f from public.drop_financials('44444444-4444-4444-8444-000000000042');
  assert f.revenue = 899 and f.units = 1, 'revenue counted';
  assert f.net_profit = 899 - f.gst - 380 - 70 - f.gateway_fees - f.artist_share, 'net profit math';
  assert f.cause_amount = 0, 'no cause share';
end $$;

-- ─── Monday open ──────────────────────────────────────────────────────
do $$
declare v43 uuid := (select id from public.drops where number = 43);
begin
  update public.drops set topic_at = now() - interval '14 days', submissions_close_at = now() - interval '4 days',
                          opens_at = now() - interval '1 minute' where id = v43;
  insert into public.designs (slug, artist_id, drop_id, name, category, art_front_url, status, originality_confirmed)
  values ('next-up', '11111111-1111-4111-8111-000000000002', v43, 'Next Up', 'Minimal', '/seed/margin.svg', 'approved', true);
end $$;
set role service_role;
select count(*) as opened from public.open_due_drops();
reset role;
do $$ begin
  assert (select status from public.drops where number = 43) = 'live', 'drop 43 live';
  assert (select status from public.designs where slug = 'next-up') = 'live', 'approved designs go live';
  assert (select count(*) from public.drops where status = 'scheduled' and number = 44) = 1, 'drop 44 scheduled';
  assert extract(isodow from (select opens_at at time zone 'Asia/Kolkata' from public.drops where number = 44)) = 1, 'opens Monday IST';
  assert extract(isodow from (select locks_at at time zone 'Asia/Kolkata' from public.drops where number = 44)) = 4, 'locks Thursday IST';
  assert extract(isodow from (select prints_at at time zone 'Asia/Kolkata' from public.drops where number = 44)) = 5, 'prints Friday IST';
end $$;

-- Public aggregates
do $$ begin
  assert (select earned from public.artist_totals()) > 0, 'artist earnings totalled';
  assert (select count(*) from public.top_artists()) >= 1, 'top artists listed';
  assert (select total_given from public.impact_totals()) = 54600, 'impact totals sum published payouts';
  assert (select count(*) from public.cause_vote_tally('44444444-4444-4444-8444-000000000042')) = 3, 'tally lists shortlist';
  assert (select printed from public.artist_stats('11111111-1111-4111-8111-000000000001')) = 1, 'artist stats';
end $$;

select 'all smoke tests passed' as result;
