/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s){return(s||'').toLowerCase().replace('é','e');}
function _avg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;}
/* Rating-weighted tally — an attribute (grape/region/note) earns weight from every wine it appears in, scaled by that wine's rating, so one obscure low-rated bottle can't outrank several wines you actually rated well. */
function _topByWeightedCount(items){const c={};items.forEach(({v,rating})=>{if(v)c[v]=(c[v]||0)+Math.max(rating||55,5);});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function _topNotes(wines,n){const all=[];wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{if(t)all.push({v:t,rating:w.rating});}));return _topByWeightedCount(all).slice(0,n);}

/* ── Flavour clusters ── */
const _NOTE_CLUSTERS=WineDNA.NOTE_CLUSTERS;
const _FOOD_PAIRINGS={
  'Dark Fruit & Spice':   'Grilled red meat, aged hard cheese, braised short rib',
  'Red Fruit & Floral':   'Duck breast, mushroom risotto, charcuterie',
  'Earth & Leather':      'Truffles, aged Parmigiano, roasted lamb',
  'Citrus & Mineral':     'Oysters, grilled white fish, goat cheese',
  'Oak & Vanilla':        'Lobster, roast chicken, crème brûlée',
  'Herb & Savour':        'Herb-roasted chicken, tapenade, grilled vegetables',
  'Tropical & Stone Fruit':'Spiced Asian dishes, crab, soft fresh cheese',
  'Brioche & Yeast':      'Aged Gruyère, smoked salmon, caviar',
};
function _clusterNotes(notes){
  const result=[];const used=new Set();
  _NOTE_CLUSTERS.forEach(cl=>{
    const matches=notes.filter(n=>{const nl=n.toLowerCase();return cl.kw.some(k=>nl.includes(k))&&!used.has(n);});
    // Drop near-duplicates ("Dark cherry and blackberry" next to "…blackberry fruit").
    const core=n=>n.toLowerCase().replace(/\b(fruit|fruits|notes?|flavou?rs?|aromas?)\b/g,'').replace(/\s+/g,' ').trim();
    const kept=[]; matches.forEach(m=>{ const c=core(m); if(!kept.some(k=>{const kc=core(k);return kc.includes(c)||c.includes(kc);})) kept.push(m); });
    if(kept.length>=1){matches.forEach(m=>used.add(m));result.push({name:cl.name,notes:kept.slice(0,4)});}
  });
  return result.slice(0,3);
}

const _TYPE_COLORS={red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8',orange:'#C1652B',dessert:'#8A5A2B',fortified:'#5C2A1E'};
/* label is the plural used in sentences ("your 6 Outstanding reds"); tab is the type's name on
   tabs, pills and row titles, one word each and never plural (Red, White, Rosé, Sparkling…). */
const _TYPES=[
  {key:'red',       label:'Reds',     tab:'Red',      col:'#8B1A2F'},
  {key:'white',     label:'Whites',   tab:'White',    col:'#B8963E'},
  {key:'rose',      label:'Rosé',     tab:'Rosé',     col:'#C47A8A'},
  {key:'sparkling', label:'Sparkling',tab:'Sparkling',col:'#5E8FA8'},
  {key:'orange',    label:'Orange',   tab:'Orange',   col:'#C1652B'},
  {key:'dessert',   label:'Dessert',  tab:'Dessert',  col:'#8A5A2B'},
  {key:'fortified', label:'Fortified',tab:'Fortified',col:'#5C2A1E'},
];

/* How well the match knows them (TasteMatch.calibration): how often it lands close to the score
   they gave, a strip of every scored wine by how far off it was, which way it leans, and their
   biggest surprises either way, each opening the wine. */
function _KnowsCard({k,t,tLabel,openWine}){
  const card={padding:14};
  const wide=useWide();
  if(!k.ready) return <Card style={card}><div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>
    Each time you scan, we predict the score you'll give a bottle. Score {WineDNA.noun(t.key,k.need)} more and this will show how close those predictions come, and which bottles surprised you.</div></Card>;
  const head=k.level==='well'?`We know your ${tLabel} well`:k.level==='getting'?`We're getting to know your ${tLabel}`:`Your ${tLabel} still surprise us`;
  const W=300, H=46, span=15, x=d=>W/2+Math.max(-span,Math.min(span,d))/span*(W/2-10);
  const lane={};
  const Surprise=({r,up})=><div role="button" onClick={()=>openWine(r.wine)} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{WineDNA.nameYear(r.wine)}</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>Your other {tLabel} pointed to about {r.expected}; you gave it {r.actual}.</div>
    </div>
    <span style={{fontSize:14,fontWeight:800,color:up?C.green:'#B04A3A',fontFamily:C.P,whiteSpace:'nowrap'}}>{up?'+':''}{r.diff}</span>
  </div>;
  // On an iPad the surprises sit beside the summary and its strip, using the whole width.
  const twoCol=wide&&(k.above.length>0||k.below.length>0);
  return <Card style={card}>
    <div data-testid="knows" style={twoCol?{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:24,alignItems:'start'}:{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{head}</div>
      <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
        We matched each of your {k.n} scored {tLabel} again from your other {tLabel} alone. The expected score landed within {TasteMatch.CAL_CLOSE} points of yours <b>{k.close} times in {k.n}</b>, and within 5 points {k.near} times.
      </div>
      <svg viewBox={`0 0 ${W} ${H+18}`} width="100%" role="img" aria-label={`How far each prediction was from your score: ${k.close} of ${k.n} within ${TasteMatch.CAL_CLOSE} points.`} style={{display:'block',maxWidth:420}}>
        <rect x={x(-TasteMatch.CAL_CLOSE)} y="4" width={x(TasteMatch.CAL_CLOSE)-x(-TasteMatch.CAL_CLOSE)} height={H-8} rx="6" fill={C.greenBg}/>
        <line x1={W/2} y1="2" x2={W/2} y2={H-2} stroke={C.green} strokeWidth="1.5"/>
        <line x1="10" y1={H/2} x2={W-10} y2={H/2} stroke={C.line} strokeWidth="1"/>
        {k.rows.map((r,i)=>{ const cx=Math.round(x(r.diff)/6); const n=lane[cx]=(lane[cx]||0)+1; const y=H/2+((n%2?-1:1)*Math.floor(n/2))*6.5;
          return <circle key={i} cx={x(r.diff)} cy={Math.max(6,Math.min(H-6,y))} r="3.6" fill={Math.abs(r.diff)<=TasteMatch.CAL_CLOSE?C.green:r.diff>0?t.col:'#B9AFA4'} opacity="0.85"/>; })}
        <text x="10" y={H+14} style={{fontSize:'11px',fill:C.mid,fontFamily:C.P}}>You scored lower</text>
        <text x={W/2} y={H+14} textAnchor="middle" style={{fontSize:'11px',fontWeight:700,fill:C.green,fontFamily:C.P}}>spot on</text>
        <text x={W-10} y={H+14} textAnchor="end" style={{fontSize:'11px',fill:C.mid,fontFamily:C.P}}>You scored higher</text>
      </svg>
      {Math.abs(k.bias)>=2&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{k.bias>0?`You tend to score a little above what we expect (by about ${Math.round(k.bias)}): your ${tLabel} keep pleasing you more than your history says.`:`You tend to score a little below what we expect (by about ${Math.round(-k.bias)}): you're getting harder to impress.`}</div>}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
      {k.above.length>0&&<div data-testid="knows-above">
        <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,marginTop:4,marginBottom:2}}>Loved more than we expected</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginBottom:2}}>Surprises like these are where your taste is growing: worth a closer look at what they have that your usual bottles don't.</div>
        {k.above.map((r,i)=><Surprise key={i} r={r} up/>)}
      </div>}
      {k.below.length>0&&<div data-testid="knows-below">
        <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,marginTop:4,marginBottom:2}}>Let you down</div>
        {k.below.map((r,i)=><Surprise key={i} r={r}/>)}
      </div>}
      </div>
    </div>
  </Card>;
}

/* Collapsible section header — collapsed state shows a short useful summary + expand CTA below the title */
function CSH({label,cKey,collapsed,toggle,summary,visual}){
  const isC=collapsed[cKey];
  return(
    <div data-section={cKey} style={{marginTop:6,marginBottom:isC?12:6,scrollMarginTop:12}}>
      <div onClick={()=>toggle(cKey)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:'2px 0'}}>
        <span style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P}}>{label}</span>
        <svg viewBox="0 0 20 20" width={16} height={16} style={{transform:isC?'none':'rotate(180deg)',transition:'transform .2s',flexShrink:0,marginLeft:8,opacity:0.45}}>
          <polyline points="4,7 10,13 16,7" stroke={C.mid} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {isC&&summary&&(
        <div style={{marginTop:4,display:'flex',gap:12,alignItems:'center'}}>
          {/* A folded section's picture (the target, the price dots, the map) beside its one line. */}
          {visual&&<div role="button" aria-hidden="true" onClick={()=>toggle(cKey)} style={{flexShrink:0,cursor:'pointer'}}>{visual}</div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:14.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty'}}>{summary}</div>
            <span onClick={()=>toggle(cKey)} style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer',display:'inline-block',marginTop:6}}>{visual?'See more →':'Expand for full details →'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* A taste bar with two readings: the fill is the average of the wines you choose; the dot is
   where your Outstanding (90+) wines sit, shown once there are three of them. */
function DnaBar({v,loved,col}){
  return(
    <div style={{position:'relative',height:14,display:'flex',alignItems:'center'}}>
      <div style={{position:'absolute',left:0,right:0,height:6,borderRadius:6,background:'rgba(0,0,0,0.07)',overflow:'hidden'}}>
        <div className="dna-fill" style={{height:'100%',width:`${Math.min(1,v||0)*100}%`,borderRadius:6,background:col,opacity:0.85}}/>
      </div>
      {loved!=null&&<div className="dna-dot" title="Your 90+ wines" style={{position:'absolute',left:`calc(${Math.min(1,loved)*100}% - 6px)`,width:12,height:12,borderRadius:'50%',background:C.ink,boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>}
    </div>
  );
}

/* The WineDNA tab's pieces, shared with the welcome slides' preview (flow-welcome.jsx), which
   renders them from data/onboarding-sample.json. t is WineDNA.profile plus the tab's colour. */
function DnaTitle({t,basisLine}){
  return <div>
    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
      <span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>WineDNA</span>
      <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
        <div style={{width:5,height:5,borderRadius:3,background:t.col}}/>
        <span style={{fontSize:12,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.tab||t.label}</span>
      </div>
    </div>
    <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px',lineHeight:1.15}}>{t.personality}</div>
    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:3}}>{basisLine}</div>
  </div>;
}
/* Fact chips (what they drink most next to what they score highest), then how much to trust it. */
function DnaFacts({t,chips,conf}){
  return <>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      {chips.map((ch,i)=>(
        <div key={i} style={{padding:'5px 11px',borderRadius:20,background:i===0?`${t.col}10`:C.offWhite,border:`1px solid ${i===0?t.col+'30':C.line}`,display:'flex',gap:5,alignItems:'center'}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.label}</span>
          <span style={{fontSize:13,fontWeight:700,color:i===0?t.col:C.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.value}</span>
        </div>
      ))}
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{display:'flex',gap:3}}>
        {['early','good','strong'].map((l,i)=><div key={l} style={{width:16,height:5,borderRadius:3,background:['early','good','strong'].indexOf(conf.level)>=i?t.col:C.line}}/>)}
      </div>
      <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>
        {conf.n} scored{conf.next?` · ${conf.next}`:' · a strong read'}
      </span>
    </div>
  </>;
}
/* Their style, axis by axis: the fill is the wines they choose, the dot their 90+ wines. */
function DnaTasteCard({t,tLabel,notes=true}){
  return(
  <Card style={{padding:14}}>
    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Your {tLabel} style</div>
    <div style={{display:'flex',flexWrap:'wrap',gap:12,fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:12}}>
      <span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:16,height:5,borderRadius:3,background:t.col,display:'inline-block'}}/>The {tLabel} you choose</span>
      {t.loved.length>=3&&<span style={{display:'inline-flex',alignItems:'center',gap:5}}><span style={{width:9,height:9,borderRadius:'50%',background:C.ink,display:'inline-block'}}/>Your 90+ {tLabel}</span>}
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      {t.axes.filter(t.showAxis).map(k=>{
        const A=WineDNA.AXES[k];
        return(
          <div key={k}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{A.name}</span>
              <span style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P}}>{A[WineDNA.level(t.avg[k])]}</span>
            </div>
            <DnaBar v={t.avg[k]} loved={t.lovedAvg[k]} col={t.col}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.mid,fontFamily:C.P,opacity:0.7,marginTop:2}}><span>{A.low}</span><span>{A.high}</span></div>
            {notes&&t.axisNotes[k]&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4,lineHeight:1.55,textWrap:'pretty'}}>{t.axisNotes[k]}</div>}
          </div>
        );
      })}
    </div>
    {notes&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:12,lineHeight:1.5,opacity:0.8}}>Each wine's style is estimated from its label when you scan it: what the wine is typically like, not a tasting note.</div>}
  </Card>  );
}

/* The portrait at the top of WineDNA (DetailLevel): their style as pictures first. A tile per
   trait, the thing the app compares it to sketched in pen and wash (the Mastery palate's icons)
   inside a ring filled to where the wines they choose sit, the everyday word large and the wine
   term small beneath it. Each opens WineDNA's own page for that trait (DnaTraitScreen). */
function DnaTasteTiles({t,nav}){
  const axes=t.axes.filter(t.showAxis).filter(k=>t.avg[k]!=null);
  if(!axes.length) return null;
  // WineDNA's own trait page (the wines they choose), never the palate page (their Blind Calls).
  const open=id=>{ Handoff.dnaTrait.set({type:t.key,axis:id}); nav('dna-trait'); };
  // Three fit across; four sit two by two with the word beside the picture, so long words
  // ("Mouth-watering") never break mid-letter at a large text size.
  const wide=axes.length>3;
  return <div data-testid="dna-taste-tiles" style={{display:'grid',gridTemplateColumns:`repeat(${wide?2:axes.length},minmax(0,1fr))`,gap:6}}>
    {axes.map(k=>{
      const v=Math.max(0,Math.min(1,t.avg[k])), R=21, circ=2*Math.PI*R, A=WineDNA.AXES[k];
      const word=WineDNA.everyday(k,t.avg[k]), page=true;
      // The ring is their wine type's colour (as everything on WineDNA); the picture is ink alone.
      const ring=t.col;
      return <div key={k} role={page?'button':undefined} tabIndex={page?0:undefined} data-trait={k}
        onClick={page?()=>open(k):undefined} onKeyDown={page?(e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(k); } }):undefined}
        aria-label={`${A.name}: ${word}.${page?' What this means.':''}`}
        style={{background:'#FBF8F3',border:`1px solid ${C.line}`,borderRadius:12,padding:wide?'6px 8px 6px 6px':'8px 4px 7px',display:'flex',flexDirection:wide?'row':'column',alignItems:'center',gap:wide?8:3,cursor:page?'pointer':'default',minWidth:0}}>
        <svg width="50" height="50" viewBox="-25 -25 50 50" aria-hidden="true" style={{overflow:'visible',flexShrink:0}}>
          <circle r={R} fill="none" stroke={SKETCH_PENCIL} strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round"/>
          <circle r={R} fill="none" stroke={ring} strokeWidth="4" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-v)} transform="rotate(-90)"/>
          <g transform="scale(0.62)">{SKETCH_TRAIT[k]?<SketchTraitIcon id={k} inkOnly wine={t.col}/>:<_DnaTraitSketch id={k}/>}</g>
        </svg>
        <div style={{minWidth:0,textAlign:wide?'left':'center'}}>
          <div style={{fontSize:14,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.15,hyphens:'manual'}}>{word}</div>
          <div style={{fontSize:12,color:C.mid,fontFamily:C.P,lineHeight:1.2}}>{A.name}</div>
        </div>
      </div>;
    })}
  </div>;
}
/* Sweetness and bubbles have no Mastery sketch: a sugar cube and a few bubbles, in ink like the
   rest of WineDNA's tiles. */
function _DnaTraitSketch({id}){
  const ink={fill:'none',stroke:SKETCH_INK,strokeLinecap:'round',strokeLinejoin:'round',strokeWidth:1.6};
  if(id==='sweetness') return <g>
        <path d="M-12 -5 L0 -12 L12 -6 L12 7 L0 14 L-12 7 Z M-12 -5 L0 1 L12 -6 M0 1 L0 14" {...ink}/>
  </g>;
  if(id==='effervescence') return <g>
    {[[-6,6,7],[7,-2,5],[-3,-9,4],[9,10,3]].map(([x,y,r],i)=><circle key={i} cx={x} cy={y} r={r} {...ink}/>)}
  </g>;
  return null;
}
/* Their top flavour families, as pills in the type's colour. */
function DnaFlavourPills({t}){
  const cl=(t.noteClusters||[]).slice(0,3);
  if(t.wines.length<2||!cl.length) return null;
  return <div data-testid="dna-flavours" style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Flavours you go for</span>
    {cl.map(c=><span key={c.name} style={{padding:'4px 11px',borderRadius:20,background:`${t.col}12`,border:`1px solid ${t.col}30`,fontSize:13,fontWeight:700,color:t.col,fontFamily:C.P}}>{c.name}</span>)}
  </div>;
}
/* What lifts and holds back their scores (WineDNA.loves), as two short columns: the thing, with a
   flag or icon, and its points against their usual score. */
function DnaLoveAvoid({t}){
  const L=t.loves; if(!L||!L.ready||(!L.up.length&&!L.down.length)) return null;
  const icon={Grape:'grape',Region:'globe',Country:'globe',Producer:'wine',Price:'cart',Age:'bookmark'};
  const row=(x,good)=><div key={x.kind+x.name} style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
    {x.kind==='Region'?<Flag region={x.name} size={14}/>:<Icon n={icon[x.kind]||'wine'} sz={13} col={C.mid}/>}
    <span style={{flex:1,minWidth:0,fontSize:13,color:C.ink2,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.name}</span>
    <span style={{fontSize:13,fontWeight:800,color:good?C.green:'#B04A3A',fontFamily:C.P}}>{good?'+':'−'}{Math.abs(Math.round(x.lift))||1}</span>
  </div>;
  return <div data-testid="dna-love-avoid" style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1fr)',gap:12}}>
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{fontSize:12,fontWeight:700,color:C.green,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>Lifts your scores</div>
      {L.up.slice(0,3).map(x=>row(x,true))}
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:5}}>
      <div style={{fontSize:12,fontWeight:700,color:'#B04A3A',fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>Holds them back</div>
      {L.down.length?L.down.slice(0,3).map(x=>row(x,false)):<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Nothing yet</span>}
    </div>
  </div>;
}
/* How Well We Know You as a target (TasteMatch.calibration): a dot per scored wine, as far from
   the centre as the match missed its score, inside rings at CAL_CLOSE (3) and 5 points; green
   inside the first ring, amber inside the second, red beyond. Spread round by a fixed angle. */
function DnaTarget({k,size=84}){
  if(!k||!k.ready) return null;
  const R=size/2-3, step=R/10, ring=n=>Math.min(R,n*step);
  return <svg data-testid="dna-target" width={size} height={size} viewBox={`${-size/2} ${-size/2} ${size} ${size}`} aria-hidden="true">
    <circle r={R} fill="#FBF8F3" stroke={C.line}/>
    <circle r={ring(5)} fill="none" stroke={C.amber} strokeOpacity="0.35" strokeDasharray="2 3"/>
    <circle r={ring(TasteMatch.CAL_CLOSE)} fill={C.greenBg} stroke={C.green} strokeOpacity="0.45"/>
    {k.rows.map((r,i)=>{ const m=Math.abs(r.diff), d=Math.min(R-2,m*step), a=i*2.39996;
      const col=m<=TasteMatch.CAL_CLOSE?C.green:m<=5?C.amber:'#B04A3A';
      return <circle key={i} cx={Math.cos(a)*d} cy={Math.sin(a)*d} r={Math.max(2.2,size/34)} fill={col} fillOpacity="0.85"/>; })}
  </svg>;
}
/* Value as their average score in each price band (WineDNA.value().bands): a bar per band as long
   as that score, the band their scores are highest in in the type's colour. `onPick` makes the bars
   buttons; `small` is the folded row's picture. */
function DnaBandBars({v,col,sel,onPick,small}){
  const B=v&&v.bands; if(!B||!B.length) return null;
  if(small) return <svg data-testid="dna-band-bars" width="96" height="56" viewBox="0 0 96 56" aria-hidden="true" style={{display:'block'}}>
    <rect x="0.5" y="0.5" width="95" height="55" rx="8" fill="#FBF8F3" stroke={C.line}/>
    {B.slice(0,5).map((b,i)=>{ const h=Math.max(3,((b.avg||70)-70)/30*40), w=(96-6*(B.length+1))/B.length, x=6+i*(w+6);
      return <rect key={i} x={x} y={51-h} width={w} height={h} rx="2" fill={b.label===v.topBand?col:C.line}/>; })}
  </svg>;
  return <div data-testid="dna-band-bars" style={{display:'flex',flexDirection:'column',gap:6}}>
    {B.map((b,i)=>{ const on=sel===i, top=b.label===v.topBand, thin=b.n<2;
      return <div key={i} role="button" tabIndex={0} aria-pressed={on} onClick={()=>onPick&&onPick(i)} onKeyDown={e=>{ if(onPick&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); onPick(i); } }}
        style={{display:'grid',gridTemplateColumns:'minmax(84px,auto) 1fr 30px',gap:8,alignItems:'center',cursor:'pointer',padding:'3px 6px',margin:'0 -6px',borderRadius:8,background:on?`${col}10`:'transparent',opacity:thin&&!on?0.5:1}}>
        <span style={{fontSize:13,fontWeight:on?700:500,color:C.ink2,fontFamily:C.P,whiteSpace:'nowrap',lineHeight:1.2}}>{b.label}<br/><span style={{fontSize:12,fontWeight:400,color:C.mid}}>{b.n===1?'1 bottle':`${b.n} bottles`}</span></span>
        <div style={{height:14,borderRadius:4,background:C.offWhite,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.max(4,((b.avg||70)-70)/30*100)}%`,borderRadius:4,background:top?col:on?`${col}88`:C.line}}/></div>
        <span style={{fontSize:14,fontWeight:800,color:b.avg?scoreCol(b.avg):C.mid,fontFamily:C.P,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{b.avg}</span>
      </div>; })}
    <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>Bar length is your average score. Tap a price to see its bottles.{B.some(b=>b.n<2)?' One bottle is too few to judge a price by, so those are faded.':''}</div>
  </div>;
}
/* WineDNA's Value: where their money buys the wines they love (the bands, the band they score
   highest named), the bottles at the price they tap, then their best value. */
function DnaValueCard({t,tLabel,openWine}){
  const v=t.value, B=v.bands||[];
  const [sel,setSel]=React.useState(()=>Math.max(0,B.findIndex(b=>b.label===v.topBand)));
  const band=B[sel];
  const row=(b,i)=><div key={i} role="button" onClick={()=>openWine(b.wine)} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
    <span style={{fontSize:15,color:C.ink,fontFamily:C.P,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{WineDNA.nameYear(b.wine)}</span>
    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{b.price}{b.paid?' paid':''}</span>
    <span style={{fontSize:15,fontWeight:800,color:scoreCol(b.wine.rating),fontFamily:C.P,width:30,textAlign:'right'}}>{b.wine.rating}</span>
    <Icon n="chevron" sz={12} col={C.mid}/>
  </div>;
  const sub={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'};
  return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your score at each price</div>
    <DnaBandBars v={v} col={t.col} sel={sel} onPick={setSel}/>
    {v.bandVerdict&&<div data-testid="dna-value-verdict" style={{fontSize:15,color:C.ink,fontFamily:C.P,lineHeight:1.5,padding:'10px 12px',borderRadius:12,background:`${t.col}10`}}>{v.bandVerdict}</div>}
    {band&&<div data-testid="dna-band-bottles"><div style={{...sub,marginBottom:2}}>{band.label} · {WineDNA.noun(t.key,band.n)}</div>{band.bottles.slice(0,5).map(row)}</div>}
    {v.bestValue.length>0&&<div><div style={{...sub,marginBottom:2}}>Best value so far</div>{v.bestValue.map(row)}</div>}
    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45}}>{v.paid?`Prices are what you paid for ${v.paid} of these, and estimates from your scans for the rest (${v.code}).`:`Prices are estimates from your scans (${v.code}). Add what you paid when you rate a bottle to make this exact.`}</div>
  </Card>;
}
/* WineDNA's History: where their bottles of a type come from, most first, each with their
   average score and opening the region's page; then a few regions they haven't had that grow
   the grapes they choose most (WineDNA.places). */
function DnaPlaces({t,nav}){
  const [all,setAll]=React.useState(false);
  const P=t.places; if(!P||!P.list.length) return null;
  const L=t.label.toLowerCase(), list=all?P.list:P.list.slice(0,5);
  const open=name=>{ if(KNOWLEDGE.regions[name]) openRegionPage(name,nav); };
  return <div data-testid="dna-places" style={{display:'flex',flexDirection:'column',gap:8,marginBottom:6}}>
    <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Where your {L} come from</div>
    <div>
      {list.map((x,i)=><div key={x.name} role={KNOWLEDGE.regions[x.name]?'button':undefined} onClick={()=>open(x.name)} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:i?`1px solid ${C.line}`:'none',cursor:KNOWLEDGE.regions[x.name]?'pointer':'default'}}>
        <Flag region={x.name} size={18}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{x.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{WineDNA.noun(t.key,x.n)}</div>
        </div>
        {x.avg!=null&&<span style={{fontSize:15,fontWeight:800,color:scoreCol(x.avg),fontFamily:C.P}}>{x.avg}</span>}
        {KNOWLEDGE.regions[x.name]&&<Icon n="chevron" sz={12} col={C.mid}/>}
      </div>)}
      {P.list.length>5&&<div role="button" onClick={()=>setAll(a=>!a)} style={{padding:'8px 0',borderTop:`1px solid ${C.line}`,fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{all?'Show fewer':`Show all ${P.list.length}`}</div>}
    </div>
    {P.next.length>0&&<div data-testid="dna-places-next">
      <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Not tried yet, from grapes you choose</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        {P.next.map(x=><div key={x.name} role="button" onClick={()=>open(x.name)} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 11px',borderRadius:999,border:`1px solid ${C.line}`,background:C.white,cursor:'pointer'}}>
          <Flag region={x.name} size={15}/><span style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P}}>{x.name}</span><span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{x.grape}</span>
        </div>)}
      </div>
    </div>}
  </div>;
}
/* Your Journey as bars (WineDNA.journey): a bar per period, as tall as the bottles they tried,
   the part from a region new to them in the type's colour. */
function DnaJourneyBars({J,col,w=96,h=56}){
  if(!J||J.length<2) return null;
  const B=J.slice(-8), max=Math.max(...B.map(b=>b.count),1), gap=3, bw=(w-gap*(B.length+1))/B.length;
  return <svg data-testid="dna-journey-bars" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{display:'block'}}>
    <rect x="0.5" y="0.5" width={w-1} height={h-1} rx="8" fill="#FBF8F3" stroke={C.line}/>
    {B.map((b,i)=>{ const x=gap+i*(bw+gap), full=(h-10)*b.count/max, nw=(h-10)*Math.min(b.count,b.newRegions.length)/max;
      return <g key={i}><rect x={x} y={h-5-full} width={bw} height={full} rx="2" fill={C.line}/><rect x={x} y={h-5-nw} width={bw} height={nw} rx="2" fill={col}/></g>; })}
  </svg>;
}
/* WineDNA's page for one trait of one wine type (WineDNA.traitView): where the wines they choose
   sit and where their 90+ wines sit, every bottle on the scale, then what the word means and how
   to notice it. It's about their wines, from the labels; how well they taste it is Mastery's
   palate page, from Blind Calls, and the two never share a screen. */
function DnaTraitScreen({nav,back}){
  const h=Handoff.dnaTrait.get(null)||{};
  const T=_TYPES.find(x=>x.key===h.type)||_TYPES[0];
  const tv=React.useMemo(()=>h.axis?WineDNA.traitView(T.key,h.axis,WineHistory.getAll()):null,[h.type,h.axis]);
  const [pick,setPick]=React.useState(null);
  const card={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8};
  const head=x=><div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>{x}</div>;
  const L=T.label.toLowerCase(), col=_TYPE_COLORS[T.key]||C.cr;
  if(!tv) return <div style={{flex:1,padding:24,fontFamily:C.P,color:C.mid}}>Nothing to show for that yet. <span role="button" onClick={back} style={{color:C.cr,fontWeight:700,cursor:'pointer'}}>Back</span></div>;
  const R=44, circ=2*Math.PI*R, ring=col;
  const openWine=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };
  const sel=pick==null?tv.start:pick, step=tv.steps[sel], maxN=Math.max(...tv.steps.map(x=>x.n),1);
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><Icon n="back" sz={16} col={C.ink}/></div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>{tv.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Your {L} · from {tv.lowWord.toLowerCase()} to {tv.highWord.toLowerCase()}</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div data-testid="dna-trait-hero" style={{...card,background:'#FBF8F3',flexDirection:'row',alignItems:'center',gap:14}}>
          <svg width="110" height="110" viewBox="-55 -55 110 110" aria-hidden="true" style={{flexShrink:0,overflow:'visible'}}>
            <circle r={R} fill="none" stroke={SKETCH_PENCIL} strokeWidth="3.5" strokeDasharray="1 5" strokeLinecap="round"/>
            <circle r={R} fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-tv.avg)} transform="rotate(-90)"/>
            <g transform="scale(1.35)">{SKETCH_TRAIT[tv.axis]?<SketchTraitIcon id={tv.axis} inkOnly wine={col}/>:<_DnaTraitSketch id={tv.axis}/>}</g>
          </svg>
          <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
            <span style={{fontSize:28,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.1}}>{tv.word}</span>
            <span style={{fontSize:14,fontWeight:600,color:C.ink2,fontFamily:C.P}}>The {L} you choose</span>
            <span style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>From {WineDNA.noun(T.key,tv.n)}.</span>
          </div>
        </div>

        {head(`Your ${L}, ${tv.lowWord.toLowerCase()} to ${tv.highWord.toLowerCase()}`)}
        {/* Five steps along the scale: how many of their bottles sit at each, the one picked in the
            type's colour; a tap lists that step's bottles, best first. */}
        <div data-testid="dna-trait-steps" style={card}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:6,alignItems:'end',height:120}}>
            {tv.steps.map(x=><div key={x.i} role="button" tabIndex={0} aria-pressed={sel===x.i} aria-label={`${x.label}: ${x.n}`} onClick={()=>setPick(x.i)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setPick(x.i); } }}
              style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',alignItems:'center',gap:4,height:'100%',cursor:'pointer'}}>
              <span style={{fontSize:13,fontWeight:800,color:sel===x.i?col:C.ink2,fontFamily:C.P}}>{x.n}</span>
              <div style={{width:'100%',height:`${Math.max(3,x.n/maxN*84)}%`,borderRadius:'6px 6px 2px 2px',background:sel===x.i?col:C.line}}/>
            </div>)}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,minmax(0,1fr))',gap:6}}>
            {tv.steps.map(x=><span key={x.i} style={{fontSize:12,color:sel===x.i?C.ink:C.mid,fontWeight:sel===x.i?700:400,fontFamily:C.P,textAlign:'center',lineHeight:1.2}}>{x.label}</span>)}
          </div>
          <div data-testid="dna-trait-verdict" style={{fontSize:15,color:C.ink,fontFamily:C.P,lineHeight:1.5,padding:'10px 12px',borderRadius:12,background:`${col}10`}}>{tv.verdict}</div>
        </div>

        {head(`${step.label} · ${WineDNA.noun(T.key,step.n)}${step.avg!=null?` · average ${step.avg}`:''}`)}
        <div data-testid="dna-trait-bottles" style={{...card,gap:0,padding:step.n?'4px 16px':'14px 16px'}}>
          {step.n?step.bottles.map((b,i)=><div key={i} role="button" tabIndex={0} onClick={()=>openWine(b.wine)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openWine(b.wine); } }}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:i?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
            <div style={{flex:1,minWidth:0,fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{WineDNA.nameYear(b.wine)}</div>
            {b.rating>0&&<span style={{fontSize:15,fontWeight:800,color:scoreCol(b.rating),fontFamily:C.P}}>{b.rating}</span>}
            <Icon n="chevron" sz={12} col={C.mid}/>
          </div>):<span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>None of your {L} sit here yet.</span>}
        </div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45}}>Where each wine sits is estimated from its label when you scan it: what the wine is typically like, not a tasting note.</div>

        {tv.about&&<>
          {head(`What ${tv.name.toLowerCase()} is`)}
          <div style={card}><span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{tv.about.what}</span></div>
          {head('How to notice it')}
          <div style={card}>{tv.about.notice.map((n,i)=><div key={i} style={{display:'flex',gap:9,fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}><span style={{color:col,fontWeight:800}}>•</span><span>{n}</span></div>)}</div>
          {head('At either end')}
          <div style={{...card,flexDirection:'row',gap:12}}>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>{tv.lowWord}</div><div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>{tv.about.low}</div></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>{tv.highWord}</div><div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>{tv.about.high}</div></div>
          </div>
          <div style={{...card,background:C.offWhite}}><span style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}><b>Tip:</b> {tv.about.tip}</span></div>
        </>}
        <div style={{height:8}}/>
      </div>
    </div>
  );
}
/* Optional reading folded under the portrait ("Read more"). */
function DnaReadMore({label='Read more',children}){
  const [open,setOpen]=React.useState(false);
  return <div>
    <div role="button" aria-expanded={open} onClick={()=>setOpen(o=>!o)} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{open?'Show less':label} {open?'↑':'→'}</div>
    {open&&<div style={{marginTop:8}}>{children}</div>}
  </div>;
}

/* ──────────────────────────────────────────────────
   WineDNA Screen — renders WineDNA.profile (pwa-winedna.js) for each wine type
────────────────────────────────────────────────── */
/* "Explore Next is ready for your reds": shown once, the first time a type reaches
   ExploreNext.READY_AT wines and has picks (ExploreNext.toCelebrate). In the type's colour; "See my
   picks" opens that type's Explore section. */
function ExploreReadyMoment({type,count,onDone}){
  const T=_TYPES.find(t=>t.key===type)||_TYPES[0], word=type==='red'||type==='white'?T.label.toLowerCase():`${T.tab.toLowerCase()} wines`;
  return(
    <div role="dialog" aria-label={`Explore Next is ready for your ${word}`} style={{position:'absolute',inset:0,background:C.ink,zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:14}}>
      <div style={{width:64,height:64,borderRadius:32,background:T.col+'33',border:`2px solid ${T.col}`,display:'flex',alignItems:'center',justifyContent:'center',animation:'dnaRise 1.1s ease both'}}><Icon n="compass" sz={30} col="#fff"/></div>
      <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.6)',fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',animation:'dnaRise 1.1s .05s ease both'}}>{count} {word} scanned</div>
      <div style={{fontSize:30,fontWeight:700,color:'#fff',fontFamily:C.P,textAlign:'center',lineHeight:1.2,animation:'dnaRise 1.1s .1s ease both'}}>Explore Next is ready for your {word}.</div>
      <div style={{fontSize:16,color:'rgba(255,255,255,0.7)',fontFamily:C.P,textAlign:'center',lineHeight:1.5,maxWidth:300,animation:'dnaRise 1.1s .2s ease both'}}>That's enough to see what you go for. Here are styles to try next, picked from the {word} you love.</div>
      <div role="button" onClick={onDone} style={{marginTop:14,background:T.col,borderRadius:14,padding:'13px 28px',cursor:'pointer',animation:'dnaRise 1.1s .3s ease both'}}>
        <span style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>See my picks</span>
      </div>
      <style>{`@keyframes dnaRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function WineDNAScreen({nav,back,showPro}){
  const wide=useWide();
  // Opens on the type they've chosen most (UserPrefs.openingType), or the tab they last picked.
  const [typeIdx,setTypeIdxState]=React.useState(()=>Math.max(0,_TYPES.findIndex(t=>t.key===UserPrefs.openingType(WineHistory.getAll()))));
  const setTypeIdx=i=>{ setTypeIdxState(i); if(_TYPES[i]) UserPrefs.rememberType(_TYPES[i].key); };
  const [genSummaries,setGenSummaries]=React.useState({});
  const [welcomed,setWelcomed]=React.useState(()=>Flags.dnaWelcomeSeen());
  const [generatingSummary,setGeneratingSummary]=React.useState(null);
  const [genScripts,setGenScripts]=React.useState({});
  const [generatingScript,setGeneratingScript]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const [scriptLength,setScriptLength]=React.useState(Settings.scriptLength());
  const [collapsed,setCollapsed]=React.useState(()=>{
    // Below Everything (DetailLevel) the longer sections start folded to their one-line summary.
    const fold=!DetailLevel.at('everything');
    const def={love:false,taste:false,value:false,explore:false,flavour:false,journey:fold,knows:fold,scripts:fold,history:fold};
    try{
      const saved=Device.dnaCollapsed();
      if(saved) return {...def,...saved};
    }catch(e){}
    return def;
  });
  const toggle=React.useCallback(k=>setCollapsed(c=>{
    const next={...c,[k]:!c[k]};
    Device.setDnaCollapsed(next);
    return next;
  }),[]);
  // Arriving from Home with a section to show (UserPrefs.openDNA): open it and scroll to it.
  React.useEffect(()=>{
    const sec=UserPrefs.takeDNASection(); if(!sec) return;
    setCollapsed(c=>({...c,[sec]:false}));
    setTimeout(()=>{ const el=document.querySelector(`[data-section="${sec}"]`); if(el) el.scrollIntoView({block:'start'}); },60);
  },[]);
  // A wine type whose Explore Next has just opened: celebrated once, then its picks are shown.
  const [ready,setReady]=React.useState(()=>ExploreNext.toCelebrate(WineHistory.getAll()));
  React.useEffect(()=>{ if(ready) ExploreNext.markCelebrated(ready); },[ready]);
  function seePicks(){
    const i=_TYPES.findIndex(t=>t.key===ready); if(i>=0) setTypeIdx(i);
    setCollapsed(c=>({...c,explore:false})); setReady(null);
    setTimeout(()=>{ const el=document.querySelector('[data-section="explore"]'); if(el) el.scrollIntoView({block:'start'}); },80);
  }
  const touchX=React.useRef(null);
  const touchY=React.useRef(null);

  const allWines=WineHistory.getAll();
  // Recompute whenever a wine is added or re-scored, not just when the count changes.
  const sig=WineDNA.signature(allWines);
  const _rc=Regional.current();
  const _cbase=_rc.base;
  const _ccode=_rc.code;
  const _cfx=USD_FX[_rc.code]||1.0;

  /* Per-type profiles */
  const typeStats=React.useMemo(()=>_TYPES.map(tp=>{
    const p=WineDNA.profile(tp.key,allWines,tp.label);
    const pct=allWines.length?Math.round(p.wines.length/allWines.length*100):0;
    const topNotes=_topNotes(p.wines,14);
    const explore=ExploreNext.suggest(tp.key,allWines,tp.label);
    const topWines=[...p.scored].sort((a,b)=>b.rating-a.rating).slice(0,3);
    const knows=TasteMatch.calibration(tp.key,allWines);
    return{...tp,...p,pct,topNotes,noteClusters:_clusterNotes(topNotes),explore,topWines,knows};
  }),[sig]);

  const t=typeStats[typeIdx];
  const visibleIdxs=typeStats.reduce((arr,ts,i)=>{ if(i<4||ts.wines.length>0) arr.push(i); return arr; },[]);
  // A type with no wines yet opens like any other: its tab says what to scan (as swiping there does).
  function pickType(i){ setTypeIdx(i); }
  function stepType(dir){
    const pos=visibleIdxs.indexOf(typeIdx);
    const next=visibleIdxs[Math.min(visibleIdxs.length-1,Math.max(0,pos+dir))];
    setTypeIdx(next);
  }

  /* Written summary: Claude restates the computed facts (WineDNA.summaryFacts) in plain language.
     Keyed on the wine signature so a new scan or a changed score refreshes it. */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_dna_v7_${t.key}_${sig}`;
    const cached=Cache.getText(key);
    if(cached){setGenSummaries(s=>({...s,[t.key]:cached}));return;}
    if(generatingSummary===t.key) return;
    setGeneratingSummary(t.key);
    const hasDislikes=t.favourites.disliked.length>0||(t.loves.nots||[]).length>0;
    const prompt=`You write the summary at the top of a wine drinker's WineDNA profile. The app is educational: be warm, specific and confidence-building, and help them buy better next time. Use ONLY these facts, computed from their own scans and 100-point scores; never invent grapes, regions, wines or numbers, and don't claim a preference the facts don't state. If they've scored fewer than 8, say gently that the picture is still forming.\n\nFacts:\n${WineDNA.summaryFacts(t)}\n\nReturn ONLY raw JSON, no markdown: {"style":"one sentence on the style of ${t.label.toLowerCase()} they reach for, max 22 words","love":"two short sentences in plain words: what they love (the style, the flavours and the grapes, regions or producers that lift their scores, from the What they love facts) and one or two of their best bottles by name as proof, then what to look for next; at most one number, max 45 words"${hasDislikes?',"miss":"one sentence on what holds their scores down (from the Less their thing facts and the wines under 80), framed as useful to know when buying, max 26 words"':''}}`;
    window.claude.complete({purpose:'winedna_summary',messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=(text||'').trim(); if(s){Cache.setText(key,s);setGenSummaries(g=>({...g,[t.key]:s}));}})
      .catch(()=>{})
      .finally(()=>setGeneratingSummary(null));
  },[typeIdx,sig]);

  // Explore Next picks seen today count toward their rest (ExploreNext.noteShown), so ones they
  // keep passing over make way for new styles.
  React.useEffect(()=>{ if(t.explore&&t.explore.picks.length) ExploreNext.noteShown(t.explore.picks); },[typeIdx,sig]);

  /* Sommelier script — shared with Home through SommelierScript (pwa-content-engine.js), so
     both screens show the same text and the same budget. */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const typeKey=t.key;
    setGeneratingScript(typeKey);
    SommelierScript.get(scriptLength,typeKey,t.label,t.wines,text=>{
      setGeneratingScript(g=>g===typeKey?null:g);
      if(text) setGenScripts(g=>({...g,[typeKey]:text}));
    });
  },[typeIdx,allWines.length,scriptLength]);

  /* Swipe */
  function onTouchStart(e){touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;}
  function onTouchEnd(e){
    if(touchX.current===null)return;
    const dx=e.changedTouches[0].clientX-touchX.current;
    const dy=e.changedTouches[0].clientY-(touchY.current||0);
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0)stepType(1);
      else stepType(-1);
    }
    touchX.current=null;touchY.current=null;
  }

  // A wine named in a list (Worth buying again, Best value, Worth knowing) opens its details.
  const openWine=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };

  /* Per-type stats */
  const tLabel=t.label.toLowerCase();
  const tAvgScore=t.scored.length?Math.round(t.scored.reduce((s,w)=>s+w.rating,0)/t.scored.length):0;
  const tCountries=new Set(t.wines.map(w=>w.country).filter(Boolean)).size;
  const tAvgPrice=_avg(t.wines,'price_usd',0);
  const SH=({label})=>(<div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P,marginTop:6,marginBottom:-4}}>{label}</div>);
  const sub={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'};

  /* Empty state */
  if(!allWines.length) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
      <div style={{background:C.white,padding:'16px 20px 14px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:2}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>WineDNA</div>
        </div>
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginLeft:46}}>Your personal taste intelligence</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
          <Icon n="brain" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your WineDNA is waiting</div>
          <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and score bottles to unlock your personal taste profile: what you love, where to find more of it, and how to buy with confidence.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
      </div>
    </div>
  );

  /* Summary chips: what you drink most next to what you score highest */
  const fav=t.favourites;
  const chips=[];
  if(t.topGrapes[0]) chips.push({label:'Top grape',value:t.topGrapes[0]});
  if(t.topRegions[0]) chips.push({label:'Most scanned',value:t.topRegions[0]});
  // The region that lifts their scores most against their own usual score (WineDNA.loves), not just the highest raw average.
  const loveRegion=t.loves.ready&&t.loves.up.find(x=>x.kind==='Region');
  if(loveRegion) chips.push({label:'Region you love most',value:loveRegion.name});
  else if(fav.regions[0]) chips.push({label:'Top-scoring region',value:`${fav.regions[0].name} · ${fav.regions[0].avg}`});
  const conf=t.confidence;
  const basisLine=t.basis==='loved'
    ?`Based on your ${t.loved.length} Outstanding (90+) ${tLabel}`
    :`Based on the ${WineDNA.noun(t.key,t.wines.length)} you've ${conf.n>0?'chosen':'scanned'}`;

  if(ready) return <ExploreReadyMoment type={ready} count={ExploreNext._typeWines(ready,allWines).length} onDone={seePicks}/>;
  /* Each section of the type's DNA once, laid out below: one column on a phone, in pairs side by
     side on an iPad (useWide), with How Well We Know You and Explore across the full width. */
  const more=DetailLevel.at('more'), all=DetailLevel.at('everything');
  const S={
    written:<>
        {/* ── Written for you: unread Learn pieces about this type's bottles (ContentEngine.forType) ── */}
        {(()=>{
          const reads=ContentEngine.forType(t.key,allWines).slice(0,2);
          if(!reads.length) return null;
          const open=stub=>{ Handoff.genArticle.set(stub); nav('gen-article'); };
          return <Card style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Written from your WineDNA</div>
              <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Short reads about your own {tLabel}, written for you and nobody else.</div>
            </div>
            {reads.map(stub=>(
              <div key={stub.id} onClick={()=>open(stub)} role="button" style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                <div style={{width:38,height:38,borderRadius:11,background:`${t.col}12`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={stub.iconName||'read'} sz={18} col={t.col}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{stub.title}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4,marginTop:1}}>{ContentEngine.because(stub,allWines)}</div>
                </div>
                <Icon n="chevron" sz={13} col={C.mid}/>
              </div>
            ))}
          </Card>;
        })()}
    </>,
    knows:<>
        {/* ── How well we know you: every scored wine matched again from the rest (TasteMatch.calibration) ── */}
        {t.scored.length>0&&<CSH label="How Well We Know You" visual={<DnaTarget k={t.knows} size={72}/>} cKey="knows" collapsed={collapsed} toggle={toggle}
          summary={t.knows.ready?`Your match lands within ${TasteMatch.CAL_CLOSE} points of your score ${t.knows.close} times in ${t.knows.n}.${t.knows.above[0]?` Biggest surprise: ${t.knows.above[0].wine.name}.`:''}`:`Score ${WineDNA.noun(t.key,t.knows.need)} more and we'll show how well your match predicts your scores.`}/>}
        {t.scored.length>0&&!collapsed.knows&&<_KnowsCard k={t.knows} t={t} tLabel={tLabel} openWine={openWine}/>}
    </>,
    house:<>
        {/* ── House wines: the bottles they keep coming back to (WineDNA.houseWines) ── */}
        {t.house.length>0&&<CSH label="Your “House” Wines" cKey="house" collapsed={collapsed} toggle={toggle}
          summary={`${t.house.length===1?'One bottle':`${t.house.length} bottles`} you keep coming back to, led by ${t.house[0].wine.name}.`}/>}
        {t.house.length>0&&!collapsed.house&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:6}}>The {tLabel} you keep coming back to: had more than once, marked to buy again, or hearted (never one you scored under 80). Restock goes straight to a shop.</div>
            <div data-testid="house-wines">
            {t.house.map(h=>{ const w=h.wine; return (
              <div key={'h'+w.name+(w.vintage||'')} role="button" onClick={()=>openWine(w)} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{h.fav&&<span style={{color:C.cr,marginRight:5}}>♥</span>}{WineDNA.nameYear(w)}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{h.why.map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' · ')}</div>
                </div>
                {w.rating>0&&<span style={{fontSize:15,fontWeight:800,color:scoreCol(w.rating),fontFamily:C.P}}>{w.rating}</span>}
                {/* Their own shortlist, so the shortest path to buying it again (a partner shop when one is on). */}
                <button onClick={e=>{ e.stopPropagation(); FindOnline.open(w,'restock'); }} aria-label={`Restock ${w.name}`} style={{flexShrink:0,border:`1px solid ${C.green}55`,background:C.greenBg,color:C.green,borderRadius:20,padding:'4px 10px',fontSize:13,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>Restock</button>
              </div>); })}
            </div>
            <ShopDisclosure style={{marginTop:8}}/>
          </Card>
        )}
    </>,
    taste:<>
        {/* ── Taste profile: the style of what you choose, with your 90+ wines marked ── */}
        {t.wines.length>0&&<CSH label="Taste Profile" cKey="taste" collapsed={collapsed} toggle={toggle} summary={t.axes.filter(t.showAxis).map(k=>`${WineDNA.AXES[k].name}: ${WineDNA.AXES[k][WineDNA.level(t.avg[k])]}`).join(' · ')}/>}
        {t.wines.length>0&&!collapsed.taste&&(
          <DnaTasteCard t={t} tLabel={tLabel}/>
        )}
    </>,
    value:!all?<>
        {/* At Simple and More, Value is one line: their best value so far (the full section at Everything). */}
        {t.value&&t.value.bestValue[0]&&(()=>{ const b=t.value.bestValue[0]; return <Card style={{padding:'12px 14px'}}>
          <div data-testid="dna-best-value" role="button" onClick={()=>openWine(b.wine)} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <div style={{width:34,height:34,borderRadius:10,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="star" sz={16} col={C.green}/></div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>Best value so far</div>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.wine.name}</div>
            </div>
            <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{b.price}</span>
            <span style={{fontSize:16,fontWeight:800,color:C.green,fontFamily:C.P}}>{b.wine.rating}</span>
          </div>
        </Card>; })()}
    </>:<>
        {/* ── Value: price against score ── */}
        {t.value&&<CSH label="Value" visual={<DnaBandBars v={t.value} col={t.col} small/>} cKey="value" collapsed={collapsed} toggle={toggle} summary={t.value.verdict?t.value.verdict.text:`Your best-value ${tLabel}, from ${t.value.n} scored bottles with prices.`}/>}
        {t.value&&!collapsed.value&&<DnaValueCard t={t} tLabel={tLabel} openWine={openWine}/>}
    </>,
    explore:<>
        {t.explore.picks.length>0&&<CSH label="Explore" cKey="explore" collapsed={collapsed} toggle={toggle} summary={`${t.explore.picks.length} styles picked from your ${tLabel} DNA. Top pick: ${t.explore.picks[0].style.name} (${t.explore.picks[0].style.country}).${t.explore.explored.length?` You've explored ${t.explore.explored.length} so far.`:''}`}/>}
        {/* ── Explore Next: styles to try, ranked from this type's WineDNA (ExploreNext, pwa-content-engine.js) ── */}
        {t.explore.picks.length>0&&!collapsed.explore&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Explore Next</div>
            {more?<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:12,lineHeight:1.5}}>Styles that share your {tLabel} DNA but take you somewhere new. Tap one to learn what it's like and how to find it.</div>:<div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginBottom:10}}>Styles to try next, picked from your {tLabel}.</div>}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.explore.picks.map((p,i)=>(
                <div key={p.style.id}
                  onClick={()=>{ExploreNext.markOpened(p.style.id);Handoff.styleExplore.set({id:p.style.id,typeKey:t.key,label:t.label});nav('style-explore');}}
                  style={{padding:'12px 12px',borderRadius:12,background:i===0?`${t.col}08`:C.offWhite,border:`1px solid ${i===0?t.col+'25':C.line}`,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,marginBottom:6}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{p.style.name}</div>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>{p.style.country}</span>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {p.shares&&<span style={{fontSize:12,fontWeight:600,color:C.green,background:C.greenBg,border:`1px solid ${C.green}30`,borderRadius:20,padding:'2px 9px',fontFamily:C.P}}>Shares: {p.shares}</span>}
                    <span style={{fontSize:12,fontWeight:600,color:t.col,background:`${t.col}10`,border:`1px solid ${t.col}30`,borderRadius:20,padding:'2px 9px',fontFamily:C.P}}>New: {p.style.adds}</span>
                  </div>
                  {more&&<div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty',marginBottom:6}}>{p.why}</div>}
                  <div style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P}}>Learn about it & find a bottle →</div>
                </div>
              ))}
            </div>
            {t.explore.explored.length>0&&(
              <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                <div style={{...sub,marginBottom:6}}>Already explored</div>
                {t.explore.explored.map(e=>(
                  <div key={e.style.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                    <span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span>
                    <span style={{fontSize:15,color:C.ink,fontFamily:C.P,flex:1}}>{e.style.name}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{e.wine.rating?`you scored it ${e.wine.rating}`:'scanned'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
    </>,
    flavour:<>
        {/* ── Flavour Signatures ── */}
        {t.wines.length>=2&&t.noteClusters.length>0&&<CSH label="Flavour Signatures" cKey="flavour" collapsed={collapsed} toggle={toggle} summary={`${t.noteClusters[0].name} is the most common flavour family across your ${tLabel}.${t.noteClusters[1]?' '+t.noteClusters[1].name+' shows up often too.':''}`}/>}
        {t.wines.length>=2&&t.noteClusters.length>0&&!collapsed.flavour&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Flavour Signatures</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:12}}>The flavour families that come up most in your {tLabel}, and food that suits them.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.noteClusters.map((cl,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>{cl.name}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                    {cl.notes.map((n,j)=>(
                      <span key={j} style={{padding:'3px 9px',borderRadius:20,background:j===0?`${t.col}10`:C.white,border:`1px solid ${j===0?t.col+'30':C.line}`,fontSize:13,color:j===0?t.col:C.ink2,fontFamily:C.P}}>{n}</span>
                    ))}
                  </div>
                  {_FOOD_PAIRINGS[cl.name]&&(
                    <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0,marginTop:1}}>Pairs with</span>
                      <span style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{_FOOD_PAIRINGS[cl.name]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
    </>,
    journey:<>
        {/* ── Your Journey: how your choices are changing ── */}
        {t.journey.length>=2&&(()=>{
          const J=t.journey, last=J[J.length-1];
          const totalRegions=new Set(t.wines.map(w=>WineDNA.region(w)).filter(Boolean)).size;
          const totalGrapes=t.grapeStats.length;
          const maxN=Math.max(...J.map(b=>b.count));
          const lastNew=[...last.newRegions];
          const summary=lastNew.length
            ?`${['day','week'].includes(last.unit)?(last.unit==='day'?'On':'The week of'):'In'} ${last.label} you tried ${lastNew.length} new region${lastNew.length!==1?'s':''}: ${lastNew.slice(0,3).join(', ')}${lastNew.length>3?` and ${lastNew.length-3} more`:''}.`
            :`You've explored ${totalRegions} regions and ${totalGrapes} grapes in your ${tLabel} so far.`;
          return(
            <>
              <CSH label="Your Journey" visual={<DnaJourneyBars J={J} col={t.col}/>} cKey="journey" collapsed={collapsed} toggle={toggle} summary={summary}/>
              {!collapsed.journey&&(
                <Card style={{padding:14}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>How your choices are changing</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:14,lineHeight:1.5}}>{tLabel.charAt(0).toUpperCase()+tLabel.slice(1)} scanned over time, and how many regions each period was your first taste of.</div>
                  <div style={{display:'flex',gap:4,alignItems:'flex-end',height:72,marginBottom:6}}>
                    {J.map((b,i)=>(
                      <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,height:'100%',justifyContent:'flex-end'}}>
                        <span style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P}}>{b.count}</span>
                        <div style={{width:'55%',height:`${Math.max(8,Math.round(b.count/maxN*100))}%`,background:t.col,borderRadius:'4px 4px 0 0',opacity:0.72}}/>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:4}}>
                    {J.map((b,i)=>(
                      <div key={i} style={{flex:1,textAlign:'center'}}>
                        <span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{b.label}</span>
                        <div style={{fontSize:12,fontWeight:600,color:b.newRegions.length?C.green:C.mid,fontFamily:C.P,opacity:b.newRegions.length?1:0.6}}>{b.newRegions.length?`+${b.newRegions.length} new`:'—'}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:10,lineHeight:1.55}}>
                    {summary} {totalRegions<6?'Every new region teaches your palate something: Explore Next above has ideas.':'That breadth is what makes your scores meaningful: you know what you like because you have tried the alternatives.'}
                  </div>
                </Card>
              )}
            </>
          );
        })()}
    </>,
    scripts:<>
        {t.wines.length>0&&<CSH label="Scripts" cKey="scripts" collapsed={collapsed} toggle={toggle} summary={genScripts[t.key]?`Your ${tLabel} sommelier script is ready to use at your next dinner. "${genScripts[t.key].replace(/^"|"$/g,'').slice(0,90)}${genScripts[t.key].length>92?'…':''}"`:`What to say to a sommelier about the ${tLabel} you like.`}/>}
        {/* ── Sommelier Script ── */}
        {t.wines.length>0&&!collapsed.scripts&&(
          <Card style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Icon n="message" sz={14} col={t.col}/>
                <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {t.label} Script</span>
              </div>
              {t.wines.length>0&&!generatingScript&&(
                <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:6,padding:'3px 4px',border:`1px solid ${C.line}`}}>
                  {['short','long'].map(len=>(
                    <div key={len} onClick={()=>{setScriptLength(len);Settings.setScriptLength(len);setGenScripts(s=>{const n={...s};delete n[t.key];return n;});}} style={{padding:'4px 8px',borderRadius:4,background:scriptLength===len?C.cr:'transparent',cursor:'pointer'}}>
                      <span style={{fontSize:13,fontWeight:600,color:scriptLength===len?'#fff':C.mid,fontFamily:C.P}}>{len.charAt(0).toUpperCase()+len.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {generatingScript===t.key?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65,marginBottom:genScripts[t.key]?10:0}}>{genScripts[t.key]||'Generating…'}</div>
                {genScripts[t.key]&&(
                  <Btn primary small style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:4}} onClick={()=>{
                    try{navigator.clipboard.writeText((genScripts[t.key]||'').replace(/"/g,''));setCopied(t.key);setTimeout(()=>setCopied(null),2000);}catch(e){}
                  }}>{copied===t.key?'✓ Copied':'Copy Script'}</Btn>
                )}
              </>
            )}
          </Card>
        )}
    </>,
    history:<>
        <CSH label="Your History" visual={t.places&&t.places.list.length?<div style={{display:"flex",gap:2}}>{t.places.list.slice(0,3).map(x=><Flag key={x.name} region={x.name} size={22}/>)}</div>:null} cKey="history" collapsed={collapsed} toggle={toggle} summary={`You've scanned ${t.wines.length} ${tLabel} across ${tCountries} countr${tCountries!==1?'ies':'y'}${tAvgScore?`, scoring them ${tAvgScore} on average`:''}.`}/>
        {/* ── History: one card in the same style as the sections above ── */}
        {!collapsed.history&&(()=>{
          const stats=[
            {label:`${t.label} scanned`,  val:t.wines.length},
            {label:'Average score',       val:tAvgScore||'—', note:tAvgScore?ParkerScale.label(tAvgScore):null, col:tAvgScore?scoreCol(tAvgScore):null},
            {label:'Countries',           val:tCountries||'—'},
            {label:'Blind Call accuracy', val:t.blindCall?`${t.blindCall.accuracy}%`:'—', note:t.blindCall?`${t.blindCall.played} played`:'Play after a scan'},
          ];
          return(
            <Card style={{padding:14}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:10}}>Your {tLabel} so far</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',borderTop:`1px solid ${C.line}`}}>
                {stats.map((x,i)=>(
                  <div key={x.label} style={{padding:'12px 0',paddingLeft:i%2?14:0,borderLeft:i%2?`1px solid ${C.line}`:'none',borderBottom:i<2?`1px solid ${C.line}`:'none'}}>
                    <div style={{fontSize:22,fontWeight:800,color:x.val==='—'?C.mid:(x.col||t.col),fontFamily:C.P,lineHeight:1.1}}>{x.val}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4}}>{x.label}</div>
                    {x.note&&<div style={{fontSize:12,color:C.mid,fontFamily:C.P,opacity:0.75,marginTop:1}}>{x.note}</div>}
                  </div>
                ))}
              </div>
              <div style={{marginTop:12}}><DnaPlaces t={t} nav={nav}/></div>
              {tAvgPrice>0&&(
                <div style={{display:'flex',alignItems:'baseline',gap:8,padding:'10px 0',borderTop:`1px solid ${C.line}`}}>
                  <span style={{fontSize:15,color:C.ink,fontFamily:C.P,flex:1}}>Average price</span>
                  <span style={{fontSize:15,fontWeight:800,color:C.ink,fontFamily:C.P}}>{_cbase}{Math.round(tAvgPrice*_cfx)}</span>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{_ccode} per bottle, est.</span>
                </div>
              )}
              {t.topWines.length>0&&(
                <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:10,marginBottom:6}}>
                    <span style={sub}>Top {t.label}</span>
                    <span onClick={()=>{ try{ Handoff.myWinesView.set({type:t.key,sort:'rating'}); }catch(e){} nav('mywines'); }} style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
                  </div>
                  {t.topWines.map((w,i)=>(
                    <div key={i} onClick={()=>{
                      Handoff.openWine({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0});
                      nav('detail');
                    }} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                      <span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,width:22,flexShrink:0}}>#{i+1}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[w.region,w.vintage?String(w.vintage):null,ParkerScale.label(w.rating)].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span style={{fontSize:15,fontWeight:800,color:scoreCol(w.rating),fontFamily:C.P,width:30,textAlign:'right',flexShrink:0}}>{w.rating}</span>
                    </div>
                  ))}
                </>
              )}
            </Card>
          );
        })()}
    </>,
  };
  const cell=x=><div style={{display:'flex',flexDirection:'column',gap:12,minWidth:0}}>{x}</div>;
  // Which sections show for this type, so the iPad pairs only those (no empty half beside one).
  // How much they see (DetailLevel): Simple is the useful rows (House Wines, Explore Next, the
  // script, History) and a line on their best value; More adds Journey and How Well We Know You;
  // Everything the full Value, the style bars and Flavour Signatures.
  const shown={written:ContentEngine.forType(t.key,allWines).length>0,knows:more&&t.scored.length>0,house:t.house.length>0,taste:all&&t.wines.length>0,
    value:all?!!t.value:!!(t.value&&t.value.bestValue.length),
    explore:t.explore.picks.length>0,flavour:all&&t.wines.length>=2&&t.noteClusters.length>0,journey:more&&t.journey.length>=2,scripts:t.wines.length>0,history:true};
  Object.keys(S).forEach(k=>{ if(!shown[k]) S[k]=null; });
  const FULL={knows:1,explore:1};
  const tablet=[];
  { let half=null; const flush=()=>{ if(half){ tablet.push(<React.Fragment key={half}>{S[half]}</React.Fragment>); half=null; } };
    ['written','house','knows','taste','value','explore','flavour','journey','scripts','history'].filter(k=>shown[k]).forEach(k=>{
      if(FULL[k]){ flush(); tablet.push(<React.Fragment key={k}>{S[k]}</React.Fragment>); return; }
      if(half){ tablet.push(<WideColumns key={half+k}>{cell(S[half])}{cell(S[k])}</WideColumns>); half=null; } else half=k; });
    flush(); }
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px'}}>WineDNA</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:46}}>
          <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{allWines.length} bottle{allWines.length!==1?'s':''} scanned · {allWines.filter(w=>w.rating>0).length} scored</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
      <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        {/* First visits: what WineDNA is, until they've read it once. */}
        {!welcomed&&<div data-testid="dna-welcome" style={{background:C.crSoft,borderRadius:16,padding:'14px 16px',display:'flex',flexDirection:'column',gap:6}}>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>What is WineDNA?</div>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Every bottle you score teaches us your taste. This page shows what the wines you love have in common, so you can pick the next one with confidence. Tap any picture to see what it means.</div>
          <div role="button" onClick={()=>{ Flags.markDnaWelcomeSeen(); setWelcomed(true); }} style={{alignSelf:'flex-start',fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer',marginTop:2}}>Got it</div>
        </div>}
        <SH label="Your WineDNA"/>
        {/* ── Synthesis Card ── */}
        <Card style={{padding:0,overflow:'hidden'}}>

          {/* Type-distribution bar */}
          <div style={{height:5,display:'flex'}}>
            {typeStats.filter(ts=>ts.pct>0).map(ts=><div key={ts.key} style={{width:`${ts.pct}%`,background:ts.col}}/>)}
          </div>

          <div style={{padding:'14px 16px 16px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Type tabs — base four always shown (greyed out + toast if unscanned, matching Home); Orange/Dessert/Fortified only appear, on a second row, once scanned */}
            <div style={{position:'relative'}}>
              {[visibleIdxs.filter(i=>i<4),visibleIdxs.filter(i=>i>=4)].filter(row=>row.length).map((row,ri)=>(
                <div key={ri} style={{display:'flex',gap:5,marginTop:ri?5:0}}>
                  {row.map(i=>{
                    const tp=_TYPES[i];
                    return(
                      <div key={i} onClick={()=>pickType(i)} style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:10,background:i===typeIdx?tp.col+'18':C.offWhite,border:`1.5px solid ${i===typeIdx?tp.col+'55':'transparent'}`,cursor:'pointer',opacity:typeStats[i].wines.length?1:0.45}}>
                        <div style={{width:7,height:7,borderRadius:4,background:tp.col,margin:'0 auto 3px'}}/>
                        <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.tab}</div>
                        <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div style={{height:1,background:C.line}}/>

            {t.wines.length===0?(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>No {tLabel} scanned yet.</div>
                <Btn primary small onClick={()=>nav('camera')} style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:10}}>Scan a Bottle</Btn>
              </div>
            ):(
              <>
                <DnaTitle t={t} basisLine={basisLine}/>
                <div data-testid="dna-intro" style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:-4}}>Your taste, worked out from the {WineDNA.noun(t.key,t.wines.length)} you've scanned and scored. The more you score, the sharper it gets.</div>
                {/* The portrait (DetailLevel): pictures first, the written summary one tap away. */}
                <DnaTasteTiles t={t} nav={nav}/>
                <DnaFacts t={t} chips={chips} conf={conf}/>
                <DnaFlavourPills t={t}/>
                {DetailLevel.at('everything')&&<DnaLoveAvoid t={t}/>}
                {(genSummaries[t.key]||generatingSummary===t.key)&&<DnaReadMore label="Read your WineDNA in words">
                {generatingSummary===t.key&&!genSummaries[t.key]?(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                    <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Reading your palate…</span>
                  </div>
                ):(()=>{
                  const raw=genSummaries[t.key];
                  let sections=null;
                  if(raw){try{sections=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){sections=null;}}
                  if(!sections) return raw?<p style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.68,margin:0}}>{raw}</p>:null;
                  return(
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {[
                        {label:'Your Style',text:sections.style},
                        {label:'What You Love',text:sections.love},
                        {label:'What Didn’t Work',text:t.favourites.disliked.length||(t.loves.nots||[]).length?sections.miss:null},
                      ].filter(s=>s.text).map((s,i)=>(
                        <div key={i}>
                          <div style={{fontSize:12,fontWeight:700,color:t.col,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>{s.label}</div>
                          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,textWrap:'pretty'}}>{s.text}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
                </DnaReadMore>}
              </>
            )}
          </div>
        </Card>

        {wide?<>{tablet}</>:<>{S.written}{S.knows}{S.house}{S.taste}{S.value}{S.explore}{S.flavour}{S.journey}{S.scripts}{S.history}</>}

        {!DetailLevel.at('everything')&&<div data-testid="dna-more-later" style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5,textAlign:'center',padding:'2px 8px'}}>
          More of your WineDNA appears here as you learn. <span role="button" onClick={()=>DetailLevel.setShowAll(true)} style={{color:C.cr,fontWeight:700,cursor:'pointer'}}>Show all details</span>
        </div>}

        {/* ── Data Backup ── */}
        <DataBackupCard padding={14}/>

        {/* App version */}
        <div style={{textAlign:'center',padding:'12px 0 4px',opacity:0.45}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v{__APP_VERSION__}</span>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes dnaSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{WineDNAScreen,WineIQScreen:WineDNAScreen});
