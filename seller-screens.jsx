/* Vinterest Seller's screens (docs/seller.md): the visit brief for one prospect restaurant, in the Teams console's
   new look (flat black, hairline squares, Poppins 300 headlines, small spaced capitals, gold for the accent).
   Every figure is SellerMatch's; the screens only draw it. */
const _S_FLAT={..._DECK_DARK,flat:true,bg:'#000'};
const _sAcc=()=>TeamBrand.GOLD;
const _sLine='rgba(255,255,255,0.09)';
const _sCaps={fontFamily:C.P,fontWeight:500,textTransform:'uppercase',letterSpacing:'0.1em',fontSize:'12px'};
/* What a reason rests on: the restaurant's own list, the agency's product sheet, or an estimate of ours. */
const _S_BASIS={list:{label:'Their list',col:'#FFFFFF'},sheet:{label:'Product sheet',col:'#D4A84B'},estimate:{label:'Our estimate',col:'#8C8C92'}};
const _sTypeCol=(T,type)=>T.lift(_TYPE_COLORS[{rosé:'rose',sweet:'dessert'}[type]||type]||_TYPE_COLORS.red);
const _sRule=(T,type)=>({boxShadow:`inset 3px 0 0 ${_sTypeCol(T,type)}`});
function _SCard({title,right,children,testid,feat,style,id}){ const T=useTheme(), acc=_sAcc();
  return <div id={id} data-testid={testid} style={{border:`1px solid ${feat?_alpha(acc,0.4):_sLine}`,background:feat?_alpha(acc,0.06):'rgba(255,255,255,0.025)',padding:'18px 20px',minWidth:0,...style}}>
    {(title||right)&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,marginBottom:12}}><div style={{..._sCaps,color:feat?acc:T.mid}}>{title}</div>{right&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid}}>{right}</div>}</div>}
    {children}</div>; }
function _SBasis({b}){ const x=_S_BASIS[b]; if(!x) return null; return <span data-cap title={x.label} style={{display:'inline-flex',alignItems:'center',gap:5,..._sCaps,fontSize:'10px',color:'rgba(255,255,255,0.5)',whiteSpace:'nowrap'}}><span style={{width:6,height:6,background:x.col,flexShrink:0}}/>{x.label}</span>; }
function _SLegend(){ return <div data-testid="seller-legend" style={{display:'flex',gap:'6px 18px',flexWrap:'wrap'}}>{Object.keys(_S_BASIS).map(k=><_SBasis key={k} b={k}/>)}</div>; }
function _SScore({f,small}){ const T=useTheme(), acc=_sAcc(), lead=f.score>=SellerMatch.LEAD, col=lead?acc:f.score>=SellerMatch.SHOW?T.ink:T.mid, s=small?46:68;
  return <div data-testid="seller-score" aria-label={`Fit ${f.score} out of 100: ${f.word}`} style={{width:s,height:s,flexShrink:0,border:`1px solid ${lead?acc:'rgba(255,255,255,0.22)'}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1}}>
    <span style={{fontSize:small?'18px':'26px',fontWeight:300,fontFamily:C.P,color:col,lineHeight:1}}>{f.score}</span>{!small&&<span style={{..._sCaps,fontSize:'9px',color:T.mid}}>Fit</span>}</div>; }
function _STag({text,tone}){ const col=tone||'#FFFFFF'; return <span data-pill style={{..._sCaps,fontSize:'11px',padding:'3px 8px',border:`1px solid ${_alpha(col,0.5)}`,background:_alpha(col,0.1),color:'#fff',whiteSpace:'nowrap'}}>{text}</span>; }
const _S_TONE={ladder:'#9CC9F5',call:'#F2B84B',glass:'#6FD79C',dish:'#F58B7C',window:'#C9A6F5',mix:'#9CC9F5',format:'#8C8C92',house:'#D4A84B'};
function _STile({label,value,note,testid}){ const T=useTheme(); return <div data-testid={testid} style={{border:`1px solid ${_sLine}`,padding:'14px 16px',minWidth:0}}>
    <div style={{..._sCaps,color:T.mid}}>{label}</div><div style={{fontSize:26,fontWeight:300,fontFamily:C.P,color:T.ink,marginTop:6,lineHeight:1.15}}>{value}</div>{note&&<div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:4,lineHeight:1.4}}>{note}</div>}</div>; }
const _sName=i=>SellerCatalogue.label(i)+(SellerCatalogue.format(i)?' · '+SellerCatalogue.format(i):'');
const _sCost=i=>`${SellerCatalogue.money(i.price,2)} a bottle · case of ${i.ucs} ${SellerCatalogue.money(SellerCatalogue.caseCost(i),2)}`;
function _SWineChip({f,onClick}){ const T=useTheme(); return <span role="button" data-pill data-testid="seller-chip" onClick={onClick} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'5px 10px',border:`1px solid ${_alpha(_sTypeCol(T,f.item.type),0.7)}`,fontSize:13,fontFamily:C.P,color:T.ink,cursor:'pointer',maxWidth:'100%'}}>
    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{SellerCatalogue.short(f.item)}{SellerCatalogue.format(f.item)?' '+SellerCatalogue.format(f.item):''}</span><span style={{color:f.score>=SellerMatch.LEAD?_sAcc():T.mid,fontWeight:500}}>{f.score}</span></span>; }
function _SLogo({height=30}){ const b=(TeamData.get().venue||{}).brand, [bad,setBad]=React.useState(false); const name=(TeamData.get().venue||{}).name||'';
  return b&&b.logo&&!bad?<img src={'/team/'+b.logo} alt={name} onError={()=>setBad(true)} style={{height,maxWidth:180,objectFit:'contain',display:'block'}}/>:<span style={{fontSize:20,fontWeight:500,fontFamily:C.P}}>{name}</span>; }

/* ---- the brief ---- */
function SellerBrief({B,go}){ const T=useTheme(), acc=_sAcc(), [ref,w]=_c2Width(), two=w>=900, M=n=>TeamData.money(Math.round(n));
  const open=B.openings.filter(o=>o.wines.length), shut=B.openings.filter(o=>!o.wines.length), lead=B.shortlist.filter(f=>f.score>=SellerMatch.LEAD);
  return <div ref={ref} data-testid="seller-brief">
    <div style={{marginBottom:22}}>
      <div style={{fontSize:15,fontFamily:C.P}}><span style={{color:acc,fontWeight:500}}>Visit brief</span><span style={{color:T.mid}}> · {B.venue.name}, {B.venue.city}</span></div>
      <div data-testid="seller-fact" style={{fontSize:two?38:28,lineHeight:1.15,fontWeight:300,letterSpacing:'-0.015em',fontFamily:C.P,marginTop:6}}>{B.venue.name}'s list leaves <span style={{fontWeight:500,color:acc}}>{open.length} openings</span> this catalogue can answer.</div>
      <div style={{display:'flex',gap:'6px 26px',flexWrap:'wrap',marginTop:10}}>{[`${lead.length} bottle${lead.length===1?'':'s'} to lead with`,`${B.ours.length} of ours already on their list`,`${B.ruled} of ${B.catalogue} listings ruled out before the meeting`].map((t,i)=><div key={i} style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:6,height:6,background:acc}}/><span style={{fontSize:15,fontWeight:300,color:T.ink2,fontFamily:C.P}}>{t}</span></div>)}</div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${two?4:2},minmax(0,1fr))`,gap:0,marginBottom:16}}>
      <_STile testid="seller-kpi-open" label="Openings" value={`${open.length} of ${B.openings.length}`} note="found on their list and menu that we can answer"/>
      <_STile label="Bottles that fit" value={B.fits} note={`of ${B.catalogue} listings; ${B.ruled} can't go on this list`}/>
      <_STile label="Their multiple" value={`${B.multiple.low.toFixed(1)}× to ${B.multiple.high.toFixed(1)}×`} note={`on a ${SellerCatalogue.money(20)} bottle down to a ${SellerCatalogue.money(100)} one, from ${B.multiple.points} of their wines we can price`}/>
      <_STile label="Their glass" value={`Bottle ÷ ${B.glassRatio.toFixed(1)}`} note="what they charge for a glass of a bottle they also sell whole"/>
    </div>
    <div style={{display:'grid',gridTemplateColumns:two?'minmax(0,1.5fr) minmax(0,1fr)':'minmax(0,1fr)',gap:16,alignItems:'start'}}>
      <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
        <_SCard feat title="Lead with" right={<span role="button" data-testid="seller-all-short" onClick={()=>go('shortlist')} style={{cursor:'pointer',color:acc}}>All {B.shortlist.length} →</span>} testid="seller-lead">
          {B.shortlist.slice(0,3).map((f,i)=><div key={f.item.id} role="button" onClick={()=>go('shortlist',f.item.id)} style={{display:'flex',gap:14,alignItems:'center',padding:'12px 0',borderTop:i?`1px solid ${_sLine}`:'none',cursor:'pointer'}}>
            <_SScore f={f} small/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:16,fontWeight:500,fontFamily:C.P}}>{_sName(f.item)}</div>
              <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,marginTop:2,lineHeight:1.45}}>{f.reasons[0].text}. {f.pitch.where}</div></div>
          </div>)}
        </_SCard>
        <_SCard title="What their list leaves open" right={`${open.length} we can answer`} testid="seller-openings">
          {open.map((o,i)=><div key={o.k} data-testid="seller-opening" style={{padding:'13px 0',borderTop:i?`1px solid ${_sLine}`:'none'}}>
            <div style={{display:'flex',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><_STag text={o.tag} tone={_S_TONE[o.kind]}/><span style={{fontSize:16,fontWeight:500,fontFamily:C.P}}>{o.title}</span></div>
            <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginTop:6}}>{o.fact}</div>
            {(o.vinny||[]).slice(0,1).map((v,j)=><div key={j} style={{fontSize:14,fontFamily:C.P,color:T.mid,lineHeight:1.5,marginTop:4}}>Vinny's read of their list: {v}</div>)}
            <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:9}}>{o.wines.slice(0,4).map(f=><_SWineChip key={f.item.id} f={f} onClick={()=>go(B.shortlist.some(s=>s.item.id===f.item.id)?'shortlist':'catalogue',f.item.id)}/>)}{o.wines.length>4&&<span style={{fontSize:13,fontFamily:C.P,color:T.mid,alignSelf:'center'}}>+{o.wines.length-4} more</span>}</div>
          </div>)}
        </_SCard>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16,minWidth:0}}>
        {B.ours.length>0&&<_SCard title="Already on their list" testid="seller-ours">
          {B.ours.map(o=><div key={o.item.id}>
            <div style={{fontSize:16,fontWeight:500,fontFamily:C.P}}>{TeamData.label(o.wine)}</div>
            <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginTop:4}}>On their list at {M(o.bottle)}. It's {SellerCatalogue.money(o.item.price,2)} from us, so they put {o.x.toFixed(1)}× on it: the one multiple here that isn't an estimate.</div>
            {o.next.length>0&&<div style={{marginTop:10}}><div style={{..._sCaps,color:T.mid,marginBottom:7}}>Next from the same house</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{o.next.map(f=><_SWineChip key={f.item.id} f={f} onClick={()=>go('catalogue',f.item.id)}/>)}</div></div>}
          </div>)}
        </_SCard>}
        <_SCard title="How to read the fit" testid="seller-how">
          <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.55}}>Fit is the reasons for a bottle added up, less what counts against it. It is not a forecast of a sale: there is no sales history behind it yet. {SellerMatch.LEAD} and over is a bottle to lead with, {SellerMatch.SHOW} and over one worth showing.</div>
          <div style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.55,margin:'8px 0 10px'}}>Each reason is marked with what it rests on. Where a bottle lands on their list, and its body and tannin, are our estimates.</div>
          <_SLegend/>
        </_SCard>
        {(B.cocktailWines.length>0||B.backBar.some(x=>x.uses.length))&&<_SCard title="Their cocktails" testid="seller-bar">
          {B.cocktailWines.map((x,i)=><div key={'w'+i} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginBottom:8}}><span style={{color:T.ink,fontWeight:500}}>{x.cocktail.name}</span> is made with {String(x.ingredient).toLowerCase()}: {x.wines.map(i=>SellerCatalogue.short(i)).join(' or ')} could be the pour.</div>)}
          {B.backBar.filter(x=>x.uses.length).map(x=><div key={x.item.id} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,marginBottom:8}}><span style={{color:T.ink,fontWeight:500}}>{x.uses.map(u=>u.cocktail.name).join(' and ')}</span> use{x.uses.length===1?'s':''} {x.category}, and the menu names {[...new Set(x.uses.map(u=>u.ingredient))].join(' and ')}. Ours is {SellerCatalogue.short(x.item)} at {SellerCatalogue.money(x.item.price,2)}.</div>)}
          <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5}}>The brands a menu names say who supplies the back bar today.</div>
        </_SCard>}
        {shut.length>0&&<_SCard title="Openings we can't answer" right={shut.length} testid="seller-shut">
          {shut.map((o,i)=><div key={o.k} style={{fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5,padding:'7px 0',borderTop:i?`1px solid ${_sLine}`:'none'}}>{o.title}</div>)}
          <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5,marginTop:8}}>Nothing in the catalogue fits these at their prices. Worth knowing before they ask.</div>
        </_SCard>}
      </div>
    </div>
  </div>; }

/* ---- one bottle's pitch ---- */
function SellerBottle({f,focus}){ const T=useTheme(), acc=_sAcc(), i=f.item, P=f.pitch, ref=React.useRef(null), sup=SellerCatalogue.supply(i), m=P.maths, [r2,w]=_c2Width(), two=w>=760;
  React.useEffect(()=>{ if(focus&&ref.current&&ref.current.scrollIntoView) ref.current.scrollIntoView({block:'start'}); },[focus]);
  const sec=(label,body)=><div style={{marginTop:16}}><div style={{..._sCaps,color:T.mid,marginBottom:7}}>{label}</div>{body}</div>, line={fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.55};
  return <div ref={ref} data-testid="seller-bottle" data-id={i.id} style={{border:`1px solid ${focus?_alpha(acc,0.5):_sLine}`,background:'rgba(255,255,255,0.025)',padding:'20px 22px',..._sRule(T,i.type)}}><div ref={r2}>
    <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
      <_SScore f={f}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:'flex',gap:10,alignItems:'baseline',flexWrap:'wrap'}}><span style={{..._sCaps,color:f.score>=SellerMatch.LEAD?acc:T.mid}}>{f.word}</span>{P.primary&&<_STag text={P.primary.tag} tone={_S_TONE[P.primary.kind]}/>}</div>
        <div style={{fontSize:22,fontWeight:300,fontFamily:C.P,lineHeight:1.2,marginTop:5}}>{_sName(i)}</div>
        <div style={{fontSize:14,fontFamily:C.P,color:T.mid,marginTop:4,lineHeight:1.45}}>{[i.appellation||i.region,i.country].filter(Boolean).join(', ')}{f.shape.grapes.length?` · ${f.shape.grapes.slice(0,3).join(', ')}`:''}{i.basis.grapes==='estimate'?' (typical, not on the sheet)':''} · {i.listingLabel}</div>
      </div>
    </div>
    <div style={{display:'grid',gridTemplateColumns:`repeat(${two?3:1},minmax(0,1fr))`,gap:0,marginTop:16}}>
      <_STile label="Costs them" value={SellerCatalogue.money(i.price,2)} note={`Case of ${i.ucs}: ${SellerCatalogue.money(m.cost,2)}`}/>
      <_STile label="Lands at" value={['sweet','fortified'].includes(f.shape.kind)?'By the 2oz glass':`About ${TeamData.money(f.landing.bottle)}`} note={['sweet','fortified'].includes(f.shape.kind)?'priced like their other dessert pour':`${f.landing.x.toFixed(1)}× its cost${f.landing.lifted?', at their entry price':', their usual on a bottle like it'}`}/>
      <_STile label="Supply" value={sup.k==='now'?`${sup.n} cases`:sup.k==='store'?'LCBO only':sup.k==='transit'?`${sup.n} on the way`:sup.line} note={sup.k==='now'?'in the agency warehouse':sup.k==='store'?'nothing in the agency warehouse':'check before the meeting'}/>
    </div>
    {sec('Where it goes',<div style={line}>{P.where}{m.take?` A case takes about ${TeamData.money(m.take)} ${m.by==='glass'?`poured by the glass (${m.pours} glasses)`:'sold by the bottle'}, against ${SellerCatalogue.money(m.cost,2)} in.`:''}</div>)}
    {sec('Why it fits',<div>{f.reasons.map((r,k)=><div key={k} data-testid="seller-reason" style={{display:'flex',gap:'2px 10px',flexWrap:'wrap',alignItems:'baseline',padding:'6px 0',borderTop:k?`1px solid ${_sLine}`:'none'}}>
      <span style={{width:34,flexShrink:0,textAlign:'right',fontSize:14,fontFamily:C.P,fontWeight:500,color:r.pts>0?'#6FD79C':'#F58B7C'}}>{r.pts>0?'+':'−'}{Math.abs(r.pts)}</span>
      <span style={{flex:'1 1 220px',minWidth:0,...line,color:T.ink}}>{r.text}</span><span style={{marginLeft:44}}><_SBasis b={r.basis}/></span></div>)}</div>)}
    {P.together.length>0&&sec('Better together',<div>{P.together.map((t,k)=><div key={k} style={{...line,marginBottom:5}}>{t}</div>)}</div>)}
    {P.say.length>0&&sec('From the product sheet',<div>{P.say.map((t,k)=><div key={k} style={{...line,marginBottom:5}}>{t}</div>)}</div>)}
    {P.objections.length>0&&sec('If they push back',<div>{P.objections.map((o,k)=><div key={k} style={{marginBottom:9}}><div style={{...line,color:T.ink,fontWeight:500}}>{o.q}</div><div style={line}>{o.a}</div></div>)}</div>)}
  </div></div>; }
function SellerShortlist({B,focus}){ const T=useTheme();
  return <div data-testid="seller-shortlist">
    <div style={{marginBottom:20}}><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>{B.shortlist.length} bottles to take to <span style={{fontWeight:500,color:_sAcc()}}>{B.venue.name}</span>.</div>
      <div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8,lineHeight:1.5}}>Best fit first, with no more than {SellerMatch.PER_HOUSE} from one house or {SellerMatch.PER_OPEN} for the same opening, so the visit covers the list.</div>
      <div style={{marginTop:12}}><_SLegend/></div></div>
    <div style={{display:'flex',flexDirection:'column',gap:16}}>{B.shortlist.map(f=><SellerBottle key={f.item.id} f={f} focus={focus===f.item.id}/>)}</div>
  </div>; }

/* ---- the whole catalogue against this list ---- */
function SellerCatalogueTab({B,focus}){ const T=useTheme(), acc=_sAcc(), all=SellerMatch.all(), [f,setF]=React.useState(focus?'all':'fit'), [openId,setOpenId]=React.useState(focus||null), ref=React.useRef({});
  const groups={fit:all.filter(x=>!x.out&&x.fills.length),none:all.filter(x=>!x.out&&!x.fills.length),out:all.filter(x=>x.out),all};
  React.useEffect(()=>{ const el=focus&&ref.current[focus]; if(el&&el.scrollIntoView) el.scrollIntoView({block:'center'}); },[focus]);
  const chip=(k,label)=><span key={k} role="button" data-pill data-testid={'seller-filter-'+k} aria-pressed={f===k} onClick={()=>setF(k)} style={{..._sCaps,padding:'6px 11px',border:`1px solid ${f===k?acc:'rgba(255,255,255,0.22)'}`,background:f===k?acc:'transparent',color:f===k?inkOn(acc):T.ink,cursor:'pointer',whiteSpace:'nowrap'}}>{label} {groups[k].length}</span>;
  return <div data-testid="seller-catalogue">
    <div style={{marginBottom:18}}><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>{B.agency.name}: <span style={{fontWeight:500,color:acc}}>{groups.fit.length} of {all.length}</span> listings have a place here.</div>
      <div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8}}>{B.agency.market} catalogue as of {new Date(B.agency.fetched+'T12:00:00').toLocaleDateString('en-CA',{day:'numeric',month:'long',year:'numeric'})}. A row opens its reasons.</div></div>
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>{chip('fit','Fit')}{chip('none','No opening')}{chip('out','Ruled out')}{chip('all','All')}</div>
    <div style={{border:`1px solid ${_sLine}`}}>{groups[f].map((x,k)=>{ const i=x.item, on=openId===i.id, sup=SellerCatalogue.supply(i);
      return <div key={i.id} ref={el=>{ ref.current[i.id]=el; }} data-testid="seller-row" data-id={i.id} style={{borderTop:k?`1px solid ${_sLine}`:'none',..._sRule(T,i.type),background:on?'rgba(255,255,255,0.04)':'transparent'}}>
        <div role="button" aria-expanded={on} onClick={()=>setOpenId(on?null:i.id)} style={{display:'flex',gap:14,alignItems:'center',padding:'11px 16px',cursor:'pointer'}}>
          <div style={{width:40,flexShrink:0,textAlign:'center',fontSize:18,fontWeight:300,fontFamily:C.P,color:x.out?T.mid:x.score>=SellerMatch.LEAD?acc:T.ink}}>{x.out?'–':x.score}</div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:15,fontWeight:500,fontFamily:C.P}}>{_sName(i)}</div>
            <div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2,lineHeight:1.4}}>{x.out?x.out:x.fills.length?x.reasons[0].text:'Fits their prices, but fills nothing their list is missing'}</div></div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:15,fontFamily:C.P}}>{SellerCatalogue.money(i.price,2)}</div><div style={{fontSize:13,fontFamily:C.P,color:T.mid,marginTop:2}}>{sup.k==='now'?`${sup.n} cs`:sup.k==='store'?'LCBO':sup.k==='transit'?'On the way':sup.k==='order'?'On order':'None'}</div></div>
        </div>
        {on&&<div style={{padding:'0 16px 14px 70px'}}>
          <div style={{fontSize:13,fontFamily:C.P,color:T.mid,lineHeight:1.5}}>{[i.appellation||i.region,i.country].filter(Boolean).join(', ')}{x.shape.grapes.length?` · ${x.shape.grapes.slice(0,4).join(', ')}`:''} · {i.listingLabel} · CSPC {i.cspc} · {_sCost(i)}{!x.out&&i.kind==='wine'&&!['sweet','fortified'].includes(x.shape.kind)?` · lands at about ${TeamData.money(x.landing.bottle)}`:''}</div>
          {x.reasons.map((r,j)=><div key={j} style={{display:'flex',gap:10,alignItems:'baseline',padding:'5px 0'}}><span style={{width:30,flexShrink:0,textAlign:'right',fontSize:14,fontFamily:C.P,fontWeight:500,color:r.pts>0?'#6FD79C':'#F58B7C'}}>{r.pts>0?'+':'−'}{Math.abs(r.pts)}</span><span style={{flex:1,fontSize:14,fontFamily:C.P,color:T.ink2,lineHeight:1.5}}>{r.text}</span><_SBasis b={r.basis}/></div>)}
        </div>}
      </div>; })}</div>
  </div>; }

/* ---- the cheat sheet: one page for the meeting ---- */
function SellerSheet({B}){ const T=useTheme(), acc=_sAcc(), ref=React.useRef(null), M=n=>TeamData.money(Math.round(n)), open=B.openings.filter(o=>o.wines.length);
  const print=()=>{ try{ const w=window.open('','_blank'); if(!w) return; w.document.write(`<!doctype html><title>${B.venue.name}: cheat sheet</title><link rel="stylesheet" href="/fonts/fonts.css"><body style="margin:24px;font-family:Poppins,sans-serif">${ref.current.outerHTML}</body>`); w.document.close(); setTimeout(()=>w.print(),400); }catch(e){} };
  const ink='#15110A', mid='#5c5c63', rule='#d9d6cf', cell={padding:'7px 8px',fontSize:'11px',lineHeight:1.4,verticalAlign:'top',borderTop:`1px solid ${rule}`,fontFamily:C.P,color:ink}, th={...cell,borderTop:'none',fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,textAlign:'left'};
  return <div data-testid="seller-sheet">
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:16,flexWrap:'wrap',marginBottom:18}}>
      <div><div style={{fontSize:30,lineHeight:1.15,fontWeight:300,fontFamily:C.P}}>One page for the <span style={{fontWeight:500,color:acc}}>meeting</span>.</div><div style={{fontSize:15,fontWeight:300,fontFamily:C.P,color:T.ink2,marginTop:8}}>What to know about their list, and each bottle in a line.</div></div>
      <TeamBtn primary onClick={print} testid="seller-print">Print</TeamBtn></div>
    <div style={{overflowX:'auto'}}><div ref={ref} data-testid="seller-paper" style={{background:'#fff',color:ink,padding:'26px 28px',minWidth:680,fontFamily:C.P}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:12,borderBottom:`2px solid ${ink}`,paddingBottom:8}}><div style={{fontSize:'20px',fontWeight:600}}>{B.venue.name} <span style={{fontWeight:300}}>· {B.venue.city}</span></div><div style={{fontSize:'10px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid}}>{B.agency.name} · {new Date().toLocaleDateString('en-CA',{day:'numeric',month:'short',year:'numeric'})}</div></div>
      <div style={{fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,margin:'14px 0 5px'}}>Their list in five lines</div>
      <div style={{fontSize:'11px',lineHeight:1.55,color:ink}}>
        <div>{TeamBuyer.wines().length} wines, {TeamBuyer.wines().filter(TeamData.byGlass).length} by the glass ({M(Math.min(...TeamBuyer.wines().filter(TeamData.byGlass).map(w=>SellerMatch._m(w.glass))))} to {M(Math.max(...TeamBuyer.wines().filter(TeamData.byGlass).map(w=>SellerMatch._m(w.glass))))}); bottles from {M(Math.min(...TeamBuyer.wines().map(w=>SellerMatch._m(w.bottle)).filter(Boolean)))}.</div>
        <div>They put about {B.multiple.low.toFixed(1)}× on a {SellerCatalogue.money(20)} bottle and {B.multiple.high.toFixed(1)}× on a {SellerCatalogue.money(100)} one (our estimate{B.multiple.exact?`, checked against ${B.ours.map(o=>TeamData.nick(o.wine)).join(', ')}`:''}).</div>
        {B.ours.map(o=><div key={o.item.id}>Already ours: {TeamData.short(o.wine)} at {M(o.bottle)}.</div>)}
        {open.slice(0,3).map(o=><div key={o.k}>{o.title}.</div>)}
      </div>
      <div style={{fontSize:'9px',letterSpacing:'0.1em',textTransform:'uppercase',color:mid,fontWeight:500,margin:'16px 0 2px'}}>The bottles</div>
      <table style={{width:'100%',borderCollapse:'collapse'}}><thead><tr><th style={{...th,width:28}}>Fit</th><th style={th}>Bottle</th><th style={{...th,width:74}}>Cost / case</th><th style={{...th,width:84}}>On their list</th><th style={th}>Why</th><th style={th}>Pour it with</th></tr></thead>
        <tbody>{B.shortlist.map(f=>{ const i=f.item, sweet=['sweet','fortified'].includes(f.shape.kind), glass=f.fills.some(o=>o.kind==='glass')&&!sweet; return <tr key={i.id} data-testid="seller-sheet-row">
          <td style={{...cell,fontWeight:600}}>{f.score}</td>
          <td style={cell}><div style={{fontWeight:600}}>{_sName(i)}</div><div style={{color:mid}}>{[i.appellation||i.region,i.country].filter(Boolean).join(', ')} · CSPC {i.cspc}</div></td>
          <td style={cell}>{SellerCatalogue.money(i.price,2)}<div style={{color:mid}}>{i.ucs} × {SellerCatalogue.money(f.pitch.maths.cost,2)}</div></td>
          <td style={cell}>{sweet?'2oz glass':`About ${M(f.landing.bottle)}`}{glass&&<div style={{color:mid}}>{M(f.landing.glass)} a glass</div>}</td>
          <td style={cell}>{f.reasons.filter(r=>r.pts>0).slice(0,2).map((r,k)=><div key={k}>{r.text}.</div>)}</td>
          <td style={cell}>{f.suits.slice(0,3).map(s=>s.dish.name).join(', ')||'–'}</td></tr>; })}</tbody></table>
      <div style={{fontSize:'9px',color:mid,marginTop:12,lineHeight:1.5}}>Fit is the reasons added up, not a forecast. List prices and style are estimates; costs, pack sizes and stock are from the {B.agency.short} catalogue of {B.agency.fetched}.</div>
    </div></div>
  </div>; }
Object.assign(window,{SellerBrief,SellerShortlist,SellerCatalogueTab,SellerSheet,_S_FLAT});
