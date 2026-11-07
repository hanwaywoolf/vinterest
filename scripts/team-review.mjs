// The sommelier review of a restaurant before it's handed over: every question read as the drill shows it by a head
// sommelier (TeamData.sommelierReview, prompts/team-review.txt), the doubtful ones rewritten and read again, anything
// still doubted held out of the drill, and the result written into the restaurant's file (data/team-<name>.json:
// its cards and `reviewed`), so the install opens with it. The rule review (npm run team:audit) must pass first.
// Calls the deployed Worker's /claude for real (billed): VINTEREST_API_ORIGIN picks which (default production; a
// branch preview while team_review is only there).
// Usage: npm run team:review -- social   [--dry]   (--dry: report only, write nothing)
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), dry = args.includes('--dry'), seeds = args.filter((a) => !a.startsWith('--'));
if (!seeds.length) { console.error('Name a restaurant: npm run team:review -- social'); process.exit(2); }
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4197, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
let held = 0;
try {
  for (const seed of seeds) {
    const page = await browser.newPage();
    // Sent with curl, which follows the machine's proxy settings (Node's own fetch doesn't); a failed call answers 502 so
    // the review records it as unread rather than stopping.
    await page.route('**/claude', async (route) => {
      try {
        const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '180', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
          let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => code ? rej(new Error('curl ' + code)) : res(o)); c.stdin.end(route.request().postData()); });
        const i = out.lastIndexOf('\n'); await route.fulfill({ status: Number(out.slice(i + 1)) || 502, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
      } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
    });
    page.on('console', (m) => { if (/review:/.test(m.text())) process.stdout.write('\r' + m.text().padEnd(60)); });
    await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    const rules = await page.evaluate(() => TeamLearn.review().length);
    if (rules) { console.error(`\n${seed}: ${rules} questions fail the rule review; run npm run team:audit and fix those first.`); process.exitCode = 1; continue; }
    const r = await page.evaluate(async () => {
      await TeamData.checkQuestions(null, (a, b) => console.log(`review: rule rewrites ${a} of ${b}`)); // repeats and giveaways rewritten first
      const res = await TeamData.sommelierReview({ onStep: (a, b) => console.log(`review: ${a} of ${b}`) });
      if (!res) return null;
      const d = TeamData.get();
      return { res, cards: d.cards, notes: res.held.map((id) => ({ id, ...res.notes[id] })), name: d.venue.name };
    });
    console.log('');
    if (!r) { console.log(`${seed}: the demo restaurant isn't sent for review.`); continue; }
    held += r.res.held.length;
    console.log(`${r.name}: ${r.res.asked} questions read, ${r.res.doubted} doubted, ${r.res.fixed} rewritten, ${r.res.held.length} held`);
    for (const n of r.notes) console.log(`  [${n.problem}] ${n.id}: ${n.note}`);
    if (!dry) {
      const file = `data/team-${seed}.json`, doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      doc.cards = r.cards; doc.reviewed = r.res; doc.exported = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
      console.log(`  written to ${file}`);
    }
  }
} finally { await browser.close(); server.kill(); }
