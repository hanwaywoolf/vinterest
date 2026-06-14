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
          <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpBadge.total} XP</span>
          {!!localStorage.getItem('vinterest_pro')&&<span style={{fontSize:10,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#9B5E00,#C4870A)',borderRadius:8,padding:'2px 6px',marginLeft:2}}>PRO</span>}
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
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{xd.total} XP total</div>
                </div>
                <div onClick={()=>setShowXpOverlay(false)} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
                  <span style={{fontSize:18,lineHeight:1,color:C.ink}}>×</span>
                </div>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'14px 20px'}}>
                {/* All tiers */}
                <div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:10}}>Tiers</div>
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
                              <span style={{fontSize:15,fontWeight:isActive?700:500,color:isActive?C.cr:C.ink,fontFamily:C.P}}>{lv.name}</span>
                              <span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{lv.min} XP{isActive?' ← you':''}</span>
                            </div>
                            {isActive&&next&&<Prog val={prog} h={5} col={C.cr} style={{marginTop:4}}/>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Achievements */}
                <div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginBottom:10}}>Achievements</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,paddingBottom:24}}>
                  {ACHIEVEMENTS.map((a,i)=>(
                    <div key={i} style={{borderRadius:12,padding:'10px 12px',background:a.done?C.greenBg:C.offWhite,border:`1px solid ${a.done?C.green+'40':C.line}`,display:'flex',flexDirection:'column',gap:4,opacity:a.done?1:0.5}}>
                      <span style={{fontSize:22}}>{a.icon}</span>
                      <span style={{fontSize:12,fontWeight:600,color:a.done?C.green:C.ink,fontFamily:C.P,lineHeight:1.3}}>{a.label}</span>
                      {a.done&&<span style={{fontSize:10,color:C.green,fontFamily:C.P}}>✓ Completed</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{padding:'10px 20px 28px',borderTop:`1px solid ${C.line}`,flexShrink:0}}>
                <div onClick={()=>{setShowXpOverlay(false);nav('learn');}} style={{background:C.cr,borderRadius:12,padding:'13px',textAlign:'center',cursor:'pointer'}}>
                  <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P}}>Start a Quiz — Earn XP</span>
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
                {a.levelUp&&<span style={{fontSize:16}}>🏆</span>}
                {a.bonus&&!a.levelUp&&<span style={{fontSize:14}}>⭐</span>}
                {!a.levelUp&&!a.bonus&&<span style={{fontSize:14,fontWeight:700,color:C.amber,fontFamily:C.P}}>+{a.amount} XP</span>}
                <span style={{fontSize:13,fontWeight:600,color:'#fff',fontFamily:C.P}}>{a.label}</span>
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
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Wines matched to your taste profile</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:14,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>If You Like Pinot Grigio…</div>
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
                    <span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                  </div>
                </div>
                <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{w.region}</div>
                <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,marginTop:3,lineHeight:1.4}}>{w.note}</div>
              </div>
            </div>
          </Card>
        ))}
        <Card style={{background:C.greenBg,border:`1px solid ${C.green}25`,padding:12,boxShadow:'none'}}>
          <div style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>💡 Menu Tip</div>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Don't see Pinot Grigio on the list? Ask for Soave or Vermentino — same flavour family and often better value.</div>
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
        <span style={{fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P,padding:'4px 10px',borderRadius:20,background:C.crSoft}}>In Store</span>
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
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>California · Pinot Noir</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>88%</span>
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
        <div style={{fontSize:14,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Also on This Shelf</div>
        {[{name:'Elouan Pinot Noir',sub:'Oregon · $22',score:92,note:'Higher match — try this one!'},
          {name:'La Crema Pinot Noir',sub:'Sonoma · $19',score:85,note:'Similar style, great value'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:6,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
                <div style={{fontSize:13,color:C.cr,fontFamily:C.P,marginTop:2,fontWeight:500}}>{w.note}</div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                <span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
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
