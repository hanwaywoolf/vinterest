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
  // Wine detail: from the wine's own country, else the region it's filed under.
  const wine = await page.evaluate(() => [Regions.wineFlag({ country: 'England' }), Regions.wineFlag({ region: 'Rioja Alta' }), Regions.wineFlag({ country: 'Atlantis' })]);
  expect(wine).toEqual(['🇬🇧', '🇪🇸', '']);
  await page.evaluate(() => localStorage.setItem('vinterest_wineDNA_unlock_seen', '1'));
  await page.reload();
  await expect(page.locator('#root').getByRole('img', { name: 'Spain' }).first()).toBeVisible();
});

// Mastery is one tap from the top of Learn: the overall % in a ring and where to start.
test('the top of Learn links to Mastery', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_pro: '1' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#learn`);
  const link = page.getByTestId('learn-mastery-link');
  await expect(link).toBeInViewport();
  const overall = await page.evaluate(() => KnowledgeMap.summary().overall);
  await expect(link).toContainText(`${overall}%`);
  await expect(link).toContainText('Your Mastery');
  await link.click();
  await expect(page.locator('#root')).toContainText('Your wine knowledge');
  expect(errors).toEqual([]);
});

test('the library also lists the beginner articles they have read, and opens them', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk',
    vinterest_gen_stubs: JSON.stringify([1, 2].map(stub)), vinterest_gen_article_s1_done: '1',
    vinterest_onramp_1_done: '1', vinterest_onramp_2_done: '1' });
  await stubNetwork(context);
  await page.goto(`${BASE}/#learn`);
  const root = page.locator('#root');
  const [first, second] = await page.evaluate(() => ON_RAMP.slice(0, 2).map((a) => a.title));
  await root.getByText('Your library · 3 read').click();
  const basics = root.getByTestId('library-basics');
  await expect(basics).toContainText(first);
  await expect(basics).toContainText(second);
  await basics.getByText(second, { exact: true }).click();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#article');
  await expect(root).toContainText(second);
});

// The article's "Next read" went nowhere: it asked the app for the screen it was already on, which
// did nothing, and the article reads which one to show only when it opens.
test('"Next read" opens the next beginner article', async ({ context, page }) => {
  await stubNetwork(context);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/#home`);
  await page.evaluate(() => Handoff.onRampIdx.set('0'));
  await page.goto(`${BASE}/#article`);
  const root = page.locator('#root');
  const [t0, t1] = await page.evaluate(() => [ON_RAMP[0].title, ON_RAMP[1].title]);
  await expect(root).toContainText(t0);
  await root.getByText('Mark as Read', { exact: false }).first().click();
  await expect(root).toContainText('Nice work!');
  await root.getByText('Next read', { exact: true }).click();
  await expect(root).toContainText(t1);
  await expect(root).not.toContainText('Nice work!'); // a fresh article, not the finished one
  await expect(root).not.toContainText(t0);
});

// Mastery's "Start here" step opens something for every wine type: a grape quiz or an article,
// never a tap that lands back on Learn.
test('a Mastery step to finish grape quizzes or read more targets a grape or an article', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const out = await page.evaluate(() => {
    const m = KnowledgeMap.compute(WineHistory.getAll());
    return m.areas.filter((a) => a.next && /grape quizzes|Read more/.test(a.next.label)).map((a) => ({ label: a.next.label, ok: !!(a.next.grape || a.next.article) || a.next.nav === 'learn' }));
  });
  for (const o of out) expect(o.ok).toBe(true);
});

// A guide's "Try it" goes where it says: the palate to Mastery's palate section, the script and
// value to those WineDNA sections, never just the top of WineDNA.
test('guide Try it links open the section they name', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#learn`);
  const out = await page.evaluate(() => {
    const go = [];
    const nav = (s) => go.push(s);
    const palate = Guides.all ? null : null;
    const tries = (typeof GUIDES !== 'undefined' ? GUIDES : []).map((g) => g.tryIt).filter(Boolean);
    Guides.openTry({ label: 'x', nav: 'mastery-map', section: 'palate' }, nav, null);
    const section = Handoff.masterySection.take();
    Guides.openTry({ label: 'x', nav: 'dna', dna: 'scripts' }, nav, null);
    return { go, section, dna: UserPrefs.takeDNASection(), profileLeft: tries.filter((t) => t.nav === 'profile').length };
  });
  expect(out.go).toEqual(['mastery-map', 'profile']);
  expect(out.section).toBe('palate');
  expect(out.dna).toBe('scripts');
});
