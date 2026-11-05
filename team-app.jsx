/* The restaurant staff-training app's shell (docs/business.md): set-up on first run, then tabs for
   the person training on this device (staff: Today, Wines, Menu; a manager, buyer or sommelier also Upload and
   Team), with detail views (a wine, a dish, the drill) pushed on top and Back popping them. Always
   on the dark stage. Booted instead of the consumer app's pwa-app.jsx (scripts/app-sources.mjs). */
const TEAM_TABS=[
  {k:'today',label:'Today',icon:'home'},{k:'vinny',label:'Vinny',icon:'vinny'},{k:'wines',label:'Wines',icon:'wine'},{k:'menu',label:'Menu',icon:'fork'},
  {k:'upload',label:'Upload',icon:'camera',manager:true},{k:'team',label:'Team',icon:'user',manager:true},
];
function TeamApp(){
  const T=_DECK_DARK, cr=T.lift(C.cr);
  const [gen,setGen]=React.useState(0), refresh=()=>setGen(g=>g+1);
  // ?view=say opens the names check (TeamSayCheck) straight away, on the phone view.
  const sayLink=(()=>{ try{ return new URLSearchParams(location.search).get('view')==='say'; }catch(e){ return false; } })();
  const [tab,setTab]=React.useState(sayLink?'vinny':'today'), [stack,setStack]=React.useState(sayLink?[{view:'say'}]:[]);
  const [switching,setSwitching]=React.useState(false);
  // One scrolling area holds every screen, so where it is scrolled to is set on every move: a new screen
  // or tab opens at its top, and Back returns to where they were on the screen underneath (pos, by depth).
  const scrollRef=React.useRef(null), posRef=React.useRef([]), pendRef=React.useRef(null);
  const scrollNow=()=>scrollRef.current?scrollRef.current.scrollTop:0;
  React.useLayoutEffect(()=>{ const el=scrollRef.current, to=pendRef.current; pendRef.current=null; if(el&&to!=null) el.scrollTop=to; },[tab,stack]);
  // The management console (team-console.jsx): a manager, buyer or sommelier on a tablet or laptop (768px+), or
  // anyone with ?view=console (kept in the URL, so a reload keeps it); "Train on the phone view" shows
  // the phone app inside it, and the header's Console button comes back.
  // ?view=phone is the opposite: the phone app on any screen, for trying the staff's own view on a laptop or tablet.
  const viewParam=(()=>{ try{ return new URLSearchParams(location.search).get('view'); }catch(e){ return null; } })(), size=useLayoutSize(), forceConsole=viewParam==='console';
  const [phoneView,setPhoneView]=React.useState(viewParam==='phone'||viewParam==='say'), [section,setSection]=React.useState('dash');
  React.useEffect(()=>{ const h=()=>refresh(); window.addEventListener('vbiz:data',h); window.addEventListener('vinterest:account',h);
    return ()=>{ window.removeEventListener('vbiz:data',h); window.removeEventListener('vinterest:account',h); }; },[]);
  // /team/?seed=demo opens straight onto the demo restaurant (the wine-show laptop), replacing whatever
  // restaurant the device holds unless it's already this build's copy of it (so a reload keeps progress, and a
  // new build with more written in replaces a stale one).
  React.useEffect(()=>{ try{ const q=new URLSearchParams(location.search), host=TeamSample.hostSeed();
    // A restaurant's demo address (socialcorner.vinterest.team) opens that restaurant as ?seed would, every time.
    if(host&&!q.get('seed')){ if(!TeamLearn.me()||!TeamSample.current(host)) TeamSample.load(host); refresh(); return; }
    const seed=q.get('seed'); if(!seed&&TeamSample.retire()) refresh();
    // The Social Corner is a demo install: a device holding an older copy of its files takes the new one, with or without ?seed.
    const held=(TeamData.get().venue||{}).sample; if(!seed&&TeamSample.social(held)&&!TeamSample.current(held)){ TeamSample.load(held); refresh(); } if(seed){ if(!TeamLearn.me()||!TeamSample.current(seed)) TeamSample.load(seed); q.delete('seed'); const rest=q.toString(); history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')); refresh(); } }catch(e){} },[]);
  const me=TeamLearn.me(), set=!!me, brand=TeamData.brand();
  const manager=me&&TeamLearn.manages(me.role);
  const tabs=TEAM_TABS.filter(t=>!t.manager||manager);
  const goTab=k=>{ posRef.current=[]; pendRef.current=0; setTab(k); setStack([]); };
  const open=v=>{ if(v.tab){ goTab(v.tab); return; } posRef.current[stack.length]=scrollNow(); pendRef.current=0; setStack(s=>[...s,v]); };
  const consoleOn=set&&manager&&(forceConsole||size!=='phone')&&!phoneView;
  const toPhone=v=>{ setPhoneView(true); setStack([]); if(v&&v.pid&&TeamLearn.person(v.pid)) TeamLearn.setMe(v.pid); if(v&&v.tab) setTab(v.tab); else setTab('today'); if(v&&v.view==='drill') setStack([{view:'drill',only:v.only,part:v.part}]); refresh(); };
  if(consoleOn) return <DeckTheme.Provider value={_DECK_DARK}><div data-gen={gen} style={{position:'absolute',inset:0,color:T.ink}}><ScreenErrorBoundary><TeamConsole me={me} onPhone={toPhone} refresh={refresh} section={section} setSection={setSection}/></ScreenErrorBoundary></div></DeckTheme.Provider>;
  const back=()=>{ pendRef.current=posRef.current[stack.length-1]||0; setStack(s=>s.slice(0,-1)); };
  const top=stack[stack.length-1];
  let body;
  if(!set) body=<TeamSetup onDone={refresh}/>;
  // Every view on the stack stays mounted under the one on top (hidden), so a drill's summary is still there,
  // with its answers, when Back returns from a wine it opened.
  else if(top) body=stack.map((v,i)=><div key={i} style={{display:i===stack.length-1?'block':'none'}}>{v.view==='wine'?<TeamWine id={v.id} pid={me.id} open={open}/>:v.view==='cocktail'?<TeamCocktail id={v.id} pid={me.id} open={open}/>:v.view==='dish'?<TeamDish id={v.id} open={open}/>
    :v.view==='guest'?<TeamGuest pid={me.id} back={back} open={open}/>
    :v.view==='ask'?<TeamVinnyAsk pid={me.id} open={open}/>
    :v.view==='tonight'?<TeamTonightEdit back={back}/>
    :v.view==='vtest'?<TeamVinnyTest pid={me.id} open={open}/>
    :v.view==='say'?<TeamSayCheck/>
    :<TeamDrill pid={me.id} only={v.only} part={v.part} given={v.qs} intro={v.intro} back={back} open={open}/>}</div>);
  else body=tab==='today'?<TeamToday pid={me.id} open={open}/>:tab==='vinny'?<TeamVinnyTab pid={me.id} open={open}/>:tab==='wines'?<TeamWines pid={me.id} open={open}/>:tab==='menu'?<TeamMenu open={open}/>
    :tab==='upload'?<TeamUpload onChanged={refresh} background/>:<TeamPeople open={open} onChanged={refresh}/>;
  return <DeckTheme.Provider value={_DECK_DARK}>
    <div data-gen={gen} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:`radial-gradient(ellipse at 50% -10%, ${_alpha((brand&&brand.accent)||cr,0.3)}, transparent 60%) ${T.bg}`,color:T.ink}}>
      {set&&<div style={{padding:'calc(env(safe-area-inset-top) + 12px) 16px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${T.line}`}}>
        {top?<div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={T.ink}/></div>
          :brand&&brand.mark?<img src={brand.mark} alt="" style={{height:26,width:26,borderRadius:13,boxShadow:`0 0 0 1px ${_alpha(brand.accent||'#ffffff',0.6)}`}} onError={e=>{ e.target.style.display='none'; }}/>
          :<img src="/logo.png" alt="" style={{height:20,filter:'invert(1)'}} onError={e=>{ e.target.style.display='none'; }}/>}
        {/* An installed restaurant shows its own wordmark where the name would be (venue.brand). */}
        <div style={{flex:1,minWidth:0,fontSize:15,fontWeight:700,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{brand&&brand.logo?<TeamVenueLogo height={18}/>:(TeamData.get().venue.name||'Your restaurant')}</div>
        {manager&&(forceConsole||size!=='phone')&&<div role="button" data-testid="team-to-console" onClick={()=>{ setPhoneView(false); setStack([]); }} style={{padding:'5px 10px',borderRadius:14,border:`1px solid ${T.line}`,fontSize:12,fontFamily:C.P,color:T.ink2,cursor:'pointer',whiteSpace:'nowrap'}}>Console</div>}
        {/* On a phone the person is their face alone, so the restaurant's name has the room; the switcher it opens names everyone, and Today greets them by name and role. */}
        <div role="button" data-testid="team-who" aria-label={`${me.name}, ${TeamLearn.ROLES[me.role].label}. Switch person`} onClick={()=>setSwitching(x=>!x)} style={{display:'flex',alignItems:'center',gap:8,padding:size==='phone'?2:'4px 10px 4px 4px',borderRadius:18,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer',flexShrink:0}}><TeamFace person={me} size={28}/>{size!=='phone'&&<>{me.name.split(' ')[0]} · {TeamLearn.ROLES[me.role].label}</>}</div>
      </div>}
      {switching&&<div style={{padding:'8px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',gap:6,flexWrap:'wrap'}}>
        {TeamLearn.people().map(p=><div key={p.id} role="button" onClick={()=>{ TeamLearn.setMe(p.id); setSwitching(false); setStack([]); if(!TeamLearn.manages(p.role)&&['upload','team'].includes(tab)) setTab('today'); refresh(); }} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px 4px 4px',borderRadius:16,border:`1px solid ${p.id===me.id?cr:T.line}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer'}}><TeamFace person={p} size={24}/>{p.name.split(' ')[0]} · {TeamLearn.ROLES[p.role].label}</div>)}
        <div role="button" onClick={()=>{ if(confirm('Change restaurant? This clears this restaurant and everyone\'s training on this device, and goes back to the start.')){ TeamData.reset(); Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); if(typeof TeamSales!=='undefined') TeamSales.clear(); setSwitching(false); setStack([]); setTab('today'); refresh(); } }} data-testid="team-change-restaurant" style={{padding:'4px 12px',borderRadius:16,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer'}}>Change restaurant</div>
      </div>}
      <div ref={scrollRef} data-scroll style={{flex:1,overflowY:'auto',padding:'16px 16px 24px'}}><div style={{maxWidth:720,margin:'0 auto'}}>{set&&<TeamJobChip onOpen={()=>{ if(manager){ setTab('upload'); setStack([]); } }}/>}<ScreenErrorBoundary>{body}</ScreenErrorBoundary></div></div>
      {set&&!top&&<div style={{display:'flex',borderTop:`1px solid ${T.line}`,background:T.bg,paddingBottom:'env(safe-area-inset-bottom)'}}>
        {tabs.map(t=><div key={t.k} role="button" data-testid={'team-tab-'+t.k} onClick={()=>goTab(t.k)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'9px 0 8px',cursor:'pointer'}}>
          {t.k==='vinny'?<div style={{width:20,height:20,borderRadius:10,background:tab===t.k?cr:T.mid,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'11px',fontWeight:800,color:T.bg,fontFamily:C.P,lineHeight:1}}>V</span></div>:<Icon n={t.icon} sz={20} col={tab===t.k?cr:T.mid}/>}<span style={{fontSize:'11px',fontWeight:600,fontFamily:C.P,color:tab===t.k?cr:T.mid}}>{t.label}</span></div>)}
      </div>}
    </div>
  </DeckTheme.Provider>;
}
/* Reading a list and writing training are Claude calls the Worker keeps to Pro accounts during the
   pilot, so a manager signs in (the same emailed code as the consumer app) before uploading. */
// Sign-in is off during the pilot (the Worker's team purposes are open); the account card returns when
// restaurants have accounts.
ReactDOM.createRoot(document.getElementById('root')).render(<TeamApp/>);
