/* Vinterest — Quiz Hub + Quiz Screens */


const _RING_TYPES=[
  {key:'red',label:'Reds',col:'#8B1A2F'},{key:'white',label:'Whites',col:'#B8963E'},
  {key:'rose',label:'Rosé',col:'#C47A8A'},{key:'sparkling',label:'Sparkling',col:'#5E8FA8'},
];
function _normType(t){return(t||'').toLowerCase().replace('é','e');}
function getCoverage(wines){
  const extra=['orange','dessert','fortified'];
  const seen=new Set(wines.map(w=>_normType(w.type)).filter(Boolean));
  const segs=_RING_TYPES.concat(extra.filter(k=>seen.has(k)).map(k=>({key:k,label:k[0].toUpperCase()+k.slice(1),col:_TYPE_COLORS&&_TYPE_COLORS[k]||C.cr})))
    .map(s=>({...s,filled:seen.has(s.key)}));
  const distinctTypes=segs.filter(s=>s.filled).length;
  const rated=wines.filter(w=>w.rating>0);
  const spread=arr=>{const v=arr.filter(x=>x!=null);return v.length?Math.max(...v)-Math.min(...v):0;};
  const hasSpread=spread(rated.map(w=>w.body))>=0.25||spread(rated.map(w=>w.sweetness))>=0.25;
  const nextMissing=segs.find(s=>!s.filled);
  return {segs,distinctTypes,hasSpread,unlocked:distinctTypes>=3&&hasSpread,nextMissing};
}
function CoverageRing({segs,size=104,stroke=9}){
  const n=segs.length,r=(size-stroke)/2,c=2*Math.PI*r,gap=7,segLen=c/n-gap;
  return(
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{display:'block',flexShrink:0}}>
      {segs.map((s,i)=>(
        <circle key={s.key} cx={size/2} cy={size/2} r={r} fill="none" stroke={s.filled?s.col:C.line} strokeWidth={stroke}
          strokeDasharray={`${segLen} ${c-segLen}`} strokeDashoffset={-i*(c/n)} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`}/>
      ))}
    </svg>
  );
}

function WineDNAUnlockCelebration({onDone}){
  return(
    <div style={{position:'absolute',inset:0,background:C.ink,zIndex:200,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,gap:14}}>
      <div style={{animation:'dnaRise 1.1s ease both'}}><Icon n="brain" sz={40} col="#D4AF6A"/></div>
      <div style={{fontSize:34,fontWeight:400,color:'#fff',fontFamily:C.P,textAlign:'center',animation:'dnaRise 1.1s .1s ease both'}}>WineDNA unlocked</div>
      <div style={{fontSize:16,color:'rgba(255,255,255,0.55)',fontFamily:C.P,textAlign:'center',lineHeight:1.5,maxWidth:280,animation:'dnaRise 1.1s .2s ease both'}}>Your palate has enough range now — Explore Next recommendations start today.</div>
      <div onClick={onDone} style={{marginTop:14,background:'#D4AF6A',borderRadius:14,padding:'13px 28px',cursor:'pointer',animation:'dnaRise 1.1s .3s ease both'}}>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>See WineDNA</span>
      </div>
      <style>{`@keyframes dnaRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

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
  const [isPro,setIsPro]=React.useState(()=>!!localStorage.getItem('vinterest_pro'));
  React.useEffect(()=>{const h=()=>setIsPro(true);window.addEventListener('vinterest:pro',h);return()=>window.removeEventListener('vinterest:pro',h);},[]);
  const level=XPSystem.getLevel(xpData.total);
  const nextLvl=XPSystem.nextLevel(xpData.total);
  const prog=XPSystem.levelProgress(xpData.total);
  const article1Done=ON_RAMP.length>0&&onRampDone(ON_RAMP[0].id);
  const wines=React.useMemo(()=>WineHistory.getAll(),[]);
  const coverage=React.useMemo(()=>getCoverage(wines),[wines]);
  const [showUnlock,setShowUnlock]=React.useState(false);
  React.useEffect(()=>{
    if(coverage.unlocked && !localStorage.getItem('vinterest_wineDNA_unlock_seen')){
      localStorage.setItem('vinterest_wineDNA_unlock_seen','1');
      setShowUnlock(true);
    }
  },[coverage.unlocked]);

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
  const unreadShelf=(genStubs||[]).filter(s=>!localStorage.getItem('vinterest_gen_article_'+s.id+'_done'));
  const nextOnRamp=ON_RAMP.find(a=>!onRampDone(a.id));
  const nextBest=nextOnRamp
    ? {kind:'onramp',title:nextOnRamp.title,sub:nextOnRamp.subtitle,readTime:nextOnRamp.readTime,action:()=>{sessionStorage.setItem('vinterest_onramp_idx',String(ON_RAMP.indexOf(nextOnRamp)));nav('article');}}
    : unreadShelf.length
      ? {kind:'shelf',stub:unreadShelf[0],title:unreadShelf[0].title,sub:unreadShelf[0].subtitle,action:()=>{sessionStorage.setItem('vinterest_gen_article',JSON.stringify(unreadShelf[0]));nav('gen-article');}}
      : {kind:'scan',title:'Scan a bottle for your next read',sub:"Your shelf restocks based on what you try.",action:()=>nav('camera')};

  const mastery=MasterySystem.summary();
  // Bumped after a progress reset so the to-do/completed splits below recompute.
  const [progressTick,setProgressTick]=React.useState(0);
  const quizRegions=React.useMemo(()=>regionQuizCandidates(wines),[wines,progressTick]);
  const doneRegions=React.useMemo(()=>completedRegionQuizzes(wines),[wines,progressTick]);
  const [regionsExpanded,setRegionsExpanded]=React.useState(false);
  function resetProgress(name,doReset){
    if(!window.confirm(`Reset your progress on ${name}? Its questions start from scratch.`)) return;
    doReset();
    setProgressTick(t=>t+1);
  }
  const wordsCount=VocabLedger.getAll().length;
  const startQuiz=cfg=>{ sessionStorage.setItem('vinterest_quiz_config2',JSON.stringify(cfg)); nav('quiz'); };
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

  // After every hook above: returning early before one of them changes the hook count between
  // renders, and React throws the moment the unlock effect flips showUnlock.
  if(showUnlock) return <WineDNAUnlockCelebration onDone={()=>{setShowUnlock(false);nav('profile');}}/>;

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
        {!coverage.unlocked&&(
          <div style={{display:'flex',alignItems:'center',gap:14,padding:'2px 0 16px'}}>
            <CoverageRing segs={coverage.segs}/>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:3}}>Discovering your palate</div>
              <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>{coverage.nextMissing?`You haven't rated a ${coverage.nextMissing.label.toLowerCase()} yet.`:'Rate a wider spread of body and sweetness to unlock WineDNA.'}</div>
            </div>
          </div>
        )}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        <div>
          <div style={zoneLabel}>Next Best Thing</div>
          <div onClick={nextBest.action} style={{background:C.ink,borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',marginTop:8}}>
            <div style={{width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n={nextBest.kind==='scan'?'camera':nextBest.kind==='onramp'?'book':(nextBest.stub.iconName||'read')} sz={20} col="rgba(255,255,255,0.7)"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{nextBest.kind==='onramp'?'On-Ramp · '+nextBest.readTime:nextBest.kind==='shelf'?'Quick Read · '+nextBest.stub.readTime:'Free forever'}</div>
              <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3,marginBottom:2}}>{nextBest.title}</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.4}}>{nextBest.sub}</div>
            </div>
            <Icon n="chevron" sz={13} col="rgba(255,255,255,0.3)"/>
          </div>
        </div>

        {article1Done&&(
          <div>
            <div style={zoneLabel}>Your Shelf</div>
            <div style={{marginTop:8,display:'flex',flexDirection:'column',gap:8}}>
            {(!genStubs||!genStubs.length)&&(
              <div style={{padding:'18px 16px',textAlign:'center',background:C.white,borderRadius:14,border:`1px dashed ${C.line}`}}>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Nothing on your shelf yet. Scan a bottle and we'll have something for you by morning.</span>
              </div>
            )}
            {genStubs&&genStubs.map((stub,i)=>{
              const done=!!localStorage.getItem('vinterest_gen_article_'+stub.id+'_done');
              return(
                <div key={i} onClick={()=>{sessionStorage.setItem('vinterest_gen_article',JSON.stringify(stub));nav('gen-article');}}
                  style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`,marginBottom:8,opacity:done?0.7:1}}>
                  <div style={{width:44,height:44,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${C.crDim}`}}>
                    <Icon n={stub.iconName||'read'} sz={20} col={C.cr}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>{stub.series?`${stub.series} series`:'Quick Read'} · {stub.readTime}</div>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{stub.title}</div>
                    <div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:2}}>{stub.subtitle}</div>
                  </div>
                  {done ? <span style={{fontSize:14,fontWeight:700,color:C.green,fontFamily:C.P}}>✓</span> : <Icon n="chevron" sz={13} col={C.mid}/>}
                </div>
              );
            })}
            </div>
          </div>
        )}

        <div style={zoneLabel}>Test Yourself</div>
        <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>
          <div style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>Wine Basics</div>
          {topicsToShow.map(topic=>{
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
          })}
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
          {coverage.unlocked&&(
            <>
              <div style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:6}}>Personalised For You</div>
              <div onClick={()=>startQuiz({mode:'concept'})} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${C.crDim}`}}><Icon n="brain" sz={20} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Concept Check</div>
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{mastery.encountered}/{mastery.total} concepts met · {mastery.mastered} mastered</div>
                </div>
                <Icon n="chevron" sz={13} col={C.mid}/>
              </div>
              {wordsCount>=4&&(
                <div onClick={()=>startQuiz({mode:'words'})} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                  <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="read" sz={20} col={C.ink}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Words You've Met</div>
                    <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{wordsCount} terms from bottles you've actually had</div>
                  </div>
                  <Icon n="chevron" sz={13} col={C.mid}/>
                </div>
              )}
              {(quizRegions.length>0||doneRegions.length>0)&&(
                <div style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:6}}>Regional Knowledge</div>
              )}
              {quizRegions.map(region=>{
                const info=KNOWLEDGE.regions[region];
                // Progress only once the region's generated bank exists, so the count doesn't
                // jump from the fallback's /6 to /15 when it arrives.
                const p=RegionQuizBank.get(region)&&RegionQuizBank.progress(region);
                const sub=[info&&info.keyGrapes&&info.keyGrapes[0],info&&info.classification,p&&p.correct>0&&`${p.correct}/${p.total} correct`].filter(Boolean).join(' · ');
                return(
                  <div key={region} onClick={()=>handleRegionTap(region)} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                    <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="map" sz={20} col={C.ink}/></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{region}</div>
                      <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{sub}</div>
                    </div>
                    {regionLoading===region
                      ?<div style={{width:14,height:14,borderRadius:7,border:`2px solid ${C.line}`,borderTopColor:C.cr,animation:'storySpin .8s linear infinite'}}/>
                      :<Icon n="chevron" sz={13} col={C.mid}/>}
                  </div>
                );
              })}
              {doneRegions.length>0&&<CompletedToggle count={doneRegions.length} expanded={regionsExpanded} onToggle={()=>setRegionsExpanded(e=>!e)}/>}
              {regionsExpanded&&doneRegions.map(region=>(
                <div key={region} onClick={()=>handleRegionTap(region)} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`,opacity:0.7}}>
                  <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="map" sz={20} col={C.ink}/></div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{region}</div>
                    <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Every question answered · tap to practise</div>
                  </div>
                  <CompletedMark onReset={()=>resetProgress(region,()=>RegionQuizBank.reset(region))}/>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={zoneLabel}>Your Grapes</div>
        <div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:2}}>{unlockedGrapes.length}/{GRAPE_ALLOWLIST.length} unlocked · {isPro?'tap any grape for its quiz; locked ones unlock as you tap':`${unlockedGrapes.length?'tap one for its quiz · ':''}rate a wine to unlock more (${FREE_GRAPE_CAP} free)`}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:8}}>
        {unlockedGrapes.map(g=>{
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
        {lockedGrapes.length>0&&(
          <div onClick={()=>setGrapesExpanded(e=>!e)} style={{flex:'0 0 auto',padding:'10px 18px',borderRadius:999,background:C.white,border:`1px dashed ${C.line}`,cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            {grapesExpanded?<Icon n="chevron" sz={12} col={C.mid} style={{transform:'rotate(-90deg)'}}/>:<Icon n="lock" sz={12} col={C.mid}/>}
            <span style={{fontSize:14,fontWeight:600,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{grapesExpanded?'Show less':`+${lockedGrapes.length} more`}</span>
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

        <div style={zoneLabel}>Your Progress</div>
        <div onClick={()=>isPro?nav('mastery-map'):showPro('mastery-map')} style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,marginTop:8,cursor:'pointer'}}>
          <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="list" sz={19} col={C.ink}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Concept Mastery Map</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{mastery.mastered}/{mastery.total} mastered — see the whole picture</div>
          </div>
          {!isPro&&<ProBadge/>}
          <Icon n="chevron" sz={13} col={C.mid}/>
        </div>

        <div style={zoneLabel}>Tracks</div>
        <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,opacity:0.6,marginTop:8}}>
          <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="list" sz={19} col={C.mid}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Multi-part courses</div>
            <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Coming soon</div>
          </div>
          <ProBadge/>
        </div>

        <div style={{height:8}}/>
        <div onClick={()=>{localStorage.removeItem(XPSystem.KEY);setXpData(XPSystem.fresh());}} style={{textAlign:'center',padding:'8px',cursor:'pointer'}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P,textDecoration:'underline'}}>Reset XP &amp; progress</span>
        </div>
        <div style={{height:16}}/>
      </div>
</div>
<style>{`@keyframes storySpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ── CONCEPT MASTERY MAP (PRO) ── */
function MasteryMapScreen({nav,back}){
  const d=MasterySystem.get();
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={C.ink}/></div>
        <span style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>Concept Mastery Map</span>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:10}}>
        {CONCEPTS.map(c=>{
          const s=d[c.id]||{box:0,right:0,wrong:0,mastered:false};
          const pct=Math.round((s.box/5)*100);
          return(
            <div key={c.id} style={{background:C.white,borderRadius:14,border:`1px solid ${C.line}`,padding:'14px 16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{c.label}</span>
                {s.mastered ? <Icon n="check" sz={16} col={C.green}/> : <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{s.right||0} right · {s.wrong||0} wrong</span>}
              </div>
              <div style={{height:6,borderRadius:3,background:C.offWhite,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:3,background:s.mastered?C.green:C.cr,width:`${pct}%`,transition:'width .5s ease'}}/>
              </div>
            </div>
          );
        })}
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
    :'Concept Check';
}
/* What to offer once a set is complete: the next unfinished set of the same kind, then Wine
   Basics, then regions (only once WineDNA has unlocked them, as on the Learn tab), then
   unlocked grapes. null means everything on offer is done. */
function nextQuizSuggestion(config){
  const wines=WineHistory.getAll();
  const topics=QUIZ_TOPICS.filter(t=>t.id!==config.topicId&&!QuizMastery.isComplete('topic:'+t.id,QuizMastery.topicPool(t.id)))
    .map(t=>({config:{mode:'practice',topicId:t.id},label:t.label}));
  const regions=(getCoverage(wines).unlocked?regionQuizCandidates(wines):[]).filter(r=>r!==config.region)
    .map(r=>({config:{mode:'region',region:r},label:r}));
  const grapes=Object.keys(GrapeUnlocks.all()).filter(g=>g!==config.grape&&!grapeQuizComplete(g))
    .map(g=>({config:{mode:'grape',grape:g},label:g}));
  const order=config.mode==='region'?[regions,topics,grapes]:config.mode==='grape'?[grapes,topics,regions]:[topics,regions,grapes];
  for(const list of order) if(list.length) return list[0];
  return null;
}

/* ── QUIZ SCREEN ── */
function QuizScreen({nav,back}){
  // Config is state so the results screen can move straight on to the next quiz or set.
  const [config,setConfig]=React.useState(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_quiz_config2')||'null'); }catch(e){ return null; }
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
        XPSystem.toast(a);
      }
    }
    if(q.vocabTerm) VocabLedger.recordTest(q.vocabTerm,correct);
    if(quizSet) QuizMastery.recordAnswer(quizSet.id,q.q,correct);
    if(gained){ setXpGained(xp=>xp+gained); }

    setResults(rs=>[...rs,{correct,qText:q.q,selectedOpt:q.opts[i],correctOpt:q.opts[q.a],fact:q.fact}]);
  }

  function advance(){
    if(phase!=='feedback') return;
    if(qIdx+1>=allQs.length){
      const finalScore=results.filter(r=>r.correct).length+(selected===q.a?0:0);
      const boxes=allQs.filter(x=>x.conceptId).map(x=>{const d=MasterySystem.get();return d[x.conceptId]?d[x.conceptId].box:1;});
      const avgBox=boxes.length?boxes.reduce((s,b)=>s+b,0)/boxes.length/5:0;
      const quizKey=mode==='practice'?'onramp_'+config.topicId:mode+'_'+Date.now();
      const a2=XPSystem.award([{type:'quiz_complete',quizKey,derivedDifficulty:avgBox}]);
      const g2=a2.filter(x=>!x.levelUp).reduce((s,a)=>s+a.amount,0);
      setXpGained(xp=>xp+g2);
      XPSystem.toast(a2);
      setPhase('results');
    } else {
      setQIdx(i=>i+1); setSelected(null); setPhase('question');
    }
  }

  function startQuiz(cfg){
    const qs=buildQuizQuestions(cfg);
    const set=quizSetFor(cfg?.mode||'concept',cfg);
    sessionStorage.setItem('vinterest_quiz_config2',JSON.stringify(cfg));
    setConfig(cfg); setAllQs(qs); setStartedComplete(!!set&&QuizMastery.isComplete(set.id,set.pool()));
    setQIdx(0); setSelected(null); setPhase(qs.length?'question':'empty'); setStreak(0); setXpGained(0); setResults([]);
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
          {!justCompleted&&<div style={{fontSize:15,color:'rgba(255,255,255,0.8)',fontFamily:C.P}}>{title}</div>}
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
            {setProgress&&(setDone
              ?card(true,justCompleted?`All ${setProgress.total} questions answered correctly`:'Complete — every question answered correctly',
                justCompleted?'This one moves to your completed list on the Learn tab.':null)
              :card(false,`${setProgress.correct} of ${setProgress.total} questions answered correctly`,"Questions you haven't got right yet come first in your next quiz."))}
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
            <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{title}</div>
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
