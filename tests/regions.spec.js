// One region never splits in two. A wine's label may name an appellation (Côtes de Provence,
// Bandol, Brunello di Montalcino); whenever wines are grouped, counted or compared by region they
// count under their knowledge-base region (WineDNA.region → Regions.of), while a wine's own screens
// keep showing the label. The guard below fails if new code groups by the raw label region.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { stubNetwork, makeDeterministic, seedLocalStorage } = require('./helpers');

const BASE = 'http://localhost:4173';
const ROOT = path.join(__dirname, '..');

const ROSES = [
  { name: 'Whispering Test Rosé', producer: 'Esclans', type: 'rose', region: 'Côtes de Provence', country: 'France', rating: 95, vintage: 2023, scanned_at: '2026-05-01T00:00:00Z' },
  { name: 'Minuty Test Prestige', producer: 'Minuty', type: 'rose', region: 'Côtes de Provence', country: 'France', rating: 93, vintage: 2023, scanned_at: '2026-05-10T00:00:00Z' },
  { name: 'Le Petit Chat Malin Rosé', producer: 'Test', type: 'rose', region: 'Provence', country: 'France', rating: 92, vintage: 2024, scanned_at: '2026-06-01T00:00:00Z' },
  { name: 'Bandol Test Rosé', producer: 'Tempier', type: 'rose', region: 'Bandol', country: 'France', rating: 94, vintage: 2023, scanned_at: '2026-06-05T00:00:00Z' },
];

test('Côtes de Provence, Bandol and Provence count as one region in WineDNA, its journey and its facts', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_wines: JSON.stringify(ROSES) });
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`);
  const out = await page.evaluate(() => {
    const wines = WineHistory.getAll();
    const p = WineDNA.profile('rose', wines, 'Rosé');
    return {
      favourites: p.favourites.regions.map((r) => [r.name, r.count, r.avg]),
      top: p.topRegions,
      journey: WineDNA.journey(wines).flatMap((b) => b.newRegions),
      facts: WineDNA.summaryFacts(p),
      label: wines.find((w) => w.name === 'Bandol Test Rosé').region,
    };
  });
  expect(out.favourites).toEqual([['Provence', 4, 94]]);
  expect(out.top).toEqual(['Provence']);
  expect(out.journey).toEqual(['Provence']);
  expect(out.facts).toContain('Provence (4 bottles, avg 94)');
  expect(out.facts).not.toMatch(/Côtes de Provence|Bandol/);
  // The wine itself still says what its label says.
  expect(out.label).toBe('Bandol');
});

// Grouping, counting and comparing by region go through WineDNA.region (or Regions.of/resolve).
// These shapes on a wine's raw `.region` (a wine is `w` or `wine` throughout the code) are the ones
// that split a region in two; showing "region · country" under a wine's name is fine and allowed:
//   comparing it with anything but its own country, [region, score] pairs for stats,
//   Set/Map keys, and map(w => w.region).
const WINE = String.raw`\b(?:w|wine)\??\.region`;
const GROUPING = [
  new RegExp(WINE + String.raw`\s*(?:===|!==)\s*(?!(?:w|wine)\??\.country\b)`),
  new RegExp(String.raw`\[\s*` + WINE + String.raw`\s*,\s*(?:w|wine)\??\.(?:rating|score)`),
  new RegExp(String.raw`\.(?:add|has|set|get)\(\s*` + WINE + String.raw`\s*[),]`),
  new RegExp(String.raw`map\(\s*\(?\s*(?:w|wine)\s*\)?\s*=>\s*` + WINE + String.raw`\s*\)`),
];

test('no shipped code groups, counts or compares wines by the raw label region', async () => {
  const { APP_SOURCES } = await import(path.join(ROOT, 'scripts/app-sources.mjs'));
  const hits = [];
  for (const file of APP_SOURCES) {
    fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').forEach((line, i) => {
      if (GROUPING.some((re) => re.test(line))) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 140)}`);
    });
  }
  expect(hits, 'group by WineDNA.region(w), not w.region').toEqual([]);
});

// Flags add colour wherever a region is named: a label region resolves to its knowledge-base
// region's country, articles show the flags of the regions they're about, and WineDNA's best
// regions and a region quiz's title carry one.
test('flags show on region containers: a region quiz', async ({ context, page }) => {
  await makeDeterministic(page);
  await seedLocalStorage(page, { vinterest_onboarded: '1', vinterest_region: 'uk', vinterest_wines: JSON.stringify(ROSES) });
  await stubNetwork(context);
  await page.goto(`${BASE}/#home`);
  const fr = await page.evaluate(() => Regions.countryFlag('France'));
  expect(await page.evaluate(() => [Regions.nameFlag('Côtes de Provence'), Regions.nameFlag('Provence'), Regions.nameFlag('Nowhere')])).toEqual([fr, fr, '']);

  await page.evaluate(() => Handoff.quiz.set({ mode: 'region', region: 'Provence' }));
  await page.goto(`${BASE}/?q=1#quiz`);
  await expect(page.locator('#root').getByText('Your Provence Knowledge').locator('.vflag')).toHaveText(fr);
});

// A region's page lists real places inside it (each with what it is), never the matching aliases
// (which hold wine names and local spellings), and names the wines made there on a line of its own.
test('region places are places, with their kind; the wines made there are a separate line', async ({ page }) => {
  await page.goto(`${BASE}/#home`);
  const t = await page.evaluate(() => { const r = KNOWLEDGE.regions.Tuscany; return { places: r.places, wines: r.wines, aliases: r.aliases }; });
  expect(t.places.map((p) => p.name)).toEqual(['Chianti Classico', 'Chianti', 'Montalcino', 'Montepulciano', 'Bolgheri', 'Maremma', 'San Gimignano']);
  expect(t.places.find((p) => p.name === 'Chianti Classico').kind).toBe('appellation');
  expect(t.places.find((p) => p.name === 'Montalcino').kind).toBe('town');
  expect(t.places.map((p) => p.name)).not.toContain('Brunello di Montalcino');
  expect(t.wines).toContain('Brunello di Montalcino');
  expect(t.aliases).toContain('Brunello di Montalcino'); // still a matching alias
  // Every region has both, and every place says what it is (a place can also name a wine: Barolo, Sancerre).
  const bad = await page.evaluate(() => Object.entries(KNOWLEDGE.regions).filter(([, r]) => !Array.isArray(r.places) || !r.places.length || !Array.isArray(r.wines) || r.places.some((p) => !p.name || !p.kind)).map(([n]) => n));
  expect(bad).toEqual([]);
  // The page: their own label's place first and highlighted, each with its kind, then the wines.
  const info = await page.evaluate(() => RegionInfo.get('Tuscany', [{ name: 'Tignanello', region: 'Tuscany', sub_region: 'Chianti Classico', type: 'red', rating: 96 }]));
  expect(info.places[0]).toMatchObject({ name: 'Chianti Classico', kind: 'appellation', theirs: true });
  expect(info.theirs).toEqual(['Chianti Classico']);
  expect(info.wines[0]).toBe('Brunello di Montalcino');
});
