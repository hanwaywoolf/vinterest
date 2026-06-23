/* Vinterest — New User Flow: Welcome (feature overview) + Demo first scan */

/* ── Screen 1: Welcome / feature overview ── */
function WelcomeScreen({next}){
  const feats=[
    {icon:'camera',col:'#8B1A2F',bg:'#FDF0F3',t:'Scan any label',d:'Point your camera at a bottle. Know exactly what it is in seconds.'},
    {icon:'brain', col:'#3B6FB0',bg:'#EEF3FB',t:'Know if you’ll like it',d:'A personal match score, built from your own taste.'},
    {icon:'book',  col:'#1E7B4B',bg:'#EAF7F0',t:'Learn as you go',d:'Plain-language notes and stories — no sommelier required.'},
  ];
  return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:150,background:`${C.cr}22`,pointerEvents:'none'}}></div>
      <div style={{position:'absolute',bottom:120,left:-60,width:200,height:200,borderRadius:100,background:`${C.cr}12`,pointerEvents:'none'}}></div>

      <div style={{flex:1,overflowY:'auto',padding:'calc(env(safe-area-inset-top) + 24px) 28px 16px',position:'relative',zIndex:1}}>
        <img src="logo.png" alt="Vinterest" style={{height:30,width:'auto',display:'block',marginBottom:36,filter:'invert(1) brightness(2)'}}/>
        <div style={{fontSize:34,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-1px',lineHeight:1.1,marginBottom:14}}>Wine, finally<br/>uncomplicated.</div>
        <div style={{fontSize:16,color:'rgba(255,255,255,0.45)',fontFamily:C.P,lineHeight:1.6,marginBottom:34,maxWidth:300}}>Scan a bottle and get an instant read — what it is, whether it’s for you, and why.</div>

        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {feats.map((f,i)=>(
            <div key={i} style={{display:'flex',gap:14,alignItems:'center'}}>
              <div style={{width:46,height:46,borderRadius:13,background:f.bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={f.icon} sz={22} col={f.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:2}}>{f.t}</div>
                <div style={{fontSize:14,color:'rgba(255,255,255,0.42)',fontFamily:C.P,lineHeight:1.45}}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'12px 24px 44px',position:'relative',zIndex:1,flexShrink:0}}>
        <div onClick={next} style={{background:C.cr,borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',boxShadow:`0 10px 40px ${C.cr}55`}}>
          <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Scan your first bottle</span>
        </div>
        <div style={{textAlign:'center',marginTop:14}}>
          <span style={{fontSize:14,color:'rgba(255,255,255,0.4)',fontFamily:C.P}}>No account needed to try</span>
        </div>
      </div>
    </div>
  );
}

/* ── Screen 2: Demo first scan (viewfinder → identifying → result) ── */
function DemoScanScreen({next}){
  // phase: 'aim' | 'scanning' | 'result'
  const [phase,setPhase]=React.useState('aim');

  React.useEffect(()=>{
    if(phase==='scanning'){
      const t=setTimeout(()=>setPhase('result'),2100);
      return ()=>clearTimeout(t);
    }
  },[phase]);

  if(phase==='result') return <DemoResult next={next}/>;

  const scanning=phase==='scanning';
  return(
    <div style={{flex:1,background:'#0A0A0A',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      {/* top bar */}
      <div style={{padding:'calc(env(safe-area-inset-top) + 16px) 22px 0',display:'flex',alignItems:'center',justifyContent:'space-between',position:'relative',zIndex:2}}>
        <span style={{fontSize:15,color:'rgba(255,255,255,0.5)',fontFamily:C.P,fontWeight:500}}>Try a scan</span>
        <span style={{fontSize:13,color:'rgba(255,255,255,0.35)',fontFamily:C.P,background:'rgba(255,255,255,0.08)',padding:'4px 10px',borderRadius:20}}>Demo</span>
      </div>

      {/* viewfinder */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{position:'relative',width:230,height:300}}>
          {/* the "label" in frame */}
          <div style={{position:'absolute',inset:0,borderRadius:16,background:'linear-gradient(160deg,#2A2018 0%,#1A1410 100%)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,overflow:'hidden'}}>
            <div style={{width:90,height:90,borderRadius:'50%',border:`2px solid ${C.cr}`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{fontSize:30,fontWeight:900,color:C.crL,fontFamily:'Georgia,serif',fontStyle:'italic'}}>Ch</div>
            </div>
            <div style={{width:110,height:7,borderRadius:4,background:'rgba(255,255,255,0.16)'}}></div>
            <div style={{width:80,height:6,borderRadius:4,background:'rgba(255,255,255,0.1)'}}></div>
            {/* scan line */}
            {scanning&&<div style={{position:'absolute',left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${C.crL},transparent)`,boxShadow:`0 0 16px ${C.crL}`,animation:'vscan 1.2s ease-in-out infinite'}}></div>}
          </div>
          {/* corner brackets */}
          {[[0,0,'tl'],[1,0,'tr'],[0,1,'bl'],[1,1,'br']].map(([x,y,k])=>(
            <div key={k} style={{position:'absolute',width:30,height:30,
              [y?'bottom':'top']:-6,[x?'right':'left']:-6,
              borderTop:!y?`3px solid ${scanning?C.crL:'#fff'}`:'none',
              borderBottom:y?`3px solid ${scanning?C.crL:'#fff'}`:'none',
              borderLeft:!x?`3px solid ${scanning?C.crL:'#fff'}`:'none',
              borderRight:x?`3px solid ${scanning?C.crL:'#fff'}`:'none',
              borderTopLeftRadius:!x&&!y?10:0,borderTopRightRadius:x&&!y?10:0,
              borderBottomLeftRadius:!x&&y?10:0,borderBottomRightRadius:x&&y?10:0,
              transition:'border-color .3s'}}></div>
          ))}
        </div>
      </div>

      {/* bottom */}
      <div style={{padding:'0 24px 48px',textAlign:'center',position:'relative',zIndex:2}}>
        <div style={{fontSize:15,color:'rgba(255,255,255,0.5)',fontFamily:C.P,marginBottom:22,height:20}}>
          {scanning?'Identifying…':'Line up the label and tap to scan'}
        </div>
        {/* shutter */}
        <div onClick={()=>!scanning&&setPhase('scanning')} style={{width:72,height:72,borderRadius:'50%',margin:'0 auto',border:'4px solid rgba(255,255,255,0.5)',padding:4,cursor:scanning?'default':'pointer',opacity:scanning?0.5:1}}>
          <div style={{width:'100%',height:'100%',borderRadius:'50%',background:scanning?C.crL:'#fff',transition:'background .3s'}}></div>
        </div>
      </div>

      <style>{`@keyframes vscan{0%{top:8%}50%{top:88%}100%{top:8%}}`}</style>
    </div>
  );
}

/* ── Demo scan result ── */
function DemoResult({next}){
  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'calc(env(safe-area-inset-top) + 16px) 22px 16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:18}}>
          <div style={{width:22,height:22,borderRadius:11,background:C.green,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Icon n="check" sz={12} col="#fff"/>
          </div>
          <span style={{fontSize:14,fontWeight:600,color:C.green,fontFamily:C.P}}>Identified</span>
        </div>

        <div style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,letterSpacing:'0.04em',textTransform:'uppercase',marginBottom:6}}>Rhône · France</div>
        <div style={{fontSize:27,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',lineHeight:1.12,marginBottom:4}}>Châteauneuf-du-Pape</div>
        <div style={{fontSize:16,color:C.mid,fontFamily:C.P,marginBottom:20}}>Domaine Jean XXII · 2019</div>

        {/* facts */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {[['Type','Red blend'],['Grape','Grenache'],['Body','Full'],['Pairs with','Lamb, beef']].map(([k,v])=>(
            <div key={k} style={{background:C.white,borderRadius:14,padding:'13px 15px',boxShadow:'0 1px 4px rgba(0,0,0,0.05)'}}>
              <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginBottom:3}}>{k}</div>
              <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>{v}</div>
            </div>
          ))}
        </div>

        {/* locked match score teaser */}
        <div style={{background:'#0F0F0F',borderRadius:16,padding:'18px 18px',display:'flex',alignItems:'center',gap:14,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:-20,top:-20,width:110,height:110,borderRadius:55,background:`${C.cr}30`}}></div>
          <div style={{width:46,height:46,borderRadius:23,background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1}}>
            <Icon n="lock" sz={20} col="#fff"/>
          </div>
          <div style={{flex:1,zIndex:1}}>
            <div style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:2}}>Your match score</div>
            <div style={{fontSize:13.5,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.4}}>Save this scan to unlock your personal taste match.</div>
          </div>
        </div>
      </div>

      <div style={{padding:'12px 24px 44px',flexShrink:0,borderTop:`1px solid ${C.line}`,background:C.white}}>
        <div onClick={next} style={{background:C.cr,borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',boxShadow:`0 8px 28px ${C.cr}45`}}>
          <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Save this & keep scanning</span>
        </div>
        <div style={{textAlign:'center',marginTop:12}}>
          <span style={{fontSize:13.5,color:C.mid,fontFamily:C.P}}>Free — 30 scans a month, no card required</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{WelcomeScreen,DemoScanScreen,DemoResult});
