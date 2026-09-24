/* Vinterest PWA — Scan Result Cards
   A swipeable deck of quick-hit cards shown right after a label scan, BEFORE
   the full detail screen. Intent gate → cards (match, fit, caution, origin,
   fact, taste, talk, value) → rate (only if they've had / will have it).
   Deck interaction is tweakable: swipe deck / carousel / feed. */

/* ── content generation (batched, cached) ── */
/* Verified aging-classification facts — given to the model verbatim so it can never invent wrong numbers
   for well-known denominations (a learning platform can't afford to misstate these). */
const _AGING_FACTS=[
  {test:/riserva/i,fact:'Chianti Classico Riserva must age at least 24 months, with a minimum of 3 months in bottle, before release.'},
  {test:/gran\s*reserva/i,fact:'Rioja Gran Reserva reds require a minimum of 5 years aging before release, with at least 2 years in oak barrel and 2 more years in bottle.'},
  {test:/reserva/i,fact:'Rioja Reserva reds require a minimum of 3 years aging before release, with at least 1 year in oak barrel and at least 6 months in bottle.'},
  {test:/crianza/i,fact:'Rioja Crianza reds require a minimum of 2 years aging before release, with at least 1 year in oak barrel.'},
  {test:/vintage\s*champagne|champagne.*vintage/i,fact:'Vintage Champagne must age on its lees for a minimum of 3 years before release, versus 15 months for non-vintage.'},
  {test:/vintage\s*port/i,fact:'Vintage Port is bottled after only about 2 years in barrel, then does most of its aging in bottle for decades.'},
];
function _agingFactFor(w){
  const hay=[w.name,w.producer].filter(Boolean).join(' ');
  const hit=_AGING_FACTS.find(f=>f.test.test(hay));
  return hit?hit.fact:null;
}
function useScanContent(wine,match){
  const [gen,setGen]=React.useState(null);
  const [loading,setLoading]=React.useState(false);
  const verdict=match?match.verdict:'x';
  React.useEffect(()=>{
    if(!wine||!wine.name) return;
    const key='vinterest_scancards_v6_'+(wine.name||'').replace(/\s/g,'_')+'_'+(wine.vintage||'nv')+'_'+verdict;
    const cached=localStorage.getItem(key);
    if(cached){ try{ setGen(JSON.parse(cached)); return; }catch(e){} }
    if(!window.claude||!window.claude.complete) return;
    setLoading(true);
    const w=wine;
    // The cards may only restate what TasteMatch computed from the user's own scores.
    const matchFacts=match?[
      `Match verdict for this user: "${match.label}".`,
      match.style?`Style from the label estimate: ${match.style}.`:'',
      ...match.reasons.map(r=>`Fact about their history: ${r.text}`),
    ].filter(Boolean).join(' '):'No rating history yet.';
    const agingFact=_agingFactFor(w);
    const agingLine=agingFact?`REFERENCE AGING FACTS (use verbatim, do not alter the numbers): ${agingFact}`:'REFERENCE AGING FACTS: none available for this wine’s classification — do not state specific aging durations you are not certain of.';
    const prompt=
      'You are a warm, knowledgeable sommelier writing quick-hit cards for a wine app that teaches people about wine and helps them buy well. '+
      'Wine: '+(w.name||'')+(w.vintage&&w.vintage!=='NV'&&w.vintage!==0?' '+w.vintage:'')+'. '+
      'Type: '+(w.type||'red')+'. Region: '+(w.region||'')+((w.sub_region)?' ('+w.sub_region+')':'')+', '+(w.country||'')+'. '+
      'Producer: '+(w.producer||'unknown')+'. '+
      'Grapes: '+(WineDNA.grapeLine(w)||'unknown')+(w.grapes_basis==='typical'?' (not stated on the label: what this wine usually contains)':'')+'. '+
      (w.blend||(w.grapes||[]).length>1?'This is a blend: call it a blend led by its main grape, never a single-grape wine. ':'')+
      'Tasting notes: '+((w.tasting_notes||[]).join(', ')||'n/a')+'. '+
      matchFacts+' '+agingLine+' '+
      'Return ONLY valid JSON, no markdown, all sentences concrete and specific to THIS wine (no generic filler), and NO numbers/percentages/decimals anywhere EXCEPT when referencing a specific year/vintage — years must always be written as numerals (e.g. "2010", never "twenty ten"): '+
      '{'+
      '"fact":"one genuinely surprising, memorable fact about this wine, its producer, grape, or region (max 28 words)",'+
      '"fit":"one vivid sentence about this wine\'s style for this drinker, consistent with the match verdict above: for a likely favourite or good bet, why it suits them; for could go either way, what might win them over; for probably not for you, how it differs from what they usually love and when it could still be worth trying. Honest, never oversold. Only name grapes, regions or wines that appear in the facts above (max 28 words)",'+
      '"caution":"one specific, practical thing worth knowing before or while drinking THIS bottle — e.g. decanting, serving temperature, food pairing, or how it will develop with age. Speak directly, no hedging like \\"if you prefer\\" (max 24 words)",'+
      '"origin":"one sentence painting the place this comes from — landscape, climate or culture (max 26 words)",'+
      '"region_style":"one sentence on what makes wines from here distinctive (max 24 words)",'+
      '"estate":"one sentence on the producer/winemaker and the estate\'s history or reputation — if producer is unknown, describe the typical winemaking approach in this region instead (max 26 words)",'+
      '"talk":["three SHORT quotable phrases (each max 12 words) a drinker could say out loud to sound clued-in about this exact wine"],'+
      '"fact2":"one specific, memorable aging/classification/production fact that helps this bottle make sense. If REFERENCE AGING FACTS are given, you MUST use those exact figures verbatim (paraphrase the wording only, never change the numbers). If none are given, give a general production fact that does NOT state specific aging durations you are not certain of (max 22 words)"'+
      '}';
    window.claude.complete({purpose:'scancard',messages:[{role:'user',content:prompt}]})
      .then(text=>{
        let c=text.replace(/```json|```/g,'').trim();
        const s=c.indexOf('{'),e=c.lastIndexOf('}');
        if(s>=0&&e>s) c=c.slice(s,e+1);
        const d=JSON.parse(c);
        localStorage.setItem(key,JSON.stringify(d));
        setGen(d);
      })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[wine&&wine.name,wine&&wine.vintage,verdict]);
  return {gen,loading};
}

/* ── small helpers ── */
const lvl=(v,lo,mid,hi)=>v>=0.68?hi:v>=0.38?mid:lo;
/* Wine name + vintage for display — skips appending the vintage again when it's already part of the name string (e.g. "Viña Ardanza Reserva 2020"). */
function _wineTitle(w){
  if(!w) return '';
  const name=(w.name||'').trim();
  const vy=(w.vintage&&w.vintage!==0&&w.vintage!=='NV')?String(w.vintage):null;
  if(!vy||name.endsWith(vy)) return name;
  return `${name} ${vy}`;
}
function ScanShimmer({col}){
  return <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
    <span style={{width:11,height:11,borderRadius:6,border:`2px solid ${col}33`,borderTopColor:col,animation:'scSpin .8s linear infinite'}}/>
    <span style={{fontSize:14,color:col,fontFamily:C.P,fontStyle:'italic',opacity:.8}}>Pouring the details…</span>
  </span>;
}
const _TONE_COL={good:C.green,neutral:C.amber,bad:'#B04A3A'};
/* The wine-type colour WineDNA uses (_TYPE_COLORS), for sliders and selections on this wine. */
function _typeCol(w){ return (typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS[WineDNA._t(w&&w.type)])||C.cr; }

/* The match ring: TasteMatch's percentage, or a dash when it's too early to call. Its text is
   sized to the ring in string px, so a larger text size (TextSize) doesn't spill out of it. */
function MatchRing({match,size=96}){
  const pct=match?match.pct:null, col=_TONE_COL[match?match.tone:'neutral'];
  const r=52,circ=2*Math.PI*r;
  return <div style={{position:'relative',width:size,height:size,flexShrink:0}}>
    <svg width={size} height={size} viewBox="0 0 130 130" style={{transform:'rotate(-90deg)'}}>
      <circle cx="65" cy="65" r={r} fill="none" stroke={C.line} strokeWidth="10"/>
      {pct!=null&&<circle cx="65" cy="65" r={r} fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} style={{transition:'stroke-dashoffset 1s cubic-bezier(.34,1.1,.64,1)'}}/>}
    </svg>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{fontSize:`${size*0.27}px`,fontWeight:800,color:pct!=null?col:C.mid,fontFamily:C.P,lineHeight:1}}>{pct!=null?pct:'—'}{pct!=null&&<span style={{fontSize:`${size*0.12}px`,fontWeight:700}}>%</span>}</div>
      <div style={{fontSize:'11px',fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',marginTop:2}}>match</div>
    </div>
  </div>;
}

/* TasteMatch's reasons: one line each, with a dot for whether it counts for or against. */
function MatchReasons({match,col,showSummary=true}){
  if(!match) return null;
  return <div style={{display:'flex',flexDirection:'column',gap:8}}>
    {showSummary&&<div style={{fontSize:15,color:col||C.ink2,fontFamily:C.P,lineHeight:1.55}}>{match.summary}</div>}
    {match.reasons.map((r,i)=>(
      <div key={i} style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:15,lineHeight:1.5}}>
        <span style={{height:'1.5em',display:'flex',alignItems:'center',flexShrink:0}}><span style={{width:8,height:8,borderRadius:4,background:_TONE_COL[r.tone]}}/></span>
        <span style={{color:C.ink2,fontFamily:C.P}}>{r.text}</span>
      </div>
    ))}
  </div>;
}

/* ── the screen ── */
function useDeckStyle(){
  const [s,setS]=React.useState(()=>localStorage.getItem('vinterest_scancard_style')||'deck');
  React.useEffect(()=>{
    const h=()=>setS(localStorage.getItem('vinterest_scancard_style')||'deck');
    window.addEventListener('vinterest:scancardstyle',h);
    return()=>window.removeEventListener('vinterest:scancardstyle',h);
  },[]);
  return s;
}
/* After a scan: an "Is this it?" check when the label was hard to read, then the result (match,
   reasons, then three equal next steps: Learn about it / Rate it / Save for later, then style and price). The card deck is the
   optional deep dive, one tap away. */
function ScanCardsScreen({nav,back,showPro}){
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }catch(e){ return {}; }
  },[]);
  const source=scanData.source||'camera';
  const [wine,setWine]=React.useState(()=>ScanFlow.resolve(scanData.wine||null).wine);
  const [ratingsVersion,setRatingsVersion]=React.useState(0);
  const saved=React.useMemo(()=>wine?WineHistory.find(wine):null,[wine,ratingsVersion]);
  const existingRating=(saved&&saved.rating)||0;
  const confirmKey='vinterest_scan_confirmed_'+((scanData.wine&&scanData.wine.name)||'').replace(/\s/g,'_');
  const [confirmed,setConfirmed]=React.useState(()=>!!saved||!ScanFlow.needsConfirm(scanData.wine,source)||!!sessionStorage.getItem(confirmKey));
  const [editing,setEditing]=React.useState(false);
  // Every scan opens on the result; the deck is one tap away ("Learn about it").
  const [view,setView]=React.useState(()=>scanData.view||'result');
  const deckStyle=useDeckStyle();
  const curr=React.useMemo(()=>Regional.current(),[]);
  const match=React.useMemo(()=>wine?TasteMatch.assess(wine,WineHistory.getAll()):null,[wine,ratingsVersion]);
  const {gen,loading}=useScanContent(confirmed?wine:null,match);

  // Save the scan once we know which wine it is. A wine picked from a list is a shelf check.
  const trackedRef=React.useRef(false);
  React.useEffect(()=>{
    // Opened from history (a Home reminder): it's already saved, and reopening isn't a rescan.
    if(!wine||!confirmed||trackedRef.current||source==='history'||source==='suggestion'||scanData.tracked) return;
    trackedRef.current=true;
    // Coming back to this screen (from Details, say) isn't another scan.
    try{ const sd=JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); sd.tracked=true; sessionStorage.setItem('vinterest_scan_result',JSON.stringify(sd)); }catch(e){}
    const isNew=!WineHistory.find(wine);
    WineHistory.track(wine);
    if(isNew&&source==='list') WineHistory.setScanIntent(wine.name,wine.vintage,'checking');
    if(source==='camera'){ ScanFlow.awardScanXP(wine); ScanFlow.unlockLearning(wine); }
  },[wine,confirmed]);

  function applyEdit(patch){
    const before=wine, next={...wine,...patch,confidence:'high'};
    if(WineHistory.find(before)) WineHistory.update(WineHistory.find(before).name,WineHistory.find(before).vintage,patch);
    try{ const sd=JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); sd.wine=next; sessionStorage.setItem('vinterest_scan_result',JSON.stringify(sd)); }catch(e){}
    setWine(next); setEditing(false); confirm();
  }
  function confirm(){ try{ sessionStorage.setItem(confirmKey,'1'); }catch(e){} setConfirmed(true); }
  // A suggestion isn't saved until the user acts on it (save for later, rate, Blind Call).
  function setIntent(v){ if(!wine) return; if(!WineHistory.find(wine)) WineHistory.track(wine); const e=WineHistory.find(wine); WineHistory.setScanIntent(e.name,e.vintage,v); }

  if(!wine){
    const failed=scanData.reason&&scanData.reason!=='no_wine_label';
    return <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:32}}>
      <Icon n="camera" sz={40} col={C.mid}/>
      <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,textAlign:'center'}}>{scanData.reason==='no_wine_label'?'No label detected':failed?'The scan didn\'t go through':'Nothing scanned yet'}</div>
      <div style={{fontSize:15,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>{failed?'We couldn\'t reach the wine reader. Check your connection and try again.':'Point the camera straight at the front label and hold steady.'}</div>
      <Btn primary onClick={()=>nav('camera')}>Try again</Btn>
    </div>;
  }

  return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
    <ScanHeader wine={wine} nav={nav} back={view==='deck'&&confirmed?()=>setView('result'):back}/>
    {!confirmed
      ? <ConfirmGate wine={wine} onYes={confirm} onEdit={()=>setEditing(true)} nav={nav}
          onAlt={()=>applyEdit({name:wine.alternative,producer:''})}/>
      : view==='deck'
        ? <CardDeck key={deckStyle} deckStyle={deckStyle} wine={wine} gen={gen} loading={loading} match={match} showPro={showPro}
            curr={curr} scanData={scanData} existingRating={existingRating} nav={nav}
            onRated={()=>{ setIntent('tasted'); setRatingsVersion(v=>v+1); }}
            onSaveForLater={()=>{ setIntent('checking'); setView('saved'); }}
            onBlindCall={()=>setIntent('tasting')}/>
        : <ScanResult wine={wine} match={match} curr={curr} scanData={scanData} existingRating={existingRating} nav={nav} showPro={showPro}
            view={view} setView={setView} onEdit={()=>setEditing(true)}
            onRated={()=>{ setIntent('tasted'); setRatingsVersion(v=>v+1); }}
            onSaveForLater={()=>{ setIntent('checking'); setView('saved'); }}
            onDeck={()=>setView('deck')}/>}
    {editing&&<EditWineSheet wine={wine} onSave={applyEdit} onClose={()=>setEditing(false)}/>}
    <style>{`
      @keyframes scSpin{to{transform:rotate(360deg)}}
      @keyframes scSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes scFade{from{opacity:0}to{opacity:1}}
      @keyframes scPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
      .sc-scroll::-webkit-scrollbar{display:none}
      /* Every element in the swipe deck leaves horizontal drags to the deck (vertical scrolling
         still works); touch-action is decided where the finger lands, so the card alone isn't
         enough. Sliders keep their own drag. */
      .sc-swipe,.sc-swipe *{touch-action:pan-y}
      .sc-swipe input[type=range]{touch-action:none}
    `}</style>
  </div>;
}

function ScanHeader({wine,nav,back}){
  return <div style={{padding:'12px 16px 10px',flexShrink:0,display:'flex',alignItems:'center',gap:12,background:C.white,borderBottom:`1px solid ${C.line}`}}>
    <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
      <Icon n="back" sz={16} col={C.ink}/>
    </div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.15,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{wine.name}</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[wine.vintage&&wine.vintage!==0?wine.vintage:'NV',wine.region!==wine.country?wine.region:null,wine.country].filter(Boolean).join(' · ')}</div>
    </div>
    <div onClick={()=>nav('detail')} style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,padding:'7px 12px',borderRadius:20,background:C.offWhite,border:`1px solid ${C.line}`,cursor:'pointer',whiteSpace:'nowrap'}}>
      <span style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P}}>Details</span>
      <Icon n="chevron" sz={12} col={C.mid}/>
    </div>
  </div>;
}

/* Name, producer, vintage and place, as read from the label. */
function WineIdentity({wine}){
  const col=_typeCol(wine);
  return <div>
    <div style={{fontSize:13,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{[wine.type||'Red',wine.country].filter(Boolean).join(' · ')}</div>
    <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginTop:3}}>{_wineTitle(wine)}</div>
    <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{[wine.producer,WineDNA.grapeLine(wine),wine.region!==wine.country?wine.region:null].filter(Boolean).join(' · ')}</div>
  </div>;
}

/* ── "Is this it?" — only when Claude couldn't read the label clearly ── */
function ConfirmGate({wine,onYes,onAlt,onEdit,nav}){
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'22px 20px 28px',display:'flex',flexDirection:'column',gap:16,animation:'scFade .25s ease'}}>
    <div>
      <div style={{fontSize:13,fontWeight:700,color:C.amber,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:C.P}}>Check the label</div>
      <div style={{fontSize:23,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginTop:4}}>Is this the right wine?</div>
      <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginTop:6}}>We couldn't read all of the label, so we're not certain. A wrong wine would skew your WineDNA, so it's worth a second.</div>
    </div>
    <Card style={{padding:16}}><WineIdentity wine={wine}/></Card>
    <Btn primary full onClick={onYes}>Yes, that's it</Btn>
    {wine.alternative&&<Btn full onClick={onAlt}>It's {wine.alternative}</Btn>}
    <Btn full onClick={onEdit}>Edit the details</Btn>
    <div onClick={()=>nav('camera')} style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Scan again</div>
  </div>;
}

/* ── correct a misread label ── */
function EditWineSheet({wine,onSave,onClose}){
  const TYPES=['red','white','rosé','sparkling','orange','dessert','fortified'];
  const [f,setF]=React.useState(()=>({name:wine.name||'',producer:wine.producer||'',vintage:wine.vintage&&wine.vintage!==0?String(wine.vintage):'',
    type:(wine.type||'red').toLowerCase(),grapes:(wine.grapes||[]).join(', '),region:wine.region||'',country:wine.country||''}));
  const set=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  const input={width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:10,border:`1.5px solid ${C.line}`,fontSize:16,fontFamily:C.P,color:C.ink,background:C.white};
  const lab={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,marginBottom:4};
  function save(){
    const v=f.vintage.trim(), y=/^\d{4}$/.test(v)?Number(v):null;
    onSave({name:f.name.trim()||wine.name,producer:f.producer.trim(),vintage:y,type:f.type,
      grapes:f.grapes.split(',').map(g=>g.trim()).filter(Boolean),region:f.region.trim(),country:f.country.trim()});
  }
  return ReactDOM.createPortal(<div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9000,display:'flex',alignItems:'flex-end',justifyContent:'center'}}>
    <div onClick={e=>e.stopPropagation()} className="sc-scroll" style={{width:'100%',maxWidth:520,maxHeight:'88vh',overflowY:'auto',background:C.bg,borderRadius:'20px 20px 0 0',padding:'18px 20px 28px',animation:'scSheet .25s ease',display:'flex',flexDirection:'column',gap:12}}>
      <div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:C.P}}>Edit wine details</div>
      <div><div style={lab}>Wine name</div><input style={input} aria-label="Wine name" value={f.name} onChange={set('name')}/></div>
      <div><div style={lab}>Producer</div><input style={input} aria-label="Producer" value={f.producer} onChange={set('producer')}/></div>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1}}><div style={lab}>Vintage</div><input style={input} inputMode="numeric" placeholder="NV" aria-label="Vintage" value={f.vintage} onChange={set('vintage')}/></div>
        <div style={{flex:2}}><div style={lab}>Grapes</div><input style={input} placeholder="e.g. Grenache, Syrah" aria-label="Grapes" value={f.grapes} onChange={set('grapes')}/></div>
      </div>
      <div>
        <div style={lab}>Type</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
          {TYPES.map(t=><div key={t} onClick={()=>setF(x=>({...x,type:t}))} style={{padding:'7px 12px',borderRadius:20,border:`1.5px solid ${f.type===t?C.cr:C.line}`,background:f.type===t?C.cr:C.white,color:f.type===t?'#fff':C.ink2,fontSize:14,fontWeight:600,fontFamily:C.P,cursor:'pointer',textTransform:'capitalize'}}>{t}</div>)}
        </div>
      </div>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1}}><div style={lab}>Region</div><input style={input} aria-label="Region" value={f.region} onChange={set('region')}/></div>
        <div style={{flex:1}}><div style={lab}>Country</div><input style={input} aria-label="Country" value={f.country} onChange={set('country')}/></div>
      </div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>The style estimates (body, acidity and so on) stay as read from the label.</div>
      <Btn primary full onClick={save}>Save</Btn>
      <div onClick={onClose} style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Cancel</div>
    </div>
  </div>,document.body);
}

/* ── the result: everything needed to decide, on one screen ── */
function ScanResult({wine,match,curr,scanData,existingRating,nav,showPro,view,setView,onEdit,onRated,onSaveForLater,onDeck}){
  const col=_TONE_COL[match?match.tone:'neutral'];
  const [shop,setShop]=React.useState(()=>curr.isTravel?null:ScanFlow.shopPrice(wine,curr));
  const [shopFound,setShopFound]=React.useState(false); // from current shop listings, not an estimate
  React.useEffect(()=>{ let live=true; ScanFlow.shopEstimate(wine,curr).then(d=>{ if(live&&d){ setShop(d.mid); setShopFound(d.source==='search'); } }); return()=>{ live=false; }; },[wine&&wine.name,curr.code]);
  // A list read abroad is priced in its own currency: compare like with like.
  const lc=scanData.listCurrency;
  const list=scanData.listPrice?(lc&&lc!==curr.code?scanData.listPrice/(USD_FX[lc]||1)*(USD_FX[curr.code]||1):scanData.listPrice):null;
  const mk=ScanFlow.markup(list,shop);
  const sweet=match&&match.profile&&match.profile.value&&match.profile.value.sweetSpot;
  const sub={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'};
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'16px 16px 28px',display:'flex',flexDirection:'column',gap:12,animation:'scFade .25s ease'}}>
    <Card style={{padding:16}}>
      <WineIdentity wine={wine}/>
      <div style={{display:'flex',alignItems:'center',gap:10,marginTop:10,flexWrap:'wrap'}}>
        {existingRating>0&&<span style={{fontSize:13,fontWeight:700,color:C.green,background:C.greenBg,border:`1px solid ${C.green}30`,borderRadius:20,padding:'3px 10px',fontFamily:C.P}}>You scored it {existingRating} · {ParkerScale.label(existingRating)}</span>}
        <span onClick={onEdit} style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Not right? Edit</span>
      </div>
    </Card>

    <Card style={{padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <MatchRing match={match}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:match&&match.pct!=null?col:C.ink,fontFamily:C.P,lineHeight:1.2}}>{match?match.label:'—'}</div>
          {match&&match.expected!=null
            ?<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3}}>{existingRating>0?`We predicted ${match.expectedLabel} · you scored ${existingRating}`:`Likely ${match.expectedLabel} for you`}</div>
            :<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{match&&match.summary}</div>}
          {match&&match.confidence==='low'&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>Rough guess</div>}
        </div>
      </div>
      {match&&(match.reasons.length>0||match.expected!=null)&&<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.line}`}}>
        <MatchReasons match={match} showSummary={match.expected!=null}/>
      </div>}
    </Card>

    {view==='rate'
      ? <Card style={{padding:16}}><RatingPanel wine={wine} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr} onRated={onRated} onSaveForLater={existingRating?null:onSaveForLater}/></Card>
      : view==='saved'
        ? <><Card style={{padding:16,display:'flex',flexDirection:'column',gap:10,alignItems:'center',textAlign:'center'}}>
            <div style={{width:48,height:48,borderRadius:24,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="check" sz={22} col={C.cr}/></div>
            <div style={{fontSize:18,fontWeight:800,color:C.ink,fontFamily:C.P}}>Saved for later</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>It won't count towards your WineDNA until you buy or taste it. Next time you open the app we'll ask whether you bought it.</div>
          </Card>
          <Card style={{padding:16}}><KeepLearning wine={wine} nav={nav} showPro={showPro} intro="Shopping? Learn a little about it before you decide."/></Card>
          <div style={{display:'flex',gap:10}}>
            <Btn full onClick={()=>nav('mywines')}>My Wines</Btn>
            <Btn primary full onClick={()=>nav('camera')}>Scan another</Btn>
          </div></>
        : <div>
            {/* Three next steps as full-width rows, straight under the match: learning about the
                wine is as easy to reach as rating or saving it. */}
            <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,margin:'2px 2px 8px'}}>What next?</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {key:'learn',icon:'book',label:'Learn about it',sub:'Story, taste, region and grape',on:onDeck},
                {key:'rate',icon:'star',label:existingRating?`Re-rate it (${existingRating})`:'Rate it',sub:existingRating?'Changed your mind?':'Score it to sharpen your WineDNA',on:()=>setView('rate')},
                ...(existingRating?[]:[{key:'save',icon:'bookmark',label:'Save for later',sub:'Shopping, or not tasted yet',on:onSaveForLater}]),
              ].map(x=>(
                <div key={x.key} role="button" onClick={x.on} style={{background:C.white,border:`1.5px solid ${C.crDim}`,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
                  <div style={{width:38,height:38,borderRadius:19,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={x.icon} sz={18} col={C.cr}/></div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.25}}>{x.label}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.35}}>{x.sub}</div>
                  </div>
                  <Icon n="chevron" sz={14} col={C.mid}/>
                </div>
              ))}
            </div>
          </div>}

    {(match&&match.style||shop||list)&&<Card style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
      {match&&match.style&&<div>
        <div style={{...sub,marginBottom:4}}>Style</div>
        <div style={{fontSize:15,color:C.ink,fontFamily:C.P,lineHeight:1.5}}>{match.style}</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>Estimated from the label: what this wine is typically like.</div>
      </div>}
      {(shop||list)&&<div style={{paddingTop:match&&match.style?10:0,borderTop:match&&match.style?`1px solid ${C.line}`:'none'}}>
        <div style={{...sub,marginBottom:6}}>Price</div>
        {shop&&<div style={{display:'flex',alignItems:'baseline',gap:8}}>
          <span style={{fontSize:15,color:C.ink,fontFamily:C.P,flex:1}}>{curr.isTravel?`In shops in ${curr.label}`:'In shops'}</span>
          <span style={{fontSize:15,fontWeight:800,color:C.ink,fontFamily:C.P}}>about {ScanFlow.money(shop,curr)}</span>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{shopFound?'in shops now':'est.'}</span>
        </div>}
        {list&&<div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:4}}>
          <span style={{fontSize:15,color:C.ink,fontFamily:C.P,flex:1}}>On this list</span>
          <span style={{fontSize:15,fontWeight:800,color:C.ink,fontFamily:C.P}}>{ScanFlow.money(list,curr)}</span>
          {mk&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{mk.ratio.toFixed(1)}× shop</span>}
        </div>}
        {mk&&<div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:4}}>{mk.text}</div>}
        {sweet&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:6}}>Your Outstanding {match.profile.label.toLowerCase()} usually cost {sweet}.</div>}
        {/* Until WineDNA has a sweet spot from their own scores, compare with the spend they gave. */}
        {!sweet&&shop&&(()=>{ const fit=UserPrefs.spendFit(shop,curr), b=UserPrefs.budget(curr); if(!fit) return null;
          return <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:6}}>{fit==='within'?`Within your usual spend (${b.label}).`:fit==='above'?`Above your usual spend (${b.label}).`:`Below your usual spend (${b.label}).`}</div>; })()}
      </div>}
    </Card>}

  </div>;
}

/* ── card content model ── */
function buildCards({match}){
  const tone=match?match.tone:'neutral';
  return [
    {key:'match',accent:C.green,soft:C.greenBg,icon:'compass',eyebrow:'Your match',kind:'match'},
    {key:'fit',accent:tone==='bad'?C.amber:C.green,soft:tone==='bad'?C.amberBg:C.greenBg,icon:'heart',eyebrow:tone==='good'?'Why you\'ll like it':tone==='bad'?'How it\'s different':'Why it could click',kind:'gen',field:'fit'},
    {key:'caution',accent:C.amber,soft:C.amberBg,icon:'message',eyebrow:'Heads up',kind:'gen',field:'caution'},
    {key:'origin',accent:C.cr,soft:C.crSoft,icon:'globe',eyebrow:'Where it\'s from',kind:'origin'},
    {key:'fact',accent:'#9B6B00',soft:'#FBF3E0',icon:'star',eyebrow:'Did you know',kind:'gen',field:'fact'},
    {key:'taste',accent:C.ink,soft:C.offWhite,icon:'wine',eyebrow:'While you taste',kind:'taste'},
    {key:'talk',accent:C.cr,soft:C.crSoft,icon:'message',eyebrow:'Sound clued-in',kind:'talk'},
    {key:'value',accent:'#6B2D8B',soft:'#F3ECF8',icon:'cart',eyebrow:'Price check',kind:'value'},
    {key:'finish',accent:C.cr,soft:C.crSoft,icon:'star',eyebrow:'Rate it',kind:'finish'},
  ];
}

/* renders the body of one card — always at full detail; there is no separate expand/collapse mode, everything ships on the main screen. */
function CardFace({card,ctx}){
  const expanded=true;
  const {wine,gen,loading,match,curr,scanData}=ctx;
  const a=card.accent;
  const P=C.P;
  const H=({children})=><div style={{fontSize:expanded?24:20,fontWeight:800,color:C.ink,fontFamily:P,lineHeight:1.2,letterSpacing:'-0.01em'}}>{children}</div>;
  const Body=({children,big})=><div style={{fontSize:big?(expanded?20:18):(expanded?17:16),color:C.ink2,fontFamily:P,lineHeight:1.55}}>{children}</div>;

  if(card.kind==='match'){
    const col=_TONE_COL[match?match.tone:'neutral'];
    return <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,textAlign:'center'}}>
      <MatchRing match={match} size={150}/>
      <H>{match?match.label:'—'}</H>
      {match&&match.expected!=null&&<div style={{fontSize:16,color:C.mid,fontFamily:P,marginTop:-6}}>Likely {match.expectedLabel} for you</div>}
      <div style={{width:'100%',textAlign:'left',padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>How we got this</div>
        <MatchReasons match={match} col={C.ink2}/>
      </div>
    </div>;
  }

  if(card.kind==='gen'){
    const val=gen&&gen[card.field];
    return <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <H>{card.field==='fact'?'A little story':card.field==='fit'?(match&&match.tone==='good'?'Your kind of bottle':match&&match.tone==='bad'?'Not your usual style':'What might win you over'):'One thing to know'}</H>
      <Body big>{loading&&!val?<ScanShimmer col={a}/>:(val||'—')}</Body>
      {expanded&&card.field==='fit'&&match&&match.reasons.length>0&&<div style={{padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}><MatchReasons match={match} showSummary={false}/></div>}
      {expanded&&card.field==='caution'&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.55}}>{match&&match.tone==='good'?'Just a tip to get the most out of it, not a reason to hesitate.':'Worth knowing so nothing catches you off guard.'}</div>}
    </div>;
  }

  if(card.kind==='origin'){
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>{wine.region||wine.country}</H>
      <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
        {[wine.sub_region,wine.region,wine.country].filter(Boolean).filter((v,i,arr)=>arr.indexOf(v)===i).map((t,i)=>(
          <span key={i} style={{padding:'5px 12px',borderRadius:20,background:card.soft,color:a,fontSize:14,fontWeight:600,fontFamily:C.P,border:`1px solid ${a}22`}}>{t}</span>
        ))}
      </div>
      <Body big>{loading&&!(gen&&gen.origin)?<ScanShimmer col={a}/>:((gen&&gen.origin)||`${wine.region?wine.region+', ':''}${wine.country} — a classic home for ${(wine.grapes&&wine.grapes[0])||'this style'}.`)}</Body>
      <div style={{padding:'12px 14px',borderRadius:12,background:card.soft,border:`1px solid ${a}22`,display:'flex',flexDirection:'column',gap:10}}>
        <div>
          <div style={{fontSize:12,fontWeight:700,color:a,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:3}}>The regional signature</div>
          <div style={{fontSize:15.5,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>{(gen&&gen.region_style)||`Wines from ${wine.region||wine.country} are prized for their sense of place.`}</div>
        </div>
        <div style={{borderTop:`1px solid ${a}22`,paddingTop:10}}>
          <div style={{fontSize:12,fontWeight:700,color:a,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:3}}>{wine.producer||'The winemaker'}</div>
          <div style={{fontSize:15.5,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>{loading&&!(gen&&gen.estate)?<ScanShimmer col={a}/>:((gen&&gen.estate)||`A producer working in the traditional style of ${wine.region||wine.country}.`)}</div>
        </div>
      </div>
    </div>;
  }

  if(card.kind==='taste') return <TasteCard wine={wine} gen={gen} accent={a} onBlindCall={ctx.onBlindCall}/>;

  if(card.kind==='talk'){
    const lines=(gen&&Array.isArray(gen.talk)&&gen.talk.length)?gen.talk:[
      `A ${wine.type||'red'} that really speaks of ${wine.region||wine.country}.`,
      (wine.grapes&&wine.grapes[0])?((wine.blend||wine.grapes.length>1)?`A lovely ${wine.grapes[0]}-led blend.`:`Lovely example of ${wine.grapes[0]}.`):'Nicely made, plenty of character.',
      'Great with the right plate of food.'];
    return <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <H>Say it out loud</H>
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {lines.slice(0,3).map((l,i)=>(
          <div key={i} style={{display:'flex',gap:10,padding:'11px 13px',borderRadius:13,background:card.soft,border:`1px solid ${a}22`}}>
            <span style={{fontSize:22,color:a,fontFamily:'Georgia,serif',lineHeight:1,marginTop:-2}}>“</span>
            <span style={{fontSize:15.5,color:C.ink,fontFamily:C.P,lineHeight:1.5,fontWeight:500}}>{loading&&!(gen&&gen.talk)?'…':l}</span>
          </div>
        ))}
      </div>
      {gen&&gen.fact2&&<div style={{padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
        <div style={{fontSize:13,fontWeight:700,color:a,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:5}}>Drop this fact</div>
        <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{gen.fact2}</div>
      </div>}
    </div>;
  }

  if(card.kind==='value') return <ValueFace wine={wine} curr={curr} scanData={scanData} accent={a} soft={card.soft} expanded={expanded}/>;
  if(card.kind==='finish') return null; // rendered specially by deck (needs actions)
  return null;
}

/* ── static taste cues (checking / tasted / post-Blind-Call summary) ── */
function TasteCues({wine,accent}){
  const a=accent||C.ink;
  const cues=[];
  const type=(wine.type||'red').toLowerCase().replace('é','e');
  const showTannins=['red','orange','fortified'].includes(type);
  const isDessertOrFortified=['dessert','fortified'].includes(type);
  const b=wine.body??0.65,tn=wine.tannins??0.55,ac=wine.acidity??0.6,tx=wine.texture,sw=wine.sweetness??0.1;
  cues.push({l:'Body',v:lvl(b,'Light & lithe','Medium-weight','Full & mouth-coating'),tip:'Notice how heavy it feels — does it linger or refresh?'});
  if(showTannins) cues.push({l:'Tannins',v:lvl(tn,'Silky, low grip','Gentle grip','Firm, drying grip'),tip:'That drying feel on your gums and cheeks — is it soft or grippy?'});
  cues.push({l:'Acidity',v:lvl(ac,'Round & mellow','Fresh','Zippy & mouth-watering'),tip:'Does it make you salivate? That\'s acidity.'});
  if(tx!=null) cues.push({l:'Oak / texture',v:lvl(tx,'Clean & steely','Subtle','Creamy, vanilla, toast'),tip:'Any butter, vanilla or toast? That\'s oak.'});
  if(sw>=0.2||isDessertOrFortified) cues.push({l:'Sweetness',v:lvl(sw,'Dry','Off-dry','Noticeably sweet'),tip:'Sense of sugar on the tip of your tongue.'});
  if(isDessertOrFortified) cues.push({l:'Serving size',v:'A smaller 2–3oz pour',tip:'These are richer and higher in alcohol — a small glass goes further.'});
  const notes=(wine.tasting_notes||[]).slice(0,4);
  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,letterSpacing:'-0.01em'}}>What to look for</div>
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {cues.slice(0,isDessertOrFortified?5:4).map((c,i)=>(
        <div key={i} style={{display:'flex',gap:10,alignItems:'baseline'}}>
          <span style={{fontSize:15,fontWeight:700,color:a,fontFamily:C.P,minWidth:92,flexShrink:0}}>{c.l}</span>
          <div style={{flex:1}}>
            <div style={{fontSize:17,color:C.ink,fontFamily:C.P,fontWeight:600}}>{c.v}</div>
          </div>
        </div>
      ))}
    </div>
    {notes.length>0&&<div>
      <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:7,marginTop:2}}>Hunt for these flavours</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
        {notes.map((n,i)=>(<span key={i} style={{padding:'5px 11px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${C.line}`}}>{n}</span>))}
      </div>
    </div>}
  </div>;
}

/* ── Blind Call ── */
const DIM_LABEL={body:'Body',acidity:'Acidity',tannins:'Tannins',texture:'Texture'};
const DIM_LO={body:'Light',acidity:'Mellow',tannins:'Silky',texture:'Crisp & steely'};
const DIM_HI={body:'Full',acidity:'Zingy',tannins:'Grippy',texture:'Rich & creamy'};
const DIM_CONCEPT={tannins:'tannin_source',acidity:'acidity_and_food',texture:'oak_influence'};
function dimsFor(wine){
  const type=(wine.type||'red').toLowerCase().replace('é','e');
  const showTannins=['red','orange','fortified'].includes(type);
  return showTannins?['body','acidity','tannins']:['body','acidity','texture'];
}
function _bcKey(wine){ return (wine.name||'')+'_'+(wine.vintage||'nv'); }

function BlindCallCard({wine,gen,accent,onStart}){
  const wineKey=_bcKey(wine).replace(/\s/g,'_');
  const doneKey='vinterest_blindcall_'+wineKey;
  const savedKey='vinterest_blindcall_result_'+wineKey;
  const [phase,setPhase]=React.useState(()=>localStorage.getItem(doneKey)?'summary':'predict');
  const [guess,setGuess]=React.useState(null);
  const [score,setScore]=React.useState(()=>{ try{ return JSON.parse(localStorage.getItem(savedKey)||'null'); }catch(e){ return null; } });
  const dims=React.useMemo(()=>dimsFor(wine),[wine&&wine.name]);

  function finalizeReveal(g,missed,accuracy){
    if(!localStorage.getItem(doneKey)){
      localStorage.setItem(doneKey,'1');
      // Misjudging one wine's tannin/acidity/texture flags the concept for review; it isn't a
      // wrong answer to a Concept Check question, so it doesn't cost mastery progress.
      missed.forEach(d=>{ const cid=DIM_CONCEPT[d]; if(cid) MasterySystem.flagForReview(cid); });
      const awards=XPSystem.awardAndToast([{type:'blind_call',accuracy}]);
      const amount=awards.filter(x=>!x.levelUp).reduce((s,x)=>s+x.amount,0);
      // The guess is kept: it's the user's own read of the wine, used to pre-fill the rating step.
      localStorage.setItem(savedKey,JSON.stringify({accuracy,amount,guess:g}));
      setScore({accuracy,amount});
    }
    setPhase('result');
  }

  if(phase==='predict') return <BlindCallPredict dims={dims} col={_typeCol(wine)} onSubmit={g=>{setGuess(g);setPhase('reveal');if(onStart) onStart();}}/>;
  if(phase==='reveal') return <BlindCallReveal wine={wine} dims={dims} guess={guess} col={_typeCol(wine)} onDone={finalizeReveal}/>;
  if(phase==='result') return <>
    {ReactDOM.createPortal(<BlindCallResult score={score} onClose={()=>setPhase('summary')}/>, document.body)}
    <div style={{minHeight:120}}/>
  </>;
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <div style={{padding:'12px 14px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}30`,display:'flex',alignItems:'center',gap:10}}>
      <Icon n="check" sz={18} col={C.green}/>
      <span style={{fontSize:14.5,fontWeight:600,color:C.green,fontFamily:C.P}}>You called it {score?Math.round(score.accuracy*100):'—'}% accurate{score?` · +${score.amount} XP`:''}</span>
    </div>
    <TasteCues wine={wine} accent={accent}/>
  </div>;
}

function BlindCallPredict({dims,col,onSubmit}){
  const [vals,setVals]=React.useState(()=>Object.fromEntries(dims.map(d=>[d,0.5])));
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,letterSpacing:'-0.01em'}}>Call it before you look</div>
    <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Drag each slider to where you think this wine lands — no penalty for missing.</div>
    <div style={{display:'flex',flexDirection:'column',gap:20,marginTop:4}}>
      {dims.map(d=>(
        <div key={d}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12.5,color:C.mid,fontFamily:C.P,marginBottom:6,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.04em'}}>
            <span>{DIM_LO[d]}</span><span style={{color:C.ink,fontWeight:700}}>{DIM_LABEL[d]}</span><span>{DIM_HI[d]}</span>
          </div>
          <input type="range" min="0" max="100" value={Math.round(vals[d]*100)} style={{width:'100%',accentColor:col||C.cr,cursor:'pointer',display:'block',touchAction:'pan-y'}}
            onChange={e=>setVals(v=>({...v,[d]:Number(e.target.value)/100}))}/>
        </div>
      ))}
    </div>
    <Btn primary full onClick={()=>onSubmit(vals)}>Lock in my call</Btn>
  </div>;
}

function BlindCallReveal({wine,dims,guess,col,onDone}){
  const deltas=dims.map(d=>Math.abs(guess[d]-(wine[d]??0.5)));
  const avgDelta=deltas.reduce((s,x)=>s+x,0)/deltas.length;
  const accuracy=Math.max(0,1-avgDelta*1.6);
  const missed=dims.filter((d,i)=>deltas[i]>0.22);
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,letterSpacing:'-0.01em'}}>How you called it</div>
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {dims.map(d=>{
        const g=guess[d],act=wine[d]??0.5;
        return <div key={d}>
          <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>{DIM_LABEL[d]}</div>
          <div style={{position:'relative',height:8,borderRadius:4,background:C.line}}>
            <div style={{position:'absolute',left:`${act*100}%`,top:-4,width:16,height:16,borderRadius:8,background:C.green,border:'2px solid #fff',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',transform:'translateX(-50%)'}}/>
            <div style={{position:'absolute',left:`${g*100}%`,top:-4,width:16,height:16,borderRadius:8,background:col||C.cr,border:'2px solid #fff',boxShadow:'0 1px 4px rgba(0,0,0,0.3)',transform:'translateX(-50%)',opacity:0.85}}/>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:C.mid,fontFamily:C.P,marginTop:6}}>
            <span style={{color:col||C.cr,fontWeight:600}}>● your call</span>
            <span style={{color:C.green,fontWeight:600}}>● actual</span>
          </div>
        </div>;
      })}
    </div>
    {missed.length>0&&<div style={{padding:'12px 14px',borderRadius:12,background:C.amberBg,border:`1px solid ${C.amber}30`}}>
      <div style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:C.P,marginBottom:3}}>Worth a closer look: {missed.map(d=>DIM_LABEL[d]).join(', ')}</div>
      <div style={{fontSize:13.5,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>No cost to missing — we'll queue a short read on this for your shelf.</div>
    </div>}
    <Btn primary full onClick={()=>onDone(guess,missed,accuracy)}>See my score</Btn>
  </div>;
}

function BlindCallResult({score,onClose}){
  const amount=score?score.amount:0;
  const accuracy=score?score.accuracy:0;
  const [shown,setShown]=React.useState(0);
  React.useEffect(()=>{
    const start=performance.now();
    function tick(t){
      const p=Math.min(1,(t-start)/900);
      setShown(Math.round(p*amount));
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  },[amount]);
  const label=accuracy>=0.85?'Uncanny':accuracy>=0.65?'Sharp call':accuracy>=0.4?'Decent read':'A learning moment';
  return <div style={{position:'fixed',inset:0,background:C.ink,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,zIndex:9999}}>
    <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Blind Call</div>
    <div style={{fontSize:38,fontWeight:800,fontFamily:C.P,color:'#D4AF6A',lineHeight:1}}>{label}</div>
    <div style={{fontSize:16,color:'rgba(255,255,255,0.55)',fontFamily:C.P,marginTop:2}}>{Math.round(accuracy*100)}% accurate</div>
    <div style={{fontSize:48,fontWeight:800,fontFamily:C.P,color:'#D4AF6A',marginTop:18,fontVariantNumeric:'tabular-nums'}}>+{shown} XP</div>
    <div style={{marginTop:32}}><Btn primary onClick={onClose}>Continue</Btn></div>
  </div>;
}

function ValueFace({wine,curr,scanData,accent,soft,expanded}){
  // The label's estimate shows straight away; the shop price replaces it when it arrives.
  const [pd,setPd]=React.useState(()=>{ const l=ScanFlow.shopPrice(wine,curr); return l!=null?{mid:l,source:'label'}:null; });
  const [loading,setLoading]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!wine.name) return;
    setLoading(true);
    ScanFlow.shopEstimate(wine,curr).then(d=>{ if(d) setPd(d); }).finally(()=>setLoading(false));
  },[wine&&wine.name,curr.code]);
  const fmt=n=>n!=null?curr.base+Number(n).toLocaleString():'—';
  // Present when opened from a wine list; converted when the list is in another currency.
  const lc=scanData.listCurrency, rawList=scanData.listPrice||scanData.restaurantPrice||null;
  const restaurant=rawList&&lc&&lc!==curr.code?Math.round(rawList/(USD_FX[lc]||1)*(USD_FX[curr.code]||1)):rawList;
  const mid=pd&&pd.mid;
  const estListLo=mid!=null?Math.round(mid*2.2):null;
  const estListHi=mid!=null?Math.round(mid*2.8):null;
  const ratio=(restaurant&&mid)?(restaurant/mid):null;
  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{restaurant?'Retail vs. restaurant':'What it\'s worth'}</div>
    {loading&&!pd?<ScanShimmer col={accent}/>:pd&&mid!=null?<>
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1,padding:'13px 14px',borderRadius:14,background:soft,border:`1px solid ${accent}22`}}>
          <div style={{fontSize:12.5,fontWeight:600,color:accent,fontFamily:C.P,marginBottom:3}}>Typical retail</div>
          <div style={{fontSize:24,fontWeight:800,color:accent,fontFamily:C.P,lineHeight:1}}>{fmt(mid)}</div>
          <div style={{fontSize:11,fontWeight:700,color:accent+'99',fontFamily:C.P,marginTop:3}}>{curr.code} · shop shelf</div>
        </div>
        <div style={{flex:1,padding:'13px 14px',borderRadius:14,background:C.white,border:`1px solid ${C.line}`}}>
          <div style={{fontSize:12.5,fontWeight:600,color:C.mid,fontFamily:C.P,marginBottom:3}}>{restaurant?'On this list':'On a wine list'}</div>
          <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1}}>{restaurant?fmt(restaurant):`${fmt(estListLo)}–${fmt(estListHi)}`}</div>
          <div style={{fontSize:11,fontWeight:700,color:C.mid,fontFamily:C.P,marginTop:3}}>{restaurant?`${curr.code} · restaurant`:'typical markup'}</div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:12,background:C.ink,color:'#fff'}}>
        <div style={{fontSize:22,fontWeight:800,fontFamily:C.P,lineHeight:1}}>{ratio?ratio.toFixed(1)+'×':'~2.5×'}</div>
        <div style={{fontSize:13.5,fontFamily:C.P,lineHeight:1.4,opacity:.92}}>{ratio?(ratio>=3?'A steep markup versus the shelf price.':ratio>=2?'A fair, typical restaurant markup.':'A gentle markup — good value on a list.'):'Restaurants usually charge two to three times retail.'}</div>
      </div>
      {loading&&pd.source==='label'&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Checking current shop prices…</div>}
      {pd.tier&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Price tier</span>
        <span style={{fontSize:14,fontWeight:700,color:accent,fontFamily:C.P,textTransform:'capitalize'}}>{String(pd.tier).replace('-',' ')}</span>
      </div>}
      {expanded&&pd.note&&<div style={{fontSize:14.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55,padding:'11px 13px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>{pd.note}</div>}
    </>:<div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Price estimate unavailable for this bottle.</div>}
  </div>;
}

/* ── rating: the score, then optional tasting details that sharpen future matches ── */
function RatingPanel({wine,existingRating,nav,showPro,curr,onRated,onSaveForLater,onStage}){
  const [score,setScore]=React.useState(existingRating||0);
  const [saved,setSaved]=React.useState(false);
  const [next,setNext]=React.useState(false);
  // Tells the deck which step it's on, so the card's label follows (Rate it → Your score → Keep learning).
  React.useEffect(()=>{ if(onStage) onStage(next?'next':saved?'saved':'rate'); },[saved,next]);
  const label=ParkerScale.label(score);
  const tc=_typeCol(wine);
  function commit(){
    if(!score||!wine) return;
    if(existingRating>0){ const e=WineHistory.find(wine); WineHistory.rate(e?e.name:wine.name,e?e.vintage:wine.vintage,score); }
    else WineHistory.add(wine,score);
    try{ if(window.XPSystem&&!existingRating) XPSystem.awardAndToast([{type:'rate'}]); }catch(e){}
    try{
      const sd=JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}');
      sd.existingRating=score;
      sessionStorage.setItem('vinterest_scan_result',JSON.stringify(sd));
    }catch(e){}
    setSaved(true);
    if(onRated) onRated(score);
  }
  // After the score and the optional details: what to learn next, then the ways out.
  if(saved&&next) return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <KeepLearning wine={wine} nav={nav} showPro={showPro}/>
    <div style={{marginTop:6,paddingTop:16,borderTop:`2px solid ${C.line}`,display:'flex',flexDirection:'column',gap:10}}>
      <Btn primary full onClick={()=>nav('home')}>Finish</Btn>
      <Btn full onClick={()=>nav('detail')}>See full wine details</Btn>
      <div onClick={()=>nav('camera')} style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer',padding:'2px 0'}}>Scan another bottle</div>
    </div>
  </div>;
  if(saved) return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <div style={{width:36,height:36,borderRadius:18,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="check" sz={18} col={C.green}/></div>
      <div>
        <div style={{fontSize:17,fontWeight:800,color:C.ink,fontFamily:C.P}}>Scored {score} · {label}</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Saved to My Wines</div>
      </div>
    </div>
    <TastingExtras wine={wine} curr={curr}/>
    {/* Set apart from the optional details above so it doesn't read as one of them. */}
    <div style={{marginTop:10,paddingTop:16,borderTop:`2px solid ${C.line}`}}>
      <Btn primary full onClick={()=>setNext(true)}>Done: what's next?</Btn>
    </div>
  </div>;
  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,textAlign:'center'}}>How was it?</div>
    <div style={{display:'flex',gap:6}}>
      {ParkerScale.PRESETS.map(p=>(
        <div key={p} onClick={()=>setScore(p)} style={{flex:1,padding:'9px 2px',borderRadius:11,border:`1.5px solid ${score===p?tc:C.line}`,background:score===p?tc:C.white,textAlign:'center',cursor:'pointer',transition:'all .12s'}}>
          <span style={{fontSize:17,fontWeight:700,color:score===p?'#fff':C.mid,fontFamily:C.P}}>{p}</span>
        </div>
      ))}
    </div>
    <input type="range" min={ParkerScale.MIN} max="100" step="1" value={Math.max(score,ParkerScale.MIN)} onChange={e=>setScore(Number(e.target.value))} style={{width:'100%',accentColor:tc,cursor:'pointer'}}/>
    <div style={{textAlign:'center',minHeight:40}}>
      {score>0?<div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:3}}><span style={{fontSize:34,fontWeight:800,color:tc,fontFamily:C.P,lineHeight:1}}>{score}</span><span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>pts</span></div>
        <span style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P}}>{label}</span>
      </div>:<span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Slide or tap a score</span>}
    </div>
    <div style={{fontSize:12,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5,opacity:0.8}}>100-point scale: 96+ Extraordinary · 90–95 Outstanding · 80–89 Very good · 70–79 Average · under 70 Below average</div>
    {score>0&&<Btn primary full onClick={commit}>Save rating</Btn>}
    {onSaveForLater&&<div onClick={onSaveForLater} style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Not tasted it yet? Save for later</div>}
  </div>;
}

/* What each trait means, what the label suggested, and how to notice it on the next sip: the
   comparison teaches the word as well as asking for it. */
const _NOTICE={
  body:{what:'How heavy the wine feels in your mouth.',how:'Think skimmed milk (light) against whole milk (full).',word:{low:'light',mid:'medium-bodied',high:'full-bodied'}},
  tannins:{what:'The drying, grippy feel on your gums and teeth, from grape skins and oak.',how:'Like a sip of strong black tea.',word:{low:'silky',mid:'gently grippy',high:'firm and grippy'}},
  acidity:{what:'The freshness that makes your mouth water.',how:'Notice how much your mouth waters after you swallow.',word:{low:'soft',mid:'fresh',high:'zingy'}},
  texture:{what:'How smooth or rich a white feels.',how:'Crisp like a green apple, or round and creamy like butter.',word:{low:'crisp',mid:'smooth',high:'rich and creamy'}},
};

/* Optional, after a score. Each answer is used (inputs we ask for must teach, personalise or
   guide): "buy again" feeds the Buy again list, WineDNA's "Worth buying again", the sommelier
   script and matching; what they paid feeds Value and their budget; what they noticed adjusts the
   label estimate (WineDNA.axisValue) for WineDNA and every match. Each tap saves straight away;
   a Blind Call on this bottle pre-fills the comparison. Beginners see the comparison folded away. */
function TastingExtras({wine,curr}){
  const entry=WineHistory.find(wine)||wine;
  const axes=ScanFlow.compareAxes(entry);
  const [tasted,setTasted]=React.useState(()=>entry.tasted||ScanFlow.tastedFromBlindCall(entry)||{});
  const [paid,setPaid]=React.useState(()=>entry.price_paid&&entry.price_paid.amount?String(entry.price_paid.amount):'');
  const [again,setAgain]=React.useState(entry.buy_again===true);
  const [showNotice,setShowNotice]=React.useState(()=>UserPrefs.experience()!=='novice'||!!entry.tasted);
  const save=patch=>{ const e=WineHistory.find(wine); if(e) WineHistory.setTasting(e.name,e.vintage,patch); };
  React.useEffect(()=>{ if(!entry.tasted&&Object.keys(tasted).length) save({tasted}); },[]);
  const tc=_typeCol(entry);
  const seg=(active)=>({flex:1,padding:'8px 4px',borderRadius:10,border:`1.5px solid ${active?tc:C.line}`,background:active?tc:C.white,color:active?'#fff':C.ink2,fontSize:14,fontWeight:600,fontFamily:C.P,textAlign:'center',cursor:'pointer'});
  const lab={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,marginBottom:5};
  return <div style={{display:'flex',flexDirection:'column',gap:14,paddingTop:12,borderTop:`1px solid ${C.line}`}}>
    <div onClick={()=>{ const v=!again; setAgain(v); save({buy_again:v}); }} role="checkbox" aria-checked={again}
      style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,border:`1.5px solid ${again?C.green:C.line}`,background:again?C.greenBg:C.white,cursor:'pointer'}}>
      <div style={{width:34,height:34,borderRadius:17,background:again?C.green:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="cart" sz={18} col={again?'#fff':C.mid}/></div>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:700,color:again?C.green:C.ink,fontFamily:C.P}}>{again?'On your Buy again list':'I\'d buy this again'}</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>We'll keep it handy for your next shop and bring it into your sommelier script.</div>
      </div>
    </div>
    <div>
      <div style={lab}>What you paid (optional)</div>
      <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,border:`1.5px solid ${C.line}`,background:C.white}}>
        <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{curr.base}</span>
        <input inputMode="decimal" placeholder="0" value={paid} aria-label="What you paid"
          onChange={e=>setPaid(e.target.value.replace(/[^0-9.]/g,''))}
          onBlur={()=>{ const n=Number(paid); save({price_paid:n>0?{amount:n,code:curr.code}:null}); }}
          style={{flex:1,minWidth:0,border:'none',outline:'none',fontSize:16,fontFamily:C.P,color:C.ink,background:'transparent'}}/>
      </div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4}}>Sets your usual spend and shows which bottles are good value for you.</div>
    </div>
    {axes.length>0&&(!showNotice
      ?<div onClick={()=>setShowNotice(true)} role="button" style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Want to go further? Tell us what you noticed →</div>
      :<div style={{display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>What did you notice?</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Optional. Take another sip: here's what to feel for. Your answers adjust your WineDNA and future matches.</div>
        </div>
        {axes.map(k=>{
          const [lo,hi]=ScanFlow.COMPARE[k]||['Less','More'];
          const N=_NOTICE[k]||{}, expected=N.word&&N.word[WineDNA.level(entry[k])];
          const pick=v=>{ const next={...tasted,[k]:v}; setTasted(next); save({tasted:next}); };
          return <div key={k}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{WineDNA.AXES[k].name}</div>
            {N.what&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{N.what} {N.how}</div>}
            {expected&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:3}}>The label suggests {expected}. How did it feel to you?</div>}
            <div style={{display:'flex',gap:6,marginTop:7}}>
              <div onClick={()=>pick(-1)} style={seg(tasted[k]===-1)}>{lo}</div>
              <div onClick={()=>pick(0)} style={seg(tasted[k]===0)}>As expected</div>
              <div onClick={()=>pick(1)} style={seg(tasted[k]===1)}>{hi}</div>
            </div>
          </div>;
        })}
      </div>)}
  </div>;
}

/* "Keep learning": LearnNext's tiles for this wine (its type's basics, region, grape, the next
   beginner article, unread articles about it). Locked ones open the Pro sheet. */
function KeepLearning({wine,nav,showPro,intro}){
  const tiles=React.useMemo(()=>LearnNext.forWine(wine),[wine&&wine.name]);
  const [busy,setBusy]=React.useState(null);
  const startQuiz=cfg=>{ sessionStorage.setItem('vinterest_quiz_config2',JSON.stringify(cfg)); nav('quiz'); };
  function open(t){
    if(busy) return;
    if(t.locked){ if(showPro) showPro(t.locked); return; }
    if(t.kind==='topic') return startQuiz(t.config);
    if(t.kind==='region'){ setBusy(t.key); RegionQuizBank.load(t.region,()=>{ setBusy(null); startQuiz({mode:'region',region:t.region}); }); return; }
    if(t.kind==='grape'){ setBusy(t.key); getGrapeQuiz(t.grape,qs=>{ setBusy(null); if(qs&&qs.length) startQuiz({mode:'grape',grape:t.grape,questions:qs}); }); return; }
    if(t.kind==='onramp'){ sessionStorage.setItem('vinterest_onramp_idx',String(t.idx)); nav('article'); return; }
    if(t.kind==='article'){ sessionStorage.setItem('vinterest_gen_article',JSON.stringify(t.stub)); nav('gen-article'); return; }
    nav('profile');
  }
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <div>
      <div style={{fontSize:18,fontWeight:800,color:C.ink,fontFamily:C.P}}>Keep learning</div>
      <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{intro||'Picked for the wine you just had. A few minutes each.'}</div>
    </div>
    {tiles.map(t=>(
      <div key={t.key} onClick={()=>open(t)} role="button" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,background:C.white,border:`1px solid ${C.line}`,cursor:'pointer'}}>
        <div style={{width:40,height:40,borderRadius:12,background:t.locked?C.offWhite:(t.col?t.col+'14':C.crSoft),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {t.kind==='region'&&Regions.flag(t.key.slice(7))?<span role="img" style={{fontSize:'22px',lineHeight:1,opacity:t.locked?0.5:1}}>{Regions.flag(t.key.slice(7))}</span>:<Icon n={t.locked?'lock':t.icon} sz={19} col={t.locked?C.mid:(t.col||C.cr)}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{t.title}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4,marginTop:2}}>{t.why}</div>
          {(t.progress||t.locked)&&<div style={{fontSize:12,fontWeight:700,color:t.locked?C.amber:C.ink2,fontFamily:C.P,marginTop:4}}>{t.locked?'Unlock with Pro':t.progress}</div>}
        </div>
        {busy===t.key
          ?<div style={{width:14,height:14,borderRadius:7,border:`2px solid ${C.line}`,borderTopColor:C.cr,animation:'scSpin .8s linear infinite',flexShrink:0}}/>
          :t.locked?<ProBadge/>:<Icon n="chevron" sz={13} col={C.mid}/>}
      </div>
    ))}
  </div>;
}

/* The "while you taste" card: taste cues, with Blind Call on offer for someone drinking it now. */
function TasteCard({wine,gen,accent,onBlindCall}){
  const played=!!localStorage.getItem('vinterest_blindcall_'+_bcKey(wine).replace(/\s/g,'_'));
  const [blind,setBlind]=React.useState(played);
  if(blind) return <BlindCallCard wine={wine} gen={gen} accent={accent} onStart={onBlindCall}/>;
  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <TasteCues wine={wine} accent={accent}/>
    <div onClick={()=>setBlind(true)} style={{padding:'12px 14px',borderRadius:12,background:C.crSoft,border:`1px solid ${C.crDim}`,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
      <Icon n="bolt" sz={18} col={C.cr}/>
      <div style={{flex:1}}>
        <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Tasting it now? Play Blind Call</div>
        <div style={{fontSize:13,color:C.ink2,fontFamily:C.P}}>Call the body, acidity and more before you see the answer.</div>
      </div>
    </div>
  </div>;
}

/* ── the deck (three interaction styles) ── */
function CardDeck({deckStyle,wine,gen,loading,match,curr,scanData,existingRating,nav,showPro,onRated,onSaveForLater,onBlindCall}){
  const cards=React.useMemo(()=>buildCards({match}),[match&&match.tone]);
  const [finishStage,setFinishStage]=React.useState('rate');
  const ctx={wine,gen,loading,match,curr,scanData,onBlindCall,finishStage,
    finish:()=><RatingPanel wine={wine} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr} onRated={onRated} onSaveForLater={existingRating?null:onSaveForLater} onStage={setFinishStage}/>};
  const [idx,setIdx]=React.useState(0);

  const total=cards.length;
  const go=d=>setIdx(i=>Math.max(0,Math.min(total-1,i+d)));

  const common={cards,ctx};

  return <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0,position:'relative'}}>
    {/* progress dots */}
    <div style={{display:'flex',gap:5,padding:'12px 20px 6px',justifyContent:'center',flexWrap:'wrap',flexShrink:0}}>
      {cards.map((c,i)=>(
        <div key={c.key} onClick={()=>deckStyle==='deck'&&setIdx(i)} style={{height:4,borderRadius:2,flex:deckStyle==='deck'?'0 0 auto':1,width:deckStyle==='deck'?(i===idx?22:14):'auto',maxWidth:deckStyle==='deck'?undefined:34,background:i<=idx?c.accent:C.line,transition:'all .25s',cursor:deckStyle==='deck'?'pointer':'default'}}/>
      ))}
    </div>

    {deckStyle==='deck'&&<SwipeDeck idx={idx} setIdx={setIdx} go={go} {...common} deck={cards}/>}
    {deckStyle==='carousel'&&<Carousel {...common}/>}
    {deckStyle==='feed'&&<Feed {...common}/>}
  </div>;
}

/* shared card chrome */
/* The last card's label follows the rating step: Rate it, then Your score, then Keep learning. */
const _FINISH_HEAD={rate:null,saved:{eyebrow:'Your score',icon:'check'},next:{eyebrow:'Keep learning',icon:'book'}};
function CardShell({card,children,ctx,style}){
  const isFinish=card.kind==='finish';
  const head=(isFinish&&ctx&&_FINISH_HEAD[ctx.finishStage])||card;
  return <div style={{background:C.white,borderRadius:22,border:`1px solid ${C.line}`,boxShadow:'0 6px 22px rgba(0,0,0,0.08)',display:'flex',flexDirection:'column',overflow:'hidden',...style}}>
    <div style={{height:5,background:card.accent,flexShrink:0}}/>
    <div style={{padding:'16px 18px 6px',display:'flex',alignItems:'center',gap:9,flexShrink:0}}>
      <div style={{width:30,height:30,borderRadius:9,background:card.soft,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n={head.icon} sz={16} col={card.accent}/></div>
      <span style={{fontSize:12.5,fontWeight:700,color:card.accent,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>{head.eyebrow}</span>
    </div>
    {/* overflow:clip, not hidden: a hidden-overflow box is a scroll container, and on touch
        screens the browser claims horizontal drags that start inside one, cancelling the swipe. */}
    <div className="sc-scroll" style={{padding:'8px 18px 18px',overflowX:'clip',overflowY:isFinish?'auto':'clip',flex:1,minHeight:0}}>
      {isFinish?ctx.finish():children}
    </div>
  </div>;
}

/* deck style A — swipeable stack. A drag starts anywhere on the card except on a control
   (slider, input, button), only once the finger moves sideways more than it moves down, and
   moves the card directly rather than re-rendering the deck every frame. A drag past a fifth
   of the card, or a short flick, turns it; it works both ways, including back from the last card. */
function SwipeDeck({deck,ctx,idx,setIdx,go}){
  const g=React.useRef(null);
  const hintRef=React.useRef(0);
  const justDragged=React.useRef(false);
  const [hint,setHint]=React.useState(0);
  const top=deck[idx];
  const isFinish=top&&top.kind==='finish';
  const CONTROL='input,textarea,select,button,a,[role="slider"],[data-noswipe]';
  function place(el,dx,dy,anim){
    el.style.transition=anim?'transform .26s cubic-bezier(.34,1.1,.64,1)':'none';
    el.style.transform=`translate(${dx}px,${dy*0.25}px) rotate(${dx*0.04}deg)`;
  }
  function onPointerDown(e){
    if(e.button>0||(e.target.closest&&e.target.closest(CONTROL))) return;
    g.current={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),dragging:false,el:e.currentTarget,w:e.currentTarget.offsetWidth||320,dx:0};
  }
  function onPointerMove(e){
    const s=g.current; if(!s||e.pointerId!==s.id) return;
    const dx=e.clientX-s.x, dy=e.clientY-s.y;
    if(!s.dragging){
      if(Math.abs(dy)>14&&Math.abs(dy)>Math.abs(dx)){ g.current=null; return; }
      if(Math.abs(dx)<8) return;
      s.dragging=true; try{ s.el.setPointerCapture(e.pointerId); }catch(err){}
    }
    s.dx=dx; place(s.el,dx,dy,false);
    const h=Math.abs(dx)>40?Math.sign(dx):0;
    if(h!==hintRef.current){ hintRef.current=h; setHint(h); }
  }
  function onPointerUp(e){
    const s=g.current; g.current=null;
    if(!s||e.pointerId!==s.id||!s.dragging) return;
    justDragged.current=true; setTimeout(()=>{ justDragged.current=false; },0);
    hintRef.current=0; setHint(0);
    const speed=Math.abs(s.dx)/Math.max(1,performance.now()-s.t);
    const turn=Math.abs(s.dx)>s.w*0.2||(Math.abs(s.dx)>30&&speed>0.25);
    const dir=turn?(s.dx<0?1:-1):0;
    const ok=dir===1?idx<deck.length-1:dir===-1?idx>0:false;
    if(ok){ place(s.el,(s.dx<0?-1:1)*s.w*1.3,0,true); setTimeout(()=>go(dir),170); }
    else place(s.el,0,0,true);
  }
  const drag={dx:hint*50};

  return <div className="sc-swipe" style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 16px 14px',minHeight:0}}>
    <div style={{position:'relative',flex:1,minHeight:0}}>
      {deck.map((c,i)=>{
        if(i<idx||i>idx+2) return null;
        const depth=i-idx;
        const isTop=depth===0;
        const tf=isTop?'translate(0px,0px) rotate(0deg)':`translateY(${depth*12}px) scale(${1-depth*0.045})`;
        const cc={...c,_wine:ctx.wine};
        return <div key={c.key}
          onPointerDown={isTop?onPointerDown:undefined} onPointerMove={isTop?onPointerMove:undefined} onPointerUp={isTop?onPointerUp:undefined} onPointerCancel={isTop?onPointerUp:undefined}
          onClickCapture={isTop?(e=>{ if(justDragged.current){ e.stopPropagation(); e.preventDefault(); } }):undefined}
          style={{position:'absolute',inset:0,zIndex:10-depth,transform:tf,transition:'transform .3s cubic-bezier(.34,1.1,.64,1)',opacity:depth>1?0:1,cursor:isTop?'grab':'default',userSelect:isTop&&!isFinish?'none':'auto',WebkitUserSelect:isTop&&!isFinish?'none':'auto',WebkitTouchCallout:isTop&&!isFinish?'none':'default'}}>
          <CardShell card={cc} ctx={ctx} style={{height:'100%'}}>
            <CardFace card={c} ctx={ctx}/>
          </CardShell>
          {isTop&&Math.abs(drag.dx)>40&&<div style={{position:'absolute',top:24,[drag.dx<0?'right':'left']:24,padding:'6px 14px',borderRadius:10,border:`2.5px solid ${C.mid}`,color:C.mid,fontSize:15,fontWeight:800,fontFamily:C.P,transform:`rotate(${drag.dx<0?12:-12}deg)`,background:'rgba(255,255,255,0.9)',letterSpacing:'0.05em'}}>{drag.dx<0?'NEXT':'BACK'}</div>}
        </div>;
      })}
    </div>
    {/* controls */}
    <div style={{flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',gap:14,paddingTop:12}}>
      <div onClick={()=>go(-1)} style={{width:44,height:44,borderRadius:22,background:C.white,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',opacity:idx===0?0.35:1,boxShadow:'0 2px 8px rgba(0,0,0,0.08)'}}><Icon n="back" sz={17} col={C.ink}/></div>
      <div style={{fontSize:12.5,fontWeight:700,color:C.mid,fontFamily:C.P,minWidth:44,textAlign:'center'}}>{idx+1} / {deck.length}</div>
      <div onClick={()=>go(1)} style={{width:44,height:44,borderRadius:22,background:idx>=deck.length-1?C.white:C.cr,border:idx>=deck.length-1?`1px solid ${C.line}`:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',opacity:idx>=deck.length-1?0.35:1,boxShadow:'0 2px 8px rgba(139,26,47,0.25)',transform:'scaleX(-1)'}}><Icon n="back" sz={17} col={idx>=deck.length-1?C.ink:'#fff'}/></div>
    </div>
  </div>;
}

/* deck style B — horizontal carousel */
function Carousel({cards,ctx}){
  return <div className="sc-scroll" style={{flex:1,display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',gap:14,padding:'8px 16px 18px',minHeight:0}}>
    {cards.map(c=>{
      const cc={...c,_wine:ctx.wine};
      return <div key={c.key} style={{scrollSnapAlign:'center',flex:'0 0 86%',maxWidth:360,display:'flex'}}>
        <CardShell card={cc} ctx={ctx} style={{width:'100%',minHeight:0}}>
          <CardFace card={c} ctx={ctx}/>
        </CardShell>
      </div>;
    })}
  </div>;
}

/* deck style C — vertical feed */
function Feed({cards,ctx}){
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'8px 16px 24px',display:'flex',flexDirection:'column',gap:14,minHeight:0}}>
    {cards.map(c=>{
      const cc={...c,_wine:ctx.wine};
      return <div key={c.key} style={{animation:'scPop .3s ease both'}}>
        <CardShell card={cc} ctx={ctx}>
          <CardFace card={c} ctx={ctx}/>
        </CardShell>
      </div>;
    })}
  </div>;
}

Object.assign(window,{ScanCardsScreen});
