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

## The Social Corner install

`/team/?seed=social` opens The Social Corner (Vancouver, Italian and Spanish; Per Se Hospitality Group), the
first install for a real restaurant, built from its website (`intake/perse/`: the site's copy, every menu
transcribed with its prices, its logos and photos). `data/team-social-list.json` holds its 41 wines (the
drinks page's sparkling, rosé, white and red, 5oz price as the glass, 8oz under "other", plus the Moscatel on
the dessert menu) and 62 dishes (tapas, pasta, greens and soup, pizza, entrées, caviar, brunch and dessert;
sides and add-ons are left out, the Lobster & Crab Ravioli is one dish at both its prices, and the entrée lamb
is "Lamb Rack, Saffron Risotto" so it isn't the tapas chops). The venue carries its city, its currency (`$`,
CAD, so `TeamData.currency()` reads the venue's before the device's) and its branding: `venue.brand` {logo,
logoDark, mark, accent}, the white "per se SOCIAL CORNER" wordmark in place of the restaurant's name in the
header and the console, the circle emblem in place of the Vinterest logo, and the gold accent (#A88963) in the
header's glow (`TeamVenueLogo`, files in `team/brand/social-corner/`). Primary buttons stay crimson. For the
demo it carries a team (`staff` in the list file): the Larkspur's people and photos in Social Corner roles, Elena
Ruiz the manager it opens as, Claire Whitfield sommelier, Marco Delgado bartender, and Dani Haddad, Priya Nair,
Amara Okafor and David Chen serving. `TeamDemo.seedProgress` gives them the Larkspur's stories (Claire ready, wines
and cocktails; Marco slipping, most of the cocktails; Dani part way; Priya overdue; Amara in her first week; David
steady on the glass list) and `TeamSales.seedDemo` eight weeks of invented till sales, labelled Demo data: open
every day, busier than the Larkspur, 5oz and 8oz pours at the list's own dollar prices, and the happy-hour white
(The Hatch B. Yanco, $42) as the till item the list doesn't carry. Without that `staff` an install opens on
`TeamSetup`'s installed form, where whoever opens it becomes the manager. Its training (`data/team-social.json`: every card, pairing and drinking window)
was written once through the branch preview's Worker on Claude Opus 5.5 (`TEAM_MODEL`), then exported; until
that file holds it, the list and menu load alone and Upload's "Write them now" writes it.

**Cocktails.** A restaurant can have a cocktail list beside its wines: The Social Corner's 20 from its drinks page
(Signatures, Inspired Cocktails, Spritzes, Margaritas, Sangria; the three sangrias named "Sangria Blanca" and so on),
ingredients exactly as listed, the bartender credited where the list credits one. Each gets a card
(`TeamData.writeCocktailCards`, `prompts/team-cocktail-cards.txt`, purpose `team_cocktails`, four a call with the
whole cocktail list and the menu): what to say, the base spirit, every unusual ingredient or technique explained
(a "wash", "milk clarification", Licor 43), strength, sweetness, sourness and bitterness, one or two dishes and two
cocktails to offer instead. It never invents a measure, garnish, glass or method the list doesn't give. Its six
questions are all four options with one right (`q.mc`), the wrong ones drawn from the bar's own other cocktails (an
ingredient against ingredients, a spirit against spirits), so they're asked as written rather than through the
wine pills; `TeamLearn.givesAway` still drops any whose name gives the answer (the Brasa-Roja **Mezcal**). Cocktails
are their own part of readiness (`PART_LABEL.cocktails`: bartender 90% on all four rungs, `cocktailKinds`; server,
manager and sommelier 50%; buyer none), assigned, drilled and recorded like wines (`TeamLearn.qsOf`, `kindsFor`,
keys `c:`), listed in their own section: on the phone a Wines | Cocktails switch at the top of the list tab (`_TListSwitch`, `TeamCocktailList`, `TeamCocktail`), in the console a Cocktails section beside Wines with price, base spirit, who knows each and its card (`_CCocktails` over `TeamReport.cocktailCoverage`), both only where there are cocktails and shown on every dish their cards name
("Cocktails with it", `TeamData.cocktailsFor`). A restaurant with no cocktails has no cocktail part anywhere.
Vinny's test stays on the wine list and menu.

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

## Vinny in the staff app (built)

A Vinny tab (between Today and Wines) and a row on Today, all in `team-vinny.js` (logic) and `team-vinny.jsx` (screens):

- **Vinny's test** (`TeamVinny.test`): a drill of ten aimed at what this person needs, from what `TeamLearn`
  already holds: answers that have faded or were missed first, then what the till sells most that they don't
  know (`TeamReport.priority`, once sales are in), then what's assigned, then the parts of their role's
  minimum they're short of, round-robin across wines and dishes so ten questions don't land on one bottle.
  A request narrows it, read without a call ("the reds under £50", "the dessert wines", "by the glass",
  "the menu", "what's new", a grape, a producer or a dish); a request that names nothing says so. The
  questions are the cards' own, open to their role and rung, answered in the ordinary drill (with Vinny's
  reason over the first), so they count like any drill. When nothing has faded or is new, it's review.
  No Claude call: the reason ("4 answers have faded, mostly on the sweet and fortified. What sells most
  and you know least comes first.") is written in `TeamVinny.why`.
- **Ask Vinny** (`TeamVinny.ask`, purpose `team_vinny`, `prompts/team-vinny.txt`): a quick answer, three
  sentences at most, to anything about the list, a bottle, a grape, the menu, a pairing or a price. The
  prompt carries the whole list and menu as one line each (tagged W1…, D1…: producer, name, vintage, type,
  section, place, grapes, glass and bottle prices, drinking window; each dish with its best, by-the-glass and
  steer-away wines), and the staff cards of the wines the question is about (named in it, or paired with a
  dish named in it). It never invents a wine, dish or price; the answer names its wines and dishes by tag,
  shown as chips that open their cards. The last two turns go with a follow-up.
- **A guest at your table** (`TeamVinny.scenario`, `TeamVinny.guest`, purpose `team_guest`,
  `prompts/team-guest.txt`): Vinny plays a diner. The table is built here from the dish's pairing so there's
  a right answer: a dish and a wish (a bottle under a budget, something lighter, one bottle for four, a glass
  at the bar, or the guest's own wrong idea to steer away from, with the wine offered for another dish
  instead). Tables are picked for the person, not dealt the same to everyone (`pickTable`): every dish they
  serve, with every wish its pairing allows, is scored on what they need (`TABLE_W`): how little they hold of
  the wines a good answer names (from drills, none yet counting as weak), a wish whose tables they haven't
  landed lately (the log keeps each table's dish, wish and wines), how well those wines sell, wines or the
  dish assigned to them, how little they know the dish's pairings, and a table they've just had counts
  against it. One of the best three dishes is taken, then one of its wishes close to its best, so it stays
  varied, and the table says why under its heading ("Picked for you: you haven't started on the Bründlmayer
  yet, and it's on your list to learn"; `tableWhy`). The guest opens, the server types a reply, the guest answers, and after
  the server has recommended (or three replies) the table is marked against the key: what worked, what was
  missing, and a line they could have said. It never moves readiness, which comes only from drills.

  Help at the table follows the person (`TeamVinny.level`, `noteTable`). **Choices**: three wines to pick
  from (the right one, the table's wrong idea or a near miss, and one that doesn't pair), each wrong pick
  saying why, the first step put as the guest's request puts it (a guest who named a wine that doesn't suit is "They want the Hito. What do you suggest?", with going along with them as one of the answers), then three reasons (the pairing's own for the wine picked and two claims its own card rules out at this dish, so the second step is about the first answer), built into a
  reply they can change before saying it. **Hints**: up to three, asked for one at a time: what the guest
  wants, the wines worth a look, the reason to give. **On your own**: nothing. A sommelier or buyer starts on
  their own; anyone else starts from readiness (choices under 40%, hints to 75%, then on their own). Two
  tables in a row that land move them up a step (with hints, only if they used one or none); a table that
  doesn't land moves them down one. They can pick the step themselves on the table's screen. The choices
  and hints are built from the same pairing as the marking key, so they always agree with the mark, and
  the mark never changes with the help: it's on what was said. The step and the tables that moved it are
  kept on the device (`vbiz_vinny_v1`).

Measured costs are to come; both prompts are about the size of a pairings call's input with a short output.

### Checking the questions (built)

Every staff card's questions are written by Claude, and a model slips: a question that holds its own answer, an either/or that hands it over, a rosé asked against an oaky white, a comparison with nothing believable to pick from, a guest pairing a pale rosé with braised lamb. The drill already leaves these out or repairs them as it asks, but a customer loading a 200-wine list shouldn't lose questions to it. So the last step of every publish checks them all.

`TeamData.checkQuestions` runs after the cards and pairings are written and before anyone is assigned anything. `TeamLearn.audit` puts every question through exactly what the drill does with it and names the failures: giveaway, thin or mismatch. Only the failures go back to Claude (`team_fix`, eight a call), each with the reason, the wine's card and the dishes it suits, and each comes back rewritten under the same id and kind, so nobody's progress shifts. The rewrite is checked again; anything that still fails stays out of the drill. The publish chip says what happened ("180 questions checked · 6 rewritten · 1 held back"). On the demo list it costs nothing: The Larkspur's questions were checked and rewritten before it shipped, and the demo restaurant is counted, never sent.

## Vinny's voice at the table (built)

The guest can be heard and answered out loud, so staff work on how they say it as well as what they say
(`team-voice.js`, `TeamVoice`; Voice on or off on the table's screen, remembered on the device).

- **The guest speaks.** Each guest line is said aloud, with a replay button beside it. With a voice key on the
  server, a cloud voice reads it (the Worker's `POST /tts`: ElevenLabs when `ELEVENLABS_API_KEY` is set, else
  OpenAI's speech model with `OPENAI_API_KEY`; four diners' voices so tables don't all sound alike;
  `ELEVENLABS_VOICES` takes a comma-separated list of voice ids to use instead; `ELEVENLABS_MODEL` picks the model (default `eleven_v4`, which says French, Italian and Spanish names inside an English sentence far better than flash or multilingual v2); names it still gets wrong go in `data/tts-say.json` as the name and a spelling it reads right, found with the listening check, `npm run tts:check`, which has the deployed voice say every name on the list into one page; clips cached by their words,
  nothing stored). Without a key `/tts` answers 404 and the phone's own voice reads it. Setting one up: add
  the key as a Cloudflare secret on the vinterest Pages project and redeploy; `/config` then says `tts: true`.
- **The server answers.** "Tap and speak to the guest" turns what they say into words in the reply box, to
  check (a misheard name can be fixed) and send with Say. On the web the browser does it (Chrome uses
  Google's service, Safari Apple's), and the screen says so the first time. Only the words are kept.
- **Delivery.** Each spoken reply is coached from its words and timings, with no Claude call
  (`TeamVoice.delivery`): pace in words a minute (`PACE`), how long before they started after the guest
  finished asking (`WAIT_SLOW_MS`), fillers and hedges ("um", "sort of", "I think", "maybe"), length, and
  whether a wine's name came through (`heardName`, forgiving how speech-to-text spells names it doesn't know).
  A wrong choice is the guest's mark to judge, so a name is flagged only when no wine on the list came through,
  with the expected wine's sounds-like spelling. The result's "Your delivery" lists it, with how it's moving
  over their last tables (`TeamVinny.deliveryTrend`). Only the person sees it; it never moves readiness, the
  mark or the help level, and the console doesn't show it.
- **Saying the names.** Every card carries `say`, a sounds-like spelling of the producer and wine
  ("doh-MEN la-ROSH, sha-BLEE"), written with the card (`prompts/team-cards.txt`) and, for the demo, by hand.
  The wine card's "Say it" speaks it; a plain voice reading the spelling gets the name right.
- **In the phone apps.** Their web views have no speech recognition, so `TeamVoice` uses the Capacitor
  plugins when they're there (`window.VinterestNative.SpeechRecognition`, `.TextToSpeech`:
  `@capacitor-community/speech-recognition` and `@capacitor-community/text-to-speech`) and the browser's
  engines otherwise. Before the team app ships in the phone apps (today `scripts/native.mjs` leaves
  `dist/team/` out): add both plugins to the native bundle, the microphone and speech-recognition wording to
  `vinterestNative` for iOS (`NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) and
  Android's `RECORD_AUDIO` permission, and test both on devices. The cloud voice works the same in the apps.

## Access and cost

The team purposes (`team_list`, `team_menu`, `team_cards`, `team_pairings`, `team_grade`, `team_vinny`, `team_guest`) are open
in `_worker.js` while the pilot is two people on one laptop: no sign-in, no account, metered only by
the Worker's per-IP limit. They go into `PRO_ONLY` (with `TEAM_PRO`) once restaurants have accounts,
and the Upload tab's sign-in card comes back with them. Roughly, on Sonnet 4.6: a staff card with its questions is 3 cents, a
250-wine list from scratch about $8, a menu's pairings $1.40, a marked answer under a cent.

The team purposes can run on their own model: `TEAM_MODEL` on Cloudflare (e.g. `claude-opus-5-5`) moves
only `team_*` calls, so the consumer app stays on `CLAUDE_MODEL`. Opus 5.5 is $4/$20 per million tokens
against Sonnet 5.5's $2/$10 and always thinks, so a list's training costs roughly two to three times as
much; it's written once at publish, so for a 40-wine list that's a few dollars.

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
3. The buyer's list analysis (dishes without a good match, price gaps,
   too much of one style).
4. Till and stock-system connections (the plan above); billing per site through Stripe (Apple 3.1.3(c) lets an app
   sold to businesses for their staff take payment outside the App Store).
