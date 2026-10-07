/* Vinterest website — the demo's storage.

   The website shows the app's real screens, so it runs the app's real code (scripts/site.mjs bundles
   the app's sources into demo.js). That code keeps its data through Store (pwa-store.js), which
   would otherwise use the visitor's own localStorage: on vinterest.app that's the same origin as
   the web app at /test, and a demo must never read or overwrite anyone's real wines.

   So Store is pointed at a memory-only area instead, seeded with the one imaginary user the
   onboarding slides use (data/onboarding-sample.json): a red drinker who loves Rioja and is
   branching into the Rhône. Nothing here is written to the visitor's device, and no screen can
   reach it. This file must sit straight after pwa-store.js in scripts/site.mjs's list. */

const DemoPersona = (() => {
  const sample = _loadJSON('data/onboarding-sample.json');
  function area() {
    const m = new Map();
    return {
      _map: m,
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => { m.set(k, String(v)); },
      removeItem: (k) => { m.delete(k); },
      key: (i) => Array.from(m.keys())[i] || null,
      get length() { return m.size; },
    };
  }
  const local = area(), session = area();
  Store._area = (isSession) => (isSession ? session : local);

  // Each wine was scanned a few days after the last, newest first, as the sample generator does.
  const now = Date.now();
  const wines = sample.user.wines
    .filter((w) => w.rating || w.scan_intent)
    .map((w, i) => ({ ...w, scanned_at: new Date(now - (i + 1) * 86400000 * 3).toISOString() }))
    // A scan saves the label's own short description (it's The Story on the wine's Learn tab); the
    // sample generator doesn't keep one, so the bottle the My Wines demo opens gets its own.
    .map((w) => (/Ardanza/.test(w.name) ? { ...w, description: "La Rioja Alta's Viña Ardanza is a benchmark of traditional Rioja: mostly Tempranillo with a little Garnacha, aged about three years in American oak. Expect dried cherry, vanilla and a savoury, leathery finish." } : w));
  local.setItem('vinterest_wines', JSON.stringify(wines));
  Object.entries({
    vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP',
    vinterest_wineDNA_unlock_seen: '1',
    // The demos show what the app can do, so every screen at full detail (DetailLevel).
    vinterest_detail_all: '1', vinterest_detail_intro: '1',
  }).forEach(([k, v]) => local.setItem(k, v));

  // Written for you opens once the first beginner article is read (ContentEngine.shelfOpen), and a
  // drinker twelve bottles in has read it: Keep learning, Home and Learn show their pieces.
  local.setItem('vinterest_' + _loadJSON('data/onramp.json')[0].id + '_done', '1');

  // Twelve bottles in, they've earned a few levels (Explorer, at 350 XP): the Learn tab and the
  // XP badge should look lived in, not like a first launch.
  local.setItem('vinterest_xp_v3', JSON.stringify({ version: 1, accounts: { local: { total: 410, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: ['Tempranillo', 'Grenache', 'Syrah', 'Malbec'], quizCompleted: {}, quizStreaks: {} } } }));

  // Rating a bottle in a demo really saves it (WineHistory.add), which would change every other demo
  // (12 bottles become 13, a scored wine appears). So each demo starts from this snapshot: mounting
  // one puts the store back as seeded, and a demo's own React state is untouched by that.
  const baseline = Array.from(local._map.entries());
  function reset() {
    local._map.clear(); session._map.clear();
    baseline.forEach(([k, v]) => local._map.set(k, v));
  }

  // Take the store as it is now as the one every demo starts from (after demos.jsx has added the sample
  // user's studying, which needs the app's modules loaded).
  function rebase() { baseline.length = 0; Array.from(local._map.entries()).forEach((e) => baseline.push(e)); }

  return { sample, user: sample.user, slides: sample.slides, reset, rebase };
})();
