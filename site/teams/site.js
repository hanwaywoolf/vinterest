// Shared by every page: the Test Your List form (the reading behind it comes later).
const file = document.getElementById('file'), drop = document.getElementById('drop');
file.addEventListener('change', () => { if (file.files[0]) { drop.classList.add('has'); document.getElementById('dropText').textContent = file.files[0].name; drop.querySelector('b').textContent = 'Ready to read'; } });
document.getElementById('testForm').addEventListener('submit', (e) => { e.preventDefault(); document.getElementById('formNote').textContent = 'This is the mockup: the reading is wired up when the site is built. Your file never left your device.'; });

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
