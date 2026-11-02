# The website (vinterest.app): setup

The site lives in `site/` and builds to `site-dist/` with `npm run site:build`. It is separate from
the app (`npm run build` -> `dist/`): its own Cloudflare Pages project, its own deploy.

## Cloudflare Pages project

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm ci && npm run site:build` |
| Build output directory | `site-dist` |
| Custom domain | `vinterest.app` (and `www`, redirected to it) |

Build variables (all optional):

- `CF_ANALYTICS_TOKEN`: the token from Cloudflare -> Web Analytics -> Add a site. Without it no analytics script is added. Web Analytics sets no cookies, so the site needs no cookie banner.
- `SITE_ORIGIN`: the public address for the share card and sitemap. Default `https://vinterest.app`.

Runtime variables (Settings -> Variables and secrets), for the beta sign-up:

- `SUPABASE_URL`: the same project as the app.
- `SUPABASE_SECRET_KEY` (secret): the server key. Without both, the form answers "Beta sign-ups aren't open just yet" and nothing else breaks.

## Database

Run `supabase/migrations/0004_beta_signups.sql` once in the Supabase SQL editor (same steps as the
earlier migrations in `supabase/README.md`). The table has row-level security on and no policy for
anyone, so only the Worker (secret key) can read or write it. `npm run test:db` proves that.

Read the list in the Supabase dashboard (Table editor -> `beta_signups`), or export it as CSV.

## /test: the web app moves

The app is currently served from the root of its own project (`vinterest.pages.dev`), and its
`index.html`, `manifest.json`, service worker and API calls use root-relative paths (`/claude`,
`/manifest.json`, `/sw.js`, `/icons/...`). Serving it at `vinterest.app/test` therefore needs a
small change in the app first (a base path for those, and a service-worker scope of `/test/`), then
a route that sends `vinterest.app/test*` to the app's project. The site itself no longer links to
the web app (beta users get the native apps), so this only matters for anyone who uses the URL directly.

## Demos

The phones on the page are the app's own screens (Home, WineDNA, Learn, My Wines, the scan result)
running from `demo.js`, which `scripts/site.mjs` builds from the app's sources (all of
`scripts/app-sources.mjs` except `pwa-app.jsx`) plus `site/demo/`. The demo user is the imaginary
Rioja-loving red drinker from `data/onboarding-sample.json`, held in memory only (`site/demo/store.js`
points `Store` at a memory area, so nothing touches the visitor's own storage, which on
`vinterest.app` is the same origin as the web app).

Text that Claude writes on those screens (the WineDNA summary, the sommelier script) is captured
once into `site/demo/captured.json` with `npm run site:build && npm run site:capture` and shipped as
data; Vinny's answer is the one in `data/onboarding-sample.json`. Rerun the captures after changing
the sample user or their prompts. `npm run site:og` remakes the share card (`site/og.png`).

## Copy and legal

Copy is in `site/index.html`. `site/privacy.html` and `site/terms.html` are drafts written from how the
app works today; they say so on the page, hold `[bracketed]` gaps (company name and address,
jurisdiction, legal bases) and need a lawyer's review before launch. `hello@vinterest.app` is a
placeholder contact address.

## Confirmation emails (Resend)

A new sign-up gets a short "You're on the list" email, sent by the Worker through Resend. It is optional:
without `RESEND_API_KEY` nothing is sent and the form works as before. A failed email never fails the
sign-up, and someone who signs up twice is emailed once.

1. Create a Resend account and open Domains -> Add Domain -> `vinterest.app`.
2. Add the DNS records Resend shows (SPF `TXT`, DKIM `TXT`, and the return-path `MX`/`TXT`) in
   Cloudflare DNS for vinterest.app. Set them to "DNS only" (grey cloud). Wait for the domain to read
   Verified. Without this Resend only sends to your own address.
3. API Keys -> Create API Key, "Sending access" for that domain. Copy it once.
4. In the site's Pages project -> Settings -> Variables and secrets (Production), add
   `RESEND_API_KEY` (as a Secret) and, if you want a different sender than
   `Vinterest <hello@vinterest.app>`, `RESEND_FROM`. The sender's domain must be the verified one.
5. Redeploy (Deployments -> Retry deployment), then sign up with your own address to check it arrives.

Replies go to `hello@vinterest.app`, so that mailbox has to exist (Cloudflare Email Routing can forward it).
Legal pages mention that email is used only for the beta; keep the email's wording in step with them.


## Vinterest Teams (vinterest.team)

The teams website is `site/teams/` and builds to `site-teams-dist/` with `npm run site:teams:build`
(`scripts/site-teams.mjs`). It is its own Cloudflare Pages project, separate from the consumer
site above and from the app, so it can carry its own domain.

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Build command | `npm ci && npm run site:teams:build` |
| Build output directory | `site-teams-dist` |
| Production branch | `main` |
| Custom domain | `vinterest.team` (and `www`, redirected to it) |

Setup, once: Workers & Pages → Create → Pages → Connect to Git → the vinterest repository (a second
project on the same repository is fine) → the settings above. Then Custom domains → Set up a custom
domain → `vinterest.team`. With the domain's DNS on Cloudflare the records are added for you;
otherwise add the CNAME it shows at the registrar. Add `www.vinterest.team` the same way, as a custom
domain on this project and not only a DNS record (a DNS record alone gives a 522); the site's
`_redirects` then sends it to the apex.

Pages: `index.html` (/), `restaurants.html`, `groups.html`, `wineries.html`, `pricing.html`, each
served without `.html`. They share `site.css`, `site.js` (the Test Your List form) and three parts
filled in at build time: `_nav.html`, `_test.html`, `_footer.html`. A new page is a new `.html` file
in `site/teams/`: the build picks it up, adds it to the sitemap, and `tests/teams-site.spec.js`
should list it in `PAGES`.

The project is `vinterest-teams`: production at https://vinterest-teams.pages.dev, and every push of a branch deploys a preview at `https://<branch with / as ->.vinterest-teams.pages.dev`. While the site lives on `claude/teams-site`, that branch is set as the production branch; set it back to `main` at the merge.

Build variables (all optional):

- The restaurant demo buttons open the teams app from the same branch as the site:
  `https://demo.vinterest.team` from `main`, `https://<branch>.vinterest.pages.dev/team/` from any
  other branch (from `CF_PAGES_BRANCH`, which Cloudflare sets). `TEAM_DEMO_URL` overrides it. The
  old `DEMO_ORIGIN` variable is ignored and can be deleted.

  `demo.vinterest.team` is a custom domain on the **app** project (`vinterest`), not this one: Workers
  & Pages → vinterest → Custom domains → Set up a custom domain → `demo.vinterest.team`. The app's
  Worker (`serveTeamDemo` in `_worker.js`) serves the team app at that address's root and seeds The
  Larkspur on a first visit; `https://vinterest.pages.dev/` stays the consumer app.
- `CF_ANALYTICS_TOKEN`: as for the consumer site; a separate Web Analytics site for this domain.
- `SITE_ORIGIN`: the public address for the sitemap. Default `https://vinterest.team`.

"Test Your List" on the page is a mockup of the flow for now: the upload control works but nothing
is read until the site build wires it to the Worker.
