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
   enabled.
3. **Turn on email sign-in.** Go to Authentication → Sign In / Providers → Email: enabled, "Confirm
   email" on. Then Authentication → Emails → Magic Link: keep the default template, or reword it
   ("Your Vinterest sign-in link").
4. **Set where sign-in links may return to.** Go to Authentication → URL Configuration:
   - Site URL: your production address (e.g. `https://vinterest.pages.dev`).
   - Redirect URLs: add `https://vinterest.pages.dev/**` and `https://*.vinterest.pages.dev/**`
     (the second covers Cloudflare's preview builds).
5. **Leave Google and Apple off for now.** They come with the app-store wrap (spec step 8).
6. **Keys** (Project Settings → API Keys, "Publishable and secret API keys"):
   - **Project URL** (`https://<project-ref>.supabase.co`, under Connect or Settings → Data API). Public.
   - **Publishable key** (`sb_publishable_…`). Public: safe in the app, because row-level security,
     not the key, decides what anyone can see. Keep the `default` one.
   - **Secret key** (`sb_secret_…`). **Secret**: it bypasses row-level security. Create one named
     `cloudflare-worker` and delete any other secret keys, so the only copy is Cloudflare's.
   - On the "Legacy anon, service_role API keys" tab, disable the legacy keys: the app doesn't use
     them, and an old service_role key was once used by the retired backend.

## Where the keys go (step 5, sign-in)

| Value | Where | Why |
|---|---|---|
| Project URL, publishable key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (plain text) | The build puts them in the app so it can sign in and sync |
| Secret key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_SECRET_KEY` (**Encrypt**) | Only `_worker.js` uses it, to meter usage and read Pro |

Delete any old `SUPABASE_*` or `APIFY_*` variables left there by the retired backend.

Never paste the secret key into the repo, a chat or a prompt. If it ever leaks, create a new secret
key in Supabase, put it in Cloudflare, then delete the old one.

## Changing the schema later

Add a new numbered file (`0002_….sql`), never edit one that has already been run. Run it in the
SQL Editor the same way, and extend `tests/rls.sql` for any new table.

## Tests

`npm run test:db` starts a throwaway local Postgres, adds a small stand-in for Supabase's auth
schema and roles (`tests/supabase-shim.sql`), applies every migration and runs `tests/rls.sql`. It
needs Postgres installed locally, but no Supabase account and no network.
