// Fills in data/onboarding-sample.json's "slides" from its hand-written "user", using the app's own
// engines in a real page (dist/): WineDNA.profile, TasteMatch.assess, ContentEngine.because and
// KnowledgeMap's grape area. The welcome slides render only what this saves, so they show genuine
// app output without computing anything, reading anyone's data or calling an API at runtime.
// Vinny's answer is real too: the generator builds Vinny's prompt for this user (Vinny.prompt, from
// their WineDNA) and sends it once through the app's own /claude proxy (VINNY_ENDPOINT, default the
// live site), so no API key is needed here. If the proxy can't be reached, the last captured answer
// is kept, or the hand-written placeholder is used and marked as such.
// Run after `npm run build`: node scripts/onboarding-sample.mjs (behind an HTTPS proxy, e.g. a cloud
// session, with NODE_USE_ENV_PROXY=1 so Node's fetch uses it).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = path.join(ROOT, 'data/onboarding-sample.json');
const fixture = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const PORT = 4179;

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // A clean page priced in pounds: nothing of anyone's own is in it.
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('vinterest_region', 'uk'); localStorage.setItem('vinterest_currency', 'GBP'); });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => typeof WineDNA !== 'undefined' && typeof TasteMatch !== 'undefined');
  fixture.slides = await page.evaluate((u) => {
    const wines = u.wines;
    const p = WineDNA.profile('red', wines, 'Reds');
    // Slide 1: the scan result for the bottle they point the camera at.
    const m = TasteMatch.assess(u.scanned, wines);
    const good = m.reasons.find((r) => r.tone === 'good'), bad = m.reasons.find((r) => r.tone === 'bad');
    const match = { pct: m.pct, tone: m.tone, label: m.label, expected: m.expected, expectedLabel: m.expectedLabel, chance: m.chance,
      reasons: [good, bad].filter(Boolean).map((r) => ({ tone: r.tone, text: r.text })) };
    // Slide 2: the WineDNA tab for reds, as the screen reads it from WineDNA.profile.
    const fav = p.favourites;
    const chips = [];
    if (p.topGrapes[0]) chips.push({ label: 'Top grape', value: p.topGrapes[0] });
    if (p.topRegions[0]) chips.push({ label: 'Most scanned', value: p.topRegions[0] });
    if (fav.regions[0]) chips.push({ label: 'Top-scoring region', value: `${fav.regions[0].name} · ${fav.regions[0].avg}` });
    const dna = { key: 'red', label: 'Reds', personality: p.personality, basis: p.basis, lovedCount: p.loved.length, wineCount: p.wines.length,
      scoredCount: p.scored.length, confidence: p.confidence, chips, axes: p.axes.filter(p.showAxis),
      avg: p.avg, lovedAvg: p.lovedAvg, axisNotes: p.axisNotes, sweetSpot: p.value && p.value.sweetSpot };
    // Slide 4: a Written for you card from the real archetype, and the Grapes area of the mastery map.
    const arch = _loadJSON('data/archetypes.json').find((a) => a.id === u.article.archetype);
    const fill = (t) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => u.article.slots[k]);
    const stub = { id: 'sample', title: fill(arch.titleTpl), subtitle: fill(arch.subtitleTpl), iconName: arch.iconName, readTime: arch.readTime, series: arch.series || null, slots: { region: u.article.slots.region } };
    stub.because = ContentEngine.because({ slots: { region: u.article.slots.regionB } }, wines);
    const K = KnowledgeMap, items = u.grapes.map((g) => { const score = K._pct(g.quiz * 0.7 + Math.min(1, g.reads / 2) * 0.3); return { name: g.name, score, level: K.level(score), quiz: Math.round(g.quiz * 100), reads: g.reads }; });
    const realItems = K._items; K._items = () => items;
    const grapesArea = K._listArea('grape', wines, []);
    K._items = realItems;
    const vinnyPrompts = u.vinny.map((v) => Vinny.prompt(v.q, [], wines));
    return { match, dna, vinnyPrompts, article: stub, mastery: grapesArea };
  }, fixture.user);
  // The Vinny slide's backdrop: the sample user's Home, as the app draws it, in a clean page with
  // nothing of anyone's own and no calls out (Claude answers nothing).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const home = await ctx.newPage();
  await ctx.route('**/claude', (r) => r.fulfill({ contentType: 'application/json', body: '{"text":""}' }));
  await home.addInitScript((wines) => {
    localStorage.clear();
    const stamp = Date.now();
    localStorage.setItem('vinterest_wines', JSON.stringify(wines.filter((w) => w.rating || w.scan_intent).map((w, i) => ({ ...w, scanned_at: new Date(stamp - i * 86400000 * 3).toISOString() }))));
    Object.entries({ vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP' }).forEach(([k, v]) => localStorage.setItem(k, v));
  }, fixture.user.wines);
  await home.goto(`http://localhost:${PORT}/#home`);
  await home.waitForTimeout(1500);
  await home.screenshot({ path: path.join(ROOT, 'onboarding-home.jpg'), type: 'jpeg', quality: 72 });
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
// Vinny, asked for real.
const ENDPOINT = process.env.VINNY_ENDPOINT || 'https://vinterest.pages.dev/claude';
const before = JSON.parse(fs.readFileSync(FILE, 'utf8')).slides;
const prompts = fixture.slides.vinnyPrompts; delete fixture.slides.vinnyPrompts;
fixture.slides.vinny = [];
for (const [i, v] of fixture.user.vinny.entries()) {
  let answer = null;
  try {
    const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ purpose: 'wine_qa', messages: [{ role: 'user', content: prompts[i] }] }) });
    const j = await r.json();
    if (r.ok && j.text) answer = String(j.text).trim();
    else console.warn(`Vinny: ${r.status} ${j.error || ''}`);
  } catch (e) { console.warn(`Vinny: couldn't reach ${ENDPOINT} (${e.message})`); }
  const kept = before && before.vinny && before.vinny[i] && before.vinny[i].q === v.q && before.vinny[i].source === 'vinny' ? before.vinny[i] : null;
  fixture.slides.vinny.push(answer ? { q: v.q, a: answer, source: 'vinny', captured: new Date().toISOString().slice(0, 10) }
    : kept || { q: v.q, a: v.placeholder, source: 'placeholder' });
}
fs.writeFileSync(FILE, JSON.stringify(fixture, null, 2) + '\n');
console.log(JSON.stringify(fixture.slides, null, 2));
