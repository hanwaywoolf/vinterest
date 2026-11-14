-- Where a beta sign-up came from (site/_worker.js, POST /api/beta): the site that linked to the page
-- (its host name only, never the full address) and the UTM tags on the link they arrived by, so
-- sign-ups can be counted by channel. All optional: a visitor who typed the address has none.
alter table public.beta_signups
  add column referrer     text check (char_length(referrer) <= 100),
  add column utm_source   text check (char_length(utm_source) <= 100),
  add column utm_medium   text check (char_length(utm_medium) <= 100),
  add column utm_campaign text check (char_length(utm_campaign) <= 100);
