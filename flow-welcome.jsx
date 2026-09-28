/* Vinterest — New User Flow: the welcome screen.
   Five slides to swipe through. The first four each show one thing the app does, with a preview
   of the real screen that does it (the scan result, WineDNA, Vinny, a Written for you piece and
   the mastery map); the fifth sets the expectation that it gets better with every bottle (so
   people stay while their match and WineDNA build). Then one action: scan your first bottle.
   Skip jumps to that last slide. The age and location step comes next.
   The previews are the app's own components (MatchRing, MatchReasons, WineIdentity, DnaTitle,
   DnaFacts, DnaTasteCard, VinnyAnswers, ShelfCard, MasteryAreaCard) fed one imaginary user from
   data/onboarding-sample.json: what the app's engines really produced for that user, captured by
   scripts/onboarding-sample.mjs. They're pictures, not controls: nothing in them can be tapped or
   focused, and they never read the reader's own wines or call anything.
   A returning user signs in from any slide instead (WelcomeSignIn): their account brings back
   their wines and settings, and if they'd finished onboarding before they go straight to Home. */

const _WELCOME_SAMPLE=_loadJSON('data/onboarding-sample.json');

const _WELCOME_TILES=[
  {t:'Scan a bottle. Know if it\'s for you.',d:'Point your camera at any label. You get a match built on your own taste, and the reasons why.',preview:'match'},
  {t:'Every bottle builds your WineDNA',d:'Your scores add up to a profile of the grapes, regions, styles and prices you love. It remembers everything you\'ve tried, so you don\'t have to.',preview:'dna'},
  {t:'The right wine, wherever you\'re buying',d:'In the shop, at the restaurant or browsing online, scan and your match tells you if it\'s for you. Got a quick question? Ask Vinny. His answers come from your WineDNA.',preview:'vinny'},
  {t:'Find out why you like what you like',d:'Articles written for you, from your WineDNA and history, on the grapes and regions behind your favourites and the ones worth trying next. Quizzes make it stick, and your mastery map shows how far you\'ve come.',preview:'learn'},
  {t:'It gets better with every bottle',steps:[
    {when:'First bottle',d:'Its story, its quizzes, and the start of your WineDNA.'},
    {when:'After 3 reds',d:'Your red matches switch on. The same goes for every other type you drink.'},
    {when:'Every bottle after',d:'Sharper matches, more written for you, and a Vinny who knows you better.'},
  ]},
];

const _WELCOME_DIM='rgba(255,255,255,0.62)';
const _WELCOME_PREVIEW_MIN=0.65; // smallest a preview is shown; smaller than this it's cropped instead

/* The sample user's screens, as the app draws them, and a sentence saying what each shows. */
function _welcomePreview(kind){
  const S=_WELCOME_SAMPLE.slides, U=_WELCOME_SAMPLE.user;
  if(kind==='match'){
    const m=S.match, w=U.scanned, col=_TONE_COL[m.tone];
    const [pro,con]=m.reasons;
    return {alt:`Example scan result: ${w.producer} ${w.name} ${w.vintage}, a ${m.pct}% match, "${m.label}". For it: ${pro.text} Against it: ${con.text}`,
      el:<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Card style={{padding:16}}><WineIdentity wine={w}/></Card>
        <Card style={{padding:16}}>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <MatchRing match={m}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:20,fontWeight:800,color:col,fontFamily:C.P,lineHeight:1.2}}>{m.label}</div>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3}}>Likely {m.expectedLabel} for you</div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>You've loved {m.chance}% of wines like it</div>
            </div>
          </div>
          <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.line}`}}><MatchReasons match={m} showSummary={false}/></div>
        </Card>
      </div>};
  }
  if(kind==='dna'){
    const d=S.dna;
    const t={...d,col:(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS.red)||C.cr,loved:{length:d.lovedCount},axes:d.axes,showAxis:k=>d.axes.includes(k)};
    const tLabel=d.label.toLowerCase();
    return {alt:`Example WineDNA for reds: "${d.personality}", based on ${d.lovedCount} Outstanding reds. ${d.chips.map(c=>`${c.label}: ${c.value}`).join('. ')}. ${d.confidence.n} scored, ${d.confidence.next||'a strong read'}.`,
      el:<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Card style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
          <DnaTitle t={t} basisLine={`Based on your ${d.lovedCount} Outstanding (90+) ${tLabel}`}/>
          <DnaFacts t={t} chips={d.chips} conf={d.confidence}/>
        </Card>
        <DnaTasteCard t={t} tLabel={tLabel} notes={false}/>
      </div>};
  }
  if(kind==='vinny'){
    const v=S.vinny[0];
    return {alt:`Example question to Vinny: "${v.q}" Vinny's answer: "${v.a}"`,el:<VinnyAnswers turns={S.vinny} style={{marginTop:0}}/>};
  }
  const st=S.article, a=S.mastery;
  return {alt:`Example article written for you: "${st.title}", ${st.because.toLowerCase()}. Below it, the Grapes part of the mastery map: ${a.items.map(i=>`${i.name} ${i.score}%`).join(', ')}.`,
    el:<div style={{display:'flex',flexDirection:'column',gap:10}}>
      <ShelfCard stub={st} because={st.because}/>
      <MasteryAreaCard a={a} open/>
    </div>};
}

/* A preview fills the space the slide leaves it: drawn at a phone's width, then scaled down (never
   up) so all of it shows. Display only: no taps, no focus, and screen readers get its sentence. */
function _WelcomePreview({kind}){
  const {alt,el}=React.useMemo(()=>_welcomePreview(kind),[kind]);
  const box=React.useRef(null), stage=React.useRef(null);
  const [fit,setFit]=React.useState({s:1,w:0});
  React.useLayoutEffect(()=>{
    const b=box.current, g=stage.current; if(!b||!g) return;
    // Drawn wider, the preview wraps less and gets shorter but must shrink more to fit across:
    // try a few widths and keep the one that shows it largest.
    const measure=()=>{
      const bw=b.clientWidth, H=b.clientHeight; if(!bw||!H) return;
      const prev=g.style.width; let best={s:0,w:bw};
      for(const f of [1,1.1,1.2,1.35,1.5]){
        const W=Math.round(bw*f); g.style.width=W+'px';
        const s=Math.min(1,H/g.scrollHeight,bw/W);
        if(s>best.s+0.01) best={s,w:W};
      }
      g.style.width=prev;
      // Never so small it can't be read: below MIN it stays at MIN and is cropped at the bottom.
      const out=best.s<_WELCOME_PREVIEW_MIN?{s:_WELCOME_PREVIEW_MIN,w:Math.round(bw/_WELCOME_PREVIEW_MIN),crop:true}:best;
      setFit(f=>Math.abs(f.s-out.s)<0.005&&f.w===out.w&&!!f.crop===!!out.crop?f:out);
    };
    measure();
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;
    if(ro) ro.observe(b);
    return()=>ro&&ro.disconnect();
  },[]);
  const fade='linear-gradient(to bottom,#000 78%,transparent)';
  return <div ref={box} role="img" aria-label={alt} data-cropped={fit.crop?'true':undefined}
    style={{flex:1,minHeight:0,position:'relative',overflow:'hidden',...(fit.crop?{WebkitMaskImage:fade,maskImage:fade}:null)}}>
    <div ref={stage} aria-hidden="true" inert="" style={{position:'absolute',top:fit.crop?0:'50%',left:'50%',width:fit.w||'100%',
      transform:fit.crop?`translateX(-50%) scale(${fit.s})`:`translate(-50%,-50%) scale(${fit.s})`,transformOrigin:fit.crop?'top center':'center center',pointerEvents:'none',userSelect:'none'}}>
      <div style={{background:C.bg,borderRadius:22,padding:12,border:'1px solid rgba(255,255,255,0.08)'}}>{el}</div>
    </div>
  </div>;
}

function _WelcomeTile({tile,k,tileRef}){
  // Set sizes (px strings, which the reader's text-size setting leaves alone): the slides are
  // designed as a whole, so they look the same for everyone, shrunk together only to fit (k).
  const z=n=>Math.round(n*k)+'px';
  return <div ref={tileRef} style={{flex:'0 0 100%',width:'100%',height:'100%',scrollSnapAlign:'start',overflowY:'auto',boxSizing:'border-box',padding:'8px 24px 12px',display:'flex',flexDirection:'column'}}>
    <div style={{fontSize:z(tile.preview?26:28),fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',lineHeight:1.12}}>{tile.t}</div>
    {tile.d&&<div style={{fontSize:z(15),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45,marginTop:Math.round(8*k)}}>{tile.d}</div>}
    {tile.preview&&<div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',paddingTop:Math.round(16*k)}}><_WelcomePreview kind={tile.preview}/></div>}
    {tile.steps&&<div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-evenly',gap:Math.round(18*k),paddingTop:Math.round(18*k)}}>
      {tile.steps.map((s,i)=>(
        <div key={i} style={{display:'flex',gap:Math.round(16*k),flex:1,minHeight:0}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:24}}>
            <div style={{width:18,height:18,borderRadius:9,background:i===0?C.cr:'rgba(255,255,255,0.3)',border:i===0?'3px solid rgba(255,255,255,0.25)':'none',boxSizing:'border-box',marginTop:4}}/>
            {i<tile.steps.length-1&&<div style={{width:2,flex:1,background:'rgba(255,255,255,0.14)',marginTop:6}}/>}
          </div>
          <div style={{paddingBottom:10}}>
            <div style={{fontSize:z(18),fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:4}}>{s.when}</div>
            <div style={{fontSize:z(15),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45}}>{s.d}</div>
          </div>
        </div>
      ))}
    </div>}
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
  // One size for all the slides' text: their set size, stepped down together (never below 80%) until
  // every tile fits this screen without scrolling. A tall phone spreads the features out instead.
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
        {<span role="button" aria-hidden={page>=last} onClick={()=>page<last&&goTo(last)} style={{visibility:page<last?'visible':'hidden',fontSize:'15px',fontWeight:600,color:_WELCOME_DIM,fontFamily:C.P,cursor:'pointer',padding:'6px 0 6px 12px'}}>Skip</span>}
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
            <span style={{fontSize:'17px',fontWeight:700,color:'#fff',fontFamily:C.P}}>Next</span>
          </div>
          :<div onClick={next} role="button" style={{background:C.cr,borderRadius:16,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 10px 40px ${C.cr}55`,display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
            <Icon n="camera" sz={20} col="#fff"/>
            <span style={{fontSize:'17px',fontWeight:700,color:'#fff',fontFamily:C.P}}>Scan your first bottle</span>
          </div>}
        {Account.available()&&<div style={{textAlign:'center',marginTop:14}}>
          <span style={{fontSize:'15px',color:_WELCOME_DIM,fontFamily:C.P}}>Already have an account? </span>
          <span role="button" onClick={()=>setSignIn(true)} style={{fontSize:'15px',fontWeight:700,color:'#fff',fontFamily:C.P,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>Sign in</span>
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
