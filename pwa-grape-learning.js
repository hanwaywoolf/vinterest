/* Vinterest — Grape Learning: allowlist, per-grape unlock state, and generated practice quizzes.
   Account-keyed like pwa-mastery.js. Auto-unlocks on RATING a wine of that grape (free + paid) —
   scanning alone never unlocks. Paid users can also unlock manually from the Learn tab, uncapped.
   Free users are capped at FREE_GRAPE_CAP unlocks, earned only via rating. */

let GRAPE_ALLOWLIST=[];
try{ GRAPE_ALLOWLIST=_loadJSON('data/grapes-allowlist.json')||[]; }catch(e){ console.error('[Vinterest] grapes-allowlist.json failed to load — Your Grapes will be empty until it is deployed.',e); }
const FREE_GRAPE_CAP = 5;

function _loadTextSync(path){ const x=new XMLHttpRequest(); x.open('GET',path,false); x.send(); return x.responseText; }

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
    return true;
  }
});

/* Generated once per grape, cached forever (facts don't change) — 15 questions (5 easy/5 medium/5
   hard), grounded in data/knowledge.json so the model summarizes real facts rather than inventing. */
function _grapeQuizCacheKey(grape){ return 'vinterest_grape_quiz_'+grape.replace(/\s+/g,'_'); }
function getGrapeQuiz(grape, onReady){
  const key=_grapeQuizCacheKey(grape);
  const cached=localStorage.getItem(key);
  if(cached){ try{ onReady(JSON.parse(cached)); return; }catch(e){} }
  const g=KNOWLEDGE.grapes[grape];
  const facts=g?`${grape}: ${g.profile} Famous in: ${g.famousIn.join(', ')}.`:`${grape}: no specific retrieved facts — keep questions general and safely factual.`;
  const prompt=ContentEngine.fillTpl(_loadTextSync('prompts/grape-quiz.txt'),{grape,facts});
  window.claude.complete({max_tokens:4096,messages:[{role:'user',content:prompt}]})
    .then(text=>{
      let cleaned=text.replace(/```json|```/g,'').trim();
      const s=cleaned.indexOf('['); const e=cleaned.lastIndexOf(']');
      if(s>=0&&e>s) cleaned=cleaned.slice(s,e+1);
      const qs=JSON.parse(cleaned);
      localStorage.setItem(key,JSON.stringify(qs));
      onReady(qs);
    })
    .catch(()=>onReady(null));
}
