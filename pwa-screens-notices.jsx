/* Vinterest PWA — Notifications: the inbox behind the bell on Home (records: Notices, pwa-notices.js).
   Each row opens the thing it's about (an article, a quiz, a bottle, Mastery, the camera) and is
   read once opened. Nothing here is a reminder to scan unless it's been a while. */

/* The bell in Home's header, with the unread count. */
function NoticeBell({nav,dark}){
  const [n,setN]=React.useState(()=>Notices.unread());
  React.useEffect(()=>{ const h=()=>setN(Notices.unread()); window.addEventListener('vinterest:notices',h); window.addEventListener('vinterest:sync',h); return()=>{ window.removeEventListener('vinterest:notices',h); window.removeEventListener('vinterest:sync',h); }; },[]);
  const col=dark?'#fff':C.ink;
  return <div role="button" aria-label={`Notifications${n?`, ${n} unread`:''}`} data-testid="notice-bell" onClick={()=>nav('notices')}
    style={{position:'absolute',top:'calc(env(safe-area-inset-top) + 13px)',right:14,zIndex:200,width:38,height:38,borderRadius:19,background:dark?'rgba(255,255,255,0.08)':C.crSoft,border:`1px solid ${dark?'rgba(255,255,255,0.16)':C.crDim}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',pointerEvents:'auto'}}>
    <Icon n="bell" sz={18} col={col}/>
    {n>0&&<span data-testid="notice-count" style={{position:'absolute',top:-4,right:-4,minWidth:18,height:18,padding:'0 5px',borderRadius:9,background:dark?'#E05A74':C.cr,color:'#fff',fontSize:'11px',fontWeight:700,fontFamily:C.P,display:'flex',alignItems:'center',justifyContent:'center',boxSizing:'border-box',border:`2px solid ${dark?'#0E0E10':C.white}`}}>{n>9?'9+':n}</span>}
  </div>;
}

/* Where a notice points. */
function _openNotice(n,nav,showPro){ return _openLink(Notices.open(n.id)||{},nav,showPro); }
/* Where a link goes: a notice's, or a push notification's (same shapes: {learn}, {wine}, {dna}, {screen}). */
function _openLink(link,nav,showPro){
  link=link||{};
  if(link.learn){ const l=link.learn; if(l.kind==='article'){ const stub=ContentEngine.openShelf(WineHistory.getAll()).find(s=>s.id===l.id); if(!stub) return nav('learn'); return _openLearn({kind:'article',stub},nav,showPro); } return _openLearn(l,nav,showPro); }
  if(link.wine){ const w=WineHistory.find(link.wine); if(!w) return nav('mywines'); Handoff.openWine({demo:false,source:'history',view:'rate',wine:w}); return nav('identified'); }
  if(link.dna){ UserPrefs.openDNA(link.dna.type,link.dna.section); return nav('profile'); }
  if(link.screen) return nav(link.screen);
  nav('home');
}

function NoticesScreen({nav,back,showPro}){ const T=useTheme(), cr=T.lift(C.cr);
  const [items,setItems]=React.useState(()=>Notices.list());
  React.useEffect(()=>{ const h=()=>setItems(Notices.list()); window.addEventListener('vinterest:notices',h); window.addEventListener('vinterest:sync',h); return()=>{ window.removeEventListener('vinterest:notices',h); window.removeEventListener('vinterest:sync',h); }; },[]);
  const unread=items.filter(n=>!n.read).length;
  const day=n=>{ const d=Date.now()-n.at; return d<24*3600*1000?'Today':d<7*24*3600*1000?'This week':'Earlier'; };
  const groups=[]; items.forEach(n=>{ const g=day(n); const last=groups[groups.length-1]; if(last&&last.label===g) last.items.push(n); else groups.push({label:g,items:[n]}); });
  return <div data-testid="screen-notices" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:T.bg}}>
    <div style={{background:`radial-gradient(ellipse at 50% -20%, ${_alpha(cr,T.dark?0.42:0.14)}, transparent 70%) ${T.dark?T.bg:C.white}`,padding:'14px 20px 12px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
      <div onClick={back} aria-label="Back" role="button" style={{width:36,height:36,borderRadius:18,background:T.soft,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={T.ink}/></div>
      <div style={{flex:1,fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P}}>Notifications</div>
      {unread>0&&<div role="button" onClick={()=>Notices.markAllRead()} style={{fontSize:13,fontWeight:700,color:cr,fontFamily:C.P,cursor:'pointer'}}>Mark all read</div>}
    </div>
    <div style={{flex:1,overflowY:'auto',padding:'4px 16px 24px'}}>
      {!items.length&&<Card style={{padding:18,textAlign:'center'}}>
        <Icon n="bell" sz={26} col={T.mid}/>
        <div style={{fontSize:16,fontWeight:700,color:T.ink,fontFamily:C.P,marginTop:8}}>Nothing yet</div>
        <div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.5,marginTop:4}}>New pieces written for you, milestones you reach and bottles waiting for a rating will show here.</div>
      </Card>}
      {groups.map(g=><div key={g.label} style={{marginTop:14}}>
        <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.08em',color:T.mid,fontFamily:C.P,marginBottom:8}}>{g.label.toUpperCase()}</div>
        <Card style={{padding:0,overflow:'hidden'}}>
          {g.items.map((n,i)=>{ const tp=Notices.TYPES[n.type]||Notices.TYPES.content;
            return <div key={n.id} role="button" data-testid={`notice-${n.id}`} onClick={()=>_openNotice(n,nav,showPro)} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 14px',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer',background:n.read?'transparent':_alpha(cr,T.dark?0.08:0.05)}}>
              <div style={{width:36,height:36,borderRadius:18,background:T.tint(cr),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2}}><Icon n={tp.icon} sz={17} col={cr}/></div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1,fontSize:15,fontWeight:n.read?600:800,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{n.title}</div>
                  {!n.read&&<span aria-label="Unread" style={{width:8,height:8,borderRadius:4,background:cr,flexShrink:0}}/>}
                </div>
                {n.text&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.45,marginTop:2}}>{n.text}</div>}
                <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:4}}>{tp.label} · {Notices.when(n.at)}</div>
              </div>
            </div>; })}
        </Card>
      </div>)}
      <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:18,textAlign:'center'}}>Choose what shows here under <span onClick={()=>nav('account')} style={{color:cr,fontWeight:700,cursor:'pointer'}}>Profile → Notifications</span>.</div>
    </div>
  </div>;
}
