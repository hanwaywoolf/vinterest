/* Screens for the restaurant staff-training app (team-app.jsx routes them; logic in team-data.js
   and team-learn.js; docs/business.md). Always on the dark stage. Staff see Today, Wines and Menu;
   a manager or buyer also sees Upload and Team. */

const _tState={ready:{label:'Ready',col:'#5FD48F'},slipping:{label:'Slipping',col:'#F2B84B'},not:{label:'Not ready yet',col:'#F28B7D'}};
const _tH=(T,t,sub)=><div style={{marginBottom:10}}><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{t}</div>{sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>;
const _tLabel=(T,t)=><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',margin:'16px 0 8px'}}>{t}</div>;
const _tTypeCol=(T,t)=>T.lift(_TYPE_COLORS[String(t||'red').toLowerCase().replace('é','e')]||C.cr);
/* Pills in a cluster each say what they are by their accent: a glass price in the wine's colour, a bottle price
   filled, a grape in green, anything else plain. */
/* Anything that stands on its own on screen (a pill, a label, a line under a name, an item in a list) starts
   with a capital, whatever case the card was written in: "Blanco tequila", "Under $50", "Large red glass". */
const _tCap=s=>{ const t=String(s==null?'':s).trim(); return t?t.charAt(0).toUpperCase()+t.slice(1):t; };
const _tCaps=xs=>(xs||[]).map(_tCap).join(', ');
const _tPill=(T,kind,text,col)=>{ const st={glass:{border:col,color:col,bg:_alpha(col,0.14)},bottle:{border:T.ink2,color:T.ink,bg:T.soft},grape:{border:_alpha(col,0.6),color:col,bg:'transparent'},other:{border:T.line,color:T.mid,bg:'transparent'}}[kind]||{border:T.line,color:T.mid,bg:'transparent'};
  return <span data-pill={kind} style={{display:'inline-flex',alignItems:'center',padding:'3px 10px',borderRadius:20,border:`1px solid ${st.border}`,background:st.bg,color:st.color,fontSize:13,fontWeight:600,fontFamily:C.P}}>{_tCap(text)}</span>; };
/* A person's face in a circle (team/faces/, served beside the app), else their initials. */
function TeamFace({person,size=36,ring}){ const T=useTheme();
  const init=String(person&&person.name||'?').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const st={width:size,height:size,borderRadius:size/2,flexShrink:0,boxShadow:ring?`0 0 0 2px ${ring}`:'none'};
  return person&&person.photo?<img src={person.photo} alt="" width={size} height={size} style={{...st,objectFit:'cover',display:'block'}}/>
    :<div aria-hidden="true" style={{...st,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.38+'px',fontWeight:700,color:T.ink2,fontFamily:C.P}}>{init}</div>; }
function _tDays(ms){ const d=Math.round((ms-Date.now())/86400000); return d<0?`${-d} day${d===-1?'':'s'} behind`:d===0?'due today':`due in ${d} day${d===1?'':'s'}`; }
/* The background job after a publish (TeamJobs): re-renders on every step. */
function useTeamJob(){ const [,bump]=React.useReducer(x=>x+1,0); React.useEffect(()=>{ window.addEventListener('vbiz:job',bump); return ()=>window.removeEventListener('vbiz:job',bump); },[]); return TeamJobs.current(); }
/* Where the writing is, as a strip the manager can leave alone: the step and its count with a thin bar
   while it runs, "Published" when done, and the reason with Resume if it stopped. A tap opens Upload. */
function TeamJobChip({onOpen,style}){ const T=useTheme(), cr=T.lift(C.cr), job=useTeamJob(); if(!job) return null;
  const col=job.error?T.amber:job.done?T.green:cr;
  return <div data-testid="team-job" data-state={job.error?'error':job.done?'done':'running'} role="button" onClick={onOpen} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:12,border:`1px solid ${col}66`,background:T.soft,marginBottom:12,cursor:'pointer',...style}}>
    <div style={{flex:1,minWidth:0}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:14,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:700,color:col}}>{job.error?'Writing stopped':job.done?'Published':'Writing in the background'}</span><span style={{color:T.mid,whiteSpace:'nowrap'}}>{job.error?'':job.done?TeamData.checkedLine():job.b?`${job.step} · ${job.a} of ${job.b}`:job.step}</span></div>
      {job.error?<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:2}}>{job.error} What was written is kept.</div>:!job.done&&<Prog val={job.b?job.a/job.b:0.05} col={cr} h={4} style={{marginTop:6}}/>}
    </div>
    {!job.running&&<div role="button" aria-label="Dismiss" onClick={e=>{ e.stopPropagation(); TeamJobs.dismiss(); }} style={{width:26,height:26,borderRadius:13,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',color:T.mid,fontFamily:C.P,fontSize:14,flexShrink:0}}>×</div>}
  </div>; }
/* The figures a manager wants on the move, on the phone's Today: the console has the rest. */
function TeamKpiStrip({open}){ const T=useTheme(), o=TeamReport.overview(), s=TeamReport.salesSummary(7);
  const tile=(label,value,sub,col,onClick,testid)=><div key={label} role="button" data-testid={testid} onClick={onClick} style={{flex:'1 1 120px',padding:'10px 12px',borderRadius:12,border:`1px solid ${T.line}`,background:T.soft,cursor:'pointer',minWidth:0}}>
    <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{label}</div><div style={{fontSize:22,fontWeight:700,color:col||T.ink,fontFamily:C.P,lineHeight:1.1,marginTop:2}}>{value}</div>{sub&&<div style={{fontSize:11,color:T.mid,fontFamily:C.P,marginTop:2,lineHeight:1.35}}>{sub}</div>}</div>;
  return <div data-testid="team-kpis" style={{marginBottom:14}}>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      {tile('Team readiness',`${o.avg}%`,`${o.ready} of ${o.total} ready`,null,()=>open({console:'team'}),'kpi-readiness')}
      {tile('Behind',o.behind,o.behind?'past their wave':'all on track',o.behind?T.tone.bad:null,()=>open({console:'team'}))}
      {tile('Slipping',o.slipping,o.slipping?'were ready':'none',o.slipping?T.amber:null,()=>open({console:'team'}))}
      {o.adoption.length>0&&tile('New on the list',o.adoption.length,`${o.adoption.filter(a=>a.knows<a.of).length} not yet known by all`,null,()=>open({console:'wines'}))}
      {s&&tile('Wine sales, 7 nights',TeamData.money(Math.round(s.revenue)),`${s.delta.revenue==null?'':(s.delta.revenue>0?'▲':'▼')+Math.abs(s.delta.revenue)+'% · '}${TeamSales.demo()?'demo data':'from your POS'}`,null,()=>open({console:'sales'}),'kpi-sales')}
    </div>
    {/* Each figure opens its part of the console; the console works on a phone too, and wider on a tablet or laptop. */}
    <div data-testid="kpi-console" style={{marginTop:10}}><Btn small primary onClick={()=>open({console:'dash'})}>Open the console</Btn></div>
  </div>; }

/* The installed restaurant's own logo (venue.brand): its wordmark in white on the dark stage. */
// brand.scale sizes a taller logo up from the line it sits in (The Larkspur's is 2:1, The Social Corner's 9:1).
function TeamVenueLogo({height=22,style}){ const b=TeamData.brand(); if(!b||!b.logo) return null; height=Math.round(height*(b.scale||1));
  return <img data-testid="team-venue-logo" src={b.logo} alt={TeamData.get().venue.name||''} style={{height,maxWidth:'100%',objectFit:'contain',display:'block',...style}} onError={e=>{ e.target.style.display='none'; }}/>; }

/* A ring for a readiness figure. */
function TeamRing({pct,col,size=88}){ const T=useTheme(), r=size/2-7, c=2*Math.PI*r;
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
    <circle cx={size/2} cy={size/2} r={r} stroke={T.line} strokeWidth="7" fill="none"/>
    <circle cx={size/2} cy={size/2} r={r} stroke={col} strokeWidth="7" fill="none" strokeLinecap="round" strokeDasharray={`${c*Math.min(1,pct/100)} ${c}`} transform={`rotate(-90 ${size/2} ${size/2})`} style={{filter:`drop-shadow(0 0 6px ${col}66)`}}/>
    <text x="50%" y="53%" textAnchor="middle" dominantBaseline="middle" fill={T.ink} style={{fontFamily:C.P,fontWeight:800,fontSize:size*0.24+'px'}}>{pct}%</text>
  </svg>; }

/* First run: the restaurant's name and who's setting it up. */
function TeamSetup({onDone}){ const T=useTheme(), cr=T.lift(C.cr);
  const [venue,setVenue]=React.useState(''), [name,setName]=React.useState(''), [role,setRole]=React.useState('server');
  const field={width:'100%',padding:'12px 14px',borderRadius:12,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none'};
  // A restaurant installed with its list and training (/team/?seed=social) needs only the person setting it up.
  const installed=TeamData.get().venue, brand=TeamData.brand();
  if(installed&&installed.name&&TeamData.wines().length) return <div data-testid="team-setup-installed" style={{padding:'calc(env(safe-area-inset-top) + 28px) 20px 24px',maxWidth:520,margin:'0 auto'}}>
    {brand&&brand.logo?<TeamVenueLogo height={40} style={{marginBottom:18}}/>:<div style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>{installed.name}</div>}
    {(()=>{ const n=TeamData.wines().length, m=TeamData.dishes().length, ready=TeamData.wines().every(w=>TeamData.card(w.id));
      return _tH(T,ready?'Your floor training is ready.':'Your list and menu are in.',`${n} wines and ${m} dishes from ${installed.name}'s list and menu${ready?', each wine with a staff card and every dish with its pairings':''}. Add your name to start as the manager; you add the rest of the team from the Team tab.`); })()}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      <input aria-label="Your name" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={field}/>
      <Btn primary full onClick={()=>{ if(!name.trim()) return; TeamLearn.addPerson(name.trim(),'manager'); onDone(); }}>Start training</Btn>
    </div>
    <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:22,display:'flex',alignItems:'center',gap:8}}><img src="/logo.png" alt="" style={{height:12,filter:'invert(1)',opacity:0.7}} onError={e=>{ e.target.style.display='none'; }}/>Vinterest Teams</div>
  </div>;
  const go=sample=>{ if(!sample&&(!venue.trim()||!name.trim())) return;
    if(sample) TeamSample.load(sample); else { TeamData.setVenue({name:venue.trim()}); TeamLearn.addPerson(name.trim(),'manager'); }
    onDone(); };
  return <div style={{padding:'calc(env(safe-area-inset-top) + 28px) 20px 24px',maxWidth:520,margin:'0 auto'}}>
    <div style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Vinterest Teams</div>
    {_tH(T,'Train your floor on your own wines.','Upload your wine list and menu. Every wine gets a staff card and pairings with your dishes, and everyone drills what their role sells until they know it, and keeps knowing it.')}
    <div style={{display:'flex',flexDirection:'column',gap:10,marginTop:14}}>
      <input aria-label="Restaurant name" placeholder="Restaurant name" value={venue} onChange={e=>setVenue(e.target.value)} style={field}/>
      <input aria-label="Your name" placeholder="Your name" value={name} onChange={e=>setName(e.target.value)} style={field}/>
      <Btn primary full onClick={()=>go(false)}>Set up my restaurant</Btn>
      <div style={{textAlign:'center',fontSize:14,color:T.mid,fontFamily:C.P,margin:'6px 0'}}>or</div>
      {/* The Social Corner, the first real restaurant's install, first: a phone opening plain /team/ (a link that lost
          its ?seed=social) can still get to it. */}
      <div data-testid="team-load-social" role="button" onClick={()=>go('social')} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,border:`1px solid ${T.line}`,background:T.soft,cursor:'pointer'}}>
        <img src="brand/social-corner/mark.png" alt="" style={{width:36,height:36,borderRadius:18,flexShrink:0}} onError={e=>{ e.target.style.display='none'; }}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>Open The Social Corner</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{TeamSample.socialLine()}</div></div>
        <Icon n="chevron" sz={12} col={T.mid}/></div>
      <div data-testid="team-load-demo"><Btn full onClick={()=>go('demo')}>Open The Larkspur: {TeamSample.demoLine()}</Btn></div>
    </div>
  </div>; }

/* Tonight, before service (docs/business.md, "Pre-shift"): what's 86'd, the feature with one line to say, and the two
   by-the-glass wines this person should look at (slipping, or a top seller not started), each with its line and Say it.
   Ninety seconds at clock-in, nothing scored. Shown only when there's something on it. */
function TeamTonightCard({pid,open,manage}){ const T=useTheme(), cr=T.lift(C.cr), tn=TeamData.tonight(), look=TeamLearn.slippingOn(pid,2);
  const off=tn.off.map(id=>TeamData.dish(id)).filter(Boolean), feat=tn.feature.map(id=>TeamData.wine(id)||TeamData.cocktail(id)).filter(Boolean);
  const say=(x)=>{ TeamVoice.unlock(); TeamVoice.speak(x.name&&!x.producer?x.name:TeamData.short(x),{pace:'slow'}); };
  const line=w=>{ const c=TeamData.card(w.id)||TeamData.cocktailCard(w.id); const p=c&&c.pitch?String(c.pitch).split(/(?<=[.!?])\s+/)[0]:''; return p; };
  const wineRow=(w,why,key)=><div key={key} role="button" onClick={()=>open({view:TeamLearn.isCocktail(w.id)?'cocktail':'wine',id:w.id})} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 0',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}>
    <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{TeamData.short(w)}{why&&<span style={{fontSize:13,fontWeight:600,color:T.amber,marginLeft:8}}>{why}</span>}</div>
      {line(w)&&<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{line(w)}</div>}</div>
    <div role="button" aria-label={`Say ${TeamData.short(w)}`} onClick={e=>{ e.stopPropagation(); say(w); }} style={{width:36,height:36,borderRadius:18,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>🔊</div></div>;
  if(!off.length&&!feat.length&&!look.length&&!manage) return null;
  return <div data-testid="team-tonight" style={{marginBottom:12}}><Card style={{borderColor:_alpha(cr,0.5)}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}><div style={{fontSize:12,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Tonight</div>
      {manage&&<span role="button" data-testid="tonight-edit" onClick={()=>open({view:'tonight'})} style={{fontSize:14,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer'}}>{off.length||feat.length?'Change':'Set tonight'}</span>}</div>
    {off.length>0&&<div data-testid="tonight-off" style={{marginTop:8,fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.4}}><b style={{color:'#F28B7D'}}>86'd:</b> {off.map(x=>x.name).join(', ')}</div>}
    {feat.length>0&&<div data-testid="tonight-feature" style={{marginTop:off.length?6:8,fontSize:14,color:T.mid,fontFamily:C.P}}>On feature</div>}
    {feat.map(w=>wineRow(w,'',`f${w.id}`))}
    {look.length>0&&<div data-testid="tonight-look" style={{marginTop:10,fontSize:14,color:T.mid,fontFamily:C.P}}>Worth a look before service</div>}
    {look.map(x=>wineRow(x.wine,x.why,`l${x.wine.id}`))}
    {!off.length&&!feat.length&&manage&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>Nothing set for tonight: what's 86'd and what's on feature show on everyone's Today.</div>}
  </Card></div>; }
/* The manager's editor for tonight: tap a dish to 86 it, a wine or cocktail to put it on feature. Clears itself tomorrow. */
function TeamTonightEdit({back}){ const T=useTheme(), cr=T.lift(C.cr), [,bump]=React.useReducer(x=>x+1,0), [q,setQ]=React.useState('');
  const tn=TeamData.tonight(), norm=x=>String(x||'').toLowerCase(), hit=x=>!q.trim()||norm(x).includes(norm(q.trim()));
  const row=(kind,id,name,sub,on,col)=><div key={kind+id} role="button" data-testid={`tonight-${kind}`} aria-pressed={on} onClick={()=>{ TeamData.toggleTonight(kind,id); bump(); }} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderTop:`1px solid ${T.line}`,cursor:'pointer',background:on?_alpha(col,0.12):'transparent'}}>
    <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{name}</div>{sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{sub}</div>}</div>
    <span style={{fontSize:13,fontWeight:700,fontFamily:C.P,color:on?col:T.mid,padding:'4px 10px',borderRadius:10,border:`1px solid ${on?col:T.line}`}}>{on?(kind==='off'?"86'd":'On feature'):(kind==='off'?'86 it':'Feature')}</span></div>;
  return <div data-testid="team-tonight-edit">{_tH(T,'Tonight',"What's 86'd and what's on feature, on everyone's Today until the end of the day.")}
    <input aria-label="Find a dish or wine" placeholder="Find a dish, wine or cocktail" value={q} onChange={e=>setQ(e.target.value)} style={{width:'100%',padding:'11px 14px',borderRadius:12,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none',marginBottom:4}}/>
    {_tLabel(T,`86'd (${tn.off.length})`)}<Card style={{padding:0}}>{TeamData.dishes().filter(x=>hit(x.name)||tn.off.includes(x.id)).slice(0,q?30:12).map(x=>row('off',x.id,x.name,x.section,tn.off.includes(x.id),'#F28B7D'))}</Card>
    {_tLabel(T,`On feature (${tn.feature.length})`)}<Card style={{padding:0}}>{[...TeamData.wines(),...TeamData.cocktails()].filter(x=>hit(x.producer?TeamData.short(x):x.name)||tn.feature.includes(x.id)).slice(0,q?30:12).map(x=>row('feature',x.id,x.producer?TeamData.short(x):x.name,x.glass?`glass ${x.glass}`:x.price||x.bottle,tn.feature.includes(x.id),'#5FD48F'))}</Card>
    <Btn primary full style={{marginTop:14}} onClick={back}>Done</Btn>
  </div>; }

/* Today: where this person stands, what's assigned, and the drill. */
function TeamToday({pid,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const person=TeamLearn.person(pid), r=TeamLearn.note(pid), as=TeamLearn.assignments(pid), ret=TeamLearn.retention(pid), pl=TeamLearn.plan(pid);
  if(!person||!r) return null;
  // Someone who hasn't drilled yet sees a plan, not a verdict: the first wave, its days, and one button. The ring and the
  // parts arrive once there's something to measure. Afterwards the current wave sits as one line over the parts.
  const fresh=pl&&!pl.started&&pl.current;
  const waveLine=pl&&pl.current?`Wave ${pl.current.n} of ${pl.waves.length} · ${pl.current.label} · day ${pl.current.day} of ${pl.current.days} · ${pl.current.done} of ${pl.current.total} known`:'';
  const inWave=pl&&pl.current?as.filter(a=>TeamLearn._keyPart(a.key)===pl.current.part):as;
  const st=_tState[r.state];
  const empty=!TeamData.wines().length;
  return <div>
    <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}><TeamFace person={person} size={64} ring={st.col}/>
      <div><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>Hi {person.name.split(' ')[0]}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3}}>{TeamLearn.ROLES[person.role].label} at {TeamData.get().venue.name||'your restaurant'}</div></div></div>
    {!empty&&<TeamTonightCard pid={pid} open={open} manage={TeamLearn.canConsole(person)}/>}
    {!empty&&TeamLearn.canConsole(person)&&<TeamKpiStrip open={open}/>}
    {empty?<Card><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>No wine list yet. {TeamLearn.ROLES[person.role].label==='Manager'||person.role==='buyer'?'Upload it from the Upload tab and your training is written from it.':'Your manager uploads it, then your training appears here.'}</div></Card>:<>
    {fresh?<div data-testid="team-plan"><Card style={{borderColor:_alpha(cr,0.6)}}>
      <div style={{fontSize:12,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>Your first {pl.current.days} days</div>
      <div data-testid="team-state" data-pct={r.pct} style={{fontSize:20,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2,marginTop:4}}>{pl.current.part==='dishes'?`The ${pl.current.total} dishes on the menu`:pl.current.part==='cocktails'?`The ${pl.current.total} cocktails`:pl.current.part==='glass'?`The ${pl.current.total} wines by the glass`:`The ${pl.current.total} bottles`}</div>
      <div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:4}}>Day {pl.current.day} of {pl.current.days}. Five questions a day, what sells most first; {pl.waves.length>1?`then ${pl.waves.slice(1).map(w=>w.label.toLowerCase()).join(', then ')}`:'that\'s the whole list'}. Your readiness shows once you've done a drill.</div>
    </Card></div>:<Card style={{display:'flex',gap:14,alignItems:'center'}}>
      <TeamRing pct={r.pct} col={st.col}/>
      <div style={{flex:1,minWidth:0}}>
        <div data-testid="team-state" data-pct={r.pct} style={{fontSize:17,fontWeight:800,color:st.col,fontFamily:C.P}}>{st.label}</div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{r.state==='ready'?'You know what your role sells. Keep the daily drill going so it stays that way.':r.state==='slipping'?'Some answers have faded or new wines arrived. A few drills puts you back.':'Your minimum for working the floor, below.'}</div>
      </div>
    </Card>}
    {!fresh&&waveLine&&<div data-testid="team-wave" style={{fontSize:14,color:pl.behind?'#F28B7D':T.mid,fontFamily:C.P,margin:'10px 2px 0',lineHeight:1.4}}>{waveLine}{pl.behind?` · ${pl.behind} day${pl.behind===1?'':'s'} behind`:' · on track'}</div>}
    <Card style={{marginTop:10}}>
      {Object.entries(r.parts).map(([k,p])=><div key={k} data-testid="team-part" style={{marginBottom:18}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,fontSize:14,fontFamily:C.P,color:T.ink2}}><span style={{fontWeight:700,color:T.ink}}>{TeamLearn.PART_LABEL[k]}</span><span>{p.known} of {p.total} known · need {Math.round(p.need*100)}%</span></div>
        <div style={{position:'relative',marginTop:5}}><Prog val={p.partial} col={p.share>=p.need?'#5FD48F':cr} h={6}/><div style={{position:'absolute',left:`${p.need*100}%`,top:-3,width:2,height:12,background:T.ink,opacity:0.6}}/></div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6}}>{Math.round(p.partial*100)}% of the answers held</div>
        {/* A clear button per part: a green outline with white text, so practising one part is an obvious next step. */}
        <div role="button" data-testid="team-part-practise" onClick={()=>open({view:'drill',part:k})} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginTop:8,padding:'11px 14px',borderRadius:12,border:'1.5px solid #5FD48F',background:_alpha('#5FD48F',0.1),color:T.ink,fontSize:15,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>Practise {TeamLearn.PART_LABEL[k].toLowerCase()}<span style={{color:'#5FD48F'}}>→</span></div>
      </div>)}
      <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>A wine, dish or cocktail is known once every question on it is right and still fresh; the line fills with every answer you hold.</div>
      {ret.asked>=3&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Surprise re-checks this month: {ret.right} of {ret.asked} remembered.</div>}
    </Card>
    {(()=>{ const dn=TeamLearn.doneToday(pid);
      if(!dn) return <Btn primary full style={{marginTop:14}} onClick={()=>open({view:'drill'})}>{r.due||as.length?`Start today's drill`:'Practise'} · 5 questions</Btn>;
      return <><div data-testid="today-done" style={{display:'flex',gap:12,alignItems:'center',marginTop:14,padding:'12px 14px',borderRadius:14,border:`1px solid ${_alpha('#5FD48F',0.5)}`,background:_alpha('#5FD48F',0.08)}}>
          <div style={{width:32,height:32,borderRadius:16,background:'#5FD48F',color:'#0F1A13',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,flexShrink:0}}>✓</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>Today's drill done</div>
            <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4,marginTop:2}}>{dn.right} of {dn.of} right{dn.n>1?` over ${dn.n} drills`:''}. The next one is ready tomorrow; more now only helps.</div></div></div>
        <Btn full style={{marginTop:10}} onClick={()=>open({view:'drill'})}>Do another 5 questions</Btn></>; })()}
    {(()=>{ const vt=TeamVinny.test(pid); return vt.none?null:<div data-testid="today-vinny" role="button" onClick={()=>open({view:'drill',qs:vt.qs,intro:{title:vt.title,why:vt.why}})} style={{display:'flex',gap:12,alignItems:'center',marginTop:10,padding:'12px 14px',borderRadius:14,border:`1px solid ${T.line}`,cursor:'pointer'}}><TeamVinnyMark size={32}/><div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>Vinny's test · {vt.qs.length} questions</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4,marginTop:2}}>{vt.why}</div></div><Icon n="chevron" sz={12} col={T.mid}/></div>; })()}
    {inWave.length>0&&<>{_tLabel(T,pl&&pl.current?`This wave: ${pl.current.label.toLowerCase()} (${inWave.length} to go)`:`New to learn (${as.length})`)}
      <Card style={{padding:0}}>{inWave.slice(0,8).map((a,i)=>{ const x=a.kind==='wine'?TeamData.wine(a.id):a.kind==='cocktail'?TeamData.cocktail(a.id):TeamData.dish(a.id); if(!x) return null;
        return <div key={a.key} role="button" onClick={()=>open({view:a.kind,id:a.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
          <Icon n={a.kind==='fork'?'fork':a.kind==='dish'?'fork':'wine'} sz={16} col={a.kind==='wine'?_tTypeCol(T,x.type):a.kind==='cocktail'?_tMixCol(T):T.mid}/>
          <div style={{flex:1,minWidth:0,fontSize:14,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.kind==='wine'?TeamData.short(x):x.name}</div>
          <span style={{fontSize:14,color:a.overdue?'#F28B7D':T.mid,fontFamily:C.P,flexShrink:0}}>{_tDays(a.due)}</span>
        </div>; })}</Card></>}
    </>}
  </div>; }

/* The drill: one question at a time, how sure they are, then what's right and why. */
function TeamDrill({pid,only,part,given,intro,back,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const asideRef=React.useRef({}); // the line shown after each answer, kept so a drill never repeats one
  // given: questions chosen elsewhere (Vinny's test, team-vinny.js), with intro {title, why} over the first.
  // Every drill deals its questions afresh, so a question seen before comes back in a new order.
  const [qs]=React.useState(()=>{ const raw=given&&given.length?given:only?TeamLearn.qsFor(TeamLearn.person(pid).role,only):TeamLearn.drill(pid,undefined,part||null);
    const nonce=Date.now().toString(36); return raw.map((q,i)=>TeamLearn.deal(q,nonce+i)); });
  // Where they stood as the drill began, so the summary can say what moved.
  const [before]=React.useState(()=>{ const r=TeamLearn.readiness(pid); const items={};
    qs.forEach(q=>{ const id=q.wine||q.cocktail||q.dish; if(id&&!items[id]) items[id]=TeamLearn.progress(pid,id,{dish:!q.wine&&!q.cocktail}); }); return {pct:r?r.pct:0,items}; });
  const [i,setI]=React.useState(0), [ans,setAns]=React.useState(null), [picks,setPicks]=React.useState([]), [sure,setSure]=React.useState('think');
  // When the question doesn't ask how sure they are, a right answer inside QUICK_MS reads as sure (confidence from speed, not a tap).
  const shownAt=React.useRef(Date.now());
  // Each question (and the summary after the last) opens at its top: the previous one may have been scrolled to reach its answers.
  const rootRef=React.useRef(null);
  React.useLayoutEffect(()=>{ const el=rootRef.current&&rootRef.current.closest('[data-scroll]'); if(el&&i>0) el.scrollTop=0; },[i]);
  const [res,setRes]=React.useState(null), [busy,setBusy]=React.useState(false), [tally,setTally]=React.useState({right:0,of:0});
  const rightRef=React.useRef([]); // the questions answered right in this drill, for the summary's words
  const [how,setHow]=React.useState(false);
  // Answering is the consumer quiz's phases on one screen: `q` (the options), `reveal` (the picks turn green or red,
  // the right ones shown), `leaving` (the options slide away one after another) and `feedback` (the question steps
  // down and the answer and its context rise in their place). Reduced motion goes straight to the answer; tests run
  // it VINTEREST_QUIZ_SPEED times faster, as the consumer quiz.
  const [phase,setPhase]=React.useState('q'), timers=React.useRef([]);
  React.useEffect(()=>()=>timers.current.forEach(clearTimeout),[]);
  const reveal=()=>{ const still=typeof matchMedia!=='undefined'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(still){ setPhase('feedback'); return; } const sp=_tQuizSpeed(); setPhase('reveal');
    timers.current.push(setTimeout(()=>setPhase('leaving'),_T_REVEAL_MS/sp),setTimeout(()=>setPhase('feedback'),(_T_REVEAL_MS+_T_LEAVE_MS)/sp)); };
  const q=qs[i];
  // The daily drill reaching its summary marks today's drill done (once), so Today stops asking for it.
  const daily=!given&&!only&&!part, marked=React.useRef(false);
  React.useEffect(()=>{ if(!q&&qs.length&&daily&&!marked.current){ marked.current=true; TeamLearn.drillDone(pid,tally.right,tally.of); } },[q]);
  if(!qs.length) return <div>{_tH(T,'Nothing to drill yet','Your training appears once the wine list has staff cards.')}<Btn full onClick={back}>Back</Btn></div>;
  if(!q){ const r=TeamLearn.note(pid), rise=r.pct-before.pct, right=rightRef.current;
    const rows=Object.entries(before.items).map(([id,was])=>{ const mix=TeamLearn.isCocktail(id), dish=!mix&&!qs.some(x=>x.wine===id), now=TeamLearn.progress(pid,id,{dish}), name=mix?(TeamData.cocktail(id)||{}).name:dish?(TeamData.dish(id)||{}).name:TeamData.short(TeamData.wine(id)||{}); return {id,name,was,now,dish,mix}; });
    // The summary says the result in words (what they now know, when it comes back), then the figures; the mechanism waits behind a tap.
    const known=TeamLearn.knownLine(right), when=TeamLearn.comesBack(pid,right);
    // One line on what the wine they drilled is worth here, from the till: the drilled wine that sells most.
    const sells=(()=>{ try{ const ids=[...new Set(qs.map(x=>x.wine).filter(Boolean))]; const best=ids.map(id=>({id,s:TeamReport.sells(id)})).filter(x=>x.s).sort((a,b)=>b.s.perWeek-a.s.perWeek)[0]; return best?TeamReport.sellsLine(best.id):''; }catch(e){ return ''; } })();
    return <div ref={rootRef} data-testid="drill-done">{_tH(T,`${tally.right} of ${tally.of} right`,known||(tally.of?'Not this time. The ones you missed come back soonest.':''))}
      {(when||sells)&&<Card style={{marginBottom:10}}>
        {when&&<div data-testid="drill-when" style={{fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.45}}>{when}</div>}
        {sells&&<div data-testid="drill-sells" style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:when?8:0}}>{sells}</div>}
      </Card>}
      <Card>
        <div style={{display:'flex',gap:14,alignItems:'center'}}><TeamRing pct={r.pct} col={_tState[r.state].col} size={64}/>
          <div><div data-testid="drill-readiness" style={{fontSize:15,fontWeight:700,color:_tState[r.state].col,fontFamily:C.P}}>{_tState[r.state].label}</div>
            <div style={{fontSize:15,color:T.ink2,fontFamily:C.P,marginTop:2}}>Readiness {before.pct}% → {r.pct}%{rise>0?<span style={{color:'#5FD48F',fontWeight:700}}> ▲{rise}</span>:rise<0?<span style={{color:'#F28B7D',fontWeight:700}}> ▼{-rise}</span>:' · no change'}</div></div></div>
        <div role="button" data-testid="drill-how" onClick={()=>setHow(x=>!x)} style={{fontSize:14,fontWeight:600,color:T.lift(C.cr),fontFamily:C.P,marginTop:10,cursor:'pointer'}}>{how?'Less':'How this works ›'}</div>
        {how&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>Each answer has its own review date: the ones you miss come back soonest, and the ones you hold come back later each time. Every answer you hold counts a little toward readiness; a wine counts in full for the minimum once every rung is right and still fresh.</div>}
      </Card>
      {_tLabel(T,'In this drill')}
      <Card style={{padding:0}}>{rows.map((x,k)=><div key={x.id} data-testid="drill-item" role={open?'button':undefined} onClick={()=>open&&open({view:x.mix?'cocktail':x.dish?'dish':'wine',id:x.id})} style={{padding:'11px 14px',borderTop:k?`1px solid ${T.line}`:'none',cursor:open?'pointer':'default'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,fontSize:16,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:700,minWidth:0}}>{x.name}</span><span style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}><span style={{color:x.now.known>x.was.known?'#5FD48F':T.ink2,whiteSpace:'nowrap',fontSize:15}}>{x.now.known} of {x.now.total}{x.now.known>x.was.known?` ▲${x.now.known-x.was.known}`:x.now.known<x.was.known?` ▼${x.was.known-x.now.known}`:''}</span>{open&&<Icon n="chevron" sz={12} col={T.mid}/>}</span></div>
        {/* The rungs as one line of dots with their names, lit where held: a quarter of the space the chips took. */}
        {x.now.rungs.length>0&&<div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:5,fontSize:13,fontFamily:C.P,color:T.mid}}>{x.now.rungs.map(rg=><span key={rg.k} style={{display:'inline-flex',alignItems:'center',gap:5,color:rg.done?'#5FD48F':T.mid}}><span style={{width:8,height:8,borderRadius:4,background:rg.done?'#5FD48F':'transparent',border:`1.5px solid ${rg.done?'#5FD48F':T.line}`,display:'inline-block'}}/>{rg.label}</span>)}</div>}
      </div>)}</Card>
      <Btn primary full style={{marginTop:14}} onClick={back}>Done</Btn></div>; }
  const w=q.wine?TeamData.wine(q.wine):null, mix=q.cocktail?TeamData.cocktail(q.cocktail):null, multi=q.k!=='recognise'&&!q.mc, ch=multi?TeamLearn.choices(q):null;
  const mixNamed=mix&&q.q.toLowerCase().includes(mix.name.toLowerCase());
  // The wine is named over the question only when the question itself names it: "what would you offer from the list" must not say.
  const names=w&&new RegExp(TeamData.short(w).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(q.q);
  const submit=async()=>{ if(busy) return; if(multi?!picks.length:ans===null) return;
    setBusy(true); const g=multi?TeamLearn.gradeChoices(q,picks):await TeamLearn.grade(q,ans); setBusy(false);
    const asks=TeamLearn.asksConfidence(q), quick=Date.now()-shownAt.current<_T_QUICK_MS;
    if(!g.offline) TeamLearn.record(pid,q,g.ok,asks?sure:(g.ok&&quick?'sure':'think'));
    if(g.ok) rightRef.current.push(q);
    setRes(g); setTally(t=>({right:t.right+(g.ok?1:0),of:t.of+1})); reveal(); };
  const next=()=>{ timers.current.forEach(clearTimeout); timers.current=[]; setI(i+1); setAns(null); setPicks([]); setRes(null); setSure('think'); setPhase('q'); shownAt.current=Date.now(); };
  const sp=_tQuizSpeed(), fb=phase==='feedback';
  const kindLabel=TeamLearn.KIND_LABEL[q.k];
  // An option: while answering it's a choice; at the reveal the picks turn green or red and the right ones show, the
  // rest dim; then they slide out to the left one after another.
  const opt=(label,k,{picked,right,wrong,onClick,n=0})=><div key={k} role="button" aria-pressed={picked} data-testid="drill-opt" onClick={onClick} style={{padding:'12px 14px',borderRadius:12,border:`1.5px solid ${right?'#5FD48F':wrong?'#F28B7D':picked?cr:T.line}`,background:right?_alpha('#5FD48F',0.12):wrong?_alpha('#F28B7D',0.12):picked?T.soft:'transparent',color:T.ink,fontSize:16,fontFamily:C.P,cursor:res?'default':'pointer',lineHeight:1.35,
    opacity:res&&!right&&!wrong?0.4:1,transition:'opacity .25s, background .25s, border-color .25s',animation:phase==='leaving'?`tq-out ${260/sp}ms ease-in ${n*40/sp}ms both`:res&&(right||wrong)?`${wrong?'tq-shake':'tq-pop'} ${320/sp}ms ease-out both`:undefined}}>{right?'✓ ':wrong?'✗ ':''}{label}</div>;
  return <div ref={rootRef} data-testid="team-drill">
    {intro&&i===0&&!res&&<div data-testid="drill-intro" style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:14}}><TeamVinnyMark size={28}/><div><div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>{intro.title}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{intro.why}</div></div></div>}
    <div style={{display:'flex',gap:4,marginBottom:14}}>{qs.map((_,k)=><div key={k} style={{flex:1,height:4,borderRadius:2,background:k<i?cr:k===i?T.ink:T.line}}/>)}</div>
    {/* At the table the server makes the call, so the header gives no hint of the wine: no name, kind or colour. */}
    {(()=>{ const hw=q.k==='apply'?null:w; return <div style={{fontSize:12,fontWeight:700,color:hw?_tTypeCol(T,hw.type):mix&&q.k!=='apply'?_tMixCol(T):T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{kindLabel}{hw&&names?` · ${TeamData.short(hw)}`:hw?` · ${hw.section||hw.type}`:mix&&q.k!=='apply'?` · ${mixNamed?mix.name:'Cocktails'}`:''}</div>; })()}
    <style>{_T_QUIZ_CSS}</style>
    <div data-testid="drill-q" style={{fontSize:fb?16:19,fontWeight:700,color:fb?T.ink2:T.ink,fontFamily:C.P,lineHeight:1.35,margin:'6px 0 14px',transition:'font-size .25s, color .25s'}}>{q.q}</div>
    {!fb&&!multi&&<div style={{display:'flex',flexDirection:'column',gap:8}}>{q.opts.map((o,k)=>opt(o,k,{n:k,picked:ans===k,right:res&&k===q.a,wrong:res&&ans===k&&k!==q.a,onClick:()=>!res&&setAns(k)}))}</div>}
    {!fb&&multi&&<>
      {(ch.groups||[{label:null,from:0,to:ch.opts.length,n:ch.n}]).map((g,gi)=>{ const inG=picks.filter(k=>k>=g.from&&k<g.to);
        return <div key={gi} data-testid="drill-group" style={{marginTop:gi?18:0}}>
          <div data-testid="drill-choose" style={{fontSize:14,color:T.mid,fontFamily:C.P,marginBottom:8}}>{g.label?<b style={{color:T.ink2,fontWeight:700}}>{g.label}</b>:null}{g.label?' · ':''}{g.all?'Choose all that apply':`Choose ${g.n}`}{inG.length?` · ${inG.length} picked`:''}</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>{ch.opts.slice(g.from,g.to).map((o,j)=>{ const k=g.from+j, picked=picks.includes(k), isRight=ch.right.includes(k);
            // One pick in a group of one swaps; otherwise picks stop at the group's count.
            return opt(o,k,{n:j,picked,right:res&&isRight,wrong:res&&picked&&!isRight,onClick:()=>{ if(res) return; setPicks(p=>picked?p.filter(x=>x!==k):g.n===1&&!g.all?[...p.filter(x=>x<g.from||x>=g.to),k]:g.all||inG.length<g.n?[...p,k]:p); }}); })}</div></div>; })}
    </>}
    {!res&&<>
      {/* Only a price or an allergen asks how sure they are (TeamLearn.asksConfidence): a wrong one reaches the bill or a guest, and it counts double. */}
      {TeamLearn.asksConfidence(q)&&<div data-testid="drill-sure"><div style={{fontSize:14,color:T.mid,fontFamily:C.P,margin:'14px 0 6px'}}>How sure are you? <span style={{color:T.faint||T.mid}}>{q.allergen?'A wrong allergen comes back this shift.':'A wrong price counts double.'}</span></div>
      <div style={{display:'flex',gap:6}}>{[['sure','Sure'],['think','Think so'],['guess','Guessing']].map(([k,l])=><div key={k} role="button" onClick={()=>setSure(k)} style={{flex:1,textAlign:'center',padding:'10px 0',borderRadius:10,border:`1px solid ${sure===k?cr:T.line}`,background:sure===k?T.soft:'transparent',color:sure===k?T.ink:T.mid,fontSize:15,fontFamily:C.P,cursor:'pointer'}}>{l}</div>)}</div></div>}
      <Btn primary full style={{marginTop:14,opacity:(multi?picks.length:ans!==null)?1:0.45}} onClick={submit}>{busy?'Marking…':'Check'}</Btn>
    </>}
    {res&&fb&&<div data-testid="drill-result" style={{animation:`tq-rise ${360/sp}ms ease-out both`}}>
      <Card>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:34,height:34,borderRadius:17,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,fontFamily:C.P,color:'#0F1A13',background:res.ok?'#5FD48F':res.verdict==='partly'?'#F2B84B':res.offline?T.line:'#F28B7D'}}>{res.ok?'✓':res.verdict==='partly'?'~':res.offline?'?':'✗'}</div>
          <div style={{fontSize:18,fontWeight:800,fontFamily:C.P,color:res.ok?'#5FD48F':res.verdict==='partly'?'#F2B84B':res.offline?T.mid:'#F28B7D'}}>{res.ok?'Right':res.verdict==='partly'?'Partly':res.offline?'Not marked':'Not quite'}{q.check?' · surprise re-check':''}</div></div>
        {!multi&&<div data-testid="drill-answer" style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:10,lineHeight:1.5}}>{ans!==q.a&&ans!==null?<><span>You said </span><s>{q.opts[ans]}</s><span> · </span></>:null}<span>The answer: </span><b style={{color:T.ink}}>{q.opts[q.a]}</b></div>}
        {multi&&<div data-testid="drill-answer" style={{marginTop:10}}>{(ch.groups||[{label:null,from:0,to:ch.opts.length}]).map((g,gi)=>{ const idx=[...Array(g.to-g.from)].map((_,j)=>g.from+j), rights=idx.filter(k=>ch.right.includes(k)), wrongs=idx.filter(k=>picks.includes(k)&&!ch.right.includes(k));
          return <div key={gi} style={{marginTop:gi?12:0}}>{g.label&&<div style={{fontSize:14,fontWeight:700,color:T.ink2,fontFamily:C.P,marginBottom:6}}>{g.label}</div>}
            <div style={{display:'flex',flexDirection:'column',gap:6}}>{rights.map(k=><div key={k} style={{fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.4}}><span style={{color:'#5FD48F',fontWeight:800}}>✓ </span>{ch.opts[k]}{!picks.includes(k)&&<span style={{fontSize:14,color:'#F2B84B',fontWeight:700}}> · you missed this one</span>}</div>)}
              {wrongs.map(k=><div key={k} style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4}}><span style={{color:'#F28B7D',fontWeight:800}}>✗ </span><s>{ch.opts[k]}</s></div>)}</div></div>; })}</div>}
        {res.say&&<div style={{fontSize:15,color:T.ink,fontFamily:C.P,marginTop:12,lineHeight:1.5}}>{res.say}</div>}
        {(()=>{ const seen=asideRef.current; if(!(i in seen)) seen[i]=TeamLearn.aside(q,multi?ch.right.map(k=>ch.opts[k]).join(' '):q.opts&&q.a!=null?q.opts[q.a]:q.ans,new Set(Object.values(seen).map(a=>a&&(a.text||'')).filter(Boolean)),{missed:!res.ok});
          const ax=seen[i]; if(!ax) return null;
          return <div data-testid="drill-aside" style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${T.line}`}}>
            {ax.label&&<div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6}}>{ax.label}</div>}
            {ax.list?<div style={{display:'flex',flexDirection:'column',gap:8}}>{ax.list.map((x,k)=><div key={k} style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}><b style={{color:T.ink}}>{x.name}</b> · {x.text}</div>)}</div>
              :<div style={{fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.55}}>{ax.text}</div>}</div>; })()}
      </Card>
      <Btn primary full style={{marginTop:12}} onClick={next}>{i+1<qs.length?'Next':'Finish'}</Btn>
    </div>}
  </div>; }

const _T_REVEAL_MS=750, _T_LEAVE_MS=420, _T_QUICK_MS=4000;
const _tQuizSpeed=()=>{ const v=typeof window!=='undefined'&&Number(window.VINTEREST_QUIZ_SPEED); return v>0?v:1; };
const _T_QUIZ_CSS=`@keyframes tq-out{to{opacity:0;transform:translateX(-28px)}}@keyframes tq-rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}@keyframes tq-pop{0%{transform:scale(1)}45%{transform:scale(1.03)}100%{transform:scale(1)}}@keyframes tq-shake{0%,100%{transform:none}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}@media (prefers-reduced-motion: reduce){[data-testid=team-drill] *{animation:none!important;transition:none!important}}`;
/* The list, by its own sections, with what this person knows. */
/* Wines | Cocktails at the top of the list tab, where the restaurant has cocktails. */
let _teamListView='wines';
function _TListSwitch({view,set}){ const T=useTheme(), cr=T.lift(C.cr);
  return <div data-testid="team-list-switch" style={{display:'flex',gap:4,padding:3,borderRadius:12,border:`1px solid ${T.line}`,marginBottom:14}}>{[['wines',`Wines (${TeamData.wines().length})`],['cocktails',`Cocktails (${TeamData.cocktails().length})`]].map(([k,l])=>
    <div key={k} role="button" aria-pressed={view===k} data-testid={'team-list-'+k} onClick={()=>{ _teamListView=k; set(k); }} style={{flex:1,textAlign:'center',padding:'8px 0',borderRadius:9,background:view===k?_alpha(cr,0.18):'transparent',color:view===k?T.ink:T.mid,fontSize:14,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>{l}</div>)}</div>; }
function TeamWines({pid,open}){ const T=useTheme();
  const ws=TeamData.wines(), person=TeamLearn.person(pid), items=(TeamLearn._all()[pid]||{}).items||{};
  const mixes=TeamData.cocktails().length>0, [view,setView]=React.useState(mixes?_teamListView:'wines');
  if(mixes&&view==='cocktails') return <div><_TListSwitch view={view} set={setView}/><TeamCocktailList pid={pid} open={open} top/></div>;
  if(!ws.length) return <div>{_tH(T,'Wine list','Nothing uploaded yet.')}</div>;
  const secs=[]; ws.forEach(w=>{ const s=w.section||'The list'; let g=secs.find(x=>x.s===s); if(!g) secs.push(g={s,ws:[]}); g.ws.push(w); });
  return <div>{mixes&&<_TListSwitch view={view} set={setView}/>}{_tH(T,'Wine list',`${ws.length} wines · ${ws.filter(TeamData.byGlass).length} by the glass`)}
    {secs.map(g=><div key={g.s}>{_tLabel(T,g.s)}<Card style={{padding:0}}>{g.ws.map((w,i)=>{ const k=person&&TeamLearn.knowsWine(pid,person.role,w.id,items);
      return <div key={w.id} role="button" data-testid="team-wine-row" onClick={()=>open({view:'wine',id:w.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{width:8,height:8,borderRadius:4,background:_tTypeCol(T,w.type),flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{TeamData.short(w)}</div>
          {/* The one fact a server needs in the list is the price: white, 15px; the region muted after it, the vintage on the card. */}
          <div style={{fontSize:15,color:T.mid,fontFamily:C.P,display:'flex',alignItems:'center',gap:5,flexWrap:'wrap',marginTop:2}}><Flag wine={w} size={14}/><span style={{color:T.ink,fontWeight:600}}>{[w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ')}</span>{w.region&&<span style={{fontSize:14,marginLeft:4}}>{w.region}</span>}</div>
          {(()=>{ const dw=TeamData.window(w); return dw&&<div style={{fontSize:14,fontWeight:600,color:dw.stage==='ready'?'#5FD48F':dw.stage==='young'?'#7FB3F0':'#F2B84B',fontFamily:C.P,marginTop:2}}>{dw.word}{dw.source==='claude'?` · ${dw.line}`:''}</div>; })()}</div>
        {k&&<Icon n="check" sz={16} col="#5FD48F"/>}<Icon n="chevron" sz={12} col={T.mid}/>
      </div>; })}</Card></div>)}
  </div>; }

/* The cocktail colour: the stage's amber, lifted on the dark stage like a wine colour. */
function _tMixCol(T){ return T.lift?T.lift('#C98A2B'):'#C98A2B'; }

/* The cocktail list, by its own sections (Signatures, Spritzes…), under the wines. */
function TeamCocktailList({pid,open,top}){ const T=useTheme(), cs=TeamData.cocktails(); if(!cs.length) return null;
  const person=TeamLearn.person(pid), items=(TeamLearn._all()[pid]||{}).items||{}, col=_tMixCol(T);
  const secs=[]; cs.forEach(c=>{ const s=c.section||'Cocktails'; let g=secs.find(x=>x.s===s); if(!g) secs.push(g={s,cs:[]}); g.cs.push(c); });
  return <div data-testid="team-cocktails">
    <div style={{marginTop:top?0:26}}>{_tH(T,'Cocktails',`${cs.length} on the list`)}</div>
    {secs.map(g=><div key={g.s}>{_tLabel(T,g.s)}<Card style={{padding:0}}>{g.cs.map((c,i)=>{ const k=person&&TeamLearn.knowsWine(pid,person.role,c.id,items);
      return <div key={c.id} role="button" data-testid="team-cocktail-row" onClick={()=>open({view:'cocktail',id:c.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{width:8,height:8,borderRadius:4,background:col,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{c.name}</div>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4,marginTop:2}}>{c.price&&<span style={{color:T.ink,fontWeight:600,fontSize:15}}>{c.price} · </span>}{_tCaps(c.ingredients)}</div></div>
        {k&&<Icon n="check" sz={16} col="#5FD48F"/>}<Icon n="chevron" sz={12} col={T.mid}/>
      </div>; })}</Card></div>)}
  </div>; }

/* A cocktail's card: what to say, what's in it (as the list prints it, with the unusual parts explained),
   how it tastes, which dishes it suits, what to offer instead, and where this person stands with it. */
/* Say it speaks the name itself, not the sounds-like spelling under it: the cloud voice (multilingual) says the
   real name better than it reads a respelling, and data/tts-say.json fixes the ones it gets wrong. */
function TeamCocktail({id,pid,open}){ const T=useTheme(), x=TeamData.cocktail(id), c=TeamData.cocktailCard(id), col=_tMixCol(T);
  if(!x) return null;
  const bar=(k,label,v,how)=>v==null?null:<div key={k} style={{marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:600}}>{label}</span><span style={{color:T.ink2}}>{v}/5</span></div><Prog val={v/5} col={col} h={5} style={{marginTop:5}}/>{how&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:4,lineHeight:1.4}}>{how}</div>}</div>;
  const st=c&&TeamLearn.standing(pid,id);
  return <div data-testid="team-cocktail">
    <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{x.section||'Cocktail'}</div>
    {_tH(T,x.name,[c&&_tCap(c.spirit),x.by&&`By ${x.by}`].filter(Boolean).join(' · ')||null)}
    {c&&c.say&&<div data-testid="team-say" role="button" onClick={()=>{ TeamVoice.unlock(); TeamVoice.speak(x.name,{pace:'slow'}); }} style={{display:'inline-flex',alignItems:'center',gap:8,margin:'-4px 0 12px',padding:'6px 12px',borderRadius:14,border:`1px solid ${T.line}`,cursor:'pointer'}}>
      <span style={{fontSize:14}}>🔊</span><span style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Say it:</span><span style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{c.say}</span></div>}
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{_tPill(T,'glass',x.price,col)}{x.note&&_tPill(T,'other',x.note,col)}</div>
    {st&&st.total>0&&<div data-testid="team-standing" style={{marginBottom:12}}><Card>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Where you stand</div><div style={{fontSize:14,fontWeight:700,color:st.state==='known'?T.green:st.state==='fading'?T.amber:T.ink2,fontFamily:C.P}}>{st.state==='known'?'You know this cocktail':st.state==='fading'?'Fading':st.state==='learning'?`${st.known} of ${st.total} held`:'Not started yet'}</div></div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{st.rungs.map(rg=><span key={rg.k} style={{fontSize:14,fontFamily:C.P,fontWeight:600,padding:'4px 10px',borderRadius:9,border:`1px solid ${rg.done?T.green:T.line}`,color:rg.done?T.green:T.mid}}>{rg.done?'✓ ':''}{rg.label}</span>)}</div>
      <div style={{marginTop:10}}><Btn small primary onClick={()=>open({view:'drill',only:id})}>{st.state==='new'?'Start this cocktail':'Practise this cocktail'}</Btn></div>
    </Card></div>}
    {c&&<Card style={{borderColor:col+'66'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Say it to a guest</div>
      <div data-testid="team-pitch" style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55,marginTop:6}}>{c.pitch}</div></Card>}
    <_TFold k="drink-spec" title="What's in it" summary={(x.ingredients||[]).join(', ')}><Card><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(x.ingredients||[]).map(g=><span key={g}>{_tPill(T,'grape',g,col)}</span>)}</div>
      {c&&(c.explain||[]).length>0&&<div style={{marginTop:10}}>{c.explain.map(e=><div key={e.term} style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:6}}><b style={{color:T.ink}}>{_tCap(e.term)}</b>: {_tCap(e.means)}</div>)}</div>}</Card></_TFold>
    {c&&<><_TFold k="drink-taste" title="What it tastes like" summary={c.taste}><Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:12}}>{c.taste}</div>
      {c.style&&<>{bar('st','Strength',c.style.strength,'How boozy it tastes.')}{bar('sw','Sweetness',c.style.sweet)}{bar('so','Sourness',c.style.sour,'The citrus edge that makes your mouth water.')}{bar('bi','Bitterness',c.style.bitter,'The pleasant bite of Campari, vermouth or bitters.')}</>}</Card></_TFold>
      {(c.dishes||[]).length>0&&<_TFold k="drink-menu" title="With the menu" summary={c.dishes.map(d=>d.dish).join(', ')}><Card style={{padding:0}}>{c.dishes.map((d,i)=>{ const dish=TeamData.dishes().find(z=>z.name===d.dish); return <div key={d.dish} role="button" onClick={()=>dish&&open({view:'dish',id:dish.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:dish?'pointer':'default'}}>
        <div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{d.dish}</div><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>{d.why}</div></div>; })}</Card></_TFold>}
      {(c.alts||[]).length>0&&<_TFold k="drink-alts" title="Offer instead" def summary={c.alts.map(a=>(TeamData.cocktail(a.id)||{}).name).filter(Boolean).join(', ')}><Card style={{padding:0}}>{c.alts.map((a,i)=>{ const o=TeamData.cocktail(a.id); return o&&<div key={a.id} role="button" onClick={()=>open({view:'cocktail',id:a.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{o.name} <span style={{fontWeight:400,color:T.mid,fontSize:14}}>{o.price}</span></div><div style={{fontSize:14,color:T.ink2,fontFamily:C.P}}>{_tCap(a.when)}</div></div>; })}</Card></_TFold>}
    </>}
    {!c&&<Card><div style={{fontSize:15,color:T.mid,fontFamily:C.P}}>No card yet: your manager writes the cocktail cards from the Upload tab.</div></Card>}
  </div>; }

/* A wine's staff card. */
/* A cocktail's card: what's in it as the menu lists it, its style on sweet, sour, bitter and strong,
   how a drink like it is usually served (said as usual: the menu doesn't say), who created it, what to
   pair it with. Teach while asking: each style word says what it means. */
const _DRINK_HOW={sweet:'Sugar and fruit: syrups, liqueurs, juice.',sour:'Citrus and acidity: lemon, lime, sharp fruit.',bitter:'The grip of Campari, bitters, coffee or amaro.',strong:'How much spirit you taste.'};
function TeamDrink({id,pid,open,manage}){ const T=useTheme(), w=TeamData.wine(id), c=TeamData.card(id), cr=T.lift(C.cr);
  if(!w) return null; const st=TeamLearn.standing(pid,id), me=TeamLearn.person(pid);
  // The card shows what the person's training level asks about (TeamLearn.cardShows); the console shows it all.
  const sh=TeamLearn.cardShows(manage?'high':TeamLearn.level(me&&me.role)), fact=sh.fact&&TeamLearn.cardFact(id);
  const bar=(k,label)=>{ const v=c&&c.style&&c.style[k]; return v==null?null:<div key={k} style={{marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:600}}>{label}</span><span style={{color:T.mid}}>{v}/5</span></div>
    <div style={{height:6,borderRadius:3,background:T.line,marginTop:4}}><div style={{width:(v/5*100)+'%',height:'100%',borderRadius:3,background:cr}}/></div><div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:3}}>{_DRINK_HOW[k]}</div></div>; };
  return <div data-testid="team-drink">
    <div style={{fontSize:12,fontWeight:700,color:cr,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{w.section}</div>
    {_tH(T,w.name,[w.spirit,w.glass,w.credit&&`created by ${w.credit}`].filter(Boolean).join(' · '))}
    {c&&c.say&&<div data-testid="team-say" role="button" onClick={()=>{ TeamVoice.unlock(); TeamVoice.speak(c.say); }} style={{display:'inline-flex',alignItems:'center',gap:8,margin:'-4px 0 12px',padding:'6px 12px',borderRadius:14,border:`1px solid ${T.line}`,cursor:'pointer'}}><span style={{fontSize:14}}>🔊</span><span style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{c.say}</span></div>}
    {st&&st.total>0&&<div data-testid="team-standing" style={{fontSize:14,color:T.mid,fontFamily:C.P,marginBottom:10}}>{st.state==='known'?'You know this drink':st.state==='new'?'Not started yet':`${st.known} of ${st.total} answers held`}</div>}
    {c&&<Card style={{borderColor:_alpha(cr,0.4)}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Say it to a guest</div><div data-testid="team-pitch" style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55,marginTop:6}}>{c.pitch}</div></Card>}
    {fact&&<div data-testid="team-fact">{_tLabel(T,'One thing to know')}<Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{fact}</div></Card></div>}
    {sh.spec&&<>{_tLabel(T,"What's in it")}<Card style={{padding:'4px 14px'}} data-testid="team-spec">{(w.spec||[]).map((x,i)=><div key={i} style={{padding:'9px 0',borderTop:i?`1px solid ${T.line}`:'none',fontSize:16,color:T.ink,fontFamily:C.P}}>{x}</div>)}</Card></>}
    {c&&<>{_tLabel(T,'What it tastes like')}<Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:sh.style?12:0}}>{c.taste}</div>{sh.style&&<>{bar('sweet','Sweet')}{bar('sour','Sour')}{bar('bitter','Bitter')}{bar('strong','Strength')}</>}</Card>
      {sh.usually&&c.usually&&<div data-testid="team-usually">{_tLabel(T,'How a drink like this is usually served')}<Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{[c.usually.method,c.usually.glass,c.usually.garnish].filter(Boolean).join(' · ')}</div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:6}}>The menu doesn't say how ours is made: check with the bar.</div></Card></div>}
      {sh.story&&c.story&&<>{_tLabel(T,'The story')}<Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{c.story}</div></Card></>}
      {c.dishes&&c.dishes.length>0&&<>{_tLabel(T,'With our menu')}<Card style={{padding:0}}>{c.dishes.map((x,i)=><div key={i} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none'}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{x.dish}</div><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>{x.why}</div></div>)}</Card></>}
      {sh.alts&&c.alts&&c.alts.length>0&&<>{_tLabel(T,'Offer instead')}<Card style={{padding:0}}>{c.alts.map((a,i)=>{ const o=TeamData.wine(a.id); return o&&<div key={i} role="button" onClick={()=>open({view:'wine',id:a.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{TeamData.short(o)}</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{a.when}</div></div>; })}</Card></>}
      <Btn primary full style={{marginTop:16}} onClick={()=>open({view:'drill',only:id})}>Practise this drink</Btn></>}
    {!c&&<Card><div style={{fontSize:15,color:T.mid,fontFamily:C.P}}>This drink's card is written when the list is published.</div></Card>}
  </div>; }
/* A section of a card that folds to its title and one line, remembered per person's device (TeamFold): open by
   default for what's checked in service (the taste, the menu), folded for reference (`def`). */
function _TFold({k,title,summary,def=false,children}){ const T=useTheme(), [shut,setShut]=React.useState(()=>TeamFold.folded(k,def));
  const flip=()=>{ TeamFold.set(k,!shut); setShut(!shut); };
  return <div data-testid={'fold-'+k} data-folded={shut?'1':'0'}>
    <div role="button" aria-expanded={!shut} onClick={flip} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,cursor:'pointer',margin:'18px 0 8px'}}>
      <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>{title}</div>
      <span style={{display:'inline-flex',transform:shut?'rotate(0deg)':'rotate(90deg)',transition:'transform .2s'}}><Icon n="chevron" sz={12} col={T.mid}/></span></div>
    {shut?(summary?<div role="button" onClick={flip} style={{fontSize:14,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',cursor:'pointer',marginTop:-2}}>{summary}</div>:null):children}</div>; }
function TeamWine({id,pid,open,manage}){ const T=useTheme(), w=TeamData.wine(id), c=TeamData.card(id);
  if(TeamData.isDrink(w)) return <TeamDrink id={id} pid={pid} open={open} manage={manage}/>;
  const [editing,setEditing]=React.useState(false), [pitch,setPitch]=React.useState('');
  // No card yet: nothing on this screen writes one by itself. A manager writes this one here; anyone
  // else is told who does. A failed write says so, never a wait that doesn't end.
  const me=TeamLearn.person?TeamLearn.person(pid):null, manager=me&&TeamLearn.canConsole(me);
  // The card shows what the person's training level asks about (TeamLearn.cardShows); the console shows it all.
  const sh=TeamLearn.cardShows(manage?'high':TeamLearn.level(me&&me.role)), fact=sh.fact&&TeamLearn.cardFact(id);
  const [busy,setBusy]=React.useState(false), [err,setErr]=React.useState(''), [,bump]=React.useReducer(x=>x+1,0);
  const writeIt=async()=>{ setBusy(true); setErr(''); try{ await TeamData.writeCards([id]); if(w.vintage&&!w.peak) await TeamData.writeWindows([id]); }catch(x){ setErr(x.message||'Stopped.'); } setBusy(false); bump(); };
  if(!w) return null; const col=_tTypeCol(T,w.type);
  const bar=(k,label,v,how)=>v==null?null:<div key={k} style={{marginBottom:10}}><div style={{display:'flex',justifyContent:'space-between',fontSize:15,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:600}}>{label}</span><span style={{color:T.ink2}}>{v}/5</span></div><Prog val={v/5} col={col} h={5} style={{marginTop:5}}/>{how&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:4,lineHeight:1.4}}>{how}</div>}</div>;
  return <div data-testid="team-wine">
    <div style={{fontSize:12,fontWeight:700,color:col,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{w.section||w.type}</div>
    {_tH(T,TeamData.short(w),<span style={{display:'inline-flex',alignItems:'center',gap:6}}><span>{w.vintage||'NV'}</span><span>·</span><Flag wine={w} size={14}/><span>{[w.region,w.country].filter(Boolean).join(' · ')}</span></span>)}
    {c&&c.say&&<div data-testid="team-say" role="button" onClick={()=>{ TeamVoice.unlock(); TeamVoice.speak(TeamData.short(w),{pace:'slow'}); }} style={{display:'inline-flex',alignItems:'center',gap:8,margin:'-4px 0 12px',padding:'6px 12px',borderRadius:14,border:`1px solid ${T.line}`,cursor:'pointer'}}>
      <span style={{fontSize:14}}>🔊</span><span style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Say it:</span><span style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{c.say}</span></div>}
    {(w.glass||w.bottle)&&<div data-testid="team-price-line" style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P,marginBottom:8}}>{[w.glass&&`${w.glass} a glass`,w.bottle&&`${w.bottle} a bottle`].filter(Boolean).join(' · ')}{w.other?<span style={{fontWeight:400,color:T.mid,fontSize:14}}> · {w.other}</span>:null}</div>}
    {sh.grapes&&(w.grapes||[]).length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>{(w.grapes||[]).map(g=><span key={g}>{_tPill(T,'grape',g,col)}</span>)}</div>}
    {/* Where they stand comes first after the price: one of the two reasons to open a wine is to learn it. */}
    {c&&(()=>{ const st=TeamLearn.standing(pid,id); if(!st||!st.total) return null; const scol=st.state==='known'?T.green:st.state==='fading'?T.amber:st.state==='learning'?col:T.mid;
      const word=st.state==='known'?'You know this wine':st.state==='fading'?'Fading: a few answers are due':st.state==='learning'?`Learning: ${st.known} of ${st.total} answers held`:'Not started yet';
      return <div data-testid="team-standing" style={{margin:'4px 0 12px'}}><Card style={{borderColor:_alpha(scol,0.5)}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Where you stand</div><div style={{fontSize:14,fontWeight:700,color:scol,fontFamily:C.P}}>{word}</div></div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>{st.rungs.map(rg=><span key={rg.k} style={{fontSize:14,fontFamily:C.P,fontWeight:600,padding:'4px 10px',borderRadius:9,border:`1px solid ${rg.done?T.green:st.next&&st.next.k===rg.k?col:T.line}`,color:rg.done?T.green:st.next&&st.next.k===rg.k?T.ink:T.mid,background:rg.done?_alpha('#5FD48F',0.1):'transparent'}}>{rg.done?'✓ ':''}{rg.label}</span>)}</div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginTop:10,flexWrap:'wrap'}}>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>{st.state==='known'?`Every rung is right and fresh${st.nextDue?`; the first answer is due again ${_tDays(st.nextDue).replace('due ','')}`:''}.`:st.state==='fading'?`${st.due} answer${st.due===1?'':'s'} to refresh; a drill brings them back.`:st.next?`Next rung: ${st.next.label}.`:'Start with the first question.'}</div>
          <Btn small primary onClick={()=>open({view:'drill',only:id})}>{st.state==='new'?'Start this wine':'Practise this wine'}</Btn></div>
      </Card></div>; })()}
    {!c?<div data-testid="team-no-card"><Card>{busy?<WritingWait compact title="Writing this wine's staff card…" wine={{name:w.name,grapes:w.grapes,region:w.region}}/>:<>
        <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>No staff card yet</div>
        <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.5}}>{manager?'Write it here, or write every missing card from the Upload tab.':'Your manager writes the staff cards from the Upload tab.'}</div>
        {err&&<div data-testid="team-card-error" style={{fontSize:14,color:'#F2B84B',fontFamily:C.P,marginTop:6}}>{err}</div>}
        {manager&&<div style={{marginTop:10}}><Btn small primary onClick={writeIt}>{err?'Try again':'Write it now'}</Btn></div>}</>}</Card></div>:<>
      {c.hook&&<div data-testid="team-hook" style={{fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.35,padding:'12px 14px',borderRadius:14,border:`1px solid ${col}`,background:_alpha(col,0.1),marginBottom:10}}>{c.hook}</div>}
      <Card style={{borderColor:col+'66'}}><div style={{display:'flex',justifyContent:'space-between',gap:8}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Say it to a guest{c.edited?' · edited by a manager':''}</div>{manage&&!editing&&<span role="button" data-testid="team-pitch-edit" onClick={()=>{ setPitch(c.pitch||''); setEditing(true); }} style={{fontSize:14,fontWeight:700,color:T.lift(C.cr),fontFamily:C.P,cursor:'pointer'}}>Edit</span>}</div>
        {editing?<div style={{marginTop:6}}><textarea aria-label="What to say" value={pitch} onChange={e=>setPitch(e.target.value)} rows={4} style={{width:'100%',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:15,lineHeight:1.55,outline:'none',resize:'vertical'}}/>
          <div style={{display:'flex',gap:8,marginTop:8}}><Btn small primary onClick={()=>{ if(pitch.trim()) TeamData.setCard(id,{pitch:pitch.trim()}); setEditing(false); }}>Save</Btn><Btn small onClick={()=>setEditing(false)}>Cancel</Btn></div>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6}}>Your words replace the written line on every phone at once; the questions stay as they are.</div></div>
        :<div style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:6}}><div data-testid="team-pitch" style={{flex:1,fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.55}}>{c.pitch}</div>
          <div role="button" aria-label="Hear it said" data-testid="team-pitch-say" onClick={()=>{ TeamVoice.unlock(); TeamVoice.speak(c.pitch); }} style={{width:36,height:36,borderRadius:18,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>🔊</div></div>}</Card>
      {fact&&<div data-testid="team-fact">{_tLabel(T,'One thing to know')}<Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{fact}</div></Card></div>}
      <_TFold k="wine-taste" title="What it tastes like" summary={c.taste}><Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginBottom:sh.style?12:0}}>{c.taste}</div>
        {sh.style&&c.style&&<>{bar('b','Body',c.style.body,Palate.HOW.body)}{bar('a','Acidity',c.style.acid,Palate.HOW.acidity)}{w.type==='red'||c.style.tannin?bar('t','Tannin',c.style.tannin,Palate.HOW.tannins):null}{bar('s','Sweetness',c.style.sweet)}</>}</Card></_TFold>
      {c.dishes&&c.dishes.length>0&&<_TFold k="wine-menu" title="With our menu" summary={c.dishes.map(x=>x.dish).join(', ')}><Card style={{padding:0}}>{c.dishes.map((x,i)=>{ const dish=TeamData.dishes().find(z=>z.name===x.dish); return <div key={i} role={dish?'button':undefined} onClick={()=>dish&&open({view:'dish',id:dish.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:dish?'pointer':'default'}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{x.dish}</div><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{x.why}</div></div>; })}
        {(()=>{ const away=TeamData.dishes().filter(d=>{ const p=TeamData.pairing(d.id); return p&&p.avoid&&p.avoid.id===id; }).slice(0,1); return away.map(d=><div key={d.id} role="button" onClick={()=>open({view:'dish',id:d.id})} style={{padding:'11px 14px',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}><div style={{fontSize:16,fontWeight:600,color:T.amber,fontFamily:C.P}}>Steer away: {d.name}</div><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{TeamData.pairing(d.id).avoid.why}</div></div>); })()}
      </Card></_TFold>}
      {sh.alts&&c.alts&&c.alts.length>0&&<_TFold k="wine-alts" title="If they want something else" def summary={c.alts.map(a=>{ const o=TeamData.wine(a.id); return o&&TeamData.short(o); }).filter(Boolean).join(', ')}><Card style={{padding:0}}>{c.alts.map((a,i)=>{ const o=TeamData.wine(a.id); return o&&<div key={i} role="button" onClick={()=>open({view:'wine',id:a.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{TeamData.short(o)}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:2}}>{_tCap(a.when)}{o.glass?` · glass ${o.glass}`:o.bottle?` · bottle ${o.bottle}`:''}</div></div>; })}</Card></_TFold>}
      {sh.grape&&<div data-testid="team-grape-region"><_TFold k="wine-grape" title="Grape and region" def summary={[(w.grapes||[]).join(', '),w.region].filter(Boolean).join(' · ')}><Card style={{padding:'4px 14px'}}>{[['Grape',(w.grapes||[]).join(', ')||null,c.grape],['Region',[w.region,w.country].filter(Boolean).join(', ')||null,c.place],['Producer',w.producer||null,sh.producer&&c.producer]].filter(([,,text])=>text).map(([k,name,text],i)=><div key={k} style={{padding:'11px 0',borderTop:i?`1px solid ${T.line}`:'none'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}><span style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{k}</span>{name&&<span style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P,textAlign:'right'}}>{name}</span>}</div>
        <div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55,marginTop:4}}>{text}</div></div>)}</Card></_TFold></div>}
      {(()=>{ const dw=sh.window&&TeamData.window(w); return dw&&<div data-testid="team-window"><_TFold k="wine-life" title="Where it is in its life" def summary={dw.word}><Card>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,flexWrap:'wrap'}}><div style={{fontSize:17,fontWeight:800,fontFamily:C.P,color:dw.stage==='ready'?'#5FD48F':dw.stage==='young'?'#7FB3F0':'#F2B84B'}}>{dw.word}</div>
          {w.peak&&w.peak.rating&&<span style={{fontSize:14,fontWeight:700,fontFamily:C.P,color:T.ink,padding:'3px 9px',borderRadius:8,background:T.soft,border:`1px solid ${T.line}`}}>{w.peak.rating} vintage</span>}</div>
        <div style={{fontSize:16,color:T.ink2,fontFamily:C.P,marginTop:4}}>{dw.line}</div>
        {(()=>{ const v=w.vintage, span=Math.max(2,(dw.until-v)*1.3), yr=new Date().getFullYear(), at=x=>Math.max(0.02,Math.min(0.98,(x-v)/span))*100;
          return <div style={{position:'relative',height:10,marginTop:12,borderRadius:5,background:T.line}}>
            <div style={{position:'absolute',left:at(dw.from)+'%',width:(at(dw.to)-at(dw.from))+'%',top:0,bottom:0,borderRadius:5,background:'#5FD48F66'}}/>
            <div style={{position:'absolute',left:at(yr)+'%',top:-3,width:3,height:16,marginLeft:-1,borderRadius:2,background:T.ink}}/>
            <div style={{position:'absolute',left:0,top:14,fontSize:11,color:T.mid,fontFamily:C.P}}>{v}</div><div style={{position:'absolute',right:0,top:14,fontSize:11,color:T.mid,fontFamily:C.P}}>{dw.until+2}</div>
          </div>; })()}
        <div style={{height:14}}/>
        {w.peak&&w.peak.note&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:8,paddingTop:10,borderTop:`1px solid ${T.line}`,lineHeight:1.55}}><span style={{fontSize:12,fontWeight:700,color:T.mid,letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:4}}>Right now</span>{w.peak.note}</div>}
      </Card></_TFold></div>; })()}
      {sh.serve&&c.serve&&<_TFold k="wine-serve" title="Serving" def summary={[c.serve.temp,c.serve.glass].filter(Boolean).join(' · ')}><Card><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>{[c.serve.temp,c.serve.glass,c.serve.decant&&c.serve.decant!=='no'?`decant ${c.serve.decant}`:'no need to decant'].filter(Boolean).map(_tCap).join(' · ')}</div></Card></_TFold>}
    </>}
  </div>; }

/* The menu, each dish with its wines. */
/* Diet marks on a menu row: V, VG, GF from the menu's own diet notes, muted, after the name. */
function _tDiet(x){ const d=(x.diet||[]).map(s=>String(s).toLowerCase()); const marks=[d.some(s=>/vegan/.test(s))?'VG':d.some(s=>/vegetarian/.test(s))?'V':null,d.some(s=>/gluten/.test(s))?'GF':null].filter(Boolean);
  return marks.length?<span style={{fontSize:12,fontWeight:700,color:'#9c8f92',letterSpacing:'0.04em'}}>{marks.join(' · ')}</span>:null; }
function TeamMenu({open}){ const T=useTheme(), xs=TeamData.dishes();
  if(!xs.length) return <div>{_tH(T,'Menu','Nothing uploaded yet.')}</div>;
  const secs=[]; xs.forEach(x=>{ const s=x.section||'Menu'; let g=secs.find(y=>y.s===s); if(!g) secs.push(g={s,xs:[]}); g.xs.push(x); });
  return <div>{_tH(T,'Menu',`${xs.length} dishes, each with the wines that suit it`)}
    {secs.map(g=><div key={g.s}>{_tLabel(T,g.s)}<Card style={{padding:0}}>{g.xs.map((x,i)=>{ const p=TeamData.pairing(x.id), b=p&&p.best[0]&&TeamData.wine(p.best[0].id);
      return <div key={x.id} role="button" data-testid="team-dish-row" onClick={()=>open({view:'dish',id:x.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline'}}><div style={{display:'flex',alignItems:'baseline',gap:8,minWidth:0,flexWrap:'wrap'}}><div style={{fontSize:16,fontWeight:600,color:TeamData.isOff(x.id)?T.mid:T.ink,fontFamily:C.P,lineHeight:1.3,textDecoration:TeamData.isOff(x.id)?'line-through':'none'}}>{x.name}</div>{TeamData.isOff(x.id)&&<span data-testid="dish-off" style={{fontSize:12,fontWeight:700,color:'#F28B7D'}}>86'd</span>}{_tDiet(x)}</div>{x.price&&<div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P,flexShrink:0}}>{/^[0-9]/.test(String(x.price))?(TeamData.currency().sym||'')+x.price:x.price}</div>}</div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{b?`Best with ${TeamData.nick(b)}`:'Pairings not written yet'}</div>
      </div>; })}</Card></div>)}
  </div>; }
/* A dish's page, for a shift: what it is (the dish notes' sentence, else the menu's line), price, tonight's status, the
   allergens the kitchen confirmed (a draft is never shown as fact), what can change, what guests ask, then the wines
   with the reason first, the one to steer away from, and cocktails. Say it speaks the dish's own name slowly, so Italian
   and French names on the menu (Insalata Verde di Casa, Charcutería & Formaggi) can be heard and copied. */
function TeamDish({id,open,pid}){ const T=useTheme(), cr=T.lift(C.cr), x=TeamData.dish(id), p=TeamData.pairing(id), c=TeamData.dishCard(id);
  if(!x) return null;
  const conf=TeamData.allergensOf(id), off=TeamData.isOff(id), price=x.price?(/^[0-9]/.test(String(x.price))?(TeamData.currency().sym||'')+x.price:x.price):'';
  const row=(b,i,label,steer)=>{ const w=b&&TeamData.wine(b.id); return w&&<div key={label+i} role="button" onClick={()=>open({view:'wine',id:w.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
    <div style={{fontSize:16,fontWeight:600,color:steer?T.amber:T.ink,fontFamily:C.P,display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><Flag wine={w} size={14}/><span>{steer?'Steer away: ':''}{TeamData.short(w)}</span> <span style={{fontWeight:400,color:T.mid,fontSize:14}}>{[w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ')}</span></div>
    <div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{b.why}</div></div>; };
  const can={yes:['Yes','#5FD48F'],no:['No','#F28B7D'],ask:['Ask the kitchen','#F2B84B']};
  return <div data-testid="team-dish">
    <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>{x.section||'Menu'}{off&&<span data-testid="dish-off" style={{color:'#F28B7D',marginLeft:10}}>86'd tonight</span>}</div>
    {_tH(T,x.name,null)}
    <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',margin:'-4px 0 10px'}}>
      {price&&<span data-testid="dish-price" style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{price}</span>}
      <div data-testid="team-say" role="button" onClick={()=>{ TeamVoice.unlock(); TeamVoice.speak(x.name,{pace:'slow'}); }} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:14,border:`1px solid ${T.line}`,cursor:'pointer'}}>
        <span style={{fontSize:14}}>🔊</span><span style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>Say it</span></div></div>
    <Card style={{borderColor:_alpha(cr,0.4)}}><div data-testid="dish-say" style={{fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.5}}>{(c&&c.say)||x.desc||''}</div>
      {c&&c.say&&x.desc&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:6}}>The menu says: {x.desc}</div>}</Card>
    {/* Allergens: the kitchen's confirmed list as chips; before that, a plain line that it isn't confirmed, never the draft. */}
    <div data-testid="dish-allergens" style={{margin:'10px 0 0'}}>{conf?<div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}><span style={{fontSize:13,fontWeight:700,color:'#F28B7D',fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginRight:4}}>⚠ Allergens</span>{conf.length?conf.map(code=><span key={code} style={{display:'inline-flex',padding:'4px 10px',borderRadius:10,border:'1px solid #F28B7D88',background:_alpha('#F28B7D',0.12),color:T.ink,fontSize:14,fontWeight:600,fontFamily:C.P}}>{TeamData.allergenName(code)}</span>):<span style={{fontSize:14,color:T.ink2,fontFamily:C.P}}>None of the listed allergens, as the kitchen confirmed.</span>}</div>
      :<div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>Allergens not confirmed by the kitchen yet. If a guest asks, ask the kitchen; never guess.</div>}</div>
    {c&&(c.mods||[]).length>0&&<_TFold k="dish-mods" title="Can it change?" summary={c.mods.map(m=>_tCap(m.ask)).join(', ')}><Card style={{padding:0}}>{c.mods.map((m,i)=><div key={i} data-testid="dish-mod" style={{padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline'}}><div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{_tCap(m.ask)}</div><span style={{fontSize:13,fontWeight:700,color:(can[m.can]||can.ask)[1],fontFamily:C.P,flexShrink:0}}>{(can[m.can]||can.ask)[0]}</span></div>
      <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{m.say}</div></div>)}</Card></_TFold>}
    {c&&(c.ask||[]).length>0&&<_TFold k="dish-ask" title="Guests ask" def summary={c.ask.map(a=>a.q).join(' · ')}><Card style={{padding:0}}>{c.ask.map((a,i)=><div key={i} data-testid="dish-ask" style={{padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none'}}>
      <div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>"{a.q}"</div><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{a.a}</div></div>)}</Card></_TFold>}
    {!p?<Card style={{marginTop:12}}><div style={{fontSize:15,color:T.mid,fontFamily:C.P}}>Pairings are written once the wine list is uploaded.</div></Card>:<>
      <_TFold k="dish-pour" title="Pour with it" summary={p.best.map(b=>{ const w=TeamData.wine(b.id); return w&&TeamData.short(w); }).filter(Boolean).join(', ')}><Card style={{padding:0}}>{p.best.map((b,i)=>row(b,i,'b'))}{p.glass&&!p.best.some(b=>b.id===p.glass.id)&&row(p.glass,p.best.length,'g')}{p.avoid&&row(p.avoid,p.best.length+1,'a',true)}</Card></_TFold>
    </>}
    {(()=>{ const ms=TeamData.cocktailsFor(x.name); return ms.length>0&&<div data-testid="team-dish-cocktails"><_TFold k="dish-cocktails" title="Cocktails with it" summary={ms.map(m=>m.cocktail.name).join(', ')}><Card style={{padding:0}}>{ms.map((m,i)=><div key={m.cocktail.id} role="button" onClick={()=>open({view:'cocktail',id:m.cocktail.id})} style={{padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
      <div style={{fontSize:16,fontWeight:600,color:T.ink,fontFamily:C.P}}>{m.cocktail.name} <span style={{fontWeight:400,color:T.mid,fontSize:14}}>{m.cocktail.price}</span></div><div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.45}}>{m.why}</div></div>)}</Card></_TFold></div>; })()}
    {pid&&TeamLearn.dishQs(id).length>0&&<Btn primary full style={{marginTop:16}} onClick={()=>open({view:'drill',only:id})}>Practise this dish</Btn>}
  </div>; }

/* Reads a photo (resized as the consumer app's list scan does, 1600px) or a PDF as base64. */
function _tReadFile(file){ return new Promise((res,rej)=>{ const fr=new FileReader();
  if(/pdf$/i.test(file.type)||/\.pdf$/i.test(file.name)){ fr.onload=()=>res({kind:'pdf',data:String(fr.result).split(',')[1]}); fr.onerror=rej; fr.readAsDataURL(file); return; }
  fr.onload=()=>{ const img=new Image(); img.onload=()=>{ const max=1600, k=Math.min(1,max/Math.max(img.width,img.height)), cv=document.createElement('canvas');
    cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k); cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    res({kind:'image',data:cv.toDataURL('image/jpeg',0.85).split(',')[1]}); }; img.onerror=rej; img.src=fr.result; };
  fr.onerror=rej; fr.readAsDataURL(file); }); }

/* Upload a list or menu, review what changed, publish, and watch the training get written. */
function TeamUpload({onChanged,background}){ const T=useTheme(), cr=T.lift(C.cr), job=useTeamJob();
  const [stage,setStage]=React.useState(()=>TeamData.get().draft?'review':'idle'), [kind,setKind]=React.useState(()=>(TeamData.get().draft||{}).kind||'list');
  const [prog,setProg]=React.useState(null), [err,setErr]=React.useState(''), [diff,setDiff]=React.useState(()=>TeamData.diff());
  const fileRef=React.useRef(null), labelRef=React.useRef(null), pend=TeamData.pending();
  const [found,setFound]=React.useState(null); // a bottle read from its label, before it joins the draft
  const onLabel=async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
    setStage('reading'); setErr(''); setProg({label:'Reading the label',a:0,b:1});
    try{ const {data}=await _tReadFile(f); const w=await TeamData.readLabel(data); if(!w) throw new Error('No wine label found in that photo. Try again with the label filling the frame.');
      setFound({...w,section:TeamData._sectionFor(w.type)}); setStage('found'); }
    catch(x){ setErr(x.message||'We couldn\'t read that label.'); setStage('idle'); } };
  const addFound=()=>{ const {prepared,photo,confidence,...item}=found; setDiff(TeamData.draftAdd(item)); setFound(null); setStage('review'); };
  // The demo's prepared arrivals (TeamSample.ARRIVALS): the label already read, the training written ahead.
  const arrivals=TeamData.isDemo()?TeamSample.ARRIVALS():[];
  const pickPrepared=a=>{ setErr(''); setFound({...a.label,section:TeamData._sectionFor(a.label.type),prepared:a.key,photo:a.photo}); setStage('found'); };
  const readLive=async()=>{ setStage('reading'); setErr(''); setProg({label:'Reading the label',a:0,b:1});
    try{ const r=await fetch(found.photo), blob=await r.blob(), {data}=await _tReadFile(new File([blob],'label.jpg',{type:'image/jpeg'})); const w=await TeamData.readLabel(data); if(!w) throw new Error('No wine label found in that photo.');
      setFound({...w,section:TeamData._sectionFor(w.type)}); setStage('found'); }
    catch(x){ setErr(x.message||'We couldn\'t read that label.'); setStage('idle'); } };
  const pick=k=>{ setKind(k); setErr(''); fileRef.current&&fileRef.current.click(); };
  const appendRef=React.useRef(false);
  const onFiles=async e=>{ const fs=[...(e.target.files||[])]; e.target.value=''; if(!fs.length) return;
    const append=appendRef.current; appendRef.current=false;
    setStage('reading'); setErr('');
    try{ const files=await Promise.all(fs.map(_tReadFile)); const d=await TeamData.read(kind,files,(a,b)=>setProg({label:`Reading your ${kind==='list'?'wine list':'menu'}`,a,b}),{append});
      setDiff(d); setStage('review'); }
    catch(x){ setErr(x.message||'We couldn\'t read that. Try a sharper photo or the PDF.'); setStage('idle'); } };
  // With `background` (the console, and the phone when asked) the writing runs as a TeamJobs job: the
  // screen is free at once and the chip says where it is; otherwise the screen waits on it, as before.
  const publish=async()=>{ const res=TeamData.publish(); setErr('');
    if(background){ TeamJobs.start(res); setStage('idle'); onChanged&&onChanged(); return; }
    setStage('writing');
    try{ await TeamData.refresh(res,(label,a,b)=>setProg({label,a,b})); setStage('done'); }
    catch(x){ setErr((x.message||'Writing the training stopped.')+' What was written is kept; carry on below.'); setStage('idle'); }
    onChanged&&onChanged(); };
  const resume=async()=>{ setErr(''); const res={kind:'list',added:[],removed:[],changed:[],notes:pend.dishNotes>0};
    if(background){ TeamJobs.start(res,{label:'Writing what was missing'}); onChanged&&onChanged(); return; }
    setStage('writing');
    try{ await TeamData.refresh(res,(label,a,b)=>setProg({label,a,b})); setStage('done'); }catch(x){ setErr(x.message||'Stopped again.'); setStage('idle'); } onChanged&&onChanged(); };
  const secs=[...new Set(TeamData.wines().map(w=>w.section).filter(Boolean))];
  const fld={padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none',minWidth:0};
  const sec=(t,items,render)=>items.length>0&&<>{_tLabel(T,`${t} (${items.length})`)}<Card style={{padding:0}}>{items.slice(0,40).map((x,i)=><div key={i} style={{padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none',fontSize:14,color:T.ink2,fontFamily:C.P}}>{render(x)}</div>)}{items.length>40&&<div style={{padding:'10px 14px',fontSize:14,color:T.mid,fontFamily:C.P}}>and {items.length-40} more</div>}</Card></>;
  const wl=w=>`${TeamData.label(w)}${w.glass?` · glass ${w.glass}`:''}${w.bottle?` · bottle ${w.bottle}`:''}`;
  return <div data-testid="team-upload">
    <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple onChange={onFiles} data-testid="team-file" style={{display:'none'}}/>
    {(stage==='idle'||stage==='done')&&<>
      {_tH(T,'Upload','A photo or PDF of your wine list or menu. Several photos for a long list. Nothing reaches your staff until you approve what changed.')}
      {stage==='done'&&<Card style={{marginBottom:12,borderColor:'#5FD48F66'}}><div data-testid="team-published" style={{fontSize:15,color:'#5FD48F',fontWeight:700,fontFamily:C.P}}>Published. Your staff's training is up to date.</div></Card>}
      {err&&<Card style={{marginBottom:12,borderColor:'#F28B7D66'}}><div style={{fontSize:14,color:'#F28B7D',fontFamily:C.P}}>{err}</div></Card>}
      {(pend.cards>0||pend.pairings>0||pend.windows>0||pend.dishNotes>0)&&!(job&&job.running)&&<Card style={{marginBottom:12}}><div data-testid="team-pending" style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginBottom:8}}>{[pend.cards&&`${pend.cards} wine${pend.cards===1?'':'s'} without a staff card`,pend.pairings&&`${pend.pairings} dish${pend.pairings===1?'':'es'} without pairings`,pend.dishNotes&&`${pend.dishNotes} dish${pend.dishNotes===1?'':'es'} without notes (what it is, allergens to confirm, what can change)`,pend.windows&&`${pend.windows} drinking window${pend.windows===1?'':'s'} to check`].filter(Boolean).join(', ')}.</div><Btn small onClick={resume}>Write them now</Btn></Card>}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        <Card onClick={()=>pick('list')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="wine" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Wine list</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{TeamData.wines().length?`${TeamData.wines().length} wines live. Upload the new one to update it.`:'Your full list, by the glass and by the bottle.'}</div></div></Card>
        <Card onClick={()=>pick('menu')} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="fork" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Menu</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{TeamData.dishes().length?`${TeamData.dishes().length} dishes live.`:'So every wine is paired with your dishes.'}</div></div></Card>
        {TeamData.wines().length>0&&<Card onClick={()=>labelRef.current&&labelRef.current.click()} style={{cursor:'pointer',display:'flex',gap:12,alignItems:'center'}}><Icon n="camera" sz={22} col={cr}/><div><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Add a wine from its label</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>A new arrival: photograph the bottle and it joins the list, with its card, pairings and drinking window.</div></div></Card>}
        <input ref={labelRef} type="file" accept="image/*" capture="environment" onChange={onLabel} data-testid="team-label-file" style={{display:'none'}}/>
        {arrivals.length>0&&TeamData.wines().length>0&&<div data-testid="team-arrivals"><Card><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>New arrivals, prepared for the demo</div>
          <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>Two real bottles read ahead, their card, pairings and drinking window written: they publish in seconds with no connection. Any other bottle goes through the live reading above.</div>
          <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>{arrivals.map(a=>{ const cur=TeamData.wine(TeamData.wineId(a.label)), onList=!!cur&&cur.onList&&cur.vintage===a.label.vintage;
            return <div key={a.key} role="button" data-testid="team-arrival" aria-disabled={onList} onClick={()=>!onList&&pickPrepared(a)} style={{flex:'1 1 150px',display:'flex',gap:10,alignItems:'center',padding:8,borderRadius:12,border:`1px solid ${T.line}`,opacity:onList?0.5:1,cursor:onList?'default':'pointer'}}>
              <img src={a.photo} alt="" width={44} height={60} style={{width:44,height:60,objectFit:'cover',borderRadius:6,flexShrink:0}}/>
              <div style={{minWidth:0}}><div style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.25}}>{[a.label.producer,a.label.name].filter(Boolean).join(' ')}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{onList&&a.kind!=='changed'?'Already on the list':[a.label.vintage,a.label.region,a.kind==='changed'?'a new vintage of one on the list':'new to the list'].filter(Boolean).join(' · ')}</div></div></div>; })}</div></Card></div>}
      </div>
      {TeamData.wines().length>0&&<div role="button" data-testid="team-export" onClick={()=>TeamData.exportFile()} style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:18,cursor:'pointer',textDecoration:'underline'}}>Export this restaurant's list, menu and training as a file</div>}
      </>}
    {stage==='found'&&found&&<div data-testid="team-found">
      {_tH(T,'New arrival',found.prepared?'Read from the label ahead of the demo; its training is already written. Set where it sits on the list and its prices, then add it.':`Read from the label${found.confidence!=='high'?', check it':''}. Set where it sits on the list and its prices, then add it.`)}
      <Card><div style={{display:'flex',flexDirection:'column',gap:8}}>
        {found.photo&&<div style={{display:'flex',gap:10,alignItems:'center'}}><img src={found.photo} alt="" width={56} height={76} style={{width:56,height:76,objectFit:'cover',borderRadius:8}}/><div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>Prepared for the demo. <span role="button" data-testid="team-read-live" onClick={readLive} style={{color:cr,fontWeight:700,cursor:'pointer'}}>Read this label live instead</span> to show the real scan (needs a connection, about ten seconds).</div></div>}
        <div style={{display:'flex',gap:8}}><input aria-label="Producer" value={found.producer} onChange={e=>setFound({...found,producer:e.target.value})} placeholder="Producer" style={{...fld,flex:1}}/><input aria-label="Vintage" value={found.vintage||''} onChange={e=>setFound({...found,vintage:/^\d{4}$/.test(e.target.value)?+e.target.value:null})} placeholder="Year" style={{...fld,width:90}}/></div>
        <input aria-label="Wine" value={found.name} onChange={e=>setFound({...found,name:e.target.value})} placeholder="Wine" style={fld}/>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{[found.type,found.region,found.country,(found.grapes||[]).join(', ')].filter(Boolean).join(' · ')}</div>
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
  // The same Team as the console's (team-console.jsx): Add someone in the header opening the dialog, the people with
  // how far behind their plan they are, then the training level and the minimums, laid out for a phone.
  const [adding,setAdding]=React.useState(false), [,bump]=React.useReducer(x=>x+1,0);
  const changed=()=>{ bump(); onChanged&&onChanged(); };
  const ppl=TeamLearn.people(), weak=TeamLearn.weakWines().filter(x=>x.of>0).slice(0,8), ret=TeamLearn.retention(null);
  const counts={ready:0,slipping:0,not:0}; ppl.forEach(p=>{ const r=TeamLearn.readiness(p.id); if(r) counts[r.state]++; });
  return <div data-testid="team-people">
    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:10}}>{_tH(T,'Your team',`${counts.ready} ready, ${counts.slipping} slipping, ${counts.not} not ready yet`)}
      <span data-testid="console-add-person" style={{flexShrink:0,marginTop:2}}><Btn primary small onClick={()=>setAdding(true)}>+ Add</Btn></span></div>
    <Card style={{padding:0}}>{ppl.map((p,i)=>{ const r=TeamLearn.readiness(p.id), st=_tState[r.state];
      return <div key={p.id} role="button" data-testid="team-person" onClick={()=>{ TeamLearn.setMe(p.id); onChanged&&onChanged(); open({tab:'today'}); }} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <TeamFace person={p} size={44} ring={st.col}/>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P}}>{p.name}</div><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{TeamLearn.ROLES[p.role].label}{r.behind?<span style={{color:T.tone.bad}}> · {r.behind} day{r.behind===1?'':'s'} behind</span>:''}</div></div>
        <div style={{textAlign:'right'}}><div style={{fontSize:15,fontWeight:800,color:st.col,fontFamily:C.P}}>{r.pct}%</div><div style={{fontSize:14,color:st.col,fontFamily:C.P}}>{st.label}</div></div>
      </div>; })}</Card>
    <div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:8}}>In the pilot everyone trains on this device: tap a name to train as them.</div>
    <TeamLevelCard changed={changed}/>
    <TeamMinimumsCard changed={changed}/>
    {weak.length>0&&<>{_tLabel(T,'Wines the floor knows least')}<Card style={{padding:0}}>{weak.map((x,i)=><div key={x.wine.id} role="button" onClick={()=>open({view:'wine',id:x.wine.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
      <div style={{flex:1,minWidth:0,fontSize:14,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{TeamData.short(x.wine)}</div><div style={{fontSize:14,color:x.share<0.5?'#F28B7D':T.mid,fontFamily:C.P}}>{x.knows} of {x.of} know it</div></div>)}</Card></>}
    {ret.asked>0&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:10}}>Surprise re-checks this month: {Math.round(100*ret.rate)}% remembered ({ret.right} of {ret.asked}).</div>}
    {adding&&<_CAddPerson close={()=>setAdding(false)} done={()=>{ setAdding(false); changed(); }}/>}
  </div>; }

Object.assign(window,{TeamTonightCard,TeamTonightEdit,TeamFace,TeamVenueLogo,TeamCocktail,TeamCocktailList,TeamRing,TeamSetup,TeamToday,TeamDrill,TeamWines,TeamWine,TeamMenu,TeamDish,TeamUpload,TeamPeople,TeamJobChip,TeamKpiStrip,useTeamJob});
