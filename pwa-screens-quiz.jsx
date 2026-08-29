/* Vinterest — Quiz Hub + Quiz Screens */

// Emoji badge → line icon, until pwa-xp.js itself drops emoji (tracked separately).
const _LEVEL_ICONS={'🍇':'wine','🥂':'leaf','🌍':'compass','🔍':'book','🏅':'star','🍾':'flame','🎓':'trophy','⭐':'brain','🏆':'trophy','👑':'trophy'};

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
      <div style={{fontSize:34,fontWeight:400,color:'#fff',fontFamily:C.serif,textAlign:'center',animation:'dnaRise 1.1s .1s ease both'}}>WineDNA unlocked</div>
      <div style={{fontSize:16,color:'rgba(255,255,255,0.55)',fontFamily:C.P,textAlign:'center',lineHeight:1.5,maxWidth:280,animation:'dnaRise 1.1s .2s ease both'}}>Your palate has enough range now — Explore Next recommendations start today.</div>
      <div onClick={onDone} style={{marginTop:14,background:'#D4AF6A',borderRadius:14,padding:'13px 28px',cursor:'pointer',animation:'dnaRise 1.1s .3s ease both'}}>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>See WineDNA</span>
      </div>
      <style>{`@keyframes dnaRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function _dominantRegion(wines){
  const c={};
  wines.forEach(w=>{ if(w.region) c[w.region]=(c[w.region]||0)+1; });
  const top=Object.entries(c).sort((a,b)=>b[1]-a[1])[0];
  return top&&top[1]>=2?top[0]:null;
}

/* ── QUIZ HUB / LEARN TAB ── */
function QuizHubScreen({nav,back,showPro}){
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());
  const [isPro,setIsPro]=React.useState(()=>!!localStorage.getItem('vinterest_pro'));
  React.useEffect(()=>{const h=()=>setIsPro(true);window.addEventListener('vinterest:pro',h);return()=>window.removeEventListener('vinterest:pro',h);},[]);
  const level=XPSystem.getLevel(xpData.total);
  const nextLvl=XPSystem.nextLevel(xpData.total);
  const prog=XPSystem.levelProgress(xpData.total);
  const article1Done=onRampDone(ON_RAMP[0].id);
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
    try{ return JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'null'); }catch(e){ return null; }
  });
  React.useEffect(()=>{
    if(!article1Done) return;
    const w=WineHistory.getAll();
    if(!w.length) return;
    const updated=ContentEngine.refreshShelf(w,6);
    setGenStubs(updated);
  },[article1Done]);

  if(showUnlock) return <WineDNAUnlockCelebration onDone={()=>{setShowUnlock(false);nav('profile');}}/>;

  const zoneLabel={fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2};
  const unreadShelf=(genStubs||[]).filter(s=>!localStorage.getItem('vinterest_gen_article_'+s.id+'_done'));
  const nextOnRamp=ON_RAMP.find(a=>!onRampDone(a.id));
  const nextBest=nextOnRamp
    ? {kind:'onramp',title:nextOnRamp.title,sub:nextOnRamp.subtitle,readTime:nextOnRamp.readTime,action:()=>{sessionStorage.setItem('vinterest_onramp_idx',String(ON_RAMP.indexOf(nextOnRamp)));nav('article');}}
    : unreadShelf.length
      ? {kind:'shelf',stub:unreadShelf[0],title:unreadShelf[0].title,sub:unreadShelf[0].subtitle,action:()=>{sessionStorage.setItem('vinterest_gen_article',JSON.stringify(unreadShelf[0]));nav('gen-article');}}
      : {kind:'scan',title:'Scan a bottle for your next read',sub:"Your shelf restocks based on what you try.",action:()=>nav('camera')};

  const mastery=MasterySystem.summary();
  const region=_dominantRegion(wines);
  const wordsCount=VocabLedger.getAll().length;
  const startQuiz=cfg=>{ sessionStorage.setItem('vinterest_quiz_config2',JSON.stringify(cfg)); nav('quiz'); };

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px 0',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,flex:1,letterSpacing:'-0.4px'}}>Learn</span>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <Icon n={_LEVEL_ICONS[level.badge]||'wine'} sz={15} col={C.cr}/>
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
                    <div style={{fontSize:12,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:2}}>Quick Read · {stub.readTime}</div>
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
        {!coverage.unlocked ? QUIZ_TOPICS.map((topic,ti)=>(
          <div key={ti} onClick={()=>startQuiz({mode:'practice',topicId:topic.id})}
            style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
            <div style={{width:42,height:42,borderRadius:12,background:topic.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`}}>
              <Icon n={topic.iconName||'book'} sz={20} col={topic.color}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
              <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{topic.desc}</div>
            </div>
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>
        )):(
          <>
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
            {region&&(
              <div onClick={()=>startQuiz({mode:'region',region})} style={{background:C.white,borderRadius:14,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:`1px solid ${C.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="map" sz={20} col={C.ink}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {region} Knowledge</div>
                  <div style={{fontSize:14,color:C.mid,fontFamily:C.P}}>Grounded in bottles you've scanned from there</div>
                </div>
                <Icon n="chevron" sz={13} col={C.mid}/>
              </div>
            )}
          </>
        )}
        </div>

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
function assembleWordsQuiz(){
  const terms=VocabLedger.getAll();
  const pool=_shuffle(terms).slice(0,6);
  return pool.map(t=>{
    const distractors=_shuffle(terms.filter(x=>x.term!==t.term)).slice(0,3).map(x=>x.meaning);
    while(distractors.length<3) distractors.push('None of these');
    const opts=_shuffle([t.meaning,...distractors]);
    return {q:`What does "${t.term}" mean?`,opts,a:opts.indexOf(t.meaning),fact:null,conceptId:null,vocabTerm:t.term};
  });
}
function assemblePracticeQuiz(topicId){
  const topic=QUIZ_TOPICS.find(t=>t.id===topicId)||QUIZ_TOPICS[0];
  const qs=_shuffle(topic.questions.beginner||[]).slice(0,6);
  return qs.map(q=>_shuffleOpts(q));
}

/* ── QUIZ SCREEN ── */
function QuizScreen({nav,back}){
  const config=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_quiz_config2')||'null'); }catch(e){ return null; }
  },[]);
  const mode=config?.mode||'concept';

  const buildQs=React.useCallback(()=>{
    if(mode==='practice') return assemblePracticeQuiz(config.topicId);
    if(mode==='words') return assembleWordsQuiz();
    if(mode==='region') return assembleConceptQuiz(['appellation_hierarchy','vintage_variation']);
    return assembleConceptQuiz(MasterySystem.selectConcepts(6));
  },[mode,config]);

  const [allQs,setAllQs]=React.useState(buildQs);
  const [qIdx,setQIdx]=React.useState(0);
  const [selected,setSelected]=React.useState(null);
  const [phase,setPhase]=React.useState(allQs.length?'question':'empty');
  const [streak,setStreak]=React.useState(0);
  const [xpGained,setXpGained]=React.useState(0);
  const [results,setResults]=React.useState([]);
  const scrollRef=React.useRef(null);

  const title=mode==='practice'?(QUIZ_TOPICS.find(t=>t.id===config.topicId)||QUIZ_TOPICS[0]).label
    :mode==='words'?"Words You've Met"
    :mode==='region'?'Your '+config.region+' Knowledge'
    :'Concept Check';

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

  function newQuiz(){
    setAllQs(buildQs()); setQIdx(0); setSelected(null); setPhase('question'); setStreak(0); setXpGained(0); setResults([]);
  }

  if(phase==='empty') return(
    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,padding:32}}>
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P,textAlign:'center'}}>Nothing to test yet — scan and rate a few more bottles first.</span>
      <Btn primary onClick={()=>nav('learn')}>Back to Learn</Btn>
    </div>
  );

  if(phase==='results'){
    const finalScore=results.filter(r=>r.correct).length;
    const pct=Math.round(finalScore/allQs.length*100);
    const msg=pct===100?'Perfect!':pct>=80?'Excellent!':pct>=60?'Good work!':'Keep practising';
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:C.cr,padding:'48px 24px 32px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
          <Icon n={pct===100?'trophy':pct>=80?'star':pct>=60?'check':'book'} sz={44} col="#fff"/>
          <div style={{fontSize:28,fontWeight:800,color:'#fff',fontFamily:C.P}}>{msg}</div>
          <div style={{fontSize:17,color:'rgba(255,255,255,0.8)',fontFamily:C.P}}>{title}</div>
          <div style={{display:'flex',gap:16,marginTop:8}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>{finalScore}/{allQs.length}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Correct</div>
            </div>
            <div style={{width:1,background:'rgba(255,255,255,0.25)'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>+{xpGained}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>XP earned</div>
            </div>
          </div>
        </div>
        <div ref={scrollRef} style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P}}>Review</div>
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
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <Btn full style={{flex:1}} onClick={()=>{if(scrollRef.current)scrollRef.current.scrollTop=0;}}>{pct<100?'See what you missed':'Practice more'}</Btn>
            <Btn primary full style={{flex:1}} onClick={newQuiz}>New quiz</Btn>
          </div>
          <div style={{height:8}}/>
        </div>
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
