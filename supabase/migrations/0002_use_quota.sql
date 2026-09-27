-- Fair-use metering (docs/native-migration-spec.md §5). The Worker calls use_quota once per Claude
-- call a signed-in user makes: it adds one to this week's count for that kind of call and returns
-- the new count, or null when the week's cap is already reached (the Worker then answers 429).
-- One statement, so two calls at once can't both slip under the cap. Weeks start on Monday (UTC).
create function public.use_quota(p_user uuid, p_kind text, p_cap int) returns int
language plpgsql security definer set search_path = public as $$
declare
  wk date := date_trunc('week', now() at time zone 'utc')::date;
  n int;
begin
  if p_cap <= 0 then return null; end if;
  insert into public.usage_counters (user_id, kind, period_start, count)
    values (p_user, p_kind, wk, 1)
  on conflict (user_id, kind, period_start)
    do update set count = public.usage_counters.count + 1
    where public.usage_counters.count < p_cap
  returning count into n;
  return n;
end $$;

-- Only the server (service role) may meter; users can't call it to inflate or probe anyone's count.
revoke all on function public.use_quota(uuid, text, int) from public, anon, authenticated;
grant execute on function public.use_quota(uuid, text, int) to service_role;
