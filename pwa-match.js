/* Vinterest — TasteMatch: how likely the user is to enjoy a wine, from their own scores.

   One engine for every place a match shows (scan result, wine list, wine detail), built on the
   same WineDNA profile the WineDNA tab renders, so the two can never disagree.

   Another vintage of the same wine they've scored outweighs everything else (VINTAGE_W).

   The prediction is a distribution over the Parker score they'd give it, not a single number:
   its centre (`expected`) is a similarity-weighted average of the scores they gave every wine of
   this type (similar style counts, the same grape four times, the same region twice, the same
   producer three times), pulled toward their overall average when the evidence is thin; its
   spread (`sd`) comes from how much alike evidence there is, how consistent those scores are,
   and the noise in any single score (NOISE_MIN). The match % is the chance that score clears
   their own bar (`bar`: just under their average score for the type, clamped to BAR_MIN–BAR_MAX), so
   "90% match" means we're 90% sure they'd enjoy it, whatever exact score they end up giving;
   "50%" means we can't tell, which is what little or mixed evidence should say. Verdicts follow
   the chance (HIT_FROM, GOOD_FROM, MIXED_FROM). The expected score is said alongside ("likely
   about a 91"). Style figures are Claude's label estimates, adjusted by the user's own "lighter /
   fuller than the label" taps where they've given them (WineDNA.axisValue). scripts/
   match-backtest.mjs measures all of this against real histories (error, calibration, ranking),
   so every change to the weights here is checked against evidence, not felt. */
const TasteMatch = {
  MIN_SCORED:3,     // below this many scored wines of the type: "too early to call"
  // Every scored wine of the type counts, weighted by how alike it is: no cut-off, so no wine
  // drops out at a line and a small change in the label's style estimates only nudges weights.
  STYLE_SCALE:0.2,  // style distance at which the style weight falls to about a third
  STYLE_FLOOR:0.02, // style weight of a wine nothing like it: it still counts, a little
  NO_STYLE_SIM:0.3, // style weight when there's no style to compare
  GRAPE_X:4,        // the same grape counts this many times more
  REGION_X:2,       // the same region (knowledge-base region) this many times more
  PRODUCER_X:3,     // the same producer (Tignanello and Pian delle Vigne are both Antinori)
  BUY_X:1.5,        // a wine they'd buy again is a stronger signal than a score alone
  PRIOR:0.6,        // how hard thin evidence is pulled toward their average
  SIGNAL_PTS:2,     // the most a WineDNA signal (a trait their 90+ wines share) moves the score
  SIGNAL_SAY:0.3,   // a lean toward or away from it smaller than this isn't given as a reason
  // Another vintage of the same wine they've scored (WineHistory.otherVintage): their average for
  // those years makes up this share of the prediction, the rest the usual model, since vintages
  // vary but the wine is the same. Enough on its own: no "too early to call".
  VINTAGE_W:0.8,
  // The spread: no single score is more reliable than about this many points either way, so a
  // prediction is never narrower, however alike the evidence.
  NOISE_MIN:2.5,
  // How much thin evidence widens the spread (sd × √(1 + SPREAD_K / mass)); the match % is never
  // said above PCT_MAX, since a few scores can't make anything a certainty.
  SPREAD_K:2, PCT_MAX:96,
  // Their bar, the score at which a wine counts as one they enjoyed: a little under their average
  // for the type (BAR_BELOW), so it follows how they score (a generous scorer isn't told
  // everything clears it) without calling half their own wines failures; never below BAR_MIN
  // (anything a Parker "very good" scorer would enjoy) or above BAR_MAX (loved).
  BAR_BELOW:2, BAR_MIN:82, BAR_MAX:90,
  // Verdicts follow the chance (the match %): from GOOD_FROM "A good bet", from MIXED_FROM "Could
  // go either way", under it "Probably not for you"; "Likely a favourite" needs the chance at
  // HIT_FROM and an expected score at least FAV_ABOVE over their average for the type (up with
  // their best, not merely enjoyed).
  HIT_FROM:78, GOOD_FROM:58, MIXED_FROM:38, FAV_ABOVE:2,
  VERDICTS:{
    hit:  {label:'Likely a favourite',   tone:'good'},
    good: {label:'A good bet',           tone:'good'},
    mixed:{label:'Could go either way',  tone:'neutral'},
    miss: {label:'Probably not for you', tone:'bad'},
    early:{label:'Too early to call',    tone:'neutral'},
    unknown:{label:'Not enough to go on',tone:'neutral'},
  },

  _key(w){ return (w.name||'')+'|'+String(w.vintage||''); },
  /* The bar a wine has to clear to count as one they'd enjoy: just under their average score for
     the type, clamped. */
  bar(scored){
    const r=scored.map(w=>w.rating).filter(x=>x>0);
    if(!r.length) return this.BAR_MIN;
    return Math.max(this.BAR_MIN,Math.min(this.BAR_MAX,Math.round(WineDNA._mean(r))-this.BAR_BELOW));
  },
  /* The standard normal's cumulative distribution: Φ(z) = (1 + erf(z/√2)) / 2, erf by
     Abramowitz–Stegun 7.1.26 (good to 1e-7). */
  _phi(z){
    const x=Math.abs(z)/Math.SQRT2, t=1/(1+0.3275911*x), a=[0.254829592,-0.284496736,1.421413741,-1.453152027,1.061405429];
    const erf=1-(((((a[4]*t+a[3])*t)+a[2])*t+a[1])*t+a[0])*t*Math.exp(-x*x);
    return 0.5*(1+(z<0?-erf:erf));
  },
  /* The chance a score drawn from N(mean, sd) is at least `bar` (whole scores, so half a point
     either side of the bar). */
  chanceOver(mean,sd,bar){ return this._phi((mean-bar+0.5)/Math.max(0.5,sd)); },
  _typeKey(w){ const t=WineDNA._t(w&&w.type); return WineDNA.AXES_FOR[t]?t:'red'; },
  _grapes(w){ return new Set((w.grapes||[]).map(g=>WineDNA.grape(g)).filter(Boolean)); },
  // The knowledge-base region a wine belongs to ("Brunello di Montalcino", "Chianti Classico"
  // and "Toscana" are all Tuscany), else its region as written.
  _regionName(w){ return (typeof Regions!=='undefined'&&Regions.resolve(w))||(w.region||'').trim(); },
  _region(w){ return this._regionName(w).toLowerCase(); },
  _cap(s){ return s?s.charAt(0).toUpperCase()+s.slice(1):s; },

  /* Plain-English style line from the label estimates, e.g. "Full body, grippy tannins, fresh acidity". */
  describe(wine){
    const t=this._typeKey(wine), parts=[];
    const words={
      body:{low:'light body',mid:'medium body',high:'full body'},
      tannins:{low:'silky tannins',mid:'medium tannins',high:'grippy tannins'},
      acidity:{low:'soft acidity',mid:'balanced acidity',high:'fresh, zingy acidity'},
      sweetness:{low:'dry',mid:'off-dry',high:'sweet'},
      texture:{low:'crisp and steely',mid:'medium texture',high:'rich and creamy'},
      effervescence:{low:'soft bubbles',mid:'lively bubbles',high:'vigorous bubbles'},
    };
    (WineDNA.AXES_FOR[t]||[]).forEach(k=>{ const l=WineDNA.level(WineDNA.axisValue(wine,k)); if(l&&words[k]) parts.push(words[k][l]); });
    return parts.length?this._cap(parts.join(', ')):null;
  },

  /* How well the match knows them, for WineDNA: every scored wine of the type matched again from
     their other wines alone (as if they were scanning it now), against the score they gave it.
     From CAL_MIN such wines: how often the expected score lands within CAL_CLOSE points (and
     within 5), whether it tends to run low or high, and the biggest surprises either way (a
     miss of SURPRISE points or more): where their taste is moving, or where a wine broke their
     pattern. Nothing is stored; it's worked out from the wines as they are. */
  CAL_MIN:8, CAL_CLOSE:3, SURPRISE:5,
  calibration(typeKey,allWines){
    allWines=allWines||[];
    const scored=allWines.filter(w=>this._typeKey(w)===typeKey&&w.rating>0);
    if(scored.length<this.CAL_MIN) return {ready:false,n:scored.length,need:this.CAL_MIN-scored.length};
    const rows=scored.map(w=>{
      const a=this.assess(w,allWines.filter(x=>x!==w));
      if(!a||a.expected==null) return null;
      const expected=Math.round(a.expected);
      return {wine:w,expected,actual:w.rating,diff:w.rating-expected};
    }).filter(Boolean);
    if(rows.length<this.CAL_MIN) return {ready:false,n:rows.length,need:this.CAL_MIN-rows.length};
    const n=rows.length, close=rows.filter(r=>Math.abs(r.diff)<=this.CAL_CLOSE).length, near=rows.filter(r=>Math.abs(r.diff)<=5).length;
    const bias=WineDNA._mean(rows.map(r=>r.diff)), share=close/n;
    const level=share>=0.7?'well':share>=0.5?'getting':'early';
    const above=rows.filter(r=>r.diff>=this.SURPRISE).sort((a,b)=>b.diff-a.diff).slice(0,2);
    const below=rows.filter(r=>r.diff<=-this.SURPRISE).sort((a,b)=>a.diff-b.diff).slice(0,2);
    return {ready:true,n,close,near,share,level,bias:Math.round(bias*10)/10,rows,above,below};
  },

  /* One wine against the user's history. `profiles` is an optional per-type cache for callers
     scoring many wines at once (a wine list). */
  assess(wine,allWines,profiles){
    if(!wine) return null;
    const typeKey=this._typeKey(wine);
    const label=(WineDNA.NOUNS[typeKey]||['wine','wines'])[1].replace(/^\w/,c=>c.toUpperCase());
    const p=(profiles&&profiles[typeKey])||WineDNA.profile(typeKey,allWines||[],label);
    if(profiles) profiles[typeKey]=p;
    const L=label.toLowerCase();
    const self=this._key(wine);
    const scored=p.scored.filter(w=>this._key(w)!==self);
    const style=this.describe(wine);
    const grapes=this._grapes(wine), region=this._region(wine);
    const axes=p.axes.filter(k=>typeof WineDNA.axisValue(wine,k)==='number');
    const reasons=[];

    // What they've scored from this grape and region, whatever the verdict.
    const tally=(pick)=>{ const ws=scored.filter(pick); return ws.length?{n:ws.length,avg:Math.round(WineDNA._mean(ws.map(w=>w.rating)))}:null; };
    const tone=avg=>avg>=ParkerScale.LOVED-2?'good':avg<ParkerScale.DISLIKED?'bad':'neutral';
    // Name the grape as the label does, with the name it's filed under when that differs.
    const rawGrape=((wine.grapes||[])[0]||'').trim(), grapeName=[...grapes][0];
    const grapeLabel=rawGrape&&grapeName&&rawGrape.toLowerCase()!==grapeName.toLowerCase()?`${rawGrape} (${grapeName})`:grapeName;
    // A blend is described by its lead grape, and a grape that was only guessed ("typical" for the
    // wine, not printed on the label) is never announced as a new grape.
    const typical=wine.grapes_basis==='typical', blend=!!wine.blend||(wine.grapes||[]).length>1;
    const gT=grapeName?tally(w=>this._grapes(w).has(grapeName)):null;
    const scoredLine=t=>`you've rated ${t.n===1?'one':t.n}${blend||typical?` ${grapeName} wine${t.n===1?'':'s'}`:''}, ${t.n===1?'at':'averaging'} ${t.avg}`;
    if(gT) reasons.push({kind:'grape',tone:tone(gT.avg),weight:1+gT.n,
      text:typical?`Usually made mainly from ${grapeLabel}: ${scoredLine(gT)}.`
        :blend?`${grapeLabel} leads this blend: ${scoredLine(gT)}.`
        :`${grapeLabel}: ${scoredLine(gT)}.`});
    else if(grapeName&&!typical&&!p.wines.some(w=>this._grapes(w).has(grapeName))) reasons.push({kind:'grape',tone:'neutral',weight:0.5,
      text:blend?`${grapeLabel}, the lead grape in this blend, is new to you.`:`${grapeLabel} is a new grape for you.`});
    const rT=region?tally(w=>this._region(w)===region):null;
    if(rT) reasons.push({kind:'region',tone:tone(rT.avg),weight:0.8+rT.n*0.8,
      text:`${this._regionName(wine)}: you've rated ${rT.n===1?'one':rT.n}, ${rT.n===1?'at':'averaging'} ${rT.avg}.`});

    // Other years of this same wine they've scored, newest first.
    const vint=scored.filter(w=>WineHistory.otherVintage(wine,w)).sort((a,b)=>(+b.vintage||0)-(+a.vintage||0));
    const vMean=vint.length?WineDNA._mean(vint.map(w=>w.rating)):null;
    const yr=w=>`the ${w.vintage}`;
    const gave=w=>`You gave ${yr(w)} ${/^(8|11|18)/.test(String(w.rating))?'an':'a'} ${w.rating}`;
    const vText=vint.length===1?`${gave(vint[0])}${vint[0].buy_again?' and would buy it again':''}. Vintages vary, but it's the same wine.`
      :vint.length?`You've rated ${vint.length} other vintages of this wine: ${vint.map(w=>`${w.vintage} (${w.rating})`).join(', ')}.`:null;
    if(vint.length) reasons.push({kind:'vintage',tone:tone(vMean),weight:100,text:vText});

    const base={typeKey,label,style,scoredCount:scored.length,profile:p};
    if(scored.length<this.MIN_SCORED&&!vint.length){
      const need=this.MIN_SCORED-scored.length;
      return {...base,verdict:'early',...this.VERDICTS.early,pct:null,expected:null,confidence:'none',
        reasons:reasons.sort((a,b)=>b.weight-a.weight).slice(0,3),
        summary:`Rate ${WineDNA.noun(typeKey,need)} more and we'll start predicting how much you'll like ${L} like this.`};
    }
    if(!axes.length&&!gT&&!rT&&!vint.length){
      return {...base,verdict:'unknown',...this.VERDICTS.unknown,pct:null,expected:null,confidence:'none',reasons:reasons.slice(0,3),
        summary:`We couldn't read enough about this wine's style to compare it with your ${L}.`};
    }

    const avg=WineDNA._mean(scored.map(w=>w.rating));
    const P=this._predict(wine,scored,avg,p.signals);
    const {sims,mass,expected,nudge}=P, nearest=[...sims].sort((a,b)=>b.sim-a.sim);
    const confidence=mass>=2.5&&scored.length>=8?'high':mass>=1.2?'medium':'low';

    // The most similar wine they've scored, when it's genuinely close in style.
    const near=nearest.find(x=>x.styleSim!=null&&x.styleSim>=0.6&&!vint.includes(x.w));
    if(near) reasons.push({kind:'similar',tone:tone(near.w.rating),weight:2+near.styleSim,
      text:`Closest in style to ${near.w.name}, which you rated ${near.w.rating}${near.w.buy_again?' and would buy again':''}.`});

    // The traits that separate their 90+ wines from the rest (WineDNA's signals) nudge the
    // prediction by up to two points each and become reasons.
    const signalPts=P.signals.map(({s,towardLoved,pts})=>{
      const A=WineDNA.AXES[s.axis];
      reasons.push({kind:'signal',tone:towardLoved?'good':'bad',weight:3*Math.abs(s.r)+1,
        text:towardLoved?`${A.name}: your 90+ ${L} lean ${s.adj}, and so does this one.`:`${A.name}: your 90+ ${L} lean ${s.adj}; this one doesn't.`});
      return {text:`${A.name}: your 90+ ${L} lean ${s.adj}${towardLoved?', and so does this one':'; this one doesn\'t'}`,pts};
    });

    const model=expected+nudge;
    const eRaw=vint.length?this.VINTAGE_W*vMean+(1-this.VINTAGE_W)*model:model, e=Math.round(eRaw);
    // The spread of the prediction: how consistent their scores are among the wines like this
    // one (pulled toward their spread overall when little is alike), widened when there's
    // little alike evidence (mass), never narrower than one score's own noise. Another vintage
    // of the same wine narrows it to how those vintages varied.
    const spreadAll=Math.sqrt(WineDNA._mean(scored.map(w=>(w.rating-avg)**2)));
    const nMean=mass?sims.reduce((t,x)=>t+x.sim*x.w.rating,0)/mass:avg;
    const spreadNear=mass?Math.sqrt(sims.reduce((t,x)=>t+x.sim*(x.w.rating-nMean)**2,0)/mass):spreadAll;
    const spread=Math.max(this.NOISE_MIN,(mass*spreadNear+this.PRIOR*spreadAll)/(mass+this.PRIOR));
    let sd=spread*Math.sqrt(1+this.SPREAD_K/Math.max(mass,0.25));
    if(vint.length){
      const sdV=Math.max(this.NOISE_MIN,vint.length>1?Math.sqrt(WineDNA._mean(vint.map(w=>(w.rating-vMean)**2))):this.NOISE_MIN);
      sd=Math.sqrt(this.VINTAGE_W*sdV**2+(1-this.VINTAGE_W)*sd**2);
    }
    sd=Math.round(sd*10)/10;
    // The match %: the chance the score they'd give clears their own bar for the type. "90%
    // match" means we're 90% sure they'd enjoy it; the exact score is said alongside.
    const bar=this.bar(scored);
    const chance=this.chanceOver(eRaw,sd,bar);
    const pct=Math.max(5,Math.min(this.PCT_MAX,Math.round(chance*100)));
    const verdict=pct>=this.HIT_FROM&&e>=Math.round(avg)+this.FAV_ABOVE?'hit':pct>=this.GOOD_FROM?'good':pct>=this.MIXED_FROM?'mixed':'miss';
    // Also said in the breakdown: of the wines of this type they've scored, weighted by how alike
    // each is, the share they loved (90+), against their share overall.
    const lovedAll=scored.filter(w=>w.rating>=ParkerScale.LOVED).length/scored.length;
    const lovedW=sims.reduce((t,x)=>t+(x.w.rating>=ParkerScale.LOVED?x.sim:0),0);
    const lovedNear=(lovedW+this.PRIOR*lovedAll)/(mass+this.PRIOR);
    const basis=`Based on the ${WineDNA.noun(typeKey,scored.length)} you've rated`;
    const styleT=style?tally(w=>{ const x=sims.find(y=>y.w===w); return !!x&&x.styleSim!=null&&x.styleSim>=0.5; }):null;
    const breakdown=this._breakdown({vint,vMean,nearest,n:scored.length,nMean,spreadNear,avg,spreadAll,loved:lovedNear,lovedAll,e,sd,bar,pct,wineProducer:wine.producer,signalPts,L,style,styleT,gT,grapeLabel,grapeName,typical,rT,regionName:this._regionName(wine)});
    return {...base,verdict,...this.VERDICTS[verdict],pct,expected:e,sd,bar,expectedLabel:ParkerScale.label(e),confidence:vint.length?'high':confidence,
      vintages:vint.map(w=>({vintage:w.vintage,rating:w.rating})),chance:pct,loved:Math.round(lovedNear*100),breakdown,breakdownLabel:L,
      reasons:reasons.sort((a,b)=>b.weight-a.weight).slice(0,3),
      // One number on screen (the match %); the prediction is said in Parker-band words.
      summary:vint.length?`${vint.length===1?gave(vint[0]):`Your other ${vint.length} vintages of it average ${Math.round(vMean)}`}, so we think you'd rate this one ${ParkerScale.label(e)}.`
        :`${basis}, there's a ${pct}% chance you'd rate it ${bar} or better; most likely about ${e}, ${ParkerScale.label(e)}.${confidence==='low'?' It\'s a rough guess: nothing you\'ve rated is very like it.':''}`};
  },

  /* The predicted score for one wine from the scored wines of its type: every one counts,
     weighted by how alike it is (style, grape, region, buy again), pulled toward their average
     when the evidence is thin, then nudged by WineDNA's signals. */
  _predict(wine,scored,avg,signals){
    const axes=(WineDNA.AXES_FOR[this._typeKey(wine)]||[]).filter(k=>typeof WineDNA.axisValue(wine,k)==='number');
    const grapes=this._grapes(wine), region=this._region(wine);
    const sims=scored.map(w=>{
      const shared=axes.filter(k=>typeof WineDNA.axisValue(w,k)==='number');
      let styleSim=null;
      if(shared.length){
        const d=Math.sqrt(WineDNA._mean(shared.map(k=>(WineDNA.axisValue(wine,k)-WineDNA.axisValue(w,k))**2)));
        styleSim=Math.exp(-((d/this.STYLE_SCALE)**2));
      }
      const styleW=styleSim==null?this.NO_STYLE_SIM:this.STYLE_FLOOR+(1-this.STYLE_FLOOR)*styleSim;
      const sameGrape=[...this._grapes(w)].some(g=>grapes.has(g));
      const sameRegion=!!region&&this._region(w)===region;
      const sameProducer=this._sameProducer(wine,w);
      const sim=styleW*(sameGrape?this.GRAPE_X:1)*(sameRegion?this.REGION_X:1)*(sameProducer?this.PRODUCER_X:1)*(w.buy_again?this.BUY_X:1);
      return {w,sim,styleSim,sameGrape,sameRegion,sameProducer};
    });
    const mass=sims.reduce((t,x)=>t+x.sim,0);
    const expected=(sims.reduce((t,x)=>t+x.sim*x.w.rating,0)+this.PRIOR*avg)/(mass+this.PRIOR);
    // WineDNA's signals (the traits their 90+ wines share) nudge by up to SIGNAL_PTS each,
    // smoothly: full strength at the loved wines' mean, nothing halfway to the rest's, the
    // opposite at the rest's, so a label reading a hair either side of the midpoint can't flip
    // the match. A lean under SIGNAL_SAY isn't worth a reason.
    let nudge=0; const sig=[];
    (signals||[]).forEach(s=>{
      const v=WineDNA.axisValue(wine,s.axis); if(typeof v!=='number') return;
      const gap=Math.max(0.05,Math.abs(s.lovedMean-s.restMean));
      const lean=Math.max(-1,Math.min(1,(Math.abs(v-s.restMean)-Math.abs(v-s.lovedMean))/gap));
      const pts=this.SIGNAL_PTS*Math.min(1,Math.abs(s.r))*lean;
      nudge+=pts; if(Math.abs(lean)>=this.SIGNAL_SAY) sig.push({s,towardLoved:lean>0,pts});
    });
    return {sims,mass,expected,nudge,signals:sig};
  },
  /* Same producer, however it's written ("Antinori", "Marchesi Antinori"): a shared distinctive
     word, the way WineHistory.same compares producers. */
  _PRODUCER_STOP:new Set(['tenuta','chateau','château','domaine','bodegas','bodega','cantina','cantine','casa','castello','marchesi','estate','estates','winery','vineyards','wines','vini','weingut','maison','mas','clos','quinta','fattoria','podere','azienda','agricola','la','le','les','de','di','del','della','du','des','the','and','et','y','e']),
  _sameProducer(a,b){
    const t=w=>new Set(String(w&&w.producer||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(x=>x.length>2&&!this._PRODUCER_STOP.has(x)));
    const A=t(a), B=t(b); return A.size>0&&[...A].some(x=>B.has(x));
  },

  /* "Why N%?" in plain terms: which things about this wine lift the prediction above their average
     for the type and which hold it back, each from their own scores (its grape, its region, its
     style, and the traits their 90+ wines share), then the wines most like it as the evidence,
     and how the prediction becomes the %. */
  _breakdown({vint,vMean,nearest,n,nMean,spreadNear,avg,spreadAll,loved:lovedNear,lovedAll,e,sd,bar,pct,wineProducer,signalPts,L,style,styleT,gT,grapeLabel,grapeName,typical,rT,regionName}){
    const avgR=Math.round(avg), up=[], down=[], even=[];
    const put=(diff,text)=>(diff>=1.5?up:diff<=-1.5?down:even).push({text,diff:Math.round(diff)});
    const your=(t,what)=>`your ${t.n===1?'one':t.n} ${what} ${t.n===1?'rated':'average'} ${t.avg}`;
    if(vint&&vint.length) put(vMean-avg,`Other vintages of this wine: you rated ${vint.map(w=>`the ${w.vintage} ${w.rating}`).join(', ')}`);
    if(gT) put(gT.avg-avg,`${typical?'Usually ':''}${grapeLabel}: ${your(gT,gT.n===1?L.replace(/s$/,''):L)}`);
    else if(grapeName&&!typical) even.push({text:`${grapeLabel} is new to you, so it counts neither way`,diff:0});
    if(rT) put(rT.avg-avg,`${regionName}: ${your(rT,'from there')}`);
    const byProducer=nearest.filter(x=>x.sameProducer&&!(vint||[]).includes(x.w));
    if(byProducer.length){ const pa=WineDNA._mean(byProducer.map(x=>x.w.rating));
      put(pa-avg,`${wineProducer}: you rated ${byProducer.map(x=>`${x.w.name} ${x.w.rating}`).join(', ')}`); }
    if(style&&styleT) put(styleT.avg-avg,`Its style (${style.toLowerCase()}): ${your(styleT,`${L} like that`)}`);
    signalPts.forEach(x=>(x.pts>0?up:down).push({text:x.text,diff:x.pts}));
    up.sort((a,b)=>b.diff-a.diff); down.sort((a,b)=>a.diff-b.diff);
    // "Most like it" is named so the reader can check the count; every wine still counts,
    // weighted, in the %.
    // Same grape, region or producer and not far off in style; else the closest few.
    let like=nearest.filter(x=>(x.sameGrape||x.sameRegion||x.sameProducer)&&(x.styleSim==null||x.styleSim>=0.3)).slice(0,10);
    if(like.length<3) like=nearest.slice(0,3);
    const loved=like.filter(x=>x.w.rating>=ParkerScale.LOVED), notLoved=like.filter(x=>x.w.rating<ParkerScale.LOVED);
    const nm=x=>`${x.w.name} (${x.w.rating})`;
    const closest=like.length?`The ${like.length===1?L.replace(/s$/,''):like.length+' '+L} most like it: you loved ${loved.length===like.length?'all of them':`${loved.length} (rated 90+)`}${notLoved.length&&loved.length<like.length?`; not ${notLoved.map(nm).join(', ')}`:''}.`:'';
    const lovedR=Math.round(lovedNear*100), lo=Math.max(0,Math.round(e-sd)), hi=Math.min(100,Math.round(e+sd));
    const vWhy=vint&&vint.length?`The same wine from another year is the best guide there is, so your ${vint.length===1?`rating for the ${vint[0].vintage}`:`average for the other vintages (${Math.round(vMean)})`} makes up ${Math.round(this.VINTAGE_W*100)}% of the prediction and everything else you've rated the rest. `:'';
    const an=v=>/^(8|11|18)/.test(String(v))?'an':'a';
    const pctWhy=vWhy+`We expect you'd rate it about ${e}, most likely somewhere between ${lo} and ${hi}. You rate ${L} ${avgR} on average, so we count ${bar} or better as one you enjoyed: that's ${an(pct)} ${pct}% chance this one gets there, ${an(pct)} ${pct}% match. Weighing all ${n} ${L} you've rated by how alike they are, you've loved (90+) about ${lovedR}% of wines like this one, against ${Math.round(lovedAll*100)}% of your ${L} overall.`;
    return {avg:avgR,up,down,even,closest,predicted:e,sd,bar,pctWhy};
  },

  /* A heads-up when a wine costs far more than they usually pay for this type. It never changes
     the match: whether they'd love it and whether it's in their price range are separate questions.
     "Usually" is the middle half of what they've paid (or the shop estimate) for the wines of this
     type they chose, from 4 priced wines; before that, the usual spend they gave. Returns
     {text, tone} or null. */
  PRICE_WARN_X:2,   // at least this many times the top of their usual range
  priceNote(wine,price,allWines,rc){
    rc=rc||Regional.current();
    if(!wine||!(price>0)) return null;
    const t=this._typeKey(wine), L=(WineDNA.NOUNS[t]||['wine','wines'])[1];
    const self=this._key(wine), money=v=>ScanFlow.money(v,rc);
    const prices=(allWines||[]).filter(w=>this._key(w)!==self&&this._typeKey(w)===t&&WineDNA.chosen(w))
      .map(w=>WineDNA.priceOf(w,rc)).filter(v=>v>0).sort((a,b)=>a-b);
    if(prices.length>=4){
      const q=f=>prices[Math.min(prices.length-1,Math.floor(f*(prices.length-1)+0.5))];
      const lo=q(0.25), hi=q(0.75), max=prices[prices.length-1];
      if(price<hi*this.PRICE_WARN_X) return null;
      const most=price>max?`more than any of the ${L} you've had (the most was ${money(max)})`:`your priciest so far was ${money(max)}`;
      return {tone:'neutral',text:`Price: about ${money(price)}, well above the ${money(lo)}–${money(hi)} you usually spend on ${L}; ${most}.`};
    }
    const b=UserPrefs.budget(rc);
    if(b&&b.max!=null&&price>=b.max*this.PRICE_WARN_X)
      return {tone:'neutral',text:`Price: about ${money(price)}, well above your usual spend (${b.label}).`};
    return null;
  },

  /* Wine-list entries carry a compact style estimate ("s":"738": body, tannins, acidity on 1–9,
     0 = not applicable) and a main grape. Turn them into the fields assess() reads. */
  fromListEntry(w){
    const out={...w};
    const s=String(w.style||'').replace(/\D/g,'');
    if(s.length>=3){
      const v=d=>d==='0'?null:Math.max(0,Math.min(1,(Number(d)-1)/8));
      out.body=v(s[0]); out.tannins=v(s[1]); out.acidity=v(s[2]);
    }
    if(w.grape&&!(w.grapes&&w.grapes.length)) out.grapes=[w.grape];
    return WineDNA.cleanWine(out);
  },
};

/* ── Taste-match score ──
   The match percentage for a wine, or null when there's too little scored history to say
   ("too early to call"). TasteMatch (pwa-match.js) owns the model; this is the number alone. */
function calcMatchScore(wine,userWines){
  const m=TasteMatch.assess(wine,userWines||[]);
  return m?m.pct:null;
}

