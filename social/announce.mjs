// The announcement film for TikTok and Instagram Reels (1080 x 1920, 9:16): clean words on slides of their
// own (not strangers' stars, not critics' scores: just you and your WineDNA), then unhurried shots of the app
// itself for the sample user with no captions over them: a label scanned, the match (one
// bottle, then a shelf), the first part of WineDNA, Learn and a quiz question with its answer, Mastery, Vinny
// answering, My Wines, and the end slide. About a minute and three quarters, with the music in
// ANNOUNCE_MUSIC or assets/announce-music.* (git-ignored), or silent without one.
// Run after `npm run build`: `node social/announce.mjs`. Writes video/announce.mp4 (H.264, needs a full
// ffmpeg) and video/announce-cover.jpg.
//
// The camera is Chrome's fake one, fed a real label photo (team/labels/ardanza.jpg), so the shot shows a
// bottle in the frame. That bottle is in the sample user's history already, and a rated bottle shows its
// rating, not a match, so this film's user starts without it and scans it here.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
// Three cuts of one film (ANNOUNCE_FORMAT): `social` for Reels and TikTok, with the phone inside their
// safe area; `mobile` for the website on a phone, the same upright frame with the phone filling it; and
// `wide` for the website on a large screen, 16:9 with the phone standing in the middle. `k` scales a
// point of the phone to the page, `top` is where the phone starts, `type` scales the slides' words, and
// the website's cuts are encoded small enough to serve (Cloudflare Pages takes files up to 25MB).
const FORMATS = {
  social: { w: 540, h: 960, k: 0.79, top: 102, cx: 0.5, type: 1, size: '1080:1920', enc: ['-b:v', '12M'], out: 'announce' },
  mobile: { w: 540, h: 960, k: 1.02, top: 34, cx: 0.5, type: 1, size: '720:1280', enc: ['-crf', '27', '-preset', 'slow', '-maxrate', '2200k', '-bufsize', '4400k'], out: 'announce-web-mobile' },
  // Wide: 2560 x 1440, the phone tall on the right and a panel of words beside it. The app is drawn by the
  // browser at whatever size is asked, so the phone is as sharp here as the frame is large.
  wide: { w: 1280, h: 720, k: 0.775, top: 21, cx: 0.715, type: 1.5, panel: true, size: '2560:1440', enc: ['-crf', '23', '-preset', 'slow', '-maxrate', '5000k', '-bufsize', '10000k'], out: 'announce-web-wide' },
};
const FORMAT = FORMATS[process.env.ANNOUNCE_FORMAT || 'social'];
if (!FORMAT) throw new Error('ANNOUNCE_FORMAT is one of ' + Object.keys(FORMATS).join(', '));
const WIDE = !!FORMAT.panel;
const PORT = 4187, W = FORMAT.w, H = FORMAT.h, SCALE = 2, FPS = 30;
// The app plays inside an iPhone drawn to the real one's measurements, in points: a 393 x 852 screen with
// 55pt corners, an 11.5pt bezel inside a titanium edge, the 126 x 37 Dynamic Island 11pt down, a 54pt
// status bar, the home indicator, and the buttons where they are. The app itself gets the screen under the
// status bar. K scales a point to the page and PTOP is where the phone starts: Instagram and TikTok lay
// their header over the top of a Reel, the caption and buttons over the bottom and icons down the right,
// and trim the edges in the feed and on tall phones, and the phone sits clear of all of them.
const PHONE = { w: 393, h: 852, bezel: 11.5, radius: 55, bar: 54, foot: 22 }, K = FORMAT.k, PTOP = FORMAT.top;
const MUSIC = [process.env.ANNOUNCE_MUSIC, ...['mp3', 'm4a', 'wav'].map((x) => path.join(ROOT, 'assets/announce-music.' + x))].find((f) => f && fs.existsSync(f)) || null;
const LABEL = path.join(ROOT, 'team/labels/ardanza.jpg'), FEED = path.join(ROOT, 'video/announce-camera.mjpeg');
const OUT = path.join(ROOT, 'video/' + FORMAT.out + '.mp4');
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
const WINE = { name: 'Viña Ardanza Reserva', confidence: 'high', alternative: '', producer: 'La Rioja Alta', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alta',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Garnacha'], blend: true, grapes_basis: 'known', body: 0.7, tannins: 0.58, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 14.5, tasting_notes: ['dried cherry', 'vanilla', 'leather'], food_pairings: ['Roast lamb', 'Manchego', 'Mushroom risotto'], price_usd: 38,
  description: 'A classic Reserva from La Rioja Alta.' };
const GEN = { fact: 'La Rioja Alta was founded in Haro in 1890.', talk: ['Reserva means it rested at least three years before release, one of them in oak'] };

// Claude's WineDNA summary and sommelier script for the sample user, as captured for the website's demos.
const CAPTURED = require(path.join(ROOT, 'site/demo/captured.json')).answers;
const BANKS = require(path.join(ROOT, 'site/demo/captured.json')).banks || {};
// Vinny's own answer to the welcome slide's question, as captured for the sample user (its first two sentences).
const ARTICLE = { ...(SAMPLE.slides && SAMPLE.slides.article), id: 'film-article' };
const VINNY = { q: SAMPLE.slides.vinny[0].q, a: SAMPLE.slides.vinny[0].a.split(/(?<=\.)\s+/).slice(0, 2).join(' ') };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pwFfmpeg = () => { const dir = process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync(process.env.PLAYWRIGHT_BROWSERS_PATH) ? process.env.PLAYWRIGHT_BROWSERS_PATH : '/opt/pw-browsers';
  try { return fs.readdirSync(dir).filter((d) => d.startsWith('ffmpeg')).map((d) => path.join(dir, d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || null; } catch (e) { return null; } };
const fullFfmpeg = () => { try { const r = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' }); return r.status === 0 && /libx264/.test(r.stdout) && /\baac\b/.test(r.stdout) ? 'ffmpeg' : null; } catch (e) { return null; } };
const run = (bin, args, feed) => new Promise((res, rej) => { const ff = spawn(bin, args, { stdio: [feed ? 'pipe' : 'ignore', 'ignore', 'inherit'] });
  ff.on('exit', (c) => (c === 0 ? res() : rej(new Error(path.basename(bin) + ' failed')))); ff.on('error', rej); if (feed) feed(ff.stdin); });

fs.mkdirSync(path.dirname(OUT), { recursive: true });
// The camera's picture: the label photo as a short looping film, the form Chrome's fake camera reads.
if (!fullFfmpeg()) throw new Error('needs an ffmpeg with H.264');
await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-loop', '1', '-framerate', '30', '-i', LABEL, '-t', '2', '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280', '-c:v', 'mjpeg', '-q:v', '3', '-f', 'mjpeg', FEED]);
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await wait(800);
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-video-capture=' + FEED] });
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, isMobile: true, hasTouch: true, locale: 'en-GB', timezoneId: 'Europe/London', permissions: ['camera'] });
  const wines = SAMPLE.user.wines.filter((w) => !/Ardanza/.test(w.name)).map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 9, 15 - i * 3)).toISOString() }));
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all'; window.VINTEREST_WHATSNEW = 'off'; window.VINTEREST_QUIZ_SPEED = 0.6; // the quiz's own animations, a little slower for the film
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9', vinterest_gallery_hint_v1: '9', vinterest_force_mobile: '1', vinterest_detail_intro: '1',
        vinterest_xp_v3: JSON.stringify({ version: 1, accounts: { local: { total: 1240, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: [], quizCompleted: {}, quizStreaks: {} } } }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }
    let s = 0x2f6b1a;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : b.purpose === 'wine_qa' ? VINNY.a : b.purpose === 'learn_article' ? CAPTURED.learn_article : '';
    if (b.purpose === 'wine_qa') await wait(900);
    if (b.purpose === 'label_scan') await wait(1500); // long enough to see the label being read
    if (b.purpose === 'learn_article') await wait(1600); // long enough to see "Writing something personalised for you…"
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/index.html#camera`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[aria-label="Take photo"]').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.videoWidth > 0; }, null, { timeout: 15000 });
  const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'logo.png')).toString('base64');

  /* The word slides: the whole screen, dark with a crimson glow, one line of words rising in. */
  await page.evaluate(([logo, P, k, top, type, cx, hasPanel]) => {
    // The phone's body and its screen, in page pixels.
    const bw = (P.w + 2 * P.bezel) * k, bh = (P.h + 2 * P.bezel) * k, bx = innerWidth * cx - bw / 2, sx = bx + P.bezel * k, sy = top + P.bezel * k;
    const st = document.createElement('style');
    st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}' +
      '#stg{position:fixed;inset:0;z-index:0;background:radial-gradient(ellipse ' + (hasPanel ? 46 : 80) + '% ' + (hasPanel ? 70 : 46) + '% at ' + cx * 100 + '% 46%,#3a0c16,transparent 72%),#0b0a0b}' +
      '#pn{left:' + innerWidth * 0.07 + 'px;width:' + innerWidth * 0.44 + 'px;display:' + (hasPanel ? 'flex' : 'none') + '}#root{transition:opacity .35s ease}' +
      '#ph{position:fixed;z-index:1;left:' + bx + 'px;top:' + top + 'px;width:' + bw + 'px;height:' + bh + 'px;border-radius:' + (P.radius + P.bezel) * k + 'px;background:#000;' +
      'box-shadow:0 0 0 1px #111,0 0 0 ' + 4.2 * k + 'px #8d8d92,0 0 0 ' + 5.4 * k + 'px #3b3b3f,0 40px 90px rgba(0,0,0,.75)}' +
      '#ph i{position:absolute;width:' + 3.4 * k + 'px;border-radius:2px;background:linear-gradient(#9a9a9f,#6a6a6f)}' +
      '#ph i.a{left:' + -8.4 * k + 'px;top:' + 165 * k + 'px;height:' + 32 * k + 'px}#ph i.b{left:' + -8.4 * k + 'px;top:' + 225 * k + 'px;height:' + 60 * k + 'px}' +
      '#ph i.c{left:' + -8.4 * k + 'px;top:' + 300 * k + 'px;height:' + 60 * k + 'px}#ph i.d{right:' + -8.4 * k + 'px;top:' + 260 * k + 'px;height:' + 100 * k + 'px}' +
      '#pb{position:fixed;z-index:3;left:' + sx + 'px;top:' + sy + 'px;width:' + P.w * k + 'px;height:' + P.bar * k + 'px;border-radius:' + P.radius * k + 'px ' + P.radius * k + 'px 0 0;background:#0b0a0b;color:#fff}' +
      '#pb span{position:absolute;left:' + 52 * k + 'px;top:' + 17 * k + 'px;transform:translateX(-50%);font:600 ' + 17 * k + 'px/1.2 -apple-system,"SF Pro Text",Poppins,sans-serif;letter-spacing:-.2px}' +
      '#pb u{position:absolute;left:50%;top:' + 11 * k + 'px;width:' + 126 * k + 'px;height:' + 37 * k + 'px;margin-left:' + -63 * k + 'px;border-radius:' + 19 * k + 'px;background:#000}' +
      '#pb svg{position:absolute;right:' + 26 * k + 'px;top:' + 19 * k + 'px;height:' + 13 * k + 'px}' +
      '#hi{position:fixed;z-index:3;left:' + (sx + (P.w / 2 - 67) * k) + 'px;top:' + (sy + (P.h - 13) * k) + 'px;width:' + 134 * k + 'px;height:' + 5 * k + 'px;border-radius:3px;background:rgba(255,255,255,.92)}' +
      '#root{z-index:2;inset:auto !important;left:' + sx + 'px !important;top:' + (sy + P.bar * k) + 'px !important;width:' + P.w + 'px !important;height:' + (P.h - P.bar) + 'px !important;box-sizing:border-box;padding-bottom:' + P.foot + 'px;' +
      'background:#0b0a0b;transform-origin:0 0;transform:scale(' + k + ');border-radius:0 0 ' + P.radius + 'px ' + P.radius + 'px;overflow:hidden}' +
      '#sl{position:fixed;inset:0;z-index:100000;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 72px 80px;' +
      'background:radial-gradient(ellipse 85% 50% at 50% 42%,#6d1526,transparent 74%),#0b0a0b;color:#fff;font-family:Poppins,sans-serif;transition:opacity .28s ease}' +
      '#sl.off{opacity:0;transition-duration:.45s}#sl{transition-duration:.35s}' +
      '#td{position:fixed;z-index:99999;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;pointer-events:none;background:rgba(255,255,255,.3);border:1.5px solid rgba(255,255,255,.65);opacity:0;transform:scale(1.5);transition:opacity .3s ease,transform .3s ease}#td.on{opacity:1;transform:scale(1)}' +
      '#sl.off{opacity:0}#sl h1{max-width:' + 560 * type + 'px;font-size:' + 47 * type + 'px;line-height:1.08;font-weight:800;letter-spacing:-1.5px;margin:0}#sl h1 b{color:#ff8fa3;font-weight:800}' +
      // Words rest visible and animate in from hidden, so one whose animation is dropped (the first word of the
      // Learn slide vanished when the app changed screens behind it) still shows.
      '#sl h1 span{display:inline-block;animation:slw .5s cubic-bezier(.2,.9,.3,1) both}' +
      '@keyframes slw{from{opacity:0;transform:translateY(14px)}}#sl img{height:36px;filter:brightness(0) invert(1);margin-bottom:38px;animation:slw .5s ease both}' +
      '#sl p{font-size:' + 22 * type + 'px;line-height:1.45;color:rgba(255,255,255,.78);margin:28px 0 0;animation:slw .5s ease .5s both}' +
      '#sl .get{display:inline-block;margin-top:34px;font-size:26px;font-weight:700;background:#8B1A2F;border-radius:18px;padding:15px 28px;animation:slw .5s ease .8s both}';
    document.head.appendChild(st);
    const stg = document.createElement('div'); stg.id = 'stg'; document.body.insertBefore(stg, document.body.firstChild);
    const ph = document.createElement('div'); ph.id = 'ph'; ph.innerHTML = '<i class="a"></i><i class="b"></i><i class="c"></i><i class="d"></i>'; document.body.appendChild(ph);
    const pb = document.createElement('div'); pb.id = 'pb'; document.body.appendChild(pb);
    // The status bar: the time, the island, then signal, wifi and battery.
    pb.innerHTML = '<span>9:41</span><u></u><svg viewBox="0 0 78 13" fill="#fff"><rect x="0" y="8" width="3" height="5" rx="1"/><rect x="5" y="5.5" width="3" height="7.5" rx="1"/><rect x="10" y="3" width="3" height="10" rx="1"/><rect x="15" y="0" width="3" height="13" rx="1"/>' +
      '<path d="M33.5 2.6c2.6 0 5 1 6.800 2.700l1.100-1.200A11.400 11.400 0 0 0 33.500.900c-3 0-5.800 1.200-7.900 3.200l1.100 1.200a9.800 9.800 0 0 1 6.800-2.700zm0 3.700c1.600 0 3 .6 4.200 1.600l1.100-1.200a7.800 7.800 0 0 0-10.600 0l1.100 1.200a6.200 6.200 0 0 1 4.200-1.600zm0 3.600c.8 0 1.500.3 2 .8l-2 2.300-2-2.300c.5-.5 1.200-.8 2-.8z"/>' +
      '<rect x="49.500" y=".5" width="24" height="12" rx="3.800" fill="none" stroke="#fff" stroke-opacity=".4"/><rect x="51.500" y="2.500" width="20" height="8" rx="2.300"/><path d="M75 4.500v4c.9-.3 1.500-1.100 1.500-2s-.6-1.700-1.500-2z" fill-opacity=".45"/></svg>';
    const hi = document.createElement('div'); hi.id = 'hi'; document.body.appendChild(hi);
    const pn = document.createElement('div'); pn.id = 'pn'; pn.className = 'off'; document.body.appendChild(pn);
    const d = document.createElement('div'); d.id = 'sl'; document.body.appendChild(d);
    const td = document.createElement('div'); td.id = 'td'; document.body.appendChild(td);
    // A soft dot where a finger taps, then the tap itself.
    window.__tap = (el) => { if (!el) return; const r = el.getBoundingClientRect(); td.style.left = (r.left + r.width / 2) + 'px'; td.style.top = (r.top + r.height / 2) + 'px'; td.className = 'on';
      setTimeout(() => { td.className = ''; }, 520); setTimeout(() => el.click(), 330); };
    // Each word rises in turn; <b> words keep their colour.
    window.__slide = (html, opt) => {
      opt = opt || {};
      if (!html) { d.className = 'off'; return; }
      if (html === ' ') { d.innerHTML = ''; d.className = ''; return; } // a plain dip between two shots
      const words = html.replace(/<b>(.*?)<\/b>/g, (m, w) => w.split(' ').map((x) => '\u0001' + x).join(' ')).split(' ');
      const h = words.map((w, i) => { const b = w[0] === '\u0001'; const t = b ? w.slice(1) : w;
        return '<span style="animation-delay:' + (i * 0.09).toFixed(2) + 's">' + (b ? '<b>' + t + '</b>' : t) + '</span>'; }).join(' ');
      d.innerHTML = (opt.logo ? '<img src="' + logo + '">' : '') + '<h1>' + h + '</h1>' + (opt.sub ? '<p>' + opt.sub + '</p>' : '') + (opt.get ? '<div class="get">' + opt.get + '</div>' : '');
      d.className = '';
    };
  }, [logo, PHONE, K, PTOP, FORMAT.type, FORMAT.cx, !!FORMAT.panel]);
  const slide = (html, opt) => page.evaluate(([h, o]) => window.__slide(h, o), [html, opt || null]);
  // The wide cut's stage beside the phone (social/announce-art.js): a headline and a picture for each part.
  if (WIDE) await page.addScriptTag({ path: path.join(ROOT, 'social/announce-art.js') });
  const panel = (key) => (WIDE ? page.evaluate((k) => window.__stage(k), key || null) : null);
  const cover = (on) => page.evaluate((o) => { document.getElementById('root').style.opacity = o ? 0 : 1; }, on);
  const swipe = (back) => page.evaluate(async (back) => {
    const st = document.querySelector('.rv-stage'); if (!st) return;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.5, a = r.left + r.width * 0.74, b = r.left + r.width * 0.26, x0 = back ? b : a, x1 = back ? a : b;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 16)); ev('pointermove', x0 + (x1 - x0) * (i / 6)); }
    ev('pointerup', x1);
  }, !!back);
  // The sample user has studied a little, so Learn and Mastery have something to show (as in the trailer).
  await page.evaluate(([wide, banks]) => {
    Device.setMasteryView({ grapes: 'bunch', shape: 'chart', map: 'map' });
    Object.keys(banks).forEach((k) => Store.set(k, banks[k]));
    WineHistory.getAll().forEach((w) => { try { ScanFlow.unlockLearning({ ...w, confidence: 'high' }); } catch (e) {} });
    const answer = (setId, pool, n) => (pool || []).slice(0, n).forEach((q) => QuizMastery.recordAnswer(setId, q.q, true));
    [['red_grapes', 14], ['white_grapes', 6], ['rose', 3], ['sparkling', 5]].forEach(([t, n]) => answer('topic:' + t, QuizMastery.topicPool(t), n));
    try { [['Tempranillo', 13], ['Grenache', 9], ['Syrah', 8], ['Malbec', 6], ['Nebbiolo', 3]].forEach(([g, n]) => answer('grape:' + g, grapeQuizBank(g), n)); } catch (e) {}
    try { [['Rioja', 14], ['Rhône Valley', 9], ['Mendoza', 7], ['Piedmont', 3]].forEach(([r, n]) => answer(RegionQuizBank.setId(r), RegionQuizBank.get(r), n)); } catch (e) {}
    _loadJSON('data/onramp.json').slice(0, 4).forEach((a) => Store.set('vinterest_' + a.id + '_done', '1'));
    // Seven Blind Calls close to each label's profile, so the palate has its rings (as the site's demo has).
    const off = [[0.04, -0.06, 0.15], [-0.05, 0.05, 0.2], [0.08, 0.03, 0.12], [-0.03, -0.04, 0.17], [0.06, 0.07, 0.1], [0.02, -0.02, 0.18], [-0.06, 0.04, 0.14]];
    WineHistory.getAll().filter((w) => typeof w.body === 'number').slice(0, 7).forEach((w, i) => {
      const o = off[i], c = (v) => Math.max(0, Math.min(1, v)), guess = { body: c(w.body + o[0]), acidity: c(w.acidity + o[1]), tannins: c(w.tannins + o[2]) };
      const accuracy = Math.max(0, 1 - ['body', 'acidity', 'tannins'].reduce((n, k) => n + Math.abs(guess[k] - w[k]), 0) / 3 * 1.6);
      ScanFlow.saveBlindResult(w, { accuracy, amount: Math.round(accuracy * 40), guess });
    });
    const m = KnowledgeMap.compute(WineHistory.getAll()), then = Date.now() - 35 * 864e5, a = {};
    m.areas.forEach((x) => { a[x.id] = Math.round(x.score * 0.55); });
    Store.setJSON(KnowledgeMap.HISTORY_KEY, { [KnowledgeMap._week(then)]: { t: then, o: Math.round(m.overall * 0.55), a } });
    KnowledgeMap.note(m);
    try { Milestones.check(KnowledgeMap.compute(), Palate.compute()); } catch (e) {} // already earned: no card over Mastery
    ScanFlow.REVEAL_MIN_MS = 120000; // the swipes below set the story's pace
    if (wide) { const reveal = ScanFlow.reveal; ScanFlow.reveal = function () { const d = reveal.apply(this, arguments); d.traits = []; return d; }; }
  }, [WIDE, BANKS]);
  const tap = (sel, text) => page.evaluate(([sel, text]) => window.__tap([...document.querySelectorAll(sel)].find((e) => !text || e.textContent.trim() === text)), [sel, text || '']);
  const go = (hash) => page.evaluate((h) => { window.location.hash = '#' + h; }, hash);
  /* A screen reads down on a transform, not on scrollTop: the compositor moves the content, where
     setting scrollTop every frame relaid the whole screen out and the capture fell to 25 frames a
     second on the longer screens. Over 1, `f` is pixels; at or under 1, a share of the screen's length. */
  const scroll = (f, ms) => page.evaluate(([f, ms]) => {
    const els = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; });
    const s = els[0]; if (!s) return;
    const max = s.scrollHeight - s.clientHeight, px = Math.min(f > 1 ? f : f * max, max);
    const kids = [...s.children];
    kids.forEach((k) => { k.style.willChange = 'transform'; k.style.transition = `transform ${ms}ms cubic-bezier(.33,0,.25,1)`; });
    requestAnimationFrame(() => kids.forEach((k) => { k.style.transform = `translateY(${-Math.round(px)}px)`; }));
  }, [f, ms]);

  // Glide to a section of the screen (by selector), leaving `gap` px above it.
  const scrollTo = (sel, ms, gap = 10) => page.evaluate(([sel, ms, gap]) => {
    const s = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; })[0];
    const el = document.querySelector(sel); if (!s || !el) return false;
    const z = s.getBoundingClientRect().height / s.offsetHeight, now = s.__ty || 0;
    const px = Math.max(0, Math.min(s.scrollHeight - s.clientHeight, Math.round((el.getBoundingClientRect().top - s.getBoundingClientRect().top) / z + now - gap)));
    s.__ty = px;
    [...s.children].forEach((k) => { k.style.willChange = 'transform'; k.style.transition = `transform ${ms}ms cubic-bezier(.4,0,.2,1)`; k.style.transform = `translateY(${-px}px)`; });
    return true;
  }, [sel, ms, gap]);

  const cdp = await context.newCDPSession(page);
  const frames = [];
  let rec = false;
  cdp.on('Page.screencastFrame', (f) => { if (rec) frames.push({ t: Date.now(), data: Buffer.from(f.data, 'base64') }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });

  await slide('The wine app built just for <b>you</b>.', { logo: true });
  await wait(300);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  rec = true;
  const t0 = Date.now();
  let T = 0; // the film's clock, in seconds: `after` waits until that long after the last mark
  const after = (s) => { T += s; return wait(Math.max(0, t0 + T * 1000 - Date.now())); };
  const WORDS = 2.8, LAND = 1250; // a section's slide, and how long its words take to land

  /* A part opens one of two ways. In the upright cuts a slide of words covers the screen while the app
     changes behind it. In the wide cut the phone never leaves: its screen dips to black while the app
     changes, and the stage beside it turns to the part's own headline and picture. */
  const DIP = 1.5;
  const part = async (gap, words, key, change, more = 0) => {
    await after(gap);
    if (WIDE) { await cover(true); await panel(key); await wait(450); if (change) await change(); await after(DIP); await cover(false); return; }
    await slide(words); await wait(LAND); if (change) await change();
    await after(WORDS + more); await slide('');
  };
  const quiz = async () => { await page.evaluate(() => { Handoff.quiz.set({ mode: 'practice', topicId: 'red_grapes' }); window.location.hash = '#quiz'; }); await page.locator('.qz-opt').first().waitFor({ timeout: 5000 }); };

  // 1. The opening, in words.
  await after(2.7); await slide('Not from community stars and ratings.');
  await after(2.5); await slide('Not from critic scores.');
  await after(2.1); await slide('Just from <b>you</b>, and your <b>WineDNA</b>.');
  // 2. Scan: one bottle's label.
  await after(2.8);
  if (WIDE) { await panel('scan'); await wait(250); await slide(''); }
  else { await slide('Scan any label, a shelf or a wine list.'); await after(WORDS + 0.3); await slide(''); }
  await after(WIDE ? 5.0 : 2.6); await tap('[aria-label="Take photo"]');
  await page.getByTestId('reveal-scene').waitFor({ timeout: 15000 });
  T = (Date.now() - t0) / 1000; // the label's own scene, for as long as it takes to read
  // 3. The match: the dial sweeping up to its verdict.
  await after(3.6);
  if (WIDE) { await panel('match'); await wait(500); await swipe(); }
  else { await slide('Know your <b>match</b> before you buy.'); await after(WORDS); await slide(''); await swipe(); }
  // In the wide cut the story carries on: the grape drawn by the pen, then the map closing in on the region.
  if (WIDE) { await after(6.2); await panel('story'); await wait(500); await swipe(); await after(5.0); await swipe(); await after(0.5); }
  // 4. WineDNA: only its first part, slowly.
  await part(WIDE ? 5.2 : 4.6, 'Your taste, as <b>WineDNA</b>.', 'dna', () => go('profile'));
  await wait(1400); await scroll(430, 5600);
  // 5. Learn: the hub, a quiz question with its answer, and a piece written for this reader.
  await part(6.6, '<b>Learn</b> as you sip.', 'learn', () => go('learn'));
  await wait(1200); await scroll(260, 3000);
  await part(4.2, 'Quizzes on the grapes and regions your scans unlock.', 'quiz', quiz, 0.4);
  await after(3.2); // the question, read; then the right answer, tapped
  await page.evaluate(() => { const shown = document.querySelector('.qz-in').textContent.trim(); const q = QuizMastery.topicPool('red_grapes').find((x) => x.q.trim() === shown);
    const want = q ? String(q.opts[q.a]).trim() : null, opts = [...document.querySelectorAll('.qz-opt')];
    window.__tap(opts.find((o) => o.lastElementChild.textContent.trim() === want) || opts[0]); });
  await part(6.2, 'Articles written for <b>you</b>, from your WineDNA.', 'article', () => page.evaluate((stub) => { Handoff.genArticle.set(stub); window.location.hash = '#gen-article'; }, ARTICLE), 0.4);
  await wait(2600); await scroll(900, 8000); // the writing wait, then the piece itself
  // 6. Mastery.
  await part(6.2, 'Watch your <b>Mastery</b> grow.', 'shape', () => go('mastery-map'));
  // Its four pictures in turn, the stage beside the phone changing with each: the chart of what they know,
  // the grapes, the wine map, the palate.
  await wait(900); await scrollTo('[data-section="shape"]', 1300);
  for (const sec of ['grapes', 'map', 'palate']) { await wait(sec === 'grapes' ? 4700 : 5000); await panel(sec); await scrollTo('[data-section="' + sec + '"]', 1900); }
  // 7. Vinny: the question typed, and the answer.
  await part(22.0, 'Ask <b>Vinny</b> anything.', 'vinny', () => go('home'));
  await after(WIDE ? 2.4 : 1.0); await page.locator('input[aria-label="Ask Vinny"]').pressSequentially(VINNY.q, { delay: 62 });
  await wait(500); await tap('button[aria-label="Ask"]');
  await wait(400); await page.evaluate(() => { const el = document.activeElement; if (el && el.blur) el.blur(); });
  T = (Date.now() - t0) / 1000;
  // 8. My Wines.
  await part(5.2, 'Every bottle, <b>remembered</b>.', 'wines', () => go('mywines'));
  await wait(1400); await scroll(300, 3800);
  // 9. The end.
  await after(5.0); await slide('The wine app built just for <b>you</b>.', { logo: true, sub: 'Free on iPhone and Android.', get: 'vinterest.app/get' }); await wait(500); await panel(null);
  await after(4.6);
  const SECONDS = Math.ceil(T);
  await wait(300);
  rec = false;
  await cdp.send('Page.stopScreencast').catch(() => {});
  await context.close();

  if (frames.length < 20) throw new Error('only ' + frames.length + ' frames were captured');
  const total = SECONDS * FPS, feed = (stdin) => { let i = 0;
    // Each tick takes the last frame painted before it, and the one just after instead when that one
    // is closer and the two are near neighbours: while the app animates, the browser paints at about
    // the film's own rate, and taking the nearer of the two keeps the spacing even instead of doubling
    // one frame and dropping the next. Across a long pause (nothing moving, or the app busy) it holds
    // the frame that was on screen rather than showing the next one early.
    const NEAR = 60;
    const write = (k) => { if (k >= total) return stdin.end(); const t = t0 + (k * 1000) / FPS;
      while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
      const next = frames[i + 1];
      const j = next && next.t - frames[i].t <= NEAR && next.t - t < t - frames[i].t ? i + 1 : i;
      if (stdin.write(frames[j].data)) setImmediate(() => write(k + 1)); else stdin.once('drain', () => write(k + 1)); };
    stdin.on('error', () => {}); write(0); };
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0'];
  const full = fullFfmpeg();
  // The music (ANNOUNCE_MUSIC, or the git-ignored assets/announce-music.*: a licensed track is never
  // committed to this public repository) fades in over a second and out over the last three; a track
  // shorter than the film comes round again. Without one the film is silent.
  const sound = MUSIC ? ['-stream_loop', '-1', '-ss', String(Number(process.env.ANNOUNCE_MUSIC_START || 0)), '-i', MUSIC, '-map', '0:v', '-map', '1:a',
    '-af', `afade=t=in:st=0:d=1,afade=t=out:st=${SECONDS - 3}:d=3,loudnorm=I=-14:TP=-1.5:LRA=11`, '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-t', String(SECONDS)] : [];
  await run(full, [...input, ...sound, '-vf', 'scale=' + FORMAT.size, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), ...FORMAT.enc, '-movflags', '+faststart', OUT], feed);
  // The cover: the opening slide with all its words in.
  const poster = frames.filter((f) => f.t <= t0 + 2400).pop() || frames[0]; // the last frame painted by then: the nearest one could be the next slide, before its words
  await run(full, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-i', 'pipe:0', '-vf', 'scale=' + FORMAT.size, '-q:v', '3', OUT.replace(/\.mp4$/, '-cover.jpg')], (s) => { s.end(poster.data); });
  if (process.env.ANNOUNCE_DEBUG) { const per = {}; frames.forEach((f) => { const sec = Math.floor((f.t - t0) / 1000); per[sec] = (per[sec] || 0) + 1; });
    console.log('frames a second: ' + Object.keys(per).map((k) => k + ':' + per[k]).join(' ')); }
  const gaps = frames.slice(1).map((f, i) => ({ ms: f.t - frames[i].t, at: ((frames[i].t - t0) / 1000).toFixed(1) })).sort((a, b) => b.ms - a.ms);
  console.log(`Capture: ${(frames.length / SECONDS).toFixed(1)} frames a second; the longest gaps were ` + gaps.slice(0, 6).map((g) => `${g.ms}ms at ${g.at}s`).join(', '));
  console.log(`Saved ${path.relative(ROOT, OUT)} (${SECONDS}s, ${frames.length} painted frames) and its cover`);
} finally {
  await browser.close();
  server.kill();
}
