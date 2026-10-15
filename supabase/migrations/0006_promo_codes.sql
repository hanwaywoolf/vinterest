-- Promo codes: a code typed into the app (Profile, "Have a promo code?") grants Pro for a number
-- of months. Codes are made by hand in the Supabase dashboard (insert into promo_codes); the app
-- never sees the table. The Worker's POST /promo calls redeem_promo for the signed-in user, in one
-- statement, so a code with one use left can't be redeemed twice at once.
create table public.promo_codes (
  code text primary key,                        -- stored upper-case, no spaces
  months int not null default 3 check (months between 1 and 120),
  max_uses int not null default 1 check (max_uses >= 1),
  uses int not null default 0,
  expires_at timestamptz,                       -- null: no end date
  note text,                                    -- who it was for (a reviewer, a tester, a draw)
  created_at timestamptz not null default now()
);
alter table public.promo_codes enable row level security;
-- No policies: only the service role (the Worker and the dashboard) reaches the table.
revoke all on public.promo_codes from public, anon, authenticated;

-- Returns {ok, expires_at} or {error}: 'invalid' (no such code), 'expired', 'used_up'.
-- Pro that hasn't run out is extended from its end, so a code never shortens what they have.
create function public.redeem_promo(p_user uuid, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.promo_codes%rowtype;
  from_at timestamptz;
  until timestamptz;
begin
  select * into c from public.promo_codes where code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) for update;
  if not found then return jsonb_build_object('error', 'invalid'); end if;
  if c.expires_at is not null and c.expires_at < now() then return jsonb_build_object('error', 'expired'); end if;
  if c.uses >= c.max_uses then return jsonb_build_object('error', 'used_up'); end if;
  update public.promo_codes set uses = uses + 1 where code = c.code;
  select greatest(now(), coalesce(expires_at, now())) into from_at from public.entitlements where user_id = p_user and tier = 'pro';
  until := coalesce(from_at, now()) + make_interval(months => c.months);
  insert into public.entitlements (user_id, tier, source, expires_at, updated_at)
    values (p_user, 'pro', 'promo', until, now())
  on conflict (user_id) do update set tier = 'pro', source = 'promo', expires_at = until, updated_at = now();
  return jsonb_build_object('ok', true, 'expires_at', until);
end $$;

revoke all on function public.redeem_promo(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_promo(uuid, text) to service_role;
