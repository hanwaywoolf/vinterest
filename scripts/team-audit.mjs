// The question review for every restaurant in the build: each question put through what a person sees in the drill
// (TeamLearn.review: a wrong answer about another dish, an answer of another kind, a table request that gives the
// answer away, an answer screen that repeats the answer or runs long, duplicate options, a length cue, a giveaway
// word). Prints what it finds per restaurant and exits 1 if anything is flagged. No network: it runs the built app.
// Usage: npm run team:audit [-- demo social]   (builds first)
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const seeds = process.argv.slice(2).length ? process.argv.slice(2) : ['demo', 'social', 'princess-royal', 'sample'];
execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4199, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let total = 0;
const browser = await chromium.launch();
try {
  for (const seed of seeds) {
    const page = await browser.newPage();
    await page.goto(`http://localhost:${port}/team/?seed=${seed}`);
    await page.waitForFunction(() => window.TeamLearn && TeamData.wines().length > 0);
    const r = await page.evaluate(() => ({ name: TeamData.get().venue.name, asked: TeamLearn.allQs().length,
      flags: TeamLearn.review().map((f) => ({ code: f.code, q: f.q.q, note: f.note, about: f.q.wine ? TeamData.short(TeamData.wine(f.q.wine) || {}) : f.q.cocktail ? (TeamData.cocktail(f.q.cocktail) || {}).name : f.q.dish ? (TeamData.dish(f.q.dish) || {}).name : '' })) }));
    total += r.flags.length;
    console.log(`\n${r.name} (?seed=${seed}): ${r.asked} questions, ${r.flags.length} flagged`);
    for (const f of r.flags) console.log(`  [${f.code}] ${f.about}: ${f.q}\n      ${f.note}`);
    await page.close();
  }
} finally { await browser.close(); server.kill(); }
process.exit(total ? 1 : 0);
