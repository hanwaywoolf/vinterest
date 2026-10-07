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
  draw(setId,pool,n=QUIZ_SIZE,now=Date.now()){
    const s=this._peek().sets[setId]||{correct:{},served:{}};
    // Not yet answered right first, then fading answers (oldest first), then the rest as review.
    const group=q=>!s.correct[q.q]?0:this.isDue(s,q.q,now)?1:2;
    const picked=pool
      .map(q=>({q,g:group(q),due:(this._recall(s,q.q)||{}).at||0,at:s.served[q.q]||0,rank:q.rank??({easy:0,medium:1,hard:2}[q.difficulty]||0),tie:Math.random()}))
      .sort((x,y)=>x.g-y.g||(x.g===1?x.due-y.due:0)||x.at-y.at||x.rank-y.rank||x.tie-y.tie)
      .slice(0,n)
      .map(x=>x.q);
    const d=this.get(); const set=this._set(d,setId);
    picked.forEach(q=>{ set.served[q.q]=now; });
    this.save(d);
    return picked;
  },

  /* ── Fading ──
     Every right answer has a review date: REVIEW_DAYS after it was last answered right, doubling
     with each successful review (14, 28, 56… days, up to REVIEW_MAX_DAYS). Past it the answer is
     fading: still known (a set stays complete), but it counts FADE_WEIGHT in Mastery and comes
     first in the next quiz, so practising is the refresher. A miss on a known answer makes it
     fading again. recall[q] = {at: last right, n: right answers in a row}; a set saved before
     this kept only correct[q] (the first right answer), which reads as {at, n: 1}. */
  REVIEW_DAYS:14, REVIEW_MAX_DAYS:180, FADE_WEIGHT:0.5, DAY:864e5,
  _recall(s,q){ const r=s&&s.recall&&s.recall[q]; if(r&&r.at) return r; const t=s&&s.correct[q]; return t?{at:t,n:1}:null; },
  interval(n){ return Math.min(this.REVIEW_MAX_DAYS,this.REVIEW_DAYS*Math.pow(2,Math.max(0,(n||1)-1)))*this.DAY; },
  isDue(s,q,now=Date.now()){ const r=this._recall(s,q); return !!r&&now-r.at>=this.interval(r.n); },
  /* {correct, fading, total, strength}: strength is what Mastery reads, fading answers at half. */
  freshness(setId,pool,now=Date.now()){
    const s=this._peek().sets[setId], total=pool.length;
    if(!s||!total) return {correct:0,fading:0,total,strength:0};
    const known=pool.filter(q=>s.correct[q.q]), fading=known.filter(q=>this.isDue(s,q.q,now)).length;
    return {correct:known.length,fading,total,strength:(known.length-fading*(1-this.FADE_WEIGHT))/total};
  },

  /* 'learned' the first time a question is answered right (it earns XP), 'refreshed' when a
     fading answer is answered right again (a little XP; its next review is twice as far off),
     else false. A miss on a known answer makes it fading again; it never undoes having known it. */
  recordAnswer(setId,qText,correct,now=Date.now()){
    const d=this.get(); const set=this._set(d,setId); set.recall=set.recall||{};
    const r=this._recall(set,qText);
    if(!correct){
      if(!r) return false;
      set.recall[qText]={at:now-this.interval(1),n:1}; this.save(d); return false;
    }
    if(!set.correct[qText]){ set.correct[qText]=now; set.recall[qText]={at:now,n:1}; this.save(d); return 'learned'; }
    const due=this.isDue(set,qText,now);
    set.recall[qText]={at:now,n:due?(r.n||1)+1:(r.n||1)}; this.save(d);
    return due?'refreshed':false;
  },
  // {correct, total} against the current pool of question texts.
  progress(setId,pool){
    const s=this._peek().sets[setId];
    return {correct:s?pool.filter(q=>s.correct[q.q]).length:0,total:pool.length};
  },
  /* Near-duplicates out of a generated bank: a question is dropped when an earlier one shares
     most of its key words (the subject's own name aside), or, for "least / not / except"
     questions, a good part of them: those read as a flipped copy of a positive question
     ("best pairing" vs "least likely pairing") and look like the app contradicting itself.
     It's also dropped when it tests a point an earlier question already taught: its right answer
     shares THEME_SHARED key words with an earlier right answer ("a neutral grape … winemaking"
     twice), or its stem builds on an earlier answer ("Given that Chardonnay is described as a
     neutral grape, …"). Run on generation and on read, so a bank cached before keeps its other
     questions and their progress. */
  _STOP:new Set('a an the of and or to in on for with by is are was be it its this that these those which what who why how does do did would could should can will as at from into than then their there your you wine wines'.split(' ')),
  THEME_SHARED:2,
  // Words too general to mark two answers as the same point.
  _GENERIC:new Set('grape grapes while their other often usually style flavour flavor flavours flavors taste tastes which known'.split(' ')),
  _words(text,subject){
    const drop=new Set(String(subject||'').toLowerCase().split(/\s+/));
    return new Set(String(text||'').toLowerCase().replace(/'s\b/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/)
      .map(w=>w.length>4&&w.endsWith('s')?w.slice(0,-1):w).filter(w=>(w.length>2||/\d/.test(w))&&!this._STOP.has(w)&&!drop.has(w)));
  },
  /* distinct() for a bank as stored: which questions it keeps is remembered per stored text (fresh
     objects each time, so a caller can change them), since Mastery reads every bank on each draw. */
  _kept:new Map(),
  distinctStored(raw,subject){
    const qs=JSON.parse(raw||'null'); if(!Array.isArray(qs)) return null;
    const k=subject+'\u0001'+raw;
    let idx=this._kept.get(k);
    if(!idx){ const kept=new Set(this.distinct(qs,subject)); idx=qs.map((q,i)=>kept.has(q)?i:-1).filter(i=>i>=0);
      if(this._kept.size>500) this._kept.clear(); this._kept.set(k,idx); }
    return idx.map(i=>qs[i]);
  },
  distinct(qs,subject){
    const kept=[];
    const neg=q=>/\b(least|not|except|never|worst|unlikely)\b/i.test(q.q);
    const key=t=>new Set([...this._words(t,subject)].filter(x=>x.length>=5&&!this._GENERIC.has(x)));
    const answer=q=>key(Array.isArray(q.opts)?q.opts[q.a]:'');
    const premise=/^\s*(given that|since|because|as)\b/i;
    (qs||[]).forEach(q=>{
      const w=this._words(q.q,subject), a=answer(q), stem=key(q.q);
      const clash=kept.some(k=>{
        const kw=k._w, inter=[...w].filter(x=>kw.has(x)).length, sim=inter/((w.size+kw.size-inter)||1);
        if(sim>=0.45||((neg(q)||neg(k.q))&&sim>=0.25)) return true;
        const sameAnswer=[...a].filter(x=>k._a.has(x)).length>=this.THEME_SHARED;
        const buildsOn=premise.test(q.q)&&[...stem].some(x=>k._a.has(x));
        return sameAnswer||buildsOn;
      });
      if(!clash) kept.push({q,_w:w,_a:a});
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
