/* Screens for the restaurant staff-training app (team-app.jsx routes them; logic in team-data.js
   and team-learn.js; docs/business.md). Always on the dark stage. Staff see Today, Wines and Menu;
   a manager or buyer also sees Upload and Team. */

const _tState={ready:{label:'Ready',col:'#5FD48F'},slipping:{label:'Slipping',col:'#F2B84B'},not:{label:'Not ready yet',col:'#F28B7D'}};
const _tH=(T,t,sub)=><div style={{marginBottom:10}}><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{t}</div>{sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>;
const _tLabel=(T,t)=><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',margin:'16px 0 8px'}}>{t}</div>;
const _tTypeCol=(T,t)=>T.lift(_TYPE_COLORS[String(t||'red').toLowerCase().replace('é','e')]||C.cr);
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
    if(sample) TeamSample.load(); else TeamData.setVenue({name:venue.trim()});
    if(!sample) TeamLearn.addPerson(name.trim(),'manager');
    onDone(); };
  return <div style={{padding:'calc(env(safe-area-inset-top) + 28px) 20px 24px',maxWidth:520,margin:'0 auto'}}>
    <div style={{fontSize:13,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Vinterest for teams</div>
    {_tH(T,'Train your floor on your own wines.','Upload your wine list and menu. Every wine gets a staff card and pairings with your dishes, and everyone drills what their role sells until they know it, and keeps knowing it.')}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      <input aria-label="Restaurant name" placeholder="Restaurant name" value={venue} onChange={e=>setVenue(e.target.value)} style={field}/>
      <input aria-label="Your name" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={field}/>
      <Btn primary full onClick={()=>go(false)}>Set up my restaurant</Btn>
      <div style={{textAlign:'center',fontSize:14,color:T.mid,fontFamily:C.P,margin:'6px 0'}}>or</div>
      <Btn full onClick={()=>go(true)}>Look around with a sample restaurant</Btn>
    </div>
  </div>; }

/* Today: where this person stands, what's assigned, and the drill. */
function TeamToday({pid,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const person=TeamLearn.person(pid), r=TeamLearn.note(pid), as=TeamLearn.assignments(pid), ret=TeamLearn.retention(pid);
  if(!person||!r) return null;
  const st=_tState[r.state];
  const empty=!TeamData.wines().length;
  return <div>
    {_tH(T,`Hi ${person.name.split(' ')[0]}`,`${TeamLearn.ROLES[person.role].label} at ${TeamData.get().venue.name||'your restaurant'}`)}
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
  const [i,setI]=React.useState(0), [ans,setAns]=React.useState(null), [text,setText]=React.useState(''), [sure,setSure]=React.useState('think');
  const [res,setRes]=React.useState(null), [busy,setBusy]=React.useState(false), [tally,setTally]=React.useState({right:0,of:0});
  const q=qs[i];
  if(!qs.length) return <div>{_tH(T,'Nothing to drill yet','Your training appears once the wine list has staff cards.')}<Btn full onClick={back}>Back</Btn></div>;
  if(!q){ const r=TeamLearn.note(pid);
    return <div data-testid="drill-done">{_tH(T,`${tally.right} of ${tally.of} right`,'Each answer now has its own review date: the ones you missed come back soonest.')}
      <Card style={{display:'flex',gap:14,alignItems:'center'}}><TeamRing pct={r.pct} col={_tState[r.state].col} size={72}/><div style={{fontSize:15,fontWeight:700,color:_tState[r.state].col,fontFamily:C.P}}>{_tState[r.state].label}</div></Card>
      <Btn primary full style={{marginTop:14}} onClick={back}>Done</Btn></div>; }
  const w=q.wine?TeamData.wine(q.wine):null, typed=q.k!=='recognise';
  const submit=async()=>{ if(busy) return; const a=typed?text:ans; if(a===null||(typed&&!String(a).trim())) return;
    setBusy(true); const g=await TeamLearn.grade(q,a); setBusy(false);
    if(!g.offline) TeamLearn.record(pid,q,g.ok,sure);
    setRes(g); setTally(t=>({right:t.right+(g.ok?1:0),of:t.of+1})); };
  const next=()=>{ setI(i+1); setAns(null); setText(''); setRes(null); setSure('think'); };
  const kindLabel={recognise:'Recognise',recall:'Recall',apply:'At the table',contrast:'Tell them apart'}[q.k];
  return <div data-testid="team-drill">
    <div style={{display:'flex',gap:4,marginBottom:14}}>{qs.map((_,k)=><div key={k} style={{flex:1,height:4,borderRadius:2,background:k<i?cr:k===i?T.ink:T.line}}/>)}</div>
    <div style={{fontSize:12,fontWeight:700,color:w?_tTypeCol(T,w.type):T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{kindLabel}{w?` · ${TeamData.short(w)}`:''}</div>
    <div data-testid="drill-q" style={{fontSize:19,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.35,margin:'6px 0 14px'}}>{q.q}</div>
    {!typed&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{q.opts.map((o,k)=>{ const picked=ans===k, right=res&&k===q.a, wrong=res&&picked&&k!==q.a;
      return <div key={k} role="button" data-testid="drill-opt" onClick={()=>!res&&setAns(k)} style={{padding:'12px 14px',borderRadius:12,border:`1.5px solid ${right?'#5FD48F':wrong?'#F28B7D':picked?cr:T.line}`,background:picked?T.soft:'transparent',color:T.ink,fontSize:15,fontFamily:C.P,cursor:res?'default':'pointer'}}>{o}</div>; })}</div>}
    {typed&&<textarea data-testid="drill-text" aria-label="Your answer" value={text} disabled={!!res} onChange={e=>setText(e.target.value)} rows={q.k==='apply'?4:2} placeholder={q.k==='apply'?'What would you say to the guest?':'Your answer'}
      style={{width:'100%',padding:'12px 14px',borderRadius:12,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none',resize:'none'}}/>}
    {!res&&<>
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,margin:'14px 0 6px'}}>How sure are you?</div>
      <div style={{display:'flex',gap:6}}>{[['sure','Sure'],['think','Think so'],['guess','Guessing']].map(([k,l])=><div key={k} role="button" onClick={()=>setSure(k)} style={{flex:1,textAlign:'center',padding:'8px 0',borderRadius:10,border:`1px solid ${sure===k?cr:T.line}`,background:sure===k?T.soft:'transparent',color:sure===k?T.ink:T.mid,fontSize:14,fontFamily:C.P,cursor:'pointer'}}>{l}</div>)}</div>
      <Btn primary full style={{marginTop:14,opacity:(typed?text.trim():ans!==null)?1:0.45}} onClick={submit}>{busy?'Marking…':'Check'}</Btn>
    </>}
    {res&&<div data-testid="drill-result" style={{marginTop:14}}>
      <Card>
        <div style={{fontSize:17,fontWeight:800,fontFamily:C.P,color:res.ok?'#5FD48F':res.verdict==='partly'?'#F2B84B':res.offline?T.mid:'#F28B7D'}}>{res.ok?'Right':res.verdict==='partly'?'Partly':res.offline?'Not marked':'Not quite'}{q.check?' · surprise re-check':''}</div>
        {!res.ok&&q.k!=='apply'&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4}}>The answer: <b>{q.k==='recognise'?q.opts[q.a]:q.ans}</b></div>}
        {q.k==='apply'&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4}}>A good answer: {q.key.join('; ')}.</div>}
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
          <div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{[w.vintage||'NV',w.region,w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ')}</div></div>
        {k&&<Icon n="check" sz={16} col="#5FD48F"/>}<Icon n="chevron" sz={12} col={T.mid}/>
      </div>; })}</Card></div>)}
  </div>; }

/* A wine's staff card. */
function TeamWine({id,pid,open}){ const T=useTheme(), w=TeamData.wine(id), c=TeamData.card(id);
  if(!w) return null; const col=_tTypeCol(T,w.type);
  const bar=(k,label,v,how)=>v==null?null:<div key={k} style={{marginBottom:9}}><div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontFamily:C.P,color:T.ink2}}><span>{label}</span><span>{v}/5</span></div><Prog val={v/5} col={col} h={5} style={{marginTop:4}}/>{how&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:3}}>{how}</div>}</div>;
  return <div data-testid="team-wine">
    <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{w.section||w.type}</div>
    {_tH(T,TeamData.short(w),[w.vintage||'NV',w.region,w.country].filter(Boolean).join(' · '))}
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{w.glass&&<Pill sm>Glass {w.glass}</Pill>}{w.bottle&&<Pill sm>Bottle {w.bottle}</Pill>}{w.other&&<Pill sm>{w.other}</Pill>}{(w.grapes||[]).map(g=><Pill sm key={g}>{g}</Pill>)}</div>
    {!c?<Card><WritingWait compact title="Writing this wine's staff card…" wine={{name:w.name,grapes:w.grapes,region:w.region}}/></Card>:<>
      <Card style={{borderColor:col+'66'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Say it to a guest</div><div data-testid="team-pitch" style={{fontSize:17,color:T.ink,fontFamily:C.P,lineHeight:1.5,marginTop:6}}>{c.pitch}</div></Card>
      {_tLabel(T,'What it tastes like')}<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:10}}>{c.taste}</div>
        {c.style&&<>{bar('b','Body',c.style.body,Palate.HOW.body)}{bar('a','Acidity',c.style.acid,Palate.HOW.acidity)}{w.type==='red'||c.style.tannin?bar('t','Tannin',c.style.tannin,Palate.HOW.tannins):null}{bar('s','Sweetness',c.style.sweet)}</>}</Card>
      {_tLabel(T,'Grape and place')}<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{c.grape} {c.place}{c.producer?' '+c.producer:''}</div></Card>
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
  const fileRef=React.useRef(null), pend=TeamData.pending();
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
  const sec=(t,items,render)=>items.length>0&&<>{_tLabel(T,`${t} (${items.length})`)}<Card style={{padding:0}}>{items.slice(0,40).map((x,i)=><div key={i} style={{padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none',fontSize:14,color:T.ink2,fontFamily:C.P}}>{render(x)}</div>)}{items.length>40&&<div style={{padding:'10px 14px',fontSize:13,color:T.mid,fontFamily:C.P}}>and {items.length-40} more</div>}</Card></>;
  const wl=w=>`${TeamData.label(w)}${w.glass?` · glass ${w.glass}`:''}${w.bottle?` · bottle ${w.bottle}`:''}`;
  return <div data-testid="team-upload">
    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={onFiles} data-testid="team-file" style={{display:'none'}}/>
    {(stage==='idle'||stage==='done')&&<>
      {_tH(T,'Upload','A photo or PDF of your wine list or menu. Several photos for a long list. Nothing reaches your staff until you approve what changed.')}
      {stage==='done'&&<Card style={{marginBottom:12,borderColor:'#5FD48F66'}}><div data-testid="team-published" style={{fontSize:15,color:'#5FD48F',fontWeight:700,fontFamily:C.P}}>Published. Your staff's training is up to date.</div></Card>}
      {err&&<Card style={{marginBottom:12,borderColor:'#F28B7D66'}}><div style={{fontSize:14,color:'#F28B7D',fontFamily:C.P}}>{err}</div></Card>}
      {(pend.cards>0||pend.pairings>0)&&<Card style={{marginBottom:12}}><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginBottom:8}}>{[pend.cards&&`${pend.cards} wine${pend.cards===1?'':'s'} without a staff card`,pend.pairings&&`${pend.pairings} dish${pend.pairings===1?'':'es'} without pairings`].filter(Boolean).join(' and ')}.</div><Btn small onClick={resume}>Finish writing them</Btn></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Card onClick={()=>pick('list')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="wine" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Wine list</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamData.wines().length?`${TeamData.wines().length} wines live. Upload the new one to update it.`:'Your full list, by the glass and by the bottle.'}</div></div></Card>
        <Card onClick={()=>pick('menu')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="fork" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Menu</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamData.dishes().length?`${TeamData.dishes().length} dishes live.`:'So every wine is paired with your dishes.'}</div></div></Card>
      </div></>}
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
  const add=()=>{ if(!name.trim()) return; TeamLearn.addPerson(name.trim(),role); setName(''); bump(x=>x+1); onChanged&&onChanged(); };
  const counts={ready:0,slipping:0,not:0}; ppl.forEach(p=>{ const r=TeamLearn.readiness(p.id); if(r) counts[r.state]++; });
  return <div data-testid="team-people">{_tH(T,'Your team',`${counts.ready} ready, ${counts.slipping} slipping, ${counts.not} not ready yet`)}
    <Card style={{padding:0}}>{ppl.map((p,i)=>{ const r=TeamLearn.readiness(p.id), st=_tState[r.state];
      return <div key={p.id} role="button" onClick={()=>{ TeamLearn.setMe(p.id); onChanged&&onChanged(); open({tab:'today'}); }} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{p.name}</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamLearn.ROLES[p.role].label}{r.overdue?` · ${r.overdue} overdue`:''}</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:15,fontWeight:800,color:st.col,fontFamily:C.P}}>{r.pct}%</div><div style={{fontSize:12,color:st.col,fontFamily:C.P}}>{st.label}</div></div>
      </div>; })}</Card>
    {_tLabel(T,'Add someone')}
    <Card><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
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

Object.assign(window,{TeamRing,TeamSetup,TeamToday,TeamDrill,TeamWines,TeamWine,TeamMenu,TeamDish,TeamUpload,TeamPeople});
