# Partner shops (Awin)

Vinterest earns a commission when someone buys wine through a partner link. Links go out from
three places: **Find it for me** on a wine's Price tab (it becomes **Restock** for a wine you'd buy
again), the **Restock** button on WineDNA's "Worth buying again" list, and the **In shops now**
list the live price search finds. Every tracked link is labelled **Partner**, partners are never
moved up a list, and nothing a partner pays changes a match, a score or a suggestion.

Everything is set in one file, `data/retailers.json`. As shipped, nothing is tracked: the
publisher ID and every shop's `awinMid` are blank, and every shop is switched off, so "Find it for
me" is a Google search and shop links are plain links.

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

In Awin: **Advertisers → Join programmes**, search for the shop (Majestic, Laithwaites, Virgin Wines,
Naked Wines are listed in `data/retailers.json`; add others the same way). Each shop approves you
separately, usually within a few days; some ask about your audience or traffic. Read each one's
terms: commission rate, cookie length, and whether they allow app traffic and deep links.

When a shop approves you, its **advertiser ID** (the "mid") is on its programme page. Put it in
that shop's `awinMid`.

## 3. Check the shop's search link, then switch it on

"Find it for me" opens the shop's own search for the wine. Each shop's search address is in
`search`, with `{q}` where the wine goes. Before switching a shop on:

1. Open its `search` address in a browser with a real wine in place of `{q}`, e.g.
   `https://www.majestic.co.uk/search?Ntt=Vina%20Ardanza`. It must show results, not an error or
   the home page. If it doesn't, search on the shop's site and copy the address it uses.
2. In Awin, **Links & Tools → Link Builder**: paste that address and check it builds a working
   tracking link (some shops only allow deep links to certain pages).
3. Set `"enabled": true`.

A shop doesn't need to be switched on for **In shops now**: when the price search finds the wine at
a shop whose site is in `domains` and that shop has an `awinMid`, that link is tracked anyway.

## 4. Ship it

Commit `data/retailers.json`, run `npm test`, and merge. The next deploy carries the links.
Awin's dashboard then shows clicks and sales; `clickref` says where in the app the link was tapped
(`price`, `restock`, `listing`, `explore`).

## Other countries

Each shop has a `country` (`gb`, `us`, …) and only shows to users in that market (their location or
Travel Mode). US shops such as Wine.com run their programmes on other networks (Impact, CJ); adding
one of those means a second link format in `Shops.link` (`pwa-regional.js`).
