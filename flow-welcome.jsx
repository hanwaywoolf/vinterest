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
  {t:'Scan a bottle. Know if it\'s for you.',d:'Point your camera at any label or wine list. You get a match built on your own taste, and the reasons why.',preview:'match'},
  {t:'Every bottle builds your WineDNA.',d:'Your scores add up to a profile of the grapes, regions, styles and prices you love. It remembers everything you\'ve tried, so you don\'t have to.',preview:'dna'},
  {t:'The right wine, wherever you\'re buying.',d:'In the shop, at the restaurant or browsing online, scan and your match tells you if it\'s for you. Got a quick question? Ask Vinny. His answers come from your WineDNA.',preview:'vinny'},
  {t:'Find out why you like what you like.',d:'Articles written for you, from your WineDNA and history, on the grapes and regions behind your favourites and the ones worth trying next. Quizzes make it stick, and your mastery map shows how far you\'ve come.',preview:'learn'},
  {t:'It gets better with every bottle.',steps:[
    {when:'First bottle',d:'Its story, its quizzes, and the start of your WineDNA.'},
    {when:'After 3 reds',d:'Your red matches switch on. The same goes for every other type you drink.'},
    {when:'Every bottle after',d:'Sharper matches, more written for you, and a Vinny who knows you better.'},
  ]},
];

const _WELCOME_DIM='rgba(255,255,255,0.62)';
const _WELCOME_PREVIEW_MIN=0.65; // smallest a preview is shown; smaller than this it's cropped instead

/* Motion: each preview plays when its slide arrives (and again if they come back), showing how
   the screen comes alive; reduced motion skips straight to the finished screen. The CSS moves only
   what's already laid out (bars growing, rows fading in), so a preview never changes size. */
const _WELCOME_CSS=`
@keyframes wpGrow{from{transform:scaleX(0)}}
@keyframes wpIn{from{opacity:0;transform:translateY(8px)}}
@keyframes wpDot{0%,55%{opacity:0;transform:scale(.3)}}
@keyframes wpPan{0%,18%{transform:translateY(0)}55%,72%{transform:translateY(var(--wp-pan))}100%{transform:translateY(0)}}
@keyframes wpCaret{50%{opacity:0}}
.wp-run .dna-fill,.wp-run .mastery-fill{transform-origin:left center;animation:wpGrow .9s cubic-bezier(.3,.9,.4,1) both}
.wp-run .dna-dot{animation:wpDot 1.2s ease both}
.wp-run .wp-in{animation:wpIn .5s ease both}
.wp-run .wp-reasons>div>div{animation:wpIn .5s ease both}
.wp-run .wp-reasons>div>div:nth-child(1){animation-delay:1.25s}
.wp-run .wp-reasons>div>div:nth-child(2){animation-delay:1.75s}
.wp-pan{animation:wpPan 7s ease-in-out 1.4s both}
.wp-caret{display:inline-block;width:2px;height:1em;background:#fff;margin-left:2px;vertical-align:-2px;animation:wpCaret .8s step-end infinite}
@media (prefers-reduced-motion: reduce){.wp-stage *{animation:none!important;transition:none!important}}
`;
function _reducedMotion(){ try{ return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } }

/* Counts from 0 to n over ms once mounted (n straight away with reduced motion). */
function _useCount(n,ms,delay=0){
  const [v,setV]=React.useState(()=>_reducedMotion()?n:0);
  React.useEffect(()=>{
    if(_reducedMotion()) return setV(n);
    let raf, t0=null;
    const step=t=>{ if(t0==null) t0=t+delay; const k=Math.max(0,Math.min(1,(t-t0)/ms)); setV(Math.round(n*(1-Math.pow(1-k,3)))); if(k<1) raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[n,ms,delay]);
  return v;
}

function _PreviewMatch(){
  const S=_WELCOME_SAMPLE.slides, m=S.match, w=_WELCOME_SAMPLE.user.scanned, col=_TONE_COL[m.tone];
  const pct=_useCount(m.pct,1100,150);
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <Card style={{padding:16}}><WineIdentity wine={w}/></Card>
    <Card style={{padding:16}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <MatchRing match={{...m,pct}}/>
        <div className="wp-in" style={{flex:1,minWidth:0,animationDelay:'.9s'}}>
          <div style={{fontSize:20,fontWeight:800,color:col,fontFamily:C.P,lineHeight:1.2}}>{m.label}</div>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:3}}>Likely {m.expectedLabel} for you</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:2}}>You've loved {m.chance}% of wines like it</div>
        </div>
      </div>
      <div className="wp-reasons" style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${C.line}`}}><MatchReasons match={m} showSummary={false}/></div>
    </Card>
  </div>;
}

function _dnaTab(){
  const d=_WELCOME_SAMPLE.slides.dna;
  return {d,tLabel:d.label.toLowerCase(),t:{...d,col:(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS.red)||C.cr,loved:{length:d.lovedCount},axes:d.axes,showAxis:k=>d.axes.includes(k)}};
}
function _DnaSummary({style}){
  const {d,t,tLabel}=_dnaTab();
  return <div className="wp-in" style={style}><Card style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
    <DnaTitle t={t} basisLine={`Based on your ${d.lovedCount} Outstanding (90+) ${tLabel}`}/>
    <DnaFacts t={t} chips={d.chips} conf={d.confidence}/>
  </Card></div>;
}
function _PreviewDna(){
  const {t,tLabel}=_dnaTab();
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <_DnaSummary/>
    <div className="wp-dna-bars"><DnaTasteCard t={t} tLabel={tLabel} notes={false}/></div>
  </div>;
}

/* Vinny, as on Home: the sample user's Home screen (onboarding-home.jpg, captured by the
   generator from the real app) faded behind the real Ask Vinny bar (VinnyBar) and answer card
   (VinnyAnswers). The question types into the bar, the arrow lights, it sends (the bar empties to
   "Ask a follow-up…" as it does in the app), "Thinking…", then the answer types out. Everything is
   laid out from the start, invisible, so nothing moves or grows while it plays. */
const _VINNY_TIMING={start:500,qPerChar:42,beforeSend:450,thinking:900,aPerChar:14};
function _PreviewVinny(){
  const v=_WELCOME_SAMPLE.slides.vinny[0], T=_VINNY_TIMING;
  const still=_reducedMotion();
  const sendAt=T.start+v.q.length*T.qPerChar+T.beforeSend, answerAt=sendAt+T.thinking;
  const [ms,setMs]=React.useState(still?1e9:0);
  React.useEffect(()=>{
    if(still) return;
    let raf, t0=null; const end=answerAt+v.a.length*T.aPerChar+100;
    const step=t=>{ if(t0==null) t0=t; const e=t-t0; setMs(e); if(e<end) raf=requestAnimationFrame(step); };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[]);
  const sent=ms>=sendAt, typedQ=sent?'':v.q.slice(0,Math.max(0,Math.floor((ms-T.start)/T.qPerChar)));
  const nA=ms<answerAt?0:Math.min(v.a.length,Math.floor((ms-answerAt)/T.aPerChar));
  const dim='rgba(255,255,255,0.5)';
  const field=<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',overflow:'hidden'}}>
    <span style={{fontSize:16,fontFamily:C.P,color:typedQ?'#fff':dim,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
      {typedQ||(sent?'Ask a follow-up…':'Ask Vinny about wine…')}{!sent&&typedQ&&<span className="wp-caret"/>}
    </span>
  </div>;
  const full=<span style={{opacity:0}}>{v.a}</span>;
  const a=!sent?full
    :ms<answerAt?<span style={{position:'relative',display:'block'}}>{full}<span style={{position:'absolute',left:0,top:0,fontSize:15,fontStyle:'italic',color:'rgba(255,255,255,0.7)'}}>Thinking…</span></span>
    :<>{v.a.slice(0,nA)}{nA<v.a.length&&<span className="wp-caret"/>}<span style={{opacity:0}}>{v.a.slice(nA)}</span></>;
  return <div style={{position:'relative',width:390,borderRadius:26,overflow:'hidden',background:C.bg,border:'1px solid rgba(255,255,255,0.08)'}}>
    <img src="onboarding-home.jpg" alt="" style={{position:'absolute',top:0,left:0,width:'100%',height:'auto',opacity:0.32,filter:'blur(1px)'}}/>
    <div style={{position:'relative',padding:`62px 16px ${_WELCOME_SPARE.vinny}px`}}>
      <VinnyBar field={field} hasText={!!typedQ} canSend={false} lit={!!typedQ&&!sent}/>
      <div style={{opacity:sent?1:0,transform:sent?'none':'translateY(6px)',transition:'opacity .35s, transform .35s'}}>
        <VinnyAnswers turns={[{q:v.q,a}]}/>
      </div>
    </div>
  </div>;
}

function _PreviewLearn(){
  const st=_WELCOME_SAMPLE.slides.article, a=_WELCOME_SAMPLE.slides.mastery;
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    <div className="wp-in"><ShelfCard stub={st} because={st.because}/></div>
    <div className="wp-in" style={{animationDelay:'.35s'}}><MasteryAreaCard a={a} open/></div>
  </div>;
}

/* What each preview shows, said in a sentence for screen readers. */
function _welcomeAlt(kind){
  const S=_WELCOME_SAMPLE.slides, U=_WELCOME_SAMPLE.user;
  if(kind==='match'){ const m=S.match, w=U.scanned, [pro,con]=m.reasons;
    return `Example scan result: ${w.producer} ${w.name} ${w.vintage}, a ${m.pct}% match, "${m.label}". For it: ${pro.text} Against it: ${con.text}`; }
  if(kind==='dna'){ const d=S.dna;
    return `Example WineDNA for reds: "${d.personality}", based on ${d.lovedCount} Outstanding reds. ${d.chips.map(c=>`${c.label}: ${c.value}`).join('. ')}. ${d.confidence.n} scored, ${d.confidence.next||'a strong read'}.`; }
  if(kind==='vinny'){ const v=S.vinny[0];
    return `Example of asking Vinny from the Home screen. Question: "${v.q}" Vinny's answer, from this user's WineDNA: "${v.a}"`; }
  const st=S.article, a=S.mastery;
  return `Example article written for you: "${st.title}", ${st.because.toLowerCase()}. Below it, the Grapes part of the mastery map: ${a.items.map(i=>`${i.name} ${i.score}%`).join(', ')}.`;
}
const _WELCOME_PREVIEWS={match:_PreviewMatch,dna:_PreviewDna,vinny:_PreviewVinny,learn:_PreviewLearn};
// A preview drawn at a fixed width, in its own frame (the Vinny one lines up with its Home screenshot).
const _WELCOME_FRAMED={vinny:390};
// How much of a framed preview's bottom is only faded background, and may be cropped to fit.
const _WELCOME_SPARE={vinny:150};

/* A preview fills the space the slide leaves it: drawn at the width that shows it largest, then
   scaled down (never up) so all of it shows; below _WELCOME_PREVIEW_MIN it stays readable and is
   cropped instead, and scrolls down and back once so the rest is seen. Display only: no taps, no
   focus, and screen readers get its sentence. It plays each time its slide arrives (active). */
function _WelcomePreview({kind,active}){
  const alt=React.useMemo(()=>_welcomeAlt(kind),[kind]);
  const Body=_WELCOME_PREVIEWS[kind];
  const box=React.useRef(null), stage=React.useRef(null);
  const [fit,setFit]=React.useState({s:1,w:0});
  const [run,setRun]=React.useState(0);
  React.useEffect(()=>{ if(active) setRun(r=>r+1); },[active]);
  React.useLayoutEffect(()=>{
    const b=box.current, g=stage.current; if(!b||!g) return;
    // Drawn wider, the preview wraps less and gets shorter but must shrink more to fit across:
    // try a few widths and keep the one that shows it largest.
    const measure=()=>{
      const bw=b.clientWidth, H=b.clientHeight; if(!bw||!H) return;
      const prev=g.style.width; let best={s:0,w:bw};
      for(const f of (_WELCOME_FRAMED[kind]?[_WELCOME_FRAMED[kind]/bw]:[1,1.1,1.2,1.35,1.5])){
        const W=Math.round(bw*f); g.style.width=W+'px';
        const s=Math.min(1,H/g.scrollHeight,bw/W);
        if(s>best.s+0.01) best={s,w:W};
      }
      let out=best;
      // A framed preview is fitted to what matters (above its spare background), and loses only
      // background at the bottom if the whole of it doesn't fit.
      const spare=_WELCOME_SPARE[kind]||0;
      if(spare&&best.s<1){
        const W=_WELCOME_FRAMED[kind]; g.style.width=W+'px';
        const h=g.scrollHeight, s=Math.min(1,H/(h-spare+24),bw/W); // 24: room for the fade below the answer
        out={s,w:W,crop:H/h<s-0.001,pan:0};
      }
      // Never so small it can't be read: below MIN it stays at MIN and is cropped at the bottom.
      else if(best.s<_WELCOME_PREVIEW_MIN){
        const W=_WELCOME_FRAMED[kind]||Math.round(bw/_WELCOME_PREVIEW_MIN); g.style.width=W+'px';
        out={s:_WELCOME_PREVIEW_MIN,w:W,crop:true,pan:_WELCOME_FRAMED[kind]?0:Math.min(0,Math.round(H/_WELCOME_PREVIEW_MIN-g.scrollHeight))}; // a framed preview only loses faded background at the bottom: no scroll
      }
      g.style.width=prev;
      setFit(f=>Math.abs(f.s-out.s)<0.005&&f.w===out.w&&!!f.crop===!!out.crop&&f.pan===out.pan?f:out);
    };
    measure();
    const ro=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;
    if(ro) ro.observe(b);
    return()=>ro&&ro.disconnect();
  },[]);
  // A framed preview only loses spare background, so it fades over its last few pixels only.
  const fade=_WELCOME_FRAMED[kind]?'linear-gradient(to bottom,#000 calc(100% - 20px),transparent)':'linear-gradient(to bottom,transparent 0,#000 4%,#000 80%,transparent)';
  const playing=active&&run>0;
  return <div ref={box} role="img" aria-label={alt} data-cropped={fit.crop?'true':undefined}
    style={{flex:1,minHeight:0,position:'relative',overflow:'hidden',...(fit.crop?{WebkitMaskImage:fade,maskImage:fade}:null)}}>
    <div ref={stage} aria-hidden="true" inert="" className={'wp-stage'+(playing?' wp-run':'')} style={{position:'absolute',top:fit.crop?0:'50%',left:'50%',width:fit.w||'100%',
      transform:fit.crop?`translateX(-50%) scale(${fit.s})`:`translate(-50%,-50%) scale(${fit.s})`,transformOrigin:fit.crop?'top center':'center center',pointerEvents:'none',userSelect:'none'}}>
      <div key={run} className={fit.crop&&playing&&fit.pan<0?'wp-pan':''} style={{'--wp-pan':`${fit.pan||0}px`}}>
        {_WELCOME_FRAMED[kind]?<Body/>:<div style={{background:C.bg,borderRadius:22,padding:12,border:'1px solid rgba(255,255,255,0.08)'}}><Body/></div>}
      </div>
    </div>
  </div>;
}

/* The last slide's timeline. The red dot walks down it on arrival (first bottle, then after 3
   reds, then every bottle after), turning the line red behind it; with reduced motion it stays on
   the first step. */
function _WelcomeTimeline({steps,k,active}){
  const z=n=>Math.round(n*k)+'px';
  const [cur,setCur]=React.useState(0);
  React.useEffect(()=>{
    setCur(0);
    if(!active||_reducedMotion()) return;
    const ts=steps.slice(1).map((_,i)=>setTimeout(()=>setCur(i+1),700+i*1400));
    return()=>ts.forEach(clearTimeout);
  },[active]);
  return <div data-step={cur} style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-evenly',gap:Math.round(18*k),paddingTop:Math.round(18*k)}}>
    {steps.map((s,i)=>{
      const on=i===cur, past=i<cur;
      return <div key={i} style={{display:'flex',gap:Math.round(16*k),flex:1,minHeight:0}}>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:24}}>
          <div style={{width:18,height:18,borderRadius:9,background:on||past?C.cr:'rgba(255,255,255,0.3)',border:on?'3px solid rgba(255,255,255,0.25)':'none',
            boxShadow:on?`0 0 0 6px ${C.cr}33`:'none',boxSizing:'border-box',marginTop:4,transform:on?'scale(1.15)':'scale(1)',transition:'background .4s, box-shadow .4s, transform .4s'}}/>
          {i<steps.length-1&&<div style={{width:2,flex:1,background:'rgba(255,255,255,0.14)',marginTop:6,position:'relative',overflow:'hidden'}}>
            <div style={{position:'absolute',left:0,top:0,width:'100%',height:past?'100%':'0%',background:C.cr,transition:'height 1s ease'}}/>
          </div>}
        </div>
        <div style={{paddingBottom:10,opacity:on||past?1:0.6,transition:'opacity .4s'}}>
          <div style={{fontSize:z(18),fontWeight:700,color:'#fff',fontFamily:C.P,marginBottom:4}}>{s.when}</div>
          <div style={{fontSize:z(15),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45}}>{s.d}</div>
        </div>
      </div>;
    })}
  </div>;
}

function _WelcomeTile({tile,k,tileRef,active}){
  // Set sizes (px strings, which the reader's text-size setting leaves alone): the slides are
  // designed as a whole, so they look the same for everyone, shrunk together only to fit (k).
  const z=n=>Math.round(n*k)+'px';
  return <div ref={tileRef} style={{flex:'0 0 100%',width:'100%',height:'100%',overflowY:'auto',touchAction:'pan-y',boxSizing:'border-box',padding:'8px 24px 12px',display:'flex',flexDirection:'column'}}>
    <div style={{fontSize:z(tile.preview?26:28),fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.8px',lineHeight:1.12}}>{tile.t}</div>
    {tile.d&&<div style={{fontSize:z(15),color:_WELCOME_DIM,fontFamily:C.P,lineHeight:1.45,marginTop:Math.round(8*k)}}>{tile.d}</div>}
    {tile.preview&&<div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',paddingTop:Math.round(16*k)}}><_WelcomePreview kind={tile.preview} active={active}/></div>}
    {tile.steps&&<_WelcomeTimeline steps={tile.steps} k={k} active={active}/>}
  </div>;
}

function WelcomeScreen({next,returning}){
  const [page,setPage]=React.useState(0);
  const [signIn,setSignIn]=React.useState(false);
  const track=React.useRef(null);
  const last=_WELCOME_TILES.length-1;
  function goTo(i){
    const el=track.current; if(!el) return;
    el.scrollTo({left:i*el.clientWidth,behavior:'smooth'});
    setPage(i);
  }
  // Swiping is ours, not the browser's: the slides follow the finger (or mouse), and on release
  // move exactly one slide, however hard the flick, or settle back if it was too small. The
  // browser's own snap scrolling let one fast flick fly through every slide.
  const drag=React.useRef(null);
  const clampPage=i=>Math.max(0,Math.min(_WELCOME_TILES.length-1,i));
  // Which way it goes is decided by how far the slides actually moved and how fast the finger was
  // going at the end, never by the release event's position: a cancelled touch reports none.
  function onPointerDown(e){
    const el=track.current; if(!el||(e.pointerType==='mouse'&&e.button!==0)) return;
    drag.current={x:e.clientX,y:e.clientY,left:el.scrollLeft,id:e.pointerId,moved:false,lx:e.clientX,lt:performance.now(),v:0};
  }
  function onPointerMove(e){
    const d=drag.current, el=track.current; if(!d||!el||e.pointerId!==d.id) return;
    const dx=e.clientX-d.x, dy=e.clientY-d.y;
    if(!d.moved){ if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(dy)) return; d.moved=true; try{ el.setPointerCapture(e.pointerId); }catch(err){} }
    const now=performance.now(); d.v=(e.clientX-d.lx)/Math.max(1,now-d.lt); d.lx=e.clientX; d.lt=now; // px per ms, + is back
    el.scrollLeft=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,d.left-dx));
  }
  function onPointerUp(){
    const d=drag.current, el=track.current; drag.current=null; if(!d||!d.moved||!el) return;
    const moved=el.scrollLeft-page*el.clientWidth; // + forward, - back
    const flick=performance.now()-d.lt<120?d.v:0;
    goTo(clampPage(moved>60||flick<-0.35?page+1:moved<-60||flick>0.35?page-1:page));
  }
  // A rotated or resized screen keeps the current slide in place.
  React.useEffect(()=>{ const h=()=>{ const el=track.current; if(el) el.scrollLeft=page*el.clientWidth; }; window.addEventListener('resize',h); return()=>window.removeEventListener('resize',h); },[page]);
  const wheelLock=React.useRef(0);
  function onWheel(e){
    if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)||Math.abs(e.deltaX)<15) return;
    const now=Date.now(); if(now<wheelLock.current) return;
    wheelLock.current=now+650;
    goTo(clampPage(page+(e.deltaX>0?1:-1)));
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
      <style>{_WELCOME_CSS}</style>
      <div style={{position:'absolute',top:-80,right:-80,width:300,height:300,borderRadius:150,background:`${C.cr}22`,pointerEvents:'none'}}></div>
      <div style={{position:'absolute',bottom:120,left:-60,width:200,height:200,borderRadius:100,background:`${C.cr}12`,pointerEvents:'none'}}></div>

      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'calc(env(safe-area-inset-top) + 18px) 28px 10px',position:'relative',zIndex:1,flexShrink:0}}>
        <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block',filter:'invert(1) brightness(2)'}}/>
        {/* Skip stays in the layout on the last tile (hidden), so the logo doesn't move. */}
        {<span role="button" aria-hidden={page>=last} onClick={()=>page<last&&goTo(last)} style={{visibility:page<last?'visible':'hidden',fontSize:'15px',fontWeight:600,color:_WELCOME_DIM,fontFamily:C.P,cursor:'pointer',padding:'6px 0 6px 12px'}}>Skip</span>}
      </div>

      <div ref={track} aria-roledescription="carousel" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel}
        style={{flex:1,minHeight:0,display:'flex',overflowX:'hidden',overflowY:'hidden',touchAction:'pan-y',userSelect:'none',scrollbarWidth:'none',position:'relative',zIndex:1}}>
        {_WELCOME_TILES.map((tile,i)=><_WelcomeTile key={i} tile={tile} k={k} active={page===i} tileRef={el=>{tiles.current[i]=el;}}/>)}
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
