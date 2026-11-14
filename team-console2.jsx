/* The console's new look (docs/business.md "The console's new look"), shown where the restaurant's file asks for it
   (TeamData.consoleLook: The Larkspur's does, as a preview) and switchable back to the classic console from its header.
   The same sections, people and drawer as team-console.jsx; what changes is the shell and four pages:

   - navigation along the top under the restaurant's own logo, never a sidebar;
   - each page opens on one standout fact with up to three quick ones beneath (TeamReport.headline), about the wine,
     the menu and what knowing them sells;
   - a tall panel on the left, the numbers and detail on the right, tiles below;
   - who can sell a wine is the faces of the people who hold it, never a grid of dots;
   - one text size for reading (14), light weights, the restaurant's accent as the only colour that isn't a status.

   Dashboard, Sales Insights, Wines and Menu are drawn here; Team, Cocktails, Upload, Integrations and Admin are the
   classic sections inside the new shell, and Wines and Menu keep the classic editor under "Edit and manage". Every
   figure is TeamReport's. Where the console can't know something yet (a dish going out with its wine, readiness week by
   week) only a demo restaurant draws it, tagged Demo data. */
const _c2Acc=T=>(TeamData.brand()||{}).accent||T.lift(C.cr);
const _c2Ink=()=>(TeamData.brand()||{}).accent?'#15110A':'#fff';
const _C2_TONE={good:'#6FD79C',note:'#F2B84B',bad:'#F58B7C',mut:'#8C8C92'};
const _c2Lab=(T,t,col)=><div style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontSize:12,letterSpacing:'0.09em',textTransform:'uppercase',color:col||T.mid,fontWeight:500,fontFamily:C.P}}>{t}</div>;
const _c2Pill=(text,col)=><span style={{display:'inline-block',padding:'2px 9px',borderRadius:999,fontSize:12,fontWeight:500,fontFamily:C.P,whiteSpace:'nowrap',background:_alpha(col,0.14),color:col}}>{text}</span>;
const _c2Known=(n,of)=>_c2Pill(`${n} of ${of} trained`,of&&n>=of?_C2_TONE.good:n>=Math.ceil(of/2)?_C2_TONE.note:_C2_TONE.bad);
const _c2Mut={fontSize:13,fontFamily:C.P};
/* The page's own width, so a chart is drawn at the size it's shown and the layout folds to one column when narrow. */
function _c2Width(){ const ref=React.useRef(null), [w,setW]=React.useState(0);
  React.useLayoutEffect(()=>{ const el=ref.current; if(!el) return; const m=()=>setW(el.clientWidth); m(); if(typeof ResizeObserver==='undefined') return; const ro=new ResizeObserver(m); ro.observe(el); return ()=>ro.disconnect(); },[]);
  return [ref,w]; }

function _C2Card({title,right,children,feat,style,testid,onClick}){ const T=useTheme(), acc=_c2Acc(T);
  return <div data-testid={testid} onClick={onClick} style={{background:feat?`linear-gradient(160deg, ${_alpha(acc,0.13)}, ${_alpha(acc,0.02)} 70%)`:'rgba(255,255,255,0.035)',border:`1px solid ${feat?_alpha(acc,0.34):'rgba(255,255,255,0.09)'}`,borderRadius:18,padding:'18px 20px',cursor:onClick?'pointer':'default',minWidth:0,...style}}>
    {(title||right)&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:10,marginBottom:10}}>{_c2Lab(T,title,feat?acc:null)}<span style={{..._c2Mut,color:T.mid,display:'flex',alignItems:'center',gap:8}}>{right}</span></div>}
    {children}</div>; }
/* One standout fact, three quick ones beneath it, and the page's actions on the right. */
function _C2Head({hi,sub,section,actions}){ const T=useTheme(), acc=_c2Acc(T), h=TeamReport.headline(section);
  return <div data-testid="c2-head" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:24,flexWrap:'wrap',marginBottom:22}}>
    <div style={{minWidth:0}}>
      <div style={{fontSize:15,fontFamily:C.P}}><span style={{color:acc,fontWeight:500}}>{hi}</span>{sub&&<span style={{color:T.mid}}> · {sub}</span>}</div>
      <div data-testid="c2-fact" style={{fontSize:38,lineHeight:1.15,fontWeight:300,letterSpacing:'-0.015em',color:T.ink,fontFamily:C.P,marginTop:6}}>{h.pre}<span style={{fontWeight:500}}>{h.strong}</span>{h.post}</div>
      {h.bullets.length>0&&<div data-testid="c2-bullets" style={{display:'flex',gap:'6px 26px',flexWrap:'wrap',marginTop:10}}>{h.bullets.map((b,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:6,height:6,borderRadius:3,background:_C2_TONE[b.tone]||_C2_TONE.note,flexShrink:0}}/><span style={{fontSize:15,fontWeight:300,color:T.ink2,fontFamily:C.P}}>{b.text}</span></div>)}</div>}
    </div>
    {actions&&<div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>{actions}</div>}
  </div>; }
function _C2Btn({children,primary,onClick,testid}){ const T=useTheme(), acc=_c2Acc(T);
  return <div role="button" data-testid={testid} onClick={onClick} style={{padding:primary?'10px 18px':'9px 16px',borderRadius:12,fontSize:14,fontWeight:500,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap',background:primary?acc:'transparent',color:primary?_c2Ink():T.ink2,border:primary?'none':'1px solid rgba(255,255,255,0.17)'}}>{children}</div>; }
function _C2Kpi({label,value,unit,delta,good=true,note,onClick,testid}){ const T=useTheme();
  return <_C2Card onClick={onClick} testid={testid} style={{padding:'16px 18px'}}>{_c2Lab(T,label)}
    <div style={{fontSize:32,fontWeight:600,lineHeight:1.1,letterSpacing:'-0.015em',color:T.ink,fontFamily:C.P,marginTop:6}}>{value}{unit&&<span style={{fontSize:14,fontWeight:400,color:T.mid}}> {unit}</span>}</div>
    {delta&&<div style={{fontSize:13,fontWeight:500,fontFamily:C.P,color:good?_C2_TONE.good:_C2_TONE.bad,marginTop:2}}>{delta}</div>}
    {note&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>{note}</div>}</_C2Card>; }
/* Who can sell it: the faces of the people who hold the wine, with how many of those who serve it that is. */
function _C2Knowers({people,of,size=24}){ const T=useTheme();
  return <div data-testid="c2-knowers" style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}><div style={{display:'flex',paddingLeft:6}}>{people.map(p=><div key={p.id} title={p.name} style={{marginLeft:-6,border:`2px solid ${T.bg}`,borderRadius:'50%'}}><TeamFace person={p} size={size}/></div>)}</div>{_c2Known(people.length,of)}</div>; }
function _C2Row({first,children,onClick,testid,align}){ return <div data-testid={testid} role={onClick?'button':undefined} onClick={onClick} style={{display:'flex',alignItems:align||'center',gap:12,padding:'9px 0',borderTop:first?'none':'1px solid rgba(255,255,255,0.065)',cursor:onClick?'pointer':'default'}}>{children}</div>; }
function _C2Meter({label,val,of,col,note}){ const T=useTheme();
  return <div style={{marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',fontSize:14,fontFamily:C.P,color:T.ink}}><span style={{fontWeight:500}}>{label}</span><span><span style={{fontWeight:500}}>{val}</span><span style={{color:T.mid}}> of {of}</span></span></div>
    <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden',marginTop:6}}><div style={{height:'100%',borderRadius:3,width:`${of?Math.round(100*val/of):0}%`,background:col}}/></div>
    {note&&<div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:4}}>{note}</div>}</div>; }
/* A line chart at the width it's shown: series [{vals, col, dash, fill, fmt}] share the x axis and each keeps its own
   scale, so takings a guest and readiness can be read against each other. `marks` labels every point of the first. */
function _C2Line({series,labels,height=200,marks}){ const T=useTheme(), [ref,w]=_c2Width(), W=Math.max(200,w), H=height, pad=marks?26:14;
  const xy=vals=>{ const ok=vals.filter(v=>v!=null), mn=Math.min(...ok), mx=Math.max(...ok), span=mx-mn||1; return vals.map((v,i)=>v==null?null:[vals.length>1?i*W/(vals.length-1):W/2, H-12-(v-mn)/span*(H-pad-12)]); };
  const path=pts=>pts.filter(Boolean).map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  return <div ref={ref} style={{width:'100%'}}>{w>0&&<svg width={W} height={H+24} style={{display:'block',overflow:'visible'}}>
    <defs><linearGradient id="c2fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.14"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
    {[0.25,0.5,0.75,1].map(f=><line key={f} x1="0" x2={W} y1={H*f} y2={H*f} stroke="rgba(255,255,255,0.05)"/>)}
    {series.map((s,si)=>{ const pts=xy(s.vals), d=path(pts), last=pts.filter(Boolean).slice(-1)[0]; if(!d) return null;
      return <g key={si}>{s.fill&&<path d={`${d} L${last[0]},${H} L${pts.find(Boolean)[0]},${H} Z`} fill="url(#c2fade)"/>}
        <path d={d} fill="none" stroke={s.col} strokeWidth={s.dash?1.8:2.4} strokeDasharray={s.dash?'5 5':undefined} strokeLinecap="round" strokeLinejoin="round"/>
        {!s.dash&&last&&<circle cx={last[0]} cy={last[1]} r="4" fill={s.col}/>}
        {marks&&si===0&&pts.map((p,i)=>p&&<text key={i} x={p[0]-(i===pts.length-1?10:0)} y={p[1]-10} fill={T.ink} fontFamily="Poppins" fontSize="12" textAnchor={i===0?'start':i===pts.length-1?'end':'middle'}>{s.fmt?s.fmt(s.vals[i]):s.vals[i]}</text>)}</g>; })}
    {labels.map((l,i)=><text key={i} x={labels.length>1?i*W/(labels.length-1):W/2} y={H+20} fill="rgba(255,255,255,0.45)" fontFamily="Poppins" fontSize="12" textAnchor={i===0?'start':i===labels.length-1?'end':'middle'}>{l}</text>)}
  </svg>}</div>; }
const _c2Weeks=ws=>ws.map((x,i)=>i===ws.length-1?'This week':new Date(x.from).toLocaleDateString(undefined,{day:'numeric',month:'short'}));
/* A face inside a ring of that person's readiness against their role's minimum. */
function _C2Person({x,open}){ const T=useTheme(), st=_tState[x.r.state], size=64, sw=5, r=(size-sw)/2, L=2*Math.PI*r;
  return <div role="button" data-testid="c2-person" onClick={()=>open({view:'person',id:x.person.id})} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,flex:'1 0 84px',cursor:'pointer'}}>
    <div style={{position:'relative',width:size,height:size}}><svg width={size} height={size} style={{position:'absolute',inset:0}}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={st.col} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${L*x.r.pct/100} ${L}`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}><TeamFace person={x.person} size={48}/></div></div>
    <div style={{fontSize:13,fontWeight:500,color:T.ink,fontFamily:C.P}}>{x.person.name.split(' ')[0]}</div>
    <div style={{fontSize:12,color:st.col,fontFamily:C.P,whiteSpace:'nowrap'}}>{x.r.pct}% · {x.r.behind>0?'Behind':st.label==='Not ready yet'?'Not yet':st.label}</div></div>; }
/* Things to act on, each a tap to what it's about: a tag, a line and what's behind it. */
function _C2Needs({items,open,tagW=72}){ const T=useTheme(), acc=_c2Acc(T);
  return <div>{items.map((b,i)=><_C2Row key={i} first={i===0} align="flex-start" onClick={b.open?()=>open(b.open):undefined} testid="c2-need"><div style={{marginTop:1,width:tagW,flexShrink:0}}>{_c2Pill(b.tag,_C2_TONE[b.tone]||_C2_TONE.note)}</div><div style={{minWidth:0,flex:1}}><div style={{fontSize:14,fontWeight:b.act?400:500,color:T.ink,fontFamily:C.P,lineHeight:1.45}}>{b.fact||b.title}</div>{b.text&&<div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{b.text}</div>}
    {b.act&&<div data-testid="c2-act" style={{fontSize:14,fontWeight:500,color:acc,fontFamily:C.P,lineHeight:1.45,marginTop:3}}>→ {b.act}</div>}</div></_C2Row>)}</div>; }
const _C2_TAG={week:'Week',cover:'Guest',top:'Top',gaps:'Gap',lift:'Lift',drill:'Team',known:'Slow',slow:'Slow',till:'POS'};
const _c2Brief=(n,keep)=>(TeamReport.salesBrief()||[]).filter(b=>!keep||keep.includes(b.k)).slice(0,n).map(b=>({tag:_C2_TAG[b.k]||'Note',tone:b.tone==='good'?'good':b.tone==='bad'?'bad':'note',title:b.title,text:(b.rows?b.rows.map(r=>`${r.label} (${r.value.replace(' know it','')})`).join(', '):String(b.text||'').split(/(?<=[.!?])\s+/)[0]),open:b.open}));
/* The page as the #3 layout: a tall column on the left, a grid on the right, both folding to one column when narrow. */
function _C2Split({left,children,two}){ return <div style={{display:'grid',gridTemplateColumns:two?'minmax(0,1fr) minmax(0,2fr)':'minmax(0,1fr)',gap:16,alignItems:'stretch'}}><div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>{left}</div><div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>{children}</div></div>; }
const _c2Grid=(n,two)=>({display:'grid',gridTemplateColumns:`repeat(${two?n:Math.min(n,2)},minmax(0,1fr))`,gap:16});
const _c2Up=(v,unit='%')=>v==null?null:`${v>=0?'▲':'▼'} ${Math.abs(v)}${unit} on last week`;

/* ── Dashboard ── */
/* What training is worth, in weeks: the multiple, what it means in money for one server, then each top seller with
   who isn't trained on it yet, what a week would add, and a button that puts it first in their drills. */
function _C2Lift({open}){ const T=useTheme(), acc=_c2Acc(T), t=TeamReport.trainingWorth(28,4), [done,setDone]=React.useState({});
  if(!t) return null; const top=Math.max(1,...t.rows.map(x=>Math.max(x.trained,x.untrained))), wk=v=>_cMoney(v,{dp:v<10?2:0});
  const bar=(v,col,label)=><div style={{display:'flex',alignItems:'center',gap:10,marginTop:4}}><div style={{width:150,fontSize:13,color:T.mid,fontFamily:C.P,flexShrink:0}}>{label}</div><div style={{flex:1,height:10,borderRadius:5,background:'rgba(255,255,255,0.06)',overflow:'hidden'}}><div style={{height:'100%',borderRadius:5,width:`${Math.max(2,Math.round(100*v/top))}%`,background:col}}/></div><div style={{width:92,textAlign:'right',fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P,flexShrink:0}}>{wk(v)}<span style={{fontSize:12,fontWeight:400,color:T.mid}}> a week</span></div></div>;
  return <_C2Card title="What training is worth" right="from your own sales, the last 4 weeks" testid="c2-lift" style={{flex:1}}>
    <div style={{display:'flex',gap:28,flexWrap:'wrap'}}>
      <div style={{flex:'1 1 230px',minWidth:0}}>
        <div style={{fontSize:56,fontWeight:600,lineHeight:1,letterSpacing:'-0.02em',color:acc,fontFamily:C.P}}>{t.x>=1.95?Math.round(t.x):t.x}×</div>
        <div style={{fontSize:15,color:T.ink,fontFamily:C.P,lineHeight:1.5,marginTop:10}}>Servers sell <span style={{fontWeight:500}}>{t.x>=1.95?Math.round(t.x):t.x} times as much</span> of a wine once they're trained on it.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:14}}>
          <div><div style={{fontSize:24,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.15}}>{wk(t.trained)}</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>a week, per wine, from a trained server</div></div>
          <div><div style={{fontSize:24,fontWeight:600,color:T.mid,fontFamily:C.P,lineHeight:1.15}}>{wk(t.untrained)}</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>a week, per wine, from one who isn't yet</div></div></div>
        {t.total>=1&&<div data-testid="c2-lift-total" style={{marginTop:16,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.1)'}}><div style={{fontSize:14,color:T.ink,fontFamily:C.P,lineHeight:1.5}}>Train the rest of the team on your top sellers and that's about <span style={{fontWeight:600,color:acc}}>{_cMoney(t.total)} more a week</span>.</div>
          <div style={{fontSize:13,fontWeight:500,color:acc,fontFamily:C.P,marginTop:6}}>→ Start with the wines on the right.</div></div>}
      </div>
      <div style={{flex:'2 1 400px',minWidth:0}}>
        {t.rows.length?t.rows.map((x,i)=>{ const who=x.missing.map(p=>p.name.split(' ')[0]), ok=done[x.wine.id]; return <div key={x.wine.id} data-testid="c2-lift-row" style={{padding:'10px 0',borderTop:i?'1px solid rgba(255,255,255,0.065)':'none'}}>
          <div role="button" onClick={()=>open({view:'wine',id:x.wine.id})} style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P,cursor:'pointer'}}>{TeamData.short(x.wine)}</div>
          {bar(x.trained,acc,'Each trained server')}{bar(x.untrained,'rgba(255,255,255,0.38)','Each one not yet')}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:8,flexWrap:'wrap'}}><div style={{fontSize:13,color:T.ink2,fontFamily:C.P,lineHeight:1.4}}>Train {who.length>1?who.slice(0,-1).join(', ')+' and '+who[who.length-1]:who[0]}: about <span style={{fontWeight:500,color:acc}}>+{_cMoney(x.extra)} a week</span>.</div>
            <div role="button" data-testid="c2-lift-assign" onClick={()=>{ if(ok) return; x.missing.forEach(p=>TeamLearn.prioritise(p.id,[x.wine.id])); setDone(d=>({...d,[x.wine.id]:true})); }} style={{padding:'6px 12px',borderRadius:10,fontSize:13,fontWeight:500,fontFamily:C.P,cursor:ok?'default':'pointer',whiteSpace:'nowrap',border:`1px solid ${ok?_alpha(_C2_TONE.good,0.4):_alpha(acc,0.5)}`,color:ok?_C2_TONE.good:acc}}>{ok?'✓ First in their drills':'Put it first in their drills'}</div></div></div>; })
        :<div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.5}}>Everyone who serves your top sellers is trained on them. Keep new arrivals assigned as they come in.</div>}
      </div>
    </div></_C2Card>; }
/* How far training has spread over a set of things, with room to grow: one bar in three parts (the whole team, at
   least half, fewer), the counts in words, and the ones to act on named with what to do. */
function _C2Spread({label,sp,unit,open,act}){ const T=useTheme(), acc=_c2Acc(T), seg=(n,col)=>n>0&&<div style={{flex:n,background:col}}/>, g=sp.gaps.slice(0,3);
  return <div data-testid="c2-spread"><div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>{label}</div>
    <div style={{display:'flex',gap:2,height:8,borderRadius:4,overflow:'hidden',marginTop:8,background:'rgba(255,255,255,0.08)'}}>{seg(sp.all,_C2_TONE.good)}{seg(sp.most,_C2_TONE.note)}{seg(sp.few,_C2_TONE.bad)}</div>
    <div style={{display:'flex',gap:'4px 18px',flexWrap:'wrap',marginTop:8,fontSize:13,fontFamily:C.P,color:T.ink2}}>{[[sp.all,_C2_TONE.good,'whole team trained'],[sp.most,_C2_TONE.note,'at least half trained'],[sp.few,_C2_TONE.bad,'fewer than half trained']].map(([n,col,l])=><span key={l} style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:8,height:8,borderRadius:2,background:col}}/><span><span style={{fontWeight:500,color:T.ink}}>{n}</span> {l}</span></span>)}</div>
    {g.length>0?<div style={{fontSize:13,fontFamily:C.P,lineHeight:1.5,marginTop:8,color:acc,fontWeight:500}}>→ {act}: {g.map((x,i)=><span key={i}><span role="button" onClick={()=>open(x.open)} style={{textDecoration:'underline',textUnderlineOffset:3,cursor:'pointer'}}>{x.name}</span> <span style={{color:T.mid,fontWeight:400}}>({x.n} of {x.of} trained)</span>{i<g.length-1?', ':''}</span>)}{sp.gaps.length>g.length?` and ${sp.gaps.length-g.length} more`:''}.</div>
      :<div style={{fontSize:13,color:_C2_TONE.good,fontFamily:C.P,marginTop:8}}>The whole team is trained on every {unit}.</div>}</div>; }
/* The plan behind a line of Needs you: the figures, then things to do, each with a button where the console can do it. */
function _C2Plan({panel,open,close}){ const T=useTheme(), acc=_c2Acc(T), plan=TeamReport.plan(panel.kind,panel.id), [done,setDone]=React.useState({});
  if(!plan) return null;
  const run=(b,i)=>{ if(b.do==='first'){ (b.pids||[b.pid]).forEach(pid=>TeamLearn.prioritise(pid,b.ids)); setDone(d=>({...d,[i]:true})); } else if(b.do==='feature'){ if(!TeamData.isFeature(b.id)) TeamData.toggleTonight('feature',b.id); setDone(d=>({...d,[i]:true})); } else if(b.do==='open') open(b.open); };
  return <><div data-testid="console-scrim" onClick={close} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.62)'}}/>
    <div data-testid="c2-plan" role="dialog" aria-label={plan.title} style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(620px, 92%)',maxHeight:'86%',overflowY:'auto',background:'#0E0E10',border:`1px solid ${_alpha(acc,0.34)}`,borderRadius:20,padding:'22px 26px 24px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:14}}><div style={{fontSize:20,fontWeight:500,color:T.ink,fontFamily:C.P,lineHeight:1.3}}>{plan.title}</div><div role="button" aria-label="Close" data-testid="c2-plan-close" onClick={close} style={{width:32,height:32,borderRadius:16,border:'1px solid rgba(255,255,255,0.16)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16,color:T.ink,flexShrink:0}}>×</div></div>
      <div style={{marginTop:14}}>{_c2Lab(T,'Where things stand')}{plan.facts.map((f,i)=><div key={i} style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.5,marginTop:6}}>{f}</div>)}</div>
      <div style={{marginTop:18}}>{_c2Lab(T,'What to do',acc)}{plan.steps.map((st,i)=><div key={i} data-testid="c2-plan-step" style={{display:'flex',gap:12,padding:'12px 0',borderTop:i?'1px solid rgba(255,255,255,0.065)':'none'}}>
        <div style={{width:24,height:24,borderRadius:12,background:_alpha(acc,0.16),color:acc,fontSize:13,fontWeight:500,fontFamily:C.P,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{i+1}</div>
        <div style={{minWidth:0,flex:1}}><div style={{fontSize:14,color:T.ink,fontFamily:C.P,lineHeight:1.5}}>{st.text}</div>
          {st.button&&<div role="button" data-testid="c2-plan-do" onClick={()=>!done[i]&&run(st.button,i)} style={{display:'inline-block',marginTop:8,padding:'7px 14px',borderRadius:10,fontSize:13,fontWeight:500,fontFamily:C.P,cursor:done[i]?'default':'pointer',background:done[i]?'transparent':acc,color:done[i]?_C2_TONE.good:_c2Ink(),border:done[i]?`1px solid ${_alpha(_C2_TONE.good,0.4)}`:'none'}}>{done[i]?'✓ Done':st.button.label}</div>}</div></div>)}</div>
    </div></>; }
function _C2Dash({open,setSection,me,two,jump}){ const T=useTheme(), acc=_c2Acc(T), s=TeamSales.has()?TeamReport.salesSummary(7):null, o=TeamReport.overview(), ppl=TeamReport.people();
  const top=s?TeamReport.salesByWine(7).slice(0,6):TeamReport.coverage().rows.filter(x=>x.of>0).slice(0,6), delta=s?TeamReport.wineDelta(7):{}, cov=o.coverage, up=TeamReport.upside();
  const pairs=TeamReport.pairings().filter(x=>x.first), pairAll=pairs.filter(x=>x.of&&x.people.length>=Math.ceil(x.of/2)).length, sold=pairs.filter(x=>x.sold!=null), soldPct=sold.length?Math.round(100*sold.reduce((a,x)=>a+x.sold,0)/sold.length):null;
  const tn=TeamData.tonight(), sps=TeamShift.specials(), reg=TeamShift.register(), st=TeamShift.status(), feat=tn.feature.map(id=>TeamData.wine(id)||TeamData.cocktail(id)).filter(Boolean), off=tn.off.map(id=>TeamData.dish(id)).filter(Boolean);
  const hour=new Date().getHours(), hi=`Good ${hour<12?'morning':hour<18?'afternoon':'evening'}, ${me.name.split(' ')[0]}`, needs=TeamReport.dashActions().slice(0,4);
  const th={fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',color:T.mid,fontWeight:500,fontFamily:C.P,textAlign:'left',padding:'4px 10px 8px 0',whiteSpace:'nowrap'}, td={padding:'10px 10px 10px 0',borderTop:'1px solid rgba(255,255,255,0.065)',fontSize:14,fontFamily:C.P,color:T.ink,verticalAlign:'middle'}, num={...td,textAlign:'right'}, dash=<span style={{color:T.mid}}>—</span>;
  return <div data-testid="console-dash">
    <_C2Head hi={hi} sub={new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'})} section="dash" actions={<>{TeamSales.demo()&&<_CDemoTag/>}<_C2Btn onClick={()=>setSection('sales')} testid="c2-to-sales">Open Sales Insights</_C2Btn></>}/>
    <div style={{..._c2Grid(5,two),marginBottom:16}}>
      <_C2Kpi label="Wine sales this week" value={s?_cMoney(s.revenue):'—'} delta={s?_c2Up(s.delta.revenue):null} good={!s||s.delta.revenue>=0} note={s?`${s.glasses} glasses · ${s.bottles} bottles`:'Import your sales to see it'} onClick={()=>jump('sales','sales-revenue')}/>
      <_C2Kpi testid="c2-kpi-guest" label="Wine per guest" value={s&&s.perCover!=null?_cMoney(s.perCover,{dp:2}):'—'} delta={s?_c2Up(s.delta.perCover):null} good={!s||s.delta.perCover>=0} note={s?`${s.covers} guests over 7 nights`:''} onClick={()=>jump('sales','c2-kpi-perguest')}/>
      <_C2Kpi testid="c2-kpi-pairing" label={soldPct!=null?'Sold with the pairing':'Pairings the team can offer'} value={soldPct!=null?`${soldPct}%`:pairAll} unit={soldPct!=null?'':`of ${pairs.length}`} note={soldPct!=null?`of dishes go out with the wine we suggest · demo data`:'at least half the servers trained on the wine'} onClick={()=>jump('menu','c2-pairing-panel')}/>
      <_C2Kpi testid="dash-readiness" label="Training finished" value={`${o.avg}%`} note={`${o.ready} ready for service · ${o.slipping} slipping · ${o.behind} behind`} onClick={()=>jump('team','c2-team-table')}/>
      <_C2Kpi label="Still on the table" value={up?_cMoney(up.total):'—'} unit={up?'a week':''} note={up&&up.rows.length?'if every server were trained on your top sellers':'Every server is trained on your top sellers'} onClick={()=>jump('sales','c2-upside')}/>
    </div>
    <_C2Card feat title={s?'Your best sellers · who is trained on them':'Your list · who is trained on it'} right={s?'the last 7 nights from your POS':null} testid="c2-sellers">
      <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Wine</th>{s&&<><th style={{...th,textAlign:'right'}}>Glasses</th><th style={{...th,textAlign:'right'}}>Bottles</th><th style={{...th,textAlign:'right'}}>Sales</th><th style={{...th,textAlign:'right'}}>On last week</th></>}<th style={{...th,paddingLeft:24}}>Trained on it</th></tr></thead>
        <tbody>{top.map(x=>{ const kb=TeamReport.knownBy(x.wine), d=delta[x.wine.id]; return <tr key={x.wine.id} data-testid="c2-seller" onClick={()=>open({view:'wine',id:x.wine.id})} style={{cursor:'pointer'}}>
          <td style={td}><div style={{fontWeight:500}}>{TeamData.short(x.wine)}</div><div style={{fontSize:12,color:T.mid}}>{[x.wine.section,x.wine.glass&&`${x.wine.glass} glass`,x.wine.bottle&&`${x.wine.bottle} bottle`].filter(Boolean).join(' · ')}</div></td>
          {s&&<><td style={num}>{x.glasses||dash}</td><td style={num}>{x.bottles||dash}</td><td style={{...num,fontWeight:500}}>{_cMoney(x.revenue)}</td><td style={{...num,fontWeight:500,color:d==null?T.mid:d>=0?_C2_TONE.good:_C2_TONE.bad}}>{d==null?'—':`${d>=0?'+':'−'}${Math.abs(d)}%`}</td></>}
          <td style={{...td,paddingLeft:24}}><_C2Knowers people={kb.people} of={kb.of}/></td></tr>; })}</tbody></table></div>
      <div style={{..._c2Grid(2,two),marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,0.1)'}}>
        <_C2Spread label="By-the-glass wines" sp={TeamReport.spread('glass')} unit="glass" open={open} act="Train more of the team on"/>
        <_C2Spread label="Pairings: the wine to pour with each dish" sp={TeamReport.spread('pairings')} unit="pairing" open={open} act="Few can offer the wine for"/></div>
    </_C2Card>
    <div style={{display:'grid',gridTemplateColumns:two?'minmax(0,2fr) minmax(0,1fr)':'minmax(0,1fr)',gap:16,marginTop:16,alignItems:'stretch'}}>
      <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
        {s&&<_C2Lift open={open}/>}
        <_C2Card title="The team" right={`${ppl.filter(x=>x.lastDrill&&Date.now()-x.lastDrill<86400000).length} of ${ppl.length} drilled today`} testid="c2-floor"><div style={{display:'flex',flexWrap:'wrap',rowGap:14}}>{ppl.map(x=><_C2Person key={x.person.id} x={x} open={open}/>)}</div></_C2Card>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
        <_C2Card title="Needs you" testid="c2-needs" style={{flex:1}}>{needs.length?<_C2Needs items={needs} open={open} tagW={78}/>:<div style={{fontSize:14,color:T.mid,fontFamily:C.P}}>Nothing needs you right now.</div>}</_C2Card>
        <_C2Card title="Tonight" right={st.sent?`Briefing read by ${reg.read} of ${reg.total}`:st.empty?'Nothing set':'Briefing not sent'} onClick={()=>open({view:'tonight'})} testid="c2-tonight">
          {st.empty?<div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.45}}>What you're pushing, tonight's specials and what's 86'd go to the team as a briefing they accept before service.</div>
          :<div style={{display:'grid',gridTemplateColumns:'auto 1fr',gap:'6px 14px',fontSize:13,fontFamily:C.P,color:T.ink}}>
            {feat.length>0&&<><span style={{color:T.mid}}>Pushing</span><span style={{fontWeight:500}}>{feat.map(x=>x.producer?TeamData.short(x):x.name).join(', ')}</span></>}
            {sps.length>0&&<><span style={{color:T.mid}}>Specials</span><span>{sps.map(sp=>{ const w=TeamData.wine((sp.pairing.glass||sp.pairing.bottle||{}).id); return <div key={sp.id}>{sp.name}{TeamShift.price(sp)?` ${TeamShift.price(sp)}`:''}{w?<span style={{color:T.mid}}> · pour the {TeamData.nick(w)}</span>:null}</div>; })}</span></>}
            {off.length>0&&<><span style={{color:T.mid}}>86'd</span><span>{off.map(x=>x.name).join(', ')}</span></>}
            {tn.note&&<><span style={{color:T.mid}}>Note</span><span>{tn.note}</span></>}</div>}
          <div style={{fontSize:13,fontWeight:500,color:acc,fontFamily:C.P,marginTop:10}}>{st.empty?'Set tonight →':'Change tonight →'}</div></_C2Card>
      </div>
    </div>
  </div>; }

/* ── Sales Insights ── */
function _C2Sales({open,setSection,two}){ const T=useTheme(), acc=_c2Acc(T), s=TeamReport.salesSummary(7), [chart,setChart]=React.useState('all');
  if(!s) return <div data-testid="console-sales"><_C2Head hi="Sales Insights" sub="no sales yet" section="sales"/><_C2Card title="Bring in your sales"><div style={{fontSize:14,color:T.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:12}}>Import a sales file from your POS and this page shows what sells, who sells it and what knowing the list is worth.</div><_C2Btn primary onClick={()=>setSection('pos')}>Open Integrations</_C2Btn></_C2Card></div>;
  const wk=TeamReport.weeklyTrend(8), byWine=TeamReport.salesByWine(7).slice(0,8), delta=TeamReport.wineDelta(7), up=TeamReport.upside()||{total:0,rows:[]}, upBy=Object.fromEntries(up.rows.map(x=>[x.wine.id,x.extra])), know=TeamReport.soldKnowing(7);
  const srv=TeamReport.salesByServer(28).filter(x=>x.shifts>0), best=srv.length?Math.max(...srv.map(x=>x.revenuePerShift||0)):1, glassRev=s.revenue-s.bottleRevenue, share=s.revenue?s.bottleRevenue/s.revenue:0;
  const th={fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',color:T.mid,fontWeight:500,fontFamily:C.P,textAlign:'left',padding:'4px 10px 8px 0',whiteSpace:'nowrap'}, td={padding:'10px 10px 10px 0',borderTop:'1px solid rgba(255,255,255,0.065)',fontSize:14,fontFamily:C.P,color:T.ink,verticalAlign:'middle'}, num={...td,textAlign:'right'};
  return <div data-testid="console-sales">
    <_C2Head hi="Sales Insights" sub={`the last 7 nights · ${s.covers} guests · from your POS`} section="sales" actions={<><_CDemoTag/><_C2Btn onClick={()=>setSection('pos')}>Import sales</_C2Btn></>}/>
    <div style={{..._c2Grid(5,two),marginBottom:16}}>
      <_C2Kpi testid="sales-revenue" label="Wine sales" value={_cMoney(s.revenue)} delta={_c2Up(s.delta.revenue)} good={s.delta.revenue>=0} note={`${_cMoney(s.prev.revenue||0)} the week before`}/>
      <_C2Kpi testid="c2-kpi-perguest" label="Wine per guest" value={s.perCover!=null?_cMoney(s.perCover,{dp:2}):'—'} delta={_c2Up(s.delta.perCover)} good={s.delta.perCover>=0} note={`${s.covers} guests`}/>
      <_C2Kpi testid="c2-kpi-glasses" label="Glasses sold" value={s.glasses} delta={_c2Up(s.delta.glasses)} good={s.delta.glasses>=0} note={`${_cMoney(glassRev)} · ${Math.round(100*(1-share))}% of wine sales`}/>
      <_C2Kpi testid="c2-kpi-bottles" label="Bottles sold" value={s.bottles} delta={_c2Up(s.delta.bottles)} good={s.delta.bottles>=0} note={`${_cMoney(s.bottleRevenue)} · ${Math.round(100*share)}% of wine sales`}/>
      <_C2Kpi testid="c2-kpi-knowing" label="Sold by trained staff" value={know.share!=null?`${Math.round(100*know.share)}%`:'—'} delta={know.delta!=null?`${know.delta>=0?'▲':'▼'} ${Math.abs(know.delta)} points on last week`:null} good={know.delta==null||know.delta>=0} note="of wine sales, by a server trained on that wine"/>
    </div>
    <_C2Split two={two} left={<>
      <_C2Card feat title="What you need to know" testid="sales-brief"><_C2Needs items={TeamReport.salesActions().slice(0,5)} open={open} tagW={78}/></_C2Card>
      <_C2Card title={`Where the next ${_cMoney(up.total)} is`} right="a week" testid="c2-upside">
        <div style={{fontSize:28,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{_cMoney(up.total)}</div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginBottom:8}}>if the servers not yet trained on your best sellers sold them as well as those who are</div>
        {up.rows.length?<_C2Needs open={open} items={up.rows.slice(0,3).map(x=>({tag:_cMoney(x.extra),tone:'good',title:`Teach the ${TeamData.nick(x.wine)} to ${x.missing.length} more`,text:`${x.knows} of the ${x.of} who serve it are trained on it now`,open:{view:'wine',id:x.wine.id}}))}/>:<div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Everyone who serves your top sellers is trained on them.</div>}
        <div style={{fontSize:12,color:T.mid,fontFamily:C.P,marginTop:10,lineHeight:1.4}}>A pointer from 28 nights of your own sales, never a promise: sections and nights vary.</div></_C2Card>
    </>}>
      <_C2Card title="Wine sales by week" right={<span data-testid="c2-chart-toggle" style={{display:'flex',gap:6}}>{[['all','All wine'],['bottles','Bottles'],['glasses','Glasses']].map(([k,l])=>_c2Chip(T,l,chart===k,()=>setChart(k),'c2-chart-'+k))}</span>} testid="sales-trend">
        <_C2Line key={chart} height={250} marks labels={_c2Weeks(wk)} series={[{vals:wk.map(x=>chart==='bottles'?x.bottleRevenue:chart==='glasses'?x.revenue-x.bottleRevenue:x.revenue),col:T.ink,fill:true,fmt:v=>_cMoney(v)}]}/></_C2Card>
      <_C2Card title="Who sells it" right="wine sold a shift beside training finished · 28 nights" testid="sales-servers"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Server</th><th style={{...th,textAlign:'right'}}>Wine a shift</th><th style={th}>Readiness</th><th style={{...th,textAlign:'right'}}>Glasses</th><th style={{...th,textAlign:'right'}}>Bottles</th></tr></thead>
        <tbody>{srv.map(x=>{ const r=x.readiness, col=r?_tState[r.state].col:T.mid; return <tr key={x.person.id} data-testid="c2-server" onClick={()=>open({view:'person',id:x.person.id})} style={{cursor:'pointer'}}>
          <td style={td}><div style={{display:'flex',alignItems:'center',gap:10}}><TeamFace person={x.person} size={26}/><span style={{fontWeight:500}}>{x.person.name.split(' ')[0]}</span><span style={{fontSize:12,color:T.mid}}>{TeamLearn.ROLES[x.person.role].label}</span></div></td>
          <td style={{...num,fontWeight:500}}>{_cMoney(x.revenuePerShift||0)}</td>
          <td style={td}><div style={{display:'flex',alignItems:'center',gap:10}}><div style={{width:110,height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}><div style={{height:'100%',width:`${r?r.pct:0}%`,background:col,borderRadius:3}}/></div><span>{r?r.pct:0}%</span></div></td>
          <td style={num}>{x.glasses}</td><td style={num}>{x.bottles}</td></tr>; })}</tbody></table></div></_C2Card>
      <_C2Card style={{flex:1}} title="Glass or bottle" right="share of wine sales" testid="c2-mix">
        <div style={{display:'flex',height:10,borderRadius:5,overflow:'hidden',marginTop:4}}><div style={{width:`${Math.round(100*(1-share))}%`,background:'rgba(255,255,255,0.82)'}}/><div style={{flex:1,background:acc}}/></div>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,marginTop:8,fontFamily:C.P}}><div><div style={{fontSize:14,fontWeight:500,color:T.ink}}>{Math.round(100*(1-share))}% by the glass</div><div style={{fontSize:12,color:T.mid}}>{s.glasses} glasses · {_cMoney(glassRev)}</div></div><div style={{textAlign:'right'}}><div style={{fontSize:14,fontWeight:500,color:T.ink}}>{Math.round(100*share)}% bottles</div><div style={{fontSize:12,color:T.mid}}>{s.bottles} bottles · {_cMoney(s.bottleRevenue)}</div></div></div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.08)'}}>{s.glassesPerCover.toFixed(2)} glasses and {s.bottlesPerCover.toFixed(2)} bottles a guest.</div></_C2Card>
    </_C2Split>
    <_C2Card title="Best sellers" right="the last 7 nights · trained means they've passed that wine's questions in the drill" style={{marginTop:16}} testid="sales-wines"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Wine</th><th style={{...th,textAlign:'right'}}>Glasses</th><th style={{...th,textAlign:'right'}}>Bottles</th><th style={{...th,textAlign:'right'}}>Sales</th><th style={{...th,textAlign:'right'}}>On last week</th><th style={th}>Trained on it</th><th style={{...th,textAlign:'right'}}>If all were trained</th></tr></thead>
      <tbody>{byWine.map(x=>{ const d=delta[x.wine.id], kb=TeamReport.knownBy(x.wine); return <tr key={x.wine.id} data-testid="c2-wine-row" onClick={()=>open({view:'wine',id:x.wine.id})} style={{cursor:'pointer'}}>
        <td style={td}><div style={{fontWeight:500}}>{TeamData.short(x.wine)}</div><div style={{fontSize:12,color:T.mid}}>{[x.wine.section,x.wine.glass&&`${x.wine.glass} glass`,x.wine.bottle&&`${x.wine.bottle} bottle`].filter(Boolean).join(' · ')}</div></td>
        <td style={num}>{x.glasses||<span style={{color:T.mid}}>—</span>}</td><td style={num}>{x.bottles||<span style={{color:T.mid}}>—</span>}</td><td style={{...num,fontWeight:500}}>{_cMoney(x.revenue)}</td>
        <td style={{...num,color:d==null?T.mid:d>=0?_C2_TONE.good:_C2_TONE.bad,fontWeight:500}}>{d==null?'—':`${d>=0?'+':'−'}${Math.abs(d)}%`}</td>
        <td style={td}><_C2Knowers people={kb.people} of={kb.of} size={22}/></td><td style={num}>{upBy[x.wine.id]?`+${_cMoney(upBy[x.wine.id])}`:'—'}</td></tr>; })}</tbody></table></div></_C2Card>
  </div>; }

/* The classic section's editor, kept under a fold so nothing the console could do is lost in the new look. */
function _C2Manage({k,title,children}){ const T=useTheme(), acc=_c2Acc(T), [on,setOn]=React.useState(()=>!TeamFold.folded(k,true));
  return <div style={{marginTop:16}}><div role="button" data-testid={'c2-manage-'+k} aria-expanded={on} onClick={()=>setOn(v=>{ TeamFold.set(k,v); return !v; })} style={{fontSize:14,fontWeight:500,color:acc,fontFamily:C.P,cursor:'pointer',padding:'6px 0'}}>{on?'Hide':title} {on?'↑':'↓'}</div>{on&&<div style={{marginTop:10}}>{children}</div>}</div>; }
const _C2_WIN={'At its peak':'#6FD79C','Drinking well':'#9CC9F5','Still young':'#F2B84B','Past its best':'#F58B7C'};
const _c2Chip=(T,label,on,onClick,tid)=><span key={label} role="button" data-testid={tid} aria-pressed={on} onClick={onClick} style={{padding:'5px 12px',borderRadius:999,fontSize:13,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap',border:`1px solid ${on?T.ink:'rgba(255,255,255,0.17)'}`,color:on?T.ink:T.mid}}>{label}</span>;

/* ── Wines ── */
function _C2Wines({open,setSection,two}){ const T=useTheme(), acc=_c2Acc(T), ws=TeamData.wines().filter(w=>!TeamData.isDrink(w)), cov=TeamReport.coverage(), [q,setQ]=React.useState(''), [f,setF]=React.useState('all');
  const sold=TeamSales.has()?Object.fromEntries(TeamReport.salesByWine(28).map(x=>[x.id,x])):{}, top=Math.max(1,...Object.values(sold).map(x=>x.qty)), fresh=new Set(TeamReport.adoption().map(a=>a.wine.id)), know=TeamSales.has()?TeamReport.soldKnowing(7):null;
  const rows=ws.map(w=>({w,kb:TeamReport.knownBy(w),win:TeamData.window(w),s:sold[w.id]})), served=rows.filter(x=>x.kb.of>0), all=served.filter(x=>x.kb.people.length>=Math.ceil(x.kb.of/2)).length;
  const n=x=>TeamShift._norm(x), hit=x=>(!q.trim()||n([TeamData.label(x.w),x.w.region,x.w.country,(x.w.grapes||[]).join(' ')].join(' ')).includes(n(q)))&&(f==='all'||(f==='glass'&&TeamData.byGlass(x.w))||(f==='few'&&x.kb.of&&x.kb.people.length<Math.ceil(x.kb.of/2))||(f==='new'&&fresh.has(x.w.id)));
  const shown=rows.filter(hit), secs=[...new Set(shown.map(x=>x.w.section||'Wines'))], wins={}; rows.forEach(x=>{ if(x.win) wins[x.win.word]=(wins[x.win.word]||0)+1; });
  const th={fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',color:T.mid,fontWeight:500,fontFamily:C.P,textAlign:'left',padding:'4px 10px 8px 0',whiteSpace:'nowrap'}, td={padding:'10px 10px 10px 0',borderTop:'1px solid rgba(255,255,255,0.065)',fontSize:14,fontFamily:C.P,color:T.ink,verticalAlign:'middle'}, num={...td,textAlign:'right'};
  const size=84, sw=8, r=(size-sw)/2, L=2*Math.PI*r, pct=served.length?Math.round(100*all/served.length):0, ad=TeamReport.adoption();
  return <div data-testid="console-wines">
    <_C2Head hi="Wines" sub={`${ws.length} on the list · ${ws.filter(TeamData.byGlass).length} by the glass`} section="wines" actions={<><_C2Btn onClick={()=>setSection('upload')}>Add a wine from its label</_C2Btn><_C2Btn primary onClick={()=>setSection('upload')}>Upload a new list</_C2Btn></>}/>
    <_C2Split two={two} left={<_C2Card feat title="How well the team is trained on the list" testid="c2-list-known">
        <div style={{display:'flex',alignItems:'center',gap:16,margin:'4px 0 16px'}}><div style={{position:'relative',width:size,height:size,flexShrink:0}}><svg width={size} height={size}><circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw}/><circle cx={size/2} cy={size/2} r={r} fill="none" stroke={acc} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${L*pct/100} ${L}`} transform={`rotate(-90 ${size/2} ${size/2})`}/></svg><div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:600,color:T.ink,fontFamily:C.P}}>{pct}%</div></div>
          <div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P,lineHeight:1.35}}>{all} of {served.length} have at least half their servers trained on them</div></div>
        <_C2Meter label="By the glass" val={cov.glass.covered} of={cov.glass.total} col={_C2_TONE.good} />
        <_C2Meter label="By the bottle" val={cov.bottle.covered} of={cov.bottle.total} col={cov.bottle.covered>=cov.bottle.total?_C2_TONE.good:_C2_TONE.note}/>
        {know&&know.share!=null&&<_C2Meter label="Sold this week by a server trained on it" val={Math.round(100*know.share)} of={100} col={_C2_TONE.good} note="% of wine takings"/>}
        {Object.keys(wins).length>0&&<div style={{paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.1)'}}>{_c2Lab(T,'Drinking windows')}<div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:8}}>{Object.keys(_C2_WIN).filter(k=>wins[k]).map(k=><span key={k}>{_c2Pill(`${wins[k]} ${k.toLowerCase()}`,_C2_WIN[k])}</span>)}</div></div>}
        {ad.length>0&&<div style={{marginTop:14,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.1)'}}>{_c2Lab(T,'New on the list')}{ad.slice(0,3).map(a=><div key={a.wine.id} role="button" onClick={()=>open({view:'wine',id:a.wine.id})} style={{marginTop:6,cursor:'pointer'}}><div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>{TeamData.short(a.wine)}</div><div style={{fontSize:13,color:T.mid,fontFamily:C.P}}>Added {a.days===0?'today':`${a.days} day${a.days===1?'':'s'} ago`} · {a.knows} of {a.of} have it</div></div>)}</div>}
      </_C2Card>}>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        <input aria-label="Find a wine" data-testid="c2-wine-find" value={q} onChange={e=>setQ(e.target.value)} placeholder="Find a wine, grape or region…" style={{width:280,padding:'8px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.14)',background:'transparent',color:T.ink,fontFamily:C.P,fontSize:14,outline:'none'}}/>
        {[['all','All'],['glass','By the glass'],['few','Few trained'],['new','New']].map(([k,l])=>_c2Chip(T,l,f===k,()=>setF(k),'c2-wine-filter-'+k))}
        <span style={{flex:1}}/><span style={{fontSize:13,color:T.mid,fontFamily:C.P}}>{shown.length} of {rows.length}</span></div>
      <_C2Card title="The list" right="tap a wine for its card" testid="c2-list"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Wine</th><th style={{...th,textAlign:'right'}}>Glass</th><th style={{...th,textAlign:'right'}}>Bottle</th><th style={th}>Drinking window</th><th style={{...th,textAlign:'right'}}>Sold · 28 nights</th><th style={th}>Who can sell it</th></tr></thead>
        <tbody>{secs.map(sec=><React.Fragment key={sec}><tr><td colSpan={6} style={{padding:'16px 0 4px',fontSize:12,letterSpacing:'0.09em',textTransform:'uppercase',fontWeight:500,color:acc,fontFamily:C.P}}>{sec}</td></tr>
          {shown.filter(x=>(x.w.section||'Wines')===sec).map(x=><tr key={x.w.id} data-testid="c2-list-row" onClick={()=>open({view:'wine',id:x.w.id})} style={{cursor:'pointer'}}>
            <td style={td}><div style={{fontWeight:500}}>{TeamData.short(x.w)} {fresh.has(x.w.id)&&_c2Pill('New','#9CC9F5')}</div><div style={{fontSize:12,color:T.mid}}>{[x.w.vintage||'NV',[x.w.region,x.w.country].filter(Boolean).join(', ')].join(' · ')}</div></td>
            <td style={num}>{x.w.glass||<span style={{color:T.mid}}>—</span>}</td><td style={num}>{x.w.bottle||<span style={{color:T.mid}}>—</span>}</td>
            <td style={td}>{x.win?_c2Pill(x.win.word,_C2_WIN[x.win.word]||_C2_TONE.mut):<span style={{color:T.mid}}>—</span>}</td>
            <td style={num}><div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8}}><div style={{width:60,height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}><div style={{height:'100%',width:`${x.s?Math.round(100*x.s.qty/top):0}%`,background:'rgba(255,255,255,0.7)',borderRadius:3}}/></div><span style={{width:34}}>{x.s?x.s.qty:0}</span></div></td>
            <td style={td}>{x.kb.of?<_C2Knowers people={x.kb.people} of={x.kb.of} size={22}/>:<span style={{color:T.mid}}>—</span>}</td></tr>)}</React.Fragment>)}</tbody></table></div>
        {!shown.length&&<div style={{fontSize:14,color:T.mid,fontFamily:C.P,padding:'12px 0'}}>No wine matches that.</div>}</_C2Card>
    </_C2Split>
    <_C2Manage k="c2-manage-wines" title="Edit the list, see its questions and the reviews"><_CWines open={open} goUpload={()=>setSection('upload')}/></_C2Manage>
  </div>; }

/* ── Menu ── */
function _C2Menu({open,setSection,me,two}){ const T=useTheme(), acc=_c2Acc(T), [,bump]=React.useReducer(x=>x+1,0), ps=TeamReport.pairings(), paired=ps.filter(x=>x.first), all=paired.filter(x=>x.of&&x.people.length>=Math.ceil(x.of/2)).length, sold=paired.filter(x=>x.sold!=null);
  const al=TeamData.trainsAllergens(), described=TeamData.dishes().filter(x=>TeamData.dishCard(x.id)).length, secs=[...new Set(ps.map(x=>x.dish.section||'Menu'))];
  const th={fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',color:T.mid,fontWeight:500,fontFamily:C.P,textAlign:'left',padding:'4px 10px 8px 0',whiteSpace:'nowrap'}, td={padding:'10px 10px 10px 0',borderTop:'1px solid rgba(255,255,255,0.065)',fontSize:14,fontFamily:C.P,color:T.ink,verticalAlign:'middle'};
  const bestSold=[...sold].sort((a,b)=>b.sold*b.perWeek-a.sold*a.perWeek).slice(0,3);
  return <div data-testid="console-menu">
    <_C2Head hi="Menu" sub={`${ps.length} dishes · ${paired.length} paired from your list`} section="menu" actions={<_C2Btn primary onClick={()=>setSection('upload')}>Upload a new menu</_C2Btn>}/>
    <_C2Split two={two} left={<>
      <_C2Card feat title="Selling the pairing" right={sold.length?<_CDemoTag/>:null} testid="c2-pairing-panel">
        {sold.length>0&&<div style={{display:'flex',gap:24,margin:'2px 0 14px'}}><div><div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Ordered with the wine we suggest</div><div style={{fontSize:30,fontWeight:600,color:T.ink,fontFamily:C.P,lineHeight:1.2}}>{Math.round(100*sold.reduce((a,x)=>a+x.sold,0)/sold.length)}%</div></div></div>}
        <_C2Meter label="Pairings the team can offer" val={all} of={paired.length} col={all===paired.length?_C2_TONE.good:_C2_TONE.note} note={all<paired.length?`${paired.length-all} dishes most of the team would have to ask about`:'Every dish, by at least half the team'}/>
        <_C2Meter label="Dishes with a line to describe them" val={described} of={ps.length} col={described===ps.length?_C2_TONE.good:_C2_TONE.note}/>
        {bestSold.length>0&&<div style={{paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.1)'}}>{_c2Lab(T,'Best pairings sold this week')}{bestSold.map((x,i)=><_C2Row key={x.dish.id} first={i===0} onClick={()=>open({view:'dish',id:x.dish.id})}><div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>{x.dish.name.split(',')[0]} · {TeamData.nick(x.first)}</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>{TeamData.byGlass(x.first)?'by the glass':'by the bottle'}</div></div><span style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>{Math.round(x.sold*x.perWeek)}</span></_C2Row>)}</div>}
      </_C2Card>
      <_C2Card title="What this restaurant trains" testid="c2-trains">
        <_C2Row first><div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>Wine pairings and dish descriptions</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P}}>Every dish with its wine, by the glass and by the bottle. Always on.</div></div></_C2Row>
        <_C2Row><div style={{flex:1}}><div style={{fontSize:14,fontWeight:500,color:T.ink,fontFamily:C.P}}>Allergens</div><div style={{fontSize:12,color:T.mid,fontFamily:C.P,lineHeight:1.4}}>{al?'On: the kitchen confirms each dish, then every role holds it at 100%.':'Off: managed in your kitchen\'s own system. Nobody is asked about one here.'}</div></div>
          <div role="switch" aria-checked={al} data-testid="c2-allergens-switch" onClick={()=>{ TeamData.setSetting('allergens',!al); bump(); }} style={{width:38,height:22,borderRadius:11,background:al?acc:'rgba(255,255,255,0.16)',position:'relative',cursor:'pointer',flexShrink:0}}><div style={{position:'absolute',top:2,left:al?18:2,width:18,height:18,borderRadius:9,background:al?_c2Ink():'#fff',transition:'left .15s'}}/></div></_C2Row>
      </_C2Card></>}>
      <_C2Card title="Every dish and its wine" right="tap a dish for its card" testid="c2-dishes"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Dish</th><th style={th}>Pour with it</th><th style={th}>Who can offer it</th>{sold.length>0&&<th style={th}>Ordered with that wine</th>}{al&&<th style={th}>Allergens</th>}</tr></thead>
        <tbody>{secs.map(sec=><React.Fragment key={sec}><tr><td colSpan={5} style={{padding:'16px 0 4px',fontSize:12,letterSpacing:'0.09em',textTransform:'uppercase',fontWeight:500,color:acc,fontFamily:C.P}}>{sec}</td></tr>
          {ps.filter(x=>(x.dish.section||'Menu')===sec).map(x=>{ const a=al?TeamData.allergensOf(x.dish.id):null; return <tr key={x.dish.id} data-testid="c2-dish-row" onClick={()=>open({view:'dish',id:x.dish.id})} style={{cursor:'pointer'}}>
            <td style={td}><div style={{fontWeight:500}}>{x.dish.name}</div><div style={{fontSize:12,color:T.mid}}>{x.dish.price}</div></td>
            <td style={td}>{x.first?<><div style={{fontWeight:500}}>{TeamData.short(x.first)}</div><div style={{fontSize:12,color:T.mid}}>{x.glass&&x.glass.id!==x.first.id?`by the glass: ${TeamData.nick(x.glass)}`:TeamData.byGlass(x.first)?'by the glass':'by the bottle'}</div></>:<span style={{color:T.mid}}>Not paired yet</span>}</td>
            <td style={td}>{x.first&&x.of?<_C2Knowers people={x.people} of={x.of} size={22}/>:<span style={{color:T.mid}}>—</span>}</td>
            {sold.length>0&&<td style={td}>{x.sold!=null?<div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:90,height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}><div style={{height:'100%',width:`${Math.round(100*x.sold)}%`,borderRadius:3,background:x.sold>=0.45?_C2_TONE.good:x.sold>=0.25?_C2_TONE.note:_C2_TONE.bad}}/></div><span style={{fontWeight:500}}>{Math.round(100*x.sold)}%</span></div>:<span style={{color:T.mid}}>—</span>}</td>}
            {al&&<td style={td}>{a?_c2Pill(a.length?`${a.length} confirmed`:'None',_C2_TONE.good):_c2Pill('To confirm',_C2_TONE.note)}</td>}</tr>; })}</React.Fragment>)}</tbody></table></div></_C2Card>
    </_C2Split>
    <_C2Manage k="c2-manage-menu" title={al?'Edit dishes and confirm allergens':'Edit dishes'}><_CMenu open={open} goUpload={()=>setSection('upload')} me={me}/></_C2Manage>
  </div>; }

/* ── Team ── */
function _C2Team({open,setSection,me,two,refresh}){ const T=useTheme(), acc=_c2Acc(T), [,bump]=React.useReducer(x=>x+1,0), [pushed,setPushed]=React.useState({});
  const rows=TeamReport.teamRows(), o=TeamReport.overview(), up=TeamReport.upside(), tw=TeamSales.has()?TeamReport.trainingWorth(28,1):null, f=x=>x.person.name.split(' ')[0];
  const low=rows.find(x=>x.r.state!=='ready'), behind=rows.filter(x=>x.r.behind>0), todo=rows.filter(x=>x.plan&&x.plan.items.length), areas=[...new Set(rows.flatMap(x=>x.areas.map(a=>a.k)))], lab=k=>TeamLearn.PART_LABEL[k];
  const push=x=>{ if(TeamReport.pushPlan(x.person.id)) setPushed(d=>({...d,[x.person.id]:x.plan})); };
  const th={fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',color:T.mid,fontWeight:500,fontFamily:C.P,textAlign:'left',padding:'4px 12px 8px 0',whiteSpace:'nowrap'}, td={padding:'12px 12px 12px 0',borderTop:'1px solid rgba(255,255,255,0.065)',fontSize:14,fontFamily:C.P,color:T.ink,verticalAlign:'top'};
  const ex=rows.find(x=>x.r.state!=='ready'&&x.areas.length>1)||rows[0];
  return <div data-testid="c2-team">
    <_C2Head hi="Team" sub={`${rows.length} people · ready means every area at its minimum`} section="team" actions={todo.length>0&&<_C2Btn primary testid="c2-push-all" onClick={()=>todo.forEach(push)}>Push everyone's next step</_C2Btn>}/>
    <div style={{..._c2Grid(5,two),marginBottom:16}}>
      <_C2Kpi testid="c2-kpi-ready" label="Ready for service" value={o.ready} unit={`of ${o.total}`} note={`${o.slipping} slipping · ${o.total-o.ready-o.slipping} not there yet`}/>
      <_C2Kpi label="Training finished" value={`${o.avg}%`} note="the team's average against each role's minimum"/>
      {tw&&tw.rows[0]?<_C2Kpi testid="c2-kpi-trainnext" label="Train next" value={`+${_cMoney(tw.rows[0].extra)}`} unit="a week" note={`${TeamData.nick(tw.rows[0].wine)}: train ${tw.rows[0].missing.map(p=>p.name.split(' ')[0]).join(' and ')} →`} onClick={()=>open({view:'plan',kind:'train',id:tw.rows[0].wine.id})}/>
        :<_C2Kpi label="Train next" value={todo.length} unit={todo.length===1?'step ready':'steps ready'} note="one next step for each person, below"/>}
      {low?<_C2Kpi testid="c2-kpi-help" label="Needs a plan" value={f(low)} unit={`${low.r.pct}%`} note={`${behind.some(x=>x.person.id===low.person.id)?`${low.r.behind} days behind. `:''}See how to get ${f(low)} there →`} onClick={()=>open({view:'plan',kind:'person',id:low.person.id})}/>
        :<_C2Kpi label="Needs a plan" value="Nobody" note="everyone is ready for service"/>}
      <_C2Kpi label="Still on the table" value={up?_cMoney(up.total):'—'} unit={up?'a week':''} note="if every server were trained on your top sellers"/>
    </div>
    <_C2Card feat title="Each person · where they stand, what they sell, what to push next" testid="c2-team-table"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Person</th><th style={th}>Readiness</th>{areas.map(k=><th key={k} style={th}>{lab(k)}</th>)}<th style={{...th,textAlign:'right'}}>Wine sold</th><th style={{...th,paddingLeft:12}}>Next step</th></tr></thead>
      <tbody>{rows.map(x=>{ const st=_tState[x.r.state], pl=x.plan, done=pushed[x.person.id], show=done||pl; return <tr key={x.person.id} data-testid="c2-team-row">
        <td style={td}><div role="button" onClick={()=>open({view:'person',id:x.person.id})} style={{display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}><TeamFace person={x.person} size={34}/><div><div style={{fontWeight:500,whiteSpace:'nowrap'}}>{x.person.name}</div><div style={{fontSize:12,color:T.mid}}>{TeamLearn.ROLES[x.person.role].label}</div></div></div></td>
        <td style={td}><div style={{display:'flex',alignItems:'center',gap:8}}><div style={{width:84,height:6,borderRadius:3,background:'rgba(255,255,255,0.08)',overflow:'hidden'}}><div style={{height:'100%',width:`${x.r.pct}%`,background:st.col,borderRadius:3}}/></div><span style={{fontWeight:500}}>{x.r.pct}%</span></div><div style={{fontSize:12,color:st.col,marginTop:3,whiteSpace:'nowrap'}}>{x.r.state==='ready'?'Ready for service':x.r.behind?`${x.r.behind} days behind plan`:st.label}</div></td>
        {areas.map(k=>{ const a=x.areas.find(y=>y.k===k); return <td key={k} style={td}>{a?<><div style={{whiteSpace:'nowrap'}}><span style={{fontWeight:500}}>{a.known}</span><span style={{color:T.mid}}> of {a.total}</span></div><div style={{fontSize:12,color:a.met?_C2_TONE.good:_C2_TONE.note,whiteSpace:'nowrap'}}>{a.met?`✓ needs ${a.needs}`:`needs ${a.needs}: ${a.needs-a.known} to go`}</div></>:<span style={{color:T.mid}}>—</span>}</td>; })}
        <td style={{...td,textAlign:'right'}}>{x.sales?<><div style={{fontWeight:500,whiteSpace:'nowrap'}}>{_cMoney(x.sales.perWeek)}<span style={{fontSize:12,fontWeight:400,color:T.mid}}> a week</span></div><div style={{fontSize:12,color:T.mid,whiteSpace:'nowrap'}}>{_cMoney(x.sales.perShift)} a shift{x.sales.peers>1&&x.sales.roleAvg?<span style={{color:x.sales.perShift>=x.sales.roleAvg?_C2_TONE.good:_C2_TONE.bad}}> · {x.sales.perShift>=x.sales.roleAvg?'above':'below'} {_cMoney(x.sales.roleAvg)} avg</span>:null}</div></>:<span style={{color:T.mid}}>—</span>}</td>
        <td style={{...td,paddingLeft:12,minWidth:300}}>{show&&show.items.length?<div data-testid="c2-next">
            <div style={{lineHeight:1.45}}><span style={{fontWeight:500}}>{show.stretch?'Stretch':'Next'}: {show.items.length} {show.label.toLowerCase()}</span><span style={{color:T.mid}}> · {show.items.map(y=>y.name).join(', ')}</span></div>
            <div style={{fontSize:12,color:T.mid,lineHeight:1.45,marginTop:2}}>{show.label} {show.known} → {show.to} of {show.total}{show.pctAfter>show.pct?` · readiness ${show.pct}% → about ${show.pctAfter}%`:''} · about {show.drills} drill{show.drills===1?'':'s'}{show.extra>=1?<span style={{color:acc}}> · worth about +{_cMoney(show.extra)} a week</span>:null}</div>
            <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}><div role="button" data-testid="c2-push" onClick={()=>!done&&push(x)} style={{padding:'6px 12px',borderRadius:10,fontSize:13,fontWeight:500,cursor:done?'default':'pointer',whiteSpace:'nowrap',background:done?'transparent':acc,color:done?_C2_TONE.good:_c2Ink(),border:done?`1px solid ${_alpha(_C2_TONE.good,0.4)}`:'none'}}>{done?`✓ First in ${f(x)}'s drills`:`Push to ${f(x)}`}</div>
              <div role="button" data-testid="c2-see-plan" onClick={()=>open({view:'plan',kind:'person',id:x.person.id})} style={{padding:'6px 12px',borderRadius:10,fontSize:13,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',border:'1px solid rgba(255,255,255,0.17)',color:T.ink2}}>Full plan</div></div></div>
          :<span style={{color:_C2_TONE.good}}>Trained on everything the role sells.</span>}</td></tr>; })}</tbody></table></div></_C2Card>
    <div style={{..._c2Grid(2,two),marginTop:16,alignItems:'start'}}>
      <_C2Card title="How readiness is worked out" testid="c2-how">
        <div style={{fontSize:14,color:T.ink,fontFamily:C.P,lineHeight:1.55}}>Someone is <span style={{fontWeight:500,color:_C2_TONE.good}}>ready for service</span> when every area their role is trained on is at its minimum. That is 100%: there's no lower pass mark.</div>
        <div style={{fontSize:14,color:T.ink2,fontFamily:C.P,lineHeight:1.55,marginTop:8}}>The percentage is how far along they are: each area counts equally, as its progress towards its own minimum, and an area already at its minimum counts in full.</div>
        {ex&&<div data-testid="c2-how-example" style={{marginTop:14,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.1)'}}>{_c2Lab(T,`${f(ex)}, for example`)}
          {ex.areas.map(a=><div key={a.k} style={{display:'flex',alignItems:'center',gap:10,marginTop:8,fontFamily:C.P}}><div style={{width:120,fontSize:13,color:T.ink,flexShrink:0}}>{a.label}</div><div style={{flex:1,position:'relative',height:8,borderRadius:4,background:'rgba(255,255,255,0.08)'}}><div style={{position:'absolute',left:0,top:0,bottom:0,width:`${a.total?Math.round(100*a.known/a.total):0}%`,borderRadius:4,background:a.met?_C2_TONE.good:_C2_TONE.note}}/><div title="minimum" style={{position:'absolute',top:-3,bottom:-3,left:`${a.min}%`,width:2,background:T.ink}}/></div><div style={{width:170,fontSize:12,color:a.met?_C2_TONE.good:_C2_TONE.note,flexShrink:0,textAlign:'right'}}>{a.known} of {a.total} · minimum {a.needs} ({a.min}%)</div></div>)}
          <div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.5,marginTop:10}}>The white line is the minimum. {ex.areas.filter(a=>!a.met).length?`${f(ex)} is short in ${ex.areas.filter(a=>!a.met).map(a=>a.label.toLowerCase()).join(' and ')}, so reads ${ex.r.pct}% and isn't ready yet.`:`Every area is past its line, so ${f(ex)} is ready.`}</div></div>}
      </_C2Card>
      <_C2Card title="The minimum for each role" right="change them under Manage, below" testid="c2-mins"><div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={th}>Role</th>{areas.map(k=><th key={k} style={{...th,textAlign:'right'}}>{lab(k)}</th>)}<th style={{...th,textAlign:'right'}}>Ready at</th></tr></thead>
        <tbody>{[...new Set(rows.map(x=>x.person.role))].map(role=>{ const need=TeamLearn.need(role); return <tr key={role}><td style={{...td,verticalAlign:'middle'}}><span style={{fontWeight:500}}>{TeamLearn.ROLES[role].label}</span></td>{areas.map(k=><td key={k} style={{...td,textAlign:'right',verticalAlign:'middle'}}>{need[k]?`${Math.round(100*need[k])}%`:<span style={{color:T.mid}}>—</span>}</td>)}<td style={{...td,textAlign:'right',verticalAlign:'middle',color:_C2_TONE.good,fontWeight:500,whiteSpace:'nowrap'}}>all of them</td></tr>; })}</tbody></table></div>
        <div style={{fontSize:13,color:T.mid,fontFamily:C.P,lineHeight:1.5,marginTop:10}}>Each figure is the share of that area someone must be trained on. A server needs more of the wines by the glass than of the bottles, because the glass list is what they're asked about most.</div></_C2Card>
    </div>
    <_C2Manage k="c2-manage-team" title="Manage: add or remove people, set minimums and training depth"><_CTeam open={open} refresh={refresh}/></_C2Manage>
  </div>; }

/* ── The shell ── */
function TeamConsole2({me,onPhone,refresh,section,setSection,tour}){ const T=useTheme(), acc=_c2Acc(T), [ref,w]=_c2Width(), two=w>=1040, [,bump]=React.useReducer(x=>x+1,0);
  const [panel,setPanel]=React.useState(null), [touring,setTouring]=React.useState(()=>!!tour&&TeamTour.due(me&&me.id));
  const go=v=>{ if(v.tab){ setSection(v.tab==='today'?'dash':v.tab); setPanel(null); return; } if(v.view==='drill'){ onPhone(v); return; } setPanel(v); };
  React.useEffect(()=>{ if(TeamDemo.seedTonight()) bump(); },[]);
  const pageRef=React.useRef(null);
  // A figure on the dashboard opens the card it's a summary of: the section, then that card brought into view and lit.
  const jump=(k,tid)=>{ setSection(k); setPanel(null); setTimeout(()=>{ const el=pageRef.current&&pageRef.current.querySelector(`[data-testid="${tid}"]`); if(!el) return; el.scrollIntoView({block:'center'}); el.setAttribute('data-lit','1'); el.style.boxShadow=`0 0 0 2px ${acc}`; setTimeout(()=>{ el.style.boxShadow=''; el.removeAttribute('data-lit'); },1600); },90); };
  React.useLayoutEffect(()=>{ if(pageRef.current) pageRef.current.scrollTop=0; },[section]);
  const page=section==='team'?<_C2Team open={go} setSection={setSection} me={me} two={two} refresh={()=>{ refresh&&refresh(); bump(); }}/>:section==='wines'?<_C2Wines open={go} setSection={setSection} two={two}/>:section==='cocktails'?<_CCocktails open={go}/>:section==='menu'?<_C2Menu open={go} setSection={setSection} me={me} two={two}/>
    :section==='upload'?<_CUpload refresh={refresh}/>:section==='pos'?<_CPos open={go}/>:section==='admin'?<_CAdmin refresh={refresh}/>:section==='sales'?<_C2Sales open={go} setSection={setSection} two={two}/>:<_C2Dash open={go} setSection={setSection} me={me} two={two} jump={jump}/>;
  const venue=TeamData.get().venue;
  return <div data-testid="team-console" data-look="preview" style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:'#000',color:T.ink}}>
    <div data-testid="c2-top" style={{display:'flex',alignItems:'center',gap:22,padding:'10px 28px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
      <div data-testid="console-venue" style={{flexShrink:0,marginRight:6}}>{TeamData.brand()?<TeamVenueLogo height={34}/>:<div style={{fontSize:18,fontWeight:600,fontFamily:C.P}}>{venue.name||'Your restaurant'}</div>}</div>
      <div style={{display:'flex',gap:22,overflowX:'auto',flex:1,minWidth:0}}>{CONSOLE_SECTIONS.filter(s=>!s.only||s.only()).map(s=>{ const on=section===s.k; return <div key={s.k} role="button" data-testid={'console-nav-'+s.k} aria-current={on?'page':undefined} onClick={()=>{ setSection(s.k); setPanel(null); }} style={{padding:'10px 0',fontSize:14,fontFamily:C.P,fontWeight:on?500:400,color:on?T.ink:T.mid,boxShadow:on?`inset 0 -2px 0 ${acc}`:'none',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>{s.label}</div>; })}</div>
      <div role="button" data-testid="c2-classic" onClick={()=>TeamData.setConsoleLook('classic')} style={{fontSize:13,color:T.mid,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap',textDecoration:'underline',textUnderlineOffset:3}}>Classic view</div>
      <div role="button" data-testid="console-to-phone" onClick={()=>onPhone({tab:'today'})} style={{fontSize:13,color:T.mid,fontFamily:C.P,cursor:'pointer',whiteSpace:'nowrap',textDecoration:'underline',textUnderlineOffset:3}}>Phone view</div>
      <div style={{display:'flex',alignItems:'center',gap:8,border:'1px solid rgba(255,255,255,0.12)',borderRadius:999,padding:'4px 12px 4px 4px',flexShrink:0}}><TeamFace person={me} size={28}/><span style={{fontSize:14,color:T.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>{me.name.split(' ')[0]} · {TeamLearn.ROLES[me.role].label}</span></div>
    </div>
    <div ref={pageRef} data-scroll style={{flex:1,minHeight:0,overflowY:'auto',background:`radial-gradient(1000px 380px at 30% -8%, ${_alpha(acc,0.11)}, transparent 70%)`}}>
      <div ref={ref} style={{maxWidth:1400,margin:'0 auto',padding:'26px 28px 60px'}}><TeamJobChip onOpen={()=>setSection('upload')}/><ScreenErrorBoundary>{page}</ScreenErrorBoundary>
        <div style={{display:'flex',alignItems:'center',gap:14,marginTop:28,fontSize:12,color:T.mid,fontFamily:C.P}}><span role="button" data-testid="console-tour-start" onClick={()=>{ setPanel(null); setTouring(true); }} style={{cursor:'pointer',textDecoration:'underline',textUnderlineOffset:3}}>Take the tour</span>{TeamData.brand()&&<span data-testid="console-powered" style={{display:'flex',alignItems:'center',gap:8}}>Powered by <TeamLogo size={14}/></span>}<span>A preview of the console's new look.</span></div></div>
    </div>
    {panel&&panel.view==='tonight'&&<><div data-testid="console-scrim" onClick={()=>{ setPanel(null); bump(); }} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)'}}/>
      <div data-testid="console-panel" data-scroll style={{position:'absolute',top:0,right:0,bottom:0,width:'min(680px, 86%)',background:T.card,borderLeft:`1px solid ${T.line}`,overflowY:'auto',padding:'16px 22px 40px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}><div style={{fontSize:20,fontWeight:600,fontFamily:C.P}}>Tonight</div><div role="button" aria-label="Close" data-testid="console-panel-close" onClick={()=>{ setPanel(null); bump(); }} style={{width:32,height:32,borderRadius:16,border:`1px solid ${T.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:16}}>×</div></div>
        <div data-testid="dash-tonight"><_CTonight tn={TeamData.tonight()} bump={bump} me={me}/></div></div></>}
    {panel&&panel.view==='plan'&&<_C2Plan key={panel.kind+':'+panel.id} panel={panel} open={go} close={()=>{ setPanel(null); bump(); }}/>}
    {panel&&panel.view!=='tonight'&&panel.view!=='plan'&&<_CPanel key={panel.view+':'+panel.id} panel={panel} me={me} open={go} close={()=>setPanel(null)} narrow={w<700}/>}
    {touring&&<_CTour narrow setSection={k=>{ setSection(k); setPanel(null); }} onEnd={()=>{ TeamTour.done(me&&me.id); setTouring(false); }}/>}
  </div>; }
Object.assign(window,{TeamConsole2});
