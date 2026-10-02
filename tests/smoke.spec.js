// Smoke test for the built site in dist/: it boots without console errors, reads its static
// data without network requests, and the Home, Learn and Wine DNA screens render.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const pkg = require('../package.json');

test.beforeEach(async ({ context, page }) => {
  await stubNetwork(context);
  await makeDeterministic(page);
});

function trackStaticDataRequests(page) {
  const hits = [];
  page.on('request', (req) => {
    const { pathname } = new URL(req.url());
    if (pathname.startsWith('/data/') || pathname.startsWith('/prompts/')) hits.push(pathname);
  });
  return hits;
}

const tab = (page, label) => page.locator('#root').getByText(label, { exact: true }).last();

test('Home, Learn and Wine DNA render with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  const dataRequests = trackStaticDataRequests(page);
  // Skip the one-off WineDNA unlock celebration so Learn shows its hub (covered separately below).
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });

  await page.goto(`${BASE}/?demo=1`);
  const root = page.locator('#root');
  await expect(root).toContainText('Recently scanned');
  await expect(root).toContainText('Châteauneuf-du-Pape Jean XXII');

  await tab(page, 'Learn').click();
  await expect(root).toContainText('Grape quizzes');
  await expect(root).toContainText('Wine Basics');
  await expect(root).not.toContainText("Something didn't load right");

  await tab(page, 'WineDNA').click();
  await expect(root).toContainText('Your WineDNA');
  await expect(root).toContainText('Data Backup');
  await expect(root).toContainText(`Vinterest v${pkg.version}`);

  await tab(page, 'Home').click();
  await expect(root).toContainText('Recently scanned');

  expect(errors).toEqual([]);
  expect(dataRequests, 'data/*.json and prompts/*.txt should be inlined, not fetched').toEqual([]);
});

// "Explore Next is ready for your reds" replaced "WineDNA unlocked" (a coverage gate that no longer
// exists): shown once in WineDNA, the first time a type reaches ExploreNext.READY_AT wines.
const RED = (n) => ({ name: `Ready Test Red ${n}`, producer: 'Test', type: 'red', region: 'Rioja', country: 'Spain', vintage: 2019, rating: 90 + n, grapes: ['Tempranillo'], body: 0.7, tannins: 0.6, acidity: 0.55, sweetness: 0.05, scanned_at: `2026-06-0${n}T10:00:00Z` });
test('Explore Next is ready: shown once when the third red arrives, then opens the picks', async ({ page }) => {
  const errors = collectErrors(page);
  await page.addInitScript((w) => { if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1'); localStorage.setItem('vinterest_onboarded', '1'); localStorage.setItem('vinterest_age_ok', '1'); localStorage.setItem('vinterest_wines', JSON.stringify(w)); }, [RED(1), RED(2)]);
  await page.goto(`${BASE}/#home`);
  const root = page.locator('#root');
  await expect(root).toContainText('Recently scanned');
  expect(await page.evaluate(() => Flags.exploreReadySeen())).toEqual([]);
  await page.evaluate((w) => WineHistory.save([...WineHistory.getAll(), w]), RED(3));
  await page.goto(`${BASE}/?a=1#profile`);
  await expect(root).toContainText('Explore Next is ready for your reds.');
  await expect(root).toContainText('3 reds scanned');
  await root.getByRole('button', { name: 'See my picks' }).click();
  await expect(root.locator('[data-section="explore"]')).toBeVisible();
  await page.goto(`${BASE}/?b=1#profile`);
  await expect(root).not.toContainText('Explore Next is ready');
  expect(await page.evaluate(() => Flags.exploreReadySeen())).toEqual(['red']);
  expect(errors).toEqual([]);
});

test('types already open when the app first looks are never celebrated (existing users)', async ({ page }) => {
  await page.goto(`${BASE}/?demo=1#profile`);
  const root = page.locator('#root');
  await expect(root).toContainText('WineDNA');
  await expect(root).not.toContainText('Explore Next is ready');
  await expect(root).not.toContainText('WineDNA unlocked');
  expect(await page.evaluate(() => Flags.exploreReadySeen())).toContain('red');
});

test('a first-time visitor lands on onboarding with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/`);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('#root')).not.toContainText('Recently scanned');
  expect(errors).toEqual([]);
});

test('dist ships the PWA and worker files', async ({ request }) => {
  for (const file of ['/manifest.json', '/sw.js', '/_worker.js', '/icons/icon-192.png', '/logo.png', '/tweaks-inline.compiled.js']) {
    expect((await request.get(`${BASE}${file}`)).status(), file).toBe(200);
  }
  const html = await (await request.get(`${BASE}/`)).text();
  expect(html).not.toContain('unpkg.com');
  expect(html).toMatch(/<script src="app\.js\?v=[0-9a-f]{10}"><\/script>/);
});

test('the XP badge on Home opens the achievements overlay with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.locator('#root').getByText('1805 XP', { exact: true }).click();
  await expect(page.locator('#root')).toContainText('Achievements');
  expect(errors).toEqual([]);
});
