-- Free accounts get FREE_MONTHLY (in _worker.js) label scans a calendar month (UTC). The Worker calls
-- use_quota_month for a free user's label scan: it adds one to this month's count and returns the
-- new count, or null once the month's cap is reached (the Worker then answers 429 scan_limit). Same
-- table and single statement as use_quota (0002), keyed on the first of the month; the Worker passes
-- the kind with a ":month" suffix so a month's row never meets a week's row that starts the same day.
create function public.use_quota_month(p_user uuid, p_kind text, p_cap int) returns int
language plpgsql security definer set search_path = public as $$
declare
  mo date := date_trunc('month', now() at time zone 'utc')::date;
  n int;
begin
  if p_cap <= 0 then return null; end if;
  insert into public.usage_counters (user_id, kind, period_start, count)
    values (p_user, p_kind, mo, 1)
  on conflict (user_id, kind, period_start)
    do update set count = public.usage_counters.count + 1
    where public.usage_counters.count < p_cap
  returning count into n;
  return n;
end $$;

-- Only the server (service role) may meter; users can't call it to inflate or probe anyone's count.
revoke all on function public.use_quota_month(uuid, text, int) from public, anon, authenticated;
grant execute on function public.use_quota_month(uuid, text, int) to service_role;
