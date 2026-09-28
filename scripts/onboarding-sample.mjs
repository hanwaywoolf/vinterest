// Fills in data/onboarding-sample.json's "slides" from its hand-written "user", using the app's own
// engines in a real page (dist/): WineDNA.profile, TasteMatch.assess, ContentEngine.because and
// KnowledgeMap's grape area. The welcome slides render only what this saves, so they show genuine
// app output without computing anything, reading anyone's data or calling an API at runtime.
// Run after `npm run build`: node scripts/onboarding-sample.mjs
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
    return { match, dna, vinny: u.vinny, article: stub, mastery: grapesArea };
  }, fixture.user);
} finally {
  await browser.close();
  server.kill();
}
fs.writeFileSync(FILE, JSON.stringify(fixture, null, 2) + '\n');
console.log(JSON.stringify(fixture.slides, null, 2));
