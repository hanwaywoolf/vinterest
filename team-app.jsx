/* The restaurant staff-training app's shell (docs/business.md): set-up on first run, then tabs for
   the person training on this device (staff: Today, Wines, Menu; a manager, buyer or sommelier also Upload and
   Team), with detail views (a wine, a dish, the drill) pushed on top and Back popping them. Always
   on the dark stage. Booted instead of the consumer app's pwa-app.jsx (scripts/app-sources.mjs). */
const TEAM_TABS=[
  {k:'today',label:'Today',icon:'home'},{k:'vinny',label:'Vinny',icon:'vinny'},{k:'wines',label:'Wines',icon:'wine'},{k:'menu',label:'Menu',icon:'fork'},
  {k:'upload',label:'Upload',icon:'camera',manager:true},{k:'team',label:'Team',icon:'user',manager:true},
];
function TeamApp(){
  TeamBrand.apply(); // first, so every colour below is the restaurant's own
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
  // The staff app on an iPad (768px and up, the consumer app's useLayoutSize): the tabs become a rail down the left, the
  // page runs to 1000px with Today and Practise in two columns, and Wines and Menu open a wine or dish beside the
  // list rather than over it (docs/business.md "The staff app on a tablet"). The phone layout never changes.
  const wide=size!=='phone';
  const [phoneView,setPhoneView]=React.useState(viewParam==='phone'||viewParam==='say'), [section,setSection]=React.useState('dash'), [wantConsole,setWantConsole]=React.useState(false);
  React.useEffect(()=>{ const h=()=>refresh(); window.addEventListener('vbiz:data',h); window.addEventListener('vinterest:account',h);
    return ()=>{ window.removeEventListener('vbiz:data',h); window.removeEventListener('vinterest:account',h); }; },[]);
  // /team/?seed=demo opens straight onto the demo restaurant (the wine-show laptop), replacing whatever
  // restaurant the device holds unless it's already this build's copy of it (so a reload keeps progress, and a
  // new build with more written in replaces a stale one).
  React.useEffect(()=>{ try{ const q=new URLSearchParams(location.search), host=TeamSample.hostSeed();
    // A restaurant's own address (demo.vinterest.team, socialcorner.vinterest.team) opens that restaurant every time, whatever
    // ?seed the link carries or the device last held; a ?seed is dropped from the address.
    if(host){ if(!TeamLearn.me()||!TeamSample.current(host)) TeamSample.load(host); if(q.get('seed')){ q.delete('seed'); const rest=q.toString(); history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')); } refresh(); return; }
    const seed=q.get('seed'); if(!seed&&TeamSample.retire()) refresh();
    // The Social Corner is a demo install: a device holding an older copy of its files takes the new one, with or without ?seed.
    const held=(TeamData.get().venue||{}).sample; if(!seed&&(TeamSample.social(held)||held==='demo')&&!TeamSample.current(held)){ TeamSample.load(held); refresh(); } if(seed){ if(!TeamLearn.me()||!TeamSample.current(seed)) TeamSample.load(seed); q.delete('seed'); const rest=q.toString(); history.replaceState(null,'',location.pathname+(rest?'?'+rest:'')); refresh(); } }catch(e){} },[]);
  TeamBrand.apply(); // again after a seed may have just loaded a restaurant
  const me=TeamLearn.me(), set=!!me, brand=TeamData.brand();
  const manager=me&&TeamLearn.canConsole(me);
  const tabs=TEAM_TABS.filter(t=>!t.manager||manager);
  const goTab=k=>{ posRef.current=[]; pendRef.current=0; setTab(k); setStack([]); };
  // The console on any screen for someone allowed it (TeamLearn.canConsole): Today's figures open their own section of it.
  const toConsole=sec=>{ setSection(sec||'dash'); setWantConsole(true); setPhoneView(false); setStack([]); };
  const DETAIL=['wine','cocktail','dish'], LISTS=['wines','menu'];
  const open=v=>{ if(v.console){ if(manager) toConsole(v.console); return; } if(v.tab){ goTab(v.tab); return; }
    // Beside the list on a tablet, another row replaces the one open rather than stacking on it.
    const t0=stack[stack.length-1]; if(wide&&stack.length===1&&t0&&DETAIL.includes(t0.view)&&DETAIL.includes(v.view)&&LISTS.includes(tab)){ pendRef.current=0; setStack([v]); return; }
    posRef.current[stack.length]=scrollNow(); pendRef.current=0; setStack(s=>[...s,v]); };
  const consoleOn=set&&manager&&(forceConsole||wantConsole||size!=='phone')&&!phoneView;
  const toPhone=v=>{ setPhoneView(true); setWantConsole(false); setStack([]); if(v&&v.pid&&TeamLearn.person(v.pid)) TeamLearn.setMe(v.pid); if(v&&v.tab) setTab(v.tab); else setTab('today'); if(v&&v.view==='drill') setStack([{view:'drill',only:v.only,part:v.part}]); refresh(); };
  if(consoleOn) return <DeckTheme.Provider value={_DECK_DARK}><div data-gen={gen} style={{position:'absolute',inset:0,color:T.ink}}><ScreenErrorBoundary>{TeamData.consoleLook()==='preview'?<TeamConsole2 me={me} onPhone={toPhone} refresh={refresh} section={section} setSection={setSection} tour/>:<TeamConsole me={me} onPhone={toPhone} refresh={refresh} section={section} setSection={setSection} tour/>}</ScreenErrorBoundary></div></DeckTheme.Provider>;
  const back=()=>{ pendRef.current=posRef.current[stack.length-1]||0; setStack(s=>s.slice(0,-1)); };
  const top=stack[stack.length-1];
  let body;
  // A restaurant's own address (demo.vinterest.team is The Larkspur and nothing else) never shows the setup screen, which
  // offers the other restaurants: its seed loads straight after the first draw.
  if(!set) body=TeamSample.hostSeed()?null:<TeamSetup onDone={refresh}/>;
  // Every view on the stack stays mounted under the one on top (hidden), so a drill's summary is still there,
  // with its answers, when Back returns from a wine it opened.
  else if(top) body=stack.map((v,i)=><div key={i} style={{display:i===stack.length-1?'block':'none'}}>{v.view==='wine'?<TeamWine id={v.id} pid={me.id} open={open}/>:v.view==='cocktail'?<TeamCocktail id={v.id} pid={me.id} open={open}/>:v.view==='dish'?<TeamDish id={v.id} pid={me.id} open={open}/>
    :v.view==='guest'?null /* the table is a layer over the whole app, below */
    :v.view==='ask'?<TeamVinnyAsk pid={me.id} open={open}/>
    :v.view==='tonight'?<TeamTonightEdit back={back} pid={me.id} open={open}/>
    :v.view==='briefing'?<TeamBriefing pid={me.id}/>
    :v.view==='vtest'?<TeamVinnyTest pid={me.id} open={open}/>
    :v.view==='say'?<TeamSayCheck/>
    :<TeamDrill pid={me.id} only={v.only} part={v.part} given={v.qs} intro={v.intro} back={back} open={open}/>}</div>);
  else body=tab==='today'?<TeamToday pid={me.id} open={open}/>:tab==='vinny'?<TeamVinnyTab pid={me.id} open={open}/>:tab==='wines'?<TeamWines pid={me.id} open={open}/>:tab==='menu'?<TeamMenu open={open}/>
    :tab==='upload'?<TeamUpload onChanged={refresh} background/>:<TeamPeople open={open} onChanged={refresh}/>;
  return <DeckTheme.Provider value={_DECK_DARK}>
    <div data-gen={gen} style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:`radial-gradient(ellipse at 50% -10%, ${_alpha((brand&&brand.accent)||cr,0.3)}, transparent 60%) ${T.bg}`,color:T.ink}}>
      {set&&<div style={{padding:'calc(env(safe-area-inset-top) + 12px) 16px 10px',display:'flex',alignItems:'center',gap:10,borderBottom:`1px solid ${T.line}`}}>
        {top&&top.view!=='guest'?<div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={T.ink}/></div>
          :brand&&brand.mark?<img src={brand.mark} alt="" style={{height:26,width:26,borderRadius:13,boxShadow:`0 0 0 1px ${_alpha(brand.accent||'#ffffff',0.6)}`}} onError={e=>{ e.target.style.display='none'; }}/>
          :<img src="/logo.png" alt="" style={{height:20,filter:'invert(1)'}} onError={e=>{ e.target.style.display='none'; }}/>}
        {/* An installed restaurant shows its own wordmark where the name would be (venue.brand). */}
        <div style={{flex:1,minWidth:0,fontSize:15,fontWeight:700,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{brand&&brand.logo?<TeamVenueLogo height={18}/>:(TeamData.get().venue.name||'Your restaurant')}</div>
        {manager&&<div role="button" data-testid="team-to-console" onClick={()=>toConsole(section)} style={{padding:'5px 10px',borderRadius:14,border:`1px solid ${T.line}`,fontSize:12,fontFamily:C.P,color:T.ink2,cursor:'pointer',whiteSpace:'nowrap'}}>Console</div>}
        {/* On a phone the person is their face alone, so the restaurant's name has the room; the switcher it opens names everyone, and Today greets them by name and role. */}
        <div role="button" data-testid="team-who" aria-label={`${me.name}, ${TeamLearn.ROLES[me.role].label}. Switch person`} onClick={()=>setSwitching(x=>!x)} style={{display:'flex',alignItems:'center',gap:8,padding:size==='phone'?2:'4px 10px 4px 4px',borderRadius:18,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer',flexShrink:0}}><TeamFace person={me} size={28}/>{size!=='phone'&&<>{me.name.split(' ')[0]} · {TeamLearn.ROLES[me.role].label}</>}</div>
      </div>}
      {switching&&<div style={{padding:'8px 16px',borderBottom:`1px solid ${T.line}`,display:'flex',gap:6,flexWrap:'wrap'}}>
        {TeamLearn.people().map(p=><div key={p.id} role="button" onClick={()=>{ TeamLearn.setMe(p.id); setSwitching(false); setStack([]); if(!TeamLearn.canConsole(p)&&['upload','team'].includes(tab)) setTab('today'); refresh(); }} style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px 4px 4px',borderRadius:16,border:`1px solid ${p.id===me.id?cr:T.line}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer'}}><TeamFace person={p} size={24}/>{p.name.split(' ')[0]} · {TeamLearn.ROLES[p.role].label}</div>)}
        {!TeamSample.hostSeed()&&<div role="button" onClick={()=>{ if(confirm('Change restaurant? This clears this restaurant and everyone\'s training on this device, and goes back to the start.')){ TeamData.reset(); Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); if(typeof TeamSales!=='undefined') TeamSales.clear(); setSwitching(false); setStack([]); setTab('today'); refresh(); } }} data-testid="team-change-restaurant" style={{padding:'4px 12px',borderRadius:16,border:`1px solid ${T.line}`,fontSize:13,fontFamily:C.P,color:T.ink2,cursor:'pointer'}}>Change restaurant</div>}
      </div>}
      {(()=>{
        // One tab, drawn in the bottom bar on a phone and on the rail on a tablet (where the active one carries a tint).
        const tabBtn=(t,rail)=><div key={t.k} role="button" data-testid={'team-tab-'+t.k} aria-current={tab===t.k?'page':undefined} onClick={()=>goTab(t.k)} style={{flex:rail?'none':1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:rail?'12px 0 10px':'9px 0 8px',margin:rail?'0 10px 4px':0,borderRadius:rail?14:0,background:rail&&tab===t.k?_alpha(cr,0.14):'transparent',cursor:'pointer'}}>
          {t.k==='vinny'?<div style={{width:20,height:20,borderRadius:10,background:tab===t.k?cr:T.mid,display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:'11px',fontWeight:800,color:T.bg,fontFamily:C.P,lineHeight:1}}>V</span></div>:<Icon n={t.icon} sz={20} col={tab===t.k?cr:T.mid}/>}<span style={{fontSize:'11px',fontWeight:600,fontFamily:C.P,color:tab===t.k?cr:T.mid}}>{t.label}</span></div>;
        // On a tablet a wine, cocktail or dish opened from its list sits beside the list (the list keeps its own scroll); deeper views (a drill from the wine) take the width.
        const split=wide&&set&&!!top&&stack.length===1&&DETAIL.includes(top.view)&&LISTS.includes(tab);
        return <>
          <div style={{flex:1,minHeight:0,display:'flex'}}>
            {set&&wide&&<div data-testid="team-rail" style={{width:84,flexShrink:0,borderRight:`1px solid ${T.line}`,display:'flex',flexDirection:'column',paddingTop:10,paddingBottom:'env(safe-area-inset-bottom)'}}>{tabs.map(t=>tabBtn(t,true))}</div>}
            {split&&<div data-testid="team-split-list" style={{width:'38%',minWidth:300,maxWidth:440,flexShrink:0,borderRight:`1px solid ${T.line}`,overflowY:'auto',padding:'16px 14px 24px'}}>{tab==='wines'?<TeamWines pid={me.id} open={open} selected={top.id}/>:<TeamMenu open={open} selected={top.id}/>}</div>}
            <div ref={scrollRef} data-scroll data-split={split?'1':undefined} style={{flex:1,minWidth:0,overflowY:'auto',padding:'16px 16px 24px'}}><div style={{maxWidth:wide?(split?760:top?760:1000):720,margin:'0 auto'}}>{set&&<TeamJobChip onOpen={()=>{ if(manager){ setTab('upload'); setStack([]); } }}/>}<ScreenErrorBoundary>{body}</ScreenErrorBoundary></div></div>
          </div>
          {set&&!top&&!wide&&<div style={{display:'flex',borderTop:`1px solid ${T.line}`,background:T.bg,paddingBottom:'env(safe-area-inset-bottom)'}}>{tabs.map(t=>tabBtn(t,false))}</div>}
        </>; })()}
      {/* A guest at the table (TeamGuest) covers the header and tabs: a chat wants the whole screen. It stays mounted
          under a wine or dish it opened, and comes back when that is popped. */}
      {/* The pre-shift briefing (TeamShift.needsAck): sent today and not yet accepted by this person, it covers the whole
          app until they tap Got it. */}
      {set&&TeamShift.needsAck(me.id)&&<div style={{position:'absolute',inset:0,zIndex:30}}><ScreenErrorBoundary><TeamBriefing pid={me.id} onAck={()=>{ TeamShift.ack(me.id); refresh(); }}/></ScreenErrorBoundary></div>}
      {set&&stack.map((v,i)=>v.view==='guest'&&<div key={i} style={{position:'absolute',inset:0,zIndex:20,display:i===stack.length-1?'block':'none'}}><ScreenErrorBoundary><TeamGuest pid={me.id} back={back} open={open}/></ScreenErrorBoundary></div>)}
    </div>
  </DeckTheme.Provider>;
}
/* Reading a list and writing training are Claude calls the Worker keeps to Pro accounts during the
   pilot, so a manager signs in (the same emailed code as the consumer app) before uploading. */
// Sign-in is off during the pilot (the Worker's team purposes are open); the account card returns when
// restaurants have accounts.
ReactDOM.createRoot(document.getElementById('root')).render(<TeamApp/>);
