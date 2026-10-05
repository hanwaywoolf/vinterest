// Renders the dinner-table film (site/video/dinner.html) to video/dinner-table.webm: an animated scene of a
// table that won't touch the wine list until one diner scans it with Vinterest, with the app's own screens
// in the phone. Run after `npm run site:build`: `npm run site:video`. 1080 x 1920, 25 fps, no sound.
// It is rendered a frame at a time against a paused browser clock (Playwright's clock), so the result
// doesn't depend on how fast this machine is. Each frame is a JPEG piped straight into the ffmpeg that
// Playwright ships (it only reads piped JPEGs and writes VP8 WebM, so that's the route).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 4179, FPS = 25;
// `npm run site:video` renders the dinner-table film; `npm run site:video scan-demo` the label-scan walkthrough.
const NAME = process.argv[2] || 'dinner';
const OUT = { dinner: 'dinner-table', 'scan-demo': 'scan-demo' }[NAME];
if (!OUT) throw new Error('Unknown film: ' + NAME);
const FFMPEG = fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('ffmpeg')).map((d) => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || 'ffmpeg';
fs.mkdirSync(path.join(ROOT, 'video'), { recursive: true });
fs.copyFileSync(path.join(ROOT, `site/video/${NAME}.html`), path.join(ROOT, `site-dist/${NAME}.html`));
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto(`http://localhost:${PORT}/${NAME}.html`);
  await page.waitForFunction(() => window.__ready && window.__ready(), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
  await page.clock.runFor(1000); // the first screens settle
  await page.evaluate(() => window.__start());
  const end = await page.evaluate(() => window.__END);
  const n = Math.ceil((end + 1) * FPS);
  const out = path.join(ROOT, `video/${OUT}.webm`);
  const enc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '6M', '-crf', '8', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => { enc.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))); enc.on('error', rej); });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    await page.clock.runFor(1000 / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    if (i % 50 === 0) console.log(`frame ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  enc.stdin.end();
  await done;
  console.log(`Saved video/${OUT}.webm (${n} frames, ${(n / FPS).toFixed(1)}s)`);
} finally {
  fs.rmSync(path.join(ROOT, `site-dist/${NAME}.html`), { force: true });
  await browser.close();
  server.kill();
}
