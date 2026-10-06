-- INKPULSE · artist-first: no cause/charity share. Every tee pays its artist.
-- The old cause tables stay in place (unused) so history is never lost.

alter table public.settings alter column cause_pct_of_profit set default 0;
update public.settings set cause_pct_of_profit = 0;

-- A visible, non-zero artist share from day one (editable in Admin → Settings).
alter table public.settings alter column artist_pct set default 15;
update public.settings set artist_pct = 15 where artist_pct = 0;

-- Drops no longer roll a cause vote into the next drop.
create or replace function public.lock_due_drops() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  v_drop public.drops;
  v_settings public.settings;
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

    perform public.ensure_next_drop();

    insert into public.posts (kind, body)
    values ('system', 'DROP ' || lpad(v_drop.number::text, 3, '0') || ' RESULTS ARE IN. ' ||
      coalesce((select string_agg(upper(name), ' · ' order by final_rank) from public.designs
                where drop_id = v_drop.id and status = 'won'), 'No winners') || ' go to print Friday.');
    return next v_drop.id;
  end loop;
end $$;
revoke execute on function public.lock_due_drops() from public, anon, authenticated;
grant execute on function public.lock_due_drops() to service_role;

-- Public scoreboard: what artists have earned through INKPULSE so far.
create or replace function public.artist_totals()
returns table (earned int, artists_printed int, tees_sold int)
language sql stable security definer set search_path = public as $$
  select
    (select coalesce(sum(amount), 0)::int from public.artist_earnings where status <> 'void'),
    (select count(distinct artist_id)::int from public.designs where status = 'won'),
    (select coalesce(sum(i.qty), 0)::int from public.order_items i join public.orders o on o.id = i.order_id where o.payment_status = 'captured');
$$;

-- Most-printed artists, for the home page.
create or replace function public.top_artists(p_limit int default 6)
returns table (id uuid, handle text, name text, avatar_url text, printed int, tees_sold int)
language sql stable security definer set search_path = public as $$
  select p.id, p.handle::text, p.name, p.avatar_url,
         count(distinct g.id) filter (where g.status = 'won')::int,
         coalesce(sum(i.qty) filter (where o.payment_status = 'captured'), 0)::int
  from public.profiles p
  join public.designs g on g.artist_id = p.id
  left join public.order_items i on i.design_id = g.id
  left join public.orders o on o.id = i.order_id
  where p.is_artist and not p.banned
  group by p.id
  having count(distinct g.id) filter (where g.status = 'won') > 0
  order by 6 desc, 5 desc
  limit least(greatest(p_limit, 1), 24);
$$;

grant execute on function public.artist_totals() to anon, authenticated;
grant execute on function public.top_artists(int) to anon, authenticated;
