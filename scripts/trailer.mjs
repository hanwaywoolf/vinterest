// Records the app's trailer (site/video/trailer.html) to video/trailer.webm: the real app, driven scene by
// scene in a phone frame beside big captions. About sixty seconds, 1920 x 1080, 25 fps, no sound (music
// is added afterwards). Run after `npm run build`: `npm run trailer`.
//
// It is built in sections (SECTIONS below), each a run of the app with its own captions, so one can be
// recorded alone to look at: `TRAILER_ONLY=scan npm run trailer` gives the title card, that section and
// the end card. Without TRAILER_ONLY the sections play one after another.
//
// It plays in real time and is captured by Playwright's screen recording (VP8 WebM, which YouTube takes as
// it is), so what's on film is what the app did, animations and all. Nothing here calls Claude: the label
// read and the scan cards are stubbed with the sample bottle below, like the tests. The camera is a canvas
// showing the bottle's product shot (site/video/ardanza.png), so the label scan is seen happening.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4181, W = 1920, H = 1080;
const OUT = process.env.TRAILER_OUT || path.join(ROOT, 'video/trailer.webm');
const ONLY = process.env.TRAILER_ONLY || '';

// The bottle in the camera: the sample user's favourite house, another vintage of a wine they rated 94,
// so the match leads with "same wine, another vintage".
const WINE = { name: 'Viña Ardanza Reserva', confidence: 'high', alternative: '', producer: 'La Rioja Alta', vintage: 2020, region: 'Rioja', sub_region: 'Rioja Alta',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Garnacha'], blend: true, grapes_basis: 'known', grape_shares: null, body: 0.62, tannins: 0.5, acidity: 0.62, sweetness: 0.03, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'vanilla', 'tobacco'], food_pairings: ['Roast lamb', 'Manchego', 'Chorizo'], price_usd: 38, description: 'A classic Reserva from La Rioja Alta.' };
const GEN = { fact: 'La Rioja Alta was founded in 1890 by five families from Rioja and the Basque Country who pooled resources to make wine together.',
  fit: 'x', caution: 'x', origin: 'x', region_style: 'x', estate: 'x',
  talk: ['Ardanza is a Tempranillo-led blend that rests in oak for years before release', 'x', 'x'], fact2: 'x' };
const LABEL_SCAN_MS = 1700; // how long "Analysing label…" shows over the photo

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'site/video/trailer.html'), path.join(ROOT, 'dist/trailer.html'));
fs.copyFileSync(path.join(ROOT, 'site/video/ardanza.png'), path.join(ROOT, 'dist/ardanza.png'));
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await wait(800);
const videoDir = fs.mkdtempSync(path.join(path.dirname(OUT), 'rec-'));
const browser = await chromium.launch();
let videoPath = null, length = 0;
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London',
    recordVideo: { dir: videoDir, size: { width: W, height: H } } });
  // The sample user (the onboarding slides' Rioja drinker), onboarded, Pro for Mastery, with nothing left to
  // explain (reveal tips, the WineDNA welcome), and the scan story on.
  const wines = SAMPLE.user.wines.map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 5, 15 - i * 3)).toISOString() }));
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all';
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9',
        vinterest_xp_v3: JSON.stringify({ total: 1240 }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }
    let s = 0x2f6b1a; // the same Math.random every run
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    // The camera: a canvas with the bottle's product shot on a dark table, as a stream, so the camera
    // screen shows the label being held up and the shutter captures it.
    if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = () => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 720; c.height = 1560;
        const g = c.getContext('2d');
        const draw = () => {
          const bg = g.createRadialGradient(360, 700, 80, 360, 700, 900); bg.addColorStop(0, '#2a2022'); bg.addColorStop(1, '#0b0a0a');
          g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
          const h = 1250, w = h * img.width / img.height, x = (c.width - w) / 2, y = (c.height - h) / 2 + 30;
          g.shadowColor = 'rgba(0,0,0,0.7)'; g.shadowBlur = 60; g.shadowOffsetY = 20;
          g.drawImage(img, x, y, w, h);
          g.shadowBlur = 0;
        };
        draw();
        const stream = c.captureStream(25);
        // Keep the frame flowing: a still canvas can stop delivering frames to the <video>.
        setInterval(draw, 200);
        res(stream);
      };
      img.onerror = rej;
      img.src = '/ardanza.png';
    });
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.purpose === 'label_scan') await wait(LABEL_SCAN_MS);
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const recStart = Date.now();
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/trailer.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__load('/index.html#home'));
  const app = () => page.frame({ name: 'app' });
  await page.waitForFunction(() => { const f = window.frames[0]; return f && f.document && f.document.querySelector('#root [class]'); }, null, { timeout: 30000 });
  await wait(600);
  await app().evaluate(() => { const st = document.createElement('style'); st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}'; document.head.appendChild(st); });
  const caption = (title, sub) => page.evaluate(([a, b]) => window.__caption(a, b), [title, sub || '']);
  const glow = (c) => page.evaluate((c) => window.__glow(c), c);
  /* A finger's swipe left across the phone's story: pointer events on the story's stage itself (the page's
     mouse doesn't reach into the scaled iframe). */
  const swipe = () => app().evaluate(async () => {
    const st = document.querySelector('.rv-stage'); if (!st) return;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.55, x0 = r.left + r.width * 0.72, x1 = r.left + r.width * 0.28;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 16)); ev('pointermove', x0 + (x1 - x0) * (i / 6)); }
    ev('pointerup', x1);
  });
  /* A tap on the first element whose own text matches, inside the app. */
  const tap = (re) => app().evaluate((src) => {
    const re = new RegExp(src);
    const own = (n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
    const el = Array.from(document.querySelectorAll('*')).find((n) => re.test(own(n)));
    if (el) el.click(); return !!el;
  }, re.source);
  /* The rating dial turned by a finger from its start round to `to`, over ms: pointer events on the arc. */
  const turnDial = (to, ms) => app().evaluate(async ([to, ms]) => {
    const d = document.querySelector('[role="slider"][aria-label="Rating"]'); if (!d) return false;
    const min = Number(d.getAttribute('aria-valuemin')), max = Number(d.getAttribute('aria-valuemax'));
    const r = d.getBoundingClientRect();
    const at = (v) => { const deg = (-135 + (v - min) / (max - min) * 270) * Math.PI / 180; return { x: r.left + (100 + 76 * Math.sin(deg)) / 200 * r.width, y: r.top + (104 - 76 * Math.cos(deg)) / 180 * r.height }; };
    const ev = (type, p) => d.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0 }));
    // The finger starts on the centre text (a turn from the unset dial's minimum, without landing),
    // goes to the arc's start and round to `to`: the dial follows the angle turned, so it ends on `to`.
    ev('pointerdown', { x: r.left + r.width / 2, y: r.top + r.height * 104 / 180 });
    ev('pointermove', at(min));
    const t0 = performance.now();
    await new Promise((done) => { const tick = (t) => { const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; ev('pointermove', at(min + (to - min) * e)); if (u < 1) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    ev('pointerup', at(to));
    // Rounding can leave it a point off; the arrow keys settle it on the number.
    for (let i = 0; i < 6; i++) { const now = Number(d.getAttribute('aria-valuenow')); if (now === to) break; d.dispatchEvent(new KeyboardEvent('keydown', { key: now < to ? 'ArrowRight' : 'ArrowLeft', bubbles: true })); await new Promise((r) => setTimeout(r, 40)); }
    return true;
  }, [to, ms]);
  /* Open a screen and glide its scroller f of the way down over ms, with an ease in and out. */
  const go = async (hash, f, ms, delay = 700) => {
    await app().evaluate((h) => { window.location.hash = '#' + h; }, hash);
    await wait(delay);
    await app().evaluate(([f, ms]) => {
      const els = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; });
      const s = els[0]; if (!s) return;
      const to = f * (s.scrollHeight - s.clientHeight), t0 = performance.now();
      const tick = (t) => { const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; s.scrollTop = to * e; if (u < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, [f, ms]);
  };
  const scene = () => app().getByTestId('reveal-scene');
  /* The sample user has studied a little, so Mastery has a shape (the site demo's study history, replayed
     through the app's own modules). */
  const study = () => app().evaluate(() => {
    WineHistory.getAll().forEach((w) => { try { ScanFlow.unlockLearning({ ...w, confidence: 'high' }); } catch (e) {} });
    const answer = (setId, pool, n) => (pool || []).slice(0, n).forEach((q) => QuizMastery.recordAnswer(setId, q.q, true));
    [['red_grapes', 14], ['white_grapes', 6], ['rose', 3], ['sparkling', 5]].forEach(([t, n]) => answer('topic:' + t, QuizMastery.topicPool(t), n));
    try { ['Rioja', 'Rhône Valley', 'Mendoza'].forEach((r, i) => answer(RegionQuizBank.setId(r), RegionQuizBank.get(r), [14, 9, 7][i])); } catch (e) {}
    _loadJSON('data/onramp.json').slice(0, 4).forEach((a) => Store.set('vinterest_' + a.id + '_done', '1'));
    const m = KnowledgeMap.compute(WineHistory.getAll()), then = Date.now() - 35 * 864e5, a = {};
    m.areas.forEach((x) => { a[x.id] = Math.round(x.score * 0.55); });
    Store.setJSON(KnowledgeMap.HISTORY_KEY, { [KnowledgeMap._week(then)]: { t: then, o: Math.round(m.overall * 0.55), a } });
    KnowledgeMap.note(m);
  });
  // The story's scenes would move on by themselves; the swipes below set the pace instead.
  await app().evaluate(() => { ScanFlow.REVEAL_MIN_MS = 120000; });
  const t0 = recStart; // the film starts with the recording: the title card, then the phone fades in
  let clock = 0;
  const at = async (s) => { const late = Date.now() - (t0 + (clock + s) * 1000); if (late > 400) console.warn(`  ${(clock + s).toFixed(1)}s: ${(late / 1000).toFixed(1)}s late`); await wait(Math.max(0, -late)); };

  /* ── The sections. Each takes `s`, its start in the film, and uses times relative to it. ── */
  const SECTIONS = {
    // The scan, 27s: the label in the camera, the shutter, the story scene by scene, then the rating.
    async scan() {
      await app().evaluate(() => { window.location.hash = '#camera'; });
      await app().locator('[aria-label="Take photo"]').waitFor({ timeout: 15000 });
      await wait(400);
      await caption('Scan any <b>label</b>.', 'Point your phone at the bottle. That\'s all.');
      await at(2.2); await app().evaluate(() => document.querySelector('[aria-label="Take photo"]').click());
      await scene().waitFor({ timeout: 20000 });
      // 1. The label, with where the vintage is in its life.
      await at(4.4); await caption('Who made it, and <b>when to drink it</b>.', 'The wine, the vintage, and where it is in its life.');
      await at(8.0); await swipe();
      // 2. The match.
      await at(8.4); await caption("Know if you'll <b>love</b> it.", "A match from your own ratings, not a critic's.");
      await at(12.6); await swipe();
      // 3. How it'll feel.
      await at(13.0); await caption('How it will <b>taste</b>.', 'Body, tannins and acidity in everyday words.');
      await at(16.0); await swipe();
      // 4. The grape.
      await at(16.4); await caption('Meet the <b>grape</b>.', 'Sketched, with what to notice about it.');
      await at(20.2); await swipe();
      // 5. The place: the map closes in on the region.
      await at(20.6); await caption('And the <b>place</b>.', 'The map closes in on where it was made.');
      await at(25.6); await swipe();
      // 6. One thing to say: skipped straight through to the rating.
      await at(25.8); await swipe();
      // 7. Rate it on the dial.
      await at(26.3); await caption('<b>Rate</b> it.', 'One turn of the dial, and your next match gets sharper.');
      await at(27.2); await turnDial(92, 1600);
      await at(29.4); await tap(/^Save rating$/);
      await at(31.0);
      return 31.0;
    },
    // Placeholders, carried over from the first cut; each is rebuilt in turn.
    async dna() {
      await caption('Your <b>WineDNA</b>.', 'What you reach for, and what lifts your ratings.'); await go('profile', 0.5, 3900);
      await at(5.0); return 5.0;
    },
    async learn() {
      await study();
      await caption('Learn as you <b>sip</b>.', 'Quizzes, short reads and Mastery, built from your bottles.'); await go('learn', 0.4, 1800);
      await at(2.3); await go('mastery-map', 0.12, 1500, 450);
      await at(4.5); return 4.5;
    },
    async wines() {
      await caption('Every bottle, <b>remembered</b>.', 'What you drank, what you paid, what you thought of it.'); await go('mywines', 0.45, 2000);
      await at(2.6); return 2.6;
    },
  };
  const order = ONLY ? [ONLY] : ['scan', 'dna', 'learn', 'wines'];
  for (const name of order) if (!SECTIONS[name]) throw new Error('Unknown section: ' + name);

  // The film: the title card, then the sections, then the end card.
  await at(2.6); await page.evaluate(() => window.__begin());
  clock = 2.6;
  for (const name of order) { const len = await SECTIONS[name](); clock += len; }
  await page.evaluate(() => window.__end());
  await at(3.0);
  length = clock + 3.0;
  videoPath = await page.video().path();
  const elapsed = (Date.now() - recStart) / 1000;
  await context.close();
  // The recording has a blank fifth of a second before the page paints and runs on while the browser
  // closes: keep the film from the first painted frame, re-encoded at a higher quality. The recorder
  // falls behind a busy page (its clip comes out longer than the time that passed, about a tenth), so
  // the clip's timestamps are scaled back to real time (-itsscale: Playwright's ffmpeg has no filters) from how long the recording actually took.
  const FFMPEG = fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('ffmpeg')).map((d) => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || 'ffmpeg';
  const probe = await new Promise((res) => { let err = ''; const ff = spawn(FFMPEG, ['-hide_banner', '-i', videoPath]); ff.stderr.on('data', (d) => { err += d; }); ff.on('exit', () => res(err)); });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe), rawLen = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : elapsed;
  const speed = rawLen / elapsed; // > 1: the clip runs slow
  console.log(`recorded ${rawLen.toFixed(1)}s for ${elapsed.toFixed(1)}s of film: speed ${speed.toFixed(3)}`);
  await new Promise((res, rej) => { const ff = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-itsscale', (1 / speed).toFixed(4), '-i', videoPath, '-r', '25', '-ss', '0.2', '-t', String(length), '-c:v', 'libvpx', '-b:v', '8M', '-crf', '6', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', OUT], { stdio: 'inherit' });
    ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))); ff.on('error', rej); });
  console.log(`Saved ${path.relative(ROOT, OUT)} (${length.toFixed(1)}s${ONLY ? ', section ' + ONLY : ''})`);
} finally {
  fs.rmSync(path.join(ROOT, 'dist/trailer.html'), { force: true });
  fs.rmSync(path.join(ROOT, 'dist/ardanza.png'), { force: true });
  fs.rmSync(videoDir, { recursive: true, force: true });
  await browser.close();
  server.kill();
}
