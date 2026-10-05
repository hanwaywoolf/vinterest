/* Vinterest website — the demo screens.

   Each demo is one of the app's real screens (the scan result, the post-scan deck, WineDNA, Home,
   My Wines…) drawn in a phone frame from the memory-only store in store.js, so what the page shows
   is what the app does, and it can't drift from it. site.js calls VinterestDemo.mount(el, kind)
   when a phone nears the viewport and update(p) as the demo plays (p: 0 to 1 through its section).
   A demo never takes a real tap (the frame is pointer-events:none and inert) and nothing here
   calls the network.

   Most demos are "the screen, scrolled": update(p) glides the screen's own scroll container. Some
   also do what a visitor would with a finger, by clicking the real controls at the right moment
   (opening "Why 87%?", turning a deck card, sliding the score) and are undone or redone as p moves
   back and forth. The Vinny demo types a question and answer instead, from what Vinny really said
   (data/onboarding-sample.json). */

const _DEMO_NOOP = () => {};

/* Rating a bottle here must not show the XP toast over the page. */
XPSystem.awardAndToast = function (reasons) { return this.award(reasons); };

/* The app draws some full-screen overlays straight into document.body (the Blind Call result). On the
   website that would cover the whole page, so while a demo has claimed a phone's overlay layer
   (window.__demoPortal) they're drawn inside that phone instead. */
const _realCreatePortal = ReactDOM.createPortal;
ReactDOM.createPortal = function (child, node, key) {
  const t = window.__demoPortal;
  return _realCreatePortal.call(this, child, node === document.body && t && t.isConnected ? t : node, key);
};

/* The demos never call Claude. Where a real screen asks for text (the WineDNA summary, the
   sommelier script, the scan cards), it gets what Claude really wrote for the sample user, captured
   once by `npm run site:capture` into captured.json, like the onboarding slides' Vinny answer.
   Anything not captured rejects, and the screen shows what it shows when Claude can't be reached. */
const _DEMO_CAPTURED = _loadJSON('site/demo/captured.json');
window.claude = {
  complete(arg) {
    const purpose = arg && arg.purpose, prompt = String((arg && arg.messages && arg.messages[0] && arg.messages[0].content) || '');
    if (window.__demoCapture) return Promise.resolve(window.__demoCapture(purpose, prompt)); // site-capture.mjs
    const a = _DEMO_CAPTURED.answers || {};
    const text = purpose === 'winedna_summary' ? a.winedna_summary
      : purpose === 'scancard' ? a.scancard
      : purpose === 'learn_article' ? a.learn_article
      : purpose === 'vintage_info' ? a.vintage_info
      : purpose === 'education' ? a.education
      : purpose === 'price' ? (/Ardanza/.test(prompt) ? a.price_ardanza : null)
      : purpose === 'sommelier_script' ? (/^Condense/.test(prompt) ? a.sommelier_short : a.sommelier_long) : null;
    return text ? Promise.resolve(text) : Promise.reject(new Error('The website demos make no calls'));
  },
};

/* ── helpers ── */
const _ownText = (n) => Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim();
const _findText = (root, re) => Array.from(root.querySelectorAll('*')).find((n) => re.test(_ownText(n)));
/* A tap on the first element whose own text matches, as a finger would (the click bubbles to the handler). */
const _tapText = (root, re) => { const hit = _findText(root, re); if (hit) hit.click(); return !!hit; };
/* React remembers an input's value itself, so set it the way the browser does and fire the event it listens to. */
function _setInput(input, v) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(v));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
/* The rating card's score slider (TrackSlider): a role="slider" element that takes pointer events,
   not an input. Setting a score is a tap at the right place along it, as a finger would: a
   pointerdown at that x (which sets the value), then the pointerup that lets go. */
const _scoreSlider = (root) => root.querySelector('[role="slider"][aria-label="Score"]');
function _setScore(slider, score) {
  const min = Number(slider.getAttribute('aria-valuemin')), max = Number(slider.getAttribute('aria-valuemax'));
  const r = slider.getBoundingClientRect();
  const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, clientX: r.left + ((score - min) / (max - min)) * r.width, clientY: r.top + r.height / 2 };
  slider.dispatchEvent(new PointerEvent('pointerdown', init));
  slider.dispatchEvent(new PointerEvent('pointerup', init));
}
const _scoreNow = (slider) => Number(slider.getAttribute('aria-valuenow')) || 0; // 0 while unset
/* Runs fn now and every 120ms until it says it's done (screens fill in after their first paint). */
function _until(fn, tries = 40) {
  let dead = false;
  (function go(n) { if (dead || fn() || n <= 0) return; setTimeout(() => go(n - 1), 120); })(tries);
  return () => { dead = true; };
}
/* The screen's own vertical scroller: the tallest overflowing element inside it. */
function _demoScroller(root) {
  let best = null, room = 40;
  root.querySelectorAll('*').forEach((el) => {
    const oy = el.scrollHeight - el.clientHeight;
    if (oy <= room) return;
    const st = getComputedStyle(el).overflowY;
    if (st === 'auto' || st === 'scroll') { best = el; room = oy; }
  });
  return best;
}
/* Glides a scroller to wherever it's last been sent, so a jump (a caption clicked, a panel opening
   and making the page longer) reads as a scroll rather than a cut. */
function _glider(getEl) {
  let target = 0, raf = 0;
  const step = () => {
    const s = getEl();
    if (!s) { raf = 0; return; }
    const d = target - s.scrollTop;
    if (Math.abs(d) < 0.6) { s.scrollTop = target; raf = 0; return; }
    s.scrollTop += d * 0.1; // slow enough that a jump to a far part glides rather than swings
    raf = requestAnimationFrame(step);
  };
  return { to(t) { target = t; if (!raf) raf = requestAnimationFrame(step); }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}
const _clamp01 = (x) => Math.max(0, Math.min(1, x));
const _ease = (x) => { x = _clamp01(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };

/* The deck's progress dots are its jump buttons; the last one is the rating card. */
const _deckDots = (el) => { const sw = el.querySelector('.sc-swipe'), bar = sw && sw.parentElement && sw.parentElement.firstElementChild; return bar ? Array.from(bar.children) : null; };
const _DECK_CARDS = 9;
const _topCard = (el) => el.querySelector('.sc-swipe > div > div');
/* What it takes to reach the deck's rating card, and a score in it. */
const _RATE_TO = 92;
/* Where the Blind Call part sits in the deck demo's p (see the caption's data-at in index.html). */
const BLIND_AT = 0.75, BLIND_END = 0.777;

/* The bottle in the camera: the sample user's next scan. `tracked` keeps the scan from being saved
   into the demo user's wines, so the other demos never change. */
function _openScan(view, unlock) {
  DemoPersona.reset();
  const wine = { ...DemoPersona.user.scanned, confidence: 'high' };
  // A confirmed scan opens its grape's and region's quizzes (ScanFlow.unlockLearning): what the
  // "Keep learning" options after a score are built from. `tracked` skips it, so do it here.
  if (unlock) ScanFlow.unlockLearning(wine);
  Handoff.openWine({ wine, source: 'camera', tracked: true, view });
}

/* The Mastery demo's sample user: a drinker twelve bottles in who has studied a fair bit. Their wines have
   opened their grapes and regions, the question banks Claude wrote for those (captured once, like the rest)
   are in, and they have answered a good share of each. A snapshot from five weeks ago, lower, gives the
   radar its dashed "where you were" outline. Done in this demo's own setup, after DemoPersona.reset(), so the
   other demos' stores (the Keep learning tiles, the Learn hub) are untouched. */
function _seedMastery() {
  try {
    Device.setMasteryView({ grapes: 'bunch', shape: 'chart' }); // the sketched bunches and the radar, not the lists
    const banks = _DEMO_CAPTURED.banks || {};
    Object.keys(banks).forEach((k) => Store.set(k, banks[k]));
    WineHistory.getAll().forEach((w) => { try { ScanFlow.unlockLearning({ ...w, confidence: 'high' }); } catch (e) { /* the rest still shows */ } });
    const answer = (setId, pool, n) => (pool || []).slice(0, n).forEach((q) => QuizMastery.recordAnswer(setId, q.q, true));
    [['Tempranillo', 13], ['Grenache', 9], ['Syrah', 8], ['Malbec', 6], ['Nebbiolo', 3]].forEach(([g, n]) => answer('grape:' + g, grapeQuizBank(g), n));
    [['Rioja', 14], ['Rhône Valley', 9], ['Mendoza', 7], ['Piedmont', 3]].forEach(([r, n]) => answer(RegionQuizBank.setId(r), RegionQuizBank.get(r), n));
    [['red_grapes', 14], ['white_grapes', 6], ['rose', 3], ['sparkling', 5]].forEach(([t, n]) => answer('topic:' + t, QuizMastery.topicPool(t), n));
    _loadJSON('data/onramp.json').slice(0, 4).forEach((a) => Store.set('vinterest_' + a.id + '_done', '1'));
    // Seven Blind Calls, close to each label's profile but calling the tannins a little grippier, so the palate
    // has a score, a bar per axis and a habit to show. The accuracy is worked out as the app does.
    const off = [[0.04, -0.06, 0.15], [-0.05, 0.05, 0.2], [0.08, 0.03, 0.12], [-0.03, -0.04, 0.17], [0.06, 0.07, 0.1], [0.02, -0.02, 0.18], [-0.06, 0.04, 0.14]];
    WineHistory.getAll().filter((w) => typeof w.body === 'number').slice(0, 7).forEach((w, i) => {
      const o = off[i], c = (v) => Math.max(0, Math.min(1, v));
      const guess = { body: c(w.body + o[0]), acidity: c(w.acidity + o[1]), tannins: c(w.tannins + o[2]) };
      const miss = ['body', 'acidity', 'tannins'].map((k) => Math.abs(guess[k] - w[k]));
      const accuracy = Math.max(0, 1 - (miss[0] + miss[1] + miss[2]) / 3 * 1.6);
      ScanFlow.saveBlindResult(w, { accuracy, amount: Math.round(accuracy * 40), guess });
    });
    const m = KnowledgeMap.compute(WineHistory.getAll()), then = Date.now() - 35 * 864e5, a = {};
    m.areas.forEach((x) => { a[x.id] = Math.round(x.score * 0.55); });
    Store.setJSON(KnowledgeMap.HISTORY_KEY, { [KnowledgeMap._week(then)]: { t: then, o: Math.round(m.overall * 0.55), a } });
    KnowledgeMap.note(m);
  } catch (e) { /* the demo still draws, with an emptier map */ }
}

/* The sample user has done some studying, so the Mastery map and the Learn tab look lived in: most of
   the red Wine Basics quiz and a few articles read. Done here, after every module has loaded, and
   folded into the seeded store (DemoPersona.rebase), so each demo's reset keeps it. */
(function seedStudy() {
  try {
    QuizMastery.topicPool('red_grapes').slice(0, 12).forEach((q) => QuizMastery.recordAnswer('topic:red_grapes', q.q, true));
    QuizMastery.topicPool('sparkling').slice(0, 4).forEach((q) => QuizMastery.recordAnswer('topic:sparkling', q.q, true));
    (ContentEngine.shelf(WineHistory.getAll()) || []).slice(0, 2).forEach((st) => LearnProgress.markArticle(st.id));
    DemoPersona.rebase();
  } catch (e) { /* the demos still work, with an emptier map */ }
})();

/* The article the Learn demo opens: the sample user's own "From Rioja to Rhône Valley" piece. Its text is
   what Claude wrote for it (captured), not something composed here. */
const _articleStub = () => ({ ...DemoPersona.slides.article, id: 'demo-article' });
/* The bottle whose details the My Wines demo opens: their best-loved Rioja. */
const _detailWine = () => WineHistory.getAll().find((w) => /Ardanza/i.test(w.name));

/* The wine list the dinner-table film scans: what Claude would read off a restaurant's list (name, type,
   region, price, main grape, and style as three digits for body, tannins and acidity, 1 to 9). The
   best match for the sample user, a classic Rioja Reserva, is first and inside their usual spend. */
const _FILM_LIST = [
  { name: 'Contino Reserva', type: 'red', region: 'Rioja', country: 'Spain', vintage: 2017, price: 'BOTTLE:44', grape: 'Tempranillo', style: '656' },
  { name: 'Barolo Serralunga', type: 'red', region: 'Piedmont', country: 'Italy', vintage: 2018, price: 'BOTTLE:78', grape: 'Nebbiolo', style: '887' },
  { name: 'Pouilly-Fuissé', type: 'white', region: 'Burgundy', country: 'France', vintage: 2021, price: 'BOTTLE:62', grape: 'Chardonnay', style: '616' },
  { name: 'Chianti Classico Riserva', type: 'red', region: 'Tuscany', country: 'Italy', vintage: 2019, price: 'BOTTLE:55', grape: 'Sangiovese', style: '677' },
  { name: 'Cloudy Bay Sauvignon Blanc', type: 'white', region: 'Marlborough', country: 'New Zealand', vintage: 2023, price: 'BOTTLE:49', grape: 'Sauvignon Blanc', style: '418' },
  { name: 'Châteauneuf-du-Pape', type: 'red', region: 'Rhône Valley', country: 'France', vintage: 2019, price: 'BOTTLE:84', grape: 'Grenache', style: '765' },
  { name: 'Champagne Brut', type: 'sparkling', region: 'Champagne', country: 'France', vintage: null, price: 'BOTTLE:95', grape: 'Chardonnay', style: '518' },
  { name: 'Pinot Noir', type: 'red', region: 'Burgundy', country: 'France', vintage: 2020, price: 'BOTTLE:72', grape: 'Pinot Noir', style: '667' },
  { name: 'Malbec Reserva', type: 'red', region: 'Mendoza', country: 'Argentina', vintage: 2020, price: 'BOTTLE:46', grape: 'Malbec', style: '865' },
  { name: 'Rosé de Provence', type: 'rosé', region: 'Provence', country: 'France', vintage: 2023, price: 'BOTTLE:42', grape: 'Grenache', style: '316' },
];
/* The scan result for that list's best match, as it opens when it's picked. */
function _filmResult() {
  DemoPersona.reset();
  const { style, grape, ...wine } = TasteMatch.fromListEntry(_FILM_LIST[0]);
  Handoff.openWine({ wine: { ...wine, confidence: 'high' }, source: 'camera', tracked: true, view: 'result' });
}

/* Which nav tab is lit under each screen, as in the app.
   A demo is one screen, or several stacked as `layers` (only one is shown at a time). `steps` say what
   each part of the demo (a caption) shows, from p = `at`: which layer, where it scrolls to (`to`: 'top', a
   selector, or text on the screen), whether it then reads on through the content (`drift`), and `do`
   what a visitor would tap or type there. */
const _DEMO_SCREENS = {
  scan: { nav: 'scan', Screen: ScanCardsScreen, view: 'result', stopAt: /^what next\?$/i },
  deck: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  rate: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  keep: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  // One part per caption, each scrolled to the section it talks about, then reading gently on.
  dna: { nav: 'profile', Screen: WineDNAScreen, steps: [
    { at: 0, to: 'top', drift: 0.3 },
    { at: 0.167, to: 'top', drift: 0.7 }, // the written summary's What You Love, under the profile
    { at: 0.333, to: '[data-section="taste"]', drift: 0.4 },
    { at: 0.5, to: '[data-section="value"]', drift: 0.3 },
    { at: 0.667, to: '[data-section="explore"]', drift: 0.3 },
    { at: 0.833, to: '[data-section="scripts"]', drift: 0.4 },
  ] },
  // WineDNA for the film (site/video/winedna-demo.html): red from the top down, then a tap on White and the same for it. One part per
  // beat; the film moves p to a part's `at` when its time comes.
  dnafilm: { nav: 'profile', Screen: WineDNAScreen, steps: [
    { at: 0, to: 'top', drift: 0.12, ms: 6000 },
    { at: 0.08, to: 'top', drift: 0.75, ms: 7500 },
    { at: 0.16, to: '[data-section="knows"]', drift: 0.3, ms: 7000 },
    { at: 0.24, to: '[data-section="house"]', drift: 0.3, ms: 6500 },
    { at: 0.32, to: '[data-section="taste"]', drift: 0.55, ms: 7500 },
    { at: 0.4, to: '[data-section="value"]', drift: 0.35, ms: 6500 },
    { at: 0.48, to: '[data-section="explore"]', drift: 0.45, ms: 7500 },
    { at: 0.56, to: '[data-section="scripts"]', drift: 0.35, ms: 7500 },
    { at: 0.64, to: 'top', drift: 0.1, ms: 6000, do: [{ tap: /^White$/ }] },
    { at: 0.72, to: 'top', drift: 0.75, ms: 7500 },
    { at: 0.8, to: '[data-section="taste"]', drift: 0.55, ms: 7500 },
    { at: 0.88, to: '[data-section="explore"]', drift: 0.45, ms: 7500 },
  ] },
  home: { nav: 'home', Screen: HomeScreen },
  // My Wines as the visitor's own rating left it: nothing is reset, so the bottle rated in the demo before is in the list (the film).
  after: { nav: 'mywines', Screen: MyWinesScreen, keepStore: true },
  wines: { nav: 'mywines', layers: [
    { id: 'list', Screen: MyWinesScreen },
    { id: 'detail', Screen: WineDetailScreen, setup() { Handoff.openWine({ wine: _detailWine(), source: 'history' }); } },
  ], steps: [
    { at: 0, layer: 'list', to: 'top', drift: 0.5, ms: 6000, do: [{ layer: 'list', input: ['input[placeholder^="Search"]', ''] }] },
    { at: 0.2, layer: 'list', to: 'top', do: [{ layer: 'list', type: ['input[placeholder^="Search"]', 'Rioja'] }] },
    { at: 0.4, layer: 'detail', to: 'top', drift: 0.9, ms: 9000, do: [{ layer: 'detail', tap: /^Details$/ }] },
    { at: 0.6, layer: 'detail', to: 'top', drift: 1.2, ms: 10000, do: [{ layer: 'detail', tap: /^Learn$/ }] },
    { at: 0.8, layer: 'detail', to: 'top', drift: 0.8, ms: 8000, do: [{ layer: 'detail', tap: /^Price$/ }] },
  ] },
  learn: { nav: 'learn', layers: [
    { id: 'hub', Screen: LearnScreen },
    { id: 'article', Screen: GenArticleScreen, setup() { Handoff.genArticle.set(_articleStub()); } },
  ], steps: [
    { at: 0, layer: 'hub', to: 'top', drift: 0.4, ms: 6000 },
    { at: 0.25, layer: 'hub', to: /^wine basics$/i, drift: 0.4, ms: 6000 },
    { at: 0.5, layer: 'hub', to: /^region quizzes$/i, drift: 0.5, ms: 6000 },
    { at: 0.75, layer: 'article', to: 'top', drift: 0.9, ms: 14000 },
  ] },
  // The dinner-table film (site/video): the scanned wine list sorted by match, the best match, and the
  // sommelier script. Driven from outside by update(p): 0 the list, .17 sorted by match, .34 the result, .67 the script.
  // The result comes first so its setup (which resets the store) runs before the list's.
  film: { nav: 'scan', layers: [
    { id: 'result', nav: 'scan', Screen: ScanCardsScreen, setup() { _filmResult(); } },
    { id: 'list', nav: 'scan', Screen: WineListScreen, setup() { Handoff.wineList.set({ demo: false, wines: _FILM_LIST, currency: 'GBP' }); } },
    { id: 'script', nav: 'profile', Screen: WineDNAScreen },
  ], steps: [
    { at: 0, layer: 'list', to: 'top' },
    { at: 0.17, layer: 'list', to: 'top', drift: 0.25, ms: 3000, do: [{ layer: 'list', tap: /Sort: Match Rate/ }] },
    { at: 0.34, layer: 'result', to: 'top', drift: 0.5, ms: 3800 },
    { at: 0.67, layer: 'script', to: '[data-section="scripts"]' },
  ] },
  // The Mastery section: the whole picture (overall and the radar), the grapes, the regions (the wine map)
  // and the palate. One layer only, so its setup can build the study history; the parts scroll and open.
  mastery: { nav: 'learn', layers: [
    { id: 'map', nav: 'learn', Screen: MasteryMapScreen, setup() { _seedMastery(); } },
  ], steps: [
    { at: 0, layer: 'map', to: 'top', drift: 0.5, ms: 7000 },
    { at: 0.25, layer: 'map', to: '[data-section="grapes"]', drift: 0.05, ms: 4000 },
    { at: 0.5, layer: 'map', to: '[data-section="map"]', drift: 0.05, ms: 4000 },
    { at: 0.75, layer: 'map', to: '[data-section="palate"]', drift: 0.05, ms: 4000 },
  ] },
  // The front page's carousel: one screen for each thing the app does.
  hero: { nav: 'scan', layers: [
    { id: 'scan', nav: 'scan', Screen: ScanCardsScreen, setup() { _openScan('result'); } },
    { id: 'dna', nav: 'profile', Screen: WineDNAScreen },
    { id: 'vinny', nav: 'home', Screen: _VinnyScreen },
    { id: 'article', nav: 'learn', Screen: GenArticleScreen, setup() { Handoff.genArticle.set(_articleStub()); } },
    { id: 'wines', nav: 'mywines', Screen: MyWinesScreen },
  ], steps: [
    { at: 0, layer: 'scan', to: 'top', drift: 0.4, ms: 6000 },
    { at: 0.2, layer: 'dna', to: 'top', drift: 0.5, ms: 7000 },
    { at: 0.4, layer: 'vinny', do: [{ vinny: true }] },
    { at: 0.6, layer: 'article', to: 'top', drift: 0.6, ms: 9000 },
    { at: 0.8, layer: 'wines', to: 'top', drift: 0.6, ms: 7000 },
  ] },
};

/* One layer of a demo: its screen, set up (what it reads from the handoff) just before it renders, and
   faded in when it's the one being shown. */
function _Layer({ l, active }) {
  React.useMemo(() => { if (l.setup) l.setup(); }, []);
  const S = l.Screen;
  return <div data-layer={l.id} style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: C.bg,
    opacity: active ? 1 : 0, visibility: active ? 'visible' : 'hidden', transition: `opacity .4s ease, visibility 0s linear ${active ? 0 : 0.4}s` }}>
    <S nav={_DEMO_NOOP} back={_DEMO_NOOP} showPro={_DEMO_NOOP} isTablet={false} />
  </div>;
}

function _DemoFrame({ kind, ctl }) {
  const d = _DEMO_SCREENS[kind];
  const Screen = d.Screen;
  const [layer, setLayer] = React.useState(ctl.layer);
  ctl.setLayer = (id) => { ctl.layer = id; setLayer(id); };
  const cur = d.layers && d.layers.find((l) => l.id === layer);
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.P, position: 'relative' }}>
    {/* Where the app's full-screen overlays (the Blind Call result) are drawn, so they cover the phone, not the page. */}
    <div data-portal style={{ position: 'absolute', inset: 0, transform: 'translateZ(0)', pointerEvents: 'none', zIndex: 60 }} />
    {d.layers
      ? <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{d.layers.map((l) => <_Layer key={l.id} l={l} active={layer === l.id} />)}</div>
      : <Screen nav={_DEMO_NOOP} back={_DEMO_NOOP} showPro={_DEMO_NOOP} isTablet={false} />}
    <BottomNav active={(cur && cur.nav) || d.nav} nav={_DEMO_NOOP} showPro={_DEMO_NOOP} />
  </div>;
}

/* Ask Vinny's box as the app draws it: the text follows the cursor, so a long question shows its
   end, not its start, as it's typed. */
function _VinnyField({ text, placeholder, caret, dim }) {
  const box = React.useRef(null), txt = React.useRef(null);
  React.useLayoutEffect(() => {
    if (box.current && txt.current) txt.current.style.transform = 'translateX(' + Math.min(0, box.current.clientWidth - txt.current.offsetWidth - 2) + 'px)';
  });
  return <div ref={box} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
    <style>{'@keyframes vcaret{0%,55%{opacity:1}56%,100%{opacity:0}}'}</style>
    <span ref={txt} style={{ display: 'inline-flex', alignItems: 'center', flex: 'none', fontSize: 16, fontFamily: C.P, whiteSpace: 'nowrap', color: text ? '#fff' : dim }}>
      {text || placeholder}
      {caret && <i style={{ width: 1.5, height: 19, marginLeft: 1, background: '#fff', animation: 'vcaret 1s steps(1) infinite' }} />}
    </span>
  </div>;
}

/* Vinny, as on Home: the real Home screen faded behind the real Ask Vinny bar (VinnyBar) and answer
   card (VinnyAnswers). The question types into the bar, it sends, "Thinking…", and the answer types
   out, all from p, so going back untypes it. The text is what Vinny really answered for this user
   (data/onboarding-sample.json, captured by npm run sample:onboarding). All of it is laid out from
   the start, invisible, so nothing moves or grows while it plays. */
const _VINNY_AT = { qEnd: 0.28, send: 0.34, answer: 0.44, end: 0.9 };
function _VinnyDemo({ ctl, bare }) {
  const [p, setP] = React.useState(ctl.p);
  React.useEffect(() => { ctl.set = setP; return () => { ctl.set = null; }; }, []);
  const v = DemoPersona.slides.vinny[0], T = _VINNY_AT;
  const span = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const sent = p >= T.send, thinking = sent && p < T.answer;
  const typedQ = sent ? '' : v.q.slice(0, Math.floor(span(0.02, T.qEnd) * v.q.length));
  const nA = Math.floor(span(T.answer, T.end) * v.a.length);
  const field = <_VinnyField text={typedQ} placeholder={sent ? 'Ask a follow-up…' : 'Ask Vinny about wine…'} caret={!!typedQ && !sent} dim="rgba(255,255,255,0.5)" />;
  const full = <span style={{ opacity: 0 }}>{v.a}</span>;
  const a = !sent ? full
    : thinking ? <span style={{ position: 'relative', display: 'block' }}>{full}<span style={{ position: 'absolute', left: 0, top: 0, fontSize: 15, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)' }}>Thinking…</span></span>
    : <>{v.a.slice(0, nA)}<span style={{ opacity: 0 }}>{v.a.slice(nA)}</span></>;
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.P }}>
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', opacity: 0.32, filter: 'blur(1px)' }}>
        <HomeScreen nav={_DEMO_NOOP} back={_DEMO_NOOP} showPro={_DEMO_NOOP} isTablet={false} />
      </div>
      <div style={{ position: 'relative', padding: '62px 16px 0' }}>
        <VinnyBar field={field} hasText={!!typedQ} canSend={false} lit={!!typedQ && !sent} />
        <div style={{ opacity: sent ? 1 : 0, transform: sent ? 'none' : 'translateY(6px)', transition: 'opacity .35s, transform .35s' }}>
          <VinnyAnswers turns={[{ q: v.q, a }]} />
        </div>
      </div>
    </div>
    {!bare && <BottomNav active="home" nav={_DEMO_NOOP} showPro={_DEMO_NOOP} />}
  </div>;
}
/* Vinny as one layer of the front page's carousel (its bottom bar is the frame's). */
const _heroVinny = { set: null, p: 0 };
function _VinnyScreen() { return <_VinnyDemo ctl={_heroVinny} bare />; }

const VinterestDemo = {
  /* Draws the demo into el (a 390 x 844 box) and returns { update(p), unmount() }. */
  mount(el, kind) {
    if (kind === 'vinny') {
      DemoPersona.reset();
      const ctl = { set: null, p: 0 }, root = ReactDOM.createRoot(el);
      root.render(<_VinnyDemo ctl={ctl} />);
      return { update(p) { ctl.p = p; if (ctl.set) ctl.set(p); }, unmount() { root.unmount(); } };
    }
    const d = _DEMO_SCREENS[kind];
    if (!d) throw new Error('Unknown demo: ' + kind);
    const isScan = d.Screen === ScanCardsScreen;
    let gen = 0, cancel = () => {};
    const ctl = { layer: d.layers ? d.layers[0].id : null, setLayer: null };
    const root = ReactDOM.createRoot(el);
    const draw = () => {
      gen++;
      cancel();
      if (isScan) _openScan(d.view, kind === 'keep'); else if (!d.keepStore) DemoPersona.reset();
      // Rendered right now, not on React's schedule: the scan screen reads the handoff as it opens, and
      // another demo mounting in the meantime would have changed it.
      ReactDOM.flushSync(() => root.render(<_DemoFrame key={gen} kind={kind} ctl={ctl} />));
      // The rating and keep-learning demos begin on the deck's last card, the rating card.
      if (kind === 'rate' || kind === 'keep') cancel = _until(() => { const dots = _deckDots(el); if (!dots || dots.length < _DECK_CARDS) return false; dots[_DECK_CARDS - 1].click(); return true; });
    };
    draw();

    let lastP = 0;
    /* Scroller demos: glide the screen's scroller to p of the way down (or to just above stopAt). */
    let scroller = null, stopEl = null;
    const glide = _glider(() => scroller);
    const findScroller = (within) => { if (!scroller || !scroller.isConnected || within) scroller = _demoScroller(within || el); return scroller; };
    const scrollEnd = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (!d.stopAt) return max;
      if (!stopEl || !stopEl.isConnected) stopEl = _findText(el, d.stopAt);
      if (!stopEl) return max;
      const top = stopEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      return Math.max(1, Math.min(max, top - scroller.clientHeight * 0.55));
    };
    const scrollTo = (f, within) => { if (findScroller(within)) glide.to(f * scrollEnd()); };

    /* Things a visitor would tap, done at a point in p and undone going back: each keeps trying
       until the control is on screen. */
    const acts = [];
    if (kind === 'scan') acts.push({ at: 0.5, text: /^Why \d+%\?/, on: false, busy: false });
    const runActs = (p) => acts.forEach((a) => {
      const want = p >= a.at;
      if (want === a.on || a.busy) return;
      a.busy = true;
      _until(() => {
        if (!_tapText(el, a.text)) return false;
        a.on = want; a.busy = false;
        // Opening or closing something changes how long the screen is, so where p of the way down (or
        // "the end") is has moved: work it out again once it has settled.
        [150, 500].forEach((ms) => setTimeout(() => scrollTo(lastP), ms));
        return true;
      }, 30);
      setTimeout(() => { a.busy = false; }, 4000);
    });

    /* Stepped demos (d.steps): one part per caption. Entering a part shows its layer, does what a
       visitor would there (tap a tab, type a search), goes to what the part is about, and then reads
       gently on for `drift` screen-heights over `ms` (never through the whole screen). Nothing moves
       on its own between parts: a part is left only when the reader picks another. */
    const layerEl = (id) => (id && el.querySelector('[data-layer="' + id + '"]')) || el;
    const scrollers = {};
    const scrollerFor = (id) => {
      const c = scrollers[id || ''];
      if (c && c.isConnected && c.clientHeight > 0) return c;
      return (scrollers[id || ''] = _demoScroller(layerEl(id)));
    };
    const topOf = (root, sc, to) => {
      if (!to || to === 'top') return 0;
      const target = typeof to === 'string' ? root.querySelector(to) : _findText(root, to);
      if (!target) return null;
      return Math.max(0, target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 10);
    };
    let stepAt = -1, live = [], driftRaf = 0;
    const stopAll = () => { live.splice(0).forEach((f) => f()); cancelAnimationFrame(driftRaf); driftRaf = 0; glide.stop(); };
    const later = (fn, ms) => { const t = setTimeout(fn, ms); live.push(() => clearTimeout(t)); };
    const typeInto = (root, sel, text) => {
      live.push(_until(() => {
        const i = root.querySelector(sel);
        if (!i) return false;
        if (i.value) _setInput(i, '');
        for (let n = 1; n <= text.length; n++) later(() => { const j = root.querySelector(sel); if (j) _setInput(j, text.slice(0, n)); }, 500 + n * 260);
        return true;
      }, 40));
    };
    const enterStep = (k) => {
      const st = d.steps[k];
      stopAll();
      stepAt = k;
      if (ctl.setLayer && st.layer) ctl.setLayer(st.layer);
      (st.do || []).forEach((a) => {
        const root = layerEl(a.layer);
        if (a.type) typeInto(root, a.type[0], a.type[1]);
        else if (a.open) [].concat(a.open).forEach((sel) => live.push(_until(() => { const t = root.querySelector(sel + ' [role="button"]'); if (!t) return false; t.click(); return true; }, 40)));
        else if (a.vinny) {
          const t0 = performance.now(), MS = 9000;
          const go = (now) => { const q = Math.min(1, (now - t0) / MS) * 0.92; _heroVinny.p = q; if (_heroVinny.set) _heroVinny.set(q); if (q < 0.92) driftRaf = requestAnimationFrame(go); };
          _heroVinny.p = 0; if (_heroVinny.set) _heroVinny.set(0);
          driftRaf = requestAnimationFrame(go);
        } else live.push(_until(() => {
          if (a.tap) return _tapText(root, a.tap);
          const i = root.querySelector(a.input[0]);
          if (!i) return false;
          if (i.value !== a.input[1]) _setInput(i, a.input[1]);
          return true;
        }, 40));
      });
      const top = () => { const sc = scrollerFor(st.layer); return sc ? { sc, y: Math.min(Math.max(0, sc.scrollHeight - sc.clientHeight), topOf(layerEl(st.layer), sc, st.to) ?? 0) } : null; };
      // Screens fill in and sections open a moment after they appear: go to the part, and again once settled.
      [350, 1100].forEach((ms) => later(() => { const t = top(); if (t) { scroller = t.sc; glide.to(t.y); } }, ms));
      if (st.drift) later(() => {
        const t = top();
        if (!t) return;
        glide.stop();
        const from = t.y, max = Math.max(0, t.sc.scrollHeight - t.sc.clientHeight), to = Math.min(max, from + st.drift * t.sc.clientHeight), ms = st.ms || 8000, t0 = performance.now();
        t.sc.scrollTop = from;
        const go = (now) => { const q = Math.min(1, (now - t0) / ms); t.sc.scrollTop = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * q)); if (q < 1) driftRaf = requestAnimationFrame(go); };
        driftRaf = requestAnimationFrame(go);
      }, 1800);
    };
    const place = (p) => {
      const k = d.steps.reduce((a, st, i) => (p >= st.at - 1e-6 ? i : a), 0);
      if (k !== stepAt) enterStep(k);
    };

    let deckAt = -1, cancelGo = () => {};
    /* The Blind Call, played on the taste card: open it, slide Body, Acidity and Tannins to a guess, lock it
       in, see how the call compares with the wine, then the score and the XP it earns (the app's own
       maths). Driven by b, 0 to 1 across the part; going back to the start plays it again. */
    let blindOpened = false, lastBlindP = 0, bLocked = false, bScored = false, bRevealed = false;
    const resetBlind = () => { blindOpened = bLocked = bScored = bRevealed = false; lastBlindP = 0; window.__demoPortal = null; };
    const BLIND_GUESS = { Body: 58, Acidity: 55, Tannins: 74 };
    const driveBlind = (b) => {
      lastBlindP = BLIND_AT + b * (BLIND_END - BLIND_AT);
      window.__demoPortal = el.querySelector('[data-portal]');
      if (!blindOpened && b >= 0.02) { blindOpened = true; _until(() => _tapText(el, /Play Blind Call/), 40); }
      [['Body', 0.08, 0.28], ['Acidity', 0.28, 0.48], ['Tannins', 0.48, 0.68]].forEach(([name, a, z]) => {
        const sl = el.querySelector('[role="slider"][aria-label="' + name + '"]');
        if (!sl || b < a) return;
        const now = Math.round(50 + (BLIND_GUESS[name] - 50) * _ease((b - a) / (z - a)));
        if (_scoreNow(sl) !== now) _setScore(sl, now);
      });
      if (!bLocked && b >= 0.7) { bLocked = true; _until(() => _tapText(el, /^Lock in my call$/), 40); }
      if (!bScored && b >= 0.84) { bScored = true; _until(() => _tapText(el, /^See my score$/), 40); }
    };
    let saved = false, rated = false, learned = false, boughtAgain = false, paid = false, where = false;
    const api = {
      update(p) {
        lastP = p;
        const update = (q) => api.update(q);
        if (d.steps) { place(p); return; }
        if (kind === 'scan') { runActs(p); scrollTo(p); return; }
        if (kind === 'deck') {
          // Turn the deck to the card p is up to, and read down a long one while it's there. The Blind Call
          // part (p from 0.75) plays on the taste card, whose own number it isn't.
          const blind = p >= BLIND_AT && p < BLIND_END;
          const i = blind ? 5 : Math.min(_DECK_CARDS - 1, Math.floor(p * _DECK_CARDS + 1e-6)), within = p * _DECK_CARDS - i;
          if (blind && blindOpened && p < lastBlindP - 0.002) { resetBlind(); draw(); deckAt = -1; }  // chosen again: play it from the start
          if (i !== deckAt) {
            deckAt = i; scroller = null;
            cancelGo();
            cancelGo = _until(() => { const dots = _deckDots(el); if (!dots || !dots[i]) return false; dots[i].click(); return true; }, 40);
          }
          if (blind) { lastBlindP = p; driveBlind((p - BLIND_AT) / (BLIND_END - BLIND_AT)); return; }
          if (blindOpened && p < BLIND_AT) { resetBlind(); draw(); deckAt = -1; update(p); return; }
          const top = _topCard(el);
          if (top) { const sc = _demoScroller(top); if (sc) { scroller = sc; glide.to(_ease((within - 0.15) / 0.75) * (sc.scrollHeight - sc.clientHeight)); } }
          return;
        }
        if (kind === 'rate') {
          // Slide the rating up to a 92, save it, then read down what it asks next. Going back to the
          // start (or choosing that part again) starts the rating over, so the slider plays again.
          const slider0 = _scoreSlider(el);
          if ((saved && p < 0.42) || (!saved && p < 0.05 && slider0 && _scoreNow(slider0) > 0)) {
            saved = false; rated = false; boughtAgain = paid = where = false; scroller = null; draw(); return;
          }
          const slider = _scoreSlider(el);
          if (!saved && slider) {
            const s = p < 0.05 ? 0 : Math.round(70 + (_RATE_TO - 70) * _ease((p - 0.05) / 0.4));
            const now = p >= 0.45 ? _RATE_TO : s;
            if (now && _scoreNow(slider) !== now) _setScore(slider, now);
          }
          if (p >= 0.5 && !saved && !rated) { rated = true; _until(() => { if (_tapText(el, /^Save rating$/)) { saved = true; return true; } return false; }, 30); }
          if (saved) {
            // The three quick answers it asks for: buy again, what you paid, where you had it.
            if (p >= 0.74 && !boughtAgain) { boughtAgain = true; _until(() => _tapText(el, /^I'd buy this again/), 20); }
            if (p >= 0.82 && !paid) { paid = true; _until(() => { const i = el.querySelector('input[aria-label="What you paid"]'); if (!i) return false; _setInput(i, '30'); return true; }, 20); }
            if (p >= 0.9 && !where) { where = true; _until(() => { const i = el.querySelector('input[aria-label="Where did you have it"]'); if (!i) return false; _setInput(i, "At a friend's dinner"); return true; }, 20); }
            const top = _topCard(el);
            if (top) { const sc = _demoScroller(top); if (sc) { scroller = sc; glide.to(_ease((p - 0.55) / 0.42) * (sc.scrollHeight - sc.clientHeight)); } }
          }
          return;
        }
        if (kind === 'keep') {
          // Rate it, save it and open "what's next" (what a visitor does), then read down the options.
          if (!learned) {
            learned = true;
            _until(() => {
              const slider = _scoreSlider(el);
              if (!slider) return false;
              _setScore(slider, _RATE_TO);
              setTimeout(() => _until(() => { if (!_tapText(el, /^Save rating$/)) return false; setTimeout(() => _until(() => {
                // Another demo mounting puts the store back as seeded, which would undo this scan's
                // unlocks; make sure they're there as the options are worked out.
                ScanFlow.unlockLearning({ ...DemoPersona.user.scanned, confidence: 'high' });
                return _tapText(el, /^Finished: what/);
              }, 30), 250); return true; }, 30), 200);
              return true;
            }, 60);
          }
          const top = _topCard(el);
          if (top) { const sc = _demoScroller(top); if (sc) { scroller = sc; glide.to(_ease(p) * (sc.scrollHeight - sc.clientHeight)); } }
          return;
        }
        scrollTo(p);
      },
      replay() { stepAt = -1; },
      unmount() { cancel(); cancelGo(); glide.stop(); if (d.steps) stopAll(); root.unmount(); },
    };
    return api;
  },
};
window.VinterestDemo = VinterestDemo;
