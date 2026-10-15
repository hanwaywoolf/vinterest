// Installing to the home screen. Chrome's own check must find nothing wrong with the build (a
// missing icon, a bad manifest or a broken service worker silently removes "Add to home screen").
// Profile no longer offers the install: beta testers use the native apps.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const DIST = path.join(__dirname, '..', 'dist');

async function open(context, page, hash) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk' });
  await stubNetwork(context);
  await page.goto(`${BASE}/${hash}`);
}

test.describe('installability', () => {
  // The other tests block service workers so network stubs see every fetch; this one needs it running.
  test.use({ serviceWorkers: 'allow' });
  test('Chrome finds the built app installable: valid manifest, icons, service worker', async ({ context, page }) => {
  await open(context, page, '#home');
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), { timeout: 10000 }).toBe(true);
  const cdp = await context.newCDPSession(page);
  expect((await cdp.send('Page.getAppManifest')).errors).toEqual([]);
  expect((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors).toEqual([]);
  // The early catch of Chrome's install offer survives the build, and the manifest can report its own install.
  expect(fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')).toContain('__vinterestInstallEvent');
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'manifest.json'), 'utf8'));
  expect(manifest.related_applications).toEqual([{ platform: 'webapp', url: 'https://vinterest.app/manifest.json' }]);
  for (const icon of manifest.icons) expect(fs.existsSync(path.join(DIST, icon.src))).toBe(true);
});
});

test('opened from the home screen, the install card is gone', async ({ context, page }) => {
  await page.addInitScript(() => { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (q.includes('standalone') ? { matches: true, addEventListener() {}, removeEventListener() {} } : mm(q)); });
  await open(context, page, '#account');
  await expect(page.locator('#root')).toContainText('Travel Mode');
  await expect(page.locator('#root')).not.toContainText('Put Vinterest on your home screen');
});
