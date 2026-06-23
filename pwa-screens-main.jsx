/* Vinterest PWA — Home, Scan, Wine Identified screens */

/* ── SCAN HOME (Scan tab content) ── */
function ScanHomeScreen({nav,showPro,isTablet}){
  const wines=WineHistory.getAll();
  const isPro=!!localStorage.getItem('vinterest_pro');
  const scanCount=parseInt(localStorage.getItem('vinterest_scan_count')||'0');
  const FREE_SCANS=10;
  const atLimit=!isPro&&scanCount>=FREE_SCANS;
  const scansLeft=Math.max(0,FREE_SCANS-scanCount);
  const typeColors={red:C.cr,white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;
  function handleScanCTA(){ if(atLimit){showPro('unlimited-scans');return;} nav('camera'); }
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto',background:C.bg}}>
      <div style={{padding:'18px 20px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',background:C.white,borderBottom:`1px solid ${C.line}`}}>
        <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block'}}/>
        {!isPro&&!atLimit&&scansLeft<=3&&scansLeft>0&&(
          <div style={{fontSize:13,color:C.amber,fontWeight:600,fontFamily:C.P,background:C.amberBg,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.amber}30`}}>{scansLeft} scan{scansLeft!==1?'s':''} left</div>
        )}
        {!isPro&&atLimit&&(
          <div onClick={()=>showPro('unlimited-scans')} style={{fontSize:13,fontWeight:700,fontFamily:C.P,background:'linear-gradient(135deg,#9B5E00,#C4870A)',padding:'5px 12px',borderRadius:20,cursor:'pointer',color:'#fff'}}>Upgrade</div>
        )}
      </div>
      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        {/* Primary scan CTA — phone only; tablet has it in sidebar */}
        {!isTablet&&(
          <div onClick={handleScanCTA} style={{background:C.ink,borderRadius:20,padding:'20px 22px',display:'flex',alignItems:'center',gap:16,cursor:'pointer',position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',right:-24,top:-24,width:140,height:140,borderRadius:70,background:`${C.cr}28`,pointerEvents:'none'}}/>
            <div style={{width:58,height:58,borderRadius:16,background:atLimit?'#444':C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,boxShadow:atLimit?'none':`0 6px 24px ${C.cr}55`}}>
              {atLimit?<Icon n="lock" sz={24} col="#888"/>:<Icon n="camera" sz={28} col="#fff"/>}
            </div>
            <div style={{flex:1,zIndex:1}}>
              <div style={{fontSize:22,fontWeight:700,color:atLimit?'rgba(255,255,255,0.4)':'#fff',fontFamily:C.P,lineHeight:1.2}}>{atLimit?'Free scans used up':'Scan a Bottle'}</div>
              <div style={{fontSize:16,color:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:3}}>{atLimit?'Upgrade for unlimited scans':'Point at any wine label to identify'}</div>
            </div>
            {!atLimit&&<Icon n="chevron" sz={16} col="rgba(255,255,255,0.3)"/>}
          </div>
        )}
        {/* Wine List – unlocks with Pro */}
        {isPro?(
          <div onClick={()=>nav('camera')} style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,border:`1px solid ${C.green}40`,cursor:'pointer'}}>
            <div style={{width:40,height:40,borderRadius:10,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="list" sz={18} col={C.green}/>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>Wine List Scan</span>
                <span style={{fontSize:12,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#9B5E00,#C4870A)',borderRadius:8,padding:'2px 7px'}}>UNLOCKED</span>
              </div>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>Snap a restaurant menu for instant picks</div>
            </div>
            <Icon n="chevron" sz={14} col={C.mid}/>
          </div>
        ):(
          <div onClick={()=>showPro('wine-list')} style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,border:`1px solid ${C.line}`,cursor:'pointer',opacity:0.75}}>
            <div style={{width:40,height:40,borderRadius:10,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="list" sz={18} col={C.mid}/>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:17,fontWeight:600,color:C.ink2,fontFamily:C.P}}>Wine List Scan</span>
                <ProBadge/>
              </div>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>Snap a restaurant menu for instant picks</div>
            </div>
            <Icon n="lock" sz={14} col={C.mid}/>
          </div>
        )}
        {/* My Wines / empty state */}
        {wines.length===0?(
          <div style={{background:C.white,borderRadius:16,padding:'28px 20px',textAlign:'center',border:`1px solid ${C.line}`}}>
            <div style={{fontSize:46,marginBottom:10}}>🍷</div>
            <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>Your cellar is empty</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.65,marginBottom:16}}>Scan and rate your first bottle to start building your personal taste profile.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn primary onClick={handleScanCTA}>Scan First Bottle</Btn>
              <Btn onClick={()=>nav('learn')}>Take a Quiz</Btn>
            </div>
          </div>
        ):(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
              <span style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>My Wines · {wines.length}</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Manage →</span>
            </div>
            {wines.map((w,i)=>(
              <Card key={i} style={{padding:10,cursor:'pointer'}} onClick={()=>{
                sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                nav('detail');
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:38,height:52,borderRadius:8,background:colFor(w)+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${colFor(w)}25`}}>
                    <Icon n="wine" sz={17} col={colFor(w)}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{[w.region,w.country].filter(Boolean)[0]||''} · {w.vintage||'NV'}</div>
                    {w.type&&<div style={{fontSize:13,color:colFor(w),fontFamily:C.P,fontWeight:600,textTransform:'capitalize',marginTop:1}}>{w.type}</div>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,flexShrink:0}}>
                    {w.rating>0&&<div style={{display:'flex',alignItems:'baseline',gap:1}}>
                      <span style={{fontSize:17,fontWeight:700,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>/100</span>
                    </div>}
                    {w.times_consumed>1&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>×{w.times_consumed}</span>}
                  </div>
                </div>
              </Card>
            ))}
          </>
        )}
        {wines.length===0&&(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>Get Started</div>
            {[
              {emoji:'🎓',t:'Take a Wine Quiz',s:'Earn XP and learn something new',dest:'learn'},
              {emoji:'📖',t:'5 taste terms to know',s:'Understand any wine in 2 minutes',dest:'article'},
            ].map((a,i)=>(
              <Card key={i} onClick={()=>nav(a.dest)} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer'}}>
                <div style={{width:44,height:44,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{a.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{a.t}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>{a.s}</div>
                </div>
                <Icon n="chevron" sz={14} col={C.mid}/>
              </Card>
            ))}
          </>
        )}
        <div style={{height:8}}/>
      </div>
    </div>
  );
}


/* ── SCAN CAMERA ── */
function ScanScreen({nav,back,onComplete}){
  const onboarding=!!onComplete; // onboarding: save the scan & advance the flow instead of navigating
  const videoRef=React.useRef(null);
  const streamRef=React.useRef(null);
  const [phase,setPhase]=React.useState('viewfinder'); // viewfinder | processing
  const [capturedImg,setCapturedImg]=React.useState(null);
  const [mode,setMode]=React.useState('bottle'); // bottle | list
  const [camErr,setCamErr]=React.useState(false);

  React.useEffect(()=>{
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment',width:{ideal:1080},height:{ideal:1920}}})
      .then(s=>{ streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; })
      .catch(()=>setCamErr(true));
    return ()=>{ if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); };
  },[]);

  const LABEL_PROMPT=`You are an expert sommelier with exceptional vision. Analyse this photo and identify any wine bottle label visible — even if partially obscured, at an angle, or in low light. Do your best with whatever text or imagery you can make out. Return ONLY valid JSON (no markdown, no code fences) with these fields: {"name":"full wine name","producer":"winery","vintage":2018,"region":"region","sub_region":"sub-region or empty string","country":"country","type":"red|white|rosé|sparkling","grapes":["Primary Grape"],"body":0.85,"tannins":0.80,"acidity":0.60,"sweetness":0.05,"abv":13.5,"tasting_notes":["Note1","Note2","Note3"],"food_pairings":["Food1","Food2","Food3"],"price_usd":50,"community_rating":4.5,"description":"2-3 sentence approachable description.","why_you_will_like_this":"1-2 sentences personalised to a wine lover.","body_plain":"How heavy it feels in your mouth","tannins_plain":"That drying grip on your gums","acidity_plain":"How zingy and fresh it tastes","sweetness_plain":"Dry means barely any sugar"}. Only return {"error":"no_wine_label"} if there is absolutely no wine bottle or label anywhere in the image.`;

  const LIST_PROMPT=`You are a sommelier reading a wine list. Extract EVERY wine from this image in the order they appear — do not skip any. Return ONLY valid JSON (no markdown): {"wines":[{"n":"wine name","t":"red|white|rosé|sparkling","r":"region","c":"country","v":2020,"p":"price as shown e.g. £85"}]}. Include ALL wines visible. Do not stop early.`;

  function capturePhoto(){
    if(!videoRef.current||!videoRef.current.videoWidth){
      if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
      setPhase('processing');
      if(onboarding){
        sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:true,reason:'camera_not_ready'}));
        setTimeout(()=>onComplete(null),1200);
        return;
      }
      if(mode==='list'){
        sessionStorage.setItem('vinterest_winelist_result',JSON.stringify({demo:true,reason:'camera_not_ready'}));
        setTimeout(()=>nav('winelist'),1600);
      } else {
        sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:true,reason:'camera_not_ready'}));
        setTimeout(()=>nav('identified'),1600);
      }
      return;
    }
    // Capture frame FIRST, then stop stream (stopping first can blank the frame on mobile)
    const vw=videoRef.current.videoWidth;
    const vh=videoRef.current.videoHeight;
    // Resize to max 1024px longest side — keeps payload lean without losing label detail
    const maxDim=1024;
    const scale=Math.min(1,maxDim/Math.max(vw,vh));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(vw*scale);
    canvas.height=Math.round(vh*scale);
    canvas.getContext('2d').drawImage(videoRef.current,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.82);
    const b64=dataUrl.split(',')[1];
    // Stop stream after capture
    if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setCapturedImg(dataUrl);
    setPhase('processing');
    if(mode==='list') processListCapture(b64);
    else processLabelCapture(b64);
  }

  async function processLabelCapture(b64){
    try{
      const text=await window.claude.complete({messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
        {type:'text',text:LABEL_PROMPT}
      ]}]});
      const wine=JSON.parse(text.replace(/```json|```/g,'').trim());
      if(wine.error==='no_wine_label') throw new Error('no_wine_label');
      sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine,confidence:0.95}));
      const _sc=parseInt(localStorage.getItem('vinterest_scan_count')||'0');
      localStorage.setItem('vinterest_scan_count',_sc+1);
      XPSystem.awardAndToast([
        {type:'scan'},{type:'weekly_scans'},
        {type:'first_type',value:wine.type},
        {type:'first_country',value:wine.country},
        {type:'new_grape',value:(wine.grapes||[])[0]},
        ...((wine.price_usd||0)>=100?[{type:'expensive_wine',wineKey:(wine.name||'')+'_'+(wine.vintage||'')}]:[])
      ]);
      if(onboarding){ try{ WineHistory.track(wine); }catch(e){} onComplete(wine); return; }
    }catch(e){
      if(onboarding){ onComplete(null); return; }
      sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:true,reason:e.message}));
      nav('identified');
      return;
    }
    nav('detail');
  }

  async function processListCapture(b64){
    try{
      const text=await window.claude.complete({max_tokens:8192,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
        {type:'text',text:LIST_PROMPT}
      ]}]});
      // Robustly extract JSON — handles extra prose, code fences, truncation
      let cleaned=text.replace(/```json|```/g,'').trim();
      const s=cleaned.indexOf('{'); const e=cleaned.lastIndexOf('}');
      if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
      const data=JSON.parse(cleaned);
      if(data.error) throw new Error(data.error);
      // Normalise compact keys (n/t/r/c/v/p) to full names
      const raw=data.wines||data.wine_list||data.results||[];
      const wines=raw.map(w=>({
        name:w.name||w.n||'Unknown',
        type:w.type||w.t||'red',
        region:w.region||w.r||'',
        country:w.country||w.c||'',
        vintage:w.vintage||w.v||null,
        price:w.price||w.p||''
      }));
      if(!wines.length) throw new Error('no_wines_found');
      sessionStorage.setItem('vinterest_winelist_result',JSON.stringify({demo:false,wines}));
    }catch(e){
      sessionStorage.setItem('vinterest_winelist_result',JSON.stringify({demo:true,reason:e.message}));
    }finally{ nav('winelist'); }
  }

  // ── Processing state ──
  if(phase==='processing'){
    return(
      <div style={{flex:1,background:'#0A0A0A',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28,padding:'0 32px',position:'relative'}}>
        <div onClick={back} style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 12px)',left:20,width:38,height:38,borderRadius:19,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={18} col="#fff"/>
        </div>
        {capturedImg&&(
          <div style={{width:'70%',aspectRatio:'2/3',borderRadius:16,overflow:'hidden',border:`2px solid ${C.cr}`,boxShadow:`0 0 40px ${C.cr}35`}}>
            <img src={capturedImg} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
        )}
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
          <div style={{width:44,height:44,borderRadius:22,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:C.cr,animation:'vspin 0.85s linear infinite'}}/>
          <span style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P}}>{mode==='list'?'Analysing wine list…':'Analysing label…'}</span>
          <span style={{fontSize:16,color:'rgba(255,255,255,0.4)',fontFamily:C.P}}>Identifying {mode==='list'?'wines':'wine'} with AI</span>
        </div>
        <style>{`@keyframes vspin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Viewfinder state ──
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#0A0A0A',position:'relative',overflow:'hidden'}}>
      {/* Camera feed */}
      {!camErr?(
        <video ref={videoRef} autoPlay playsInline muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.88}}/>
      ):(
        <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#1a1a1a,#2d1b2e)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
          <Icon n="camera" sz={42} col="rgba(255,255,255,0.18)"/>
          <span style={{fontSize:16,color:'rgba(255,255,255,0.3)',fontFamily:C.P}}>Camera unavailable in preview</span>
        </div>
      )}

      {/* Top bar */}
      <div style={{position:'relative',zIndex:3,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'calc(env(safe-area-inset-top) + 12px) 20px 16px',flexShrink:0}}>
        <div onClick={back} style={{width:38,height:38,borderRadius:19,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={18} col="#fff"/>
        </div>
        <span style={{fontSize:18,fontWeight:600,color:'#fff',fontFamily:C.P,whiteSpace:'nowrap'}}>{onboarding?'Scan your first bottle':'Scan Wine'}</span>
        <div style={{width:38,height:38}}/>
      </div>

      {/* Large portrait framing box */}
      <div style={{flex:1,position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:mode==='list'?'95%':'94%',height:mode==='list'?'auto':'100%',aspectRatio:mode==='list'?'2/3':'auto',maxHeight:mode==='list'?'87vh':'none',position:'relative'}}>
          {/* Dim overlay outside frame */}
          <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,boxShadow:'0 0 0 2000px rgba(0,0,0,0.52)',pointerEvents:'none',zIndex:1}}/>
          {/* Corner brackets */}
          {[[0,0],[1,0],[0,1],[1,1]].map(([x,y],i)=>(
            <div key={i} style={{
              position:'absolute',zIndex:2,
              [y?'bottom':'top']:-2,[x?'right':'left']:-2,
              width:48,height:48,
              borderTop:y?'none':`3px solid ${C.cr}`,
              borderBottom:y?`3px solid ${C.cr}`:'none',
              borderLeft:x?'none':`3px solid ${C.cr}`,
              borderRight:x?`3px solid ${C.cr}`:'none',
              borderRadius:y?(x?'0 0 10px 0':'0 0 0 10px'):(x?'0 10px 0 0':'10px 0 0 0')
            }}/>
          ))}
          {/* Instruction inside frame */}
          <div style={{position:'absolute',bottom:16,left:0,right:0,textAlign:'center',zIndex:2}}>
            <span style={{fontSize:16,color:'rgba(255,255,255,0.7)',fontFamily:C.P,background:'rgba(0,0,0,0.48)',padding:'5px 14px',borderRadius:20,backdropFilter:'blur(4px)'}}>
              {mode==='list'?'Frame the wine list':'Frame the wine label'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{position:'relative',zIndex:3,padding:'0 20px 44px',display:'flex',flexDirection:'column',alignItems:'center',gap:20,flexShrink:0}}>
        {/* Mode toggle — hidden during onboarding (bottle only) */}
        {!onboarding&&<div style={{display:'inline-flex',background:'rgba(0,0,0,0.55)',borderRadius:10,overflow:'hidden',backdropFilter:'blur(12px)'}}>
          {['Bottle','Wine List'].map((m,i)=>(
            <div key={i} onClick={()=>setMode(i===0?'bottle':'list')} style={{padding:'10px 24px',background:(i===0?mode==='bottle':mode==='list')?C.cr:'transparent',fontSize:17,fontWeight:600,color:(i===0?mode==='bottle':mode==='list')?'#fff':'rgba(255,255,255,0.45)',fontFamily:C.P,cursor:'pointer',transition:'background .18s'}}>{m}</div>
          ))}
        </div>}
        {/* Capture button */}
        <div onClick={capturePhoto} style={{width:74,height:74,borderRadius:37,background:'rgba(255,255,255,0.92)',border:'4px solid rgba(255,255,255,0.35)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 4px 28px rgba(0,0,0,0.5)'}}>
          <div style={{width:56,height:56,borderRadius:28,background:C.cr}}/>
        </div>
      </div>
    </div>
  );
}

/* ── WINE IDENTIFIED ── */
function WineIdentifiedScreen({nav,back}){
  // Read scan result first — everything else depends on it
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const confidence=scanData.confidence||null;

  // Track scan immediately — saves to history even before rating
  React.useEffect(()=>{
    if(wine&&!scanData.demo) WineHistory.track(wine);
  },[wine?.name,wine?.vintage]);

  const existingRating=(scanData&&scanData.existingRating)||0;
  const [score,setScore]=React.useState(existingRating);
  const pendingScore=React.useRef(existingRating);
  const [saved,setSaved]=React.useState(existingRating>0);
  const ratedOnce=React.useRef(existingRating>0);
  const scoreLabel=score===0?'':score<=20?'Not for me':score<=40?"It's ok":score<=60?'Good':score<=80?'Really good':'Exceptional';

  // Only called on mouseup/touchend — commits rating + awards XP once
  function commitScore(v){
    if(!v) v=pendingScore.current;
    const n=Number(v);
    if(n>0&&wine&&!scanData.demo){
      if(existingRating>0){ WineHistory.rate(wine.name,wine.vintage,n); }
      else { WineHistory.add(wine,n); }
      if(!ratedOnce.current){ XPSystem.awardAndToast([{type:'rate'}]); ratedOnce.current=true; }
      setSaved(true);
    }
  }
  // onChange: visual only — no XP, no save
  function handleSliderChange(e){ const n=Number(e.target.value); setScore(n); pendingScore.current=n; }
  // Preset buttons update slider position only — user taps Save to commit
  function handlePreset(p){ setScore(p); pendingScore.current=p; }

  // Display values — real data when available, sensible demo fallback otherwise
  const displayName  = wine?.name         || 'Château Margaux';
  const displaySub   = wine
    ? `${wine.vintage||'NV'} · ${wine.region}, ${wine.country}`
    : '2018 · Bordeaux, France';
  const displayGrape = wine?.grapes?.[0]  || null;
  const displayPrice = wine?.price_usd != null ? `$${wine.price_usd}` : (wine ? '—' : '$180–220');
  const commRating   = wine?.community_rating || 4.7;
  // Deterministic fake ratings count seeded from wine name
  const commCount    = React.useMemo(()=>{
    const name=wine?.name||'Château Margaux';
    let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
    return 180+(h%2820);
  },[wine?.name]);
  const matchPct=React.useMemo(()=>{
    if(!wine) return 94;
    const dna=calcMatchScore(wine,WineHistory.getAll());
    return dna??(confidence?Math.round(Math.min(0.98,confidence)*100):94);
  },[wine?.name]);

  const isDemo = scanData.demo === true;
  const scanReason = scanData.reason || '';

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflowY:'auto'}}>
      {/* Debug / status banner — shows what actually happened */}
      {isDemo && (
        <div style={{background:'#FFF3CD',borderBottom:'1px solid #FFE082',padding:'10px 16px',display:'flex',alignItems:'flex-start',gap:10,flexShrink:0}}>
          <span style={{fontSize:19,flexShrink:0}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:'#7A5200',fontFamily:C.P}}>
              {scanReason==='no_wine_label'&&'Label not detected — move closer and retake'}
              {scanReason==='camera_not_ready'&&'Point camera at a label and tap capture'}
              {scanReason&&!['camera_not_ready','no_wine_label'].includes(scanReason)&&`Error: ${scanReason.slice(0,80)}`}
              {!scanReason&&'Add ANTHROPIC_API_KEY in Netlify → Environment variables'}
            </div>
            {(scanReason==='no_wine_label'||scanReason==='camera_not_ready')&&(
              <div onClick={()=>nav('camera')} style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:20,background:'#8B1A2F',cursor:'pointer'}}>
                <Icon n="camera" sz={12} col="#fff"/>
                <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P}}>Try Again</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div style={{background:C.cr,padding:'16px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon n="check" sz={18} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P}}>Wine Identified!</div>
          <div style={{fontSize:15,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>Tap for full details</div>
        </div>
        <div onClick={back} style={{cursor:'pointer'}}><Icon n="back" sz={20} col="rgba(255,255,255,0.6)"/></div>
      </div>

      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{padding:16}}>
          <div style={{display:'flex',gap:14,alignItems:'flex-start'}}>
            <div style={{width:54,height:76,borderRadius:10,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
              <Icon n="wine" sz={26} col={C.cr}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:22,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{displayName}</div>
              <div style={{fontSize:16,color:C.mid,fontFamily:C.P,marginTop:2}}>{displaySub}</div>
              <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
                <Pill active sm style={{textTransform:'capitalize'}}>{wine?.type||'Red'}</Pill>{displayGrape&&<Pill sm>{displayGrape}</Pill>}
              </div>
            </div>
          </div>
        </Card>

        <div style={{display:'flex',gap:8}}>
          {[{l:'Your Match',v:`${matchPct}%`,sub:null,col:C.green,bg:C.greenBg},
            {l:'Community Score',v:`${commRating}/5`,sub:`★ ${commCount.toLocaleString()} ratings`,col:C.amber,bg:C.amberBg},
            {l:'Price Range',v:displayPrice,sub:null,col:C.ink2,bg:C.white}].map((s,i)=>(
            <div key={i} style={{flex:1,background:s.bg,borderRadius:12,padding:'10px 6px',textAlign:'center',border:`1px solid ${C.line}`}}>
              <div style={{fontSize:19,fontWeight:700,color:s.col,fontFamily:C.P}}>{s.v}</div>
              <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:1,lineHeight:1.3}}>{s.l}</div>
              {s.sub&&<div style={{fontSize:12,color:C.mid,fontFamily:C.P,opacity:0.75}}>{s.sub}</div>}
            </div>
          ))}
        </div>

        <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
          <div style={{fontSize:16,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:4}}>Why you'll love this</div>
          <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{wine?.why_you_will_like_this?.trim()||(wine?`This ${wine.type||'red'} from ${wine.region||wine.country||'the region'} aligns well with your taste profile.`:'Full-bodied with dark fruit and earthy notes — matches your preference for structured reds.')}</div>
        </Card>

        {/* WineDNA fit score */}
        {(()=>{
          if(!wine||scanData.demo) return null;
          const userWines=WineHistory.getAll();
          const typeKey=(wine.type||'red').toLowerCase().replace('é','e');
          const typeWines=userWines.filter(w=>(w.type||'red').toLowerCase().replace('é','e')===typeKey);
          if(!typeWines.length) return(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:14,background:'#F0EBF8',border:'1px solid rgba(123,94,167,0.2)'}}>
              <div style={{width:32,height:32,borderRadius:8,background:'rgba(123,94,167,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <svg viewBox="0 0 24 24" width={16} height={16}><path d="M8 4C8 4 13 7 13 12C13 17 8 20 8 20" stroke="#7B5EA7" strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M16 4C16 4 11 7 11 12C11 17 16 20 16 20" stroke="#7B5EA7" strokeWidth="1.8" fill="none" strokeLinecap="round"/><line x1="8.5" y1="12" x2="15.5" y2="12" stroke="#7B5EA7" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/></svg>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:'#7B5EA7',fontFamily:C.P}}>WineDNA · New Territory</div>
                <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:1}}>First {wine.type||'red'} in your collection — a blank slate.</div>
              </div>
            </div>
          );
          const avgB=typeWines.filter(w=>w.body!=null).reduce((s,w)=>s+w.body,0)/(typeWines.filter(w=>w.body!=null).length||1);
          const avgT=typeWines.filter(w=>w.tannins!=null).reduce((s,w)=>s+w.tannins,0)/(typeWines.filter(w=>w.tannins!=null).length||1);
          const avgA=typeWines.filter(w=>w.acidity!=null).reduce((s,w)=>s+w.acidity,0)/(typeWines.filter(w=>w.acidity!=null).length||1);
          const diff=Math.abs((wine.body||0.65)-avgB)+Math.abs((wine.tannins||0.55)-avgT)+Math.abs((wine.acidity||0.60)-avgA);
          const isClose=diff<0.30, isMed=diff<0.60;
          const lbl=v=>v>=0.68?'High':v>=0.38?'Med':'Low';
          const attrMatch=(a,b)=>Math.abs(a-b)<0.22;
          const label=isClose?'Close match':isMed?'Familiar territory':'Style stretch';
          const accentCol=isClose?C.green:isMed?C.amber:'#7B5EA7';
          const accentBg=isClose?C.greenBg:isMed?C.amberBg:'#F0EBF8';
          const dnaAttrs=[
            {l:'Body',    w:wine.body??0.65,    u:avgB},
            {l:'Tannins', w:wine.tannins??0.55, u:avgT},
            {l:'Acidity', w:wine.acidity??0.60, u:avgA},
          ];
          return(
            <div style={{padding:'12px 14px',borderRadius:14,background:accentBg,border:`1px solid ${accentCol}25`}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <svg viewBox="0 0 24 24" width={15} height={15}><path d="M8 4C8 4 13 7 13 12C13 17 8 20 8 20" stroke={accentCol} strokeWidth="1.8" fill="none" strokeLinecap="round"/><path d="M16 4C16 4 11 7 11 12C11 17 16 20 16 20" stroke={accentCol} strokeWidth="1.8" fill="none" strokeLinecap="round"/><line x1="8.5" y1="12" x2="15.5" y2="12" stroke={accentCol} strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/></svg>
                <div style={{fontSize:15,fontWeight:700,color:accentCol,fontFamily:C.P}}>WineDNA · {label}</div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:5}}>
                {dnaAttrs.map((a,i)=>{
                  const match=attrMatch(a.w,a.u);
                  return(
                    <div key={i} style={{textAlign:'center',padding:'6px 4px',borderRadius:8,background:match?`${C.green}10`:`${accentCol}08`,border:`1px solid ${match?C.green:accentCol}20`}}>
                      <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:1}}>{a.l}</div>
                      <div style={{fontSize:13,fontWeight:700,color:match?C.green:C.ink2,fontFamily:C.P}}>You {lbl(a.u)}</div>
                      <div style={{fontSize:12,color:C.mid,fontFamily:C.P}}>Wine {lbl(a.w)}{match?' ✓':''}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Score slider rating */}
        <Card style={{padding:'14px 16px'}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Rate This Wine</div>
          {/* Quick preset buttons */}
          <div style={{display:'flex',gap:5,marginBottom:12}}>
            {[20,40,60,80,100].map(p=>(
              <div key={p} onClick={()=>handlePreset(p)} style={{flex:1,padding:'7px 2px',borderRadius:9,border:`1.5px solid ${score===p?C.cr:C.line}`,background:score===p?C.cr:'transparent',textAlign:'center',cursor:'pointer',transition:'all .15s'}}>
                <span style={{fontSize:17,fontWeight:700,color:score===p?'#fff':C.mid,fontFamily:C.P}}>{p}</span>
              </div>
            ))}
          </div>
          {/* Slider — onChange updates display only; tap Save to commit */}
          <input type="range" min="0" max="100" step="1" value={score}
            onChange={handleSliderChange}
            style={{width:'100%',accentColor:C.cr,cursor:'pointer',marginBottom:10,display:'block'}}/>
          {/* Score display */}
          <div style={{textAlign:'center',minHeight:52,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2}}>
            {score>0?(
              <>
                <div style={{display:'flex',alignItems:'baseline',gap:3}}>
                  <span style={{fontSize:38,fontWeight:800,color:C.cr,fontFamily:C.P,lineHeight:1}}>{score}</span>
                  <span style={{fontSize:17,color:C.mid,fontFamily:C.P}}>/100</span>
                </div>
                <span style={{fontSize:16,fontWeight:600,color:C.amber,fontFamily:C.P}}>{scoreLabel}</span>
              </>
            ):(
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Drag slider or tap a preset to rate</span>
            )}
          </div>
          {score>0&&!saved&&(
            <div onClick={()=>commitScore()} style={{marginTop:10,background:C.cr,borderRadius:12,padding:'12px',textAlign:'center',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Save Rating</span>
            </div>
          )}
          {saved&&<div style={{textAlign:'center',fontSize:15,color:C.green,fontFamily:C.P,fontWeight:600,marginTop:8}}>✓ Saved to My Wines</div>}
        </Card>

        <Btn primary full onClick={()=>nav('detail')}>See Full Details &amp; Learn More</Btn>
        <Btn full onClick={()=>{try{navigator.share&&navigator.share({title:'Château Margaux 2018 on Vinterest',text:'Check out this wine I found! 🍷',url:'https://vinterest.app'})}catch(e){}}}>Share This Wine</Btn>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

Object.assign(window,{ScanHomeScreen,ScanScreen,WineIdentifiedScreen});
