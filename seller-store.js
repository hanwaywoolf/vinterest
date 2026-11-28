/* Vinterest Seller: where the prototype keeps its data.

   Seller runs the Teams code over a prospect restaurant (its list, menu, cards and pairings, read through TeamData),
   and Teams keeps one restaurant per device in localStorage (`vbiz_*`). Seller is served from the same origin as
   /team/, so loading a prospect there would overwrite whatever restaurant that browser is training on. So Store is
   pointed at a memory-only area instead, as the website's demos are (site/demo/store.js): nothing is read from or
   written to the device. An agency's price file, stock and customers belong on the server behind a sign-in anyway
   (docs/seller.md), so this never becomes device storage. This file sits straight after pwa-store.js in SELLER_ALL. */
(() => {
  const area = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } }; };
  const local = area(), session = area();
  Store._area = (isSession) => (isSession ? session : local);
})();
