/* Vinterest — Quiz Question Bank. Loaded from data/quiz-bank.json (source of truth for native port). */
let QUIZ_TOPICS=[];
try{ QUIZ_TOPICS=_loadJSON('data/quiz-bank.json')||[]; }catch(e){ console.error('[Vinterest] quiz-bank.json failed to load — quizzes will be empty until it is deployed.',e); }

/* Mastery progress for the three question-set quizzes: Wine Basics topics ('topic:<id>'),
   regions ('region:<name>') and grapes ('grape:<name>'). A set is complete once every question
   in it has been answered correctly at least once — not when one quiz happens to be aced.
   Questions are identified by their text, which is stable for the static quiz bank and for the
   generated banks (cached once, never regenerated).

   draw() builds each quiz: questions not yet answered correctly come first (least recently
   served first, then easier before harder where the pool ranks them), and any remaining slots
   are filled with already-correct questions as review.
   So a user on 14/15 gets their one missing question in every quiz until they get it right,
   alongside 4 review questions; a completed set keeps rotating through its questions for
   practice. */
const QUIZ_SIZE = 5;
const QuizMastery = Object.assign(_accountStore('vinterest_quiz_mastery_v1'), {
  fresh(){ return {sets:{}}; },
  _set(d,setId){ return d.sets[setId]=d.sets[setId]||{correct:{},served:{}}; },
  draw(setId,pool,n=QUIZ_SIZE){
    const s=this.get().sets[setId]||{correct:{},served:{}};
    const picked=pool
      .map(q=>({q,done:s.correct[q.q]?1:0,at:s.served[q.q]||0,rank:q.rank??({easy:0,medium:1,hard:2}[q.difficulty]||0),tie:Math.random()}))
      .sort((x,y)=>x.done-y.done||x.at-y.at||x.rank-y.rank||x.tie-y.tie)
      .slice(0,n)
      .map(x=>x.q);
    const d=this.get(); const set=this._set(d,setId); const now=Date.now();
    picked.forEach(q=>{ set.served[q.q]=now; });
    this.save(d);
    return picked;
  },
  recordAnswer(setId,qText,correct){
    if(!correct) return; // a later miss doesn't undo having known it
    const d=this.get(); const set=this._set(d,setId);
    if(!set.correct[qText]){ set.correct[qText]=Date.now(); this.save(d); }
  },
  // {correct, total} against the current pool of question texts.
  progress(setId,pool){
    const s=this.get().sets[setId];
    return {correct:s?pool.filter(q=>s.correct[q.q]).length:0,total:pool.length};
  },
  /* Near-duplicates out of a generated bank: a question is dropped when an earlier one shares
     most of its key words (the subject's own name aside), or, for "least / not / except"
     questions, a good part of them: those read as a flipped copy of a positive question
     ("best pairing" vs "least likely pairing") and look like the app contradicting itself. */
  _STOP:new Set('a an the of and or to in on for with by is are was be it its this that these those which what who why how does do did would could should can will as at from into than then their there your you wine wines'.split(' ')),
  _words(text,subject){
    const drop=new Set(String(subject||'').toLowerCase().split(/\s+/));
    return new Set(String(text||'').toLowerCase().replace(/'s\b/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w).filter(w=>(w.length>2||/\d/.test(w))&&!this._STOP.has(w)&&!drop.has(w)));
  },
  distinct(qs,subject){
    const kept=[];
    const neg=q=>/\b(least|not|except|never|worst|unlikely)\b/i.test(q.q);
    (qs||[]).forEach(q=>{
      const w=this._words(q.q,subject);
      const clash=kept.some(k=>{
        const kw=k._w, inter=[...w].filter(x=>kw.has(x)).length, sim=inter/((w.size+kw.size-inter)||1);
        return sim>=0.45||((neg(q)||neg(k.q))&&sim>=0.25);
      });
      if(!clash) kept.push({q,_w:w});
    });
    return kept.map(k=>k.q);
  },
  isComplete(setId,pool){ const p=this.progress(setId,pool); return p.total>0&&p.correct===p.total; },
  reset(setId){ const d=this.get(); delete d.sets[setId]; this.save(d); },
  /* A Wine Basics topic's pool: its beginner and intermediate questions from data/quiz-bank.json
     (16 per topic). rank makes unseen beginner questions come before intermediate ones, so a
     first quiz stays easy. The expert level isn't used; it's beyond "basics". */
  topicPool(topicId){
    const t=QUIZ_TOPICS.find(x=>x.id===topicId);
    if(!t) return [];
    return [...(t.questions.beginner||[]).map(q=>({...q,rank:0})),...(t.questions.intermediate||[]).map(q=>({...q,rank:1}))];
  }
});
