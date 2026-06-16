export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace('/api', '');
  const wineName = url.searchParams.get('name');
  const location = url.searchParams.get('location') || 'uk';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
      }
    });
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (!wineName) {
    return new Response(JSON.stringify({ error: 'Missing name' }), { status: 400, headers });
  }

  const WS_BASE = 'https://www.wine-searcher.com/api/v2';

  if (path === '/wine-check') {
    const res = await fetch(`${WS_BASE}/wine/check?api_key=${env.WINE_SEARCHER_KEY}&name=${encodeURIComponent(wineName)}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers });
  }

  if (path === '/market-price') {
    const res = await fetch(`${WS_BASE}/price?api_key=${env.WINE_SEARCHER_KEY}&name=${encodeURIComponent(wineName)}&location=${location}`);
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers });
  }

  if (path === '/lcbo') {
    const res = await fetch('https://api.lcbo.dev/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          products(
            filters: { name: "${wineName.replace(/"/g,'')}", categorySlug: "wine" }
            pagination: { first: 3 }
          ) {
            edges { node { sku name priceInCents producerName thumbnailUrl } }
          }
        }`
      })
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), { headers });
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
}
