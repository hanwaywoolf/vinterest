const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // ── /api/claude proxy ─────────────────────────────────────
  if (path === '/api/claude') {
    const body = await request.json();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: CORS });
  }

  // ── /api/lcbo proxy ───────────────────────────────────────
  if (path === '/api/lcbo') {
    const name = url.searchParams.get('name') || '';
    const res = await fetch('https://api.lcbo.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { products(search:"${name}", first:3) {
          edges { node { name brand price volume alcoholContent } }
        }}`
      })
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers: CORS });
  }

  // ── /api/retail — Supabase cache + Apify lookup ───────────
  if (path === '/api/retail') {
    const wine = url.searchParams.get('wine') || '';
    const vintage = url.searchParams.get('vintage') || '';
    const region = url.searchParams.get('region') || 'uk';

    if (!wine) {
      return new Response(JSON.stringify({ error: 'wine param required' }), { status: 400, headers: CORS });
    }

    const cacheKey = `${wine}-${vintage}`.toLowerCase().replace(/\s+/g, '-');
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

    // 1. Check Supabase cache
    try {
      const cacheRes = await fetch(
        `${env.SUPABASE_URL}/rest/v1/wine_cache?wine_key=eq.${encodeURIComponent(cacheKey)}&select=*`,
        { headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`
        }}
      );
      const cached = await cacheRes.json();

      if (Array.isArray(cached) && cached.length > 0) {
        const age = Date.now() - new Date(cached[0].fetched_at).getTime();
        if (age < SEVEN_DAYS) {
          return new Response(JSON.stringify({
            source: 'cache',
            retail: cached[0].retail_data,
            lcbo: cached[0].lcbo_data
          }), { headers: CORS });
        }
      }
    } catch (e) {
      console.error('Supabase cache read error:', e);
    }

    // 2. Cache miss — call Apify Wine-Searcher actor
    let retailData = null;
    try {
      const apifyRes = await fetch(
        `https://api.apify.com/v2/acts/abotapi~wine-searcher-scraper/run-sync-get-dataset-items?token=${env.APIFY_API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wines: [`${wine} ${vintage}`.trim()],
            country: region === 'ontario' ? 'CA' : 'GB'
          })
        }
      );
      const apifyData = await apifyRes.json();
      retailData = apifyData[0] || null;
    } catch (e) {
      console.error('Apify error:', e);
    }

    // 3. Ontario: also fetch LCBO
    let lcboData = null;
    if (region === 'ontario') {
      try {
        const lcboRes = await fetch('https://api.lcbo.dev/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `query { products(search:"${wine}", first:3) {
              edges { node { name brand price volume alcoholContent } }
            }}`
          })
        });
        lcboData = await lcboRes.json();
      } catch (e) {
        console.error('LCBO error:', e);
      }
    }

    // 4. Store in Supabase
    try {
      const row = {
        wine_key: cacheKey,
        wine_name: wine,
        vintage: vintage,
        retail_data: retailData,
        lcbo_data: lcboData,
        fetched_at: new Date().toISOString()
      };

      await fetch(`${env.SUPABASE_URL}/rest/v1/wine_cache`, {
        method: 'POST',
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(row)
      });
    } catch (e) {
      console.error('Supabase write error:', e);
    }

    return new Response(JSON.stringify({
      source: 'live',
      retail: retailData,
      lcbo: lcboData
    }), { headers: CORS });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: CORS });
}
