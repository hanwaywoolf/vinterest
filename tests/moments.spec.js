// How XP and its moments reach the user (pwa-moments.jsx): one quiet chip that adds up, and moment
// cards above the navigation that wait for a calm screen; the quiz result shows its own.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const WINES = [{ name: 'Viña Ardanza', region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 91, body: 0.65, tannins: 0.6, acidity: 0.6, scanned_at: '2026-06-02T12:00:00Z' }];

async function user(context, page, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1', vinterest_pro: '1',
    vinterest_milestones: '{}', vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }), vinterest_wines: JSON.stringify(WINES), ...seed });
  await stubNetwork(context);
}

test('plain XP is one chip that adds up a burst, not a pill per award', async ({ context, page }, info) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => { XPSystem.awardAndToast([{ type: 'rate' }]); XPSystem.awardAndToast([{ type: 'article', articleKey: 'x1' }]); });
  const chip = page.getByTestId('xp-chip');
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText('+55'); // in Home's XP badge, not over the screen
  await expect(page.getByTestId('moment-card')).toHaveCount(0); // nothing here worth a card
  await page.screenshot({ path: path.join(info.project.outputDir, 'xp-badge.png') });
  await expect(chip).toHaveCount(0, { timeout: 5000 }); // and it goes
  // On Learn (no badge) it's one chip with the biggest bonus, just above the navigation.
  await page.goto(`${BASE}/#learn`);
  await page.evaluate(() => { XPSystem.awardAndToast([{ type: 'rate' }]); XPSystem.awardAndToast([{ type: 'article', articleKey: 'x2' }]); });
  await expect(chip).toContainText('+55 XP');
  await expect(chip).toContainText('Article completed');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(info.project.outputDir, 'xp-chip.png') });
  await expect(chip).toHaveCount(0, { timeout: 5000 }); // and it goes
});

test('a new grape waits for a calm screen, then offers its quiz', async ({ context, page }, info) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#mastery-map`);
  await page.evaluate(() => { GrapeUnlocks.unlockViaScan({ grapes: ['Nebbiolo'], type: 'red' }); });
  await page.goto(`${BASE}/#learn`);
  await page.evaluate(() => { location.hash = '#article'; });
  await page.evaluate(() => XPSystem.awardAndToast([{ type: 'new_grape', value: 'Nebbiolo' }]));
  await expect(page.getByTestId('xp-chip')).toContainText('+15 XP'); // the chip shows anywhere, at the foot
  await expect(page.getByTestId('moment-card')).toHaveCount(0); // not over what they're reading
  await page.evaluate(() => { location.hash = '#home'; });
  const card = page.getByTestId('moment-card');
  await expect(card).toContainText('New grape');
  await expect(card).toContainText('Nebbiolo');
  await expect(card.getByRole('button', { name: /Take the Nebbiolo quiz/ })).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(info.project.outputDir, 'moment-grape.png') });
  // It sits above the navigation, clear of it.
  const [c, nav] = await Promise.all([card.boundingBox(), page.getByText('My Wines', { exact: true }).last().boundingBox()]);
  expect(c.y + c.height).toBeLessThanOrEqual(nav.y);
  await card.getByRole('button', { name: 'Dismiss' }).click();
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a level-up is a card with the way to the level screen', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => { for (let i = 0; i < 3; i++) XPSystem.awardAndToast([{ type: 'article', articleKey: 'lvl' + i }]); });
  const card = page.getByTestId('moment-card');
  await expect(card).toContainText("You're now an Enthusiast");
  await expect(card).toContainText('to Explorer');
  await card.getByRole('button', { name: /See your level/ }).click();
  await expect(card).toHaveCount(0);
});

test('the quiz result shows its level-up itself, with nothing floating over it', async ({ context, page }, info) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => {
    const d = XPSystem.get(); d.total = 140; XPSystem.save(d);
    RegionUnlocks.unlock('Rioja');
    const pool = Array.from({ length: 5 }, (_, i) => ({ q: `Rioja question ${i + 1}?`, opts: ['Right', 'Wrong one', 'Wrong two', 'Wrong three'], a: 0, fact: 'Fact.' }));
    localStorage.setItem(RegionQuizBank.key('Rioja'), JSON.stringify(pool));
    Handoff.quiz.set({ mode: 'region', region: 'Rioja' });
  });
  await page.goto(`${BASE}/#quiz`);
  const root = page.locator('#root');
  for (let i = 0; i < 5; i++) {
    await root.getByText('Right', { exact: true }).first().click();
    await expect(page.getByTestId('xp-chip')).toHaveCount(0);
    await root.getByText(/^(Next Question|See Results) →$/).click();
  }
  const marks = page.getByTestId('milestone-moment');
  await expect(marks).toContainText('Enthusiast level reached');
  await expect(marks).toContainText('Your first region studied');
  await expect(page.getByTestId('xp-chip')).toHaveCount(0);
  await expect(page.getByTestId('moment-card')).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(info.project.outputDir, 'quiz-levelup.png') });
});
