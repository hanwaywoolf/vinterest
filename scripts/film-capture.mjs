// Captures the text Claude writes for the Viña Ardanza Reserva 2020 scan cards (site/video/ardanza-captured.json),
// for the label-scan film. Like site-capture.mjs, the demo page builds the app's real prompts and each goes once to the
// app's own /claude proxy; the film (site/video/scan-demo.html) then answers from the file. Run after `npm run site:build`,
// behind an HTTPS proxy (a cloud session) with NODE_USE_ENV_PROXY=1: `npm run film:capture`.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILE = path.join(ROOT, 'site/video/ardanza-captured.json');
const ENDPOINT = process.env.VINTEREST_ENDPOINT || 'https://vinterest.pages.dev/claude';
const PORT = 4177, KEEP = ['scancard', 'vintage_info', 'education'];
const saved = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : { answers: {} };

async function ask(purpose, prompt) {
  const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ purpose, messages: [{ role: 'user', content: prompt }] }) });
  const j = await r.json();
  if (!r.ok || !j.text) throw new Error(`${r.status} ${j.error || ''}`);
  return String(j.text).trim();
}

const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'site-dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const host = path.join(ROOT, 'site-dist/film-capture.html');
try {
  const page = await browser.newPage();
  const seen = [];
  await page.exposeFunction('__capturePrompt', async (purpose, prompt) => {
    const text = await ask(purpose, prompt);
    if (KEEP.includes(purpose)) { saved.answers[purpose] = text; seen.push(purpose); console.log(`${purpose}: ${text.slice(0, 90)}…`); }
    return text;
  });
  await page.addInitScript(() => { window.__demoCapture = (purpose, prompt) => window.__capturePrompt(purpose, prompt); });
  fs.writeFileSync(host, '<link rel="stylesheet" href="/fonts/fonts.css"/><link rel="stylesheet" href="/site.css"/><div id="a" style="width:390px;height:800px;display:flex;flex-direction:column"></div><script src="/demo.js"></script>');
  await page.goto(`http://localhost:${PORT}/film-capture.html`);
  await page.waitForFunction(() => window.VinterestDemo);
  await page.evaluate(() => {
    Object.assign(DemoPersona.user.scanned, { name: 'Viña Ardanza Reserva', producer: 'La Rioja Alta', vintage: 2020, type: 'Red', country: 'Spain', region: 'Rioja', grapes: ['Tempranillo', 'Garnacha'], body: 0.62, tannins: 0.5, acidity: 0.62, sweetness: 0.03, price_usd: 38 });
    window.VinterestDemo.mount(document.getElementById('a'), 'deck');
  });
  for (let i = 0; i < 9; i++) { await page.evaluate((i) => window.__d = i, i); await page.waitForTimeout(1200); }
  for (let i = 0; i < 60 && !seen.includes('scancard'); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(4000);
} finally {
  fs.rmSync(host, { force: true });
  await browser.close();
  server.kill();
}
fs.writeFileSync(FILE, JSON.stringify(saved, null, 2) + '\n');
console.log('Saved', Object.keys(saved.answers).join(', '));
