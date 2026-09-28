/* Vinterest — ScanFlow: the non-UI parts of the scan result screen.

   How a scanned wine maps onto one already saved, price context in their currency, and turning a Blind Call
   guess into the "compared with the label" taps the rating step offers. */
const ScanFlow = {
  /* A wine saved from a wine list has no tasting notes or food pairings (the list prompt only reads
     name, type, region, grape and style), and often no grapes. Its screen fills them in once
     (purpose wine_details, prompts/wine-details.txt) and they're saved onto the wine, so it never
     asks again. Grapes it adds are the ones the wine is usually made from: grapes_basis 'typical'. */
  needsDetails(w){ return !!(w&&w.name)&&!((w.tasting_notes||[]).length); },
  _detailsAsked:{},
  async fillDetails(w){
    if(!this.needsDetails(w)) return w;
    const key=(w.name+'|'+(w.vintage||'')).toLowerCase();
    if(this._detailsAsked[key]) return this._detailsAsked[key];
    const run=(async()=>{
      const about=[w.name,w.producer&&`by ${w.producer}`,w.vintage>0?String(w.vintage):'NV',w.type&&`(${w.type})`,
        [w.region,w.country].filter(Boolean).join(', '),(w.grapes||[]).length?`grapes: ${w.grapes.join(', ')}`:''].filter(Boolean).join(' ');
      const prompt=ContentEngine.fillTpl(_loadTextSync('prompts/wine-details.txt'),{wine:about});
      const text=await window.claude.complete({purpose:'wine_details',messages:[{role:'user',content:prompt}]});
      let c=String(text||'').replace(/```json|```/g,'').trim(); const a=c.indexOf('{'), b=c.lastIndexOf('}');
      const d=JSON.parse(a>=0&&b>a?c.slice(a,b+1):c);
      const list=(x)=>(Array.isArray(x)?x:[]).map(v=>String(v||'').trim()).filter(Boolean).slice(0,3);
      const patch={tasting_notes:list(d.tasting_notes)};
      if(!patch.tasting_notes.length) throw new Error('no tasting notes');
      if(!(w.food_pairings||[]).length) patch.food_pairings=list(d.food_pairings);
      if(!(w.grapes||[]).length){ const g=WineDNA.cleanGrapes(Array.isArray(d.grapes)?d.grapes:[]); if(g.grapes.length) Object.assign(patch,{grapes:g.grapes,blend:g.grapes.length>1,grapes_basis:'typical'}); }
      const saved=WineHistory.find(w);
      if(saved) WineHistory.update(saved.name,saved.vintage,patch);
      return {...w,...patch};
    })();
    this._detailsAsked[key]=run;
    run.catch(()=>{ delete this._detailsAsked[key]; });
    return run;
  },

  /* A fresh scan of a wine already saved under a slightly different name takes the saved
     identity, so scores and history stay on one entry. It also keeps the saved reading of the
     label (style, grapes, region): Claude's estimates vary a little from scan to scan, and the
     same bottle shouldn't get a different match each time it's scanned. Corrections go through Edit. */
  STABLE_FIELDS:['type','body','tannins','acidity','sweetness','texture','effervescence','grapes','blend','grapes_basis','region','sub_region','country'],
  resolve(wine){
    if(!wine||!wine.name) return {wine,existing:null};
    const existing=WineHistory.find(wine);
    if(!existing) return {wine,existing:null};
    const kept={};
    this.STABLE_FIELDS.forEach(k=>{ const v=existing[k]; if(v!=null&&v!==''&&!(Array.isArray(v)&&!v.length)) kept[k]=v; });
    return {wine:{...wine,...kept,name:existing.name,vintage:existing.vintage},existing};
  },
  /* Only a label Claude couldn't read clearly is worth a "Is this it?" check. */
  needsConfirm(wine,source){
    return source!=='list'&&!!wine&&(wine.confidence==='low'||wine.confidence==='medium');
  },

  /* XP for a scan: the scan itself, weekly streak, and firsts (type, country, grape). With
     {defer:true} (onboarding) the toasts wait for flushToasts(), so they don't cover the
     questions and instead greet the user on Home. */
  _deferred:[],
  flushToasts(){ const a=this._deferred; this._deferred=[]; if(a.length) setTimeout(()=>XPSystem.toast(a),600); },
  awardScanXP(wine,opts){
    const defer=opts&&opts.defer;
    try{ const a=XPSystem[defer?'award':'awardAndToast']([
      {type:'scan'},{type:'weekly_scans'},
      {type:'first_type',value:wine.type},
      {type:'first_country',value:wine.country},
      // A grape that was only guessed for the wine isn't a grape they've met.
      ...(wine.grapes_basis==='typical'?[]:[{type:'new_grape',value:(wine.grapes||[])[0]}]),
      ...((wine.price_usd||0)>=100?[{type:'expensive_wine',wineKey:(wine.name||'')+'_'+(wine.vintage||'')}]:[])
    ]); if(defer&&a) this._deferred.push(...a); }catch(e){}
  },

  /* A confirmed scan opens the learning around the wine: its grape and region, within the free
     allowance (5 each, then Pro). */
  unlockLearning(wine){
    try{ GrapeUnlocks.unlockViaScan(wine); }catch(e){}
    try{ RegionUnlocks.unlock(Regions.resolve(wine)); }catch(e){}
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
  /* Blind Call: played once per wine; the result keeps their guess for the rating step. */
  _blindDoneKey(wine){ return 'vinterest_blindcall_'+((wine.name||'')+'_'+(wine.vintage||'nv')).replace(/\s/g,'_'); },
  blindPlayed(wine){ return !!Store.get(this._blindDoneKey(wine)); },
  markBlindPlayed(wine){ Store.set(this._blindDoneKey(wine),'1'); },
  blindResult(wine){ return Store.getJSON(this.blindKey(wine),null); },
  saveBlindResult(wine,result){ Store.setJSON(this.blindKey(wine),result); },
  /* A Blind Call is the user's own read of the wine as they taste it, so it pre-fills the
     comparison: more than 0.2 either side of the label estimate counts as lighter/fuller. */
  tastedFromBlindCall(wine){
    let r=null; try{ r=JSON.parse(Store.get(this.blindKey(wine))||'null'); }catch(e){}
    if(!r||!r.guess) return null;
    const out={};
    this.compareAxes(wine).forEach(k=>{ const g=r.guess[k]; if(typeof g!=='number') return; const d=g-wine[k]; out[k]=d>0.2?1:d<-0.2?-1:0; });
    return Object.keys(out).length?out:null;
  },
};

/* The first scan is the end of onboarding: its story shows what Vinterest will do with this
   bottle and the ones after it, on the cards where each feature belongs. This is what those
   cards say, worked out from the user's own data (no Claude call). */
const FirstScan = {
  /* Where their WineDNA stands for this wine's type: scored so far and how many a match needs. */
  progress(wine,allWines){
    const t=TasteMatch._typeKey(wine), nouns=WineDNA.NOUNS[t]||['wine','wines'];
    const n=(allWines||[]).filter(w=>TasteMatch._typeKey(w)===t&&w.rating>0).length;
    const need=TasteMatch.MIN_SCORED;
    return {n:Math.min(n,need),need,left:Math.max(0,need-n),one:nouns[0],many:nouns[1],ready:n>=need};
  },
  /* A labelled example of a personal match, so the promise is concrete. Never shown as theirs. */
  example(wine){
    const p=this.progress(wine,[]);
    return {pct:92,label:'Likely a favourite',line:`You loved 5 of the 6 ${p.many} most like it`};
  },
  /* The quizzes this scan just opened in Learn (grape and region), for the "Where it's from" card. */
  unlocked(wine){
    const g=GrapeUnlocks.key((wine.grapes||[])[0]), r=Regions.resolve(wine);
    return {grape:g&&wine.grapes_basis!=='typical'&&GrapeUnlocks.isUnlocked(g)?g:null, region:r&&RegionUnlocks.isUnlocked(r)?r:null};
  },
};
