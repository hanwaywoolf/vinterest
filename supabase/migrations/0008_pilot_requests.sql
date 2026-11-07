-- The Vinterest Teams website's pilot request (site/teams/_worker.js, POST /api/pilot). Nobody is signed
-- in when they fill it in, so rows belong to no user: the Worker writes them with the secret key, and no
-- one else can read or write them (row-level security on, and no policy for anon or authenticated).
-- The choices are the form's own lists; the Worker refuses anything else before it gets here. A business
-- can ask more than once (another site, a correction), so the email isn't unique.
create table public.pilot_requests (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  first_name       text not null check (char_length(first_name) between 1 and 80),
  last_name        text not null check (char_length(last_name) between 1 and 80),
  email            text not null check (email = lower(email) and char_length(email) between 3 and 254 and position('@' in email) > 1),
  company          text not null check (char_length(company) between 1 and 120),
  role             text check (char_length(role) <= 80),
  city             text not null check (char_length(city) between 1 and 80),
  country          text not null check (country ~ '^[A-Z]{2}$'),   -- ISO 3166 alpha-2, ZZ for "somewhere else"
  venue_type       text not null check (venue_type in ('restaurant','fine_dining','wine_bar','group','winery','other')),
  venue_type_other text check (char_length(venue_type_other) <= 120),
  sites            text not null check (char_length(sites) <= 20),
  team_size        text not null check (char_length(team_size) <= 20),
  pos              text not null check (pos in ('square','toast','clover','lightspeed','zonal','tevalis','eposnow','micros','aloha','other','none')),
  pos_other        text check (char_length(pos_other) <= 80),
  list_size        text not null check (char_length(list_size) <= 20),
  notes            text check (char_length(notes) <= 1000),
  status           text not null default 'new' check (status in ('new','contacted','piloting','declined')),
  check (venue_type <> 'other' or venue_type_other is not null),
  check (pos <> 'other' or pos_other is not null)
);

alter table public.pilot_requests enable row level security;
revoke all on public.pilot_requests from anon, authenticated;
grant select, insert, update on public.pilot_requests to service_role;
