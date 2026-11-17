// Finds filled pills and badges whose text doesn't contrast with their fill: the same hue as the
// fill (crimson on a crimson tint), or under 4.5:1 against what's really behind it (white on yellow).
// Runs in the page.
module.exports = function pillAudit() {
  const parse = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = (c) => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1) || 1), l: (mx + mn) / 2 }; };
  // What's really behind an element: its own fill over every fill behind it.
  const behind = (el) => { const stack = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } }
    let col = { r: 255, g: 255, b: 255, a: 1 }; for (let i = stack.length - 1; i >= 0; i--) col = over(stack[i], col); return col; };
  const out = [];
  for (const el of document.querySelectorAll('#root *')) {
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && /[A-Za-z0-9]/.test(n.textContent)); // words or figures, not a flag emoji
    if (!own) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight * 3) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    // The pill: this element or one just above it with a coloured fill and rounded corners, narrower than the screen.
    let pill = null;
    for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) { const s = getComputedStyle(e), c = parse(s.backgroundColor), br = parseFloat(s.borderTopLeftRadius) || 0, w = e.getBoundingClientRect().width;
      if (c && c.a > 0.04 && br >= 6 && w < innerWidth * 0.8) { pill = e; break; } }
    if (!pill) continue;
    const fill = behind(pill), text = parse(cs.color); if (!text) continue;
    const t = over(text, fill), th = hsl(t), own2 = parse(getComputedStyle(pill).backgroundColor);
    const oh = own2 && hsl(own2), coloured = own2 && Math.max(own2.r, own2.g, own2.b) - Math.min(own2.r, own2.g, own2.b) > 40, sameHue = coloured && th.s > 0.35 && Math.min(Math.abs(oh.h - th.h), 360 - Math.abs(oh.h - th.h)) < 30;
    const cr = ratio(t, fill);
    // A coloured fill only (a neutral chip's muted text is a different matter); its own hue is fine only at 7:1 or more.
    if (coloured && ((sameHue && cr < 7) || cr < 4.5)) out.push({ text: el.textContent.trim().slice(0, 40), ratio: Math.round(cr * 10) / 10, sameHue, color: cs.color, fill: getComputedStyle(pill).backgroundColor });
  }
  const seen = new Set(); return out.filter((x) => { const k = x.text + x.color + x.fill; if (seen.has(k)) return false; seen.add(k); return true; });
};
