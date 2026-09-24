// Text size (Profile and Settings): Standard, Large (+10%) or Extra large (+20%), and no text
// smaller than 13px. Only text scales; fixed graphics (the score ring, the XP badge) don't.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage, collectErrors } = require('./helpers');

const BASE = 'http://localhost:4173';
const root = (page) => page.locator('#root');

test('choosing a size scales text everywhere, straight away; the floor is 13px', async ({ context, page }) => {
  const errors = collectErrors(page);
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1' });
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1#account`);
  const title = root(page).getByText('Text size', { exact: true });
  await expect(title).toHaveCSS('font-size', '16px');
  // Nothing on the page is under 13px (string-px graphics aside).
  const smallest = async () => page.evaluate(() => Math.min(...[...document.querySelectorAll('#root *')]
    .filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => parseFloat(getComputedStyle(e).fontSize))));
  expect(await smallest()).toBeGreaterThanOrEqual(13);

  await root(page).getByRole('radio', { name: /Extra large/ }).click();
  await expect(title).toHaveCSS('font-size', '19px'); // 16 × 1.2, to the half pixel
  await root(page).getByRole('radio', { name: /Large/ }).first().click();
  await expect(title).toHaveCSS('font-size', '17.5px');
  expect(await page.evaluate(() => localStorage.getItem('vinterest_text_size'))).toBe('large');

  // It sticks, and the XP badge beside the logo stays its size.
  await page.goto(`${BASE}/?demo=1#home`);
  await expect(root(page).getByText('1805 XP', { exact: true })).toHaveCSS('font-size', '15px');
  expect(errors).toEqual([]);
});

test('at Extra large nothing on the main screens runs off the side', async ({ context, page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_wineDNA_unlock_seen: '1', vinterest_text_size: 'xl' });
  await stubNetwork(context);
  for (const s of ['home', 'learn', 'profile', 'mywines', 'account']) {
    await page.goto(`${BASE}/?demo=1#${s}`);
    await expect(root(page)).not.toBeEmpty();
    const bad = await page.evaluate(() => {
      const W = document.documentElement.clientWidth;
      // Rows that scroll sideways on purpose (chip rows) are skipped.
      const inScroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
      return [...document.querySelectorAll('#root *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !inScroller(e); }).length;
    });
    expect(bad, `#${s}`).toBe(0);
  }
});
