// Records the App Store's App preview: twenty seconds of the app alone (Apple allows only footage of the
// app itself: no phone frame, no title cards), with one short line over the foot of each part. 886 x 1920,
// 30 fps, the size App Store Connect takes for every iPhone slot. Run after `npm run build`:
// `npm run store:preview`.
//
// The app plays in real time for the sample user and every frame the browser paints is taken at twice the
// phone's size (Chrome's screencast), so the film is as sharp as a phone's screen. Nothing calls Claude: the
// label read and scan cards are stubbed, like the tests. It always writes video/app-preview.webm. Apple
// wants H.264 with a sound track, which the ffmpeg that comes with Playwright can't write, so where a full
// ffmpeg is installed (GitHub's runners: Actions -> App preview -> Run workflow) it also writes
// video/app-preview.mp4 with a silent track, ready to upload.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4183, W = 443, H = 960, SCALE = 2, FPS = 30, SECONDS = 20;
const OUT = path.join(ROOT, 'video/app-preview.webm');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WINE = { name: 'Viña Real Gran Reserva', confidence: 'high', alternative: '', producer: 'CVNE', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alavesa',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.72, tannins: 0.58, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'leather', 'vanilla'], food_pairings: ['Roast lamb', 'Manchego', 'Mushroom risotto'], price_usd: 48,
  description: 'A classic Gran Reserva from CVNE.' };
const GEN = { fact: 'CVNE was founded in Haro in 1879, beside the railway that carried Rioja to Bordeaux.',
  talk: ['Gran Reserva means it rested at least five years before release, two of them in oak'] };

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
  const wines = SAMPLE.user.wines.map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 5, 15 - i * 3)).toISOString() }));
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all';
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9', vinterest_detail_intro: '1',
        vinterest_xp_v3: JSON.stringify({ version: 1, accounts: { local: { total: 1240, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: [], quizCompleted: {}, quizStreaks: {} } } }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }
    let s = 0x2f6b1a;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/index.html#camera`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-testid="scan-file"]').waitFor({ state: 'attached', timeout: 30000 });

  /* One line over the foot of the screen: a soft black fade behind it, the words changing with a short
     cross-fade. It covers the navigation, which nobody needs to read in a film. */
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}' +
      '#pv{position:fixed;left:0;right:0;bottom:0;height:230px;z-index:99999;pointer-events:none;display:flex;align-items:flex-end;justify-content:center;' +
      'padding:0 26px 62px;box-sizing:border-box;background:linear-gradient(to bottom,rgba(8,6,7,0) 0%,rgba(8,6,7,0.86) 46%,rgba(8,6,7,0.97) 100%)}' +
      '#pv span{font:600 27px/1.18 Poppins,sans-serif;letter-spacing:-0.3px;color:#fff;text-align:center;opacity:0;transform:translateY(8px);transition:opacity .28s ease,transform .28s ease}' +
      '#pv span.on{opacity:1;transform:none}#pv b{font-weight:600;color:#ff8fa3}';
    document.head.appendChild(st);
    const d = document.createElement('div'); d.id = 'pv'; d.innerHTML = '<span></span>'; document.body.appendChild(d);
    window.__cap = (html) => { const s = d.firstChild; s.className = ''; setTimeout(() => { s.innerHTML = html; s.className = 'on'; }, 240); };
  });
  const caption = (html) => page.evaluate((h) => window.__cap(h), html);
  /* A finger's swipe across the story: left moves on, right goes back. */
  const swipe = (back) => page.evaluate(async (back) => {
    const st = document.querySelector('.rv-stage'); if (!st) return;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.5, a = r.left + r.width * 0.74, b = r.left + r.width * 0.26, x0 = back ? b : a, x1 = back ? a : b;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 16)); ev('pointermove', x0 + (x1 - x0) * (i / 6)); }
    ev('pointerup', x1);
  }, !!back);
  // The sample user has studied a little, so Mastery has a shape (as in the trailer).
  await page.evaluate(() => {
    WineHistory.getAll().forEach((w) => { try { ScanFlow.unlockLearning({ ...w, confidence: 'high' }); } catch (e) {} });
    const answer = (setId, pool, n) => (pool || []).slice(0, n).forEach((q) => QuizMastery.recordAnswer(setId, q.q, true));
    [['red_grapes', 14], ['white_grapes', 6], ['rose', 3], ['sparkling', 5]].forEach(([t, n]) => answer('topic:' + t, QuizMastery.topicPool(t), n));
    try { ['Rioja', 'Rhône Valley', 'Mendoza'].forEach((r, i) => answer(RegionQuizBank.setId(r), RegionQuizBank.get(r), [14, 9, 7][i])); } catch (e) {}
    _loadJSON('data/onramp.json').slice(0, 4).forEach((a) => Store.set('vinterest_' + a.id + '_done', '1'));
    const m = KnowledgeMap.compute(WineHistory.getAll()), then = Date.now() - 35 * 864e5, a = {};
    m.areas.forEach((x) => { a[x.id] = Math.round(x.score * 0.55); });
    Store.setJSON(KnowledgeMap.HISTORY_KEY, { [KnowledgeMap._week(then)]: { t: then, o: Math.round(m.overall * 0.55), a } });
    KnowledgeMap.note(m);
    ScanFlow.REVEAL_MIN_MS = 120000; // the swipes below set the story's pace
  });
  const go = async (hash, f, ms, delay = 550) => {
    await page.evaluate((h) => { window.location.hash = '#' + h; }, hash);
    await wait(delay);
    await page.evaluate(([f, ms]) => {
      const els = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; });
      const s = els[0]; if (!s) return;
      const to = f * (s.scrollHeight - s.clientHeight), t0 = performance.now();
      const tick = (t) => { const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; s.scrollTop = to * e; if (u < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, [f, ms]);
  };

  // Every painted frame, with the time it was painted.
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let rec = false;
  cdp.on('Page.screencastFrame', (f) => { if (rec) frames.push({ t: Date.now(), data: Buffer.from(f.data, 'base64') }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });

  await page.locator('[data-testid="scan-file"]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('reveal-scene').waitFor({ timeout: 15000 });
  // On to the second scene and back, so the first one draws afresh on film.
  await swipe(); await wait(700); await swipe(true);
  await caption('Scan any <b>label</b>.');
  await wait(350);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  rec = true;
  const t0 = Date.now();
  const at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));

  // The film, second by second.
  await at(2.6); await caption("Know if you'll <b>love</b> it."); await swipe();
  await at(5.9); await caption("Every bottle's <b>story</b>."); await swipe(); // how it'll feel
  await at(7.4); await swipe(); // the grape
  await at(9.3); await swipe(); // the place
  await at(12.6); await caption('Your taste, <b>mapped</b>.'); await go('profile', 0.3, 2300);
  await at(15.4); await caption('Learn as you <b>sip</b>.'); await go('mastery-map', 0.1, 1700);
  await at(17.8); await caption('Every bottle, <b>remembered</b>.'); await go('mywines', 0.3, 1700);
  await at(SECONDS + 0.2);
  rec = false;
  await cdp.send('Page.stopScreencast').catch(() => {});
  await context.close();

  // The browser paints when something changes, so frames arrive unevenly: lay them on a steady 30 a second,
  // each tick showing the newest frame painted by then.
  if (frames.length < 20) throw new Error('only ' + frames.length + ' frames were captured');
  const total = SECONDS * FPS, feed = (stdin) => { let i = 0;
    const write = (k) => { if (k >= total) return stdin.end(); const t = t0 + (k * 1000) / FPS; while (i + 1 < frames.length && frames[i + 1].t <= t) i++;
      if (stdin.write(frames[i].data)) setImmediate(() => write(k + 1)); else stdin.once('drain', () => write(k + 1)); };
    stdin.on('error', () => {}); write(0); };
  const input = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(FPS), '-i', 'pipe:0'];
  const size = `scale=${W * SCALE}:${H * SCALE}`;
  const pw = pwFfmpeg(), full = fullFfmpeg();
  if (pw || full) { await run(pw || full, [...input, '-c:v', 'libvpx', '-b:v', '8M', '-crf', '6', '-pix_fmt', 'yuv420p', OUT], feed); // Playwright's ffmpeg has no scale filter: frames are already full size
    console.log(`Saved ${path.relative(ROOT, OUT)} (${SECONDS}s, ${frames.length} painted frames)`); }
  if (full) { const mp4 = OUT.replace(/\.webm$/, '.mp4');
    await run(full, [...input, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-vf', size, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-shortest', '-movflags', '+faststart', mp4], feed);
    console.log(`Saved ${path.relative(ROOT, mp4)} (H.264 with a silent track, for App Store Connect)`); }
  else console.log('No ffmpeg with H.264 here: run the App preview workflow on GitHub for the .mp4 Apple takes.');
} finally {
  await browser.close();
  server.kill();
}
