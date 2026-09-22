## Process
- Every code push must bump the version string in pwa-screens-wineiq.jsx (Wine DNA, below Data Backup) — increment the patch number so a deployed build is verifiable at a glance.

## Structure

No build step. React 18 + ReactDOM load from CDN in `index.html`; JSX is pre-compiled by hand into `bundle.js` (see the `/* ---- file.jsx (precompiled) ---- */` markers for the exact file order). The repo is flat — file naming carries the separation that folders would normally give:

- **UI files** — `pwa-screens-*.jsx`, `pwa-onboarding.jsx`, `pwa-newflow.jsx`, `pwa-scancards.jsx`, `flow-*.jsx`, `tweaks-panel.jsx`. These are screens/flows: markup, layout, event wiring.
- **Logic modules** — plain `.js` files with no JSX: `pwa-xp.js`, `pwa-mastery.js`, `pwa-content-engine.js`, `pwa-grape-learning.js`, `pwa-quiz-questions.js`. These own state shape, scoring, and content generation, and are loaded (via `_loadJSON`) against the static data in `data/*.json`.
- **Shared primitives** — `pwa-components.jsx` holds both UI atoms (`Card`, `Btn`) and cross-cutting logic (`WineHistory`, `Regional`, the taste-match scorer). Treat the logic objects in this file as belonging to the logic layer even though the file extension says otherwise — don't add new UI-only code here; put new UI atoms in a screen file or a new UI file, and new stateful logic in a new `.js` module.
- **Backend** — `functions/*.js` and `_worker.js` are Cloudflare Pages Functions/Worker: the `/claude` proxy to Anthropic, and `/api/retail`, `/api/lcbo` (Supabase cache + Apify + LCBO). This is the only place third-party API keys (`ANTHROPIC_API_KEY`, `SUPABASE_*`, `APIFY_API_TOKEN`) may live. `functions/retail.js`, `functions/retail-data.js`, and `functions/api/[[route]].js` currently duplicate the same retail-lookup logic three times — when touching that logic, fix it in `functions/api/[[route]].js` (the one Cloudflare actually routes `/api/*` through) and either update or delete the other two rather than letting them drift further.
- **Data** — `data/*.json` is static reference content (XP curve, quiz bank, grape allowlist, knowledge base). Not user data — ships with the app and is read-only at runtime.
- **Dead/prototype files** — `screens-core.jsx`, `screens-detail.jsx`, `screens-growth.jsx`, `screens-modes.jsx`, `wireframe-kit.jsx`, `design-canvas.jsx`, `pwa-scan-home-temp.jsx`, `Vinterest-App-Bundle.jsx`, and the standalone `*.html` prototypes are not part of `bundle.js` and are not shipped. Don't assume something is live just because it's in the repo — cross-check against the `precompiled` markers in `bundle.js` first.

## Rules

- **UI changes stay in UI files.** Don't add `localStorage` reads/writes, scoring logic, or prompt construction directly to a screen beyond what's needed to call an existing logic module — route new stateful behavior through `pwa-xp.js`/`pwa-mastery.js`/`pwa-content-engine.js`/`pwa-grape-learning.js` (or a new module of the same shape) instead of inlining it in the screen.
- **Logic lives in separate modules**, not inline in screens. If a screen starts accumulating its own data-shape decisions (see `WineHistory` in `pwa-components.jsx` or `XPSystem` in `pwa-xp.js` as the pattern to follow), pull it out into a logic module with a `KEY`, `get`/`save`, and named operations, the same way the existing stores do.
- **No native project folders are hand-edited.** This repo has no `ios/`/`android/` directories today. If the app is ever wrapped with Capacitor, those generated native projects are never edited by hand — all native-side configuration goes through `capacitor.config.json`, Capacitor plugins, or documented build hooks, never direct changes inside the generated Xcode/Gradle project. Camera access (`getUserMedia` in `pwa-screens-main.jsx`) and the service worker (`sw.js`) both assume a standard web/PWA context and will need review before any Capacitor wrap — see the audit notes in git history for specifics.

## Backlog
- **Wine Lists**: Create and manage named lists (e.g. "Want to Try", "Restaurant picks"). "Add to List" button removed from Wine Detail → Data tab pending full build-out.
