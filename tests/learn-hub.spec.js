// The Learn tab stays short: a row of section chips, three or four items per section with
// "Show N more", Wine Basics in type order, and read articles moved into a collapsed library.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const stub = (i) => ({ id: 's' + i, archetypeId: 'fixture', iconName: 'book', readTime: '3 min', title: `Piece number ${i}`, subtitle: 'sub', slots: {} });

test('sections are short, basics follow the wine types, read pieces go to the library', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk',
    vinterest_prefs: JSON.stringify({ types: ['red'], budget: 'mid', experience: 'expert' }),
    vinterest_gen_stubs: JSON.stringify([1, 2, 3, 4, 5, 6].map(stub)),
    vinterest_gen_article_s1_done: '1', vinterest_gen_article_s2_done: '1' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#learn`);
  const root = page.locator('#root');

  // Every section is one tap away.
  for (const chip of ['For you', 'Basics', 'Grapes', 'Skills', 'Mastery']) await expect(root.getByRole('button', { name: new RegExp('^' + chip) })).toBeVisible();

  // Four unread: three shown, then "Show 1 more to read". Two read: in the closed library.
  await expect(root).toContainText('Piece number 3');
  await expect(root).not.toContainText('Piece number 6');
  await expect(root).not.toContainText('Piece number 1');
  await root.getByText('Show 1 more to read').click();
  await expect(root).toContainText('Piece number 6');
  await root.getByText('Your library · 2 read').click();
  await expect(root).toContainText('Piece number 1');

  // Wine Basics: the type topics first, four at a time.
  const labels = await page.evaluate(() => QUIZ_TOPICS.map((t) => t.label));
  expect(labels.slice(0, 6)).toEqual(['Red Grapes', 'White Grapes', 'Rosé', 'Sparkling', 'Orange Wine', 'Sweet & Fortified']);
  await expect(root.getByText('Rosé', { exact: true })).toBeVisible();
  await expect(root.getByText('Orange Wine', { exact: true })).toHaveCount(0);
  await root.getByText('Show 5 more topics').click();
  await expect(root.getByText('Food & Wine', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('region quizzes show their country\'s flag', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const flags = await page.evaluate(() => ({ rioja: Regions.flag('Rioja'), napa: Regions.flag('Napa Valley'), mendoza: Regions.flag('Mendoza'), none: Regions.flag('Nowhere'),
    missing: Object.keys(KNOWLEDGE.regions).filter((r) => !Regions.flag(r)) }));
  expect(flags).toEqual({ rioja: '🇪🇸', napa: '🇺🇸', mendoza: '🇦🇷', none: '', missing: [] });
  await page.evaluate(() => localStorage.setItem('vinterest_wineDNA_unlock_seen', '1'));
  await page.reload();
  await expect(page.locator('#root').getByRole('img', { name: 'Spain' }).first()).toBeVisible();
});
