/* Vinny in the staff app (team-vinny.js has the logic): the Vinny tab, with Ask Vinny at the top,
   Vinny's test (a drill aimed at what this person needs, or at what they ask for) and a guest at a
   table to practise on. The test opens the ordinary drill with its questions; the guest is its own view. */

/* The Vinny badge, as on the consumer app's Ask Vinny bar. */
function TeamVinnyMark({size=28}){ return <div aria-hidden="true" style={{width:size,height:size,borderRadius:size/2,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:Math.round(size*0.47)+'px',fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1}}>V</span></div>; }

/* The chips under an answer: the wines and dishes it named, each opening its card. */
function _TVChips({wines,dishes,open}){ const T=useTheme();
  const items=[...(wines||[]).map(id=>({id,kind:'wine',x:TeamData.wine(id)})),...(dishes||[]).map(id=>({id,kind:'dish',x:TeamData.dish(id)}))].filter(i=>i.x);
  if(!items.length) return null;
  return <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:8}}>{items.map(i=><div key={i.kind+i.id} role="button" data-testid="vinny-chip" onClick={()=>open({view:i.kind,id:i.id})} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 10px',borderRadius:14,border:`1px solid ${i.kind==='wine'?_tTypeCol(T,i.x.type):T.line}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer'}}>
    <Icon n={i.kind==='wine'?'wine':'fork'} sz={13} col={i.kind==='wine'?_tTypeCol(T,i.x.type):T.mid}/>{i.kind==='wine'?TeamData.short(i.x):i.x.name}</div>)}</div>; }

function TeamVinnyTab({pid,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const [q,setQ]=React.useState(''), [turns,setTurns]=React.useState([]), [busy,setBusy]=React.useState(false), [ask,setAsk]=React.useState('');
  const sugg=React.useMemo(()=>TeamVinny.suggestions(),[]), recent=TeamVinny.recent();
  const empty=!TeamData.wines().length;
  const test=React.useMemo(()=>empty?null:TeamVinny.test(pid),[pid,empty]);
  const send=async(text)=>{ const t=String(text||q).trim(); if(!t||busy) return; setQ(''); setBusy(true);
    const prior=turns; setTurns(ts=>[...ts,{q:t}]);
    try{ const r=await TeamVinny.ask(t,prior); setTurns(ts=>ts.map((x,i)=>i===ts.length-1?{...x,a:r.answer,wines:r.wines,dishes:r.dishes}:x)); }
    catch(e){ setTurns(ts=>ts.map((x,i)=>i===ts.length-1?{...x,err:(e&&e.message)||'Couldn\'t reach Vinny.'}:x)); }
    setBusy(false); };
  const startTest=(t)=>{ if(!t||!t.qs.length) return; open({view:'drill',qs:t.qs,intro:{title:t.title,why:t.why}}); };
  const asked=ask.trim()?TeamVinny.test(pid,{ask}):null;
  const field=<input data-testid="vinny-input" value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about the list, a bottle or the menu" aria-label="Ask Vinny" style={{position:'absolute',inset:0,width:'100%',background:'transparent',border:'none',outline:'none',color:'#fff',fontSize:'15px',fontFamily:C.P}}/>;
  return <div data-testid="team-vinny">
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:6}}><TeamVinnyMark size={40}/>
      <div><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>Vinny</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:2}}>Your sommelier on shift, for {TeamData.get().venue.name||'your restaurant'}</div></div></div>
    {empty?<Card style={{marginTop:10}}><div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>Vinny works from your wine list and menu. Once they're uploaded, ask anything about them here.</div></Card>:<>
    {_tLabel(T,'Ask Vinny')}
    <VinnyBar field={field} hasText={!!q} canSend={!!q.trim()&&!busy} onSubmit={()=>send()} onClear={()=>setQ('')}/>
    {!turns.length&&<div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:10}}>{[...recent,...sugg].filter((x,i,a)=>a.indexOf(x)===i).slice(0,6).map(s=><div key={s} role="button" data-testid="vinny-sugg" onClick={()=>send(s)} style={{padding:'6px 12px',borderRadius:14,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer'}}>{s}</div>)}</div>}
    {turns.length>0&&<div data-testid="vinny-answers"><Card style={{marginTop:10,display:'flex',flexDirection:'column',gap:14}}>
      {turns.map((t,i)=><div key={i}>
        <div style={{fontSize:14,fontWeight:600,color:T.mid,fontFamily:C.P}}>{t.q}</div>
        {t.err?<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,marginTop:4}}>{t.err} Try again.</div>
          :t.a?<><div data-testid="vinny-answer" style={{fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.5,marginTop:4}}>{t.a}</div><_TVChips wines={t.wines} dishes={t.dishes} open={open}/></>
          :<div style={{fontSize:15,color:T.mid,fontFamily:C.P,marginTop:4}}>Thinking…</div>}
      </div>)}
      <div role="button" onClick={()=>setTurns([])} style={{fontSize:13,fontWeight:600,color:T.mid,fontFamily:C.P,cursor:'pointer',alignSelf:'flex-start'}}>Clear</div>
    </Card></div>}

    {_tLabel(T,'Vinny\'s test')}
    <div data-testid="vinny-test"><Card>
      <div style={{fontSize:17,fontWeight:800,color:T.ink,fontFamily:C.P}}>{test&&!test.none?`${test.qs.length} questions on what you need`:'Nothing to test yet'}</div>
      <div data-testid="vinny-test-why" style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:4}}>{test?test.why:''}</div>
      {test&&!test.none&&<Btn primary full style={{marginTop:12}} onClick={()=>startTest(test)}>Start Vinny's test</Btn>}
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,margin:'14px 0 6px'}}>Or ask for one: "the reds under £50", "the dessert wines", "the menu", "what's new"</div>
      <div style={{display:'flex',gap:8}}>
        <input data-testid="vinny-test-ask" value={ask} onChange={e=>setAsk(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&asked) startTest(asked); }} placeholder="Test me on…" aria-label="Test me on" style={{flex:1,minWidth:0,height:42,borderRadius:10,border:`1px solid ${T.line}`,background:'transparent',color:T.ink,padding:'0 12px',fontSize:'15px',fontFamily:C.P,outline:'none'}}/>
        <Btn onClick={()=>asked&&startTest(asked)} style={{opacity:asked&&!asked.none?1:0.45}}>Go</Btn>
      </div>
      {asked&&<div data-testid="vinny-test-asked" style={{fontSize:13,color:asked.none?'#F28B7D':T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>{asked.none?asked.why:`${asked.qs.length} questions: ${asked.why}`}</div>}
    </Card></div>

    {_tLabel(T,'A guest at your table')}
    <div data-testid="vinny-guest-card"><Card>
      <div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>Vinny plays a guest ordering from your menu, with a budget, a taste or a wrong idea. Answer as you would at the table; Vinny tells you how it landed and what you could have said.</div>
      <Btn primary full style={{marginTop:12}} onClick={()=>open({view:'guest'})}>Take a table</Btn>
    </Card></div>
    </>}
  </div>; }

/* A guest at the table: the guest's lines, the server's typed replies, then the mark. How much help they get
   (choices, hints or none) is TeamVinny's step for this person; they can change it here. */
const _GUEST_HELP={choices:'Pick the wine, then the reason, and Vinny puts it into words you can change.',hints:'Ask for a hint when you need one, up to three.',own:'No help: answer as you would at the table.'};
function _GuestHelpSwitch({level,onPick}){ const T=useTheme(), cr=T.lift(C.cr);
  return <div data-testid="guest-help" style={{marginBottom:12}}>
    <div role="radiogroup" aria-label="Help at the table" style={{display:'flex',gap:4,padding:3,borderRadius:12,border:`1px solid ${T.line}`,background:T.soft}}>
      {TeamVinny.LEVELS.map(k=><div key={k} role="radio" aria-checked={level===k} data-testid={`guest-help-${k}`} onClick={()=>onPick(k)}
        style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:9,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:C.P,background:level===k?cr:'transparent',color:level===k?'#fff':T.mid}}>{TeamVinny.LEVEL_LABEL[k]}</div>)}
    </div>
    <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>{_GUEST_HELP[level]}</div>
  </div>; }
// Choices: three wines, then three reasons; a wrong pick says why and stays open to try again.
function _GuestChoices({help,onSay}){ const T=useTheme(), cr=T.lift(C.cr);
  const [tried,setTried]=React.useState([]), [wine,setWine]=React.useState(null), [rTried,setRTried]=React.useState([]), [done,setDone]=React.useState(false);
  const row=(key,label,sub,state,onClick,testid)=><div key={key} role="button" data-testid={testid} data-ok={state==='ok'?'1':undefined} onClick={state?undefined:onClick}
    style={{padding:'10px 12px',borderRadius:12,border:`1px solid ${state==='ok'?T.green:state==='no'?_alpha('#F28B7D',0.6):T.line}`,background:state==='ok'?_alpha('#5FD48F',0.1):'transparent',cursor:state?'default':'pointer',opacity:state==='no'?0.75:state==='off'?0.5:1}}>
    <div style={{fontSize:15,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.4}}>{state==='ok'?'✓ ':state==='no'?'✗ ':''}{label}</div>
    {sub&&<div style={{fontSize:13,color:state==='no'?'#F28B7D':T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>;
  if(!help.wines.length) return null;
  return <div data-testid="guest-choices"><Card style={{marginTop:12}}>
    <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>1 · Which wine?</div>
    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>{help.wines.map(o=>{ const w=TeamData.wine(o.id); if(!w) return null;
      const st=wine===o.id?'ok':tried.includes(o.id)?'no':null, price=[w.glass&&`glass ${w.glass}`,w.bottle&&`bottle ${w.bottle}`].filter(Boolean).join(' · ');
      return row(o.id,TeamData.short(w),st==='no'?o.note:price,wine&&!st?'off':st,()=>{ if(wine) return; o.ok?setWine(o.id):setTried(t=>[...t,o.id]); },'guest-choice'); })}</div>
    {wine&&help.reasons.length>0&&<>
      <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',marginTop:14}}>2 · Why does it suit?</div>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>{help.reasons.map((r,i)=>{ const st=done&&r.ok?'ok':rTried.includes(i)?'no':null;
        return row(i,r.text,st==='no'?'That reason is about another dish on the menu.':'',done&&!st?'off':st,()=>{ if(done) return; if(r.ok){ setDone(true); onSay(help.say(wine,r.text)); } else setRTried(t=>[...t,i]); },'guest-reason'); })}</div></>}
    {done&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:12,lineHeight:1.45}}>Your reply is ready below. Put it in your own words if you like, then Say.</div>}
  </Card></div>; }
function TeamGuest({pid,back,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const [sc,setSc]=React.useState(()=>TeamVinny.scenario(pid)), [turns,setTurns]=React.useState([]), [mark,setMark]=React.useState(null);
  const [say,setSay]=React.useState(''), [busy,setBusy]=React.useState(false), [err,setErr]=React.useState('');
  const [level,setLevel]=React.useState(()=>TeamVinny.level(pid)), [hints,setHints]=React.useState(0), [moved,setMoved]=React.useState(null);
  const endRef=React.useRef(null), levelRef=React.useRef(level), hintsRef=React.useRef(0);
  levelRef.current=level; hintsRef.current=hints;
  const step=async(ts)=>{ setBusy(true); setErr('');
    try{ const r=await TeamVinny.guest(sc,ts); const next=r.line?[...ts,{who:'guest',text:r.line}]:ts; setTurns(next);
      if(r.done){ const m=r.mark||{score:0,verdict:'',good:'',missing:'',better:''}; setMark(m);
        setMoved(TeamVinny.noteTable(pid,{level:levelRef.current,score:m.score,hints:hintsRef.current})); } }
    catch(e){ setErr((e&&e.message)||'Couldn\'t reach Vinny.'); }
    setBusy(false); };
  React.useEffect(()=>{ if(sc&&!turns.length) step([]); },[sc]);
  React.useEffect(()=>{ try{ endRef.current&&endRef.current.scrollIntoView({block:'end',behavior:'smooth'}); }catch(e){} },[turns.length,mark,busy,hints]);
  if(!sc) return <div>{_tH(T,'No table yet','A guest needs a menu with pairings. Once the menu is published, Vinny can play one.')}<Btn full onClick={back}>Back</Btn></div>;
  const reply=()=>{ const t=say.trim(); if(!t||busy||mark) return; setSay(''); const ts=[...turns,{who:'you',text:t}]; setTurns(ts); step(ts); };
  const again=()=>{ setSc(TeamVinny.scenario(pid,Date.now())); setTurns([]); setMark(null); setSay(''); setHints(0); setMoved(null); setLevel(TeamVinny.level(pid)); };
  const pick=(k)=>{ TeamVinny.setLevel(pid,k); setLevel(k); };
  const yours=turns.filter(t=>t.who==='you').length, open1=!mark&&turns.length>0&&!busy;
  const verdict=mark?(mark.verdict||(mark.score>=0.67?'right':mark.score>=0.34?'partly':'wrong')):'', vcol=verdict==='right'?'#5FD48F':verdict==='partly'?'#F2B84B':'#F28B7D';
  const helpUsed=level==='choices'?'With choices':level==='hints'?(hints?`With ${hints} hint${hints===1?'':'s'}`:'No hints used'):'On your own';
  const movedLine=moved&&moved.moved==='up'?(moved.level==='hints'?'Two tables in a row. Next table: no choices, just hints when you ask.':'Two tables in a row. Next table: on your own.')
    :moved&&moved.moved==='down'?(moved.level==='choices'?'Next table comes with choices again, to steady it.':'Next table comes with hints again.'):'';
  return <div data-testid="team-guest">
    {_tH(T,'A guest at your table',`They're having the ${sc.dishName}. Answer as you would at the table.`)}
    {!mark&&yours===0&&<_GuestHelpSwitch level={level} onPick={pick}/>}
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {turns.map((t,i)=>t.who==='guest'
        ?<div key={i} data-testid="guest-line" style={{display:'flex',gap:10,alignItems:'flex-start'}}><TeamVinnyMark size={28}/><div style={{background:T.glass,border:`1px solid ${T.line}`,borderRadius:'4px 16px 16px 16px',padding:'10px 14px',fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.45,maxWidth:'85%'}}>{t.text}</div></div>
        :<div key={i} data-testid="you-line" style={{alignSelf:'flex-end',background:T.soft,border:`1px solid ${cr}`,borderRadius:'16px 4px 16px 16px',padding:'10px 14px',fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.45,maxWidth:'85%'}}>{t.text}</div>)}
      {busy&&<div style={{display:'flex',gap:10,alignItems:'center'}}><TeamVinnyMark size={28}/><span style={{fontSize:14,color:T.mid,fontFamily:C.P}}>…</span></div>}
      {err&&<div style={{fontSize:14,color:'#F28B7D',fontFamily:C.P}}>{err} <span role="button" onClick={()=>step(turns)} style={{fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>Try again</span></div>}
    </div>
    {open1&&level==='choices'&&yours===0&&<_GuestChoices key={sc.seed} help={sc.help} onSay={setSay}/>}
    {open1&&level==='hints'&&<div data-testid="guest-hints" style={{marginTop:12}}>
      {sc.help.hints.slice(0,hints).map((h,i)=><div key={i} data-testid="guest-hint" style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,padding:'8px 12px',borderLeft:`3px solid ${T.amber}`,background:_alpha('#F2B84B',0.08),borderRadius:'0 10px 10px 0',marginBottom:6}}>{h}</div>)}
      {hints<sc.help.hints.length&&<div role="button" data-testid="guest-hint-btn" onClick={()=>setHints(n=>n+1)} style={{display:'inline-block',fontSize:13,fontWeight:700,color:T.amber,fontFamily:C.P,cursor:'pointer',padding:'4px 0'}}>{hints?'Another hint':'Give me a hint'} ({hints+1} of {sc.help.hints.length})</div>}
    </div>}
    {mark&&<div data-testid="guest-mark"><Card style={{marginTop:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
        <div style={{fontSize:17,fontWeight:800,color:vcol,fontFamily:C.P}}>{verdict==='right'?'That landed':verdict==='partly'?'Nearly':'Not quite'}</div>
        <div data-testid="guest-help-used" style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P}}>{helpUsed}</div></div>
      {mark.good&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:6,lineHeight:1.5}}><b style={{color:'#5FD48F'}}>Good: </b>{mark.good}</div>}
      {mark.missing&&<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:4,lineHeight:1.5}}><b style={{color:'#F2B84B'}}>Missing: </b>{mark.missing}</div>}
      {mark.better&&<div style={{fontSize:15,color:T.ink,fontFamily:C.P,marginTop:10,lineHeight:1.5,borderLeft:`3px solid ${cr}`,paddingLeft:12}}>{mark.better}</div>}
      {movedLine&&<div data-testid="guest-moved" style={{fontSize:14,fontWeight:600,color:moved.moved==='up'?'#5FD48F':T.ink2,fontFamily:C.P,marginTop:12,lineHeight:1.45}}>{movedLine}</div>}
      <_TVChips wines={sc.wines} dishes={[sc.dish]} open={open}/>
      <div style={{display:'flex',gap:8,marginTop:14}}><Btn primary style={{flex:1}} onClick={again}>Another table</Btn><Btn style={{flex:1}} onClick={back}>Done</Btn></div>
    </Card></div>}
    {!mark&&turns.length>0&&<div style={{display:'flex',gap:8,marginTop:14,alignItems:'flex-end'}}>
      <textarea data-testid="guest-reply" value={say} onChange={e=>setSay(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); reply(); } }} rows={level==='choices'&&say?3:2} placeholder="What do you say?" aria-label="Your reply" style={{flex:1,minWidth:0,borderRadius:12,border:`1px solid ${T.line}`,background:'transparent',color:T.ink,padding:'10px 12px',fontSize:'15px',fontFamily:C.P,resize:'none',outline:'none'}}/>
      <Btn primary onClick={reply} style={{opacity:say.trim()&&!busy?1:0.45}}>Say</Btn>
    </div>}
    <div ref={endRef}/>
  </div>; }

Object.assign(window,{TeamVinnyTab,TeamGuest,TeamVinnyMark});
