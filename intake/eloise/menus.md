# Eloise menus (Toronto)

Eloise, Toronto (eloiserestaurant.ca). Prices are in Canadian dollars, as printed. The site's menu page doesn't print a street address, so none is recorded here.

**Where these come from.** Carey supplied them on 10 November 2026 (this session's network couldn't reach the site itself). They are in `files/`:

- `drink-menu.pdf`: the Beverage Menu (14 pages): cocktails, wine by the glass, wine by the bottle, spirits, dessert wine, coffee and desserts. The source for every wine, its prices and the cocktails.
- `site-menu-1.pdf`, `site-menu-2.pdf`, `site-menu-3.pdf`: full-page captures of eloiserestaurant.ca/menu ("The Table") on its Dinner, Lunch and Bar tabs. The source for the dishes.
- `brand/eloise-logo.svg`: the wordmark, supplied by Carey.

`data/team-eloise-list.json` is written from them by hand.

## What went in, and how

**Wines (76).** Every wine on the Beverage Menu. A wine on both the by-the-glass page and the bottle pages is one wine with both prices. Glasses are 5oz, with the 8oz price in `other` ("8oz $26"); the Prosecco is 5oz only. The Sauternes is a 2oz glass with no bottle price. Bollinger Special Cuvée is a bottle with its magnum in `other`; the two wines sold only as 1.5L magnums (Jaboulet Hermitage La Chapelle 2018, Fontodi Flaccianello della Pieve 2021) have no bottle price, only `other`, as The Princess Royal's magnum-only wines do. The Antonutti Pinot Grigio Ramato is type `orange`, from the list's "Orange (Skin Contact)" section.

**Where the two sources disagree.**
- Dissegna Pinot Nero: the Beverage Menu prints 2025 (on both its pages), the site's Bar tab prints 2022. The list file follows the Beverage Menu. Worth asking Eloise which is poured.
- Desserts: the site prints Citrus Parfait (orange, meringue, Earl Grey jelly), Chocolate Tart and Sticky Coffee Pudding; the Beverage Menu's last page prints Citrus Parfait (grapefruit, meringue, Earl Grey), "Mango Sticky Rice" Mille-Feuille and Apple Tarte Tatin. The list file follows the site, captured the day this was built.

**Fixed while transcribing.** Spellings the list prints differently are corrected: Piattelli Vineyards (printed Piatelli), Les Sétilles (Setilles), Cornas Terres Brûlées (Terre Brûlée), La Santa de Úrsula (La Santa Ursula), Côtes de Thau (Cote De Thau), Planteray 3 Stars, Earl Grey.

**Kept as printed, though it may not be right.** Carey should check these with Eloise before the pitch; the training is written from what's in the list file.
- Borgogno No Name 2023 is printed among the Barolos ("Barolo | No Name | Borgogno"). No Name is bottled as Langhe Nebbiolo (Borgogno's declassified Barolo), and a 2023 couldn't yet be released as Barolo, so the list file gives its region as Piedmont and doesn't call it a Barolo.
- Antonutti Pinot Grigio Ramato is printed as Veneto; Antonutti is a Friuli producer. Kept as Veneto.
- Piattelli Alto Molino Malbec is printed as Mendoza; Piattelli's Alto Molino wines come from Cafayate, Salta. Kept as Mendoza.
- The rosé printed "Cote De Thau IGP | St. John Beausoleil Rosé" is entered as producer St. John, wine Beausoleil Rosé, Côtes de Thau IGP: the list doesn't make clear which word is the producer.
- "Rosso di Orma | Sette Ponti" is entered as producer Sette Ponti, wine Rosso di Orma, Sangiovese and Cabernet Sauvignon as printed.

**Grapes.** Where the label or the appellation fixes them, `grapes_basis: label`; where the house's blend is documented, `known` (the Champagnes from Tarlant and Bollinger, Ca' del Bosco, Flaccianello); otherwise `typical` (the Bordeaux, the André Chemin Champagnes, the rosés that don't print a grape, Buttafuoco, Mencía for the Ribeira Sacra reds, the Canary Islands red, Eleventh Post, Aucalà).

**Dishes (17).** Dinner's appetizers, pastas and mains (lunch is the same menu without the côte de boeuf) and the site's three desserts, each serving two. Sides (roasted cabbage, grilled broccolini, frites) are left out, as for the other restaurants. No diet tags: the menu doesn't print them, and the kitchen confirms allergens on the console (Canada's priority allergens, from `venue.country` CA).

**Cocktails (10).** The four House Cocktails, four Classics and two Zero-Proof drinks, ingredients and pour sizes as printed. Beer, spirits, coffee and tea are left out. Half-price cocktails (Monday to Saturday, 5pm to 7pm) and the $50 corkage are in `venue.about`.

**Demo team and sales.** The same invented team as The Social Corner (the Larkspur's people and photos) and eight weeks of invented sales in dollars, labelled Demo data. The POS item the list doesn't carry is "House Prosecco (Events)" (`venue.offList`), invented.

**Branding.** The wordmark Carey supplied, filled white for the app's dark header (`team/brand/eloise/wordmark-white.svg`, `venue.brand.logo`) and for the page written for them (`site/teams/img/for/eloise.svg`). No mark or accent colour: the header keeps the Vinterest mark.
