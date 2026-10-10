/* Vinterest — ink-and-wash sketches of grapes, for Mastery's grape bunches and each grape's own
   page. Drawn like a quick pen study: a slightly wobbly outline that overshoots where it closes,
   a loose flat wash of the wine's own colour laid a little off the line, a couple of hatch
   strokes for shade, no gradients or highlights. Every wobble is seeded by name, so a sketch
   is the same each time. Colours are the app's: crimson for red skins, the white wines' gold,
   rosé for pink skins, and an ink brown for the lines. */
const SKETCH_INK='#3B2B24', SKETCH_PENCIL='#C9BFB5';
const SKETCH_WASH={red:'#8B1A2F',white:'#B8963E',pink:'#C47A8A',green:'#9AA35A',russet:'#B07A45',leaf:'#7E9150',leafRed:'#A8323E'};

/* A smooth closed-ish path through points (Catmull-Rom as cubic Béziers). */
function _sketchPath(pts,closed){
  const P=closed?[pts[pts.length-1],...pts,pts[0],pts[1]]:[pts[0],...pts,pts[pts.length-1]];
  let d=`M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for(let i=1;i<P.length-2;i++){
    const [p0,p1,p2,p3]=[P[i-1],P[i],P[i+1],P[i+2]];
    const c1=[p1[0]+(p2[0]-p0[0])/6,p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6,p2[1]-(p3[1]-p1[1])/6];
    d+=`C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d+(closed?'Z':'');
}
/* A hand-drawn circle of radius 1: a little uneven, and the pen runs past where it started. */
const _sketchCache={};
function sketchBerryPaths(seed){
  if(_sketchCache[seed]) return _sketchCache[seed];
  const rnd=KnowledgeMap._rng('berry'+seed), start=rnd()*Math.PI*2, N=9;
  const wob=Array.from({length:N+2},()=>0.94+rnd()*0.12);
  const ring=over=>Array.from({length:N+1+(over?2:0)},(_,i)=>{ const t=start+i*(Math.PI*2/N)*(over?1.04:1), r=wob[i%(N+2)]*(over&&i>N?0.97:1); return [Math.cos(t)*r,Math.sin(t)*r]; });
  const line=_sketchPath(ring(true),false);
  const wash=_sketchPath(ring(false).slice(0,N),true);
  const h=0.2+rnd()*0.15;
  const hatch=`M${(0.15+h).toFixed(2)} 0.62 Q0.55 0.5 0.66 ${(0.18+h/2).toFixed(2)} M${(0.02+h).toFixed(2)} 0.76 Q0.45 0.68 0.6 0.46`;
  return _sketchCache[seed]={line,wash,hatch,dx:0.1+rnd()*0.1,dy:0.12+rnd()*0.08};
}
/* One berry, radius 1 (scale the group it sits in). state: 'locked' a pencil outline only;
   'start' an outline in its colour; 'grow' washed; 'ripe' washed with hatching; fading dashes
   the line and thins the wash. */
function SketchBerry({seed,skin,state,fading,wash,ink=SKETCH_INK}){
  const p=sketchBerryPaths(seed), col=wash||SKETCH_WASH[skin]||SKETCH_WASH.red;
  const line={fill:'none',strokeLinecap:'round',vectorEffect:'non-scaling-stroke'};
  if(state==='locked') return <g><path d={p.wash} fill="#FBF8F3"/><path d={p.line} {...line} stroke={SKETCH_PENCIL} strokeWidth="1.1"/></g>;
  return <g>
    <path d={p.wash} fill={state==='start'?'#FBF8F3':col} opacity={state==='start'?1:fading?0.28:state==='ripe'?0.72:0.55} transform={`translate(${p.dx} ${p.dy})`}/>
    <path d={p.line} {...line} stroke={state==='start'?col:ink} strokeWidth={state==='start'?1.5:1.2} strokeDasharray={fading?'3 3':null}/>
    {state==='ripe'&&<path d={p.hatch} {...line} stroke={ink} strokeWidth="0.9" opacity="0.7"/>}
  </g>;
}
/* A vine leaf: five lobes with a notch where the stalk joins, a lightly toothed edge and three
   veins, about 30 units across, the stalk at (0, 0) and the top lobe pointing up. */
function _leafPath(){
  const pts=[], N=90;
  for(let i=0;i<N;i++){
    const t=-Math.PI/2+i*(Math.PI*2/N);
    const r=13*(0.42+0.58*Math.pow(Math.abs(Math.sin(2.5*(t+Math.PI/2))),0.55))*(i%2?1:0.93);
    pts.push([Math.cos(t)*r,-Math.sin(t)*r-5.5]);
  }
  return _sketchPath(pts,true);
}
const _LEAF=_leafPath();
/* The top of a bunch: the stalk, a curling tendril and a leaf, at (x, y) where the berries begin. */
function SketchVine({x,y,s=1,leafRed,ink=SKETCH_INK}){
  const line={fill:'none',stroke:ink,strokeLinecap:'round'};
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d="M0 4 C0 -6 2 -14 7 -22" {...line} strokeWidth="2.2"/>
    <path d="M3 -12 C10 -14 14 -10 12 -6 C10 -3 7 -5 8 -7" {...line} strokeWidth="1"/>
    <g transform="translate(2 -14) rotate(-38) scale(1.25)">
      <path d={_LEAF} fill={leafRed?SKETCH_WASH.leafRed:SKETCH_WASH.leaf} opacity="0.42" transform="translate(1.2 1)"/>
      <path d={_LEAF} {...line} strokeWidth="0.9"/>
      <path d="M0 -5 L0 -17 M0 -6 L-10 -14 M0 -6 L10 -14 M0 -6 L-11 -6 M0 -6 L11 -6" {...line} strokeWidth="0.6" opacity="0.6"/>
    </g>
  </g>;
}

/* The palate traits as little pen-and-wash objects, each the thing the app compares it to
   (Palate.HOW): a glass of wine with tears running down the inside for body (alcohol drives both),
   a lemon for acidity, a cup of stewed black tea for tannins, an apple for texture. Drawn about 40
   units across, centred on (0, 0). `inkOnly` (WineDNA, whose colour is the wine type's) draws the
   pen lines alone, so a lemon stays a lemon by its shape; only the wine in the glass is washed,
   in `wine` (the type's colour), since it is wine. */
const SKETCH_TRAIT={body:'#B4566B',acidity:'#E8C547',tannins:'#9A6440',texture:'#A9B85E'};
function SketchTraitIcon({id,inkOnly=false,wine}){
  const ink={fill:'none',stroke:SKETCH_INK,strokeLinecap:'round',strokeLinejoin:'round'}, wash=SKETCH_TRAIT[id];
  if(id==='body'){
    const bowl='M-11 -17 C-11 -4 -8 4 0 4 C8 4 11 -4 11 -17';
    const liquid='M-10.4 -7 C-9.5 0 -6 4 0 4 C6 4 9.5 0 10.4 -7 C5 -5.6 -5 -5.6 -10.4 -7 Z';
    return <g transform="scale(1.3) translate(0 0.5)">
      <path d={liquid} fill={wine||wash} opacity={inkOnly?0.6:0.75} transform="translate(0.8 0.8)"/>
      <path d={bowl} {...ink} strokeWidth="1.6"/>
      <path d="M-11 -17 C-5 -18.2 5 -18.2 11 -17" {...ink} strokeWidth="1.1" opacity="0.7"/>
      <path d="M-10.4 -7 C-5 -5.6 5 -5.6 10.4 -7" {...ink} strokeWidth="1" opacity="0.7"/>
      <path d="M0 4 L0 15" {...ink} strokeWidth="1.6"/>
      <path d="M-8.5 16.5 C-4 14.6 4 14.6 8.5 16.5" {...ink} strokeWidth="1.6"/>
      {/* the tears: where alcohol, and so body, shows on the glass */}
      <path d="M-8 -15.5 C-8.4 -13 -7.6 -11 -8.1 -8.6 M-4.6 -16.4 C-5 -14.2 -4.3 -12.4 -4.7 -10.6 M8.1 -15.5 C8.5 -13.2 7.8 -11.4 8.2 -9.4" {...ink} strokeWidth="1" opacity="0.7"/>
      <circle cx="-8.1" cy="-8.3" r="0.9" fill={SKETCH_INK} opacity="0.6"/><circle cx="-4.7" cy="-10.3" r="0.8" fill={SKETCH_INK} opacity="0.6"/><circle cx="8.2" cy="-9.1" r="0.9" fill={SKETCH_INK} opacity="0.6"/>
    </g>;
  }
  const shape={
    acidity:{d:'M-17 0 C-17 -9 -8 -13 0 -13 C8 -13 17 -9 17 0 C17 9 8 13 0 13 C-8 13 -17 9 -17 0 Z',
      extra:<><path d="M17 0 L20.5 -0.6 M-17 0 L-20.5 0.6" {...ink} strokeWidth="1.6"/><path d="M-9 -5 C-4 -8 4 -8 9 -5" {...ink} strokeWidth="1" opacity="0.55"/>
        {/* Without its yellow, the peel's dimples and a leaf keep it a lemon. */}
        {inkOnly&&<>{[[-8,2],[-3,5],[3,3],[8,-1],[-1,-1],[6,6],[-11,-3]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="0.75" fill={SKETCH_INK} opacity="0.5"/>)}
          <path d="M18 -1 C20 -7 25 -9 28 -8 C26 -4 22 -2 18 -1 Z M18 -1 C21 -4 24 -6 27 -7.5" {...ink} strokeWidth="1.1"/></>}</>},
    tannins:{d:'M-15 -8 L15 -8 C15 4 9 12 0 12 C-9 12 -15 4 -15 -8 Z',
      extra:<><path d="M15 -4 C21 -4 21 5 13 5" {...ink} strokeWidth="1.6"/><path d="M-19 15 C-8 18 8 18 19 15" {...ink} strokeWidth="1.5"/><path d="M-4 -12 C-6 -15 -2 -17 -4 -20 M4 -12 C2 -15 6 -17 4 -20" {...ink} strokeWidth="1" opacity="0.55"/>
        {inkOnly&&<path d="M-13 -4 L13 -4" {...ink} strokeWidth="1" opacity="0.6"/>}</>},
    texture:{d:'M0 -9 C5 -14 15 -12 15 -1 C15 10 7 16 0 13 C-7 16 -15 10 -15 -1 C-15 -12 -5 -14 0 -9 Z',
      extra:<><path d="M0 -9 C0 -13 1 -16 3 -18" {...ink} strokeWidth="1.5"/><path d="M3 -15 C7 -19 12 -18 13 -15 C9 -12 5 -13 3 -15 Z" fill={inkOnly?'none':SKETCH_WASH.leaf} opacity={inkOnly?1:0.7} stroke={SKETCH_INK} strokeWidth="1"/></>},
  }[id];
  if(!shape) return null;
  return <g>
    {!inkOnly&&<path d={shape.d} fill={wash} opacity="0.75" transform="translate(1.2 1.4)"/>}
    <path d={shape.d} {...ink} strokeWidth="1.6"/>
    {shape.extra}
  </g>;
}

/* Tasting notes as little pen sketches, one per flavour family (WineDNA.NOTE_CLUSTERS), so a
   note reads at a glance beside its words: dark fruit (a blackberry), red fruit (cherries),
   earth and leather (a boot), citrus and mineral (a lemon wedge), oak and vanilla (a barrel),
   herb and savour (a sprig), tropical and stone fruit (a peach), brioche and yeast (a loaf).
   Drawn about 30 units across, centred on (0, 0), in `ink` (white on the reveal's dark stage).
   Pure drawing: no call to Claude, nothing fetched. */
const SKETCH_NOTE_FAMILIES={'Dark Fruit & Spice':'dark','Red Fruit & Floral':'red','Earth & Leather':'earth','Citrus & Mineral':'citrus','Oak & Vanilla':'oak','Herb & Savour':'herb','Tropical & Stone Fruit':'stone','Brioche & Yeast':'bread'};
function sketchNoteFamily(note){
  const t=String(note||'').toLowerCase();
  const c=WineDNA.NOTE_CLUSTERS.find(c=>c.kw.some(k=>t.includes(k)));
  return c?SKETCH_NOTE_FAMILIES[c.name]:'glass';
}
function SketchNoteIcon({note,family,ink='#fff',wash}){
  const f=family||sketchNoteFamily(note);
  const line={fill:'none',stroke:ink,strokeLinecap:'round',strokeLinejoin:'round',strokeWidth:'1.5'};
  const soft={...line,strokeWidth:'1',opacity:'0.6'};
  const fill=wash||ink;
  switch(f){
    case 'dark': return <g>{/* a blackberry: a cluster of drupelets and a stalk */}
      {[[0,-4],[-5,-1],[5,-1],[-7,5],[-2,4],[3,4],[8,5],[-4,10],[1,10],[6,10]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.4" fill={fill} opacity="0.22" stroke={ink} strokeWidth="1.2"/>)}
      <path d="M0 -7 C1 -11 4 -13 8 -14" {...line}/><path d="M-3 -8 C-7 -9 -9 -6 -7 -5 Z" fill={fill} opacity="0.3" stroke={ink} strokeWidth="1"/></g>;
    case 'red': return <g>{/* two cherries on a forked stalk */}
      <circle cx="-6" cy="6" r="6.5" fill={fill} opacity="0.22" stroke={ink} strokeWidth="1.5"/><circle cx="7" cy="8" r="5.5" fill={fill} opacity="0.22" stroke={ink} strokeWidth="1.5"/>
      <path d="M-6 0 C-4 -8 0 -12 5 -14 M7 2.5 C7 -5 6 -10 5 -14" {...line}/><path d="M5 -14 C9 -16 12 -14 12 -11 C9 -11 6 -12 5 -14 Z" fill={fill} opacity="0.3" stroke={ink} strokeWidth="1"/>
      <path d="M-9 3 C-8 1.5 -6.5 1 -5.5 1.5" {...soft}/></g>;
    case 'earth': return <g>{/* a leather boot */}
      <path d="M-6 -13 L4 -13 L4 2 C4 5 10 6 13 8 C14 9 14 12 12 12 L-6 12 Z" fill={fill} opacity="0.18" stroke={ink} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M-6 8 L12 8" {...soft}/><path d="M-6 -13 C-6 -14 4 -14 4 -13" {...soft}/>
      <path d="M-4 -9 L2 -7 M-4 -5 L2 -3 M-4 -1 L2 1" {...soft}/></g>;
    case 'citrus': return <g>{/* a lemon wedge */}
      <path d="M-14 6 A14 14 0 0 1 14 6 Z" fill={fill} opacity="0.2" stroke={ink} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M0 6 L0 -7 M0 6 L-9 -3 M0 6 L9 -3 M0 6 L-12 4 M0 6 L12 4" {...soft}/>
      <path d="M-14 6 A14 14 0 0 1 14 6" {...line} transform="translate(0 2.5)" opacity="0.5"/></g>;
    case 'oak': return <g>{/* a barrel on its side */}
      <path d="M-12 -11 C-14 -4 -14 4 -12 11 L12 11 C14 4 14 -4 12 -11 Z" fill={fill} opacity="0.16" stroke={ink} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M-12.6 -6 L12.6 -6 M-13 6 L13 6" {...line}/><path d="M-4 -11 C-5 -4 -5 4 -4 11 M4 -11 C5 -4 5 4 4 11" {...soft}/></g>;
    case 'herb': return <g>{/* a sprig: a stem with paired leaves */}
      <path d="M0 14 C0 4 1 -6 3 -14" {...line}/>
      {[[-1,8],[1,2],[2,-4],[3,-10]].map(([x,y],i)=><g key={i}><path d={`M${x} ${y} C${x-5} ${y-2} ${x-8} ${y-6} ${x-7} ${y-9} C${x-3} ${y-8} ${x-1} ${y-4} ${x} ${y} Z`} fill={fill} opacity="0.22" stroke={ink} strokeWidth="1.1"/>
        <path d={`M${x} ${y} C${x+5} ${y-2} ${x+8} ${y-6} ${x+7} ${y-9} C${x+3} ${y-8} ${x+1} ${y-4} ${x} ${y} Z`} fill={fill} opacity="0.22" stroke={ink} strokeWidth="1.1"/></g>)}</g>;
    case 'stone': return <g>{/* a peach with its crease and a leaf */}
      <path d="M0 -8 C6 -14 15 -8 14 1 C13 9 7 14 0 13 C-7 14 -13 9 -14 1 C-15 -8 -6 -14 0 -8 Z" fill={fill} opacity="0.2" stroke={ink} strokeWidth="1.5"/>
      <path d="M0 -8 C-2 -2 -2 6 -1 13" {...soft}/><path d="M0 -8 C0 -12 1 -14 2 -16" {...line}/>
      <path d="M2 -14 C6 -17 11 -16 12 -13 C8 -11 4 -12 2 -14 Z" fill={fill} opacity="0.3" stroke={ink} strokeWidth="1"/></g>;
    case 'bread': return <g>{/* a loaf with three slashes */}
      <path d="M-14 8 L-14 2 C-14 -8 -6 -12 0 -12 C6 -12 14 -8 14 2 L14 8 Z" fill={fill} opacity="0.18" stroke={ink} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M-14 8 L14 8" {...line}/><path d="M-8 -3 L-4 -7 M-2 -5 L2 -9 M4 -3 L8 -7" {...soft}/></g>;
    default: return <g>{/* a glass */}
      <path d="M-9 -14 C-9 -3 -6 3 0 3 C6 3 9 -3 9 -14 Z" fill={fill} opacity="0.16" stroke={ink} strokeWidth="1.5"/>
      <path d="M0 3 L0 12 M-7 13.5 C-3 12 3 12 7 13.5" {...line}/></g>;
  }
}

/* "Something to say": a raised glass with a speech bubble, drawn as the pen would draw it (each
   line runs on from the last, `rv-draw` in the reveal's CSS), then the words. Consistent across
   every wine: it's the mark for the line you can say out loud. */
function SketchSay({ink='#fff',col}){
  const line={fill:'none',stroke:ink,strokeLinecap:'round',strokeLinejoin:'round'};
  return <svg viewBox="-20 -40 110 70" width="200" height="128" aria-hidden="true" style={{display:'block',overflow:'visible'}}>
    {/* the glass, tilted as if raised */}
    <g transform="rotate(-14 0 0)">
      <path d="M-11 -17 C-11 -4 -8 4 0 4 C8 4 11 -4 11 -17" {...line} strokeWidth="1.8" pathLength="1" className="rv-draw" style={{animationDelay:'.1s'}}/>
      <path d="M-11 -17 C-5 -18.4 5 -18.4 11 -17" {...line} strokeWidth="1.2" pathLength="1" className="rv-draw" style={{animationDelay:'.5s'}} opacity="0.75"/>
      <path d="M-10.3 -7 C-5 -5.4 5 -5.4 10.3 -7" {...line} strokeWidth="1.1" pathLength="1" className="rv-draw" style={{animationDelay:'.7s'}} opacity="0.8"/>
      <path d="M-10.3 -7 C-9.5 0 -6 4 0 4 C6 4 9.5 0 10.3 -7 Z" fill={col||ink} opacity="0.5" className="rv-in" style={{animationDelay:'.9s'}}/>
      <path d="M0 4 L0 15 M-8.5 16.5 C-4 14.6 4 14.6 8.5 16.5" {...line} strokeWidth="1.8" pathLength="1" className="rv-draw" style={{animationDelay:'.85s'}}/>
    </g>
    {/* the bubble, pointing back at the glass */}
    <path d="M28 -34 L78 -34 C84 -34 86 -31 86 -26 L86 -10 C86 -5 84 -2 78 -2 L42 -2 L30 8 L33 -2 L28 -2 C23 -2 21 -5 21 -10 L21 -26 C21 -31 23 -34 28 -34 Z" {...line} strokeWidth="1.6" pathLength="1" className="rv-draw" style={{animationDelay:'1.15s',animationDuration:'1s'}}/>
    <path d="M32 -24 L74 -24 M32 -17 L70 -17 M32 -10 L58 -10" {...line} strokeWidth="1.3" opacity="0.55" pathLength="1" className="rv-draw" style={{animationDelay:'2s',animationDuration:'.7s'}}/>
  </svg>;
}
Object.assign(window,{SketchNoteIcon,sketchNoteFamily,SKETCH_NOTE_FAMILIES,SketchSay});
