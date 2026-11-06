// One-off: rewrite every table question in the team restaurants' written training (data/team-*.json) as a real
// choice, the shape the card prompts now ask for: a guest at a dish the wine is a pick for, a request (a style,
// a price, by the glass) that rules out other wines of the same kind on the list, the wine never named, the
// card writer's three wrong wines (`decoys`) and three wrong reasons (`wrong`). Question ids and kinds never
// change, so nobody's progress moves; the drill still checks every decoy and reason (TeamLearn.tableWrong,
// _applyChoices) and leaves out any that fail. Calls the live Worker's /claude.
// Usage: node scripts/team-tables.mjs data/team-demo.json [more files…]
import fs from 'node:fs';
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
const BATCH = 5;
const kindOf = (w) => w.type === 'cocktail' ? 'cocktail' : /sweet|dessert|pudding/i.test(w.section || '') ? 'sweet' : /fortified|port|sherry|madeira/i.test(w.section || '') ? 'fortified' : /sparkling|fizz|champagne/i.test(w.section || '') ? 'sparkling' : (w.type || 'red');
const short = (w) => [w.producer, w.name].filter(Boolean).join(' ');
async function call(prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${API}/claude`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: API }, body: JSON.stringify({ purpose: 'team_fix', max_tokens: 6000, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(), t = (j.content || []).map((c) => c.text || '').join('') || j.text || '';
      const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON');
      return JSON.parse(m[0]).items || [];
    } catch (e) { console.error('  retry:', e.message); await new Promise((res) => setTimeout(res, 3000 * (attempt + 1))); }
  }
  return [];
}
for (const f of process.argv.slice(2)) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const wines = Array.isArray(d.wines) ? d.wines : Object.values(d.wines || {}), dishes = Array.isArray(d.dishes) ? d.dishes : Object.values(d.dishes || {});
  const about = (d.venue && (d.venue.about || d.venue.name)) || 'a restaurant';
  const st = (id) => ((d.cards || {})[id] || {}).style || {};
  const list = wines.map((w) => `${w.id} | ${short(w)} | ${kindOf(w)} | ${w.glass ? 'glass ' + w.glass : 'not by the glass'} | ${w.bottle ? 'bottle ' + w.bottle : ''} | style ${JSON.stringify(st(w.id))}`).join('\n');
  const picksFor = (id) => dishes.filter((x) => { const p = (d.pairings || {})[x.id] || {}; return [...(p.best || []), p.glass, p.cocktail].filter(Boolean).some((b) => b.id === id); }).map((x) => x.name);
  const todo = [];
  for (const [id, c] of Object.entries(d.cards || {})) {
    const w = wines.find((x) => x.id === id); if (!w) continue;
    (c.qs || []).forEach((q, i) => { if (q.k === 'apply' && !q.decoys) todo.push({ qid: `${id}#${i}`, w, c, q }); });
  }
  console.log(`${f}: ${todo.length} table questions`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const items = batch.map((t) => `QUESTION ${t.qid}
  wine: ${t.w.id} | ${short(t.w)} | ${kindOf(t.w)} | ${t.w.glass ? 'glass ' + t.w.glass : 'not by the glass'} | ${t.w.bottle ? 'bottle ' + t.w.bottle : ''} | style ${JSON.stringify(t.c.style || {})} | tastes: ${t.c.taste || ''}
  the dishes it is a sommelier's pick for: ${picksFor(t.w.id).join('; ') || '(see its card) ' + (t.c.dishes || []).map((x) => x.dish).join('; ')}
  the question now: ${t.q.q}
  its points now: ${(t.q.key || []).join(' / ')}`).join('\n\n');
    const prompt = `You write training questions for the staff of a restaurant. About it: ${about}
Use the words restaurant staff use ("the floor", never "the room"), in the restaurant's own English, with its prices exactly as the list prints them.

Rewrite each table question below so it tests whether a server can CHOOSE the right wine, not just say why. For each:
- Set it at one of the dishes this wine is a sommelier's pick for, using the dish's name as the menu has it.
- The guest asks for something this wine is the answer to, in words a guest would use, with a request that rules out other wines of the SAME kind on the list: a style ("a red that isn't too heavy", "something crisp", "soft, not too tannic"), a price ("under $60 a bottle"), or by the glass. Check the request against the list's style figures (body, acid, tannin, sweet, 1 to 5) and prices: this wine must meet it.
- Never name this wine, its producer or its grape in the question. End with "What would you suggest, and why?"
- "key": this wine's name first, then two short points a good answer contains (why it suits the dish and the request), said the way a server would say them to a guest: in words, never the style figures or numbers in brackets, and never claiming it's the most or least of anything on the list.
- "decoys": exactly three other wines from the list, of the same kind the guest asked for (a sparkling for a sparkling, a white for a white), that a new server might reach for but that fail the request or don't suit the dish, each with why. Never a wine that would also be a good answer. Use their ids.
- "wrong": three reasons a new server might believe for recommending this wine here, each false for it and each a different mistake (body, tannin or acidity, flavour), about as long and in the same tone as the key's points.
- "why": one sentence on why this wine is the answer.

THE LIST (id | wine | kind | glass | bottle | style):
${list}

${items}

Return ONLY JSON: {"items":[{"id":"the QUESTION id","q":"…","key":["…","…","…"],"decoys":[{"id":"…","why":"…"}],"wrong":["…","…","…"],"why":"…"}]}`;
    const got = await call(prompt);
    for (const g of got) {
      const t = batch.find((x) => x.qid === g.id); if (!t || !g.q || !Array.isArray(g.key) || !Array.isArray(g.decoys)) continue;
      const names = [short(t.w), t.w.name].filter(Boolean).map((n) => n.toLowerCase());
      if (names.some((n) => n.length > 3 && g.q.toLowerCase().includes(n))) { console.log('  names its wine, kept the old one:', t.qid); continue; }
      const decoys = g.decoys.filter((x) => x && x.id !== t.w.id && wines.some((w) => w.id === x.id)).slice(0, 3);
      if (decoys.length < 2) { console.log('  too few decoys, kept the old one:', t.qid); continue; }
      const clean = (x) => String(x).replace(/\s*\((?:[a-z]+ )?\d(?:\.\d)?\)/gi, '').replace(/\s{2,}/g, ' ').trim();
      Object.assign(t.q, { q: g.q, key: g.key.slice(0, 3).map(clean), decoys, wrong: (g.wrong || t.q.wrong || []).slice(0, 3).map(clean), why: g.why || t.q.why });
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
  }
  console.log(`  done: ${todo.filter((t) => t.q.decoys).length} rewritten`);
}
