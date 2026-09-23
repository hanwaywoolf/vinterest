/* Vinterest — Quiz Question Bank. Loaded from data/quiz-bank.json (source of truth for native port). */
let QUIZ_TOPICS=[];
try{ QUIZ_TOPICS=_loadJSON('data/quiz-bank.json')||[]; }catch(e){ console.error('[Vinterest] quiz-bank.json failed to load — quizzes will be empty until it is deployed.',e); }

/* Mastery progress for the three question-set quizzes: Wine Basics topics ('topic:<id>'),
   regions ('region:<name>') and grapes ('grape:<name>'). A set is complete once every question
   in it has been answered correctly at least once — not when one quiz happens to be aced.
   Questions are identified by their text, which is stable for the static quiz bank and for the
   generated banks (cached once, never regenerated).

   draw() builds each quiz: questions not yet answered correctly come first (least recently
   served first), and any remaining slots are filled with already-correct questions as review.
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
      .map(q=>({q,done:s.correct[q.q]?1:0,at:s.served[q.q]||0,tie:Math.random()}))
      .sort((x,y)=>x.done-y.done||x.at-y.at||x.tie-y.tie)
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
  isComplete(setId,pool){ const p=this.progress(setId,pool); return p.total>0&&p.correct===p.total; },
  reset(setId){ const d=this.get(); delete d.sets[setId]; this.save(d); },
  topicPool(topicId){ const t=QUIZ_TOPICS.find(x=>x.id===topicId); return (t&&t.questions.beginner)||[]; }
});
