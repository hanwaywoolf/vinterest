// Vinterest App - Complete JSX Bundle
// Generated: 2026-06-16T20:50:13.120Z


// ============================================================================
// FILE: pwa-app.jsx
// ============================================================================

/* Vinterest PWA — Main App with navigation */

function App(){
  const [screen,setScreen]=React.useState(()=>{
    if(!localStorage.getItem('vinterest_onboarded')) return 'onboarding';
    const h=window.location.hash.replace('#','').toLowerCase();
    return (h&&h!=='onboarding')?h:'home';
  });
  const [stack,setStack]=React.useState(()=>{
    const init=localStorage.getItem('vinterest_onboarded')?'home':'onboarding';
    return [init];
  });
  const [proGate,setProGate]=React.useState(null);

  function nav(to){
    window.location.hash=to;
    setStack(s=>[...s,to]);
    setScreen(to);
  }
  function back(){
    if(stack.length<=1){setScreen('home');setStack(['home']);window.location.hash='home';return;}
    const ns=stack.slice(0,-1);
    setStack(ns);
    const prev=ns[ns.length-1];
    setScreen(prev);
    window.location.hash=prev;
  }

  // Handle hardware back button / browser back
  React.useEffect(()=>{
    const onPop=()=>{
      const h=window.location.hash.replace('#','')||'home';
      setScreen(h);
    };
    window.addEventListener('popstate',onPop);
    return ()=>window.removeEventListener('popstate',onPop);
  },[]);

  const showNav=!['camera','onboarding'].includes(screen);

  // XP Badge + overlay
  const [xpBadge,setXpBadge]=React.useState(()=>XPSystem.get());
  const [showXpOverlay,setShowXpOverlay]=React.useState(false);
  React.useEffect(()=>{
    const handler=()=>setXpBadge(XPSystem.get());
    window.addEventListener('vinterest:xp',handler);
    return ()=>window.removeEventListener('vinterest:xp',handler);
  },[]);
  const showXpBadge=!['camera','onboarding','learn','quiz','article','identified','detail','mywines','scan','profile'].includes(screen);

  // XP Toast
  const [xpToasts,setXpToasts]=React.useState([]);
  React.useEffect(()=>{
    const handler=e=>{
      const {awards}=e.detail||{};
      if(!awards||!awards.length) return;
      const id=Date.now()+Math.random();
      setXpToasts(t=>[...t,{id,awards}]);
      setTimeout(()=>setXpToasts(t=>t.filter(x=>x.id!==id)),3200);
    };
    window.addEventListener('vinterest:xp',handler);
    return ()=>window.removeEventListener('vinterest:xp',handler);
  },[]);

  const ctx={nav,back,showPro:setProGate};

  return(
    <div style={{width:'100%',maxWidth:430,height:'100dvh',margin:'0 auto',background:C.bg,display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
        {screen==='onboarding' && <OnboardingScreen onComplete={()=>{localStorage.setItem('vinterest_onboarded','1');nav('home');}}/>}
        {screen==='home'      && <HomeScreen {...ctx}/>}
        {screen==='scan'      && <ScanHomeScreen {...ctx}/>}
        {screen==='camera'    && <ScanScreen {...ctx}/>}
        {screen==='identified'&& <WineIdentifiedScreen {...ctx}/>}
        {screen==='winelist'  && <WineListScreen {...ctx}/>}
        {screen==='detail'    && <WineDetailScreen {...ctx}/>}
        {screen==='region'    && <RegionScreen {...ctx}/>}
        {screen==='varietal'  && <VarietalScreen {...ctx}/>}
        {screen==='similar'   && <SimilarWinesScreen {...ctx}/>}
        {screen==='profile'   && <WineDNAScreen {...ctx}/>}
        {screen==='mywines'   && <MyWinesScreen {...ctx}/>}
        {screen==='learn'     && <QuizHubScreen {...ctx}/>}
        {screen==='quiz'      && <QuizScreen {...ctx}/>}
        {screen==='article'   && <LearnArticleScreen {...ctx}/>}
      </div>
      {showNav&&<BottomNav active={screen} nav={nav} showPro={setProGate}/>}
      {/* Global XP badge */}
      {showXpBadge&&(
        <div onClick={()=>setShowXpOverlay(true)} style={{position:'absolute',top:15,right:14,zIndex:200,display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`,cursor:'pointer',boxShadow:'0 1px 8px rgba(0,0,0,0.08)',pointerEvents:'auto'}}>
          <span style={{fontSize:17,lineHeight:1}}>{XPSystem.getLevel(xpBadge.total).badge}</span>
          <span style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpBadge.total} XP</span>
          {!!localStorage.getItem('vinterest_pro')&&<span style={{fontSize:12,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#9B5E00,#C4870A)',borderRadius:8,padding:'2px 6px',marginLeft:2}}>PRO</span>}
        </div>
      )}

      {/* XP Tier + Achievements Overlay */}
      {showXpOverlay&&(()=>{
        const xd=XPSystem.get();
        const curLevel=XPSystem.getLevel(xd.total);
        const ACHIEVEMENTS=[
          {key:'scan',      label:'Scan your first wine',     icon:'🍷', done: xd.events.includes('type_red')||xd.events.includes('type_white')||(xd.total>0)},
          {key:'rate',      label:'Rate 10 wines',            icon:'⭐', done: xd.totalRatings>=10},
          {key:'week5',     label:'5 scans in one week',      icon:'🚀', done: xd.events.some(e=>e.startsWith('week5_'))},
          {key:'red',       label:'First red wine',           icon:'🍇', done: xd.events.includes('type_red')},
          {key:'white',     label:'First white wine',         icon:'🥂', done: xd.events.includes('type_white')},
          {key:'rose',      label:'First rosé wine',          icon:'🌸', done: xd.events.includes('type_rosé')||xd.events.includes('type_rose')},
          {key:'sparkling', label:'First sparkling wine',     icon:'🍾', done: xd.events.includes('type_sparkling')},
          {key:'country',   label:'Wines from 3 countries',   icon:'🌍', done: xd.events.filter(e=>e.startsWith('country_')).length>=3},
          {key:'grape',     label:'Discover 5 grape varieties',icon:'🔬', done: (xd.grapesSeen||[]).length>=5},
          {key:'expensive', label:'Scan a premium wine (£100+)',icon:'💎', done: xd.events.some(e=>e.startsWith('expensive_'))},
          {key:'streak',    label:'3-answer quiz streak',     icon:'🔥', done: xd.events.some(e=>e.startsWith('streak'))||(()=>{const s=xd.quizStreaks||{};return Object.values(s).some(v=>v>=3);})()},
          {key:'quiz',      label:'Complete a quiz',          icon:'🎓', done: Object.keys(xd.quizCompleted||{}).length>0},
        ];
        const XP_LEVELS_LOCAL=[
          {name:'Novice',min:0,badge:'🍇'},{name:'Enthusiast',min:150,badge:'🥂'},
          {name:'Explorer',min:350,badge:'🌍'},{name:'Connoisseur',min:650,badge:'🔍'},
          {name:'Aficionado',min:1050,badge:'🏅'},{name:'Cru',min:1600,badge:'🍾'},
          {name:'Sommelier',min:2400,badge:'🎓'},{name:'Head Sommelier',min:3500,badge:'⭐'},
          {name:'Master Sommelier',min:5000,badge:'🏆'},{name:'Grand Master',min:7000,badge:'👑'},
        ];
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
                  <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P}}>{curLevel.badge} {curLevel.name}</div>
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
                          <span style={{fontSize:20,flexShrink:0}}>{lv.badge}</span>
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
                      <span style={{fontSize:22}}>{a.icon}</span>
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
      {/* XP Toast overlay */}
      <div style={{position:'absolute',top:0,left:0,right:0,pointerEvents:'none',zIndex:999,display:'flex',flexDirection:'column',alignItems:'center',gap:8,paddingTop:12}}>
        {xpToasts.map(toast=>(
          <div key={toast.id} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,animation:'xpIn .35s cubic-bezier(.34,1.56,.64,1) both'}}>
            {toast.awards.map((a,i)=>(
              <div key={i} style={{display:'inline-flex',alignItems:'center',gap:8,background:a.levelUp?'#0F0F0F':a.bonus?C.cr:'rgba(15,15,15,0.88)',borderRadius:30,padding:'8px 16px',backdropFilter:'blur(8px)',boxShadow:'0 4px 20px rgba(0,0,0,0.3)'}}>
                {a.levelUp&&<span style={{fontSize:17}}>🏆</span>}
                {a.bonus&&!a.levelUp&&<span style={{fontSize:15}}>⭐</span>}
                {!a.levelUp&&!a.bonus&&<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P}}>+{a.amount} XP</span>}
                <span style={{fontSize:15,fontWeight:600,color:'#fff',fontFamily:C.P}}>{a.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {proGate&&<ProGate feature={proGate} onClose={()=>setProGate(null)}/>}
      <style>{`@keyframes xpIn{from{opacity:0;transform:translateY(-16px) scale(.9)}to{opacity:1;transform:none}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}`}</style>
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



// ============================================================================
// FILE: pwa-components.jsx
// ============================================================================

/* Vinterest PWA — Shared tokens, icons, primitives */

const C = {
  cr:'#8B1A2F', crL:'#B02440', crDim:'rgba(139,26,47,0.13)', crSoft:'rgba(139,26,47,0.07)',
  ink:'#0F0F0F', ink2:'#3A3A3A', mid:'#8A8A8A', line:'#E8E8E8',
  bg:'#FAFAFA', white:'#FFFFFF', offWhite:'#F5F3F0',
  green:'#1E7B4B', greenBg:'#EAF7F0', amber:'#B06C00', amberBg:'#FFF4E0',
  P:"'Poppins',sans-serif",
};

function Icon({n,sz=20,col=C.ink,style:s}){
  const d={
    scan:<><rect x="3" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="11" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="3" y="11" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="14" cy="14" r="2.5" stroke={col} strokeWidth="1.6" fill="none"/><line x1="16.5" y1="16.5" x2="18.5" y2="18.5" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    fork:<><path d="M7 2v5c0 1.5.8 2.5 2 3v8" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M9 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M14 2v4l2-1v-3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6c0 2.5 2 3 2 5v7" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    cart:<><path d="M2 3h2.5l2.2 10h8.6l1.8-7H6.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="17" r="1.2" fill={col}/><circle cx="14.5" cy="17" r="1.2" fill={col}/></>,
    home:<><path d="M3 9.5L10 3l7 6.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M5 8.5V17h4v-4.5h2V17h4V8.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    compass:<><circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.6" fill="none"/><polygon points="10,5.5 12,9.5 10,10.5 8,9.5" fill={col}/><polygon points="10,14.5 8,10.5 10,10.5 12,10.5" fill={col} opacity=".35"/></>,
    book:<><path d="M4 4.5C4 4.5 7 3.5 10 5C13 3.5 16 4.5 16 4.5V15C16 15 13 14 10 15.5C7 14 4 15 4 15V4.5Z" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/><line x1="10" y1="5" x2="10" y2="15.5" stroke={col} strokeWidth="1.2"/></>,
    user:<><circle cx="10" cy="7.5" r="3.2" stroke={col} strokeWidth="1.6" fill="none"/><path d="M3.5 18C3.5 14 6.5 12 10 12s6.5 2 6.5 6" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    back:<polyline points="12,4 5,10 12,16" stroke={col} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevron:<polyline points="7,4 13,10 7,16" stroke={col} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    heart:<path d="M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z" stroke={col} strokeWidth="1.6" fill="none"/>,
    share:<><circle cx="14.5" cy="4.5" r="2" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="5.5" cy="10" r="2" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="14.5" cy="15.5" r="2" stroke={col} strokeWidth="1.5" fill="none"/><line x1="7.4" y1="9" x2="12.6" y2="5.5" stroke={col} strokeWidth="1.5"/><line x1="7.4" y1="11" x2="12.6" y2="14.5" stroke={col} strokeWidth="1.5"/></>,
    camera:<><rect x="2.5" y="6" width="15" height="11" rx="2" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="10" cy="11.5" r="3" stroke={col} strokeWidth="1.6" fill="none"/><path d="M7.5 6L8.5 4h3l1 2" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/></>,
    check:<polyline points="3.5,10 7.5,14.5 16.5,5" stroke={col} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    wine:<><path d="M7.5 2.5h5v5c0 3.5-1.8 5-2.5 5S7.5 11 7.5 8V2.5z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><line x1="10" y1="12.5" x2="10" y2="17" stroke={col} strokeWidth="1.5"/><line x1="7" y1="17" x2="13" y2="17" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    globe:<><circle cx="10" cy="10" r="7.5" stroke={col} strokeWidth="1.5" fill="none"/><ellipse cx="10" cy="10" rx="3.5" ry="7.5" stroke={col} strokeWidth="1.2" fill="none"/><line x1="2.5" y1="10" x2="17.5" y2="10" stroke={col} strokeWidth="1.2"/></>,
    message:<><path d="M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 2V6a1 1 0 011-1z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    flame:<path d="M10 2C10 2 14.5 6.5 14.5 10.5C14.5 13.5 12.5 16 10 16C7.5 16 5.5 13.5 5.5 10.5C5.5 6.5 10 2 10 2Z" stroke={col} strokeWidth="1.5" fill="none"/>,
    trophy:<><path d="M5.5 3h9v5c0 3-2 5-4.5 5S5.5 11 5.5 8V3z" stroke={col} strokeWidth="1.5" fill="none"/><path d="M5.5 5H3c0 3 1.5 4.5 2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><path d="M14.5 5H17c0 3-1.5 4.5-2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><line x1="10" y1="13" x2="10" y2="16.5" stroke={col} strokeWidth="1.5"/><line x1="7" y1="16.5" x2="13" y2="16.5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    lock:<><rect x="5.5" y="9.5" width="9" height="7.5" rx="1.5" stroke={col} strokeWidth="1.5" fill="none"/><path d="M7.5 9.5V7C7.5 5 8.5 3.5 10 3.5S12.5 5 12.5 7v2.5" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="10" cy="13" r="1" fill={col}/></>,
    star:<polygon points="10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6" fill={col}/>,
    list:<><line x1="7" y1="5" x2="17" y2="5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="10" x2="17" y2="10" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="15" x2="17" y2="15" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="5" r="1" fill={col}/><circle cx="4" cy="10" r="1" fill={col}/><circle cx="4" cy="15" r="1" fill={col}/></>,
    brain:<><path d="M10 15V7.5" stroke={col} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.2 1.8" opacity=".4"/><path d="M10 7.5C10 5.5 8.5 4 7 4C5.3 4 4 5.2 4 6.8C3.1 7.1 2.4 8 2.4 9.2C2.4 10.4 3.2 11.4 4.3 11.7C4.1 12.2 4 12.7 4 13.3C4 14.9 5.3 16.1 7 16.2L10 16.3" stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 7.5C10 5.5 11.5 4 13 4C14.7 4 16 5.2 16 6.8C16.9 7.1 17.6 8 17.6 9.2C17.6 10.4 16.8 11.4 15.7 11.7C15.9 12.2 16 12.7 16 13.3C16 14.9 14.7 16.1 13 16.2L10 16.3" stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 8.2C6 7.8 7 7.7 7.8 8.2" stroke={col} strokeWidth="1" strokeLinecap="round" opacity=".55"/><path d="M5.5 11C6 10.6 7 10.6 7.8 11" stroke={col} strokeWidth="1" strokeLinecap="round" opacity=".55"/></>,
  };
  return <svg viewBox="0 0 20 20" width={sz} height={sz} style={{display:'block',flexShrink:0,...s}}>{d[n]||<circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.5" fill="none"/>}</svg>;
}

function BottomNav({active, nav, showPro}){
  const homeActive=active==='home'||active==='scan';
  const cellarActive=active==='mywines';
  const learnActive=active==='learn'||active==='quiz'||active==='article';
  const profileActive=active==='profile';
  return(
    <div style={{flexShrink:0}}>
      <div style={{display:'flex',background:C.white,borderTop:`1px solid ${C.line}`,zIndex:100}}>
        {/* Home */}
        <div onClick={()=>nav('home')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="home" sz={22} col={homeActive?C.cr:C.mid}/>
          <span style={{fontSize:13,fontWeight:homeActive?600:400,color:homeActive?C.cr:C.mid,fontFamily:C.P}}>Home</span>
        </div>
        {/* My Wines */}
        <div onClick={()=>nav('mywines')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="wine" sz={22} col={cellarActive?C.cr:C.mid}/>
          <span style={{fontSize:13,fontWeight:cellarActive?600:400,color:cellarActive?C.cr:C.mid,fontFamily:C.P}}>My Wines</span>
        </div>
        {/* Scan FAB */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',cursor:'pointer',paddingBottom:'max(env(safe-area-inset-bottom,9px),9px)'}} onClick={()=>nav('camera')}>
          <div style={{width:54,height:54,borderRadius:27,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-20,boxShadow:`0 4px 22px ${C.cr}60`,border:'3px solid #fff'}}>
            <Icon n="camera" sz={22} col="#fff"/>
          </div>
          <span style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,marginTop:3}}>Scan</span>
        </div>
        {/* Learn */}
        <div onClick={()=>nav('learn')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="book" sz={22} col={learnActive?C.cr:C.mid}/>
          <span style={{fontSize:13,fontWeight:learnActive?600:400,color:learnActive?C.cr:C.mid,fontFamily:C.P}}>Learn</span>
        </div>
        {/* WineDNA */}
        <div onClick={()=>nav('profile')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="brain" sz={22} col={profileActive?C.cr:C.mid}/>
          <span style={{fontSize:13,fontWeight:profileActive?600:400,color:profileActive?C.cr:C.mid,fontFamily:C.P}}>WineDNA</span>
        </div>
      </div>
    </div>
  );
}

function ProBadge({style:s}){
  return(
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:8,background:'linear-gradient(135deg,#9B5E00,#C4870A)',fontSize:12,fontWeight:700,color:'#fff',fontFamily:C.P,letterSpacing:'0.05em',flexShrink:0,...s}}>PRO</span>
  );
}

function ProGate({feature,onClose}){
  const FEAT={
    'wine-list':{icon:'📋',title:'Wine List Scanning',desc:'Snap any restaurant menu and get instant match scores for every bottle.',bullets:['Scan full wine lists in seconds','AI ranks every wine by your taste profile','Works at any restaurant worldwide']},
    'unlimited-scans':{icon:'♾️',title:'Unlimited Scans',desc:"You've used your 10 free scans. Pro gives you unlimited.",bullets:['Scan as many bottles as you like','Your full scan history never expires','Priority AI label recognition']},
    'taste-depth':{icon:'🎭',title:'Full Taste Profile',desc:'Unlock your complete taste breakdown across all wine types.',bullets:['Whites, Rosé & Sparkling profiles','Personalised sommelier scripts for each','Full food pairing analysis']},
    'expert-quiz':{icon:'🎓',title:'Expert Quizzes',desc:'Advanced wine knowledge questions with bigger XP rewards.',bullets:['WSET-inspired question sets','200 XP per completed quiz','Unlock Expert badge on your profile']},
  };
  const f=FEAT[feature]||FEAT['wine-list'];
  return(
    <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.62)',zIndex:600,display:'flex',alignItems:'flex-end',backdropFilter:'blur(4px)'}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:'22px 22px 0 0',width:'100%',paddingBottom:'max(env(safe-area-inset-bottom,0px),20px)',animation:'slideUp .3s cubic-bezier(.34,1.2,.64,1)'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.line}}/>
        </div>
        <div style={{textAlign:'center',padding:'6px 0 8px'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 14px',borderRadius:20,background:'linear-gradient(135deg,#9B5E00,#C4870A)'}}>
            <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P,letterSpacing:'0.08em'}}>VINTEREST PRO</span>
          </span>
        </div>
        <div style={{padding:'6px 24px 4px',display:'flex',flexDirection:'column',gap:14}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:42,marginBottom:8}}>{f.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginBottom:6}}>{f.title}</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55}}>{f.desc}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {f.bullets.map((b,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:20,height:20,borderRadius:10,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n="check" sz={12} col={C.green}/>
                </div>
                <span style={{fontSize:16,color:C.ink2,fontFamily:C.P}}>{b}</span>
              </div>
            ))}
          </div>
          <div onClick={()=>{localStorage.setItem('vinterest_pro','1');window.dispatchEvent(new Event('vinterest:pro'));onClose();}}
            style={{background:`linear-gradient(135deg,${C.cr},${C.crL})`,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 28px ${C.cr}45`,marginTop:2}}>
            <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>Upgrade to Pro</div>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.68)',fontFamily:C.P,marginTop:2}}>£4.99/month · Cancel anytime</div>
          </div>
          <div onClick={onClose} style={{textAlign:'center',cursor:'pointer',paddingBottom:4}}>
            <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Maybe later</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({children,active,sm,style:s}){
  return <span style={{display:'inline-flex',alignItems:'center',padding:sm?'3px 9px':'5px 12px',borderRadius:20,background:active?C.cr:'transparent',color:active?'#fff':C.mid,border:`1px solid ${active?C.cr:C.line}`,fontSize:sm?12:13,fontWeight:500,fontFamily:C.P,...s}}>{children}</span>;
}
function Prog({val=0.5,col,h=4,style:s}){
  return <div style={{height:h,borderRadius:h,background:'rgba(0,0,0,0.07)',overflow:'hidden',...s}}><div style={{height:'100%',width:`${Math.min(1,val)*100}%`,borderRadius:h,background:col||C.cr}}/></div>;
}
function Card({children,style:s,onClick}){
  return <div onClick={onClick} style={{background:C.white,borderRadius:16,padding:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',...s}}>{children}</div>;
}
function Btn({children,primary,full,small,style:s,onClick}){
  return <div onClick={onClick} style={{padding:small?'8px 14px':'12px 20px',borderRadius:12,background:primary?C.cr:C.white,color:primary?'#fff':C.ink,border:primary?'none':`1px solid ${C.line}`,fontFamily:C.P,fontSize:small?13:15,fontWeight:600,textAlign:'center',width:full?'100%':'auto',boxShadow:primary?`0 4px 16px ${C.cr}40`:'none',cursor:'pointer',boxSizing:'border-box',...s}}>{children}</div>;
}

/* ── Wine History ── */
const WineHistory = {
  KEY: 'vinterest_wines',
  getAll(){ try{ return JSON.parse(localStorage.getItem(this.KEY)||'[]'); }catch(e){ return []; } },
  save(wines){ localStorage.setItem(this.KEY, JSON.stringify(wines.slice(0,500))); },
  add(wine, rating){
    // Only persist wines that have been scored
    if(!rating || rating <= 0) return this.getAll();
    const wines = this.getAll();
    const idx = wines.findIndex(w => w.name===wine.name && String(w.vintage)===String(wine.vintage));
    const now = new Date().toISOString();
    if(idx>=0){
      wines[idx].times_consumed = (wines[idx].times_consumed||1) + 1;
      wines[idx].last_scanned = now;
      wines[idx].rating = rating;
    } else {
      wines.unshift({...wine, rating, times_consumed:1, scanned_at:now, last_scanned:now});
    }
    this.save(wines);
    return wines;
  },
  rate(name, vintage, rating){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(w){ w.rating=rating; this.save(wines); }
  },
  getProfile(){
    const wines = this.getAll();
    if(!wines.length) return {red:0,white:0,rose:0,sparkling:0,total:0};
    const counts={red:0,white:0,rose:0,sparkling:0};
    wines.forEach(w=>{ const t=(w.type||'').toLowerCase().replace('é','e'); if(counts[t]!==undefined) counts[t]++; else counts.red++; });
    const total=wines.length;
    return {...counts,total,redPct:counts.red/total,whitePct:counts.white/total,rosePct:counts.rose/total,sparklingPct:counts.sparkling/total};
  }
};

/* ── Taste-match score (WineDNA vs. wine attributes) ──
   Compares wine's body/tannins/acidity/sweetness against the user's
   average for that type. Returns 35–98, or null if no data yet. */
function calcMatchScore(wine,userWines){
  if(!wine||!userWines) return null;
  const typeKey=(wine.type||'red').toLowerCase().replace(/é/g,'e');
  const typeWines=userWines.filter(w=>(w.type||'red').toLowerCase().replace(/é/g,'e')===typeKey);
  const withAttrs=typeWines.filter(w=>w.body!=null);
  if(!withAttrs.length) return null;
  const avg=field=>{const ws=withAttrs.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:null;};
  const avgB=avg('body'),avgT=avg('tannins'),avgA=avg('acidity'),avgS=avg('sweetness');
  // prox: 1 = perfect match, 0 = ≥0.6 units apart
  const prox=(wv,uv)=>uv==null?null:Math.max(0,1-Math.abs((wv??0.5)-uv)/0.6);
  const scores=[
    [prox(wine.body??0.65,avgB),0.30],
    [prox(wine.tannins??0.55,avgT),0.25],
    [prox(wine.acidity??0.60,avgA),0.25],
    [prox(wine.sweetness??0.10,avgS),0.20],
  ].filter(([s])=>s!=null);
  if(!scores.length) return null;
  const totalW=scores.reduce((s,[,w])=>s+w,0);
  const raw=scores.reduce((s,[sc,w])=>s+sc*(w/totalW),0);
  // Scale: 0 raw → 35 %, 1.0 raw → 98 %
  return Math.round(35+raw*63);
}

Object.assign(window,{C,Icon,BottomNav,Pill,Prog,Card,Btn,WineHistory,ProBadge,ProGate,calcMatchScore});



// ============================================================================
// FILE: pwa-onboarding.jsx
// ============================================================================

/* Vinterest — Onboarding (first-run, 3 slides) */

function OnboardingScreen({onComplete}){
  const [slide,setSlide]=React.useState(0);
  const [pref,setPref]=React.useState(null);

  function finish(){
    if(pref) localStorage.setItem('vinterest_initial_pref',pref);
    onComplete();
  }

  const PREFS=[
    {id:'red',      label:'Red wines',               emoji:'🍷',col:'#8B1A2F',bg:'#FDF0F3'},
    {id:'white',    label:'White wines',             emoji:'🥂',col:'#B8963E',bg:'#FFFBF0'},
    {id:'rose',     label:'Rosé',                   emoji:'🌸',col:'#C47A8A',bg:'#FFF0F4'},
    {id:'sparkling',label:'Sparkling & Champagne',   emoji:'🍾',col:'#5E8FA8',bg:'#F0F7FF'},
    {id:'all',      label:'A bit of everything',     emoji:'🌈',col:'#1E7B4B',bg:'#EAF7F0'},
  ];

  const dotsDark=(
    <div style={{display:'flex',justifyContent:'center',gap:6,paddingTop:4}}>
      {[0,1,2].map(i=><div key={i} style={{width:i===slide?22:6,height:6,borderRadius:3,background:i===slide?'#fff':'rgba(255,255,255,0.2)',transition:'width .3s'}}/>)}
    </div>
  );
  const dotsLight=(
    <div style={{display:'flex',justifyContent:'center',gap:6,paddingTop:4}}>
      {[0,1,2].map(i=><div key={i} style={{width:i===slide?22:6,height:6,borderRadius:3,background:i===slide?C.cr:C.line,transition:'width .3s'}}/>)}
    </div>
  );

  /* ── Slide 1: Hero ── */
  if(slide===0) return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-70,right:-70,width:280,height:280,borderRadius:140,background:`${C.cr}20`,pointerEvents:'none'}}/>
      <div style={{position:'absolute',bottom:-50,left:-50,width:200,height:200,borderRadius:100,background:`${C.cr}10`,pointerEvents:'none'}}/>
      <div style={{position:'absolute',top:18,right:22,zIndex:2,cursor:'pointer'}} onClick={finish}>
        <span style={{fontSize:16,color:'rgba(255,255,255,0.3)',fontFamily:C.P,fontWeight:500}}>Skip</span>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 32px'}}>
        <img src="logo.png" alt="Vinterest" style={{width:220,height:'auto',marginBottom:44,filter:'invert(1) brightness(1)'}}/>
        <div style={{fontSize:32,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',textAlign:'center',lineHeight:1.15,marginBottom:16}}>Scan any wine.<br/>Know it instantly.</div>
        <div style={{fontSize:17,color:'rgba(255,255,255,0.38)',fontFamily:C.P,textAlign:'center',lineHeight:1.7,maxWidth:270}}>AI-powered wine education designed for curious drinkers, not experts.</div>
      </div>
      <div style={{padding:'0 24px 52px',display:'flex',flexDirection:'column',gap:10}}>
        <div onClick={()=>setSlide(1)} style={{background:C.cr,borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',boxShadow:`0 10px 40px ${C.cr}60`}}>
          <span style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>Get Started</span>
        </div>
        {dotsDark}
      </div>
    </div>
  );

  /* ── Slide 2: Features ── */
  if(slide===1) return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:18,right:22,zIndex:2,cursor:'pointer'}} onClick={finish}>
        <span style={{fontSize:16,color:C.mid,fontFamily:C.P,fontWeight:500}}>Skip</span>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'52px 24px 24px'}}>
        <img src="logo.png" alt="Vinterest" style={{height:22,width:'auto',display:'block',marginBottom:20}}/>
        <div style={{fontSize:32,fontWeight:900,color:C.ink,fontFamily:C.P,letterSpacing:'-0.7px',lineHeight:1.1,marginBottom:8}}>Three things.<br/>Done brilliantly.</div>
        <div style={{fontSize:17,color:C.mid,fontFamily:C.P,marginBottom:26,lineHeight:1.5}}>Everything else gets in the way.</div>
        {[
          {emoji:'📷',col:'#8B1A2F',bg:'#FDF0F3',t:'Scan & Identify',d:"Point at any label. AI tells you exactly what it is, whether you'll like it, and what it costs."},
          {emoji:'🎓',col:'#1E7B4B',bg:'#EAF7F0',t:'Learn as you scan',d:"Mini-quizzes tied to bottles you've actually tried. Build your wine IQ, one scan at a time."},
          {emoji:'🍷',col:'#B06C00',bg:'#FFF4E0',t:'Know your taste',d:'Your personal taste profile grows with every scan. Walk into any restaurant with real confidence.'},
        ].map((f,i)=>(
          <div key={i} style={{display:'flex',gap:14,padding:'16px',borderRadius:16,background:f.bg,marginBottom:10,border:`1px solid ${f.col}15`}}>
            <div style={{width:50,height:50,borderRadius:14,background:f.col,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:24,boxShadow:`0 4px 18px ${f.col}45`}}>{f.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>{f.t}</div>
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6}}>{f.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{padding:'0 24px 44px',display:'flex',flexDirection:'column',gap:10,flexShrink:0}}>
        <div onClick={()=>setSlide(2)} style={{background:C.cr,borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',boxShadow:`0 7px 28px ${C.cr}50`}}>
          <span style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>Continue</span>
        </div>
        {dotsLight}
      </div>
    </div>
  );

  /* ── Slide 3: Preferences ── */
  if(slide===2) return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'52px 24px 24px'}}>
        <div style={{fontSize:32,fontWeight:900,color:C.ink,fontFamily:C.P,letterSpacing:'-0.7px',lineHeight:1.1,marginBottom:8}}>What do you<br/>usually drink?</div>
        <div style={{fontSize:17,color:C.mid,fontFamily:C.P,marginBottom:24,lineHeight:1.5}}>Helps us personalise from day one.</div>
        {PREFS.map(opt=>(
          <div key={opt.id} onClick={()=>setPref(opt.id)}
            style={{display:'flex',alignItems:'center',gap:14,padding:'15px 16px',borderRadius:14,marginBottom:9,
              border:`2px solid ${pref===opt.id?opt.col:C.line}`,
              background:pref===opt.id?opt.bg:C.white,
              cursor:'pointer',transition:'all .15s'}}>
            <span style={{fontSize:26}}>{opt.emoji}</span>
            <span style={{fontSize:17,fontWeight:pref===opt.id?700:500,color:pref===opt.id?opt.col:C.ink,fontFamily:C.P,flex:1}}>{opt.label}</span>
            {pref===opt.id&&<div style={{width:22,height:22,borderRadius:11,background:opt.col,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="check" sz={12} col="#fff"/>
            </div>}
          </div>
        ))}
      </div>
      <div style={{padding:'0 24px 44px',display:'flex',flexDirection:'column',gap:10,flexShrink:0}}>
        <div onClick={finish}
          style={{background:pref?C.cr:'#BBBBBB',borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',
            boxShadow:pref?`0 7px 28px ${C.cr}50`:'none',transition:'all .2s'}}>
          <span style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>{pref?'Start Scanning →':'Skip for now'}</span>
        </div>
        {dotsLight}
      </div>
    </div>
  );

  return null;
}

Object.assign(window,{OnboardingScreen});



// ============================================================================
// FILE: pwa-screens-home.jsx
// ============================================================================

/* Vinterest PWA — Home screen */

function HomeScreen({nav, showPro}){
  const [typeTab,setTypeTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
  const [generating,setGenerating]=React.useState(null);
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());

  React.useEffect(()=>{
    const h=()=>setXpData(XPSystem.get());
    window.addEventListener('vinterest:xp',h);
    return()=>window.removeEventListener('vinterest:xp',h);
  },[]);

  const allWines=WineHistory.getAll();
  const isPro=!!localStorage.getItem('vinterest_pro');
  const scanCount=parseInt(localStorage.getItem('vinterest_scan_count')||'0');
  const FREE_SCANS=10;
  const atLimit=!isPro&&scanCount>=FREE_SCANS;

  const cats=[
    {col:'#8B1A2F',label:'Reds',      typeKey:'red'},
    {col:'#B8963E',label:'Whites',    typeKey:'white'},
    {col:'#C47A8A',label:'Rosé',      typeKey:'rose'},
    {col:'#5E8FA8',label:'Sparkling', typeKey:'sparkling'},
  ];
  const c=cats[typeTab];
  const tabWines=allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===c.typeKey);
  const topWines=[...tabWines].sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);

  /* Recently scanned — any type, by date, show even if dates missing */
  const recentWines=React.useMemo(()=>[...allWines]
    .sort((a,b)=>new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0))
    .slice(0,3)
  ,[allWines.length]);

  /* Explore suggestion based on dominant type */
  const typeCounts={red:0,white:0,rose:0,sparkling:0};
  allWines.forEach(w=>{const t=(w.type||'').toLowerCase().replace('é','e');if(typeCounts[t]!==undefined)typeCounts[t]++;});
  const primaryType=Object.entries(typeCounts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'red';
  const exploreSuggestions={
    red:      {title:'Try a White This Week',  body:'Your structured palate would suit a bone-dry Chablis or aged white Burgundy.'},
    white:    {title:'Venture into Reds',      body:'White lovers often find a match in elegant Pinot Noir or light Beaujolais.'},
    rose:     {title:'Go Sparkling',           body:'Dry rosé lovers frequently enjoy Champagne — similar freshness, better stories.'},
    sparkling:{title:'Explore Still Wines',    body:'Your palate for fine bubbles translates beautifully to quality Burgundy stills.'},
  };
  const explore=exploreSuggestions[primaryType]||exploreSuggestions.red;

  /* XP */
  const lv=XPSystem.getLevel(xpData.total);
  const nx=XPSystem.nextLevel(xpData.total);
  const pg=XPSystem.levelProgress(xpData.total);

  /* Script generation */
  React.useEffect(()=>{
    if(!tabWines.length) return;
    const key=`vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[c.typeKey]:cached}));return;}
    if(genScripts[c.typeKey]||generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const prompt=`I've scanned and rated these ${c.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const sc=text.trim();localStorage.setItem(key,sc);setGenScripts(g=>({...g,[c.typeKey]:sc}));})
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[typeTab,allWines.length]);

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* ── Fixed header: logo + always-visible Scan CTA ── */}
      <div style={{background:C.white,flexShrink:0}}>
        {/* Logo row */}
        <div style={{padding:'14px 20px 14px',paddingRight:'120px'}}>
          <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block'}}/>
        </div>
        {/* Compact scan CTA — never scrolls away */}
        <div onClick={()=>atLimit?showPro('unlimited-scans'):nav('camera')} style={{
          background:C.ink,borderRadius:14,margin:'0 16px 8px',padding:'13px 16px',
          display:'flex',alignItems:'center',gap:14,cursor:'pointer',
          position:'relative',overflow:'hidden'
        }}>
          <div style={{position:'absolute',right:-16,top:-16,width:100,height:100,borderRadius:50,background:`${C.cr}28`,pointerEvents:'none'}}/>
          <div style={{width:44,height:44,borderRadius:12,background:atLimit?'#444':C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,boxShadow:atLimit?'none':`0 4px 18px ${C.cr}55`}}>
            {atLimit?<Icon n="lock" sz={20} col="#888"/>:<Icon n="camera" sz={22} col="#fff"/>}
          </div>
          <div style={{flex:1,zIndex:1}}>
            <div style={{fontSize:18,fontWeight:700,color:atLimit?'rgba(255,255,255,0.4)':'#fff',fontFamily:C.P,lineHeight:1.2}}>
              {atLimit?'Free scans used up':isPro?'Scan a Bottle or List':'Scan a Bottle'}
            </div>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:2}}>
              {atLimit?'Upgrade for unlimited scans':isPro?'Point at a label or restaurant wine list':'Point at any wine label to identify'}
            </div>
          </div>
          {!atLimit&&<Icon n="chevron" sz={14} col="rgba(255,255,255,0.3)"/>}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{flex:1,overflowY:'auto',overscrollBehavior:'contain'}}>
      <div style={{padding:'8px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Recently Scanned */}
        {recentWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden',paddingBottom:4}}>
            <div style={{padding:'12px 14px 7px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Recently Scanned</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>All →</span>
            </div>
            {recentWines.map((w,i)=>(
              <div key={i} onClick={()=>{
                sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                nav('detail');
              }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                <div style={{width:32,height:44,borderRadius:7,background:colFor(w)+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${colFor(w)}20`}}>
                  <Icon n="wine" sz={14} col={colFor(w)}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                </div>
                {w.rating>0
                  ?<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>
                  :<span style={{fontSize:13,color:C.cr,fontFamily:C.P,flexShrink:0,fontWeight:600}}>Rate →</span>}
              </div>
            ))}
          </Card>
        )}

        {/* Type selector + script + top wines */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {/* Type tabs */}
          <div style={{display:'flex',gap:6}}>
            {cats.map((ct,i)=>(
              <div key={i} onClick={()=>setTypeTab(i)} style={{flex:1,textAlign:'center',padding:'8px 4px',borderRadius:10,background:i===typeTab?ct.col+'18':C.offWhite,border:`1.5px solid ${i===typeTab?ct.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                <div style={{width:7,height:7,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
                <div style={{fontSize:13,fontWeight:i===typeTab?700:500,color:i===typeTab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
              </div>
            ))}
          </div>

          {/* Script */}
          <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}25`,padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:7}}>
              <Icon n="message" sz={14} col={c.col}/>
              <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
            </div>
            {tabWines.length===0?(
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>Scan and rate some {c.label.toLowerCase()} to generate your personalised sommelier script.</div>
            ):generating===c.typeKey?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:c.col,animation:'homeSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65}}>{genScripts[c.typeKey]||'Script generating…'}</div>
            )}
          </Card>

          {/* Top wines for this type */}
          {topWines.length>0&&(
            <Card style={{padding:0,overflow:'hidden'}}>
              <div style={{padding:'10px 14px 6px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>Top {c.label}</span>
                <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
              </div>
              {topWines.map((w,i)=>(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:28,height:38,borderRadius:6,background:c.col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Icon n="wine" sz={12} col={c.col}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  {w.rating>0&&<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Quiz + XP row */}
        <div style={{display:'flex',gap:8}}>
          <Card style={{flex:1,padding:12,cursor:'pointer'}} onClick={()=>nav('learn')}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>Take a Quiz</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:7}}>Learn wine · Earn XP</div>
            <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'3px 9px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
              <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P}}>+ XP</span>
            </div>
          </Card>
          <Card style={{flex:1,padding:12}}>
            <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:2}}>{lv.badge} {lv.name}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:7}}>
              {xpData.total} XP{nx?` · ${nx.min-xpData.total} to go`:''}
            </div>
            <Prog val={pg} h={5} col={C.cr}/>
          </Card>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes homeSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{HomeScreen});



// ============================================================================
// FILE: pwa-screens-detail.jsx
// ============================================================================

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



// ============================================================================
// FILE: pwa-screens-explore.jsx
// ============================================================================

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
        const text=await window.claude.complete({messages:[{role:'user',content:prompt}]});
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

Object.assign(window,{RegionScreen,VarietalScreen,SimilarWinesScreen});



// ============================================================================
// FILE: pwa-screens-aux.jsx
// ============================================================================

/* Vinterest PWA — Taste Profile, Restaurant, Learn screens */

function TasteProfileScreen({nav,back,showPro}){
  const [tab,setTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
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
    const cacheKey=`vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
    const cached=localStorage.getItem(cacheKey);
    if(cached){setGenScripts(s=>({...s,[c.typeKey]:cached}));return;}
    if(genScripts[c.typeKey]||generating===c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList=tabWines.slice(0,8).map(w=>
      `${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`
    ).join('; ');
    const prompt=`I've scanned and rated these ${c.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{
        const script=text.trim();
        localStorage.setItem(cacheKey,script);
        setGenScripts(s=>({...s,[c.typeKey]:script}));
      })
      .catch(()=>{})
      .finally(()=>setGenerating(null));
  },[tab,allWines.length]);

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
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <Icon n="message" sz={15} col={c.col}/>
            <span style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
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

  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};

  const filtered=wines.filter(w=>{
    if(filter==='all') return true;
    const t=(w.type||'').toLowerCase().replace('é','e');
    return t===filter;
  }).sort((a,b)=>{
    if(sort==='rating') return (b.rating||0)-(a.rating||0);
    if(sort==='name') return (a.name||'').localeCompare(b.name||'');
    return new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0);
  });

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
                      <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:2}}>
                        {[w.region,w.country].filter(Boolean).join(' · ')}{w.vintage?` · ${w.vintage}`:''}
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

Object.assign(window,{TasteProfileScreen,RestaurantScreen,LearnScreen,MyWinesScreen,WineListScreen});



// ============================================================================
// FILE: pwa-screens-main.jsx
// ============================================================================

/* Vinterest PWA — Home, Scan, Wine Identified screens */

/* ── SCAN HOME (Scan tab content) ── */
function ScanHomeScreen({nav,showPro}){
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
        {/* Primary scan CTA */}
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
function ScanScreen({nav,back}){
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
    }catch(e){
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
        <div onClick={back} style={{position:'absolute',top:16,left:20,width:38,height:38,borderRadius:19,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
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
      <div style={{position:'relative',zIndex:3,display:'flex',justifyContent:'space-between',alignItems:'center',padding:'16px 20px',flexShrink:0}}>
        <div onClick={back} style={{width:38,height:38,borderRadius:19,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(8px)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={18} col="#fff"/>
        </div>
        <span style={{fontSize:18,fontWeight:600,color:'#fff',fontFamily:C.P}}>Scan Wine</span>
        <div style={{width:38,height:38}}/>
      </div>

      {/* Large portrait framing box */}
      <div style={{flex:1,position:'relative',zIndex:2,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:mode==='list'?'95%':'80%',aspectRatio:mode==='list'?'2/3':'2/3.2',maxHeight:mode==='list'?'87vh':'64vh',position:'relative'}}>
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
        {/* Mode toggle */}
        <div style={{display:'inline-flex',background:'rgba(0,0,0,0.55)',borderRadius:10,overflow:'hidden',backdropFilter:'blur(12px)'}}>
          {['Bottle','Wine List'].map((m,i)=>(
            <div key={i} onClick={()=>setMode(i===0?'bottle':'list')} style={{padding:'10px 24px',background:(i===0?mode==='bottle':mode==='list')?C.cr:'transparent',fontSize:17,fontWeight:600,color:(i===0?mode==='bottle':mode==='list')?'#fff':'rgba(255,255,255,0.45)',fontFamily:C.P,cursor:'pointer',transition:'background .18s'}}>{m}</div>
          ))}
        </div>
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
  // Preset buttons commit immediately
  function handlePreset(p){ setScore(p); pendingScore.current=p; commitScore(p); }

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



// ============================================================================
// FILE: pwa-screens-learn.jsx
// ============================================================================

/* Vinterest — Learn Article Screen */

function LearnArticleScreen({nav,back}){
  const [completed,setCompleted]=React.useState(()=>!!localStorage.getItem('vinterest_article_1_done'));

  const SECTIONS=[
    {term:'Body',emoji:'⚖️',plain:'How heavy a wine feels in your mouth',
     detail:"Think of it like milk: skimmed versus whole. A light-bodied wine feels delicate and clean; a full-bodied wine feels rich and coat-your-mouth weighty. Alcohol is the main driver — wines above 13.5% ABV typically feel fuller.",
     examples:['Light: Pinot Grigio, Pinot Noir, Vinho Verde','Medium: Merlot, Grenache, Viognier','Full: Cabernet Sauvignon, Barolo, oaked Chardonnay']},
    {term:'Tannins',emoji:'🪵',plain:'That drying grip on your gums after you swallow',
     detail:"Tannins come from grape skins, seeds, stems, and oak barrels. They create that dry, slightly astringent sensation — like biting into an unripe banana or drinking strong black tea. High-tannin wines age brilliantly; low-tannin wines are approachable young.",
     examples:['High: Barolo, Nebbiolo, Cabernet Sauvignon, Tannat','Medium: Merlot, Syrah, Sangiovese, Malbec','Low: Pinot Noir, Grenache, Gamay, Barbera']},
    {term:'Acidity',emoji:'⚡',plain:'How zingy and fresh the wine tastes',
     detail:"Acidity is what makes your mouth water. High-acid wines feel bright, crisp, and food-friendly — they cut through fat and cleanse the palate. Low-acid wines feel softer, rounder, and more plush. If you love Sauvignon Blanc, you love high acidity.",
     examples:['High: Riesling, Sauvignon Blanc, Chablis, Pinot Grigio','Medium: Chardonnay (oaked), Grenache, Sangiovese','Low: Viognier, Gewürztraminer, Muscat Blanc']},
    {term:'Sweetness',emoji:'🍯',plain:'From bone dry to lusciously sweet',
     detail:"Most table wines are dry — yeast converts nearly all grape sugar into alcohol during fermentation. Off-dry wines have a subtle sweetness. Dessert wines are intentionally sweet, either from late harvest, noble rot, or stopping fermentation early.",
     examples:['Bone dry: Muscadet, Chablis, most Champagne (Brut)','Off-dry: Spätlese Riesling, Vouvray demi-sec, Gewürztraminer','Sweet: Sauternes, Tokaji, Port, Moscato d\'Asti']},
    {term:'Finish',emoji:'🎵',plain:'How long the flavour lingers after you swallow',
     detail:"The finish is the aftertaste — how long the wine's flavours persist after swallowing. A great wine has a long, evolving finish. Sommeliers measure this in caudalies: each cauda equals one second of lingering flavour. 10 seconds is good; 30+ is exceptional.",
     examples:['Short: Most entry-level wines (under £12)','Medium: Mid-range bottles — a pleasant 5–10 seconds','Long: Premier Cru Burgundy, Barolo Riserva, Grand Cru Alsace']},
  ];

  function markRead(){
    if(completed) return;
    const d=XPSystem.get();
    if(!d.events.includes('article_read_1')){
      d.events.push('article_read_1');
      d.total+=25;
      XPSystem.save(d);
      XPSystem.toast([{label:'Article completed! 📚',amount:25,bonus:true}]);
    }
    localStorage.setItem('vinterest_article_1_done','1');
    setCompleted(true);
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>Tasting Fundamentals · 2 min</div>
        </div>
        {completed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ +25 XP</span>}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* Hero */}
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n="book" sz={12} col="rgba(255,255,255,0.55)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Quick Read</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>5 taste terms every wine drinker should know</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.42)',fontFamily:C.P,lineHeight:1.65}}>These are the words sommeliers use. Here's what they actually mean for your glass.</div>
        </div>

        {/* Sections */}
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {SECTIONS.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{s.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',marginBottom:10}}>{s.plain}</div>
                </div>
              </div>
              <div style={{padding:'0 16px 14px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.7}}>{s.detail}</div>
                <div style={{background:C.offWhite,borderRadius:10,padding:'10px 14px'}}>
                  {s.examples.map((ex,j)=>(
                    <div key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:j<s.examples.length-1?6:0}}>
                      <div style={{width:4,height:4,borderRadius:2,background:C.cr,marginTop:9,flexShrink:0}}/>
                      <span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Completion CTA */}
          <div style={{background:completed?C.greenBg:C.crSoft,borderRadius:16,padding:'18px 16px',textAlign:'center',border:`1px solid ${completed?C.green+'30':C.crDim}`}}>
            {completed?(
              <>
                <div style={{fontSize:32,marginBottom:8}}>🎓</div>
                <div style={{fontSize:19,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>Nice work!</div>
                <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:14}}>Next time you scan a bottle, you'll know exactly what those tasting notes mean.</div>
                <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                  <Btn onClick={()=>nav('learn')}>More quizzes</Btn>
                  <Btn primary onClick={()=>nav('camera')}>Scan a bottle</Btn>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P,marginBottom:4}}>Finished reading?</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:14}}>Mark as complete to earn +25 XP</div>
                <Btn primary full onClick={markRead}>Mark as Read · +25 XP</Btn>
              </>
            )}
          </div>
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{LearnArticleScreen});



// ============================================================================
// FILE: pwa-screens-quiz.jsx
// ============================================================================

/* Vinterest — Quiz Hub + Quiz Screens */

/* ── QUIZ HUB ── */
function QuizHubScreen({nav,back,showPro}){
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());
  const [isPro,setIsPro]=React.useState(()=>!!localStorage.getItem('vinterest_pro'));
  React.useEffect(()=>{const h=()=>setIsPro(true);window.addEventListener('vinterest:pro',h);return()=>window.removeEventListener('vinterest:pro',h);},[]);
  const qc=xpData.quizCompleted||{};
  const level=XPSystem.getLevel(xpData.total);
  const nextLvl=XPSystem.nextLevel(xpData.total);
  const prog=XPSystem.levelProgress(xpData.total);

  const DIFFS=[
    {id:'beginner',    label:'Beginner',    xp:50,  col:'#1E7B4B', bg:'#E8F5EE'},
    {id:'intermediate',label:'Intermediate',xp:100, col:'#B8963E', bg:'#FFF8E1'},
    {id:'expert',      label:'Expert',      xp:200, col:'#8B1A2F', bg:'#FDF0F3'},
  ];

  function startQuiz(topicId, difficulty){
    sessionStorage.setItem('vinterest_quiz_config', JSON.stringify({topicId, difficulty}));
    nav('quiz');
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 0',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,flex:1,letterSpacing:'-0.4px'}}>Learn</span>
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <span style={{fontSize:18}}>{level.badge}</span>
            <span style={{fontSize:16,fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpData.total} XP</span>
          </div>
        </div>
        {/* Level progress bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{level.name}</span>
            {nextLvl&&<span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{nextLvl.min - xpData.total} XP to {nextLvl.name}</span>}
          </div>
          <div style={{height:7,borderRadius:4,background:C.offWhite,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,background:level.color,width:`${Math.round(prog*100)}%`,transition:'width .6s ease'}}/>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        {/* Featured article */}
        <div onClick={()=>nav('article')} style={{background:'linear-gradient(135deg,#1a1a2e,#16213e)',borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:22}}>📖</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Quick Read · 2 min</div>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3}}>5 taste terms every wine drinker should know</div>
          </div>
          <Icon n="chevron" sz={13} col="rgba(255,255,255,0.3)"/>
        </div>
        <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Quizzes</div>

        {QUIZ_TOPICS.map((topic,ti)=>{
          const completedCount=DIFFS.filter(d=>qc[topic.id+'_'+d.id]).length;
          const allDone=completedCount===3;
          return(
            <div key={ti} style={{background:C.white,borderRadius:18,border:`1px solid ${C.line}`,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',flexShrink:0}}>
              {/* Topic header */}
              <div style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${C.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:topic.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`,fontSize:22}}>
                  {topic.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{topic.desc}</div>
                </div>
                {allDone&&<span style={{fontSize:18}}>✅</span>}
                {!allDone&&completedCount>0&&<span style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P}}>{completedCount}/3</span>}
              </div>
              {/* Difficulty rows */}
              {DIFFS.map((d,di)=>{
                const done=!!qc[topic.id+'_'+d.id];
                const xpEarned=qc[topic.id+'_'+d.id]||0;
                const locked=d.id==='expert'&&!isPro;
                return(
                  <div key={di} onClick={()=>{if(locked){showPro('expert-quiz');return;}startQuiz(topic.id,d.id);}}
                    style={{padding:'11px 14px',display:'flex',alignItems:'center',gap:10,borderBottom:di<2?`1px solid ${C.line}`:'none',cursor:'pointer',background:locked?'rgba(0,0,0,0.01)':done?d.bg:'transparent',transition:'background .15s',opacity:locked?0.6:1}}>
                    <div style={{width:30,height:30,borderRadius:8,background:locked?'rgba(0,0,0,0.04)':done?d.col:'rgba(0,0,0,0.04)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:15}}>{locked?'🔒':done?'✓':'▷'}</span>
                    </div>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:17,fontWeight:600,color:locked?C.mid:done?d.col:C.ink,fontFamily:C.P}}>{d.label}</span>
                      {locked&&<ProBadge/>}
                      {done&&!locked&&<span style={{fontSize:13,color:d.col,fontFamily:C.P,fontWeight:500}}>+{xpEarned} XP earned</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      {!done&&!locked&&<span style={{fontSize:15,fontWeight:600,color:C.mid,fontFamily:C.P}}>+{d.xp} XP</span>}
                      {locked?<Icon n="lock" sz={13} col={C.mid}/>:<Icon n="chevron" sz={13} col={C.mid}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{height:8}}/>
        {/* Reset XP */}
        <div onClick={()=>{localStorage.removeItem(XPSystem.KEY);setXpData(XPSystem.fresh());}} style={{textAlign:'center',padding:'8px',cursor:'pointer'}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P,textDecoration:'underline'}}>Reset XP &amp; progress</span>
        </div>
        <div style={{height:16}}/>
      </div>
</div>
    </div>
  );
}

/* ── QUIZ SCREEN ── */
function QuizScreen({nav,back}){
  const config=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_quiz_config')||'null'); }
    catch(e){ return null; }
  },[]);

  const topic=React.useMemo(()=>QUIZ_TOPICS.find(t=>t.id===(config?.topicId))||QUIZ_TOPICS[0],[config]);
  const difficulty=config?.difficulty||'beginner';
  const allQs=React.useMemo(()=>{
    const qs=[...(topic.questions[difficulty]||[])];
    // Shuffle questions
    for(let i=qs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [qs[i],qs[j]]=[qs[j],qs[i]]; }
    // Shuffle each question's options, keeping correct answer tracked
    return qs.slice(0,6).map(q=>{
      const correctText=q.opts[q.a];
      const shuffled=[...q.opts];
      for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
      return {...q, opts:shuffled, a:shuffled.indexOf(correctText)};
    });
  },[topic,difficulty]);

  const [qIdx,setQIdx]=React.useState(0);
  const [selected,setSelected]=React.useState(null); // null | index
  const [phase,setPhase]=React.useState('question'); // question | feedback | results
  const [score,setScore]=React.useState(0);
  const [streak,setStreak]=React.useState(0);
  const [xpGained,setXpGained]=React.useState(0);
  const [results,setResults]=React.useState([]); // [{correct,qText,selectedOpt,correctOpt,fact}]

  const DIFF_LABELS={beginner:'Beginner',intermediate:'Intermediate',expert:'Expert'};
  const DIFF_COLORS={beginner:'#1E7B4B',intermediate:'#B8963E',expert:'#8B1A2F'};
  const diffCol=DIFF_COLORS[difficulty]||C.cr;

  const q=allQs[qIdx];

  function choose(i){
    if(phase!=='question') return;
    setSelected(i);
    setPhase('feedback');
    const correct=i===q.a;
    const newStreak=correct?streak+1:0;
    setStreak(newStreak);

    const reasons=[];
    if(correct){
      setScore(s=>s+1);
      reasons.push({type:'quiz_correct',topic:topic.id,difficulty});
      if(newStreak===3) reasons.push({type:'quiz_streak',topic:topic.id,difficulty});
    } else {
      reasons.push({type:'quiz_wrong',topic:topic.id,difficulty});
    }
    const awards=XPSystem.award(reasons);
    const gained=awards.filter(a=>!a.levelUp).reduce((s,a)=>s+a.amount,0);
    setXpGained(xp=>xp+gained);
    XPSystem.toast(awards);

    const newResults=[...results,{
      correct,
      qText:q.q,
      selectedOpt:q.opts[i],
      correctOpt:q.opts[q.a],
      fact:q.fact
    }];
    setResults(newResults);

  }

  function advance(){
    if(phase!=='feedback') return;
    if(qIdx+1>=allQs.length){
      const finalScore=results.filter(r=>r.correct).length;
      const finalReasons=[{type:'quiz_complete',topic:topic.id,difficulty}];
      const a2=XPSystem.award(finalReasons);
      const g2=a2.filter(x=>!x.levelUp).reduce((s,a)=>s+a.amount,0);
      setXpGained(xp=>xp+g2);
      XPSystem.toast(a2);
      setPhase('results');
    } else {
      setQIdx(i=>i+1);
      setSelected(null);
      setPhase('question');
    }
  }

  // Results screen
  if(phase==='results'){
    const finalScore=results.filter(r=>r.correct).length;
    const pct=Math.round(finalScore/allQs.length*100);
    const msg=pct===100?'Perfect! 🏆':pct>=80?'Excellent! 🎉':pct>=60?'Good work! 👍':'Keep practising 📚';
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:diffCol,padding:'48px 24px 32px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
          <div style={{fontSize:56,lineHeight:1}}>{pct===100?'🏆':pct>=80?'🎉':pct>=60?'👍':'📚'}</div>
          <div style={{fontSize:28,fontWeight:800,color:'#fff',fontFamily:C.P}}>{msg}</div>
          <div style={{fontSize:17,color:'rgba(255,255,255,0.8)',fontFamily:C.P}}>{topic.label} · {DIFF_LABELS[difficulty]}</div>
          <div style={{display:'flex',gap:16,marginTop:8}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>{finalScore}/{allQs.length}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Correct</div>
            </div>
            <div style={{width:1,background:'rgba(255,255,255,0.25)'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>+{xpGained}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>XP earned</div>
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P}}>Review</div>
          {results.map((r,i)=>(
            <div key={i} style={{background:r.correct?C.greenBg:'#FFF0F0',borderRadius:12,padding:'10px 14px',border:`1px solid ${r.correct?C.green+'30':'#F5A0A0'}`}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{fontSize:18,flexShrink:0}}>{r.correct?'✓':'✗'}</span>
                <div>
                  <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{r.qText}</div>
                  {!r.correct&&<div style={{fontSize:15,color:'#C0392B',fontFamily:C.P,marginTop:3}}>Your answer: {r.selectedOpt}</div>}
                  {!r.correct&&<div style={{fontSize:15,color:C.green,fontFamily:C.P}}>Correct: {r.correctOpt}</div>}
                  {r.fact&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:4,lineHeight:1.4,fontStyle:'italic'}}>💡 {r.fact}</div>}
                </div>
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <Btn full style={{flex:1}} onClick={()=>{ setQIdx(0);setSelected(null);setPhase('question');setScore(0);setStreak(0);setXpGained(0);setResults([]); }}>Retry</Btn>
            <Btn primary full style={{flex:1}} onClick={()=>nav('learn')}>All Topics</Btn>
          </div>
          <div style={{height:8}}/>
        </div>
</div>
      </div>
    );
  }

  if(!q) return null;

  const progress=(qIdx+1)/allQs.length;
  const optColors=selected===null
    ? allQs[qIdx]?.opts.map(()=>({bg:C.white,border:C.line,text:C.ink}))
    : allQs[qIdx]?.opts.map((_,i)=>{
        if(i===q.a) return {bg:C.greenBg,border:C.green,text:C.green};
        if(i===selected&&selected!==q.a) return {bg:'#FFF0F0',border:'#E88080',text:'#C0392B'};
        return {bg:C.white,border:C.line,text:C.ink};
      });

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Top bar */}
      <div style={{background:C.white,padding:'14px 20px 12px',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div onClick={back} style={{width:32,height:32,borderRadius:16,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={14} col={C.ink}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
            <div style={{fontSize:13,color:diffCol,fontFamily:C.P,fontWeight:600,textTransform:'capitalize'}}>{DIFF_LABELS[difficulty]}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            {streak>=2&&<span style={{fontSize:20}}>🔥</span>}
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{qIdx+1}/{allQs.length}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:5,borderRadius:3,background:C.offWhite,overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:3,background:diffCol,width:`${Math.round(progress*100)}%`,transition:'width .4s ease'}}/>
        </div>
      </div>

      {/* Question */}
      <div onClick={phase==='feedback'?advance:undefined} style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14,cursor:phase==='feedback'?'pointer':'default'}}>
        <div style={{fontSize:21,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.4}}>{q.q}</div>

        {/* Options */}
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
          {q.opts.map((opt,i)=>{
            const s=optColors[i]||{bg:C.white,border:C.line,text:C.ink};
            return(
              <div key={i} onClick={()=>choose(i)}
                style={{padding:'15px 16px',borderRadius:14,border:`2px solid ${s.border}`,background:s.bg,cursor:phase==='question'?'pointer':'default',transition:'all .2s',display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:28,height:28,borderRadius:14,background:s.border+'25',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:15,fontWeight:700,color:s.text,fontFamily:C.P}}>
                    {phase==='feedback'&&i===q.a?'✓':phase==='feedback'&&i===selected&&selected!==q.a?'✗':String.fromCharCode(65+i)}
                  </span>
                </div>
                <span style={{fontSize:17,fontWeight:500,color:s.text,fontFamily:C.P,lineHeight:1.35}}>{opt}</span>
              </div>
            );
          })}
        </div>

        {/* Fact reveal + Next button */}
        {phase==='feedback'&&(
          <div style={{animation:'fadeIn .3s ease'}}>
            <div style={{background:selected===q.a?C.greenBg:'#FFF8F0',borderRadius:14,padding:'12px 14px',border:`1px solid ${selected===q.a?C.green+'40':'#F5C07040'}`,marginBottom:12}}>
              <div style={{fontSize:16,fontWeight:700,color:selected===q.a?C.green:'#B87000',fontFamily:C.P,marginBottom:4}}>
                {selected===q.a?'Correct! 🎉':'Not quite'}
              </div>
              {q.fact&&<div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{q.fact}</div>}
            </div>
            <div onClick={e=>{e.stopPropagation();advance();}} style={{background:C.cr,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 22px ${C.cr}45`,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>
                {qIdx+1>=allQs.length?'See Results →':'Next Question →'}
              </span>
            </div>
          </div>
        )}
        <div style={{height:12}}/>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

Object.assign(window,{QuizHubScreen,QuizScreen});



// ============================================================================
// FILE: pwa-screens-wineiq.jsx
// ============================================================================

/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s){return(s||'').toLowerCase().replace('é','e');}
function _avg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;}
function _topByCount(arr){const c={};arr.forEach(v=>{if(v)c[v]=(c[v]||0)+1});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function _topGrapes(wines,n){const all=[];wines.forEach(w=>(w.grapes||[]).forEach(g=>{if(g)all.push(g)}));return _topByCount(all).slice(0,n);}
function _topRegions(wines,n){return _topByCount(wines.map(w=>w.region).filter(Boolean)).slice(0,n);}
function _topNotes(wines,n){const all=[];wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{if(t)all.push(t)}));return _topByCount(all).slice(0,n);}

/* ── Personality labels ── */
function _personality(key,b,ta,ac,sw){
  if(key==='red'){
    if(b>=0.72&&ta>=0.68) return 'Bold & Structured';
    if(b>=0.70&&ta<0.52)  return 'Full & Velvety';
    if(b<0.48)            return 'Light & Elegant';
    if(ac>=0.68)          return 'Bright & Earthy';
    return 'Classic & Balanced';
  }
  if(key==='white'){
    if(ac>=0.70&&b<0.52)  return 'Crisp & Mineral';
    if(b>=0.68)           return 'Rich & Textured';
    if(ac>=0.65)          return 'Zingy & Aromatic';
    return 'Clean & Precise';
  }
  if(key==='rose'){
    if(sw<0.18)           return 'Bone Dry & Delicate';
    if(b>=0.55)           return 'Fruity & Expressive';
    return 'Fresh & Crisp';
  }
  if(key==='sparkling'){
    if(b>=0.60)           return 'Classic & Toasty';
    if(ac>=0.70)          return 'Taut & Precise';
    return 'Elegant & Fine';
  }
  return 'Eclectic Palate';
}

/* ── DNA "why" lines ── */
function _dnaWhy(axis,val,topGrapes,topRegions){
  const g=topGrapes.slice(0,2);
  const r=topRegions[0];
  const gs=g.length?g.join(' and '):null;
  const hi=val>=0.68,lo=val<=0.38;
  const T={
    body:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} a naturally full-bodied grape — your instinct for weight and presence runs deep.`
           :r?`${r} wines are known for their presence — your ratings confirm the pattern.`
             :'You consistently favour wines with body — it\'s become your comfort zone.',
      md:gs?`${gs} sit in the middle of the body spectrum — you gravitate toward balance over extremes.`
           :'Your palate finds medium body most satisfying — structured but never heavy.',
      lo:gs?`${gs} ${g.length>1?'are':'is'} naturally light — you favour finesse and precision over power.`
           :'Lighter body is a consistent thread — you reach for elegance over weight.',
    },
    tannins:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} grippy by nature — you gravitate toward wines built to age.`
           :'Firm tannins run through your collection — you value structure and backbone.',
      md:gs?`${gs} deliver just enough grip to be interesting without being stern.`
           :'You sit in the moderate-tannin zone — structure without severity.',
      lo:gs?`Silky tannins define your style — ${gs} ${g.length>1?'are':'is'} smooth by design, not dilution.`
           :'You prefer wines that are smooth and approachable rather than grippy.',
    },
    acidity:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} high-acid by nature — you\'re drawn to tension, freshness, and wines that cut through food.`
           :'High acidity is a running theme — you reach for wines with energy and bite.',
      md:gs?`${gs} sit in a comfortable acid balance — enough freshness without bite.`
           :'Balanced acidity is your sweet spot — not tart, not flat.',
      lo:gs?`You favour rounder wines — ${gs} lean toward richness over tartness.`
           :'Low acidity is the common thread — richer, rounder wines that don\'t bite.',
    },
    sweetness:{
      hi:gs?`A touch of sweetness recurs in your highest-rated wines — ${gs} reflect that preference.`
           :'Off-dry to sweet is clearly welcome — residual sugar is a positive in your book.',
      md:'Off-dry is your comfort zone — a hint of sweetness that frames the acidity.',
      lo:gs?`Bone dry is your default — ${gs} ${g.length>1?'are':'is'} grown for austerity, and you appreciate it.`
           :'Bone dry, consistently — sweetness doesn\'t register as a positive for you.',
    },
  };
  return T[axis]?.[hi?'hi':lo?'lo':'md']||'';
}

/* ── Gap map ── */
function _gaps(typeKey,avgB,avgT,avgA,topGrapes,topRegions){
  const rgs=new Set(topRegions.map(r=>(r||'').toLowerCase()));
  const gps=new Set(topGrapes.map(g=>(g||'').toLowerCase()));
  const pool={
    red:[
      {wine:'Ribera del Duero Reserva',region:'Spain',why:'Shares Barolo\'s grip and earthy depth with brighter red fruit and a more sun-baked savannah note.',cond:avgT>=0.60&&!rgs.has('ribera del duero')},
      {wine:'Côte-Rôtie (Syrah)',region:'Northern Rhône, France',why:'If you love structured reds, Côte-Rôtie Syrah adds violet and smoked-meat complexity entirely absent from your collection.',cond:avgB>=0.65&&!gps.has('syrah')},
      {wine:'Baga from Bairrada',region:'Portugal',why:'High tannins and acidity like Nebbiolo, but with a wild Atlantic character completely new to your cellar.',cond:avgT>=0.65&&!rgs.has('portugal')},
      {wine:'Etna Rosso (Nerello Mascalese)',region:'Sicily',why:'Volcanic reds with Burgundy elegance — earthy, high-acid, with a mineral lift none of your current picks have.',cond:avgA>=0.60&&!rgs.has('sicily')},
    ],
    white:[
      {wine:'Grüner Veltliner Smaragd',region:'Wachau, Austria',why:'Same piercing acidity as your Chablis, with a white pepper and herb dimension you haven\'t tried yet.',cond:avgA>=0.65&&!rgs.has('austria')},
      {wine:'Assyrtiko from Santorini',region:'Greece',why:'Bone-dry, volcanic, searingly precise — takes your mineral instinct beyond what Burgundy offers.',cond:avgA>=0.62&&!rgs.has('greece')},
      {wine:'Aged White Rioja',region:'Spain',why:'If you\'ve never tried oxidatively-aged white wine, White Rioja is a revelation — nutty, complex, textural.',cond:!rgs.has('rioja')},
    ],
    rose:[
      {wine:'Bandol Rosé (Mourvèdre)',region:'Provence, France',why:'Pushes your bone-dry Provençal instinct into richer, more saline, garrigue-scented territory.',cond:!gps.has('mourvèdre')},
      {wine:'Tavel Rosé',region:'Rhône Valley, France',why:'The boldest dry rosé in France — challenges your light Provençal palette with real structure and food-worthiness.',cond:avgB<0.55},
    ],
    sparkling:[
      {wine:'Blanc de Noirs (Meunier grower)',region:'Vallée de la Marne',why:'A grower Meunier Champagne takes your bready instinct toward wilder, earthier complexity.',cond:avgB>=0.55},
      {wine:'Aged Vintage Champagne',region:'Champagne',why:'Ten-plus years on lees pushes your toasty preference to its extreme — deep oxidative notes and extraordinary length.',cond:true},
      {wine:'Pét-Nat from Loire',region:'France',why:'The structural opposite of your picks — wild, cloudy, funky. A useful contrast to define what you love about your favourites.',cond:avgA>=0.65},
    ],
  };
  return (pool[typeKey]||[]).filter(s=>s.cond).slice(0,2);
}

/* ── Flavour clusters ── */
const _NOTE_CLUSTERS=[
  {name:'Dark Fruit & Spice',    kw:['blackberry','blackcurrant','black cherry','plum','dark cherry','black fruit','blueberry','clove','pepper','spice','anise','liquorice']},
  {name:'Red Fruit & Floral',    kw:['cherry','raspberry','strawberry','redcurrant','red fruit','pomegranate','violet','rose','hibiscus']},
  {name:'Earth & Leather',       kw:['earth','leather','tobacco','truffle','forest floor','mushroom','barnyard','smoke','tar','graphite','iron']},
  {name:'Citrus & Mineral',      kw:['lemon','lime','grapefruit','citrus','mineral','chalk','flint','oyster','saline','wet stone','slate']},
  {name:'Oak & Vanilla',         kw:['vanilla','caramel','toast','oak','cedar','sandalwood','coconut','cream','butterscotch']},
  {name:'Herb & Savour',         kw:['herb','thyme','rosemary','olive','green pepper','eucalyptus','menthol','garrigue','dried herb']},
  {name:'Tropical & Stone Fruit',kw:['peach','apricot','nectarine','mango','pineapple','passion fruit','melon','guava','lychee']},
  {name:'Brioche & Yeast',       kw:['brioche','toast','biscuit','bread','yeast','pastry','almonds','hazelnut']},
];
const _FOOD_PAIRINGS={
  'Dark Fruit & Spice':   'Grilled red meat, aged hard cheese, braised short rib',
  'Red Fruit & Floral':   'Duck breast, mushroom risotto, charcuterie',
  'Earth & Leather':      'Truffles, aged Parmigiano, roasted lamb',
  'Citrus & Mineral':     'Oysters, grilled white fish, goat cheese',
  'Oak & Vanilla':        'Lobster, roast chicken, crème brûlée',
  'Herb & Savour':        'Herb-roasted chicken, tapenade, grilled vegetables',
  'Tropical & Stone Fruit':'Spiced Asian dishes, crab, soft fresh cheese',
  'Brioche & Yeast':      'Aged Gruyère, smoked salmon, caviar',
};
function _clusterNotes(notes){
  const result=[];const used=new Set();
  _NOTE_CLUSTERS.forEach(cl=>{
    const matches=notes.filter(n=>{const nl=n.toLowerCase();return cl.kw.some(k=>nl.includes(k))&&!used.has(n);});
    if(matches.length>=1){matches.forEach(m=>used.add(m));result.push({name:cl.name,notes:matches.slice(0,4)});}
  });
  return result.slice(0,3);
}

/* ── Palate evolution ── */
function _evolution(wines){
  const rated=wines.filter(w=>w.rating>0&&(w.scanned_at||w.last_scanned));
  if(rated.length<3) return [];
  const sorted=[...rated].sort((a,b)=>new Date(a.scanned_at||a.last_scanned||0)-new Date(b.scanned_at||b.last_scanned||0));
  const sz=Math.max(2,Math.ceil(sorted.length/4));
  const chunks=[];
  for(let i=0;i<sorted.length;i+=sz){
    const ch=sorted.slice(i,i+sz);
    const avgR=Math.round(ch.reduce((s,w)=>s+w.rating,0)/ch.length);
    const date=new Date(ch[0].scanned_at||ch[0].last_scanned);
    const label=date.toLocaleDateString('en',{month:'short',year:'2-digit'});
    const tc={red:0,white:0,rose:0,sparkling:0};
    ch.forEach(w=>{const t=_norm(w.type);if(tc[t]!==undefined)tc[t]++;else tc.red++;});
    const dom=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
    chunks.push({label,avgR,dom,count:ch.length});
  }
  return chunks;
}

const _TYPE_COLORS={red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8'};
const _TYPES=[
  {key:'red',       label:'Reds',     col:'#8B1A2F'},
  {key:'white',     label:'Whites',   col:'#B8963E'},
  {key:'rose',      label:'Rosé',     col:'#C47A8A'},
  {key:'sparkling', label:'Sparkling',col:'#5E8FA8'},
];

/* ──────────────────────────────────────────────────
   WineDNA Screen
────────────────────────────────────────────────── */
function WineDNAScreen({nav,back,showPro}){
  const [typeIdx,setTypeIdx]=React.useState(0);
  const [genSummaries,setGenSummaries]=React.useState({});
  const [generatingSummary,setGeneratingSummary]=React.useState(null);
  const [genScripts,setGenScripts]=React.useState({});
  const [generatingScript,setGeneratingScript]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const touchX=React.useRef(null);
  const touchY=React.useRef(null);

  const allWines=WineHistory.getAll();
  const xd=XPSystem.get();
  const lv=XPSystem.getLevel(xd.total);
  const nx=XPSystem.nextLevel(xd.total);
  const pg=XPSystem.levelProgress(xd.total);

  /* Per-type stats */
  const typeStats=React.useMemo(()=>_TYPES.map(tp=>{
    const wines=allWines.filter(w=>_norm(w.type)===tp.key);
    const pct=allWines.length?Math.round(wines.length/allWines.length*100):0;
    const avgB=_avg(wines,'body',0.65);
    const avgT=_avg(wines,'tannins',0.55);
    const avgA=_avg(wines,'acidity',0.60);
    const avgS=_avg(wines,'sweetness',0.10);
    const topGrapes=_topGrapes(wines,4);
    const topRegions=_topRegions(wines,4);
    const topNotes=_topNotes(wines,14);
    const noteClusters=_clusterNotes(topNotes);
    const personality=_personality(tp.key,avgB,avgT,avgA,avgS);
    const gaps=_gaps(tp.key,avgB,avgT,avgA,topGrapes,topRegions);
    const topWines=[...wines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);
    return{...tp,wines,pct,avgB,avgT,avgA,avgS,topGrapes,topRegions,topNotes,noteClusters,personality,gaps,topWines};
  }),[allWines.length]);

  const t=typeStats[typeIdx];

  /* LLM summary */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_dna_v3_${t.key}_n${t.wines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenSummaries(s=>({...s,[t.key]:cached}));return;}
    if(genSummaries[t.key]||generatingSummary===t.key) return;
    setGeneratingSummary(t.key);
    const wineList=t.wines.slice(0,10).map(w=>`${w.name}${w.vintage?' '+w.vintage:''}${w.region?' from '+w.region:''}${w.rating?' rated '+w.rating+'/100':''}`).join('; ');
    const prompt=`My ${t.label.toLowerCase()} wine personality is "${t.personality}". I've rated: ${wineList}. Return ONLY raw JSON — no markdown, no code fences, no extra text, just the JSON object: {"preference":"one sentence on what I gravitate toward — max 18 words","why":"one sentence on why using specific grape or region names from my list — max 18 words","next":"one specific wine or region to explore next and a brief reason — max 18 words"}`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenSummaries(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingSummary(null));
  },[typeIdx,allWines.length]);

  /* LLM sommelier script */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_script_v2_${t.key}_n${t.wines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[t.key]:cached}));return;}
    if(genScripts[t.key]||generatingScript===t.key) return;
    setGeneratingScript(t.key);
    const wineList=t.wines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const prompt=`I've scanned and rated these ${t.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenScripts(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingScript(null));
  },[typeIdx,allWines.length]);

  /* Swipe */
  function onTouchStart(e){touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;}
  function onTouchEnd(e){
    if(touchX.current===null)return;
    const dx=e.changedTouches[0].clientX-touchX.current;
    const dy=e.changedTouches[0].clientY-(touchY.current||0);
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0)setTypeIdx(i=>Math.min(i+1,_TYPES.length-1));
      else setTypeIdx(i=>Math.max(i-1,0));
    }
    touchX.current=null;touchY.current=null;
  }

  /* Per-type stats */
  const tRated=t.wines.filter(w=>w.rating>0);
  const tAvgRating=tRated.length?Math.round(tRated.reduce((s,w)=>s+w.rating,0)/tRated.length):0;
  const tCountries=new Set(t.wines.map(w=>w.country).filter(Boolean)).size;
  const tAvgPrice=_avg(t.wines,'price_usd',0);
  const SH=({label})=>(<div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P,marginTop:6,marginBottom:-4}}>{label}</div>);

  /* Empty state */
  if(!allWines.length) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{background:C.white,padding:'16px 20px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>WineDNA</div>
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Your personal taste intelligence</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
          <Icon n="brain" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your WineDNA is waiting</div>
          <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and rate bottles to unlock your personal taste profile, sommelier scripts, and wine intelligence.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
      </div>
    </div>
  );

  /* Global stats */
  const ratedAll=allWines.filter(w=>w.rating>0);
  const avgRatingAll=ratedAll.length?Math.round(ratedAll.reduce((s,w)=>s+w.rating,0)/ratedAll.length):0;
  const ccounts={};allWines.forEach(w=>{if(w.country)ccounts[w.country]=(ccounts[w.country]||0)+1;});
  const uniqueCountries=Object.keys(ccounts).length;
  const topRated=[...allWines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,5);
  const avgPrice=_avg(allWines,'price_usd',0);
  const evolution=_evolution(allWines);

  /* Synthesis chips */
  const chips=[];
  if(t.topGrapes[0]) chips.push({label:'Top grape',value:t.topGrapes[0]});
  if(t.topRegions[0]) chips.push({label:'Lead region',value:t.topRegions[0]});
  chips.push({label:'Body',value:t.avgB>=0.72?'Full':t.avgB>=0.42?'Medium':'Light'});

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {/* Title row: WineDNA ←→ personality badge, baseline aligned */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px'}}>WineDNA</div>
          {t.wines.length>0&&(
            <div style={{padding:'4px 11px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`,flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.personality}</span>
            </div>
          )}
        </div>
        {/* Subtitle row: type pill + bottle count */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
            <div style={{width:5,height:5,borderRadius:3,background:t.col,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:700,color:t.col,fontFamily:C.P,letterSpacing:'0.05em'}}>{t.label.toUpperCase()}</span>
          </div>
          <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{allWines.length} bottle{allWines.length!==1?'s':''} · {lv.badge} {lv.name}</span>
        </div>
        <div style={{marginTop:10}}>
          <Prog val={pg} h={5} col={C.cr}/>
          {nx&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:3}}>{xd.total} XP · {nx.min-xd.total} to {nx.name}</div>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
      <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        <SH label="Your WineDNA"/>
        {/* ── Synthesis Card ── */}
        <Card style={{padding:0,overflow:'hidden'}}>

          {/* Type-distribution bar */}
          <div style={{height:5,background:`linear-gradient(90deg,#8B1A2F 0% ${typeStats[0].pct}%,#B8963E ${typeStats[0].pct}% ${typeStats[0].pct+typeStats[1].pct}%,#C47A8A ${typeStats[0].pct+typeStats[1].pct}% ${typeStats[0].pct+typeStats[1].pct+typeStats[2].pct}%,#5E8FA8 ${typeStats[0].pct+typeStats[1].pct+typeStats[2].pct}% 100%)`}}/>

          <div style={{padding:'14px 16px 16px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Type tabs */}
            <div style={{display:'flex',gap:5}}>
              {_TYPES.map((tp,i)=>(
                <div key={i} onClick={()=>setTypeIdx(i)} style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:10,background:i===typeIdx?tp.col+'18':C.offWhite,border:`1.5px solid ${i===typeIdx?tp.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:7,height:7,borderRadius:4,background:tp.col,margin:'0 auto 3px'}}/>
                  <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.label}</div>
                  <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                </div>
              ))}
            </div>

            {/* Nav arrows */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div onClick={()=>setTypeIdx(i=>Math.max(i-1,0))} style={{width:30,height:30,borderRadius:15,background:typeIdx>0?t.col+'15':C.offWhite,border:`1px solid ${typeIdx>0?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:typeIdx>0?'pointer':'default',opacity:typeIdx>0?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="12,4 6,10 12,16" stroke={typeIdx>0?t.col:C.mid} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{typeIdx+1} of {_TYPES.length} · swipe or tap</span>
              <div onClick={()=>setTypeIdx(i=>Math.min(i+1,_TYPES.length-1))} style={{width:30,height:30,borderRadius:15,background:typeIdx<_TYPES.length-1?t.col+'15':C.offWhite,border:`1px solid ${typeIdx<_TYPES.length-1?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:typeIdx<_TYPES.length-1?'pointer':'default',opacity:typeIdx<_TYPES.length-1?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="8,4 14,10 8,16" stroke={typeIdx<_TYPES.length-1?t.col:C.mid} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            <div style={{height:1,background:C.line}}/>

            {t.wines.length===0?(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>No {t.label.toLowerCase()} scanned yet.</div>
                <Btn primary small onClick={()=>nav('camera')} style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:10}}>Scan a Bottle</Btn>
              </div>
            ):(
              <>
                {/* WineDNA label + type pill + personality */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>WineDNA</span>
                      <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
                        <div style={{width:5,height:5,borderRadius:3,background:t.col}}/>
                        <span style={{fontSize:12,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.label}</span>
                      </div>
                    </div>
                    <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px',lineHeight:1.15}}>{t.personality}</div>
                  </div>
                </div>

                {/* Narrative — 3 labelled sections */}
                {generatingSummary===t.key?(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                    <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Analysing your palate…</span>
                  </div>
                ):(()=>{
                  const raw=genSummaries[t.key];
                  let sections=null;
                  if(raw){try{sections=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){sections=null;}}
                  if(!sections) return <p style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.68,margin:0}}>{raw||'Generating your WineDNA summary…'}</p>;
                  return(
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {[
                        {label:'Your Preference',text:sections.preference},
                        {label:'Why You Like It', text:sections.why},
                        {label:'Try Next',         text:sections.next},
                      ].filter(s=>s.text).map((s,i)=>(
                        <div key={i}>
                          <div style={{fontSize:12,fontWeight:700,color:t.col,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>{s.label}</div>
                          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,textWrap:'pretty'}}>{s.text}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Fact chips */}
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {chips.map((ch,i)=>(
                    <div key={i} style={{padding:'5px 11px',borderRadius:20,background:i===0?`${t.col}10`:C.offWhite,border:`1px solid ${i===0?t.col+'30':C.line}`,display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:i===0?t.col:C.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.value}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{t.wines.length} {t.label.toLowerCase()} scanned</span>
                  <span style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P,cursor:'pointer'}} onClick={()=>{
                    const key=`vinterest_dna_v3_${t.key}_n${t.wines.length}`;
                    localStorage.removeItem(key);
                    setGenSummaries(s=>{const n={...s};delete n[t.key];return n;});
                  }}>↺ Regenerate</span>
                </div>
              </>
            )}
          </div>
        </Card>

        {t.wines.length>0&&<SH label="Taste Breakdown"/>}
        {/* ── Wine DNA attributes + why lines ── */}
        {t.wines.length>0&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:12}}>Wine DNA · {t.label}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {l:'Body',     v:t.avgB, lo:'Light',    hi:'Full',   col:t.col,     axis:'body'},
                {l:'Tannins',  v:t.avgT, lo:'Silky',    hi:'Grippy', col:'#7B5EA7', axis:'tannins'},
                {l:'Acidity',  v:t.avgA, lo:'Mellow',   hi:'Zingy',  col:C.green,   axis:'acidity'},
                {l:'Sweetness',v:t.avgS, lo:'Bone Dry', hi:'Sweet',  col:C.amber,   axis:'sweetness'},
              ].map((attr,i)=>{
                const why=t.wines.length>=2?_dnaWhy(attr.axis,attr.v,t.topGrapes,t.topRegions):null;
                return(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{attr.l}</span>
                      <span style={{fontSize:13,fontWeight:600,color:attr.col,fontFamily:C.P}}>{attr.v>=.72?attr.hi:attr.v>=.38?'Medium':attr.lo}</span>
                    </div>
                    <Prog val={attr.v} col={attr.col} h={5}/>
                    {why&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:5,lineHeight:1.55,fontStyle:'italic',textWrap:'pretty'}}>{why}</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {t.wines.length>=3&&t.gaps.length>0&&<SH label="Explore"/>}
        {/* ── Explore Next / Gap Map ── */}
        {t.wines.length>=3&&t.gaps.length>0&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Explore Next</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:12}}>Styles that share your {t.label.toLowerCase()} DNA but introduce new territory</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.gaps.map((s,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:12,background:i===0?`${t.col}08`:C.offWhite,border:`1px solid ${i===0?t.col+'25':C.line}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{s.wine}</div>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>{s.region}</span>
                  </div>
                  <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty'}}>{s.why}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Flavour Signatures ── */}
        {t.wines.length>=2&&t.noteClusters.length>0&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:12}}>Flavour Signatures</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.noteClusters.map((cl,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>{cl.name}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                    {cl.notes.map((n,j)=>(
                      <span key={j} style={{padding:'3px 9px',borderRadius:20,background:j===0?`${t.col}10`:C.white,border:`1px solid ${j===0?t.col+'30':C.line}`,fontSize:13,color:j===0?t.col:C.ink2,fontFamily:C.P}}>{n}</span>
                    ))}
                  </div>
                  {_FOOD_PAIRINGS[cl.name]&&(
                    <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0,marginTop:1}}>Pairs with</span>
                      <span style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{_FOOD_PAIRINGS[cl.name]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {evolution.length>=3&&<SH label="Your Journey"/>}
        {/* ── Palate Evolution ── */}
        {evolution.length>=3&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Palate Evolution</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:14}}>How your ratings have shifted over time</div>
            <div style={{display:'flex',gap:4,alignItems:'flex-end',height:72,marginBottom:6}}>
              {evolution.map((e,i)=>{
                const h=Math.round((e.avgR/100)*100);
                const col=_TYPE_COLORS[e.dom]||C.cr;
                return(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <span style={{fontSize:13,fontWeight:600,color:col,fontFamily:C.P}}>{e.avgR}</span>
                    <div style={{width:'55%',height:`${h}%`,minHeight:4,background:col,borderRadius:'4px 4px 0 0',opacity:0.72,transition:'height .3s'}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',gap:4}}>
              {evolution.map((e,i)=>(
                <div key={i} style={{flex:1,textAlign:'center'}}>
                  <span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{e.label}</span>
                </div>
              ))}
            </div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:10,lineHeight:1.55}}>
              {evolution[evolution.length-1].avgR>evolution[0].avgR
                ?`Your average rating has climbed from ${evolution[0].avgR} to ${evolution[evolution.length-1].avgR} — your palate is getting sharper.`
                :`Consistent scores across your collection show a clear, settled sense of what you love.`}
            </div>
          </Card>
        )}

        {t.wines.length>0&&<SH label="At the Restaurant"/>}
        {/* ── Sommelier Script ── */}
        {t.wines.length>0&&(
          <Card style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <Icon n="message" sz={14} col={t.col}/>
              <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {t.label} Script</span>
            </div>
            {generatingScript===t.key?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65,marginBottom:genScripts[t.key]?10:0}}>{genScripts[t.key]||'Generating…'}</div>
                {genScripts[t.key]&&(
                  <div style={{display:'flex',gap:8}}>
                    <Btn primary small style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`}} onClick={()=>{
                      try{navigator.clipboard.writeText((genScripts[t.key]||'').replace(/"/g,''));setCopied(t.key);setTimeout(()=>setCopied(null),2000);}catch(e){}
                    }}>{copied===t.key?'Copied!':'Copy Script'}</Btn>
                    <Btn small onClick={()=>{
                      const key=`vinterest_script_v2_${t.key}_n${t.wines.length}`;
                      localStorage.removeItem(key);
                      setGenScripts(s=>{const n={...s};delete n[t.key];return n;});
                    }}>Regenerate</Btn>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <SH label="Your Collection"/>
        {/* ── Stats grid ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[
            {icon:'wine',  label:`${t.label} Scanned`, val:t.wines.length,                    col:t.col,     bg:t.col+'15'},
            {icon:'star',  label:'Avg Rating',           val:tAvgRating?`${tAvgRating}/100`:'—', col:C.amber,  bg:C.amberBg},
            {icon:'globe', label:'Countries',            val:tCountries||'—',                   col:C.green,  bg:C.greenBg},
            {icon:'trophy',label:'XP Earned',            val:`${xd.total} XP`,                  col:'#7B5EA7', bg:'#F0EBF8'},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:14,padding:'12px 14px',border:`1px solid ${s.col}20`,display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:24,height:24,borderRadius:6,background:`${s.col}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n={s.icon} sz={13} col={s.col}/>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:s.col,fontFamily:C.P,lineHeight:1}}>{s.val}</div>
              </div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Average price if available ── */}
        {tAvgPrice>0&&(
          <Card style={{background:C.amberBg,border:`1px solid ${C.amber}25`,padding:12,boxShadow:'none'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:2}}>Avg Price · {t.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.amber,fontFamily:C.P}}>${Math.round(tAvgPrice)}<span style={{fontSize:15,fontWeight:400,color:C.mid,marginLeft:4}}>per bottle</span></div>
          </Card>
        )}

        {t.topWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'12px 14px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Top {t.label}</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
            </div>
            {t.topWines.map((w,i)=>{
              const col=_TYPE_COLORS[_norm(w.type)]||C.cr;
              return(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:24,height:24,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:C.cr,fontFamily:C.P}}>#{i+1}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:1,flexShrink:0}}>
                    <span style={{fontSize:18,fontWeight:800,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>/100</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── Data Backup ── */}
        <Card style={{padding:14}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');a.href=url;a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1}} onClick={()=>{
              const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
              inp.onchange=e=>{
                const file=e.target.files[0];if(!file)return;
                const reader=new FileReader();
                reader.onload=ev=>{
                  try{
                    const d=JSON.parse(ev.target.result);
                    if(d.wines)WineHistory.save(d.wines);
                    if(d.xp)localStorage.setItem(XPSystem.KEY,JSON.stringify(d.xp));
                    alert('Restored! '+((d.wines||[]).length)+' wines imported.');
                    window.location.reload();
                  }catch(err){alert('Could not read backup file.');}
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP as a JSON file. Import restores from a previous backup.</div>
        </Card>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes dnaSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{WineDNAScreen,WineIQScreen:WineDNAScreen});



// ============================================================================
// FILE: pwa-quiz-questions.js
// ============================================================================

/* Vinterest — Quiz Question Bank */

const QUIZ_TOPICS = [
  {
    id:'red_grapes', label:'Red Grapes', icon:'🍇', color:'#8B1A2F',
    desc:'Cabernet to Nebbiolo — know your reds',
    questions:{
      beginner:[
        {q:'Which grape forms the backbone of Bordeaux red blends?',opts:['Cabernet Sauvignon','Pinot Noir','Nebbiolo','Sangiovese'],a:0,fact:'Cab Sauv dominates the left-bank Médoc — Pauillac, Saint-Estèphe and Margaux.'},
        {q:'Chianti is made primarily from which grape?',opts:['Sangiovese','Merlot','Grenache','Tempranillo'],a:0,fact:'Sangiovese is the soul of Tuscany — it means "blood of Jupiter".'},
        {q:'Pinot Noir is the signature grape of which French region?',opts:['Burgundy','Bordeaux','Rhône','Alsace'],a:0,fact:'Burgundy\'s Côte de Nuits is arguably the world\'s greatest Pinot Noir terroir.'},
        {q:'Malbec is most celebrated in which country?',opts:['Argentina','Spain','Italy','Chile'],a:0,fact:'Mendoza\'s high altitude and sunshine transformed Malbec into an international star.'},
        {q:'Which grape makes Barolo — "the King of Italian wines"?',opts:['Nebbiolo','Barbera','Dolcetto','Aglianico'],a:0,fact:'Nebbiolo is described as smelling of tar and roses, and can age for 30+ years.'},
        {q:'Rioja reds are primarily made from which grape?',opts:['Tempranillo','Garnacha','Monastrell','Mencía'],a:0,fact:'Tempranillo is Spain\'s most planted red grape and means "little early one".'},
        {q:'Which Australian region is most famous for old-vine Shiraz?',opts:['Barossa Valley','Yarra Valley','Margaret River','Clare Valley'],a:0,fact:'Barossa has vines over 150 years old — producing some of the world\'s most concentrated Shiraz.'},
        {q:'Beaujolais Nouveau is made from which grape?',opts:['Gamay','Pinot Noir','Grenache','Carignan'],a:0,fact:'Gamay is the only grape allowed in Beaujolais — vinified by carbonic maceration for fresh, fruity wines.'},
      ],
      intermediate:[
        {q:'Amarone della Valpolicella is made from dried grapes — its primary variety is?',opts:['Corvina','Sangiovese','Montepulciano','Primitivo'],a:0,fact:'Corvina grapes are dried for months on bamboo racks in a process called "appassimento".'},
        {q:'Which single grape produces Hermitage and Crozes-Hermitage in the Northern Rhône?',opts:['Syrah','Grenache','Mourvèdre','Viognier'],a:0,fact:'The Northern Rhône is exclusively Syrah territory — no blending permitted.'},
        {q:'Primitivo in Italy is genetically identical to which American variety?',opts:['Zinfandel','Petite Sirah','Carignane','Alicante'],a:0,fact:'DNA testing confirmed Primitivo = Zinfandel in the 1990s. Both trace back to a Croatian grape.'},
        {q:'Which grape is considered Portugal\'s finest red, used in Port and dry wines?',opts:['Touriga Nacional','Touriga Franca','Tinta Roriz','Tinta Barroca'],a:0,fact:'Touriga Nacional is prized for its intense floral aromas and deep colour.'},
        {q:'Tannat is the signature grape of which South American country?',opts:['Uruguay','Chile','Argentina','Brazil'],a:0,fact:'Uruguay made Tannat its national grape — it thrives in the Atlantic-influenced climate.'},
        {q:'Châteauneuf-du-Pape blends up to 18 varieties — which typically dominates?',opts:['Grenache','Syrah','Mourvèdre','Cinsault'],a:0,fact:'Grenache often makes up 60–80% of a CdP blend, giving warmth and red fruit character.'},
        {q:'Blaufränkisch is Austria\'s finest red. What is it called in Germany?',opts:['Lemberger','Zweigelt','St. Laurent','Spätburgunder'],a:0,fact:'Blaufränkisch/Lemberger is spicy, structured and capable of great ageing in Burgenland.'},
        {q:'Pinotage is a unique grape created in which country?',opts:['South Africa','Australia','New Zealand','Chile'],a:0,fact:'Pinotage is a South African cross of Pinot Noir and Cinsaut, created at Stellenbosch University in 1925.'},
      ],
      expert:[
        {q:'Aglianico del Vulture DOCG comes from which Italian region?',opts:['Basilicata','Campania','Puglia','Calabria'],a:0,fact:'The volcanic Mount Vulture soils of Basilicata give Aglianico extraordinary mineral depth.'},
        {q:'Pomerol and Saint-Émilion on Bordeaux\'s right bank are dominated by:',opts:['Merlot','Cabernet Franc','Cabernet Sauvignon','Petit Verdot'],a:0,fact:'Pétrus — the world\'s most expensive wine by the bottle — is almost 100% Merlot.'},
        {q:'Xinomavro is a structured red grape indigenous to which country?',opts:['Greece','Turkey','Bulgaria','Croatia'],a:0,fact:'"Xinomavro" means "acid black" in Greek — it\'s the Nebbiolo of the Eastern Mediterranean.'},
        {q:'Sagrantino DOCG, with wine\'s highest tannin levels, is grown near:',opts:['Montefalco','Orvieto','Torgiano','Assisi'],a:0,fact:'Sagrantino di Montefalco is one of Italy\'s most powerful and age-worthy wines.'},
        {q:'Which grape makes the famed single-varietal wines of Priorat, Spain?',opts:['Garnacha','Tempranillo','Monastrell','Bobal'],a:0,fact:'Old-vine Garnacha on Priorat\'s black slate "llicorella" produces extreme concentration.'},
        {q:'Nerello Mascalese grown on Etna\'s volcanic slopes is often compared to which Burgundy grape?',opts:['Pinot Noir','Gamay','Chardonnay','Aligoté'],a:0,fact:'Etna Rosso from Nerello Mascalese shares Pinot Noir\'s translucency, earthiness and perfume.'},
      ]
    }
  },
  {
    id:'white_grapes', label:'White Grapes', icon:'🥂', color:'#B8963E',
    desc:'Chardonnay to Riesling and beyond',
    questions:{
      beginner:[
        {q:'White Burgundy (Chablis, Meursault, Puligny) is made from which grape?',opts:['Chardonnay','Sauvignon Blanc','Pinot Gris','Viognier'],a:0,fact:'All white Burgundy is 100% Chardonnay — one grape, infinite expressions.'},
        {q:'Marlborough, New Zealand made which grape internationally famous?',opts:['Sauvignon Blanc','Chardonnay','Pinot Gris','Riesling'],a:0,fact:'Marlborough Sauvignon Blanc changed the world\'s palate in the 1980s with its vivid tropical character.'},
        {q:'Prosecco is made from which grape variety?',opts:['Glera','Chardonnay','Pinot Grigio','Trebbiano'],a:0,fact:'Glera (formerly called Prosecco) must make up at least 85% of any Prosecco DOC wine.'},
        {q:'Albariño is the aromatic white grape of which Spanish region?',opts:['Rías Baixas','Rioja','Rueda','Penedès'],a:0,fact:'Rías Baixas in rainy Galicia produces the most vivid and food-friendly Albariño.'},
        {q:'Champagne\'s "Blanc de Blancs" is made exclusively from which grape?',opts:['Chardonnay','Pinot Noir','Pinot Meunier','Pinot Blanc'],a:0,fact:'Blanc de Blancs ("white from whites") — lighter, more delicate and longer-lived than non-vintage Champagne.'},
        {q:'German Riesling can range in style from:',opts:['Bone dry to lusciously sweet','Only sweet','Only dry','Only medium-sweet'],a:0,fact:'Germany\'s Prädikat system (Kabinett through Trockenbeerenauslese) covers dry to intensely sweet.'},
        {q:'Which grape is used to make Soave DOC from Veneto, Italy?',opts:['Garganega','Verdicchio','Greco','Fiano'],a:0,fact:'Garganega is the backbone of Soave — delicate, almondy and food-friendly.'},
        {q:'Grüner Veltliner is the flagship white grape of which country?',opts:['Austria','Germany','Switzerland','Hungary'],a:0,fact:'Austria\'s most planted grape — known for its signature white pepper note and crisp minerality.'},
      ],
      intermediate:[
        {q:'Viognier is the sole grape of which Northern Rhône appellation?',opts:['Condrieu','Hermitage','Crozes-Hermitage','Saint-Joseph'],a:0,fact:'Condrieu produces the world\'s most exotic and heady aromatic whites — 100% Viognier.'},
        {q:'Which white grape is the primary variety in Sauternes?',opts:['Sémillon','Sauvignon Blanc','Muscadelle','All three blend'],a:3,fact:'Sauternes is a blend — Sémillon dominates (affected by noble rot), with Sauvignon Blanc and Muscadelle.'},
        {q:'Furmint is the grape at the heart of which legendary sweet wine?',opts:['Tokaji Aszú','Sauternes','Trockenbeerenauslese','Eiswein'],a:0,fact:'Hungarian Tokaji has been made since the 17th century — praised by Napoleon and the Tsar.'},
        {q:'Palomino is the grape used to make which classic fortified wine?',opts:['Sherry','Madeira','Marsala','Port'],a:0,fact:'Palomino Fino makes up 95%+ of the base wine for Fino and Manzanilla Sherry.'},
        {q:'Which Burgundy white appellation is known for steely, mineral, unoaked style?',opts:['Chablis','Meursault','Puligny-Montrachet','Chassagne-Montrachet'],a:0,fact:'Chablis sits north of the rest of Burgundy — Kimmeridgian limestone gives it unparalleled minerality.'},
        {q:'Torrontés — Argentina\'s aromatic white — is most expressive from which province?',opts:['Salta','Mendoza','Río Negro','San Juan'],a:0,fact:'Salta\'s extreme altitude (up to 3,000m) produces the most floral, vibrant Torrontés.'},
        {q:'Muscadet is made from which grape variety?',opts:['Melon de Bourgogne','Muscadelle','Muscat','Melon Blanc'],a:0,fact:'Melon de Bourgogne — crisp, light and perfect with oysters and seafood from the Atlantic coast.'},
        {q:'"Sur lie" ageing means the wine is aged on:',opts:['Dead yeast cells after fermentation','Oak chips','Tartrate crystals','The grape skins'],a:0,fact:'Sur lie ageing adds creaminess, complexity and autolytic (bread-dough) character to white wines.'},
      ],
      expert:[
        {q:'Rkatsiteli — one of the world\'s oldest cultivated vines — is from which country?',opts:['Georgia','Greece','Armenia','Bulgaria'],a:0,fact:'Georgia\'s 8,000-year winemaking history centres on Rkatsiteli and amber-style qvevri wines.'},
        {q:'In Alsace, what is an "Edelzwicker"?',opts:['A blend of noble Alsatian grapes','A late harvest sweet wine','A single-vineyard Riesling','A sparkling Crémant'],a:0,fact:'Edelzwicker ("noble blend") can combine Riesling, Pinot Gris, Gewürztraminer and others.'},
        {q:'Airén covers vast plains of La Mancha. Why is it significant?',opts:['It may be the world\'s most planted white grape by area','It makes Spain\'s finest whites','It is used to make Cava','It is the base for Sherry'],a:0,fact:'Airén\'s prolific yields over La Mancha\'s arid plains made it the most planted white grape globally for decades.'},
        {q:'Vernaccia di San Gimignano holds which historic Italian wine distinction?',opts:['Italy\'s first DOC (1966)','Italy\'s most exported white','The oldest documented Tuscan wine','The only Tuscan DOCG white'],a:0,fact:'Vernaccia di San Gimignano was Italy\'s very first DOC, awarded in 1966.'},
        {q:'Gewürztraminer at its most expressive typically shows which aromatic profile?',opts:['Lychee, rose petal, ginger and spice','Green apple and citrus','Herbaceous and grassy','Tropical passionfruit and guava'],a:0,fact:'Gewürztraminer\'s hallmarks are intense lychee, Turkish delight and exotic spice aromas — often off-dry.'},
        {q:'Which Galician white appellation — not Rías Baixas — is known for fragrant, mineral whites from the Ribeiro valley?',opts:['Ribeiro','Monterrei','Valdeorras','Txakoli'],a:0,fact:'Ribeiro is Galicia\'s oldest appellation — its Treixadura-dominant blends are floral, fresh and underrated.'},
      ]
    }
  },
  {
    id:'regions', label:'Wine Regions', icon:'🌍', color:'#5E8FA8',
    desc:'From Bordeaux to Barossa',
    questions:{
      beginner:[
        {q:'Which French region produces famous Cabernet Sauvignon-based reds?',opts:['Bordeaux','Burgundy','Champagne','Loire Valley'],a:0,fact:'Bordeaux\'s left-bank Médoc (Pauillac, Margaux) is the historic home of great Cabernet.'},
        {q:'True Champagne can only come from which country?',opts:['France','Italy','Spain','Germany'],a:0,fact:'The Champagne appellation is legally protected — only wines from this specific French region can use the name.'},
        {q:'The Barossa Valley is a world-famous wine region in which country?',opts:['Australia','New Zealand','South Africa','Argentina'],a:0,fact:'Barossa in South Australia is renowned for old-vine Shiraz, some vines over 150 years old.'},
        {q:'Chianti Classico is produced in which Italian region?',opts:['Tuscany','Piedmont','Veneto','Sicily'],a:0,fact:'Chianti Classico sits in the hills between Florence and Siena — the ancient heart of Chianti.'},
        {q:'Rioja is a celebrated wine region in which country?',opts:['Spain','Portugal','Italy','France'],a:0,fact:'Rioja\'s tiered Crianza, Reserva, Gran Reserva system is Spain\'s most recognised appellation.'},
        {q:'Marlborough, famed for Sauvignon Blanc, is in which country?',opts:['New Zealand','Australia','South Africa','Chile'],a:0,fact:'Marlborough at the top of New Zealand\'s South Island has perfect cool-climate conditions.'},
        {q:'Napa Valley is the most prestigious wine region in which country?',opts:['USA','Australia','Argentina','Chile'],a:0,fact:'Napa Valley Cabernet Sauvignon commands prices rivalling Bordeaux — and often outscores them in blind tastings.'},
        {q:'Douro Valley is Portugal\'s greatest wine region, famous for:',opts:['Port and exceptional dry reds','Vinho Verde','Alentejo table wines','Light rosé'],a:0,fact:'The terraced schist vineyards of the Douro produce classic Port and some of Europe\'s finest dry reds.'},
      ],
      intermediate:[
        {q:'Which Bordeaux appellation on the "right bank" is home to Pétrus?',opts:['Pomerol','Pauillac','Margaux','Saint-Estèphe'],a:0,fact:'Pomerol\'s clay soils are ideal for Merlot. Pétrus, the world\'s most expensive wine, comes from here.'},
        {q:'Piedmont\'s "Langhe" hills are home to which two great DOCG wines?',opts:['Barolo & Barbaresco','Prosecco & Soave','Brunello & Vino Nobile','Amarone & Ripasso'],a:0,fact:'The Langhe is the beating heart of Nebbiolo — Barolo (bigger) and Barbaresco (more elegant).'},
        {q:'Which German region produces the finest Rieslings on steep slate slopes?',opts:['Mosel','Rheingau','Pfalz','Nahe'],a:0,fact:'Mosel\'s impossibly steep terraces face south to maximise sunshine in this cool climate.'},
        {q:'Priorat — known for powerful Garnacha — is in which Spanish region?',opts:['Catalonia','Castilla y León','Rioja','Galicia'],a:0,fact:'Priorat\'s unique black slate and quartz soils ("llicorella") give its wines extraordinary mineral depth.'},
        {q:'Willamette Valley in Oregon, USA is most celebrated for:',opts:['Pinot Noir','Cabernet Sauvignon','Chardonnay','Merlot'],a:0,fact:'Oregon\'s cool, rainy Willamette Valley produces Pinot Noirs that rival Burgundy at a fraction of the price.'},
        {q:'Stellenbosch is a world-class wine region in which country?',opts:['South Africa','Australia','Argentina','Chile'],a:0,fact:'Stellenbosch — just outside Cape Town — is home to some of Africa\'s finest Cabernet Sauvignon.'},
        {q:'Mendoza, at altitude in the Andes foothills, is in which country?',opts:['Argentina','Chile','Bolivia','Uruguay'],a:0,fact:'Mendoza produces 70% of Argentina\'s wine — its high altitude and sunshine are perfect for Malbec.'},
        {q:'Which region of Italy makes the sparkling Franciacorta using the traditional method?',opts:['Lombardy','Piedmont','Veneto','Friuli'],a:0,fact:'Franciacorta DOCG near Brescia is Italy\'s answer to Champagne — bottle-fermented and aged on lees.'},
      ],
      expert:[
        {q:'How many Premiers Crus Classés châteaux exist in the 1855 Bordeaux Classification?',opts:['5','6','4','8'],a:0,fact:'The original 1855 list had 4 Premiers Crus; Mouton Rothschild was promoted in 1973 — the only change in 170 years.'},
        {q:'Gevrey-Chambertin is a Grand Cru commune in which sub-region of Burgundy?',opts:['Côte de Nuits','Côte de Beaune','Mâconnais','Chablis'],a:0,fact:'The Côte de Nuits runs from Gevrey-Chambertin to Nuits-Saint-Georges — the world\'s greatest Pinot Noir strip.'},
        {q:'Tokaj wine region historically spans Hungary and which other country?',opts:['Slovakia','Czech Republic','Ukraine','Romania'],a:0,fact:'A small strip of the historic Tokaj region lies in Slovakia, where Tokajský wines are still produced.'},
        {q:'Tokaj wine region historically spans Hungary and which other country?',opts:['Slovakia','Czech Republic','Ukraine','Romania'],a:0,fact:'A small strip of the historic Tokaj region lies in Slovakia, where Tokajský wines are still produced.'},
        {q:'The Mosel valley in Germany borders which two countries?',opts:['Luxembourg and France','Belgium and the Netherlands','Switzerland and Austria','France and Belgium'],a:0,fact:'The Mosel river rises in France, passes through Luxembourg, and joins the Rhine at Koblenz in Germany.'},
        {q:'Vinho Verde DOC in Portugal means "green wine" — what does this actually refer to?',opts:['The wine is young/fresh, not the colour','The wine is always white','Wines made from green grapes','Wines from the Minho green hills only'],a:0,fact:'"Verde" means young — Vinho Verde is meant to be drunk young and fresh. Red and white versions both exist.'},
        {q:'Coonawarra in South Australia is famous for its "terra rossa" soils over limestone. What does it grow best?',opts:['Cabernet Sauvignon','Shiraz','Pinot Noir','Chardonnay'],a:0,fact:'Coonawarra\'s red terra rossa topsoil over cool limestone produces structured, elegant Cabernet of outstanding quality.'},
      ]
    }
  },
  {
    id:'tasting', label:'Tasting Technique', icon:'👁️', color:'#7B5EA7',
    desc:'See, swirl, sniff, sip, savour',
    questions:{
      beginner:[
        {q:'What does "tannins" refer to in red wine?',opts:['The drying, grippy sensation in your mouth','The sweetness level','The alcohol content','The acidity level'],a:0,fact:'Tannins come from grape skins, seeds, stems and oak barrels — they create structure and allow ageing.'},
        {q:'When a wine is described as "dry", it means:',opts:['Very little residual sugar','It tastes woody','It has low alcohol','It is highly acidic'],a:0,fact:'A dry wine has had almost all its grape sugar fermented into alcohol. The opposite of sweet.'},
        {q:'What does "finish" or "length" mean in wine tasting?',opts:['How long flavours linger after you swallow','The colour depth of the wine','The weight of the wine','The complexity of the nose'],a:0,fact:'A "long finish" (20+ seconds of lingering flavour) is a hallmark of great wine.'},
        {q:'Why do you swirl wine in the glass?',opts:['To release aromas by oxygenating the wine','To check the wine\'s colour','To mix any sediment','To cool the wine faster'],a:0,fact:'Swirling vaporises aromatic compounds so your nose can detect them more easily.'},
        {q:'What does "terroir" mean?',opts:['The complete natural environment of a vineyard','A French wine classification','A barrel ageing technique','A type of indigenous grape'],a:0,fact:'Terroir (soil, climate, slope, aspect, microbiome) is what makes one plot taste different from its neighbour.'},
        {q:'A wine with "high acidity" will taste:',opts:['Crisp and mouthwatering','Bitter and astringent','Sweet and rich','Flat and dull'],a:0,fact:'Acidity makes your mouth water — it\'s the backbone of fresh, food-friendly wine. Low acidity feels "flabby".'},
        {q:'What is "body" in wine tasting terms?',opts:['How heavy and full the wine feels in your mouth','The colour and opacity of the wine','The alcohol level on the label','How long it was aged'],a:0,fact:'Body is largely determined by alcohol and extract — think of skimmed milk (light) vs double cream (full).'},
        {q:'What does "oak influence" typically add to a wine?',opts:['Vanilla, toast, spice and rounded texture','Higher acidity','More tannins from the grapes','A lighter colour'],a:0,fact:'New French oak adds vanilla and spice; American oak is more coconut and sawdust. Both soften and round wine.'},
      ],
      intermediate:[
        {q:'What is "malolactic fermentation" (MLF)?',opts:['Converting tart malic acid to softer lactic acid','Adding sugar before primary fermentation','A second alcoholic fermentation','Fermenting in barrels instead of tanks'],a:0,fact:'MLF makes wines rounder and creamier — virtually all reds and many oaked whites undergo it.'},
        {q:'What do "legs" or "tears" on a glass actually indicate?',opts:['Higher alcohol or residual sugar (Marangoni effect)','Better wine quality','The wine is ready to drink','The glass needs cleaning'],a:0,fact:'Legs are caused by the Marangoni effect — they indicate higher alcohol or sugar, NOT quality.'},
        {q:'A wine described as "bretty" has:',opts:['A barnyard, leather or Band-Aid aroma from yeast','A fresh, floral perfume','Excessive oak tannins','A green, underripe character'],a:0,fact:'Brettanomyces yeast creates "brett" — at low levels complex, at high levels a wine fault.'},
        {q:'What is "reduction" in wine?',opts:['A sulphury or struck-match character from lack of oxygen','A wine concentrated by evaporation','A technique to lower alcohol','Overripe fruit character'],a:0,fact:'Reduction occurs when wine hasn\'t had enough oxygen — it often blows off with swirling or decanting.'},
        {q:'Why do winemakers "punch down" during red wine fermentation?',opts:['To submerge the grape skin cap and extract colour and tannin','To add oxygen','To remove yeast','To cool the fermenting must'],a:0,fact:'Grape skins float to form a "cap" — breaking it up maximises colour, tannin and flavour extraction.'},
        {q:'"Volatile acidity" (VA) at high levels creates which fault?',opts:['A vinegary or nail-polish aroma','Excessive tannin','Overripe jammy fruit','Earthy mushroom character'],a:0,fact:'VA is mostly acetic acid — above ~1.4 g/L it becomes a detectable and unpleasant fault.'},
        {q:'What does decanting an old red wine primarily achieve?',opts:['Separates sediment and allows the wine to breathe','Chills the wine quickly','Adds oxygen to increase tannins','Removes sulphur from the wine'],a:0,fact:'Old wines should be gently decanted to remove sediment; young tannic reds benefit from the aeration.'},
        {q:'"Phenolic ripeness" in red wines most directly affects:',opts:['Tannin smoothness and mouthfeel','Colour intensity','Nose complexity','Acidity levels'],a:0,fact:'Fully phenolically ripe tannins are silky and round; underripe phenolics produce hard, astringent tannins.'},
      ],
      expert:[
        {q:'The WSET Systematic Approach to Tasting covers which main categories?',opts:['Appearance, Nose, Palate, Conclusions','Colour, Aroma, Flavour, Finish, Score','See, Swirl, Sniff, Sip, Score','Structure, Fruit, Oak, Balance, Score'],a:0,fact:'The WSET SAT is the global standard used from Level 2 through the Diploma and MW.'},
        {q:'What is the purpose of "dosage" in Champagne production?',opts:['To adjust final sweetness after disgorging','To initiate secondary fermentation','To clarify the wine by riddling','To stabilise with sulphur'],a:0,fact:'Dosage (wine + sugar added after disgorgement) determines Brut, Extra Brut, Demi-Sec etc.'},
        {q:'"Whole-cluster fermentation" in Pinot Noir contributes:',opts:['Spice, savouriness and structural tannin from stems','More colour and extraction','Faster fermentation','Higher alcohol levels'],a:0,fact:'Stems can add a forest floor or spicy savoury complexity — used by top Burgundy producers like Rousseau.'},
        {q:'Which compound primarily causes the "cat\'s pee" aroma in Sauvignon Blanc?',opts:['Methoxypyrazines','Thiols','Linalool','Esters'],a:0,fact:'Pyrazines create green, herbaceous, vegetal aromas — especially from cool-climate Sauvignon Blanc.'},
        {q:'What is "cryoextraction" used for in sweet wine production?',opts:['Freezing grapes to concentrate sugars and flavours','Rapid cooling after fermentation','Chilling the must before pressing','Stabilising wine at low temperatures'],a:0,fact:'Cryoextraction mimics natural freezing — water in the grape freezes first, leaving concentrated sugary juice.'},
        {q:'The "Brix" scale measures:',opts:['Potential alcohol from sugar content in grape juice','Tannin levels in red wines','Acidity in finished wine','Total sulphur dioxide levels'],a:0,fact:'Each degree Brix roughly corresponds to 0.55% potential alcohol — winemakers use it to decide harvest timing.'},
      ]
    }
  },
  {
    id:'food_pairing', label:'Food & Wine', icon:'🍽️', color:'#1E7B4B',
    desc:'Match wine to the table',
    questions:{
      beginner:[
        {q:'Which wine is the classic pairing with oysters?',opts:['Chablis or dry Champagne','Oaked Chardonnay','Full-bodied Shiraz','Sweet Riesling'],a:0,fact:'The mineral, saline acidity of Chablis mirrors the salinity of oysters — a textbook match.'},
        {q:'What is the classic pairing with Sauternes?',opts:['Foie gras','Beef steak','Tomato pasta','Sushi'],a:0,fact:'Sauternes\' sweetness and acidity balance the richness of foie gras — one of food and wine\'s great marriages.'},
        {q:'Which wine would you choose with a rich rack of lamb?',opts:['Full-bodied red (Cabernet/Syrah)','Dry Riesling','Light Rosé','Sparkling wine'],a:0,fact:'The tannins and body of a full-bodied red cut through lamb fat and cleanse the palate beautifully.'},
        {q:'Why does sparkling wine pair so well with fried food?',opts:['The bubbles and acidity cut through oil','The sweetness balances salt','The tannins match the crunch','The low alcohol reduces richness'],a:0,fact:'Champagne and fish & chips is genuinely brilliant — the acidity and bubbles dissolve the grease.'},
        {q:'A light, crisp Pinot Grigio pairs best with:',opts:['Light seafood and salads','Rich beef stews','Strong blue cheese','BBQ ribs'],a:0,fact:'Match wine weight to food weight — light wine, light dish. Pinot Grigio would be overwhelmed by heavy food.'},
        {q:'"What grows together, goes together" suggests:',opts:['Regional food and wine pairings often work best','Only French wine with French food','Organic wine with organic food','Coastal wines taste of the sea'],a:0,fact:'Italian wine with Italian food, Rioja with tapas — regional pairings are almost always a safe starting point.'},
        {q:'Which wine works best with a simple green salad with vinaigrette?',opts:['Crisp, high-acid white (Sauvignon Blanc)','Full-bodied red','Oaked Chardonnay','Sweet Riesling'],a:0,fact:'Match acid with acid — the wine\'s acidity needs to meet or exceed the vinaigrette, or it will taste flat.'},
        {q:'Champagne is traditionally served as an aperitif. Why does it work so well?',opts:['High acidity and bubbles stimulate appetite','High sugar gives energy before the meal','It is the most expensive option','Tradition only — no flavour reason'],a:0,fact:'Bubbles and acidity cleanse and stimulate the palate — making Champagne a perfect appetite opener.'},
      ],
      intermediate:[
        {q:'Tannic red wines should generally be avoided with:',opts:['Fish and shellfish','Red meat','Hard aged cheese','Mushroom dishes'],a:0,fact:'Tannin reacts with fish oils to create an unpleasant metallic or bitter taste on the palate.'},
        {q:'A wine with high residual sugar pairs best with:',opts:['Spicy food','Acidic tomato dishes','Cured meats','Raw vegetables'],a:0,fact:'Sweetness in wine tames the heat of chilli — an off-dry Riesling with Thai curry is a classic example.'},
        {q:'For a chocolate dessert, the wine should be:',opts:['Sweeter than the dessert','Drier than the dessert','The same sweetness','As tannic as possible'],a:0,fact:'If the wine is less sweet than the dessert, it will taste thin and acidic — always match or exceed sweetness.'},
        {q:'Umami-rich foods (mushrooms, aged cheese, truffle) tend to:',opts:['Amplify tannins and acidity in wine','Soften tannins','Add perceived sweetness','Have no effect'],a:0,fact:'Umami intensifies perceived tannin and acidity — choose lower-tannin, lower-acid wines with umami-heavy dishes.'},
        {q:'Why does Sancerre pair so well with Crottin de Chavignol goat\'s cheese?',opts:['Both from Loire Valley — share herbaceous, mineral qualities','Both are white','Both are French','Wine tannins balance cheese fat'],a:0,fact:'This textbook regional pairing — the cheese and wine share the same mineral, grassy Loire terroir.'},
        {q:'The "bridge ingredient" technique means:',opts:['Using a shared ingredient in the sauce to link wine and dish','Serving two wines per course','Using the cooking wine as the drinking wine','Matching wine colour to sauce colour'],a:0,fact:'A lemon butter sauce bridges sole to white Burgundy; a red wine reduction bridges beef to Pomerol.'},
        {q:'Rich, fatty foods (duck confit, foie gras) pair well with wines that have:',opts:['High acidity to cut through the fat','Low acidity to complement richness','High sweetness to match richness','High tannins to overwhelm the fat'],a:0,fact:'Acidity acts as a palate cleanser — it cuts through fat and makes each bite taste fresh again.'},
        {q:'Which classic pairing breaks the "tannin + fish = metallic" rule?',opts:['Fatty tuna steak with light Pinot Noir','Salmon with Barolo','Turbot with Barolo','Oysters with Shiraz'],a:0,fact:'Dense, fatty tuna has the body to handle a light Pinot Noir — the fat neutralises tannin.'},
      ],
      expert:[
        {q:'Aged Comté cheese pairs exceptionally well with:',opts:['White Burgundy or Vin Jaune','Barolo','Vintage Port','Dry Rosé'],a:0,fact:'Comté and Vin Jaune share a Jura origin and matching nutty, oxidative character — a great regional match.'},
        {q:'"Congruent pairing" means:',opts:['Matching similar flavour compounds in wine and food','Contrasting wine and food to create balance','Serving the wine that was cooked with the dish','Pairing by price point'],a:0,fact:'Congruent = like with like: buttery Chardonnay with butter sauce, fruity Pinot with cherry reduction.'},
        {q:'Roquefort and Sauternes is a classic "contrast pairing". What makes it work?',opts:['Sweet vs salty; rich vs acidic — opposites attract','Both are from the same region','Both have high acidity','The wine\'s tannins balance the cheese'],a:0,fact:'The sweetness and acidity of Sauternes cuts through the salty fat of Roquefort — a contrast match.'},
        {q:'Why can Alsace Gewürztraminer work with mildly spiced Indian dishes?',opts:['Residual sweetness tames spice; lychee/rose mirrors curry aromatics','High tannins absorb chilli heat','High acidity refreshes the palate','Low alcohol reduces perceived heat'],a:0,fact:'Off-dry Gewürz has the sweetness to tame spice and the exotic aromatics to complement curry spices.'},
        {q:'Salt in food makes wine taste:',opts:['Less bitter and more fruity','More acidic','Sweeter','More tannic'],a:0,fact:'Salt suppresses bitterness and enhances fruit — it makes tannic wines taste smoother and rounder.'},
        {q:'Which umami-rich pairing demonstrates why vintage Port and Stilton is a classic?',opts:['Port\'s sweetness and tannin balance the salty, savoury, fatty Stilton','Both are aged for decades','Both are British','The port\'s acidity cuts the cheese fat'],a:0,fact:'Stilton\'s intense saltiness and fat are balanced by Port\'s sweetness, tannin and rich fruit — a great contrast match.'},
      ]
    }
  }
];



// ============================================================================
// FILE: pwa-xp.js
// ============================================================================

/* Vinterest — XP Engine */

const XP_LEVELS = [
  {name:'Novice',          min:0,    badge:'🍇', color:'#8A8A8A'},
  {name:'Enthusiast',      min:150,  badge:'🥂', color:'#B8963E'},
  {name:'Explorer',        min:350,  badge:'🌍', color:'#5E8FA8'},
  {name:'Connoisseur',     min:650,  badge:'🔍', color:'#7B5EA7'},
  {name:'Aficionado',      min:1050, badge:'🏅', color:'#1E7B4B'},
  {name:'Cru',             min:1600, badge:'🍾', color:'#C47A8A'},
  {name:'Sommelier',       min:2400, badge:'🎓', color:'#8B1A2F'},
  {name:'Head Sommelier',  min:3500, badge:'⭐', color:'#8B2252'},
  {name:'Master Sommelier',min:5000, badge:'🏆', color:'#B06C00'},
  {name:'Grand Master',    min:7000, badge:'👑', color:'#0F0F0F'},
];

const XPSystem = {
  KEY:'vinterest_xp_v2',
  get(){
    try{ return JSON.parse(localStorage.getItem(this.KEY)||'null') || this.fresh(); }
    catch(e){ return this.fresh(); }
  },
  fresh(){
    return {total:0,events:[],scansThisWeek:[],totalRatings:0,grapesSeen:[],quizCompleted:{},quizStreaks:{}};
  },
  save(d){ localStorage.setItem(this.KEY, JSON.stringify(d)); },

  getLevel(xp){
    for(let i=XP_LEVELS.length-1;i>=0;i--){
      if(xp>=XP_LEVELS[i].min) return {...XP_LEVELS[i], index:i};
    }
    return {...XP_LEVELS[0], index:0};
  },
  nextLevel(xp){
    const cur=this.getLevel(xp);
    return XP_LEVELS[cur.index+1]||null;
  },
  levelProgress(xp){
    const cur=this.getLevel(xp);
    const nxt=this.nextLevel(xp);
    if(!nxt) return 1;
    return (xp-cur.min)/(nxt.min-cur.min);
  },

  award(reasons){
    const d=this.get();
    const awards=[];
    const prevLevel=this.getLevel(d.total).name;

    reasons.forEach(r=>{
      switch(r.type){
        case 'scan':
          d.total+=10;
          awards.push({label:'Wine scanned',amount:10});
          // weekly scan bonus
          {const now=Date.now(), wAgo=now-7*24*60*60*1000;
          d.scansThisWeek=[(d.scansThisWeek||[]).filter(t=>t>wAgo),now].flat();
          const wk='week5_'+Math.floor(now/(7*24*60*60*1000));
          if(d.scansThisWeek.length>=5 && !d.events.includes(wk)){
            d.events.push(wk); d.total+=50;
            awards.push({label:'5 scans this week! 🚀',amount:50,bonus:true});
          }}
          break;

        case 'rate':
          d.total+=15;
          d.totalRatings=(d.totalRatings||0)+1;
          awards.push({label:'Wine rated',amount:15});
          if(d.totalRatings===10 && !d.events.includes('ratings_10')){
            d.events.push('ratings_10'); d.total+=100;
            awards.push({label:'10 wines rated! 🏅',amount:100,bonus:true});
          }
          break;

        case 'quiz_correct':
          d.total+=10;
          // track streak per topic+difficulty
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=(d.quizStreaks[sk]||0)+1;
          awards.push({label:'Correct!',amount:10});
          if(d.quizStreaks[sk]===3){
            d.total+=30;
            awards.push({label:'3-answer streak! 🔥',amount:30,bonus:true});
          }}
          break;

        case 'quiz_wrong':
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=0;}
          break;

        case 'quiz_complete':
          {const k=(r.topic||'')+'_'+(r.difficulty||'');
          if(!d.quizCompleted) d.quizCompleted={};
          if(!d.quizCompleted[k]){
            const bonus={beginner:50,intermediate:100,expert:200}[r.difficulty]||50;
            d.quizCompleted[k]=bonus; d.total+=bonus;
            awards.push({label:'Quiz complete! 🎉',amount:bonus,bonus:true});
          }}
          break;

        case 'first_type':
          if(r.value && !d.events.includes('type_'+r.value)){
            d.events.push('type_'+r.value); d.total+=25;
            awards.push({label:'First '+r.value+' wine! 🆕',amount:25,bonus:true});
          }
          break;

        case 'first_country':
          if(r.value){
            const ck='country_'+(r.value).toLowerCase().replace(/\s/g,'_');
            if(!d.events.includes(ck)){
              d.events.push(ck); d.total+=20;
              awards.push({label:'First from '+r.value+'! 🌍',amount:20,bonus:true});
            }
          }
          break;

        case 'new_grape':
          if(r.value){
            const g=(r.value).toLowerCase();
            if(!(d.grapesSeen||[]).includes(g)){
              d.grapesSeen=(d.grapesSeen||[]);
              d.grapesSeen.push(g); d.total+=15;
              awards.push({label:'New grape: '+r.value+' 🍇',amount:15,bonus:true});
            }
          }
          break;

        case 'expensive_wine':
          if(r.wineKey && !d.events.includes('expensive_'+r.wineKey)){
            d.events.push('expensive_'+r.wineKey); d.total+=50;
            awards.push({label:'Premium wine scanned! 💎',amount:50,bonus:true});
          }
          break;
      }
    });

    this.save(d);
    // Check level-up
    const newLevel=this.getLevel(d.total).name;
    if(newLevel!==prevLevel){
      awards.push({label:'Level up: '+newLevel+'!',amount:0,levelUp:true,level:newLevel});
    }
    return awards;
  },

  toast(awards){
    if(!awards||!awards.length) return;
    window.dispatchEvent(new CustomEvent('vinterest:xp',{detail:{awards}}));
  },

  awardAndToast(reasons){
    const a=this.award(reasons);
    this.toast(a);
    return a;
  }
};


