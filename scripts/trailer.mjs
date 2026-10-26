// Renders the app's feature films and trailer (site/video/trailer.html) to video/: the real app, driven
// scene by scene in a phone frame beside big captions. 1920 x 1080, 25 fps, no sound (music is added
// afterwards). Run after `npm run build`:
//   TRAILER_ONLY=scan npm run trailer      one feature's film (the title card, that section, the end card)
//   npm run trailer                        every section in turn: the full trailer
//
// It is rendered a frame at a time against a paused browser clock (Playwright's clock), with every CSS
// animation and transition stepped to the film's time by hand (`stepAnims`: the Web Animations API,
// since the clock doesn't drive those), so the film is smooth and its timing exact whatever the machine
// is doing; a screen recording of the page dropped frames whenever a scene was busy. Each frame is a
// JPEG piped into the ffmpeg Playwright ships (it only reads piped JPEGs and writes VP8 WebM).
//
// Nothing here calls Claude: the label read and the scan cards are stubbed with the sample bottle below,
// like the tests. The camera is a canvas showing the bottle's product shot (site/video/ardanza.png), so
// the label scan is seen happening.
//
// Inside the page, nothing may wait on a timer or a frame (a setTimeout, a requestAnimationFrame loop
// awaited from Node): the clock only moves between frames, from here. Swipes and the dial are therefore
// dispatched as pointer events in one go, or a step per frame.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
const PORT = 4181, W = 1920, H = 1080, FPS = 25;
const ONLY = process.env.TRAILER_ONLY || '';
const OUT = process.env.TRAILER_OUT || path.join(ROOT, `video/${ONLY ? 'film-' + ONLY : 'trailer'}.webm`);
const T0 = new Date('2026-06-20T18:00:00Z'); // the film's clock: a June evening, after the sample user's last scan

// The bottle in the camera: the sample user's favourite house, another vintage of a wine they rated 94,
// so the match leads with "same wine, another vintage".
const WINE = { name: 'Viña Ardanza Reserva', confidence: 'high', alternative: '', producer: 'La Rioja Alta', vintage: 2020, region: 'Rioja', sub_region: 'Rioja Alta',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Garnacha'], blend: true, grapes_basis: 'known', grape_shares: null, body: 0.62, tannins: 0.5, acidity: 0.62, sweetness: 0.03, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'vanilla', 'tobacco'], food_pairings: ['Roast lamb', 'Manchego', 'Chorizo'], price_usd: 38, description: 'A classic Reserva from La Rioja Alta.' };
const GEN = { fact: 'La Rioja Alta was founded in 1890 by five families from Rioja and the Basque Country who pooled resources to make wine together.',
  fit: 'x', caution: 'x', origin: 'x', region_style: 'x', estate: 'x',
  talk: ['Ardanza is a Tempranillo-led blend that rests in oak for years before release', 'x', 'x'], fact2: 'x' };
// What Claude really wrote for the sample user (the website demos' capture), so WineDNA's script reads as it does in the app.
const CAPTURED = JSON.parse(fs.readFileSync(path.join(ROOT, 'site/demo/captured.json'), 'utf8')).answers;
const LABEL_SCAN_S = 1.7; // how long "Analysing label…" shows over the photo

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'site/video/trailer.html'), path.join(ROOT, 'dist/trailer.html'));
fs.copyFileSync(path.join(ROOT, 'site/video/ardanza.png'), path.join(ROOT, 'dist/ardanza.png'));
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const FFMPEG = fs.readdirSync('/opt/pw-browsers').filter((d) => d.startsWith('ffmpeg')).map((d) => path.join('/opt/pw-browsers', d, 'ffmpeg-linux')).find((f) => fs.existsSync(f)) || 'ffmpeg';
const browser = await chromium.launch();
let enc = null;
try {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-GB', timezoneId: 'Europe/London' });
  // The sample user (the onboarding slides' Rioja drinker), onboarded, Pro for Mastery, with nothing left to
  // explain (reveal tips, the WineDNA welcome, the camera's gallery hint), and the scan story on.
  const wines = SAMPLE.user.wines.map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 5, 15 - i * 3)).toISOString() }));
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all';
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9', vinterest_gallery_hint_v1: '9',
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
        setInterval(draw, 200); // keeps frames flowing to the <video>
        res(stream);
      };
      img.onerror = rej;
      img.src = '/ardanza.png';
    });
    /* Every CSS animation and transition stepped to the film's clock: paused the first time it's seen,
       then given the time since. The paused clock doesn't drive them, so without this they'd run on
       the real time the screenshots take. */
    window.__stepAnims = (now) => {
      const seen = (window.__animSeen ||= new WeakMap());
      for (const a of document.getAnimations()) {
        let start = seen.get(a);
        if (start == null) { start = now; seen.set(a, start); try { a.pause(); } catch (e) {} }
        try { a.currentTime = Math.max(0, now - start); } catch (e) {}
      }
    };
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  let scanRoute = null; // the label read, held until the film has shown the reading
  await context.route('**/claude', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.purpose === 'label_scan') { scanRoute = route; return; }
    const text = b.purpose === 'scancard' ? JSON.stringify(GEN)
      : b.purpose === 'winedna_summary' ? CAPTURED.winedna_summary
      : b.purpose === 'sommelier_script' ? CAPTURED.sommelier_long : '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  await context.clock.install({ time: T0 });
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn('page error:', e.message));
  await page.goto(`http://localhost:${PORT}/trailer.html`);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.__load('/index.html#home'));
  const app = () => page.frame({ name: 'app' });
  await page.waitForFunction(() => { const f = window.frames[0]; return f && f.document && f.document.querySelector('#root [class]'); }, null, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 800));
  await app().evaluate(() => { const st = document.createElement('style'); st.textContent = '.xp-chip,[data-testid="moment-card"]{display:none !important}'; document.head.appendChild(st); });
  // The story's scenes would move on by themselves; the swipes below set the pace instead.
  await app().evaluate(() => { ScanFlow.REVEAL_MIN_MS = 120000; });
  await context.clock.pauseAt(new Date(T0.getTime() + 10000));

  /* ── The film's clock and the frame pipeline ── */
  let frameN = 0, clock = 0; // frames written; the start of the current section, in seconds
  const now = () => frameN / FPS; // the film's time
  const stepAnims = async () => { const ms = now() * 1000; await page.evaluate((ms) => window.__stepAnims(ms), ms); const f = app(); if (f) await f.evaluate((ms) => window.__stepAnims(ms), ms).catch(() => {}); };
  const frame = async () => {
    await context.clock.runFor(1000 / FPS);
    await stepAnims();
    const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
    if (!enc.stdin.write(buf)) await new Promise((r) => enc.stdin.once('drain', r));
    frameN++;
    if (frameN % 100 === 0) console.log(`  ${now().toFixed(0)}s`);
  };
  /* Run the film on to `s` seconds into the current section. */
  const at = async (s) => { while (now() < clock + s - 1e-6) await frame(); };
  /* Run frames until the app shows what fn looks for (at most `max` seconds). */
  const until = async (fn, arg, max = 15) => { const end = now() + max; while (now() < end) { if (await app().evaluate(fn, arg)) return true; await frame(); }
    await page.screenshot({ path: path.join(ROOT, 'video/trailer-stuck.png') }); console.log('  stuck on: ' + await app().evaluate(() => (document.querySelector('#root')?.innerText || '').slice(0, 300).replace(/\n+/g, ' | ')));
    throw new Error('Not seen: ' + fn); };
  const caption = (title, sub) => page.evaluate(([a, b]) => window.__caption(a, b), [title, sub || '']);
  /* A finger's swipe left across the phone's story, as one gesture: pointer events on the story's stage
     itself (the page's mouse doesn't reach into the scaled iframe). */
  const swipe = () => app().evaluate(() => {
    const st = document.querySelector('.rv-stage'); if (!st) return false;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.55, x0 = r.left + r.width * 0.72, x1 = r.left + r.width * 0.28;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0); for (let i = 1; i <= 4; i++) ev('pointermove', x0 + (x1 - x0) * (i / 4)); ev('pointerup', x1);
    return true;
  });
  /* A tap on the first element whose own text matches, inside the app. */
  const tap = (re) => app().evaluate((src) => {
    const re = new RegExp(src);
    const own = (n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
    const el = Array.from(document.querySelectorAll('*')).find((n) => re.test(own(n)));
    if (el) el.click(); return !!el;
  }, re.source);
  /* The rating dial turned by a finger over `secs`: it lands on the arc's start and turns round to
     `to`, a step a frame (the dial follows the angle turned, so it ends on `to`). */
  const turnDial = async (to, secs) => {
    const steps = Math.round(secs * FPS);
    for (let i = 0; i <= steps; i++) {
      await app().evaluate(([to, u, first]) => {
        const d = document.querySelector('[role="slider"][aria-label="Rating"]'); if (!d) return;
        const min = Number(d.getAttribute('aria-valuemin')), max = Number(d.getAttribute('aria-valuemax')), r = d.getBoundingClientRect();
        const at = (v) => { const deg = (-135 + (v - min) / (max - min) * 270) * Math.PI / 180; return { x: r.left + (100 + 76 * Math.sin(deg)) / 200 * r.width, y: r.top + (104 - 76 * Math.cos(deg)) / 180 * r.height }; };
        const ev = (type, p) => d.dispatchEvent(new PointerEvent(type, { clientX: p.x, clientY: p.y, bubbles: true, cancelable: true, pointerId: 2, pointerType: 'touch', isPrimary: true, button: 0 }));
        if (first) ev('pointerdown', at(min)); // the finger lands on the arc's start, then turns
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        ev('pointermove', at(min + (to - min) * e));
        if (u >= 1) { ev('pointerup', at(to)); for (let k = 0; k < 6; k++) { const n = Number(d.getAttribute('aria-valuenow')); if (n === to) break; d.dispatchEvent(new KeyboardEvent('keydown', { key: n < to ? 'ArrowRight' : 'ArrowLeft', bubbles: true })); } }
      }, [to, i / steps, i === 0]);
      await frame();
    }
  };
  /* Open a screen (by hash) and, over `secs`, glide its scroller f of the way down with an ease in and out. */
  const go = async (hash, f, secs, settle = 0.7) => {
    await app().evaluate((h) => { window.location.hash = '#' + h; }, hash);
    await at(now() - clock + settle);
    const steps = Math.round(secs * FPS);
    for (let i = 1; i <= steps; i++) {
      await app().evaluate(([f, u]) => {
        const els = [...document.querySelectorAll('#root div')].filter((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10; });
        const s = els[0]; if (!s) return;
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        s.scrollTop = f * (s.scrollHeight - s.clientHeight) * e;
      }, [f, i / steps]);
      await frame();
    }
  };
  /* Glide the screen's scroller over `secs` so the element `sel` (a selector) sits at the top, eased, from wherever it is. */
  const glide = async (sel, secs, gap = 12) => {
    const steps = Math.round(secs * FPS);
    let from = null;
    for (let i = 1; i <= steps; i++) {
      from = await app().evaluate(([sel, u, from, gap]) => {
        const el = document.querySelector(sel); if (!el) return null;
        const s = [...document.querySelectorAll('#root div')].find((e) => { const cs = getComputedStyle(e); return /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 10 && e.contains(el); });
        if (!s) return null;
        if (from == null) from = s.scrollTop;
        const to = Math.max(0, Math.min(s.scrollHeight - s.clientHeight, s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - gap));
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        s.scrollTop = from + (to - from) * e;
        return from;
      }, [sel, i / steps, from, gap]);
      if (from == null) { console.log('  glide: nothing at ' + sel); return false; }
      await frame();
    }
    return true;
  };
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
  const sceneIs = (k) => { const s = document.querySelector('[data-testid="reveal-scene"]'); return !!s && s.getAttribute('data-scene') === k; };

  /* ── The sections. Each runs with `at` from its own start and returns its length. ── */
  const SECTIONS = {
    // The scan: the label in the camera, the shutter, the story scene by scene, then the rating.
    async scan() {
      await app().evaluate(() => { window.location.hash = '#camera'; });
      await until(() => !!document.querySelector('[aria-label="Take photo"]'), null);
      await at(0.4);
      await caption('Scan any <b>label</b>.', 'A bottle, a wine list, or a photo from your library.');
      await at(2.4); await app().evaluate(() => document.querySelector('[aria-label="Take photo"]').click());
      // "Analysing label…" over the photo (the read is held), then the reading arrives and the story opens on the label.
      while (!scanRoute && now() < clock + 10) await frame();
      console.log(`  label read ${scanRoute ? 'held' : 'NOT seen'} at ${(now() - clock).toFixed(1)}s`);
      await at(2.4 + LABEL_SCAN_S);
      if (scanRoute) { await scanRoute.fulfill({ contentType: 'application/json', body: JSON.stringify({ text: JSON.stringify(WINE) }) }); scanRoute = null; }
      await until(sceneIs, 'label', 20);
      // 1. The label, with where the vintage is in its life.
      await at(4.6); await caption('Who made it, and <b>when to drink it</b>.', 'The wine, the vintage, and where it is in its life.');
      await at(8.2); await swipe();
      // 2. The match.
      await at(8.6); await caption("Know if you'll <b>love</b> it.", "A match from your own ratings, not a critic's.");
      await at(12.8); await swipe();
      // 3. How it'll feel.
      await at(13.2); await caption('How it will <b>taste</b>.', 'Body, tannins and acidity in everyday words.');
      await at(16.2); await swipe();
      // 4. The grape.
      await at(16.6); await caption('Meet the <b>grape</b>.', "What's in the glass, and what to expect from it.");
      await at(20.4); await swipe();
      // 5. The region: the map closes in on it.
      await at(20.8); await caption('And the <b>region</b>.', 'Where it grew, and how the climate shapes it.');
      await at(25.8); await swipe();
      // 6. One thing to say: skipped straight through to the rating.
      await at(26.0); await swipe();
      // 7. Rate it on the dial.
      await at(26.5); await caption('<b>Rate</b> it.', 'One turn of the dial, and your next match gets sharper.');
      await at(27.4); await turnDial(92, 1.6);
      await at(29.6); await tap(/^Save rating$/);
      await at(31.2);
      return 31.2;
    },
    /* WineDNA: the red tab, read down section by section, each held long enough to take in. */
    async dna() {
      await app().evaluate(() => { window.location.hash = '#profile'; });
      await until(() => !!document.querySelector('[data-testid="dna-rules"]'), null);
      await at(0.4);
      await caption('Your <b>WineDNA</b>.', 'Your taste, worked out from every bottle you\'ve rated.');
      await at(3.6); await glide('[data-section="rules"]', 1.4);
      await caption('What to <b>reach for</b>.', 'Next time you\'re buying: written from what lifts your own ratings, with the evidence.');
      await at(9.4); await glide('[data-section="portrait"]', 1.4);
      await caption('Your <b>portrait</b>.', 'Where the wines you choose sit, from light to full, soft to grippy.');
      await at(15.6); await glide('[data-section="scripts"]', 1.4);
      await caption('<b>What to say</b> to a sommelier.', 'Your taste in a sentence, ready for the wine list.');
      await at(21.4); await glide('[data-section="moves"]', 1.4);
      await caption('Why you rate what you <b>rate</b>.', 'Grapes, regions and producers, as points above or below your average.');
      await at(27.4); await glide('[data-section="house"]', 1.4);
      await caption('The bottles you\'d <b>buy again</b>.', 'And Restock, straight to the shops that have them.');
      await at(32.6); await glide('[data-section="explore"]', 1.4);
      await caption('Where to go <b>next</b>.', 'Styles picked from your DNA, a step from what you already love.');
      await at(37.8); await glide('[data-section="knows"]', 1.4);
      await caption('How well we <b>know you</b>.', 'Every match checked against the rating you gave.');
      await at(44.0);
      return 44.0;
    },
    // Placeholders, carried over from the first cut; each is rebuilt in turn.
    async learn() {
      await study();
      await caption('Learn as you <b>sip</b>.', 'Quizzes, short reads and Mastery, built from your bottles.'); await go('learn', 0.4, 1.8);
      await at(2.3); await go('mastery-map', 0.12, 1.5, 0.45);
      await at(4.5); return 4.5;
    },
    async wines() {
      await caption('Every bottle, <b>remembered</b>.', 'What you drank, what you paid, what you thought of it.'); await go('mywines', 0.45, 2.0);
      await at(2.6); return 2.6;
    },
  };
  const order = ONLY ? [ONLY] : ['scan', 'dna', 'learn', 'wines'];
  for (const name of order) if (!SECTIONS[name]) throw new Error('Unknown section: ' + name);

  // The encoder, then the film: the title card, the sections, the end card.
  enc = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '8M', '-crf', '6', '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const encoded = new Promise((res, rej) => { enc.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg failed')))); enc.on('error', rej); });
  await at(2.6); await page.evaluate(() => window.__begin());
  clock = 2.6;
  for (const name of order) { console.log(`section ${name} at ${clock.toFixed(1)}s`); const len = await SECTIONS[name](); clock += len; }
  await page.evaluate(() => window.__end());
  await at(3.0);
  enc.stdin.end();
  await encoded;
  console.log(`Saved ${path.relative(ROOT, OUT)} (${now().toFixed(1)}s${ONLY ? ', section ' + ONLY : ''})`);
} finally {
  fs.rmSync(path.join(ROOT, 'dist/trailer.html'), { force: true });
  fs.rmSync(path.join(ROOT, 'dist/ardanza.png'), { force: true });
  await browser.close();
  server.kill();
}
