// The comparison block's pictures of Vinterest (site/shots/*.jpg): the app's real screens, taken from
// the website's own demo phones on the built site, so they are what a visitor sees further down the page.
// Run after a change to those screens: `npm run site:build && npm run site:shots`.
// Most of them are only what shows until the comparison's own phone starts playing over the picture (and all that shows with
// reduced motion): those in VS are taken from that phone itself, a moment into its loop, so the picture is where it begins.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site/shots');
const PORT = 4631;
// name, the section whose phone shows it, which caption to hold, how long that screen takes to settle,
// and (for a screen no section plays) the demo kind to put in that phone instead.
const SHOTS = [
  ['match', 'scan', 1, 9000],
  ['why', 'learn-wine', 0, 5000],
  ['knows', 'winedna', 6, 3500],
  ['portrait', 'winedna', 2, 4500],
  ['script', 'winedna', 3, 7000],
  ['hub', 'learn', 0, 2500],
  ['vinny', 'vinny', 1, 13000],
  ['quiz', 'learn', 0, 5000, 'quiz'],
  ['palate', 'mastery', 2, 5500],
  ['blind', 'learn-wine', 4, 19000],
];

// name, the comparison's tab, which of its phones, and how far into its loop.
const VS = [
  ['rules', 1, 0, 2500],
  ['article', 2, 1, 2500],
  ['mastery', 3, 1, 2500],
  ['map', 3, 2, 3200],
];

fs.mkdirSync(OUT, { recursive: true });
const server = spawn('node', ['scripts/serve.mjs', 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const only = process.argv.slice(2);
  for (const [name, id, cap, wait, kind] of SHOTS.filter((s) => !only.length || only.includes(s[0]))) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    // A screen no section plays: the page is served with that section's phone asking for it instead.
    if (kind) await page.route(`http://localhost:${PORT}/`, async (route) => {
      const res = await route.fetch(), html = await res.text();
      const at = html.indexOf(`id="${id}"`), from = html.indexOf('data-demo="', at);
      await route.fulfill({ response: res, body: html.slice(0, from) + `data-demo="${kind}"` + html.slice(html.indexOf('"', from + 11) + 1) });
    });
    await page.goto(`http://localhost:${PORT}/`);
    const show = () => page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'start', behavior: 'instant' }), id);
    await show();
    await page.waitForSelector(`#${id} .phone-app > *`, { timeout: 30000 });
    await page.locator(`#${id} .steps li`).nth(cap).click();
    await show();
    await page.waitForTimeout(wait);
    await show();
    await page.locator(`#${id} .phone-screen`).screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`site/shots/${name}.jpg`);
    await page.close();
  }
  for (const [name, tab, n, wait] of VS.filter((s) => !only.length || only.includes(s[0]))) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 3 });
    await page.goto(`http://localhost:${PORT}/`);
    const show = () => page.evaluate(() => document.getElementById('vs').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await show();
    await page.locator('#vs [role=tab]').nth(tab).click();
    const fig = page.locator('#vs .vs-panel:not([hidden]) .vs-ph').nth(n);
    await fig.locator('.phone-app > *').first().waitFor({ timeout: 30000 });
    await page.waitForTimeout(wait);
    await show();
    await fig.locator('.phone-screen').screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 });
    console.log(`site/shots/${name}.jpg`);
    await page.close();
  }
} finally {
  await browser.close();
  server.kill();
}
