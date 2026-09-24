/* Vinterest PWA — Taste Profile, Restaurant, Learn screens */

function TasteProfileScreen({nav,back,showPro}){
  const [tab,setTab]=React.useState(0);
  const [genScripts,setGenScripts]=React.useState({});
  const [scriptLength,setScriptLength]=React.useState(localStorage.getItem('vinterest_script_length')||'long');
  const [generating,setGenerating]=React.useState(null);
  const [copied,setCopied]=React.useState(false);


  const allWines=React.useMemo(()=>WineHistory.getAll(),[]);
  const profile=React.useMemo(()=>WineHistory.getProfile(),[]);

  function winesOfType(typeKey){
    return allWines.filter(w=>(w.type||'').toLowerCase().replace('é','e')===typeKey);
  }
  function deriveTagsFromWines(wines,defaults){
    const counts={};
    wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{counts[t]=(counts[t]||0)+1;}));
    const derived=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8).map(e=>e[0]);
    return derived.length>=3?derived:defaults;
  }

  const cats=[
    {col:'#8B1A2F',label:'Reds',      typeKey:'red',
     defaultTags:['Full Body','Earthy','Dark Fruit','High Tannins','Dry','Cedar'],
     pct:profile.total?Math.round(profile.redPct*100):0},
    {col:'#B8963E',label:'Whites',    typeKey:'white',
     defaultTags:['Crisp','Mineral','Citrus','Dry','Light Body','Herbaceous'],
     pct:profile.total?Math.round(profile.whitePct*100):0},
    {col:'#C47A8A',label:'Rosé',      typeKey:'rose',
     defaultTags:['Bone Dry','Delicate','Red Fruit','Light Body','Crisp'],
     pct:profile.total?Math.round(profile.rosePct*100):0},
    {col:'#5E8FA8',label:'Sparkling', typeKey:'sparkling',
     defaultTags:['Brut','Brioche','Citrus','Fine Bubbles','Toasty'],
     pct:profile.total?Math.round(profile.sparklingPct*100):0},
  ];

  const c=cats[tab];
  const tabWines=winesOfType(c.typeKey);
  const topWines=tabWines.slice(0,3);
  const displayTags=deriveTagsFromWines(tabWines,c.defaultTags);
  const displayScript=genScripts[c.typeKey]||null;
  const isGenerating=generating===c.typeKey;

  // Sommelier script — the same shared script Home and WineDNA show (SommelierScript).
  React.useEffect(()=>{
    if(!tabWines.length) return;
    const typeKey=c.typeKey;
    setGenerating(typeKey);
    SommelierScript.get(scriptLength,typeKey,c.label,tabWines,text=>{
      setGenerating(g=>g===typeKey?null:g);
      if(text) setGenScripts(s=>({...s,[typeKey]:text}));
    });
  },[tab,allWines.length,scriptLength]);

  if(allWines.length===0) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
      <div style={{background:C.white,padding:'18px 20px',borderBottom:'1px solid '+C.line,flexShrink:0}}>
        <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>Profile</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:'1px solid '+C.crDim}}>
          <Icon n="wine" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your profile is waiting</div>
          <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and rate bottles to build your personal taste profile. The more you scan, the smarter it gets.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
        <Card style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer',width:'100%'}} onClick={()=>nav('learn')}>
          <span style={{fontSize:24}}>🎓</span>
          <div style={{flex:1,textAlign:'left'}}>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>Take a quiz first</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>Earn XP while you build your collection</div>
          </div>
          <Icon n="chevron" sz={14} col={C.mid}/>
        </Card>
      </div>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Taste Profile</div>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>
            {allWines.length>0?`${allWines.length} wine${allWines.length!==1?'s':''} scanned`:'No wines scanned yet'}
          </div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:'flex',background:C.white,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {cats.map((ct,i)=>(
          <div key={i} onClick={()=>setTab(i)} style={{flex:1,textAlign:'center',padding:'10px 4px',cursor:'pointer',borderBottom:i===tab?`2px solid ${ct.col}`:'2px solid transparent',marginBottom:-1}}>
            <div style={{width:8,height:8,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
            <div style={{fontSize:15,fontWeight:i===tab?700:400,color:i===tab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{ct.pct>0?`${ct.pct}%`:'—'}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Sommelier script card */}
        <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}30`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <Icon n="message" sz={15} col={c.col}/>
              <span style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
            </div>
            {tabWines.length>0&&!isGenerating&&(
              <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:6,padding:'3px 4px',border:`1px solid ${C.line}`}}>
                {['short','long'].map(len=>(
                  <div key={len} onClick={()=>{setScriptLength(len);localStorage.setItem('vinterest_script_length',len);}} style={{padding:'4px 8px',borderRadius:4,background:scriptLength===len?C.cr:'transparent',cursor:'pointer'}}>
                    <span style={{fontSize:13,fontWeight:600,color:scriptLength===len?'#fff':C.mid,fontFamily:C.P}}>{len.charAt(0).toUpperCase()+len.slice(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {tabWines.length===0?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>
                Scan and rate some {c.label.toLowerCase()} to generate your personalised sommelier script.
              </div>
              <Btn primary small onClick={()=>nav('camera')} style={{background:c.col,boxShadow:`0 3px 12px ${c.col}40`}}>Scan a Bottle</Btn>
            </div>
          ):isGenerating?(
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 0 10px'}}>
              <div style={{width:18,height:18,borderRadius:9,border:'2px solid rgba(0,0,0,0.1)',borderTopColor:c.col,animation:'vspin 0.8s linear infinite',flexShrink:0}}/>
              <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing your personalised script…</span>
            </div>
          ):(
            <>
              <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6,marginBottom:10}}>
                {displayScript||'Generating your script…'}
              </div>
              <div style={{display:'flex',gap:8}}>
                <Btn primary small
                  onClick={()=>{try{navigator.clipboard.writeText((displayScript||'').replace(/"/g,''));setCopied(true);setTimeout(()=>setCopied(false),2000);}catch(e){}}}
                  style={{background:c.col,boxShadow:`0 3px 12px ${c.col}40`}}>{copied?'Copied!':'Copy Script'}</Btn>
                <Btn small onClick={()=>{
                  const key=`vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
                  localStorage.removeItem(key);
                  setGenScripts(s=>{const n={...s};delete n[c.typeKey];return n;});
                }}>Regenerate</Btn>
              </div>
            </>
          )}
        </Card>

        {/* Flavour tags — from actual tasting notes */}
        <Card style={{padding:12}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Flavour Profile</div>
          {tabWines.length===0?(
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Will populate from your scanned wines</div>
          ):(
            <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
              {displayTags.map((t,i)=>(
                <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?c.col+'15':C.offWhite,color:i<3?c.col:C.ink2,fontSize:15,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<3?c.col+'30':C.line}`}}>{t}</span>
              ))}
            </div>
          )}
        </Card>

        {/* Top wines — real data only */}
        <Card style={{padding:0}}>
          <div style={{padding:'12px 14px 8px',fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Your Top {c.label}</div>
          {topWines.length===0?(
            <div style={{padding:'10px 14px 14px',fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Scan some {c.label.toLowerCase()} to see your top bottles here</div>
          ):topWines.map((w,i)=>(
            <div key={i} onClick={()=>{
              sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9}));
              nav('detail');
            }} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
              <div style={{width:32,height:44,borderRadius:6,background:c.col+'12',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={c.col}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                  {w.region&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{w.region}</span>}
                  {w.rating>0&&<><span style={{fontSize:13,color:C.line,fontFamily:C.P}}>·</span><span style={{fontSize:13,fontWeight:700,color:C.amber,fontFamily:C.P}}>{w.rating}/100</span></>}
                </div>
              </div>
              <Icon n="chevron" sz={12} col={C.mid}/>
            </div>
          ))}          
        </Card>

        {/* XP Progress — live from XPSystem */}
        {(()=>{
          const xd=XPSystem.get();
          const lv=XPSystem.getLevel(xd.total);
          const nx=XPSystem.nextLevel(xd.total);
          const pg=XPSystem.levelProgress(xd.total);
          return(
            <Card style={{padding:12}} onClick={()=>nav('learn')}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>{lv.badge} {lv.name}</span>
                <span style={{fontSize:15,color:C.cr,fontWeight:600,fontFamily:C.P}}>{xd.total} XP</span>
              </div>
              <Prog val={pg} h={7} col={lv.color}/>
              {nx&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:4}}>{nx.min-xd.total} XP to {nx.name} — tap to quiz</div>}
            </Card>
          );
        })()}

        {/* Data backup */}
        <Card style={{padding:12}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1,fontSize:15}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');
              a.href=url;
              a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json';
              a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1,fontSize:15}} onClick={()=>{
              const inp=document.createElement('input');
              inp.type='file'; inp.accept='.json,application/json';
              inp.onchange=e=>{
                const file=e.target.files[0]; if(!file) return;
                const reader=new FileReader();
                reader.onload=ev=>{
                  try{
                    const d=JSON.parse(ev.target.result);
                    if(d.wines) WineHistory.save(d.wines);
                    if(d.xp) localStorage.setItem(XPSystem.KEY,JSON.stringify(d.xp));
                    alert('Restored! '+((d.wines||[]).length)+' wines imported.');
                    window.location.reload();
                  }catch(err){ alert('Could not read backup file.'); }
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP to a JSON file on your phone. Import restores from a previous backup.</div>
        </Card>
        {/* App version */}
        <div style={{textAlign:'center',padding:'12px 0 4px',opacity:0.45}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v1.0.38</span>
        </div>
        <div style={{height:8}}/>
      </div>
</div>

      <style>{`@keyframes vspin{to{transform:rotate(360deg)}} .sc-scroll::-webkit-scrollbar{display:none} .sc-scroll{scrollbar-width:none}`}</style>
    </div>
  );
}
/* ── MY WINES: a searchable, filterable list. MyWines (pwa-mywines.js) decides what's shown. ── */
const _MW_TONE={good:C.green,neutral:C.amber,bad:'#B04A3A'};
const _MW_TYPES=[['red','Reds'],['white','Whites'],['rose','Rosé'],['sparkling','Sparkling'],['orange','Orange'],['dessert','Dessert'],['fortified','Fortified']];

/* One wine, as a compact row. Swipe left for Edit and Delete; tap to open. */
function WineRow({w,open,setOpen,onOpen,onScore,onEdit,onDelete}){
  const ref=React.useRef(null), g=React.useRef(null), moved=React.useRef(false);
  const ACTIONS=144;
  const col=(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS[MyWines.type(w)])||C.cr;
  const saved=MyWines.isSaved(w);
  const actionsRef=React.useRef(null);
  // The Edit/Delete buttons are hidden until the row moves, so they never tint the row's edges.
  function place(x,anim){
    const el=ref.current; if(!el) return;
    el.style.transition=anim?'transform .22s ease':'none'; el.style.transform=`translateX(${x}px)`;
    if(actionsRef.current){ if(x<0) actionsRef.current.style.visibility='visible'; else if(!anim) actionsRef.current.style.visibility='hidden'; else setTimeout(()=>{ if(actionsRef.current&&ref.current&&ref.current.style.transform==='translateX(0px)') actionsRef.current.style.visibility='hidden'; },230); }
  }
  React.useEffect(()=>{ place(open?-ACTIONS:0,true); },[open]);
  function down(e){ if(e.button>0||(e.target.closest&&e.target.closest('button,[data-noswipe]'))) return; g.current={id:e.pointerId,x:e.clientX,y:e.clientY,base:open?-ACTIONS:0,drag:false,dx:0}; moved.current=false; }
  function move(e){
    const s=g.current; if(!s||e.pointerId!==s.id) return;
    const dx=e.clientX-s.x, dy=e.clientY-s.y;
    if(!s.drag){ if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){ g.current=null; return; } if(Math.abs(dx)<8) return; s.drag=true; moved.current=true; try{ e.currentTarget.setPointerCapture(e.pointerId); }catch(err){} }
    s.dx=Math.max(-ACTIONS-24,Math.min(0,s.base+dx)); place(s.dx,false);
  }
  function up(e){
    const s=g.current; g.current=null; if(!s||!s.drag) return;
    const shouldOpen=s.dx<-ACTIONS/2.5;
    setOpen(shouldOpen?w:null); place(shouldOpen?-ACTIONS:0,true);
    setTimeout(()=>{ moved.current=false; },0);
  }
  function tap(){ if(moved.current) return; if(open){ setOpen(null); return; } onOpen(w); }
  return <div className="mw-row" style={{position:'relative',overflow:'hidden',borderBottom:`1px solid ${C.line}`}}>
    <div ref={actionsRef} style={{position:'absolute',top:0,bottom:0,right:0,width:ACTIONS,display:'flex',visibility:'hidden'}}>
      <button onClick={()=>{ setOpen(null); onEdit(w); }} aria-label="Edit" style={{flex:1,border:'none',background:'#8A8A8A',color:'#fff',fontFamily:C.P,fontSize:13,fontWeight:700,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,cursor:'pointer'}}><Icon n="edit" sz={18} col="#fff"/>Edit</button>
      <button onClick={()=>{ setOpen(null); onDelete(w); }} aria-label="Delete" style={{flex:1,border:'none',background:'#B04A3A',color:'#fff',fontFamily:C.P,fontSize:13,fontWeight:700,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:4,cursor:'pointer'}}><Icon n="trash" sz={18} col="#fff"/>Delete</button>
    </div>
    <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onClick={tap}
      style={{position:'relative',background:C.white,display:'flex',alignItems:'center',gap:12,padding:'12px 16px 12px 0',cursor:'pointer',userSelect:'none',WebkitUserSelect:'none'}}>
      <div style={{width:4,alignSelf:'stretch',borderRadius:'0 3px 3px 0',background:col,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {saved&&<Icon n="bookmark" sz={14} col={C.mid}/>}
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
        </div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',marginTop:1}}>{MyWines.subline(w)}</div>
      </div>
      {w.times_consumed>1&&<span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>×{w.times_consumed}</span>}
      {w.rating>0
        ?<span style={{minWidth:34,textAlign:'right',fontSize:17,fontWeight:800,color:_MW_TONE[MyWines.scoreTone(w.rating)],fontFamily:C.P,flexShrink:0}}>{w.rating}</span>
        :saved
          ?<span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,flexShrink:0}}>Saved</span>
          :<button onClick={e=>{ e.stopPropagation(); onScore(w); }} style={{flexShrink:0,border:`1px solid ${C.crDim}`,background:C.crSoft,color:C.cr,borderRadius:20,padding:'5px 11px',fontSize:13,fontWeight:700,fontFamily:C.P,cursor:'pointer'}}>Score it</button>}
    </div>
  </div>;
}

function MyWinesScreen({nav,back}){
  // Opened from a type's "See all" (WineDNA, Home): start on that type, sorted by score.
  const [entry]=React.useState(()=>{ try{ const v=JSON.parse(sessionStorage.getItem('vinterest_mywines_view')||'null'); sessionStorage.removeItem('vinterest_mywines_view'); return v||{}; }catch(e){ return {}; } });
  const [type,setType]=React.useState(entry.type||'all');
  const [status,setStatus]=React.useState(null);
  const [sort,setSort]=React.useState(entry.sort||'recent');
  const [q,setQ]=React.useState('');
  const [sortOpen,setSortOpen]=React.useState(false);
  const [openRow,setOpenRow]=React.useState(null);
  const [editing,setEditing]=React.useState(null);
  const [undo,setUndo]=React.useState(null);
  const undoTimer=React.useRef(null);
  React.useEffect(()=>()=>clearTimeout(undoTimer.current),[]);
  const [version,setVersion]=React.useState(0);
  const wines=React.useMemo(()=>WineHistory.getAll(),[version]);
  const counts=React.useMemo(()=>MyWines.counts(wines),[wines]);
  const list=React.useMemo(()=>MyWines.query(wines,{type,status,q,sort}),[wines,type,status,q,sort]);
  const groups=MyWines.groups(list,sort);
  const filtered=type!=='all'||status||q;

  function open(w){ sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,existingRating:w.rating||0})); nav('detail'); }
  function score(w){ sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,source:'history',view:'rate',wine:w})); nav('identified'); }
  function del(w){
    const index=wines.findIndex(x=>x.name===w.name&&String(x.vintage)===String(w.vintage));
    WineHistory.remove(w.name,w.vintage); setVersion(v=>v+1);
    setUndo({w,index}); clearTimeout(undoTimer.current); undoTimer.current=setTimeout(()=>setUndo(null),5000);
  }
  function saveEdit(patch){ WineHistory.update(editing.name,editing.vintage,patch); setEditing(null); setVersion(v=>v+1); }
  const chip=(active,col)=>({flexShrink:0,display:'inline-flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:20,cursor:'pointer',
    border:`1.5px solid ${active?(col||C.ink):C.line}`,background:active?(col||C.ink):C.white,color:active?'#fff':C.ink2,fontSize:14,fontWeight:600,fontFamily:C.P,whiteSpace:'nowrap'});
  const sortLabel=(MyWines.SORTS.find(s=>s.id===sort)||{}).label;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{background:C.white,padding:'14px 16px 10px',flexShrink:0,borderBottom:`1px solid ${C.line}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:19,fontWeight:700,color:C.ink,fontFamily:C.P}}>My Wines</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.35}}>{MyWines.summary(list)}</div>
          </div>
          <div style={{position:'relative',flexShrink:0}}>
            <div onClick={()=>setSortOpen(o=>!o)} role="button" aria-label="Sort" style={{display:'flex',alignItems:'center',gap:6,padding:'7px 11px',borderRadius:10,border:`1px solid ${C.line}`,background:C.offWhite,cursor:'pointer'}}>
              <Icon n="sort" sz={15} col={C.ink2}/><span style={{fontSize:14,fontWeight:600,color:C.ink2,fontFamily:C.P}}>{sortLabel}</span>
            </div>
            {sortOpen&&<div style={{position:'absolute',right:0,top:'calc(100% + 6px)',background:C.white,border:`1px solid ${C.line}`,borderRadius:12,boxShadow:'0 8px 24px rgba(0,0,0,0.12)',padding:4,zIndex:20,minWidth:150}}>
              {MyWines.SORTS.map(s=><div key={s.id} onClick={()=>{ setSort(s.id); setSortOpen(false); }} style={{padding:'10px 12px',borderRadius:8,fontSize:15,fontWeight:sort===s.id?700:500,color:sort===s.id?C.cr:C.ink,fontFamily:C.P,cursor:'pointer',background:sort===s.id?C.crSoft:'transparent'}}>{s.label}</div>)}
            </div>}
          </div>
        </div>
        {wines.length>0&&<>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:12,padding:'9px 12px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
            <Icon n="search" sz={17} col={C.mid}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search wine, producer, grape, region" aria-label="Search your wines"
              style={{flex:1,minWidth:0,border:'none',outline:'none',background:'transparent',fontSize:16,fontFamily:C.P,color:C.ink}}/>
            {q&&<span onClick={()=>setQ('')} role="button" aria-label="Clear search" style={{fontSize:18,lineHeight:1,color:C.mid,cursor:'pointer',padding:'0 2px'}}>×</span>}
          </div>
          <div className="sc-scroll" style={{display:'flex',gap:8,overflowX:'auto',marginTop:10,paddingBottom:2}}>
            <div onClick={()=>setType('all')} style={chip(type==='all')}>All <span style={{opacity:0.7}}>{wines.length}</span></div>
            {_MW_TYPES.filter(([k])=>counts.types[k]).map(([k,l])=>{
              const col=_TYPE_COLORS[k];
              return <div key={k} onClick={()=>setType(type===k?'all':k)} style={chip(type===k,col)}>
                {type!==k&&<span style={{width:8,height:8,borderRadius:4,background:col}}/>}{l} <span style={{opacity:0.7}}>{counts.types[k]}</span></div>;
            })}
            <div style={{width:1,flexShrink:0,background:C.line,margin:'4px 2px'}}/>
            {MyWines.STATUSES.filter(s=>counts.status[s.id]).map(s=>(
              <div key={s.id} onClick={()=>setStatus(status===s.id?null:s.id)} style={chip(status===s.id,C.cr)}>{s.label} <span style={{opacity:0.7}}>{counts.status[s.id]}</span></div>
            ))}
          </div>
        </>}
      </div>

      <div style={{flex:1,overflowY:'auto'}} onScroll={()=>{ if(openRow) setOpenRow(null); if(sortOpen) setSortOpen(false); }}>
        {wines.length===0?(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:40,textAlign:'center',gap:12}}>
            <Icon n="wine" sz={40} col={C.mid}/>
            <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>No wines yet</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Every bottle you scan lands here, with your score.</div>
            <Btn primary onClick={()=>nav('camera')}>Scan a bottle</Btn>
          </div>
        ):list.length===0?(
          <div style={{padding:40,textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>No wines match</div>
            {filtered&&<span onClick={()=>{ setType('all'); setStatus(null); setQ(''); }} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Clear filters</span>}
          </div>
        ):(
          <div style={{paddingBottom:90}}>
            {groups.map(gr=>(
              <div key={gr.label||'all'}>
                {gr.label&&<div style={{position:'sticky',top:0,zIndex:2,background:C.bg,padding:'14px 16px 6px',fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase'}}>{gr.label}</div>}
                <div style={{background:C.white,borderTop:`1px solid ${C.line}`}}>
                  {gr.wines.map(w=><WineRow key={w.name+'|'+w.vintage} w={w} open={openRow===w} setOpen={setOpenRow}
                    onOpen={open} onScore={score} onEdit={setEditing} onDelete={del}/>)}
                </div>
              </div>
            ))}
            {list.length>3&&!filtered&&<div style={{textAlign:'center',fontSize:13,color:C.mid,fontFamily:C.P,padding:'14px 0'}}>Swipe a wine left to edit or delete it.</div>}
          </div>
        )}
      </div>

      {undo&&<div style={{position:'absolute',left:16,right:16,bottom:96,zIndex:30,background:C.ink,color:'#fff',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 8px 24px rgba(0,0,0,0.25)'}}>
        <span style={{flex:1,fontSize:14,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Deleted {undo.w.name}</span>
        <span onClick={()=>{ WineHistory.restore(undo.w,undo.index); setUndo(null); setVersion(v=>v+1); }} role="button" style={{fontSize:14,fontWeight:700,color:'#F2C94C',fontFamily:C.P,cursor:'pointer'}}>Undo</span>
      </div>}
      {editing&&<EditWineSheet wine={editing} onSave={saveEdit} onClose={()=>setEditing(null)}/>}
      <style>{`.mw-row,.mw-row *{touch-action:pan-y}`}</style>
    </div>
  );
}

/* ── RESTAURANT SCREEN ── */
function RestaurantScreen({nav,back}){
  const [step,setStep]=React.useState(0); // 0=entry 1=setup 2=script
  const [budget,setBudget]=React.useState(1);
  const [foods,setFoods]=React.useState([0]);
  const foodItems=['Red Meat','Poultry','Seafood','Pasta','Salad','Cheese','Spicy Food'];
  const toggleFood=i=>setFoods(f=>f.includes(i)?f.filter(x=>x!==i):[...f,i]);

  if(step===2) return <RestaurantScript back={()=>setStep(1)}/>;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={step>0?()=>setStep(s=>s-1):back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>{step===0?'Restaurant Mode':'Your Preferences'}</span>
      </div>

      {step===0&&(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:C.ink,borderRadius:20,padding:'20px',textAlign:'center'}}>
            <Icon n="fork" sz={32} col="rgba(255,255,255,0.5)" style={{margin:'0 auto 10px'}}/>
            <div style={{fontSize:20,fontWeight:700,color:'#fff',fontFamily:C.P}}>Dining Tonight?</div>
            <div style={{fontSize:16,color:'rgba(255,255,255,0.5)',fontFamily:C.P,marginTop:4}}>Get confident wine recommendations tailored to your meal and budget.</div>
          </div>
          {[
            {i:'camera',col:C.cr,t:'Scan Wine List',s:'Take a photo of the menu for instant picks',action:()=>setStep(1)},
            {i:'message',col:'#B06C00',t:'Quick Script',s:'No menu? Get a script to say to the sommelier',action:()=>setStep(1)},
          ].map((a,i)=>(
            <Card key={i} onClick={a.action} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer'}}>
              <div style={{width:44,height:44,borderRadius:11,background:a.col+'12',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={a.i} sz={22} col={a.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>{a.t}</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{a.s}</div>
              </div>
              <Icon n="chevron" sz={14} col={C.mid}/>
            </Card>
          ))}
        </div>
</div>
      )}

      {step===1&&(
        <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Budget per bottle</div>
            <div style={{display:'flex',gap:8}}>
              {['$20–40','$40–70','$70–120','$120+'].map((b,i)=>(
                <div key={i} onClick={()=>setBudget(i)} style={{flex:1,padding:'10px 4px',borderRadius:10,border:`1.5px solid ${i===budget?C.cr:C.line}`,background:i===budget?C.crSoft:'#fff',textAlign:'center',cursor:'pointer'}}>
                  <div style={{fontSize:16,fontWeight:600,color:i===budget?C.cr:C.ink2,fontFamily:C.P}}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>What are you eating?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {foodItems.map((f,i)=>(
                <span key={i} onClick={()=>toggleFood(i)} style={{padding:'6px 12px',borderRadius:20,background:foods.includes(i)?C.cr:'#fff',color:foods.includes(i)?'#fff':C.mid,border:`1px solid ${foods.includes(i)?C.cr:C.line}`,fontSize:16,fontWeight:500,fontFamily:C.P,cursor:'pointer'}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{flex:1}}/>
          <Btn primary full onClick={()=>setStep(2)}>Get Recommendations</Btn>
          <div style={{height:8}}/>
        </div>
</div>
      )}
    </div>
  );
}

function RestaurantScript({back}){
  const copied=React.useRef(false);
  const [c,setC]=React.useState(false);
  const script='"I\'m looking for a full-bodied red in the $40–70 range. I typically enjoy wines with earthy notes and structured tannins — Bordeaux blends are a favourite. I\'m having the steak tonight. What would you recommend?"';
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Script</span>
        <div style={{flex:1}}/>
        <Icon n="share" sz={18} col={C.mid}/>
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{background:C.crSoft,border:`1.5px solid ${C.crDim}`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <Icon n="message" sz={16} col={C.cr}/>
            <span style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P}}>Say This to Your Server</span>
          </div>
          <div style={{fontSize:17,color:C.ink2,fontFamily:C.P,lineHeight:1.6,fontStyle:'italic',marginBottom:10}}>{script}</div>
          <Btn primary small onClick={()=>{try{navigator.clipboard.writeText(script.replace(/"/g,''));setC(true);setTimeout(()=>setC(false),2000)}catch(e){}}}
            style={{width:'100%'}}>{c?'Copied!':'Copy Script'}</Btn>
        </Card>
        <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P}}>Best Matches on This List</div>
        {[{name:'Clos du Val Cabernet',sub:'Napa Valley · $58',score:96,note:'Best match · In your budget'},
          {name:'Barolo Giacomo Conterno',sub:'Piedmont · $65',score:91,note:'Try something new — similar style'},
          {name:'Sancerre Henri Bourgeois',sub:'Loire Valley · $42',score:82,note:'White option · Pairs with seafood'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:4,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:16,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                </div>
              </div>
            </div>
            <div style={{fontSize:15,color:i===0?C.green:C.cr,fontFamily:C.P,marginTop:5,paddingLeft:42,fontWeight:500}}>{w.note}</div>
          </Card>
        ))}
        <div style={{height:8}}/>
      </div>
</div>
    </div>
  );
}

/* ── LEARN SCREEN ── */
// LearnScreen is now QuizHubScreen (defined in pwa-screens-quiz.jsx)
function LearnScreen(props){ return React.createElement(QuizHubScreen, props); }

/* ── WINE LIST RESULTS SCREEN ── */
function WineListScreen({nav,back}){
  const data=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_winelist_result')||'{}'); }
    catch(e){ return {}; }
  },[]);
  const isDemo=data.demo===true;


  // A failed read shows the retry banner and no wines: made-up wines with made-up scores would mislead.
  const wines=(data.wines&&data.wines.length>0)?data.wines:[];
  const listCurrency=data.currency||Regional.current().code||localStorage.getItem('vinterest_currency')||'GBP';
  const typeColors={red:'#8B1A2F',white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8',orange:'#C1652B',dessert:'#8A5A2B',fortified:'#5C2A1E'};
  const colFor=t=>typeColors[(t||'red').toLowerCase().replace('é','e')]||C.cr;
  const currSym=(CURRENCY_LIST.find(c=>c.code===listCurrency)||{}).sym||'';
  // Parse tiered list prices ("GLASS:16 / 1/2LTR:33 / BOTTLE:59") into clean labeled segments.
  // Markup/value badges always compare against the BOTTLE price specifically.
  function parsePriceTiers(priceStr){
    const s=String(priceStr||'');
    const patterns=[{label:'Glass',re:/glass\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i},{label:'1/2 L',re:/(?:1\s*\/\s*2\s*ltr|1\s*\/\s*2\s*litre|half)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i},{label:'Bottle',re:/bottle\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i}];
    const tiers=[];
    patterns.forEach(p=>{const m=s.match(p.re); if(m) tiers.push({label:p.label,value:m[1]});});
    if(!tiers.length){
      const any=s.match(/[0-9]+(?:\.[0-9]+)?/);
      if(any) tiers.push({label:null,value:any[0]});
    }
    return tiers;
  }

  // Real per-wine retail estimates — same source of truth as the Detail screen's Price tab
  // (shared cache key), fetched lazily so the badge is only ever as accurate as that lookup.
  const [retailMap,setRetailMap]=React.useState({});
  React.useEffect(()=>{
    let cancelled=false;
    const curr={sym:{GBP:'£',USD:'$',CAD:'CA$',AUD:'A$',NZD:'NZ$',EUR:'€'}[listCurrency]||listCurrency,label:listCurrency,code:listCurrency};
    (async()=>{
      for(let i=0;i<wines.length;i++){
        if(cancelled) return;
        const w=wines[i];
        if(!w||!w.price) continue;
        try{
          const d=await fetchRetailEstimate(w,curr);
          if(cancelled) return;
          if(d&&d.mid!=null) setRetailMap(m=>({...m,[i]:d.mid}));
        }catch(e){}
      }
    })();
    return ()=>{cancelled=true;};
  },[data.wines]);

  // Value vs. typical retail — parse the printed list price and compare to the fetched retail estimate
  function valueInfo(w,i){
    const est=retailMap[i];
    if(est==null||!w.price) return null;
    const priceStr=String(w.price);
    // Multi-tier lists ("GLASS:16 / 1/2LTR:33 / BOTTLE:59") — pull the bottle price specifically,
    // never concatenate every digit in the string (that produced wildly wrong ratios).
    const bottleMatch=priceStr.match(/bottle\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i);
    const anyNums=priceStr.match(/[0-9]+(?:\.[0-9]+)?/g);
    const listNum=bottleMatch?Number(bottleMatch[1]):(anyNums?Number(anyNums[anyNums.length-1]):NaN);
    if(!listNum||!est) return null;
    const ratio=listNum/est;
    if(ratio<=2) return {label:'Good Value',col:C.green,bg:C.greenBg,ratio};
    if(ratio<=3) return {label:'Fair Markup',col:C.amber,bg:C.amberBg,ratio};
    return {label:'Marked Up',col:'#B04A3A',bg:'#F7E4E0',ratio};
  }

  // TasteMatch, the same engine as the scan result and detail screen. Each list entry carries
  // Claude's rough style estimate and main grape; without enough scored history it's "too early".
  const [matches]=React.useState(()=>{
    const all=WineHistory.getAll(), cache={};
    return wines.map(w=>TasteMatch.assess(TasteMatch.fromListEntry(w),all,cache));
  });

  const [sortMode,setSortMode]=React.useState('list'); // 'list' | 'match'
  const [typeFilter,setTypeFilter]=React.useState(null); // null = all
  const types=['red','white','rosé','sparkling'];

  const indexed=wines.map((w,i)=>({w,i,m:matches[i]}));
  const filtered=typeFilter?indexed.filter(x=>(x.w.type||'red').toLowerCase().replace('é','e')===typeFilter.replace('é','e')):indexed;
  const shown=sortMode==='match'?[...filtered].sort((a,b)=>((b.m&&b.m.pct)??-1)-((a.m&&a.m.pct)??-1)):filtered;
  const toneCol={good:C.green,neutral:C.amber,bad:'#B04A3A'};

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.cr,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col="#fff"/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:19,fontWeight:700,color:'#fff',fontFamily:C.P}}>Wine List Results</div>
          <div style={{fontSize:15,color:'rgba(255,255,255,0.65)',fontFamily:C.P}}>{wines.length} wines · prices in {listCurrency} · match scores included</div>
        </div>
        <div onClick={()=>nav('camera')} style={{padding:'6px 14px',borderRadius:20,background:'rgba(255,255,255,0.18)',cursor:'pointer'}}>
          <span style={{fontSize:16,fontWeight:600,color:'#fff',fontFamily:C.P}}>Rescan</span>
        </div>
      </div>

      {isDemo&&(
        <div style={{background:'#FFF3CD',borderBottom:'1px solid #FFE082',padding:'10px 16px',display:'flex',alignItems:'flex-start',gap:10,flexShrink:0}}>
          <span style={{fontSize:19,flexShrink:0}}>⚠️</span>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:600,color:'#7A5200',fontFamily:C.P}}>List not detected — ensure the full page is in frame</div>
            <div onClick={()=>nav('camera')} style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,padding:'6px 14px',borderRadius:20,background:'#8B1A2F',cursor:'pointer'}}>
              <Icon n="camera" sz={12} col="#fff"/>
              <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P}}>Try Again</span>
            </div>
          </div>
        </div>
      )}

      {/* Sort + filter controls */}
      <div style={{padding:'10px 16px 0',display:'flex',flexDirection:'column',gap:8,flexShrink:0}}>
        <div style={{display:'flex',gap:6}}>
          {[{k:'list',l:'List Order'},{k:'match',l:'Match Rate'}].map(o=>(
            <div key={o.k} onClick={()=>setSortMode(o.k)} style={{flex:1,textAlign:'center',padding:'8px 6px',borderRadius:10,border:`1.5px solid ${sortMode===o.k?C.cr:C.line}`,background:sortMode===o.k?C.cr:'transparent',cursor:'pointer'}}>
              <span style={{fontSize:15,fontWeight:600,color:sortMode===o.k?'#fff':C.mid,fontFamily:C.P}}>Sort: {o.l}</span>
            </div>
          ))}
        </div>
        <div style={{display:'flex',gap:6,overflowX:'auto'}}>
          <div onClick={()=>setTypeFilter(null)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`1.5px solid ${!typeFilter?C.ink:C.line}`,background:!typeFilter?C.ink:'transparent',cursor:'pointer'}}>
            <span style={{fontSize:14,fontWeight:600,color:!typeFilter?'#fff':C.mid,fontFamily:C.P,textTransform:'capitalize'}}>All Types</span>
          </div>
          {types.map(t=>{
            const active=typeFilter===t;
            const col=colFor(t);
            return(
              <div key={t} onClick={()=>setTypeFilter(active?null:t)} style={{flexShrink:0,padding:'6px 12px',borderRadius:20,border:`1.5px solid ${active?col:C.line}`,background:active?col:'transparent',cursor:'pointer'}}>
                <span style={{fontSize:14,fontWeight:600,color:active?'#fff':C.mid,fontFamily:C.P,textTransform:'capitalize'}}>{t}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
<div style={{padding:'12px 16px',display:'flex',flexDirection:'column',gap:8}}>
        <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>{sortMode==='match'?'Sorted by Match Rate':'Wine List Order'}</div>
        {shown.map(({w,i,m})=>{
          const col=colFor(w.type);
          const val=valueInfo(w,i);
          const mCol=m&&m.pct!=null?toneCol[m.tone]:C.mid;
          const bottle=(parsePriceTiers(w.price).find(t=>t.label==='Bottle')||parsePriceTiers(w.price)[0]||{}).value;
          return(
            <Card key={i} style={{padding:12,cursor:'pointer'}} onClick={()=>{
              // A wine picked from a list is a look, not a purchase: it's saved as a shelf check.
              const {style,grape,...rest}=TasteMatch.fromListEntry(w);
              sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,source:'list',wine:rest,listPrice:bottle?Number(bottle):null,listCurrency}));
              nav('identified');
            }}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:42,height:56,borderRadius:8,background:col+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${col}25`}}>
                  <Icon n="wine" sz={18} col={col}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:6}}>
                    <div style={{fontSize:17,fontWeight:700,color:C.ink,fontFamily:C.P,lineHeight:1.2,flex:1}}>{w.name}</div>
                    {m&&m.pct!=null
                      ?<div style={{display:'inline-flex',alignItems:'center',padding:'3px 8px',borderRadius:7,background:mCol+'14',flexShrink:0}}>
                        <span style={{fontSize:16,fontWeight:700,color:mCol,fontFamily:C.P}}>{m.pct}%</span>
                      </div>
                      :<span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,flexShrink:0}}>{m&&m.verdict==='early'?'Too early':'No read'}</span>}
                  </div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:2}}>
                    {[w.region,w.country].filter(Boolean).join(' · ')}{w.vintage?` · ${w.vintage}`:''}
                  </div>
                  {m&&m.pct!=null&&<div style={{fontSize:14,fontWeight:600,color:mCol,fontFamily:C.P,marginTop:3}}>{m.label}{m.confidence==='low'?' · rough guess':''}</div>}
                  {m&&m.reasons[0]&&<div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{m.reasons[0].text}</div>}
                  {m&&!m.reasons[0]&&m.style&&<div style={{fontSize:13,color:C.ink2,fontFamily:C.P,marginTop:2,lineHeight:1.4}}>{m.style}</div>}
                  <div style={{display:'flex',gap:5,marginTop:6,alignItems:'center',flexWrap:'wrap'}}>
                    <Pill sm style={{background:col+'12',color:col,border:`1px solid ${col}25`,textTransform:'capitalize'}}>{w.type||'Red'}</Pill>
                    {(w.grape||w.grapes?.[0])&&<Pill sm>{w.grape||w.grapes[0]}</Pill>}
                    {val&&<span style={{fontSize:12,fontWeight:700,color:val.col,background:val.bg,borderRadius:6,padding:'2px 7px'}}>{val.label} · {val.ratio.toFixed(1)}x bottle</span>}
                  </div>
                  {w.price&&(()=>{
                    const tiers=parsePriceTiers(w.price);
                    return(
                      <div style={{display:'flex',alignItems:'baseline',gap:12,marginTop:7,paddingTop:7,borderTop:`1px solid ${C.line}`}}>
                        {tiers.map((t,ti)=>{
                          const isBottle=t.label==='Bottle'||tiers.length===1;
                          return(
                            <div key={ti} style={{display:'flex',alignItems:'baseline',gap:4}}>
                              {t.label&&<span style={{fontSize:11,fontWeight:600,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.04em'}}>{t.label}</span>}
                              <span style={{fontSize:isBottle?16:14,fontWeight:isBottle?700:500,color:isBottle?C.ink:C.ink2,fontFamily:C.P}}>{currSym}{t.value}</span>
                            </div>
                          );
                        })}
                        <span style={{fontSize:12,color:C.mid,fontFamily:C.P,marginLeft:'auto'}}>{listCurrency}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Card>
          );
        })}
        <Btn primary full onClick={()=>nav('camera')} style={{marginTop:4}}>Scan Another</Btn>
        <div style={{height:8}}/>
      </div>
</div>
    </div>
  );
}

/* ── SETTINGS SCREEN ── */
function SettingsScreen({nav,back}){
  const [region, setRegion] = React.useState(localStorage.getItem('vinterest_region') || 'uk');
  
  function saveRegion(r) {
    setRegion(r);
    localStorage.setItem('vinterest_region', r);
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:`1px solid ${C.line}`}}>
        <div onClick={back} style={{cursor:'pointer',fontSize:24}}>←</div>
        <div style={{fontSize:18,fontWeight:700,color:C.ink,fontFamily:C.P}}>Settings</div>
        <div style={{width:24}}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        <div style={{marginBottom:24}}><TextSizeControl/></div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Region</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {id:'uk',label:'United Kingdom',sym:'£'},
              {id:'eu',label:'Europe',sym:'€'},
              {id:'us',label:'United States',sym:'$'},
              {id:'ontario',label:'Canada',sym:'CA$'},
              {id:'australia',label:'Australia',sym:'A$'},
              {id:'nz',label:'New Zealand',sym:'NZ$'},
            ].map(r => (
              <div
                key={r.id}
                onClick={() => saveRegion(r.id)}
                style={{
                  padding:'12px 14px',
                  borderRadius:12,
                  background: region === r.id ? C.crSoft : C.white,
                  border: `1px solid ${region === r.id ? C.cr : C.line}`,
                  cursor:'pointer',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between'
                }}
              >
                <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>{r.label} <span style={{color:C.mid,fontWeight:400}}>({r.sym})</span></span>
                {region === r.id && <span style={{fontSize:14,color:C.cr}}>✓</span>}
              </div>
            ))}
          </div>
          <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:8}}>Prices, budgets and sommelier scripts across the app use this currency.</div>
        </div>
        <div style={{marginBottom:24}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:12}}>Debug</div>
          <Btn onClick={()=>{
            const errors = JSON.parse(localStorage.getItem('vinterest_errors') || '[]');
            if(errors.length===0){alert('No errors logged.');return;}
            alert('Recent errors:\n\n' + errors.slice(-5).map(e => e.context + ': ' + e.message).join('\n'));
          }} style={{width:'100%',padding:'12px',borderRadius:12,background:C.white,border:`1px solid ${C.line}`,fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,cursor:'pointer'}}>
            View Error Log
          </Btn>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{TasteProfileScreen,RestaurantScreen,LearnScreen,MyWinesScreen,WineListScreen,SettingsScreen});
