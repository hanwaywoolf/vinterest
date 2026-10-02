/* Vinterest PWA — Home, Scan, Wine Identified screens */

/* ── SCAN HOME (Scan tab content) ── */
function ScanHomeScreen({nav,showPro,isTablet}){
  const wines=WineHistory.getAll();
  const isPro=Entitlement.isPro();
  const listNeeds=Entitlement.listScanNeeds();
  const scanCount=Entitlement.scanCount();
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
        {/* Wine List – unlocks with Pro on the account (Entitlement.listScanNeeds, as the Worker checks) */}
        {!listNeeds?(
          <div onClick={()=>{ Handoff.cameraMode.set('list'); nav('camera'); }} style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,border:`1px solid ${C.green}40`,cursor:'pointer'}}>
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
          <div onClick={()=>{ if(listNeeds==='signin'){ Handoff.accountIntent.set('listscan'); nav('account'); } else showPro('wine-list'); }} style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,border:`1px solid ${C.line}`,cursor:'pointer',opacity:0.75}}>
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
            <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>My Wines is empty</div>
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
                Handoff.openWine({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0});
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
// Preview has no camera — capturePhoto's "camera not ready" branch simulates a real scan of one
// of these three real bottles instead of the old generic demo fallback, so testing doesn't need
// an actual label. Picked at random each time the shutter is tapped.
/* On the first few camera visits (Flags.galleryHintDue) the framing pill says, for a few seconds,
   that a photo from the gallery works too, and the gallery button pulses; then the pill goes back
   to its usual words. Nothing covers the controls. */
// Only once the camera is live: without it the screen already says to choose a photo, and a visit
// with no camera doesn't use up one of the showings.
function useGalleryHint(live){
  const [on,setOn]=React.useState(false);
  const done=React.useRef(false);
  React.useEffect(()=>{
    if(!live||done.current) return;
    done.current=true;
    if(!Flags.galleryHintDue()) return;
    Flags.markGalleryHint(); setOn(true);
    const t=setTimeout(()=>setOn(false),5500); return()=>clearTimeout(t);
  },[live]);
  return on;
}

/* A 1×1 transparent image: the camera preview's poster, so Android shows no play button. */
const _BLANK_POSTER='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function ScanScreen({nav,back,showPro,onComplete,onSkip}){
  const [camLive,setCamLive]=React.useState(false);
  const galleryHint=useGalleryHint(camLive);
  const onboarding=!!onComplete; // onboarding: save the scan & advance the flow instead of navigating
  const videoRef=React.useRef(null);
  const [videoLive,setVideoLive]=React.useState(false);
  const streamRef=React.useRef(null);
  const [phase,setPhase]=React.useState('viewfinder'); // viewfinder | processing
  const [capturedImg,setCapturedImg]=React.useState(null);
  const [mode,setMode]=React.useState(()=>!onComplete&&Handoff.cameraMode.take()==='list'&&!Entitlement.listScanNeeds()?'list':'bottle'); // bottle | list
  const [camErr,setCamErr]=React.useState(false);
  const CURRENCIES=[{code:'GBP',sym:'£'},{code:'USD',sym:'$'},{code:'CAD',sym:'CA$'},{code:'AUD',sym:'A$'},{code:'NZD',sym:'NZ$'},{code:'EUR',sym:'€'}];
  const homeCurrency=(Regional.current().code)||Settings.currency()||'GBP';
  const [listCurrency,setListCurrency]=React.useState(homeCurrency);
  const [currPickerOpen,setCurrPickerOpen]=React.useState(false);

  React.useEffect(()=>{
    // No explicit width/height — forcing a portrait resolution can push some
    // phones' camera stacks into a cropped/digitally-zoomed capture mode.
    // Native resolution + CSS object-fit:cover handles framing instead.
    navigator.mediaDevices?.getUserMedia({video:{facingMode:'environment'}})
      .then(s=>{
        streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; setCamLive(true);
        // Some phones default multi-camera systems to a 2x telephoto lens — force back to native 1x.
        const track=s.getVideoTracks()[0];
        const caps=track&&track.getCapabilities?track.getCapabilities():null;
        if(caps&&caps.zoom&&typeof caps.zoom.min==='number'){
          track.applyConstraints({advanced:[{zoom:caps.zoom.min}]}).catch(()=>{});
        }
      })
      .catch(()=>setCamErr(true));
    return ()=>{ if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); };
  },[]);



  const fileRef=React.useRef(null);
  // Resize to keep detail without a heavy payload: 1024px on the longest side is plenty for a label,
  // but a whole wine list in 1024px leaves its small print unreadable, so lists get 1600px.
  function processSource(src,w,h){
    const maxDim=mode==='list'?1600:1024;
    const scale=Math.min(1,maxDim/Math.max(w,h));
    const canvas=document.createElement('canvas');
    canvas.width=Math.round(w*scale);
    canvas.height=Math.round(h*scale);
    canvas.getContext('2d').drawImage(src,0,0,canvas.width,canvas.height);
    const dataUrl=canvas.toDataURL('image/jpeg',0.82);
    if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop());
    setCapturedImg(dataUrl);
    setPhase('processing');
    const b64=dataUrl.split(',')[1];
    if(mode==='list') processListCapture(b64);
    else processLabelCapture(b64);
  }
  /* A photo from the library: the fallback when the camera isn't available, and handy for a
     label photographed earlier. */
  function onPickFile(e){
    const file=e.target.files&&e.target.files[0];
    if(!file) return;
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{ processSource(img,img.naturalWidth,img.naturalHeight); URL.revokeObjectURL(url); };
    img.src=url;
  }
  function capturePhoto(){
    // No live camera (permission denied, no camera, not ready yet): pick a photo instead.
    // Never substitute a sample wine: it would be saved as a real scan.
    if(!videoRef.current||!videoRef.current.videoWidth){
      if(fileRef.current) fileRef.current.click();
      return;
    }
    // Capture the frame before stopping the stream (stopping first can blank the frame on mobile).
    processSource(videoRef.current,videoRef.current.videoWidth,videoRef.current.videoHeight);
  }

  async function processLabelCapture(b64){
    try{
      const text=await window.claude.complete({purpose:'label_scan',messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
        {type:'text',text:_loadTextSync('prompts/label-scan.txt')}
      ]}]});
      const wine=WineDNA.cleanWine(JSON.parse(text.replace(/```json|```/g,'').trim()));
      if(wine.error==='no_wine_label') throw new Error('no_wine_label');
      Handoff.openWine({demo:false,wine,confidence:0.95});
      Entitlement.addScan();
      // Scan XP is awarded once the wine is confirmed and saved (ScanFlow.awardScanXP), so a
      // misread label never earns a "new grape" for the wrong grape.
      if(onboarding){ try{ WineHistory.track(wine); ScanFlow.awardScanXP(wine,{defer:true}); ScanFlow.unlockLearning(wine); }catch(e){} onComplete(wine); return; }
    }catch(e){
      if(onboarding){ onComplete(null); return; }
      Handoff.openWine({demo:true,reason:e.message});
      nav('identified');
      return;
    }
    nav('identified');
  }

  async function processListCapture(b64){
    try{
      const text=await window.claude.complete({purpose:'list_scan',max_tokens:8192,messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
        {type:'text',text:ContentEngine.fillTpl(_loadTextSync('prompts/list-scan.txt'),{currency:listCurrency})}
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
        price:w.price||w.p||'',
        grape:w.grape||w.g||'',
        style:w.style||w.s||''
      }));
      if(!wines.length) throw new Error('no_wines_found');
      Handoff.wineList.set({demo:false,wines,currency:listCurrency});
    }catch(e){
      // Keep why it failed: the Worker's own words for "needs Pro / sign in" or a limit, so the
      // results screen never blames the photo for something the photo didn't do.
      Handoff.wineList.set({demo:true,reason:e.message,code:e.code||null,status:e.status||null,signIn:!!e.signIn});
    }finally{ nav('winelist'); }
  }

  // Wine List follows what the Worker allows (Entitlement.listScanNeeds), so a phone that only
  // looks like Pro isn't sent to a scan the server will refuse.
  function pickList(){
    const needs=Entitlement.listScanNeeds();
    if(!needs){ setMode('list'); return; }
    if(needs==='signin'){ Handoff.accountIntent.set('listscan'); nav('account'); return; }
    if(showPro) showPro('wine-list');
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
      {/* Camera feed. Android's WebView draws a big grey play button over any video element that
          hasn't started, whatever its opacity or poster, and it showed behind the camera
          permission prompt. So the video element only exists once the camera has started (after
          permission); it picks up the stream as it mounts, and fades in on its first frame. */}
      {!camErr?(camLive&&
        <video ref={el=>{ videoRef.current=el; if(el&&streamRef.current&&el.srcObject!==streamRef.current) el.srcObject=streamRef.current; }} autoPlay playsInline muted poster={_BLANK_POSTER} onPlaying={()=>setVideoLive(true)} onLoadedData={()=>setVideoLive(true)}
          style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:videoLive?.88:0,transition:'opacity .2s'}}/>
      ):(
        <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#1a1a1a,#2d1b2e)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:8}}>
          <Icon n="camera" sz={42} col="rgba(255,255,255,0.18)"/>
          <span style={{fontSize:16,color:'rgba(255,255,255,0.6)',fontFamily:C.P,textAlign:'center',padding:'0 32px'}}>Camera unavailable. Choose a photo of the {mode==='list'?'wine list':'label'} instead.</span>
          <div onClick={()=>fileRef.current&&fileRef.current.click()} style={{marginTop:8,padding:'10px 20px',borderRadius:22,background:C.cr,color:'#fff',fontSize:16,fontWeight:700,fontFamily:C.P,cursor:'pointer',position:'relative',zIndex:4}}>Choose a photo</div>
        </div>
      )}

      {/* Top bar */}
      <div style={{position:'relative',zIndex:3,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'calc(env(safe-area-inset-top) + 12px) 20px 16px',flexShrink:0}}>
        <div onClick={back} style={{width:38,height:38,borderRadius:19,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={18} col="#fff"/>
        </div>
        <span style={{fontSize:18,fontWeight:600,color:'#fff',fontFamily:C.P,whiteSpace:'nowrap'}}>{onboarding?'Scan your first bottle':'Scan Wine'}</span>
        {onSkip
          ?<span onClick={onSkip} style={{minWidth:38,textAlign:'right',fontSize:15,fontWeight:600,color:'rgba(255,255,255,0.75)',fontFamily:C.P,cursor:'pointer'}}>Skip</span>
          :<div style={{width:38,height:38}}/>}
      </div>

      {/* Large portrait framing box */}
      {/* Both modes fill the space between the top bar and the controls (minHeight 0 lets it shrink):
          a list frame sized from the width (2:3) was taller than that space on tall phones and pushed
          the shutter off the bottom of the screen. */}
      <div style={{flex:1,minHeight:0,position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:mode==='list'?'95%':'94%',height:'100%',position:'relative'}}>
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
            <span role="status" style={{fontSize:16,color:galleryHint?'#fff':'rgba(255,255,255,0.7)',fontWeight:galleryHint?600:400,fontFamily:C.P,background:galleryHint?'rgba(139,26,47,0.85)':'rgba(0,0,0,0.48)',padding:'5px 14px',borderRadius:18,display:'inline-block',maxWidth:'calc(100% - 32px)',lineHeight:1.35,backdropFilter:'blur(4px)',transition:'background .4s, color .4s'}}>
              {galleryHint?'Or pick a photo from your gallery ↓':mode==='list'?'Frame the wine list':'Frame the wine label'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div style={{position:'relative',zIndex:3,padding:'0 20px 44px',display:'flex',flexDirection:'column',alignItems:'center',gap:20,flexShrink:0}}>
        {/* List currency picker — only relevant when scanning a wine list, e.g. while travelling */}
        {!onboarding&&mode==='list'&&(
          <div style={{position:'relative'}}>
            <div onClick={()=>setCurrPickerOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:20,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(12px)',cursor:'pointer'}}>
              <span style={{fontSize:15,fontWeight:600,color:'#fff',fontFamily:C.P}}>List prices in {listCurrency}</span>
              <Icon n="chevron" sz={11} col="rgba(255,255,255,0.6)" style={{transform:currPickerOpen?'rotate(-90deg)':'rotate(90deg)'}}/>
            </div>
            {currPickerOpen&&(
              <div style={{position:'absolute',bottom:'calc(100% + 8px)',left:'50%',transform:'translateX(-50%)',background:'rgba(20,20,20,0.92)',backdropFilter:'blur(12px)',borderRadius:12,padding:6,display:'flex',flexDirection:'column',gap:2,minWidth:150}}>
                {CURRENCIES.map(c=>(
                  <div key={c.code} onClick={()=>{setListCurrency(c.code);setCurrPickerOpen(false);}} style={{padding:'8px 12px',borderRadius:8,background:listCurrency===c.code?C.cr:'transparent',display:'flex',justifyContent:'space-between',cursor:'pointer'}}>
                    <span style={{fontSize:15,fontWeight:600,color:'#fff',fontFamily:C.P}}>{c.code}</span>
                    <span style={{fontSize:15,color:'rgba(255,255,255,0.6)',fontFamily:C.P}}>{c.sym}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Mode toggle — hidden during onboarding (bottle only) */}
        {!onboarding&&<div style={{display:'inline-flex',background:'rgba(0,0,0,0.55)',borderRadius:10,overflow:'hidden',backdropFilter:'blur(12px)'}}>
          {['Bottle','Wine List'].map((m,i)=>(
            <div key={i} onClick={()=>i===0?setMode('bottle'):pickList()} style={{padding:'10px 24px',background:(i===0?mode==='bottle':mode==='list')?C.cr:'transparent',fontSize:17,fontWeight:600,color:(i===0?mode==='bottle':mode==='list')?'#fff':'rgba(255,255,255,0.45)',fontFamily:C.P,cursor:'pointer',transition:'background .18s'}}>{m}</div>
          ))}
        </div>}
        {/* Capture button, with a photo-library picker beside it */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:28,width:'100%'}}>
          <div style={{width:48}}/>
          <div onClick={capturePhoto} aria-label="Take photo" style={{width:74,height:74,borderRadius:37,background:'rgba(255,255,255,0.92)',border:'4px solid rgba(255,255,255,0.35)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 4px 28px rgba(0,0,0,0.5)'}}>
            <div style={{width:56,height:56,borderRadius:28,background:C.cr}}/>
          </div>
          <div style={{position:'relative',width:48,height:48}}>
            <div onClick={()=>fileRef.current&&fileRef.current.click()} role="button" aria-label="Choose a photo from your gallery" style={{width:48,height:48,borderRadius:12,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(12px)',border:`1.5px solid ${galleryHint?'#fff':'rgba(255,255,255,0.35)'}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',animation:galleryHint?'vinGalleryPulse 1.2s ease-in-out 3':'none'}}>
              <style>{'@keyframes vinGalleryPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}'}</style>
              <Icon n="gallery" sz={24} col="#fff"/>
            </div>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} data-testid="scan-file" style={{display:'none'}}/>
      </div>
    </div>
  );
}

/* ── WINE IDENTIFIED ──
   Goes straight to the same full wine-detail presentation used everywhere
   else in the app — no separate "Wine Identified!" holding screen. */
function WineIdentifiedScreen({nav,back,showPro}){
  const scanData=React.useMemo(()=>{
    try{ return Handoff.scanResult.get({}); }
    catch(e){ return {}; }
  },[]);
  // No tracking here — ScanCardsScreen (rendered below) already calls WineHistory.track() once
  // per scan. Tracking twice was double-incrementing times_consumed on every single scan.
  return <ScanCardsScreen nav={nav} back={back} showPro={showPro}/>;
}

Object.assign(window,{ScanHomeScreen,ScanScreen,WineIdentifiedScreen});
