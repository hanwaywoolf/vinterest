/* Vinterest — Quiz Question Bank */

const QUIZ_TOPICS = [
  {
    id:'red_grapes', label:'Red Grapes', icon:'🍇', color:'#8B1A2F',
    desc:'Cabernet to Nebbiolo — know your reds',
    questions:{
      beginner:[
        {q:'Which grape forms the backbone of Bordeaux red blends?',opts:['Cabernet Sauvignon','Pinot Noir','Nebbiolo','Sangiovese'],a:0,fact:'Cab Sauv dominates the left-bank Médoc — Pauillac, Saint-Estèphe and Margaux.'},
        {q:'Chianti is made primarily from which grape?',opts:['Sangiovese','Merlot','Grenache','Tempranillo'],a:0,fact:'Sangiovese is the soul of Tuscany — it means "blood of Jupiter".'},
        {q:'Pinot Noir is the signature grape of which French region?',opts:['Burgundy','Bordeaux','Rhône','Alsace'],a:0,fact:'Burgundy\'s Côte de Nuits is arguably the world\'s greatest Pinot Noir terroir.'},
        {q:'Malbec is most celebrated in which country?',opts:['Argentina','Spain','Italy','Chile'],a:0,fact:'Mendoza\'s high altitude and sunshine transformed Malbec into an international star.'},
        {q:'Which grape makes Barolo — "the King of Italian wines"?',opts:['Nebbiolo','Barbera','Dolcetto','Aglianico'],a:0,fact:'Nebbiolo is described as smelling of tar and roses, and can age for 30+ years.'},
        {q:'Rioja reds are primarily made from which grape?',opts:['Tempranillo','Garnacha','Monastrell','Mencía'],a:0,fact:'Tempranillo is Spain\'s most planted red grape and means "little early one".'},
        {q:'Which Australian region is most famous for old-vine Shiraz?',opts:['Barossa Valley','Yarra Valley','Margaret River','Clare Valley'],a:0,fact:'Barossa has vines over 150 years old — producing some of the world\'s most concentrated Shiraz.'},
        {q:'Beaujolais Nouveau is made from which grape?',opts:['Gamay','Pinot Noir','Grenache','Carignan'],a:0,fact:'Gamay is the only grape allowed in Beaujolais — vinified by carbonic maceration for fresh, fruity wines.'},
      ],
      intermediate:[
        {q:'Amarone della Valpolicella is made from dried grapes — its primary variety is?',opts:['Corvina','Sangiovese','Montepulciano','Primitivo'],a:0,fact:'Corvina grapes are dried for months on bamboo racks in a process called "appassimento".'},
        {q:'Which single grape produces Hermitage and Crozes-Hermitage in the Northern Rhône?',opts:['Syrah','Grenache','Mourvèdre','Viognier'],a:0,fact:'The Northern Rhône is exclusively Syrah territory — no blending permitted.'},
        {q:'Primitivo in Italy is genetically identical to which American variety?',opts:['Zinfandel','Petite Sirah','Carignane','Alicante'],a:0,fact:'DNA testing confirmed Primitivo = Zinfandel in the 1990s. Both trace back to a Croatian grape.'},
        {q:'Which grape is considered Portugal\'s finest red, used in Port and dry wines?',opts:['Touriga Nacional','Touriga Franca','Tinta Roriz','Tinta Barroca'],a:0,fact:'Touriga Nacional is prized for its intense floral aromas and deep colour.'},
        {q:'Tannat is the signature grape of which South American country?',opts:['Uruguay','Chile','Argentina','Brazil'],a:0,fact:'Uruguay made Tannat its national grape — it thrives in the Atlantic-influenced climate.'},
        {q:'Châteauneuf-du-Pape blends up to 18 varieties — which typically dominates?',opts:['Grenache','Syrah','Mourvèdre','Cinsault'],a:0,fact:'Grenache often makes up 60–80% of a CdP blend, giving warmth and red fruit character.'},
        {q:'Blaufränkisch is Austria\'s finest red. What is it called in Germany?',opts:['Lemberger','Zweigelt','St. Laurent','Spätburgunder'],a:0,fact:'Blaufränkisch/Lemberger is spicy, structured and capable of great ageing in Burgenland.'},
        {q:'Pinotage is a unique grape created in which country?',opts:['South Africa','Australia','New Zealand','Chile'],a:0,fact:'Pinotage is a South African cross of Pinot Noir and Cinsaut, created at Stellenbosch University in 1925.'},
      ],
      expert:[
        {q:'Aglianico del Vulture DOCG comes from which Italian region?',opts:['Basilicata','Campania','Puglia','Calabria'],a:0,fact:'The volcanic Mount Vulture soils of Basilicata give Aglianico extraordinary mineral depth.'},
        {q:'Pomerol and Saint-Émilion on Bordeaux\'s right bank are dominated by:',opts:['Merlot','Cabernet Franc','Cabernet Sauvignon','Petit Verdot'],a:0,fact:'Pétrus — the world\'s most expensive wine by the bottle — is almost 100% Merlot.'},
        {q:'Xinomavro is a structured red grape indigenous to which country?',opts:['Greece','Turkey','Bulgaria','Croatia'],a:0,fact:'"Xinomavro" means "acid black" in Greek — it\'s the Nebbiolo of the Eastern Mediterranean.'},
        {q:'Sagrantino DOCG, with wine\'s highest tannin levels, is grown near:',opts:['Montefalco','Orvieto','Torgiano','Assisi'],a:0,fact:'Sagrantino di Montefalco is one of Italy\'s most powerful and age-worthy wines.'},
        {q:'Which grape makes the famed single-varietal wines of Priorat, Spain?',opts:['Garnacha','Tempranillo','Monastrell','Bobal'],a:0,fact:'Old-vine Garnacha on Priorat\'s black slate "llicorella" produces extreme concentration.'},
        {q:'Nerello Mascalese grown on Etna\'s volcanic slopes is often compared to which Burgundy grape?',opts:['Pinot Noir','Gamay','Chardonnay','Aligoté'],a:0,fact:'Etna Rosso from Nerello Mascalese shares Pinot Noir\'s translucency, earthiness and perfume.'},
      ]
    }
  },
  {
    id:'white_grapes', label:'White Grapes', icon:'🥂', color:'#B8963E',
    desc:'Chardonnay to Riesling and beyond',
    questions:{
      beginner:[
        {q:'White Burgundy (Chablis, Meursault, Puligny) is made from which grape?',opts:['Chardonnay','Sauvignon Blanc','Pinot Gris','Viognier'],a:0,fact:'All white Burgundy is 100% Chardonnay — one grape, infinite expressions.'},
        {q:'Marlborough, New Zealand made which grape internationally famous?',opts:['Sauvignon Blanc','Chardonnay','Pinot Gris','Riesling'],a:0,fact:'Marlborough Sauvignon Blanc changed the world\'s palate in the 1980s with its vivid tropical character.'},
        {q:'Prosecco is made from which grape variety?',opts:['Glera','Chardonnay','Pinot Grigio','Trebbiano'],a:0,fact:'Glera (formerly called Prosecco) must make up at least 85% of any Prosecco DOC wine.'},
        {q:'Albariño is the aromatic white grape of which Spanish region?',opts:['Rías Baixas','Rioja','Rueda','Penedès'],a:0,fact:'Rías Baixas in rainy Galicia produces the most vivid and food-friendly Albariño.'},
        {q:'Champagne\'s "Blanc de Blancs" is made exclusively from which grape?',opts:['Chardonnay','Pinot Noir','Pinot Meunier','Pinot Blanc'],a:0,fact:'Blanc de Blancs ("white from whites") — lighter, more delicate and longer-lived than non-vintage Champagne.'},
        {q:'German Riesling can range in style from:',opts:['Bone dry to lusciously sweet','Only sweet','Only dry','Only medium-sweet'],a:0,fact:'Germany\'s Prädikat system (Kabinett through Trockenbeerenauslese) covers dry to intensely sweet.'},
        {q:'Which grape is used to make Soave DOC from Veneto, Italy?',opts:['Garganega','Verdicchio','Greco','Fiano'],a:0,fact:'Garganega is the backbone of Soave — delicate, almondy and food-friendly.'},
        {q:'Grüner Veltliner is the flagship white grape of which country?',opts:['Austria','Germany','Switzerland','Hungary'],a:0,fact:'Austria\'s most planted grape — known for its signature white pepper note and crisp minerality.'},
      ],
      intermediate:[
        {q:'Viognier is the sole grape of which Northern Rhône appellation?',opts:['Condrieu','Hermitage','Crozes-Hermitage','Saint-Joseph'],a:0,fact:'Condrieu produces the world\'s most exotic and heady aromatic whites — 100% Viognier.'},
        {q:'Which white grape is the primary variety in Sauternes?',opts:['Sémillon','Sauvignon Blanc','Muscadelle','All three blend'],a:3,fact:'Sauternes is a blend — Sémillon dominates (affected by noble rot), with Sauvignon Blanc and Muscadelle.'},
        {q:'Furmint is the grape at the heart of which legendary sweet wine?',opts:['Tokaji Aszú','Sauternes','Trockenbeerenauslese','Eiswein'],a:0,fact:'Hungarian Tokaji has been made since the 17th century — praised by Napoleon and the Tsar.'},
        {q:'Palomino is the grape used to make which classic fortified wine?',opts:['Sherry','Madeira','Marsala','Port'],a:0,fact:'Palomino Fino makes up 95%+ of the base wine for Fino and Manzanilla Sherry.'},
        {q:'Which Burgundy white appellation is known for steely, mineral, unoaked style?',opts:['Chablis','Meursault','Puligny-Montrachet','Chassagne-Montrachet'],a:0,fact:'Chablis sits north of the rest of Burgundy — Kimmeridgian limestone gives it unparalleled minerality.'},
        {q:'Torrontés — Argentina\'s aromatic white — is most expressive from which province?',opts:['Salta','Mendoza','Río Negro','San Juan'],a:0,fact:'Salta\'s extreme altitude (up to 3,000m) produces the most floral, vibrant Torrontés.'},
        {q:'Muscadet is made from which grape variety?',opts:['Melon de Bourgogne','Muscadelle','Muscat','Melon Blanc'],a:0,fact:'Melon de Bourgogne — crisp, light and perfect with oysters and seafood from the Atlantic coast.'},
        {q:'"Sur lie" ageing means the wine is aged on:',opts:['Dead yeast cells after fermentation','Oak chips','Tartrate crystals','The grape skins'],a:0,fact:'Sur lie ageing adds creaminess, complexity and autolytic (bread-dough) character to white wines.'},
      ],
      expert:[
        {q:'Rkatsiteli — one of the world\'s oldest cultivated vines — is from which country?',opts:['Georgia','Greece','Armenia','Bulgaria'],a:0,fact:'Georgia\'s 8,000-year winemaking history centres on Rkatsiteli and amber-style qvevri wines.'},
        {q:'In Alsace, what is an "Edelzwicker"?',opts:['A blend of noble Alsatian grapes','A late harvest sweet wine','A single-vineyard Riesling','A sparkling Crémant'],a:0,fact:'Edelzwicker ("noble blend") can combine Riesling, Pinot Gris, Gewürztraminer and others.'},
        {q:'Airén covers vast plains of La Mancha. Why is it significant?',opts:['It may be the world\'s most planted white grape by area','It makes Spain\'s finest whites','It is used to make Cava','It is the base for Sherry'],a:0,fact:'Airén\'s prolific yields over La Mancha\'s arid plains made it the most planted white grape globally for decades.'},
        {q:'Vernaccia di San Gimignano holds which historic Italian wine distinction?',opts:['Italy\'s first DOC (1966)','Italy\'s most exported white','The oldest documented Tuscan wine','The only Tuscan DOCG white'],a:0,fact:'Vernaccia di San Gimignano was Italy\'s very first DOC, awarded in 1966.'},
        {q:'Gewürztraminer at its most expressive typically shows which aromatic profile?',opts:['Lychee, rose petal, ginger and spice','Green apple and citrus','Herbaceous and grassy','Tropical passionfruit and guava'],a:0,fact:'Gewürztraminer\'s hallmarks are intense lychee, Turkish delight and exotic spice aromas — often off-dry.'},
        {q:'Which Galician white appellation — not Rías Baixas — is known for fragrant, mineral whites from the Ribeiro valley?',opts:['Ribeiro','Monterrei','Valdeorras','Txakoli'],a:0,fact:'Ribeiro is Galicia\'s oldest appellation — its Treixadura-dominant blends are floral, fresh and underrated.'},
      ]
    }
  },
  {
    id:'regions', label:'Wine Regions', icon:'🌍', color:'#5E8FA8',
    desc:'From Bordeaux to Barossa',
    questions:{
      beginner:[
        {q:'Which French region produces famous Cabernet Sauvignon-based reds?',opts:['Bordeaux','Burgundy','Champagne','Loire Valley'],a:0,fact:'Bordeaux\'s left-bank Médoc (Pauillac, Margaux) is the historic home of great Cabernet.'},
        {q:'True Champagne can only come from which country?',opts:['France','Italy','Spain','Germany'],a:0,fact:'The Champagne appellation is legally protected — only wines from this specific French region can use the name.'},
        {q:'The Barossa Valley is a world-famous wine region in which country?',opts:['Australia','New Zealand','South Africa','Argentina'],a:0,fact:'Barossa in South Australia is renowned for old-vine Shiraz, some vines over 150 years old.'},
        {q:'Chianti Classico is produced in which Italian region?',opts:['Tuscany','Piedmont','Veneto','Sicily'],a:0,fact:'Chianti Classico sits in the hills between Florence and Siena — the ancient heart of Chianti.'},
        {q:'Rioja is a celebrated wine region in which country?',opts:['Spain','Portugal','Italy','France'],a:0,fact:'Rioja\'s tiered Crianza, Reserva, Gran Reserva system is Spain\'s most recognised appellation.'},
        {q:'Marlborough, famed for Sauvignon Blanc, is in which country?',opts:['New Zealand','Australia','South Africa','Chile'],a:0,fact:'Marlborough at the top of New Zealand\'s South Island has perfect cool-climate conditions.'},
        {q:'Napa Valley is the most prestigious wine region in which country?',opts:['USA','Australia','Argentina','Chile'],a:0,fact:'Napa Valley Cabernet Sauvignon commands prices rivalling Bordeaux — and often outscores them in blind tastings.'},
        {q:'Douro Valley is Portugal\'s greatest wine region, famous for:',opts:['Port and exceptional dry reds','Vinho Verde','Alentejo table wines','Light rosé'],a:0,fact:'The terraced schist vineyards of the Douro produce classic Port and some of Europe\'s finest dry reds.'},
      ],
      intermediate:[
        {q:'Which Bordeaux appellation on the "right bank" is home to Pétrus?',opts:['Pomerol','Pauillac','Margaux','Saint-Estèphe'],a:0,fact:'Pomerol\'s clay soils are ideal for Merlot. Pétrus, the world\'s most expensive wine, comes from here.'},
        {q:'Piedmont\'s "Langhe" hills are home to which two great DOCG wines?',opts:['Barolo & Barbaresco','Prosecco & Soave','Brunello & Vino Nobile','Amarone & Ripasso'],a:0,fact:'The Langhe is the beating heart of Nebbiolo — Barolo (bigger) and Barbaresco (more elegant).'},
        {q:'Which German region produces the finest Rieslings on steep slate slopes?',opts:['Mosel','Rheingau','Pfalz','Nahe'],a:0,fact:'Mosel\'s impossibly steep terraces face south to maximise sunshine in this cool climate.'},
        {q:'Priorat — known for powerful Garnacha — is in which Spanish region?',opts:['Catalonia','Castilla y León','Rioja','Galicia'],a:0,fact:'Priorat\'s unique black slate and quartz soils ("llicorella") give its wines extraordinary mineral depth.'},
        {q:'Willamette Valley in Oregon, USA is most celebrated for:',opts:['Pinot Noir','Cabernet Sauvignon','Chardonnay','Merlot'],a:0,fact:'Oregon\'s cool, rainy Willamette Valley produces Pinot Noirs that rival Burgundy at a fraction of the price.'},
        {q:'Stellenbosch is a world-class wine region in which country?',opts:['South Africa','Australia','Argentina','Chile'],a:0,fact:'Stellenbosch — just outside Cape Town — is home to some of Africa\'s finest Cabernet Sauvignon.'},
        {q:'Mendoza, at altitude in the Andes foothills, is in which country?',opts:['Argentina','Chile','Bolivia','Uruguay'],a:0,fact:'Mendoza produces 70% of Argentina\'s wine — its high altitude and sunshine are perfect for Malbec.'},
        {q:'Which region of Italy makes the sparkling Franciacorta using the traditional method?',opts:['Lombardy','Piedmont','Veneto','Friuli'],a:0,fact:'Franciacorta DOCG near Brescia is Italy\'s answer to Champagne — bottle-fermented and aged on lees.'},
      ],
      expert:[
        {q:'How many Premiers Crus Classés châteaux exist in the 1855 Bordeaux Classification?',opts:['5','6','4','8'],a:0,fact:'The original 1855 list had 4 Premiers Crus; Mouton Rothschild was promoted in 1973 — the only change in 170 years.'},
        {q:'Gevrey-Chambertin is a Grand Cru commune in which sub-region of Burgundy?',opts:['Côte de Nuits','Côte de Beaune','Mâconnais','Chablis'],a:0,fact:'The Côte de Nuits runs from Gevrey-Chambertin to Nuits-Saint-Georges — the world\'s greatest Pinot Noir strip.'},
        {q:'Tokaj wine region historically spans Hungary and which other country?',opts:['Slovakia','Czech Republic','Ukraine','Romania'],a:0,fact:'A small strip of the historic Tokaj region lies in Slovakia, where Tokajský wines are still produced.'},
        {q:'Tokaj wine region historically spans Hungary and which other country?',opts:['Slovakia','Czech Republic','Ukraine','Romania'],a:0,fact:'A small strip of the historic Tokaj region lies in Slovakia, where Tokajský wines are still produced.'},
        {q:'The Mosel valley in Germany borders which two countries?',opts:['Luxembourg and France','Belgium and the Netherlands','Switzerland and Austria','France and Belgium'],a:0,fact:'The Mosel river rises in France, passes through Luxembourg, and joins the Rhine at Koblenz in Germany.'},
        {q:'Vinho Verde DOC in Portugal means "green wine" — what does this actually refer to?',opts:['The wine is young/fresh, not the colour','The wine is always white','Wines made from green grapes','Wines from the Minho green hills only'],a:0,fact:'"Verde" means young — Vinho Verde is meant to be drunk young and fresh. Red and white versions both exist.'},
        {q:'Coonawarra in South Australia is famous for its "terra rossa" soils over limestone. What does it grow best?',opts:['Cabernet Sauvignon','Shiraz','Pinot Noir','Chardonnay'],a:0,fact:'Coonawarra\'s red terra rossa topsoil over cool limestone produces structured, elegant Cabernet of outstanding quality.'},
      ]
    }
  },
  {
    id:'tasting', label:'Tasting Technique', icon:'👁️', color:'#7B5EA7',
    desc:'See, swirl, sniff, sip, savour',
    questions:{
      beginner:[
        {q:'What does "tannins" refer to in red wine?',opts:['The drying, grippy sensation in your mouth','The sweetness level','The alcohol content','The acidity level'],a:0,fact:'Tannins come from grape skins, seeds, stems and oak barrels — they create structure and allow ageing.'},
        {q:'When a wine is described as "dry", it means:',opts:['Very little residual sugar','It tastes woody','It has low alcohol','It is highly acidic'],a:0,fact:'A dry wine has had almost all its grape sugar fermented into alcohol. The opposite of sweet.'},
        {q:'What does "finish" or "length" mean in wine tasting?',opts:['How long flavours linger after you swallow','The colour depth of the wine','The weight of the wine','The complexity of the nose'],a:0,fact:'A "long finish" (20+ seconds of lingering flavour) is a hallmark of great wine.'},
        {q:'Why do you swirl wine in the glass?',opts:['To release aromas by oxygenating the wine','To check the wine\'s colour','To mix any sediment','To cool the wine faster'],a:0,fact:'Swirling vaporises aromatic compounds so your nose can detect them more easily.'},
        {q:'What does "terroir" mean?',opts:['The complete natural environment of a vineyard','A French wine classification','A barrel ageing technique','A type of indigenous grape'],a:0,fact:'Terroir (soil, climate, slope, aspect, microbiome) is what makes one plot taste different from its neighbour.'},
        {q:'A wine with "high acidity" will taste:',opts:['Crisp and mouthwatering','Bitter and astringent','Sweet and rich','Flat and dull'],a:0,fact:'Acidity makes your mouth water — it\'s the backbone of fresh, food-friendly wine. Low acidity feels "flabby".'},
        {q:'What is "body" in wine tasting terms?',opts:['How heavy and full the wine feels in your mouth','The colour and opacity of the wine','The alcohol level on the label','How long it was aged'],a:0,fact:'Body is largely determined by alcohol and extract — think of skimmed milk (light) vs double cream (full).'},
        {q:'What does "oak influence" typically add to a wine?',opts:['Vanilla, toast, spice and rounded texture','Higher acidity','More tannins from the grapes','A lighter colour'],a:0,fact:'New French oak adds vanilla and spice; American oak is more coconut and sawdust. Both soften and round wine.'},
      ],
      intermediate:[
        {q:'What is "malolactic fermentation" (MLF)?',opts:['Converting tart malic acid to softer lactic acid','Adding sugar before primary fermentation','A second alcoholic fermentation','Fermenting in barrels instead of tanks'],a:0,fact:'MLF makes wines rounder and creamier — virtually all reds and many oaked whites undergo it.'},
        {q:'What do "legs" or "tears" on a glass actually indicate?',opts:['Higher alcohol or residual sugar (Marangoni effect)','Better wine quality','The wine is ready to drink','The glass needs cleaning'],a:0,fact:'Legs are caused by the Marangoni effect — they indicate higher alcohol or sugar, NOT quality.'},
        {q:'A wine described as "bretty" has:',opts:['A barnyard, leather or Band-Aid aroma from yeast','A fresh, floral perfume','Excessive oak tannins','A green, underripe character'],a:0,fact:'Brettanomyces yeast creates "brett" — at low levels complex, at high levels a wine fault.'},
        {q:'What is "reduction" in wine?',opts:['A sulphury or struck-match character from lack of oxygen','A wine concentrated by evaporation','A technique to lower alcohol','Overripe fruit character'],a:0,fact:'Reduction occurs when wine hasn\'t had enough oxygen — it often blows off with swirling or decanting.'},
        {q:'Why do winemakers "punch down" during red wine fermentation?',opts:['To submerge the grape skin cap and extract colour and tannin','To add oxygen','To remove yeast','To cool the fermenting must'],a:0,fact:'Grape skins float to form a "cap" — breaking it up maximises colour, tannin and flavour extraction.'},
        {q:'"Volatile acidity" (VA) at high levels creates which fault?',opts:['A vinegary or nail-polish aroma','Excessive tannin','Overripe jammy fruit','Earthy mushroom character'],a:0,fact:'VA is mostly acetic acid — above ~1.4 g/L it becomes a detectable and unpleasant fault.'},
        {q:'What does decanting an old red wine primarily achieve?',opts:['Separates sediment and allows the wine to breathe','Chills the wine quickly','Adds oxygen to increase tannins','Removes sulphur from the wine'],a:0,fact:'Old wines should be gently decanted to remove sediment; young tannic reds benefit from the aeration.'},
        {q:'"Phenolic ripeness" in red wines most directly affects:',opts:['Tannin smoothness and mouthfeel','Colour intensity','Nose complexity','Acidity levels'],a:0,fact:'Fully phenolically ripe tannins are silky and round; underripe phenolics produce hard, astringent tannins.'},
      ],
      expert:[
        {q:'The WSET Systematic Approach to Tasting covers which main categories?',opts:['Appearance, Nose, Palate, Conclusions','Colour, Aroma, Flavour, Finish, Score','See, Swirl, Sniff, Sip, Score','Structure, Fruit, Oak, Balance, Score'],a:0,fact:'The WSET SAT is the global standard used from Level 2 through the Diploma and MW.'},
        {q:'What is the purpose of "dosage" in Champagne production?',opts:['To adjust final sweetness after disgorging','To initiate secondary fermentation','To clarify the wine by riddling','To stabilise with sulphur'],a:0,fact:'Dosage (wine + sugar added after disgorgement) determines Brut, Extra Brut, Demi-Sec etc.'},
        {q:'"Whole-cluster fermentation" in Pinot Noir contributes:',opts:['Spice, savouriness and structural tannin from stems','More colour and extraction','Faster fermentation','Higher alcohol levels'],a:0,fact:'Stems can add a forest floor or spicy savoury complexity — used by top Burgundy producers like Rousseau.'},
        {q:'Which compound primarily causes the "cat\'s pee" aroma in Sauvignon Blanc?',opts:['Methoxypyrazines','Thiols','Linalool','Esters'],a:0,fact:'Pyrazines create green, herbaceous, vegetal aromas — especially from cool-climate Sauvignon Blanc.'},
        {q:'What is "cryoextraction" used for in sweet wine production?',opts:['Freezing grapes to concentrate sugars and flavours','Rapid cooling after fermentation','Chilling the must before pressing','Stabilising wine at low temperatures'],a:0,fact:'Cryoextraction mimics natural freezing — water in the grape freezes first, leaving concentrated sugary juice.'},
        {q:'The "Brix" scale measures:',opts:['Potential alcohol from sugar content in grape juice','Tannin levels in red wines','Acidity in finished wine','Total sulphur dioxide levels'],a:0,fact:'Each degree Brix roughly corresponds to 0.55% potential alcohol — winemakers use it to decide harvest timing.'},
      ]
    }
  },
  {
    id:'food_pairing', label:'Food & Wine', icon:'🍽️', color:'#1E7B4B',
    desc:'Match wine to the table',
    questions:{
      beginner:[
        {q:'Which wine is the classic pairing with oysters?',opts:['Chablis or dry Champagne','Oaked Chardonnay','Full-bodied Shiraz','Sweet Riesling'],a:0,fact:'The mineral, saline acidity of Chablis mirrors the salinity of oysters — a textbook match.'},
        {q:'What is the classic pairing with Sauternes?',opts:['Foie gras','Beef steak','Tomato pasta','Sushi'],a:0,fact:'Sauternes\' sweetness and acidity balance the richness of foie gras — one of food and wine\'s great marriages.'},
        {q:'Which wine would you choose with a rich rack of lamb?',opts:['Full-bodied red (Cabernet/Syrah)','Dry Riesling','Light Rosé','Sparkling wine'],a:0,fact:'The tannins and body of a full-bodied red cut through lamb fat and cleanse the palate beautifully.'},
        {q:'Why does sparkling wine pair so well with fried food?',opts:['The bubbles and acidity cut through oil','The sweetness balances salt','The tannins match the crunch','The low alcohol reduces richness'],a:0,fact:'Champagne and fish & chips is genuinely brilliant — the acidity and bubbles dissolve the grease.'},
        {q:'A light, crisp Pinot Grigio pairs best with:',opts:['Light seafood and salads','Rich beef stews','Strong blue cheese','BBQ ribs'],a:0,fact:'Match wine weight to food weight — light wine, light dish. Pinot Grigio would be overwhelmed by heavy food.'},
        {q:'"What grows together, goes together" suggests:',opts:['Regional food and wine pairings often work best','Only French wine with French food','Organic wine with organic food','Coastal wines taste of the sea'],a:0,fact:'Italian wine with Italian food, Rioja with tapas — regional pairings are almost always a safe starting point.'},
        {q:'Which wine works best with a simple green salad with vinaigrette?',opts:['Crisp, high-acid white (Sauvignon Blanc)','Full-bodied red','Oaked Chardonnay','Sweet Riesling'],a:0,fact:'Match acid with acid — the wine\'s acidity needs to meet or exceed the vinaigrette, or it will taste flat.'},
        {q:'Champagne is traditionally served as an aperitif. Why does it work so well?',opts:['High acidity and bubbles stimulate appetite','High sugar gives energy before the meal','It is the most expensive option','Tradition only — no flavour reason'],a:0,fact:'Bubbles and acidity cleanse and stimulate the palate — making Champagne a perfect appetite opener.'},
      ],
      intermediate:[
        {q:'Tannic red wines should generally be avoided with:',opts:['Fish and shellfish','Red meat','Hard aged cheese','Mushroom dishes'],a:0,fact:'Tannin reacts with fish oils to create an unpleasant metallic or bitter taste on the palate.'},
        {q:'A wine with high residual sugar pairs best with:',opts:['Spicy food','Acidic tomato dishes','Cured meats','Raw vegetables'],a:0,fact:'Sweetness in wine tames the heat of chilli — an off-dry Riesling with Thai curry is a classic example.'},
        {q:'For a chocolate dessert, the wine should be:',opts:['Sweeter than the dessert','Drier than the dessert','The same sweetness','As tannic as possible'],a:0,fact:'If the wine is less sweet than the dessert, it will taste thin and acidic — always match or exceed sweetness.'},
        {q:'Umami-rich foods (mushrooms, aged cheese, truffle) tend to:',opts:['Amplify tannins and acidity in wine','Soften tannins','Add perceived sweetness','Have no effect'],a:0,fact:'Umami intensifies perceived tannin and acidity — choose lower-tannin, lower-acid wines with umami-heavy dishes.'},
        {q:'Why does Sancerre pair so well with Crottin de Chavignol goat\'s cheese?',opts:['Both from Loire Valley — share herbaceous, mineral qualities','Both are white','Both are French','Wine tannins balance cheese fat'],a:0,fact:'This textbook regional pairing — the cheese and wine share the same mineral, grassy Loire terroir.'},
        {q:'The "bridge ingredient" technique means:',opts:['Using a shared ingredient in the sauce to link wine and dish','Serving two wines per course','Using the cooking wine as the drinking wine','Matching wine colour to sauce colour'],a:0,fact:'A lemon butter sauce bridges sole to white Burgundy; a red wine reduction bridges beef to Pomerol.'},
        {q:'Rich, fatty foods (duck confit, foie gras) pair well with wines that have:',opts:['High acidity to cut through the fat','Low acidity to complement richness','High sweetness to match richness','High tannins to overwhelm the fat'],a:0,fact:'Acidity acts as a palate cleanser — it cuts through fat and makes each bite taste fresh again.'},
        {q:'Which classic pairing breaks the "tannin + fish = metallic" rule?',opts:['Fatty tuna steak with light Pinot Noir','Salmon with Barolo','Turbot with Barolo','Oysters with Shiraz'],a:0,fact:'Dense, fatty tuna has the body to handle a light Pinot Noir — the fat neutralises tannin.'},
      ],
      expert:[
        {q:'Aged Comté cheese pairs exceptionally well with:',opts:['White Burgundy or Vin Jaune','Barolo','Vintage Port','Dry Rosé'],a:0,fact:'Comté and Vin Jaune share a Jura origin and matching nutty, oxidative character — a great regional match.'},
        {q:'"Congruent pairing" means:',opts:['Matching similar flavour compounds in wine and food','Contrasting wine and food to create balance','Serving the wine that was cooked with the dish','Pairing by price point'],a:0,fact:'Congruent = like with like: buttery Chardonnay with butter sauce, fruity Pinot with cherry reduction.'},
        {q:'Roquefort and Sauternes is a classic "contrast pairing". What makes it work?',opts:['Sweet vs salty; rich vs acidic — opposites attract','Both are from the same region','Both have high acidity','The wine\'s tannins balance the cheese'],a:0,fact:'The sweetness and acidity of Sauternes cuts through the salty fat of Roquefort — a contrast match.'},
        {q:'Why can Alsace Gewürztraminer work with mildly spiced Indian dishes?',opts:['Residual sweetness tames spice; lychee/rose mirrors curry aromatics','High tannins absorb chilli heat','High acidity refreshes the palate','Low alcohol reduces perceived heat'],a:0,fact:'Off-dry Gewürz has the sweetness to tame spice and the exotic aromatics to complement curry spices.'},
        {q:'Salt in food makes wine taste:',opts:['Less bitter and more fruity','More acidic','Sweeter','More tannic'],a:0,fact:'Salt suppresses bitterness and enhances fruit — it makes tannic wines taste smoother and rounder.'},
        {q:'Which umami-rich pairing demonstrates why vintage Port and Stilton is a classic?',opts:['Port\'s sweetness and tannin balance the salty, savoury, fatty Stilton','Both are aged for decades','Both are British','The port\'s acidity cuts the cheese fat'],a:0,fact:'Stilton\'s intense saltiness and fat are balanced by Port\'s sweetness, tannin and rich fruit — a great contrast match.'},
      ]
    }
  }
];
