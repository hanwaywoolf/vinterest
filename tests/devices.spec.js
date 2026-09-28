// Every main screen on this project's device (Pixel locally; iPhone SE, iPhone 15 Pro Max and
// iPad Pro 11 on WebKit, Safari's engine, in CI: .github/workflows/webkit.yml). Each screen must
// render without console errors, never scroll sideways, keep the bottom navigation on screen, and
// leave a screenshot in test-results/screens/<project>/ to look through.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const SCREENS = [
  ['home', 'Recently scanned'],
  ['mywines', 'My Wines'],
  ['learn', 'Wine Basics'],
  ['profile', 'WineDNA'],
  ['account', 'Where You Buy Wine'],
  ['scan', 'Scan'],
];

for (const size of ['standard', 'xl']) {
  for (const [hash, expectText] of SCREENS) {
    test(`${hash} fits the screen at ${size} text`, async ({ context, page }, info) => {
      const errors = collectErrors(page);
      await makeDeterministic(page);
      await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_text_size: size });
      await stubNetwork(context);
      await page.goto(`${BASE}/?demo=1#${hash}`);
      const root = page.locator('#root');
      await expect(root).toContainText(expectText);
      await page.waitForTimeout(400);
      // The app's own typeface, not a fallback (fonts ship in dist/fonts; nothing comes from Google).
      expect(await page.evaluate(async () => { await document.fonts.ready; return ['400', '600', '700'].every((w) => document.fonts.check(`${w} 16px Poppins`)) && [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Poppins' && f.status === 'loaded'); }), 'Poppins loaded').toBe(true);
      await page.screenshot({ path: path.join(info.project.outputDir, 'screens', info.project.name, `${hash}-${size}.png`) });
      // The app fills the screen to its bottom edge (a measured height left a white strip under
      // the nav on iPhone home-screen apps).
      const fill = await page.evaluate(() => { const r = document.getElementById('root'), app = r.firstElementChild;
        return { root: r.getBoundingClientRect().bottom, app: app.getBoundingClientRect().bottom, vh: document.documentElement.clientHeight }; });
      expect(Math.abs(fill.root - fill.vh), 'app root reaches the bottom edge').toBeLessThan(1);
      expect(Math.abs(fill.app - fill.vh), 'app reaches the bottom edge').toBeLessThan(1);
      // Nothing wider than the screen (a sideways scroll is the classic Safari break).
      const wide = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        // Inside a row built to scroll or clip sideways (chip rows, the swipe deck) is fine.
        const clipped = (el) => { for (let p = el.parentElement; p && p.id !== 'root'; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
        return [...document.querySelectorAll('#root *')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el);
        }).slice(0, 3).map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 40)}"`);
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
      expect.soft(wide, 'elements running off the right edge').toEqual([]);
      // The bottom navigation is on screen.
      if (hash !== 'scan') {
        const nav = await root.getByText('WineDNA', { exact: true }).last().boundingBox();
        expect(nav && nav.y + nav.height).toBeLessThanOrEqual(page.viewportSize().height + 1);
        // Each tab label on one line (a wrapped "My Wines" pushes the whole bar up).
        for (const label of ['Home', 'My Wines', 'Scan', 'Learn', 'WineDNA']) {
          const box = await root.getByText(label, { exact: true }).last().boundingBox();
          expect(box.height, `"${label}" tab label wraps`).toBeLessThan(26);
        }
      }
      expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    });
  }
}

// Safari paints the strip behind the home indicator with the page background, so the page
// background follows whatever is at the bottom of the screen (a dark screen must not get a white bar).
test('the page background matches the bottom of the screen: dark on the welcome screen, light under the nav', async ({ context, page }) => {
  await makeDeterministic(page);
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`); // first visit: onboarding opens on the dark welcome screen
  await expect(page.locator('#root')).toContainText('Wine that fits you');
  const dark = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 500)); return getComputedStyle(document.body).backgroundColor; });
  const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (r + g + b) / 3; };
  expect(lum(dark), `welcome page background ${dark}`).toBeLessThan(80);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/?demo=1#home`);
  await expect(page.locator('#root')).toContainText('Recently scanned');
  const light = await page.evaluate(async () => { await new Promise((r) => setTimeout(r, 500)); return getComputedStyle(document.body).backgroundColor; });
  expect(lum(light), `home page background ${light}`).toBeGreaterThan(200);
});

// Installed on an iPhone, a see-through status bar ("black-translucent") left the bottom 59pt of
// the screen outside the app; extending the app to cover it only got it clipped. The status bar
// style stays "default", and nothing stretches the app past the window iOS gives it.
test('the iPhone status bar style is "default", and the app is never stretched past its window', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/?demo=1#home`);
  await expect(page.locator('#root')).toContainText('Recently scanned');
  const out = await page.evaluate(() => ({ style: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content,
    below: Math.round(document.getElementById('root').getBoundingClientRect().bottom - window.innerHeight) }));
  expect(out).toEqual({ style: 'default', below: 0 });
});

test('#root is pinned to the screen (position fixed), not flowed into the page', async ({ context, page }) => {
  await stubNetwork(context);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk' });
  await page.goto(`${BASE}/?demo=1#home`);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('root')).position)).toBe('fixed');
});
