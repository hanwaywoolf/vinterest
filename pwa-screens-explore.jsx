/* Vinterest PWA — Region, Varietal, Similar Wines explore screens */

/* Shared Claude-fetch hook with sessionStorage cache */
function useClaudeData(cacheKey, prompt, wine){
  const [data,setData]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState(null);
  React.useEffect(()=>{
    if(!wine){setLoading(false);return;}
    const cached=sessionStorage.getItem(cacheKey);
    if(cached){try{setData(JSON.parse(cached));setLoading(false);return;}catch(e){}}
    (async()=>{
      try{
        const text=await window.claude.complete({messages:[{role:'user',content:prompt}],skill_id:WINE_SKILL_ID});
        let cleaned=text.replace(/```json|```/g,'').trim();
        const s=cleaned.indexOf('{'),e=cleaned.lastIndexOf('}');
        if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
        const result=JSON.parse(cleaned);
        sessionStorage.setItem(cacheKey,JSON.stringify(result));
        setData(result);
      }catch(err){setError(err.message);}
      finally{setLoading(false);}
    })();
  },[cacheKey]);
  return {data,loading,error};
}

function ExploreLoading(){
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}>
      <div style={{width:44,height:44,borderRadius:22,border:'3px solid rgba(0,0,0,0.07)',borderTopColor:C.cr,animation:'vspin 0.85s linear infinite'}}/>
      <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Loading…</span>
      <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ── REGION SCREEN ── */
function RegionScreen({nav,back}){
  const wine=React.useMemo(()=>{
    try{return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}').wine||null;}
    catch(e){return null;}
  },[]);

  const region=wine?.sub_region||wine?.region||'Unknown Region';
  const country=wine?.country||'';
  const prompt=`You are a wine expert. Tell me about the ${region} wine region in ${country}. Return ONLY valid JSON (no markdown): {"about":"2 engaging sentences about this region","climate":"1 sentence about climate and terroir","key_varietals":["Grape1","Grape2","Grape3"],"notable_producers":["Producer1","Producer2","Producer3"],"food_culture":"1 sentence about local food and wine pairing","fun_fact":"1 surprising or interesting fact"}`;

  const {data,loading}=useClaudeData(`vinterest_region_${region}`,prompt,wine);

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.cr,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.2}}>{region}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>{country}</div>
        </div>
        <Icon n="globe" sz={22} col="rgba(255,255,255,0.35)"/>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          <Card style={{padding:14}}>
            <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>About {region}</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.65}}>{data?.about||'Information unavailable.'}</div>
            {data?.climate&&(
              <div style={{marginTop:10,padding:'10px 12px',borderRadius:10,background:C.offWhite,border:`1px solid ${C.line}`}}>
                <div style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,marginBottom:3}}>Climate &amp; Terroir</div>
                <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{data.climate}</div>
              </div>
            )}
          </Card>

          {data?.key_varietals?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Key Varietals</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.key_varietals.map((g,i)=>(
                  <span key={i} onClick={()=>nav('varietal')} style={{padding:'5px 14px',borderRadius:20,background:i===0?C.crSoft:C.offWhite,color:i===0?C.cr:C.ink2,fontSize:14,fontWeight:i===0?600:500,fontFamily:C.P,border:`1px solid ${i===0?C.crDim:C.line}`,cursor:'pointer'}}>{g}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.notable_producers?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Notable Producers</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {data.notable_producers.map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:C.offWhite}}>
                    <div style={{width:30,height:30,borderRadius:7,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Icon n="wine" sz={14} col={C.cr}/>
                    </div>
                    <span style={{fontSize:15,fontWeight:500,color:C.ink,fontFamily:C.P}}>{p}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data?.food_culture&&(
            <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:4}}>Food &amp; Wine Culture</div>
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.food_culture}</div>
            </Card>
          )}

          {data?.fun_fact&&(
            <Card style={{background:C.amberBg,boxShadow:'none',border:`1px solid ${C.amber}25`,padding:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:4}}>Did You Know?</div>
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.fun_fact}</div>
            </Card>
          )}

          <Btn full onClick={()=>nav('similar')}>See Similar Wines</Btn>
          <div style={{height:8}}/>
        </div>
      )}
    </div>
  );
}

/* ── VARIETAL SCREEN ── */
function VarietalScreen({nav,back}){
  const wine=React.useMemo(()=>{
    try{return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}').wine||null;}
    catch(e){return null;}
  },[]);

  const grape=wine?.grapes?.[0]||'Unknown Varietal';
  const prompt=`You are a wine expert. Tell me about the ${grape} grape variety as it relates to wines like ${wine?.name||'this wine'} from ${wine?.region||'its region'}. Return ONLY valid JSON (no markdown): {"about":"2 engaging sentences","body":0.7,"tannins":0.6,"acidity":0.7,"sweetness":0.1,"body_desc":"plain language body description","tannin_desc":"plain language tannin description","typical_regions":["Region, Country"],"food_pairings":["Food1","Food2","Food3","Food4"],"similar_varietals":["Grape1","Grape2","Grape3"],"aging_note":"1 sentence on aging potential"}`;

  const {data,loading}=useClaudeData(`vinterest_varietal_${grape}`,prompt,wine);

  const tasteTiles=data?[
    {name:'Body',   val:data.body??0.7,  desc:data.body_desc||'',   lo:'Light',    hi:'Full',    col:'#8B1A2F'},
    {name:'Tannins',val:data.tannins??0.6,desc:data.tannin_desc||'',lo:'Silky',    hi:'Grippy',  col:'#7B5EA7'},
    {name:'Acidity',val:data.acidity??0.7,desc:'',                   lo:'Mellow',   hi:'Zingy',   col:C.green},
    {name:'Sweetness',val:data.sweetness??0.1,desc:'',               lo:'Bone Dry', hi:'Sweet',   col:C.amber},
  ]:[];

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.ink,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P}}>{grape}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.45)',fontFamily:C.P}}>Grape Varietal</div>
        </div>
        <Icon n="wine" sz={22} col="rgba(255,255,255,0.25)"/>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          <Card style={{padding:14}}>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.65}}>{data?.about}</div>
          </Card>

          {tasteTiles.length>0&&(
            <div>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Taste Characteristics</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {tasteTiles.map((t,i)=>(
                  <div key={i} style={{background:C.white,borderRadius:14,padding:'10px',border:`1px solid ${C.line}`}}>
                    <div style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:2}}>{t.name}</div>
                    {t.desc&&<div style={{fontSize:12,color:C.mid,fontFamily:C.P,lineHeight:1.3,marginBottom:6}}>{t.desc}</div>}
                    <Prog val={t.val} col={t.col} h={5}/>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                      <span style={{fontSize:11,color:'#bbb',fontFamily:C.P}}>{t.lo}</span>
                      <span style={{fontSize:11,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.val>=.7?t.hi:t.val>=.4?'Medium':t.lo}</span>
                      <span style={{fontSize:11,color:'#bbb',fontFamily:C.P}}>{t.hi}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.typical_regions?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Famous In</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.typical_regions.map((r,i)=>(
                  <span key={i} style={{padding:'5px 13px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:13,fontWeight:500,fontFamily:C.P,border:`1px solid ${C.line}`}}>{r}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.food_pairings?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Food Pairings</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {data.food_pairings.map((f,i)=>(
                  <div key={i} style={{background:C.offWhite,borderRadius:10,padding:'10px 8px',textAlign:'center',border:`1px solid ${C.line}`}}>
                    <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,fontWeight:500}}>{f}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data?.similar_varietals?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>If You Like This, Try…</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.similar_varietals.map((g,i)=>(
                  <span key={i} style={{padding:'5px 13px',borderRadius:20,background:C.crSoft,color:C.cr,fontSize:13,fontWeight:600,fontFamily:C.P,border:`1px solid ${C.crDim}`}}>{g}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.aging_note&&(
            <Card style={{background:C.amberBg,boxShadow:'none',border:`1px solid ${C.amber}25`,padding:12}}>
              <div style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:4}}>Aging Potential</div>
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.aging_note}</div>
            </Card>
          )}

          <Btn full onClick={()=>nav('similar')}>See Similar Wines</Btn>
          <div style={{height:8}}/>
        </div>
      )}
    </div>
  );
}

/* ── SIMILAR WINES SCREEN ── */
function SimilarWinesScreen({nav,back}){
  const wine=React.useMemo(()=>{
    try{return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}').wine||null;}
    catch(e){return null;}
  },[]);

  const wineName=wine?.name||'this wine';
  const prompt=`You are a sommelier. Suggest 5 wines similar to ${wineName} (${wine?.type||'red'}, ${wine?.region||''}, ${wine?.grapes?.[0]||''}). Return ONLY valid JSON (no markdown): {"wines":[{"name":"Wine Name","producer":"Producer","region":"Region","country":"Country","type":"red|white|rosé|sparkling","grapes":["Grape"],"why_similar":"1 sentence explanation","step":"same|step_up|step_down","approx_price_usd":45}]}. Mix of same-price, cheaper, and pricier options.`;

  const {data,loading}=useClaudeData(`vinterest_similar_${wineName}`,prompt,wine);

  const typeColors={red:'#8B1A2F',white:'#B8963E','rosé':'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=t=>typeColors[(t||'red').toLowerCase().replace('é','e')]||C.cr;
  const badge={same:{l:'Similar price',bg:C.greenBg,col:C.green},step_up:{l:'Step up',bg:C.amberBg,col:C.amber},step_down:{l:'Better value',bg:C.crSoft,col:C.cr}};

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 16px 12px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:19,fontWeight:700,color:C.ink,fontFamily:C.P}}>Similar Wines</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Based on {wineName}</div>
          </div>
          <Icon n="compass" sz={20} col={C.mid}/>
        </div>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto',padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
          {(data?.wines||[]).map((w,i)=>{
            const col=colFor(w.type);
            const b=badge[w.step]||{l:'',bg:'',col:''};
            return(
              <Card key={i} style={{padding:12,cursor:'pointer'}} onClick={()=>{
                sessionStorage.setItem('vinterest_scan_result',JSON.stringify({
                  demo:false,
                  wine:{...w,body:0.7,tannins:0.65,acidity:0.6,sweetness:0.1,
                    tasting_notes:[],food_pairings:[],price_usd:w.approx_price_usd,
                    description:w.why_similar,why_you_will_like_this:w.why_similar},
                  confidence:0.88
                }));
                nav('identified');
              }}>
                <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{width:44,height:58,borderRadius:8,background:col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${col}25`}}>
                    <Icon n="wine" sz={19} col={col}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                      <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2,flex:1}}>{w.name}</div>
                      {w.approx_price_usd&&<span style={{fontSize:14,fontWeight:700,color:C.ink2,fontFamily:C.P,flexShrink:0}}>${w.approx_price_usd}</span>}
                    </div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>{[w.region,w.country].filter(Boolean).join(' · ')}</div>
                    <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.45,fontStyle:'italic'}}>{w.why_similar}</div>
                    <div style={{display:'flex',gap:6,marginTop:6,alignItems:'center',flexWrap:'wrap'}}>
                      <Pill sm style={{background:col+'12',color:col,border:`1px solid ${col}25`,textTransform:'capitalize'}}>{w.type||'Red'}</Pill>
                      {w.grapes?.[0]&&<Pill sm>{w.grapes[0]}</Pill>}
                      {b.l&&<span style={{fontSize:11,fontWeight:600,color:b.col,fontFamily:C.P,padding:'2px 8px',borderRadius:20,background:b.bg,marginLeft:'auto'}}>{b.l}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          <div style={{height:8}}/>
        </div>
      )}
    </div>
  );
}

Object.assign(window,{RegionScreen,VarietalScreen,SimilarWinesScreen});
