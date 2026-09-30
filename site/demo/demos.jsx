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
  // One part per caption, each scrolled to the section it talks about.
  dna: { nav: 'profile', Screen: WineDNAScreen, steps: [
    { at: 0, to: 'top' },
    { at: 0.167, to: '[data-section="love"]' },
    { at: 0.333, to: '[data-section="taste"]' },
    { at: 0.5, to: '[data-section="value"]' },
    { at: 0.667, to: '[data-section="explore"]' },
    { at: 0.833, to: '[data-section="scripts"]' },
  ] },
  home: { nav: 'home', Screen: HomeScreen },
  wines: { nav: 'mywines', layers: [
    { id: 'list', Screen: MyWinesScreen },
    { id: 'detail', Screen: WineDetailScreen, setup() { Handoff.openWine({ wine: _detailWine(), source: 'history' }); } },
  ], steps: [
    { at: 0, layer: 'list', to: 'top', drift: 'all', do: [{ layer: 'list', input: ['input[placeholder^="Search"]', ''] }] },
    { at: 0.2, layer: 'list', to: 'top', do: [{ layer: 'list', input: ['input[placeholder^="Search"]', 'Rioja'] }] },
    { at: 0.4, layer: 'detail', to: 'top', drift: 'all', do: [{ layer: 'detail', tap: /^Details$/ }] },
    { at: 0.6, layer: 'detail', to: 'top', drift: 'all', do: [{ layer: 'detail', tap: /^Learn$/ }] },
    { at: 0.8, layer: 'detail', to: 'top', drift: 'all', do: [{ layer: 'detail', tap: /^Price$/ }] },
  ] },
  learn: { nav: 'learn', layers: [
    { id: 'hub', Screen: LearnScreen },
    { id: 'article', Screen: GenArticleScreen, setup() { Handoff.genArticle.set(_articleStub()); } },
    { id: 'mastery', Screen: MasteryMapScreen },
  ], steps: [
    { at: 0, layer: 'hub', to: 'top' },
    { at: 0.2, layer: 'hub', to: /^wine basics$/i },
    { at: 0.4, layer: 'hub', to: /^region quizzes$/i, drift: 'all' },
    { at: 0.6, layer: 'article', to: 'top', drift: 'all' },
    { at: 0.8, layer: 'mastery', to: 'top', drift: 'all' },
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
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.P }}>
    {d.layers
      ? <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{d.layers.map((l) => <_Layer key={l.id} l={l} active={layer === l.id} />)}</div>
      : <Screen nav={_DEMO_NOOP} back={_DEMO_NOOP} showPro={_DEMO_NOOP} isTablet={false} />}
    <BottomNav active={d.nav} nav={_DEMO_NOOP} showPro={_DEMO_NOOP} />
  </div>;
}

/* Vinny, as on Home: the real Home screen faded behind the real Ask Vinny bar (VinnyBar) and answer
   card (VinnyAnswers). The question types into the bar, it sends, "Thinking…", and the answer types
   out, all from p, so going back untypes it. The text is what Vinny really answered for this user
   (data/onboarding-sample.json, captured by npm run sample:onboarding). All of it is laid out from
   the start, invisible, so nothing moves or grows while it plays. */
const _VINNY_AT = { qEnd: 0.28, send: 0.34, answer: 0.44, end: 0.9 };
function _VinnyDemo({ ctl }) {
  const [p, setP] = React.useState(ctl.p);
  React.useEffect(() => { ctl.set = setP; return () => { ctl.set = null; }; }, []);
  const v = DemoPersona.slides.vinny[0], T = _VINNY_AT;
  const span = (a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const sent = p >= T.send, thinking = sent && p < T.answer;
  const typedQ = sent ? '' : v.q.slice(0, Math.floor(span(0.02, T.qEnd) * v.q.length));
  const nA = Math.floor(span(T.answer, T.end) * v.a.length);
  const dim = 'rgba(255,255,255,0.5)';
  const field = <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
    <span style={{ fontSize: 16, fontFamily: C.P, color: typedQ ? '#fff' : dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {typedQ || (sent ? 'Ask a follow-up…' : 'Ask Vinny about wine…')}
    </span>
  </div>;
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
    <BottomNav active="home" nav={_DEMO_NOOP} showPro={_DEMO_NOOP} />
  </div>;
}

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
      if (isScan) _openScan(d.view, kind === 'keep'); else DemoPersona.reset();
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

    /* Stepped demos (d.steps): one part per caption. Entering a part shows its layer and does what a
       visitor would there; the scroll goes to what the part is about, then reads on through it. */
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
    let stepAt = -1;
    const place = (p) => {
      const steps = d.steps, k = steps.reduce((a, st, i) => (p >= st.at - 1e-6 ? i : a), 0), st = steps[k], next = steps[k + 1];
      const within = _clamp01(((p - st.at) / ((next ? next.at : 1) - st.at)));
      if (k !== stepAt) {
        stepAt = k;
        if (ctl.setLayer && st.layer) ctl.setLayer(st.layer);
        // Text arrives and sections open a moment after a screen mounts, moving where things are.
        [400, 1200, 2500].forEach((ms) => setTimeout(() => { if (stepAt === k) place(lastP); }, ms));
        (st.do || []).forEach((a) => _until(() => {
          const root = layerEl(a.layer);
          if (a.tap) { if (!_tapText(root, a.tap)) return false; }
          else if (a.input) { const i = root.querySelector(a.input[0]); if (!i) return false; if (i.value !== a.input[1]) _setInput(i, a.input[1]); }
          // What was tapped or typed changes how long the screen is: place the scroll again once it settles.
          [200, 700].forEach((ms) => setTimeout(() => place(lastP), ms));
          return true;
        }, 40));
      }
      const sc = scrollerFor(st.layer);
      if (!sc) return;
      scroller = sc;
      const max = Math.max(0, sc.scrollHeight - sc.clientHeight), root = layerEl(st.layer);
      const top = Math.min(max, topOf(root, sc, st.to) ?? 0);
      let target = top;
      if (st.drift === 'all') target = top + (max - top) * _ease((within - 0.15) / 0.75);
      else {
        // Read on a little through this part, but never past where the next one starts.
        const nextTop = next && next.layer === st.layer ? topOf(root, sc, next.to) : null;
        const room = Math.max(0, Math.min((nextTop == null ? max : nextTop) - top - 30, sc.clientHeight * 0.6, max - top));
        target = top + room * _ease((within - 0.3) / 0.6);
      }
      glide.to(Math.max(0, Math.min(max, target)));
    };

    let deckAt = -1;
    let saved = false, rated = false, learned = false, boughtAgain = false, paid = false, where = false;
    return {
      update(p) {
        lastP = p;
        if (d.steps) { place(p); return; }
        if (kind === 'scan') { runActs(p); scrollTo(p); return; }
        if (kind === 'deck') {
          // Turn the deck to the card p is up to, and read down a long one while it's there.
          const i = Math.min(_DECK_CARDS - 1, Math.floor(p * _DECK_CARDS + 1e-6)), within = p * _DECK_CARDS - i;
          if (i !== deckAt) { const dots = _deckDots(el); if (dots && dots[i]) { dots[i].click(); deckAt = i; scroller = null; } }
          const top = _topCard(el);
          if (top) { const sc = _demoScroller(top); if (sc) { scroller = sc; glide.to(_ease((within - 0.3) / 0.55) * (sc.scrollHeight - sc.clientHeight)); } }
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
      unmount() { cancel(); glide.stop(); root.unmount(); },
    };
  },
};
window.VinterestDemo = VinterestDemo;
