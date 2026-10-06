-- INKPULSE · growth feature tests (run after smoke.sql; relies on its end state).
\set ON_ERROR_STOP on

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values ('aaaaaaaa-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'friend@example.com', '{}', now(), now());

-- ─── Referral: friend joins through the voter's invite link ───────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000003', true);
do $$
declare v_handle text := (select handle from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001');
begin
  assert public.claim_referral(v_handle), 'referral claimed';
  assert not public.claim_referral(v_handle), 'referral can only be claimed once';
  assert (select count(*) from public.discount_codes) = 1, 'members see only their own codes';
  assert exists (select 1 from public.notifications where kind = 'welcome_reward'), 'welcome code announced';
end $$;
commit;

-- ─── Discount codes ───────────────────────────────────────────────────
insert into public.discount_codes (code, kind, value, max_uses) values ('TESTPCT', 'percent', 10, 100);
do $$
declare
  v_friend uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_voter  uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_code text := (select code from public.discount_codes where owner_id = 'aaaaaaaa-0000-4000-8000-000000000003');
  v_order uuid;
begin
  assert public.quote_discount('testpct', v_friend, 'retail', 1099) = 109, 'percent code, case-insensitive';
  assert public.quote_discount(v_code, v_friend, 'retail', 1099) = 100, 'welcome code';
  begin
    perform public.quote_discount(v_code, v_voter, 'retail', 1099);
    raise exception 'someone else used a personal code';
  exception when raise_exception then if sqlerrm <> 'code_invalid' then raise; end if;
  end;
  begin
    perform public.quote_discount('NOPE99', v_friend, 'retail', 1099);
    raise exception 'unknown code accepted';
  exception when raise_exception then if sqlerrm <> 'code_invalid' then raise; end if;
  end;

  -- Friend buys a retail winner with the welcome code; payment captured.
  insert into public.orders (user_id, type, ship_to, subtotal, discount, total, discount_code, source)
  values (v_friend, 'retail', '{"name":"Friend","line1":"2 Test St","city":"Chennai","state":"Tamil Nadu","pin":"600001","phone":"9800000003"}',
          1099, 100, 999, v_code, 'whatsapp')
  returning id into v_order;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type)
  values (v_order, (select id from public.designs where slug = 'madras-heat'), 'Ink', 'M', 1, 1099, 'retail');
  update public.orders set status = 'paid', payment_status = 'captured', captured_at = now() where id = v_order;

  assert exists (select 1 from public.discount_redemptions where order_id = v_order and amount = 100), 'redemption recorded';
  begin
    perform public.quote_discount(v_code, v_friend, 'retail', 1099);
    raise exception 'single-use code reused';
  exception when raise_exception then if sqlerrm not in ('code_used_up', 'code_already_used') then raise; end if;
  end;

  -- The inviter is rewarded once the friend's first order is paid.
  assert (select count(*) from public.discount_codes where owner_id = v_voter and code like 'THX-%') = 1, 'inviter got a reward code';
  assert exists (select 1 from public.notifications where user_id = v_voter and kind = 'referral_reward'), 'inviter told';
  assert (select referral_rewarded_at is not null from public.profiles where id = v_friend), 'reward only once';

  -- Delivered → returns and reviews open up.
  insert into public.shipments (order_id, carrier, awb, shipped_at, delivered_at) values (v_order, 'Test', 'AWB1', now() - interval '2 days', now());
  update public.orders set status = 'shipped' where id = v_order;
  update public.orders set status = 'delivered' where id = v_order;
end $$;

-- A released backing gives its code back.
do $$
declare v_order uuid;
begin
  insert into public.orders (user_id, type, ship_to, subtotal, discount, total, discount_code)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'backing', '{"name":"T","line1":"1 Test St","city":"Chennai","state":"TN","pin":"600001","phone":"9800000001"}',
          899, 89, 810, 'TESTPCT') returning id into v_order;
  insert into public.order_items (order_id, design_id, colour, size, qty, unit_price, price_type)
  values (v_order, (select id from public.designs where slug = 'next-up'), 'Acid', 'L', 1, 899, 'backer');
  update public.orders set status = 'backed', payment_status = 'authorized' where id = v_order;
  assert exists (select 1 from public.discount_redemptions where order_id = v_order), 'backing redemption held';
  update public.orders set status = 'released', payment_status = 'released' where id = v_order;
  assert not exists (select 1 from public.discount_redemptions where order_id = v_order), 'released backing frees the code';
end $$;

-- ─── Campaign sources ─────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
do $$ begin
  perform public.cast_vote((select id from public.designs where slug = 'next-up'), 'Instagram');
  assert (select source from public.votes where design_id = (select id from public.designs where slug = 'next-up')) = 'instagram', 'source stored, lower-cased';
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-000000000002', true);
do $$ begin
  assert exists (select 1 from public.artist_source_stats() where source = 'instagram' and votes = 1), 'artist sees votes by source';
end $$;
commit;

-- ─── Waitlist → back by demand ────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
insert into public.design_waitlist (design_id, user_id)
values ((select id from public.designs where slug = 'monsoon-static'), 'aaaaaaaa-0000-4000-8000-000000000001');
do $$ begin
  begin
    insert into public.design_waitlist (design_id, user_id)
    values ((select id from public.designs where slug = 'next-up'), 'aaaaaaaa-0000-4000-8000-000000000001');
    raise exception 'waitlist should only take finished designs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.reopen_design((select id from public.designs where slug = 'monsoon-static'));
    raise exception 'members must not reopen designs';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;

do $$
declare v_id uuid := (select id from public.designs where slug = 'monsoon-static'); q record;
begin
  assert public.waitlist_count(v_id) = 1, 'waitlist counted';
  assert public.reopen_design(v_id) = 1, 'one person told';
  select * into q from public.price_quote(v_id);
  assert q.price = 1099 and q.order_type = 'retail', 'back on sale at retail';
  assert exists (select 1 from public.notifications where kind = 'back_in_stock'), 'waitlist notified';
  assert exists (select 1 from public.notifications where kind = 'back_by_demand'), 'artist told';
  assert (select count(*) from public.notifications n join public.designs g on g.artist_id = n.user_id
          where g.id = v_id and n.kind = 'design_won') = 0, 'reopen is not announced as a win';
  assert public.waitlist_count(v_id) = 0, 'waitlist cleared';
end $$;

-- ─── Returns & exchanges ──────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000003', true);
do $$
declare v_order uuid := (select id from public.orders where user_id = auth.uid() and status = 'delivered');
begin
  begin
    perform public.request_return(v_order, 'exchange', 'size', 'XXXL', null, '{}');
    raise exception 'bad size accepted';
  exception when raise_exception then if sqlerrm <> 'bad_size' then raise; end if;
  end;
  begin
    perform public.request_return(v_order, 'return', 'damaged', null, null, array['https://evil.example/x.jpg']);
    raise exception 'foreign photo accepted';
  exception when raise_exception then if sqlerrm <> 'bad_photo' then raise; end if;
  end;
  perform public.request_return(v_order, 'exchange', 'size', 'XL', 'Too snug', '{}');
  begin
    perform public.request_return(v_order, 'return', 'other', null, null, '{}');
    raise exception 'duplicate request accepted';
  exception when raise_exception then if sqlerrm <> 'already_requested' then raise; end if;
  end;
  assert (select count(*) from public.return_requests) = 1, 'member sees own request';
end $$;
commit;

update public.return_requests set status = 'approved', admin_note = 'Courier pickup booked' where status = 'open';
do $$ begin
  assert exists (select 1 from public.notifications where kind = 'return_approved'), 'member told about approval';
end $$;

-- ─── Reviews ──────────────────────────────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000003', true);
do $$
declare
  v_item uuid := (select i.id from public.order_items i join public.orders o on o.id = i.order_id where o.user_id = auth.uid() and o.status = 'delivered');
  s record;
begin
  perform public.post_review(v_item, 5, 'true', 'Print is crisp',
    array['https://abc.supabase.co/storage/v1/object/public/posts/aaaaaaaa-0000-4000-8000-000000000003/fit.jpg']);
  perform public.post_review(v_item, 4, 'small', 'Edited: runs a bit small', '{}');
  select * into s from public.design_review_summary((select id from public.designs where slug = 'madras-heat'));
  assert s.reviews = 1 and s.avg_rating = 4.0 and s.runs_small = 1, 'one review per item, editable';
  begin
    perform public.post_review(v_item, 5, null, null, array['https://abc.supabase.co/storage/v1/object/public/posts/someone-else/x.jpg']);
    raise exception 'foreign photo accepted';
  exception when raise_exception then if sqlerrm <> 'bad_photo' then raise; end if;
  end;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
do $$ begin
  begin
    perform public.post_review((select id from public.order_items limit 1), 5, null, null, '{}');
    raise exception 'reviewed someone else''s order';
  exception when raise_exception then if sqlerrm not in ('item_not_found', 'not_delivered') then raise; end if;
  end;
  assert (select count(*) from public.reviews) = 1, 'reviews are public';
end $$;
commit;

select 'all growth tests passed' as result;
