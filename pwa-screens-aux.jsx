/* Vinterest PWA — Taste Profile, Restaurant, Learn screens */

function TasteProfileScreen({nav,back,showPro}){
  const [tab,setTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
  const [scriptLength,setScriptLength]=React.useState(localStorage.getItem('vinterest_script_length')||'long');
  const [generating,setGenerating]=React.useState(null);
  const [copied,setCopied]=React.useState(false);


  const allWines=React.useMemo(()=>WineHistory.getAll(),[]);
  const profile=React.useMemo(()=>WineHistory.getProfile(),[]);

  function winesOfType(typeKey){
    return allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===typeKey);
  }
  function deriveTagsFromWines(wines,defaults){
    const counts={};
    wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{counts[t]=(counts[t]||0)+1;}));
    const derived=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e[0]);
    return derived.length>=3?derived:defaults;
  }

  const cats=[
    {col:'#8B1A2F',label:'Reds',      typeKey:'red',
     defaultTags:['Full Body','Earthy','Dark Fruit','High Tannins','Dry','Cedar'],
     pct:profile.total?Math.round(profile.redPct*100):0},
    {col:'#B8963E',label:'Whites',    typeKey:'white',
     defaultTags:['Crisp','Mineral','Citrus','Dry','Light Body','Herbaceous'],
     pct:profile.total?Math.round(profile.whitePct*100):0},
    {col:'#C47A8A',label:'Rosé',      typeKey:'rose',
     defaultTags:['Bone Dry','Delicate','Red Fruit','Light Body','Crisp'],
     pct:profile.total?Math.round(profile.rosePct*100):0},
    {col:'#5E8FA8',label:'Sparkling', typeKey:'sparkling',
     defaultTags:['Brut','Brioche','Citrus','Fine Bubbles','Toasty'],
     pct:profile.total?Math.round(profile.sparklingPct*100):0},
  ];

  const c=cats[tab];
  const tabWines=winesOfType(c.typeKey);
  const topWines=tabWines.slice(0,3);
  const displayTags=deriveTagsFromWines(tabWines,c.defaultTags);
  const displayScript=genScripts[c.typeKey]||null;
  const isGenerating=generating===c.typeKey;

  // Auto-generate script from real wine data when tab opens
  React.useEffect(()=>{
    if(!tabWines.length) return;
    const keyLong=`vinterest_script_long_${c.typeKey}_n${tabWines.length}`;
    const keyShort=`vinterest_script_short_${c.typeKey}_n${tabWines.length}`;
    const cacheKey=scriptLength==='long'?keyLong:keyShort;
    const cached=localStorage.getItem(cacheKey);
    if(cached){setGenScripts(s=>({...s,[c.typeKey]:cached}));return;}
    if(generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>
      `${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}`
    ).join('; ');
    const lengthInstructions=scriptLength==='short'?'1 sentence, ultra-concise (under 20 words), and mention your typical budget range':'2 sentences max';
    const prompt=`I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a ${lengthInstructions} natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{
        const script=text.trim();
        localStorage.setItem(cacheKey,script);
        setGenScripts(s=>({...s,[c.typeKey]:script}));
      })
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[tab,allWines.length,scriptLength]);

  if(allWines.length===0) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
      <div style={{background:C.white,padding:'18px 20px',borderBottom:'1px solid '+C.line,flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>Profile</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid '+C.crDim}}>
          <Icon n="wine" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your profile is waiting</div>
          <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and rate bottles to build your personal taste profile. The more you scan, the smarter it gets.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
        <Card style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer',width:'100%'}} onClick={()=>nav('learn')}>
          <span style={{fontSize:24}}>🎓</span>
          <div style={{flex:1,textAlign:'left'}}>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>Take a quiz first</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>Earn XP while you build your collection</div>
          </div>
          <Icon n="chevron" sz={14} col={C.mid}/>
        </Card>
      </div>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Taste Profile</div>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>
            {allWines.length>0?`${allWines.length} wine${allWines.length!==1?'s':''} scanned`:'No wines scanned yet'}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:'flex',background:C.white,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {cats.map((ct,i)=>(
          <div key={i} onClick={()=>setTab(i)} style={{flex:1,textAlign:'center',padding:'10px 4px',cursor:'pointer',borderBottom:i===tab?`2px solid ${ct.col}`:'2px solid transparent',marginBottom:-1}}>
            <div style={{width:8,height:8,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
            <div style={{fontSize:15,fontWeight:i===tab?700:400,color:i===tab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{ct.pct>0?`${ct.pct}%`:'—'}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Sommelier script card */}
        <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}30`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <Icon n="message" sz={15} col={c.col}/>
              <span style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
            </div>
            {tabWines.length>0&&!isGenerating&&(
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
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>
                Scan and rate some {c.label.toLowerCase()} to generate your personalised sommelier script.
              </div>
              <Btn primary small onClick={()=>nav('camera')} style={{background:c.col,boxShadow:`0 3px 12px ${c.col}40`}}>Scan a Bottle</Btn>
            </div>
          ):isGenerating?(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0 10px'}}>
              <div style={{width:18,height:18,borderRadius:9,border:'2px solid rgba(0,0,0,0.1)',borderTopColor:c.col,animation:'vspin 0.8s linear infinite',flexShrink:0}}/>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing your personalised script…</span>
            </div>
          ):(
            <>
              <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6,marginBottom:10}}>
                {displayScript||'Generating your script…'}
              </div>
              <div style={{display:'flex',gap:8}}>
                <Btn primary small
                  onClick={()=>{try{navigator.clipboard.writeText((displayScript||'').replace(/"/g,''));setCopied(true);setTimeout(()=>setCopied(false),2000);}catch(e){}}}
                  style={{background:c.col,boxShadow:`0 3px 12px ${c.col}40`}}>{copied?'Copied!':'Copy Script'}</Btn>
                <Btn small onClick={()=>{
                  const key=`vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
                  localStorage.removeItem(key);
                  setGenScripts(s=>{const n={...s};delete n[c.typeKey];return n;});
                }}>Regenerate</Btn>
              </div>
            </>
          )}
        </Card>

        {/* Flavour tags — from actual tasting notes */}
        <Card style={{padding:12}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Flavour Profile</div>
          {tabWines.length===0?(
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Will populate from your scanned wines</div>
          ):(
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {displayTags.map((t,i)=>(
                <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?c.col+'15':C.offWhite,color:i<3?c.col:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<3?c.col+'30':C.line}`}}>{t}</span>
              ))}
            </div>
          )}
        </Card>

        {/* Top wines — real data only */}
        <Card style={{padding:0}}>
          <div style={{padding:'12px 14px 8px',fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Your Top {c.label}</div>
          {topWines.length===0?(
            <div style={{padding:'10px 14px 14px',fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Scan some {c.label.toLowerCase()} to see your top bottles here</div>
          ):topWines.map((w,i)=>(
            <div key={i} onClick={()=>{
              sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9}));
              nav('detail');
            }} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
              <div style={{width:32,height:44,borderRadius:6,background:c.col+'12',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={c.col}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                  {w.region&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{w.region}</span>}
                  {w.rating>0&&<><span style={{fontSize:13,color:C.line,fontFamily:C.P}}>·</span><span style={{fontSize:13,fontWeight:700,color:C.amber,fontFamily:C.P}}>{w.rating}/100</span></>}
                </div>
              </div>
              <Icon n="chevron" sz={12} col={C.mid}/>
            </div>
          ))}          
        </Card>

        {/* XP Progress — live from XPSystem */}
        {(()=>{
          const xd=XPSystem.get();
          const lv=XPSystem.getLevel(xd.total);
          const nx=XPSystem.nextLevel(xd.total);
          const pg=XPSystem.levelProgress(xd.total);
          return(
            <Card style={{padding:12}} onClick={()=>nav('learn')}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{lv.badge} {lv.name}</span>
                <span style={{fontSize:15,color:C.cr,fontWeight:600,fontFamily:C.P}}>{xd.total} XP</span>
              </div>
              <Prog val={pg} h={7} col={lv.color}/>
              {nx&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:4}}>{nx.min-xd.total} XP to {nx.name} — tap to quiz</div>}
            </Card>
          );
        })()}

        {/* Data backup */}
        <Card style={{padding:12}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1,fontSize:15}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');
              a.href=url;
              a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1,fontSize:15}} onClick={()=>{
              const inp=document.createElement('input');
              inp.type='file'; inp.accept='.json,application/json';
              inp.onchange=e=>{
                const file=e.target.files[0]; if(!file) return;
                const reader=new FileReader();
                reader.onload=ev=>{
                  try{
                    const d=JSON.parse(ev.target.result);
                    if(d.wines) WineHistory.save(d.wines);
                    if(d.xp) localStorage.setItem(XPSystem.KEY,JSON.stringify(d.xp));
                    alert('Restored! '+((d.wines||[]).length)+' wines imported.');
                    window.location.reload();
                  }catch(err){ alert('Could not read backup file.'); }
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP to a JSON file on your phone. Import restores from a previous backup.</div>
        </Card>
        {/* App version */}
        <div style={{textAlign:'center',padding:'12px 0 4px',opacity:0.45}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v1.0.38</span>
        </div>
        <div style={{height:8}}/>
      </div>
</div>

      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function MyWinesScreen({nav,back}){
  const [filter,setFilter]=React.useState('all');
  const [sort,setSort]=React.useState('recent');
  const [wines,setWines]=React.useState(()=>WineHistory.getAll());
  const [activePills,setActivePills]=React.useState([]);

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};

  const filtered=wines.filter(w=>{
    if(filter!=='all'){
      const t=(w.type||'').toLowerCase().replace('é','e');
      if(t!==filter) return false;
    }
    if(activePills.length===0) return true;
    return activePills.every(p=>{
      if(p.type==='grape') return w.grapes&&w.grapes.includes(p.value);
      if(p.type==='region') return w.region===p.value;
      if(p.type==='country') return w.country===p.value;
      if(p.type==='vintage') return w.vintage===p.value;
      return true;
    });
  }).sort((a,b)=>{
    if(sort==='rating') return (b.rating||0)-(a.rating||0);
    if(sort==='name') return (a.name||'').localeCompare(b.name||'');
    return new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0);
  });

  const togglePill=(type,value)=>{
    const existing=activePills.find(p=>p.type===type&&p.value===value);
    if(existing){
      setActivePills(activePills.filter(p=>!(p.type===type&&p.value===value)));
    }else{
      setActivePills([...activePills,{type,value}]);
    }
  };

  const removePill=(type,value)=>{
    setActivePills(activePills.filter(p=>!(p.type===type&&p.value===value)));
  };

  const TYPE_COLS={all:C.cr,red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const filterTabs=[{k:'all',l:'All'},{k:'red',l:'Reds'},{k:'white',l:'Whites'},{k:'rose',l:'Rosé'},{k:'sparkling',l:'Sparkling'}];
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;

  /* Stats for current filter */
  const statsRated=filtered.filter(w=>w.rating>0);
  const statsAvgRating=statsRated.length?Math.round(statsRated.reduce((s,w)=>s+w.rating,0)/statsRated.length):0;
  const statsCountries=new Set(filtered.map(w=>w.country).filter(Boolean)).size;
  const statsPrices=filtered.filter(w=>w.price_usd>0);
  const statsAvgPrice=statsPrices.length?Math.round(statsPrices.reduce((s,w)=>s+w.price_usd,0)/statsPrices.length):0;
  const activeCol=TYPE_COLS[filter]||C.cr;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 0',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:19,fontWeight:700,color:C.ink,fontFamily:C.P}}>My Wines</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{wines.length} {wines.length===1?'bottle':'bottles'} scanned</div>
          </div>
          {/* Sort */}
          <div style={{display:'flex',gap:0,background:C.offWhite,borderRadius:8,overflow:'hidden',border:`1px solid ${C.line}`}}>
            {[{k:'recent',l:'Recent'},{k:'rating',l:'Top'},{k:'name',l:'A–Z'}].map((s,i)=>(
              <div key={i} onClick={()=>setSort(s.k)} style={{padding:'6px 10px',background:sort===s.k?C.cr:'transparent',cursor:'pointer'}}>
                <span style={{fontSize:15,fontWeight:600,color:sort===s.k?'#fff':C.mid,fontFamily:C.P}}>{s.l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Active pill filters */}
        {activePills.length>0&&(
          <div style={{marginBottom:12,display:'flex',flexWrap:'wrap',gap:6}}>
            {activePills.map((p,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
                <span style={{fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P}}>{p.value}</span>
                <div onClick={()=>removePill(p.type,p.value)} style={{width:18,height:18,borderRadius:9,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'#fff',fontSize:12,fontWeight:700}}>×</div>
              </div>
            ))}
          </div>
        )}
        {/* Stats strip */}
        {wines.length>0&&(
          <div style={{display:'flex',borderBottom:`1px solid ${C.line}`,padding:'10px 0',marginBottom:0}}>
            {[
              {val:filtered.length, label:filter==='all'?'All Bottles':filterTabs.find(f=>f.k===filter)?.l||filter, col:activeCol},
              {val:statsAvgRating?`${statsAvgRating}/100`:'—', label:'Avg Rating', col:C.amber},
              {val:statsCountries||'—', label:'Countries', col:C.green},
              ...(statsAvgPrice>0?[{val:`${statsAvgPrice}`,label:'Avg Price',col:C.ink2}]:[]),
            ].map((s,i,arr)=>(
              <div key={i} style={{flex:1,textAlign:'center',borderRight:i<arr.length-1?`1px solid ${C.line}`:'none'}}>
                <div style={{fontSize:17,fontWeight:800,color:s.col,fontFamily:C.P,lineHeight:1}}>{s.val}</div>
                <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:3}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
        {/* Filter tabs */}
        <div style={{display:'flex',gap:0,marginBottom:0}}>
          {filterTabs.map((t,i)=>(
            <div key={i} onClick={()=>setFilter(t.k)} style={{flex:1,textAlign:'center',padding:'8px 4px',cursor:'pointer',borderBottom:filter===t.k?`2px solid ${TYPE_COLS[t.k]||C.cr}`:'2px solid transparent',marginBottom:-1}}>
              <span style={{fontSize:15,fontWeight:filter===t.k?700:400,color:filter===t.k?TYPE_COLS[t.k]||C.cr:C.mid,fontFamily:C.P}}>{t.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:'auto'}}>
        {filtered.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:40,textAlign:'center',gap:12}}>
            {wines.length===0?(
              <>
                <div style={{fontSize:48}}>🍷</div>
                <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>No wines yet</div>
                <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Scan your first bottle to start building your collection</div>
                <Btn primary onClick={()=>nav('camera')}>Scan a Bottle</Btn>
              </>
            ):(
              <>
                <div style={{fontSize:36,marginBottom:4}}>🔍</div>
                <div style={{fontSize:17,color:C.mid,fontFamily:C.P}}>No {filter} wines scanned yet</div>
              </>
            )}
          </div>
        ):(
          <div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
            {filtered.map((w,i)=>{
              const col=colFor(w);
              const date=w.last_scanned||w.scanned_at;
              const dateStr=date?new Date(date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}):'';
              return(
                <Card key={i} style={{padding:12,cursor:'pointer'}} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                    {/* Wine icon */}
                    <div style={{width:44,height:60,borderRadius:8,background:col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${col}25`}}>
                      <Icon n="wine" sz={20} col={col}/>
                    </div>
                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                        <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2,flex:1}}>{w.name||'Unknown Wine'}</div>
                        <div style={{fontSize:15,fontWeight:600,color:col,fontFamily:C.P,textTransform:'capitalize',flexShrink:0,padding:'2px 8px',borderRadius:20,background:col+'12'}}>{w.type||'Red'}</div>
                      </div>
                      <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:4,display:'flex',flexWrap:'wrap',gap:6}}>
                        {w.grapes&&w.grapes.length>0&&(
                          <div onClick={e=>{e.stopPropagation();togglePill('grape',w.grapes[0]);}} style={{padding:'4px 10px',borderRadius:20,background:activePills.find(p=>p.type==='grape'&&p.value===w.grapes[0])?'#D5C0E840':'#D5C0E815',border:`1px solid ${activePills.find(p=>p.type==='grape'&&p.value===w.grapes[0])?'#9B4C6F':'#9B4C6F40'}`,cursor:'pointer'}}>
                            <span style={{fontSize:13,fontWeight:500,color:activePills.find(p=>p.type==='grape'&&p.value===w.grapes[0])?'#9B4C6F':C.ink2,fontFamily:C.P}}>{w.grapes[0]}</span>
                          </div>
                        )}
                        {w.region&&(
                          <div onClick={e=>{e.stopPropagation();togglePill('region',w.region);}} style={{padding:'4px 10px',borderRadius:20,background:activePills.find(p=>p.type==='region'&&p.value===w.region)?'#E8D5C440':'#E8D5C415',border:`1px solid ${activePills.find(p=>p.type==='region'&&p.value===w.region)?'#B8963E':'#B8963E40'}`,cursor:'pointer'}}>
                            <span style={{fontSize:13,fontWeight:500,color:activePills.find(p=>p.type==='region'&&p.value===w.region)?'#B8963E':C.ink2,fontFamily:C.P}}>{w.region}</span>
                          </div>
                        )}
                        {w.country&&(
                          <div onClick={e=>{e.stopPropagation();togglePill('country',w.country);}} style={{padding:'4px 10px',borderRadius:20,background:activePills.find(p=>p.type==='country'&&p.value===w.country)?'#C5E5E240':'#C5E5E215',border:`1px solid ${activePills.find(p=>p.type==='country'&&p.value===w.country)?'#5E8FA8':'#5E8FA840'}`,cursor:'pointer'}}>
                            <span style={{fontSize:13,fontWeight:500,color:activePills.find(p=>p.type==='country'&&p.value===w.country)?'#5E8FA8':C.ink2,fontFamily:C.P}}>{w.country}</span>
                          </div>
                        )}
                        {w.vintage&&(
                          <div onClick={e=>{e.stopPropagation();togglePill('vintage',w.vintage);}} style={{padding:'4px 10px',borderRadius:20,background:activePills.find(p=>p.type==='vintage'&&p.value===w.vintage)?C.greenBg:C.greenBg.replace('0.15','0.08'),border:`1px solid ${activePills.find(p=>p.type==='vintage'&&p.value===w.vintage)?C.green:C.green+'40'}`,cursor:'pointer'}}>
                            <span style={{fontSize:13,fontWeight:500,color:activePills.find(p=>p.type==='vintage'&&p.value===w.vintage)?C.green:C.ink2,fontFamily:C.P}}>{w.vintage}</span>
                          </div>
                        )}
                      </div>
                      {/* Score */}
                      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:5}}>
                        {w.rating>0&&(
                          <div style={{display:'inline-flex',alignItems:'baseline',gap:2,padding:'2px 8px',borderRadius:20,background:C.amberBg}}>
                            <span style={{fontSize:17,fontWeight:700,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                            <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>/100</span>
                          </div>
                        )}
                        {w.times_consumed>1&&<span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>×{w.times_consumed}</span>}
                        <span style={{fontSize:15,color:C.mid,fontFamily:C.P,marginLeft:'auto'}}>{dateStr}</span>
                      </div>
                      {/* Tasting notes preview */}
                      {w.tasting_notes?.length>0&&(
                        <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3,fontStyle:'italic'}}>
                          {w.tasting_notes.slice(0,3).join(' · ')}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Re-rate inline (legacy unscored entries) */}
                  {(!w.rating||w.rating===0)&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${C.line}`,display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:15,color:C.mid,fontFamily:C.P,flexShrink:0}}>Rate:</span>
                      <div style={{display:'flex',gap:4,flex:1}}>
                        {[20,40,60,80,100].map(p=>(
                          <div key={p} onClick={e=>{e.stopPropagation();WineHistory.rate(w.name,w.vintage,p);setWines(WineHistory.getAll());}}
                            style={{flex:1,padding:'5px 2px',borderRadius:7,border:`1px solid ${C.line}`,textAlign:'center',cursor:'pointer'}}>
                            <span style={{fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P}}>{p}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
            <div style={{height:8}}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── RESTAURANT SCREEN ── */
function RestaurantScreen({nav,back}){
  const [step,setStep]=React.useState(0); // 0=entry 1=setup 2=script
  const [budget,setBudget]=React.useState(1);
  const [foods,setFoods]=React.useState([0]);
  const foodItems=['Red Meat','Poultry','Seafood','Pasta','Salad','Cheese','Spicy Food'];
  const toggleFood=i=>setFoods(f=>f.includes(i)?f.filter(x=>x!==i):[...f,i]);

  if(step===2) return <RestaurantScript back={()=>setStep(1)}/>;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={step>0?()=>setStep(s=>s-1):back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>{step===0?'Restaurant Mode':'Your Preferences'}</span>
      </div>

      {step===0&&(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:C.ink,borderRadius:20,padding:'20px',textAlign:'center'}}>
            <Icon n="fork" sz={32} col="rgba(255,255,255,0.5)" style={{margin:'0 auto 10px'}}/>
            <div style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:C.P}}>Dining Tonight?</div>
            <div style={{fontSize:16,color:'rgba(255,255,255,0.5)',fontFamily:C.P,marginTop:4}}>Get confident wine recommendations tailored to your meal and budget.</div>
          </div>
          {[
            {i:'camera',col:C.cr,t:'Scan Wine List',s:'Take a photo of the menu for instant picks',action:()=>setStep(1)},
            {i:'message',col:'#B06C00',t:'Quick Script',s:'No menu? Get a script to say to the sommelier',action:()=>setStep(1)},
          ].map((a,i)=>(
            <Card key={i} onClick={a.action} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer'}}>
              <div style={{width:44,height:44,borderRadius:11,background:a.col+'12',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={a.i} sz={22} col={a.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{a.t}</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{a.s}</div>
              </div>
              <Icon n="chevron" sz={14} col={C.mid}/>
            </Card>
          ))}
        </div>
</div>
      )}

      {step===1&&(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Budget per bottle</div>
            <div style={{display:'flex',gap:8}}>
              {['$20–40','$40–70','$70–120','$120+'].map((b,i)=>(
                <div key={i} onClick={()=>setBudget(i)} style={{flex:1,padding:'10px 4px',borderRadius:10,border:`1.5px solid ${i===budget?C.cr:C.line}`,background:i===budget?C.crSoft:'#fff',textAlign:'center',cursor:'pointer'}}>
                  <div style={{fontSize:16,fontWeight:600,color:i===budget?C.cr:C.ink2,fontFamily:C.P}}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>What are you eating?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {foodItems.map((f,i)=>(
                <span key={i} onClick={()=>toggleFood(i)} style={{padding:'6px 12px',borderRadius:20,background:foods.includes(i)?C.cr:'#fff',color:foods.includes(i)?'#fff':C.mid,border:`1px solid ${foods.includes(i)?C.cr:C.line}`,fontSize:16,fontWeight:500,fontFamily:C.P,cursor:'pointer'}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{flex:1}}/>
          <Btn primary full onClick={()=>setStep(2)}>Get Recommendations</Btn>
          <div style={{height:8}}/>
        </div>
</div>
      )}
    </div>
  );
}

function RestaurantScript({back}){
  const copied=React.useRef(false);
  const [c,setC]=React.useState(false);
  const script='"I\'m looking for a full-bodied red in the $40–70 range. I typically enjoy wines with earthy notes and structured tannins — Bordeaux blends are a favourite. I\'m having the steak tonight. What would you recommend?"';
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Script</span>
        <div style={{flex:1}}/>
        <Icon n="share" sz={18} col={C.mid}/>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{background:C.crSoft,border:`1.5px solid ${C.crDim}`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <Icon n="message" sz={16} col={C.cr}/>
            <span style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>Say This to Your Server</span>
          </div>
          <div style={{fontSize:17,color:C.ink2,fontFamily:C.P,lineHeight:1.6,fontStyle:'italic',marginBottom:10}}>{script}</div>
          <Btn primary small onClick={()=>{try{navigator.clipboard.writeText(script.replace(/"/g,''));setC(true);setTimeout(()=>setC(false),2000)}catch(e){}}}
            style={{width:'100%'}}>{c?'Copied!':'Copy Script'}</Btn>
        </Card>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Best Matches on This List</div>
        {[{name:'Clos du Val Cabernet',sub:'Napa Valley · $58',score:96,note:'Best match · In your budget'},
          {name:'Barolo Giacomo Conterno',sub:'Piedmont · $65',score:91,note:'Try something new — similar style'},
          {name:'Sancerre Henri Bourgeois',sub:'Loire Valley · $42',score:82,note:'White option · Pairs with seafood'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:4,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                </div>
              </div>
            </div>
            <div style={{fontSize:15,color:i===0?C.green:C.cr,fontFamily:C.P,marginTop:5,paddingLeft:42,fontWeight:500}}>{w.note}</div>
          </Card>
        ))}
        <div style={{height:8}}/>
      </div>
</div>
    </div>
  );
}

/* ── LEARN SCREEN ── */
// LearnScreen is now QuizHubScreen (defined in pwa-screens-quiz.jsx)
function LearnScreen(props){ return React.createElement(QuizHubScreen, props); }

/* ── WINE LIST RESULTS SCREEN ── */
function WineListScreen({nav,back}){
  const data=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_winelist_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const isDemo=data.demo===true;

  const demoWines=[
    {name:'Barolo Giacomo Conterno',type:'red',region:'Piedmont',country:'Italy',vintage:2018,price_usd:75,community_rating:4.7,grapes:['Nebbiolo'],description:'Rich, structured Barolo with dried roses, tar and earthy depth.'},
    {name:'Chablis 1er Cru Montée de Tonnerre',type:'white',region:'Burgundy',country:'France',vintage:2021,price_usd:48,community_rating:4.5,grapes:['Chardonnay'],description:'Taut, mineral Chablis with oyster shell and lemon zest.'},
    {name:'Whispering Angel Rosé',type:'rosé',region:'Provence',country:'France',vintage:2022,price_usd:28,community_rating:4.4,grapes:['Grenache'],description:'Pale, bone-dry Provençal rosé with delicate strawberry and herbs.'},
    {name:'Chianti Classico Riserva',type:'red',region:'Tuscany',country:'Italy',vintage:2019,price_usd:38,community_rating:4.2,grapes:['Sangiovese'],description:'Sour cherry, leather and tobacco with firm tannins.'},
    {name:'Sancerre Henri Bourgeois',type:'white',region:'Loire Valley',country:'France',vintage:2022,price_usd:35,community_rating:4.5,grapes:['Sauvignon Blanc'],description:'Crisp and herbaceous with grapefruit and flinty minerality.'},
    {name:'Châteauneuf-du-Pape Vieux Télégraphe',type:'red',region:'Rhône Valley',country:'France',vintage:2019,price_usd:68,community_rating:4.6,grapes:['Grenache'],description:'Garrigue, dark fruit and spice — powerful yet elegant.'},
  ];

  const wines=(data.wines&&data.wines.length>0)?data.wines:demoWines;
  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=t=>typeColors[(t||'red').toLowerCase().replace('é','e')]||C.cr;

  // Stable match scores seeded per wine name
  const [scores]=React.useState(()=>wines.map(w=>{
    let h=0; for(let i=0;i<(w.name||'').length;i++) h=(h*31+w.name.charCodeAt(i))&0xffff;
    return 68+Math.floor((h%100)*0.26);
  }));

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.cr,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P}}>Wine List Results</div>
          <div style={{fontSize:15,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>{wines.length} wines · ranked by your taste profile</div>
        </div>
        <div onClick={()=>nav('camera')} style={{padding:'6px 14px',borderRadius:20,background:'rgba(255,255,255,0.18)',cursor:'pointer'}}>
          <span style={{fontSize:16,fontWeight:600,color:'#fff',fontFamily:C.P}}>Rescan</span>
        </div>
      </div>

      {isDemo&&(
        <div style={{background:'#FFF3CD',borderBottom:'1px solid #FFE082',padding:'10px 16px',display:'flex',alignItems:'flex-start',gap:10,flexShrink:0}}>
          <span style={{fontSize:19,flexShrink:0}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:'#7A5200',fontFamily:C.P}}>List not detected — ensure the full page is in frame</div>
            <div onClick={()=>nav('camera')} style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:20,background:'#8B1A2F',cursor:'pointer'}}>
              <Icon n="camera" sz={12} col="#fff"/>
              <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P}}>Try Again</span>
            </div>
          </div>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
        <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>Best Matches for You</div>
        {wines.map((w,i)=>{
          const col=colFor(w.type);
          const score=scores[i]||78;
          return(
            <Card key={i} style={{padding:12,cursor:'pointer'}} onClick={()=>{
              sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:{...w,body:0.75,tannins:0.7,acidity:0.6,sweetness:0.1},confidence:score/100}));
              nav('identified');
            }}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:42,height:56,borderRadius:8,background:col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${col}25`}}>
                  <Icon n="wine" sz={18} col={col}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                    <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2,flex:1}}>{w.name}</div>
                    <div style={{display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:7,background:score>=80?C.greenBg:C.amberBg,flexShrink:0}}>
                      <span style={{fontSize:16,fontWeight:700,color:score>=80?C.green:C.amber,fontFamily:C.P}}>{score}%</span>
                    </div>
                  </div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:2}}>
                    {[w.region,w.country].filter(Boolean).join(' · ')}{w.vintage?` · ${w.vintage}`:''}
                  </div>
                  {w.description&&<div style={{fontSize:15,color:C.ink2,fontFamily:C.P,marginTop:3,lineHeight:1.4,fontStyle:'italic'}}>{w.description}</div>}
                  <div style={{display:'flex',gap:5,marginTop:6,alignItems:'center',flexWrap:'wrap'}}>
                    <Pill sm style={{background:col+'12',color:col,border:`1px solid ${col}25`,textTransform:'capitalize'}}>{w.type||'Red'}</Pill>
                    {w.grapes?.[0]&&<Pill sm>{w.grapes[0]}</Pill>}
                    {w.price&&<span style={{fontSize:15,fontWeight:600,color:C.ink2,fontFamily:C.P,marginLeft:'auto'}}>{w.price}</span>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        <Btn primary full onClick={()=>nav('camera')} style={{marginTop:4}}>Scan Another</Btn>
        <div style={{height:8}}/>
      </div>
</div>
    </div>
  );
}

/* ── SETTINGS SCREEN ── */
function SettingsScreen({nav,back}){
  const [region, setRegion] = React.useState(localStorage.getItem('vinterest_region') || 'uk');
  
  function saveRegion(r) {
    setRegion(r);
    localStorage.setItem('vinterest_region', r);
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:`1px solid ${C.line}`}}>
        <div onClick={back} style={{cursor:'pointer',fontSize:24}}>←</div>
        <div style={{fontSize:18,fontWeight:700,color:C.ink,fontFamily:C.P}}>Settings</div>
        <div style={{width:24}}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Region</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {['uk', 'us', 'ontario', 'australia'].map(r => (
              <div
                key={r}
                onClick={() => saveRegion(r)}
                style={{
                  padding:'12px 14px',
                  borderRadius:12,
                  background: region === r ? C.crSoft : C.white,
                  border: `1px solid ${region === r ? C.cr : C.line}`,
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between'
                }}
              >
                <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>{r.toUpperCase()}</span>
                {region === r && <span style={{fontSize:14,color:C.cr}}>✓</span>}
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:8}}>Prices and retailers are shown based on your region.</div>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Debug</div>
          <Btn onClick={()=>{
            const errors = JSON.parse(localStorage.getItem('vinterest_errors') || '[]');
            if(errors.length===0){alert('No errors logged.');return;}
            alert('Recent errors:\n\n' + errors.slice(-5).map(e => e.context + ': ' + e.message).join('\n'));
          }} style={{width:'100%',padding:'12px',borderRadius:12,background:C.white,border:`1px solid ${C.line}`,fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,cursor:'pointer'}}>
            View Error Log
          </Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{TasteProfileScreen,RestaurantScreen,LearnScreen,MyWinesScreen,WineListScreen,SettingsScreen});
