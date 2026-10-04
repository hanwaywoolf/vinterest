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
  if(!items||!items.length) return null;
  const rest=items.length-limit;
  return <>
    {(open?items:items.slice(0,limit)).map(render)}
    {rest>0&&<div role="button" onClick={()=>setOpen(o=>!o)} style={{padding:'8px 4px',display:'flex',alignItems:'center',gap:6,cursor:'pointer'}}>
      <Icon n="chevron" sz={12} col={C.cr} style={{transform:open?'rotate(-90deg)':'rotate(90deg)'}}/>
      <span style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P}}>{open?'Show less':`Show ${rest} more${noun?' '+noun:''}`}</span>
    </div>}
  </>;
}
/* The row of section chips at the top of Learn: every kind of learning visible at once, one tap away. */
function LearnJumpRow({sections,onJump}){
  return <div style={{display:'flex',gap:8,overflowX:'auto',padding:'10px 16px',background:C.bg,position:'sticky',top:0,zIndex:2,borderBottom:`1px solid ${C.line}`,scrollbarWidth:'none'}}>
    {sections.map(x=>(
      <div key={x.id} role="button" onClick={()=>onJump(x.id)} style={{flex:'0 0 auto',padding:'7px 13px',borderRadius:999,background:C.white,border:`1px solid ${C.line}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap'}}>{x.label}</span>
        {x.count>0&&<span style={{fontSize:12,fontWeight:700,color:C.cr,background:C.crSoft,borderRadius:999,padding:'1px 7px',fontFamily:C.P}}>{x.count}</span>}
      </div>
    ))}
  </div>;
}
/* A region's country flag in the 42px icon tile (Regions.flag); the map icon when the country is
   unknown. Locked (Pro) regions show it faded. The flag is a fixed graphic, so its size is px. */
function RegionFlag({region,locked}){
  const f=Regions.flag(region);
  return <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,opacity:locked?0.5:1}}>
    {f?<span role="img" aria-label={(KNOWLEDGE.regions[region]||{}).country} style={{fontSize:'24px',lineHeight:1}}>{f}</span>:<Icon n="map" sz={20} col={C.ink}/>}
  </div>;
}
/* ✓ plus a Reset link, for a completed quiz row. The row itself stays tappable to retake it. */
function CompletedMark({onReset}){
  return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0}}>
      <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span>
      <span onClick={e=>{e.stopPropagation();onReset();}} style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Reset</span>
    </div>
  );
}

function QuizHubScreen({nav,back,showPro}){
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

  const zoneLabel={fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2};
  const unreadShelf=(genStubs||[]).filter(s=>!LearnProgress.articleDone(s.id)&&!ContentEngine.stubLocked(s));
  const nextOnRamp=ON_RAMP.find(a=>!onRampDone(a.id));
  const nextBest=nextOnRamp&&!(UserPrefs.skipsOnRamp()&&unreadShelf.length)
    ? {kind:'onramp',title:nextOnRamp.title,sub:nextOnRamp.subtitle,readTime:nextOnRamp.readTime,action:()=>{Handoff.onRampIdx.set(String(ON_RAMP.indexOf(nextOnRamp)));nav('article');}}
    : unreadShelf.length
      ? {kind:'shelf',stub:unreadShelf[0],title:unreadShelf[0].title,sub:unreadShelf[0].subtitle,action:()=>{Handoff.genArticle.set(unreadShelf[0]);nav('gen-article');}}
      : {kind:'scan',title:'Scan a bottle for your next read',sub:"Your shelf restocks based on what you try.",action:()=>nav('camera')};

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
  const secRefs={shelf:React.useRef(null),basics:React.useRef(null),regions:React.useRef(null),grapes:React.useRef(null),skills:React.useRef(null),progress:React.useRef(null)};
  const jump=id=>{ const el=secRefs[id]&&secRefs[id].current; if(el) el.scrollIntoView({behavior:'smooth',block:'start'}); };

  // After every hook above: returning early before one of them changes the hook count between
  // renders, and React throws the moment the unlock effect flips showUnlock.

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px 0',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,flex:1,letterSpacing:'-0.4px'}}>Learn</span>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <Icon n={XPSystem.iconFor(level)} sz={15} col={C.cr}/>
            <span style={{fontSize:16,fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpData.total} XP</span>
          </div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{level.name}</span>
            {nextLvl&&<span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{nextLvl.min - xpData.total} XP to {nextLvl.name}</span>}
          </div>
          <div style={{height:7,borderRadius:4,background:C.offWhite,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,background:level.color,width:`${Math.round(prog*100)}%`,transition:'width .6s ease'}}/>
          </div>
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
<div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <div style={zoneLabel}>Next Best Thing</div>
          <div onClick={nextBest.action} style={{background:C.ink,borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginTop:8}}>
            <div style={{width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n={nextBest.kind==='scan'?'camera':nextBest.kind==='onramp'?'book':(nextBest.stub.iconName||'read')} sz={20} col="rgba(255,255,255,0.7)"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{nextBest.kind==='onramp'?'On-Ramp · '+nextBest.readTime:nextBest.kind==='shelf'?'Written for you · '+nextBest.stub.readTime:'Free forever'}</div>
              <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3,marginBottom:2}}>{nextBest.title}</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.4}}>{nextBest.sub}</div>
            </div>
            <Icon n="chevron" sz={13} col="rgba(255,255,255,0.3)"/>
          </div>
        </div>

        {/* Before the shelf opens: what it is and the one step that opens it, shown faded. */}
        {!article1Done&&ON_RAMP[0]&&(
          <div ref={secRefs.shelf} data-shelf-locked style={{scrollMarginTop:56}}>
            <div style={zoneLabel}>Written for you</div>
            <div style={{marginTop:8,background:C.white,borderRadius:14,border:`1px dashed ${C.line}`,padding:'16px',position:'relative',overflow:'hidden'}}>
              <div aria-hidden="true" style={{opacity:0.35,display:'flex',flexDirection:'column',gap:8,marginBottom:12}}>
                {[0.9,0.7].map((w,i)=><div key={i} style={{display:'flex',gap:10,alignItems:'center'}}>
                  <div style={{width:36,height:36,borderRadius:10,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n="read" sz={16} col={C.cr}/></div>
                  <div style={{flex:1}}><div style={{height:10,width:`${w*100}%`,background:C.line,borderRadius:5,marginBottom:6}}/><div style={{height:8,width:`${w*70}%`,background:C.line,borderRadius:4}}/></div>
                </div>)}
              </div>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.35}}>Like a good bottle, these need a little time.</div>
              <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:4}}>Pieces here are written from your WineDNA: the bottles you scan, how you score them and what you pay. Read <b>{ON_RAMP[0].title}</b> first and your shelf opens.</div>
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
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:4}}>Every piece here is written from your WineDNA: the bottles you've scanned, how you scored them and what you paid. Nobody else gets the same article.</div>
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
            {!unread.length&&(
              <div style={{padding:'18px 16px',textAlign:'center',background:C.white,borderRadius:14,border:`1px dashed ${C.line}`}}>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>{read.length?"You've read everything written for you so far. Scan or score another bottle and more arrives.":"Nothing on your shelf yet. Scan a bottle and we'll have something for you by morning."}</span>
              </div>
            )}
            <ShowMore items={unread} limit={3} render={card} noun="to read"/>
            {read.length>0&&(
              <div role="button" onClick={()=>setLibraryOpen(o=>!o)} style={{background:C.white,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:8,cursor:'pointer',border:`1px dashed ${C.line}`}}>
                <Icon n="book" sz={15} col={C.mid}/>
                <span style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,flex:1}}>Your library · {read.length} read</span>
                <Icon n="chevron" sz={12} col={C.mid} style={{transform:libraryOpen?'rotate(-90deg)':'rotate(90deg)'}}/>
              </div>
            )}
            {libraryOpen&&read.map(card)}
            </div>
          </div>
          );
        })()}

        <div ref={secRefs.basics} style={{...zoneLabel,scrollMarginTop:56}}>Wine Basics</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:-6}}>
          <ShowMore items={topicsToShow} limit={4} noun="topics" render={topic=>{
            const p=topicProgress(topic.id);
            return(
            <div key={topic.id} onClick={()=>startQuiz({mode:'practice',topicId:topic.id})}
              style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
              <div style={{width:42,height:42,borderRadius:12,background:topic.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`}}>
                <Icon n={topic.iconName||'book'} sz={20} col={topic.color}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
                <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{topic.desc}{p.correct>0?` · ${p.correct}/${p.total} correct`:''}</div>
              </div>
              <Icon n="chevron" sz={13} col={C.mid}/>
            </div>
            );
          }}/>
          {doneTopics.length>0&&<CompletedToggle count={doneTopics.length} expanded={topicsExpanded} onToggle={()=>setTopicsExpanded(e=>!e)}/>}
          {topicsExpanded&&doneTopics.map(topic=>(
            <div key={topic.id} onClick={()=>startQuiz({mode:'practice',topicId:topic.id})}
              style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`,opacity:0.7}}>
              <div style={{width:42,height:42,borderRadius:12,background:topic.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`}}>
                <Icon n={topic.iconName||'book'} sz={20} col={topic.color}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
                <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{topic.desc}</div>
              </div>
              <CompletedMark onReset={()=>resetProgress(topic.label,()=>QuizMastery.reset('topic:'+topic.id))}/>
            </div>
          ))}
          {/* Regions open from their first scan (5 free, then Pro), not only once WineDNA unlocks. */}
          {(quizRegions.length>0||doneRegions.length>0||proRegions.length>0)&&(
            <>
              {(quizRegions.length>0||doneRegions.length>0||proRegions.length>0)&&(
                <div ref={secRefs.regions} style={{marginTop:14,scrollMarginTop:56}}>
                  <div style={zoneLabel}>Region quizzes</div>
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>One for each region you've scanned: its grapes, climate, rules and how to read its labels.</div>
                </div>
              )}
              <ShowMore items={[...quizRegions.map(r=>({r})),...proRegions.map(r=>({r,pro:true}))]} limit={3} noun="regions" render={({r:region,pro})=>pro?(
                <div key={region} onClick={()=>showPro('regions')} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                  <RegionFlag region={region} locked/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{region}</div>
                    <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Unlock with Pro</div>
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
                  <div key={region} onClick={()=>handleRegionTap(region)} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                    <RegionFlag region={region}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{region} quiz</div>
                      <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{sub}</div>
                    </div>
                    {regionLoading===region
                      ?<div style={{width:14,height:14,borderRadius:7,border:`2px solid ${C.line}`,borderTopColor:C.cr,animation:'storySpin .8s linear infinite'}}/>
                      :<Icon n="chevron" sz={13} col={C.mid}/>}
                  </div>
                );
              })()}/>
              {doneRegions.length>0&&<CompletedToggle count={doneRegions.length} expanded={regionsExpanded} onToggle={()=>setRegionsExpanded(e=>!e)}/>}
              {regionsExpanded&&doneRegions.map(region=>(
                <div key={region} onClick={()=>handleRegionTap(region)} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`,opacity:0.7}}>
                  <RegionFlag region={region}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{region} quiz</div>
                    <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Every question answered · tap to practise</div>
                  </div>
                  <CompletedMark onReset={()=>resetProgress(region,()=>RegionQuizBank.reset(region))}/>
                </div>
              ))}
            </>
          )}
        </div>

        <div ref={secRefs.grapes} style={{...zoneLabel,scrollMarginTop:56}}>Grape quizzes</div>
        <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Tap a grape for its quiz: what it tastes like, where it grows and how to spot it on a label.</div>
        <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginTop:4}}>{unlockedGrapes.length} of {GRAPE_ALLOWLIST.length} unlocked · {isPro?'locked ones unlock as you tap'
          :unlockedGrapes.length>=FREE_GRAPE_CAP?`your ${FREE_GRAPE_CAP} free grapes are open${GrapeUnlocks.held().length?`, ${GrapeUnlocks.held().length} more waiting for Pro`:''}; Pro opens the rest`
          :`scan or rate a wine to open another (${FREE_GRAPE_CAP-unlockedGrapes.length} of ${FREE_GRAPE_CAP} free left)`}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
        {(grapesExpanded?unlockedGrapes:unlockedGrapes.slice(0,GRAPE_PILLS)).map(g=>{
          const loading=grapeLoading===g;
          const col=grapeTypeColor(g);
          const status=grapePillStatus(g);
          return(
            <div key={g} onClick={()=>handleGrapeTap(g)} style={{flex:'0 0 auto',padding:'10px 16px',borderRadius:999,background:col+'15',border:`1px solid ${col}40`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7}}>
              {status&&status.done&&<span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span>}
              <span style={{fontSize:14,fontWeight:600,color:col,fontFamily:C.P,whiteSpace:'nowrap'}}>{g}</span>
              {loading
                ?<div style={{width:13,height:13,borderRadius:7,border:`2px solid ${col}33`,borderTopColor:col,animation:'storySpin .8s linear infinite'}}/>
                :status&&!status.done&&<span style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,background:'#fff',borderRadius:999,padding:'1px 7px'}}>{status.text}</span>}
            </div>
          );
        })}
        {(lockedGrapes.length>0||unlockedGrapes.length>GRAPE_PILLS)&&(
          <div onClick={()=>setGrapesExpanded(e=>!e)} style={{flex:'0 0 auto',padding:'10px 18px',borderRadius:999,background:C.white,border:`1px dashed ${C.line}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {grapesExpanded?<Icon n="chevron" sz={12} col={C.mid} style={{transform:'rotate(-90deg)'}}/>:<Icon n="lock" sz={12} col={C.mid}/>}
            <span style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{grapesExpanded?'Show less':`+${lockedGrapes.length+Math.max(0,unlockedGrapes.length-GRAPE_PILLS)} more`}</span>
          </div>
        )}
        {grapesExpanded&&lockedGrapes.map(g=>{
          const loading=grapeLoading===g;
          const col=grapeTypeColor(g);
          return(
            <div key={g} onClick={()=>handleGrapeTap(g)} style={{flex:'0 0 auto',padding:'10px 18px',borderRadius:999,background:C.white,border:`1px solid ${col}30`,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:0.75}}>
              {!loading&&<Icon n="lock" sz={11} col={C.mid}/>}
              <span style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap'}}>{g}</span>
              {loading&&<div style={{width:13,height:13,borderRadius:7,border:`2px solid ${col}33`,borderTopColor:col,animation:'storySpin .8s linear infinite'}}/>}
            </div>
          );
        })}
        </div>
        {grapeLoading&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:8}}>Preparing your {grapeLoading} quiz… the first time takes a few seconds.</div>}
        {grapeError&&!grapeLoading&&<div style={{fontSize:14,color:'#C0392B',fontFamily:C.P,marginTop:8}}>Couldn't load the {grapeError} quiz. Check your connection and tap it again.</div>}

        {/* Wine Skills: fixed guides for tasting, ordering, buying, pairing and hosting (Guides, pwa-guides.js) */}
        <div ref={secRefs.skills} style={{scrollMarginTop:56}}>
          <div style={zoneLabel}>Wine Skills</div>
          <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>Short guides for the moments that matter: tasting, ordering out, buying, pairing and hosting. Each ends with three quick questions.</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:-6}}>
          <ShowMore items={guideQueue} limit={4} noun="guides" render={g=>{
            const p=Guides.progress(g.id), read=Guides.isRead(g.id);
            return(
              <div key={g.id} onClick={()=>openGuide(g.id)} role="button" style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${C.crDim}`}}><Icon n={g.iconName||'book'} sz={20} col={C.cr}/></div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{Guides.group(g.group).label} · {g.readTime}</div>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{g.title}</div>
                  {(read||p.correct>0)&&<div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginTop:3}}>{read?'Read':'Not read yet'} · {p.correct}/{p.total} questions</div>}
                </div>
                <Icon n="chevron" sz={13} col={C.mid}/>
              </div>
            );
          }}/>
          {guidesDone.length>0&&<CompletedToggle count={guidesDone.length} expanded={guidesExpanded} onToggle={()=>setGuidesExpanded(e=>!e)}/>}
          {guidesExpanded&&guidesDone.map(g=>(
            <div key={g.id} onClick={()=>openGuide(g.id)} role="button" style={{background:C.white,borderRadius:14,padding:'10px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`,opacity:0.75}}>
              <Icon n={g.iconName||'book'} sz={17} col={C.cr}/>
              <div style={{flex:1,fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{g.title}</div>
              <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span>
            </div>
          ))}
        </div>

        <div ref={secRefs.progress} style={{...zoneLabel,scrollMarginTop:56}}>Your Mastery</div>
        <div onClick={()=>isPro?nav('mastery-map'):showPro('mastery-map')} role="button" style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:10,marginTop:-6,cursor:'pointer'}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="trophy" sz={19} col={C.ink}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your wine knowledge · {knowledge.overall}%</div>
              <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>From the articles you've read and the quizzes you've passed, across every wine type, region, grape and skill.</div>
            </div>
            {!isPro&&<ProBadge/>}
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>
          <div style={{height:6,borderRadius:3,background:C.offWhite,overflow:'hidden'}}><div style={{height:'100%',width:`${knowledge.overall}%`,background:C.cr,borderRadius:3}}/></div>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>
            {knowledge.strongest?<>Strongest: <b>{knowledge.strongest.label}</b> ({knowledge.strongest.level.toLowerCase()}). </>:null}
            {knowledge.gap?<>Biggest gap: <b>{knowledge.gap.label}</b>.</>:null}
          </div>
        </div>

        <div style={zoneLabel}>Courses</div>
        {[{icon:'globe',title:'Country courses',sub:'A whole country in one course: its regions, grapes, local wines and labels.'},
          {icon:'map',title:'Travel prep',sub:'Tell us where you\'re going and we\'ll build a course and wine picks for your trip.'}].map(c=>(
          <div key={c.title} style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,opacity:0.7,marginTop:-6}}>
            <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={c.icon} sz={19} col={C.mid}/></div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{c.title}</div>
              <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>{c.sub}</div>
              <div style={{fontSize:12,fontWeight:700,color:C.amber,fontFamily:C.P,marginTop:3}}>Coming soon</div>
            </div>
            <ProBadge/>
          </div>
        ))}

        <div style={{height:8}}/>
        <div onClick={()=>{XPSystem.reset();setXpData(XPSystem.fresh());}} style={{textAlign:'center',padding:'8px',cursor:'pointer'}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P,textDecoration:'underline'}}>Reset XP &amp; progress</span>
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
function ShelfCard({stub,done,locked,because,onOpen}){
  return(
  <div onClick={onOpen}
    style={{background:C.white,borderRadius:14,padding:done?'10px 14px':'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:onOpen?'pointer':'default',border:`1px solid ${C.line}`,opacity:done?0.75:1}}>
    <div style={{width:done?36:44,height:done?36:44,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${C.crDim}`}}>
      <Icon n={stub.iconName||'read'} sz={done?17:20} col={C.cr}/>
    </div>
    <div style={{flex:1,minWidth:0}}>
      {!done&&<div style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{stub.series?`${stub.series} series`:'Written for you'} · {stub.readTime}</div>}
      <div style={{fontSize:done?15:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{stub.title}</div>
      {!done&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:2}}>{stub.subtitle}</div>}
      {!done&&<div style={{fontSize:13,fontWeight:600,color:C.cr,fontFamily:C.P,marginTop:4}}>{because}</div>}
    </div>
    {locked ? <ProBadge/> : done ? <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span> : onOpen ? <Icon n="chevron" sz={13} col={C.mid}/> : null}
  </div>
  );
}

/* ── MASTERY (PRO) ──
   How rounded their wine knowledge is, from what they've read and passed (KnowledgeMap,
   pwa-knowledge.js): where to start (focus), the shape of it now and a month ago, the map of
   regions, then each area's score, level, what counts, and the next thing to do. */
function MasteryBar({score,col}){
  return <div style={{height:6,borderRadius:3,background:C.offWhite,overflow:'hidden'}}><div className="mastery-fill" style={{height:'100%',borderRadius:3,background:score>=100?C.green:(col||C.cr),width:`${score}%`,transition:'width .5s ease'}}/></div>;
}
/* One area of the mastery map: its level and score, and (open) each region or grape in it. Also
   the welcome slides' preview (flow-welcome.jsx), open, with no toggle or next step. */
/* A wine-type area's colour (_TYPE_COLORS): its bar fills in it, so strong and weak types read
   like a palette. Other areas stay crimson. */
function _masteryCol(a){ return a.group==='types'&&typeof _TYPE_COLORS!=='undefined'?_TYPE_COLORS[a.id==='sweet'?'dessert':a.id]||C.cr:C.cr; }
function MasteryAreaCard({a,open,onToggle,onNext}){
  const col=_masteryCol(a);
  return(
  <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.line}`,padding:'12px 14px',display:'flex',flexDirection:'column',gap:7}}>
    <div role="button" onClick={onToggle} style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',cursor:a.items&&onToggle?'pointer':'default'}}>
      <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{a.group==='types'&&<span aria-hidden="true" style={{display:'inline-block',width:10,height:10,borderRadius:5,background:col,marginRight:8,verticalAlign:'1px'}}/>}{a.label}</span>
      <span style={{fontSize:14,fontWeight:700,color:a.score>=100?C.green:C.ink2,fontFamily:C.P}}>{a.level} · {a.score}%</span>
    </div>
    <MasteryBar score={a.score} col={col}/>
    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{a.detail}{a.items&&a.items.length&&onToggle?(open?' · hide':' · see each'):''}</div>
    {open&&a.items.map(i=>(
      <div key={i.name} style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{flex:'0 0 42%',fontSize:14,color:C.ink2,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.id==='regions'&&<Flag region={i.name} size={14} style={{marginRight:6}}/>}{a.id==='grapes'&&<span aria-hidden="true" style={{display:'inline-block',width:8,height:8,borderRadius:4,background:grapeTypeColor(i.name),marginRight:7,verticalAlign:'1px'}}/>}{i.name}</span>
        <div style={{flex:1}}><MasteryBar score={i.score} col={a.id==='grapes'?grapeTypeColor(i.name):col}/></div>
        <span style={{fontSize:13,fontWeight:700,color:C.ink2,fontFamily:C.P,width:38,textAlign:'right'}}>{i.score}%</span>
      </div>
    ))}
    {a.next&&onNext&&<div role="button" onClick={onNext} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{a.next.label} →</div>}
  </div>
  );
}
/* The shape of their knowledge: one spoke per Mastery area, the filled shape now and a dashed
   outline of where they were (KnowledgeMap.progress: about a month ago, or their first week).
   Rings mark Developing (34), Confident (67) and Mastered (100). A label tap jumps to that area's
   card. A picture for screen readers (the cards below say the same in words). Labels are string
   sizes: they must fit around the drawing. */
function MasteryRadar({m,prog,onPick}){
  const W=340,H=300,cx=W/2,cy=H/2,R=96, n=m.areas.length;
  const ang=i=>-Math.PI/2+i*2*Math.PI/n;
  // 0% sits on a small inner ring (HOLE of the radius), so an early shape is still a shape, not a spike.
  const HOLE=0.14, rr=score=>R*(HOLE+(1-HOLE)*score/100);
  const pt=(i,score)=>[cx+Math.cos(ang(i))*rr(score),cy+Math.sin(ang(i))*rr(score)];
  const poly=scores=>scores.map((v,i)=>pt(i,v).map(x=>x.toFixed(1)).join(',')).join(' ');
  const now=m.areas.map(a=>a.score), then=prog?m.areas.map(a=>prog.then.a[a.id]||0):null;
  const said=m.areas.map(a=>`${a.label} ${a.score}%`).join(', ');
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Your knowledge by area: ${said}.`} style={{display:'block',maxWidth:420,margin:'0 auto',overflow:'visible'}}>
      {[0,34,67,100].map(r=><polygon key={r} points={poly(m.areas.map(()=>r))} fill="none" stroke={C.line} strokeWidth={r===100?1.2:1} strokeDasharray={r===100?null:'3 3'}/>)}
      {m.areas.map((a,i)=>{ const [x,y]=pt(i,100), [x0,y0]=pt(i,0); return <line key={a.id} x1={x0} y1={y0} x2={x} y2={y} stroke={C.line} strokeWidth="1"/>; })}
      {then&&<polygon points={poly(then)} fill="none" stroke={C.mid} strokeWidth="1.5" strokeDasharray="4 3"/>}
      <g className="mastery-radar-shape" style={{transformOrigin:`${cx}px ${cy}px`}}>
        <polygon points={poly(now)} fill={C.cr} fillOpacity="0.16" stroke={C.cr} strokeWidth="2" strokeLinejoin="round"/>
        {m.areas.map((a,i)=>{ const [x,y]=pt(i,a.score); return <circle key={a.id} cx={x} cy={y} r="3.6" fill={a.score>=100?C.green:_masteryCol(a)} stroke="#fff" strokeWidth="1.2"/>; })}
      </g>
      {m.areas.map((a,i)=>{
        const c=Math.cos(ang(i)), sn=Math.sin(ang(i)), x=cx+c*(R+14), y=cy+sn*(R+14)+(sn>0.3?8:sn<-0.3?-6:3);
        const anchor=c>0.1?'start':c<-0.1?'end':'middle'; // the two bottom spokes lean apart
        return <g key={a.id} onClick={()=>onPick&&onPick(a.id)} style={{cursor:'pointer'}}>
          <text x={x} y={y} textAnchor={anchor} style={{fontSize:'11px',fontWeight:600,fill:C.ink2,fontFamily:C.P}}>{KnowledgeMap.short(a)}</text>
          <text x={x} y={y+12} textAnchor={anchor} style={{fontSize:'10px',fontWeight:700,fill:a.score>=100?C.green:C.mid,fontFamily:C.P}}>{a.score}%</text>
        </g>;
      })}
    </svg>
  );
}
function _when(t){ return new Date(t).toLocaleDateString('en',{day:'numeric',month:'short'}); }

/* The map of wine regions (KnowledgeMap.regionMap): every region in the knowledge base as a pin,
   coloured by its level once unlocked, grey until a scan unlocks it, ringed where they've had a
   bottle from it. A tap shows the pins near it (they sit close together in Europe), each with its
   next step. */
const _PIN_COL={'Not started':'#fff','Getting started':'#DDA0AB','Developing':'#B94A61','Confident':C.cr,'Mastered':C.green};
function _pinFill(p){ return p.state==='open'?_PIN_COL[p.level]||C.cr:'#CFC9C2'; }
function MasteryRegionMap({views,nav,showPro}){
  const [vid,setVid]=React.useState(()=>{ const v=KnowledgeMap.homeView(views); return v?v.id:null; });
  const [sel,setSel]=React.useState([]);
  const v=views.find(x=>x.id===vid)||views[0];
  if(!v) return null;
  const PIN=9, HIT=40;
  const tap=e=>{
    const r=e.currentTarget.getBoundingClientRect(), k=v.w/r.width, x=(e.clientX-r.left)*k, y=(e.clientY-r.top)*k;
    setSel(v.pins.map(p=>({p,d:Math.hypot(p.x-x,p.y-y)})).filter(o=>o.d<=HIT).sort((a,b)=>a.d-b.d).slice(0,4).map(o=>o.p.name));
  };
  const picked=sel.map(n=>v.pins.find(p=>p.name===n)).filter(Boolean);
  const open=v.pins.filter(p=>p.state==='open').length;
  const legend=[['#CFC9C2','Not unlocked'],[_PIN_COL['Getting started'],'Getting started'],[_PIN_COL.Developing,'Developing'],[C.cr,'Confident'],[C.green,'Mastered']];
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',gap:6,overflowX:'auto',scrollbarWidth:'none',margin:'0 -2px'}}>
        {views.map(x=>{ const on=x.id===v.id; return(
          <div key={x.id} role="button" aria-pressed={on} onClick={()=>{ setVid(x.id); setSel([]); }} style={{flex:'0 0 auto',padding:'6px 11px',borderRadius:999,background:on?C.ink:C.white,border:`1px solid ${on?C.ink:C.line}`,cursor:'pointer',fontSize:13,fontWeight:600,color:on?'#fff':C.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>
            {x.label} <span style={{opacity:0.6}}>{x.open}/{x.pins.length}</span>
          </div>); })}
      </div>
      <svg viewBox={`0 0 ${v.w} ${v.h}`} width="100%" onClick={tap} role="img"
        aria-label={`Map of ${v.label}: ${open} of ${v.pins.length} wine regions unlocked. Tap a region to see it.`}
        style={{display:'block',borderRadius:12,background:'#EEF1F3',cursor:'pointer',maxHeight:420}}>
        <path d={v.land} fill="#F6F2EC" stroke="#D9D2C8" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d={v.borders} fill="none" stroke="#E2DBD1" strokeWidth="1.2"/>
        {[...v.pins].sort((a,b)=>(a.state==='open')-(b.state==='open')).map(p=>{
          const on=sel.includes(p.name);
          return <g key={p.name}>
            {p.drunk>0&&<circle cx={p.x} cy={p.y} r={PIN+5} fill="none" stroke={C.ink} strokeWidth="2.2"/>}
            <circle cx={p.x} cy={p.y} r={on?PIN+3:p.state==='open'?PIN:PIN-2} fill={_pinFill(p)} stroke={p.state==='open'&&p.level==='Not started'?C.cr:'#fff'} strokeWidth={p.state==='open'&&p.level==='Not started'?2.5:2}/>
          </g>;
        })}
      </svg>
      <div aria-hidden="true" style={{display:'flex',flexWrap:'wrap',gap:'4px 12px'}}>
        {legend.map(([c,l])=><span key={l} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:C.mid,fontFamily:C.P}}><span style={{width:9,height:9,borderRadius:5,background:c,border:'1px solid rgba(0,0,0,0.08)'}}/>{l}</span>)}
        <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:12,color:C.mid,fontFamily:C.P}}><span style={{width:9,height:9,borderRadius:6,border:`2px solid ${C.ink}`}}/>You've had one</span>
      </div>
      {picked.length?<div data-testid="map-picked" style={{display:'flex',flexDirection:'column',borderTop:`1px solid ${C.line}`}}>
        {picked.map(p=>(
          <div key={p.name} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${C.line}`}}>
            <Flag region={p.name} size={18}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{p.name}</div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>
                {p.state==='open'?`${p.level} · ${p.score}%`:p.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet'}
                {p.drunk?` · you've had ${p.drunk===1?'one':p.drunk}`:''}
              </div>
            </div>
            {p.state==='open'?(p.score<100&&<div role="button" onClick={()=>_openLearn({kind:'region',region:p.name},nav,showPro)} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap'}}>Quiz →</div>)
              :p.state==='held'?<div role="button" onClick={()=>showPro('regions')} style={{cursor:'pointer'}}><ProBadge/></div>
              :<div role="button" onClick={()=>nav('camera')} style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer',textAlign:'right',maxWidth:120,lineHeight:1.3}}>Scan a bottle from here</div>}
          </div>
        ))}
      </div>:<div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Tap a pin to see a region. Scanning a bottle unlocks its region.</div>}
    </div>
  );
}

/* What they can taste (Palate, pwa-palate.js), beside what they know: their Blind Calls scored
   against each label's profile, a bar per axis with how to notice it, any habit ("you tend to
   call tannins grippier"), and the next step. Not part of the knowledge score. */
function MasteryPalate({p,go}){
  const leans=Palate.leans(p);
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{p.n?`${p.level} · ${p.score}%`:'Not started'}</span>
        <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{p.n} Blind Call{p.n===1?'':'s'}{p.trend!=null&&p.trend!==0?` · ${p.trend>0?'+':''}${p.trend} lately`:''}</span>
      </div>
      <MasteryBar score={p.score}/>
      <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
        {p.n?<>Your calls average {p.accuracy}% accurate{p.n<Palate.FULL_AT?`. The score fills in as you play: ${Palate.FULL_AT-p.n} more to count in full`:''}. Each call is checked against the label's profile, an estimate, so treat it as a guide.</>
          :<>Blind Call asks you to taste first and guess the body, acidity and tannins before you see the label's profile. Your calls build this score, separate from what you've read.</>}
      </div>
      {p.axes.map(a=>(
        <div key={a.id} style={{display:'flex',flexDirection:'column',gap:4}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{flex:'0 0 30%',fontSize:14,fontWeight:600,color:C.ink2,fontFamily:C.P}}>{a.name}</span>
            <div style={{flex:1}}><MasteryBar score={a.score}/></div>
            <span style={{fontSize:13,fontWeight:700,color:C.ink2,fontFamily:C.P,width:38,textAlign:'right'}}>{a.score}%</span>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>{a.how}</div>
        </div>
      ))}
      {leans.map(l=><div key={l} style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45,background:C.offWhite,borderRadius:10,padding:'8px 10px'}}>{l}</div>)}
      {p.next&&<div role="button" onClick={()=>go(p.next)} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{p.next.label} →</div>}
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
function MilestoneMoment({items}){
  const [share,said]=_useShare();
  if(!items||!items.length) return null;
  return(
    <div data-testid="milestone-moment" className="milestone-in" style={{background:C.ink,borderRadius:16,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
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
function MilestoneList({items}){
  const [share,said]=_useShare();
  if(!items.length) return <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Your first comes with your first region studied, or Confident in a wine type. Each one is marked here, with a date.</div>;
  return <div style={{display:'flex',flexDirection:'column'}}>
    <ShowMore items={items} limit={4} noun="milestones" render={x=>(
      <div key={x.id} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 0',borderBottom:`1px solid ${C.line}`}}>
        <Icon n={x.icon} sz={17} col={C.cr}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{x.region&&<Flag region={x.region} size={14} style={{marginRight:6}}/>}{x.title}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{x.at?new Date(x.at).toLocaleDateString('en',{day:'numeric',month:'short',year:'numeric'}):'Earlier'}</div>
        </div>
        <div role="button" aria-label={`Share: ${x.title}`} onClick={()=>share(x)} style={{padding:6,cursor:'pointer'}}><Icon n="share" sz={16} col={C.mid}/></div>
      </div>
    )}/>
    {said&&<div style={{fontSize:13,color:C.green,fontFamily:C.P,marginTop:6}}>{said}</div>}
  </div>;
}

const _MASTERY_CSS=`@keyframes masteryGrow{from{transform:scale(0.2);opacity:0}to{transform:scale(1);opacity:1}}
.mastery-radar-shape{animation:masteryGrow .7s cubic-bezier(.2,.8,.2,1) both}
@keyframes milestoneIn{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
.milestone-in{animation:milestoneIn .5s ease both}
@media (prefers-reduced-motion:reduce){.mastery-radar-shape,.milestone-in{animation:none}}`;

function MasteryMapScreen({nav,back,showPro}){
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
  const go=next=>{ if(next) _openLearn({kind:'mastery',next},nav,showPro); };
  const pick=id=>{
    const a=m.areas.find(x=>x.id===id); if(a&&a.items) setOpen(id);
    const el=listRef.current&&listRef.current.querySelector(`[data-area="${id}"]`);
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  };
  const GROUPS=[{id:'types',label:'Wine types'},{id:'places',label:'Regions and grapes'},{id:'skills',label:'Wine Skills'}];
  const card={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 14px 12px',display:'flex',flexDirection:'column',gap:8};
  const head=t=><div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:6}}>{t}</div>;
  const rise=prog&&prog.rises[0];
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <style>{_MASTERY_CSS}</style>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={C.ink}/></div>
        <span style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>Your Mastery</span>
      </div>
      <div ref={listRef} style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{background:C.ink,borderRadius:16,padding:'18px 16px',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.5)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Your wine knowledge</div>
          <div style={{fontSize:32,fontWeight:800,color:'#fff',fontFamily:C.P}}>{m.overall}% <span style={{fontSize:16,fontWeight:600,color:'rgba(255,255,255,0.6)'}}>{m.level}</span>
            {prog&&prog.overall>0&&<span style={{fontSize:15,fontWeight:700,color:'#7FD3A6',marginLeft:8}}>+{prog.overall} in {prog.weeks} week{prog.weeks===1?'':'s'}</span>}</div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.65)',fontFamily:C.P,lineHeight:1.5}}>Built from the articles you've read and the quizzes you've passed. Only studying and testing move it.</div>
          {focus&&focus.score<100&&<div data-testid="mastery-focus" style={{marginTop:4,background:'rgba(255,255,255,0.08)',borderRadius:12,padding:'12px 12px',display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.5)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Start here</div>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>{focus.area&&focus.area.id==='regions'&&<Flag region={focus.label} size={16} style={{marginRight:6}}/>}{focus.label}</div>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.75)',fontFamily:C.P,lineHeight:1.45}}>{focus.why||`Your biggest gap, at ${focus.score}%.`}</div>
            {focus.next&&<div role="button" onClick={()=>go(focus.next)} style={{fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P,cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>{focus.next.label} →</div>}
          </div>}
        </div>

        <MilestoneMoment items={fresh}/>

        {head('Your shape')}
        <div style={card}>
          <MasteryRadar m={m} prog={prog} onPick={pick}/>
          <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}} aria-hidden="true">
            <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:C.mid,fontFamily:C.P}}><span style={{width:16,height:0,borderTop:`2px solid ${C.cr}`}}/>Now</span>
            {prog&&<span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:C.mid,fontFamily:C.P}}><span style={{width:16,height:0,borderTop:`2px dashed ${C.mid}`}}/>{_when(prog.then.t)}</span>}
          </div>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
            {prog?(rise?<>Since {_when(prog.then.t)} your biggest rise is <b>{rise.label}</b> (+{rise.delta}).{prog.rises.length>1?` ${prog.rises.length-1} other area${prog.rises.length===2?' has':'s have'} grown too.`:''}</>
              :<>No change since {_when(prog.then.t)}. A quiz or an article moves the shape.</>)
              :<>A rounder shape means rounder knowledge. From next week, a dashed outline shows where you were, so you can see it grow.</>}
          </div>
        </div>

        {head('Your palate')}
        <div data-testid="mastery-palate" style={card}>
          <MasteryPalate p={palate} go={go}/>
        </div>

        {head('Your wine map')}
        <div style={card}>
          <MasteryRegionMap views={views} nav={nav} showPro={showPro}/>
        </div>

        {head('Milestones')}
        <div data-testid="mastery-milestones" style={card}><MilestoneList items={milestones}/></div>

        {GROUPS.map(G=>(
          <div key={G.id} style={{display:'flex',flexDirection:'column',gap:8}}>
            {head(G.label)}
            {m.areas.filter(a=>a.group===G.id).map(a=>(
              <div key={a.id} data-area={a.id}><MasteryAreaCard a={a} open={open===a.id} onToggle={()=>a.items&&setOpen(o=>o===a.id?null:a.id)} onNext={()=>go(a.next)}/></div>
            ))}
          </div>
        ))}
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
function QuizScreen({nav,back}){
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
  const [xpGained,setXpGained]=React.useState(0);
  const [milestones,setMilestones]=React.useState([]);
  const startLevel=React.useRef(XPSystem.getLevel(XPSystem.get().total).name);
  const [results,setResults]=React.useState([]);
  const [, setResetTick]=React.useState(0);
  const scrollRef=React.useRef(null);

  const title=quizTitle(config);

  const q=allQs[qIdx];

  function choose(i){
    if(phase!=='question') return;
    setSelected(i);
    setPhase('feedback');
    const correct=i===q.a;
    setStreak(s=>correct?s+1:0);

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
    if(quizSet&&QuizMastery.recordAnswer(quizSet.id,q.q,correct)){
      const a=XPSystem.award([{type:'question_learned'}]);
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
    setQIdx(0); setSelected(null); setPhase(qs.length?'question':'empty'); setStreak(0); setXpGained(0); setResults([]); setMilestones([]); startLevel.current=XPSystem.getLevel(XPSystem.get().total).name;
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
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P,textAlign:'center'}}>{mode==='concept'&&MasterySystem.summary().mastered===MasterySystem.summary().total&&MasterySystem.summary().total>0
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
    else if(quizSet&&setDone){ const next=nextQuizSuggestion(config); if(next) primary={label:`Next: ${next.label}`,go:()=>startSuggested(next.config)}; }
    else if(mode==='concept'){ if(MasterySystem.selectConcepts(6).length) primary={label:'Keep going',go:()=>startQuiz(config)}; }
    else primary={label:'Keep going',go:()=>startQuiz(config)};

    function resetSet(){
      if(!window.confirm(`Reset your progress on ${setName}? Its questions start from scratch.`)) return;
      if(mode==='region') RegionQuizBank.reset(config.region); else QuizMastery.reset(quizSet.id);
      startQuiz(config);
    }
    const card=(done,headline,sub)=>(
      <div style={{background:done?C.greenBg:C.offWhite,borderRadius:12,padding:'12px 14px',border:`1px solid ${done?C.green+'40':C.line}`}}>
        <div style={{fontSize:15,fontWeight:700,color:done?C.green:C.ink,fontFamily:C.P}}>{headline}</div>
        {sub&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{sub}</div>}
      </div>
    );
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:C.cr,padding:'26px 24px 20px',display:'flex',flexDirection:'column',alignItems:'center',gap:5,flexShrink:0}}>
          <Icon n={justCompleted||pct===100?'trophy':pct>=80?'star':pct>=60?'check':'book'} sz={32} col="#fff"/>
          <div style={{fontSize:22,fontWeight:800,color:'#fff',fontFamily:C.P,textAlign:'center'}}>{msg}</div>
          {!justCompleted&&<div style={{fontSize:15,color:'rgba(255,255,255,0.8)',fontFamily:C.P}}>{mode==='region'&&<Flag region={config.region} size={15} style={{marginRight:6}}/>}{title}</div>}
          <div style={{display:'flex',gap:16,marginTop:6}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:800,color:'#fff',fontFamily:C.P}}>{finalScore}/{allQs.length}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Correct</div>
            </div>
            <div style={{width:1,background:'rgba(255,255,255,0.25)'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:28,fontWeight:800,color:'#fff',fontFamily:C.P}}>+{xpGained}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>XP earned</div>
            </div>
          </div>
        </div>
        <div ref={scrollRef} style={{flex:1,overflowY:'auto'}}>
          <div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
            <MilestoneMoment items={milestones}/>
            {setProgress&&(setDone
              ?card(true,justCompleted?`All ${setProgress.total} questions answered correctly`:'Complete — every question answered correctly',
                justCompleted?'This one moves to your completed list on the Learn tab.':null)
              :card(false,`${setProgress.correct} of ${setProgress.total} questions answered correctly`,`Questions you haven't got right yet come first in your next quiz. You earn XP for each one the first time you get it right, and ${XPSystem.QUIZ_SET_BONUS()} XP for finishing the set.`))}
            {concepts&&card(concepts.mastered===concepts.total,`${concepts.mastered} of ${concepts.total} concepts mastered`,
              concepts.mastered===concepts.total?null:'Each right answer moves a concept up a step and a miss moves it back one; five steps masters it.')}
            {setDone&&(
              <div style={{display:'flex',justifyContent:'center',gap:18}}>
                <span onClick={()=>startQuiz(config)} style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Practise again</span>
                <span onClick={resetSet} style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,textDecoration:'underline',cursor:'pointer'}}>Reset progress</span>
              </div>
            )}
            <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>Review</div>
            {results.map((r,i)=>(
              <div key={i} style={{background:r.correct?C.greenBg:'#FFF0F0',borderRadius:12,padding:'10px 14px',border:`1px solid ${r.correct?C.green+'30':'#F5A0A0'}`}}>
                <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                  <span style={{fontSize:18,flexShrink:0}}>{r.correct?'✓':'✗'}</span>
                  <div>
                    <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{r.qText}</div>
                    {!r.correct&&<div style={{fontSize:15,color:'#C0392B',fontFamily:C.P,marginTop:3}}>Your answer: {r.selectedOpt}</div>}
                    {!r.correct&&<div style={{fontSize:15,color:C.green,fontFamily:C.P}}>Correct: {r.correctOpt}</div>}
                    {r.fact&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:4,lineHeight:1.4,fontStyle:'italic'}}>{r.fact}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Actions stay pinned below the review so they're visible without scrolling. */}
        <div style={{flexShrink:0,padding:'12px 16px calc(12px + env(safe-area-inset-bottom))',borderTop:`1px solid ${C.line}`,background:C.white,display:'flex',flexDirection:'column',gap:8}}>
          {primary&&<Btn primary full onClick={nextLoading?undefined:primary.go}>{nextLoading?'Getting it ready…':primary.label}</Btn>}
          <Btn primary={!primary} full onClick={()=>nav('learn')}>Back to Learn</Btn>
        </div>
      </div>
    );
  }

  const progress=(qIdx+1)/allQs.length;
  const optColors=selected===null
    ? q.opts.map(()=>({bg:C.white,border:C.line,text:C.ink}))
    : q.opts.map((_,i)=>{
        if(i===q.a) return {bg:C.greenBg,border:C.green,text:C.green};
        if(i===selected&&selected!==q.a) return {bg:'#FFF0F0',border:'#E88080',text:'#C0392B'};
        return {bg:C.white,border:C.line,text:C.ink};
      });

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px 12px',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div onClick={back} style={{width:32,height:32,borderRadius:16,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={14} col={C.ink}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{mode==='region'&&<Flag region={config.region} size={17} style={{marginRight:7}}/>}{title}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            {streak>=2&&<Icon n="flame" sz={18} col={C.cr}/>}
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{qIdx+1}/{allQs.length}</span>
          </div>
        </div>
        <div style={{height:5,borderRadius:3,background:C.offWhite,overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:3,background:C.cr,width:`${Math.round(progress*100)}%`,transition:'width .4s ease'}}/>
        </div>
      </div>

      <div onClick={phase==='feedback'?advance:undefined} style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14,cursor:phase==='feedback'?'pointer':'default'}}>
        <div style={{fontSize:21,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.4}}>{q.q}</div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
          {q.opts.map((opt,i)=>{
            const s=optColors[i]||{bg:C.white,border:C.line,text:C.ink};
            return(
              <div key={i} onClick={()=>choose(i)}
                style={{padding:'15px 16px',borderRadius:14,border:`2px solid ${s.border}`,background:s.bg,cursor:phase==='question'?'pointer':'default',transition:'all .2s',display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:28,height:28,borderRadius:14,background:s.border+'25',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:15,fontWeight:700,color:s.text,fontFamily:C.P}}>
                    {phase==='feedback'&&i===q.a?'✓':phase==='feedback'&&i===selected&&selected!==q.a?'✗':String.fromCharCode(65+i)}
                  </span>
                </div>
                <span style={{fontSize:17,fontWeight:500,color:s.text,fontFamily:C.P,lineHeight:1.35}}>{opt}</span>
              </div>
            );
          })}
        </div>
        {phase==='feedback'&&(
          <div style={{animation:'fadeIn .3s ease'}}>
            <div style={{background:selected===q.a?C.greenBg:'#FFF8F0',borderRadius:14,padding:'12px 14px',border:`1px solid ${selected===q.a?C.green+'40':'#F5C07040'}`,marginBottom:12}}>
              <div style={{fontSize:16,fontWeight:700,color:selected===q.a?C.green:'#B87000',fontFamily:C.P,marginBottom:4}}>{selected===q.a?'Correct!':'Not quite'}</div>
              {q.fact&&<div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{q.fact}</div>}
            </div>
            <div onClick={e=>{e.stopPropagation();advance();}} style={{background:C.cr,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 22px ${C.cr}45`,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>{qIdx+1>=allQs.length?'See Results →':'Next Question →'}</span>
            </div>
          </div>
        )}
        <div style={{height:12}}/>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

Object.assign(window,{QuizHubScreen,QuizScreen,MasteryMapScreen});
