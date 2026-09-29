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
    s.scrollTop += d * 0.16;
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

/* Which nav tab is lit under each screen, as in the app. */
const _DEMO_SCREENS = {
  scan: { nav: 'scan', Screen: ScanCardsScreen, view: 'result', stopAt: /^what next\?$/i },
  deck: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  rate: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  keep: { nav: 'scan', Screen: ScanCardsScreen, view: 'deck' },
  // The scroll stops above the Data Backup card: the rest of Profile-style admin isn't the pitch.
  dna: { nav: 'profile', Screen: WineDNAScreen, stopAt: /^Data Backup$/i },
  home: { nav: 'home', Screen: HomeScreen },
  wines: { nav: 'mywines', Screen: MyWinesScreen },
  learn: { nav: 'learn', Screen: LearnScreen },
};

function _DemoFrame({ kind }) {
  const d = _DEMO_SCREENS[kind];
  const { Screen } = d;
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: C.P }}>
    <Screen nav={_DEMO_NOOP} back={_DEMO_NOOP} showPro={_DEMO_NOOP} isTablet={false} />
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
    const root = ReactDOM.createRoot(el);
    const draw = () => {
      gen++;
      cancel();
      if (isScan) _openScan(d.view, kind === 'keep'); else DemoPersona.reset();
      // Rendered right now, not on React's schedule: the scan screen reads the handoff as it opens, and
      // another demo mounting in the meantime would have changed it.
      ReactDOM.flushSync(() => root.render(<_DemoFrame key={gen} kind={kind} />));
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
      _until(() => { if (_tapText(el, a.text)) { a.on = want; a.busy = false; return true; } return false; }, 30);
      setTimeout(() => { a.busy = false; }, 4000);
    });

    let deckAt = -1;
    let saved = false, rated = false, learned = false, boughtAgain = false;
    return {
      update(p) {
        lastP = p;
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
          // Slide the score up to a 92, save it, then read down what it asks next.
          if (saved && p < 0.42) { saved = false; rated = false; boughtAgain = false; scroller = null; draw(); return; }
          const input = el.querySelector('input[type=range]');
          if (!saved && input) {
            const s = p < 0.05 ? 0 : Math.round(70 + (_RATE_TO - 70) * _ease((p - 0.05) / 0.4));
            const now = p >= 0.45 ? _RATE_TO : s;
            if (now && Number(input.value) !== now) _setInput(input, now);
          }
          if (p >= 0.5 && !saved && !rated) { rated = true; _until(() => { if (_tapText(el, /^Save rating$/)) { saved = true; return true; } return false; }, 30); }
          if (saved) {
            if (p >= 0.74 && !boughtAgain) { boughtAgain = true; _until(() => _tapText(el, /^I'd buy this again/), 20); }
            const top = _topCard(el);
            if (top) { const sc = _demoScroller(top); if (sc) { scroller = sc; glide.to(_ease((p - 0.55) / 0.42) * (sc.scrollHeight - sc.clientHeight)); } }
          }
          return;
        }
        if (kind === 'keep') {
          // Score it, save it and open "what's next" (what a visitor does), then read down the options.
          if (!learned) {
            learned = true;
            _until(() => {
              const input = el.querySelector('input[type=range]');
              if (!input) return false;
              _setInput(input, _RATE_TO);
              setTimeout(() => _until(() => { if (!_tapText(el, /^Save rating$/)) return false; setTimeout(() => _until(() => _tapText(el, /^Done: what/), 30), 250); return true; }, 30), 200);
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
