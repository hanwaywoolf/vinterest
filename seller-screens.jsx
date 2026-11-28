/* Vinterest Seller's screens (docs/seller.md): the visit brief for one prospect restaurant, in the Teams console's
   new look (flat black, hairline squares, Poppins 300 headlines, small spaced capitals, gold for the accent).
   Every figure and every sentence is SellerMatch's; the screens only draw it. Any bottle, anywhere, opens its wine
   card (SellerWineCard) through `open(id)`. */
const _S_FLAT={..._DECK_DARK,flat:true,bg:'#000'};
const _sAcc=()=>TeamBrand.GOLD;
const _sLine='rgba(255,255,255,0.09)';
const _sCaps={fontFamily:C.P,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',fontSize:'12px'};
/* The fit score's colour: brilliant green at 100, through yellow in the middle, to bright red at 0. On the white
   cheat sheet the same hue, darker, so it reads on paper. */
const _sFit=(score,paper)=>`hsl(${Math.round(Math.max(0,Math.min(100,score))*1.25)},${paper?'78%':'92%'},${paper?'33%':'54%'})`;
/* What a line rests on: the restaurant's own list, the agency's product sheet, Vinterest's checked grape and region
   notes, or an estimate of ours. */
const _S_BASIS={list:{label:'Their list',col:'#FFFFFF'},sheet:{label:'Product sheet',col:'#D4A84B'},guide:{label:'Vinterest guide',col:'#9CC9F5'},estimate:{label:'Our estimate',col:'#8C8C92'}};
const _sTypeCol=(T,type)=>T.lift(_TYPE_COLORS[{rosé:'rose',sweet:'dessert'}[type]||type]||_TYPE_COLORS.red);
const _sRule=(T,type)=>({boxShadow:`inset 3px 0 0 ${_sTypeCol(T,type)}`});
const _sChev=(shut,col)=><svg width="11" height="11" viewBox="0 0 10 10" style={{flexShrink:0,transform:shut?'rotate(-90deg)':'none',transition:'transform .15s'}}><path d="M1.5 3.2 5 6.8l3.5-3.6" fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
/* A titled card. With `fold` it folds to its title and one line of what's in it (`summary`). */
function _SCard({title,right,children,testid,feat,style,id,fold,summary,startShut}){ const T=useTheme(), acc=_sAcc(), [shut,setShut]=React.useState(!!startShut);
  return <div id={id} data-testid={testid} style={{border:`1px solid ${feat?_alpha(acc,0.4):_sLine}`,background:feat?_alpha(acc,0.06):'rgba(255,255,255,0.025)',padding:'18px 20px',minWidth:0,...style}}>
    {(title||right)&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,marginBottom:shut?0:12}}>
      {fold?<div role="button" tabIndex={0} data-testid="seller-fold" aria-expanded={!shut} onClick={()=>setShut(v=>!v)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); setShut(v=>!v); } }} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',..._sCaps,color:feat?acc:T.mid}}>{_sChev(shut,feat?acc:T.mid)}{title}</div>:<div style={{..._sCaps,color:feat?acc:T.mid}}>{title}</div>}
      {right&&!shut&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid}}>{right}</div>}</div>}
    {shut?summary&&<div role="button" onClick={()=>setShut(false)} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.45,marginTop:6,marginLeft:19,cursor:'pointer'}}>{summary}</div>:children}</div>; }
function _SBasis({b}){ const x=_S_BASIS[b]; if(!x) return null; return <span data-cap title={x.label} style={{display:'inline-flex',alignItems:'center',gap:5,..._sCaps,fontSize:'10px',color:'rgba(255,255,255,0.5)',whiteSpace:'nowrap'}}><span style={{width:6,height:6,background:x.col,flexShrink:0}}/>{x.label}</span>; }
function _SLegend(){ return <div data-testid="seller-legend" style={{display:'flex',gap:'6px 18px',flexWrap:'wrap'}}>{Object.keys(_S_BASIS).map(k=><_SBasis key={k} b={k}/>)}</div>; }
function _SScore({f,small}){ const T=useTheme(), col=_sFit(f.score), s=small?46:68;
  return <div data-testid="seller-score" data-score={f.score} aria-label={`Fit ${f.score} out of 100: ${f.word}`} style={{width:s,height:s,flexShrink:0,border:`1px solid ${col}`,background:col.replace('hsl','hsla').replace(')',',0.12)'),display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1}}>
    <span style={{fontSize:small?'19px':'27px',fontWeight:500,fontFamily:C.P,color:col,lineHeight:1}}>{f.score}</span>{!small&&<span style={{..._sCaps,fontSize:'9px',color:T.mid}}>Fit</span>}</div>; }
function _STag({text,tone}){ const col=tone||'#FFFFFF'; return <span data-pill style={{..._sCaps,fontSize:'11px',padding:'3px 8px',border:`1px solid ${_alpha(col,0.5)}`,background:_alpha(col,0.1),color:'#fff',whiteSpace:'nowrap'}}>{text}</span>; }
const _S_TONE={ladder:'#9CC9F5',call:'#F2B84B',glass:'#6FD79C',dish:'#F58B7C',window:'#C9A6F5',mix:'#9CC9F5',format:'#8C8C92',house:'#D4A84B'};
const _S_KIND={call:'Missing',ladder:'Price gaps',glass:'By the glass',dish:'Menu',mix:'Regions',window:'Windows',format:'Formats'};
function _STile({label,value,note,testid,col}){ const T=useTheme(); return <div data-testid={testid} style={{border:`1px solid ${_sLine}`,padding:'13px 15px',minWidth:0}}>
    <div style={{..._sCaps,color:T.mid}}>{label}</div><div style={{fontSize:23,fontWeight:300,fontFamily:C.P,color:col||T.ink,marginTop:5,lineHeight:1.15}}>{value}</div>{note&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:4,lineHeight:1.4}}>{note}</div>}</div>; }
const _sName=i=>SellerCatalogue.label(i)+(SellerCatalogue.format(i)?' · '+SellerCatalogue.format(i):'');
function _SWineChip({f,onClick}){ const T=useTheme(); return <span role="button" data-pill data-testid="seller-chip" onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 10px',border:`1px solid ${_alpha(_sTypeCol(T,f.item.type),0.7)}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer',maxWidth:'100%'}}>
    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{SellerCatalogue.short(f.item)}{SellerCatalogue.format(f.item)?' '+SellerCatalogue.format(f.item):''}</span>{!f.out&&<span style={{color:_sFit(f.score),fontWeight:600}}>{f.score}</span>}</span>; }
function _SPill({on,onClick,children,testid}){ const T=useTheme(), acc=_sAcc(); return <span role="button" data-pill data-testid={testid} aria-pressed={on} onClick={onClick} style={{..._sCaps,padding:'6px 11px',border:`1px solid ${on?acc:'rgba(255,255,255,0.22)'}`,background:on?acc:'transparent',color:on?inkOn(acc):T.ink,cursor:'pointer',whiteSpace:'nowrap'}}>{children}</span>; }
function _SLogo({height=30}){ const b=(TeamData.get().venue||{}).brand, [bad,setBad]=React.useState(false); const name=(TeamData.get().venue||{}).name||'';
  return b&&b.logo&&!bad?<img src={'/team/'+b.logo} alt={name} onError={()=>setBad(true)} style={{height,maxWidth:180,objectFit:'contain',display:'block'}}/>:<span style={{fontSize:20,fontWeight:500,fontFamily:C.P}}>{name}</span>; }
/* Vinterest Seller's logo, made the way Teams' is (TeamLogo in team-console.jsx, whose measurements of logo.png it
   shares): the Vinterest mark cropped to its drawing, with SELLER spread under it from the V's point to the foot of
   the final T, in Seller's gold. `size` is the mark's height. */
function SellerLogo({size=20}){ const T=useTheme(), imgH=size/(_LOGO.b-_LOGO.t), imgW=imgH*_LOGO.ar, w=imgW*(_LOGO.r-_LOGO.l);
  return <div data-testid="seller-logo" role="img" aria-label="Vinterest Seller" style={{display:'inline-block',width:w,flexShrink:0}}>
    <div style={{width:w,height:size,overflow:'hidden',position:'relative'}}><img src="/logo.png" alt="" style={{position:'absolute',left:-imgW*_LOGO.l,top:-imgH*_LOGO.t,width:imgW,height:imgH,maxWidth:'none',display:'block',filter:T.dark?'invert(1)':'none'}} onError={e=>{ e.target.style.display='none'; }}/></div>
    <div aria-hidden="true" style={{marginLeft:w*_LOGO.wordL,width:w*(_LOGO.wordR-_LOGO.wordL),display:'flex',justifyContent:'space-between',fontSize:Math.round(size*0.55)+'px',fontWeight:700,color:_sAcc(),fontFamily:C.P,lineHeight:1,marginTop:4}}>{'SELLER'.split('').map((ch,i)=><span key={i}>{ch}</span>)}</div>
  </div>; }
const _sSweet=f=>['sweet','fortified'].includes(f.shape.kind);

/* What it costs them and what it sells for: the bottle and the glass on their list, each with the multiple. */
function _SPrices({f,cols}){ const i=f.item, L=f.landing, m=SellerMatch.maths(f), sup=SellerCatalogue.supply(i), A=(n)=>SellerCatalogue.money(n,2), M=n=>TeamData.money(Math.round(n)), sweet=_sSweet(f), glassy=f.fills.some(o=>o.kind==='glass');
  return <div data-testid="seller-prices" style={{display:'grid',gridTemplateColumns:`repeat(${cols},minmax(0,1fr))`,gap:0}}>
    <_STile label="Costs them" value={A(i.price)} note={`Case of ${i.ucs}: ${A(m.cost)}`}/>
    {sweet?<_STile testid="seller-price-pour" label="By the 2oz glass" value={`${A(m.pourCost)} a pour`} note={`${m.pours} pours to a ${i.ml}ml bottle; their dessert pour sells at $16`}/>
      :<_STile testid="seller-price-bottle" label="Bottle on their list" value={`About ${M(L.bottle)}`} note={`${L.x.toFixed(1)}× cost${L.lifted?`, their entry price (they usually take ${L.usualX.toFixed(1)}×)`:', their usual at this price'} · ${M(m.perBottle)} a bottle to them`}/>}
    {!sweet&&(L.glass?<_STile testid="seller-price-glass" label={glassy?'By the glass':'If poured by the glass'} value={`About ${M(L.glass)}`} note={`${(L.glass/m.pourCost).toFixed(1)}× cost · a pour costs them ${A(m.pourCost)}; ${m.pours} glasses to a case`}/>:<_STile label="Format" value={SellerCatalogue.format(i)} note="sold by the bottle only"/>)}
    <_STile label="Supply" value={sup.k==='now'?`${sup.n} cases`:sup.k==='store'?'LCBO only':sup.k==='transit'?`${sup.n} on the way`:sup.line} note={sup.k==='now'?'in the agency warehouse':sup.k==='store'?'nothing in the agency warehouse':'check before the meeting'}/>
  </div>; }
/* The pitch for one bottle at this restaurant: the one thing to say, the story, every dish with why, the counted
   reasons, and what they'll say back. Shared by the shortlist and the wine card. */
function _SPitch({f,open}){ const T=useTheme(), acc=_sAcc(), P=f.pitch, M=n=>TeamData.money(Math.round(n)), line={fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.6};
  const sec=(label,body,right)=><div style={{marginTop:18}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',marginBottom:8}}><div style={{..._sCaps,color:T.mid}}>{label}</div>{right}</div>{body}</div>;
  return <div>
    {!P.written&&<div data-testid="seller-unwritten" style={{...line,marginTop:16,color:T.mid}}>No pitch has been written for this bottle yet. Its figures, the dishes it suits and how it scores are below.</div>}
    {P.story.length>0&&sec('The pitch',<div>{P.story.map((s,k)=><div key={k} data-testid="seller-story" style={{display:'grid',gridTemplateColumns:'minmax(0,118px) minmax(0,1fr)',gap:'4px 14px',padding:'9px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}>
      <div><div style={{fontSize:14,fontWeight:500,fontFamily:C.P,color:T.ink}}>{s.h}</div><div style={{marginTop:3}}><_SBasis b={s.basis}/></div></div><div style={line}>{s.t}</div></div>)}</div>)}
    {P.pairings.length>0&&sec(`Dish by dish · ${P.pairings.length} on their menu`,<div>{P.pairings.map((x,k)=><div key={x.dish.id} data-testid="seller-pairing" style={{padding:'10px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><span style={{fontSize:15,fontWeight:500,fontFamily:C.P}}>{x.dish.name}{x.dish.price&&<span style={{color:T.mid,fontWeight:400}}> · {x.dish.price}</span>}</span>{x.like&&<span style={{fontSize:13,fontFamily:C.P,color:T.mid}}>beside {TeamData.nick(x.like)}{x.likePrice?` (${M(x.likePrice)})`:''}</span>}</div>
      {x.dish.desc&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2}}>{x.dish.desc}</div>}
      {x.why&&<div style={{...line,color:T.ink,marginTop:5}}>{x.why}</div>}
    </div>)}</div>,<_SBasis b="estimate"/>)}
    {sec('How it scores',<div>{f.reasons.map((r,k)=><div key={k} data-testid="seller-reason" style={{display:'flex',gap:'2px 10px',flexWrap:'wrap',alignItems:'baseline',padding:'6px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}>
      <span style={{width:34,flexShrink:0,textAlign:'right',fontSize:14,fontFamily:C.P,fontWeight:500,color:r.pts>0?'#6FD79C':'#F58B7C'}}>{r.pts>0?'+':'−'}{Math.abs(r.pts)}</span>
      <span style={{flex:'1 1 220px',minWidth:0,...line,color:T.ink}}>{r.text}</span><span style={{marginLeft:44}}><_SBasis b={r.basis}/></span></div>)}</div>)}
    {P.objections.length>0&&sec('If they push back',<div>{P.objections.map((o,k)=><div key={k} data-testid="seller-objection" style={{padding:'9px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}><div style={{...line,color:T.ink,fontWeight:500}}>{o.q}</div><div style={{...line,marginTop:2}}>{o.a}</div></div>)}</div>)}
  </div>; }

/* ---- the brief ---- */
function SellerBrief({B,go,open}){ const T=useTheme(), acc=_sAcc(), [ref,w]=_c2Width(), two=w>=900, [kind,setKind]=React.useState('all');
  const can=B.openings.filter(o=>o.wines.length), shut=B.openings.filter(o=>!o.wines.length), lead=B.shortlist.filter(f=>f.score>=SellerMatch.LEAD);
  const kinds=Object.keys(_S_KIND).filter(k=>can.some(o=>o.kind===k)), shown=can.filter(o=>kind==='all'||o.kind===kind), cap={..._sCaps,fontSize:'10px',color:T.mid};
  return <div ref={ref} data-testid="seller-brief">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:20,marginBottom:22}}>
      <div style={{minWidth:0}}>
        <div data-testid="seller-fact" style={{fontSize:two?38:28,lineHeight:1.15,fontWeight:300,letterSpacing:'-0.015em',fontFamily:C.P}}>{B.venue.name}'s list leaves <span style={{fontWeight:500,color:acc}}>{can.length} openings</span> this catalogue can answer.</div>
        <div style={{display:'flex',gap:'6px 26px',flexWrap:'wrap',marginTop:10}}>{[`${lead.length} bottle${lead.length===1?'':'s'} to lead with`,`${B.ours.length} of ours already on their list`,`${B.ruled} of ${B.catalogue} listings ruled out before the meeting`].map((t,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:6,height:6,background:acc}}/><span style={{fontSize:15,fontWeight:300,color:T.ink2,fontFamily:C.P}}>{t}</span></div>)}</div>
      </div>
      {two&&<div data-testid="seller-prospect" style={{flexShrink:0,paddingTop:6}}><_SLogo height={30}/></div>}
    </div>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${two?4:2},minmax(0,1fr))`,gap:0,marginBottom:16}}>
      <_STile testid="seller-kpi-open" label="Openings" value={`${can.length} of ${B.openings.length}`} note="found on their list and menu that we can answer"/>
      <_STile label="Bottles that fit" value={B.fits} note={`of ${B.catalogue} listings; ${B.ruled} can't go on this list`}/>
      <_STile label="Their multiple" value={`${B.multiple.low.toFixed(1)}× to ${B.multiple.high.toFixed(1)}×`} note={`on a ${SellerCatalogue.money(20)} bottle down to a ${SellerCatalogue.money(100)} one, from ${B.multiple.points} of their wines we can price`}/>
      <_STile label="Their glass" value={`Bottle ÷ ${B.glassRatio.toFixed(1)}`} note="what they charge for a glass of a bottle they also sell whole"/>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <div style={{display:'grid',gridTemplateColumns:two?'minmax(0,1.55fr) minmax(0,1fr)':'minmax(0,1fr)',gap:16,alignItems:'start'}}>
        <_SCard feat fold title="Lead with" summary={B.shortlist.slice(0,3).map(f=>SellerCatalogue.short(f.item)).join(' · ')} right={<span role="button" data-testid="seller-all-short" onClick={()=>go('shortlist')} style={{cursor:'pointer',color:acc}}>All {B.shortlist.length} →</span>} testid="seller-lead">
          {B.shortlist.slice(0,3).map((f,i)=><div key={f.item.id} role="button" onClick={()=>go('shortlist',f.item.id)} style={{display:'flex',gap:14,alignItems:'flex-start',padding:'12px 0',borderTop:i?`1px solid ${_sLine}`:'none',cursor:'pointer'}}>
            <_SScore f={f} small/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:500,fontFamily:C.P}}>{_sName(f.item)}</div>
              <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,marginTop:3,lineHeight:1.5}}>{f.pitch.say||f.fills.map(o=>o.title).join('; ')}</div></div>
          </div>)}
        </_SCard>
        <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
          {B.ours.length>0&&<_SCard fold title="Already on their list" summary={B.ours.map(o=>TeamData.short(o.wine)).join(', ')} testid="seller-ours">
            {B.ours.map(o=><div key={o.item.id}>
              <div role="button" onClick={()=>open(o.item.id)} style={{fontSize:16,fontWeight:500,fontFamily:C.P,cursor:'pointer'}}>{TeamData.label(o.wine)}</div>
              <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginTop:4}}>On their list at {TeamData.money(o.bottle)}. It's {SellerCatalogue.money(o.item.price,2)} from us, so they put {o.x.toFixed(1)}× on it: the one multiple here that isn't an estimate.</div>
              {o.next.length>0&&<div style={{marginTop:10}}><div style={{..._sCaps,color:T.mid,marginBottom:7}}>Next from the same house</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{o.next.map(f=><_SWineChip key={f.item.id} f={f} onClick={()=>open(f.item.id)}/>)}</div></div>}
            </div>)}
          </_SCard>}
          <_SCard fold startShut={two} title="How to read the fit" summary="The reasons for a bottle added up, from red at 0 to green at 100; not a forecast of a sale" testid="seller-how">
            <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.55}}>Fit is the reasons for a bottle added up, less what counts against it. It is not a forecast of a sale: there is no sales history behind it yet.</div>
            <div style={{height:10,margin:'12px 0 4px',background:`linear-gradient(90deg, ${[0,25,50,75,100].map(s=>_sFit(s)).join(', ')})`}}/>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:12,fontFamily:C.P,color:T.mid}}><span>0</span><span>{SellerMatch.SHOW} worth showing</span><span>{SellerMatch.LEAD} lead with it</span><span>100</span></div>
            <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.55,margin:'12px 0 10px'}}>Every line is marked with what it rests on. Where a bottle lands on their list, and its body and tannin, are our estimates.</div>
            <_SLegend/>
          </_SCard>
        </div>
      </div>

      {/* The openings take the page's whole width: one row each, read left to right: what's open, what their list has there today, what we'd bring. */}
      <_SCard fold title="What their list leaves open" summary={`${can.length} openings: ${kinds.map(k=>`${can.filter(o=>o.kind===k).length} ${_S_KIND[k].toLowerCase()}`).join(', ')}`} right={`${shown.length} of ${can.length}`} testid="seller-openings" style={{padding:'18px 22px 8px'}}>
        <div data-testid="seller-open-filters" style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:6}}>
          <_SPill on={kind==='all'} onClick={()=>setKind('all')} testid="seller-open-all">All {can.length}</_SPill>
          {kinds.map(k=><_SPill key={k} on={kind===k} onClick={()=>setKind(k)} testid={'seller-open-'+k}>{_S_KIND[k]} {can.filter(o=>o.kind===k).length}</_SPill>)}
        </div>
        {two&&<div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(0,1.7fr) minmax(0,1.1fr)',gap:28,padding:'14px 0 8px 16px'}}><span data-cap style={cap}>The opening</span><span data-cap style={cap}>On their list today</span><span data-cap style={cap}>What we'd bring</span></div>}
        {shown.map((o,k)=><div key={o.k} data-testid="seller-opening" data-kind={o.kind} style={{display:'grid',gridTemplateColumns:two?'minmax(0,1fr) minmax(0,1.7fr) minmax(0,1.1fr)':'minmax(0,1fr)',gap:two?28:12,padding:'18px 0 18px 16px',borderTop:`1px solid ${_sLine}`,boxShadow:`inset 3px 0 0 ${_S_TONE[o.kind]}`}}>
          <div style={{minWidth:0}}><div data-cap style={{..._sCaps,fontSize:'11px',color:_S_TONE[o.kind],marginBottom:6}}>{o.tag}</div><div style={{fontSize:18,fontWeight:500,fontFamily:C.P,lineHeight:1.25}}>{o.title}</div></div>
          <div style={{minWidth:0}}>
            <div data-testid="seller-opening-fact" style={{fontSize:15,fontFamily:C.P,color:T.ink,lineHeight:1.55}}>{o.fact}</div>
            {(o.facts||[]).filter(x=>x.label!=='We have').length>0&&<div style={{display:'grid',gridTemplateColumns:'auto minmax(0,1fr)',gap:'6px 14px',marginTop:10}}>{o.facts.filter(x=>x.label!=='We have').map((x,j)=><React.Fragment key={j}><span data-cap style={{...cap,paddingTop:3,whiteSpace:'nowrap'}}>{x.label}</span><span style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5}}>{x.text}</span></React.Fragment>)}</div>}
          </div>
          <div style={{minWidth:0}}>
            {(o.facts||[]).filter(x=>x.label==='We have').map((x,j)=><div key={j} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginBottom:10}}>{x.text.replace(/^./,c=>c.toUpperCase())}.</div>)}
            <div style={{display:'flex',flexDirection:'column',gap:7,alignItems:'flex-start'}}>{o.wines.slice(0,3).map(f=><_SWineChip key={f.item.id} f={f} onClick={()=>open(f.item.id)}/>)}{o.wines.length>3&&<span style={{fontSize:13,fontFamily:C.P,color:T.mid}}>and {o.wines.length-3} more in the catalogue</span>}</div>
          </div>
        </div>)}
      </_SCard>

      <div style={{display:'grid',gridTemplateColumns:two?'repeat(2,minmax(0,1fr))':'minmax(0,1fr)',gap:16,alignItems:'start'}}>
        {(B.cocktailWines.length>0||B.backBar.some(x=>x.uses.length))&&<_SCard fold title="Their cocktails" summary="Where our prosecco and rum could be the pour" testid="seller-bar">
          {B.cocktailWines.map((x,i)=><div key={'w'+i} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginBottom:8}}><span style={{color:T.ink,fontWeight:500}}>{x.cocktail.name}</span> is made with {String(x.ingredient).toLowerCase()}: {x.wines.map((i,k)=><React.Fragment key={i.id}>{k?' or ':''}<span role="button" onClick={()=>open(i.id)} style={{color:T.ink,textDecoration:'underline',textDecorationColor:'rgba(255,255,255,0.3)',cursor:'pointer'}}>{SellerCatalogue.short(i)}</span></React.Fragment>)} could be the pour.</div>)}
          {B.backBar.filter(x=>x.uses.length).map(x=><div key={x.item.id} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginBottom:8}}><span style={{color:T.ink,fontWeight:500}}>{x.uses.map(u=>u.cocktail.name).join(' and ')}</span> use{x.uses.length===1?'s':''} {x.category}, and the menu names {[...new Set(x.uses.map(u=>u.ingredient))].join(' and ')}. Ours is <span role="button" onClick={()=>open(x.item.id)} style={{color:T.ink,textDecoration:'underline',textDecorationColor:'rgba(255,255,255,0.3)',cursor:'pointer'}}>{SellerCatalogue.short(x.item)}</span> at {SellerCatalogue.money(x.item.price,2)}.</div>)}
          <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5}}>The brands a menu names say who supplies the back bar today.</div>
        </_SCard>}
        {shut.length>0&&<_SCard fold title="Openings we can't answer" summary={`${shut.length} the catalogue has nothing for at their prices`} right={shut.length} testid="seller-shut">
          {shut.map((o,i)=><div key={o.k} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,padding:'7px 0',borderTop:i?`1px solid ${_sLine}`:'none'}}>{o.title}</div>)}
          <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5,marginTop:8}}>Nothing in the catalogue fits these at their prices. Worth knowing before they ask.</div>
        </_SCard>}
      </div>
    </div>
  </div>; }

/* ---- the shortlist ---- */
/* One bottle. Summary is the one thing to say and what it sells for; Full pitch adds the story, every dish, the
   reasons and the objections. The switch says which it is showing and what the other holds. */
function SellerBottle({f,focus,shut,toggle,open}){ const T=useTheme(), acc=_sAcc(), i=f.item, P=f.pitch, ref=React.useRef(null), [r2,w]=_c2Width(), cols=w>=820?4:w>=480?2:1;
  React.useEffect(()=>{ if(focus&&ref.current&&ref.current.scrollIntoView) ref.current.scrollIntoView({block:'start'}); },[focus]);
  const holds=[P.story.length?`the pitch`:null,P.pairings.length?`${P.pairings.length} dish${P.pairings.length===1?'':'es'}`:null,`${f.reasons.length} reasons`,P.objections.length?`${P.objections.length} objection${P.objections.length===1?'':'s'}`:null].filter(Boolean).join(' · ');
  const seg=(on,label,tid)=><span role="button" data-pill data-testid={tid} aria-pressed={on} onClick={()=>{ if(!on) toggle(); }} style={{..._sCaps,fontSize:'11px',padding:'6px 10px',background:on?acc:'transparent',color:on?inkOn(acc):T.ink2,cursor:on?'default':'pointer',whiteSpace:'nowrap'}}>{label}</span>;
  return <div ref={ref} data-testid="seller-bottle" data-id={i.id} data-view={shut?'summary':'full'} style={{border:`1px solid ${focus?_alpha(acc,0.5):_sLine}`,background:'rgba(255,255,255,0.025)',padding:'20px 22px',..._sRule(T,i.type)}}><div ref={r2}>
    <div style={{display:'flex',gap:16,alignItems:'flex-start',flexWrap:'wrap'}}>
      <_SScore f={f}/>
      <div style={{flex:'1 1 240px',minWidth:0}}>
        <div style={{display:'flex',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><span style={{..._sCaps,color:_sFit(f.score)}}>{f.word}</span>{P.primary&&<_STag text={P.primary.tag} tone={_S_TONE[P.primary.kind]}/>}</div>
        <div role="button" data-testid="seller-bottle-name" onClick={()=>open(i.id)} style={{fontSize:22,fontWeight:300,fontFamily:C.P,lineHeight:1.2,marginTop:5,cursor:'pointer'}}>{_sName(i)}</div>
        <div style={{fontSize:14,fontFamily:C.P,color:T.mid,marginTop:4,lineHeight:1.45}}>{SellerMatch.placeLine(i)}{f.shape.grapes.length?` · ${f.shape.grapes.slice(0,3).join(', ')}`:''}{i.basis.grapes==='estimate'?' (typical, not on the sheet)':''} · {i.listingLabel}</div>
      </div>
      <div data-testid="seller-bottle-view" role="group" aria-label="How much to show" style={{display:'inline-flex',border:`1px solid ${_alpha(acc,0.6)}`,flexShrink:0}}>{seg(shut,'Summary','seller-view-summary')}{seg(!shut,'Full pitch','seller-view-full')}</div>
    </div>
    {P.say&&<div data-testid="seller-say" style={{margin:'16px 0',padding:'13px 16px',borderLeft:`3px solid ${acc}`,background:_alpha(acc,0.07)}}><div style={{..._sCaps,fontSize:'10px',color:acc,marginBottom:5}}>One thing to say</div><div style={{fontSize:16,fontFamily:C.P,color:T.ink,lineHeight:1.5}}>{P.say}</div></div>}
    {!P.say&&<div style={{height:16}}/>}
    <_SPrices f={f} cols={cols}/>
    {!shut&&<_SPitch f={f} open={open}/>}
    <div role="button" tabIndex={0} data-testid="seller-bottle-fold" aria-expanded={!shut} onClick={toggle} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); toggle(); } }} style={{display:'flex',alignItems:'center',gap:10,marginTop:16,paddingTop:13,borderTop:`1px solid ${_sLine}`,cursor:'pointer'}}>
      <span style={{display:'inline-flex',transform:shut?'none':'rotate(180deg)'}}>{_sChev(false,acc)}</span>
      <span style={{..._sCaps,color:acc}}>{shut?'Show the full pitch':'Back to the summary'}</span>
      {shut&&<span style={{fontSize:13,fontFamily:C.P,color:T.mid}}>{holds}</span>}
    </div>
  </div></div>; }
function SellerShortlist({B,focus,open}){ const T=useTheme(), acc=_sAcc(), [shut,setShut]=React.useState(()=>Object.fromEntries(B.shortlist.map((f,k)=>[f.item.id,k>=1&&f.item.id!==focus]))), all=B.shortlist.every(f=>shut[f.item.id]), none=B.shortlist.every(f=>!shut[f.item.id]);
  const setAll=v=>setShut(Object.fromEntries(B.shortlist.map(f=>[f.item.id,v]))), seg=(on,label,tid,v)=><span role="button" data-pill data-testid={tid} aria-pressed={on} onClick={()=>setAll(v)} style={{..._sCaps,padding:'8px 13px',background:on?acc:'transparent',color:on?inkOn(acc):T.ink,cursor:'pointer',whiteSpace:'nowrap'}}>{label}</span>;
  return <div data-testid="seller-shortlist">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:16,flexWrap:'wrap',marginBottom:20}}>
      <div style={{minWidth:0}}><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>{B.shortlist.length} bottles to take to <span style={{fontWeight:500,color:acc}}>{B.venue.name}</span>.</div>
        <div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8,lineHeight:1.5}}>Best fit first, with no more than {SellerMatch.PER_HOUSE} from one house and one bottle for each opening, so the visit covers the list. A bottle's name opens its wine card.</div>
        <div style={{marginTop:12}}><_SLegend/></div></div>
      <div><div data-cap style={{..._sCaps,fontSize:'10px',color:T.mid,marginBottom:6}}>Show every bottle as</div><div data-testid="seller-view-all" role="group" style={{display:'inline-flex',border:`1px solid ${_alpha(acc,0.6)}`}}>{seg(all,'Summaries','seller-all-summary',true)}{seg(none,'Full pitches','seller-all-full',false)}</div></div></div>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>{B.shortlist.map(f=><SellerBottle key={f.item.id} f={f} focus={focus===f.item.id} shut={!!shut[f.item.id]} toggle={()=>setShut(s=>({...s,[f.item.id]:!s[f.item.id]}))} open={open}/>)}</div>
  </div>; }

/* ---- the whole catalogue against this list ---- */
function SellerCatalogueTab({B,open}){ const T=useTheme(), acc=_sAcc(), all=SellerMatch.all(), [f,setF]=React.useState('fit'), [q,setQ]=React.useState('');
  const groups={fit:all.filter(x=>!x.out&&x.fills.length),none:all.filter(x=>!x.out&&!x.fills.length),out:all.filter(x=>x.out),all}, norm=s=>SellerMatch._norm(s);
  const rows=groups[f].filter(x=>!q||norm([x.item.producer,x.item.name,x.item.region,x.item.country,x.item.grapes.join(' '),x.item.cspc].join(' ')).includes(norm(q)));
  return <div data-testid="seller-catalogue">
    <div style={{marginBottom:18}}><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>{B.agency.name}: <span style={{fontWeight:500,color:acc}}>{groups.fit.length} of {all.length}</span> listings have a place here.</div>
      <div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8}}>{B.agency.market} catalogue as of {new Date(B.agency.fetched+'T12:00:00').toLocaleDateString('en-CA',{day:'numeric',month:'long',year:'numeric'})}. A row opens the wine's card.</div></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      {[['fit','Fit'],['none','No opening'],['out','Ruled out'],['all','All']].map(([k,l])=><_SPill key={k} on={f===k} onClick={()=>setF(k)} testid={'seller-filter-'+k}>{l} {groups[k].length}</_SPill>)}
      <input data-testid="seller-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search a wine, grape or place" aria-label="Search the catalogue" style={{flex:'1 1 200px',maxWidth:320,marginLeft:'auto',background:'transparent',border:'1px solid rgba(255,255,255,0.22)',color:T.ink,padding:'8px 12px',fontSize:14,fontFamily:C.P,borderRadius:0,outline:'none'}}/>
    </div>
    <div style={{border:`1px solid ${_sLine}`}}>{rows.map((x,k)=>{ const i=x.item, sup=SellerCatalogue.supply(i);
      return <div key={i.id} role="button" data-testid="seller-row" data-id={i.id} onClick={()=>open(i.id)} style={{display:'flex',gap:14,alignItems:'center',padding:'11px 16px',cursor:'pointer',borderTop:k?`1px solid ${_sLine}`:'none',..._sRule(T,i.type)}}>
          <div style={{width:40,flexShrink:0,textAlign:'center',fontSize:18,fontWeight:500,fontFamily:C.P,color:x.out?T.mid:_sFit(x.score)}}>{x.out?'–':x.score}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:500,fontFamily:C.P}}>{_sName(i)}</div>
            <div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2,lineHeight:1.4}}>{x.out?x.out:x.fills.length?x.reasons[0].text:'Fits their prices, but fills nothing their list is missing'}</div></div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:15,fontFamily:C.P}}>{SellerCatalogue.money(i.price,2)}</div><div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2}}>{sup.k==='now'?`${sup.n} cs`:sup.k==='store'?'LCBO':sup.k==='transit'?'On the way':sup.k==='order'?'On order':'None'}</div></div>
        </div>; })}
      {!rows.length&&<div style={{padding:'18px 16px',fontSize:14,fontFamily:C.P,color:T.mid}}>Nothing in the catalogue matches that.</div>}</div>
  </div>; }

/* ---- the wine card: everything a seller could need about one bottle ---- */
const _S_TRAITS=[['body','Body','Weight in the mouth: skimmed milk against cream.'],['acid','Acidity','How much it makes your mouth water; more is fresher.'],['tannin','Tannin','The drying grip on your gums, like strong black tea.'],['sweet','Sweetness','From bone dry at one dot to dessert-sweet at five.']];
function SellerWineCard({id,close,open}){ const T=useTheme(), acc=_sAcc(), f=SellerMatch.card(id), ref=React.useRef(null), [bad,setBad]=React.useState(false);
  React.useEffect(()=>{ if(ref.current) ref.current.scrollTop=0; setBad(false); const k=e=>{ if(e.key==='Escape') close(); }; window.addEventListener('keydown',k); return ()=>window.removeEventListener('keydown',k); },[id]);
  if(!f) return null; const i=f.item, wine=i.kind==='wine', sup=SellerCatalogue.supply(i), A=n=>SellerCatalogue.money(n,2), talk=SellerMatch.talk(i), sib=SellerMatch.siblings(i), all=SellerMatch.all();
  const line={fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.6}, sec=(label,body,right)=><div style={{marginTop:22}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline',marginBottom:9}}><div style={{..._sCaps,color:T.mid}}>{label}</div>{right}</div>{body}</div>;
  const facts=[['CSPC',i.cspc],['UPC',i.upc],['Listing',i.listingLabel],['Pack',`${i.ucs} × ${i.ml}ml`],['Net of tax',i.net?A(i.net):null],['Alcohol',i.abv?`${i.abv}%`:null],['Sugar',i.sugar!=null?`${i.sugar} g/L`:null],['Acidity',i.acidity!=null?`${i.acidity} g/L`:null],['pH',i.ph],['Serve at',i.temp?`${i.temp}°C`:null],['Ageing',i.ageing],['Designation',i.designation],['Certified',i.certs.join(', ')],['Supplier',i.supplier],['Vintage',i.vintage||(wine?'Not on the sheet':null)]].filter(x=>x[1]!=null&&x[1]!=='');
  return <div data-testid="seller-card-layer" style={{position:'absolute',inset:0,zIndex:40,display:'flex',justifyContent:'flex-end'}}>
    <div onClick={close} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.62)'}}/>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={_sName(i)} data-testid="seller-card" data-id={i.id} style={{position:'relative',width:'min(100%, 680px)',height:'100%',overflowY:'auto',background:'#060606',borderLeft:`1px solid ${_sLine}`,padding:'calc(env(safe-area-inset-top) + 22px) 24px calc(env(safe-area-inset-bottom) + 40px)',..._sRule(T,i.type)}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,marginBottom:16}}><div style={{..._sCaps,color:acc}}>{wine?i.type==='rosé'?'Rosé':i.type.charAt(0).toUpperCase()+i.type.slice(1):i.family||'Spirit'} · {i.country}</div>
        <div role="button" tabIndex={0} data-testid="seller-card-close" aria-label="Close" onClick={close} style={{width:34,height:34,border:'1px solid rgba(255,255,255,0.22)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:18,fontFamily:C.P}}>×</div></div>
      {/* The head is a sheet of warm paper. The catalogue's bottle shots are on white: multiplied onto the paper the white
          drops out, so the bottle stands on the page instead of in a white box on black. */}
      <div data-testid="seller-card-head" style={{display:'flex',gap:22,alignItems:'center',background:'linear-gradient(135deg,#F6F2EA,#E9E2D4)',color:'#15110A',padding:'22px 24px',margin:'0 -24px',borderTop:`3px solid ${_TYPE_COLORS[{rosé:'rose',sweet:'dessert'}[i.type]||i.type]||_TYPE_COLORS.red}`}}>
        {i.img&&!bad&&<img data-testid="seller-card-img" src={i.img} alt={`${_sName(i)} bottle`} onError={()=>setBad(true)} style={{width:112,height:250,flexShrink:0,objectFit:'contain',display:'block',mixBlendMode:'multiply',filter:'drop-shadow(0 10px 12px rgba(21,17,10,0.22))'}}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontFamily:C.P,color:'#5c5448',fontWeight:500}}>{i.producer}</div>
          <div data-testid="seller-card-name" style={{fontSize:28,fontWeight:300,fontFamily:C.P,lineHeight:1.15,marginTop:3,color:'#15110A'}}>{i.name}{i.vintage?` ${i.vintage}`:''}{SellerCatalogue.format(i)?` · ${SellerCatalogue.format(i)}`:''}</div>
          <div style={{fontSize:14,fontFamily:C.P,color:'#3d372e',lineHeight:1.6,marginTop:8}}>{SellerMatch.placeLine(i)}</div>
          {wine&&i.grapes.length>0&&<div style={{fontSize:14,fontFamily:C.P,color:'#15110A',lineHeight:1.6,marginTop:4,fontWeight:500}}>{SellerMatch.grapeLine(i)}{i.basis.grapes!=='sheet'&&<span style={{fontWeight:400,color:'#5c5448'}}> (typical, not on the sheet)</span>}</div>}
          {wine&&i.flavours.length>0&&<div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginTop:12}}>{i.flavours.map(x=><span key={x} data-pill style={{..._sCaps,fontSize:'11px',padding:'3px 8px',border:'1px solid rgba(21,17,10,0.45)',color:'#15110A'}}>{x}</span>)}{i.basis.flavours!=='sheet'&&<span data-cap style={{..._sCaps,fontSize:'10px',color:'#5c5448'}}>Our estimate</span>}</div>}
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,minmax(0,1fr))',gap:0,marginTop:20}}>
        <_STile label="Price" value={A(i.price)} note={i.reduced?`reduced from ${A(i.reduced)}`:'a bottle'}/>
        <_STile label="Case" value={A(SellerCatalogue.caseCost(i))} note={`${i.ucs} × ${i.ml}ml`}/>
        <_STile label="Supply" value={sup.k==='now'?`${sup.n} cases`:sup.k==='store'?'LCBO only':sup.k==='transit'?`${sup.n} coming`:sup.line} note={[i.stock.warehouse?`${i.stock.warehouse} in the warehouse`:null,i.stock.store?`${i.stock.store} in LCBO stores`:null,...(i.stock.transit||[]).map(t=>`${t.qty} in transit${t.eta?`, ETA ${t.eta}`:''}`)].filter(Boolean).join(' · ')||'nothing in stock'}/>
      </div>

      {/* At this restaurant */}
      <div data-testid="seller-card-fit" style={{marginTop:22,border:`1px solid ${f.out?_sLine:_alpha(acc,0.35)}`,padding:'16px 18px'}}>
        <div style={{..._sCaps,color:acc,marginBottom:10}}>At {(TeamData.get().venue||{}).name}</div>
        {f.out?<div style={{...line,color:T.ink}}>{f.out}.</div>:<>
          <div style={{display:'flex',gap:14,alignItems:'center'}}><_SScore f={f}/><div style={{minWidth:0}}><div style={{..._sCaps,color:_sFit(f.score)}}>{f.fills.length?f.word:'No opening'}</div><div style={{fontSize:16,fontFamily:C.P,color:T.ink,lineHeight:1.5,marginTop:4}}>{f.pitch.say||(f.fills.length?`Answers: ${f.fills.map(o=>o.title).join('; ')}.`:'It fits their prices, but fills nothing their list is missing.')}</div></div></div>
          <div style={{marginTop:14}}><_SPrices f={f} cols={2}/></div>
          <_SPitch f={f} open={open}/></>}
      </div>

      {wine&&i.style&&sec('Taste profile',<div style={{display:'grid',gridTemplateColumns:'auto auto minmax(0,1fr)',gap:'9px 14px',alignItems:'center'}}>{_S_TRAITS.filter(([k])=>k!=='tannin'||['red','fortified','orange'].includes(i.type)).map(([k,l,how])=><React.Fragment key={k}>
          <span style={{fontSize:14,fontWeight:500,fontFamily:C.P}}>{l}</span>
          <span aria-label={`${i.style[k]} out of 5`} style={{display:'inline-flex',gap:4}}>{[1,2,3,4,5].map(n=><span key={n} style={{width:10,height:10,borderRadius:5,background:n<=i.style[k]?_sTypeCol(T,i.type):'rgba(255,255,255,0.14)'}}/>)}</span>
          <span style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.4}}>{how}</span></React.Fragment>)}</div>,<_SBasis b="estimate"/>)}

      {talk.length>0&&sec('How to talk about it',<div>{talk.map((x,k)=><div key={k} data-testid="seller-talk" style={{padding:'10px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}><div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'baseline'}}><span style={{fontSize:14,fontWeight:500,fontFamily:C.P}}>{x.label}</span><_SBasis b={x.basis}/></div><div style={{...line,marginTop:3}}>{x.text}</div></div>)}</div>)}

      {sec('From the product sheet',<div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:0,border:`1px solid ${_sLine}`}}>{facts.map(([l,v],k)=><div key={l} style={{padding:'9px 13px',borderTop:k>1?`1px solid ${_sLine}`:'none',borderLeft:k%2?`1px solid ${_sLine}`:'none',minWidth:0}}><div style={{..._sCaps,fontSize:'10px',color:T.mid}}>{l}</div><div style={{fontSize:14,fontFamily:C.P,color:T.ink,marginTop:2,overflowWrap:'anywhere'}}>{v}</div></div>)}</div>)}

      {sib.length>0&&sec('Other sizes and years',<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{sib.map(x=>{ const g=all.find(y=>y.item.id===x.id); return <span key={x.id} role="button" data-pill onClick={()=>open(x.id)} style={{padding:'6px 10px',border:'1px solid rgba(255,255,255,0.22)',fontSize:13,fontFamily:C.P,cursor:'pointer'}}>{[x.vintage,SellerCatalogue.format(x)||'750ml'].filter(Boolean).join(' · ')} · {A(x.price)}{g&&!g.out?<span style={{color:_sFit(g.score),fontWeight:600}}> {g.score}</span>:null}</span>; })}</div>)}
      {i.lcbo&&<div style={{marginTop:22}}><a href={i.lcbo} target="_blank" rel="noopener noreferrer" style={{..._sCaps,color:acc,textDecoration:'none',border:`1px solid ${acc}`,padding:'9px 14px',display:'inline-block'}}>See it at the LCBO</a></div>}
      <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5,marginTop:22}}>From {SellerCatalogue.agency().name}'s {SellerCatalogue.agency().market} catalogue, read {SellerCatalogue.agency().fetched}. Check price and stock before quoting them.</div>
    </div>
  </div>; }

/* ---- the cheat sheet: one page for the meeting ---- */
function SellerSheet({B}){ const T=useTheme(), acc=_sAcc(), ref=React.useRef(null), M=n=>TeamData.money(Math.round(n)), can=B.openings.filter(o=>o.wines.length);
  const print=()=>{ try{ const w=window.open('','_blank'); if(!w) return; w.document.write(`<!doctype html><title>${B.venue.name}: cheat sheet</title><link rel="stylesheet" href="/fonts/fonts.css"><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style><body style="margin:24px;font-family:Poppins,sans-serif">${ref.current.outerHTML}</body>`); w.document.close(); setTimeout(()=>w.print(),400); }catch(e){} };
  const ink='#15110A', mid='#5c5c63', rule='#d9d6cf', cell={padding:'8px 8px',fontSize:'11px',lineHeight:1.42,verticalAlign:'top',borderTop:`1px solid ${rule}`,fontFamily:C.P,color:ink}, th={...cell,borderTop:'none',fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,textAlign:'left'};
  const gl=TeamBuyer.wines().filter(TeamData.byGlass).map(w=>SellerMatch._m(w.glass)), bt=TeamBuyer.wines().map(w=>SellerMatch._m(w.bottle)).filter(Boolean);
  return <div data-testid="seller-sheet">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:16,flexWrap:'wrap',marginBottom:18}}>
      <div><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>One page for the <span style={{fontWeight:500,color:acc}}>meeting</span>.</div><div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8}}>What to know about their list, and each bottle with the one thing to say.</div></div>
      <TeamBtn primary onClick={print} testid="seller-print">Print</TeamBtn></div>
    <div style={{overflowX:'auto'}}><div ref={ref} data-testid="seller-paper" style={{background:'#fff',color:ink,padding:'26px 28px',minWidth:760,fontFamily:C.P}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,borderBottom:`2px solid ${ink}`,paddingBottom:8}}><div style={{fontSize:'20px',fontWeight:600}}>{B.venue.name} <span style={{fontWeight:300}}>· {B.venue.city}</span></div><div style={{fontSize:'10px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid}}>{B.agency.name} · {new Date().toLocaleDateString('en-CA',{day:'numeric',month:'short',year:'numeric'})}</div></div>
      <div style={{fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,margin:'14px 0 5px'}}>Their list</div>
      <div style={{fontSize:'11px',lineHeight:1.55,color:ink}}>
        <div>{TeamBuyer.wines().length} wines, {gl.length} by the glass ({M(Math.min(...gl))} to {M(Math.max(...gl))}); bottles from {M(Math.min(...bt))}.</div>
        <div>They put about {B.multiple.low.toFixed(1)}× on a {SellerCatalogue.money(20)} bottle and {B.multiple.high.toFixed(1)}× on a {SellerCatalogue.money(100)} one (our estimate{B.multiple.exact?`, checked against ${B.ours.map(o=>TeamData.nick(o.wine)).join(', ')}`:''}); a glass is the bottle ÷ {B.glassRatio.toFixed(1)}.</div>
        {B.ours.map(o=><div key={o.item.id}>Already ours: {TeamData.short(o.wine)} at {M(o.bottle)}.</div>)}
        <div>Openings: {can.slice(0,6).map(o=>o.title.charAt(0).toLowerCase()+o.title.slice(1)).join('; ')}.</div>
      </div>
      <div style={{fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,margin:'16px 0 2px'}}>The bottles</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{...th,width:34}}>Fit</th><th style={{...th,width:'19%'}}>Bottle</th><th style={{...th,width:76}}>Cost</th><th style={{...th,width:88}}>On their list</th><th style={th}>One thing to say</th><th style={{...th,width:'24%'}}>Why, and what to pour it with</th></tr></thead>
        <tbody>{B.shortlist.map(f=>{ const i=f.item, sweet=_sSweet(f), col=_sFit(f.score,true), top=f.pitch.pairings[0]; return <tr key={i.id} data-testid="seller-sheet-row">
          <td style={cell}><span data-testid="seller-sheet-fit" style={{display:'inline-block',minWidth:26,textAlign:'center',padding:'3px 4px',background:col,color:'#fff',fontWeight:600}}>{f.score}</span></td>
          <td style={cell}><div style={{fontWeight:600}}>{_sName(i)}</div><div style={{color:mid}}>{SellerMatch.placeLine(i)}</div><div style={{color:mid}}>{i.flavours.join(', ')}</div><div style={{color:mid}}>CSPC {i.cspc}</div></td>
          <td style={cell}>{SellerCatalogue.money(i.price,2)}<div style={{color:mid}}>{i.ucs} × {SellerCatalogue.money(f.pitch.maths.cost,2)}</div><div style={{color:mid}}>{SellerCatalogue.supply(i).k==='now'?`${SellerCatalogue.supply(i).n} cs`:SellerCatalogue.supply(i).line}</div></td>
          <td style={cell}>{sweet?<>2oz glass<div style={{color:mid}}>{SellerCatalogue.money(f.pitch.maths.pourCost,2)} a pour</div></>:<>About {M(f.landing.bottle)}<div style={{color:mid}}>{f.landing.x.toFixed(1)}× cost</div>{f.landing.glass&&<div style={{color:mid}}>{M(f.landing.glass)} a glass</div>}</>}</td>
          <td style={{...cell,fontWeight:500}}>{f.pitch.say}</td>
          <td style={cell}>{f.fills.slice(0,2).map((o,k)=><div key={k}>{o.title}.</div>)}{top&&<div style={{marginTop:3}}><span style={{fontWeight:600}}>{top.dish.name}.</span> {top.why}</div>}{f.pitch.pairings.length>1&&<div style={{color:mid,marginTop:2}}>Also: {f.pitch.pairings.slice(1,4).map(x=>x.dish.name).join(', ')}.</div>}</td></tr>; })}</tbody></table>
      <div style={{fontSize:'9px',color:mid,marginTop:12,lineHeight:1.5}}>Fit is the reasons added up, not a forecast: green is the strongest fit, red the weakest. List prices and style are estimates; costs, pack sizes and stock are from the {B.agency.short} catalogue of {B.agency.fetched}.</div>
    </div></div>
  </div>; }
/* ---- what to bring: the bottles to taste in the meeting ---- */
function SellerBring({B,open}){ const T=useTheme(), acc=_sAcc(), [min,setMin]=React.useState(SellerMatch.BRING_DEFAULT), [packed,setPacked]=React.useState({}), K=SellerMatch.bring(min), [ref,w]=_c2Width(), wide=w>=760;
  const done=K.rows.filter(r=>packed[r.item.id]).length, cap={..._sCaps,fontSize:'10px',color:T.mid};
  return <div ref={ref} data-testid="seller-bring">
    <div style={{marginBottom:18}}><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}><span data-testid="seller-bring-count" style={{fontWeight:500,color:acc}}>{K.rows.length} bottle{K.rows.length===1?'':'s'}</span> to taste at {B.venue.name}.</div>
      <div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8,lineHeight:1.5}}>One bottle of each wine, best fit first. Raise the fit to carry less, lower it to carry more.</div></div>
    <div style={{display:'flex',gap:'10px 14px',flexWrap:'wrap',alignItems:'center',marginBottom:14}}>
      <span data-cap style={cap}>Fit of at least</span>
      <div data-testid="seller-bring-filters" style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {[...new Set([...SellerMatch.BRING_STEPS,SellerMatch.BRING_DEFAULT])].sort((a,b)=>b-a).map(t=><_SPill key={t} on={min===t} onClick={()=>setMin(t)} testid={'seller-bring-'+t}>{t?`${t}+`:'Any fit'} · {t===SellerMatch.BRING_DEFAULT?SellerMatch.bring(t).rows.length:K.counts[t]}</_SPill>)}
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${wide?4:2},minmax(0,1fr))`,gap:0,marginBottom:16}}>
      <_STile label="To carry" value={K.rows.length} note={`${done} packed`}/>
      <_STile label="To chill" value={K.cold} note="sparkling, white, rosé and sweet, before you leave"/>
      <_STile label="Sample cost" value={SellerCatalogue.money(K.cost,2)} note="one bottle of each at list price"/>
      <_STile label="Not to hand" value={K.missing.length} note={K.missing.length?'not in the agency warehouse: source these first':'everything is in the warehouse'} col={K.missing.length?'#F2B84B':undefined}/>
    </div>
    <div style={{border:`1px solid ${_sLine}`}}>
      {K.rows.map((r,k)=>{ const i=r.item, on=!!packed[i.id]; return <div key={i.id} data-testid="seller-bring-row" data-id={i.id} data-score={r.score} style={{display:'flex',gap:14,alignItems:'center',padding:'12px 16px',borderTop:k?`1px solid ${_sLine}`:'none',..._sRule(T,i.type),opacity:on?0.55:1}}>
        <div role="checkbox" tabIndex={0} aria-checked={on} aria-label={`${SellerCatalogue.short(i)} packed`} data-testid="seller-bring-pack" onClick={()=>setPacked(p=>({...p,[i.id]:!on}))} onKeyDown={e=>{ if(e.key===' '||e.key==='Enter'){ e.preventDefault(); setPacked(p=>({...p,[i.id]:!on})); } }} style={{width:22,height:22,flexShrink:0,border:`1px solid ${on?acc:'rgba(255,255,255,0.35)'}`,background:on?acc:'transparent',color:inkOn(acc),display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',fontSize:'14px',fontWeight:700,fontFamily:C.P}}>{on?'✓':''}</div>
        <_SScore f={r.f} small/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><span role="button" onClick={()=>open(i.id)} style={{fontSize:16,fontWeight:500,fontFamily:C.P,cursor:'pointer'}}>{SellerCatalogue.label(i)}</span>{r.shortlisted&&<_STag text="Shortlist" tone={acc}/>}</div>
          <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,marginTop:3,lineHeight:1.45}}>{r.answers.join(' · ')}</div>
          {r.sample.id!==i.id&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2}}>Pitched in {SellerCatalogue.format(i)}; taste it from the 750ml.</div>}
        </div>
        <div style={{textAlign:'right',flexShrink:0}}>
          <div style={{fontSize:14,fontFamily:C.P,color:r.cold?'#9CC9F5':T.ink2}}>{r.chill}{r.temp?` · ${r.temp}°C`:''}</div>
          <div style={{fontSize:13,fontFamily:C.P,color:r.toHand?T.mid:'#F2B84B',marginTop:2}}>{r.toHand?`${r.supply.n} cs in the warehouse`:r.supply.line}</div>
        </div>
      </div>; })}
      {!K.rows.length&&<div style={{padding:'18px 16px',fontSize:14,fontFamily:C.P,color:T.mid}}>No bottle fits that well. Lower the fit.</div>}
    </div>
    <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5,marginTop:12}}>Fit is the reasons added up, not a forecast. Serving temperatures are from the product sheet where it gives one.</div>
  </div>; }
Object.assign(window,{SellerBring,SellerLogo,SellerBrief,SellerShortlist,SellerCatalogueTab,SellerSheet,SellerWineCard,_S_FLAT,_sFit});
