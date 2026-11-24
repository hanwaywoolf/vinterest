// Records the App Store's App preview: thirty seconds in four parts, each opening on a card that says in
// large text what the app does, followed by the app doing it: a scan (its match, its grape, its region),
// WineDNA's portrait, a quiz question answered, and Vinny answering. The cards are in the app's own look
// (Poppins on the dark stage, crimson accents) and fade into the footage. 886 x 1920, 30 fps, the size App
// Store Connect takes for every iPhone slot. Run after `npm run build`: `npm run store:preview`.
//
// The app plays in real time for the sample user and every frame the browser paints is taken at twice the
// phone's size (Chrome's screencast), so the film is as sharp as a phone's screen. Nothing calls Claude: the
// label read and scan cards are stubbed, like the tests. It always writes video/app-preview.webm. Apple
// wants H.264 with a sound track, which the ffmpeg that comes with Playwright can't write, so where a full
// ffmpeg is installed (GitHub's runners: Actions -> App preview -> Run workflow) it also writes
// video/app-preview.mp4, with the music in assets/preview-music.* (its licence in docs/app-store.md) faded
// in and out, or a silent track when there's no music file.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4183, W = 443, H = 960, SCALE = 2, FPS = 30, SECONDS = 30;
const OUT = path.join(ROOT, 'video/app-preview.webm');
const MUSIC = ['mp3', 'm4a', 'ogg', 'wav', 'flac'].map((x) => path.join(ROOT, 'assets/preview-music.' + x)).find((f) => fs.existsSync(f)) || null;
const MUSIC_START = Number(process.env.PREVIEW_MUSIC_START || 0); // seconds into the track the film starts on

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
// When each thing starts, in seconds. A card takes CARD seconds, fades included; the footage follows it.
const CARD = 2.0, FADE = 0.4;
const T = { scan: 0, grape: 5.5, place: 8.2, dna: 12.2, quiz: 17.7, tap: 21.3, vinny: 23.3 };
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
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all'; window.VINTEREST_WHATSNEW = 'off';
    window.VINTEREST_QUIZ_SPEED = 0.45; // the quiz's own animations, a little slower for the film
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
  await context.route('**/claude', async (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const prompt = String((b.messages && b.messages[0] && b.messages[0].content) || '');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : b.purpose === 'wine_qa' ? VINNY.a
      : b.purpose === 'winedna_summary' ? CAPTURED.winedna_summary : b.purpose === 'sommelier_script' ? (/^Condense/.test(prompt) ? CAPTURED.sommelier_short : CAPTURED.sommelier_long) : '';
    if (b.purpose === 'wine_qa') await wait(700); // long enough to see Vinny thinking
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/index.html#camera`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-testid="scan-file"]').waitFor({ state: 'attached', timeout: 30000 });

  /* The cards: a full screen in the app's own look (the dark stage with a crimson glow, a crimson rule, the
     headline large in Poppins with its telling words in the lifted crimson, one smaller line under it),
     fading in over the footage and out onto the next. A soft dot shows where a finger taps. */
  await page.evaluate((fade) => {
    const st = document.createElement('style');
    st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}' +
      '#pvc{position:fixed;inset:0;z-index:99999;pointer-events:none;display:flex;flex-direction:column;justify-content:center;gap:22px;padding:0 38px 40px;box-sizing:border-box;' +
      'background:radial-gradient(circle at 50% 30%,rgba(139,26,47,0.55),rgba(139,26,47,0) 62%),#0b0708;opacity:0;transition:opacity ' + fade + 's ease}#pvc.on{opacity:1}' +
      '#pvc i{display:block;width:44px;height:4px;border-radius:2px;background:#C8324F}' +
      '#pvc h1{margin:0;font:700 50px/1.08 Poppins,sans-serif;letter-spacing:-1.2px;color:#fff}#pvc b{font-weight:700;color:#ff8fa3}' +
      '#pvc p{margin:0;font:400 21px/1.4 Poppins,sans-serif;color:rgba(255,255,255,0.72)}' +
      '#pvt{position:fixed;z-index:99998;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;pointer-events:none;background:rgba(255,255,255,0.28);' +
      'border:1.5px solid rgba(255,255,255,0.6);opacity:0;transform:scale(1.5);transition:opacity .3s ease,transform .3s ease}#pvt.on{opacity:1;transform:scale(1)}';
    document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'pvc'; document.body.appendChild(c);
    const t = document.createElement('div'); t.id = 'pvt'; document.body.appendChild(t);
    window.__card = (head, sub) => { if (head) c.innerHTML = '<i></i><h1>' + head + '</h1><p>' + sub + '</p>'; c.className = head ? 'on' : ''; };
    window.__touch = (x, y) => { t.style.left = x + 'px'; t.style.top = y + 'px'; t.className = 'on'; setTimeout(() => { t.className = ''; }, 520); };
  }, FADE);
  const showCard = (head, sub) => page.evaluate(([h, s]) => window.__card(h, s), [head || '', sub || '']);
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
    // The film goes from the match straight to the grape: the story's taste scene is left out of this cut.
    const reveal = ScanFlow.reveal; ScanFlow.reveal = function () { const d = reveal.apply(this, arguments); d.traits = []; return d; };
  });
  /* A part of the film: its card fades in at `t`, the screen it introduces is set up behind it (`before`
     runs in the page ahead of the hash change, `ready` once the screen is there), and the card fades out
     onto that screen's own entrance. */
  const part = async (t, head, sub, hash, ready, before) => {
    await at(t); await showCard(head, sub); await wait(FADE * 1000 + 80);
    if (before) await page.evaluate(before);
    if (hash) await page.evaluate((h) => { window.location.hash = '#' + h; }, hash);
    if (ready) await ready();
    await at(t + CARD - FADE); await showCard(null);
  };
  let t0 = 0;
  const at = (s) => wait(Math.max(0, t0 + s * 1000 - Date.now()));

  // Every painted frame, with the time it was painted.
  const cdp = await context.newCDPSession(page);
  const frames = [];
  let rec = false;
  cdp.on('Page.screencastFrame', (f) => { if (rec) frames.push({ t: Date.now(), data: Buffer.from(f.data, 'base64') }); cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {}); });

  await page.locator('[data-testid="scan-file"]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('reveal-scene').waitFor({ timeout: 15000 });
  await showCard('Scan any <b>bottle</b>.', 'See your match, its grape and where it comes from.'); await wait(700);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, everyNthFrame: 1 });
  rec = true;
  t0 = Date.now();

  // 1. A scan: the match dial sweeping up to its verdict, the grape drawn, the map closing in on the region.
  await at(T.scan + CARD - FADE); await swipe(); await showCard(null);
  await at(T.grape); await swipe();
  await at(T.place); await swipe();
  // 2. WineDNA: the portrait's scales arriving one after another.
  await part(T.dna, 'Your taste, as <b>WineDNA</b>.', 'Worked out from the wines you rate.', 'profile', async () => {
    await page.getByTestId('dna-taste-tiles').waitFor({ timeout: 5000 });
    await at(T.dna + CARD - FADE - 0.1);
    await page.evaluate(() => { const el = document.querySelector('[data-testid="dna-taste-tiles"]'), top = el.getBoundingClientRect().top;
      let s = el.parentElement; while (s && !(/(auto|scroll)/.test(getComputedStyle(s).overflowY) && s.scrollHeight > s.clientHeight + 10)) s = s.parentElement;
      if (s) s.scrollTop += top - 150;
      // Behind the card the rows have already arrived: play their entrance again as it lifts.
      el.querySelectorAll('.dna-row').forEach((r, i) => { r.style.animation = 'none'; void r.offsetWidth; r.style.animation = ''; r.style.animationDuration = '.8s'; r.style.animationDelay = (0.3 + i * 0.5) + 's'; }); });
  });
  // 3. A quiz question: the right answer tapped, and lit green.
  await part(T.quiz, 'Learn as you <b>sip</b>.', 'Quick quizzes on the grapes and regions you drink.', 'quiz', () => page.locator('.qz-opt').first().waitFor({ timeout: 5000 }),
    () => { Handoff.quiz.set({ mode: 'practice', topicId: 'red_grapes' }); });
  await at(T.tap);
  await page.evaluate(() => { const shown = document.querySelector('.qz-in').textContent.trim(); const q = QuizMastery.topicPool('red_grapes').find((x) => x.q.trim() === shown);
    const want = q ? String(q.opts[q.a]).trim() : null, opts = [...document.querySelectorAll('.qz-opt')];
    const o = opts.find((o) => o.lastElementChild.textContent.trim() === want) || opts[0], r = o.getBoundingClientRect();
    window.__touch(r.left + r.width * 0.62, r.top + r.height / 2); setTimeout(() => o.click(), 330); });
  // 4. Vinny: the question typed, and the answer.
  await part(T.vinny, 'Ask <b>Vinny</b> anything.', 'Answers from your own taste.', 'home', () => page.locator('input[aria-label="Ask Vinny"]').waitFor({ timeout: 5000 }));
  await at(T.vinny + CARD + 0.15); await page.locator('input[aria-label="Ask Vinny"]').pressSequentially(VINNY.q, { delay: 36 });
  await wait(350); await page.locator('button[aria-label="Ask"]').click();
  await page.evaluate(() => { const el = document.activeElement; if (el && el.blur) el.blur(); });
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
    // The music fades in over the first second and out over the last two; without a track, silence.
    const sound = MUSIC ? ['-ss', String(MUSIC_START), '-i', MUSIC, '-af', `afade=t=in:st=0:d=1,afade=t=out:st=${SECONDS - 2}:d=2,loudnorm=I=-16:TP=-1.5:LRA=11,apad`]
      : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100'];
    await run(full, [...input, ...sound, '-map', '0:v', '-map', '1:a', '-vf', size, '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-r', String(FPS), '-b:v', '10M', '-maxrate', '12M', '-bufsize', '20M', '-c:a', 'aac', '-b:a', '256k', '-ar', '44100', '-ac', '2', '-t', String(SECONDS), '-movflags', '+faststart', mp4], feed);
    console.log(`Saved ${path.relative(ROOT, mp4)} (H.264 with ${MUSIC ? 'music from ' + path.relative(ROOT, MUSIC) : 'a silent track'}, for App Store Connect)`); }
  else console.log('No ffmpeg with H.264 here: run the App preview workflow on GitHub for the .mp4 Apple takes.');
} finally {
  await browser.close();
  server.kill();
}
