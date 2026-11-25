// The first social post: a vertical film (1080 x 1920, 9:16, for TikTok and Instagram Reels) of the app
// itself for the sample user, with large captions in the upper middle (clear of each app's buttons and
// caption at the foot and side) and an end card with the download link. Silent: add a sound in TikTok or
// Instagram, where a trending one helps reach. Run after `npm run build`: `node social/first-post.mjs`.
// Writes video/first-post.mp4 (H.264, needs a full ffmpeg) and video/first-post-cover.jpg.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4187, W = 414, H = 736, SCALE = 1080 / 414, FPS = 30, SECONDS = 18;
const OUT = path.join(ROOT, 'video/first-post.mp4');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const SHELF = { u: 0, wines: [
  { n: 'Reserva', pr: 'Marqués de Riscal', t: 'red', r: 'Rioja', c: 'Spain', v: 2019, p: '16.00', g: 'Tempranillo', s: '766' },
  { n: 'Crozes-Hermitage', pr: 'E. Guigal', t: 'red', r: 'Crozes-Hermitage', c: 'France', v: 2020, p: '19.00', g: 'Syrah', s: '776' },
  { n: 'Bourgogne Pinot Noir', pr: 'Louis Jadot', t: 'red', r: 'Burgundy', c: 'France', v: 2021, p: '17.00', g: 'Pinot Noir', s: '366' },
  { n: 'Gran Reserva', pr: 'Faustino I', t: 'red', r: 'Rioja', c: 'Spain', v: 2012, p: '24.00', g: 'Tempranillo', s: '756' },
  { n: 'Côtes du Rhône Réserve', pr: 'Famille Perrin', t: 'red', r: 'Côtes du Rhône', c: 'France', v: 2021, p: '11.00', g: 'Grenache', s: '665' },
  { n: 'Malbec', pr: 'Catena', t: 'red', r: 'Mendoza', c: 'Argentina', v: 2022, p: '14.00', g: 'Malbec', s: '775' },
] };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WINE = { name: 'Viña Real Gran Reserva', confidence: 'high', alternative: '', producer: 'CVNE', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alavesa',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.72, tannins: 0.58, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'leather', 'vanilla'], food_pairings: ['Roast lamb', 'Manchego', 'Mushroom risotto'], price_usd: 48,
  description: 'A classic Gran Reserva from CVNE.' };
const GEN = { fact: 'CVNE was founded in Haro in 1879, beside the railway that carried Rioja to Bordeaux.',
  talk: ['Gran Reserva means it rested at least five years before release, two of them in oak'] };

// Claude's WineDNA summary and sommelier script for the sample user, as captured for the website's demos.
const CAPTURED = require(path.join(ROOT, 'site/demo/captured.json')).answers;
// Vinny's own answer to the welcome slide's question, as captured for the sample user (its first two sentences).
const VINNY = { q: SAMPLE.slides.vinny[0].q, a: SAMPLE.slides.vinny[0].a.split(/(?<=\.)\s+/).slice(0, 2).join(' ') };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pwFfmpeg = () => { const dir = process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH) ? process.env.PLAYWRIGHT_BROWSERS_PATH : '/opt/pw-browsers';
  try { return fs.readdirSync(dir).filter((d) => d.startsWith('ffmpeg')).map((d) => path.join(dir, d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || null; } catch (e) { return null; } };
const fullFfmpeg = () => { try { const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }); return r.status === 0 && /libx264/.test(r.stdout) && /\baac\b/.test(r.stdout) ? 'ffmpeg' : null; } catch (e) { return null; } };
const run = (bin, args, feed) => new Promise((res, rej) => { const ff = spawn(bin, args, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
  ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(path.basename(bin) + ' failed')))); ff.on('error', rej); if (feed) feed(ff.stdin); });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await wait(800);
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London' });
  const wines = SAMPLE.user.wines.map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 9, 15 - i * 3)).toISOString() }));
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all'; window.VINTEREST_WHATSNEW = 'off';
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9', vinterest_detail_intro: '1',
        vinterest_xp_v3: JSON.stringify({ version: 1, accounts: { local: { total: 1240, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: [], quizCompleted: {}, quizStreaks: {} } } }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }
    let s = 0x2f6b1a;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : b.purpose === 'wine_qa' ? VINNY.a : '';
    if (b.purpose === 'wine_qa') await wait(650);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/index.html#camera`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-testid="scan-file"]').waitFor({ state: 'attached', timeout: 30000 });
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'logo.png')).toString('base64');

  /* Captions in the upper middle, big, on a dark rounded box (the way people caption these films), and the
     end card over everything. */
  await page.evaluate((logo) => {
    const st = document.createElement('style');
    st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}' +
      '#cap{position:fixed;left:22px;right:46px;top:104px;z-index:99999;pointer-events:none;display:flex;justify-content:center}' +
      '#cap span{font:800 29px/1.14 Poppins,sans-serif;letter-spacing:-0.6px;color:#fff;text-align:center;background:rgba(10,8,9,.86);padding:12px 18px 14px;border-radius:16px;' +
      'box-shadow:0 10px 40px rgba(0,0,0,.5);opacity:0;transform:scale(.92) translateY(6px);transition:opacity .22s ease,transform .3s cubic-bezier(.2,1.4,.4,1)}' +
      '#cap span.on{opacity:1;transform:none}#cap b{font-weight:800;color:#ff8fa3}' +
      '#end{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 34px;' +
      'background:radial-gradient(ellipse 90% 55% at 50% 30%,#8B1A2Fdd,transparent 72%),#0d0d0f;color:#fff;font-family:Poppins,sans-serif;opacity:0;transition:opacity .4s ease}' +
      '#end.on{opacity:1}#end img{height:30px;filter:brightness(0) invert(1);margin-bottom:34px}' +
      '#end h1{font-size:44px;line-height:1.04;font-weight:800;letter-spacing:-1.2px;margin:0 0 18px}#end h1 b{color:#ff8fa3}' +
      '#end p{font-size:18px;line-height:1.4;color:rgba(255,255,255,.8);margin:0 0 30px}' +
      '#end .get{font-size:21px;font-weight:700;background:#8B1A2F;border-radius:14px;padding:12px 22px}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'cap'; d.innerHTML = '<span></span>'; document.body.appendChild(d);
    const e = document.createElement('div'); e.id = 'end';
    e.innerHTML = '<img src="' + logo + '"><h1>The wine app built just for <b>you</b>.</h1><p>Free on iPhone and Android.<br>Your taste. Nobody else\'s.</p><div class="get">vinterest.app/get</div>';
    document.body.appendChild(e);
    window.__cap = (html, top) => { const s = d.firstChild; s.className = ''; setTimeout(() => { d.style.top = (top || 104) + 'px'; s.innerHTML = html; s.style.display = html ? '' : 'none'; s.className = html ? 'on' : ''; }, 120); };
  }, logo);
  const caption = (html, top) => page.evaluate(([h, t]) => window.__cap(h, t), [html, top]);
  const swipe = (back) => page.evaluate(async (back) => {
    const st = document.querySelector('.rv-stage'); if (!st) return;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.5, a = r.left + r.width * 0.74, b = r.left + r.width * 0.26, x0 = back ? b : a, x1 = back ? a : b;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 16)); ev('pointermove', x0 + (x1 - x0) * (i / 6)); }
    ev('pointerup', x1);
  }, !!back);
  await page.evaluate(() => { ScanFlow.REVEAL_MIN_MS = 120000; });
  const scroll = (f, ms) => page.evaluate(([f, ms]) => {
    const els = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; });
    const s = els[0]; if (!s) return;
    const to = f * (s.scrollHeight - s.clientHeight), t0 = performance.now();
    const tick = (t) => { const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; s.scrollTop = to * e; if (u < 1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }, [f, ms]);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  let rec = false;
  cdp.on('Page.screencastFrame', (f) => { if (rec) frames.push({ t: Date.now(), data: Buffer.from(f.data, 'base64') }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });

  await page.locator('[data-testid="scan-file"]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('reveal-scene').waitFor({ timeout: 15000 });
  await swipe(); await wait(700); await swipe(true);
  await caption('Which bottle will <b>you</b> actually like?');
  await wait(400);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  rec = true;
  const t0 = Date.now();
  const at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));

  // The film, second by second: the hook, the match, why, the shelf, Vinny, the end card.
  await at(2.0); await caption('Scan the label.'); await swipe();
  await at(3.4); await caption('<b>94%</b> you\'ll love it.');
  await at(6.0); await caption('Worked out from wines <b>you</b> rated. Not critics.');
  await at(9.0); await caption('Scan a whole <b>shelf</b>. Your best bottle comes first.', 440);
  await page.evaluate((shelf) => { const r = ScanFlow.shelfWines(JSON.stringify(shelf)); Handoff.wineList.set({ demo: false, shelf: true, wines: r.wines, unread: r.unread, currency: 'GBP' }); window.location.hash = '#winelist'; }, SHELF);
  await wait(500); await scroll(0.12, 2400);
  await at(12.2); await caption('Ask <b>Vinny</b> anything.', 470); await page.evaluate(() => { window.location.hash = '#home'; });
  await at(12.8); await page.locator('input[aria-label="Ask Vinny"]').pressSequentially(VINNY.q, { delay: 26 });
  await at(14.0); await page.locator('input[aria-label="Ask Vinny"]').press('Enter');
  await at(15.6); await caption(''); await page.evaluate(() => document.getElementById('end').classList.add('on'));
  await at(SECONDS + 0.2);
  rec = false;
  await cdp.send('Page.stopScreencast').catch(() => {});
  await context.close();

  if (frames.length < 20) throw new Error('only ' + frames.length + ' frames were captured');
  const total = SECONDS * FPS, feed = (stdin) => { let i = 0;
    const write = (k) => { if (k >= total) return stdin.end(); const t = t0 + (k * 1000) / FPS; while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
      if (stdin.write(frames[i].data)) setImmediate(() => write(k + 1)); else stdin.once('drain', () => write(k + 1)); };
    stdin.on('error', () => {}); write(0); };
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0'];
  const full = fullFfmpeg();
  if (!full) throw new Error('needs an ffmpeg with H.264');
  await run(full, [...input, '-vf', 'scale=1080:1920', '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-b:v', '12M', '-movflags', '+faststart', OUT], feed);
  // The cover: the moment the dial lands, with its caption.
  const cover = frames.reduce((best, f) => (Math.abs(f.t - (t0 + 5200)) < Math.abs(best.t - (t0 + 5200)) ? f : best));
  await run(full, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0', '-vf', 'scale=1080:1920', '-q:v', '2', OUT.replace(/\.mp4$/, '-cover.jpg')], (s) => { s.end(cover.data); });
  console.log(`Saved ${path.relative(ROOT, OUT)} (${SECONDS}s, ${frames.length} painted frames) and its cover`);
} finally {
  await browser.close();
  server.kill();
}
