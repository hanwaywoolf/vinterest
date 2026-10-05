// Fills in site/demo/captured.json: the text Claude writes for the website's demo screens (the
// WineDNA summary, the sommelier script and the scan cards' text, the article, and the wine's vintage and education text for the imaginary sample user). The demo page runs the
// app's real code, which builds the real prompts; this sends each once to the app's own /claude proxy
// (VINTEREST_ENDPOINT, default the live site) and saves the answers, so no API key is needed here.
// Run after `npm run site:build`: `npm run site:capture` (behind an HTTPS proxy, e.g. a cloud session,
// with NODE_USE_ENV_PROXY=1 so Node's fetch uses it). Answers that can't be fetched are kept as they were.
// (The short script, which the app makes only if the reader picks Short, isn't part of the demos.)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = path.join(ROOT, 'site/demo/captured.json');
const ENDPOINT = process.env.VINTEREST_ENDPOINT || 'https://vinterest.pages.dev/claude';
const PORT = 4178;
const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));

async function ask(purpose, prompt) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json();
  if (!r.ok || !j.text) throw new Error(`${r.status} ${j.error || ''}`);
  return String(j.text).trim();
}

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const seen = []; // { key, purpose, prompt }
  await page.exposeFunction('__capturePrompt', (purpose, prompt) => {
    const key = purpose === 'price' ? 'price_ardanza' : ['winedna_summary', 'scancard', 'learn_article', 'vintage_info', 'education'].includes(purpose) ? purpose : /^Condense/.test(prompt) ? 'sommelier_short' : 'sommelier_long';
    if (purpose === 'price' && !/Ardanza/.test(prompt)) return ask(purpose, prompt);
    // Quiz banks and the like are generated on screen too; only what the demos use is kept.
    if (!['winedna_summary', 'scancard', 'learn_article', 'vintage_info', 'education', 'price'].includes(purpose) && purpose !== 'sommelier_script') return ask(purpose, prompt);
    return ask(purpose, prompt).then((text) => { seen.push(key); saved.answers[key] = text; console.log(`${key}: ${text.slice(0, 90)}…`); return text; }, (e) => { console.warn(`${key}: ${e.message}`); throw e; });
  });
  await page.addInitScript(() => { window.__demoCapture = (purpose, prompt) => window.__capturePrompt(purpose, prompt); });
  const host = path.join(ROOT, 'site-dist/capture.html');
  fs.writeFileSync(host, '<div id="a" style="width:390px;height:800px;display:flex;flex-direction:column"></div><div id="b" style="width:390px;height:800px;display:flex;flex-direction:column"></div><div id="c" style="width:390px;height:800px;display:flex;flex-direction:column"></div><div id="d" style="width:390px;height:800px;display:flex;flex-direction:column"></div><script src="demo.js"></script>');
  await page.goto(`http://localhost:${PORT}/capture.html`);
  await page.waitForFunction(() => window.VinterestDemo);
  await page.evaluate(() => { window.VinterestDemo.mount(document.getElementById('a'), 'dna'); window.VinterestDemo.mount(document.getElementById('b'), 'deck'); window.VinterestDemo.mount(document.getElementById('c'), 'learn'); window.VinterestDemo.mount(document.getElementById('d'), 'wines'); });
  // The wine's Learn tab asks for its text only once it's opened.
  await page.evaluate(() => { const t = setInterval(() => { const b = Array.from(document.querySelectorAll('#d [data-layer="detail"] *')).find((e) => e.children.length === 0 && /^Learn$/.test(e.textContent.trim())); if (b) { b.click(); clearInterval(t); setTimeout(() => { const c = Array.from(document.querySelectorAll('#d [data-layer="detail"] *')).find((e) => e.children.length === 0 && /^Price$/.test(e.textContent.trim())); if (c) c.click(); }, 4000); } }, 500); });
  // The WineDNA screen asks for the summary and the (long) sommelier script as it opens, and the
  // scan deck for its cards' text.
  // The Mastery demo's study history needs question banks for the grapes and regions the sample user has
  // opened: ask the app to build them (it calls Claude through the hook above), then keep what it cached.
  const BANK_GRAPES = ['Tempranillo', 'Grenache', 'Syrah', 'Malbec', 'Nebbiolo'], BANK_REGIONS = ['Rioja', 'Rhône Valley', 'Mendoza', 'Piedmont'];
  await page.evaluate(([g, r]) => { g.forEach((x) => getGrapeQuiz(x, () => {})); r.forEach((x) => RegionQuizBank.load(x, () => {})); }, [BANK_GRAPES, BANK_REGIONS]);
  for (let i = 0; i < 120; i++) {
    const have = await page.evaluate(([g, r]) => g.filter((x) => grapeQuizBank(x)).length + r.filter((x) => RegionQuizBank.get(x)).length, [BANK_GRAPES, BANK_REGIONS]);
    if (have === BANK_GRAPES.length + BANK_REGIONS.length) break;
    await page.waitForTimeout(1000);
  }
  const banks = await page.evaluate(([g, r]) => { const out = {}; g.forEach((x) => { const k = _grapeQuizCacheKey(x); out[k] = Store.get(k); }); r.forEach((x) => { const k = RegionQuizBank.key(x); out[k] = Store.get(k); }); return out; }, [BANK_GRAPES, BANK_REGIONS]);
  Object.entries(banks).forEach(([k, v]) => { if (v) saved.banks = { ...(saved.banks || {}), [k]: v }; });
  console.log('banks:', Object.keys(saved.banks || {}).length);
  for (let i = 0; i < 90 && !(seen.includes('winedna_summary') && seen.includes('sommelier_long') && seen.includes('scancard') && seen.includes('learn_article') && seen.includes('vintage_info') && seen.includes('education') && seen.includes('price_ardanza')); i++) await page.waitForTimeout(1000);
} finally {
  fs.rmSync(path.join(ROOT, 'site-dist/capture.html'), { force: true });
  await browser.close();
  server.kill();
}
saved.captured = new Date().toISOString().slice(0, 10);
fs.writeFileSync(FILE, JSON.stringify(saved, null, 2) + '\n');
console.log('Saved', Object.keys(saved.answers).join(', '));
