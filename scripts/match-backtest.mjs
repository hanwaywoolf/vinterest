// Measures the match engine (TasteMatch, pwa-match.js) against real histories: every scored wine
// is predicted again from the person's other wines alone, as if they were scanning it now, and
// compared with the score they gave. Reports, per history and overall:
//   - error of the expected score: mean absolute error, RMSE, bias (positive = scores higher
//     than we expected), the share within 3 and within 5 points, and how often the score fell
//     inside the predicted spread (about 68% inside ±1 sd and 95% inside ±2 sd when the spread
//     is honest);
//   - calibration of the match %: the Brier score of "clears their bar" against always guessing
//     the base rate (lower is better; below the base rate means the % carries information), and
//     a reliability table (for wines we called 70–80%, how many cleared it);
//   - ranking: of every pair of scored wines of the same type with different scores, how often
//     the one we expected more of was the one they scored higher, by expected score and by %.
// Usage, after `npm run build`:
//   node scripts/match-backtest.mjs [backup.json ...] [--set STYLE_SCALE=0.3 --set PRIOR=0.4] [--json]
// Each file is a Vinterest backup (its `wines`) or a bare array of wines; with none, the
// onboarding sample's user (data/onboarding-sample.json) is used. --set overrides a TasteMatch
// constant for a second run, so a change to the weights is measured before it ships: both the
// baseline and the variant are reported. Nothing leaves the machine; a history is read and
// dropped. It drives the built app in a headless browser (Playwright), so the engine measured
// is the one that ships.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = 4181;
const args = process.argv.slice(2);
const sets = [], files = [];
let json = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--set') sets.push(args[++i]);
  else if (args[i].startsWith('--set=')) sets.push(args[i].slice(6));
  else if (args[i] === '--json') json = true;
  else files.push(args[i]);
}
const overrides = Object.fromEntries(sets.map((s) => { const [k, v] = s.split('='); return [k, Number(v)]; }));

function loadHistory(file) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const wines = Array.isArray(raw) ? raw : raw.wines || (raw.user && raw.user.wines) || [];
  return { name: path.basename(file), wines };
}
const histories = files.length ? files.map(loadHistory)
  : [{ name: 'onboarding sample', wines: JSON.parse(fs.readFileSync(path.join(ROOT, 'data/onboarding-sample.json'), 'utf8')).user.wines }];

if (!fs.existsSync(path.join(ROOT, 'dist/app.js'))) { console.error('No dist/app.js: run `npm run build` first.'); process.exit(1); }
const server = spawn(process.execPath, [path.join(ROOT, 'scripts/serve.mjs'), 'dist', String(PORT)], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const rows = [];
try {
  const page = await browser.newPage();
  await page.addInitScript(() => { localStorage.clear(); window.VINTEREST_REVEAL = 'off'; });
  await page.goto(`http://localhost:${PORT}/`);
  await page.waitForFunction(() => typeof TasteMatch !== 'undefined' && typeof WineHistory !== 'undefined');
  /* Leave-one-out over one history: one row per scored wine that could be predicted. */
  const run = (h, ov) => page.evaluate(({ wines, ov }) => {
    const keep = {};
    Object.entries(ov).forEach(([k, v]) => { keep[k] = TasteMatch[k]; TasteMatch[k] = v; });
    const all = wines.map((w) => WineDNA.cleanWine(w));
    const out = [];
    all.forEach((w, i) => {
      if (!(w.rating > 0)) return;
      const others = all.filter((_, j) => j !== i);
      const m = TasteMatch.assess(w, others);
      if (!m || m.expected == null) return;
      out.push({ name: w.name, type: TasteMatch._typeKey(w), actual: w.rating, expected: m.expected, sd: m.sd, pct: m.pct, bar: m.bar, verdict: m.verdict });
    });
    Object.entries(keep).forEach(([k, v]) => { TasteMatch[k] = v; });
    return out;
  }, { wines: h.wines, ov });
  for (const h of histories) {
    rows.push({ history: h.name, variant: 'baseline', rows: await run(h, {}) });
    if (Object.keys(overrides).length) rows.push({ history: h.name, variant: Object.entries(overrides).map(([k, v]) => `${k}=${v}`).join(' '), rows: await run(h, overrides) });
  }
} finally {
  await browser.close();
  server.kill();
}

/* The numbers from a set of rows. */
function metrics(rs) {
  const n = rs.length;
  if (!n) return { n: 0 };
  const err = rs.map((r) => r.actual - r.expected);
  const mean = (a) => a.reduce((t, x) => t + x, 0) / a.length;
  const mae = mean(err.map(Math.abs)), rmse = Math.sqrt(mean(err.map((e) => e * e))), bias = mean(err);
  const within = (k) => rs.filter((r) => Math.abs(r.actual - r.expected) <= k).length / n;
  const inSd = (k) => rs.filter((r) => Math.abs(r.actual - r.expected) <= k * r.sd).length / n;
  // Calibration of the %: did the score clear the bar?
  const hit = rs.map((r) => (r.actual >= r.bar ? 1 : 0));
  const base = mean(hit);
  const brier = mean(rs.map((r, i) => (r.pct / 100 - hit[i]) ** 2)), brierBase = mean(hit.map((h) => (base - h) ** 2));
  const bins = [[0, 40], [40, 60], [60, 80], [80, 101]].map(([lo, hi]) => {
    const idx = rs.map((r, i) => i).filter((i) => rs[i].pct >= lo && rs[i].pct < hi);
    return { range: `${lo}–${Math.min(100, hi - 1)}%`, n: idx.length, said: idx.length ? Math.round(mean(idx.map((i) => rs[i].pct))) : null, cleared: idx.length ? Math.round(100 * mean(idx.map((i) => hit[i]))) : null };
  });
  // Ranking: pairs of the same type with different scores.
  let pairs = 0, okE = 0, okP = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = rs[i], b = rs[j];
    if (a.type !== b.type || a.actual === b.actual) continue;
    pairs++;
    const want = Math.sign(a.actual - b.actual);
    if (Math.sign(a.expected - b.expected) === want) okE++; else if (a.expected === b.expected) okE += 0.5;
    if (Math.sign(a.pct - b.pct) === want) okP++; else if (a.pct === b.pct) okP += 0.5;
  }
  return { n, mae, rmse, bias, within3: within(3), within5: within(5), in1sd: inSd(1), in2sd: inSd(2), base, brier, brierBase, bins, pairs, rankExpected: pairs ? okE / pairs : null, rankPct: pairs ? okP / pairs : null };
}
const pc = (x) => x == null ? '—' : `${Math.round(x * 100)}%`;
const f1 = (x) => x == null ? '—' : x.toFixed(1);
const report = rows.map((r) => ({ history: r.history, variant: r.variant, ...metrics(r.rows) }));
if (json) { console.log(JSON.stringify(report, null, 1)); }
else {
  for (const m of report) {
    console.log(`\n${m.history} · ${m.variant} · ${m.n} scored wines predicted from the rest`);
    if (!m.n) continue;
    console.log(`  expected score: MAE ${f1(m.mae)}  RMSE ${f1(m.rmse)}  bias ${m.bias >= 0 ? '+' : ''}${f1(m.bias)}  within 3: ${pc(m.within3)}  within 5: ${pc(m.within5)}`);
    console.log(`  spread: inside ±1 sd ${pc(m.in1sd)} (want ~68%)  inside ±2 sd ${pc(m.in2sd)} (want ~95%)`);
    console.log(`  match %: Brier ${m.brier.toFixed(3)} vs base rate ${m.brierBase.toFixed(3)} (${pc(m.base)} clear their bar)${m.brier < m.brierBase ? '  ✓ informative' : '  ✗ no better than the base rate'}`);
    console.log('  reliability: ' + m.bins.map((b) => `${b.range}: ${b.n ? `said ${b.said}%, cleared ${b.cleared}% (n=${b.n})` : 'none'}`).join('  '));
    console.log(`  ranking: ${m.pairs} pairs, ordered right by expected score ${pc(m.rankExpected)}, by match % ${pc(m.rankPct)}`);
  }
  console.log('');
}
