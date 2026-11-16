// Retakes the Teams website's pictures of the console from the app as it is now: `npm run site:teams:shots`.
// The site's phones run the app's own code (live.js), so they follow the app at every build. The laptop's console
// scenes are pictures, and went stale each time the console changed until someone retook them by hand. This takes
// every one from the built app on the demo restaurant (The Larkspur), with no network, and writes their sizes and
// the two taps to site/teams/img/scenes/sizes.json, which the site build puts into the page (%%SCENE_SIZES%%), so
// a taller Dashboard or a moved row needs no edit to index.html.
//
// What it takes (site/teams/img/scenes/): each section's whole page at the laptop's width (dash, sales, team,
// wines, menu), the sidebar with each section lit, a wine's and a dish's drawer (card, dish) over its page
// (card-bg, dish-bg), and the Dashboard at the narrow width the "manager" strip shows (mgr).
// Run it after any change to the console, look at the pictures (git diff --stat shows which moved), then
// npm run site:teams:build. tests/teams-site.spec.js fails if a size in the page and its picture disagree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(ROOT, 'site/teams/img/scenes');
const SW = 1440, SH = 900, SB = 220, MW = 584, PW = 600; // laptop, its sidebar, the narrow dashboard, a drawer
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
  const nav = async (k) => { await page.getByTestId('console-nav-' + k).click(); await page.waitForTimeout(500); };
  // The element that scrolls the section: the nearest scrolling ancestor of something in the main column.
  const scroller = (x) => page.evaluateHandle((x) => { let el = document.elementFromPoint(x, 450); while (el && el !== document.body) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) return el; el = el.parentElement; } return document.scrollingElement; }, x);
  // A whole page in one picture: the window is made as tall as the page, so nothing is stitched.
  const whole = async (name, x, w) => {
    await page.setViewportSize({ width: page.viewportSize().width, height: SH }); await page.waitForTimeout(200);
    let h = SH;
    for (let i = 0; i < 4; i++) { const sc = await scroller(x + w / 2); const need = await sc.evaluate((el) => { el.scrollTop = 0; return Math.ceil(el.scrollHeight + (el.getBoundingClientRect().top || 0)); }); if (need <= h) break; h = need; await page.setViewportSize({ width: page.viewportSize().width, height: h }); await page.waitForTimeout(350); }
    await shot(name, { x, y: 0, width: w, height: h }); sizes[name] = h; console.log(`${name}.jpg ${w}×${h}`);
  };

  await page.goto(`http://localhost:${port}/team/?seed=demo&view=console`);
  await page.getByTestId('console-dash').waitFor();
  // Tonight as a working restaurant would have it: two dishes off and two wines on feature.
  await page.evaluate(() => { const ds = TeamData.dishes(), ws = TeamData.wines().filter((w) => TeamData.byGlass(w));
    TeamData.setTonight({ off: [ds[2], ds[9]].filter(Boolean).map((x) => x.id), feature: [ws[0], ws[4]].filter(Boolean).map((w) => w.id), note: '' }); });
  await page.waitForTimeout(600);

  for (const k of ['dash', 'sales', 'team', 'wines', 'menu']) {
    await page.setViewportSize({ width: SW, height: SH }); await nav(k);
    await shot('sidebar-' + k, { x: 0, y: 0, width: SB, height: SH });
    await whole(k, SB, SW - SB);
  }
  fs.copyFileSync(path.join(OUT, 'sidebar-dash.jpg'), path.join(OUT, 'sidebar.jpg'));

  // A drawer: the page with it open (the laptop's own size), then the drawer's whole content.
  const drawer = async (k, name, pick) => {
    await page.setViewportSize({ width: SW, height: SH }); await nav(k);
    const label = await page.evaluate(pick), row = page.getByText(label, { exact: true }).first();
    const b = await row.boundingBox(); if (b.y > SH - 60) console.log(`  ${label} is below the first screen: the tap would land off the picture`); sizes[name + 'Tap'] = { x: Math.round(b.x + Math.min(b.width / 2, 90)), y: Math.round(b.y + b.height / 2) };
    await row.click(); const panel = page.getByTestId('console-panel'); await panel.waitFor(); await page.waitForTimeout(700);
    await shot(name + '-bg', { x: 0, y: 0, width: SW, height: SH });
    const box = await panel.boundingBox(); if (Math.round(box.width) !== PW) console.log(`  the drawer is ${Math.round(box.width)}px wide, not ${PW}: the page's x and w for it need changing`);
    await whole(name, Math.round(box.x), Math.round(box.width));
    await page.setViewportSize({ width: SW, height: SH }); await page.getByTestId('console-panel-close').click().catch(() => {}); await page.waitForTimeout(300);
  };
  await drawer('wines', 'card', () => { const w = TeamData.wines()[0]; return [w.producer, w.name].filter(Boolean).join(' '); });
  await drawer('menu', 'dish', () => { const d = TeamData.dishes().slice(0, 6).find((x, i) => i >= 2 && TeamData.pairing(x.id) && TeamData.dishCard(x.id)) || TeamData.dishes()[0]; return d.name; /* near the top: the scene taps it without scrolling */ });

  // The Dashboard at the manager strip's width.
  await page.setViewportSize({ width: SB + MW, height: SH }); await nav('dash');
  await whole('mgr', SB, MW);

  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('sizes.json', JSON.stringify(sizes));
  if (errors.length) { console.log('Page errors while taking them:', errors.slice(0, 3)); process.exitCode = 1; }
} finally { await browser.close(); server.kill(); }
