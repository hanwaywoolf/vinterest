# LCBO stock near you (Ontario beta)

Ontario users see "At the LCBO" on a wine's Price tab with two links that work today:

- **Find it at the LCBO** opens lcbo.com's own search for the bottle (`/en/catalogsearch/result/?q=<producer and name>`, no vintage, through `/go`). The bottle's page there has "Check store inventory", which shows which stores have it.
- **LCBO stores in <city>** (once they've added their city on Profile, under Where You Buy Wine) opens a Google Maps search for "LCBO, <city>, ON". lcbo.com's store finder ignores anything put in its address, so it can't be opened on a city.

The LCBO's terms forbid collecting data from its websites for commercial purposes (screen scraping included), so the app only links to lcbo.com and never reads it.

Above the links, once LCBO.dev works and you switch it on, Pro users with a city also get the LCBO's product and price and up to three stores within 25 km that have it, with how many (while testing, every signed-in account is Pro).

## Where the data comes from

[LCBO.dev](https://lcbo.dev) is an independent project, not the LCBO. Its public GraphQL API (`https://api.lcbo.dev/graphql`) needs no key and allows 60 requests a minute per IP. It refreshes product and stock data daily, so counts can be a day behind; the app says so. Its terms give a limited licence for lawful use and forbid reselling or redistributing access without written permission, so **ask LCBO.dev before this becomes a paid feature for everyone**. That's why it's a beta behind a switch.

## How it works

- The app (`Lcbo` in `pwa-regional.js`) posts `{wine:{name, producer, vintage}, city}` to the Worker's `POST /lcbo` (`handleLcbo` in `_worker.js`), with the sign-in token when there is one, and keeps each answer on the phone for 20 minutes.
- The Worker finds the middle of the city's LCBO stores from LCBO.dev's own store list (cached for a day), so no geocoding service is needed. "St. Catharines" and "Saint Catharines" match. A city with no LCBO store says so.
- It searches LCBO.dev for the producer and name and scores each result by the wine's telling words (generic words like Reserva, Rouge or Domaine never make two wines the same on their own). The match is cached for a day, including "not carried".
- It asks for that product's stock within 25 km of the city with at least one bottle (cached 20 minutes, as LCBO.dev suggests) and returns the nearest three.
- Anything LCBO.dev can't answer comes back as `{available:false}`, and the Price tab shows a quiet line rather than an error.
- The product links to its lcbo.com page through `/go` (LCBO is in `data/retailers.json`, switched off, so it never becomes "Find it for me" for all of Canada and is never tracked as a partner).

## Switching it on

1. Check that LCBO.dev answers: push a commit to a `claude/` branch with `[lcbo-probe]` in its message (the LCBO probe workflow runs `npm run lcbo:check` on GitHub's machines and posts the result on the commit), or run `npm run lcbo:check` on a machine that can reach lcbo.dev.
2. In Cloudflare Pages → vinterest → Settings → Variables and secrets, add `LCBO_ENABLED` = `1` (Preview first, to try it on the branch's preview address, then Production).
3. Redeploy. Without it, `/lcbo` answers `{enabled:false}` and the Price tab shows nothing.

To turn it off again, delete the variable and redeploy. Usage counts against each account's weekly fair use under `lcbo`.
