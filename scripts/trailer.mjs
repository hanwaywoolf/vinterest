// Records the app's trailer (site/video/trailer.html) to video/trailer.webm: the real app, driven scene by
// scene in a phone frame beside big captions. The scan story (label, match, grape, place), WineDNA, Learn
// and Mastery, My Wines, then the end card. About 30 seconds, 1920 x 1080, 25 fps, no sound (music is
// added afterwards). Run after `npm run build`: `npm run trailer`.
//
// It plays in real time and is captured by Playwright's screen recording (VP8 WebM, which YouTube takes as
// it is), so what's on film is what the app did, animations and all. Nothing here calls Claude: the label
// read and the scan cards are stubbed with the sample bottle below, like the tests.
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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WINE = { name: 'Viña Real Gran Reserva', confidence: 'high', alternative: '', producer: 'CVNE', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alavesa',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.72, tannins: 0.58, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'leather', 'vanilla'], food_pairings: ['Roast lamb', 'Manchego', 'Mushroom risotto'], price_usd: 48, description: 'A classic Gran Reserva from CVNE.' };
const GEN = { fact: 'CVNE was founded in Haro in 1879, beside the railway that carried Rioja to Bordeaux.', fit: 'x', caution: 'x', origin: 'x', region_style: 'x', estate: 'x',
  talk: ['Gran Reserva means it rested at least five years before release, two of them in oak', 'x', 'x'], fact2: 'x' };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'site/video/trailer.html'), path.join(ROOT, 'dist/trailer.html'));
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await wait(800);
const videoDir = fs.mkdtempSync(path.join(path.dirname(OUT), 'rec-'));
const browser = await chromium.launch();
let videoPath = null;
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
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const recStart = Date.now();
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/trailer.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__load('/index.html#camera'));
  const app = () => page.frame({ name: 'app' });
  await page.waitForFunction(() => { const f = window.frames[0]; return f && f.document && f.document.querySelector('[data-testid="scan-file"]'); }, null, { timeout: 30000 });
  await app().evaluate(() => { const st = document.createElement('style'); st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}'; document.head.appendChild(st); });
  const box = await page.locator('#app').boundingBox();
  const caption = (title, sub) => page.evaluate(([a, b]) => window.__caption(a, b), [title, sub || '']);
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
  /* The sample user has studied a little, so Mastery has a shape (the site demo's study history, replayed
     through the app's own modules). */
  await app().evaluate(() => {
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
  // The story's scenes would move on by themselves; the swipes below set the pace instead.
  await app().evaluate(() => { ScanFlow.REVEAL_MIN_MS = 120000; });
  const t0 = recStart; // the film starts with the recording: the title card, then the phone fades in on the story
  const at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));

  // The film, second by second.
  await app().locator('[data-testid="scan-file"]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await scene().waitFor({ timeout: 15000 });
  await at(2.6); await page.evaluate(() => window.__begin());
  await at(3.1); await caption('Scan any <b>label</b>.', 'The wine, the vintage, and where it is in its life.');
  await at(5.8); await caption("Know if you'll <b>love</b> it.", "A match from your own ratings, not a critic's."); await swipe();
  await at(9.3); await swipe(); // how it'll feel
  await at(11.0); await caption('Meet the <b>grape</b>, and the place.', "Every scan tells the bottle's story."); await swipe();
  await at(13.3); await swipe(); // the map
  await at(15.7); await caption('Your <b>WineDNA</b>.', 'What you reach for, and what lifts your ratings.'); await go('profile', 0.5, 3900);
  await at(20.5); await caption('Learn as you <b>sip</b>.', 'Quizzes, short reads and Mastery, built from your bottles.'); await go('learn', 0.4, 1800);
  await at(22.8); await go('mastery-map', 0.12, 1500, 450);
  await at(25.0); await caption('Every bottle, <b>remembered</b>.', 'What you drank, what you paid, what you thought of it.'); await go('mywines', 0.45, 2000);
  await at(27.6); await page.evaluate(() => window.__end());
  await at(30.4);
  videoPath = await page.video().path();
  await context.close();
  // The recording has a blank fifth of a second before the page paints and runs on while the browser
  // closes: keep the thirty seconds from the first painted frame, re-encoded at a higher quality.
  const FFMPEG = fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('ffmpeg')).map((d) => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || 'ffmpeg';
  await new Promise((res, rej) => { const ff = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-ss', '0.2', '-t', '30', '-c:v', 'libvpx', '-b:v', '8M', '-crf', '6', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', OUT], { stdio: 'inherit' });
    ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))); ff.on('error', rej); });
  console.log(`Saved ${path.relative(ROOT, OUT)} (30s)`);
} finally {
  fs.rmSync(path.join(ROOT, 'dist/trailer.html'), { force: true });
  fs.rmSync(videoDir, { recursive: true, force: true });
  await browser.close();
  server.kill();
}
