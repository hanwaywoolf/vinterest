// The App Store and Google Play screenshots: the real app, for the onboarding sample user (the Rioja
// drinker), each screen set under a headline on the welcome screens' dark stage with its crimson glow.
// Writes store-shots/iphone-6.3-N.jpg (1206 x 2622, "iPhone with Dynamic Island (medium display)", the
// slot App Store Connect asks for first), iphone-6.9-N.jpg (1320 x 2868, the large iPhones) and
// ipad-N.jpg (2064 x 2752, the 13" iPad). JPEG because Apple
// refuses a screenshot with an alpha channel. Run after `npm run build`: `npm run store:shots`.
//
// Nothing calls Claude: the label read, the scan story's lines and Vinny's answer are stubbed below, as
// the trailer and the tests do.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SAMPLE = require(path.join(ROOT, 'data/onboarding-sample.json'));
// Claude's WineDNA summary and sommelier script for the sample user, as the website's demos use them.
const CAPTURED = require(path.join(ROOT, 'site/demo/captured.json')).answers;
const OUT = process.env.STORE_SHOTS_OUT || path.join(ROOT, 'store-shots');
const PORT = 4183;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WINE = { name: 'Viña Real Gran Reserva', confidence: 'high', alternative: '', producer: 'CVNE', vintage: 2016, region: 'Rioja', sub_region: 'Rioja Alavesa',
  country: 'Spain', type: 'red', grapes: ['Tempranillo', 'Graciano'], blend: true, grapes_basis: 'label', body: 0.72, tannins: 0.58, acidity: 0.62, sweetness: 0.05, texture: null,
  effervescence: null, abv: 13.5, tasting_notes: ['dried cherry', 'leather', 'vanilla'], food_pairings: ['Roast lamb', 'Manchego', 'Mushroom risotto'], price_usd: 48, description: 'A classic Gran Reserva from CVNE.' };
const GEN = { fact: 'CVNE was founded in Haro in 1879, beside the railway that carried Rioja to Bordeaux.', fit: 'x', caution: 'x', origin: 'x', region_style: 'x', estate: 'x',
  talk: ['Gran Reserva means it rested at least five years before release, two of them in oak', 'x', 'x'], fact2: 'x' };
// A shop shelf as the shelf reader returns it: one bottle they've rated (shown by their rating, first),
// the rest matched from their other wines.
const SHELF = { u: 0, wines: [
  { n: 'Reserva', pr: 'Marqués de Riscal', t: 'red', r: 'Rioja', c: 'Spain', v: 2019, p: '16.00', g: 'Tempranillo', s: '766' },
  { n: 'Crozes-Hermitage', pr: 'E. Guigal', t: 'red', r: 'Crozes-Hermitage', c: 'France', v: 2020, p: '19.00', g: 'Syrah', s: '776' },
  { n: 'Viña Ardanza Reserva', pr: 'La Rioja Alta', t: 'red', r: 'Rioja', c: 'Spain', v: 2016, p: '32.00', g: 'Tempranillo', s: '766' },
  { n: 'Bourgogne Pinot Noir', pr: 'Louis Jadot', t: 'red', r: 'Burgundy', c: 'France', v: 2021, p: '17.00', g: 'Pinot Noir', s: '366' },
  { n: 'Gran Reserva', pr: 'Faustino I', t: 'red', r: 'Rioja', c: 'Spain', v: 2012, p: '24.00', g: 'Tempranillo', s: '756' },
  { n: 'Côtes du Rhône Réserve', pr: 'Famille Perrin', t: 'red', r: 'Côtes du Rhône', c: 'France', v: 2021, p: '11.00', g: 'Grenache', s: '665' },
] };
const QUESTION = 'Steak tonight. What should I look for?';
const ANSWER = "Go for a Malbec from Mendoza. It has the ripe dark fruit of the Riojas you rate highest, with firmer tannins to stand up to the steak. You gave the 2021 Catena Malbec an 89, so start there, or try a Ribera del Duero for Tempranillo with more grip.";

// Each screenshot: its headline (the <b> word in crimson), the line under it, and how to get there.
const SHOTS = [
  { id: 'match', title: "Know if you'll <b>love</b> it.", sub: "Scan a label. Your match comes from your own ratings, not a critic's.", scene: 1 },
  { id: 'shelf', title: 'Scan a whole <b>shelf</b>.', sub: 'Or a wine list. Every bottle matched to your taste, best first.', hash: 'winelist', shelf: true },
  { id: 'dna', title: 'Your taste, in <b>words</b>.', sub: 'WineDNA shows what you reach for and what lifts your ratings.', hash: 'profile' },
  { id: 'vinny', title: 'Ask <b>Vinny</b> anything.', sub: "Answers that know every wine you've had.", hash: 'home', vinny: true },
  { id: 'story', title: 'Every bottle has a <b>story</b>.', sub: 'The grape, the place and something to say about it.', scene: 3 },
  { id: 'learn', title: 'Learn as you <b>sip</b>.', sub: 'Quizzes and short reads, written from your bottles.', hash: 'learn' },
  { id: 'quiz', title: 'Five questions, <b>no pressure</b>.', sub: 'Quick quizzes on your grapes and regions. Learn a fact with every answer.', hash: 'quiz', quiz: true },
  { id: 'mastery', title: 'Watch your knowledge <b>grow</b>.', sub: 'Every grape and region you study, on one map.', hash: 'mastery-map' },
  { id: 'wines', title: 'Every bottle, <b>remembered</b>.', sub: 'What you drank, what you paid and what you thought of it.', hash: 'mywines' },
];
// The app as each device shows it (CSS pixels and scale), and the finished picture (CSS pixels at 3x or 2x).
const DEVICES = [
  { name: 'iphone-6.9', app: { width: 393, height: 852, scale: 3 }, out: { width: 440, height: 956, scale: 3 }, frame: { top: 214, width: 352, radius: 44 }, h1: 34, sub: 15.5 },
  // "iPhone with Dynamic Island (medium display)", the size App Store Connect asks for first: 1206 x 2622.
  { name: 'iphone-6.3', app: { width: 393, height: 852, scale: 3 }, out: { width: 402, height: 874, scale: 3 }, frame: { top: 196, width: 322, radius: 40 }, h1: 31, sub: 14.2 },
  { name: 'ipad', app: { width: 1032, height: 1376, scale: 2 }, out: { width: 1032, height: 1376, scale: 2 }, frame: { top: 236, width: 820, radius: 36 }, h1: 54, sub: 22 },
];

fs.mkdirSync(OUT, { recursive: true });
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await wait(800);
const browser = await chromium.launch();
const wines = SAMPLE.user.wines.map((w, i) => ({ ...w, scanned_at: new Date(Date.UTC(2026, 9, 28 - i * 3)).toISOString() }));

async function appContext(dev) {
  const context = await browser.newContext({ viewport: { width: dev.app.width, height: dev.app.height }, deviceScaleFactor: dev.app.scale, hasTouch: true,
    locale: 'en-GB', timezoneId: 'Europe/London' });
  await context.addInitScript(({ wines }) => {
    window.VINTEREST_REVEAL = 'real'; window.VINTEREST_DETAIL = 'all'; window.VINTEREST_WHATSNEW = 'off';
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      const seed = { vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP', vinterest_pro: '1', vinterest_wines: JSON.stringify(wines),
        vinterest_onramp_1_done: '1', vinterest_wineDNA_unlock_seen: '1', vinterest_dna_welcome_seen: '1', vinterest_reveal_tips_v1: '9',
        vinterest_xp_v3: JSON.stringify({ version: 1, accounts: { local: { total: 1240, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: [], quizCompleted: {}, quizStreaks: {} } } }) };
      for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, v);
    }
    let s = 0x2f6b1a;
    Math.random = () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }, { wines });
  await context.route(/^https?:\/\/(?!localhost[:/])/, (route) => route.fulfill({ contentType: 'text/plain', body: '' }));
  await context.route('**/claude', (route) => {
    const b = JSON.parse(route.request().postData() || '{}');
    const text = b.purpose === 'label_scan' ? JSON.stringify(WINE) : b.purpose === 'scancard' ? JSON.stringify(GEN) : b.purpose === 'wine_qa' ? ANSWER
      : b.purpose === 'sommelier_script' ? CAPTURED.sommelier_long : b.purpose === 'winedna_summary' ? CAPTURED.winedna_summary : '';
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ text }) });
  });
  await context.route('**/me', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ signedIn: false, accounts: false, tier: 'free' }) }));
  return context;
}

const QUIET = '.xp-chip,[data-testid="moment-card"]{display:none !important} *{caret-color:transparent !important}';

// The sample user has studied a little, so Learn and Mastery have something to show (the trailer's history).
async function study(page) {
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
  });
}

async function swipe(page) {
  await page.evaluate(async () => {
    const st = document.querySelector('.rv-stage'); if (!st) return;
    const r = st.getBoundingClientRect(), y = r.top + r.height * 0.55, x0 = r.left + r.width * 0.72, x1 = r.left + r.width * 0.28;
    const ev = (type, x) => st.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', x0);
    for (let i = 1; i <= 6; i++) { await new Promise((r) => setTimeout(r, 16)); ev('pointermove', x0 + (x1 - x0) * (i / 6)); }
    ev('pointerup', x1);
  });
}

// Raw screens of the app, keyed by shot id.
async function capture(dev) {
  const context = await appContext(dev);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.warn(`${dev.name} page error:`, e.message));
  const shots = {};
  await page.goto(`http://localhost:${PORT}/index.html#home`);
  await page.waitForFunction(() => typeof WineHistory !== 'undefined' && document.querySelector('#root *'));
  await page.addStyleTag({ content: QUIET });
  await study(page);
  for (const s of SHOTS.filter((x) => x.hash)) {
    // A shelf scan's results and a Wine Basics quiz are opened the way the app opens them, with their handoff.
    if (s.shelf) await page.evaluate((shelf) => { const r = ScanFlow.shelfWines(JSON.stringify(shelf)); Handoff.wineList.set({ demo: false, shelf: true, wines: r.wines, unread: r.unread, currency: 'GBP' }); }, SHELF);
    if (s.quiz) await page.evaluate(() => Handoff.quiz.set({ mode: 'practice', topicId: 'red_grapes' }));
    await page.evaluate((h) => { window.location.hash = '#' + h; }, s.hash);
    await wait(1600);
    if (s.vinny) {
      const box = page.getByRole('textbox', { name: 'Ask Vinny' });
      await box.click(); await box.fill(QUESTION); await box.press('Enter');
      await page.getByText(ANSWER.slice(0, 30)).first().waitFor({ timeout: 10000 }).catch(() => console.warn('no Vinny answer'));
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await wait(2500);
    }
    // The quiz just after the right answer is tapped: every answer still showing, the right one lit green,
    // the quiz slowed so the picture is taken before the answers slide away.
    if (s.quiz) {
      const right = await page.evaluate(() => {
        const shown = [...document.querySelectorAll('#root *')].map((e) => e.textContent.trim());
        const q = QuizMastery.topicPool('red_grapes').find((x) => shown.includes(x.q));
        return q ? q.opts[q.a] : null;
      });
      // STORE_QUIZ=answer: the verdict and its fact instead, once the answers have gone.
      const tap = process.env.STORE_QUIZ !== 'answer';
      if (tap) await page.evaluate(() => { window.VINTEREST_QUIZ_SPEED = 0.1; });
      if (right) { await page.getByText(right, { exact: true }).first().click(); await wait(tap ? 900 : 3500); }
      else console.warn('quiz: no question found');
    }
    await page.evaluate(() => document.querySelectorAll('#root div').forEach((e) => { e.scrollTop = 0; }));
    await wait(400);
    shots[s.id] = await page.screenshot({ type: 'png' });
  }
  // The scan story: a fresh scan of the sample bottle, swiped to each scene wanted.
  await page.evaluate(() => { window.location.hash = '#camera'; });
  await page.locator('[data-testid="scan-file"]').setInputFiles({ name: 'label.png', mimeType: 'image/png', buffer: PNG });
  await page.getByTestId('reveal-scene').waitFor({ timeout: 15000 });
  await page.evaluate(() => { ScanFlow.REVEAL_MIN_MS = 120000; });
  await page.addStyleTag({ content: QUIET });
  let at = 0;
  for (const s of SHOTS.filter((x) => x.scene != null).sort((a, b) => a.scene - b.scene)) {
    while (at < s.scene) { await swipe(page); at++; await wait(900); }
    await wait(5500); // the scene's picture and words finish drawing
    // Hold the story still for the picture: the progress bar and any running pen strokes stop where they are.
    shots[s.id] = await page.screenshot({ type: 'png' });
  }
  await context.close();
  return shots;
}

// One finished picture: the headline over the app's screen, on the dark stage.
async function compose(dev, shots) {
  const context = await browser.newContext({ viewport: { width: dev.out.width, height: dev.out.height }, deviceScaleFactor: dev.out.scale });
  const page = await context.newPage();
  const f = dev.frame, ratio = dev.app.height / dev.app.width;
  for (const [i, s] of SHOTS.entries()) {
    const img = 'data:image/png;base64,' + shots[s.id].toString('base64');
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/fonts/fonts.css"><style>
html,body{margin:0;width:${dev.out.width}px;height:${dev.out.height}px;overflow:hidden;font-family:Poppins,sans-serif;color:#fff}
.stage{position:absolute;inset:0;background:radial-gradient(ellipse 85% 42% at 50% 2%,#8B1A2Fcc,transparent 72%),radial-gradient(ellipse 70% 40% at 50% 104%,#8B1A2F55,transparent 70%),#0d0d0f}
.copy{position:absolute;left:0;right:0;top:0;height:${f.top}px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:0 ${Math.round(dev.out.width * 0.08)}px}
h1{font-size:${dev.h1}px;line-height:1.08;font-weight:800;letter-spacing:-0.025em;margin:0 0 ${Math.round(dev.h1 * 0.32)}px}
h1 b{color:#F07C93;font-weight:800}
p{font-size:${dev.sub}px;line-height:1.4;color:rgba(255,255,255,.74);margin:0;font-weight:400;max-width:${Math.round(dev.out.width * 0.8)}px}
.shot{position:absolute;left:50%;top:${f.top}px;width:${f.width}px;height:${Math.round(f.width * ratio)}px;transform:translateX(-50%);border-radius:${f.radius}px;overflow:hidden;
  border:1px solid rgba(255,255,255,.16);box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 70px rgba(224,90,116,.18)}
.shot img{display:block;width:100%;height:100%}
</style></head><body><div class="stage"></div><div class="copy"><h1>${s.title}</h1><p>${s.sub}</p></div><div class="shot"><img src="${img}"></div></body></html>`;
    fs.writeFileSync(path.join(ROOT, 'dist/_store-shot.html'), html);
    await page.goto(`http://localhost:${PORT}/_store-shot.html`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => document.querySelector('.shot img').complete);
    const file = path.join(OUT, `${dev.name}-${i + 1}-${s.id}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 92 });
    console.log('Saved', path.relative(ROOT, file));
  }
  await context.close();
}

try {
  const raw = {}; // one capture per app size, shared by the pictures made from it
  for (const dev of DEVICES) {
    const k = `${dev.app.width}x${dev.app.height}`;
    raw[k] = raw[k] || await capture(dev);
    await compose(dev, raw[k]);
  }
} finally {
  fs.rmSync(path.join(ROOT, 'dist/_store-shot.html'), { force: true });
  await browser.close();
  server.kill();
}
