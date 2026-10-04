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
