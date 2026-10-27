-- The beta form (site/_worker.js, POST /api/beta) now asks which phone the person has, so invites
-- can go out by platform (TestFlight for iOS, Play's internal track for Android). Earlier rows have
-- no answer, so the column allows null.
alter table public.beta_signups
  add column platform text check (platform in ('ios', 'android'));
