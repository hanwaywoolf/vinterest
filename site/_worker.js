// site/_worker.js — the website's Cloudflare Pages Worker (advanced mode), for vinterest.app.
// Serves the static site, and handles the two small routes the page needs:
//   POST /api/beta     the beta sign-up: first name, last name, country, email -> Supabase `beta_signups`
//   GET  /api/country  the visitor's country as Cloudflare sees it, to pre-select the country box
//
// Set in Cloudflare Pages -> the site project -> Settings -> Variables and secrets:
//   SUPABASE_URL          https://<project-ref>.supabase.co   (the same project as the app)
//   SUPABASE_SECRET_KEY   (secret) the server key. It never reaches the browser.
// Without them, /api/beta answers 503 "not open yet" and the page says so; nothing else breaks.
// The table comes from supabase/migrations/0004_beta_signups.sql. Setup steps: docs/site-setup.md.
//
// Like the app's Worker, this file being present means Cloudflare's _headers file isn't applied to
// responses made here, so the few headers that matter are set below.

const ALLOWED_HOSTS = /^(vinterest\.app|www\.vinterest\.app|localhost(:\d+)?|([a-z0-9-]+\.)?vinterest-site\.pages\.dev)$/;
const MAX_BODY_BYTES = 4 * 1024;

// Best-effort, per isolate (not shared across Cloudflare's servers): a guard against a script
// hammering the form, not a hard limit.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 6;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > RATE_MAX;
}

const json = (obj, status = 200, extra = {}) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });

const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Exported so tests can run it without Cloudflare.
export async function handleBeta(request, env) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, { allow: "POST" });
  const host = new URL(request.url).host;
  const origin = request.headers.get("origin");
  if (origin) {
    let oh = "";
    try { oh = new URL(origin).host; } catch (e) { /* falls through to the refusal below */ }
    if (oh !== host && !ALLOWED_HOSTS.test(oh)) return json({ error: "That request didn't come from the Vinterest website." }, 403);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many tries. Please wait a few minutes and try again." }, 429);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "That was too much to send." }, 413);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: "That didn't look like a sign-up." }, 400); }

  // A hidden field people can't see and bots fill in: pretend it worked.
  if (body && body.website) return json({ ok: true });

  const first = clean(body.first_name, 80), last = clean(body.last_name, 80);
  const country = clean(body.country, 8).toUpperCase(); // not cut to 2: "Britain" must be refused, not become BR
  const email = clean(body.email, 254).toLowerCase();
  if (!first) return json({ error: "Add your first name." }, 400);
  if (!last) return json({ error: "Add your last name." }, 400);
  if (!/^[A-Z]{2}$/.test(country)) return json({ error: "Pick your country." }, 400);
  if (!EMAIL.test(email)) return json({ error: "That email address doesn't look right." }, 400);

  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ error: "Beta sign-ups aren't open just yet. Please check back soon." }, 503);
  let res;
  try {
    // ignore-duplicates: signing up twice is still "you're on the list", and reveals nothing about who is.
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/beta_signups?on_conflict=email`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SECRET_KEY, "content-type": "application/json", prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ first_name: first, last_name: last, country, email }),
    });
  } catch (e) {
    return json({ error: "We couldn't save that just now. Please try again in a moment." }, 502);
  }
  if (!res.ok) return json({ error: "We couldn't save that just now. Please try again in a moment." }, 502);
  return json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/beta") return handleBeta(request, env);
    if (url.pathname === "/api/country") {
      const c = request.headers.get("cf-ipcountry") || (request.cf && request.cf.country) || "";
      return json({ country: /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : "" });
    }
    const res = await env.ASSETS.fetch(request);
    const type = res.headers.get("content-type") || "";
    const out = new Response(res.body, res);
    // Pages, scripts and styles are re-checked each visit (they carry a version in the address);
    // fonts and images can be kept.
    if (/text\/html|javascript|text\/css/.test(type)) out.headers.set("cache-control", "no-cache, must-revalidate");
    else if (/^\/(fonts|icons)\//.test(url.pathname) || url.pathname === "/logo.png") out.headers.set("cache-control", "public, max-age=2592000");
    out.headers.set("x-content-type-options", "nosniff");
    out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    return out;
  },
};
