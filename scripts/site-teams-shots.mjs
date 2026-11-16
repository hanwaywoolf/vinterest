// Retakes the Teams website's pictures of the console from the app as it is now: `npm run site:teams:shots`.
// The site's phones run the app's own code (live.js), so they follow the app at every build. The laptop's console
// scenes are pictures, and went stale each time the console changed until someone retook them by hand. This takes
// every one from the built app on the demo restaurant (The Larkspur), with no network, and writes their sizes and
// taps to site/teams/img/scenes/sizes.json, which the site build puts into the page (%%SCENE_SIZES%%), so a
// taller Dashboard or a moved row needs no edit to index.html.
//
// What it takes (site/teams/img/scenes/), for the console with its navigation across the top:
//   nav-<section>.jpg   the bar across the top with that section lit (it stays put while the page scrolls)
//   <section>.jpg       the section's whole page under the bar (dash, sales, team, training, wines, menu)
//   card-bg, dish-bg    the laptop's screen with a wine's or a dish's drawer open; card, dish: the drawer's whole text
//   mgr.jpg             the Dashboard at a tablet's width, for the strip that scrolls it
// sizes.json holds each picture's height, the bar's height (nav), and for each drawer the row that opens it:
// how far down its page the scene scrolls first (cardAt, dishAt, a share of the scroll), where the tap lands
// (cardTap, dishTap) and where the drawer sits (cardX, cardW).
// Run it after any change to the console, look at the pictures (git status shows which moved), then
// npm run site:teams:build. tests/teams-site.spec.js fails if a size in the page and its picture disagree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'site/teams/img/scenes');
const SW = 1440, SH = 900, MW = 820; // the laptop's screen; the width the manager strip's Dashboard is taken at
const SECTIONS = ['dash', 'sales', 'team', 'training', 'wines', 'menu'];
execSync('node scripts/build.mjs', { cwd: ROOT, stdio: 'ignore' });
const port = 4196, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch(), sizes = {};
try {
  const ctx = await browser.newContext({ viewport: { width: SW, height: SH }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { window.VINTEREST_TOUR = 'off'; });
  for (const p of ['**/claude', '**/tts', '**/stt']) await ctx.route(p, (r) => r.fulfill({ status: 503, body: '{}' }));
  await ctx.route('**/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  const shot = (name, clip) => page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 86, clip });
  const size = (w, h) => page.setViewportSize({ width: w, height: h }).then(() => page.waitForTimeout(300));
  const nav = async (k) => { await page.getByTestId('console-nav-' + k).click(); await page.waitForTimeout(600); };
  // What scrolls under a point: its nearest scrolling ancestor. {top, height} of its box and how tall its content is.
  const MARK = 'data-shot-scroller';
  const scroller = (x, y) => page.evaluate(([x, y, MARK]) => { document.querySelectorAll(`[${MARK}]`).forEach((e) => e.removeAttribute(MARK));
    let el = document.elementFromPoint(x, y); while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) break; el = el.parentElement; }
    if (!el || el === document.body) el = document.scrollingElement; el.setAttribute(MARK, '1'); const r = el.getBoundingClientRect();
    return { top: Math.max(0, Math.round(r.top)), box: Math.round(el.clientHeight), content: el.scrollHeight }; }, [x, y, MARK]);
  const scrollTo = (y) => page.evaluate(([y, MARK]) => { const el = document.querySelector(`[${MARK}]`); el.scrollTop = y; return el.scrollTop; }, [y, MARK]);
  // A whole scrolling area in one picture: the window is made tall enough to hold it, so nothing is stitched.
  // The bar across the top: the pinned ancestor of the navigation, which stays while the page scrolls under it.
  const bar = () => page.evaluate(() => { const el = document.querySelector('[data-testid="c2-top"]'); return el ? Math.round(el.getBoundingClientRect().bottom) : 0; });
  const whole = async (name, x, w, at, skip = 0) => {
    const width = page.viewportSize().width; let h = SH, s;
    for (let i = 0; i < 5; i++) { s = await scroller(...at); await scrollTo(0); const need = s.top + s.content; if (need <= h) break; h = need; await size(width, h); }
    skip = Math.max(0, skip - s.top); // the bar's own height, where the page's scroll starts above it
    await shot(name, { x, y: s.top + skip, width: w, height: s.content - skip }); sizes[name] = s.content - skip; console.log(`${name}.jpg ${w}×${s.content - skip}`);
    await size(width, SH); return s;
  };

  await page.goto(`http://localhost:${port}/team/?seed=demo&view=console`);
  await page.getByTestId('console-nav-dash').waitFor();
  // Tonight as a working restaurant would have it: two dishes off and two wines on feature.
  await page.evaluate(() => { const ds = TeamData.dishes(), ws = TeamData.wines().filter((w) => TeamData.byGlass(w));
    TeamData.setTonight({ off: [ds[2], ds[9]].filter(Boolean).map((x) => x.id), feature: [ws[0], ws[4]].filter(Boolean).map((w) => w.id), note: '' }); });
  await page.waitForTimeout(600);
  sizes.look = await page.evaluate(() => (TeamData.consoleLook ? TeamData.consoleLook() : 'classic'));

  for (const k of SECTIONS) {
    await size(SW, SH); if (!(await page.getByTestId('console-nav-' + k).count())) { console.log(`no ${k} section in this console`); continue; }
    await nav(k);
    sizes.nav = await bar(); await shot('nav-' + k, { x: 0, y: 0, width: SW, height: sizes.nav });
    await whole(k, 0, SW, [SW / 2, SH * 0.6], sizes.nav);
  }

  // A drawer: the page scrolled until its row is in view, the row tapped, the screen with the drawer open, then the
  // drawer's whole text.
  const drawer = async (k, name, pick) => {
    await size(SW, SH); await nav(k);
    const s = await scroller(SW / 2, SH * 0.6); await scrollTo(0);
    const label = await page.evaluate(pick), row = page.getByText(label, { exact: true }).first(); let b = await row.boundingBox();
    const want = Math.max(0, Math.round(b.y - SH * 0.45)), got = await scrollTo(want); await page.waitForTimeout(300); b = await row.boundingBox();
    sizes[name + 'At'] = +(got / Math.max(1, s.content - s.box)).toFixed(4);
    sizes[name + 'Tap'] = { x: Math.round(b.x + Math.min(b.width / 2, 90)), y: Math.round(b.y + b.height / 2) };
    await row.click(); const panel = page.getByTestId('console-panel'); await panel.waitFor(); await page.waitForTimeout(700);
    await shot(name + '-bg', { x: 0, y: 0, width: SW, height: SH });
    const box = await panel.boundingBox(); sizes[name + 'X'] = Math.round(box.x); sizes[name + 'W'] = Math.round(box.width);
    await whole(name, Math.round(box.x), Math.round(box.width), [box.x + box.width / 2, SH * 0.6]);
    await page.getByTestId('console-panel-close').click().catch(() => {}); await page.waitForTimeout(300);
  };
  await drawer('wines', 'card', () => { const w = TeamData.wines()[0]; return [w.producer, w.name].filter(Boolean).join(' '); });
  await drawer('menu', 'dish', () => { const d = TeamData.dishes().slice(0, 8).find((x, i) => i >= 2 && !TeamData.isOff(x.id) && TeamData.pairing(x.id) && TeamData.dishCard(x.id)) || TeamData.dishes()[0]; return d.name; });

  // The Dashboard at a tablet's width, for the strip that scrolls through it.
  await size(MW, SH); await nav('dash');
  sizes.mgrW = MW; sizes.mgrNav = await bar(); await shot('nav-mgr', { x: 0, y: 0, width: MW, height: sizes.mgrNav }); await whole('mgr', 0, MW, [MW / 2, SH * 0.6], sizes.mgrNav);

  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('sizes.json', JSON.stringify(sizes));
  if (errors.length) { console.log('Page errors while taking them:', errors.slice(0, 3)); process.exitCode = 1; }
} finally { await browser.close(); server.kill(); }
