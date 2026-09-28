/* Vinterest website — the demo screens.

   Each demo is one of the app's real screens (WineDNAScreen, HomeScreen, MyWinesScreen…) drawn in a
   phone frame from the memory-only store in store.js, so what the page shows is what the app does,
   and it can't drift from it. site.js calls VinterestDemo.mount(el, kind) when a phone nears the
   viewport and update(p) as the visitor scrolls (p: 0 to 1 through that section). A demo never
   takes a tap: the frame is pointer-events:none and inert, and nothing here calls the network.

   Most demos are "the screen, scrolled": update(p) moves the screen's own scroll container, so the
   page scroll drives a real scroll through a real screen. The Vinny demo types a question and
   answer instead, from what Vinny really said (data/onboarding-sample.json). */

const _DEMO_NOOP = () => {};

/* The demos never call Claude. Where a real screen asks for text (the WineDNA summary, the
   sommelier script), it gets what Claude really wrote for the sample user, captured once by
   `npm run site:capture` into captured.json, like the onboarding slides' Vinny answer. Anything
   not captured rejects, and the screen shows what it shows when Claude can't be reached. */
const _DEMO_CAPTURED = _loadJSON('site/demo/captured.json');
window.claude = {
  complete(arg) {
    const purpose = arg && arg.purpose, prompt = String((arg && arg.messages && arg.messages[0] && arg.messages[0].content) || '');
    if (window.__demoCapture) return Promise.resolve(window.__demoCapture(purpose, prompt)); // site-capture.mjs
    const a = _DEMO_CAPTURED.answers || {};
    const text = purpose === 'winedna_summary' ? a.winedna_summary
      : purpose === 'sommelier_script' ? (/^Condense/.test(prompt) ? a.sommelier_short : a.sommelier_long) : null;
    return text ? Promise.resolve(text) : Promise.reject(new Error('The website demos make no calls'));
  },
};

/* The screen's own vertical scroller: the tallest overflowing element inside it. Looked up again on
   each call until found, because screens fill in after their first paint. */
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

/* Which nav tab is lit under each screen, as in the app. */
const _DEMO_SCREENS = {
  scan: {
    nav: 'scan',
    setup() {
      // The bottle in the camera: the sample user's next scan. `tracked` keeps the scan from being
      // saved into the demo user's wines, so the other demos never change.
      Handoff.openWine({ wine: { ...DemoPersona.user.scanned, confidence: 'high' }, source: 'camera', tracked: true });
    },
    Screen: ScanCardsScreen,
    // Things a visitor would tap, done for them at a point in the scroll (and undone scrolling back):
    // open "Why 87%?" so its working scrolls past.
    actions: [{ at: 0.4, text: /^Why \d+%\?/ }],
  },
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
   out, all from p (the scroll position), so scrolling back untypes it. The text is what Vinny really
   answered for this user (data/onboarding-sample.json, captured by npm run sample:onboarding). All of
   it is laid out from the start, invisible, so nothing moves or grows while it plays. */
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
      const ctl = { set: null, p: 0 }, root = ReactDOM.createRoot(el);
      root.render(<_VinnyDemo ctl={ctl} />);
      return { update(p) { ctl.p = p; if (ctl.set) ctl.set(p); }, unmount() { root.unmount(); } };
    }
    const d = _DEMO_SCREENS[kind];
    if (!d) throw new Error('Unknown demo: ' + kind);
    if (d.setup) d.setup();
    const root = ReactDOM.createRoot(el);
    root.render(<_DemoFrame kind={kind} />);
    let scroller = null, last = -1;
    const acts = (d.actions || []).map((a) => ({ ...a, on: false }));
    // A tap on the first element whose own text matches, as a finger would (the click bubbles to the handler).
    const tap = (re) => {
      const hit = Array.from(el.querySelectorAll('*')).find((n) => re.test(Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim()));
      if (hit) hit.click();
      return !!hit;
    };
    // Where the scroll ends: the bottom of the screen, or just above the element named by stopAt.
    let stopEl = null;
    const scrollEnd = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      if (!d.stopAt) return max;
      if (!stopEl || !stopEl.isConnected) stopEl = Array.from(el.querySelectorAll('*')).find((n) => d.stopAt.test(Array.from(n.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent).join('').trim()));
      if (!stopEl) return max;
      const top = stopEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      return Math.max(1, Math.min(max, top - scroller.clientHeight * 0.55));
    };
    return {
      update(p) {
        acts.forEach((a) => { const want = p >= a.at; if (want !== a.on && tap(a.text)) a.on = want; });
        if (!scroller || !scroller.isConnected) scroller = _demoScroller(el);
        if (!scroller || Math.abs(p - last) < 0.0005) return;
        last = p;
        scroller.scrollTop = p * scrollEnd();
      },
      unmount() { root.unmount(); },
    };
  },
};
window.VinterestDemo = VinterestDemo;
