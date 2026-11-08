# The Princess Royal menus (Cubitt House, Notting Hill)

47 Hereford Road, Notting Hill, London W2 5AH. A Cubitt House pub and boutique hotel. Prices are in pounds, as printed.

**Where these come from.** Carey downloaded the menus from https://www.cubitthouse.co.uk/the-princess-royal-boutique-hotel-notting-hill/menus/ on 8 November 2026 (the site's Cloudflare bot check turns automated fetches away). The PDFs are in `files/`:

- `TPR-Wine-List-May-2026.pdf`: the wine list (24 pages), the source for every wine and its prices.
- `TPR-ALC-AW26.pdf`: à la carte, autumn/winter 2026.
- `TPR-Sunday-AW26.pdf`: Sunday menu, autumn/winter 2026 (roasts and puddings).
- `TPR-Breakfast-May-2026.pdf`: breakfast.
- `TPR-Festive-Feasting.pdf`: the three Festive Feasting set menus and bolt-ons.
- `TPR-June-2026.pdf`: the drinks list (coffee, soft drinks, beer, wine by the glass, spirits, cocktails), the source for the cocktails.

`data/team-princess-royal-list.json` is written from them by hand.

## What went in, and how

**Wines (132).** Every wine on the wine list. A wine on both the by-the-glass pages and the bottle pages is one wine with both prices. Glasses are 175ml unless `other` says otherwise: sparkling is 125ml, the "fine" whites and reds are a 125ml glass or a 375ml carafe (the carafe price is in `other`), dessert and fortified are 100ml. Half bottles (37.5cl) carry it in the bottle price, "£40 (37.5cl)". A magnum of a wine on the list is in its `other` ("Magnum (150cl, 2023) £100" when the magnum's vintage differs); the four wines sold only as magnums (Laroche Chablis Saint Martin, Perrin Côtes du Rhône Réserve, Perrin Morgon Côte du Py, Château Larose Perganson) have no bottle price, only the magnum in `other`. The three alcohol-free wines are under "Non-Alcoholic". Sections are the list's own (Fresh, Coastal Whites; Sun-Soaked Reds; Pinot Noir & Friends…). Vintages are the wine list's; "NV" and "MV" (multi-vintage) have none.

**Fixed while transcribing.** Spellings the list prints wrongly are corrected: Philipponnat (printed Philipponant), Pauillac (Paulliac), Saint-Guirons (Saunt-Guirons), Badassière (Badessière on one page), Languedoc, Côtes du Rhône, Southern Rhône, Nuits-Saint-Georges, Grüner Veltliner, Langenlois, Ontario, Tuscany, Sta. Rita Hills, Marsannay Clos du Jeu, Monção, Château Mont-Redon, Franche-Comté (printed "France Comté"). The Morgon Côte du Py is put in Beaujolais (the list prints Rhône Valley, where Famille Perrin is based). The Sandeman 10-Year-Old Tawny's glass is £16: the wine list prints "6" for a 100ml glass, the June drinks list prints 16.

**Grapes.** Where the label or the appellation fixes them, `grapes_basis: label`; where the house's blend is documented, `known`; otherwise `typical` (what wines like it usually hold). The tawny and white ports and the alcohol-free wines have none listed.

**Dishes (55).** À la carte nibbles, starters, salads and mains; the Sunday roasts and puddings (the Sunday starters repeat à la carte dishes); breakfast without the juices and sides; the Festive Feasting dishes that aren't on à la carte, with no price (the menus are £72, £95 and £200 a head) and the three bolt-ons with theirs. Sides are left out, as for The Social Corner. No diet tags: the menus don't print them, and the kitchen confirms allergens on the console.

**Cocktails (25).** The drinks list's Spritz, House, Margaritas, Martinis & Friends (the Freezer Martinez and Cubitt Martini also come as a £5 "Just a Sip"), Mid-Strength and the three alcohol-free cocktails, ingredients as printed; the food menus' three £6 Sharpeners (Porto Tonica, Negroni, Spicy Bloody Mary), whose recipes aren't printed; and the Full Festive Feast's welcome Festive Bellini. Spirits, beer, cider and soft drinks are left out.

**Demo team and sales.** The same invented team as The Social Corner (the Larkspur's people and photos) and eight weeks of invented sales in pounds, labelled Demo data. The POS item the list doesn't carry is "House Prosecco 125 (Events)" (`venue.offList`), invented.

**Branding.** Carey supplied the one-line white logo (`brand/logo-liner-the-princess-royal-boutique-hotel-notting-hill.svg`), copied to `team/brand/princess-royal/wordmark-white.svg` and set as `venue.brand.logo`. No mark or accent colour: the header keeps the Vinterest mark.
