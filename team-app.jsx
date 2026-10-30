/* The restaurant staff-training app's shell (docs/business.md): set-up on first run, then tabs for
   the person training on this device (staff: Today, Wines, Menu; a manager or buyer also Upload and
   Team), with detail views (a wine, a dish, the drill) pushed on top and Back popping them. Always
   on the dark stage. Booted instead of the consumer app's pwa-app.jsx (scripts/app-sources.mjs). */
const TEAM_TABS=[
  {k:'today',label:'Today',icon:'home'},{k:'wines',label:'Wines',icon:'wine'},{k:'menu',label:'Menu',icon:'fork'},
  {k:'upload',label:'Upload',icon:'camera',manager:true},{k:'team',label:'Team',icon:'user',manager:true},
];
function TeamApp(){
  const T=_DECK_DARK, cr=T.lift(C.cr);
  const [gen,setGen]=React.useState(0), refresh=()=>setGen(g=>g+1);
  const [tab,setTab]=React.useState('today'), [stack,setStack]=React.useState([]);
  const [switching,setSwitching]=React.useState(false);
  React.useEffect(()=>{ const h=()=>refresh(); window.addEventListener('vbiz:data',h); window.addEventListener('vinterest:account',h);
    try{ Account.loadRemoteConfig(); if(Account.signedIn()) Account.refreshMe(); }catch(e){}
    return ()=>{ window.removeEventListener('vbiz:data',h); window.removeEventListener('vinterest:account',h); }; },[]);
  // /team/?seed=demo opens straight onto the demo restaurant (the wine-show laptop).
  React.useEffect(()=>{ try{ const seed=new URLSearchParams(location.search).get('seed'); if(seed&&!TeamLearn.me()){ TeamSample.load(seed); history.replaceState(null,'',location.pathname); refresh(); } }catch(e){} },[]);
  const me=TeamLearn.me(), set=!!me;
  const manager=me&&['manager','buyer'].includes(me.role);
  const tabs=TEAM_TABS.filter(t=>!t.manager||manager);
  const open=v=>{ if(v.tab){ setTab(v.tab); setStack([]); return; } setStack(s=>[...s,v]); };
  const back=()=>setStack(s=>s.slice(0,-1));
  const top=stack[stack.length-1];
  let body;
  if(!set) body=<TeamSetup onDone={refresh}/>;
  else if(top) body=top.view==='wine'?<TeamWine id={top.id} pid={me.id} open={open}/>:top.view==='dish'?<TeamDish id={top.id} open={open}/>
    :<TeamDrill key={stack.length} pid={me.id} only={top.only} back={back}/>;
  else body=tab==='today'?<TeamToday pid={me.id} open={open}/>:tab==='wines'?<TeamWines pid={me.id} open={open}/>:tab==='menu'?<TeamMenu open={open}/>
    :tab==='upload'?<TeamUpload onChanged={refresh}/>:<TeamPeople open={open} onChanged={refresh}/>;
  return <DeckTheme.Provider value={_DECK_DARK}>
    <div data-gen={gen} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:`radial-gradient(ellipse at 50% -10%, ${_alpha(cr,0.3)}, transparent 60%) ${T.bg}`,color:T.ink}}>
      {set&&<div style={{padding:'calc(env(safe-area-inset-top) + 12px) 16px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${T.line}`}}>
        {top?<div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={T.ink}/></div>
          :<img src="/logo.png" alt="" style={{height:20,filter:'invert(1)'}} onError={e=>{ e.target.style.display='none'; }}/>}
        <div style={{flex:1,minWidth:0,fontSize:15,fontWeight:700,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{TeamData.get().venue.name||'Your restaurant'}</div>
        <div role="button" data-testid="team-who" onClick={()=>setSwitching(x=>!x)} style={{display:'flex',alignItems:'center',gap:8,padding:'4px 10px 4px 4px',borderRadius:18,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer'}}><TeamFace person={me} size={28}/>{me.name.split(' ')[0]} · {TeamLearn.ROLES[me.role].label}</div>
      </div>}
      {switching&&<div style={{padding:'8px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',gap:6,flexWrap:'wrap'}}>
        {TeamLearn.people().map(p=><div key={p.id} role="button" onClick={()=>{ TeamLearn.setMe(p.id); setSwitching(false); setStack([]); if(!['manager','buyer'].includes(p.role)&&['upload','team'].includes(tab)) setTab('today'); refresh(); }} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px 4px 4px',borderRadius:16,border:`1px solid ${p.id===me.id?cr:T.line}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer'}}><TeamFace person={p} size={24}/>{p.name.split(' ')[0]} · {TeamLearn.ROLES[p.role].label}</div>)}
        <div role="button" onClick={()=>{ if(confirm('Start again? This clears the restaurant and everyone\'s training on this device.')){ TeamData.reset(); Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); setSwitching(false); setStack([]); setTab('today'); refresh(); } }} style={{padding:'6px 10px',fontSize:13,fontFamily:C.P,color:T.mid,cursor:'pointer'}}>Start again</div>
      </div>}
      {set&&!Account.signedIn()&&manager&&tab==='upload'&&!top&&<TeamSignIn/>}
      <div style={{flex:1,overflowY:'auto',padding:'16px 16px 24px'}}><div style={{maxWidth:720,margin:'0 auto'}}><ScreenErrorBoundary>{body}</ScreenErrorBoundary></div></div>
      {set&&!top&&<div style={{display:'flex',borderTop:`1px solid ${T.line}`,background:T.bg,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {tabs.map(t=><div key={t.k} role="button" data-testid={'team-tab-'+t.k} onClick={()=>{ setTab(t.k); setStack([]); }} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'9px 0 8px',cursor:'pointer'}}>
          <Icon n={t.icon} sz={20} col={tab===t.k?cr:T.mid}/><span style={{fontSize:'11px',fontWeight:600,fontFamily:C.P,color:tab===t.k?cr:T.mid}}>{t.label}</span></div>)}
      </div>}
    </div>
  </DeckTheme.Provider>;
}
/* Reading a list and writing training are Claude calls the Worker keeps to Pro accounts during the
   pilot, so a manager signs in (the same emailed code as the consumer app) before uploading. */
function TeamSignIn(){ const T=useTheme();
  const [email,setEmail]=React.useState(''), [code,setCode]=React.useState(''), [step,setStep]=React.useState('email'), [err,setErr]=React.useState('');
  const field={flex:1,padding:'10px 12px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:16,outline:'none',minWidth:0};
  if(!Account.available()) return null;
  return <div style={{padding:'12px 16px',borderBottom:`1px solid ${T.line}`}}>
    <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,marginBottom:8}}>Sign in with your Vinterest Pro account to read lists and write training.</div>
    <div style={{display:'flex',gap:8}}>
      {step==='email'?<><input aria-label="Email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={field}/><Btn small primary onClick={async()=>{ const r=await Account.requestCode(email); if(r.ok){ setStep('code'); setErr(''); } else setErr(r.error); }}>Send code</Btn></>
      :<><input aria-label="Code" placeholder="6-digit code" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)} style={field}/><Btn small primary onClick={async()=>{ const r=await Account.verifyCode(email,code); if(r.ok){ setErr(''); Account.refreshMe(); } else setErr(r.error); }}>Sign in</Btn></>}
    </div>
    {err&&<div style={{fontSize:13,color:'#F28B7D',fontFamily:C.P,marginTop:6}}>{err}</div>}
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<TeamApp/>);
