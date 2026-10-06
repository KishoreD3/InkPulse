-- INKPULSE · topic-led drops.
-- Every drop has a topic, published well ahead so artists can answer it:
--
--   Mon 10:00 (2 weeks before)   topic published, submissions open
--   Wed 23:59 (5 days before)    submissions close
--   Thu → Sun                    review
--   Mon 00:00                    voting opens   (drop goes live)
--   Thu 23:59                    voting locks
--   Fri 10:00                    top designs print
--
-- A new topic goes up every Monday, so three drops are always in flight:
-- one voting, one in submissions/review, one whose topic was just published.

alter table public.settings
  add column topic_lead_days int  not null default 14 check (topic_lead_days between 7 and 42),  -- topic published this many days before voting opens
  add column review_days     int  not null default 4  check (review_days between 1 and 10),      -- days between submissions closing and voting opening
  add column topic_time      time not null default '10:00',                                       -- IST time the topic goes up
  add check (topic_lead_days >= review_days + 3);

alter table public.drops
  add column topic_at              timestamptz,
  add column submissions_close_at  timestamptz,
  add column topic_announced_at    timestamptz,
  add column close_reminder_at     timestamptz;

-- Topic and submission dates are derived from the voting date unless set explicitly.
create or replace function public.drops_fill_cycle() returns trigger
language plpgsql as $$
declare v_s public.settings;
begin
  select * into v_s from public.settings;
  if new.topic_at is null then
    new.topic_at := (((new.opens_at at time zone 'Asia/Kolkata')::date - v_s.topic_lead_days) + v_s.topic_time) at time zone 'Asia/Kolkata';
  end if;
  if new.submissions_close_at is null then
    new.submissions_close_at := ((((new.opens_at at time zone 'Asia/Kolkata')::date - v_s.review_days))::timestamp - interval '1 minute') at time zone 'Asia/Kolkata';
  end if;
  return new;
end $$;

create trigger drops_cycle before insert on public.drops for each row execute function public.drops_fill_cycle();

update public.drops d set
  topic_at = (((d.opens_at at time zone 'Asia/Kolkata')::date - s.topic_lead_days) + s.topic_time) at time zone 'Asia/Kolkata',
  submissions_close_at = ((((d.opens_at at time zone 'Asia/Kolkata')::date - s.review_days))::timestamp - interval '1 minute') at time zone 'Asia/Kolkata',
  topic_announced_at = case when d.status <> 'scheduled' then d.opens_at end
from public.settings s;

alter table public.drops
  alter column topic_at set not null,
  alter column submissions_close_at set not null,
  add constraint drops_cycle_order check (topic_at < submissions_close_at and submissions_close_at <= opens_at);

-- ─── Topics ───────────────────────────────────────────────────────────
create table public.drop_topics (
  drop_id     uuid primary key references public.drops (id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 60),
  brief       text check (char_length(brief) <= 1000),
  prompts     text[] not null default '{}' check (cardinality(prompts) <= 6),   -- "try:" sparks for artists
  image_url   text,
  updated_at  timestamptz not null default now()
);
create trigger drop_topics_touch before update on public.drop_topics for each row execute function public.touch_updated_at();

alter table public.drop_topics enable row level security;
revoke insert, update, delete on public.drop_topics from anon, authenticated;
-- Topics stay secret until their publish time.
create policy topics_read on public.drop_topics for select using (
  public.is_admin() or exists (select 1 from public.drops d where d.id = drop_id and d.topic_at <= now()));

-- ─── Submissions answer a topic ───────────────────────────────────────
alter table public.designs add column submitted_for uuid references public.drops (id) on delete set null;
create index designs_submitted_for_idx on public.designs (submitted_for, status);
grant insert (submitted_for), update (submitted_for) on public.designs to authenticated;

-- Members can only send a design for review while its topic is open, and only up to the per-artist limit.
-- Admins and the scheduler (service role / direct sessions) are not restricted.
create or replace function public.designs_check_topic() returns trigger
language plpgsql as $$
declare
  v_drop public.drops;
  v_limit int;
  v_n int;
begin
  if coalesce(nullif(current_setting('role', true), 'none'), '') <> 'authenticated' then return new; end if;
  if not public.is_artist() then return new; end if;            -- row security rejects these
  if new.status <> 'in_review' then return new; end if;          -- drafts and withdrawals are always fine

  if new.submitted_for is null then raise exception 'topic_required' using errcode = 'P0001'; end if;
  select * into v_drop from public.drops where id = new.submitted_for;
  if not found or v_drop.status <> 'scheduled' or now() < v_drop.topic_at or now() >= v_drop.submissions_close_at then
    raise exception 'topic_closed' using errcode = 'P0001';
  end if;
  select max_designs_per_artist into v_limit from public.settings;
  select count(*) into v_n from public.designs
  where artist_id = new.artist_id and submitted_for = new.submitted_for and id <> new.id
    and status in ('in_review', 'changes_requested', 'approved', 'live', 'won', 'lost');
  if v_n >= v_limit then raise exception 'topic_limit:%', v_limit using errcode = 'P0001'; end if;
  return new;
end $$;

create trigger designs_topic before insert or update of status, submitted_for, name, story, art_front_url, art_back_url, colours
  on public.designs for each row execute function public.designs_check_topic();

-- How many designs are answering a topic (public, counts only).
create or replace function public.topic_submission_count(p_drop uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.designs
  where submitted_for = p_drop and status in ('in_review', 'changes_requested', 'approved', 'live', 'won', 'lost');
$$;
grant execute on function public.topic_submission_count(uuid) to anon, authenticated;

-- ─── A rolling pipeline: always two drops scheduled ahead ─────────────
-- Each new drop opens on the Monday after the latest one, but never so soon that
-- its topic, submission and review windows would be squeezed.
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
    -- earliest Monday that still leaves the full runway (one day of slack for scheduler delay)
    v_min := date_trunc('week', v_now + make_interval(days => v_s.topic_lead_days - 1));
    if v_min < v_now + make_interval(days => v_s.topic_lead_days - 1) then v_min := v_min + interval '7 days'; end if;
    v_monday := greatest(coalesce(date_trunc('week', v_last at time zone 'Asia/Kolkata') + interval '7 days', v_min), v_min);
    select coalesce(max(number), 0) + 1 into v_number from public.drops;
    insert into public.drops (number, opens_at, locks_at, prints_at)
    values (v_number,
            v_monday at time zone 'Asia/Kolkata',
            (v_monday + interval '3 days' + v_s.lock_time) at time zone 'Asia/Kolkata',
            (v_monday + interval '4 days' + v_s.print_time) at time zone 'Asia/Kolkata');
  end loop;
  return (select id from public.drops where status = 'scheduled' order by opens_at limit 1);
end $$;

-- ─── Announcements (run by the scheduler) ─────────────────────────────
create or replace function public.publish_due_topics() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n int := 0;
  v_close text;
begin
  for r in
    select d.id, d.number, d.submissions_close_at, t.title
    from public.drops d left join public.drop_topics t on t.drop_id = d.id
    where d.status = 'scheduled' and d.topic_at <= now() and d.topic_announced_at is null and d.submissions_close_at > now()
    order by d.opens_at
    for update of d
  loop
    update public.drops set topic_announced_at = now() where id = r.id;
    v_close := to_char(r.submissions_close_at at time zone 'Asia/Kolkata', 'Dy DD Mon, HH12:MI AM');
    insert into public.posts (kind, body)
    values ('system', 'NEW TOPIC · DROP ' || lpad(r.number::text, 3, '0') || ': ' || upper(coalesce(r.title, 'Open theme')) ||
                      '. Artists, submissions close ' || v_close || ' IST.');
    insert into public.notifications (user_id, kind, title, body, link, channels)
    select p.id, 'topic_live', 'New topic: ' || coalesce(r.title, 'Open theme'),
           'Drop ' || lpad(r.number::text, 3, '0') || ' · submissions close ' || v_close || ' IST.', '/topics', '{push,email}'
    from public.profiles p where p.is_artist and not p.banned;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.remind_closing_topics() returns int
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select d.id, d.number, t.title
    from public.drops d left join public.drop_topics t on t.drop_id = d.id
    where d.status = 'scheduled' and d.close_reminder_at is null
      and d.submissions_close_at > now() and d.submissions_close_at <= now() + interval '24 hours'
    for update of d
  loop
    update public.drops set close_reminder_at = now() where id = r.id;
    insert into public.notifications (user_id, kind, title, body, link, channels)
    select p.id, 'topic_closing', 'Last day for “' || coalesce(r.title, 'Open theme') || '”',
           'Submissions for drop ' || lpad(r.number::text, 3, '0') || ' close at 11:59 PM IST.', '/topics', '{push,email}'
    from public.profiles p
    where p.is_artist and not p.banned
      and not exists (select 1 from public.designs g where g.artist_id = p.id and g.submitted_for = r.id and g.status <> 'withdrawn');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.publish_due_topics() from public, anon, authenticated;
revoke execute on function public.remind_closing_topics() from public, anon, authenticated;
revoke execute on function public.ensure_next_drop() from public, anon, authenticated;
grant execute on function public.publish_due_topics() to service_role;
grant execute on function public.remind_closing_topics() to service_role;
grant execute on function public.ensure_next_drop() to service_role;

-- The scheduler (and the demo seed) fill the pipeline; nothing is created here so a
-- fresh database still counts as empty for SEED_DEMO.
