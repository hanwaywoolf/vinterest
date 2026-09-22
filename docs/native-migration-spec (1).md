# Vinterest native migration spec

Drop this file into the repo at `docs/native-migration-spec.md` (GitHub's Add file > Upload files works). Every prompt in section 6 starts by telling Claude Code to read it. It is written against `docs/audit.md` and `CLAUDE.md`, so keep those in the repo too.

Plan in one line: keep the React web app as the single UI codebase, add accounts and cloud sync to the PWA first, then wrap it with Capacitor for iOS and Android. Claude Design keeps feeding the same UI files.

---

## 1. What the audit changes

1. **`/claude` is an open proxy.** It forwards to Anthropic with your key and has no auth. Anyone who finds the URL can spend your money, choose the model and ask for any token count. This is a live risk today, so it goes first (prompt 0).
2. **`vinterest_pro` and `vinterest_scan_count` live in localStorage.** A user can set `vinterest_pro` to `"1"` in dev tools. Paid status and usage must move to the server. The client only displays them.
3. **The backend routing has one unresolved contradiction.** The audit is confident that `_worker.js` (Cloudflare Pages advanced mode) intercepts `/claude` directly, making `functions/claude.js` unreachable. But it separately treats `functions/api/[[route]].js` as the live router for `/api/retail`, `/api/lcbo` and `/api/claude` — which shouldn't be possible if `_worker.js` is genuinely swallowing every request itself. Either `_worker.js` only intercepts specific paths and falls through to Pages Functions for the rest (non-default but possible), or one of the two audit claims is wrong. Prompt 0's first job is resolving this with evidence (a test request to each route, or reading what `_worker.js` actually does with unmatched paths) before anything is deleted or consolidated.
4. **The pricing backend is unwired.** Apify (Wine-Searcher scraper), LCBO, and the Supabase `wine_cache` are built server-side but never called by the client — every price the user sees is a live Claude estimate. Recommendation: delete the dead routes and label prices as estimates in the UI. A scraper of Wine-Searcher inside a paid app carries the same terms-of-service risk as the Vivino one you dropped.
5. **No build step, and synchronous XHR on startup.** Supabase, RevenueCat and Capacitor all need a bundler. The blocking `_loadJSON`/`_loadTextSync` calls also fail under a raw `file://` load. Fix: add a build, inline the `data/*.json` files at build time, keep the `_loadJSON(path)` function signature so no caller changes.
6. **Storage is scattered through the screens.** Roughly 25 localStorage/sessionStorage keys are read and written directly from UI files, against the rules in CLAUDE.md. Sync needs one seam, so the refactor comes before sync.
7. **Scan photos are not stored** — the wine object in `vinterest_wines` has no image field anywhere in the audit's example or schema. That means no file storage is needed for v1. Prompt 2 re-confirms this against the live code rather than the audit's inference.
8. **Backup export/import has no version field.** Import writes an imported `xp` blob straight into localStorage, bypassing `XPSystem.save`'s account-envelope wrapping — it silently assumes the file is already in the current `accounts.local`-wrapped shape, not the legacy flat shape the app itself still migrates from (`vinterest_xp_v2`). The `Blob`+`<a download>` export pattern won't produce a file in most WebViews. Fix in prompt 3, native share later.
9. **Camera** uses `getUserMedia` with no native fallback and no permission wiring — that has to come from Capacitor plugin config, not a hand-edit of the generated native project. It may work as-is in a Capacitor WebView once permissions are declared; test on a real iPhone before deciding whether to switch to the Capacitor Camera plugin.
10. **Service worker and the update banner are dead weight in a Capacitor app** — the whole bundle already ships inside the binary — and get skipped in native builds rather than ported.

## 2. Decisions (defaults used below, change any of them)

| # | Decision | Default |
|---|---|---|
| D1 | Sign-in required before first scan, or anonymous-first? | Required, right after onboarding. Apple, Google, email. Simpler and stops free-tier abuse through throwaway accounts. |
| D2 | Prices | Keep Claude estimates, label them "est." in the UI. |
| D3 | XP conflict policy across devices | Monotonic merge (max and union). Never lowers a user's XP. Can lose XP earned simultaneously on two offline devices. |
| D4 | Dead backend (Apify, LCBO, `wine_cache`, `recognise.js`, the duplicate `retail.js`/`retail-data.js` implementations) | Delete. |
| D5 | What free vs Pro gates | Your Learn-tab rule stands: gate depth, not frequency. Scan and AI-call limits exist only as a cost cap (fair use), set generously. Depth gates on server-generated content are enforceable. Depth gates on static data bundled in the app (`data/*.json`) are not, because the app ships that data to every install. Accept that. |

## 3. Supabase schema

Create a new Supabase project for user data (the existing one only holds the dead `wine_cache` table used by the unwired retail backend). Save as `supabase/migrations/0001_user_data.sql`.

```sql
create table public.wines (
  user_id uuid not null references auth.users(id) on delete cascade,
  wine_key text not null,            -- must match WineHistory's dedupe key (confirm exact formula in Prompt 2 — not stated in the audit)
  data jsonb not null,               -- the full wine object exactly as stored on the device today
  rating int,
  times_consumed int not null default 0,
  scan_intent text,
  last_scanned timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,            -- tombstone so deletes sync
  primary key (user_id, wine_key)
);

create table public.user_docs (
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_key text not null,             -- 'xp' | 'settings' | 'favorites' | 'learn_interests' | 'learn_content' | 'flags'
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, doc_key)
);

create table public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro')),
  source text,                       -- 'revenuecat' | 'manual'
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,                -- 'label_scan' | 'list_scan' | 'scancard' | 'price' | 'explore'
  period_start date not null,        -- Monday of the week
  count int not null default 0,
  primary key (user_id, kind, period_start)
);

alter table public.wines          enable row level security;
alter table public.user_docs      enable row level security;
alter table public.entitlements   enable row level security;
alter table public.usage_counters enable row level security;

create policy "own wines" on public.wines
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own docs" on public.user_docs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Read-only for users. Only the service role (Worker, RevenueCat webhook) writes these.
create policy "read own entitlement" on public.entitlements
  for select using (user_id = auth.uid());
create policy "read own usage" on public.usage_counters
  for select using (user_id = auth.uid());

create index wines_user_updated on public.wines (user_id, updated_at);
create index docs_user_updated  on public.user_docs (user_id, updated_at);
```

Secrets: `SUPABASE_URL` and the anon key are public and go in the client. The service role key lives only in the Worker's secrets. Never in the repo, never in a prompt.

## 4. What syncs and what doesn't

| Local key(s) | Cloud home | Merge rule |
|---|---|---|
| `vinterest_wines` | `wines` table, one row per wine | Per `wine_key`. Union of both sides. If a wine exists on both, the side with the newer `last_scanned` wins for rating, intent, location and text fields; `times_consumed` takes the max. A tombstone wins if it is newer than the other side's `updated_at`. After merging, cap at 500 by `last_scanned`, as `WineHistory.save` does today. |
| `vinterest_xp_v3` (inner `accounts.local`) | `user_docs` key `xp` | `total`, `totalRatings`: max. `events`, `grapesSeen`: union. `quizCompleted`, `quizStreaks`: per-key max. `scansThisWeek`: union, then drop timestamps outside the current week. `vinterest_xp_v2` (legacy, pre-multi-account) is a one-time local migration source the app already reads via `_migrate()` — the sync engine only ever touches `vinterest_xp_v3`, never the legacy key directly. |
| `vinterest_prefs`, `vinterest_region`, `vinterest_currency`, `vinterest_country`, `vinterest_state`, `vinterest_city`, `vinterest_initial_pref`, `vinterest_travel`, `vinterest_script_length`, `vinterest_scancard_style`, `vinterest_onboarded` | `user_docs` key `settings` | Newest `updated_at` wins for the whole document. `travel` is dropped if past its `until` date. |
| `vinterest_favorites` | `user_docs` key `favorites` | Newest document wins. (Union would resurrect removed favourites.) |
| `vinterest_learn_interests` | `user_docs` key `learn_interests` | Newest document wins. |
| `vinterest_gen_stubs`, `vinterest_gen_article_<id>_done` | `user_docs` key `learn_content` (`{stubs:[], done:[]}`) | Union by stub `id`; union of done ids. |
| `vinterest_wineDNA_unlock_seen` | `user_docs` key `flags` | Union (true wins). |
| `vinterest_pro`, `vinterest_scan_count` | Not synced from the client. Server truth in `entitlements` and `usage_counters`. | Client reads them from a `/me` endpoint and caches for display only. |
| `vinterest_scancards_v5_*`, `vinterest_price_v2_*`, `vinterest_se3_*` | Not synced | Local caches, safe to lose. |
| `vinterest_scan_result`, `vinterest_winelist_result` (sessionStorage), `vinterest_errors`, `vinterest_force_mobile`, `vinterest_install_hint` | Not synced | Device-only. |

Sync behaviour:

1. Local-first. The app reads and writes local storage as it does now. A sync engine watches the stores through their `subscribe` hooks.
2. Pull on sign-in, on app foreground, and every few minutes while open. Push about 3 seconds after the last change, with a retry queue for offline.
3. First sign-in on a device: write a snapshot of all local data to `vinterest_premigration_backup`, pull the cloud copy, merge using the rules above, push the result. If the cloud is empty this is just an upload.
4. The client sets `updated_at`. The engine clamps any timestamp more than a minute in the future.
5. Export/import stays as a manual backup. Import merges through the same rules instead of overwriting.

## 5. Server rules (single Worker)

- Verify the Supabase JWT on every route except `/health`.
- `/claude`: accept only known purposes (`label_scan`, `list_scan`, `scancard`, `price`, `explore` — matching the four live call sites: label/list recognition, scancard copy, retail price estimate, and Explore's tiered suggestions). The client sends the purpose. The Worker sets the model from an environment variable, caps `max_tokens` per purpose, caps request body size, and rejects anything else.
- Meter each call in `usage_counters`. Return a JSON error with HTTP 429 when a fair-use cap is hit and 402 when a call needs Pro. The client shows the paywall or a limit message.
- `/me`: returns `{tier, usage}` for the signed-in user.
- `/account/delete`: verifies the JWT, deletes the user's rows, deletes the Supabase auth user. Later also calls RevenueCat and revokes the Sign in with Apple token.
- Origin checks are a speed bump, not security (native apps and scripts can fake headers). The JWT is the real gate.

## 6. Prompts for Claude Code, in order

Run one per session. Each works on its own branch. Review and merge before starting the next. Before merging anything that touches the app, open the Cloudflare preview deployment and click through scan, quiz and settings.

### Prompt 0: lock down the Claude proxy (do this first)

```
Read docs/native-migration-spec.md sections 1 and 5, plus docs/audit.md section 3.

1. Resolve the routing contradiction in spec section 1.3: does _worker.js intercept every request including /api/*, or does it only handle specific paths (like /claude) and let Cloudflare Pages Functions handle the rest? Test this directly against the deployed site if you can't determine it from the code alone (e.g. hit /api/retail and see whether functions/api/[[route]].js's logic actually runs). Report your finding and the evidence before changing anything.
2. Based on that finding, consolidate into one implementation of /claude and delete the redundant copies (functions/claude.js, functions/recognise.js) only if step 1 confirms they are unreachable.
3. Harden /claude for now without auth: POST only; the model comes from an env var, never from the request; per-purpose max_tokens caps; request body size cap; a required purpose value from the allowlist in the spec; origin allowlist (vinterest.app, vinterest.pages.dev, capacitor://localhost, https://localhost); per-IP rate limiting.
4. Update claude-bridge.js and each call site listed in audit.md section 3 to send the purpose.
5. Do not touch data storage or UI. Bump the version string as CLAUDE.md requires.
Explain in the PR what a user of the live app would notice (nothing, ideally).
```

### Prompt 1: add a build step

```
Read docs/native-migration-spec.md sections 1 and 6, docs/audit.md sections 4 and 6, and CLAUDE.md.

Add a scripted build (esbuild) that reproduces today's bundle.js. Requirements:
- Same file order as the precompiled markers in bundle.js. Verify by comparing behaviour, not text.
- React 18 and ReactDOM installed as npm dependencies and bundled. Remove the CDN script tags.
- Keep the _loadJSON(path)/_loadTextSync(path) function signatures, but resolve from data/*.json inlined at build time, so there is no synchronous XHR and no caller changes.
- Output to dist/: index.html, the JS bundle, data as needed, icons, manifest, sw.js, and the worker.
- Generate the version string shown in the Wine DNA screen from package.json plus a build number, replacing the manual bump rule. Update CLAUDE.md accordingly.
- Add a Playwright smoke test that loads dist/, checks for console errors, and confirms the Home, Learn and Wine DNA screens render.
Do not delete bundle.js in this PR. Tell me the exact Cloudflare Pages settings to change (build command, output directory) and wait for me to confirm before changing anything that affects deployment.
```

### Prompt 2: put storage behind logic modules

```
Read docs/native-migration-spec.md section 4, docs/audit.md section 1, and CLAUDE.md.

Goal: no UI file touches localStorage directly, and every synced key is owned by one logic module with KEY, get, save, and a subscribe(callback) that fires on change.
1. Move WineHistory, Regional and the taste-match scorer out of pwa-components.jsx into .js logic modules. pwa-components.jsx keeps only UI atoms.
2. Create logic modules for: Settings (prefs, region, currency, country, state, city, initial_pref, script_length, scancard_style, travel, onboarded), Favorites, LearnInterests, Flags, and an Entitlement module that for now still reads vinterest_pro and vinterest_scan_count but is the only place that does.
3. Replace every direct localStorage or sessionStorage access in the live UI files (see the precompiled list in bundle.js; ignore the dead/prototype files CLAUDE.md names) with calls to these modules.
4. Confirm whether a scanned wine ever stores an image or photo anywhere — the audit found none, verify against the live WineHistory code.
5. State the exact dedupe key WineHistory uses for a wine (the audit didn't pin this down) — report it back to me.
No behaviour change. Prove it: script a session (onboarding, one scan with a mock response, rate a wine, a quiz) and show the localStorage contents are identical before and after your refactor.
```

### Prompt 3: backup format v2

```
Read docs/native-migration-spec.md sections 1 and 4, and docs/audit.md section 2.

Create a Backup logic module. Export writes {format:"vinterest-backup", version:2, exported, wines, xp, settings, favorites, learn_interests, learn_content}. Import accepts version 2 and the old unversioned format (including the legacy flat XP shape that predates the accounts.local envelope — see audit.md's note on vinterest_xp_v2), validates shapes, shows a summary of what will change, and applies through the logic modules instead of writing localStorage directly. Bad files produce a specific error message instead of a generic parse-failure alert. Add unit tests for both formats and for malformed files. Keep the current UI; only the wiring changes.
```

### Prompt 4: Supabase migrations

```
Read docs/native-migration-spec.md section 3.

Add supabase/migrations/0001_user_data.sql from the spec, and a supabase/README.md listing the manual dashboard steps I must do (create project, enable email, Google and Apple providers, where to put keys). Add SQL tests that prove row-level security: user A cannot read or write user B's rows in wines and user_docs, and no user can write entitlements or usage_counters. Do not put any keys in the repo.
```

### Prompt 5: auth and server-side gating

```
Read docs/native-migration-spec.md sections 2, 4 and 5.

Add the Supabase JS client and a sign-in screen shown after onboarding (email OTP or magic link now; Google and Apple buttons present but disabled until native setup). Persist the session. In the Worker: verify the Supabase JWT (use the project's JWKS), meter usage in usage_counters with the service role key, enforce fair-use caps and Pro checks from entitlements, add /me. Make the Entitlement module read tier and usage from /me and cache them for display. Remove any code that treats vinterest_pro or vinterest_scan_count as authoritative. The client must handle 401, 402 and 429 with clear UI. For testing, I will set a tier by hand in the entitlements table.
```

### Prompt 6: sync engine

```
Read docs/native-migration-spec.md section 4 completely.

Implement sync.js exactly as specified: local-first, subscribe-driven push with debounce and an offline retry queue, pull on sign-in and foreground, first-sign-in merge with the vinterest_premigration_backup snapshot, per-key merge rules, timestamp clamping, tombstones for deleted wines. Include unit tests for each merge rule using two-device scenarios (offline edits on both, delete on one, XP earned on both). Add a small "Sync status" line in settings (last synced, pending changes, error). Do not change any screens beyond that.
```

### Prompt 7: account deletion

```
Read docs/native-migration-spec.md section 5.

Add Worker route /account/delete and a Delete Account flow in Settings with a confirmation step. It must remove the user's rows and the Supabase auth user, then clear local data and sign out. Leave clearly marked TODO hooks for RevenueCat cancellation and Sign in with Apple token revocation. Apple requires deletion to be available inside the app.
```

### Prompt 8: Capacitor shell (do this at the Mac)

```
Read docs/native-migration-spec.md sections 1 and 6, and docs/audit.md section 6.

Add Capacitor for iOS and Android with capacitor.config.json. Bundle the built web assets in the app; do not load vinterest.app remotely. Do not register the service worker or show the install banner / iOS "Add to Home Screen" hint when Capacitor.isNativePlatform() is true. Add camera permission strings (NSCameraUsageDescription, AndroidManifest CAMERA) through Capacitor plugin configuration, not by hand-editing the generated native projects (see CLAUDE.md). Add a small platform layer so backup export uses the Share plugin on native and the download link on web. Do not switch the scanner to the Camera plugin yet: I will test getUserMedia on a real iPhone first and report back.
```

After prompt 8: test the scanner on a real iPhone, then RevenueCat (payments), Sign in with Apple and Google native sign-in, store listings, TestFlight and Play closed testing.

## 7. Things only you can do

- Create the Supabase project and keep the keys.
- Change the Cloudflare Pages build settings when prompt 1 tells you to.
- Set Worker secrets (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, model name) in Cloudflare.
- Apple Developer and Google Play accounts, company setup, privacy policy, terms.
- Decide D1 to D5.
