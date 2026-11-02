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

// The guest's voice at the table (Vinterest for teams): /tts with a cloud voice, or off without a key.
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
