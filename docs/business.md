# Vinterest for teams

A second app in this repository that trains a restaurant's servers, bartenders, sommeliers and buyer
on the restaurant's own wine list and menu. It shares the consumer app's checked wine facts
(`data/knowledge.json`), its Claude proxy (`_worker.js`), components and theme, and is built to
`dist/team/` (`scripts/build.mjs` `buildTeam`, sources `TEAM_ALL` in `scripts/app-sources.mjs`),
so it's served at `/team/` on the same Pages project. Every preview has it:
`https://<branch>.vinterest.pages.dev/team/`.

## The pilot (built)

One restaurant on one device, made to be shown to a restaurant before accounts exist:

- **Set-up**: the restaurant's name and the manager, or the sample restaurant (`data/team-sample.json`,
  "The Copper Pan": ten wines, seven dishes, cards and pairings written ahead, four staff).
- **Upload** (managers and buyers): photos or a PDF of the wine list or menu. Claude reads them
  (`prompts/team-list.txt`, `prompts/team-menu.txt`; a PDF two pages a call). The result is a draft:
  the review says what's new, gone and changed (a new vintage, a new price, by the glass now), warns
  when most of what's live would go (one page of a long list), and takes more pages into the same draft.
  Nothing reaches staff until **Publish**.
- **Publish** writes a staff card for each new wine (`prompts/team-cards.txt`, four wines a call,
  grounded in the checked facts via `WineDeep.facts`, the list and the menu), rewrites the pairings
  for every dish (`prompts/team-pairings.txt`; a new wine can be the best match for an unchanged dish),
  and assigns what's new to every role that sells it, due in seven days. A wine's identity is the
  consumer app's (`WineHistory.same` without the vintage), so a new vintage is the same wine moving on.
- **Staff card**: what to say to a guest, what it tastes like (body, acidity, tannin, sweetness, each
  explained), grape and place, serving, which dishes on this menu, and what to offer instead from this
  list. **Dish**: its best wines, the by-the-glass choice and the one to steer guests away from.
- **Learning** (`team-learn.js`): see below. **Team** (managers): everyone's readiness, who's overdue,
  the wines the floor knows least, surprise re-check results, and each role's minimum.

## The wine-show demo

`/team/?seed=demo` opens The Larkspur (Bristol, modern British): 30 wines (15 by the glass) and 27 dishes
(`data/team-demo-list.json`), and seven staff with circle-cropped photos (`team/faces/`, `TeamSample.DEMO_STAFF`).
Its training is written: `data/team-demo.json` holds every staff card (six questions each), the pairings
for all 27 dishes and a drinking window for each of the 27 dated wines, written once through the Worker
(to rewrite it, publish from a fresh device, then "Export this restaurant's list, menu and training as a
file" and replace the file), so the demo opens complete with no network needed, and `TeamDemo.seedProgress`
puts each person at a stage: Claire (sommelier) ready, Marco (bartender) slipping at about half after three
weeks without drilling the rest, Dani (server) part way, Priya (server) overdue, Amara (server) in her first week, David (buyer) most of
the way. The live moment is **Add a wine from its label** on Upload: the consumer app's label scan reads the
bottle, the manager sets its section and prices, the review says "1 new", and Publish writes its card, pairings
and drinking window and assigns it to everyone who sells it.

Drinking windows come from the consumer app's `vintage_info` at publish (`TeamData.writeWindows`, kept on the
wine as `peak`), and `TeamData.window` says where a wine is today: Still young, At its peak, Drinking well or
Past its best, on the Wines tab and the card. A dated wine without one gets the consumer app's estimate, said
to be one.

## How staff learn

Built for retention rather than points. No XP or streaks: the motivation is being able to sell the
wine without being caught out.

- **The ladder.** Each wine has six questions on four rungs: recognise (four options, first exposure
  only), recall, apply (a guest at a table) and contrast (telling it from the most similar wine on
  the list). Recall, apply and contrast are answered from pills (`TeamLearn.choices`: ten, with the
  right ones among them, the three grapes or the three things to say, and the rest wrong but believable,
  drawn from the same kind of answer on the list's other wines, a grape for a grape and a price for a
  price; right only when the picked set is exactly right, `gradeChoices`), since typing on a phone mid
  shift was too hard; `team_grade` stays for a typed mode later. The header over a question names the
  wine only when the question itself does, never when the wine is the answer ("what would you offer
  from the list"). A rung opens once the one below is answered right. Servers and bartenders need the first
  three; sommeliers and the buyer all four. Each dish has two questions written from its pairing,
  with no Claude call.
- **The schedule.** Every question has its own review date, from how that person answered it: a
  stability in days that grows with each right answer (more when answered late and still right),
  shrinks on a miss, capped at 60 days. They say how sure they are before answering: a confident
  wrong answer comes back within hours; a right guess grows slowly.
- **Readiness.** The share of the live list and menu they know now, against their role's minimum
  (server 80% by the glass, 60% bottles, 80% dishes; bartender 90% by the glass; sommelier and buyer
  90% of everything), set per restaurant on the Team tab. Ready, Slipping (was ready, now below:
  answers faded or new wines arrived) or Not ready yet. A wine taken off the list leaves the score
  at once.
- **The daily drill.** Five questions: assigned new wines and dishes first, then what's due, then
  the next new question in list order (by the glass first). About one in ten is an unannounced
  re-ask of something known, which measures retention honestly; the Team tab shows the rate.

## Access and cost

The team purposes (`team_list`, `team_menu`, `team_cards`, `team_pairings`, `team_grade`) are open
in `_worker.js` while the pilot is two people on one laptop: no sign-in, no account, metered only by
the Worker's per-IP limit. They go into `PRO_ONLY` (with `TEAM_PRO`) once restaurants have accounts,
and the Upload tab's sign-in card comes back with them. Roughly, on Sonnet 4.6: a staff card with its questions is 3 cents, a
250-wine list from scratch about $8, a menu's pairings $1.40, a marked answer under a cent.

## The management console (planned, not built)

The phone is for the person learning. A manager wants the whole floor at once, and that needs a
screen: the same `/team/` app, laid out for a tablet or a laptop browser from 768px wide, the way the
consumer app's iPad layouts work (`useLayoutSize`, `WideColumns` in `pwa-components.jsx`). One build, one
store, one set of logic modules: a wide window shows the console, a phone shows the tabs, and nothing a
manager sees on the console is computed anywhere but `TeamLearn`, `TeamData` and a new `TeamReport`
module beside them. The phone keeps Today, Wines, Menu, Upload and Team; for a manager, Today gains a
short strip of the figures that matter on the move (team readiness, who's overdue, what's slipping,
new on the list), each tapping through to the Team tab. Everything longer waits for the big screen.

### Layout

A sidebar on the left, the restaurant's name and the signed-in manager at its top, the person switcher
under it (the pilot's "who is this?" chips, moved), then the sections. The content area is a page per
section, a 1100px column at most, cards two or three across on a landscape tablet or laptop and one
across on an upright tablet. Dark stage throughout, as the phone app is. Every number is a tap away
from the people and wines behind it, so a figure is never a dead end.

Sections, in sidebar order:

1. **Dashboard.** Readiness by person (`TeamLearn.readiness`), as a ranked list with each role's minimum
   drawn on the bar; readiness by role; who's overdue and by how long (`assignments`); what's slipping
   and why (answers faded, or new wines nobody has learnt); the retention check rate for the month
   (`retention`); the wines the floor knows least (`weakWines`), by the glass first; new-wine adoption
   (for each wine published in the last 30 days, how many of the people who sell it know it, and days
   since publish); list coverage (how much of the live list and menu has at least one person ready on
   it, and the holes: a by-the-glass wine no server on tonight's rota knows). Once sales arrive (below),
   a second row: this week's wine sales by wine, server attach rate, glass-to-bottle, trained against
   untrained. Every tile opens the people or wines it counts.
2. **Team.** Everyone, with role, readiness, the rungs they've reached per wine (the drill summary's
   per-wine view, for the whole list), their last drill, their checks, and the assignment list with due
   dates; add and remove people, set roles, set each role's minimum per part (`setNeed`, the figures
   now buried on the Team tab), and an invite (a link or code for their own phone, which needs accounts;
   until then the manager adds them here and they pick themselves on the device, as now).
3. **Wines.** The live list as a table: section, by the glass or bottle, prices, drinking window, who
   knows it and who doesn't, its card. Edit in place (price, section, glass or bottle, off the list),
   which goes through the same draft and Publish path as an upload so the audit trail (`versions`) stays
   one. The card is editable too: a manager who disagrees with "what to say" fixes the line and the
   questions written from it are flagged for rewriting.
4. **Menu.** The dishes the same way, each with its pairings and the one to steer away from, editable,
   and the menu's gaps (a dish without a good match on the list, the buyer's analysis from Next 3).
5. **Upload.** The existing flow (photos or PDF, draft, diff, Publish, watching the training get
   written), with room on a wide screen to show the draft beside what's live.
6. **Integrations.** The POS connection (which system, connected or not, last sync, rows ingested), the
   mapping table of POS items to our wines with the unmatched ones at the top, and the stock source if
   any. See the next section.
7. **Admin.** The restaurant's details, sites (once there are accounts), billing (Stripe, Next 4), data
   export (the existing Export file), and the danger zone (Start again).

### Two demos

Both from the same seeded Larkspur, so a number on the console is the number a staff member's phone
shows:

- `/team/?seed=demo` on a phone: the staff demo, as now (Claire ready, Marco slipping, Priya overdue,
  Amara in her first week; the drill; the live "add a wine from its label" moment on Upload).
- `/team/?seed=demo&view=console` on a tablet or laptop: the management demo. It opens on the
  Dashboard as Elena, the manager. The sales figures behind the dashboard's second row are invented for
  the demo (`data/team-demo-sales.json`, a few weeks of wine lines by server and night, shaped so the
  story holds: Claire sells more bottles than anyone, the wines nobody knows don't move, Marco's
  by-the-glass sales dipped the week he stopped drilling) and labelled "Demo data" wherever they show.
  `view=console` forces the wide layout on a narrow window too, so it can be checked on a phone, and
  without it the layout follows the width.

### Build order

1. `TeamReport` (`team-report.js`): every dashboard figure as a pure function of `TeamLearn`, `TeamData`
   and the sales store, with tests. Nothing in a screen computes a number.
2. The console shell (`team-console.jsx`): sidebar, sections, the wide-layout switch in `team-app.jsx`,
   the `view=console` flag. Dashboard and Team first, since they only read what exists; then Wines and
   Menu editing through the draft path; Integrations and Admin as real screens showing real state, with
   the parts that need accounts or a POS saying so plainly rather than mocking them.
3. The manager's KPI strip on the phone's Today.
4. The sales store (`TeamSales`, `team-sales.js`): the import (CSV first), the item map, and the
   dashboard's sales row, with the demo's invented sales.

## POS and stock integration (research, nothing built)

What we want from a till is small: each wine line sold, with quantity, price, time, the server, the
table or covers, and whether it was a glass or a bottle. From that we can say what sells, who sells
it, whether a trained server sells more of a wine than an untrained one, which wines are slow and
worth a push, and when a new item appears on the till before anyone has uploaded a list. Stock, if the
venue counts it anywhere we can read, adds "running low" and "delivery arrived".

One rule before any of it: sales never move a person's readiness. Readiness is what they know; sales
change what we ask them to learn first (a wine that sells forty glasses a night goes to the top of
every server's assignments), and what the manager is shown. The two stay separate numbers.

### Who exposes what

Toast: the APIs (orders, menus, labour) are for vetted partners or a venue's own custom integration,
with OAuth client credentials issued by Toast after an application, so a live connector is weeks of
process rather than a form. The quicker door is Toast's automated nightly data export: once Customer
Care turns it on for a venue, Toast drops CSV files (sales and finance summaries, order details, one set
per location per day, kept seven days) onto an SFTP server the venue gives us a key to. A reporting
partner path exists for corrected data later.
Sources: https://doc.toasttab.com/doc/devguide/apiOverview.html ,
https://support.toasttab.com/en/article/Automated-Nightly-Data-Export-1492723819691 ,
https://doc.toasttab.com/doc/platformguide/adminDataExportOverview.html

Square, including Square for Restaurants: self-serve. A developer account, an OAuth flow the venue's
owner approves in a browser, and three APIs do everything we want: Orders (SearchOrders by date, the
`order.created` and `order.updated` webhooks, scope ORDERS_READ) for the sales lines with their
catalog item ids, Catalog (ITEMS_READ) for the item names and variations (the glass and the bottle are
usually two variations of one item), and Inventory (INVENTORY_READ, the `inventory.count.updated`
webhook) where the venue tracks counts. The easiest first live connector by a distance.
Sources: https://developer.squareup.com/docs/products/orders/overview ,
https://developer.squareup.com/reference/square/inventory-api/webhooks ,
https://developer.squareup.com/docs/oauth-api/square-permissions

Clover: self-serve OAuth for a web app; orders carry line items that reference inventory items, so the
mapping is clean. Being listed in Clover's App Market (for a venue to find us) needs an approval, but
a venue can connect our app without the listing.
Source: https://docs.clover.com/docs/working-with-orders

Lightspeed Restaurant (K-Series, the one UK restaurants mostly have): partner sign-up first, then API
credentials; OAuth scopes include Financial, Items and Order & Pay. There's no maintained public OpenAPI
spec, so the integration is written against their docs and tested against a sandbox they issue.
Inventory tools that integrate with it (MarketMan, for one) pull sales hourly or daily rather than
subscribing to events, which tells us polling is the expected shape.
Sources: https://docs.codat.io/integrations/commerce/lightspeed-k/commerce-lightspeed-k-setup ,
https://www.lightspeedhq.com/uk/integrations/marketman/

UK incumbents: Zonal (Aztec) has no public self-serve API; integrations run through Zonal's ZCF server
with credentials arranged with Zonal for each venue, so that's a commercial conversation per chain
(https://developers.designmynight.com/epos-crm-integrations/zonal-epos-integration). Tevalis and Epos
Now still to research; both sell integrations, neither has been checked for a self-serve developer path.

Middleware: Omnivore (now part of Olo) puts one API in front of legacy tills (Aloha, Brink, Micros
Simphony, POSitouch), which is how most restaurant software reaches those without writing five
integrations (https://www.olo.com/omnivoreapi). Unified-commerce APIs such as Codat cover Lightspeed K
among others. Either is a per-venue fee we'd pass on, and worth it only once a venue on one of those
tills is asking.

### The plan to put to Carey

1. **A file import first.** Every till can produce a CSV of item sales by day: Toast's nightly export,
   Square's Reports export, Zonal's and Lightspeed's reports. A manager drops the file on the
   Integrations page (or we pull it from Toast's SFTP nightly once a venue gives us a key). We read the
   columns we need and ignore the rest. This works for the pilot restaurant whatever till it has, and
   it's what the demo's invented sales are shaped as.
2. **The item map.** POS item names never match a wine list ("HSE RED 175", "Rioja Res Btl"). The map
   from POS item to our wine id is made once per venue: we propose matches with the consumer app's
   name matching (`WineHistory.same`, `shopScore`'s word matching in `_worker.js` is the closer model),
   the manager confirms or fixes them on the Integrations page, and the map is kept. An item that
   appears on the till with no match is the "new on the list?" signal, shown on the Dashboard and the
   Upload page. A glass and a bottle of one wine are two POS items mapped to one wine with a size.
3. **Square as the first live connector**, since it's self-serve and the OAuth, Orders and Catalog
   calls are a few days' work in `_worker.js` (tokens are per venue and live server-side only, never in
   the app). The Toast partner application goes in at the same time, expecting weeks. Lightspeed
   through partner credentials when a venue on it signs up. Zonal when a chain asks.
4. **Stock.** Square's Inventory API where the venue counts stock in Square. Otherwise stock is a
   count the manager enters (the cellar count from Next 2) or a file from a beverage-inventory tool
   (WISK, BevSpot both export). We don't try to be the stock system.
5. **What sales drive.** Learning priority (what sells is learnt first, per role: by the glass for
   servers and bartenders, the bottle list for the sommelier); the Dashboard's sales row (by wine, by
   server, glass to bottle, attach rate per cover where covers are in the data); trained against
   untrained (a server's sales of a wine before and after they knew it, and against servers who don't,
   with the honest caveat that shifts and sections confound it); slow movers to push, with the staff
   card's "what to say" beside each; new-item detection. Readiness untouched.

Where it lives: a `sales` table in Supabase per venue once accounts exist (the pilot keeps the imported
rows on the device under `vbiz_sales_v1`, capped to the last 90 days), the item map beside it, and the
connectors in `_worker.js` as routes (`/pos/square/connect`, `/pos/square/sync`, `/pos/import`), their
secrets Cloudflare's. Every ingest is idempotent on the till's own line id, so a re-run never double
counts.

### Open questions for Carey

- Which till does the pilot restaurant use? That decides whether the first connector is Square or a
  CSV import, and whether to start the Toast application now.
- Should the demo's sales be invented (quick, shaped to tell the story, clearly labelled) or sampled
  from a real export someone can give us (slower, truer, needs anonymising)? Invented is the
  recommendation for next week; a real one replaces it when a venue is on.
- Does any venue in reach count stock in Square or a beverage-inventory tool, or is stock a manual
  count for now?

## Next

1. Accounts for restaurants: organisations, sites and members with roles in Supabase, row security
   by membership, each person on their own phone, the manager's dashboard on the web.
2. Cellar stock (spreadsheet import, label scan on delivery), role tracks, a weekly "new on the list".
3. The guest role-play with Vinny; the buyer's list analysis (dishes without a good match, price gaps,
   too much of one style).
4. Till and stock-system connections (the plan above); billing per site through Stripe (Apple 3.1.3(c) lets an app
   sold to businesses for their staff take payment outside the App Store).
