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

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px 0',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{display:'flex',gap:14,cursor:'pointer'}}>
            <Icon n="heart" sz={20} col={C.mid}/>
            <Icon n="share" sz={20} col={C.mid}/>
          </div>
        </div>
        <div style={{display:'flex',gap:14,alignItems:'flex-end',marginBottom:14}}>
          <div style={{width:52,height:74,borderRadius:10,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
            <Icon n="wine" sz={24} col={C.cr}/>
          </div>
          <div>
            <div style={{fontSize:24,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.15}}>{wine?.name||'Château Margaux'}</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3}}>{wine?`${wine.vintage||'NV'} · ${wine.region}, ${wine.country}`:'2018 · Bordeaux, France'}</div>
            <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}><Pill active sm style={{textTransform:'capitalize'}}>{wine?.type||'Red'}</Pill>{wine?.grapes?.[0]&&<Pill sm>{wine.grapes[0]}</Pill>}</div>
          </div>
        </div>
        <div style={{display:'flex',borderBottom:`1px solid ${C.line}`}}>
          {tabs.map((t,i)=>(
            <div key={i} onClick={()=>setTab(i)} style={{flex:1,textAlign:'center',paddingBottom:10,fontSize:16,fontWeight:i===tab?600:400,color:i===tab?C.cr:C.mid,fontFamily:C.P,borderBottom:i===tab?`2px solid ${C.cr}`:'none',marginBottom:-1,cursor:'pointer'}}>{t}</div>
          ))}
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        {tab===0&&<DetailOverview wine={wine} nav={nav} existingRating={existingRating}/>}
        {tab===1&&<DetailStory wine={wine} nav={nav} existingRating={existingRating}/>}
        {tab===2&&<DetailData wine={wine} nav={nav} existingRating={existingRating}/>}
      </div>
    </div>
  );
}

function DetailOverview({wine,nav,existingRating=0}){
  const notes=wine?.tasting_notes||['Black Cassis','Cedar','Violets','Tobacco','Graphite'];
  const pairings=wine?.food_pairings||['Grilled Steak','Rack of Lamb','Hard Cheese'];
  const tiles=[
    {name:'Body',   plain:wine?.body_plain   ||'How heavy it feels in your mouth',lo:'Light',   hi:'Full',   val:wine?.body     ??0.85,col:'#8B1A2F'},
    {name:'Tannins',plain:wine?.tannins_plain||'That drying grip on your gums',    lo:'Silky',   hi:'Grippy', val:wine?.tannins  ??0.80,col:'#7B5EA7'},
    {name:'Acidity',plain:wine?.acidity_plain||'How zingy and fresh it tastes',    lo:'Mellow',  hi:'Zingy',  val:wine?.acidity  ??0.60,col:C.green},
    {name:'Sweetness',plain:wine?.sweetness_plain||'Dry = barely any sugar',       lo:'Bone Dry',hi:'Sweet',  val:wine?.sweetness??0.10,col:C.amber},
  ];
  const whyText=wine?.why_you_will_like_this||'Full-bodied with dark fruit and earthy notes — aligns with your preference for structured Bordeaux-style reds.';
  const pairingEmojis=['🥩','🍖','🧀','🐟','🍝','🧅'];
  const matchPct=wine?Math.round((JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}').confidence||0.94)*100):94;
  const price=wine?.price_usd?`$${wine.price_usd}`:'—';
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
          {l:'Price',v:price,sub:null,col:C.ink2,bg:C.white}
        ].map((s,i)=>(
          <div key={i} style={{flex:1,background:s.bg,borderRadius:12,padding:'9px 6px',textAlign:'center',border:`1px solid ${C.line}`}}>
            <div style={{fontSize:18,fontWeight:700,color:s.col,fontFamily:C.P}}>{s.v}</div>
            {s.sub&&<div style={{fontSize:10,color:s.col,fontFamily:C.P,marginTop:1,opacity:0.75}}>{s.sub}</div>}
            <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:1}}>{s.l}</div>
          </div>
        ))}
      </div>
      {existingRating>0&&(
        <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 14px',borderRadius:14,background:C.greenBg,border:`1px solid ${C.green}30`}}>
          <div style={{flexShrink:0,padding:'6px 12px',borderRadius:10,background:C.green+'18',border:`1px solid ${C.green}30`,display:'flex',alignItems:'center',gap:3}}>
            <span style={{fontSize:28,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>{existingRating}</span><span style={{fontSize:13,fontWeight:500,color:C.green,fontFamily:C.P,opacity:.65}}>/100</span>
          </div>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>Your Rating</div>
            <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{existingRating>=80?'Exceptional — one of your top bottles.':existingRating>=60?'A solid bottle you enjoyed.':'Noted — not quite your style.'}</div>
          </div>
        </div>
      )}
      <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:3}}>Why this matches you</div>
        <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{whyText}</div>
      </Card>
      <div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>What Does It Taste Like?</span>
          <span style={{fontSize:13,color:C.cr,fontFamily:C.P,fontWeight:500}}>Tap any term</span>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {tiles.map((t,i)=>(
            <div key={i} style={{background:C.white,borderRadius:14,padding:'10px',border:`1px solid ${C.line}`,cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:3}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{t.name}</span>
                <div style={{width:16,height:16,borderRadius:8,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.line}`}}>
                  <span style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P}}>?</span>
                </div>
              </div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4,marginBottom:7,minHeight:'2.7em',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{t.plain}</div>
              <Prog val={t.val} col={t.col} h={5}/>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                <span style={{fontSize:12,color:'#bbb',fontFamily:C.P}}>{t.lo}</span>
                <span style={{fontSize:12,color:'#bbb',fontFamily:C.P}}>{t.hi}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Card style={{padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Tasting Notes</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {notes.map((n,i)=>(
            <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?C.crSoft:C.offWhite,color:i<3?C.cr:C.ink2,fontSize:14,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<3?C.crDim:C.line}`}}>{n}</span>
          ))}
        </div>
      </Card>
      <Card style={{padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Pairs With</div>
        <div style={{display:'flex',gap:8}}>
          {pairings.slice(0,3).map((f,i)=>(
            <div key={i} style={{flex:1,background:C.offWhite,borderRadius:10,padding:'10px 6px',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:4}}>{pairingEmojis[i]||'🍽️'}</div>
              <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,fontWeight:500}}>{f}</div>
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
              <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{l.t}</div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{l.s}</div>
            </div>
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>
        ))}
      </Card>
      {existingRating>0
        ?<div style={{textAlign:'center',padding:'12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}25`}}><span style={{fontSize:14,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ You rated this wine {existingRating}/100</span></div>
        :<Btn primary full onClick={()=>nav('identified')}>Rate This Wine</Btn>
      }
      <div style={{height:8}}/>
    </div>
  );
}

function DetailStory({wine,nav,existingRating=0}){
  function buildDescription(w){
    if(!w) return null;
    const region=[w.sub_region,w.region,w.country].filter(Boolean).join(', ');
    const grape=w.grapes?.length?w.grapes.slice(0,2).join(' and '):null;
    const notes=w.tasting_notes?.length?w.tasting_notes.slice(0,3).join(', '):null;
    const parts=[];
    parts.push(`${w.name} is a ${w.type||'red'} wine from ${region||'an acclaimed region'}.`);
    if(grape) parts.push(`Crafted from ${grape}.`);
    if(notes) parts.push(`Expect notes of ${notes}.`);
    return parts.join(' ');
  }
  function buildWhy(w){
    if(!w) return null;
    const grape=w.grapes?.[0];
    return `This ${w.type||'red'} from ${w.region||w.country||'the region'} offers the ${grape||'varietal'} character that aligns well with your taste profile.`;
  }
  const description=(wine?.description?.trim())||buildDescription(wine)||'An exceptional wine with refined character and depth.';
  const whyText=(wine?.why_you_will_like_this?.trim())||buildWhy(wine)||'A great match for your evolving palate.';
  const tags=[...(wine?.tasting_notes||[]).slice(0,3),'Full Body','Dry',...(wine?.food_pairings||[]).slice(0,2).map(f=>`Pairs: ${f}`)];
  return(
    <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>

      <div>
        <div style={{display:'flex',gap:5,marginBottom:6,flexWrap:'wrap'}}>
          <Pill active sm>94% Match</Pill><Pill sm>Full Body</Pill><Pill sm>Dry</Pill>
        </div>
        <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.7}}>{description}</div>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
        {tags.map((f,i)=>(
          <span key={i} style={{padding:'4px 10px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:13,fontWeight:500,fontFamily:C.P,border:`1px solid ${C.line}`}}>{f}</span>
        ))}
      </div>
      <Card style={{background:C.crSoft,boxShadow:'none',border:`1px solid ${C.crDim}`,padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,marginBottom:5}}>Your connection to this wine</div>
        <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.6}}>{whyText}</div>
      </Card>
      <div>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Go Deeper</div>
        <div style={{display:'flex',gap:8}}>
          {[
            {i:'globe', l:wine?.region||'Region', screen:'region'},
            {i:'wine',  l:wine?.grapes?.[0]||'Varietal', screen:'varietal'},
            {i:'compass',l:'Similar', screen:'similar'}
          ].map((l,i)=>(
            <Card key={i} onClick={()=>nav(l.screen)} style={{flex:1,padding:10,textAlign:'center',cursor:'pointer'}}>
              <div style={{width:32,height:32,borderRadius:9,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 6px'}}>
                <Icon n={l.i} sz={15} col={C.cr}/>
              </div>
              <div style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.l}</div>
            </Card>
          ))}
        </div>
      </div>
      {existingRating>0
        ?<div style={{textAlign:'center',padding:'12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}25`}}><span style={{fontSize:14,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ You rated this wine {existingRating}/100</span></div>
        :<Btn primary full onClick={()=>nav('identified')}>Rate This Wine</Btn>
      }
      <div style={{height:8}}/>
    </div>
  );
}

function DetailData({wine,nav,existingRating=0}){
  const notes=wine?.tasting_notes||['Black Cassis','Cedar','Violets','Tobacco','Graphite','Dark Plum'];
  const vintage=wine?.vintage;
  return(
    <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
      <div style={{textAlign:'center',padding:'4px 0 2px'}}>
        <div style={{width:68,height:68,borderRadius:34,border:`3px solid ${C.green}`,background:C.greenBg,display:'inline-flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
          <span style={{fontSize:24,fontWeight:800,color:C.green,fontFamily:C.P,lineHeight:1}}>94</span>
          <span style={{fontSize:12,color:C.green,fontFamily:C.P,opacity:.7}}>% match</span>
        </div>
        <div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:5}}>{[wine?.region,wine?.grapes?.[0],wine?.type,'Dry'].filter(Boolean).join(' · ')}</div>
      </div>
      <Card style={{padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Taste Profile</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px'}}>
          {[{l:'Body',v:.85},{l:'Tannins',v:.8},{l:'Acidity',v:.6},{l:'Sweetness',v:.1},{l:'Alcohol',v:.7},{l:'Fruit Intensity',v:.78}].map((t,i)=>(
            <div key={i}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{t.l}</span>
                <span style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P}}>{(wine?.[t.l.toLowerCase().replace(' intensity','')]??t.v)>=.7?'High':(wine?.[t.l.toLowerCase().replace(' intensity','')]??t.v)>=.4?'Med':'Low'}</span>
              </div>
              <Prog val={wine?.[t.l.toLowerCase().replace(' intensity','')]??t.v} col={C.cr} h={4}/>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>{vintage?`${vintage} Vintage`:'Vintage'}</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[{l:'Vintage Rating',v:'Exceptional'},{l:'Drink Window',v:vintage?`Now – ${vintage+30}`:'Now – 2050'},{l:'Peak',v:vintage?`${vintage+12} – ${vintage+22}`:'2030 – 2040'},{l:'ABV',v:wine?.abv?`${wine.abv}%`:'—'}].map((d,i)=>(
            <div key={i} style={{background:C.offWhite,borderRadius:8,padding:'8px 10px'}}>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:2}}>{d.l}</div>
              <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{d.v}</div>
            </div>
          ))}
        </div>
      </Card>
      <Card style={{padding:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:7}}>Tasting Notes</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
          {notes.map((n,i)=>(
            <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?C.crSoft:C.offWhite,color:i<3?C.cr:C.ink2,fontSize:13,fontFamily:C.P,fontWeight:500,border:`1px solid ${i<3?C.crDim:C.line}`}}>{n}</span>
          ))}
        </div>
      </Card>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        {existingRating>0
          ?<div style={{flex:2,textAlign:'center',padding:'12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}25`}}><span style={{fontSize:14,fontWeight:600,color:C.green,fontFamily:C.P}}>✓ Rated {existingRating}/100</span></div>
          :<Btn primary full style={{flex:1}} onClick={()=>nav('identified')}>Rate Wine</Btn>
        }
        <Btn full style={{flex:1}}>Add to List</Btn>
      </div>
    </div>
  );
}

Object.assign(window,{WineDetailScreen});
