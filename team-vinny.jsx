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
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,margin:'14px 0 6px'}}>Or ask for one: "the reds under {TeamData.currency().sym||'£'}50", "the dessert wines", "the menu", "what's new"</div>
      <div style={{display:'flex',gap:8}}>
        <input data-testid="vinny-test-ask" value={ask} onChange={e=>setAsk(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&asked) startTest(asked); }} placeholder="Test me on…" aria-label="Test me on" style={{flex:1,minWidth:0,height:42,borderRadius:10,border:`1px solid ${T.line}`,background:'transparent',color:T.ink,padding:'0 12px',fontSize:'15px',fontFamily:C.P,outline:'none'}}/>
        <Btn onClick={()=>asked&&startTest(asked)} style={{opacity:asked&&!asked.none?1:0.45}}>Go</Btn>
      </div>
      {asked&&<div data-testid="vinny-test-asked" style={{fontSize:13,color:asked.none?'#F28B7D':T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>{asked.none?asked.why:`${asked.qs.length} questions: ${asked.why}`}</div>}
    </Card></div>

    {_tLabel(T,'A guest at your table')}
    <div data-testid="vinny-guest-card"><Card>
      <div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>Vinny plays a guest ordering from your menu, with a budget, a taste or a wrong idea. Answer as you would at the table; Vinny tells you how it landed and what you could have said.</div>
      <Btn primary full style={{marginTop:12}} onClick={()=>{ TeamVoice.unlock(); open({view:'guest'}); }}>Take a table</Btn>
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
/* Replies to pick from for a guest's follow-up: a weaker one says why and stays crossed out; the right one fills the box. */
function _GuestReplies({replies,onSay}){ const T=useTheme(), [tried,setTried]=React.useState([]), [done,setDone]=React.useState(-1);
  return <div data-testid="guest-replies"><Card style={{marginTop:12}}>
    <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>What do you say?</div>
    <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:8}}>{replies.map((r,i)=>{ const st=done===i?'ok':tried.includes(i)?'no':done>=0?'off':null;
      return <div key={i} role="button" data-testid="guest-follow" data-ok={st==='ok'?'1':undefined} onClick={st?undefined:()=>{ if(r.ok){ setDone(i); onSay(r.text); } else setTried(t=>[...t,i]); }}
        style={{padding:'10px 12px',borderRadius:12,border:`1px solid ${st==='ok'?T.green:st==='no'?_alpha('#F28B7D',0.6):T.line}`,background:st==='ok'?_alpha('#5FD48F',0.1):'transparent',cursor:st?'default':'pointer',opacity:st==='no'?0.75:st==='off'?0.5:1}}>
        <div style={{fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.4}}>{st==='ok'?'✓ ':st==='no'?'✗ ':''}{r.text}</div>
        {(st==='no'||st==='ok')&&r.why&&<div style={{fontSize:13,color:st==='no'?'#F28B7D':T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{r.why}</div>}</div>; })}</div>
    {done>=0&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:12,lineHeight:1.45}}>Your reply is ready below. Put it in your own words if you like, then Say.</div>}
  </Card></div>; }
/* A hint for a guest's follow-up, shown when asked (it counts toward the hints used). */
function _GuestFollowHint({hint,onUse}){ const T=useTheme(), [shown,setShown]=React.useState(false);
  return <div data-testid="guest-hints" style={{marginTop:12}}>{shown?<div data-testid="guest-hint" style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,padding:'8px 12px',borderLeft:`3px solid ${T.amber}`,background:_alpha('#F2B84B',0.08),borderRadius:'0 10px 10px 0'}}>{hint}</div>
    :<div role="button" data-testid="guest-hint-btn" onClick={()=>{ setShown(true); onUse(); }} style={{display:'inline-block',fontSize:13,fontWeight:700,color:T.amber,fontFamily:C.P,cursor:'pointer',padding:'4px 0'}}>Give me a hint</div>}</div>; }
function TeamGuest({pid,back,open}){ const T=useTheme(), cr=T.lift(C.cr);
  const [sc,setSc]=React.useState(()=>TeamVinny.scenario(pid)), [turns,setTurns]=React.useState([]), [mark,setMark]=React.useState(null);
  const [say,setSay]=React.useState(''), [busy,setBusy]=React.useState(false), [err,setErr]=React.useState('');
  const [level,setLevel]=React.useState(()=>TeamVinny.level(pid)), [hints,setHints]=React.useState(0), [moved,setMoved]=React.useState(null);
  const endRef=React.useRef(null), levelRef=React.useRef(level), hintsRef=React.useRef(0);
  levelRef.current=level; hintsRef.current=hints;
  // Voice (team-voice.js): the guest's lines said aloud, and the reply spoken into the box. askedAt is when the
  // guest finished asking, so the delivery can say how long they took to start.
  const [voice,setVoice]=React.useState(()=>TeamVoice.on()), [listening,setListening]=React.useState(null), [spoken,setSpoken]=React.useState(null);
  const [notice,setNotice]=React.useState(false), askedAt=React.useRef(Date.now()), dels=React.useRef([]), voiceRef=React.useRef(voice);
  voiceRef.current=voice;
  const voiceNo=sc?Math.abs(sc.seed||0)%4:0;
  const sayLine=async(text)=>{ if(voiceRef.current&&text) await TeamVoice.speak(text,{voice:voiceNo}); askedAt.current=Date.now(); };
  const step=async(ts)=>{ setBusy(true); setErr('');
    try{ const r=await TeamVinny.guest(sc,ts,levelRef.current); const next=r.line?[...ts,{who:'guest',text:r.line,replies:r.replies,hint:r.hint}]:ts; setTurns(next);
      if(r.done){ const m=r.mark||{score:0,verdict:'',good:'',missing:'',better:''}; setMark(m);
        const ds=dels.current.filter(Boolean), d=ds.length?{wpm:ds.find(x=>x.wpm!=null)?.wpm??null,waitMs:ds[0].waitMs,fillers:ds.reduce((a,x)=>a+x.fillers,0),hedges:ds.reduce((a,x)=>a+x.hedges,0),words:ds.reduce((a,x)=>a+x.words,0)}:null;
        setMoved(TeamVinny.noteTable(pid,{level:levelRef.current,score:m.score,hints:hintsRef.current,delivery:d,table:sc})); }
      setBusy(false); sayLine(r.line); }
    catch(e){ setErr((e&&e.message)||'Couldn\'t reach Vinny.'); setBusy(false); } };
  const listenRef=React.useRef(null); listenRef.current=listening;
  React.useEffect(()=>()=>{ TeamVoice.stop(); if(listenRef.current) listenRef.current.stop(); },[]);
  const toggleVoice=()=>{ const v=!voice; TeamVoice.setOn(v); setVoice(v); if(v) TeamVoice.unlock(); };
  const mic=async()=>{
    if(listening){ const l=listening; setListening(null); const res=await l.stop(); if(res.text) setSay(res.text); setSpoken(res.text?{...res,askedAt:askedAt.current}:null); return; }
    TeamVoice.stop(); TeamVoice.unlock();
    if(!TeamVoice.noticeSeen()){ setNotice(true); TeamVoice.markNotice(); }
    setSay(''); setListening(TeamVoice.listen({onWords:t=>setSay(t)})); };
  React.useEffect(()=>{ if(sc&&!turns.length) step([]); },[sc]);
  React.useEffect(()=>{ try{ endRef.current&&endRef.current.scrollIntoView({block:'end',behavior:'smooth'}); }catch(e){} },[turns.length,mark,busy,hints]);
  if(!sc) return <div>{_tH(T,'No table yet','A guest needs a menu with pairings. Once the menu is published, Vinny can play one.')}<Btn full onClick={back}>Back</Btn></div>;
  const names=()=>TeamData.wines().map(w=>({name:TeamData.short(w),say:(TeamData.card(w.id)||{}).say||''}));
  const expected=()=>sc.wines.map(id=>TeamData.wine(id)).filter(Boolean).map(w=>TeamData.short(w));
  const reply=async()=>{ let t=say.trim(), sp=spoken;
    if(listening){ const l=listening; setListening(null); const res=await l.stop(); t=(res.text||t).trim(); sp=res.text?{...res,askedAt:askedAt.current}:sp; }
    if(!t||busy||mark) return; setSay(''); setSpoken(null);
    // A spoken reply is coached on how it was said (the words they sent, the timings of the speaking).
    const idx=turns.filter(x=>x.who==='you').length; dels.current[idx]=sp?TeamVoice.delivery({...sp,text:t,names:names(),expected:expected()}):null;
    const ts=[...turns,{who:'you',text:t,spoken:!!sp}]; setTurns(ts); TeamVoice.stop(); step(ts); };
  const again=()=>{ TeamVoice.stop(); TeamVoice.unlock(); dels.current=[]; setSc(TeamVinny.scenario(pid,Date.now())); setTurns([]); setMark(null); setSay(''); setSpoken(null); setHints(0); setMoved(null); setLevel(TeamVinny.level(pid)); };
  const lastDel=[...dels.current].reverse().find(Boolean), trend=mark&&lastDel?TeamVinny.deliveryTrend(pid):null;
  let youN=-1;
  const pick=(k)=>{ TeamVinny.setLevel(pid,k); setLevel(k); };
  const yours=turns.filter(t=>t.who==='you').length, open1=!mark&&turns.length>0&&!busy;
  const verdict=mark?(mark.verdict||(mark.score>=0.67?'right':mark.score>=0.34?'partly':'wrong')):'', vcol=verdict==='right'?'#5FD48F':verdict==='partly'?'#F2B84B':'#F28B7D';
  const helpUsed=level==='choices'?'With choices':level==='hints'?(hints?`With ${hints} hint${hints===1?'':'s'}`:'No hints used'):'On your own';
  const movedLine=moved&&moved.moved==='up'?(moved.level==='hints'?'Two tables in a row. Next table: no choices, just hints when you ask.':'Two tables in a row. Next table: on your own.')
    :moved&&moved.moved==='down'?(moved.level==='choices'?'Next table comes with choices again, to steady it.':'Next table comes with hints again.'):'';
  return <div data-testid="team-guest">
    {_tH(T,'A guest at your table',`They're having the ${sc.dishName}. Answer as you would at the table.`)}
    {sc.why&&sc.why.length>0&&<div data-testid="guest-why" style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.45,margin:'-4px 0 10px'}}>Picked for you: {sc.why.join(', and ')}.</div>}
    {!mark&&yours===0&&<_GuestHelpSwitch level={level} onPick={pick}/>}
    {TeamVoice.canSpeak()&&<div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}>
      <div role="switch" aria-checked={voice} data-testid="guest-voice" onClick={toggleVoice} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:14,border:`1px solid ${voice?cr:T.line}`,color:voice?T.ink:T.mid,fontSize:13,fontWeight:600,fontFamily:C.P,cursor:'pointer'}}>{voice?'🔊 Voice on':'🔇 Voice off'}</div></div>}
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {turns.map((t,i)=>{ if(t.who!=='guest') youN++; const d=t.who==='guest'?null:dels.current[youN];
        return t.who==='guest'
        ?<div key={i} data-testid="guest-line" style={{display:'flex',gap:10,alignItems:'flex-start'}}><TeamVinnyMark size={28}/><div style={{background:T.glass,border:`1px solid ${T.line}`,borderRadius:'4px 16px 16px 16px',padding:'10px 14px',fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.45,maxWidth:'85%'}}>{t.text}</div>
          {voice&&<div role="button" aria-label="Hear it again" data-testid="guest-replay" onClick={()=>TeamVoice.speak(t.text,{voice:voiceNo})} style={{alignSelf:'center',fontSize:16,cursor:'pointer',color:T.mid,padding:4}}>🔊</div>}</div>
        :<div key={i} style={{alignSelf:'flex-end',maxWidth:'85%',display:'flex',flexDirection:'column',alignItems:'flex-end'}}>
          <div data-testid="you-line" style={{background:T.soft,border:`1px solid ${cr}`,borderRadius:'16px 4px 16px 16px',padding:'10px 14px',fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.45}}>{t.spoken?'🎙 ':''}{t.text}</div>
          {d&&<div data-testid="you-delivery" style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:4}}>{[d.wpm!=null&&`${d.wpm} words a minute`,d.waitMs!=null&&`started in ${(d.waitMs/1000).toFixed(1)}s`,`${d.fillers+d.hedges} filler${d.fillers+d.hedges===1?'':'s'} and hedges`].filter(Boolean).join(' · ')}</div>}
        </div>; })}
      {busy&&<div style={{display:'flex',gap:10,alignItems:'center'}}><TeamVinnyMark size={28}/><span style={{fontSize:14,color:T.mid,fontFamily:C.P}}>…</span></div>}
      {err&&<div style={{fontSize:14,color:'#F28B7D',fontFamily:C.P}}>{err} <span role="button" onClick={()=>step(turns)} style={{fontWeight:700,cursor:'pointer',textDecoration:'underline'}}>Try again</span></div>}
    </div>
    {open1&&level==='choices'&&yours===0&&<_GuestChoices key={sc.seed} help={sc.help} onSay={setSay}/>}
    {/* After the first reply, the guest's follow-up comes with its own help (TeamVinny.guest): replies to pick from, or a hint. */}
    {(()=>{ const g=turns[turns.length-1]; if(!open1||yours===0||!g||g.who!=='guest') return null;
      if(level==='choices'&&g.replies) return <_GuestReplies key={turns.length} replies={g.replies} onSay={setSay}/>;
      if(level==='hints'&&g.hint) return <_GuestFollowHint key={turns.length} hint={g.hint} onUse={()=>setHints(n=>n+1)}/>;
      return null; })()}
    {open1&&level==='hints'&&yours===0&&<div data-testid="guest-hints" style={{marginTop:12}}>
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
      {lastDel&&<div data-testid="guest-delivery" style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.line}`}}>
        <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Your delivery</div>
        {lastDel.notes.map((n,i)=><div key={i} data-testid="delivery-note" data-good={n.good?'1':'0'} style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginTop:5,lineHeight:1.45}}><b style={{color:n.good?'#5FD48F':'#F2B84B'}}>{n.good?'✓ ':'→ '}</b>{n.text}</div>)}
        {trend&&<div data-testid="delivery-trend" style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:8}}>{trend}</div>}
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6}}>Only you see this. It doesn't change your readiness.</div>
      </div>}
      {movedLine&&<div data-testid="guest-moved" style={{fontSize:14,fontWeight:600,color:moved.moved==='up'?'#5FD48F':T.ink2,fontFamily:C.P,marginTop:12,lineHeight:1.45}}>{movedLine}</div>}
      <_TVChips wines={sc.wines} dishes={[sc.dish]} open={open}/>
      <div style={{display:'flex',gap:8,marginTop:14}}><Btn primary style={{flex:1}} onClick={again}>Another table</Btn><Btn style={{flex:1}} onClick={back}>Done</Btn></div>
    </Card></div>}
    {!mark&&turns.length>0&&voice&&TeamVoice.canListen()&&<div style={{marginTop:14}}>
      <div role="button" data-testid="guest-mic" aria-pressed={!!listening} onClick={mic} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'14px 16px',borderRadius:16,border:`1.5px solid ${listening?'#F28B7D':cr}`,background:listening?_alpha('#F28B7D',0.12):_alpha(C.cr,0.18),color:T.ink,fontSize:16,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>
        <span style={{width:12,height:12,borderRadius:6,background:listening?'#F28B7D':cr,animation:listening?'tmPulse 1s ease-in-out infinite':'none'}}/>{listening?'Listening… tap when you\'ve finished':spoken?'Say it again':'Tap and speak to the guest'}</div>
      <style>{'@keyframes tmPulse{0%,100%{opacity:1}50%{opacity:.3}}'}</style>
      {notice&&<div data-testid="voice-notice" style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>{TeamVoice.where()}</div>}
      {spoken&&!listening&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6}}>Check the words below (fix a misheard name), then Say.</div>}
    </div>}
    {!mark&&turns.length>0&&<div style={{display:'flex',gap:8,marginTop:14,alignItems:'flex-end'}}>
      <textarea data-testid="guest-reply" value={say} onChange={e=>setSay(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); reply(); } }} rows={level==='choices'&&say?3:2} placeholder="What do you say?" aria-label="Your reply" style={{flex:1,minWidth:0,borderRadius:12,border:`1px solid ${T.line}`,background:'transparent',color:T.ink,padding:'10px 12px',fontSize:'15px',fontFamily:C.P,resize:'none',outline:'none'}}/>
      <Btn primary onClick={reply} style={{opacity:(say.trim()||listening)&&!busy?1:0.45}}>Say</Btn>
    </div>}
    <div ref={endRef}/>
  </div>; }

Object.assign(window,{TeamVinnyTab,TeamGuest,TeamVinnyMark});
