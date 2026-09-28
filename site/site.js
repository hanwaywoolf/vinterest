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

  /* ── Scroll choreography ──
     p is how far through a feature's pinned stretch we are (0 to 1). The demo's screen scrolls to
     p, and the caption whose data-at we've reached is lit. p eases toward the scroll position so a
     wheel notch glides instead of jumping. With reduced motion nothing is driven: the screens sit
     at the top and every caption shows. */
  var features = Array.prototype.slice.call(document.querySelectorAll('[data-feature]')).map(function (el) {
    return { el: el, steps: Array.prototype.slice.call(el.querySelectorAll('.steps li')), cur: 0, target: 0, on: false, step: -1 };
  });
  features.forEach(function (f) {
    f.demos = demos.filter(function (d) { return d.feature === f.el; });
    f.steps.forEach(function (li) { li.at = parseFloat(li.getAttribute('data-at') || '0'); });
  });
  function targetFor(f) {
    var r = f.el.getBoundingClientRect();
    var total = f.el.offsetHeight - window.innerHeight;
    return total > 0 ? clamp(-r.top / total, 0, 1) : 0;
  }
  function apply(f) {
    f.el.style.setProperty('--p', f.cur.toFixed(4));
    var step = 0;
    f.steps.forEach(function (li, i) { if (f.cur >= li.at - 0.001) step = i; });
    if (step !== f.step) {
      f.step = step;
      f.steps.forEach(function (li, i) { li.classList.toggle('on', i === step); });
    }
    f.demos.forEach(function (d) { d.progress = f.cur; if (d.api) d.api.update(f.cur); });
  }
  if (!reduced) {
    var fio = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { features.forEach(function (f) { if (f.el === e.target) f.on = e.isIntersecting; }); });
    }, { rootMargin: '20% 0px' }) : null;
    features.forEach(function (f) { if (fio) fio.observe(f.el); else f.on = true; });
    var tick = function () {
      features.forEach(function (f) {
        if (!f.on) return;
        f.target = targetFor(f);
        var d = f.target - f.cur;
        f.cur = Math.abs(d) < 0.0004 ? f.target : f.cur + d * 0.18;
        apply(f);
      });
      raf(tick);
    };
    raf(tick);
  } else {
    features.forEach(function (f) { f.steps.forEach(function (li) { li.classList.add('on'); }); });
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
