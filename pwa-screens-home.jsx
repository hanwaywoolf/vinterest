/* Vinterest PWA — Home screen */

function _dnaPromptPool(wines){
  const generic=["What does \u2018tannic\u2019 mean?","What's the difference between Malbec and Merlot?","Should red wine be chilled?","Why does wine get \u2018legs\u2019 in the glass?","What does \u2018dry\u2019 mean for wine?","How long should wine breathe before drinking?","What's the difference between Old World and New World wine?","Why do some wines use screw caps instead of corks?"];
  const pool=[];
  if(wines&&wines.length>=3){
    const grapeCounts={},regionCounts={},typeCounts={};
    wines.forEach(w=>{
      (w.grapes||[]).forEach(g=>{if(g)grapeCounts[g]=(grapeCounts[g]||0)+1;});
      if(w.region) regionCounts[w.region]=(regionCounts[w.region]||0)+1;
      const t=(w.type||'').toLowerCase();if(t) typeCounts[t]=(typeCounts[t]||0)+1;
    });
    const typeLabels={red:'red',white:'white',rose:'ros\u00e9',sparkling:'sparkling',orange:'orange',dessert:'dessert',fortified:'fortified'};
    const topGrapes=Object.entries(grapeCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
    const topRegions=Object.entries(regionCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]);
    const topTypes=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1]).slice(0,2).map(e=>e[0]);
    topGrapes.forEach(g=>{pool.push(`Why do I keep picking ${g}?`);pool.push(`What food pairs well with ${g}?`);});
    topRegions.forEach(r=>{pool.push(`What food pairs well with wine from ${r}?`);pool.push(`What makes wine from ${r} distinctive?`);});
    if(topGrapes[0]&&topRegions[0]) pool.push(`What's special about ${topGrapes[0]} from ${topRegions[0]}?`);
    topTypes.forEach(t=>{if(typeLabels[t]) pool.push(`What should I try if I love ${typeLabels[t]} wine?`);});
  }
  generic.forEach(g=>pool.push(g));
  return [...new Set(pool)].slice(0,12);
}

function WineChatWidget({wines}){
  const [q,setQ]=React.useState('');
  const [asking,setAsking]=React.useState(false);
  const [asked,setAsked]=React.useState('');
  const [answer,setAnswer]=React.useState('');
  const [err,setErr]=React.useState(false);
  const [focused,setFocused]=React.useState(false);

  const prompts=React.useMemo(()=>{
    const pool=_dnaPromptPool(wines);
    return [...pool].sort(()=>Math.random()-0.5).slice(0,3);
  },[wines?.length]);
  const [pIdx,setPIdx]=React.useState(0);
  const [typed,setTyped]=React.useState('');
  const [tPhase,setTPhase]=React.useState('typing');
  const [exhausted,setExhausted]=React.useState(false);
  const idle=!asking&&!answer&&!err&&!q&&!focused&&!exhausted;

  React.useEffect(()=>{
    if(!idle) return;
    const current=prompts[pIdx]||'';
    let timer;
    if(tPhase==='typing'){
      if(typed.length<current.length) timer=setTimeout(()=>setTyped(current.slice(0,typed.length+1)),32);
      else timer=setTimeout(()=>setTPhase('deleting'),1700);
    } else {
      if(typed.length>0) timer=setTimeout(()=>setTyped(typed.slice(0,-1)),16);
      else if(pIdx+1<prompts.length){setPIdx(i=>i+1);setTPhase('typing');}
      else setExhausted(true);
    }
    return()=>clearTimeout(timer);
  },[idle,typed,tPhase,pIdx,prompts]);

  function doAsk(question){
    if(!question||asking) return;
    setAsking(true);setErr(false);setAnswer('');setAsked(question);setQ('');
    const prompt=`You are a concise wine assistant inside a wine app's home screen. Answer ONLY questions about wine — grape varieties, tasting, pairing, service, regions, production. You may also address food pairing and other alcoholic drinks, but only in service of a wine question (e.g. "what beer pairs with steak alongside a Malbec" is fine). If the question is unrelated to wine, food pairing, or alcohol, do not answer it — instead respond with one short, friendly sentence redirecting back to wine topics. Otherwise answer in 2-4 clear, conversational sentences. Plain prose, no markdown, no lists, no headers.\n\nQuestion: "${question}"`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>setAnswer(text.trim()))
      .catch(()=>setErr(true))
      .finally(()=>setAsking(false));
  }
  function ask(e){e.preventDefault();doAsk(q.trim());}

  return(
    <div style={{margin:'0 16px 8px'}}>
      <form onSubmit={ask} style={{display:'flex',alignItems:'center',gap:8,background:'#000',border:'1px solid #000',borderRadius:24,padding:'6px 6px 6px 18px',position:'relative'}}>
        <div style={{flex:1,minWidth:0,position:'relative',height:22}}>
          <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} placeholder="Ask Vinny about a wine..." style={{position:'absolute',inset:0,width:'100%',border:'none',outline:'none',background:'transparent',fontSize:16,fontFamily:C.P,color:'#fff'}}/>
          {idle&&(
            <div onClick={()=>doAsk(prompts[pIdx])} style={{position:'absolute',inset:0,display:'flex',alignItems:'center',background:'#000',cursor:'pointer'}}>
              <span style={{fontSize:16,color:'rgba(255,255,255,0.75)',fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{typed}<span style={{display:'inline-block',width:1.5,height:15,background:'rgba(255,255,255,0.75)',marginLeft:2,verticalAlign:'-2px',animation:'homeCaret 0.9s step-end infinite'}}/></span>
            </div>
          )}
        </div>
        <button type="submit" disabled={asking||!q.trim()} aria-label="Ask" style={{width:38,height:38,borderRadius:19,border:'none',background:q.trim()?C.cr:'rgba(255,255,255,0.18)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:q.trim()?'pointer':'default',padding:0}}>
          <svg width="16" height="16" viewBox="0 0 20 20"><path d="M3 10h13M10 4l6.5 6L10 16" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </form>
      <div style={{maxHeight:(asking||answer||err)?400:0,opacity:(asking||answer||err)?1:0,overflow:'hidden',transition:'max-height 0.35s ease,opacity 0.3s ease,margin-top 0.35s ease',marginTop:(asking||answer||err)?10:0}}>
        <Card style={{padding:14,position:'relative',background:'#000'}}>
          <div onClick={()=>{setAnswer('');setAsked('');setErr(false);}} style={{position:'absolute',top:10,right:10,width:24,height:24,borderRadius:12,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="11" height="11" viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P,marginBottom:6,paddingRight:24}}>{asked}</div>
          {asking?(
            <div style={{fontSize:15,color:'rgba(255,255,255,0.7)',fontFamily:C.P,fontStyle:'italic'}}>Thinking…</div>
          ):err?(
            <div style={{fontSize:15,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Couldn't get an answer — try again.</div>
          ):(
            <div style={{fontSize:16,color:'#fff',fontFamily:C.P,lineHeight:1.5}}>{answer}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function HomeScreen({nav, showPro, isTablet}){
  const [travel,setTravel]=React.useState(()=>Regional.travel());
  React.useEffect(()=>{
    const h=()=>setTravel(Regional.travel());
    window.addEventListener('vinterest:travel',h);
    return()=>window.removeEventListener('vinterest:travel',h);
  },[]);
  const [genScripts,setGenScripts]=React.useState({});
  const [scriptLength,setScriptLength]=React.useState(localStorage.getItem('vinterest_script_length')||'long');
  const [generating,setGenerating]=React.useState(null);
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());

  React.useEffect(()=>{
    const h=()=>setXpData(XPSystem.get());
    window.addEventListener('vinterest:xp',h);
    return()=>window.removeEventListener('vinterest:xp',h);
  },[]);

  const allWines=WineHistory.getAll();
  const isPro=!!localStorage.getItem('vinterest_pro');
  const scanCount=parseInt(localStorage.getItem('vinterest_scan_count')||'0');
  const FREE_SCANS=10;
  const atLimit=!isPro&&scanCount>=FREE_SCANS;

  const cats=[
    {col:'#8B1A2F',label:'Reds',      typeKey:'red'},
    {col:'#B8963E',label:'Whites',    typeKey:'white'},
    {col:'#C47A8A',label:'Rosé',      typeKey:'rose'},
    {col:'#5E8FA8',label:'Sparkling', typeKey:'sparkling'},
    {col:'#C1652B',label:'Orange',    typeKey:'orange'},
    {col:'#8A5A2B',label:'Dessert',   typeKey:'dessert'},
    {col:'#5C2A1E',label:'Fortified', typeKey:'fortified'},
  ];
  const _BASE_TYPES=['red','white','rose','sparkling'];
  /* Explore suggestion based on dominant type */
  const typeCounts={red:0,white:0,rose:0,sparkling:0,orange:0,dessert:0,fortified:0};
  allWines.forEach(w=>{const t=(w.type||'').toLowerCase().replace('é','e');if(typeCounts[t]!==undefined)typeCounts[t]++;});
  // The original four always show (greyed out if unscanned); Orange/Dessert/Fortified only appear once you've actually scanned one.
  const visibleCats=cats.filter(ct=>_BASE_TYPES.includes(ct.typeKey)||typeCounts[ct.typeKey]>0);
  const [activeType,setActiveType]=React.useState('red');
  const [tabToast,setTabToast]=React.useState(null);
  function pickType(ct){
    if(typeCounts[ct.typeKey]===0){ setTabToast(`You haven't scanned a ${ct.label.toLowerCase()} yet`); setTimeout(()=>setTabToast(null),1800); return; }
    setActiveType(ct.typeKey);
  }
  const c=cats.find(ct=>ct.typeKey===activeType)||cats[0];
  const tabWines=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===c.typeKey);
  const topWines=[...tabWines].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);

  /* Recently scanned — any type, by date, show even if dates missing */
  const recentWines=React.useMemo(()=>[...allWines]
    .sort((a,b)=>new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0))
    .slice(0,3)
  ,[allWines.length]);

  const primaryType=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'red';
  const exploreSuggestions={
    red:      {title:'Try a White This Week',  body:'Your structured palate would suit a bone-dry Chablis or aged white Burgundy.'},
    white:    {title:'Venture into Reds',      body:'Your palate for whites points toward elegant Pinot Noir or light Beaujolais.'},
    rose:     {title:'Go Sparkling',           body:'Your dry rosé palate points to Champagne — similar freshness, better stories.'},
    sparkling:{title:'Explore Still Wines',    body:'Your palate for fine bubbles translates beautifully to quality Burgundy stills.'},
    orange:   {title:'Try a Classic White',    body:'Your taste for skin-contact texture points to aged white Rioja — similar depth, without the funk.'},
    dessert:  {title:'Try a Fortified Wine',   body:'Your dessert wine palate points to Tawny Port — same richness, more nutty complexity.'},
    fortified:{title:'Try a Dessert Wine',     body:'Your taste for Port or Sherry points to Sauternes or Tokaji — similar richness, without the fortification.'},
  };
  const explore=exploreSuggestions[primaryType]||exploreSuggestions.red;

  /* XP */
  const lv=XPSystem.getLevel(xpData.total);
  const nx=XPSystem.nextLevel(xpData.total);
  const pg=XPSystem.levelProgress(xpData.total);

  /* Script generation — the LONG script is the single source of truth; the SHORT script is always
     derived by condensing that exact long text (never generated independently), so facts like the
     budget range can never disagree between the two lengths. */
  React.useEffect(()=>{
    if(!tabWines.length) return;
    const _rc=Regional.current();
    const _base=_rc.base;
    const _code=_rc.code;
    const keyLong=`vinterest_script_long_${c.typeKey}_n${tabWines.length}_${_rc.code}_v3`;
    const keyShort=`vinterest_script_short_${c.typeKey}_n${tabWines.length}_${_rc.code}_v3`;
    const cachedLong=localStorage.getItem(keyLong);
    const cachedShort=localStorage.getItem(keyShort);

    function makeShortFrom(longText){
      if(generating===c.typeKey+'_short') return;
      setGenerating(c.typeKey+'_short');
      const prompt=`Condense this sommelier script into ONE ultra-concise sentence (under 20 words), keeping the SAME facts, style, regions and budget range verbatim — do not invent a new budget number, only reuse the one already stated (or omit it if none was stated). Script: ${longText} Return ONLY the condensed script text in double quotes — nothing else.`;
      window.claude.complete({messages:[{role:'user',content:prompt}]})
        .then(text=>{const sc=text.trim();localStorage.setItem(keyShort,sc);if(scriptLength==='short')setGenScripts(g=>({...g,[c.typeKey]:sc}));})
        .catch(()=>{})
        .finally(()=>setGenerating(null));
    }

    if(scriptLength==='long'){
      if(cachedLong){ setGenScripts(s=>({...s,[c.typeKey]:cachedLong})); return; }
      if(generating===c.typeKey) return;
      setGenerating(c.typeKey);
      const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}`).join('; ');
      const prompt=`I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a 2 sentences max natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_base} symbol plus the ${_code} code (e.g. "${_base}40–${_base}80 ${_code}") — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
      window.claude.complete({messages:[{role:'user',content:prompt}]})
        .then(text=>{const sc=text.trim();localStorage.setItem(keyLong,sc);setGenScripts(g=>({...g,[c.typeKey]:sc}));})
        .catch(()=>{})
        .finally(()=>setGenerating(null));
      return;
    }

    // scriptLength==='short'
    if(cachedShort){ setGenScripts(s=>({...s,[c.typeKey]:cachedShort})); return; }
    if(cachedLong){ makeShortFrom(cachedLong); return; }
    // No long script yet — generate it first, then derive short from it.
    if(generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}`).join('; ');
    const prompt=`I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a 2 sentences max natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_base} symbol plus the ${_code} code (e.g. "${_base}40–${_base}80 ${_code}") — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const sc=text.trim();localStorage.setItem(keyLong,sc);setGenerating(null);makeShortFrom(sc);})
      .catch(()=>setGenerating(null));
  },[activeType,allWines.length,scriptLength]);

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8',orange:'#C1652B',dessert:'#8A5A2B',fortified:'#5C2A1E'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg,position:'relative'}}>

      {/* ── Fixed header: logo + always-visible Scan CTA ── */}
      <div style={{background:C.white,flexShrink:0}}>
        {/* Logo row */}
        <div style={{padding:'14px 20px 14px',paddingRight:'120px',display:'flex',alignItems:'center',gap:12}}>
          <div onClick={()=>nav('account')} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="user" sz={16} col={C.ink}/>
          </div>
          <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block',cursor:'pointer'}} onClick={()=>{
            if(!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.getRegistration().then(function(reg){
              if(!reg) return;
              reg.update().then(function(){
                if(reg.waiting){
                  var banner=document.getElementById('vinterest-update-banner');
                  if(banner) banner.style.display='flex';
                } else {
                  // Listen for a new SW found after update check
                  reg.addEventListener('updatefound',function(){
                    var nw=reg.installing;
                    nw.addEventListener('statechange',function(){
                      if(nw.state==='installed'&&navigator.serviceWorker.controller){
                        var banner=document.getElementById('vinterest-update-banner');
                        if(banner) banner.style.display='flex';
                      }
                    });
                  });
                }
              });
            });
          }}/>
        </div>
        {/* Wine chat widget — phone only; tablet uses sidebar */}
        {!isTablet&&<WineChatWidget wines={allWines}/>}
      </div>

      {travel&&(
        <div onClick={()=>nav('account')} style={{background:C.cr,padding:'6px 20px',display:'flex',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer',flexShrink:0}}>
          <Icon n="compass" sz={12} col="#fff"/>
          <span style={{fontSize:12,fontWeight:600,color:'#fff',fontFamily:C.P}}>Travel Mode On — {travel.country}</span>
        </div>
      )}

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:'auto',overscrollBehavior:'none',WebkitOverflowScrolling:'touch'}}>
      <div style={{padding:'8px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Recently Scanned */}
        {recentWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden',paddingBottom:4}}>
            <div style={{padding:'12px 14px 7px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Recently Scanned</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>All →</span>
            </div>
            {recentWines.map((w,i)=>(
              <div key={i} onClick={()=>{
                sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                nav('detail');
              }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                <div style={{width:32,height:44,borderRadius:7,background:colFor(w)+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${colFor(w)}20`}}>
                  <Icon n="wine" sz={14} col={colFor(w)}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                </div>
                {w.rating>0
                  ?<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>
                  :<span style={{fontSize:13,color:C.cr,fontFamily:C.P,flexShrink:0,fontWeight:600}}>Rate →</span>}
              </div>
            ))}
          </Card>
        )}

        {/* Type selector + script + top wines */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {/* Type tabs — base four always fill one row; Orange/Dessert/Fortified (once scanned) sit on a second row below */}
          <div style={{position:'relative',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{display:'flex',gap:6}}>
              {cats.slice(0,4).map((ct,i)=>{
                const disabled=typeCounts[ct.typeKey]===0;
                const active=ct.typeKey===activeType;
                return <div key={i} onClick={()=>pickType(ct)} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:10,background:active?ct.col+'18':C.offWhite,border:`1.5px solid ${active?ct.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s',opacity:disabled?0.4:1}}>
                  <div style={{width:7,height:7,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
                  <div style={{fontSize:13,fontWeight:active?700:500,color:active?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
                </div>;
              })}
            </div>
            {visibleCats.length>4&&<div style={{display:'flex',gap:6}}>
              {visibleCats.slice(4).map((ct,i)=>{
                const active=ct.typeKey===activeType;
                return <div key={i} onClick={()=>pickType(ct)} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:10,background:active?ct.col+'18':C.offWhite,border:`1.5px solid ${active?ct.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:7,height:7,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
                  <div style={{fontSize:13,fontWeight:active?700:500,color:active?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
                </div>;
              })}
            </div>}
          </div>

          {/* Script */}
          <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}25`,padding:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Icon n="message" sz={14} col={c.col}/>
                <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
              </div>
              {tabWines.length>0&&!generating&&(
                <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:6,padding:'3px 4px',border:`1px solid ${C.line}`}}>
                  {['short','long'].map(len=>(
                    <div key={len} onClick={()=>{setScriptLength(len);localStorage.setItem('vinterest_script_length',len);}} style={{padding:'4px 8px',borderRadius:4,background:scriptLength===len?C.cr:'transparent',cursor:'pointer'}}>
                      <span style={{fontSize:13,fontWeight:600,color:scriptLength===len?'#fff':C.mid,fontFamily:C.P}}>{len.charAt(0).toUpperCase()+len.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {tabWines.length===0?(
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>Scan and rate some {c.label.toLowerCase()} to generate your personalised sommelier script.</div>
            ):(generating===c.typeKey||generating===c.typeKey+'_short')?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:c.col,animation:'homeSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65}}>{genScripts[c.typeKey]||'Script generating…'}</div>
            )}
          </Card>

          {/* Top wines for this type */}
          {topWines.length>0&&(
            <Card style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'10px 14px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Top {c.label}</span>
                <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
              </div>
              {topWines.map((w,i)=>(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:28,height:38,borderRadius:6,background:c.col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon n="wine" sz={12} col={c.col}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {w.rating>0&&<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Quiz + XP row */}
        <div style={{display:'flex',gap:8}}>
          <Card style={{flex:1,padding:12,cursor:'pointer'}} onClick={()=>nav('learn')}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>Take a Quiz</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:7}}>Learn wine · Earn XP</div>
            <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P}}>+ XP</span>
            </div>
          </Card>
          <Card style={{flex:1,padding:12}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>{lv.badge} {lv.name}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:7}}>
              {xpData.total} XP{nx?` · ${nx.min-xpData.total} to go`:''}
            </div>
            <Prog val={pg} h={5} col={C.cr}/>
          </Card>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      {tabToast&&<div style={{position:'absolute',top:14,left:16,right:16,textAlign:'center',fontSize:14.5,fontWeight:700,color:'#fff',fontFamily:C.P,background:C.cr,borderRadius:12,padding:'12px 16px',zIndex:250,boxShadow:'0 6px 18px rgba(139,26,47,0.35)',animation:'homeToast 1.8s ease forwards'}}>{tabToast}</div>}
      <style>{`@keyframes homeSpin{to{transform:rotate(360deg)}}
@keyframes homeToast{0%{opacity:0;transform:translateY(-8px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
@keyframes homeCaret{50%{opacity:0}}`}</style>
    </div>
  );
}

Object.assign(window,{HomeScreen});
