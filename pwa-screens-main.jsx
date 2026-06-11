/* Vinterest PWA — Home, Scan, Wine Identified screens */

function HomeScreen({nav}){
  const [profileTab,setProfileTab]=React.useState(0);
  const scripts=[
    {col:'#8B1A2F',label:'Reds',    script:'"I enjoy full-bodied reds with earthy notes and structured tannins — Bordeaux blends and Barolo are favourites. Dry, $40–80."'},
    {col:'#B8963E',label:'Whites',  script:'"I love crisp, dry whites with citrus and mineral notes — Sancerre and white Burgundy are my go-tos. $25–60."'},
    {col:'#C47A8A',label:'Rosé',    script:'"I prefer bone-dry Provençal rosé with delicate red fruit — light, elegant, refreshing. $20–40."'},
    {col:'#5E8FA8',label:'Sparkling',script:'"I enjoy Champagne and Crémant — dry (Brut), with brioche and citrus notes. $40–90."'},
  ];
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto'}}>
      {/* Header */}
      <div style={{padding:'16px 20px 0',display:'flex',justifyContent:'space-between',alignItems:'center',background:C.white}}>
        <div>
          <div style={{fontSize:11,color:C.mid,fontFamily:C.P}}>Good evening</div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px'}}>Vinterest</div>
        </div>
        <div onClick={()=>nav('profile')} style={{width:40,height:40,borderRadius:20,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
          <Icon n="user" sz={20} col={C.cr}/>
          {!localStorage.getItem('vinterest_api_key')||localStorage.getItem('vinterest_api_key')==='demo'?<div style={{position:'absolute',top:0,right:0,width:10,height:10,borderRadius:5,background:'#E57373',border:'1.5px solid #fff'}}/>:null}
        </div>
      </div>

      <div style={{padding:'16px 20px 0',display:'flex',flexDirection:'column',gap:12}}>
        {/* QUICK ACTIONS label */}
        <div style={{fontSize:10,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Quick Actions</div>

        {/* Primary scan CTA */}
        <div onClick={()=>nav('scan')} style={{background:C.ink,borderRadius:20,padding:'18px 20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:-16,top:-16,width:110,height:110,borderRadius:55,background:'rgba(139,26,47,0.3)'}}/>
          <div style={{width:52,height:52,borderRadius:14,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,boxShadow:`0 4px 16px ${C.cr}50`}}>
            <Icon n="camera" sz={26} col="#fff"/>
          </div>
          <div style={{flex:1,zIndex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Scan a Bottle</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:C.P,marginTop:1}}>Point at any label to identify</div>
          </div>
          <Icon n="chevron" sz={16} col="rgba(255,255,255,0.35)"/>
        </div>

        {/* Secondary actions */}
        <div style={{display:'flex',gap:10}}>
          {[{i:'fork',l:'Restaurant',s:'restaurant',hint:'Scan menus, get scripts'},{i:'cart',l:'Shopping',s:'shopping',hint:'Match wines in store'}].map((a,i)=>(
            <div key={i} onClick={()=>nav(a.s)} style={{flex:1,background:C.white,borderRadius:16,padding:'14px',display:'flex',flexDirection:'column',gap:8,border:`1px solid ${C.line}`,cursor:'pointer'}}>
              <div style={{width:38,height:38,borderRadius:10,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n={a.i} sz={20} col={C.cr}/>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P}}>{a.l}</div>
                <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>{a.hint}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Taste Profile with category tabs */}
        <div style={{fontSize:10,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Your Taste Profile</span>
          <span onClick={()=>nav('profile')} style={{color:C.cr,cursor:'pointer',textTransform:'none',fontSize:11,letterSpacing:'normal',fontWeight:600}}>Full Profile →</span>
        </div>
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:`1px solid ${C.line}`}}>
            {scripts.map((t,i)=>(
              <div key={i} onClick={()=>setProfileTab(i)} style={{flex:1,textAlign:'center',padding:'10px 4px',cursor:'pointer',borderBottom:i===profileTab?`2px solid ${t.col}`:'2px solid transparent',marginBottom:-1}}>
                <div style={{width:8,height:8,borderRadius:4,background:t.col,margin:'0 auto 3px'}}/>
                <span style={{fontSize:9.5,fontWeight:i===profileTab?700:400,color:i===profileTab?t.col:C.mid,fontFamily:C.P}}>{t.label}</span>
              </div>
            ))}
          </div>
          <div style={{padding:'12px 14px'}}>
            <div style={{fontSize:11,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6,marginBottom:10}}>{scripts[profileTab].script}</div>
            <div style={{display:'flex',gap:8}}>
              <div onClick={()=>{try{navigator.clipboard.writeText(scripts[profileTab].script.replace(/"/g,''))}catch(e){}}} style={{flex:1,background:scripts[profileTab].col,borderRadius:8,padding:'8px',textAlign:'center',cursor:'pointer'}}>
                <span style={{fontSize:10,fontWeight:600,color:'#fff',fontFamily:C.P}}>Copy Script</span>
              </div>
              <div onClick={()=>nav('profile')} style={{flex:1,background:C.offWhite,borderRadius:8,padding:'8px',textAlign:'center',border:`1px solid ${C.line}`,cursor:'pointer'}}>
                <span style={{fontSize:10,fontWeight:500,color:C.ink2,fontFamily:C.P}}>Edit Preferences</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Continue Learning */}
        <div style={{fontSize:10,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>Continue Learning</span>
          <span onClick={()=>nav('learn')} style={{color:C.cr,cursor:'pointer',textTransform:'none',fontSize:11,letterSpacing:'normal',fontWeight:600}}>See All →</span>
        </div>
        <div style={{display:'flex',gap:10,paddingBottom:16}}>
          {[{l:'Red Grapes',p:.8,col:'#8B1A2F'},{l:'French Regions',p:.3,col:'#3D6B3D'},{l:'Tasting Technique',p:.1,col:'#5E8FA8'}].map((t,i)=>(
            <div key={i} onClick={()=>nav('learn')} style={{flex:1,background:C.white,borderRadius:14,padding:'12px 10px',border:`1px solid ${C.line}`,cursor:'pointer'}}>
              <Prog val={t.p} col={t.col} h={3} style={{marginBottom:8}}/>
              <div style={{fontSize:10,fontWeight:600,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{t.l}</div>
              <div style={{fontSize:9,color:C.mid,fontFamily:C.P,marginTop:2}}>{Math.round(t.p*10)}/10</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── SCAN CAMERA ── */
function ScanScreen({nav,back}){
  const videoRef=React.useRef(null);
  const [mode,setMode]=React.useState('bottle'); // bottle | list
  const [scanning,setScanning]=React.useState(false);
  const [camErr,setCamErr]=React.useState(false);

  React.useEffect(()=>{
    let stream=null;
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment',width:{ideal:1280},height:{ideal:720}}})
      .then(s=>{stream=s;if(videoRef.current){videoRef.current.srcObject=s;}})
      .catch(()=>setCamErr(true));
    return ()=>{if(stream)stream.getTracks().forEach(t=>t.stop());};
  },[]);

  function captureFrame(){
    if(!videoRef.current||!videoRef.current.videoWidth) return null;
    const canvas=document.createElement('canvas');
    canvas.width=videoRef.current.videoWidth;
    canvas.height=videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current,0,0);
    // Strip the data:image/jpeg;base64, prefix — API wants raw base64
    return canvas.toDataURL('image/jpeg',0.8).split(',')[1];
  }

  async function doScan(){
    setScanning(true);
    try{
      const image=captureFrame();
      if(!image){
        console.warn('captureFrame returned null — camera not ready');
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({demo:true,reason:'camera_not_ready'}));
        nav('identified');
        return;
      }

      // Pass key in request body so the Netlify Function can use it server-side
      const apiKey=localStorage.getItem('vinterest_api_key');
      console.log('Sending frame to /api/recognise, key present:', !!apiKey);
      const res=await fetch('/api/recognise',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({image, clientKey: (apiKey&&apiKey!=='demo')?apiKey:undefined}),
      });
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data=await res.json();
      console.log('Scan result:', data);
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify(data));
    } catch(e){
      console.warn('Scan error:', e.message);
      const reason=e.message==='no_wine_label'?'no_wine_label':e.message;
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({demo:true,reason}));
    } finally{
      setScanning(false);
      nav('identified');
    }
  }

  const CLAUDE_PROMPT=`You are an expert sommelier. Analyse this wine label image. Return ONLY valid JSON with these fields: {"name":"full wine name","producer":"winery","vintage":2018,"region":"region","country":"country","type":"red|white|rosé|sparkling","grapes":["Grape"],"body":0.85,"tannins":0.80,"acidity":0.60,"sweetness":0.05,"abv":13.5,"tasting_notes":["Note"],"food_pairings":["Food"],"price_usd":50,"community_rating":4.5,"description":"2-3 sentence description.","why_you_will_like_this":"1-2 sentences.","body_plain":"How heavy it feels in your mouth","tannins_plain":"That drying grip on your gums","acidity_plain":"How zingy and fresh it tastes","sweetness_plain":"Dry means barely any sugar"}. If no wine label visible return {"error":"no_wine_label"}.`;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:'#0A0A0A',position:'relative',overflow:'hidden'}}>
      {/* Live camera or fallback */}
      {!camErr?(
        <video ref={videoRef} autoPlay playsInline muted style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:.85}}/>
      ):(
        <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#1a1a1a,#2d1b2e)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
          <Icon n="camera" sz={40} col="rgba(255,255,255,0.2)"/>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',fontFamily:C.P}}>Camera unavailable in this browser</span>
        </div>
      )}

      {/* Top bar */}
      <div style={{position:'relative',zIndex:3,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px'}}>
        <div onClick={back} style={{width:38,height:38,borderRadius:19,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={18} col="#fff"/>
        </div>
        <span style={{fontSize:14,fontWeight:600,color:'#fff',fontFamily:C.P}}>Scan Wine</span>
        <div style={{width:38,height:38,borderRadius:19,background:'rgba(0,0,0,0.4)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="4.5" stroke="#fff" strokeWidth="1.5" fill="none"/><line x1="10" y1="2" x2="10" y2="5" stroke="#fff" strokeWidth="1.3"/><line x1="10" y1="15" x2="10" y2="18" stroke="#fff" strokeWidth="1.3"/><line x1="2" y1="10" x2="5" y2="10" stroke="#fff" strokeWidth="1.3"/><line x1="15" y1="10" x2="18" y2="10" stroke="#fff" strokeWidth="1.3"/></svg>
        </div>
      </div>

      {/* Viewfinder */}
      <div style={{flex:1,position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:220,height:300,position:'relative'}}>
          {[[0,0],[1,0],[0,1],[1,1]].map(([x,y],i)=>(
            <div key={i} style={{position:'absolute',[y?'bottom':'top']:-1,[x?'right':'left']:-1,width:30,height:30,borderTop:y?'none':`2.5px solid ${C.cr}`,borderBottom:y?`2.5px solid ${C.cr}`:'none',borderLeft:x?'none':`2.5px solid ${C.cr}`,borderRight:x?`2.5px solid ${C.cr}`:'none',borderRadius:y?x?'0 0 6px 0':'0 0 0 6px':x?'0 6px 0 0':'6px 0 0 0'}}/>
          ))}
          {scanning&&<div style={{position:'absolute',top:0,left:4,right:4,height:2,background:`linear-gradient(90deg,transparent,${C.cr},transparent)`,boxShadow:`0 0 12px ${C.cr}`,animation:'scanline 1.5s linear infinite'}}/>}
          <div style={{position:'absolute',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:55,height:160,borderRadius:'10px 10px 6px 6px',border:'1px dashed rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon n="wine" sz={32} col="rgba(255,255,255,0.08)"/>
          </div>
        </div>
      </div>

      {/* Bottom */}
      <div style={{position:'relative',zIndex:3,padding:'0 20px 32px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>{scanning?'Identifying wine…':'Point camera at the wine label'}</div>
        <div style={{display:'inline-flex',background:'rgba(0,0,0,0.5)',borderRadius:10,overflow:'hidden',backdropFilter:'blur(12px)'}}>
          {['Bottle','Wine List'].map((m,i)=>(
            <div key={i} onClick={()=>setMode(i===0?'bottle':'list')} style={{padding:'9px 22px',background:(i===0?mode==='bottle':mode==='list')?C.cr:'transparent',fontSize:12,fontWeight:600,color:(i===0?mode==='bottle':mode==='list')?'#fff':'rgba(255,255,255,0.45)',fontFamily:C.P,cursor:'pointer'}}>{m}</div>
          ))}
        </div>
        {/* Shutter */}
        <div onClick={doScan} style={{width:64,height:64,borderRadius:32,background:scanning?'rgba(255,255,255,0.3)':'rgba(255,255,255,0.9)',border:'3px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all .2s'}}>
          {scanning?<div style={{width:24,height:24,borderRadius:12,background:C.cr}}/>:<Icon n="scan" sz={28} col={C.ink}/>}
        </div>
      </div>
      <style>{`@keyframes scanline{0%{top:0}100%{top:calc(100% - 2px)}}`}</style>
    </div>
  );
}

/* ── WINE IDENTIFIED ── */
function WineIdentifiedScreen({nav,back}){
  const [rating,setRating]=React.useState(0);
  const [hov,setHov]=React.useState(0);
  const labels=['','Not for me',"It's ok",'Good','Really good','Exceptional'];
  const active=hov||rating;

  // Read scan result written by ScanScreen
  const scanData=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_scan_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const wine=scanData.wine||null;
  const confidence=scanData.confidence||null;

  // Display values — real data when available, sensible demo fallback otherwise
  const displayName  = wine?.name         || 'Château Margaux';
  const displaySub   = wine
    ? `${wine.vintage||'NV'} · ${wine.region}, ${wine.country}`
    : '2018 · Bordeaux, France';
  const displayGrape = wine?.grapes?.[0]  || 'Cabernet Blend';
  const displayPrice = wine ? `$${wine.price_usd}` : '$180–220';
  const displayRating= wine ? `${wine.community_rating}★` : '4.7★';
  const matchPct     = confidence ? Math.round(Math.min(0.98,confidence)*100) : 94;

  const isDemo = scanData.demo === true;
  const scanReason = scanData.reason || '';

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflowY:'auto'}}>
      {/* Debug / status banner — shows what actually happened */}
      {isDemo && (
        <div style={{background:'#FFF3CD',borderBottom:'1px solid #FFE082',padding:'8px 16px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          <span style={{fontSize:14}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:600,color:'#7A5200',fontFamily:C.P}}>Demo Mode — showing sample wine</div>
            <div style={{fontSize:9.5,color:'#9A6500',fontFamily:C.P}}>
              {scanReason==='camera_not_ready' && 'Camera frame not captured — try again with camera fully loaded'}
              {scanReason==='no_api_key' && 'Add ANTHROPIC_API_KEY in Netlify → Site Settings → Environment Variables'}
              {!scanReason || (!['camera_not_ready','no_api_key'].includes(scanReason)) && `Reason: ${scanReason||'API unreachable — check Netlify function logs'}`}
            </div>
          </div>
        </div>
      )}
      {!isDemo && (
        <div style={{background:'#E8F5E9',borderBottom:'1px solid #C8E6C9',padding:'6px 16px',display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <span style={{fontSize:12}}>✓</span>
          <span style={{fontSize:10,fontWeight:600,color:C.green,fontFamily:C.P}}>Scanned from real label via Claude Vision</span>
        </div>
      )}
      <div style={{background:C.cr,padding:'16px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Icon n="check" sz={18} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P}}>Wine Identified!</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>Tap for full details</div>
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
              <div style={{fontSize:18,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{displayName}</div>
              <div style={{fontSize:11,color:C.mid,fontFamily:C.P,marginTop:2}}>{displaySub}</div>
              <div style={{display:'flex',gap:5,marginTop:8,flexWrap:'wrap'}}>
                <Pill active sm style={{textTransform:'capitalize'}}>{wine?.type||'Red'}</Pill><Pill sm>{displayGrape}</Pill>
              </div>
            </div>
          </div>
        </Card>

        <div style={{display:'flex',gap:8}}>
          {[{l:'Your Match',v:`${matchPct}%`,col:C.green,bg:C.greenBg},{l:'Community',v:displayRating,col:C.amber,bg:C.amberBg},{l:'Price Range',v:displayPrice,col:C.ink2,bg:C.white}].map((s,i)=>(
            <div key={i} style={{flex:1,background:s.bg,borderRadius:12,padding:'10px 6px',textAlign:'center',border:`1px solid ${C.line}`}}>
              <div style={{fontSize:15,fontWeight:700,color:s.col,fontFamily:C.P}}>{s.v}</div>
              <div style={{fontSize:8.5,color:C.mid,fontFamily:C.P,marginTop:1}}>{s.l}</div>
            </div>
          ))}
        </div>

        <Card style={{background:C.greenBg,boxShadow:'none',border:`1px solid ${C.green}25`,padding:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,fontFamily:C.P,marginBottom:4}}>Why you'll love this</div>
          <div style={{fontSize:11,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>Full-bodied with dark fruit and earthy notes — matches your preference for structured Bordeaux-style reds.</div>
        </Card>

        {/* Star rating */}
        <Card style={{padding:'14px 16px'}}>
          <div style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Rate This Wine</div>
          <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:8}}>
            {[1,2,3,4,5].map(i=>(
              <div key={i} onClick={()=>setRating(i)} onMouseEnter={()=>setHov(i)} onMouseLeave={()=>setHov(0)}
                style={{cursor:'pointer',transform:active>=i?'scale(1.18)':'scale(1)',transition:'transform .15s'}}>
                <svg viewBox="0 0 20 20" width="34" height="34">
                  <polygon points="10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6"
                    fill={active>=i?C.amber:'#E8E8E8'} stroke={active>=i?C.amber:'#D0D0D0'} strokeWidth="0.5"/>
                </svg>
              </div>
            ))}
          </div>
          {active>0?<div style={{textAlign:'center',fontSize:12,fontWeight:600,color:C.amber,fontFamily:C.P}}>{labels[active]}</div>
            :<div style={{textAlign:'center',fontSize:10,color:C.mid,fontFamily:C.P}}>Tap a star — helps build your taste profile</div>}
        </Card>

        <Btn primary full onClick={()=>nav('detail')}>See Full Details &amp; Learn More</Btn>
        <Btn full onClick={()=>{try{navigator.share&&navigator.share({title:'Château Margaux 2018 on Vinterest',text:'Check out this wine I found! 🍷',url:'https://vinterest.app'})}catch(e){}}}>Share This Wine</Btn>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

Object.assign(window,{HomeScreen,ScanScreen,WineIdentifiedScreen});
