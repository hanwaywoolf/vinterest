/* Vinterest PWA — Main App with navigation */

function App(){
  const [screen,setScreen]=React.useState(()=>{
    const h=window.location.hash.replace('#','');
    return h||'home';
  });
  const [stack,setStack]=React.useState(['home']);
  const [hasKey,setHasKey]=React.useState(()=>!!localStorage.getItem('vinterest_api_key'));

  // Show setup screen if no API key yet
  if(!hasKey) return <SetupScreen onDone={()=>setHasKey(true)}/>;

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

  const navTab=['home','discover','scan','learn','profile'].indexOf(screen);
  const showNav=['home','discover','learn','profile','shopping','restaurant'].includes(screen);

  // Active bottom nav index
  const activeNav={home:0,discover:1,scan:2,learn:3,profile:4}[screen]??-1;

  const ctx={nav,back};

  return(
    <div style={{width:'100%',maxWidth:430,minHeight:'100dvh',margin:'0 auto',background:C.bg,display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
        {screen==='home'      && <HomeScreen {...ctx}/>}
        {screen==='scan'      && <ScanScreen {...ctx}/>}
        {screen==='identified'&& <WineIdentifiedScreen {...ctx}/>}
        {screen==='detail'    && <WineDetailScreen {...ctx}/>}
        {screen==='profile'   && <TasteProfileScreen {...ctx}/>}
        {screen==='restaurant'&& <RestaurantScreen {...ctx}/>}
        {screen==='learn'     && <LearnScreen {...ctx}/>}
        {screen==='discover'  && <DiscoverScreen {...ctx}/>}
        {screen==='shopping'  && <ShoppingScreen {...ctx}/>}
      </div>
      {showNav&&<BottomNav active={activeNav} nav={nav}/>}
    </div>
  );
}

/* ── API Key Setup Screen ── */
function SetupScreen({onDone}){
  const [key,setKey]=React.useState('');
  const [err,setErr]=React.useState('');

  function handleSave(){
    const trimmed=key.trim();
    if(!trimmed){ setErr('Please paste your API key'); return; }
    if(!trimmed.startsWith('sk-ant-')){ setErr("Should start with 'sk-ant-' — copy it from console.anthropic.com"); return; }
    localStorage.setItem('vinterest_api_key',trimmed);
    onDone();
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',background:C.bg}}>
      <div style={{width:64,height:64,borderRadius:16,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:20,boxShadow:`0 8px 24px ${C.cr}50`}}>
        <Icon n="wine" sz={32} col="#fff"/>
      </div>
      <div style={{fontSize:24,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',marginBottom:6}}>Vinterest</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginBottom:32,textAlign:'center',lineHeight:1.5}}>Add your Anthropic API key to enable real wine label scanning.</div>
      <div style={{width:'100%',maxWidth:340,display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:11,fontWeight:600,color:C.ink2,fontFamily:C.P}}>Anthropic API Key</div>
        <input type="password" placeholder="sk-ant-..." value={key} onChange={e=>setKey(e.target.value)}
          style={{width:'100%',padding:'12px 14px',borderRadius:12,border:`1.5px solid ${err?'#E57373':C.line}`,fontFamily:C.P,fontSize:13,color:C.ink,background:C.white,outline:'none'}}/>
        {err&&<div style={{fontSize:10.5,color:'#C62828',fontFamily:C.P}}>{err}</div>}
        <div style={{fontSize:10,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Get yours at <span style={{color:C.cr,fontWeight:600}}>console.anthropic.com</span> → API Keys. Stored on your device only.</div>
        <div onClick={handleSave} style={{background:C.cr,borderRadius:12,padding:'13px',textAlign:'center',cursor:'pointer',boxShadow:`0 4px 16px ${C.cr}40`}}>
          <span style={{fontSize:13,fontWeight:600,color:'#fff',fontFamily:C.P}}>Save & Start Scanning</span>
        </div>
        <div style={{textAlign:'center',fontSize:10,color:C.mid,fontFamily:C.P,cursor:'pointer',textDecoration:'underline'}}
          onClick={()=>{localStorage.setItem('vinterest_api_key','demo');onDone();}}>Skip — use demo mode</div>
      </div>
    </div>
  );
}

/* ── Simple Discover placeholder ── */
function DiscoverScreen({nav,back}){
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px'}}>Discover</div>
        <div style={{fontSize:11,color:C.mid,fontFamily:C.P}}>Wines matched to your taste profile</div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:10,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>If You Like Pinot Grigio…</div>
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
                  <span style={{fontSize:13,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</span>
                  <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                    <span style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                  </div>
                </div>
                <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>{w.region}</div>
                <div style={{fontSize:10,color:C.ink2,fontFamily:C.P,marginTop:3,lineHeight:1.4}}>{w.note}</div>
              </div>
            </div>
          </Card>
        ))}
        <Card style={{background:C.greenBg,border:`1px solid ${C.green}25`,padding:12,boxShadow:'none'}}>
          <div style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>💡 Menu Tip</div>
          <div style={{fontSize:10,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Don't see Pinot Grigio on the list? Ask for Soave or Vermentino — same flavour family and often better value.</div>
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
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>Shopping Mode</span>
        <span style={{fontSize:10,fontWeight:600,color:C.cr,fontFamily:C.P,padding:'4px 10px',borderRadius:20,background:C.crSoft}}>In Store</span>
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
                  <div style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P}}>Meiomi Pinot Noir</div>
                  <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>California · Pinot Noir</div>
                </div>
                <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:C.P}}>88%</span>
                </div>
              </div>
              <div style={{display:'flex',gap:5,marginTop:6}}><Pill active sm>Red</Pill><Pill sm>Medium Body</Pill></div>
            </div>
          </div>
          <div style={{borderTop:`1px solid ${C.line}`,marginTop:10,paddingTop:10,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>$18.99</span>
            <Btn primary small>Add to Cart</Btn>
          </div>
        </Card>
        <div style={{fontSize:10,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Also on This Shelf</div>
        {[{name:'Elouan Pinot Noir',sub:'Oregon · $22',score:92,note:'Higher match — try this one!'},
          {name:'La Crema Pinot Noir',sub:'Sonoma · $19',score:85,note:'Similar style, great value'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:6,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
                <div style={{fontSize:9,color:C.cr,fontFamily:C.P,marginTop:2,fontWeight:500}}>{w.note}</div>
              </div>
              <div style={{display:'inline-flex',alignItems:'center',gap:2,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                <span style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
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
