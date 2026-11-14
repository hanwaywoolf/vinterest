// site/teams/_worker.js — the vinterest.team website's Cloudflare Pages Worker (advanced mode).
// Serves the static site, and handles the one route the page needs:
//   POST /api/pilot    a pilot request -> Supabase `pilot_requests`, then two emails through Resend:
//                      a confirmation to the person, and the request itself to us
//   GET  /api/country  the visitor's country as Cloudflare sees it, to pre-select the country box
//
// Set in Cloudflare Pages -> vinterest-teams -> Settings -> Variables and secrets (Production and Preview):
//   SUPABASE_URL          https://<project-ref>.supabase.co   (the same project as the app)
//   SUPABASE_SECRET_KEY   (secret) the server key. It never reaches the browser.
// Optional, for the emails (sent after a request is saved; a failure never fails the request):
//   RESEND_API_KEY        (secret) a Resend API key. Without it, no email is sent and nothing else changes.
//   RESEND_FROM           the sender, default "Vinterest Teams <hello@vinterest.app>" (its domain must be verified in Resend)
//   PILOT_NOTIFY          where new requests are sent, default hello@vinterest.app (a comma list is fine)
// Without the Supabase pair, /api/pilot answers 503 and the page says so; nothing else breaks.
// The table comes from supabase/migrations/0008_pilot_requests.sql. Setup steps: docs/site-setup.md.
//
// With this file present Cloudflare applies neither _redirects nor _headers, so the www redirect and
// the few headers that matter are done here.

const ALLOWED_HOSTS = /^(vinterest\.team|www\.vinterest\.team|localhost(:\d+)?|127\.0\.0\.1(:\d+)?|([a-z0-9-]+\.)?vinterest-teams\.pages\.dev)$/;
const MAX_BODY_BYTES = 8 * 1024;

// Best-effort, per isolate: a guard against a script hammering the form, not a hard limit.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
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
const clean = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
const cleanText = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max) : "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The choices the form offers. Anything else is refused, so the table holds only these.
export const PILOT = {
  types: { restaurant: "Restaurant", fine_dining: "Fine dining restaurant", wine_bar: "Wine bar", group: "Restaurant group", winery: "Winery or tasting room", other: "Other" },
  pos: { square: "Square", toast: "Toast", clover: "Clover", lightspeed: "Lightspeed", zonal: "Zonal (Aztec)", tevalis: "Tevalis", eposnow: "Epos Now", micros: "Oracle Micros Simphony", aloha: "NCR Aloha", other: "Other", none: "None or not sure" },
  sites: ["1", "2–5", "6–20", "More than 20"],
  team: ["Under 10", "10–25", "26–50", "More than 50"],
  list: ["Under 50", "50–150", "150–400", "More than 400"],
};

// Reads and checks a request. Returns {row} or {error}, the error in words the page can show.
export function readPilot(body) {
  const b = body || {};
  const row = {
    first_name: clean(b.first_name, 80), last_name: clean(b.last_name, 80), email: clean(b.email, 254).toLowerCase(),
    company: clean(b.company, 120), role: clean(b.role, 80) || null, city: clean(b.city, 80),
    country: clean(b.country, 8).toUpperCase(), venue_type: clean(b.venue_type, 20), venue_type_other: clean(b.venue_type_other, 120) || null,
    sites: clean(b.sites, 20), team_size: clean(b.team_size, 20), pos: clean(b.pos, 20), pos_other: clean(b.pos_other, 80) || null,
    list_size: clean(b.list_size, 20), notes: cleanText(b.notes, 1000) || null,
  };
  if (!row.first_name) return { error: "Add your first name." };
  if (!row.last_name) return { error: "Add your last name." };
  if (!EMAIL.test(row.email)) return { error: "That email address doesn't look right." };
  if (!row.company) return { error: "Add your business name." };
  if (!row.city) return { error: "Add your city." };
  if (!/^[A-Z]{2}$/.test(row.country)) return { error: "Pick your country." };
  if (!PILOT.types[row.venue_type]) return { error: "Pick the type of business." };
  if (row.venue_type === "other" && !row.venue_type_other) return { error: "Tell us what kind of business it is." };
  if (row.venue_type !== "other") row.venue_type_other = null;
  if (!PILOT.sites.includes(row.sites)) return { error: "Pick how many locations you have." };
  if (!PILOT.team.includes(row.team_size)) return { error: "Pick the size of your front-of-house team." };
  if (!PILOT.pos[row.pos]) return { error: "Pick your POS system, or None or not sure." };
  if (row.pos === "other" && !row.pos_other) return { error: "Tell us which POS you use." };
  if (row.pos !== "other") row.pos_other = null;
  if (!PILOT.list.includes(row.list_size)) return { error: "Pick roughly how many wines are on your list." };
  return { row };
}

async function resend(env, msg) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.RESEND_FROM || "Vinterest Teams <hello@vinterest.app>", ...msg }),
    });
    if (!res.ok) console.warn("Resend refused an email:", res.status);
  } catch (e) {
    console.warn("Resend couldn't be reached:", e && e.message);
  }
}

// The confirmation to the person, and the request itself to us (reply goes straight to them).
export function pilotEmails(env, r) {
  const type = r.venue_type === "other" ? r.venue_type_other : PILOT.types[r.venue_type];
  const pos = r.pos === "other" ? r.pos_other : PILOT.pos[r.pos];
  const confirm = {
    to: [r.email], reply_to: "hello@vinterest.app", subject: "Your Vinterest Teams pilot request",
    text: `Hi ${r.first_name},\n\nThanks for asking about a Vinterest Teams pilot for ${r.company}. We'll be in touch within two working days to talk about your list, your team and when you'd like to start.\n\nIf you didn't ask, just ignore this email and you won't hear from us again.\n\nQuestions? Reply to this email.\n\nVinterest Teams\nhttps://vinterest.team`,
    html: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a;max-width:520px"><p>Hi ${escapeHtml(r.first_name)},</p><p>Thanks for asking about a Vinterest Teams pilot for <strong>${escapeHtml(r.company)}</strong>. We'll be in touch within two working days to talk about your list, your team and when you'd like to start.</p><p>If you didn't ask, just ignore this email and you won't hear from us again.</p><p>Questions? Reply to this email.</p><p>Vinterest Teams<br><a href="https://vinterest.team" style="color:#8B1A2F">vinterest.team</a></p></div>`,
  };
  const lines = [
    ["Name", `${r.first_name} ${r.last_name}`], ["Email", r.email], ["Role", r.role || "—"], ["Business", r.company],
    ["Where", `${r.city}, ${r.country}`], ["Type", type], ["Locations", r.sites], ["Front-of-house team", r.team_size],
    ["POS", pos], ["Wines on the list", r.list_size], ["Notes", r.notes || "—"],
  ];
  const notify = {
    to: String(env.PILOT_NOTIFY || "hello@vinterest.app").split(",").map((s) => s.trim()).filter(Boolean), reply_to: r.email,
    subject: `Pilot request: ${r.company}, ${r.city}`,
    text: lines.map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: `<table style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.45;border-collapse:collapse">${lines.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`).join("")}</table>`,
  };
  return [confirm, notify];
}

// Exported so tests can run it without Cloudflare.
export async function handlePilot(request, env, ctx) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405, { allow: "POST" });
  const host = new URL(request.url).host;
  const origin = request.headers.get("origin");
  if (origin) {
    let oh = "";
    try { oh = new URL(origin).host; } catch (e) { /* refused below */ }
    if (oh !== host && !ALLOWED_HOSTS.test(oh)) return json({ error: "That request didn't come from the Vinterest Teams website." }, 403);
  }
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (limited(ip)) return json({ error: "Too many tries. Please wait a few minutes and try again." }, 429);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: "That was too much to send." }, 413);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ error: "That didn't look like a pilot request." }, 400); }
  if (body && body.website) return json({ ok: true }); // the hidden field only bots fill in

  const { row, error } = readPilot(body);
  if (error) return json({ error }, 400);
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return json({ error: "Pilot requests aren't open just yet. Please email hello@vinterest.app." }, 503);
  let res;
  try {
    res = await fetch(`${env.SUPABASE_URL}/rest/v1/pilot_requests`, {
      method: "POST",
      headers: { apikey: env.SUPABASE_SECRET_KEY, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify(row),
    });
  } catch (e) {
    return json({ error: "We couldn't save that just now. Please try again in a moment." }, 502);
  }
  if (!res.ok) return json({ error: "We couldn't save that just now. Please try again in a moment." }, 502);
  if (env.RESEND_API_KEY) {
    const sending = Promise.all(pilotEmails(env, row).map((m) => resend(env, m)));
    if (ctx && ctx.waitUntil) ctx.waitUntil(sending); else await sending;
  }
  return json({ ok: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.hostname === "www.vinterest.team") return Response.redirect(`https://vinterest.team${url.pathname}${url.search}`, 301);
    if (url.pathname === "/api/pilot") return handlePilot(request, env, ctx);
    if (url.pathname === "/api/country") {
      const c = request.headers.get("cf-ipcountry") || (request.cf && request.cf.country) || "";
      return json({ country: /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : "" });
    }
    const res = await env.ASSETS.fetch(request);
    const type = res.headers.get("content-type") || "";
    const out = new Response(res.body, res);
    // Pages, scripts and styles are re-checked each visit (they carry a version in the address);
    // fonts are kept, and images carry a version too.
    if (/text\/html|javascript|text\/css/.test(type)) out.headers.set("cache-control", "no-cache, must-revalidate");
    else if (/^\/fonts\//.test(url.pathname)) out.headers.set("cache-control", "public, max-age=2592000");
    if (url.pathname.startsWith("/for/")) out.headers.set("x-robots-tag", "noindex, nofollow"); // private pages for one prospect
    out.headers.set("x-content-type-options", "nosniff");
    out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
    return out;
  },
};
