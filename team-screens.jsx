/* Screens for the restaurant staff-training app (team-app.jsx routes them; logic in team-data.js
   and team-learn.js; docs/business.md). Always on the dark stage. Staff see Today, Wines and Menu;
   a manager or buyer also sees Upload and Team. */

const _tState={ready:{label:'Ready',col:'#5FD48F'},slipping:{label:'Slipping',col:'#F2B84B'},not:{label:'Not ready yet',col:'#F28B7D'}};
const _tH=(T,t,sub)=><div style={{marginBottom:10}}><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{t}</div>{sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>;
const _tLabel=(T,t)=><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',margin:'16px 0 8px'}}>{t}</div>;
const _tTypeCol=(T,t)=>T.lift(_TYPE_COLORS[String(t||'red').toLowerCase().replace('é','e')]||C.cr);
/* A person's face in a circle (team/faces/, served beside the app), else their initials. */
function TeamFace({person,size=36,ring}){ const T=useTheme();
  const init=String(person&&person.name||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const st={width:size,height:size,borderRadius:size/2,flexShrink:0,boxShadow:ring?`0 0 0 2px ${ring}`:'none'};
  return person&&person.photo?<img src={person.photo} alt="" width={size} height={size} style={{...st,objectFit:'cover',display:'block'}}/>
    :<div aria-hidden="true" style={{...st,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38+'px',fontWeight:700,color:T.ink2,fontFamily:C.P}}>{init}</div>; }
function _tDays(ms){ const d=Math.round((ms-Date.now())/86400000); return d<0?`${-d} day${d===-1?'':'s'} overdue`:d===0?'due today':`due in ${d} day${d===1?'':'s'}`; }

/* A ring for a readiness figure. */
function TeamRing({pct,col,size=88}){ const T=useTheme(), r=size/2-7, c=2*Math.PI*r;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <circle cx={size/2} cy={size/2} r={r} stroke={T.line} strokeWidth="7" fill="none"/>
    <circle cx={size/2} cy={size/2} r={r} stroke={col} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={`${c*Math.min(1,pct/100)} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`} style={{filter:`drop-shadow(0 0 6px ${col}66)`}}/>
    <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fill={T.ink} style={{fontFamily:C.P,fontWeight:800,fontSize:size*0.24+'px'}}>{pct}%</text>
  </svg>; }

/* First run: the restaurant's name and who's setting it up. */
function TeamSetup({onDone}){ const T=useTheme(), cr=T.lift(C.cr);
  const [venue,setVenue]=React.useState(''), [name,setName]=React.useState('');
  const field={width:'100%',padding:'12px 14px',borderRadius:12,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none'};
  const go=sample=>{ if(!sample&&(!venue.trim()||!name.trim())) return;
    if(sample) TeamSample.load(sample); else { TeamData.setVenue({name:venue.trim()}); TeamLearn.addPerson(name.trim(),'manager'); }
    onDone(); };
  return <div style={{padding:'calc(env(safe-area-inset-top) + 28px) 20px 24px',maxWidth:520,margin:'0 auto'}}>
    <div style={{fontSize:13,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Vinterest for teams</div>
    {_tH(T,'Train your floor on your own wines.','Upload your wine list and menu. Every wine gets a staff card and pairings with your dishes, and everyone drills what their role sells until they know it, and keeps knowing it.')}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      <input aria-label="Restaurant name" placeholder="Restaurant name" value={venue} onChange={e=>setVenue(e.target.value)} style={field}/>
      <input aria-label="Your name" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={field}/>
      <Btn primary full onClick={()=>go(false)}>Set up my restaurant</Btn>
      <div style={{textAlign:'center',fontSize:14,color:T.mid,fontFamily:C.P,margin:'6px 0'}}>or</div>
      <Btn full onClick={()=>go('sample')}>Look around with a sample restaurant</Btn>
      <div data-testid="team-load-demo"><Btn full onClick={()=>go('demo')}>Open The Larkspur: 60 wines, 27 dishes, a team of seven</Btn></div>
    </div>
  </div>; }

/* Today: where this person stands, what's assigned, and the drill. */
function TeamToday({pid,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const person=TeamLearn.person(pid), r=TeamLearn.note(pid), as=TeamLearn.assignments(pid), ret=TeamLearn.retention(pid);
  if(!person||!r) return null;
  const st=_tState[r.state];
  const empty=!TeamData.wines().length;
  return <div>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}><TeamFace person={person} size={64} ring={st.col}/>
      <div><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>Hi {person.name.split(' ')[0]}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3}}>{TeamLearn.ROLES[person.role].label} at {TeamData.get().venue.name||'your restaurant'}</div></div></div>
    {empty?<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>No wine list yet. {TeamLearn.ROLES[person.role].label==='Manager'||person.role==='buyer'?'Upload it from the Upload tab and your training is written from it.':'Your manager uploads it, then your training appears here.'}</div></Card>:<>
    <Card style={{display:'flex',gap:14,alignItems:'center'}}>
      <TeamRing pct={r.pct} col={st.col}/>
      <div style={{flex:1,minWidth:0}}>
        <div data-testid="team-state" data-pct={r.pct} style={{fontSize:17,fontWeight:800,color:st.col,fontFamily:C.P}}>{st.label}</div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{r.state==='ready'?'You know what your role sells. Keep the daily drill going so it stays that way.':r.state==='slipping'?'Some answers have faded or new wines arrived. A few drills puts you back.':'Your minimum for working the floor, below.'}</div>
      </div>
    </Card>
    <Card style={{marginTop:10}}>
      {Object.entries(r.parts).map(([k,p])=><div key={k} style={{marginBottom:10}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontFamily:C.P,color:T.ink2}}><span>{TeamLearn.PART_LABEL[k]}</span><span>{p.known} of {p.total} · need {Math.round(p.need*100)}%</span></div>
        <div style={{position:'relative',marginTop:5}}><Prog val={p.share} col={p.share>=p.need?'#5FD48F':cr} h={6}/><div style={{position:'absolute',left:`${p.need*100}%`,top:-3,width:2,height:12,background:T.ink,opacity:0.6}}/></div>
      </div>)}
      {ret.asked>=3&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Surprise re-checks this month: {ret.right} of {ret.asked} remembered.</div>}
    </Card>
    <Btn primary full style={{marginTop:14}} onClick={()=>open({view:'drill'})}>{r.due||as.length?`Start today's drill`:'Practise'} · 5 questions</Btn>
    {as.length>0&&<>{_tLabel(T,`New to learn (${as.length})`)}
      <Card style={{padding:0}}>{as.slice(0,8).map((a,i)=>{ const x=a.kind==='wine'?TeamData.wine(a.id):TeamData.dish(a.id); if(!x) return null;
        return <div key={a.key} role="button" onClick={()=>open({view:a.kind,id:a.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
          <Icon n={a.kind==='wine'?'wine':'fork'} sz={16} col={a.kind==='wine'?_tTypeCol(T,x.type):T.mid}/>
          <div style={{flex:1,minWidth:0,fontSize:14,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.kind==='wine'?TeamData.short(x):x.name}</div>
          <span style={{fontSize:12,color:a.overdue?'#F28B7D':T.mid,fontFamily:C.P,flexShrink:0}}>{_tDays(a.due)}</span>
        </div>; })}</Card></>}
    </>}
  </div>; }

/* The drill: one question at a time, how sure they are, then what's right and why. */
function TeamDrill({pid,only,back}){ const T=useTheme(), cr=T.lift(C.cr);
  const [qs]=React.useState(()=>only?TeamLearn.wineQs(only).filter(q=>TeamLearn.ROLES[TeamLearn.person(pid).role].kinds.includes(q.k)):TeamLearn.drill(pid));
  // Where they stood as the drill began, so the summary can say what moved.
  const [before]=React.useState(()=>{ const r=TeamLearn.readiness(pid); const items={};
    qs.forEach(q=>{ const id=q.wine||q.dish; if(id&&!items[id]) items[id]=TeamLearn.progress(pid,id,{dish:!q.wine}); }); return {pct:r?r.pct:0,items}; });
  const [i,setI]=React.useState(0), [ans,setAns]=React.useState(null), [picks,setPicks]=React.useState([]), [sure,setSure]=React.useState('think');
  const [res,setRes]=React.useState(null), [busy,setBusy]=React.useState(false), [tally,setTally]=React.useState({right:0,of:0});
  const q=qs[i];
  if(!qs.length) return <div>{_tH(T,'Nothing to drill yet','Your training appears once the wine list has staff cards.')}<Btn full onClick={back}>Back</Btn></div>;
  if(!q){ const r=TeamLearn.note(pid), rise=r.pct-before.pct;
    const rows=Object.entries(before.items).map(([id,was])=>{ const dish=!qs.some(x=>x.wine===id), now=TeamLearn.progress(pid,id,{dish}), name=dish?(TeamData.dish(id)||{}).name:TeamData.short(TeamData.wine(id)||{}); return {id,name,was,now,dish}; });
    return <div data-testid="drill-done">{_tH(T,`${tally.right} of ${tally.of} right`,'Each answer now has its own review date: the ones you missed come back soonest.')}
      <Card>
        <div style={{display:'flex',gap:14,alignItems:'center'}}><TeamRing pct={r.pct} col={_tState[r.state].col} size={72}/>
          <div><div data-testid="drill-readiness" style={{fontSize:15,fontWeight:700,color:_tState[r.state].col,fontFamily:C.P}}>{_tState[r.state].label}</div>
            <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:2}}>Readiness {before.pct}% → {r.pct}%{rise>0?<span style={{color:'#5FD48F',fontWeight:700}}> ▲{rise}</span>:rise<0?<span style={{color:'#F28B7D',fontWeight:700}}> ▼{-rise}</span>:' · no change'}</div></div></div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:10,lineHeight:1.45}}>Every answer you hold counts a little; a wine counts in full for the minimum once every rung is right and still fresh.</div>
      </Card>
      {_tLabel(T,'In this drill')}<Card style={{padding:0}}>{rows.map((x,k)=><div key={x.id} data-testid="drill-item" style={{padding:'10px 14px',borderTop:k?`1px solid ${T.line}`:'none'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,fontSize:15,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:700}}>{x.name}</span><span style={{color:x.now.known>x.was.known?'#5FD48F':T.ink2,whiteSpace:'nowrap'}}>{x.now.known} of {x.now.total}{x.now.known>x.was.known?` ▲${x.now.known-x.was.known}`:x.now.known<x.was.known?` ▼${x.was.known-x.now.known}`:''}</span></div>
        {x.now.rungs.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>{x.now.rungs.map(rg=><span key={rg.k} style={{fontSize:12,fontFamily:C.P,padding:'3px 8px',borderRadius:8,border:`1px solid ${rg.done?'#5FD48F':T.line}`,color:rg.done?'#5FD48F':T.mid}}>{rg.done?'✓ ':''}{rg.label}</span>)}</div>}
      </div>)}</Card>
      <Btn primary full style={{marginTop:14}} onClick={back}>Done</Btn></div>; }
  const w=q.wine?TeamData.wine(q.wine):null, multi=q.k!=='recognise', ch=multi?TeamLearn.choices(q):null;
  // The wine is named over the question only when the question itself names it: "what would you offer from the list" must not say.
  const names=w&&new RegExp(TeamData.short(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(q.q);
  const submit=async()=>{ if(busy) return; if(multi?!picks.length:ans===null) return;
    setBusy(true); const g=multi?TeamLearn.gradeChoices(q,picks):await TeamLearn.grade(q,ans); setBusy(false);
    if(!g.offline) TeamLearn.record(pid,q,g.ok,sure);
    setRes(g); setTally(t=>({right:t.right+(g.ok?1:0),of:t.of+1})); };
  const next=()=>{ setI(i+1); setAns(null); setPicks([]); setRes(null); setSure('think'); };
  const kindLabel=TeamLearn.KIND_LABEL[q.k];
  const opt=(label,k,{picked,right,wrong,onClick})=><div key={k} role="button" aria-pressed={picked} data-testid="drill-opt" onClick={onClick} style={{padding:'12px 14px',borderRadius:12,border:`1.5px solid ${right?'#5FD48F':wrong?'#F28B7D':picked?cr:T.line}`,background:picked?T.soft:'transparent',color:T.ink,fontSize:15,fontFamily:C.P,cursor:res?'default':'pointer',lineHeight:1.35}}>{label}</div>;
  return <div data-testid="team-drill">
    <div style={{display:'flex',gap:4,marginBottom:14}}>{qs.map((_,k)=><div key={k} style={{flex:1,height:4,borderRadius:2,background:k<i?cr:k===i?T.ink:T.line}}/>)}</div>
    <div style={{fontSize:12,fontWeight:700,color:w?_tTypeCol(T,w.type):T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{kindLabel}{w&&names?` · ${TeamData.short(w)}`:w?` · ${w.section||w.type}`:''}</div>
    <div data-testid="drill-q" style={{fontSize:19,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.35,margin:'6px 0 14px'}}>{q.q}</div>
    {!multi&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{q.opts.map((o,k)=>opt(o,k,{picked:ans===k,right:res&&k===q.a,wrong:res&&ans===k&&k!==q.a,onClick:()=>!res&&setAns(k)}))}</div>}
    {multi&&<>
      <div data-testid="drill-choose" style={{fontSize:13,color:T.mid,fontFamily:C.P,marginBottom:8}}>Choose {ch.n}{picks.length?` · ${picks.length} picked`:''}</div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>{ch.opts.map((o,k)=>{ const picked=picks.includes(k), isRight=ch.right.includes(k);
        return opt(o,k,{picked,right:res&&isRight,wrong:res&&picked&&!isRight,onClick:()=>{ if(res) return; setPicks(p=>picked?p.filter(x=>x!==k):p.length<ch.n?[...p,k]:p); }}); })}</div>
    </>}
    {!res&&<>
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,margin:'14px 0 6px'}}>How sure are you?</div>
      <div style={{display:'flex',gap:6}}>{[['sure','Sure'],['think','Think so'],['guess','Guessing']].map(([k,l])=><div key={k} role="button" onClick={()=>setSure(k)} style={{flex:1,textAlign:'center',padding:'8px 0',borderRadius:10,border:`1px solid ${sure===k?cr:T.line}`,background:sure===k?T.soft:'transparent',color:sure===k?T.ink:T.mid,fontSize:14,fontFamily:C.P,cursor:'pointer'}}>{l}</div>)}</div>
      <Btn primary full style={{marginTop:14,opacity:(multi?picks.length:ans!==null)?1:0.45}} onClick={submit}>{busy?'Marking…':'Check'}</Btn>
    </>}
    {res&&<div data-testid="drill-result" style={{marginTop:14}}>
      <Card>
        <div style={{fontSize:17,fontWeight:800,fontFamily:C.P,color:res.ok?'#5FD48F':res.verdict==='partly'?'#F2B84B':res.offline?T.mid:'#F28B7D'}}>{res.ok?'Right':res.verdict==='partly'?'Partly':res.offline?'Not marked':'Not quite'}{q.check?' · surprise re-check':''}</div>
        {!res.ok&&!multi&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4}}>The answer: <b>{q.opts[q.a]}</b></div>}
        {!res.ok&&multi&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4}}>{ch.n===1?'The answer is':'The right ones are'} in green above.</div>}
        {res.say&&<div style={{fontSize:15,color:T.ink,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>{res.say}</div>}
        {q.why&&<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>{q.why}</div>}
      </Card>
      <Btn primary full style={{marginTop:12}} onClick={next}>{i+1<qs.length?'Next':'Finish'}</Btn>
    </div>}
  </div>; }

/* The list, by its own sections, with what this person knows. */
function TeamWines({pid,open}){ const T=useTheme();
  const ws=TeamData.wines(), person=TeamLearn.person(pid), items=(TeamLearn._all()[pid]||{}).items||{};
  if(!ws.length) return <div>{_tH(T,'Wine list','Nothing uploaded yet.')}</div>;
  const secs=[]; ws.forEach(w=>{ const s=w.section||'The list'; let g=secs.find(x=>x.s===s); if(!g) secs.push(g={s,ws:[]}); g.ws.push(w); });
  return <div>{_tH(T,'Wine list',`${ws.length} wines · ${ws.filter(TeamData.byGlass).length} by the glass`)}
    {secs.map(g=><div key={g.s}>{_tLabel(T,g.s)}<Card style={{padding:0}}>{g.ws.map((w,i)=>{ const k=person&&TeamLearn.knowsWine(pid,person.role,w.id,items);
      return <div key={w.id} role="button" data-testid="team-wine-row" onClick={()=>open({view:'wine',id:w.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{width:8,height:8,borderRadius:4,background:_tTypeCol(T,w.type),flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{TeamData.short(w)}</div>
          <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{[w.vintage||'NV',w.region,w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ')}</div>
          {(()=>{ const dw=TeamData.window(w); return dw&&<div style={{fontSize:12,fontWeight:600,color:dw.stage==='ready'?'#5FD48F':dw.stage==='young'?'#7FB3F0':'#F2B84B',fontFamily:C.P,marginTop:2}}>{dw.word}{dw.source==='claude'?` · ${dw.line}`:''}</div>; })()}</div>
        {k&&<Icon n="check" sz={16} col="#5FD48F"/>}<Icon n="chevron" sz={12} col={T.mid}/>
      </div>; })}</Card></div>)}
  </div>; }

/* A wine's staff card. */
function TeamWine({id,pid,open}){ const T=useTheme(), w=TeamData.wine(id), c=TeamData.card(id);
  // No card yet: nothing on this screen writes one by itself. A manager writes this one here; anyone
  // else is told who does. A failed write says so, never a wait that doesn't end.
  const me=TeamLearn.person?TeamLearn.person(pid):null, manager=me&&['manager','buyer'].includes(me.role);
  const [busy,setBusy]=React.useState(false), [err,setErr]=React.useState(''), [,bump]=React.useReducer(x=>x+1,0);
  const writeIt=async()=>{ setBusy(true); setErr(''); try{ await TeamData.writeCards([id]); if(w.vintage&&!w.peak) await TeamData.writeWindows([id]); }catch(x){ setErr(x.message||'Stopped.'); } setBusy(false); bump(); };
  if(!w) return null; const col=_tTypeCol(T,w.type);
  const bar=(k,label,v,how)=>v==null?null:<div key={k} style={{marginBottom:9}}><div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontFamily:C.P,color:T.ink2}}><span>{label}</span><span>{v}/5</span></div><Prog val={v/5} col={col} h={5} style={{marginTop:4}}/>{how&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:3}}>{how}</div>}</div>;
  return <div data-testid="team-wine">
    <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{w.section||w.type}</div>
    {_tH(T,TeamData.short(w),[w.vintage||'NV',w.region,w.country].filter(Boolean).join(' · '))}
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{w.glass&&<Pill sm>Glass {w.glass}</Pill>}{w.bottle&&<Pill sm>Bottle {w.bottle}</Pill>}{w.other&&<Pill sm>{w.other}</Pill>}{(w.grapes||[]).map(g=><Pill sm key={g}>{g}</Pill>)}</div>
    {!c?<div data-testid="team-no-card"><Card>{busy?<WritingWait compact title="Writing this wine's staff card…" wine={{name:w.name,grapes:w.grapes,region:w.region}}/>:<>
        <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>No staff card yet</div>
        <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.5}}>{manager?'Write it here, or write every missing card from the Upload tab.':'Your manager writes the staff cards from the Upload tab.'}</div>
        {err&&<div data-testid="team-card-error" style={{fontSize:14,color:'#F2B84B',fontFamily:C.P,marginTop:6}}>{err}</div>}
        {manager&&<div style={{marginTop:10}}><Btn small primary onClick={writeIt}>{err?'Try again':'Write it now'}</Btn></div>}</>}</Card></div>:<>
      <Card style={{borderColor:col+'66'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Say it to a guest</div><div data-testid="team-pitch" style={{fontSize:17,color:T.ink,fontFamily:C.P,lineHeight:1.5,marginTop:6}}>{c.pitch}</div></Card>
      {_tLabel(T,'What it tastes like')}<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:10}}>{c.taste}</div>
        {c.style&&<>{bar('b','Body',c.style.body,Palate.HOW.body)}{bar('a','Acidity',c.style.acid,Palate.HOW.acidity)}{w.type==='red'||c.style.tannin?bar('t','Tannin',c.style.tannin,Palate.HOW.tannins):null}{bar('s','Sweetness',c.style.sweet)}</>}</Card>
      {_tLabel(T,'Grape and place')}<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{c.grape} {c.place}{c.producer?' '+c.producer:''}</div></Card>
      {(()=>{ const dw=TeamData.window(w); return dw&&<div data-testid="team-window">{_tLabel(T,'Where it is in its life')}<Card>
        <div style={{fontSize:16,fontWeight:700,fontFamily:C.P,color:dw.stage==='ready'?'#5FD48F':dw.stage==='young'?'#7FB3F0':'#F2B84B'}}>{dw.word}</div>
        <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:3}}>{dw.line}{w.peak&&w.peak.rating?` · ${w.peak.rating} vintage`:''}</div>
        {w.peak&&w.peak.note&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.5}}>{w.peak.note}</div>}
        {(()=>{ const v=w.vintage, span=Math.max(2,(dw.until-v)*1.3), yr=new Date().getFullYear(), at=x=>Math.max(0.02,Math.min(0.98,(x-v)/span))*100;
          return <div style={{position:'relative',height:10,marginTop:12,borderRadius:5,background:T.line}}>
            <div style={{position:'absolute',left:at(dw.from)+'%',width:(at(dw.to)-at(dw.from))+'%',top:0,bottom:0,borderRadius:5,background:'#5FD48F66'}}/>
            <div style={{position:'absolute',left:at(yr)+'%',top:-3,width:3,height:16,marginLeft:-1,borderRadius:2,background:T.ink}}/>
            <div style={{position:'absolute',left:0,top:14,fontSize:11,color:T.mid,fontFamily:C.P}}>{v}</div><div style={{position:'absolute',right:0,top:14,fontSize:11,color:T.mid,fontFamily:C.P}}>{dw.until+2}</div>
          </div>; })()}
        <div style={{height:14}}/>
      </Card></div>; })()}
      {c.serve&&<>{_tLabel(T,'Serving')}<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{[c.serve.temp,c.serve.glass,c.serve.decant&&c.serve.decant!=='no'?`decant ${c.serve.decant}`:'no need to decant'].filter(Boolean).join(' · ')}</div></Card></>}
      {c.dishes&&c.dishes.length>0&&<>{_tLabel(T,'With our menu')}<Card style={{padding:0}}>{c.dishes.map((x,i)=><div key={i} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none'}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{x.dish}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>{x.why}</div></div>)}</Card></>}
      {c.alts&&c.alts.length>0&&<>{_tLabel(T,'Offer instead')}<Card style={{padding:0}}>{c.alts.map((a,i)=>{ const o=TeamData.wine(a.id); return o&&<div key={i} role="button" onClick={()=>open({view:'wine',id:a.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{TeamData.short(o)}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{a.when}</div></div>; })}</Card></>}
      <Btn primary full style={{marginTop:16}} onClick={()=>open({view:'drill',only:id})}>Practise this wine</Btn>
    </>}
  </div>; }

/* The menu, each dish with its wines. */
function TeamMenu({open}){ const T=useTheme(), xs=TeamData.dishes();
  if(!xs.length) return <div>{_tH(T,'Menu','Nothing uploaded yet.')}</div>;
  const secs=[]; xs.forEach(x=>{ const s=x.section||'Menu'; let g=secs.find(y=>y.s===s); if(!g) secs.push(g={s,xs:[]}); g.xs.push(x); });
  return <div>{_tH(T,'Menu',`${xs.length} dishes, each with the wines that suit it`)}
    {secs.map(g=><div key={g.s}>{_tLabel(T,g.s)}<Card style={{padding:0}}>{g.xs.map((x,i)=>{ const p=TeamData.pairing(x.id), b=p&&p.best[0]&&TeamData.wine(p.best[0].id);
      return <div key={x.id} role="button" data-testid="team-dish-row" onClick={()=>open({view:'dish',id:x.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{x.name}</div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{b?`Best with ${TeamData.short(b)}`:'Pairings not written yet'}</div>
      </div>; })}</Card></div>)}
  </div>; }
function TeamDish({id,open}){ const T=useTheme(), x=TeamData.dish(id), p=TeamData.pairing(id);
  if(!x) return null;
  const row=(b,i,label)=>{ const w=b&&TeamData.wine(b.id); return w&&<div key={label+i} role="button" onClick={()=>open({view:'wine',id:w.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
    <div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{TeamData.short(w)} <span style={{fontWeight:400,color:T.mid,fontSize:13}}>{[w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ')}</span></div>
    <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>{b.why}</div></div>; };
  return <div data-testid="team-dish">{_tH(T,x.name,x.desc)}
    {!p?<Card><div style={{fontSize:15,color:T.mid,fontFamily:C.P}}>Pairings are written once the wine list is uploaded.</div></Card>:<>
      {_tLabel(T,'Best with')}<Card style={{padding:0}}>{p.best.map((b,i)=>row(b,i,'b'))}</Card>
      {p.glass&&<>{_tLabel(T,'By the glass')}<Card style={{padding:0}}>{row(p.glass,0,'g')}</Card></>}
      {p.avoid&&<>{_tLabel(T,'Steer them away from')}<Card style={{padding:0}}>{row(p.avoid,0,'a')}</Card></>}
    </>}
  </div>; }

/* Reads a photo (resized as the consumer app's list scan does, 1600px) or a PDF as base64. */
function _tReadFile(file){ return new Promise((res,rej)=>{ const fr=new FileReader();
  if(/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)){ fr.onload=()=>res({kind:'pdf',data:String(fr.result).split(',')[1]}); fr.onerror=rej; fr.readAsDataURL(file); return; }
  fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const max=1600, k=Math.min(1,max/Math.max(img.width,img.height)), cv=document.createElement('canvas');
    cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k); cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    res({kind:'image',data:cv.toDataURL('image/jpeg',0.85).split(',')[1]}); }; img.onerror=rej; img.src=fr.result; };
  fr.onerror=rej; fr.readAsDataURL(file); }); }

/* Upload a list or menu, review what changed, publish, and watch the training get written. */
function TeamUpload({onChanged}){ const T=useTheme(), cr=T.lift(C.cr);
  const [stage,setStage]=React.useState(()=>TeamData.get().draft?'review':'idle'), [kind,setKind]=React.useState(()=>(TeamData.get().draft||{}).kind||'list');
  const [prog,setProg]=React.useState(null), [err,setErr]=React.useState(''), [diff,setDiff]=React.useState(()=>TeamData.diff());
  const fileRef=React.useRef(null), labelRef=React.useRef(null), pend=TeamData.pending();
  const [found,setFound]=React.useState(null); // a bottle read from its label, before it joins the draft
  const onLabel=async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
    setStage('reading'); setErr(''); setProg({label:'Reading the label',a:0,b:1});
    try{ const {data}=await _tReadFile(f); const w=await TeamData.readLabel(data); if(!w) throw new Error('No wine label found in that photo. Try again with the label filling the frame.');
      setFound({...w,section:TeamData._sectionFor(w.type)}); setStage('found'); }
    catch(x){ setErr(x.message||'We couldn\'t read that label.'); setStage('idle'); } };
  const addFound=()=>{ setDiff(TeamData.draftAdd(found)); setFound(null); setStage('review'); };
  const pick=k=>{ setKind(k); setErr(''); fileRef.current&&fileRef.current.click(); };
  const appendRef=React.useRef(false);
  const onFiles=async e=>{ const fs=[...(e.target.files||[])]; e.target.value=''; if(!fs.length) return;
    const append=appendRef.current; appendRef.current=false;
    setStage('reading'); setErr('');
    try{ const files=await Promise.all(fs.map(_tReadFile)); const d=await TeamData.read(kind,files,(a,b)=>setProg({label:`Reading your ${kind==='list'?'wine list':'menu'}`,a,b}),{append});
      setDiff(d); setStage('review'); }
    catch(x){ setErr(x.message||'We couldn\'t read that. Try a sharper photo or the PDF.'); setStage('idle'); } };
  const publish=async()=>{ const res=TeamData.publish(); setStage('writing'); setErr('');
    try{ await TeamData.refresh(res,(label,a,b)=>setProg({label,a,b})); setStage('done'); }
    catch(x){ setErr((x.message||'Writing the training stopped.')+' What was written is kept; carry on below.'); setStage('idle'); }
    onChanged&&onChanged(); };
  const resume=async()=>{ setStage('writing'); setErr('');
    try{ await TeamData.refresh({kind:'list',added:[],removed:[],changed:[]},(label,a,b)=>setProg({label,a,b})); setStage('done'); }catch(x){ setErr(x.message||'Stopped again.'); setStage('idle'); } onChanged&&onChanged(); };
  const secs=[...new Set(TeamData.wines().map(w=>w.section).filter(Boolean))];
  const fld={padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none',minWidth:0};
  const sec=(t,items,render)=>items.length>0&&<>{_tLabel(T,`${t} (${items.length})`)}<Card style={{padding:0}}>{items.slice(0,40).map((x,i)=><div key={i} style={{padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none',fontSize:14,color:T.ink2,fontFamily:C.P}}>{render(x)}</div>)}{items.length>40&&<div style={{padding:'10px 14px',fontSize:13,color:T.mid,fontFamily:C.P}}>and {items.length-40} more</div>}</Card></>;
  const wl=w=>`${TeamData.label(w)}${w.glass?` · glass ${w.glass}`:''}${w.bottle?` · bottle ${w.bottle}`:''}`;
  return <div data-testid="team-upload">
    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={onFiles} data-testid="team-file" style={{display:'none'}}/>
    {(stage==='idle'||stage==='done')&&<>
      {_tH(T,'Upload','A photo or PDF of your wine list or menu. Several photos for a long list. Nothing reaches your staff until you approve what changed.')}
      {stage==='done'&&<Card style={{marginBottom:12,borderColor:'#5FD48F66'}}><div data-testid="team-published" style={{fontSize:15,color:'#5FD48F',fontWeight:700,fontFamily:C.P}}>Published. Your staff's training is up to date.</div></Card>}
      {err&&<Card style={{marginBottom:12,borderColor:'#F28B7D66'}}><div style={{fontSize:14,color:'#F28B7D',fontFamily:C.P}}>{err}</div></Card>}
      {(pend.cards>0||pend.pairings>0||pend.windows>0)&&<Card style={{marginBottom:12}}><div data-testid="team-pending" style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginBottom:8}}>{[pend.cards&&`${pend.cards} wine${pend.cards===1?'':'s'} without a staff card`,pend.pairings&&`${pend.pairings} dish${pend.pairings===1?'':'es'} without pairings`,pend.windows&&`${pend.windows} drinking window${pend.windows===1?'':'s'} to check`].filter(Boolean).join(', ')}.</div><Btn small onClick={resume}>Write them now</Btn></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Card onClick={()=>pick('list')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="wine" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Wine list</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamData.wines().length?`${TeamData.wines().length} wines live. Upload the new one to update it.`:'Your full list, by the glass and by the bottle.'}</div></div></Card>
        <Card onClick={()=>pick('menu')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="fork" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Menu</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamData.dishes().length?`${TeamData.dishes().length} dishes live.`:'So every wine is paired with your dishes.'}</div></div></Card>
        {TeamData.wines().length>0&&<Card onClick={()=>labelRef.current&&labelRef.current.click()} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="camera" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Add a wine from its label</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>A new arrival: photograph the bottle and it joins the list, with its card, pairings and drinking window.</div></div></Card>}
        <input ref={labelRef} type="file" accept="image/*" capture="environment" onChange={onLabel} data-testid="team-label-file" style={{display:'none'}}/>
      </div>
      {TeamData.wines().length>0&&<div role="button" data-testid="team-export" onClick={()=>TeamData.exportFile()} style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:18,cursor:'pointer',textDecoration:'underline'}}>Export this restaurant's list, menu and training as a file</div>}
      </>}
    {stage==='found'&&found&&<div data-testid="team-found">
      {_tH(T,'New arrival',`Read from the label${found.confidence!=='high'?', check it':''}. Set where it sits on the list and its prices, then add it.`)}
      <Card><div style={{display:'flex',flexDirection:'column',gap:8}}>
        <div style={{display:'flex',gap:8}}><input aria-label="Producer" value={found.producer} onChange={e=>setFound({...found,producer:e.target.value})} placeholder="Producer" style={{...fld,flex:1}}/><input aria-label="Vintage" value={found.vintage||''} onChange={e=>setFound({...found,vintage:/^\d{4}$/.test(e.target.value)?+e.target.value:null})} placeholder="Year" style={{...fld,width:90}}/></div>
        <input aria-label="Wine" value={found.name} onChange={e=>setFound({...found,name:e.target.value})} placeholder="Wine" style={fld}/>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{[found.type,found.region,found.country,(found.grapes||[]).join(', ')].filter(Boolean).join(' · ')}</div>
        <select aria-label="Section" value={found.section} onChange={e=>setFound({...found,section:e.target.value})} style={{...fld,background:T.card,colorScheme:'dark'}}>{secs.map(x=><option key={x} value={x}>{x}</option>)}</select>
        <div style={{display:'flex',gap:8}}><input aria-label="Glass price" value={found.glass} onChange={e=>setFound({...found,glass:e.target.value})} placeholder="Glass price (or blank)" style={{...fld,flex:1}}/><input aria-label="Bottle price" value={found.bottle} onChange={e=>setFound({...found,bottle:e.target.value})} placeholder="Bottle price" style={{...fld,flex:1}}/></div>
      </div></Card>
      <div style={{display:'flex',gap:8,marginTop:14}}><Btn style={{flex:1}} onClick={()=>{ setFound(null); setStage('idle'); }}>Cancel</Btn><Btn primary style={{flex:2}} onClick={addFound}>Add to the list</Btn></div>
    </div>}
    {(stage==='reading'||stage==='writing')&&<Card style={{marginTop:20}}><WritingWait title={prog?`${prog.label}… ${prog.a} of ${prog.b}`:'Starting…'} sub={stage==='reading'?'Checking every line':'Staff cards, questions and pairings'} wine={null}/></Card>}
    {stage==='review'&&diff&&<div data-testid="team-review">
      {_tH(T,`Check the new ${diff.kind==='list'?'wine list':'menu'}`,`${diff.added.length} new, ${diff.removed.length} gone, ${diff.changed.length} changed, ${diff.same} the same. Publishing writes training for what's new and assigns it to your staff.`)}
      {diff.removed.length>diff.same+diff.changed.length&&<Card style={{marginBottom:4,borderColor:'#F2B84B66'}}><div data-testid="team-most-gone" style={{fontSize:14,color:'#F2B84B',fontFamily:C.P,lineHeight:1.5}}>Most of what's live would go. If you only photographed part of the {diff.kind==='list'?'list':'menu'}, add the other pages before publishing.</div></Card>}
      <div role="button" data-testid="team-add-pages" onClick={()=>{ appendRef.current=true; fileRef.current&&fileRef.current.click(); }} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer',margin:'4px 0'}}>+ Add more pages</div>
      {sec('New',diff.added,x=>diff.kind==='list'?wl(x):x.name)}
      {sec('Changed',diff.changed,x=>`${diff.kind==='list'?TeamData.short(x.item):x.item.name}: ${x.what.join(', ')}`)}
      {sec('Gone',diff.removed,x=>diff.kind==='list'?TeamData.short(x):x.name)}
      <div style={{display:'flex',gap:8,marginTop:16}}><Btn style={{flex:1}} onClick={()=>{ TeamData.dropDraft(); setStage('idle'); }}>Discard</Btn><Btn primary style={{flex:2}} onClick={publish}>Publish</Btn></div>
    </div>}
  </div>; }

/* The manager's view: who's ready, which wines the floor knows badly, the minimums. */
function TeamPeople({open,onChanged}){ const T=useTheme(), cr=T.lift(C.cr);
  const [name,setName]=React.useState(''), [role,setRole]=React.useState('server'), [,bump]=React.useState(0);
  const ppl=TeamLearn.people(), weak=TeamLearn.weakWines().filter(x=>x.of>0).slice(0,8), ret=TeamLearn.retention(null);
  const [photo,setPhoto]=React.useState(null), photoRef=React.useRef(null);
  const onPhoto=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ const img=new Image(); img.onload=()=>{
    const side=Math.min(img.width,img.height), top=Math.max(0,Math.round(img.height*0.42-side/2)), cv=document.createElement('canvas'); cv.width=cv.height=256; const c=cv.getContext('2d');
    c.beginPath(); c.arc(128,128,128,0,Math.PI*2); c.clip(); c.drawImage(img,0,top,side,side,0,0,256,256); setPhoto(cv.toDataURL('image/png')); }; img.src=fr.result; }; fr.readAsDataURL(f); };
  const add=()=>{ if(!name.trim()) return; TeamLearn.addPerson(name.trim(),role,photo); setName(''); setPhoto(null); bump(x=>x+1); onChanged&&onChanged(); };
  const counts={ready:0,slipping:0,not:0}; ppl.forEach(p=>{ const r=TeamLearn.readiness(p.id); if(r) counts[r.state]++; });
  return <div data-testid="team-people">{_tH(T,'Your team',`${counts.ready} ready, ${counts.slipping} slipping, ${counts.not} not ready yet`)}
    <Card style={{padding:0}}>{ppl.map((p,i)=>{ const r=TeamLearn.readiness(p.id), st=_tState[r.state];
      return <div key={p.id} role="button" data-testid="team-person" onClick={()=>{ TeamLearn.setMe(p.id); onChanged&&onChanged(); open({tab:'today'}); }} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <TeamFace person={p} size={44} ring={st.col}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{p.name}</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamLearn.ROLES[p.role].label}{r.overdue?` · ${r.overdue} overdue`:''}</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:15,fontWeight:800,color:st.col,fontFamily:C.P}}>{r.pct}%</div><div style={{fontSize:12,color:st.col,fontFamily:C.P}}>{st.label}</div></div>
      </div>; })}</Card>
    {_tLabel(T,'Add someone')}
    <Card><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} style={{display:'none'}}/>
      <div role="button" aria-label="Photo" onClick={()=>photoRef.current&&photoRef.current.click()} style={{cursor:'pointer'}}><TeamFace person={{name:name||'+',photo}} size={44}/></div>
      <input aria-label="Name" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={{flex:'1 1 140px',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none'}}/>
      <select aria-label="Role" value={role} onChange={e=>setRole(e.target.value)} style={{padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.card,color:T.ink,fontFamily:C.P,fontSize:16,colorScheme:'dark'}}>{Object.entries(TeamLearn.ROLES).map(([k,r])=><option key={k} value={k}>{r.label}</option>)}</select>
      <Btn primary small onClick={add}>Add</Btn></div>
      <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:8}}>In the pilot everyone trains on this device: tap a name above to train as them.</div></Card>
    {weak.length>0&&<>{_tLabel(T,'Wines the floor knows least')}<Card style={{padding:0}}>{weak.map((x,i)=><div key={x.wine.id} role="button" onClick={()=>open({view:'wine',id:x.wine.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
      <div style={{flex:1,minWidth:0,fontSize:14,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{TeamData.short(x.wine)}</div><div style={{fontSize:13,color:x.share<0.5?'#F28B7D':T.mid,fontFamily:C.P}}>{x.knows} of {x.of} know it</div></div>)}</Card></>}
    {ret.asked>0&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:10}}>Surprise re-checks this month: {Math.round(100*ret.rate)}% remembered ({ret.right} of {ret.asked}).</div>}
    {_tLabel(T,'Minimum to work the floor')}
    <Card>{['server','bartender','sommelier'].map(rk=>{ const n=TeamLearn.need(rk); return <div key={rk} style={{marginBottom:10}}>
      <div style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{TeamLearn.ROLES[rk].label}</div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>{Object.keys(TeamLearn.PART_LABEL).filter(k=>TeamLearn.ROLES[rk].need[k]>0).map(k=><div key={k} role="button" onClick={()=>{ const v=n[k]>=0.95?0.5:Math.round((n[k]+0.1)*10)/10; TeamLearn.setNeed(rk,k,v); bump(x=>x+1); }} style={{padding:'5px 10px',borderRadius:10,border:`1px solid ${T.line}`,fontSize:13,color:T.ink2,fontFamily:C.P,cursor:'pointer'}}>{TeamLearn.PART_LABEL[k]} {Math.round(n[k]*100)}%</div>)}</div>
    </div>; })}<div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Tap a figure to raise it (it wraps back to 50%).</div></Card>
  </div>; }

Object.assign(window,{TeamFace,TeamRing,TeamSetup,TeamToday,TeamDrill,TeamWines,TeamWine,TeamMenu,TeamDish,TeamUpload,TeamPeople});
