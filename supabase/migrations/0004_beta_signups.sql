-- The website's beta sign-up (site/_worker.js, POST /api/beta). Nobody is signed in when they fill
-- it in, so rows belong to no user: the Worker writes them with the secret key, and no one else can
-- read or write them (row-level security on, and no policy for anon or authenticated). The email is
-- stored lower-cased and is unique, so signing up twice is one row.
create table public.beta_signups (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name  text not null check (char_length(last_name) between 1 and 80),
  country    text not null check (country ~ '^[A-Z]{2}$'),   -- ISO 3166 alpha-2, ZZ for "somewhere else"
  email      text not null unique check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1)
);

alter table public.beta_signups enable row level security;
revoke all on public.beta_signups from anon, authenticated;
grant select, insert on public.beta_signups to service_role;
