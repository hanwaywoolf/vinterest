#!/usr/bin/env node
/* Writes a venue's dish notes (prompts/team-dish-cards.txt, purpose team_dishes) through the deployed Worker and
   saves them into its training file as `dishCards`, so the seed opens with them and no phone has to write them:

     npm run team:dishes -- [--base https://claude-perse-intake.vinterest.pages.dev] [--venue social] [--only d-fresh-oysters,…] [--force]

   Every call is a real, billed Claude call on the Worker's TEAM_MODEL. Allergens come back as a draft for the
   kitchen to confirm on the console; nothing here marks one confirmed. Runs with curl, since Node's fetch doesn't
   go through a proxy. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const base = arg('base', 'https://claude-perse-intake.vinterest.pages.dev').replace(/\/$/, ''), venue = arg('venue', 'social'), only = (arg('only', '') || '').split(',').filter(Boolean);
const listFile = `data/team-${venue}-list.json`, trainFile = `data/team-${venue}.json`;
const list = JSON.parse(readFileSync(listFile, 'utf8')), train = JSON.parse(readFileSync(trainFile, 'utf8'));
const ALLERGENS = { CA: [['milk','Milk'],['egg','Egg'],['fish','Fish'],['shellfish','Crustaceans and molluscs'],['peanut','Peanuts'],['treenut','Tree nuts'],['wheat','Wheat and gluten'],['soy','Soy'],['sesame','Sesame'],['mustard','Mustard'],['sulphite','Sulphites']],
  GB: [['gluten','Cereals containing gluten'],['crustacean','Crustaceans'],['mollusc','Molluscs'],['egg','Egg'],['fish','Fish'],['peanut','Peanuts'],['treenut','Tree nuts'],['soy','Soya'],['milk','Milk'],['celery','Celery'],['mustard','Mustard'],['sesame','Sesame'],['sulphite','Sulphites'],['lupin','Lupin']],
  US: [['milk','Milk'],['egg','Egg'],['fish','Fish'],['shellfish','Crustacean shellfish'],['treenut','Tree nuts'],['peanut','Peanuts'],['wheat','Wheat'],['soy','Soybeans'],['sesame','Sesame']] };
const code = ((list.venue || {}).currency || {}).code || '', country = (list.venue || {}).country || (code === 'CAD' ? 'CA' : code === 'USD' ? 'US' : 'GB'), allergens = ALLERGENS[country];
const codes = new Set(allergens.map(([c]) => c));
const slug = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dishes = list.dishes.map((x) => ({ ...x, id: x.id || 'd-' + slug(x.name).slice(0, 60) }));
const force = process.argv.includes('--force'); // rewrite every dish's notes (a prompt change)
const todo = dishes.filter((x) => !only.length || only.includes(x.id)).filter((x) => force || only.length || !(train.dishCards || {})[x.id]);
const tpl = readFileSync('prompts/team-dish-cards.txt', 'utf8');
const line = (x) => `${x.id} | ${x.section || ''} | ${x.name} | ${x.desc || ''} | ${x.price || ''} | ${(x.diet || []).join(', ')}`;
console.log(`${todo.length} dishes to write for ${list.venue.name} (${country}: ${allergens.length} allergens) via ${base}`);
train.dishCards = train.dishCards || {};
// Four dishes a call: eight on Opus ran past the Worker's time limit (524). A failed call is tried once more.
const BATCH = Number(arg('batch', 4));
for (let i = 0; i < todo.length; i += BATCH) {
  const xs = todo.slice(i, i + BATCH);
  const prompt = tpl.replace(/\{\{venue\}\}/g, list.venue.name).replace('{{allergens}}', allergens.map(([c, n]) => `${c} (${n})`).join(', ')).replace('{{dishes}}', dishes.map(line).join('\n')).replace('{{batch}}', xs.map(line).join('\n'));
  const call = () => execFileSync('curl', ['-sS', '-X', 'POST', `${base}/claude`, '-H', 'content-type: application/json', '-H', `origin: ${base}`, '--data-binary', JSON.stringify({ purpose: 'team_dishes', messages: [{ role: 'user', content: prompt }] })], { encoding: 'utf8', maxBuffer: 1 << 24 });
  let out = call(); if (!/^\s*\{/.test(out) || /"error"/.test(out.slice(0, 200))) out = call();
  let j; try { j = JSON.parse(out); } catch (e) { throw new Error('Not JSON from /claude: ' + out.slice(0, 200)); }
  if (j.error) throw new Error(j.error);
  const text = (j.content || []).map((c) => c.text || '').join('') || j.text || '';
  const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('No JSON in the answer: ' + text.slice(0, 200));
  const parsed = JSON.parse(m[0]);
  (parsed.dishes || []).forEach((c) => { if (!c || !dishes.some((x) => x.id === c.id)) return;
    const draft = (Array.isArray(c.allergens) ? c.allergens : []).map((a) => typeof a === 'string' ? { code: a, sure: 'likely' } : a).filter((a) => a && codes.has(a.code)).map((a) => ({ code: a.code, sure: a.sure === 'printed' ? 'printed' : 'likely' }));
    train.dishCards[c.id] = { say: String(c.say || '').trim(),
      mods: (c.mods || []).filter((x) => x && x.ask && x.say).map((x) => ({ ask: String(x.ask).trim(), can: ['yes', 'no', 'ask'].includes(x.can) ? x.can : 'ask', say: String(x.say).trim() })).slice(0, 4),
      ask: (c.ask || []).filter((a) => a && a.q && a.a).map((a) => ({ q: String(a.q).trim(), a: String(a.a).trim() })).slice(0, 3),
      wrong: (Array.isArray(c.wrong) ? c.wrong : []).map((x) => String(x || '').trim()).filter((x) => x && x !== c.say).slice(0, 3),
      allergens: { ...(train.dishCards[c.id] && train.dishCards[c.id].allergens && train.dishCards[c.id].allergens.confirmed ? { confirmed: train.dishCards[c.id].allergens.confirmed, confirmedAt: train.dishCards[c.id].allergens.confirmedAt, by: train.dishCards[c.id].allergens.by } : { confirmed: null }), draft, note: String(c.note || '').trim() }, at: Date.now(), model: j.model || '' }; });
  train.exported = new Date().toISOString();
  writeFileSync(trainFile, JSON.stringify(train, null, 1) + '\n');
  console.log(`  ${Math.min(i + BATCH, todo.length)} of ${todo.length} · ${j.model || ''} · ${j.ms ? Math.round(j.ms / 1000) + 's' : ''}`);
}
console.log(`Wrote ${Object.keys(train.dishCards).length} dish notes into ${trainFile}`);
