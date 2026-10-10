/* Vinterest — WineDeep: "Learn more about this wine", the layer after the scan story. The story
   tells someone what the bottle is and whether they'll like it in twenty seconds; this is for
   the ones who want more: the house that makes it, the year, how it's made, the appellation in
   depth and how to serve it, each card a line with a paragraph behind "More". Written by Claude
   once, on demand (purpose `wine_deep`, only when "Learn more about this wine" is opened, never
   at scan time), cached on this phone per wine; the checked facts underneath (classification,
   ageing rules, classic houses, the grape's winemaking, from data/knowledge.json) come from
   `facts` whatever Claude writes, and the prompt is told to use them verbatim. The drinking
   window it returns is shared with the Details tab's vintage card (ScanFlow.vintageKey), so
   that card never asks a second time.

   While it writes, `tidbits` gives the waiting screen (WritingWait, pwa-waiting.jsx) something
   to read: lines about this bottle's grape and region first, then general wine facts from
   data/wine-tidbits.json (checked, no Claude call). */
const WineDeep = {
  VERSION:'v1',
  key(w){ return `vinterest_deep_${this.VERSION}_${((w&&w.name)||'').replace(/\s/g,'_')}_${(w&&w.vintage)||'nv'}`; },
  get(w){ const t=Cache.getText(this.key(w)); if(!t) return null; try{ return JSON.parse(t); }catch(e){ return null; } },
  /* The checked facts for this wine's region and lead grape (data/knowledge.json). */
  facts(w){
    const rk=(typeof Regions!=='undefined'&&Regions.resolve(w))||null, R=rk&&KNOWLEDGE.regions[rk];
    const lead=((w&&w.grapes)||[])[0], gk=lead?GrapeUnlocks.key(lead):null, G=gk&&KNOWLEDGE.grapes[gk];
    const producer=((w&&w.producer)||'').trim(), classic=R?(R.classicProducers||[]):[];
    const isClassic=!!producer&&classic.some(p=>TasteMatch._sameProducer({producer},{producer:p}));
    return {region:rk,country:(R&&R.country)||(w&&w.country)||'',classification:(R&&R.classification)||'',agingRules:(R&&R.agingRules)||'',
      climate:(R&&R.climate)||'',keyGrapes:R?(R.keyGrapes||[]):[],classic,isClassic,places:R?(R.aliases||[]).filter(a=>a!==rk):[],
      grape:gk||lead||null,grapeKnown:!!G,winemaking:(G&&G.winemaking)||'',ageing:(G&&G.ageing)||'',food:(G&&G.food)||'',origin:(G&&G.origin)||''};
  },
  prompt(w,match){
    const f=this.facts(w), year=w.vintage&&w.vintage!=='NV'&&w.vintage!==0?String(w.vintage):null;
    const checked=[
      f.classification?`${f.region} classification: ${f.classification}.`:'',
      f.agingRules?`Ageing rules (use these figures verbatim, never change them): ${f.agingRules}`:'',
      f.classic.length?`Classic producers of ${f.region}: ${f.classic.join(', ')}${f.isClassic?' (this producer is one of them)':''}.`:'',
      f.keyGrapes.length?`Key grapes of ${f.region}: ${f.keyGrapes.join(', ')}.`:'',
      f.places.length?`Places inside ${f.region}: ${f.places.join(', ')}.`:'',
      f.winemaking?`${f.grape} winemaking: ${f.winemaking}`:'',
      f.ageing?`${f.grape} and age: ${f.ageing}`:'',
    ].filter(Boolean).join(' ');
    return 'You are a warm, knowledgeable sommelier writing the "Learn more about this wine" cards for a wine app that takes the fear out of wine. '+
      `Wine: ${w.name||''}${year?' '+year:''}. Type: ${w.type||'red'}. Region: ${w.region||''}${w.sub_region?' ('+w.sub_region+')':''}, ${w.country||''}. Producer: ${w.producer||'unknown'}. `+
      `Grapes: ${WineDNA.grapeLine(w)||'unknown'}${w.grapes_basis==='typical'?' (not stated on the label: what this wine usually contains)':''}. `+
      (checked?`CHECKED FACTS (use them, never contradict them): ${checked} `:'')+
      (match&&match.label?`The app's match verdict for this drinker: "${match.label}". `:'')+
      'The reader has already seen the match, how the wine will feel, its grape\'s profile, the region\'s climate and one line to say about it: do not repeat those. Every card goes deeper: specific to THIS wine, house and place, no generic filler. '+
      'Explain every wine term in a few plain words right where you use it. No numbers, percentages or decimals anywhere EXCEPT years and the checked figures above; years are always numerals. Only state facts you are sure of; where you are not, say what is typical rather than inventing. '+
      'Return ONLY valid JSON, no markdown: {'+
      '"house":{"line":"one sentence: who makes this wine and what the house is known for (max 26 words)","more":"two or three sentences: the estate\'s story, how this bottle sits in its range (an entry wine, the flagship, a single vineyard), and another wine of theirs worth knowing (max 70 words)"},'+
      `"year":{"line":"one sentence on what the ${year||'blend of years'} was like in this region${year?'':' and what blending across years does for this wine'} (max 26 words)","more":"two sentences on how this bottle is drinking now and how it will change (max 50 words)","rating":"Exceptional|Outstanding|Very Good|Good|Average|Unknown","drink_from":${year?'YYYY':'null'},"drink_to":${year?'YYYY':'null'},"peak_from":${year?'YYYY':'null'},"peak_to":${year?'YYYY':'null'}},`+
      '"made":{"line":"one sentence on how this wine is made (max 26 words)","more":"two or three sentences: the classification and what it means in the glass (the checked ageing rules verbatim where they apply), the oak, the blend, anything unusual in the winemaking (max 70 words)"},'+
      '"region":{"line":"one sentence on what sets this appellation apart from its neighbours (max 26 words)","more":"two or three sentences: its sub-zones or villages, what a label from here tells you, how it sits in the wider region (max 70 words)"},'+
      '"table":{"serve":"one sentence: serving temperature in words, whether to decant, the glass (max 22 words)","pairings":[{"food":"a dish","why":"why it works, in tasting terms such as tannin against fat or acidity against salt (max 16 words)"},{"food":"a dish","why":"…"},{"food":"a dish","why":"…"}]}'+
      '}';
  },
  parse(text){
    let c=String(text||'').replace(/```json|```/g,'').trim();
    const s=c.indexOf('{'), e=c.lastIndexOf('}');
    if(s>=0&&e>s) c=c.slice(s,e+1);
    const d=JSON.parse(c);
    if(!d||typeof d!=='object'||!d.house||!d.made) throw new Error('deep: not the cards');
    return d;
  },
  /* Loads (or returns the cached) cards; `cb(d)` with null when it can't be written. */
  load(w,match,cb){
    const have=this.get(w); if(have){ cb(have); return; }
    if(!window.claude||!window.claude.complete){ cb(null); return; }
    window.claude.complete({purpose:'wine_deep',messages:[{role:'user',content:this.prompt(w,match)}]})
      .then(text=>{
        const d=this.parse(text);
        Cache.set(this.key(w),d);
        // The year's window serves the Details tab's vintage card too, so it never asks twice.
        const y=d.year||{};
        if(y.drink_to>0&&y.peak_to>0&&w.vintage&&!Cache.getText(ScanFlow.vintageKey(w)))
          Cache.set(ScanFlow.vintageKey(w),{vintage_rating:y.rating||'Good',drink_from:y.drink_from,drink_to:y.drink_to,peak_from:y.peak_from,peak_to:y.peak_to,note:y.more||y.line||''});
        cb(d);
      })
      .catch(()=>cb(null));
  },
  /* Lines to read while something is written: this bottle's grape and region first (the
     knowledge base), then general wine facts, in an order that changes by the day. */
  GENERAL:_loadJSON('data/wine-tidbits.json'),
  tidbits(w){
    const out=[];
    if(w){
      const f=this.facts(w), G=f.grapeKnown?KNOWLEDGE.grapes[f.grape]:null, R=f.region?KNOWLEDGE.regions[f.region]:null;
      if(G){ [G.origin,G.aka,G.climate,G.winemaking,G.food,G.ageing,G.lookalike,G.blends].filter(Boolean).forEach(l=>out.push(/^[A-Z]/.test(l)?l:`${f.grape}: ${l}`)); }
      if(R){ if(R.agingRules) out.push(`${f.region}'s ageing rules: ${R.agingRules}`); if(R.classicProducers&&R.classicProducers.length) out.push(`Classic houses of ${f.region}: ${R.classicProducers.join(', ')}.`); }
    }
    const day=Math.floor(Date.now()/864e5), g=this.GENERAL.slice(), start=g.length?day%g.length:0;
    return out.concat(g.slice(start),g.slice(0,start));
  },
};
Object.assign(window,{WineDeep});
