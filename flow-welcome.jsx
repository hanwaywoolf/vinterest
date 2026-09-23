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
          <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Get started</span>
        </div>
        <div style={{textAlign:'center',marginTop:14}}>
          <span style={{fontSize:14,color:'rgba(255,255,255,0.4)',fontFamily:C.P}}>Takes about a minute. No account needed.</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{WelcomeScreen});
