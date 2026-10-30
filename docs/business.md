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

`/team/?seed=demo` opens The Larkspur (Bristol, modern British): 60 wines and 27 dishes
(`data/team-demo-list.json`), and seven staff with circle-cropped photos (`team/faces/`, `TeamSample.DEMO_STAFF`).
Once the training has been written (a manager publishes with a Pro account, then "Export this
restaurant's list, menu and training as a file" and the file becomes `data/team-demo.json`), the demo
opens with every card, pairing and drinking window in place and no network needed, and `TeamDemo.seedProgress`
puts each person at a stage: Claire (sommelier) ready, Marco (bartender) slipping after three weeks without a
drill, Dani (server) part way, Priya (server) overdue, Amara (server) in her first week, David (buyer) most of
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
  only), recall (typed), apply (a guest at a table, answered in their own words and marked by Claude
  against the key, `prompts/team-grade.txt`) and contrast (telling it from the most similar wine on
  the list). A rung opens once the one below is answered right. Servers and bartenders need the first
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

The team purposes (`team_list`, `team_menu`, `team_cards`, `team_pairings`, `team_grade`) are
`PRO_ONLY` in `_worker.js` during the pilot, so a manager signs in with a Pro account (a promo code
works) before uploading. Roughly, on Sonnet 4.6: a staff card with its questions is 3 cents, a
250-wine list from scratch about $8, a menu's pairings $1.40, a marked answer under a cent.

## Next

1. Accounts for restaurants: organisations, sites and members with roles in Supabase, row security
   by membership, each person on their own phone, the manager's dashboard on the web.
2. Cellar stock (spreadsheet import, label scan on delivery), role tracks, a weekly "new on the list".
3. The guest role-play with Vinny; the buyer's list analysis (dishes without a good match, price gaps,
   too much of one style).
4. Till and stock-system connections; billing per site through Stripe (Apple 3.1.3(c) lets an app
   sold to businesses for their staff take payment outside the App Store).
