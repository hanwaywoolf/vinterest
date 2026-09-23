/* Vinterest — ScanFlow: the non-UI parts of the scan result screen.

   Which path the user usually takes (the quick result or the full card deck), how a scanned
   wine maps onto one already saved, price context in their currency, and turning a Blind Call
   guess into the "compared with the label" taps the rating step offers. */
const ScanFlow = {
  PATH_KEY:'vinterest_scan_path',

  /* Quick (rate/save from the result) vs deck ("Tell me about it"). After a couple of deck
     visits, and more of those than quick exits, the deck opens straight after a scan. */
  path(){ try{ return {deck:0,quick:0,...JSON.parse(localStorage.getItem(this.PATH_KEY)||'{}')}; }catch(e){ return {deck:0,quick:0}; } },
  recordPath(kind){ const p=this.path(); p[kind]=(p[kind]||0)+1; try{ localStorage.setItem(this.PATH_KEY,JSON.stringify(p)); }catch(e){} },
  prefersDeck(){ const p=this.path(); return p.deck>=2&&p.deck>p.quick; },

  /* A fresh scan of a wine already saved under a slightly different name takes the saved
     identity, so scores and history stay on one entry. */
  resolve(wine){
    if(!wine||!wine.name) return {wine,existing:null};
    const existing=WineHistory.find(wine);
    if(!existing) return {wine,existing:null};
    return {wine:{...wine,name:existing.name,vintage:existing.vintage},existing};
  },
  /* Only a label Claude couldn't read clearly is worth a "Is this it?" check. */
  needsConfirm(wine,source){
    return source!=='list'&&!!wine&&(wine.confidence==='low'||wine.confidence==='medium');
  },

  /* XP for a scan: the scan itself, weekly streak, and firsts (type, country, grape). */
  awardScanXP(wine){
    try{ XPSystem.awardAndToast([
      {type:'scan'},{type:'weekly_scans'},
      {type:'first_type',value:wine.type},
      {type:'first_country',value:wine.country},
      // A grape that was only guessed for the wine isn't a grape they've met.
      ...(wine.grapes_basis==='typical'?[]:[{type:'new_grape',value:(wine.grapes||[])[0]}]),
      ...((wine.price_usd||0)>=100?[{type:'expensive_wine',wineKey:(wine.name||'')+'_'+(wine.vintage||'')}]:[])
    ]); }catch(e){}
  },

  /* Claude's shop-price estimate from the label scan, converted to the user's currency, or null. */
  shopPrice(wine,curr){
    curr=curr||Regional.current();
    return wine&&wine.price_usd>0?Math.round(wine.price_usd*(USD_FX[curr.code]||1)):null;
  },
  /* The shop price to compare against: {mid, tier?, note?}. The label scan's price is one rough
     field among twenty, so the dedicated price lookup (fetchRetailEstimate: this producer and
     cuvée, in the user's market and currency, cached per wine) is used whenever it answers; the
     label figure is the instant placeholder and the fallback. In Travel Mode that lookup is what
     gives local prices (Bordeaux costs less in France than a converted US price suggests). */
  shopEstimate(wine,curr){
    curr=curr||Regional.current();
    const label=this.shopPrice(wine,curr);
    return fetchRetailEstimate(wine,curr).then(d=>d&&d.mid!=null?d:(label!=null?{mid:label}:null)).catch(()=>label!=null?{mid:label}:null);
  },
  money(v,curr){ curr=curr||Regional.current(); return v!=null?`${curr.base}${Math.round(v).toLocaleString()}`:null; },
  /* A restaurant list price against the shop estimate. */
  markup(listPrice,shop){
    if(!(listPrice>0)||!(shop>0)) return null;
    const ratio=listPrice/shop;
    return {ratio,text:ratio>=3?'A steep markup on the shop price.':ratio>=2?'A typical restaurant markup.':'A gentle markup: good value on a list.'};
  },

  /* The words for "lighter / as expected / fuller than the label" on each axis. */
  COMPARE:{body:['Lighter','Fuller'],tannins:['Softer','Grippier'],acidity:['Softer','Zingier'],texture:['Crisper','Richer'],sweetness:['Drier','Sweeter']},
  compareAxes(wine){
    const t=WineDNA._t(wine&&wine.type);
    const axes=['red','orange','fortified'].includes(t)?['body','tannins','acidity']:['body','acidity','texture'];
    return axes.filter(k=>typeof (wine&&wine[k])==='number');
  },
  blindKey(wine){ return 'vinterest_blindcall_result_'+((wine.name||'')+'_'+(wine.vintage||'nv')).replace(/\s/g,'_'); },
  /* A Blind Call is the user's own read of the wine as they taste it, so it pre-fills the
     comparison: more than 0.2 either side of the label estimate counts as lighter/fuller. */
  tastedFromBlindCall(wine){
    let r=null; try{ r=JSON.parse(localStorage.getItem(this.blindKey(wine))||'null'); }catch(e){}
    if(!r||!r.guess) return null;
    const out={};
    this.compareAxes(wine).forEach(k=>{ const g=r.guess[k]; if(typeof g!=='number') return; const d=g-wine[k]; out[k]=d>0.2?1:d<-0.2?-1:0; });
    return Object.keys(out).length?out:null;
  },
};
