// Writes an installed restaurant's training from its list file, the way a publish would, and saves it as the seed's training
// file (data/team-<name>.json), so the install opens complete with no phone writing anything: the staff cards, cocktail cards,
// pairings for every dish, drinking windows and dish notes, each through the app's own writers (TeamData.writeCards and the
// rest) and prompts. Then `npm run team:audit -- <name>` and `npm run team:review -- <name>` before it's handed over.
// Calls the deployed Worker's /claude for real (billed, on its TEAM_MODEL): VINTEREST_API_ORIGIN picks which (default the
// production site). It saves after every step and skips what the file already holds, so a run that stops can be run again.
// Usage: npm run team:write -- princess-royal   [--lanes 4] [--batch 2]
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), seed = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? Number(args[i + 1]) || d : d; };
// Wines per card call: two keeps a long list's answer inside the Worker's time to Anthropic (four timed out at 132 wines).
const lanes = opt('lanes', 4), batch = opt('batch', 2);
if (!seed) { console.error('Name a restaurant: npm run team:write -- princess-royal'); process.exit(2); }
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
const file = `data/team-${seed}.json`;
execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4198, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't).
  await page.route('**/claude', async (route) => {
    try {
      const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '300', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
        let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? rej(new Error('curl ' + code)) : res(o)); c.stdin.end(route.request().postData()); });
      const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502;
      if (status !== 200) console.log(`  /claude answered ${status}: ${out.slice(0, Math.min(i, 200))}`);
      await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
    } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
  });
await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
  await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
  await page.evaluate((b) => { TeamData.CARD_BATCH = b; TeamData.PAIR_BATCH = 6; TeamData.DISH_BATCH = Math.min(TeamData.DISH_BATCH || 8, 4); }, batch);
  // What the page holds, as the seed's training file (TeamData.exportFile's shape, written here rather than downloaded).
  const save = async () => {
    const out = await page.evaluate(() => { const d = TeamData.get();
      return { venue: { name: d.venue.name }, wines: TeamData.wines(), dishes: TeamData.dishes(), cards: d.cards, pairings: d.pairings,
        ...(TeamData.cocktails().length ? { cocktails: TeamData.cocktails(), cocktailCards: d.cocktailCards || {} } : {}),
        ...(Object.keys(d.dishCards || {}).length ? { dishCards: d.dishCards } : {}), exported: new Date().toISOString() }; });
    // Strip what only the device adds (list order, when it was added) so the file reads like the list.
    const bare = (x) => { const { onList, onMenu, order, addedAt, ...rest } = x; return rest; };
    out.wines = out.wines.map(bare); out.dishes = out.dishes.map(bare); if (out.cocktails) out.cocktails = out.cocktails.map(bare);
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  };
  // Saved after every batch as well as every step, so a run that stops keeps what it wrote.
  let saving = null;
  page.on('console', (m) => { if (/^write:/.test(m.text())) { console.log(m.text()); if (!saving) saving = save().catch(() => {}).finally(() => { saving = null; }); } });
    const step = async (label, fn) => { const t = Date.now(); console.log(`${label}…`); await page.evaluate(fn, lanes); await save(); console.log(`${label}: done in ${Math.round((Date.now() - t) / 1000)}s`); };
  // Cards first (the pairings read each wine's style from its card), several batches at once.
  await step('Staff cards', async (lanes) => { const ids = TeamData.wines().filter((w) => !TeamData.card(w.id)).map((w) => w.id);
    const parts = Array.from({ length: lanes }, (_, k) => ids.filter((_, i) => Math.floor(i / TeamData.CARD_BATCH) % lanes === k));
    await Promise.all(parts.map((p) => TeamData.writeCards(p, (a) => { if (a) console.log(`write: cards ${Object.keys(TeamData.get().cards).length} of ${TeamData.wines().length}`); }).catch((e) => console.log('write: a lane of cards stopped: ' + e.message)))); });
  await step('Cocktail cards', async () => { const ids = TeamData.cocktails().filter((c) => !TeamData.cocktailCard(c.id)).map((c) => c.id); if (ids.length) await TeamData.writeCocktailCards(ids); });
  await step('Pairings', async () => { const ids = TeamData.dishes().filter((x) => !TeamData.pairing(x.id)).map((x) => x.id); if (ids.length) await TeamData.writePairings(ids); });
  await step('Drinking windows', async () => { const ids = TeamData.wines().filter((w) => w.vintage && !w.peak).map((w) => w.id); if (ids.length) await TeamData.writeWindows(ids, (a, b) => console.log(`write: windows ${a} of ${b}`)); });
  await step('Dish notes', async () => { const ids = TeamData.dishes().filter((x) => !TeamData.dishCard(x.id)).map((x) => x.id); if (ids.length) await TeamData.writeDishCards(ids, (a, b) => console.log(`write: dish notes ${a} of ${b}`)); });
  const left = await page.evaluate(() => TeamData.pending());
  console.log('Still to write:', JSON.stringify(left));
} finally { await browser.close(); server.kill(); }
