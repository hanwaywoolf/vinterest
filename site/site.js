/* Vinterest website: header, phone sizing, the scroll-driven demos and the beta form.
   Plain JS, no framework. The demos themselves are demo.js (the app's own screens), loaded only
   when the first phone is about to be seen. */
(function () {
  'use strict';
  var body = document.body;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raf = window.requestAnimationFrame.bind(window);
  var clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };

  /* ── Header goes solid once the page moves ── */
  var top = document.getElementById('top');
  function onScrollHeader() { top.classList.toggle('solid', window.scrollY > 24); }
  onScrollHeader();
  window.addEventListener('scroll', onScrollHeader, { passive: true });

  /* ── Stage navigation ──
     Every demo section gets a progress bar (one line per caption) centred above its phone, and an
     arrow either side of the phone. They're wired up below, where the captions are. Built first,
     so the phone is sized against the room it actually has. */
  var ARROW = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="12.5,4.5 7,10 12.5,15.5"/></svg>';
  Array.prototype.forEach.call(document.querySelectorAll('[data-feature]'), function (sec) {
    var stage = sec.querySelector('.stage'), slot = stage.querySelector('.phone-slot');
    var n = sec.querySelectorAll('.steps li').length;
    var prog = document.createElement('div');
    prog.className = 'prog';
    prog.setAttribute('role', 'group');
    prog.setAttribute('aria-label', 'Steps');
    var segs = [];
    Array.prototype.forEach.call(sec.querySelectorAll('.steps li'), function (li) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', li.querySelector('h3').textContent);
      b.innerHTML = '<span><i></i></span>';
      prog.appendChild(b);
      segs.push(b);
    });
    var mk = function (dir, label) {
      var a = document.createElement('button');
      a.type = 'button';
      a.className = 'arrow ' + dir;
      a.setAttribute('aria-label', label);
      a.innerHTML = ARROW;
      if (dir === 'next') a.firstChild.style.transform = 'scaleX(-1)';
      return a;
    };
    var prev = mk('prev', 'Previous step'), next = mk('next', 'Next step');
    var row = document.createElement('div'), holder = document.createElement('div');
    row.className = 'phone-row';
    holder.className = 'phone-holder';
    holder.appendChild(slot);
    row.appendChild(prev); row.appendChild(holder); row.appendChild(next);
    stage.classList.add('has-nav');
    stage.appendChild(prog);
    // The front page's carousel has no captions beside it: the current one is said under the bar.
    var cap = null;
    if (sec.hasAttribute('data-carousel')) { cap = document.createElement('p'); cap.className = 'cap'; cap.setAttribute('aria-live', 'polite'); stage.appendChild(cap); }
    stage.appendChild(row);
    sec._nav = { segs: segs, prev: prev, next: next, slot: slot, cap: cap };
  });

  /* ── Phones: scale a 410 x 864 frame to the room its stage gives it ── */
  var slots = Array.prototype.slice.call(document.querySelectorAll('.phone-slot'));
  function sizePhones() {
    slots.forEach(function (slot) {
      var stage = slot.parentNode;
      var cs = getComputedStyle(stage);
      var w = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var h = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (w > 0 && h > 0) slot.style.setProperty('--s', clamp(Math.min(w / 410, h / 864), 0.3, 1.15).toFixed(4));
    });
  }
  sizePhones();
  window.addEventListener('resize', sizePhones);
  // A stage's room also changes when its caption or the header wraps differently.
  if (window.ResizeObserver) { var ro = new ResizeObserver(sizePhones); slots.forEach(function (s) { ro.observe(s.parentNode); }); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(sizePhones);

  /* ── Demos ──
     Each .phone-app[data-demo] gets the app's real screen when it comes within a screen of the
     viewport. Until then (and if demo.js never arrives) it shows the placeholder. */
  var demos = []; // { el, kind, api, feature, progress }
  var loading = null;
  function loadDemoScript() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = body.getAttribute('data-demo-src');
      s.onload = resolve;
      s.onerror = function () { reject(new Error('demo.js failed to load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function mountDemo(d) {
    if (d.api || d.mounting) return;
    d.mounting = true;
    loadDemoScript().then(function () {
      try { d.api = window.VinterestDemo.mount(d.el, d.kind); } catch (e) { if (window.console) console.warn(e); }
      d.mounting = false;
      if (d.api && d.progress != null) d.api.update(d.progress);
    }, function () { d.mounting = false; });
  }
  document.querySelectorAll('.phone-app[data-demo]').forEach(function (el) {
    var feature = el.closest('[data-feature]');
    var fixed = el.getAttribute('data-progress');
    demos.push({ el: el, kind: el.getAttribute('data-demo'), feature: feature, progress: fixed == null ? (feature ? 0 : 0) : parseFloat(fixed) });
  });
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        demos.forEach(function (d) { if (d.el === e.target) mountDemo(d); });
      });
    }, { rootMargin: '100% 0px' });
    demos.forEach(function (d) { io.observe(d.el); });
  } else {
    demos.forEach(mountDemo);
  }

  /* ── Playing the demos ──
     A demo section is one screen tall and the page scrolls past it normally (nothing here reads the
     wheel). When it's mostly on screen it plays by itself: each caption in turn for its reading time
     (data-dwell seconds, default 7), the phone doing what that caption says, and the progress line
     filling as it goes. After the last it stays there; it never restarts. The front page's carousel
     keeps turning instead. A click (or Enter) on a caption stops the autoplay and holds the demo on
     that part; the arrows, the progress lines and a swipe on the phone do the same. With reduced motion
     nothing plays: every caption shows, and a click still jumps to that point. */
  // ?speed=8 plays the demos eight times as fast (the tests use it).
  var speed = parseFloat(new URLSearchParams(location.search).get('speed')) || 1;
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]')).map(function (el) {
    return { el: el, copy: el.querySelector('.copy'), steps: Array.prototype.slice.call(el.querySelectorAll('.steps li')), p: 0, phase: 'held', started: false, wait: 0, carousel: el.hasAttribute('data-carousel'), on: false, step: -1, shown: -1,
      lock: 0, lastWheel: 0, dur: (parseFloat(el.getAttribute('data-duration')) || 16) * 1000 / speed };
  });
  features.forEach(function (f) {
    f.demos = demos.filter(function (d) { return d.feature === f.el; });
    f.nav = f.el._nav;
    f.auto = !reduced;
    f.steps.forEach(function (li, i) {
      li.at = parseFloat(li.getAttribute('data-at') || '0');
      // Where a click holds the demo: just into its part, or data-hold when the part is a run of things.
      li.holdAt = li.hasAttribute('data-hold') ? parseFloat(li.getAttribute('data-hold')) : Math.min(1, li.at + 0.002);
      // A part that plays something (the rating slider) plays it whenever the part is chosen, up to here.
      li.animTo = li.hasAttribute('data-anim-to') ? parseFloat(li.getAttribute('data-anim-to')) : null;
      li.animMs = parseFloat(li.getAttribute('data-anim-ms')) || 2600;
      // Linear when the part is a sequence in time (cards turning, a call being made), eased when it's one movement.
      li.animLinear = li.hasAttribute('data-anim-linear');
      // How long autoplay stays on this part before moving to the next: its own reading time.
      li.dwell = (parseFloat(li.getAttribute('data-dwell')) || 7) * 1000;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.addEventListener('click', function () { hold(f, i, true); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hold(f, i, true); } });
      f.nav.segs[i].addEventListener('click', function () { hold(f, i, true); });
    });
    f.nav.prev.addEventListener('click', function () { move(f, -1, true); });
    f.nav.next.addEventListener('click', function () { move(f, 1, true); });
    /* Swiping the phone sideways moves to the next or previous part (vertical drags still scroll the page). */
    var sx = 0, sy = 0, sid = null;
    f.nav.slot.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; });
    f.nav.slot.addEventListener('pointerup', function (e) {
      if (e.pointerId !== sid) return;
      sid = null;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) move(f, dx < 0 ? 1 : -1, true);
    });
    f.nav.slot.addEventListener('pointercancel', function () { sid = null; });
  });
  /* The caption block is as tall as its tallest state (a different caption lit each time), so opening
     a longer one never moves the block or pushes it past the section. Measured with each caption lit
     in turn and no animation; on a phone the captions already share one cell. */
  function reserveSteps() {
    features.forEach(function (f) {
      var list = f.el.querySelector('.steps');
      if (!list) return;
      list.style.minHeight = '';
      if (window.innerWidth <= 900 || !f.steps.length || !list || f.el.hasAttribute('data-carousel')) return;
      list.classList.add('measure');
      var lit = f.steps.map(function (li) { return li.classList.contains('on'); }), tallest = 0;
      f.steps.forEach(function (li) {
        f.steps.forEach(function (o) { o.classList.toggle('on', o === li); });
        tallest = Math.max(tallest, list.getBoundingClientRect().height);
      });
      f.steps.forEach(function (o, i) { o.classList.toggle('on', lit[i]); });
      list.classList.remove('measure');
      list.style.minHeight = Math.ceil(tallest) + 'px';
    });
  }
  var reserveTimer;
  window.addEventListener('resize', function () { clearTimeout(reserveTimer); reserveTimer = setTimeout(reserveSteps, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserveSteps);
  reserveSteps();
  var ease = function (k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; };
  // Stops the autoplay and shows caption i (playing what it plays, if it plays something).
  // `byReader` is a person choosing it: the front page's carousel then stops turning by itself.
  function hold(f, i, byReader) {
    var li = f.steps[i];
    if (byReader) f.auto = false;
    f.wait = 0;
    f.phase = 'held';
    f.p = li.holdAt;
    // Choosing the part that's already showing plays it again.
    if (f.step === i) { f.shown = -1; f.demos.forEach(function (d) { if (d.api && d.api.replay) d.api.replay(); }); }
    if (li.animTo != null) {
      if (reduced) f.p = li.animTo;
      else { f.phase = 'anim'; f.animFrom = li.holdAt; f.animTo = li.animTo; f.animT = 0; f.animMs = li.animMs / speed; f.animLinear = li.animLinear; }
    }
    apply(f);
  }
  // The arrows and swipes: the next or previous part, if there is one.
  function move(f, dir, byReader) { var to = f.step + dir; if (to >= 0 && to < f.steps.length) hold(f, to, byReader); else if (f.carousel && byReader) hold(f, dir > 0 ? 0 : f.steps.length - 1, true); }
  function apply(f) {
    if (Math.abs(f.p - f.shown) < 0.0002) return;
    f.shown = f.p;
    f.el.style.setProperty('--p', f.p.toFixed(4));
    var step = 0;
    f.steps.forEach(function (li, i) { if (f.p >= li.at - 0.001) step = i; });
    if (step !== f.step) {
      f.step = step;
      f.steps.forEach(function (li, i) { li.classList.toggle('on', i === step); });
      f.nav.prev.setAttribute('aria-disabled', !f.carousel && step === 0 ? 'true' : 'false');
      f.nav.next.setAttribute('aria-disabled', !f.carousel && step === f.steps.length - 1 ? 'true' : 'false');
    }
    // Lines before this part are full, the one being played fills as it goes, the rest are empty.
    f.nav.segs.forEach(function (b, i) {
      var end = i + 1 < f.steps.length ? f.steps[i + 1].at : 1, start = f.steps[i].at;
      var fill = i < step ? 1 : i > step ? 0 : (f.auto ? 0 : 1);
      b.firstChild.firstChild.style.setProperty('--f', fill.toFixed(3));
      b.classList.toggle('on', i === step);
    });
    if (f.nav.cap) f.nav.cap.textContent = f.steps[step].querySelector('h3').textContent;
    f.demos.forEach(function (d) { d.progress = f.p; if (d.api) d.api.update(f.p); });
  }
  if (!reduced) {
    var fio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      // "On screen" is a quarter of the section, or 40% of the window if the section is taller than that
      // (zoomed in, or a small window), so a long section can't be too big to ever count.
      entries.forEach(function (e) { features.forEach(function (f) { if (f.el === e.target) f.on = e.isIntersecting && e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.25, window.innerHeight * 0.4); }); });
    }, { threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1] }) : null; // early: a section is one screen, and readers scroll on quickly
    features.forEach(function (f) { if (fio) fio.observe(f.el); else f.on = true; });
    var last = 0;
    var tick = function (now) {
      // A frame's elapsed time, capped so a tab coming back from the background doesn't leap; the cap is loose enough that
      // a busy page (several phones drawing at once) still plays a caption's animation in about its stated time.
      var dt = Math.min(250, now - (last || now));
      last = now;
      features.forEach(function (f) {
        if (!f.on) return;
        // A section starts on its first part once its phone is drawn; nothing then moves until the reader does
        // (the front page's carousel turns by itself, until someone touches it).
        if (!f.started) {
          // Once its phone is drawn (or, if that's failing, after a few seconds, so the captions still turn).
          f.seen = (f.seen || 0) + dt;
          if (f.demos.every(function (d) { return d.api; }) || f.seen > 4000) { f.started = true; hold(f, 0, false); }
          return;
        }
        if (f.auto) {
          f.wait += dt;
          var dwell = f.steps[f.step].dwell / speed;
          f.nav.segs[f.step].firstChild.firstChild.style.setProperty('--f', clamp(f.wait / dwell, 0, 1).toFixed(3));
          if (f.wait > dwell) {
            if (f.step + 1 < f.steps.length) hold(f, f.step + 1, false);
            else if (f.carousel) hold(f, 0, false);
            else { f.auto = false; f.nav.segs[f.step].firstChild.firstChild.style.setProperty('--f', '1'); } // played through once: it stays on the last part
          }
        }
        if (f.phase === 'anim') {
          f.animT += dt;
          var k = Math.min(1, f.animT / f.animMs);
          f.p = f.animFrom + (f.animTo - f.animFrom) * (f.animLinear ? k : ease(k));
          // The last frame always lands: apply() skips a move under 0.0002, and the end of an animation can fall inside
          // that, leaving the demo one frame short of the part it was animating to.
          if (k >= 1) { f.phase = 'held'; f.shown = -1; }
          apply(f);
        }
      });
      raf(tick);
    };
    raf(tick);
  } else {
    features.forEach(function (f) { f.steps.forEach(function (li) { li.classList.add('on'); }); apply(f); });
  }

  /* ── Entrances ──
     The hero's headline rises a word at a time (its words are wrapped here, the bold ones kept bold), and
     anything marked .reveal arrives as it's reached. Without an observer, or with reduced motion, nothing
     is ever hidden. */
  var h1 = document.querySelector('.hero h1');
  if (h1 && !reduced) {
    var wi = 0;
    var wrapWords = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 1) { wrapWords(n); return; }
        if (n.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span');
          w.className = 'w'; w.style.setProperty('--i', wi++); w.textContent = part;
          frag.appendChild(w);
        });
        node.replaceChild(frag, n);
      });
    };
    wrapWords(h1);
  }
  var reveals = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (!reduced && 'IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rio.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { rio.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }
  /* On a phone a section's caption floats at the foot of the screen; it shows once the section's phone is on
     screen (before that it would sit over the section's own heading). Without an observer it always shows. */
  var capStages = Array.prototype.slice.call(document.querySelectorAll('.feature .stage'));
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.closest('.feature').classList.toggle('capon', e.isIntersecting); });
    }, { rootMargin: '0px 0px -35% 0px' });
    capStages.forEach(function (st) { cio.observe(st); });
  } else capStages.forEach(function (st) { st.closest('.feature').classList.add('capon'); });
  /* The hero's phone leans a few degrees towards a mouse (never a finger, which is scrolling). */
  var heroStage = document.querySelector('.hero .stage'), heroSlot = heroStage && heroStage.querySelector('.phone-slot');
  if (heroSlot && !reduced && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      heroSlot.style.setProperty('--tx', (((e.clientX - r.left) / r.width - 0.5) * 9).toFixed(2));
      heroSlot.style.setProperty('--ty', ((0.5 - (e.clientY - r.top) / r.height) * 6).toFixed(2));
    });
    hero.addEventListener('pointerleave', function () { heroSlot.style.setProperty('--tx', 0); heroSlot.style.setProperty('--ty', 0); });
  }

  /* ── Try it: your taste ──
     Three sliders for a wine type. The words under each (the step's name and what it means) and the
     styles suggested are the app's own (VinterestDemo.taste: WineDNA's scales and the Explore Next
     catalogue), so nothing here is written twice. The first pick's grape is drawn by the app's pen.
     Nothing is stored or sent. */
  var tasteBox = document.getElementById('taste');
  if (tasteBox) (function () {
    var rowsEl = document.getElementById('taste-rows'), picksEl = document.getElementById('taste-picks'), wordsEl = document.getElementById('taste-words'),
      sketchEl = document.getElementById('taste-sketch'), typeBtns = Array.prototype.slice.call(tasteBox.querySelectorAll('.seg button'));
    var START = { red: { body: 0.75, tannins: 0.5, acidity: 0.5 }, white: { body: 0.25, acidity: 0.75, sweetness: 0.12 } };
    var state = { type: 'red', vals: { red: Object.assign({}, START.red), white: Object.assign({}, START.white) } };
    var built = null, sketch = null, sketchFor = null, sketchTimer = 0;
    var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    function draw() {
      var t = window.VinterestDemo.taste(state.type, state.vals[state.type]);
      tasteBox.style.setProperty('--tc', t.col);
      // The sliders are built once per wine type, then only their words change (a rebuilt slider would drop the drag).
      if (built !== state.type) {
        built = state.type;
        rowsEl.innerHTML = t.rows.map(function (r) {
          return '<div class="trow" data-axis="' + r.axis + '"><label class="name" for="taste-' + r.axis + '">' + esc(r.name) + '</label>' +
            '<input type="range" id="taste-' + r.axis + '" min="0" max="100" step="1" value="' + Math.round(r.value * 100) + '" aria-describedby="taste-' + r.axis + '-m"/>' +
            '<div class="stops">' + r.steps.map(function (w, i) { return '<button type="button" tabindex="-1" data-step="' + i + '">' + esc(w) + '</button>'; }).join('') + '</div>' +
            '<p class="means" id="taste-' + r.axis + '-m"></p></div>';
        }).join('');
      }
      t.rows.forEach(function (r) {
        var row = rowsEl.querySelector('[data-axis="' + r.axis + '"]'), input = row.querySelector('input');
        input.style.setProperty('--v', Math.round(r.value * 100));
        input.setAttribute('aria-valuetext', r.word);
        Array.prototype.forEach.call(row.querySelectorAll('.stops button'), function (b, i) { b.classList.toggle('on', i === r.step); });
        row.querySelector('.means').innerHTML = '<b>' + esc(r.word) + '.</b> ' + esc(r.meaning);
      });
      wordsEl.textContent = t.words.join(' · ');
      var key = t.picks.map(function (p) { return p.name; }).join('|');
      if (picksEl.getAttribute('data-key') !== key) {
        picksEl.setAttribute('data-key', key);
        picksEl.innerHTML = t.picks.map(function (p, i) {
          return '<div class="pick' + (i === 0 ? ' first' : '') + '" style="--i:' + i + '"><div class="top-line"><h3>' + esc(p.name) + '</h3><span class="where">' + esc(p.country) + '</span></div>' +
            (i === 0 ? '<p>' + esc(p.taste) + '</p><p class="ask">Ask for it: “' + esc(p.ask) + '”</p>' : '<p class="ask">' + esc((p.grapes || []).join(', ')) + (p.adds ? ' · ' + esc(p.adds) : '') + '</p>') + '</div>';
        }).join('');
        // The first pick's grape, drawn once the sliders have settled on it.
        var grape = t.picks[0] && t.picks[0].grapes && t.picks[0].grapes[0];
        clearTimeout(sketchTimer);
        if (grape !== sketchFor) sketchTimer = setTimeout(function () {
          sketchFor = grape;
          if (sketch) { sketch.unmount(); sketch = null; }
          sketchEl.textContent = '';
          if (grape && !reduced) { var holder = document.createElement('div'); sketchEl.appendChild(holder); sketch = window.VinterestDemo.mountSketch(holder, grape); if (!sketch) sketchEl.textContent = ''; }
        }, 450);
      }
    }
    rowsEl.addEventListener('input', function (e) {
      var row = e.target.closest && e.target.closest('.trow'); if (!row) return;
      state.vals[state.type][row.getAttribute('data-axis')] = e.target.value / 100;
      draw();
    });
    rowsEl.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.stops button'); if (!b) return;
      var row = b.closest('.trow'), v = b.getAttribute('data-step') / 4;
      state.vals[state.type][row.getAttribute('data-axis')] = v;
      row.querySelector('input').value = Math.round(v * 100);
      draw();
    });
    typeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        state.type = b.getAttribute('data-type');
        typeBtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        if (window.VinterestDemo) draw();
      });
    });
    // The app's code arrives with the first phone; if it never does, the section goes rather than sit empty.
    loadDemoScript().then(function () { try { draw(); } catch (e) { tasteBox.hidden = true; if (window.console) console.warn(e); } }, function () { tasteBox.hidden = true; });
  })();

  /* ── The dial beside the sign-up: the app's own, for the visitor's finger ── */
  var dialBox = document.getElementById('try-dial');
  if (dialBox) {
    var dialSay = document.getElementById('dial-a');
    var SAY = function (n, band) {
      return n + ' · ' + band + '. ' + (n >= 90 ? 'A wine you loved: Vinterest looks for more like it.' : n >= 80 ? 'A good bottle. It would count in every match from here.' : 'Not for you, and worth knowing: Vinterest steers you away from wines like it.');
    };
    var mountDial = function () {
      loadDemoScript().then(function () {
        if (dialBox._dial) return;
        dialBox.hidden = false;
        dialBox._dial = window.VinterestDemo.mountDial(document.getElementById('dial-mount'), function (n, band) { dialSay.textContent = SAY(n, band); });
      }, function () {});
    };
    if ('IntersectionObserver' in window) {
      var dio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { dio.disconnect(); mountDial(); } }); }, { rootMargin: '100% 0px' });
      dio.observe(document.getElementById('beta'));
    } else mountDial();
  }

  /* ── The stores ──
     Once the apps are listed (the build fills data-ios-url / data-android-url from APP_STORE_URL and
     PLAY_STORE_URL), the page stops asking for beta sign-ups: the form gives way to the two store
     buttons, every main button says to download and goes to the visitor's own store (or to the
     buttons, on a computer), and the copy marked data-live-text / data-live-html changes with it. */
  var stores = { ios: body.getAttribute('data-ios-url') || '', android: body.getAttribute('data-android-url') || '' };
  if (stores.ios || stores.android) {
    var ua = navigator.userAgent || '';
    var mine = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? stores.ios : /Android/.test(ua) ? stores.android : '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-live-text]'), function (el) { el.textContent = el.getAttribute('data-live-text'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-live-html]'), function (el) { el.innerHTML = el.getAttribute('data-live-html'); });
    Array.prototype.forEach.call(document.querySelectorAll('a.cta-main'), function (a) { if (mine) { a.href = mine; a.rel = 'noopener'; } });
    var storeBox = document.getElementById('stores'), sIos = document.getElementById('store-ios'), sAnd = document.getElementById('store-android');
    if (stores.ios) sIos.href = stores.ios; else sIos.hidden = true;
    if (stores.android) sAnd.href = stores.android; else sAnd.hidden = true;
    storeBox.hidden = false;
    document.getElementById('beta-form').hidden = true;
    body.setAttribute('data-stores', 'live');
  }

  /* ── Beta form ── */
  var COUNTRIES = 'AF Afghanistan|AL Albania|DZ Algeria|AR Argentina|AM Armenia|AU Australia|AT Austria|AZ Azerbaijan|BH Bahrain|BD Bangladesh|BE Belgium|BR Brazil|BG Bulgaria|CA Canada|CL Chile|CN China|CO Colombia|HR Croatia|CY Cyprus|CZ Czechia|DK Denmark|EG Egypt|EE Estonia|FI Finland|FR France|GE Georgia|DE Germany|GR Greece|HK Hong Kong|HU Hungary|IS Iceland|IN India|ID Indonesia|IE Ireland|IL Israel|IT Italy|JP Japan|JO Jordan|KZ Kazakhstan|KE Kenya|KR South Korea|KW Kuwait|LV Latvia|LB Lebanon|LT Lithuania|LU Luxembourg|MY Malaysia|MT Malta|MX Mexico|MA Morocco|NL Netherlands|NZ New Zealand|NG Nigeria|NO Norway|PK Pakistan|PE Peru|PH Philippines|PL Poland|PT Portugal|QA Qatar|RO Romania|SA Saudi Arabia|RS Serbia|SG Singapore|SK Slovakia|SI Slovenia|ZA South Africa|ES Spain|LK Sri Lanka|SE Sweden|CH Switzerland|TW Taiwan|TH Thailand|TR Türkiye|UA Ukraine|AE United Arab Emirates|GB United Kingdom|US United States|UY Uruguay|VN Vietnam|ZZ Somewhere else'.split('|');
  var form = document.getElementById('beta-form');
  var select = document.getElementById('b-country');
  COUNTRIES.forEach(function (c) {
    var o = document.createElement('option');
    o.value = c.slice(0, 2); o.textContent = c.slice(3);
    select.appendChild(o);
  });
  // A best guess from where the visit came from (the Worker reads it from Cloudflare); never blocks typing.
  // The email is where the test invite goes: TestFlight sends it to the Apple ID, and Google Play
  // lets in the Google account on the phone. Say which, once they've picked their phone.
  var platformBox = document.getElementById('b-platform'), emailHint = document.getElementById('b-email-hint');
  var HINTS = {
    '': emailHint.textContent,
    ios: 'Use the email of your Apple ID. TestFlight sends your invite there, so it has to be the account on your iPhone.',
    android: 'Use the Google account email you use for Google Play on your phone. That account is the one let into the test.',
  };
  platformBox.addEventListener('change', function () { emailHint.textContent = HINTS[platformBox.value] || HINTS['']; });
  fetch('/api/country').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    var code = j && j.country;
    if (code && !select.value && select.querySelector('option[value="' + code + '"]')) select.value = code;
  }).catch(function () {});

  var fail = document.getElementById('beta-fail');
  var go = document.getElementById('beta-go');
  function setErr(name, msg) {
    var el = form.querySelector('.err[data-for="' + name + '"]');
    if (el) el.textContent = msg || '';
    var input = form.elements[name];
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }
  function validate(v) {
    var bad = {};
    if (!v.first_name) bad.first_name = 'Add your first name.';
    if (!v.last_name) bad.last_name = 'Add your last name.';
    if (!v.country) bad.country = 'Pick your country.';
    if (!v.platform) bad.platform = 'Pick your phone.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) bad.email = 'That email address doesn\'t look right.';
    return bad;
  }
  // Where this visit came from, for counting sign-ups by channel: the UTM tags on the link they
  // arrived by and the site that linked here (the Worker keeps only its host). Read from this page's
  // own address and referrer, so nothing is stored on the visitor's device.
  function signupSource() {
    var q = new URLSearchParams(location.search), out = {};
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { var v = q.get(k); if (v) out[k] = v; });
    try { if (document.referrer) out.referrer = new URL(document.referrer).origin; } catch (e) { /* none */ }
    return out;
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    fail.hidden = true;
    var v = {
      first_name: form.elements.first_name.value.trim(),
      last_name: form.elements.last_name.value.trim(),
      country: form.elements.country.value,
      platform: form.elements.platform.value,
      email: form.elements.email.value.trim(),
      website: form.elements.website.value,
      source: signupSource(),
    };
    var bad = validate(v);
    ['first_name', 'last_name', 'country', 'platform', 'email'].forEach(function (k) { setErr(k, bad[k]); });
    var firstBad = Object.keys(bad)[0];
    if (firstBad) { form.elements[firstBad].focus(); return; }
    go.disabled = true; go.textContent = 'Joining…';
    fetch('/api/beta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; }); })
      .then(function (res) {
        // A reply without our own words (an error page from Cloudflare, a static 405) says its status, so it can be traced.
        if (!res.ok) throw new Error(res.j.error || 'Something went wrong (error ' + res.status + '). Please try again in a moment.');
        document.getElementById('thanks-name').textContent = v.first_name;
        form.hidden = true;
        var t = document.getElementById('beta-thanks');
        t.hidden = false; t.focus();
      })
      .catch(function (e) {
        fail.textContent = e.message && e.message.indexOf('Failed to fetch') < 0 ? e.message : 'We couldn\'t reach the server. Check your connection and try again.';
        fail.hidden = false;
        go.disabled = false; go.textContent = 'Join the beta';
      });
  });
})();
