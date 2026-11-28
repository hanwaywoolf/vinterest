# Vinterest Seller

A third Vinterest product, for agencies that sell wine to restaurants. It prepares a rep for a visit: what the
restaurant's list and menu leave room for, which of the agency's bottles answer that, where each would sit on
the list, and what to say. Priced per seat, well above Teams.

This is a prototype of the first piece, the visit brief. It opens at `/seller/` on one prospect (Eloise,
Toronto, the Teams install) and one agency (Authentic Wines & Spirits, Ontario).

## What's built

- **The catalogue.** `intake/awsm/catalogue-on.json` is AWSM's Ontario catalogue as its public site gave it on
  27 Nov 2026: 110 listings (102 wines, 8 spirits), each with the product sheet's fields and its stock counts.
  `npm run seller:catalogue` writes `data/seller-awsm.json` from it.
- **The matching** (`SellerMatch` in `seller-match.js`), with no Claude call: openings on the list and menu,
  where each bottle would land at the restaurant's own multiple, the dishes it suits by the restaurant's own
  pairings, a fit score made of counted reasons, a shortlist spread over houses and openings, and a pitch for
  each bottle (where it goes, better together, lines from the sheet, objections, the case's sums).
- **The words** (`data/seller-brief-eloise.json`): one thing to say to the buyer, the pitch, a line for every
  dish and the buyer's objections, written per bottle for this restaurant. See below.
- **The screens** (`seller-screens.jsx`): Brief (openings filtered by kind), Shortlist, Catalogue and a
  printable Cheat sheet. Any bottle opens its wine card: picture, product sheet, taste profile, how to talk
  about it, and its fit and pitch at this restaurant.

## How the catalogue was read

awsm.ca is a front end on CH Group's platform (`api.chgroup.ca`); the "product sheet" PDF is drawn in the
browser from the same record. The list view gives 25 listings a page with stock counts. Each product page
(`/en/catalogue/on/<brand slug>/<product slug>/<vintage or 0>/<cspc>`) is rendered on the server with the whole
record in a `__pageData` script variable. A real install takes a feed or an API key from the agency or the
platform, and the same connector serves every agency on it.

What the sheet covers, of 110: price, pack and listing type 110; alcohol 107; colour 104; tasting notes 74;
grapes with shares 73; region 73; pairing notes 67; sugar 50; acidity and pH 31; ageing potential 30 (free
text); vintage 16. It never gives body or tannin. `intake/awsm/enrich.txt` fills style for every wine, and
grapes and region where missing, as estimates; each item's `basis` says which is which, and the screens mark
every reason with what it rests on (their list, the product sheet, our estimate).

The listing-type labels in `scripts/seller-catalogue.mjs` (`LISTING`: Core, Vint, CONS and so on) are read
from the abbreviations and need checking with the agency. Prices look like LCBO shelf prices
(`price_type: price_retail`); what a licensee pays, and consignment terms, are the agency's to supply.

## Where the words come from

The words of a pitch are written, not assembled. An earlier version built each sentence by filling a wine's
name and figures into a phrase, and every bottle read the same. Now the engine supplies only facts and
figures, and `data/seller-brief-eloise.json` holds the writing for this restaurant: a line about each
opening and, for each shortlisted bottle, one thing to say, the pitch, a line for every dish it suits and
what the buyer will say back.

For the prototype that file was written by hand against the engine's figures. The product version is one
call per prospect, in which Vinny is given the same facts (the openings, each bottle's landing price and
dishes, the restaurant's list and menu, the product sheets) and writes the brief; a rep or the agency then
reads it before it's used. Two guards are already in place for that: each bottle's writing records the
figures it was written against and is held back if matching later lands the bottle elsewhere, and a test
fails if any run of six words appears twice anywhere in the brief.

A bottle with no writing shows its figures, dishes and score, and says no pitch has been written.

Each line on screen is still marked with what it rests on: the restaurant's list, the agency's product
sheet, Vinterest's checked grape and region notes (`data/knowledge.json`), or an estimate.

Pictures are loaded from the agency platform's own image host; 84 of 110 listings have one.

## The fit score

It is the reasons added up, never a chance of a sale. There are no outcomes behind it: the weights are set by
hand and judged by reading the brief. An agency's sales history is what would let them be fitted, the way
`npm run match:backtest` judges the consumer match.

## Decided, and why

- The prospect lives in memory (`seller-store.js`). `/seller/` shares an origin with `/team/`, and an agency's
  prices, stock and customers belong on a server behind a sign-in, never on a device.
- A bottle is priced onto their list at their own multiple for a bottle of that cost, since lists mark up
  cheap bottles more than dear ones. One wine of AWSM's is already on Eloise's list, which gives one exact
  multiple; the rest come from the buyer review's shop-price estimates.
- A wine that would need more than the most they put on any bottle to reach their cheapest bottle is ruled
  out as too cheap, and the Catalogue tab says so. Ruling out is as useful to a rep as recommending.

## Not built

Vinny's written brief (positioning and selling tips in prose), the two-way practice conversation with the
buyer, quizzes and objection drills, volume discounts and terms, accounts and per-seat billing, an inventory
feed, sales history with an existing customer, who supplies each wine on a prospect's list, and ingesting a
new prospect from its PDFs (Teams' `npm run team:intake` already does the reading).

## What to bring

What to bring (`SellerMatch.bring(min)`, `SellerBring`) is the bottles to carry in for tasting: every wine with a place on their list at or above a fit (`BRING_DEFAULT` 55, pills over `BRING_STEPS`), best first, one bottle per wine (a magnum or half is tasted from its 750ml), each with its fit score, what it answers, whether to chill it (`CHILL`), whether the warehouse has it, and a tick for packed (kept for the visit only), over tiles for how many to carry and chill, the samples' list cost and what isn't to hand.

## Vinny writes the brief

Vinny writes the brief (`SellerVinny` in `seller-vinny.js`, purpose `seller_brief`, `prompts/seller-brief.txt`, `SELLER_MODEL` else `TEAM_MODEL` in `_worker.js`): the same words in the same shape for whichever restaurant is open (`/seller/?venue=<Teams seed>`, Eloise by default), from the engine's facts alone (their list and menu, each opening with its facts, each shortlisted bottle's sheet, landing, neighbours on their list and the dishes it suits, a field that is our estimate said to be one). It is a few calls, never one: the restaurant and its openings sit above `[[cache-above]]` and each call writes `PER_CALL` (2) bottles, the first alone so the rest read its cache (one call for all eight ran Opus to its 24,576-token cap twice and returned nothing). `clean` never trusts the answer: only the openings, bottles and dishes asked about are kept, `against` is stamped from the engine, a piece stating an amount of money the facts never gave is dropped, and so is one repeating six words of phrasing from an earlier piece (runs holding a figure or mostly a wine's or dish's name don't count, nor does the price paragraph); a bottle whose one thing to say was dropped stays unwritten. The answer may hold no double quotation marks inside a string (the first run came back as broken JSON), so an objection's quotes are added here. The brief written in a visit is kept in memory only; `npm run seller:brief -- <seed>` (`scripts/seller-brief.mjs`, billed, `--prompt` to print the prompt with no call, `SELLER_RAW=file` to keep the raw answer and `--check file` to put one through the checks again for nothing) writes it to `data/seller-brief-<seed>-vinny.json` and prints the tokens and cost. Eloise has both (`SellerMatch.briefs()`, `writer()`, `pick()`): the hand-written one shows first and `SellerWriter` on the Brief page switches between By hand and Vinny and has Vinny write it again; nothing a customer can open says what a call costs. Measured on Eloise, 28 Nov 2026, Opus 5.5: four calls, about 60,000 tokens in (49,000 of them read from the cache) and 28,000 out, two and a half minutes, about $0.62 to $0.85.

## What the brief may use

The brief is written from what a rep actually has, the prospect's wine list, cocktail list and menu as printed, and nothing else (Carey, 28 Nov 2026): never sales (Teams' demo restaurants carry invented sales, and `TeamBuyer._lines` includes them, so `SellerVinny._list` writes its own list lines; the first Opus brief quoted "60 glasses" of a wine from those invented figures), and never what is poured with which dish, since the pairings are ours (the prompt says so, and calls the wine beside a dish "the nearest on their list"). `SellerVinny.SALES` drops a piece that states a sales figure or says what they pour somewhere today. `SellerMatch` itself reads no sales. Compared on Eloise on that footing: Opus 5.5 wrote everything asked with nothing dropped for about $0.74 in three minutes; Sonnet 5.5 (`--draft`, kept as `data/seller-brief-eloise-draft.json`, the "Vinny, faster" pill) for $0.16 in 43 seconds, with four pieces dropped for repeating itself or inventing a figure, plainer objections and a habit of arguing against its own price.
