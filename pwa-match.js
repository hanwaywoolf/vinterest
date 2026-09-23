/* Vinterest — TasteMatch: how likely the user is to enjoy a wine, from their own scores.

   One engine for every place a match shows (scan result, wine list, wine detail), built on the
   same WineDNA profile the WineDNA tab renders, so the two can never disagree.

   The prediction is an expected Parker score: a similarity-weighted average of the scores they
   gave the wines they've scored of this type. Similar style counts, the same grape counts double,
   the same region half again, and the average is pulled toward their overall average when the
   evidence is thin. Style figures are Claude's label estimates, adjusted by the user's own
   "lighter / fuller than the label" taps where they've given them (WineDNA.axisValue). */
const TasteMatch = {
  MIN_SCORED:3,     // below this many scored wines of the type: "too early to call"
  STYLE_SCALE:0.2,  // style distance at which similarity falls to about a third
  PRIOR:0.6,        // how hard thin evidence is pulled toward their average
  VERDICTS:{
    hit:  {label:'Likely a favourite',   tone:'good'},
    good: {label:'A good bet',           tone:'good'},
    mixed:{label:'Could go either way',  tone:'neutral'},
    miss: {label:'Probably not for you', tone:'bad'},
    early:{label:'Too early to call',    tone:'neutral'},
    unknown:{label:'Not enough to go on',tone:'neutral'},
  },

  _key(w){ return (w.name||'')+'|'+String(w.vintage||''); },
  _typeKey(w){ const t=WineDNA._t(w&&w.type); return WineDNA.AXES_FOR[t]?t:'red'; },
  _grapes(w){ return new Set((w.grapes||[]).map(g=>WineDNA.grape(g)).filter(Boolean)); },
  _region(w){ return (w.region||'').trim().toLowerCase(); },
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
    const scoredLine=t=>`you've scored ${t.n===1?'one':t.n}${blend||typical?` ${grapeName} wine${t.n===1?'':'s'}`:''}, ${t.n===1?'at':'averaging'} ${t.avg}`;
    if(gT) reasons.push({kind:'grape',tone:tone(gT.avg),weight:1+gT.n,
      text:typical?`Usually made mainly from ${grapeLabel}: ${scoredLine(gT)}.`
        :blend?`${grapeLabel} leads this blend: ${scoredLine(gT)}.`
        :`${grapeLabel}: ${scoredLine(gT)}.`});
    else if(grapeName&&!typical&&!p.wines.some(w=>this._grapes(w).has(grapeName))) reasons.push({kind:'grape',tone:'neutral',weight:0.5,
      text:blend?`${grapeLabel}, the lead grape in this blend, is new to you.`:`${grapeLabel} is a new grape for you.`});
    const rT=region?tally(w=>this._region(w)===region):null;
    if(rT) reasons.push({kind:'region',tone:tone(rT.avg),weight:0.8+rT.n*0.8,
      text:`${wine.region}: you've scored ${rT.n===1?'one':rT.n}, ${rT.n===1?'at':'averaging'} ${rT.avg}.`});

    const base={typeKey,label,style,scoredCount:scored.length,profile:p};
    if(scored.length<this.MIN_SCORED){
      const need=this.MIN_SCORED-scored.length;
      return {...base,verdict:'early',...this.VERDICTS.early,pct:null,expected:null,confidence:'none',
        reasons:reasons.sort((a,b)=>b.weight-a.weight).slice(0,3),
        summary:`Score ${WineDNA.noun(typeKey,need)} more and we'll start predicting how much you'll like ${L} like this.`};
    }
    if(!axes.length&&!gT&&!rT){
      return {...base,verdict:'unknown',...this.VERDICTS.unknown,pct:null,expected:null,confidence:'none',reasons:reasons.slice(0,3),
        summary:`We couldn't read enough about this wine's style to compare it with your ${L}.`};
    }

    // Similarity to each scored wine.
    const sims=scored.map(w=>{
      const shared=axes.filter(k=>typeof WineDNA.axisValue(w,k)==='number');
      let styleSim=null;
      if(shared.length){
        const d=Math.sqrt(WineDNA._mean(shared.map(k=>(WineDNA.axisValue(wine,k)-WineDNA.axisValue(w,k))**2)));
        styleSim=Math.exp(-((d/this.STYLE_SCALE)**2));
      }
      const sameGrape=[...this._grapes(w)].some(g=>grapes.has(g));
      const sameRegion=!!region&&this._region(w)===region;
      const sim=(styleSim??0.3)*(sameGrape?2:1)*(sameRegion?1.5:1);
      return {w,sim,styleSim};
    });
    const avg=WineDNA._mean(scored.map(w=>w.rating));
    const mass=sims.reduce((s,x)=>s+x.sim,0);
    const expected=(sims.reduce((s,x)=>s+x.sim*x.w.rating,0)+this.PRIOR*avg)/(mass+this.PRIOR);
    const confidence=mass>=2.5&&scored.length>=8?'high':mass>=1.2?'medium':'low';

    // The most similar wine they've scored, when it's genuinely close in style.
    const near=[...sims].filter(x=>x.styleSim!=null&&x.styleSim>=0.6).sort((a,b)=>b.sim-a.sim)[0];
    if(near) reasons.push({kind:'similar',tone:tone(near.w.rating),weight:2+near.styleSim,
      text:`Closest in style to ${near.w.name}, which you scored ${near.w.rating}.`});

    // The traits that separate their 90+ wines from the rest (WineDNA's signals): each one nudges
    // the expectation by up to two points and becomes a reason.
    let nudge=0;
    p.signals.forEach(s=>{
      const v=WineDNA.axisValue(wine,s.axis); if(typeof v!=='number') return;
      const A=WineDNA.AXES[s.axis], towardLoved=Math.abs(v-s.lovedMean)<=Math.abs(v-s.restMean);
      nudge+=(towardLoved?2:-2)*Math.min(1,Math.abs(s.r));
      reasons.push({kind:'signal',tone:towardLoved?'good':'bad',weight:3*Math.abs(s.r)+1,
        text:towardLoved?`${A.name}: your 90+ ${L} lean ${s.adj}, and so does this one.`:`${A.name}: your 90+ ${L} lean ${s.adj}; this one doesn't.`});
    });

    const e=Math.round(expected+nudge);
    const verdict=e>=ParkerScale.LOVED?'hit':e>=85?'good':e>=ParkerScale.DISLIKED?'mixed':'miss';
    const pct=Math.max(5,Math.min(99,Math.round((expected+nudge-60)/35*100)));
    const basis=`Based on the ${WineDNA.noun(typeKey,scored.length)} you've scored`;
    return {...base,verdict,...this.VERDICTS[verdict],pct,expected:e,expectedLabel:ParkerScale.label(e),confidence,
      reasons:reasons.sort((a,b)=>b.weight-a.weight).slice(0,3),
      // One number on screen (the match %); the prediction is said in Parker-band words.
      summary:`${basis}, we think you'd rate it ${ParkerScale.label(e)}.${confidence==='low'?' It\'s a rough guess: nothing you\'ve scored is very like it.':''}`};
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
