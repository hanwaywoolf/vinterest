/* Vinterest — Quiz Question Bank. Loaded from data/quiz-bank.json (source of truth for native port). */
let QUIZ_TOPICS=[];
try{ QUIZ_TOPICS=_loadJSON('data/quiz-bank.json')||[]; }catch(e){ console.error('[Vinterest] quiz-bank.json failed to load — quizzes will be empty until it is deployed.',e); }

/* Tracks which beginner "Wine Basics" topic quizzes a user has finished, so QuizHubScreen can
   collapse completed ones out of the way by default while keeping the section itself always
   visible and reachable — handing the phone to someone new to wine shouldn't mean digging
   through a "done" list to find these. */
const TopicQuizLedger = Object.assign(_accountStore('vinterest_topic_quiz_v1'), {
  fresh(){ return {done:{}}; },
  isDone(topicId){ return !!this.get().done[topicId]; },
  markDone(topicId){ const d=this.get(); d.done[topicId]=Date.now(); this.save(d); }
});
