// Compares two deployments of the app's Worker on the same requests, so a model change
// (CLAUDE_MODEL on the Preview environment, say) is judged on real prompts before production
// gets it: how long each call takes, its tokens, what it costs and what it says.
//
//   node scripts/model-trial.mjs --b https://<preview>.vinterest.pages.dev [--a https://vinterest.pages.dev]
//        [--runs 2] [--image path/to/label.jpg] [--out model-trial.md]
//
// Sends from the app's own origin, through /claude, so the Worker's purposes, caps and model
// settings (modelOptions in _worker.js) are exactly what the app gets. Every call is a real,
// billed Claude call: the default is 4 purposes × 2 runs × 2 deployments = 16 calls, plus a
// label scan per run with --image. The report (markdown) has both answers side by side.
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const A = String(args.a || 'https://vinterest.pages.dev').replace(/\/$/, '');
const B = args.b && String(args.b).replace(/\/$/, '');
const RUNS = Number(args.runs || 2);
const OUT = String(args.out || 'model-trial.md');
if (!B) { console.error('Usage: node scripts/model-trial.mjs --b <preview url> [--a <production url>] [--runs 2] [--image label.jpg]'); process.exit(1); }

// $ per million tokens (input, output), for the cost column.
const PRICE = { 'claude-sonnet-4-6': [3, 15], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-opus-5-5': [4, 20] };
const priceOf = (model) => PRICE[Object.keys(PRICE).find((k) => String(model || '').startsWith(k))] || null;

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const tpl = (f) => fs.readFileSync(path.join(root, 'prompts', f), 'utf8');
const fill = (t, v) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? '');
const K = JSON.parse(fs.readFileSync(path.join(root, 'data', 'knowledge.json'), 'utf8'));
const g = K.grapes.Tempranillo;

// The requests, written the way the app writes them (the same prompt files), for one sample reader.
const profile = 'Mostly reds. Loves Rioja Gran Reserva (95, 93) and Northern Rhône Syrah (92); found a young Malbec too jammy (78). Usual spend £15–30.';
const CASES = [
  { purpose: 'wine_qa', label: 'Ask Vinny', messages: [{ role: 'user', content: fill(tpl('vinny.txt'), { depth: 'enthusiast', profile, history: '', question: 'What should I try next if I love Rioja?' }) }] },
  { purpose: 'wine_details', label: 'Wine details (list scan)', messages: [{ role: 'user', content: fill(tpl('wine-details.txt'), { wine: JSON.stringify({ name: 'Viña Ardanza Reserva', producer: 'La Rioja Alta', vintage: 2016, region: 'Rioja', type: 'red' }) }) }] },
  { purpose: 'grape_quiz', label: 'Grape quiz bank', messages: [{ role: 'user', content: fill(tpl('grape-quiz.txt'), { grape: 'Tempranillo', facts: ['Tempranillo.', g.profile, `Famous in: ${(g.famousIn || []).join(', ')}.`, g.aka, g.climate, g.winemaking, g.food, g.ageing, g.lookalike, g.blends].filter(Boolean).join(' ') }) }] },
  { purpose: 'match_explain', label: 'Why it matches', messages: [{ role: 'user', content: `In two sentences, tell this wine drinker why Muga Reserva 2019 (Rioja, Tempranillo, medium-full body, firm tannins) suits them. What we know: ${profile}` }] },
];
if (args.image) {
  const data = fs.readFileSync(String(args.image)).toString('base64');
  const media_type = /\.png$/i.test(String(args.image)) ? 'image/png' : 'image/jpeg';
  CASES.unshift({ purpose: 'label_scan', label: 'Label scan', messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type, data } }, { type: 'text', text: tpl('label-scan.txt') }] }] });
}

async function call(base, c) {
  const t = Date.now();
  try {
    const r = await fetch(base + '/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.app' }, body: JSON.stringify({ purpose: c.purpose, messages: c.messages }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { error: `${r.status} ${d.code || ''} ${d.error || ''}`.trim(), ms: Date.now() - t };
    const p = priceOf(d.model), u = d.usage || {};
    const cost = p && u.input_tokens != null ? ((u.input_tokens + (u.cache_creation_input_tokens || 0)) * p[0] + u.output_tokens * p[1]) / 1e6 : null;
    return { text: d.text, model: d.model || '?', ms: d.ms || Date.now() - t, total: Date.now() - t, inTok: u.input_tokens, outTok: u.output_tokens, cost };
  } catch (e) { return { error: String(e.message || e), ms: Date.now() - t }; }
}

const rows = [], answers = [];
for (const c of CASES) {
  for (let run = 1; run <= RUNS; run++) {
    const [a, b] = await Promise.all([call(A, c), call(B, c)]);
    rows.push({ c, run, a, b });
    if (run === 1) answers.push({ c, a, b });
    const s = (x) => (x.error ? `error: ${x.error}` : `${x.model} ${x.ms}ms ${x.inTok}→${x.outTok} tok${x.cost != null ? ` $${x.cost.toFixed(4)}` : ''}`);
    console.log(`${c.label} #${run}\n  A ${s(a)}\n  B ${s(b)}`);
  }
}

const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const fmt = (n, d = 0) => (n == null ? '–' : n.toFixed(d));
let md = `# Model trial\n\nA: ${A}\nB: ${B}\n${RUNS} run${RUNS === 1 ? '' : 's'} per request, ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.\n\n`;
md += '| Request | A model | A ms | A out tok | A $ | B model | B ms | B out tok | B $ |\n|---|---|---|---|---|---|---|---|---|\n';
for (const c of CASES) {
  const rs = rows.filter((r) => r.c === c), ok = (k) => rs.map((r) => r[k]).filter((x) => !x.error);
  const side = (k) => { const xs = ok(k); return [xs[0] ? xs[0].model : 'error', fmt(avg(xs.map((x) => x.ms))), fmt(avg(xs.map((x) => x.outTok))), fmt(avg(xs.map((x) => x.cost).filter((x) => x != null)), 4)]; };
  md += `| ${c.label} | ${side('a').join(' | ')} | ${side('b').join(' | ')} |\n`;
}
const tot = (k) => rows.map((r) => r[k].cost).filter((x) => x != null).reduce((s, x) => s + x, 0);
md += `\nTotal spent on this trial: A $${tot('a').toFixed(4)}, B $${tot('b').toFixed(4)}.\n`;
for (const { c, a, b } of answers) md += `\n## ${c.label}\n\n### A (${a.model || 'error'})\n\n${a.error ? 'Error: ' + a.error : '```\n' + a.text + '\n```'}\n\n### B (${b.model || 'error'})\n\n${b.error ? 'Error: ' + b.error : '```\n' + b.text + '\n```'}\n`;
fs.writeFileSync(OUT, md);
console.log(`\nWrote ${OUT}`);
