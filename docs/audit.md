# Vinterest — Codebase Audit

Snapshot of every place the app touches device storage or a network API, as of this commit. `bundle.js` is the shipped artifact — file references below point at the pre-compiled source files (see the `/* ---- file.jsx (precompiled) ---- */` markers in `bundle.js` for the exact build order); line numbers are from the source files, not `bundle.js`.

## 1. Persisted data keys

All persistence is `localStorage` (plus two `sessionStorage` handoff keys and the Cache Storage API for the service worker). **No IndexedDB anywhere in the app.**

### Core data stores

| Key | Owning file | Shape | Example |
|---|---|---|---|
| `vinterest_wines` | `WineHistory` in `pwa-components.jsx:254-321` | Array of wine objects, capped at 500 (`save()` does `.slice(0,500)`). Each object is the AI-scan result plus history fields. | `[{"name":"Barolo DOCG","producer":"Terre del Barolo","vintage":2016,"region":"Piedmont","sub_region":"Barolo","country":"Italy","type":"red","grapes":["Nebbiolo"],"body":0.88,"tannins":0.9,"acidity":0.75,"sweetness":0.03,"abv":14,"tasting_notes":["Dried roses and violets","Tar and leather"],"food_pairings":["Braised beef short ribs"],"price_usd":28,"community_rating":4.1,"description":"...","why_you_will_like_this":"...","body_plain":"...","tannins_plain":"...","acidity_plain":"...","sweetness_plain":"...","rating":66,"times_consumed":115,"scanned_at":"2026-06-12T17:48:56.254Z","last_scanned":"2026-06-12T17:49:00.648Z","scan_location":{"name":"Dinner at The Ledbury","added_at":"2026-06-12T17:49:00Z"},"scan_intent":"tasted"}]` |
| `vinterest_xp_v3` | `XPSystem` in `pwa-xp.js:20-47` | `{version:1, accounts:{local:{total, events:[], scansThisWeek:[], totalRatings, grapesSeen:[], quizCompleted:{}, quizStreaks:{}}}}` — multi-account envelope wrapping one implicit `local` account. | `{"version":1,"accounts":{"local":{"total":1805,"events":["type_red","country_italy","ratings_10"],"scansThisWeek":[1781447835046,1781447953756],"totalRatings":24,"grapesSeen":["sangiovese","tempranillo","nebbiolo"],"quizCompleted":{"regions_beginner":50,"red_grapes_beginner":50},"quizStreaks":{"regions_beginner":6}}}}` |
| `vinterest_xp_v2` | `XPSystem.LEGACY_KEY`, read once by `_migrate()` in `pwa-xp.js:31-37` | Same inner shape as one `accounts.local` entry above (pre-multi-account). Read-only migration source; new writes always go to `vinterest_xp_v3`. | `{"total":1805,"events":[...],"scansThisWeek":[...],"totalRatings":24,"grapesSeen":[...],"quizCompleted":{...},"quizStreaks":{...}}` |

### Preferences / profile keys

| Key | Owning file(s) | Shape | Example |
|---|---|---|---|
| `vinterest_prefs` | Written in `pwa-newflow.jsx:14`, `pwa-screens-account.jsx:64,76`; read in `pwa-screens-account.jsx:46` | Free-form object, keyed by whatever `savePrefField`/onboarding writes into it (`location`, quiz-answer arrays, etc). | `{"location":{"country":"United Kingdom","region":"","city":"London"},"types":["red","sparkling"]}` |
| `vinterest_region` | `pwa-newflow.jsx:19,32`, `pwa-screens-account.jsx:78`, `pwa-screens-aux.jsx:846` | One of `uk\|us\|ontario\|australia\|nz\|eu` | `"uk"` |
| `vinterest_currency` | `pwa-newflow.jsx:22`, `pwa-screens-account.jsx:79` | ISO currency code string | `"GBP"` |
| `vinterest_country` / `vinterest_state` / `vinterest_city` | `pwa-newflow.jsx:23-25`, `pwa-screens-account.jsx:73-75` | Plain strings | `"United Kingdom"` / `""` / `"London"` |
| `vinterest_initial_pref` | `pwa-newflow.jsx:27`, `pwa-onboarding.jsx:8` | First selected wine-type string | `"red"` |
| `vinterest_travel` | `Regional` in `pwa-components.jsx:401-439` | `{active, country, sym, code, until}` — a temporary currency override, auto-expires past `until` | `{"active":true,"country":"France","sym":"€","code":"EUR","until":"2026-10-01"}` |
| `vinterest_onboarded` | `pwa-app.jsx:5,10,79`, `Vinterest-App-Bundle.jsx:13,18,78` | `'1'` once onboarding is complete | `"1"` |
| `vinterest_pro` | `pwa-app.jsx:105`, `pwa-components.jsx:134,157,226`, `pwa-screens-main.jsx`, `pwa-screens-home.jsx`, `pwa-screens-quiz.jsx:58` | Truthy string flag for paid tier (checked with `localStorage.getItem('vinterest_pro')`, no JSON parse) | `"1"` |
| `vinterest_scan_count` | `pwa-screens-main.jsx:196-197,238-239`, `pwa-components.jsx:135` | Integer stored as string, incremented per scan | `"22"` |
| `vinterest_favorites` | `pwa-screens-detail.jsx:58-68` | Array of `{name, vintage}` | `[{"name":"Purple Angel","vintage":2017}]` |
| `vinterest_learn_interests` | `pwa-screens-explore.jsx:352,386-390` | Array of `{region, wineType, label, addedAt}` — "gaps" the user asked to learn about | `[{"region":"Piedmont","wineType":"red","label":"Barolo","addedAt":"2026-06-20T10:00:00Z"}]` |
| `vinterest_script_length` | `pwa-screens-home.jsx:112,339`, `pwa-screens-wineiq.jsx:293,729`, `pwa-screens-aux.jsx:6,137` | One of a small enum of sommelier-script verbosity settings | `"medium"` |
| `vinterest_scancard_style` | `pwa-scancards.jsx:104,106` | `'deck'` or an alternate card layout id | `"deck"` |
| `vinterest_wineDNA_unlock_seen` | `pwa-screens-quiz.jsx:68-69` | One-shot flag once the WineDNA feature unlock animation has been shown | `"1"` |
| `vinterest_gen_stubs` | `ContentEngine` (`pwa-content-engine.js:170-226`) | Array of generated-article "stub" objects (id, archetype, title/subtitle, template slots, retrieved facts) | `{"id":"ev_type_red_x","archetypeId":"first_type","title":"...","subtitle":"...","slots":{...},"facts":[...]}` |
| `vinterest_gen_article_<id>_done` | `pwa-content-engine.js:211`, `pwa-screens-quiz.jsx:88,175` | `'1'` once a specific generated article has been read | `"1"` |
| `vinterest_article_1_done` | `Vinterest-App-Bundle.jsx:2952,2981` (legacy path — see note below) | `'1'` | `"1"` |
| `vinterest_errors` | Written by an app-wide error handler; read in `pwa-screens-aux.jsx:892` | Array of `{context, message}` | `[{"context":"processLabelCapture","message":"Unexpected token < in JSON"}]` |
| `vinterest_force_mobile` | `pwa-app.jsx:16`, `tweaks-inline.compiled.js` | Debug/dev flag to force the mobile layout on desktop | `"1"` |
| `vinterest_install_hint` | inline script in `index.html:186-187` | One-shot flag: iOS "Add to Home Screen" hint shown once | `"1"` |

### Per-item AI-response caches (dynamic key names)

| Key pattern | Owning file | Purpose |
|---|---|---|
| `vinterest_scancards_v5_<name>_<vintage>_<matchPct>` | `pwa-scancards.jsx:28-30` | Caches the generated pairing-card copy (facts/match note) for one wine so it isn't re-requested from Claude on every view. |
| `vinterest_price_v2_<name>_<vintage>_<currencyCode>` | `fetchRetailEstimate` in `pwa-components.jsx:445-451` | Caches the Claude-derived retail price estimate for one wine in one currency — the single source of truth used by both Wine Detail's price tab and wine-list value badges. |
| `vinterest_se3_<gapWine>_<currencyCode>` | `pwa-screens-explore.jsx:356,361-362,377` | Caches the 4-tier (budget/value/mid-range/top-tier) bottle suggestions Claude generates for an Explore "gap" (a style/region the user hasn't tried). |

### `sessionStorage` (per-tab, not persisted across restarts)

| Key | Owning file | Shape |
|---|---|---|
| `vinterest_scan_result` | `pwa-screens-main.jsx:195,237`, `pwa-screens-wineiq.jsx:797` | `{demo:boolean, wine:{...}, confidence:number, existingRating?:number}` — handoff from the scan screen to the result/detail screen |
| `vinterest_winelist_result` | `pwa-screens-main.jsx:192` | `{demo:boolean, reason?:string, wines?:[...]}` — handoff for the wine-list scan mode |

### Cache Storage (`caches`, not `localStorage`)

`sw.js:2` — cache name `vinterest-v13`. Pre-caches the three PWA icons on install; network-first with cache fallback for `index.html`/`.jsx`/`.js`/manifest; cache-first for `/icons/*` and cross-origin CDN requests (React/ReactDOM/fonts). Old cache versions are purged on activate.

**Note on `Vinterest-App-Bundle.jsx`**: several keys above (`vinterest_article_1_done`, an older `vinterest_pro` check at line 2394, etc.) are only referenced there, not in any file that `bundle.js` actually includes — see CLAUDE.md's "dead/prototype files" list. They're documented here for completeness but are not live in the shipped app.

## 2. Export / import format

Implemented once: `pwa-screens-wineiq.jsx:817-848`, the "Data Backup" card on the Wine DNA screen.

- **Export** (`pwa-screens-wineiq.jsx:821-827`): builds `{wines: WineHistory.getAll(), xp: XPSystem.get(), exported: new Date().toISOString()}`, wraps it in a `Blob` (`type: 'application/json'`), creates an object URL, and clicks a synthetic `<a download="vinterest-backup-YYYY-MM-DD.json">`.
- **Import** (`pwa-screens-wineiq.jsx:828-845`): opens a synthetic `<input type="file" accept=".json,application/json">`, reads the chosen file with `FileReader.readAsText`, `JSON.parse`s it, and if `d.wines` is present calls `WineHistory.save(d.wines)`; if `d.xp` is present it writes straight into `localStorage[XPSystem.KEY]` (bypassing `XPSystem.save`'s account-envelope wrapping — this assumes the imported `xp` blob is already in the current `accounts.local`-wrapped shape, not the legacy flat shape). Ends with `alert()` and `window.location.reload()`.
- No format version field, no schema validation beyond the two `if (d.wines)` / `if (d.xp)` presence checks, and a bad file only produces a generic "Could not read backup file" alert on JSON-parse failure — a validly-parsed but wrong-shaped JSON file (e.g. missing `accounts.local`) is written through unvalidated.

## 3. External API calls

### Anthropic (Claude)

Every client-side call to Claude goes through one bridge: `claude-bridge.js` installs `window.claude.complete()`, which `fetch()`es the endpoint from `<meta name="claude-proxy">` in `index.html:18` (value `/claude`), or `window.CLAUDE_PROXY_URL` if set.

Call sites:
- `pwa-screens-main.jsx:231-234` — label recognition (photo → wine JSON), and `pwa-screens-main.jsx` list-mode capture (`processListCapture`, same file) — wine-list OCR/extraction.
- `pwa-scancards.jsx:58` — generates the pairing-card copy (facts + match note) shown after a scan.
- `pwa-components.jsx:448-`(`fetchRetailEstimate`) — retail price estimate for a specific wine.
- `pwa-screens-explore.jsx:369` — 4-tier bottle suggestions for an Explore "gap."

Server side, `/claude` is handled redundantly by two implementations that both proxy to `https://api.anthropic.com/v1/messages`:
- `_worker.js` (Cloudflare Pages "advanced mode" Worker) — intercepts `/claude` directly in `fetch()`.
- `functions/claude.js` — a Cloudflare Pages Function at the same route.

Because `_worker.js` exists, Cloudflare Pages runs in advanced mode and `_worker.js` handles every request itself (including `/claude`) — `functions/claude.js` is present but not reachable while `_worker.js` is deployed. `ANTHROPIC_API_KEY` is read from the Pages environment in both; the key never reaches the browser.

There's also a third, unused proxy for the same model call: `functions/recognise.js` (`/recognise`) — its own comment says "Not currently called by the client... kept for parity in case a direct-endpoint flow is wired up later." No client code calls `/recognise`.

### Cloudflare

Cloudflare Pages *is* the hosting/backend, not a separate integration — `_worker.js` (root) and everything under `functions/` are Cloudflare Pages Functions. Routes:
- `/claude` → Anthropic proxy (`_worker.js`, `functions/claude.js`).
- `/recognise` → duplicate Anthropic label-recognition proxy (`functions/recognise.js`), unused.
- `/api/claude`, `/api/lcbo`, `/api/retail` → `functions/api/[[route]].js` (catch-all router).
- `functions/retail.js` and `functions/retail-data.js`/`functions/api/retail-data.js` implement the same `/api/retail`-style Supabase+Apify logic a second and third time, outside the `[[route]].js` router. Only `functions/api/[[route]].js` is on the path Cloudflare actually routes `/api/*` requests through; the standalone `retail.js`/`retail-data.js` files are dead unless something outside this repo routes to them directly by filename.

### Supabase

Server-side only, never called from client code. Used purely as a 7-day pricing cache (`wine_cache` table):
- Read: `functions/api/[[route]].js:65-84` (inside the `/api/retail` handler) and duplicated in `functions/retail.js:27-51` / `functions/api/retail-data.js`. `GET {SUPABASE_URL}/rest/v1/wine_cache?wine_key=eq.<cacheKey>&select=*` with `apikey`/`Authorization: Bearer` headers from `SUPABASE_ANON_KEY`.
- Write: `functions/api/[[route]].js:126-148` and duplicates — `POST {SUPABASE_URL}/rest/v1/wine_cache` after a fresh Apify lookup.

### Apify

Server-side only, never called from client code. `functions/api/[[route]].js:90-104` (and duplicated in `functions/retail.js:56-71` / `functions/api/retail-data.js`): `POST https://api.apify.com/v2/acts/abotapi~wine-searcher-scraper/run-sync-get-dataset-items?token=<APIFY_API_TOKEN>` — runs the Wine-Searcher scraper actor synchronously to get retail listings for a wine+vintage.

### Other

- **LCBO** (Ontario liquor board) — `functions/api/[[route]].js:37-45`: `POST https://api.lcbo.dev/graphql`, unauthenticated, unrelated to Supabase/Apify. Also unused by any client code found.
- No client-side calls to Supabase, Apify, or LCBO exist anywhere in the `.jsx`/`.js` source files that feed `bundle.js`.

## 4. What data comes from `data/*.json` vs. is user-generated

**Static, bundled, read-only** (loaded once via synchronous XHR through `_loadJSON`/`_loadTextSync`, never written to):
- `data/xp-curve.json` → `XP_CURVE`/`XP_LEVELS` (`pwa-xp.js:4-5`)
- `data/concepts.json`, `data/concept-templates.json`, `data/quiz-archetypes.json` → `pwa-mastery.js:4-6`
- `data/knowledge.json`, `data/archetypes.json`, `data/triggers.json` → `pwa-content-engine.js:5-7`
- `data/grapes-allowlist.json` → `pwa-grape-learning.js:7`
- `data/quiz-bank.json` → `pwa-quiz-questions.js:2`
- `data/onramp.json` → `pwa-screens-learn.jsx:4`
- `wines-db.json` (repo root, not under `data/`) — local fallback wine database, per README; not currently wired into any `_loadJSON` call found in the shipped files.

**User-generated, written at runtime**: everything under §1 above — `vinterest_wines`, `vinterest_xp_v3`, all preference keys, favorites, learn interests, generated-article stubs, and all the per-item AI-response caches. None of it ships with the app; it all originates from user actions (scanning, rating, onboarding answers) or from a live Claude response being cached locally.

## 5. What currently feeds the retail/pricing lookup

The Supabase/Apify/LCBO backend described in §3 is fully implemented server-side but **not called by the shipped client**. In practice, every price the user sees comes directly from Claude:

- The initial `price_usd` on a scanned wine comes from the label-recognition prompt itself (`pwa-screens-main.jsx`'s `LABEL_PROMPT`), which asks Claude to include a `price_usd` field in its JSON response — a model estimate, not a lookup.
- The Wine Detail price tab and wine-list value/markup badges both go through `fetchRetailEstimate` (`pwa-components.jsx:448-`), which sends a dedicated prompt asking Claude for "the ACTUAL known retail price for this SPECIFIC wine" in the user's currency, and caches the answer in `vinterest_price_v2_*`.
- The Explore screen's 4-tier bottle suggestions (`pwa-screens-explore.jsx:368`) likewise ask Claude directly for `price_local` per suggested bottle, caching to `vinterest_se3_*`.

So the Supabase cache table, the Apify Wine-Searcher scrape, and the LCBO GraphQL proxy are a built-but-unwired backend — real infrastructure sitting behind routes nothing in the app currently requests.

## 6. What will break in a Capacitor WebView

- **Camera access has no native fallback.** `pwa-screens-main.jsx:164` calls `navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})` directly against a `<video>` element, then captures a frame to `<canvas>` for upload. There's no Capacitor Camera plugin and no `<input capture>` fallback. This only works in a Capacitor WebView if the native project separately declares camera permission (`NSCameraUsageDescription` on iOS, `CAMERA` in `AndroidManifest.xml`) and the WebView is configured to allow media capture — neither is something this web code can provide, and per CLAUDE.md's native-folders rule, that permission wiring has to happen through Capacitor plugin config, not a hand-edit of the generated native project.
- **Synchronous XHR for all static data.** `_loadJSON`/`_loadTextSync` (defined in `pwa-xp.js:3` and `pwa-grape-learning.js:10`, reused by `pwa-mastery.js`, `pwa-content-engine.js`, `pwa-grape-learning.js`, `pwa-quiz-questions.js`, `pwa-screens-learn.jsx:2`) use a blocking `XMLHttpRequest` to fetch `data/*.json` on module load. This blocks the main thread on startup, and only resolves at all if Capacitor serves the bundle over its local `https://`/`capacitor://` scheme with same-origin relative paths intact — it would silently fail under a raw `file://` load.
- **Backup export won't produce a file.** The `Blob` + `URL.createObjectURL` + synthetic `<a download>` pattern in `pwa-screens-wineiq.jsx:821-827` depends on a desktop/mobile browser's download manager. Most WebViews (including a default Capacitor WebView with no `Filesystem`/`Share` plugin wired up) either no-op the click or navigate away instead of saving a file — the Data Backup export is very likely non-functional as-is inside Capacitor.
- **Backup import likely still works**, since the synthetic `<input type="file">` click in `pwa-screens-wineiq.jsx:829` generally still opens a native file/document picker inside a WebView, but this hasn't been tested and depends on the WebView's file-input support being enabled.
- **The service worker assumes a real browser PWA lifecycle.** `sw.js` plus the update-banner wiring in `index.html:95-143` (`navigator.serviceWorker.register`, `reg.update()` polling every 60s, `visibilitychange` listener, `SKIP_WAITING` postMessage) is dead weight in a Capacitor app — the whole bundle already ships inside the native binary, and WKWebView's service-worker support is limited/version-dependent. At best this is unnecessary; at worst it double-caches or fights with how Capacitor delivers updates.
- **`window.location.reload()` after import** (`pwa-screens-wineiq.jsx:839`) and the iOS "Add to Home Screen" install hint (`index.html:180-197`, gated on `navigator.standalone`) are meaningless inside a Capacitor shell — the app is already installed — but are harmless no-ops rather than breakage.
