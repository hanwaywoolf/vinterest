// Writes an installed restaurant's training from its list file, the way a publish would, and saves it as the seed's training
// file (data/team-<name>.json), so the install opens complete with no phone writing anything: the staff cards, cocktail cards,
// pairings for every dish, drinking windows and dish notes, each through the app's own writers (TeamData.writeCards and the
// rest) and prompts. Then `npm run team:audit -- <name>` and `npm run team:review -- <name>` before it's handed over.
// Calls the deployed Worker's /claude for real (billed, on its TEAM_MODEL): VINTEREST_API_ORIGIN picks which (default the
// production site). It saves after every step and skips what the file already holds, so a run that stops can be run again.
//
// --teaser: a quick, cheap install to show a prospective restaurant (docs/business.md "Teaser installs"). Only a slice of
// the list is trained: the wines sold by the glass (or --wines id,id,… picked by hand), at most --max (30), with every
// dish and cocktail; every call is marked `draft`, so the Worker writes it on TEAM_DRAFT_MODEL (Claude Sonnet 5.5 unless
// set) whatever TEAM_MODEL is; drinking windows are left to the app's own estimate, labelled as one. Run team:audit (free)
// on it, not team:review. A later run without --teaser on the same restaurant brings the rest of the list back and writes
// what's missing on TEAM_MODEL, keeping the teaser's cards.
// --pitch: the cheapest install that still carries a sales pitch (docs/business.md "Pitch demos"): the WHOLE list, since the
// pitch is about the bottles nobody tastes first, with a short card for every wine (what a server reads and says, no
// written questions: the app builds its Essentials questions from the card), pairings for every dish, then full cards
// with questions for the few wines the pairings lean on most (--featured 8, or --wines id,id,… picked by hand), checked
// by the app's own question check. Every call is a draft. No cocktail cards (--cocktails writes them), dish notes
// (--dish-notes), drinking windows or sommelier review. The training file carries `pitch` {featured, at}. A later run
// without --pitch writes what's missing on TEAM_MODEL; delete a short card first to have it written in full.
// Usage: npm run team:write -- princess-royal   [--pitch [--featured 8] [--wines id,…] [--cocktails] [--dish-notes]] [--fresh]
//        npm run team:write -- princess-royal   [--teaser [--wines id,…] [--max 30] [--no-dish-notes]] [--lanes 4] [--batch 2] [--out file]
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), seed = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) || d : d; };
// Wines per card call: two keeps a long list's answer inside the Worker's time to Anthropic (four timed out at 132 wines).
const lanes = opt('lanes', 4), batch = opt('batch', 2);
const teaser = args.includes('--teaser'), max = opt('max', 30), noDishNotes = args.includes('--no-dish-notes');
const pitch = args.includes('--pitch'), featuredN = opt('featured', 8), draft = teaser || pitch;
if (pitch && teaser) { console.error('--pitch and --teaser are two different installs: pick one.'); process.exit(2); }
const picked = args.includes('--wines') ? String(args[args.indexOf('--wines') + 1] || '').split(',').map((x) => x.trim()).filter(Boolean) : null;
if (!seed) { console.error('Name a restaurant: npm run team:write -- princess-royal'); process.exit(2); }
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
// --out writes somewhere else (a scratch copy while a long run goes on); copy it into data/ once it's done.
const outArg = args[args.indexOf('--out') + 1], file = args.includes('--out') ? outArg : `data/team-${seed}.json`;
execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4198, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
// What the run cost, by model: every answer carries its usage.
const use = {};
try {
  const page = await browser.newPage();
  // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't).
  await page.route('**/claude', async (route) => {
    try {
      // A teaser's calls are drafts: the Worker writes them on its cheaper draft model.
      const body = draft ? JSON.stringify({ ...JSON.parse(route.request().postData()), draft: true }) : route.request().postData();
      const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '300', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
        let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? rej(new Error('curl ' + code)) : res(o)); c.stdin.end(body); });
      const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502;
      if (status !== 200) console.log(`  /claude answered ${status}: ${out.slice(0, Math.min(i, 200))}`);
      else try { const j = JSON.parse(out.slice(0, i)), u = j.usage || {}, m = j.model || 'model'; const t = use[m] || (use[m] = { calls: 0, in: 0, out: 0, read: 0, write: 0 }); t.calls++; t.in += u.input_tokens || 0; t.out += u.output_tokens || 0; t.read += u.cache_read_input_tokens || 0; t.write += u.cache_creation_input_tokens || 0; } catch (e) {}
      await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
    } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
  });
  await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
  // --fresh: write from the list alone, as if the training file held nothing (with --out, to try an install again
  // without touching the one in data/).
  if (args.includes('--fresh')) await page.evaluate(() => { const d = TeamData.get(); d.cards = {}; d.pairings = {}; d.cocktailCards = {}; d.dishCards = {}; delete d.venue.reviewed; delete d.venue.checked; TeamData.save(d); });
  // What's trained: a teaser keeps only its slice on the list (the rest isn't written or shown); a full run brings back
  // anything on the list file that a teaser left out, so it can be written now.
  const scope = await page.evaluate(([teaser, picked, max, seed]) => {
    const d = TeamData.get(), list = (TeamSample.list(TeamSample.ALIAS[seed] || seed) || {}).wines || [];
    if (teaser) {
      const all = TeamData.wines(), want = picked ? all.filter((w) => picked.includes(w.id)) : all.filter((w) => TeamData.byGlass(w));
      const keep = new Set(want.slice(0, max).map((w) => w.id));
      all.forEach((w) => { if (!keep.has(w.id)) d.wines[w.id].onList = false; });
      TeamData.save(d); return { teaser: true, wines: keep.size, of: all.length, missing: picked ? picked.filter((id) => !all.some((w) => w.id === id)) : [] };
    }
    let added = 0; const now = Date.now();
    list.forEach((w, i) => { const id = w.id || TeamData.wineId(w); if (!d.wines[id] || !d.wines[id].onList) { d.wines[id] = { ...w, id, onList: true, order: i, addedAt: now }; added++; } });
    if (added) TeamData.save(d); return { teaser: false, wines: TeamData.wines().length, added };
  }, [teaser, pitch ? null : picked, max, seed]);
  if (pitch) console.log(`Pitch: all ${scope.wines} wines with a short card, every dish paired, ${picked ? picked.length + ' wines picked by hand' : 'the ' + featuredN + ' wines the pairings lean on most'} with full cards, on the Worker's draft model.`);
  if (scope.teaser) console.log(`Teaser: ${scope.wines} of ${scope.of} wines${picked ? ' picked by hand' : ' sold by the glass'}, every dish and cocktail, on the Worker's draft model.${scope.missing.length ? ' Not on the list: ' + scope.missing.join(', ') : ''}`);
  else if (scope.added) console.log(`${scope.added} wines a teaser left out are back on the list and will be written now.`);
  await page.evaluate((b) => { TeamData.CARD_BATCH = b; TeamData.PAIR_BATCH = 6; TeamData.DISH_BATCH = Math.min(TeamData.DISH_BATCH || 8, 4); }, batch);
  // What the page holds, as the seed's training file (TeamData.exportFile's shape, written here rather than downloaded).
  const save = async () => {
    const out = await page.evaluate(([teaser, pitch]) => { const d = TeamData.get();
      return { venue: { name: d.venue.name }, ...(teaser ? { teaser: { wines: TeamData.wines().length, at: new Date().toISOString() } } : {}), ...(pitch ? { pitch: { featured: TeamData.wines().filter((w) => ((TeamData.card(w.id) || {}).qs || []).length).map((w) => w.id), at: new Date().toISOString() } } : {}), wines: TeamData.wines(), dishes: TeamData.dishes(), cards: d.cards, pairings: d.pairings,
        ...(TeamData.cocktails().length ? { cocktails: TeamData.cocktails(), cocktailCards: d.cocktailCards || {} } : {}),
        ...(Object.keys(d.dishCards || {}).length ? { dishCards: d.dishCards } : {}), exported: new Date().toISOString() }; }, [teaser, pitch]);
    // Strip what only the device adds (list order, when it was added) so the file reads like the list.
    const bare = (x) => { const { onList, onMenu, order, addedAt, ...rest } = x; return rest; };
    out.wines = out.wines.map(bare); out.dishes = out.dishes.map(bare); if (out.cocktails) out.cocktails = out.cocktails.map(bare);
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  };
  // Saved after every batch as well as every step, so a run that stops keeps what it wrote.
  let saving = null;
  page.on('console', (m) => { if (/^write:/.test(m.text())) { console.log(m.text()); if (!saving) saving = save().catch(() => {}).finally(() => { saving = null; }); } });
  const step = async (label, fn, arg) => { const t = Date.now(); console.log(`${label}…`); await page.evaluate(fn, arg === undefined ? lanes : arg); await save(); console.log(`${label}: done in ${Math.round((Date.now() - t) / 1000)}s`); };
  // A pitch demo: short cards for every wine, pairings, then full cards for the wines the pairings lean on most.
  if (pitch) {
    await step('Short cards', async (lanes) => { const ids = TeamData.wines().filter((w) => !TeamData.card(w.id)).map((w) => w.id), n = TeamData.PITCH_BATCH;
      const parts = Array.from({ length: lanes }, (_, k) => ids.filter((_, i) => Math.floor(i / n) % lanes === k));
      await Promise.all(parts.map((p) => TeamData.writeCards(p, (a) => { if (a) console.log(`write: short cards ${Object.keys(TeamData.get().cards).length} of ${TeamData.wines().length}`); }, { short: true }).catch((e) => console.log('write: a lane of short cards stopped: ' + e.message)))); });
  }
  if (!pitch) await step('Staff cards', async (lanes) => { const ids = TeamData.wines().filter((w) => !TeamData.card(w.id)).map((w) => w.id);
    const parts = Array.from({ length: lanes }, (_, k) => ids.filter((_, i) => Math.floor(i / TeamData.CARD_BATCH) % lanes === k));
    await Promise.all(parts.map((p) => TeamData.writeCards(p, (a) => { if (a) console.log(`write: cards ${Object.keys(TeamData.get().cards).length} of ${TeamData.wines().length}`); }).catch((e) => console.log('write: a lane of cards stopped: ' + e.message)))); });
  if (!pitch || args.includes('--cocktails')) await step('Cocktail cards', async () => { const ids = TeamData.cocktails().filter((c) => !TeamData.cocktailCard(c.id)).map((c) => c.id); if (ids.length) await TeamData.writeCocktailCards(ids); });
  // A batch at a time, tried again if its answer doesn't parse, so one bad answer doesn't stop the rest.
  await step('Pairings', async () => { const ids = TeamData.dishes().filter((x) => !TeamData.pairing(x.id)).map((x) => x.id), n = TeamData.PAIR_BATCH;
    const parts = []; for (let i = 0; i < ids.length; i += n) parts.push(ids.slice(i, i + n));
    await Promise.all(parts.map(async (p) => { for (let t = 0; t < 3; t++) { try { await TeamData.writePairings(p.filter((id) => !TeamData.pairing(id))); console.log(`write: pairings ${TeamData.dishes().filter((x) => TeamData.pairing(x.id)).length} of ${TeamData.dishes().length}`); return; } catch (e) { console.log('write: a pairing batch failed, trying again: ' + e.message); } } })); });
  // A teaser leaves drinking windows to the app's own estimate (TeamData.window says it's one).
  if (pitch) {
    // Featured: the wines the pairings name most (a first pick counts three, a second two, a third and the glass pick one),
    // half of them bottle only where there are that many, since those are the ones the pitch is about.
    const featured = await page.evaluate(([n, picked]) => {
      if (picked) return picked.filter((id) => TeamData.wine(id));
      const had = TeamData.wines().filter((w) => ((TeamData.card(w.id) || {}).qs || []).length).map((w) => w.id); if (had.length >= n) return had;
      const score = {}; TeamData.dishes().forEach((x) => { const p = TeamData.pairing(x.id); if (!p) return; (p.best || []).forEach((b, i) => { score[b.id] = (score[b.id] || 0) + (3 - Math.min(i, 2)); }); if (p.glass && p.glass.id) score[p.glass.id] = (score[p.glass.id] || 0) + 1; });
      const ranked = Object.keys(score).filter((id) => TeamData.wine(id)).sort((a, b) => score[b] - score[a]);
      const bottle = ranked.filter((id) => !TeamData.byGlass(TeamData.wine(id))).slice(0, Math.ceil(n / 2)), rest = ranked.filter((id) => !bottle.includes(id));
      return [...new Set([...had, ...bottle, ...rest])].slice(0, n); }, [featuredN, picked]);
    console.log(`Featured wines (full cards with questions): ${featured.join(', ')}`);
    await step('Full cards for the featured wines', async ([ids, lanes]) => {
      const todo = ids.filter((id) => !((TeamData.card(id) || {}).qs || []).length), kept = {}, d = TeamData.get();
      todo.forEach((id) => { kept[id] = d.cards[id]; });
      const parts = Array.from({ length: lanes }, (_, k) => todo.filter((_, i) => Math.floor(i / TeamData.CARD_BATCH) % lanes === k));
      await Promise.all(parts.map((p) => TeamData.writeCards(p, (a) => { if (a) console.log(`write: full cards ${ids.filter((id) => ((TeamData.card(id) || {}).qs || []).length).length} of ${ids.length}`); }).catch((e) => console.log('write: a lane of full cards stopped: ' + e.message))));
      // A full card that didn't come back leaves its short card as it was.
      const now = TeamData.get(); let put = 0; todo.forEach((id) => { if (!now.cards[id] && kept[id]) { now.cards[id] = kept[id]; put++; } }); if (put) TeamData.save(now);
    }, [featured, lanes]);
    await step('Question check on the featured wines', async (ids) => { const r = await TeamData.checkQuestions(ids.filter((id) => ((TeamData.card(id) || {}).qs || []).length)); console.log('write: checked ' + JSON.stringify(r || {})); }, featured);
  }
  if (!draft) await step('Drinking windows', async () => { const ids = TeamData.wines().filter((w) => w.vintage && !w.peak).map((w) => w.id); if (ids.length) await TeamData.writeWindows(ids, (a, b) => console.log(`write: windows ${a} of ${b}`)); });
  if (pitch ? args.includes('--dish-notes') : !noDishNotes) await step('Dish notes', async () => { const ids = TeamData.dishes().filter((x) => !TeamData.dishCard(x.id)).map((x) => x.id); if (ids.length) await TeamData.writeDishCards(ids, (a, b) => console.log(`write: dish notes ${a} of ${b}`)); });
  const left = await page.evaluate(() => TeamData.pending());
  console.log('Still to write:', JSON.stringify(draft ? { ...left, windows: 0 } : left));
  if (pitch) console.log(`Next: npm run team:audit -- ${seed} (free), then npm run site:teams:for -- ${seed} for its page.`);
  else console.log(`Next: npm run team:audit -- ${seed}${teaser ? ' (a teaser skips the sommelier review)' : `, then npm run team:review -- ${seed}`}`);
} finally {
  Object.keys(use).forEach((m) => { const t = use[m]; console.log(`Tokens on ${m}: ${t.calls} calls · ${t.in} in · ${t.out} out · ${t.read} cache read · ${t.write} cache write`); });
  await browser.close(); server.kill(); }
