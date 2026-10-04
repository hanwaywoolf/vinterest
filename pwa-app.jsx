/* Vinterest PWA — Main App with navigation */

function App(){
  const [screen,setScreen]=React.useState(()=>{
    if(!Settings.onboarded()) return 'onboarding';
    const h=window.location.hash.replace('#','').toLowerCase();
    return (h&&h!=='onboarding')?h:'home';
  });
  // The way back: Home, then each screen opened since (a deep link opens above Home).
  const [stack,setStack]=React.useState(()=>{
    if(!Settings.onboarded()) return ['onboarding'];
    const h=window.location.hash.replace('#','').toLowerCase();
    return h&&h!=='home'&&h!=='onboarding'?['home',h]:['home'];
  });
  const [proGate,setProGate]=React.useState(null);
  // On opening: types whose Explore Next is already open count as celebrated, so only a type
  // that opens from now on gets WineDNA's "Explore Next is ready" moment.
  React.useEffect(()=>{ try{ ExploreNext.noteReady(WineHistory.getAll()); }catch(e){} },[]);
  // Files the milestones a phone has already reached as "earlier" the first time it looks (once).
  React.useEffect(()=>{ try{ if(Settings.onboarded()&&!Milestones.seen()) Milestones.check(KnowledgeMap.compute(),Palate.compute()); }catch(e){} },[]);
  // A new text size (TextSize, pwa-textsize.js) re-renders every screen at once.
  const [,setTextTick]=React.useState(0);
  React.useEffect(()=>{ const h=()=>setTextTick(t=>t+1); window.addEventListener('vinterest:textsize',h); return()=>window.removeEventListener('vinterest:textsize',h); },[]);

  // Tablet / iPad detection (Device.forceMobile() overrides it for the preview panel)
  const forceMobile=()=>Device.forceMobile();
  const [isTablet,setIsTablet]=React.useState(()=>!forceMobile()&&window.innerWidth>=768);
  React.useEffect(()=>{
    const h=()=>setIsTablet(!forceMobile()&&window.innerWidth>=768);
    window.addEventListener('resize',h);
    return()=>window.removeEventListener('resize',h);
  },[]);

  /* Back follows the way they came, never in circles. Going to a screen already on the way back
     (a quiz's "Back to Learn", Home from anywhere) returns to it, rewinding the browser's history
     to that entry rather than stacking a new copy on top, so the in-app arrow and the phone's
     own back gesture always agree: from Learn after a quiz, both go Home, not into the quiz.
     `pushed` counts the history entries this visit added, so a rewind never leaves the app. */
  const stackRef=React.useRef(stack); stackRef.current=stack;
  const screenRef0=React.useRef(screen); screenRef0.current=screen;
  const pushed=React.useRef(0);
  const go=ns=>{ const to=ns[ns.length-1]; stackRef.current=ns; screenRef0.current=to; setStack(ns); setScreen(to); };
  function nav(to){
    const s=stackRef.current, i=s.lastIndexOf(to), up=s.length-1-i;
    if(i>=0&&up===0){ go(s); return; }
    if(i>=0&&up<=pushed.current){ pushed.current-=up; go(s.slice(0,i+1)); history.go(-up); return; }
    if(i>=0||to==='home'){ go(i>=0?s.slice(0,i+1):['home']); history.replaceState(null,'','#'+to); return; }
    pushed.current++; go([...s,to]); window.location.hash=to;
  }
  function back(){
    const s=stackRef.current, ns=s.length<=1?['home']:s.slice(0,-1);
    if(s.length>1&&pushed.current>0){ pushed.current--; go(ns); history.back(); return; }
    go(ns); history.replaceState(null,'','#'+ns[ns.length-1]);
  }

  // The phone's back (or forward, or a link to a new hash): follow the same path.
  React.useEffect(()=>{
    const onPop=()=>{
      const h=window.location.hash.replace('#','').toLowerCase()||'home';
      if(h===screenRef0.current) return; // our own change
      const s=stackRef.current, i=s.lastIndexOf(h);
      if(i>=0){ pushed.current=Math.max(0,pushed.current-(s.length-1-i)); go(s.slice(0,i+1)); }
      else { pushed.current++; go([...s,h]); }
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);

  const showNav=!['camera','onboarding','identified'].includes(screen);

  // XP Badge + overlay
  const [xpBadge,setXpBadge]=React.useState(()=>XPSystem.get());
  const [showXpOverlay,setShowXpOverlay]=React.useState(false);
  React.useEffect(()=>{
    const handler=()=>setXpBadge(XPSystem.get());
    window.addEventListener('vinterest:xp',handler);
    return ()=>window.removeEventListener('vinterest:xp',handler);
  },[]);
  const showXpBadge=!['camera','onboarding','learn','quiz','article','gen-article','guide','identified','detail','mywines','scan','profile','style-explore','winelist','account','settings','mastery-map','grape'].includes(screen);

  // XP and the moments behind it (pwa-moments.jsx): a quiet chip, and cards that wait for a calm screen.
  const xpDel=useXPDelivery();
  const actOnMoment=a=>{
    xpDel.dismiss();
    if(a.level) return setShowXpOverlay(true);
    if(a.pro) return setProGate(a.pro);
    if(a.learn) return _openLearn(a.learn,nav,setProGate);
    if(a.screen==='mastery-map') return Entitlement.isPro()?nav('mastery-map'):setProGate('mastery-map');
    if(a.screen) nav(a.screen);
  };

  // Signed in: fetch the server's word on Pro and this week's usage (Account caches it).
  React.useEffect(()=>{ Platform.start(); if(Account.signedIn()) Account.refreshMe(); },[]);
  // Pro can change with sign-in or sign-out; re-render so gates follow.
  const [,setAcctTick]=React.useState(0);
  React.useEffect(()=>{ const h=()=>setAcctTick(t=>t+1); window.addEventListener('vinterest:account',h); return()=>window.removeEventListener('vinterest:account',h); },[]);

  // When a sync brings in wines or XP from another phone, redraw the screen being looked at so it
  // shows them, but only on screens with nothing half-done (never mid-scan, mid-rating or in a quiz).
  // Safari paints the strip behind the home indicator (and any toolbar gap) with the page's own
  // background, not the app's. Keep the page background the colour of whatever sits at the bottom
  // of the screen: dark under the welcome and camera screens, white under the nav. Otherwise a
  // dark screen shows a white bar beneath it.
  React.useEffect(()=>{
    let raf=0;
    const sync=()=>{ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>{
      let el=document.elementFromPoint(window.innerWidth/2,window.innerHeight-2), c='';
      for(;el&&el!==document.documentElement;el=el.parentElement){ const b=getComputedStyle(el).backgroundColor; if(b&&b!=='transparent'&&!/,\s*0\)$/.test(b)){ c=b; break; } }
      if(c){ document.documentElement.style.backgroundColor=c; document.body.style.backgroundColor=c; }
    }); };
    sync(); const t=setTimeout(sync,350);
    const mo=new MutationObserver(sync); const root=document.getElementById('root');
    if(root) mo.observe(root,{childList:true,subtree:true});
    window.addEventListener('resize',sync);
    return()=>{ clearTimeout(t); cancelAnimationFrame(raf); mo.disconnect(); window.removeEventListener('resize',sync); };
  },[screen]);

  const [dataGen,setDataGen]=React.useState(0);
  const screenRef=React.useRef(screen); screenRef.current=screen;
  React.useEffect(()=>{
    const h=e=>{ if(e.detail&&e.detail.changed&&['home','mywines','profile','learn','account'].includes(screenRef.current)) setDataGen(g=>g+1); };
    window.addEventListener('vinterest:sync',h); return()=>window.removeEventListener('vinterest:sync',h);
  },[]);

  const ctx={nav,back,showPro:setProGate,isTablet};

  return(
    <div style={{width:'100%',maxWidth:isTablet?'100%':430,height:'100%',margin:'0 auto',background:(screen==='camera')?'#0A0A0A':C.bg,display:'flex',flexDirection:'column',position:'relative',overflow:'hidden',boxSizing:'border-box',paddingTop:(screen==='onboarding'||screen==='camera')?0:'env(safe-area-inset-top)'}}>
      <div key={dataGen} style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
        {screen==='onboarding' && <NewUserFlow onComplete={()=>{Settings.setOnboarded();nav('home');}}/>}
        {screen==='home'      && <HomeScreen {...ctx}/>}
        {screen==='scan'      && <ScanHomeScreen {...ctx}/>}
        {screen==='camera'    && <ScanScreen {...ctx}/>}
        {screen==='identified'&& <WineIdentifiedScreen {...ctx}/>}
        {screen==='winelist'  && <WineListScreen {...ctx}/>}
        {screen==='detail'    && <WineDetailScreen {...ctx}/>}
        {screen==='region'    && <RegionScreen {...ctx}/>}
        {screen==='varietal'  && <VarietalScreen {...ctx}/>}
        {screen==='similar'   && <SimilarWinesScreen {...ctx}/>}
        {screen==='style-explore' && <StyleExploreScreen {...ctx}/>}
        {screen==='profile'   && <WineDNAScreen {...ctx}/>}
        {screen==='mywines'   && <MyWinesScreen {...ctx}/>}
        {screen==='learn'     && <ScreenErrorBoundary><QuizHubScreen {...ctx}/></ScreenErrorBoundary>}
        {screen==='quiz'      && <QuizScreen {...ctx}/>}
        {screen==='mastery-map' && <MasteryMapScreen {...ctx}/>}
        {screen==='grape' && <GrapeScreen {...ctx}/>}
        {screen==='article'   && <ScreenErrorBoundary><LearnArticleScreen {...ctx}/></ScreenErrorBoundary>}
        {screen==='gen-article'&& <ScreenErrorBoundary><GenArticleScreen {...ctx}/></ScreenErrorBoundary>}
        {screen==='guide'&& <ScreenErrorBoundary><GuideScreen {...ctx}/></ScreenErrorBoundary>}
        {screen==='account'   && <AccountProfileScreen {...ctx}/>}
        {screen==='settings'  && <AccountProfileScreen {...ctx}/>/* Settings merged into Profile; old links land there */}
      </div>
      {showNav&&MOMENT_SCREENS.includes(screen)&&xpDel.moment?<MomentCard m={xpDel.moment} more={xpDel.more} onAct={actOnMoment} onClose={xpDel.dismiss}/>
        :showNav&&!showXpBadge&&<XPChip chip={xpDel.chip} overNav/>}
      {showNav&&<BottomNav active={screen} nav={nav} showPro={setProGate}/>}
      {showXpBadge&&(
        <div onClick={()=>setShowXpOverlay(true)} style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 15px)',right:14,zIndex:200,display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`,cursor:'pointer',boxShadow:'0 1px 8px rgba(0,0,0,0.08)',pointerEvents:'auto'}}>
          <Icon n={XPSystem.iconFor(XPSystem.getLevel(xpBadge.total))} sz={16} col={C.cr}/>
          <span style={{fontSize:'15px',fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpBadge.total} XP</span>{/* fixed: the badge sits beside the logo */}
          <XPBadgeGain chip={xpDel.chip}/>
          {Entitlement.isPro()&&<span style={{fontSize:12,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#9B5E00,#C4870A)',borderRadius:8,padding:'2px 6px',marginLeft:2}}>PRO</span>}
        </div>
      )}

      {/* XP Tier + Achievements Overlay */}
      {showXpOverlay&&(()=>{
        const xd=XPSystem.get();
        const curLevel=XPSystem.getLevel(xd.total);
        const ACHIEVEMENTS=[
          {key:'scan',      label:'Scan your first wine',     icon:'wine',   done: xd.events.includes('type_red')||xd.events.includes('type_white')||(xd.total>0)},
          {key:'rate',      label:'Rate 10 wines',            icon:'star',   done: xd.totalRatings>=10},
          {key:'week5',     label:'5 scans in one week',      icon:'flame',  done: xd.events.some(e=>e.startsWith('week5_'))},
          {key:'red',       label:'First red wine',           icon:'grape',  done: xd.events.includes('type_red')},
          {key:'white',     label:'First white wine',         icon:'glass',  done: xd.events.includes('type_white')},
          {key:'rose',      label:'First rosé wine',          icon:'drop',   done: xd.events.includes('type_rosé')||xd.events.includes('type_rose')},
          {key:'sparkling', label:'First sparkling wine',     icon:'drop',   done: xd.events.includes('type_sparkling')},
          {key:'country',   label:'Wines from 3 countries',   icon:'globe',  done: xd.events.filter(e=>e.startsWith('country_')).length>=3},
          {key:'grape',     label:'Discover 5 grape varieties',icon:'leaf',  done: (xd.grapesSeen||[]).length>=5},
          {key:'rarity',    label:'Scan a rare bottle',       icon:'trophy', done: xd.events.some(e=>e.startsWith('rarity_'))},
          {key:'streak',    label:'3-answer quiz streak',     icon:'flame',  done: xd.events.some(e=>e.startsWith('streak'))||(()=>{const s=xd.quizStreaks||{};return Object.values(s).some(v=>v>=3);})()},
          {key:'quiz',      label:'Complete a quiz',          icon:'book',   done: Object.keys(xd.quizCompleted||{}).length>0},
        ];
        const XP_LEVELS_LOCAL=XPSystem.tierList(xd.total);
        return(
          <div onClick={()=>setShowXpOverlay(false)} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',zIndex:500,display:'flex',alignItems:'flex-end',backdropFilter:'blur(3px)'}}>
            <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:'22px 22px 0 0',width:'100%',maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden',animation:'slideUp .3s cubic-bezier(.34,1.2,.64,1)'}}>
              {/* Handle */}
              <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
                <div style={{width:38,height:4,borderRadius:2,background:C.line}}/>
              </div>
              {/* Header */}
              <div style={{padding:'10px 20px 12px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
                <div>
                  <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,display:'flex',alignItems:'center',gap:8}}><Icon n={XPSystem.iconFor(curLevel)} sz={20} col={curLevel.color||C.cr}/>{curLevel.name}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{xd.total} XP total</div>
                </div>
                <div onClick={()=>setShowXpOverlay(false)} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                  <span style={{fontSize:18,lineHeight:1,color:C.ink}}>×</span>
                </div>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>
                {/* All tiers */}
                <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:10}}>Tiers</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:20}}>
                  {XP_LEVELS_LOCAL.map((lv,i)=>{
                    const isActive=curLevel.name===lv.name;
                    const isDone=xd.total>=lv.min;
                    const next=XP_LEVELS_LOCAL[i+1];
                    const prog=next?Math.min(1,(xd.total-lv.min)/(next.min-lv.min)):1;
                    return(
                      <div key={i} style={{borderRadius:12,padding:'10px 12px',background:isActive?C.crSoft:C.offWhite,border:`1.5px solid ${isActive?C.cr:C.line}`,opacity:isDone?1:0.45}}>
                        <div style={{display:'flex',alignItems:'center',gap:10}}>
                          <Icon n={XPSystem.iconFor(lv)} sz={20} col={lv.color||C.cr} style={{flexShrink:0}}/>
                          <div style={{flex:1}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                              <span style={{fontSize:16,fontWeight:isActive?700:500,color:isActive?C.cr:C.ink,fontFamily:C.P}}>{lv.name}</span>
                              <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{lv.min} XP{isActive?' ← you':''}</span>
                            </div>
                            {isActive&&next&&<Prog val={prog} h={5} col={C.cr} style={{marginTop:4}}/>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Achievements */}
                <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:10}}>Achievements</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,paddingBottom:24}}>
                  {ACHIEVEMENTS.map((a,i)=>(
                    <div key={i} style={{borderRadius:12,padding:'10px 12px',background:a.done?C.greenBg:C.offWhite,border:`1px solid ${a.done?C.green+'40':C.line}`,display:'flex',flexDirection:'column',gap:4,opacity:a.done?1:0.5}}>
                      <Icon n={a.icon} sz={22} col={a.done?C.green:C.mid}/>
                      <span style={{fontSize:13,fontWeight:600,color:a.done?C.green:C.ink,fontFamily:C.P,lineHeight:1.3}}>{a.label}</span>
                      {a.done&&<span style={{fontSize:12,color:C.green,fontFamily:C.P}}>✓ Completed</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{padding:'10px 20px 28px',borderTop:`1px solid ${C.line}`,flexShrink:0}}>
                <div onClick={()=>{setShowXpOverlay(false);nav('learn');}} style={{background:C.cr,borderRadius:12,padding:'13px',textAlign:'center',cursor:'pointer'}}>
                  <span style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Start a Quiz — Earn XP</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {!showXpBadge&&!showNav&&<XPChip chip={xpDel.chip}/>}
      <style>{_MOMENT_CSS}</style>
      {proGate&&<ProGate feature={proGate} onClose={()=>setProGate(null)}/>}
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}`}</style>
    </div>
  );
}

/* ── Simple Discover placeholder ── */
function DiscoverScreen({nav,back}){
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px'}}>Discover</div>
        <div style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Wines matched to your taste profile</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>If You Like Pinot Grigio…</div>
        {[{name:'Pinot Gris',region:'Alsace, France',note:'Same grape, richer style — more body and texture',score:95},
          {name:'Pinot Blanc',region:'Alsace / Alto Adige',note:'Crisp and clean with subtle apple notes',score:91},
          {name:'Soave Classico',region:'Veneto, Italy',note:'Similar weight and minerality to Pinot Grigio',score:88},
          {name:'Vermentino',region:'Sardinia / Provence',note:'Zesty and herbal — a Mediterranean cousin',score:84},
          {name:'Albariño',region:'Rías Baixas, Spain',note:'Aromatic and crisp — a step toward Sauvignon Blanc',score:80},
        ].map((w,i)=>(
          <Card key={i} onClick={()=>nav('detail')} style={{padding:10,cursor:'pointer'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
              <div style={{width:34,height:46,borderRadius:6,background:'#B8963E15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={15} col="#B8963E"/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</span>
                  <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                    <span style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                  </div>
                </div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{w.region}</div>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,marginTop:3,lineHeight:1.4}}>{w.note}</div>
              </div>
            </div>
          </Card>
        ))}
        <Card style={{background:C.greenBg,border:`1px solid ${C.green}25`,padding:12,boxShadow:'none'}}>
          <div style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>💡 Menu Tip</div>
          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Don't see Pinot Grigio on the list? Ask for Soave or Vermentino — same flavour family and often better value.</div>
        </Card>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

/* ── Simple Shopping placeholder ── */
function ShoppingScreen({nav,back}){
  const [rating,setRating]=React.useState(0);
  const [hov,setHov]=React.useState(0);
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>Shopping Mode</span>
        <span style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,padding:'4px 10px',borderRadius:20,background:C.crSoft}}>In Store</span>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{padding:14,border:`1.5px solid ${C.green}`}}>
          <div style={{display:'flex',gap:12}}>
            <div style={{width:46,height:64,borderRadius:8,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon n="wine" sz={22} col={C.cr}/>
            </div>
            <div style={{flex:1}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontSize:18,fontWeight:700,color:C.ink,fontFamily:C.P}}>Meiomi Pinot Noir</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>California · Pinot Noir</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>88%</span>
                </div>
              </div>
              <div style={{display:'flex',gap:5,marginTop:6}}><Pill active sm>Red</Pill><Pill sm>Medium Body</Pill></div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${C.line}`,marginTop:10,paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>$18.99</span>
            <Btn primary small>Add to Cart</Btn>
          </div>
        </Card>
        <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Also on This Shelf</div>
        {[{name:'Elouan Pinot Noir',sub:'Oregon · $22',score:92,note:'Higher match — try this one!'},
          {name:'La Crema Pinot Noir',sub:'Sonoma · $19',score:85,note:'Similar style, great value'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:6,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
                <div style={{fontSize:15,color:C.cr,fontFamily:C.P,marginTop:2,fontWeight:500}}>{w.note}</div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                <span style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
              </div>
            </div>
          </Card>
        ))}
        <Btn primary full onClick={()=>nav('scan')}>Scan Another Bottle</Btn>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
