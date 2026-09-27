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
      await page.screenshot({ path: path.join(info.project.outputDir, 'screens', info.project.name, `${hash}-${size}.png`) });
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
      }
      expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
    });
  }
}
