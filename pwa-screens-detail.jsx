/* Vinterest PWA — Wine Detail screen (tabbed: Details / Story / Buy) */

function WineDetailScreen({back,nav}){
  const [tab,setTab]=React.useState(0);
  const tabs=['Details','Story','Buy'];
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const existingRating=scanData.existingRating||0;

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
        {tab===2&&<DetailBuy wine={wine} nav={nav}/>}
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
  function handlePreset(p){ setUserRating(p); pendingScore.current=p; commitScore(p); }

  React.useEffect(()=>{
    if(!wine) return;
    const cacheKey=`vinterest_why_${(wine.name||'').replace(/\s/g,'_')}_${wine.vintage||'nv'}`;
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
    const prompt=`The user is looking at: ${wine.name}${wine.vintage?' '+wine.vintage:''}, a ${wine.type||'red'} from ${wine.region||wine.country||'unknown'} with body=${(wine.body??0.65).toFixed(1)}, tannins=${(wine.tannins??0.55).toFixed(1)}, acidity=${(wine.acidity??0.60).toFixed(1)}. Their ${wine.type||'red'} DNA: body ${lbl(avgB)}, tannins ${lbl(avgT)}, acidity ${lbl(avgA)}. Top rated: ${topWines||'none yet'}. Favourite grapes: ${topGrapes||'still discovering'}. Write ONE sentence (max 30 words) explaining specifically why this wine matches this user — compare attributes or reference their actual top wines by name. Be concrete, not generic. IMPORTANT: Do NOT include ANY numbers, decimals, percentages, or specific wine attribute values (like "0.88" or "82%") anywhere in your response. Use only descriptive words like high, low, medium, bold, light, etc. Return ONLY the sentence, no quotes.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(cacheKey,s);setGenWhy(s);})
      .catch(()=>{})
      .finally(()=>setGeneratingWhy(false));
  },[wine?.name,wine?.vintage]);

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

  const charLbl=(v,lo,hi)=>v>=0.68?hi:v>=0.38?'Medium':lo;
  const chars=wine?[
    {label:'Body',      value:charLbl(wine.body??0.65,    'Light',    'Full')},
    {label:'Tannins',   value:charLbl(wine.tannins??0.55, 'Silky',    'Grippy')},
    {label:'Acidity',   value:charLbl(wine.acidity??0.60, 'Mellow',   'Zingy')},
    {label:'Sweetness', value:charLbl(wine.sweetness??0.10,'Bone Dry','Sweet')},
    ...(wine.abv?[{label:'ABV', value:`${wine.abv}%`}]:[]),
  ]:[];

  const SL=({label})=>(
    <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:8}}>{label}</div>
  );

  const notes=wine?.tasting_notes||[];
  const pairings=wine?.food_pairings||[];
  const pairingEmojis=['🥩','🍖','🧀','🐟','🍝','🧅','🥗','🍗'];

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:16}}>
      {/* Your Match + Your Rating — side by side */}
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1,background:C.greenBg,border:`1px solid ${C.green}25`,borderRadius:14,padding:'12px 10px',textAlign:'center'}}>
          <div style={{fontSize:28,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{matchPct!=null?`${matchPct}%`:'—'}</div>
          <div style={{fontSize:13,fontWeight:600,color:C.green,fontFamily:C.P,marginTop:4}}>Your Match</div>
        </div>
        {userRating>0&&(
          <div style={{flex:1,background:C.amberBg,border:`1px solid ${C.amber}25`,borderRadius:14,padding:'12px 10px',textAlign:'center',cursor:'pointer'}} onClick={()=>setShowRatingUI(true)}>
            <div style={{fontSize:28,fontWeight:800,color:C.amber,fontFamily:C.P,lineHeight:1}}>{userRating}</div>
            <div style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P,marginTop:4}}>Your Rating</div>
          </div>
        )}
      </div>

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
            onMouseUp={()=>commitScore()}
            onTouchEnd={()=>commitScore()}
            style={{width:'100%',accentColor:C.cr,cursor:'pointer',marginBottom:10,display:'block'}}/>
          <div style={{textAlign:'center',minHeight:48,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
            {userRating>0?(
              <>
                <div style={{display:'flex',alignItems:'baseline',gap:3}}>
                  <span style={{fontSize:36,fontWeight:800,color:C.cr,fontFamily:C.P,lineHeight:1}}>{userRating}</span>
                  <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>/100</span>
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

      {/* If rated, show compact rating + edit option */}
      {!showRatingUI&&userRating>0&&saved&&(
        <div onClick={()=>setShowRatingUI(true)} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,padding:'10px',cursor:'pointer'}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>✓ Rated {userRating}/100 · tap to edit</span>
        </div>
      )}

      {/* Why This Matches You */}
      <Card style={{background:C.greenBg,border:`1px solid ${C.green}25`,padding:14}}>
        <div style={{fontSize:13,fontWeight:700,color:C.green,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:6}}>Why This Matches You</div>
        {generatingWhy?(
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <div style={{width:10,height:10,borderRadius:5,border:`2px solid ${C.green}40`,borderTopColor:C.green,animation:'storySpin .8s linear infinite'}}/>
            <span style={{fontSize:14,color:C.green,fontFamily:C.P,fontStyle:'italic'}}>Analyzing your taste…</span>
          </div>
        ):(
          <span style={{fontSize:15,color:C.green,fontFamily:C.P,lineHeight:1.6}}>{genWhy||'(personalizing…)'}</span>
        )}
      </Card>

      {/* Taste Profile */}
      <div>
        <SL label="Taste Profile"/>
        <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:12,padding:'10px 12px',borderRadius:10,background:C.offWhite,border:`1px solid ${C.line}`}}>
          These four dimensions describe how this wine will feel in your mouth — they help you understand what to expect and find wines you'll enjoy.
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:20}}>
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
                <div style={{fontSize:24,marginBottom:5}}>{pairingEmojis[i]||'🍽️'}</div>
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

      <style>{`@keyframes storySpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function DetailBuy({wine,nav}){
  const [retailData, setRetailData] = React.useState(function() {
    const region = localStorage.getItem('vinterest_region') || 'uk';
    const cacheKey = 'vinterest_retail_' + ((wine && wine.name) ? wine.name.replace(/\s/g,'_') : '') + '_' + (wine && wine.vintage ? wine.vintage : 'nv') + '_' + region;
    try { return JSON.parse(localStorage.getItem(cacheKey)); } catch(e) { return null; }
  });
  const [loadingRetail, setLoadingRetail] = React.useState(false);

  React.useEffect(function() {
    if (!wine || !wine.name || retailData) return;
    setLoadingRetail(true);
    fetchRetailData(wine.name, wine.vintage)
      .then(function(d){ setRetailData(d); })
      .catch(function(){})
      .finally(function(){ setLoadingRetail(false); });
  }, [wine && wine.name, wine && wine.vintage]);

  const SL=({label})=>(
    <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:8}}>{label}</div>
  );

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:20}}>
      <div>
        <SL label="Where to Buy"/>
        {loadingRetail ? (
          <Card style={{padding:14,display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:13,height:13,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:C.cr,animation:'storySpin .8s linear infinite',flexShrink:0}}/>
            <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Finding best prices…</span>
          </Card>
        ) : retailData && retailData.priceData && retailData.priceData.retailers && retailData.priceData.retailers.length ? (
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',background:C.offWhite,borderBottom:'1px solid '+C.line,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>Typical price</span>
              <span style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P}}>{retailData.priceData.price_range}</span>
            </div>
            {retailData.priceData.retailers.map(function(m,i){
              const isLast = i === retailData.priceData.retailers.length - 1;
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderBottom:isLast?'none':'1px solid '+C.line}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{m.name}</div>
                    {m.note&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{m.note}</div>}
                  </div>
                  <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{m.price}</div>
                </div>
              );
            })}
            {retailData.priceData.buy_tip&&(
              <div style={{padding:'10px 14px',borderTop:'1px solid '+C.line,background:C.crSoft}}>
                <span style={{fontSize:14,color:C.cr,fontFamily:C.P,lineHeight:1.5}}>💡 {retailData.priceData.buy_tip}</span>
              </div>
            )}
          </Card>
        ) : retailData && retailData.lcboData && retailData.lcboData.length ? (
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'8px 14px',background:C.crSoft,borderBottom:'1px solid '+C.crDim}}>
              <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,letterSpacing:'0.05em'}}>LCBO</span>
            </div>
            {retailData.lcboData.slice(0,3).map(function(e,i){
              const isLast = i === Math.min(retailData.lcboData.length,3) - 1;
              return (
                <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderBottom:isLast?'none':'1px solid '+C.line}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{e.node.name}</div>
                  </div>
                  <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>C${(e.node.priceInCents/100).toFixed(2)}</div>
                </div>
              );
            })}
          </Card>
        ) : retailData && retailData.priceData && retailData.priceData.availability === 'not typically sold in this region' ? (
          <Card style={{padding:12}}>
            <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>This wine isn't commonly available in your region.</span>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

Object.assign(window,{WineDetailScreen,DetailMerged,DetailStory,DetailBuy});
