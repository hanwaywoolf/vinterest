// The comparison block's pictures of Vinterest (site/shots/*.jpg): the app's real screens, taken from
// the website's own demo phones on the built site, so they are what a visitor sees further down the page.
// Run after a change to those screens: `npm run site:build && npm run site:shots`.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site/shots');
const PORT = 4631;
// name, the section, which caption to hold, and how long that screen takes to finish drawing.
const SHOTS = [
  ['match', 'scan', 1, 9000],
  ['portrait', 'winedna', 1, 7000],
  ['learn', 'learn', 2, 9000],
  ['knows', 'winedna', 6, 9000],
];

fs.mkdirSync(OUT, { recursive: true });
const server = spawn('node', ['scripts/serve.mjs', 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  for (const [name, id, cap, wait] of SHOTS) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
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
} finally {
  await browser.close();
  server.kill();
}
