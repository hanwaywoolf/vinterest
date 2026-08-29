// functions/recognise.js — Cloudflare Pages Function, replaces netlify/functions/recognise.js
// Serves at /recognise. Not currently called by the client (scan flow uses /claude directly
// with a vision message) — kept for parity in case a direct-endpoint flow is wired up later.

const DEMO_WINE = {
  name:'Château Margaux',producer:'Château Margaux',vintage:2018,region:'Bordeaux',
  sub_region:'Margaux',country:'France',type:'red',grapes:['Cabernet Sauvignon','Merlot','Cabernet Franc'],
  body:0.9,tannins:0.85,acidity:0.6,sweetness:0.05,abv:13.5,
  tasting_notes:['Black Cassis','Cedar','Violets','Tobacco','Graphite'],
  food_pairings:['Grilled Steak','Rack of Lamb','Hard Cheese'],
  price_usd:195,community_rating:4.7,
  description:'A flagship Bordeaux with layers of dark cassis, violets, and subtle cedar. The tannins are structured but polished — approachable now with a long, minerally finish.',
  why_you_will_like_this:'Full-bodied with earthy notes and structured tannins — a natural fit for lovers of bold, complex reds.',
  body_plain:'How heavy it feels in your mouth',tannins_plain:'That drying grip on your gums',
  acidity_plain:'How zingy and fresh it tastes',sweetness_plain:'Dry means barely any sugar',
};

const PROMPT = `You are an expert sommelier. Analyse this wine label image. Return ONLY valid JSON (no markdown, no code fences) with these fields:
{"name":"full wine name","producer":"winery","vintage":2018,"region":"region","sub_region":"sub-region","country":"country","type":"red|white|rosé|sparkling","grapes":["Grape"],"body":0.85,"tannins":0.80,"acidity":0.60,"sweetness":0.05,"texture":0.5,"effervescence":0.5,"abv":13.5,"tasting_notes":["Note1","Note2"],"food_pairings":["Food1","Food2"],"price_usd":50,"community_rating":4.5,"description":"2-3 sentence description.","why_you_will_like_this":"1-2 sentences.","body_plain":"How heavy it feels in your mouth","tannins_plain":"That drying grip on your gums","acidity_plain":"How zingy and fresh it tastes","sweetness_plain":"Dry means barely any sugar","texture_plain":"Steely and clean, or rich and creamy","effervescence_plain":"How soft or vigorous the bubbles feel"}
For "texture" (0=crisp/steely/unoaked, 1=rich/creamy/oaked — driven by oak aging, lees contact, or malolactic fermentation): ONLY include a real value when type is "white"; use null for all other types.
For "effervescence" (0=soft/delicate mousse, 1=vigorous/fine/persistent bubbles): ONLY include a real value when type is "sparkling"; use null for all other types.
If no wine label is visible return: {"error":"no_wine_label"}`;

export async function onRequestOptions() {
  return new Response('', { status: 204, headers: headers() });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  let imageBase64, clientKey;
  try {
    const body = await request.json();
    imageBase64 = body.image || '';
    clientKey = body.clientKey || '';
  } catch (e) {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const apiKey = (env.ANTHROPIC_API_KEY || clientKey || '').trim();
  if (!apiKey) return respond(200, { demo: true, reason: 'no_api_key', wine: DEMO_WINE, confidence: 0.5 });
  if (!imageBase64) return respond(200, { demo: true, reason: 'no_image', wine: DEMO_WINE, confidence: 0.5 });

  let claudeRaw;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = await res.json();
    claudeRaw = j.content?.[0]?.text || '';
  } catch (e) {
    return respond(200, { demo: true, reason: e.message, wine: DEMO_WINE, confidence: 0.5 });
  }

  let wine;
  try {
    wine = JSON.parse(claudeRaw.replace(/```json|```/g, '').trim());
  } catch (e) {
    return respond(200, { demo: true, reason: 'parse_error: ' + claudeRaw.slice(0, 100), wine: DEMO_WINE, confidence: 0.4 });
  }

  if (wine.error === 'no_wine_label') return respond(200, { no_match: true, wine: null, confidence: 0 });
  return respond(200, { demo: false, wine, confidence: 0.95 });
}

function headers() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
}
function respond(status, obj) {
  return new Response(JSON.stringify(obj), { status, headers: headers() });
}
