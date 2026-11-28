/* Vinterest Seller's shell (docs/seller.md): one prospect restaurant, read through the Teams modules, against one
   agency's catalogue. The prototype opens on Eloise (the Teams install, data/team-eloise*.json) and Authentic Wines &
   Spirits' Ontario catalogue (data/seller-awsm.json), whose logo sits top right (seller/brand/awsm.svg), with Seller's own (SellerLogo) top left. Booted
   instead of team-app.jsx (SELLER_ALL in scripts/app-sources.mjs); seller-store.js keeps everything in memory, so
   nothing here touches a device's Teams data. A bottle tapped anywhere opens its wine card over the page. */
const SELLER_TABS=[{k:'brief',label:'Brief'},{k:'shortlist',label:'Shortlist'},{k:'bring',label:'What to bring'},{k:'catalogue',label:'Catalogue'},{k:'sheet',label:'Cheat sheet'}];
function SellerApp(){ const T=_S_FLAT, acc=TeamBrand.GOLD, [tab,setTab]=React.useState('brief'), [focus,setFocus]=React.useState(null), [card,setCard]=React.useState(null), scrollRef=React.useRef(null), [badLogo,setBadLogo]=React.useState(false);
  // The brief is drawn again when its words change hands (Vinny wrote it, or the other writer was picked).
  const [words,setWords]=React.useState(0);
  React.useEffect(()=>{ const h=()=>setWords(n=>n+1); window.addEventListener('vinterest:seller-brief',h); return ()=>window.removeEventListener('vinterest:seller-brief',h); },[]);
  const B=React.useMemo(()=>SellerMatch.brief(),[words]);
  const phone=useLayoutSize()==='phone';
  const venue=<div data-testid="seller-venue" style={{fontFamily:C.P,minWidth:0}}>
    <div style={{fontSize:'11px',letterSpacing:'0.16em',textTransform:'uppercase',fontWeight:500,color:acc}}>Visit brief</div>
    <div style={{fontSize:22,fontWeight:300,color:T.ink,lineHeight:1.2,marginTop:2}}><span style={{fontWeight:500}}>{B.venue.name}</span><span style={{color:T.ink2}}> · {B.venue.city}</span></div></div>;
  const go=(k,id)=>{ setCard(null); setFocus(id||null); setTab(k); };
  // A tab opens at its top, unless it was opened on a bottle (which scrolls itself into view).
  React.useLayoutEffect(()=>{ if(scrollRef.current&&!focus) scrollRef.current.scrollTop=0; },[tab]);
  return <DeckTheme.Provider value={T}>
    <div data-testid="seller-root" style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',background:'#000',color:T.ink}}>
      <div style={{padding:'calc(env(safe-area-inset-top) + 14px) 24px 0',borderBottom:'1px solid rgba(255,255,255,0.09)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:16}}>
          {/* Seller's own logo top left, then whose visit this is, large enough to read at a glance. On a phone the two
              logos share the top row and the visit sits on its own line under them. */}
          <div style={{display:'flex',alignItems:'center',gap:22,minWidth:0}}>
            <SellerLogo size={phone?14:16}/>
            {!phone&&<div style={{paddingLeft:22,borderLeft:'1px solid rgba(255,255,255,0.18)',minWidth:0}}>{venue}</div>}
          </div>
          {/* The agency's own logo, in white on the dark page. */}
          <div data-testid="seller-agency" aria-label={`${B.agency.name}, ${B.agency.market}`} style={{flexShrink:0}}>{badLogo?<span style={{fontSize:15,fontFamily:C.P,color:T.ink2}}>{B.agency.name}</span>:<img src="/seller/brand/awsm.svg" alt={B.agency.name} onError={()=>setBadLogo(true)} style={{height:phone?22:30,maxWidth:200,display:'block',filter:'brightness(0) invert(1)'}}/>}</div>
        </div>
        {phone&&<div style={{marginTop:14}}>{venue}</div>}
        <div role="tablist" style={{display:'flex',gap:4,marginTop:14,overflowX:'auto'}}>{SELLER_TABS.map(t=><div key={t.k} role="tab" aria-selected={tab===t.k} data-testid={'seller-tab-'+t.k} onClick={()=>go(t.k)} style={{padding:'9px 14px 11px',fontSize:'12px',letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:500,fontFamily:C.P,color:tab===t.k?T.ink:T.mid,borderBottom:`2px solid ${tab===t.k?acc:'transparent'}`,cursor:'pointer',whiteSpace:'nowrap'}}>{t.label}{t.k==='shortlist'&&<span data-testid="seller-tab-count"> ({B.shortlist.length})</span>}</div>)}</div>
      </div>
      <div ref={scrollRef} data-scroll style={{flex:1,minHeight:0,overflowY:'auto',padding:'26px 24px calc(env(safe-area-inset-bottom) + 40px)'}}><div style={{maxWidth:1180,margin:'0 auto'}}><ScreenErrorBoundary>
        {tab==='brief'?<SellerBrief B={B} go={go} open={setCard}/>:tab==='shortlist'?<SellerShortlist key={focus||'all'} B={B} focus={focus} open={setCard}/>:tab==='bring'?<SellerBring B={B} open={setCard}/>:tab==='catalogue'?<SellerCatalogueTab B={B} open={setCard}/>:<SellerSheet B={B}/>}
      </ScreenErrorBoundary></div></div>
      {card&&<ScreenErrorBoundary><SellerWineCard id={card} close={()=>setCard(null)} open={setCard}/></ScreenErrorBoundary>}
    </div>
  </DeckTheme.Provider>; }
// The prospect: Eloise unless the address names another Teams restaurant (?venue=social). One without a buyer review
// (shop prices, `npm run team:buyer -- <seed>`) is matched on thinner evidence.
const SELLER_SEED=(()=>{ try{ const q=new URLSearchParams(location.search).get('venue'), k=q&&(TeamSample.ALIAS[q]||q); return k&&TeamSample.SEEDS[k]&&k!=='sample'?k:'eloise'; }catch(e){ return 'eloise'; } })();
TeamSample.load(SELLER_SEED);
TeamBrand.apply(true);
ReactDOM.createRoot(document.getElementById('root')).render(<SellerApp/>);
