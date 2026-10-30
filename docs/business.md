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

## The management console (built)

The phone is for the person learning. A manager wants the whole floor at once, so the same `/team/`
app lays itself out as a console on a tablet or a laptop browser from 768px (`useLayoutSize`, the
consumer app's iPad rule): a manager or buyer gets it, staff keep the phone app whatever the screen,
and `?view=console` forces it on a narrow window so it can be checked on a phone. One build, one store:
every figure on it is a function in `TeamReport` (`team-report.js`) over `TeamLearn`, `TeamData` and
`TeamSales`; the screens (`team-console.jsx`) compute nothing. Every number opens the people or wines
behind it in a drawer (a wine's card, a dish's pairings, a person's ladder). "Train on the phone view"
in the sidebar shows the phone app inside the console (for a drill as someone), and Console brings it
back. The phone's Today, for a manager or buyer, carries a strip of the figures that matter on the move
(`TeamKpiStrip`: team readiness, overdue, slipping, new on the list, this week's wine sales), each
tapping through to Team.

Sections, in sidebar order:

1. **Dashboard.** Team readiness (the average, with each role's), overdue assignments, who's slipping,
   re-checks remembered, how much of the glass list the floor covers; readiness by person as ranked
   bars in their state's colour; what needs attention and why (`TeamReport.slipping`: answers faded,
   new wines not learnt, no drill for a week); new on the list and how many of its sellers know each
   (`adoption`, wines published in the last 30 days); coverage (a wine is covered when at least half
   the people who sell it, and at least two, know it; the holes are by-the-glass wines under that);
   and "learn first" (`priority`: sells most, known least) once the till is in. Then the sales row
   (`_CSales`): wine sales for the last seven nights against the seven before, wine per cover, bottles
   and their share, the trained lift (what a server sells of a wine per shift when they know it against
   when they don't, with the caveat that shifts and sections confound it), the weekly trend, what sells,
   who sells (lines per shift, compared within a role), slow movers by the glass with the card's line
   to say, and items on the till with no wine on the list behind them.
2. **Team.** Everyone with readiness, state, overdue, fading answers, last drill and re-check record;
   a person opens to their parts against the minimum, their by-the-glass selling by week (the shape of
   Marco's dip), every wine their role sells with its rungs as dots, and every dish; add and remove
   people; each role's minimum per part. Inviting someone to their own phone needs accounts (next).
3. **Wines.** The list as a table by section: year, prices, drinking window, who knows it, sold in 28
   nights, whether it has a card. Edit (section, glass, bottle) and "take off the list" go through
   `TeamData.draftEdit`/`draftRemove` into the same draft, review and Publish as an upload, so
   `versions` stays the one audit trail and nothing reaches staff unreviewed. On a wine's card the
   manager can rewrite "what to say" in their own words (`TeamData.setCard`; the card says it was edited).
4. **Menu.** The dishes with their best wine, by-the-glass pick and the one to steer away from; dishes
   without pairings called out; price and description edits through `draftEditDish`.
5. **Upload.** The existing flow beside what's live and what was published when.
6. **Integrations.** The till (below): its state, a CSV import that works today, the live connectors and
   what each needs, the map of till items to wines with the unmatched ones first, and stock.
7. **Admin.** The restaurant's name and days-to-learn, data (all on the device; export; start again),
   accounts and billing (next), and what the writing costs.

### Publishing in the background

A publish no longer holds the screen. `TeamJobs` (`team-data.js`) runs the writing as a job: the
Upload tab is free at once, a chip at the top of every screen (`TeamJobChip`) says the step and its
count with a thin bar, "Published" when done, or why it stopped with Resume, and what's written lands
as it's saved. The writing itself is faster: a menu's pairings go in parallel batches (three calls at
once rather than in a row), windows three at a time, and pairings and windows together. Measured on
the Larkspur through the Worker on Sonnet 5.5: a label reads in about 5 seconds; a new wine's card 11
seconds; the 27 dishes' pairings about 29 seconds together (they were 65 in a row); a window 3 seconds.
So a bottle added from its label is fully on the floor, card, pairings and window, in about 45 seconds,
and the manager can be showing the dashboard while it happens.

### Two demos, and the prepared arrivals

Both from the same seeded Larkspur, so a figure on the console is the figure a phone shows:

- `/team/?seed=demo` on a phone: the staff demo (Claire ready, Marco slipping, Priya overdue, Amara in
  her first week; the drill; Elena's Today with the KPI strip).
- `/team/?seed=demo&view=console` on a tablet or laptop: the management demo, opening on the Dashboard
  as Elena. Its sales are invented (`TeamSales.seedDemo`: eight weeks, seeded, shaped so the console
  tells a true story about this team: Claire sells more bottles than anyone, wines nobody has learnt
  don't move, Marco's by-the-glass sales dipped the weeks he stopped drilling, Priya sells less per
  shift than Dani, Amara has only her first nights, and a Picpoul the till knows that the list doesn't)
  and labelled "Demo data" wherever they show.

The live moment, "Add a wine from its label", also has a prepared set for a quick or offline demo:
Carey's two bottles, photographed (`team/labels/`), each read once by the consumer app's label scan and
its training written once through the Worker against the Larkspur's list and menu
(`data/team-demo-arrivals.json`: the label reading, the staff card, the pairings it appears in, the
drinking window). On Upload in the demo, "New arrivals, prepared for the demo" offers them: Patrick
Piuze's Chablis Terroir de Fleys 2024 as a new wine (card, four pairings, window, assigned to everyone,
no call), and La Rioja Alta's Viña Ardanza Reserva 2016 as a new vintage of the 2015 on the list (the
review says "vintage 2015 → 2016", the card is kept, the window is the 2016's). "Read this label live
instead" sends the bundled photo through the real scan for the live version, and any other bottle goes
through the live path as before (`TeamSample.applyPrepared`, only in the demo restaurant).

## POS and stock integration (the CSV import and item map built; connectors researched)

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

### What Square would give the app

Square is the first live connector because it's the one a venue can switch on without a sales call,
and because its three APIs map onto exactly what the console needs:

- **Orders** (`SearchOrders` by closed date, the `order.created`/`order.updated` webhooks, scope
  `ORDERS_READ`): every line sold with its catalog object id, quantity, price, the employee who rang it
  (`team_member_id` once Team is on) and the table or ticket name. That is `TeamSales.ingest` with
  real rows: the dashboard's sales row, who sells, the trained lift and the slow movers run as they do
  on the demo data, nightly or as orders close.
- **Catalog** (`ITEMS_READ`): item names and variations. A wine is one item whose variations are the
  glass sizes and the bottle, so the item map is mostly made for us: variations of one item map to one
  wine with a size. A catalog item that appears with no wine behind it is the "new on the list?"
  signal, shown on the Dashboard and the Upload page before anyone has photographed a list.
- **Inventory** (`INVENTORY_READ`, the `inventory.count.updated` webhook): counts per variation where
  the venue tracks stock in Square. That gives "running low" beside a wine the floor is pushing,
  "delivery arrived" when a count jumps (a nudge to re-check the vintage), and a wine that sold out
  leaving the staff's assignments until it's back.

What it never does: move readiness. Sales reorder what people learn first and what the manager sees.
The connector lives in `_worker.js` (`/pos/square/connect` for the OAuth exchange, `/pos/square/sync`
on a schedule, the venue's tokens in Supabase, never in the app) and needs restaurant accounts first,
which is why the CSV import comes first: it does the same job by hand today.

### The plan

1. **A file import first (built).** Every till can produce a CSV of item sales by day: Toast's nightly
   export, Square's Reports export, Zonal's and Lightspeed's reports. A manager drops the file on the
   Integrations page (`TeamSales.importCSV`: the date, item, quantity, price, server and id columns
   read by name, the rest ignored, a line never counted twice, servers matched to the team by name).
   Later we pull it from Toast's SFTP nightly once a venue gives us a key. This works for the pilot
   restaurant whatever till it has, and it's the shape the demo's invented sales take.
2. **The item map (built).** POS item names never match a wine list ("HSE RED 175", "Rioja Res Btl").
   The map from till item to our wine id is made once per venue: `TeamSales.suggest` proposes a match
   on the item's telling words against each wine's producer and name (sizes and "Btl" ignored), the
   manager confirms or fixes it on the Integrations page, and the map is kept (`vbiz_sales_v1`). An item that
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
- The demo's sales are invented and labelled; a real venue's export replaces them when one is on.
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
