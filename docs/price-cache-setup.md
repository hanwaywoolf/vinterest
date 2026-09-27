# Price cache setup (Cloudflare KV)

Premium wines (a label estimate of about £30 / $40 or more) are priced from a live web search of
shop listings. The Worker saves each answer for 30 days so every user after the first gets it
free. That saving needs one KV namespace bound to the Pages project as `PRICE_CACHE`.

Without it, the search still works: the Worker falls back to Cloudflare's built-in cache, which
only shares answers within each data centre, so more searches get paid for.

## Steps (about two minutes)

1. Cloudflare dashboard → **Storage & Databases → KV** (older dashboards: **Workers & Pages → KV**).
2. **Create a namespace**. Name it `vinterest-price-cache` (any name works).
3. Go to **Workers & Pages → your Pages project (vinterest) → Settings → Bindings**.
4. **Add → KV namespace**.
   - Variable name: `PRICE_CACHE` (exactly this)
   - KV namespace: `vinterest-price-cache`
5. Add it for **Production**, and for **Preview** too if you test on preview builds.
6. **Redeploy** (Deployments → the latest → Retry deployment, or push a commit). Bindings only
   apply to new deployments.

## Optional

- `PRICE_MODEL` (Settings → Variables and secrets): the model used for price searches only.
  Defaults to `CLAUDE_MODEL`, then `claude-sonnet-4-6`. Sonnet 4.6 or newer gets the better
  search tool; Haiku works with the basic one.

## Checking it works

Scan a premium bottle. The price on the scan result should read "in shops now" rather than
"est.". In the KV namespace (Cloudflare → KV → vinterest-price-cache → KV pairs) you should see a
key like `price:v1:GBP:antinori:tignanello:2021`. Scanning the same wine again, from any phone,
won't add a new search.

To clear a wrong price early, delete its key there; the next scan searches again.
