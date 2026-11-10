// The Vinterest Teams website (site/teams/, built by scripts/site-teams.mjs into site-teams-dist/,
// served on :4176): every page renders without errors or sideways scroll at phone, tablet and desktop
// widths, the nav links to real pages and marks the one it's on, and the calculator answers.
const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:4176';
const PAGES = ['/', '/restaurants', '/groups', '/wineries', '/pricing', '/privacy', '/mise-en-place'];

for (const width of [390, 1024, 1440]) {
  test(`every page renders cleanly at ${width}px`, async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":""}' })); // the site's Worker answers this
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    for (const p of PAGES) {
      const res = await page.goto(BASE + p);
      expect(res.status(), p).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('footer')).toBeVisible();
      await expect(page.locator('#pilotForm')).toHaveCount(1);
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
  await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":""}' }));
  await page.goto(BASE + '/');
  // Grouped links open from their group's name; the rest sit in the nav itself.
  for (const [group, name, path] of [['Who it\'s for', 'Restaurants and wine bars', '/restaurants'], ['Who it\'s for', 'Restaurant groups', '/groups'], ['Who it\'s for', 'Wineries and tasting rooms', '/wineries'], [null, 'Mise en place', '/mise-en-place'], [null, 'Pricing', '/pricing']]) {
    if (group) { await page.locator('header nav .ddb', { hasText: group }).click(); await expect(page.locator('header nav .dd.on .ddm')).toBeVisible(); }
    await page.locator('header nav a', { hasText: name }).first().click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.locator('header nav a[aria-current="page"]')).toContainText(name);
  }
  // Every in-site link leads somewhere that exists.
  const hrefs = await page.evaluate(() => [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href').split('#')[0]));
  for (const h of new Set(hrefs)) expect((await page.request.get(BASE + h)).status(), h).toBe(200);
  await page.close();
});

// On a phone the nav is behind a menu button, with every group shown.
test('on a phone the menu button opens the whole nav', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":""}' }));
  await page.goto(BASE + '/');
  await expect(page.locator('header nav')).toBeHidden();
  await page.locator('header .menub').click();
  await expect(page.locator('header nav a', { hasText: 'Restaurant groups' })).toBeVisible();
  await expect(page.locator('header nav a', { hasText: 'Mise en place' })).toBeVisible();
  await page.locator('header nav a', { hasText: 'Mise en place' }).click();
  await expect(page).toHaveURL(/\/mise-en-place$/);
  await expect(page.locator('h1')).toContainText('Mise en place');
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
  // The demo restaurant's list beside it, as bottles, made at build time from the app's own files; a bottle opens its card.
  const list = page.locator('.calc .cellar');
  await expect(list.locator('.cellar-grid i')).toHaveCount(30);
  await list.locator('.cellar-tabs [data-mode="bottle"]').click();
  await expect(list.locator('.cellar-cap')).toContainText('15 are bottle only');
  await list.locator('.cellar-grid i').last().click();
  await expect(page.locator('dialog.wcard h3')).toBeVisible();
  await expect(page.locator('dialog.wcard')).toContainText('What to say at the table');
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

// The pilot form: every page carries it, "Other" asks what, and it posts the answers to /api/pilot and
// thanks them in place.
test('the pilot form asks what it needs and sends it', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  let sent = null;
  await page.route('**/api/pilot', (r) => { sent = JSON.parse(r.request().postData()); r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
  await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":"CA"}' }));
  await page.goto(BASE + '/restaurants');
  await expect(page.locator('header .doors a', { hasText: 'Sign up for a pilot' })).toHaveAttribute('href', '#pilot');
  await expect(page.locator('#p-country')).toHaveValue('CA');
  const f = page.locator('#pilotForm');
  await f.locator('button[type=submit]').click();
  await expect(page.locator('#pilotNote')).toContainText('First name');
  expect(sent).toBeNull();
  await f.locator('#p-first').fill('Martin'); await f.locator('#p-last').fill('Lee'); await f.locator('#p-email').fill('martin@example.com');
  await f.locator('#p-company').fill('The Larkspur'); await f.locator('#p-city').fill('Toronto');
  await f.locator('#p-type').selectOption('wine_bar'); await f.locator('#p-sites').selectOption('1'); await f.locator('#p-team').selectOption('10–25');
  await expect(f.locator('#p-pos-other')).toBeHidden();
  await f.locator('#p-pos').selectOption('other');
  await expect(f.locator('#p-pos-other')).toBeVisible();
  await f.locator('#p-wines').selectOption('50–150');
  await f.locator('button[type=submit]').click();
  await expect(page.locator('#pilotNote')).toContainText('Which POS');
  await f.locator('#p-pos-other').fill('TouchBistro');
  await f.locator('button[type=submit]').click();
  await expect(page.getByTestId('pilot-done')).toContainText('The Larkspur');
  expect(sent).toMatchObject({ first_name: 'Martin', company: 'The Larkspur', city: 'Toronto', country: 'CA', venue_type: 'wine_bar', pos: 'other', pos_other: 'TouchBistro', list_size: '50–150' });
  await page.close();
});

// The site's Worker: a request is checked, saved with the server key, and two emails go out (the
// confirmation to them, the request to us); bots, other sites and a missing setup are refused.
test('the site Worker saves a pilot request and emails both sides', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const copy = path.join(os.tmpdir(), `worker-teams-site-${process.pid}.mjs`);
  fs.copyFileSync(path.join(__dirname, '..', 'site', 'teams', '_worker.js'), copy);
  const mod = await import(require('node:url').pathToFileURL(copy).href + `?t=${Date.now()}`);
  const good = { first_name: 'Ada', last_name: 'L', email: 'Ada@Example.com', company: 'The Larkspur', city: 'Bristol', country: 'GB', venue_type: 'restaurant', sites: '1', team_size: '10–25', pos: 'square', list_size: '50–150', notes: 'Soon,\nplease' };
  expect(mod.readPilot({ ...good, venue_type: 'pub' }).error).toMatch(/type of business/);
  expect(mod.readPilot({ ...good, pos: 'other' }).error).toMatch(/which POS/);
  expect(mod.readPilot({ ...good, venue_type: 'other', venue_type_other: 'Hotel bar' }).row.venue_type_other).toBe('Hotel bar');
  expect(mod.readPilot({ ...good, pos_other: 'ignored' }).row.pos_other).toBeNull();
  const calls = [], real = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response('[]', { status: 201 }); };
  try {
    const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'sk', RESEND_API_KEY: 're', PILOT_NOTIFY: 'carey@example.com' };
    const post = (body, h = {}) => new Request('https://vinterest.team/api/pilot', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.team', 'cf-connecting-ip': String(Math.random()), ...h }, body: JSON.stringify(body) });
    let res = await mod.handlePilot(post(good), env);
    expect(res.status).toBe(200);
    const db = calls.find((c) => c.url.includes('/rest/v1/pilot_requests'));
    expect(db.init.headers.apikey).toBe('sk');
    expect(JSON.parse(db.init.body)).toMatchObject({ email: 'ada@example.com', company: 'The Larkspur', pos: 'square', notes: 'Soon,\nplease' });
    const mails = calls.filter((c) => c.url.includes('resend')).map((c) => JSON.parse(c.init.body));
    expect(mails.map((m) => m.to[0]).sort()).toEqual(['ada@example.com', 'carey@example.com']);
    expect(mails.find((m) => m.to[0] === 'carey@example.com')).toMatchObject({ reply_to: 'ada@example.com', subject: 'Pilot request: The Larkspur, Bristol' });
    calls.length = 0;
    expect((await (await mod.handlePilot(post({ ...good, website: 'x' }), env)).json()).ok).toBe(true); // the honeypot
    expect((await mod.handlePilot(post(good, { origin: 'https://evil.example' }), env)).status).toBe(403);
    expect((await mod.handlePilot(post({ ...good, email: 'nope' }), env)).status).toBe(400);
    expect((await mod.handlePilot(post(good), {})).status).toBe(503);
    expect(calls).toEqual([]);
    const r = await mod.default.fetch(new Request('https://www.vinterest.team/pricing'), {});
    expect(r.status).toBe(301); expect(r.headers.get('location')).toBe('https://vinterest.team/pricing');
  } finally { global.fetch = real; }
});

// The laptop's console demo: whichever section is picked opens at the top of its page and rests there
// before it scrolls, and so does a wine's card when it opens.
test('each console scene, and the wine card, opens at the top of its page', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":""}' }));
  await page.goto(BASE + '/');
  await page.locator('#demo').scrollIntoViewIfNeeded();
  const pan = () => page.evaluate(() => { const e = document.querySelector('#stage .ly[data-pan]'); return e && { img: e.src.split('/').pop().split('?')[0], y: e.style.transform || 'none' }; });
  for (const k of ['sales', 'team', 'cards', 'ready', 'menu']) {
    await page.click(`[data-scene=${k}]`);
    await page.waitForTimeout(1200);
    expect((await pan()).y, k).toMatch(/^(none|translateY\(0px\))$/);
  }
  await page.click('[data-scene=cards]');
  await expect.poll(async () => (await pan()).img, { timeout: 6000 }).toBe('card.jpg');
  await page.waitForTimeout(800);
  expect((await pan()).y).toMatch(/^(none|translateY\(0px\))$/);
  await page.close();
});

// A page written for one restaurant: reachable by its address, never listed, and its sums are its own prices.
test('a private page is hidden from search and adds up', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(BASE + '/for/princess-royal');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('h1')).toContainText('132 wines');
  expect(await (await request.get(BASE + '/sitemap.xml')).text()).not.toContain('/for/');
  expect(await (await request.get(BASE + '/robots.txt')).text()).toContain('Disallow: /for/');
  const box = page.locator('#prCalc');
  await expect(box.locator('[data-t="day"]')).toHaveText('£191');       // 3 × £23 + 5 × £14 + 4 × £13
  await expect(box.locator('[data-t="week"]')).toHaveText('£1,337');
  await expect(box.locator('[data-t="year"]')).toHaveText('£69,524');
  await box.locator('[data-in="up"]').fill('0');
  await expect(box.locator('[data-t="day"]')).toHaveText('£122');
  // the list as bottles: one per wine, and the filters count what the page says
  await expect(page.locator('.cellar-grid i')).toHaveCount(132);
  await page.locator('.cellar-tabs [data-mode="bottle"]').click();
  await expect(page.locator('.cellar-tabs [data-mode="bottle"] b')).toHaveText('94');
  await expect(page.locator('.cellar-grid i.off')).toHaveCount(38);
  await expect(page.locator('.cellar-tabs [data-mode="top"] b')).toHaveText('33');
  await expect(page.locator('.cellar-cap')).toContainText('94 are bottle only');
  // naming a bottle moves nothing; clicking it opens that wine's card
  const tops = () => page.evaluate(() => ['.cellar-cap', 'h1', '.cellar-key', '.pr-facts'].map((q) => Math.round(document.querySelector(q).getBoundingClientRect().top + scrollY)));
  const before = await tops();
  const last = page.locator('.cellar-grid i').last();
  await last.hover();
  await expect(page.locator('.cellar-pick')).toContainText('Blanc des Millénaires');
  expect(await tops()).toEqual(before);
  await last.click();
  const card = page.locator('dialog.wcard');
  await expect(card.locator('h3')).toContainText('Blanc des Millénaires');
  await expect(card.locator('.price')).toHaveText('£310 a bottle · bottle only');
  await expect(card.getByText('What to say at the table')).toBeVisible();
  await card.locator('.wcard-x').click();
  await expect(card).toBeHidden();
  for (const a of await page.locator('a[data-demo]').all()) await expect(a).toHaveAttribute('href', /seed=princess-royal/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// The hero's phone is the Teams app itself (live.js, the app's sources): it opens on Today, starts the day's
// drill and answers it, so the site can't show a drill the app no longer has.
test('the hero phone runs the real drill', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.TEAMS_LIVE_SPEED = 6; });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '/');
  const app = page.locator('#pstage .live-app');
  await expect(app.locator('[data-scroll]')).toBeAttached({ timeout: 20000 });
  await expect(page.locator('#pstage > img.ly').first()).toBeHidden();          // the pictures have handed over
  await expect(app.locator('[data-testid=team-drill]')).toBeVisible({ timeout: 15000 });
  await expect(app.locator('[data-testid=drill-result]')).toBeVisible({ timeout: 15000 }); // an answer marked by the app
  await expect(app.locator('[data-testid=drill-done]')).toBeVisible({ timeout: 40000 });
  await expect(app.locator('[data-testid=drill-done]')).toContainText(/of 5 right/);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /^(vbiz|vinterest)_/.test(k)))).toEqual([]); // nothing left on the visitor's device
  expect(errors).toEqual([]);
});

// On a phone the hero has no phone, so the drill in "On the floor" is the live one, loaded as the section nears.
test('on a phone the floor carousel runs the real drill', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.TEAMS_LIVE_SPEED = 6; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/');
  await expect(page.locator('#pstage .live-app')).toHaveCount(0);
  await page.locator('#orbit').scrollIntoViewIfNeeded();
  await expect(page.locator('#ftitle')).toHaveText('The drill');
  await expect(page.locator('#ftry a')).toHaveAttribute('href', /view=phone/); // the phone plays by itself; this opens the app to try by hand
  const app = page.locator('#fstage .live-app');
  await expect(app.locator('[data-testid=drill-result]')).toBeVisible({ timeout: 30000 });
  await expect(app.locator('[data-testid=drill-done]')).toBeVisible({ timeout: 40000 });
  await expect(page.locator('#ftitle')).toHaveText('The card', { timeout: 15000 }); // one run, then the carousel turns
  // Tapped, the phone opens full screen as the app itself, theirs to use: a drill started and answered by hand.
  await page.locator('#fdots button').first().click();
  await page.locator('#orbit .slot').first().locator('.phone').click();
  const full = page.locator('.live-full');
  await expect(full.getByText('Hi Dani')).toBeVisible();
  await expect(page.locator('#fstage .live-app')).toHaveCount(0);                   // the playing phone has stopped
  await full.getByText(/Start today's drill|Practise · 5/).first().click();
  await full.locator('[data-testid=drill-opt]').first().click();
  await full.getByText('Check', { exact: true }).click();
  await expect(full.locator('[data-testid=drill-result]')).toBeVisible();
  await full.locator('[data-live-close]').click();
  await expect(full).toHaveCount(0);
  await expect(page.locator('#fstage .live-app')).toHaveCount(1);                   // and plays again once closed
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// The launch timeline draws itself with the scroll: nothing lit above it, every step lit once it has passed.
test('the Mise en place timeline lights its steps as the page scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const [url, line, step, n] of [['/?live=off', '.tl', '.s', 5], ['/mise-en-place', '.stepsfull', '.sf', 5]]) {
    await page.goto(BASE + url);
    if (url !== '/mise-en-place') await expect(page.locator(`${line} ${step}.on`)).toHaveCount(0);
    await page.evaluate((q) => { const r = document.querySelector(q).getBoundingClientRect(); scrollTo(0, r.bottom + scrollY - 200); }, line);
    await expect(page.locator(`${line} ${step}.on`)).toHaveCount(n);
  }
  // Reduced motion: no drawing, every step as written.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(BASE + '/mise-en-place');
  await expect(page.locator('.stepsfull.tl-js')).toHaveCount(0);
});

// Hear a table: nothing sounds until Play; then each line is said in turn and Vinny's mark arrives.
test('the table plays its lines and ends on the mark', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => { window.TEAMS_TABLE_SPEED = 8; });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '/?live=off');
  const table = page.locator('[data-table]');
  await expect(table.locator('.t-line')).toHaveCount(4);
  for (const src of await table.locator('.t-line').evaluateAll((ls) => ls.map((l) => l.dataset.src))) {
    const r = await request.get(BASE + src); expect(r.status()).toBe(200); expect(r.headers()['content-type']).toContain('audio');
  }
  await expect(table).not.toHaveClass(/playing/);
  await table.locator('[data-table-play]').click();
  await expect(table.locator('.t-line.on').first()).toBeVisible();
  await expect(table.locator('.t-mark.on')).toBeVisible({ timeout: 20000 });
  await expect(table.locator('.t-line.on')).toHaveCount(4);
  await expect(table.locator('[data-table-play] .lbl')).toHaveText('Play it again');
  await expect(table.locator('.t-mark')).toContainText('That landed');
  expect(errors).toEqual([]);
});

// The Social Corner's page takes its list and cards from the seed's own files at build time, in Canadian dollars.
test("The Social Corner's private page is built from its seed and adds up", async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE + '/for/social-corner');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('h1')).toContainText('41 wines');
  expect(await (await request.get(BASE + '/sitemap.xml')).text()).not.toContain('/for/');
  const list = page.locator('.cellar');
  await expect(list.locator('.cellar-grid i')).toHaveCount(41);
  await list.locator('.cellar-tabs [data-mode="bottle"]').click();
  await expect(list.locator('.cellar-tabs [data-mode="bottle"] b')).toHaveText('18');
  await expect(list.locator('.cellar-tabs [data-mode="top"] b')).toHaveText('13');
  await list.locator('.cellar-grid i').last().click();
  const card = page.locator('dialog.wcard');
  await expect(card.locator('h3')).toContainText('Tignanello');
  await expect(card.locator('.price')).toHaveText('$350 a bottle · bottle only');
  await card.locator('.wcard-x').click();
  const box = page.locator('#scCalc');
  await expect(box.locator('[data-t="day"]')).toHaveText('$359');        // 3 × $42 + 10 × $11 + 5 × $15 + 4 × $12
  await expect(box.locator('[data-t="year"]')).toHaveText('$130,676');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

// A prospect's page is drafted from its seed's two files (scripts/site-teams-for.mjs); the analysis holds to them.
test('the page generator reads a seed and drafts a page the build accepts', async () => {
  const fs = require('node:fs'), path = require('node:path'), root = path.join(__dirname, '..');
  const { analyse, render } = await import(require('node:url').pathToFileURL(path.join(root, 'scripts', 'site-teams-for.mjs')).href);
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
  const a = analyse(read('data/team-social-list.json'), read('data/team-social.json'));
  expect([a.figures.wines, a.figures.bottleOnly, a.figures.byGlass]).toEqual([41, 18, 23]);
  expect(a.moves.map((m) => [m.k, m.price])).toEqual([['up', 42], ['pour', 11], ['fizz', 15], ['sweet', 12]]);
  expect(a.facts.length).toBeGreaterThanOrEqual(6);
  expect(a.picks).toHaveLength(4);
  for (const p of a.picks) expect(p.line.length).toBeGreaterThan(20);                       // each dish has the line from its wine's card
  const html = render(a, { seed: 'social', slug: 'x', demo: 'https://example.com/', source: '', logo: '', aspect: 0 });
  expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
  expect(html).toContain('<meta name="seed" content="social">');
  expect(html).toContain('41 wines. <em>18 need a recommendation.</em>');
  expect(html).not.toMatch(/undefined|NaN/);
  // A list of non-alcoholic bottles and magnums doesn't bend the figures (The Princess Royal's has both).
  const b = analyse(read('data/team-princess-royal-list.json'), read('data/team-princess-royal.json'));
  expect(b.moves.find((m) => m.k === 'fizz').why).not.toMatch(/non-alc/i);
  // The stories are chosen per restaurant. The Barbary's glass list is already dear bottles, so trading up tells nothing;
  // its own stories are its mains cut for the table, a bottle priced at 5.4 glasses, and its bottles with age (by the week).
  const c = analyse(read('data/team-barbary-list.json'), read('data/team-barbary.json'));
  expect(c.moves.map((m) => [m.k, m.price, m.per || 'day'])).toEqual([['share', 65, 'day'], ['size', 20, 'day'], ['aged', 200, 'week'], ['fizz', 17, 'day']]);
  expect(c.facts.slice(0, 4).map((x) => x.title)).toEqual(['Bottle only', 'Wines from where your food is from', 'Mains cut for the table', 'From two glasses each to the bottle']);
  expect(c.dailyMenu).toBe(true);
  expect(c.picks[0]).toMatchObject({ dish: 'Hereford Côte De Boeuf' });
  const page = render(c, { seed: 'barbary', slug: 'x', demo: 'https://example.com/', source: '', logo: '', aspect: 0 });
  expect(page).toContain('data-per="week"'); expect(page).toContain("Today's menu, paired before service."); expect(page).not.toMatch(/undefined|NaN/);
  expect(render(a, { seed: 'social', slug: 'x', demo: 'https://example.com/', source: '', logo: '', aspect: 0 })).not.toContain('paired before service');
});
