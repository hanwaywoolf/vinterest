# The App Store listing

Everything App Store Connect asks for, in the order its pages ask, so the listing can be filled in from here
and checked against the app when something changes. The privacy answers follow `site/privacy.html`; change
both together.

## App Information (General)

- Name: Vinterest: Wine Scanner
- Subtitle (30 characters): Wine matched to your own taste
- Category: Food & Drink. Secondary: Education.
- Content rights: No, it doesn't contain, show or access third-party content. (Wine facts and Claude's text
  are ours to show; there's no licensed content.)
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

## The version page (1.11.1)

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
> Free includes 10 label scans a month and five grapes and regions to study. Pro adds wine list scanning
> in restaurants, more scans, every grape and region you meet, and the full Mastery map.
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
- App previews (videos): optional, none yet.
- In-App Purchases and Subscriptions: add Pro Monthly (VINPRO_M) and Pro Yearly (VINPRO_A).
- Build: the 1.11.1 build from main.
- App Review Information: sign-in required, see `docs/app-review.md`.
- Version release: Manually release this version (so it goes live when you choose after approval).
