// The announcement film for TikTok and Instagram Reels (1080 x 1920, 9:16): clean words on slides of their
// own (other apps give you strangers' stars and critics' scores; Vinterest is built for you) between short
// shots of the app itself for the sample user, with no captions over the app. Silent: add a sound in the
// app you post from. Run after `npm run build`: `node social/announce.mjs`. Writes video/announce.mp4
// (H.264, needs a full ffmpeg) and video/announce-cover.jpg.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4187, W = 414, H = 736, SCALE = 1080 / 414, FPS = 30, SECONDS = 25;
const OUT = path.join(ROOT, 'video/announce.mp4');
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

  /* The word slides: the whole screen, dark with a crimson glow, one line of words rising in. */
  await page.evaluate((logo) => {
    const st = document.createElement('style');
    st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}' +
      '#sl{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 38px;' +
      'background:radial-gradient(ellipse 85% 50% at 50% 42%,#6d1526,transparent 74%),#0b0a0b;color:#fff;font-family:Poppins,sans-serif;transition:opacity .28s ease}' +
      '#sl.off{opacity:0}#sl h1{font-size:40px;line-height:1.08;font-weight:800;letter-spacing:-1.2px;margin:0}#sl h1 b{color:#ff8fa3;font-weight:800}' +
      '#sl h1 span{display:inline-block;opacity:0;transform:translateY(14px);animation:w .5s cubic-bezier(.2,.9,.3,1) forwards}' +
      '@keyframes w{to{opacity:1;transform:none}}#sl img{height:28px;filter:brightness(0) invert(1);margin-bottom:30px;opacity:0;animation:w .5s ease forwards}' +
      '#sl p{font-size:17px;line-height:1.45;color:rgba(255,255,255,.78);margin:22px 0 0;opacity:0;animation:w .5s ease .5s forwards}' +
      '#sl .get{display:inline-block;margin-top:26px;font-size:20px;font-weight:700;background:#8B1A2F;border-radius:14px;padding:12px 22px;opacity:0;animation:w .5s ease .8s forwards}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'sl'; document.body.appendChild(d);
    // Each word rises in turn; <b> words keep their colour.
    window.__slide = (html, opt) => {
      opt = opt || {};
      if (!html) { d.className = 'off'; return; }
      const words = html.replace(/<b>(.*?)<\/b>/g, (m, w) => w.split(' ').map((x) => '\u0001' + x).join(' ')).split(' ');
      const h = words.map((w, i) => { const b = w[0] === '\u0001'; const t = b ? w.slice(1) : w;
        return '<span style="animation-delay:' + (i * 0.09).toFixed(2) + 's">' + (b ? '<b>' + t + '</b>' : t) + '</span>'; }).join(' ');
      d.innerHTML = (opt.logo ? '<img src="' + logo + '">' : '') + '<h1>' + h + '</h1>' + (opt.sub ? '<p>' + opt.sub + '</p>' : '') + (opt.get ? '<div class="get">' + opt.get + '</div>' : '');
      d.className = '';
    };
  }, logo);
  const slide = (html, opt) => page.evaluate(([h, o]) => window.__slide(h, o), [html, opt || null]);
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
  await slide('Stars from strangers.');
  await wait(400);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  rec = true;
  const t0 = Date.now();
  const at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));

  // Words, then the app, three times, then the end card.
  await at(1.7); await slide('Critic scores.');
  await at(3.2); await slide('None of them know <b>your</b> taste.');
  await at(5.4); await slide('Built for <b>you</b>.', { logo: true });
  await at(7.5); await slide(''); await swipe(); // the match dial sweeps up
  await at(11.2); await slide('Every match comes from wines <b>you</b> rated.');
  await at(11.8); await page.evaluate(() => { window.location.hash = '#profile'; });
  await at(13.3); await slide(''); await scroll(0.28, 2600);
  await at(16.4); await slide('Questions answered from <b>your</b> taste.');
  await at(17.0); await page.evaluate(() => { window.location.hash = '#home'; });
  await at(18.4); await slide('');
  await at(18.7); await page.locator('input[aria-label="Ask Vinny"]').pressSequentially(VINNY.q, { delay: 24 });
  await at(19.8); await page.locator('input[aria-label="Ask Vinny"]').press('Enter');
  await at(22.0); await slide('The wine app built just for <b>you</b>.', { logo: true, sub: 'Free on iPhone and Android.', get: 'vinterest.app/get' });
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
  const cover = frames.reduce((best, f) => (Math.abs(f.t - (t0 + 9600)) < Math.abs(best.t - (t0 + 9600)) ? f : best));
  await run(full, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0', '-vf', 'scale=1080:1920', '-q:v', '2', OUT.replace(/\.mp4$/, '-cover.jpg')], (s) => { s.end(cover.data); });
  console.log(`Saved ${path.relative(ROOT, OUT)} (${SECONDS}s, ${frames.length} painted frames) and its cover`);
} finally {
  await browser.close();
  server.kill();
}
