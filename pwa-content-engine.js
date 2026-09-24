/* Vinterest — Content Engine. Event-triggered archetype queue for the Learn shelf.
   Deterministic: stub metadata (title/subtitle) is template-filled from WineDNA, never LLM-invented.
   Only the article body (GenArticleScreen) calls the model, and only with retrieved facts attached. */

let KNOWLEDGE={descriptors:{},regions:{},grapes:{}},ARTICLE_ARCHETYPES=[],TRIGGERS=[];
try{ KNOWLEDGE=_loadJSON('data/knowledge.json')||KNOWLEDGE; }catch(e){ console.error('[Vinterest] knowledge.json failed to load — generated Learn content will be generic until it is deployed.',e); }
try{ ARTICLE_ARCHETYPES=_loadJSON('data/archetypes.json')||[]; }catch(e){ console.error('[Vinterest] archetypes.json failed to load — the Learn shelf will stay empty until it is deployed.',e); }
try{ TRIGGERS=_loadJSON('data/triggers.json')||[]; }catch(e){ console.error('[Vinterest] triggers.json failed to load — the Learn shelf will stay empty until it is deployed.',e); }

const ExposureLedger = Object.assign(_accountStore('vinterest_exposure_v1'), {
  fresh(){ return {keys:{}}; },
  has(key){ return !!this.get().keys[key]; },
  mark(key){ const d=this.get(); d.keys[key]=Date.now(); this.save(d); }
});

/* Legacy: regions aced under the old rule (one perfect quiz retired the region). Still honoured
   so nobody loses a region they'd already retired; progress now lives in QuizMastery
   (pwa-quiz-questions.js), and resetting a region clears both. */
const RegionQuizLedger = Object.assign(_accountStore('vinterest_region_quiz_v1'), {
  fresh(){ return {aced:{}}; },
  isAced(region){ return !!this.get().aced[region]; },
  clear(region){ const d=this.get(); if(d.aced[region]){ delete d.aced[region]; this.save(d); } }
});

/* Which knowledge-base region a wine belongs to: its region, sub-region or name matched against
   each region's name and aliases ("Rioja Alta" → Rioja, "Châteauneuf-du-Pape" → Rhône Valley).
   null when none match: there are no checked facts to teach from. */
const Regions = {
  _norm(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); },
  _index:null,
  index(){
    if(this._index) return this._index;
    const list=[];
    Object.entries(KNOWLEDGE.regions||{}).forEach(([key,r])=>{ [key,...(r.aliases||[])].forEach(n=>{ const t=this._norm(n); if(t) list.push({t,key}); }); });
    return this._index=list.sort((a,b)=>b.t.length-a.t.length); // longest first: "Rioja Alta" before "Rioja"
  },
  _match(text){
    const x=' '+this._norm(text)+' ';
    if(x.trim()==='') return null;
    const hit=this.index().find(e=>x.includes(' '+e.t+' '));
    return hit?hit.key:null;
  },
  resolve(w){ if(!w) return null; return this._match(w.sub_region)||this._match(w.region)||this._match(w.name)||null; },
  /* The region's country flag (emoji), for colour on region quizzes. '' when unknown. */
  ISO:{'Spain':'ES','France':'FR','USA':'US','United States':'US','United States of America':'US','Italy':'IT','New Zealand':'NZ','Portugal':'PT','Germany':'DE','Austria':'AT',
    'Hungary':'HU','Greece':'GR','Canada':'CA','Chile':'CL','Argentina':'AR','Australia':'AU','South Africa':'ZA','Croatia':'HR',
    'England':'GB','United Kingdom':'GB','UK':'GB','Wales':'GB','Switzerland':'CH','Slovenia':'SI','Georgia':'GE','Lebanon':'LB','Israel':'IL',
    'Uruguay':'UY','Brazil':'BR','Mexico':'MX','Romania':'RO','Moldova':'MD','Bulgaria':'BG','Serbia':'RS','Czech Republic':'CZ','Czechia':'CZ',
    'Slovakia':'SK','Turkey':'TR','Cyprus':'CY','Luxembourg':'LU','Belgium':'BE','Netherlands':'NL','Denmark':'DK','Sweden':'SE','China':'CN',
    'Japan':'JP','India':'IN','Armenia':'AM','North Macedonia':'MK','Montenegro':'ME','Bosnia and Herzegovina':'BA','Ukraine':'UA','Morocco':'MA'},
  countryFlag(country){
    const iso=country&&this.ISO[String(country).trim()];
    return iso?String.fromCodePoint(...[...iso].map(ch=>0x1F1E6+ch.charCodeAt(0)-65)):'';
  },
  flag(region){ return this.countryFlag((KNOWLEDGE.regions[region]||{}).country); },
  /* A wine's flag: its own country, else the country of the region it's filed under. */
  wineFlag(w){ return (w&&this.countryFlag(w.country))||this.flag(this.resolve(w)); },
  /* The region a wine is filed under for learning: the knowledge-base region when there is one. */
  of(w){ return this.resolve(w)||(w&&w.region)||null; },
};

/* Regions open up as they're scanned: the first FREE_REGION_CAP for everyone, the rest with Pro
   (their quizzes and region articles show as "Unlock with Pro"). Existing history is backfilled
   in scan order, so nobody loses a region they already had. */
const FREE_REGION_CAP=5;
const RegionUnlocks = Object.assign(_accountStore('vinterest_region_unlocks_v1'), {
  fresh(){ return {unlocked:{}}; },
  all(){ return this.get().unlocked; },
  count(){ return Object.keys(this.all()).length; },
  _pro(){ return !!localStorage.getItem('vinterest_pro'); },
  isUnlocked(region){ return this._pro()||!!this.all()[region]; },
  unlock(region){
    if(!region||!KNOWLEDGE.regions[region]) return false;
    const d=this.get();
    if(d.unlocked[region]) return true;
    if(!this._pro()&&Object.keys(d.unlocked).length>=FREE_REGION_CAP) return false;
    d.unlocked[region]={at:Date.now()};
    this.save(d);
    try{ RegionQuizBank.prefetch(region); }catch(e){}
    return true;
  },
  sync(wines){
    [...wines].sort((a,b)=>new Date(a.scanned_at||0)-new Date(b.scanned_at||0)).forEach(w=>{ const r=Regions.resolve(w); if(r&&!this.all()[r]) this.unlock(r); });
  },
});

function _ceShuffle(arr){ const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

/* Per-region question bank: 15 questions (5 easy/5 medium/5 hard) generated once from the
   region's data/knowledge.json facts and cached forever, same approach as the grape quizzes.
   The cache is shared across accounts (it's reference content); each account's progress
   through it lives in QuizMastery under 'region:<name>'. */
const RegionQuizBank = {
  _inFlight:new Set(),
  key(region){ return 'vinterest_region_quiz_bank_'+region.replace(/\s+/g,'_'); },
  get(region){
    try{ const qs=JSON.parse(localStorage.getItem(this.key(region))||'null'); return Array.isArray(qs)&&qs.length>=QUIZ_SIZE?qs:null; }catch(e){ return null; }
  },
  // A question is kept only if it's well-formed; a bank with too few survivors isn't cached,
  // so the next tap retries generation rather than locking in a short bank.
  _valid(q){ return q&&typeof q.q==='string'&&Array.isArray(q.opts)&&q.opts.length===4&&Number.isInteger(q.a)&&q.a>=0&&q.a<4; },
  load(region,onReady){
    const cached=this.get(region);
    if(cached){ onReady(cached); return; }
    if(this._inFlight.has(region)){
      const wait=()=>{ if(this._inFlight.has(region)) setTimeout(wait,300); else onReady(this.get(region)); };
      wait();
      return;
    }
    const info=KNOWLEDGE.regions[region];
    if(!info){ onReady(null); return; }
    this._inFlight.add(region);
    const facts=`${region} (${info.country}). Classification: ${info.classification}. Key grapes: ${(info.keyGrapes||[]).join(', ')}. Climate: ${info.climate}. Aging rules: ${info.agingRules||'none specific'}. Classic producers: ${(info.classicProducers||[]).join(', ')}.`;
    const prompt=ContentEngine.fillTpl(_loadTextSync('prompts/region-quiz.txt'),{region,facts});
    window.claude.complete({purpose:'region_quiz',max_tokens:4096,messages:[{role:'user',content:prompt}]})
      .then(text=>{
        let cleaned=text.replace(/```json|```/g,'').trim();
        const s=cleaned.indexOf('['); const e=cleaned.lastIndexOf(']');
        if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
        const seen=new Set();
        const qs=JSON.parse(cleaned).filter(q=>this._valid(q)&&!seen.has(q.q)&&seen.add(q.q));
        if(qs.length>=QUIZ_SIZE) localStorage.setItem(this.key(region),JSON.stringify(qs));
      })
      .catch(()=>{})
      .finally(()=>{ this._inFlight.delete(region); onReady(this.get(region)); });
  },
  prefetch(region){ if(!this.get(region)) this.load(region,()=>{}); },
  /* Every question a region quiz can draw from: the generated bank, or — with no bank yet
     (offline, or generation failed) — the ~6 fixed questions built from the region's
     knowledge-base facts plus one about the user's own bottles. Completion is judged against
     whichever pool is current. */
  pool(region){
    return this.get(region)||this._fallbackPool(region);
  },
  _fallbackPool(region){
    const info=KNOWLEDGE.regions[region];
    const wines=WineHistory.getAll();
    const regionWines=wines.filter(w=>Regions.of(w)===region);
    const otherWines=_ceShuffle(wines.filter(w=>w.region&&w.region!==region)).slice(0,3);
    const otherRegionIds=Object.keys(KNOWLEDGE.regions).filter(r=>r!==region);
    const qs=[];
    const add=(q,correct,distractors,fact)=>{
      const opts=_ceShuffle([correct,...distractors]);
      qs.push({q,opts,a:opts.indexOf(correct),fact});
    };
    if(info){
      const distractClass=[...new Set(otherRegionIds.map(r=>KNOWLEDGE.regions[r].classification).filter(c=>c&&c!==info.classification))];
      if(distractClass.length>=2) add(`What classification does ${region} wine fall under?`,info.classification,_ceShuffle(distractClass).slice(0,3),`${region} (${info.country}): ${info.classification}.`);
      if(info.keyGrapes&&info.keyGrapes[0]){
        const distractGrapes=[...new Set(otherRegionIds.flatMap(r=>KNOWLEDGE.regions[r].keyGrapes||[]).filter(g=>g&&!info.keyGrapes.includes(g)))];
        if(distractGrapes.length>=2) add(`Which grape is the backbone of ${region}?`,info.keyGrapes[0],_ceShuffle(distractGrapes).slice(0,3),`${region}'s key grape(s): ${info.keyGrapes.join(', ')}.`);
      }
      if(info.climate){
        const distractClimate=_ceShuffle(otherRegionIds.map(r=>KNOWLEDGE.regions[r].climate).filter(Boolean)).slice(0,3);
        if(distractClimate.length>=2) add(`Which climate description matches ${region}?`,info.climate,distractClimate,`${region}: ${info.climate}.`);
      }
      if(info.agingRules){
        const distractAging=_ceShuffle(otherRegionIds.map(r=>KNOWLEDGE.regions[r].agingRules).filter(Boolean)).slice(0,3);
        if(distractAging.length>=2) add(`Which aging rule applies to ${region}?`,info.agingRules,distractAging,`${region}: ${info.agingRules}.`);
      }
      if(info.classicProducers&&info.classicProducers[0]){
        const distractProducers=[...new Set(otherRegionIds.flatMap(r=>KNOWLEDGE.regions[r].classicProducers||[]).filter(p=>p&&!info.classicProducers.includes(p)))];
        if(distractProducers.length>=2) add(`Which producer is a classic name in ${region}?`,info.classicProducers[0],_ceShuffle(distractProducers).slice(0,3),`Classic ${region} producers include ${info.classicProducers.join(', ')}.`);
      }
    }
    if(regionWines.length&&otherWines.length>=3){
      const target=_ceShuffle(regionWines)[0];
      add(`Which of these bottles in your wine history is from ${region}?`,target.name,otherWines.map(w=>w.name),`${target.name} is the ${region} bottle in your history.`);
    }
    return qs;
  },
  setId(region){ return 'region:'+region; },
  isComplete(region){ return RegionQuizLedger.isAced(region)||QuizMastery.isComplete(this.setId(region),this.pool(region)); },
  progress(region){ return QuizMastery.progress(this.setId(region),this.pool(region)); },
  reset(region){ QuizMastery.reset(this.setId(region)); RegionQuizLedger.clear(region); }
};

/* Regions with 2+ scans, most-scanned first, split into ones still being worked through and
   ones completed (every question answered correctly at least once). A newly-scanned region
   (e.g. a first Bordeaux) slots in once it crosses the 2-scan threshold. Requires a
   data/knowledge.json entry — without one there are no facts to ground a quiz in. */
function _regionsWithScans(wines){
  const counts={};
  wines.forEach(w=>{ const r=Regions.resolve(w); if(r) counts[r]=(counts[r]||0)+1; });
  RegionUnlocks.sync(wines);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([region])=>region).filter(r=>RegionUnlocks.isUnlocked(r));
}
/* Scanned regions past the free allowance: shown with "Unlock with Pro". */
function lockedRegions(wines){
  const seen=new Set(); wines.forEach(w=>{ const r=Regions.resolve(w); if(r) seen.add(r); });
  RegionUnlocks.sync(wines);
  return [...seen].filter(r=>!RegionUnlocks.isUnlocked(r));
}
function regionQuizCandidates(wines){ return _regionsWithScans(wines).filter(r=>!RegionQuizBank.isComplete(r)); }
function completedRegionQuizzes(wines){ return _regionsWithScans(wines).filter(r=>RegionQuizBank.isComplete(r)); }

/* USD → local currency, the one table every screen uses to show prices (WineDNA's average price,
   the sommelier script budget). Scan prices are stored as price_usd. */
const USD_FX={GBP:0.79,CAD:1.36,AUD:1.53,NZD:1.64,EUR:0.92,USD:1.0,JPY:150,CNY:7.2,CHF:0.88,ZAR:18.5,SGD:1.34,HKD:7.8,MXN:18,BRL:5.4,INR:83,AED:3.67,SEK:10.4,NOK:10.6,DKK:6.9};

/* The sommelier script for one wine type ("I tend to go for… around £20–£35 GBP"), shared by
   Home, WineDNA and the profile screen so they always show the same text. One cache per
   type/wine count/currency; the long script is the source of truth and the short one is
   condensed from it. The budget is computed from the prices of the scanned wines, not left to
   the model, so it's grounded and identical everywhere. */
const SommelierScript = {
  _inFlight:{},
  // The script is cached until the wines behind it change: a new scan, a score, a price paid
  // or a "buy again" all write a new one (a script written at scan time used to outlive the score).
  key(length,typeKey,sig,code){ return `vinterest_script_${length}_${typeKey}_${sig}_${code}_v5`; },
  sig(wines){
    const extra=wines.map(w=>`${(w.price_paid&&w.price_paid.amount)||''}|${w.buy_again?1:0}|${w.price_usd||''}`).join(';');
    let h=0; for(let i=0;i<extra.length;i++) h=(h*31+extra.charCodeAt(i))|0;
    return WineDNA.signature(wines)+(h>>>0).toString(36);
  },
  /* The typical spend for these wines, in local currency, rounded to friendly steps. Their own
     wines come first: what they paid where they said, otherwise the scan's estimate, leaving out
     shelf checks they didn't buy and wines they scored below 80 (a bottle they didn't enjoy isn't
     a budget to aim for). One priced wine gives "around £90"; more give the middle half of their
     prices. Only with no priced wine at all does the usual spend from onboarding stand in. */
  budget(wines,rc){
    const ps=wines.filter(w=>WineDNA.chosen(w)&&!(w.rating>0&&w.rating<ParkerScale.DISLIKED))
      .map(w=>WineDNA.priceOf(w,rc)).filter(p=>p>0).sort((a,b)=>a-b);
    const step=v=>v<50?5:v<200?10:50;
    if(!ps.length){ const b=UserPrefs.budget(rc); return !b?null:b.max==null?`${rc.base}${b.min} and up ${rc.code}`:b.min===0?`under ${rc.base}${b.max} ${rc.code}`:`${rc.base}${b.min}–${rc.base}${b.max} ${rc.code}`; }
    if(ps.length===1){ const v=Math.max(step(ps[0]),Math.round(ps[0]/step(ps[0]))*step(ps[0])); return `around ${rc.base}${v} ${rc.code}`; }
    const at=q=>ps[Math.min(ps.length-1,Math.max(0,Math.round(q*(ps.length-1))))];
    const lo=Math.max(step(at(0.25)),Math.floor(at(0.25)/step(at(0.25)))*step(at(0.25)));
    let hi=Math.ceil(at(0.75)/step(at(0.75)))*step(at(0.75));
    if(hi<=lo) hi=lo+step(lo);
    return `${rc.base}${lo}–${rc.base}${hi} ${rc.code}`;
  },
  cached(length,typeKey,wines){ return localStorage.getItem(this.key(length,typeKey,this.sig(wines),Regional.current().code)); },
  // Calls onReady(text) once the script exists (immediately if cached), or onReady(null) on failure.
  get(length,typeKey,label,wines,onReady){
    const rc=Regional.current();
    const sig=this.sig(wines);
    const kLong=this.key('long',typeKey,sig,rc.code), kShort=this.key('short',typeKey,sig,rc.code);
    const want=length==='short'?kShort:kLong;
    const hit=localStorage.getItem(want);
    if(hit){ onReady(hit); return; }
    if(this._inFlight[want]){ this._inFlight[want].push(onReady); return; }
    const waiters=this._inFlight[want]=[onReady];
    const done=text=>{ delete this._inFlight[want]; waiters.forEach(f=>f(text)); };
    const ask=prompt=>window.claude.complete({purpose:'sommelier_script',messages:[{role:'user',content:prompt}]}).then(t=>{ t=(t||'').trim(); if(!t) throw new Error('empty script'); return t; });
    const makeLong=()=>{
      const cachedLong=localStorage.getItem(kLong);
      if(cachedLong) return Promise.resolve(cachedLong);
      // Best-loved first, so the script leans on what they enjoyed (and would buy again).
      const ranked=[...wines].sort((a,b)=>(b.buy_again?1:0)-(a.buy_again?1:0)||(b.rating||0)-(a.rating||0));
      const wineList=ranked.slice(0,8).map(w=>`${w.name}${w.vintage>0?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}${w.buy_again?', would buy again':''}`).join('; ');
      const budget=this.budget(wines,rc);
      const budgetInst=budget
        ?`Include my typical budget, written exactly as "${budget}" — do not change the numbers, symbol or currency code.`
        :'Do not mention a budget or price.';
      return ask(`I've scanned these ${label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a 2 sentences max natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. ${budgetInst} Return ONLY the script text in double quotes — nothing else.`)
        .then(t=>{ localStorage.setItem(kLong,t); return t; });
    };
    makeLong()
      .then(longText=>{
        if(length!=='short') return longText;
        return ask(`Condense this sommelier script into ONE ultra-concise sentence (under 20 words), keeping the SAME style, regions and budget — copy any budget range exactly as written, never change or invent one. Script: ${longText} Return ONLY the condensed script text in double quotes — nothing else.`)
          .then(t=>{ localStorage.setItem(kShort,t); return t; });
      })
      .then(done)
      .catch(()=>done(null));
  }
};

let EXPLORE_STYLES=[];
try{ EXPLORE_STYLES=_loadJSON('data/explore-styles.json')||[]; }catch(e){ console.error('[Vinterest] explore-styles.json failed to load — Explore Next will be empty until it is deployed.',e); }

/* Explore Next (WineDNA): which styles to try next for one wine type, and the teaching content for
   each. Styles come from data/explore-styles.json, a curated catalogue with a taste profile on the
   same 0–1 scale as scanned wines, the grapes/regions each one builds on, and what it tastes like,
   why, how to spot it and what to ask for.

   Ranking: closeness of the style's profile to the user's averages for that type, a bonus when it
   builds on a grape or region they already rate highly, a penalty when it leans on one they rate
   low, and a spread across countries. A style the user has already scanned isn't suggested again;
   it's returned as "explored" with their rating, so trying a suggestion visibly closes the loop. */
const ExploreNext = {
  AXES:{body:['full body','light body','medium body'],tannins:['firm tannins','soft tannins','medium tannins'],
        acidity:['fresh, high acidity','softer acidity','balanced acidity'],sweetness:['sweetness','a dry style','a touch of sweetness']},
  _t(v){ return (v||'').toLowerCase().replace('é','e'); },
  _typeWines(typeKey,wines){ return wines.filter(w=>this._t(w.type)===typeKey); },
  _hay(w){ return [w.name,w.region,w.sub_region,...(w.grapes||[])].filter(Boolean).join(' | ').toLowerCase(); },
  // Whole-word matches against the wine's name, region and grapes, so 'kent' doesn't match
  // 'Kentucky'. Match terms are places/appellations, or the grape only where the grape is the style.
  matches(style,w){
    const h=this._hay(w);
    return (style.match||[]).some(m=>{ const i=h.indexOf(m); if(i<0) return false;
      const edge=c=>!c||!/[a-z0-9\u00c0-\u024f]/.test(c);
      for(let k=i;k>=0;k=h.indexOf(m,k+1)) if(edge(h[k-1])&&edge(h[k+m.length])) return true;
      return false; });
  },
  // The user's DNA for one type, from WineDNA so Explore Next reads the same profile, grape
  // names and scale as the rest of the tab: their 90+ wines once they have 3, else everything
  // they chose; wines scored under 80 mark the grapes/regions to steer away from.
  dna(typeKey,wines){
    const p=WineDNA.profile(typeKey,wines,typeKey);
    const lc=a=>a.map(x=>x.toLowerCase());
    const lovedSet=k=>new Set(p.loved.flatMap(k).map(x=>x.toLowerCase()));
    const lowOf=(pluck)=>{ const keep=lovedSet(pluck); return new Set(p.disliked.flatMap(pluck).map(x=>x.toLowerCase()).filter(x=>!keep.has(x))); };
    const grapes=w=>(w.grapes||[]).map(g=>WineDNA.grape(g)).filter(Boolean), region=w=>w.region?[w.region]:[];
    const avg={}; Object.keys(this.AXES).forEach(k=>{ const v=p.dnaAvg[k]!=null?p.dnaAvg[k]:p.avg[k]; if(v!=null) avg[k]=v; });
    return {wines:p.wines,avg,topGrapes:lc(p.topGrapes),topRegions:lc(p.topRegions),lowGrapes:lowOf(grapes),lowRegions:lowOf(region)};
  },
  _level(v){ return {high:0,low:1,mid:2}[WineDNA.level(v)]; },
  _cap(s){ return s.replace(/\b\w/g,c=>c.toUpperCase()); },
  // How one style relates to the user: score, the trait it shares, what it builds on, and a
  // plain-English reason naming only the user's own wines, grapes and regions.
  assess(style,dna,label){
    const axes=Object.keys(style.profile).filter(k=>dna.avg[k]!=null);
    const diffs=axes.map(k=>({k,d:Math.abs(style.profile[k]-dna.avg[k]),u:dna.avg[k]}));
    const sim=diffs.length?1-diffs.reduce((s,x)=>s+x.d,0)/diffs.length:0.5;
    const notable=diffs.filter(x=>this._level(x.u)!==2);
    const sharedAxis=(notable.length?notable:diffs).sort((a,b)=>a.d-b.d)[0];
    const shares=sharedAxis?this.AXES[sharedAxis.k][this._level(sharedAxis.u)]:null;
    // The user's best-rated bottle that actually shows the shared trait, as a concrete example.
    const ex=sharedAxis&&[...dna.wines].filter(w=>w.rating>0&&typeof w[sharedAxis.k]==='number'&&this._level(w[sharedAxis.k])===this._level(sharedAxis.u)).sort((a,b)=>b.rating-a.rating)[0];
    const has=(list,val)=>list.some(x=>x.includes(val)||val.includes(x));
    const bridge=(style.bridge.grapes||[]).find(g=>has(dna.topGrapes,g))||(style.bridge.regions||[]).find(r=>has(dna.topRegions,r))||null;
    const low=style.grapes.some(g=>dna.lowGrapes.has(g.toLowerCase()))||(style.match||[]).some(m=>[...dna.lowRegions].some(r=>r.includes(m)));
    const score=sim+(bridge?0.12:0)-(low?0.3:0);
    const lbl=label.toLowerCase();
    const why=[
      shares
        ?`${style.name} has the ${shares.replace(/^(a |an )/,'')} you go for in your ${lbl}${ex?` (think ${ex.name}, which you scored ${ex.rating})`:''}, and brings ${style.adds}.`
        :`${style.name} brings ${style.adds}, a new corner of ${lbl} for your map.`,
      bridge?`A natural next step if you enjoy ${this._cap(bridge)}.`:''
    ].filter(Boolean).join(' ');
    return {style,score,shares,bridge:bridge&&this._cap(bridge),why};
  },
  // {picks:[assessments], explored:[{style,wine}]} for one type.
  suggest(typeKey,wines,label,n=3){
    const dna=this.dna(typeKey,wines);
    const styles=EXPLORE_STYLES.filter(s=>s.type===typeKey);
    const explored=[], open=[];
    styles.forEach(s=>{
      const tried=dna.wines.filter(w=>this.matches(s,w)).sort((a,b)=>(b.rating||0)-(a.rating||0))[0];
      if(tried) explored.push({style:s,wine:tried}); else open.push(this.assess(s,dna,label));
    });
    open.sort((a,b)=>b.score-a.score);
    const picks=[], countries=new Set();
    open.forEach(a=>{ if(picks.length<n&&!countries.has(a.style.country)){ picks.push(a); countries.add(a.style.country); } });
    open.forEach(a=>{ if(picks.length<n&&!picks.includes(a)) picks.push(a); });
    return {picks,explored};
  },
  style(id){ return EXPLORE_STYLES.find(s=>s.id===id)||null; },
  forStyle(id,wines,label){ const s=this.style(id); return s?this.assess(s,this.dna(s.type,wines),label||s.type):null; },
  // "Add to Learn": a real article on the Learn shelf, written from the style's curated facts,
  // the same way unlocking a grape adds one.
  inLearn(id){ return ExposureLedger.has('explore:'+id); },
  addToLearn(id){
    const style=this.style(id);
    const archetype=ARTICLE_ARCHETYPES.find(a=>a.id==='explore_style_intro');
    if(!style||!archetype||this.inLearn(id)) return false;
    const slots={style:style.name,region:null};
    const L=style.learn;
    const stub={
      id:'ev_explore_'+id, archetypeId:archetype.id, iconName:archetype.iconName, readTime:archetype.readTime,
      title:ContentEngine.fillTpl(archetype.titleTpl,slots), subtitle:ContentEngine.fillTpl(archetype.subtitleTpl,slots),
      brief:archetype.brief, slots,
      facts:`${style.name} — ${style.region}, ${style.country}. Grapes: ${style.grapes.join(', ')}. Taste: ${L.taste} Why it tastes that way: ${L.why} On the label: ${L.label}`
    };
    let stubs=[]; try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    stubs.push(stub);
    localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    ExposureLedger.mark('explore:'+id);
    return true;
  }
};

const ContentEngine = {
  TRAIT_BASELINE:{body:0.5,tannins:0.5,acidity:0.5,sweetness:0.15},
  TRAIT_LABEL:{body:'Full-Bodied',tannins:'Tannic',acidity:'High-Acid',sweetness:'Sweet'},

  detectEvents(wines){
    const events=[];
    const rated=wines.filter(w=>w.rating>0);
    const regionCounts={},typeCounts={},grapeCounts={},producerCounts={};
    wines.forEach(w=>{
      const reg=Regions.of(w); if(reg) regionCounts[reg]=(regionCounts[reg]||0)+1;
      const t=(w.type||'').toLowerCase(); if(t) typeCounts[t]=(typeCounts[t]||0)+1;
      new Set((w.grapes||[]).map(g=>WineDNA.grape(g)).filter(Boolean)).forEach(g=>{ grapeCounts[g]=(grapeCounts[g]||0)+1; });
      if(w.producer) producerCounts[w.producer]=(producerCounts[w.producer]||0)+1;
    });

    Object.keys(regionCounts).forEach(r=>{
      const key='region:'+r;
      if(!ExposureLedger.has(key)) events.push({event:'new_region',subject:r,key});
    });
    Object.keys(typeCounts).forEach(t=>{
      const key='type:'+t;
      if(!ExposureLedger.has(key)) events.push({event:'new_type',subject:t,key});
    });
    Object.entries(grapeCounts).filter(([,n])=>n>=3).forEach(([g])=>{
      const key='grape:'+g;
      if(!ExposureLedger.has(key)) events.push({event:'grape_multi',subject:g,key});
    });
    Object.entries(producerCounts).filter(([,n])=>n>=2).forEach(([p])=>{
      const key='producer:'+p;
      if(!ExposureLedger.has(key)) events.push({event:'producer_repeat',subject:p,key,meta:{count:producerCounts[p]}});
    });

    if(rated.length>=4){
      ['body','tannins','acidity','sweetness'].forEach(trait=>{
        const vals=rated.map(w=>w[trait]).filter(v=>v!=null);
        if(!vals.length) return;
        const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
        const base=this.TRAIT_BASELINE[trait];
        if(Math.abs(avg-base)>=0.22){
          const key='trait:'+trait;
          if(!ExposureLedger.has(key)) events.push({event:'trait_signature',subject:this.TRAIT_LABEL[trait],key,meta:{trait}});
        }
      });
      rated.forEach(w=>{
        if(w.rating<90) return;
        ['body','tannins'].forEach(trait=>{
          if(w[trait]==null) return;
          const others=rated.filter(x=>x!==w).map(x=>x[trait]).filter(v=>v!=null);
          if(others.length<3) return;
          const avg=others.reduce((a,b)=>a+b,0)/others.length;
          if(Math.abs(w[trait]-avg)>=0.32){
            const key='contradiction:'+(w.id||w.name)+':'+trait;
            if(!ExposureLedger.has(key)) events.push({event:'contradiction',subject:w.name,key,meta:{trait,rating:w.rating,wineName:w.name}});
          }
        });
      });
    }

    const md=MasterySystem.get();
    CONCEPTS.forEach(c=>{
      const rec=md[c.id];
      if(rec&&rec.wrong>0&&!rec.mastered){
        const key='concept:'+c.id;
        if(!ExposureLedger.has(key)) events.push({event:'quiz_failed_concept',subject:c.label,key,meta:{conceptLabel:c.label}});
      }
    });

    const terms=VocabLedger.getAll();
    terms.forEach(t=>{
      const d=t.term.toLowerCase();
      if(KNOWLEDGE.descriptors[d]){
        const key='descriptor:'+d;
        if(!ExposureLedger.has(key)) events.push({event:'vocab_match',subject:t.term,key,meta:{descriptor:t.term}});
      }
    });

    return events;
  },

  buildSlots(ev, wines){
    const s={};
    if(ev.event==='new_region'||ev.event==='trait_signature'||ev.event==='contradiction'||ev.event==='quiz_failed_concept'||ev.event==='vocab_match') s.region=ev.subject;
    if(ev.event==='new_region'){
      s.region=ev.subject;
      const match=wines.find(w=>Regions.of(w)===ev.subject&&w.country);
      if(match) s.country=match.country;
      else if(KNOWLEDGE.regions[ev.subject]) s.country=KNOWLEDGE.regions[ev.subject].country;
      const b=this.compareRegion(ev.subject,wines); if(b) s.regionB=b;
    }
    if(ev.event==='new_type') s.type=ev.subject[0].toUpperCase()+ev.subject.slice(1);
    if(ev.event==='grape_multi'){ s.grape=ev.subject; s.count=wines.filter(w=>(w.grapes||[]).some(g=>WineDNA.grape(g)===ev.subject)).length; }
    if(ev.event==='producer_repeat'){ s.producer=ev.subject; s.count=ev.meta.count; }
    if(ev.event==='trait_signature') s.trait=ev.subject;
    if(ev.event==='contradiction'){ s.trait=this.TRAIT_LABEL[ev.meta.trait]; s.rating=ev.meta.rating; s.wineName=ev.meta.wineName; }
    if(ev.event==='quiz_failed_concept') s.conceptLabel=ev.meta.conceptLabel;
    if(ev.event==='vocab_match') s.descriptor=ev.meta.descriptor;
    return s;
  },

  fillTpl(tpl,slots){ let s=tpl; Object.keys(slots).forEach(k=>{ s=s.split('{{'+k+'}}').join(slots[k]??''); }); return s; },

  /* The region a new one is compared with: the knowledge-base region they drink most of the same
     kind of wine (reds against reds), with 2+ bottles, so "From Rioja to Tuscany" means something.
     null when there isn't one: a Champagne isn't taught by contrast with their Rioja. */
  compareRegion(region,wines){
    const types=new Set((wines||[]).filter(w=>Regions.of(w)===region).map(w=>WineDNA._t(w.type)));
    const counts={};
    (wines||[]).forEach(w=>{ const r=Regions.resolve(w); if(r&&r!==region&&types.has(WineDNA._t(w.type))) counts[r]=(counts[r]||0)+1; });
    const best=Object.entries(counts).filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1])[0];
    return best?best[0]:null;
  },

  /* Which kind of piece to write for an event: the one the shelf has least of, so five new
     regions become five different kinds of article, not five "Beyond Rioja"s. */
  _candidates(event,slots){
    const row=TRIGGERS.find(t=>t.event===event);
    if(!row) return [];
    return row.archetypeIds.map(id=>ARTICLE_ARCHETYPES.find(a=>a.id===id)).filter(a=>a&&a.needs.every(n=>slots[n]!=null&&slots[n]!==''));
  },
  pickArchetype(ev, slots, stubs){
    const candidates=this._candidates(ev.event,slots);
    if(!candidates.length) return null;
    const used=id=>(stubs||[]).filter(s=>s.archetypeId===id).length;
    const min=Math.min(...candidates.map(a=>used(a.id)));
    const least=candidates.filter(a=>used(a.id)===min);
    return least[Math.floor(Math.random()*least.length)];
  },

  retrieveFacts(archetype, slots){
    const lines=[];
    if(slots.region&&KNOWLEDGE.regions[slots.region]){
      const r=KNOWLEDGE.regions[slots.region];
      lines.push(`${slots.region} (${r.country}): classification ${r.classification}. Key grapes: ${r.keyGrapes.join(', ')}. Climate: ${r.climate}. Aging/rules: ${r.agingRules}. Classic producers: ${r.classicProducers.join(', ')}.`);
    }
    if(slots.regionB&&KNOWLEDGE.regions[slots.regionB]){
      const r=KNOWLEDGE.regions[slots.regionB];
      lines.push(`${slots.regionB} (${r.country}): classification ${r.classification}. Key grapes: ${r.keyGrapes.join(', ')}. Climate: ${r.climate}.`);
    }
    if(slots.grape&&KNOWLEDGE.grapes[slots.grape]){
      const g=KNOWLEDGE.grapes[slots.grape];
      lines.push(`${slots.grape}: ${g.profile} Famous in: ${g.famousIn.join(', ')}.`);
    }
    if(slots.descriptor){
      const d=KNOWLEDGE.descriptors[slots.descriptor.toLowerCase()];
      if(d) lines.push(`${slots.descriptor}: ${d.cause}`);
    }
    return lines.join('\n')||'No specific retrieved facts for this subject — keep claims general and hedge appropriately.';
  },

  /* Pushed directly when a grape gets unlocked (via rating or manual Pro unlock) — reuses the
     grape_thread archetype rather than the trigger/event queue, since unlocking is the event. */
  addGrapeArticle(grape, wines){
    const archetype=ARTICLE_ARCHETYPES.find(a=>a.id==='grape_unlock_intro');
    if(!archetype) return;
    const key='grapeunlock:'+grape;
    if(ExposureLedger.has(key)) return;
    const slots={grape,count:Math.max(1,wines.filter(w=>(w.grapes||[]).some(g=>WineDNA.grape(g)===grape)).length)};
    const stub={
      id:'ev_'+key.replace(/[^a-z0-9]+/gi,'_'),
      archetypeId:archetype.id,
      iconName:archetype.iconName,
      readTime:archetype.readTime,
      title:this.fillTpl(archetype.titleTpl,slots),
      subtitle:this.fillTpl(archetype.subtitleTpl,slots),
      brief:archetype.brief,
      slots,
      facts:this.retrieveFacts(archetype,slots)
    };
    let stubs=[];
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    stubs.push(stub);
    localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    ExposureLedger.mark(key);
  },

  /* Region pieces come in series (every new region gets a "First taste", every region with enough
     scans a "vs. the textbook"), so the title carries the series and the subtitle says something
     about this region in particular: its grapes and climate or rules from the knowledge base,
     otherwise what the user has actually picked from there. Never leaves a {{placeholder}}. */
  subtitleFor(archetype, slots, wines){
    const region=slots.region, K=region&&KNOWLEDGE.regions[region];
    const list=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a[a.length-1]:a[0];
    const mine=(wines||[]).filter(w=>Regions.of(w)===region);
    const grapeCounts={}; mine.forEach(w=>(w.grapes||[]).slice(0,1).forEach(g=>{ const k=WineDNA.grape(g); if(k) grapeCounts[k]=(grapeCounts[k]||0)+1; }));
    const myGrape=Object.entries(grapeCounts).sort((a,b)=>b[1]-a[1])[0];
    const lower=t=>t?t.charAt(0).toLowerCase()+t.slice(1):t;
    if(archetype.id==='new_region_intro'&&region){
      if(K) return `Home of ${list(K.keyGrapes)}. ${K.climate.replace(/\s+—\s+/g,': ').replace(/\.$/,'')}.`;
      if(myGrape) return `Where your ${myGrape[0]} came from, and what the place gives the wine`;
    }
    if(archetype.id==='palate_vs_textbook'&&region){
      const yours=mine.length===1?'does the bottle you picked':mine.length?`do the ${mine.length} bottles you picked`:'do your picks';
      if(K) return `Textbook ${region} is ${list(K.keyGrapes)}. How ${yours} compare?`;
      if(myGrape) return `You've picked ${mine.length} from here, mostly ${myGrape[0]}. How classic ${mine.length===1?'is it':'are they'}?`;
    }
    if(archetype.id==='region_rules'&&K) return `${K.classification}: what the words on a ${region} label promise`;
    if(archetype.id==='beyond_region'&&region&&slots.regionB){
      const B=KNOWLEDGE.regions[slots.regionB], gA=K&&K.keyGrapes[0], gB=B&&B.keyGrapes[0];
      if(gA&&gB) return gA===gB?`Same ${gA} as your ${slots.regionB}, different place. What ${region} does to it.`
        :`Your ${slots.regionB} is mostly ${gB}. ${region} is ${gA}: what changes in the glass, and why.`;
      return `You know ${slots.regionB}. Here's what changes in ${region}.`;
    }
    if((archetype.id==='grape_unlock_intro'||archetype.id==='grape_deep_dive')&&slots.grape){
      const mineG=(wines||[]).filter(w=>(w.grapes||[]).some(g=>WineDNA.grape(g)===slots.grape));
      const top=[...mineG].sort((a,b)=>(b.rating||0)-(a.rating||0))[0];
      if(top&&archetype.id==='grape_unlock_intro') return top.rating>0?`You scored ${top.name} ${top.rating}. Here's what ${slots.grape} brought to it.`:`You met it in ${top.name}. Here's what makes it taste the way it does.`;
      const G=KNOWLEDGE.grapes[slots.grape];
      if(archetype.id==='grape_deep_dive'&&G&&G.famousIn.length>1) return `${slots.grape} in ${list(G.famousIn.slice(0,3))}: what changes when it moves`;
    }
    const out=this.fillTpl(archetype.subtitleTpl,slots);
    return /\{\{/.test(out)?out.replace(/[,:—-]?\s*[^,:—-]*\{\{[^}]*\}\}[^,:—-]*/g,'').trim():out;
  },

  buildStub(archetype, ev, wines, slots){
    slots=slots||this.buildSlots(ev,wines);
    return {
      id:'ev_'+ev.key.replace(/[^a-z0-9]+/gi,'_')+'_'+archetype.id,
      archetypeId:archetype.id,
      iconName:archetype.iconName,
      readTime:archetype.readTime,
      series:archetype.series||null,
      title:this.fillTpl(archetype.titleTpl,slots),
      subtitle:this.subtitleFor(archetype,slots,wines),
      brief:archetype.brief,
      slots,
      facts:this.retrieveFacts(archetype,slots)
    };
  },

  /* Re-fills title/subtitle from stored slots for every stub — heals any stub persisted before a
     template or slot-resolution fix, without needing to wipe the user's saved article list.
     Also backfills any `needs` slot the stub's saved slots are missing (e.g. `country`, added to
     buildSlots after some stubs already existed) — otherwise re-filling with the current template
     just swaps in a fresh, still-unresolved {{placeholder}} instead of fixing it. */
  _healStubs(stubs, wines){
    let changed=false;
    stubs.forEach((stub,i)=>{
      if(!stub.slots) return;
      if(this._rotate(stub,stubs.slice(0,i),wines)) changed=true;
      const archetype=ARTICLE_ARCHETYPES.find(a=>a.id===stub.archetypeId);
      if(!archetype) return;
      (archetype.needs||[]).forEach(n=>{
        if(stub.slots[n]!=null&&stub.slots[n]!=='') return;
        if(n==='country'&&stub.slots.region){
          const match=(wines||[]).find(w=>Regions.of(w)===stub.slots.region&&w.country);
          stub.slots.country=match?match.country:KNOWLEDGE.regions[stub.slots.region]?.country;
        }
      });
      if(archetype.id==='explore_style_intro') return;
      const title=this.fillTpl(archetype.titleTpl,stub.slots);
      const subtitle=this.subtitleFor(archetype,stub.slots,wines);
      const series=archetype.series||null;
      if(title!==stub.title||subtitle!==stub.subtitle||series!==(stub.series||null)){ stub.title=title; stub.subtitle=subtitle; stub.series=series; changed=true; }
    });
    return changed;
  },

  /* A region piece nobody has opened yet (not read, not written) that repeats an earlier piece's
     kind, or compares with a region that no longer fits (compareRegion), becomes the kind the
     shelf has least of. Heals shelves built when the kind was picked at random. */
  _untouched(stub){ return !localStorage.getItem('vinterest_gen_article_'+stub.id+'_done')&&!localStorage.getItem('vinterest_gen_article_'+stub.id+'_content'); },
  _rotate(stub,before,wines){
    const row=TRIGGERS.find(t=>t.event==='new_region');
    if(!row||!row.archetypeIds.includes(stub.archetypeId)||!stub.slots.region||!this._untouched(stub)) return false;
    const slots={...stub.slots}; delete slots.regionB;
    const b=this.compareRegion(slots.region,wines||[]); if(b) slots.regionB=b;
    const repeat=before.some(s=>s.archetypeId===stub.archetypeId);
    const staleB=stub.archetypeId==='beyond_region'&&slots.regionB!==stub.slots.regionB;
    if(!repeat&&!staleB) return false;
    const archetype=this.pickArchetype({event:'new_region'},slots,before);
    if(!archetype) return false;
    Object.assign(stub,{archetypeId:archetype.id,iconName:archetype.iconName,readTime:archetype.readTime,series:archetype.series||null,brief:archetype.brief,slots,facts:this.retrieveFacts(archetype,slots)});
    return true;
  },

  /* ── Written for you ──
     Every shelf piece starts from the user's own wines. _related finds the bottles a piece is
     about; because() is the line that says so on the card; readerBrief() is what the article
     prompt knows about them (their bottles, scores, prices, WineDNA and usual spend), so the
     one Claude call per article, cached for good, writes for this reader and nobody else. */
  _related(slots,wines){
    const s=slots||{};
    const hit=w=>s.wineName?w.name===s.wineName
      :s.region?Regions.of(w)===s.region
      :s.grape?(w.grapes||[]).some(g=>WineDNA.grape(g)===WineDNA.grape(s.grape))
      :s.producer?w.producer===s.producer
      :s.type?WineDNA._t(w.type)===WineDNA._t(s.type)
      :false;
    const when=w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0;
    return (wines||[]).filter(hit).sort((a,b)=>(b.rating||0)-(a.rating||0)||when(b)-when(a));
  },
  because(stub,wines){
    const s=(stub&&stub.slots)||{};
    const w=this._related(s,wines||WineHistory.getAll())[0];
    if(w) return w.rating>0?`Because you gave ${w.name} ${/^(8|11|18)/.test(String(w.rating))?'an':'a'} ${w.rating}`:`Because you scanned ${w.name}`;
    if(s.grape) return `Because you unlocked ${s.grape}`;
    if(s.region) return `Because you unlocked ${s.region}`;
    if(s.conceptLabel) return 'Because a quiz question caught you out';
    if(s.descriptor) return `Because "${s.descriptor}" came up in your tasting notes`;
    if(s.trait) return 'Because of a pattern in your scores';
    return 'Picked from your WineDNA';
  },
  /* The kind of wine a piece is about: its type slot, its bottles, or its grape's colour. null for
     pieces about an idea (a concept, a tasting word) rather than a wine. */
  _subjectType(slots,rel){
    const s=slots||{};
    if(s.type) return WineDNA._t(s.type);
    if(rel&&rel.length) return WineDNA._t(rel[0].type);
    if(s.grape&&typeof GRAPE_TYPES!=='undefined'){ const k=GrapeUnlocks.key(s.grape); if(k&&GRAPE_TYPES[k]) return GRAPE_TYPES[k]; }
    return null;
  },
  _typeLabel(k){ const t=typeof _TYPES!=='undefined'&&_TYPES.find(x=>x.key===k); return t?t.label:k; },
  readerBrief(stub,wines){
    wines=wines||WineHistory.getAll();
    const rc=Regional.current(), out=[];
    const rel=this._related(stub&&stub.slots,wines);
    const cmp=ScanFlow.COMPARE;
    const line=w=>{
      const b=[w.name+(w.vintage>0?' '+w.vintage:'')+(w.region?` (${w.region})`:'')];
      b.push(w.rating>0?`scored ${w.rating}, ${ParkerScale.label(w.rating)}`:'not scored yet');
      const p=WineDNA.priceOf(w,rc); if(p) b.push(`${w.price_paid&&w.price_paid.amount>0?'paid':'about'} ${rc.base}${Math.round(p)}`);
      if(w.buy_again) b.push('would buy again');
      const t=w.tasted?Object.entries(w.tasted).filter(([k,d])=>d&&cmp[k]).map(([k,d])=>`${cmp[k][d>0?1:0].toLowerCase()} than the label suggested`):[];
      if(t.length) b.push('they found it '+t.join(' and '));
      return '- '+b.join(', ');
    };
    if(rel.length) out.push('Their own bottles on this subject:\n'+rel.slice(0,5).map(line).join('\n'));
    else out.push('They have no bottles on this subject yet: it is new to them.');
    // Their WineDNA only for the kind of wine the piece is about: a Pinot Grigio piece draws on
    // their whites, never their reds. Only "Entering <type>" is about the contrast, so it also
    // gets what they mostly drink.
    const typeKey=this._subjectType(stub&&stub.slots,rel);
    const dna=(k,heading)=>{
      const p=WineDNA.profile(k,wines,this._typeLabel(k));
      if(!p.wines.length) return false;
      out.push(`${heading||`Their WineDNA for ${p.label.toLowerCase()}`}:\n`+WineDNA.summaryFacts(p));
      const budget=SommelierScript.budget(p.wines,rc); if(budget) out.push(`What they usually spend on ${p.label.toLowerCase()}: ${budget}.`);
      return true;
    };
    if(typeKey&&!dna(typeKey)) out.push(`They haven't had any ${this._typeLabel(typeKey).toLowerCase()} yet, so there's no WineDNA for it.`);
    if(stub&&stub.archetypeId==='new_type_entry'){
      const counts={}; wines.forEach(w=>{ const t=WineDNA._t(w.type); if(t&&t!==typeKey) counts[t]=(counts[t]||0)+1; });
      const usual=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(e=>e[0])[0];
      if(usual) dna(usual,`What they mostly drink (${this._typeLabel(usual).toLowerCase()}), to contrast with`);
    }
    return out.join('\n\n');
  },

  /* Unread pieces about this wine type's bottles, for the WineDNA tab. */
  forType(typeKey,wines){
    wines=wines||WineHistory.getAll();
    return (this.shelf(wines)||[]).filter(s=>!localStorage.getItem('vinterest_gen_article_'+s.id+'_done')&&!this.stubLocked(s)&&this._related(s.slots,wines).some(w=>WineDNA._t(w.type)===typeKey));
  },

  /* A region piece about a region past the free allowance is shown locked, with Pro. */
  stubLocked(stub){ const r=stub&&stub.slots&&stub.slots.region; return !!(r&&KNOWLEDGE.regions[r]&&!RegionUnlocks.isUnlocked(r)); },

  /* The saved shelf, healed (templates and subtitles as they are now) every time it's read, not
     only when new articles are added: otherwise old cards keep a leaked {{country}}. */
  shelf(wines){
    let stubs=null;
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'null'); }catch(e){}
    if(!Array.isArray(stubs)) return stubs;
    if(this._healStubs(stubs,wines||WineHistory.getAll())) localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    return stubs;
  },

  refreshShelf(wines, maxUnread){
    maxUnread=maxUnread||6;
    let stubs=[];
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    let healed=this._healStubs(stubs,wines);
    const unreadCount=stubs.filter(s=>!localStorage.getItem('vinterest_gen_article_'+s.id+'_done')).length;
    const need=maxUnread-unreadCount;
    if(need<=0||!wines.length) return stubs;
    const events=this.detectEvents(wines);
    let added=0;
    for(const ev of events){
      if(added>=need) break;
      const slots=this.buildSlots(ev,wines);
      const archetype=this.pickArchetype(ev,slots,stubs);
      if(!archetype) continue;
      const stub=this.buildStub(archetype,ev,wines,slots);
      stubs.push(stub);
      ExposureLedger.mark(ev.key);
      added++;
    }
    if(added>0||healed) localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    return stubs;
  }
};
