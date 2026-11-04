#!/usr/bin/env node
/* The listening check: has the deployed voice (/tts) say every wine, cocktail and dish name of a restaurant in a
   guest's sentence, and writes one page to play them through (tts-check/index.html, git-ignored), each row numbered
   with the card's sounds-like spelling beside it, so the names it gets wrong can be listed and fixed in
   data/tts-say.json. A second section plays the same three lines in each of the voices, for choosing them.

     npm run tts:check -- [--base https://claude-perse-intake.vinterest.pages.dev] [--venue social] [--only wines]

   Every clip is a real ElevenLabs (or OpenAI) call through the Worker, billed to its key, and cached there a
   month, so a second run costs nothing for the lines already said. It runs with curl, since Node's fetch doesn't
   go through a proxy. The Worker allows 40 calls per five minutes per address, so it paces itself. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'https://claude-perse-intake.vinterest.pages.dev').replace(/\/$/, '');
const venue = arg('venue', 'social'), only = arg('only', '');
const list = JSON.parse(readFileSync(`data/team-${venue}-list.json`, 'utf8'));
let cards = {};
try { cards = JSON.parse(readFileSync(`data/team-${venue}.json`, 'utf8')).cards || {}; } catch (e) {}
const say = JSON.parse(readFileSync('data/tts-say.json', 'utf8')).say || {};

const items = [];
if (!only || only === 'wines') for (const w of list.wines || []) { const n = [w.producer, w.name].filter(Boolean).join(' ');
  items.push({ kind: 'Wine', name: n, line: `Could we get a bottle of the ${n}, please?`, hint: (cards[w.id] || {}).say || '' }); }
if (!only || only === 'cocktails') for (const c of list.cocktails || []) items.push({ kind: 'Cocktail', name: c.name, line: `I'll start with a ${c.name}.`, hint: '' });
if (!only || only === 'dishes') for (const d of list.dishes || []) items.push({ kind: 'Dish', name: d.name, line: `I'm having the ${d.name}.`, hint: '' });
const sample = items.filter((x) => x.kind === 'Wine').slice(0, 40);
const tricky = [sample.find((x) => /[éèêôûç]/i.test(x.name)), sample.find((x) => /\b(di|del|della)\b/i.test(x.name)), sample.find((x) => /\b(de la|del|Rioja|Ribera)\b/i.test(x.name))].filter(Boolean);
const voices = Number(arg('voices', 4));

const out = 'tts-check';
mkdirSync(out, { recursive: true });
let calls = 0, t0 = Date.now(), provider = '';
function tts(text, voice) {
  // Pace: no more than 36 calls in any five minutes from here.
  if (calls && calls % 36 === 0) { const wait = Math.max(0, 5 * 60 * 1000 + 2000 - (Date.now() - t0)); if (wait) { console.log(`… pausing ${Math.round(wait / 1000)}s for the Worker's rate limit`); execFileSync('sleep', [String(Math.ceil(wait / 1000))]); } t0 = Date.now(); }
  calls++;
  const file = `${out}/clip-${calls}.mp3`;
  const head = execFileSync('curl', ['-sS', '-D', '-', '-o', file, '-X', 'POST', `${base}/tts`, '-H', 'content-type: application/json', '-H', `origin: ${base}`,
    '--data-binary', JSON.stringify({ text, voice })], { encoding: 'utf8' });
  const status = Number((head.match(/HTTP\/\S+ (\d+)/) || [])[1] || 0), via = (head.match(/x-tts:\s*(\S+)/i) || [])[1] || '';
  if (via && via !== 'cache') provider = via;
  if (status !== 200) throw new Error(`/tts answered ${status} for "${text}"`);
  return readFileSync(file).toString('base64');
}

const rows = items.map((x, i) => { process.stdout.write(`\r${i + 1}/${items.length} ${x.name.slice(0, 50).padEnd(50)}`); return { ...x, n: i + 1, audio: tts(x.line, 0) }; });
const voiceRows = [];
for (let v = 0; v < voices; v++) for (const x of tricky) voiceRows.push({ v, line: x.line, audio: tts(x.line, v) });
console.log(`\n${calls} clips via ${provider || 'cache'}`);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fixed = (n) => Object.keys(say).some((k) => n.toLowerCase().includes(k.toLowerCase()));
const html = `<title>Pronunciation Check</title><meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap"><style>
/* One column of numbered rows to play through on a phone; the wine-list's crimson on the app's dark stage. */
:root{--bg:#141012;--card:#1e191b;--ink:#f4ece6;--mid:#b3a69f;--line:#3a3134;--acc:#e0607a;--ok:#5fd48f;--sans:"Poppins",system-ui,-apple-system,"Segoe UI",sans-serif;color-scheme:dark}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#faf6f2;--card:#fff;--ink:#231c1e;--mid:#6f6266;--line:#e6dcd6;--acc:#8b1a2f;--ok:#1f8a4c;color-scheme:light}}
:root[data-theme="light"]{--bg:#faf6f2;--card:#fff;--ink:#231c1e;--mid:#6f6266;--line:#e6dcd6;--acc:#8b1a2f;--ok:#1f8a4c;color-scheme:light}
*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:16px/1.45 var(--sans)}
main{max-width:720px;margin:0 auto;padding-block:24px 64px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:26px;margin:0 0 6px;text-wrap:balance}h2{font-size:19px;margin:32px 0 6px}
p{color:var(--mid);margin:0 0 12px;max-width:65ch}.row{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card);margin-top:8px}
.n{font-weight:700;color:var(--acc);font-variant-numeric:tabular-nums}.name{font-weight:600}.sub{font-size:14px;color:var(--mid)}.tag{font-size:12px;color:var(--ok);font-weight:700}
button{font:inherit;font-weight:700;border:1px solid var(--acc);color:var(--acc);background:transparent;border-radius:999px;padding:6px 14px;cursor:pointer;min-width:68px}
button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}button[aria-pressed="true"]{background:var(--acc);color:var(--bg)}
</style><main>
<h1>Pronunciation check</h1>
<p>${esc(list.venue && list.venue.name || venue)} · ${rows.length} names, as the guest's voice says them now (${esc(provider || 'cached')}). Tap Play, and note the numbers that sound wrong. Under each wine is the sounds-like spelling from its card, as a guide.</p>
${['Wine', 'Cocktail', 'Dish'].map((k) => { const rs = rows.filter((r) => r.kind === k); return rs.length ? `<h2>${k === 'Dish' ? 'Dishes' : k + 's'}</h2>` + rs.map((r) => `<div class="row"><div class="n">${r.n}</div><div><div class="name">${esc(r.name)}</div>${r.hint ? `<div class="sub">Card says: ${esc(r.hint)}</div>` : ''}${fixed(r.name) ? '<div class="tag">Has a fix</div>' : ''}</div><button data-a="a${r.n}" aria-pressed="false">Play</button><audio id="a${r.n}" preload="none" src="data:audio/mpeg;base64,${r.audio}"></audio></div>`).join('') : ''; }).join('')}
<h2>The voices</h2><p>The same lines in each of the ${voices} voices the guests use now (voice 1 is the first id in ELEVENLABS_VOICES).</p>
${voiceRows.map((r, i) => `<div class="row"><div class="n">V${r.v + 1}</div><div><div class="sub">${esc(r.line)}</div></div><button data-a="v${i}" aria-pressed="false">Play</button><audio id="v${i}" preload="none" src="data:audio/mpeg;base64,${r.audio}"></audio></div>`).join('')}
</main><script>
let cur=null;document.addEventListener('click',e=>{const b=e.target.closest('button[data-a]');if(!b)return;const a=document.getElementById(b.dataset.a);
if(cur&&cur!==a){cur.pause();cur.currentTime=0;document.querySelector('[data-a="'+cur.id+'"]').setAttribute('aria-pressed','false');}
if(a.paused){a.play();b.setAttribute('aria-pressed','true');cur=a;a.onended=()=>b.setAttribute('aria-pressed','false');}else{a.pause();b.setAttribute('aria-pressed','false');}});
</script>`;
writeFileSync(`${out}/index.html`, html);
for (let i = 1; i <= calls; i++) try { execFileSync('rm', ['-f', `${out}/clip-${i}.mp3`]); } catch (e) {}
console.log(`Wrote ${out}/index.html`);
