// The Vinterest Teams website (site/teams/, built by scripts/site-teams.mjs into site-teams-dist/,
// served on :4176): every page renders without errors or sideways scroll at phone, tablet and desktop
// widths, the nav links to real pages and marks the one it's on, and the calculator answers.
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:4176';
const PAGES = ['/', '/restaurants', '/groups', '/wineries', '/pricing'];

for (const width of [390, 1024, 1440]) {
  test(`every page renders cleanly at ${width}px`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const p of PAGES) {
      const res = await page.goto(BASE + p);
      expect(res.status(), p).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('footer')).toBeVisible();
      await expect(page.locator('#testForm')).toHaveCount(1);
      // No template token left unfilled, no sideways scroll.
      expect(await page.content(), p).not.toContain('%%');
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), p).toBeLessThanOrEqual(0);
    }
    expect(errors).toEqual([]);
    await page.close();
  });
}

test('the nav goes to each page and marks the one it is on', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/');
  for (const name of ['Restaurants', 'Groups', 'Wineries', 'Pricing']) {
    await page.locator('header nav a', { hasText: name }).click();
    await expect(page).toHaveURL(new RegExp(`/${name.toLowerCase()}$`));
    await expect(page.locator('header nav a[aria-current="page"]')).toHaveText(name);
  }
  // Every in-site link leads somewhere that exists.
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href').split('#')[0]));
  for (const h of new Set(hrefs)) expect((await page.request.get(BASE + h)).status(), h).toBe(200);
  await page.close();
});

test('the calculator follows the inputs', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE + '/');
  const five = page.locator('[data-sc="5"]');
  const before = await five.textContent();
  await page.locator('[data-in="covers"]').fill('300');
  await expect(five).not.toHaveText(before);
  // 300 covers × (0.5 × £9 + 0.1 × £42) × 6 nights × 52 weeks × 5%
  await expect(five).toHaveText('£40,716');
  await page.close();
});

test('the sitemap lists every page', async ({ request }) => {
  const xml = await (await request.get(BASE + '/sitemap.xml')).text();
  for (const p of PAGES) expect(xml).toContain(`https://vinterest.team${p === '/' ? '/' : p}<`);
});
