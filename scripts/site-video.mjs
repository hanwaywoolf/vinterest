// Renders the website's films (site/video/<name>.html) to video/<out>.webm, 1080 x 1920, 25 fps, no sound:
//   npm run site:video                  the dinner-table film (an animated scene, with the app's screens in the phone)
//   npm run site:video scan-demo        the label-scan walkthrough, from the camera to My Wines
//   npm run site:video winedna-demo     WineDNA, red then white, from a real backup in site/video/private/backup.json
// Run after `npm run site:build`. Each film is drawn from a clock it reads (window.__start, __END) and is rendered a frame at
// a time against a paused browser clock (Playwright's clock), so the result doesn't depend on how fast this machine is. Each frame
// is a JPEG piped straight into the ffmpeg Playwright ships (it only reads piped JPEGs and writes VP8 WebM, so that's the route).
//
// `--record` plays a film without saving frames and sends the text its screens ask Claude for to the app's own /claude proxy
// (VINTEREST_ENDPOINT, default the live site; behind an HTTPS proxy run with NODE_USE_ENV_PROXY=1), keeping the answers by prompt in
// site/video/private/<film>-captured.json. A film with `private: true` reads whatever is in site/video/private/ (git-ignored: it holds
// a real person's wines) and serves it next to the page as backup.json and captured.json.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 4179, FPS = 25;
const FILMS = {
  dinner: { out: 'dinner-table', time: '2026-01-01T00:00:00Z' },
  'scan-demo': { out: 'scan-demo', time: '2026-01-01T00:00:00Z' },
  // The backup was exported on 5 Oct 2026: the film runs the day after, so nothing in it is dated in the future.
  'winedna-demo': { out: 'winedna-demo', time: '2026-10-06T09:00:00Z', private: true, bitrate: '3M' },
};
const NAME = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dinner';
const RECORD = process.argv.includes('--record');
const film = FILMS[NAME];
if (!film) throw new Error('Unknown film: ' + NAME);
const ENDPOINT = process.env.VINTEREST_ENDPOINT || 'https://vinterest.pages.dev/claude';
const FFMPEG = fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('ffmpeg')).map((d) => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || 'ffmpeg';
fs.mkdirSync(path.join(ROOT, 'video'), { recursive: true });

// What the film's page needs next to it in site-dist/.
const VIDEO = path.join(ROOT, 'site/video'), PRIVATE = path.join(VIDEO, 'private'), DIST = path.join(ROOT, 'site-dist');
const CAPTURED = path.join(PRIVATE, `${NAME}-captured.json`);
const served = [];
const serve = (from, to) => { fs.copyFileSync(from, path.join(DIST, to)); served.push(to); };
for (const f of fs.readdirSync(VIDEO)) if (f === `${NAME}.html` || /\.(png|jpe?g|json)$/.test(f)) serve(path.join(VIDEO, f), f);
if (film.private) {
  serve(path.join(PRIVATE, 'backup.json'), 'backup.json');
  if (!RECORD) serve(CAPTURED, `${NAME}-captured.json`);
}

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  const t0Clock = new Date(film.time);
  const answers = {}; let pending = 0;
  if (RECORD) {
    await page.addInitScript(() => { window.__filmRecord = true; });
    await page.exposeFunction('__film_ask', async (purpose, prompt) => {
      pending++;
      try {
        const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose, messages: [{ role: 'user', content: prompt }] }) });
        const j = await r.json();
        if (!r.ok || !j.text) throw new Error(`${r.status} ${j.error || ''}`);
        answers[purpose + '|' + prompt] = String(j.text).trim();
        console.log(`${purpose}: ${String(j.text).trim().slice(0, 80).replace(/\n/g, ' ')}…`);
        return String(j.text).trim();
      } finally { pending--; }
    });
  }
  await page.clock.install({ time: t0Clock });
  await page.goto(`http://localhost:${PORT}/${NAME}.html`);
  await page.waitForFunction(() => window.__ready && window.__ready(), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.pauseAt(new Date(t0Clock.getTime() + 10000));
  await page.clock.runFor(1000); // the first screens settle
  await page.evaluate(() => window.__start());
  const end = await page.evaluate(() => window.__END);
  const n = Math.ceil((end + 1) * FPS);
  if (RECORD) {
    for (let i = 0; i < n; i++) {
      await page.clock.runFor(1000 / FPS);
      if (i % 10 === 0) await page.waitForTimeout(60); // answers arrive in real time
    }
    for (let i = 0; i < 90 && pending > 0; i++) await page.waitForTimeout(1000);
    fs.writeFileSync(CAPTURED, JSON.stringify({ captured: new Date().toISOString().slice(0, 10), byPrompt: answers }, null, 2) + '\n');
    console.log(`Saved ${path.relative(ROOT, CAPTURED)} (${Object.keys(answers).length} answers)`);
  } else {
    const out = path.join(ROOT, `video/${film.out}.webm`);
    const enc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', film.bitrate || '6M', '-crf', '8', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
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
    console.log(`Saved video/${film.out}.webm (${n} frames, ${(n / FPS).toFixed(1)}s)`);
  }
} finally {
  served.forEach((f) => fs.rmSync(path.join(DIST, f), { force: true }));
  await browser.close();
  server.kill();
}
