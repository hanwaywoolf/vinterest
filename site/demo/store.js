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
    .map((w, i) => ({ ...w, scanned_at: new Date(now - (i + 1) * 86400000 * 3).toISOString() }));
  local.setItem('vinterest_wines', JSON.stringify(wines));
  Object.entries({
    vinterest_onboarded: '1', vinterest_age_ok: '1', vinterest_region: 'uk', vinterest_currency: 'GBP',
    vinterest_wineDNA_unlock_seen: '1',
  }).forEach(([k, v]) => local.setItem(k, v));

  // Twelve bottles in, they've earned a few levels (Explorer, at 350 XP): the Learn tab and the
  // XP badge should look lived in, not like a first launch.
  local.setItem('vinterest_xp_v3', JSON.stringify({ version: 1, accounts: { local: { total: 410, events: [], scansThisWeek: [], totalRatings: 11, grapesSeen: ['Tempranillo', 'Grenache', 'Syrah', 'Malbec'], quizCompleted: {}, quizStreaks: {} } } }));

  return { sample, user: sample.user, slides: sample.slides };
})();
