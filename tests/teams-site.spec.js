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

// demo.vinterest.team: the app's Worker serves the team app at the root of its own address, so the
// demo never opens on the consumer app; the script and photos come from /team/, fonts from the root.
test('the demo address serves the team app at its root', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const copy = path.join(os.tmpdir(), `worker-demo-${process.pid}.mjs`);
  fs.copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  const worker = (await import(require('node:url').pathToFileURL(copy).href + `?t=${Date.now()}`)).default;
  const asked = [];
  const env = { ASSETS: { fetch: async (req) => { const p = new URL(req.url).pathname; asked.push(p); return new Response(p, { status: 200, headers: { 'content-type': 'text/plain' } }); } } };
  const get = (u) => worker.fetch(new Request(u, { redirect: 'manual' }), env);
  let r = await get('https://demo.vinterest.team/');
  expect(r.status).toBe(302); expect(r.headers.get('location')).toBe('https://demo.vinterest.team/?seed=demo');
  r = await get('https://demo.vinterest.team/?seed=demo&view=console');
  expect(await r.text()).toBe('/team/'); expect(r.headers.get('cache-control')).toContain('no-cache');
  expect(await (await get('https://demo.vinterest.team/team.js?v=1')).text()).toBe('/team/team.js');
  expect(await (await get('https://demo.vinterest.team/faces/1.png')).text()).toBe('/team/faces/1.png');
  expect(await (await get('https://demo.vinterest.team/fonts/fonts.css')).text()).toBe('/fonts/fonts.css');
  r = await get('https://demo.vinterest.team/team/?seed=demo');
  expect(r.status).toBe(301); expect(r.headers.get('location')).toBe('https://demo.vinterest.team/?seed=demo');
  r = await get('https://demo.vinterest.team/wines');
  expect(r.status).toBe(302);
  // The app's own address is untouched.
  expect(await (await get('https://vinterest.pages.dev/')).text()).toBe('/');
});

test('the demo buttons follow the branch', async () => {
  const { demoUrl } = await import(require('node:url').pathToFileURL(require('node:path').join(__dirname, '..', 'scripts', 'site-teams.mjs')).href);
  expect(demoUrl('main')).toBe('https://demo.vinterest.team/?seed=demo&view=console');
  expect(demoUrl(undefined)).toBe('https://demo.vinterest.team/?seed=demo&view=console');
  expect(demoUrl('claude/teams-site')).toBe('https://claude-teams-site.vinterest.pages.dev/team/?seed=demo&view=console');
});

// The demo restaurant opens full screen over the page, from the laptop and from every link to it, and
// loads the console only when first opened; Esc and × close it.
test('the demo opens full screen over the page and closes again', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.route('https://demo.vinterest.team/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>demo</title><p>The Larkspur</p>' }));
  await page.goto(BASE + '/');
  const box = page.locator('#demoBox');
  await expect(box).toBeHidden();
  expect(await box.locator('iframe').getAttribute('src')).toBeNull();
  await page.locator('.lid').click();
  await expect(box).toBeVisible();
  expect(await box.locator('iframe').getAttribute('src')).toBe('https://demo.vinterest.team/?seed=demo&view=console');
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();
  await page.locator('header nav ~ .doors a', { hasText: 'Try Restaurant Demo' }).click();
  await expect(box).toBeVisible();
  await page.locator('[data-demo-close]').click();
  await expect(box).toBeHidden();
  // Every page carries it, so the nav's link works everywhere.
  await page.goto(BASE + '/pricing');
  await page.locator('header .doors a', { hasText: 'Try Restaurant Demo' }).click();
  await expect(page.locator('#demoBox')).toBeVisible();
  await page.close();
});
