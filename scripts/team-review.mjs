// The sommelier review of a restaurant before it's handed over: every question read as the drill shows it by a head
// sommelier (TeamData.sommelierReview, prompts/team-review.txt), the doubtful ones rewritten and read again, anything
// still doubted held out of the drill, and the result written into the restaurant's file (data/team-<name>.json:
// its cards and `reviewed`), so the install opens with it. The rule review (npm run team:audit) must pass first.
// Calls the deployed Worker's /claude for real (billed): VINTEREST_API_ORIGIN picks which (default production; a
// branch preview while team_review is only there).
// Usage: npm run team:review -- social   [--dry] [--held]   (--dry: report only, write nothing; --held: read again only what
// the last review held, and merge)
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), dry = args.includes('--dry'), heldOnly = args.includes('--held'), seeds = args.filter((a) => !a.startsWith('--'));
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
        const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502;
        if (status !== 200) console.log(`\n  /claude answered ${status}: ${out.slice(0, Math.min(i, 160))}`);
        await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
      } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
    });
    page.on('console', (m) => { if (/review:/.test(m.text())) console.log(m.text()); });
    await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    const rules = await page.evaluate(() => TeamLearn.review().length);
    if (rules) { console.error(`\n${seed}: ${rules} questions fail the rule review; run npm run team:audit and fix those first.`); process.exitCode = 1; continue; }
    // A long list's review in parallel and in smaller batches, so each answer comes back inside the Worker's time to
    // Anthropic: REVIEW_LANES (default 6) at a time, REVIEW_BATCH (default 6) questions each.
    await page.evaluate(([lanes, batch]) => { TeamData.REVIEW_AT_ONCE = lanes; TeamData.REVIEW_BATCH = batch; }, [Number(process.env.REVIEW_LANES) || 6, Number(process.env.REVIEW_BATCH) || 6]);
    // --held: only the questions the last review held are read again (after a rule change, say), and the result is merged
    // into the last review: what now passes comes back into the drill, what's still doubted stays held with its new note.
    const before = heldOnly ? await page.evaluate(() => TeamData.reviewed()) : null;
    if (heldOnly && !(before && before.held && before.held.length)) { console.log(`${seed}: nothing held to read again.`); continue; }
    const r = await page.evaluate(async (only) => {
      if (!only) await TeamData.checkQuestions(null, (a, b) => console.log(`review: rule rewrites ${a} of ${b}`)); // repeats and giveaways rewritten first
      const res = await TeamData.sommelierReview({ only: only || undefined, onStep: (a, b) => console.log(`review: ${a} of ${b}`) });
      if (!res) return null;
      const d = TeamData.get();
      return { res, cards: d.cards, notes: res.held.map((id) => ({ id, ...res.notes[id] })), name: d.venue.name };
    }, heldOnly ? before.held : null);
    if (r && heldOnly) { const back = before.held.filter((id) => !r.res.held.includes(id));
      console.log(`\n${r.name}: ${before.held.length} held questions read again, ${back.length} back in the drill, ${r.res.held.length} still held`);
      r.res = { ...before, at: r.res.at, fixed: before.fixed + back.length, held: r.res.held, notes: r.res.notes, reread: { at: r.res.at, read: before.held.length, back: back.length } }; }
    console.log('');
    if (!r) { console.log(`${seed}: the demo restaurant isn't sent for review.`); continue; }
    held += r.res.held.length;
    console.log(`${r.name}: ${r.res.asked} questions read, ${r.res.doubted} doubted, ${r.res.fixed} rewritten, ${r.res.held.length} held`);
    for (const n of r.notes) console.log(`  [${n.problem}] ${n.id}: ${n.note}`);
    // Last, the app's own check (TeamLearn.review, what npm run team:audit runs) over the result: a rewrite can pass the
    // sommelier and still fail a rule, and a question released by a --held read may be one held by hand for a rule. Anything
    // it flags is held too, so the file this writes always passes the audit.
    const flagged = await page.evaluate((res) => { const d = TeamData.get(); d.venue.reviewed = res; TeamData.save(d);
      return TeamLearn.review().map((f) => ({ id: f.q.id, code: f.code, note: f.note })); }, r.res);
    const extra = flagged.filter((f, i, a) => !r.res.held.includes(f.id) && a.findIndex((x) => x.id === f.id) === i);
    if (extra.length) { r.res = { ...r.res, held: [...r.res.held, ...extra.map((f) => f.id)], notes: { ...r.res.notes, ...Object.fromEntries(extra.map((f) => [f.id, { problem: f.code, note: `The app's own check: ${f.note}` }])) } };
      console.log(`  ${extra.length} more held by the app's own check:`); extra.forEach((f) => console.log(`  [${f.code}] ${f.id}: ${f.note}`)); }
    if (!dry) {
      const file = `data/team-${seed}.json`, doc = JSON.parse(fs.readFileSync(file, 'utf8'));
      doc.cards = r.cards; doc.reviewed = r.res; doc.exported = new Date().toISOString();
      fs.writeFileSync(file, JSON.stringify(doc, null, 1) + '\n');
      console.log(`  written to ${file}`);
    }
  }
} finally { await browser.close(); server.kill(); }
