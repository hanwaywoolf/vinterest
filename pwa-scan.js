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
      const patch={tasting_notes:WineDNA.capNotes(list(d.tasting_notes))};
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
  STABLE_FIELDS:['type','body','tannins','acidity','sweetness','texture','effervescence','grapes','blend','grapes_basis','grape_shares','region','sub_region','country'],
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
  COMPARE:{body:['Lighter','Fuller'],tannins:['Softer','Grippier'],acidity:['Softer','Zingier'],texture:['Crisper','Richer'],sweetness:['Drier','Sweeter'],effervescence:['Softer','Livelier']},
  /* What a Blind Call asks about, and what it pre-fills on the wine: the traits that matter for the
     type (tannins for reds, bubbles for sparkling, texture for whites), and only those the label
     scan gave a figure for. A trait with no figure is never asked: there'd be nothing to score the
     call against, and the wine's own screen couldn't show it (a sparkling wine has no texture). */
  compareAxes(wine){
    const t=WineDNA._t(wine&&wine.type);
    const axes=['red','orange','fortified'].includes(t)?['body','tannins','acidity']
      :t==='sparkling'?['body','acidity','effervescence']:['body','acidity','texture'];
    return axes.filter(k=>typeof (wine&&wine[k])==='number');
  },
  /* The reveal (ScanReveal, pwa-reveal.jsx): the few things worth knowing about a scan, as scenes
     that play for about fifteen seconds before the result. Everything here is already computed or
     checked: the match from TasteMatch, the traits from the label estimate, the grape and the
     place from knowledge.json, one line to say from the scan cards (Claude) once it has arrived.
     Nothing is invented for the sake of a scene: a scene without its facts is left out. */
  REVEAL_TRAITS:3,
  /* How long a scene stays: time to read its words at an unhurried READ_WPM, plus REVEAL_LEAD for
     the picture to arrive (the dial sweeping up, the pin dropping), never under REVEAL_MIN_MS. */
  READ_WPM:260, REVEAL_LEAD:1100, REVEAL_MIN_MS:2300,
  // Scenes whose picture takes longer to draw (the bunch and its callouts, the map closing in on
  // the pin, the glass and bubble) get that much more.
  REVEAL_EXTRA:{grape:1800,place:1400,say:1600},
  revealLength(text,key){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(this.REVEAL_MIN_MS,Math.round(this.REVEAL_LEAD+(this.REVEAL_EXTRA[key]||0)+words*60000/this.READ_WPM));
  },
  /* The vintage card's cache (the Details tab asks Claude for the drinking window once per wine). */
  vintageKey(wine){ return `vinterest_vintage_${(wine.name||'').replace(/\s/g,'_')}_${wine.vintage}`; },
  /* Where a dated bottle is in its life: the years it should drink best, and whether it's young,
     ready or past it today. Claude's window from the Details tab when that's been fetched
     (source 'claude'); otherwise a rough estimate from the type and the label's style, said as
     such: reds keep longer the fuller and grippier they are, fortified and sweet wines longest,
     rosé and light whites least. Sparkling: vintage ones keep, NV is for now. */
  drinkWindow(wine,now){
    const v=parseInt(wine&&wine.vintage,10); if(!v||v<1900) return null;
    const year=(now?new Date(now):new Date()).getFullYear();
    let from,to,source='estimate';
    const c=Cache.getText(this.vintageKey(wine)); let ci=null; try{ ci=c&&JSON.parse(c); }catch(e){}
    if(ci&&ci.peak_from>0&&ci.peak_to>=ci.peak_from){ from=+ci.peak_from; to=+ci.peak_to; source='claude'; }
    else {
      const t=WineDNA._t(wine.type), b=typeof wine.body==='number'?wine.body:0.6, tn=typeof wine.tannins==='number'?wine.tannins:0.5, tx=typeof wine.texture==='number'?wine.texture:0.4;
      const S={red:[2+Math.round(tn*3),5+Math.round((b+tn)*6)],white:[1+Math.round(tx*2),3+Math.round(tx*5)],rose:[0,2],sparkling:[2,8],orange:[1,6],dessert:[3,20],fortified:[3,30]}[t]||[1,4];
      from=v+S[0]; to=v+S[1];
    }
    const age=year-v, stage=year<from?'young':year<=to?'ready':'old';
    // Where today sits on a line from release to well past its best, 0 to 1 (the chart's marker).
    const span=Math.max(2,(to-v)*1.4), at=Math.max(0.02,Math.min(0.98,age/span));
    return {vintage:v,age,from,to,stage,source,at,fromAt:Math.min(0.96,(from-v)/span),toAt:Math.min(0.98,(to-v)/span),
      word:stage==='young'?'Still young':stage==='ready'?'Drinking well now':'Past its best',
      line:stage==='young'?`Best from ${from}${to>from?` to ${to}`:''}`:stage==='ready'?`At its best until about ${to}`:`Was at its best up to ${to}`};
  },
  reveal(wine,match,gen,wines){
    wines=wines||WineHistory.getAll();
    const t=WineDNA._t(wine.type), col=(typeof _TYPE_COLORS!=='undefined'&&_TYPE_COLORS[t])||'#8B1A2F';
    const identity={type:wine.type||'wine',country:wine.country||'',title:WineDNA.nameYear(wine),producer:wine.producer||'',
      grapes:WineDNA.grapeLine(wine,{shares:true})||'',region:wine.region&&wine.region!==wine.country?wine.region:'',flag:Regions.wineFlag(wine)||'',
      window:this.drinkWindow(wine)};
    // The match: the number and verdict, one reason for and one against. Too early: how close.
    let m=null;
    if(match){
      const pro=match.reasons.find(r=>r.tone==='good'), con=match.reasons.find(r=>r.tone==='bad')||match.reasons.find(r=>r.tone==='neutral');
      m={pct:match.pct,tone:match.tone,label:match.label,expected:match.expected!=null?match.expected:null,expectedLabel:match.expectedLabel||null,bar:match.bar!=null?match.bar:null,
        early:match.verdict==='early'?FirstScan.progress(wine,wines):null,vintage:!!match.vintage,
        pro:pro?pro.text:null,con:con?con.text:null};
    }
    // The traits the wine's own screen shows for its type, only those the label gave a figure for.
    const traits=(WineDNA.AXES_FOR[t]||['body','acidity','sweetness']).filter(k=>typeof wine[k]==='number')
      .slice(0,this.REVEAL_TRAITS).map(k=>({axis:k,name:WineDNA.AXES[k].name,word:WineDNA.everyday(k,wine[k]),v:wine[k],low:WineDNA.AXES[k].low,high:WineDNA.AXES[k].high}));
    const notes=WineDNA.capNotes(wine.tasting_notes).slice(0,3);
    // The lead grape, from the knowledge base's checked line, drawn as its page's sketch with two
    // callouts (its skin and its bunch); never a guess about the bottle. `basis` is how we know
    // it's the grape: printed on the label ('label'), the house's known blend ('known'), or only
    // what wines like this usually hold ('typical', the one case for "usually").
    const lead=(wine.grapes||[])[0], gk=lead?GrapeUnlocks.key(lead):null, G=gk&&KNOWLEDGE.grapes[gk];
    const info=G?GrapeInfo.get(gk,wines):null;
    const grape=G?{name:gk,blend:!!(wine.blend||(wine.grapes||[]).length>1),basis:wine.grapes_basis==='typical'?'typical':wine.grapes_basis==='known'?'known':'label',
      typical:wine.grapes_basis==='typical',line:G.profile,famousIn:(G.famousIn||[]).slice(0,2),info,callouts:info?GrapeInfo.lookWords(info):[]}:null;
    // The place: the knowledge-base region with its climate and a spot on the wine map.
    const rk=Regions.resolve(wine), R=rk&&KNOWLEDGE.regions[rk];
    let place=null;
    if(R){
      const v=Array.isArray(R.at)?KnowledgeMap.views().find(x=>KnowledgeMap._inside(x,R.at)):null;
      const [x,y]=v?KnowledgeMap.project(v,R.at):[0,0];
      // The wide shot the map starts on: the whole country (its centre and size from the view's
      // country list), then it closes in on the pin. A country the view doesn't list starts wide
      // on the pin itself.
      const iso=n=>Regions.ISO[n]||n, cn=R.country||wine.country||'';
      const C=v&&(v.countries||[]).find(c=>c.name===cn||iso(c.name)===iso(cn));
      const wide=C?{x:C.x,y:C.y,z:Math.max(2.2,Math.min(6,Math.sqrt(C.a)/60)),name:C.name===cn?cn:cn}:{x,y,z:3,name:cn};
      place={name:rk,country:cn,flag:Regions.countryFlag(R.country)||identity.flag,line:R.climate||R.classification||'',
        grapes:(R.keyGrapes||[]).slice(0,3),map:v?{view:v,x,y,wide}:null};
    }
    // One thing to say out loud, from the scan cards once Claude has written them.
    const talk=gen&&Array.isArray(gen.talk)&&gen.talk.find(x=>typeof x==='string'&&x.trim());
    const say=talk?{text:talk.trim().replace(/^["“]|["”]$/g,''),kind:'talk'}:gen&&gen.fact?{text:String(gen.fact),kind:'fact'}:null;
    return {col,identity,match:m,traits,notes,grape,place,say};
  },
  blindKey(wine){ return 'vinterest_blindcall_result_'+((wine.name||'')+'_'+(wine.vintage||'nv')).replace(/\s/g,'_'); },
  /* Blind Call: played once per wine; the result keeps their guess for the rating step. */
  _blindDoneKey(wine){ return 'vinterest_blindcall_'+((wine.name||'')+'_'+(wine.vintage||'nv')).replace(/\s/g,'_'); },
  blindPlayed(wine){ return !!Store.get(this._blindDoneKey(wine)); },
  markBlindPlayed(wine){ Store.set(this._blindDoneKey(wine),'1'); },
  blindResult(wine){ return Store.getJSON(this.blindKey(wine),null); },
  saveBlindResult(wine,result){ Store.setJSON(this.blindKey(wine),{...result,at:Date.now()}); }, // `at`: Palate's trend
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
