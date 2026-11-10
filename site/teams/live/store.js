/* Vinterest Teams website: the live phone's storage.

   The website's phones run the Teams app's real code (scripts/site-teams.mjs bundles its sources into live.js),
   which keeps a restaurant through Store (pwa-store.js). A page on vinterest.team must leave nothing on a
   visitor's device, and every loop of a demo starts from the same restaurant, so Store is pointed at a
   memory-only area. This file sits straight after pwa-store.js in the bundle's list. */
const TeamsLiveStore = (() => {
  function area() {
    const m = new Map();
    return { _map: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
      key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } };
  }
  const local = area(), session = area();
  Store._area = (isSession) => (isSession ? session : local);
  return { clear() { local._map.clear(); session._map.clear(); } };
})();
