/* The wide cut's left-hand stage (social/announce.mjs loads this into the page, after the app): for each part
   of the film, a label, a headline and a picture drawn in the app's own pen-and-wash (its berries, vine,
   flavour sketches and speech bubble from pwa-sketch.jsx, plus a few bottles and pages drawn here in the
   same hand), animated as the part begins. No bullet lists: the picture says what the screen is for, and
   one line under it says the rest. Runs as a classic script, so the app's top-level names are in scope. */
(() => {
  const E = React.createElement, INK = 'rgba(255,255,255,0.9)', SOFT = 'rgba(255,255,255,0.55)', PINK = '#ff8fa3', CR = '#C8324F', WINE = '#8B1A2F';
  const P = "Poppins,sans-serif";
  const st = document.createElement('style');
  st.textContent = `
@keyframes fxIn{from{opacity:0;transform:translateY(14px)}}
@keyframes fxPop{0%{opacity:0;transform:scale(.6)}70%{transform:scale(1.07)}}
@keyframes fxDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes fxGrow{from{transform:scaleX(0)}}
@keyframes fxRing{to{stroke-dashoffset:0}}
.fx .rv-in,.fx .in{animation:fxIn .6s cubic-bezier(.2,.8,.3,1) both}
.fx .rv-pop,.fx .pop{animation:fxPop .5s cubic-bezier(.2,.9,.3,1.2) both;transform-box:fill-box;transform-origin:center}
.fx .rv-draw,.fx .draw{stroke-dasharray:1;stroke-dashoffset:1;animation:fxDraw .9s ease-out both}
.fx .grow{transform-origin:left center;animation:fxGrow .9s cubic-bezier(.3,.9,.4,1) both}
#pn{position:fixed;z-index:4;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#fff;font-family:${P};transition:opacity .38s ease}
#pn.off{opacity:0}
#pn .lab{display:flex;align-items:center;gap:12px;font-size:14px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:${PINK}}
#pn .lab i{display:block;width:34px;height:2px;border-radius:1px;background:${CR}}
#pn h2{margin:16px 0 0;font:300 56px/1.06 ${P};letter-spacing:-1.8px}
#pn h2 em{font-style:normal;font-weight:600;color:${PINK}}
#pn .art{margin-top:26px;height:286px;display:flex;align-items:center}
#pn .cap{margin-top:22px;max-width:500px;font:300 21px/1.42 ${P};color:rgba(255,255,255,.74)}
#pn .cap b{font-weight:500;color:#fff}`;
  document.head.appendChild(st);

  const d = (s) => ({ animationDelay: s.toFixed(2) + 's' });
  const line = { fill: 'none', stroke: INK, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const txt = (x, y, s, size, o) => E('text', { x, y, textAnchor: 'middle', ...o, style: { fontFamily: P, fontSize: size + 'px', fill: SOFT, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 600, ...(o && o.style) } }, s);
  /* A bottle the pen draws in one stroke, with a wash on its label: about 60 x 150, its foot at y 150. */
  const BOTTLE = 'M24 6 h12 v30 c0 10 14 14 14 30 v76 c0 4 -3 6 -6 6 h-28 c-3 0 -6 -2 -6 -6 v-76 c0 -16 14 -20 14 -30 z';
  const bottle = (x, y, s, at, wash, key) => E('g', { key, transform: `translate(${x} ${y}) scale(${s})` },
    E('rect', { x: 13, y: 84, width: 34, height: 36, rx: 2, fill: wash || WINE, opacity: 0.7, className: 'in', style: d(at + 0.5) }),
    E('path', { d: BOTTLE, ...line, strokeWidth: 1.6 / s, pathLength: 1, className: 'draw', style: d(at) }),
    E('path', { d: 'M24 14 h12', ...line, strokeWidth: 1.2 / s, pathLength: 1, className: 'draw', style: d(at + 0.4) }));
  const wines = () => WineHistory.getAll();
  const rated = () => wines().filter((w) => Number(w.rating) > 0).sort((a, b) => b.rating - a.rating);

  const ART = {
    /* Scan: the three things it reads, each drawn as the pen would. */
    scan: () => E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
      bottle(26, 30, 1.25, 0.3, WINE, 'b'), txt(64, 262, 'A bottle', 12, { className: 'in', style: d(1.0) }),
      E('g', { key: 's' },
        [0, 1, 2, 3].map((i) => bottle(178 + i * 44, 64, 0.8, 1.1 + i * 0.16, [WINE, '#B8963E', WINE, '#C47A8A'][i], i)),
        E('path', { d: 'M168 190 H362', ...line, strokeWidth: 2, pathLength: 1, className: 'draw', style: d(1.9) }),
        [0, 1, 2, 3].map((i) => E('rect', { key: 't' + i, x: 186 + i * 44, y: 196, width: 30, height: 13, rx: 2, fill: 'none', stroke: SOFT, strokeWidth: 1, className: 'in', style: d(2.1 + i * 0.08) }))),
      txt(265, 262, 'A shelf', 12, { className: 'in', style: d(2.2) }),
      E('g', { key: 'l' },
        E('path', { d: 'M410 34 h104 a6 6 0 0 1 6 6 v170 a6 6 0 0 1 -6 6 h-104 a6 6 0 0 1 -6 -6 v-170 a6 6 0 0 1 6 -6 z', ...line, strokeWidth: 1.6, pathLength: 1, className: 'draw', style: d(2.4) }),
        E('path', { d: 'M424 58 h46', stroke: PINK, strokeWidth: 3, strokeLinecap: 'round', pathLength: 1, className: 'draw', style: d(2.9) }),
        [0, 1, 2, 3, 4].map((i) => E('g', { key: i },
          E('path', { d: `M424 ${84 + i * 24} h${[58, 44, 62, 50, 40][i]}`, ...line, stroke: SOFT, strokeWidth: 2, pathLength: 1, className: 'draw', style: d(3.0 + i * 0.12) }),
          E('path', { d: `M494 ${84 + i * 24} h12`, ...line, strokeWidth: 2, pathLength: 1, className: 'draw', style: d(3.1 + i * 0.12) })))),
      txt(462, 262, 'A wine list', 12, { className: 'in', style: d(3.4) })),

    /* The match: every berry is a wine they've rated, with the rating on it. */
    match: () => {
      const rs = rated().filter((w) => WineDNA._t(w.type) === 'red').slice(0, 12), L = KnowledgeMap.bunchSlots(rs.length, { fill: 0.82, seed: 'film-match' });
      const k = Math.min(27, 190 / L.h), xs = L.slots.map((p) => p.x), x0 = 150 - ((Math.max(...xs) + Math.min(...xs)) / 2) * k;
      const order = L.slots.map((p, i) => ({ ...p, i })).sort((a, b) => a.y - b.y);
      return E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
        E(SketchVine, { x: x0, y: 62, s: 1.8, ink: INK }),
        order.map((b, j) => { const w = rs[j] || rs[0];
          return E('g', { key: b.i, transform: `translate(${(x0 + b.x * k).toFixed(1)} ${(66 + k + b.y * k).toFixed(1)})` },
            E('g', { className: 'pop', style: d(0.3 + j * 0.14) },
              E('g', { transform: `scale(${k})` }, E(SketchBerry, { seed: 'm' + b.i, skin: 'red', state: w.rating >= 90 ? 'ripe' : 'grow', ink: INK })),
              E('text', { y: 5, textAnchor: 'middle', style: { fontFamily: P, fontSize: '13px', fontWeight: 700, fill: '#fff' } }, w.rating))); }),
        E('path', { d: 'M286 150 C330 132 356 132 392 146', ...line, strokeWidth: 1.6, pathLength: 1, className: 'draw', style: d(0.6 + rs.length * 0.14) }),
        E('path', { d: 'M380 136 L394 147 L378 154', ...line, strokeWidth: 1.6, pathLength: 1, className: 'draw', style: d(1.2 + rs.length * 0.14) }),
        E('g', { className: 'in', style: d(1.4 + rs.length * 0.14) },
          E('text', { x: 470, y: 150, textAnchor: 'middle', style: { font: `600 62px ${P}`, letterSpacing: '-2px', fill: '#4ADE80' } }, '94%'),
          txt(470, 180, 'Your match', 12)));
    },

    /* The story: the line worth saying out loud, under the pen's speech bubble. */
    story: () => E('div', { style: { display: 'flex', gap: 26, alignItems: 'flex-start' } },
      E('div', { style: { transform: 'scale(1.5)', transformOrigin: '0 0', width: 126, height: 90, flexShrink: 0 } }, E(SketchSay, { ink: INK, col: PINK })),
      E('div', { className: 'in', style: { ...d(0.9), font: `300 29px/1.3 ${P}`, letterSpacing: '-.4px', color: '#fff', maxWidth: 390 } },
        '“Reserva means it rested at least three years before release, one of them in oak.”')),

    /* WineDNA: the flavours that keep turning up in the wines they love, as the app sketches them. */
    dna: () => { const notes = [['Dried cherry', 'red'], ['Vanilla oak', 'oak'], ['Leather', 'earth'], ['Blackberry', 'dark']];
      return E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
        notes.map(([n, f], i) => E('g', { key: n, transform: `translate(${70 + i * 133} 118)` },
          E('circle', { r: 56, fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.14)', className: 'pop', style: d(0.25 + i * 0.3) }),
          E('g', { className: 'pop', style: d(0.4 + i * 0.3) }, E('g', { transform: 'scale(2.9)' }, E(SketchNoteIcon, { family: f, ink: INK, wash: [WINE, '#B8963E', '#B07A45', '#6b1f4a'][i] }))),
          txt(0, 96, n, 12, { className: 'in', style: d(0.7 + i * 0.3) }))),
        E('path', { d: 'M20 250 C140 236 260 262 380 246 S500 240 524 250', ...line, stroke: CR, strokeWidth: 2, pathLength: 1, className: 'draw', style: { ...d(1.7), animationDuration: '1.4s' } }));
    },

    /* Learn: a grape from the day it's scanned to the day it's known, in the bunch's own four looks. */
    learn: () => E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
      ['locked', 'start', 'grow', 'ripe'].map((state, i) => E('g', { key: state, transform: `translate(${72 + i * 132} 116)` },
        i ? E('path', { d: 'M-92 0 C-78 -12 -62 -12 -50 0', ...line, stroke: SOFT, strokeWidth: 1.4, pathLength: 1, className: 'draw', style: d(0.3 + i * 0.55) }) : null,
        E('g', { className: 'pop', style: d(0.2 + i * 0.55) }, E('g', { transform: 'scale(44)' }, E(SketchBerry, { seed: 'learn' + i, skin: 'red', state, ink: INK }))),
        txt(0, 86, ['Not yet met', 'Scanned', 'Studying', 'Mastered'][i], 12, { className: 'in', style: d(0.5 + i * 0.55) }))),
      E(SketchVine, { x: 468, y: 72, s: 2.2, ink: INK })),

    /* Quizzes: five questions round a ring, each one landing green. */
    quiz: () => { const R = 96, C = 2 * Math.PI * R, seg = C / 5;
      return E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
        E('g', { transform: 'translate(132 140) rotate(-90)' },
          E('circle', { r: R, fill: 'none', stroke: 'rgba(255,255,255,0.1)', strokeWidth: 12 }),
          [0, 1, 2, 3, 4].map((i) => E('circle', { key: i, r: R, fill: 'none', stroke: '#4ADE80', strokeWidth: 12, strokeLinecap: 'round', strokeDasharray: `${seg - 16} ${C - seg + 16}`, strokeDashoffset: -(i * seg + 8), className: 'in', style: { ...d(0.5 + i * 0.5), filter: 'drop-shadow(0 0 8px rgba(74,222,128,.5))' } }))),
        E('text', { x: 132, y: 160, textAnchor: 'middle', className: 'in', style: { ...d(0.3), font: `600 72px ${P}`, fill: '#fff' } }, '5'),
        [['Which grape is behind Rioja?', 0.9], ['What does Reserva promise?', 1.5], ['Where is Ribera del Duero?', 2.1]].map(([q, at], i) =>
          E('g', { key: i, className: 'in', style: d(at), transform: `translate(280 ${72 + i * 62})` },
            E('rect', { width: 258, height: 46, rx: 12, fill: 'rgba(255,255,255,0.05)', stroke: 'rgba(255,255,255,0.16)' }),
            E('text', { x: 18, y: 29, style: { fontFamily: P, fontSize: '15px', fill: '#fff' } }, q))));
    },

    /* Written for you: the line every piece opens on, saying which bottle it started from. */
    article: () => E('div', { style: { position: 'relative', paddingLeft: 30 } },
      E('svg', { width: 6, height: 150, style: { position: 'absolute', left: 0, top: 6, overflow: 'visible' } }, E('path', { d: 'M3 0 V150', stroke: CR, strokeWidth: 4, strokeLinecap: 'round', pathLength: 1, className: 'draw' })),
      E('div', { className: 'in', style: { ...d(0.3), font: `600 13px ${P}`, letterSpacing: '.2em', textTransform: 'uppercase', color: SOFT } }, 'Written for you · 3 min'),
      E('div', { className: 'in', style: { ...d(0.6), marginTop: 12, font: `500 38px/1.14 ${P}`, letterSpacing: '-.8px', color: '#fff' } }, 'From Rioja to Rhône Valley'),
      E('div', { className: 'in', style: { ...d(1.1), marginTop: 16, font: `500 19px/1.4 ${P}`, color: PINK } }, 'Because you gave Châteauneuf-du-Pape La Crau a 91.')),

    /* Mastery, in the order its screen runs. First the chart: what they know of each area, drawn by the pen
       over a wash, with the dotted line of a month ago inside it. */
    shape: () => { const m = KnowledgeMap.compute(wines()), as = m.areas.slice(0, 12), n = as.length, cx = 150, cy = 143, R = 112;
      const v = (a) => Math.max(0.1, Math.min(1, (a.score > 1 ? a.score / 100 : a.score) * 1.25 + 0.1));
      const pt = (i, r) => { const t = -Math.PI / 2 + (i / n) * Math.PI * 2; return [(cx + Math.cos(t) * r).toFixed(1), (cy + Math.sin(t) * r).toFixed(1)]; };
      const poly = (f) => as.map((a, i) => pt(i, R * f(a))).map((q, i) => (i ? 'L' : 'M') + q.join(' ')).join(' ') + ' Z';
      const top = [...as].sort((a, b) => b.score - a.score).slice(0, 3);
      return E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
        [0.33, 0.66, 1].map((f, k) => E('circle', { key: k, cx, cy, r: R * f, ...line, stroke: 'rgba(255,255,255,.22)', strokeWidth: 1.2, pathLength: 1, className: 'draw', style: d(0.2 + k * 0.18) })),
        as.map((a, i) => { const q = pt(i, R); return E('path', { key: 's' + i, d: `M${cx} ${cy} L${q[0]} ${q[1]}`, ...line, stroke: 'rgba(255,255,255,.13)', strokeWidth: 1, pathLength: 1, className: 'draw', style: d(0.5 + i * 0.03) }); }),
        E('path', { d: poly((a) => v(a) * 0.55), ...line, stroke: SOFT, strokeWidth: 1.4, strokeDasharray: '3 5', className: 'in', style: d(1.3) }),
        E('path', { d: poly(v), fill: CR, opacity: 0.42, className: 'pop', style: { ...d(1.5), transformOrigin: `${cx}px ${cy}px`, transformBox: 'view-box' } }),
        E('path', { d: poly(v), ...line, strokeWidth: 2, pathLength: 1, className: 'draw', style: { ...d(1.5), animationDuration: '1.4s' } }),
        as.map((a, i) => { const q = pt(i, R * v(a)); return E('circle', { key: 'd' + i, cx: q[0], cy: q[1], r: 4, fill: '#fff', className: 'pop', style: d(2.3 + i * 0.05) }); }),
        top.map((a, i) => E('g', { key: 't' + i, className: 'in', style: d(2.6 + i * 0.3) },
          E('text', { x: 326, y: 82 + i * 62, style: { font: `600 34px ${P}`, letterSpacing: '-1px', fill: i ? '#fff' : PINK } }, Math.round(a.score > 1 ? a.score : a.score * 100) + '%'),
          E('text', { x: 328, y: 104 + i * 62, style: { font: `600 12px ${P}`, letterSpacing: '.16em', textTransform: 'uppercase', fill: SOFT } }, a.label || a.name || a.id))));
    },

    /* Then the grapes: the Learn list's fifty as two bunches, a few ripe and the rest waiting, each named. */
    grapes: () => E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
      [['red', 130, 27, 'Red'], ['white', 390, 23, 'White']].map(([skin, cx, n, name], bi) => { const L = KnowledgeMap.bunchSlots(n, { fill: 0.82, seed: 'film-' + skin }), k = Math.min(14, 160 / L.h);
        const xs = L.slots.map((p) => p.x), x0 = cx - ((Math.max(...xs) + Math.min(...xs)) / 2) * k, rnd = KnowledgeMap._rng('film' + skin);
        return E('g', { key: skin },
          E(SketchVine, { x: x0, y: 64, s: 1.5, ink: INK }),
          L.slots.map((p, i) => ({ ...p, i })).sort((a, b) => a.y - b.y).map((b, j) => { const r = rnd(), state = r < 0.18 ? 'ripe' : r < 0.42 ? 'grow' : r < 0.6 ? 'start' : 'locked';
            return E('g', { key: b.i, transform: `translate(${(x0 + b.x * k).toFixed(1)} ${(68 + k + b.y * k).toFixed(1)})` },
              E('g', { className: 'pop', style: d(0.2 + bi * 0.5 + j * 0.055) }, E('g', { transform: `scale(${k})` }, E(SketchBerry, { seed: skin + b.i, skin, state, ink: INK })))); }),
          E('text', { x: cx + 96, y: 168, textAnchor: 'middle', className: 'in', style: { ...d(1.8 + bi * 0.4), font: `600 44px ${P}`, letterSpacing: '-1px', fill: '#fff' } }, n),
          txt(cx + 96, 190, name, 12, { className: 'in', style: d(1.9 + bi * 0.4) })); })),

    /* Then the map: Europe's coast in one thin line, and a pin dropping on each region they've opened. */
    map: () => { const v = KnowledgeMap.views()[0], rm = KnowledgeMap.regionMap(wines())[0] || { pins: [] }, k = 286 / v.h;
      const open = rm.pins.filter((p) => p.state === 'open').sort((a, b) => a.x - b.x), rest = rm.pins.filter((p) => p.state !== 'open');
      return E('svg', { viewBox: `0 0 ${Math.round(v.w * k)} 286`, width: Math.round(v.w * k), height: 286, style: { WebkitMaskImage: 'radial-gradient(ellipse 58% 64% at 44% 56%, #000 58%, transparent 100%)', maskImage: 'radial-gradient(ellipse 58% 64% at 44% 56%, #000 58%, transparent 100%)' } },
        E('g', { transform: `scale(${k})` },
          E('path', { d: v.land, fill: 'rgba(255,255,255,.05)', stroke: 'rgba(255,255,255,.42)', strokeWidth: 1.1 / k, strokeLinejoin: 'round', className: 'in', style: d(0.2) }),
          rest.map((p, i) => E('circle', { key: 'r' + i, cx: p.x, cy: p.y, r: 2.6 / k, fill: 'rgba(255,255,255,.3)', className: 'in', style: d(0.8 + i * 0.02) })),
          open.map((p, i) => E('g', { key: 'o' + i, transform: `translate(${p.x} ${p.y})` },
            E('g', { className: 'pop', style: d(1.5 + i * 0.5) },
              E('circle', { r: 13 / k, fill: CR, opacity: 0.28 }), E('circle', { r: 6.5 / k, fill: PINK, stroke: '#fff', strokeWidth: 1.6 / k })),
            E('text', { x: [-16, -14, 16, 16][i % 4] / k, y: [22, -14, -14, 24][i % 4] / k, textAnchor: i % 4 < 2 ? 'end' : 'start', className: 'in',
              style: { ...d(1.8 + i * 0.5), font: `600 ${14 / k}px ${P}`, fill: '#fff', paintOrder: 'stroke', stroke: '#0b0a0b', strokeWidth: 4 / k } }, p.name)))));
    },

    /* Last the palate: a ring per trait they've called blind, lit to how close their calls have been. */
    palate: () => { const ax = Palate.compute(wines()).axes.slice(0, 3), cols = ['#C8324F', '#E0A93B', '#8E6BD6'];
      return E('svg', { viewBox: '0 0 540 286', width: 540, height: 286, style: { overflow: 'visible' } },
        ax.map((a, i) => { const cx = 84 + i * 176, cy = 128, r = 66, c = 2 * Math.PI * r, f = a.score / 100;
          return E('g', { key: a.id },
            E('circle', { cx, cy, r, fill: 'none', stroke: 'rgba(255,255,255,.14)', strokeWidth: 9 }),
            E('circle', { cx, cy, r, fill: 'none', stroke: cols[i], strokeWidth: 9, strokeLinecap: 'round', transform: `rotate(-90 ${cx} ${cy})`, pathLength: 1,
              style: { strokeDasharray: `${f} 1`, strokeDashoffset: f, animation: `fxRing 1.3s cubic-bezier(.3,.8,.3,1) ${(0.4 + i * 0.35).toFixed(2)}s both`, filter: `drop-shadow(0 0 10px ${cols[i]})` } }),
            E('text', { x: cx, y: cy + 15, textAnchor: 'middle', className: 'in', style: { ...d(0.9 + i * 0.35), font: `600 42px ${P}`, letterSpacing: '-1px', fill: '#fff' } }, a.score),
            txt(cx, cy + r + 38, a.name, 13, { className: 'in', style: d(1.0 + i * 0.35) })); }));
    },

    /* Vinny: the kind of thing people ask, each in its own bubble. */
    vinny: () => E('div', { style: { display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' } },
      [['What goes with roast lamb?', 0], ['Is 2016 a good year for Rioja?', 46], ['What does “tannin” mean?', 14], ['Which bottle should I take to dinner?', 70]].map(([q, x], i) =>
        E('div', { key: i, className: 'pop', style: { ...d(0.3 + i * 0.6), marginLeft: x, padding: '13px 22px', border: '1.5px solid rgba(255,255,255,.3)', borderRadius: i % 2 ? '22px 22px 6px 22px' : '22px 22px 22px 6px', background: i === 1 ? 'rgba(200,50,79,.22)' : 'rgba(255,255,255,.05)', font: `400 20px ${P}`, color: '#fff' } }, q))),

    /* My Wines: their bottles in a row, the best with their ratings, and where they came from. */
    wines: () => { const all = wines(), top = rated(), flags = [...new Set(all.map((w) => Regions.wineFlag(w)).filter(Boolean))], n = Math.min(all.length, 11);
      return E('div', null,
        E('svg', { viewBox: '0 0 540 190', width: 540, height: 190, style: { overflow: 'visible', display: 'block' } },
          Array.from({ length: n }, (_, i) => E('g', { key: i },
            bottle(4 + i * 48, 22, 0.92, 0.2 + i * 0.12, WINE, 'b' + i),
            top[i] ? E('text', { x: 4 + i * 48 + 27.6, y: 121, textAnchor: 'middle', className: 'in', style: { ...d(1.0 + i * 0.12), fontFamily: P, fontSize: '13px', fontWeight: 700, fill: '#fff' } }, top[i].rating) : null)),
          E('path', { d: 'M0 164 H532', ...line, strokeWidth: 2, pathLength: 1, className: 'draw', style: { ...d(1.6), animationDuration: '1.2s' } })),
        E('div', { className: 'in', style: { ...d(2.2), marginTop: 16, display: 'flex', alignItems: 'center', gap: 14, font: `300 30px ${P}`, letterSpacing: '4px' } },
          flags.join(' '), E('span', { style: { font: `600 13px ${P}`, letterSpacing: '.18em', textTransform: 'uppercase', color: SOFT } }, all.length + ' bottles · ' + flags.length + ' countries')));
    },
  };

  const COPY = {
    scan: ['Scan', 'Point it at any ', 'label', 'It reads the label in <b>seconds</b>. No typing, no searching.'],
    match: ['Your match', 'Know before you ', 'buy', 'Every berry is a wine you’ve rated. <b>Together they call the next one.</b>'],
    story: ['The story', 'Every bottle has a ', 'story', 'Its grape, its place, and <b>one thing worth saying</b> when you pour it.'],
    dna: ['WineDNA', 'Your taste, ', 'mapped', 'The flavours and styles <b>you</b> keep coming back to, in plain words.'],
    learn: ['Learn', 'Learn as you ', 'sip', 'Every scan opens its grape and its region. <b>The rest follows.</b>'],
    quiz: ['Quizzes', 'Five questions a ', 'round', 'On the grapes and regions <b>your scans unlock</b>, each with the fact behind it.'],
    article: ['Written for you', 'Articles nobody else ', 'gets', 'Written from your WineDNA and <b>the bottles you’ve rated</b>.'],
    shape: ['Mastery', 'Watch what you know ', 'grow', 'Every corner of wine on one chart. <b>The dotted line is you, a month ago.</b>'],
    grapes: ['Mastery · Grapes', 'Fifty grapes, a ', 'berry each', 'A scan opens the grape. <b>Its quiz fills the berry in.</b>'],
    map: ['Mastery · Regions', 'Your own wine ', 'map', 'Every bottle drops a pin. <b>Learn the region and it lights up.</b>'],
    palate: ['Mastery · Palate', 'Train your ', 'palate', 'Call the body, acidity and tannins blind, <b>then see how close you were</b>.'],
    vinny: ['Ask Vinny', 'A sommelier who knows ', 'you', 'Ask anything. <b>The answers come from your own wines.</b>'],
    wines: ['My Wines', 'Every bottle, ', 'remembered', 'What you rated it, what you paid and <b>where you had it</b>.'],
  };

  let root = null, now = null;
  window.__stage = (key) => {
    const pn = document.getElementById('pn'); if (!pn) return;
    if (!key) { pn.className = 'off'; now = null; return; }
    const show = () => { now = key; const c = COPY[key];
      if (!root) root = ReactDOM.createRoot(pn);
      root.render(E('div', { className: 'fx', key },
        E('div', { className: 'lab in' }, E('i'), c[0]),
        E('h2', { className: 'in', style: d(0.12) }, c[1], E('em', null, c[2]), '.'),
        E('div', { className: 'art' }, ART[key]()),
        E('div', { className: 'cap in', style: d(0.5), dangerouslySetInnerHTML: { __html: c[3] } })));
      pn.className = ''; };
    if (now) { pn.className = 'off'; setTimeout(show, 400); } else show();
  };
})();
