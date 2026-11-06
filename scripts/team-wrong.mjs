// One-off backfill: authored wrong reasons ("wrong") for every table question in the team restaurants'
// written training (data/team-*.json), the same field the card prompts now ask for on every new list.
// Each answer is a mistake a new server could believe that's false for this wine at this dish; the drill
// still checks every one (TeamLearn._applyChoices) before it's shown. Question ids never change.
// Usage: node scripts/team-wrong.mjs data/team-demo.json [more files…]   (calls the live Worker's /claude)
import fs from 'node:fs';
const API = process.env.VINTEREST_API_ORIGIN || 'https://vinterest.pages.dev';
const BATCH = 8;
const files = process.argv.slice(2);
const kindOf = (w) => w.type === 'cocktail' ? 'cocktail' : /sweet|dessert|pudding/i.test(w.section || '') ? 'sweet' : /fortified|port|sherry|madeira/i.test(w.section || '') ? 'fortified' : /sparkling|fizz|champagne/i.test(w.section || '') ? 'sparkling' : (w.type || 'red');
async function ask(items, about) {
  const lines = items.map((x) => `${x.qid} | ${x.name} (${x.kind}) | style ${JSON.stringify(x.style || {})} | tastes: ${x.taste || ''}\n  question: ${x.q}\n  right answer's points: ${(x.key || []).join(' / ')}`).join('\n\n');
  const prompt = `You write training questions for restaurant staff. About the restaurant: ${about}
For each table question below, write three WRONG reasons for recommending this wine (or drink) here: things a new server might honestly believe and say, each false for THIS wine with THIS dish, each a different mistake (one about body or weight, one about tannin, acidity or sweetness, one about flavour or what it does to the food). They must sound like the right answer's points: the same plain tone, roughly the same length (6 to 16 words), starting with a capital. Never claim bubbles for a still wine or sweetness for a dry red, never name another wine, grape, dish or price, never say "not" or "doesn't" to make it wrong. Write in the same English as the restaurant (British unless About says otherwise). Use the words restaurant staff use: "the floor", never "the room".

${lines}

Return ONLY JSON: {"items":[{"id":"the question id","wrong":["…","…","…"]}]}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${API}/claude`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: API }, body: JSON.stringify({ purpose: 'team_fix', max_tokens: 4000, messages: [{ role: 'user', content: prompt }] }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); const t = (j.content || []).map((c) => c.text || '').join('') || j.text || '';
      const m = t.match(/\{[\s\S]*\}/); if (!m) throw new Error('no JSON');
      return JSON.parse(m[0]).items || [];
    } catch (e) { console.error('  retry:', e.message); await new Promise((res) => setTimeout(res, 2000 * (attempt + 1))); }
  }
  return [];
}
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const wines = Array.isArray(d.wines) ? d.wines : Object.values(d.wines || {}), about = (d.venue && (d.venue.about || d.venue.name)) || 'a restaurant';
  const todo = [];
  for (const [id, c] of Object.entries(d.cards || {})) {
    const w = wines.find((x) => x.id === id); if (!w) continue;
    (c.qs || []).forEach((q, i) => { if (q.k === 'apply' && !(q.wrong && q.wrong.length >= 3)) todo.push({ qid: `${id}#${i}`, card: c, q: q.q, key: q.key, name: [w.producer, w.name].filter(Boolean).join(' '), kind: kindOf(w), style: c.style, taste: c.taste, ref: q }); });
  }
  console.log(`${f}: ${todo.length} table questions`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH), got = await ask(batch, about);
    got.forEach((g) => { const t = batch.find((x) => x.qid === g.id); if (t && Array.isArray(g.wrong) && g.wrong.length >= 3) t.ref.wrong = g.wrong.slice(0, 3).map(String); });
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
    fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n'); // saved as it goes, so a stopped run keeps what it wrote
  }
  console.log(`  done: ${todo.filter((t) => t.ref.wrong).length} written`);
}
