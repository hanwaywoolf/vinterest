/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s){return(s||'').toLowerCase().replace('é','e');}
function _avg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;}
/* Rating-weighted tally — an attribute (grape/region/note) earns weight from every wine it appears in, scaled by that wine's rating, so one obscure low-rated bottle can't outrank several wines you actually rated well. */
function _topByWeightedCount(items){const c={};items.forEach(({v,rating})=>{if(v)c[v]=(c[v]||0)+Math.max(rating||55,5);});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function _topNotes(wines,n){const all=[];wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{if(t)all.push({v:t,rating:w.rating});}));return _topByWeightedCount(all).slice(0,n);}

/* ── Flavour clusters ── */
const _NOTE_CLUSTERS=[
  {name:'Dark Fruit & Spice',    kw:['blackberry','blackcurrant','black cherry','plum','dark cherry','black fruit','blueberry','clove','pepper','spice','anise','liquorice']},
  {name:'Red Fruit & Floral',    kw:['cherry','raspberry','strawberry','redcurrant','red fruit','pomegranate','violet','rose','hibiscus']},
  {name:'Earth & Leather',       kw:['earth','leather','tobacco','truffle','forest floor','mushroom','barnyard','smoke','tar','graphite','iron']},
  {name:'Citrus & Mineral',      kw:['lemon','lime','grapefruit','citrus','mineral','chalk','flint','oyster','saline','wet stone','slate']},
  {name:'Oak & Vanilla',         kw:['vanilla','caramel','toast','oak','cedar','sandalwood','coconut','cream','butterscotch']},
  {name:'Herb & Savour',         kw:['herb','thyme','rosemary','olive','green pepper','eucalyptus','menthol','garrigue','dried herb']},
  {name:'Tropical & Stone Fruit',kw:['peach','apricot','nectarine','mango','pineapple','passion fruit','melon','guava','lychee']},
  {name:'Brioche & Yeast',       kw:['brioche','toast','biscuit','bread','yeast','pastry','almonds','hazelnut']},
];
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
const _TYPES=[
  {key:'red',       label:'Reds',     col:'#8B1A2F'},
  {key:'white',     label:'Whites',   col:'#B8963E'},
  {key:'rose',      label:'Rosé',     col:'#C47A8A'},
  {key:'sparkling', label:'Sparkling',col:'#5E8FA8'},
  {key:'orange',    label:'Orange',   col:'#C1652B'},
  {key:'dessert',   label:'Dessert',  col:'#8A5A2B'},
  {key:'fortified', label:'Fortified',col:'#5C2A1E'},
];

/* Collapsible section header — collapsed state shows a short useful summary + expand CTA below the title */
function CSH({label,cKey,collapsed,toggle,summary}){
  const isC=collapsed[cKey];
  return(
    <div style={{marginTop:6,marginBottom:isC?12:6}}>
      <div onClick={()=>toggle(cKey)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:'2px 0'}}>
        <span style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P}}>{label}</span>
        <svg viewBox="0 0 20 20" width={16} height={16} style={{transform:isC?'none':'rotate(180deg)',transition:'transform .2s',flexShrink:0,marginLeft:8,opacity:0.45}}>
          <polyline points="4,7 10,13 16,7" stroke={C.mid} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {isC&&summary&&(
        <div style={{marginTop:4}}>
          <div style={{fontSize:14.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty'}}>{summary}</div>
          <span onClick={()=>toggle(cKey)} style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer',display:'inline-block',marginTop:6}}>Expand for full details →</span>
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
        <div style={{height:'100%',width:`${Math.min(1,v||0)*100}%`,borderRadius:6,background:col,opacity:0.85}}/>
      </div>
      {loved!=null&&<div title="Your 90+ wines" style={{position:'absolute',left:`calc(${Math.min(1,loved)*100}% - 6px)`,width:12,height:12,borderRadius:'50%',background:C.ink,boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>}
    </div>
  );
}

/* ──────────────────────────────────────────────────
   WineDNA Screen — renders WineDNA.profile (pwa-winedna.js) for each wine type
────────────────────────────────────────────────── */
function WineDNAScreen({nav,back,showPro}){
  const [typeIdx,setTypeIdx]=React.useState(0);
  const [tabToast,setTabToast]=React.useState(null);
  const [genSummaries,setGenSummaries]=React.useState({});
  const [generatingSummary,setGeneratingSummary]=React.useState(null);
  const [genScripts,setGenScripts]=React.useState({});
  const [generatingScript,setGeneratingScript]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const [scriptLength,setScriptLength]=React.useState(localStorage.getItem('vinterest_script_length')||'long');
  const COLLAPSE_KEY='vinterest_dna_collapsed_v1';
  const [collapsed,setCollapsed]=React.useState(()=>{
    const def={love:false,taste:false,value:false,explore:false,flavour:false,journey:false,scripts:false,history:false};
    try{
      const saved=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'null');
      if(saved) return {...def,...saved};
    }catch(e){}
    return def;
  });
  const toggle=React.useCallback(k=>setCollapsed(c=>{
    const next={...c,[k]:!c[k]};
    try{localStorage.setItem(COLLAPSE_KEY,JSON.stringify(next));}catch(e){}
    return next;
  }),[]);
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
    return{...tp,...p,pct,topNotes,noteClusters:_clusterNotes(topNotes),explore,topWines};
  }),[sig]);

  const t=typeStats[typeIdx];
  const visibleIdxs=typeStats.reduce((arr,ts,i)=>{ if(i<4||ts.wines.length>0) arr.push(i); return arr; },[]);
  function pickType(i){
    if(i<4&&typeStats[i].wines.length===0){ setTabToast(`You haven't scanned a ${typeStats[i].label.toLowerCase()} yet`); setTimeout(()=>setTabToast(null),1800); return; }
    setTypeIdx(i);
  }
  function stepType(dir){
    const pos=visibleIdxs.indexOf(typeIdx);
    const next=visibleIdxs[Math.min(visibleIdxs.length-1,Math.max(0,pos+dir))];
    setTypeIdx(next);
  }

  /* Written summary: Claude restates the computed facts (WineDNA.summaryFacts) in plain language.
     Keyed on the wine signature so a new scan or a changed score refreshes it. */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_dna_v6_${t.key}_${sig}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenSummaries(s=>({...s,[t.key]:cached}));return;}
    if(generatingSummary===t.key) return;
    setGeneratingSummary(t.key);
    const hasDislikes=t.favourites.disliked.length>0;
    const prompt=`You write the summary at the top of a wine drinker's WineDNA profile. The app is educational: be warm, specific and confidence-building, and help them buy better next time. Use ONLY these facts, computed from their own scans and 100-point scores; never invent grapes, regions, wines or numbers, and don't claim a preference the facts don't state. If they've scored fewer than 8, say gently that the picture is still forming.\n\nFacts:\n${WineDNA.summaryFacts(t)}\n\nReturn ONLY raw JSON, no markdown: {"style":"one sentence on the style of ${t.label.toLowerCase()} they reach for, max 22 words","love":"one sentence on what their highest scores have in common and what to look for next, max 26 words"${hasDislikes?',"miss":"one sentence on what the wines they scored under 80 share, framed as useful to know when buying, max 22 words"':''}}`;
    window.claude.complete({purpose:'winedna_summary',messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=(text||'').trim(); if(s){localStorage.setItem(key,s);setGenSummaries(g=>({...g,[t.key]:s}));}})
      .catch(()=>{})
      .finally(()=>setGeneratingSummary(null));
  },[typeIdx,sig]);

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
  if(fav.regions[0]) chips.push({label:'Top-scoring region',value:`${fav.regions[0].name} · ${fav.regions[0].avg}`});
  const conf=t.confidence;
  const basisLine=t.basis==='loved'
    ?`Based on your ${t.loved.length} Outstanding (90+) ${tLabel}`
    :`Based on the ${WineDNA.noun(t.key,t.wines.length)} you've ${conf.n>0?'chosen':'scanned'}`;

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
                        <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.label}</div>
                        <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {tabToast&&<div style={{position:'absolute',top:'calc(100% + 8px)',left:0,right:0,textAlign:'center',fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P,background:C.cr,borderRadius:10,padding:'10px 14px',zIndex:20,boxShadow:'0 4px 16px rgba(0,0,0,0.15)',animation:'dnaToast 1.8s ease both'}}>{tabToast}</div>}
            </div>

            <div style={{height:1,background:C.line}}/>

            {t.wines.length===0?(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>No {tLabel} scanned yet.</div>
                <Btn primary small onClick={()=>nav('camera')} style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:10}}>Scan a Bottle</Btn>
              </div>
            ):(
              <>
                <div>
                  <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>WineDNA</span>
                    <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
                      <div style={{width:5,height:5,borderRadius:3,background:t.col}}/>
                      <span style={{fontSize:12,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.label}</span>
                    </div>
                  </div>
                  <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px',lineHeight:1.15}}>{t.personality}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:3}}>{basisLine}</div>
                </div>

                {/* Written summary (Claude, from computed facts only) */}
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
                        {label:'What Didn’t Work',text:t.favourites.disliked.length?sections.miss:null},
                      ].filter(s=>s.text).map((s,i)=>(
                        <div key={i}>
                          <div style={{fontSize:12,fontWeight:700,color:t.col,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>{s.label}</div>
                          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,textWrap:'pretty'}}>{s.text}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Fact chips */}
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {chips.map((ch,i)=>(
                    <div key={i} style={{padding:'5px 11px',borderRadius:20,background:i===0?`${t.col}10`:C.offWhite,border:`1px solid ${i===0?t.col+'30':C.line}`,display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:i===0?t.col:C.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.value}</span>
                    </div>
                  ))}
                </div>

                {/* How much to trust this, and what sharpens it */}
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{display:'flex',gap:3}}>
                    {['early','good','strong'].map((l,i)=><div key={l} style={{width:16,height:5,borderRadius:3,background:['early','good','strong'].indexOf(conf.level)>=i?t.col:C.line}}/>)}
                  </div>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>
                    {conf.n} scored{conf.next?` · ${conf.next}`:' · a strong read'}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* ── What You Love: what separates your best-scored wines, and where they come from ── */}
        {t.wines.length>0&&<CSH label="What You Love" cKey="love" collapsed={collapsed} toggle={toggle} summary={t.signals.length?t.signals[0].text+(t.signals[1]?' '+t.signals[1].text:''):fav.regions.length?`${fav.regions[0].name} is where your highest scores come from.`:`Score more ${tLabel} to see what your favourites have in common.`}/>}
        {t.wines.length>0&&!collapsed.love&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>What you love</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:12}}>What your Outstanding (90+) {tLabel} have in common, compared with the rest.</div>
            {t.signals.length>0?(
              <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:14}}>
                {t.signals.map(s=>(
                  <div key={s.axis} style={{padding:'10px 12px',borderRadius:12,background:`${t.col}08`,border:`1px solid ${t.col}25`}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.text}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:6}}>{s.detail}</div>
                    <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}><span style={{fontWeight:700,color:t.col}}>Where to look: </span>{s.tip}</div>
                  </div>
                ))}
              </div>
            ):(
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55,marginBottom:14,padding:'10px 12px',borderRadius:12,background:C.offWhite}}>
                {conf.n<8
                  ?`Score ${WineDNA.noun(t.key,8-conf.n)} more and this will show what separates the ones you love from the rest: ${t.axes.map(k=>WineDNA.AXES[k].name.toLowerCase()).join(', ')}.`
                  :t.loved.length<3
                    ?`You haven't scored ${WineDNA.noun(t.key,3)} at 90 or above yet. Once you do, this will show what they have in common.`
                    :`No single trait separates your favourites yet: you enjoy ${tLabel} across a range of styles. That's a strength when choosing from a wine list.`}
              </div>
            )}

            {(fav.regions.length>0||fav.grapes.length>0)&&(
              <>
                <div style={{...sub,marginBottom:6}}>Where your best scores come from</div>
                {[...fav.regions.map(r=>({...r,kind:'Region'})),...fav.grapes.map(g=>({...g,kind:'Grape'}))].map(x=>(
                  <div key={x.kind+x.name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderTop:`1px solid ${C.line}`}}>
                    <span style={{fontSize:12,color:C.mid,fontFamily:C.P,width:48,flexShrink:0}}>{x.kind}</span>
                    <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,flex:1}}>{x.name}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{x.count} bottle{x.count!==1?'s':''}</span>
                    <span style={{fontSize:15,fontWeight:800,color:x.avg>=ParkerScale.LOVED?C.green:C.amber,fontFamily:C.P,width:30,textAlign:'right'}}>{x.avg}</span>
                  </div>
                ))}
                {fav.mostScanned&&fav.regions[0]&&fav.mostScanned.name!==fav.regions[0].name&&(
                  <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:8}}>You scan {fav.mostScanned.name} most, but {fav.regions[0].name} scores highest. Worth seeking out more of it.</div>
                )}
              </>
            )}

            {(fav.rethink.length>0||fav.disliked.length>0)&&(
              <div style={{marginTop:14}}>
                <div style={{...sub,marginBottom:6}}>Worth knowing before you buy</div>
                {fav.rethink.map(x=>(
                  <div key={'r'+x.name} style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:4}}>{x.name}{x.also?` (${x.also})`:''} averages {x.avg} across {x.count} bottles, below your usual. Try a different producer or style before writing it off.</div>
                ))}
                {fav.disliked.map(w=>(
                  <div key={'d'+w.name} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderTop:`1px solid ${C.line}`}}>
                    <span style={{fontSize:14,color:C.ink,fontFamily:C.P,flex:1}}>{w.name}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{w.region||''}</span>
                    <span style={{fontSize:15,fontWeight:800,color:'#C0392B',fontFamily:C.P}}>{w.rating}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── Taste profile: the style of what you choose, with your 90+ wines marked ── */}
        {t.wines.length>0&&<CSH label="Taste Profile" cKey="taste" collapsed={collapsed} toggle={toggle} summary={t.axes.filter(t.showAxis).map(k=>`${WineDNA.AXES[k].name}: ${WineDNA.AXES[k][WineDNA.level(t.avg[k])]}`).join(' · ')}/>}
        {t.wines.length>0&&!collapsed.taste&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Your {tLabel} style</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:12,fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:12}}>
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
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:C.mid,fontFamily:C.P,opacity:0.7,marginTop:2}}><span>{A.low}</span><span>{A.high}</span></div>
                    {t.axisNotes[k]&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4,lineHeight:1.55,textWrap:'pretty'}}>{t.axisNotes[k]}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:12,lineHeight:1.5,opacity:0.8}}>Each wine's style is estimated from its label when you scan it: what the wine is typically like, not a tasting note.</div>
          </Card>
        )}

        {/* ── Value: price against score ── */}
        {t.value&&<CSH label="Value" cKey="value" collapsed={collapsed} toggle={toggle} summary={t.value.verdict?t.value.verdict.text:`Your best-value ${tLabel}, from ${t.value.n} scored bottles with prices.`}/>}
        {t.value&&!collapsed.value&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Getting value</div>
            {t.value.verdict&&<div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55,marginBottom:10}}>{t.value.verdict.text}</div>}
            {t.value.sweetSpot&&(
              <div style={{padding:'8px 12px',borderRadius:10,background:C.amberBg,border:`1px solid ${C.amber}25`,marginBottom:10}}>
                <span style={{fontSize:14,color:C.amber,fontFamily:C.P,fontWeight:700}}>Your sweet spot: {t.value.sweetSpot}</span>
                <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>Where most of your Outstanding {tLabel} are priced.</div>
              </div>
            )}
            {t.value.bestValue.length>0&&(
              <>
                <div style={{...sub,marginBottom:6}}>Best value so far</div>
                {t.value.bestValue.map(b=>(
                  <div key={b.wine.name} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderTop:`1px solid ${C.line}`}}>
                    <span style={{fontSize:14,color:C.ink,fontFamily:C.P,flex:1}}>{b.wine.name}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{b.price} est.</span>
                    <span style={{fontSize:15,fontWeight:800,color:C.green,fontFamily:C.P,width:30,textAlign:'right'}}>{b.wine.rating}</span>
                  </div>
                ))}
                <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginTop:8}}>Scored 90+ at or below your typical price. Remember these producers: they're good bets on a list or in a shop.</div>
              </>
            )}
            <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:10,opacity:0.8}}>Prices are estimates from your scans ({t.value.code}).</div>
          </Card>
        )}

        {t.wines.length>=3&&t.explore.picks.length>0&&<CSH label="Explore" cKey="explore" collapsed={collapsed} toggle={toggle} summary={`${t.explore.picks.length} styles picked from your ${tLabel} DNA. Top pick: ${t.explore.picks[0].style.name} (${t.explore.picks[0].style.country}).${t.explore.explored.length?` You've explored ${t.explore.explored.length} so far.`:''}`}/>}
        {/* ── Explore Next: styles to try, ranked from this type's WineDNA (ExploreNext, pwa-content-engine.js) ── */}
        {t.wines.length>=3&&t.explore.picks.length>0&&!collapsed.explore&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Explore Next</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:12,lineHeight:1.5}}>Styles that share your {tLabel} DNA but take you somewhere new. Tap one to learn what it's like and how to find it.</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.explore.picks.map((p,i)=>(
                <div key={p.style.id}
                  onClick={()=>{sessionStorage.setItem('vinterest_style_explore',JSON.stringify({id:p.style.id,typeKey:t.key,label:t.label}));nav('style-explore');}}
                  style={{padding:'12px 12px',borderRadius:12,background:i===0?`${t.col}08`:C.offWhite,border:`1px solid ${i===0?t.col+'25':C.line}`,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,marginBottom:6}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{p.style.name}</div>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>{p.style.country}</span>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
                    {p.shares&&<span style={{fontSize:12,fontWeight:600,color:C.green,background:C.greenBg,border:`1px solid ${C.green}30`,borderRadius:20,padding:'2px 9px',fontFamily:C.P}}>Shares: {p.shares}</span>}
                    <span style={{fontSize:12,fontWeight:600,color:t.col,background:`${t.col}10`,border:`1px solid ${t.col}30`,borderRadius:20,padding:'2px 9px',fontFamily:C.P}}>New: {p.style.adds}</span>
                  </div>
                  <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty',marginBottom:6}}>{p.why}</div>
                  <div style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P}}>Learn about it & find a bottle →</div>
                </div>
              ))}
            </div>
            {t.explore.explored.length>0&&(
              <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
                <div style={{...sub,marginBottom:6}}>Already explored</div>
                {t.explore.explored.map(e=>(
                  <div key={e.style.id} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span>
                    <span style={{fontSize:14,color:C.ink,fontFamily:C.P,flex:1}}>{e.style.name}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{e.wine.rating?`you scored it ${e.wine.rating}`:'scanned'}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── Flavour Signatures ── */}
        {t.wines.length>=2&&t.noteClusters.length>0&&<CSH label="Flavour Signatures" cKey="flavour" collapsed={collapsed} toggle={toggle} summary={`${t.noteClusters[0].name} is the most common flavour family across your ${tLabel}.${t.noteClusters[1]?' '+t.noteClusters[1].name+' shows up often too.':''}`}/>}
        {t.wines.length>=2&&t.noteClusters.length>0&&!collapsed.flavour&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Flavour Signatures</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:12}}>The flavour families that come up most in your {tLabel}, and food that suits them.</div>
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

        {/* ── Your Journey: how your choices are changing ── */}
        {t.journey.length>=2&&(()=>{
          const J=t.journey, last=J[J.length-1];
          const totalRegions=new Set(t.wines.map(w=>w.region).filter(Boolean)).size;
          const totalGrapes=t.grapeStats.length;
          const maxN=Math.max(...J.map(b=>b.count));
          const lastNew=[...last.newRegions];
          const summary=lastNew.length
            ?`${['day','week'].includes(last.unit)?(last.unit==='day'?'On':'The week of'):'In'} ${last.label} you tried ${lastNew.length} new region${lastNew.length!==1?'s':''}: ${lastNew.slice(0,3).join(', ')}${lastNew.length>3?` and ${lastNew.length-3} more`:''}.`
            :`You've explored ${totalRegions} regions and ${totalGrapes} grapes in your ${tLabel} so far.`;
          return(
            <>
              <CSH label="Your Journey" cKey="journey" collapsed={collapsed} toggle={toggle} summary={summary}/>
              {!collapsed.journey&&(
                <Card style={{padding:14}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>How your choices are changing</div>
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginBottom:14,lineHeight:1.5}}>{tLabel.charAt(0).toUpperCase()+tLabel.slice(1)} scanned over time, and how many regions each period was your first taste of.</div>
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
                        <div style={{fontSize:11,fontWeight:600,color:b.newRegions.length?C.green:C.mid,fontFamily:C.P,opacity:b.newRegions.length?1:0.6}}>{b.newRegions.length?`+${b.newRegions.length} new`:'—'}</div>
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
                    <div key={len} onClick={()=>{setScriptLength(len);localStorage.setItem('vinterest_script_length',len);setGenScripts(s=>{const n={...s};delete n[t.key];return n;});}} style={{padding:'4px 8px',borderRadius:4,background:scriptLength===len?C.cr:'transparent',cursor:'pointer'}}>
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

        <CSH label="Your History" cKey="history" collapsed={collapsed} toggle={toggle} summary={`You've scanned ${t.wines.length} ${tLabel} across ${tCountries} countr${tCountries!==1?'ies':'y'}${tAvgScore?`, scoring them ${tAvgScore} on average`:''}.`}/>
        {/* ── Stats grid ── */}
        {!collapsed.history&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[
            {icon:'wine',  label:`${t.label} scanned`, val:t.wines.length,                         col:t.col,     bg:t.col+'15'},
            {icon:'star',  label:'Average score',        val:tAvgScore?`${tAvgScore}`:'—',            col:C.amber,  bg:C.amberBg, note:tAvgScore?ParkerScale.label(tAvgScore):null},
            {icon:'globe', label:'Countries',            val:tCountries||'—',                         col:C.green,  bg:C.greenBg},
            {icon:'bolt',label:'Blind Call accuracy',  val:t.blindCall?`${t.blindCall.accuracy}%`:'—', col:'#7B5EA7', bg:'#F0EBF8', note:t.blindCall?`${t.blindCall.played} played`:'Play after a scan'},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:14,padding:'12px 14px',border:`1px solid ${s.col}20`,display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:24,height:24,borderRadius:6,background:`${s.col}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n={s.icon} sz={13} col={s.col}/>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:s.col,fontFamily:C.P,lineHeight:1}}>{s.val}</div>
              </div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{s.label}{s.note?<span style={{opacity:0.75}}> · {s.note}</span>:null}</div>
            </div>
          ))}
        </div>}

        {/* ── Average price if available ── */}
        {!collapsed.history&&tAvgPrice>0&&(
          <Card style={{background:C.amberBg,border:`1px solid ${C.amber}25`,padding:12,boxShadow:'none'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:2}}>Avg Price · {t.label}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}>
              <div style={{fontSize:19,fontWeight:800,color:C.amber,fontFamily:C.P}}>{_cbase}{Math.round(tAvgPrice*_cfx)}</div>
              <span style={{fontSize:11,fontWeight:700,color:C.amber+'99',fontFamily:C.P,letterSpacing:'0.04em'}}>{_ccode}</span>
              <span style={{fontSize:15,fontWeight:400,color:C.mid,marginLeft:2}}>per bottle, est.</span>
            </div>
          </Card>
        )}

        {!collapsed.history&&t.topWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'12px 14px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Top {t.label}</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
            </div>
            {t.topWines.map((w,i)=>{
              const col=_TYPE_COLORS[_norm(w.type)]||C.cr;
              return(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:24,height:24,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:C.cr,fontFamily:C.P}}>#{i+1}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null,ParkerScale.label(w.rating)].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:1,flexShrink:0}}>
                    <span style={{fontSize:18,fontWeight:800,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>/100</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── Data Backup ── */}
        <Card style={{padding:14}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');a.href=url;a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1}} onClick={()=>{
              const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
              inp.onchange=e=>{
                const file=e.target.files[0];if(!file)return;
                const reader=new FileReader();
                reader.onload=ev=>{
                  try{
                    const d=JSON.parse(ev.target.result);
                    if(d.wines)WineHistory.save(d.wines);
                    if(d.xp)localStorage.setItem(XPSystem.KEY,JSON.stringify(d.xp));
                    alert('Restored! '+((d.wines||[]).length)+' wines imported.');
                    window.location.reload();
                  }catch(err){alert('Could not read backup file.');}
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP as a JSON file. Import restores from a previous backup.</div>
        </Card>

        {/* App version */}
        <div style={{textAlign:'center',padding:'12px 0 4px',opacity:0.45}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v{__APP_VERSION__}</span>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes dnaSpin{to{transform:rotate(360deg)}}\n@keyframes dnaToast{0%{opacity:0;transform:translateY(-6px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}`}</style>
    </div>
  );
}

Object.assign(window,{WineDNAScreen,WineIQScreen:WineDNAScreen});
