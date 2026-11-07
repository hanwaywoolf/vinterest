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
    const t = e.target.closest('[data-demo-open], a[href*="seed=demo"]');
    if (t && !box.contains(t)) { if (t.tagName === 'A' && (e.metaKey || e.ctrlKey || e.shiftKey || e.button)) return; e.preventDefault(); open(); }
    if (e.target.closest('[data-demo-close]')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !box.hidden) close();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.lid[data-demo-open]')) { e.preventDefault(); open(); }
  });
})();
