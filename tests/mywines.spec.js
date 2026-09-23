// My Wines: compact rows, search, type and status filters, sort menu, month groups, a summary in
// the user's currency, swipe for Edit/Delete (with Undo), and "Score it" for unscored bottles.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';

async function setup(context, page) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#home`);
  await page.evaluate(() => {
    const all = WineHistory.getAll();
    all.unshift({ name: 'Saved Test Chablis', producer: 'Test', type: 'white', region: 'Chablis', country: 'France', vintage: 2022, rating: 0, scan_intent: 'checking', times_consumed: 1, scanned_at: '2026-06-14T10:00:00Z', last_scanned: '2026-06-14T10:00:00Z' });
    all.unshift({ name: 'Unscored Test Rioja', producer: 'Test', type: 'red', region: 'Rioja', country: 'Spain', vintage: 0, rating: 0, scan_intent: 'tasted', times_consumed: 1, scanned_at: '2026-05-02T10:00:00Z', last_scanned: '2026-05-02T10:00:00Z' });
    WineHistory.save(all);
  });
  await page.goto(`${BASE}/?demo=1#mywines`);
}
const rowNames = (page) => page.locator('#root .mw-row').evaluateAll((els) => els.map((e) => e.querySelector('div[style*="font-weight: 600"]').textContent));

test('search, filters, sort and grouping', async ({ context, page }) => {
  const errors = collectErrors(page);
  await setup(context, page);
  const root = page.locator('#root');
  await expect(root).toContainText('24 bottles');
  // The summary's price is in the user's currency (the demo is UK), not a bare dollar figure.
  await expect(root).toContainText(/about £\d+ a bottle/);
  await expect(root).toContainText('June 2026');
  await expect(root).toContainText('May 2026');
  await root.getByText(/^Whites \d+$/).click();
  expect(await rowNames(page)).toEqual(expect.arrayContaining(['Saved Test Chablis']));
  await root.getByText(/^Whites \d+$/).click();
  await root.getByText(/^Saved for later \d+$/).click();
  expect(await rowNames(page)).toEqual(['Saved Test Chablis']);
  await root.getByText(/^Saved for later \d+$/).click();
  await root.getByText(/^Unscored \d+$/).click();
  expect(await rowNames(page)).toEqual(['Unscored Test Rioja']);
  await expect(root.getByRole('button', { name: 'Score it' })).toBeVisible();
  // NV shows as NV, not 0.
  await expect(root).toContainText('Rioja · NV');
  await root.getByText(/^Unscored \d+$/).click();
  await page.getByLabel('Search your wines').fill('rioja reserva');
  const names = await rowNames(page);
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => /reserva/i.test(n))).toBe(true);
  await page.getByLabel('Search your wines').fill('zzzz');
  await expect(root).toContainText('No wines match');
  await root.getByText('Clear filters').click();
  await page.getByLabel('Sort').click();
  await root.getByText('Top scored').click();
  const ratings = await page.locator('#root .mw-row').evaluateAll((els) => els.map((e) => Number((e.innerText.match(/(\d+)\s*$/) || [])[1] || 0)));
  expect(ratings.slice(0, -2)).toEqual([...ratings.slice(0, -2)].sort((a, b) => b - a));
  expect(errors).toEqual([]);
});

test('Score it opens the rating; a row opens the wine', async ({ context, page }) => {
  await setup(context, page);
  const root = page.locator('#root');
  await root.getByRole('button', { name: 'Score it' }).first().click();
  await expect(root).toContainText('How was it?');
  await page.goto(`${BASE}/?demo=1#mywines`);
  await root.getByText('Saved Test Chablis').click();
  await expect(root).toContainText('Taste Profile');
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 400, height: 860 } });
  test('swipe left to delete (with Undo) or edit', async ({ context, page }) => {
    await setup(context, page);
    const root = page.locator('#root');
    const cdp = await context.newCDPSession(page);
    const swipe = async (text) => {
      await root.getByText(text).scrollIntoViewIfNeeded();
      const b = await root.getByText(text).boundingBox();
      const y = b.y + b.height / 2;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 300, y }] });
      for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 300 - 110 * i / 8, y }] }); await page.waitForTimeout(25); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(300);
    };
    await swipe('Saved Test Chablis');
    await root.locator('.mw-row', { hasText: 'Saved Test Chablis' }).getByRole('button', { name: 'Delete' }).click();
    await expect(root).toContainText('Deleted Saved Test Chablis');
    expect(await page.evaluate(() => WineHistory.getAll().some((w) => w.name === 'Saved Test Chablis'))).toBe(false);
    await root.getByText('Undo').click();
    await expect(root.getByText('Saved Test Chablis')).toBeVisible();
    await swipe('Saved Test Chablis');
    await root.locator('.mw-row', { hasText: 'Saved Test Chablis' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Wine name').fill('Renamed Test Chablis');
    await page.getByText('Save', { exact: true }).click();
    await expect(root.getByText('Renamed Test Chablis')).toBeVisible();
  });
});
