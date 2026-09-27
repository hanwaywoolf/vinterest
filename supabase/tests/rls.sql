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

-- Only the three document kinds, and a deleted account takes its rows with it.
select pg_temp.check(pg_temp.refused('authenticated', :A, $q$insert into public.user_docs (user_id, doc_key, data) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'anything', '{}')$q$), 'unknown document kinds are refused');
delete from auth.users where id = :A;
select pg_temp.check((select count(*) from public.wines where user_id = :A) = 0 and (select count(*) from public.entitlements where user_id = :A) = 0, 'deleting an account deletes its rows');
rollback;
