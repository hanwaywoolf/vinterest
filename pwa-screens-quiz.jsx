/* Vinterest — Quiz Hub + Quiz Screens */


function _normType(t){return(t||'').toLowerCase().replace('é','e');}

/* ── QUIZ HUB / LEARN TAB ── */
/* Dashed "N completed — show" row that expands a completed section (Wine Basics, regions). */
function CompletedToggle({count,expanded,onToggle}){
  return(
    <div onClick={onToggle} style={{background:C.white,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,cursor:'pointer',border:`1px dashed ${C.line}`}}>
      <Icon n="chevron" sz={12} col={C.mid} style={expanded?{transform:'rotate(-90deg)'}:undefined}/>
      <span style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P}}>{expanded?'Show less':`${count} completed — show`}</span>
    </div>
  );
}
/* A list that shows its first `limit` items and a "Show N more" row, so no one section of Learn
   turns into a long scroll on the way to the next. */
const GRAPE_PILLS=10;
function ShowMore({items,limit=3,render,noun}){
  const [open,setOpen]=React.useState(false);
  const T=useTheme(), cr=T.lift(C.cr);
  if(!items||!items.length) return null;
  const rest=items.length-limit;
  return <>
    {(open?items:items.slice(0,limit)).map(render)}
    {rest>0&&<div role="button" onClick={()=>setOpen(o=>!o)} style={{padding:'8px 4px',display:'flex',alignItems:'center',gap:6,cursor:'pointer',gridColumn:'1 / -1'}}>
      <Icon n="chevron" sz={12} col={cr} style={{transform:open?'rotate(-90deg)':'rotate(90deg)'}}/>
      <span style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P}}>{open?'Show less':`Show ${rest} more${noun?' '+noun:''}`}</span>
    </div>}
  </>;
}
/* The row of section chips at the top of Learn: every kind of learning visible at once, one tap away. */
function LearnJumpRow({sections,onJump}){ const T=useTheme(), cr=T.lift(C.cr);
  return <div style={{display:'flex',gap:8,overflowX:'auto',padding:'10px 16px',background:T.bg,position:'sticky',top:0,zIndex:2,borderBottom:`1px solid ${T.line}`,scrollbarWidth:'none'}}>
    {sections.map(x=>(
      <div key={x.id} role="button" onClick={()=>onJump(x.id)} style={{flex:'0 0 auto',padding:'7px 13px',borderRadius:999,background:T.glass,border:`1px solid ${T.line}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:14,fontWeight:600,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap'}}>{x.label}</span>
        {x.count>0&&<span style={{fontSize:12,fontWeight:700,color:cr,background:T.crSoft,borderRadius:999,padding:'1px 7px',fontFamily:C.P}}>{x.count}</span>}
      </div>
    ))}
  </div>;
}
/* A region's country flag in the 42px icon tile (Regions.flag); the map icon when the country is
   unknown. Locked (Pro) regions show it faded. The flag is a fixed graphic, so its size is px. */
function RegionFlag({region,locked}){ const T=useTheme(), cr=T.lift(C.cr);
  const f=Regions.flag(region);
  return <div style={{width:42,height:42,borderRadius:12,background:T.soft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,opacity:locked?0.5:1}}>
    {f?<span role="img" aria-label={(KNOWLEDGE.regions[region]||{}).country} style={{fontSize:'24px',lineHeight:1}}>{f}</span>:<Icon n="map" sz={20} col={T.ink}/>}
  </div>;
}
/* ✓ plus a Reset link, for a completed quiz row. The row itself stays tappable to retake it. */
function CompletedMark({onReset}){ const T=useTheme(), cr=T.lift(C.cr);
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
      <span style={{fontSize:14,fontWeight:700,color:T.green,fontFamily:C.P}}>✓</span>
      <span onClick={e=>{e.stopPropagation();onReset();}} style={{fontSize:13,fontWeight:600,color:T.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Reset</span>
    </div>
  );
}

function QuizHubScreen({nav,back,showPro}){ const T=useTheme(), cr=T.lift(C.cr);
  // On an iPad the lists (pieces, basics, regions, guides) run two to a row, and the page keeps to 1100px.
  const wide=useWide(), list=wide?{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:8,alignItems:'stretch'}:{display:'flex',flexDirection:'column',gap:8};
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());
  const [isPro,setIsPro]=React.useState(()=>Entitlement.isPro());
  React.useEffect(()=>{const h=()=>setIsPro(true);window.addEventListener('vinterest:pro',h);return()=>window.removeEventListener('vinterest:pro',h);},[]);
  const level=XPSystem.getLevel(xpData.total);
  const nextLvl=XPSystem.nextLevel(xpData.total);
  const prog=XPSystem.levelProgress(xpData.total);
  // The shelf opens after the first on-ramp article, or straight away for enthusiasts and
  // experts (their onboarding answer), who don't need the beginner on-ramp first
  // (ContentEngine.shelfOpen, which every other screen follows too).
  const article1Done=ContentEngine.shelfOpen();
  const wines=React.useMemo(()=>WineHistory.getAll(),[]);

  const [genStubs,setGenStubs]=React.useState(()=>{
    try{ return ContentEngine.shelf(); }catch(e){ return null; }
  });
  React.useEffect(()=>{
    if(!article1Done) return;
    const w=WineHistory.getAll();
    if(!w.length) return;
    const updated=ContentEngine.refreshShelf(w,6);
    setGenStubs(updated);
  },[article1Done]);

  const zoneLabel={fontSize:15,fontWeight:600,color:T.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2};
  const unreadShelf=(genStubs||[]).filter(s=>!LearnProgress.articleDone(s.id)&&!ContentEngine.stubLocked(s));
  const nextOnRamp=ON_RAMP.find(a=>!onRampDone(a.id));
  const nextBest=nextOnRamp&&!(UserPrefs.skipsOnRamp()&&unreadShelf.length)
    ? {kind:'onramp',title:nextOnRamp.title,sub:nextOnRamp.subtitle,readTime:nextOnRamp.readTime,action:()=>{Handoff.onRampIdx.set(String(ON_RAMP.indexOf(nextOnRamp)));nav('article');}}
    : unreadShelf.length
      ? {kind:'shelf',stub:unreadShelf[0],title:unreadShelf[0].title,sub:unreadShelf[0].subtitle,action:()=>{Handoff.genArticle.set(unreadShelf[0]);nav('gen-article');}}
      : null;

  // Bumped after a progress reset so the to-do/completed splits below recompute.
  const [progressTick,setProgressTick]=React.useState(0);
  const quizRegions=React.useMemo(()=>regionQuizCandidates(wines),[wines,progressTick]);
  const doneRegions=React.useMemo(()=>completedRegionQuizzes(wines),[wines,progressTick]);
  const proRegions=React.useMemo(()=>isPro?[]:lockedRegions(wines),[wines,isPro]);
  const [regionsExpanded,setRegionsExpanded]=React.useState(false);
  function resetProgress(name,doReset){
    if(!window.confirm(`Reset your progress on ${name}? Its questions start from scratch.`)) return;
    doReset();
    setProgressTick(t=>t+1);
  }
  const startQuiz=cfg=>{ Handoff.quiz.set(cfg); nav('quiz'); };
  const [topicsExpanded,setTopicsExpanded]=React.useState(false);
  // Wine Basics always shows — it's the entry point for someone new to wine, not just a
  // pre-WineDNA-unlock placeholder. Completed topics (every question answered correctly at
  // least once) move behind the toggle instead of disappearing, so they can still be retaken
  // or handed to someone else.
  const topicProgress=id=>QuizMastery.progress('topic:'+id,QuizMastery.topicPool(id));
  const {topicsToShow,doneTopics}=React.useMemo(()=>{
    const todo=[],done=[];
    QUIZ_TOPICS.forEach(t=>{ (QuizMastery.isComplete('topic:'+t.id,QuizMastery.topicPool(t.id))?done:todo).push(t); });
    return {topicsToShow:todo,doneTopics:done};
  },[progressTick]);
  const [grapeUnlocks,setGrapeUnlocks]=React.useState(()=>GrapeUnlocks.all());
  const [grapeLoading,setGrapeLoading]=React.useState(null);
  const [regionLoading,setRegionLoading]=React.useState(null);
  // Generate question banks for the regions on offer in the background, so a tap is usually instant.
  React.useEffect(()=>{ quizRegions.slice(0,3).forEach(r=>RegionQuizBank.prefetch(r)); },[quizRegions]);
  const mountedRef=React.useRef(true);
  React.useEffect(()=>()=>{ mountedRef.current=false; },[]);
  // First tap on a region whose bank isn't ready waits for generation (spinner on the tile);
  // if it fails, the quiz falls back to the fixed knowledge-base questions.
  function handleRegionTap(region){
    if(regionLoading) return;
    setRegionLoading(region);
    RegionQuizBank.load(region,()=>{
      if(!mountedRef.current) return; // left Learn while it generated — don't yank them into a quiz
      setRegionLoading(null);
      startQuiz({mode:'region',region});
    });
  }
  const [grapesExpanded,setGrapesExpanded]=React.useState(false);
  // Unlocked grapes first (most-recently-unlocked first), locked grapes after in their
  // existing allowlist order. Recomputed from current unlock state on every render (not
  // just at mount) so a grape unlocked mid-session jumps to the front immediately.
  const {unlockedGrapes,lockedGrapes}=React.useMemo(()=>{
    const unlocked=[],locked=[];
    GRAPE_ALLOWLIST.forEach(g=>{ (grapeUnlocks[g]?unlocked:locked).push(g); });
    unlocked.sort((a,b)=>(grapeUnlocks[b].at||0)-(grapeUnlocks[a].at||0));
    return {unlockedGrapes:unlocked,lockedGrapes:locked};
  },[grapeUnlocks]);
  const [grapeError,setGrapeError]=React.useState(null);
  // One tap opens the quiz: a locked grape (Pro) is unlocked and opened in the same tap, and
  // the pill keeps its name with a spinner while the questions generate. A failed generation
  // says so instead of silently doing nothing.
  function handleGrapeTap(grape){
    if(grapeLoading) return;
    if(!grapeUnlocks[grape]){
      if(!isPro){ showPro('grape-library'); return; }
      GrapeUnlocks.unlockManual(grape); setGrapeUnlocks(GrapeUnlocks.all());
    }
    setGrapeError(null);
    setGrapeLoading(grape);
    getGrapeQuiz(grape,qs=>{
      if(!mountedRef.current) return;
      setGrapeLoading(null);
      if(qs&&qs.length) startQuiz({mode:'grape',grape,questions:qs});
      else setGrapeError(grape);
    });
  }
  // "3/15" on a pill once its questions exist; a tick once every one is answered.
  function grapePillStatus(g){
    const bank=grapeQuizBank(g);
    if(!bank) return null;
    const p=QuizMastery.progress('grape:'+g,bank);
    return p.correct===p.total?{done:true}:{text:`${p.correct}/${p.total}`};
  }
  // Warm the quiz cache for already-unlocked grapes so opening one is instant if it's had time to
  // generate — new unlocks warm themselves immediately via GrapeUnlocks. Capped so a big backlog
  // (e.g. a restored account) doesn't fire a burst of requests at once.
  React.useEffect(()=>{
    unlockedGrapes.slice(0,5).forEach(g=>{ try{ prefetchGrapeQuiz(g); }catch(e){} });
  },[]);

  const [libraryOpen,setLibraryOpen]=React.useState(false);
  const [guidesExpanded,setGuidesExpanded]=React.useState(false);
  const guideQueue=Guides.queue(), guidesDone=Guides.finished();
  const openGuide=id=>{ Handoff.guide.set(id); nav('guide'); };
  const knowledge=React.useMemo(()=>KnowledgeMap.summary(wines),[wines,progressTick]);
  const refreshers=React.useMemo(()=>{ try{ return KnowledgeMap.refreshers(); }catch(e){ return []; } },[progressTick]);
  const secRefs={shelf:React.useRef(null),basics:React.useRef(null),regions:React.useRef(null),grapes:React.useRef(null),skills:React.useRef(null),progress:React.useRef(null)};
  const jump=id=>{ const el=secRefs[id]&&secRefs[id].current; if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); };

  // After every hook above: returning early before one of them changes the hook count between
  // renders, and React throws the moment the unlock effect flips showUnlock.

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg}}>
      <div style={{background:`radial-gradient(ellipse at 50% -20%, ${_alpha(cr,T.dark?0.42:0.14)}, transparent 70%) ${T.dark?T.bg:C.white}`,padding:'14px 20px 0',borderBottom:`1px solid ${T.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={T.ink}/>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,flex:1,letterSpacing:'-0.4px'}}>Learn</span>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:20,background:T.crSoft,border:`1px solid ${_alpha(cr,0.4)}`}}>
            <Icon n={XPSystem.iconFor(level)} sz={15} col={T.dark?'#fff':cr}/>
            <span style={{fontSize:16,fontWeight:700,color:T.dark?'#fff':cr,fontFamily:C.P}}>{xpData.total} XP</span>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{level.name}</span>
            {nextLvl&&<span style={{fontSize:15,color:T.mid,fontFamily:C.P}}>{nextLvl.min - xpData.total} XP to {nextLvl.name}</span>}
          </div>
          <div style={{height:7,borderRadius:4,background:T.soft,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,background:T.lift(level.color),width:`${Math.round(prog*100)}%`,transition:'width .6s ease'}}/>
          </div>
        </div>
        {/* Mastery, one tap from the top of Learn: their knowledge in a ring, and where to start. */}
        <div role="button" tabIndex={0} data-testid="learn-mastery-link" onClick={()=>isPro?nav('mastery-map'):showPro('mastery-map')}
          onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); isPro?nav('mastery-map'):showPro('mastery-map'); } }}
          style={{display:'flex',alignItems:'center',gap:10,marginBottom:12,padding:'8px 12px 8px 8px',borderRadius:12,background:T.dark?T.soft:'#FBF8F3',border:`1px solid ${T.line}`,cursor:'pointer'}}>
          <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true" style={{flexShrink:0}}>
            <circle r="13" fill="none" stroke={T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL} strokeWidth="2.5"/>
            <circle r="13" fill="none" stroke={cr} strokeWidth="3" strokeLinecap="round" transform="rotate(-90)"
              strokeDasharray={2*Math.PI*13} strokeDashoffset={2*Math.PI*13*(1-Math.min(100,knowledge.overall)/100)}/>
            <text y="3.5" textAnchor="middle" style={{fontSize:'9px',fontWeight:800,fill:T.ink,fontFamily:C.P}}>{knowledge.overall}%</text>
          </svg>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>Your Mastery <span style={{fontWeight:500,color:T.mid}}>· {knowledge.level}</span>{knowledge.progress&&knowledge.progress.overall>0&&<span style={{fontSize:13,fontWeight:800,color:T.green,marginLeft:6}}>▲{knowledge.progress.overall} in {knowledge.progress.weeks} wk{knowledge.progress.weeks===1?'':'s'}</span>}</div>
            <div style={{fontSize:13,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{knowledge.gap?`Start here: ${knowledge.gap.label}`:'Your shape, grapes, wine map and palate'}</div>
          </div>
          {!isPro&&<ProBadge/>}
          <Icon n="chevron" sz={13} col={T.mid}/>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
<LearnJumpRow onJump={jump} sections={[
  {id:'shelf',label:'For you',count:article1Done?unreadShelf.length:0},
  {id:'basics',label:'Basics',count:topicsToShow.length},
  (quizRegions.length+doneRegions.length+proRegions.length)>0&&{id:'regions',label:'Regions',count:quizRegions.length},
  {id:'grapes',label:'Grapes',count:unlockedGrapes.filter(g=>{ const st=grapePillStatus(g); return !(st&&st.done); }).length},
  {id:'skills',label:'Skills',count:guideQueue.length},
  {id:'progress',label:'Mastery'},
].filter(Boolean)}/>
<div style={{padding:wide?'14px max(16px, calc((100% - 1100px) / 2))':'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        {nextBest&&<div>
          <div style={zoneLabel}>Next Best Thing</div>
          <div onClick={nextBest.action} style={T.dark?{background:_alpha(cr,0.16),border:`1px solid ${_alpha(cr,0.4)}`,borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginTop:8,boxShadow:`0 0 36px ${_alpha(cr,0.18)}`}:{background:C.ink,borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginTop:8}}>
            <div style={{width:46,height:46,borderRadius:12,background:T.dark?_alpha(cr,0.28):'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n={nextBest.kind==='onramp'?'book':(nextBest.stub.iconName||'read')} sz={20} col={T.dark?cr:'rgba(255,255,255,0.7)'}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{nextBest.kind==='onramp'?'On-Ramp · '+nextBest.readTime:nextBest.kind==='shelf'?'Written for you · '+nextBest.stub.readTime:'Free forever'}</div>
              <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3,marginBottom:2}}>{nextBest.title}</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.4}}>{nextBest.sub}</div>
            </div>
            <Icon n="chevron" sz={13} col="rgba(255,255,255,0.3)"/>
          </div>
        </div>}

        {/* Answers past their review date (QuizMastery fading): the sets that need a quick refresher. */}
        {refreshers.length>0&&<div data-testid="refreshers">
          <div style={zoneLabel}>Time for a refresher</div>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:4}}>Answers fade a few weeks after you last got them right, and count for less in your Mastery until you refresh them.</div>
          <div style={{background:T.glass,borderRadius:16,border:`1px solid ${T.line}`,marginTop:8,overflow:'hidden'}}>
            {refreshers.slice(0,3).map((r,i)=>(
              <div key={r.label} role="button" onClick={()=>_openLearn(r.learn,nav,showPro)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
                <Icon n="bolt" sz={17} col={T.amber}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>{r.region&&<Flag region={r.region} size={14} style={{marginRight:6}}/>}{r.label}</div>
                  <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{r.fading} of {r.total} answers fading</div>
                </div>
                <span style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P}}>Refresh →</span>
              </div>
            ))}
          </div>
        </div>}

        {/* Before the shelf opens: what it is and the one step that opens it, shown faded. */}
        {!article1Done&&ON_RAMP[0]&&(
          <div ref={secRefs.shelf} data-shelf-locked style={{scrollMarginTop:56}}>
            <div style={zoneLabel}>Written for you</div>
            <div style={{marginTop:8,background:T.glass,borderRadius:14,border:`1px dashed ${T.line}`,padding:'16px',position:'relative',overflow:'hidden'}}>
              <div aria-hidden="true" style={{opacity:0.35,display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                {[0.9,0.7].map((w,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:T.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="read" sz={16} col={cr}/></div>
                  <div style={{flex:1}}><div style={{height:10,width:`${w*100}%`,background:T.line,borderRadius:5,marginBottom:6}}/><div style={{height:8,width:`${w*70}%`,background:T.line,borderRadius:4}}/></div>
                </div>)}
              </div>
              <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.35}}>Like a good bottle, these need a little time.</div>
              <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:4}}>Pieces here are written from your WineDNA: the bottles you scan, how you rate them and what you pay. Read <b>{ON_RAMP[0].title}</b> first and your shelf opens.</div>
              <div style={{marginTop:12}}><Btn primary onClick={()=>{Handoff.onRampIdx.set('0');nav('article');}}>Read it now · {ON_RAMP[0].readTime}</Btn></div>
            </div>
          </div>
        )}

        {article1Done&&(()=>{
          // Unread pieces stay on the shelf (three at a time); read ones move to the library, so
          // new pieces get seen and anyone who wants to binge can keep going.
          const isRead=stub=>LearnProgress.articleDone(stub.id);
          const all=genStubs||[];
          const unread=[...all.filter(x=>!isRead(x)&&!ContentEngine.stubLocked(x)),...all.filter(x=>!isRead(x)&&ContentEngine.stubLocked(x))];
          const read=all.filter(isRead);
          // The beginner articles they've read belong in the library too, after the pieces written for them.
          const readBasics=ON_RAMP.map((a,i)=>({a,i})).filter(x=>LearnProgress.onRampDone(x.a.id));
          const libraryCount=read.length+readBasics.length;
          const card=(stub,i)=>{
            const done=isRead(stub);
            const locked=ContentEngine.stubLocked(stub);
            const because=ContentEngine.because(stub,wines);
            return <ShelfCard key={stub.id||i} stub={stub} done={done} locked={locked} because={because}
              onOpen={()=>{ if(locked){ showPro('regions'); return; } Handoff.genArticle.set(stub);nav('gen-article');}}/>;
          };
          return(
          <div ref={secRefs.shelf} style={{scrollMarginTop:56}}>
            <div style={zoneLabel}>Written for you</div>
            <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:4}}>Every piece here is written from your WineDNA: the bottles you've scanned, how you rated them and what you paid. Nobody else gets the same article.</div>
            <div style={{...list,marginTop:8}}>
            {!unread.length&&(
              <div style={{padding:'18px 16px',textAlign:'center',background:T.glass,borderRadius:14,border:`1px dashed ${T.line}`,gridColumn:'1 / -1'}}>
                <span style={{fontSize:15,color:T.mid,fontFamily:C.P,lineHeight:1.5}}>{read.length?"You've read everything written for you so far. Scan or rate another bottle and more arrives.":"Nothing on your shelf yet. Scan a bottle and we'll have something for you by morning."}</span>
              </div>
            )}
            <ShowMore items={unread} limit={3} render={card} noun="to read"/>
            {libraryCount>0&&(
              <div role="button" data-testid="library-toggle" onClick={()=>setLibraryOpen(o=>!o)} style={{background:T.glass,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,cursor:'pointer',border:`1px dashed ${T.line}`,gridColumn:'1 / -1'}}>
                <Icon n="book" sz={15} col={T.mid}/>
                <span style={{fontSize:14,fontWeight:600,color:T.mid,fontFamily:C.P,flex:1}}>Your library · {libraryCount} read</span>
                <Icon n="chevron" sz={12} col={T.mid} style={{transform:libraryOpen?'rotate(-90deg)':'rotate(90deg)'}}/>
              </div>
            )}
            {libraryOpen&&read.map(card)}
            {libraryOpen&&readBasics.length>0&&<div data-testid="library-basics" style={{background:T.glass,borderRadius:14,border:`1px solid ${T.line}`,overflow:'hidden',gridColumn:'1 / -1'}}>
              <div style={{fontSize:13,fontWeight:700,color:T.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,padding:'10px 14px 4px'}}>Beginner articles</div>
              {readBasics.map(({a,i})=>(
                <div key={a.id} role="button" onClick={()=>{Handoff.onRampIdx.set(String(i));nav('article');}} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}>
                  <Icon n="check" sz={15} col={T.green||T.mid}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{a.title}</div>
                    <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{a.readTime} read</div>
                  </div>
                  <Icon n="chevron" sz={13} col={T.mid}/>
                </div>
              ))}
            </div>}
            </div>
          </div>
          );
        })()}

        <div ref={secRefs.basics} style={{...zoneLabel,scrollMarginTop:56}}>Wine Basics</div>
        <div style={{...list,marginTop:-6}}>
          <ShowMore items={topicsToShow} limit={4} noun="topics" render={topic=>{
            const p=topicProgress(topic.id);
            return(
            <div key={topic.id} onClick={()=>startQuiz({mode:'practice',topicId:topic.id})}
              style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`}}>
              <div style={{width:42,height:42,borderRadius:12,background:_alpha(T.lift(topic.color),0.15),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`}}>
                <Icon n={topic.iconName||'book'} sz={20} col={T.lift(topic.color)}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{topic.label}</div>
                <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{topic.desc}{p.correct>0?` · ${p.correct}/${p.total} correct`:''}</div>
              </div>
              <Icon n="chevron" sz={13} col={T.mid}/>
            </div>
            );
          }}/>
          {doneTopics.length>0&&<CompletedToggle count={doneTopics.length} expanded={topicsExpanded} onToggle={()=>setTopicsExpanded(e=>!e)}/>}
          {topicsExpanded&&doneTopics.map(topic=>(
            <div key={topic.id} onClick={()=>startQuiz({mode:'practice',topicId:topic.id})}
              style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`,opacity:0.7}}>
              <div style={{width:42,height:42,borderRadius:12,background:_alpha(T.lift(topic.color),0.15),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`}}>
                <Icon n={topic.iconName||'book'} sz={20} col={T.lift(topic.color)}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{topic.label}</div>
                <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{topic.desc}</div>
              </div>
              <CompletedMark onReset={()=>resetProgress(topic.label,()=>QuizMastery.reset('topic:'+topic.id))}/>
            </div>
          ))}
          {/* Regions open from their first scan (5 free, then Pro), not only once WineDNA unlocks. */}
          {(quizRegions.length>0||doneRegions.length>0||proRegions.length>0)&&(
            <>
              {(quizRegions.length>0||doneRegions.length>0||proRegions.length>0)&&(
                <div ref={secRefs.regions} style={{marginTop:14,scrollMarginTop:56,gridColumn:'1 / -1'}}>
                  <div style={zoneLabel}>Region quizzes</div>
                  <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>One for each region you've scanned: its grapes, climate, rules and how to read its labels.</div>
                </div>
              )}
              <ShowMore items={[...quizRegions.map(r=>({r})),...proRegions.map(r=>({r,pro:true}))]} limit={3} noun="regions" render={({r:region,pro})=>pro?(
                <div key={region} onClick={()=>showPro('regions')} style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`}}>
                  <RegionFlag region={region} locked/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{region}</div>
                    <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Unlock with Pro</div>
                  </div>
                  <ProBadge/>
                </div>
              ):(()=>{
                const info=KNOWLEDGE.regions[region];
                // Progress only once the region's generated bank exists, so the count doesn't
                // jump from the fallback's /6 to /15 when it arrives.
                const p=RegionQuizBank.get(region)&&RegionQuizBank.progress(region);
                const sub=p&&p.correct>0?`${p.correct} of ${p.total} answered`:'5 questions a round';
                return(
                  <div key={region} onClick={()=>handleRegionTap(region)} style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`}}>
                    <RegionFlag region={region}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{region} quiz</div>
                      <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{sub}</div>
                    </div>
                    {regionLoading===region
                      ?<div style={{width:14,height:14,borderRadius:7,border:`2px solid ${T.line}`,borderTopColor:cr,animation:'storySpin .8s linear infinite'}}/>
                      :<Icon n="chevron" sz={13} col={T.mid}/>}
                  </div>
                );
              })()}/>
              {doneRegions.length>0&&<CompletedToggle count={doneRegions.length} expanded={regionsExpanded} onToggle={()=>setRegionsExpanded(e=>!e)}/>}
              {regionsExpanded&&doneRegions.map(region=>(
                <div key={region} onClick={()=>handleRegionTap(region)} style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`,opacity:0.7}}>
                  <RegionFlag region={region}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{region} quiz</div>
                    <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Every question answered · tap to practise</div>
                  </div>
                  <CompletedMark onReset={()=>resetProgress(region,()=>RegionQuizBank.reset(region))}/>
                </div>
              ))}
            </>
          )}
        </div>

        <div ref={secRefs.grapes} style={{...zoneLabel,scrollMarginTop:56}}>Grape quizzes</div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Tap a grape for its quiz: what it tastes like, where it grows and how to spot it on a label.</div>
        <div style={{fontSize:13,fontWeight:600,color:T.ink2,fontFamily:C.P,marginTop:4}}>{unlockedGrapes.length} of {GRAPE_ALLOWLIST.length} unlocked · {isPro?'locked ones unlock as you tap'
          :unlockedGrapes.length>=FREE_GRAPE_CAP?`your ${FREE_GRAPE_CAP} free grapes are open${GrapeUnlocks.held().length?`, ${GrapeUnlocks.held().length} more waiting for Pro`:''}; Pro opens the rest`
          :`scan or rate a wine to open another (${FREE_GRAPE_CAP-unlockedGrapes.length} of ${FREE_GRAPE_CAP} free left)`}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
        {(grapesExpanded?unlockedGrapes:unlockedGrapes.slice(0,GRAPE_PILLS)).map(g=>{
          const loading=grapeLoading===g;
          const col=T.lift(grapeTypeColor(g));
          const status=grapePillStatus(g);
          return(
            <div key={g} onClick={()=>handleGrapeTap(g)} style={{flex:'0 0 auto',padding:'10px 16px',borderRadius:999,background:col+'15',border:`1px solid ${col}40`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
              {status&&status.done&&<span style={{fontSize:14,fontWeight:700,color:T.green,fontFamily:C.P}}>✓</span>}
              <span style={{fontSize:14,fontWeight:600,color:col,fontFamily:C.P,whiteSpace:'nowrap'}}>{g}</span>
              {loading
                ?<div style={{width:13,height:13,borderRadius:7,border:`2px solid ${col}33`,borderTopColor:col,animation:'storySpin .8s linear infinite'}}/>
                :status&&!status.done&&<span style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,background:T.dark?T.soft:'#fff',borderRadius:999,padding:'1px 7px'}}>{status.text}</span>}
            </div>
          );
        })}
        {(lockedGrapes.length>0||unlockedGrapes.length>GRAPE_PILLS)&&(
          <div onClick={()=>setGrapesExpanded(e=>!e)} style={{flex:'0 0 auto',padding:'10px 18px',borderRadius:999,background:T.glass,border:`1px dashed ${T.line}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {grapesExpanded?<Icon n="chevron" sz={12} col={T.mid} style={{transform:'rotate(-90deg)'}}/>:<Icon n="lock" sz={12} col={T.mid}/>}
            <span style={{fontSize:14,fontWeight:600,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{grapesExpanded?'Show less':`+${lockedGrapes.length+Math.max(0,unlockedGrapes.length-GRAPE_PILLS)} more`}</span>
          </div>
        )}
        {grapesExpanded&&lockedGrapes.map(g=>{
          const loading=grapeLoading===g;
          const col=T.lift(grapeTypeColor(g));
          return(
            <div key={g} onClick={()=>handleGrapeTap(g)} style={{flex:'0 0 auto',padding:'10px 18px',borderRadius:999,background:T.glass,border:`1px solid ${col}30`,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:0.75}}>
              {!loading&&<Icon n="lock" sz={11} col={T.mid}/>}
              <span style={{fontSize:14,fontWeight:600,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap'}}>{g}</span>
              {loading&&<div style={{width:13,height:13,borderRadius:7,border:`2px solid ${col}33`,borderTopColor:col,animation:'storySpin .8s linear infinite'}}/>}
            </div>
          );
        })}
        </div>
        {grapeLoading&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:8}}>Preparing your {grapeLoading} quiz… the first time takes a few seconds.</div>}
        {grapeError&&!grapeLoading&&<div style={{fontSize:14,color:'#C0392B',fontFamily:C.P,marginTop:8}}>Couldn't load the {grapeError} quiz. Check your connection and tap it again.</div>}

        {/* Wine Skills: fixed guides for tasting, ordering, buying, pairing and hosting (Guides, pwa-guides.js) */}
        <div ref={secRefs.skills} style={{scrollMarginTop:56}}>
          <div style={zoneLabel}>Wine Skills</div>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Short guides for the moments that matter: tasting, ordering out, buying, pairing and hosting. Each ends with three quick questions.</div>
        </div>
        <div style={{...list,marginTop:-6}}>
          <ShowMore items={guideQueue} limit={4} noun="guides" render={g=>{
            const p=Guides.progress(g.id), read=Guides.isRead(g.id);
            return(
              <div key={g.id} onClick={()=>openGuide(g.id)} role="button" style={{background:T.glass,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:T.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${_alpha(cr,0.4)}`}}><Icon n={g.iconName||'book'} sz={20} col={cr}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{Guides.group(g.group).label} · {g.readTime}</div>
                  <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{g.title}</div>
                  {(read||p.correct>0)&&<div style={{fontSize:13,fontWeight:600,color:T.ink2,fontFamily:C.P,marginTop:3}}>{read?'Read':'Not read yet'} · {p.correct}/{p.total} questions</div>}
                </div>
                <Icon n="chevron" sz={13} col={T.mid}/>
              </div>
            );
          }}/>
          {guidesDone.length>0&&<CompletedToggle count={guidesDone.length} expanded={guidesExpanded} onToggle={()=>setGuidesExpanded(e=>!e)}/>}
          {guidesExpanded&&guidesDone.map(g=>(
            <div key={g.id} onClick={()=>openGuide(g.id)} role="button" style={{background:T.glass,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${T.line}`,opacity:0.75}}>
              <Icon n={g.iconName||'book'} sz={17} col={cr}/>
              <div style={{flex:1,fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>{g.title}</div>
              <span style={{fontSize:14,fontWeight:700,color:T.green,fontFamily:C.P}}>✓</span>
            </div>
          ))}
        </div>

        <div ref={secRefs.progress} style={{...zoneLabel,scrollMarginTop:56}}>Your Mastery</div>
        <div onClick={()=>isPro?nav('mastery-map'):showPro('mastery-map')} role="button" style={{background:T.glass,borderRadius:16,border:`1px solid ${T.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,marginTop:-6,cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:T.soft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="trophy" sz={19} col={T.ink}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Your wine knowledge · {knowledge.overall}%</div>
              <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>From the articles you've read and the quizzes you've passed, across every wine type, region, grape and skill.</div>
            </div>
            {!isPro&&<ProBadge/>}
            <Icon n="chevron" sz={13} col={T.mid}/>
          </div>
          <div style={{height:6,borderRadius:3,background:T.soft,overflow:'hidden'}}><div style={{height:'100%',width:`${knowledge.overall}%`,background:cr,borderRadius:3}}/></div>
          <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>
            {knowledge.strongest?<>Strongest: <b>{knowledge.strongest.label}</b> ({knowledge.strongest.level.toLowerCase()}). </>:null}
            {knowledge.gap?<>Biggest gap: <b>{knowledge.gap.label}</b>.</>:null}
          </div>
        </div>

        <div style={zoneLabel}>Courses</div>
        {[{icon:'globe',title:'Country courses',sub:'A whole country in one course: its regions, grapes, local wines and labels.'},
          {icon:'map',title:'Travel prep',sub:'Tell us where you\'re going and we\'ll build a course and wine picks for your trip.'}].map(c=>(
          <div key={c.title} style={{background:T.glass,borderRadius:16,border:`1px solid ${T.line}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,opacity:0.7,marginTop:-6}}>
            <div style={{width:42,height:42,borderRadius:12,background:T.soft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={c.icon} sz={19} col={T.mid}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{c.title}</div>
              <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{c.sub}</div>
              <div style={{fontSize:12,fontWeight:700,color:T.amber,fontFamily:C.P,marginTop:3}}>Coming soon</div>
            </div>
            <ProBadge/>
          </div>
        ))}

        <div style={{height:8}}/>
        <div onClick={()=>{XPSystem.reset();setXpData(XPSystem.fresh());}} style={{textAlign:'center',padding:'8px',cursor:'pointer'}}>
          <span style={{fontSize:13,color:T.mid,fontFamily:C.P,textDecoration:'underline'}}>Reset XP &amp; progress</span>
        </div>
        <div style={{height:16}}/>
      </div>
</div>
<style>{`@keyframes storySpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* One "Written for you" piece on the Learn shelf. Also the welcome slides' preview
   (flow-welcome.jsx), with no onOpen: not tappable, no chevron. */
function ShelfCard({stub,done,locked,because,onOpen}){ const T=useTheme(), cr=T.lift(C.cr);
  return(
  <div onClick={onOpen}
    style={{background:T.glass,borderRadius:14,padding:done?'10px 14px':'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:onOpen?'pointer':'default',border:`1px solid ${T.line}`,opacity:done?0.75:1}}>
    <div style={{width:done?36:44,height:done?36:44,borderRadius:12,background:T.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${_alpha(cr,0.4)}`}}>
      <Icon n={stub.iconName||'read'} sz={done?17:20} col={cr}/>
    </div>
    <div style={{flex:1,minWidth:0}}>
      {!done&&<div style={{fontSize:12,fontWeight:600,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{stub.series?`${stub.series} series`:'Written for you'} · {stub.readTime}</div>}
      <div style={{fontSize:done?15:16,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{stub.title}</div>
      {!done&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:2}}>{stub.subtitle}</div>}
      {!done&&<div style={{fontSize:13,fontWeight:600,color:cr,fontFamily:C.P,marginTop:4}}>{because}</div>}
    </div>
    {locked ? <ProBadge/> : done ? <span style={{fontSize:14,fontWeight:700,color:T.green,fontFamily:C.P}}>✓</span> : onOpen ? <Icon n="chevron" sz={13} col={T.mid}/> : null}
  </div>
  );
}

/* ── MASTERY (PRO) ──
   How rounded their wine knowledge is, from what they've read and passed (KnowledgeMap,
   pwa-knowledge.js): where to start (focus), the shape of it now and a month ago, the map of
   regions, then each area's score, level, what counts, and the next thing to do. */
function MasteryBar({score,col}){ const T=useTheme(), cr=T.lift(C.cr);
  return <div style={{height:6,borderRadius:3,background:T.soft,overflow:'hidden'}}><div className="mastery-fill" style={{height:'100%',borderRadius:3,background:score>=100?T.green:T.lift(col||cr),width:`${score}%`,transition:'width .5s ease'}}/></div>;
}
/* One area of the mastery map: its level and score, and (open) each region or grape in it. Also
   the welcome slides' preview (flow-welcome.jsx), open, with no toggle or next step. */
/* A wine-type area's colour (_TYPE_COLORS): its bar fills in it, so strong and weak types read
   like a palette. Other areas stay crimson. */
function _masteryCol(a){ return a.group==='types'&&typeof _TYPE_COLORS!=='undefined'?_TYPE_COLORS[a.id==='sweet'?'dessert':a.id]||C.cr:C.cr; }
/* A green rise: how much something has grown since the dotted outline's snapshot
   (KnowledgeMap.progress, about a month back, or their first week). Nothing when it hasn't. */
function RiseTag({n,style}){ const T=useTheme(), cr=T.lift(C.cr);
  if(!(n>0)) return null;
  return <span data-rise={n} aria-label={`up ${n} points`} style={{display:'inline-flex',alignItems:'center',gap:2,fontSize:12,fontWeight:800,color:T.green,fontFamily:C.P,whiteSpace:'nowrap',...style}}>▲{n}</span>;
}
function MasteryAreaCard({a,open,onToggle,onNext,prog}){ const T=useTheme(), cr=T.lift(C.cr);
  const col=T.lift(_masteryCol(a));
  return(
  <div style={{background:T.glass,borderRadius:14,border:`1px solid ${T.line}`,padding:'12px 14px',display:'flex',flexDirection:'column',gap:7}}>
    <div role="button" onClick={onToggle} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',cursor:a.items&&onToggle?'pointer':'default'}}>
      <span style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{a.group==='types'&&<span aria-hidden="true" style={{display:'inline-block',width:10,height:10,borderRadius:5,background:col,marginRight:8,verticalAlign:'1px'}}/>}{a.label}</span>
      <span style={{fontSize:14,fontWeight:700,color:a.score>=100?T.green:T.ink2,fontFamily:C.P,display:'inline-flex',alignItems:'baseline',gap:6}}><RiseTag n={prog&&prog.area?prog.area(a.id):0}/>{a.level} · {a.score}%</span>
    </div>
    <MasteryBar score={a.score} col={col}/>
    <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{a.detail}{a.items&&a.items.length&&onToggle?(open?' · hide':' · see each'):''}</div>
    {open&&a.items.map(i=>(
      <div key={i.name} style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{flex:'0 0 42%',fontSize:14,color:T.ink2,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.id==='regions'&&<Flag region={i.name} size={14} style={{marginRight:6}}/>}{a.id==='grapes'&&<span aria-hidden="true" style={{display:'inline-block',width:8,height:8,borderRadius:4,background:grapeTypeColor(i.name),marginRight:7,verticalAlign:'1px'}}/>}{i.name}{i.fading>0&&<span style={{fontSize:12,fontWeight:600,color:T.amber,marginLeft:6}}>fading</span>}</span>
        <div style={{flex:1}}><MasteryBar score={i.score} col={a.id==='grapes'?T.lift(grapeTypeColor(i.name)):col}/></div>
        <RiseTag n={KnowledgeMap.itemRise(prog,a.id,i.name,i.score)}/>
        <span style={{fontSize:13,fontWeight:700,color:T.ink2,fontFamily:C.P,width:38,textAlign:'right'}}>{i.score}%</span>
      </div>
    ))}
    {a.next&&onNext&&<div role="button" onClick={onNext} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer'}}>{a.next.label} →</div>}
  </div>
  );
}
/* The shape of their knowledge: one spoke per Mastery area, drawn in the pen-and-wash style of
   the grapes and the palate (cream paper, ink line, a loose wash laid a little off the line):
   the shape now is a smooth ink curve over a crimson wash; a dotted pencil curve is where they
   were (KnowledgeMap.progress: about a month ago, or their first week). Pencil rings mark
   Developing (34), Confident (67) and Mastered (100), drawn as a pencil gone round twice (_sketchRing); their names sit
   on small tags stacked down the line straight below the centre, drawn over the shape so it never
   covers them, far enough apart that they never touch, with the dots drawn over the tags so a
   high score near the bottom is never hidden. Each area's dot takes its own colour (wine types their type's).
   A label tap opens that area in the list. A picture for screen readers (the list says the same
   in words). Labels are string sizes: they must fit around the drawing. */
/* A pencil circle gone round twice: two arcs a hair off the true circle, each stopping short of
   closing (the first at 93%, the second carrying on past its start), seeded so the same ring is
   drawn the same way every time. */
function _sketchRing(cx,cy,r,seed){
  const rnd=KnowledgeMap._rng(seed);
  const arc=(ox,oy,rad,a0,span)=>{ const p=a=>[cx+ox+Math.cos(a)*rad,cy+oy+Math.sin(a)*rad], [x0,y0]=p(a0), half=a0+span/2, [xm,ym]=p(half), [x1,y1]=p(a0+span);
    const f=v=>v.toFixed(2); return `M${f(x0)} ${f(y0)} A${f(rad)} ${f(rad)} 0 0 1 ${f(xm)} ${f(ym)} A${f(rad)} ${f(rad)} 0 0 1 ${f(x1)} ${f(y1)}`; };
  const a0=rnd()*Math.PI*2;
  return [arc(0.6-rnd()*1.2,0.6-rnd()*1.2,r*(1+0.006),a0,Math.PI*2*0.93),
          arc(0.8-rnd()*1.6,0.8-rnd()*1.6,r*(1-0.008),a0+Math.PI*(0.6+rnd()*0.5),Math.PI*2*(0.82+rnd()*0.1))];
}
function MasteryRadar({m,prog,onPick}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const W=340,H=310,cx=W/2,cy=H/2,R=100, n=m.areas.length;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  // 0% sits on a small inner ring (HOLE of the radius), so an early shape is still a shape, not a spike.
  const HOLE=0.26, rr=score=>R*(HOLE+(1-HOLE)*score/100);
  const pt=(i,score)=>[cx+Math.cos(ang(i))*rr(score),cy+Math.sin(ang(i))*rr(score)];
  const curve=scores=>_sketchPath(scores.map((v,i)=>pt(i,v)),true);
  const now=m.areas.map(a=>a.score), then=prog?m.areas.map(a=>prog.then.a[a.id]||0):null;
  const said=m.areas.map(a=>`${a.label} ${a.score}%`).join(', ');
  const dot=a=>a.score>=100?T.green:_masteryCol(a);
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" data-testid="mastery-radar" aria-label={`Your knowledge by area: ${said}.`} style={{display:'block',maxWidth:420,margin:'0 auto',overflow:'visible'}}>
      {/* Rings drawn like a pencil going round twice: two clean, light passes a hair apart, each
          lifting off before it closes, at a different place on each ring. */}
      {[34,67,100].map(r=>_sketchRing(cx,cy,rr(r),'ring'+r).map((d,j)=><path key={r+'-'+j} d={d} fill="none" stroke={r===100?(T.dark?'rgba(255,255,255,0.4)':'#A99F94'):PENCIL} strokeWidth={j?0.8:(r===100?1.3:1)} strokeLinecap="round" opacity={j?0.7:1}/>))}
      {m.areas.map((a,i)=>{ const [x,y]=pt(i,100), [x0,y0]=pt(i,0); return <line key={a.id} x1={x0} y1={y0} x2={x} y2={y} stroke={PENCIL} strokeWidth="0.8" opacity="0.7"/>; })}
      {then&&<path d={curve(then)} fill="none" stroke={T.mid} strokeWidth="1.2" strokeDasharray="1.5 4" strokeLinecap="round"/>}
      <g className="mastery-radar-shape" style={{transformOrigin:`${cx}px ${cy}px`}}>
        <path d={curve(now)} fill={T.lift(SKETCH_WASH.red)} opacity="0.22" transform="translate(2.5 3)"/>
        <path d={curve(now)} fill={T.lift(SKETCH_WASH.red)} opacity="0.1"/>
        <path d={curve(now)} fill="none" stroke={PENCIL} strokeWidth="1.1" strokeLinejoin="round" transform="translate(-1.4 1.1)"/>
        <path d={curve(now)} fill="none" stroke={INK} strokeWidth="1.7" strokeLinejoin="round"/>
      </g>
      {[['Developing',34],['Confident',67],['Mastered',100]].map(([l,r])=>{ const y=cy+rr(r), w=l.length*5.4+12;
        return <g key={l} aria-hidden="true">
          <rect x={cx-w/2} y={y-7} width={w} height={14} rx={7} fill={T.dark?T.card:"#FBF8F3"} stroke={PENCIL}/>
          <text x={cx} y={y+3} textAnchor="middle" style={{fontSize:'8px',fontWeight:700,fill:T.dark?T.ink2:C.mid,fontFamily:C.P,letterSpacing:'0.06em'}}>{l.toUpperCase()}</text>
        </g>; })}
      {/* Dots last: a high score on a spoke near the bottom stays visible over the ring tags. */}
      <g className="mastery-radar-shape" style={{transformOrigin:`${cx}px ${cy}px`}}>
        {m.areas.map((a,i)=>{ if(!a.score) return null; const [x,y]=pt(i,a.score); return <circle key={a.id} cx={x} cy={y} r="4.2" fill={dot(a)} stroke={INK} strokeWidth="1.1"/>; })}
      </g>
      {m.areas.map((a,i)=>{
        const c=Math.cos(ang(i)), sn=Math.sin(ang(i)), x=cx+c*(R+14), y=cy+sn*(R+14)+(sn>0.3?8:sn<-0.3?-6:3);
        const anchor=c>0.1?'start':c<-0.1?'end':'middle'; // the two bottom spokes lean apart
        return <g key={a.id} onClick={()=>onPick&&onPick(a.id)} style={{cursor:'pointer'}}>
          <text x={x} y={y} textAnchor={anchor} style={{fontSize:'11px',fontWeight:600,fill:a.score?T.ink:T.mid,fontFamily:C.P}}>{KnowledgeMap.short(a)}</text>
          <text x={x} y={y+12} textAnchor={anchor} style={{fontSize:'10px',fontWeight:700,fill:a.score>=100?T.green:a.score?cr:PENCIL,fontFamily:C.P}}>{a.score}%{prog&&prog.area&&prog.area(a.id)>0&&<tspan data-rise={prog.area(a.id)} style={{fill:T.green,fontWeight:800}}> ▲{prog.area(a.id)}</tspan>}</text>
        </g>;
      })}
    </svg>
  );
}
/* The same areas as a list: each group (wine types, regions and grapes, Wine Skills) with every
   area's card (its score, level, change since the dotted outline, what's inside it and its next
   step), so the chart's numbers all have their detail. */
const MASTERY_GROUPS=[{id:'types',label:'Wine types'},{id:'places',label:'Regions and grapes'},{id:'skills',label:'Wine Skills'}];
function MasteryAreaList({m,prog,open,setOpen,go}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  return <div data-testid="mastery-area-list" style={{display:'flex',flexDirection:'column',gap:8}}>
    {prog&&prog.rises.length>0&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P}}><span style={{color:T.green,fontWeight:800}}>▲</span> Points gained since {_when(prog.then.t)}.</div>}
    {MASTERY_GROUPS.map(G=><React.Fragment key={G.id}>
      <div style={{fontSize:14,fontWeight:700,color:T.ink2,fontFamily:C.P,marginTop:4}}>{G.label}</div>
      {m.areas.filter(a=>a.group===G.id).map(a=>(
        <div key={a.id} data-area={a.id}>
          <MasteryAreaCard a={a} prog={prog} open={open===a.id} onToggle={()=>a.items&&setOpen(o=>o===a.id?null:a.id)} onNext={()=>go(a.next)}/>
        </div>))}
    </React.Fragment>)}
  </div>;
}
function _when(t){ return new Date(t).toLocaleDateString('en',{day:'numeric',month:'short'}); }

/* The map of wine regions (KnowledgeMap.regionMap): every region in the knowledge base as a pin,
   coloured by its level once unlocked, grey until a scan unlocks it, ringed where they've had a
   bottle from it. A tap shows the pins near it (they sit close together in Europe), each with its
   next step. */
const _PIN_COL={'Not started':'#fff','Getting started':'#DDA0AB','Developing':'#B94A61','Confident':C.cr,'Mastered':C.green};
function _pinFill(p,T){ return p.state==='open'?(T?T.lift(_PIN_COL[p.level]||C.cr):_PIN_COL[p.level]||C.cr):(T&&T.dark?'rgba(255,255,255,0.25)':'#CFC9C2'); }
/* A two- or three-way switch (Bunches/List, Red/White, Map/List), as tabs. */
function MasteryToggle({label,options,value,onChange,testid}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  return <div role="tablist" aria-label={label} data-testid={testid} style={{display:'flex',gap:4,padding:3,borderRadius:10,background:T.soft}}>
    {options.map(([id,text])=>{ const on=value===id; return <div key={id} role="tab" aria-selected={on} tabIndex={0} onClick={()=>onChange(id)}
      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onChange(id); } }}
      style={{flex:1,textAlign:'center',padding:'6px 0',borderRadius:8,fontSize:14,fontWeight:600,fontFamily:C.P,cursor:'pointer',
        background:on?(T.dark?'rgba(255,255,255,0.16)':C.white):'transparent',color:on?T.ink:T.mid,boxShadow:on?'0 1px 2px rgba(0,0,0,0.08)':'none'}}>{text}</div>; })}
  </div>;
}
/* One region as a row (the map's picked pins and the list): flag, name, where they stand, and
   its next step (Quiz or Refresh, Pro, or scan a bottle from there). */
function _RegionRow({p,nav,showPro,bar,prog,onOpen}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const on=p.state==='open';
  return <div data-region={p.name} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${T.line}`}}>
    <Flag region={p.name} size={18}/>
    <div role={onOpen?'button':undefined} onClick={onOpen?()=>onOpen(p.name):undefined} style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:3,cursor:onOpen?'pointer':'default'}}>
      <div style={{fontSize:15,fontWeight:700,color:on||!bar?T.ink:T.mid,fontFamily:C.P}}>{p.name}</div>
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>
        {on?`${p.level} · ${p.score}%`:p.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet'}{on&&<RiseTag n={KnowledgeMap.itemRise(prog,'regions',p.name,p.score)} style={{marginLeft:6}}/>}
        {on&&p.fading?<span style={{color:T.amber,fontWeight:600}}>{` · ${p.fading} answer${p.fading===1?'':'s'} fading`}</span>:''}
        {p.drunk?` · you've had ${p.drunk===1?'one':p.drunk}`:''}
      </div>
      {bar&&on&&<MasteryBar score={p.score} col={cr}/>}
    </div>
    {on?((p.score<100||p.fading>0)&&<div role="button" onClick={()=>_openLearn({kind:'region',region:p.name},nav,showPro)} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap'}}>{p.fading?'Refresh':'Quiz'} →</div>)
      :p.state==='held'?<div role="button" onClick={()=>showPro('regions')} style={{cursor:'pointer'}}><ProBadge/></div>
      :null} {/* 'Not unlocked yet' says it; the nav's Scan button is always there */}
  </div>;
}
/* Pinch (or a trackpad pinch, ctrl + wheel) zooms the map about the fingers, up to MAP_ZOOM_MAX;
   once zoomed, one finger pans it, and the page scrolls again once it's back at 1×. A touch that
   barely moves is a tap. + and − (and "Reset") do the same for anyone who can't pinch. Pins and
   lines keep their size on screen as the map grows, so close-together regions come apart. */
const MAP_ZOOM_MAX=6;
function useMapZoom(w,h){
  const [z,setZ]=React.useState({k:1,x:0,y:0}); // k: zoom; x, y: the top-left of what's shown, in map units
  const fit=(k,x,y)=>{ k=Math.max(1,Math.min(MAP_ZOOM_MAX,k)); const vw=w/k, vh=h/k; return {k,x:Math.max(0,Math.min(w-vw,x)),y:Math.max(0,Math.min(h-vh,y))}; };
  const reset=()=>setZ({k:1,x:0,y:0});
  // Zoom by f about a point (px, py) given as a fraction of the shown box.
  const zoomAt=(f,px=0.5,py=0.5)=>setZ(o=>{ const k=Math.max(1,Math.min(MAP_ZOOM_MAX,o.k*f)); const ax=o.x+px*w/o.k, ay=o.y+py*h/o.k; return fit(k,ax-px*w/k,ay-py*h/k); });
  const pts=React.useRef(new Map()), g=React.useRef(null);
  /* Where the map is really drawn inside the element. The SVG keeps the map's shape, so when its
     height is capped (420px on an iPad's wide screen) the map sits centred with space either side,
     and a finger's position has to be measured from the drawing, not the element's edge, or taps
     land beside the pin and names come out the wrong size. */
  const box=r=>{ const s=Math.min(r.width/w,r.height/h)||1, cw=w*s, ch=h*s; return {cw,ch,ox:(r.width-cw)/2,oy:(r.height-ch)/2}; };
  const at=(x,y,r)=>{ const b=box(r); return [(x-r.left-b.ox)/b.cw,(y-r.top-b.oy)/b.ch]; };
  const frac=(e,r)=>at(e.clientX,e.clientY,r);
  const handlers=onTap=>({
    onPointerDown(e){
      const el=e.currentTarget; pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      try{ el.setPointerCapture(e.pointerId); }catch(_){}
      const r=el.getBoundingClientRect(), P=[...pts.current.values()];
      g.current={r,start:{...z},P0:P.map(p=>({...p})),moved:false,two:P.length>=2||(g.current&&g.current.two&&P.length>1)};
    },
    onPointerMove(e){
      if(!pts.current.has(e.pointerId)||!g.current) return;
      pts.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const G=g.current, P=[...pts.current.values()], r=G.r, s=G.start;
      if(P.length>=2&&G.P0.length>=2){
        const d0=Math.hypot(G.P0[0].x-G.P0[1].x,G.P0[0].y-G.P0[1].y)||1, d1=Math.hypot(P[0].x-P[1].x,P[0].y-P[1].y);
        const m0=[(G.P0[0].x+G.P0[1].x)/2,(G.P0[0].y+G.P0[1].y)/2], m1=[(P[0].x+P[1].x)/2,(P[0].y+P[1].y)/2];
        const k=Math.max(1,Math.min(MAP_ZOOM_MAX,s.k*d1/d0));
        // The map point under the first midpoint stays under the fingers' midpoint now.
        const f0=at(m0[0],m0[1],r), f1=at(m1[0],m1[1],r);
        const ax=s.x+f0[0]*w/s.k, ay=s.y+f0[1]*h/s.k;
        setZ(fit(k,ax-f1[0]*w/k,ay-f1[1]*h/k)); G.moved=true; G.two=true;
      }else if(P.length===1&&G.P0.length===1){
        const dx=P[0].x-G.P0[0].x, dy=P[0].y-G.P0[0].y;
        if(Math.hypot(dx,dy)>6) G.moved=true;
        const b=box(r);
        if(G.moved&&s.k>1) setZ(fit(s.k,s.x-dx/b.cw*w/s.k,s.y-dy/b.ch*h/s.k));
      }
    },
    onPointerUp(e){
      const G=g.current; pts.current.delete(e.pointerId);
      if(G&&!G.moved&&!G.two&&pts.current.size===0){ const [fx,fy]=frac(e,G.r); onTap(z.x+fx*w/z.k,z.y+fy*h/z.k,z.k); }
      // A finger left a pinch: carry on from here with the one that's still down.
      const P=[...pts.current.values()];
      g.current=P.length?{r:G?G.r:e.currentTarget.getBoundingClientRect(),start:{...z},P0:P.map(p=>({...p})),moved:true,two:true}:null;
    },
    onPointerCancel(e){ pts.current.delete(e.pointerId); if(!pts.current.size) g.current=null; },
    onWheel(e){ if(!e.ctrlKey) return; e.preventDefault(); const [fx,fy]=frac(e,e.currentTarget.getBoundingClientRect()); zoomAt(Math.exp(-e.deltaY*0.01),fx,fy); },
  });
  // React's onWheel is passive; a trackpad pinch needs preventDefault, so it's attached by hand.
  const ref=React.useRef(null), wheel=React.useRef(null);
  React.useEffect(()=>{ const el=ref.current; if(!el) return; const f=e=>wheel.current&&wheel.current(e); el.addEventListener('wheel',f,{passive:false}); return()=>el.removeEventListener('wheel',f); },[]);
  // How wide the map is drawn on screen (not the element: see box), so names, pins and lines
  // can be sized in real pixels at any zoom.
  // Measured from the layout (clientWidth, the observer's own rect), never getBoundingClientRect:
  // that includes the screen's enter animation, which scales the box, so the map was first drawn
  // with pins and names 1.8× too big and nothing re-measured, since the layout size never changed.
  const [rect,setRect]=React.useState(null);
  React.useEffect(()=>{ const el=ref.current; if(!el) return;
    const m=()=>{ const w=el.clientWidth||el.parentElement&&el.parentElement.clientWidth||0, h=el.clientHeight||0; if(w) setRect({width:w,height:h||w*(hRef.current/wRef.current)}); }; m();
    if(typeof ResizeObserver==='undefined') return; const o=new ResizeObserver(es=>{ const c=es[0]&&es[0].contentRect; if(c&&c.width) setRect({width:c.width,height:c.height}); else m(); }); o.observe(el); return()=>o.disconnect(); },[]);
  const wRef=React.useRef(w), hRef=React.useRef(h); wRef.current=w; hRef.current=h;
  const px=rect?box(rect).cw:0;
  return {z,px,reset,zoomAt,ref,bind:onTap=>{ const H=handlers(onTap); wheel.current=H.onWheel; const {onWheel,...rest}=H; return rest; }};
}
/* Names on the map, placed biggest-first and skipped where they'd overlap one already placed or
   fall outside what's shown. u is map units per screen pixel, so every name is a fixed size on
   screen however far in they've zoomed. Zoomed out, the major wine countries only (data/world-map.json's
   `countries` with the most knowledge-base regions, MAP_COUNTRY_MAX at most); zoomed in (MAP_NAMES_AT), the regions, unlocked ones first, each
   above its pin, or below it when above is taken. Names keep clear of the pins and of the zoom
   buttons. */
const MAP_NAMES_AT=2, MAP_COUNTRY_MAX=5;
function _mapLabels(v,z,u,pin){
  const vx=z.x, vy=z.y, vw=v.w/z.k, vh=v.h/z.k, placed=[], out=[];
  const hit=(b,list)=>list.some(o=>b.x0<o.x1&&b.x1>o.x0&&b.y0<o.y1&&b.y1>o.y0), pins=[];
  const fits=(b,loose)=>b.x0>=vx+2*u&&b.x1<=vx+vw-2*u&&b.y0>=vy+2*u&&b.y1<=vy+vh-2*u&&!hit(b,placed)&&(loose||!hit(b,pins));
  const box=(x,y,w,h)=>({x0:x-w/2-2*u,x1:x+w/2+2*u,y0:y-h*1.05-u,y1:y+h*0.3+u}); // a little air round each name
  // Keep clear of the zoom buttons (top right) and Reset (top left, once zoomed), in screen pixels.
  const scr=(x0,y0,x1,y1)=>({x0:vx+x0*u,y0:vy+y0*u,x1:vx+x1*u,y1:vy+y1*u}), pw=vw/u;
  placed.push(scr(pw-52,0,pw,96)); if(z.k>1) placed.push(scr(0,0,96,50));
  if(z.k<MAP_NAMES_AT){
    const fs=10;
    v.pins.forEach(p=>pins.push({x0:p.x-pin,x1:p.x+pin,y0:p.y-pin,y1:p.y+pin}));
    // Only the major wine countries: those with the most knowledge-base regions, MAP_COUNTRY_MAX
    // at most, so Europe reads France, Italy, Spain, Portugal, Germany and nothing else.
    const n={}; Object.values((typeof KNOWLEDGE!=='undefined'&&KNOWLEDGE.regions)||{}).forEach(r=>{ const c=r.country==='United States'?'USA':r.country; n[c]=(n[c]||0)+1; });
    (v.countries||[]).filter(c=>n[c.name]).sort((a,b)=>n[b.name]-n[a.name]||b.a-a.a).slice(0,MAP_COUNTRY_MAX).forEach(c=>{
      // A country at the edge (Portugal) is nudged inwards rather than dropped; one that meets a
      // name already placed tries a line above or below. Clear of pins if it can be.
      const t=c.name.toUpperCase(), w=t.length*fs*0.72*u, h=fs*u, x=Math.max(vx+w/2+5*u,Math.min(vx+vw-w/2-5*u,c.x));
      const tries=[]; [0,-h*1.3,h*1.3,-h*2.4,h*2.4,-h*3.5,h*3.5].forEach(dy=>[0,-w*0.3,w*0.3,-w*0.6,w*0.6].forEach(dx=>tries.push([dx,dy])));
      for(const loose of [false,true]){ let done=false;
        for(const [dx,dy] of tries){ const x2=Math.max(vx+w/2+5*u,Math.min(vx+vw-w/2-5*u,x+dx)), y=c.y+h/2+dy, b=box(x2,y,w,h); if(fits(b,loose)){ placed.push(b); out.push({kind:'country',t,x:x2,y,fs:fs*u}); done=true; break; } }
        if(done) break; } });
    return out;
  }
  const fs=14, rank=p=>(p.state==='open'?0:2)-(p.drunk?1:0);
  // The pins themselves are kept clear too, so a name never sits on another region's pin.
  v.pins.forEach(p=>pins.push({x0:p.x-pin,x1:p.x+pin,y0:p.y-pin,y1:p.y+pin}));
  [...v.pins].sort((a,b)=>rank(a)-rank(b)||(b.score||0)-(a.score||0)).forEach(p=>{
    const w=p.name.length*fs*0.62*u, h=fs*u, gap=pin+5*u;
    // Pins outside what's shown need no name; one inside is named above or below its pin, pulled
    // in from the edge when it would run off it, else beside the pin.
    if(p.x<vx||p.x>vx+vw||p.y<vy||p.y>vy+vh) return;
    const inX=x=>Math.max(vx+w/2+3*u,Math.min(vx+vw-w/2-3*u,x));
    const spots=[[inX(p.x),p.y-gap],[inX(p.x),p.y+gap+h],[p.x+gap+w/2,p.y+h*0.35],[p.x-gap-w/2,p.y+h*0.35]];
    for(const [x,y] of spots){ const b=box(x,y,w,h); if(fits(b)){ placed.push(b); out.push({kind:'region',t:p.name,x,y,fs:fs*u,on:p.state==='open'}); break; } }
  });
  return out;
}
/* The page of a region (RegionPageScreen, screen 'region-page'), from the map's card or the list; back returns to Mastery
   where they were. */
function openRegionPage(name,nav){ Handoff.regionPage.set(name); nav('region-page'); }
/* The card a tapped pin opens, under the map: the region's name and flag, its country and key
   grapes, where they stand with it (level, score, rise, fading answers, bottles they've had), its
   next step, and "More" for its own page. Pins close together under the finger are offered as
   "Also here". */
function MapRegionCard({names,p,nav,showPro,prog,onOpen,onPick,onClose}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const info=React.useMemo(()=>RegionInfo.get(p.name),[p.name]);
  const on=p.state==='open', others=names.filter(n=>n!==p.name);
  const step=on?((p.score<100||p.fading>0)?{t:p.fading?'Refresh':'Take the quiz',go:()=>_openLearn({kind:'region',region:p.name},nav,showPro)}:null)
    :p.state==='held'?{t:'Unlock with Pro',go:()=>showPro('regions')}:null;
  return <div data-testid="map-picked" data-region={p.name} style={{background:T.glass,border:`1px solid ${T.line}`,borderRadius:14,padding:'12px 14px',display:'flex',flexDirection:'column',gap:8,boxShadow:'0 2px 10px rgba(0,0,0,0.06)'}}>
    <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
      <Flag region={p.name} size={22}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:17,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.25}}>{p.name}</div>
        {info&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{RegionInfo.line(info)}</div>}
      </div>
      <div role="button" aria-label="Close" onClick={onClose} style={{width:28,height:28,borderRadius:14,background:T.soft,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,fontSize:'16px',color:T.mid,fontFamily:C.P}}>×</div>
    </div>
    <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>
      {on?`${p.level} · ${p.score}%`:p.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet · a bottle from here unlocks it'}{on&&<RiseTag n={KnowledgeMap.itemRise(prog,'regions',p.name,p.score)} style={{marginLeft:6}}/>}
      {on&&p.fading?<span style={{color:T.amber,fontWeight:600}}>{` · ${p.fading} answer${p.fading===1?'':'s'} fading`}</span>:''}
      {p.drunk?` · you've had ${p.drunk===1?'one':p.drunk}`:''}
    </div>
    {on&&<MasteryBar score={p.score} col={cr}/>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
      {step&&<div role="button" onClick={step.go} style={{padding:'8px 14px',borderRadius:10,background:cr,color:'#fff',fontSize:14,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>{step.t}</div>}
      {info&&<div role="button" data-testid="region-more" onClick={()=>onOpen(p.name)} style={{padding:'8px 14px',borderRadius:10,border:`1px solid ${T.line}`,color:T.ink,fontSize:14,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>More about {p.name} →</div>}
    </div>
    {others.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',fontSize:13,color:T.mid,fontFamily:C.P}}>Also here:
      {others.map(n=><span key={n} role="button" onClick={()=>onPick(n)} style={{padding:'3px 9px',borderRadius:999,border:`1px solid ${T.line}`,color:T.ink2,cursor:'pointer'}}>{n}</span>)}
    </div>}
  </div>;
}
function MasteryRegionMap({views,nav,showPro,prog,onLeave}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  // Map or list, and which part of the world, as they last left it (Device.masteryView).
  const saved=React.useRef(Device.masteryView()).current;
  const [mode,setModeS]=React.useState(saved.regions==='list'?'list':'map');
  const setMode=x=>{ setModeS(x); Device.setMasteryView({regions:x}); };
  const [vid,setVidS]=React.useState(()=>{ if(saved.regionView&&views.some(x=>x.id===saved.regionView)) return saved.regionView; const v=KnowledgeMap.homeView(views); return v?v.id:null; });
  const setVid=x=>{ setVidS(x); Device.setMasteryView({regionView:x}); };
  const [sel,setSel]=React.useState([]);
  const v=views.find(x=>x.id===vid)||views[0];
  const Z=useMapZoom(v?v.w:1,v?v.h:1), z=Z.z;
  if(!v) return null;
  const u=(v.w/z.k)/(Z.px||320); // map units per screen pixel
  // Pins, their outlines and how near a finger must land, all in screen pixels: pins grow a
  // little as they zoom in, and a tap anywhere within HIT of a pin's centre picks it.
  // Small zoomed out (Europe has 36 pins on a phone), growing as they zoom in.
  const PIN=Math.min(11,3+1.5*z.k)*u, HIT=Math.max(PIN+10*u,24*u), SW=u;
  const names=_mapLabels(v,z,u,PIN);
  const tap=(x,y)=>setSel(v.pins.map(p=>({p,d:Math.hypot(p.x-x,p.y-y)})).filter(o=>o.d<=HIT).sort((a,b)=>a.d-b.d).slice(0,4).map(o=>o.p.name));
  const zbtn={width:34,height:34,borderRadius:10,background:T.dark?'rgba(26,26,28,0.94)':'rgba(255,255,255,0.94)',border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'18px',fontWeight:700,color:T.ink,fontFamily:C.P,userSelect:'none',boxShadow:'0 1px 3px rgba(0,0,0,0.08)'};
  const picked=sel.map(n=>v.pins.find(p=>p.name===n)).filter(Boolean);
  const openPage=n=>{ onLeave&&onLeave(); openRegionPage(n,nav); };
  const open=v.pins.filter(p=>p.state==='open').length;
  const legend=[[T.dark?'rgba(255,255,255,0.25)':'#CFC9C2','Not unlocked'],[_PIN_COL['Getting started'],'Getting started'],[T.lift(_PIN_COL.Developing),'Developing'],[cr,'Confident'],[T.green,'Mastered']];
  const anyFading=v.pins.some(p=>p.fading);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <MasteryToggle label="Show regions as" testid="region-mode" options={[['map','Map'],['list','List']]} value={mode} onChange={setMode}/>
      <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',margin:'0 -2px'}}>
        {views.map(x=>{ const on=x.id===v.id; return(
          <div key={x.id} role="button" aria-pressed={on} onClick={()=>{ setVid(x.id); setSel([]); Z.reset(); }} style={{flex:'0 0 auto',padding:'6px 11px',borderRadius:999,background:on?T.ink:T.glass,border:`1px solid ${on?T.ink:T.line}`,cursor:'pointer',fontSize:13,fontWeight:600,color:on?T.bg:T.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>
            {x.label} <span style={{opacity:0.6}}>{x.open}/{x.pins.length}</span>
          </div>); })}
      </div>
      {mode==='list'?<div data-testid="region-list" style={{display:'flex',flexDirection:'column',borderTop:`1px solid ${T.line}`}}>
        {KnowledgeMap.regionRows(v).map(p=><_RegionRow key={p.name} p={p} nav={nav} showPro={showPro} bar prog={prog} onOpen={openPage}/>)}
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:8}}>Scanning a bottle from a region unlocks it.</div>
      </div>:<>
      <div style={{position:'relative'}}>
      <svg ref={Z.ref} viewBox={`${z.x.toFixed(2)} ${z.y.toFixed(2)} ${(v.w/z.k).toFixed(2)} ${(v.h/z.k).toFixed(2)}`} width="100%" {...Z.bind(tap)} role="img" data-testid="region-map" data-zoom={z.k.toFixed(2)}
        aria-label={`Map of ${v.label}: ${open} of ${v.pins.length} wine regions unlocked. Tap a region to see it; pinch or use + and − to zoom.`}
        style={{display:'block',borderRadius:12,background:T.dark?T.card:'#FDFCFA',border:`1px solid ${T.line}`,cursor:z.k>1?'grab':'pointer',maxHeight:420,touchAction:z.k>1?'none':'pan-y',userSelect:'none',WebkitUserSelect:'none'}}>
        {/* A hollow outline map in muted colours: the land barely tinted, one thin coastline and
            fainter borders, so the pins carry it. Widths are screen pixels (u), fine at any zoom. */}
        <path d={v.land} fill={T.dark?"rgba(255,255,255,0.06)":"#F6F3EE"} stroke={T.dark?"rgba(255,255,255,0.35)":"#B5ABA0"} strokeWidth={0.8*u} strokeLinejoin="round"/>
        <path d={v.borders} fill="none" stroke={T.dark?"rgba(255,255,255,0.12)":"#DCD4CA"} strokeWidth={0.6*u} strokeLinejoin="round"/>
        {names.filter(n=>n.kind==='country').map(n=><text key={'c'+n.t} x={n.x} y={n.y} textAnchor="middle" data-label="country" style={{fontSize:n.fs.toFixed(2)+'px',fontWeight:700,letterSpacing:'0.06em',fill:T.dark?'rgba(255,255,255,0.45)':'#A39A90',fontFamily:C.P,paintOrder:'stroke',stroke:T.dark?T.card:'#F6F3EE',strokeWidth:(3*u).toFixed(2),strokeLinejoin:'round',pointerEvents:'none'}}>{n.t}</text>)}
        {[...v.pins].sort((a,b)=>(a.state==='open')-(b.state==='open')).map(p=>{
          const on=sel[0]===p.name, first=p.state==='open'&&p.level==='Not started';
          return <g key={p.name}>
            {p.drunk>0&&<circle cx={p.x} cy={p.y} r={PIN+4*SW} fill="none" stroke={T.dark?"rgba(255,255,255,0.75)":"#6B625A"} strokeWidth={1.6*SW}/>}
            <circle cx={p.x} cy={p.y} r={on?PIN+3*SW:p.state==='open'?PIN:PIN-2*SW} fill={_pinFill(p,T)} fillOpacity={p.fading?0.4:1} strokeDasharray={p.fading?`${3*SW} ${2*SW}`:null} stroke={on?T.ink:first?cr:(T.dark?T.bg:'#fff')} strokeWidth={(on?2.5:first?2.5:2)*SW}/>
          </g>;
        })}
        {names.filter(n=>n.kind==='region').map(n=><text key={'r'+n.t} x={n.x} y={n.y} textAnchor="middle" data-label="region" style={{fontSize:n.fs.toFixed(2)+'px',fontWeight:n.on?800:600,fill:n.on?T.ink:(T.dark?'rgba(255,255,255,0.6)':'#7D736A'),fontFamily:C.P,paintOrder:'stroke',stroke:T.dark?T.card:'#F6F3EE',strokeWidth:(3*u).toFixed(2),strokeLinejoin:'round',pointerEvents:'none'}}>{n.t}</text>)}
      </svg>
      <div style={{position:'absolute',right:8,top:8,display:'flex',flexDirection:'column',gap:6}}>
        <div role="button" aria-label="Zoom in" onClick={()=>Z.zoomAt(1.6)} style={zbtn}>+</div>
        <div role="button" aria-label="Zoom out" onClick={()=>Z.zoomAt(1/1.6)} style={{...zbtn,opacity:z.k>1?1:0.45}}>−</div>
      </div>
      {z.k>1&&<div role="button" onClick={Z.reset} style={{...zbtn,position:'absolute',left:8,top:8,width:'auto',padding:'0 10px',fontSize:'13px',fontWeight:600}}>Reset</div>}
      </div>
      <div aria-hidden="true" style={{display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
        {legend.map(([c,l])=><span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:T.mid,fontFamily:C.P}}><span style={{width:9,height:9,borderRadius:5,background:c,border:`1px solid ${T.line}`}}/>{l}</span>)}
        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:T.mid,fontFamily:C.P}}><span style={{width:9,height:9,borderRadius:6,border:`2px solid ${T.dark?'rgba(255,255,255,0.75)':'#6B625A'}`}}/>You've had one</span>
        {anyFading&&<span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:T.mid,fontFamily:C.P}}><span style={{width:9,height:9,borderRadius:6,background:cr,opacity:0.4,border:`1px dashed ${cr}`}}/>Fading: time for a refresher</span>}
      </div>
      {picked.length?<MapRegionCard names={sel} p={picked[0]} nav={nav} showPro={showPro} prog={prog} onOpen={openPage}
        onPick={n=>setSel(s=>[n,...s.filter(x=>x!==n)])} onClose={()=>setSel([])}/>:<div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Tap a pin to see a region; pinch to zoom in and see their names. Scanning a bottle unlocks its region.</div>}
      </>}
    </div>
  );
}

/* What they can taste (Palate, pwa-palate.js), beside what they know: their Blind Calls scored
   against each label's profile, a bar per axis with how to notice it, any habit ("you tend to
   call tannins grippier"), and the next step. Not part of the knowledge score. */
/* Their palate as tiles, one per trait (body, acidity, tannins, texture): the thing it tastes
   like, sketched (SketchTraitIcon), inside a ring that fills to how close their Blind Calls come
   to the label on that trait, with the number written out large beside it, its level and any
   habit ("you call it grippier"). A trait with no calls yet shows a dash and says so. Every tile
   opens the trait's own page (PalateTraitScreen), like a grape's. */
const PALATE_TRAITS=['body','acidity','tannins','texture'];
/* A palate trait as a small ring with the score inside, lit in the trait's colour and glowing on
   the dark stage, the trait named under it and then its level, or the habit the calls lean to
   ("You say" over "Softer" in amber). Four across. Tapping opens the trait's page. */
function _PalateTile({id,a,onOpen}){ const T=useTheme();
  const sc=a?a.score:null, col=T.lift(SKETCH_TRAIT[id]), track=T.dark?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.08)';
  const lean=a&&a.lean?a.lean.charAt(0).toUpperCase()+a.lean.slice(1):null;
  return <div role="button" tabIndex={0} data-trait={id} onClick={()=>onOpen(id)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); onOpen(id); } }}
    aria-label={`${Palate.NAMES[id]}: ${sc==null?'no Blind Calls yet':`${sc}% on target${a.lean?`, you call it ${a.lean}`:''}`}. Open its page.`}
    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer',minWidth:0,padding:'4px 0'}}>
    <svg width="66" height="66" viewBox="-33 -33 66 66" aria-hidden="true" style={{overflow:'visible',flexShrink:0}}>
      <circle r={28} fill="none" stroke={track} strokeWidth="6"/>
      {sc!=null&&sc>0&&<circle r={28} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" className="palate-arc" pathLength="100" strokeDasharray="100" strokeDashoffset={100-sc} transform="rotate(-90)" style={{filter:T.dark?`drop-shadow(0 0 6px ${col})`:'none'}}/>}
      <text y="6" textAnchor="middle" style={{fontSize:'17px',fontWeight:800,fill:sc==null?T.mid:T.ink,fontFamily:C.P}}>{sc==null?'–':sc}</text>
    </svg>
    <span style={{fontSize:13,fontWeight:700,color:T.ink,fontFamily:C.P,marginTop:2}}>{Palate.NAMES[id]}</span>
    {sc==null?<span style={{fontSize:13,color:T.mid,fontFamily:C.P,textAlign:'center'}}>No calls yet</span>
      :lean?<span style={{display:'flex',flexDirection:'column',alignItems:'center',lineHeight:1.15}}><span style={{fontSize:13,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>You say</span><span style={{fontSize:13,fontWeight:700,color:T.amber,fontFamily:C.P}}>{lean}</span></span>
      :<span style={{fontSize:13,color:T.mid,fontFamily:C.P,textAlign:'center'}}>{KnowledgeMap.level(sc)}</span>}
  </div>;
}
function PalateTiles({p,onOpen}){
  const T=useTheme();
  return <div data-testid="palate-tiles" style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:4,background:T.dark?'rgba(255,255,255,0.05)':'#FBF8F3',border:`1px solid ${T.line}`,borderRadius:16,padding:'12px 6px 8px'}}>
    {PALATE_TRAITS.map(id=><_PalateTile key={id} id={id} a={p.axes.find(x=>x.id===id)} onOpen={onOpen}/>)}
  </div>;
}
function MasteryPalate({p,go,onOpen}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <PalateTiles p={p} onOpen={onOpen}/>
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>Each % is how close your Blind Calls come to the label on that trait. Tap one to learn how to taste it and see every call.</div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <span style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{p.n?`${p.level} · ${p.score}%`:'Not started'}</span>
        <span style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{p.n} Blind Call{p.n===1?'':'s'}{p.trend!=null&&p.trend!==0?` · ${p.trend>0?'+':''}${p.trend} lately`:''}</span>
      </div>
      <MasteryBar score={p.score}/>
      <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>
        {p.n?<>Your calls average {p.accuracy}% accurate{p.n<Palate.FULL_AT?`. The rating fills in as you play: ${Palate.FULL_AT-p.n} more to count in full`:''}. Each call is checked against the label's profile, an estimate, so treat it as a guide.</>
          :<>Blind Call asks you to taste first and guess the body, acidity and tannins before you see the label's profile. Your calls build this rating, separate from what you've read.</>}
      </div>
      {p.next&&<div role="button" onClick={()=>go(p.next)} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer'}}>{p.next.label} →</div>}
    </div>
  );
}

/* A milestone reached just now (Milestones.check): shown once, where it happened (the quiz
   result, or Mastery), with Share (Platform.shareText: the share sheet, else copied). */
function _useShare(){
  const [said,setSaid]=React.useState(null);
  const share=async x=>{ const r=await Platform.shareText(Milestones.shareText(x)); if(r==='copied'){ setSaid('Copied to share'); setTimeout(()=>setSaid(null),2200); } };
  return [share,said];
}
function MilestoneMoment({items}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const [share,said]=_useShare();
  if(!items||!items.length) return null;
  return(
    <div data-testid="milestone-moment" className="milestone-in" style={{background:T.ink,borderRadius:16,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
      <div style={{fontSize:13,fontWeight:600,color:'#E7C66B',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>{items.length===1?(items[0].id.startsWith('level:')?'New level':'New milestone'):`${items.length} new milestones`}</div>
      {items.map(x=>(
        <div key={x.id} style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:38,height:38,borderRadius:19,background:'rgba(231,198,107,0.16)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={x.icon} sz={18} col="#E7C66B"/></div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>{x.region&&<Flag region={x.region} size={15} style={{marginRight:6}}/>}{x.title}</div>
            {x.sub&&<div style={{fontSize:13,color:'rgba(255,255,255,0.6)',fontFamily:C.P}}>{x.sub}</div>}
          </div>
          <div role="button" aria-label={`Share: ${x.title}`} onClick={()=>share(x)} style={{padding:'7px 12px',borderRadius:999,background:'rgba(255,255,255,0.12)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <Icon n="share" sz={14} col="#fff"/><span style={{fontSize:13,fontWeight:700,color:'#fff',fontFamily:C.P}}>Share</span>
          </div>
        </div>
      ))}
      {said&&<div style={{fontSize:13,color:'#7FD3A6',fontFamily:C.P}}>{said}</div>}
    </div>
  );
}
function MilestoneList({items}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const [share,said]=_useShare();
  if(!items.length) return <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.5}}>Your first comes with your first region studied, or Confident in a wine type. Each one is marked here, with a date.</div>;
  return <div style={{display:'flex',flexDirection:'column'}}>
    <ShowMore items={items} limit={4} noun="milestones" render={x=>(
      <div key={x.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:`1px solid ${T.line}`}}>
        <Icon n={x.icon} sz={17} col={cr}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>{x.region&&<Flag region={x.region} size={14} style={{marginRight:6}}/>}{x.title}</div>
          <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{x.at?new Date(x.at).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'}):'Earlier'}</div>
        </div>
        <div role="button" aria-label={`Share: ${x.title}`} onClick={()=>share(x)} style={{padding:6,cursor:'pointer'}}><Icon n="share" sz={16} col={T.mid}/></div>
      </div>
    )}/>
    {said&&<div style={{fontSize:13,color:T.green,fontFamily:C.P,marginTop:6}}>{said}</div>}
  </div>;
}

/* Mastery's grape bunches (KnowledgeMap.grapeCluster): every grape on the Learn list as a
   berry, red skins in one bunch, white and pink in the other, drawn as an ink-and-wash sketch
   (pwa-sketch.jsx) and sized by mastery, so the bunches fill out as they learn. Not yet
   unlocked: a small pencil outline. Unlocked, not started: an outline in its colour. Studying:
   washed, growing to fill its spot. Mastered: full, with hatching. Fading: dashed and pale.
   Berries grow from what this phone last showed (Device.grapesSeen) to today's size; reduced
   motion shows them as they are. Each berry is a labelled button that opens the grape's page. */
const _SKIN_NAME={red:'Red grape',white:'White grape',pink:'Pink-skinned grape'};
// Close to full size even before they're learnt, so the bunch reads as a bunch; learning
// grows a berry until it slightly overlaps its neighbours, as a ripe bunch does.
const _BERRY_MIN=0.95, _BERRY_START=1, _BERRY_FULL=1.2;
function _berryScale(state,score){ return state!=='open'?_BERRY_MIN:_BERRY_START+(_BERRY_FULL-_BERRY_START)*Math.min(100,score)/100; }
function _berryState(g){ return g.state!=='open'?'locked':g.score>=100?'ripe':g.score>0?'grow':'start'; }
function _berrySaid(g){
  const state=g.state==='open'?`${g.level}, ${g.score}%${g.fading?`, ${g.fading} answer${g.fading===1?'':'s'} fading`:''}`:g.state==='held'?'unlocked, kept for Pro':'not unlocked yet';
  return `${g.name}, ${_SKIN_NAME[g.skin].toLowerCase()}: ${state}`;
}
function openGrapePage(name,nav){ Handoff.grapePage.set(name); nav('grape'); }
/* The grapes as a list: red, then white and pink, each grape with its level and score; a tap
   opens its page, as a tap on the bunch does. */
function MasteryGrapeList({c,open,skin,prog}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const rows=React.useMemo(()=>KnowledgeMap.grapeRows(c).filter(b=>!skin||b.id===skin),[c,skin]);
  const said=g=>g.state==='open'?(g.score>0?`${g.level}`:'Not started'):g.state==='held'?'Kept for Pro':'Not unlocked yet';
  return <div data-testid="grape-list" style={{display:'flex',flexDirection:'column',gap:14}}>
    {rows.map(b=><div key={b.id} style={{display:'flex',flexDirection:'column'}}>
      {b.grapes.map(g=>{
        const col=T.lift(SKETCH_WASH[g.skin]||SKETCH_WASH.red), on=g.state==='open';
        return <div key={g.name} role="button" tabIndex={0} aria-label={_berrySaid(g)} onClick={()=>open(g.name)}
          onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(g.name); } }}
          style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}>
          <span aria-hidden="true" style={{width:12,height:12,borderRadius:6,flexShrink:0,background:on&&g.score>0?col:'transparent',border:`1.5px solid ${on?col:PENCIL}`}}/>
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:4}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8}}>
              <span style={{fontSize:15,fontWeight:600,color:on?T.ink:T.mid,fontFamily:C.P}}>{g.name}</span>
              <span style={{fontSize:13,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap',display:'inline-flex',alignItems:'baseline',gap:4}}>{g.fading>0&&<span style={{color:T.amber,fontWeight:600}}>fading · </span>}{said(g)}<RiseTag n={on?KnowledgeMap.itemRise(prog,'grapes',g.name,g.score):0} style={{marginLeft:4}}/>{on?<b style={{color:T.ink,marginLeft:4}}>{g.score}%</b>:''}</span>
            </div>
            {on&&<MasteryBar score={g.score} col={col}/>}
          </div>
          <Icon n="chevron" sz={14} col={T.mid}/>
        </div>;
      })}
    </div>)}
  </div>;
}
function MasteryGrapes({m,nav,view,setView,onOpen,prog}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const c=React.useMemo(()=>KnowledgeMap.grapeCluster(m),[m]);
  const seen=React.useRef(Device.grapesSeen());
  const [grown,setGrown]=React.useState(false);
  React.useEffect(()=>{
    let a=requestAnimationFrame(()=>{ a=requestAnimationFrame(()=>setGrown(true)); });
    const now={}; c.bunches.forEach(b=>b.grapes.forEach(g=>{ now[g.name]=g.state==='open'?g.score:-1; }));
    Device.setGrapesSeen(now);
    return()=>cancelAnimationFrame(a);
  },[c]);
  const open=name=>{ if(onOpen) onOpen(); openGrapePage(name,nav); };
  const W=340, GAP=16, colW=(W-GAP)/2;
  const k=Math.min(...c.bunches.map(b=>colW/b.w)), R=k, TOP=40;
  const H=Math.ceil(Math.max(...c.bunches.map(b=>b.h))*k+TOP+24);
  const from=g=>{ const v=seen.current[g.name]; return v==null||v<0?_BERRY_MIN:_berryScale('open',v); };
  const key=g=>e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(g.name); } };
  // Red or white in the list, as they last left it (Device.masteryView).
  const [skin,setSkinS]=React.useState(()=>Device.masteryView().grapeSkin==='white'?'white':'red');
  const setSkin=x=>{ setSkinS(x); Device.setMasteryView({grapeSkin:x}); };
  const count=id=>{ const b=c.bunches.find(x=>x.id===id); return b?`${b.grapes.filter(g=>g.score>0).length}/${b.grapes.length}`:''; };
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>
        <b>{c.studied}</b> of {c.total} grapes studied{c.mastered?<>, <b>{c.mastered}</b> mastered</>:''}. {view==='list'?'Tap a grape to open its page.':'Each grape fills in as you learn it; tap one to open its page.'}
      </div>
      <MasteryToggle label="Show grapes as" testid="grape-mode" options={[['bunch','Bunches'],['list','List']]} value={view} onChange={setView}/>
      {view==='list'&&<MasteryToggle label="Grape colour" testid="grape-skin" options={[['red',`Red · ${count('red')}`],['white',`White · ${count('white')}`]]} value={skin} onChange={setSkin}/>}
      {view==='list'?<MasteryGrapeList c={c} open={open} skin={skin} prog={prog}/>:<>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" data-testid="grape-cluster" style={{display:'block',maxWidth:440,margin:'0 auto',overflow:'visible'}}>
        {c.bunches.map((b,bi)=>{
          const cx=colW/2+bi*(colW+GAP), x0=cx-(Math.max(...b.grapes.map(g=>g.x))+Math.min(...b.grapes.map(g=>g.x)))/2*k;
          return <g key={b.id}>
            <SketchVine x={x0} y={TOP-R*0.1} s={1.2} leafRed={false} ink={INK}/>
            {[...b.grapes].sort((p,q)=>p.y-q.y).map(g=>{ // top first: lower berries hang over upper ones
              const x=x0+g.x*k, y=TOP+R+g.y*k, sc=grown?_berryScale(g.state,g.score):from(g);
              return <g key={g.name} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`} role="button" tabIndex={0} aria-label={_berrySaid(g)}
                onClick={()=>open(g.name)} onKeyDown={key(g)} style={{cursor:'pointer',outline:'none'}} className="grape-btn">
                <circle r={R} fill="transparent" className="grape-hit"/>
                <g className="grape-berry" style={{transform:`scale(${(sc*R).toFixed(2)})`}}>
                  <SketchBerry seed={g.name} skin={g.skin} state={_berryState(g)} fading={g.fading>0} ink={INK} wash={T.dark?T.lift(SKETCH_WASH[g.skin]||SKETCH_WASH.red):undefined}/>
                </g>
              </g>;
            })}
            <text x={cx} y={H-4} textAnchor="middle" style={{fontSize:'13px',fontWeight:700,fill:T.ink2,fontFamily:C.P}}>{b.label} · {b.grapes.filter(g=>g.score>0).length}/{b.grapes.length}</text>
          </g>;
        })}
      </svg>
      <div aria-hidden="true" style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.5}}>
        Pencil outline: not unlocked yet. Washed in colour: studying, fuller as you learn. Shaded: mastered. Dashed: fading, time for a refresher.
      </div></>}
    </div>
  );
}

const _MASTERY_CSS=`@keyframes masteryGrow{from{transform:scale(0.2);opacity:0}to{transform:scale(1);opacity:1}}
.mastery-radar-shape{animation:masteryGrow .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes milestoneIn{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
.milestone-in{animation:milestoneIn .5s ease both}

.grape-berry{transition:transform .9s cubic-bezier(.2,.8,.2,1)}
@keyframes palateArc{from{stroke-dashoffset:100}}
.palate-arc{animation:palateArc 1.1s cubic-bezier(.3,.7,.2,1) both}
.grape-btn:focus-visible .grape-hit{stroke:#0F0F0F;stroke-width:2;stroke-dasharray:3 2}
@media (prefers-reduced-motion:reduce){.mastery-radar-shape,.milestone-in{animation:none}.grape-berry{transition:none}.palate-arc{animation:none}}`;

/* One section of Mastery: a heading that folds it away (a chevron, aria-expanded) and, folded, a
   one-line summary in its place, which also opens it. `plain` lays its children out without a card. */
function MasterySection({id,title,summary,folded,toggle,plain,testid,children}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  const shut=!!folded[id];
  const body={background:T.glass,borderRadius:16,border:`1px solid ${T.line}`,padding:'14px 14px 12px',display:'flex',flexDirection:'column',gap:8};
  return <section data-section={id} style={{display:'flex',flexDirection:'column',gap:8}}>
    <div role="button" tabIndex={0} aria-expanded={!shut} onClick={()=>toggle(id)}
      onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(id); } }}
      style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginTop:6,cursor:'pointer'}}>
      <span style={{fontSize:15,fontWeight:600,color:T.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>{title}</span>
      <span aria-hidden="true" style={{display:'inline-flex',transform:`rotate(${shut?90:-90}deg)`,transition:'transform .2s ease'}}><Icon n="chevron" sz={16} col={T.mid}/></span>
    </div>
    {shut?<div data-testid={`summary-${id}`} role="button" onClick={()=>toggle(id)} style={{...body,background:T.glass,border:`1px solid ${T.line}`,padding:'12px 14px',cursor:'pointer',fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>{summary}</div>
      :plain?<div data-testid={testid} style={{display:'flex',flexDirection:'column',gap:8}}>{children}</div>
      :<div data-testid={testid} style={body}>{children}</div>}
  </section>;
}
function MasteryMapScreen({nav,back,showPro}){ const T=useTheme(), cr=T.lift(C.cr), INK=T.dark?'rgba(255,255,255,0.88)':SKETCH_INK, PENCIL=T.dark?'rgba(255,255,255,0.28)':SKETCH_PENCIL;
  // On an iPad the shape sits beside the grapes and the palate beside the milestones; the map spans both.
  const wide=useWide();
  const wines=React.useMemo(()=>WineHistory.getAll(),[]);
  const m=React.useMemo(()=>{ const x=KnowledgeMap.compute(wines); KnowledgeMap.note(x); return x; },[]);
  const prog=React.useMemo(()=>KnowledgeMap.progress(m),[m]);
  const focus=React.useMemo(()=>KnowledgeMap.focus(wines,m),[m]);
  const views=React.useMemo(()=>KnowledgeMap.regionMap(wines,m),[m]);
  const palate=React.useMemo(()=>Palate.compute(wines),[wines]);
  const fresh=React.useMemo(()=>Milestones.check(m,palate),[m,palate]);
  const milestones=React.useMemo(()=>Milestones.list(),[fresh]);
  const [open,setOpen]=React.useState(null);
  const listRef=React.useRef(null);
  // Back from a grape's page returns to where they were, with the grapes shown the same way.
  const ret=React.useRef(Handoff.masteryReturn.take());
  const [grapeView,setGrapeViewS]=React.useState(()=>(ret.current&&ret.current.view||Device.masteryView().grapes)==='list'?'list':'bunch');
  const setGrapeView=x=>{ setGrapeViewS(x); Device.setMasteryView({grapes:x}); };
  React.useLayoutEffect(()=>{ const r=ret.current, el=listRef.current; if(r&&el&&r.top>0) el.scrollTop=r.top; },[]);
  const leaveMastery=()=>Handoff.masteryReturn.set({top:listRef.current?listRef.current.scrollTop:0,view:grapeView});
  const go=next=>{ if(next) _openLearn({kind:'mastery',next},nav,showPro); };
  // Sections they've folded away stay folded next time (Device.masteryCollapsed).
  const [folded,setFolded]=React.useState(()=>Device.masteryCollapsed());
  const toggle=id=>setFolded(f=>{ const n={...f}; if(n[id]) delete n[id]; else n[id]=true; Device.setMasteryCollapsed(n); return n; });
  const cluster=React.useMemo(()=>KnowledgeMap.grapeCluster(m),[m]);
  const mapCount=React.useMemo(()=>KnowledgeMap.mapCount(views),[views]);
  const summary=React.useMemo(()=>{ const s=[...m.areas].sort((a,b)=>b.score-a.score); return {strongest:s[0]&&s[0].score>0?s[0]:null}; },[m]);
  // Chart or list, as they last left it (Device.masteryView).
  const [shapeView,setShapeViewS]=React.useState(()=>Device.masteryView().shape==='list'?'list':'chart');
  const setShapeView=x=>{ setShapeViewS(x); Device.setMasteryView({shape:x}); };
  // A tap on an area in the chart opens it in the list.
  const pick=id=>{
    const a=m.areas.find(x=>x.id===id); if(a&&a.items) setOpen(id);
    setShapeView('list');
    setTimeout(()=>{ const el=listRef.current&&listRef.current.querySelector(`[data-area="${id}"]`); if(el) el.scrollIntoView({behavior:'smooth',block:'center'}); },60);
  };
  const rise=prog&&prog.rises[0];
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg}}>
      <style>{_MASTERY_CSS}</style>
      <div style={{background:`radial-gradient(ellipse at 50% -20%, ${_alpha(cr,T.dark?0.42:0.14)}, transparent 70%) ${T.dark?T.bg:C.white}`,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${T.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={T.ink}/></div>
        <span style={{fontSize:20,fontWeight:800,color:T.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>Your Mastery</span>
      </div>
      <div ref={listRef} style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={T.dark?{background:_alpha(cr,0.16),border:`1px solid ${_alpha(cr,0.4)}`,boxShadow:`0 0 36px ${_alpha(cr,0.18)}`,borderRadius:16,padding:'18px 16px',display:'flex',flexDirection:'column',gap:8}:{background:C.ink,borderRadius:16,padding:'18px 16px',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.5)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Your wine knowledge</div>
          <div style={{fontSize:32,fontWeight:800,color:'#fff',fontFamily:C.P}}>{m.overall}% <span style={{fontSize:16,fontWeight:600,color:'rgba(255,255,255,0.6)'}}>{m.level}</span>
            {prog&&prog.overall>0&&<span style={{fontSize:15,fontWeight:700,color:'#7FD3A6',marginLeft:8}}>▲{prog.overall} in {prog.weeks} week{prog.weeks===1?'':'s'}</span>}</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.65)',fontFamily:C.P,lineHeight:1.5}}>Built from the articles you've read and the quizzes you've passed. Only studying and testing move it.</div>
          {focus&&focus.score<100&&<div data-testid="mastery-focus" style={{marginTop:4,background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 12px',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.5)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Start here</div>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>{focus.area&&focus.area.id==='regions'&&<Flag region={focus.label} size={16} style={{marginRight:6}}/>}{focus.label}</div>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.75)',fontFamily:C.P,lineHeight:1.45}}>{focus.why||`Your biggest gap, at ${focus.score}%.`}</div>
            {focus.next&&<div role="button" onClick={()=>go(focus.next)} style={{fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>{focus.next.label} →</div>}
          </div>}
        </div>

        <MilestoneMoment items={fresh}/>

        <WideColumns>
        <MasterySection id="shape" title="Your shape" folded={folded} toggle={toggle}
          summary={`${m.overall}% overall${rise?` · biggest rise ${rise.label} +${rise.delta}`:summary.strongest?` · strongest ${summary.strongest.label} ${summary.strongest.score}%`:''}`}>
          <MasteryToggle label="Show your shape as" testid="shape-mode" options={[['chart','Chart'],['list','List']]} value={shapeView} onChange={setShapeView}/>
          {shapeView==='list'?<MasteryAreaList m={m} prog={prog} open={open} setOpen={setOpen} go={go}/>:<>
          <div style={{background:T.dark?T.soft:'#FBF8F3',borderRadius:12,padding:'8px 4px 4px'}}><MasteryRadar m={m} prog={prog} onPick={pick}/></div>
          <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}} aria-hidden="true">
            <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:T.mid,fontFamily:C.P}}><span style={{width:16,height:0,borderTop:`2px solid ${INK}`}}/>Now</span>
            {prog&&<span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:T.mid,fontFamily:C.P}}><span style={{width:16,height:0,borderTop:`2px dotted ${T.mid}`}}/>{_when(prog.then.t)}</span>}
          </div>
          <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>
            {prog?(rise?<>Since {_when(prog.then.t)} your biggest rise is <b>{rise.label}</b> (+{rise.delta}).{prog.rises.length>1?` ${prog.rises.length-1} other area${prog.rises.length===2?' has':'s have'} grown too.`:''}</>
              :<>No change since {_when(prog.then.t)}. A quiz or an article moves the shape.</>)
              :<>A rounder shape means rounder knowledge. From next week, a dotted outline shows where you were, so you can see it grow.</>} Tap an area, or List, for the detail behind each number.
          </div></>}
        </MasterySection>
        <MasterySection id="grapes" title="Your grapes" folded={folded} toggle={toggle}
          summary={`${cluster.studied} of ${cluster.total} grapes studied${cluster.mastered?` · ${cluster.mastered} mastered`:''}`}>
          <MasteryGrapes m={m} nav={nav} view={grapeView} setView={setGrapeView} onOpen={leaveMastery} prog={prog}/>
        </MasterySection>
        </WideColumns>

        <MasterySection id="map" title="Your wine map" folded={folded} toggle={toggle}
          summary={`${mapCount.open} of ${mapCount.total} regions unlocked`}>
          <MasteryRegionMap views={views} nav={nav} showPro={showPro} prog={prog} onLeave={leaveMastery}/>
        </MasterySection>

        <WideColumns>
        <MasterySection id="palate" title="Your palate" testid="mastery-palate" folded={folded} toggle={toggle}
          summary={palate.n?`${palate.score}% · ${palate.level} · from ${palate.n} Blind Call${palate.n===1?'':'s'}`:'No Blind Calls yet'}>
          <MasteryPalate p={palate} go={go} onOpen={id=>{ leaveMastery(); Handoff.palateTrait.set(id); nav('palate-trait'); }}/>
        </MasterySection>
        <MasterySection id="milestones" title="Milestones" testid="mastery-milestones" folded={folded} toggle={toggle}
          summary={milestones.length?`${milestones.length} earned · latest: ${milestones[0].title}`:'None yet'}>
          <MilestoneList items={milestones}/>
        </MasterySection>
        </WideColumns>

        <div style={{height:12}}/>
      </div>
    </div>
  );
}

/* ── Dynamic quiz assembly ── */
function _shuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function _shuffleOpts(q){
  const correctText=q.opts[q.a];
  const opts=_shuffle(q.opts);
  return {...q, opts, a:opts.indexOf(correctText)};
}
function assembleConceptQuiz(conceptIds){
  const d=MasterySystem.get();
  return conceptIds.map(cid=>{
    const box=d[cid]?d[cid].box:0;
    const tier=MasterySystem.tierFor(box);
    const t=QExposure.pickTemplate(cid,tier);
    return t?_shuffleOpts(t):null;
  }).filter(Boolean);
}
const _GLOSSARY_FALLBACK=[
  {term:'Tannin',meaning:'The dry, gripping sensation on your gums and tongue, mainly from grape skins and seeds'},
  {term:'Acidity',meaning:'The tart, mouthwatering edge that keeps a wine feeling fresh rather than flat'},
  {term:'Body',meaning:'How light or heavy a wine feels in the mouth, from watery to viscous'},
  {term:'Finish',meaning:'How long the flavor lingers on your palate after you swallow'},
  {term:'Terroir',meaning:'The combination of soil, climate, and site that shapes a wine\u2019s character'},
  {term:'Vintage',meaning:'The year the grapes were harvested'},
  {term:'Oxidation',meaning:'Flavor and color changes caused by a wine\u2019s exposure to air'},
  {term:'Malolactic fermentation',meaning:'A process that converts sharp malic acid into softer lactic acid'},
  {term:'Decanting',meaning:'Pouring wine into a separate vessel to aerate it or separate it from sediment'},
  {term:'Sommelier',meaning:'A trained wine professional who advises on selection and service'},
  {term:'Appellation',meaning:'A legally defined region whose name a wine can carry on its label'},
  {term:'Varietal',meaning:'A wine named for the single grape variety it\u2019s made from'},
  {term:'Legs',meaning:'The streaks that run down a glass after swirling, related to alcohol and sugar content'},
  {term:'Corked',meaning:'A wine fault from a contaminated cork that gives musty, wet-cardboard smells'},
  {term:'Sulfites',meaning:'Preservatives, naturally present or added, that protect wine from oxidation and spoilage'}
];
function assembleWordsQuiz(){
  const terms=VocabLedger.getAll();
  const pool=_shuffle(terms).slice(0,6);
  const usedMeanings=new Set(pool.map(t=>t.meaning));
  return pool.map(t=>{
    const candidates=_shuffle([
      ...terms.filter(x=>x.term!==t.term),
      ..._GLOSSARY_FALLBACK.filter(x=>x.term!==t.term)
    ]);
    const distractors=[];
    for(const c of candidates){
      if(distractors.length>=3) break;
      if(c.meaning===t.meaning) continue;
      if(usedMeanings.has(c.meaning)) continue;
      distractors.push(c.meaning);
      usedMeanings.add(c.meaning);
    }
    while(distractors.length<3) distractors.push('None of these');
    const opts=_shuffle([t.meaning,...distractors]);
    return {q:`What does "${t.term}" mean?`,opts,a:opts.indexOf(t.meaning),fact:null,conceptId:null,vocabTerm:t.term};
  });
}
/* Region, Wine Basics and grape quizzes all draw QUIZ_SIZE questions from their full pool via
   QuizMastery: unanswered questions first, then review. Options are reshuffled every time. */
function _drawQuiz(setId,pool){
  return QuizMastery.draw(setId,pool).map(q=>_shuffleOpts({...q,fact:q.fact||null,conceptId:null,vocabTerm:null}));
}
function quizSetFor(mode,config){
  if(mode==='region') return {id:RegionQuizBank.setId(config.region),pool:()=>RegionQuizBank.pool(config.region)};
  if(mode==='practice') return {id:'topic:'+config.topicId,pool:()=>QuizMastery.topicPool(config.topicId)};
  if(mode==='grape') return {id:'grape:'+config.grape,pool:()=>config.questions||[]};
  if(mode==='guide') return {id:Guides.setId(config.guideId),pool:()=>Guides.pool(config.guideId)};
  return null;
}
function buildQuizQuestions(config){
  const mode=config?.mode||'concept';
  const set=quizSetFor(mode,config);
  if(set) return _drawQuiz(set.id,set.pool());
  if(mode==='words') return assembleWordsQuiz();
  return assembleConceptQuiz(MasterySystem.selectConcepts(6));
}
function quizTitle(config){
  const mode=config?.mode||'concept';
  return mode==='practice'?(QUIZ_TOPICS.find(t=>t.id===config.topicId)||QUIZ_TOPICS[0]).label
    :mode==='words'?"Words You've Met"
    :mode==='region'?'Your '+config.region+' Knowledge'
    :mode==='grape'?'The '+config.grape+' Quiz'
    :mode==='guide'?((Guides.byId(config.guideId)||{}).title||'Wine Skills')
    :'Concept Check';
}
/* What to offer once a set is complete: the next unfinished set of the same kind, then Wine
   Basics, then regions (only once WineDNA has unlocked them, as on the Learn tab), then
   unlocked grapes. null means everything on offer is done. */
function nextQuizSuggestion(config){
  const wines=WineHistory.getAll();
  const topics=QUIZ_TOPICS.filter(t=>t.id!==config.topicId&&!QuizMastery.isComplete('topic:'+t.id,QuizMastery.topicPool(t.id)))
    .map(t=>({config:{mode:'practice',topicId:t.id},label:t.label}));
  const regions=regionQuizCandidates(wines).filter(r=>r!==config.region)
    .map(r=>({config:{mode:'region',region:r},label:[Regions.flag(r),r].filter(Boolean).join(' ')}));
  const grapes=Object.keys(GrapeUnlocks.all()).filter(g=>g!==config.grape&&!grapeQuizComplete(g))
    .map(g=>({config:{mode:'grape',grape:g},label:g}));
  const guides=Guides.queue().filter(g=>g.id!==config.guideId&&Guides.isRead(g.id)&&!Guides.passed(g.id))
    .map(g=>({config:{mode:'guide',guideId:g.id},label:g.title}));
  const order=config.mode==='region'?[regions,topics,grapes,guides]:config.mode==='grape'?[grapes,topics,regions,guides]:config.mode==='guide'?[guides,topics,regions,grapes]:[topics,regions,grapes,guides];
  for(const list of order) if(list.length) return list[0];
  return null;
}

/* ── QUIZ SCREEN ── */
function QuizScreen({nav,back}){ const T=useTheme(), cr=T.lift(C.cr);
  // On an iPad the question, the review and the buttons sit in a centred column (side), not across the screen.
  const wide=useWide(), side=wide?'max(16px, calc((100% - 720px) / 2))':'16px';
  // Config is state so the results screen can move straight on to the next quiz or set.
  const [config,setConfig]=React.useState(()=>{
    try{ return Handoff.quiz.get(); }catch(e){ return null; }
  });
  const mode=config?.mode||'concept';
  const quizSet=React.useMemo(()=>quizSetFor(mode,config),[mode,config]);

  const [allQs,setAllQs]=React.useState(()=>buildQuizQuestions(config));
  // Whether this set was already complete when the quiz started, so the results screen can
  // tell "you just completed it" apart from practising a finished set.
  const [startedComplete,setStartedComplete]=React.useState(()=>{ const qs=quizSetFor(mode,config); return !!qs&&QuizMastery.isComplete(qs.id,qs.pool()); });
  const [nextLoading,setNextLoading]=React.useState(false);
  const [qIdx,setQIdx]=React.useState(0);
  const [selected,setSelected]=React.useState(null);
  const [phase,setPhase]=React.useState(allQs.length?'question':'empty');
  const [streak,setStreak]=React.useState(0);
  const [bestStreak,setBestStreak]=React.useState(0); // the round's best run, said on the result
  const [xpGained,setXpGained]=React.useState(0);
  const [milestones,setMilestones]=React.useState([]);
  const [refreshed,setRefreshed]=React.useState(0); // fading answers brought back this round
  const startLevel=React.useRef(XPSystem.getLevel(XPSystem.get().total).name);
  const [results,setResults]=React.useState([]);
  const [, setResetTick]=React.useState(0);
  const scrollRef=React.useRef(null);
  // Each question opens at its top: the previous one may have been scrolled to reach its answers.
  const qRef=React.useRef(null);
  React.useLayoutEffect(()=>{ if(qRef.current) qRef.current.scrollTop=0; },[qIdx,phase==='question',phase==='feedback']);

  const title=quizTitle(config);

  const q=allQs[qIdx];

  // After a tap the phases run on the animations themselves (animationend), never on timers: the
  // picked answer pops or shakes while the colours show (reveal), the options slide out one after
  // another (leaving), and when the last has gone the verdict rises in their place (feedback).
  // Timers were starved under the tests' fixed clock; a CSS animation runs on the compositor's own
  // clock. Reduced motion has no animations, so it goes straight to the verdict after a beat; and a
  // safety timer carries a browser that never fires animationend.
  const _rm=typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const timers=React.useRef([]);
  React.useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  const onRevealEnd=e=>{ if(e.animationName==='qzPop'||e.animationName==='qzShake') setPhase(p=>p==='reveal'?'leaving':p); };
  const onLeaveEnd=e=>{ if(e.animationName==='qzOut') setPhase(p=>p==='leaving'?'feedback':p); };
  function choose(i){
    if(phase!=='question') return;
    setSelected(i);
    setPhase('reveal');
    if(_rm) timers.current.push(setTimeout(()=>setPhase('feedback'),300));
    timers.current.push(setTimeout(()=>setPhase(p=>p==='reveal'||p==='leaving'?'feedback':p),QUIZ_SAFETY_MS));
    const correct=i===q.a;
    setStreak(s=>{ const n=correct?s+1:0; setBestStreak(b=>Math.max(b,n)); return n; });

    let gained=0;
    if(q.conceptId){
      const r=MasterySystem.recordResult(q.conceptId,correct);
      if(r.justMastered){
        const a=XPSystem.award([{type:'concept_mastered',conceptId:q.conceptId}]);
        gained+=a.filter(x=>!x.levelUp).reduce((s,x)=>s+x.amount,0);
        XPSystem.toast(a,{quiet:true}); // the result shows the round's XP
      }
    }
    if(q.vocabTerm) VocabLedger.recordTest(q.vocabTerm,correct);
    const rec=quizSet?QuizMastery.recordAnswer(quizSet.id,q.q,correct):false;
    if(rec){
      const a=XPSystem.award([{type:rec==='refreshed'?'question_refreshed':'question_learned'}]);
      if(rec==='refreshed') setRefreshed(n=>n+1);
      gained+=a.filter(x=>!x.levelUp).reduce((s,x)=>s+x.amount,0);
      XPSystem.toast(a,{quiet:true}); // keeps the XP badge current; the result says it
    }
    if(gained){ setXpGained(xp=>xp+gained); }

    setResults(rs=>[...rs,{correct,qText:q.q,selectedOpt:q.opts[i],correctOpt:q.opts[q.a],fact:q.fact}]);
  }

  function advance(){
    if(phase!=='feedback') return;
    if(qIdx+1>=allQs.length){
      const finalScore=results.filter(r=>r.correct).length+(selected===q.a?0:0);
      const boxes=allQs.filter(x=>x.conceptId).map(x=>{const d=MasterySystem.get();return d[x.conceptId]?d[x.conceptId].box:1;});
      const avgBox=boxes.length?boxes.reduce((s,b)=>s+b,0)/boxes.length/5:0;
      // A question set pays its completion bonus once, the round every question in it has been
      // answered right (its new answers earned XP as they came). Other quizzes, once per round.
      const setDoneNow=quizSet&&!startedComplete&&QuizMastery.isComplete(quizSet.id,quizSet.pool());
      const a2=quizSet?(setDoneNow?XPSystem.award([{type:'quiz_complete',quizKey:'set_'+quizSet.id,amount:XPSystem.QUIZ_SET_BONUS()}]):[])
        :XPSystem.award([{type:'quiz_complete',quizKey:mode+'_'+Date.now(),derivedDifficulty:avgBox}]);
      const g2=a2.filter(x=>!x.levelUp).reduce((s,a)=>s+a.amount,0);
      setXpGained(xp=>xp+g2);
      XPSystem.toast(a2,{quiet:true});
      // What this round reached is marked here, on the result, once: a new level, and (for a
      // question set) any milestone (Confident in Red, a region mastered). Nothing floats over it.
      const lvl=XPSystem.getLevel(XPSystem.get().total).name, marks=[];
      if(lvl!==startLevel.current) marks.push({id:'level:'+lvl,title:`${lvl} level reached`,sub:`${XPSystem.get().total} XP · next, ${XPSystem.nextLevel(XPSystem.get().total).name}`,icon:'trophy'});
      if(quizSet){ try{ marks.push(...Milestones.check(KnowledgeMap.compute(),Palate.compute())); }catch(e){} }
      setMilestones(marks);
      setPhase('results');
    } else {
      setQIdx(i=>i+1); setSelected(null); setPhase('question');
    }
  }

  function startQuiz(cfg){
    const qs=buildQuizQuestions(cfg);
    const set=quizSetFor(cfg?.mode||'concept',cfg);
    Handoff.quiz.set(cfg);
    setConfig(cfg); setAllQs(qs); setStartedComplete(!!set&&QuizMastery.isComplete(set.id,set.pool()));
    setQIdx(0); setSelected(null); setPhase(qs.length?'question':'empty'); setStreak(0); setBestStreak(0); setXpGained(0); setResults([]); setMilestones([]); setRefreshed(0); startLevel.current=XPSystem.getLevel(XPSystem.get().total).name;
    if(scrollRef.current) scrollRef.current.scrollTop=0;
  }
  // Region and grape banks may still need generating before the next set can start.
  function startSuggested(cfg){
    if(cfg.mode==='region'){ setNextLoading(true); RegionQuizBank.load(cfg.region,()=>{ setNextLoading(false); startQuiz(cfg); }); }
    else if(cfg.mode==='grape'){ setNextLoading(true); getGrapeQuiz(cfg.grape,qs=>{ setNextLoading(false); if(qs&&qs.length) startQuiz({...cfg,questions:qs}); }); }
    else startQuiz(cfg);
  }

  if(phase==='empty') return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:32}}>
      <span style={{fontSize:16,color:T.mid,fontFamily:C.P,textAlign:'center'}}>{mode==='concept'&&MasterySystem.summary().mastered===MasterySystem.summary().total&&MasterySystem.summary().total>0
        ?'Every concept is mastered. Nice work.'
        :'Nothing to test yet — scan and rate a few more bottles first.'}</span>
      <Btn primary onClick={()=>nav('learn')}>Back to Learn</Btn>
    </div>
  );

  if(phase==='results'){
    const finalScore=results.filter(r=>r.correct).length;
    const pct=Math.round(finalScore/allQs.length*100);
    const pool=quizSet&&quizSet.pool();
    const setProgress=quizSet&&QuizMastery.progress(quizSet.id,pool);
    const setDone=!!setProgress&&setProgress.total>0&&setProgress.correct===setProgress.total;
    // Fading answers (past their review date) left in a complete set: the next round brings them back.
    const fadingLeft=setDone?QuizMastery.freshness(quizSet.id,pool).fading:0;
    const justCompleted=setDone&&!startedComplete;
    const setName=mode==='practice'?title:mode==='region'?config.region:mode==='grape'?config.grape:title;
    const concepts=mode==='concept'&&MasterySystem.summary();
    const msg=justCompleted?`${setName} complete!`:pct===100?'Perfect!':pct>=80?'Excellent!':pct>=60?'Good work!':'Keep practising';

    // One primary action, then "Back to Learn" whenever the primary isn't already that.
    //  - unfinished set: keep going on it (questions not yet answered come first)
    //  - finished set: suggest the next unfinished topic/region/grape, else back to Learn
    //  - Concept Check / Words: another round while there's anything left
    let primary=null;
    if(quizSet&&!setDone) primary={label:`Keep going · ${setProgress.total-setProgress.correct} to go`,go:()=>startQuiz(config)};
    else if(quizSet&&setDone&&fadingLeft) primary={label:`Refresh · ${fadingLeft} fading`,go:()=>startQuiz(config)};
    else if(quizSet&&setDone){ const next=nextQuizSuggestion(config); if(next) primary={label:`Next: ${next.label}`,go:()=>startSuggested(next.config)}; }
    else if(mode==='concept'){ if(MasterySystem.selectConcepts(6).length) primary={label:'Keep going',go:()=>startQuiz(config)}; }
    else primary={label:'Keep going',go:()=>startQuiz(config)};

    function resetSet(){
      if(!window.confirm(`Reset your progress on ${setName}? Its questions start from scratch.`)) return;
      if(mode==='region') RegionQuizBank.reset(config.region); else QuizMastery.reset(quizSet.id);
      startQuiz(config);
    }
    const card=(done,headline,sub)=>(
      <div style={{background:done?T.greenBg:T.soft,borderRadius:12,padding:'12px 14px',border:`1px solid ${done?T.green+'40':T.line}`}}>
        <div style={{fontSize:15,fontWeight:700,color:done?T.green:T.ink,fontFamily:C.P}}>{headline}</div>
        {sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{sub}</div>}
      </div>
    );
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg}}>
        {/* The round's pay-off, told as a reveal on the screen's own stage: a ring that fills a segment
            per answer in the order given, the count inside rising with it, then the XP and the best run;
            a completed set gets a fall of confetti drawn in code. */}
        <div style={{background:`radial-gradient(ellipse at 50% -20%, ${_alpha(cr,T.dark?0.5:0.16)}, transparent 70%) ${T.dark?T.bg:C.white}`,padding:'18px 24px 16px',display:'flex',flexDirection:'column',alignItems:'center',gap:4,flexShrink:0,borderBottom:`1px solid ${T.line}`,position:'relative',overflow:'hidden'}}>
          {justCompleted&&<_QuizConfetti col={cr} T={T}/>}
          <_QuizRing results={results} n={allQs.length} T={T} cr={cr}/>
          <div className="qz-rise" style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,textAlign:'center',animationDelay:_qzRingMs(allQs.length)}}>{msg}</div>
          {!justCompleted&&<div className="qz-rise" style={{fontSize:15,color:T.mid,fontFamily:C.P,animationDelay:_qzRingMs(allQs.length)}}>{mode==='region'&&<Flag region={config.region} size={15} style={{marginRight:6}}/>}{title}{setProgress?` · ${setProgress.correct} of ${setProgress.total} answered`:''}</div>}
          <div className="qz-rise" style={{display:'flex',gap:18,marginTop:8,alignItems:'center',animationDelay:_qzRingMs(allQs.length,120)}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:800,color:cr,fontFamily:C.P,lineHeight:1.1}}>+<_QuizCount to={xpGained} start={_qzRingMs(allQs.length,120)}/></div>
              <div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>XP earned</div>
            </div>
            {bestStreak>=2&&<><div style={{width:1,height:30,background:T.line}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:24,fontWeight:800,color:cr,fontFamily:C.P,lineHeight:1.1,display:'flex',alignItems:'center',gap:3,justifyContent:'center'}}><Icon n="flame" sz={20} col={cr}/>{bestStreak}</div>
              <div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Best run</div>
            </div></>}
          </div>
        </div>
        <div key="results" ref={scrollRef} style={{flex:1,overflowY:'auto'}}>
          <div style={{padding:`16px ${side}`,display:'flex',flexDirection:'column',gap:10}}>
            <MilestoneMoment items={milestones}/>
            {setProgress&&(setDone
              ?card(true,justCompleted?`All ${setProgress.total} questions answered correctly`
                  :refreshed?`${refreshed} fading answer${refreshed===1?'':'s'} refreshed`:'Complete — every question answered correctly',
                justCompleted?'This one moves to your completed list on the Learn tab.'
                  :fadingLeft?`${fadingLeft} more ${fadingLeft===1?'answer is':'answers are'} fading. Answers fade a few weeks after you last got them right; each refresh keeps them twice as long.`
                  :refreshed?'Each refresh keeps an answer twice as long before it fades again.':null)
              :card(false,`${setProgress.correct} of ${setProgress.total} questions answered correctly`,`Questions you haven't got right yet come first in your next quiz. You earn XP for each one the first time you get it right, and ${XPSystem.QUIZ_SET_BONUS()} XP for finishing the set.`))}
            {concepts&&card(concepts.mastered===concepts.total,`${concepts.mastered} of ${concepts.total} concepts mastered`,
              concepts.mastered===concepts.total?null:'Each right answer moves a concept up a step and a miss moves it back one; five steps masters it.')}
            {setDone&&(
              <div style={{display:'flex',justifyContent:'center',gap:18}}>
                <span onClick={()=>startQuiz(config)} style={{fontSize:14,fontWeight:600,color:T.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Practise again</span>
                <span onClick={resetSet} style={{fontSize:14,fontWeight:600,color:T.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Reset progress</span>
              </div>
            )}
            <div style={{fontSize:15,fontWeight:600,color:T.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>Review</div>
            {results.map((r,i)=>(
              // Theme colours throughout: the old pale pink card put white question text on near-white on the dark stage.
              <div key={i} className="qz-rise" style={{animationDelay:_qzRingMs(allQs.length,200+i*60),background:r.correct?T.greenBg:(T.dark?'rgba(242,139,125,0.12)':'#FFF0F0'),borderRadius:12,padding:'10px 14px',border:`1px solid ${r.correct?_alpha(T.green,0.35):(T.dark?_alpha(T.tone.bad,0.45):'#F5A0A0')}`}}>
                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontSize:18,flexShrink:0,color:r.correct?T.green:(T.dark?T.tone.bad:'#C0392B'),fontWeight:800}}>{r.correct?'✓':'✗'}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{r.qText}</div>
                    {!r.correct&&<div style={{fontSize:15,color:T.dark?T.tone.bad:'#C0392B',fontFamily:C.P,marginTop:3}}>Your answer: {r.selectedOpt}</div>}
                    {!r.correct&&<div style={{fontSize:15,color:T.green,fontFamily:C.P}}>Correct: {r.correctOpt}</div>}
                    {r.fact&&<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.45}}>{r.fact}</div>}
                    {!r.correct&&!r.fact&&(mode==='grape'||mode==='region')&&<div onClick={()=>mode==='grape'?openGrapePage(config.grape,nav):openRegionPage(config.region,nav)} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,marginTop:5,cursor:'pointer'}}>Read about {mode==='grape'?config.grape:config.region} →</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Actions stay pinned below the review so they're visible without scrolling. */}
        <div style={{flexShrink:0,padding:`12px ${side} calc(12px + env(safe-area-inset-bottom))`,borderTop:`1px solid ${T.line}`,background:T.glass,display:'flex',flexDirection:'column',gap:8}}>
          {primary&&<Btn primary full onClick={nextLoading?undefined:primary.go}>{nextLoading?'Getting it ready…':primary.label}</Btn>}
          <Btn primary={!primary} full onClick={()=>nav('learn')}>Back to Learn</Btn>
        </div>
        <style>{quizCss()}</style>
      </div>
    );
  }

  const answered=phase!=='question', right=selected===q.a;
  const bad={bg:T.dark?'rgba(242,139,125,0.16)':'#FFF0F0',border:T.dark?T.tone.bad:'#E88080',text:T.dark?T.tone.bad:'#C0392B'};
  const optColors=!answered
    ? q.opts.map(()=>({bg:T.glass,border:T.line,text:T.ink}))
    : q.opts.map((_,i)=>{
        if(i===q.a) return {bg:T.greenBg,border:T.green,text:T.green};
        if(i===selected&&selected!==q.a) return bad;
        return {bg:T.glass,border:T.line,text:T.ink,dim:true};
      });
  // One segment per question: answered ones green or red, the current one in ink (crimson read as the wrong-answer red).
  const seg=i=>i<results.length?(results[i].correct?T.green:T.tone.bad):i===qIdx?T.ink:T.soft;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg}}>
      <div style={{background:`radial-gradient(ellipse at 50% -20%, ${_alpha(cr,T.dark?0.42:0.14)}, transparent 70%) ${T.dark?T.bg:C.white}`,padding:'14px 20px 12px',flexShrink:0,borderBottom:`1px solid ${T.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div onClick={back} style={{width:32,height:32,borderRadius:16,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={14} col={T.ink}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P}}>{mode==='region'&&<Flag region={config.region} size={17} style={{marginRight:7}}/>}{title}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            {streak>=2&&<span key={streak} className="qz-flame" style={{display:'inline-flex',alignItems:'center',gap:2}}><Icon n="flame" sz={18} col={cr}/><span style={{fontSize:13,fontWeight:800,color:cr,fontFamily:C.P}}>{streak}</span></span>}
            <span style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{qIdx+1}/{allQs.length}</span>
          </div>
        </div>
        <div data-testid="quiz-progress" style={{display:'flex',gap:4}}>
          {allQs.map((_,i)=><div key={i===qIdx?'cur'+qIdx:i} className={i===qIdx&&phase==='question'?'qz-seg-pulse':''} style={{flex:1,height:5,borderRadius:3,background:seg(i),transition:'background .3s'}}/>)}
        </div>
      </div>

      <div key={'q'+qIdx} ref={qRef} onClick={phase==='feedback'?advance:undefined} style={{flex:1,overflowY:'auto',padding:wide?`28px ${side}`:'20px 16px',display:'flex',flexDirection:'column',gap:14,cursor:phase==='feedback'?'pointer':'default'}}>
        {/* The question stays as the context; once answered it steps down a size so the verdict leads. */}
        <div className="qz-in" style={{fontSize:phase==='feedback'?16:21,fontWeight:700,color:phase==='feedback'?T.ink2:T.ink,fontFamily:C.P,lineHeight:1.4,transition:'font-size .3s, color .3s'}}>{q.q}</div>
        {phase!=='feedback'&&<div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
          {q.opts.map((opt,i)=>{
            const s=optColors[i]||{bg:T.glass,border:T.line,text:T.ink};
            return(
              <div key={i} onClick={()=>choose(i)} className={'qz-opt '+(phase==='leaving'?'qz-out':answered&&i===selected?(right?'qz-pop':'qz-shake'):phase==='question'?'qz-opt-in':'')}
                onAnimationEnd={phase==='reveal'&&i===selected?onRevealEnd:phase==='leaving'&&i===q.opts.length-1?onLeaveEnd:undefined}
                style={{padding:'15px 16px',borderRadius:14,border:`2px solid ${s.border}`,background:s.bg,cursor:phase==='question'?'pointer':'default',transition:'background .2s, border-color .2s, opacity .25s, box-shadow .2s',opacity:s.dim?0.45:1,display:'flex',alignItems:'center',gap:10,
                  boxShadow:answered&&i===selected&&T.dark?`0 0 0 3px ${_alpha(s.border,0.35)}`:'none',
                  animationDelay:phase==='leaving'?`${Math.round(i*45/quizSpeed())}ms`:phase==='question'?`${Math.round((120+i*40)/quizSpeed())}ms`:undefined}}>
                <div style={{width:28,height:28,borderRadius:14,background:s.border+'25',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:15,fontWeight:700,color:s.text,fontFamily:C.P}}>
                    {answered&&i===q.a?'✓':answered&&i===selected&&selected!==q.a?'✗':String.fromCharCode(65+i)}
                  </span>
                </div>
                <span style={{fontSize:17,fontWeight:500,color:s.text,fontFamily:C.P,lineHeight:1.35}}>{opt}</span>
              </div>
            );
          })}
        </div>}
        {phase==='feedback'&&(
          <div data-testid="quiz-feedback" className="qz-rise" role="button" tabIndex={0} aria-label="Continue" onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); advance(); } }} style={{display:'flex',flexDirection:'column',gap:12,outline:'none'}}>
            {/* The verdict in one line, then the fact with the room: it's what they take away. */}
            <div style={{borderRadius:16,padding:'14px 16px 16px',background:right?T.greenBg:bad.bg,border:`1.5px solid ${right?T.green:bad.border}`,display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div className="qz-mark" style={{width:32,height:32,borderRadius:16,background:right?T.green:bad.border,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontSize:'17px',fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1}}>{right?'✓':'✗'}</span>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:right?T.green:bad.text,fontFamily:C.P,lineHeight:1.2,flex:1,minWidth:0}}>{right?(streak>=3?`Correct! ${streak} in a row`:'Correct!'):'Not quite'}</div>
              </div>
              <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>
                {right?<>The answer: <b style={{color:T.ink}}>{q.opts[q.a]}</b></>
                  :<>You said <span style={{textDecoration:'line-through',color:bad.text}}>{q.opts[selected]}</span> · The answer: <b style={{color:T.green}}>{q.opts[q.a]}</b></>}
              </div>
              {q.fact&&<_QuizFact text={q.fact} T={T} cr={cr}/>}
            </div>
            <div onClick={e=>{e.stopPropagation();advance();}} style={{background:cr,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 22px ${cr}45`,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>{qIdx+1>=allQs.length?'See Results →':'Next Question →'}</span>
            </div>
            <div style={{fontSize:13,color:T.mid,fontFamily:C.P,textAlign:'center'}}>Tap anywhere to continue</div>
          </div>
        )}
        <div style={{height:12}}/>
      </div>
      <style>{quizCss()}</style>
    </div>
  );
}

/* The quiz's motion: a new question slides in from the right; the picked answer pops (right) or
   shakes (wrong) while its colours show; the options slip out to the left one after another; the
   verdict rises in its place with its mark scaling up. The phases follow these animations' ends.
   Reduced motion: none of it. Tests run it `window.VINTEREST_QUIZ_SPEED` (8) times faster, as the
   scan story has its own switch: a round of five answers would otherwise outlast a test's budget. */
const QUIZ_SAFETY_MS=2500;
const quizSpeed=()=>{ const v=typeof window!=='undefined'&&Number(window.VINTEREST_QUIZ_SPEED); return v>0?v:1; };
/* When the result's ring has finished its n segments (QZ_SEG_MS apart), plus `extra`: the delay
   the lines under it wait for, as a CSS time. */
const QZ_SEG_MS=120, QZ_SEG_LEN=380;
function _qzRingMs(n,extra=0){ return `${((QZ_SEG_LEN+QZ_SEG_MS*Math.max(0,n-1)+extra)/quizSpeed()/1000).toFixed(3)}s`; }
/* A number that counts up to `to` once `start` (a CSS time) has passed, on animation frames rather
   than a clock, so it runs the same under the tests' fixed time. */
function _QuizCount({to,start}){
  const [n,setN]=React.useState(0);
  React.useEffect(()=>{
    const rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(rm||!to){ setN(to); return; }
    const wait=Math.round(parseFloat(start)*60), frames=Math.max(1,Math.round(36/quizSpeed()));
    let f=0, raf=0;
    const tick=()=>{ f++; if(f>wait){ const t=Math.min(1,(f-wait)/frames), e=1-Math.pow(1-t,3); setN(Math.round(to*e)); if(t>=1) return; } raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[to,start]);
  return <>{n}</>;
}
/* The result's ring: one arc segment per question with a small gap, each stroked green or red in
   the order answered and drawn in one after another; the count inside rises with them. */
function _QuizRing({results,n,T,cr}){
  const R=40, C_=2*Math.PI*R, gapDeg=n>1?5:0, segDeg=(360-gapDeg*n)/n, segLen=C_*segDeg/360;
  const [count,setCount]=React.useState(0);
  const score=results.filter(r=>r.correct).length;
  React.useEffect(()=>{
    const rm=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(rm){ setCount(score); return; }
    const per=Math.max(1,Math.round(QZ_SEG_MS/quizSpeed()/16.7));
    let f=0, c=0, raf=0, seen=0;
    const tick=()=>{ f++; const i=Math.floor(f/per); while(seen<Math.min(i,results.length)){ if(results[seen].correct) c++; seen++; setCount(c); } if(seen<results.length) raf=requestAnimationFrame(tick); };
    raf=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[results.length]);
  return <div style={{position:'relative',width:104,height:104}}>
    <svg data-testid="result-ring" width="104" height="104" viewBox="-52 -52 104 104" aria-hidden="true" style={{display:'block',overflow:'visible'}}>
      {[...Array(n)].map((_,i)=>{ const r=results[i]; const col=!r?T.soft:r.correct?T.green:T.tone.bad; const rot=-90+i*(segDeg+gapDeg);
        return <path key={i} d={`M ${R} 0 A ${R} ${R} 0 ${segDeg>180?1:0} 1 ${(R*Math.cos(segDeg*Math.PI/180)).toFixed(2)} ${(R*Math.sin(segDeg*Math.PI/180)).toFixed(2)}`}
          transform={`rotate(${rot})`} fill="none" stroke={col} strokeWidth="7" strokeLinecap={n>1?'butt':'round'}
          className={r?'qz-seg':''} style={r?{strokeDasharray:segLen,strokeDashoffset:segLen,animationDelay:`${(QZ_SEG_MS*i/quizSpeed()/1000).toFixed(3)}s`,filter:T.dark?`drop-shadow(0 0 4px ${col})`:'none'}:{opacity:0.5}}/>; })}
    </svg>
    <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',lineHeight:1}}>
      <span style={{fontSize:'26px',fontWeight:800,color:T.ink,fontFamily:C.P}}>{count}<span style={{fontSize:'14px',fontWeight:600,color:T.mid}}>/{n}</span></span>
      <span style={{fontSize:'10px',fontWeight:600,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',marginTop:3}}>Correct</span>
    </div>
  </div>;
}
/* Twelve small pieces falling from the ring once, in the brand colour and green; drawn in code. */
function _QuizConfetti({col,T}){
  const pieces=[...Array(12)].map((_,i)=>({x:8+i*7.5+((i*37)%9),d:(i*53)%400,c:i%3===1?T.green:i%3===2?T.amber:col,r:(i*47)%360,w:5+(i%3)*2}));
  return <div aria-hidden="true" style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
    {pieces.map((p,i)=><div key={i} className="qz-confetti" style={{position:'absolute',left:`${p.x}%`,top:-10,width:p.w,height:p.w*1.6,borderRadius:2,background:p.c,animationDelay:`${(p.d/quizSpeed()/1000).toFixed(3)}s`,transform:`rotate(${p.r}deg)`,opacity:0}}/>)}
  </div>;
}
/* The fact, with its trait words (body, tannins, acidity, texture) tappable for what they mean,
   from the same text as the palate pages (Palate.TRAITS). Teach while asking. */
const _QZ_TRAITS={body:'body',tannin:'tannins',tannins:'tannins',acidity:'acidity',acid:'acidity',texture:'texture'};
function _QuizFact({text,T,cr}){
  const [open,setOpen]=React.useState(null);
  const parts=String(text).split(/(\b(?:body|tannins?|acidity|acid|texture)\b)/i);
  const tr=open&&typeof Palate!=='undefined'&&Palate.TRAITS[open];
  return <div style={{paddingTop:10,borderTop:`1px solid ${T.line}`}}>
    <div style={{fontSize:17,color:T.ink,fontFamily:C.P,lineHeight:1.5}}>
      {parts.map((w,i)=>{ const k=_QZ_TRAITS[w.toLowerCase()]; return k
        ?<span key={i} role="button" onClick={e=>{ e.stopPropagation(); setOpen(o=>o===k?null:k); }} style={{textDecoration:'underline dotted',textUnderlineOffset:3,textDecorationColor:cr,cursor:'pointer'}}>{w}</span>
        :<React.Fragment key={i}>{w}</React.Fragment>; })}
    </div>
    {tr&&<div className="qz-rise" onClick={e=>e.stopPropagation()} style={{marginTop:8,padding:'10px 12px',borderRadius:10,background:T.glass,border:`1px solid ${T.line}`,fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>
      <b style={{color:T.ink,textTransform:'capitalize'}}>{open}.</b> {tr.what} <span style={{color:T.mid}}>{tr.notice&&tr.notice[0]}</span>
    </div>}
  </div>;
}
function quizCss(){ const s=quizSpeed(), d=ms=>`${(ms/s/1000).toFixed(3)}s`;
  return `
@keyframes qzIn{from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:none}}
@keyframes qzOut{to{opacity:0;transform:translateX(-36px)}}
@keyframes qzRise{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes qzPop{0%{transform:scale(1)}20%{transform:scale(1.04)}40%,100%{transform:scale(1)}}
@keyframes qzShake{0%,60%,100%{transform:none}12%{transform:translateX(-7px)}24%{transform:translateX(6px)}36%{transform:translateX(-4px)}48%{transform:translateX(2px)}}
@keyframes qzMark{from{transform:scale(.4);opacity:0}70%{transform:scale(1.12)}to{transform:scale(1);opacity:1}}
@keyframes qzFlame{0%{transform:scale(1)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes qzOptIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes qzSeg{to{stroke-dashoffset:0}}
@keyframes qzSegPulse{0%{transform:scaleY(1)}50%{transform:scaleY(1.9)}100%{transform:scaleY(1)}}
@keyframes qzConfetti{0%{opacity:1;transform:translateY(0) rotate(0deg)}100%{opacity:0;transform:translateY(150px) rotate(300deg)}}
.qz-opt:active{transform:scale(.97)}
.qz-opt-in{animation:qzOptIn ${d(300)} cubic-bezier(.2,.8,.3,1) both}
.qz-seg{animation:qzSeg ${d(QZ_SEG_LEN)} cubic-bezier(.2,.8,.3,1) both}
.qz-seg-pulse{animation:qzSegPulse ${d(500)} ease}
.qz-confetti{animation:qzConfetti ${d(1200)} ease-in both}
.qz-in{animation:qzIn ${d(320)} cubic-bezier(.2,.8,.3,1) both}
.qz-out{animation:qzOut ${d(260)} ease-in both}
.qz-rise{animation:qzRise ${d(380)} cubic-bezier(.2,.8,.3,1) both}
.qz-pop{animation:qzPop ${d(700)} ease}
.qz-shake{animation:qzShake ${d(750)} ease}
.qz-mark{animation:qzMark ${d(450)} cubic-bezier(.2,.8,.3,1) ${d(80)} both}
.qz-flame{animation:qzFlame ${d(400)} ease}
@media (prefers-reduced-motion:reduce){.qz-in,.qz-out,.qz-rise,.qz-pop,.qz-shake,.qz-mark,.qz-flame,.qz-opt-in,.qz-seg-pulse,.qz-confetti{animation:none}.qz-seg{animation:none;stroke-dashoffset:0!important}}
`; }

Object.assign(window,{QuizHubScreen,QuizScreen,MasteryMapScreen});
