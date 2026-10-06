-- INKPULSE · DEMO DATA for local development and staging.
-- Do NOT run on production. Every person, cause partner and amount here is sample data.

-- Demo artists (cannot sign in: no password, no phone).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.email, '', now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(), '', '', '', ''
from (values
  ('11111111-1111-4111-8111-000000000001', 'marghazhi@demo.inkpulse.in',  'Meenakshi R'),
  ('11111111-1111-4111-8111-000000000002', 'ironcondor@demo.inkpulse.in', 'Arjun V'),
  ('11111111-1111-4111-8111-000000000003', 'strikeprice@demo.inkpulse.in','Sana K'),
  ('11111111-1111-4111-8111-000000000004', 'grafik@demo.inkpulse.in',     'Gokul P'),
  ('11111111-1111-4111-8111-000000000005', 'decoction@demo.inkpulse.in',  'Divya S'),
  ('11111111-1111-4111-8111-000000000006', 'whitespace@demo.inkpulse.in', 'Wasim A')
) as u(id, email, name);

update public.profiles p set handle = v.handle, is_artist = true, bio = v.bio, location = v.loc
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'marghazhi',   'Kolam grids, temple geometry, Margazhi mornings.', 'Chennai'),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'ironcondor',  'Options trader by day. Candle charts by night.',     'Mumbai'),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'strikeprice', 'One-line curves about time and money.',             'Chennai'),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'grafik',      'Noise, rain, static.',                              'Bengaluru'),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'decoction',   'Filter coffee propaganda.',                         'Madurai'),
  ('11111111-1111-4111-8111-000000000006'::uuid, 'whitespace',  'Less, but louder.',                                 'Pune')
) as v(id, handle, bio, loc)
where p.id = v.id;

insert into public.partners (id, name, registration_no, verified) values
  ('22222222-2222-4222-8222-000000000001', 'Sample Partner Trust (replace)', '[REG NO]', true);

insert into public.causes (id, name, description, partner_id) values
  ('33333333-3333-4333-8333-000000000001', 'Restore a Chennai lake', 'Desilting, bund repair and native planting around an urban lake.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000002', 'School libraries, Tamil Nadu', 'Books and shelving for government schools.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000003', 'Stray animal care, Chennai', 'Vaccination and sterilisation drives.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000004', 'Coastal clean-up, ECR', 'Beach clean-ups and plastic recovery.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000005', 'Flood relief kits, Velachery', 'Emergency kits after the monsoon floods.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000006', 'Girls'' coding clubs, Madurai', 'Laptops and mentors for after-school clubs.', '22222222-2222-4222-8222-000000000001'),
  ('33333333-3333-4333-8333-000000000007', 'Mangrove saplings, Pichavaram', 'Planting and protecting mangrove saplings.', '22222222-2222-4222-8222-000000000001');

-- Three finished drops + the live one. Times are relative so the demo always has an open vote.
insert into public.drops (id, number, status, opens_at, locks_at, prints_at, cause_id, opened_at, locked_at, printed_at, shipped_at) values
  ('44444444-4444-4444-8444-000000000039', 39, 'shipped', now() - interval '25 days', now() - interval '21 days', now() - interval '20 days', '33333333-3333-4333-8333-000000000007', now() - interval '25 days', now() - interval '21 days', now() - interval '20 days', now() - interval '17 days'),
  ('44444444-4444-4444-8444-000000000040', 40, 'shipped', now() - interval '18 days', now() - interval '14 days', now() - interval '13 days', '33333333-3333-4333-8333-000000000006', now() - interval '18 days', now() - interval '14 days', now() - interval '13 days', now() - interval '10 days'),
  ('44444444-4444-4444-8444-000000000041', 41, 'shipped', now() - interval '11 days', now() - interval '7 days',  now() - interval '6 days',  '33333333-3333-4333-8333-000000000005', now() - interval '11 days', now() - interval '7 days',  now() - interval '6 days',  now() - interval '3 days'),
  ('44444444-4444-4444-8444-000000000042', 42, 'live',    now() - interval '1 day',   now() + interval '2 days 14 hours', now() + interval '3 days', '33333333-3333-4333-8333-000000000001', now() - interval '1 day', null, null, null);

insert into public.cause_shortlist (drop_id, cause_id) values
  ('44444444-4444-4444-8444-000000000042', '33333333-3333-4333-8333-000000000002'),
  ('44444444-4444-4444-8444-000000000042', '33333333-3333-4333-8333-000000000003'),
  ('44444444-4444-4444-8444-000000000042', '33333333-3333-4333-8333-000000000004');

insert into public.designs (slug, artist_id, drop_id, name, story, category, tags, colours, art_front_url, perk, originality_confirmed, status, vote_count, count_reached_at) values
  ('kolam-grid', '11111111-1111-4111-8111-000000000001', '44444444-4444-4444-8444-000000000042', 'Kolam Grid',
   'The pulli grid is hand-drawn from my grandmother''s Margazhi kolam notebook.', 'Tamil heritage', '{kolam,geometry}',
   '[{"name":"Bone","hex":"#EFE4CC"},{"name":"Ink black","hex":"#1A1A1A","art":"/seed/kolam-light.svg"}]', '/seed/kolam.svg', 'Signed print card for backers before 5K', true, 'live', 6120, now() - interval '3 hours'),
  ('expiry-thursday', '11111111-1111-4111-8111-000000000002', '44444444-4444-4444-8444-000000000042', 'Expiry Thursday',
   'For everyone who has watched a weekly expiry at 3:29 pm.', 'Trader culture', '{options,fno}',
   '[{"name":"Ink black","hex":"#1A1A1A"}]', '/seed/expiry.svg', null, true, 'live', 5874, now() - interval '2 hours'),
  ('theta-decay', '11111111-1111-4111-8111-000000000003', '44444444-4444-4444-8444-000000000042', 'Theta Decay',
   'Every option seller knows the feeling: the clock is the only thing working for you.', 'Trader culture', '{options,minimal}',
   '[{"name":"Acid","hex":"#E4FF3B"},{"name":"Ink black","hex":"#1A1A1A","art":"/seed/theta-light.svg"},{"name":"Bone","hex":"#EFE4CC"}]', '/seed/theta.svg', 'Signed print card for backers before 5K', true, 'live', 4310, now() - interval '1 hour'),
  ('monsoon-static', '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000042', 'Monsoon Static',
   'Rain on a tin roof, drawn as noise.', 'Streetwear', '{rain,type}',
   '[{"name":"Forest","hex":"#2C3833"}]', '/seed/monsoon.svg', null, true, 'live', 3902, now() - interval '5 hours'),
  ('filter-kaapi-club', '11111111-1111-4111-8111-000000000005', '44444444-4444-4444-8444-000000000042', 'Filter Kaapi Club',
   'Decoction first. Everything else later.', 'Tamil heritage', '{coffee,madras}',
   '[{"name":"White","hex":"#F7F7F5"}]', '/seed/kaapi.svg', null, true, 'live', 2215, now() - interval '6 hours'),
  ('quiet-margin', '11111111-1111-4111-8111-000000000006', '44444444-4444-4444-8444-000000000042', 'Quiet Margin',
   'A left-chest whisper for loud weeks.', 'Minimal', '{minimal,type}',
   '[{"name":"Fog","hex":"#C9C6D6"}]', '/seed/margin.svg', null, true, 'live', 1830, now() - interval '8 hours'),
  -- A winner from drop 41, now on sale at retail price.
  ('madras-heat', '11111111-1111-4111-8111-000000000004', '44444444-4444-4444-8444-000000000041', 'Madras Heat',
   '42°C in May, drawn as a sun that refuses to set.', 'Streetwear', '{sun,madras}',
   '[{"name":"Bone","hex":"#EFE4CC"}]', '/seed/sun.svg', null, true, 'won', 5410, now() - interval '8 days');

update public.designs set final_rank = 1, retail_until = now() + interval '8 days' where slug = 'madras-heat';

insert into public.cause_payouts (drop_id, cause_id, net_profit, amount, utr, paid_at, published) values
  ('44444444-4444-4444-8444-000000000039', '33333333-3333-4333-8333-000000000007', 120000, 18000, 'DEMO-UTR-039', now() - interval '15 days', true),
  ('44444444-4444-4444-8444-000000000040', '33333333-3333-4333-8333-000000000006', 146000, 21900, 'DEMO-UTR-040', now() - interval '8 days', true),
  ('44444444-4444-4444-8444-000000000041', '33333333-3333-4333-8333-000000000005', 98000, 14700, 'DEMO-UTR-041', now() - interval '1 day', true);

insert into public.posts (author_id, kind, body, design_id, like_count, comment_count, created_at)
select '11111111-1111-4111-8111-000000000003', 'artist',
       '690 votes from locking the early-backer price. Everyone who backs before 5K gets a signed print card in the box.',
       id, 412, 58, now() - interval '14 minutes' from public.designs where slug = 'theta-decay';
insert into public.posts (author_id, kind, body, like_count, comment_count, created_at) values
  ('11111111-1111-4111-8111-000000000001', 'artist',
   'Thank you to the first 5,000. The pulli grid is hand-drawn from my grandmother''s Margazhi kolam notebook.', 1204, 143, now() - interval '1 hour');
insert into public.posts (kind, body, created_at) values
  ('system', 'KOLAM GRID HIT 5,000. Early-backer price is now closed.', now() - interval '2 minutes'),
  ('system', 'DROP 042 IS LIVE. Voting locks Thursday. Back early to lock ₹899.', now() - interval '1 day');

-- Test mode: let email sign-ins vote until an SMS provider is configured.
update public.settings set require_phone_for_votes = false;

-- Schedule drop 43 so the Monday job has something to open.
select public.ensure_next_drop();
