// Screens that were cut off on a phone at Large text: everything on them must be reachable by
// scrolling the way a thumb does (the wheel over the screen), on a small phone at Extra large text.
const { test, expect } = require('@playwright/test');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';

test.use({ viewport: { width: 360, height: 640 } });

// Scrolls like a finger can: only containers the page lets scroll (overflow auto or scroll),
// never ones set to clip, which a script could scroll but a person can't. (The mouse wheel
// isn't available in mobile WebKit, so this works the same on every engine.)
async function swipeTo(page, loc) {
  for (let i = 0; i < 25 && !(await loc.isVisible() && await inView(page, loc)); i++) {
    const moved = await loc.evaluate((el) => {
      for (let p = el.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowY;
        if (/(auto|scroll)/.test(o) && p.scrollHeight > p.clientHeight && p.scrollTop + p.clientHeight < p.scrollHeight - 1) { p.scrollTop += 250; return true; }
      }
      const doc = document.scrollingElement;
      if (getComputedStyle(document.body).overflowY !== 'hidden' && doc.scrollTop + innerHeight < doc.scrollHeight - 1) { doc.scrollTop += 250; return true; }
      return false;
    });
    if (!moved) return;
    await page.waitForTimeout(50);
  }
}
async function inView(page, loc) {
  const b = await loc.boundingBox(); if (!b) return false;
  return b.y >= 0 && b.y + b.height <= 640;
}

async function open(context, page, hash) {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_text_size: 'xl' });
  await stubNetwork(context);
  await page.goto(`${BASE}/?demo=1${hash}`);
}

test('Profile scrolls all the way down, and #settings (merged into it) opens it', async ({ context, page }) => {
  await open(context, page, '#settings');
  const root = page.locator('#root');
  await expect(root).toContainText('Where You Buy Wine');
  const log = root.getByText('View error log');
  await swipeTo(page, log);
  expect(await inView(page, log)).toBe(true);
  // One place sets where they buy: region and currency move with the country.
  expect(await page.evaluate(() => { UserPrefs.setLocation({ country: 'New Zealand' }); return [Settings.region(), Settings.currency()]; })).toEqual(['nz', 'NZD']);
});

test('the Pro sheet fits the screen, or scrolls, down to "Maybe later"', async ({ context, page }) => {
  await open(context, page, '#home');
  const card = page.locator('#root').getByText(/Wine knowledge \d+%/);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const later = page.locator('#root').getByText('Maybe later');
  await page.waitForTimeout(400); // the sheet slides up
  await swipeTo(page, later);
  expect(await inView(page, later)).toBe(true);
  // The card's own bottom edge is on screen, with a gap under it: it doesn't run off the bottom.
  const sheet = await page.locator('[data-sheet=pro]').boundingBox();
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(640 - 8);
  expect(sheet.y).toBeGreaterThanOrEqual(0);
  const box = await page.locator('#root').getByText('Your Mastery', { exact: true }).boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);
});
