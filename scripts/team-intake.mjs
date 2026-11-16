// Reads a restaurant's wine list and menus into its list file (data/team-<seed>-list.json), through the app's own
// reader (TeamData.read: the prompts and Worker purposes an upload in the app uses, a PDF two pages a call), so an
// install or a pitch demo starts from the files a restaurant sends rather than a list typed by hand.
// Every call is a draft (the Worker's TEAM_DRAFT_MODEL) and is billed; the tokens are added up at the end.
// A wine printed twice (a by-the-glass page, then its bottle in its section) becomes one wine with both prices.
// Usage: npm run team:intake -- <seed> --name "The Restaurant" --city London --country GB --sym £ --code GBP
//          --list wine-list.pdf [--list more.pdf] --menu dinner.pdf [--menu dessert.pdf] [--style "…"] [--force]
// Check the result against the PDFs before anything is written from it: prices are what the pitch stands on.
import fs from 'node:fs';
import os from 'node:os';
import { spawn, execSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = process.argv.slice(2), seed = args[0] && !args[0].startsWith('--') ? args[0] : null;
const one = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const many = (k) => args.map((a, i) => (a === '--' + k ? args[i + 1] : null)).filter(Boolean);
const lists = many('list'), menus = many('menu'), name = one('name');
if (!seed || !name || !lists.length) { console.error('npm run team:intake -- <seed> --name "The Restaurant" --list wine-list.pdf [--menu menu.pdf]'); process.exit(2); }
const file = `data/team-${seed}-list.json`;
if (fs.existsSync(file) && !args.includes('--force')) { console.error(`${file} is already there; --force reads it again.`); process.exit(2); }
const venue = { name, city: one('city', ''), country: one('country', ''), style: one('style', ''), currency: { sym: one('sym', '£'), code: one('code', 'GBP') }, training: { tier: 'essentials' } };
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
const kindOf = (f) => (/\.pdf$/i.test(f) ? 'pdf' : 'image'), load = (f) => ({ kind: kindOf(f), data: fs.readFileSync(f).toString('base64') });

execSync('node scripts/build.mjs', { stdio: 'ignore' });
const port = 4197, server = spawn('node', ['scripts/serve.mjs', 'dist', String(port)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch();
const use = { calls: 0, in: 0, out: 0, read: 0, write: 0, model: '' };
try {
  const page = await browser.newPage();
  await page.route('**/claude', async (route) => {
    try {
      const body = JSON.stringify({ ...JSON.parse(route.request().postData()), draft: true });
      const out = await new Promise((res, rej) => { const c = spawn('curl', ['-sS', '-m', '300', '-X', 'POST', `${API}/claude`, '-H', 'Content-Type: application/json', '-H', `Origin: ${API}`, '--data-binary', '@-', '-w', '\n%{http_code}']);
        let o = ''; c.stdout.on('data', (d) => { o += d; }); c.on('close', (code) => (code ? rej(new Error('curl ' + code)) : res(o))); c.stdin.end(body); });
      const i = out.lastIndexOf('\n'), status = Number(out.slice(i + 1)) || 502;
      if (status !== 200) console.log(`  /claude answered ${status}: ${out.slice(0, Math.min(i, 200))}`);
      else try { const j = JSON.parse(out.slice(0, i)), u = j.usage || {}; use.calls++; use.in += u.input_tokens || 0; use.out += u.output_tokens || 0; use.read += u.cache_read_input_tokens || 0; use.write += u.cache_creation_input_tokens || 0; use.model = j.model || use.model; } catch (e) {}
      await route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: out.slice(0, i) });
    } catch (e) { await route.fulfill({ status: 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: e.message }) }); }
  });
  await page.goto(`http://localhost:${port}/team/?seed=sample`);
  await page.waitForFunction(() => window.TeamData && window.TeamLearn);
  page.on('console', (m) => { if (/^read:/.test(m.text())) console.log(m.text()); });
  // An empty restaurant in the venue's currency, so the reader is told the right one.
  await page.evaluate((v) => { const d = TeamData.get(); d.venue = { ...v }; d.wines = {}; d.dishes = {}; d.draft = null; TeamData.save(d); }, venue);
  // A long PDF is cut into two-page files first (poppler's pdfseparate and pdfunite): handed the whole file and told
  // which pages to read, the reader lost count (one call read 94 wines, another 20) and every call paid for every page.
  const split = (f) => { if (kindOf(f) !== 'pdf') return [f];
    try { const dir = fs.mkdtempSync(os.tmpdir() + '/intake-'); execSync(`pdfseparate ${JSON.stringify(f)} ${JSON.stringify(dir + '/p-%03d.pdf')}`, { stdio: 'ignore' });
      const pages = fs.readdirSync(dir).filter((x) => /^p-\d+\.pdf$/.test(x)).sort().map((x) => dir + '/' + x); if (pages.length <= 2) return [f];
      const out = []; for (let i = 0; i < pages.length; i += 2) { const o = `${dir}/part-${String(i / 2 + 1).padStart(2, '0')}.pdf`; if (pages[i + 1]) execSync(`pdfunite ${JSON.stringify(pages[i])} ${JSON.stringify(pages[i + 1])} ${JSON.stringify(o)}`, { stdio: 'ignore' }); else fs.copyFileSync(pages[i], o); out.push(o); }
      return out; } catch (e) { console.log('  pdfseparate is not here: reading the PDF whole, check the page counts.'); return [f]; } };
  const read = async (kind, files) => {
    const items = [];
    for (const f of files.flatMap(split)) {
      console.log(`Reading ${f}…`);
      // One file at a time, each page pair tried again if its answer doesn't parse.
      const got = await page.evaluate(async ([kind, file]) => {
        const n = file.kind === 'pdf' ? TeamData.pdfPages(file.data) : 1, out = [];
        const tpl = _loadTextSync(kind === 'list' ? 'prompts/team-list.txt' : 'prompts/team-menu.txt'), cur = TeamData.currency();
        const jobs = []; if (file.kind === 'pdf') for (let p = 1; p <= n; p += TeamData.PDF_PAGES) jobs.push(`This PDF has ${n} page${n === 1 ? '' : 's'}. Read ONLY page${p < n ? 's' : ''} ${p}${p < n ? ' to ' + Math.min(n, p + TeamData.PDF_PAGES - 1) : ''}; another reader covers the rest.`); else jobs.push('Read the whole image.');
        const block = file.kind === 'pdf' ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: file.data } } : { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: file.data } };
        await Promise.all(jobs.map(async (scope, k) => { for (let t = 0; t < 3; t++) { try {
          const text = await window.claude.complete({ purpose: kind === 'list' ? 'team_list' : 'team_menu', messages: [{ role: 'user', content: [block, { type: 'text', text: tpl.replace('{{currency}}', `${cur.code} (${cur.sym})`).replace('{{scope}}', scope) }] }] });
          const j = TeamData._json(text); if (!j) throw new Error('no JSON');
          out[k] = kind === 'list' ? j.wines || [] : j.dishes || []; console.log(`read: ${scope.replace(/^.*ONLY /, '').replace(/;.*$/, '')}: ${out[k].length}`); return;
        } catch (e) { console.log(`read: a part failed (${e.message}), try ${t + 2}`); } } out[k] = []; }));
        return out.flat().map((r, i) => (kind === 'list' ? TeamData._wine(r, i) : TeamData._dish(r, i))).filter((x) => x.name);
      }, [kind, load(f)]);
      items.push(...got);
    }
    return items;
  };
  const rawWines = await read('list', lists), rawDishes = menus.length ? await read('menu', menus) : [];
  // --raw keeps every reading as it came back, for checking the joins.
  if (one('raw')) fs.writeFileSync(one('raw'), JSON.stringify({ wines: rawWines, dishes: rawDishes }, null, 1));
  // One wine per bottle: a glass-only reading joins the same wine and vintage read with its bottle price.
  const out = await page.evaluate(([ws, ds]) => {
    const kept = [], sym = TeamData.currency().sym, money = (s) => { s = String(s || '').trim(); return s && /^[\d.,]+$/.test(s) ? sym + s : s; };
    ws.forEach((w) => { w.glass = money(w.glass); w.bottle = money(w.bottle);
      // Only a reading without its bottle price (the by-the-glass page) or the same line read twice joins another:
      // two cuvées from one house at different prices stay two wines.
      const m = kept.find((k) => (k.vintage || null) === (w.vintage || null) && (!k.bottle || !w.bottle || k.bottle === w.bottle) && TeamData._same(k, w));
      if (!m) { kept.push(w); return; }
      if (!m.glass && w.glass) m.glass = w.glass; if (!m.bottle && w.bottle) m.bottle = w.bottle;
      if (w.other && !String(m.other || '').includes(w.other)) m.other = [m.other, w.other].filter(Boolean).join(' · ');
      // The section a guest would look under is the bottle's own, not "By the glass".
      if (/glass/i.test(m.section || '') && w.section && !/glass/i.test(w.section)) { m.section = w.section; if (w.region) m.region = w.region; }
      if (!(m.grapes || []).length && (w.grapes || []).length) { m.grapes = w.grapes; m.grapes_basis = w.grapes_basis; }
    });
    const ids = new Set(), uid = (id) => { let x = id, n = 2; while (ids.has(x)) x = `${id}-${n++}`; ids.add(x); return x; };
    const wines = kept.map((w) => { const { order, ...r } = w; return { ...r, id: uid(TeamData.wineId(w) + (kept.filter((k) => TeamData.wineId(k) === TeamData.wineId(w)).length > 1 && w.vintage ? '-' + w.vintage : '')) }; });
    const seen = new Set(), dishes = ds.filter((x) => { const id = TeamData.dishId(x); if (seen.has(id)) return false; seen.add(id); return true; }).map((x) => { const { order, ...r } = x; return { id: TeamData.dishId(x), ...r, price: money(r.price) }; });
    return { wines, dishes, merged: ws.length - kept.length };
  }, [rawWines, rawDishes]);
  fs.writeFileSync(file, JSON.stringify({ rev: 1, venue, wines: out.wines, dishes: out.dishes, cocktails: [], staff: [] }, null, 1) + '\n');
  console.log(`${file}: ${out.wines.length} wines (${out.merged} glass readings joined to their bottle), ${out.dishes.length} dishes.`);
  console.log(`Tokens: ${use.calls} calls on ${use.model || 'the draft model'} · ${use.in} in · ${use.out} out · ${use.read} cache read · ${use.write} cache write`);
  console.log(`Next: check prices against the PDFs, add the seed's row (TeamSample.SEEDS, file(), list()), then npm run team:write -- ${seed} --pitch`);
} finally { await browser.close(); server.kill(); }
