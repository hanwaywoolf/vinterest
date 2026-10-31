/* The management console (docs/business.md, "The management console"): the same /team/ app laid out
   for a tablet or a laptop browser, for a manager or buyer. A sidebar of sections and a page for
   each; every figure comes from TeamReport (never computed here), every number opens the people or
   wines behind it, and nothing a manager changes bypasses the draft and Publish path. Dark stage
   throughout. `?view=console` forces it on a narrow window too (the sidebar becomes a row of chips)
   so it can be checked on a phone. Sales figures are labelled "Demo data" while the till is the
   demo's invented sales (TeamSales.demo). */
const CONSOLE_SECTIONS=[
  {k:'dash',label:'Dashboard',icon:'home'},{k:'team',label:'Team',icon:'user'},{k:'wines',label:'Wines',icon:'wine'},{k:'menu',label:'Menu',icon:'fork'},
  {k:'upload',label:'Upload',icon:'camera'},{k:'pos',label:'Integrations',icon:'bolt'},{k:'admin',label:'Admin',icon:'edit'},
];
const _cMoney=(n,{dp=0}={})=>{ const cur=TeamData.currency(); const v=Math.abs(n)>=10000&&!dp?`${(n/1000).toFixed(1)}k`:n.toFixed(dp); return `${cur.sym}${v}`; };
const _cPct=v=>v==null?'—':`${Math.round(v*100)}%`;
const _cAgo=ms=>{ if(!ms) return 'never'; const d=Math.round((Date.now()-ms)/86400000); return d<=0?'today':d===1?'yesterday':`${d} days ago`; };
const _cDate=ms=>new Date(ms).toLocaleDateString(undefined,{day:'numeric',month:'short'});
/* A section heading on a console page. */
const _cH=(T,t,sub,right)=><div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12,margin:'0 0 12px'}}><div><div style={{fontSize:22,fontWeight:800,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{t}</div>{sub&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.45}}>{sub}</div>}</div>{right}</div>;
const _cLabel=(T,t,right)=><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,fontSize:12,fontWeight:700,color:T.ink,fontFamily:C.P,letterSpacing:'0.08em',textTransform:'uppercase',margin:'0 0 10px'}}><span style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}><span style={{width:3,height:12,borderRadius:2,background:T.lift(C.cr),flexShrink:0}}/><span>{t}</span></span>{right}</div>;
/* A second section inside the same card: a divider above it, so it never reads as the tail of the one before. */
const _cSub=(T,t,right)=><div style={{marginTop:18,paddingTop:14,borderTop:`1px solid ${T.line}`}}>{_cLabel(T,t,right)}</div>;
const _cNote=(T,t)=><div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:10,lineHeight:1.45}}>{t}</div>;
/* A wine's name with its type's dot before it. */
const _cWineLead=(T,w)=><span style={{width:8,height:8,borderRadius:4,background:_tTypeCol(T,w.type),flexShrink:0,display:'inline-block'}}/>;
/* A small chip: a count with a colour that says what kind of thing it is. */
const _cGrey='#A8ACB3';
const _cChip=(T,label,col)=>{ const c=/^#/.test(col||'')?col:_cGrey; return <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:8,border:`1px solid ${_alpha(c,0.45)}`,background:_alpha(c,0.12),fontSize:12,fontWeight:600,color:c,fontFamily:C.P,whiteSpace:'nowrap'}}>{label}</span>; };
/* A row with a thin bar: the dot, the name, the figure at the right, the bar in the given colour under. */
function _CRow({lead,label,value,share,col,sub,right,onClick,testid}){ const T=useTheme();
  return <div role={onClick?'button':undefined} data-testid={testid} onClick={onClick} style={{padding:'8px 0',borderTop:`1px solid ${T.line}`,cursor:onClick?'pointer':'default'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',fontSize:13,fontFamily:C.P,color:T.ink}}><span style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>{lead}<span style={{fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</span></span>{value!=null&&<span style={{fontVariantNumeric:'tabular-nums',fontWeight:600,flexShrink:0}}>{value}</span>}</div>
    {share!=null&&<div style={{position:'relative',height:6,borderRadius:3,background:T.line,marginTop:6}}><div style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.max(2,Math.min(100,100*share))}%`,borderRadius:3,background:col||T.lift(C.cr)}}/></div>}
    {(sub||right)&&<div style={{display:'flex',justifyContent:sub?'space-between':'flex-start',alignItems:'center',gap:8,marginTop:5,flexWrap:'wrap'}}>{sub&&<span style={{fontSize:12,color:T.mid,fontFamily:C.P,lineHeight:1.4,minWidth:0}}>{sub}</span>}{right&&<span style={{display:'flex',gap:6,flexShrink:0}}>{right}</span>}</div>}
  </div>; }
/* "Demo data": on every sales figure while the till is invented. */
function _CDemoTag(){ const T=useTheme(); if(!TeamSales.demo()) return null; return <span data-testid="demo-tag" style={{fontSize:11,fontWeight:700,fontFamily:C.P,color:T.amber,border:`1px solid ${T.amber}66`,borderRadius:6,padding:'1px 6px',letterSpacing:'0.04em'}}>Demo data</span>; }
/* A stat tile: label, value, an optional signed delta against the period before, and a line under it. */
function _CStat({label,value,delta,up='good',sub,onClick,testid,hero,demo}){ const T=useTheme();
  const col=delta==null||delta===0?T.mid:(delta>0)===(up==='good')?T.green:T.tone.bad;
  // Every tile in a row is the same shape: a one-line label, the value at one size, two lines of room under it.
  return <Card onClick={onClick} style={{cursor:onClick?'pointer':'default',minWidth:0,height:'100%',display:'flex',flexDirection:'column'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:6,alignItems:'center',minHeight:18}}><div style={{fontSize:13,color:T.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{label}</div>{demo&&<_CDemoTag/>}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:8,marginTop:6,flexWrap:'wrap'}}><div data-testid={testid} style={{fontSize:30,fontWeight:700,color:T.ink,fontFamily:C.P,lineHeight:1.05}}>{value}</div>
      {delta!=null&&<div style={{fontSize:13,fontWeight:700,color:col,fontFamily:C.P}}>{delta>0?'▲':delta<0?'▼':'·'} {Math.abs(delta)}%</div>}</div>
    <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.4,minHeight:34,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{sub||''}</div>
  </Card>; }
/* Ranked horizontal bars: one thin bar per row (<= 18px, rounded at the data end), the value at the
   tip, an optional mark on the track (a minimum), each row a tap. One hue unless a row says otherwise. */
function _CBars({rows,max,fmt=v=>String(v),col,testid}){ const T=useTheme(), cr=T.lift(C.cr), top=max||Math.max(1,...rows.map(r=>r.value));
  return <div data-testid={testid} style={{display:'flex',flexDirection:'column',gap:8}}>{rows.map((r,i)=><div key={r.key||i} role={r.onClick?'button':undefined} onClick={r.onClick} style={{cursor:r.onClick?'pointer':'default'}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:13,fontFamily:C.P,color:T.ink2,marginBottom:3}}><span style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>{r.lead}<span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{r.label}</span>{r.tag}</span><span style={{fontVariantNumeric:'tabular-nums',color:T.ink,fontWeight:600,whiteSpace:'nowrap'}}>{fmt(r.value)}</span></div>
    <div style={{position:'relative',height:10,borderRadius:5,background:T.line}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.min(100,100*r.value/top)}%`,borderRadius:'0 5px 5px 0',background:r.col||col||cr}}/>
      {r.mark!=null&&<div title={r.markLabel} style={{position:'absolute',left:`${Math.min(100,100*r.mark/top)}%`,top:-3,width:2,height:16,background:T.ink,opacity:0.7}}/>}
    </div>
    {r.sub&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:3}}>{r.sub}</div>}
  </div>)}</div>; }
/* A sparkline: a 2px line over the points, the last one marked, the first and last values labelled. */
function _CSpark({points,fmt=v=>String(v),h=56,col}){ const T=useTheme(), cr=col||T.lift(C.cr), w=240, pad=6;
  if(!points.length) return null; const max=Math.max(...points,1), min=Math.min(...points,0), ys=points.map(v=>pad+(h-2*pad)*(1-(v-min)/Math.max(1e-9,max-min))), xs=points.map((_,i)=>pad+(w-2*pad)*(points.length>1?i/(points.length-1):0.5));
  const d=xs.map((x,i)=>`${i?'L':'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  return <div style={{position:'relative'}}><svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true" style={{display:'block'}}>
      <path d={`${d} L${xs[xs.length-1].toFixed(1)},${h} L${xs[0].toFixed(1)},${h} Z`} fill={cr} opacity="0.1"/>
      <path d={d} stroke={cr} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="4" fill={cr} stroke={T.bg} strokeWidth="2"/>
    </svg>
    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:T.mid,fontFamily:C.P,marginTop:2}}><span>{fmt(points[0])}</span><span>{fmt(points[points.length-1])}</span></div></div>; }
/* A plain table on glass: columns {h, w, align}, rows of cells, each row a tap. */
function _CTable({cols,rows,testid,empty}){ const T=useTheme();
  if(!rows.length) return <div style={{fontSize:14,color:T.mid,fontFamily:C.P,padding:'8px 0'}}>{empty||'Nothing here yet.'}</div>;
  return <div data-testid={testid} style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontFamily:C.P,fontSize:14,color:T.ink}}>
    <thead><tr>{cols.map((c,i)=><th key={i} style={{textAlign:c.align||'left',fontSize:11,fontWeight:700,color:T.mid,letterSpacing:'0.06em',textTransform:'uppercase',padding:'6px 8px',borderBottom:`1px solid ${T.line}`,whiteSpace:'nowrap',width:c.w}}>{c.h}</th>)}</tr></thead>
    <tbody>{rows.map((r,i)=><tr key={r.key||i} data-testid={r.testid} onClick={r.onClick} style={{cursor:r.onClick?'pointer':'default',background:r.hi?T.soft:'transparent'}}>{r.cells.map((x,j)=><td key={j} style={{padding:'10px 8px',borderBottom:i<rows.length-1?`1px solid ${T.line}`:'none',textAlign:cols[j]&&cols[j].align||'left',verticalAlign:'middle',fontVariantNumeric:'tabular-nums',lineHeight:1.35}}>{x}</td>)}</tr>)}</tbody>
  </table></div>; }
function _CState({r}){ const st=_tState[r.state]; return <span style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:13,fontWeight:700,color:st.col,fontFamily:C.P}}><span style={{width:8,height:8,borderRadius:4,background:st.col}}/>{st.label}</span>; }
const _cInput=(T,extra)=>({padding:'8px 10px',borderRadius:10,border:`1px solid ${T.line}`,background:T.soft,color:T.ink,fontFamily:C.P,fontSize:15,outline:'none',minWidth:0,...extra});

/* ── The shell ── */
function TeamConsole({me,onPhone,refresh,section,setSection,open}){ const T=useTheme(), cr=T.lift(C.cr), size=useLayoutSize(), narrow=size==='phone';
  const [panel,setPanel]=React.useState(null); // {view:'wine'|'dish'|'person', id}
  const go=v=>{ if(v.tab){ setSection(v.tab==='today'?'dash':v.tab); setPanel(null); return; } if(v.view==='drill'){ onPhone(v); return; } setPanel(v); };
  const venue=TeamData.get().venue;
  const side=<div style={narrow?{display:'flex',gap:6,overflowX:'auto',padding:'8px 12px',borderBottom:`1px solid ${T.line}`}:{width:220,flexShrink:0,borderRight:`1px solid ${T.line}`,padding:'18px 12px',display:'flex',flexDirection:'column',gap:4}}>
    {!narrow&&<div style={{padding:'0 8px 18px'}}><TeamLogo/>
      <div style={{fontSize:16,fontWeight:800,color:T.ink,fontFamily:C.P,marginTop:14,lineHeight:1.2}}>{venue.name||'Your restaurant'}</div></div>}
    {narrow&&<_CViewToggle phone={false} onPhone={()=>onPhone({tab:'today'})} compact/>}
    {CONSOLE_SECTIONS.map(s=>{ const on=section===s.k; return <div key={s.k} role="button" data-testid={'console-nav-'+s.k} onClick={()=>{ setSection(s.k); setPanel(null); }} style={{display:'flex',alignItems:'center',gap:10,padding:narrow?'6px 12px':'9px 10px',borderRadius:10,background:on?T.soft:'transparent',border:narrow?`1px solid ${on?cr:T.line}`:'none',color:on?T.ink:T.mid,fontSize:14,fontWeight:on?700:500,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}><Icon n={s.icon} sz={16} col={on?cr:T.mid}/>{s.label}</div>; })}
    {!narrow&&<div style={{flex:1}}/>}
    {!narrow&&<div style={{padding:'0 8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:12,borderTop:`1px solid ${T.line}`}}><TeamFace person={me} size={30}/><div style={{minWidth:0}}><div style={{fontSize:13,fontWeight:600,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{me.name}</div><div style={{fontSize:11,color:T.mid,fontFamily:C.P}}>{TeamLearn.ROLES[me.role].label}</div></div></div>
      <_CViewToggle phone={false} onPhone={()=>onPhone({tab:'today'})}/>
      {TeamData.isDemo()&&<div style={{fontSize:11,color:T.mid,fontFamily:C.P,padding:'12px 2px 0',lineHeight:1.5}}>Management console · The Larkspur demo</div>}</div>}
  </div>;
  const page=section==='team'?<_CTeam open={go} refresh={refresh}/>:section==='wines'?<_CWines open={go} goUpload={()=>setSection('upload')}/>:section==='menu'?<_CMenu open={go} goUpload={()=>setSection('upload')}/>
    :section==='upload'?<_CUpload refresh={refresh}/>:section==='pos'?<_CPos open={go}/>:section==='admin'?<_CAdmin refresh={refresh}/>:<_CDash open={go} setSection={setSection}/>;
  return <div data-testid="team-console" style={{position:'absolute',inset:0,display:'flex',flexDirection:narrow?'column':'row',background:`radial-gradient(ellipse at 20% -10%, ${_alpha(cr,0.25)}, transparent 55%) ${T.bg}`,color:T.ink}}>
    {side}
    <div style={{flex:1,minWidth:0,overflowY:'auto',padding:narrow?'14px 14px 40px':'22px 28px 60px'}}><div style={{maxWidth:1100,margin:'0 auto'}}><TeamJobChip onOpen={()=>setSection('upload')}/><ScreenErrorBoundary>{page}</ScreenErrorBoundary></div></div>
    {panel&&<_CPanel panel={panel} me={me} open={go} close={()=>setPanel(null)} narrow={narrow}/>}
  </div>; }
/* The logo with TEAMS set under it as one mark. logo.png has clear padding round the drawing (the mark
   fills x 41–1039 of 1086 and y 41–183 of 224), so the image is scaled and cropped to the mark itself and
   the word is spread across exactly the mark's width, from the V to the final T. `size` is the mark's height. */
const _LOGO={l:41/1086,r:1039/1086,t:41/224,b:183/224,ar:1086/224,wordL:(99-41)/998,wordR:(1003-41)/998}; // the word runs from the V's point (x 99) to the foot of the T (x 1003)
function TeamLogo({size=20}){ const T=useTheme(), cr=T.lift(C.cr);
  const imgH=size/(_LOGO.b-_LOGO.t), imgW=imgH*_LOGO.ar, w=imgW*(_LOGO.r-_LOGO.l);
  return <div data-testid="team-logo" style={{display:'inline-block',width:w}}>
    <div style={{width:w,height:size,overflow:'hidden',position:'relative'}}><img src="/logo.png" alt="Vinterest" style={{position:'absolute',left:-imgW*_LOGO.l,top:-imgH*_LOGO.t,width:imgW,height:imgH,maxWidth:'none',display:'block',filter:T.dark?'invert(1)':'none'}} onError={e=>{ e.target.style.display='none'; }}/></div>
    <div aria-label="Teams" style={{marginLeft:w*_LOGO.wordL,width:w*(_LOGO.wordR-_LOGO.wordL),display:'flex',justifyContent:'space-between',fontSize:Math.round(size*0.55)+'px',fontWeight:700,color:cr,fontFamily:C.P,lineHeight:1,marginTop:4}}>{'TEAMS'.split('').map((ch,i)=><span key={i}>{ch}</span>)}</div>
  </div>; }
/* Console or the phone app, as a switch (a manager drills as someone on the phone view). */
function _CViewToggle({phone,onPhone,onConsole,compact}){ const T=useTheme(), cr=T.lift(C.cr);
  const seg=(on,label,click,testid)=><div role="button" aria-pressed={on} data-testid={testid} onClick={click} style={{flex:1,textAlign:'center',padding:compact?'5px 10px':'6px 0',borderRadius:9,background:on?T.soft:'transparent',color:on?T.ink:T.mid,fontSize:12,fontWeight:on?700:500,fontFamily:C.P,cursor:on?'default':'pointer',whiteSpace:'nowrap',border:`1px solid ${on?cr:'transparent'}`}}>{label}</div>;
  return <div data-testid="console-view-toggle" style={{display:'flex',gap:4,padding:3,borderRadius:12,border:`1px solid ${T.line}`,marginTop:compact?0:12,flexShrink:0}}>{seg(!phone,'Console',onConsole,'view-console')}{seg(phone,'Phone view',onPhone,'console-who')}</div>; }
/* A detail opened from a table or a bar: a wine's card, a dish's pairings or a person's ladder, in a drawer. */
function _CPanel({panel,me,open,close,narrow}){ const T=useTheme();
  const body=panel.view==='wine'?<TeamWine id={panel.id} pid={me.id} open={open} manage/>:panel.view==='dish'?<TeamDish id={panel.id} open={open}/>:panel.view==='person'?<_CPerson id={panel.id} open={open}/>:null;
  return <div data-testid="console-panel" style={{position:'absolute',top:0,right:0,bottom:0,width:narrow?'100%':'min(440px, 60%)',background:T.card,borderLeft:`1px solid ${T.line}`,boxShadow:T.shadow,overflowY:'auto',padding:'16px 18px 40px'}}>
    <div style={{display:'flex',justifyContent:'flex-end',marginBottom:6}}><div role="button" aria-label="Close" data-testid="console-panel-close" onClick={close} style={{width:32,height:32,borderRadius:16,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.ink,fontFamily:C.P,fontSize:16}}>×</div></div>
    {body}
  </div>; }

/* ── Dashboard ── */
const _WHY_COL={faded:'amber',new:'cr',overdue:'bad',idle:'mid'};
function _CDash({open,setSection}){ const T=useTheme(), cr=T.lift(C.cr), size=useLayoutSize(), cols=size==='roomy'?2:1;
  const o=TeamReport.overview(), ps=TeamReport.people().sort((a,b)=>b.r.pct-a.r.pct), slip=TeamReport.slipping(), sales=TeamReport.salesSummary(7), demo=TeamSales.demo();
  const byRole=TeamReport.byRole(), pri=TeamSales.has()?TeamReport.priority():[], weak=TeamLearn.weakWines().filter(x=>x.of>0).slice(0,6);
  const grid=n=>({display:'grid',gridTemplateColumns:`repeat(${size==='phone'?2:n},minmax(0,1fr))`,gap:10,alignItems:'stretch'});
  const two={display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:14,alignItems:'start',marginTop:14};
  const name=x=>`${x.person.name.split(' ')[0]} · ${TeamLearn.ROLES[x.r.role].label}`;
  const whyCol=k=>({amber:T.amber,cr:cr,bad:T.tone.bad,mid:_cGrey})[_WHY_COL[k]||'mid'];
  const topGlass=Math.max(1,...pri.map(x=>x.qty),...weak.map(()=>1));
  return <div data-testid="console-dash">
    {_cH(T,'Dashboard',`${TeamData.get().venue.name||'Your restaurant'} · ${TeamData.wines().length} wines, ${TeamData.dishes().length} dishes · ${o.total} people training`)}
    <div style={grid(5)}>
      <_CStat hero label="Team readiness" value={`${o.avg}%`} sub={`${o.ready} of ${o.total} ready · ${byRole.filter(r=>r.n>1||r.role==='server').map(r=>`${r.label}s ${r.avg}%`).slice(0,2).join(' · ')}`} testid="dash-readiness" onClick={()=>setSection('team')}/>
      <_CStat label="Overdue" value={o.overdue} sub={o.overdue?`assignments past their date`:'nothing past its date'} testid="dash-overdue" onClick={()=>setSection('team')}/>
      <_CStat label="Slipping" value={o.slipping} sub={o.slipping?'were ready, now below':'nobody below after being ready'} onClick={()=>setSection('team')}/>
      <_CStat label="Re-checks" value={o.retention.rate==null?'—':_cPct(o.retention.rate)} sub={`${o.retention.right} of ${o.retention.asked} surprise re-asks remembered, 30 days`}/>
      <_CStat label="Glass list" value={`${o.coverage.glass.covered} of ${o.coverage.glass.total}`} sub={o.coverage.holes.length?`${o.coverage.holes.length} by-the-glass wine${o.coverage.holes.length===1?'':'s'} too few people know`:'every glass wine known by enough people'} testid="dash-coverage" onClick={()=>setSection('wines')}/>
    </div>
    <div style={two}>
      <Card>{_cLabel(T,'Readiness by person',<span style={{fontSize:11,color:T.mid,fontFamily:C.P,textTransform:'none',letterSpacing:0,fontWeight:500,whiteSpace:'nowrap'}}>100% = minimum met</span>)}
        <_CBars testid="dash-people" max={100} fmt={v=>`${v}%`} rows={ps.map(x=>({key:x.person.id,label:name(x),value:x.r.pct,col:_tState[x.r.state].col,lead:<TeamFace person={x.person} size={22}/>,tag:x.r.overdue?_cChip(T,`${x.r.overdue} overdue`,T.tone.bad):null,onClick:()=>open({view:'person',id:x.person.id})}))}/>
        {_cNote(T,'The colour is their state: green ready, amber slipping, red not ready yet. Readiness comes only from drills, never from sales.')}</Card>
      <Card>{_cLabel(T,'What needs attention')}
        {slip.length?<div>{slip.map((x,i)=><div key={x.person.id} role="button" data-testid="dash-slip" onClick={()=>open({view:'person',id:x.person.id})} style={{display:'flex',gap:10,alignItems:'center',cursor:'pointer',padding:'9px 0',borderTop:i?`1px solid ${T.line}`:'none'}}><TeamFace person={x.person} size={34} ring={_tState[x.r.state].col}/>
          <div style={{minWidth:0,flex:1}}><div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'baseline'}}><div style={{fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.person.name} <span style={{fontWeight:400,color:T.mid,fontSize:12}}>{TeamLearn.ROLES[x.r.role].label}</span></div><span style={{fontSize:13,fontWeight:700,color:_tState[x.r.state].col,fontFamily:C.P,whiteSpace:'nowrap'}}>{x.r.pct}% · {_tState[x.r.state].label}</span></div>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:5}}>{x.why.map((w,k)=><span key={k}>{_cChip(T,w.label,whyCol(w.k))}</span>)}{!x.why.length&&_cChip(T,'below the minimum',_cGrey)}</div></div></div>)}</div>
          :<div style={{fontSize:14,color:T.green,fontFamily:C.P}}>Everyone is ready.</div>}
      </Card>
    </div>
    <div style={two}>
      <Card>{_cLabel(T,TeamSales.has()?'Learn first: sells most, known least':'Wines the floor knows least',TeamSales.has()&&<_CDemoTag/>)}
        {TeamSales.has()?(pri.length?<div data-testid="dash-priority">{pri.map(x=><_CRow key={x.wine.id} lead={_cWineLead(T,x.wine)} label={TeamData.short(x.wine)} value={`${x.qty} sold`} share={x.qty/topGlass} col={_tTypeCol(T,x.wine.type)} right={_cChip(T,`${x.knows} of ${x.of} know it`,x.knows<Math.ceil(x.of/2)?T.tone.bad:T.amber)} onClick={()=>open({view:'wine',id:x.wine.id})}/>)}</div>:<div style={{fontSize:14,color:T.green,fontFamily:C.P}}>Everything that sells is known by everyone who sells it.</div>)
          :<div data-testid="dash-weak">{weak.map(x=><_CRow key={x.wine.id} lead={_cWineLead(T,x.wine)} label={TeamData.short(x.wine)} value={_cPct(x.share)} share={x.share} col={_tTypeCol(T,x.wine.type)} sub={`${x.knows} of ${x.of} who sell it know it`} onClick={()=>open({view:'wine',id:x.wine.id})}/>)}</div>}
        {_cNote(T,TeamSales.has()?'Bars are how much sold in 28 nights, in the wine\'s colour; the chip is how many of its sellers know it. Sales set the order the team learns in, never whether anyone is ready.':'Connect the till or import a sales file and this becomes what sells most and is known least.')}</Card>
      <Card>{_cLabel(T,'New on the list',<span style={{fontSize:11,color:T.mid,fontFamily:C.P,textTransform:'none',letterSpacing:0,fontWeight:500}}>last 30 days</span>)}
        {o.adoption.length?<div>{o.adoption.map(a=><_CRow key={a.wine.id} testid="dash-adoption" lead={_cWineLead(T,a.wine)} label={TeamData.short(a.wine)} value={`${a.knows} of ${a.of}`} share={a.of?a.knows/a.of:0} col={_tTypeCol(T,a.wine.type)} right={_cChip(T,`${a.days}d on the list`,_cGrey)} sub={a.knows<a.of?`${a.of-a.knows} of the people who sell it still to learn it`:'everyone who sells it knows it'} onClick={()=>open({view:'wine',id:a.wine.id})}/>)}</div>
          :<div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Nothing published in the last 30 days.</div>}
        {_cSub(T,'Coverage')}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>{[['By the glass',o.coverage.glass],['Bottles',o.coverage.bottle]].map(([l,c])=>{ const share=c.total?c.covered/c.total:0, col=share>=0.8?T.green:share>=0.5?T.amber:T.tone.bad; return <div key={l}><div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontFamily:C.P,color:T.ink2}}><span>{l}</span><span style={{fontWeight:700,color:T.ink}}>{c.covered} <span style={{color:T.mid,fontWeight:400}}>of {c.total}</span></span></div><Prog val={share} col={col} h={8} style={{marginTop:6}}/></div>; })}</div>
        {o.coverage.holes.length>0&&<div style={{marginTop:10}}>{o.coverage.holes.slice(0,5).map(h=><_CRow key={h.wine.id} lead={_cWineLead(T,h.wine)} label={TeamData.short(h.wine)} right={_cChip(T,`${h.knows} of ${h.of} know it`,T.tone.bad)} onClick={()=>open({view:'wine',id:h.wine.id})}/>)}</div>}
        {_cNote(T,'A wine is covered when at least half the people who sell it, and at least two, know it. The red chips are by-the-glass wines under that.')}
      </Card>
    </div>
    {sales&&<_CSales open={open} setSection={setSection} sales={sales} demo={demo}/>}
    {!TeamSales.has()&&<Card style={{marginTop:14}}><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5}}>No sales yet. <span role="button" onClick={()=>setSection('pos')} style={{color:cr,fontWeight:700,cursor:'pointer'}}>Connect the till or import a sales file</span> and the dashboard adds what sells, who sells it, and what trained servers sell that untrained ones don't.</div></Card>}
  </div>; }
/* The sales row of the dashboard: this week against last, the trend, what sells, who sells, trained against untrained, slow movers, new on the till. One toggle (revenue, glasses, bottles) drives the week chart and the people bars. */
function _CSales({open,setSection,sales,demo}){ const T=useTheme(), cr=T.lift(C.cr), size=useLayoutSize(), cols=size==='roomy'?2:1;
  const byWine=TeamReport.salesByWine(28), slow=TeamReport.slowMovers(28), byServer=TeamReport.salesByServer(28), lift=TeamReport.trainedLift(28), trend=TeamReport.weeklyTrend(8), till=TeamReport.newOnTill();
  const grid={display:'grid',gridTemplateColumns:`repeat(${size==='phone'?2:4},minmax(0,1fr))`,gap:10,alignItems:'stretch'}, two={display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:14,alignItems:'start',marginTop:14};
  const [measure,setMeasure]=React.useState('revenue');
  const M={revenue:{label:'Revenue',pts:trend.map(t=>Math.round(t.revenue)),fmt:v=>_cMoney(v),per:x=>x.revenuePerShift,perFmt:v=>_cMoney(v),perLabel:'revenue per shift'},
    glasses:{label:'Glasses',pts:trend.map(t=>t.glasses),fmt:v=>`${v}`,per:x=>x.glassesPerShift,perFmt:v=>v.toFixed(1),perLabel:'glasses per shift'},
    bottles:{label:'Bottles',pts:trend.map(t=>t.bottles),fmt:v=>`${v}`,per:x=>x.bottlesPerShift,perFmt:v=>v.toFixed(1),perLabel:'bottles per shift'}}, m=M[measure];
  const toggle=<div data-testid="sales-measure" style={{display:'flex',gap:6}}>{[['revenue','Revenue'],['glasses','Glasses'],['bottles','Bottles']].map(([k,l])=><div key={k} role="button" aria-pressed={measure===k} onClick={()=>setMeasure(k)} style={{padding:'4px 10px',borderRadius:10,border:`1px solid ${measure===k?cr:T.line}`,background:measure===k?T.soft:'transparent',color:measure===k?T.ink:T.mid,fontSize:12,fontWeight:600,fontFamily:C.P,cursor:'pointer',textTransform:'none',letterSpacing:0}}>{l}</div>)}</div>;
  const servers=byServer.filter(x=>x.shifts>0).map(x=>({...x,v:m.per(x)||0})).sort((a,b)=>b.v-a.v), topWine=Math.max(1,...byWine.slice(0,8).map(x=>x.revenue)), topSlow=Math.max(0.1,...byWine.filter(x=>TeamData.byGlass(x.wine)).map(x=>x.perNight));
  return <div data-testid="console-sales" style={{marginTop:22}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10,flexWrap:'wrap'}}><div style={{fontSize:18,fontWeight:800,color:T.ink,fontFamily:C.P}}>From the till</div><_CDemoTag/><span style={{fontSize:12,color:T.mid,fontFamily:C.P}}>{demo?'':`${(TeamSales.source()||{}).label||''} · `}last 7 nights against the 7 before</span></div>
    <div style={grid}>
      <_CStat label="Wine sales, 7 nights" value={_cMoney(sales.revenue)} delta={sales.delta.revenue} sub={`${sales.lines} glasses and bottles · ${sales.covers} covers`} testid="sales-revenue"/>
      <_CStat label="Wine per cover" value={sales.attach==null?'—':sales.attach.toFixed(2)} delta={sales.delta.attach} sub="glasses and bottles sold per guest"/>
      <_CStat label="Bottles" value={sales.bottles} delta={sales.delta.bottles} sub={`${_cPct(sales.bottleShare)} of wine lines were bottles`}/>
      <_CStat label="Trained lift" value={lift.pct==null?'—':`${lift.pct>0?'+':''}${lift.pct}%`} up="good" sub={lift.wines?`a server sells ${lift.known.toFixed(2)} of a wine per shift when they know it, ${lift.unknown.toFixed(2)} when not`:'needs servers who know and don\'t know the same wine'} testid="sales-lift"/>
    </div>
    <div style={two}>
      <Card>{_cLabel(T,'Wine sales by week',toggle)}<_CSpark points={m.pts} fmt={m.fmt}/>
        {_cNote(T,`${m.label} of wine sold, eight weeks, oldest first.`)}
        {_cSub(T,'Who sells wine',<span style={{fontSize:11,color:T.mid,fontFamily:C.P,textTransform:'none',letterSpacing:0,fontWeight:500,whiteSpace:'nowrap'}}>{m.perLabel}, 28 nights</span>)}
        <_CBars testid="sales-servers" fmt={m.perFmt} rows={servers.map(x=>({key:x.person.id,label:`${x.person.name.split(' ')[0]} · ${TeamLearn.ROLES[x.person.role].label}`,value:x.v,col:_tState[x.readiness?x.readiness.state:'not'].col,lead:<TeamFace person={x.person} size={22}/>,sub:`${x.shifts} shifts · ${x.glasses} glasses, ${x.bottles} bottles · readiness ${x.readiness?x.readiness.pct:0}%`,onClick:()=>open({view:'person',id:x.person.id})}))}/>
        {_cNote(T,'Bars take the person\'s readiness colour. Roles differ (the bar pours for walk-ins, the sommelier sells bottles), so compare within a role; shifts and sections confound the trained lift too. A pointer, not a proof.')}</Card>
      <Card>{_cLabel(T,'What sells',<span style={{fontSize:11,color:T.mid,fontFamily:C.P,textTransform:'none',letterSpacing:0,fontWeight:500}}>28 nights</span>)}
        <div data-testid="sales-wines">{byWine.slice(0,8).map(x=><_CRow key={x.id} lead={_cWineLead(T,x.wine)} label={TeamData.short(x.wine)} value={_cMoney(Math.round(x.revenue))} share={x.revenue/topWine} col={_tTypeCol(T,x.wine.type)} sub={`${x.glasses} glasses, ${x.bottles} bottles`} right={_cChip(T,`${x.knows} of ${x.of} know it`,x.knows<Math.ceil(x.of/2)?T.tone.bad:x.knows<x.of?T.amber:T.green)} onClick={()=>open({view:'wine',id:x.id})}/>)}</div>
        {_cSub(T,'Slow movers by the glass')}
        <div>{slow.map(x=><div key={x.wine.id} role="button" data-testid="sales-slow" onClick={()=>open({view:'wine',id:x.wine.id})} style={{padding:'8px 0',borderTop:`1px solid ${T.line}`,cursor:'pointer'}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',fontSize:13,fontFamily:C.P,color:T.ink}}><span style={{display:'flex',alignItems:'center',gap:8,minWidth:0}}>{_cWineLead(T,x.wine)}<span style={{fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{TeamData.short(x.wine)}</span></span><span style={{display:'flex',gap:6,flexShrink:0}}>{_cChip(T,`${x.perNight.toFixed(1)} a night`,T.amber)}{_cChip(T,`${x.knows} of ${x.of} know it`,x.knows<Math.ceil(x.of/2)?T.tone.bad:_cGrey)}</span></div>
          <div style={{position:'relative',height:6,borderRadius:3,background:T.line,marginTop:6}}><div style={{position:'absolute',left:0,top:0,bottom:0,width:`${Math.max(2,Math.min(100,100*x.perNight/topSlow))}%`,borderRadius:3,background:_tTypeCol(T,x.wine.type)}}/></div>
          {x.pitch&&<div style={{fontSize:12,color:T.ink2,fontFamily:C.P,lineHeight:1.45,marginTop:6,paddingLeft:10,borderLeft:`2px solid ${_tTypeCol(T,x.wine.type)}`}}>Say: “{x.pitch.length>120?x.pitch.slice(0,118)+'…':x.pitch}”</div>}</div>)}</div>
        {_cNote(T,'The bar is pours a night against the best-selling glass; the line is what the staff card says to say.')}
        {till.length>0&&<>{_cSub(T,'On the till, not on the list')}{till.map(x=><_CRow key={x.item} testid="sales-new-item" lead={<span style={{width:8,height:8,borderRadius:4,border:`1.5px solid ${T.amber}`,display:'inline-block'}}/>} label={x.item} right={_cChip(T,`${x.qty} sold · map it →`,T.amber)} onClick={()=>setSection('pos')}/>)}
          {_cNote(T,'A till item with no wine on the list behind it: a new arrival nobody has uploaded, or a name to map.')}</>}
      </Card>
    </div>
  </div>; }

/* ── Team ── */
function _CTeam({open,refresh}){ const T=useTheme(), cr=T.lift(C.cr);
  const ps=TeamReport.people().sort((a,b)=>a.r.pct-b.r.pct), [name,setName]=React.useState(''), [role,setRole]=React.useState('server'), [,bump]=React.useReducer(x=>x+1,0);
  const add=()=>{ if(!name.trim()) return; TeamLearn.addPerson(name.trim(),role,null); setName(''); refresh&&refresh(); };
  const remove=p=>{ if(confirm(`Remove ${p.name} and their training on this device?`)){ TeamLearn.removePerson(p.id); refresh&&refresh(); } };
  return <div data-testid="console-team">{_cH(T,'Team',`${ps.length} people · ${ps.filter(x=>x.r.state==='ready').length} ready`)}
    <Card style={{padding:'6px 8px'}}><_CTable testid="team-table" cols={[{h:'Person',w:'30%'},{h:'Readiness',w:'30%'},{h:'Overdue',align:'center',w:80},{h:'Fading',align:'center',w:80},{h:'Last drill',align:'center',w:110},{h:'Re-checks',align:'center',w:100},{h:'',w:36,align:'right'}]}
      rows={ps.map(x=>({key:x.person.id,testid:'team-row',onClick:()=>open({view:'person',id:x.person.id}),cells:[
        <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}><TeamFace person={x.person} size={34} ring={_tState[x.r.state].col}/><div style={{minWidth:0}}><div style={{fontWeight:700,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.person.name}</div><div style={{fontSize:12,color:T.mid}}>{TeamLearn.ROLES[x.r.role].label}</div></div></div>,
        <div style={{minWidth:150}}><div style={{display:'flex',alignItems:'center',gap:8}}><Prog val={x.r.pct/100} col={_tState[x.r.state].col} h={8} style={{flex:1}}/><span style={{width:40,textAlign:'right',fontWeight:600}}>{x.r.pct}%</span></div><div style={{marginTop:4,whiteSpace:'nowrap'}}><_CState r={x.r}/></div></div>,
        <span style={{color:x.r.overdue?T.tone.bad:T.mid}}>{x.r.overdue||'—'}</span>,<span style={{color:x.r.due?T.amber:T.mid}}>{x.r.due||'—'}</span>,<span style={{color:T.mid,whiteSpace:'nowrap'}}>{_cAgo(x.lastDrill)}</span>,<span style={{color:T.mid}}>{x.checks.asked?`${x.checks.right} of ${x.checks.asked}`:'—'}</span>,
        <span role="button" aria-label={`Remove ${x.person.name}`} onClick={e=>{ e.stopPropagation(); remove(x.person); }} style={{color:T.mid,cursor:'pointer',padding:'0 4px',display:'inline-flex'}}><Icon n="trash" sz={14} col={T.mid}/></span>]}))}/></Card>
    <div style={{display:'grid',gridTemplateColumns:useLayoutSize()==='phone'?'1fr':'1fr 1fr',gap:14,marginTop:14,alignItems:'start'}}>
      <Card>{_cLabel(T,'Add someone')}<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        <input aria-label="Name" placeholder="Name" value={name} onChange={e=>setName(e.target.value)} style={_cInput(T,{flex:'1 1 140px'})}/>
        <select aria-label="Role" value={role} onChange={e=>setRole(e.target.value)} style={_cInput(T,{background:T.card,colorScheme:'dark'})}>{Object.entries(TeamLearn.ROLES).map(([k,r])=><option key={k} value={k}>{r.label}</option>)}</select>
        <Btn primary small onClick={add}>Add</Btn></div>
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Their whole list and menu becomes their first assignment, due in {TeamData.get().settings.dueDays||7} days. Inviting someone to their own phone needs accounts, which come next; in the pilot everyone trains on this device.</div></Card>
      <Card>{_cLabel(T,'Minimum to work the floor')}
        {['server','bartender','sommelier','buyer','manager'].map(rk=>{ const n=TeamLearn.need(rk); return <div key={rk} style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:8}}><div style={{width:92,fontSize:14,fontWeight:700,color:T.ink,fontFamily:C.P}}>{TeamLearn.ROLES[rk].label}</div>
          {Object.keys(TeamLearn.PART_LABEL).filter(k=>TeamLearn.ROLES[rk].need[k]>0).map(k=><div key={k} role="button" data-testid="console-need" onClick={()=>{ const v=n[k]>=0.95?0.5:Math.round((n[k]+0.1)*10)/10; TeamLearn.setNeed(rk,k,v); bump(); refresh&&refresh(); }} style={{padding:'4px 9px',borderRadius:9,border:`1px solid ${T.line}`,fontSize:13,color:T.ink2,fontFamily:C.P,cursor:'pointer'}}>{TeamLearn.PART_LABEL[k]} {Math.round(n[k]*100)}%</div>)}</div>; })}
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Tap a figure to raise it by ten points (it wraps back to 50%). Readiness is recomputed against the new minimum at once.</div></Card>
    </div>
  </div>; }
/* One person: readiness by part, then every wine their role sells with its rungs, then the dishes. */
function _CPerson({id,open}){ const T=useTheme(), p=TeamLearn.person(id), r=TeamLearn.readiness(id); if(!p||!r) return null;
  const lad=TeamReport.ladder(id), as=TeamLearn.assignments(id), st=_tState[r.state], trend=TeamSales.has()?TeamReport.serverTrend(id,8).filter(t=>t.shifts>0):[];
  const rung=(k,done)=><span key={k} title={TeamLearn.KIND_LABEL[k]} style={{width:10,height:10,borderRadius:5,background:done?T.green:'transparent',border:`1.5px solid ${done?T.green:T.line}`,display:'inline-block'}}/>;
  return <div data-testid="console-person">
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}><TeamFace person={p} size={56} ring={st.col}/><div><div style={{fontSize:20,fontWeight:800,color:T.ink,fontFamily:C.P}}>{p.name}</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{TeamLearn.ROLES[p.role].label} · <_CState r={r}/> · {r.pct}%</div></div></div>
    <Card>{Object.entries(r.parts).map(([k,x])=><div key={k} style={{marginBottom:8}}><div style={{display:'flex',justifyContent:'space-between',fontSize:13,fontFamily:C.P,color:T.ink2}}><span>{TeamLearn.PART_LABEL[k]}</span><span>{x.known} of {x.total} · need {Math.round(x.need*100)}%</span></div><div style={{position:'relative',marginTop:4}}><Prog val={x.partial} col={x.share>=x.need?T.green:T.lift(C.cr)} h={6}/><div style={{position:'absolute',left:`${x.need*100}%`,top:-3,width:2,height:12,background:T.ink,opacity:0.6}}/></div></div>)}
      <div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>{as.length?`${as.length} assignment${as.length===1?'':'s'} open, ${r.overdue} overdue · `:''}{r.due} answer{r.due===1?'':'s'} fading</div>
      <div style={{marginTop:8}}><Btn small primary onClick={()=>open({view:'drill',pid:id})}>Drill as {p.name.split(' ')[0]} on the phone view</Btn></div></Card>
    {trend.length>1&&<div style={{marginTop:12}}>{_cLabel(T,'Wine lines per shift, by week',<_CDemoTag/>)}<Card><_CSpark points={trend.map(t=>+(t.perShift||0).toFixed(1))} fmt={v=>v.toFixed(1)}/></Card></div>}
    <div style={{marginTop:12}}>{_cLabel(T,`Wines · ${lad.wines.filter(w=>w.known===w.total&&w.total).length} of ${lad.wines.length} known`)}
      <Card style={{padding:'4px 12px'}}>{lad.wines.map((w,i)=><div key={w.wine.id} role="button" onClick={()=>open({view:'wine',id:w.wine.id})} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderTop:i?`1px solid ${T.line}`:'none',cursor:'pointer'}}>
        <div style={{width:8,height:8,borderRadius:4,background:_tTypeCol(T,w.wine.type),flexShrink:0}}/><div style={{flex:1,minWidth:0,fontSize:14,color:T.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{TeamData.short(w.wine)}{TeamData.byGlass(w.wine)&&<span style={{color:T.mid,fontSize:12}}> · glass</span>}</div>
        <div style={{display:'flex',gap:5}}>{w.rungs.map(rg=>rung(rg.k,rg.done))}</div></div>)}</Card>
      <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6}}>Dots are the rungs their role needs: {TeamLearn.ROLES[p.role].kinds.map(k=>TeamLearn.KIND_LABEL[k]).join(', ')}.</div></div>
    {lad.dishes.length>0&&<div style={{marginTop:12}}>{_cLabel(T,`Dishes · ${lad.dishes.filter(x=>x.known===x.total&&x.total).length} of ${lad.dishes.length} known`)}
      <Card style={{padding:'4px 12px'}}>{lad.dishes.map((x,i)=><div key={x.dish.id} role="button" onClick={()=>open({view:'dish',id:x.dish.id})} style={{display:'flex',justifyContent:'space-between',gap:10,padding:'8px 0',borderTop:i?`1px solid ${T.line}`:'none',fontSize:14,fontFamily:C.P,color:T.ink,cursor:'pointer'}}><span style={{minWidth:0,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{x.dish.name}</span><span style={{color:x.total&&x.known===x.total?T.green:T.mid,whiteSpace:'nowrap'}}>{x.total?`${x.known} of ${x.total}`:'no pairing yet'}</span></div>)}</Card></div>}
  </div>; }

/* ── Wines ── */
function _CWines({open,goUpload}){ const T=useTheme(), cr=T.lift(C.cr), ws=TeamData.wines(), cov=TeamReport.coverage(), by=Object.fromEntries(cov.rows.map(x=>[x.wine.id,x]));
  const [edit,setEdit]=React.useState(null); // {id, glass, bottle, section}
  const secs=[...new Set(ws.map(w=>w.section).filter(Boolean))];
  const save=()=>{ TeamData.draftEdit(edit.id,{glass:edit.glass.trim(),bottle:edit.bottle.trim(),section:edit.section}); setEdit(null); goUpload(); };
  const off=w=>{ if(confirm(`Take ${TeamData.short(w)} off the list? You review and publish the change on Upload.`)){ TeamData.draftRemove(w.id); goUpload(); } };
  const sold=TeamSales.has()?Object.fromEntries(TeamReport.salesByWine(28).map(x=>[x.id,x])):null;
  const groups=[]; ws.forEach(w=>{ const s=w.section||'The list'; let g=groups.find(x=>x.s===s); if(!g) groups.push(g={s,ws:[]}); g.ws.push(w); });
  return <div data-testid="console-wines">{_cH(T,'Wines',`${ws.length} on the list · ${ws.filter(TeamData.byGlass).length} by the glass · ${cov.glass.covered+cov.bottle.covered} covered by the floor`,<Btn small onClick={goUpload}>Upload a new list</Btn>)}
    {!ws.length&&<Card><div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>No list yet. Upload one and it appears here with who knows what.</div></Card>}
    {groups.map(g=><div key={g.s} style={{marginBottom:14}}>{_cLabel(T,g.s,sold&&<span style={{fontSize:11,color:T.mid,fontFamily:C.P,textTransform:'none',letterSpacing:0,fontWeight:500}}>sold in 28 nights</span>)}<Card style={{padding:'6px 4px'}}>
      <_CTable testid="wines-table" cols={[{h:'Wine'},{h:'Year',align:'center',w:56},{h:'Glass',align:'center',w:64},{h:'Bottle',align:'center',w:68},{h:'Window',align:'center',w:96},{h:'Known by',align:'center',w:84},...(sold?[{h:'Sold',align:'center',w:56}]:[]),{h:'Card',align:'center',w:52},{h:'',align:'right',w:72}]}
        rows={g.ws.flatMap(w=>{ const x=by[w.id]||{knows:0,of:0}, dw=TeamData.window(w), c=TeamData.card(w.id), s=sold&&sold[w.id]; const ed=edit&&edit.id===w.id;
          const row={key:w.id,testid:'wines-row',onClick:()=>open({view:'wine',id:w.id}),cells:[<div style={{display:'flex',alignItems:'flex-start',gap:8,minWidth:160}}><span style={{width:8,height:8,borderRadius:4,background:_tTypeCol(T,w.type),flexShrink:0,marginTop:6}}/><span><b>{TeamData.short(w)}</b><span style={{color:T.mid,fontSize:12,display:'block'}}>{[w.region,w.country].filter(Boolean).join(', ')}</span></span></div>,w.vintage||'NV',
            w.glass||<span style={{color:T.mid}}>—</span>,w.bottle||<span style={{color:T.mid}}>—</span>,dw?<span style={{color:dw.stage==='ready'?T.green:dw.stage==='young'?'#7FB3F0':T.amber,fontSize:13,whiteSpace:'nowrap'}}>{dw.word}</span>:<span style={{color:T.mid}}>—</span>,
            <span style={{color:x.of&&x.knows<Math.ceil(x.of/2)?T.tone.bad:T.ink2,whiteSpace:'nowrap'}}>{x.knows} of {x.of}</span>,...(sold?[s?`${s.qty}`:'0']:[]),c?<Icon n="check" sz={14} col={T.green} style={{display:'inline-block',verticalAlign:'middle'}}/>:<span style={{color:T.amber,fontSize:12}}>none</span>,
            <span style={{display:'flex',gap:6,justifyContent:'flex-end'}}><span role="button" aria-label={`Edit ${TeamData.short(w)}`} data-testid="wines-edit" onClick={e=>{ e.stopPropagation(); setEdit(ed?null:{id:w.id,glass:w.glass||'',bottle:w.bottle||'',section:w.section||''}); }} style={{color:cr,cursor:'pointer',fontSize:13,fontWeight:700}}>Edit</span><span role="button" aria-label={`Take ${TeamData.short(w)} off the list`} onClick={e=>{ e.stopPropagation(); off(w); }} style={{cursor:'pointer',padding:'0 2px'}}><Icon n="trash" sz={14} col={T.mid}/></span></span>]};
          if(!ed) return [row];
          return [row,{key:w.id+'-edit',hi:true,cells:[<div data-testid="wines-edit-row" onClick={e=>e.stopPropagation()} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <select aria-label="Section" value={edit.section} onChange={e=>setEdit({...edit,section:e.target.value})} style={_cInput(T,{background:T.card,colorScheme:'dark',fontSize:14})}>{secs.map(x=><option key={x} value={x}>{x}</option>)}</select>
            <input aria-label="Glass price" value={edit.glass} onChange={e=>setEdit({...edit,glass:e.target.value})} placeholder="Glass (or blank)" style={_cInput(T,{width:130,fontSize:14})}/>
            <input aria-label="Bottle price" value={edit.bottle} onChange={e=>setEdit({...edit,bottle:e.target.value})} placeholder="Bottle" style={_cInput(T,{width:110,fontSize:14})}/>
            <Btn small primary onClick={save}>Review the change</Btn><Btn small onClick={()=>setEdit(null)}>Cancel</Btn>
            <span style={{fontSize:12,color:T.mid,fontFamily:C.P,flexBasis:'100%'}}>Saving opens the change on Upload for review; nothing reaches staff until you publish it.</span></div>,...Array(sold?8:7).fill(<span/>)]}];
        })}/></Card></div>)}
  </div>; }

/* ── Menu ── */
function _CMenu({open,goUpload}){ const T=useTheme(), cr=T.lift(C.cr), xs=TeamData.dishes(), [edit,setEdit]=React.useState(null);
  const gaps=xs.filter(x=>{ const p=TeamData.pairing(x.id); return !p||!p.best||!p.best.length; });
  const save=()=>{ TeamData.draftEditDish(edit.id,{price:edit.price.trim(),desc:edit.desc.trim()}); setEdit(null); goUpload(); };
  const groups=[]; xs.forEach(x=>{ const s=x.section||'Menu'; let g=groups.find(y=>y.s===s); if(!g) groups.push(g={s,xs:[]}); g.xs.push(x); });
  const wn=b=>{ const w=b&&TeamData.wine(b.id); return w?<span style={{display:'inline-flex',alignItems:'center',gap:7}}>{_cWineLead(T,w)}<span>{TeamData.short(w)}</span></span>:<span style={{color:T.mid}}>—</span>; };
  // The glass pick, then a bottle for the table: the best match that isn't the glass pick, a bottle-only wine first.
  const picks=p=>{ const best=p.best||[], glass=p.glass||best.find(b=>{ const w=TeamData.wine(b.id); return w&&TeamData.byGlass(w); })||null, gid=glass&&glass.id;
    const bottle=best.find(b=>{ const w=TeamData.wine(b.id); return w&&b.id!==gid&&!TeamData.byGlass(w); })||best.find(b=>b.id!==gid)||null; return {glass,bottle}; };
  return <div data-testid="console-menu">{_cH(T,'Menu',`${xs.length} dishes · ${gaps.length?`${gaps.length} without a good match on the list`:'every dish has its wines'}`,<Btn small onClick={goUpload}>Upload a new menu</Btn>)}
    {gaps.length>0&&<Card style={{marginBottom:14,borderColor:T.amber+'66'}}><div style={{fontSize:14,color:T.amber,fontWeight:700,fontFamily:C.P}}>Dishes without pairings</div><div style={{fontSize:13,color:T.ink2,fontFamily:C.P,marginTop:4}}>{gaps.map(x=>x.name).join(' · ')}</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:4}}>Written at the next publish, or from Upload with "Write them now".</div></Card>}
    {groups.map(g=><div key={g.s} style={{marginBottom:14}}>{_cLabel(T,g.s)}<Card style={{padding:'6px 8px'}}>
      <_CTable testid="menu-table" cols={[{h:'Dish'},{h:'Price',align:'center'},{h:'By the glass'},{h:'By the bottle'},{h:'Steer away from'},{h:'',align:'right'}]}
        rows={g.xs.flatMap(x=>{ const p=TeamData.pairing(x.id)||{}, ed=edit&&edit.id===x.id, pk=picks(p);
          const row={key:x.id,testid:'menu-row',onClick:()=>open({view:'dish',id:x.id}),cells:[<span><b>{x.name}</b>{x.desc&&<span style={{color:T.mid,fontSize:12,display:'block'}}>{x.desc}</span>}</span>,x.price||<span style={{color:T.mid}}>—</span>,wn(pk.glass),wn(pk.bottle),wn(p.avoid),
            <span role="button" aria-label={`Edit ${x.name}`} data-testid="menu-edit" onClick={e=>{ e.stopPropagation(); setEdit(ed?null:{id:x.id,price:x.price||'',desc:x.desc||''}); }} style={{color:cr,cursor:'pointer',fontSize:13,fontWeight:700}}>Edit</span>]};
          if(!ed) return [row];
          return [row,{key:x.id+'-edit',hi:true,cells:[<div onClick={e=>e.stopPropagation()} style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
            <input aria-label="Price" value={edit.price} onChange={e=>setEdit({...edit,price:e.target.value})} placeholder="Price" style={_cInput(T,{width:90,fontSize:14})}/>
            <input aria-label="Description" value={edit.desc} onChange={e=>setEdit({...edit,desc:e.target.value})} placeholder="Description" style={_cInput(T,{flex:'1 1 240px',fontSize:14})}/>
            <Btn small primary onClick={save}>Review the change</Btn><Btn small onClick={()=>setEdit(null)}>Cancel</Btn></div>,<span/>,<span/>,<span/>,<span/>,<span/>]}];
        })}/></Card></div>)}
  </div>; }

/* ── Upload ── */
function _CUpload({refresh}){ const T=useTheme(), size=useLayoutSize(), d=TeamData.get(), vs=[...(d.versions||[])].reverse().slice(0,6);
  return <div data-testid="console-upload" style={{display:'grid',gridTemplateColumns:size==='roomy'?'minmax(0,1fr) 300px':'1fr',gap:18,alignItems:'start'}}>
    <div><TeamUpload onChanged={refresh} background/></div>
    <div>{_cLabel(T,'Live now')}<Card><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.6}}>{TeamData.wines().length} wines, {TeamData.wines().filter(TeamData.byGlass).length} by the glass<br/>{TeamData.dishes().length} dishes<br/>{Object.keys(d.cards).length} staff cards, {Object.keys(d.pairings).length} pairings</div></Card>
      {vs.length>0&&<div style={{marginTop:12}}>{_cLabel(T,'Published')}<Card style={{padding:'4px 12px'}}>{vs.map((v,i)=><div key={v.at} style={{padding:'8px 0',borderTop:i?`1px solid ${T.line}`:'none',fontSize:13,fontFamily:C.P,color:T.ink2}}><b style={{color:T.ink}}>{_cDate(v.at)}</b> · {v.kind==='list'?'wine list':'menu'}: {v.added.length} new, {v.changed.length} changed, {v.removed.length} gone</div>)}</Card></div>}
    </div>
  </div>; }

/* ── Integrations ── */
function _CPos({open}){ const T=useTheme(), cr=T.lift(C.cr), src=TeamSales.source(), items=TeamSales.has()?TeamSales.items():[], [msg,setMsg]=React.useState(''), fileRef=React.useRef(null), [,bump]=React.useReducer(x=>x+1,0);
  const onFile=e=>{ const f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ const r=TeamSales.importCSV(String(fr.result)); setMsg(r.error?r.error:`${r.added} new line${r.added===1?'':'s'} read from ${r.rows}${r.skipped?`, ${r.skipped} skipped`:''}. Columns: ${r.columns.join(', ')}.`); bump(); }; fr.readAsText(f); };
  const wines=TeamData.wines(), unm=items.filter(x=>!x.mapped);
  return <div data-testid="console-pos">{_cH(T,'Integrations','The till, and later stock. Sales set what the team learns first and what the dashboard shows; they never change anyone\'s readiness.')}
    <div style={{display:'grid',gridTemplateColumns:useLayoutSize()==='phone'?'1fr':'1fr 1fr',gap:14,alignItems:'start'}}>
      <Card><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8}}>{_cLabel(T,'Point of sale')}<_CDemoTag/></div>
        <div data-testid="pos-state" style={{fontSize:17,fontWeight:700,color:T.ink,fontFamily:C.P}}>{src?src.label||'Connected':'Not connected'}</div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:3,lineHeight:1.5}}>{src?`Last sync ${_cAgo(src.at)} · ${src.rows} wine lines held (${TeamSales.KEEP_DAYS} days kept)`:'Nothing from the till yet.'}{src&&src.note?<><br/>{src.note}</>:null}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} data-testid="pos-csv" style={{display:'none'}}/>
          <Btn small primary onClick={()=>fileRef.current&&fileRef.current.click()}>Import a sales file (CSV)</Btn>
          {src&&<Btn small onClick={()=>{ if(confirm('Clear every sales line and the item map on this device?')){ TeamSales.clear(); bump(); } }}>Clear sales</Btn>}
        </div>
        {msg&&<div data-testid="pos-import-msg" style={{fontSize:13,color:T.ink2,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>{msg}</div>}
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:10,lineHeight:1.5}}>Any till exports item sales by day as a CSV (Toast's nightly export, Square's Reports, Lightspeed's and Zonal's reports). We read the date, item, quantity, price and server columns by name and ignore the rest; a line is never counted twice.</div>
      </Card>
      <Card>{_cLabel(T,'Live connectors')}
        {[['Square','Self-serve: the owner approves us in a browser and we read Orders, Catalog and Inventory. First live connector.','soon'],['Toast','Nightly export to an SFTP folder the venue shares, or the partner API once Toast approves us.','later'],['Lightspeed Restaurant','Partner credentials, then sales pulled hourly.','later'],['Zonal, Tevalis, Epos Now','Arranged per venue with the vendor.','later']].map(([n,d,s])=><div key={n} style={{padding:'8px 0',borderTop:`1px solid ${T.line}`}}><div style={{display:'flex',justifyContent:'space-between',gap:8,fontSize:14,fontFamily:C.P,color:T.ink}}><b>{n}</b><span style={{fontSize:12,color:s==='soon'?T.amber:T.mid}}>{s==='soon'?'Needs accounts · next':'Planned'}</span></div><div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>{d}</div></div>)}
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>A connector holds the venue's token on our server only, never in the app, and needs restaurant accounts first. Until then the CSV import does the same job by hand.</div>
      </Card>
    </div>
    {TeamSales.has()&&<div style={{marginTop:14}}>{_cLabel(T,`Till items → wines · ${unm.length?`${unm.length} to confirm`:'all mapped'}`)}
      <Card style={{padding:'6px 8px'}}><_CTable testid="pos-map" cols={[{h:'Till item'},{h:'Sold, 90 days',align:'center'},{h:'Our wine'},{h:'',align:'right'}]}
        rows={items.slice(0,80).map(x=>({key:x.item,testid:x.mapped?'pos-map-row':'pos-unmapped',hi:!x.mapped,cells:[<span><b>{x.item}</b>{!x.mapped&&<span style={{display:'block',fontSize:12,color:T.amber}}>New on the till{x.suggest?` · looks like ${TeamData.short(x.suggest)}`:' · no wine on the list matches'}</span>}</span>,`${x.qty} · ${_cMoney(x.sales)}`,
          <select aria-label={`Wine for ${x.item}`} value={x.mapped?(x.wine?x.wine.id:''):(x.suggest?x.suggest.id:'?')} onChange={e=>{ if(e.target.value==='?') return; TeamSales.setMap(x.item,e.target.value); bump(); }} style={_cInput(T,{background:T.card,colorScheme:'dark',fontSize:13,maxWidth:260})}>
            {!x.mapped&&<option value="?">Choose…</option>}<option value="">Not a wine on the list</option>{wines.map(w=><option key={w.id} value={w.id}>{TeamData.short(w)}</option>)}</select>,
          !x.mapped&&x.suggest?<span role="button" data-testid="pos-confirm" onClick={()=>{ TeamSales.setMap(x.item,x.suggest.id); bump(); }} style={{color:cr,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:C.P}}>Confirm</span>:x.mapped&&!x.ignored&&x.wine?<span role="button" onClick={()=>open({view:'wine',id:x.wine.id})} style={{color:T.mid,fontSize:13,cursor:'pointer',fontFamily:C.P}}>Open →</span>:<span/>]}))}/></Card>
      <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:6,lineHeight:1.5}}>Till names never match a list ("HSE RED 175", "Rioja Res Btl"), so each is mapped once and kept. A glass and a bottle of one wine are two till items mapped to the same wine. An item with no match is a new arrival nobody has uploaded yet.</div></div>}
    <div style={{marginTop:14}}>{_cLabel(T,'Stock')}<Card><div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>No stock source. Where a venue counts stock in Square, its Inventory API gives "running low" and "delivery arrived"; otherwise stock is a count entered here or a file from a beverage-inventory tool (WISK, BevSpot). We don't try to be the stock system.</div></Card></div>
  </div>; }

/* ── Admin ── */
function _CAdmin({refresh}){ const T=useTheme(), d=TeamData.get(), [name,setName]=React.useState(d.venue.name||''), [due,setDue]=React.useState(String(d.settings.dueDays||7)), [saved,setSaved]=React.useState(false);
  const save=()=>{ TeamData.setVenue({name:name.trim()||d.venue.name}); const n=Math.max(1,Math.min(60,parseInt(due,10)||7)); TeamData.setSetting('dueDays',n); setDue(String(n)); setSaved(true); refresh&&refresh(); };
  return <div data-testid="console-admin">{_cH(T,'Admin','The restaurant, its data and what comes next.')}
    <div style={{display:'grid',gridTemplateColumns:useLayoutSize()==='phone'?'1fr':'1fr 1fr',gap:14,alignItems:'start'}}>
      <Card>{_cLabel(T,'Restaurant')}<div style={{display:'flex',flexDirection:'column',gap:8}}>
        <label style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Name<input aria-label="Restaurant name" value={name} onChange={e=>{ setName(e.target.value); setSaved(false); }} style={_cInput(T,{display:'block',width:'100%',marginTop:4})}/></label>
        <label style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Days to learn something new<input aria-label="Days to learn" value={due} onChange={e=>{ setDue(e.target.value); setSaved(false); }} inputMode="numeric" style={_cInput(T,{display:'block',width:120,marginTop:4})}/></label>
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Currency follows the device's location ({TeamData.currency().code}); one site in the pilot.</div>
        <div><Btn small primary onClick={save}>{saved?'Saved':'Save'}</Btn></div></div></Card>
      <Card>{_cLabel(T,'Data')}<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>Everything is on this device: the list, menu, cards, pairings, every person's training and any sales. Nothing is synced until restaurants have accounts.</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:10}}><Btn small onClick={()=>TeamData.exportFile()}>Export as a file</Btn>
          <Btn small onClick={()=>{ if(confirm('Start again? This clears the restaurant, everyone\'s training and sales on this device.')){ TeamData.reset(); Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); TeamSales.clear(); refresh&&refresh(); } }}>Start again</Btn></div></Card>
      <Card>{_cLabel(T,'Accounts and billing')}<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>Next: an account per restaurant with sites and members, each person on their own phone, and billing per site through Stripe. The console then runs on the web with the same screens.</div></Card>
      <Card>{_cLabel(T,'Cost')}<div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.55}}>Writing is the only cost: a staff card with its questions about 3p, a 250-wine list from scratch about £6, a menu's pairings about £1, a marked answer under a penny. Reading the dashboard costs nothing.</div></Card>
    </div>
  </div>; }

Object.assign(window,{TeamConsole,CONSOLE_SECTIONS,TeamLogo});
