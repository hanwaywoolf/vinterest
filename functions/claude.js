// functions/claude.js — Cloudflare Pages Function, replaces netlify/functions/claude.js
// Serves at /claude (file-based routing). Set ANTHROPIC_API_KEY in
// Cloudflare Pages → Settings → Environment variables (Production + Preview).

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const key = env.ANTHROPIC_API_KEY;
  if (!key) return json(500, { error: "Server is missing ANTHROPIC_API_KEY. Add it in Cloudflare Pages → Settings → Environment variables, then retry the deploy." });

  let payload;
  try { payload = await request.json(); } catch (e) { return json(400, { error: "Invalid JSON body." }); }

  const messages = payload.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { error: "Request must include a non-empty messages[] array." });
  }

  const model = payload.model || env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
  const max_tokens = Math.min(Number(payload.max_tokens) || 4096, 8192);

  const skillId = payload.skill_id || null;
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(c => c.type === "image"));
  const useSkill = !!(skillId && !hasImages);

  const apiBody = { model, max_tokens, messages };
  if (useSkill) {
    apiBody.container = { skills: [{ type: "custom", skill_id: skillId }] };
    apiBody.tools = [{ type: "code_execution_20250522", name: "code_execution" }];
  }

  const apiHeaders = { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" };
  if (useSkill) apiHeaders["anthropic-beta"] = "skills-2025-10-02,code-execution-2025-05-22";

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: apiHeaders, body: JSON.stringify(apiBody) });
    const data = await r.json();
    if (!r.ok) {
      const msg = (data && data.error && data.error.message) || "Anthropic API error.";
      if (useSkill) {
        const fallback = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model, max_tokens, messages })
        });
        const fallbackData = await fallback.json();
        if (!fallback.ok) return json(fallback.status, { error: (fallbackData.error && fallbackData.error.message) || "Anthropic API error." });
        const fallbackText = (fallbackData.content || []).filter(b => b.type === "text").map(b => b.text).join("");
        return json(200, { text: fallbackText, skill_used: false });
      }
      return json(r.status, { error: msg });
    }
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
    return json(200, { text, skill_used: useSkill });
  } catch (e) {
    return json(502, { error: "Failed to reach Anthropic: " + (e && e.message ? e.message : String(e)) });
  }
}

function cors() {
  return { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
}
function json(statusCode, obj) {
  return new Response(JSON.stringify(obj), { status: statusCode, headers: Object.assign({ "content-type": "application/json" }, cors()) });
}
