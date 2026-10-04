// Fading: right answers have a review date (2 weeks, doubling with each refresh); past it they
// fade, count half in Mastery, show faded on the map and come first in the next quiz.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');
const WINES = [{ name: 'Viña Ardanza', region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 91, body: 0.65, tannins: 0.6, acidity: 0.6, scanned_at: '2026-06-02T12:00:00Z' }];
const D = 864e5;

async function user(context, page) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1', vinterest_pro: '1',
    vinterest_milestones: '{}', vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }), vinterest_wines: JSON.stringify(WINES) });
  await stubNetwork(context);
}
// Rioja with a 6-question bank, all answered right `daysAgo` days ago.
async function studiedRioja(page, daysAgo) {
  await page.evaluate(({ daysAgo, D }) => {
    RegionUnlocks.unlock('Rioja');
    const pool = Array.from({ length: 6 }, (_, i) => ({ q: `Rioja question ${i + 1}?`, opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'], a: 0, fact: 'Fact.' }));
    localStorage.setItem(RegionQuizBank.key('Rioja'), JSON.stringify(pool));
    pool.forEach((q) => QuizMastery.recordAnswer(RegionQuizBank.setId('Rioja'), q.q, true, Date.now() - daysAgo * D));
  }, { daysAgo, D });
}

test('the schedule: due after 2 weeks, twice as long after each refresh, back after a miss', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate((D) => {
    const Q = QuizMastery, t = Date.parse('2026-01-01T00:00:00Z'), pool = [{ q: 'A?' }, { q: 'B?' }, { q: 'C?' }];
    const r = [Q.recordAnswer('t:x', 'A?', true, t), Q.recordAnswer('t:x', 'A?', true, t + D)];
    const f13 = Q.freshness('t:x', pool, t + 13 * D), f15 = Q.freshness('t:x', pool, t + 15 * D);
    r.push(Q.recordAnswer('t:x', 'A?', true, t + 15 * D)); // a refresh: next due 28 days on
    const f40 = Q.freshness('t:x', pool, t + 40 * D), f44 = Q.freshness('t:x', pool, t + 44 * D);
    Q.recordAnswer('t:x', 'B?', true, t + 44 * D); Q.recordAnswer('t:x', 'B?', false, t + 45 * D); // a miss
    const f45 = Q.freshness('t:x', pool, t + 45 * D);
    const order = Q.draw('t:x', pool, 3, t + 45 * D).map((q) => q.q);
    return { r, f13, f15, f40, f44, f45, order, complete: Q.isComplete('t:x', [{ q: 'A?' }, { q: 'B?' }]) };
  }, D);
  expect(out.r).toEqual(['learned', false, 'refreshed']);
  expect(out.f13).toMatchObject({ correct: 1, fading: 0, strength: 1 / 3 });
  expect(out.f15).toMatchObject({ correct: 1, fading: 1, strength: 0.5 / 3 }); // half
  expect(out.f40.fading).toBe(0);
  expect(out.f44.fading).toBe(1);
  expect(out.f45).toMatchObject({ correct: 2, fading: 2 }); // B missed: fading again, still known
  expect(out.order).toEqual(['C?', 'A?', 'B?']); // not yet known, then fading (oldest first)
  expect(out.complete).toBe(true); // fading never undoes a completed set
});

test('a fading region counts half in Mastery, fades on the map, and is offered as a refresher', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await studiedRioja(page, 5);
  const fresh = await page.evaluate(() => KnowledgeMap.compute().areas.find((a) => a.id === 'regions').items.find((i) => i.name === 'Rioja'));
  await page.evaluate((D) => { const s = RegionQuizBank.setId('Rioja'); const d = QuizMastery.get(); Object.keys(d.sets[s].recall).forEach((q) => { d.sets[s].recall[q].at -= 30 * D; }); QuizMastery.save(d); }, D);
  const out = await page.evaluate(() => ({
    item: KnowledgeMap.compute().areas.find((a) => a.id === 'regions').items.find((i) => i.name === 'Rioja'),
    pin: KnowledgeMap.regionMap().find((v) => v.id === 'europe').pins.find((p) => p.name === 'Rioja'),
    refresh: KnowledgeMap.refreshers()[0], up: LearnNext.home().more.concat([LearnNext.home().primary]).map((x) => x && x.title),
  }));
  expect(fresh.quiz).toBe(100);
  expect(out.item.quiz).toBe(50);
  expect(out.item.fading).toBe(6);
  expect(out.pin.fading).toBe(6);
  expect(out.refresh).toMatchObject({ label: 'Rioja', fading: 6, total: 6, learn: { kind: 'region', region: 'Rioja' } });
  expect(out.up).toContain('Refresh Rioja');
});

test('Learn offers the refresher; the quiz brings answers back, with a little XP each', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await studiedRioja(page, 30);
  await page.goto(`${BASE}/#learn`);
  const block = page.getByTestId('refreshers');
  await expect(block).toContainText('Time for a refresher');
  await expect(block).toContainText('6 of 6 answers fading');
  await block.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(info.project.outputDir, 'refreshers.png') });
  const xp0 = await page.evaluate(() => XPSystem.get().total);
  await block.getByText('Refresh →').first().click();
  for (let i = 0; i < 5; i++) {
    await root(page).getByText('Right', { exact: true }).first().click();
    await root(page).getByText(/^(Next Question|See Results) →$/).click();
  }
  await expect(root(page)).toContainText('5 fading answers refreshed');
  await expect(root(page)).toContainText('1 more answer is fading');
  await expect(root(page).getByText('Refresh · 1 fading')).toBeVisible();
  expect(await page.evaluate(() => XPSystem.get().total)).toBe(xp0 + 25);
  await page.screenshot({ path: path.join(info.project.outputDir, 'refreshed.png') });
  expect(errors).toEqual([]);
});
