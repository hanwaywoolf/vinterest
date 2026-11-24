# The App Store listing

Everything App Store Connect asks for, in the order its pages ask, so the listing can be filled in from here
and checked against the app when something changes. The privacy answers follow `site/privacy.html`; change
both together.

## App Information (General)

- Name: Vinterest: Wine Scanner
- Subtitle (30 characters): Wine matched to your own taste
- Category: Food & Drink. Secondary: Education.
- Content rights: Yes, it contains, shows or accesses third-party content, and Yes, we have the rights:
  the Shop tab shows a partner shop's bottle photo and prices from its product feed (Awin's terms) and
  links to shops.
- Age rating: see below.
- Privacy policy URL: https://vinterest.app/privacy/
- Copyright (on the version page): 2026 Vinterest.app Limited

## Age rating

Step 1, Features: Parental Controls No; Age Assurance Yes (the app asks for confirmation of legal drinking
age before anything else); Unrestricted Web Access No (shop links open the shop's own page, there's no
browser); User-Generated Content No; Social Media No; Messaging and Chat No; Shared Location No;
Advertising No (partner shop links pay a commission on a sale, never for placement, and never change a
match, pick or list order).

Later steps, answer None or No to everything except:

- Alcohol, Tobacco, or Drug Use or References: Frequent.
- Step 3, Medical or Wellness: Medical or Treatment Information None; Health or Wellness Topics No (wine and
  food advice, not self-care).
- Gambling, contests, loot boxes: No.

Apple then sets the rating (expect 18+ in the UK and most countries because of alcohol). That's right for
the app.

## Pricing and Availability

- Price: Free (Pro is the in-app subscription).
- Availability: every country except China mainland (AI-generated content there needs a licence, and
  Anthropic doesn't serve China). Same on both subscriptions.

## App Privacy

Privacy policy URL as above. Data collection: Yes. Tracking: No (nothing links our data with other
companies' for advertising, and there are no ads or ad SDKs).

| Data type | Collected | Linked to the person | Used for tracking | Purpose |
|---|---|---|---|---|
| Contact Info → Email Address | Yes (only when they sign in) | Yes | No | App Functionality |
| User Content → Other User Content (wines, ratings, notes, progress in the backup) | Yes | Yes | No | App Functionality, Product Personalization |
| Identifiers → User ID (the account's ID, also RevenueCat's) | Yes | Yes | No | App Functionality |
| Purchases → Purchase History (Pro, through RevenueCat) | Yes | Yes | No | App Functionality |
| Identifiers → Device ID (the push token, only with push on) | Yes | Yes | No | App Functionality |

Not collected: location (the country is typed, never GPS), photos (a label photo is read by Claude and not
kept), contacts, health, browsing history, usage data and diagnostics (no analytics or crash SDK in the app;
Apple's and Google's own crash reports are theirs).

## The version page

Promotional text (170):

> Scan any label and know if you'll love it, from your own ratings, not a critic's. Ask Vinny anything,
> learn as you sip, and keep every bottle you've had in one place.

Description:

> Vinterest learns what you like in wine and tells you, before you open the bottle, whether you'll
> enjoy it.
>
> SCAN ANY LABEL
> Point your camera at a bottle. Vinterest reads the wine, the vintage and where it is in its life, then
> tells its story: the grape, the place, how it'll taste and something worth saying about it at the table.
>
> SCAN A WHOLE SHELF
> In a shop, take one photo of the shelf. Vinterest reads every label it can and tells you which bottle
> suits you best. Free twice a month, and as often as you like with Pro.
>
> A MATCH FROM YOUR OWN RATINGS
> Rate what you drink and every scan comes with a match: how likely you are to enjoy this wine, worked out
> from the wines you've rated, not from a critic's score. It says why, in plain words: the grapes, regions
> and producers that lift your ratings, and the ones that hold them back.
>
> WINEDNA
> Your taste, described: the body, tannins and acidity you reach for, what you love, what to buy again,
> what to try next and a few words to say to a sommelier.
>
> ASK VINNY
> Ask anything, from what to drink with steak tonight to whether a bottle is worth the price. Vinny
> answers from the wines you've actually had.
>
> LEARN AS YOU SIP
> Short reads and quizzes written from your own bottles, a map of every region you've tasted, and Mastery
> to show how your knowledge grows. No wine vocabulary assumed: every term comes with what it means and how
> to notice it.
>
> EVERY BOTTLE, REMEMBERED
> My Wines keeps what you drank, what you paid, where you had it and what you thought.
>
> VINTEREST PRO
> Free includes 10 label scans and 2 shelf scans a month and five grapes and regions to study. Pro adds
> wine list scanning in restaurants, shelf scanning whenever you like, more scans, every grape and region you meet, and the full Mastery map.
> Pro is £4.99 a month or £34.99 a year (prices vary by country), charged to your Apple ID and renewing
> automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in your
> Apple ID settings.
>
> Terms: https://vinterest.app/terms/
> Privacy: https://vinterest.app/privacy/
>
> Vinterest is for people of legal drinking age. Please drink responsibly.

Keywords (100, no spaces, none already in the name):

> sommelier,label,scan,rioja,tasting,vintage,cellar,pairing,grape,quiz,red,white,list,restaurant,learn

- Support URL: https://vinterest.app/
- Marketing URL: https://vinterest.app/
- Screenshots: `npm run store:shots` writes the iPhone with Dynamic Island, medium display (1206 x 2622,
  the slot App Store Connect asks for first), the large iPhone (1320 x 2868) and the 13" iPad
  (2064 x 2752) sets to `store-shots/` from the real app; upload them in order, 1 to 7.
- App previews (videos): `npm run store:preview` (`scripts/app-preview.mjs`) records thirty seconds of the
  app alone at 886 x 1920, the size every iPhone slot takes. Apple wants H.264 with a sound track, which
  needs a full ffmpeg: run Actions → App preview → Run workflow, download the `app-preview` artifact and
  upload `app-preview.mp4`. Pick the poster frame in App Store Connect (the match dial, about 4 seconds in).
- In-App Purchases and Subscriptions: add Pro Monthly (VINPRO_M) and Pro Yearly (VINPRO_A).
- Build: the 1.11.1 build from main.
- App Review Information: sign-in required, see `docs/app-review.md`.
- Version release: Manually release this version (so it goes live when you choose after approval).

## Growing reach

### A free trial on Pro

Seven days free on the monthly plan only. The yearly plan is already 42% off, and a trial on both makes
the cheap yearly price the thing people try and cancel.

- App Store Connect → Subscriptions → Vinterest Pro → Pro Monthly → Subscription Prices → + →
  Create Introductory Offer: every country, no end date, Free, 1 week. New subscribers only (Apple's rule:
  one introductory offer per person per group).
- Google Play Console → Monetise → Subscriptions → the monthly subscription → its base plan → Add offer:
  eligibility "New customer acquisition, never had any subscription", one phase, Free trial, 7 days.
- RevenueCat needs nothing: the offer comes with the product.

The Pro sheet says it by itself (`Billing._trial`): "Try 7 days free", then "Then £4.99 / month · Cancel
anytime", only for someone the store says can still have the trial. Add a line to the description once
it's live: "New subscribers get the first 7 days of Pro Monthly free."

### The rating prompt

From 1.11.3 the app asks for a store rating with Apple's and Google's own sheet (`ReviewAsk` in
`pwa-userdata.js`): straight after someone rates a wine 90 or more, once they've rated five wines, at most
three times and never within 120 days. The store decides whether the sheet shows (Apple: three times a
year), so it can't be tested in TestFlight, where the sheet appears but can't submit.

### Featuring nomination

App Store Connect → Featuring → Nominations → + . Type: App Launch (or New Content once the trial is live).
Submit at least three weeks before the date you'd like, earlier for Christmas.

- Name: Vinterest: wine matched to your own taste
- Description:

> Most wine apps tell you what critics or crowds think of a bottle. Vinterest tells you what you'll think.
> Rate what you drink on the 100-point scale and every label you scan comes back with a match: the chance
> you'll enjoy this wine, worked out from your own ratings and explained in plain words (the grapes,
> regions and producers that lift your ratings, and the ones that hold them back). It never invents a
> number: until you've rated three wines of a type it says it's too early to call.
>
> Each scan plays as a short story drawn in code: the label, where the vintage is in its life, the grape
> sketched in pen, the map closing in on the region. From there the app teaches. Quizzes and short reads
> are written from the person's own bottles, a wine map fills in as they taste, and every wine word comes
> with what it means and how to notice it. Vinterest exists to take the fear out of wine.
>
> Built by Vinterest.app Limited, an independent UK company. No ads, no tracking, no data sold; sign-in is optional. Partner
> shop links never change a match or the order of a list.

- Helpful details: its own text size setting (Standard, Large, Extra large), charts labelled for screen
  readers, dark and light appearance, iPhone and iPad layouts. Vinterest Pro (£4.99 a month, £34.99 a year) adds
  restaurant wine list scanning.
- Timing hook: Christmas and New Year, when people buy wine they don't know for other people.

### In-App Events

Apple requires an event deep link that opens the app, and the app has no URL scheme or universal link
yet, so events wait for that (one release: `@capacitor/app`, a `vinterest://` scheme through
`vinterestNative`, and the link opened through the same `_openLink` push uses). The first event, ready to
enter once it exists:

- Reference name: Christmas wine 2026
- Event name (30): Find your Christmas wine
- Short description (50): Scan before you buy. Know you'll love it.
- Long description (120): Standing in the wine aisle with a list of dinners to buy for? Scan any label
  and see how well it matches your taste.
- Badge: Special Event. Purpose: appropriate for all users. Priority: High.
- Dates: publish 1 December, starts 8 December, ends 26 December 2026.
- Deep link: `vinterest://camera`
- Art: event card 1920 x 1080 and event details page 1080 x 1920, no text baked into the top or bottom
  third (Apple overlays the name there).
