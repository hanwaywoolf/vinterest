// functions/health.js — Cloudflare Pages Function, replaces netlify/functions/health.js
// Visit /health in your browser to verify the function + API key are working.

export async function onRequestGet(context) {
  const apiKey = context.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ status: 'missing_key', message: 'ANTHROPIC_API_KEY is NOT set. Add it in Cloudflare Pages → Settings → Environment variables, then trigger a new deploy.' });
  }
  let claudeOk = false, claudeError = null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-opus-4-5-20251101', max_tokens: 5, messages: [{ role: 'user', content: 'Hi' }] }),
    });
    claudeOk = res.ok;
    if (!res.ok) claudeError = `HTTP ${res.status}: ${(await res.text()).slice(0, 100)}`;
  } catch (e) { claudeError = e.message; }

  return json({
    status: claudeOk ? 'ok' : 'claude_error',
    api_key_set: true,
    api_key_prefix: apiKey.slice(0, 14) + '...',
    claude_reachable: claudeOk,
    error: claudeError,
    message: claudeOk ? 'Everything working — scans will use real Claude vision.' : `Error: ${claudeError}`,
  });
}

function json(obj) {
  return new Response(JSON.stringify(obj), { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
