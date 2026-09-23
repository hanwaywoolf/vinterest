/* Vinterest — WineDNA: every number and sentence on the WineDNA tab, computed from the user's
   scans and scores. The screen only renders what this returns.

   Two kinds of data meet here. A wine's body/tannins/acidity/etc. are Claude's estimates of that
   wine's typical style, read from the label at scan time; the only first-hand input is the
   user's score. So "what you choose" (averages over everything scanned) and "what you love"
   (what separates the wines they score highest) are kept apart, and the profile leads with the
   second once there's enough scored data to say something true. */

/* Robert Parker's 100-point scale, the one the app scores on. */
const ParkerScale = {
  BANDS:[
    {min:96,label:'Extraordinary'},{min:90,label:'Outstanding'},{min:80,label:'Very good'},
    {min:70,label:'Average'},{min:60,label:'Below average'},{min:1,label:'Poor'}
  ],
  PRESETS:[70,80,85,90,95],
  MIN:50,
  LOVED:90,     // Outstanding and up
  DISLIKED:80,  // below "very good": average or worse
  label(score){ if(!score) return ''; const b=this.BANDS.find(x=>score>=x.min); return b?b.label:''; }
};

const WineDNA = {
  // One scale for every label on the tab (bars, chips, personality, Explore Next).
  HIGH:0.67, LOW:0.40,
  level(v){ return v==null?null:v>=this.HIGH?'high':v<=this.LOW?'low':'mid'; },
  AXES:{
    body:         {name:'Body',         low:'Light',          mid:'Medium',        high:'Full',          lowAdj:'lighter',        highAdj:'fuller'},
    tannins:      {name:'Tannins',      low:'Silky',          mid:'Medium',        high:'Grippy',        lowAdj:'softer-tannin',  highAdj:'firmer-tannin'},
    acidity:      {name:'Acidity',      low:'Mellow',         mid:'Medium',        high:'Zingy',         lowAdj:'softer-acid',    highAdj:'fresher, higher-acid'},
    sweetness:    {name:'Sweetness',    low:'Bone dry',       mid:'Off-dry',       high:'Sweet',         lowAdj:'drier',          highAdj:'sweeter'},
    texture:      {name:'Texture',      low:'Crisp & steely', mid:'Medium',        high:'Rich & creamy', lowAdj:'crisper',        highAdj:'richer, creamier'},
    effervescence:{name:'Bubbles',      low:'Soft & delicate',mid:'Medium',        high:'Vigorous',      lowAdj:'softer-bubbled', highAdj:'livelier'},
  },
  AXES_FOR:{red:['body','tannins','acidity','sweetness'],white:['body','acidity','texture','sweetness'],rose:['body','acidity','sweetness'],
    sparkling:['body','acidity','effervescence','sweetness'],orange:['body','tannins','acidity','texture'],dessert:['body','acidity','sweetness','texture'],
    fortified:['body','tannins','sweetness','texture']},
  // Where to look when a preference shows up — practical buying guidance, by axis and direction.
  TIPS:{
    body:{high:'Fuller wines come from warmer places and riper grapes: look at Barossa, Napa, Priorat or Châteauneuf-du-Pape.',
          low:'Lighter styles come from cooler places: Burgundy, Beaujolais, Oregon Pinot Noir or Etna.'},
    tannins:{high:'For more grip, reach for Nebbiolo, Cabernet Sauvignon or Aglianico, and pair them with steak or hard cheese.',
             low:'For silky reds, look for Pinot Noir, Gamay, Grenache or Merlot.'},
    acidity:{high:'Cool climates keep acidity high: Chianti, Barbera, Burgundy, the Loire and the Mosel.',
             low:'Warm climates soften acidity: Barossa, Napa, Mendoza, the southern Rhône and Puglia.'},
    sweetness:{high:'For a touch of sweetness, try German Kabinett or Spätlese Riesling, Vouvray demi-sec or Moscato d\'Asti.',
               low:'On labels, "brut", "trocken", "sec" and "dry" mark the driest styles.'},
    texture:{high:'Richer whites come from oak, lees ageing and malolactic fermentation: think white Burgundy or Rioja blanco.',
             low:'For crisp, steely whites, look for "unoaked" or stainless steel: Chablis, Albariño, Assyrtiko.'},
    effervescence:{high:'Traditional-method sparkling (Champagne, Crémant, Cava) has the finest, most persistent bubbles.',
                   low:'Gentler bubbles: Moscato d\'Asti, Pét-Nat or a softer Prosecco.'},
  },
  GRAPE_SYNONYMS:{'garnacha':'Grenache','garnacha tinta':'Grenache','cannonau':'Grenache','shiraz':'Syrah','tinta roriz':'Tempranillo','tinto fino':'Tempranillo',
    'tinta de toro':'Tempranillo','cencibel':'Tempranillo','primitivo':'Zinfandel','pinot grigio':'Pinot Gris','monastrell':'Mourvèdre','mataro':'Mourvèdre',
    'mourvedre':'Mourvèdre','cot':'Malbec','côt':'Malbec','spätburgunder':'Pinot Noir','spatburgunder':'Pinot Noir','pinot nero':'Pinot Noir',
    'mazuelo':'Carignan','cariñena':'Carignan','carignane':'Carignan','montepulciano d\'abruzzo':'Montepulciano','plavac':'Plavac Mali','mlavac':'Plavac Mali',
    'blaufränkisch':'Blaufränkisch','lemberger':'Blaufränkisch','alvarinho':'Albariño','albarino':'Albariño','gruner veltliner':'Grüner Veltliner',
    'ugni blanc':'Trebbiano','moscato':'Muscat','moscatel':'Muscat','sémillon':'Sémillon','semillon':'Sémillon'},
  grape(g){
    const raw=(g||'').trim(), k=raw.toLowerCase(); if(!k) return null;
    if(this.GRAPE_SYNONYMS[k]) return this.GRAPE_SYNONYMS[k];
    return raw===k?raw.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '):raw;
  },
  _t(v){ return (v||'').toLowerCase().replace('é','e'); },
  /* A wine's value on one axis: Claude's label estimate, nudged by the user's own tasting where
     they told us it was lighter/fuller (etc.) than the label suggested (w.tasted[k] = -1, 0 or 1). */
  TASTED_STEP:0.15,
  axisValue(w,k){
    const v=w&&w[k]; if(typeof v!=='number') return null;
    const d=w.tasted&&typeof w.tasted[k]==='number'?w.tasted[k]:0;
    return Math.max(0,Math.min(1,v+d*this.TASTED_STEP));
  },
  /* Scans that count as the user's choices: everything except a shelf check they didn't buy
     (a "just checking" scan counts once they say they bought it, or once they score it). */
  chosen(w){ return w.scan_intent!=='checking'||w.bought===true||w.rating>0; },
  // "1 white", "3 whites", "7 sparkling wines": wine-type nouns for counts in copy.
  NOUNS:{red:['red','reds'],white:['white','whites'],rose:['rosé','rosés'],sparkling:['sparkling wine','sparkling wines'],
    orange:['orange wine','orange wines'],dessert:['dessert wine','dessert wines'],fortified:['fortified wine','fortified wines']},
  noun(typeKey,n){ const x=this.NOUNS[typeKey]||['wine','wines']; return `${n} ${n===1?x[0]:x[1]}`; },
  _mean(a){ return a.length?a.reduce((s,x)=>s+x,0)/a.length:null; },
  _r(xs,ys){ const n=xs.length; if(n<3) return 0; const mx=this._mean(xs),my=this._mean(ys); let a=0,b=0,c=0;
    for(let i=0;i<n;i++){ a+=(xs[i]-mx)*(ys[i]-my); b+=(xs[i]-mx)**2; c+=(ys[i]-my)**2; } return b&&c?a/Math.sqrt(b*c):0; },
  // Changes whenever a wine is added or re-scored, so cached summaries and memoised views refresh.
  signature(wines){ let h=0; const s=wines.map(w=>`${w.name}|${w.vintage||''}|${w.rating||0}|${this._t(w.type)}`).sort().join(';');
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); },

  /* Everything the tab shows for one wine type. */
  profile(typeKey,allWines,label){
    const wines=allWines.filter(w=>this._t(w.type)===typeKey);
    const scored=wines.filter(w=>w.rating>0);
    const loved=scored.filter(w=>w.rating>=ParkerScale.LOVED);
    const disliked=scored.filter(w=>w.rating<ParkerScale.DISLIKED);
    const axes=this.AXES_FOR[typeKey]||['body','acidity','sweetness'];
    const chosen=wines.filter(w=>this.chosen(w));
    const avgOf=(ws,k)=>this._mean(ws.map(w=>this.axisValue(w,k)).filter(v=>typeof v==='number'));
    const avg={}, lovedAvg={};
    axes.forEach(k=>{ avg[k]=avgOf(chosen,k); lovedAvg[k]=loved.length>=3?avgOf(loved,k):null; });
    // The personality describes what they love once there are 3+ Outstanding wines to go on.
    const basis=loved.length>=3?'loved':'chosen';
    const dnaAvg=basis==='loved'?lovedAvg:avg;
    const stats=(pairs)=>{ const m={}; pairs.forEach(([k,r])=>{ if(!k) return; const e=m[k]=m[k]||{name:k,count:0,scores:[]}; e.count++; if(r>0) e.scores.push(r); });
      return Object.values(m).map(e=>({name:e.name,count:e.count,avg:e.scores.length?Math.round(this._mean(e.scores)):null,scored:e.scores.length})); };
    const grapeStats=stats(wines.flatMap(w=>[...new Set((w.grapes||[]).map(g=>this.grape(g)).filter(Boolean))].map(g=>[g,w.rating])));
    const regionStats=stats(wines.map(w=>[w.region,w.rating]));
    const byCount=(a,b)=>b.count-a.count||(b.avg||0)-(a.avg||0);
    const p={typeKey,label,wines,chosen,scored,loved,disliked,axes,avg,lovedAvg,dnaAvg,basis,
      topGrapes:[...grapeStats].sort(byCount).map(g=>g.name).slice(0,4),
      topRegions:[...regionStats].sort(byCount).map(r=>r.name).slice(0,4),
      grapeStats,regionStats};
    p.showAxis=k=>avg[k]!=null&&(k!=='sweetness'||['dessert','fortified'].includes(typeKey)||this.level(avg[k])!=='low');
    p.personality=this.personality(typeKey,dnaAvg);
    p.signals=this.signals(p);
    p.favourites=this.favourites(p);
    p.value=this.value(p);
    p.blindCall=this.blindCall(wines);
    p.confidence=this.confidence(p);
    p.journey=this.journey(wines);
    p.axisNotes=Object.fromEntries(axes.map(k=>[k,this.axisNote(p,k)]));
    return p;
  },

  personality(typeKey,a){
    const L=k=>this.level(a[k]);
    const b=L('body'),t=L('tannins'),ac=L('acidity'),s=L('sweetness'),x=L('texture');
    if(typeKey==='red'){
      if(b==='high'&&t==='high') return 'Bold & Structured';
      if(b==='high') return 'Full & Velvety';
      if(b==='low') return 'Light & Elegant';
      if(ac==='high') return 'Bright & Fresh';
      return 'Classic & Balanced';
    }
    if(typeKey==='white'){
      if(ac==='high'&&b!=='high') return 'Crisp & Mineral';
      if(b==='high'||x==='high') return 'Rich & Textured';
      if(ac==='high') return 'Zingy & Aromatic';
      return 'Clean & Precise';
    }
    if(typeKey==='rose') return s==='low'?(b==='high'?'Dry & Structured':'Bone Dry & Delicate'):'Fruity & Expressive';
    if(typeKey==='sparkling') return b==='high'?'Classic & Toasty':ac==='high'?'Taut & Precise':'Elegant & Fine';
    if(typeKey==='orange') return t==='high'?'Textured & Tannic':ac==='high'?'Bright & Wild':'Amber & Aromatic';
    if(typeKey==='dessert') return s==='high'&&ac==='high'?'Honeyed & Vibrant':s==='high'?'Lusciously Sweet':'Rich & Nectarous';
    if(typeKey==='fortified') return s==='low'?'Dry & Nutty':'Sweet & Fortified';
    return 'Eclectic Palate';
  },

  // How much weight to put on what the tab says, and what would sharpen it.
  confidence(p){
    const n=p.scored.length;
    const level=n>=12?'strong':n>=8?'good':n>=3?'early':'none';
    const next=level==='strong'?null:level==='good'?`Score ${12-n} more to firm it up`:`Score ${this.noun(p.typeKey,8-n)} more to unlock your preference signals`;
    return {n,level,next,unscored:p.wines.length-n};
  },

  /* What separates the wines they score highest from the rest, axis by axis: a correlation
     between the estimated trait and their score, shown as the means of their Outstanding
     wines vs the others. Needs 8+ scored wines, 3+ on each side, and a real relationship. */
  signals(p){
    if(p.scored.length<8) return [];
    const out=[];
    p.axes.forEach(k=>{
      const ws=p.scored.filter(w=>typeof this.axisValue(w,k)==='number');
      const hi=ws.filter(w=>w.rating>=ParkerScale.LOVED), rest=ws.filter(w=>w.rating<ParkerScale.LOVED);
      if(ws.length<8||hi.length<3||rest.length<3) return;
      const r=this._r(ws.map(w=>this.axisValue(w,k)),ws.map(w=>w.rating));
      const hiM=this._mean(hi.map(w=>this.axisValue(w,k))), restM=this._mean(rest.map(w=>this.axisValue(w,k)));
      if(Math.abs(r)<0.3||Math.abs(hiM-restM)<0.03) return;
      const dir=hiM>restM?'high':'low', A=this.AXES[k];
      out.push({axis:k,dir,r,strength:Math.abs(r)>=0.5?'consistently':'tend to',
        lovedMean:hiM,restMean:restM,adj:dir==='high'?A.highAdj:A.lowAdj,
        text:`You ${Math.abs(r)>=0.5?'consistently':'tend to'} score ${dir==='high'?A.highAdj:A.lowAdj} ${p.label.toLowerCase()} higher.`,
        detail:`Your ${hi.length} Outstanding (90+) ${p.label.toLowerCase()} average ${this.AXES[k].name.toLowerCase()} ${Math.round(hiM*100)}/100, against ${Math.round(restM*100)}/100 for the rest.`,
        tip:this.TIPS[k][dir]});
    });
    return out.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));
  },

  // Where they drink a lot vs where they score highest, and what to rethink.
  favourites(p){
    const rank=list=>list.filter(x=>x.scored>=2&&x.avg!=null);
    const regions=rank(p.regionStats), grapes=rank(p.grapeStats);
    const bottles=x=>p.wines.filter(w=>x.kind==='region'?w.region===x.name:(w.grapes||[]).some(g=>this.grape(g)===x.name)).map(w=>w.name).sort().join('|');
    const best=list=>[...list].filter(x=>x.avg>=ParkerScale.LOVED-5).sort((a,b)=>b.avg-a.avg||b.count-a.count).slice(0,3);
    return {
      regions:best(regions), grapes:best(grapes),
      mostScanned:[...p.regionStats].sort((a,b)=>b.count-a.count)[0]||null,
      // A low-scoring region and the grape that makes it are usually the same bottles: show one line.
      rethink:(()=>{ const out=[]; const low=[...regions.map(x=>({...x,kind:'region'})),...grapes.map(x=>({...x,kind:'grape'}))].filter(x=>x.avg<ParkerScale.DISLIKED).sort((a,b)=>a.avg-b.avg);
        low.forEach(x=>{ const same=out.find(o=>bottles(o)===bottles(x)); if(same){ same.also=x.name; } else if(out.length<2) out.push({...x}); }); return out; })(),
      disliked:[...p.disliked].sort((a,b)=>a.rating-b.rating).slice(0,3)
    };
  },

  /* A wine's price in the user's currency: what they paid when they told us, otherwise Claude's
     shop-price estimate from the scan. */
  priceOf(w,rc){
    rc=rc||Regional.current(); const fx=USD_FX[rc.code]||1;
    const pp=w.price_paid;
    if(pp&&pp.amount>0) return pp.code===rc.code?pp.amount:pp.amount/(USD_FX[pp.code]||1)*fx;
    return w.price_usd>0?w.price_usd*fx:null;
  },

  /* Price against score, in local currency. Prices are what the user paid where they said,
     otherwise estimates, and are labelled that way. Needs 6+ scored, priced wines. */
  value(p){
    const rc=Regional.current();
    const ws=p.scored.map(w=>({w,price:this.priceOf(w,rc)})).filter(x=>x.price>0);
    if(ws.length<6) return null;
    const hi=ws.filter(x=>x.w.rating>=ParkerScale.LOVED), rest=ws.filter(x=>x.w.rating<ParkerScale.LOVED);
    const money=v=>`${rc.base}${Math.round(v)}`;
    const sorted=[...ws].sort((a,b)=>a.price-b.price);
    const median=sorted[Math.floor(sorted.length/2)].price;
    const bestValue=hi.filter(x=>x.price<=median).sort((a,b)=>b.w.rating-a.w.rating||a.price-b.price).slice(0,3)
      .map(x=>({wine:x.w,price:money(x.price),paid:!!(x.w.price_paid&&x.w.price_paid.amount>0)}));
    const r=this._r(ws.map(x=>x.price),ws.map(x=>x.w.rating));
    let verdict=null;
    if(hi.length>=2&&rest.length>=2){
      const hiP=this._mean(hi.map(x=>x.price)), restP=this._mean(rest.map(x=>x.price));
      const L=p.label.toLowerCase(), cmp=`(${money(hiP)} vs ${money(restP)})`;
      verdict=hiP<restP*0.9
        ?{kind:'cheaper',text:`Your Outstanding ${L} actually cost less than the rest on average ${cmp}. Price is no guide to what you'll love, so trust your own picks.`}
        :hiP<=restP*1.15
          ?{kind:'flat',text:`Your Outstanding ${L} cost about the same as the rest ${cmp}. Spending more hasn't bought you more enjoyment, so there's no need to trade up to find wines you love.`}
          :r>=0.3
            ?{kind:'pays',text:`Your Outstanding ${L} cost more on average ${cmp}, and higher prices have tended to mean higher scores for you. Stepping up can pay off, especially within your sweet spot.`}
            :{kind:'loose',text:`Your Outstanding ${L} cost a little more on average ${cmp}, but across all your ${L} price and score barely move together. A higher price hasn't reliably meant a better bottle for you.`};
    }
    return {n:ws.length,paid:ws.filter(x=>x.w.price_paid&&x.w.price_paid.amount>0).length,code:rc.code,sweetSpot:hi.length>=2?SommelierScript.budget(hi.map(x=>x.w),rc):null,bestValue,verdict};
  },

  // Blind Call guesses made after scanning these wines (accuracy 0–1 per wine).
  blindCall(wines){
    const acc=[];
    wines.forEach(w=>{
      const key='vinterest_blindcall_result_'+((w.name||'')+'_'+(w.vintage||'nv')).replace(/\s/g,'_');
      try{ const r=JSON.parse(localStorage.getItem(key)||'null'); if(r&&typeof r.accuracy==='number') acc.push(r.accuracy); }catch(e){}
    });
    return acc.length?{played:acc.length,accuracy:Math.round(this._mean(acc)*100)}:null;
  },

  // One plain sentence per bar, from the user's own wines only (no generic grape claims).
  axisNote(p,k){
    const ws=p.chosen.filter(w=>typeof this.axisValue(w,k)==='number');
    if(ws.length<2) return null;
    const A=this.AXES[k], lvl=this.level(p.avg[k]);
    const sorted=[...ws].sort((a,b)=>this.axisValue(b,k)-this.axisValue(a,k));
    const top=sorted[0], bottom=sorted[sorted.length-1];
    const word={high:A.high.toLowerCase(),mid:'medium',low:A.low.toLowerCase()}[lvl];
    let s=`The ${p.label.toLowerCase()} you choose are ${word} on average, from ${bottom.name} at the ${A.lowAdj.split(',')[0]} end to ${top.name} at the ${A.highAdj.split(',')[0]} end.`;
    const sig=p.signals.find(x=>x.axis===k);
    if(sig) s+=` Your Outstanding ones lean ${sig.adj}.`;
    return s;
  },

  // How their choices are changing: bottles per period, and places/grapes new to them.
  journey(wines){
    const dated=wines.filter(w=>w.scanned_at||w.last_scanned).map(w=>({w,d:new Date(w.scanned_at||w.last_scanned)})).filter(x=>!isNaN(x.d)).sort((a,b)=>a.d-b.d);
    if(dated.length<3) return [];
    const span=(dated[dated.length-1].d-dated[0].d)/86400000;
    const g=span<=10?'day':span<=70?'week':span<=700?'month':'year';
    const key=d=>g==='day'?d.toISOString().slice(0,10):g==='week'?d.getFullYear()+'-'+Math.ceil(((d-new Date(d.getFullYear(),0,1))/86400000+1)/7):g==='month'?d.getFullYear()+'-'+d.getMonth():String(d.getFullYear());
    const lab=d=>g==='year'?String(d.getFullYear()):g==='month'?d.toLocaleDateString('en',{month:'short',year:'2-digit'}):d.toLocaleDateString('en',{month:'short',day:'numeric'});
    const seenR=new Set(), seenG=new Set(), buckets=new Map();
    dated.forEach(({w,d})=>{
      const k=key(d); if(!buckets.has(k)) buckets.set(k,{label:lab(d),count:0,newRegions:[],newGrapes:[],scores:[]});
      const b=buckets.get(k); b.count++; if(w.rating>0) b.scores.push(w.rating);
      if(w.region&&!seenR.has(w.region)){ seenR.add(w.region); b.newRegions.push(w.region); }
      (w.grapes||[]).map(x=>this.grape(x)).filter(Boolean).forEach(x=>{ if(!seenG.has(x)){ seenG.add(x); b.newGrapes.push(x); } });
    });
    return [...buckets.values()].slice(-6).map(b=>({...b,unit:g,avgScore:b.scores.length?Math.round(this._mean(b.scores)):null}));
  },

  /* The facts the Claude-written summary is allowed to use, so it can only restate what's true. */
  summaryFacts(p){
    const f=[];
    f.push(`Wine type: ${p.label}. ${p.wines.length} scanned, ${p.scored.length} scored on the 100-point scale, ${p.loved.length} scored 90+ (Outstanding).`);
    f.push(`Personality label: ${p.personality} (based on ${p.basis==='loved'?'their 90+ wines':'all the wines they chose'}).`);
    f.push(`Style of the wines they choose: ${p.axes.filter(k=>p.avg[k]!=null).map(k=>`${this.AXES[k].name.toLowerCase()} ${this.level(p.avg[k])}`).join(', ')}.`);
    p.signals.forEach(s=>f.push(`Preference signal: ${s.text} ${s.detail}`));
    if(p.favourites.regions.length) f.push(`Highest-scoring regions: ${p.favourites.regions.map(r=>`${r.name} (${r.count} bottles, avg ${r.avg})`).join('; ')}.`);
    if(p.favourites.grapes.length) f.push(`Highest-scoring grapes: ${p.favourites.grapes.map(g=>`${g.name} (${g.count}, avg ${g.avg})`).join('; ')}.`);
    if(p.favourites.disliked.length) f.push(`Scored below 80: ${p.favourites.disliked.map(w=>`${w.name}${w.region?' from '+w.region:''} (${w.rating})`).join('; ')}.`);
    if(p.value&&p.value.verdict) f.push(`Value: ${p.value.verdict.text}`);
    return f.join('\n');
  }
};
