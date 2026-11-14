# Vinterest Teams

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

## Teaser installs

A teaser is a quick, cheap install to show a prospective restaurant before anything is signed: `npm run team:write --
<restaurant> --teaser` (`scripts/team-write.mjs`) from the same list file a full install uses. It trains a slice of the
list, the wines sold by the glass (or `--wines id,id,…` picked by hand), at most `--max` (30) in list order, with every dish
and cocktail; the rest of the list isn't shown. Every call is marked `draft`, so the Worker writes it on `TEAM_DRAFT_MODEL`
(Claude Sonnet 5.5 unless set) whatever `TEAM_MODEL` is (`modelFor` in `_worker.js`); a draft can only make a call cheaper,
so the request may ask for it. Drinking windows are left to the app's own estimate, labelled as one, and the sommelier
review isn't run: `npm run team:audit` (free, no network) is the check. `--no-dish-notes` drops the dish notes too. On The
Princess Royal's list that is about 50 calls on Sonnet against about 500 on Opus for the full install. The training file
carries `teaser` {wines, at}. Once the restaurant signs, the same command without `--teaser` brings the rest of the list
back and writes what's missing on `TEAM_MODEL`, keeping the teaser's cards, then `team:review` runs as for any install.

## Prompt caching

Every Teams prompt that writes or checks a restaurant's training (`prompts/team-cards.txt`, `team-fix`, `team-review`,
`team-pairings`, `team-cocktail-cards`, `team-dish-cards`) puts what's the same for every call of a publish first (the
instructions, the restaurant, the wine list and the menu) and marks where it ends with a line `[[cache-above]]`; what one
call is about (its wines and their checked facts, its dishes, its questions) comes after. The Worker (`cacheSplit` in
`_worker.js`) sends the part above as its own block marked for Anthropic's prompt cache and drops the marker, so the second
and later calls of a run read the list and menu back at a twentieth of the input price on Opus 5.5. Measured on The
Princess Royal's review: about 12,400 tokens read from the cache per call, the call about three-quarters cheaper. A new
prompt that should be cached needs the marker, and `tests/worker-model.spec.js` fails if a per-call placeholder sits above it.

## The Princess Royal install

`/team/?seed=princess` (the seed is `princess-royal`) opens The Princess Royal, a Cubitt House pub and boutique hotel in
Notting Hill, built for a sales pitch the same way The Social Corner was: from the menus and wine list on its site
(`intake/princess-royal/`: the PDFs as downloaded, and `menus.md`, which says what went in and what was corrected).
`data/team-princess-royal-list.json` holds its 132 wines (the whole wine list: by the glass and by the bottle as one wine,
carafes, half bottles and magnums in `other`, the four magnum-only wines with no bottle price), 55 dishes (à la carte,
Sunday roasts and puddings, breakfast, the Festive Feasting dishes) and 25 cocktails, in pounds (`venue.currency` GBP,
`venue.country` GB, so the UK's fourteen allergens). Its logo is the one-line white wordmark Carey supplied (`team/brand/princess-royal/wordmark-white.svg`, `venue.brand.logo`), with no mark or accent of its own. It
carries The Social Corner's invented team and `TeamSales.seedDemo`'s eight weeks of invented sales, labelled Demo data:
pours are 175ml and 125ml (ounces only where the venue counts in dollars), and the POS item the list doesn't carry is the
venue's own `offList` ("House Prosecco 125 (Events)"). Its training (`data/team-princess-royal.json`) was written through
the branch preview's Worker on Claude Opus 5.5 by `npm run team:write -- princess-royal` (`scripts/team-write.mjs`: the
app's own writers for cards, cocktail cards, pairings, drinking windows and dish notes, saved after each step), then put
through `npm run team:audit` and `npm run team:review -- princess-royal`. Its demo address is
princessroyal.vinterest.team (`TeamSample.HOSTS`, the Worker's `VENUE_HOSTS`), a custom domain on the vinterest Pages
project.

## The Eloise install

`/team/?seed=eloise` opens Eloise, a restaurant and bar in Toronto, built for a sales pitch the same way: from the
Beverage Menu and the site's menu captures Carey supplied (`intake/eloise/`: the PDFs, the wordmark, and `menus.md`,
which says what went in, where the two sources disagree, what was corrected and what should be checked with the
restaurant). `data/team-eloise-list.json` holds its 76 wines (by the glass and by the bottle as one wine; glasses are
5oz with the 8oz price in `other`, the Sauternes a 2oz glass, two wines only as 1.5L magnums, one `orange`), 17 dishes
(dinner's appetizers, pastas and mains and the site's three desserts) and 10 cocktails, in Canadian dollars
(`venue.currency` CAD, `venue.country` CA, so Canada's priority allergens). Its logo is the wordmark Carey supplied,
filled white (`team/brand/eloise/wordmark-white.svg`). It carries the same invented team and eight weeks of invented
sales, labelled Demo data, with its own `offList` POS item ("House Prosecco (Events)"). Its training
(`data/team-eloise.json`) was written through the production Worker by `npm run team:write -- eloise`, then put
through `npm run team:audit` (nothing flagged) and `npm run team:review -- eloise`, then `--held` once more: 695
questions read, 139 rewritten, 140 held out of the drill (120 on wines, 6 on cocktails, 14 on dishes). Its address is eloise.vinterest.team, a custom domain on the vinterest Pages project, and it opens differently from the
other restaurants' (`VENUE_PAGES` in `_worker.js`): the root is the page written for the restaurant
(`site/teams/for/eloise.html`, private, its list and cards made from the seed's two files with `cellarOf`; the Worker
fetches it and its files from the Teams site, `TEAMS_SITE_ORIGIN`, default vinterest.team, where it is also
vinterest.team/for/eloise), and the demo is at eloise.vinterest.team/demo/ (the staff app's files; `TeamSample.HOSTS`
opens Eloise from the address). A new prospect who should get the same is a row in `VENUE_PAGES` and `HOSTS`. Its list file also sets
`venue.console.hide: ["sommelier"]`, so the console's Wines section opens on the wines without the Sommelier review card
(our own check, whose held questions stay held); any install can set it. The allergens drafted from its menu are accepted in its
training file (`allergens.confirmed`, by "Demo data") so Menu shows nothing to confirm; the kitchen hasn't confirmed them.

## The console's first-use tour (built)

The first time a person opens the console on a device, a tour walks them through it (`_CTour` in `team-console.jsx`,
steps and who has seen it in `TeamTour`, `team-data.js`, `vbiz_tour_v1`, per restaurant and person, never synced): a
welcome card, then a spotlight down the sidebar, one section at a time (Dashboard, Sales Insights, Team, Wines,
Cocktails where there are any, Menu, Upload), each stop opening its section behind the dimming with a card saying what
it's for, and last the switch to the phone view. Back, Next, Skip the tour; Escape skips and the arrow keys step;
nothing under it takes a click. On a narrow window the card sits at the foot. "Take the tour" at the sidebar's foot
brings it back. The app's shell asks for it (`tour` on `TeamConsole`); tests turn it off (`window.VINTEREST_TOUR =
'off'`, `helpers.stubNetwork`) except the one that tests it.

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

### The staff app on a tablet (built)

Staff and prospects test on iPads as much as phones, so from 768px wide (`useLayoutSize`, the consumer app's breakpoint) the staff app uses the width instead of one centred phone column: the tabs are a rail down the left (`team-rail`; the bottom bar is the phone's), the page runs to 1000px, Today is two columns (`WideColumns`: readiness, its parts and the drill on the left; Tonight, the figures and what's new on the right), Practise shows its three doors across, and on Wines and Menu a wine, cocktail or dish opens beside its list (`team-split-list`, the list with its own scroll and the open row tinted, `aria-current`; another row replaces the one open rather than stacking on it, and Back returns to the list alone). Anything deeper (a drill from the wine, the guest, Ask Vinny) takes the width as a single column, and the phone layout never changes. `tests/team.spec.js` ("the staff app on an iPad") runs it at 1180×820 and 820×1180 and keeps a screenshot of each screen.

### Training depth (built)

The ladder, readiness against a minimum, two-part table questions and ten-pill recall were written for a wine-led dining room, and even its Low level kept that shape. A pub or a neighbourhood restaurant needs less, so training depth is three tiers (`TeamLearn.TIERS`), set for the restaurant in the console's Team section (`console-tier`) with a tier per role over it (`roleTiers`; the sommelier at Master while servers are on Essentials). A restaurant starts at Master, where the app has always been; an install's list file can carry its own (`venue.training: {tier, roleTiers}`, applied by `TeamSample.load` to a restaurant that hasn't set one, so The Princess Royal opens with servers on Essentials and the sommelier on Master).

- **Essentials** (a pub, a neighbourhood restaurant): what to say about each wine, its price and what it pours with; what each dish is, its allergens and the wine to suggest. Low's content (`contentLevel` is `low`) plus a price question built from the list when the card has no plain one (`#price` in `lightQs`: a glass for a wine poured by the glass, else the bottle, against the three nearest prices sold the same way). Every question is four options (`tierQ`: a pills question with one right answer keeps it and its first three wrong ones; one with several right answers is Master's; the allergen question stays choose-all everywhere); the table question is "Which wine?" from the wines offered, the reason shown after the answer as the thing to say and never tested (`_tableInTier`); a dish's menu-change and name-a-glass questions aren't asked. No ladder (`rungsFor` is empty, `_open` always true) and no confidence asks. Readiness is a count, "You know 18 of 24", Ready once every wine and dish they sell is known (`readiness().count`); the drill's words say what's about ("Our wines", "The menu", "At the table"), never a rung.
- **Service** (a good restaurant or hotel dining room without a sommelier): Medium's content; four options everywhere; at the table the wine, then one reason from three (a question that names its wine and asks only why keeps the one reason from three); two rungs, Know it (recognise and recall) and At the table (apply); readiness and minimums as Master's.
- **Master**: everything the cards hold, with Low, Medium and High inside it (below); the only tier with levels.

A tier filters and reshapes what's written, never rewrites it (`qsFor(role, id)`, `dishQsFor(role, id)`), and a question keeps its id in every shape, so an answer given on Essentials counts on Master and nothing is lost moving either way; `cardShows` follows the tier's content level. The sommelier review and the app's own review read Master's shape, which the lower tiers' options are drawn from in order.

### Training levels (built)

Restaurants differ in how much their staff need to know. A neighbourhood spot wants something to say about each wine and what it goes with; a wine-led dining room wants the grapes, the regions and the rules. Management picks a level for the restaurant in the console's Team section (`console-level`), and can set a different one for a role (the sommelier at High while servers are at Low). It's the first thing to settle with a new restaurant in discovery, then adjust.

- **Low**: one thing to say about each wine and what it pours with. Two questions per wine are built from its card with no Claude call (`TeamLearn.lightQs`): which line you'd tell a guest (its taste line against three other wines of the same kind) and which dish you'd suggest it with (one of its own dishes against three from the menu it isn't poured with). The card's table question is kept. The card shows what to say, one fact to know (the producer, else the place, else the grape: `cardFact`), how it tastes and its dishes. A cocktail adds its base spirit and its story as the fact.
- **Medium**: Low's table question, plus recognising it, its grape, where it's from and how it tastes (`MEDIUM_TOPICS`; a cocktail's spirit, what's in it, its flavours and who created it). Rules, classifications, ageing minimums and vintages stay at High (`HIGH_ONLY`), and there's no "tell them apart". The card adds the style bars, grape and region, serving and Offer instead.
- **High**: everything the card asks, as before. A restaurant starts here.

A level only filters what's already written (`TeamLearn.levelQs`, `qsFor(role, id)`, `cardShows`), so changing it takes effect at once, nothing is rewritten and no answer is lost: readiness, the drill, Vinny's test and the wine's standing all read the role's questions at its level. The console's own wine panel always shows the full card.

### One answer you'd stand behind, and a mix that teaches (built)

A question is only worth asking if a trained sommelier would stand behind its answer, so wrong answers are ones the pairings rule out, never another reasonable choice. "A guest orders the sirloin: which wine suits it best?" offers the dish's first pick against wines the dish plainly doesn't suit (`tableFit`), never the other reds it also lists. Low's "Which dish is the best match for this wine?" uses the dish the pairings rank the wine highest at (`rankAt`), so five reds that all go with the sirloin don't all answer "the sirloin". Low's "What would you say about it?" only sets a wine's line against wines that are clearly different in style and wording. Without three such wrong answers, the question isn't asked.

Ten questions also have to read as ten different things. `TeamLearn.spread` keeps one question per right answer (near-identical answers count as one) and deals them so no two in a row are about the same wine or dish, ask about the same thing (a grape, a place, a flavour, a dish, a table) or share an answer. Vinny's test draws three candidates per question and the drill two, in priority order, so faded and missed answers still lead.

### How a question earns its place (built)

The rules every question is held to, and checked against in code and in `tests/team.spec.js`:

1. **One defensible answer.** The key is what a head sommelier would say; every wrong answer is one the restaurant's own pairings rule out (`clearlyWrong`: the dish's avoid, far from every pick in style (`DECOY_GAP`), or a colour none of its picks has), never merely less good. A Barolo beside a Brunello at a Bolognese is never offered as wrong.
2. **Believable wrong answers.** The same kind and register as the right one, and real mistakes: a wrong wine is on the list at its own price, honours what the guest asked for (`wishIn`: a white when they asked for a white, by the glass when they asked for a glass) and is the nearest plausible kind (`NEAR`), never a dessert wine at a steak. A wrong reason is a different mistake from the others (`claimsIn`: one per claim, so "light" and "low in tannin" aren't three answers ruled out at once), never a claim no wine of this kind could make (bubbles for a still wine, sweetness for a red, tannin for a white), and leads with ones written for the question (`wrong`, three per table question, from the card prompts at publish and backfilled for the restaurants already in the repo by `scripts/team-wrong.mjs`).
3. **No clues.** No right answer stands out by its length (`lengthCue` at publish; at a table, a terse right reason beside long wrong ones is left out), by naming the dish when the wrong ones don't (the fallback wrong reasons never name it), or by a word the question gives away (`givesAway`).
4. **The decision, then the reason.** A table question that names its own wine is asked as the guest would ask it ("…What would you suggest, and why?", `_decide`) wherever the list holds at least two wines that honour the request and are clearly wrong for the dish; the right reasons lead with the sommelier's own reason for that wine at that dish. Where there's no fair choice, the question says which wine and asks why ("You suggest the Nyetimber. Why does it work?"), rather than offer a choice of one.
5. **Watched in use.** `TeamLearn.questionHealth` reads each person's first answer to each question (`first`, recorded in `record`, never for seeded demo answers); once four or more have answered, one right first time by nearly everyone and surely is flagged as possibly giving itself away, one missed by most as worth checking. The console's Wines section lists them as "Questions to look at".

Every table question is now written as a real choice. The card prompt (and the publish check's rewrite, reason `nochoice`) sets the guest at a dish the wine is a pick for, with a request that rules out other wines of the same kind on the list ("a red that isn't too heavy", "something crisp", "under $60 a bottle", by the glass), never names the wine, and names three wrong wines (`decoys`) with why. The drill checks each one (`tableWrong`: of the kind asked for and sold as asked, none of the dish's picks, and either clearly wrong for the dish or failing the request, read by `wishStyle` against the card's figures and the list's prices, while the right wine meets it), adds any other wine on the list that qualifies, and leaves out any that don't. The writer's own wrong wines are trusted for reasons the request reader can't see ("that's the everyday bottle, they want a special one") only within hard limits: on the list, of the kind asked for and sold as asked, none of the dish's picks, and clearly apart from the right wine in style or price. The restaurants already in the repo were rewritten once by `scripts/team-tables.mjs`, keeping every question's id: 23 of the Larkspur's 30 table questions and 54 of Social Corner's 63 now ask for the choice; the rest name the wine and ask why, and the publish check (`nochoice`) sends questions like them back when a list is next published.

## V2: what the audit changed (built, November 2026)

The V2 audit (docs/audit/teams-v2-audit.html) found the learning model sound and the front of it hard to
use: 13px text on a dark stage, a Vinny tab with two text fields and three jobs, a new server shown four
zeros and "Not ready yet" on day one, 123 "overdue" on day eight, a recall question with eight pills and a
confidence tap on every question, nothing about what learning is worth, and no menu module beyond pairings.
Wave 1 and 2 of its roadmap are built, on The Social Corner and the demo alike.

- **Type.** Nothing visible under 12px on the staff phone, body 14 to 16, list rows a 16px name over
  the one fact a server needs (the price, in white), the vintage and region on the card.
- **The Vinny tab is a practice hub.** One card with the thing to do now (`TeamVinny.next`: today's
  drill until it's done, then a guest table aimed at what they're weakest on, then the test), a line on
  what knowing the list is worth here (`TeamReport.worth`: from the till's known-against-unknown gap on
  the top sellers, as a tip range per shift with its caveat; the research figure, said as research,
  until there are 28 nights), then three doors, each its own screen: Ask Vinny (three short suggestions,
  `TeamVinny.suggest`, tonight's feature and 86'd first), a guest at the table, Vinny's test.
- **The drill recipe.** One question per wine, dish or cocktail; due first, least remembered first; at
  most `NEW_MAX` (2) new things once anything is due, in the till's order and one per list section; a
  re-check never takes a wine's place. A recall question is the right answers plus at most `WRONG_MAX`
  (4) wrong pills; a grape question offers only grapes. "How sure are you?" is asked on a price or an
  allergen alone (`TeamLearn.asksConfidence`); elsewhere a right answer inside four seconds reads as
  sure. The summary says what they now know in words (`knownLine`), when it comes back (`comesBack`)
  and what the drilled wine sells here (`TeamReport.sellsLine`), the mechanism behind a tap.
- **Waves, not a cliff.** Someone new learns in waves (`TeamLearn.WAVES`: the glass list in ten days,
  then allergens in seven, then bottles, the menu, cocktails; a bartender starts on cocktails), each
  with its own window. Today shows a person who hasn't drilled yet the plan (`TeamLearn.plan`), then
  the wave they're on as one line; the console says Behind (people past their wave) in place of an
  overdue count.
- **Tonight.** What's 86'd and what's on feature, set for the day by whoever runs the floor (the
  manager's Today or the console's Tonight card, which leads the dashboard; `TeamData.tonight`), on
  everyone's Today with the two by-the-glass wines that person should look at before service
  (`TeamLearn.slippingOn`), each with a line to say and Say it. Never scored.
- **The menu.** Every dish gets front-of-house notes (`prompts/team-dish-cards.txt`, purpose
  `team_dishes`, `TeamData.writeDishCards`, written at a menu publish or by `npm run team:dishes` for a
  seed): the dish in a sentence, its allergens as a draft against the venue's statutory list
  (`TeamData.ALLERGENS`: Canada's eleven, the UK's fourteen, the US's nine, by `venue.country` or the
  currency), what can change (`mods`, each yes, no or ask) and what guests ask. The draft is never
  shown as fact: the kitchen confirms each dish's allergens on the console's Menu tab
  (`TeamData.confirmAllergens`), which assigns the dish's allergen question to everyone. A dish's ladder
  is then know it (the dish's own sentence against three near-misses of the same dish that the notes
  write, `wrong`: a borrowed sauce, the wrong cut or cooking, the wrong richness; never another dish's
  description, which the question's own name gave away), allergens (a choose-all against the list with
  confidence, a miss back within the shift), a change a guest asks for, and its pairings. Allergens are their own readiness part at 100%
  for every role, the one hard gate; the Team tab's sign-off register (`TeamReport.allergenRegister`,
  Export CSV) says who holds every confirmed dish and when it falls due.
- **The wine card** leads with the price as a guest hears it, a hook (one telling detail, from the
  card prompt, for cards written from now on), the pitch with a Say it that speaks it, the menu with
  the reasons first and the dish to steer away from, the alternatives with their price, then where
  they stand and the reference material.

### One size on the cards (built)

A wine's, a cocktail's and a dish's card had text at seven sizes between 11 and 22 and four weights up to 800, so
nothing led. Every line is now 14px, the size of the sentence in Where you stand, and only the name is larger (20px).
Weights are light: the name 600, labels and anything emphasised 500, the rest 400. It's the same on the phone and in
the console's drawer, on every restaurant, and a test fails if a card strays from it.

## The pre-shift briefing and specials (built, November 2026)

What management decides before service reaches every member of staff as one page they read and accept before
the app opens for them that day. It replaces the pre-shift huddle's "did everyone hear that?" with a record.

**What goes in.** The dishes that are 86'd, the wines and cocktails on feature, a note from the manager, and
tonight's specials. All of it is set in one place: the Tonight card on the console's dashboard, or Tonight on
the manager's phone (the same component, `TeamShiftManage`).

**Adding a special.** One button, three ways in, because a manager at 4.45pm has a chef's scribble and no time:

- A photo of the chef's board or note. One call reads the handwriting and returns every special on it.
- A typed line, as loose as "halibut, brown butter, capers 34".
- Say it, with the speech-to-text the guest at the table already uses.

The same call pairs each special from the restaurant's own list: a bottle, a pick by the glass, two alternatives
of another style or price, and a line to say at the table. It also lists the allergens the dish states or very
likely contains. With no connection, a typed line is kept as it is and the manager picks the wine.

**Approval.** A special is a draft until the manager approves it. The draft is one card: fix the name or price,
correct the description, add or remove allergens, swap either wine, choose how long it runs (tonight, through
Sunday, until taken off). Approve stays off until "The kitchen has confirmed these allergens" is ticked, since
the allergen line is the part of a special that can hurt someone. Nothing unapproved reaches the team.

**The briefing.** Compiled from that, with no call: what's off, each special with its price, description,
allergens and pour, what we're pushing with its price and one line, the manager's note, and for each person the
two wines they should look at before service. "Send briefing" makes it version 1.

**The gate.** Once sent, the app opens on the briefing for every person, over everything, until they tap "Got
it". Whoever sent it has read it. The console shows "5 of 7 have read it" and who is still to read.

**Changes during service.**

- Sold out is one tap on the special. It shows on every Today at once with the time, and nobody accepts anything
  again: it takes something away, it doesn't add a risk.
- A new special, a changed allergen or wine, another dish 86'd: the manager sends the update, and everyone accepts
  the briefing again with what's new marked "New".

**Expiry.** A special ends with its run. Ended specials are offered under "Bring back", so Friday's fish is one
tap next week with its pairing kept; the kitchen confirms the allergens afresh. The briefing ends with the day.

**What a special is not.** It isn't on the list or the menu, it's never drilled and it never counts towards
readiness. It lasts a night; the briefing is how it's learnt. Ask Vinny and the guest at the table do know
tonight's specials and 86'd dishes.

**One device for now.** The pilot keeps a restaurant on one device, so in a demo restaurant the rest of the team
accept over the next few minutes after a send (two never do, so the register has someone to chase), labelled
Demo data, and the person switcher shows any one person's gate. A live install is each person on their own
phone in the native app: the shift, its specials and the acknowledgements become rows in Supabase once
restaurants have accounts (they are already shaped as rows in `vbiz_shift_v1`), and push tells the team
"Tonight's briefing is ready" and "The halibut is sold out" (the consumer app's Worker already sends push).

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
  `prompts/team-guest.txt`): Vinny plays a diner, on a screen of its own over the app (no header or tabs:
  a bar with the dish and Voice, the conversation scrolling, the mic and reply box pinned to the foot;
  `team-app.jsx` mounts it as a layer, kept under a wine it opens). The table is built here from the dish's pairing so there's
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
  missing, and a line they could have said. A table landed with hints or on your own counts as the wine's At-the-table
  question answered right (`TeamVinny.noteTable`: the card's table question at this dish where there is one), so
  readiness and the wine's standing move and the progress card under the mark says so (`guest-progress`: the wine
  before and after, readiness or the Essentials count before and after, tables landed out of the last ten, how the
  help has moved); a table landed with choices doesn't count, since the wine was handed to them, and a miss never
  lowers readiness, since the mark is Claude's on a free reply.

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

### Handing over an install (built)

A restaurant's questions pass three checks before its staff see them, and the last two are the gate before an install is handed to the customer.

1. **The rule check at publish** (`TeamLearn.audit`, `TeamData.checkQuestions`): giveaways, too few believable wrong answers, a guest at a dish the wine doesn't suit, length cues, table questions that aren't a real choice. Failures go back to Claude to be rewritten (`team_fix`).
2. **The app's review** (`TeamLearn.review`, `npm run team:audit`): every question as the drill shows it, against every fault found by hand in testing (a wrong answer about another dish, answers of mixed kinds, a table request that gives the answer away, an answer screen that repeats the answer or runs long, duplicate options, length cues, giveaway words). It runs in the tests on every restaurant, so a flag fails the build. A fault found by hand becomes a rule here, so it's caught for every restaurant after.
3. **The sommelier review** (`TeamData.sommelierReview`, `prompts/team-review.txt`, purpose `team_review`): Claude, as the restaurant's head sommelier, reads every question exactly as a server will (the options as dealt, the one marked right, the line after the answer) and says whether it's fit to ask: no second right answer, no wrong answer marked right, no false fact, no giveaway, nothing off the subject, nothing unclear or useless. A wine card's doubtful question is rewritten (`team_fix`, problem `sommelier`) and read again; anything still doubted, and any doubted question built from the list (a dish's, a cocktail's, Low's), is held out of every drill until the next review (`venue.reviewed.held`). It runs at the end of every publish, and the console's Wines section shows the result ("Sommelier review": read, rewritten, held and why).

Before handing over: `npm run team:audit` must show nothing flagged, then `npm run team:review -- <restaurant>` runs the sommelier review and writes the rewrites and the held list into the restaurant's file, so the install opens with them. It calls the deployed Worker for real (roughly one call per ten questions, plus rewrites; The Social Corner's 600 questions is about 60 calls). Read the held list: each note says what's wrong, and a held question is a gap the next list or card rewrite should fill.

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
  check (a misheard name can be fixed) and send with Say. With `ELEVENLABS_API_KEY` set, the reply is recorded
  and written down by ElevenLabs' speech-to-text (Scribe) through the Worker's `POST /stt`: better with wine names
  than a phone's recognition, the same on every phone, and with a time for every word for the coaching. The
  words land a second or two after they tap to finish ("Writing down what you said…"); the recording is passed
  straight through and never kept, and the screen says so the first time. Without the key, or if the service
  fails (said on the screen), the browser does it instead (Chrome uses Google's service, Safari Apple's), and
  only the words are kept.
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
  It shows on the wine card's "Say it" as a guide; the button speaks the name itself, which the cloud voice says
  better than it reads a respelling.
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
consumer app's iPad rule): a manager, buyer or sommelier (whoever runs the wine programme) gets it, staff keep the phone app whatever the screen,
and `?view=console` forces it on a narrow window so it can be checked on a phone. One build, one store:
every figure on it is a function in `TeamReport` (`team-report.js`) over `TeamLearn`, `TeamData` and
`TeamSales`; the screens (`team-console.jsx`) compute nothing. Every number opens the people or wines
behind it in a drawer (a wine's card, a dish's pairings, a person's ladder). "Train on the phone view"
in the sidebar shows the phone app inside the console (for a drill as someone), and Console brings it
back. The phone's Today, for a manager, buyer or sommelier, carries a strip of the figures that matter on the move
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
   and their share, the trained lift (`trainedLift`: over the wines some of the team know and some don't, the money a
   server who knows a wine takes on it per shift against one who doesn't, said as a multiple ("sell 3.1× as much of
   it") and as known against not known across people, never "before", with the caveat that shifts and sections
   confound it), the weekly trend, what sells,
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

## Wine shops (concept, November 2026: nothing built)

A wine shop needs the same thing a restaurant does, someone who can sell the wine, and has already done the
expensive part: its stock is priced and structured. This is the same product with a second kind of venue,
never a separate build. The thinking so far, kept here until there is a shop to test it on.

**What carries over as it is.** Ingestion (a list, a label, cards with the pitch, the taste, what to say,
drinking windows, "if they want something else"); Ask Vinny; the guest at the table, who becomes a customer at
the counter; the drill, readiness, the console and sales import; Tonight and the briefing, which become "this
week": what's out of stock (the shop's 86), what we're pushing, new arrivals.

**What changes.**

- Pairing flips from lookup to recommendation. A restaurant has a menu, so dish to wines is written ahead. A
  shop has occasions without end ("a roast dinner for eight, good reds, about £120"), so Vinny works at the
  moment of asking. The rule that keeps it honest is the one the app already follows: code filters first
  (budget, colour, in stock, ready to drink), then Claude only chooses among what's left and says why. Three
  picks every time: the safe one, the step up, the one they wouldn't have found. A card carries the foods the
  wine suits as general kinds (roast beef, spicy food, oily fish) in place of named dishes.
- Scale. A restaurant is 30 to 130 wines; a shop is 300 to 3,000 that turn over weekly. Full cards for the top
  sellers and staff picks, light cards for the rest (the teaser-install path, written cheaply).
- What staff learn. Restaurant staff must know our list. Shop staff must know wine and find their way around
  the stock, so the consumer app's regions, grapes and quizzes have a place in Teams here. Nobody drills 2,000
  bottles: the top sellers, then by region, grape and price band.
- Stock is live. A PDF won't do; it needs the shop's POS or online store (Shopify, WooCommerce, Lightspeed,
  Square), so the connector is day-one work. Shop data is cleaner than a restaurant's: SKU, vintage, price and
  stock count are already there. A bottle recommended an hour after it sold out is worse than no
  recommendation.
- Quantity. Dinner for eight is four or five bottles, a budget for the lot, perhaps a case discount, and "a
  white for the starter?".
- Margin. Owners will want Vinny to lean to overstock and better-margin bottles. In a staff tool that's fair,
  but only to choose between equally good fits, and the staff member is shown that it did.

**Three surfaces on one engine.**

1. Staff at the counter: Ask Vinny and the training, closest to what's built.
2. Vinny on the shop's website, for a shop with an online store: the customer says what they need and gets
   three bottles as product cards with the reason for each and Add to basket.
3. Later, in the shop itself: a tablet or a QR code on the shelf.

**Why the website may come first.** The online store already is the live stock, so the hard part is free.
The result has a number on it: conversion and basket size for visits that used Vinny against those that
didn't, a cleaner sales case than a restaurant's. It installs as a script or a store app, with no staff
rollout. And an owner who sees Vinny answer customers well asks why the Saturday staff can't.

**What the website needs that Teams doesn't.**

- Vinny's mistakes land on the customer, with nobody in between: never a bottle that isn't in the feed, and
  "nothing like that under £15" said plainly. Its own review pass, like the sommelier review.
- Alcohol rules: an age gate, nothing that encourages quantity, and each market's rules on recommending
  alcohol, checked before a pilot.
- Cost per conversation: thousands of anonymous chats a month, so caching, a short model for most turns and
  limits per visitor. Pricing probably wants a usage part or a share of the sales Vinny helped.
- Abuse: it talks about wine and this shop's stock, nothing else.
- Brand: "Vinny, powered by Vinterest" in the shop's colours, as a venue's logo is in Teams now.

**The link to the consumer app.** A shopper signed in to Vinterest can be shown the bottles in this shop that
match their WineDNA, with the match beside each; a shopper who isn't meets Vinny on a shop's site first. It
sits beside the partner shops the consumer app already links to (docs/affiliates.md): a shop running Vinny is
one whose stock we already hold.

**Who buys it.** Not the owner who is the expert and on the floor every day. A shop with part-time or
Christmas staff, a small chain, a deli with a wine wall, and above all one with an online store. A shop has
three staff, so the price is per shop, not per person.

**The test, before anything is built.** One friendly shop's product export (name, producer, vintage, price,
stock, category) of 200 or so bottles, and twenty questions its customers have really asked. Write the light
cards, run the questions through Vinny by hand, and ask the owner whether they'd stand behind the picks. If
they would, the website widget is the first thing worth building, because it's the one with a number attached.
No shop is lined up yet.

## Next

1. Accounts for restaurants: organisations, sites and members with roles in Supabase, row security
   by membership, each person on their own phone, the manager's dashboard on the web.
2. Cellar stock (spreadsheet import, label scan on delivery), role tracks, a weekly "new on the list".
3. The buyer's list analysis (dishes without a good match, price gaps,
   too much of one style).
4. Till and stock-system connections (the plan above); billing per site through Stripe (Apple 3.1.3(c) lets an app
   sold to businesses for their staff take payment outside the App Store).
