// The partner shops' Awin product feeds, into Supabase's shop_products table (migration 0005), so
// a wine's Price tab can show the very bottle with "Buy at <shop>" (the Worker's /shop-match).
// Run nightly by .github/workflows/shop-feeds.yml for every shop in data/retailers.json with
// "feed": "awin", whose download URL is the secret AWIN_FEED_<ID> (it holds the publisher's feed
// key, so it only ever comes from the environment, never the repo or a log).
//   node scripts/shop-feeds.mjs --report          what's in each feed (columns, samples), no writes
//   node scripts/shop-feeds.mjs --sync            replace each shop's rows (SUPABASE_URL, SUPABASE_FEEDS_KEY)
//   node scripts/shop-feeds.mjs --check           what the Worker's /shop-match finds for some well-known wines
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines.
export function parseCsv(text) {
  const rows = [];
  let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [head = [], ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

// A name's words: lower-case, accents gone, letters and digits only. The same as _lcboWords in
// _worker.js, which matches a scanned wine against these.
export function words(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}

/* One feed row as a shop_products row, or null for anything that isn't wine. Marketplace names
   carry a seller ("… | Perfect Bottle (1x75cl)"), cases ("(case of 3)", "12 x 75cl"), half
   bottles and magnums, which the Worker needs to tell apart from the single 75cl bottle. */
export function toRow(shop, x, seenAt) {
  if (!/^wine\b/i.test(x.merchant_category || x.category_name || '')) return null;
  const price = parseFloat(x.search_price);
  if (!x.aw_product_id || !x.product_name || !(price >= 0)) return null;
  const full = x.product_name.replace(/\s+/g, ' ').trim();
  const [main, ...rest] = full.split(' | ');
  const tail = rest.join(' | ');
  const brand = (x.brand_name || '').trim();
  const sellerPart = tail.replace(/\([^)]*\)/g, '').trim();
  // A seller's suffix ends with its pack in brackets ("Perfect Bottle (1x75cl)"); a bare repeat of
  // the wine's own name ("| La Rioja Alta Vina") isn't one.
  const seller = /\(\s*\d+\s*x/i.test(tail) && sellerPart && brand && sellerPart.toLowerCase() === brand.toLowerCase() && !/^winebuyers$/i.test(brand) ? brand : null;
  const t = full.toLowerCase();
  let pack = 1;
  const m = t.match(/case of (\d+)/) || t.match(/\b(\d+)\s*x\s*(?:75|37\.5|50|150)\s*cl\b/) || t.match(/\b(\d+)\s*bottles\b/);
  if (m) pack = Math.max(1, parseInt(m[1], 10));
  let size = 750;
  if (/half bottle|37\.5\s*cl|375\s*ml/.test(t)) size = 375;
  else if (/double magnum|300\s*cl|\b3\s*l(itre)?s?\b/.test(t) && !/3000\s*cl/.test(t)) size = 3000;
  else if (/magnum|150\s*cl|1\.5\s*l(itre)?s?\b/.test(t)) size = 1500;
  else if (/\b50\s*cl\b|500\s*ml/.test(t)) size = 500;
  const year = (main.match(/\b(18[5-9]\d|19\d{2}|20\d{2})\b/) || [])[1];
  const vintage = year && +year <= new Date().getFullYear() + 1 ? +year : null;
  return {
    shop, product_id: String(x.aw_product_id), name: main.trim().slice(0, 300), words: [...new Set(words(main))].slice(0, 40),
    vintage, size_ml: size, pack, price: Math.round(price * 100) / 100, currency: (x.currency || 'GBP').toUpperCase(),
    url: x.merchant_deep_link || x.aw_deep_link, image: x.aw_image_url || x.merchant_image_url || null, seller, seen_at: seenAt,
  };
}

async function load(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`feed download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return parseCsv((buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8'));
}

function report(shop, items, rows) {
  const cols = Object.keys(items[0] || {});
  let md = `# ${shop} feed\n\n${items.length} products, ${rows.length} of them wine, ${cols.length} columns.\n`;
  md += `\n${rows.filter((r) => r.vintage).length} wines with a vintage, ${rows.filter((r) => r.pack > 1).length} cases, ${rows.filter((r) => r.size_ml !== 750).length} not 75cl, ${rows.filter((r) => r.seller).length} with a named seller.\n`;
  for (const q of ['tignanello', 'ardanza', 'muga', 'beaucastel', 'cloudy bay']) {
    const hits = rows.filter((r) => r.words.join(' ').includes(q)).slice(0, 8);
    md += `\n## "${q}"\n\n` + hits.map((r) => `- ${r.name} | ${r.vintage || 'NV'} | ${r.pack}×${r.size_ml}ml | ${r.currency} ${r.price}${r.seller ? ` | ${r.seller}` : ''}`).join('\n') + '\n';
  }
  return md;
}

async function sync(shop, rows, seenAt) {
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_FEEDS_KEY;
  if (!base || !key) throw new Error('SUPABASE_URL and SUPABASE_FEEDS_KEY are needed to sync');
  const h = { apikey: key, 'content-type': 'application/json' };
  const before = await fetch(`${base}/rest/v1/shop_products?shop=eq.${shop}&select=product_id`, { method: 'HEAD', headers: { ...h, prefer: 'count=exact' } });
  const had = parseInt((before.headers.get('content-range') || '').split('/')[1] || '0', 10) || 0;
  // A feed that came back far smaller than last night's is more likely broken than a shop that
  // sold out: keep yesterday's rows rather than wipe the catalogue.
  if (rows.length < 100 || (had && rows.length < had * 0.5)) throw new Error(`${shop}: only ${rows.length} wines (had ${had}); keeping the old rows`);
  for (let i = 0; i < rows.length; i += 1000) {
    const r = await fetch(`${base}/rest/v1/shop_products?on_conflict=shop,product_id`, { method: 'POST', headers: { ...h, prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 1000)) });
    if (!r.ok) throw new Error(`${shop}: upload failed at row ${i}: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
  }
  const del = await fetch(`${base}/rest/v1/shop_products?shop=eq.${shop}&seen_at=lt.${encodeURIComponent(seenAt)}`, { method: 'DELETE', headers: { ...h, prefer: 'return=minimal' } });
  if (!del.ok) throw new Error(`${shop}: removing old rows failed: HTTP ${del.status}`);
  // Read a few back, so the run's log shows the table really holds them.
  const back = await fetch(`${base}/rest/v1/rpc/shop_candidates`, { method: 'POST', headers: h, body: JSON.stringify({ p_shop: shop, p_words: ['tignanello', 'ardanza'], p_limit: 8 }) });
  const sample = back.ok ? (await back.json()).map((r) => `  ${r.name} | ${r.vintage || 'NV'} | ${r.pack}x${r.size_ml}ml | ${r.currency} ${r.price}`).join('\n') : `  reading back failed: HTTP ${back.status}`;
  return `${shop}: ${rows.length} wines saved (had ${had}).\n${sample}`;
}

// The Worker's own /shop-match (handleShopMatch in _worker.js) against the loaded table, for wines
// whose answer we know, so a change to the matching or a new feed can be judged on real listings.
const CHECK = [
  { name: 'Tignanello', producer: 'Marchesi Antinori', vintage: 2021, region: 'Toscana', country: 'Italy', grapes: ['Sangiovese'] },
  { name: 'Tignanello', producer: 'Marchesi Antinori', vintage: 2019, region: 'Toscana', country: 'Italy' },
  { name: 'Viña Ardanza Reserva', producer: 'La Rioja Alta', vintage: 2016, region: 'Rioja', country: 'Spain' },
  { name: 'Muga Reserva', producer: 'Bodegas Muga', vintage: 2020, region: 'Rioja', country: 'Spain' },
  { name: 'Sauvignon Blanc', producer: 'Cloudy Bay', vintage: 2024, region: 'Marlborough', country: 'New Zealand', grapes: ['Sauvignon Blanc'] },
  { name: 'Châteauneuf-du-Pape', producer: 'Château de Beaucastel', vintage: 2019, region: 'Rhône', country: 'France' },
  { name: 'Sassicaia', producer: 'Tenuta San Guido', vintage: 2020, region: 'Bolgheri', country: 'Italy' },
  { name: 'Barolo', producer: 'G.D. Vajra', vintage: 2019, region: 'Piedmont', country: 'Italy', grapes: ['Nebbiolo'] },
  { name: 'Whispering Angel', producer: "Château d'Esclans", vintage: 2024, region: 'Côtes de Provence', country: 'France', type: 'rose' },
  { name: 'Brut Réserve', producer: 'Charles Heidsieck', vintage: null, region: 'Champagne', country: 'France', type: 'sparkling' },
];
async function check() {
  const worker = (await import(pathToFileURL(path.join(ROOT, '_worker.js')).href)).default;
  const env = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY: 'unused', SUPABASE_SECRET_KEY: process.env.SUPABASE_FEEDS_KEY,
    ASSETS: { fetch: async () => new Response(fs.readFileSync(path.join(ROOT, 'data/retailers.json'))) } };
  let out = '# What /shop-match finds\n';
  for (const wine of CHECK) {
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/shop-match', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify({ country: 'gb', wine }) }), env);
    const d = await r.json();
    const it = (x) => `${x.name} (${x.vintage || 'NV'}${x.pack > 1 ? `, case of ${x.pack}` : ''}${x.sizeMl !== 750 ? `, ${x.sizeMl}ml` : ''}) £${x.price}${x.seller ? `, ${x.seller}` : ''}`;
    out += `\n- **${wine.producer} ${wine.name} ${wine.vintage || 'NV'}**: ${d.exact ? it(d.exact) : 'no exact'}${(d.others || []).length ? `; other vintages: ${d.others.map(it).join('; ')}` : ''}${d.items && !d.items.length ? ' (nothing)' : ''}`;
  }
  return out + '\n';
}

async function main() {
  if (process.argv.includes('--check')) { const out = await check(); fs.writeFileSync(path.join(ROOT, 'feed-report-check.md'), out); console.log(out); return; }
  const mode = process.argv.includes('--sync') ? 'sync' : 'report';
  const shops = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/retailers.json'), 'utf8')).retailers.filter((r) => r.feed === 'awin');
  const seenAt = new Date().toISOString();
  let out = '', failed = false;
  for (const s of shops) {
    const url = process.env[`AWIN_FEED_${s.id.toUpperCase()}`];
    if (!url) { out += `${s.id}: no feed URL (secret AWIN_FEED_${s.id.toUpperCase()})\n`; continue; }
    try {
      const items = await load(url);
      const rows = items.map((x) => toRow(s.id, x, seenAt)).filter(Boolean);
      out += mode === 'sync' ? (await sync(s.id, rows, seenAt)) + '\n' : report(s.id, items, rows);
    } catch (e) { failed = true; out += `${s.id}: ${e.message}\n`; }
  }
  fs.writeFileSync(path.join(ROOT, `feed-report-${mode}.md`), out);
  console.log(out);
  if (failed) process.exitCode = 1;
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
