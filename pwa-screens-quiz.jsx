/* Vinterest — Quiz Hub + Quiz Screens */

/* ── QUIZ HUB ── */
function QuizHubScreen({nav,back,showPro}){
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());
  const [isPro,setIsPro]=React.useState(()=>!!localStorage.getItem('vinterest_pro'));
  React.useEffect(()=>{const h=()=>setIsPro(true);window.addEventListener('vinterest:pro',h);return()=>window.removeEventListener('vinterest:pro',h);},[]);
  const qc=xpData.quizCompleted||{};
  const level=XPSystem.getLevel(xpData.total);
  const nextLvl=XPSystem.nextLevel(xpData.total);
  const prog=XPSystem.levelProgress(xpData.total);

  const DIFFS=[
    {id:'beginner',    label:'Beginner',    xp:50,  col:'#1E7B4B', bg:'#E8F5EE'},
    {id:'intermediate',label:'Intermediate',xp:100, col:'#B8963E', bg:'#FFF8E1'},
    {id:'expert',      label:'Expert',      xp:200, col:'#8B1A2F', bg:'#FDF0F3'},
  ];

  function startQuiz(topicId, difficulty){
    sessionStorage.setItem('vinterest_quiz_config', JSON.stringify({topicId, difficulty}));
    nav('quiz');
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 0',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <span style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,flex:1,letterSpacing:'-0.4px'}}>Learn</span>
          <div style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <span style={{fontSize:18}}>{level.badge}</span>
            <span style={{fontSize:15,fontWeight:700,color:C.cr,fontFamily:C.P}}>{xpData.total} XP</span>
          </div>
        </div>
        {/* Level progress bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{level.name}</span>
            {nextLvl&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{nextLvl.min - xpData.total} XP to {nextLvl.name}</span>}
          </div>
          <div style={{height:7,borderRadius:4,background:C.offWhite,overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:4,background:level.color,width:`${Math.round(prog*100)}%`,transition:'width .6s ease'}}/>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:14}}>
        {/* Featured article */}
        <div onClick={()=>nav('article')} style={{background:'linear-gradient(135deg,#1a1a2e,#16213e)',borderRadius:16,padding:'16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.08)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:22}}>📖</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:600,color:'rgba(255,255,255,0.4)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Quick Read · 2 min</div>
            <div style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3}}>5 taste terms every wine drinker should know</div>
          </div>
          <Icon n="chevron" sz={13} col="rgba(255,255,255,0.3)"/>
        </div>
        <div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>Quizzes</div>

        {QUIZ_TOPICS.map((topic,ti)=>{
          const completedCount=DIFFS.filter(d=>qc[topic.id+'_'+d.id]).length;
          const allDone=completedCount===3;
          return(
            <div key={ti} style={{background:C.white,borderRadius:18,border:`1px solid ${C.line}`,overflow:'hidden',boxShadow:'0 1px 4px rgba(0,0,0,0.04)',flexShrink:0}}>
              {/* Topic header */}
              <div style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${C.line}`}}>
                <div style={{width:42,height:42,borderRadius:12,background:topic.color+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,border:`1px solid ${topic.color}25`,fontSize:22}}>
                  {topic.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
                  <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{topic.desc}</div>
                </div>
                {allDone&&<span style={{fontSize:18}}>✅</span>}
                {!allDone&&completedCount>0&&<span style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P}}>{completedCount}/3</span>}
              </div>
              {/* Difficulty rows */}
              {DIFFS.map((d,di)=>{
                const done=!!qc[topic.id+'_'+d.id];
                const xpEarned=qc[topic.id+'_'+d.id]||0;
                const locked=d.id==='expert'&&!isPro;
                return(
                  <div key={di} onClick={()=>{if(locked){showPro('expert-quiz');return;}startQuiz(topic.id,d.id);}}
                    style={{padding:'11px 14px',display:'flex',alignItems:'center',gap:10,borderBottom:di<2?`1px solid ${C.line}`:'none',cursor:'pointer',background:locked?'rgba(0,0,0,0.01)':done?d.bg:'transparent',transition:'background .15s',opacity:locked?0.6:1}}>
                    <div style={{width:30,height:30,borderRadius:8,background:locked?'rgba(0,0,0,0.04)':done?d.col:'rgba(0,0,0,0.04)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:14}}>{locked?'🔒':done?'✓':'▷'}</span>
                    </div>
                    <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:16,fontWeight:600,color:locked?C.mid:done?d.col:C.ink,fontFamily:C.P}}>{d.label}</span>
                      {locked&&<ProBadge/>}
                      {done&&!locked&&<span style={{fontSize:12,color:d.col,fontFamily:C.P,fontWeight:500}}>+{xpEarned} XP earned</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:4}}>
                      {!done&&!locked&&<span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P}}>+{d.xp} XP</span>}
                      {locked?<Icon n="lock" sz={13} col={C.mid}/>:<Icon n="chevron" sz={13} col={C.mid}/>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{height:8}}/>
        {/* Reset XP */}
        <div onClick={()=>{localStorage.removeItem(XPSystem.KEY);setXpData(XPSystem.fresh());}} style={{textAlign:'center',padding:'8px',cursor:'pointer'}}>
          <span style={{fontSize:12,color:C.mid,fontFamily:C.P,textDecoration:'underline'}}>Reset XP &amp; progress</span>
        </div>
        <div style={{height:16}}/>
      </div>
    </div>
  );
}

/* ── QUIZ SCREEN ── */
function QuizScreen({nav,back}){
  const config=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_quiz_config')||'null'); }
    catch(e){ return null; }
  },[]);

  const topic=React.useMemo(()=>QUIZ_TOPICS.find(t=>t.id===(config?.topicId))||QUIZ_TOPICS[0],[config]);
  const difficulty=config?.difficulty||'beginner';
  const allQs=React.useMemo(()=>{
    const qs=[...(topic.questions[difficulty]||[])];
    // Shuffle questions
    for(let i=qs.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [qs[i],qs[j]]=[qs[j],qs[i]]; }
    // Shuffle each question's options, keeping correct answer tracked
    return qs.slice(0,6).map(q=>{
      const correctText=q.opts[q.a];
      const shuffled=[...q.opts];
      for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
      return {...q, opts:shuffled, a:shuffled.indexOf(correctText)};
    });
  },[topic,difficulty]);

  const [qIdx,setQIdx]=React.useState(0);
  const [selected,setSelected]=React.useState(null); // null | index
  const [phase,setPhase]=React.useState('question'); // question | feedback | results
  const [score,setScore]=React.useState(0);
  const [streak,setStreak]=React.useState(0);
  const [xpGained,setXpGained]=React.useState(0);
  const [results,setResults]=React.useState([]); // [{correct,qText,selectedOpt,correctOpt,fact}]

  const DIFF_LABELS={beginner:'Beginner',intermediate:'Intermediate',expert:'Expert'};
  const DIFF_COLORS={beginner:'#1E7B4B',intermediate:'#B8963E',expert:'#8B1A2F'};
  const diffCol=DIFF_COLORS[difficulty]||C.cr;

  const q=allQs[qIdx];

  function choose(i){
    if(phase!=='question') return;
    setSelected(i);
    setPhase('feedback');
    const correct=i===q.a;
    const newStreak=correct?streak+1:0;
    setStreak(newStreak);

    const reasons=[];
    if(correct){
      setScore(s=>s+1);
      reasons.push({type:'quiz_correct',topic:topic.id,difficulty});
      if(newStreak===3) reasons.push({type:'quiz_streak',topic:topic.id,difficulty});
    } else {
      reasons.push({type:'quiz_wrong',topic:topic.id,difficulty});
    }
    const awards=XPSystem.award(reasons);
    const gained=awards.filter(a=>!a.levelUp).reduce((s,a)=>s+a.amount,0);
    setXpGained(xp=>xp+gained);
    XPSystem.toast(awards);

    const newResults=[...results,{
      correct,
      qText:q.q,
      selectedOpt:q.opts[i],
      correctOpt:q.opts[q.a],
      fact:q.fact
    }];
    setResults(newResults);

  }

  function advance(){
    if(phase!=='feedback') return;
    if(qIdx+1>=allQs.length){
      const finalScore=results.filter(r=>r.correct).length;
      const finalReasons=[{type:'quiz_complete',topic:topic.id,difficulty}];
      const a2=XPSystem.award(finalReasons);
      const g2=a2.filter(x=>!x.levelUp).reduce((s,a)=>s+a.amount,0);
      setXpGained(xp=>xp+g2);
      XPSystem.toast(a2);
      setPhase('results');
    } else {
      setQIdx(i=>i+1);
      setSelected(null);
      setPhase('question');
    }
  }

  // Results screen
  if(phase==='results'){
    const finalScore=results.filter(r=>r.correct).length;
    const pct=Math.round(finalScore/allQs.length*100);
    const msg=pct===100?'Perfect! 🏆':pct>=80?'Excellent! 🎉':pct>=60?'Good work! 👍':'Keep practising 📚';
    return(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{background:diffCol,padding:'48px 24px 32px',display:'flex',flexDirection:'column',alignItems:'center',gap:8,flexShrink:0}}>
          <div style={{fontSize:56,lineHeight:1}}>{pct===100?'🏆':pct>=80?'🎉':pct>=60?'👍':'📚'}</div>
          <div style={{fontSize:28,fontWeight:800,color:'#fff',fontFamily:C.P}}>{msg}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.8)',fontFamily:C.P}}>{topic.label} · {DIFF_LABELS[difficulty]}</div>
          <div style={{display:'flex',gap:16,marginTop:8}}>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>{finalScore}/{allQs.length}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Correct</div>
            </div>
            <div style={{width:1,background:'rgba(255,255,255,0.25)'}}/>
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:36,fontWeight:800,color:'#fff',fontFamily:C.P}}>+{xpGained}</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>XP earned</div>
            </div>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:14,fontWeight:600,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P}}>Review</div>
          {results.map((r,i)=>(
            <div key={i} style={{background:r.correct?C.greenBg:'#FFF0F0',borderRadius:12,padding:'10px 14px',border:`1px solid ${r.correct?C.green+'30':'#F5A0A0'}`}}>
              <div style={{display:'flex',gap:8,alignItems:'flex-start'}}>
                <span style={{fontSize:18,flexShrink:0}}>{r.correct?'✓':'✗'}</span>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,lineHeight:1.3}}>{r.qText}</div>
                  {!r.correct&&<div style={{fontSize:13,color:'#C0392B',fontFamily:C.P,marginTop:3}}>Your answer: {r.selectedOpt}</div>}
                  {!r.correct&&<div style={{fontSize:13,color:C.green,fontFamily:C.P}}>Correct: {r.correctOpt}</div>}
                  {r.fact&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:4,lineHeight:1.4,fontStyle:'italic'}}>💡 {r.fact}</div>}
                </div>
              </div>
            </div>
          ))}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <Btn full style={{flex:1}} onClick={()=>{ setQIdx(0);setSelected(null);setPhase('question');setScore(0);setStreak(0);setXpGained(0);setResults([]); }}>Retry</Btn>
            <Btn primary full style={{flex:1}} onClick={()=>nav('learn')}>All Topics</Btn>
          </div>
          <div style={{height:8}}/>
        </div>
      </div>
    );
  }

  if(!q) return null;

  const progress=(qIdx+1)/allQs.length;
  const optColors=selected===null
    ? allQs[qIdx]?.opts.map(()=>({bg:C.white,border:C.line,text:C.ink}))
    : allQs[qIdx]?.opts.map((_,i)=>{
        if(i===q.a) return {bg:C.greenBg,border:C.green,text:C.green};
        if(i===selected&&selected!==q.a) return {bg:'#FFF0F0',border:'#E88080',text:'#C0392B'};
        return {bg:C.white,border:C.line,text:C.ink};
      });

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Top bar */}
      <div style={{background:C.white,padding:'14px 20px 12px',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <div onClick={back} style={{width:32,height:32,borderRadius:16,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
            <Icon n="back" sz={14} col={C.ink}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{topic.label}</div>
            <div style={{fontSize:12,color:diffCol,fontFamily:C.P,fontWeight:600,textTransform:'capitalize'}}>{DIFF_LABELS[difficulty]}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:5}}>
            {streak>=2&&<span style={{fontSize:20}}>🔥</span>}
            <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{qIdx+1}/{allQs.length}</span>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{height:5,borderRadius:3,background:C.offWhite,overflow:'hidden'}}>
          <div style={{height:'100%',borderRadius:3,background:diffCol,width:`${Math.round(progress*100)}%`,transition:'width .4s ease'}}/>
        </div>
      </div>

      {/* Question */}
      <div onClick={phase==='feedback'?advance:undefined} style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14,cursor:phase==='feedback'?'pointer':'default'}}>
        <div style={{fontSize:21,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.4}}>{q.q}</div>

        {/* Options */}
        <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:4}}>
          {q.opts.map((opt,i)=>{
            const s=optColors[i]||{bg:C.white,border:C.line,text:C.ink};
            return(
              <div key={i} onClick={()=>choose(i)}
                style={{padding:'15px 16px',borderRadius:14,border:`2px solid ${s.border}`,background:s.bg,cursor:phase==='question'?'pointer':'default',transition:'all .2s',display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:28,height:28,borderRadius:14,background:s.border+'25',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{fontSize:14,fontWeight:700,color:s.text,fontFamily:C.P}}>
                    {phase==='feedback'&&i===q.a?'✓':phase==='feedback'&&i===selected&&selected!==q.a?'✗':String.fromCharCode(65+i)}
                  </span>
                </div>
                <span style={{fontSize:16,fontWeight:500,color:s.text,fontFamily:C.P,lineHeight:1.35}}>{opt}</span>
              </div>
            );
          })}
        </div>

        {/* Fact reveal + Next button */}
        {phase==='feedback'&&(
          <div style={{animation:'fadeIn .3s ease'}}>
            <div style={{background:selected===q.a?C.greenBg:'#FFF8F0',borderRadius:14,padding:'12px 14px',border:`1px solid ${selected===q.a?C.green+'40':'#F5C07040'}`,marginBottom:12}}>
              <div style={{fontSize:15,fontWeight:700,color:selected===q.a?C.green:'#B87000',fontFamily:C.P,marginBottom:4}}>
                {selected===q.a?'Correct! 🎉':'Not quite'}
              </div>
              {q.fact&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{q.fact}</div>}
            </div>
            <div onClick={advance} style={{background:C.cr,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 22px ${C.cr}45`,userSelect:'none',WebkitUserSelect:'none'}}>
              <span style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P}}>
                {qIdx+1>=allQs.length?'See Results →':'Next Question →'}
              </span>
            </div>
          </div>
        )}
        <div style={{height:12}}/>
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

Object.assign(window,{QuizHubScreen,QuizScreen});
