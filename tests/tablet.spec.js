// iPad layouts, portrait and landscape: screens put their sections side by side instead of one
// long phone column (useWide / WideColumns in pwa-components.jsx), nothing runs off the side, and
// each screen is kept as a screenshot (test-results/…/tablet-*.png) to look at.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const SIZES = { portrait: { width: 820, height: 1180 }, landscape: { width: 1180, height: 820 } };

async function open(context, page, hash, seed = {}) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_explore_ready_seen: JSON.stringify(['red', 'white', 'rose', 'sparkling']), ...seed });
  await stubNetwork(context, { claudeText: () => '' });
  await context.route('**/shop-match', (r) => r.fulfill({ contentType: 'application/json', body: '{"items":[]}' }));
  await context.route('**/lcbo', (r) => r.fulfill({ contentType: 'application/json', body: '{"enabled":false}' }));
  await page.goto(`${BASE}/?demo=1#${hash}`);
}
const noOverflow = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const clipped = (el) => { for (let p = el.parentElement; p && p.id !== 'root'; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
  return [...document.querySelectorAll('#root *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && !clipped(el); }).map((el) => el.tagName + ' ' + (el.textContent || '').slice(0, 30));
});

for (const [name, viewport] of Object.entries(SIZES)) {
  test.describe(`iPad ${name}`, () => {
    test.use({ viewport });

    test(`WineDNA pairs its sections, and the surprises use the width (${name})`, async ({ context, page }, info) => {
      const errors = collectErrors(page);
      await open(context, page, 'profile');
      const root = page.locator('#root');
      await expect(root).toContainText('How Well We Know You');
      expect(await page.locator('[data-wide-columns]').count()).toBeGreaterThanOrEqual(2);
      // The script and the history side by side.
      const box = (sec) => page.locator(`[data-section="${sec}"]`).boundingBox();
      const [sc, hi] = [await box('scripts'), await box('history')];
      const pos = sc && hi ? [sc.x, hi.x, Math.abs(sc.y - hi.y)] : null;
      expect(pos, 'Scripts and Your History headers').not.toBeNull();
      expect(pos[1]).toBeGreaterThan(pos[0] + 200);
      expect(pos[2]).toBeLessThan(40);
      // How Well We Know You: the surprises beside the summary.
      const knows = page.getByTestId('knows');
      if (await page.getByTestId('knows-above').count()) {
        const [a, b] = await Promise.all([knows.locator('svg').first().boundingBox(), page.getByTestId('knows-above').boundingBox()]);
        expect(b.x).toBeGreaterThan(a.x + 200);
      }
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-winedna-${name}.png`), fullPage: false });
      await knows.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-winedna-knows-${name}.png`), fullPage: false });
      expect(errors).toEqual([]);
    });

    test(`Home, Learn and Mastery use the width; the wine screen keeps where to buy beside it (${name})`, async ({ context, page }, info) => {
      const errors = collectErrors(page);
      await open(context, page, 'home', { vinterest_pro: '1' });
      const root = page.locator('#root');
      await expect(root).toContainText('Recently scanned');
      expect(await page.locator('[data-wide-columns]').count()).toBeGreaterThanOrEqual(1);
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-home-${name}.png`) });

      await page.goto(`${BASE}/?demo=1#learn`);
      await expect(root).toContainText('Wine Basics');
      // Wine Basics topics two to a row.
      const tops = await page.evaluate(() => [...document.querySelectorAll('#root div')].filter((d) => getComputedStyle(d).display === 'grid' && getComputedStyle(d).gridTemplateColumns.split(' ').length === 2).length);
      expect(tops).toBeGreaterThanOrEqual(1);
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-learn-${name}.png`) });

      await page.goto(`${BASE}/?demo=1#mastery-map`);
      await expect(root).toContainText('Your Mastery');
      const [shape, grapes] = [await page.locator('[data-section="shape"]').boundingBox(), await page.locator('[data-section="grapes"]').boundingBox()];
      expect(Math.abs(shape.y - grapes.y)).toBeLessThan(5);
      expect(grapes.x).toBeGreaterThan(shape.x + 200);
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-mastery-${name}.png`) });

      // A wine: on its side, Price and where to buy beside Details; upright, the three tabs.
      await page.evaluate(() => { const w = WineHistory.getAll().find((x) => x.rating > 0); Handoff.openWine({ demo: false, wine: w, existingRating: w.rating }); });
      await page.goto(`${BASE}/?demo=1#detail`);
      await expect(root).toContainText('Details');
      if (name === 'landscape') {
        await expect(page.getByTestId('detail-price-pane')).toBeVisible();
        await expect(root.getByText('Price', { exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByTestId('detail-price-pane')).toHaveCount(0);
        await expect(root.getByText('Price', { exact: true })).toBeVisible();
      }
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-detail-${name}.png`) });
      expect(errors).toEqual([]);
    });

    test(`reading screens: a centred column, with context beside it on its side (${name})`, async ({ context, page }, info) => {
      const errors = collectErrors(page);
      await open(context, page, 'home');
      const root = page.locator('#root');
      // A beginner article: the series beside (on its side) or below (upright) the text.
      await page.evaluate(() => Handoff.onRampIdx.set('1'));
      await page.goto(`${BASE}/?demo=1#article`);
      await expect(page.getByTestId('aside-series')).toBeVisible();
      const text = await root.locator('[data-reading]').boundingBox();
      expect(text.width).toBeLessThanOrEqual(name === 'landscape' ? 1110 : 761);
      if (name === 'landscape') {
        const [col, side] = [await root.locator('[data-reading] > div').first().boundingBox(), await root.locator('[data-reading-aside]').boundingBox()];
        expect(side.x).toBeGreaterThan(col.x + col.width - 1);
      }
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-article-${name}.png`) });

      // A guide: the For you line and the questions beside the sections.
      await page.evaluate(() => Handoff.guide.set(Guides.all()[0].id));
      await page.goto(`${BASE}/?demo=1#guide`);
      await expect(root).toContainText('Answer the questions');
      await expect(root.getByText('Answer the questions', { exact: true })).toHaveCount(1);
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-guide-${name}.png`) });

      // A quiz: the question in a centred column.
      await page.evaluate(() => Handoff.quiz.set({ mode: 'practice', topicId: 'red_grapes' }));
      await page.goto(`${BASE}/?demo=1#quiz`);
      const opt = root.locator('[style*="padding: 15px 16px"]').first();
      await expect(opt).toBeVisible();
      const ob = await opt.boundingBox();
      expect(ob.width).toBeLessThanOrEqual(722);
      expect(await noOverflow(page)).toEqual([]);
      await page.screenshot({ path: path.join(info.project.outputDir, `tablet-quiz-${name}.png`) });
      expect(errors).toEqual([]);
    });
  });
}
