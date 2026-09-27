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
6. **Copy three values** from Project Settings → API (or Data API / API Keys):
   - **Project URL** (`https://xxxx.supabase.co`). Public.
   - **anon / publishable key.** Public: it's safe in the app, because row-level security, not
     the key, decides what anyone can see.
   - **service_role / secret key.** **Secret.** It bypasses row-level security.

## Where the keys go (step 5, sign-in)

| Value | Where | Why |
|---|---|---|
| Project URL, anon key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_URL` and `SUPABASE_ANON_KEY` (plain text) | The build puts them in the app so it can sign in and sync |
| service_role key | Cloudflare Pages → Settings → Variables and Secrets, as `SUPABASE_SERVICE_ROLE_KEY` (**Encrypt**) | Only `_worker.js` uses it, to meter usage and read Pro |

Never paste the service_role key into the repo, a chat or a prompt. If it ever leaks, rotate it in
Supabase (Project Settings → API) and update Cloudflare.

## Changing the schema later

Add a new numbered file (`0002_….sql`), never edit one that has already been run. Run it in the
SQL Editor the same way, and extend `tests/rls.sql` for any new table.

## Tests

`npm run test:db` starts a throwaway local Postgres, adds a small stand-in for Supabase's auth
schema and roles (`tests/supabase-shim.sql`), applies every migration and runs `tests/rls.sql`. It
needs Postgres installed locally, but no Supabase account and no network.
