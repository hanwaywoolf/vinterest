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
  await expect(root).toContainText('Recently Scanned');
  await expect(root).toContainText('Châteauneuf-du-Pape Jean XXII');

  await tab(page, 'Learn').click();
  await expect(root).toContainText('Test Yourself');
  await expect(root).toContainText('Wine Basics');
  await expect(root).not.toContainText("Something didn't load right");

  await tab(page, 'WineDNA').click();
  await expect(root).toContainText('Your WineDNA');
  await expect(root).toContainText('Data Backup');
  await expect(root).toContainText(`Vinterest v${pkg.version}`);

  await tab(page, 'Home').click();
  await expect(root).toContainText('Recently Scanned');

  expect(errors).toEqual([]);
  expect(dataRequests, 'data/*.json and prompts/*.txt should be inlined, not fetched').toEqual([]);
});

test('Learn shows the WineDNA unlock celebration on first visit after unlocking', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/?demo=1#learn`);
  await expect(page.locator('#root')).toContainText('WineDNA unlocked');
  await expect(page.locator('#root')).not.toContainText("Something didn't load right");
  expect(await page.evaluate(() => localStorage.getItem('vinterest_wineDNA_unlock_seen'))).toBe('1');
  expect(errors).toEqual([]);
});

test('a first-time visitor lands on onboarding with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(`${BASE}/`);
  await expect(page.locator('#root')).not.toBeEmpty();
  await expect(page.locator('#root')).not.toContainText('Recently Scanned');
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
