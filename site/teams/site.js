// Shared by every page: the pilot sign-up form, sent to the site's Worker (POST /api/pilot, site/teams/_worker.js).
(function () {
  const form = document.getElementById('pilotForm'); if (!form) return;
  const note = document.getElementById('pilotNote'), btn = form.querySelector('button[type=submit]'), country = form.querySelector('#p-country');
  const COUNTRIES = 'AR Argentina|AU Australia|AT Austria|BE Belgium|BR Brazil|CA Canada|CL Chile|CN China|HR Croatia|CY Cyprus|CZ Czechia|DK Denmark|FI Finland|FR France|GE Georgia|DE Germany|GR Greece|HK Hong Kong|HU Hungary|IS Iceland|IN India|IE Ireland|IL Israel|IT Italy|JP Japan|LU Luxembourg|MT Malta|MX Mexico|NL Netherlands|NZ New Zealand|NO Norway|PL Poland|PT Portugal|RO Romania|SG Singapore|SI Slovenia|ZA South Africa|KR South Korea|ES Spain|SE Sweden|CH Switzerland|AE United Arab Emirates|GB United Kingdom|US United States|UY Uruguay|ZZ Somewhere else'.split('|');
  COUNTRIES.forEach((c) => { const o = document.createElement('option'); o.value = c.slice(0, 2); o.textContent = c.slice(3); country.appendChild(o); });
  fetch('/api/country').then((r) => r.json()).then((d) => { if (d.country && !country.value && country.querySelector(`option[value="${d.country}"]`)) country.value = d.country; }).catch(() => {});
  // "Other" opens a box to say what.
  form.querySelectorAll('[data-other]').forEach((box) => { const sel = form.querySelector('#' + box.dataset.other), inp = box.querySelector('input');
    const sync = () => { const on = sel.value === 'other'; box.hidden = !on; inp.required = on; }; sel.addEventListener('change', sync); sync(); });
  const say = (t, bad) => { note.textContent = t; note.classList.toggle('bad', !!bad); };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = Array.from(form.elements).find((el) => el.willValidate && !el.checkValidity());
    if (bad) { bad.focus(); say((bad.labels[0] ? bad.labels[0].childNodes[0].textContent.trim() : 'This') + ': please fill this in.', true); return; }
    const data = Object.fromEntries(new FormData(form).entries());
    btn.disabled = true; say('Sending…');
    try {
      const res = await fetch('/api/pilot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) { say(out.error || 'We couldn\'t send that just now. Please try again.', true); btn.disabled = false; return; }
      form.classList.add('sent'); form.innerHTML = `<div class="done" data-testid="pilot-done"><h3>Thanks, ${data.first_name.replace(/[<>&"]/g, '')}.</h3><p>We've got your request for ${data.company.replace(/[<>&"]/g, '')} and we'll be in touch within two working days. A confirmation is on its way to ${data.email.replace(/[<>&"]/g, '')}.</p></div>`;
    } catch (err) { say('We couldn\'t reach the server. Check your connection and try again.', true); btn.disabled = false; }
  });
})();

// The demo restaurant, full screen over the page: the laptop, "Explore it yourself" and every link to the
// demo open it here (a new tab still opens with a modified click). The console loads on the first open.
(function () {
  const box = document.getElementById('demoBox'); if (!box) return;
  const frame = box.querySelector('iframe'); let back = null;
  const open = () => { back = document.activeElement; if (!frame.src) frame.src = frame.dataset.src; box.hidden = false; document.documentElement.classList.add('dlg-open'); box.querySelector('[data-demo-close]').focus(); };
  const close = () => { box.hidden = true; document.documentElement.classList.remove('dlg-open'); if (back && back.focus) back.focus(); };
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-demo-open], a[href*="seed=demo"]:not([data-demo-direct])');
    if (t && !box.contains(t)) { if (t.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.button)) return; e.preventDefault(); open(); }
    if (e.target.closest('[data-demo-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden) close();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.lid[data-demo-open]')) { e.preventDefault(); open(); }
  });
})();

// The nav: a group opens on a tap (hover and focus open it with a mouse, in the CSS), one at a time, and
// closes on Esc or a tap elsewhere; on a phone the menu button shows the whole nav as a panel.
(function () {
  const top = document.querySelector('header.top'); if (!top) return;
  const groups = Array.from(top.querySelectorAll('.dd')), menu = top.querySelector('.menub');
  const shut = (except) => groups.forEach((g) => { if (g !== except) { g.classList.remove('on'); g.querySelector('.ddb').setAttribute('aria-expanded', 'false'); } });
  groups.forEach((g) => g.querySelector('.ddb').addEventListener('click', () => {
    if (top.classList.contains('open')) return; // the phone panel shows every group already
    const on = !g.classList.contains('on'); shut(g); g.classList.toggle('on', on); g.querySelector('.ddb').setAttribute('aria-expanded', on ? 'true' : 'false');
  }));
  if (menu) menu.addEventListener('click', () => { const on = !top.classList.contains('open'); top.classList.toggle('open', on); menu.setAttribute('aria-expanded', on ? 'true' : 'false'); shut(); });
  document.addEventListener('click', (e) => {
    if (!top.contains(e.target)) { shut(); if (top.classList.contains('open')) { top.classList.remove('open'); if (menu) menu.setAttribute('aria-expanded', 'false'); } }
    else if (e.target.closest('nav a')) { shut(); top.classList.remove('open'); if (menu) menu.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { shut(); top.classList.remove('open'); if (menu) menu.setAttribute('aria-expanded', 'false'); } });
})();

// The list as bottles: <div class="cellar" data-cellar="<id of a JSON script>" data-sym="£" data-top="100"> (data-whose
// names the list in the caption, "your list" without it).
// Each row of the data is [name, bottle price, glass price or 0, kind (r w p s d), 1 for a magnum]. In view, the
// bottles arrive in price order, then the story plays once (by the glass, then bottle only); a filter or a
// bottle touched stops it. Reduced motion shows the last state at once.
(function () {
  const el = document.querySelector('[data-cellar]'); if (!el) return;
  const data = JSON.parse(document.getElementById(el.dataset.cellar).textContent), sym = el.dataset.sym || '£', top = +el.dataset.top || 100;
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MODES = {
    all: { label: 'All', has: () => true, cap: (n) => `${n} wines on ${el.dataset.whose || 'your list'}, from the least expensive to the most.` },
    glass: { label: 'By the glass', has: (w) => w[2] > 0, cap: (n) => `${n} are poured by the glass. A guest can try one before they commit.` },
    bottle: { label: 'Bottle only', has: (w) => !w[2], cap: (n) => `${n} are bottle only. They sell when someone on the floor recommends them.` },
    top: { label: `${sym}${top} and over`, has: (w) => w[1] >= top && !w[4], cap: (n) => `${n} bottles at ${sym}${top} or more: the ones a confident recommendation sells.` },
  };
  const count = (m) => data.filter(MODES[m].has).length;
  const tabs = document.createElement('div'); tabs.className = 'cellar-tabs';
  tabs.innerHTML = Object.keys(MODES).map((m) => `<button type="button" data-mode="${m}" aria-pressed="false"><b>${count(m)}</b>${MODES[m].label}</button>`).join('');
  const grid = document.createElement('div'); grid.className = 'cellar-grid'; grid.setAttribute('role', 'img');
  grid.setAttribute('aria-label', `${data.length} wines: ${count('glass')} poured by the glass, ${count('bottle')} bottle only.`);
  grid.innerHTML = data.map((w, i) => `<i class="${w[3]}" style="--i:${i}" data-i="${i}"></i>`).join('');
  const cap = document.createElement('p'); cap.className = 'cellar-cap'; cap.setAttribute('aria-live', 'polite');
  const pick = document.createElement('p'); pick.className = 'cellar-pick';
  const key = document.createElement('div'); key.className = 'cellar-key';
  key.innerHTML = [['r', '#C9344F', 'Red'], ['w', '#E9D98C', 'White'], ['p', '#F0A3B4', 'Rosé'], ['s', '#F6F1DF', 'Sparkling'], ['d', '#E9A93C', 'Sweet and fortified']]
    .filter((k) => data.some((w) => w[3] === k[0])).map((k) => `<span style="--k:${k[1]}">${k[2]}</span>`).join('');
  el.append(tabs, grid, cap, pick, key);
  const bottles = Array.from(grid.children), HINT = el.dataset.cards ? 'Touch a bottle to see which wine it is. Click it for its card.' : 'Touch a bottle to see which wine it is.';
  let timers = [], held = null;
  const set = (m) => {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
    bottles.forEach((b, i) => b.classList.toggle('off', !MODES[m].has(data[i])));
    cap.textContent = MODES[m].cap(count(m)); el.dataset.mode = m;
  };
  const stop = () => { timers.forEach(clearTimeout); timers = []; };
  const show = (b) => {
    if (held) held.classList.remove('pick'); held = b || null;
    if (!b) { pick.textContent = HINT; return; }
    const w = data[+b.dataset.i]; b.classList.add('pick');
    pick.textContent = w[0] + ' · ' + (w[1] ? `${sym}${w[1]} a ${w[4] ? 'magnum' : 'bottle'}` : '') + (w[1] && w[2] ? ' · ' : '') + (w[2] ? `${sym}${w[2]} a glass` : ' · bottle only');
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { stop(); set(b.dataset.mode); } });
  grid.addEventListener('pointerover', (e) => { if (e.target.dataset.i) show(e.target); });
  // With data-cards (a JSON file of cards in the list's order), a bottle opens its wine's card: what the team would
  // learn of it. The file is fetched once, on the first bottle touched; data-cards-demo is where the card's link goes.
  let cards = null; const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const getCards = () => cards || (cards = fetch(el.dataset.cards).then((r) => (r.ok ? r.json() : Promise.reject(new Error('no cards')))).catch(() => { cards = null; return null; }));
  const KIND = { r: '#C9344F', w: '#E9D98C', p: '#F0A3B4', s: '#F6F1DF', d: '#E9A93C' }, LEVEL = ['None', 'Low', 'Light', 'Medium', 'Full', 'High'];
  const TRAIT = [['body', 'Body', 'how heavy it feels'], ['acid', 'Acidity', 'how mouth-watering'], ['tannin', 'Tannin', 'the drying grip'], ['sweet', 'Sweetness', 'sugar you can taste']];
  async function card(i) {
    const all = await getCards(), c = all && all[i], w = data[i]; if (!c) return;
    let dlg = document.querySelector('dialog.wcard');
    if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'wcard'; document.body.appendChild(dlg); dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('.wcard-x')) dlg.close(); }); }
    const price = [w[2] ? `${sym}${w[2]} a glass` : '', w[1] ? `${sym}${w[1]} a ${w[4] ? 'magnum' : c.half ? 'half bottle' : 'bottle'}` : ''].filter(Boolean).join(' · ') + (w[2] ? '' : ' · bottle only');
    const bars = TRAIT.filter((t) => c.style && c.style[t[0]] != null && !(t[0] === 'tannin' && !c.style.tannin)).map((t) => `<div class="bar"><span><b>${t[1]}</b>${t[2]}</span><i style="--w:${Math.max(4, c.style[t[0]] / 5 * 100)}%" title="${LEVEL[c.style[t[0]]] || ''}"></i></div>`).join('');
    dlg.innerHTML = `<div class="wcard-in" style="--k:${KIND[w[3]] || ''}"><button type="button" class="wcard-x" aria-label="Close">✕</button>
      <div class="sec">${esc(c.section)}</div><h3>${esc(w[0])}</h3><div class="meta">${esc([c.where, c.grapes].filter(Boolean).join(' · '))}</div>
      <div class="price">${esc(price)}</div>${c.say ? `<div class="say">Say it: ${esc(c.say)}</div>` : ''}
      ${c.hook ? `<p style="margin-top:16px">${esc(c.hook)}</p>` : ''}
      ${c.pitch ? `<div class="lab">What to say at the table</div><blockquote>${esc(c.pitch)}</blockquote>` : ''}
      ${c.taste ? `<div class="lab">How it tastes</div><p>${esc(c.taste)}</p>` : ''}${bars ? `<div class="bars">${bars}</div>` : ''}
      ${c.dishes && c.dishes.length ? `<div class="lab">Pour it with</div>${c.dishes.map((d) => `<div class="dish"><b>${esc(d.dish)}</b><span>${esc(d.why)}</span></div>`).join('')}` : ''}
      ${c.serve ? `<div class="lab">Serve</div><p>${esc(c.serve)}</p>` : ''}
      <div class="foot"><span>${esc(el.dataset.cardsNote || 'The card your team would learn from.')}</span>${el.dataset.cardsDemo ? `<a class="btn primary small" href="${esc(el.dataset.cardsDemo)}" target="_blank" rel="noopener" data-demo-direct>Open your demo</a>` : ''}</div></div>`;
    if (!dlg.open) dlg.showModal(); dlg.querySelector('.wcard-in').scrollTop = 0;
  }
  if (el.dataset.cards) grid.addEventListener('click', (e) => { if (e.target.dataset.i) { stop(); card(+e.target.dataset.i); } });
  grid.addEventListener('pointerleave', () => show(null));
  set('all'); show(null);
  const play = () => {
    el.classList.add('in');
    if (still) { el.classList.add('ready'); set('bottle'); return; }
    const k = +el.dataset.speed || 1, after = (ms, fn) => timers.push(setTimeout(fn, ms / k));
    setTimeout(() => el.classList.add('ready'), (data.length * 9 + 600) / k);
    after(data.length * 9 + 1500, () => set('glass'));
    after(data.length * 9 + 4700, () => set('bottle'));
  };
  if (!('IntersectionObserver' in window)) { play(); return; }
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); play(); } }, { threshold: 0.35 });
  io.observe(grid);
})();

// "Try it yourself": where the live phone's app is loaded (live.js), it opens full screen on the page; otherwise the link goes to the demo.
document.addEventListener('click', (e) => { const a = e.target.closest('[data-live-open]'); if (!a || !window.TeamsLive || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); window.TeamsLive.open(); });

// A timeline that draws itself: <div data-timeline=".s"> (the selector of its steps). As the page scrolls, --p (0 to 1)
// is how far the line has come, across a row of steps or down a column of them, and a step gets .on once the line
// reaches it. Reduced motion, or no script, shows every step lit.
(function () {
  const lines = Array.from(document.querySelectorAll('[data-timeline]')); if (!lines.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const rows = lines.map((el) => { el.classList.add('tl-js'); return { el, steps: Array.from(el.querySelectorAll(el.dataset.timeline)) }; });
  let queued = false;
  function draw() {
    queued = false; const vh = window.innerHeight;
    rows.forEach(({ el, steps }) => {
      if (steps.length < 2) return; const r = el.getBoundingClientRect(), a = steps[0].getBoundingClientRect(), b = steps[1].getBoundingClientRect(), across = Math.abs(a.top - b.top) < 8;
      // A row is all on screen at once, so it draws over a short stretch of scroll; a column draws at reading pace.
      const p = across ? clamp((vh * 0.82 - r.top) / (vh * 0.42)) : clamp((vh * 0.62 - r.top) / Math.max(1, r.height));
      el.style.setProperty('--p', p.toFixed(4));
      const len = across ? r.width : r.height;
      steps.forEach((s) => { const q = s.getBoundingClientRect(), at = across ? q.left - r.left : q.top - r.top; s.classList.toggle('on', p > 0 && (s === steps[0] || at <= p * len - (across ? 0 : 20))); });
    });
  }
  const ask = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };
  addEventListener('scroll', ask, { passive: true }); addEventListener('resize', ask); draw();
})();

// Hear a table: <div data-table> with lines (.t-line[data-src], each a spoken clip), a mark (.t-mark) and a play
// button ([data-table-play]). Pressed, each line is said in turn, its words lighting with the voice, then the mark
// arrives; pressed again it pauses, and after the end it plays again. Sound only ever starts on that press. A clip
// that can't play is given its reading time, so the exchange still runs.
(function () {
  const el = document.querySelector('[data-table]'); if (!el) return;
  const btn = el.querySelector('[data-table-play]'), lbl = btn.querySelector('.lbl'), lines = Array.from(el.querySelectorAll('.t-line')), mark = el.querySelector('.t-mark');
  const speed = Number(window.TEAMS_TABLE_SPEED) || 1, audio = new Audio(); audio.preload = 'auto';
  lines.forEach((l) => { const p = l.querySelector('p'); p.innerHTML = p.textContent.split(/\s+/).map((w) => `<span>${w.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</span>`).join(' '); });
  let run = 0, at = 0, paused = false, raf = 0, silent = null;
  const words = (l) => Array.from(l.querySelectorAll('p span'));
  const say = (l, f) => { const ws = words(l), n = Math.round(Math.min(1, f) * ws.length); ws.forEach((w, i) => w.classList.toggle('said', i < n)); };
  const reset = () => { lines.forEach((l) => { l.classList.remove('on', 'talk'); say(l, 0); }); mark.classList.remove('on'); };
  const state = (s) => { el.classList.toggle('playing', s === 'playing'); el.classList.toggle('done', s === 'done' || s === 'paused'); lbl.textContent = s === 'playing' ? 'Pause' : s === 'paused' ? 'Carry on' : s === 'done' ? 'Play it again' : 'Play the table'; btn.setAttribute('aria-pressed', String(s === 'playing')); };
  const sleep = (ms, token) => new Promise((r) => { const t0 = performance.now(); let spent = 0, last = t0; (function tick(t) { if (token !== run) return r(false); if (!paused) spent += t - last; last = t; if (spent >= ms / speed) return r(true); requestAnimationFrame(tick); })(t0); });
  function line(l, token) {
    return new Promise((done) => {
      l.classList.add('on', 'talk'); l.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      const end = () => { cancelAnimationFrame(raf); audio.onended = audio.onerror = null; say(l, 1); l.classList.remove('talk'); done(token === run); };
      // Without the clip the line takes its reading time.
      const mute = async () => { silent = l; const ws = words(l).length, ms = ws * 330; const t0 = performance.now(); let spent = 0, last = t0;
        (function tick(t) { if (token !== run) return end(); if (!paused) spent += (t - last) * speed; last = t; say(l, spent / ms); if (spent >= ms) { silent = null; return end(); } raf = requestAnimationFrame(tick); })(t0); };
      audio.src = l.dataset.src; audio.playbackRate = speed; audio.onended = end; audio.onerror = mute;
      (function tick() { if (token !== run) return; if (audio.duration) say(l, (audio.currentTime + 0.12) / audio.duration); raf = requestAnimationFrame(tick); })();
      const p = audio.play(); if (p && p.catch) p.catch(() => { if (token === run && !paused) { cancelAnimationFrame(raf); mute(); } });
    });
  }
  async function play() {
    run += 1; const token = run; paused = false; reset(); state('playing');
    for (at = 0; at < lines.length; at++) { if (!(await line(lines[at], token))) return; if (!(await sleep(380, token))) return; }
    mark.classList.add('on'); mark.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); state('done');
  }
  btn.addEventListener('click', () => {
    if (el.classList.contains('playing')) { paused = true; if (!silent) audio.pause(); state('paused'); lines.forEach((l) => l.classList.contains('on') || l.classList.remove('talk')); return; }
    if (paused) { paused = false; state('playing'); if (!silent) { const p = audio.play(); if (p && p.catch) p.catch(() => {}); } return; }
    play();
  });
  // Scrolled away mid-table, it pauses instead of talking to nobody.
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { if (!es[0].isIntersecting && el.classList.contains('playing')) btn.click(); }, { threshold: 0 }).observe(el);
})();
