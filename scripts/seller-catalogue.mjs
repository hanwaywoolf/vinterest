// Vinterest Seller: an agency's catalogue as the app reads it (npm run seller:catalogue).
//
// intake/awsm/catalogue-on.json is Authentic Wines & Spirits' Ontario catalogue as its public site
// gives it (one record per listing, the product sheet's fields and the stock counts). This cuts each
// record to what matching and the visit brief use and writes data/seller-awsm.json. Where the sheet
// gives no style figures (body, tannin: it never does), no grapes or no region, intake/awsm/enrich.txt
// fills them, and the item says which fields are the agency's (`sheet`) and which an estimate.
// A real agency sends a feed in this shape; nothing here is fetched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const rows = JSON.parse(read('intake/awsm/catalogue-on.json'));
const enrich = Object.fromEntries(read('intake/awsm/enrich.txt').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => {
  const [cspc, body, acid, tannin, sweet, grapes, region, type] = l.split('|').map((s) => s.trim());
  return [cspc, { style: { body: +body, acid: +acid, tannin: +tannin, sweet: +sweet }, grapes: grapes ? grapes.split(',').map((g) => g.trim()) : null, region: region || null, type: type || null }];
}));

const flavours = Object.fromEntries(read('intake/awsm/flavours.txt').split('\n').filter((l) => l && !l.startsWith('#')).map((l) => { const [cspc, f] = l.split('|'); return [cspc.trim(), f.split(',').map((x) => x.trim()).filter(Boolean)]; }));
// A picture the platform really has (it answers with a placeholder bottle otherwise).
const pic = (o) => { const u = o && (o.medium || o.large || o.small); return u && !/placeholder/.test(u) ? u : null; };

// The platform writes grapes in its own French-leaning spellings, with shares, and sometimes twice.
const GRAPES = { 'cabernet-sauvignon': 'Cabernet Sauvignon', 'touriga francesa': 'Touriga Franca', 'tinto(a) cão': 'Tinto Cão', 'touriga': 'Touriga Nacional', 'petite sirah': 'Petite Sirah', 'gewurztraminer': 'Gewürztraminer', 'tinta roriz': 'Tinta Roriz', 'carmenère': 'Carmenère' };
const title = (s) => s.toLowerCase().replace(/(^|[\s-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
function grapesOf(text) {
  const out = [], shares = {};
  String(text || '').split(',').map((s) => s.trim()).filter(Boolean).forEach((part) => {
    const m = /^(.*?)(?:\s+(\d+(?:\.\d+)?)\s*%)?$/.exec(part), raw = m[1].trim(), key = raw.toLowerCase();
    if (!raw || /^autre/.test(key)) return;
    const name = GRAPES[key] || title(raw);
    if (out.includes(name)) return;
    out.push(name); if (m[2]) shares[name] = +m[2];
  });
  return { grapes: out, shares: Object.keys(shares).length ? shares : null };
}
const REGIONS = { 'Vallée du Rhône': 'Rhône Valley', 'Porto/Douro': 'Douro', 'Trentino Alto Adige': 'Alto Adige', 'Poitou-Charentes': 'Cognac', 'South Island': 'Marlborough', 'New Zealand': 'Marlborough', 'Toscana': 'Tuscany' };
const LISTING = { Core: 'LCBO general list', Vint: 'Vintages', VE: 'Vintages Essentials', CONS: 'Consignment', SPCHS: 'Specialty', SLQ: 'Specialty spirits', HVC: 'Consignment (high value)', SEAS: 'Seasonal', MISC: 'Private order', GRY: 'Half bottle', XMAS: 'Holiday' };
function typeOf(x, e) {
  const p = x.product_details, fam = p.product_family_en || '', col = (p.color_en || '').toLowerCase();
  if (x.product_details.product_nature_en !== 'Wine') return 'spirit';
  if (/fortified/i.test(fam)) return 'fortified';
  if (/effervescent/i.test(fam)) return 'sparkling';
  if (/icewine|late harvest/i.test(x.product_name)) return 'sweet';
  if (e && e.type) return e.type;
  return /pink|ros/.test(col) ? 'rosé' : col === 'white' ? 'white' : 'red';
}
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();

const items = rows.map((x) => {
  const v = x.vintage_details || {}, p = x.product_details || {}, e = enrich[x.cspc], type = typeOf(x, e), spirit = type === 'spirit';
  const g = grapesOf(v.varietal_en), fromSheet = g.grapes.length > 0;
  const region = REGIONS[p.region_en] || p.region_en || (e && e.region) || '';
  const inv = x._inventory, transit = inv ? (inv.listing_inventories || []).filter((i) => /transit/i.test(i.po_status || '') && i.stock_available > 0).map((i) => ({ qty: i.stock_available, eta: String(i.expected_date || '').replace(/^ETA:\s*/, '') })) : null;
  return {
    id: 'a-' + x.cspc, cspc: x.cspc, producer: clean(x.brand_name), name: clean(x.product_name), supplier: clean(v.supplier_name || ''),
    vintage: x.vintage_year || null, kind: spirit ? 'spirit' : 'wine', type, family: spirit ? clean(p.product_type_en || p.product_family_en) : clean(p.product_family_en),
    country: clean(p.country_en), region, sub: clean(p.sub_region_en || ''), appellation: clean(p.appellation_en || ''), designation: clean(p.designation_en || ''),
    grapes: spirit ? [] : fromSheet ? g.grapes : (e && e.grapes) || [], shares: fromSheet ? g.shares : null,
    basis: { grapes: spirit ? null : fromSheet ? 'sheet' : e && e.grapes ? 'estimate' : null, region: p.region_en ? 'sheet' : e && e.region ? 'estimate' : null, style: spirit ? null : 'estimate', flavours: flavours[x.cspc] ? (clean(v.tasting_notes_en || v.tasting_notes_short_en) ? 'sheet' : 'estimate') : null },
    flavours: flavours[x.cspc] || [],
    style: spirit ? null : e ? e.style : null,
    price: x.price, net: x.price_net_tax, reduced: x.is_price_reduced ? x.price_regular : null, ucs: x.ucs, ml: x.mlu,
    listing: x.listing_type_abbr_en, listingLabel: LISTING[x.listing_type_abbr_en] || clean(x.listing_type_en), status: x.listing_status,
    stock: { warehouse: x._list.inventory_warehouse || 0, store: x._list.inventory_store || 0, ...(transit && transit.length ? { transit } : {}) },
    upc: x.upc || null, abv: v.volume || null, sugar: v.sugar ?? null, acidity: v.acidity ?? null, ph: v.ph ?? null, temp: v.temperature ?? null, ageing: clean(v.aging_potential_en || ''), certs: Object.values(x.certification_slugs || {}),
    notes: { taste: clean(v.tasting_notes_en || v.tasting_notes_short_en), food: clean(v.food_notes_en || v.food_notes_short_en), made: clean(v.winemaking_notes_en || v.winemaking_notes_short_en), vines: clean(v.viticultural_notes_en || v.viticultural_notes_short_en) },
    house: clean((x.brand_details || {}).web_text_short_en || '').slice(0, 700), img: pic(x.image_bottle_path), houseLogo: pic((x.brand_details || {}).image),
    // The agency's own links use lcbo.com's old '#q=' form, which now opens an empty search. The product number in '?q=' finds the bottle.
    lcbo: x.store_link ? `https://www.lcbo.com/en/catalogsearch/result/?q=${encodeURIComponent(String(x.cspc || '').trim())}` : null,
  };
});
const missing = items.filter((i) => i.kind === 'wine' && (!i.style || !i.flavours.length)).map((i) => i.cspc);
if (missing.length) throw new Error('intake/awsm/enrich.txt or flavours.txt has nothing for: ' + missing.join(', '));
const out = { agency: { name: 'Authentic Wines & Spirits', short: 'AWSM', market: 'Ontario', currency: { sym: '$', code: 'CAD' }, source: 'awsm.ca Ontario catalogue, public site', fetched: '2026-11-27' }, items };
fs.writeFileSync(path.join(ROOT, 'data/seller-awsm.json'), JSON.stringify(out));
const n = (f) => items.filter(f).length;
console.log(`data/seller-awsm.json: ${items.length} listings (${n((i) => i.kind === 'wine')} wines, ${n((i) => i.kind === 'spirit')} spirits), grapes from the sheet ${n((i) => i.basis.grapes === 'sheet')}, estimated ${n((i) => i.basis.grapes === 'estimate')}, none ${n((i) => i.kind === 'wine' && !i.basis.grapes)}`);
