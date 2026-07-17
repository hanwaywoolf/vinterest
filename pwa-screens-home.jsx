/* Vinterest PWA — Home screen */

function WineChatWidget(){
  const [q,setQ]=React.useState('');
  const [asking,setAsking]=React.useState(false);
  const [asked,setAsked]=React.useState('');
  const [answer,setAnswer]=React.useState('');
  const [err,setErr]=React.useState(false);

  function ask(e){
    e.preventDefault();
    const question=q.trim();
    if(!question||asking) return;
    setAsking(true);setErr(false);setAnswer('');setAsked(question);setQ('');
    const prompt=`You are a concise wine assistant inside a wine app's home screen. Answer ONLY questions about wine — grape varieties, tasting, pairing, service, regions, production. You may also address food pairing and other alcoholic drinks, but only in service of a wine question (e.g. "what beer pairs with steak alongside a Malbec" is fine). If the question is unrelated to wine, food pairing, or alcohol, do not answer it — instead respond with one short, friendly sentence redirecting back to wine topics. Otherwise answer in 2-4 clear, conversational sentences. Plain prose, no markdown, no lists, no headers.\n\nQuestion: "${question}"`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>setAnswer(text.trim()))
      .catch(()=>setErr(true))
      .finally(()=>setAsking(false));
  }

  return(
    <div style={{margin:'0 16px 8px'}}>
      <form onSubmit={ask} style={{display:'flex',alignItems:'center',gap:8,background:C.bg,border:`1px solid ${C.line}`,borderRadius:24,padding:'6px 6px 6px 18px'}}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask Vinny about a wine..." style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',fontSize:16,fontFamily:C.P,color:C.ink}}/>
        <button type="submit" disabled={asking||!q.trim()} aria-label="Ask" style={{width:38,height:38,borderRadius:19,border:'none',background:q.trim()?C.cr:C.line,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:q.trim()?'pointer':'default',padding:0}}>
          <svg width="16" height="16" viewBox="0 0 20 20"><path d="M3 10h13M10 4l6.5 6L10 16" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </form>
      <div style={{maxHeight:(asking||answer||err)?400:0,opacity:(asking||answer||err)?1:0,overflow:'hidden',transition:'max-height 0.35s ease,opacity 0.3s ease,margin-top 0.35s ease',marginTop:(asking||answer||err)?10:0}}>
        <Card style={{padding:14,position:'relative'}}>
          <div onClick={()=>{setAnswer('');setAsked('');setErr(false);}} style={{position:'absolute',top:10,right:10,width:24,height:24,borderRadius:12,background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <svg width="11" height="11" viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke={C.mid} strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,marginBottom:6,paddingRight:24}}>{asked}</div>
          {asking?(
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Thinking…</div>
          ):err?(
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Couldn't get an answer — try again.</div>
          ):(
            <div style={{fontSize:16,color:C.ink,fontFamily:C.P,lineHeight:1.5}}>{answer}</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function HomeScreen({nav, showPro, isTablet}){
  const [typeTab,setTypeTab]=React.useState(0);
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
  ];
  const c=cats[typeTab];
  const tabWines=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===c.typeKey);
  const topWines=[...tabWines].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);

  /* Recently scanned — any type, by date, show even if dates missing */
  const recentWines=React.useMemo(()=>[...allWines]
    .sort((a,b)=>new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0))
    .slice(0,3)
  ,[allWines.length]);

  /* Explore suggestion based on dominant type */
  const typeCounts={red:0,white:0,rose:0,sparkling:0};
  allWines.forEach(w=>{const t=(w.type||'').toLowerCase().replace('é','e');if(typeCounts[t]!==undefined)typeCounts[t]++;});
  const primaryType=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'red';
  const exploreSuggestions={
    red:      {title:'Try a White This Week',  body:'Your structured palate would suit a bone-dry Chablis or aged white Burgundy.'},
    white:    {title:'Venture into Reds',      body:'White lovers often find a match in elegant Pinot Noir or light Beaujolais.'},
    rose:     {title:'Go Sparkling',           body:'Dry rosé lovers frequently enjoy Champagne — similar freshness, better stories.'},
    sparkling:{title:'Explore Still Wines',    body:'Your palate for fine bubbles translates beautifully to quality Burgundy stills.'},
  };
  const explore=exploreSuggestions[primaryType]||exploreSuggestions.red;

  /* XP */
  const lv=XPSystem.getLevel(xpData.total);
  const nx=XPSystem.nextLevel(xpData.total);
  const pg=XPSystem.levelProgress(xpData.total);

  /* Script generation */
  React.useEffect(()=>{
    if(!tabWines.length) return;
    const _rc=Regional.current();
    const _base=_rc.base;
    const _code=_rc.code;
    const keyLong=`vinterest_script_long_${c.typeKey}_n${tabWines.length}_${_rc.code}_v2`;
    const keyShort=`vinterest_script_short_${c.typeKey}_n${tabWines.length}_${_rc.code}_v2`;
    const key=scriptLength==='long'?keyLong:keyShort;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[c.typeKey]:cached}));return;}
    if(generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}`).join('; ');
    const lengthInstructions=scriptLength==='short'?`1 sentence, ultra-concise (under 20 words), and mention your typical budget range formatted EXACTLY like "${_base}40–${_base}80 ${_code}" (plain symbol, a number range, then the ${_code} currency code — never a country-prefixed symbol like CA$ or C$)`:'2 sentences max';
    const prompt=`I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a ${lengthInstructions} natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_base} symbol plus the ${_code} code (e.g. "${_base}40–${_base}80 ${_code}") — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const sc=text.trim();localStorage.setItem(key,sc);setGenScripts(g=>({...g,[c.typeKey]:sc}));})
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[typeTab,allWines.length,scriptLength]);

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

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
        {!isTablet&&<WineChatWidget/>}
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
          {/* Type tabs */}
          <div style={{display:'flex',gap:6}}>
            {cats.map((ct,i)=>(
              <div key={i} onClick={()=>setTypeTab(i)} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:10,background:i===typeTab?ct.col+'18':C.offWhite,border:`1.5px solid ${i===typeTab?ct.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                <div style={{width:7,height:7,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
                <div style={{fontSize:13,fontWeight:i===typeTab?700:500,color:i===typeTab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
              </div>
            ))}
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
            ):generating===c.typeKey?(
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
      <style>{`@keyframes homeSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{HomeScreen});
