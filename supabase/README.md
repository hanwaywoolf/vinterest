# Supabase: the cloud copy of each user's data

Vinterest stays local-first: the phone keeps the working copy, and Supabase holds a cloud copy
so a user's wines, WineDNA and progress survive a new phone and follow them between devices.
Sign-in is optional (spec D1). The tables are in `migrations/`, and `npm run test:db` proves that
one user can never read or write another's rows.

## What you do in the Supabase dashboard (once)

1. **Create the project.** At [supabase.com](https://supabase.com), choose New project. Name it
   `vinterest`, pick the region closest to most users (London for the UK), and set a database
   password. Keep the password in your password manager; the app never needs it.
2. **Create the tables.** Open SQL Editor → New query, paste all of
   `migrations/0001_user_data.sql`, and Run. You should see "Success. No rows returned". Table
   Editor then shows `wines`, `user_docs`, `entitlements` and `usage_counters`, each with RLS
   enabled. Then do the same with `migrations/0002_use_quota.sql` (the weekly fair-use counter
   the Worker calls) and `migrations/0003_sync_times.sql` (the database stamps each synced row's
   time, so phones with different clocks never miss each other's changes), then `migrations/0004_beta_signups.sql` (the website's beta list, written only by the site's Worker; see
   `docs/site-setup.md`). Then `migrations/0005_shop_products.sql` (partner shops' products from their Awin feeds, written nightly by the feed job and read by the Worker; see `docs/affiliates.md`). Run every file in
   `migrations/` once, in order.
3. **Turn on email sign-in with a code.** Go to Authentication → Sign In / Providers → Email:
   enabled, "Confirm email" on, and Email OTP Length **6**. The app signs in with a 6-digit code
   typed into it, not a link (a link opened from the mail app lands in the browser, not the
   installed app). So in Authentication → Emails, edit both the **Magic Link** and the **Confirm
   signup** templates to show the code, for example:
   subject `Your Vinterest code: {{ .Token }}`, body
   `<p>Your Vinterest sign-in code is <strong>{{ .Token }}</strong>. It expires in an hour.</p>`
   Without `{{ .Token }}` the email has only a link, and the app has nothing to type in.
   Supabase's built-in email sender allows only a few emails an hour; before real users, set up
   custom SMTP (Authentication → Emails → SMTP settings).
4. **Set where sign-in links may return to** (not used by the code sign-in, but keeps any link
   Supabase sends pointing at the app). Go to Authentication → URL Configuration:
   - Site URL: your production address (e.g. `https://vinterest.pages.dev`).
   - Redirect URLs: add `https://vinterest.pages.dev/**` and `https://*.vinterest.pages.dev/**`
     (the second covers Cloudflare's preview builds).
5. **Leave Google and Apple off for now.** They come with the app-store wrap (spec step 8).
6. **Keys** (Project Settings → API Keys, "Publishable and secret API keys"):
   - **Project URL** (`https://<project-ref>.supabase.co`, under Connect or Settings → Data API). Public.
   - **Publishable key** (`sb_publishable_…`). Public: safe in the app, because row-level security,
     not the key, decides what anyone can see. Keep the `default` one.
   - **Secret key** (`sb_secret_…`). **Secret**: it bypasses row-level security. Create one named
     `cloudflare_worker` for the Worker, and one named `github_feeds` for the nightly shop-feed job
     (GitHub secret `SUPABASE_FEEDS_KEY`), and delete any others. Each can be revoked on its own.
   - On the "Legacy anon, service_role API keys" tab, disable the legacy keys: the app doesn't use
     them, and an old service_role key was once used by the retired backend.

## Where the keys go (step 5, sign-in)

| Value | Where | Why |
|---|---|---|
| Project URL, publishable key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (plain text) | The build puts them in the app so it can sign in and sync |
| Secret key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_SECRET_KEY` (type **Secret**) | Only `_worker.js` uses it, to meter usage and read Pro |
| Project URL, the `github_feeds` secret key | GitHub → the repo → Settings → Secrets and variables → Actions, as `SUPABASE_URL` and `SUPABASE_FEEDS_KEY` | Only the nightly shop-feed job (`.github/workflows/shop-feeds.yml`) uses them, to load the partner shops' products |

Delete any old `SUPABASE_*` or `APIFY_*` variables left there by the retired backend.

Never paste the secret key into the repo, a chat or a prompt. If it ever leaks, create a new secret
key in Supabase, put it in Cloudflare, then delete the old one.

## Trying Pro before it's on sale

Pro comes from the `entitlements` table once someone is signed in. To give an account Pro for
testing, sign in on the app once (that creates the user), then in the SQL Editor:

```sql
insert into public.entitlements (user_id, tier, source)
select id, 'pro', 'manual' from auth.users where email = 'you@example.com'
on conflict (user_id) do update set tier = 'pro';
```

Close and reopen the app (it asks `/me` on start) and Profile shows Pro.

## Changing the schema later

Add a new numbered file (`0002_….sql`), never edit one that has already been run. Run it in the
SQL Editor the same way, and extend `tests/rls.sql` for any new table.

## Tests

`npm run test:db` starts a throwaway local Postgres, adds a small stand-in for Supabase's auth
schema and roles (`tests/supabase-shim.sql`), applies every migration and runs `tests/rls.sql`. It
needs Postgres installed locally, but no Supabase account and no network.
