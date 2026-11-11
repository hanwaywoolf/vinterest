/* Vinterest Teams website: a phone that runs the real app.

   TeamsLive.mount(el, {who}) draws the Teams app (TeamApp, the same shell the staff use) inside el at a phone's
   size, scaled to fit, on the demo restaurant, and plays it without a visitor touching anything: Today, the daily
   drill answered question by question (one answer wrong, since that is where the app teaches), the summary with
   readiness before and after, back to Today. Then the restaurant is put back as seeded and it plays again. Nothing
   here is a picture: a change to the drill in the app is a change on the website at the next build.

   The answers come from the app itself: TeamLearn.deal is watched for the questions a drill deals, so the right
   option is the one the app will mark right. It pauses while off screen (or while opts.active() is false, for a
   phone in a carousel; opts.onLoop is called as each run ends). One phone a page: they share one restaurant; taps show as a dot. No network: the
   drill marks its own answers, and the demo restaurant's training ships in the bundle. */
const TeamsLive = (() => {
  const W = 390, H = 844;
  let dealt = [];
  const deal0 = TeamLearn.deal;
  TeamLearn.deal = function (q, n) { const d = deal0.call(this, q, n); dealt.push(d); return d; };

  function seed(who) {
    TeamsLiveStore.clear();
    Store.set(Device.FORCE_MOBILE_KEY, '1'); // the phone layout, whatever the page's width
    TeamSample.load('demo');
    const p = TeamLearn.people().find((x) => String(x.name).split(' ')[0] === who) || TeamLearn.people().find((x) => !TeamLearn.canConsole(x));
    if (p) TeamLearn.setMe(p.id);
  }

  // The page's phone (one a page), kept so trying it by hand can stop it and start it again afterwards.
  let last = null, full = null;
  // Change restaurant leads to restaurants this bundle doesn't carry, so the app is told it's at the demo's own address.
  TeamSample.hostSeed = () => 'demo';

  /* The same app, full screen and theirs to use: the playing phone stops, the restaurant is put back as seeded
     for the same person, and the app is drawn at its real size under a bar with Close. Closing (the button, Esc
     or the phone's Back) starts the page's phone playing again. */
  /* What to explore, beside the phone on a wide screen and as a sheet over it on a narrow one (opened once on arrival,
     then from "What to try" in the bar). Only what runs here: Ask Vinny and the guest at the table need the server,
     which the website's own address can't call, so the guide sends people to the full demo for those. */
  const GUIDE = '<aside class="live-guide" aria-label="What to try"><h2>This is the real app. Tap around.</h2><p class="lg-who">You\'re Dani, a server at The Larkspur, a demo restaurant. Nothing you do here is saved.</p><ol>'
    + '<li><b>Do today\'s drill</b><span>Scroll Today and start it: five questions on the list. Get one wrong on purpose to see how it teaches.</span></li>'
    + '<li><b>Open a wine</b><span>Wines, then any bottle: what to say to a guest, how it tastes, and what to pour it with.</span></li>'
    + '<li><b>Look up a dish</b><span>Menu, then a dish: its wines, its allergens and what the kitchen can change.</span></li>'
    + '<li><b>Take Vinny\'s test</b><span>Vinny, then the test: ten questions aimed at what Dani knows least.</span></li>'
    + '<li><b>Be someone else</b><span>Tap the photo at the top right and pick Elena, the manager, to see the team\'s figures.</span></li>'
    + '</ol><p class="lg-more">Ask Vinny, the guest at the table and the manager\'s console are in the full demo. <a href="https://demo.vinterest.team/?seed=demo&amp;view=console" target="_blank" rel="noopener">Open the full demo →</a></p><button type="button" class="lg-go" data-live-guide-close>Start exploring</button></aside>';

  function open(o = {}) {
    if (full) return; const who = o.who || (last && last.opts.who) || 'Dani', from = document.activeElement;
    if (last && last.handle) { last.handle.stop(); last.handle = null; }
    seed(who);
    const box = document.createElement('div'); box.className = 'live-full'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'The demo restaurant, to try yourself');
    box.innerHTML = '<div class="live-full-in"><div class="live-full-bar"><span>The Larkspur · a demo restaurant</span><span class="live-full-acts"><button type="button" data-live-guide aria-expanded="false">What to try</button><button type="button" data-live-close>Close ✕</button></span></div><div class="live-full-app"></div></div>' + GUIDE;
    document.body.appendChild(box); document.documentElement.classList.add('dlg-open');
    // On a desktop the app is drawn at a phone's own size and scaled to the window, so the whole phone is in view
    // whatever the window's height (a short laptop window once showed a third of Today). A phone gets the full screen.
    const inner = box.querySelector('.live-full-in'), fitFull = () => { if (innerWidth < 620) { inner.style.cssText = ''; box.classList.remove('guide-side'); guide.style.cssText = ''; return; }
      // A large phone's width, and the bar counted inside its height, so the frame keeps a phone's proportions.
      const FW = 430, FH = 880, k = Math.min(1.15, (innerHeight - 32) / FH, (innerWidth - 32) / FW);
      inner.style.cssText = `width:${FW}px;height:${FH}px;max-width:none;max-height:none;flex:none;transform:scale(${k});transform-origin:center center`;
      // Beside the phone where there's room for it; otherwise it stays a sheet.
      const room = (innerWidth - FW * k) / 2 - 48, side = room >= 250; box.classList.toggle('guide-side', side);
      guide.style.cssText = side ? `right:calc(50% + ${Math.round(FW * k / 2 + 28)}px);width:${Math.min(340, Math.round(room))}px` : ''; };
    const guide = box.querySelector('.live-guide'), gbtn = box.querySelector('[data-live-guide]');
    const showGuide = (on) => { box.classList.toggle('guide-open', on); gbtn.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    gbtn.addEventListener('click', () => showGuide(!box.classList.contains('guide-open')));
    box.querySelector('[data-live-guide-close]').addEventListener('click', () => showGuide(false));
    showGuide(true);
    fitFull(); addEventListener('resize', fitFull);
    const root = ReactDOM.createRoot(box.querySelector('.live-full-app')); root.render(<TeamApp />);
    const close = (popped) => { if (!full) return; full = null; removeEventListener('keydown', key); removeEventListener('popstate', pop); removeEventListener('resize', fitFull);
      try { root.unmount(); } catch (e) {} if (box.parentNode) box.parentNode.removeChild(box); document.documentElement.classList.remove('dlg-open');
      if (!popped && history.state && history.state.teamsLive) history.back();
      if (from && from.focus) try { from.focus(); } catch (e) {}
      if (last) last.handle = mount(last.el, last.opts); };
    const key = (e) => { if (e.key === 'Escape') close(); }, pop = () => close(true);
    addEventListener('keydown', key); addEventListener('popstate', pop);
    try { history.pushState({ teamsLive: 1 }, ''); } catch (e) {}
    box.querySelector('[data-live-close]').addEventListener('click', () => close()); box.querySelector('[data-live-close]').focus();
    full = { close };
  }

  function mount(el, opts = {}) {
    if (!last || last.el !== el) last = { el, opts, handle: null };
    const who = opts.who || 'Dani', speed = opts.speed || Number(window.TEAMS_LIVE_SPEED) || 1;
    let alive = true, seen = true, root = null;
    el.classList.add('live-on');
    const stage = document.createElement('div'); stage.className = 'live-app'; stage.inert = true; stage.setAttribute('aria-hidden', 'true');
    stage.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0;pointer-events:none;transition:opacity .45s ease;opacity:0`;
    el.appendChild(stage);
    stage.addEventListener('click', (e) => e.stopPropagation()); // the app's own taps are not taps on the page around it
    const fit = () => { const k = el.clientWidth / W; if (!k) return; stage.style.transform = `scale(${k})`; stage.style.height = Math.round(el.clientHeight / k) + 'px'; };
    fit(); const ro = new ResizeObserver(fit); ro.observe(el);
    const io = new IntersectionObserver((es) => { seen = es[0].isIntersecting; }, { threshold: 0.2 }); io.observe(el);

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms / speed));
    // Time that only passes while the phone is on screen.
    const wait = async (ms) => { let left = ms; while (alive && left > 0) { await sleep(100); if (seen && (!opts.active || opts.active())) left -= 100; } if (!alive) throw new Error('stopped'); };
    const until = async (fn, ms = 6000) => { const t0 = Date.now(); for (;;) { const v = fn(); if (v) return v; if (!alive) throw new Error('stopped'); if (Date.now() - t0 > ms) return null; await sleep(60); } };
    const $ = (sel) => stage.querySelector(sel), $$ = (sel) => Array.from(stage.querySelectorAll(sel));
    const byText = (re) => $$('button,[role=button],div').filter((b) => re.test((b.textContent || '').trim()) && b.offsetParent !== null).pop();
    const scroller = () => $('[data-scroll]');
    async function glide(to, ms) {
      const sc = scroller(); if (!sc) return; const from = sc.scrollTop; to = Math.max(0, Math.min(to, sc.scrollHeight - sc.clientHeight)); if (Math.abs(to - from) < 2) return;
      const n = Math.max(1, Math.round(ms / 16));
      for (let i = 1; i <= n && alive; i++) { const p = i / n, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; sc.scrollTop = from + (to - from) * e; await sleep(16); }
    }
    async function tap(node) {
      if (!node) return false;
      const sc = scroller(), k = el.clientWidth / W;
      if (sc && sc.contains(node)) {
        const r = node.getBoundingClientRect(), s = sc.getBoundingClientRect(), top = (r.top - s.top) / k, bottom = (r.bottom - s.top) / k;
        if (bottom > sc.clientHeight - 12) await glide(sc.scrollTop + bottom - sc.clientHeight + 28, 520); else if (top < 8) await glide(sc.scrollTop + top - 24, 520);
      }
      const r = node.getBoundingClientRect(), b = el.getBoundingClientRect(), dot = document.createElement('i'); dot.className = 'live-tap';
      dot.style.left = (r.left + Math.min(r.width / 2, 150 * k) - b.left) + 'px'; dot.style.top = (r.top + r.height / 2 - b.top) + 'px'; el.appendChild(dot);
      await wait(260); node.click(); setTimeout(() => dot.parentNode && dot.parentNode.removeChild(dot), 600); return true;
    }

    const multi = (d) => d.k !== 'recognise' && !d.mc;
    async function drill() {
      // One answer goes wrong: the first four-option question after the opener, where "You said … The answer: …" reads best.
      const miss = dealt.findIndex((d, i) => i > 0 && !multi(d));
      for (let i = 0; i < dealt.length; i++) {
        const d = dealt[i];
        if (!(await until(() => { const q = $('[data-testid=drill-q]'); return q && q.textContent === d.q && $$('[data-testid=drill-opt]').length; }))) return false;
        await wait(1100 + d.q.split(/\s+/).length * 95);
        const opts = $$('[data-testid=drill-opt]');
        if (multi(d)) { const ch = TeamLearn.choices(d); for (const k of ch.right) { await tap(opts[k]); await wait(420); } }
        else { await tap(opts[i === miss ? (d.a + 1) % d.opts.length : d.a]); await wait(450); }
        await tap(byText(/^Check$/));
        const res = await until(() => $('[data-testid=drill-result]')); if (!res) return false;
        await wait(1500 + Math.min(4200, (res.textContent || '').split(/\s+/).length * 85));
        await tap(byText(/^(Next|Finish)$/));
      }
      return true;
    }

    async function play() {
      for (let n = 0; alive; n++) {
        dealt = []; seed(who);
        if (root) root.unmount();
        const box = document.createElement('div'); box.style.cssText = 'position:absolute;inset:0'; stage.replaceChildren(box);
        root = ReactDOM.createRoot(box); ReactDOM.flushSync(() => root.render(<TeamApp key={n} />));
        stage.style.opacity = '1'; if (opts.onReady && n === 0) opts.onReady();
        await wait(2400);
        dealt = [];
        if (!(await tap(byText(/^(Start today's drill|Practise|Start)\b.*questions$/)))) { await wait(4000); stage.style.opacity = '0'; await wait(500); continue; }
        await until(() => dealt.length && $('[data-testid=team-drill]'));
        const ok = await drill();
        if (ok && (await until(() => $('[data-testid=drill-done]')))) {
          await wait(3200); const sc = scroller(); if (sc) await glide(sc.scrollHeight, 2600); await wait(2200);
          await tap(byText(/^Done$/)); await wait(3400);
        }
        if (opts.onLoop) opts.onLoop();
        stage.style.opacity = '0'; await wait(500);
      }
    }
    const handle = { stop() { alive = false; ro.disconnect(); io.disconnect(); try { if (root) root.unmount(); } catch (e) {} if (stage.parentNode) stage.parentNode.removeChild(stage); el.classList.remove('live-on'); } };
    Promise.resolve().then(() => { if (last && last.el === el && !last.handle) last.handle = handle; });
    play().catch((e) => { if (alive && e && e.message !== 'stopped') { stage.style.opacity = '0'; el.classList.remove('live-on'); if (opts.onFail) opts.onFail(e); } });
    return handle;
  }
  return { mount, open, get running() { return !!(last && last.handle); } };
})();
window.TeamsLive = TeamsLive;
