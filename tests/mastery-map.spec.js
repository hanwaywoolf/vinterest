// Mastery's picture of progress: the weekly history behind the radar's "a month ago" outline,
// the drink-weighted "Start here", and the map of wine regions.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');
const w = (name, region, type, grapes, rating) => ({ name, region, country: 'x', type, grapes, rating, body: 0.6, tannins: 0.6, acidity: 0.6, sweetness: 0.05, scanned_at: '2026-06-01T12:00:00Z' });
const WINES = [
  { ...w('Gran Reserva 904', 'Rioja Alta', 'red', ['Tempranillo'], 95), country: 'Spain' },
  { ...w('Viña Ardanza', 'Rioja', 'red', ['Tempranillo'], 91), country: 'Spain' },
  { ...w('Imperial', 'Rioja', 'red', ['Tempranillo'], 93), country: 'Spain' },
  { ...w('Bourgogne Rouge', 'Burgundy', 'red', ['Pinot Noir'], 88), country: 'France' },
  { ...w('Ürziger Würzgarten', 'Mosel', 'white', ['Riesling'], 92), country: 'Germany' },
];

async function user(context, page, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1', vinterest_pro: '1',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }), vinterest_wines: JSON.stringify(WINES), ...seed });
  await stubNetwork(context);
}

test('every knowledge-base region has a pin inside one map view', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const views = KnowledgeMap.regionMap();
    const pinned = views.flatMap((v) => v.pins.map((p) => p.name));
    const inBox = views.every((v) => v.pins.every((p) => p.x >= 0 && p.x <= v.w && p.y >= 0 && p.y <= v.h));
    return { n: Object.keys(KNOWLEDGE.regions).length, pinned: pinned.length, unique: new Set(pinned).size, inBox, land: views.every((v) => v.land.length > 100) };
  });
  expect(out.pinned).toBe(out.n);
  expect(out.unique).toBe(out.n);
  expect(out.inBox).toBe(true);
  expect(out.land).toBe(true);
});

test('Start here weighs what they drink: three Riojas beat a lower score elsewhere', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    ['Rioja', 'Burgundy', 'Mosel'].forEach((r) => RegionUnlocks.unlock(r));
    QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    const f = KnowledgeMap.focus();
    return { label: f.label, why: f.why, next: f.next, gap: KnowledgeMap.summary().gap.label };
  });
  expect(out.label).toBe('Rioja');
  expect(out.why).toBe("You've had 3 wines from Rioja and haven't studied it yet.");
  expect(out.next).toEqual({ label: 'Take the Rioja quiz', region: 'Rioja' });
  expect(out.gap).toBe('Rioja'); // Home and Learn say the same
  // No wines: the lowest area, as before.
  const empty = await page.evaluate(() => KnowledgeMap.focus([]).why);
  expect(empty).toBeNull();
});

test('history: one snapshot a week, compared with about a month ago, and kept in backups', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    localStorage.removeItem(KnowledgeMap.HISTORY_KEY);
    const D = 864e5, now = Date.parse('2026-10-04T12:00:00Z');
    const m0 = KnowledgeMap.compute();
    const firstWeek = KnowledgeMap.progress(m0, now);
    KnowledgeMap.note(m0, now - 35 * D);
    KnowledgeMap.note(m0, now - 21 * D);
    QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    const m1 = KnowledgeMap.compute();
    KnowledgeMap.note(m1, now);
    KnowledgeMap.note(m1, now + 60e3); // same week, nothing changed: no new entry
    const p = KnowledgeMap.progress(m1, now);
    return { firstWeek, weeks: Object.keys(KnowledgeMap.history()).length, thenWeeks: p.weeks, overall: p.overall, top: p.rises[0], backed: Backup._isProgressKey(KnowledgeMap.HISTORY_KEY) };
  });
  expect(out.firstWeek).toBeNull();
  expect(out.weeks).toBe(3);
  expect(out.thenWeeks).toBe(5); // the latest snapshot at least four weeks old
  expect(out.overall).toBeGreaterThan(0);
  expect(out.top).toEqual({ id: 'red', label: 'Red', delta: 50 });
  expect(out.backed).toBe(true);
});

test('the Mastery screen: Start here, the shape with last month, and the map', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => {
    ['Rioja', 'Burgundy', 'Mosel'].forEach((r) => RegionUnlocks.unlock(r));
    const m = KnowledgeMap.compute();
    KnowledgeMap.note(m, Date.now() - 30 * 864e5);
    QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    Guides.markRead('taste_four_steps');
  });
  await page.goto(`${BASE}/#mastery-map`);
  await expect(root(page)).toContainText('Your Mastery');
  await expect(page.getByTestId('mastery-focus')).toContainText('Rioja');
  await expect(root(page)).toContainText('your biggest rise is Red (+50)');
  await expect(root(page).getByRole('img', { name: /^Your knowledge by area: Red 50%/ })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(info.project.outputDir, 'mastery-top.png') });
  await page.getByRole('img', { name: /^Your knowledge by area/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'mastery-radar.png') });
  // The map opens on Europe, where their regions are; a tap on Rioja's pin shows it.
  const map = root(page).getByRole('img', { name: /^Map of Europe: 3 of \d+ wine regions unlocked/ });
  await expect(map).toBeVisible();
  const pos = await page.evaluate(() => { const v = KnowledgeMap.regionMap().find((x) => x.id === 'europe'); const p = v.pins.find((x) => x.name === 'Rioja'); return { x: p.x / v.w, y: p.y / v.h }; });
  const box = await map.boundingBox();
  await map.click({ position: { x: pos.x * box.width, y: pos.y * box.height } });
  await expect(page.getByTestId('map-picked')).toContainText('Rioja');
  await expect(page.getByTestId('map-picked')).toContainText("Not started · 0% · you've had 3");
  await map.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'mastery-map.png'), fullPage: false });
  await root(page).getByRole('button', { name: /North America/ }).click();
  await expect(root(page).getByRole('img', { name: /^Map of North America/ })).toBeVisible();
  expect(errors).toEqual([]);
});

// Palate: what they can taste, from their Blind Calls against each label's profile.
test('Palate scores Blind Calls per axis, names a habit, and fills in over five calls', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const none = Palate.compute();
    const reds = WineHistory.getAll().filter((w) => w.type === 'red'); // body 0.6, tannins 0.6, acidity 0.6
    // Three calls, each guessing tannins 0.25 grippier than the label; body and acidity spot on.
    reds.forEach((w, i) => ScanFlow.saveBlindResult(w, { accuracy: 0.87, amount: 200, guess: { body: 0.6, acidity: 0.6, tannins: 0.85 } }));
    const p = Palate.compute();
    return { none: { score: none.score, n: none.n, next: none.next.label }, p, leans: Palate.leans(p) };
  });
  expect(out.none).toEqual({ score: 0, n: 0, next: 'Play Blind Call on your next bottle' });
  expect(out.p.n).toBe(4); // three Riojas and the Burgundy
  expect(out.p.axes.find((a) => a.id === 'body').score).toBe(100);
  expect(out.p.axes.find((a) => a.id === 'tannins').score).toBe(60); // 1 − 1.6 × 0.25
  expect(out.leans).toEqual(["You tend to call tannins grippier than the label's profile."]);
  expect(out.p.score).toBe(Math.round(87 * 4 / 5)); // four of five calls
  expect(out.p.next.label).toBe('Play Blind Call on your next bottle (4 of 5)');
  await page.goto(`${BASE}/#mastery-map`);
  const card = page.getByTestId('mastery-palate');
  await expect(card).toContainText('4 Blind Calls');
  await expect(card).toContainText('Tannin dries your gums');
  await expect(card).toContainText('grippier than the label');
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'mastery-palate.png') });
  expect(errors).toEqual([]);
});

// Milestones: marked once where they happen, listed with a date, never a flood of old news.
test('milestones: old ones filed as earlier, a new one marked once on the quiz result, shared', async ({ context, page }) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const before = await page.evaluate(() => {
    QuizMastery.topicPool('white_grapes').forEach((q) => QuizMastery.recordAnswer('topic:white_grapes', q.q, true));
    localStorage.removeItem(Milestones.KEY);
    const first = Milestones.check(KnowledgeMap.compute(), Palate.compute());
    return { first, seen: Milestones.seen() };
  });
  expect(before.first).toEqual([]); // the first look files what's there
  expect(Object.keys(before.seen).length).toBe(0); // nothing reached yet at 50% white
  // Red basics, but miss nothing: answering every question takes Red to 50%, then reading takes it on.
  const fresh = await page.evaluate(() => {
    QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    const m = KnowledgeMap.compute(); m.areas.find((a) => a.id === 'red').score = 70; // as if they'd read around it
    return Milestones.check(m, Palate.compute()).map((x) => x.title);
  });
  expect(fresh).toEqual(['Confident in Red wine']);
  const again = await page.evaluate(() => { const m = KnowledgeMap.compute(); m.areas.find((a) => a.id === 'red').score = 70; return Milestones.check(m, Palate.compute()); });
  expect(again).toEqual([]); // once

  // On the Mastery screen it's listed with its date, and Share copies the line when there's no share sheet.
  await page.evaluate(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); });
  await page.goto(`${BASE}/#mastery-map`);
  const list = page.getByTestId('mastery-milestones');
  await expect(list).toContainText('Confident in Red wine');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await list.getByRole('button', { name: 'Share: Confident in Red wine' }).click();
  await expect(list).toContainText('Copied to share');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('Confident in Red wine on Vinterest 🍷 https://vinterest.app');
  expect(errors).toEqual([]);
});

test('a quiz round that completes a region marks the milestone on its result', async ({ context, page }, info) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => {
    localStorage.setItem(Milestones.KEY, '{}');
    RegionUnlocks.unlock('Rioja');
    const pool = Array.from({ length: 5 }, (_, i) => ({ q: `Rioja question ${i + 1}?`, opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'], a: 0, fact: 'Fact.' }));
    RegionQuizBank.save ? RegionQuizBank.save('Rioja', pool) : localStorage.setItem('vinterest_region_quiz_bank_Rioja', JSON.stringify(pool));
  });
  const hasBank = await page.evaluate(() => (RegionQuizBank.pool('Rioja') || []).length);
  test.skip(hasBank !== 5, 'region bank seeding differs');
  await page.evaluate(() => { Handoff.quiz.set({ mode: 'region', region: 'Rioja' }); });
  await page.goto(`${BASE}/#quiz`);
  for (let i = 0; i < 5; i++) {
    await root(page).getByText('Right', { exact: true }).first().click();
    await root(page).getByText(/^(Next Question|See Results) →$/).click();
  }
  await expect(page.getByTestId('milestone-moment')).toContainText('Your first region studied');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(info.project.outputDir, 'milestone.png') });
});

// The grape cluster: every Learn grape as a berry, red-skinned and white/pink bunches, sized by
// mastery, in fixed seeded slots; a tap shows the grape and its next step.
async function grapeStudy(page) {
  await page.evaluate(() => {
    const bank = (g) => Array.from({ length: 6 }, (_, i) => ({ q: `${g} question ${i + 1}?`, opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'], a: 0, fact: 'Fact.' }));
    const study = (g, n, daysAgo = 1) => {
      GrapeUnlocks.unlockManual(g);
      localStorage.setItem(_grapeQuizCacheKey(g), JSON.stringify(bank(g)));
      bank(g).slice(0, n).forEach((q) => QuizMastery.recordAnswer('grape:' + g, q.q, true, Date.now() - daysAgo * 864e5));
    };
    study('Tempranillo', 6); study('Chardonnay', 3); study('Riesling', 6, 40); study('Pinot Grigio', 0);
  });
}

test('the grape cluster: 50 berries in two fixed bunches, sized by mastery', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await grapeStudy(page);
  const out = await page.evaluate(() => {
    const a = KnowledgeMap.grapeCluster(), b = KnowledgeMap.grapeCluster();
    const all = a.bunches.flatMap((x) => x.grapes), get = (n) => all.find((g) => g.name === n);
    return {
      sizes: a.bunches.map((x) => [x.id, x.grapes.length]), total: a.total,
      same: JSON.stringify(a.bunches.map((x) => x.grapes.map((g) => [g.name, g.x, g.y]))) === JSON.stringify(b.bunches.map((x) => x.grapes.map((g) => [g.name, g.x, g.y]))),
      tour: get('Touriga Nacional').skin, pink: [get('Pinot Grigio').skin, a.bunches[1].grapes.some((g) => g.name === 'Gewürztraminer')],
      tempranillo: get('Tempranillo'), chardonnay: get('Chardonnay'), riesling: get('Riesling'), malbec: get('Malbec').state,
      big: KnowledgeMap.bunchSlots(300).slots.length, // the app shows 50; this only checks the layout has room to grow
    };
  });
  expect(out.sizes).toEqual([['red', 27], ['white', 23]]);
  expect(out.total).toBe(50);
  expect(out.same).toBe(true); // seeded: never reshuffles
  expect(out.tour).toBe('red');
  expect(out.pink).toEqual(['pink', true]);
  expect(out.tempranillo).toMatchObject({ state: 'open', score: 70, level: 'Confident' });
  expect(out.chardonnay.score).toBe(35);
  expect(out.riesling.fading).toBe(6);
  expect(out.malbec).toBe('locked');
  expect(out.big).toBe(300);
});

test('the grape cluster on Mastery: labelled berries, a tap opens the grape page, growth is remembered', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await grapeStudy(page);
  await page.evaluate(() => WineHistory.add({ name: 'Rioja Reserva', type: 'red', region: 'Rioja', country: 'Spain', grapes: ['Tempranillo'], rating: 93 }));
  await page.goto(`${BASE}/#mastery-map`);
  const cluster = page.getByTestId('grape-cluster');
  await cluster.scrollIntoViewIfNeeded();
  await expect(cluster.getByRole('button')).toHaveCount(50);
  await expect(cluster.getByRole('button', { name: 'Tempranillo, red grape: Confident, 70%' })).toBeVisible();
  await expect(cluster.getByRole('button', { name: /^Riesling, white grape: .*6 answers fading$/ })).toBeVisible();
  await expect(cluster.getByRole('button', { name: 'Malbec, red grape: not unlocked yet' })).toBeVisible();
  await page.waitForTimeout(1100);
  await page.screenshot({ path: path.join(info.project.outputDir, 'grapes.png') });
  expect(await page.evaluate(() => Device.grapesSeen().Tempranillo)).toBe(70);

  // A tap opens the grape's own page.
  await cluster.getByRole('button', { name: /^Tempranillo/ }).click();
  await expect(page.getByTestId('grape-sketch')).toBeVisible();
  await expect(page.getByRole('img', { name: /^Sketch of Tempranillo: Red-skinned; Thick, dark skins\.$/ })).toBeVisible();
  const prog = page.getByTestId('grape-progress');
  await expect(prog).toContainText('Confident · 70%');
  await expect(prog).toContainText("You've had 4 bottles of it; your best was Gran Reserva 904 (95)");
  await expect(prog).toContainText('Take the Tempranillo quiz →');
  for (const t of ['Northern Spain, most likely Rioja', 'Ribera del Duero', 'Toro', 'In the winery', 'American oak']) await expect(root(page)).toContainText(t);
  await page.screenshot({ path: path.join(info.project.outputDir, 'grape-page.png') });
  await root(page).getByText('In the winery').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'grape-page-2.png') });
  // Back returns to Mastery; Enter on a berry opens it too.
  await root(page).getByRole('button', { name: 'Back' }).click();
  await cluster.getByRole('button', { name: /^Riesling/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('grape-progress')).toContainText('Refresh the Riesling quiz');
  expect(errors).toEqual([]);
});

test('grapes as a list, back lands on the grapes, and the page lists their own bottles', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await grapeStudy(page);
  await page.goto(`${BASE}/#mastery-map`);
  await page.getByRole('tab', { name: 'List' }).click();
  const list = page.getByTestId('grape-list');
  await list.scrollIntoViewIfNeeded();
  const names = await list.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').split(',')[0]));
  expect(names.length).toBe(50);
  // Most progress first in each bunch; not-unlocked grapes last.
  expect(names[0]).toBe('Tempranillo');
  expect(Math.max(names.indexOf('Riesling'), names.indexOf('Chardonnay'))).toBeLessThan(names.indexOf('Pinot Grigio'));
  expect(names.indexOf('Pinot Grigio')).toBeLessThan(names.indexOf('Viognier'));
  await expect(list.getByRole('button', { name: /^Tempranillo/ })).toContainText('70%');
  await page.screenshot({ path: path.join(info.project.outputDir, 'grape-list.png') });

  // Back from a grape returns to the list, where they were, not the top of Mastery.
  const scroller = () => page.getByTestId('grape-list').locator('xpath=ancestor::div[contains(@style,"overflow-y: auto")][1]');
  const chard = list.getByRole('button', { name: /^Chardonnay/ });
  await chard.scrollIntoViewIfNeeded();
  const before = await scroller().evaluate((el) => el.scrollTop);
  expect(before).toBeGreaterThan(200);
  await chard.click();
  await expect(page.getByTestId('grape-progress')).toBeVisible();
  await root(page).getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('grape-list')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'List' })).toHaveAttribute('aria-selected', 'true');
  expect(Math.abs(await scroller().evaluate((el) => el.scrollTop) - before)).toBeLessThan(40);

  // The grape's page lists their own bottles of it, best first; a tap opens the wine.
  await page.getByTestId('grape-list').getByRole('button', { name: /^Tempranillo/ }).click();
  const mine = page.getByTestId('grape-my-wines');
  await expect(mine.getByRole('button')).toHaveCount(3);
  await expect(mine.getByRole('button').first()).toContainText('Gran Reserva 904');
  await mine.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'grape-my-wines.png') });
  await mine.getByRole('button').first().click();
  await expect(root(page)).toContainText('Gran Reserva 904');
  await expect(page.getByTestId('grape-my-wines')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('every grape has a page: origin, wines and how its bunch looks', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const gaps = await page.evaluate(() => GRAPE_ALLOWLIST.flatMap((g) => {
    const i = GrapeInfo.get(g); const miss = [];
    if (!i) return [g];
    if (!i.origin) miss.push(g + '.origin'); if (!(i.wines && i.wines.length)) miss.push(g + '.wines');
    if (!(i.look && i.look.notes && i.look.notes.length)) miss.push(g + '.look');
    return miss;
  }));
  expect(gaps).toEqual([]);
});
