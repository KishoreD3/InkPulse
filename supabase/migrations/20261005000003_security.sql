-- INKPULSE · Row Level Security, column grants, storage buckets, realtime.
-- Rule of thumb: the browser (anon/authenticated) can read public data and write only its own rows.
-- Everything that moves money or changes a drop runs on the server with the service role.

alter table public.settings          enable row level security;
alter table public.profiles          enable row level security;
alter table public.profile_private   enable row level security;
alter table public.addresses         enable row level security;
alter table public.partners          enable row level security;
alter table public.causes            enable row level security;
alter table public.drops             enable row level security;
alter table public.cause_shortlist   enable row level security;
alter table public.cause_votes       enable row level security;
alter table public.designs           enable row level security;
alter table public.votes             enable row level security;
alter table public.print_batches     enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.shipments         enable row level security;
alter table public.cause_payouts     enable row level security;
alter table public.artist_payouts    enable row level security;
alter table public.artist_earnings   enable row level security;
alter table public.posts             enable row level security;
alter table public.comments          enable row level security;
alter table public.likes             enable row level security;
alter table public.reposts           enable row level security;
alter table public.follows           enable row level security;
alter table public.notifications     enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reports           enable row level security;
alter table public.audit_log         enable row level security;
alter table public.webhook_events    enable row level security;

-- Default: no writes from the browser except the columns granted below.
revoke insert, update, delete on all tables in schema public from anon, authenticated;

-- ─── Public reference data ────────────────────────────────────────────
create policy settings_read on public.settings for select using (true);
create policy partners_read on public.partners for select using (true);
create policy causes_read on public.causes for select using (true);
create policy drops_read on public.drops for select using (true);
create policy shortlist_read on public.cause_shortlist for select using (true);
create policy payouts_read on public.cause_payouts for select using (published or public.is_admin());

-- ─── Profiles ─────────────────────────────────────────────────────────
create policy profiles_read on public.profiles for select using (true);
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
grant update (handle, name, bio, avatar_url, location, links, notify) on public.profiles to authenticated;

create policy private_self on public.profile_private for select using (id = auth.uid());
create policy private_update_self on public.profile_private for update using (id = auth.uid()) with check (id = auth.uid());
grant update (pan, payout_upi, bank_account, bank_ifsc) on public.profile_private to authenticated;

create policy addresses_self on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant insert, update, delete on public.addresses to authenticated;

-- ─── Designs (artists write drafts; admins move them through review server-side) ─
create policy designs_read on public.designs for select
  using (status in ('live', 'won', 'lost') or artist_id = auth.uid() or public.is_admin());
create policy designs_insert_own on public.designs for insert
  with check (artist_id = auth.uid() and public.is_artist() and status in ('draft', 'in_review') and drop_id is null);
create policy designs_update_own on public.designs for update
  using (artist_id = auth.uid() and status in ('draft', 'in_review', 'changes_requested'))
  with check (artist_id = auth.uid() and status in ('draft', 'in_review', 'withdrawn') and drop_id is null);
grant insert (slug, artist_id, name, story, category, tags, colours, art_front_url, art_back_url, perk, originality_confirmed, status)
  on public.designs to authenticated;
grant update (name, story, category, tags, colours, art_front_url, art_back_url, perk, originality_confirmed, status)
  on public.designs to authenticated;

-- Votes go through cast_vote()/withdraw_vote() only.
create policy votes_read_own on public.votes for select using (user_id = auth.uid());
create policy cause_votes_read_own on public.cause_votes for select using (user_id = auth.uid());

-- ─── Orders (created server-side after price validation) ──────────────
create policy orders_read_own on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy items_read_own on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy shipments_read_own on public.shipments for select
  using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

create policy earnings_read_own on public.artist_earnings for select using (artist_id = auth.uid() or public.is_admin());
create policy artist_payouts_read_own on public.artist_payouts for select using (artist_id = auth.uid() or public.is_admin());

-- ─── Social ───────────────────────────────────────────────────────────
create policy posts_read on public.posts for select using (not hidden or author_id = auth.uid() or public.is_admin());
create policy posts_insert_own on public.posts for insert
  with check (author_id = auth.uid() and (kind = 'member' or (kind = 'artist' and public.is_artist()))
              and not exists (select 1 from public.profiles where id = auth.uid() and banned));
create policy posts_delete_own on public.posts for delete using (author_id = auth.uid());
grant insert (author_id, kind, body, image_urls, design_id) on public.posts to authenticated;
grant delete on public.posts to authenticated;

create policy comments_read on public.comments for select using (not hidden or author_id = auth.uid() or public.is_admin());
create policy comments_insert_own on public.comments for insert
  with check (author_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and banned));
create policy comments_delete_own on public.comments for delete using (author_id = auth.uid());
grant insert (post_id, design_id, parent_id, author_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

create policy likes_read on public.likes for select using (true);
create policy likes_write on public.likes for insert with check (user_id = auth.uid());
create policy likes_delete on public.likes for delete using (user_id = auth.uid());
grant insert, delete on public.likes to authenticated;

create policy reposts_read on public.reposts for select using (true);
create policy reposts_write on public.reposts for insert with check (user_id = auth.uid());
create policy reposts_delete on public.reposts for delete using (user_id = auth.uid());
grant insert, delete on public.reposts to authenticated;

create policy follows_read on public.follows for select using (true);
create policy follows_write on public.follows for insert with check (follower_id = auth.uid());
create policy follows_delete on public.follows for delete using (follower_id = auth.uid());
grant insert, delete on public.follows to authenticated;

-- ─── Notifications & push ─────────────────────────────────────────────
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_mark_read on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (read_at) on public.notifications to authenticated;

create policy push_own on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant insert, delete on public.push_subscriptions to authenticated;

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_read_own on public.reports for select using (reporter_id = auth.uid() or public.is_admin());
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;

-- print_batches, audit_log, webhook_events: no policies → service role only.

-- ─── Storage buckets (Supabase only) ──────────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('artwork',  'artwork',  true,  26214400, array['image/png', 'image/svg+xml']),
      ('avatars',  'avatars',  true,  2097152,  array['image/png', 'image/jpeg', 'image/webp']),
      ('posts',    'posts',    true,  5242880,  array['image/png', 'image/jpeg', 'image/webp']),
      ('receipts', 'receipts', true,  10485760, array['application/pdf', 'image/png', 'image/jpeg']),
      ('print-batches', 'print-batches', false, 10485760, array['text/csv', 'application/json'])
    on conflict (id) do nothing;

    -- Users may upload only into a folder named after their user id: <uid>/<file>.
    execute $p$create policy "own folder upload" on storage.objects for insert to authenticated
      with check (bucket_id in ('artwork', 'avatars', 'posts') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "own folder update" on storage.objects for update to authenticated
      using (bucket_id in ('artwork', 'avatars', 'posts') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "own folder delete" on storage.objects for delete to authenticated
      using (bucket_id in ('artwork', 'avatars', 'posts') and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "public read" on storage.objects for select
      using (bucket_id in ('artwork', 'avatars', 'posts', 'receipts'))$p$;
  end if;
end $$;

-- ─── Realtime: live vote counts and the feed ──────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.designs, public.posts, public.drops;
  end if;
end $$;
