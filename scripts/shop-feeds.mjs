// Reads a partner shop's Awin product feed (CSV, gzip) and, for now, reports what's in it: which
// columns the shop fills, how its wines are named and priced, and a few sample matches, so the
// "Buy at <shop>" lookup is built on the real data. The feed's download URL holds the publisher's
// feed key, so it only ever comes from the environment (a GitHub secret), never the repo or a log.
//   AWIN_FEED_WINEBUYERS=<url> node scripts/shop-feeds.mjs --report [--find "tignanello"]
import zlib from 'node:zlib';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : a), []));
const FEEDS = { winebuyers: process.env.AWIN_FEED_WINEBUYERS };

// RFC 4180 CSV: quoted fields may hold commas, quotes ("") and newlines.
function parseCsv(text) {
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
  return rows;
}

async function load(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`feed download failed: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const text = (buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString('utf8');
  const [head, ...rows] = parseCsv(text);
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}

for (const [shop, url] of Object.entries(FEEDS)) {
  if (!url) { console.log(`${shop}: no feed URL set`); continue; }
  const items = await load(url);
  const cols = Object.keys(items[0] || {});
  let md = `# ${shop} feed\n\n${items.length} products, ${cols.length} columns.\n\n## Columns (share filled, an example)\n\n`;
  for (const c of cols) {
    const filled = items.filter((x) => String(x[c]).trim()).length;
    const ex = (items.find((x) => String(x[c]).trim()) || {})[c] || '';
    md += `- \`${c}\`: ${Math.round((100 * filled) / items.length)}%${filled ? ` · ${JSON.stringify(String(ex).slice(0, c.includes('link') || c.includes('url') ? 60 : 140))}` : ''}\n`;
  }
  const count = (k) => Object.entries(items.reduce((m, x) => ((m[x[k] || '(blank)'] = (m[x[k] || '(blank)'] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 25);
  for (const k of ['merchant_category', 'category_name', 'product_type', 'colour', 'currency', 'in_stock']) if (cols.includes(k)) md += `\n## ${k}\n\n` + count(k).map(([v, n]) => `- ${v}: ${n}`).join('\n') + '\n';
  const yr = items.filter((x) => /\b(19|20)\d{2}\b/.test(x.product_name)).length;
  md += `\n${Math.round((100 * yr) / items.length)}% of names carry a vintage.\n`;
  for (const q of String(args.find || 'tignanello|ardanza|muga|beaucastel|cloudy bay').split('|')) {
    const hits = items.filter((x) => `${x.brand_name} ${x.product_name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    md += `\n## "${q}" (${hits.length} shown)\n\n` + hits.map((x) => `- ${x.product_name} | brand ${x.brand_name || '-'} | ${x.currency} ${x.search_price} | in_stock ${x.in_stock || '-'} | ${['custom_1', 'custom_2', 'custom_3', 'custom_4', 'custom_5', 'custom_6', 'custom_7', 'custom_8', 'specifications', 'colour'].filter((k) => x[k]).map((k) => `${k}=${String(x[k]).slice(0, 50)}`).join(' ')}`).join('\n') + '\n';
  }
  fs.writeFileSync(`feed-report-${shop}.md`, md);
  console.log(md.slice(0, 3000));
}
