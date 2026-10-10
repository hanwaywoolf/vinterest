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
    const key='vinterest_scancards_v7_'+(wine.name||'').replace(/\s/g,'_')+'_'+(wine.vintage||'nv')+'_'+verdict;
    const cached=Cache.getText(key);
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
      'You are a warm, knowledgeable sommelier writing two short things for a wine app that teaches people about wine. '+
      'Wine: '+(w.name||'')+(w.vintage&&w.vintage!=='NV'&&w.vintage!==0?' '+w.vintage:'')+'. '+
      'Type: '+(w.type||'red')+'. Region: '+(w.region||'')+((w.sub_region)?' ('+w.sub_region+')':'')+', '+(w.country||'')+'. '+
      'Producer: '+(w.producer||'unknown')+'. '+
      'Grapes: '+(WineDNA.grapeLine(w)||'unknown')+(w.grapes_basis==='typical'?' (not stated on the label: what this wine usually contains)':w.grapes_basis==='known'?' (the producer\'s known blend)':'')+'. '+
      (w.blend||(w.grapes||[]).length>1?'This is a blend: call it a blend led by its main grape, never a single-grape wine. ':'')+
      matchFacts+' '+agingLine+' '+
      'Return ONLY valid JSON, no markdown, concrete and specific to THIS wine (no generic filler), and NO numbers/percentages/decimals anywhere EXCEPT a specific year, always written as numerals: '+
      '{'+
      '"fact":"one genuinely surprising, memorable fact about this wine, its producer, grape or region (max 28 words)",'+
      '"talk":["three SHORT quotable phrases (each max 12 words) a drinker could say out loud to sound clued-in about this exact wine"]'+
      '}';
    window.claude.complete({purpose:'scancard',messages:[{role:'user',content:prompt}]})
      .then(text=>{
        let c=text.replace(/```json|```/g,'').trim();
        const s=c.indexOf('{'),e=c.lastIndexOf('}');
        if(s>=0&&e>s) c=c.slice(s,e+1);
        const d=JSON.parse(c);
        Cache.set(key,d);
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

/* TasteMatch's reasons: one line each, with a dot for whether it counts for or against. A price
   note (TasteMatch.priceNote) follows them, marked apart: it's said, but it never moves the match. */
/* brief (the scan result below More, DetailLevel): the first reason for it and the first against,
   without the summary. */
function MatchReasons({match,col,showSummary=true,priceNote,brief=false}){
  if(!match) return null;
  const reasons=brief?[match.reasons.find(r=>r.tone==='good'),match.reasons.find(r=>r.tone==='bad')||match.reasons.find(r=>r.tone==='neutral')].filter(Boolean):match.reasons;
  return <div data-brief={brief?'1':undefined} style={{display:'flex',flexDirection:'column',gap:8}}>
    {showSummary&&!brief&&<div style={{fontSize:15,color:col||C.ink2,fontFamily:C.P,lineHeight:1.55}}>{match.summary}</div>}
    {reasons.map((r,i)=>(
      <div key={i} style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:15,lineHeight:1.5}}>
        <span style={{height:'1.5em',display:'flex',alignItems:'center',flexShrink:0}}><span style={{width:8,height:8,borderRadius:4,background:_TONE_COL[r.tone]}}/></span>
        <span style={{color:C.ink2,fontFamily:C.P}}>{r.text}</span>
      </div>
    ))}
    {priceNote&&<div style={{display:'flex',gap:9,alignItems:'flex-start',fontSize:15,lineHeight:1.5}}>
      <span style={{height:'1.5em',display:'flex',alignItems:'center',flexShrink:0}}><span style={{width:8,height:8,borderRadius:2,background:C.amber}}/></span>
      <span style={{color:C.ink2,fontFamily:C.P}}>{priceNote.text} <span style={{color:C.mid}}>This doesn't change the match.</span></span>
    </div>}
  </div>;
}

/* "Why 81%?": what about this wine lifts the prediction above their average and what holds it
   back, the wines most like it, and how that becomes the %. Everything comes from
   TasteMatch.breakdown; nothing is worked out here. */
function MatchBreakdown({match}){
  const [open,setOpen]=React.useState(false);
  const b=match&&match.breakdown; if(!b||match.pct==null) return null;
  const line=(it,sym,col,i)=><div key={i} style={{display:'flex',gap:9,alignItems:'baseline',fontSize:15,fontFamily:C.P,lineHeight:1.45}}>
    <span style={{fontWeight:800,color:col,width:12,flexShrink:0,textAlign:'center'}}>{sym}</span><span style={{color:C.ink2}}>{it.text}</span></div>;
  const head=t=><div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>{t}</div>;
  return <div style={{marginTop:12}}>
    <div role="button" onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:6,fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>
      Why {match.pct}%? <span style={{display:'inline-block',transform:open?'rotate(90deg)':'none',transition:'transform .15s'}}><Icon n="chevron" sz={12} col={C.cr}/></span>
    </div>
    {open&&<div style={{marginTop:10,padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>You rate {match.breakdownLabel} {b.avg} on average. Compared with that:</div>
      {b.up.length>0&&<>{head('Brings it up')}{b.up.map((it,i)=>line(it,'↑',C.green,i))}</>}
      {b.down.length>0&&<>{head('Holds it back')}{b.down.map((it,i)=>line(it,'↓','#B04A3A',i))}</>}
      {b.even.length>0&&<>{head('No difference')}{b.even.map((it,i)=>line(it,'·',C.mid,i))}</>}
      {b.closest&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45,paddingTop:8,borderTop:`1px solid ${C.line}`}}>{b.closest}</div>}
      <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{b.pctWhy}</div>
    </div>}
  </div>;
}

/* ── the screen ── */
function useDeckStyle(){
  const [s,setS]=React.useState(()=>Settings.scancardStyle());
  React.useEffect(()=>{
    const h=()=>setS(Settings.scancardStyle());
    window.addEventListener('vinterest:scancardstyle',h);
    return()=>window.removeEventListener('vinterest:scancardstyle',h);
  },[]);
  return s;
}
/* After a scan: an "Is this it?" check when the label was hard to read, then the result (match,
   reasons, then three equal next steps: Learn more about this wine / Rate it / Save for later, then style and price). The card deck is the
   optional deep dive, one tap away. */
function ScanCardsScreen({nav,back,showPro}){
  const scanData=React.useMemo(()=>{
    try{ return Handoff.scanResult.get({}); }catch(e){ return {}; }
  },[]);
  const source=scanData.source||'camera';
  const [wine,setWine]=React.useState(()=>ScanFlow.resolve(scanData.wine||null).wine);
  const [ratingsVersion,setRatingsVersion]=React.useState(0);
  const saved=React.useMemo(()=>wine?WineHistory.find(wine):null,[wine,ratingsVersion]);
  const existingRating=(saved&&saved.rating)||0;
  const confirmKey='vinterest_scan_confirmed_'+((scanData.wine&&scanData.wine.name)||'').replace(/\s/g,'_');
  const [confirmed,setConfirmed]=React.useState(()=>!!saved||!ScanFlow.needsConfirm(scanData.wine,source)||Handoff.confirmed(confirmKey));
  const [editing,setEditing]=React.useState(false);
  // A fresh scan opens on the reveal (ScanReveal, pwa-reveal.jsx), then the result; coming back
  // to the screen (from Details, say: `tracked`) or a screen that asked for a view skips it.
  const fresh=!scanData.view&&!scanData.tracked&&(source==='camera'||source==='list')&&!_revealOff();
  const [view,setView]=React.useState(()=>scanData.view||(fresh?'reveal':'result'));
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
    try{ const sd=Handoff.scanResult.get({}); sd.tracked=true; Handoff.openWine(sd); }catch(e){}
    const isNew=!WineHistory.find(wine);
    WineHistory.track(wine);
    if(isNew&&source==='list') WineHistory.setScanIntent(wine.name,wine.vintage,'checking');
    if(source==='camera'){ ScanFlow.awardScanXP(wine); ScanFlow.unlockLearning(wine); }
  },[wine,confirmed]);

  function applyEdit(patch){
    const before=wine, next={...wine,...patch,confidence:'high'};
    if(WineHistory.find(before)) WineHistory.update(WineHistory.find(before).name,WineHistory.find(before).vintage,patch);
    try{ const sd=Handoff.scanResult.get({}); sd.wine=next; Handoff.openWine(sd); }catch(e){}
    setWine(next); setEditing(false); confirm();
  }
  function confirm(){ Handoff.setConfirmed(confirmKey); setConfirmed(true); }
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

  const reveal=confirmed&&view==='reveal';
  return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:reveal?'#0F0F0F':C.bg}}>
    {!reveal&&<ScanHeader wine={wine} nav={nav} back={view==='deck'&&confirmed?()=>setView('result'):back}/>}
    {!confirmed
      ? <ConfirmGate wine={wine} onYes={confirm} onEdit={()=>setEditing(true)} nav={nav}
          onAlt={()=>applyEdit({name:wine.alternative,producer:''})}/>
      : view==='reveal'
        ? <ScanReveal wine={wine} match={match} gen={gen} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr}
            onDone={v=>{ if(v==='saved') setIntent('checking'); setView(v); }}/>
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
    <ScanStyles/>
  </div>;
}

/* Keyframes and the deck's touch rules, shared by the scan screen and the first-scan story. */
function ScanStyles(){
  return <style>{`
      @keyframes scSpin{to{transform:rotate(360deg)}}
      @keyframes scSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes scFade{from{opacity:0}to{opacity:1}}
      @keyframes scPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
      .sc-scroll::-webkit-scrollbar{display:none}
      /* Every element in the swipe deck leaves horizontal drags to the deck (vertical scrolling
         still works); touch-action is decided where the finger lands, so the card alone isn't
         enough. Sliders keep their own drag. */
      .sc-swipe,.sc-swipe *{touch-action:pan-y}
      .sc-swipe input[type=range],.sc-swipe [role=slider],.sc-swipe [role=slider] *{touch-action:none}
    `}</style>;
}

/* The first scan, as the last part of onboarding: this bottle's story, with what each feature will
   do for them (FirstScan), ending on their
   first score or Save for later. Later scans use the ordinary result screen. */
function FirstScanStory({wine,onDone}){
  const [ver,setVer]=React.useState(0);
  const match=React.useMemo(()=>TasteMatch.assess(wine,WineHistory.getAll()),[wine,ver]);
  const {gen,loading}=useScanContent(wine,match);
  const curr=React.useMemo(()=>Regional.current(),[]);
  const deckStyle=useDeckStyle();
  const intent=v=>{ const e=WineHistory.find(wine); if(e) WineHistory.setScanIntent(e.name,e.vintage,v); };
  const [scoredAlready]=React.useState(()=>(WineHistory.find(wine)||{}).rating||0);
  const revealing=!_revealOff();
  return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:revealing?'#0F0F0F':C.bg,paddingTop:revealing?0:'env(safe-area-inset-top)'}}>
    {!revealing&&<div style={{padding:'14px 18px 8px',flexShrink:0,display:'flex',alignItems:'flex-start',gap:12}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Your first bottle</div>
        <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginTop:2}}>{wine.name}</div>
        <div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:2}}>Here's its story, and what Vinterest will do with every bottle after it.</div>
      </div>
      <span onClick={onDone} role="button" style={{fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer',paddingTop:2}}>Skip</span>
    </div>}
    {/* Coming back from the questions, the bottle is already scored: the deck shows that score
        rather than asking again beside a meter that already counts it. */}
    {!_revealOff()
      ?<ScanReveal wine={wine} match={match} gen={gen} existingRating={scoredAlready} firstScan nav={()=>{}} curr={curr} onFinish={onDone}
          onRated={()=>{ intent('tasted'); setVer(v=>v+1); }} onSaveForLater={()=>{ intent('checking'); onDone(); }}/>
      :<CardDeck key={deckStyle} deckStyle={deckStyle} wine={wine} gen={gen} loading={loading} match={match} curr={curr} scanData={{}} existingRating={scoredAlready}
      nav={()=>{}} firstScan onFinish={onDone}
      onRated={()=>{ intent('tasted'); setVer(v=>v+1); }}
      onSaveForLater={()=>{ intent('checking'); onDone(); }}
      onBlindCall={()=>intent('tasting')}/>}
    <ScanStyles/>
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
        {existingRating>0&&<span style={{fontSize:13,fontWeight:700,color:C.green,background:C.greenBg,border:`1px solid ${C.green}30`,borderRadius:20,padding:'3px 10px',fontFamily:C.P}}>You rated it {existingRating} · {ParkerScale.label(existingRating)}</span>}
        <span onClick={onEdit} style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Not right? Edit</span>
      </div>
    </Card>

    <Card style={{padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <MatchRing match={match}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:match&&match.pct!=null?col:C.ink,fontFamily:C.P,lineHeight:1.2}}>{match?match.label:'—'}</div>
          {match&&match.expected!=null
            ?<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3}}>{existingRating>0?`We expected about ${match.expected} · you rated ${existingRating}`:`Likely about ${match.expected} from you · ${match.expectedLabel}`}</div>
            :match&&match.verdict==='early'?null
            :<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{match&&match.summary}</div>}
          {match&&match.expected!=null&&match.bar!=null&&!(existingRating>0)&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>{match.pct}% sure you'd rate it {match.bar}+, your usual for {match.breakdownLabel}</div>}
          {match&&match.confidence==='low'&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>Rough guess</div>}
        </div>
      </div>
      {/* Too early for a match: show how close it is and what it unlocks, not just a dash. */}
      {match&&match.verdict==='early'&&<div style={{marginTop:14}}><MatchComingSoon wine={wine} compact/></div>}
      {match&&(match.reasons.length>0||match.expected!=null)&&<div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.line}`}}>
        {/* Below More (DetailLevel): the top reason either way; the rest and "Why N%?" come with More. */}
        <MatchReasons match={match} showSummary={match.expected!=null} brief={!DetailLevel.at('more')} priceNote={TasteMatch.priceNote(wine,list||shop,WineHistory.getAll(),curr)}/>
        {DetailLevel.at('more')&&<MatchBreakdown match={match}/>}
      </div>}
    </Card>

    {view==='rate'
      ? <Card style={{padding:16}}><RatingPanel wine={wine} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr} onRated={onRated} onSaveForLater={existingRating?null:onSaveForLater}/></Card>
      : view==='saved'
        ? <><Card style={{padding:16,display:'flex',flexDirection:'column',gap:10,alignItems:'center',textAlign:'center'}}>
            <div style={{width:48,height:48,borderRadius:24,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="check" sz={22} col={C.cr}/></div>
            <div style={{fontSize:18,fontWeight:800,color:C.ink,fontFamily:C.P}}>Saved for later</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>It won't count towards your WineDNA until you buy or taste it. Next time you open the app we'll ask whether you bought it.</div>
            <div role="button" onClick={()=>setView('rate')} style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Already tasted it? Rate it instead →</div>
          </Card>
          <Card style={{padding:16}}><KeepLearning wine={wine} nav={nav} showPro={showPro} reveal intro="Shopping? Learn a little about it before you decide."/></Card>
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
                {key:'learn',icon:'book',label:'Learn more about this wine',sub:'The house, the year, how it\'s made, the table',on:onDeck},
                {key:'rate',icon:'star',label:existingRating?`Re-rate it (${existingRating})`:'Rate it',sub:existingRating?'Changed your mind?':'Rate it to sharpen your WineDNA',on:()=>setView('rate')},
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

/* ── card content model: "Learn more about this wine" ──
   The layer after the scan story, for the ones who want more. The story has already given the
   match, how the wine will feel, the grape, the place and one line to say; these go deeper and
   never repeat it: the match in full, the house, the year, how it's made, the appellation in
   depth, the table, Blind Call, and what's next. Each card opens on a line and keeps its
   paragraph behind "More" (below the More detail level); the words come from WineDeep, written
   on demand the first time the deck is opened, over the checked facts in knowledge.json. */
function buildCards({match}){
  return [
    match&&match.verdict==='early'
      ?{key:'match',accent:C.green,soft:C.greenBg,icon:'compass',eyebrow:'Your match',kind:'first-match'}
      :{key:'match',accent:C.green,soft:C.greenBg,icon:'compass',eyebrow:'Your match',kind:'match'},
    {key:'house',accent:C.cr,soft:C.crSoft,icon:'user',eyebrow:'The house',kind:'house'},
    {key:'year',accent:'#9B6B00',soft:'#FBF3E0',icon:'bookmark',eyebrow:'The year',kind:'year'},
    {key:'made',accent:'#6B2D8B',soft:'#F3ECF8',icon:'grape',eyebrow:'How it\'s made',kind:'made'},
    {key:'region',accent:C.cr,soft:C.crSoft,icon:'globe',eyebrow:'The region',kind:'region'},
    {key:'table',accent:C.amber,soft:C.amberBg,icon:'fork',eyebrow:'At the table',kind:'table'},
    {key:'taste',accent:C.ink,soft:C.offWhite,icon:'wine',eyebrow:'While you taste',kind:'taste'},
    {key:'next',accent:C.green,soft:C.greenBg,icon:'book',eyebrow:'Next from here',kind:'next'},
    {key:'finish',accent:C.cr,soft:C.crSoft,icon:'star',eyebrow:'Rate it',kind:'finish'},
  ];
}

/* Before there are enough scores for a match: a WineDNA meter for this wine's type, what unlocks,
   and (unless compact) a clearly labelled example of a personal match. */
function MatchComingSoon({wine,compact}){
  const p=React.useMemo(()=>FirstScan.progress(wine,WineHistory.getAll()),[wine&&wine.name]);
  const ex=FirstScan.example(wine), col=_typeCol(wine);
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    <div style={{fontSize:compact?16:18,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>
      {p.n===0?`Your WineDNA starts with your first rating`:`${p.n} of ${p.need} ${p.many} rated`}</div>
    <div style={{display:'flex',gap:6}} aria-label={`${p.n} of ${p.need} ${p.many} rated`}>
      {Array.from({length:p.need},(_,i)=><div key={i} style={{flex:1,height:8,borderRadius:4,background:i<p.n?col:C.line}}/>)}
    </div>
    <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
      Rate {p.left===1?'one more':p.left} {p.left===1?p.one:p.many} and every {p.one} you scan shows how much you'll like it, before you buy it or as you try it, worked out from your own ratings, not critics'.</div>
    {/* Laid out like the real match card, ring at near full size, and labelled as an example. */}
    {!compact&&<div style={{padding:'14px 14px 16px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',flexDirection:'column',alignItems:'center',gap:8,textAlign:'center'}}>
      <div style={{fontSize:12,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Example</div>
      <MatchRing match={{pct:ex.pct,tone:'good'}} size={120}/>
      <div style={{fontSize:18,fontWeight:800,color:C.green,fontFamily:C.P}}>{ex.label}</div>
      <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>{ex.line}</div>
    </div>}
  </div>;
}

/* Renders the body of one card. From More (DetailLevel) everything shows; below it each card

/* Renders the body of one card. From More (DetailLevel) everything shows; below it each card
   opens on its picture and main line, and the rest (the reasons, the regional detail, more lines
   to say, the price note) waits behind "More" on that card. */
function CardFace({card,ctx}){
  const [expanded,setExpanded]=React.useState(()=>DetailLevel.at('more'));
  const {wine,gen,loading,match,curr,scanData}=ctx;
  const a=card.accent;
  const P=C.P;
  // The app's own sizes (titles 19, text 16): a card holds a paragraph, not a headline.
  const H=({children})=><div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:P,lineHeight:1.25,letterSpacing:'-0.01em'}}>{children}</div>;
  const Body=({children,dim})=><div style={{fontSize:dim?15:16,color:dim?C.mid:C.ink2,fontFamily:P,lineHeight:1.55}}>{children}</div>;
  const Sub=({children})=><div style={{fontSize:12.5,fontWeight:700,color:C.mid,fontFamily:P,letterSpacing:'0.06em',textTransform:'uppercase'}}>{children}</div>;
  // The checked facts under a card, in a quiet box.
  const Facts=({rows})=>rows.filter(r=>r&&r[1]).length?<div style={{padding:'10px 12px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',flexDirection:'column',gap:6}}>
    {rows.filter(r=>r&&r[1]).map(([k,v],i)=><div key={i} style={{fontSize:14,color:C.ink2,fontFamily:P,lineHeight:1.45}}><span style={{fontWeight:700,color:C.ink}}>{k}: </span>{v}</div>)}
  </div>:null;
  const deep=ctx.deep, facts=ctx.facts||{};
  // One of WineDeep's cards: its line, its paragraph behind More, the wait while it's written.
  const Deep=({f,fallback})=>{ const v=deep&&deep[f];
    if(!v&&ctx.deepLoading) return <WritingWait compact wine={wine} col={a} sub="Learn more about this wine"/>;
    return <>
      <Body>{(v&&v.line)||fallback||'—'}</Body>
      {v&&v.more&&(expanded?<Body dim>{v.more}</Body>:<More/>)}
    </>; };
  const More=()=>expanded?null:<div role="button" data-card-more onClick={e=>{ e.stopPropagation(); setExpanded(true); }}
    style={{alignSelf:'flex-start',fontSize:15,fontWeight:700,color:a||C.cr,fontFamily:P,cursor:'pointer',padding:'2px 0'}}>More →</div>;

  if(card.kind==='first-match') return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <H>Your match, from your own taste</H>
    <MatchComingSoon wine={wine}/>
  </div>;

  if(card.kind==='match'){
    // The story gave the number and a reason each way; here is the whole working.
    return <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14,textAlign:'center'}}>
      <MatchRing match={match} size={120}/>
      <H>{match?match.label:'—'}</H>
      {match&&match.expected!=null&&<div style={{fontSize:15,color:C.mid,fontFamily:P,marginTop:-8}}>Likely about {match.expected} from you · {match.expectedLabel}</div>}
      <div style={{width:'100%',textAlign:'left',padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
        <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>How we got this</div>
        <MatchReasons match={match} col={C.ink2} brief={!expanded}/>
        {expanded&&match&&match.breakdown&&<div style={{marginTop:4}}><MatchBreakdown match={match}/></div>}
      </div>
      {match&&(match.reasons.length>2||match.breakdown)&&<More/>}
    </div>;
  }

  if(card.kind==='house'){
    const classic=facts.classic||[];
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>{wine.producer||'The house'}</H>
      <Deep f="house" fallback={facts.isClassic?`One of ${facts.region}'s classic houses.`:wine.producer?`A ${facts.region||wine.region||wine.country} producer.`:'The label didn\'t name a producer.'}/>
      <Facts rows={[[facts.isClassic?'Classic houses here':'Classic houses of '+(facts.region||'the region'),classic.length?classic.join(', '):null]]}/>
    </div>;
  }

  if(card.kind==='year'){
    const y=wine.vintage&&wine.vintage!=='NV'&&wine.vintage!==0?String(wine.vintage):null, w=ScanFlow.drinkWindow(wine), r=deep&&deep.year&&deep.year.rating;
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>{y||'Non-vintage'}</H>
      {w&&<div style={{display:'flex',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
        <span style={{fontSize:16,fontWeight:800,color:a,fontFamily:P}}>{w.word}</span>
        <span style={{fontSize:14,color:C.mid,fontFamily:P}}>{w.line}{w.source==='estimate'?' · a rough estimate':''}</span>
        {r&&r!=='Unknown'&&<span style={{fontSize:12.5,fontWeight:700,color:a,fontFamily:P,padding:'2px 9px',borderRadius:12,background:card.soft}}>{r} vintage</span>}
      </div>}
      <Deep f="year" fallback={y?`The ${y} in ${facts.region||wine.region||wine.country}.`:'A blend of years, made to taste the same every time.'}/>
    </div>;
  }

  if(card.kind==='made'){
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>How it's made</H>
      <Deep f="made" fallback={facts.winemaking||(facts.classification?`${facts.region} is a ${facts.classification}: the rules below say how long it waits before release.`:null)}/>
      <Facts rows={[['Classification',facts.classification?`${facts.region} ${facts.classification}`:null],['Ageing rules',facts.agingRules],[facts.grape?`${facts.grape} in the winery`:'',facts.winemaking]]}/>
    </div>;
  }

  if(card.kind==='region'){
    const name=facts.region||wine.region||wine.country;
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>{name}</H>
      <Deep f="region" fallback={facts.climate?`${facts.climate}.`:null}/>
      <Facts rows={[['Inside it',(facts.places||[]).length?facts.places.join(', '):null],['Known for',(facts.keyGrapes||[]).length?facts.keyGrapes.join(', '):null]]}/>
      {facts.region&&ctx.nav&&<div role="button" onClick={e=>{ e.stopPropagation(); openRegionPage(facts.region,ctx.nav); }} style={{alignSelf:'flex-start',fontSize:15,fontWeight:700,color:a,fontFamily:P,cursor:'pointer'}}>{facts.region}'s page →</div>}
    </div>;
  }

  if(card.kind==='table'){
    const t=deep&&deep.table, pairs=t&&Array.isArray(t.pairings)?t.pairings.filter(x=>x&&x.food):[], plain=WineDNA.capNotes(wine.food_pairings||[]);
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>At the table</H>
      {!t&&ctx.deepLoading?<WritingWait compact wine={wine} col={a} sub="Learn more about this wine"/>:<>
        {t&&t.serve&&<Body>{t.serve}</Body>}
        {pairs.length>0?<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {pairs.slice(0,expanded?3:2).map((x,i)=><div key={i} style={{padding:'10px 12px',borderRadius:12,background:card.soft,border:`1px solid ${a}22`}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:P}}>{x.food}</div>
            {x.why&&<div style={{fontSize:14,color:C.ink2,fontFamily:P,lineHeight:1.45,marginTop:2}}>{x.why}</div>}
          </div>)}
          {pairs.length>2&&<More/>}
        </div>
        :plain.length>0?<div style={{display:'flex',flexWrap:'wrap',gap:7}}>{plain.map((f,i)=><span key={i} style={{padding:'5px 12px',borderRadius:20,background:card.soft,color:a,fontSize:14,fontWeight:600,fontFamily:P,border:`1px solid ${a}22`}}>{f}</span>)}</div>:null}
        {facts.food&&<Facts rows={[[`${facts.grape} and food`,facts.food]]}/>}
      </>}
    </div>;
  }

  if(card.kind==='next'){
    return <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <H>Next from here</H>
      {match&&match.breakdown&&match.breakdown.closest&&<Body>{match.breakdown.closest}</Body>}
      <KeepLearning wine={wine} nav={ctx.nav||(()=>{})} showPro={ctx.showPro} reveal intro="Quizzes and articles this bottle opened, from your WineDNA."/>
    </div>;
  }

  if(card.kind==='taste') return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <TasteCard wine={wine} gen={gen} accent={a} onBlindCall={ctx.onBlindCall}/>
  </div>;

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
  const notes=WineDNA.capNotes(wine.tasting_notes).slice(0,4);
  return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.25,letterSpacing:'-0.01em'}}>What to look for</div>
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
const DIM_LABEL={body:'Body',acidity:'Acidity',tannins:'Tannins',texture:'Texture',effervescence:'Bubbles'};
const DIM_LO={body:'Light',acidity:'Mellow',tannins:'Silky',texture:'Crisp & steely',effervescence:'Soft & delicate'};
const DIM_HI={body:'Full',acidity:'Zingy',tannins:'Grippy',texture:'Rich & creamy',effervescence:'Lively & persistent'};
const DIM_CONCEPT={tannins:'tannin_source',acidity:'acidity_and_food',texture:'oak_influence'};
/* The traits to call: the same ones the wine's own screen shows for its type, and only those the
   label gave a figure for (ScanFlow.compareAxes), so every call is scored against the label. */
function dimsFor(wine){ return ScanFlow.compareAxes(wine); }

function BlindCallCard({wine,gen,accent,onStart}){
  const [phase,setPhase]=React.useState(()=>ScanFlow.blindPlayed(wine)?'summary':'predict');
  const [guess,setGuess]=React.useState(null);
  const [score,setScore]=React.useState(()=>ScanFlow.blindResult(wine));
  const dims=React.useMemo(()=>dimsFor(wine),[wine&&wine.name]);

  function finalizeReveal(g,missed,accuracy){
    if(!ScanFlow.blindPlayed(wine)){
      ScanFlow.markBlindPlayed(wine);
      // Misjudging one wine's tannin/acidity/texture flags the concept for review; it isn't a
      // wrong answer to a Concept Check question, so it doesn't cost mastery progress.
      missed.forEach(d=>{ const cid=DIM_CONCEPT[d]; if(cid) MasterySystem.flagForReview(cid); });
      const awards=XPSystem.awardAndToast([{type:'blind_call',accuracy}],{xpShown:true}); // the result shows its XP
      const amount=awards.filter(x=>!x.levelUp).reduce((s,x)=>s+x.amount,0);
      // The guess is kept: it's the user's own read of the wine, used to pre-fill the rating step.
      ScanFlow.saveBlindResult(wine,{accuracy,amount,guess:g});
      setScore({accuracy,amount});
    }
    setPhase('result');
  }

  if(phase==='predict'&&!dims.length) return <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>The label didn't tell us enough about this wine's style to play Blind Call on it.</div>;
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
          <TrackSlider label={DIM_LABEL[d]} min={0} max={100} value={Math.round(vals[d]*100)} col={col||C.cr}
            onChange={n=>setVals(v=>({...v,[d]:n/100}))}/>
        </div>
      ))}
    </div>
    <Btn primary full onClick={()=>onSubmit(vals)}>Lock in my call</Btn>
  </div>;
}

function BlindCallReveal({wine,dims,guess,col,onDone}){
  const deltas=dims.map(d=>Math.abs(guess[d]-wine[d]));
  const avgDelta=deltas.reduce((s,x)=>s+x,0)/deltas.length;
  const accuracy=Math.max(0,1-avgDelta*1.6);
  const missed=dims.filter((d,i)=>deltas[i]>0.22);
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,letterSpacing:'-0.01em'}}>How you called it</div>
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {dims.map(d=>{
        const g=guess[d],act=wine[d];
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
    <Btn primary full onClick={()=>onDone(guess,missed,accuracy)}>See my result</Btn>
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

function TrackSlider({min,max,step=1,value,onChange,col=C.cr,label,unset=false,style}){
  const ref=React.useRef(null), drag=React.useRef(null);
  const clamp=v=>Math.min(max,Math.max(min,v));
  const pct=(clamp(value)-min)/(max-min);
  function at(x){ const r=ref.current.getBoundingClientRect(); const p=Math.min(1,Math.max(0,(x-r.left)/(r.width||1))); return clamp(Math.round((min+p*(max-min))/step)*step); }
  function down(e){ if(e.button>0) return; e.stopPropagation(); drag.current=e.pointerId; try{ ref.current.setPointerCapture(e.pointerId); }catch(err){} onChange(at(e.clientX)); }
  function move(e){ if(drag.current!==e.pointerId) return; e.stopPropagation(); onChange(at(e.clientX)); }
  function up(e){ if(drag.current===e.pointerId) drag.current=null; }
  function key(e){ const d={ArrowRight:step,ArrowUp:step,ArrowLeft:-step,ArrowDown:-step}[e.key]; if(d!=null){ e.preventDefault(); onChange(clamp((unset?min:value)+d)); } }
  const track={position:'absolute',left:0,top:17,height:6,borderRadius:3};
  return <div ref={ref} role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={unset?undefined:value} data-noswipe
    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}
    style={{position:'relative',height:40,touchAction:'none',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none',WebkitTapHighlightColor:'transparent',...style}}>
    <div style={{...track,right:0,background:C.line}}/>
    {!unset&&<div style={{...track,width:`${pct*100}%`,background:col}}/>}
    <div style={{position:'absolute',left:`calc(${pct*100}% - 14px)`,top:6,width:28,height:28,borderRadius:14,background:'#fff',border:`2px solid ${unset?C.mid:col}`,boxShadow:'0 1px 5px rgba(0,0,0,0.22)',boxSizing:'border-box'}}/>
  </div>;
}

function RatingPanel({wine,existingRating,nav,showPro,curr,onRated,onSaveForLater,onStage,onFinish}){
  const [score,setScore]=React.useState(existingRating||0);
  // The first bottle, revisited after scoring it: open on "Your score" (with Continue), not the picker.
  const [saved,setSaved]=React.useState(()=>!!(onFinish&&existingRating>0));
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
      const sd=Handoff.scanResult.get({});
      sd.existingRating=score;
      Handoff.openWine(sd);
    }catch(e){}
    setSaved(true);
    if(onRated) onRated(score);
  }
  // After the score and the optional details: what to learn next, then the ways out.
  if(saved&&next) return <div style={{display:'flex',flexDirection:'column',gap:14}}>
    <KeepLearning wine={wine} nav={nav} showPro={showPro} reveal/>
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
        <div style={{fontSize:17,fontWeight:800,color:C.ink,fontFamily:C.P}}>Rated {score} · {label}</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Saved to My Wines</div>
      </div>
    </div>
    <TastingExtras wine={wine} curr={curr}/>
    {/* Set apart from the optional details above so it doesn't read as one of them. */}
    <div style={{marginTop:10,paddingTop:16,borderTop:`2px solid ${C.line}`}}>
      {onFinish?<Btn primary full onClick={onFinish}>Continue</Btn>:<Btn primary full onClick={()=>setNext(true)}>Finished: what's next?</Btn>}
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
    <TrackSlider label="Rating" min={ParkerScale.MIN} max={100} value={Math.max(score,ParkerScale.MIN)} unset={!(score>0)} onChange={setScore} col={tc}/>
    <div style={{textAlign:'center',minHeight:40}}>
      {score>0?<div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:3}}><span style={{fontSize:34,fontWeight:800,color:tc,fontFamily:C.P,lineHeight:1}}>{score}</span><span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>pts</span></div>
        <span style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P}}>{label}</span>
      </div>:<span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Slide or tap a rating</span>}
    </div>
    <div style={{fontSize:12,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5,opacity:0.8}}>100-point scale: 96+ Extraordinary · 90–95 Outstanding · 80–89 Very good · 70–79 Average · under 70 Below average</div>
    {score>0&&<Btn primary full onClick={commit}>Save rating</Btn>}
    {onSaveForLater&&<div onClick={onSaveForLater} style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Not tasted it yet? Save for later</div>}
  </div>;
}

/* Optional, after a score. Each answer is used (inputs we ask for must teach, personalise or
   guide): "buy again" feeds the Buy again list, WineDNA's "Worth buying again", the sommelier
   script and matching; what they paid feeds Value and their budget; where they had it is shown on
   the wine, searched in My Wines and given to Vinny and the articles written for them. */
function TastingExtras({wine,curr}){
  // After the score, only what's quick to answer: buy again, what they paid and where they had it.
  // Each saves as it changes, so leaving here (or skipping Keep learning) loses nothing; the score
  // itself was saved when they tapped Save rating. A Blind Call guess still records what they
  // noticed (tasted), without asking again here.
  const entry=WineHistory.find(wine)||wine;
  const [paid,setPaid]=React.useState(()=>entry.price_paid&&entry.price_paid.amount?String(entry.price_paid.amount):'');
  const [where,setWhere]=React.useState(()=>entry.where_had||'');
  const [again,setAgain]=React.useState(entry.buy_again===true);
  const save=patch=>{ const e=WineHistory.find(wine); if(e) WineHistory.setTasting(e.name,e.vintage,patch); };
  React.useEffect(()=>{ const t=ScanFlow.tastedFromBlindCall(entry); if(!entry.tasted&&t&&Object.keys(t).length) save({tasted:t}); },[]);
  const lab={fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,marginBottom:5};
  const box={display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:10,border:`1.5px solid ${C.line}`,background:C.white};
  const field={flex:1,minWidth:0,border:'none',outline:'none',fontSize:16,fontFamily:C.P,color:C.ink,background:'transparent'};
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
      <div style={box}>
        <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{curr.base}</span>
        <input inputMode="decimal" placeholder="0" value={paid} aria-label="What you paid"
          onChange={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); setPaid(v); const n=Number(v); save({price_paid:n>0?{amount:n,code:curr.code}:null}); }}
          style={field}/>
      </div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4}}>Sets your usual spend and shows which bottles are good value for you.</div>
    </div>
    <div>
      <div style={lab}>Where did you have it? (optional)</div>
      <div style={box}>
        <input value={where} maxLength={80} placeholder="A restaurant, a shop, a friend's…" aria-label="Where did you have it"
          onChange={e=>{ setWhere(e.target.value); save({where_had:e.target.value.trim()||null}); }}
          style={field}/>
      </div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4}}>Shown on the wine and searchable in My Wines, so you can find it again. Vinny remembers it too.</div>
    </div>
  </div>;
}

/* "Keep learning": LearnNext's tiles for this wine (its type's basics, region, grape, the next
   beginner article, unread articles about it). Locked ones open the Pro sheet. */
function KeepLearning({wine,nav,showPro,intro,reveal}){
  const tiles=React.useMemo(()=>LearnNext.forWine(wine),[wine&&wine.name]);
  // Arriving here from the bottom of the rating (or Save for later) leaves the page scrolled
  // down; with `reveal` it brings its own first line to the top of the scrolling area.
  const root=React.useRef(null);
  React.useLayoutEffect(()=>{
    const el=root.current, box=el&&el.closest('.sc-scroll'); if(!reveal||!box) return;
    box.scrollTop=Math.max(0,el.getBoundingClientRect().top-box.getBoundingClientRect().top+box.scrollTop-16);
  },[]);
  const [busy,setBusy]=React.useState(null);
  const startQuiz=cfg=>{ Handoff.quiz.set(cfg); nav('quiz'); };
  function open(t){
    if(busy) return;
    if(t.locked){ if(showPro) showPro(t.locked); return; }
    if(t.kind==='topic') return startQuiz(t.config);
    if(t.kind==='region'){ setBusy(t.key); RegionQuizBank.load(t.region,()=>{ setBusy(null); startQuiz({mode:'region',region:t.region}); }); return; }
    if(t.kind==='grape'){ setBusy(t.key); getGrapeQuiz(t.grape,qs=>{ setBusy(null); if(qs&&qs.length) startQuiz({mode:'grape',grape:t.grape,questions:qs}); }); return; }
    if(t.kind==='onramp'){ Handoff.onRampIdx.set(String(t.idx)); nav('article'); return; }
    if(t.kind==='article'){ Handoff.genArticle.set(t.stub); nav('gen-article'); return; }
    nav('profile');
  }
  return <div ref={root} style={{display:'flex',flexDirection:'column',gap:10}}>
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
  const played=ScanFlow.blindPlayed(wine);
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
function CardDeck({deckStyle,wine,gen,loading,match,curr,scanData,existingRating,nav,showPro,onRated,onSaveForLater,onBlindCall,firstScan,onFinish}){
  const cards=React.useMemo(()=>buildCards({match}),[match&&match.tone,match&&match.verdict]);
  const [finishStage,setFinishStage]=React.useState('rate');
  // "Learn more about this wine" is written the first time the deck opens, then kept on the phone.
  const [deep,setDeep]=React.useState(()=>WineDeep.get(wine));
  const [deepLoading,setDeepLoading]=React.useState(false);
  React.useEffect(()=>{ if(deep||!wine||!wine.name) return; let live=true; setDeepLoading(true);
    WineDeep.load(wine,match,d=>{ if(!live) return; setDeep(d); setDeepLoading(false); }); return()=>{ live=false; }; },[wine&&wine.name,wine&&wine.vintage]);
  const facts=React.useMemo(()=>WineDeep.facts(wine),[wine&&wine.name,wine&&wine.vintage]);
  const ctx={wine,gen,loading,match,curr,scanData,onBlindCall,finishStage,firstScan,deep,deepLoading,facts,nav,showPro,
    finish:()=><>
      {firstScan&&finishStage==='rate'&&<div style={{marginBottom:16}}><MatchComingSoon wine={wine} compact/></div>}
      <RatingPanel wine={wine} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr} onRated={onRated} onSaveForLater={existingRating?null:onSaveForLater} onStage={setFinishStage} onFinish={onFinish}/>
    </>};
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
const _FINISH_HEAD={rate:null,saved:{eyebrow:'Your rating',icon:'check'},next:{eyebrow:'Keep learning',icon:'book'}};
function CardShell({card,children,ctx,style,active}){
  const isFinish=card.kind==='finish';
  const head=(isFinish&&ctx&&_FINISH_HEAD[ctx.finishStage])||card;
  // Long text (a producer story at Extra large) scrolls inside the card; a fade at the bottom
  // says there's more, since the scrollbar is hidden.
  const body=React.useRef(null);
  const [more,setMore]=React.useState(false);
  const check=React.useCallback(()=>{ const el=body.current; if(el) setMore(el.scrollHeight-el.scrollTop-el.clientHeight>6); },[]);
  // A card always opens at its top: when it comes to the top of the deck (going back to one you'd
  // scrolled included), and when the last card moves on from rating to Your score to Keep learning.
  React.useLayoutEffect(()=>{ const el=body.current; if(el&&active!==false) el.scrollTop=0; check(); },[active,ctx&&ctx.finishStage,check]);
  React.useEffect(()=>{ check(); const el=body.current; if(!el||typeof ResizeObserver==='undefined') return;
    const ro=new ResizeObserver(check); ro.observe(el); if(el.firstElementChild) ro.observe(el.firstElementChild); return()=>ro.disconnect(); },[check]);
  return <div style={{background:C.white,borderRadius:22,border:`1px solid ${C.line}`,boxShadow:'0 6px 22px rgba(0,0,0,0.08)',display:'flex',flexDirection:'column',overflow:'hidden',...style}}>
    <div style={{height:5,background:card.accent,flexShrink:0}}/>
    <div style={{padding:'16px 18px 6px',display:'flex',alignItems:'center',gap:9,flexShrink:0}}>
      <div style={{width:30,height:30,borderRadius:9,background:card.soft,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n={head.icon} sz={16} col={card.accent}/></div>
      <span style={{fontSize:12.5,fontWeight:700,color:card.accent,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>{head.eyebrow}</span>
    </div>
    {/* Scrolls up and down only: the deck sets touch-action:pan-y (.sc-swipe), so the browser
        takes vertical drags for scrolling and leaves sideways drags to the swipe. */}
    <div style={{position:'relative',flex:1,minHeight:0,display:'flex',flexDirection:'column'}}>
      <div ref={body} onScroll={check} className="sc-scroll" style={{padding:'8px 18px 18px',overflowX:'hidden',overflowY:'auto',flex:1,minHeight:0}}>
        <div>{isFinish?ctx.finish():children}</div>
      </div>
      {more&&<div aria-hidden="true" style={{position:'absolute',left:0,right:0,bottom:0,height:44,pointerEvents:'none',background:`linear-gradient(rgba(255,255,255,0),${C.white})`}}/>}
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
    // Phones can send the tap from a swipe's lift-off well after the swipe ends; swallow it for
    // long enough that a swipe finishing over a link ("Save for later") doesn't press it.
    justDragged.current=true; setTimeout(()=>{ justDragged.current=false; },400);
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
          <CardShell card={cc} ctx={ctx} style={{height:'100%'}} active={isTop}>
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

Object.assign(window,{TrackSlider,ScanCardsScreen});
