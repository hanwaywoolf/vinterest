/* Vinterest PWA — Wine Detail screen (tabbed: Overview / Story / Data) */

function WineDetailScreen({back,nav}){
  const [tab,setTab]=React.useState(0);
  const tabs=['Overview','Story','Data'];
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const existingRating=scanData.existingRating||0;

  // Computed taste-match (DNA-based, falls back to scan confidence)
  const matchPct=React.useMemo(()=>{
    if(!wine) return null;
    const dna=calcMatchScore(wine,WineHistory.getAll());
    if(dna!=null) return dna;
    const conf=scanData.confidence;
    return conf?Math.round(Math.min(0.98,conf)*100):null;
  },[wine?.name,wine?.vintage]);

  // Favourites
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

  // Share
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
            {/* Heart — toggles favourite */}
            <div onClick={toggleFav} style={{width:34,height:34,borderRadius:17,background:isFav?C.crSoft:C.offWhite,border:`1px solid ${isFav?C.crDim:C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .15s'}}>
              <svg viewBox="0 0 20 20" width={18} height={18}><path d="M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z" stroke={isFav?C.cr:C.mid} strokeWidth="1.6" fill={isFav?C.cr:'none'}/></svg>
            </div>
            {/* Share */}
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
        {tab===0&&<DetailOverview wine={wine} nav={nav} existingRating={existingRating} matchPct={matchPct}/>}
        {tab===1&&<DetailStory wine={wine} nav={nav} existingRating={existingRating}/>}
        {tab===2&&<DetailData wine={wine} nav={nav} existingRating={existingRating} matchPct={matchPct}/>}
      </div>
    </div>
  );
}

function DetailOverview({wine,nav,existingRating=0,matchPct}){
  const [genWhy,setGenWhy]=React.useState(null);
  const [generatingWhy,setGeneratingWhy]=React.useState(false);
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

  React.useEffect(()=>{
    if(!wine) return;
    const userWines=WineHistory.getAll();
    if(!userWines.length) return;
    const cacheKey=`vinterest_why_${(wine.name||'').replace(/\s/g,'_')}_${wine.vintage||'nv'}`;
    const cached=localStorage.getItem(cacheKey);
    if(cached){setGenWhy(cached);return;}
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
    const prompt=`The user is looking at: ${wine.name}${wine.vintage?' '+wine.vintage:''}, a ${wine.type||'red'} from ${wine.region||wine.country||'unknown'} with body=${(wine.body??0.65).toFixed(1)}, tannins=${(wine.tannins??0.55).toFixed(1)}, acidity=${(wine.acidity??0.60).toFixed(1)}. Their ${wine.type||'red'} DNA: body ${lbl(avgB)}, tannins ${lbl(avgT)}, acidity ${lbl(avgA)}. Top rated: ${topWines||'none yet'}. Favourite grapes: ${topGrapes||'still discovering'}. Write ONE sentence (max 30 words) explaining specifically why this wine matches this user — compare attributes or reference their actual top wines by name. Be concrete, not generic. Do NOT include any numbers, decimals, or specific wine attribute values in your response. Return ONLY the sentence, no quotes.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(cacheKey,s);setGenWhy(s);})
      .catch(()=>{})
      .finally(()=>setGeneratingWhy(false));
  },[wine?.name,wine?.vintage]);

  const whyDisplay=genWhy||(generatingWhy?null:wine?.why_you_will_like_this)||null;
  const notes=wine?.tasting_notes||['Black Cassis','Cedar','Violets','Tobacco','Graphite'];
  const pairings=wine?.food_pairings||['Grilled Steak','Rack of Lamb','Hard Cheese'];
  const tiles=[
    {name:'Body',   plain:wine?.body_plain   ||'How heavy it feels in your mouth',lo:'Light',   hi:'Full',   val:wine?.body     ??0.85,col:'#8B1A2F'},
    {name:'Tannins',plain:wine?.tannins_plain||'That drying grip on your gums',    lo:'Silky',   hi:'Grippy', val:wine?.tannins  ??0.80,col:'#7B5EA7'},
    {name:'Acidity',plain:wine?.acidity_plain||'How zingy and fresh it tastes',    lo:'Mellow',  hi:'Zingy',  val:wine?.acidity  ??0.60,col:C.green},
    {name:'Sweetness',plain:wine?.sweetness_plain||'Dry = barely any sugar',       lo:'Bone Dry',hi:'Sweet',  val:wine?.sweetness??0.10,col:C.amber},
  ];
  const whyText=whyDisplay;
  const pairingEmojis=['🥩','🍖','🧀','🐟','🍝','🧅'];
  // matchPct arrives as prop from WineDetailScreen — no local recompute
  var wsMinPrice = retailData && retailData.priceData ? retailData.priceData.price_range : null;
  var priceDisplay = wsMinPrice || (wine && wine.price_usd ? '$' + wine.price_usd : '—');
  const commRating=wine?.community_rating||'—';
  const commCount=React.useMemo(()=>{
    const name=wine?.name||'wine'; let h=0;
    for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
    return 400+(h%4200);
  },[wine?.name]);
  return(
    <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',gap:8}}>
        {[
          {l:'Your Match',v:`${matchPct}%`,sub:null,col:C.green,bg:C.greenBg},
          {l:'Community Score',v:wine?.community_rating?`${commRating}/5`:'—',sub:wine?.community_rating?`★ ${commCount.toLocaleString()} ratings`:null,col:C.amber,bg:C.amberBg},
          {l:'Price',v:priceDisplay,sub:null,col:C.ink2,bg:C.white}
        ].map((s,i)=>(
          <div key={i} style={{flex:1,background:s.bg,borderRadius:12,padding:'9px 6px',textAlign:'center',border:`1px solid ${C.line}`}}>
            <div style={{fontSize:18,fontWeight:700,color:s.col,fontFamily:C.P}}>{s.v}</div>
            {s.sub&&<div style={{fontSize:12,color:s.col,fontFamily:C.P,marginTop:1,opacity:0.75}}>{s.sub}</div>}
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:1}}>{s.l}</div>
          </div>
        ))}
      </div>
      {existingRating>0&&(
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:14,background:C.greenBg,border:`1px solid ${C.green}30`}}>
          <div style={{flexShrink:0,padding:'6px 12px',borderRadius:10,background:C.green+'18',border:`1px solid ${C.green}30`,display:'flex',alignItems:'center',gap:3}}>
            <span style={{fontSize:28,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{existingRating}</span><span style={{fontSize:15,fontWeight:500,color:C.green,fontFamily:C.P,opacity:.65}}>/100</span>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>Your Rating</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{existingRating>=80?'Exceptional — one of your top bottles.':existingRating>=60?'A solid bottle you enjoyed.':'Noted — not quite your style.'}</div>
          </div>
        </div>
      )}
      <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
        <div style={{fontSize:16,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:3}}>Why this matches you</div>
        {generatingWhy?(
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:12,height:12,borderRadius:6,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:C.green,animation:'detailSpin .8s linear infinite',flexShrink:0}}/>
            <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Analysing your taste profile…</span>
          </div>
        ):(
          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{whyText||wine?.why_you_will_like_this||'A great match for your taste profile.'}</div>
        )}
      </Card>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>What Does It Taste Like?</span>
          <span style={{fontSize:15,color:C.cr,fontFamily:C.P,fontWeight:500}}>Tap any term</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {tiles.map((t,i)=>(
            <div key={i} style={{background:C.white,borderRadius:14,padding:'10px',border:`1px solid ${C.line}`,cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <span style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{t.name}</span>
                <div style={{width:16,height:16,borderRadius:8,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.line}`}}>
                  <span style={{fontSize:15,fontWeight:700,color:C.mid,fontFamily:C.P}}>?</span>
                </div>
              </div>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.4,marginBottom:7,minHeight:'2.7em',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{t.plain}</div>
              <Prog val={t.val} col={t.col} h={5}/>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                <span style={{fontSize:13,color:'#bbb',fontFamily:C.P}}>{t.lo}</span>
                <span style={{fontSize:13,color:'#bbb',fontFamily:C.P}}>{t.hi}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Card style={{padding:12}}>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Tasting Notes</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {notes.map((n,i)=>(
            <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?C.crSoft:C.offWhite,color:i<3?C.cr:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<3?C.crDim:C.line}`}}>{n}</span>
          ))}
        </div>
      </Card>
      <Card style={{padding:12}}>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Pairs With</div>
        <div style={{display:'flex',gap:8}}>
          {pairings.slice(0,3).map((f,i)=>(
            <div key={i} style={{flex:1,background:C.offWhite,borderRadius:10,padding:'10px 6px',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:4}}>{pairingEmojis[i]||'🍽️'}</div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontWeight:500}}>{f}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:0,overflow:'hidden'}}>
        {[
          {icon:'globe', t:wine?.sub_region||wine?.region||'Region', s:`Explore ${wine?.region||'this region'}`, screen:'region'},
          {icon:'wine',  t:wine?.grapes?.[0]||'Varietal', s:'Grape varietal & style guide', screen:'varietal'},
          {icon:'compass',t:'Similar Wines', s:'Wines you might also enjoy', screen:'similar'}
        ].map((l,i)=>(
          <div key={i} onClick={()=>nav(l.screen)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderBottom:i<2?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
            <div style={{width:36,height:36,borderRadius:9,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n={l.icon} sz={17} col={C.cr}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{l.t}</div>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{l.s}</div>
            </div>
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>
        ))}
      </Card>
      {existingRating>0
        ?<div style={{textAlign:'center',padding:'12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}25`}}><span style={{fontSize:15,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ You rated this wine {existingRating}/100</span></div>
        :<Btn primary full onClick={()=>nav('identified')}>Rate This Wine</Btn>
      }
      <style>{`@keyframes detailSpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{height:8}}/>
    </div>
  );
}

function DetailStory({wine,nav,existingRating=0}){
  const [genWhy,setGenWhy]=React.useState(null);
  const [generatingWhy,setGeneratingWhy]=React.useState(false);

  // Reads from the same localStorage cache as DetailOverview — no double fetch
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
    const prompt=`The user is looking at: ${wine.name}${wine.vintage?' '+wine.vintage:''}, a ${wine.type||'red'} from ${wine.region||wine.country||'unknown'} with body=${(wine.body??0.65).toFixed(1)}, tannins=${(wine.tannins??0.55).toFixed(1)}, acidity=${(wine.acidity??0.60).toFixed(1)}. Their ${wine.type||'red'} DNA: body ${lbl(avgB)}, tannins ${lbl(avgT)}, acidity ${lbl(avgA)}. Top rated: ${topWines||'none yet'}. Favourite grapes: ${topGrapes||'still discovering'}. Write ONE sentence (max 30 words) explaining specifically why this wine matches this user — compare attributes or reference their actual top wines by name. Be concrete, not generic. Do NOT include any numbers, decimals, or specific wine attribute values in your response. Return ONLY the sentence, no quotes.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(cacheKey,s);setGenWhy(s);})
      .catch(()=>{})
      .finally(()=>setGeneratingWhy(false));
  },[wine?.name,wine?.vintage]);

  const description=(wine?.description?.trim())||'An exceptional wine with refined character and depth.';
  const notes=wine?.tasting_notes||[];
  const pairings=wine?.food_pairings||[];
  const pairingEmojis=['🥩','🍖','🧀','🐟','🍝','🧅','🥗','🍗'];

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

  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:20}}>

      {/* Description */}
      <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.75}}>{description}</div>

      {/* Your Connection — personalised via AI */}
      <div>
        <SL label="Your Connection"/>
        <Card style={{background:C.crSoft,boxShadow:'none',border:`1px solid ${C.crDim}`,padding:14}}>
          {generatingWhy?(
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <div style={{width:13,height:13,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:C.cr,animation:'storySpin .8s linear infinite',flexShrink:0}}/>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Personalising…</span>
            </div>
          ):(
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.65}}>{genWhy||'Scan and rate more wines to unlock a personalised connection.'}</div>
          )}
        </Card>
      </div>

      {/* Tasting Notes */}
      {notes.length>0&&(
        <div>
          <SL label="Tasting Notes"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {notes.map((n,i)=>(
              <span key={i} style={{padding:'5px 13px',borderRadius:20,background:i<2?C.crSoft:C.offWhite,color:i<2?C.cr:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<2?C.crDim:C.line}`}}>{n}</span>
            ))}
          </div>
        </div>
      )}

      {/* Characteristics */}
      {chars.length>0&&(
        <div>
          <SL label="Characteristics"/>
          <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
            {chars.map((ch,i)=>(
              <div key={i} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'6px 13px',borderRadius:20,background:C.offWhite,border:`1px solid ${C.line}`}}>
                <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{ch.label}</span>
                <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{ch.value}</span>
              </div>
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

      {/* Where to Buy */}
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

      {/* Go Deeper */}
      <div>
        <SL label="Go Deeper"/>
        <div style={{display:'flex',gap:8}}>
          {[
            {i:'globe',   l:wine?.region||'Region',           screen:'region'},
            {i:'wine',    l:wine?.grapes?.[0]||'Varietal',    screen:'varietal'},
            {i:'compass', l:'Similar Wines',                  screen:'similar'},
          ].map((l,i)=>(
            <Card key={i} onClick={()=>nav(l.screen)} style={{flex:1,padding:10,textAlign:'center',cursor:'pointer'}}>
              <div style={{width:34,height:34,borderRadius:9,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 7px'}}>
                <Icon n={l.i} sz={16} col={C.cr}/>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.l}</div>
            </Card>
          ))}
        </div>
      </div>

      {existingRating>0
        ?<div style={{textAlign:'center',padding:'12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}25`}}><span style={{fontSize:15,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ You rated this wine {existingRating}/100</span></div>
        :<Btn primary full onClick={()=>nav('identified')}>Rate This Wine</Btn>
      }
      <style>{`@keyframes storySpin{to{transform:rotate(360deg)}}`}</style>
      <div style={{height:8}}/>
    </div>
  );
}

function DetailData({wine,nav,existingRating=0,matchPct}){
  const notes=wine?.tasting_notes||['Black Cassis','Cedar','Violets','Tobacco','Graphite','Dark Plum'];
  const vintage=wine?.vintage;

  // Characteristics (same as DetailStory)
  const charLbl=(v,lo,hi)=>v>=0.68?hi:v>=0.38?'Medium':lo;
  const chars=wine?[
    {label:'Body',      value:charLbl(wine.body??0.65,    'Light',    'Full')},
    {label:'Tannins',   value:charLbl(wine.tannins??0.55, 'Silky',    'Grippy')},
    {label:'Acidity',   value:charLbl(wine.acidity??0.60, 'Mellow',   'Zingy')},
    {label:'Sweetness', value:charLbl(wine.sweetness??0.10,'Bone Dry','Sweet')},
    ...(wine.abv?[{label:'ABV', value:`${wine.abv}%`}]:[]),
  ]:[];

  const [vintageInfo,setVintageInfo]=React.useState(null);
  const [loadingVintage,setLoadingVintage]=React.useState(false);
  React.useEffect(()=>{
    if(!wine||!vintage) return;
    const cacheKey=`vinterest_vintage_${(wine.name||'').replace(/\s/g,'_')}_${vintage}`;
    const cached=localStorage.getItem(cacheKey);
    if(cached){try{setVintageInfo(JSON.parse(cached));return;}catch(e){}}
    setLoadingVintage(true);
    const yr=new Date().getFullYear();
    const prompt=`You are a sommelier. Assess the vintage quality and realistic drinking window for this specific wine. Wine: ${wine.name} ${vintage}. Type: ${wine.type||'red'}, Region: ${wine.region||''}, Country: ${wine.country||''}. Grapes: ${(wine.grapes||[]).join(', ')||'unknown'}. Body: ${(wine.body??0.65).toFixed(1)}, Tannins: ${(wine.tannins??0.55).toFixed(1)}, Acidity: ${(wine.acidity??0.60).toFixed(1)}, ABV: ${wine.abv||13}%. Return ONLY valid JSON (no markdown): {"vintage_rating":"Exceptional|Outstanding|Very Good|Good|Average","drink_from":${yr},"drink_to":2032,"peak_from":2025,"peak_to":2029,"note":"one concrete sentence on how this wine is developing right now and why. Do NOT include any numbers, decimals, or specific attribute values in the sentence."}`;
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
  },[wine?.name,vintage]);
  return(
    <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
      {/* Match + Rating — side by side */}
      <div style={{display:'flex',gap:10}}>
        <div style={{flex:1,background:C.greenBg,borderRadius:16,padding:'18px 8px',textAlign:'center',border:`1px solid ${C.green}25`}}>
          <div style={{fontSize:32,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{matchPct!=null?`${matchPct}%`:'—'}</div>
          <div style={{fontSize:13,fontWeight:600,color:C.green,fontFamily:C.P,marginTop:5,opacity:.8}}>Your Match</div>
        </div>
        {existingRating>0&&(
          <div style={{flex:1,background:C.amberBg,borderRadius:16,padding:'18px 8px',textAlign:'center',border:`1px solid ${C.amber}25`}}>
            <div style={{fontSize:32,fontWeight:800,color:C.amber,fontFamily:C.P,lineHeight:1}}>{existingRating}</div>
            <div style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P,marginTop:5,opacity:.8}}>Your Rating</div>
          </div>
        )}
      </div>
      <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:2,textAlign:'center'}}>{[wine?.region,wine?.grapes?.[0],wine?.type?wine.type.charAt(0).toUpperCase()+wine.type.slice(1):null].filter(Boolean).join(' · ')}</div>
      <Card style={{padding:12}}>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Taste Profile</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px'}}>
          {chars.map((ch,i)=>{
            const val=wine[ch.label.toLowerCase()]??({Body:0.65,Tannins:0.55,Acidity:0.60,Sweetness:0.10}[ch.label]||0.5);
            return(
              <div key={i}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{ch.label}</span>
                  <span style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P}}>{ch.value}</span>
                </div>
                <Prog val={val} col={C.cr} h={4}/>
              </div>
            );
          })}
        </div>
      </Card>
      <Card style={{padding:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{vintage?`${vintage} Vintage`:'Vintage'}</div>
          {loadingVintage&&<div style={{width:13,height:13,borderRadius:7,border:'2px solid rgba(0,0,0,0.07)',borderTopColor:C.cr,animation:'dataSpin .8s linear infinite'}}/>}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[
            {l:'Vintage Rating', v:vintageInfo?.vintage_rating||'—'},
            {l:'Drink Window',   v:vintageInfo?(()=>{const yr=new Date().getFullYear();return`${vintageInfo.drink_from<=yr?'Now':vintageInfo.drink_from} – ${vintageInfo.drink_to}`;})():'—'},
            {l:'Peak',           v:vintageInfo?`${vintageInfo.peak_from} – ${vintageInfo.peak_to}`:'—'},
            {l:'ABV',            v:wine?.abv?`${wine.abv}%`:'—'},
          ].map((d,i)=>(
            <div key={i} style={{background:C.offWhite,borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:2}}>{d.l}</div>
              <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{d.v}</div>
            </div>
          ))}
        </div>
        {vintageInfo?.note&&(
          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55,marginTop:10,padding:'8px 10px',borderRadius:8,background:C.offWhite}}>{vintageInfo.note}</div>
        )}
        <style>{`@keyframes dataSpin{to{transform:rotate(360deg)}}`}</style>
      </Card>
      <Card style={{padding:12}}>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:7}}>Tasting Notes</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {notes.map((n,i)=>(
            <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?C.crSoft:C.offWhite,color:i<3?C.cr:C.ink2,fontSize:15,fontFamily:C.P,fontWeight:500,border:`1px solid ${i<3?C.crDim:C.line}`}}>{n}</span>
          ))}
        </div>
      </Card>
      <div style={{height:8}}/>
    </div>
  );
}

Object.assign(window,{WineDetailScreen});
