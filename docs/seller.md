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
- **The words** (also `SellerMatch`, still no call): one thing to say to the buyer, a pitch in the order a rep
  would give it (the wine, why its kind sells, the dish to lead with, the price with their multiple), every
  dish it suits with a reason a rep can say out loud, and what a buyer says back, per kind of wine.
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

Nothing is written by Claude at run time yet. A pitch is assembled from four sources, and each line on screen
is marked with which: the restaurant's own list and menu; the agency's product sheet; Vinterest's checked
grape and region notes (`data/knowledge.json`); and estimates (style figures, flavour words where the sheet
has no tasting note, and where a bottle lands on the list). The selling lines and objections per kind of wine
(`SellerMatch.ANGLES`) are fixed text written once: they are trade knowledge and want the agency's review.

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
