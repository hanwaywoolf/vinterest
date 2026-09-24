/* Vinterest PWA — Home screen */

/* Opens a learning item from Home (Up next, Vinny's "Learn more"): an article, guide, beginner
   article, quiz or Mastery step. */
function _openLearn(item,nav,showPro){
  if(!item) return;
  const quiz=cfg=>{ sessionStorage.setItem('vinterest_quiz_config2',JSON.stringify(cfg)); nav('quiz'); };
  if(item.kind==='scan') return nav('camera');
  if(item.kind==='pro') return showPro&&showPro(item.feature);
  if(item.kind==='article'){ sessionStorage.setItem('vinterest_gen_article',JSON.stringify(item.stub)); return nav('gen-article'); }
  if(item.kind==='guide'){ sessionStorage.setItem('vinterest_guide',item.guide); return nav('guide'); }
  if(item.kind==='onramp'){ sessionStorage.setItem('vinterest_onramp_idx',String(item.idx)); return nav('article'); }
  if(item.kind==='region') return RegionQuizBank.load(item.region,()=>quiz({mode:'region',region:item.region}));
  if(item.kind==='grape') return getGrapeQuiz(item.grape,qs=>{ if(qs&&qs.length) quiz({mode:'grape',grape:item.grape,questions:qs}); else nav('learn'); });
  if(item.kind==='mastery'){ const n=item.next||{}; if(n.quiz) return quiz(n.quiz); if(n.guide){ sessionStorage.setItem('vinterest_guide',n.guide); return nav('guide'); } return nav(n.nav||'learn'); }
  nav('learn');
}

/* Ask Vinny: the wine guide at the top of Home (logic and prompt: Vinny, pwa-vinny.js). Knows
   the user's WineDNA, takes a follow-up, and ends each answer with a "Learn more" link. A
   suggestion tapped fills the box; nothing is sent until they press the arrow. */
function WineChatWidget({wines,nav,showPro}){
  const [q,setQ]=React.useState('');
  const [turns,setTurns]=React.useState([]); // [{q,a,link,err}]
  const [asking,setAsking]=React.useState(false);
  const [focused,setFocused]=React.useState(false);
  const inputRef=React.useRef(null);
  const prompts=React.useMemo(()=>[...Vinny.suggestions(wines)].sort(()=>Math.random()-0.5).slice(0,3),[wines?.length]);
  const [pIdx,setPIdx]=React.useState(0);
  const [typed,setTyped]=React.useState('');
  const [tPhase,setTPhase]=React.useState('typing');
  const [exhausted,setExhausted]=React.useState(false);
  const open=turns.length>0||asking;
  const idle=!open&&!q&&!focused&&!exhausted;

  React.useEffect(()=>{
    if(!idle) return;
    const current=prompts[pIdx]||'';
    let timer;
    if(tPhase==='typing'){
      if(typed.length<current.length) timer=setTimeout(()=>setTyped(current.slice(0,typed.length+1)),32);
      else timer=setTimeout(()=>setTPhase('deleting'),1700);
    } else {
      if(typed.length>0) timer=setTimeout(()=>setTyped(typed.slice(0,-1)),16);
      else if(pIdx+1<prompts.length){setPIdx(i=>i+1);setTPhase('typing');}
      else setExhausted(true);
    }
    return()=>clearTimeout(timer);
  },[idle,typed,tPhase,pIdx,prompts]);

  // A suggestion (or recent question) filled in is theirs to send or to clear: the first
  // backspace on it, untouched, empties the box. Anything they type makes it their own text.
  const filled=React.useRef(null);
  function fill(text){ setQ(text); filled.current=text; setExhausted(true);
    setTimeout(()=>{ const el=inputRef.current; if(el){ el.focus(); el.setSelectionRange(text.length,text.length); } },0); }
  // Caught on the key itself: a backspace with the cursor at the start deletes nothing, so
  // onChange alone would miss it.
  function onKey(e){ if(e.key==='Backspace'&&filled.current&&q===filled.current){ e.preventDefault(); filled.current=null; setQ(''); } }
  function onType(v){
    if(filled.current&&q===filled.current&&v.length<q.length){ filled.current=null; setQ(''); return; }
    filled.current=null; setQ(v);
  }
  function clearQ(){ filled.current=null; setQ(''); inputRef.current&&inputRef.current.focus(); }
  function doAsk(question){
    if(!question||asking) return;
    filled.current=null;
    Vinny.remember(question);
    setAsking(true); setQ('');
    const prev=turns;
    setTurns(t=>[...t,{q:question,a:''}].slice(-3));
    Vinny.ask(question,prev,wines)
      .then(a=>setTurns(t=>t.map((x,i)=>i===t.length-1?{...x,a,link:Vinny.learnLink(question,a)}:x)))
      .catch(()=>setTurns(t=>t.map((x,i)=>i===t.length-1?{...x,err:true}:x)))
      .finally(()=>setAsking(false));
  }
  const recent=focused&&!q&&!open?Vinny.recent().slice(0,3):[];

  return(
    <div style={{margin:'0 16px 8px'}}>
      <form onSubmit={e=>{e.preventDefault();doAsk(q.trim());}} style={{display:'flex',alignItems:'center',gap:10,background:'#000',borderRadius:24,padding:'6px 6px 6px 6px'}}>
        <div aria-hidden="true" style={{width:34,height:34,borderRadius:17,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <span style={{fontSize:16,fontWeight:800,color:'#fff',fontFamily:C.P}}>V</span>
        </div>
        <div style={{flex:1,minWidth:0,position:'relative',height:22}}>
          <input ref={inputRef} value={q} onChange={e=>onType(e.target.value)} onKeyDown={onKey} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} aria-label="Ask Vinny"
            placeholder={open?'Ask a follow-up…':'Ask Vinny about wine…'} style={{position:'absolute',inset:0,width:'100%',border:'none',outline:'none',background:'transparent',fontSize:16,fontFamily:C.P,color:'#fff'}}/>
          {idle&&(
            <div onClick={()=>fill(prompts[pIdx])} style={{position:'absolute',inset:0,display:'flex',alignItems:'center',background:'#000',cursor:'text'}}>
              <span style={{fontSize:16,color:'rgba(255,255,255,0.75)',fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{typed}<span style={{display:'inline-block',width:1.5,height:15,background:'rgba(255,255,255,0.75)',marginLeft:2,verticalAlign:'-2px',animation:'homeCaret 0.9s step-end infinite'}}/></span>
            </div>
          )}
        </div>
        {q&&<button type="button" onClick={clearQ} aria-label="Clear" style={{width:26,height:26,borderRadius:13,border:'none',background:'rgba(255,255,255,0.14)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',padding:0}}>
          <svg width="10" height="10" viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
        </button>}
        <button type="submit" disabled={asking||!q.trim()} aria-label="Ask" style={{width:38,height:38,borderRadius:19,border:'none',background:q.trim()?C.cr:'rgba(255,255,255,0.18)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',cursor:q.trim()?'pointer':'default',padding:0}}>
          <svg width="16" height="16" viewBox="0 0 20 20"><path d="M3 10h13M10 4l6.5 6L10 16" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </form>
      {recent.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:8}}>
        {recent.map(r=><div key={r} onMouseDown={e=>{e.preventDefault();fill(r);}} role="button" style={{padding:'6px 11px',borderRadius:999,background:C.offWhite,border:`1px solid ${C.line}`,fontSize:13,color:C.ink2,fontFamily:C.P,cursor:'pointer',maxWidth:'100%',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r}</div>)}
      </div>}
      {open&&<Card style={{padding:14,marginTop:10,position:'relative',background:'#000',display:'flex',flexDirection:'column',gap:12}}>
        <div role="button" aria-label="Close" onClick={()=>setTurns([])} style={{position:'absolute',top:10,right:10,width:24,height:24,borderRadius:12,background:'rgba(255,255,255,0.12)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <svg width="11" height="11" viewBox="0 0 20 20"><path d="M4 4l12 12M16 4L4 16" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </div>
        <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.45)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.08em'}}>Vinny</div>
        {turns.map((t,i)=>(
          <div key={i} style={{display:'flex',flexDirection:'column',gap:6}}>
            <div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P,paddingRight:24}}>{t.q}</div>
            {t.err?<div style={{fontSize:15,color:'rgba(255,255,255,0.7)',fontFamily:C.P}}>Couldn't get an answer. Try again.</div>
              :t.a?<div style={{fontSize:16,color:'#fff',fontFamily:C.P,lineHeight:1.5}}>{t.a}</div>
              :<div style={{fontSize:15,color:'rgba(255,255,255,0.7)',fontFamily:C.P,fontStyle:'italic'}}>Thinking…</div>}
            {t.link&&i===turns.length-1&&<div role="button" onClick={()=>_openLearn(t.link,nav,showPro)} style={{alignSelf:'flex-start',display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:999,background:'rgba(255,255,255,0.1)',cursor:'pointer'}}>
              <Icon n="book" sz={14} col="#fff"/>
              <span style={{fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P}}>Learn more: {t.link.label}</span>
            </div>}
          </div>
        ))}
      </Card>}
    </div>
  );
}

/* Bottles waiting on the user: shelf checks to confirm ("Did you buy it?") and wines they've
   drunk or bought but not scored. Each score sharpens WineDNA and every match. */
function WaitingOnYou({nav}){
  const [v,setV]=React.useState(0);
  const {toScore,toAsk}=React.useMemo(()=>WineHistory.pending(),[v]);
  if(!toScore.length&&!toAsk.length) return null;
  const ask=toAsk[0];
  const open=w=>{
    sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,source:'history',view:'rate',wine:w}));
    nav('identified');
  };
  return <Card style={{padding:0,overflow:'hidden'}}>
    <div style={{padding:'12px 14px 8px'}}>
      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Waiting on you</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:1}}>Every score sharpens your matches.</div>
    </div>
    {ask&&<div style={{padding:'10px 14px 12px',borderTop:`1px solid ${C.line}`}}>
      <div style={{fontSize:15,color:C.ink,fontFamily:C.P,lineHeight:1.45}}>Did you buy the <b>{ask.name}</b>{ask.vintage?` ${ask.vintage}`:''}?</div>
      <div style={{display:'flex',gap:8,marginTop:8}}>
        <Btn small primary onClick={()=>{ WineHistory.setBought(ask.name,ask.vintage,true); setV(x=>x+1); }}>Yes, I bought it</Btn>
        <Btn small onClick={()=>{ WineHistory.setBought(ask.name,ask.vintage,false); setV(x=>x+1); }}>No</Btn>
      </div>
    </div>}
    {toScore.slice(0,3).map(w=>(
      <div key={w.name+'|'+w.vintage} onClick={()=>open(w)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{w.bought&&w.scan_intent==='checking'?'Bought':'Tasted'}, not scored yet</div>
        </div>
        <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,flexShrink:0}}>Score it →</span>
      </div>
    ))}
    {toScore.length>3&&<div onClick={()=>nav('mywines')} style={{padding:'8px 14px 12px',borderTop:`1px solid ${C.line}`,fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>{toScore.length-3} more in My Wines →</div>}
  </Card>;
}

/* Home is "what next": Waiting on you, one Up next action and two more (LearnNext.home), the
   pieces written for them, their recent scans, their WineDNA at a glance with an Explore Next
   pick, and their knowledge (level, XP and the Mastery teaser). */
function HomeScreen({nav, showPro, isTablet}){
  const [travel,setTravel]=React.useState(()=>Regional.travel());
  React.useEffect(()=>{
    const h=()=>setTravel(Regional.travel());
    window.addEventListener('vinterest:travel',h);
    return()=>window.removeEventListener('vinterest:travel',h);
  },[]);
  const [xpData,setXpData]=React.useState(()=>XPSystem.get());
  React.useEffect(()=>{
    const h=()=>setXpData(XPSystem.get());
    window.addEventListener('vinterest:xp',h);
    return()=>window.removeEventListener('vinterest:xp',h);
  },[]);

  const allWines=WineHistory.getAll();
  const isPro=!!localStorage.getItem('vinterest_pro');
  const sig=WineDNA.signature(allWines);
  const next=React.useMemo(()=>LearnNext.home(allWines),[sig]);
  const shelf=next.unread.filter(x=>!(next.primary&&next.primary.stub&&next.primary.stub.id===x.id)).slice(0,2);
  const knowledge=React.useMemo(()=>allWines.length?KnowledgeMap.summary(allWines):null,[sig]);

  const recentWines=React.useMemo(()=>[...allWines]
    .sort((a,b)=>new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0))
    .slice(0,3)
  ,[sig]);

  /* WineDNA at a glance: the types they drink most, and an Explore Next pick for the main one. */
  const dna=React.useMemo(()=>{
    const counts={}; allWines.filter(w=>WineDNA.chosen(w)).forEach(w=>{ const t=WineDNA._t(w.type); if(t) counts[t]=(counts[t]||0)+1; });
    const types=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>{
      const label=ContentEngine._typeLabel(k), p=WineDNA.profile(k,allWines,label);
      const best=p.favourites.regions[0]||null;
      return {key:k,label,col:(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS[k])||C.cr,
        line:p.scored.length?`${p.personality}${best?` · best from ${best.name}`:''}`:`${WineDNA.noun(k,p.wines.length)} scanned, none scored yet`};
    });
    let pick=null;
    if(types[0]){ try{ const e=ExploreNext.suggest(types[0].key,allWines,types[0].label,1); pick=e.picks[0]?{...e.picks[0],typeKey:types[0].key,typeLabel:types[0].label}:null; }catch(e){} }
    return {types,pick};
  },[sig]);

  const lv=XPSystem.getLevel(xpData.total);
  const nx=XPSystem.nextLevel(xpData.total);
  const pg=XPSystem.levelProgress(xpData.total);
  const openWine=w=>{ sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0})); nav('detail'); };
  const colFor=w=>(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS[WineDNA._t(w.type)||'red'])||C.cr;
  const head=(title,link,onLink)=><div style={{padding:'12px 14px 7px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
    <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{title}</span>
    {link&&<span onClick={onLink} role="button" style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{link}</span>}
  </div>;
  const row=(key,icon,col,title,sub,onClick,right)=><div key={key} onClick={onClick} role="button" style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
    <div style={{width:34,height:34,borderRadius:10,background:col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon n={icon} sz={16} col={col}/></div>
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{title}</div>
      {sub&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{sub}</div>}
    </div>
    {right||<Icon n="chevron" sz={13} col={C.mid}/>}
  </div>;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg,position:'relative'}}>
      <div style={{background:C.white,flexShrink:0}}>
        <div style={{padding:'14px 20px 14px',paddingRight:'120px',display:'flex',alignItems:'center',gap:12}}>
          <div onClick={()=>nav('account')} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="user" sz={16} col={C.ink}/>
          </div>
          <img src="logo.png" alt="Vinterest" style={{height:28,width:'auto',display:'block',cursor:'pointer'}} onClick={()=>{
            // Tapping the logo checks for a new version of the app (and shows the update banner).
            if(!('serviceWorker' in navigator)) return;
            navigator.serviceWorker.getRegistration().then(function(reg){
              if(!reg) return;
              reg.update().then(function(){
                if(reg.waiting){ var banner=document.getElementById('vinterest-update-banner'); if(banner) banner.style.display='flex'; }
                else reg.addEventListener('updatefound',function(){
                  var nw=reg.installing;
                  nw.addEventListener('statechange',function(){
                    if(nw.state==='installed'&&navigator.serviceWorker.controller){ var banner=document.getElementById('vinterest-update-banner'); if(banner) banner.style.display='flex'; }
                  });
                });
              });
            });
          }}/>
        </div>
        <WineChatWidget wines={allWines} nav={nav} showPro={showPro}/>
      </div>

      {travel&&(
        <div onClick={()=>nav('account')} style={{background:C.cr,padding:'6px 20px',display:'flex',alignItems:'center',justifyContent:'center',gap:6,cursor:'pointer',flexShrink:0}}>
          <Icon n="compass" sz={12} col="#fff"/>
          <span style={{fontSize:12,fontWeight:600,color:'#fff',fontFamily:C.P}}>Travel Mode On · {travel.country}</span>
        </div>
      )}

      <div style={{flex:1,overflowY:'auto',overscrollBehavior:'none',WebkitOverflowScrolling:'touch'}}>
      <div style={{padding:'8px 20px',display:'flex',flexDirection:'column',gap:12}}>

        <WaitingOnYou nav={nav}/>

        {/* Up next: one clear thing to do, two more under it */}
        {next.primary&&<div>
          <div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.07em',textTransform:'uppercase',fontFamily:C.P,margin:'4px 2px 8px'}}>Up next</div>
          <div role="button" onClick={()=>_openLearn(next.primary,nav,showPro)} style={{background:C.ink,borderRadius:16,padding:16,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
            <div style={{width:46,height:46,borderRadius:12,background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={next.primary.icon||'book'} sz={21} col="#fff"/></div>
            <div style={{flex:1,minWidth:0}}>
              {next.primary.progress&&<div style={{fontSize:12,fontWeight:600,color:'rgba(255,255,255,0.5)',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{next.primary.progress}</div>}
              <div style={{fontSize:17,fontWeight:700,color:'#fff',fontFamily:C.P,lineHeight:1.3}}>{next.primary.title}</div>
              <div style={{fontSize:14,color:'rgba(255,255,255,0.6)',fontFamily:C.P,lineHeight:1.4,marginTop:3}}>{next.primary.why}</div>
            </div>
            <Icon n="chevron" sz={14} col="rgba(255,255,255,0.4)"/>
          </div>
          {next.more.length>0&&<Card style={{padding:0,overflow:'hidden',marginTop:8}}>
            {next.more.map((m,i)=><div key={m.key} style={i===0?{marginTop:-1}:null}>{row(m.key,m.icon||'book',C.cr,m.title,m.why,()=>_openLearn(m,nav,showPro))}</div>)}
          </Card>}
        </div>}

        {/* Written for you: the next unread pieces */}
        {shelf.length>0&&<Card style={{padding:0,overflow:'hidden'}}>
          {head('Written for you','All →',()=>nav('learn'))}
          {shelf.map(st=>row(st.id,st.iconName||'read',C.cr,st.title,ContentEngine.because(st,allWines),()=>_openLearn({kind:'article',stub:st},nav,showPro)))}
        </Card>}

        {/* Recently scanned */}
        {recentWines.length>0&&<Card style={{padding:0,overflow:'hidden'}}>
          {head('Recently scanned','All →',()=>nav('mywines'))}
          {recentWines.map((w,i)=>row('r'+i,'wine',colFor(w),w.name,MyWines.subline(w),()=>openWine(w),
            w.rating>0?<span style={{fontSize:15,fontWeight:700,color:C.amber,fontFamily:C.P,flexShrink:0}}>{w.rating}</span>
              :<span style={{fontSize:13,color:C.cr,fontFamily:C.P,flexShrink:0,fontWeight:600}}>Score it →</span>))}
        </Card>}

        {/* WineDNA at a glance */}
        {dna.types.length>0&&<Card style={{padding:0,overflow:'hidden'}}>
          {head('Your WineDNA','Open →',()=>{ UserPrefs.openDNA(dna.types[0].key); nav('profile'); })}
          {dna.types.map(t=>row(t.key,'wine',t.col,t.label,t.line,()=>{ UserPrefs.openDNA(t.key); nav('profile'); }))}
          {dna.pick&&row('explore','compass',C.cr,`Try next: ${dna.pick.style.name}`,`Explore Next · ${dna.pick.style.country}`,()=>{
            sessionStorage.setItem('vinterest_style_explore',JSON.stringify({id:dna.pick.style.id,typeKey:dna.pick.typeKey,label:dna.pick.typeLabel})); nav('style-explore'); })}
          {row('script','message',C.cr,`Your ${(WineDNA.NOUNS[dna.types[0].key]||['wine'])[0]} sommelier script`,'What to say when you order',()=>{ UserPrefs.openDNA(dna.types[0].key,'scripts'); nav('profile'); })}
        </Card>}

        {/* Your knowledge: level and XP, and the Mastery teaser (the full map is Pro) */}
        <Card onClick={()=>knowledge?(isPro?nav('mastery-map'):showPro('mastery-map')):nav('learn')} style={{padding:14,cursor:'pointer',display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{lv.badge} {lv.name}</span>
            <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{xpData.total} XP{nx?` · ${nx.min-xpData.total} to ${nx.name}`:''}</span>
          </div>
          <Prog val={pg} h={5} col={C.cr}/>
          {knowledge&&<div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{flex:1,fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.45}}>
              Wine knowledge {knowledge.overall}%{knowledge.strongest?<> · strongest in <b>{knowledge.strongest.label}</b></>:null}{knowledge.gap?<> · biggest gap <b>{knowledge.gap.label}</b></>:null}
            </div>
            {!isPro&&<ProBadge/>}
          </div>}
        </Card>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes homeCaret{50%{opacity:0}}`}</style>
    </div>
  );
}

Object.assign(window,{HomeScreen});
