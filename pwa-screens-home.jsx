/* Vinterest PWA — Home screen */

function HomeScreen({nav, showPro}){
  const [typeTab,setTypeTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
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
    const key=`vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[c.typeKey]:cached}));return;}
    if(genScripts[c.typeKey]||generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const prompt=`I've scanned and rated these ${c.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}],skill_id:WINE_SKILL_ID})
      .then(text=>{const sc=text.trim();localStorage.setItem(key,sc);setGenScripts(g=>({...g,[c.typeKey]:sc}));})
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[typeTab,allWines.length]);

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* ── Fixed header: logo + always-visible Scan CTA ── */}
      <div style={{background:C.white,flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        {/* Logo row */}
        <div style={{padding:'14px 20px 10px'}}>
          <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block'}}/>
        </div>
        {/* Compact scan CTA — never scrolls away */}
        <div onClick={()=>atLimit?showPro('unlimited-scans'):nav('camera')} style={{
          background:C.ink,borderRadius:14,margin:'0 16px 14px',padding:'13px 16px',
          display:'flex',alignItems:'center',gap:14,cursor:'pointer',
          position:'relative',overflow:'hidden'
        }}>
          <div style={{position:'absolute',right:-16,top:-16,width:100,height:100,borderRadius:50,background:`${C.cr}28`,pointerEvents:'none'}}/>
          <div style={{width:44,height:44,borderRadius:12,background:atLimit?'#444':C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,boxShadow:atLimit?'none':`0 4px 18px ${C.cr}55`}}>
            {atLimit?<Icon n="lock" sz={20} col="#888"/>:<Icon n="camera" sz={22} col="#fff"/>}
          </div>
          <div style={{flex:1,zIndex:1}}>
            <div style={{fontSize:18,fontWeight:700,color:atLimit?'rgba(255,255,255,0.4)':'#fff',fontFamily:C.P,lineHeight:1.2}}>
              {atLimit?'Free scans used up':isPro?'Scan a Bottle or List':'Scan a Bottle'}
            </div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:2}}>
              {atLimit?'Upgrade for unlimited scans':isPro?'Point at a label or restaurant wine list':'Point at any wine label to identify'}
            </div>
          </div>
          {!atLimit&&<Icon n="chevron" sz={14} col="rgba(255,255,255,0.3)"/>}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Recently Scanned */}
        {recentWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden',paddingBottom:4}}>
            <div style={{padding:'12px 14px 7px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>Recently Scanned</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>All →</span>
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
                  <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                  <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                </div>
                {w.rating>0
                  ?<span style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>
                  :<span style={{fontSize:12,color:C.cr,fontFamily:C.P,flexShrink:0,fontWeight:600}}>Rate →</span>}
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
                <div style={{fontSize:11,fontWeight:i===typeTab?700:500,color:i===typeTab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
              </div>
            ))}
          </div>

          {/* Script */}
          <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}25`,padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
              <Icon n="message" sz={14} col={c.col}/>
              <span style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
            </div>
            {tabWines.length===0?(
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>Scan and rate some {c.label.toLowerCase()} to generate your personalised sommelier script.</div>
            ):generating===c.typeKey?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:c.col,animation:'homeSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:13,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65}}>{genScripts[c.typeKey]||'Script generating…'}</div>
            )}
          </Card>

          {/* Top wines for this type */}
          {topWines.length>0&&(
            <Card style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'10px 14px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P}}>Top {c.label}</span>
                <span onClick={()=>nav('mywines')} style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
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
                    <div style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {w.rating>0&&<span style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Expand your palate */}
        {allWines.length>=3&&(
          <div onClick={()=>nav('learn')} style={{background:`linear-gradient(135deg,${C.ink} 0%,#2A1A0E 100%)`,borderRadius:16,padding:'16px 18px',cursor:'pointer',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-20,bottom:-20,width:90,height:90,borderRadius:45,background:'rgba(139,26,47,0.25)',pointerEvents:'none'}}/>
            <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase',marginBottom:4}}>Expand Your Palate</div>
            <div style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:5}}>{explore.title}</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.5,position:'relative',zIndex:1}}>{explore.body}</div>
          </div>
        )}

        {/* Quiz + XP row */}
        <div style={{display:'flex',gap:8}}>
          <Card style={{flex:1,padding:12,cursor:'pointer'}} onClick={()=>nav('learn')}>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>Take a Quiz</div>
            <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:7}}>Learn wine · Earn XP</div>
            <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
              <span style={{fontSize:12,fontWeight:700,color:C.cr,fontFamily:C.P}}>+ XP</span>
            </div>
          </Card>
          <Card style={{flex:1,padding:12}}>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>{lv.badge} {lv.name}</div>
            <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:7}}>
              {xpData.total} XP{nx?` · ${nx.min-xpData.total} to go`:''}
            </div>
            <Prog val={pg} h={5} col={C.cr}/>
          </Card>
        </div>

        <div style={{height:8}}/>
      </div>
      <style>{`@keyframes homeSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{HomeScreen});
