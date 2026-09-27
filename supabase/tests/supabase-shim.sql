-- Just enough of Supabase for the migration and its tests to run on a plain Postgres:
-- the auth schema with users and auth.uid() (read from the request's JWT subject, as Supabase
-- does), and the three roles every request runs as. Supabase grants every table in public to all
-- three by default; that's copied here too, so the migration's own revokes are what's tested.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
