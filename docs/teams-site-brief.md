# Vinterest for teams: website brief

Written from Carey's discovery answers on 31 October 2026. Martin's survey
(https://claude.ai/artifact/LNsaY4gsmsA3FvxZuqrFpP) will correct and add to the buyer, the words
and the money; the sections marked *Martin* are the ones his answers feed first.

## Who we're selling to

The ideal customers, after talking with Martin (2 November 2026): higher-end restaurants, wine bars,
restaurant groups and wineries. Pubs and small independents aren't excluded, but the site's customer
types, examples and pricing tiers aren't built around them. The owner or general manager signs; the
head sommelier or whoever runs wine sets it up; servers and bartenders use it. Groups are the same
product with a bigger conversation, on their own page.

Rigour scales by role, not by venue: the console sets a standard for each role (a bartender's, a
server's, a sommelier's), and the copy talks about those standards. "Bar" means a customer type or a
place on the site, never a measure: no "raise the bar" or "meet the bar".

Pilot markets: London and Toronto/Ontario, with groups in Ontario and a winery connection
(Château des Charmes). So: pounds and dollars both, "till" and "POS" both, Square and Lightspeed
first and Toast named, and the LCBO's world understood on the Ontario page. Wineries and tasting
rooms get their own page with equal billing.

## The pain, in evidence

Carey tested Cubitt House (the Princess Royal): the bartenders couldn't pass the consumer app's red
wine quiz at all, the one person who knew wine had left, and the pub is missing sales because of
it. Martin, from restaurant management, confirms: lack of knowledge is lost sales. Nobody could say
what training exists today; the working assumption is very little, an afterthought, and no formal
way to train or to see who knows what. Management doesn't know whether their team is good or bad.

So the problem the site names is three things in one breath: staff who can't talk about the list,
a manager who can't see it, and the sales that go with both.

## The lead message

Knowledge equals sales, told through the guest's night. The order: a confident, informed server
makes a better night for the guest, which is repeat business and a better chance of selling wine,
and the manager can see it for the first time. Money and guest experience together, with "see who's
ready" as the manager's hook. Onboarding speed is proof, not the lead.

Headline candidates, to test on Martin and on real owners:

- Every server fluent in your wine list. See who's ready before service.
- Your staff can't sell wine they can't describe.
- Knowledge sells wine. Now you can see who has it.

Voice: plain, direct, the trade's own words, no cleverness ("table nine", "cigarette" are out). No
serif headings. People rate wines; the only "score" on the site is readiness and the match.

## What a visitor can do (product-led)

1. Play with a demo restaurant, ungated: the Larkspur console and phone, live on the page through
   the consumer site's demo machinery (the real `team-*` sources, a memory-only store seeded from
   `TeamSample.load('demo')`, `TeamDemo.seedProgress`, `TeamSales.seedDemo`). No sign-up, no lead.
2. Try it on your list, gated by a short sign-up: one page of the wine list (a photo or PDF), ten
   wines read from it, limited cards back on the page. Needs the Worker's team purposes, which are
   open during the pilot; a cap per visitor and per day.
3. A readiness plan and a demo, for those who leave contact details: what their list would need,
   per role, and a call.

The calculator is ungated and sits high on the page.

## The calculator (keep)

The one piece of the earlier mockups to carry forward. It computes extra wine takings a year from
the owner's own figures, shown as three scenarios at once: a 2%, 5% and 10% lift (and a slider for
their own guess). Nothing is claimed for them; the copy says the console measures the real figure
from the till once sales are in.

Basic mode, from what every owner knows: covers a night, nights a week, average glass price, average
bottle price. It derives a wine spend per cover from a stated assumption the owner can change.
Precise mode, for those who track it: glasses and bottles sold a night (or wine takings a week),
which replaces the assumption. Sliders throughout, guesses welcome, the output moving as they nudge.

The mechanism the copy explains beside it: glass to bottle. A server who can say why a bottle suits
the table's food turns one glass into a bottle, and one glass into a second; pairings printed beside
dishes and reinforced by the server edge the decision. *Martin: the metric names (PPA, attach,
beverage %), a plausible lift, which inputs a GM knows.*

## Pricing

A shape, not a number, until the minimum commercial product is settled: per site, per month, any
number of staff; tiers by staff numbers, cellar size and training rigour; transactional where
possible; groups and custom work (integrations, custom learning) by conversation; a pilot rate for
the first restaurants. Data strictness is implied for every size and never sold as a feature.

## Pages

- Home.
- For restaurants (independents) and For groups, as two pages.
- For wineries and tasting rooms.
- Pricing, with the tier shape.
- Contact / book a demo (the gated door), privacy and terms.
- No security page; a short data section on pricing or in the footer.

## Home page structure (proposed)

1. Nav: logo with TEAMS, Restaurants, Groups, Wineries, Pricing, "Try it on your list".
2. Hero: the lead message, two doors (Play with the demo, ungated; Try it on your list, gated), and
   the live console behind or beside it.
3. The guest's night: three exchanges, what a guest hears now against the card's line, from the
   Larkspur's own cards.
4. The calculator, with the glass-to-bottle mechanism beside it.
5. How it works in three steps, each with the real screen: send the list, five minutes a shift,
   see who's ready.
6. The manager's view: the live console demo in full (readiness, slipping, new on the list, the
   till's slow movers).
7. Built for your kind of room: restaurant, fine dining, wine bar, group, winery, each one line and
   a link.
8. Fair questions (objections).
9. Try it on your list.

Carousels, demos and motion where they carry the point: the console tabs, the phone screens as a
swipeable row, the calculator's figures counting, cards arriving on scroll. Nothing that clouds the
proposition.

## Design direction

Linear and Stripe as the reference: precise type, generous space, the product shown in motion,
numbers as proof, few words per screen. Poppins throughout (headings included), Instrument Serif
only as an accent word if at all. The brand's neon palette (the lifted crimson, the wine-type
colours as the console's chips and bars), on a light background where it reads better and dark
where the product sits. Less app-UI, more best-in-class web: no glass cards and glows copied from
the app, no device bezels around every screen, and no paper, cream or green.

## Open questions for Martin's answers

Who has to want it first at a group; the words for the category and the titles; what training
existed at Cactus, who owned it, what was measured; the metric names; a plausible lift and any
before-and-after; what would make a GM trust the readiness figure; POS systems; the first sentence
of the pitch and the objections; the tasting-room job and wineries as a channel; LCBO and VQA
specifics; trade shows.

## Next

1. Martin's answers in; revise this brief.
2. One home-page mockup in the design direction, with the calculator and the live demo real.
3. Carey's pick, then the full set of pages, the demo bundle, and `tests/teams-site.spec.js`.
