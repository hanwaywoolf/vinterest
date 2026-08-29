/* Vinterest — Concept mastery, spaced repetition, question exposure, vocabulary ledger.
   All account-keyed (same shape convention as pwa-xp.js) for the eventual native-port transport swap. */

const CONCEPTS = _loadJSON('data/concepts.json');
const CONCEPT_TEMPLATES = _loadJSON('data/concept-templates.json');
const QUIZ_ARCHETYPES = _loadJSON('data/quiz-archetypes.json');

function _accountStore(key){
  return {
    KEY:key, ACCOUNT_ID:'local',
    get(){ let all; try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){} return (all&&all.accounts&&all.accounts[this.ACCOUNT_ID])||this.fresh(); },
    save(d){ let all; try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){} if(!all||!all.accounts) all={version:1,accounts:{}}; all.accounts[this.ACCOUNT_ID]=d; localStorage.setItem(this.KEY,JSON.stringify(all)); },
    fresh(){ return {}; }
  };
}

const MasterySystem = Object.assign(_accountStore('vinterest_mastery_v1'), {
  INTERVAL_DAYS:{1:3,2:7,3:21,4:60},
  DAY:24*60*60*1000,
  tierFor(box){ return box>=2?'late':'early'; },
  recordResult(conceptId, correct){
    const d=this.get();
    const c=d[conceptId]||{box:0,right:0,wrong:0,lastSeen:null,mastered:false};
    c.lastSeen=Date.now();
    let justMastered=false;
    if(correct){
      c.right=(c.right||0)+1;
      c.box=Math.min((c.box||0)+1,5);
      if(c.box===5){ c.mastered=true; c.nextDue=null; justMastered=true; }
      else c.nextDue=Date.now()+this.INTERVAL_DAYS[c.box]*this.DAY;
    } else {
      c.wrong=(c.wrong||0)+1;
      c.box=1; c.mastered=false;
      c.nextDue=Date.now()+1*this.DAY;
    }
    d[conceptId]=c;
    this.save(d);
    return {box:c.box, mastered:c.mastered, justMastered};
  },
  selectConcepts(n){
    n=n||6;
    const d=this.get(), now=Date.now();
    const ids=CONCEPTS.map(c=>c.id);
    const isSeen=id=>!!d[id];
    const prereqsMet=c=>(c.prereq||[]).every(p=>d[p]&&d[p].box>=1);
    const due=ids.filter(id=>d[id]&&!d[id].mastered&&d[id].nextDue&&d[id].nextDue<=now);
    const weak=ids.filter(id=>d[id]&&!d[id].mastered&&d[id].box<=1&&!due.includes(id));
    const adjacent=CONCEPTS.filter(c=>!isSeen(c.id)&&prereqsMet(c)).map(c=>c.id);
    const combined=[...due,...weak,...adjacent];
    const uniq=[...new Set(combined)];
    if(uniq.length) return uniq.slice(0,n);
    return ids.filter(id=>!(d[id]&&d[id].mastered)).slice(0,n);
  },
  weakestConcept(){
    const d=this.get();
    const scored=CONCEPTS.map(c=>({id:c.id,box:d[c.id]?d[c.id].box:0,mastered:d[c.id]?d[c.id].mastered:false}))
      .filter(c=>!c.mastered).sort((a,b)=>a.box-b.box);
    return scored[0]?scored[0].id:null;
  },
  summary(){
    const d=this.get();
    const mastered=CONCEPTS.filter(c=>d[c.id]&&d[c.id].mastered).length;
    const encountered=CONCEPTS.filter(c=>d[c.id]).length;
    return {mastered,encountered,total:CONCEPTS.length};
  }
});

const QExposure = Object.assign(_accountStore('vinterest_qexp_v1'), {
  COOLDOWN_DAYS:3,
  pickTemplate(conceptId, tier){
    const bank=(CONCEPT_TEMPLATES.find(t=>t.conceptId===conceptId)||{templates:[]}).templates;
    if(!bank.length) return null;
    const d=this.get(), now=Date.now(), cd=this.COOLDOWN_DAYS*24*60*60*1000;
    const eligible=bank.filter(t=>!d[t.id+'_'+tier]||now-d[t.id+'_'+tier]>cd);
    const pool=eligible.length?eligible:bank;
    const chosen=pool[Math.floor(Math.random()*pool.length)];
    d[chosen.id+'_'+tier]=now;
    this.save(d);
    return {...chosen[tier], templateId:chosen.id, conceptId};
  }
});

const VocabLedger = Object.assign(_accountStore('vinterest_vocab_v1'), {
  fresh(){ return {terms:[]}; },
  addTerms(wineKey, terms){
    const d=this.get();
    const have=new Set(d.terms.map(t=>t.term.toLowerCase()));
    (terms||[]).forEach(t=>{
      if(t&&t.term&&!have.has(t.term.toLowerCase())){
        d.terms.push({term:t.term,meaning:t.meaning,wineKey,learnedAt:Date.now(),timesTested:0,timesCorrect:0});
        have.add(t.term.toLowerCase());
      }
    });
    this.save(d);
  },
  getAll(){ return this.get().terms||[]; },
  recordTest(term, correct){
    const d=this.get();
    const t=d.terms.find(x=>x.term===term);
    if(t){ t.timesTested=(t.timesTested||0)+1; if(correct) t.timesCorrect=(t.timesCorrect||0)+1; this.save(d); }
  }
});
