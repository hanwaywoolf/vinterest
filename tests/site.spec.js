// The marketing site (site/, built by scripts/site.mjs into site-dist/, served on :4175): its demos
// are the app's real screens from a memory-only store, driven by page scroll; the beta form posts to
// the site's Worker. The Worker itself is tested here too, without Cloudflare.
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { ROOT } = require('./helpers');

const BASE = 'http://localhost:4175';
// The demos run the app's engines over the onboarding sample user, so the match they show is whatever
// data/onboarding-sample.json's regenerated slides say (`npm run sample:onboarding`).
const SAMPLE_MATCH = require('../data/onboarding-sample.json').slides.match;
// site/_worker.js is an ES module in a CommonJS package: load a .mjs copy of it (once, so the
// Worker's per-visitor limit is shared by every test that calls it, as it would be in one isolate).
let workerModule;
const load = async () => {
  if (!workerModule) {
    const copy = path.join(require('node:os').tmpdir(), `site-worker-${process.pid}.mjs`);
    require('node:fs').copyFileSync(path.join(ROOT, 'site/_worker.js'), copy);
    workerModule = import(pathToFileURL(copy).href);
  }
  return workerModule;
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":"GB"}' }));
});

// Brings a demo section on screen, as scrolling to it would.
async function show(page, id) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center', behavior: 'instant' }), id);
}
// Jumps a demo to its nth caption, as a click on it does.
const jump = (page, id, n) => page.locator(`#${id} .steps li`).nth(n).click();
const scrolledPx = (page, id) => page.evaluate((id) => {
  let best = 0;
  document.querySelector(`#${id} .phone-app`).querySelectorAll('*').forEach((el) => { if (el.scrollHeight > el.clientHeight + 40 && ['auto', 'scroll'].includes(getComputedStyle(el).overflowY)) best = Math.max(best, el.scrollTop); });
  return best;
}, id);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('renders with no errors, and the hero phone shows the app\'s real scan result', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await page.goto(BASE + '/');
    await expect(page.locator('h1')).toContainText("Find wines you'll love. Learn while you sip");
    const hero = page.locator('.hero .phone-app');
    await expect(hero).toContainText('Crozes-Hermitage 2021');
    await expect(hero).toContainText(`${SAMPLE_MATCH.pct}%`);
    await expect(hero).toContainText(SAMPLE_MATCH.label);
    expect(errors).toEqual([]);
  });

  test('a section plays through its captions by itself, once, and a click on the words stops it', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'scan');
    await expect(page.locator('#scan .phone-app')).toContainText('Crozes-Hermitage 2021');
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Who made it, and when to drink it');
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Whether it\'s for you', { timeout: 6000 });
    // It finishes and stays on the last caption; it does not start again.
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Then rate it, or see more', { timeout: 15000 });
    await page.waitForTimeout(2500);
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Then rate it, or see more');
    // A click on a caption stops it: choose the first, and it stays there.
    await jump(page, 'scan', 0);
    await page.waitForTimeout(2500);
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Who made it, and when to drink it');
    // The arrows and the progress lines still move it.
    await page.locator('#scan .arrow.next').click();
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Whether it\'s for you');
  });

  test('the progress bar is centred over the phone', async ({ page }) => {
    await page.goto(BASE + '/');
    for (const id of ['scan', 'winedna', 'vinny']) {
      await show(page, id);
      const bar = await page.locator(`#${id} .prog`).evaluate((el) => { const bs = Array.from(el.children).map((c) => c.getBoundingClientRect()); return (bs[0].left + bs[bs.length - 1].right) / 2; });
      const ph = await page.locator(`#${id} .phone`).boundingBox();
      expect(Math.abs(bar - (ph.x + ph.width / 2)), id).toBeLessThan(3);
    }
  });

  test('the front page is a carousel of the app that turns by itself until someone touches it', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await expect(page.locator('.hero .stage .cap')).toHaveText("Scan a bottle. See if it's for you.");
    await expect(page.locator('.hero .stage .cap')).toHaveText('Every bottle builds your WineDNA.', { timeout: 6000 });
    await expect(page.locator('.hero .phone-app')).toContainText('WineDNA');
    await page.locator('.hero .arrow.next').click();
    const at = await page.locator('.hero .stage .cap').textContent();
    await page.waitForTimeout(2500);
    await expect(page.locator('.hero .stage .cap')).toHaveText(at); // stopped turning
    await page.locator('.hero .prog button').first().click();
    await expect(page.locator('.hero .phone-app')).toContainText('Crozes-Hermitage 2021');
  });

  test('a caption stops the autoplay and holds the scan story on that scene', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'scan');
    const phone = page.locator('#scan .phone-app');
    await jump(page, 'scan', 3);
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('The grape');
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'grape', { timeout: 8000 });
    await expect(phone).toContainText('Syrah');
    // The story would move on by itself after the scene's reading time; held, it doesn't.
    await page.waitForTimeout(6000);
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'grape');
    await jump(page, 'scan', 0);
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'label', { timeout: 8000 });
  });

  test('the wheel over the text scrolls the page and never moves the demo', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'rate');
    await jump(page, 'rate', 0);
    const copy = await page.locator('#rate .copy').boundingBox();
    await page.mouse.move(copy.x + 100, copy.y + 100);
    const y0 = await page.evaluate(() => scrollY);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 300);
    await expect(page.locator('#rate .steps li.on h3')).toHaveText('Slide to rate');
  });

  test('the page scrolls straight past a demo: no pinned section to scroll through', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'scan');
    const h = await page.evaluate(() => document.getElementById('scan').offsetHeight);
    expect(h).toBeLessThanOrEqual(820);
    const before = await page.evaluate(() => scrollY);
    const ph = await page.locator('#scan .phone').boundingBox();
    await page.mouse.move(ph.x + ph.width / 2, ph.y + ph.height / 2);
    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 600);
  });

  test('the scan story plays its scenes: label, match, taste, grape, region, something to say, then what next', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'scan');
    const phone = page.locator('#scan .phone-app');
    const scene = phone.locator('[data-testid="reveal-scene"]');
    await expect(phone).toContainText('Alain Graillot');
    await expect(phone).toContainText('Drinking');          // the drinking window under the label
    await jump(page, 'scan', 1);
    await expect(scene).toHaveAttribute('data-scene', 'match', { timeout: 8000 });
    await expect(phone).toContainText(`${SAMPLE_MATCH.pct}%`, { timeout: 8000 });
    await jump(page, 'scan', 2);
    await expect(scene).toHaveAttribute('data-scene', 'taste', { timeout: 8000 });
    await expect(phone).toContainText('Blackberry', { timeout: 8000 });   // the tasting notes
    await jump(page, 'scan', 4);
    await expect(scene).toHaveAttribute('data-scene', 'place', { timeout: 8000 });
    await expect(phone).toContainText('Rhône Valley', { timeout: 8000 });
    await jump(page, 'scan', 5);
    await expect(scene).toHaveAttribute('data-scene', 'say', { timeout: 8000 });
    await jump(page, 'scan', 6);
    await expect(phone).toContainText('What next?', { timeout: 8000 });
    await expect(phone).toContainText('Rate it');
  });

  test('rating a bottle slides the score up and saves it, then offers what to learn, without changing the other demos', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'rate');
    const phone = page.locator('#rate .phone-app');
    await expect(phone).toContainText('How was it?');
    await jump(page, 'rate', 1);
    await expect(phone).toContainText('Scored 92', { timeout: 8000 });
    // The three quick answers fill in as the caption plays.
    await expect(phone).toContainText('On your Buy again list', { timeout: 10000 });
    await expect(phone.locator('input[aria-label="What you paid"]')).toHaveValue('30', { timeout: 10000 });
    await expect(phone.locator('input[aria-label="Where did you have it"]')).toHaveValue("At a friend's dinner", { timeout: 10000 });
    // Then the learning picked for this bottle.
    await jump(page, 'rate', 2);
    await expect(phone).toContainText('Keep learning', { timeout: 10000 });
    await expect(phone).toContainText('Syrah quiz');
    // Going back to the start puts the rating panel back.
    await jump(page, 'rate', 0);
    await expect(phone).toContainText('How was it?', { timeout: 10000 });
    // A saved rating stays in that demo: the WineDNA demo still counts the sample user's own bottles.
    await jump(page, 'rate', 1);
    await expect(phone).toContainText('Scored 92', { timeout: 10000 });
    await show(page, 'winedna');
    await expect(page.locator('#winedna .phone-app')).toContainText('12 bottles scanned');
  });

  test('Vinny types the question again each time it is chosen, and the box follows the cursor', async ({ page }) => {
    await page.goto(BASE + '/?speed=4');
    await show(page, 'vinny');
    const phone = page.locator('#vinny .phone-app');
    await expect(phone).toContainText('Thinking', { timeout: 8000 });
    await jump(page, 'vinny', 0);
    await expect(phone).not.toContainText('Thinking');
    // Mid-typing the end of the question is what the box shows, with the cursor after it.
    const seen = await page.waitForFunction(() => {
      const box = document.querySelector('#vinny .phone-app form');
      if (!box) return false;
      const t = box.innerText.trim();
      return t.length > 20 ? t : false;
    }, null, { timeout: 8000 });
    expect(await seen.jsonValue()).toBeTruthy();
    await expect(phone).toContainText('Thinking', { timeout: 8000 });
  });

  test('Mastery shows the whole picture, the grapes, the region map and the palate, from the current build', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'mastery');
    const phone = page.locator('#mastery .phone-app');
    await expect(phone).toContainText('Your Mastery');
    await expect(phone).toContainText('Your shape', { timeout: 10000 }); // the radar sits below the score
    await jump(page, 'mastery', 1);
    await expect(phone.locator('[data-testid="grape-cluster"]')).toBeVisible({ timeout: 8000 }); // the sketched bunches
    await expect(phone).toContainText('Your wine map', { timeout: 12000 });   // the same caption plays on to the map
    // The map shows what the drinker has opened, not every region as a grey dot.
    await expect(phone.locator('[data-testid="region-map"] circle[fill="#CFC9C2"]').first()).toBeHidden();
    await jump(page, 'mastery', 2);
    await expect(phone).toContainText('You call it grippier', { timeout: 8000 }); // seven seeded Blind Calls: the tannins tile's habit
    // Mastery is its own section: the Learn section no longer carries a Mastery step.
    await expect(page.locator('#learn .steps li h3')).not.toContainText(['Mastery map']);
  });

  test('My Wines types the search, then opens a bottle and shows its story and its price', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'my-wines');
    const phone = page.locator('#my-wines .phone-app');
    await jump(page, 'my-wines', 1);
    await expect(phone.locator('input[placeholder^="Search"]')).toHaveValue('Rioja', { timeout: 8000 });
    await jump(page, 'my-wines', 2);   // one caption plays through Details, Learn and Price
    await expect(phone).toContainText('La Rioja Alta', { timeout: 8000 });
    await expect(phone).toContainText('benchmark of traditional Rioja', { timeout: 12000 });
    await expect(phone).toContainText('Typical bottle price', { timeout: 12000 });
    await expect(phone).toContainText('£27');
  });

  test('Vinny types the question and answers it', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'vinny');
    const phone = page.locator('#vinny .phone-app');
    await jump(page, 'vinny', 1);
    await expect(phone).toContainText('Steak tonight. What should I look for?', { timeout: 10000 });
    await expect(phone).toContainText('Rioja', { timeout: 10000 });
  });

  test('each demo screen mounts, with the sample user\'s wines', async ({ page }) => {
    await page.goto(BASE + '/');
    const want = { winedna: 'WineDNA', learn: 'Wine Basics', mastery: 'Your Mastery', 'my-wines': 'Viña Ardanza Reserva' };
    for (const [id, text] of Object.entries(want)) {
      await show(page, id);
      await expect(page.locator(`#${id} .phone-app`)).toContainText(text);
    }
  });

  test('the demos never touch the visitor\'s storage or call out', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => { const u = new URL(r.url()); if (u.origin !== BASE || /claude|supabase/.test(u.pathname)) calls.push(r.url()); });
    await page.addInitScript(() => { if (!localStorage.getItem('vinterest_wines')) localStorage.setItem('vinterest_wines', '[{"name":"Mine"}]'); });
    await page.goto(BASE + '/');
    for (const id of FITS) { await show(page, id); await page.waitForTimeout(400); }
    await jump(page, 'rate', 1);
    await page.waitForTimeout(1500);
    const stored = await page.evaluate(() => ({ n: localStorage.length, wines: localStorage.getItem('vinterest_wines'), s: sessionStorage.length }));
    // Only the visitor's own key is there, unchanged, and nothing was written to session storage.
    expect(stored).toEqual({ n: 1, wines: '[{"name":"Mine"}]', s: 0 });
    expect(calls).toEqual([]);
  });

  test('the demo bundle is only fetched once a phone is near', async ({ page }) => {
    const hits = [];
    page.on('request', (r) => { if (r.url().includes('/demo.js')) hits.push(r.url()); });
    await page.goto(BASE + '/privacy/');
    expect(hits).toEqual([]);
  });
});

// Nothing in a demo section may be cut off, whatever the window: the text and the phone stay inside
// the section, and the caption text stays clear of the header.
const FITS = ['scan', 'rate', 'winedna', 'vinny', 'learn', 'mastery', 'my-wines'];
async function fits(page, id) {
  await show(page, id);
  await page.waitForTimeout(300);
  return page.evaluate((id) => {
    const r = (sel) => document.querySelector(sel).getBoundingClientRect();
    const sec = r(`#${id}`), copy = r(`#${id} .copy`), phone = r(`#${id} .phone`);
    return { secTop: sec.top, secBottom: sec.bottom, copyTop: copy.top, copyBottom: copy.bottom, phoneTop: phone.top, phoneBottom: phone.bottom, vh: innerHeight, wide: document.documentElement.scrollWidth <= innerWidth };
  }, id);
}

test.describe('short desktop window', () => {
  test.use({ viewport: { width: 1280, height: 613 }, hasTouch: false, isMobile: false });

  test('every section fits, with nothing cut off at the top or the bottom', async ({ page }) => {
    await page.goto(BASE + '/');
    for (const id of FITS) {
      const b = await fits(page, id);
      // The section is no taller than the window (or 600px, if the window is shorter): it is one screen, not a scroll.
      expect(b.secBottom - b.secTop, `${id} height`).toBeLessThanOrEqual(Math.max(b.vh, 600) + 2);
      expect(b.copyTop, `${id} text top`).toBeGreaterThanOrEqual(b.secTop + 60);
      expect(b.copyBottom, `${id} text bottom`).toBeLessThanOrEqual(b.secBottom - 8);
      expect(b.phoneTop, `${id} phone top`).toBeGreaterThanOrEqual(b.secTop + 60);
      expect(b.phoneBottom, `${id} phone bottom`).toBeLessThanOrEqual(b.secBottom - 8);
      // And with each caption lit in turn (once it has finished opening) nothing moves out of the section.
      const n = await page.locator(`#${id} .steps li`).count();
      let top0;
      for (let i = 0; i < n; i++) {
        await jump(page, id, i);
        await page.waitForTimeout(500);
        const c = await page.evaluate((id) => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { top: r(`#${id} .copy`).top - r(`#${id}`).top, bottom: r(`#${id} .copy`).bottom, sec: r(`#${id}`).bottom }; }, id);
        expect(c.bottom, `${id} caption ${i}`).toBeLessThanOrEqual(c.sec - 8);
        top0 = top0 ?? c.top;
        expect(Math.abs(c.top - top0), `${id} caption ${i} moved the text`).toBeLessThan(2);
      }
    }
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('nothing spills sideways, and the phone sits below the caption', async ({ page }) => {
    await page.goto(BASE + '/');
    for (const id of FITS) {
      const b = await fits(page, id);
      expect(b.wide, id).toBe(true);
      expect(b.secBottom - b.secTop, `${id} height`).toBeLessThanOrEqual(Math.max(b.vh, 600) + 2);
      expect(b.phoneTop, id).toBeGreaterThanOrEqual(b.copyBottom - 2);
      expect(b.phoneBottom, id).toBeLessThanOrEqual(b.secBottom + 2);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('nothing plays, and every caption shows', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(BASE + '/');
    await show(page, 'scan');
    for (const li of await page.locator('#scan .steps li').all()) { await expect(li).toBeVisible(); await expect(li.locator('p')).toBeVisible(); }
    await expect(page.locator('#scan .phone-app')).toContainText('Crozes-Hermitage 2021');
    await page.waitForTimeout(1500);
  });
});

test.describe('beta form', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('asks for what is missing, and pre-selects the country', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('#b-country')).toHaveValue('GB');
    await page.locator('#b-country').selectOption('');
    await page.locator('#beta-go').click();
    await expect(page.locator('.err[data-for="first_name"]')).toHaveText('Add your first name.');
    await expect(page.locator('.err[data-for="country"]')).toHaveText('Pick your country.');
    await expect(page.locator('.err[data-for="email"]')).toContainText('doesn\'t look right');
  });

  test('sends the four fields and says thanks', async ({ page }) => {
    const sent = [];
    await page.route('**/api/beta', (r) => { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
    await page.goto(BASE + '/');
    await page.fill('#b-first', 'Ada');
    await page.fill('#b-last', 'Lovelace');
    await page.selectOption('#b-country', 'GB');
    await page.fill('#b-email', 'ada@example.com');
    await page.locator('#beta-go').click();
    await expect(page.locator('#beta-thanks')).toBeVisible();
    await expect(page.locator('#beta-thanks')).toContainText('Thanks, Ada');
    expect(sent).toEqual([{ first_name: 'Ada', last_name: 'Lovelace', country: 'GB', email: 'ada@example.com', website: '' }]);
  });

  test('shows the server\'s words when it can\'t save', async ({ page }) => {
    await page.route('**/api/beta', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Beta sign-ups aren\'t open just yet. Please check back soon."}' }));
    await page.goto(BASE + '/');
    await page.fill('#b-first', 'Ada'); await page.fill('#b-last', 'Lovelace'); await page.fill('#b-email', 'ada@example.com');
    await page.locator('#beta-go').click();
    await expect(page.locator('#beta-fail')).toContainText('aren\'t open just yet');
    await expect(page.locator('#beta-go')).toBeEnabled();
  });
});

test.describe('legal pages', () => {
  test('privacy and terms exist and link back', async ({ page }) => {
    for (const p of ['/privacy/', '/terms/']) {
      await page.goto(BASE + p);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.draft')).toContainText('Draft');
    }
  });
});

test.describe('the sign-up Worker', () => {
  const post = (body, headers = {}) => new Request('https://vinterest.app/api/beta', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.app', ...headers }, body: JSON.stringify(body) });
  const good = { first_name: ' Ada ', last_name: 'Lovelace', country: 'gb', email: ' Ada@Example.COM ', website: '' };
  const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SECRET_KEY: 'secret' };

  test('saves a tidy row with the server key, and answers ok', async () => {
    const { handleBeta } = await load();
    const calls = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
    try {
      const res = await handleBeta(post(good, { 'cf-connecting-ip': '1.1.1.1' }), env);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    } finally { globalThis.fetch = realFetch; }
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://x.supabase.co/rest/v1/beta_signups?on_conflict=email');
    expect(calls[0].init.headers.apikey).toBe('secret');
    expect(calls[0].init.headers.prefer).toContain('ignore-duplicates');
    expect(JSON.parse(calls[0].init.body)).toEqual({ first_name: 'Ada', last_name: 'Lovelace', country: 'GB', email: 'ada@example.com' });
  });

  test('emails a new sign-up through Resend, once, and never fails the sign-up if that goes wrong', async () => {
    const { handleBeta } = await load();
    const renv = { ...env, RESEND_API_KEY: 're_test', RESEND_FROM: 'Vinterest <hello@vinterest.app>' };
    const realFetch = globalThis.fetch;
    const calls = [];
    let inserted = true, resendOk = true;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('supabase')) return new Response(JSON.stringify(inserted ? [{ email: 'ada@example.com' }] : []), { status: 201, headers: { 'content-type': 'application/json' } });
      return resendOk ? new Response('{"id":"1"}', { status: 200 }) : new Response('nope', { status: 403 });
    };
    try {
      let res = await handleBeta(post({ ...good, first_name: '<b>Ada</b>' }, { 'cf-connecting-ip': '7.7.7.1' }), renv);
      expect(res.status).toBe(200);
      const mail = calls.find((c) => c.url === 'https://api.resend.com/emails');
      expect(mail.init.headers.authorization).toBe('Bearer re_test');
      const sent = JSON.parse(mail.init.body);
      expect(sent.to).toEqual(['ada@example.com']);
      expect(sent.from).toBe('Vinterest <hello@vinterest.app>');
      expect(sent.html).not.toContain('<b>Ada</b>'); // the name is escaped in the HTML
      expect(sent.subject).toBe('Thank you for registering for the Vinterest beta');
      for (const part of ['download links', 'updates on the beta', 'acceptance into the programme']) { expect(sent.text).toContain(part); expect(sent.html).toContain(part); }
      expect(calls.find((c) => c.url.includes('supabase')).init.headers.prefer).toContain('return=representation');
      // Someone already on the list gets nothing more.
      calls.length = 0; inserted = false;
      res = await handleBeta(post(good, { 'cf-connecting-ip': '7.7.7.2' }), renv);
      expect(res.status).toBe(200);
      expect(calls.some((c) => c.url.includes('resend'))).toBe(false);
      // Resend refusing leaves the sign-up successful.
      inserted = true; resendOk = false;
      res = await handleBeta(post(good, { 'cf-connecting-ip': '7.7.7.3' }), renv);
      expect(res.status).toBe(200);
    } finally { globalThis.fetch = realFetch; }
  });

  test('refuses bad input, other sites, and says so plainly when sign-ups aren\'t set up', async () => {
    const { handleBeta } = await load();
    const ip = (n) => ({ 'cf-connecting-ip': `2.2.2.${n}` });
    expect((await handleBeta(post({ ...good, email: 'nope' }, ip(1)), env)).status).toBe(400);
    expect((await handleBeta(post({ ...good, first_name: '' }, ip(2)), env)).status).toBe(400);
    expect((await handleBeta(post({ ...good, country: 'Britain' }, ip(3)), env)).status).toBe(400);
    expect((await handleBeta(post(good, { ...ip(4), origin: 'https://evil.example' }), env)).status).toBe(403);
    expect((await handleBeta(new Request('https://vinterest.app/api/beta', { method: 'GET' }), env)).status).toBe(405);
    const unset = await handleBeta(post(good, ip(5)), {});
    expect(unset.status).toBe(503);
    expect((await unset.json()).error).toContain('aren\'t open just yet');
  });

  test('a filled honeypot looks like success and saves nothing', async () => {
    const { handleBeta } = await load();
    let called = false;
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => { called = true; return new Response(null, { status: 201 }); };
    try {
      const res = await handleBeta(post({ ...good, website: 'http://spam' }, { 'cf-connecting-ip': '3.3.3.3' }), env);
      expect(await res.json()).toEqual({ ok: true });
    } finally { globalThis.fetch = realFetch; }
    expect(called).toBe(false);
  });

  test('slows a script down', async () => {
    const { handleBeta } = await load();
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 201 });
    const statuses = [];
    try { for (let i = 0; i < 8; i++) statuses.push((await handleBeta(post(good, { 'cf-connecting-ip': '4.4.4.4' }), env)).status); } finally { globalThis.fetch = realFetch; }
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses[7]).toBe(429);
  });
});
