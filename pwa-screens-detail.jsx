/* Vinterest PWA — Wine Detail screen (tabbed: Details / Story / Buy) */

function ScanLocationCard({wine}){
  const [editing,setEditing]=React.useState(false);
  const [val,setVal]=React.useState(wine?.scan_location?.name||'');
  const [savedName,setSavedName]=React.useState(wine?.scan_location?.name||'');
  React.useEffect(()=>{ setVal(wine?.scan_location?.name||''); setSavedName(wine?.scan_location?.name||''); },[wine?.name,wine?.vintage]);
  if(!wine) return null;
  const dateStr=wine.scanned_at?new Date(wine.scanned_at).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}):null;
  // Copy matches how they met the wine: buying/considering vs. actually drinking it.
  const copy=wine.scan_intent==='checking'
    ? {label:'Where You Found It',placeholder:"e.g. a wine shop, grocery store, a friend recommended it",empty:'Add where you saw this — shop, store, a recommendation…'}
    : {label:'Where You Had It',placeholder:"e.g. a restaurant, a friend's house",empty:"Add where this was — restaurant, a friend's house…"};
  function commit(){
    WineHistory.setLocation(wine.name,wine.vintage,val);
    setSavedName(val.trim());
    setEditing(false);
  }
  return <Card style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <span style={{fontSize:12,fontWeight:700,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>{copy.label}</span>
      {dateStr&&<span style={{fontSize:12.5,color:C.mid,fontFamily:C.P}}>Scanned {dateStr}</span>}
    </div>
    {editing?(
      <div style={{display:'flex',gap:8}}>
        <input autoFocus value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')commit();}} placeholder={copy.placeholder} style={{flex:1,fontSize:15,fontFamily:C.P,padding:'8px 10px',borderRadius:9,border:`1px solid ${C.line}`,color:C.ink}}/>
        <Btn primary onClick={commit}>Save</Btn>
      </div>
    ):(
      <div onClick={()=>setEditing(true)} style={{cursor:'pointer',fontSize:15.5,fontFamily:C.P,color:savedName?C.ink:C.mid,fontWeight:savedName?600:400}}>
        {savedName||copy.empty}
      </div>
    )}
  </Card>;
}

function WineDetailScreen({back,nav}){
  const [tab,setTab]=React.useState(0);
  const tabs=['Details','Story','Price'];
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const existingRating=React.useMemo(()=>{
    if(!wine) return 0;
    const saved=WineHistory.getAll().find(w=>w.name===wine.name&&String(w.vintage)===String(wine.vintage));
    return (saved&&saved.rating)||scanData.existingRating||0;
  },[wine?.name,wine?.vintage]);

  const matchPct=React.useMemo(()=>{
    if(!wine) return null;
    const dna=calcMatchScore(wine,WineHistory.getAll());
    if(dna!=null) return dna;
    const conf=scanData.confidence;
    return conf?Math.round(Math.min(0.98,conf)*100):null;
  },[wine?.name,wine?.vintage]);

  const [isFav,setIsFav]=React.useState(()=>{
    try{
      const favs=JSON.parse(localStorage.getItem('vinterest_favorites')||'[]');
      return favs.some(f=>f.name===(wine?.name)&&String(f.vintage)===String(wine?.vintage));
    }catch(e){return false;}
  });
  function toggleFav(){
    try{
      const favs=JSON.parse(localStorage.getItem('vinterest_favorites')||'[]');
      const idx=favs.findIndex(f=>f.name===wine?.name&&String(f.vintage)===String(wine?.vintage));
      if(idx>=0){favs.splice(idx,1);setIsFav(false);}
      else{favs.push({name:wine?.name,vintage:wine?.vintage});setIsFav(true);}
      localStorage.setItem('vinterest_favorites',JSON.stringify(favs));
    }catch(e){}
  }

  const [shared,setShared]=React.useState(false);
  function shareWine(){
    const title=wine?.name||(wine?.vintage?wine.name+' '+wine.vintage:'Wine on Vinterest');
    const text=`${wine?.name||''}${wine?.vintage?' '+wine.vintage:''} · ${[wine?.region,wine?.country].filter(Boolean).join(', ')}`;
    if(navigator.share){
      navigator.share({title,text,url:window.location.href}).catch(()=>{});
    } else {
      try{navigator.clipboard.writeText(text);setShared(true);setTimeout(()=>setShared(false),2000);}catch(e){}
    }
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px 0',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <div onClick={toggleFav} style={{width:34,height:34,borderRadius:17,background:isFav?C.crSoft:C.offWhite,border:`1px solid ${isFav?C.crDim:C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}>
              <svg viewBox="0 0 20 20" width={18} height={18}><path d="M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z" stroke={isFav?C.cr:C.mid} strokeWidth="1.6" fill={isFav?C.cr:'none'}/></svg>
            </div>
            <div onClick={shareWine} style={{width:34,height:34,borderRadius:17,background:shared?C.greenBg:C.offWhite,border:`1px solid ${shared?C.green:C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}>
              <Icon n={shared?'check':'share'} sz={17} col={shared?C.green:C.mid}/>
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:14,alignItems:'flex-end',marginBottom:14}}>
          <div style={{width:52,height:74,borderRadius:10,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
            <Icon n="wine" sz={24} col={C.cr}/>
          </div>
          <div>
            <div style={{fontSize:24,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.15}}>{wine?.name||'Château Margaux'}</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,marginTop:3}}>{wine?`${wine.vintage||'NV'} · ${wine.region}, ${wine.country}`:'2018 · Bordeaux, France'}</div>
            <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}><Pill active sm style={{textTransform:'capitalize'}}>{wine?.type||'Red'}</Pill>{wine?.grapes?.[0]&&<Pill sm>{wine.grapes[0]}</Pill>}</div>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:`1px solid ${C.line}`}}>
          {tabs.map((t,i)=>(
            <div key={i} onClick={()=>setTab(i)} style={{flex:1,textAlign:'center',paddingBottom:10,fontSize:17,fontWeight:i===tab?600:400,color:i===tab?C.cr:C.mid,fontFamily:C.P,borderBottom:i===tab?`2px solid ${C.cr}`:'none',marginBottom:-1,cursor:'pointer'}}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {tab===0&&<DetailMerged wine={wine} nav={nav} existingRating={existingRating} matchPct={matchPct}/>}
        {tab===1&&<DetailStory wine={wine} nav={nav} existingRating={existingRating}/>}
        {tab===2&&<DetailPrice wine={wine} nav={nav}/>}
      </div>
    </div>
  );
}

function DetailMerged({wine,nav,existingRating=0,matchPct}){
  const [genWhy,setGenWhy]=React.useState(null);
  const [generatingWhy,setGeneratingWhy]=React.useState(false);
  const [userRating,setUserRating]=React.useState(existingRating);
  const [showRatingUI,setShowRatingUI]=React.useState(existingRating===0);
  const [saved,setSaved]=React.useState(existingRating>0);
  const [sliderAnimated,setSliderAnimated]=React.useState(false);
  React.useEffect(()=>{const t=setTimeout(()=>setSliderAnimated(true),80);return()=>clearTimeout(t);},[]);
  const pendingScore=React.useRef(existingRating);
  const ratedOnce=React.useRef(existingRating>0);
  const scoreLabel=userRating===0?'':userRating<=20?'Not for me':userRating<=40?"It's ok":userRating<=60?'Good':userRating<=80?'Really good':'Exceptional';

  function commitScore(v){
    if(!v) v=pendingScore.current;
    const n=Number(v);
    if(n>0&&wine){
      if(existingRating>0){ WineHistory.rate(wine.name,wine.vintage,n); }
      else { WineHistory.add(wine,n); }
      if(!ratedOnce.current){ XPSystem.awardAndToast([{type:'rate'}]); ratedOnce.current=true; }
      setUserRating(n);
      setSaved(true);
      setShowRatingUI(false);
    }
  }
  function handleSliderChange(e){ const n=Number(e.target.value); setUserRating(n); pendingScore.current=n; }
  // Preset buttons update slider position only — user taps Save to commit
  function handlePreset(p){ setUserRating(p); pendingScore.current=p; }

  React.useEffect(()=>{
    if(!wine) return;
    const isGoodMatch=matchPct==null||matchPct>=55;
    const matchRange=matchPct==null?'x':matchPct>=85?'hi':matchPct>=55?'mid':'lo';
    const cacheKey=`vinterest_why_${(wine.name||'').replace(/\s/g,'_')}_${wine.vintage||'nv'}_${matchRange}`;
    const cached=localStorage.getItem(cacheKey);
    if(cached){setGenWhy(cached);return;}
    const userWines=WineHistory.getAll();
    if(!userWines.length) return;
    const typeKey=(wine.type||'red').toLowerCase().replace('é','e');
    const typeWines=userWines.filter(w=>(w.type||'red').toLowerCase().replace('é','e')===typeKey);
    if(!typeWines.length) return;
    const avgB=typeWines.filter(w=>w.body!=null).reduce((s,w)=>s+w.body,0)/(typeWines.filter(w=>w.body!=null).length||1);
    const avgT=typeWines.filter(w=>w.tannins!=null).reduce((s,w)=>s+w.tannins,0)/(typeWines.filter(w=>w.tannins!=null).length||1);
    const avgA=typeWines.filter(w=>w.acidity!=null).reduce((s,w)=>s+w.acidity,0)/(typeWines.filter(w=>w.acidity!=null).length||1);
    const topWines=[...typeWines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,4).map(w=>w.name+(w.vintage?' '+w.vintage:'')).join(', ');
    const gCounts={}; typeWines.forEach(w=>(w.grapes||[]).forEach(g=>{if(g)gCounts[g]=(gCounts[g]||0)+1;}));
    const topGrapes=Object.entries(gCounts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>e[0]).join(', ');
    const lbl=v=>v>=0.68?'high':v>=0.38?'medium':'low';
    setGeneratingWhy(true);
    const wineCtx=`${wine.name}${wine.vintage?' '+wine.vintage:''}, a ${wine.type||'red'} from ${wine.region||wine.country||'unknown'} with body=${(wine.body??0.65).toFixed(1)}, tannins=${(wine.tannins??0.55).toFixed(1)}, acidity=${(wine.acidity??0.60).toFixed(1)}`;
    const userCtx=`Their ${wine.type||'red'} DNA: body ${lbl(avgB)}, tannins ${lbl(avgT)}, acidity ${lbl(avgA)}. Top rated: ${topWines||'none yet'}. Favourite grapes: ${topGrapes||'still discovering'}.`;
    const prompt=isGoodMatch
      ?`The user is looking at: ${wineCtx}. ${userCtx} Write ONE sentence (max 30 words) explaining specifically why this wine matches this user — compare attributes or reference their actual top wines by name. Be concrete, not generic. IMPORTANT: Do NOT include ANY numbers, decimals, percentages, or specific wine attribute values anywhere in your response. Use only descriptive words like high, low, medium, bold, light, etc. Return ONLY the sentence, no quotes.`
      :`The user is looking at: ${wineCtx}. ${userCtx} This wine scores ${matchPct}% against their taste profile. Write ONE sentence (max 30 words) explaining honestly and constructively why this wine contrasts with their usual preferences — be specific about the key difference (e.g. body, tannins, acidity, style). IMPORTANT: No numbers, decimals, percentages in your response. Use only descriptive words. Return ONLY the sentence, no quotes.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(cacheKey,s);setGenWhy(s);})
      .catch(()=>{})
      .finally(()=>setGeneratingWhy(false));
  },[wine?.name,wine?.vintage,matchPct]);

  const [vintageInfo,setVintageInfo]=React.useState(null);
  const [loadingVintage,setLoadingVintage]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!wine.vintage) return;
    const cacheKey=`vinterest_vintage_${(wine.name||'').replace(/\s/g,'_')}_${wine.vintage}`;
    const cached=localStorage.getItem(cacheKey);
    if(cached){try{setVintageInfo(JSON.parse(cached));return;}catch(e){}}
    setLoadingVintage(true);
    const yr=new Date().getFullYear();
    const prompt=`You are a sommelier. Assess the vintage quality and realistic drinking window for this specific wine. Wine: ${wine.name} ${wine.vintage}. Type: ${wine.type||'red'}, Region: ${wine.region||''}, Country: ${wine.country||''}. Grapes: ${(wine.grapes||[]).join(', ')||'unknown'}. Body: ${(wine.body??0.65).toFixed(1)}, Tannins: ${(wine.tannins??0.55).toFixed(1)}, Acidity: ${(wine.acidity??0.60).toFixed(1)}, ABV: ${wine.abv||13}%. Return ONLY valid JSON (no markdown): {"vintage_rating":"Exceptional|Outstanding|Very Good|Good|Average","drink_from":${yr},"drink_to":2032,"peak_from":2025,"peak_to":2029,"note":"one concrete sentence on how this wine is developing right now and why. IMPORTANT: Do NOT include ANY numbers, decimals, percentages, or specific attribute values (like '0.82 tannins' or '82%') anywhere in the sentence. Use only descriptive words like high, low, medium, bold, structured, etc."}`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{
        let c=text.replace(/```json|```/g,'').trim();
        const s=c.indexOf('{'),e=c.lastIndexOf('}');
        if(s>=0&&e>s) c=c.slice(s,e+1);
        const d=JSON.parse(c);
        localStorage.setItem(cacheKey,JSON.stringify(d));
        setVintageInfo(d);
      })
      .catch(()=>{})
      .finally(()=>setLoadingVintage(false));
  },[wine?.name,wine?.vintage]);

  const isRed=((wine?.type||'').toLowerCase().replace('é','e'))==='red';
  const isWhite=((wine?.type||'').toLowerCase().replace('é','e'))==='white';
  const isSparkling=((wine?.type||'').toLowerCase().replace('é','e'))==='sparkling';
  const isOrange=((wine?.type||'').toLowerCase().replace('é','e'))==='orange';
  const isDessert=((wine?.type||'').toLowerCase().replace('é','e'))==='dessert';
  const isFortified=((wine?.type||'').toLowerCase().replace('é','e'))==='fortified';
  const showTannins=isRed||isOrange||isFortified;
  const showTexture=isWhite||isOrange||isDessert||isFortified;
  const charLbl=(v,lo,hi)=>v>=0.68?hi:v>=0.38?'Medium':lo;
  const chars=wine?[
    {label:'Body',      value:charLbl(wine.body??0.65,    'Light',    'Full')},
    ...(showTannins?[{label:'Tannins', value:charLbl(wine.tannins??0.55, 'Silky',    'Grippy')}]:[]),
    {label:'Acidity',   value:charLbl(wine.acidity??0.60, 'Mellow',   'Zingy')},
    ...(showTexture?[{label:'Texture', value:charLbl(wine.texture??0.3, 'Crisp & Steely', 'Rich & Creamy')}]:[]),
    {label:'Sweetness', value:charLbl(wine.sweetness??0.10,'Bone Dry','Sweet')},
    ...(isSparkling?[{label:'Effervescence', value:charLbl(wine.effervescence??0.6, 'Soft & Delicate', 'Vigorous & Persistent')}]:[]),
    ...(wine.abv?[{label:'ABV', value:`${wine.abv}%`}]:[]),
  ]:[];

  const SL=({label})=>(
    <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:8}}>{label}</div>
  );

  const notes=wine?.tasting_notes||[];
  const pairings=wine?.food_pairings||[];

  /* Match sentiment — sliding scale */
  const matchConfig=React.useMemo(()=>{
    if(matchPct==null||matchPct>=85) return {descriptor:matchPct!=null?"You'll love this":null,title:'Why This Matches You',bg:C.greenBg,border:`1px solid ${C.green}25`,col:C.green};
    if(matchPct>=70) return {descriptor:'A great match',title:'Why This Works for You',bg:C.greenBg,border:`1px solid ${C.green}25`,col:C.green};
    if(matchPct>=55) return {descriptor:'Worth exploring',title:'What to Expect',bg:'#EEF6FF',border:'1px solid #4A90D930',col:'#2563A8'};
    if(matchPct>=38) return {descriptor:'Outside your comfort zone',title:'Where It Differs',bg:C.amberBg,border:`1px solid ${C.amber}35`,col:C.amber};
    return {descriptor:'Not your usual style',title:'Why This Might Not Be for You',bg:C.crSoft,border:`1px solid ${C.crDim}`,col:C.cr};
  },[matchPct]);
  function pairingIcon(text){
    const t=(text||'').toLowerCase();
    if(/lamb|mutton|sheep/.test(t)) return 'food-lamb';
    if(/beef|steak|rib|brisket|burger|daube|braised/.test(t)) return 'food-beef';
    if(/chicken|poultry|duck|turkey/.test(t)) return 'food-chicken';
    if(/fish|salmon|tuna|halibut|cod|seafood|prawn|shrimp|oyster|mussel|clam/.test(t)) return 'food-fish';
    if(/cheese|brie|camembert|gouda|cheddar|parmesan|comt|manchego|aged/.test(t)) return 'food-cheese';
    if(/pasta|risotto|noodle|gnocchi|pizza/.test(t)) return 'food-pasta';
    if(/bread|pastry|charcuterie|cured/.test(t)) return 'food-bread';
    if(/vegetable|veg|mushroom|truffle|salad|onion|herb/.test(t)) return 'food-veg';
    if(/pork|ham|bacon|sausage/.test(t)) return 'food-meat';
    return 'food-generic';
  }

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:16}}>
      {/* Your Match + Your Rating — slider style with entrance animation */}
      {(()=>{
        const dotStyle=(pct,col,delay='0s')=>({
          position:'absolute',
          left:`${sliderAnimated?pct:0}%`,
          top:'-6px',
          width:20,height:20,
          background:col,
          borderRadius:10,
          transform:'translateX(-50%)',
          border:`3px solid ${C.white}`,
          boxShadow:`0 2px 8px ${col}55`,
          transition:`left 0.75s cubic-bezier(0.34,1.1,0.64,1) ${delay}`,
        });
        return(
          <Card style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:16}}>
            {/* Match row */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.green,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',opacity:0.55}}>Your Match</span>
                  {matchConfig.descriptor&&<span style={{fontSize:12,fontWeight:600,color:matchConfig.col,fontFamily:C.P,opacity:0.8}}>· {matchConfig.descriptor}</span>}
                </div>
                <span style={{fontSize:17,fontWeight:800,color:C.green,fontFamily:C.P,letterSpacing:'-0.02em'}}>{matchPct!=null?`${matchPct}%`:'—'}</span>
              </div>
              <div style={{width:'100%',height:8,background:`linear-gradient(to right,${C.white},${C.green}50,${C.green})`,borderRadius:4,position:'relative',border:`1px solid ${C.green}25`}}>
                {matchPct!=null&&<div style={dotStyle(matchPct,C.green)}/>}
              </div>
            </div>
            {/* Rating row */}
            <div onClick={()=>{setShowRatingUI(true);setSaved(false);}} style={{cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'baseline',gap:5}}>
                  <span style={{fontSize:10,fontWeight:700,color:C.amber,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',opacity:0.55}}>Your Rating</span>
                  {userRating>0&&scoreLabel&&<span style={{fontSize:12,fontWeight:600,color:C.amber,fontFamily:C.P,opacity:0.65}}>· {scoreLabel}</span>}
                </div>
                {userRating>0?(
                  <div style={{display:'flex',alignItems:'baseline',gap:1}}>
                    <span style={{fontSize:17,fontWeight:800,color:C.amber,fontFamily:C.P,letterSpacing:'-0.02em'}}>{userRating}</span>
                    <span style={{fontSize:10,fontWeight:700,color:C.amber,fontFamily:C.P,opacity:0.6,marginLeft:2}}>pts</span>
                  </div>
                ):(
                  <span style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,opacity:0.5}}>tap to rate</span>
                )}
              </div>
              <div style={{width:'100%',height:8,background:userRating>0?`linear-gradient(to right,${C.white},${C.amber}50,${C.amber})`:`linear-gradient(to right,${C.white},${C.line})`,borderRadius:4,position:'relative',border:`1px solid ${C.amber}25`}}>
                {userRating>0&&<div style={dotStyle(userRating,C.amber,'0.12s')}/>}
              </div>
              {userRating>0&&<div style={{fontSize:10,color:C.mid,fontFamily:C.P,marginTop:5,opacity:0.4,textAlign:'center'}}>tap to edit</div>}
            </div>
          </Card>
        );
      })()}
      {/* Rating UI */}
      {showRatingUI&&(
        <Card style={{padding:'14px 16px'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Rate This Wine</div>
          <div style={{display:'flex',gap:5,marginBottom:12}}>
            {[20,40,60,80,100].map(p=>(
              <div key={p} onClick={()=>handlePreset(p)} style={{flex:1,padding:'7px 2px',borderRadius:9,border:`1.5px solid ${userRating===p?C.cr:C.line}`,background:userRating===p?C.cr:'transparent',textAlign:'center',cursor:'pointer',transition:'all .15s'}}>
                <span style={{fontSize:17,fontWeight:700,color:userRating===p?'#fff':C.mid,fontFamily:C.P}}>{p}</span>
              </div>
            ))}
          </div>
          <input type="range" min="0" max="100" step="1" value={userRating}
            onChange={handleSliderChange}
            style={{width:'100%',accentColor:C.cr,cursor:'pointer',marginBottom:10,display:'block'}}/>
          <div style={{textAlign:'center',minHeight:48,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
            {userRating>0?(
              <>
                <div style={{display:'flex',alignItems:'baseline',gap:2}}>
                  <span style={{fontSize:36,fontWeight:800,color:C.cr,fontFamily:C.P,lineHeight:1}}>{userRating}</span>
                  <span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,marginLeft:2,opacity:0.7}}>pts</span>
                </div>
                <span style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P}}>{scoreLabel}</span>
              </>
            ):(
              <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Drag slider or tap a preset to rate</span>
            )}
          </div>
          {userRating>0&&!saved&&(
            <div onClick={()=>commitScore()} style={{marginTop:10,background:C.cr,borderRadius:12,padding:'12px',textAlign:'center',cursor:'pointer'}}>
              <span style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Save Rating</span>
            </div>
          )}
          {saved&&<div style={{textAlign:'center',fontSize:15,color:C.green,fontFamily:C.P,fontWeight:600,marginTop:8}}>✓ Saved to My Wines</div>}
        </Card>
      )}

      {/* Why This Matches You — dynamic based on match level */}
      <Card style={{background:matchConfig.bg,border:matchConfig.border,padding:14}}>
        <div style={{fontSize:13,fontWeight:700,color:matchConfig.col,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:6}}>{matchConfig.title}</div>
        {generatingWhy?(
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:10,height:10,borderRadius:5,border:`2px solid ${matchConfig.col}40`,borderTopColor:matchConfig.col,animation:'storySpin .8s linear infinite'}}/>
            <span style={{fontSize:14,color:matchConfig.col,fontFamily:C.P,fontStyle:'italic'}}>Analyzing your taste…</span>
          </div>
        ):(
          <span style={{fontSize:15,color:matchConfig.col,fontFamily:C.P,lineHeight:1.6}}>{genWhy||'(personalizing…)'}</span>
        )}
      </Card>

      {/* Scan location — optional manual note on where/when this was had (full geolocation is backlogged) */}
      <ScanLocationCard wine={wine}/>

      {/* Taste Profile */}
      <div>
        <SL label="Taste Profile"/>
        <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:12,padding:'10px 12px',borderRadius:10,background:C.offWhite,border:`1px solid ${C.line}`}}>
          These {chars.length} dimensions describe how this wine will feel in your mouth — they help you understand what to expect and find wines you'll enjoy.{!showTannins?' Tannins aren\'t shown here since they\'re not a meaningful factor for this style.':''}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
          {/* Effervescence — sparkling only, shown first since it's the defining trait */}
          {isSparkling&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Effervescence</div>
              <button onClick={()=>{alert('Effervescence describes the intensity and persistence of the bubbles. A soft, delicate mousse feels gentle on the tongue; vigorous effervescence has a fine, energetic, long-lasting fizz.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Soft & Delicate</span>
              <span>Vigorous & Persistent</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.effervescence??0.6)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine's bubbles are <strong>{chars.find(c=>c.label==='Effervescence')?.value.toLowerCase()}</strong> — {(wine?.effervescence??0.6)>=0.68?'expect a fine, persistent, energetic fizz that lingers on the palate, typical of traditional-method production.':'the mousse is soft and gentle, with larger, quicker-fading bubbles that feel easy-drinking rather than intense.'}</div>
          </div>
          )}

          {/* Body */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Body</div>
              <button onClick={()=>{alert('Body describes how a wine feels in your mouth — how heavy or light it is. Light wines are crisp and refreshing; full wines coat your mouth with richness.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Light</span>
              <span>Full</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.body??0.65)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine is <strong>{chars.find(c=>c.label==='Body')?.value.toLowerCase()}</strong> — {(wine?.body??0.65)>=0.68?'it coats your mouth like whole milk or cream, full and rich':'it feels crisp and refreshing in your mouth, like skim milk'}. {(wine?.body??0.65)>=0.68?'Perfect for hearty foods and contemplative sipping.':'Great as an aperitif or with lighter dishes.'}</div>
          </div>

          {/* Tannins */}
          {isRed&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Tannins</div>
              <button onClick={()=>{alert('Tannins are compounds found mostly in red wines that create a drying sensation in your mouth. Silky tannins feel smooth; grippy tannins feel textured and astringent.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Silky</span>
              <span>Grippy</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.tannins??0.55)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine has <strong>{chars.find(c=>c.label==='Tannins')?.value.toLowerCase()}</strong> tannins — {(wine?.tannins??0.55)>=0.68?'you\'ll feel a textured, drying sensation in your mouth, like biting grape skins. These wines age beautifully.':'the sensation in your mouth is smooth and soft, without much grip. These are drinking wines, ready to enjoy now.'}</div>
          </div>
          )}

          {/* Acidity */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Acidity</div>
              <button onClick={()=>{alert('Acidity is the tartness you taste in wine, like lemon or vinegar. Mellow acidity feels smooth; zingy acidity tastes crisp and bright.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Mellow</span>
              <span>Zingy</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.acidity??0.60)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine is <strong>{chars.find(c=>c.label==='Acidity')?.value.toLowerCase()}</strong> — {(wine?.acidity??0.60)>=0.68?'it tastes fresh and bright, like lemon juice. High acidity makes this wine a food-friendly pairing partner and helps it age.':'it feels smooth and soft on your palate, without much crispness. These wines are approachable and easy-drinking.'}</div>
          </div>

          {/* Texture — white only */}
          {isWhite&&(
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Texture</div>
              <button onClick={()=>{alert('Texture describes how oak aging, lees contact, or malolactic fermentation shape a white wine mouthfeel. Crisp and steely wines taste clean and mineral; rich and creamy wines feel rounder and softer.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Crisp & Steely</span>
              <span>Rich & Creamy</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.texture??0.3)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine's texture is <strong>{chars.find(c=>c.label==='Texture')?.value.toLowerCase()}</strong> — {(wine?.texture??0.3)>=0.68?'oak aging and/or lees contact give it a rounder, creamier mouthfeel, often with notes of butter or vanilla.':'it stays clean, precise and mineral-driven, with little to no oak influence.'}</div>
          </div>
          )}

          {/* Sweetness */}
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Sweetness</div>
              <button onClick={()=>{alert('Sweetness measures residual sugar left in wine after fermentation. Bone dry wines have minimal sugar; sweet wines are noticeably sugary, often enjoyed as dessert wines.')}} style={{width:20,height:20,borderRadius:10,background:C.crSoft,border:`1px solid ${C.cr}`,color:C.cr,fontSize:12,fontWeight:400,cursor:'pointer',padding:0,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:C.P}}>?</button>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:8}}>
              <span>Bone Dry</span>
              <span>Sweet</span>
            </div>
            <div style={{width:'100%',height:8,background:`linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,borderRadius:4,position:'relative',marginBottom:12,border:`1px solid ${C.line}`}}>
              <div style={{position:'absolute',left:`${(wine?.sweetness??0.10)*100}%`,top:'-6px',width:20,height:20,background:C.cr,borderRadius:10,transform:'translateX(-50%)',border:`3px solid ${C.white}`,boxShadow:`0 2px 4px rgba(0,0,0,0.15)`}}/>
            </div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>This wine is <strong>{chars.find(c=>c.label==='Sweetness')?.value.toLowerCase()}</strong> — {(wine?.sweetness??0.10)>=0.68?'noticeably sweet with residual sugar. Perfect as a dessert wine or for those who prefer sweeter flavours.':wine?.sweetness>0.38?'off-dry with a touch of sweetness that balances the acidity. Approachable without being overly sweet.':'nearly all the sugar was fermented out. This is a dry wine with no perceptible sweetness.'}</div>
          </div>

          {/* ABV */}
          {chars.find(c=>c.label==='ABV')&&(
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:8}}>
                <span style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Alcohol Content</span>
                <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{chars.find(c=>c.label==='ABV')?.value}</span>
              </div>
              <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingLeft:8,borderLeft:`2px solid ${C.crSoft}`}}>At {wine?.abv}%, this wine has {wine?.abv<10?'lower alcohol, making it light and crisp':wine?.abv<13?'moderate alcohol, typical for most wines':wine?.abv<15?'higher alcohol, which adds warmth and body':'very high alcohol, which adds significant warmth and weight to the wine'}. Higher alcohol also affects aging potential.</div>
            </div>
          )}
        </div>
      </div>

      {/* Tasting Notes */}
      {notes.length>0&&(
        <div>
          <SL label="Tasting Notes"/>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:12,padding:'10px 12px',borderRadius:10,background:C.offWhite,border:`1px solid ${C.line}`}}>
            These flavours are what you'll taste when you drink it — look for these clues as you sip. Tasting notes help you build your palate and remember wines you love.
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {notes.map((n,i)=>(
              <span key={i} style={{padding:'5px 13px',borderRadius:20,background:i<2?C.crSoft:C.offWhite,color:i<2?C.cr:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<2?C.crDim:C.line}`}}>{n}</span>
            ))}
          </div>
        </div>
      )}

      {/* Food Pairings */}
      {pairings.length>0&&(
        <div>
          <SL label="Pairs With"/>
          <div style={{display:'flex',gap:8}}>
            {pairings.slice(0,3).map((f,i)=>(
              <div key={i} style={{flex:1,background:C.offWhite,borderRadius:12,padding:'12px 6px',textAlign:'center',border:`1px solid ${C.line}`}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:6}}><Icon n={pairingIcon(f)} sz={22} col={C.cr}/></div>
                <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,fontWeight:500,lineHeight:1.3}}>{f}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vintage Info */}
      {wine?.vintage&&(
        <div>
          <SL label={`About the ${wine.vintage} Vintage`}/>
          {loadingVintage?(
            <Card style={{padding:14,display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:12,height:12,borderRadius:6,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:C.cr,animation:'detailSpin .8s linear infinite',flexShrink:0}}/>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Analysing vintage…</span>
            </Card>
          ):vintageInfo?(
            <Card style={{padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:12}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Quality Rating</span>
                <span style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P}}>{vintageInfo.vintage_rating}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:12}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Drinking Now</span>
                <span style={{fontSize:15,color:C.ink2,fontFamily:C.P}}>{vintageInfo.drink_from}–{vintageInfo.drink_to}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:12}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Peak Years</span>
                <span style={{fontSize:15,color:C.ink2,fontFamily:C.P}}>{vintageInfo.peak_from}–{vintageInfo.peak_to}</span>
              </div>
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,paddingTop:12,borderTop:`1px solid ${C.line}`,marginTop:12}}>💡 {vintageInfo.note}</div>
            </Card>
          ):null}
        </div>
      )}
    </div>
  );
}

function DetailStory({wine,nav,existingRating=0}){
  const description=(wine?.description?.trim())||'A wine with character and depth.';

  // ── Education: grape deep-dive, growing-season context, vocab terms (batched + cached) ──
  const [edu,setEdu]=React.useState(null);
  const [eduLoading,setEduLoading]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!wine.name) return;
    const key='vinterest_edu_v1_'+(wine.name||'').replace(/\s/g,'_')+'_'+(wine.vintage||'nv');
    const cached=localStorage.getItem(key);
    if(cached){ try{ setEdu(JSON.parse(cached)); return; }catch(e){} }
    if(!window.claude||!window.claude.complete) return;
    setEduLoading(true);
    const g=(wine.grapes&&wine.grapes[0])||(wine.type||'red');
    const prompt=
      'You are a wine educator. For the drinker looking at this specific wine, teach them something useful. '+
      'Wine: '+(wine.name||'')+(wine.vintage&&wine.vintage!==0?' '+wine.vintage:'')+'. Type: '+(wine.type||'red')+'. '+
      'Region: '+(wine.region||'')+', '+(wine.country||'')+'. Grapes: '+((wine.grapes||[]).join(', ')||'unknown')+'. '+
      'Return ONLY valid JSON, no markdown, concrete and specific, NO numbers/percentages/decimals anywhere: '+
      '{'+
      '"grape":"two sentences on what defines '+g+' as a grape/style and how it typically tastes (max 44 words)",'+
      '"season":"one sentence of growing-season or climate context for '+(wine.region||wine.country||'this region')+(wine.vintage&&wine.vintage!==0?' around the '+wine.vintage+' vintage':'')+' and what it means in the glass (max 30 words)",'+
      '"terms":[{"term":"a wine word this bottle teaches","meaning":"plain-English meaning in this wine\'s context (max 16 words)"}]'+
      '}. Give exactly three terms.';
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{ let c=text.replace(/```json|```/g,'').trim(); const s=c.indexOf('{'),e=c.lastIndexOf('}'); if(s>=0&&e>s)c=c.slice(s,e+1); const d=JSON.parse(c); localStorage.setItem(key,JSON.stringify(d)); setEdu(d); })
      .catch(()=>{})
      .finally(()=>setEduLoading(false));
  },[wine?.name,wine?.vintage]);
  const eduSpin=<div style={{display:'flex',alignItems:'center',gap:7}}><div style={{width:11,height:11,borderRadius:6,border:`2px solid ${C.cr}33`,borderTopColor:C.cr,animation:'storySpin .8s linear infinite'}}/><span style={{fontSize:14,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Pulling together the lesson…</span></div>;

  const SL=({label})=>(
    <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:8}}>{label}</div>
  );

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:20}}>
      {/* Wine Story/Description */}
      <div>
        <SL label="The Story"/>
        <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.75}}>{description}</div>
      </div>

      {/* Grape Varietal */}
      {wine?.grapes&&wine.grapes.length>0&&(
        <div>
          <SL label="Grape Varietal"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {wine.grapes.map((g,i)=>(
              <div key={i} style={{padding:'8px 14px',borderRadius:10,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
                <span style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P}}>{g}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Wine Type */}
      {wine?.type&&(
        <div>
          <SL label="Wine Type"/>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,textTransform:'capitalize'}}>{wine.type}</div>
        </div>
      )}

      {/* Region */}
      {(wine?.region||wine?.country)&&(
        <div>
          <SL label="Region"/>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{wine.region}{wine.region&&wine.country?', ':''}{wine.country}</div>
        </div>
      )}

      {/* ── Further your palate — education ── */}
      {(edu||eduLoading)&&(
        <div>
          <SL label="Further Your Palate"/>
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {/* Grape deep-dive */}
            <Card style={{padding:14}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                <Icon n="wine" sz={16} col={C.cr}/>
                <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{(wine?.grapes&&wine.grapes[0])||'The grape'}, up close</span>
              </div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6}}>{eduLoading&&!edu?eduSpin:(edu&&edu.grape)||''}</div>
            </Card>
            {/* Growing-season / weather context */}
            {(edu&&edu.season)&&(
              <Card style={{padding:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <Icon n="globe" sz={16} col={C.cr}/>
                  <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{wine?.vintage&&wine.vintage!==0?`The ${wine.vintage} growing season`:'Climate & place'}</span>
                </div>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6}}>{edu.season}</div>
              </Card>
            )}
            {/* Vocab this bottle teaches */}
            {(edu&&Array.isArray(edu.terms)&&edu.terms.length>0)&&(
              <Card style={{padding:14}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <Icon n="book" sz={16} col={C.cr}/>
                  <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Words this bottle teaches</span>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {edu.terms.slice(0,3).map((tm,i)=>(
                    <div key={i} style={{display:'flex',gap:10}}>
                      <div style={{width:6,height:6,borderRadius:3,background:C.cr,marginTop:7,flexShrink:0}}/>
                      <div><span style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>{tm.term}</span><span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}> — {tm.meaning}</span></div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {/* Learn hand-off */}
            <div onClick={()=>nav('learn')} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 15px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`,cursor:'pointer'}}>
              <div style={{width:38,height:38,borderRadius:11,background:C.white,border:`1px solid ${C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="book" sz={19} col={C.cr}/></div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>Keep learning</div>
                <div style={{fontSize:13,color:C.cr,opacity:0.75,fontFamily:C.P}}>Quizzes & lessons on {(wine?.grapes&&wine.grapes[0])||wine?.region||'wine'}</div>
              </div>
              <Icon n="chevron" sz={15} col={C.cr}/>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes storySpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* Region → currency config */
const REGION_CURRENCY = {
  uk:        { sym:'£',   base:'£', code:'GBP', label:'United Kingdom' },
  us:        { sym:'$',   base:'$', code:'USD', label:'United States' },
  ontario:   { sym:'CA$', base:'$', code:'CAD', label:'Ontario, Canada' },
  canada:    { sym:'CA$', base:'$', code:'CAD', label:'Canada' },
  australia: { sym:'A$',  base:'$', code:'AUD', label:'Australia' },
  nz:        { sym:'NZ$', base:'$', code:'NZD', label:'New Zealand' },
  eu:        { sym:'€',   base:'€', code:'EUR', label:'Europe' },
  france:    { sym:'€',   base:'€', code:'EUR', label:'France' },
  germany:   { sym:'€',   base:'€', code:'EUR', label:'Germany' },
  italy:     { sym:'€',   base:'€', code:'EUR', label:'Italy' },
  spain:     { sym:'€',   base:'€', code:'EUR', label:'Spain' },
};
/* base = plain currency symbol shown on-screen (e.g. "$"); code = abbreviation shown as a small caption
   (e.g. "CAD") underneath the amount, so "CA$24" becomes "$24" with "CAD" below it. sym (with country
   prefix) is kept only for use inside LLM prompts, where the disambiguation matters. */

function DetailPrice({wine,nav}){
  const curr = (()=>{ const rc=Regional.current(); return {sym:rc.sym,base:rc.base,code:rc.code,label:rc.label}; })();

  const [priceData,  setPriceData]  = React.useState(null);
  const [loading,    setLoading]    = React.useState(false);
  const [done,       setDone]       = React.useState(false);

  const cacheKey = wine ? retailPriceCacheKey(wine,curr.code) : null;

  React.useEffect(function(){
    if (!wine || !wine.name) return;
    setPriceData(null);
    setDone(false);

    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try { setPriceData(JSON.parse(cached)); setDone(true); return; } catch(e){}
      }
    }

    setLoading(true);
    fetchRetailEstimate(wine,curr)
      .then(function(d){ setPriceData(d); })
      .catch(function(){})
      .finally(function(){ setLoading(false); setDone(true); });
  }, [wine && wine.name, wine && wine.vintage, curr.code]);

  const SL=({label})=>(
    <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:8}}>{label}</div>
  );

  const tierColor = {
    'entry':       C.mid,
    'everyday':    C.ink2,
    'premium':     C.cr,
    'luxury':      '#9B6B00',
    'ultra-luxury':'#6B2D8B',
  };
  const tierLabel = {
    'entry':       'Entry-level',
    'everyday':    'Everyday',
    'premium':     'Premium',
    'luxury':      'Luxury',
    'ultra-luxury':'Ultra-luxury',
  };

  const fmtPrice = (n) => n != null ? curr.base + n.toLocaleString() : '—';

  function handleFindItForMe(){
    if(!wine) return;
    const q=`${wine.producer?wine.producer+' ':''}${wine.name}${wine.vintage&&wine.vintage!=='NV'?' '+wine.vintage:''} ${wine.type||''} wine buy near me`;
    window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener');
  }

  const hasPrice = priceData && priceData.mid != null;

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:20}}>

      {loading && (
        <Card style={{padding:14,display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:13,height:13,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:C.cr,animation:'storySpin .8s linear infinite',flexShrink:0}}/>
          <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Estimating price…</span>
        </Card>
      )}

      {done && hasPrice && (
        <>
          {/* Price range card */}
          <div>
            <SL label="Estimated Retail Price"/>
            <Card style={{padding:0,overflow:'hidden'}}>
              {/* Mid price hero */}
              <div style={{padding:'18px 16px',background:C.crSoft,display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid '+C.crDim}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,marginBottom:2}}>Typical bottle price</div>
                  <div style={{fontSize:11,color:C.cr+'99',fontFamily:C.P}}>{curr.label}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:26,fontWeight:800,color:C.cr,fontFamily:C.P,lineHeight:1}}>{fmtPrice(priceData.mid)}</div>
                  <div style={{fontSize:11,fontWeight:700,color:C.cr+'99',fontFamily:C.P,marginTop:3,letterSpacing:'0.04em'}}>{curr.code}</div>
                </div>
              </div>
              {/* Low / High row */}
              {(priceData.low != null || priceData.high != null) && (
                <div style={{display:'flex',borderBottom:'1px solid '+C.line}}>
                  <div style={{flex:1,padding:'11px 14px',borderRight:'1px solid '+C.line}}>
                    <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:2}}>Budget end</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{fmtPrice(priceData.low)}</div>
                    <div style={{fontSize:10,fontWeight:600,color:C.mid,fontFamily:C.P,marginTop:2,letterSpacing:'0.04em'}}>{curr.code}</div>
                  </div>
                  <div style={{flex:1,padding:'11px 14px'}}>
                    <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:2}}>Premium end</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{fmtPrice(priceData.high)}</div>
                    <div style={{fontSize:10,fontWeight:600,color:C.mid,fontFamily:C.P,marginTop:2,letterSpacing:'0.04em'}}>{curr.code}</div>
                  </div>
                </div>
              )}
              {/* Tier badge */}
              {priceData.tier && (
                <div style={{padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Price tier</span>
                  <span style={{fontSize:14,fontWeight:700,color:tierColor[priceData.tier]||C.cr,fontFamily:C.P}}>{tierLabel[priceData.tier]||priceData.tier}</span>
                </div>
              )}
            </Card>
          </div>

          {/* Note */}
          {priceData.note && (
            <div>
              <SL label="Price Context"/>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,padding:'12px 14px',borderRadius:12,background:C.offWhite,border:'1px solid '+C.line}}>
                {priceData.note}
              </div>
            </div>
          )}

          {/* Find It For Me */}
          <Btn primary full style={{background:C.cr,boxShadow:`0 3px 12px ${C.cr}35`}} onClick={handleFindItForMe}>Find It For Me</Btn>

          {/* Disclaimer */}
          <div style={{fontSize:12,color:C.mid,fontFamily:C.P,lineHeight:1.5,textAlign:'center',padding:'0 8px'}}>
            Prices are estimates based on publicly available market data and may vary by retailer, vintage condition, and availability.
          </div>
        </>
      )}

      {done && !hasPrice && (
        <>
          <Card style={{padding:14}}>
            <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Price estimate unavailable for this wine.</span>
          </Card>
          <Btn primary full style={{background:C.cr,boxShadow:`0 3px 12px ${C.cr}35`}} onClick={handleFindItForMe}>Find It For Me</Btn>
        </>
      )}
    </div>
  );
}

Object.assign(window,{WineDetailScreen,DetailMerged,DetailStory,DetailPrice});
