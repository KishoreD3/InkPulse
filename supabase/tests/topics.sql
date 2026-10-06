-- INKPULSE · topic cycle tests (run after smoke.sql + growth.sql).
\set ON_ERROR_STOP on

-- ─── Timing of the pipeline ───────────────────────────────────────────
do $$
declare d44 public.drops; d45 public.drops;
begin
  select * into d44 from public.drops where number = 44;
  select * into d45 from public.drops where number = 45;
  assert d45.id is not null, 'opening a drop keeps two scheduled ahead';
  assert d45.opens_at = d44.opens_at + interval '7 days', 'drops are a week apart';
  assert extract(isodow from d44.topic_at at time zone 'Asia/Kolkata') = 1
     and to_char(d44.topic_at at time zone 'Asia/Kolkata', 'HH24:MI') = '10:00', 'topic published Monday 10:00 IST';
  assert d44.opens_at - d44.topic_at = interval '13 days 14 hours', 'topic two weeks ahead of voting';
  assert extract(isodow from d44.submissions_close_at at time zone 'Asia/Kolkata') = 3
     and to_char(d44.submissions_close_at at time zone 'Asia/Kolkata', 'HH24:MI') = '23:59', 'submissions close Wednesday 23:59 IST';
end $$;

-- Topics stay secret until their publish time.
update public.drops set topic_at = now() + interval '1 day', submissions_close_at = now() + interval '3 days' where number = 45;
insert into public.drop_topics (drop_id, title, brief) select id, 'Secret Theme', 'Shh' from public.drops where number = 45;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
do $$ begin
  assert not exists (select 1 from public.drop_topics where title = 'Secret Theme'), 'future topic hidden';
  assert exists (select 1 from public.drop_topics where title = 'Monsoon Mood'), 'published topic visible';
end $$;
commit;

-- ─── Submissions answer an open topic ─────────────────────────────────
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-000000000002', true);
do $$
declare v45 uuid := (select id from public.drops where number = 45);
begin
  insert into public.designs (slug, artist_id, name, category, art_front_url, status)
  values ('a-draft', auth.uid(), 'A Draft', 'Minimal', '/x.png', 'draft');           -- drafts need no topic
  begin
    insert into public.designs (slug, artist_id, name, category, art_front_url, status)
    values ('no-topic', auth.uid(), 'No Topic', 'Minimal', '/x.png', 'in_review');
    raise exception 'submitted without a topic';
  exception when raise_exception then if sqlerrm <> 'topic_required' then raise; end if;
  end;
  begin
    insert into public.designs (slug, artist_id, name, category, art_front_url, status, submitted_for)
    values ('too-early', auth.uid(), 'Too Early', 'Minimal', '/x.png', 'in_review', v45);
    raise exception 'submitted before the topic was published';
  exception when raise_exception then if sqlerrm <> 'topic_closed' then raise; end if;
  end;
end $$;
commit;

update public.drops set topic_at = now() - interval '1 hour' where number = 45;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-000000000002', true);
do $$
declare v45 uuid := (select id from public.drops where number = 45);
begin
  insert into public.designs (slug, artist_id, name, category, art_front_url, status, submitted_for)
  values ('rain-one', auth.uid(), 'Rain One', 'Minimal', '/x.png', 'in_review', v45),
         ('rain-two', auth.uid(), 'Rain Two', 'Minimal', '/x.png', 'in_review', v45);
  begin
    insert into public.designs (slug, artist_id, name, category, art_front_url, status, submitted_for)
    values ('rain-three', auth.uid(), 'Rain Three', 'Minimal', '/x.png', 'in_review', v45);
    raise exception 'went over the per-artist limit';
  exception when raise_exception then if sqlerrm not like 'topic_limit%' then raise; end if;
  end;
  assert public.topic_submission_count(v45) = 2, 'public submission count';
end $$;
commit;

-- After the close, submitted designs can't be edited and nothing new can be sent.
update public.drops set submissions_close_at = now() - interval '1 minute', topic_at = now() - interval '2 days' where number = 45;
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-000000000002', true);
do $$ begin
  begin
    update public.designs set name = 'Rain One Edited' where slug = 'rain-one';
    raise exception 'edited after the close';
  exception when raise_exception then if sqlerrm <> 'topic_closed' then raise; end if;
  end;
  update public.designs set status = 'withdrawn' where slug = 'rain-two';  -- withdrawing is always allowed
end $$;
commit;

-- ─── Announcements ────────────────────────────────────────────────────
update public.drops set topic_at = now() - interval '1 hour', submissions_close_at = now() + interval '10 hours', topic_announced_at = null
where number = 45;
do $$ begin
  assert public.publish_due_topics() >= 1, 'topic announced';
  assert exists (select 1 from public.posts where body like 'NEW TOPIC · DROP 045: SECRET THEME%'), 'system post';
  assert exists (select 1 from public.notifications n join public.profiles p on p.id = n.user_id where n.kind = 'topic_live' and p.is_artist), 'artists notified';
  assert public.publish_due_topics() = 0, 'announced once';
  assert public.remind_closing_topics() = 1, 'closing reminder sent';
  assert not exists (select 1 from public.notifications where kind = 'topic_closing' and user_id = '11111111-1111-4111-8111-000000000002'),
    'artists who already submitted are not nagged';
  assert exists (select 1 from public.notifications where kind = 'topic_closing'), 'others reminded';
end $$;

select 'all topic tests passed' as result;
