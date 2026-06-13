/* Vinterest PWA — WineIQ Screen: rich personal taste intelligence */

function WineIQScreen({nav, back, showPro}){
  const [scriptTab,setScriptTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
  const [generating,setGenerating]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const [dnaTab,setDnaTab]=React.useState(0);

  const allWines=WineHistory.getAll();
  const xd=XPSystem.get();
  const lv=XPSystem.getLevel(xd.total);
  const nx=XPSystem.nextLevel(xd.total);
  const pg=XPSystem.levelProgress(xd.total);
  const profile=WineHistory.getProfile();

  /* ── Data derivations ── */
  const ratedWines=allWines.filter(w=>w.rating>0);
  const avgRating=ratedWines.length?Math.round(ratedWines.reduce((s,w)=>s+w.rating,0)/ratedWines.length):0;

  const typeData=[
    {key:'red',      label:'Reds',     col:'#8B1A2F', pct:profile.total?Math.round(profile.redPct*100):0},
    {key:'white',    label:'Whites',   col:'#B8963E', pct:profile.total?Math.round(profile.whitePct*100):0},
    {key:'rose',     label:'Rosé',     col:'#C47A8A', pct:profile.total?Math.round(profile.rosePct*100):0},
    {key:'sparkling',label:'Sparkling',col:'#5E8FA8', pct:profile.total?Math.round(profile.sparklingPct*100):0},
  ];
  const primaryType=typeData.reduce((a,b)=>a.pct>b.pct?a:b,typeData[0]);

  const avg=(field,fallback)=>{
    const ws=allWines.filter(w=>w[field]!=null);
    return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fallback;
  };
  const avgBody=avg('body',0.65);
  const avgTannins=avg('tannins',0.55);
  const avgAcidity=avg('acidity',0.60);
  const avgSweetness=avg('sweetness',0.10);
  const avgPrice=avg('price_usd',0);

  /* Per-type taste profiles */
  const typeAvg=(wines,field,fb)=>{const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;};
  const typeProfiles={};
  typeData.forEach(t=>{
    const tw=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===t.key);
    if(!tw.length) return;
    typeProfiles[t.key]={body:typeAvg(tw,'body',0.65),tannins:typeAvg(tw,'tannins',0.55),acidity:typeAvg(tw,'acidity',0.60),sweetness:typeAvg(tw,'sweetness',0.10),count:tw.length};
  });
  const typesWithDnaData=typeData.filter(t=>typeProfiles[t.key]);
  const activeDnaType=typesWithDnaData[Math.min(dnaTab,typesWithDnaData.length-1)]||typesWithDnaData[0];
  const activeDnaProfile=activeDnaType?typeProfiles[activeDnaType.key]:{};

  const grapeCounts={};
  allWines.forEach(w=>(w.grapes||[]).forEach(g=>{if(g) grapeCounts[g]=(grapeCounts[g]||0)+1;}));
  const topGrapes=Object.entries(grapeCounts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e[0]);

  const regionCounts={};
  allWines.forEach(w=>{if(w.region) regionCounts[w.region]=(regionCounts[w.region]||0)+1;});
  const topRegions=Object.entries(regionCounts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(e=>e[0]);

  const countryCounts={};
  allWines.forEach(w=>{if(w.country) countryCounts[w.country]=(countryCounts[w.country]||0)+1;});
  const uniqueCountries=Object.keys(countryCounts).length;
  const topCountries=Object.entries(countryCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(e=>e[0]);

  const noteCounts={};
  allWines.forEach(w=>(w.tasting_notes||[]).forEach(n=>{if(n) noteCounts[n]=(noteCounts[n]||0)+1;}));
  const topNotes=Object.entries(noteCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(e=>e[0]);

  const topRated=[...allWines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,5);
  const grapesDiscovered=(xd.grapesSeen||topGrapes).length||topGrapes.length;

  function getPersonality(){
    if(!allWines.length) return null;
    if(primaryType.pct>=80) return `${primaryType.label} Devotee`;
    if(avgBody>=0.78&&avgTannins>=0.72) return 'Bold & Structured';
    if(avgBody<=0.45&&avgAcidity>=0.68) return 'Crisp & Elegant';
    if(uniqueCountries>=6) return 'Global Explorer';
    if(primaryType.pct>=60) return `${primaryType.label}-Forward`;
    if(topGrapes.length>=6) return 'Varietal Hunter';
    return 'Eclectic Palate';
  }
  const personality=getPersonality();

  /* ── Sommelier scripts (same cache as HomeScreen) ── */
  const cats=[
    {col:'#8B1A2F',label:'Reds',      typeKey:'red'},
    {col:'#B8963E',label:'Whites',    typeKey:'white'},
    {col:'#C47A8A',label:'Rosé',      typeKey:'rose'},
    {col:'#5E8FA8',label:'Sparkling', typeKey:'sparkling'},
  ];
  const sc=cats[scriptTab];
  const tabWines=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===sc.typeKey);

  React.useEffect(()=>{
    if(!tabWines.length) return;
    const key=`vinterest_script_v2_${sc.typeKey}_n${tabWines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[sc.typeKey]:cached}));return;}
    if(genScripts[sc.typeKey]||generating===sc.typeKey) return;
    setGenerating(sc.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const prompt=`I've scanned and rated these ${sc.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}],skill_id:WINE_SKILL_ID})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenScripts(g=>({...g,[sc.typeKey]:s}));})
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[scriptTab,allWines.length]);

  /* ── Empty state ── */
  if(!allWines.length) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{background:C.white,padding:'16px 20px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>WineIQ</div>
        <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Your personal taste intelligence</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
          <Icon n="star" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your WineIQ is waiting</div>
          <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and rate bottles to unlock your personal taste profile, sommelier scripts, and wine intelligence.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
      </div>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Header */}
      <div style={{background:C.white,padding:'16px 20px 14px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px'}}>WineIQ</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:1}}>{allWines.length} bottle{allWines.length!==1?'s':''} · {lv.badge} {lv.name}</div>
          </div>
          {personality&&(
            <div style={{padding:'5px 12px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P}}>{personality}</span>
            </div>
          )}
        </div>
        {/* XP bar */}
        <div style={{marginTop:10}}>
          <Prog val={pg} h={5} col={C.cr}/>
          {nx&&<div style={{fontSize:11,color:C.mid,fontFamily:C.P,marginTop:3}}>{xd.total} XP · {nx.min-xd.total} to {nx.name}</div>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Wine DNA */}
        <Card style={{padding:14}}>
          <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:10}}>Wine DNA</div>
          {/* Type distribution bar */}
          <div style={{display:'flex',height:10,borderRadius:5,overflow:'hidden',marginBottom:8,gap:1}}>
            {typeData.filter(t=>t.pct>0).map((t,i)=>(
              <div key={i} style={{flex:t.pct,background:t.col,minWidth:t.pct>0?2:0}}/>
            ))}
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
            {typeData.filter(t=>t.pct>0).map((t,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{width:8,height:8,borderRadius:4,background:t.col,flexShrink:0}}/>
                <span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{t.label} {t.pct}%</span>
              </div>
            ))}
          </div>
          {/* Per-type tabs */}
          {typesWithDnaData.length>1&&(
            <div style={{display:'flex',gap:5,marginBottom:10,flexWrap:'wrap'}}>
              {typesWithDnaData.map((t,i)=>(
                <div key={i} onClick={()=>setDnaTab(i)} style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,background:i===dnaTab?t.col+'20':C.offWhite,border:`1px solid ${i===dnaTab?t.col+'55':'transparent'}`,cursor:'pointer'}}>
                  <div style={{width:7,height:7,borderRadius:4,background:t.col,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:i===dnaTab?700:500,color:i===dnaTab?t.col:C.mid,fontFamily:C.P}}>{t.label}</span>
                </div>
              ))}
            </div>
          )}
          {/* Taste attributes for active type */}
          {activeDnaType&&(
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {[
                {l:'Body',     v:activeDnaProfile.body??0.65,     lo:'Light',    hi:'Full',   col:activeDnaType.col},
                {l:'Tannins',  v:activeDnaProfile.tannins??0.55,  lo:'Silky',    hi:'Grippy', col:'#7B5EA7'},
                {l:'Acidity',  v:activeDnaProfile.acidity??0.60,  lo:'Mellow',   hi:'Zingy',  col:C.green},
                {l:'Sweetness',v:activeDnaProfile.sweetness??0.10,lo:'Bone Dry', hi:'Sweet',  col:C.amber},
              ].map((t,i)=>(
                <div key={i}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{t.l}</span>
                    <span style={{fontSize:12,fontWeight:600,color:t.col,fontFamily:C.P}}>{t.v>=.72?t.hi:t.v>=.38?'Medium':t.lo}</span>
                  </div>
                  <Prog val={t.v} col={t.col} h={5}/>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Your Palate */}
        <Card style={{padding:14}}>
          <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:10}}>Your Palate</div>
          {topGrapes.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:C.mid,textTransform:'uppercase',letterSpacing:'0.07em',fontFamily:C.P,marginBottom:6}}>Favourite Grapes</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {topGrapes.map((g,i)=>(
                  <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?C.crSoft:C.offWhite,color:i<3?C.cr:C.ink2,fontSize:13,fontWeight:i<3?600:500,fontFamily:C.P,border:`1px solid ${i<3?C.crDim:C.line}`}}>{g}</span>
                ))}
              </div>
            </div>
          )}
          {topRegions.length>0&&(
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:600,color:C.mid,textTransform:'uppercase',letterSpacing:'0.07em',fontFamily:C.P,marginBottom:6}}>Top Regions</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {topRegions.map((r,i)=>(
                  <span key={i} style={{padding:'4px 10px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:13,fontWeight:500,fontFamily:C.P,border:`1px solid ${C.line}`}}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {topNotes.length>0&&(
            <div>
              <div style={{fontSize:12,fontWeight:600,color:C.mid,textTransform:'uppercase',letterSpacing:'0.07em',fontFamily:C.P,marginBottom:6}}>Recurring Tasting Notes</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {topNotes.map((n,i)=>(
                  <span key={i} style={{padding:'4px 10px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:13,fontFamily:C.P,border:`1px solid ${C.line}`}}>{n}</span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Sommelier Scripts */}
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'12px 14px 0',display:'flex',gap:0,borderBottom:`1px solid ${C.line}`}}>
            {cats.map((ct,i)=>(
              <div key={i} onClick={()=>setScriptTab(i)} style={{flex:1,textAlign:'center',paddingBottom:10,fontSize:14,fontWeight:i===scriptTab?700:400,color:i===scriptTab?ct.col:C.mid,fontFamily:C.P,borderBottom:i===scriptTab?`2px solid ${ct.col}`:'none',marginBottom:-1,cursor:'pointer'}}>{ct.label}</div>
            ))}
          </div>
          <div style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <Icon n="message" sz={14} col={sc.col}/>
              <span style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {sc.label} Script</span>
            </div>
            {tabWines.length===0?(
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>Scan some {sc.label.toLowerCase()} to generate this script.</div>
            ):generating===sc.typeKey?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:sc.col,animation:'wiqSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:13,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <>
                <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65,marginBottom:10}}>
                  {genScripts[sc.typeKey]||'Generating…'}
                </div>
                {genScripts[sc.typeKey]&&(
                  <div style={{display:'flex',gap:8}}>
                    <Btn primary small style={{background:sc.col,boxShadow:`0 3px 12px ${sc.col}40`}} onClick={()=>{
                      try{navigator.clipboard.writeText((genScripts[sc.typeKey]||'').replace(/"/g,''));setCopied(sc.typeKey);setTimeout(()=>setCopied(null),2000);}catch(e){}
                    }}>{copied===sc.typeKey?'Copied!':'Copy Script'}</Btn>
                    <Btn small onClick={()=>{
                      const key=`vinterest_script_v2_${sc.typeKey}_n${tabWines.length}`;
                      localStorage.removeItem(key);
                      setGenScripts(s=>{const n={...s};delete n[sc.typeKey];return n;});
                    }}>Regenerate</Btn>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Top Rated Wines */}
        {topRated.length>0&&(
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'12px 14px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Top Wines</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
            </div>
            {topRated.map((w,i)=>{
              const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
              const col=typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;
              return(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:24,height:24,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:12,fontWeight:800,color:C.cr,fontFamily:C.P}}>#{i+1}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:1,flexShrink:0}}>
                    <span style={{fontSize:18,fontWeight:800,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                    <span style={{fontSize:11,color:C.mid,fontFamily:C.P}}>/100</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* Stats grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[
            {icon:'wine',  label:'Bottles Scanned',   val:allWines.length,   col:C.cr,   bg:C.crSoft},
            {icon:'star',  label:'Average Rating',     val:avgRating?`${avgRating}/100`:'—', col:C.amber, bg:C.amberBg},
            {icon:'globe', label:'Countries Explored', val:uniqueCountries||'—', col:C.green, bg:C.greenBg},
            {icon:'trophy',label:'XP Earned',          val:`${xd.total} XP`, col:'#7B5EA7', bg:'#F0EBF8'},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:14,padding:'12px 14px',border:`1px solid ${s.col}20`,display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:24,height:24,borderRadius:6,background:`${s.col}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n={s.icon} sz={13} col={s.col}/>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:s.col,fontFamily:C.P,lineHeight:1}}>{s.val}</div>
              </div>
              <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Top countries if available */}
        {topCountries.length>1&&(
          <Card style={{padding:12}}>
            <div style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Countries Explored</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {topCountries.map((c,i)=>(
                <span key={i} style={{padding:'5px 12px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:13,fontFamily:C.P,border:`1px solid ${C.line}`}}>🌍 {c}</span>
              ))}
              {uniqueCountries>topCountries.length&&<span style={{padding:'5px 12px',borderRadius:20,background:C.offWhite,color:C.mid,fontSize:13,fontFamily:C.P,border:`1px solid ${C.line}`}}>+{uniqueCountries-topCountries.length} more</span>}
            </div>
          </Card>
        )}

        {/* Avg price point if available */}
        {avgPrice>0&&(
          <Card style={{background:C.amberBg,border:`1px solid ${C.amber}25`,padding:12,boxShadow:'none'}}>
            <div style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:2}}>Your Typical Price Point</div>
            <div style={{fontSize:22,fontWeight:800,color:C.amber,fontFamily:C.P}}>${Math.round(avgPrice)}<span style={{fontSize:13,fontWeight:400,color:C.mid,marginLeft:4}}>per bottle avg</span></div>
          </Card>
        )}

        {/* Data Backup */}
        <Card style={{padding:14}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');
              a.href=url; a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json'; a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1}} onClick={()=>{
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
                  }catch(err){alert('Could not read backup file.');}
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP as a JSON file. Import restores from a previous backup.</div>
        </Card>

        <div style={{height:8}}/>
      </div>
      <style>{`@keyframes wiqSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{WineIQScreen});
