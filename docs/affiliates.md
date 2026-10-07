# Partner shops (Awin, then Skimlinks)

Vinterest earns a commission when someone buys wine through a partner link. Links go out from
four places: **Find it for me** on a wine's Price tab (it becomes **Restock** for a wine you'd buy
again), the **Restock** button on WineDNA's “House” Wines, the **In shops now** list the live
price search finds, and **Find it** on an Explore Next style's bottles. Every tracked link is
labelled **Partner**, a visible line beside the links says "We may earn a commission if you buy
through these links. It never changes your match or what we suggest." (`ShopDisclosure`; a
tooltip never shows on a phone, and the UK ad rules and the FTC both want a clear note), partners
are never moved up a list, and nothing a partner pays changes a match, a score or a suggestion.

Everything is set in one file, `data/retailers.json`. As shipped, nothing is tracked: the
publisher ID and every shop's `awinMid` are blank, Skimlinks is off, and every shop is switched
off, so "Find it for me" is a Google search and shop links are plain links.

## How a link travels: /go

The app never links straight to a shop. Every tap goes to the Worker's `/go`
(`handleGo` in `_worker.js`), which reads `data/retailers.json` **as deployed on the website** and
decides where the tap goes and how it's tracked:

- **Find it for me / Restock / Explore's Find it**: `/go?w=<the wine>&c=<country>&p=<where>`. The
  first switched-on shop for the user's country with a search link, else a Google search.
- **A shop page** (In shops now): `/go?u=<page>&p=listing`. Only a known retailer's site, or a link
  the Worker signed itself when the price search listed it (`s=`, `_signListings`), so `/go` can
  never be used to send people to any site someone puts in a link.
- **Tracking**: Awin when that shop has an `awinMid` and the publisher ID is set; otherwise
  Skimlinks when it's switched on; otherwise the plain link. `p` (`price`, `restock`, `listing`,
  `explore`, `find`) is Awin's `clickref` and Skimlinks' `xcust`.

Because the Worker reads the deployed file, **switching a shop on, adding an ID or changing
network needs only a website deploy**: the iPhone and Android apps follow it without an app-store
update (their own copy of the file only sets the button's label and the Partner tag).

**One-time setup:** add a Cloudflare secret `GO_SECRET` (any long random string) to the vinterest
Pages project (Settings → Variables and Secrets → Add, type Secret), then redeploy. It signs the
price search's shop links so `/go` will follow them. Without it, those links open directly and
untracked; everything else still works.

## 1. Join Awin as a publisher (once)

1. Go to awin.com → **Join as a Publisher**. There's a small refundable deposit for UK accounts,
   returned with your first commission payment.
2. **Promotional space:** add vinterest.app. Describe it as a wine app that scans labels and wine
   lists, matches each bottle to the user's taste and links to shops to buy it. Category: content /
   comparison, mobile app. Say links appear on a wine's price screen and a "buy again" list, are
   labelled as partner links, and that the app is for people of legal drinking age (it asks).
3. Verify the site when asked. Awin may ask you to add a line or a meta tag to vinterest.app; send
   it to me and I'll add it.
4. Once approved, your **publisher ID** (awinaffid) is in the top bar of the Awin dashboard. Put it in
   `data/retailers.json` → `awin.publisherId`.

## 2. Join each shop's programme

In Awin: **Advertisers → Join programmes**, search for the shop. The shops applied to so far are listed in
`data/retailers.json` with their Awin IDs (Majestic, Winebuyers, The Great Wine Co., DrinkSupermarket,
Threshers, House of Decant, Wine52). Laithwaites and Naked Wines aren't on Awin (their programmes
are on other networks or in-house). Virgin Wines, Slurp and Waitrose Cellar have been suggested as
Awin merchants; check each in Awin's advertiser directory before relying on it. Add others the
same way. Each shop approves you
separately, usually within a few days; some ask about your audience or traffic. Read each one's
terms: commission rate, cookie length, and whether they allow app traffic and deep links.

When a shop approves you, its **advertiser ID** (the "mid") is on its programme page. Check it
matches that shop's `awinMid` and set `"joined": true`. Links go through Awin only for shops with
`joined`: an Awin link to a shop that hasn't approved you can land on Awin's error page instead
of the shop. Approved so far: Winebuyers (publisher ID 3114171 is set). Winebuyers' search is switched on, so "Find it for me" in the UK goes to its search through Awin.

## 3. Check the shop's search link, then switch it on

"Find it for me" opens the shop's own search for the wine. Each shop's search address is in
`search`, with `{q}` where the wine goes; the app puts in the producer and name only (no vintage,
"wine" or "buy", which can empty a shop's search). Before switching a shop on:

1. Open its `search` address in a browser with a real wine in place of `{q}`, e.g.
   `https://www.majestic.co.uk/search?Ntt=Vina%20Ardanza`. It must show results, not an error or
   the home page. If it doesn't, search on the shop's site and copy the address it uses.
2. In Awin, **Links & Tools → Link Builder**: paste that address and check it builds a working
   tracking link (some shops only allow deep links to certain pages).
3. Set `"enabled": true`.

A shop doesn't need to be switched on for **In shops now**: when the price search finds the wine at
a shop whose site is in `domains` and that shop has joined with an `awinMid`, that link is tracked anyway.

## 4. Ship it

Commit `data/retailers.json`, run `npm test`, and merge. The next deploy carries the links.
Awin's dashboard then shows clicks and sales; `clickref` says where in the app the link was tapped
(`price`, `restock`, `listing`, `explore`).

## Skimlinks: everything Awin doesn't cover

The price search finds wines at whatever shop has them, which varies by wine and country; most of
those shops will never be on our Awin list. Skimlinks (Sovrn Commerce works the same way) earns on
most of them without applying shop by shop, at a lower rate than a direct deal.

1. Apply at skimlinks.com as a publisher with vinterest.app. Describe the app as for the Awin
   application above. Check their terms allow traffic from inside an app, and expect them to ask
   about traffic.
2. Once approved, copy your **site ID** (looks like `123456X1234567`; it's in the snippet's
   address after `/js/`) into `data/retailers.json` → `skimlinks.id`, and set
   `skimlinks.enabled` to `true`. Don't paste the JavaScript snippet anywhere: the app can't run
   it, and the site has no shop links. `/go` builds Link Wrapper links on the server instead
   (`go.skimresources.com/?id=…&xs=1&xcust=<where it was tapped>&sref=<the page it's credited
   to>&url=<the shop page>`). An app tap has no web page and `/go` sends no referrer, so `sref`
   names the approved site (`skimlinks.sref`, `https://vinterest.app/` by default).
   In Skimlinks' domain settings, also list the addresses the app runs on
   (`test.vinterest.app`, `vinterest.pages.dev`) in case clicks are checked against them.
3. Deploy. From then on every shop link that isn't an Awin partner goes through
   `go.skimresources.com` (never a Google search), labelled Partner.

Awin still wins for its own shops (better rates); Skimlinks only takes the rest.

## Other countries

Each shop has a `country` (`gb`, `us`, …) and only shows to users in that market (their location or
Travel Mode). US shops such as Wine.com run their programmes on other networks (Impact, CJ); adding
one of those means a second link format in `Shops.link` (`pwa-regional.js`).

## Product feeds: the bottle itself, with Buy

A shop that publishes a product feed on Awin (Toolbox → Create-a-Feed) lets the Price tab show the
very bottle: its photo, vintage and price, and "Buy at <shop>" straight to its page (through `/go`,
placement `buy`, with the Awin tracking). Winebuyers' feed is on.

1. In Create-a-Feed, pick the shop under an advertiser-based feed (its "AWIN CSV" datafeed), then
   CSV, comma, gzip, with "Include Adult Content" ticked (alcohol is adult content). Copy the
   download URL. It holds your feed key: never paste it into the repo or a chat.
2. Add it as a GitHub Actions secret named `AWIN_FEED_<SHOP ID>` (e.g. `AWIN_FEED_WINEBUYERS`), add
   the same name to `.github/workflows/shop-feeds.yml`, and set `"feed": "awin"` on the shop in
   `data/retailers.json`.
3. The Shop feeds workflow (`scripts/shop-feeds.mjs`) loads every such feed into Supabase's
   `shop_products` (migration `0005`) each night at 04:17 UTC; run it by hand from Actions → Shop
   feeds → Run workflow. A feed that comes back less than half last night's size is not loaded.
   It needs the GitHub secrets `SUPABASE_URL` and `SUPABASE_FEEDS_KEY` (`supabase/README.md`).

The Worker's `/shop-match` finds the wine among a shop's listings by its name's words (the
producer's only has to appear), rejects listings with a telling word the wine doesn't have
(Muga's Rosado for its Reserva), prefers a single 75cl bottle of the scanned vintage, and otherwise
lists the vintages the shop has. Tests: `tests/shop-feed.spec.js`.
