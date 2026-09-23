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

const GrapeUnlocks = Object.assign(_accountStore('vinterest_grape_unlocks_v1'), {
  fresh(){ return {unlocked:{}}; },
  all(){ return this.get().unlocked; },
  isUnlocked(g){ return !!this.get().unlocked[g]; },
  count(){ return Object.keys(this.get().unlocked).length; },
  unlockViaRating(grape){
    if(!grape||!GRAPE_ALLOWLIST.includes(grape)) return false;
    const d=this.get();
    if(d.unlocked[grape]) return false;
    const isPro=!!localStorage.getItem('vinterest_pro');
    if(!isPro && this.count()>=FREE_GRAPE_CAP) return false;
    d.unlocked[grape]={via:'rated',at:Date.now()};
    this.save(d);
    try{ ContentEngine.addGrapeArticle(grape,WineHistory.getAll()); }catch(e){}
    try{ prefetchGrapeQuiz(grape); }catch(e){}
    return true;
  },
  unlockManual(grape){
    if(!grape||!GRAPE_ALLOWLIST.includes(grape)) return false;
    if(!localStorage.getItem('vinterest_pro')) return false;
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
  const cached=localStorage.getItem(key);
  if(cached){ try{ onReady(JSON.parse(cached)); return; }catch(e){} }
  if(_grapeQuizInFlight.has(grape)){
    const wait=()=>{
      const c=localStorage.getItem(key);
      if(c){ try{ onReady(JSON.parse(c)); return; }catch(e){} }
      if(_grapeQuizInFlight.has(grape)) setTimeout(wait,300);
      else onReady(null);
    };
    wait();
    return;
  }
  _grapeQuizInFlight.add(grape);
  const g=KNOWLEDGE.grapes[grape];
  const facts=g?`${grape}: ${g.profile} Famous in: ${g.famousIn.join(', ')}.`:`${grape}: no specific retrieved facts — keep questions general and safely factual.`;
  const prompt=ContentEngine.fillTpl(_loadTextSync('prompts/grape-quiz.txt'),{grape,facts});
  window.claude.complete({purpose:'grape_quiz',max_tokens:4096,messages:[{role:'user',content:prompt}]})
    .then(text=>{
      let cleaned=text.replace(/```json|```/g,'').trim();
      const s=cleaned.indexOf('['); const e=cleaned.lastIndexOf(']');
      if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
      const qs=JSON.parse(cleaned);
      localStorage.setItem(key,JSON.stringify(qs));
      onReady(qs);
    })
    .catch(()=>onReady(null))
    .finally(()=>_grapeQuizInFlight.delete(grape));
}
/* Progress through a grape's cached 15-question bank lives in QuizMastery under 'grape:<name>';
   a grape is complete once every question in its bank has been answered correctly. */
function grapeQuizBank(grape){ try{ const qs=JSON.parse(localStorage.getItem(_grapeQuizCacheKey(grape))||'null'); return Array.isArray(qs)?qs:null; }catch(e){ return null; } }
function grapeQuizComplete(grape){ const bank=grapeQuizBank(grape); return !!bank&&QuizMastery.isComplete('grape:'+grape,bank); }
/* Fire-and-forget: warms the cache so a later tap on this grape is instant. Safe to call redundantly. */
function prefetchGrapeQuiz(grape){
  if(!grape||!GRAPE_ALLOWLIST.includes(grape)) return;
  if(localStorage.getItem(_grapeQuizCacheKey(grape))) return;
  getGrapeQuiz(grape,()=>{});
}
