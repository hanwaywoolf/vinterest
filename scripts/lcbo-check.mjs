// Runs the Worker's real /lcbo lookup (handleLcbo in _worker.js) against the live LCBO.dev API for a
// few wines and cities, and prints what the app would get, so we know it works before testers do.
//   node scripts/lcbo-check.mjs [--city Ottawa] [--wine "Bodegas Muga|Muga Reserva"]
// No key is needed; LCBO.dev allows 60 requests a minute. The lcbo-probe workflow runs this on
// GitHub's machines and posts the result on the commit.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const worker = (await import(pathToFileURL(path.join(root, '_worker.js')).href)).default;

const WINES = args.wine ? [args.wine] : ['Bodegas Muga|Muga Reserva', 'La Rioja Alta|Viña Ardanza Reserva', 'Château de Beaucastel|Châteauneuf-du-Pape', 'Kim Crawford|Sauvignon Blanc', 'Tignanello|Tignanello'];
const CITIES = args.city ? [args.city] : ['Ottawa', 'Toronto', 'Kingston'];

let md = `# LCBO check\n\n${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC\n`;
for (const city of CITIES) {
  md += `\n## ${city}\n`;
  for (const w of WINES) {
    const [producer, name] = w.split('|');
    const t = Date.now();
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/lcbo', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify({ wine: { name, producer }, city }) }), { LCBO_ENABLED: '1' });
    const d = await r.json();
    const said = !d.available ? 'LCBO.dev could not answer' : !d.cityFound ? 'no LCBO store found in this city' : !d.found ? 'not matched to an LCBO product'
      : `${d.product.name} (#${d.product.sku}, $${d.product.price}): ${d.stores.length ? d.stores.map((s) => `${s.name} ${s.km} km, ${s.quantity}`).join('; ') : 'no store within 25 km has it'}`;
    md += `- ${producer} ${name}: ${said} (${Date.now() - t} ms)\n`;
    console.log(`${city} | ${producer} ${name}: ${said}`);
  }
}
process.stdout.write('\n');
(await import('node:fs')).writeFileSync(path.join(root, 'lcbo-check.md'), md);
