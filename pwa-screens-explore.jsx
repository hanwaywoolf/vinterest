/* Vinterest PWA — Region, Varietal, Similar Wines explore screens */

/* Shared Claude-fetch hook with sessionStorage cache */
function useClaudeData(cacheKey, prompt, wine, purpose){
  const [data,setData]=React.useState(null);
  const [loading,setLoading]=React.useState(true);
  const [error,setError]=React.useState(null);
  React.useEffect(()=>{
    if(!wine){setLoading(false);return;}
    const cached=sessionStorage.getItem(cacheKey);
    if(cached){try{setData(JSON.parse(cached));setLoading(false);return;}catch(e){}}
    (async()=>{
      try{
        const text=await window.claude.complete({purpose:purpose||'explore_info',messages:[{role:'user',content:prompt}]});
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
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Loading…</span>
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
          <div style={{fontSize:15,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>{country}</div>
        </div>
        <Icon n="globe" sz={22} col="rgba(255,255,255,0.35)"/>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          <Card style={{padding:14}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>About {region}</div>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.65}}>{data?.about||'Information unavailable.'}</div>
            {data?.climate&&(
              <div style={{marginTop:10,padding:'10px 12px',borderRadius:10,background:C.offWhite,border:`1px solid ${C.line}`}}>
                <div style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,marginBottom:3}}>Climate &amp; Terroir</div>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{data.climate}</div>
              </div>
            )}
          </Card>

          {data?.key_varietals?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Key Varietals</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.key_varietals.map((g,i)=>(
                  <span key={i} onClick={()=>nav('varietal')} style={{padding:'5px 14px',borderRadius:20,background:i===0?C.crSoft:C.offWhite,color:i===0?C.cr:C.ink2,fontSize:15,fontWeight:i===0?600:500,fontFamily:C.P,border:`1px solid ${i===0?C.crDim:C.line}`,cursor:'pointer'}}>{g}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.notable_producers?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Notable Producers</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {data.notable_producers.map((p,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,background:C.offWhite}}>
                    <div style={{width:30,height:30,borderRadius:7,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Icon n="wine" sz={14} col={C.cr}/>
                    </div>
                    <span style={{fontSize:16,fontWeight:500,color:C.ink,fontFamily:C.P}}>{p}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data?.food_culture&&(
            <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
              <div style={{fontSize:15,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:4}}>Food &amp; Wine Culture</div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.food_culture}</div>
            </Card>
          )}

          {data?.fun_fact&&(
            <Card style={{background:C.amberBg,boxShadow:'none',border:`1px solid ${C.amber}25`,padding:12}}>
              <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:4}}>Did You Know?</div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.fun_fact}</div>
            </Card>
          )}

          <Btn full onClick={()=>nav('similar')}>See Similar Wines</Btn>
          <div style={{height:8}}/>
        </div>
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
          <div style={{fontSize:15,color:'rgba(255,255,255,0.45)',fontFamily:C.P}}>Grape Varietal</div>
        </div>
        <Icon n="wine" sz={22} col="rgba(255,255,255,0.25)"/>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          <Card style={{padding:14}}>
            <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.65}}>{data?.about}</div>
          </Card>

          {tasteTiles.length>0&&(
            <div>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Taste Characteristics</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {tasteTiles.map((t,i)=>(
                  <div key={i} style={{background:C.white,borderRadius:14,padding:'10px',border:`1px solid ${C.line}`}}>
                    <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:2}}>{t.name}</div>
                    {t.desc&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.3,marginBottom:6}}>{t.desc}</div>}
                    <Prog val={t.val} col={t.col} h={5}/>
                    <div style={{display:'flex',justifyContent:'space-between',marginTop:3}}>
                      <span style={{fontSize:13,color:'#bbb',fontFamily:C.P}}>{t.lo}</span>
                      <span style={{fontSize:13,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.val>=.7?t.hi:t.val>=.4?'Medium':t.lo}</span>
                      <span style={{fontSize:13,color:'#bbb',fontFamily:C.P}}>{t.hi}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data?.typical_regions?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Famous In</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.typical_regions.map((r,i)=>(
                  <span key={i} style={{padding:'5px 13px',borderRadius:20,background:C.offWhite,color:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${C.line}`}}>{r}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.food_pairings?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>Food Pairings</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
                {data.food_pairings.map((f,i)=>(
                  <div key={i} style={{background:C.offWhite,borderRadius:10,padding:'10px 8px',textAlign:'center',border:`1px solid ${C.line}`}}>
                    <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontWeight:500}}>{f}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data?.similar_varietals?.length>0&&(
            <Card style={{padding:12}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:8}}>If You Like This, Try…</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {data.similar_varietals.map((g,i)=>(
                  <span key={i} style={{padding:'5px 13px',borderRadius:20,background:C.crSoft,color:C.cr,fontSize:15,fontWeight:600,fontFamily:C.P,border:`1px solid ${C.crDim}`}}>{g}</span>
                ))}
              </div>
            </Card>
          )}

          {data?.aging_note&&(
            <Card style={{background:C.amberBg,boxShadow:'none',border:`1px solid ${C.amber}25`,padding:12}}>
              <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:4}}>Aging Potential</div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{data.aging_note}</div>
            </Card>
          )}

          <Btn full onClick={()=>nav('similar')}>See Similar Wines</Btn>
          <div style={{height:8}}/>
        </div>
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
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>Based on {wineName}</div>
          </div>
          <Icon n="compass" sz={20} col={C.mid}/>
        </div>
      </div>

      {loading?<ExploreLoading/>:(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:10}}>
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
                      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2,flex:1}}>{w.name}</div>
                      {w.approx_price_usd&&<span style={{fontSize:15,fontWeight:700,color:C.ink2,fontFamily:C.P,flexShrink:0}}>${w.approx_price_usd}</span>}
                    </div>
                    <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:2}}>{[w.region,w.country].filter(Boolean).join(' · ')}</div>
                    <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.45,fontStyle:'italic'}}>{w.why_similar}</div>
                    <div style={{display:'flex',gap:6,marginTop:6,alignItems:'center',flexWrap:'wrap'}}>
                      <Pill sm style={{background:col+'12',color:col,border:`1px solid ${col}25`,textTransform:'capitalize'}}>{w.type||'Red'}</Pill>
                      {w.grapes?.[0]&&<Pill sm>{w.grapes[0]}</Pill>}
                      {b.l&&<span style={{fontSize:13,fontWeight:600,color:b.col,fontFamily:C.P,padding:'2px 8px',borderRadius:20,background:b.bg,marginLeft:'auto'}}>{b.l}</span>}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
          <div style={{height:8}}/>
        </div>
</div>
      )}
    </div>
  );
}

/* ── STYLE EXPLORE SCREEN ── */
/* Explore Next detail: teaches one style (what it tastes like, why, how to spot it, what to ask
   for) from the curated catalogue, then suggests real bottles priced around the user's usual
   spend. Opened from WineDNA's Explore Next; the style and reasoning come from ExploreNext. */
function StyleExploreScreen({nav,back}){
  const cfg=React.useMemo(()=>{
    try{return JSON.parse(sessionStorage.getItem('vinterest_style_explore')||'null');}
    catch(e){return null;}
  },[]);
  const allWines=WineHistory.getAll();
  const fit=React.useMemo(()=>cfg&&cfg.id?ExploreNext.forStyle(cfg.id,allWines,cfg.label):null,[]);
  const style=fit&&fit.style;
  const typeKey=style?style.type:(cfg&&cfg.typeKey)||'red';
  const typeWines=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===typeKey);

  const rc=Regional.current();
  const budget=SommelierScript.budget(typeWines,rc);
  const [bottles,setBottles]=React.useState(null);
  const [loading,setLoading]=React.useState(false);
  const [inLearn,setInLearn]=React.useState(()=>!!style&&ExploreNext.inLearn(style.id));
  const [copied,setCopied]=React.useState(false);
  const cacheKey=style?`vinterest_se4_${style.id}_${rc.code}_${budget||'nob'}`:null;

  React.useEffect(()=>{
    if(!style) return;
    const cached=localStorage.getItem(cacheKey);
    if(cached){ try{ setBottles(JSON.parse(cached)); return; }catch(e){} }
    setLoading(true);
    const spend=budget
      ?`My usual spend on ${typeKey} wine is ${budget}. Make "value" a good bottle at the low end of that range or just below it, "mid-range" squarely inside it, "step-up" a little above it, and "splurge" a special-occasion bottle.`
      :`Spread the four across everyday, good-value, special and splurge prices.`;
    const prompt=`You are a sommelier helping someone try ${style.name} (${style.region}, ${style.country}; grapes: ${style.grapes.join(', ')}) for the first time. Suggest exactly 4 specific, real, widely available bottles of this style that someone in ${rc.label} could actually buy, one for each tier: "value", "mid-range", "step-up", "splurge". ${spend} Prices must be realistic current retail prices in ${rc.code}, as plain numbers. For each, give one sentence on what makes that bottle a good introduction to the style. Return ONLY valid JSON, no markdown: {"wines":[{"tier":"value|mid-range|step-up|splurge","name":"Full wine name","producer":"Producer","vintage":"year or NV","price_local":NUMBER,"why":"one sentence"}]}`;
    window.claude.complete({purpose:'explore',messages:[{role:'user',content:prompt}]})
      .then(text=>{
        let c=text.replace(/```json|```/g,'').trim();
        const i=c.indexOf('{'),j=c.lastIndexOf('}');
        if(i>=0&&j>i) c=c.slice(i,j+1);
        const order={value:0,'mid-range':1,'step-up':2,splurge:3};
        const list=(JSON.parse(c).wines||[]).filter(w=>w&&w.name).sort((a,b)=>(order[a.tier]??9)-(order[b.tier]??9));
        if(list.length) localStorage.setItem(cacheKey,JSON.stringify(list));
        setBottles(list);
      })
      .catch(()=>setBottles([]))
      .finally(()=>setLoading(false));
  },[]);

  function findIt(wine){
    const q=`${wine.producer&&!wine.name.includes(wine.producer)?wine.producer+' ':''}${wine.name}${wine.vintage&&wine.vintage!=='NV'?' '+wine.vintage:''} buy`;
    window.open('https://www.google.com/search?q='+encodeURIComponent(q),'_blank','noopener');
  }

  const TYPE_COL={red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8',orange:'#C1652B',dessert:'#8A5A2B',fortified:'#5C2A1E'};
  const col=TYPE_COL[typeKey]||C.cr;
  const section=(title,children)=>(
    <div style={{padding:'12px 14px',borderRadius:12,background:C.white,border:`1px solid ${C.line}`}}>
      <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,marginBottom:5,letterSpacing:'0.08em',textTransform:'uppercase'}}>{title}</div>
      {children}
    </div>
  );
  const body=t=><div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6}}>{t}</div>;
  const TIER={value:'Value','mid-range':'Your usual','step-up':'Step up',splurge:'Splurge'};

  if(!style) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:32}}>
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P,textAlign:'center'}}>This suggestion has been updated. Open Explore Next on your WineDNA to see the latest picks.</span>
      <Btn primary onClick={()=>nav('profile')}>Go to WineDNA</Btn>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:col,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.2}}>{style.name}</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.75)',fontFamily:C.P}}>{style.region} · {style.country} · {style.grapes.join(', ')}</div>
        </div>
        <Icon n="compass" sz={20} col="rgba(255,255,255,0.35)"/>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        <div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{padding:'12px 14px',borderRadius:12,background:col+'10',border:`1px solid ${col}25`}}>
            <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,marginBottom:5,letterSpacing:'0.08em',textTransform:'uppercase'}}>Why it's next for you</div>
            {body(fit.why)}
          </div>
          {section('What it tastes like',body(style.learn.taste))}
          {section('Why it tastes that way',body(style.learn.why))}
          {section('How to spot it',body(style.learn.label))}
          {section('What to ask for',(
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{flex:1,fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,fontStyle:'italic'}}>"{style.learn.ask}"</div>
              <span onClick={()=>{try{navigator.clipboard.writeText(style.learn.ask);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch(e){}}}
                style={{fontSize:13,fontWeight:600,color:col,fontFamily:C.P,cursor:'pointer',flexShrink:0}}>{copied?'Copied':'Copy'}</span>
            </div>
          ))}

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginTop:6}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Bottles to try</div>
            {budget&&<span style={{fontSize:13,color:C.amber,fontFamily:C.P,fontWeight:600}}>Your usual: {budget}</span>}
          </div>
          {loading&&(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 2px'}}>
              <div style={{width:16,height:16,borderRadius:8,border:`2px solid ${col}30`,borderTopColor:col,animation:'storySpin .8s linear infinite'}}/>
              <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Finding bottles you can buy in {rc.label}…</span>
            </div>
          )}
          {bottles&&bottles.map((wine,i)=>(
            <Card key={i} style={{padding:14}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:6}}>
                <div style={{flex:1}}>
                  {TIER[wine.tier]&&<div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.05em',textTransform:'uppercase',marginBottom:3}}>{TIER[wine.tier]}</div>}
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{wine.name}</div>
                  {wine.producer&&!wine.name.includes(wine.producer)&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{wine.producer}</div>}
                </div>
                {wine.price_local>0&&(
                  <div style={{flexShrink:0,textAlign:'right'}}>
                    <div style={{fontSize:19,fontWeight:800,color:col,fontFamily:C.P,lineHeight:1}}>{rc.base}{Math.round(wine.price_local)}</div>
                    <div style={{fontSize:10,fontWeight:700,color:col+'99',fontFamily:C.P,marginTop:2}}>{rc.code} · est.</div>
                  </div>
                )}
              </div>
              {wine.why&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55,marginBottom:10}}>{wine.why}</div>}
              <Btn small full onClick={()=>findIt(wine)}>Find it online</Btn>
            </Card>
          ))}
          {bottles&&bottles.length===0&&(
            <Card style={{padding:14}}>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Couldn't load bottle suggestions right now. The label tips above are enough to find one in a shop or on a wine list.</span>
            </Card>
          )}

          <Card style={{padding:14,background:C.offWhite,border:`1px solid ${C.line}`}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Found one? Scan it</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:10}}>Scan and rate it and it'll move to "Already explored" on your WineDNA, and your next suggestions will learn from what you thought.</div>
            <Btn primary full style={{background:col}} onClick={()=>nav('camera')}>Scan a bottle</Btn>
          </Card>

          <Card style={{padding:14,background:inLearn?C.greenBg:C.offWhite,border:`1px solid ${inLearn?C.green+'40':C.line}`}}>
            <div style={{fontSize:15,fontWeight:700,color:inLearn?C.green:C.ink,fontFamily:C.P,marginBottom:4}}>{inLearn?'✓ On your Learn shelf':'Read up before you buy'}</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:inLearn?0:10}}>
              {inLearn?`"Explore Next: ${style.name}" is waiting on your Learn tab.`:`Add a short article on ${style.name} to your Learn tab: the story behind it, what to eat with it, and how to order it.`}
            </div>
            {!inLearn&&<Btn full onClick={()=>{ExploreNext.addToLearn(style.id);setInLearn(true);}}>Add to Learn</Btn>}
          </Card>
          <div style={{height:8}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{RegionScreen,VarietalScreen,SimilarWinesScreen,StyleExploreScreen});
