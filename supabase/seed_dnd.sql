-- The DND Club · DEMO CATALOGUE for staging and previews (SEED_DEMO=true).
-- Do NOT run on production. Artists, designs and numbers are sample data from the store design.
-- Times are relative to now, so the demo always has a live battle and an open topic.

-- ─── Demo artists (cannot sign in: no password, no phone) ─────────────
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select u.id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', u.handle || '@demo.thedndclub.in', '', now(),
       '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.name), now(), now(), '', '', '', ''
from (values
  ('d0000000-0000-4000-8000-000000000001', 'nilofer',     'Nilofer S.'),
  ('d0000000-0000-4000-8000-000000000002', 'meera',       'Meera D.'),
  ('d0000000-0000-4000-8000-000000000003', 'aarav',       'Aarav S.'),
  ('d0000000-0000-4000-8000-000000000004', 'lakshmi',     'Lakshmi P.'),
  ('d0000000-0000-4000-8000-000000000005', 'dev',         'Dev R.'),
  ('d0000000-0000-4000-8000-000000000006', 'karthik',     'Karthik M.'),
  ('d0000000-0000-4000-8000-000000000007', 'studio_puli', 'Studio Puli'),
  ('d0000000-0000-4000-8000-000000000008', 'riya',        'Riya K.'),
  ('d0000000-0000-4000-8000-000000000009', 'aman',        'Aman Narang'),
  ('d0000000-0000-4000-8000-000000000010', 'neel',        'Neel Bose'),
  ('d0000000-0000-4000-8000-000000000011', 'faiz',        'Faiz A.'),
  ('d0000000-0000-4000-8000-000000000012', 'anushka',     'Anushka T.'),
  ('d0000000-0000-4000-8000-000000000013', 'joel',        'Joel M.')
) as u(id, handle, name);

update public.profiles p set handle = v.handle, is_artist = true, location = v.city, tagline = v.tagline, styles = v.styles, bio = v.bio,
  avatar_url = case when v.photo then '/dnd/artist-' || replace(v.handle, '_', '-') || '.jpg' end,
  cover_url  = case when v.photo then '/dnd/cover-' || replace(v.handle, '_', '-') || '.jpg' end
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, 'nilofer', 'Chennai', 'TYPOGRAPHY + CULTURE', '{Typography}'::text[], 'I draw loud little love letters to the streets, signs and sounds I grew up around.', true),
  ('d0000000-0000-4000-8000-000000000002', 'meera', 'Kochi', 'ILLUSTRATION + WEATHER', '{Illustration}', 'Monsoon kid. I paint clouds, coconut trees and everything that smells like wet earth.', true),
  ('d0000000-0000-4000-8000-000000000003', 'aarav', 'Jaipur', 'FOLK ART + NOISE', '{Illustration}', 'Rajasthani folk motifs, run through a broken photocopier and a lot of chai.', true),
  ('d0000000-0000-4000-8000-000000000004', 'lakshmi', 'Madurai', 'TEMPLES + GRIDS', '{Illustration,Typography}', 'Architecture student who sees a design system in every gopuram.', true),
  ('d0000000-0000-4000-8000-000000000005', 'dev', 'Mumbai', 'RADIO + STREET TYPE', '{Typography}', 'Hand-painted signs, local trains and the radio that never switches off.', true),
  ('d0000000-0000-4000-8000-000000000006', 'karthik', 'Hyderabad', 'SOFT SHAPES + LOUD IDEAS', '{Illustration}', 'Overthinker by day, overthinker by night. I draw what my head sounds like.', true),
  ('d0000000-0000-4000-8000-000000000007', 'studio_puli', 'Chennai', 'TWO-PERSON STUDIO', '{Illustration,Typography}', 'A tiny studio obsessed with filter coffee, tigers and bold two-colour prints.', true),
  ('d0000000-0000-4000-8000-000000000008', 'riya', 'Bengaluru', 'SLEEPY TYPE', '{Typography}', 'Designer, professional snoozer. Making type that feels like a Sunday morning.', true),
  ('d0000000-0000-4000-8000-000000000009', 'aman', 'Delhi', 'PUDDLES + PORTALS', '{Illustration}', 'Illustrator who thinks every puddle is a portal.', false),
  ('d0000000-0000-4000-8000-000000000010', 'neel', 'Kolkata', 'TRAMS + ROOFTOPS', '{Illustration}', 'Kolkata rooftops, tram lines and jhalmuri after the storm.', false),
  ('d0000000-0000-4000-8000-000000000011', 'faiz', 'Lucknow', 'NOSTALGIA + NEON', '{Typography}', 'Power cuts, antakshari and neon signs from the old city.', false),
  ('d0000000-0000-4000-8000-000000000012', 'anushka', 'Pune', 'BOTANICAL TYPE', '{Illustration}', 'Botanical studies of things that do not have leaves.', false),
  ('d0000000-0000-4000-8000-000000000013', 'joel', 'Shillong', 'HILL-TOWN LIGHT', '{Illustration}', 'Hill-town streets, rain and reflections.', false)
) as v(id, handle, city, tagline, styles, bio, photo)
where p.id = v.id;

-- ─── Drops: five finished, one live battle, one in review, one taking submissions ─
insert into public.drops (id, number, status, opens_at, locks_at, prints_at, topic_at, submissions_close_at, topic_announced_at, opened_at, locked_at, printed_at, shipped_at) values
  ('d4000000-0000-4000-8000-000000000039', 39, 'shipped',  now() - interval '35 days', now() - interval '32 days', now() - interval '31 days', now() - interval '49 days', now() - interval '39 days', now() - interval '49 days', now() - interval '35 days', now() - interval '32 days', now() - interval '31 days', now() - interval '28 days'),
  ('d4000000-0000-4000-8000-000000000040', 40, 'shipped',  now() - interval '28 days', now() - interval '25 days', now() - interval '24 days', now() - interval '42 days', now() - interval '32 days', now() - interval '42 days', now() - interval '28 days', now() - interval '25 days', now() - interval '24 days', now() - interval '21 days'),
  ('d4000000-0000-4000-8000-000000000041', 41, 'shipped',  now() - interval '21 days', now() - interval '18 days', now() - interval '17 days', now() - interval '35 days', now() - interval '25 days', now() - interval '35 days', now() - interval '21 days', now() - interval '18 days', now() - interval '17 days', now() - interval '14 days'),
  ('d4000000-0000-4000-8000-000000000042', 42, 'shipped',  now() - interval '14 days', now() - interval '11 days', now() - interval '10 days', now() - interval '28 days', now() - interval '18 days', now() - interval '28 days', now() - interval '14 days', now() - interval '11 days', now() - interval '10 days', now() - interval '7 days'),
  ('d4000000-0000-4000-8000-000000000043', 43, 'printing', now() - interval '7 days',  now() - interval '4 days',  now() - interval '3 days',  now() - interval '21 days', now() - interval '11 days', now() - interval '21 days', now() - interval '7 days',  now() - interval '4 days',  now() - interval '3 days',  null),
  ('d4000000-0000-4000-8000-000000000044', 44, 'live',     now() - interval '1 day',   now() + interval '2 days 11 hours', now() + interval '3 days', now() - interval '15 days', now() - interval '5 days', now() - interval '15 days', now() - interval '1 day', null, null, null),
  ('d4000000-0000-4000-8000-000000000045', 45, 'scheduled', now() + interval '6 days', now() + interval '9 days 11 hours', now() + interval '10 days', now() - interval '8 days', now() - interval '2 hours', now() - interval '8 days', null, null, null, null),
  ('d4000000-0000-4000-8000-000000000046', 46, 'scheduled', now() + interval '13 days', now() + interval '16 days 11 hours', now() + interval '17 days', now() - interval '1 day', now() + interval '8 days', now() - interval '1 day', null, null, null, null);

insert into public.drop_topics (drop_id, title, brief, prompts) values
  ('d4000000-0000-4000-8000-000000000039', 'Morning Rituals', 'Filter coffee, newspaper, the first bus.', '{}'),
  ('d4000000-0000-4000-8000-000000000040', 'Home Frequency', 'The sounds and signals of home.', '{}'),
  ('d4000000-0000-4000-8000-000000000041', 'Good Trouble', 'Small rebellions, polite chaos.', '{}'),
  ('d4000000-0000-4000-8000-000000000042', 'Street Signals', 'Signboards, radio dials and the city talking back.', '{}'),
  ('d4000000-0000-4000-8000-000000000043', 'Future Folklore', 'Old stories, new machines.', '{}'),
  ('d4000000-0000-4000-8000-000000000044', 'Monsoon Mood', 'Design the feeling between the first cloud and the last chai.', '{"Rain on a bus window","Paper boats in a gutter","Power cuts","Puddle reflections"}'),
  ('d4000000-0000-4000-8000-000000000045', 'Night Shift', 'The city after midnight: chai stalls, call centres, empty flyovers.', '{}'),
  ('d4000000-0000-4000-8000-000000000046', 'Beautiful Chaos', 'Find the systems inside the mess: traffic, tangled wires, family group chats, local markets, a desk at 2 AM.',
   '{"Traffic as a pattern","Tangled wires","Family group chat","A desk at 2 AM"}');

-- ─── Winners on sale ──────────────────────────────────────────────────
insert into public.designs (slug, artist_id, drop_id, name, story, category, mood, fit, colours, collections, photo_urls, art_front_url,
                            care_label, badge, originality_confirmed, status, vote_count, final_rank, retail_until, count_reached_at)
select w.slug, w.artist::uuid, ('d4000000-0000-4000-8000-0000000000' || w.drop)::uuid, w.name, w.story, w.mood, w.mood, w.fit,
       (select jsonb_agg(jsonb_build_object('name', c.name, 'hex', c.hex) order by o.n)
        from unnest(w.colours) with ordinality as o(k, n)
        join (values ('black', 'Washed Black', '#1b1a1f'), ('cream', 'Moon Cream', '#F4ECDD'), ('purple', 'DND Purple', '#6C4BFF'),
                     ('navy', 'Night Navy', '#16123A'), ('yellow', 'Moon Yellow', '#FFD23F')) as c(k, name, hex) on c.k = o.k),
       w.collections,
       array['/dnd/' || w.slug || '-1.jpg', '/dnd/' || w.slug || '-2.jpg', '/dnd/' || w.slug || '-3.jpg', '/dnd/' || w.slug || '-4.jpg'],
       '/dnd/' || w.slug || '-3.jpg', w.care, w.badge, true, 'won', w.votes, w.rank, now() + interval '60 days', now() - interval '20 days'
from (values
  ('midnight-auto',   'd0000000-0000-4000-8000-000000000001', '43', 'Midnight Auto',   'The auto stand outside Central station at 2 AM: neon, chai steam and a driver who never sleeps.', 'Night Owl',      'Oversized',    '{black,navy,purple}'::text[], '{new,bestsellers}'::text[], 'DO NOT DRY-CLEAN', 'WINNER · DROP 043', 6204, 1),
  ('kaapi-futures',   'd0000000-0000-4000-8000-000000000001', '41', 'Kaapi Futures',   'A stock ticker for filter coffee. Decoction is up, chicory is volatile, sugar is a hedge.',      'Desi Drip',      'Classic Crew', '{cream,black}',               '{bestsellers}',             'DO NOT SPILL',     'BESTSELLER',        5102, 1),
  ('folk-static',     'd0000000-0000-4000-8000-000000000003', '42', 'Folk Static',     'Phad painting meets a TV with no signal. The heroes are still on screen, just a little fuzzy.',  'Main Character', 'Oversized',    '{cream,yellow}',              '{new}',                     'DO NOT DUPE',      'WINNER · DROP 042', 4870, 1),
  ('soft-riot',       'd0000000-0000-4000-8000-000000000006', '40', 'Soft Riot',       'A protest where every placard is a polite suggestion. Loud ideas, gentle shapes.',              'Overthinker',    'Boxy Crop',    '{purple,cream}',              '{bestsellers}',             'DO NOT OVERTHINK', 'BESTSELLER',        4433, 1),
  ('gopuram-grid',    'd0000000-0000-4000-8000-000000000004', '41', 'Gopuram Grid',    'The Meenakshi temple tower, rebuilt as a modular grid of tiny gods and tidy squares.',           'Desi Drip',      'Relaxed Fit',  '{yellow,black}',              '{new}',                     'DO NOT DISTURB',   'WINNER · DROP 041', 4310, 2),
  ('local-frequency', 'd0000000-0000-4000-8000-000000000005', '42', 'Local Frequency', 'The Vividh Bharati dial, hand-painted like a Bombay shop sign. Tune in, zone out.',               'Silent Mode',    'Classic Crew', '{navy,cream}',                '{}',                        'DO NOT MUTE',      'TRENDING',          4012, 2),
  ('snooze-button',   'd0000000-0000-4000-8000-000000000008', '43', 'Snooze Button',   'Five more minutes, rendered in very serious type. For people who negotiate with alarms.',         'Snooze Mode',    'Oversized',    '{purple,navy,cream}',         '{new}',                     'DO NOT WAKE',      'NEW',               3870, 2),
  ('filter-club',     'd0000000-0000-4000-8000-000000000007', '39', 'Filter Club',     'A members-only crest for people who take their filter coffee strong and their mornings slow.',    'Desi Drip',      'Boxy Crop',    '{cream,black,yellow}',        '{back-in-stock,bestsellers}', 'DO NOT DILUTE',  'BACK IN STOCK',     3655, 1)
) as w(slug, artist, drop, name, story, mood, fit, colours, collections, care, badge, votes, rank);

-- ─── This week's battle: Monsoon Mood ─────────────────────────────────
insert into public.designs (slug, artist_id, drop_id, submitted_for, name, story, category, mood, fit, colours, photo_urls, mockup_url, art_front_url,
                            originality_confirmed, status, vote_count, backer_count, count_reached_at)
select f.slug, f.artist::uuid, 'd4000000-0000-4000-8000-000000000044', 'd4000000-0000-4000-8000-000000000044', f.name, f.story, 'Monsoon Mood', 'Monsoon Mood', 'Oversized',
       '[{"name":"Washed Black","hex":"#1b1a1f"},{"name":"Moon Cream","hex":"#F4ECDD"},{"name":"DND Purple","hex":"#6C4BFF"},{"name":"Night Navy","hex":"#16123A"}]',
       case when f.slug = 'puddle-theory' then array['/dnd/puddle-theory-1.jpg', '/dnd/puddle-theory-2.jpg', '/dnd/puddle-theory-3.jpg', '/dnd/puddle-theory-4.jpg']
            else array['/dnd/' || f.slug || '.jpg'] end,
       case when f.slug = 'puddle-theory' then '/dnd/puddle-theory-1.jpg' else '/dnd/' || f.slug || '.jpg' end,
       case when f.slug = 'puddle-theory' then '/dnd/puddle-theory-1.jpg' else '/dnd/' || f.slug || '.jpg' end,
       true, 'live', f.votes, f.backers, now() - make_interval(mins => f.votes % 600)
from (values
  ('cloudburst-club', 'd0000000-0000-4000-8000-000000000002', 'Cloudburst Club', 'A members-only club for people who run outside when it starts pouring.', 4382, 612),
  ('puddle-theory',   'd0000000-0000-4000-8000-000000000009', 'Puddle Theory',   'Every puddle is a portal. Some lead to school, most lead to trouble.',  4106, 540),
  ('after-the-rain',  'd0000000-0000-4000-8000-000000000010', 'After the Rain',  'Tram lines, wet rooftops and the first hot jhalmuri after a storm.',   3840, 498),
  ('chai-weather',    'd0000000-0000-4000-8000-000000000007', 'Chai Weather',    'The official forecast: 100% chance of chai, scattered pakoras.',         3661, 455),
  ('wiper-blues',     'd0000000-0000-4000-8000-000000000008', 'Wiper Blues',     'A love song for the bus driver whose wipers keep perfect time.',         3214, 388),
  ('power-cut',       'd0000000-0000-4000-8000-000000000011', 'Power Cut',       'Candles, antakshari and the collective cheer when the fan comes back on.', 2980, 301),
  ('petrichor',       'd0000000-0000-4000-8000-000000000012', 'Petrichor',       'A botanical study of the smell of first rain, if smells had leaves.',    2702, 276),
  ('wet-streets',     'd0000000-0000-4000-8000-000000000013', 'Wet Streets',     'Hill-town streets that turn into mirrors for an hour every evening.',    2415, 230)
) as f(slug, artist, name, story, votes, backers);

-- Test mode: let email sign-ins vote until an SMS provider is configured.
update public.settings set require_phone_for_votes = false;
