// Drafts a prospect's private page on the Teams website (site/teams/for/<slug>.html, served at /for/<slug>) from the two
// files its demo is made of: data/team-<seed>-list.json (the list, menu, venue) and data/team-<seed>.json (cards and
// pairings, written by `npm run team:write -- <seed> --pitch` or a full install). Everything on the page is worked out
// here, with no call: the headline, the facts, the calculator's moves at the restaurant's own prices, four dishes with
// the wine and the line from its card, and what the demo holds. It is a draft to read and edit by hand before anyone
// sees it; the bottles and their cards are filled in by the site build (scripts/site-teams.mjs) from the same seed.
//
// Usage: npm run site:teams:for -- <seed> [--slug name] [--demo url] [--source "as published on example.com"]
//          [--owner "the group it belongs to"] [--force] [--json]
//   --json prints the analysis and writes nothing. Without --force an existing page is left alone.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const num = (s) => { const m = /[£$€]\s?([\d,.]+)/.exec(String(s || '')); return m ? +m[1].replace(/,/g, '') : 0; };
const median = (a) => { const s = a.filter((x) => x > 0).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const say = (n, cap) => { const w = n >= 0 && n <= 12 ? words[n] : String(n); return cap ? w[0].toUpperCase() + w.slice(1) : w; };

/* What a list, menu and training say about a restaurant, for its page: figures, the facts worth a tile, the calculator's
   moves and the dishes to show. Pure, so the tests can hold it to the files. */
export function analyse(list, train) {
  const v = list.venue || {}, sym = (v.currency && v.currency.sym) || '£';
  const money = (n) => sym + (Math.round(n * 100) % 100 ? n.toFixed(2) : Math.round(n).toLocaleString('en-GB'));
  // Non-alcoholic bottles are on the list but not part of the argument, so they're left out of every figure.
  const wines = (list.wines || []).filter((w) => !/non-?\s?alc/i.test(`${w.section} ${w.name} ${w.type}`)), dishes = list.dishes || [], cocktails = list.cocktails || [];
  const magnum = (w) => /magnum/i.test(w.other || '') && !w.bottle;
  const bottleOf = (w) => num(w.bottle) || (magnum(w) ? num(w.other) : 0), glassOf = (w) => num(w.glass);
  const byGlass = wines.filter((w) => glassOf(w)), bottleOnly = wines.filter((w) => !glassOf(w));
  // Medians are of standard bottles: a magnum or a half bottle would skew them.
  const std = (w) => !magnum(w) && !/37\.5|50\s?cl|half/i.test(w.bottle || '') ? bottleOf(w) : 0;
  const medGlassList = median(byGlass.map(std)), medBottleOnly = median(bottleOnly.map(std)), medAll = median(wines.map(std));
  const top = wines.filter((w) => !magnum(w)).sort((a, b) => bottleOf(b) - bottleOf(a))[0];
  // The round figure a "dearest" filter uses: 100 unless fewer than a tenth of the list reaches it, then 80, then 60.
  const over = (n) => wines.filter((w) => !magnum(w) && bottleOf(w) >= n).length;
  const topAt = [100, 80, 60].find((n) => over(n) >= Math.max(3, wines.length / 10)) || 100;
  const label = (w) => (w.name.includes(w.producer) ? w.name : `${w.producer} ${w.name}`) + (w.vintage ? ` ${w.vintage}` : '');
  const byId = Object.fromEntries(wines.map((w) => [w.id, w])), cards = train.cards || {}, pairings = train.pairings || {};
  const paired = dishes.filter((d) => pairings[d.id] && (pairings[d.id].best || []).length && byId[pairings[d.id].best[0].id]);
  const firstBottleOnly = paired.filter((d) => !glassOf(byId[pairings[d.id].best[0].id]));
  let best = 0, bestBottleOnly = 0; paired.forEach((d) => pairings[d.id].best.forEach((b) => { if (!byId[b.id]) return; best++; if (!glassOf(byId[b.id])) bestBottleOnly++; }));
  const sweet = byGlass.filter((w) => /dessert|fortified|sweet/i.test(w.type || '')), fizz = byGlass.filter((w) => /sparkling/i.test(w.type || '')).sort((a, b) => glassOf(a) - glassOf(b));
  // A second, larger pour printed beside the glass ("8oz $23", "250ml £14"): the step up from the glass price.
  const larger = byGlass.map((w) => ({ w, step: num(/(\d+\s?(oz|ml))\s*[£$€]/i.test(w.other || '') ? w.other : '') - glassOf(w), size: (/(\d+\s?(?:oz|ml))/i.exec(w.other || '') || [])[1] })).filter((x) => x.step > 0 && !/glass$/i.test(x.w.other || ''));
  const uniq = (xs) => new Set(xs.filter(Boolean)).size;
  const figures = { wines: wines.length, byGlass: byGlass.length, bottleOnly: bottleOnly.length, dishes: dishes.length, cocktails: cocktails.length,
    producers: uniq(wines.map((w) => w.producer)), grapes: uniq(wines.flatMap((w) => w.grapes || [])), countries: uniq(wines.map((w) => w.country)),
    medAll, medGlassList, medBottleOnly, topAt, overTop: over(topAt), paired: paired.length, firstBottleOnly: firstBottleOnly.length, best, bestBottleOnly,
    cards: Object.keys(cards).filter((id) => byId[id]).length, full: Object.keys(cards).filter((id) => byId[id] && (cards[id].qs || []).length).length,
    questions: Object.values(cards).reduce((n, c) => n + (c.qs || []).length, 0), cocktailCards: Object.keys(train.cocktailCards || {}).length, dishNotes: Object.keys(train.dishCards || {}).length };

  // The calculator's moves, each only where the list has it.
  const moves = [];
  if (medBottleOnly > medGlassList && medGlassList) moves.push({ k: 'up', price: Math.round(medBottleOnly - medGlassList), n: 3, max: 15, title: 'A table trades up to a bottle-only wine', label: 'Tables trading up to a bottle-only wine', short: 'Trading up',
    why: `Your by-the-glass wines have a median bottle of ${money(medGlassList)}; your bottle-only wines, ${money(medBottleOnly)}.`, each: `+${money(medBottleOnly - medGlassList)}` });
  if (larger.length >= 4) { const step = median(larger.map((x) => x.step)), size = larger[0].size.replace(/\s/g, '');
    moves.push({ k: 'pour', price: Math.round(step), n: 10, max: 50, title: `A glass becomes the ${size} pour`, label: `${size} pours in place of the smaller glass`, short: `${size} pours`, why: `The median step up across the ${say(larger.length)} wines you pour both ways.`, each: `+${money(step)}` }); }
  if (fizz.length) moves.push({ k: 'fizz', price: glassOf(fizz[0]), n: 5, max: 30, title: 'A glass of sparkling to start', label: 'Glasses of sparkling to start', short: 'Sparkling',
    why: `${label(fizz[0])}, your least expensive sparkling glass.`, each: `+${money(glassOf(fizz[0]))}` });
  if (sweet.length) { const m = median(sweet.map(glassOf)); moves.push({ k: 'sweet', price: Math.round(m), n: 4, max: 30, title: 'A sweet or fortified glass with dessert', label: 'Glasses with dessert', short: 'With dessert',
    why: sweet.length > 1 ? `The median of your ${say(sweet.length)} sweet and fortified wines by the glass.` : `${label(sweet[0])}, your dessert wine by the glass.`, each: `+${money(m)}` }); }
  if (moves.length < 2 && medAll) moves.push({ k: 'bottle', price: Math.round(medAll), n: 2, max: 15, title: 'A table that would have skipped wine takes a bottle', label: 'Extra bottles sold', short: 'Extra bottles', why: `Your median bottle is ${money(medAll)}.`, each: `+${money(medAll)}` });

  // The facts, the most telling first; the page shows six (or three when the list gives fewer).
  const pct = (a, b) => Math.round(a / b * 100), named = (ws) => [...new Set(ws.map((w) => w.producer))].slice(0, 2).join(' and ');
  const plain = (w) => (w.name.includes(w.producer) ? w.name : `${w.producer} ${w.name}`);
  const facts = [];
  if (figures.bottleOnly) facts.push({ big: figures.bottleOnly > figures.wines / 2 ? `${pct(figures.bottleOnly, figures.wines)}%` : String(figures.bottleOnly), title: 'Bottle only',
    text: `${figures.bottleOnly} of your ${figures.wines} wines aren't poured by the glass. Nobody tastes their way into them; they sell when someone on the floor can say why.` });
  if (medBottleOnly > medGlassList && medGlassList) facts.push({ big: money(medBottleOnly), title: 'Your median bottle-only wine', text: `The wines you pour by the glass have a median bottle of ${money(medGlassList)}. A table that moves from one list to the other is worth about ${money(medBottleOnly - medGlassList)} more.` });
  if (figures.firstBottleOnly >= 3) { const seen = new Set(), egs = firstBottleOnly.slice().sort((a, b) => num(b.price) - num(a.price)).filter((d) => { const id = pairings[d.id].best[0].id; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 2);
    const eg = egs.map((d) => `the ${d.name.split(',')[0].replace(/^the\s+/i, '')} with the ${plain(byId[pairings[d.id].best[0].id])}`).join(', ');
    facts.push({ big: `${figures.firstBottleOnly}`, title: 'Dishes best with a bottle-only wine', text: `For ${figures.firstBottleOnly} of your ${figures.paired} dishes, the best match on your list isn't sold by the glass: ${eg}.` }); }
  facts.push({ big: String(figures.grapes), title: 'Grape varieties', text: `From ${figures.producers} producers in ${figures.countries} countries. A lot for a new starter to hold.` });
  if (top && figures.overTop >= 3) facts.push({ big: String(figures.overTop), title: `Bottles at ${money(topAt)} or more`, text: `Up to the ${label(top)} at ${money(bottleOf(top))}. The bottles a confident recommendation sells.` });
  if (larger.length >= 4) facts.push({ big: String(larger.length), title: 'Wines in two pours', text: `${say(larger.length, true)} wines come in a smaller and a larger glass. The larger pour is ${money(median(larger.map((x) => x.step)))} more at the median, and it's one question at the table.` });
  if (sweet.length >= 2) { const ps = sweet.map(glassOf).sort((a, b) => a - b); facts.push({ big: String(sweet.length), title: 'Sweet and fortified by the glass', text: `From ${money(ps[0])} to ${money(ps[ps.length - 1])} a glass. They're rarely ordered unless someone offers.` }); }
  if (figures.cocktails) facts.push({ big: String(figures.cocktails), title: 'Cocktails', text: `The floor needs to know what's in each one and what it suits. Vinterest Teams trains on cocktails as it does on wine, with a higher minimum for whoever is behind the bar.` });
  if (fizz.length >= 2) facts.push({ big: String(fizz.length), title: 'Sparkling wines by the glass', text: `From ${named(fizz)}, starting at ${money(glassOf(fizz[0]))}. The easiest glass to offer before the menus are open.` });

  // Four dishes: two whose best wine is bottle only (the dearest dishes first), one poured by the glass, one dessert.
  const row = (d) => { const p = pairings[d.id], w = byId[p.best[0].id], c = cards[w.id] || {}; return { dish: d.name, section: d.section, price: d.price, wine: label(w), where: [w.region].filter(Boolean).join(''), glass: w.glass || '', bottle: w.bottle || '', bottleOnly: !glassOf(w), line: c.pitch || p.best[0].why, id: w.id }; };
  const dear = (a, b) => num(b.price) - num(a.price), dessert = (d) => /dessert|pudding|sweet|dolci/i.test(d.section || '');
  const picks = [], used = new Set(), take = (xs, n) => { for (const d of xs) { if (n <= 0) break; const r = row(d); if (used.has(r.id) || picks.some((x) => x.dish === r.dish)) continue; used.add(r.id); picks.push(r); n--; } };
  take(firstBottleOnly.filter((d) => !dessert(d)).sort(dear), 2);
  take(paired.filter((d) => !dessert(d) && glassOf(byId[pairings[d.id].best[0].id])).sort(dear), 3 - picks.length);
  take(paired.filter(dessert).sort(dear), 1);
  take(paired.slice().sort(dear), 4 - picks.length);
  return { name: v.name || train.venue.name, city: v.city || '', sym, figures, facts, moves, picks, pitch: train.pitch || null, source: (v.brand && v.brand.source) || '' };
}

// An image's width over its height, to size a logo: PNG from its header, SVG from its viewBox.
function aspect(file) {
  try { const b = fs.readFileSync(file);
    if (/\.png$/i.test(file)) return b.readUInt32BE(16) / b.readUInt32BE(20);
    const m = /viewBox="[\d.\-]+[ ,]+[\d.\-]+[ ,]+([\d.]+)[ ,]+([\d.]+)"/.exec(b.toString('utf8')); return m ? +m[1] / +m[2] : 0;
  } catch (e) { return 0; }
}

export function render(a, o) {
  const { figures: f, sym } = a, facts = a.facts.slice(0, a.facts.length >= 6 ? 6 : 3), cols = [['--cr'], ['--gold'], ['--sky'], ['--plum'], ['--green'], ['--rose']];
  const barCol = { up: '--cr', pour: '--sky', fizz: '--gold', sweet: '--green', bottle: '--plum' };
  const day = a.moves.reduce((n, m) => n + m.n * m.price, 0);
  const logoH = o.aspect ? Math.max(8, Math.min(24, Math.round(170 / o.aspect))) : 0, heroH = o.aspect ? Math.max(9, Math.min(40, Math.round(280 / o.aspect))) : 0;
  const them = o.logo ? `<img class="them" src="/img/for/${o.logo}?v=%%IMG_V%%" alt="${esc(a.name)}">` : `<b class="them-name">${esc(a.name)}</b>`;
  const priceOf = (p) => [p.glass && `${p.glass} a glass`, p.bottle && `${p.bottle} a bottle`, p.bottleOnly && 'bottle only'].filter(Boolean).join(' · ');
  const cols14 = f.wines <= 48 ? Math.ceil(f.wines / 3) : 22, colsM = f.wines <= 48 ? Math.ceil(f.wines / 4) : 16;
  const preview = a.pitch ? ` It's a preview: every wine has its card, and ${say(f.full)} of them carry the full training with questions.` : '';
  const stats = [[f.cards, 'wine cards, each with what to say to a guest'], [f.paired, 'dishes paired from your own list'],
    a.pitch ? [f.full, 'wines with the full training, questions and all, to try'] : [f.questions, 'questions on your wines'],
    f.cocktailCards ? [f.cocktailCards, 'cocktail cards, with what\'s in each and what it suits'] : [f.wines, 'wines on the list your managers see in the console']];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="seed" content="${o.seed}">
<title>For ${esc(a.name)} | Vinterest Teams</title>
<meta name="description" content="What ${esc(a.name)}'s own wine list says, and what a team that knows it could be worth.">
<link rel="stylesheet" href="/fonts/fonts.css?v=%%FONTS_V%%">
<link rel="stylesheet" href="/site.css?v=%%CSS_V%%">
<style>
${o.logo ? `.pr-pair .them { height: ${logoH}px; } .pr-for img { height: ${heroH}px; }
@media (max-width: 760px) { .pr-pair .them { height: auto; max-width: ${Math.min(190, Math.round(logoH * o.aspect))}px; flex-basis: ${Math.min(190, Math.round(logoH * o.aspect))}px; } }` : `.pr-pair .them-name { color: #fff; font-size: 15px; font-weight: 700; letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .pr-for b { color: #fff; font-size: 20px; letter-spacing: .04em; }`}
</style>
</head>
<body>

<header class="pr-top">
  <div class="wrap">
    <div class="pr-pair"><a class="tlogo" href="https://vinterest.team" aria-label="Vinterest Teams"><div class="mark"><img src="/logo.png" alt=""></div><div class="word"><span>T</span><span>E</span><span>A</span><span>M</span><span>S</span></div></a><span class="x" aria-hidden="true">×</span>${them}</div>
    <div class="acts"><a class="btn ghost small" href="#worth">What it's worth</a><a class="btn primary small" href="${esc(o.demo)}" target="_blank" rel="noopener">Open your demo</a></div>
  </div>
</header>

<section class="pr-hero">
  <div class="wrap">
    <div>
    <div class="pr-for"><span>Prepared for</span>${o.logo ? `<img src="/img/for/${o.logo}?v=%%IMG_V%%" alt="${esc(a.name)}${a.city ? ', ' + esc(a.city) : ''}">` : `<b>${esc(a.name)}</b>`}</div>
    <h1>${f.wines} wines. <em>${f.bottleOnly} need a recommendation.</em></h1>
    <p class="lead">${f.bottleOnly > f.wines / 2 ? `${say(Math.round(f.bottleOnly / f.wines * 10), true)} in ten of your wines are bottle only, so they sell` : 'Your bottle-only wines carry the bigger spend, and they sell'} when someone on the floor can say why. Here's what your list says, what knowing it could be worth, and a working demo built from it.</p>
    <div class="cta"><a class="btn primary" href="${esc(o.demo)}" target="_blank" rel="noopener">Open your demo</a><a class="btn ghost" href="#worth">See what it's worth</a></div>
    </div>
    <div class="cellar" style="--cols: ${cols14}; --cols-m: ${colsM}" data-cellar="forList" data-sym="${sym}" data-top="${f.topAt}" data-cards="/for/${o.slug}.cards.json?v=%%CARDS_V%%" data-cards-demo="${esc(o.demo)}"></div>
  </div>
</section>
<script type="application/json" id="forList">%%LIST%%</script>

<section class="band">
  <div class="wrap">
    <div class="head">
      <div class="eyebrow" style="--c:var(--plum)">Your list, in numbers</div>
      <h2>A serious list asks a lot of the people selling it.</h2>
      <p class="lead">From your wine list and menu${o.source ? ' ' + esc(o.source) : ''}.</p>
    </div>
    <div class="pr-facts">
${facts.map((x, i) => `      <div class="pr-fact" style="--c:var(${cols[i % 6][0]})"><b>${esc(x.big)}</b><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('\n')}
    </div>
  </div>
</section>

<section class="calc pr-calc" id="worth" style="--c:var(--cr)">
  <div class="wrap">
    <div>
      <div class="eyebrow">What it's worth</div>
      <h2>${say(a.moves.length, true)} small moves, at <em style="font-style:normal;color:var(--cr)">your prices.</em></h2>
      <p class="lead">Turning glasses into the same bottle earns little: a bottle costs about what its glasses do. The money is in ${say(a.moves.length)} moves that only happen when the team knows the list.</p>
      <div class="pr-moves">
${a.moves.map((m) => `        <div class="pr-move"><b>${esc(m.title)}</b><i>${esc(m.each)}</i><span>${esc(m.why)}</span></div>`).join('\n')}
      </div>
    </div>
    <div class="card" id="forCalc" data-moves data-sym="${sym}">
${a.moves.map((m) => `      <div class="fld"><label>${esc(m.label)}<small>more a day, at ${esc(m.each)} each</small></label><div class="v" data-out="${m.k}">${m.n}</div><input type="range" min="0" max="${m.max}" step="1" value="${m.n}" data-in="${m.k}" data-price="${m.price}" aria-label="${esc(m.label)} a day"></div>`).join('\n')}
      <div class="fld"><label>Days open a week</label><div class="v" data-out="days">7</div><input type="range" min="1" max="7" step="1" value="7" data-in="days" aria-label="Days open a week"></div>
      <div class="pr-out">
        <div><small>A day</small><b data-t="day">${sym}${day}</b></div>
        <div><small>A week</small><b data-t="week">${sym}0</b></div>
        <div><small>A month</small><b data-t="month">${sym}0</b></div>
        <div class="pick"><small>A year</small><b data-t="year">${sym}0</b></div>
      </div>
      <div class="pr-bar" aria-hidden="true">${a.moves.map((m) => `<i data-b="${m.k}" style="--k:var(${barCol[m.k]})"></i>`).join('')}</div>
      <p class="pr-sum">${a.moves.map((m) => `<span style="--k:var(${barCol[m.k]})">${esc(m.short)} <b data-p="${m.k}"></b></span>`).join('')}</p>
      <p class="assume">Illustrative: extra wine revenue from the counts you set, at the prices on your list. We don't know your covers, so nothing here is a forecast. Once your sales data is in, the console measures the real change.</p>
    </div>
  </div>
</section>

<section class="band dark">
  <div class="wrap">
    <div class="head">
      <div class="eyebrow">Already written for your team</div>
      <h2>Your dishes, the wine, and the line to say.</h2>
      <p class="lead">Every wine on your list has a card, and every dish has its wines. These are ${say(a.picks.length)} of them, as your team would learn them. The pairings are ours, written from your list and menu; you can change any of them before anyone sees them.</p>
    </div>
    <div class="pr-say">
${a.picks.map((p) => `      <div class="pr-dish"><div class="d">${esc([p.section, p.price].filter(Boolean).join(' · '))}</div><h3>${esc(p.dish)}</h3><div class="w">${esc([p.wine + (p.where ? ', ' + p.where : ''), priceOf(p)].join(' · '))}</div><blockquote>"${esc(p.line)}"</blockquote></div>`).join('\n')}
    </div>
  </div>
</section>

<section class="band alt">
  <div class="wrap">
    <div class="head">
      <div class="eyebrow" style="--c:var(--green)">Your demo</div>
      <h2>${esc(a.name)}, ready to try.</h2>
      <p class="lead">Your list and menu are loaded into a working demo: the console your managers would run it from, and the app your team would train on.${preview} The team and the sales figures in it are invented, and labelled as demo data.</p>
    </div>
    <div class="pr-in">
${stats.map((s) => `      <div><b>${s[0]}</b><span>${esc(s[1])}</span></div>`).join('\n')}
    </div>
    <div class="cta" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:28px"><a class="btn primary" href="${esc(o.demo)}" target="_blank" rel="noopener">Open your demo</a><a class="btn ghost" href="mailto:hello@vinterest.app?subject=${encodeURIComponent(a.name + ' and Vinterest Teams')}">Book a 20-minute walkthrough</a><a class="btn ghost" href="https://vinterest.team/mise-en-place">How we'd launch with you</a></div>
  </div>
</section>

<footer class="pr-foot">
  <div class="wrap">
    <p>Prepared by Vinterest Teams for ${esc(a.name)}${a.city ? ', ' + esc(a.city) : ''}. This page is private: it isn't linked from our site or listed in search.</p>
    <p>Wines, dishes and prices are from your lists${o.source ? ' ' + esc(o.source) : ''}; if anything has changed since, the demo updates from a new copy. Pairings and staff lines are Vinterest's own, written from those lists. Vinterest is independent of ${esc(o.owner || a.name)}. <a href="https://vinterest.team/privacy">Privacy</a> · <a href="mailto:hello@vinterest.app">hello@vinterest.app</a></p>
  </div>
</footer>

<script src="/site.js?v=%%JS_V%%" defer></script>
%%ANALYTICS%%
</body>
</html>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), val = (k) => (args.includes('--' + k) ? args[args.indexOf('--' + k) + 1] : null);
  const takes = ['--slug', '--demo', '--source', '--owner'], seed = args.find((x, i) => !x.startsWith('--') && !takes.includes(args[i - 1]));
  if (!seed) { console.error('Name a seed: npm run site:teams:for -- <seed>'); process.exit(2); }
  const read = (f) => { const p = path.join(ROOT, f); if (!fs.existsSync(p)) { console.error(`Missing ${f}. The page is drafted from a seed's list and training files.`); process.exit(2); } return JSON.parse(fs.readFileSync(p, 'utf8')); };
  const list = read(`data/team-${seed}-list.json`), train = read(`data/team-${seed}.json`), a = analyse(list, train);
  if (args.includes('--json')) { console.log(JSON.stringify(a, null, 1)); process.exit(0); }
  const slug = val('slug') || a.name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const out = path.join(ROOT, 'site/teams/for', `${slug}.html`);
  if (fs.existsSync(out) && !args.includes('--force')) { console.error(`site/teams/for/${slug}.html is already there (it may have been edited by hand). --force writes over it.`); process.exit(2); }
  // The restaurant's own wordmark, if its install has one (team/<brand.logo>), copied beside the site's other images.
  let logo = '', asp = 0; const brand = (list.venue || {}).brand || {};
  if (brand.logo && fs.existsSync(path.join(ROOT, 'team', brand.logo))) { logo = slug + path.extname(brand.logo); fs.mkdirSync(path.join(ROOT, 'site/teams/img/for'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'team', brand.logo), path.join(ROOT, 'site/teams/img/for', logo)); asp = aspect(path.join(ROOT, 'team', brand.logo)); }
  const demo = val('demo') || `https://vinterest.pages.dev/team/?seed=${seed}&view=console`;
  const source = val('source') || (a.source ? `as published on ${a.source.replace(/\s*\(.*$/, '')}` : '');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, render(a, { seed, slug, demo, source, owner: val('owner'), logo, aspect: asp }));
  console.log(`Drafted site/teams/for/${slug}.html (/for/${slug}) for ${a.name}: ${a.figures.wines} wines, ${a.figures.bottleOnly} bottle only, ${a.facts.length} facts found, ${a.moves.length} moves worth ${a.sym}${a.moves.reduce((n, m) => n + m.n * m.price, 0)} a day at the defaults, ${a.picks.length} dishes.`);
  console.log(`Read it and edit by hand before anyone sees it, then: npm run site:teams:build`);
}
