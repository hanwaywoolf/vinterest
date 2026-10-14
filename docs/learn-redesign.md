# Learn tab: design brief

The quiz answer flow is done (PR #49: the pick colours, the options slide away, the verdict rises). This is the rest of the Learn tab, written so a build session can execute it without reopening the design. Every item names the file, the function and the test, in priority order. Build them top to bottom; each is its own commit.

Ground rules that apply to all of it: theme colours only (`useTheme()`, `T.*`; nothing hard-coded white or pink); rate, never score (a wine is rated; "score" is the match and the Mastery figures); teach while asking; reduced motion shows every state finished; durations divided by `quizSpeed()` where a test drives the screen; every new top-level name goes into `ADDED_SINCE_BUNDLE` in `tests/parity.spec.js`; check at Extra large on a 375px phone.

## 1. Quiz results: a reveal, not a form

`QuizScreen`, `phase==='results'` in `pwa-screens-quiz.jsx` (about line 1507).

What's wrong: the results screen is a crimson header with two numbers and a verdict word, then a list of cards. It's the same whether they got 0 or 5. It arrives in one frame, so the moment where the round pays off has no moment.

Target:

```
┌──────────────────────────────┐
│          ◯ 4 / 5             │   ring sweeps up from 0 to 4 segments (one per answer,
│        Excellent!            │   green/red in order, 120ms apart) over ~900ms
│   Rioja · 9 of 15 answered   │   set name with flag; progress line fills to its new width
│                              │
│   +50 XP   ·   🔥 3 streak   │   XP counts up; streak flame only if a streak happened
├──────────────────────────────┤
│  [Milestone card, if any]    │   MilestoneMoment, unchanged
│  Review                      │
│  ✓ Which grape…              │   cards fade in one after another, 60ms apart,
│  ✗ Rioja's ageing…           │   after the ring finishes
│  …                           │
├──────────────────────────────┤
│  [ Keep going · 6 to go ]    │   pinned, unchanged
│  [ Back to Learn ]           │
└──────────────────────────────┘
```

- Replace the crimson block with the screen's own stage: the glow at the top in crimson (`T.dark`), the ring drawn as an SVG arc split into `allQs.length` segments with a 4° gap, each segment stroked green or `T.tone.bad` in the order answered. The number inside is `finalScore` counting up with the segments. Keep `data-testid`s none are present; tests read the text (`Correct`, `XP earned`), so keep those two labels in the DOM.
- `msg` stays as is (Perfect!, Excellent!, Good work!, Keep practising, "<set> complete!").
- "<set> complete!" gets confetti drawn in code: twelve 6px rounded rectangles in the type's colour and green falling from the ring over 1.2s, `@keyframes qzConfetti`, once. No library, no image.
- XP: `+{xpGained}` counts from 0 over 600ms starting when the ring finishes. Streak: show `🔥 N` only if `bestStreak >= 2` (track `bestStreak` beside `streak` in state).
- Review cards: `qz-rise` stagger (`animationDelay: i*60/quizSpeed() ms`), each keeps its ✓/✗ and fact. Add a "Why" link on a wrong answer only when `r.fact` is empty: it opens the grape or region page (`openGrapePage`/`openRegionPage`) for the set, so a miss always has a way to learn.
- Timing and tests: all of it under `quizCss()` so the 8× speed applies. `tests/quiz-mastery.spec.js` waits for `Back to Learn`, which is pinned and present from the first frame, so nothing breaks; add one assertion that the ring has `allQs.length` segments (`[data-testid="result-ring"] path` count).

## 2. Question entry: the whole question moves, not just the text

`QuizScreen`, question view.

Now: the question container slides in from the right (`qz-in`) with the options inside it as one block.

Target: the question text lands first, then the options drop in one after another from below (`qz-opt-in`, 40ms apart, `translateY(14px)` to 0 with opacity). Total under 500ms at full speed. The segment in the progress bar for the current question pulses once (`qz-seg-pulse`, scale 1 → 1.25 → 1 over 500ms) as the question arrives, so the eye reads where they are without a "3 of 5" label. The difficulty of a question is not shown (the banks don't carry one).

Option tap feel: `transform: scale(0.97)` on `:active` for 80ms before the reveal colours. On the dark stage the chosen option's border glows (`box-shadow: 0 0 0 3px ${_alpha(col,0.35)}`) in green or red; on paper white the border thickens instead.

## 3. The feedback verdict: make the fact the hero

`QuizScreen`, `quiz-feedback` block.

Now: mark ring, verdict word, what they said, the answer, the fact in the same weight as everything else.

Target: the fact is the thing the user takes away, so it gets the room. Mark and verdict stay at the top in one line (ring 32px, "Correct!" beside it, the streak after). Under it the fact at 17/1.5 in `T.ink`, and only on a miss the "You said ~~X~~ · The answer: Y" line above the fact in 14 `T.mid`. Teach while asking: if the fact names a trait (body, tannin, acidity, minerality, oak), underline it dotted and a tap shows `Palate.TRAITS[axis].about` in a `Pill`-style tooltip under the fact. Match on the words in `Palate.TRAITS` keys and their plurals only.

"Next Question →" stays where it is. "or tap anywhere" becomes a real affordance: the whole feedback block is the button, with `role="button"` and a hover/active state, and the small line reads "Tap to continue".

## 4. Learn hub: a head that says where you are

`QuizHubScreen`, the fixed header and `LearnJumpRow`.

Now: level bar, Mastery link, then chips (For you, Basics, Regions, Grapes, Skills, Mastery). The chips carry counts but nothing says what's new since last time.

Target, header:

```
┌──────────────────────────────┐
│ Learn                   ◯ 32%│   knowledge ring 28px with the figure, taps to Mastery
│ Enthusiast · 240 XP to Expert│   one line, level bar under it as now
│ ▏For you 2 ▏Basics ▏Regions 1 ▏Grapes 3 ▏Skills ▏Mastery        │ chips
└──────────────────────────────┘
```

- The Mastery cream link under the level bar goes; its ring and figure move into the title row (right side, 28px, `KnowledgeMap.summary().overall`). Tap opens `mastery-map` or the Pro sheet, as the link did. Keep `data-testid="learn-mastery-link"` if tests read it (`grep learn-mastery tests/`).
- Chip counts become "new" counts, not totals: For you = unread pieces, Regions = regions with a quiz not yet started or with fading answers, Grapes = unlocked grapes with a quiz not yet done, Skills = guides not read. A chip with 0 shows no number. The chip for the section in view is filled (crimson on light, `_alpha(cr,0.25)` with a crimson border on dark); use an `IntersectionObserver` over the section refs that already exist (`secRefs`), with the sticky offset of 56.
- Chip tap scrolls as now; add `behavior:'smooth'` unless reduced motion.

## 5. Next Best Thing: one card that explains itself

`QuizHubScreen`, the `nextBest` block.

Now: a dark card with an icon, "On-ramp · 4 min", the title and subtitle. It is the one thing a new user should tap and it looks like every other row.

Target:

```
┌──────────────────────────────┐
│ UP NEXT                      │
│ ┌──────────────────────────┐ │
│ │ ▌ Why Wine Tastes the Way│ │   left rule in crimson (4px), title 18/800
│ │   It Does                │ │
│ │   4 min read · Beginner  │ │
│ │   Because you rated a    │ │   one line of why (ContentEngine.because for a shelf
│ │   Rioja 92 last week     │ │   piece; for an on-ramp piece "Start here" + its reason)
│ │                    Read →│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- Rename the label "Next Best Thing" to "Up next" (Home already says Up next; one name per thing). `grep -n "Next Best Thing" tests/` and update.
- Below it, two small rows "Also": the next quiz with fading answers (first of `refreshers`) and the next unfinished region quiz, each as a 44px row with its flag and "N fading" or "5 questions a round". This replaces the separate "Time for a refresher" section, which moves into these rows (keep `data-testid="refreshers"` on the first row's container so `tests/fading.spec.js` still finds it; read that test first).
- Card entry: `qz-rise` once on mount.

## 6. Wine Basics and regions: rows that show progress, not describe it

`QuizHubScreen`, the Basics `ShowMore` and the region rows.

Now: "Red wines · The main grapes… · 3/15 correct" as text.

Target: every quiz row carries a thin progress bar under its subtitle (4px, full width of the text column, `T.soft` track, the type's colour or crimson fill, `p.correct/p.total`), and the subtitle is the description alone. A row with fading answers shows "N fading" in amber at the right instead of the chevron. A row at 100% shows the ✓ and moves behind the `CompletedToggle` as now. Region rows show their flag (as now) and the bar in crimson.

Regions get a one-line reason under the section label for someone with none: "Scan a bottle and its region appears here" (words, no button: don't push scanning).

## 7. Grapes: pills become a shelf

`QuizHubScreen`, the grape pills.

Now: wrapped pills with a count badge, "+50 more" with a lock, which reads as a wall.

Target: a horizontal scroller of grape tiles, one row, 96px wide each, snap-scrolling (`scroll-snap-type:x mandatory`), unlocked first in the order of most progress:

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  ●     │ │  ●     │ │  ●     │ │  🔒    │
│Tempra- │ │Garnacha│ │Syrah   │ │Nebbiolo│
│nillo   │ │        │ │        │ │        │
│ ▓▓▓░░  │ │ ▓░░░░  │ │ ✓      │ │Pro     │
└────────┘ └────────┘ └────────┘ └────────┘
```

- The ● is `SketchBerry` from `pwa-sketch.jsx` at 28px in the grape's wine colour (`grapeTypeColor`), its state from `_berryState` so the tile matches Mastery's bunch. Locked tiles are the pencil outline with a lock.
- A tap on an unlocked tile starts the quiz (`handleGrapeTap`); the spinner and "Preparing your X quiz…" stay. A tap on a locked tile does what it does now.
- After the last tile, one tile "All 50 →" opens Mastery's grapes (`nav('mastery-map')` with `Handoff.masteryReturn`-style scroll to the grapes section; see how Home's Mastery links land).
- The "N of 50 unlocked · …" line stays above the shelf; it explains the free allowance.
- `tests/learn-hub.spec.js` and `tests/unlock-cap.spec.js` click grape names; the tile keeps the grape's name as its text, so `getByText('Tempranillo')` still works. Read both before changing markup.

## 8. Wine Skills: group the guides

`QuizHubScreen`, the guides `ShowMore`.

Now: a flat list of guides with "Tasting · 4 min" over each title.

Target: five group chips (Tasting, Ordering out, Buying, Pairing, Hosting; `Guides.groups()`) as a segmented row, the picked one filled; under it the guides of that group only, each row with the same progress bar as Basics (read + questions right out of 4 steps). The picked group is remembered on the phone (`Device.learnSkills`, device-only, add to `Device` in `pwa-userdata.js`). Default: the group of the next unread guide.

## 9. Mastery teaser and the foot

- The "Your Mastery" card at the foot duplicates the header ring (item 4). Replace it with the Start here step alone: "Start here: Red wine basics →" from `KnowledgeMap.focus()` as one 52px row, opening the quiz directly (free) or Mastery (Pro).
- "Courses · Coming soon" stays, but at 0.7 opacity it reads as broken. Draw it as one card with both lines inside and a single "Coming soon" tag top right, 1.0 opacity, no chevron, no ProBadge until it exists.
- "Reset XP & progress" leaves Learn. It belongs on Profile under the account card as a small link with a confirm. `grep -n "Reset XP" tests/` first.

## 10. Transitions between Learn and a quiz

`pwa-app.jsx` screen transitions, if there are any (`grep -n "scRise\|screenEnter" pwa-app.jsx`).

A quiz opening from Learn should feel like a card lifting: the tapped row scales to 0.98 on press, and the quiz screen slides up over Learn (`translateY(24px)` → 0 with opacity, 260ms) rather than replacing it in a frame. Back reverses it. If the app has no shared screen-enter animation, add one for `quiz` and `article` only, gated on reduced motion, under the same `quizSpeed()` divisor.

## Tests to touch

`tests/quiz-mastery.spec.js`, `tests/learn-hub.spec.js`, `tests/fading.spec.js`, `tests/unlock-cap.spec.js`, `tests/moments.spec.js`, `tests/layout-fit.spec.js` (Learn at Extra large), `tests/devices.spec.js` (SCREENS includes Learn and a quiz; screenshots are kept as the `screens` artifact, so look at them). `npm test` before each push.

## CLAUDE.md

Update the Learn tab layout paragraph (header ring, Up next, chips as new counts, grape shelf, skills groups, Reset on Profile) and the quiz results paragraph. Keep it to what the code does.
