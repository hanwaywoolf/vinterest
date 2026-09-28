/* Vinterest — New User Flow: the welcome screen.
   Four tiles to swipe through, three features each, grouped by what they're for: wine that fits
   you, learning, the shop and the table, and a last tile that sets the expectation it gets better
   with every bottle (so people stay while their match and WineDNA build). Then one action: scan
   your first bottle. Skip jumps to that last tile. The age and location step comes next.
   A returning user signs in from any tile instead (WelcomeSignIn): their account brings back
   their wines and settings, and if they'd finished onboarding before they go straight to Home. */

const _WELCOME_TILES=[
  {kicker:'Welcome to Vinterest',t:'Wine that fits you',items:[
    {icon:'heart',  col:'#E0708A',t:'Know if you\'ll like it',d:'A match for every bottle, from your own scores, not critics\'.'},
    {icon:'brain',  col:'#7FA7E0',t:'Your WineDNA',d:'Learns the styles, grapes, regions and prices you love.'},
    {icon:'message',col:'#F08C6A',t:'Ask Vinny',d:'Any wine question, answered from your own taste.'},
  ]},
  {t:'Learn as you drink',items:[
    {icon:'book',   col:'#6FCB9A',t:'Articles written for you',d:'Built around the bottles you\'ve tried, plus short guides to tasting, ordering and food.'},
    {icon:'check',  col:'#8FD0D0',t:'Quizzes that follow your scans',d:'Each new grape and region you drink opens its own quiz.'},
    {icon:'bolt',   col:'#E8B04A',t:'Train your palate',d:'Blind Call: guess what\'s in the glass, then see how close you got.'},
  ]},
  {t:'In the shop and at the table',items:[
    {icon:'scan',   col:'#C9A0E0',t:'Scan any bottle, or a wine list',pro:true,d:'Get the story of the wine and how it suits you.'},
    {icon:'fork',   col:'#F08C6A',t:'Order with confidence',d:'Your best bets on the list, and what to say to the sommelier.'},
    {icon:'cart',   col:'#6FCB9A',t:'Spend smarter',d:'Real shop prices where you live, and which bottles are good value for you.'},
  ]},
  {t:'It gets better with every bottle',steps:[
    {when:'Today',d:'Your first bottle\'s story, and its grape and region quizzes.'},
    {when:'After 3 scores',d:'Your personal match switches on for that kind of wine.'},
    {when:'Every bottle after',d:'Your WineDNA sharpens, and more gets written for you.'},
  ]},
];

const _WELCOME_DIM='rgba(255,255,255,0.62)';

function _WelcomeTile({tile,k,tileRef}){
  const z=n=>Math.round(n*k);
  return <div ref={tileRef} style={{flex:'0 0 100%',width:'100%',height:'100%',scrollSnapAlign:'start',overflowY:'auto',boxSizing:'border-box',padding:'8px 28px 12px',display:'flex',flexDirection:'column'}}>
    {tile.kicker&&<div style={{fontSize:z(15),fontWeight:700,color:'#E0708A',fontFamily:C.P,marginBottom:6}}>{tile.kicker}</div>}
    <div style={{fontSize:z(30),fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',lineHeight:1.12}}>{tile.t}</div>
    {/* The three features share the rest of the height, so the tile fills the screen on any phone. */}
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-evenly',gap:z(18),paddingTop:z(18)}}>
      {tile.items&&tile.items.map((f,i)=>(
        <div key={i} style={{display:'flex',gap:z(16),alignItems:'flex-start'}}>
          <div style={{width:z(54),height:z(54),borderRadius:z(16),background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Icon n={f.icon} sz={z(26)} col={f.col}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:z(19),fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.25,marginBottom:4}}>
              {f.t}{f.pro&&<span style={{display:'inline-block',marginLeft:8,padding:'1px 8px',borderRadius:10,background:'linear-gradient(135deg,#9B5E00,#C4870A)',fontSize:12,fontWeight:700,verticalAlign:'middle'}}>Pro</span>}
            </div>
            <div style={{fontSize:z(16),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45}}>{f.d}</div>
          </div>
        </div>
      ))}
      {tile.steps&&tile.steps.map((s,i)=>(
        <div key={i} style={{display:'flex',gap:z(16),flex:1,minHeight:0}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:24}}>
            <div style={{width:18,height:18,borderRadius:9,background:i===0?C.cr:'rgba(255,255,255,0.3)',border:i===0?'3px solid rgba(255,255,255,0.25)':'none',boxSizing:'border-box',marginTop:4}}/>
            {i<tile.steps.length-1&&<div style={{width:2,flex:1,background:'rgba(255,255,255,0.14)',marginTop:6}}/>}
          </div>
          <div style={{paddingBottom:10}}>
            <div style={{fontSize:z(19),fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:4}}>{s.when}</div>
            <div style={{fontSize:z(16),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45}}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>
  </div>;
}

function WelcomeScreen({next,returning}){
  const [page,setPage]=React.useState(0);
  const [signIn,setSignIn]=React.useState(false);
  const track=React.useRef(null);
  const last=_WELCOME_TILES.length-1;
  // While Next, Skip or a dot is scrolling to a tile, the scroll position passes through the
  // tiles in between; don't let those take over the page (quick taps would otherwise lose a step).
  const target=React.useRef(null);
  function goTo(i){
    const el=track.current; if(!el) return;
    target.current=i; clearTimeout(target.t); target.t=setTimeout(()=>{ target.current=null; },800);
    el.scrollTo({left:i*el.clientWidth,behavior:'smooth'});
    setPage(i);
  }
  function onScroll(){
    const el=track.current; if(!el||!el.clientWidth) return;
    const i=Math.round(el.scrollLeft/el.clientWidth);
    if(target.current!=null){ if(i===target.current&&Math.abs(el.scrollLeft-i*el.clientWidth)<2) target.current=null; return; }
    if(i!==page) setPage(i);
  }
  // One text size for all four tiles: the normal size, stepped down together (never below 80%)
  // until every tile fits this screen without scrolling, so a small phone at Extra large text
  // doesn't cut the third feature off. A tall phone spreads the features out instead.
  const [k,setK]=React.useState(1);
  const tiles=React.useRef([]);
  React.useLayoutEffect(()=>{
    if(signIn) return;
    const over=tiles.current.some(el=>el&&el.scrollHeight>el.clientHeight+1);
    if(over&&k>0.8) setK(x=>Math.max(0.8,Math.round((x-0.05)*100)/100));
  });
  React.useEffect(()=>{ const h=()=>setK(1); window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h); },[]);
  if(signIn) return <WelcomeSignIn onBack={()=>setSignIn(false)} onNew={next} onReturning={returning}/>;

  return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:150,background:`${C.cr}22`,pointerEvents:'none'}}></div>
      <div style={{position:'absolute',bottom:120,left:-60,width:200,height:200,borderRadius:100,background:`${C.cr}12`,pointerEvents:'none'}}></div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top) + 18px) 28px 10px',position:'relative',zIndex:1,flexShrink:0}}>
        <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block',filter:'invert(1) brightness(2)'}}/>
        {/* Skip stays in the layout on the last tile (hidden), so the logo doesn't move. */}
        {<span role="button" aria-hidden={page>=last} onClick={()=>page<last&&goTo(last)} style={{visibility:page<last?'visible':'hidden',fontSize:15,fontWeight:600,color:_WELCOME_DIM,fontFamily:C.P,cursor:'pointer',padding:'6px 0 6px 12px'}}>Skip</span>}
      </div>

      <div ref={track} onScroll={onScroll} aria-roledescription="carousel"
        style={{flex:1,minHeight:0,display:'flex',overflowX:'auto',overflowY:'hidden',scrollSnapType:'x mandatory',scrollbarWidth:'none',position:'relative',zIndex:1}}>
        {_WELCOME_TILES.map((tile,i)=><_WelcomeTile key={i} tile={tile} k={k} tileRef={el=>{tiles.current[i]=el;}}/>)}
      </div>

      <div style={{padding:'10px 28px calc(env(safe-area-inset-bottom) + 20px)',position:'relative',zIndex:1,flexShrink:0}}>
        <div style={{display:'flex',justifyContent:'center',gap:8,marginBottom:16}}>
          {_WELCOME_TILES.map((_,i)=>(
            <span key={i} role="button" aria-label={`Page ${i+1} of ${_WELCOME_TILES.length}`} onClick={()=>goTo(i)}
              style={{width:i===page?24:8,height:8,borderRadius:4,background:i===page?'#fff':'rgba(255,255,255,0.3)',cursor:'pointer',transition:'width .2s'}}/>
          ))}
        </div>
        {page<last
          ?<div onClick={()=>goTo(page+1)} role="button" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:16,padding:'16px',textAlign:'center',cursor:'pointer'}}>
            <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Next</span>
          </div>
          :<div onClick={next} role="button" style={{background:C.cr,borderRadius:16,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 10px 40px ${C.cr}55`,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <Icon n="camera" sz={20} col="#fff"/>
            <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>Scan your first bottle</span>
          </div>}
        {Account.available()&&<div style={{textAlign:'center',marginTop:14}}>
          <span style={{fontSize:15,color:_WELCOME_DIM,fontFamily:C.P}}>Already have an account? </span>
          <span role="button" onClick={()=>setSignIn(true)} style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>Sign in</span>
        </div>}
      </div>
    </div>
  );
}

/* Sign-in for someone who's used Vinterest before: the same emailed 6-digit code as on Profile
   (Account), then their account's data comes down (Sync.welcomeBack). Finished onboarding before:
   straight to Home. A new or unfinished account carries on with onboarding, signed in. */
function WelcomeSignIn({onBack,onNew,onReturning}){
  const [step,setStep]=React.useState('email'); // email | code | restoring | offline
  const [email,setEmail]=React.useState('');
  const [code,setCode]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [err,setErr]=React.useState('');
  const box={width:'100%',boxSizing:'border-box',padding:'14px 16px',borderRadius:14,border:'1.5px solid rgba(255,255,255,0.2)',fontSize:17,fontFamily:C.P,color:'#fff',background:'rgba(255,255,255,0.06)',outline:'none'};
  const primary={background:C.cr,borderRadius:16,padding:'16px',textAlign:'center',cursor:busy?'default':'pointer',opacity:busy?0.6:1,fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P};
  const link={fontSize:15,fontWeight:600,color:'#fff',fontFamily:C.P,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3};

  async function send(){
    if(busy) return; setBusy(true); setErr('');
    const r=await Account.requestCode(email); setBusy(false);
    if(r.ok){ setStep('code'); setCode(''); } else setErr(r.error);
  }
  async function restore(){
    setStep('restoring'); setErr('');
    const r=await Sync.welcomeBack();
    if(!r.ok) return setStep('offline');
    r.returning?onReturning():onNew();
  }
  async function verify(){
    if(busy) return; setBusy(true); setErr('');
    const r=await Account.verifyCode(email,code); setBusy(false);
    if(r.ok) restore(); else setErr(r.error);
  }

  return <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',overflow:'hidden'}}>
    <div style={{padding:'calc(env(safe-area-inset-top) + 18px) 28px 10px',flexShrink:0}}>
      {(step==='email'||step==='code')&&<div onClick={onBack} role="button" aria-label="Back" style={{width:38,height:38,borderRadius:19,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
        <Icon n="back" sz={18} col="#fff"/>
      </div>}
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'12px 28px calc(env(safe-area-inset-bottom) + 24px)',display:'flex',flexDirection:'column',gap:14}}>
      {step==='email'&&<>
        <div style={{fontSize:30,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',lineHeight:1.12}}>Welcome back</div>
        <div style={{fontSize:16,color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.5}}>Sign in and your wines, WineDNA and progress come back to this phone.</div>
        <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label="Email address" value={email}
          onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send(); }} style={box}/>
        <div onClick={send} role="button" style={primary}>{busy?'Sending…':'Email me a code'}</div>
        <div style={{fontSize:15,color:_WELCOME_DIM,fontFamily:C.P}}>No password: we email a 6-digit code to type in here.</div>
      </>}
      {step==='code'&&<>
        <div style={{fontSize:30,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',lineHeight:1.12}}>Check your email</div>
        <div style={{fontSize:16,color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.5}}>We sent a code to <b style={{color:'#fff'}}>{email.trim()}</b>. It can take a minute; check spam too.</div>
        <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" aria-label="Sign-in code" value={code}
          onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{ if(e.key==='Enter') verify(); }} style={{...box,letterSpacing:4,fontSize:22,textAlign:'center'}}/>
        <div onClick={verify} role="button" style={primary}>{busy?'Checking…':'Sign in'}</div>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span onClick={send} style={link}>Send a new code</span>
          <span onClick={()=>{setStep('email');setErr('');}} style={link}>Different email</span>
        </div>
      </>}
      {step==='restoring'&&<div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,textAlign:'center'}}>
        <div style={{width:36,height:36,borderRadius:18,border:'3px solid rgba(255,255,255,0.18)',borderTopColor:C.cr,animation:'spin .8s linear infinite'}}/>
        <div style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:C.P}}>Bringing back your wines…</div>
      </div>}
      {step==='offline'&&<div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',gap:14}}>
        <div style={{fontSize:24,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2}}>We couldn't reach your account just now</div>
        <div style={{fontSize:16,color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.5}}>You're signed in. Try again, or carry on: your wines will arrive the next time the app reaches your account.</div>
        <div onClick={restore} role="button" style={primary}>Try again</div>
        <span onClick={onNew} role="button" style={{...link,alignSelf:'center'}}>Continue without them for now</span>
      </div>}
      {err&&<div role="alert" style={{fontSize:15,color:'#F0A090',fontFamily:C.P}}>{err}</div>}
    </div>
  </div>;
}

Object.assign(window,{WelcomeScreen,WelcomeSignIn});
