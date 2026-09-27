-- Vinterest user data (docs/native-migration-spec.md §3).
-- The app is local-first: the phone's storage stays the working copy and these tables are the
-- cloud copy that sync (step 6) keeps in step with it. Every row belongs to one signed-in user,
-- and row-level security makes that the only user who can see it.

-- One row per bottle. wine_key is WineHistory's identity: lower(name) || '|' || vintage, with 'nv'
-- for a missing/0/'NV' vintage. The client resolves a rescan to the saved bottle before it syncs
-- (ScanFlow.resolve), so one bottle is one row.
create table public.wines (
  user_id        uuid not null references auth.users(id) on delete cascade,
  wine_key       text not null check (length(wine_key) between 3 and 400),
  data           jsonb not null,               -- the wine object exactly as the phone stores it
  rating         int check (rating is null or rating between 0 and 100),
  times_consumed int not null default 0,
  scan_intent    text,
  last_scanned   timestamptz,
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz,                  -- tombstone, so a delete on one phone reaches the others
  primary key (user_id, wine_key)
);

-- Everything else that's theirs, as documents. The same sections as a backup file (pwa-backup.js):
-- 'xp' is XPSystem's account object; 'settings' and 'progress' map device keys to stored values.
create table public.user_docs (
  user_id    uuid not null references auth.users(id) on delete cascade,
  doc_key    text not null check (doc_key in ('xp','settings','progress')),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_key)
);

-- Pro. Written only by the server (the Worker with the service role, later the RevenueCat webhook).
create table public.entitlements (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free','pro')),
  source     text,                            -- 'revenuecat' | 'manual'
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Fair-use metering of Claude calls, per week. Written only by the server.
create table public.usage_counters (
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null,                 -- a /claude purpose: 'label_scan', 'list_scan', 'price', …
  period_start date not null,                 -- Monday of the week
  count        int not null default 0 check (count >= 0),
  primary key (user_id, kind, period_start)
);

alter table public.wines          enable row level security;
alter table public.user_docs      enable row level security;
alter table public.entitlements   enable row level security;
alter table public.usage_counters enable row level security;

-- Their own rows, read and write.
create policy "own wines" on public.wines
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own docs" on public.user_docs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Pro and usage: they can read their own; only the service role writes.
create policy "read own entitlement" on public.entitlements
  for select to authenticated using (user_id = auth.uid());
create policy "read own usage" on public.usage_counters
  for select to authenticated using (user_id = auth.uid());

-- Belt and braces on top of the policies: signed-out requests get nothing, and signed-in users
-- can't write Pro or usage even if a policy is added by mistake later.
revoke all on public.wines, public.user_docs, public.entitlements, public.usage_counters from anon;
revoke insert, update, delete, truncate on public.entitlements, public.usage_counters from authenticated;
grant select on public.entitlements, public.usage_counters to authenticated;
grant select, insert, update, delete on public.wines, public.user_docs to authenticated;

-- Sync pulls "what changed since I last looked".
create index wines_user_updated on public.wines (user_id, updated_at);
create index docs_user_updated  on public.user_docs (user_id, updated_at);
