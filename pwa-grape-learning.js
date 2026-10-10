/* Vinterest — Grape Learning: allowlist, per-grape unlock state, and generated practice quizzes.
   Account-keyed like pwa-mastery.js. Auto-unlocks on RATING a wine of that grape (free + paid) —
   scanning alone never unlocks. Paid users can also unlock manually from the Learn tab, uncapped.
   Free users are capped at FREE_GRAPE_CAP unlocks, earned only via rating. */

let GRAPE_ALLOWLIST=[];
try{ GRAPE_ALLOWLIST=_loadJSON('data/grapes-allowlist.json')||[]; }catch(e){ console.error('[Vinterest] grapes-allowlist.json failed to load — Your Grapes will be empty until it is deployed.',e); }
const FREE_GRAPE_CAP = 5;

/* Primary wine-style association per grape, for color-coding in the Learn tab's grape tiles —
   matches the type keys _TYPE_COLORS (pwa-screens-wineiq.jsx) already uses. A grape can make more
   than one style (Grenache rosé, Chardonnay sparkling); this is its single best-known default, not
   an exhaustive list. Sparkling and orange aren't styles any of these 50 grapes are most famous
   for on their own, so neither appears here. */
const GRAPE_TYPES = {
  'Cabernet Sauvignon':'red','Merlot':'red','Pinot Noir':'red','Syrah':'red','Malbec':'red',
  'Zinfandel':'red','Sangiovese':'red','Tempranillo':'red','Nebbiolo':'red','Grenache':'red',
  'Cabernet Franc':'red','Petit Verdot':'red','Carignan':'red','Mourvèdre':'red','Barbera':'red',
  'Gamay':'red','Montepulciano':'red','Primitivo':'red','Touriga Nacional':'fortified',
  'Carmenère':'red','Pinotage':'red','Petite Sirah':'red','Aglianico':'red','Corvina':'red',
  'Cinsault':'red','Xinomavro':'red','Zweigelt':'red',
  'Chardonnay':'white','Sauvignon Blanc':'white','Riesling':'white','Pinot Grigio':'white',
  'Viognier':'white','Gewürztraminer':'white','Chenin Blanc':'white','Albariño':'white',
  'Grüner Veltliner':'white','Sémillon':'white','Vermentino':'white','Verdejo':'white',
  'Torrontés':'white','Marsanne':'white','Roussanne':'white','Assyrtiko':'white',
  'Garganega':'white','Fiano':'white','Pinot Blanc':'white','Melon de Bourgogne':'white',
  'Trebbiano':'white',
  'Muscat':'dessert','Furmint':'dessert'
};
function grapeTypeColor(grape){ return (_TYPE_COLORS&&_TYPE_COLORS[GRAPE_TYPES[grape]])||C.mid; }
/* The colour of a grape's skin, which isn't always its wine's: Touriga Nacional is a red grape
   made into Port, Muscat and Furmint white grapes made sweet, and Pinot Grigio and
   Gewürztraminer have pink-grey skins. Mastery's grape cluster draws each berry in it. */
const GRAPE_PINK_SKINS=new Set(['Pinot Grigio','Gewürztraminer']);
function grapeSkin(grape){ const t=GRAPE_TYPES[grape]; return GRAPE_PINK_SKINS.has(grape)?'pink':t==='red'||t==='fortified'?'red':'white'; }

/* A grape's own page (GrapeScreen): everything data/knowledge.json knows about it (profile,
   origin, where it's famous, the wines made from it, climate, winemaking, food, ageing,
   look-alikes, blends, and how its bunch looks, for the sketch), the knowledge-base regions
   that grow it, their own bottles of it (WineDNA.grape, so Shiraz counts as Syrah; listed on the
   page, each opening its wine) and where
   they stand with it in Mastery. */
const GrapeInfo = {
  get(name,wines){
    const K=typeof KNOWLEDGE!=='undefined'&&KNOWLEDGE.grapes&&KNOWLEDGE.grapes[name];
    if(!K) return null;
    wines=wines||WineHistory.getAll();
    const mine=wines.filter(w=>(w.grapes||[]).some(g=>WineDNA.grape(g)===name));
    const scored=mine.filter(w=>w.rating>0).sort((a,b)=>b.rating-a.rating);
    const when=w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0;
    // Their bottles of it for the page's list: scored best first, then unscored, newest first.
    const list=[...mine].sort((a,b)=>(b.rating||0)-(a.rating||0)||when(b)-when(a));
    const regions=Object.entries(KNOWLEDGE.regions||{}).filter(([,r])=>(r.keyGrapes||[]).some(g=>WineDNA.grape(g)===name)).map(([n])=>n);
    const m=KnowledgeMap.compute(wines), area=m.areas.find(a=>a.id==='grapes'), it=area&&area.items.find(i=>i.name===name);
    const state=it?'open':GrapeUnlocks.held().includes(name)?'held':'locked';
    return {name,skin:grapeSkin(name),type:GRAPE_TYPES[name],...K,look:K.look||{berry:'medium',bunch:'medium',notes:[]},regions,
      mine:{count:mine.length,wines:list,scored:scored.length,best:scored[0]||null,avg:scored.length?Math.round(scored.reduce((a,w)=>a+w.rating,0)/scored.length):null},
      mastery:{state,score:it?it.score:0,level:it?it.level:'Not started',fading:it?it.fading||0:0,
        rise:it?KnowledgeMap.itemRise(KnowledgeMap.progress(m),'grapes',name,it.score):0}};
  },
  /* The two callouts the reveal writes on the sketch: its skin (colour) and its bunch (shape). */
  lookWords(info){
    const look=info.look||{}, skin={red:'Red-skinned',white:'White-skinned',pink:'Pink-skinned'}[info.skin]||'';
    const colour=[skin,(look.notes||[])[0]].filter(Boolean).join(': ');
    const shape=`${{small:'Small',medium:'Medium',large:'Large'}[look.berry]||'Medium'} berries in a ${{tight:'tightly packed',medium:'medium',loose:'loose'}[look.bunch]||'medium'} bunch`;
    return [colour,shape].filter(Boolean);
  },
  /* How the page's sketch draws its bunch: how many berries and how tightly packed. */
  sketch(look){
    const n={small:24,medium:19,large:13}[look&&look.berry]||19;
    const fill={tight:0.86,medium:0.78,loose:0.6}[look&&look.bunch]||0.78;
    return {n,fill};
  },
};

/* The unlocks that are open: all of them with Pro. Otherwise everything unlocked before
   UNLOCKS_KEPT_BEFORE stays open (the allowance used to be checked only when unlocking, so
   earlier extras are kept), and later unlocks fill whatever is left of `cap`, oldest first.
   Shared by GrapeUnlocks and RegionUnlocks. */
const UNLOCKS_KEPT_BEFORE=Date.UTC(2026,8,28); // 28 Sep 2026
function _openUnlocks(stored,cap,pro){
  if(pro) return stored;
  const at=x=>(x&&x.at)||0;
  const sorted=Object.entries(stored||{}).sort(([a,x],[b,y])=>at(x)-at(y)||a.localeCompare(b));
  const kept=sorted.filter(([,x])=>at(x)<UNLOCKS_KEPT_BEFORE);
  const later=sorted.filter(([,x])=>at(x)>=UNLOCKS_KEPT_BEFORE).slice(0,Math.max(0,cap-kept.length));
  return Object.fromEntries([...kept,...later]);
}

const GrapeUnlocks = Object.assign(_accountStore('vinterest_grape_unlocks_v1'), {
  fresh(){ return {unlocked:{}}; },
  /* What's open now. Free: the first FREE_GRAPE_CAP grapes they unlocked, in the order they did,
     however more came to be stored (unlocked while Pro was on, merged from another phone by sync
     or a backup). The rest are held, progress and all, and open again with Pro. Everything that
     asks "is this grape open?" goes through here, so the free allowance holds everywhere. */
  all(){ return _openUnlocks(this.get().unlocked,FREE_GRAPE_CAP,Entitlement.isPro()); },
  /* Stored but waiting for Pro. */
  held(){ const open=this.all(); return Object.keys(this.get().unlocked).filter(g=>!open[g]); },
  isUnlocked(g){ return !!this.all()[g]; },
  count(){ return Object.keys(this.all()).length; },
  /* The allowlist name for a grape as it appears on a label, through synonyms: "Shiraz" is
     Syrah, "Garnacha" is Grenache, "Pinot Gris" is Pinot Grigio. null if it isn't one of the 50. */
  key(grape){
    if(!grape) return null;
    const c=WineDNA.grape(grape);
    return GRAPE_ALLOWLIST.includes(c)?c:null;
  },
  unlockViaRating(grape){
    grape=this.key(grape);
    if(!grape) return false;
    const d=this.get();
    if(d.unlocked[grape]) return false;
    const isPro=Entitlement.isPro();
    if(!isPro && Object.keys(d.unlocked).length>=FREE_GRAPE_CAP) return false;
    d.unlocked[grape]={via:'rated',at:Date.now()};
    this.save(d);
    try{ ContentEngine.addGrapeArticle(grape,WineHistory.getAll()); }catch(e){}
    try{ prefetchGrapeQuiz(grape); }catch(e){}
    return true;
  },
  /* Scanning a bottle opens its grape too (someone shopping may not rate it yet), within the same
     free allowance. A grape only guessed for the wine (grapes_basis 'typical') doesn't count. */
  unlockViaScan(wine){
    if(!wine||wine.grapes_basis==='typical') return false;
    return this.unlockViaRating((wine.grapes||[])[0]);
  },
  unlockManual(grape){
    if(!grape||!GRAPE_ALLOWLIST.includes(grape)) return false;
    if(!Entitlement.isPro()) return false;
    const d=this.get();
    if(d.unlocked[grape]) return true;
    d.unlocked[grape]={via:'manual',at:Date.now()};
    this.save(d);
    try{ ContentEngine.addGrapeArticle(grape,WineHistory.getAll()); }catch(e){}
    try{ prefetchGrapeQuiz(grape); }catch(e){}
    return true;
  }
});

/* Generated once per grape, cached forever (facts don't change) — 15 questions (5 easy/5 medium/5
   hard), grounded in data/knowledge.json so the model summarizes real facts rather than inventing.
   Generation itself takes a real few seconds (15 questions with explanations, out of Claude) — the
   _grapeQuizInFlight guard means a background prefetch (fired the moment a grape unlocks, or for
   already-unlocked grapes when the Learn tab mounts) and a later tap on the same grape share one
   request instead of firing a duplicate, so by the time someone actually opens a grape's quiz it
   has often already finished generating in the background. */
function _grapeQuizCacheKey(grape){ return 'vinterest_grape_quiz_'+grape.replace(/\s+/g,'_'); }
const _grapeQuizInFlight=new Set();
function getGrapeQuiz(grape, onReady){
  const key=_grapeQuizCacheKey(grape);
  const cached=Store.get(key);
  if(cached){ const b=grapeQuizBank(grape); if(b){ onReady(b); return; } }
  if(_grapeQuizInFlight.has(grape)){
    const wait=()=>{
      const b=Store.get(key)&&grapeQuizBank(grape);
      if(b){ onReady(b); return; }
      if(_grapeQuizInFlight.has(grape)) setTimeout(wait,300);
      else onReady(null);
    };
    wait();
    return;
  }
  _grapeQuizInFlight.add(grape);
  const facts=grapeFactsText(grape)||`${grape}: no specific retrieved facts — keep questions general and safely factual.`;
  const prompt=ContentEngine.fillTpl(_loadTextSync('prompts/grape-quiz.txt'),{grape,facts});
  window.claude.complete({purpose:'grape_quiz',max_tokens:4096,messages:[{role:'user',content:prompt}]})
    .then(text=>{
      let cleaned=text.replace(/```json|```/g,'').trim();
      const s=cleaned.indexOf('['); const e=cleaned.lastIndexOf(']');
      if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
      const qs=QuizMastery.distinct(JSON.parse(cleaned),grape);
      Store.set(key,JSON.stringify(qs));
      onReady(qs);
    })
    .catch(()=>onReady(null))
    .finally(()=>_grapeQuizInFlight.delete(grape));
}
/* Progress through a grape's cached 15-question bank lives in QuizMastery under 'grape:<name>';
   a grape is complete once every question in its bank has been answered correctly. */
// Near-duplicates are filtered on read too, so banks saved before the filter existed are cleaned.
function grapeQuizBank(grape){ try{ return QuizMastery.distinctStored(Store.get(_grapeQuizCacheKey(grape)),grape); }catch(e){ return null; } }
function grapeQuizComplete(grape){ const bank=grapeQuizBank(grape); return !!bank&&QuizMastery.isComplete('grape:'+grape,bank); }
/* Fire-and-forget: warms the cache so a later tap on this grape is instant. Safe to call redundantly. */
function prefetchGrapeQuiz(grape){
  if(!grape||!GRAPE_ALLOWLIST.includes(grape)) return;
  if(Store.get(_grapeQuizCacheKey(grape))) return;
  getGrapeQuiz(grape,()=>{});
}
