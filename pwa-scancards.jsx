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
function useScanContent(wine,matchPct,dna){
  const [gen,setGen]=React.useState(null);
  const [loading,setLoading]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!wine.name) return;
    const key='vinterest_scancards_v4_'+(wine.name||'').replace(/\s/g,'_')+'_'+(wine.vintage||'nv')+'_'+(matchPct??'x');
    const cached=localStorage.getItem(key);
    if(cached){ try{ setGen(JSON.parse(cached)); return; }catch(e){} }
    if(!window.claude||!window.claude.complete) return;
    setLoading(true);
    const w=wine;
    const dnaLine=dna?`My WineDNA for ${(w.type||'red')}s, from ${dna.count} rated wine(s): top grape ${dna.topGrape||'none yet'}, top region ${dna.topRegion||'none yet'}, average rating I give this type is ${dna.avgRating}/100.`:`I have no rating history for ${(w.type||'red')}s yet.`;
    const matchLine=matchPct!=null?`Their computed match score for this exact bottle is ${matchPct}/100.`:'No match score is available yet.';
    const agingFact=_agingFactFor(w);
    const agingLine=agingFact?`REFERENCE AGING FACTS (use verbatim, do not alter the numbers): ${agingFact}`:'REFERENCE AGING FACTS: none available for this wine\u2019s classification \u2014 do not state specific aging durations you are not certain of.';
    const prompt=
      'You are a warm, knowledgeable sommelier writing quick-hit cards for a wine app. '+
      'Wine: '+(w.name||'')+(w.vintage&&w.vintage!=='NV'&&w.vintage!==0?' '+w.vintage:'')+'. '+
      'Type: '+(w.type||'red')+'. Region: '+(w.region||'')+((w.sub_region)?' ('+w.sub_region+')':'')+', '+(w.country||'')+'. '+
      'Producer: '+(w.producer||'unknown')+'. '+
      'Grapes: '+((w.grapes||[]).join(', ')||'unknown')+'. '+
      'Tasting notes: '+((w.tasting_notes||[]).join(', ')||'n/a')+'. '+
      dnaLine+' '+matchLine+' '+agingLine+' '+
      'Return ONLY valid JSON, no markdown, all sentences concrete and specific to THIS wine (no generic filler), and NO numbers/percentages/decimals anywhere: '+
      '{'+
      '"fact":"one genuinely surprising, memorable fact about this wine, its producer, grape, or region (max 28 words)",'+
      '"fit":"one vivid sentence on the FLAVOR/STYLE reasons this suits their palate — texture, body, fruit, oak, tannin, acidity. If my WineDNA above has a top grape or region, explicitly tie this wine to it by name (e.g. building on my known love of that grape/region) — never invent a grape or region I do not have in my profile (max 26 words)",'+
      '"caution":"one specific, practical thing worth knowing before or while drinking THIS bottle — e.g. decanting, serving temperature, food pairing risk, or how it will develop with age. Do NOT use hedging phrases like \\"if you prefer\\" or \\"if you like\\" — you already know their taste profile from the data above, so speak to them directly and confidently. If the match score is high, this should read as a helpful tip for someone who will enjoy the wine, never as a warning that it might not suit them (max 24 words)",'+
      '"origin":"one sentence painting the place this comes from — landscape, climate or culture (max 26 words)",'+
      '"region_style":"one sentence on what makes wines from here distinctive (max 24 words)",'+
      '"estate":"one sentence on the producer/winemaker and the estate\'s history or reputation — if producer is unknown, describe the typical winemaking approach in this region instead (max 26 words)",'+
      '"talk":["three SHORT quotable phrases (each max 12 words) a drinker could say out loud to sound clued-in about this exact wine"],'+
      '"fact2":"one specific, memorable aging/classification/production fact that helps this bottle make sense. If REFERENCE AGING FACTS are given below, you MUST use those exact figures verbatim (paraphrase the wording only, never change the numbers) — do not invent different aging periods. If no reference facts are given for this wine\'s classification, give a general production fact that does NOT state specific aging durations you are not certain of (max 22 words)",'+
      '"matchNote":"one sentence giving an honest confidence verdict on THIS PAIRING, grounded in the WineDNA facts above — if I have a top grape/region for this type, name it explicitly and say whether this bottle aligns with or departs from it; never invent a grape/region I do not have (max 24 words). Never mention flavor, texture, tannin, oak, or acidity — that is covered elsewhere."'+
      '}';
    window.claude.complete({messages:[{role:'user',content:prompt}]})
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
  },[wine&&wine.name,wine&&wine.vintage,matchPct,dna&&dna.topGrape,dna&&dna.topRegion]);
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
/* Rating-weighted top grape/region for this wine's type, straight from rating history — used to ground
   personalization on the scan cards so it can never contradict what WineDNA actually shows. */
function _dnaSnapshot(type){
  const rated=WineHistory.getAll().filter(w=>w.rating>0&&(w.type||'red').toLowerCase().replace('é','e')===type);
  if(!rated.length) return null;
  const gCount={},rCount={};
  rated.forEach(w=>{const wt=Math.max(w.rating||55,5);(w.grapes||[]).forEach(g=>{if(g)gCount[g]=(gCount[g]||0)+wt;});if(w.region)rCount[w.region]=(rCount[w.region]||0)+wt;});
  const topGrape=Object.entries(gCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const topRegion=Object.entries(rCount).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
  const avgRating=Math.round(rated.reduce((s,w)=>s+w.rating,0)/rated.length);
  return {topGrape,topRegion,count:rated.length,avgRating};
}
function ScanShimmer({col}){
  return <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
    <span style={{width:11,height:11,borderRadius:6,border:`2px solid ${col}33`,borderTopColor:col,animation:'scSpin .8s linear infinite'}}/>
    <span style={{fontSize:14,color:col,fontFamily:C.P,fontStyle:'italic',opacity:.8}}>Pouring the details…</span>
  </span>;
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
function ScanCardsScreen({nav,back}){
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const existingRating=React.useMemo(()=>{
    if(!wine) return 0;
    const saved=WineHistory.getAll().find(w=>w.name===wine.name&&String(w.vintage)===String(wine.vintage));
    return (saved&&saved.rating)||scanData.existingRating||0;
  },[wine?.name,wine?.vintage]);
  const isDemo=scanData.demo===true;
  const scanReason=scanData.reason||'';

  const deckStyle=useDeckStyle();
  const curr=React.useMemo(()=>Regional.current(),[]);

  // intent gate — remembered per scan so returning doesn't re-ask
  const intentKey='vinterest_scan_intent_'+((wine&&wine.name)||'').replace(/\s/g,'_')+'_'+((wine&&wine.vintage)||'nv');
  const [intent,setIntent]=React.useState(()=>{
    if(existingRating>0) return 'tasted';
    return sessionStorage.getItem(intentKey)||null;
  });
  function pickIntent(v){ setIntent(v); try{ sessionStorage.setItem(intentKey,v); }catch(e){} if(wine) WineHistory.setScanIntent(wine.name,wine.vintage,v); }
  const canRate=intent==='tasting'||intent==='tasted';

  // duplicate scan gate — a wine you've already rated (exact vintage match) can skip straight to re-rating
  // instead of walking the full card sequence again; remembered per scan so returning doesn't re-ask.
  const dupKey='vinterest_scan_dup_'+((wine&&wine.name)||'').replace(/\s/g,'_')+'_'+((wine&&wine.vintage)||'nv');
  const [duplicateChoice,setDuplicateChoice]=React.useState(()=>existingRating>0?(sessionStorage.getItem(dupKey)||null):'na');
  function pickDuplicate(v){ setDuplicateChoice(v); try{ sessionStorage.setItem(dupKey,v); }catch(e){} }

  const matchPct=React.useMemo(()=>{
    if(!wine) return null;
    const dna=calcMatchScore(wine,WineHistory.getAll());
    if(dna!=null) return dna;
    const conf=scanData.confidence;
    return conf?Math.round(Math.min(0.98,conf)*100):null;
  },[wine&&wine.name,intent]);
  const dnaSnapshot=React.useMemo(()=>wine?_dnaSnapshot((wine.type||'red').toLowerCase().replace('é','e')):null,[wine&&wine.name]);
  const {gen,loading}=useScanContent(wine,matchPct,dnaSnapshot);

  // track scan immediately (even before rating)
  React.useEffect(()=>{ if(wine&&!isDemo) WineHistory.track(wine); },[wine&&wine.name,wine&&wine.vintage]);

  if(!wine){
    return <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:32}}>
      <Icon n="camera" sz={40} col={C.mid}/>
      <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,textAlign:'center'}}>{isDemo&&scanReason==='no_wine_label'?'No label detected':'Nothing scanned yet'}</div>
      <div style={{fontSize:14,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>Point the camera straight at a wine label and hold steady.</div>
      <Btn primary onClick={()=>nav('camera')}>Try Again</Btn>
    </div>;
  }

  return <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
    <ScanHeader wine={wine} nav={nav} back={back}/>
    {isDemo&&<div style={{background:'#FFF3CD',borderBottom:'1px solid #FFE082',padding:'8px 16px',fontSize:13,color:'#7A5200',fontFamily:C.P,flexShrink:0}}>Demo data — add ANTHROPIC_API_KEY to scan for real.</div>}
    {!intent
      ? <IntentGate wine={wine} onPick={pickIntent} nav={nav}/>
      : existingRating>0&&!duplicateChoice
        ? <DuplicateGate wine={wine} existingRating={existingRating} onPick={pickDuplicate} nav={nav}/>
        : <CardDeck key={deckStyle} deckStyle={deckStyle} wine={wine} gen={gen} loading={loading}
            matchPct={matchPct} curr={curr} scanData={scanData} intent={intent} canRate={canRate}
            existingRating={existingRating} dna={dnaSnapshot} startAtEnd={duplicateChoice==='skip'} nav={nav}/>}
    <style>{`
      @keyframes scSpin{to{transform:rotate(360deg)}}
      @keyframes scSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes scFade{from{opacity:0}to{opacity:1}}
      @keyframes scPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
      .sc-scroll::-webkit-scrollbar{display:none}
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
      <div style={{fontSize:12.5,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{[wine.vintage&&wine.vintage!==0?wine.vintage:'NV',wine.region,wine.country].filter(Boolean).join(' · ')}</div>
    </div>
    <div onClick={()=>nav('detail')} style={{flexShrink:0,display:'flex',alignItems:'center',gap:4,padding:'7px 12px',borderRadius:20,background:C.offWhite,border:`1px solid ${C.line}`,cursor:'pointer',whiteSpace:'nowrap'}}>
      <span style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P}}>Details</span>
      <Icon n="chevron" sz={12} col={C.mid}/>
    </div>
  </div>;
}

/* ── intent gate ── */
function IntentGate({wine,onPick,nav}){
  const opts=[
    {k:'checking',icon:'compass',t:'Just checking the match',s:'Deciding whether to buy or order it — no rating yet.'},
    {k:'tasting',icon:'wine',t:'About to drink it',s:'Walk me through it, then let me rate after tasting.'},
    {k:'tasted',icon:'star',t:'Already had a sip',s:'I want to talk about it — and rate what I tasted.'},
  ];
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'22px 20px 28px',display:'flex',flexDirection:'column',animation:'scFade .25s ease'}}>
    <div style={{fontSize:13,fontWeight:700,color:C.cr,letterSpacing:'0.1em',textTransform:'uppercase',fontFamily:C.P}}>Matched</div>
    <div style={{fontSize:23,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginTop:4}}>How are you meeting<br/>this wine?</div>
    <div style={{fontSize:14.5,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginTop:8}}>So we only ask you to rate a wine you've actually tasted.</div>
    <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:22}}>
      {opts.map(o=>(
        <div key={o.k} onClick={()=>onPick(o.k)} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 16px',borderRadius:16,background:C.white,border:`1.5px solid ${C.line}`,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.05)',transition:'transform .12s'}} onMouseDown={e=>e.currentTarget.style.transform='scale(0.985)'} onMouseUp={e=>e.currentTarget.style.transform='none'} onMouseLeave={e=>e.currentTarget.style.transform='none'}>
          <div style={{width:46,height:46,borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Icon n={o.icon} sz={22} col={C.cr}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16.5,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{o.t}</div>
            <div style={{fontSize:13.5,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:3}}>{o.s}</div>
          </div>
          <Icon n="chevron" sz={16} col={C.mid}/>
        </div>
      ))}
    </div>
    <div onClick={()=>nav('detail')} style={{textAlign:'center',marginTop:22,fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Skip to full details</div>
  </div>;
}

/* ── duplicate-scan gate: you've rated this exact bottle before ── */
function DuplicateGate({wine,existingRating,onPick,nav}){
  const r=44,circ=2*Math.PI*r;
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'22px 20px 28px',display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',animation:'scFade .25s ease'}}>
    <div style={{position:'relative',width:120,height:120,marginTop:6}}>
      <svg width="120" height="120" viewBox="0 0 104 104" style={{transform:'rotate(-90deg)'}}>
        <circle cx="52" cy="52" r={r} fill="none" stroke={C.line} strokeWidth="9"/>
        <circle cx="52" cy="52" r={r} fill="none" stroke={C.green} strokeWidth="9" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-existingRating/100)}/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:28,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{existingRating}</div>
        <div style={{fontSize:10,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>pts</div>
      </div>
    </div>
    <div style={{fontSize:23,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginTop:16}}>You've already scanned<br/>this one</div>
    <div style={{fontSize:14.5,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginTop:8}}>You rated {_wineTitle(wine)} a {existingRating} last time. Want the quick path, or the full rundown again?</div>
    <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:22,width:'100%'}}>
      <div onClick={()=>onPick('skip')} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 16px',borderRadius:16,background:C.white,border:`1.5px solid ${C.line}`,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
        <div style={{width:46,height:46,borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon n="star" sz={22} col={C.cr}/>
        </div>
        <div style={{flex:1,minWidth:0,textAlign:'left'}}>
          <div style={{fontSize:16.5,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>Just re-rate it</div>
          <div style={{fontSize:13.5,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:3}}>Skip straight to rating — no need to see the cards again.</div>
        </div>
        <Icon n="chevron" sz={16} col={C.mid}/>
      </div>
      <div onClick={()=>onPick('full')} style={{display:'flex',alignItems:'center',gap:14,padding:'16px 16px',borderRadius:16,background:C.white,border:`1.5px solid ${C.line}`,cursor:'pointer',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
        <div style={{width:46,height:46,borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Icon n="compass" sz={22} col={C.cr}/>
        </div>
        <div style={{flex:1,minWidth:0,textAlign:'left'}}>
          <div style={{fontSize:16.5,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>Go through it again</div>
          <div style={{fontSize:13.5,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:3}}>See the match, tasting notes and everything else fresh.</div>
        </div>
        <Icon n="chevron" sz={16} col={C.mid}/>
      </div>
    </div>
    <div onClick={()=>nav('detail')} style={{textAlign:'center',marginTop:22,fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Skip to full details</div>
  </div>;
}

/* ── card content model ── */
function buildCards({wine,gen,matchPct,curr,scanData,intent}){
  const type=(wine.type||'red').toLowerCase().replace('é','e');
  const isRed=type==='red';
  const cards=[];

  cards.push({key:'match',accent:C.green,soft:C.greenBg,icon:'compass',eyebrow:'Your match',kind:'match'});
  cards.push({key:'fit',accent:C.green,soft:C.greenBg,icon:'heart',eyebrow:matchPct!=null&&matchPct>=70?'Why you\'ll love it':'Why it could click',kind:'gen',field:'fit'});
  cards.push({key:'caution',accent:C.amber,soft:C.amberBg,icon:'message',eyebrow:'Heads up',kind:'gen',field:'caution'});
  cards.push({key:'origin',accent:C.cr,soft:C.crSoft,icon:'globe',eyebrow:'Where it\'s from',kind:'origin'});
  cards.push({key:'fact',accent:'#9B6B00',soft:'#FBF3E0',icon:'star',eyebrow:'Did you know',kind:'gen',field:'fact'});
  cards.push({key:'taste',accent:C.ink,soft:C.offWhite,icon:'wine',eyebrow:'While you taste',kind:'taste'});
  cards.push({key:'talk',accent:C.cr,soft:C.crSoft,icon:'message',eyebrow:'Sound clued-in',kind:'talk'});
  cards.push({key:'value',accent:'#6B2D8B',soft:'#F3ECF8',icon:'cart',eyebrow:'Price check',kind:'value'});
  cards.push({key:'finish',accent:C.cr,soft:C.crSoft,icon:intent==='checking'?'heart':'star',eyebrow:intent==='checking'?'Save it':'Rate it',kind:'finish'});
  return cards;
}

/* renders the body of one card — always at full detail; there is no separate expand/collapse mode, everything ships on the main screen. */
function CardFace({card,ctx}){
  const expanded=true;
  const {wine,gen,loading,matchPct,curr,scanData,intent,dna}=ctx;
  const a=card.accent;
  const P=C.P;
  const H=({children})=><div style={{fontSize:expanded?24:20,fontWeight:800,color:C.ink,fontFamily:P,lineHeight:1.2,letterSpacing:'-0.01em'}}>{children}</div>;
  const Body=({children,big})=><div style={{fontSize:big?(expanded?20:18):(expanded?17:16),color:C.ink2,fontFamily:P,lineHeight:1.55}}>{children}</div>;

  if(card.kind==='match'){
    const pct=matchPct;
    const verdict=pct==null?'New for your palate':pct>=90?'A near-perfect match':pct>=78?'A strong match':pct>=63?'A solid match, worth it':pct>=48?'Worth a try':pct>=32?'A bit of a stretch':'Outside your usual';
    const r=52,circ=2*Math.PI*r,off=circ*(1-(pct||0)/100);
    const dnaFallback=dna&&dna.topGrape?`Your ${(wine.type||'red')}s lean ${dna.topGrape}${dna.topRegion?' from '+dna.topRegion:''} — ${(wine.grapes||[]).some(g=>(g||'').toLowerCase()===dna.topGrape.toLowerCase())?'this bottle lines up with that.':'this one branches out a bit from that.'}`:'Scan and rate a few more to sharpen this.';
    return <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,textAlign:'center'}}>
      <div style={{position:'relative',width:150,height:150}}>
        <svg width="150" height="150" viewBox="0 0 130 130" style={{transform:'rotate(-90deg)'}}>
          <circle cx="65" cy="65" r={r} fill="none" stroke={C.line} strokeWidth="10"/>
          <circle cx="65" cy="65" r={r} fill="none" stroke={a} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={pct==null?circ:off} style={{transition:'stroke-dashoffset 1s cubic-bezier(.34,1.1,.64,1)'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontSize:40,fontWeight:800,color:a,fontFamily:P,lineHeight:1}}>{pct!=null?pct:'—'}<span style={{fontSize:18,fontWeight:700}}>%</span></div>
          <div style={{fontSize:11,fontWeight:700,color:C.mid,fontFamily:P,letterSpacing:'0.12em',textTransform:'uppercase',marginTop:2}}>match</div>
        </div>
      </div>
      <H>{verdict}</H>
      <Body big>{loading&&!gen?<ScanShimmer col={a}/>:(gen&&gen.matchNote)||dnaFallback}</Body>
      {expanded&&<div style={{width:'100%',marginTop:4,padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`,textAlign:'left'}}>
        <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>How we got this</div>
        <div style={{fontSize:14.5,color:C.ink2,fontFamily:P,lineHeight:1.55}}>We compare this wine's body, tannins, acidity and sweetness against the average of the {wine.type||'red'}s you've rated highly{dna&&dna.topGrape?` — right now that's mostly ${dna.topGrape}${dna.topRegion?' from '+dna.topRegion:''}`:''}.</div>
      </div>}
    </div>;
  }

  if(card.kind==='gen'){
    const val=gen&&gen[card.field];
    return <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <H>{card.field==='fact'?'A little story':card.field==='fit'?'This is your kind of bottle':'One thing to know'}</H>
      <Body big>{loading&&!val?<ScanShimmer col={a}/>:(val||'—')}</Body>
      {expanded&&card.field==='fit'&&<AttrReasons wine={wine} accent={a}/>}
      {expanded&&card.field==='caution'&&<div style={{fontSize:14.5,color:C.mid,fontFamily:C.P,lineHeight:1.55}}>{matchPct!=null&&matchPct>=63?'Just a tip to get the most out of it — not a reason to hesitate.':'Worth knowing so nothing catches you off guard.'}</div>}
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

  if(card.kind==='taste'){
    const cues=[];
    const b=wine.body??0.65,tn=wine.tannins??0.55,ac=wine.acidity??0.6,tx=wine.texture,sw=wine.sweetness??0.1;
    cues.push({l:'Body',v:lvl(b,'Light & lithe','Medium-weight','Full & mouth-coating'),tip:'Notice how heavy it feels — does it linger or refresh?'});
    if((wine.type||'red').toLowerCase().replace('é','e')==='red') cues.push({l:'Tannins',v:lvl(tn,'Silky, low grip','Gentle grip','Firm, drying grip'),tip:'That drying feel on your gums and cheeks — is it soft or grippy?'});
    cues.push({l:'Acidity',v:lvl(ac,'Round & mellow','Fresh','Zippy & mouth-watering'),tip:'Does it make you salivate? That\'s acidity.'});
    if(tx!=null) cues.push({l:'Oak / texture',v:lvl(tx,'Clean & steely','Subtle','Creamy, vanilla, toast'),tip:'Any butter, vanilla or toast? That\'s oak.'});
    if(sw>=0.2) cues.push({l:'Sweetness',v:lvl(sw,'Dry','Off-dry','Noticeably sweet'),tip:'Sense of sugar on the tip of your tongue.'});
    const notes=(wine.tasting_notes||[]).slice(0,4);
    return <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <H>What to look for</H>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {cues.slice(0,4).map((c,i)=>(
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

  if(card.kind==='talk'){
    const lines=(gen&&Array.isArray(gen.talk)&&gen.talk.length)?gen.talk:[
      `A ${wine.type||'red'} that really speaks of ${wine.region||wine.country}.`,
      (wine.grapes&&wine.grapes[0])?`Lovely example of ${wine.grapes[0]}.`:'Nicely made, plenty of character.',
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

function AttrReasons({wine,accent}){
  const users=WineHistory.getAll().filter(w=>w.rating>0);
  const type=(wine.type||'red').toLowerCase().replace('é','e');
  const same=users.filter(w=>(w.type||'red').toLowerCase().replace('é','e')===type);
  const top=[...same].sort((x,y)=>(y.rating||0)-(x.rating||0)).slice(0,3).map(w=>w.name).filter(Boolean);
  return <div style={{padding:'12px 14px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
    <div style={{fontSize:13,fontWeight:700,color:accent,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>Because you rated</div>
    <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{top.length?top.join(', ')+'.':'Keep rating wines and this gets personal.'}</div>
  </div>;
}

function ValueFace({wine,curr,scanData,accent,soft,expanded}){
  const [pd,setPd]=React.useState(null);
  const [loading,setLoading]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!wine.name) return;
    setLoading(true);
    fetchRetailEstimate(wine,curr).then(d=>setPd(d)).catch(()=>{}).finally(()=>setLoading(false));
  },[wine&&wine.name,curr.code]);
  const fmt=n=>n!=null?curr.base+Number(n).toLocaleString():'—';
  const restaurant=scanData.listPrice||scanData.restaurantPrice||null; // present when opened from a wine list
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
      {pd.tier&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Price tier</span>
        <span style={{fontSize:14,fontWeight:700,color:accent,fontFamily:C.P,textTransform:'capitalize'}}>{String(pd.tier).replace('-',' ')}</span>
      </div>}
      {expanded&&pd.note&&<div style={{fontSize:14.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55,padding:'11px 13px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>{pd.note}</div>}
    </>:<div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Price estimate unavailable for this bottle.</div>}
  </div>;
}

/* ── finish / rating card ── */
function FinishFace({wine,intent,existingRating,nav,accent}){
  const canRate=intent==='tasting'||intent==='tasted';
  const alreadyRated=existingRating>0;
  const [confirmStep,setConfirmStep]=React.useState(alreadyRated);
  const [score,setScore]=React.useState(existingRating||0);
  const [saved,setSaved]=React.useState(existingRating>0);
  const label=score===0?'':score<=20?'Not for me':score<=40?"It's ok":score<=60?'Good':score<=80?'Really good':'Exceptional';
  function commit(){
    if(!score||!wine) return;
    if(existingRating>0) WineHistory.rate(wine.name,wine.vintage,score);
    else WineHistory.add(wine,score);
    try{ if(window.XPSystem) XPSystem.awardAndToast([{type:'rate'}]); }catch(e){}
    // carry the new rating into the session snapshot so Detail/list screens agree immediately
    try{
      const sd=JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}');
      sd.existingRating=score;
      sessionStorage.setItem('vinterest_scan_result',JSON.stringify(sd));
    }catch(e){}
    setSaved(true);
  }
  if(!canRate){
    return <div style={{display:'flex',flexDirection:'column',gap:16,alignItems:'center',textAlign:'center'}}>
      <div style={{width:56,height:56,borderRadius:28,background:C.crSoft,border:`1px solid ${C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="check" sz={26} col={C.cr}/></div>
      <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>Saved to My Wines</div>
      <div style={{fontSize:15.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>When you pour it, come back and rate it in a tap — that's what sharpens your matches.</div>
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',marginTop:4}}>
        <Btn primary full onClick={()=>nav('detail')}>See full details →</Btn>
        <Btn full onClick={()=>nav('mywines')}>Go to My Wines</Btn>
      </div>
    </div>;
  }
  if(confirmStep){
    const r=52,circ=2*Math.PI*r;
    return <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16,textAlign:'center'}}>
      <div style={{position:'relative',width:150,height:150}}>
        <svg width="150" height="150" viewBox="0 0 130 130" style={{transform:'rotate(-90deg)'}}>
          <circle cx="65" cy="65" r={r} fill="none" stroke={C.line} strokeWidth="10"/>
          <circle cx="65" cy="65" r={r} fill="none" stroke={C.green} strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-existingRating/100)}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{fontSize:40,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{existingRating}<span style={{fontSize:16,fontWeight:700}}> pts</span></div>
          <div style={{fontSize:9.5,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:2,textAlign:'center',padding:'0 8px',lineHeight:1.2}}>Previous<br/>rating</div>
        </div>
      </div>
      <div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.25}}>You already rated this one</div>
      <div style={{fontSize:15.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>Leave your score for {_wineTitle(wine)} as is, or rate it again.</div>
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',marginTop:4}}>
        <Btn primary full onClick={()=>nav('detail')}>Leave it at {existingRating} — see full details →</Btn>
        <Btn full onClick={()=>setConfirmStep(false)}>Re-rate it</Btn>
      </div>
    </div>;
  }
  return <div style={{display:'flex',flexDirection:'column',gap:16}}>
    <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,textAlign:'center'}}>How was it?</div>
    <div style={{display:'flex',gap:6}}>
      {[20,40,60,80,100].map(p=>(
        <div key={p} onClick={()=>{setScore(p);setSaved(false);}} style={{flex:1,padding:'9px 2px',borderRadius:11,border:`1.5px solid ${score===p?C.cr:C.line}`,background:score===p?C.cr:C.white,textAlign:'center',cursor:'pointer',transition:'all .12s'}}>
          <span style={{fontSize:17,fontWeight:700,color:score===p?'#fff':C.mid,fontFamily:C.P}}>{p}</span>
        </div>
      ))}
    </div>
    <input type="range" min="0" max="100" step="1" value={score} onChange={e=>{setScore(Number(e.target.value));setSaved(false);}} style={{width:'100%',accentColor:C.cr,cursor:'pointer'}}/>
    <div style={{textAlign:'center',minHeight:40}}>
      {score>0?<div style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'baseline',gap:3}}><span style={{fontSize:34,fontWeight:800,color:C.cr,fontFamily:C.P,lineHeight:1}}>{score}</span><span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>pts</span></div>
        <span style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P}}>{label}</span>
      </div>:<span style={{fontSize:14.5,color:C.mid,fontFamily:C.P}}>Slide or tap a score</span>}
    </div>
    {score>0&&!saved&&<Btn primary full onClick={commit}>Save rating</Btn>}
    {saved&&<><div style={{textAlign:'center',fontSize:15,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ Saved to My Wines</div><Btn primary full onClick={()=>nav('detail')}>See full details →</Btn></>}
    {!saved&&score===0&&<div onClick={()=>nav('detail')} style={{textAlign:'center',fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Skip rating — see full details →</div>}
  </div>;
}

/* ── the deck (three interaction styles) ── */
function CardDeck({deckStyle,wine,gen,loading,matchPct,curr,scanData,intent,canRate,existingRating,dna,startAtEnd,nav}){
  const cards=React.useMemo(()=>buildCards({wine,gen,matchPct,curr,scanData,intent}),[wine&&wine.name,gen,matchPct,intent]);
  const ctx={wine,gen,loading,matchPct,curr,scanData,intent,dna};
  const [idx,setIdx]=React.useState(()=>startAtEnd?Math.max(0,cards.length-1):0);

  const total=cards.length;
  const go=d=>setIdx(i=>Math.max(0,Math.min(total-1,i+d)));

  const common={cards,ctx,intent,existingRating,nav,accent:C.cr};

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
function CardShell({card,children,intent,existingRating,nav,style}){
  const isFinish=card.kind==='finish';
  return <div style={{background:C.white,borderRadius:22,border:`1px solid ${C.line}`,boxShadow:'0 6px 22px rgba(0,0,0,0.08)',display:'flex',flexDirection:'column',overflow:'hidden',...style}}>
    <div style={{height:5,background:card.accent,flexShrink:0}}/>
    <div style={{padding:'16px 18px 6px',display:'flex',alignItems:'center',gap:9,flexShrink:0}}>
      <div style={{width:30,height:30,borderRadius:9,background:card.soft,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n={card.icon} sz={16} col={card.accent}/></div>
      <span style={{fontSize:12.5,fontWeight:700,color:card.accent,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>{card.eyebrow}</span>
    </div>
    <div className="sc-scroll" style={{padding:'8px 18px 18px',overflowY:'hidden',flex:1,minHeight:0}}>
      {isFinish?<FinishFace wine={card._wine} intent={intent} existingRating={existingRating} nav={nav} accent={card.accent}/>:children}
    </div>
  </div>;
}

/* deck style A — swipeable stack */
function SwipeDeck({deck,ctx,idx,setIdx,go,intent,existingRating,nav}){
  const [drag,setDrag]=React.useState({dx:0,dy:0,active:false});
  const start=React.useRef(null);
  const dragRef=React.useRef({dx:0,dy:0});
  const topRef=React.useRef(null);
  const cardRef=React.useRef(null);
  const top=deck[idx];
  const isFinish=top&&top.kind==='finish';
  topRef.current=top;

  React.useEffect(()=>{
    const el=cardRef.current;
    if(!el) return;
    function pt(e){ return e.touches?e.touches[0]:e; }
    function onDown(e){
      if(topRef.current&&topRef.current.kind==='finish') return;
      const p=pt(e);
      start.current={x:p.clientX,y:p.clientY};
      dragRef.current={dx:0,dy:0};
      setDrag({dx:0,dy:0,active:true});
    }
    function onMove(e){
      if(!start.current) return;
      const p=pt(e);
      const dx=p.clientX-start.current.x, dy=p.clientY-start.current.y;
      dragRef.current={dx,dy};
      if(Math.abs(dx)>8||Math.abs(dy)>8) e.preventDefault();
      setDrag({dx,dy,active:true});
    }
    function onUp(){
      if(!start.current) return;
      const {dx}=dragRef.current;
      start.current=null;
      if(dx<-110){ setDrag({dx:0,dy:0,active:false}); setTimeout(()=>go(1),10); return; }
      if(dx>110){ setDrag({dx:0,dy:0,active:false}); setTimeout(()=>go(-1),10); return; }
      setDrag({dx:0,dy:0,active:false});
    }
    el.addEventListener('touchstart',onDown,{passive:true});
    el.addEventListener('touchmove',onMove,{passive:false});
    el.addEventListener('touchend',onUp,{passive:true});
    el.addEventListener('touchcancel',onUp,{passive:true});
    el.addEventListener('mousedown',onDown);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{
      el.removeEventListener('touchstart',onDown);
      el.removeEventListener('touchmove',onMove);
      el.removeEventListener('touchend',onUp);
      el.removeEventListener('touchcancel',onUp);
      el.removeEventListener('mousedown',onDown);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };
  },[idx]);

  return <div style={{flex:1,display:'flex',flexDirection:'column',padding:'8px 16px 14px',minHeight:0}}>
    <div style={{position:'relative',flex:1,minHeight:0}}>
      {deck.map((c,i)=>{
        if(i<idx||i>idx+2) return null;
        const depth=i-idx;
        const isTop=depth===0;
        const tf=isTop?`translate(${drag.dx}px,${drag.dy<0?drag.dy:drag.dy*0.4}px) rotate(${drag.dx*0.04}deg)`:`translateY(${depth*12}px) scale(${1-depth*0.045})`;
        const cc={...c,_wine:ctx.wine};
        return <div key={c.key} ref={isTop?cardRef:undefined}
          style={{position:'absolute',inset:0,zIndex:10-depth,transform:tf,transition:drag.active&&isTop?'none':'transform .3s cubic-bezier(.34,1.1,.64,1)',opacity:depth>1?0:1,touchAction:isTop&&!isFinish?'none':'auto',cursor:isTop&&!isFinish?'grab':'default'}}>
          <CardShell card={cc} intent={intent} existingRating={existingRating} nav={nav} style={{height:'100%'}}>
            <CardFace card={c} ctx={ctx}/>
          </CardShell>
          {isTop&&Math.abs(drag.dx)>40&&!isFinish&&<div style={{position:'absolute',top:24,[drag.dx<0?'right':'left']:24,padding:'6px 14px',borderRadius:10,border:`2.5px solid ${C.mid}`,color:C.mid,fontSize:15,fontWeight:800,fontFamily:C.P,transform:`rotate(${drag.dx<0?12:-12}deg)`,background:'rgba(255,255,255,0.9)',letterSpacing:'0.05em'}}>{drag.dx<0?'NEXT':'BACK'}</div>}
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
function Carousel({cards,ctx,intent,existingRating,nav}){
  return <div className="sc-scroll" style={{flex:1,display:'flex',overflowX:'auto',scrollSnapType:'x mandatory',gap:14,padding:'8px 16px 18px',minHeight:0}}>
    {cards.map(c=>{
      const cc={...c,_wine:ctx.wine};
      return <div key={c.key} style={{scrollSnapAlign:'center',flex:'0 0 86%',maxWidth:360,display:'flex'}}>
        <CardShell card={cc} intent={intent} existingRating={existingRating} nav={nav} style={{width:'100%',minHeight:0}}>
          <CardFace card={c} ctx={ctx}/>
        </CardShell>
      </div>;
    })}
  </div>;
}

/* deck style C — vertical feed */
function Feed({cards,ctx,intent,existingRating,nav}){
  return <div className="sc-scroll" style={{flex:1,overflowY:'auto',padding:'8px 16px 24px',display:'flex',flexDirection:'column',gap:14,minHeight:0}}>
    {cards.map(c=>{
      const cc={...c,_wine:ctx.wine};
      return <div key={c.key} style={{animation:'scPop .3s ease both'}}>
        <CardShell card={cc} intent={intent} existingRating={existingRating} nav={nav}>
          <CardFace card={c} ctx={ctx}/>
        </CardShell>
      </div>;
    })}
  </div>;
}

Object.assign(window,{ScanCardsScreen});
