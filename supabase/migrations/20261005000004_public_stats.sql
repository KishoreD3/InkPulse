-- Public aggregates that RLS would otherwise hide (individual votes stay private).

create or replace function public.drop_voter_count(p_drop uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct user_id)::int from public.votes where drop_id = p_drop and withdrawn_at is null;
$$;

create or replace function public.cause_vote_tally(p_drop uuid)
returns table (cause_id uuid, votes int)
language sql stable security definer set search_path = public as $$
  select s.cause_id, count(v.user_id)::int
  from public.cause_shortlist s
  left join public.cause_votes v on v.drop_id = s.drop_id and v.cause_id = s.cause_id
  where s.drop_id = p_drop
  group by s.cause_id;
$$;

create or replace function public.artist_stats(p_artist uuid)
returns table (printed int, total_votes int, followers int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.designs where artist_id = p_artist and status = 'won'),
    (select coalesce(sum(vote_count), 0)::int from public.designs where artist_id = p_artist and status in ('live', 'won', 'lost')),
    (select count(*)::int from public.follows where artist_id = p_artist);
$$;

create or replace function public.impact_totals()
returns table (total_given int, causes_funded int, drops_run int)
language sql stable security definer set search_path = public as $$
  select
    (select coalesce(sum(amount), 0)::int from public.cause_payouts where published),
    (select count(distinct cause_id)::int from public.cause_payouts where published),
    (select count(*)::int from public.drops where status in ('locked', 'printing', 'shipped'));
$$;

grant execute on function public.drop_voter_count(uuid) to anon, authenticated;
grant execute on function public.cause_vote_tally(uuid) to anon, authenticated;
grant execute on function public.artist_stats(uuid) to anon, authenticated;
grant execute on function public.impact_totals() to anon, authenticated;
