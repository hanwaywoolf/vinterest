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
    // The first tile is the start of the scan story: the wine, then its match a few seconds in.
    const hero = page.locator('.hero .phone-app');
    // The bottle in the hero's camera is another vintage of the sample user's favourite, so its match is high and says why.
    await expect(hero).toContainText('Viña Ardanza Reserva 2020');
    await expect(hero).toContainText('Likely a favourite', { timeout: 25000 });
    await expect(hero).toContainText('You gave the 2016 a 94', { timeout: 10000 });
    expect(errors).toEqual([]);
  });

  test('a section plays through its captions by itself, once, and a click on the words stops it', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'scan');
    await expect(page.locator('#scan .phone-app')).toContainText('Crozes-Hermitage 2021');
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Who made it, and when to drink it');
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Whether it\'s for you', { timeout: 6000 });
    // It finishes and stays on the last caption; it does not start again.
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Save it, and go deeper', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('Save it, and go deeper');
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
    // Six parts: the scan and its match, then WineDNA, Learn, Vinny and My Wines.
    await expect(page.locator('.hero .prog button')).toHaveCount(6);
    await expect(page.locator('.hero .stage .cap')).toHaveText("Scan any bottle's label.");
    // The first part's reading time starts once the camera has scanned the bottle (the camera keeps its own time).
    await expect(page.locator('.hero .stage .cap')).toHaveText("See if it's for you.", { timeout: 14000 });
    await expect(page.locator('.hero .stage .cap')).toHaveText('Every bottle builds your WineDNA.', { timeout: 12000 });
    await expect(page.locator('.hero [data-layer="dna"]')).toContainText('WineDNA');
    await page.locator('.hero .arrow.next').click();
    const at = await page.locator('.hero .stage .cap').textContent();
    await page.waitForTimeout(2500);
    await expect(page.locator('.hero .stage .cap')).toHaveText(at); // stopped turning
    await page.locator('.hero .prog button').first().click();
    await expect(page.locator('.hero .phone-app')).toContainText('Viña Ardanza Reserva 2020');
  });

  test('a caption stops the autoplay and holds the scan story on that scene', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'scan');
    const phone = page.locator('#scan .phone-app');
    await jump(page, 'scan', 2);
    await expect(page.locator('#scan .steps li.on h3')).toHaveText('How it will taste');
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'taste', { timeout: 8000 });
    await expect(phone).toContainText('Blackberry');
    // The story would move on by itself after the scene's reading time; held, it doesn't.
    await page.waitForTimeout(6000);
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'taste');
    await jump(page, 'scan', 0);
    await expect(phone.locator('[data-testid="reveal-scene"]')).toHaveAttribute('data-scene', 'label', { timeout: 8000 });
  });

  test('the wheel over the text scrolls the page and never moves the demo', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'learn-wine');
    await jump(page, 'learn-wine', 0);
    const first = await page.locator('#learn-wine .steps li.on h3').textContent();
    const copy = await page.locator('#learn-wine .copy').boundingBox();
    await page.mouse.move(copy.x + 100, copy.y + 100);
    const y0 = await page.evaluate(() => scrollY);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 100); await page.waitForTimeout(60); }
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y0 + 300);
    await expect(page.locator('#learn-wine .steps li.on h3')).toHaveText(first);
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
    // One caption for the grape and the region: the grape's scene, then on to the map.
    await jump(page, 'scan', 3);
    await expect(scene).toHaveAttribute('data-scene', 'grape', { timeout: 8000 });
    await expect(scene).toHaveAttribute('data-scene', 'place', { timeout: 14000 });
    await expect(phone).toContainText('Rhône Valley', { timeout: 8000 });
    await jump(page, 'scan', 4);
    await expect(scene).toHaveAttribute('data-scene', 'say', { timeout: 8000 });
    await jump(page, 'scan', 5);
    // The story ends on the rating, with a way to skip it.
    await expect(phone).toContainText('How was it?', { timeout: 8000 });
    await expect(phone).toContainText('Skip the rating');
  });

  test('the deck turns through its cards: the house, the year, how it is made, the region, the table, the tasting cues', async ({ page }) => {
    await page.goto(BASE + '/');
    await show(page, 'learn-wine');
    const phone = page.locator('#learn-wine .phone-app');
    await expect(phone).toContainText('Your match');
    await jump(page, 'learn-wine', 1);
    await expect(phone).toContainText('The house');
    await expect(phone).toContainText('Alain Graillot');
    // The same part goes on to the year: the next card of the deck.
    await expect(phone).toContainText('The year', { timeout: 8000 });
    await jump(page, 'learn-wine', 2);
    await expect(phone).toContainText('How it\'s made');
    // The region card reads on down.
    await expect(phone).toContainText('The region', { timeout: 12000 });
    await expect.poll(() => scrolledPx(page, 'learn-wine'), { timeout: 12000 }).toBeGreaterThan(40);
    // At the table, then the tasting cues.
    await jump(page, 'learn-wine', 3);
    await expect(phone).toContainText('At the table');
    await expect(phone).toContainText('While you taste', { timeout: 10000 });
    await jump(page, 'learn-wine', 5);
    await expect(phone).toContainText('Next from here');
  });

  test('rating a bottle at the end of its story turns the dial up and saves it, then offers the ways out, without changing the other demos', async ({ page }) => {
    await page.goto(BASE + '/?speed=8');
    await show(page, 'scan');
    const phone = page.locator('#scan .phone-app');
    await jump(page, 'scan', 5);
    await show(page, 'scan');   // a demo only plays while its section is on screen, and the click may have scrolled the page
    await expect(phone).toContainText('How was it?', { timeout: 10000 });
    // (The dial is turned to 92 while the sheet is still arriving; on a busy machine a tap can land a point or two short, which a visitor never notices.)
    await expect(phone.locator('[role="slider"][aria-label="Rating"]')).toHaveAttribute('aria-valuenow', /^(90|91|92)$/, { timeout: 20000 });
    await jump(page, 'scan', 6);
    await expect(phone).toContainText(/Rated 9[0-2]/, { timeout: 8000 });
    // The three quick answers fill in as the caption plays.
    await expect(phone).toContainText('On your Buy again list', { timeout: 10000 });
    await expect(phone.locator('input[aria-label="What you paid"]')).toHaveValue('30', { timeout: 10000 });
    await expect(phone.locator('input[aria-label="Where did you have it"]')).toHaveValue("At a friend's dinner", { timeout: 10000 });
    // Then the ways out under the extras.
    const ways = phone.locator('[data-testid="reveal-ways"]');
    await expect(ways).toContainText('See the result and learn more', { timeout: 10000 });
    await expect(ways).toContainText('Finish');
    // Going back to the start puts the rating panel back.
    await jump(page, 'scan', 5);
    await expect(phone).toContainText('How was it?', { timeout: 10000 });
    // A saved rating stays in that demo: the WineDNA demo still counts the sample user's own bottles.
    await jump(page, 'scan', 6);
    await expect(phone).toContainText(/Rated 9[0-2]/, { timeout: 10000 });
    await show(page, 'winedna');
    await expect(page.locator('#winedna .phone-app')).toContainText('12 bottles scanned');
  });

  test('Blind Call plays on the taste card: three sliders, the call locked in, then the rating and its XP', async ({ page }) => {
    await page.goto(BASE + '/?speed=2');
    await show(page, 'learn-wine');
    const phone = page.locator('#learn-wine .phone-app');
    await jump(page, 'learn-wine', 4);
    await expect(phone).toContainText('Call it before you look', { timeout: 8000 });
    await expect(phone.locator('[role="slider"][aria-label="Body"]')).toHaveAttribute('aria-valuenow', /^5[5-9]$/, { timeout: 8000 });
    await expect(phone.locator('[role="slider"][aria-label="Tannins"]')).toHaveAttribute('aria-valuenow', /^(6[5-9]|7\d)$/, { timeout: 8000 });
    await expect(phone).toContainText('How you called it', { timeout: 8000 });
    // The rating and the XP are drawn inside the phone, not over the page.
    await expect(phone).toContainText('XP', { timeout: 8000 });
    await expect(phone).toContainText('% accurate');
    // Chosen again, it starts over.
    await jump(page, 'learn-wine', 4);
    await expect(phone).toContainText('Call it before you look', { timeout: 8000 });
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
    await expect(phone).toContainText('Your shape', { timeout: 10000 }); // the radar sits below the rating
    await jump(page, 'mastery', 1);
    await expect(phone.locator('[data-testid="grape-cluster"]')).toBeVisible({ timeout: 8000 }); // the sketched bunches
    await expect(phone).toContainText('Your wine map', { timeout: 12000 });   // the same caption plays on to the map
    // The map shows what the drinker has opened, not every region as a grey dot.
    await expect(phone.locator('[data-testid="region-map"] circle[fill="#CFC9C2"]').first()).toBeHidden();
    await jump(page, 'mastery', 2);
    await expect(phone).toContainText(/grippier/i, { timeout: 8000 }); // seven seeded Blind Calls: the tannins tile's habit
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
    await expect(phone).toContainText('Typical bottle price', { timeout: 20000 });
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
    await jump(page, 'scan', 6);
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
const FITS = ['scan', 'learn-wine', 'winedna', 'vinny', 'learn', 'mastery', 'my-wines'];
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

  test('nothing spills sideways, the phone is nearly as wide as the screen, and its caption floats once the phone is on screen', async ({ page }) => {
    await page.goto(BASE + '/');
    for (const id of FITS) {
      const b = await page.evaluate((id) => {
        const r = (q) => document.querySelector(q).getBoundingClientRect();
        return { wide: document.documentElement.scrollWidth <= window.innerWidth + 1, vw: window.innerWidth, sec: r(`#${id}`), h2: r(`#${id} h2`), phone: r(`#${id} .phone`), steps: r(`#${id} .steps`) };
      }, id);
      expect(b.wide, id).toBe(true);
      // A phone the page scrolls past, not the sliver that fits under a heading in one screen-height.
      expect(b.phone.width, `${id} phone width`).toBeGreaterThan(b.vw * 0.8);
      expect(b.phone.top, id).toBeGreaterThanOrEqual(b.h2.bottom - 2);
      expect(b.phone.bottom, id).toBeLessThanOrEqual(b.sec.bottom + 2);
    }
    // Before a section's phone is on screen its caption is held back; with the phone in view it floats at the foot of the screen.
    await page.evaluate(() => document.getElementById('scan').scrollIntoView({ block: 'end', behavior: 'instant' }));
    await page.evaluate(() => window.scrollBy(0, -(document.getElementById('scan').offsetHeight - 80)));
    await expect(page.locator('#scan')).not.toHaveClass(/capon/);
    await page.evaluate(() => document.querySelector('#scan .stage').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await expect(page.locator('#scan')).toHaveClass(/capon/);
    await expect(page.locator('#scan .steps li.on h3')).toBeVisible();
    await page.waitForTimeout(500); // the card settles into place
    const cap = await page.evaluate(() => { const r = document.querySelector('#scan .steps').getBoundingClientRect(); return { bottom: r.bottom, vh: window.innerHeight }; });
    expect(cap.bottom).toBeLessThanOrEqual(cap.vh);
    expect(cap.bottom).toBeGreaterThan(cap.vh - 40);
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

test.describe('the hero\'s opening', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });

  test('the hero opens on the camera with a bottle in the frame, then lifts away to the story the scan found', async ({ page }) => {
    await page.goto(BASE + '/');
    const cam = page.locator('#hero-cam');
    await expect(cam).toBeVisible();
    // A photo of the bottle, not a drawing, and it has loaded.
    const img = cam.locator('img.cam-bottle');
    await expect(img).toBeVisible();
    expect(await img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
    // The camera stays long enough to frame the label, find its focus and read it, then the story plays from its first scene.
    await page.waitForTimeout(5000);
    await expect(cam).toBeVisible();
    await expect(cam).toBeHidden({ timeout: 9000 });
    const scene = page.locator('.hero [data-testid="reveal-scene"]');
    await expect(scene).toHaveAttribute('data-scene', 'label');
    // The match is given time to finish: its ring fills and its verdict and reason are up while the tile is still showing.
    await expect(scene).toHaveAttribute('data-scene', 'match', { timeout: 12000 });
    await expect(page.locator('.hero .phone-app')).toContainText('Likely a favourite', { timeout: 6000 });
    await page.waitForTimeout(3000);
    await expect(scene).toHaveAttribute('data-scene', 'match');
  });

  test('choosing the hero\'s first part plays the scan again, and the camera lifts onto the label scene', async ({ page }) => {
    await page.goto(BASE + '/');
    const cam = page.locator('#hero-cam');
    const scene = page.locator('.hero [data-testid="reveal-scene"]');
    await expect(cam).toBeHidden({ timeout: 14000 });
    // What the fade uncovered was the story's first scene, not one it had already moved on to.
    await expect(scene).toHaveAttribute('data-scene', 'label');
    const pills = page.locator('.hero [role="group"][aria-label="Steps"] button');
    // Another part puts the camera away; the first brings the scan back, from its start.
    await pills.nth(2).click();
    await expect(cam).toBeHidden();
    await pills.nth(0).click();
    await expect(cam).toBeVisible();
    await expect(cam.locator('.cam-pill .a')).toHaveCSS('opacity', '1');
    // Leaving mid-scan puts it away at once.
    await pills.nth(1).click();
    await expect(cam).toBeHidden();
    await pills.nth(0).click();
    await expect(cam).toBeVisible();
    await expect(cam).toBeHidden({ timeout: 12000 });
    await expect(scene).toHaveAttribute('data-scene', 'label');
    // Chosen by the reader, the part holds: the story waits on the label and the next pill carries it on to the match.
    await page.waitForTimeout(2500);
    await expect(scene).toHaveAttribute('data-scene', 'label');
    await pills.nth(1).click();
    await expect(scene).toHaveAttribute('data-scene', 'match', { timeout: 5000 });
    await expect(page.locator('.hero .phone-app')).toContainText('Likely a favourite', { timeout: 6000 });
    // Learn: the app's own Learn tab.
    await pills.nth(3).click();
    await expect(page.locator('.hero [data-layer="learn"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.hero [data-layer="learn"]')).toContainText('Learn', { timeout: 5000 });
  });

  test('the hero\'s entrance leaves everything in place', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('h1')).toContainText("Find wines you'll love. Learn while you sip");
    await page.waitForTimeout(2600);
    const seen = await page.evaluate(() => [...document.querySelectorAll('.hero h1 .w, .hero .lead, .hero .cta, .hero .phone-slot')].every((el) => getComputedStyle(el).opacity === '1'));
    expect(seen).toBe(true);
  });
});

/* The page as built before the apps were listed (APP_STORE_URL and PLAY_STORE_URL set empty): the beta form, not the stores. */
const unlisted = (page) => page.route((u) => u.origin === BASE && u.pathname === '/', async (route) => {
  const res = await route.fetch();
  const html = (await res.text()).replace(/data-ios-url="[^"]*"/, 'data-ios-url=""').replace(/data-android-url="[^"]*"/, 'data-android-url=""');
  await route.fulfill({ response: res, body: html });
});

test.describe('once the apps are listed', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36' });
  // The build writes the stores' links into the page (APP_STORE_URL and PLAY_STORE_URL, the listed apps by default).
  const live = async () => {};
  test('on a computer the form gives way to both stores and the buttons say to download', async ({ page }) => {
    await live(page);
    await page.goto(BASE + '/');
    await expect(page.locator('.hero .cta-main')).toHaveText('Download the app');
    await expect(page.locator('.top .cta-main')).toHaveText('Download now');
    // A computer has no store of its own: the buttons go to the download section, which shows both.
    await expect(page.locator('.hero .cta-main')).toHaveAttribute('href', '#beta');
    await expect(page.locator('#beta-form')).toBeHidden();
    await expect(page.locator('#store-ios')).toHaveAttribute('href', 'https://apps.apple.com/app/id6819741453');
    await expect(page.locator('#store-android')).toHaveAttribute('href', 'https://play.google.com/store/apps/details?id=app.vinterest');
    await expect(page.locator('#beta-h')).toContainText('Scan your first bottle tonight');
  });

  test('on a phone every main button goes straight to that phone\'s store', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
    const page = await ctx.newPage();
    await page.route('**/api/country', (r) => r.fulfill({ contentType: 'application/json', body: '{"country":"GB"}' }));
    await live(page);
    await page.goto(BASE + '/');
    await expect(page.locator('.hero .cta-main')).toHaveAttribute('href', 'https://apps.apple.com/app/id6819741453');
    await expect(page.locator('.top .cta-main')).toHaveText('Download now');
    await expect(page.locator('.top .cta-main')).toHaveAttribute('href', 'https://apps.apple.com/app/id6819741453');
    await ctx.close();
  });

  test('built without the store links, the page asks for beta sign-ups', async ({ page }) => {
    await unlisted(page);
    await page.goto(BASE + '/');
    await expect(page.locator('.hero .cta-main')).toHaveText('Join the beta');
    await expect(page.locator('#stores')).toBeHidden();
    await expect(page.locator('#beta-form')).toBeVisible();
  });
});

test.describe('beta form', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false, isMobile: false });
  // The form is what the page shows when it's built without the store links.
  test.beforeEach(async ({ page }) => { await unlisted(page); });

  test('asks for what is missing, and pre-selects the country', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('#b-country')).toHaveValue('GB');
    await page.locator('#b-country').selectOption('');
    await page.locator('#beta-go').click();
    await expect(page.locator('.err[data-for="first_name"]')).toHaveText('Add your first name.');
    await expect(page.locator('.err[data-for="country"]')).toHaveText('Pick your country.');
    await expect(page.locator('.err[data-for="platform"]')).toHaveText('Pick your phone.');
    await expect(page.locator('.err[data-for="email"]')).toContainText('doesn\'t look right');
  });

  test('sends the five fields and says thanks', async ({ page }) => {
    const sent = [];
    await page.route('**/api/beta', (r) => { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
    await page.goto(BASE + '/');
    await page.fill('#b-first', 'Ada');
    await page.fill('#b-last', 'Lovelace');
    await page.selectOption('#b-country', 'GB');
    await page.selectOption('#b-platform', 'ios');
    await page.fill('#b-email', 'ada@example.com');
    await page.locator('#beta-go').click();
    await expect(page.locator('#beta-thanks')).toBeVisible();
    await expect(page.locator('#beta-thanks')).toContainText('Thanks, Ada');
    expect(sent).toEqual([{ first_name: 'Ada', last_name: 'Lovelace', country: 'GB', platform: 'ios', email: 'ada@example.com', website: '', source: {} }]);
  });

  test('tells them which email to use for their phone: the Apple ID or the Google Play account', async ({ page }) => {
    await page.goto(BASE + '/');
    const hint = page.locator('#b-email-hint');
    await expect(hint).toContainText('Apple ID');
    await expect(hint).toContainText('Google Play');
    await expect(page.locator('#b-email')).toHaveAttribute('aria-describedby', 'b-email-hint');
    await page.selectOption('#b-platform', 'ios');
    await expect(hint).toHaveText(/Apple ID.*TestFlight/);
    await page.selectOption('#b-platform', 'android');
    await expect(hint).toHaveText(/Google account.*Google Play/);
    await page.selectOption('#b-platform', '');
    await expect(hint).toContainText('Apple ID');
  });

  test('sends where the visit came from: the link\'s UTM tags and the referring site', async ({ page }) => {
    const sent = [];
    await page.route('**/api/beta', (r) => { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' }); });
    await page.goto(BASE + '/?utm_source=instagram&utm_medium=social&utm_campaign=beta#beta', { referer: 'https://l.instagram.com/some/path?x=1' });
    await page.fill('#b-first', 'Ada'); await page.fill('#b-last', 'Lovelace'); await page.selectOption('#b-platform', 'android'); await page.fill('#b-email', 'ada@example.com');
    await page.locator('#beta-go').click();
    await expect(page.locator('#beta-thanks')).toBeVisible();
    expect(sent[0].source).toEqual({ utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'beta', referrer: 'https://l.instagram.com' });
  });

  test('shows the server\'s words when it can\'t save', async ({ page }) => {
    await page.route('**/api/beta', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Beta sign-ups aren\'t open just yet. Please check back soon."}' }));
    await page.goto(BASE + '/');
    await page.fill('#b-first', 'Ada'); await page.fill('#b-last', 'Lovelace'); await page.selectOption('#b-platform', 'android'); await page.fill('#b-email', 'ada@example.com');
    await page.locator('#beta-go').click();
    await expect(page.locator('#beta-fail')).toContainText('aren\'t open just yet');
    await expect(page.locator('#beta-go')).toBeEnabled();
  });
});

test.describe('search engines', () => {
  test('the page carries its structured data, with the FAQ exactly as the page says it', async ({ page }) => {
    await page.goto(BASE + '/');
    const data = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    const types = data['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'MobileApplication', 'FAQPage']);
    const faq = data['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity;
    const shown = await page.locator('.faq details').evaluateAll((ds) => ds.map((d) => ({ q: d.querySelector('summary').textContent.trim(), a: d.querySelector('p').textContent.replace(/\s+/g, ' ').trim() })));
    expect(faq.map((x) => ({ q: x.name, a: x.acceptedAnswer.text }))).toEqual(shown);
    await expect(page).toHaveTitle(/wine scanner app/);
  });

  test('the sitemap lists only pages that may be indexed, and robots.txt points to it', async ({ request }) => {
    const map = await (await request.get(BASE + '/sitemap.xml')).text();
    expect(map).toContain('<loc>https://vinterest.app/</loc>');
    expect(map).not.toContain('/privacy/');
    expect(await (await request.get(BASE + '/robots.txt')).text()).toContain('Sitemap: https://vinterest.app/sitemap.xml');
  });

  test('www redirects to the bare domain, and preview hosts are kept out of search', async () => {
    const { default: worker } = await load();
    const env = { ASSETS: { fetch: async () => new Response('<html></html>', { headers: { 'content-type': 'text/html' } }) } };
    const www = await worker.fetch(new Request('https://www.vinterest.app/privacy/?a=1'), env);
    expect(www.status).toBe(301);
    expect(www.headers.get('location')).toBe('https://vinterest.app/privacy/?a=1');
    expect((await worker.fetch(new Request('https://vinterest.app/'), env)).headers.get('x-robots-tag')).toBeNull();
    expect((await worker.fetch(new Request('https://abc123.vinterest-site.pages.dev/'), env)).headers.get('x-robots-tag')).toBe('noindex');
  });
});

test.describe('legal pages', () => {
  test('privacy and terms exist, say what the app does, and have no draft banner or leftover [brackets]', async ({ page }) => {
    const heading = { '/privacy/': 'What is sent to an AI service', '/terms/': 'Subscriptions' };
    for (const p of ['/privacy/', '/terms/']) {
      await page.goto(BASE + p);
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.draft')).toHaveCount(0);
      await expect(page.locator('body')).not.toContainText('[');
      await expect(page.getByRole('heading', { name: heading[p] })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
    }
    // The auto-renewal wording Apple asks for, and the way to cancel.
    await expect(page.locator('body')).toBeVisible();
    await page.goto(BASE + '/terms/');
    await expect(page.locator('body')).toContainText('cancel it at least 24 hours before the period ends');
    await expect(page.locator('body')).toContainText('Manage subscription');
  });
});

test.describe('vinterest.app/get', () => {
  test('sends an iPhone to the App Store, an Android phone to Google Play and anything else to the download section', async () => {
    const { handleGet } = await load();
    const go = (ua, env) => handleGet(new Request('https://vinterest.app/get', { headers: { 'user-agent': ua } }), env);
    const iphone = go('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(iphone.status).toBe(302);
    expect(iphone.headers.get('location')).toBe('https://apps.apple.com/app/id6819741453');
    expect(iphone.headers.get('cache-control')).toBe('no-store');
    expect(go('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)').headers.get('location')).toBe('https://apps.apple.com/app/id6819741453');
    expect(go('Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36').headers.get('location')).toBe('https://play.google.com/store/apps/details?id=app.vinterest');
    expect(go('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)').headers.get('location')).toBe('https://vinterest.app/#beta');
    // The stores' addresses can be changed on Cloudflare without a deploy.
    expect(go('Mozilla/5.0 (Linux; Android 15)', { PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=x' }).headers.get('location')).toBe('https://play.google.com/store/apps/details?id=x');
  });
});

test.describe('the sign-up Worker', () => {
  const post = (body, headers = {}) => new Request('https://vinterest.app/api/beta', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.app', ...headers }, body: JSON.stringify(body) });
  const good = { first_name: ' Ada ', last_name: 'Lovelace', country: 'gb', platform: 'iOS', email: ' Ada@Example.COM ', website: '' };
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
    expect(JSON.parse(calls[0].init.body)).toEqual({ first_name: 'Ada', last_name: 'Lovelace', country: 'GB', platform: 'ios', email: 'ada@example.com' });
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
      // Only the person is emailed until BETA_NOTIFY_TO is set.
      expect(calls.filter((c) => c.url.includes('resend'))).toHaveLength(1);
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

  test('keeps where a sign-up came from: the referring host only, the UTM tags, and nothing for its own pages', async () => {
    const { handleBeta } = await load();
    const realFetch = globalThis.fetch;
    const rows = [];
    globalThis.fetch = async (url, init) => { if (String(url).includes('supabase')) rows.push(JSON.parse(init.body)); return new Response(null, { status: 201 }); };
    try {
      await handleBeta(post({ ...good, source: { referrer: 'https://www.Google.com/search?q=private', utm_source: ' Instagram ', utm_medium: 'social', utm_campaign: 'Beta', extra: 'x' } }, { 'cf-connecting-ip': '9.9.9.1' }), env);
      await handleBeta(post({ ...good, source: { referrer: 'https://vinterest.app/' } }, { 'cf-connecting-ip': '9.9.9.2' }), env);
      await handleBeta(post({ ...good, source: { referrer: 'javascript:alert(1)' } }, { 'cf-connecting-ip': '9.9.9.3' }), env);
      await handleBeta(post(good, { 'cf-connecting-ip': '9.9.9.4' }), env);
    } finally { globalThis.fetch = realFetch; }
    expect(rows[0]).toMatchObject({ referrer: 'google.com', utm_source: 'instagram', utm_medium: 'social', utm_campaign: 'beta' });
    expect(rows[0].extra).toBeUndefined();
    for (const r of rows.slice(1)) for (const k of ['referrer', 'utm_source', 'utm_medium', 'utm_campaign']) expect(r[k]).toBeUndefined();
  });

  test('tells the team about a new sign-up when BETA_NOTIFY_TO is set, with everything the form collected', async () => {
    const { handleBeta } = await load();
    const nenv = { ...env, RESEND_API_KEY: 're_test', BETA_NOTIFY_TO: 'me@example.com' };
    const realFetch = globalThis.fetch;
    const calls = [];
    let inserted = true;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('supabase')) return new Response(JSON.stringify(inserted ? [{ email: 'ada@example.com' }] : []), { status: 201, headers: { 'content-type': 'application/json' } });
      return new Response('{"id":"1"}', { status: 200 });
    };
    try {
      let res = await handleBeta(post({ ...good, last_name: '<i>Lovelace</i>' }, { 'cf-connecting-ip': '8.8.8.1' }), nenv);
      expect(res.status).toBe(200);
      const mails = calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.init.body));
      expect(mails).toHaveLength(2);
      const notice = mails.find((m) => m.to[0] === 'me@example.com');
      expect(notice.subject).toBe('Beta sign-up: Ada <i>Lovelace</i> (iPhone (iOS), GB)');
      expect(notice.reply_to).toBe('ada@example.com');
      for (const part of ['Ada <i>Lovelace</i>', 'ada@example.com', 'GB', 'iPhone (iOS)', 'Came from: direct']) expect(notice.text).toContain(part);
      expect(notice.html).toContain('&lt;i&gt;Lovelace&lt;/i&gt;');
      expect(notice.html).not.toContain('<i>Lovelace</i>');
      // A sign-up from a tagged link says where it came from.
      calls.length = 0;
      await handleBeta(post({ ...good, email: 'grace@example.com', source: { utm_source: 'instagram', utm_medium: 'social', referrer: 'https://l.instagram.com' } }, { 'cf-connecting-ip': '8.8.8.3' }), nenv);
      const tagged = calls.filter((c) => c.url === 'https://api.resend.com/emails').map((c) => JSON.parse(c.init.body)).find((m) => m.to[0] === 'me@example.com');
      expect(tagged.text).toContain('Came from: instagram / social via l.instagram.com');
      // A repeat sign-up tells no one.
      calls.length = 0; inserted = false;
      res = await handleBeta(post(good, { 'cf-connecting-ip': '8.8.8.2' }), nenv);
      expect(res.status).toBe(200);
      expect(calls.some((c) => c.url.includes('resend'))).toBe(false);
    } finally { globalThis.fetch = realFetch; }
  });

  test('refuses bad input, other sites, and says so plainly when sign-ups aren\'t set up', async () => {
    const { handleBeta } = await load();
    const ip = (n) => ({ 'cf-connecting-ip': `2.2.2.${n}` });
    expect((await handleBeta(post({ ...good, email: 'nope' }, ip(1)), env)).status).toBe(400);
    expect((await handleBeta(post({ ...good, first_name: '' }, ip(2)), env)).status).toBe(400);
    expect((await handleBeta(post({ ...good, country: 'Britain' }, ip(3)), env)).status).toBe(400);
    expect((await handleBeta(post({ ...good, platform: 'windows' }, ip(6)), env)).status).toBe(400);
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
