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
