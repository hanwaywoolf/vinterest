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
    stage.appendChild(row);
    sec._nav = { segs: segs, prev: prev, next: next, slot: slot };
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
     A demo section is one screen tall and the page scrolls past it normally. When it's mostly on
     screen its demo plays once by itself: p (0 to 1) advances over data-duration seconds, the screen
     moves to p, and the caption whose data-at we've reached is lit. When it finishes it stays on the
     last caption; it never restarts. The reader is in charge from then on, and any of these stops the
     autoplay and holds the demo where it is:
       - clicking a caption (or pressing Enter on it), or a dot on a phone;
       - scrolling the mouse wheel over the caption text, which steps through the captions one at a
         time and, at the first or last one, lets the page scroll on.
     With reduced motion nothing plays: the screen sits at the top and every caption shows; a click
     still jumps to that point. */
  // ?speed=8 plays the demos eight times as fast (the tests use it).
  var speed = parseFloat(new URLSearchParams(location.search).get('speed')) || 1;
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]')).map(function (el) {
    return { el: el, copy: el.querySelector('.copy'), steps: Array.prototype.slice.call(el.querySelectorAll('.steps li')), p: 0, phase: 'play', on: false, step: -1, shown: -1,
      lock: 0, lastWheel: 0, dur: (parseFloat(el.getAttribute('data-duration')) || 16) * 1000 / speed };
  });
  features.forEach(function (f) {
    f.demos = demos.filter(function (d) { return d.feature === f.el; });
    f.nav = f.el._nav;
    f.steps.forEach(function (li, i) {
      li.at = parseFloat(li.getAttribute('data-at') || '0');
      // Where a click holds the demo: just into its part, or data-hold when the part is a run of things.
      li.holdAt = li.hasAttribute('data-hold') ? parseFloat(li.getAttribute('data-hold')) : Math.min(1, li.at + 0.002);
      // A part that plays something (the rating slider) plays it whenever the part is chosen, up to here.
      li.animTo = li.hasAttribute('data-anim-to') ? parseFloat(li.getAttribute('data-anim-to')) : null;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.addEventListener('click', function () { hold(f, i); });
      li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); hold(f, i); } });
      f.nav.segs[i].addEventListener('click', function () { hold(f, i); });
    });
    f.nav.prev.addEventListener('click', function () { move(f, -1); });
    f.nav.next.addEventListener('click', function () { move(f, 1); });
    /* Swiping the phone sideways moves to the next or previous part (vertical drags still scroll the page). */
    var sx = 0, sy = 0, sid = null;
    f.nav.slot.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; });
    f.nav.slot.addEventListener('pointerup', function (e) {
      if (e.pointerId !== sid) return;
      sid = null;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) move(f, dx < 0 ? 1 : -1);
    });
    f.nav.slot.addEventListener('pointercancel', function () { sid = null; });
    /* The mouse wheel over the text steps through the captions, one caption per flick: a flick is a run
       of wheel events (a trackpad's momentum, or notches in quick succession) with no gap of 260ms
       or more, so a hard flick can't run the whole demo, and captions can't change faster than every
       0.7s. At the first or last caption the page scrolls on, and so it does when the reader keeps
       scrolling for more than 1.2s without a pause: they're travelling down the page, not reading. */
    if (!reduced) f.copy.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) < 4 || e.ctrlKey) return;
      var to = f.step + (e.deltaY > 0 ? 1 : -1);
      if (to < 0 || to >= f.steps.length) return;
      var now = performance.now();
      var fresh = now - f.lastWheel > 260;
      f.lastWheel = now;
      if (fresh) { f.flickStart = now; f.flickDone = false; }
      if (now - f.flickStart > 1200) return; // sustained: let the page scroll
      e.preventDefault();
      if (f.flickDone || now < f.lock) return;
      f.flickDone = true;
      f.lock = now + 700;
      hold(f, to);
    }, { passive: false });
  });
  /* The caption block is as tall as its tallest state (a different caption lit each time), so opening
     a longer one never moves the block or pushes it past the section. Measured with each caption lit
     in turn and no animation; on a phone the captions already share one cell. */
  function reserveSteps() {
    features.forEach(function (f) {
      var list = f.el.querySelector('.steps');
      list.style.minHeight = '';
      if (window.innerWidth <= 900 || !f.steps.length) return;
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
  function hold(f, i) {
    var li = f.steps[i];
    f.phase = 'held';
    f.p = li.holdAt;
    if (li.animTo != null) {
      if (reduced) f.p = li.animTo;
      else { f.phase = 'anim'; f.animFrom = li.holdAt; f.animTo = li.animTo; f.animT = 0; f.animMs = 2600 / speed; }
    }
    apply(f);
  }
  // The arrows and swipes: the next or previous part, if there is one.
  function move(f, dir) { var to = f.step + dir; if (to >= 0 && to < f.steps.length) hold(f, to); }
  function apply(f) {
    if (Math.abs(f.p - f.shown) < 0.0002) return;
    f.shown = f.p;
    f.el.style.setProperty('--p', f.p.toFixed(4));
    var step = 0;
    f.steps.forEach(function (li, i) { if (f.p >= li.at - 0.001) step = i; });
    if (step !== f.step) {
      f.step = step;
      f.steps.forEach(function (li, i) { li.classList.toggle('on', i === step); });
      f.nav.prev.setAttribute('aria-disabled', step === 0 ? 'true' : 'false');
      f.nav.next.setAttribute('aria-disabled', step === f.steps.length - 1 ? 'true' : 'false');
    }
    // Lines before this part are full, the one being played fills as it goes, the rest are empty.
    f.nav.segs.forEach(function (b, i) {
      var end = i + 1 < f.steps.length ? f.steps[i + 1].at : 1, start = f.steps[i].at;
      var fill = i < step ? 1 : i > step ? 0 : (f.phase === 'play' ? clamp((f.p - start) / Math.max(0.001, end - start), 0, 1) : 1);
      b.firstChild.firstChild.style.setProperty('--f', fill.toFixed(3));
      b.classList.toggle('on', i === step);
    });
    f.demos.forEach(function (d) { d.progress = f.p; if (d.api) d.api.update(f.p); });
  }
  if (!reduced) {
    var fio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { features.forEach(function (f) { if (f.el === e.target) f.on = e.isIntersecting; }); });
    }, { threshold: 0.35 }) : null; // early: a section is one screen, and readers scroll on quickly
    features.forEach(function (f) { if (fio) fio.observe(f.el); else f.on = true; });
    var last = 0;
    var tick = function (now) {
      var dt = Math.min(64, now - (last || now));
      last = now;
      features.forEach(function (f) {
        if (!f.on) return;
        if (f.phase === 'play') {
          f.p = Math.min(1, f.p + dt / f.dur);
          if (f.p >= 1) f.phase = 'done';
          apply(f);
        } else if (f.phase === 'anim') {
          f.animT += dt;
          var k = Math.min(1, f.animT / f.animMs);
          f.p = f.animFrom + (f.animTo - f.animFrom) * ease(k);
          if (k >= 1) f.phase = 'held';
          apply(f);
        }
      });
      raf(tick);
    };
    raf(tick);
  } else {
    features.forEach(function (f) { f.steps.forEach(function (li) { li.classList.add('on'); }); apply(f); });
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) bad.email = 'That email address doesn\'t look right.';
    return bad;
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    fail.hidden = true;
    var v = {
      first_name: form.elements.first_name.value.trim(),
      last_name: form.elements.last_name.value.trim(),
      country: form.elements.country.value,
      email: form.elements.email.value.trim(),
      website: form.elements.website.value,
    };
    var bad = validate(v);
    ['first_name', 'last_name', 'country', 'email'].forEach(function (k) { setErr(k, bad[k]); });
    var firstBad = Object.keys(bad)[0];
    if (firstBad) { form.elements[firstBad].focus(); return; }
    go.disabled = true; go.textContent = 'Joining…';
    fetch('/api/beta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(v) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (!res.ok) throw new Error(res.j.error || 'Something went wrong. Please try again in a moment.');
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
