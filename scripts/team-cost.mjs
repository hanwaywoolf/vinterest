// What one restaurant costs to run on Teams for a month: `npm run team:cost -- [seed] [flags]`.
// It measures each thing that makes a call, once or a few times, on the built app against the deployed Worker
// (real calls, billed; VINTEREST_API_ORIGIN picks which, default production), then multiplies by how often a
// site does it. Drills, Vinny's test, the briefing, Tonight's 86'd and feature, and readiness make no call and
// cost nothing, so they aren't here.
//
// What it measures (every answer's model and tokens come back from the Worker's /claude):
//   ask       Ask Vinny, one question
//   table     a guest at the table, played through to its mark (Claude per turn; the guest's lines are counted
//             in characters for the voice, the server's replies in seconds for the speech-to-text)
//   special   a special read from a typed line and paired from the list (a photo adds its image's tokens)
//   plan      a bespoke plan for one person
//   publish   one wine changed on the list and published, twice (the first reads every question; the second is the
//             cost from then on): its card, then everything a publish runs after it
//             (the menu re-paired, drinking windows, the question check, the sommelier review). Only with
//             --publish, since on a long list it is dollars, and never on The Larkspur, whose demo publish
//             sends no review.
//
// Flags (a month for one site; change them to the restaurant in front of you):
//   --runs 2          how many times each thing is measured
//   --staff 8         people who use it
//   --tables 2        tables per person per week         --voice 1     share of tables played out loud (0 to 1)
//   --asks 3          Ask Vinny questions per person per week
//   --specials 6      specials read per week             --plans 4     bespoke plans per month
//   --changes 4       list or menu publishes per month (each re-runs what `publish` measures)
//   --level hints     the table's help: choices, hints or own
//   --steady          with --publish: skip the first full read and measure only a list change after it
//   --only ask,table  measure only these (ask, table, special, plan); the rest show as not measured
//   --tts 0.20        voice, $ per 1,000 characters      --stt 0.40    speech-to-text, $ per hour of audio
//   --price in,out    $ per million tokens for a model the table below doesn't know
// The voice and speech-to-text rates are assumptions until they are set from the ElevenLabs invoice: pass yours.
// Writes team-cost.md (git-ignored) and prints the same.
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const argv = process.argv.slice(2), flag = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : (argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[i + 1]); };
const seed = argv.find((a, i) => !a.startsWith('--') && !(argv[i - 1] || '').startsWith('--')) || 'demo';
const N = (k, d) => Number(flag(k, d));
const RUNS = N('runs', 2), USE = { staff: N('staff', 8), tables: N('tables', 2), voice: N('voice', 1), asks: N('asks', 3), specials: N('specials', 6), plans: N('plans', 4), changes: N('changes', 4) };
const ONLY = typeof flag('only') === 'string' ? flag('only').split(',') : null, LEVEL = String(flag('level', 'hints')), TTS = N('tts', 0.2), STT = N('stt', 0.4), PUBLISH = !!flag('publish', false), STEADY = !!flag('steady', false), WEEKS = 52 / 12;
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';

// $ per million tokens (input, output), as scripts/model-trial.mjs has them. A cached read is a tenth of the
// input price and a cache write a quarter more.
const PRICE = { 'claude-sonnet-4-6': [3, 15], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-4-5': [1, 5], 'claude-opus-5-5': [4, 20] };
const own = typeof flag('price') === 'string' ? flag('price').split(',').map(Number) : null;
const priceOf = (model) => PRICE[Object.keys(PRICE).find((k) => String(model || '').startsWith(k))] || own;
const unknown = new Set();
const dollars = (c) => { const p = priceOf(c.model), u = c.usage || {}; if (!p) { unknown.add(c.model || 'no model named'); return 0; }
  return ((u.input_tokens || 0) * p[0] + (u.cache_read_input_tokens || 0) * p[0] * 0.1 + (u.cache_creation_input_tokens || 0) * p[0] * 1.25 + (u.output_tokens || 0) * p[1]) / 1e6; };

execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4199, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch(), calls = []; let unit = '';
try {
  const page = await browser.newPage();
  await page.addInitScript(() => { window.VINTEREST_TOUR = 'off'; });
  // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't).
  await page.route('**/claude', async (route) => {
    const body = route.request().postData(); let purpose = ''; try { purpose = JSON.parse(body).purpose || ''; } catch (e) {}
    try {
      const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '300', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
        let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? rej(new Error('curl ' + code)) : res(o)); c.stdin.end(body); });
      const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502, text = out.slice(0, i);
      if (status === 200) { try { const j = JSON.parse(text); calls.push({ unit, purpose, model: j.model, usage: j.usage, ms: j.ms }); } catch (e) {} }
      else console.log(`  /claude (${purpose}) answered ${status}: ${text.slice(0, 160)}`);
      await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: text });
    } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
  });
  for (const p of ['**/tts', '**/stt']) await page.route(p, (r) => r.fulfill({ status: 404, body: '{}' })); // counted below, never sent
  await page.route('**/config', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto(`http://localhost:${port}/team/?seed=${seed}&view=phone`);
  await page.waitForFunction(() => window.TeamLearn && TeamLearn.people().length && TeamData.wines().length);
  const venue = await page.evaluate(() => ({ name: TeamData.get().venue.name, wines: TeamData.wines().length, dishes: TeamData.dishes().length, demo: TeamData.isDemo(), cur: TeamData.currency && TeamData.currency() }));
  console.log(`${venue.name}: ${venue.wines} wines, ${venue.dishes} dishes. Measuring against ${API} (billed), ${RUNS} run${RUNS > 1 ? 's' : ''} each.`);
  const extra = { chars: [], secs: [] }; // per table: the guest's characters said, the server's seconds spoken
  const run = async (name, fn) => { if (ONLY && !ONLY.includes(name)) return; for (let i = 0; i < RUNS; i++) { unit = name; try { await fn(i); } catch (e) { console.log(`  ${name} run ${i + 1} failed: ${String(e.message || e).slice(0, 160)}`); } } unit = ''; console.log(`  ${name}: ${calls.filter((c) => c.unit === name).length} calls`); };

  await run('ask', (i) => page.evaluate((i) => { const w = TeamData.wines(), x = TeamData.dishes();
    const qs = [`What should I pour by the glass with the ${x[i % x.length].name}?`, `How would you describe the ${TeamData.short(w[(i * 7) % w.length])} to a guest who likes soft reds?`, 'Which bottle would you suggest for a table of four sharing mains, under the middle of the list?'];
    return TeamVinny.ask(qs[i % qs.length]); }, i));

  await run('table', async (i) => { const t = await page.evaluate(async ([i, level]) => {
    const pid = (TeamLearn.people().find((p) => p.role === 'server') || TeamLearn.people()[0]).id, sc = TeamVinny.scenario(pid, 1000 + i * 17); if (!sc) throw new Error('no table could be built');
    const turns = []; let chars = 0, said = 0; // the server makes one point a reply, so the guest follows up as a real table does
    for (let n = 0; n < 8; n++) { const g = await TeamVinny.guest(sc, turns, level); if (g.line) { turns.push({ who: 'guest', text: g.line }); chars += g.line.length; } if (g.done) break;
      const reply = n ? `Of course. ${sc.key[n % sc.key.length] || ''}` : String(sc.key[0] || 'Let me suggest something.'); turns.push({ who: 'you', text: reply }); said += reply.split(/\s+/).length; }
    return { chars, secs: said / 2.5 }; }, [i, LEVEL]); extra.chars.push(t.chars); extra.secs.push(t.secs); });

  await run('special', (i) => page.evaluate((i) => TeamShift.read({ text: ['Roast turbot, brown butter, sea beans 34', 'Venison pie with pickled red cabbage, 28', 'Grilled mackerel, gooseberry, new potatoes 24'][i % 3] }), i));

  await run('plan', (i) => page.evaluate((i) => { const pid = (TeamLearn.people().find((p) => p.role === 'server') || TeamLearn.people()[0]).id, by = TeamLearn.people()[0].id;
    return TeamPlans.write(pid, ['Struggling with the reds: mostly prices and what to pour them with.', 'Needs the by-the-glass whites and their pairings before the weekend.'][i % 2], by); }, i));

  if (PUBLISH && venue.demo) console.log('  publish: not measured on The Larkspur (its publish sends no question check or review). Name a real install.');
  else if (PUBLISH) {
    // Twice: the first publish on a phone reads every question (nothing has a mark yet), the second is what a list
    // change costs from then on. A different wine each time; the review runs six batches at once, as team:review does.
    await page.evaluate(() => { TeamData.REVIEW_AT_ONCE = 6; });
    // --steady skips the first, full read: every question is marked as already read (no call), so only the list change is measured.
    if (STEADY) await page.evaluate(() => { const all = [...TeamData.wines().flatMap((w) => [...TeamLearn.wineQs(w.id, { all: true }), ...TeamLearn.lightQs(w.id, { all: true })]), ...TeamData.cocktails().flatMap((c) => TeamLearn.cocktailQs(c.id, { all: true })), ...TeamData.dishes().flatMap((x) => TeamLearn.dishQs(x.id, { all: true }))];
      const d = TeamData.get(); d.venue.reviewed = { ...(d.venue.reviewed || { held: [], notes: {} }), seen: Object.fromEntries(all.map((q) => [q.id, TeamData._itemMark(q)])) }; TeamData.save(d); });
    for (const [n, name] of (STEADY ? [[1, 'publish']] : [[0, 'publish-first'], [1, 'publish']])) { unit = name; const t0 = Date.now();
      try { const r = await page.evaluate(async (n) => { const w = TeamData.wines().filter((x) => TeamData.card(x.id) && !TeamData.isDrink(x))[n * 3], d = TeamData.get(); delete d.cards[w.id]; TeamData.save(d);
        await TeamData.refresh({ kind: 'list', added: [w.id], changed: [], removed: [] }); const v = TeamData.reviewed() || {}; return { wine: TeamData.short(w), asked: v.asked, read: v.read }; }, n);
        console.log(`  ${name}: ${r.wine} changed, ${calls.filter((c) => c.unit === name).length} calls, the review read ${r.read} of ${r.asked} questions, ${Math.round((Date.now() - t0) / 1000)}s`); }
      catch (e) { console.log(`  ${name} failed: ` + String(e.message || e).slice(0, 200)); } }
    unit = ''; }

  // ── What it adds up to ──
  const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0, of = (u) => calls.filter((c) => c.unit === u);
  const per = (u, runs = RUNS) => { const cs = of(u), tok = (k) => cs.reduce((n, c) => n + ((c.usage || {})[k] || 0), 0) / runs;
    return { calls: cs.length / runs, in: tok('input_tokens'), read: tok('cache_read_input_tokens'), write: tok('cache_creation_input_tokens'), out: tok('output_tokens'), cost: cs.reduce((n, c) => n + dollars(c), 0) / runs, model: [...new Set(cs.map((c) => c.model))].join(', ') }; };
  const U = { ask: per('ask'), table: per('table'), special: per('special'), plan: per('plan'), publish: PUBLISH && !venue.demo ? per('publish', 1) : null };
  const voice = { chars: avg(extra.chars), secs: avg(extra.secs) }; voice.cost = voice.chars / 1000 * TTS + voice.secs / 3600 * STT;
  const m = { ask: USE.staff * USE.asks * WEEKS, table: USE.staff * USE.tables * WEEKS, special: USE.specials * WEEKS, plan: USE.plans, publish: USE.changes };
  const k = (n) => Math.round(n).toLocaleString('en-US'), $ = (n) => '$' + (n < 1 ? n.toFixed(3) : n.toFixed(2));
  const rows = [['Ask Vinny, a question', U.ask, m.ask], ['A guest at the table (Claude)', U.table, m.table], ['A special read and paired', U.special, m.special], ['A bespoke plan', U.plan, m.plan]];
  if (U.publish) rows.push(['A list change published', U.publish, m.publish]);
  let total = 0; const L = [];
  L.push(`# What ${venue.name} costs to run for a month`, '', `Measured ${new Date().toISOString().slice(0, 10)} against ${API}: ${venue.wines} wines, ${venue.dishes} dishes, ${RUNS} run${RUNS > 1 ? 's' : ''} of each. Dollars at list prices.`, '',
    `A month here is ${USE.staff} people, each playing ${USE.tables} table${USE.tables === 1 ? '' : 's'} and asking Vinny ${USE.asks} question${USE.asks === 1 ? '' : 's'} a week, ${USE.specials} specials a week, ${USE.plans} plans and ${USE.changes} list or menu publishes a month.`, '',
    '| What | Model | Calls | Tokens in | From cache | Tokens out | Each | A month | Monthly |', '|---|---|---|---|---|---|---|---|---|');
  for (const [name, u, n] of rows) { if (!u.calls) { L.push(`| ${name} | not measured | | | | | | ${k(n)} | |`); continue; } const month = u.cost * n; total += month; L.push(`| ${name} | ${u.model || 'not measured'} | ${u.calls.toFixed(1)} | ${k(u.in + u.write)} | ${k(u.read)} | ${k(u.out)} | ${$(u.cost)} | ${k(n)} | ${$(month)} |`); }
  const vMonth = voice.cost * m.table * USE.voice; total += vMonth;
  L.push(`| The table out loud (voice and speech-to-text) | assumed rates | | ${k(voice.chars)} characters | | ${k(voice.secs)} seconds | ${$(voice.cost)} | ${k(m.table * USE.voice)} | ${$(vMonth)} |`, `| **Total** | | | | | | | | **${$(total)}** |`, '');
  if (U.publish) for (const [u, title] of [...(of('publish-first').length ? [['publish-first', 'The first publish on a device, which reads every question (' + $(per('publish-first', 1).cost) + ' in all)']] : []), ['publish', 'A list change after that']]) { const by = {}; for (const c of of(u)) { (by[c.purpose] = by[c.purpose] || { n: 0, cost: 0 }); by[c.purpose].n++; by[c.purpose].cost += dollars(c); }
    L.push(title + ', by what the publish ran:', '', '| Step | Calls | Cost |', '|---|---|---|', ...Object.entries(by).sort((a, b) => b[1].cost - a[1].cost).map(([p, v]) => `| ${p} | ${v.n} | ${$(v.cost)} |`), ''); }
  else L.push(`A list or menu publish isn't in the total: ${venue.demo ? 'The Larkspur\'s publish sends no question check or review, so measure it on a real install' : 'pass --publish to measure it'} (it re-pairs the menu and re-reads every question, so it is the part that grows with the list).`, '');
  L.push(`Voice is ${$(TTS)} per 1,000 characters and speech-to-text ${$(STT)} an hour: assumptions until set from the ElevenLabs invoice (--tts, --stt). The guest's lines are counted, not sent.`,
    'A special read from a photo adds the image\'s tokens to the typed line measured here. Drills, Vinny\'s test, the briefing and readiness make no calls.');
  if (unknown.size) L.push('', `No price known for ${[...unknown].join(', ')}: its calls are counted at $0. Pass --price in,out ($ per million tokens).`);
  fs.writeFileSync('team-cost.md', L.join('\n') + '\n'); console.log('\n' + L.join('\n') + '\n\nWritten to team-cost.md');
} finally { await browser.close(); server.kill(); }
