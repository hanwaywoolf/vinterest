/* Vinterest — Onboarding (first-run, 3 slides) */

function OnboardingScreen({onComplete}){
  const [slide,setSlide]=React.useState(0);
  const [pref,setPref]=React.useState(null);

  function finish(){
    if(pref) localStorage.setItem('vinterest_initial_pref',pref);
    if (!localStorage.getItem('vinterest_region')) {
      localStorage.setItem('vinterest_region', 'uk');
    }
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
