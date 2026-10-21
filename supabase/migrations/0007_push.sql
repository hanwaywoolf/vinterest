-- Push notifications (docs/push.md). One row per phone that has said yes: the token APNs (iPhone)
-- or FCM (Android) gave it, and who it belongs to. Written and read only by the Worker with the
-- service role (POST /push/register, /push/unregister), never by the app directly. A token that
-- APNs or FCM says is gone is deleted when we next try it. Deleting the account deletes its rows.
create table public.push_devices (
  token       text primary key check (length(token) between 20 and 4096),
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text not null check (platform in ('ios','android')),
  tz          text,                                  -- the phone's time zone, so a reminder lands in the evening
  app_version text,
  created_at  timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index push_devices_user on public.push_devices (user_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;

-- What has been pushed, so a bottle is reminded once, a person gets at most a few a week, and a
-- repeated run of the job sends nothing twice. kind: rate | lapse | pro_ending | billing | test.
create table public.push_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind    text not null,
  key     text not null,                              -- what it was about: a wine's key, a date
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);
create index push_sent_recent on public.push_sent (user_id, sent_at);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from public, anon, authenticated;
