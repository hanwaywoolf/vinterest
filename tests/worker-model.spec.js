// The Worker's request to Anthropic for each model (modelOptions in _worker.js): Sonnet 4.6 as it
// always was; Claude Sonnet 5.5 with thinking off, effort by purpose and refusal fallbacks; a
// refusal said in words; the price search kept on Sonnet 4.6 whatever CLAUDE_MODEL says.
const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

async function loadWorker() {
  const copy = path.join(require('node:os').tmpdir(), `worker-model-${process.pid}.mjs`);
  require('node:fs').copyFileSync(path.join(__dirname, '..', '_worker.js'), copy);
  return (await import(pathToFileURL(copy).href + `?t=${Date.now()}`)).default;
}

async function run(env, bodies, reply) {
  const worker = await loadWorker();
  const upstream = [], realFetch = global.fetch;
  global.fetch = async (url, init) => {
    upstream.push({ body: JSON.parse(init.body), beta: init.headers['anthropic-beta'] || null });
    return new Response(JSON.stringify(reply || { model: JSON.parse(init.body).model, stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 }, content: [{ type: 'text', text: '{"found":false}' }] }), { status: 200 });
  };
  const out = [];
  try {
    for (const b of bodies) {
      const r = await worker.fetch(new Request('https://vinterest.pages.dev/claude', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://vinterest.pages.dev' }, body: JSON.stringify(b) }), { ANTHROPIC_API_KEY: 'test', ...env });
      out.push({ status: r.status, json: await r.json() });
    }
  } finally { global.fetch = realFetch; }
  return { upstream, out };
}
const msg = (purpose) => ({ purpose, messages: [{ role: 'user', content: 'Hello' }] });

test('Sonnet 4.6 (the default) gets the same request as before: no thinking, effort or betas', async () => {
  const { upstream, out } = await run({}, [msg('label_scan')]);
  expect(upstream[0].body).toEqual({ model: 'claude-sonnet-4-6', max_tokens: 4096, messages: [{ role: 'user', content: 'Hello' }] });
  expect(upstream[0].beta).toBeNull();
  expect(out[0].json).toMatchObject({ text: '{"found":false}', model: 'claude-sonnet-4-6', usage: { input_tokens: 10, output_tokens: 5 } });
});

test('Claude Sonnet 5.5: thinking off, low effort for scans, medium for quiz banks and articles, fallbacks on', async () => {
  const { upstream } = await run({ CLAUDE_MODEL: 'claude-sonnet-5-5' }, [msg('label_scan'), msg('grape_quiz'), msg('learn_article')]);
  expect(upstream[0].body).toMatchObject({ model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' }, output_config: { effort: 'low' }, fallbacks: 'default' });
  expect(upstream[0].beta).toBe('server-side-fallback-2026-07-01');
  expect(upstream[1].body.output_config.effort).toBe('medium');
  expect(upstream[2].body.output_config.effort).toBe('medium');
  // Overrides from the environment.
  const t = await run({ CLAUDE_MODEL: 'claude-sonnet-5-5', CLAUDE_EFFORT: 'high', CLAUDE_THINKING: 'on' }, [msg('label_scan')]);
  expect(t.upstream[0].body.output_config.effort).toBe('high');
  expect(t.upstream[0].body.thinking).toBeUndefined();
});

test('a refusal from every model in the chain is an error in words, not an empty answer', async () => {
  const { out } = await run({ CLAUDE_MODEL: 'claude-sonnet-5-5' }, [msg('wine_qa')], { stop_reason: 'refusal', content: [] });
  expect(out[0].status).toBe(422);
  expect(out[0].json.code).toBe('refused');
});

test('the price search stays on Sonnet 4.6 while CLAUDE_MODEL is on trial', async () => {
  const { upstream } = await run({ CLAUDE_MODEL: 'claude-sonnet-5-5' }, [{ purpose: 'price_search', wine: { name: 'Tignanello', vintage: 2021, country: 'Italy' }, market: { code: 'GBP', label: 'United Kingdom', country: 'GB' } }]);
  expect(upstream[0].body.model).toBe('claude-sonnet-4-6');
  expect(upstream[0].body.thinking).toBeUndefined();
});

// The guest's voice at the table (Vinterest Teams): /tts with a cloud voice, or off without a key.
async function tts(env, body, origin = 'https://vinterest.pages.dev') {
  const worker = await loadWorker();
  const upstream = [], realFetch = global.fetch;
  global.fetch = async (url, init) => { upstream.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers }); return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mpeg' } }); };
  try {
    const r = await worker.fetch(new Request('https://vinterest.pages.dev/tts', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify(body) }), env, { waitUntil() {} });
    return { status: r.status, type: r.headers.get('content-type'), upstream, json: r.headers.get('content-type')?.includes('json') ? await r.json() : null };
  } finally { global.fetch = realFetch; }
}
test('/tts: off without a voice key, so the app speaks with the phone\'s own voice', async () => {
  const r = await tts({}, { text: 'Evening!' });
  expect(r.status).toBe(404);
  expect(r.json).toMatchObject({ enabled: false, code: 'tts_off' });
  expect(r.upstream).toEqual([]);
});
test('/tts: ElevenLabs when its key is set, a diner\'s voice per table, the key kept on the server', async () => {
  const r = await tts({ ELEVENLABS_API_KEY: 'k' }, { text: 'Evening! What would you pour with the cod?', voice: 1 });
  expect(r.status).toBe(200);
  expect(r.type).toBe('audio/mpeg');
  expect(r.upstream[0].url).toContain('api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB');
  expect(r.upstream[0].headers['xi-api-key']).toBe('k');
  expect(r.upstream[0].body.model_id).toBe('eleven_v4'); // the default, chosen by ear
  expect(r.upstream[0].body.text).toBe('Evening! What would you pour with the cod?');
});
test('/tts: OpenAI\'s speech model with only its key; long text cut short; other origins refused', async () => {
  const r = await tts({ OPENAI_API_KEY: 'o' }, { text: 'x'.repeat(2000), voice: 2 });
  expect(r.upstream[0].url).toBe('https://api.openai.com/v1/audio/speech');
  expect(r.upstream[0].body.voice).toBe('sage');
  expect(r.upstream[0].body.input.length).toBe(600);
  const denied = await tts({ OPENAI_API_KEY: 'o' }, { text: 'Hi' }, 'https://evil.example');
  expect(denied.status).toBe(403);
});

test('TEAM_MODEL moves only the staff-training purposes, with room for Opus to think on the long writing', async () => {
  const env = { CLAUDE_MODEL: 'claude-sonnet-5-5', TEAM_MODEL: 'claude-opus-5-5' };
  const { upstream } = await run(env, [msg('team_cards'), msg('team_pairings'), msg('team_vinny'), msg('label_scan'), msg('learn_article'), msg('wine_qa')]);
  expect(upstream.map((u) => u.body.model)).toEqual(['claude-opus-5-5', 'claude-opus-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5']);
  // Opus always thinks: no thinking setting sent, effort by purpose, fallbacks on, long caps doubled.
  expect(upstream[0].body.thinking).toBeUndefined();
  expect(upstream[0].body).toMatchObject({ output_config: { effort: 'medium' }, fallbacks: 'default', max_tokens: 24576 });
  expect(upstream[1].body.max_tokens).toBe(16384);
  // A short answer (Ask Vinny) gets room to think too: at 500 the thinking used it all and the answer came back cut off.
  expect(upstream[2].body.max_tokens).toBe(4096);
  // The consumer app's calls are exactly what they were.
  expect(upstream[3].body).toMatchObject({ thinking: { type: 'between_tools' }, max_tokens: 4096 });
  // Without TEAM_MODEL the team purposes follow CLAUDE_MODEL as before.
  const plain = await run({ CLAUDE_MODEL: 'claude-sonnet-5-5' }, [msg('team_cards')]);
  expect(plain.upstream[0].body).toMatchObject({ model: 'claude-sonnet-5-5', max_tokens: 12288 });
});
// Prompt caching: a prompt's "[[cache-above]]" line splits it, the part above sent as a block marked for Anthropic's cache,
// the marker never sent; a prompt without it goes as it came, and a PDF's document block is left alone.
test('a prompt marked [[cache-above]] is sent with its unchanging part cached and without the marker', async () => {
  const body = (content) => ({ purpose: 'team_cards', messages: [{ role: 'user', content }] });
  const { upstream } = await run({}, [body('Instructions\nThe list\n[[cache-above]]\n\nThese wines'), msg('team_cards'),
    body([{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'x' } }, { type: 'text', text: 'Read it\n[[cache-above]]\nPage 1' }])]);
  expect(upstream[0].body.messages[0].content).toEqual([{ type: 'text', text: 'Instructions\nThe list', cache_control: { type: 'ephemeral' } }, { type: 'text', text: '\nThese wines' }]);
  expect(upstream[1].body.messages[0].content).toBe('Hello');
  expect(upstream[2].body.messages[0].content.map((b) => b.type)).toEqual(['document', 'text', 'text']);
  expect(JSON.stringify(upstream.map((u) => u.body))).not.toContain('[[cache-above]]');
});
// Each Teams prompt puts what one call is about (its wines, dishes, questions, the example) below the marker, so the part
// above is the same for every call of a publish; a placeholder above it would make every call a cache miss.
test('every Teams prompt that is cached keeps the per-call parts below its marker', async () => {
  const fs = require('node:fs'), dir = path.join(__dirname, '..', 'prompts');
  const perCall = { 'team-cards.txt': ['facts', 'wines', 'example'], 'team-fix.txt': ['facts', 'items'], 'team-review.txt': ['items'],
    'team-pairings.txt': ['dishes'], 'team-cocktail-cards.txt': ['cocktails'], 'team-dish-cards.txt': ['batch'] };
  for (const [f, keys] of Object.entries(perCall)) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8'), at = t.indexOf('[[cache-above]]');
    expect(at, f).toBeGreaterThan(0);
    expect(t.indexOf('[[cache-above]]', at + 1), f).toBe(-1);
    for (const k of keys) { expect(t.indexOf(`{{${k}}}`), `${f} {{${k}}}`).toBeGreaterThan(at); }
    expect(t.slice(0, at), f).toMatch(/\{\{(list|dishes)\}\}/); // the long, shared part is what's cached
  }
});
// A teaser install (npm run team:write -- --teaser) marks its calls `draft`: a team call then runs on the cheaper
// draft model whatever TEAM_MODEL says, and a draft flag on any other purpose changes nothing.
test('a draft team call runs on TEAM_DRAFT_MODEL (Sonnet 5.5 by default), and only a team call', async () => {
  const env = { CLAUDE_MODEL: 'claude-sonnet-4-6', TEAM_MODEL: 'claude-opus-5-5' };
  const draft = (p) => ({ ...msg(p), draft: true });
  const { upstream } = await run(env, [draft('team_cards'), msg('team_cards'), draft('label_scan')]);
  expect(upstream.map((u) => u.body.model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-sonnet-4-6']);
  const set = await run({ ...env, TEAM_DRAFT_MODEL: 'claude-haiku-5-5' }, [draft('team_pairings')]);
  expect(set.upstream[0].body.model).toBe('claude-haiku-5-5');
});
// data/tts-say.json as deployed: a name the voice gets wrong is swapped for a spelling it reads right, whole words
// only and the longest first, before it's sent; the model is chosen by ELEVENLABS_MODEL.
test('/tts: names are said as data/tts-say.json spells them, and ELEVENLABS_MODEL picks the model', async () => {
  const say = { say: { Jolivet: 'zho-lee-VAY', 'Pascal Jolivet': 'pas-KAL zho-lee-VAY' } };
  const ASSETS = { fetch: async (req) => new URL(req.url).pathname === '/data/tts-say.json' ? new Response(JSON.stringify(say)) : new Response('', { status: 404 }) };
  const r = await tts({ ELEVENLABS_API_KEY: 'k', ELEVENLABS_MODEL: 'eleven_multilingual_v2', ASSETS }, { text: 'The Pascal Jolivet, or another Jolivet? Not the Jolivets.' });
  expect(r.upstream[0].body.text).toBe('The pas-KAL zho-lee-VAY, or another zho-lee-VAY? Not the Jolivets.');
  expect(r.upstream[0].body.model_id).toBe('eleven_multilingual_v2');
});
// The voice teaches, so it's unhurried: 0.9 for a guest's line, 0.8 for a name said on its own, both settable.
test('/tts: an unhurried pace, slower still for a name on its own', async () => {
  const line = await tts({ ELEVENLABS_API_KEY: 'k' }, { text: 'Evening!' });
  expect(line.upstream[0].body.voice_settings).toMatchObject({ speed: 0.9, stability: 0.6 });
  const name = await tts({ ELEVENLABS_API_KEY: 'k' }, { text: 'Veuve Clicquot Brut', pace: 'slow' });
  expect(name.upstream[0].body.voice_settings.speed).toBe(0.8);
  const set = await tts({ ELEVENLABS_API_KEY: 'k', TTS_SPEED: '0.85', TTS_SLOW: '0.5' }, { text: 'Hi', pace: 'slow' });
  expect(set.upstream[0].body.voice_settings.speed).toBe(0.7); // clamped to what ElevenLabs takes
  const oa = await tts({ OPENAI_API_KEY: 'o' }, { text: 'Evening!' });
  expect(oa.upstream[0].body.speed).toBe(0.9);
});
// A restaurant's demo address: its root opens the staff app, and its pages may call the voice and Claude.
test('socialcorner.vinterest.team opens the staff app and is an allowed origin', async () => {
  const worker = await loadWorker();
  const r = await worker.fetch(new Request('https://socialcorner.vinterest.team/'), {}, { waitUntil() {} });
  expect(r.status).toBe(302);
  expect(r.headers.get('location')).toBe('https://socialcorner.vinterest.team/team/');
  const ok = await tts({ ELEVENLABS_API_KEY: 'k' }, { text: 'Hi' }, 'https://socialcorner.vinterest.team');
  expect(ok.status).toBe(200);
  const no = await tts({ ELEVENLABS_API_KEY: 'k' }, { text: 'Hi' }, 'https://socialcorner.vinterest.team.evil.example');
  expect(no.status).toBe(403);
});
// /stt: the recording goes to ElevenLabs' speech-to-text with word times; the words come back, nothing is kept.
test('/stt: a recording written down by ElevenLabs, off without its key, other origins refused', async () => {
  const worker = await loadWorker();
  const post = (env, origin = 'https://vinterest.pages.dev', type = 'audio/webm') => worker.fetch(new Request('https://vinterest.pages.dev/stt', { method: 'POST', headers: { 'content-type': type, origin }, body: new Uint8Array([1, 2, 3, 4]) }), env, { waitUntil() {} });
  const realFetch = global.fetch, up = [];
  global.fetch = async (url, init) => { up.push({ url: String(url), init, form: init.body }); return new Response(JSON.stringify({ text: 'The Grüner by the glass', language_code: 'en', words: [{ text: 'The', start: 0.2, end: 0.3, type: 'word' }, { text: ' ', type: 'spacing' }, { text: 'Grüner', start: 0.4, end: 0.8, type: 'word' }] }), { status: 200 }); };
  try {
    const r = await post({ ELEVENLABS_API_KEY: 'k' });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ text: 'The Grüner by the glass', words: [{ text: 'The', start: 0.2, end: 0.3 }, { text: 'Grüner', start: 0.4, end: 0.8 }], language: 'en' });
    expect(up[0].url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(up[0].init.headers['xi-api-key']).toBe('k');
    expect(up[0].form.get('model_id')).toBe('scribe_v1');
    expect(up[0].form.get('timestamps_granularity')).toBe('word');
    expect((await post({})).status).toBe(404);
    expect((await post({ ELEVENLABS_API_KEY: 'k' }, 'https://evil.example')).status).toBe(403);
    expect((await post({ ELEVENLABS_API_KEY: 'k' }, undefined, 'text/plain')).status).toBe(400);
  } finally { global.fetch = realFetch; }
});
