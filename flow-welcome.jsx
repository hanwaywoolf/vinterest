/* Vinterest — New User Flow: the welcome screen.
   Says what makes Vinterest different (seven things, Vinny among them), sets the expectation that it gets better with every bottle
   (so people stay while their match and WineDNA build), then one action: scan your first bottle.
   The age and location step comes next, on the way to the camera. */

const _WELCOME_FEATS=[
  {icon:'heart',  col:'#E0708A',t:'Know if you\'ll like it',d:'A personal match for every bottle, worked out from your own scores, not critics\'.'},
  {icon:'brain',  col:'#7FA7E0',t:'Your WineDNA',d:'Learns what you actually love (styles, grapes, regions, price) and gets sharper with every bottle.'},
  {icon:'book',   col:'#6FCB9A',t:'A learning path that\'s yours',d:'Articles written from your own wines, quizzes that unlock with every new grape and region you drink, and short guides to tasting, ordering and food. Mastery shows how far you\'ve come.'},
  {icon:'message',col:'#F08C6A',t:'Ask Vinny anything',d:'Your trusted wine assistant, ready for any question, from what to pour with tonight\'s lamb to why you keep picking Grenache. Vinny answers from your own WineDNA.'},
  {icon:'bolt',   col:'#E8B04A',t:'Train your palate',d:'Blind Call: guess what\'s in the glass before you look, and watch your calls get better.'},
  {icon:'fork',   col:'#C9A0E0',t:'Order with confidence',d:'Scan a wine list for your best bets, and get a few lines to say to the sommelier.'},
  {icon:'cart',   col:'#8FD0D0',t:'Spend smarter',d:'Real shop prices where you live, and which bottles are good value for you.'},
];
const _WELCOME_STEPS=[
  {when:'Today',t:'Your first bottle\'s story, what to look for, and its grape and region quizzes unlocked.'},
  {when:'After 3 scores',t:'Your personal match switches on for that kind of wine.'},
  {when:'Every bottle after',t:'Your WineDNA sharpens (what you love, your price sweet spot, a sommelier script) and your learning path grows with new articles and quizzes written around your wines.'},
];

function WelcomeScreen({next}){
  const dim='rgba(255,255,255,0.55)';
  return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:150,background:`${C.cr}22`,pointerEvents:'none'}}></div>
      <div style={{position:'absolute',bottom:120,left:-60,width:200,height:200,borderRadius:100,background:`${C.cr}12`,pointerEvents:'none'}}></div>

      <div style={{flex:1,overflowY:'auto',padding:'calc(env(safe-area-inset-top) + 24px) 24px 16px',position:'relative',zIndex:1}}>
        <img src="logo.png" alt="Vinterest" style={{height:30,width:'auto',display:'block',marginBottom:28,filter:'invert(1) brightness(2)'}}/>
        <div style={{fontSize:32,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-1px',lineHeight:1.1,marginBottom:12}}>Welcome to<br/>Vinterest.</div>
        <div style={{fontSize:16,color:dim,fontFamily:C.P,lineHeight:1.55,marginBottom:28}}>Your own wine guide. It learns your taste from the bottles you scan and score, and takes the guesswork out of choosing.</div>

        <div style={{display:'flex',flexDirection:'column',gap:16,marginBottom:30}}>
          {_WELCOME_FEATS.map((f,i)=>(
            <div key={i} style={{display:'flex',gap:14,alignItems:'flex-start'}}>
              <div style={{width:42,height:42,borderRadius:12,background:'rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={f.icon} sz={20} col={f.col}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:2}}>{f.t}</div>
                <div style={{fontSize:14,color:dim,fontFamily:C.P,lineHeight:1.45}}>{f.d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Why to stick with it: the match and WineDNA are earned, bottle by bottle. */}
        <div style={{padding:'16px 16px 6px',borderRadius:16,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#E0708A',fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:12}}>It gets better with every bottle</div>
          {_WELCOME_STEPS.map((s,i)=>(
            <div key={i} style={{display:'flex',gap:12,paddingBottom:14}}>
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                <div style={{width:10,height:10,borderRadius:5,background:i===0?C.cr:'rgba(255,255,255,0.35)',marginTop:5}}/>
                {i<_WELCOME_STEPS.length-1&&<div style={{width:2,flex:1,background:'rgba(255,255,255,0.12)',marginTop:4}}/>}
              </div>
              <div>
                <div style={{fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P}}>{s.when}</div>
                <div style={{fontSize:14,color:dim,fontFamily:C.P,lineHeight:1.45}}>{s.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{padding:'12px 24px calc(env(safe-area-inset-bottom) + 28px)',position:'relative',zIndex:1,flexShrink:0}}>
        <div onClick={next} role="button" style={{background:C.cr,borderRadius:16,padding:'17px',textAlign:'center',cursor:'pointer',boxShadow:`0 10px 40px ${C.cr}55`,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <Icon n="camera" sz={20} col="#fff"/>
          <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Scan your first bottle</span>
        </div>
        <div style={{textAlign:'center',marginTop:12}}>
          <span style={{fontSize:14,color:'rgba(255,255,255,0.45)',fontFamily:C.P}}>No account needed. Takes about a minute.</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{WelcomeScreen});
