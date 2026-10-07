-- Row-level security: user A can't read or write user B's rows; nobody signed in can write Pro or
-- usage; signed-out requests see nothing; the service role (the Worker) can do what it needs.
\set ON_ERROR_STOP 1
\set A '''aaaaaaaa-0000-0000-0000-00000000000a'''
\set B '''bbbbbbbb-0000-0000-0000-00000000000b'''
insert into auth.users values (:A), (:B);

-- A helper: run `sql` as `role` for user `uid`, and say whether it was refused.
create function pg_temp.refused(role text, uid text, sql text) returns boolean language plpgsql as $$
begin
  perform set_config('role', role, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  begin execute sql; exception when insufficient_privilege or check_violation or with_check_option_violation then
    perform set_config('role', 'postgres', true); return true; end;
  perform set_config('role', 'postgres', true);
  return false;
end $$;
create function pg_temp.count_as(role text, uid text, sql text) returns int language plpgsql as $$
declare n int;
begin
  perform set_config('role', role, true);
  perform set_config('request.jwt.claim.sub', coalesce(uid, ''), true);
  execute sql into n;
  perform set_config('role', 'postgres', true);
  return n;
end $$;
create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

begin;
-- Each user saves their own wine and XP.
select pg_temp.check(not pg_temp.refused('authenticated', :A, $q$insert into public.wines (user_id, wine_key, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'rioja|2019', '{}')$q$), 'A saves a wine');
select pg_temp.check(not pg_temp.refused('authenticated', :B, $q$insert into public.wines (user_id, wine_key, data) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'barolo|2016', '{}')$q$), 'B saves a wine');
select pg_temp.check(not pg_temp.refused('authenticated', :A, $q$insert into public.user_docs (user_id, doc_key, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'xp', '{"total":10}')$q$), 'A saves XP');

-- A can't write rows as B, or into B's rows.
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$insert into public.wines (user_id, wine_key, data) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'sneaky|nv', '{}')$q$), 'A cannot add a wine to B');
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$insert into public.user_docs (user_id, doc_key, data) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'xp', '{}')$q$), 'A cannot write B''s XP');
select pg_temp.check(pg_temp.count_as('authenticated', :A, $q$with u as (update public.wines set rating = 1 where wine_key = 'barolo|2016' returning 1) select count(*)::int from u$q$) = 0, 'A''s update of B''s wine changes nothing');
select pg_temp.check(pg_temp.count_as('authenticated', :A, $q$with d as (delete from public.wines where wine_key = 'barolo|2016' returning 1) select count(*)::int from d$q$) = 0, 'A''s delete of B''s wine removes nothing');
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$update public.wines set user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' where wine_key = 'rioja|2019'$q$), 'A cannot hand a wine to B');

-- Each sees only their own.
select pg_temp.check(pg_temp.count_as('authenticated', :A, 'select count(*)::int from public.wines') = 1, 'A sees only A''s wine');
select pg_temp.check(pg_temp.count_as('authenticated', :B, 'select count(*)::int from public.wines') = 1, 'B sees only B''s wine');
select pg_temp.check(pg_temp.count_as('authenticated', :B, 'select count(*)::int from public.user_docs') = 0, 'B cannot see A''s XP');

-- Pro and usage: the server writes, users only read their own, and no user can write them.
select pg_temp.check(not pg_temp.refused('service_role', null, $q$insert into public.entitlements (user_id, tier, source) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'pro', 'manual')$q$), 'the server grants Pro');
select pg_temp.check(not pg_temp.refused('service_role', null, $q$insert into public.usage_counters (user_id, kind, period_start, count) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'label_scan', '2026-09-21', 3)$q$), 'the server meters usage');
select pg_temp.check(pg_temp.count_as('authenticated', :A, 'select count(*)::int from public.entitlements') = 1, 'A reads their own Pro');
select pg_temp.check(pg_temp.count_as('authenticated', :B, 'select count(*)::int from public.entitlements') = 0, 'B cannot see A''s Pro');
select pg_temp.check(pg_temp.refused('authenticated', :B, $q$insert into public.entitlements (user_id, tier) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'pro')$q$), 'B cannot give themselves Pro');
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$update public.entitlements set expires_at = '2099-01-01'$q$), 'A cannot extend their own Pro');
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$update public.usage_counters set count = 0$q$), 'A cannot reset their usage');
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$delete from public.usage_counters$q$), 'A cannot delete their usage');

-- Signed out: nothing at all.
select pg_temp.check(pg_temp.refused('anon', null, 'select count(*) from public.wines'), 'signed-out cannot read wines');
select pg_temp.check(pg_temp.refused('anon', null, $q$insert into public.user_docs (user_id, doc_key, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'xp', '{}')$q$), 'signed-out cannot write');
select pg_temp.check(pg_temp.refused('anon', null, 'select count(*) from public.entitlements'), 'signed-out cannot read Pro');

-- Metering: only the server can count a call, and the count stops at the cap.
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$select public.use_quota('aaaaaaaa-0000-0000-0000-00000000000a', 'label_scan', 100)$q$), 'A cannot run the meter');
select pg_temp.check(pg_temp.refused('anon', null, $q$select public.use_quota('aaaaaaaa-0000-0000-0000-00000000000a', 'label_scan', 100)$q$), 'signed-out cannot run the meter');
select pg_temp.check(pg_temp.count_as('service_role', null, $q$select public.use_quota('bbbbbbbb-0000-0000-0000-00000000000b', 'wine_qa', 2)$q$) = 1, 'the meter counts the first call');
select pg_temp.check(pg_temp.count_as('service_role', null, $q$select public.use_quota('bbbbbbbb-0000-0000-0000-00000000000b', 'wine_qa', 2)$q$) = 2, 'and the second');
select pg_temp.check(pg_temp.count_as('service_role', null, $q$select coalesce(public.use_quota('bbbbbbbb-0000-0000-0000-00000000000b', 'wine_qa', 2), -1)$q$) = -1, 'the third is over the cap');
select pg_temp.check((select count from public.usage_counters where user_id = :B and kind = 'wine_qa') = 2, 'a refused call is not counted');
select pg_temp.check(pg_temp.count_as('service_role', null, $q$select coalesce(public.use_quota('bbbbbbbb-0000-0000-0000-00000000000b', 'list_scan', 0), -1)$q$) = -1, 'a cap of 0 refuses outright');
select pg_temp.check(pg_temp.count_as('authenticated', :B, $q$select count::int from public.usage_counters where kind = 'wine_qa'$q$) = 2, 'B can read their own usage');

-- Sync: the database stamps updated_at itself, whatever time a phone sends (0003).
select pg_temp.check(not pg_temp.refused('authenticated', :B, $q$insert into public.wines (user_id, wine_key, data, updated_at) values ('bbbbbbbb-0000-0000-0000-00000000000b', 'stamped|2020', '{}', '2000-01-01') on conflict (user_id, wine_key) do update set data = excluded.data, updated_at = excluded.updated_at$q$), 'B saves a wine with an old time');
select pg_temp.check((select updated_at from public.wines where wine_key = 'stamped|2020') > '2020-01-01', 'the database stamps it with its own time');
update public.user_docs set updated_at = '2000-01-01' where user_id = :A and doc_key = 'xp';
select pg_temp.check((select updated_at from public.user_docs where user_id = :A and doc_key = 'xp') > '2020-01-01', 'and documents too');

-- Only the three document kinds, and a deleted account takes its rows with it.
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$insert into public.user_docs (user_id, doc_key, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'anything', '{}')$q$), 'unknown document kinds are refused');
delete from auth.users where id = :A;
select pg_temp.check((select count(*) from public.wines where user_id = :A) = 0 and (select count(*) from public.entitlements where user_id = :A) = 0, 'deleting an account deletes its rows');

-- The website's beta list (0004): only the server reads or writes it, one row per email.
select pg_temp.check(not pg_temp.refused('service_role', null, $q$insert into public.beta_signups (first_name, last_name, country, email) values ('Ada', 'Lovelace', 'GB', 'ada@example.com')$q$), 'the server adds a beta sign-up');
insert into public.beta_signups (first_name, last_name, country, email) values ('Ada', 'L', 'GB', 'ada@example.com') on conflict (email) do nothing;
select pg_temp.check((select count(*) from public.beta_signups where email = 'ada@example.com') = 1, 'the same email is one row');
select pg_temp.check(pg_temp.refused('service_role', null, $q$insert into public.beta_signups (first_name, last_name, country, email) values ('Bo', 'Peep', 'GB', 'Bo@Example.com')$q$), 'emails are stored lower-cased');
select pg_temp.check(pg_temp.refused('service_role', null, $q$insert into public.beta_signups (first_name, last_name, country, email) values ('Bo', 'Peep', 'Britain', 'bo@example.com')$q$), 'a country is an ISO code');
select pg_temp.check(pg_temp.refused('anon', null, $q$insert into public.beta_signups (first_name, last_name, country, email) values ('Eve', 'Hacker', 'GB', 'eve@example.com')$q$), 'signed-out cannot join the list directly');
select pg_temp.check(pg_temp.refused('anon', null, 'select count(*) from public.beta_signups'), 'signed-out cannot read the list');
select pg_temp.check(pg_temp.refused('authenticated', :B, 'select count(*) from public.beta_signups'), 'a signed-in user cannot read the list');
select pg_temp.check(pg_temp.refused('authenticated', :B, $q$insert into public.beta_signups (first_name, last_name, country, email) values ('Eve', 'Hacker', 'GB', 'eve@example.com')$q$), 'a signed-in user cannot write the list');
-- Partner shops' products (0005): the server writes and reads them; nobody else.
select pg_temp.check(not pg_temp.refused('service_role', null, $q$insert into public.shop_products (shop, product_id, name, words, vintage, price, currency, url) values ('winebuyers', 'p1', '2021 Antinori, Tignanello, IGT', '{2021,antinori,tignanello,igt}', 2021, 159, 'GBP', 'https://winebuyers.com/x')$q$), 'the feed job adds a shop product');
insert into public.shop_products (shop, product_id, name, words, vintage, pack, price, currency, url) values ('winebuyers', 'p2', 'Antinori Tignanello (case of 3)', '{antinori,tignanello,case,of,3}', null, 3, 450, 'GBP', 'https://winebuyers.com/y'), ('winebuyers', 'p3', '2024 Muga Rosado', '{2024,muga,rosado}', 2024, 1, 17, 'GBP', 'https://winebuyers.com/z');
select pg_temp.check((select array_agg(product_id order by product_id) from public.shop_candidates('winebuyers', '{antinori,tignanello}', 10)) = '{p1,p2}', 'shop_candidates finds the listings sharing words, not the others');
select pg_temp.check((select product_id from public.shop_candidates('winebuyers', '{tignanello,2021}', 1)) = 'p1', 'the listing sharing the most words comes first');
select pg_temp.check(pg_temp.refused('anon', null, 'select count(*) from public.shop_products'), 'signed-out cannot read shop products');
select pg_temp.check(pg_temp.refused('authenticated', :B, 'select count(*) from public.shop_products'), 'a signed-in user cannot read shop products');
select pg_temp.check(pg_temp.refused('authenticated', :B, $q$select * from public.shop_candidates('winebuyers', '{muga}', 5)$q$), 'a signed-in user cannot call shop_candidates');
select pg_temp.check(pg_temp.refused('anon', null, $q$delete from public.shop_products$q$), 'signed-out cannot change shop products');
rollback;
