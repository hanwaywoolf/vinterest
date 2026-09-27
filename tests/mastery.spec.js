// Wine Skills guides (fixed text, three questions each) and Mastery, which is built only from
// what the user has read and the quizzes they've passed.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');
const WINES = [
  { name: 'Gran Reserva 904', region: 'Rioja Alta', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 95, body: 0.7, tannins: 0.7, acidity: 0.6, sweetness: 0.05, scanned_at: '2026-06-01T12:00:00Z' },
  { name: 'Viña Ardanza', region: 'Rioja', country: 'Spain', type: 'red', grapes: ['Tempranillo'], rating: 91, body: 0.65, tannins: 0.6, acidity: 0.6, sweetness: 0.05, scanned_at: '2026-06-02T12:00:00Z' },
];

async function user(context, page, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_wineDNA_unlock_seen: '1',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }), vinterest_wines: JSON.stringify(WINES), ...seed });
  await stubNetwork(context);
}

// Answers a guide quiz correctly: clicks whichever of the guide's right answers is on screen.
async function passGuide(page, id) {
  const right = await page.evaluate((gid) => Guides.pool(gid).map((q) => q.opts[q.a]), id);
  for (let i = 0; i < right.length; i++) {
    for (const text of right) {
      const opt = root(page).getByText(text, { exact: true });
      if (await opt.count()) { await opt.first().click(); break; }
    }
    await root(page).getByText(/^(Next Question|See Results) →$/).click();
  }
}

test('the guides: five groups, three questions each, and the queue mixes the groups', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => ({
    groups: Guides.groups().map((g) => g.id),
    n: Guides.all().length,
    shape: Guides.all().every((g) => g.questions.length === 3 && g.questions.every((q) => q.a === 0 && q.opts.length === 4) && g.sections.length === 3),
    firstFive: Guides.queue().slice(0, 5).map((g) => g.group),
  }));
  expect(out.groups).toEqual(['tasting', 'ordering', 'buying', 'pairing', 'hosting']);
  expect(out.n).toBeGreaterThanOrEqual(15);
  expect(out.shape).toBe(true);
  expect(out.firstFive).toEqual(['tasting', 'ordering', 'buying', 'pairing', 'hosting']);
});

test('Mastery moves only with reading and passing: a basics quiz, a guide, a region', async ({ context, page }) => {
  await user(context, page);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    localStorage.removeItem('vinterest_gen_stubs');
    const area = (id) => KnowledgeMap.compute().areas.find((a) => a.id === id);
    const before = { red: area('red').score, tasting: area('skill_tasting').score, overall: KnowledgeMap.compute().overall };
    QuizMastery.topicPool('red_grapes').forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    const red = area('red');
    Guides.markRead('taste_four_steps');
    const readOnly = area('skill_tasting').score;
    Guides.pool('taste_four_steps').forEach((q) => QuizMastery.recordAnswer(Guides.setId('taste_four_steps'), q.q, true));
    const tasting = area('skill_tasting');
    RegionUnlocks.unlock('Rioja');
    const regions = area('regions');
    const summary = KnowledgeMap.summary();
    return { before, red, readOnly, tasting, regions, summary };
  });
  expect(out.before).toEqual({ red: 0, tasting: 0, overall: 0 });
  expect(out.red.score).toBe(50); // basics done; no grape quizzes or articles yet
  expect(out.red.level).toBe('Developing');
  expect(out.red.next.label).toBe('Scan a red to unlock its grape quiz'); // no grape unlocked yet
  expect(out.readOnly).toBeGreaterThan(0);
  expect(out.tasting.score).toBeGreaterThan(out.readOnly);
  expect(out.tasting.next.label).toMatch(/^Read "/);
  expect(out.regions.items.map((i) => i.name)).toEqual(['Rioja']);
  expect(out.regions.score).toBe(0); // unlocked, not yet studied
  expect(out.summary.strongest.label).toBe('Red');
});

test('read a guide, pass its questions, see it in Learn and in Mastery (Pro)', async ({ context, page }) => {
  const errors = collectErrors(page);
  await user(context, page);
  await page.goto(`${BASE}/#learn`);
  await expect(root(page)).toContainText('Wine Skills');
  await expect(root(page)).not.toContainText('Concept Check');
  await expect(root(page)).toContainText('Your wine knowledge · 0%');
  // Free: the Mastery card opens the Pro sheet.
  await root(page).getByText('Your wine knowledge · 0%').click();
  await expect(root(page)).toContainText('A score for every wine type, region, grape and skill');
  await page.reload();

  await root(page).getByText('Four pairing rules that actually work', { exact: true }).click();
  await expect(root(page)).toContainText('Wine Skills · Food pairing');
  // The line from their own wines.
  await expect(root(page)).toContainText('Your top-scored red, Gran Reserva 904 (95): try it with steak, lamb or a hard cheese.');
  await root(page).getByText('Answer the questions', { exact: true }).click();
  await passGuide(page, 'pair_rules');
  await root(page).getByText('Back to Learn', { exact: true }).click();

  await page.evaluate(() => localStorage.setItem('vinterest_pro', '1'));
  await page.goto(`${BASE}/#mastery-map`);
  await expect(root(page)).toContainText('Your Mastery');
  await expect(root(page)).toContainText('Wine Skills');
  const pairing = await page.evaluate(() => KnowledgeMap.compute().areas.find((a) => a.id === 'skill_pairing'));
  expect(pairing.detail).toContain('3/9 questions');
  expect(pairing.score).toBeGreaterThan(0);
  await expect(root(page)).toContainText(`Food pairing`);
  expect(errors).toEqual([]);
});
