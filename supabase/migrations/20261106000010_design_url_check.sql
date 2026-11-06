-- Artwork links on a design must be a web address (https:// or http://) or a path on this site.
-- Members can write these columns directly through the API, and the admin review page links to them,
-- so a "javascript:" link would run in an admin's browser. NOT VALID: existing rows are left as they are.
alter table public.designs add constraint designs_art_front_url_web
  check (art_front_url ~* '^(https?://|/[^/\\])') not valid;
alter table public.designs add constraint designs_art_back_url_web
  check (art_back_url is null or art_back_url ~* '^(https?://|/[^/\\])') not valid;
