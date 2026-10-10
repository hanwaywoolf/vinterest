/* Vinterest — the reveal: what a scan found, told in about fifteen seconds of pictures before the
   result screen. A scan used to land on a page of cards that a first-time user swiped straight
   through; this plays on its own, one thing at a time, in the app's own dark stage (the welcome
   screens'): the label, the match dial sweeping up with its verdict, how the wine will feel,
   the grape, the place on the map, one thing to say about it, then what to do next.

   Every fact comes from ScanFlow.reveal (pwa-scan.js): the match from TasteMatch, the traits from
   the label estimate, the grape and the place from knowledge.json, the line to say from the scan
   cards once Claude has written them. A scene without its facts isn't shown. Each scene stays
   long enough to read (ScanFlow.revealLength: its words at a slow reading speed, plus time for the
   picture). A swipe left moves on and a swipe right goes back, a tap pauses and resumes, Skip goes
   to the end; the first couple of reveals open on a tip saying so (Flags.revealTipsDue). Scenes
   hand over with a slide: the old one slips out and the new one slides in from the side the
   swipe came from. Reduced motion shows each scene finished and waits for a swipe. Everything is
   set in Poppins, nothing in italics. Tests turn it off (window.VINTEREST_REVEAL = 'off',
   helpers.stubNetwork) unless they test it. */
const REVEAL_CSS=`
@keyframes rvIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes rvGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rvFill{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes rvDrop{0%{opacity:0;transform:translateY(-46px)}60%{opacity:1;transform:translateY(4px)}80%{transform:translateY(-3px)}100%{transform:none}}
@keyframes rvPulse{0%{transform:scale(.4);opacity:.8}100%{transform:scale(2.6);opacity:0}}
@keyframes rvGlow{from{opacity:0}to{opacity:1}}
@keyframes rvSheet{from{transform:translateY(100%)}to{transform:none}}
@keyframes rvPop{0%{opacity:0;transform:scale(.7)}70%{transform:scale(1.06)}100%{opacity:1;transform:none}}
@keyframes rvEnterR{from{opacity:0;transform:translateX(70px) scale(.96)}to{opacity:1;transform:none}}
@keyframes rvEnterL{from{opacity:0;transform:translateX(-70px) scale(.96)}to{opacity:1;transform:none}}
@keyframes rvLeaveL{from{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:translateX(-90px) scale(.94);filter:blur(6px)}}
@keyframes rvLeaveR{from{opacity:1;transform:none;filter:blur(0)}to{opacity:0;transform:translateX(90px) scale(.94);filter:blur(6px)}}
@keyframes rvTip{from{opacity:0}to{opacity:1}}
.rv-stage{position:relative;overflow:hidden;background:#0F0F0F;color:#fff;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.rv-stage .rv-in{animation:rvIn .55s cubic-bezier(.2,.8,.3,1) both}
.rv-stage .rv-bar{transform-origin:left center;animation:rvGrow .9s cubic-bezier(.3,.9,.4,1) both}
.rv-stage .rv-pop{animation:rvPop .5s cubic-bezier(.2,.9,.3,1.2) both}
.rv-stage .rv-pin{animation:rvDrop .7s cubic-bezier(.3,.8,.3,1) both}
.rv-stage .rv-pulse{animation:rvPulse 1.4s ease-out infinite}
.rv-stage .rv-seg{transform-origin:left center;animation:rvFill linear both}
.rv-stage.rv-paused .rv-seg,.rv-stage.rv-paused .rv-pulse{animation-play-state:paused}
.rv-stage .rv-sheet{animation:rvSheet .45s cubic-bezier(.2,.8,.3,1) both}
.rv-stage .rv-enter-r{animation:rvEnterR .5s cubic-bezier(.2,.8,.3,1) both}
.rv-stage .rv-enter-l{animation:rvEnterL .5s cubic-bezier(.2,.8,.3,1) both}
.rv-stage .rv-leave-l{animation:rvLeaveL .42s cubic-bezier(.4,0,.7,1) both;pointer-events:none}
.rv-stage .rv-leave-r{animation:rvLeaveR .42s cubic-bezier(.4,0,.7,1) both;pointer-events:none}
.rv-stage .rv-tip{animation:rvTip .4s ease both}
@media (prefers-reduced-motion: reduce){.rv-stage *{animation:none!important;transition:none!important}.rv-stage .rv-seg{transform:none}}
`;
/* The words each scene asks someone to read, for its length (ScanFlow.revealLength). */
function _revealWords(key,d,existingRating){
  const i=d.identity, m=d.match;
  switch(key){
    case 'label': return [i.title,i.producer,i.grapes,i.region].join(' ');
    case 'match': return m.early?`Score 3 ${m.early.many} and every one you scan comes with a match worked out from your own scores, not a critic's`
      :[m.label,m.expectedLabel?`Likely ${m.expectedLabel} for you you've loved ${m.chance}% of wines like it`:'',existingRating>0?'You scored it we expected':'',m.pro,m.con].join(' ');
    case 'taste': return d.traits.map(t=>t.word+' '+t.name).concat(d.notes).join(' ');
    case 'grape': return [d.grape.name,d.grape.line,'Famous in',...d.grape.famousIn].join(' ');
    case 'place': return [d.place.name,d.place.country,d.place.line,'Known for',...d.place.grapes].join(' ');
    case 'say': return d.say.text;
    default: return '';
  }
}
/* Verdict colours that read on the dark stage (the result screen's _TONE_COL are for white). */
const _RV_TONE={good:'#5FD48F',neutral:'#F2B84B',bad:'#F28B7D'};

function _revealOff(){ return typeof window!=='undefined'&&window.VINTEREST_REVEAL==='off'; }

/* The scenes this scan has, in order. `say` joins once Claude's lines are in. */
function _revealScenes(d,existingRating){
  const keys=['label',d.match&&'match',d.traits.length&&'taste',d.grape&&'grape',d.place&&'place',d.say&&'say'].filter(Boolean);
  return keys.map(key=>({key,ms:ScanFlow.revealLength(_revealWords(key,d,existingRating))})).concat([{key:'end',ms:0}]);
}

function ScanReveal({wine,match,gen,existingRating,firstScan,nav,showPro,curr,onDone,onRated,onSaveForLater,onFinish}){
  const d=React.useMemo(()=>ScanFlow.reveal(wine,match,gen),[wine,match,gen]);
  const scenes=React.useMemo(()=>_revealScenes(d,existingRating),[d,existingRating]);
  const [key,setKey]=React.useState('label');
  const [paused,setPaused]=React.useState(false);
  // The first couple of reveals open on how to drive it; the stage waits underneath.
  const [tips,setTips]=React.useState(()=>Flags.revealTipsDue());
  React.useEffect(()=>{ if(tips) Flags.markRevealTips(); },[]);
  const idx=Math.max(0,scenes.findIndex(s=>s.key===key)), scene=scenes[idx];
  const still=_reducedMotion();
  // The scene on its way out, kept for its exit animation, and which way the change went.
  const [leaving,setLeaving]=React.useState(null); // {key, dir}
  const [dir,setDir]=React.useState('fwd');
  const go=React.useCallback(i=>{
    const n=Math.max(0,Math.min(scenes.length-1,i)); if(scenes[n].key===key) return;
    const d=n>idx?'fwd':'back'; setDir(d); if(!still) setLeaving({key,dir:d}); setKey(scenes[n].key);
  },[scenes,key,idx,still]);
  React.useEffect(()=>{ if(!leaving) return; const t=setTimeout(()=>setLeaving(null),450); return()=>clearTimeout(t); },[leaving]);
  // Each scene moves on by itself unless the finger is down or motion is reduced. A pause keeps
  // what's elapsed, so a long press doesn't restart the scene.
  const elapsed=React.useRef(0), startedAt=React.useRef(0);
  React.useEffect(()=>{ elapsed.current=0; },[key]);
  React.useEffect(()=>{
    if(!scene.ms||paused||still||tips) return;
    startedAt.current=performance.now();
    const t=setTimeout(()=>go(idx+1),Math.max(50,scene.ms-elapsed.current));
    return()=>{ clearTimeout(t); elapsed.current+=performance.now()-startedAt.current; };
  },[key,paused,scene.ms,still,tips]);
  // Touch: a swipe left moves on, a swipe right goes back (REVEAL_SWIPE px, or a quick flick); a
  // tap pauses and resumes. A finger held down also pauses, and lets go where it was.
  const start=React.useRef(null), hold=React.useRef(null), held=React.useRef(false);
  const down=e=>{ if(e.target.closest('[data-rv-stop]')) return; start.current={x:e.clientX,y:e.clientY,t:performance.now()}; held.current=false; hold.current=setTimeout(()=>{ held.current=true; setPaused(true); },260); };
  const up=e=>{
    if(e.target.closest('[data-rv-stop]')||!start.current) return;
    clearTimeout(hold.current);
    const dx=e.clientX-start.current.x, dy=e.clientY-start.current.y, dt=performance.now()-start.current.t; start.current=null;
    const swipe=Math.abs(dx)>Math.abs(dy)*1.3&&(Math.abs(dx)>REVEAL_SWIPE||(Math.abs(dx)>24&&dt<220));
    if(swipe){ if(held.current){ held.current=false; setPaused(false); } go(dx<0?idx+1:idx-1); return; }
    if(held.current){ held.current=false; setPaused(false); return; }
    if(Math.abs(dx)<10&&Math.abs(dy)<10) setPaused(p=>!p);
  };
  const cancel=()=>{ clearTimeout(hold.current); start.current=null; if(held.current){ held.current=false; setPaused(false); } };
  const col=d.col;
  return <div className={`rv-stage${paused?' rv-paused':''}`} role="region" aria-label={`Your scan in ${scenes.length-1} quick steps`}
      onPointerDown={down} onPointerUp={up} onPointerCancel={cancel} onPointerLeave={cancel}
      style={{flex:1,display:'flex',flexDirection:'column',paddingTop:'env(safe-area-inset-top)'}}>
    <style>{REVEAL_CSS}</style>
    <div aria-hidden="true" style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 28%, ${col}66, transparent 62%)`,animation:'rvGlow 1.2s ease both'}}/>
    {/* Progress: a segment per scene, the current one filling over its length. */}
    <div data-testid="reveal-progress" style={{position:'relative',display:'flex',gap:4,padding:'12px 14px 0'}}>
      {scenes.slice(0,-1).map((s,i)=><div key={s.key} style={{flex:1,height:3,borderRadius:2,background:'rgba(255,255,255,0.22)',overflow:'hidden'}}>
        {i<idx?<div style={{height:'100%',background:'#fff'}}/>
          :i===idx&&s.ms?<div key={key} className="rv-seg" style={{height:'100%',background:'#fff',animationDuration:`${s.ms}ms`}}/>:null}
      </div>)}
    </div>
    <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 18px 0'}}>
      <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.6)',fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>{firstScan?'Your first bottle':'Your scan'}</span>
      {key!=='end'&&<span role="button" data-rv-stop onClick={()=>go(scenes.length-1)} style={{fontSize:14,fontWeight:700,color:'rgba(255,255,255,0.75)',fontFamily:C.P,cursor:'pointer',padding:'6px 0 6px 12px'}}>Skip</span>}
    </div>
    <div style={{position:'relative',flex:1,minHeight:0}}>
      {leaving&&<div aria-hidden="true" className={leaving.dir==='fwd'?'rv-leave-l':'rv-leave-r'} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',padding:'20px 26px 32px'}}>
        <_RvScene k={leaving.key} d={d} col={col} existingRating={existingRating} still/>
      </div>}
      <div key={key} data-testid="reveal-scene" data-scene={key} className={leaving?(dir==='fwd'?'rv-enter-r':'rv-enter-l'):undefined}
          style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',justifyContent:'center',padding:'20px 26px 32px'}}>
        <_RvScene k={key} d={d} col={col} existingRating={existingRating}/>
      </div>
    </div>
    {paused&&key!=='end'&&<div data-testid="reveal-paused" className="rv-in" style={{position:'absolute',left:0,right:0,bottom:'calc(18px + env(safe-area-inset-bottom))',textAlign:'center',pointerEvents:'none'}}>
      <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.8)',fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',padding:'7px 14px',borderRadius:20,background:'rgba(255,255,255,0.14)'}}>Paused · tap to go on</span>
    </div>}
    {tips&&<_RvTips onDone={()=>setTips(false)}/>}
    {key==='end'&&<_RvEnd wine={wine} d={d} firstScan={firstScan} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr}
      onDone={onDone} onRated={onRated} onSaveForLater={onSaveForLater} onFinish={onFinish}/>}
  </div>;
}

/* A swipe this long (px) turns the page; a quick flick needs less. */
const REVEAL_SWIPE=56;

function _RvScene({k,d,col,existingRating,still}){
  // `still`: the copy of a scene on its way out shows finished, so nothing replays as it leaves.
  const inner=k==='label'?<_RvLabel d={d} col={col}/>
    :k==='match'?<_RvMatch d={d} col={col} existingRating={existingRating} still={still}/>
    :k==='taste'?<_RvTaste d={d} col={col}/>
    :k==='grape'?<_RvGrape d={d} col={col}/>
    :k==='place'?<_RvPlace d={d} col={col}/>
    :k==='say'?<_RvSay d={d} col={col}/>:null;
  return still?<div style={{display:'contents'}} className="rv-still">{inner}<style>{`.rv-still .rv-in,.rv-still .rv-bar,.rv-still .rv-pop,.rv-still .rv-pin{animation:none!important}`}</style></div>:inner;
}

/* How to drive it, over the first couple of reveals (Flags.revealTipsDue). */
function _RvTips({onDone}){
  const row=(icon,text)=><div style={{display:'flex',alignItems:'center',gap:14}}>
    <div style={{width:44,height:44,borderRadius:22,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'22px',lineHeight:1}} aria-hidden="true">{icon}</div>
    <div style={{fontSize:17,fontWeight:600,color:'#fff',fontFamily:C.P,lineHeight:1.35}}>{text}</div>
  </div>;
  return <div data-rv-stop data-testid="reveal-tips" className="rv-tip" role="dialog" aria-label="How the reveal works" style={{position:'absolute',inset:0,background:'rgba(10,10,10,0.9)',display:'flex',flexDirection:'column',justifyContent:'center',padding:'32px 30px calc(32px + env(safe-area-inset-bottom))',gap:22}}>
    <div>
      <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.6)',fontFamily:C.P,letterSpacing:'0.12em',textTransform:'uppercase'}}>Your scan, in a few quick scenes</div>
      <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.15,marginTop:6}}>It plays by itself. You can drive it too.</div>
    </div>
    {row('←','Swipe left to move on, right to go back')}
    {row('●','Tap to pause, tap again to carry on')}
    {row('↦','Skip jumps to what to do next')}
    <div role="button" onClick={onDone} style={{marginTop:8,alignSelf:'stretch',textAlign:'center',padding:'15px 18px',borderRadius:14,background:'#fff',color:C.ink,fontSize:16,fontWeight:800,fontFamily:C.P,cursor:'pointer'}}>Play it</div>
  </div>;
}

const _rvEyebrow=(text,col)=><div className="rv-in" style={{fontSize:13,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.12em',textTransform:'uppercase'}}>{text}</div>;
const _rvDelay=s=>({animationDelay:`${s}s`});

/* 1. The label: what was read. */
function _RvLabel({d,col}){
  const i=d.identity;
  return <div style={{display:'flex',flexDirection:'column',gap:10}}>
    {_rvEyebrow(<span>{i.flag&&<span className="vflag" aria-hidden="true" style={{marginRight:8}}>{i.flag}</span>}{[i.type,i.country].filter(Boolean).join(' · ')}</span>,'rgba(255,255,255,0.7)')}
    <div className="rv-in" style={{...(_rvDelay(.15)),fontSize:34,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.1,letterSpacing:'-0.5px'}}>{i.title}</div>
    {i.producer&&<div className="rv-in" style={{..._rvDelay(.5),fontSize:18,color:'rgba(255,255,255,0.85)',fontFamily:C.P,lineHeight:1.4}}>{i.producer}</div>}
    {(i.grapes||i.region)&&<div className="rv-in" style={{..._rvDelay(.75),fontSize:16,color:'rgba(255,255,255,0.6)',fontFamily:C.P,lineHeight:1.45}}>{[i.grapes,i.region].filter(Boolean).join(' · ')}</div>}
  </div>;
}

/* 2. The match: the dial sweeps up, the verdict lands, then one reason each way. Too early: how
   many scores it needs. Already scored: their score beside the prediction. */
function _RvMatch({d,col,existingRating,still}){
  const m=d.match, tone=_RV_TONE[m.tone]||_RV_TONE.neutral;
  const pct=m.pct!=null?m.pct:0, counted=_useCount(pct,1500,250), shown=still?pct:counted;
  const R=74, circ=2*Math.PI*R, size=200;
  if(m.early){
    const p=m.early;
    return <div style={{display:'flex',flexDirection:'column',gap:16,alignItems:'center',textAlign:'center'}}>
      {_rvEyebrow('Your match','rgba(255,255,255,0.7)')}
      <div className="rv-in" style={{..._rvDelay(.15),fontSize:30,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.15}}>{p.n===0?'It starts with your first score':`${p.n} of ${p.need} ${p.many} scored`}</div>
      <div className="rv-in" style={{..._rvDelay(.4),display:'flex',gap:8,width:'70%'}} aria-label={`${p.n} of ${p.need} ${p.many} scored`}>
        {Array.from({length:p.need},(_,k)=><div key={k} style={{flex:1,height:10,borderRadius:5,background:'rgba(255,255,255,0.2)',overflow:'hidden'}}>{k<p.n&&<div className="rv-bar" style={{..._rvDelay(.6+k*.2),height:'100%',background:col}}/>}</div>)}
      </div>
      <div className="rv-in" style={{..._rvDelay(.9),fontSize:17,color:'rgba(255,255,255,0.8)',fontFamily:C.P,lineHeight:1.5,maxWidth:320}}>Score {p.left===1?'one more':p.left} {p.left===1?p.one:p.many} and every {p.one} you scan comes with a match worked out from your own scores, not a critic's.</div>
    </div>;
  }
  return <div style={{display:'flex',flexDirection:'column',gap:14,alignItems:'center',textAlign:'center'}}>
    {_rvEyebrow('Your match','rgba(255,255,255,0.7)')}
    <div className="rv-in" style={{position:'relative',width:size,height:size,..._rvDelay(.1)}}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{transform:'rotate(-90deg)'}} aria-hidden="true">
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="14"/>
        {m.pct!=null&&<circle cx="100" cy="100" r={R} fill="none" stroke={tone} strokeWidth="14" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-shown/100)} style={{filter:`drop-shadow(0 0 10px ${tone}99)`}}/>}
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        {m.pct!=null?<>
          <div data-testid="reveal-pct" style={{fontSize:'58px',fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1,letterSpacing:'-2px'}}>{shown}<span style={{fontSize:'24px',fontWeight:700,color:'rgba(255,255,255,0.7)'}}>%</span></div>
          <div style={{fontSize:'12px',fontWeight:700,color:'rgba(255,255,255,0.55)',fontFamily:C.P,letterSpacing:'0.14em',textTransform:'uppercase',marginTop:4}}>match</div>
        </>:<div style={{fontSize:'40px',fontWeight:800,color:'rgba(255,255,255,0.5)',fontFamily:C.P}}>—</div>}
      </div>
    </div>
    <div className="rv-in" style={{..._rvDelay(1.5),fontSize:28,fontWeight:800,color:tone,fontFamily:C.P,lineHeight:1.15}}>{m.label}</div>
    <div className="rv-in" style={{..._rvDelay(1.7),fontSize:16,color:'rgba(255,255,255,0.75)',fontFamily:C.P,lineHeight:1.45}}>
      {existingRating>0?`You scored it ${existingRating}${m.expectedLabel?` · we expected ${m.expectedLabel.toLowerCase()}`:''}`
        :m.expectedLabel?`Likely ${m.expectedLabel} for you${m.chance!=null?` · you've loved ${m.chance}% of wines like it`:''}`:''}
    </div>
    {(m.pro||m.con)&&<div style={{display:'flex',flexDirection:'column',gap:8,marginTop:6,width:'100%',maxWidth:340,textAlign:'left'}}>
      {m.pro&&<div className="rv-in" style={{..._rvDelay(2.1),display:'flex',gap:10,alignItems:'flex-start'}}><span style={{marginTop:7,width:8,height:8,borderRadius:4,background:_RV_TONE.good,flexShrink:0}}/><span style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontFamily:C.P,lineHeight:1.45}}>{m.pro}</span></div>}
      {m.con&&<div className="rv-in" style={{..._rvDelay(2.6),display:'flex',gap:10,alignItems:'flex-start'}}><span style={{marginTop:7,width:8,height:8,borderRadius:4,background:_RV_TONE.bad,flexShrink:0}}/><span style={{fontSize:15,color:'rgba(255,255,255,0.85)',fontFamily:C.P,lineHeight:1.45}}>{m.con}</span></div>}
    </div>}
  </div>;
}

/* 3. How it will feel: the traits the label estimated, each as an everyday word and a bar that
   fills, then the tasting notes. */
function _RvTaste({d,col}){
  return <div style={{display:'flex',flexDirection:'column',gap:18}}>
    {_rvEyebrow('How it\'ll feel','rgba(255,255,255,0.7)')}
    {d.traits.map((t,i)=><div key={t.axis} className="rv-in" style={_rvDelay(.2+i*.3)}>
      <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',marginBottom:8}}>
        <span style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.1}}>{t.word}</span>
        <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.5)',fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>{t.name}</span>
      </div>
      <div style={{height:8,borderRadius:4,background:'rgba(255,255,255,0.16)',overflow:'hidden'}}>
        <div className="rv-bar" style={{..._rvDelay(.5+i*.3),height:'100%',width:`${Math.round(t.v*100)}%`,borderRadius:4,background:col,boxShadow:`0 0 12px ${col}99`}}/>
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:4}}><span>{t.low}</span><span>{t.high}</span></div>
    </div>)}
    {d.notes.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
      {d.notes.map((n,i)=><span key={n} className="rv-pop" style={{..._rvDelay(1.5+i*.18),fontSize:15,fontWeight:600,color:'#fff',fontFamily:C.P,padding:'7px 13px',borderRadius:20,background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.25)'}}>{n}</span>)}
    </div>}
  </div>;
}

/* 4. The grape, in the knowledge base's own words. */
function _RvGrape({d,col}){
  const g=d.grape;
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {_rvEyebrow(g.blend?'Led by the grape':'The grape','rgba(255,255,255,0.7)')}
    <div className="rv-in" style={{..._rvDelay(.15),fontSize:40,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.05,letterSpacing:'-0.5px'}}>{g.name}</div>
    <div className="rv-in" style={{..._rvDelay(.5),fontSize:18,color:'rgba(255,255,255,0.85)',fontFamily:C.P,lineHeight:1.5}}>{g.line}.</div>
    {g.famousIn.length>0&&<div className="rv-in" style={{..._rvDelay(.9),fontSize:15,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Famous in {g.famousIn.join(' and ')}{g.typical?' · the usual grape here, not stated on the label':''}</div>}
  </div>;
}

/* 5. The place: the wine map close in, a pin dropping on the region, its name and climate. */
function _RvPlace({d,col}){
  const p=d.place, W=300, H=200;
  // The map is a window onto the view around the pin, its edges faded so it sits in the stage
  // rather than cutting across it.
  const mask='radial-gradient(ellipse at 50% 50%, #000 40%, transparent 74%)';
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {p.map&&<div className="rv-in" style={{alignSelf:'center',width:'100%',maxWidth:360,aspectRatio:`${W}/${H}`,position:'relative',overflow:'hidden',WebkitMaskImage:mask,maskImage:mask}}>
      <svg viewBox={`${p.map.x-W/2} ${p.map.y-H*0.52} ${W} ${H}`} width="100%" height="100%" aria-hidden="true">
        <path d={p.map.view.land} fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" vectorEffect="non-scaling-stroke"/>
        {p.map.view.borders&&<path d={p.map.view.borders} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="0.6" vectorEffect="non-scaling-stroke"/>}
        <g transform={`translate(${p.map.x} ${p.map.y})`}>
          <circle className="rv-pulse" r="9" fill="none" stroke={col} strokeWidth="1.5" style={{animationDelay:'.8s'}}/>
          <g className="rv-pin" style={_rvDelay(.3)}><circle r="5.5" fill={col} stroke="#fff" strokeWidth="1.6"/></g>
        </g>
      </svg>
    </div>}
    {_rvEyebrow('Where it\'s from','rgba(255,255,255,0.7)')}
    <div className="rv-in" style={{..._rvDelay(.9),display:'flex',alignItems:'center',gap:10}}>
      {p.flag&&<span className="vflag" aria-hidden="true" style={{fontSize:'30px',lineHeight:1}}>{p.flag}</span>}
      <div>
        <div style={{fontSize:32,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.1}}>{p.name}</div>
        {p.country&&<div style={{fontSize:15,color:'rgba(255,255,255,0.6)',fontFamily:C.P,marginTop:2}}>{p.country}</div>}
      </div>
    </div>
    {p.line&&<div className="rv-in" style={{..._rvDelay(1.3),fontSize:16,color:'rgba(255,255,255,0.85)',fontFamily:C.P,lineHeight:1.5}}>{p.line}{/[.!?]$/.test(p.line)?'':'.'}</div>}
    {p.grapes.length>0&&<div className="rv-in" style={{..._rvDelay(1.6),fontSize:14,color:'rgba(255,255,255,0.5)',fontFamily:C.P}}>Known for {p.grapes.join(', ')}</div>}
  </div>;
}

/* 6. One thing to say about it, from the scan cards. */
function _RvSay({d,col}){
  const s=d.say;
  return <div style={{display:'flex',flexDirection:'column',gap:12}}>
    {_rvEyebrow(s.kind==='talk'?'Something to say about it':'Did you know','rgba(255,255,255,0.7)')}
    <div className="rv-in" style={{..._rvDelay(.2),fontSize:56,fontWeight:800,lineHeight:.5,color:col,fontFamily:C.P,marginTop:16}} aria-hidden="true">“</div>
    <div className="rv-in" style={{..._rvDelay(.45),fontSize:24,fontWeight:600,color:'#fff',fontFamily:C.P,lineHeight:1.4}}>{s.text}</div>
  </div>;
}

/* 7. What next: the ways out, on a sheet that rises over the stage. The first bottle scores
   itself here (RatingPanel with onFinish) and carries on with onboarding. */
function _RvEnd({wine,d,firstScan,existingRating,nav,showPro,curr,onDone,onRated,onSaveForLater,onFinish}){
  const rows=[
    {key:'rate',icon:'star',label:existingRating?`Re-rate it (${existingRating})`:'Rate it',sub:existingRating?'Changed your mind?':'Score it to sharpen your WineDNA',on:()=>onDone('rate')},
    {key:'learn',icon:'book',label:'Learn about it',sub:'The story, the taste, the region and grape',on:()=>onDone('deck')},
    ...(existingRating?[]:[{key:'save',icon:'bookmark',label:'Save for later',sub:'Shopping, or not tasted yet',on:()=>onDone('saved')}]),
  ];
  return <div data-rv-stop data-testid="reveal-end" className="rv-sheet" style={{position:'relative',background:C.white,borderRadius:'22px 22px 0 0',padding:'18px 18px calc(18px + env(safe-area-inset-bottom))',maxHeight:'78%',overflowY:'auto',boxShadow:'0 -8px 30px rgba(0,0,0,0.4)'}}>
    {firstScan
      ?<div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{fontSize:13,fontWeight:700,color:d.col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Your WineDNA starts here</div>
        <RatingPanel wine={wine} existingRating={existingRating} nav={nav} showPro={showPro} curr={curr} onRated={onRated} onSaveForLater={onSaveForLater} onFinish={onFinish}/>
      </div>
      :<div style={{display:'flex',flexDirection:'column',gap:10}}>
        <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between'}}>
          <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P}}>What next?</div>
          <span role="button" onClick={()=>onDone('result')} style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>See the result →</span>
        </div>
        {rows.map(x=><div key={x.key} role="button" onClick={x.on} style={{background:C.white,border:`1.5px solid ${C.crDim}`,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
          <div style={{width:38,height:38,borderRadius:19,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={x.icon} sz={18} col={C.cr}/></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.25}}>{x.label}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.35}}>{x.sub}</div>
          </div>
          <Icon n="chevron" sz={14} col={C.mid}/>
        </div>)}
      </div>}
  </div>;
}

Object.assign(window,{ScanReveal});
