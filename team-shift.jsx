/* The pre-shift briefing and tonight's specials (TeamShift in team-shift.js, docs/business.md "The pre-shift briefing").
   TeamShiftManage is management's side, the same on the console's Tonight card and the phone's Tonight editor: add a
   special by photo, typing or speaking, approve what was read, send the briefing, see who has read it. TeamBriefing is
   what every person reads and accepts before the app opens that day (the layer in team-app.jsx). */
const _SH_RED='#F28B7D', _SH_GREEN='#5FD48F';
const _shTag=(T,text,col)=><span style={{fontSize:12,fontWeight:700,fontFamily:C.P,color:col,padding:'2px 8px',borderRadius:8,border:`1px solid ${_alpha(col,0.6)}`,background:_alpha(col,0.12),whiteSpace:'nowrap'}}>{text}</span>;
const _shLink=(T,text,onClick,tid)=><span role="button" data-testid={tid} onClick={onClick} style={{fontSize:14,fontWeight:700,color:T.lift(C.cr),fontFamily:C.P,cursor:'pointer'}}>{text}</span>;
const _shInput=(T)=>({width:'100%',boxSizing:'border-box',padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none'});

/* The wine poured with a special: its name, how it's sold, and why. */
function _ShPour({T,label,p,onPick}){ const w=p&&TeamData.wine(p.id); if(!w) return onPick?<div style={{fontSize:14,color:T.mid,fontFamily:C.P,padding:'6px 0'}}>{label}: none picked. {_shLink(T,'Pick one',onPick)}</div>:null;
  const pr=label==='By the glass'?(w.glass?`${w.glass} a glass`:''):(w.bottle?`${w.bottle} a bottle`:w.glass?`${w.glass} a glass`:'');
  return <div style={{padding:'8px 0',borderTop:`1px solid ${T.line}`}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>{label}</div>{onPick&&_shLink(T,'Swap',onPick)}</div>
    <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.3,marginTop:2}}>{TeamData.short(w)}{pr&&<span style={{fontSize:14,fontWeight:500,color:T.mid}}> · {pr}</span>}</div>
    {p.why&&<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{p.why}</div>}</div>; }

/* Swapping the wine: the other wines the pairing offered first, then a search of the list. */
function _ShWinePick({T,s,slot,done}){ const [q,setQ]=React.useState(''), n=x=>TeamShift._norm(x), glass=slot==='glass';
  const alts=[s.pairing.bottle,s.pairing.glass,...(s.pairing.alts||[])].filter(p=>p&&p.id!==(s.pairing[slot]||{}).id&&(!glass||TeamData.byGlass(TeamData.wine(p.id))));
  const seen=new Set(), offered=alts.filter(p=>!seen.has(p.id)&&seen.add(p.id));
  const found=q.trim()?TeamData.wines().filter(w=>!TeamData.isDrink(w)&&(!glass||TeamData.byGlass(w))&&n(TeamData.label(w)).includes(n(q))).slice(0,6):[];
  const row=(id,why)=>{ const w=TeamData.wine(id); return w&&<div key={id} role="button" data-testid="special-wine-option" onClick={()=>{ TeamShift.setWine(s.id,slot,id,why); done(); }} style={{padding:'9px 0',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}>
    <div style={{fontSize:15,fontWeight:700,color:T.ink,fontFamily:C.P}}>{TeamData.short(w)}</div>{why&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{why}</div>}</div>; };
  return <div data-testid="special-wine-pick" style={{margin:'8px 0',padding:12,borderRadius:12,border:`1px solid ${T.line}`,background:T.soft}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}><div style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{glass?'Another wine by the glass':'Another bottle'}</div>{_shLink(T,'Cancel',done)}</div>
    {offered.map(p=>row(p.id,p.why))}
    <input aria-label="Find a wine on the list" placeholder={glass?'Or find a wine by the glass':'Or find any wine on the list'} value={q} onChange={e=>setQ(e.target.value)} style={{..._shInput(T),marginTop:8}}/>
    {found.map(w=>row(w.id,''))}</div>; }

/* One special for the manager. A draft is a review card: fix what was read, confirm the allergens with the kitchen,
   check the wine, say how long it runs, approve. A live one is a row with Sold out and Take off. */
function TeamSpecialCard({s,bump}){ const T=useTheme(), [pick,setPick]=React.useState(null), [all,setAll]=React.useState(false);
  const set=f=>{ TeamShift.update(s.id,f); bump(); }, list=TeamData.allergenList(), has=c=>s.allergens.some(a=>a.code===c);
  if(s.status!=='draft'){ const sold=s.status==='soldout', w=TeamData.wine((s.pairing.glass||s.pairing.bottle||{}).id);
    return <div data-testid="special-live" style={{padding:'10px 0',borderTop:`1px solid ${T.line}`,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <div style={{flex:'1 1 200px',minWidth:0}}><div style={{fontSize:16,fontWeight:700,color:sold?T.mid:T.ink,fontFamily:C.P,textDecoration:sold?'line-through':'none'}}>{s.name}{TeamShift.price(s)&&<span style={{fontWeight:500,color:T.mid}}> · {TeamShift.price(s)}</span>}</div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{sold?`Sold out at ${TeamShift.time(s.soldAt)}`:TeamShift.runLine(s)}{w&&!sold?` · pour the ${TeamData.short(w)}`:''}</div></div>
      <span role="button" data-testid="special-soldout" aria-pressed={sold} onClick={()=>{ TeamShift.soldOut(s.id,!sold); bump(); }} style={{fontSize:14,fontWeight:700,fontFamily:C.P,padding:'7px 12px',borderRadius:10,cursor:'pointer',color:sold?T.ink:_SH_RED,border:`1px solid ${sold?T.line:_SH_RED}`,background:sold?'transparent':_alpha(_SH_RED,0.12)}}>{sold?'Back on':'Sold out'}</span>
      <span role="button" data-testid="special-off" onClick={()=>{ TeamShift.discard(s.id); bump(); }} style={{fontSize:14,fontWeight:600,fontFamily:C.P,color:T.mid,cursor:'pointer'}}>Take off</span></div>; }
  const shown=all?list:list.filter(a=>has(a.code));
  return <div data-testid="special-draft" style={{margin:'10px 0',padding:14,borderRadius:14,border:`1px solid ${_alpha(T.amber,0.6)}`,background:_alpha(T.amber,0.06)}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}>{_shTag(T,s.source==='photo'?'Read from the photo · check it':s.source==='again'?'Back again · check it':'To approve',T.amber)}{_shLink(T,'Discard',()=>{ TeamShift.discard(s.id); bump(); },'special-discard')}</div>
    {s.unclear&&<div style={{fontSize:14,color:T.amber,fontFamily:C.P,lineHeight:1.4,marginBottom:8}}>Hard to read: {s.unclear}</div>}
    <div style={{display:'flex',gap:8}}>
      <input aria-label="Special's name" data-testid="special-name" value={s.name} onChange={e=>set({name:e.target.value})} style={{..._shInput(T),flex:1,fontWeight:700}}/>
      <input aria-label="Price" data-testid="special-price" inputMode="decimal" placeholder="Price" value={s.price==null?'':s.price} onChange={e=>{ const v=e.target.value.replace(/[^0-9.]/g,''); set({price:v===''?null:Number(v)}); }} style={{..._shInput(T),width:90,textAlign:'right'}}/></div>
    <textarea aria-label="How to describe it" data-testid="special-desc" placeholder="How a server describes it, in a sentence" value={s.description} onChange={e=>set({description:e.target.value})} rows={2} style={{..._shInput(T),marginTop:8,resize:'vertical',lineHeight:1.4}}/>
    <div style={{marginTop:12,fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>Allergens</div>
    <div style={{marginTop:6}}>{shown.map(a=>{ const on=has(a.code), likely=on&&s.allergens.find(x=>x.code===a.code).sure==='likely';
      return <span key={a.code} role="button" data-testid="special-allergen" aria-pressed={on} onClick={()=>{ TeamShift.toggleAllergen(s.id,a.code); bump(); }} style={{display:'inline-block',margin:'0 6px 6px 0',padding:'5px 11px',borderRadius:12,fontSize:14,fontFamily:C.P,cursor:'pointer',border:`1px solid ${on?_SH_RED:T.line}`,background:on?_alpha(_SH_RED,0.14):'transparent',color:on?T.ink:T.mid}}>{a.name}{likely?' (likely)':''}</span>; })}
      {!shown.length&&<span style={{fontSize:14,color:T.mid,fontFamily:C.P,marginRight:8}}>None found.</span>}
      {_shLink(T,all?'Fewer':'Add or check all',()=>setAll(x=>!x),'special-allergen-all')}</div>
    <div role="checkbox" aria-checked={!!s.confirmed} data-testid="special-confirm" onClick={()=>set({confirmed:!s.confirmed})} style={{display:'flex',gap:10,alignItems:'center',marginTop:6,padding:'10px 12px',borderRadius:10,cursor:'pointer',border:`1px solid ${s.confirmed?_SH_GREEN:T.line}`,background:s.confirmed?_alpha(_SH_GREEN,0.12):'transparent'}}>
      <span style={{width:22,height:22,borderRadius:6,border:`2px solid ${s.confirmed?_SH_GREEN:T.mid}`,display:'flex',alignItems:'center',justifyContent:'center',color:_SH_GREEN,fontSize:15,fontWeight:800,flexShrink:0}}>{s.confirmed?'✓':''}</span>
      <span style={{fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.35}}>The kitchen has confirmed {s.allergens.length?'these allergens':'it has none of these allergens'}</span></div>
    <div style={{marginTop:10}}>
      {pick==='bottle'?<_ShWinePick T={T} s={s} slot="bottle" done={()=>{ setPick(null); bump(); }}/>:<_ShPour T={T} label="Pour with it" p={s.pairing.bottle} onPick={()=>setPick('bottle')}/>}
      {pick==='glass'?<_ShWinePick T={T} s={s} slot="glass" done={()=>{ setPick(null); bump(); }}/>:<_ShPour T={T} label="By the glass" p={s.pairing.glass} onPick={()=>setPick('glass')}/>}</div>
    <div style={{marginTop:10,display:'flex',gap:6,flexWrap:'wrap'}}>{TeamShift.RUNS.map(r=><span key={r.k} role="button" data-testid={`special-run-${r.k}`} aria-pressed={(s.run||'tonight')===r.k} onClick={()=>set({run:r.k})} style={{padding:'6px 12px',borderRadius:12,fontSize:14,fontFamily:C.P,cursor:'pointer',border:`1px solid ${(s.run||'tonight')===r.k?T.lift(C.cr):T.line}`,color:(s.run||'tonight')===r.k?T.ink:T.mid,background:(s.run||'tonight')===r.k?_alpha(T.lift(C.cr),0.14):'transparent'}}>{r.label}</span>)}</div>
    <div data-testid="special-approve" aria-disabled={!s.confirmed||!s.name.trim()} style={{marginTop:12,opacity:s.confirmed&&s.name.trim()?1:0.45}}><Btn primary full onClick={()=>{ if(TeamShift.approve(s.id)) bump(); }}>Approve for tonight's briefing</Btn></div>
    {!s.confirmed&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:6,textAlign:'center'}}>Confirm the allergens with the kitchen first.</div>}
  </div>; }

/* Add a special: a photo of the chef's board, a typed line or a spoken one. One call reads it and pairs it. */
function TeamSpecialAdd({bump}){ const T=useTheme(), [text,setText]=React.useState(''), [busy,setBusy]=React.useState(''), [err,setErr]=React.useState(''), fileRef=React.useRef(null), micRef=React.useRef(null), [mic,setMic]=React.useState(false);
  const run=async(input,label)=>{ setBusy(label); setErr('');
    try{ await TeamShift.read(input); setText(''); }
    catch(e){ if(input.text&&!input.b64&&TeamShift.typed(input.text)){ setText(''); setErr("We couldn't reach the pairing just now, so it's added as you typed it. Pick its wine below."); } else setErr((e&&e.message)||"That didn't work. Try again, or type it in."); }
    setBusy(''); bump(); };
  const onPhoto=async e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return; try{ const {data}=await _tReadFile(f); await run({b64:data,text:text.trim()},"Reading the chef's writing and finding the wine…"); }catch(x){ setErr("We couldn't open that photo."); } };
  const talk=async()=>{ if(mic){ const m=micRef.current; micRef.current=null; setMic(false); if(m){ try{ const r=await m.stop(); if(r&&r.text) setText(t=>(t?t+' ':'')+r.text); }catch(e){} } return; }
    try{ TeamVoice.unlock&&TeamVoice.unlock(); micRef.current=TeamVoice.listen({onWords:w=>{}}); setMic(true); }catch(e){ setErr("The microphone didn't start. Type it in."); } };
  if(busy) return <div data-testid="special-busy" style={{padding:'16px 0'}}><WritingWait title={busy} slim/></div>;
  return <div data-testid="special-add" style={{marginTop:10}}>
    <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} data-testid="special-file" style={{display:'none'}}/>
    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
      <div style={{flex:'1 1 160px'}}><Btn primary full onClick={()=>fileRef.current&&fileRef.current.click()}>Photo of the chef's board</Btn></div>
      {TeamVoice.canListen()&&<div style={{flex:'0 0 auto'}}><Btn onClick={talk}>{mic?'Stop':'Say it'}</Btn></div>}</div>
    <div style={{display:'flex',gap:8,marginTop:8,alignItems:'flex-start'}}>
      <textarea aria-label="Type a special" data-testid="special-text" rows={2} placeholder={mic?'Listening…':'Or type it: halibut, brown butter, capers 34'} value={text} onChange={e=>setText(e.target.value)} style={{..._shInput(T),flex:1,resize:'vertical',lineHeight:1.4}}/>
      <div data-testid="special-read" style={{opacity:text.trim()?1:0.45}}><Btn onClick={()=>{ if(text.trim()) run({text:text.trim()},'Finding the wine for it…'); }}>Add</Btn></div></div>
    <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.4}}>Several at once is fine. Each comes back with a wine from your list for you to approve.</div>
    {err&&<div data-testid="special-error" style={{fontSize:14,color:T.amber,fontFamily:C.P,marginTop:8,lineHeight:1.4}}>{err}</div>}
  </div>; }

/* Management's side of the shift: specials, the note, Send briefing and who has read it. `pid` is who's sending. */
function TeamShiftManage({pid,preview}){ const T=useTheme(), [,bump]=React.useReducer(x=>x+1,0), [adding,setAdding]=React.useState(false), [who,setWho]=React.useState(false);
  const drafts=TeamShift.drafts(), live=TeamShift.specials(), past=TeamShift.past(), st=TeamShift.status(), reg=TeamShift.register(), tn=TeamData.tonight();
  // The demo's team accept over the next few minutes, so the count is read again as they do.
  React.useEffect(()=>{ if(!reg.sent||reg.read===reg.total) return; const t=setInterval(bump,5000); return ()=>clearInterval(t); },[reg.sent,reg.read,reg.total]);
  return <div data-testid="shift-manage">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:14}}><div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase'}}>Specials{live.length?` (${live.length})`:''}</div>
      {_shLink(T,adding?'Done':'Add a special',()=>setAdding(x=>!x),'special-add-open')}</div>
    {adding&&<TeamSpecialAdd bump={bump}/>}
    {drafts.map(s=><TeamSpecialCard key={s.id} s={s} bump={bump}/>)}
    {live.map(s=><TeamSpecialCard key={s.id} s={s} bump={bump}/>)}
    {!drafts.length&&!live.length&&!adding&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>No specials tonight. Add one from a photo of the chef's board, or type it.</div>}
    {past.length>0&&<div data-testid="special-past" style={{marginTop:8,fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.9}}>Bring back: {past.map(s=><span key={s.id} role="button" data-testid="special-again" onClick={()=>{ TeamShift.bringBack(s.id); bump(); }} style={{display:'inline-block',marginRight:6,padding:'2px 10px',borderRadius:10,border:`1px solid ${T.line}`,color:T.ink2,cursor:'pointer'}}>{s.name}</span>)}</div>}
    <div style={{fontSize:12,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',margin:'16px 0 6px'}}>A note for the team</div>
    <textarea aria-label="A note for the team" data-testid="shift-note" rows={2} placeholder="Large party at 8, push the tasting menu, new glassware on the pass…" defaultValue={tn.note} onBlur={e=>{ if(e.target.value!==tn.note){ TeamData.setTonight({note:e.target.value}); bump(); } }} style={{..._shInput(T),resize:'vertical',lineHeight:1.4}}/>
    <div data-testid="shift-send" style={{marginTop:14,padding:14,borderRadius:14,border:`1px solid ${T.line}`,background:T.soft}}>
      <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>Tonight's briefing</div>
      <div data-testid="shift-status" style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{st.empty?"Nothing in it yet: 86 a dish, feature a wine, add a special or write a note."
        :!st.sent?`Not sent yet. Everyone reads and accepts it before the app opens for them today.${st.drafts?` ${st.drafts} special${st.drafts>1?'s':''} still to approve.`:''}`
        :st.changed?`Sent at ${TeamShift.time(st.at)}, and changed since. Send the update and everyone accepts what's new.`
        :`Sent at ${TeamShift.time(st.at)}.`}</div>
      {!st.empty&&<div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
        {(!st.sent||st.changed)&&<div data-testid="shift-send-btn" style={{flex:'1 1 180px'}}><Btn primary full onClick={()=>{ TeamShift.send(pid); bump(); }}>{st.sent?'Send the update':'Send briefing'}</Btn></div>}
        {preview&&<div style={{flex:'0 0 auto'}}><Btn onClick={preview}>See it as the team does</Btn></div>}</div>}
      {reg.sent&&<div data-testid="shift-register" style={{marginTop:12}}>
        <div role="button" onClick={()=>setWho(x=>!x)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
          <div style={{fontSize:15,fontWeight:700,color:reg.read===reg.total?_SH_GREEN:T.ink,fontFamily:C.P}}>{reg.read} of {reg.total} have read it</div><span style={{fontSize:14,color:T.mid,fontFamily:C.P}}>{who?'Hide':'Who'}</span></div>
        <div style={{height:6,borderRadius:3,background:T.line,marginTop:6,overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(100*reg.read/Math.max(1,reg.total))}%`,background:_SH_GREEN,transition:'width .4s'}}/></div>
        {!who&&reg.waiting.length>0&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:6}}>Still to read: {reg.waiting.map(p=>p.name.split(' ')[0]).join(', ')}</div>}
        {who&&reg.rows.map(r=><div key={r.person.id} data-testid="shift-register-row" style={{display:'flex',alignItems:'center',gap:8,padding:'7px 0',borderTop:`1px solid ${T.line}`,marginTop:6}}><TeamFace person={r.person} size={24}/><div style={{flex:1,fontSize:15,color:T.ink,fontFamily:C.P}}>{r.person.name}</div><div style={{fontSize:14,fontFamily:C.P,color:r.read?_SH_GREEN:T.amber}}>{r.read?`Read at ${TeamShift.time(r.at)}`:'Not yet'}</div></div>)}
        {reg.demo&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:8}}>Demo data: here the rest of the team accept on their own over a few minutes. In a live install each person accepts on their own phone.</div>}
      </div>}
    </div>
  </div>; }

/* The briefing itself. As the gate (onAck) it covers the whole app with Got it pinned to the foot; read again later
   (back) it's the same page with no button. What's new since the version they last accepted is tagged. */
function TeamBriefing({pid,onAck,back,preview}){ const T=useTheme(), cr=T.lift(C.cr), c=TeamShift.content(), fr=TeamShift.fresh(pid), me=TeamLearn.person(pid), s=TeamShift.sent();
  const look=TeamLearn.slippingOn(pid,2), by=s&&TeamLearn.person(s.by), isNew=on=>on?<span style={{marginLeft:8}}>{_shTag(T,'New',T.amber)}</span>:null;
  const say=x=>{ TeamVoice.unlock(); TeamVoice.speak(x.name&&!x.producer?x.name:TeamData.short(x),{pace:'slow'}); };
  const H=(t,col)=><div style={{fontSize:13,fontWeight:800,color:col||cr,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase',margin:'22px 0 8px'}}>{t}</div>;
  const price=w=>[w.glass&&`${w.glass} a glass`,w.bottle&&`${w.bottle} a bottle`,!w.glass&&!w.bottle&&w.price].filter(Boolean).join(' · ');
  const body=<div style={{maxWidth:640,margin:'0 auto',padding:'0 18px 24px'}}>
    <div style={{fontSize:13,fontWeight:700,color:T.mid,fontFamily:C.P,letterSpacing:'0.1em',textTransform:'uppercase'}}>{new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})}</div>
    <div style={{fontSize:28,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.15,marginTop:4}}>{fr.update?"Tonight's briefing has changed":`Before your shift${me?', '+me.name.split(' ')[0]:''}`}</div>
    <div style={{fontSize:15,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:6}}>{fr.update?"What's new is marked. Read it and accept it to carry on.":"What's off, tonight's specials and what we're pouring. Read it and accept it to open the app."}{by&&s?` From ${by.name.split(' ')[0]}, ${TeamShift.time(s.at)}.`:''}</div>
    {c.off.length>0&&<div data-testid="briefing-off">{H("86'd · don't offer",_SH_RED)}<Card style={{borderColor:_alpha(_SH_RED,0.5)}}>{c.off.map((x,i)=><div key={x.id} style={{padding:'8px 0',borderTop:i?`1px solid ${T.line}`:'none',fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P}}>{x.name}{x.section&&<span style={{fontSize:14,fontWeight:500,color:T.mid}}> · {x.section}</span>}{isNew(fr.off.has(x.id))}</div>)}</Card></div>}
    {c.specials.length>0&&<div data-testid="briefing-specials">{H('Specials')}{c.specials.map(sp=>{ const sold=sp.status==='soldout', g=sp.pairing.glass, b=sp.pairing.bottle, same=g&&b&&g.id===b.id;
      return <div key={sp.id} data-testid="briefing-special" style={{marginBottom:10}}><Card style={{opacity:sold?0.6:1}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline'}}><div style={{fontSize:20,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2,textDecoration:sold?'line-through':'none'}}>{sp.name}{isNew(fr.specials.has(sp.id))}</div><div style={{fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P}}>{TeamShift.price(sp)}</div></div>
        {sold&&<div style={{marginTop:6}}>{_shTag(T,`Sold out at ${TeamShift.time(sp.soldAt)}`,_SH_RED)}</div>}
        {sp.description&&<div style={{fontSize:16,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:6}}>{sp.description}</div>}
        <div data-testid="briefing-allergens" style={{marginTop:10,padding:'8px 12px',borderRadius:10,background:_alpha(_SH_RED,0.1),border:`1px solid ${_alpha(_SH_RED,0.4)}`,fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.4}}><b>Allergens:</b> {TeamShift.allergenLine(sp)||'none of the listed allergens'} <span style={{color:T.mid}}>· confirmed by the kitchen</span></div>
        <div style={{marginTop:8}}><_ShPour T={T} label={same?'Pour with it':'By the glass'} p={g||b}/>{!same&&g&&b&&<_ShPour T={T} label="By the bottle" p={b}/>}</div>
        {TeamShift.sayLine(sp)&&<div style={{marginTop:8,paddingLeft:12,borderLeft:`3px solid ${cr}`,fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.5}}>“{TeamShift.sayLine(sp)}”</div>}
      </Card></div>; })}</div>}
    {c.feature.length>0&&<div data-testid="briefing-feature">{H("What we're pushing",_SH_GREEN)}<Card style={{padding:'4px 16px'}}>{c.feature.map((f,i)=><div key={f.item.id} style={{display:'flex',gap:10,alignItems:'flex-start',padding:'10px 0',borderTop:i?`1px solid ${T.line}`:'none'}}>
      <div style={{flex:1,minWidth:0}}><div style={{fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{f.item.producer?TeamData.short(f.item):f.item.name}{isNew(fr.feature.has(f.item.id))}</div>
        {price(f.item)&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:1}}>{price(f.item)}</div>}
        {f.line&&<div style={{fontSize:15,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:3}}>{f.line}</div>}</div>
      <div role="button" aria-label={`Say ${f.item.name}`} onClick={()=>say(f.item)} style={{width:36,height:36,borderRadius:18,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0,cursor:'pointer'}}>🔊</div></div>)}</Card></div>}
    {c.note&&<div data-testid="briefing-note">{H(by?`From ${by.name.split(' ')[0]}`:'From the manager',T.mid)}<Card><div style={{fontSize:16,color:T.ink,fontFamily:C.P,lineHeight:1.5,whiteSpace:'pre-wrap'}}>{c.note}{isNew(fr.note)}</div></Card></div>}
    {look.length>0&&!preview&&<div data-testid="briefing-look">{H('Worth a look before service',T.mid)}<Card style={{padding:'4px 16px'}}>{look.map((x,i)=><div key={x.wine.id} style={{padding:'10px 0',borderTop:i?`1px solid ${T.line}`:'none'}}><div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P}}>{TeamData.short(x.wine)}<span style={{fontSize:13,fontWeight:600,color:T.amber,marginLeft:8}}>{x.why}</span></div></div>)}</Card></div>}
    {TeamShift.empty(c)&&<div style={{fontSize:15,color:T.mid,fontFamily:C.P,marginTop:16}}>Nothing in tonight's briefing.</div>}
  </div>;
  if(!onAck) return <div data-testid="team-briefing" style={{paddingTop:4}}>{body}</div>;
  return <div data-testid="team-briefing" role="dialog" aria-label="Tonight's briefing" style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:`radial-gradient(ellipse at 50% -10%, ${_alpha(cr,0.3)}, transparent 60%) ${T.bg}`,color:T.ink}}>
    <div data-scroll style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch',paddingTop:'calc(env(safe-area-inset-top) + 22px)'}}>{body}</div>
    <div style={{padding:'12px 18px calc(env(safe-area-inset-bottom) + 14px)',borderTop:`1px solid ${T.line}`,background:T.bg}}><div style={{maxWidth:640,margin:'0 auto'}}>
      <div data-testid="briefing-ack"><Btn primary full onClick={onAck}>{preview?'Close the preview':"Got it. I've read tonight's briefing"}</Btn></div>
      {!preview&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,textAlign:'center',marginTop:8}}>Your manager sees who has read it.</div>}</div></div>
  </div>; }
