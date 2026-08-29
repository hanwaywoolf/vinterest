
/* ---- claude-bridge.js ---- */
/* claude-bridge.js
 * Provides window.claude.complete when the app is hosted OUTSIDE the Anthropic
 * preview (e.g. on your own Netlify site).
 *
 * - In the Anthropic preview the host already injects window.claude — this
 *   script detects that and does nothing, so the built-in bridge keeps working.
 * - Everywhere else it installs a proxy that POSTs to a serverless endpoint
 *   (default: /.netlify/functions/claude) which holds your Anthropic API key.
 *
 * Override the endpoint with either:
 *   <meta name="claude-proxy" content="https://your-site/.netlify/functions/claude">
 *   or  window.CLAUDE_PROXY_URL = "..."  (set before this script runs)
 */
(function () {
  if (window.claude && typeof window.claude.complete === "function") return; // host bridge present

  var meta = document.querySelector('meta[name="claude-proxy"]');
  var ENDPOINT =
    window.CLAUDE_PROXY_URL ||
    (meta && meta.getAttribute("content")) ||
    "/.netlify/functions/claude";

  function toMessages(arg) {
    if (typeof arg === "string") return [{ role: "user", content: arg }];
    if (arg && Array.isArray(arg.messages)) return arg.messages;
    if (arg && arg.content) return [{ role: "user", content: arg.content }];
    return [{ role: "user", content: String(arg) }];
  }

  window.claude = {
    complete: async function (arg) {
      var res;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: toMessages(arg), max_tokens: (arg && arg.max_tokens) || undefined, skill_id: (arg && arg.skill_id) || undefined })
        });
      } catch (e) {
        throw new Error("Couldn’t reach the wine-ID service. Check your connection and that the API proxy is deployed.");
      }
      if (!res.ok) {
        var msg = "The wine-ID service returned an error (" + res.status + ").";
        try { var j = await res.json(); if (j && j.error) msg = j.error; } catch (e) {}
        throw new Error(msg);
      }
      var data = await res.json();
      return (data && data.text) || "";
    }
  };
})();


/* ---- pwa-xp.js ---- */
/* Vinterest — XP Engine. Data-driven from data/xp-curve.json (source of truth for native port). */

function _loadJSON(path){ const x=new XMLHttpRequest(); x.open('GET',path,false); x.send(); return JSON.parse(x.responseText); }
const XP_CURVE = _loadJSON('data/xp-curve.json');
const XP_LEVELS = XP_CURVE.levels; // finite tiers only — Cellar Master is computed, not listed

function _romanize(n){
  const vals=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r='',v=n; for(const [num,sym] of vals){ while(v>=num){ r+=sym; v-=num; } } return r;
}
function _cellarMaster(n){
  const {base,ratio,badge,color}=XP_CURVE.cellarMaster;
  return {name:'Cellar Master '+_romanize(n), min:Math.round(base*Math.pow(ratio,n-1)), badge, color, roman:n};
}

const XPSystem = {
  KEY:'vinterest_xp_v3',
  LEGACY_KEY:'vinterest_xp_v2',
  ACCOUNT_ID:'local', // single implicit local account for the POC; native port swaps the key, not the shape

  get(){
    let all;
    try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){}
    if(all&&all.accounts&&all.accounts[this.ACCOUNT_ID]) return all.accounts[this.ACCOUNT_ID];
    return this._migrate();
  },
  _migrate(){
    let legacy=null;
    try{ legacy=JSON.parse(localStorage.getItem(this.LEGACY_KEY)||'null'); }catch(e){}
    const d=legacy||this.fresh();
    this.save(d);
    return d;
  },
  fresh(){
    return {total:0,events:[],scansThisWeek:[],totalRatings:0,grapesSeen:[],quizCompleted:{},quizStreaks:{}};
  },
  save(d){
    let all;
    try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){}
    if(!all||!all.accounts) all={version:1,accounts:{}};
    all.accounts[this.ACCOUNT_ID]=d;
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },

  getLevel(xp){
    if(xp>=XP_CURVE.cellarMaster.base){
      const {base,ratio}=XP_CURVE.cellarMaster;
      const n=Math.max(1, Math.floor(Math.log(xp/base)/Math.log(ratio))+1);
      // guard against float rounding landing one tier short/long
      let lvl=_cellarMaster(n);
      while(xp<lvl.min){ lvl=_cellarMaster(--lvl.roman); }
      while(xp>=_cellarMaster(lvl.roman+1).min){ lvl=_cellarMaster(lvl.roman+1); }
      return {...lvl, index:XP_LEVELS.length+lvl.roman-1};
    }
    for(let i=XP_LEVELS.length-1;i>=0;i--){
      if(xp>=XP_LEVELS[i].min) return {...XP_LEVELS[i], index:i};
    }
    return {...XP_LEVELS[0], index:0};
  },
  nextLevel(xp){
    const cur=this.getLevel(xp);
    if(cur.roman) return _cellarMaster(cur.roman+1);
    if(cur.index+1<XP_LEVELS.length) return XP_LEVELS[cur.index+1];
    return _cellarMaster(1); // Head Sommelier -> Cellar Master I
  },
  levelProgress(xp){
    const cur=this.getLevel(xp);
    const nxt=this.nextLevel(xp);
    if(!nxt) return 1;
    return (xp-cur.min)/(nxt.min-cur.min);
  },

  award(reasons){
    const d=this.get();
    const A=XP_CURVE.awards;
    const awards=[];
    const prevLevel=this.getLevel(d.total).name;

    reasons.forEach(r=>{
      switch(r.type){
        case 'scan':
          d.total+=A.scan;
          awards.push({label:'Wine scanned',amount:A.scan});
          {const now=Date.now(), wAgo=now-7*24*60*60*1000;
          d.scansThisWeek=[(d.scansThisWeek||[]).filter(t=>t>wAgo),now].flat();
          const wk='week5_'+Math.floor(now/(7*24*60*60*1000));
          if(d.scansThisWeek.length>=5 && !d.events.includes(wk)){
            d.events.push(wk); d.total+=A.weekly_scan_bonus;
            awards.push({label:'5 scans this week!',amount:A.weekly_scan_bonus,bonus:true});
          }}
          break;

        case 'rate':
          d.total+=A.rate;
          d.totalRatings=(d.totalRatings||0)+1;
          awards.push({label:'Wine rated',amount:A.rate});
          if(d.totalRatings===10 && !d.events.includes('ratings_10')){
            d.events.push('ratings_10'); d.total+=A.ratings_10_bonus;
            awards.push({label:'10 wines rated!',amount:A.ratings_10_bonus,bonus:true});
          }
          break;

        case 'quiz_correct':
          d.total+=A.quiz_correct;
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=(d.quizStreaks[sk]||0)+1;
          awards.push({label:'Correct!',amount:A.quiz_correct});
          if(d.quizStreaks[sk]===3){
            d.total+=A.quiz_streak_bonus;
            awards.push({label:'3-answer streak!',amount:A.quiz_streak_bonus,bonus:true});
          }}
          break;

        case 'quiz_wrong':
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=0;}
          break;

        case 'quiz_complete':
          {const k=(r.quizKey||((r.topic||'')+'_'+(r.difficulty||'')));
          if(!d.quizCompleted) d.quizCompleted={};
          if(!d.quizCompleted[k]){
            const bonus=r.amount!=null?r.amount:Math.round(A.quiz_complete.min+(r.derivedDifficulty||0)*(A.quiz_complete.max-A.quiz_complete.min));
            d.quizCompleted[k]=bonus; d.total+=bonus;
            awards.push({label:'Quiz complete!',amount:bonus,bonus:true});
          }}
          break;

        case 'concept_mastered':
          if(r.conceptId && !d.events.includes('mastered_'+r.conceptId)){
            d.events.push('mastered_'+r.conceptId); d.total+=A.concept_mastered;
            awards.push({label:'Concept mastered',amount:A.concept_mastered,bonus:true});
          }
          break;

        case 'first_type':
          if(r.value && !d.events.includes('type_'+r.value)){
            d.events.push('type_'+r.value); d.total+=A.first_type;
            awards.push({label:'First '+r.value+' wine!',amount:A.first_type,bonus:true});
          }
          break;

        case 'first_country':
          if(r.value){
            const ck='country_'+(r.value).toLowerCase().replace(/\s/g,'_');
            if(!d.events.includes(ck)){
              d.events.push(ck); d.total+=A.first_country;
              awards.push({label:'First from '+r.value+'!',amount:A.first_country,bonus:true});
            }
          }
          break;

        case 'new_grape':
          if(r.value){
            const g=(r.value).toLowerCase();
            if(!(d.grapesSeen||[]).includes(g)){
              d.grapesSeen=(d.grapesSeen||[]);
              d.grapesSeen.push(g); d.total+=A.new_grape;
              awards.push({label:'New grape: '+r.value,amount:A.new_grape,bonus:true});
            }
          }
          break;

        case 'rarity':
          if(r.wineKey && !d.events.includes('rarity_'+r.wineKey)){
            d.events.push('rarity_'+r.wineKey); d.total+=A.rarity;
            awards.push({label:'Rare bottle',amount:A.rarity,bonus:true});
          }
          break;

        case 'article':
          if(r.articleKey && !d.events.includes('article_'+r.articleKey)){
            d.events.push('article_'+r.articleKey); d.total+=A.article;
            awards.push({label:'Article completed',amount:A.article,bonus:true});
          }
          break;

        case 'blind_call':
          {const acc=Math.max(0,Math.min(1,r.accuracy||0));
          const amount=Math.round(A.blind_call.min + acc*(A.blind_call.max-A.blind_call.min));
          d.total+=amount;
          awards.push({label:'Blind Call scored',amount,bonus:true});}
          break;

        case 'track_complete':
          if(r.trackId && !d.events.includes('track_'+r.trackId)){
            d.events.push('track_'+r.trackId); d.total+=A.track_complete;
            awards.push({label:'Track completed',amount:A.track_complete,bonus:true});
          }
          break;
      }
    });

    this.save(d);
    const newLevel=this.getLevel(d.total).name;
    if(newLevel!==prevLevel){
      awards.push({label:'Level up: '+newLevel+'!',amount:0,levelUp:true,level:newLevel});
    }
    return awards;
  },

  toast(awards){
    if(!awards||!awards.length) return;
    window.dispatchEvent(new CustomEvent('vinterest:xp',{detail:{awards}}));
  },

  awardAndToast(reasons){
    const a=this.award(reasons);
    this.toast(a);
    return a;
  }
};


/* ---- pwa-mastery.js ---- */
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


/* ---- pwa-content-engine.js ---- */
/* Vinterest — Content Engine. Event-triggered archetype queue for the Learn shelf.
   Deterministic: stub metadata (title/subtitle) is template-filled from WineDNA, never LLM-invented.
   Only the article body (GenArticleScreen) calls the model, and only with retrieved facts attached. */

const KNOWLEDGE = _loadJSON('data/knowledge.json');
const ARTICLE_ARCHETYPES = _loadJSON('data/archetypes.json');
const TRIGGERS = _loadJSON('data/triggers.json');

const ExposureLedger = Object.assign(_accountStore('vinterest_exposure_v1'), {
  fresh(){ return {keys:{}}; },
  has(key){ return !!this.get().keys[key]; },
  mark(key){ const d=this.get(); d.keys[key]=Date.now(); this.save(d); }
});

const ContentEngine = {
  TRAIT_BASELINE:{body:0.5,tannins:0.5,acidity:0.5,sweetness:0.15},
  TRAIT_LABEL:{body:'Full-Bodied',tannins:'Tannic',acidity:'High-Acid',sweetness:'Sweet'},

  detectEvents(wines){
    const events=[];
    const rated=wines.filter(w=>w.rating>0);
    const regionCounts={},typeCounts={},grapeCounts={},producerCounts={};
    wines.forEach(w=>{
      if(w.region) regionCounts[w.region]=(regionCounts[w.region]||0)+1;
      const t=(w.type||'').toLowerCase(); if(t) typeCounts[t]=(typeCounts[t]||0)+1;
      (w.grapes||[]).forEach(g=>{if(g) grapeCounts[g]=(grapeCounts[g]||0)+1;});
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
      const others={};
      wines.forEach(w=>{ if(w.region&&w.region!==ev.subject) others[w.region]=(others[w.region]||0)+1; });
      const top=Object.entries(others).sort((a,b)=>b[1]-a[1])[0];
      if(top) s.regionB=top[0];
    }
    if(ev.event==='new_type') s.type=ev.subject[0].toUpperCase()+ev.subject.slice(1);
    if(ev.event==='grape_multi'){ s.grape=ev.subject; s.count=wines.filter(w=>(w.grapes||[]).includes(ev.subject)).length; }
    if(ev.event==='producer_repeat'){ s.producer=ev.subject; s.count=ev.meta.count; }
    if(ev.event==='trait_signature') s.trait=ev.subject;
    if(ev.event==='contradiction'){ s.trait=this.TRAIT_LABEL[ev.meta.trait]; s.rating=ev.meta.rating; s.wineName=ev.meta.wineName; }
    if(ev.event==='quiz_failed_concept') s.conceptLabel=ev.meta.conceptLabel;
    if(ev.event==='vocab_match') s.descriptor=ev.meta.descriptor;
    return s;
  },

  fillTpl(tpl,slots){ let s=tpl; Object.keys(slots).forEach(k=>{ s=s.split('{{'+k+'}}').join(slots[k]??''); }); return s; },

  pickArchetype(ev, slots){
    const row=TRIGGERS.find(t=>t.event===ev.event);
    if(!row) return null;
    const candidates=row.archetypeIds
      .map(id=>ARTICLE_ARCHETYPES.find(a=>a.id===id))
      .filter(a=>a&&a.needs.every(n=>slots[n]!=null&&slots[n]!==''));
    if(!candidates.length) return null;
    return candidates[Math.floor(Math.random()*candidates.length)];
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

  buildStub(archetype, ev, wines){
    const slots=this.buildSlots(ev,wines);
    return {
      id:'ev_'+ev.key.replace(/[^a-z0-9]+/gi,'_')+'_'+archetype.id,
      archetypeId:archetype.id,
      iconName:archetype.iconName,
      readTime:archetype.readTime,
      title:this.fillTpl(archetype.titleTpl,slots),
      subtitle:this.fillTpl(archetype.subtitleTpl,slots),
      brief:archetype.brief,
      slots,
      facts:this.retrieveFacts(archetype,slots)
    };
  },

  refreshShelf(wines, maxUnread){
    maxUnread=maxUnread||6;
    let stubs=[];
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    const unreadCount=stubs.filter(s=>!localStorage.getItem('vinterest_gen_article_'+s.id+'_done')).length;
    const need=maxUnread-unreadCount;
    if(need<=0||!wines.length) return stubs;
    const events=this.detectEvents(wines);
    let added=0;
    for(const ev of events){
      if(added>=need) break;
      const slots=this.buildSlots(ev,wines);
      const archetype=this.pickArchetype(ev,slots);
      if(!archetype) continue;
      const stub=this.buildStub(archetype,ev,wines);
      stubs.push(stub);
      ExposureLedger.mark(ev.key);
      added++;
    }
    if(added>0) localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    return stubs;
  }
};


/* ---- pwa-quiz-questions.js ---- */
/* Vinterest — Quiz Question Bank. Loaded from data/quiz-bank.json (source of truth for native port). */
const QUIZ_TOPICS = _loadJSON('data/quiz-bank.json');


/* ---- pwa-components.jsx (precompiled) ---- */
/* Vinterest PWA — Shared tokens, icons, primitives */

const C = {
  cr: '#8B1A2F',
  crL: '#B02440',
  crDim: 'rgba(139,26,47,0.13)',
  crSoft: 'rgba(139,26,47,0.07)',
  ink: '#0F0F0F',
  ink2: '#3A3A3A',
  mid: '#8A8A8A',
  line: '#E8E8E8',
  bg: '#FAFAFA',
  white: '#FFFFFF',
  offWhite: '#F5F3F0',
  green: '#1E7B4B',
  greenBg: '#EAF7F0',
  amber: '#B06C00',
  amberBg: '#FFF4E0',
  P: "'Poppins',sans-serif",
  serif: "'Instrument Serif',serif"
};
function Icon({
  n,
  sz = 20,
  col = C.ink,
  style: s
}) {
  const d = {
    scan: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "3",
      width: "6",
      height: "6",
      rx: "1",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "11",
      y: "3",
      width: "6",
      height: "6",
      rx: "1",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("rect", {
      x: "3",
      y: "11",
      width: "6",
      height: "6",
      rx: "1",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "14",
      cy: "14",
      r: "2.5",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "16.5",
      y1: "16.5",
      x2: "18.5",
      y2: "18.5",
      stroke: col,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    })),
    fork: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M7 2v5c0 1.5.8 2.5 2 3v8",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 2v3",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M9 2v3",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 2v4l2-1v-3",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 6c0 2.5 2 3 2 5v7",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    })),
    cart: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M2 3h2.5l2.2 10h8.6l1.8-7H6.5",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "17",
      r: "1.2",
      fill: col
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "14.5",
      cy: "17",
      r: "1.2",
      fill: col
    })),
    home: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 9.5L10 3l7 6.5",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5 8.5V17h4v-4.5h2V17h4V8.5",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    })),
    compass: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "10",
      r: "7",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "10,5.5 12,9.5 10,10.5 8,9.5",
      fill: col
    }), /*#__PURE__*/React.createElement("polygon", {
      points: "10,14.5 8,10.5 10,10.5 12,10.5",
      fill: col,
      opacity: ".35"
    })),
    book: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 4.5C4 4.5 7 3.5 10 5C13 3.5 16 4.5 16 4.5V15C16 15 13 14 10 15.5C7 14 4 15 4 15V4.5Z",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "5",
      x2: "10",
      y2: "15.5",
      stroke: col,
      strokeWidth: "1.2"
    })),
    user: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "7.5",
      r: "3.2",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.5 18C3.5 14 6.5 12 10 12s6.5 2 6.5 6",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinecap: "round"
    })),
    back: /*#__PURE__*/React.createElement("polyline", {
      points: "12,4 5,10 12,16",
      stroke: col,
      strokeWidth: "1.7",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }),
    chevron: /*#__PURE__*/React.createElement("polyline", {
      points: "7,4 13,10 7,16",
      stroke: col,
      strokeWidth: "1.7",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }),
    heart: /*#__PURE__*/React.createElement("path", {
      d: "M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }),
    share: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "14.5",
      cy: "4.5",
      r: "2",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "5.5",
      cy: "10",
      r: "2",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "14.5",
      cy: "15.5",
      r: "2",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7.4",
      y1: "9",
      x2: "12.6",
      y2: "5.5",
      stroke: col,
      strokeWidth: "1.5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7.4",
      y1: "11",
      x2: "12.6",
      y2: "14.5",
      stroke: col,
      strokeWidth: "1.5"
    })),
    camera: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "2.5",
      y: "6",
      width: "15",
      height: "11",
      rx: "2",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "11.5",
      r: "3",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7.5 6L8.5 4h3l1 2",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    })),
    check: /*#__PURE__*/React.createElement("polyline", {
      points: "3.5,10 7.5,14.5 16.5,5",
      stroke: col,
      strokeWidth: "2",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }),
    trash: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 6h12",
      stroke: col,
      strokeWidth: "1.6",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.5 6l.7 9.5a1.5 1.5 0 001.5 1.4h4.6a1.5 1.5 0 001.5-1.4L14.5 6",
      stroke: col,
      strokeWidth: "1.6",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "8.3",
      y1: "9",
      x2: "8.6",
      y2: "14",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "11.7",
      y1: "9",
      x2: "11.4",
      y2: "14",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    })),
    wine: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M7.5 2.5h5v5c0 3.5-1.8 5-2.5 5S7.5 11 7.5 8V2.5z",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "12.5",
      x2: "10",
      y2: "17",
      stroke: col,
      strokeWidth: "1.5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "17",
      x2: "13",
      y2: "17",
      stroke: col,
      strokeWidth: "1.5",
      strokeLinecap: "round"
    })),
    globe: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "10",
      r: "7.5",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("ellipse", {
      cx: "10",
      cy: "10",
      rx: "3.5",
      ry: "7.5",
      stroke: col,
      strokeWidth: "1.2",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "2.5",
      y1: "10",
      x2: "17.5",
      y2: "10",
      stroke: col,
      strokeWidth: "1.2"
    })),
    message: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 2V6a1 1 0 011-1z",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none",
      strokeLinejoin: "round"
    })),
    flame: /*#__PURE__*/React.createElement("path", {
      d: "M10 2C10 2 14.5 6.5 14.5 10.5C14.5 13.5 12.5 16 10 16C7.5 16 5.5 13.5 5.5 10.5C5.5 6.5 10 2 10 2Z",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }),
    trophy: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M5.5 3h9v5c0 3-2 5-4.5 5S5.5 11 5.5 8V3z",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.5 5H3c0 3 1.5 4.5 2.5 4.5",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14.5 5H17c0 3-1.5 4.5-2.5 4.5",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "13",
      x2: "10",
      y2: "16.5",
      stroke: col,
      strokeWidth: "1.5"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "16.5",
      x2: "13",
      y2: "16.5",
      stroke: col,
      strokeWidth: "1.5",
      strokeLinecap: "round"
    })),
    lock: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
      x: "5.5",
      y: "9.5",
      width: "9",
      height: "7.5",
      rx: "1.5",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7.5 9.5V7C7.5 5 8.5 3.5 10 3.5S12.5 5 12.5 7v2.5",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "13",
      r: "1",
      fill: col
    })),
    star: /*#__PURE__*/React.createElement("polygon", {
      points: "10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6",
      fill: col
    }),
    list: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "5",
      x2: "17",
      y2: "5",
      stroke: col,
      strokeWidth: "1.5",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "10",
      x2: "17",
      y2: "10",
      stroke: col,
      strokeWidth: "1.5",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "15",
      x2: "17",
      y2: "15",
      stroke: col,
      strokeWidth: "1.5",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "5",
      r: "1",
      fill: col
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "10",
      r: "1",
      fill: col
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "4",
      cy: "15",
      r: "1",
      fill: col
    })),
    brain: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M10 15V7.5",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round",
      strokeDasharray: "1.2 1.8",
      opacity: ".4"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 7.5C10 5.5 8.5 4 7 4C5.3 4 4 5.2 4 6.8C3.1 7.1 2.4 8 2.4 9.2C2.4 10.4 3.2 11.4 4.3 11.7C4.1 12.2 4 12.7 4 13.3C4 14.9 5.3 16.1 7 16.2L10 16.3",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 7.5C10 5.5 11.5 4 13 4C14.7 4 16 5.2 16 6.8C16.9 7.1 17.6 8 17.6 9.2C17.6 10.4 16.8 11.4 15.7 11.7C15.9 12.2 16 12.7 16 13.3C16 14.9 14.7 16.1 13 16.2L10 16.3",
      stroke: col,
      strokeWidth: "1.5",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.5 8.2C6 7.8 7 7.7 7.8 8.2",
      stroke: col,
      strokeWidth: "1",
      strokeLinecap: "round",
      opacity: ".55"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M5.5 11C6 10.6 7 10.6 7.8 11",
      stroke: col,
      strokeWidth: "1",
      strokeLinecap: "round",
      opacity: ".55"
    })),
    // Food pairing icons — clean 1px line art
    'food-lamb': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ellipse", {
      cx: "9",
      cy: "10",
      rx: "5.5",
      ry: "3.5",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "15",
      cy: "8.5",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M14 6.8L13.5 5.5",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6",
      y1: "13.5",
      x2: "5.5",
      y2: "17",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "9",
      y1: "13.5",
      x2: "9",
      y2: "17",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "13.5",
      x2: "12.5",
      y2: "17",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    })),
    'food-beef': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M5.5 6C4.8 7 4.5 9 5 12C5.5 15 7.5 16 10 16C12.5 16 14.5 15 15 12C15.5 9 15.2 7 14.5 6C13.5 5 11.5 4.5 10 4.5C8.5 4.5 6.5 5 5.5 6Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "4.5",
      x2: "10",
      y2: "16",
      stroke: col,
      strokeWidth: "1.1",
      strokeLinecap: "round",
      opacity: ".45"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7.5 8.5C8.5 8 11.5 8 12.5 8.5",
      stroke: col,
      strokeWidth: "1",
      strokeLinecap: "round",
      opacity: ".35"
    })),
    'food-meat': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M8 4.5C8 4.5 5.5 5.5 5 8C4.5 10.5 6 13 8.5 13.5L10 16.5",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 16.5C10 16.5 9 17.5 10.5 18C12 18.5 13 17 13 17L14.5 14.5C14.5 14.5 15 13 14 12.5L11.5 11.5C10 11 8.5 13.5 8.5 13.5",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    'food-cheese': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M2.5 15.5L10 4.5L17.5 15.5H2.5Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "9",
      cy: "12",
      r: "1.1",
      fill: col,
      opacity: ".45"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "12.5",
      cy: "12.5",
      r: "0.9",
      fill: col,
      opacity: ".45"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "7",
      cy: "13.5",
      r: "0.7",
      fill: col,
      opacity: ".35"
    })),
    'food-fish': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M3 10C3 10 5.5 5.5 10 5.5C14.5 5.5 17 10 17 10C17 10 14.5 14.5 10 14.5C5.5 14.5 3 10 3 10Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "13",
      cy: "9.5",
      r: "0.9",
      fill: col
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3 10L1 7.5M3 10L1 12.5",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    })),
    'food-pasta': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("ellipse", {
      cx: "10",
      cy: "9",
      rx: "6.5",
      ry: "3",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M3.5 9v2c0 2 3 3.5 6.5 3.5s6.5-1.5 6.5-3.5V9",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 9.5c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5",
      stroke: col,
      strokeWidth: "1.2",
      fill: "none",
      strokeLinecap: "round"
    })),
    'food-veg': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M10 16V8",
      stroke: col,
      strokeWidth: "1.4",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 11C10 11 7 9 6 6C8 5.5 10 7 10 7",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 9C10 9 13 7 14 4C12 3.5 10 5 10 5",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    'food-chicken': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M8 4.5C8 4.5 6 5 5.5 7C5 9 6.5 10.5 8 11L12 15.5",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12 15.5C12 15.5 10.5 17 12 17.5C13.5 18 14.5 16.5 14.5 16.5L16 14C16 14 16.5 12.5 15.5 12L13 11C11.5 10.5 8 11 8 11",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    })),
    'food-bread': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 13.5C4 13.5 3 12 3 10C3 7.5 5 5.5 7.5 5.5H12.5C15 5.5 17 7.5 17 10C17 12 16 13.5 16 13.5H4Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "4",
      y1: "13.5",
      x2: "16",
      y2: "13.5",
      stroke: col,
      strokeWidth: "1.4",
      strokeLinecap: "round"
    })),
    'food-generic': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "10",
      cy: "10",
      r: "7",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7 10h6M10 7v6",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round",
      opacity: ".5"
    })),
    // Article/reading icons
    'read': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M4 5h12v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "9",
      x2: "13",
      y2: "9",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "12",
      x2: "11",
      y2: "12",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M7.5 5V3.5",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M12.5 5V3.5",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    })),
    'map': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M7 3.5L3 5.5v11l4-2 6 2 4-2v-11l-4 2-6-2Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "7",
      y1: "3.5",
      x2: "7",
      y2: "14.5",
      stroke: col,
      strokeWidth: "1.2"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "13",
      y1: "5.5",
      x2: "13",
      y2: "16.5",
      stroke: col,
      strokeWidth: "1.2"
    })),
    'leaf': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M10 17C10 17 4 14 4 8C4 8 8 5 14 6C14 6 15 12 10 17Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10 17C10 17 10 12 7 9",
      stroke: col,
      strokeWidth: "1.2",
      strokeLinecap: "round"
    })),
    'glass': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M6 3h8l-1 7.5c-.3 2.3-2.2 4-3 4s-2.7-1.7-3-4L6 3Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "10",
      y1: "14.5",
      x2: "10",
      y2: "17.5",
      stroke: col,
      strokeWidth: "1.4"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "6.5",
      y1: "17.5",
      x2: "13.5",
      y2: "17.5",
      stroke: col,
      strokeWidth: "1.4",
      strokeLinecap: "round"
    })),
    'grape': /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "7",
      cy: "8",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10.5",
      cy: "6",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10.5",
      cy: "10",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "14",
      cy: "8",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "10.5",
      cy: "14",
      r: "2",
      stroke: col,
      strokeWidth: "1.3",
      fill: "none"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10.5 4V2",
      stroke: col,
      strokeWidth: "1.3",
      strokeLinecap: "round"
    })),
    'drop': /*#__PURE__*/React.createElement("path", {
      d: "M10 3C10 3 5.5 9 5.5 12.5C5.5 15.5 7.5 17.5 10 17.5C12.5 17.5 14.5 15.5 14.5 12.5C14.5 9 10 3 10 3Z",
      stroke: col,
      strokeWidth: "1.4",
      fill: "none",
      strokeLinejoin: "round"
    })
  };
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: sz,
    height: sz,
    style: {
      display: 'block',
      flexShrink: 0,
      ...s
    }
  }, d[n] || /*#__PURE__*/React.createElement("circle", {
    cx: "10",
    cy: "10",
    r: "7",
    stroke: col,
    strokeWidth: "1.5",
    fill: "none"
  }));
}
function BottomNav({
  active,
  nav,
  showPro
}) {
  const homeActive = active === 'home' || active === 'scan';
  const cellarActive = active === 'mywines';
  const learnActive = active === 'learn' || active === 'quiz' || active === 'article';
  const profileActive = active === 'profile';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      position: 'relative',
      zIndex: 50,
      overflow: 'visible'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      background: C.white,
      borderTop: `1px solid ${C.line}`,
      zIndex: 100,
      overflow: 'visible'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('home'),
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      cursor: 'pointer',
      padding: '9px 0 max(env(safe-area-inset-bottom,9px),9px)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "home",
    sz: 22,
    col: homeActive ? C.cr : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: homeActive ? 600 : 400,
      color: homeActive ? C.cr : C.mid,
      fontFamily: C.P
    }
  }, "Home")), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('mywines'),
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      cursor: 'pointer',
      padding: '9px 0 max(env(safe-area-inset-bottom,9px),9px)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 22,
    col: cellarActive ? C.cr : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: cellarActive ? 600 : 400,
      color: cellarActive ? C.cr : C.mid,
      fontFamily: C.P
    }
  }, "My Wines")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-end',
      cursor: 'pointer',
      paddingBottom: 'max(env(safe-area-inset-bottom,9px),9px)'
    },
    onClick: () => nav('camera')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 54,
      height: 54,
      borderRadius: 27,
      background: C.cr,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -20,
      boxShadow: `0 4px 22px ${C.cr}60`,
      border: '3px solid #fff'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "camera",
    sz: 22,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      marginTop: 3
    }
  }, "Scan")), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('learn'),
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      cursor: 'pointer',
      padding: '9px 0 max(env(safe-area-inset-bottom,9px),9px)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "book",
    sz: 22,
    col: learnActive ? C.cr : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: learnActive ? 600 : 400,
      color: learnActive ? C.cr : C.mid,
      fontFamily: C.P
    }
  }, "Learn")), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('profile'),
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      cursor: 'pointer',
      padding: '9px 0 max(env(safe-area-inset-bottom,9px),9px)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "brain",
    sz: 22,
    col: profileActive ? C.cr : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: profileActive ? 600 : 400,
      color: profileActive ? C.cr : C.mid,
      fontFamily: C.P
    }
  }, "WineDNA"))));
}

/* ── Sidebar navigation (tablet/iPad) ── */
function SideNav({
  active,
  nav,
  showPro,
  xpBadge,
  onXpClick
}) {
  const homeActive = ['home', 'scan'].includes(active);
  const cellarActive = active === 'mywines';
  const learnActive = ['learn', 'quiz', 'article', 'gen-article'].includes(active);
  const profileActive = active === 'profile';
  const isPro = !!localStorage.getItem('vinterest_pro');
  const atLimit = !isPro && parseInt(localStorage.getItem('vinterest_scan_count') || '0') >= 10;
  const lv = xpBadge ? XPSystem.getLevel(xpBadge.total) : null;
  const items = [{
    key: 'home',
    icon: 'home',
    label: 'Home',
    isActive: homeActive
  }, {
    key: 'scan',
    icon: 'camera',
    label: 'Scan',
    isActive: active === 'scan' || active === 'camera'
  }, {
    key: 'mywines',
    icon: 'wine',
    label: 'My Wines',
    isActive: cellarActive
  }, {
    key: 'learn',
    icon: 'book',
    label: 'Learn',
    isActive: learnActive
  }, {
    key: 'profile',
    icon: 'brain',
    label: 'WineDNA',
    isActive: profileActive
  }];
  const navItems = items.filter(i => i.key !== 'scan');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 200,
      flexShrink: 0,
      height: '100%',
      background: C.white,
      borderRight: `1px solid ${C.line}`,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px 12px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 26,
      width: 'auto',
      display: 'block',
      marginBottom: 10
    }
  }), xpBadge && lv && /*#__PURE__*/React.createElement("div", {
    onClick: onXpClick,
    style: {
      padding: '6px 8px',
      borderRadius: 8,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      lineHeight: 1
    }
  }, lv.badge), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, xpBadge.total, " XP"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 400,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.3,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, lv.name)), !!localStorage.getItem('vinterest_pro') && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: '#fff',
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)',
      borderRadius: 6,
      padding: '2px 5px',
      flexShrink: 0
    }
  }, "PRO"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.line,
      margin: '0 0 8px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '2px 10px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, navItems.map(item => /*#__PURE__*/React.createElement("div", {
    key: item.key,
    onClick: () => nav(item.key),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 10,
      background: item.isActive ? C.crSoft : 'transparent',
      cursor: 'pointer',
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: item.icon,
    sz: 19,
    col: item.isActive ? C.cr : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: item.isActive ? 600 : 400,
      color: item.isActive ? C.cr : C.ink2,
      fontFamily: C.P
    }
  }, item.label)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 10px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => atLimit ? showPro('unlimited-scans') : nav('camera'),
    style: {
      background: atLimit ? '#999' : C.cr,
      borderRadius: 8,
      padding: '10px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      cursor: 'pointer',
      boxShadow: atLimit ? 'none' : `0 3px 10px ${C.cr}40`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: atLimit ? 'lock' : 'camera',
    sz: 19,
    col: "#fff"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 500,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Scan"))));
}
function ProBadge({
  style: s
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '2px 7px',
      borderRadius: 8,
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)',
      fontSize: 12,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '0.05em',
      flexShrink: 0,
      ...s
    }
  }, "PRO");
}
function ProGate({
  feature,
  onClose
}) {
  const FEAT = {
    'wine-list': {
      icon: '📋',
      title: 'Wine List Scanning',
      desc: 'Snap any restaurant menu and get instant match scores for every bottle.',
      bullets: ['Scan full wine lists in seconds', 'AI ranks every wine by your taste profile', 'Works at any restaurant worldwide']
    },
    'unlimited-scans': {
      icon: '♾️',
      title: 'Unlimited Scans',
      desc: "You've used your 10 free scans. Pro gives you unlimited.",
      bullets: ['Scan as many bottles as you like', 'Your full scan history never expires', 'Priority AI label recognition']
    },
    'taste-depth': {
      icon: '🎭',
      title: 'Full Taste Profile',
      desc: 'Unlock your complete taste breakdown across all wine types.',
      bullets: ['Whites, Rosé & Sparkling profiles', 'Personalised sommelier scripts for each', 'Full food pairing analysis']
    },
    'expert-quiz': {
      icon: '🎓',
      title: 'Expert Quizzes',
      desc: 'Advanced wine knowledge questions with bigger XP rewards.',
      bullets: ['WSET-inspired question sets', '200 XP per completed quiz', 'Unlock Expert badge on your profile']
    }
  };
  const f = FEAT[feature] || FEAT['wine-list'];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(0,0,0,0.62)',
      zIndex: 600,
      display: 'flex',
      alignItems: 'flex-end',
      backdropFilter: 'blur(4px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: C.white,
      borderRadius: '22px 22px 0 0',
      width: '100%',
      paddingBottom: 'max(env(safe-area-inset-bottom,0px),20px)',
      animation: 'slideUp .3s cubic-bezier(.34,1.2,.64,1)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      padding: '10px 0 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: C.line
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '6px 0 8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '4px 14px',
      borderRadius: 20,
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '0.08em'
    }
  }, "VINTEREST PRO"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 24px 4px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 42,
      marginBottom: 8
    }
  }, f.icon), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2,
      marginBottom: 6
    }
  }, f.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, f.desc)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, f.bullets.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.greenBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 12,
    col: C.green
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P
    }
  }, b)))), /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      localStorage.setItem('vinterest_pro', '1');
      window.dispatchEvent(new Event('vinterest:pro'));
      onClose();
    },
    style: {
      background: `linear-gradient(135deg,${C.cr},${C.crL})`,
      borderRadius: 14,
      padding: '15px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 6px 28px ${C.cr}45`,
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Upgrade to Pro"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.68)',
      fontFamily: C.P,
      marginTop: 2
    }
  }, "\xA34.99/month \xB7 Cancel anytime")), /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      textAlign: 'center',
      cursor: 'pointer',
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Maybe later")))));
}
function Pill({
  children,
  active,
  sm,
  style: s
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: sm ? '3px 9px' : '5px 12px',
      borderRadius: 20,
      background: active ? C.cr : 'transparent',
      color: active ? '#fff' : C.mid,
      border: `1px solid ${active ? C.cr : C.line}`,
      fontSize: sm ? 12 : 13,
      fontWeight: 500,
      fontFamily: C.P,
      ...s
    }
  }, children);
}
function Prog({
  val = 0.5,
  col,
  h = 4,
  style: s
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: h,
      borderRadius: h,
      background: 'rgba(0,0,0,0.07)',
      overflow: 'hidden',
      ...s
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      width: `${Math.min(1, val) * 100}%`,
      borderRadius: h,
      background: col || C.cr
    }
  }));
}
function Card({
  children,
  style: s,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      background: C.white,
      borderRadius: 16,
      padding: 14,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      ...s
    }
  }, children);
}
function Btn({
  children,
  primary,
  full,
  small,
  style: s,
  onClick
}) {
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      padding: small ? '8px 14px' : '12px 20px',
      borderRadius: 12,
      background: primary ? C.cr : C.white,
      color: primary ? '#fff' : C.ink,
      border: primary ? 'none' : `1px solid ${C.line}`,
      fontFamily: C.P,
      fontSize: small ? 13 : 15,
      fontWeight: 600,
      textAlign: 'center',
      width: full ? '100%' : 'auto',
      boxShadow: primary ? `0 4px 16px ${C.cr}40` : 'none',
      cursor: 'pointer',
      boxSizing: 'border-box',
      ...s
    }
  }, children);
}

/* ── Wine History ── */
const WineHistory = {
  KEY: 'vinterest_wines',
  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '[]');
    } catch (e) {
      return [];
    }
  },
  save(wines) {
    localStorage.setItem(this.KEY, JSON.stringify(wines.slice(0, 500)));
  },
  track(wine) {
    // Save a scanned wine immediately, even before rating
    if (!wine || !wine.name) return;
    const wines = this.getAll();
    const idx = wines.findIndex(w => w.name === wine.name && String(w.vintage) === String(wine.vintage));
    const now = new Date().toISOString();
    if (idx >= 0) {
      wines[idx].times_consumed = (wines[idx].times_consumed || 1) + 1;
      wines[idx].last_scanned = now;
    } else {
      wines.unshift({
        ...wine,
        rating: 0,
        times_consumed: 1,
        scanned_at: now,
        last_scanned: now
      });
    }
    this.save(wines);
  },
  add(wine, rating) {
    const wines = this.getAll();
    const idx = wines.findIndex(w => w.name === wine.name && String(w.vintage) === String(wine.vintage));
    const now = new Date().toISOString();
    if (idx >= 0) {
      wines[idx].times_consumed = (wines[idx].times_consumed || 1) + 1;
      wines[idx].last_scanned = now;
      if (rating > 0) wines[idx].rating = rating;
    } else {
      wines.unshift({
        ...wine,
        rating: rating || 0,
        times_consumed: 1,
        scanned_at: now,
        last_scanned: now
      });
    }
    this.save(wines);
    return wines;
  },
  rate(name, vintage, rating) {
    const wines = this.getAll();
    const w = wines.find(w => w.name === name && String(w.vintage) === String(vintage));
    if (w) {
      w.rating = rating;
      this.save(wines);
    }
  },
  /* Optional, user-entered scan location — manual text only for now (no geolocation/reverse-geocoding yet). */
  setLocation(name, vintage, location) {
    const wines = this.getAll();
    const w = wines.find(w => w.name === name && String(w.vintage) === String(vintage));
    if (!w) return;
    if (location && location.trim()) w.scan_location = {
      name: location.trim(),
      added_at: new Date().toISOString()
    };else delete w.scan_location;
    this.save(wines);
  },
  /* 'checking' (deciding whether to buy), 'tasting' (about to drink), 'tasted' (already had it) \u2014 lets Wine Detail
     phrase the location prompt as \"where did you see/buy this\" vs \"where did you have this\". */
  setScanIntent(name, vintage, intent) {
    const wines = this.getAll();
    const w = wines.find(w => w.name === name && String(w.vintage) === String(vintage));
    if (w) {
      w.scan_intent = intent;
      this.save(wines);
    }
  },
  /* Permanently remove a scan (e.g. an accidental scan) from history. */
  remove(name, vintage) {
    const wines = this.getAll().filter(w => !(w.name === name && String(w.vintage) === String(vintage)));
    this.save(wines);
  },
  getProfile() {
    const wines = this.getAll();
    if (!wines.length) return {
      red: 0,
      white: 0,
      rose: 0,
      sparkling: 0,
      orange: 0,
      dessert: 0,
      fortified: 0,
      total: 0
    };
    const counts = {
      red: 0,
      white: 0,
      rose: 0,
      sparkling: 0,
      orange: 0,
      dessert: 0,
      fortified: 0
    };
    wines.forEach(w => {
      const t = (w.type || '').toLowerCase().replace('é', 'e');
      if (counts[t] !== undefined) counts[t]++;else counts.red++;
    });
    const total = wines.length;
    return {
      ...counts,
      total,
      redPct: counts.red / total,
      whitePct: counts.white / total,
      rosePct: counts.rose / total,
      sparklingPct: counts.sparkling / total,
      orangePct: counts.orange / total,
      dessertPct: counts.dessert / total,
      fortifiedPct: counts.fortified / total
    };
  }
};

/* ── Taste-match score (WineDNA vs. rating history) ──
   Compares wine's body/tannins/acidity/sweetness against a RATING-WEIGHTED
   average for that type from WineHistory — wines you rated higher pull the
   target profile toward them, ones you rated low pull away. Pure function
   of (wine, userWines): same inputs always produce the same score, and a
   type/grape you haven't rated yet returns null (shown as "New for your
   palate") rather than a padded mid-range number. Returns 15–98, or null. */
function calcMatchScore(wine, userWines) {
  if (!wine || !userWines) return null;
  const typeKey = (wine.type || 'red').toLowerCase().replace(/é/g, 'e');
  const rated = userWines.filter(w => (w.type || 'red').toLowerCase().replace(/é/g, 'e') === typeKey && w.body != null && w.rating != null && w.rating > 0);
  if (!rated.length) return null;
  // rating is out of 100: a 20/100 wine weighs 0.1, a 100/100 wine weighs 1.0 — loved wines shape the profile far more than tolerated ones
  const wt = w => Math.max(0.1, w.rating / 100);
  const wAvg = field => {
    const ws = rated.filter(w => w[field] != null);
    if (!ws.length) return null;
    const sw = ws.reduce((s, w) => s + wt(w), 0);
    return ws.reduce((s, w) => s + wt(w) * w[field], 0) / sw;
  };
  const avgB = wAvg('body'),
    avgT = wAvg('tannins'),
    avgA = wAvg('acidity'),
    avgS = wAvg('sweetness');
  // prox: 1 = perfect match, 0 = ≥0.6 units apart
  const prox = (wv, uv) => uv == null ? null : Math.max(0, 1 - Math.abs((wv ?? 0.5) - uv) / 0.6);
  const scores = [[prox(wine.body ?? 0.65, avgB), 0.30], [prox(wine.tannins ?? 0.55, avgT), 0.25], [prox(wine.acidity ?? 0.60, avgA), 0.25], [prox(wine.sweetness ?? 0.10, avgS), 0.20]].filter(([s]) => s != null);
  if (!scores.length) return null;
  const totalW = scores.reduce((s, [, w]) => s + w, 0);
  const raw = scores.reduce((s, [sc, w]) => s + sc * (w / totalW), 0);
  // Scale: 0 raw → 15 %, 1.0 raw → 98 % — a genuine mismatch reads low, not "worth a try"
  return Math.max(15, Math.min(98, Math.round(15 + raw * 83)));
}

/* ── Affinity: signals from cards the user saves in the scan-results deck.
   Saving a "why you'll like it" / origin / grape card records a small positive
   lean toward that wine's grapes, region and country, which then nudges the
   match score everywhere (list + detail agree, since both call calcMatchScore). */
const WineAffinity = {
  KEY: 'vinterest_affinity',
  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch (e) {
      return {};
    }
  },
  _save(a) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(a));
    } catch (e) {}
  },
  norm(s) {
    return (s || '').trim().toLowerCase();
  },
  bump(wine, weight) {
    if (!wine) return;
    const a = this.get();
    const add = (bucket, key) => {
      key = this.norm(key);
      if (!key) return;
      a[bucket] = a[bucket] || {};
      a[bucket][key] = Math.max(-3, Math.min(6, (a[bucket][key] || 0) + weight));
    };
    (wine.grapes || []).forEach(g => add('grapes', g));
    add('regions', wine.region);
    add('countries', wine.country);
    this._save(a);
    window.dispatchEvent(new Event('vinterest:affinity'));
  },
  scoreFor(wine) {
    if (!wine) return 0;
    const a = this.get();
    let s = 0,
      n = 0;
    const grab = (bucket, key) => {
      key = this.norm(key);
      if (!key) return;
      const v = (a[bucket] || {})[key];
      if (v != null) {
        s += v;
        n++;
      }
    };
    (wine.grapes || []).forEach(g => grab('grapes', g));
    grab('regions', wine.region);
    grab('countries', wine.country);
    if (!n) return 0;
    // Each unit of stored lean ≈ 1.2 match points, capped so it stays a nudge.
    return Math.max(-8, Math.min(10, s / Math.max(1, n) * 1.2 + (s > 0 ? Math.min(3, n * 0.4) : 0)));
  }
};

/* ── Regions, currencies, Travel Mode ── */
const CURRENCY_LIST = [{
  code: 'USD',
  sym: '$'
}, {
  code: 'GBP',
  sym: '£'
}, {
  code: 'EUR',
  sym: '€'
}, {
  code: 'CAD',
  sym: 'CA$'
}, {
  code: 'AUD',
  sym: 'A$'
}, {
  code: 'NZD',
  sym: 'NZ$'
}, {
  code: 'JPY',
  sym: '¥'
}, {
  code: 'CNY',
  sym: '¥'
}, {
  code: 'CHF',
  sym: 'CHF'
}, {
  code: 'ZAR',
  sym: 'R'
}, {
  code: 'SGD',
  sym: 'S$'
}, {
  code: 'HKD',
  sym: 'HK$'
}, {
  code: 'MXN',
  sym: 'MX$'
}, {
  code: 'BRL',
  sym: 'R$'
}, {
  code: 'INR',
  sym: '₹'
}, {
  code: 'AED',
  sym: 'AED'
}, {
  code: 'SEK',
  sym: 'kr'
}, {
  code: 'NOK',
  sym: 'kr'
}, {
  code: 'DKK',
  sym: 'kr'
}];
const COUNTRY_CURRENCY = {
  'united states': 'USD',
  'usa': 'USD',
  'us': 'USD',
  'united kingdom': 'GBP',
  'uk': 'GBP',
  'england': 'GBP',
  'scotland': 'GBP',
  'wales': 'GBP',
  'canada': 'CAD',
  'australia': 'AUD',
  'new zealand': 'NZD',
  'france': 'EUR',
  'germany': 'EUR',
  'italy': 'EUR',
  'spain': 'EUR',
  'portugal': 'EUR',
  'ireland': 'EUR',
  'netherlands': 'EUR',
  'belgium': 'EUR',
  'austria': 'EUR',
  'greece': 'EUR',
  'japan': 'JPY',
  'china': 'CNY',
  'switzerland': 'CHF',
  'south africa': 'ZAR',
  'singapore': 'SGD',
  'hong kong': 'HKD',
  'mexico': 'MXN',
  'brazil': 'BRL',
  'india': 'INR',
  'uae': 'AED',
  'united arab emirates': 'AED',
  'dubai': 'AED',
  'sweden': 'SEK',
  'norway': 'NOK',
  'denmark': 'DKK'
};
function lookupCountryCurrency(name) {
  const key = (name || '').trim().toLowerCase();
  const code = COUNTRY_CURRENCY[key];
  if (!code) return null;
  return CURRENCY_LIST.find(c => c.code === code) || null;
}
const HOME_REGION_CURRENCY = {
  uk: {
    sym: '£',
    code: 'GBP',
    label: 'United Kingdom'
  },
  us: {
    sym: '$',
    code: 'USD',
    label: 'United States'
  },
  ontario: {
    sym: 'CA$',
    code: 'CAD',
    label: 'Canada'
  },
  canada: {
    sym: 'CA$',
    code: 'CAD',
    label: 'Canada'
  },
  australia: {
    sym: 'A$',
    code: 'AUD',
    label: 'Australia'
  },
  nz: {
    sym: 'NZ$',
    code: 'NZD',
    label: 'New Zealand'
  },
  eu: {
    sym: '€',
    code: 'EUR',
    label: 'Europe'
  },
  france: {
    sym: '€',
    code: 'EUR',
    label: 'France'
  },
  germany: {
    sym: '€',
    code: 'EUR',
    label: 'Germany'
  },
  italy: {
    sym: '€',
    code: 'EUR',
    label: 'Italy'
  },
  spain: {
    sym: '€',
    code: 'EUR',
    label: 'Spain'
  }
};
const Regional = {
  TRAVEL_KEY: 'vinterest_travel',
  travel() {
    let t;
    try {
      t = JSON.parse(localStorage.getItem(this.TRAVEL_KEY) || 'null');
    } catch (e) {
      return null;
    }
    if (!t || !t.active) return null;
    if (t.until) {
      const untilEnd = new Date(t.until + 'T23:59:59');
      if (!isNaN(untilEnd.getTime()) && Date.now() > untilEnd.getTime()) {
        t.active = false;
        localStorage.setItem(this.TRAVEL_KEY, JSON.stringify(t));
        window.dispatchEvent(new Event('vinterest:travel'));
        return null;
      }
    }
    return t;
  },
  home() {
    const region = (localStorage.getItem('vinterest_region') || 'uk').toLowerCase();
    return HOME_REGION_CURRENCY[region] || HOME_REGION_CURRENCY.uk;
  },
  current() {
    const t = this.travel();
    if (t) return {
      sym: t.sym,
      base: t.sym,
      code: t.code,
      label: t.country,
      isTravel: true
    };
    const h = this.home();
    return {
      sym: h.sym,
      base: h.sym,
      code: h.code,
      label: h.label,
      isTravel: false
    };
  },
  setTravel(country, until, codeOverride) {
    const match = codeOverride ? CURRENCY_LIST.find(c => c.code === codeOverride) : lookupCountryCurrency(country);
    const cur = match || {
      code: 'USD',
      sym: '$'
    };
    const t = {
      active: true,
      country: (country || '').trim(),
      sym: cur.sym,
      code: cur.code,
      until: until || ''
    };
    localStorage.setItem(this.TRAVEL_KEY, JSON.stringify(t));
    window.dispatchEvent(new Event('vinterest:travel'));
    return t;
  },
  disableTravel() {
    let t;
    try {
      t = JSON.parse(localStorage.getItem(this.TRAVEL_KEY) || 'null');
    } catch (e) {
      t = null;
    }
    if (t) {
      t.active = false;
      localStorage.setItem(this.TRAVEL_KEY, JSON.stringify(t));
    }
    window.dispatchEvent(new Event('vinterest:travel'));
  }
};

/* ── Shared retail-price estimate: single source of truth used by both the
   Wine Detail price tab and the wine-list value/markup badges, so the two
   screens never disagree on what a wine "should" cost. Cached per wine+currency. */
function retailPriceCacheKey(wine, code) {
  return 'vinterest_price_v2_' + (wine && wine.name || '').replace(/\s/g, '_') + '_' + (wine && wine.vintage || 'nv') + '_' + code;
}
function fetchRetailEstimate(wine, curr) {
  const cacheKey = retailPriceCacheKey(wine, curr.code);
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      return Promise.resolve(JSON.parse(cached));
    } catch (e) {}
  }
  const prompt = 'You are a wine market pricing expert with deep knowledge of actual retail prices worldwide.' + ' Your task: find the ACTUAL known retail price for this SPECIFIC wine — look up this exact producer and label, do NOT average by appellation.' + ' Prestigious named wines (e.g. Guigal single-vineyard La Mouline/La Turque/La Landonne, DRC, Leroy, Screaming Eagle, Petrus, Opus One, cult Burgundy) retail for ' + curr.sym + '50–' + curr.sym + '5000+; use the real figure.' + ' Wine: ' + (wine.name || '') + (wine.vintage ? ' ' + wine.vintage : '') + '.' + ' Type: ' + (wine.type || 'red') + '.' + ' Region: ' + (wine.region || '') + ', ' + (wine.country || '') + '.' + ' Grapes: ' + ((wine.grapes || []).join(', ') || 'unknown') + '.' + (wine.abv ? ' ABV: ' + wine.abv + '%.' : '') + ' Currency: ' + curr.label + ' (' + curr.code + ').' + ' Return ONLY valid JSON, no markdown: {"low":NUMBER,"mid":NUMBER,"high":NUMBER,"currency":"' + curr.code + '","tier":"entry|everyday|premium|luxury|ultra-luxury","note":"one sentence — what drives this specific wine price (producer rep, rarity, appellation, etc)"}.' + ' Integers only. Return null values only if the wine is genuinely unidentifiable.';
  return window.claude.complete({
    messages: [{
      role: 'user',
      content: prompt
    }]
  }).then(text => {
    let c = text.replace(/```json|```/g, '').trim();
    const s = c.indexOf('{'),
      e = c.lastIndexOf('}');
    if (s >= 0 && e > s) c = c.slice(s, e + 1);
    const d = JSON.parse(c);
    localStorage.setItem(cacheKey, JSON.stringify(d));
    return d;
  });
}
Object.assign(window, {
  C,
  Icon,
  BottomNav,
  SideNav,
  Pill,
  Prog,
  Card,
  Btn,
  WineHistory,
  ProBadge,
  ProGate,
  calcMatchScore,
  WineAffinity,
  Regional,
  CURRENCY_LIST,
  lookupCountryCurrency,
  fetchRetailEstimate,
  retailPriceCacheKey
});

/* ---- tweaks-panel.jsx (precompiled) ---- */
// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)

/* BEGIN USAGE */
// tweaks-panel.jsx
// Reusable Tweaks shell + form-control helpers.
// Exports (to window): useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider,
//   TweakToggle, TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton.
//
// Owns the host protocol (listens for __activate_edit_mode / __deactivate_edit_mode,
// posts __edit_mode_available / __edit_mode_set_keys / __edit_mode_dismissed) so
// individual prototypes don't re-roll it. Ships a consistent set of controls so you
// don't hand-draw <input type="range">, segmented radios, steppers, etc.
//
// Usage (in an HTML file that loads React + Babel):
//
//   const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
//     "primaryColor": "#D97757",
//     "palette": ["#D97757", "#29261b", "#f6f4ef"],
//     "fontSize": 16,
//     "density": "regular",
//     "dark": false
//   }/*EDITMODE-END*/;
//
//   function App() {
//     const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
//     return (
//       <div style={{ fontSize: t.fontSize, color: t.primaryColor }}>
//         Hello
//         <TweaksPanel>
//           <TweakSection label="Typography" />
//           <TweakSlider label="Font size" value={t.fontSize} min={10} max={32} unit="px"
//                        onChange={(v) => setTweak('fontSize', v)} />
//           <TweakRadio  label="Density" value={t.density}
//                        options={['compact', 'regular', 'comfy']}
//                        onChange={(v) => setTweak('density', v)} />
//           <TweakSection label="Theme" />
//           <TweakColor  label="Primary" value={t.primaryColor}
//                        options={['#D97757', '#2A6FDB', '#1F8A5B', '#7A5AE0']}
//                        onChange={(v) => setTweak('primaryColor', v)} />
//           <TweakColor  label="Palette" value={t.palette}
//                        options={[['#D97757', '#29261b', '#f6f4ef'],
//                                  ['#475569', '#0f172a', '#f1f5f9']]}
//                        onChange={(v) => setTweak('palette', v)} />
//           <TweakToggle label="Dark mode" value={t.dark}
//                        onChange={(v) => setTweak('dark', v)} />
//         </TweaksPanel>
//       </div>
//     );
//   }
//
// TweakRadio is the segmented control for 2–3 short options (auto-falls-back to
// TweakSelect past ~16/~10 chars per label); reach for TweakSelect directly when
// options are many or long. For color tweaks always curate 3-4 options rather than
// a free picker; an option can also be a whole 2–5 color palette (the stored value
// is the array). The Tweak* controls are a floor, not a ceiling — build custom
// controls inside the panel if a tweak calls for UI they don't cover.
/* END USAGE */
// ─────────────────────────────────────────────────────────────────────────────

const __TWEAKS_STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    transform:scale(var(--dc-inv-zoom,1));transform-origin:bottom right;
    background:rgba(250,249,247,.78);color:#29261b;
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid rgba(255,255,255,.6);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.18);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;color:rgba(41,38,27,.55);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1}
  .twk-x:hover{background:rgba(0,0,0,.06);color:#29261b}
  .twk-body{padding:2px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:rgba(0,0,0,.15) transparent}
  .twk-body::-webkit-scrollbar{width:8px}
  .twk-body::-webkit-scrollbar-track{background:transparent;margin:2px}
  .twk-body::-webkit-scrollbar-thumb{background:rgba(0,0,0,.15);border-radius:4px;
    border:2px solid transparent;background-clip:content-box}
  .twk-body::-webkit-scrollbar-thumb:hover{background:rgba(0,0,0,.25);
    border:2px solid transparent;background-clip:content-box}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:rgba(41,38,27,.72)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-val{color:rgba(41,38,27,.5);font-variant-numeric:tabular-nums}

  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:rgba(41,38,27,.45);padding:10px 0 0}
  .twk-sect:first-child{padding-top:0}

  .twk-field{appearance:none;box-sizing:border-box;width:100%;min-width:0;height:26px;padding:0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;
    background:rgba(255,255,255,.6);color:inherit;font:inherit;outline:none}
  .twk-field:focus{border-color:rgba(0,0,0,.25);background:rgba(255,255,255,.85)}
  select.twk-field{padding-right:22px;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='rgba(0,0,0,.5)' d='M0 0h10L5 6z'/></svg>");
    background-repeat:no-repeat;background-position:right 8px center}

  .twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:4px;margin:6px 0;
    border-radius:999px;background:rgba(0,0,0,.12);outline:none}
  .twk-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:14px;height:14px;border-radius:50%;background:#fff;
    border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}
  .twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;
    background:#fff;border:.5px solid rgba(0,0,0,.12);box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:default}

  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:rgba(0,0,0,.06);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:rgba(255,255,255,.9);box-shadow:0 1px 2px rgba(0,0,0,.12);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg.dragging .twk-seg-thumb{transition:none}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2;
    overflow-wrap:anywhere}

  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:rgba(0,0,0,.15);transition:background .15s;cursor:default;padding:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}

  .twk-num{display:flex;align-items:center;box-sizing:border-box;min-width:0;height:26px;padding:0 0 0 8px;
    border:.5px solid rgba(0,0,0,.1);border-radius:7px;background:rgba(255,255,255,.6)}
  .twk-num-lbl{font-weight:500;color:rgba(41,38,27,.6);cursor:ew-resize;
    user-select:none;padding-right:8px}
  .twk-num input{flex:1;min-width:0;height:100%;border:0;background:transparent;
    font:inherit;font-variant-numeric:tabular-nums;text-align:right;padding:0 8px 0 0;
    outline:none;color:inherit;-moz-appearance:textfield}
  .twk-num input::-webkit-inner-spin-button,.twk-num input::-webkit-outer-spin-button{
    -webkit-appearance:none;margin:0}
  .twk-num-unit{padding-right:8px;color:rgba(41,38,27,.45)}

  .twk-btn{appearance:none;height:26px;padding:0 12px;border:0;border-radius:7px;
    background:rgba(0,0,0,.78);color:#fff;font:inherit;font-weight:500;cursor:default}
  .twk-btn:hover{background:rgba(0,0,0,.88)}
  .twk-btn.secondary{background:rgba(0,0,0,.06);color:inherit}
  .twk-btn.secondary:hover{background:rgba(0,0,0,.1)}

  .twk-swatch{appearance:none;-webkit-appearance:none;width:56px;height:22px;
    border:.5px solid rgba(0,0,0,.1);border-radius:6px;padding:0;cursor:default;
    background:transparent;flex-shrink:0}
  .twk-swatch::-webkit-color-swatch-wrapper{padding:0}
  .twk-swatch::-webkit-color-swatch{border:0;border-radius:5.5px}
  .twk-swatch::-moz-color-swatch{border:0;border-radius:5.5px}

  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s cubic-bezier(.3,.7,.4,1),box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);
    box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px rgba(0,0,0,.85),
    0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span>i:first-child{box-shadow:none}
  .twk-chip svg{position:absolute;top:6px;left:6px;width:13px;height:13px;
    filter:drop-shadow(0 1px 1px rgba(0,0,0,.3))}
`;

// ── useTweaks ───────────────────────────────────────────────────────────────
// Single source of truth for tweak values. setTweak persists via the host
// (__edit_mode_set_keys → host rewrites the EDITMODE block on disk).
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults);
  // Accepts either setTweak('key', value) or setTweak({ key: value, ... }) so a
  // useState-style call doesn't write a "[object Object]" key into the persisted
  // JSON block.
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits = typeof keyOrEdits === 'object' && keyOrEdits !== null ? keyOrEdits : {
      [keyOrEdits]: val
    };
    setValues(prev => ({
      ...prev,
      ...edits
    }));
    window.parent.postMessage({
      type: '__edit_mode_set_keys',
      edits
    }, '*');
    // Same-window signal so in-page listeners (deck-stage rail thumbnails)
    // can react — the parent message only reaches the host, not peers.
    window.dispatchEvent(new CustomEvent('tweakchange', {
      detail: edits
    }));
  }, []);
  return [values, setTweak];
}

// ── TweaksPanel ─────────────────────────────────────────────────────────────
// Floating shell. Registers the protocol listener BEFORE announcing
// availability — if the announce ran first, the host's activate could land
// before our handler exists and the toolbar toggle would silently no-op.
// The close button posts __edit_mode_dismissed so the host's toolbar toggle
// flips off in lockstep; the host echoes __deactivate_edit_mode back which
// is what actually hides the panel.
function TweaksPanel({
  title = 'Tweaks',
  children
}) {
  const [open, setOpen] = React.useState(false);
  const dragRef = React.useRef(null);
  const offsetRef = React.useRef({
    x: 16,
    y: 16
  });
  const PAD = 16;
  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth,
      h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y))
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);
  React.useEffect(() => {
    if (!open) return;
    clampToViewport();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', clampToViewport);
      return () => window.removeEventListener('resize', clampToViewport);
    }
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);
  React.useEffect(() => {
    const onMsg = e => {
      const t = e?.data?.type;
      if (t === '__activate_edit_mode') setOpen(true);else if (t === '__deactivate_edit_mode') setOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({
      type: '__edit_mode_available'
    }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const dismiss = () => {
    setOpen(false);
    window.parent.postMessage({
      type: '__edit_mode_dismissed'
    }, '*');
  };
  const onDragStart = e => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX,
      sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = ev => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy)
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("style", null, __TWEAKS_STYLE), /*#__PURE__*/React.createElement("div", {
    ref: dragRef,
    className: "twk-panel",
    "data-omelette-chrome": "",
    style: {
      right: offsetRef.current.x,
      bottom: offsetRef.current.y
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-hd",
    onMouseDown: onDragStart
  }, /*#__PURE__*/React.createElement("b", null, title), /*#__PURE__*/React.createElement("button", {
    className: "twk-x",
    "aria-label": "Close tweaks",
    onMouseDown: e => e.stopPropagation(),
    onClick: dismiss
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    className: "twk-body"
  }, children)));
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function TweakSection({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "twk-sect"
  }, label), children);
}
function TweakRow({
  label,
  value,
  children,
  inline = false
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: inline ? 'twk-row twk-row-h' : 'twk-row'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label), value != null && /*#__PURE__*/React.createElement("span", {
    className: "twk-val"
  }, value)), children);
}

// ── Controls ────────────────────────────────────────────────────────────────

function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '',
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label,
    value: `${value}${unit}`
  }, /*#__PURE__*/React.createElement("input", {
    type: "range",
    className: "twk-slider",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value))
  }));
}
function TweakToggle({
  label,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-row twk-row-h"
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-lbl"
  }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "twk-toggle",
    "data-on": value ? '1' : '0',
    role: "switch",
    "aria-checked": !!value,
    onClick: () => onChange(!value)
  }, /*#__PURE__*/React.createElement("i", null)));
}
function TweakRadio({
  label,
  value,
  options,
  onChange
}) {
  const trackRef = React.useRef(null);
  const [dragging, setDragging] = React.useState(false);
  // The active value is read by pointer-move handlers attached for the lifetime
  // of a drag — ref it so a stale closure doesn't fire onChange for every move.
  const valueRef = React.useRef(value);
  valueRef.current = value;

  // Segments wrap mid-word once per-segment width runs out. The track is
  // ~248px (280 panel − 28 body pad − 4 seg pad), each button loses 12px
  // to its own padding, and 11.5px system-ui averages ~6.3px/char — so 2
  // options fit ~16 chars each, 3 fit ~10. Past that (or >3 options), fall
  // back to a dropdown rather than wrap.
  const labelLen = o => String(typeof o === 'object' ? o.label : o).length;
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0);
  const fitsAsSegments = maxLen <= ({
    2: 16,
    3: 10
  }[options.length] ?? 0);
  if (!fitsAsSegments) {
    // <select> emits strings — map back to the original option value so the
    // fallback stays type-preserving (numbers, booleans) like the segment path.
    const resolve = s => {
      const m = options.find(o => String(typeof o === 'object' ? o.value : o) === s);
      return m === undefined ? s : typeof m === 'object' ? m.value : m;
    };
    return /*#__PURE__*/React.createElement(TweakSelect, {
      label: label,
      value: value,
      options: options,
      onChange: s => onChange(resolve(s))
    });
  }
  const opts = options.map(o => typeof o === 'object' ? o : {
    value: o,
    label: o
  });
  const idx = Math.max(0, opts.findIndex(o => o.value === value));
  const n = opts.length;
  const segAt = clientX => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 4;
    const i = Math.floor((clientX - r.left - 2) / inner * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };
  const onPointerDown = e => {
    setDragging(true);
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = ev => {
      if (!trackRef.current) return;
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      setDragging(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    role: "radiogroup",
    onPointerDown: onPointerDown,
    className: dragging ? 'twk-seg dragging' : 'twk-seg'
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-seg-thumb",
    style: {
      left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
      width: `calc((100% - 4px) / ${n})`
    }
  }), opts.map(o => /*#__PURE__*/React.createElement("button", {
    key: o.value,
    type: "button",
    role: "radio",
    "aria-checked": o.value === value
  }, o.label))));
}
function TweakSelect({
  label,
  value,
  options,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("select", {
    className: "twk-field",
    value: value,
    onChange: e => onChange(e.target.value)
  }, options.map(o => {
    const v = typeof o === 'object' ? o.value : o;
    const l = typeof o === 'object' ? o.label : o;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, l);
  })));
}
function TweakText({
  label,
  value,
  placeholder,
  onChange
}) {
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("input", {
    className: "twk-field",
    type: "text",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange(e.target.value)
  }));
}
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}) {
  const clamp = n => {
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };
  const startRef = React.useRef({
    x: 0,
    val: 0
  });
  const onScrubStart = e => {
    e.preventDefault();
    startRef.current = {
      x: e.clientX,
      val: value
    };
    const decimals = (String(step).split('.')[1] || '').length;
    const move = ev => {
      const dx = ev.clientX - startRef.current.x;
      const raw = startRef.current.val + dx * step;
      const snapped = Math.round(raw / step) * step;
      onChange(clamp(Number(snapped.toFixed(decimals))));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "twk-num"
  }, /*#__PURE__*/React.createElement("span", {
    className: "twk-num-lbl",
    onPointerDown: onScrubStart
  }, label), /*#__PURE__*/React.createElement("input", {
    type: "number",
    value: value,
    min: min,
    max: max,
    step: step,
    onChange: e => onChange(clamp(Number(e.target.value)))
  }), unit && /*#__PURE__*/React.createElement("span", {
    className: "twk-num-unit"
  }, unit));
}

// Relative-luminance contrast pick — checkmarks drawn over a swatch need to
// read on both #111 and #fafafa without per-option configuration. Hex input
// only (#rgb / #rrggbb); named or rgb()/hsl() colors fall through to "light".
function __twkIsLight(hex) {
  const h = String(hex).replace('#', '');
  const x = h.length === 3 ? h.replace(/./g, c => c + c) : h.padEnd(6, '0');
  const n = parseInt(x.slice(0, 6), 16);
  if (Number.isNaN(n)) return true;
  const r = n >> 16 & 255,
    g = n >> 8 & 255,
    b = n & 255;
  return r * 299 + g * 587 + b * 114 > 148000;
}
const __TwkCheck = ({
  light
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 14 14",
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("path", {
  d: "M3 7.2 5.8 10 11 4.2",
  fill: "none",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  stroke: light ? 'rgba(0,0,0,.78)' : '#fff'
}));

// TweakColor — curated color/palette picker. Each option is either a single
// hex string or an array of 1-5 hex strings; the card adapts — a lone color
// renders solid, a palette renders colors[0] as the hero (left ~2/3) with the
// rest stacked in a sharp column on the right. onChange emits the
// option in the shape it was passed (string stays string, array stays array).
// Without options it falls back to the native color input for back-compat.
function TweakColor({
  label,
  value,
  options,
  onChange
}) {
  if (!options || !options.length) {
    return /*#__PURE__*/React.createElement("div", {
      className: "twk-row twk-row-h"
    }, /*#__PURE__*/React.createElement("div", {
      className: "twk-lbl"
    }, /*#__PURE__*/React.createElement("span", null, label)), /*#__PURE__*/React.createElement("input", {
      type: "color",
      className: "twk-swatch",
      value: value,
      onChange: e => onChange(e.target.value)
    }));
  }
  // Native <input type=color> emits lowercase hex per the HTML spec, so
  // compare case-insensitively. String() guards JSON.stringify(undefined),
  // which returns the primitive undefined (no .toLowerCase).
  const key = o => String(JSON.stringify(o)).toLowerCase();
  const cur = key(value);
  return /*#__PURE__*/React.createElement(TweakRow, {
    label: label
  }, /*#__PURE__*/React.createElement("div", {
    className: "twk-chips",
    role: "radiogroup"
  }, options.map((o, i) => {
    const colors = Array.isArray(o) ? o : [o];
    const [hero, ...rest] = colors;
    const sup = rest.slice(0, 4);
    const on = key(o) === cur;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      type: "button",
      className: "twk-chip",
      role: "radio",
      "aria-checked": on,
      "data-on": on ? '1' : '0',
      "aria-label": colors.join(', '),
      title: colors.join(' · '),
      style: {
        background: hero
      },
      onClick: () => onChange(o)
    }, sup.length > 0 && /*#__PURE__*/React.createElement("span", null, sup.map((c, j) => /*#__PURE__*/React.createElement("i", {
      key: j,
      style: {
        background: c
      }
    }))), on && /*#__PURE__*/React.createElement(__TwkCheck, {
      light: __twkIsLight(hero)
    }));
  })));
}
function TweakButton({
  label,
  onClick,
  secondary = false
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: secondary ? 'twk-btn secondary' : 'twk-btn',
    onClick: onClick
  }, label);
}
Object.assign(window, {
  useTweaks,
  TweaksPanel,
  TweakSection,
  TweakRow,
  TweakSlider,
  TweakToggle,
  TweakRadio,
  TweakSelect,
  TweakText,
  TweakNumber,
  TweakColor,
  TweakButton
});

/* ---- pwa-screens-main.jsx (precompiled) ---- */
/* Vinterest PWA — Home, Scan, Wine Identified screens */

/* ── SCAN HOME (Scan tab content) ── */
function ScanHomeScreen({
  nav,
  showPro,
  isTablet
}) {
  const wines = WineHistory.getAll();
  const isPro = !!localStorage.getItem('vinterest_pro');
  const scanCount = parseInt(localStorage.getItem('vinterest_scan_count') || '0');
  const FREE_SCANS = 10;
  const atLimit = !isPro && scanCount >= FREE_SCANS;
  const scansLeft = Math.max(0, FREE_SCANS - scanCount);
  const typeColors = {
    red: C.cr,
    white: '#B8963E',
    rosé: '#C47A8A',
    rose: '#C47A8A',
    sparkling: '#5E8FA8'
  };
  const colFor = w => typeColors[(w.type || 'red').toLowerCase().replace('é', 'e')] || C.cr;
  function handleScanCTA() {
    if (atLimit) {
      showPro('unlimited-scans');
      return;
    }
    nav('camera');
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: C.white,
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 28,
      width: 'auto',
      display: 'block'
    }
  }), !isPro && !atLimit && scansLeft <= 3 && scansLeft > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.amber,
      fontWeight: 600,
      fontFamily: C.P,
      background: C.amberBg,
      padding: '4px 10px',
      borderRadius: 20,
      border: `1px solid ${C.amber}30`
    }
  }, scansLeft, " scan", scansLeft !== 1 ? 's' : '', " left"), !isPro && atLimit && /*#__PURE__*/React.createElement("div", {
    onClick: () => showPro('unlimited-scans'),
    style: {
      fontSize: 13,
      fontWeight: 700,
      fontFamily: C.P,
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)',
      padding: '5px 12px',
      borderRadius: 20,
      cursor: 'pointer',
      color: '#fff'
    }
  }, "Upgrade")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, !isTablet && /*#__PURE__*/React.createElement("div", {
    onClick: handleScanCTA,
    style: {
      background: C.ink,
      borderRadius: 20,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      cursor: 'pointer',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: -24,
      top: -24,
      width: 140,
      height: 140,
      borderRadius: 70,
      background: `${C.cr}28`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 58,
      height: 58,
      borderRadius: 16,
      background: atLimit ? '#444' : C.cr,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      zIndex: 1,
      boxShadow: atLimit ? 'none' : `0 6px 24px ${C.cr}55`
    }
  }, atLimit ? /*#__PURE__*/React.createElement(Icon, {
    n: "lock",
    sz: 24,
    col: "#888"
  }) : /*#__PURE__*/React.createElement(Icon, {
    n: "camera",
    sz: 28,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 700,
      color: atLimit ? 'rgba(255,255,255,0.4)' : '#fff',
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, atLimit ? 'Free scans used up' : 'Scan a Bottle'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.4)',
      fontFamily: C.P,
      marginTop: 3
    }
  }, atLimit ? 'Upgrade for unlimited scans' : 'Point at any wine label to identify')), !atLimit && /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 16,
    col: "rgba(255,255,255,0.3)"
  })), isPro ? /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('camera'),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: `1px solid ${C.green}40`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: C.greenBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "list",
    sz: 18,
    col: C.green
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Wine List Scan"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#fff',
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)',
      borderRadius: 8,
      padding: '2px 7px'
    }
  }, "UNLOCKED")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 1
    }
  }, "Snap a restaurant menu for instant picks")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 14,
    col: C.mid
  })) : /*#__PURE__*/React.createElement("div", {
    onClick: () => showPro('wine-list'),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      border: `1px solid ${C.line}`,
      cursor: 'pointer',
      opacity: 0.75
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: 10,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "list",
    sz: 18,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P
    }
  }, "Wine List Scan"), /*#__PURE__*/React.createElement(ProBadge, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 1
    }
  }, "Snap a restaurant menu for instant picks")), /*#__PURE__*/React.createElement(Icon, {
    n: "lock",
    sz: 14,
    col: C.mid
  })), wines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      borderRadius: 16,
      padding: '28px 20px',
      textAlign: 'center',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 46,
      marginBottom: 10
    }
  }, "\uD83C\uDF77"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 6
    }
  }, "Your cellar is empty"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.65,
      marginBottom: 16
    }
  }, "Scan and rate your first bottle to start building your personal taste profile."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: handleScanCTA
  }, "Scan First Bottle"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => nav('learn')
  }, "Take a Quiz"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, "My Wines \xB7 ", wines.length), /*#__PURE__*/React.createElement("span", {
    onClick: () => nav('mywines'),
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Manage \u2192")), wines.map((w, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    style: {
      padding: 10,
      cursor: 'pointer'
    },
    onClick: () => {
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: false,
        wine: w,
        confidence: 0.9,
        existingRating: w.rating || 0
      }));
      nav('detail');
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 52,
      borderRadius: 8,
      background: colFor(w) + '15',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${colFor(w)}25`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 17,
    col: colFor(w)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, [w.region, w.country].filter(Boolean)[0] || '', " \xB7 ", w.vintage || 'NV'), w.type && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: colFor(w),
      fontFamily: C.P,
      fontWeight: 600,
      textTransform: 'capitalize',
      marginTop: 1
    }
  }, w.type)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 3,
      flexShrink: 0
    }
  }, w.rating > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.amber,
      fontFamily: C.P
    }
  }, w.rating), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, "/100")), w.times_consumed > 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, "\xD7", w.times_consumed)))))), wines.length === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginTop: 4
    }
  }, "Get Started"), [{
    emoji: '🎓',
    t: 'Take a Wine Quiz',
    s: 'Earn XP and learn something new',
    dest: 'learn'
  }, {
    emoji: '📖',
    t: '5 taste terms to know',
    s: 'Understand any wine in 2 minutes',
    dest: 'article'
  }].map((a, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    onClick: () => nav(a.dest),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 22,
      flexShrink: 0
    }
  }, a.emoji), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, a.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 1
    }
  }, a.s)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 14,
    col: C.mid
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  })));
}

/* ── SCAN CAMERA ── */
function ScanScreen({
  nav,
  back,
  onComplete
}) {
  const onboarding = !!onComplete; // onboarding: save the scan & advance the flow instead of navigating
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [phase, setPhase] = React.useState('viewfinder'); // viewfinder | processing
  const [capturedImg, setCapturedImg] = React.useState(null);
  const [mode, setMode] = React.useState('bottle'); // bottle | list
  const [camErr, setCamErr] = React.useState(false);
  const CURRENCIES = [{
    code: 'GBP',
    sym: '£'
  }, {
    code: 'USD',
    sym: '$'
  }, {
    code: 'CAD',
    sym: 'CA$'
  }, {
    code: 'AUD',
    sym: 'A$'
  }, {
    code: 'NZD',
    sym: 'NZ$'
  }, {
    code: 'EUR',
    sym: '€'
  }];
  const homeCurrency = Regional.current().code || localStorage.getItem('vinterest_currency') || 'GBP';
  const [listCurrency, setListCurrency] = React.useState(homeCurrency);
  const [currPickerOpen, setCurrPickerOpen] = React.useState(false);
  React.useEffect(() => {
    // No explicit width/height — forcing a portrait resolution can push some
    // phones' camera stacks into a cropped/digitally-zoomed capture mode.
    // Native resolution + CSS object-fit:cover handles framing instead.
    navigator.mediaDevices?.getUserMedia({
      video: {
        facingMode: 'environment'
      }
    }).then(s => {
      streamRef.current = s;
      if (videoRef.current) videoRef.current.srcObject = s;
      // Some phones default multi-camera systems to a 2x telephoto lens — force back to native 1x.
      const track = s.getVideoTracks()[0];
      const caps = track && track.getCapabilities ? track.getCapabilities() : null;
      if (caps && caps.zoom && typeof caps.zoom.min === 'number') {
        track.applyConstraints({
          advanced: [{
            zoom: caps.zoom.min
          }]
        }).catch(() => {});
      }
    }).catch(() => setCamErr(true));
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);
  const LABEL_PROMPT = `You are an expert sommelier with exceptional vision. Analyse this photo and identify any wine bottle label visible — even if partially obscured, at an angle, or in low light. Do your best with whatever text or imagery you can make out. Return ONLY valid JSON (no markdown, no code fences) with these fields: {"name":"full wine name","producer":"winery","vintage":2018,"region":"region","sub_region":"sub-region or empty string","country":"country","type":"red|white|rosé|sparkling|orange|dessert|fortified","grapes":["Primary Grape"],"body":0.85,"tannins":0.80,"acidity":0.60,"sweetness":0.05,"texture":0.5,"effervescence":0.5,"abv":13.5,"tasting_notes":["Note1","Note2","Note3"],"food_pairings":["Food1","Food2","Food3"],"price_usd":50,"community_rating":4.5,"description":"2-3 sentence approachable description.","why_you_will_like_this":"1-2 sentences personalised to a wine lover.","body_plain":"How heavy it feels in your mouth","tannins_plain":"That drying grip on your gums","acidity_plain":"How zingy and fresh it tastes","sweetness_plain":"Dry means barely any sugar","texture_plain":"Steely and clean, or rich and creamy","effervescence_plain":"How soft or vigorous the bubbles feel"}. "type" guide: "orange" is a white/amber grape fermented with extended skin contact like a red (has real tannins, from the same territory as natural/amber wines); "dessert" is a sweet, non-fortified wine (botrytis/noble rot, late harvest, ice wine — e.g. Sauternes, Tokaji); "fortified" has spirit added during production (Port, Sherry, Madeira, Marsala) and can range from bone dry to very sweet — judge from the label, do not assume fortified always means sweet. For "texture" (0=crisp/steely/unoaked, 1=rich/creamy/oaked from oak aging, lees contact, or malolactic fermentation): include a real value when type is "white", "orange", "dessert", or "fortified"; use null for "red", "rosé", and "sparkling". For "effervescence" (0=soft/delicate mousse, 1=vigorous/fine/persistent bubbles): ONLY include a real value when type is "sparkling"; use null for all other types. For "tannins": include a real value for "red", "orange", and "fortified" (many fortified reds like Port have real tannic structure); use null for "white", "rosé", "sparkling", and "dessert". Only return {"error":"no_wine_label"} if there is absolutely no wine bottle or label anywhere in the image.`;
  const LIST_PROMPT = `You are a sommelier reading a wine list, printed in ${listCurrency}. Extract EVERY wine from this image in the order they appear — do not skip any. Return ONLY valid JSON (no markdown): {"wines":[{"n":"wine name","t":"red|white|rosé|sparkling|orange|dessert|fortified","r":"region","c":"country","v":2020,"p":"price as printed on the list, verbatim, e.g. 85"}]}. PRICE RULES — read carefully: many lists price by pour tier (e.g. "GLASS:16", "1/2LTR:33", "BOTTLE:59" printed below or beside the wine name). When those tiered lines are present, set "p" to the FULL tiered string verbatim (e.g. "GLASS:16 / 1/2LTR:33 / BOTTLE:59") — the bottle figure is the one that matters, so never drop it. DISAMBIGUATING SHORT NUMBERS NEAR THE NAME: a wine name is sometimes followed by one or two short (1–2 digit) numbers rather than a separate price column. Reason about which they are: (a) if there are TWO such numbers and one is roughly 1.5–3x the other, both landing in a plausible drink-price range (e.g. teens/twenties and thirties/fifties), treat them as a glass price and a bottle price, NOT vintages — use them for "p" (e.g. "GLASS:16 / BOTTLE:45"); (b) if there is a single short number with no such pairing, and no separate GLASS/BOTTLE lines exist elsewhere for that wine, it is more likely a vintage only if it reads like a year shorthand (e.g. preceded by an apostrophe, or clearly grouped with other vintage-looking numbers in that column) — otherwise leave vintage null rather than guessing. Never use a 2-digit index/price as vintage. Only ever set "v" to a plausible 4-digit year (or a 2-digit year you are genuinely confident denotes one, e.g. '18 for 2018) — when genuinely ambiguous, prefer leaving "v" null over guessing wrong. Include ALL wines visible. Do not stop early.`;
  function capturePhoto() {
    if (!videoRef.current || !videoRef.current.videoWidth) {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setPhase('processing');
      if (onboarding) {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: true,
          reason: 'camera_not_ready'
        }));
        setTimeout(() => onComplete(null), 1200);
        return;
      }
      if (mode === 'list') {
        sessionStorage.setItem('vinterest_winelist_result', JSON.stringify({
          demo: true,
          reason: 'camera_not_ready'
        }));
        setTimeout(() => nav('winelist'), 1600);
      } else {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: true,
          reason: 'camera_not_ready'
        }));
        setTimeout(() => nav('identified'), 1600);
      }
      return;
    }
    // Capture frame FIRST, then stop stream (stopping first can blank the frame on mobile)
    const vw = videoRef.current.videoWidth;
    const vh = videoRef.current.videoHeight;
    // Resize to max 1024px longest side — keeps payload lean without losing label detail
    const maxDim = 1024;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    const b64 = dataUrl.split(',')[1];
    // Stop stream after capture
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setCapturedImg(dataUrl);
    setPhase('processing');
    if (mode === 'list') processListCapture(b64);else processLabelCapture(b64);
  }
  async function processLabelCapture(b64) {
    try {
      const text = await window.claude.complete({
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64
            }
          }, {
            type: 'text',
            text: LABEL_PROMPT
          }]
        }]
      });
      const wine = JSON.parse(text.replace(/```json|```/g, '').trim());
      if (wine.error === 'no_wine_label') throw new Error('no_wine_label');
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: false,
        wine,
        confidence: 0.95
      }));
      const _sc = parseInt(localStorage.getItem('vinterest_scan_count') || '0');
      localStorage.setItem('vinterest_scan_count', _sc + 1);
      XPSystem.awardAndToast([{
        type: 'scan'
      }, {
        type: 'weekly_scans'
      }, {
        type: 'first_type',
        value: wine.type
      }, {
        type: 'first_country',
        value: wine.country
      }, {
        type: 'new_grape',
        value: (wine.grapes || [])[0]
      }, ...((wine.price_usd || 0) >= 100 ? [{
        type: 'expensive_wine',
        wineKey: (wine.name || '') + '_' + (wine.vintage || '')
      }] : [])]);
      if (onboarding) {
        try {
          WineHistory.track(wine);
        } catch (e) {}
        onComplete(wine);
        return;
      }
    } catch (e) {
      if (onboarding) {
        onComplete(null);
        return;
      }
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: true,
        reason: e.message
      }));
      nav('identified');
      return;
    }
    nav('identified');
  }
  async function processListCapture(b64) {
    try {
      const text = await window.claude.complete({
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [{
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: b64
            }
          }, {
            type: 'text',
            text: LIST_PROMPT
          }]
        }]
      });
      // Robustly extract JSON — handles extra prose, code fences, truncation
      let cleaned = text.replace(/```json|```/g, '').trim();
      const s = cleaned.indexOf('{');
      const e = cleaned.lastIndexOf('}');
      if (s >= 0 && e > s) cleaned = cleaned.slice(s, e + 1);
      const data = JSON.parse(cleaned);
      if (data.error) throw new Error(data.error);
      // Normalise compact keys (n/t/r/c/v/p) to full names
      const raw = data.wines || data.wine_list || data.results || [];
      const wines = raw.map(w => ({
        name: w.name || w.n || 'Unknown',
        type: w.type || w.t || 'red',
        region: w.region || w.r || '',
        country: w.country || w.c || '',
        vintage: w.vintage || w.v || null,
        price: w.price || w.p || ''
      }));
      if (!wines.length) throw new Error('no_wines_found');
      sessionStorage.setItem('vinterest_winelist_result', JSON.stringify({
        demo: false,
        wines,
        currency: listCurrency
      }));
    } catch (e) {
      sessionStorage.setItem('vinterest_winelist_result', JSON.stringify({
        demo: true,
        reason: e.message
      }));
    } finally {
      nav('winelist');
    }
  }

  // ── Processing state ──
  if (phase === 'processing') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        background: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 28,
        padding: '0 32px',
        position: 'relative'
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: back,
      style: {
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 12px)',
        left: 20,
        width: 38,
        height: 38,
        borderRadius: 19,
        background: 'rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "back",
      sz: 18,
      col: "#fff"
    })), capturedImg && /*#__PURE__*/React.createElement("div", {
      style: {
        width: '70%',
        aspectRatio: '2/3',
        borderRadius: 16,
        overflow: 'hidden',
        border: `2px solid ${C.cr}`,
        boxShadow: `0 0 40px ${C.cr}35`
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: capturedImg,
      alt: "",
      style: {
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 22,
        border: '3px solid rgba(255,255,255,0.1)',
        borderTopColor: C.cr,
        animation: 'vspin 0.85s linear infinite'
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 19,
        fontWeight: 700,
        color: '#fff',
        fontFamily: C.P
      }
    }, mode === 'list' ? 'Analysing wine list…' : 'Analysing label…'), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.4)',
        fontFamily: C.P
      }
    }, "Identifying ", mode === 'list' ? 'wines' : 'wine', " with AI")), /*#__PURE__*/React.createElement("style", null, `@keyframes vspin{to{transform:rotate(360deg)}}`));
  }

  // ── Viewfinder state ──
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#0A0A0A',
      position: 'relative',
      overflow: 'hidden'
    }
  }, !camErr ? /*#__PURE__*/React.createElement("video", {
    ref: videoRef,
    autoPlay: true,
    playsInline: true,
    muted: true,
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: .88
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(135deg,#1a1a1a,#2d1b2e)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "camera",
    sz: 42,
    col: "rgba(255,255,255,0.18)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.3)',
      fontFamily: C.P
    }
  }, "Camera unavailable in preview")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 3,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 'calc(env(safe-area-inset-top) + 12px) 20px 16px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 38,
      height: 38,
      borderRadius: 19,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 18,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P,
      whiteSpace: 'nowrap'
    }
  }, onboarding ? 'Scan your first bottle' : 'Scan Wine'), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: mode === 'list' ? '95%' : '94%',
      height: mode === 'list' ? 'auto' : '100%',
      aspectRatio: mode === 'list' ? '2/3' : 'auto',
      maxHeight: mode === 'list' ? '87vh' : 'none',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      boxShadow: '0 0 0 2000px rgba(0,0,0,0.52)',
      pointerEvents: 'none',
      zIndex: 1
    }
  }), [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      position: 'absolute',
      zIndex: 2,
      [y ? 'bottom' : 'top']: -2,
      [x ? 'right' : 'left']: -2,
      width: 48,
      height: 48,
      borderTop: y ? 'none' : `3px solid ${C.cr}`,
      borderBottom: y ? `3px solid ${C.cr}` : 'none',
      borderLeft: x ? 'none' : `3px solid ${C.cr}`,
      borderRight: x ? `3px solid ${C.cr}` : 'none',
      borderRadius: y ? x ? '0 0 10px 0' : '0 0 0 10px' : x ? '0 10px 0 0' : '10px 0 0 0'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 16,
      left: 0,
      right: 0,
      textAlign: 'center',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.7)',
      fontFamily: C.P,
      background: 'rgba(0,0,0,0.48)',
      padding: '5px 14px',
      borderRadius: 20,
      backdropFilter: 'blur(4px)'
    }
  }, mode === 'list' ? 'Frame the wine list' : 'Frame the wine label')))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      zIndex: 3,
      padding: '0 20px 44px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0
    }
  }, !onboarding && mode === 'list' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setCurrPickerOpen(o => !o),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '8px 14px',
      borderRadius: 20,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(12px)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P
    }
  }, "List prices in ", listCurrency), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 11,
    col: "rgba(255,255,255,0.6)",
    style: {
      transform: currPickerOpen ? 'rotate(-90deg)' : 'rotate(90deg)'
    }
  })), currPickerOpen && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(20,20,20,0.92)',
      backdropFilter: 'blur(12px)',
      borderRadius: 12,
      padding: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 150
    }
  }, CURRENCIES.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.code,
    onClick: () => {
      setListCurrency(c.code);
      setCurrPickerOpen(false);
    },
    style: {
      padding: '8px 12px',
      borderRadius: 8,
      background: listCurrency === c.code ? C.cr : 'transparent',
      display: 'flex',
      justifyContent: 'space-between',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P
    }
  }, c.code), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.6)',
      fontFamily: C.P
    }
  }, c.sym))))), !onboarding && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      background: 'rgba(0,0,0,0.55)',
      borderRadius: 10,
      overflow: 'hidden',
      backdropFilter: 'blur(12px)'
    }
  }, ['Bottle', 'Wine List'].map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setMode(i === 0 ? 'bottle' : 'list'),
    style: {
      padding: '10px 24px',
      background: (i === 0 ? mode === 'bottle' : mode === 'list') ? C.cr : 'transparent',
      fontSize: 17,
      fontWeight: 600,
      color: (i === 0 ? mode === 'bottle' : mode === 'list') ? '#fff' : 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      cursor: 'pointer',
      transition: 'background .18s'
    }
  }, m))), /*#__PURE__*/React.createElement("div", {
    onClick: capturePhoto,
    style: {
      width: 74,
      height: 74,
      borderRadius: 37,
      background: 'rgba(255,255,255,0.92)',
      border: '4px solid rgba(255,255,255,0.35)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 4px 28px rgba(0,0,0,0.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 28,
      background: C.cr
    }
  }))));
}

/* ── WINE IDENTIFIED ──
   Goes straight to the same full wine-detail presentation used everywhere
   else in the app — no separate "Wine Identified!" holding screen. */
function WineIdentifiedScreen({
  nav,
  back
}) {
  const scanData = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const wine = scanData.wine || null;

  // Track scan immediately — saves to history even before rating
  React.useEffect(() => {
    if (wine && !scanData.demo) WineHistory.track(wine);
  }, [wine?.name, wine?.vintage]);
  return /*#__PURE__*/React.createElement(ScanCardsScreen, {
    nav: nav,
    back: back
  });
}
Object.assign(window, {
  ScanHomeScreen,
  ScanScreen,
  WineIdentifiedScreen
});

/* ---- pwa-scancards.jsx (precompiled) ---- */
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Vinterest PWA — Scan Result Cards
   A swipeable deck of quick-hit cards shown right after a label scan, BEFORE
   the full detail screen. Intent gate → cards (match, fit, caution, origin,
   fact, taste, talk, value) → rate (only if they've had / will have it).
   Deck interaction is tweakable: swipe deck / carousel / feed. */

/* ── content generation (batched, cached) ── */
/* Verified aging-classification facts — given to the model verbatim so it can never invent wrong numbers
   for well-known denominations (a learning platform can't afford to misstate these). */
const _AGING_FACTS = [{
  test: /riserva/i,
  fact: 'Chianti Classico Riserva must age at least 24 months, with a minimum of 3 months in bottle, before release.'
}, {
  test: /gran\s*reserva/i,
  fact: 'Rioja Gran Reserva reds require a minimum of 5 years aging before release, with at least 2 years in oak barrel and 2 more years in bottle.'
}, {
  test: /reserva/i,
  fact: 'Rioja Reserva reds require a minimum of 3 years aging before release, with at least 1 year in oak barrel and at least 6 months in bottle.'
}, {
  test: /crianza/i,
  fact: 'Rioja Crianza reds require a minimum of 2 years aging before release, with at least 1 year in oak barrel.'
}, {
  test: /vintage\s*champagne|champagne.*vintage/i,
  fact: 'Vintage Champagne must age on its lees for a minimum of 3 years before release, versus 15 months for non-vintage.'
}, {
  test: /vintage\s*port/i,
  fact: 'Vintage Port is bottled after only about 2 years in barrel, then does most of its aging in bottle for decades.'
}];
function _agingFactFor(w) {
  const hay = [w.name, w.producer].filter(Boolean).join(' ');
  const hit = _AGING_FACTS.find(f => f.test.test(hay));
  return hit ? hit.fact : null;
}
function useScanContent(wine, matchPct, dna) {
  const [gen, setGen] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!wine || !wine.name) return;
    const key = 'vinterest_scancards_v4_' + (wine.name || '').replace(/\s/g, '_') + '_' + (wine.vintage || 'nv') + '_' + (matchPct ?? 'x');
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        setGen(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    if (!window.claude || !window.claude.complete) return;
    setLoading(true);
    const w = wine;
    const dnaLine = dna ? `My WineDNA for ${w.type || 'red'}s, from ${dna.count} rated wine(s): top grape ${dna.topGrape || 'none yet'}, top region ${dna.topRegion || 'none yet'}, average rating I give this type is ${dna.avgRating}/100.` : `I have no rating history for ${w.type || 'red'}s yet.`;
    const matchLine = matchPct != null ? `Their computed match score for this exact bottle is ${matchPct}/100.` : 'No match score is available yet.';
    const agingFact = _agingFactFor(w);
    const agingLine = agingFact ? `REFERENCE AGING FACTS (use verbatim, do not alter the numbers): ${agingFact}` : 'REFERENCE AGING FACTS: none available for this wine\u2019s classification \u2014 do not state specific aging durations you are not certain of.';
    const prompt = 'You are a warm, knowledgeable sommelier writing quick-hit cards for a wine app. ' + 'Wine: ' + (w.name || '') + (w.vintage && w.vintage !== 'NV' && w.vintage !== 0 ? ' ' + w.vintage : '') + '. ' + 'Type: ' + (w.type || 'red') + '. Region: ' + (w.region || '') + (w.sub_region ? ' (' + w.sub_region + ')' : '') + ', ' + (w.country || '') + '. ' + 'Producer: ' + (w.producer || 'unknown') + '. ' + 'Grapes: ' + ((w.grapes || []).join(', ') || 'unknown') + '. ' + 'Tasting notes: ' + ((w.tasting_notes || []).join(', ') || 'n/a') + '. ' + dnaLine + ' ' + matchLine + ' ' + agingLine + ' ' + 'Return ONLY valid JSON, no markdown, all sentences concrete and specific to THIS wine (no generic filler), and NO numbers/percentages/decimals anywhere: ' + '{' + '"fact":"one genuinely surprising, memorable fact about this wine, its producer, grape, or region (max 28 words)",' + '"fit":"one vivid sentence on the FLAVOR/STYLE reasons this suits their palate — texture, body, fruit, oak, tannin, acidity. If my WineDNA above has a top grape or region, explicitly tie this wine to it by name (e.g. building on my known love of that grape/region) — never invent a grape or region I do not have in my profile (max 26 words)",' + '"caution":"one specific, practical thing worth knowing before or while drinking THIS bottle — e.g. decanting, serving temperature, food pairing risk, or how it will develop with age. Do NOT use hedging phrases like \\"if you prefer\\" or \\"if you like\\" — you already know their taste profile from the data above, so speak to them directly and confidently. If the match score is high, this should read as a helpful tip for someone who will enjoy the wine, never as a warning that it might not suit them (max 24 words)",' + '"origin":"one sentence painting the place this comes from — landscape, climate or culture (max 26 words)",' + '"region_style":"one sentence on what makes wines from here distinctive (max 24 words)",' + '"estate":"one sentence on the producer/winemaker and the estate\'s history or reputation — if producer is unknown, describe the typical winemaking approach in this region instead (max 26 words)",' + '"talk":["three SHORT quotable phrases (each max 12 words) a drinker could say out loud to sound clued-in about this exact wine"],' + '"fact2":"one specific, memorable aging/classification/production fact that helps this bottle make sense. If REFERENCE AGING FACTS are given below, you MUST use those exact figures verbatim (paraphrase the wording only, never change the numbers) — do not invent different aging periods. If no reference facts are given for this wine\'s classification, give a general production fact that does NOT state specific aging durations you are not certain of (max 22 words)",' + '"matchNote":"one sentence giving an honest confidence verdict on THIS PAIRING, grounded in the WineDNA facts above — if I have a top grape/region for this type, name it explicitly and say whether this bottle aligns with or departs from it; never invent a grape/region I do not have (max 24 words). Never mention flavor, texture, tannin, oak, or acidity — that is covered elsewhere."' + '}';
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      let c = text.replace(/```json|```/g, '').trim();
      const s = c.indexOf('{'),
        e = c.lastIndexOf('}');
      if (s >= 0 && e > s) c = c.slice(s, e + 1);
      const d = JSON.parse(c);
      localStorage.setItem(key, JSON.stringify(d));
      setGen(d);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [wine && wine.name, wine && wine.vintage, matchPct, dna && dna.topGrape, dna && dna.topRegion]);
  return {
    gen,
    loading
  };
}

/* ── small helpers ── */
const lvl = (v, lo, mid, hi) => v >= 0.68 ? hi : v >= 0.38 ? mid : lo;
/* Wine name + vintage for display — skips appending the vintage again when it's already part of the name string (e.g. "Viña Ardanza Reserva 2020"). */
function _wineTitle(w) {
  if (!w) return '';
  const name = (w.name || '').trim();
  const vy = w.vintage && w.vintage !== 0 && w.vintage !== 'NV' ? String(w.vintage) : null;
  if (!vy || name.endsWith(vy)) return name;
  return `${name} ${vy}`;
}
/* Rating-weighted top grape/region for this wine's type, straight from rating history — used to ground
   personalization on the scan cards so it can never contradict what WineDNA actually shows. */
function _dnaSnapshot(type) {
  const rated = WineHistory.getAll().filter(w => w.rating > 0 && (w.type || 'red').toLowerCase().replace('é', 'e') === type);
  if (!rated.length) return null;
  const gCount = {},
    rCount = {};
  rated.forEach(w => {
    const wt = Math.max(w.rating || 55, 5);
    (w.grapes || []).forEach(g => {
      if (g) gCount[g] = (gCount[g] || 0) + wt;
    });
    if (w.region) rCount[w.region] = (rCount[w.region] || 0) + wt;
  });
  const topGrape = Object.entries(gCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const topRegion = Object.entries(rCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const avgRating = Math.round(rated.reduce((s, w) => s + w.rating, 0) / rated.length);
  return {
    topGrape,
    topRegion,
    count: rated.length,
    avgRating
  };
}
function ScanShimmer({
  col
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 6,
      border: `2px solid ${col}33`,
      borderTopColor: col,
      animation: 'scSpin .8s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: col,
      fontFamily: C.P,
      fontStyle: 'italic',
      opacity: .8
    }
  }, "Pouring the details\u2026"));
}

/* ── the screen ── */
function useDeckStyle() {
  const [s, setS] = React.useState(() => localStorage.getItem('vinterest_scancard_style') || 'deck');
  React.useEffect(() => {
    const h = () => setS(localStorage.getItem('vinterest_scancard_style') || 'deck');
    window.addEventListener('vinterest:scancardstyle', h);
    return () => window.removeEventListener('vinterest:scancardstyle', h);
  }, []);
  return s;
}
function ScanCardsScreen({
  nav,
  back
}) {
  const scanData = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const wine = scanData.wine || null;
  const existingRating = React.useMemo(() => {
    if (!wine) return 0;
    const saved = WineHistory.getAll().find(w => w.name === wine.name && String(w.vintage) === String(wine.vintage));
    return saved && saved.rating || scanData.existingRating || 0;
  }, [wine?.name, wine?.vintage]);
  const isDemo = scanData.demo === true;
  const scanReason = scanData.reason || '';
  const deckStyle = useDeckStyle();
  const curr = React.useMemo(() => Regional.current(), []);

  // intent gate — remembered per scan so returning doesn't re-ask
  const intentKey = 'vinterest_scan_intent_' + (wine && wine.name || '').replace(/\s/g, '_') + '_' + (wine && wine.vintage || 'nv');
  const [intent, setIntent] = React.useState(() => {
    if (existingRating > 0) return 'tasted';
    return sessionStorage.getItem(intentKey) || null;
  });
  function pickIntent(v) {
    setIntent(v);
    try {
      sessionStorage.setItem(intentKey, v);
    } catch (e) {}
    if (wine) WineHistory.setScanIntent(wine.name, wine.vintage, v);
  }
  const canRate = intent === 'tasting' || intent === 'tasted';

  // duplicate scan gate — a wine you've already rated (exact vintage match) can skip straight to re-rating
  // instead of walking the full card sequence again; remembered per scan so returning doesn't re-ask.
  const dupKey = 'vinterest_scan_dup_' + (wine && wine.name || '').replace(/\s/g, '_') + '_' + (wine && wine.vintage || 'nv');
  const [duplicateChoice, setDuplicateChoice] = React.useState(() => existingRating > 0 ? sessionStorage.getItem(dupKey) || null : 'na');
  function pickDuplicate(v) {
    setDuplicateChoice(v);
    try {
      sessionStorage.setItem(dupKey, v);
    } catch (e) {}
  }
  const matchPct = React.useMemo(() => {
    if (!wine) return null;
    const dna = calcMatchScore(wine, WineHistory.getAll());
    if (dna != null) return dna;
    const conf = scanData.confidence;
    return conf ? Math.round(Math.min(0.98, conf) * 100) : null;
  }, [wine && wine.name, intent]);
  const dnaSnapshot = React.useMemo(() => wine ? _dnaSnapshot((wine.type || 'red').toLowerCase().replace('é', 'e')) : null, [wine && wine.name]);
  const {
    gen,
    loading
  } = useScanContent(wine, matchPct, dnaSnapshot);

  // track scan immediately (even before rating)
  React.useEffect(() => {
    if (wine && !isDemo) WineHistory.track(wine);
  }, [wine && wine.name, wine && wine.vintage]);
  if (!wine) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        padding: 32
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "camera",
      sz: 40,
      col: C.mid
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 600,
        color: C.ink,
        fontFamily: C.P,
        textAlign: 'center'
      }
    }, isDemo && scanReason === 'no_wine_label' ? 'No label detected' : 'Nothing scanned yet'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.mid,
        fontFamily: C.P,
        textAlign: 'center',
        lineHeight: 1.5
      }
    }, "Point the camera straight at a wine label and hold steady."), /*#__PURE__*/React.createElement(Btn, {
      primary: true,
      onClick: () => nav('camera')
    }, "Try Again"));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement(ScanHeader, {
    wine: wine,
    nav: nav,
    back: back
  }), isDemo && /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#FFF3CD',
      borderBottom: '1px solid #FFE082',
      padding: '8px 16px',
      fontSize: 13,
      color: '#7A5200',
      fontFamily: C.P,
      flexShrink: 0
    }
  }, "Demo data \u2014 add ANTHROPIC_API_KEY to scan for real."), !intent ? /*#__PURE__*/React.createElement(IntentGate, {
    wine: wine,
    onPick: pickIntent,
    nav: nav
  }) : existingRating > 0 && !duplicateChoice ? /*#__PURE__*/React.createElement(DuplicateGate, {
    wine: wine,
    existingRating: existingRating,
    onPick: pickDuplicate,
    nav: nav
  }) : /*#__PURE__*/React.createElement(CardDeck, {
    key: deckStyle,
    deckStyle: deckStyle,
    wine: wine,
    gen: gen,
    loading: loading,
    matchPct: matchPct,
    curr: curr,
    scanData: scanData,
    intent: intent,
    canRate: canRate,
    existingRating: existingRating,
    dna: dnaSnapshot,
    startAtEnd: duplicateChoice === 'skip',
    nav: nav
  }), /*#__PURE__*/React.createElement("style", null, `
      @keyframes scSpin{to{transform:rotate(360deg)}}
      @keyframes scSheet{from{transform:translateY(100%)}to{transform:translateY(0)}}
      @keyframes scFade{from{opacity:0}to{opacity:1}}
      @keyframes scPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
      .sc-scroll::-webkit-scrollbar{display:none}
    `));
}
function ScanHeader({
  wine,
  nav,
  back
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px 10px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: C.white,
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.15,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, wine.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: C.mid,
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, [wine.vintage && wine.vintage !== 0 ? wine.vintage : 'NV', wine.region, wine.country].filter(Boolean).join(' · '))), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('detail'),
    style: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '7px 12px',
      borderRadius: 20,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      cursor: 'pointer',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P
    }
  }, "Details"), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 12,
    col: C.mid
  })));
}

/* ── intent gate ── */
function IntentGate({
  wine,
  onPick,
  nav
}) {
  const opts = [{
    k: 'checking',
    icon: 'compass',
    t: 'Just checking the match',
    s: 'Deciding whether to buy or order it — no rating yet.'
  }, {
    k: 'tasting',
    icon: 'wine',
    t: 'About to drink it',
    s: 'Walk me through it, then let me rate after tasting.'
  }, {
    k: 'tasted',
    icon: 'star',
    t: 'Already had a sip',
    s: 'I want to talk about it — and rate what I tasted.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '22px 20px 28px',
      display: 'flex',
      flexDirection: 'column',
      animation: 'scFade .25s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.cr,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, "Matched"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 23,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2,
      marginTop: 4
    }
  }, "How are you meeting", /*#__PURE__*/React.createElement("br", null), "this wine?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginTop: 8
    }
  }, "So we only ask you to rate a wine you've actually tasted."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 22
    }
  }, opts.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.k,
    onClick: () => onPick(o.k),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 16px',
      borderRadius: 16,
      background: C.white,
      border: `1.5px solid ${C.line}`,
      cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      transition: 'transform .12s'
    },
    onMouseDown: e => e.currentTarget.style.transform = 'scale(0.985)',
    onMouseUp: e => e.currentTarget.style.transform = 'none',
    onMouseLeave: e => e.currentTarget.style.transform = 'none'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 14,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: o.icon,
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, o.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.45,
      marginTop: 3
    }
  }, o.s)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 16,
    col: C.mid
  })))), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('detail'),
    style: {
      textAlign: 'center',
      marginTop: 22,
      fontSize: 14,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Skip to full details"));
}

/* ── duplicate-scan gate: you've rated this exact bottle before ── */
function DuplicateGate({
  wine,
  existingRating,
  onPick,
  nav
}) {
  const r = 44,
    circ = 2 * Math.PI * r;
  return /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '22px 20px 28px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      animation: 'scFade .25s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 120,
      height: 120,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "120",
    height: "120",
    viewBox: "0 0 104 104",
    style: {
      transform: 'rotate(-90deg)'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "52",
    cy: "52",
    r: r,
    fill: "none",
    stroke: C.line,
    strokeWidth: "9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "52",
    cy: "52",
    r: r,
    fill: "none",
    stroke: C.green,
    strokeWidth: "9",
    strokeLinecap: "round",
    strokeDasharray: circ,
    strokeDashoffset: circ * (1 - existingRating / 100)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 800,
      color: C.green,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, existingRating), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: C.mid,
      fontFamily: C.P,
      letterSpacing: '0.1em',
      textTransform: 'uppercase'
    }
  }, "pts"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 23,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2,
      marginTop: 16
    }
  }, "You've already scanned", /*#__PURE__*/React.createElement("br", null), "this one"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginTop: 8
    }
  }, "You rated ", _wineTitle(wine), " a ", existingRating, " last time. Want the quick path, or the full rundown again?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      marginTop: 22,
      width: '100%'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => onPick('skip'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 16px',
      borderRadius: 16,
      background: C.white,
      border: `1.5px solid ${C.line}`,
      cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 14,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "star",
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, "Just re-rate it"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.45,
      marginTop: 3
    }
  }, "Skip straight to rating \u2014 no need to see the cards again.")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 16,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    onClick: () => onPick('full'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '16px 16px',
      borderRadius: 16,
      background: C.white,
      border: `1.5px solid ${C.line}`,
      cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 14,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "compass",
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, "Go through it again"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.45,
      marginTop: 3
    }
  }, "See the match, tasting notes and everything else fresh.")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 16,
    col: C.mid
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('detail'),
    style: {
      textAlign: 'center',
      marginTop: 22,
      fontSize: 14,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Skip to full details"));
}

/* ── card content model ── */
function buildCards({
  wine,
  gen,
  matchPct,
  curr,
  scanData,
  intent
}) {
  const type = (wine.type || 'red').toLowerCase().replace('é', 'e');
  const isRed = type === 'red';
  const cards = [];
  cards.push({
    key: 'match',
    accent: C.green,
    soft: C.greenBg,
    icon: 'compass',
    eyebrow: 'Your match',
    kind: 'match'
  });
  cards.push({
    key: 'fit',
    accent: C.green,
    soft: C.greenBg,
    icon: 'heart',
    eyebrow: matchPct != null && matchPct >= 70 ? 'Why you\'ll love it' : 'Why it could click',
    kind: 'gen',
    field: 'fit'
  });
  cards.push({
    key: 'caution',
    accent: C.amber,
    soft: C.amberBg,
    icon: 'message',
    eyebrow: 'Heads up',
    kind: 'gen',
    field: 'caution'
  });
  cards.push({
    key: 'origin',
    accent: C.cr,
    soft: C.crSoft,
    icon: 'globe',
    eyebrow: 'Where it\'s from',
    kind: 'origin'
  });
  cards.push({
    key: 'fact',
    accent: '#9B6B00',
    soft: '#FBF3E0',
    icon: 'star',
    eyebrow: 'Did you know',
    kind: 'gen',
    field: 'fact'
  });
  cards.push({
    key: 'taste',
    accent: C.ink,
    soft: C.offWhite,
    icon: 'wine',
    eyebrow: 'While you taste',
    kind: 'taste'
  });
  cards.push({
    key: 'talk',
    accent: C.cr,
    soft: C.crSoft,
    icon: 'message',
    eyebrow: 'Sound clued-in',
    kind: 'talk'
  });
  cards.push({
    key: 'value',
    accent: '#6B2D8B',
    soft: '#F3ECF8',
    icon: 'cart',
    eyebrow: 'Price check',
    kind: 'value'
  });
  cards.push({
    key: 'finish',
    accent: C.cr,
    soft: C.crSoft,
    icon: intent === 'checking' ? 'heart' : 'star',
    eyebrow: intent === 'checking' ? 'Save it' : 'Rate it',
    kind: 'finish'
  });
  return cards;
}

/* renders the body of one card — always at full detail; there is no separate expand/collapse mode, everything ships on the main screen. */
function CardFace({
  card,
  ctx
}) {
  const expanded = true;
  const {
    wine,
    gen,
    loading,
    matchPct,
    curr,
    scanData,
    intent,
    dna
  } = ctx;
  const a = card.accent;
  const P = C.P;
  const H = ({
    children
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: expanded ? 24 : 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: P,
      lineHeight: 1.2,
      letterSpacing: '-0.01em'
    }
  }, children);
  const Body = ({
    children,
    big
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: big ? expanded ? 20 : 18 : expanded ? 17 : 16,
      color: C.ink2,
      fontFamily: P,
      lineHeight: 1.55
    }
  }, children);
  if (card.kind === 'match') {
    const pct = matchPct;
    const verdict = pct == null ? 'New for your palate' : pct >= 90 ? 'A near-perfect match' : pct >= 78 ? 'A strong match' : pct >= 63 ? 'A solid match, worth it' : pct >= 48 ? 'Worth a try' : pct >= 32 ? 'A bit of a stretch' : 'Outside your usual';
    const r = 52,
      circ = 2 * Math.PI * r,
      off = circ * (1 - (pct || 0) / 100);
    const dnaFallback = dna && dna.topGrape ? `Your ${wine.type || 'red'}s lean ${dna.topGrape}${dna.topRegion ? ' from ' + dna.topRegion : ''} — ${(wine.grapes || []).some(g => (g || '').toLowerCase() === dna.topGrape.toLowerCase()) ? 'this bottle lines up with that.' : 'this one branches out a bit from that.'}` : 'Scan and rate a few more to sharpen this.';
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        width: 150,
        height: 150
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "150",
      height: "150",
      viewBox: "0 0 130 130",
      style: {
        transform: 'rotate(-90deg)'
      }
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "65",
      cy: "65",
      r: r,
      fill: "none",
      stroke: C.line,
      strokeWidth: "10"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "65",
      cy: "65",
      r: r,
      fill: "none",
      stroke: a,
      strokeWidth: "10",
      strokeLinecap: "round",
      strokeDasharray: circ,
      strokeDashoffset: pct == null ? circ : off,
      style: {
        transition: 'stroke-dashoffset 1s cubic-bezier(.34,1.1,.64,1)'
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 40,
        fontWeight: 800,
        color: a,
        fontFamily: P,
        lineHeight: 1
      }
    }, pct != null ? pct : '—', /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        fontWeight: 700
      }
    }, "%")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 11,
        fontWeight: 700,
        color: C.mid,
        fontFamily: P,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginTop: 2
      }
    }, "match"))), /*#__PURE__*/React.createElement(H, null, verdict), /*#__PURE__*/React.createElement(Body, {
      big: true
    }, loading && !gen ? /*#__PURE__*/React.createElement(ScanShimmer, {
      col: a
    }) : gen && gen.matchNote || dnaFallback), expanded && /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        marginTop: 4,
        padding: '12px 14px',
        borderRadius: 12,
        background: C.offWhite,
        border: `1px solid ${C.line}`,
        textAlign: 'left'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: C.mid,
        fontFamily: P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 6
      }
    }, "How we got this"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        color: C.ink2,
        fontFamily: P,
        lineHeight: 1.55
      }
    }, "We compare this wine's body, tannins, acidity and sweetness against the average of the ", wine.type || 'red', "s you've rated highly", dna && dna.topGrape ? ` — right now that's mostly ${dna.topGrape}${dna.topRegion ? ' from ' + dna.topRegion : ''}` : '', ".")));
  }
  if (card.kind === 'gen') {
    const val = gen && gen[card.field];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(H, null, card.field === 'fact' ? 'A little story' : card.field === 'fit' ? 'This is your kind of bottle' : 'One thing to know'), /*#__PURE__*/React.createElement(Body, {
      big: true
    }, loading && !val ? /*#__PURE__*/React.createElement(ScanShimmer, {
      col: a
    }) : val || '—'), expanded && card.field === 'fit' && /*#__PURE__*/React.createElement(AttrReasons, {
      wine: wine,
      accent: a
    }), expanded && card.field === 'caution' && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        color: C.mid,
        fontFamily: C.P,
        lineHeight: 1.55
      }
    }, matchPct != null && matchPct >= 63 ? 'Just a tip to get the most out of it — not a reason to hesitate.' : 'Worth knowing so nothing catches you off guard.'));
  }
  if (card.kind === 'origin') {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(H, null, wine.region || wine.country), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 7
      }
    }, [wine.sub_region, wine.region, wine.country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).map((t, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        padding: '5px 12px',
        borderRadius: 20,
        background: card.soft,
        color: a,
        fontSize: 14,
        fontWeight: 600,
        fontFamily: C.P,
        border: `1px solid ${a}22`
      }
    }, t))), /*#__PURE__*/React.createElement(Body, {
      big: true
    }, loading && !(gen && gen.origin) ? /*#__PURE__*/React.createElement(ScanShimmer, {
      col: a
    }) : gen && gen.origin || `${wine.region ? wine.region + ', ' : ''}${wine.country} — a classic home for ${wine.grapes && wine.grapes[0] || 'this style'}.`), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 14px',
        borderRadius: 12,
        background: card.soft,
        border: `1px solid ${a}22`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: a,
        fontFamily: C.P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 3
      }
    }, "The regional signature"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15.5,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.45
      }
    }, gen && gen.region_style || `Wines from ${wine.region || wine.country} are prized for their sense of place.`)), /*#__PURE__*/React.createElement("div", {
      style: {
        borderTop: `1px solid ${a}22`,
        paddingTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: a,
        fontFamily: C.P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 3
      }
    }, wine.producer || 'The winemaker'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15.5,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.45
      }
    }, loading && !(gen && gen.estate) ? /*#__PURE__*/React.createElement(ScanShimmer, {
      col: a
    }) : gen && gen.estate || `A producer working in the traditional style of ${wine.region || wine.country}.`))));
  }
  if (card.kind === 'taste') {
    const cues = [];
    const type = (wine.type || 'red').toLowerCase().replace('é', 'e');
    const showTannins = ['red', 'orange', 'fortified'].includes(type);
    const isDessertOrFortified = ['dessert', 'fortified'].includes(type);
    const b = wine.body ?? 0.65,
      tn = wine.tannins ?? 0.55,
      ac = wine.acidity ?? 0.6,
      tx = wine.texture,
      sw = wine.sweetness ?? 0.1;
    cues.push({
      l: 'Body',
      v: lvl(b, 'Light & lithe', 'Medium-weight', 'Full & mouth-coating'),
      tip: 'Notice how heavy it feels — does it linger or refresh?'
    });
    if (showTannins) cues.push({
      l: 'Tannins',
      v: lvl(tn, 'Silky, low grip', 'Gentle grip', 'Firm, drying grip'),
      tip: 'That drying feel on your gums and cheeks — is it soft or grippy?'
    });
    cues.push({
      l: 'Acidity',
      v: lvl(ac, 'Round & mellow', 'Fresh', 'Zippy & mouth-watering'),
      tip: 'Does it make you salivate? That\'s acidity.'
    });
    if (tx != null) cues.push({
      l: 'Oak / texture',
      v: lvl(tx, 'Clean & steely', 'Subtle', 'Creamy, vanilla, toast'),
      tip: 'Any butter, vanilla or toast? That\'s oak.'
    });
    if (sw >= 0.2 || isDessertOrFortified) cues.push({
      l: 'Sweetness',
      v: lvl(sw, 'Dry', 'Off-dry', 'Noticeably sweet'),
      tip: 'Sense of sugar on the tip of your tongue.'
    });
    if (isDessertOrFortified) cues.push({
      l: 'Serving size',
      v: 'A smaller 2–3oz pour',
      tip: 'These are richer and higher in alcohol — a small glass goes further.'
    });
    const notes = (wine.tasting_notes || []).slice(0, 4);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(H, null, "What to look for"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }
    }, cues.slice(0, isDessertOrFortified ? 5 : 4).map((c, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'baseline'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: a,
        fontFamily: C.P,
        minWidth: 92,
        flexShrink: 0
      }
    }, c.l), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        color: C.ink,
        fontFamily: C.P,
        fontWeight: 600
      }
    }, c.v))))), notes.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: C.mid,
        fontFamily: C.P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 7,
        marginTop: 2
      }
    }, "Hunt for these flavours"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }
    }, notes.map((n, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: {
        padding: '5px 11px',
        borderRadius: 20,
        background: C.offWhite,
        color: C.ink2,
        fontSize: 15,
        fontWeight: 500,
        fontFamily: C.P,
        border: `1px solid ${C.line}`
      }
    }, n)))));
  }
  if (card.kind === 'talk') {
    const lines = gen && Array.isArray(gen.talk) && gen.talk.length ? gen.talk : [`A ${wine.type || 'red'} that really speaks of ${wine.region || wine.country}.`, wine.grapes && wine.grapes[0] ? `Lovely example of ${wine.grapes[0]}.` : 'Nicely made, plenty of character.', 'Great with the right plate of food.'];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(H, null, "Say it out loud"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, lines.slice(0, 3).map((l, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 10,
        padding: '11px 13px',
        borderRadius: 13,
        background: card.soft,
        border: `1px solid ${a}22`
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22,
        color: a,
        fontFamily: 'Georgia,serif',
        lineHeight: 1,
        marginTop: -2
      }
    }, "\u201C"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15.5,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.5,
        fontWeight: 500
      }
    }, loading && !(gen && gen.talk) ? '…' : l)))), gen && gen.fact2 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '12px 14px',
        borderRadius: 12,
        background: C.offWhite,
        border: `1px solid ${C.line}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: a,
        fontFamily: C.P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginBottom: 5
      }
    }, "Drop this fact"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.55
      }
    }, gen.fact2)));
  }
  if (card.kind === 'value') return /*#__PURE__*/React.createElement(ValueFace, {
    wine: wine,
    curr: curr,
    scanData: scanData,
    accent: a,
    soft: card.soft,
    expanded: expanded
  });
  if (card.kind === 'finish') return null; // rendered specially by deck (needs actions)
  return null;
}
function AttrReasons({
  wine,
  accent
}) {
  const users = WineHistory.getAll().filter(w => w.rating > 0);
  const type = (wine.type || 'red').toLowerCase().replace('é', 'e');
  const same = users.filter(w => (w.type || 'red').toLowerCase().replace('é', 'e') === type);
  const top = [...same].sort((x, y) => (y.rating || 0) - (x.rating || 0)).slice(0, 3).map(w => w.name).filter(Boolean);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderRadius: 12,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: accent,
      fontFamily: C.P,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: 6
    }
  }, "Because you rated"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, top.length ? top.join(', ') + '.' : 'Keep rating wines and this gets personal.'));
}
function ValueFace({
  wine,
  curr,
  scanData,
  accent,
  soft,
  expanded
}) {
  const [pd, setPd] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    if (!wine || !wine.name) return;
    setLoading(true);
    fetchRetailEstimate(wine, curr).then(d => setPd(d)).catch(() => {}).finally(() => setLoading(false));
  }, [wine && wine.name, curr.code]);
  const fmt = n => n != null ? curr.base + Number(n).toLocaleString() : '—';
  const restaurant = scanData.listPrice || scanData.restaurantPrice || null; // present when opened from a wine list
  const mid = pd && pd.mid;
  const estListLo = mid != null ? Math.round(mid * 2.2) : null;
  const estListHi = mid != null ? Math.round(mid * 2.8) : null;
  const ratio = restaurant && mid ? restaurant / mid : null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, restaurant ? 'Retail vs. restaurant' : 'What it\'s worth'), loading && !pd ? /*#__PURE__*/React.createElement(ScanShimmer, {
    col: accent
  }) : pd && mid != null ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '13px 14px',
      borderRadius: 14,
      background: soft,
      border: `1px solid ${accent}22`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: accent,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, "Typical retail"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: accent,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, fmt(mid)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: accent + '99',
      fontFamily: C.P,
      marginTop: 3
    }
  }, curr.code, " \xB7 shop shelf")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '13px 14px',
      borderRadius: 14,
      background: C.white,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, restaurant ? 'On this list' : 'On a wine list'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, restaurant ? fmt(restaurant) : `${fmt(estListLo)}–${fmt(estListHi)}`), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 3
    }
  }, restaurant ? `${curr.code} · restaurant` : 'typical markup'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '11px 14px',
      borderRadius: 12,
      background: C.ink,
      color: '#fff'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, ratio ? ratio.toFixed(1) + '×' : '~2.5×'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      fontFamily: C.P,
      lineHeight: 1.4,
      opacity: .92
    }
  }, ratio ? ratio >= 3 ? 'A steep markup versus the shelf price.' : ratio >= 2 ? 'A fair, typical restaurant markup.' : 'A gentle markup — good value on a list.' : 'Restaurants usually charge two to three times retail.')), pd.tier && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Price tier"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: accent,
      fontFamily: C.P,
      textTransform: 'capitalize'
    }
  }, String(pd.tier).replace('-', ' '))), expanded && pd.note && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55,
      padding: '11px 13px',
      borderRadius: 12,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, pd.note)) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Price estimate unavailable for this bottle."));
}

/* ── finish / rating card ── */
function FinishFace({
  wine,
  intent,
  existingRating,
  nav,
  accent
}) {
  const canRate = intent === 'tasting' || intent === 'tasted';
  const alreadyRated = existingRating > 0;
  const [confirmStep, setConfirmStep] = React.useState(alreadyRated);
  const [score, setScore] = React.useState(existingRating || 0);
  const [saved, setSaved] = React.useState(existingRating > 0);
  const label = score === 0 ? '' : score <= 20 ? 'Not for me' : score <= 40 ? "It's ok" : score <= 60 ? 'Good' : score <= 80 ? 'Really good' : 'Exceptional';
  function commit() {
    if (!score || !wine) return;
    if (existingRating > 0) WineHistory.rate(wine.name, wine.vintage, score);else WineHistory.add(wine, score);
    try {
      if (window.XPSystem) XPSystem.awardAndToast([{
        type: 'rate'
      }]);
    } catch (e) {}
    // carry the new rating into the session snapshot so Detail/list screens agree immediately
    try {
      const sd = JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}');
      sd.existingRating = score;
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify(sd));
    } catch (e) {}
    setSaved(true);
  }
  if (!canRate) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'center',
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 56,
        height: 56,
        borderRadius: 28,
        background: C.crSoft,
        border: `1px solid ${C.crDim}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "check",
      sz: 26,
      col: C.cr
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 21,
        fontWeight: 800,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.2
      }
    }, "Saved to My Wines"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15.5,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.55
      }
    }, "When you pour it, come back and rate it in a tap \u2014 that's what sharpens your matches."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      primary: true,
      full: true,
      onClick: () => nav('detail')
    }, "See full details \u2192"), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => nav('mywines')
    }, "Go to My Wines")));
  }
  if (confirmStep) {
    const r = 52,
      circ = 2 * Math.PI * r;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'relative',
        width: 150,
        height: 150
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "150",
      height: "150",
      viewBox: "0 0 130 130",
      style: {
        transform: 'rotate(-90deg)'
      }
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "65",
      cy: "65",
      r: r,
      fill: "none",
      stroke: C.line,
      strokeWidth: "10"
    }), /*#__PURE__*/React.createElement("circle", {
      cx: "65",
      cy: "65",
      r: r,
      fill: "none",
      stroke: C.green,
      strokeWidth: "10",
      strokeLinecap: "round",
      strokeDasharray: circ,
      strokeDashoffset: circ * (1 - existingRating / 100)
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 40,
        fontWeight: 800,
        color: C.green,
        fontFamily: C.P,
        lineHeight: 1
      }
    }, existingRating, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700
      }
    }, " pts")), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 9.5,
        fontWeight: 700,
        color: C.mid,
        fontFamily: C.P,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        marginTop: 2,
        textAlign: 'center',
        padding: '0 8px',
        lineHeight: 1.2
      }
    }, "Previous", /*#__PURE__*/React.createElement("br", null), "rating"))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 19,
        fontWeight: 800,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.25
      }
    }, "You already rated this one"), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15.5,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.55
      }
    }, "Leave your score for ", _wineTitle(wine), " as is, or rate it again."), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      primary: true,
      full: true,
      onClick: () => nav('detail')
    }, "Leave it at ", existingRating, " \u2014 see full details \u2192"), /*#__PURE__*/React.createElement(Btn, {
      full: true,
      onClick: () => setConfirmStep(false)
    }, "Re-rate it")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.2,
      textAlign: 'center'
    }
  }, "How was it?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, [20, 40, 60, 80, 100].map(p => /*#__PURE__*/React.createElement("div", {
    key: p,
    onClick: () => {
      setScore(p);
      setSaved(false);
    },
    style: {
      flex: 1,
      padding: '9px 2px',
      borderRadius: 11,
      border: `1.5px solid ${score === p ? C.cr : C.line}`,
      background: score === p ? C.cr : C.white,
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all .12s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: score === p ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, p)))), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "1",
    value: score,
    onChange: e => {
      setScore(Number(e.target.value));
      setSaved(false);
    },
    style: {
      width: '100%',
      accentColor: C.cr,
      cursor: 'pointer'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      minHeight: 40
    }
  }, score > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 34,
      fontWeight: 800,
      color: C.cr,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, score), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      fontFamily: C.P
    }
  }, "pts")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P
    }
  }, label)) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Slide or tap a score")), score > 0 && !saved && /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: commit
  }, "Save rating"), saved && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 15,
      fontWeight: 600,
      color: C.green,
      fontFamily: C.P
    }
  }, "\u2713 Saved to My Wines"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => nav('detail')
  }, "See full details \u2192")), !saved && score === 0 && /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('detail'),
    style: {
      textAlign: 'center',
      fontSize: 14,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Skip rating \u2014 see full details \u2192"));
}

/* ── the deck (three interaction styles) ── */
function CardDeck({
  deckStyle,
  wine,
  gen,
  loading,
  matchPct,
  curr,
  scanData,
  intent,
  canRate,
  existingRating,
  dna,
  startAtEnd,
  nav
}) {
  const cards = React.useMemo(() => buildCards({
    wine,
    gen,
    matchPct,
    curr,
    scanData,
    intent
  }), [wine && wine.name, gen, matchPct, intent]);
  const ctx = {
    wine,
    gen,
    loading,
    matchPct,
    curr,
    scanData,
    intent,
    dna
  };
  const [idx, setIdx] = React.useState(() => startAtEnd ? Math.max(0, cards.length - 1) : 0);
  const total = cards.length;
  const go = d => setIdx(i => Math.max(0, Math.min(total - 1, i + d)));
  const common = {
    cards,
    ctx,
    intent,
    existingRating,
    nav,
    accent: C.cr
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      padding: '12px 20px 6px',
      justifyContent: 'center',
      flexWrap: 'wrap',
      flexShrink: 0
    }
  }, cards.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: c.key,
    onClick: () => deckStyle === 'deck' && setIdx(i),
    style: {
      height: 4,
      borderRadius: 2,
      flex: deckStyle === 'deck' ? '0 0 auto' : 1,
      width: deckStyle === 'deck' ? i === idx ? 22 : 14 : 'auto',
      maxWidth: deckStyle === 'deck' ? undefined : 34,
      background: i <= idx ? c.accent : C.line,
      transition: 'all .25s',
      cursor: deckStyle === 'deck' ? 'pointer' : 'default'
    }
  }))), deckStyle === 'deck' && /*#__PURE__*/React.createElement(SwipeDeck, _extends({
    idx: idx,
    setIdx: setIdx,
    go: go
  }, common, {
    deck: cards
  })), deckStyle === 'carousel' && /*#__PURE__*/React.createElement(Carousel, common), deckStyle === 'feed' && /*#__PURE__*/React.createElement(Feed, common));
}

/* shared card chrome */
function CardShell({
  card,
  children,
  intent,
  existingRating,
  nav,
  style
}) {
  const isFinish = card.kind === 'finish';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      borderRadius: 22,
      border: `1px solid ${C.line}`,
      boxShadow: '0 6px 22px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      background: card.accent,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px 6px',
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 9,
      background: card.soft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: card.icon,
    sz: 16,
    col: card.accent
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: card.accent,
      fontFamily: C.P,
      letterSpacing: '0.09em',
      textTransform: 'uppercase'
    }
  }, card.eyebrow)), /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      padding: '8px 18px 18px',
      overflowY: 'hidden',
      flex: 1,
      minHeight: 0
    }
  }, isFinish ? /*#__PURE__*/React.createElement(FinishFace, {
    wine: card._wine,
    intent: intent,
    existingRating: existingRating,
    nav: nav,
    accent: card.accent
  }) : children));
}

/* deck style A — swipeable stack */
function SwipeDeck({
  deck,
  ctx,
  idx,
  setIdx,
  go,
  intent,
  existingRating,
  nav
}) {
  const [drag, setDrag] = React.useState({
    dx: 0,
    dy: 0,
    active: false
  });
  const start = React.useRef(null);
  const dragRef = React.useRef({
    dx: 0,
    dy: 0
  });
  const topRef = React.useRef(null);
  const cardRef = React.useRef(null);
  const top = deck[idx];
  const isFinish = top && top.kind === 'finish';
  topRef.current = top;
  const ptrId = React.useRef(null);
  function onPointerDown(e) {
    if (isFinish) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrId.current = e.pointerId;
    start.current = {
      x: e.clientX,
      y: e.clientY
    };
    dragRef.current = {
      dx: 0,
      dy: 0
    };
    setDrag({
      dx: 0,
      dy: 0,
      active: true
    });
  }
  function onPointerMove(e) {
    if (!start.current || e.pointerId !== ptrId.current) return;
    const dx = e.clientX - start.current.x,
      dy = e.clientY - start.current.y;
    dragRef.current = {
      dx,
      dy
    };
    setDrag({
      dx,
      dy,
      active: true
    });
  }
  function onPointerUp(e) {
    if (!start.current || e.pointerId !== ptrId.current) return;
    const {
      dx
    } = dragRef.current;
    start.current = null;
    ptrId.current = null;
    if (dx < -110) {
      setDrag({
        dx: 0,
        dy: 0,
        active: false
      });
      setTimeout(() => go(1), 10);
      return;
    }
    if (dx > 110) {
      setDrag({
        dx: 0,
        dy: 0,
        active: false
      });
      setTimeout(() => go(-1), 10);
      return;
    }
    setDrag({
      dx: 0,
      dy: 0,
      active: false
    });
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '8px 16px 14px',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      flex: 1,
      minHeight: 0
    }
  }, deck.map((c, i) => {
    if (i < idx || i > idx + 2) return null;
    const depth = i - idx;
    const isTop = depth === 0;
    const tf = isTop ? `translate(${drag.dx}px,${drag.dy < 0 ? drag.dy : drag.dy * 0.4}px) rotate(${drag.dx * 0.04}deg)` : `translateY(${depth * 12}px) scale(${1 - depth * 0.045})`;
    const cc = {
      ...c,
      _wine: ctx.wine
    };
    return /*#__PURE__*/React.createElement("div", {
      key: c.key,
      onPointerDown: isTop ? onPointerDown : undefined,
      onPointerMove: isTop ? onPointerMove : undefined,
      onPointerUp: isTop ? onPointerUp : undefined,
      onPointerCancel: isTop ? onPointerUp : undefined,
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 10 - depth,
        transform: tf,
        transition: drag.active && isTop ? 'none' : 'transform .3s cubic-bezier(.34,1.1,.64,1)',
        opacity: depth > 1 ? 0 : 1,
        touchAction: isTop && !isFinish ? 'none' : 'auto',
        cursor: isTop && !isFinish ? 'grab' : 'default',
        userSelect: isTop && !isFinish ? 'none' : 'auto',
        WebkitUserSelect: isTop && !isFinish ? 'none' : 'auto',
        WebkitTouchCallout: isTop && !isFinish ? 'none' : 'default'
      }
    }, /*#__PURE__*/React.createElement(CardShell, {
      card: cc,
      intent: intent,
      existingRating: existingRating,
      nav: nav,
      style: {
        height: '100%'
      }
    }, /*#__PURE__*/React.createElement(CardFace, {
      card: c,
      ctx: ctx
    })), isTop && Math.abs(drag.dx) > 40 && !isFinish && /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        top: 24,
        [drag.dx < 0 ? 'right' : 'left']: 24,
        padding: '6px 14px',
        borderRadius: 10,
        border: `2.5px solid ${C.mid}`,
        color: C.mid,
        fontSize: 15,
        fontWeight: 800,
        fontFamily: C.P,
        transform: `rotate(${drag.dx < 0 ? 12 : -12}deg)`,
        background: 'rgba(255,255,255,0.9)',
        letterSpacing: '0.05em'
      }
    }, drag.dx < 0 ? 'NEXT' : 'BACK'));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => go(-1),
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      background: C.white,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      opacity: idx === 0 ? 0.35 : 1,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 17,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      color: C.mid,
      fontFamily: C.P,
      minWidth: 44,
      textAlign: 'center'
    }
  }, idx + 1, " / ", deck.length), /*#__PURE__*/React.createElement("div", {
    onClick: () => go(1),
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      background: idx >= deck.length - 1 ? C.white : C.cr,
      border: idx >= deck.length - 1 ? `1px solid ${C.line}` : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      opacity: idx >= deck.length - 1 ? 0.35 : 1,
      boxShadow: '0 2px 8px rgba(139,26,47,0.25)',
      transform: 'scaleX(-1)'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 17,
    col: idx >= deck.length - 1 ? C.ink : '#fff'
  }))));
}

/* deck style B — horizontal carousel */
function Carousel({
  cards,
  ctx,
  intent,
  existingRating,
  nav
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      flex: 1,
      display: 'flex',
      overflowX: 'auto',
      scrollSnapType: 'x mandatory',
      gap: 14,
      padding: '8px 16px 18px',
      minHeight: 0
    }
  }, cards.map(c => {
    const cc = {
      ...c,
      _wine: ctx.wine
    };
    return /*#__PURE__*/React.createElement("div", {
      key: c.key,
      style: {
        scrollSnapAlign: 'center',
        flex: '0 0 86%',
        maxWidth: 360,
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(CardShell, {
      card: cc,
      intent: intent,
      existingRating: existingRating,
      nav: nav,
      style: {
        width: '100%',
        minHeight: 0
      }
    }, /*#__PURE__*/React.createElement(CardFace, {
      card: c,
      ctx: ctx
    })));
  }));
}

/* deck style C — vertical feed */
function Feed({
  cards,
  ctx,
  intent,
  existingRating,
  nav
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 16px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      minHeight: 0
    }
  }, cards.map(c => {
    const cc = {
      ...c,
      _wine: ctx.wine
    };
    return /*#__PURE__*/React.createElement("div", {
      key: c.key,
      style: {
        animation: 'scPop .3s ease both'
      }
    }, /*#__PURE__*/React.createElement(CardShell, {
      card: cc,
      intent: intent,
      existingRating: existingRating,
      nav: nav
    }, /*#__PURE__*/React.createElement(CardFace, {
      card: c,
      ctx: ctx
    })));
  }));
}
Object.assign(window, {
  ScanCardsScreen
});

/* ---- pwa-screens-detail.jsx (precompiled) ---- */
/* Vinterest PWA — Wine Detail screen (tabbed: Details / Story / Buy) */

function ScanLocationCard({
  wine
}) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(wine?.scan_location?.name || '');
  const [savedName, setSavedName] = React.useState(wine?.scan_location?.name || '');
  React.useEffect(() => {
    setVal(wine?.scan_location?.name || '');
    setSavedName(wine?.scan_location?.name || '');
  }, [wine?.name, wine?.vintage]);
  if (!wine) return null;
  const dateStr = wine.scanned_at ? new Date(wine.scanned_at).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : null;
  // Copy matches how they met the wine: buying/considering vs. actually drinking it.
  const copy = wine.scan_intent === 'checking' ? {
    label: 'Where You Found It',
    placeholder: "e.g. a wine shop, grocery store, a friend recommended it",
    empty: 'Add where you saw this — shop, store, a recommendation…'
  } : {
    label: 'Where You Had It',
    placeholder: "e.g. a restaurant, a friend's house",
    empty: "Add where this was — restaurant, a friend's house…"
  };
  function commit() {
    WineHistory.setLocation(wine.name, wine.vintage, val);
    setSavedName(val.trim());
    setEditing(false);
  }
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, copy.label), dateStr && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Scanned ", dateStr)), editing ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: val,
    onChange: e => setVal(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') commit();
    },
    placeholder: copy.placeholder,
    style: {
      flex: 1,
      fontSize: 15,
      fontFamily: C.P,
      padding: '8px 10px',
      borderRadius: 9,
      border: `1px solid ${C.line}`,
      color: C.ink
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: commit
  }, "Save")) : /*#__PURE__*/React.createElement("div", {
    onClick: () => setEditing(true),
    style: {
      cursor: 'pointer',
      fontSize: 15.5,
      fontFamily: C.P,
      color: savedName ? C.ink : C.mid,
      fontWeight: savedName ? 600 : 400
    }
  }, savedName || copy.empty));
}
function WineDetailScreen({
  back,
  nav
}) {
  const [tab, setTab] = React.useState(0);
  const tabs = ['Details', 'Story', 'Price'];
  const scanData = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const wine = scanData.wine || null;
  const existingRating = React.useMemo(() => {
    if (!wine) return 0;
    const saved = WineHistory.getAll().find(w => w.name === wine.name && String(w.vintage) === String(wine.vintage));
    return saved && saved.rating || scanData.existingRating || 0;
  }, [wine?.name, wine?.vintage]);
  const matchPct = React.useMemo(() => {
    if (!wine) return null;
    const dna = calcMatchScore(wine, WineHistory.getAll());
    if (dna != null) return dna;
    const conf = scanData.confidence;
    return conf ? Math.round(Math.min(0.98, conf) * 100) : null;
  }, [wine?.name, wine?.vintage]);
  const [isFav, setIsFav] = React.useState(() => {
    try {
      const favs = JSON.parse(localStorage.getItem('vinterest_favorites') || '[]');
      return favs.some(f => f.name === wine?.name && String(f.vintage) === String(wine?.vintage));
    } catch (e) {
      return false;
    }
  });
  function toggleFav() {
    try {
      const favs = JSON.parse(localStorage.getItem('vinterest_favorites') || '[]');
      const idx = favs.findIndex(f => f.name === wine?.name && String(f.vintage) === String(wine?.vintage));
      if (idx >= 0) {
        favs.splice(idx, 1);
        setIsFav(false);
      } else {
        favs.push({
          name: wine?.name,
          vintage: wine?.vintage
        });
        setIsFav(true);
      }
      localStorage.setItem('vinterest_favorites', JSON.stringify(favs));
    } catch (e) {}
  }
  const [shared, setShared] = React.useState(false);
  function shareWine() {
    const title = wine?.name || (wine?.vintage ? wine.name + ' ' + wine.vintage : 'Wine on Vinterest');
    const text = `${wine?.name || ''}${wine?.vintage ? ' ' + wine.vintage : ''} · ${[wine?.region, wine?.country].filter(Boolean).join(', ')}`;
    if (navigator.share) {
      navigator.share({
        title,
        text,
        url: window.location.href
      }).catch(() => {});
    } else {
      try {
        navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch (e) {}
    }
  }
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  function deleteWine() {
    if (!wine) return;
    WineHistory.remove(wine.name, wine.vintage);
    setConfirmDelete(false);
    nav('mywines');
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 0',
      flexShrink: 0,
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: toggleFav,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: isFav ? C.crSoft : C.offWhite,
      border: `1px solid ${isFav ? C.crDim : C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: 18,
    height: 18
  }, /*#__PURE__*/React.createElement("path", {
    d: "M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z",
    stroke: isFav ? C.cr : C.mid,
    strokeWidth: "1.6",
    fill: isFav ? C.cr : 'none'
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: shareWine,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: shared ? C.greenBg : C.offWhite,
      border: `1px solid ${shared ? C.green : C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: shared ? 'check' : 'share',
    sz: 17,
    col: shared ? C.green : C.mid
  })), wine && /*#__PURE__*/React.createElement("div", {
    onClick: () => setConfirmDelete(true),
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "trash",
    sz: 16,
    col: C.mid
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'flex-end',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 74,
      borderRadius: 10,
      background: C.crSoft,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 24,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.15
    }
  }, wine?.name || 'Château Margaux'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 3
    }
  }, wine ? `${wine.vintage || 'NV'} · ${wine.region}, ${wine.country}` : '2018 · Bordeaux, France'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: true,
    sm: true,
    style: {
      textTransform: 'capitalize'
    }
  }, wine?.type || 'Red'), wine?.grapes?.[0] && /*#__PURE__*/React.createElement(Pill, {
    sm: true
  }, wine.grapes[0])))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: `1px solid ${C.line}`
    }
  }, tabs.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setTab(i),
    style: {
      flex: 1,
      textAlign: 'center',
      paddingBottom: 10,
      fontSize: 17,
      fontWeight: i === tab ? 600 : 400,
      color: i === tab ? C.cr : C.mid,
      fontFamily: C.P,
      borderBottom: i === tab ? `2px solid ${C.cr}` : 'none',
      marginBottom: -1,
      cursor: 'pointer'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, tab === 0 && /*#__PURE__*/React.createElement(DetailMerged, {
    wine: wine,
    nav: nav,
    existingRating: existingRating,
    matchPct: matchPct
  }), tab === 1 && /*#__PURE__*/React.createElement(DetailStory, {
    wine: wine,
    nav: nav,
    existingRating: existingRating
  }), tab === 2 && /*#__PURE__*/React.createElement(DetailPrice, {
    wine: wine,
    nav: nav
  })), confirmDelete && /*#__PURE__*/React.createElement("div", {
    onClick: () => setConfirmDelete(false),
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'flex-end',
      zIndex: 80
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      background: C.white,
      borderRadius: '22px 22px 0 0',
      width: '100%',
      padding: '22px 20px 28px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 4,
      borderRadius: 2,
      background: C.line,
      margin: '0 auto 4px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      textAlign: 'center'
    }
  }, "Delete this scan?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      textAlign: 'center',
      lineHeight: 1.5
    }
  }, wine?.name, " will be permanently removed from your wine history, including any rating."), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    style: {
      background: C.cr,
      color: '#fff',
      border: 'none'
    },
    onClick: deleteWine
  }, "Delete"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: () => setConfirmDelete(false)
  }, "Cancel"))));
}
function DetailMerged({
  wine,
  nav,
  existingRating = 0,
  matchPct
}) {
  const [genWhy, setGenWhy] = React.useState(null);
  const [generatingWhy, setGeneratingWhy] = React.useState(false);
  const [userRating, setUserRating] = React.useState(existingRating);
  const [showRatingUI, setShowRatingUI] = React.useState(existingRating === 0);
  const [saved, setSaved] = React.useState(existingRating > 0);
  const [sliderAnimated, setSliderAnimated] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setSliderAnimated(true), 80);
    return () => clearTimeout(t);
  }, []);
  const pendingScore = React.useRef(existingRating);
  const ratedOnce = React.useRef(existingRating > 0);
  const scoreLabel = userRating === 0 ? '' : userRating <= 20 ? 'Not for me' : userRating <= 40 ? "It's ok" : userRating <= 60 ? 'Good' : userRating <= 80 ? 'Really good' : 'Exceptional';
  function commitScore(v) {
    if (!v) v = pendingScore.current;
    const n = Number(v);
    if (n > 0 && wine) {
      if (existingRating > 0) {
        WineHistory.rate(wine.name, wine.vintage, n);
      } else {
        WineHistory.add(wine, n);
      }
      if (!ratedOnce.current) {
        XPSystem.awardAndToast([{
          type: 'rate'
        }]);
        ratedOnce.current = true;
      }
      setUserRating(n);
      setSaved(true);
      setShowRatingUI(false);
    }
  }
  function handleSliderChange(e) {
    const n = Number(e.target.value);
    setUserRating(n);
    pendingScore.current = n;
  }
  // Preset buttons update slider position only — user taps Save to commit
  function handlePreset(p) {
    setUserRating(p);
    pendingScore.current = p;
  }
  React.useEffect(() => {
    if (!wine) return;
    const isGoodMatch = matchPct == null || matchPct >= 55;
    const matchRange = matchPct == null ? 'x' : matchPct >= 85 ? 'hi' : matchPct >= 55 ? 'mid' : 'lo';
    const cacheKey = `vinterest_why_${(wine.name || '').replace(/\s/g, '_')}_${wine.vintage || 'nv'}_${matchRange}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setGenWhy(cached);
      return;
    }
    const userWines = WineHistory.getAll();
    if (!userWines.length) return;
    const typeKey = (wine.type || 'red').toLowerCase().replace('é', 'e');
    const typeWines = userWines.filter(w => (w.type || 'red').toLowerCase().replace('é', 'e') === typeKey);
    if (!typeWines.length) return;
    const avgB = typeWines.filter(w => w.body != null).reduce((s, w) => s + w.body, 0) / (typeWines.filter(w => w.body != null).length || 1);
    const avgT = typeWines.filter(w => w.tannins != null).reduce((s, w) => s + w.tannins, 0) / (typeWines.filter(w => w.tannins != null).length || 1);
    const avgA = typeWines.filter(w => w.acidity != null).reduce((s, w) => s + w.acidity, 0) / (typeWines.filter(w => w.acidity != null).length || 1);
    const topWines = [...typeWines].filter(w => w.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 4).map(w => w.name + (w.vintage ? ' ' + w.vintage : '')).join(', ');
    const gCounts = {};
    typeWines.forEach(w => (w.grapes || []).forEach(g => {
      if (g) gCounts[g] = (gCounts[g] || 0) + 1;
    }));
    const topGrapes = Object.entries(gCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]).join(', ');
    const lbl = v => v >= 0.68 ? 'high' : v >= 0.38 ? 'medium' : 'low';
    setGeneratingWhy(true);
    const wineCtx = `${wine.name}${wine.vintage ? ' ' + wine.vintage : ''}, a ${wine.type || 'red'} from ${wine.region || wine.country || 'unknown'} with body=${(wine.body ?? 0.65).toFixed(1)}, tannins=${(wine.tannins ?? 0.55).toFixed(1)}, acidity=${(wine.acidity ?? 0.60).toFixed(1)}`;
    const userCtx = `Their ${wine.type || 'red'} DNA: body ${lbl(avgB)}, tannins ${lbl(avgT)}, acidity ${lbl(avgA)}. Top rated: ${topWines || 'none yet'}. Favourite grapes: ${topGrapes || 'still discovering'}.`;
    const prompt = isGoodMatch ? `The user is looking at: ${wineCtx}. ${userCtx} Write ONE sentence (max 30 words) explaining specifically why this wine matches this user — compare attributes or reference their actual top wines by name. Be concrete, not generic. IMPORTANT: Do NOT include ANY numbers, decimals, percentages, or specific wine attribute values anywhere in your response. Use only descriptive words like high, low, medium, bold, light, etc. Return ONLY the sentence, no quotes.` : `The user is looking at: ${wineCtx}. ${userCtx} This wine scores ${matchPct}% against their taste profile. Write ONE sentence (max 30 words) explaining honestly and constructively why this wine contrasts with their usual preferences — be specific about the key difference (e.g. body, tannins, acidity, style). IMPORTANT: No numbers, decimals, percentages in your response. Use only descriptive words. Return ONLY the sentence, no quotes.`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      const s = text.trim();
      localStorage.setItem(cacheKey, s);
      setGenWhy(s);
    }).catch(() => {}).finally(() => setGeneratingWhy(false));
  }, [wine?.name, wine?.vintage, matchPct]);
  const [vintageInfo, setVintageInfo] = React.useState(null);
  const [loadingVintage, setLoadingVintage] = React.useState(false);
  React.useEffect(() => {
    if (!wine || !wine.vintage) return;
    const cacheKey = `vinterest_vintage_${(wine.name || '').replace(/\s/g, '_')}_${wine.vintage}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setVintageInfo(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    setLoadingVintage(true);
    const yr = new Date().getFullYear();
    const prompt = `You are a sommelier. Assess the vintage quality and realistic drinking window for this specific wine. Wine: ${wine.name} ${wine.vintage}. Type: ${wine.type || 'red'}, Region: ${wine.region || ''}, Country: ${wine.country || ''}. Grapes: ${(wine.grapes || []).join(', ') || 'unknown'}. Body: ${(wine.body ?? 0.65).toFixed(1)}, Tannins: ${(wine.tannins ?? 0.55).toFixed(1)}, Acidity: ${(wine.acidity ?? 0.60).toFixed(1)}, ABV: ${wine.abv || 13}%. Return ONLY valid JSON (no markdown): {"vintage_rating":"Exceptional|Outstanding|Very Good|Good|Average","drink_from":${yr},"drink_to":2032,"peak_from":2025,"peak_to":2029,"note":"one concrete sentence on how this wine is developing right now and why. IMPORTANT: Do NOT include ANY numbers, decimals, percentages, or specific attribute values (like '0.82 tannins' or '82%') anywhere in the sentence. Use only descriptive words like high, low, medium, bold, structured, etc."}`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      let c = text.replace(/```json|```/g, '').trim();
      const s = c.indexOf('{'),
        e = c.lastIndexOf('}');
      if (s >= 0 && e > s) c = c.slice(s, e + 1);
      const d = JSON.parse(c);
      localStorage.setItem(cacheKey, JSON.stringify(d));
      setVintageInfo(d);
    }).catch(() => {}).finally(() => setLoadingVintage(false));
  }, [wine?.name, wine?.vintage]);
  const isRed = (wine?.type || '').toLowerCase().replace('é', 'e') === 'red';
  const isWhite = (wine?.type || '').toLowerCase().replace('é', 'e') === 'white';
  const isSparkling = (wine?.type || '').toLowerCase().replace('é', 'e') === 'sparkling';
  const isOrange = (wine?.type || '').toLowerCase().replace('é', 'e') === 'orange';
  const isDessert = (wine?.type || '').toLowerCase().replace('é', 'e') === 'dessert';
  const isFortified = (wine?.type || '').toLowerCase().replace('é', 'e') === 'fortified';
  const showTannins = isRed || isOrange || isFortified;
  const showTexture = isWhite || isOrange || isDessert || isFortified;
  const charLbl = (v, lo, hi) => v >= 0.68 ? hi : v >= 0.38 ? 'Medium' : lo;
  const chars = wine ? [{
    label: 'Body',
    value: charLbl(wine.body ?? 0.65, 'Light', 'Full')
  }, ...(showTannins ? [{
    label: 'Tannins',
    value: charLbl(wine.tannins ?? 0.55, 'Silky', 'Grippy')
  }] : []), {
    label: 'Acidity',
    value: charLbl(wine.acidity ?? 0.60, 'Mellow', 'Zingy')
  }, ...(showTexture ? [{
    label: 'Texture',
    value: charLbl(wine.texture ?? 0.3, 'Crisp & Steely', 'Rich & Creamy')
  }] : []), {
    label: 'Sweetness',
    value: charLbl(wine.sweetness ?? 0.10, 'Bone Dry', 'Sweet')
  }, ...(isSparkling ? [{
    label: 'Effervescence',
    value: charLbl(wine.effervescence ?? 0.6, 'Soft & Delicate', 'Vigorous & Persistent')
  }] : []), ...(wine.abv ? [{
    label: 'ABV',
    value: `${wine.abv}%`
  }] : [])] : [];
  const SL = ({
    label
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginBottom: 8
    }
  }, label);
  const notes = wine?.tasting_notes || [];
  const pairings = wine?.food_pairings || [];

  /* Match sentiment — sliding scale */
  const matchConfig = React.useMemo(() => {
    if (matchPct == null || matchPct >= 85) return {
      descriptor: matchPct != null ? "You'll love this" : null,
      title: 'Why This Matches You',
      bg: C.greenBg,
      border: `1px solid ${C.green}25`,
      col: C.green
    };
    if (matchPct >= 70) return {
      descriptor: 'A great match',
      title: 'Why This Works for You',
      bg: C.greenBg,
      border: `1px solid ${C.green}25`,
      col: C.green
    };
    if (matchPct >= 55) return {
      descriptor: 'Worth exploring',
      title: 'What to Expect',
      bg: '#EEF6FF',
      border: '1px solid #4A90D930',
      col: '#2563A8'
    };
    if (matchPct >= 38) return {
      descriptor: 'Outside your comfort zone',
      title: 'Where It Differs',
      bg: C.amberBg,
      border: `1px solid ${C.amber}35`,
      col: C.amber
    };
    return {
      descriptor: 'Not your usual style',
      title: 'Why This Might Not Be for You',
      bg: C.crSoft,
      border: `1px solid ${C.crDim}`,
      col: C.cr
    };
  }, [matchPct]);
  function pairingIcon(text) {
    const t = (text || '').toLowerCase();
    if (/lamb|mutton|sheep/.test(t)) return 'food-lamb';
    if (/beef|steak|rib|brisket|burger|daube|braised/.test(t)) return 'food-beef';
    if (/chicken|poultry|duck|turkey/.test(t)) return 'food-chicken';
    if (/fish|salmon|tuna|halibut|cod|seafood|prawn|shrimp|oyster|mussel|clam/.test(t)) return 'food-fish';
    if (/cheese|brie|camembert|gouda|cheddar|parmesan|comt|manchego|aged/.test(t)) return 'food-cheese';
    if (/pasta|risotto|noodle|gnocchi|pizza/.test(t)) return 'food-pasta';
    if (/bread|pastry|charcuterie|cured/.test(t)) return 'food-bread';
    if (/vegetable|veg|mushroom|truffle|salad|onion|herb/.test(t)) return 'food-veg';
    if (/pork|ham|bacon|sausage/.test(t)) return 'food-meat';
    return 'food-generic';
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, (() => {
    const dotStyle = (pct, col, delay = '0s') => ({
      position: 'absolute',
      left: `${sliderAnimated ? pct : 0}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: col,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 8px ${col}55`,
      transition: `left 0.75s cubic-bezier(0.34,1.1,0.64,1) ${delay}`
    });
    return /*#__PURE__*/React.createElement(Card, {
      style: {
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: C.green,
        fontFamily: C.P,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        opacity: 0.55
      }
    }, "Your Match"), matchConfig.descriptor && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: matchConfig.col,
        fontFamily: C.P,
        opacity: 0.8
      }
    }, "\xB7 ", matchConfig.descriptor)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: C.green,
        fontFamily: C.P,
        letterSpacing: '-0.02em'
      }
    }, matchPct != null ? `${matchPct}%` : '—')), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: 8,
        background: `linear-gradient(to right,${C.white},${C.green}50,${C.green})`,
        borderRadius: 4,
        position: 'relative',
        border: `1px solid ${C.green}25`
      }
    }, matchPct != null && /*#__PURE__*/React.createElement("div", {
      style: dotStyle(matchPct, C.green)
    }))), /*#__PURE__*/React.createElement("div", {
      onClick: () => {
        setShowRatingUI(true);
        setSaved(false);
      },
      style: {
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: C.amber,
        fontFamily: C.P,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        opacity: 0.55
      }
    }, "Your Rating"), userRating > 0 && scoreLabel && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: C.amber,
        fontFamily: C.P,
        opacity: 0.65
      }
    }, "\xB7 ", scoreLabel)), userRating > 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 800,
        color: C.amber,
        fontFamily: C.P,
        letterSpacing: '-0.02em'
      }
    }, userRating), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: C.amber,
        fontFamily: C.P,
        opacity: 0.6,
        marginLeft: 2
      }
    }, "pts")) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: C.mid,
        fontFamily: C.P,
        opacity: 0.5
      }
    }, "tap to rate")), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '100%',
        height: 8,
        background: userRating > 0 ? `linear-gradient(to right,${C.white},${C.amber}50,${C.amber})` : `linear-gradient(to right,${C.white},${C.line})`,
        borderRadius: 4,
        position: 'relative',
        border: `1px solid ${C.amber}25`
      }
    }, userRating > 0 && /*#__PURE__*/React.createElement("div", {
      style: dotStyle(userRating, C.amber, '0.12s')
    })), userRating > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 5,
        opacity: 0.4,
        textAlign: 'center'
      }
    }, "tap to edit")));
  })(), showRatingUI && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Rate This Wine"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginBottom: 12
    }
  }, [20, 40, 60, 80, 100].map(p => /*#__PURE__*/React.createElement("div", {
    key: p,
    onClick: () => handlePreset(p),
    style: {
      flex: 1,
      padding: '7px 2px',
      borderRadius: 9,
      border: `1.5px solid ${userRating === p ? C.cr : C.line}`,
      background: userRating === p ? C.cr : 'transparent',
      textAlign: 'center',
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: userRating === p ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, p)))), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    step: "1",
    value: userRating,
    onChange: handleSliderChange,
    style: {
      width: '100%',
      accentColor: C.cr,
      cursor: 'pointer',
      marginBottom: 10,
      display: 'block'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      minHeight: 48,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2
    }
  }, userRating > 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 36,
      fontWeight: 800,
      color: C.cr,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, userRating), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      fontFamily: C.P,
      marginLeft: 2,
      opacity: 0.7
    }
  }, "pts")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P
    }
  }, scoreLabel)) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Drag slider or tap a preset to rate")), userRating > 0 && !saved && /*#__PURE__*/React.createElement("div", {
    onClick: () => commitScore(),
    style: {
      marginTop: 10,
      background: C.cr,
      borderRadius: 12,
      padding: '12px',
      textAlign: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Save Rating")), saved && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 15,
      color: C.green,
      fontFamily: C.P,
      fontWeight: 600,
      marginTop: 8
    }
  }, "\u2713 Saved to My Wines")), /*#__PURE__*/React.createElement(Card, {
    style: {
      background: matchConfig.bg,
      border: matchConfig.border,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: matchConfig.col,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginBottom: 6
    }
  }, matchConfig.title), generatingWhy ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 5,
      border: `2px solid ${matchConfig.col}40`,
      borderTopColor: matchConfig.col,
      animation: 'storySpin .8s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: matchConfig.col,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Analyzing your taste\u2026")) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: matchConfig.col,
      fontFamily: C.P,
      lineHeight: 1.6
    }
  }, genWhy || '(personalizing…)')), /*#__PURE__*/React.createElement(ScanLocationCard, {
    wine: wine
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Taste Profile"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 12,
      padding: '10px 12px',
      borderRadius: 10,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, "These ", chars.length, " dimensions describe how this wine will feel in your mouth \u2014 they help you understand what to expect and find wines you'll enjoy.", !showTannins ? ' Tannins aren\'t shown here since they\'re not a meaningful factor for this style.' : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, isSparkling && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Effervescence"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Effervescence describes the intensity and persistence of the bubbles. A soft, delicate mousse feels gentle on the tongue; vigorous effervescence has a fine, energetic, long-lasting fizz.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Soft & Delicate"), /*#__PURE__*/React.createElement("span", null, "Vigorous & Persistent")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.effervescence ?? 0.6) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine's bubbles are ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Effervescence')?.value.toLowerCase()), " \u2014 ", (wine?.effervescence ?? 0.6) >= 0.68 ? 'expect a fine, persistent, energetic fizz that lingers on the palate, typical of traditional-method production.' : 'the mousse is soft and gentle, with larger, quicker-fading bubbles that feel easy-drinking rather than intense.')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Body"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Body describes how a wine feels in your mouth — how heavy or light it is. Light wines are crisp and refreshing; full wines coat your mouth with richness.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Light"), /*#__PURE__*/React.createElement("span", null, "Full")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.body ?? 0.65) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine is ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Body')?.value.toLowerCase()), " \u2014 ", (wine?.body ?? 0.65) >= 0.68 ? 'it coats your mouth like whole milk or cream, full and rich' : 'it feels crisp and refreshing in your mouth, like skim milk', ". ", (wine?.body ?? 0.65) >= 0.68 ? 'Perfect for hearty foods and contemplative sipping.' : 'Great as an aperitif or with lighter dishes.')), isRed && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Tannins"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Tannins are compounds found mostly in red wines that create a drying sensation in your mouth. Silky tannins feel smooth; grippy tannins feel textured and astringent.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Silky"), /*#__PURE__*/React.createElement("span", null, "Grippy")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.tannins ?? 0.55) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine has ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Tannins')?.value.toLowerCase()), " tannins \u2014 ", (wine?.tannins ?? 0.55) >= 0.68 ? 'you\'ll feel a textured, drying sensation in your mouth, like biting grape skins. These wines age beautifully.' : 'the sensation in your mouth is smooth and soft, without much grip. These are drinking wines, ready to enjoy now.')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Acidity"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Acidity is the tartness you taste in wine, like lemon or vinegar. Mellow acidity feels smooth; zingy acidity tastes crisp and bright.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Mellow"), /*#__PURE__*/React.createElement("span", null, "Zingy")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.acidity ?? 0.60) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine is ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Acidity')?.value.toLowerCase()), " \u2014 ", (wine?.acidity ?? 0.60) >= 0.68 ? 'it tastes fresh and bright, like lemon juice. High acidity makes this wine a food-friendly pairing partner and helps it age.' : 'it feels smooth and soft on your palate, without much crispness. These wines are approachable and easy-drinking.')), isWhite && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Texture"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Texture describes how oak aging, lees contact, or malolactic fermentation shape a white wine mouthfeel. Crisp and steely wines taste clean and mineral; rich and creamy wines feel rounder and softer.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Crisp & Steely"), /*#__PURE__*/React.createElement("span", null, "Rich & Creamy")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.texture ?? 0.3) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine's texture is ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Texture')?.value.toLowerCase()), " \u2014 ", (wine?.texture ?? 0.3) >= 0.68 ? 'oak aging and/or lees contact give it a rounder, creamier mouthfeel, often with notes of butter or vanilla.' : 'it stays clean, precise and mineral-driven, with little to no oak influence.')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Sweetness"), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      alert('Sweetness measures residual sugar left in wine after fermentation. Bone dry wines have minimal sugar; sweet wines are noticeably sugary, often enjoyed as dessert wines.');
    },
    style: {
      width: 20,
      height: 20,
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.cr}`,
      color: C.cr,
      fontSize: 12,
      fontWeight: 400,
      cursor: 'pointer',
      padding: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: C.P
    }
  }, "?")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", null, "Bone Dry"), /*#__PURE__*/React.createElement("span", null, "Sweet")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: 8,
      background: `linear-gradient(to right, ${C.white}, ${C.ink2}40, ${C.cr})`,
      borderRadius: 4,
      position: 'relative',
      marginBottom: 12,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: `${(wine?.sweetness ?? 0.10) * 100}%`,
      top: '-6px',
      width: 20,
      height: 20,
      background: C.cr,
      borderRadius: 10,
      transform: 'translateX(-50%)',
      border: `3px solid ${C.white}`,
      boxShadow: `0 2px 4px rgba(0,0,0,0.15)`
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "This wine is ", /*#__PURE__*/React.createElement("strong", null, chars.find(c => c.label === 'Sweetness')?.value.toLowerCase()), " \u2014 ", (wine?.sweetness ?? 0.10) >= 0.68 ? 'noticeably sweet with residual sugar. Perfect as a dessert wine or for those who prefer sweeter flavours.' : wine?.sweetness > 0.38 ? 'off-dry with a touch of sweetness that balances the acidity. Approachable without being overly sweet.' : 'nearly all the sugar was fermented out. This is a dry wine with no perceptible sweetness.')), chars.find(c => c.label === 'ABV') && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Alcohol Content"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, chars.find(c => c.label === 'ABV')?.value)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingLeft: 8,
      borderLeft: `2px solid ${C.crSoft}`
    }
  }, "At ", wine?.abv, "%, this wine has ", wine?.abv < 10 ? 'lower alcohol, making it light and crisp' : wine?.abv < 13 ? 'moderate alcohol, typical for most wines' : wine?.abv < 15 ? 'higher alcohol, which adds warmth and body' : 'very high alcohol, which adds significant warmth and weight to the wine', ". Higher alcohol also affects aging potential.")))), notes.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Tasting Notes"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 12,
      padding: '10px 12px',
      borderRadius: 10,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, "These flavours are what you'll taste when you drink it \u2014 look for these clues as you sip. Tasting notes help you build your palate and remember wines you love."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, notes.map((n, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '5px 13px',
      borderRadius: 20,
      background: i < 2 ? C.crSoft : C.offWhite,
      color: i < 2 ? C.cr : C.ink2,
      fontSize: 15,
      fontWeight: 500,
      fontFamily: C.P,
      border: `1px solid ${i < 2 ? C.crDim : C.line}`
    }
  }, n)))), pairings.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Pairs With"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, pairings.slice(0, 3).map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      background: C.offWhite,
      borderRadius: 12,
      padding: '12px 6px',
      textAlign: 'center',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: pairingIcon(f),
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink2,
      fontFamily: C.P,
      fontWeight: 500,
      lineHeight: 1.3
    }
  }, f))))), wine?.vintage && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: `About the ${wine.vintage} Vintage`
  }), loadingVintage ? /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 6,
      border: '2px solid rgba(0,0,0,0.08)',
      borderTopColor: C.cr,
      animation: 'detailSpin .8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Analysing vintage\u2026")) : vintageInfo ? /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Quality Rating"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, vintageInfo.vintage_rating)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Drinking Now"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P
    }
  }, vintageInfo.drink_from, "\u2013", vintageInfo.drink_to)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Peak Years"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P
    }
  }, vintageInfo.peak_from, "\u2013", vintageInfo.peak_to)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5,
      paddingTop: 12,
      borderTop: `1px solid ${C.line}`,
      marginTop: 12
    }
  }, "\uD83D\uDCA1 ", vintageInfo.note)) : null));
}
function DetailStory({
  wine,
  nav,
  existingRating = 0
}) {
  const description = wine?.description?.trim() || 'A wine with character and depth.';

  // ── Education: grape deep-dive, growing-season context, vocab terms (batched + cached) ──
  const [edu, setEdu] = React.useState(null);
  const [eduLoading, setEduLoading] = React.useState(false);
  React.useEffect(() => {
    if (!wine || !wine.name) return;
    const key = 'vinterest_edu_v1_' + (wine.name || '').replace(/\s/g, '_') + '_' + (wine.vintage || 'nv');
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        setEdu(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    if (!window.claude || !window.claude.complete) return;
    setEduLoading(true);
    const g = wine.grapes && wine.grapes[0] || wine.type || 'red';
    const prompt = _fillTpl(_loadText('prompts/vocabulary.txt'), {
      name: wine.name || '',
      vintage: wine.vintage && wine.vintage !== 0 ? ' ' + wine.vintage : '',
      type: wine.type || 'red',
      region: wine.region || '',
      country: wine.country || '',
      grapes: (wine.grapes || []).join(', ') || 'unknown',
      grapeOrType: g,
      regionOrCountry: wine.region || wine.country || 'this region',
      vintageContext: wine.vintage && wine.vintage !== 0 ? ' around the ' + wine.vintage + ' vintage' : ''
    });
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      let c = text.replace(/```json|```/g, '').trim();
      const s = c.indexOf('{'),
        e = c.lastIndexOf('}');
      if (s >= 0 && e > s) c = c.slice(s, e + 1);
      const d = JSON.parse(c);
      localStorage.setItem(key, JSON.stringify(d));
      setEdu(d);
      if (d.terms && d.terms.length) VocabLedger.addTerms((wine.name || '') + '_' + (wine.vintage || 'nv'), d.terms);
    }).catch(() => {}).finally(() => setEduLoading(false));
  }, [wine?.name, wine?.vintage]);
  const eduSpin = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 11,
      height: 11,
      borderRadius: 6,
      border: `2px solid ${C.cr}33`,
      borderTopColor: C.cr,
      animation: 'storySpin .8s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Pulling together the lesson\u2026"));
  const SL = ({
    label
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginBottom: 8
    }
  }, label);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "The Story"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.75
    }
  }, description)), wine?.grapes && wine.grapes.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Grape Varietal"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, wine.grapes.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '8px 14px',
      borderRadius: 10,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P
    }
  }, g))))), wine?.type && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Wine Type"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      textTransform: 'capitalize'
    }
  }, wine.type)), (wine?.region || wine?.country) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Region"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, wine.region, wine.region && wine.country ? ', ' : '', wine.country)), (edu || eduLoading) && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Further Your Palate"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 16,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, wine?.grapes && wine.grapes[0] || 'The grape', ", up close")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6
    }
  }, eduLoading && !edu ? eduSpin : edu && edu.grape || '')), edu && edu.season && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "globe",
    sz: 16,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, wine?.vintage && wine.vintage !== 0 ? `The ${wine.vintage} growing season` : 'Climate & place')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6
    }
  }, edu.season)), edu && Array.isArray(edu.terms) && edu.terms.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "book",
    sz: 16,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Words this bottle teaches")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, edu.terms.slice(0, 3).map((tm, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 3,
      background: C.cr,
      marginTop: 7,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, tm.term), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, " \u2014 ", tm.meaning)))))), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('learn'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '13px 15px',
      borderRadius: 14,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 11,
      background: C.white,
      border: `1px solid ${C.crDim}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "book",
    sz: 19,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "Keep learning"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.cr,
      opacity: 0.75,
      fontFamily: C.P
    }
  }, "Quizzes & lessons on ", wine?.grapes && wine.grapes[0] || wine?.region || 'wine')), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 15,
    col: C.cr
  })))), /*#__PURE__*/React.createElement("style", null, `@keyframes storySpin{to{transform:rotate(360deg)}}`));
}

/* Region → currency config */
const REGION_CURRENCY = {
  uk: {
    sym: '£',
    base: '£',
    code: 'GBP',
    label: 'United Kingdom'
  },
  us: {
    sym: '$',
    base: '$',
    code: 'USD',
    label: 'United States'
  },
  ontario: {
    sym: 'CA$',
    base: '$',
    code: 'CAD',
    label: 'Ontario, Canada'
  },
  canada: {
    sym: 'CA$',
    base: '$',
    code: 'CAD',
    label: 'Canada'
  },
  australia: {
    sym: 'A$',
    base: '$',
    code: 'AUD',
    label: 'Australia'
  },
  nz: {
    sym: 'NZ$',
    base: '$',
    code: 'NZD',
    label: 'New Zealand'
  },
  eu: {
    sym: '€',
    base: '€',
    code: 'EUR',
    label: 'Europe'
  },
  france: {
    sym: '€',
    base: '€',
    code: 'EUR',
    label: 'France'
  },
  germany: {
    sym: '€',
    base: '€',
    code: 'EUR',
    label: 'Germany'
  },
  italy: {
    sym: '€',
    base: '€',
    code: 'EUR',
    label: 'Italy'
  },
  spain: {
    sym: '€',
    base: '€',
    code: 'EUR',
    label: 'Spain'
  }
};
/* base = plain currency symbol shown on-screen (e.g. "$"); code = abbreviation shown as a small caption
   (e.g. "CAD") underneath the amount, so "CA$24" becomes "$24" with "CAD" below it. sym (with country
   prefix) is kept only for use inside LLM prompts, where the disambiguation matters. */

function DetailPrice({
  wine,
  nav
}) {
  const curr = (() => {
    const rc = Regional.current();
    return {
      sym: rc.sym,
      base: rc.base,
      code: rc.code,
      label: rc.label
    };
  })();
  const [priceData, setPriceData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const cacheKey = wine ? retailPriceCacheKey(wine, curr.code) : null;
  React.useEffect(function () {
    if (!wine || !wine.name) return;
    setPriceData(null);
    setDone(false);
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setPriceData(JSON.parse(cached));
          setDone(true);
          return;
        } catch (e) {}
      }
    }
    setLoading(true);
    fetchRetailEstimate(wine, curr).then(function (d) {
      setPriceData(d);
    }).catch(function () {}).finally(function () {
      setLoading(false);
      setDone(true);
    });
  }, [wine && wine.name, wine && wine.vintage, curr.code]);
  const SL = ({
    label
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginBottom: 8
    }
  }, label);
  const tierColor = {
    'entry': C.mid,
    'everyday': C.ink2,
    'premium': C.cr,
    'luxury': '#9B6B00',
    'ultra-luxury': '#6B2D8B'
  };
  const tierLabel = {
    'entry': 'Entry-level',
    'everyday': 'Everyday',
    'premium': 'Premium',
    'luxury': 'Luxury',
    'ultra-luxury': 'Ultra-luxury'
  };
  const fmtPrice = n => n != null ? curr.base + n.toLocaleString() : '—';
  function handleFindItForMe() {
    if (!wine) return;
    const q = `${wine.producer ? wine.producer + ' ' : ''}${wine.name}${wine.vintage && wine.vintage !== 'NV' ? ' ' + wine.vintage : ''} ${wine.type || ''} wine buy near me`;
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
  }
  const hasPrice = priceData && priceData.mid != null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, loading && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 13,
      height: 13,
      borderRadius: 7,
      border: '2px solid rgba(0,0,0,0.08)',
      borderTopColor: C.cr,
      animation: 'storySpin .8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Estimating price\u2026")), done && hasPrice && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Estimated Retail Price"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px',
      background: C.crSoft,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '1px solid ' + C.crDim
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Typical bottle price"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: C.cr + '99',
      fontFamily: C.P
    }
  }, curr.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      color: C.cr,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, fmtPrice(priceData.mid)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.cr + '99',
      fontFamily: C.P,
      marginTop: 3,
      letterSpacing: '0.04em'
    }
  }, curr.code))), (priceData.low != null || priceData.high != null) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: '1px solid ' + C.line
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '11px 14px',
      borderRight: '1px solid ' + C.line
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Budget end"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, fmtPrice(priceData.low)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 2,
      letterSpacing: '0.04em'
    }
  }, curr.code)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '11px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Premium end"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, fmtPrice(priceData.high)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 2,
      letterSpacing: '0.04em'
    }
  }, curr.code))), priceData.tier && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Price tier"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: tierColor[priceData.tier] || C.cr,
      fontFamily: C.P
    }
  }, tierLabel[priceData.tier] || priceData.tier)))), priceData.note && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SL, {
    label: "Price Context"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6,
      padding: '12px 14px',
      borderRadius: 12,
      background: C.offWhite,
      border: '1px solid ' + C.line
    }
  }, priceData.note)), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    style: {
      background: C.cr,
      boxShadow: `0 3px 12px ${C.cr}35`
    },
    onClick: handleFindItForMe
  }, "Find It For Me"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      textAlign: 'center',
      padding: '0 8px'
    }
  }, "Prices are estimates based on publicly available market data and may vary by retailer, vintage condition, and availability.")), done && !hasPrice && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Price estimate unavailable for this wine.")), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    style: {
      background: C.cr,
      boxShadow: `0 3px 12px ${C.cr}35`
    },
    onClick: handleFindItForMe
  }, "Find It For Me")));
}
Object.assign(window, {
  WineDetailScreen,
  DetailMerged,
  DetailStory,
  DetailPrice
});

/* ---- pwa-screens-explore.jsx (precompiled) ---- */
/* Vinterest PWA — Region, Varietal, Similar Wines explore screens */

/* Shared Claude-fetch hook with sessionStorage cache */
function useClaudeData(cacheKey, prompt, wine) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  React.useEffect(() => {
    if (!wine) {
      setLoading(false);
      return;
    }
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setData(JSON.parse(cached));
        setLoading(false);
        return;
      } catch (e) {}
    }
    (async () => {
      try {
        const text = await window.claude.complete({
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        let cleaned = text.replace(/```json|```/g, '').trim();
        const s = cleaned.indexOf('{'),
          e = cleaned.lastIndexOf('}');
        if (s >= 0 && e > s) cleaned = cleaned.slice(s, e + 1);
        const result = JSON.parse(cleaned);
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [cacheKey]);
  return {
    data,
    loading,
    error
  };
}
function ExploreLoading() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 22,
      border: '3px solid rgba(0,0,0,0.07)',
      borderTopColor: C.cr,
      animation: 'vspin 0.85s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Loading\u2026"), /*#__PURE__*/React.createElement("style", null, `@keyframes vspin{to{transform:rotate(360deg)}}`));
}

/* ── REGION SCREEN ── */
function RegionScreen({
  nav,
  back
}) {
  const wine = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}').wine || null;
    } catch (e) {
      return null;
    }
  }, []);
  const region = wine?.sub_region || wine?.region || 'Unknown Region';
  const country = wine?.country || '';
  const prompt = `You are a wine expert. Tell me about the ${region} wine region in ${country}. Return ONLY valid JSON (no markdown): {"about":"2 engaging sentences about this region","climate":"1 sentence about climate and terroir","key_varietals":["Grape1","Grape2","Grape3"],"notable_producers":["Producer1","Producer2","Producer3"],"food_culture":"1 sentence about local food and wine pairing","fun_fact":"1 surprising or interesting fact"}`;
  const {
    data,
    loading
  } = useClaudeData(`vinterest_region_${region}`, prompt, wine);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.cr,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: 'rgba(255,255,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, region), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.65)',
      fontFamily: C.P
    }
  }, country)), /*#__PURE__*/React.createElement(Icon, {
    n: "globe",
    sz: 22,
    col: "rgba(255,255,255,0.35)"
  })), loading ? /*#__PURE__*/React.createElement(ExploreLoading, null) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "About ", region), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.65
    }
  }, data?.about || 'Information unavailable.'), data?.climate && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      padding: '10px 12px',
      borderRadius: 10,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, "Climate & Terroir"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, data.climate))), data?.key_varietals?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Key Varietals"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, data.key_varietals.map((g, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    onClick: () => nav('varietal'),
    style: {
      padding: '5px 14px',
      borderRadius: 20,
      background: i === 0 ? C.crSoft : C.offWhite,
      color: i === 0 ? C.cr : C.ink2,
      fontSize: 15,
      fontWeight: i === 0 ? 600 : 500,
      fontFamily: C.P,
      border: `1px solid ${i === 0 ? C.crDim : C.line}`,
      cursor: 'pointer'
    }
  }, g)))), data?.notable_producers?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Notable Producers"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, data.notable_producers.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 10px',
      borderRadius: 10,
      background: C.offWhite
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 7,
      background: C.crSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 14,
    col: C.cr
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 500,
      color: C.ink,
      fontFamily: C.P
    }
  }, p))))), data?.food_culture && /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.greenBg,
      boxShadow: 'none',
      border: `1px solid ${C.green}25`,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.green,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Food & Wine Culture"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, data.food_culture)), data?.fun_fact && /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.amberBg,
      boxShadow: 'none',
      border: `1px solid ${C.amber}25`,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Did You Know?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, data.fun_fact)), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: () => nav('similar')
  }, "See Similar Wines"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── VARIETAL SCREEN ── */
function VarietalScreen({
  nav,
  back
}) {
  const wine = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}').wine || null;
    } catch (e) {
      return null;
    }
  }, []);
  const grape = wine?.grapes?.[0] || 'Unknown Varietal';
  const prompt = `You are a wine expert. Tell me about the ${grape} grape variety as it relates to wines like ${wine?.name || 'this wine'} from ${wine?.region || 'its region'}. Return ONLY valid JSON (no markdown): {"about":"2 engaging sentences","body":0.7,"tannins":0.6,"acidity":0.7,"sweetness":0.1,"body_desc":"plain language body description","tannin_desc":"plain language tannin description","typical_regions":["Region, Country"],"food_pairings":["Food1","Food2","Food3","Food4"],"similar_varietals":["Grape1","Grape2","Grape3"],"aging_note":"1 sentence on aging potential"}`;
  const {
    data,
    loading
  } = useClaudeData(`vinterest_varietal_${grape}`, prompt, wine);
  const tasteTiles = data ? [{
    name: 'Body',
    val: data.body ?? 0.7,
    desc: data.body_desc || '',
    lo: 'Light',
    hi: 'Full',
    col: '#8B1A2F'
  }, {
    name: 'Tannins',
    val: data.tannins ?? 0.6,
    desc: data.tannin_desc || '',
    lo: 'Silky',
    hi: 'Grippy',
    col: '#7B5EA7'
  }, {
    name: 'Acidity',
    val: data.acidity ?? 0.7,
    desc: '',
    lo: 'Mellow',
    hi: 'Zingy',
    col: C.green
  }, {
    name: 'Sweetness',
    val: data.sweetness ?? 0.1,
    desc: '',
    lo: 'Bone Dry',
    hi: 'Sweet',
    col: C.amber
  }] : [];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.ink,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, grape), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P
    }
  }, "Grape Varietal")), /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 22,
    col: "rgba(255,255,255,0.25)"
  })), loading ? /*#__PURE__*/React.createElement(ExploreLoading, null) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.65
    }
  }, data?.about)), tasteTiles.length > 0 && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Taste Characteristics"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, tasteTiles.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '10px',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, t.name), t.desc && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.3,
      marginBottom: 6
    }
  }, t.desc), /*#__PURE__*/React.createElement(Prog, {
    val: t.val,
    col: t.col,
    h: 5
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginTop: 3
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#bbb',
      fontFamily: C.P
    }
  }, t.lo), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: t.col,
      fontFamily: C.P
    }
  }, t.val >= .7 ? t.hi : t.val >= .4 ? 'Medium' : t.lo), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: '#bbb',
      fontFamily: C.P
    }
  }, t.hi)))))), data?.typical_regions?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Famous In"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, data.typical_regions.map((r, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '5px 13px',
      borderRadius: 20,
      background: C.offWhite,
      color: C.ink2,
      fontSize: 15,
      fontWeight: 500,
      fontFamily: C.P,
      border: `1px solid ${C.line}`
    }
  }, r)))), data?.food_pairings?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Food Pairings"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 7
    }
  }, data.food_pairings.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.offWhite,
      borderRadius: 10,
      padding: '10px 8px',
      textAlign: 'center',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      fontWeight: 500
    }
  }, f))))), data?.similar_varietals?.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "If You Like This, Try\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, data.similar_varietals.map((g, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '5px 13px',
      borderRadius: 20,
      background: C.crSoft,
      color: C.cr,
      fontSize: 15,
      fontWeight: 600,
      fontFamily: C.P,
      border: `1px solid ${C.crDim}`
    }
  }, g)))), data?.aging_note && /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.amberBg,
      boxShadow: 'none',
      border: `1px solid ${C.amber}25`,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Aging Potential"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55
    }
  }, data.aging_note)), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: () => nav('similar')
  }, "See Similar Wines"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── SIMILAR WINES SCREEN ── */
function SimilarWinesScreen({
  nav,
  back
}) {
  const wine = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_scan_result') || '{}').wine || null;
    } catch (e) {
      return null;
    }
  }, []);
  const wineName = wine?.name || 'this wine';
  const prompt = `You are a sommelier. Suggest 5 wines similar to ${wineName} (${wine?.type || 'red'}, ${wine?.region || ''}, ${wine?.grapes?.[0] || ''}). Return ONLY valid JSON (no markdown): {"wines":[{"name":"Wine Name","producer":"Producer","region":"Region","country":"Country","type":"red|white|rosé|sparkling","grapes":["Grape"],"why_similar":"1 sentence explanation","step":"same|step_up|step_down","approx_price_usd":45}]}. Mix of same-price, cheaper, and pricier options.`;
  const {
    data,
    loading
  } = useClaudeData(`vinterest_similar_${wineName}`, prompt, wine);
  const typeColors = {
    red: '#8B1A2F',
    white: '#B8963E',
    'rosé': '#C47A8A',
    rose: '#C47A8A',
    sparkling: '#5E8FA8'
  };
  const colFor = t => typeColors[(t || 'red').toLowerCase().replace('é', 'e')] || C.cr;
  const badge = {
    same: {
      l: 'Similar price',
      bg: C.greenBg,
      col: C.green
    },
    step_up: {
      l: 'Step up',
      bg: C.amberBg,
      col: C.amber
    },
    step_down: {
      l: 'Better value',
      bg: C.crSoft,
      col: C.cr
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 16px 12px',
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Similar Wines"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, "Based on ", wineName)), /*#__PURE__*/React.createElement(Icon, {
    n: "compass",
    sz: 20,
    col: C.mid
  }))), loading ? /*#__PURE__*/React.createElement(ExploreLoading, null) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, (data?.wines || []).map((w, i) => {
    const col = colFor(w.type);
    const b = badge[w.step] || {
      l: '',
      bg: '',
      col: ''
    };
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      style: {
        padding: 12,
        cursor: 'pointer'
      },
      onClick: () => {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: false,
          wine: {
            ...w,
            body: 0.7,
            tannins: 0.65,
            acidity: 0.6,
            sweetness: 0.1,
            tasting_notes: [],
            food_pairings: [],
            price_usd: w.approx_price_usd,
            description: w.why_similar,
            why_you_will_like_this: w.why_similar
          },
          confidence: 0.88
        }));
        nav('identified');
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 58,
        borderRadius: 8,
        background: col + '15',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${col}25`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "wine",
      sz: 19,
      col: col
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.2,
        flex: 1
      }
    }, w.name), w.approx_price_usd && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: C.ink2,
        fontFamily: C.P,
        flexShrink: 0
      }
    }, "$", w.approx_price_usd)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 2
      }
    }, [w.region, w.country].filter(Boolean).join(' · ')), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.ink2,
        fontFamily: C.P,
        marginTop: 4,
        lineHeight: 1.45,
        fontStyle: 'italic'
      }
    }, w.why_similar), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 6,
        marginTop: 6,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      sm: true,
      style: {
        background: col + '12',
        color: col,
        border: `1px solid ${col}25`,
        textTransform: 'capitalize'
      }
    }, w.type || 'Red'), w.grapes?.[0] && /*#__PURE__*/React.createElement(Pill, {
      sm: true
    }, w.grapes[0]), b.l && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: b.col,
        fontFamily: C.P,
        padding: '2px 8px',
        borderRadius: 20,
        background: b.bg,
        marginLeft: 'auto'
      }
    }, b.l)))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── STYLE EXPLORE SCREEN ── */
function StyleExploreScreen({
  nav,
  back
}) {
  const gap = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_style_explore') || 'null');
    } catch (e) {
      return null;
    }
  }, []);
  const allWines = WineHistory.getAll();
  const typeKey = gap?.typeKey || 'red';
  const typeWines = allWines.filter(w => (w.type || '').toLowerCase().replace('é', 'e') === typeKey);

  /* User DNA */
  const avgArr = (arr, field, fb) => {
    const ws = arr.filter(w => w[field] != null);
    return ws.length ? ws.reduce((s, w) => s + w[field], 0) / ws.length : fb;
  };
  const avgB = avgArr(typeWines, 'body', 0.65);
  const avgT = avgArr(typeWines, 'tannins', 0.55);
  const avgA = avgArr(typeWines, 'acidity', 0.60);

  /* Currency */
  const userRegion = localStorage.getItem('vinterest_region') || 'uk';
  const FX = {
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    NZD: 1.64,
    EUR: 0.92,
    USD: 1.0
  };
  const CBASE = {
    uk: '£',
    us: '$',
    ontario: '$',
    canada: '$',
    australia: '$',
    nz: '$',
    eu: '€',
    france: '€',
    germany: '€',
    italy: '€',
    spain: '€'
  };
  const CCODE = {
    uk: 'GBP',
    us: 'USD',
    ontario: 'CAD',
    canada: 'CAD',
    australia: 'AUD',
    nz: 'NZD',
    eu: 'EUR',
    france: 'EUR',
    germany: 'EUR',
    italy: 'EUR',
    spain: 'EUR'
  };
  const CLABEL = {
    uk: 'the UK',
    us: 'the US',
    ontario: 'Ontario, Canada',
    canada: 'Canada',
    australia: 'Australia',
    nz: 'New Zealand',
    eu: 'Europe',
    france: 'France',
    germany: 'Germany',
    italy: 'Italy',
    spain: 'Spain'
  };
  const csym = CBASE[userRegion] || '£';
  const ccode = CCODE[userRegion] || 'GBP';
  const clabel = CLABEL[userRegion] || 'the UK';
  const fx = FX[ccode] || 0.79;

  /* Avg spend from scan history */
  const priceWines = allWines.filter(w => w.price_usd > 0);
  const avgUsd = priceWines.length ? Math.round(priceWines.reduce((s, w) => s + w.price_usd, 0) / priceWines.length) : 30;
  const avgLocal = Math.round(avgUsd * fx);
  const [wines, setWines] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [addedToLearn, setAddedToLearn] = React.useState(() => {
    if (!gap) return false;
    try {
      const is = JSON.parse(localStorage.getItem('vinterest_learn_interests') || '[]');
      return is.some(i => i.label === gap.wine && i.wineType === typeKey);
    } catch (e) {
      return false;
    }
  });
  const cacheKey = gap ? `vinterest_se3_${(gap.wine || '').replace(/\W/g, '_').slice(0, 30)}_${ccode}` : null;
  React.useEffect(() => {
    if (!gap) return;
    if (cacheKey) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          setWines(JSON.parse(cached));
          return;
        } catch (e) {}
      }
    }
    setLoading(true);
    const bLbl = avgB >= 0.68 ? 'full-bodied' : avgB >= 0.38 ? 'medium-bodied' : 'light-bodied';
    const tLbl = avgT >= 0.68 ? 'high-tannin' : avgT >= 0.38 ? 'medium-tannin' : 'low-tannin';
    const aLbl = avgA >= 0.68 ? 'high-acidity' : avgA >= 0.38 ? 'medium-acidity' : 'low-acidity';
    const prompt = `You are a sommelier and wine pricing expert. The user loves ${typeKey} wines: ${bLbl}, ${tLbl}, ${aLbl}. Suggest exactly 4 specific named bottles in the ${gap.wine} style from ${gap.region}, one for EACH of these four tiers (use these exact tier keys):\n- "budget": cheap and cheerful, wallet-friendly\n- "value": high community rating relative to its price — excellent quality for what you pay\n- "mid-range": a great rating at a reasonable, everyday-special price\n- "top-tier": outstanding rating, premium price to match\nIMPORTANT for price_local: use the ACTUAL known retail price for each specific producer and wine in ${clabel} (${ccode}) — do NOT average by appellation. Prestigious wines can be ${csym}50–${csym}2000+; use real figures. Also include a realistic community rating out of 100 for each. Return ONLY valid JSON, no markdown: {"wines":[{"tier":"budget|value|mid-range|top-tier","name":"Full wine name","producer":"Producer","vintage":"year or NV","region":"${gap.region}","grapes":["Grape"],"price_local":NUMBER,"rating":NUMBER,"why":"1 sentence referencing body/tannins/acidity, and for value/top-tier the quality-to-price relationship"}]}`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      let c = text.replace(/```json|```/g, '').trim();
      const s = c.indexOf('{'),
        e = c.lastIndexOf('}');
      if (s >= 0 && e > s) c = c.slice(s, e + 1);
      const d = JSON.parse(c);
      const order = {
        budget: 0,
        value: 1,
        'mid-range': 2,
        'top-tier': 3
      };
      const list = (d.wines || []).slice().sort((a, b) => (order[a.tier] ?? 9) - (order[b.tier] ?? 9));
      if (cacheKey) localStorage.setItem(cacheKey, JSON.stringify(list));
      setWines(list);
    }).catch(() => setWines([])).finally(() => setLoading(false));
  }, []);
  function handleAddToLearn() {
    try {
      const is = JSON.parse(localStorage.getItem('vinterest_learn_interests') || '[]');
      const entry = {
        region: gap.region,
        wineType: typeKey,
        label: gap.wine,
        addedAt: new Date().toISOString()
      };
      if (!is.some(i => i.label === entry.label && i.wineType === entry.wineType)) {
        is.push(entry);
        localStorage.setItem('vinterest_learn_interests', JSON.stringify(is));
      }
      setAddedToLearn(true);
    } catch (e) {}
  }
  function handleFindItForMe(wine) {
    const q = `${wine.producer ? wine.producer + ' ' : ''}${wine.name}${wine.vintage && wine.vintage !== 'NV' ? ' ' + wine.vintage : ''} ${typeKey} wine buy near me`;
    window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank', 'noopener');
  }
  const TYPE_COL = {
    red: '#8B1A2F',
    white: '#B8963E',
    rose: '#C47A8A',
    sparkling: '#5E8FA8'
  };
  const col = TYPE_COL[typeKey] || C.cr;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: col,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: 'rgba(255,255,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      lineHeight: 1.2
    }
  }, gap?.wine || 'Style Explore'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.65)',
      fontFamily: C.P
    }
  }, gap?.region || '')), /*#__PURE__*/React.createElement(Icon, {
    n: "compass",
    sz: 20,
    col: "rgba(255,255,255,0.35)"
  })), loading ? /*#__PURE__*/React.createElement(ExploreLoading, null) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, gap?.why && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px',
      borderRadius: 12,
      background: col + '10',
      border: `1px solid ${col}25`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: col,
      fontFamily: C.P,
      marginBottom: 4,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }, "Why this matches your DNA"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6
    }
  }, gap.why)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '5px 12px',
      borderRadius: 20,
      background: C.amberBg,
      border: `1px solid ${C.amber}25`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P
    }
  }, "Avg spend \xB7 ", csym, avgLocal, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      opacity: 0.7
    }
  }, ccode))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '5px 12px',
      borderRadius: 20,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, clabel))), wines && wines.map((wine, i) => {
    const TIER = {
      'budget': {
        label: 'Budget',
        col: C.mid
      },
      'value': {
        label: 'Value',
        col: C.green
      },
      'mid-range': {
        label: 'Mid-Range',
        col: col
      },
      'top-tier': {
        label: 'Top-Tier',
        col: '#9B6B00'
      }
    };
    const tier = TIER[wine.tier] || null;
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      style: {
        padding: 14
      }
    }, tier && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        padding: '3px 10px',
        borderRadius: 20,
        background: tier.col + '15',
        border: `1px solid ${tier.col}35`,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: tier.col,
        fontFamily: C.P,
        letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }
    }, tier.label)), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.2,
        marginBottom: 2
      }
    }, wine.name), wine.producer && wine.producer !== wine.name && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.mid,
        fontFamily: C.P
      }
    }, wine.producer)), /*#__PURE__*/React.createElement("div", {
      style: {
        flexShrink: 0,
        textAlign: 'right'
      }
    }, wine.price_local && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: col,
        fontFamily: C.P,
        lineHeight: 1
      }
    }, csym, wine.price_local), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 10,
        fontWeight: 700,
        color: col + '99',
        fontFamily: C.P,
        marginTop: 2,
        letterSpacing: '0.04em'
      }
    }, ccode)), wine.vintage && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 2
      }
    }, wine.vintage))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        flexWrap: 'wrap',
        marginBottom: 8,
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      sm: true,
      style: {
        background: col + '12',
        color: col,
        border: `1px solid ${col}25`,
        textTransform: 'capitalize'
      }
    }, typeKey), (wine.grapes || []).slice(0, 2).map((g, j) => /*#__PURE__*/React.createElement(Pill, {
      key: j,
      sm: true
    }, g)), wine.rating > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        marginLeft: 'auto'
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "star",
      sz: 12,
      col: C.amber
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: C.amber,
        fontFamily: C.P
      }
    }, wine.rating, "/100"))), wine.why && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.55,
        fontStyle: 'italic',
        marginBottom: 10
      }
    }, wine.why), /*#__PURE__*/React.createElement(Btn, {
      primary: true,
      small: true,
      full: true,
      style: {
        background: col,
        boxShadow: `0 3px 10px ${col}35`
      },
      onClick: () => handleFindItForMe(wine)
    }, "Find It For Me"));
  }), wines && wines.length === 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "No suggestions available for this style.")), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      background: addedToLearn ? C.greenBg : C.offWhite,
      border: `1px solid ${addedToLearn ? C.green + '40' : C.line}`,
      transition: 'background .3s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: addedToLearn ? C.green : C.ink,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, addedToLearn ? '✓ Added to your Learn portal' : 'Learn more about this region'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.55,
      marginBottom: addedToLearn ? 0 : 12
    }
  }, addedToLearn ? `Personalised articles about ${gap?.region} will appear in your Learn tab.` : `Add ${gap?.region || 'this region'} & ${typeKey} wines to your learning interests — Vinterest will generate personalised articles to help you explore this style.`), !addedToLearn && /*#__PURE__*/React.createElement(Btn, {
    full: true,
    onClick: handleAddToLearn
  }, "Add to Learn")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}
Object.assign(window, {
  RegionScreen,
  VarietalScreen,
  SimilarWinesScreen,
  StyleExploreScreen
});

/* ---- pwa-screens-quiz.jsx (precompiled) ---- */
/* Vinterest — Quiz Hub + Quiz Screens */

// Emoji badge → line icon, until pwa-xp.js itself drops emoji (tracked separately).
const _LEVEL_ICONS = {
  '🍇': 'wine',
  '🥂': 'leaf',
  '🌍': 'compass',
  '🔍': 'book',
  '🏅': 'star',
  '🍾': 'flame',
  '🎓': 'trophy',
  '⭐': 'brain',
  '🏆': 'trophy',
  '👑': 'trophy'
};
const _RING_TYPES = [{
  key: 'red',
  label: 'Reds',
  col: '#8B1A2F'
}, {
  key: 'white',
  label: 'Whites',
  col: '#B8963E'
}, {
  key: 'rose',
  label: 'Rosé',
  col: '#C47A8A'
}, {
  key: 'sparkling',
  label: 'Sparkling',
  col: '#5E8FA8'
}];
function _normType(t) {
  return (t || '').toLowerCase().replace('é', 'e');
}
function getCoverage(wines) {
  const extra = ['orange', 'dessert', 'fortified'];
  const seen = new Set(wines.map(w => _normType(w.type)).filter(Boolean));
  const segs = _RING_TYPES.concat(extra.filter(k => seen.has(k)).map(k => ({
    key: k,
    label: k[0].toUpperCase() + k.slice(1),
    col: _TYPE_COLORS && _TYPE_COLORS[k] || C.cr
  }))).map(s => ({
    ...s,
    filled: seen.has(s.key)
  }));
  const distinctTypes = segs.filter(s => s.filled).length;
  const rated = wines.filter(w => w.rating > 0);
  const spread = arr => {
    const v = arr.filter(x => x != null);
    return v.length ? Math.max(...v) - Math.min(...v) : 0;
  };
  const hasSpread = spread(rated.map(w => w.body)) >= 0.25 || spread(rated.map(w => w.sweetness)) >= 0.25;
  const nextMissing = segs.find(s => !s.filled);
  return {
    segs,
    distinctTypes,
    hasSpread,
    unlocked: distinctTypes >= 3 && hasSpread,
    nextMissing
  };
}
function CoverageRing({
  segs,
  size = 104,
  stroke = 9
}) {
  const n = segs.length,
    r = (size - stroke) / 2,
    c = 2 * Math.PI * r,
    gap = 7,
    segLen = c / n - gap;
  return /*#__PURE__*/React.createElement("svg", {
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, segs.map((s, i) => /*#__PURE__*/React.createElement("circle", {
    key: s.key,
    cx: size / 2,
    cy: size / 2,
    r: r,
    fill: "none",
    stroke: s.filled ? s.col : C.line,
    strokeWidth: stroke,
    strokeDasharray: `${segLen} ${c - segLen}`,
    strokeDashoffset: -i * (c / n),
    strokeLinecap: "round",
    transform: `rotate(-90 ${size / 2} ${size / 2})`
  })));
}
function WineDNAUnlockCelebration({
  onDone
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: C.ink,
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      animation: 'dnaRise 1.1s ease both'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "brain",
    sz: 40,
    col: "#D4AF6A"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 34,
      fontWeight: 400,
      color: '#fff',
      fontFamily: C.serif,
      textAlign: 'center',
      animation: 'dnaRise 1.1s .1s ease both'
    }
  }, "WineDNA unlocked"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.55)',
      fontFamily: C.P,
      textAlign: 'center',
      lineHeight: 1.5,
      maxWidth: 280,
      animation: 'dnaRise 1.1s .2s ease both'
    }
  }, "Your palate has enough range now \u2014 Explore Next recommendations start today."), /*#__PURE__*/React.createElement("div", {
    onClick: onDone,
    style: {
      marginTop: 14,
      background: '#D4AF6A',
      borderRadius: 14,
      padding: '13px 28px',
      cursor: 'pointer',
      animation: 'dnaRise 1.1s .3s ease both'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "See WineDNA")), /*#__PURE__*/React.createElement("style", null, `@keyframes dnaRise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}`));
}
function _dominantRegion(wines) {
  const c = {};
  wines.forEach(w => {
    if (w.region) c[w.region] = (c[w.region] || 0) + 1;
  });
  const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= 2 ? top[0] : null;
}

/* ── QUIZ HUB / LEARN TAB ── */
function QuizHubScreen({
  nav,
  back,
  showPro
}) {
  const [xpData, setXpData] = React.useState(() => XPSystem.get());
  const [isPro, setIsPro] = React.useState(() => !!localStorage.getItem('vinterest_pro'));
  React.useEffect(() => {
    const h = () => setIsPro(true);
    window.addEventListener('vinterest:pro', h);
    return () => window.removeEventListener('vinterest:pro', h);
  }, []);
  const level = XPSystem.getLevel(xpData.total);
  const nextLvl = XPSystem.nextLevel(xpData.total);
  const prog = XPSystem.levelProgress(xpData.total);
  const article1Done = onRampDone(ON_RAMP[0].id);
  const wines = React.useMemo(() => WineHistory.getAll(), []);
  const coverage = React.useMemo(() => getCoverage(wines), [wines]);
  const [showUnlock, setShowUnlock] = React.useState(false);
  React.useEffect(() => {
    if (coverage.unlocked && !localStorage.getItem('vinterest_wineDNA_unlock_seen')) {
      localStorage.setItem('vinterest_wineDNA_unlock_seen', '1');
      setShowUnlock(true);
    }
  }, [coverage.unlocked]);
  const [genStubs, setGenStubs] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vinterest_gen_stubs') || 'null');
    } catch (e) {
      return null;
    }
  });
  React.useEffect(() => {
    if (!article1Done) return;
    const w = WineHistory.getAll();
    if (!w.length) return;
    const updated = ContentEngine.refreshShelf(w, 6);
    setGenStubs(updated);
  }, [article1Done]);
  if (showUnlock) return /*#__PURE__*/React.createElement(WineDNAUnlockCelebration, {
    onDone: () => {
      setShowUnlock(false);
      nav('profile');
    }
  });
  const zoneLabel = {
    fontSize: 15,
    fontWeight: 600,
    color: C.mid,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: C.P,
    marginBottom: 2
  };
  const unreadShelf = (genStubs || []).filter(s => !localStorage.getItem('vinterest_gen_article_' + s.id + '_done'));
  const nextOnRamp = ON_RAMP.find(a => !onRampDone(a.id));
  const nextBest = nextOnRamp ? {
    kind: 'onramp',
    title: nextOnRamp.title,
    sub: nextOnRamp.subtitle,
    readTime: nextOnRamp.readTime,
    action: () => {
      sessionStorage.setItem('vinterest_onramp_idx', String(ON_RAMP.indexOf(nextOnRamp)));
      nav('article');
    }
  } : unreadShelf.length ? {
    kind: 'shelf',
    stub: unreadShelf[0],
    title: unreadShelf[0].title,
    sub: unreadShelf[0].subtitle,
    action: () => {
      sessionStorage.setItem('vinterest_gen_article', JSON.stringify(unreadShelf[0]));
      nav('gen-article');
    }
  } : {
    kind: 'scan',
    title: 'Scan a bottle for your next read',
    sub: "Your shelf restocks based on what you try.",
    action: () => nav('camera')
  };
  const mastery = MasterySystem.summary();
  const region = _dominantRegion(wines);
  const wordsCount = VocabLedger.getAll().length;
  const startQuiz = cfg => {
    sessionStorage.setItem('vinterest_quiz_config2', JSON.stringify(cfg));
    nav('quiz');
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 0',
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      flex: 1,
      letterSpacing: '-0.4px'
    }
  }, "Learn"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      borderRadius: 20,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: _LEVEL_ICONS[level.badge] || 'wine',
    sz: 15,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, xpData.total, " XP"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, level.name), nextLvl && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, nextLvl.min - xpData.total, " XP to ", nextLvl.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 7,
      borderRadius: 4,
      background: C.offWhite,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 4,
      background: level.color,
      width: `${Math.round(prog * 100)}%`,
      transition: 'width .6s ease'
    }
  }))), !coverage.unlocked && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '2px 0 16px'
    }
  }, /*#__PURE__*/React.createElement(CoverageRing, {
    segs: coverage.segs
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, "Discovering your palate"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.4
    }
  }, coverage.nextMissing ? `You haven't rated a ${coverage.nextMissing.label.toLowerCase()} yet.` : 'Rate a wider spread of body and sweetness to unlock WineDNA.')))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: zoneLabel
  }, "Next Best Thing"), /*#__PURE__*/React.createElement("div", {
    onClick: nextBest.action,
    style: {
      background: C.ink,
      borderRadius: 16,
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: nextBest.kind === 'scan' ? 'camera' : nextBest.kind === 'onramp' ? 'book' : nextBest.stub.iconName || 'read',
    sz: 20,
    col: "rgba(255,255,255,0.7)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.4)',
      fontFamily: C.P,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      marginBottom: 3
    }
  }, nextBest.kind === 'onramp' ? 'On-Ramp · ' + nextBest.readTime : nextBest.kind === 'shelf' ? 'Quick Read · ' + nextBest.stub.readTime : 'Free forever'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      lineHeight: 1.3,
      marginBottom: 2
    }
  }, nextBest.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      lineHeight: 1.4
    }
  }, nextBest.sub)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: "rgba(255,255,255,0.3)"
  }))), article1Done && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: zoneLabel
  }, "Your Shelf"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, (!genStubs || !genStubs.length) && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px',
      textAlign: 'center',
      background: C.white,
      borderRadius: 14,
      border: `1px dashed ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, "Nothing on your shelf yet. Scan a bottle and we'll have something for you by morning.")), genStubs && genStubs.map((stub, i) => {
    const done = !!localStorage.getItem('vinterest_gen_article_' + stub.id + '_done');
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => {
        sessionStorage.setItem('vinterest_gen_article', JSON.stringify(stub));
        nav('gen-article');
      },
      style: {
        background: C.white,
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        border: `1px solid ${C.line}`,
        marginBottom: 8,
        opacity: done ? 0.7 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 44,
        borderRadius: 12,
        background: C.crSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: `1px solid ${C.crDim}`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: stub.iconName || 'read',
      sz: 20,
      col: C.cr
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 600,
        color: C.mid,
        fontFamily: C.P,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        marginBottom: 2
      }
    }, "Quick Read \xB7 ", stub.readTime), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.3
      }
    }, stub.title), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 2
      }
    }, stub.subtitle)), done ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: C.green,
        fontFamily: C.P
      }
    }, "\u2713") : /*#__PURE__*/React.createElement(Icon, {
      n: "chevron",
      sz: 13,
      col: C.mid
    }));
  }))), /*#__PURE__*/React.createElement("div", {
    style: zoneLabel
  }, "Test Yourself"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 8
    }
  }, !coverage.unlocked ? QUIZ_TOPICS.map((topic, ti) => /*#__PURE__*/React.createElement("div", {
    key: ti,
    onClick: () => startQuiz({
      mode: 'practice',
      topicId: topic.id
    }),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: topic.color + '15',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      border: `1px solid ${topic.color}25`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: topic.iconName || 'book',
    sz: 20,
    col: topic.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, topic.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, topic.desc)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: C.mid
  }))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: () => startQuiz({
      mode: 'concept'
    }),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: C.crSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "brain",
    sz: 20,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Concept Check"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, mastery.encountered, "/", mastery.total, " concepts met \xB7 ", mastery.mastered, " mastered")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: C.mid
  })), wordsCount >= 4 && /*#__PURE__*/React.createElement("div", {
    onClick: () => startQuiz({
      mode: 'words'
    }),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "read",
    sz: 20,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Words You've Met"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, wordsCount, " terms from bottles you've actually had")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: C.mid
  })), region && /*#__PURE__*/React.createElement("div", {
    onClick: () => startQuiz({
      mode: 'region',
      region
    }),
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      cursor: 'pointer',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "map",
    sz: 20,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your ", region, " Knowledge"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Grounded in bottles you've scanned from there")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: C.mid
  })))), /*#__PURE__*/React.createElement("div", {
    style: zoneLabel
  }, "Your Progress"), /*#__PURE__*/React.createElement("div", {
    onClick: () => isPro ? nav('mastery-map') : showPro('mastery-map'),
    style: {
      background: C.white,
      borderRadius: 16,
      border: `1px solid ${C.line}`,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "list",
    sz: 19,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Concept Mastery Map"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, mastery.mastered, "/", mastery.total, " mastered \u2014 see the whole picture")), !isPro && /*#__PURE__*/React.createElement(ProBadge, null), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 13,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: zoneLabel
  }, "Tracks"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      borderRadius: 16,
      border: `1px solid ${C.line}`,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      opacity: 0.6,
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 42,
      height: 42,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "list",
    sz: 19,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Multi-part courses"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Coming soon")), /*#__PURE__*/React.createElement(ProBadge, null)), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      localStorage.removeItem(XPSystem.KEY);
      setXpData(XPSystem.fresh());
    },
    style: {
      textAlign: 'center',
      padding: '8px',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      textDecoration: 'underline'
    }
  }, "Reset XP & progress")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }))));
}

/* ── CONCEPT MASTERY MAP (PRO) ── */
function MasteryMapScreen({
  nav,
  back
}) {
  const d = MasterySystem.get();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.4px'
    }
  }, "Concept Mastery Map")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, CONCEPTS.map(c => {
    const s = d[c.id] || {
      box: 0,
      right: 0,
      wrong: 0,
      mastered: false
    };
    const pct = Math.round(s.box / 5 * 100);
    return /*#__PURE__*/React.createElement("div", {
      key: c.id,
      style: {
        background: C.white,
        borderRadius: 14,
        border: `1px solid ${C.line}`,
        padding: '14px 16px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P
      }
    }, c.label), s.mastered ? /*#__PURE__*/React.createElement(Icon, {
      n: "check",
      sz: 16,
      col: C.green
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: C.mid,
        fontFamily: C.P
      }
    }, s.right || 0, " right \xB7 ", s.wrong || 0, " wrong")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 6,
        borderRadius: 3,
        background: C.offWhite,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        height: '100%',
        borderRadius: 3,
        background: s.mastered ? C.green : C.cr,
        width: `${pct}%`,
        transition: 'width .5s ease'
      }
    })));
  })));
}

/* ── Dynamic quiz assembly ── */
function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function _shuffleOpts(q) {
  const correctText = q.opts[q.a];
  const opts = _shuffle(q.opts);
  return {
    ...q,
    opts,
    a: opts.indexOf(correctText)
  };
}
function assembleConceptQuiz(conceptIds) {
  const d = MasterySystem.get();
  return conceptIds.map(cid => {
    const box = d[cid] ? d[cid].box : 0;
    const tier = MasterySystem.tierFor(box);
    const t = QExposure.pickTemplate(cid, tier);
    return t ? _shuffleOpts(t) : null;
  }).filter(Boolean);
}
function assembleWordsQuiz() {
  const terms = VocabLedger.getAll();
  const pool = _shuffle(terms).slice(0, 6);
  return pool.map(t => {
    const distractors = _shuffle(terms.filter(x => x.term !== t.term)).slice(0, 3).map(x => x.meaning);
    while (distractors.length < 3) distractors.push('None of these');
    const opts = _shuffle([t.meaning, ...distractors]);
    return {
      q: `What does "${t.term}" mean?`,
      opts,
      a: opts.indexOf(t.meaning),
      fact: null,
      conceptId: null,
      vocabTerm: t.term
    };
  });
}
function assembleRegionQuiz(region) {
  const info = KNOWLEDGE.regions[region];
  const wines = WineHistory.getAll();
  const regionWines = wines.filter(w => w.region === region);
  const otherWines = _shuffle(wines.filter(w => w.region && w.region !== region)).slice(0, 3);
  const otherRegionIds = Object.keys(KNOWLEDGE.regions).filter(r => r !== region);
  const qs = [];
  if (info) {
    const distractClass = [...new Set(otherRegionIds.map(r => KNOWLEDGE.regions[r].classification).filter(c => c && c !== info.classification))];
    if (distractClass.length >= 2) {
      const opts = _shuffle([info.classification, ..._shuffle(distractClass).slice(0, 3)]);
      qs.push({
        q: `What classification does ${region} wine fall under?`,
        opts,
        a: opts.indexOf(info.classification),
        fact: `${region} (${info.country}): ${info.classification}.`,
        conceptId: null,
        vocabTerm: null
      });
    }
    if (info.keyGrapes && info.keyGrapes[0]) {
      const correct = info.keyGrapes[0];
      const distractGrapes = [...new Set(otherRegionIds.flatMap(r => KNOWLEDGE.regions[r].keyGrapes || []).filter(g => g && !info.keyGrapes.includes(g)))];
      if (distractGrapes.length >= 2) {
        const opts = _shuffle([correct, ..._shuffle(distractGrapes).slice(0, 3)]);
        qs.push({
          q: `Which grape is the backbone of ${region}?`,
          opts,
          a: opts.indexOf(correct),
          fact: `${region}'s key grape(s): ${info.keyGrapes.join(', ')}.`,
          conceptId: null,
          vocabTerm: null
        });
      }
    }
    if (info.climate) {
      const distractClimate = _shuffle(otherRegionIds.map(r => KNOWLEDGE.regions[r].climate).filter(Boolean)).slice(0, 3);
      if (distractClimate.length >= 2) {
        const opts = _shuffle([info.climate, ...distractClimate]);
        qs.push({
          q: `Which climate description matches ${region}?`,
          opts,
          a: opts.indexOf(info.climate),
          fact: `${region}: ${info.climate}.`,
          conceptId: null,
          vocabTerm: null
        });
      }
    }
  }
  if (regionWines.length && otherWines.length >= 3) {
    const target = _shuffle(regionWines)[0];
    const opts = _shuffle([target.name, ...otherWines.map(w => w.name)]);
    qs.push({
      q: `Which of these bottles in your cellar is from ${region}?`,
      opts,
      a: opts.indexOf(target.name),
      fact: `${target.name} is the ${region} bottle in your history.`,
      conceptId: null,
      vocabTerm: null
    });
  }
  return _shuffle(qs).map(q => _shuffleOpts(q));
}
function assemblePracticeQuiz(topicId) {
  const topic = QUIZ_TOPICS.find(t => t.id === topicId) || QUIZ_TOPICS[0];
  const qs = _shuffle(topic.questions.beginner || []).slice(0, 6);
  return qs.map(q => _shuffleOpts(q));
}

/* ── QUIZ SCREEN ── */
function QuizScreen({
  nav,
  back
}) {
  const config = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_quiz_config2') || 'null');
    } catch (e) {
      return null;
    }
  }, []);
  const mode = config?.mode || 'concept';
  const buildQs = React.useCallback(() => {
    if (mode === 'practice') return assemblePracticeQuiz(config.topicId);
    if (mode === 'words') return assembleWordsQuiz();
    if (mode === 'region') return assembleRegionQuiz(config.region);
    return assembleConceptQuiz(MasterySystem.selectConcepts(6));
  }, [mode, config]);
  const [allQs, setAllQs] = React.useState(buildQs);
  const [qIdx, setQIdx] = React.useState(0);
  const [selected, setSelected] = React.useState(null);
  const [phase, setPhase] = React.useState(allQs.length ? 'question' : 'empty');
  const [streak, setStreak] = React.useState(0);
  const [xpGained, setXpGained] = React.useState(0);
  const [results, setResults] = React.useState([]);
  const scrollRef = React.useRef(null);
  const title = mode === 'practice' ? (QUIZ_TOPICS.find(t => t.id === config.topicId) || QUIZ_TOPICS[0]).label : mode === 'words' ? "Words You've Met" : mode === 'region' ? 'Your ' + config.region + ' Knowledge' : 'Concept Check';
  const q = allQs[qIdx];
  function choose(i) {
    if (phase !== 'question') return;
    setSelected(i);
    setPhase('feedback');
    const correct = i === q.a;
    setStreak(s => correct ? s + 1 : 0);
    let gained = 0;
    if (q.conceptId) {
      const r = MasterySystem.recordResult(q.conceptId, correct);
      if (r.justMastered) {
        const a = XPSystem.award([{
          type: 'concept_mastered',
          conceptId: q.conceptId
        }]);
        gained += a.filter(x => !x.levelUp).reduce((s, x) => s + x.amount, 0);
        XPSystem.toast(a);
      }
    }
    if (q.vocabTerm) VocabLedger.recordTest(q.vocabTerm, correct);
    if (gained) {
      setXpGained(xp => xp + gained);
    }
    setResults(rs => [...rs, {
      correct,
      qText: q.q,
      selectedOpt: q.opts[i],
      correctOpt: q.opts[q.a],
      fact: q.fact
    }]);
  }
  function advance() {
    if (phase !== 'feedback') return;
    if (qIdx + 1 >= allQs.length) {
      const finalScore = results.filter(r => r.correct).length + (selected === q.a ? 0 : 0);
      const boxes = allQs.filter(x => x.conceptId).map(x => {
        const d = MasterySystem.get();
        return d[x.conceptId] ? d[x.conceptId].box : 1;
      });
      const avgBox = boxes.length ? boxes.reduce((s, b) => s + b, 0) / boxes.length / 5 : 0;
      const quizKey = mode === 'practice' ? 'onramp_' + config.topicId : mode + '_' + Date.now();
      const a2 = XPSystem.award([{
        type: 'quiz_complete',
        quizKey,
        derivedDifficulty: avgBox
      }]);
      const g2 = a2.filter(x => !x.levelUp).reduce((s, a) => s + a.amount, 0);
      setXpGained(xp => xp + g2);
      XPSystem.toast(a2);
      setPhase('results');
    } else {
      setQIdx(i => i + 1);
      setSelected(null);
      setPhase('question');
    }
  }
  function newQuiz() {
    setAllQs(buildQs());
    setQIdx(0);
    setSelected(null);
    setPhase('question');
    setStreak(0);
    setXpGained(0);
    setResults([]);
  }
  if (phase === 'empty') return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      textAlign: 'center'
    }
  }, "Nothing to test yet \u2014 scan and rate a few more bottles first."), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: () => nav('learn')
  }, "Back to Learn"));
  if (phase === 'results') {
    const finalScore = results.filter(r => r.correct).length;
    const pct = Math.round(finalScore / allQs.length * 100);
    const msg = pct === 100 ? 'Perfect!' : pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work!' : 'Keep practising';
    return /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.cr,
        padding: '48px 24px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: pct === 100 ? 'trophy' : pct >= 80 ? 'star' : pct >= 60 ? 'check' : 'book',
      sz: 44,
      col: "#fff"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 28,
        fontWeight: 800,
        color: '#fff',
        fontFamily: C.P
      }
    }, msg), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        color: 'rgba(255,255,255,0.8)',
        fontFamily: C.P
      }
    }, title), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 16,
        marginTop: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36,
        fontWeight: 800,
        color: '#fff',
        fontFamily: C.P
      }
    }, finalScore, "/", allQs.length), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: C.P
      }
    }, "Correct")), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 1,
        background: 'rgba(255,255,255,0.25)'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'center'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 36,
        fontWeight: 800,
        color: '#fff',
        fontFamily: C.P
      }
    }, "+", xpGained), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        fontFamily: C.P
      }
    }, "XP earned")))), /*#__PURE__*/React.createElement("div", {
      ref: scrollRef,
      style: {
        flex: 1,
        overflowY: 'auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.mid,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: C.P
      }
    }, "Review"), results.map((r, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        background: r.correct ? C.greenBg : '#FFF0F0',
        borderRadius: 12,
        padding: '10px 14px',
        border: `1px solid ${r.correct ? C.green + '30' : '#F5A0A0'}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        flexShrink: 0
      }
    }, r.correct ? '✓' : '✗'), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.3
      }
    }, r.qText), !r.correct && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: '#C0392B',
        fontFamily: C.P,
        marginTop: 3
      }
    }, "Your answer: ", r.selectedOpt), !r.correct && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.green,
        fontFamily: C.P
      }
    }, "Correct: ", r.correctOpt), r.fact && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 4,
        lineHeight: 1.4,
        fontStyle: 'italic'
      }
    }, r.fact))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 8,
        marginTop: 4
      }
    }, /*#__PURE__*/React.createElement(Btn, {
      full: true,
      style: {
        flex: 1
      },
      onClick: () => {
        if (pct < 100) {
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
        } else nav('learn');
      }
    }, pct < 100 ? 'See what you missed' : 'Practice more'), /*#__PURE__*/React.createElement(Btn, {
      primary: true,
      full: true,
      style: {
        flex: 1
      },
      onClick: newQuiz
    }, "New quiz")), /*#__PURE__*/React.createElement("div", {
      style: {
        height: 8
      }
    }))));
  }
  const progress = (qIdx + 1) / allQs.length;
  const optColors = selected === null ? q.opts.map(() => ({
    bg: C.white,
    border: C.line,
    text: C.ink
  })) : q.opts.map((_, i) => {
    if (i === q.a) return {
      bg: C.greenBg,
      border: C.green,
      text: C.green
    };
    if (i === selected && selected !== q.a) return {
      bg: '#FFF0F0',
      border: '#E88080',
      text: '#C0392B'
    };
    return {
      bg: C.white,
      border: C.line,
      text: C.ink
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 12px',
      flexShrink: 0,
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 14,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, streak >= 2 && /*#__PURE__*/React.createElement(Icon, {
    n: "flame",
    sz: 18,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, qIdx + 1, "/", allQs.length))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      borderRadius: 3,
      background: C.offWhite,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '100%',
      borderRadius: 3,
      background: C.cr,
      width: `${Math.round(progress * 100)}%`,
      transition: 'width .4s ease'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    onClick: phase === 'feedback' ? advance : undefined,
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '20px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      cursor: phase === 'feedback' ? 'pointer' : 'default'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      lineHeight: 1.4
    }
  }, q.q), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      marginTop: 4
    }
  }, q.opts.map((opt, i) => {
    const s = optColors[i] || {
      bg: C.white,
      border: C.line,
      text: C.ink
    };
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => choose(i),
      style: {
        padding: '15px 16px',
        borderRadius: 14,
        border: `2px solid ${s.border}`,
        background: s.bg,
        cursor: phase === 'question' ? 'pointer' : 'default',
        transition: 'all .2s',
        display: 'flex',
        alignItems: 'center',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 28,
        height: 28,
        borderRadius: 14,
        background: s.border + '25',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: s.text,
        fontFamily: C.P
      }
    }, phase === 'feedback' && i === q.a ? '✓' : phase === 'feedback' && i === selected && selected !== q.a ? '✗' : String.fromCharCode(65 + i))), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 500,
        color: s.text,
        fontFamily: C.P,
        lineHeight: 1.35
      }
    }, opt));
  })), phase === 'feedback' && /*#__PURE__*/React.createElement("div", {
    style: {
      animation: 'fadeIn .3s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: selected === q.a ? C.greenBg : '#FFF8F0',
      borderRadius: 14,
      padding: '12px 14px',
      border: `1px solid ${selected === q.a ? C.green + '40' : '#F5C07040'}`,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: selected === q.a ? C.green : '#B87000',
      fontFamily: C.P,
      marginBottom: 4
    }
  }, selected === q.a ? 'Correct!' : 'Not quite'), q.fact && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, q.fact)), /*#__PURE__*/React.createElement("div", {
    onClick: e => {
      e.stopPropagation();
      advance();
    },
    style: {
      background: C.cr,
      borderRadius: 14,
      padding: '15px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 6px 22px ${C.cr}45`,
      userSelect: 'none',
      WebkitUserSelect: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, qIdx + 1 >= allQs.length ? 'See Results →' : 'Next Question →'))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 12
    }
  })), /*#__PURE__*/React.createElement("style", null, `@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}`));
}
Object.assign(window, {
  QuizHubScreen,
  QuizScreen,
  MasteryMapScreen
});

/* ---- pwa-screens-aux.jsx (precompiled) ---- */
/* Vinterest PWA — Taste Profile, Restaurant, Learn screens */

function TasteProfileScreen({
  nav,
  back,
  showPro
}) {
  const [tab, setTab] = React.useState(0);
  const [genScripts, setGenScripts] = React.useState({});
  const [scriptLength, setScriptLength] = React.useState(localStorage.getItem('vinterest_script_length') || 'long');
  const [generating, setGenerating] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const allWines = React.useMemo(() => WineHistory.getAll(), []);
  const profile = React.useMemo(() => WineHistory.getProfile(), []);
  function winesOfType(typeKey) {
    return allWines.filter(w => (w.type || '').toLowerCase().replace('é', 'e') === typeKey);
  }
  function deriveTagsFromWines(wines, defaults) {
    const counts = {};
    wines.forEach(w => (w.tasting_notes || []).forEach(t => {
      counts[t] = (counts[t] || 0) + 1;
    }));
    const derived = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
    return derived.length >= 3 ? derived : defaults;
  }
  const cats = [{
    col: '#8B1A2F',
    label: 'Reds',
    typeKey: 'red',
    defaultTags: ['Full Body', 'Earthy', 'Dark Fruit', 'High Tannins', 'Dry', 'Cedar'],
    pct: profile.total ? Math.round(profile.redPct * 100) : 0
  }, {
    col: '#B8963E',
    label: 'Whites',
    typeKey: 'white',
    defaultTags: ['Crisp', 'Mineral', 'Citrus', 'Dry', 'Light Body', 'Herbaceous'],
    pct: profile.total ? Math.round(profile.whitePct * 100) : 0
  }, {
    col: '#C47A8A',
    label: 'Rosé',
    typeKey: 'rose',
    defaultTags: ['Bone Dry', 'Delicate', 'Red Fruit', 'Light Body', 'Crisp'],
    pct: profile.total ? Math.round(profile.rosePct * 100) : 0
  }, {
    col: '#5E8FA8',
    label: 'Sparkling',
    typeKey: 'sparkling',
    defaultTags: ['Brut', 'Brioche', 'Citrus', 'Fine Bubbles', 'Toasty'],
    pct: profile.total ? Math.round(profile.sparklingPct * 100) : 0
  }];
  const c = cats[tab];
  const tabWines = winesOfType(c.typeKey);
  const topWines = tabWines.slice(0, 3);
  const displayTags = deriveTagsFromWines(tabWines, c.defaultTags);
  const displayScript = genScripts[c.typeKey] || null;
  const isGenerating = generating === c.typeKey;

  // Auto-generate script from real wine data when tab opens
  React.useEffect(() => {
    if (!tabWines.length) return;
    const keyLong = `vinterest_script_long_${c.typeKey}_n${tabWines.length}`;
    const keyShort = `vinterest_script_short_${c.typeKey}_n${tabWines.length}`;
    const cacheKey = scriptLength === 'long' ? keyLong : keyShort;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setGenScripts(s => ({
        ...s,
        [c.typeKey]: cached
      }));
      return;
    }
    if (generating === c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList = tabWines.slice(0, 8).map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''} from ${w.region || w.country || 'unknown'}`).join('; ');
    const lengthInstructions = scriptLength === 'short' ? '1 sentence, ultra-concise (under 20 words), and mention your typical budget range' : '2 sentences max';
    const prompt = `I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a ${lengthInstructions} natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      const script = text.trim();
      localStorage.setItem(cacheKey, script);
      setGenScripts(s => ({
        ...s,
        [c.typeKey]: script
      }));
    }).catch(() => {}).finally(() => setGenerating(null));
  }, [tab, allWines.length, scriptLength]);
  if (allWines.length === 0) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '18px 20px',
      borderBottom: '1px solid ' + C.line,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Profile")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 88,
      height: 88,
      borderRadius: 22,
      background: C.crSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid ' + C.crDim
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 42,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8,
      lineHeight: 1.2
    }
  }, "Your profile is waiting"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.65,
      maxWidth: 280
    }
  }, "Scan and rate bottles to build your personal taste profile. The more you scan, the smarter it gets.")), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => nav('camera')
  }, "Scan Your First Bottle"), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      cursor: 'pointer',
      width: '100%'
    },
    onClick: () => nav('learn')
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 24
    }
  }, "\uD83C\uDF93"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Take a quiz first"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 1
    }
  }, "Earn XP while you build your collection")), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 14,
    col: C.mid
  }))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your Taste Profile"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, allWines.length > 0 ? `${allWines.length} wine${allWines.length !== 1 ? 's' : ''} scanned` : 'No wines scanned yet'))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      background: C.white,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, cats.map((ct, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setTab(i),
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '10px 4px',
      cursor: 'pointer',
      borderBottom: i === tab ? `2px solid ${ct.col}` : '2px solid transparent',
      marginBottom: -1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 8,
      height: 8,
      borderRadius: 4,
      background: ct.col,
      margin: '0 auto 3px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: i === tab ? 700 : 400,
      color: i === tab ? ct.col : C.mid,
      fontFamily: C.P
    }
  }, ct.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, ct.pct > 0 ? `${ct.pct}%` : '—')))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      background: c.col + '0D',
      border: `1.5px solid ${c.col}30`,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "message",
    sz: 15,
    col: c.col
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your ", c.label, " Script")), tabWines.length > 0 && !isGenerating && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      background: C.offWhite,
      borderRadius: 6,
      padding: '3px 4px',
      border: `1px solid ${C.line}`
    }
  }, ['short', 'long'].map(len => /*#__PURE__*/React.createElement("div", {
    key: len,
    onClick: () => {
      setScriptLength(len);
      localStorage.setItem('vinterest_script_length', len);
    },
    style: {
      padding: '4px 8px',
      borderRadius: 4,
      background: scriptLength === len ? C.cr : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: scriptLength === len ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, len.charAt(0).toUpperCase() + len.slice(1)))))), tabWines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.6
    }
  }, "Scan and rate some ", c.label.toLowerCase(), " to generate your personalised sommelier script."), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true,
    onClick: () => nav('camera'),
    style: {
      background: c.col,
      boxShadow: `0 3px 12px ${c.col}40`
    }
  }, "Scan a Bottle")) : isGenerating ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '6px 0 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 9,
      border: '2px solid rgba(0,0,0,0.1)',
      borderTopColor: c.col,
      animation: 'vspin 0.8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Writing your personalised script\u2026")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.6,
      marginBottom: 10
    }
  }, displayScript || 'Generating your script…'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true,
    onClick: () => {
      try {
        navigator.clipboard.writeText((displayScript || '').replace(/"/g, ''));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {}
    },
    style: {
      background: c.col,
      boxShadow: `0 3px 12px ${c.col}40`
    }
  }, copied ? 'Copied!' : 'Copy Script'), /*#__PURE__*/React.createElement(Btn, {
    small: true,
    onClick: () => {
      const key = `vinterest_script_v2_${c.typeKey}_n${tabWines.length}`;
      localStorage.removeItem(key);
      setGenScripts(s => {
        const n = {
          ...s
        };
        delete n[c.typeKey];
        return n;
      });
    }
  }, "Regenerate")))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Flavour Profile"), tabWines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Will populate from your scanned wines") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 5
    }
  }, displayTags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      padding: '4px 10px',
      borderRadius: 20,
      background: i < 3 ? c.col + '15' : C.offWhite,
      color: i < 3 ? c.col : C.ink2,
      fontSize: 15,
      fontWeight: 500,
      fontFamily: C.P,
      border: `1px solid ${i < 3 ? c.col + '30' : C.line}`
    }
  }, t)))), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px 8px',
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your Top ", c.label), topWines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px 14px',
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Scan some ", c.label.toLowerCase(), " to see your top bottles here") : topWines.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => {
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: false,
        wine: w,
        confidence: 0.9
      }));
      nav('detail');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '9px 14px',
      borderTop: `1px solid ${C.line}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 44,
      borderRadius: 6,
      background: c.col + '12',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 14,
    col: c.col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 2
    }
  }, w.region && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, w.region), w.rating > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.line,
      fontFamily: C.P
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.amber,
      fontFamily: C.P
    }
  }, w.rating, "/100")))), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 12,
    col: C.mid
  })))), (() => {
    const xd = XPSystem.get();
    const lv = XPSystem.getLevel(xd.total);
    const nx = XPSystem.nextLevel(xd.total);
    const pg = XPSystem.levelProgress(xd.total);
    return /*#__PURE__*/React.createElement(Card, {
      style: {
        padding: 12
      },
      onClick: () => nav('learn')
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 600,
        color: C.ink,
        fontFamily: C.P
      }
    }, lv.badge, " ", lv.name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.cr,
        fontWeight: 600,
        fontFamily: C.P
      }
    }, xd.total, " XP")), /*#__PURE__*/React.createElement(Prog, {
      val: pg,
      h: 7,
      col: lv.color
    }), nx && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 4
      }
    }, nx.min - xd.total, " XP to ", nx.name, " \u2014 tap to quiz"));
  })(), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 10
    }
  }, "Data Backup"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    style: {
      flex: 1,
      fontSize: 15
    },
    onClick: () => {
      const data = {
        wines: WineHistory.getAll(),
        xp: XPSystem.get(),
        exported: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vinterest-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, "\u2B07 Export"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    style: {
      flex: 1,
      fontSize: 15
    },
    onClick: () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const d = JSON.parse(ev.target.result);
            if (d.wines) WineHistory.save(d.wines);
            if (d.xp) localStorage.setItem(XPSystem.KEY, JSON.stringify(d.xp));
            alert('Restored! ' + (d.wines || []).length + ' wines imported.');
            window.location.reload();
          } catch (err) {
            alert('Could not read backup file.');
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    }
  }, "\u2B06 Import")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 8,
      lineHeight: 1.5
    }
  }, "Export saves your wines & XP to a JSON file on your phone. Import restores from a previous backup.")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '12px 0 4px',
      opacity: 0.45
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Vinterest v1.0.38")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))), /*#__PURE__*/React.createElement("style", null, `@keyframes vspin{to{transform:rotate(360deg)}} .sc-scroll::-webkit-scrollbar{display:none} .sc-scroll{scrollbar-width:none}`));
}
function MyWinesScreen({
  nav,
  back
}) {
  const [filter, setFilter] = React.useState('all');
  const [sort, setSort] = React.useState('recent');
  const [wines, setWines] = React.useState(() => WineHistory.getAll());
  const [activePills, setActivePills] = React.useState([]);
  const typeColors = {
    red: '#8B1A2F',
    white: '#B8963E',
    rosé: '#C47A8A',
    rose: '#C47A8A',
    sparkling: '#5E8FA8',
    orange: '#C1652B',
    dessert: '#8A5A2B',
    fortified: '#5C2A1E'
  };
  const filtered = wines.filter(w => {
    if (filter !== 'all') {
      const t = (w.type || '').toLowerCase().replace('é', 'e');
      if (t !== filter) return false;
    }
    if (activePills.length === 0) return true;
    return activePills.every(p => {
      if (p.type === 'grape') return w.grapes && w.grapes.includes(p.value);
      if (p.type === 'region') return w.region === p.value;
      if (p.type === 'country') return w.country === p.value;
      if (p.type === 'vintage') return w.vintage === p.value;
      return true;
    });
  }).sort((a, b) => {
    if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
    if (sort === 'name') return (a.name || '').localeCompare(b.name || '');
    return new Date(b.last_scanned || b.scanned_at || 0) - new Date(a.last_scanned || a.scanned_at || 0);
  });
  const togglePill = (type, value) => {
    const existing = activePills.find(p => p.type === type && p.value === value);
    if (existing) {
      setActivePills(activePills.filter(p => !(p.type === type && p.value === value)));
    } else {
      setActivePills([...activePills, {
        type,
        value
      }]);
    }
  };
  const removePill = (type, value) => {
    setActivePills(activePills.filter(p => !(p.type === type && p.value === value)));
  };
  const TYPE_COLS = {
    all: C.cr,
    red: '#8B1A2F',
    white: '#B8963E',
    rose: '#C47A8A',
    sparkling: '#5E8FA8',
    orange: '#C1652B',
    dessert: '#8A5A2B',
    fortified: '#5C2A1E'
  };
  const filterTabs = [{
    k: 'all',
    l: 'All'
  }, {
    k: 'red',
    l: 'Reds'
  }, {
    k: 'white',
    l: 'Whites'
  }, {
    k: 'rose',
    l: 'Rosé'
  }, {
    k: 'sparkling',
    l: 'Sparkling'
  }, {
    k: 'orange',
    l: 'Orange'
  }, {
    k: 'dessert',
    l: 'Dessert'
  }, {
    k: 'fortified',
    l: 'Fortified'
  }];
  const colFor = w => typeColors[(w.type || 'red').toLowerCase().replace('é', 'e')] || C.cr;

  /* Stats for current filter */
  const statsRated = filtered.filter(w => w.rating > 0);
  const statsAvgRating = statsRated.length ? Math.round(statsRated.reduce((s, w) => s + w.rating, 0) / statsRated.length) : 0;
  const statsCountries = new Set(filtered.map(w => w.country).filter(Boolean)).size;
  const statsPrices = filtered.filter(w => w.price_usd > 0);
  const statsAvgPrice = statsPrices.length ? Math.round(statsPrices.reduce((s, w) => s + w.price_usd, 0) / statsPrices.length) : 0;
  const activeCol = TYPE_COLS[filter] || C.cr;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 0',
      flexShrink: 0,
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "My Wines"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, wines.length, " ", wines.length === 1 ? 'bottle' : 'bottles', " scanned")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      background: C.offWhite,
      borderRadius: 8,
      overflow: 'hidden',
      border: `1px solid ${C.line}`
    }
  }, [{
    k: 'recent',
    l: 'Recent'
  }, {
    k: 'rating',
    l: 'Top'
  }, {
    k: 'name',
    l: 'A–Z'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setSort(s.k),
    style: {
      padding: '6px 10px',
      background: sort === s.k ? C.cr : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: sort === s.k ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, s.l))))), activePills.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 12,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, activePills.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 20,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P
    }
  }, p.value), /*#__PURE__*/React.createElement("div", {
    onClick: () => removePill(p.type, p.value),
    style: {
      width: 18,
      height: 18,
      borderRadius: 9,
      background: C.cr,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      color: '#fff',
      fontSize: 12,
      fontWeight: 700
    }
  }, "\xD7")))), wines.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderBottom: `1px solid ${C.line}`,
      padding: '10px 0',
      marginBottom: 0
    }
  }, [{
    val: filtered.length,
    label: filter === 'all' ? 'All Bottles' : filterTabs.find(f => f.k === filter)?.l || filter,
    col: activeCol
  }, {
    val: statsAvgRating ? `${statsAvgRating}/100` : '—',
    label: 'Avg Rating',
    col: C.amber
  }, {
    val: statsCountries || '—',
    label: 'Countries',
    col: C.green
  }, ...(statsAvgPrice > 0 ? [{
    val: `${statsAvgPrice}`,
    label: 'Avg Price',
    col: C.ink2
  }] : [])].map((s, i, arr) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      textAlign: 'center',
      borderRight: i < arr.length - 1 ? `1px solid ${C.line}` : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: s.col,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, s.val), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 3
    }
  }, s.label)))), /*#__PURE__*/React.createElement("div", {
    className: "sc-scroll",
    style: {
      display: 'flex',
      gap: 0,
      marginBottom: 0,
      overflowX: 'auto',
      WebkitOverflowScrolling: 'touch'
    }
  }, filterTabs.map((t, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setFilter(t.k),
    style: {
      flex: '0 0 auto',
      textAlign: 'center',
      padding: '8px 14px',
      cursor: 'pointer',
      borderBottom: filter === t.k ? `2px solid ${TYPE_COLS[t.k] || C.cr}` : '2px solid transparent',
      marginBottom: -1,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: filter === t.k ? 700 : 400,
      color: filter === t.k ? TYPE_COLS[t.k] || C.cr : C.mid,
      fontFamily: C.P
    }
  }, t.l))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: 40,
      textAlign: 'center',
      gap: 12
    }
  }, wines.length === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 48
    }
  }, "\uD83C\uDF77"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "No wines yet"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, "Scan your first bottle to start building your collection"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: () => nav('camera')
  }, "Scan a Bottle")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 4
    }
  }, "\uD83D\uDD0D"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P
    }
  }, "No ", filter, " wines scanned yet"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, filtered.map((w, i) => {
    const col = colFor(w);
    const date = w.last_scanned || w.scanned_at;
    const dateStr = date ? new Date(date).toLocaleDateString('en', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) : '';
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      style: {
        padding: 12,
        cursor: 'pointer'
      },
      onClick: () => {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: false,
          wine: w,
          confidence: 0.9,
          existingRating: w.rating || 0
        }));
        nav('detail');
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 44,
        height: 60,
        borderRadius: 8,
        background: col + '15',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${col}25`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "wine",
      sz: 20,
      col: col
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.2,
        flex: 1
      }
    }, w.name || 'Unknown Wine'), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: col,
        fontFamily: C.P,
        textTransform: 'capitalize',
        flexShrink: 0,
        padding: '2px 8px',
        borderRadius: 20,
        background: col + '12'
      }
    }, w.type || 'Red')), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 4,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }
    }, w.grapes && w.grapes.length > 0 && /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        togglePill('grape', w.grapes[0]);
      },
      style: {
        padding: '4px 10px',
        borderRadius: 20,
        background: activePills.find(p => p.type === 'grape' && p.value === w.grapes[0]) ? '#D5C0E840' : '#D5C0E815',
        border: `1px solid ${activePills.find(p => p.type === 'grape' && p.value === w.grapes[0]) ? '#9B4C6F' : '#9B4C6F40'}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: activePills.find(p => p.type === 'grape' && p.value === w.grapes[0]) ? '#9B4C6F' : C.ink2,
        fontFamily: C.P
      }
    }, w.grapes[0])), w.region && /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        togglePill('region', w.region);
      },
      style: {
        padding: '4px 10px',
        borderRadius: 20,
        background: activePills.find(p => p.type === 'region' && p.value === w.region) ? '#E8D5C440' : '#E8D5C415',
        border: `1px solid ${activePills.find(p => p.type === 'region' && p.value === w.region) ? '#B8963E' : '#B8963E40'}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: activePills.find(p => p.type === 'region' && p.value === w.region) ? '#B8963E' : C.ink2,
        fontFamily: C.P
      }
    }, w.region)), w.country && /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        togglePill('country', w.country);
      },
      style: {
        padding: '4px 10px',
        borderRadius: 20,
        background: activePills.find(p => p.type === 'country' && p.value === w.country) ? '#C5E5E240' : '#C5E5E215',
        border: `1px solid ${activePills.find(p => p.type === 'country' && p.value === w.country) ? '#5E8FA8' : '#5E8FA840'}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: activePills.find(p => p.type === 'country' && p.value === w.country) ? '#5E8FA8' : C.ink2,
        fontFamily: C.P
      }
    }, w.country)), w.vintage && /*#__PURE__*/React.createElement("div", {
      onClick: e => {
        e.stopPropagation();
        togglePill('vintage', w.vintage);
      },
      style: {
        padding: '4px 10px',
        borderRadius: 20,
        background: activePills.find(p => p.type === 'vintage' && p.value === w.vintage) ? C.greenBg : C.greenBg.replace('0.15', '0.08'),
        border: `1px solid ${activePills.find(p => p.type === 'vintage' && p.value === w.vintage) ? C.green : C.green + '40'}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 500,
        color: activePills.find(p => p.type === 'vintage' && p.value === w.vintage) ? C.green : C.ink2,
        fontFamily: C.P
      }
    }, w.vintage))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginTop: 5
      }
    }, w.rating > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 2,
        padding: '2px 8px',
        borderRadius: 20,
        background: C.amberBg
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontWeight: 700,
        color: C.amber,
        fontFamily: C.P
      }
    }, w.rating), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P
      }
    }, "/100")), w.times_consumed > 1 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P
      }
    }, "\xD7", w.times_consumed), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginLeft: 'auto'
      }
    }, dateStr)), w.tasting_notes?.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 3,
        fontStyle: 'italic'
      }
    }, w.tasting_notes.slice(0, 3).join(' · ')))), (!w.rating || w.rating === 0) && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px solid ${C.line}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        flexShrink: 0
      }
    }, "Rate:"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 4,
        flex: 1
      }
    }, [20, 40, 60, 80, 100].map(p => /*#__PURE__*/React.createElement("div", {
      key: p,
      onClick: e => {
        e.stopPropagation();
        WineHistory.rate(w.name, w.vintage, p);
        setWines(WineHistory.getAll());
      },
      style: {
        flex: 1,
        padding: '5px 2px',
        borderRadius: 7,
        border: `1px solid ${C.line}`,
        textAlign: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.mid,
        fontFamily: C.P
      }
    }, p))))));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── RESTAURANT SCREEN ── */
function RestaurantScreen({
  nav,
  back
}) {
  const [step, setStep] = React.useState(0); // 0=entry 1=setup 2=script
  const [budget, setBudget] = React.useState(1);
  const [foods, setFoods] = React.useState([0]);
  const foodItems = ['Red Meat', 'Poultry', 'Seafood', 'Pasta', 'Salad', 'Cheese', 'Spicy Food'];
  const toggleFood = i => setFoods(f => f.includes(i) ? f.filter(x => x !== i) : [...f, i]);
  if (step === 2) return /*#__PURE__*/React.createElement(RestaurantScript, {
    back: () => setStep(1)
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: step > 0 ? () => setStep(s => s - 1) : back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, step === 0 ? 'Restaurant Mode' : 'Your Preferences')), step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '20px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.ink,
      borderRadius: 20,
      padding: '20px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "fork",
    sz: 32,
    col: "rgba(255,255,255,0.5)",
    style: {
      margin: '0 auto 10px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Dining Tonight?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      marginTop: 4
    }
  }, "Get confident wine recommendations tailored to your meal and budget.")), [{
    i: 'camera',
    col: C.cr,
    t: 'Scan Wine List',
    s: 'Take a photo of the menu for instant picks',
    action: () => setStep(1)
  }, {
    i: 'message',
    col: '#B06C00',
    t: 'Quick Script',
    s: 'No menu? Get a script to say to the sommelier',
    action: () => setStep(1)
  }].map((a, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    onClick: a.action,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 11,
      background: a.col + '12',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: a.i,
    sz: 22,
    col: a.col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, a.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, a.s)), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 14,
    col: C.mid
  }))))), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "Budget per bottle"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ['$20–40', '$40–70', '$70–120', '$120+'].map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => setBudget(i),
    style: {
      flex: 1,
      padding: '10px 4px',
      borderRadius: 10,
      border: `1.5px solid ${i === budget ? C.cr : C.line}`,
      background: i === budget ? C.crSoft : '#fff',
      textAlign: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: i === budget ? C.cr : C.ink2,
      fontFamily: C.P
    }
  }, b))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8
    }
  }, "What are you eating?"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6
    }
  }, foodItems.map((f, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    onClick: () => toggleFood(i),
    style: {
      padding: '6px 12px',
      borderRadius: 20,
      background: foods.includes(i) ? C.cr : '#fff',
      color: foods.includes(i) ? '#fff' : C.mid,
      border: `1px solid ${foods.includes(i) ? C.cr : C.line}`,
      fontSize: 16,
      fontWeight: 500,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, f)))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => setStep(2)
  }, "Get Recommendations"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}
function RestaurantScript({
  back
}) {
  const copied = React.useRef(false);
  const [c, setC] = React.useState(false);
  const script = '"I\'m looking for a full-bodied red in the $40–70 range. I typically enjoy wines with earthy notes and structured tannins — Bordeaux blends are a favourite. I\'m having the steak tonight. What would you recommend?"';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your Script"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Icon, {
    n: "share",
    sz: 18,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.crSoft,
      border: `1.5px solid ${C.crDim}`,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "message",
    sz: 16,
    col: C.cr
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Say This to Your Server")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6,
      fontStyle: 'italic',
      marginBottom: 10
    }
  }, script), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true,
    onClick: () => {
      try {
        navigator.clipboard.writeText(script.replace(/"/g, ''));
        setC(true);
        setTimeout(() => setC(false), 2000);
      } catch (e) {}
    },
    style: {
      width: '100%'
    }
  }, c ? 'Copied!' : 'Copy Script')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Best Matches on This List"), [{
    name: 'Clos du Val Cabernet',
    sub: 'Napa Valley · $58',
    score: 96,
    note: 'Best match · In your budget'
  }, {
    name: 'Barolo Giacomo Conterno',
    sub: 'Piedmont · $65',
    score: 91,
    note: 'Try something new — similar style'
  }, {
    name: 'Sancerre Henri Bourgeois',
    sub: 'Loire Valley · $42',
    score: 82,
    note: 'White option · Pairs with seafood'
  }].map((w, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    style: {
      padding: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 44,
      borderRadius: 4,
      background: C.crSoft,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 14,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, w.sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 3
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '3px 8px',
      borderRadius: 7,
      background: C.greenBg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, w.score, "%")))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: i === 0 ? C.green : C.cr,
      fontFamily: C.P,
      marginTop: 5,
      paddingLeft: 42,
      fontWeight: 500
    }
  }, w.note))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── LEARN SCREEN ── */
// LearnScreen is now QuizHubScreen (defined in pwa-screens-quiz.jsx)
function LearnScreen(props) {
  return React.createElement(QuizHubScreen, props);
}

/* ── WINE LIST RESULTS SCREEN ── */
function WineListScreen({
  nav,
  back
}) {
  const data = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_winelist_result') || '{}');
    } catch (e) {
      return {};
    }
  }, []);
  const isDemo = data.demo === true;
  const demoWines = [{
    name: 'Barolo Giacomo Conterno',
    type: 'red',
    region: 'Piedmont',
    country: 'Italy',
    vintage: 2018,
    price_usd: 75,
    community_rating: 4.7,
    grapes: ['Nebbiolo'],
    description: 'Rich, structured Barolo with dried roses, tar and earthy depth.'
  }, {
    name: 'Chablis 1er Cru Montée de Tonnerre',
    type: 'white',
    region: 'Burgundy',
    country: 'France',
    vintage: 2021,
    price_usd: 48,
    community_rating: 4.5,
    grapes: ['Chardonnay'],
    description: 'Taut, mineral Chablis with oyster shell and lemon zest.'
  }, {
    name: 'Whispering Angel Rosé',
    type: 'rosé',
    region: 'Provence',
    country: 'France',
    vintage: 2022,
    price_usd: 28,
    community_rating: 4.4,
    grapes: ['Grenache'],
    description: 'Pale, bone-dry Provençal rosé with delicate strawberry and herbs.'
  }, {
    name: 'Chianti Classico Riserva',
    type: 'red',
    region: 'Tuscany',
    country: 'Italy',
    vintage: 2019,
    price_usd: 38,
    community_rating: 4.2,
    grapes: ['Sangiovese'],
    description: 'Sour cherry, leather and tobacco with firm tannins.'
  }, {
    name: 'Sancerre Henri Bourgeois',
    type: 'white',
    region: 'Loire Valley',
    country: 'France',
    vintage: 2022,
    price_usd: 35,
    community_rating: 4.5,
    grapes: ['Sauvignon Blanc'],
    description: 'Crisp and herbaceous with grapefruit and flinty minerality.'
  }, {
    name: 'Châteauneuf-du-Pape Vieux Télégraphe',
    type: 'red',
    region: 'Rhône Valley',
    country: 'France',
    vintage: 2019,
    price_usd: 68,
    community_rating: 4.6,
    grapes: ['Grenache'],
    description: 'Garrigue, dark fruit and spice — powerful yet elegant.'
  }];
  const wines = data.wines && data.wines.length > 0 ? data.wines : demoWines;
  const listCurrency = data.currency || Regional.current().code || localStorage.getItem('vinterest_currency') || 'GBP';
  const typeColors = {
    red: '#8B1A2F',
    white: '#B8963E',
    rosé: '#C47A8A',
    rose: '#C47A8A',
    sparkling: '#5E8FA8',
    orange: '#C1652B',
    dessert: '#8A5A2B',
    fortified: '#5C2A1E'
  };
  const colFor = t => typeColors[(t || 'red').toLowerCase().replace('é', 'e')] || C.cr;
  const currSym = (CURRENCY_LIST.find(c => c.code === listCurrency) || {}).sym || '';
  // Parse tiered list prices ("GLASS:16 / 1/2LTR:33 / BOTTLE:59") into clean labeled segments.
  // Markup/value badges always compare against the BOTTLE price specifically.
  function parsePriceTiers(priceStr) {
    const s = String(priceStr || '');
    const patterns = [{
      label: 'Glass',
      re: /glass\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i
    }, {
      label: '1/2 L',
      re: /(?:1\s*\/\s*2\s*ltr|1\s*\/\s*2\s*litre|half)\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i
    }, {
      label: 'Bottle',
      re: /bottle\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i
    }];
    const tiers = [];
    patterns.forEach(p => {
      const m = s.match(p.re);
      if (m) tiers.push({
        label: p.label,
        value: m[1]
      });
    });
    if (!tiers.length) {
      const any = s.match(/[0-9]+(?:\.[0-9]+)?/);
      if (any) tiers.push({
        label: null,
        value: any[0]
      });
    }
    return tiers;
  }

  // Real per-wine retail estimates — same source of truth as the Detail screen's Price tab
  // (shared cache key), fetched lazily so the badge is only ever as accurate as that lookup.
  const [retailMap, setRetailMap] = React.useState({});
  React.useEffect(() => {
    let cancelled = false;
    const curr = {
      sym: {
        GBP: '£',
        USD: '$',
        CAD: 'CA$',
        AUD: 'A$',
        NZD: 'NZ$',
        EUR: '€'
      }[listCurrency] || listCurrency,
      label: listCurrency,
      code: listCurrency
    };
    (async () => {
      for (let i = 0; i < wines.length; i++) {
        if (cancelled) return;
        const w = wines[i];
        if (!w || !w.price) continue;
        try {
          const d = await fetchRetailEstimate(w, curr);
          if (cancelled) return;
          if (d && d.mid != null) setRetailMap(m => ({
            ...m,
            [i]: d.mid
          }));
        } catch (e) {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data.wines]);

  // Value vs. typical retail — parse the printed list price and compare to the fetched retail estimate
  function valueInfo(w, i) {
    const est = retailMap[i];
    if (est == null || !w.price) return null;
    const priceStr = String(w.price);
    // Multi-tier lists ("GLASS:16 / 1/2LTR:33 / BOTTLE:59") — pull the bottle price specifically,
    // never concatenate every digit in the string (that produced wildly wrong ratios).
    const bottleMatch = priceStr.match(/bottle\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i);
    const anyNums = priceStr.match(/[0-9]+(?:\.[0-9]+)?/g);
    const listNum = bottleMatch ? Number(bottleMatch[1]) : anyNums ? Number(anyNums[anyNums.length - 1]) : NaN;
    if (!listNum || !est) return null;
    const ratio = listNum / est;
    if (ratio <= 2) return {
      label: 'Good Value',
      col: C.green,
      bg: C.greenBg,
      ratio
    };
    if (ratio <= 3) return {
      label: 'Fair Markup',
      col: C.amber,
      bg: C.amberBg,
      ratio
    };
    return {
      label: 'Marked Up',
      col: '#B04A3A',
      bg: '#F7E4E0',
      ratio
    };
  }

  // Same WineDNA calc used on the detail screen, so scores match everywhere
  const [scores] = React.useState(() => {
    const userWines = WineHistory.getAll();
    return wines.map(w => {
      const dna = calcMatchScore(w, userWines);
      if (dna != null) return dna;
      let h = 0;
      for (let i = 0; i < (w.name || '').length; i++) h = h * 31 + w.name.charCodeAt(i) & 0xffff;
      return 68 + Math.floor(h % 100 * 0.26);
    });
  });
  const [sortMode, setSortMode] = React.useState('list'); // 'list' | 'match'
  const [typeFilter, setTypeFilter] = React.useState(null); // null = all
  const types = ['red', 'white', 'rosé', 'sparkling'];
  const indexed = wines.map((w, i) => ({
    w,
    i,
    score: scores[i] || 78
  }));
  const filtered = typeFilter ? indexed.filter(x => (x.w.type || 'red').toLowerCase().replace('é', 'e') === typeFilter.replace('é', 'e')) : indexed;
  const shown = sortMode === 'match' ? [...filtered].sort((a, b) => b.score - a.score) : filtered;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.cr,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: 'rgba(255,255,255,0.2)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Wine List Results"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.65)',
      fontFamily: C.P
    }
  }, wines.length, " wines \xB7 prices in ", listCurrency, " \xB7 match scores included")), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('camera'),
    style: {
      padding: '6px 14px',
      borderRadius: 20,
      background: 'rgba(255,255,255,0.18)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Rescan"))), isDemo && /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#FFF3CD',
      borderBottom: '1px solid #FFE082',
      padding: '10px 16px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      flexShrink: 0
    }
  }, "\u26A0\uFE0F"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: '#7A5200',
      fontFamily: C.P
    }
  }, "List not detected \u2014 ensure the full page is in frame"), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('camera'),
    style: {
      marginTop: 6,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: '6px 14px',
      borderRadius: 20,
      background: '#8B1A2F',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "camera",
    sz: 12,
    col: "#fff"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Try Again")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 16px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, [{
    k: 'list',
    l: 'List Order'
  }, {
    k: 'match',
    l: 'Match Rate'
  }].map(o => /*#__PURE__*/React.createElement("div", {
    key: o.k,
    onClick: () => setSortMode(o.k),
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '8px 6px',
      borderRadius: 10,
      border: `1.5px solid ${sortMode === o.k ? C.cr : C.line}`,
      background: sortMode === o.k ? C.cr : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: sortMode === o.k ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, "Sort: ", o.l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      overflowX: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setTypeFilter(null),
    style: {
      flexShrink: 0,
      padding: '6px 12px',
      borderRadius: 20,
      border: `1.5px solid ${!typeFilter ? C.ink : C.line}`,
      background: !typeFilter ? C.ink : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: !typeFilter ? '#fff' : C.mid,
      fontFamily: C.P,
      textTransform: 'capitalize'
    }
  }, "All Types")), types.map(t => {
    const active = typeFilter === t;
    const col = colFor(t);
    return /*#__PURE__*/React.createElement("div", {
      key: t,
      onClick: () => setTypeFilter(active ? null : t),
      style: {
        flexShrink: 0,
        padding: '6px 12px',
        borderRadius: 20,
        border: `1.5px solid ${active ? col : C.line}`,
        background: active ? col : 'transparent',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: active ? '#fff' : C.mid,
        fontFamily: C.P,
        textTransform: 'capitalize'
      }
    }, t));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginBottom: 2
    }
  }, sortMode === 'match' ? 'Sorted by Match Rate' : 'Wine List Order'), shown.map(({
    w,
    i,
    score
  }) => {
    const col = colFor(w.type);
    const val = valueInfo(w, i);
    return /*#__PURE__*/React.createElement(Card, {
      key: i,
      style: {
        padding: 12,
        cursor: 'pointer'
      },
      onClick: () => {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: false,
          wine: {
            ...w,
            body: 0.75,
            tannins: 0.7,
            acidity: 0.6,
            sweetness: 0.1
          },
          confidence: score / 100
        }));
        nav('identified');
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 42,
        height: 56,
        borderRadius: 8,
        background: col + '15',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${col}25`
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "wine",
      sz: 18,
      col: col
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 17,
        fontWeight: 700,
        color: C.ink,
        fontFamily: C.P,
        lineHeight: 1.2,
        flex: 1
      }
    }, w.name), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: 7,
        background: score >= 80 ? C.greenBg : C.amberBg,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: score >= 80 ? C.green : C.amber,
        fontFamily: C.P
      }
    }, score, "%"))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 2
      }
    }, [w.region, w.country].filter(Boolean).join(' · '), w.vintage ? ` · ${w.vintage}` : ''), w.description && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.ink2,
        fontFamily: C.P,
        marginTop: 3,
        lineHeight: 1.4,
        fontStyle: 'italic'
      }
    }, w.description), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 5,
        marginTop: 6,
        alignItems: 'center',
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement(Pill, {
      sm: true,
      style: {
        background: col + '12',
        color: col,
        border: `1px solid ${col}25`,
        textTransform: 'capitalize'
      }
    }, w.type || 'Red'), w.grapes?.[0] && /*#__PURE__*/React.createElement(Pill, {
      sm: true
    }, w.grapes[0]), val && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: val.col,
        background: val.bg,
        borderRadius: 6,
        padding: '2px 7px'
      }
    }, val.label, " \xB7 ", val.ratio.toFixed(1), "x bottle")), w.price && (() => {
      const tiers = parsePriceTiers(w.price);
      return /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'baseline',
          gap: 12,
          marginTop: 7,
          paddingTop: 7,
          borderTop: `1px solid ${C.line}`
        }
      }, tiers.map((t, ti) => {
        const isBottle = t.label === 'Bottle' || tiers.length === 1;
        return /*#__PURE__*/React.createElement("div", {
          key: ti,
          style: {
            display: 'flex',
            alignItems: 'baseline',
            gap: 4
          }
        }, t.label && /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: 11,
            fontWeight: 600,
            color: C.mid,
            fontFamily: C.P,
            textTransform: 'uppercase',
            letterSpacing: '0.04em'
          }
        }, t.label), /*#__PURE__*/React.createElement("span", {
          style: {
            fontSize: isBottle ? 16 : 14,
            fontWeight: isBottle ? 700 : 500,
            color: isBottle ? C.ink : C.ink2,
            fontFamily: C.P
          }
        }, currSym, t.value));
      }), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: C.mid,
          fontFamily: C.P,
          marginLeft: 'auto'
        }
      }, listCurrency));
    })())));
  }), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => nav('camera'),
    style: {
      marginTop: 4
    }
  }, "Scan Another"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))));
}

/* ── SETTINGS SCREEN ── */
function SettingsScreen({
  nav,
  back
}) {
  const [region, setRegion] = React.useState(localStorage.getItem('vinterest_region') || 'uk');
  function saveRegion(r) {
    setRegion(r);
    localStorage.setItem('vinterest_region', r);
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      cursor: 'pointer',
      fontSize: 24
    }
  }, "\u2190"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Settings"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Region"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [{
    id: 'uk',
    label: 'United Kingdom',
    sym: '£'
  }, {
    id: 'eu',
    label: 'Europe',
    sym: '€'
  }, {
    id: 'us',
    label: 'United States',
    sym: '$'
  }, {
    id: 'ontario',
    label: 'Canada',
    sym: 'CA$'
  }, {
    id: 'australia',
    label: 'Australia',
    sym: 'A$'
  }, {
    id: 'nz',
    label: 'New Zealand',
    sym: 'NZ$'
  }].map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    onClick: () => saveRegion(r.id),
    style: {
      padding: '12px 14px',
      borderRadius: 12,
      background: region === r.id ? C.crSoft : C.white,
      border: `1px solid ${region === r.id ? C.cr : C.line}`,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, r.label, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.mid,
      fontWeight: 400
    }
  }, "(", r.sym, ")")), region === r.id && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.cr
    }
  }, "\u2713")))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 8
    }
  }, "Prices, budgets and sommelier scripts across the app use this currency.")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Debug"), /*#__PURE__*/React.createElement(Btn, {
    onClick: () => {
      const errors = JSON.parse(localStorage.getItem('vinterest_errors') || '[]');
      if (errors.length === 0) {
        alert('No errors logged.');
        return;
      }
      alert('Recent errors:\n\n' + errors.slice(-5).map(e => e.context + ': ' + e.message).join('\n'));
    },
    style: {
      width: '100%',
      padding: '12px',
      borderRadius: 12,
      background: C.white,
      border: `1px solid ${C.line}`,
      fontSize: 14,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "View Error Log"))));
}
Object.assign(window, {
  TasteProfileScreen,
  RestaurantScreen,
  LearnScreen,
  MyWinesScreen,
  WineListScreen,
  SettingsScreen
});

/* ---- pwa-screens-account.jsx (precompiled) ---- */
/* Vinterest — Account / Profile screen: onboarding summary (editable) + Travel Mode */

const ACC_TYPE_OPTS = [{
  id: 'red',
  label: 'Red',
  col: '#8B1A2F'
}, {
  id: 'white',
  label: 'White',
  col: '#B8963E'
}, {
  id: 'rose',
  label: 'Rosé',
  col: '#C47A8A'
}, {
  id: 'sparkling',
  label: 'Sparkling',
  col: '#5E8FA8'
}, {
  id: 'orange',
  label: 'Orange',
  col: '#C1652B'
}, {
  id: 'dessert',
  label: 'Dessert',
  col: '#8A5A2B'
}, {
  id: 'fortified',
  label: 'Fortified',
  col: '#5C2A1E'
}];
const ACC_EXP_OPTS = [{
  id: 'novice',
  label: 'Just getting started'
}, {
  id: 'casual',
  label: 'I know what I like'
}, {
  id: 'enthusiast',
  label: 'Pretty into it'
}, {
  id: 'expert',
  label: 'Borderline obsessed'
}];
const ACC_FREQ_OPTS = [{
  id: 'daily',
  label: 'Most days'
}, {
  id: 'weekly',
  label: 'A few times a week'
}, {
  id: 'occasion',
  label: 'Weekends & occasions'
}, {
  id: 'rarely',
  label: 'Now and then'
}];
const ACC_GOAL_OPTS = [{
  id: 'learn',
  label: 'Learn about wine',
  icon: 'book',
  col: '#1E7B4B'
}, {
  id: 'value',
  label: 'Find great value',
  icon: 'cart',
  col: '#B06C00'
}, {
  id: 'pair',
  label: 'Pair with food',
  icon: 'fork',
  col: '#8B1A2F'
}, {
  id: 'impress',
  label: 'Impress at dinner',
  icon: 'trophy',
  col: '#3B6FB0'
}];
const ACC_COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'France', 'Germany', 'Italy', 'Spain', 'Other'];
const ACC_COUNTRY_TO_REGION = {
  'united states': 'us',
  'canada': 'ontario',
  'united kingdom': 'uk',
  'australia': 'australia',
  'new zealand': 'nz',
  'france': 'eu',
  'germany': 'eu',
  'italy': 'eu',
  'spain': 'eu'
};
const ACC_COUNTRY_TO_CUR = {
  'united states': 'USD',
  'canada': 'CAD',
  'united kingdom': 'GBP',
  'australia': 'AUD',
  'new zealand': 'NZD',
  'france': 'EUR',
  'germany': 'EUR',
  'italy': 'EUR',
  'spain': 'EUR'
};
function AccSection({
  title,
  children,
  onEdit,
  editing
}) {
  return /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, title), onEdit && /*#__PURE__*/React.createElement("span", {
    onClick: onEdit,
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, editing ? 'Done' : 'Edit')), children);
}
function AccChips({
  opts,
  sel,
  editing,
  onToggle
}) {
  const active = Array.isArray(sel) ? sel : sel ? [sel] : [];
  if (!editing) {
    return active.length ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6
      }
    }, active.map(id => {
      const o = opts.find(x => x.id === id);
      return o ? /*#__PURE__*/React.createElement(Pill, {
        key: id,
        active: true,
        sm: true
      }, o.label) : null;
    })) : /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.mid,
        fontFamily: C.P,
        fontStyle: 'italic'
      }
    }, "Not set");
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, opts.map(o => {
    const on = active.includes(o.id);
    return /*#__PURE__*/React.createElement("div", {
      key: o.id,
      onClick: () => onToggle(o.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1.5px solid ${on ? C.cr : C.line}`,
        background: on ? C.crSoft : C.white,
        cursor: 'pointer'
      }
    }, o.icon && /*#__PURE__*/React.createElement(Icon, {
      n: o.icon,
      sz: 14,
      col: o.col || C.mid
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: on ? 700 : 500,
        color: on ? C.cr : C.ink2,
        fontFamily: C.P
      }
    }, o.label));
  }));
}
function AccountProfileScreen({
  nav,
  back
}) {
  const [prefs, setPrefs] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vinterest_prefs') || '{}');
    } catch (e) {
      return {};
    }
  });
  const [editSection, setEditSection] = React.useState(null);
  const [country, setCountry] = React.useState(() => localStorage.getItem('vinterest_country') || '');
  const [region, setRegionField] = React.useState(() => localStorage.getItem('vinterest_state') || '');
  const [city, setCity] = React.useState(() => localStorage.getItem('vinterest_city') || '');
  const [travel, setTravelState] = React.useState(() => Regional.travel());
  const [travelForm, setTravelForm] = React.useState({
    country: '',
    until: '',
    code: ''
  });
  const [travelEditing, setTravelEditing] = React.useState(false);
  function refreshTravel() {
    setTravelState(Regional.travel());
  }
  React.useEffect(() => {
    const h = () => refreshTravel();
    window.addEventListener('vinterest:travel', h);
    return () => window.removeEventListener('vinterest:travel', h);
  }, []);
  function savePrefField(key, val) {
    setPrefs(p => {
      const np = {
        ...p,
        [key]: val
      };
      localStorage.setItem('vinterest_prefs', JSON.stringify(np));
      return np;
    });
  }
  function toggleMulti(key, id) {
    const cur = prefs[key] || [];
    const next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
    savePrefField(key, next);
  }
  function saveLocation() {
    localStorage.setItem('vinterest_country', country);
    localStorage.setItem('vinterest_state', region);
    localStorage.setItem('vinterest_city', city);
    savePrefField('location', {
      country,
      region,
      city
    });
    const k = country.trim().toLowerCase();
    localStorage.setItem('vinterest_region', ACC_COUNTRY_TO_REGION[k] || 'us');
    localStorage.setItem('vinterest_currency', ACC_COUNTRY_TO_CUR[k] || 'USD');
    setEditSection(null);
  }
  function enableTravel() {
    if (!travelForm.country.trim()) return;
    Regional.setTravel(travelForm.country, travelForm.until, travelForm.code || null);
    refreshTravel();
    setTravelEditing(false);
    setTravelForm({
      country: '',
      until: '',
      code: ''
    });
  }
  function disableTravel() {
    Regional.disableTravel();
    refreshTravel();
  }
  const home = Regional.home();
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '14px 20px',
      background: C.white,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      flex: 1
    }
  }, "Profile")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      border: travel ? `1.5px solid ${C.cr}` : `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 38,
      height: 38,
      borderRadius: 19,
      background: travel ? C.crSoft : C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "compass",
    sz: 19,
    col: travel ? C.cr : C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Travel Mode"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, travel ? `On — ${travel.country} (${travel.code})` : 'Temporarily price in a different currency')), /*#__PURE__*/React.createElement("div", {
    onClick: () => travel ? disableTravel() : setTravelEditing(e => !e),
    style: {
      width: 46,
      height: 27,
      borderRadius: 14,
      background: travel ? C.cr : C.line,
      position: 'relative',
      cursor: 'pointer',
      flexShrink: 0,
      transition: 'background .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 2,
      left: travel ? 21 : 2,
      width: 23,
      height: 23,
      borderRadius: 12,
      background: '#fff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
      transition: 'left .15s'
    }
  }))), travel && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${C.line}`,
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, travel.until ? `Turns off automatically on ${travel.until}` : 'On until you turn it off', " \xB7 prices show in ", travel.sym), !travel && travelEditing && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      paddingTop: 12,
      borderTop: `1px solid ${C.line}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P,
      marginBottom: 6
    }
  }, "Where are you travelling to?"), /*#__PURE__*/React.createElement("input", {
    value: travelForm.country,
    onChange: e => setTravelForm(f => ({
      ...f,
      country: e.target.value
    })),
    placeholder: "e.g. United States",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P,
      marginBottom: 6
    }
  }, "Currency"), /*#__PURE__*/React.createElement("select", {
    value: travelForm.code || (lookupCountryCurrency(travelForm.country) || {}).code || '',
    onChange: e => setTravelForm(f => ({
      ...f,
      code: e.target.value
    })),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none'
    }
  }, CURRENCY_LIST.map(c => /*#__PURE__*/React.createElement("option", {
    key: c.code,
    value: c.code
  }, c.code, " (", c.sym, ")")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P,
      marginBottom: 6
    }
  }, "Return date (optional)"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: travelForm.until,
    onChange: e => setTravelForm(f => ({
      ...f,
      until: e.target.value
    })),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 5
    }
  }, "Leave blank to turn it off manually.")), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: enableTravel
  }, "Enable Travel Mode"))), /*#__PURE__*/React.createElement(AccSection, {
    title: "Home Location",
    onEdit: () => setEditSection(editSection === 'loc' ? null : 'loc'),
    editing: editSection === 'loc'
  }, editSection === 'loc' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: country,
    onChange: e => setCountry(e.target.value),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "Select country"), ACC_COUNTRIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))), /*#__PURE__*/React.createElement("input", {
    value: region,
    onChange: e => setRegionField(e.target.value),
    placeholder: "State / Province (optional)",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: city,
    onChange: e => setCity(e.target.value),
    placeholder: "City",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '12px 14px',
      borderRadius: 11,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: saveLocation
  }, "Save")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink,
      fontFamily: C.P
    }
  }, [city, region, country].filter(Boolean).join(', ') || 'Not set', /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      marginTop: 4
    }
  }, "Home currency: ", home.sym, " (", home.code, ")"))), /*#__PURE__*/React.createElement(AccSection, {
    title: "What You Drink",
    onEdit: () => setEditSection(editSection === 'types' ? null : 'types'),
    editing: editSection === 'types'
  }, /*#__PURE__*/React.createElement(AccChips, {
    opts: ACC_TYPE_OPTS,
    sel: prefs.types || [],
    editing: editSection === 'types',
    onToggle: id => toggleMulti('types', id)
  })), /*#__PURE__*/React.createElement(AccSection, {
    title: "Wine Knowledge",
    onEdit: () => setEditSection(editSection === 'experience' ? null : 'experience'),
    editing: editSection === 'experience'
  }, editSection === 'experience' ? /*#__PURE__*/React.createElement(AccChips, {
    opts: ACC_EXP_OPTS,
    sel: prefs.experience,
    editing: true,
    onToggle: id => savePrefField('experience', id)
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink,
      fontFamily: C.P
    }
  }, (ACC_EXP_OPTS.find(o => o.id === prefs.experience) || {}).label || 'Not set')), /*#__PURE__*/React.createElement(AccSection, {
    title: "How Often You Drink",
    onEdit: () => setEditSection(editSection === 'frequency' ? null : 'frequency'),
    editing: editSection === 'frequency'
  }, editSection === 'frequency' ? /*#__PURE__*/React.createElement(AccChips, {
    opts: ACC_FREQ_OPTS,
    sel: prefs.frequency,
    editing: true,
    onToggle: id => savePrefField('frequency', id)
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink,
      fontFamily: C.P
    }
  }, (ACC_FREQ_OPTS.find(o => o.id === prefs.frequency) || {}).label || 'Not set')), /*#__PURE__*/React.createElement(AccSection, {
    title: "Why You're Here",
    onEdit: () => setEditSection(editSection === 'goals' ? null : 'goals'),
    editing: editSection === 'goals'
  }, /*#__PURE__*/React.createElement(AccChips, {
    opts: ACC_GOAL_OPTS,
    sel: prefs.goals || [],
    editing: editSection === 'goals',
    onToggle: id => toggleMulti('goals', id)
  })), /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('settings'),
    style: {
      padding: '14px 4px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Settings"), /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 14,
    col: C.mid
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  })));
}
Object.assign(window, {
  AccountProfileScreen
});

/* ---- pwa-onboarding.jsx (precompiled) ---- */
/* Vinterest — Onboarding (first-run, 3 slides) */

function OnboardingScreen({
  onComplete
}) {
  const [slide, setSlide] = React.useState(0);
  const [pref, setPref] = React.useState(null);
  function finish() {
    if (pref) localStorage.setItem('vinterest_initial_pref', pref);
    if (!localStorage.getItem('vinterest_region')) {
      localStorage.setItem('vinterest_region', 'uk');
    }
    onComplete();
  }
  const PREFS = [{
    id: 'red',
    label: 'Red wines',
    emoji: '🍷',
    col: '#8B1A2F',
    bg: '#FDF0F3'
  }, {
    id: 'white',
    label: 'White wines',
    emoji: '🥂',
    col: '#B8963E',
    bg: '#FFFBF0'
  }, {
    id: 'rose',
    label: 'Rosé',
    emoji: '🌸',
    col: '#C47A8A',
    bg: '#FFF0F4'
  }, {
    id: 'sparkling',
    label: 'Sparkling & Champagne',
    emoji: '🍾',
    col: '#5E8FA8',
    bg: '#F0F7FF'
  }, {
    id: 'all',
    label: 'A bit of everything',
    emoji: '🌈',
    col: '#1E7B4B',
    bg: '#EAF7F0'
  }];
  const dotsDark = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 4
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: i === slide ? 22 : 6,
      height: 6,
      borderRadius: 3,
      background: i === slide ? '#fff' : 'rgba(255,255,255,0.2)',
      transition: 'width .3s'
    }
  })));
  const dotsLight = /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 4
    }
  }, [0, 1, 2].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      width: i === slide ? 22 : 6,
      height: 6,
      borderRadius: 3,
      background: i === slide ? C.cr : C.line,
      transition: 'width .3s'
    }
  })));

  /* ── Slide 1: Hero ── */
  if (slide === 0) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0F0F0F',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -70,
      right: -70,
      width: 280,
      height: 280,
      borderRadius: 140,
      background: `${C.cr}20`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: -50,
      left: -50,
      width: 200,
      height: 200,
      borderRadius: 100,
      background: `${C.cr}10`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 18,
      right: 22,
      zIndex: 2,
      cursor: 'pointer'
    },
    onClick: finish
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.3)',
      fontFamily: C.P,
      fontWeight: 500
    }
  }, "Skip")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 32px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      width: 220,
      height: 'auto',
      marginBottom: 44,
      filter: 'invert(1) brightness(1)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 800,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '-0.8px',
      textAlign: 'center',
      lineHeight: 1.15,
      marginBottom: 16
    }
  }, "Scan any wine.", /*#__PURE__*/React.createElement("br", null), "Know it instantly."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: 'rgba(255,255,255,0.38)',
      fontFamily: C.P,
      textAlign: 'center',
      lineHeight: 1.7,
      maxWidth: 270
    }
  }, "AI-powered wine education designed for curious drinkers, not experts.")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 52px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setSlide(1),
    style: {
      background: C.cr,
      borderRadius: 16,
      padding: '17px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 10px 40px ${C.cr}60`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Get Started")), dotsDark));

  /* ── Slide 2: Features ── */
  if (slide === 1) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 18,
      right: 22,
      zIndex: 2,
      cursor: 'pointer'
    },
    onClick: finish
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      fontWeight: 500
    }
  }, "Skip")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '52px 24px 24px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 22,
      width: 'auto',
      display: 'block',
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 900,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.7px',
      lineHeight: 1.1,
      marginBottom: 8
    }
  }, "Three things.", /*#__PURE__*/React.createElement("br", null), "Done brilliantly."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 26,
      lineHeight: 1.5
    }
  }, "Everything else gets in the way."), [{
    emoji: '📷',
    col: '#8B1A2F',
    bg: '#FDF0F3',
    t: 'Scan & Identify',
    d: "Point at any label. AI tells you exactly what it is, whether you'll like it, and what it costs."
  }, {
    emoji: '🎓',
    col: '#1E7B4B',
    bg: '#EAF7F0',
    t: 'Learn as you scan',
    d: "Mini-quizzes tied to bottles you've actually tried. Build your wine IQ, one scan at a time."
  }, {
    emoji: '🍷',
    col: '#B06C00',
    bg: '#FFF4E0',
    t: 'Know your taste',
    d: 'Your personal taste profile grows with every scan. Walk into any restaurant with real confidence.'
  }].map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 14,
      padding: '16px',
      borderRadius: 16,
      background: f.bg,
      marginBottom: 10,
      border: `1px solid ${f.col}15`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 50,
      height: 50,
      borderRadius: 14,
      background: f.col,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontSize: 24,
      boxShadow: `0 4px 18px ${f.col}45`
    }
  }, f.emoji), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, f.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.6
    }
  }, f.d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 44px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setSlide(2),
    style: {
      background: C.cr,
      borderRadius: 16,
      padding: '17px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 7px 28px ${C.cr}50`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Continue")), dotsLight));

  /* ── Slide 3: Preferences ── */
  if (slide === 2) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '52px 24px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 32,
      fontWeight: 900,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.7px',
      lineHeight: 1.1,
      marginBottom: 8
    }
  }, "What do you", /*#__PURE__*/React.createElement("br", null), "usually drink?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 24,
      lineHeight: 1.5
    }
  }, "Helps us personalise from day one."), PREFS.map(opt => /*#__PURE__*/React.createElement("div", {
    key: opt.id,
    onClick: () => setPref(opt.id),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '15px 16px',
      borderRadius: 14,
      marginBottom: 9,
      border: `2px solid ${pref === opt.id ? opt.col : C.line}`,
      background: pref === opt.id ? opt.bg : C.white,
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26
    }
  }, opt.emoji), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: pref === opt.id ? 700 : 500,
      color: pref === opt.id ? opt.col : C.ink,
      fontFamily: C.P,
      flex: 1
    }
  }, opt.label), pref === opt.id && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 11,
      background: opt.col,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 12,
    col: "#fff"
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 44px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: finish,
    style: {
      background: pref ? C.cr : '#BBBBBB',
      borderRadius: 16,
      padding: '17px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: pref ? `0 7px 28px ${C.cr}50` : 'none',
      transition: 'all .2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, pref ? 'Start Scanning →' : 'Skip for now')), dotsLight));
  return null;
}
Object.assign(window, {
  OnboardingScreen
});

/* ---- flow-welcome.jsx (precompiled) ---- */
/* Vinterest — New User Flow: Welcome (feature overview) + Demo first scan */

/* ── Screen 1: Welcome / feature overview ── */
function WelcomeScreen({
  next
}) {
  const feats = [{
    icon: 'camera',
    col: '#8B1A2F',
    bg: '#FDF0F3',
    t: 'Scan any label',
    d: 'Point your camera at a bottle. Know exactly what it is in seconds.'
  }, {
    icon: 'brain',
    col: '#3B6FB0',
    bg: '#EEF3FB',
    t: 'Know if you’ll like it',
    d: 'A personal match score, built from your own taste.'
  }, {
    icon: 'book',
    col: '#1E7B4B',
    bg: '#EAF7F0',
    t: 'Learn as you go',
    d: 'Plain-language notes and stories — no sommelier required.'
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0F0F0F',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -80,
      right: -80,
      width: 300,
      height: 300,
      borderRadius: 150,
      background: `${C.cr}22`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 120,
      left: -60,
      width: 200,
      height: 200,
      borderRadius: 100,
      background: `${C.cr}12`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 24px) 28px 16px',
      position: 'relative',
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 30,
      width: 'auto',
      display: 'block',
      marginBottom: 36,
      filter: 'invert(1) brightness(2)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 34,
      fontWeight: 800,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '-1px',
      lineHeight: 1.1,
      marginBottom: 14
    }
  }, "Wine, finally", /*#__PURE__*/React.createElement("br", null), "uncomplicated."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      lineHeight: 1.6,
      marginBottom: 34,
      maxWidth: 300
    }
  }, "Scan a bottle and get an instant read \u2014 what it is, whether it\u2019s for you, and why."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, feats.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 13,
      background: f.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: f.icon,
    sz: 22,
    col: f.col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      marginBottom: 2
    }
  }, f.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.42)',
      fontFamily: C.P,
      lineHeight: 1.45
    }
  }, f.d)))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 24px 44px',
      position: 'relative',
      zIndex: 1,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      background: C.cr,
      borderRadius: 16,
      padding: '17px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 10px 40px ${C.cr}55`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Scan your first bottle")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.4)',
      fontFamily: C.P
    }
  }, "No account needed to try"))));
}

/* ── Screen 2: Demo first scan (viewfinder → identifying → result) ── */
function DemoScanScreen({
  next
}) {
  // phase: 'aim' | 'scanning' | 'result'
  const [phase, setPhase] = React.useState('aim');
  React.useEffect(() => {
    if (phase === 'scanning') {
      const t = setTimeout(() => setPhase('result'), 2100);
      return () => clearTimeout(t);
    }
  }, [phase]);
  if (phase === 'result') return /*#__PURE__*/React.createElement(DemoResult, {
    next: next
  });
  const scanning = phase === 'scanning';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0A0A0A',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(env(safe-area-inset-top) + 16px) 22px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      fontWeight: 500
    }
  }, "Try a scan"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.35)',
      fontFamily: C.P,
      background: 'rgba(255,255,255,0.08)',
      padding: '4px 10px',
      borderRadius: 20
    }
  }, "Demo")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 230,
      height: 300
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      borderRadius: 16,
      background: 'linear-gradient(160deg,#2A2018 0%,#1A1410 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 90,
      height: 90,
      borderRadius: '50%',
      border: `2px solid ${C.cr}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 900,
      color: C.crL,
      fontFamily: 'Georgia,serif',
      fontStyle: 'italic'
    }
  }, "Ch")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 110,
      height: 7,
      borderRadius: 4,
      background: 'rgba(255,255,255,0.16)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 80,
      height: 6,
      borderRadius: 4,
      background: 'rgba(255,255,255,0.1)'
    }
  }), scanning && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      height: 3,
      background: `linear-gradient(90deg,transparent,${C.crL},transparent)`,
      boxShadow: `0 0 16px ${C.crL}`,
      animation: 'vscan 1.2s ease-in-out infinite'
    }
  })), [[0, 0, 'tl'], [1, 0, 'tr'], [0, 1, 'bl'], [1, 1, 'br']].map(([x, y, k]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      position: 'absolute',
      width: 30,
      height: 30,
      [y ? 'bottom' : 'top']: -6,
      [x ? 'right' : 'left']: -6,
      borderTop: !y ? `3px solid ${scanning ? C.crL : '#fff'}` : 'none',
      borderBottom: y ? `3px solid ${scanning ? C.crL : '#fff'}` : 'none',
      borderLeft: !x ? `3px solid ${scanning ? C.crL : '#fff'}` : 'none',
      borderRight: x ? `3px solid ${scanning ? C.crL : '#fff'}` : 'none',
      borderTopLeftRadius: !x && !y ? 10 : 0,
      borderTopRightRadius: x && !y ? 10 : 0,
      borderBottomLeftRadius: !x && y ? 10 : 0,
      borderBottomRightRadius: x && y ? 10 : 0,
      transition: 'border-color .3s'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 24px 48px',
      textAlign: 'center',
      position: 'relative',
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      marginBottom: 22,
      height: 20
    }
  }, scanning ? 'Identifying…' : 'Line up the label and tap to scan'), /*#__PURE__*/React.createElement("div", {
    onClick: () => !scanning && setPhase('scanning'),
    style: {
      width: 72,
      height: 72,
      borderRadius: '50%',
      margin: '0 auto',
      border: '4px solid rgba(255,255,255,0.5)',
      padding: 4,
      cursor: scanning ? 'default' : 'pointer',
      opacity: scanning ? 0.5 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      height: '100%',
      borderRadius: '50%',
      background: scanning ? C.crL : '#fff',
      transition: 'background .3s'
    }
  }))), /*#__PURE__*/React.createElement("style", null, `@keyframes vscan{0%{top:8%}50%{top:88%}100%{top:8%}}`));
}

/* ── Demo scan result ── */
function DemoResult({
  next
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 16px) 22px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 11,
      background: C.green,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 12,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: C.green,
      fontFamily: C.P
    }
  }, "Identified")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      marginBottom: 6
    }
  }, "Rh\xF4ne \xB7 France"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 27,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px',
      lineHeight: 1.12,
      marginBottom: 4
    }
  }, "Ch\xE2teauneuf-du-Pape"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 20
    }
  }, "Domaine Jean XXII \xB7 2019"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 10,
      marginBottom: 16
    }
  }, [['Type', 'Red blend'], ['Grape', 'Grenache'], ['Body', 'Full'], ['Pairs with', 'Lamb, beef']].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      background: C.white,
      borderRadius: 14,
      padding: '13px 15px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#0F0F0F',
      borderRadius: 16,
      padding: '18px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      position: 'relative',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: -20,
      top: -20,
      width: 110,
      height: 110,
      borderRadius: 55,
      background: `${C.cr}30`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 23,
      background: 'rgba(255,255,255,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "lock",
    sz: 20,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Your match score"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      lineHeight: 1.4
    }
  }, "Save this scan to unlock your personal taste match.")))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 24px 44px',
      flexShrink: 0,
      borderTop: `1px solid ${C.line}`,
      background: C.white
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      background: C.cr,
      borderRadius: 16,
      padding: '17px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 8px 28px ${C.cr}45`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Save this & keep scanning")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Free \u2014 30 scans a month, no card required"))));
}
Object.assign(window, {
  WelcomeScreen,
  DemoScanScreen,
  DemoResult
});

/* ---- flow-auth.jsx (precompiled) ---- */
/* Vinterest — New User Flow: Auth (Sign up to save). Two layout variations. */

/* Brand marks for social sign-in buttons */
function GoogleMark({
  sz = 20
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: sz,
    height: sz,
    viewBox: "0 0 48 48",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    fill: "#EA4335",
    d: "M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#4285F4",
    d: "M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#FBBC05",
    d: "M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "#34A853",
    d: "M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
  }));
}
function AppleMark({
  sz = 20,
  col = '#000'
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: sz,
    height: sz,
    viewBox: "0 0 24 24",
    style: {
      display: 'block',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("path", {
    fill: col,
    d: "M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.46 7.83 1.3 10.39.86 1.25 1.88 2.66 3.22 2.61 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.28 3.12-2.54.98-1.46 1.39-2.87 1.41-2.94-.03-.01-2.71-1.04-2.74-4.13zM14.53 4.4c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z"
  }));
}
function SocialButtons({
  dark
}) {
  const border = dark ? 'rgba(255,255,255,0.16)' : C.line;
  const txt = dark ? '#fff' : C.ink;
  const bg = dark ? 'rgba(255,255,255,0.06)' : C.white;
  const row = (mark, label) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 11,
      padding: '14px',
      borderRadius: 13,
      border: `1px solid ${border}`,
      background: bg,
      cursor: 'pointer'
    }
  }, mark, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15.5,
      fontWeight: 600,
      color: txt,
      fontFamily: C.P
    }
  }, label));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, row(/*#__PURE__*/React.createElement(GoogleMark, null), 'Continue with Google'), row(/*#__PURE__*/React.createElement(AppleMark, {
    col: dark ? '#fff' : '#000'
  }), 'Continue with Apple'));
}
function Divider({
  label,
  dark
}) {
  const ln = dark ? 'rgba(255,255,255,0.14)' : C.line;
  const tx = dark ? 'rgba(255,255,255,0.4)' : C.mid;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      margin: '4px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: ln
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: tx,
      fontFamily: C.P
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: ln
    }
  }));
}
function EmailFields({
  mode
}) {
  const field = (ph, type) => /*#__PURE__*/React.createElement("input", {
    type: type,
    placeholder: ph,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '15px 16px',
      borderRadius: 13,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15.5,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, field('Email address', 'email'), field('Password', 'password'));
}

/* ── VARIATION A: Social-first (stacked) ── */
function AuthVariantA({
  next,
  mode,
  setMode
}) {
  const signup = mode === 'signup';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 22px) 26px 16px'
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 26,
      width: 'auto',
      display: 'block',
      marginBottom: 30
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.6px',
      lineHeight: 1.12,
      marginBottom: 8
    }
  }, signup ? 'Save your scans' : 'Welcome back'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 28
    }
  }, signup ? 'Create a free account to keep your wines, taste profile and progress.' : 'Sign in to pick up where you left off.'), /*#__PURE__*/React.createElement(SocialButtons, null), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 18
    }
  }), /*#__PURE__*/React.createElement(Divider, {
    label: "or"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 18
    }
  }), /*#__PURE__*/React.createElement(EmailFields, {
    mode: mode
  }), !signup && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: C.cr,
      fontFamily: C.P,
      fontWeight: 600,
      cursor: 'pointer'
    }
  }, "Forgot password?"))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 26px 40px',
      flexShrink: 0,
      background: C.white,
      borderTop: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      background: C.cr,
      borderRadius: 14,
      padding: '16px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 8px 26px ${C.cr}45`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, signup ? 'Create account' : 'Sign in')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P
    }
  }, signup ? 'Already have an account? ' : 'New to Vinterest? '), /*#__PURE__*/React.createElement("span", {
    onClick: () => setMode(signup ? 'signin' : 'signup'),
    style: {
      fontSize: 14,
      color: C.cr,
      fontFamily: C.P,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, signup ? 'Sign in' : 'Create one'))));
}

/* ── VARIATION B: Dark hero, email-first ── */
function AuthVariantB({
  next,
  mode,
  setMode
}) {
  const signup = mode === 'signup';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0F0F0F',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -70,
      right: -70,
      width: 260,
      height: 260,
      borderRadius: 130,
      background: `${C.cr}28`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 24px) 26px 16px',
      position: 'relative',
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 26,
      width: 'auto',
      display: 'block',
      marginBottom: 30,
      filter: 'invert(1) brightness(2)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 30,
      fontWeight: 800,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '-0.7px',
      lineHeight: 1.1,
      marginBottom: 8
    }
  }, signup ? 'Keep your wines\nforever.' : 'Welcome back.'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 30,
      whiteSpace: 'pre-line'
    }
  }, signup ? 'One free account saves every scan, rating and your taste profile.' : 'Sign in to continue.'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "email",
    placeholder: "Email address",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '15px 16px',
      borderRadius: 13,
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'rgba(255,255,255,0.07)',
      fontSize: 15.5,
      fontFamily: C.P,
      color: '#fff',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    placeholder: "Password",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '15px 16px',
      borderRadius: 13,
      border: '1px solid rgba(255,255,255,0.16)',
      background: 'rgba(255,255,255,0.07)',
      fontSize: 15.5,
      fontFamily: C.P,
      color: '#fff',
      outline: 'none'
    }
  })), /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      marginTop: 14,
      background: C.cr,
      borderRadius: 14,
      padding: '16px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 8px 30px ${C.cr}60`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, signup ? 'Create account' : 'Sign in')), !signup && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Forgot password?")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 20
    }
  }), /*#__PURE__*/React.createElement(Divider, {
    label: "or continue with",
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }), /*#__PURE__*/React.createElement(SocialButtons, {
    dark: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 26px 40px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P
    }
  }, signup ? 'Already have an account? ' : 'New here? '), /*#__PURE__*/React.createElement("span", {
    onClick: () => setMode(signup ? 'signin' : 'signup'),
    style: {
      fontSize: 14,
      color: '#fff',
      fontFamily: C.P,
      fontWeight: 700,
      cursor: 'pointer'
    }
  }, signup ? 'Sign in' : 'Create one'))));
}
function AuthScreen({
  next,
  variant
}) {
  const [mode, setMode] = React.useState('signup');
  return variant === 'B' ? /*#__PURE__*/React.createElement(AuthVariantB, {
    next: next,
    mode: mode,
    setMode: setMode
  }) : /*#__PURE__*/React.createElement(AuthVariantA, {
    next: next,
    mode: mode,
    setMode: setMode
  });
}
Object.assign(window, {
  AuthScreen,
  GoogleMark,
  AppleMark
});

/* ---- flow-onboard.jsx (precompiled) ---- */
/* Vinterest — New User Flow: Onboarding questions (post-signup, minimal) */

function OnboardQuestions({
  next,
  onAnswers
}) {
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});

  // Currency + budget bands follow the country chosen in the location step (asked before budget).
  const CURRENCIES = {
    'United Kingdom': {
      sym: '£',
      code: 'GBP',
      bands: ['Under £12', '£12 – £25', '£25 – £50', '£50+']
    },
    'United States': {
      sym: '$',
      code: 'USD',
      bands: ['Under $15', '$15 – $30', '$30 – $60', '$60+']
    },
    'Canada': {
      sym: '$',
      code: 'CAD',
      bands: ['Under $20', '$20 – $40', '$40 – $70', '$70+']
    },
    'Australia': {
      sym: '$',
      code: 'AUD',
      bands: ['Under $20', '$20 – $40', '$40 – $70', '$70+']
    },
    'France': {
      sym: '€',
      code: 'EUR',
      bands: ['Under €12', '€12 – €30', '€30 – €60', '€60+']
    },
    'Germany': {
      sym: '€',
      code: 'EUR',
      bands: ['Under €12', '€12 – €30', '€30 – €60', '€60+']
    },
    'Italy': {
      sym: '€',
      code: 'EUR',
      bands: ['Under €12', '€12 – €30', '€30 – €60', '€60+']
    },
    'Spain': {
      sym: '€',
      code: 'EUR',
      bands: ['Under €12', '€12 – €30', '€30 – €60', '€60+']
    },
    'Other': {
      sym: '$',
      code: 'USD',
      bands: ['Under $15', '$15 – $30', '$30 – $60', '$60+']
    }
  };
  const cur = CURRENCIES[answers.location && answers.location.country || ''] || CURRENCIES['Other'];
  const budgetDescs = ['Everyday value', 'A reliable step up', 'Something special', 'Going all out'];
  const budgetOpts = cur.bands.map((b, i) => ({
    id: ['value', 'mid', 'premium', 'splurge'][i],
    label: b,
    d: budgetDescs[i]
  }));

  // Address fields depend on the country (UK: city only · US: state+city · Canada: province+city · etc.)
  const LOC_FIELDS = country => {
    if (!country) return [];
    if (country === 'United States') return [{
      k: 'region',
      label: 'State',
      ph: 'e.g. California'
    }, {
      k: 'city',
      label: 'City',
      ph: 'e.g. San Francisco'
    }];
    if (country === 'Canada') return [{
      k: 'region',
      label: 'Province',
      ph: 'e.g. Ontario'
    }, {
      k: 'city',
      label: 'City',
      ph: 'e.g. Toronto'
    }];
    if (country === 'Australia') return [{
      k: 'region',
      label: 'State / Territory',
      ph: 'e.g. Victoria'
    }, {
      k: 'city',
      label: 'City',
      ph: 'e.g. Melbourne'
    }];
    if (country === 'United Kingdom') return [{
      k: 'city',
      label: 'City / Town',
      ph: 'e.g. Manchester'
    }];
    return [{
      k: 'city',
      label: 'City',
      ph: 'e.g. your city'
    }]; // France / Germany / Italy / Spain / Other
  };
  const QS = [{
    key: 'types',
    multi: true,
    title: 'What do you drink?',
    sub: 'Pick any — or all of them.',
    opts: [{
      id: 'red',
      label: 'Red',
      icon: 'wine',
      col: '#8B1A2F'
    }, {
      id: 'white',
      label: 'White',
      icon: 'wine',
      col: '#B8963E'
    }, {
      id: 'rose',
      label: 'Rosé',
      icon: 'wine',
      col: '#C47A8A'
    }, {
      id: 'sparkling',
      label: 'Sparkling',
      icon: 'wine',
      col: '#5E8FA8'
    }]
  }, {
    key: 'experience',
    multi: false,
    title: 'How well do you know wine?',
    sub: 'No wrong answer — it just tunes the depth.',
    opts: [{
      id: 'novice',
      label: 'Just getting started',
      d: 'Keep it simple and clear'
    }, {
      id: 'casual',
      label: 'I know what I like',
      d: 'A little more detail'
    }, {
      id: 'enthusiast',
      label: 'Pretty into it',
      d: 'Bring on the nuance'
    }, {
      id: 'expert',
      label: 'Borderline obsessed',
      d: 'Full depth, no hand-holding'
    }]
  }, {
    key: 'frequency',
    multi: false,
    title: 'How often do you drink wine?',
    sub: 'No judgement — we’ll never tell.',
    opts: [{
      id: 'daily',
      label: 'Most days'
    }, {
      id: 'weekly',
      label: 'A few times a week'
    }, {
      id: 'occasion',
      label: 'Weekends & occasions'
    }, {
      id: 'rarely',
      label: 'Now and then'
    }]
  }, {
    key: 'location',
    type: 'location',
    title: 'Where are you based?',
    sub: 'So we can show where to buy — and price everything in your local currency.'
  }, {
    key: 'budget',
    multi: false,
    title: 'Typical spend per bottle?',
    sub: `We’ll point you to the sweet spot in ${cur.sym}.`,
    opts: budgetOpts
  }, {
    key: 'goals',
    multi: true,
    title: 'What are you here for?',
    sub: 'Pick all that apply.',
    opts: [{
      id: 'learn',
      label: 'Learn about wine',
      icon: 'book',
      col: '#1E7B4B'
    }, {
      id: 'value',
      label: 'Find great value',
      icon: 'cart',
      col: '#B06C00'
    }, {
      id: 'pair',
      label: 'Pair with food',
      icon: 'fork',
      col: '#8B1A2F'
    }, {
      id: 'impress',
      label: 'Impress at dinner',
      icon: 'trophy',
      col: '#3B6FB0'
    }]
  }];
  const q = QS[step];
  const isLoc = q.type === 'location';
  const sel = answers[q.key] || (isLoc ? {} : q.multi ? [] : null);
  const hasAnswer = isLoc ? !!sel.country : q.multi ? sel.length > 0 : !!sel;
  function choose(id) {
    setAnswers(a => {
      if (q.multi) {
        const cur = a[q.key] || [];
        return {
          ...a,
          [q.key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]
        };
      }
      return {
        ...a,
        [q.key]: id
      };
    });
  }
  function setLoc(field, val) {
    setAnswers(a => ({
      ...a,
      [q.key]: {
        ...(a[q.key] || {}),
        [field]: val
      }
    }));
  }
  function advance() {
    if (step < QS.length - 1) {
      setStep(step + 1);
    } else {
      if (onAnswers) {
        onAnswers(answers);
      } else {
        next();
      }
    }
  }
  function isSel(id) {
    return q.multi ? sel.includes(id) : sel === id;
  }
  const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Australia', 'France', 'Germany', 'Italy', 'Spain', 'Other'];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 'calc(env(safe-area-inset-top) + 16px) 22px 8px',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => step > 0 ? setStep(step - 1) : null,
    style: {
      opacity: step > 0 ? 1 : 0.25,
      cursor: step > 0 ? 'pointer' : 'default',
      padding: 4,
      marginLeft: -4
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 22,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      gap: 5
    }
  }, QS.map((_, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      height: 5,
      borderRadius: 3,
      background: i <= step ? C.cr : C.line,
      transition: 'background .3s'
    }
  }))), /*#__PURE__*/React.createElement("span", {
    onClick: next,
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, "Skip"))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 22px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px',
      lineHeight: 1.15,
      marginBottom: q.sub ? 6 : 22
    }
  }, q.title), q.sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 22,
      lineHeight: 1.45
    }
  }, q.sub), isLoc ?
  /*#__PURE__*/
  /* ── Location fields ── */
  React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P,
      marginBottom: 7
    }
  }, "Country"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", {
    value: sel.country || '',
    onChange: e => setLoc('country', e.target.value),
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '15px 16px',
      borderRadius: 13,
      border: `1px solid ${sel.country ? C.cr : C.line}`,
      background: C.white,
      fontSize: 15.5,
      fontFamily: C.P,
      color: sel.country ? C.ink : C.mid,
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, "Select your country"), COUNTRIES.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }, c))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      right: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "chevron",
    sz: 15,
    col: C.mid,
    style: {
      transform: 'rotate(90deg)'
    }
  })))), LOC_FIELDS(sel.country).map(f => /*#__PURE__*/React.createElement("div", {
    key: f.k
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.ink2,
      fontFamily: C.P,
      marginBottom: 7
    }
  }, f.label), /*#__PURE__*/React.createElement("input", {
    value: sel[f.k] || '',
    onChange: e => setLoc(f.k, e.target.value),
    placeholder: f.ph,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: '15px 16px',
      borderRadius: 13,
      border: `1px solid ${C.line}`,
      background: C.white,
      fontSize: 15.5,
      fontFamily: C.P,
      color: C.ink,
      outline: 'none'
    }
  }))), sel.country && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.4
    }
  }, "Prices and retailers will show in ", cur.sym, " (", cur.code, ").")) :
  /*#__PURE__*/
  /* ── Option rows ── */
  React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, q.opts.map(opt => {
    const on = isSel(opt.id);
    return /*#__PURE__*/React.createElement("div", {
      key: opt.id,
      onClick: () => choose(opt.id),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '15px 16px',
        borderRadius: 14,
        minWidth: 0,
        border: `2px solid ${on ? C.cr : C.line}`,
        background: on ? C.crSoft : C.white,
        cursor: 'pointer',
        transition: 'all .14s'
      }
    }, opt.emoji && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 23,
        flexShrink: 0
      }
    }, opt.emoji), opt.icon && /*#__PURE__*/React.createElement(Icon, {
      n: opt.icon,
      sz: 22,
      col: opt.col || C.mid,
      style: {
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: opt.d ? 16 : 15.5,
        fontWeight: on ? 700 : 600,
        color: on ? C.cr : C.ink,
        fontFamily: C.P,
        lineHeight: 1.2
      }
    }, opt.label), opt.d && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: on ? C.crL : C.mid,
        fontFamily: C.P,
        marginTop: 3,
        lineHeight: 1.35
      }
    }, opt.d)), q.multi ? /*#__PURE__*/React.createElement("div", {
      style: {
        width: 22,
        height: 22,
        borderRadius: 7,
        border: `2px solid ${on ? C.cr : C.line}`,
        background: on ? C.cr : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, on && /*#__PURE__*/React.createElement(Icon, {
      n: "check",
      sz: 12,
      col: "#fff"
    })) : on && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 22,
        height: 22,
        borderRadius: 11,
        background: C.cr,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "check",
      sz: 12,
      col: "#fff"
    })));
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 24px 42px',
      flexShrink: 0,
      background: C.white,
      borderTop: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: hasAnswer ? advance : null,
    style: {
      background: hasAnswer ? C.cr : '#C9C9C9',
      borderRadius: 14,
      padding: '16px',
      textAlign: 'center',
      cursor: hasAnswer ? 'pointer' : 'default',
      boxShadow: hasAnswer ? `0 8px 26px ${C.cr}45` : 'none',
      transition: 'all .2s'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, step < QS.length - 1 ? 'Continue' : 'Finish setup'))));
}
Object.assign(window, {
  OnboardQuestions
});

/* ---- flow-paywall.jsx (precompiled) ---- */
/* Vinterest — New User Flow: Paywall. Two variations.
   Free: 30 scans/mo. Pro: $4.99/mo or $39.99/yr.
   Hero conversion: Sommelier Scripts + Restaurant Mode. */

const SAMPLE_SCRIPT = "I usually go for medium-bodied reds — a Rhône Grenache blend or a good Chianti, nothing too oaky, around the $40 mark. What would you recommend?";

/* Every Pro feature, with Free vs Pro values and a tap-to-expand explanation. */
const PRO_FEATURES = [{
  icon: 'message',
  t: 'Sommelier scripts',
  free: 'Example',
  pro: 'Personalized by wine type',
  detail: 'First-person talking points, written from your taste — so you can order and talk wine with total confidence. Free gives you a worked example; Pro writes scripts personalized to each wine type you drink.'
}, {
  icon: 'list',
  t: 'Restaurant mode',
  free: 'Not included',
  pro: 'Included',
  detail: 'Snap a restaurant’s wine list and instantly see which bottles match your palate, your top picks within budget, and a script to order them.'
}, {
  icon: 'brain',
  t: 'Match scores',
  free: 'Score only',
  pro: 'Score + why',
  detail: 'Every wine gets a personal match score. Pro reveals the reasoning — how its body, tannin, acidity and sweetness line up with your profile.'
}, {
  icon: 'camera',
  t: 'Wine scans',
  free: '30 / month',
  pro: 'Unlimited',
  detail: 'Scan any label for instant identification and tasting notes. Free covers 30 scans a month — about a bottle a day.'
}, {
  icon: 'book',
  t: 'Lessons & articles',
  free: 'Basic quizzes & generic articles',
  pro: 'WSET-inspired tests & personalized articles',
  detail: 'Build your wine knowledge as you go. Free includes basic quizzes and generic articles; Pro unlocks personalized, WSET-inspired tests and articles tuned to the wines you actually scan.'
}, {
  icon: 'fork',
  t: 'Food pairings',
  free: '1 pairing',
  pro: 'All pairings',
  detail: 'What to eat with any wine. Free shows the top pairing; Pro unlocks the full list.'
}];

/* Sample sommelier script card — the bait. */
function SampleScriptCard({
  dark
}) {
  const cardBg = dark ? 'rgba(255,255,255,0.05)' : C.white;
  const border = dark ? 'rgba(255,255,255,0.1)' : C.line;
  const quote = dark ? 'rgba(255,255,255,0.9)' : C.ink2;
  const head = dark ? '#fff' : C.ink;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 16,
      padding: '16px 17px',
      background: cardBg,
      border: `1px solid ${border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 11
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "message",
    sz: 16,
    col: C.crL
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.crL,
      fontFamily: C.P,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }, "Sample sommelier script")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      color: quote,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.6,
      marginBottom: 12
    }
  }, "\u201C", SAMPLE_SCRIPT, "\u201D"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      paddingTop: 12,
      borderTop: `1px solid ${border}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "lock",
    sz: 15,
    col: dark ? 'rgba(255,255,255,0.5)' : C.mid
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      color: dark ? 'rgba(255,255,255,0.5)' : C.mid,
      fontFamily: C.P,
      lineHeight: 1.35
    }
  }, "Pro writes these from ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: head,
      fontWeight: 600
    }
  }, "your"), " taste \u2014 for any wine, any occasion.")));
}

/* Expandable Free-vs-Pro feature list. Tap a row to read what it is. */
function ProFeatureList({
  dark
}) {
  const [open, setOpen] = React.useState(null);
  const line = dark ? 'rgba(255,255,255,0.1)' : C.line;
  const titleC = dark ? '#fff' : C.ink;
  const subFree = dark ? 'rgba(255,255,255,0.45)' : C.mid;
  const detailC = dark ? 'rgba(255,255,255,0.6)' : C.ink2;
  const cardBg = dark ? 'rgba(255,255,255,0.04)' : C.white;
  const proC = dark ? C.crL : C.cr;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${line}`,
      background: cardBg
    }
  }, PRO_FEATURES.map((f, i) => {
    const isOpen = open === i;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        borderBottom: i < PRO_FEATURES.length - 1 ? `1px solid ${line}` : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setOpen(isOpen ? null : i),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 15px',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 36,
        height: 36,
        borderRadius: 10,
        background: dark ? 'rgba(139,26,47,0.3)' : C.crSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: f.icon,
      sz: 18,
      col: proC
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: titleC,
        fontFamily: C.P
      }
    }, f.t), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontFamily: C.P,
        marginTop: 3,
        lineHeight: 1.5
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: subFree
      }
    }, "Free: ", f.free), /*#__PURE__*/React.createElement("div", {
      style: {
        color: proC,
        fontWeight: 600
      }
    }, "Pro: ", f.pro))), /*#__PURE__*/React.createElement("div", {
      style: {
        transform: isOpen ? 'rotate(90deg)' : 'none',
        transition: 'transform .2s',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      n: "chevron",
      sz: 15,
      col: subFree
    }))), isOpen && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 15px 14px 63px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13.5,
        color: detailC,
        fontFamily: C.P,
        lineHeight: 1.5
      }
    }, f.detail)));
  }));
}

/* ── VARIATION A: Sample-script hero + feature list + selectable plan cards ── */
function PaywallVariantA({
  next
}) {
  const [plan, setPlan] = React.useState('annual');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 18px) 24px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: next,
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, "Not now")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 12px',
      borderRadius: 20,
      background: C.crSoft,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P,
      letterSpacing: '0.03em'
    }
  }, "VINTEREST PRO")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 27,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.6px',
      lineHeight: 1.13,
      marginBottom: 18
    }
  }, "Order like you\u2019ve", /*#__PURE__*/React.createElement("br", null), "been doing it for years."), /*#__PURE__*/React.createElement(SampleScriptCard, null), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      margin: '24px 0 11px'
    }
  }, "What you get \xB7 tap to learn more"), /*#__PURE__*/React.createElement(ProFeatureList, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 11,
      marginTop: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setPlan('annual'),
    style: {
      position: 'relative',
      borderRadius: 16,
      padding: '17px 18px',
      border: `2px solid ${plan === 'annual' ? C.cr : C.line}`,
      background: plan === 'annual' ? C.crSoft : C.white,
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -11,
      left: 18,
      background: C.cr,
      borderRadius: 20,
      padding: '3px 11px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '0.03em'
    }
  }, "SAVE 33%")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Annual"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 2
    }
  }, "$3.33 / month, billed yearly")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px'
    }
  }, "$39.99"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "per year")))), /*#__PURE__*/React.createElement("div", {
    onClick: () => setPlan('monthly'),
    style: {
      borderRadius: 16,
      padding: '17px 18px',
      border: `2px solid ${plan === 'monthly' ? C.cr : C.line}`,
      background: plan === 'monthly' ? C.crSoft : C.white,
      cursor: 'pointer',
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Monthly"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13.5,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 2
    }
  }, "Cancel anytime")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px'
    }
  }, "$4.99"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "per month"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 13,
      fontSize: 12.5,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Upgrade anytime \xB7 cancel anytime on monthly")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 24px 40px',
      flexShrink: 0,
      background: C.white,
      borderTop: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      background: C.cr,
      borderRadius: 14,
      padding: '16px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 8px 26px ${C.cr}45`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, plan === 'annual' ? 'Start Pro · $39.99/yr' : 'Start Pro · $4.99/mo')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: next,
    style: {
      fontSize: 14,
      color: C.mid,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Continue with Free \xB7 30 scans/mo"))));
}

/* ── VARIATION B: Dark hero, sample script + expandable feature list + billing toggle ── */
function PaywallVariantB({
  next
}) {
  const [billing, setBilling] = React.useState('annual');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: '#0F0F0F',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: -80,
      right: -80,
      width: 280,
      height: 280,
      borderRadius: 140,
      background: `${C.cr}26`,
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 'calc(env(safe-area-inset-top) + 18px) 24px 16px',
      position: 'relative',
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: next,
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      fontWeight: 500,
      cursor: 'pointer'
    }
  }, "Not now")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 29,
      fontWeight: 800,
      color: '#fff',
      fontFamily: C.P,
      letterSpacing: '-0.7px',
      lineHeight: 1.1,
      marginBottom: 8
    }
  }, "Never freeze at the", /*#__PURE__*/React.createElement("br", null), "wine list again."), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15.5,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 20
    }
  }, "Pro scans the list, picks for your taste, and hands you the words."), /*#__PURE__*/React.createElement(SampleScriptCard, {
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      margin: '22px 0 11px'
    }
  }, "What you get \xB7 tap to learn more"), /*#__PURE__*/React.createElement(ProFeatureList, {
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: 4,
      borderRadius: 13,
      background: 'rgba(255,255,255,0.06)',
      marginTop: 22
    }
  }, [['annual', 'Annual', '$39.99/yr'], ['monthly', 'Monthly', '$4.99/mo']].map(([id, label, price]) => {
    const on = billing === id;
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      onClick: () => setBilling(id),
      style: {
        flex: 1,
        borderRadius: 10,
        padding: '11px 8px',
        textAlign: 'center',
        background: on ? '#fff' : 'transparent',
        cursor: 'pointer',
        transition: 'all .15s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14.5,
        fontWeight: 700,
        color: on ? C.ink : 'rgba(255,255,255,0.7)',
        fontFamily: C.P
      }
    }, label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12.5,
        color: on ? C.mid : 'rgba(255,255,255,0.4)',
        fontFamily: C.P,
        marginTop: 2
      }
    }, price, id === 'annual' && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.green,
        fontWeight: 600
      }
    }, " \xB7 save 33%")));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 13,
      fontSize: 12.5,
      color: 'rgba(255,255,255,0.4)',
      fontFamily: C.P
    }
  }, "Upgrade anytime \xB7 cancel anytime on monthly")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 24px 40px',
      flexShrink: 0,
      position: 'relative',
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: next,
    style: {
      background: C.cr,
      borderRadius: 14,
      padding: '16px',
      textAlign: 'center',
      cursor: 'pointer',
      boxShadow: `0 8px 30px ${C.cr}60`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Start Pro \xB7 ", billing === 'annual' ? '$39.99/yr' : '$4.99/mo')), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: next,
    style: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.45)',
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "Continue with Free \xB7 30 scans/mo"))));
}
function PaywallScreen({
  next,
  variant
}) {
  return variant === 'B' ? /*#__PURE__*/React.createElement(PaywallVariantB, {
    next: next
  }) : /*#__PURE__*/React.createElement(PaywallVariantA, {
    next: next
  });
}

/* ── Done screen ── */
function DoneScreen({
  restart
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 32px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 84,
      height: 84,
      borderRadius: 42,
      background: C.green,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 26,
      boxShadow: `0 12px 36px ${C.green}45`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 40,
    col: "#fff"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 27,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px',
      marginBottom: 10
    }
  }, "You\u2019re all set"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.55,
      maxWidth: 280,
      marginBottom: 32
    }
  }, "Your account is ready and your first scan is saved. Time to explore."), /*#__PURE__*/React.createElement("div", {
    onClick: restart,
    style: {
      background: C.cr,
      borderRadius: 14,
      padding: '15px 32px',
      cursor: 'pointer',
      boxShadow: `0 8px 26px ${C.cr}45`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Replay the flow")));
}
Object.assign(window, {
  PaywallScreen,
  DoneScreen,
  SampleScriptCard
});

/* ---- pwa-newflow.jsx (precompiled) ---- */
/* Vinterest — New user onboarding flow
   welcome → demo scan → sign up → setup questions → Pro, then into the app.
   Composes the flow-*.jsx screens (WelcomeScreen, DemoScanScreen, AuthScreen,
   OnboardQuestions, PaywallScreen) used in the New User Flow prototype. */

function NewUserFlow({
  onComplete
}) {
  const [step, setStep] = React.useState('welcome');
  const go = k => {
    try {
      window.scrollTo(0, 0);
    } catch (e) {}
    setStep(k);
  };

  // Save the answers from the setup questions so the rest of the app is personalized.
  function persist(answers) {
    try {
      if (!answers) return;
      localStorage.setItem('vinterest_prefs', JSON.stringify(answers));
      const loc = answers.location || {};
      const c = (loc.country || '').toLowerCase();
      // App supports these retail regions: uk · us · ontario · australia · nz · eu (France/Germany/Italy/Spain all price in EUR)
      const map = {
        'united states': 'us',
        'canada': 'ontario',
        'united kingdom': 'uk',
        'australia': 'australia',
        'new zealand': 'nz',
        'france': 'eu',
        'germany': 'eu',
        'italy': 'eu',
        'spain': 'eu'
      };
      localStorage.setItem('vinterest_region', map[c] || 'us');
      // vinterest_currency mirrors vinterest_region's currency — kept in sync so nothing reads a stale value
      const curMap = {
        'uk': 'GBP',
        'us': 'USD',
        'ontario': 'CAD',
        'australia': 'AUD',
        'nz': 'NZD',
        'eu': 'EUR'
      };
      localStorage.setItem('vinterest_currency', curMap[map[c] || 'us']);
      if (loc.country) localStorage.setItem('vinterest_country', loc.country);
      if (loc.region) localStorage.setItem('vinterest_state', loc.region);
      if (loc.city) localStorage.setItem('vinterest_city', loc.city);
      const types = answers.types || [];
      if (types.length) localStorage.setItem('vinterest_initial_pref', types[0]);
    } catch (e) {}
  }
  function finish() {
    if (!localStorage.getItem('vinterest_region')) localStorage.setItem('vinterest_region', 'uk');
    onComplete();
  }
  switch (step) {
    case 'welcome':
      return /*#__PURE__*/React.createElement(WelcomeScreen, {
        next: () => go('scan')
      });
    case 'scan':
      return /*#__PURE__*/React.createElement(ScanScreen, {
        nav: () => {},
        back: () => go('welcome'),
        onComplete: () => go('auth')
      });
    case 'auth':
      return /*#__PURE__*/React.createElement(AuthScreen, {
        variant: "A",
        next: () => go('onboard')
      });
    case 'onboard':
      return /*#__PURE__*/React.createElement(OnboardQuestions, {
        next: () => go('paywall'),
        onAnswers: a => {
          persist(a);
          go('paywall');
        }
      });
    case 'paywall':
      return /*#__PURE__*/React.createElement(PaywallScreen, {
        variant: "A",
        next: finish
      });
    default:
      return null;
  }
}
Object.assign(window, {
  NewUserFlow
});

/* ---- pwa-screens-learn.jsx (precompiled) ---- */
/* Vinterest — On-Ramp Article Screen (data-driven from data/onramp.json) */
function _loadText(path) {
  const x = new XMLHttpRequest();
  x.open('GET', path, false);
  x.send();
  return x.responseText;
}
function _fillTpl(tpl, vars) {
  let s = tpl;
  Object.keys(vars).forEach(k => {
    s = s.split('{{' + k + '}}').join(vars[k] ?? '');
  });
  return s;
}
const ON_RAMP = _loadJSON('data/onramp.json');
function onRampDone(id) {
  return !!localStorage.getItem('vinterest_' + id + '_done');
}
function onRampProgress() {
  return ON_RAMP.filter(a => onRampDone(a.id)).length;
}
function LearnArticleScreen({
  nav,
  back
}) {
  const idx = React.useMemo(() => {
    const i = parseInt(sessionStorage.getItem('vinterest_onramp_idx') || '0', 10);
    return isNaN(i) ? 0 : Math.min(i, ON_RAMP.length - 1);
  }, []);
  const article = ON_RAMP[idx];
  const [completed, setCompleted] = React.useState(() => onRampDone(article.id));
  function markRead() {
    if (completed) return;
    XPSystem.awardAndToast([{
      type: 'article',
      articleKey: article.id
    }]);
    localStorage.setItem('vinterest_' + article.id + '_done', '1');
    setCompleted(true);
  }
  const nextArticle = ON_RAMP.find(a => !onRampDone(a.id) && a.id !== article.id);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontWeight: 500
    }
  }, "On-Ramp \xB7 ", article.readTime)), completed && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, "\u2713 +50 XP")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.ink,
      padding: '24px 20px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 20,
      background: 'rgba(255,255,255,0.1)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "book",
    sz: 12,
    col: "rgba(255,255,255,0.55)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.55)',
      fontFamily: C.P
    }
  }, "Quick Read")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 28,
      fontWeight: 400,
      color: '#fff',
      fontFamily: C.serif,
      lineHeight: 1.2,
      marginBottom: 10
    }
  }, article.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.42)',
      fontFamily: C.P,
      lineHeight: 1.65
    }
  }, article.subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, article.sections.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.white,
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 0',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: s.iconName,
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, s.term), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      marginBottom: 10
    }
  }, s.plain))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.7
    }
  }, s.detail), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.offWhite,
      borderRadius: 10,
      padding: '10px 14px'
    }
  }, s.examples.map((ex, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      marginBottom: j < s.examples.length - 1 ? 6 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 4,
      height: 4,
      borderRadius: 2,
      background: C.cr,
      marginTop: 9,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, ex))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: completed ? C.greenBg : C.crSoft,
      borderRadius: 16,
      padding: '18px 16px',
      textAlign: 'center',
      border: `1px solid ${completed ? C.green + '30' : C.crDim}`
    }
  }, completed ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 28,
      background: C.greenBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 8px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 26,
    col: C.green
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Nice work!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.55,
      marginBottom: 14
    }
  }, nextArticle ? 'On to the next one whenever you\'re ready.' : 'That\'s the whole on-ramp — your shelf takes it from here.'), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => nav('learn')
  }, "Back to Learn"), nextArticle && /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: () => {
      sessionStorage.setItem('vinterest_onramp_idx', String(ON_RAMP.indexOf(nextArticle)));
      nav('article');
    }
  }, "Next read"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Finished reading?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Mark as complete to earn +50 XP"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: markRead
  }, "Mark as Read \xB7 +50 XP"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }))));
}
Object.assign(window, {
  LearnArticleScreen
});

/* ── GENERATED ARTICLE SCREEN ── */
function GenArticleScreen({
  nav,
  back
}) {
  const stub = React.useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('vinterest_gen_article') || 'null');
    } catch (e) {
      return null;
    }
  }, []);
  const doneKey = stub ? `vinterest_gen_article_${stub.id}_done` : null;
  const cacheKey = stub ? `vinterest_gen_article_${stub.id}_content` : null;
  const [completed, setCompleted] = React.useState(() => !!localStorage.getItem(doneKey));
  const [sections, setSections] = React.useState(() => {
    if (!cacheKey) return null;
    try {
      return JSON.parse(localStorage.getItem(cacheKey) || 'null');
    } catch (e) {
      return null;
    }
  });
  const [generating, setGenerating] = React.useState(false);
  React.useEffect(() => {
    if (!stub || sections || generating) return;
    setGenerating(true);
    const wines = WineHistory.getAll();
    const types = [...new Set(wines.map(w => (w.type || 'red').toLowerCase()))].join(', ');
    const regions = [...new Set(wines.map(w => w.region || w.country).filter(Boolean))].slice(0, 5).join(', ');
    const grapes = [...new Set(wines.flatMap(w => w.grapes || []).filter(Boolean))].slice(0, 6).join(', ');
    const prompt = _fillTpl(_loadText('prompts/gen-article.txt'), {
      types,
      regions,
      grapes,
      title: stub.title,
      brief: stub.brief || 'Write a clear, specific educational piece on the title above.',
      facts: stub.facts || 'No specific retrieved facts — keep claims general and hedge appropriately.'
    });
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      try {
        let clean = text.replace(/```json|```/g, '').trim();
        const s = clean.indexOf('{'),
          e = clean.lastIndexOf('}');
        if (s >= 0 && e > s) clean = clean.slice(s, e + 1);
        const parsed = JSON.parse(clean);
        const secs = parsed.sections || [];
        localStorage.setItem(cacheKey, JSON.stringify(secs));
        setSections(secs);
      } catch (err) {}
    }).catch(() => {}).finally(() => setGenerating(false));
  }, [stub?.id]);
  function markRead() {
    if (completed || !doneKey) return;
    XPSystem.awardAndToast([{
      type: 'article',
      articleKey: stub.id
    }]);
    localStorage.setItem(doneKey, '1');
    setCompleted(true);
  }
  if (!stub) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Article not found."));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontWeight: 500
    }
  }, "Your Reading List \xB7 ", stub.readTime)), completed && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, "\u2713 +50 XP")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.ink,
      padding: '24px 20px 22px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 12px',
      borderRadius: 20,
      background: 'rgba(255,255,255,0.1)',
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: stub.iconName || 'read',
    sz: 14,
    col: "rgba(255,255,255,0.6)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.55)',
      fontFamily: C.P
    }
  }, "Personalised for You")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 26,
      fontWeight: 800,
      color: '#fff',
      fontFamily: C.P,
      lineHeight: 1.2,
      marginBottom: 10
    }
  }, stub.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.5)',
      fontFamily: C.P,
      lineHeight: 1.65
    }
  }, stub.subtitle)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, generating && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: 9,
      border: `2px solid ${C.cr}`,
      borderTopColor: 'transparent',
      animation: 'storySpin .8s linear infinite'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      textAlign: 'center'
    }
  }, "Writing your personalised article\u2026")), sections && sections.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: C.white,
      borderRadius: 16,
      overflow: 'hidden',
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 0',
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 12,
      background: C.offWhite,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: s.iconName || 'read',
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 21,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 3
    }
  }, s.term), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      marginBottom: 10
    }
  }, s.plain))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.7
    }
  }, s.detail), s.examples && s.examples.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.offWhite,
      borderRadius: 10,
      padding: '10px 14px'
    }
  }, s.examples.map((ex, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      marginBottom: j < s.examples.length - 1 ? 6 : 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 4,
      height: 4,
      borderRadius: 2,
      background: C.cr,
      marginTop: 9,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, ex))))))), sections && /*#__PURE__*/React.createElement("div", {
    style: {
      background: completed ? C.greenBg : C.crSoft,
      borderRadius: 16,
      padding: '18px 16px',
      textAlign: 'center',
      border: `1px solid ${completed ? C.green + '30' : C.crDim}`
    }
  }, completed ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 28,
      background: C.greenBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 8px'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "check",
    sz: 26,
    col: C.green
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Article complete!"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.55,
      marginBottom: 14
    }
  }, "Keep exploring your reading list for more personalised content."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    onClick: () => nav('learn')
  }, "Reading List"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    onClick: () => nav('camera')
  }, "Scan a bottle"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Finished reading?"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.5,
      marginBottom: 14
    }
  }, "Mark as complete to earn +50 XP"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: markRead
  }, "Mark as Read \xB7 +50 XP"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }))));
}
Object.assign(window, {
  LearnArticleScreen,
  GenArticleScreen
});

/* ---- pwa-screens-home.jsx (precompiled) ---- */
/* Vinterest PWA — Home screen */

function _dnaPromptPool(wines) {
  const generic = ["What does \u2018tannic\u2019 mean?", "What's the difference between Malbec and Merlot?", "Should red wine be chilled?", "Why does wine get \u2018legs\u2019 in the glass?", "What does \u2018dry\u2019 mean for wine?", "How long should wine breathe before drinking?", "What's the difference between Old World and New World wine?", "Why do some wines use screw caps instead of corks?"];
  const pool = [];
  if (wines && wines.length >= 3) {
    const grapeCounts = {},
      regionCounts = {},
      typeCounts = {};
    wines.forEach(w => {
      (w.grapes || []).forEach(g => {
        if (g) grapeCounts[g] = (grapeCounts[g] || 0) + 1;
      });
      if (w.region) regionCounts[w.region] = (regionCounts[w.region] || 0) + 1;
      const t = (w.type || '').toLowerCase();
      if (t) typeCounts[t] = (typeCounts[t] || 0) + 1;
    });
    const typeLabels = {
      red: 'red',
      white: 'white',
      rose: 'ros\u00e9',
      sparkling: 'sparkling',
      orange: 'orange',
      dessert: 'dessert',
      fortified: 'fortified'
    };
    const topGrapes = Object.entries(grapeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const topRegions = Object.entries(regionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
    topGrapes.forEach(g => {
      pool.push(`Why do I keep picking ${g}?`);
      pool.push(`What food pairs well with ${g}?`);
    });
    topRegions.forEach(r => {
      pool.push(`What food pairs well with wine from ${r}?`);
      pool.push(`What makes wine from ${r} distinctive?`);
    });
    if (topGrapes[0] && topRegions[0]) pool.push(`What's special about ${topGrapes[0]} from ${topRegions[0]}?`);
    topTypes.forEach(t => {
      if (typeLabels[t]) pool.push(`What should I try if I love ${typeLabels[t]} wine?`);
    });
  }
  generic.forEach(g => pool.push(g));
  return [...new Set(pool)].slice(0, 12);
}
function WineChatWidget({
  wines
}) {
  const [q, setQ] = React.useState('');
  const [asking, setAsking] = React.useState(false);
  const [asked, setAsked] = React.useState('');
  const [answer, setAnswer] = React.useState('');
  const [err, setErr] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const prompts = React.useMemo(() => {
    const pool = _dnaPromptPool(wines);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  }, [wines?.length]);
  const [pIdx, setPIdx] = React.useState(0);
  const [typed, setTyped] = React.useState('');
  const [tPhase, setTPhase] = React.useState('typing');
  const [exhausted, setExhausted] = React.useState(false);
  const idle = !asking && !answer && !err && !q && !focused && !exhausted;
  React.useEffect(() => {
    if (!idle) return;
    const current = prompts[pIdx] || '';
    let timer;
    if (tPhase === 'typing') {
      if (typed.length < current.length) timer = setTimeout(() => setTyped(current.slice(0, typed.length + 1)), 32);else timer = setTimeout(() => setTPhase('deleting'), 1700);
    } else {
      if (typed.length > 0) timer = setTimeout(() => setTyped(typed.slice(0, -1)), 16);else if (pIdx + 1 < prompts.length) {
        setPIdx(i => i + 1);
        setTPhase('typing');
      } else setExhausted(true);
    }
    return () => clearTimeout(timer);
  }, [idle, typed, tPhase, pIdx, prompts]);
  function doAsk(question) {
    if (!question || asking) return;
    setAsking(true);
    setErr(false);
    setAnswer('');
    setAsked(question);
    setQ('');
    const prompt = `You are a concise wine assistant inside a wine app's home screen. Answer ONLY questions about wine — grape varieties, tasting, pairing, service, regions, production. You may also address food pairing and other alcoholic drinks, but only in service of a wine question (e.g. "what beer pairs with steak alongside a Malbec" is fine). If the question is unrelated to wine, food pairing, or alcohol, do not answer it — instead respond with one short, friendly sentence redirecting back to wine topics. Otherwise answer in 2-4 clear, conversational sentences. Plain prose, no markdown, no lists, no headers.\n\nQuestion: "${question}"`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => setAnswer(text.trim())).catch(() => setErr(true)).finally(() => setAsking(false));
  }
  function ask(e) {
    e.preventDefault();
    doAsk(q.trim());
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '0 16px 8px'
    }
  }, /*#__PURE__*/React.createElement("form", {
    onSubmit: ask,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: '#000',
      border: '1px solid #000',
      borderRadius: 24,
      padding: '6px 6px 6px 18px',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      position: 'relative',
      height: 22
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: q,
    onChange: e => setQ(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    placeholder: "Ask Vinny about a wine...",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: 16,
      fontFamily: C.P,
      color: '#fff'
    }
  }), idle && /*#__PURE__*/React.createElement("div", {
    onClick: () => doAsk(prompts[pIdx]),
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      background: '#000',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.75)',
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, typed, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-block',
      width: 1.5,
      height: 15,
      background: 'rgba(255,255,255,0.75)',
      marginLeft: 2,
      verticalAlign: '-2px',
      animation: 'homeCaret 0.9s step-end infinite'
    }
  })))), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    disabled: asking || !q.trim(),
    "aria-label": "Ask",
    style: {
      width: 38,
      height: 38,
      borderRadius: 19,
      border: 'none',
      background: q.trim() ? C.cr : 'rgba(255,255,255,0.18)',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: q.trim() ? 'pointer' : 'default',
      padding: 0
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 20 20"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M3 10h13M10 4l6.5 6L10 16",
    stroke: "#fff",
    strokeWidth: "1.8",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: asking || answer || err ? 400 : 0,
      opacity: asking || answer || err ? 1 : 0,
      overflow: 'hidden',
      transition: 'max-height 0.35s ease,opacity 0.3s ease,margin-top 0.35s ease',
      marginTop: asking || answer || err ? 10 : 0
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      position: 'relative',
      background: '#000'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => {
      setAnswer('');
      setAsked('');
      setErr(false);
    },
    style: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 24,
      height: 24,
      borderRadius: 12,
      background: 'rgba(255,255,255,0.12)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 20 20"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 4l12 12M16 4L4 16",
    stroke: "#fff",
    strokeWidth: "1.8",
    strokeLinecap: "round"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'rgba(255,255,255,0.55)',
      fontFamily: C.P,
      marginBottom: 6,
      paddingRight: 24
    }
  }, asked), asking ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.7)',
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Thinking\u2026") : err ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.7)',
      fontFamily: C.P
    }
  }, "Couldn't get an answer \u2014 try again.") : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: '#fff',
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, answer))));
}
function HomeScreen({
  nav,
  showPro,
  isTablet
}) {
  const [travel, setTravel] = React.useState(() => Regional.travel());
  React.useEffect(() => {
    const h = () => setTravel(Regional.travel());
    window.addEventListener('vinterest:travel', h);
    return () => window.removeEventListener('vinterest:travel', h);
  }, []);
  const [genScripts, setGenScripts] = React.useState({});
  const [scriptLength, setScriptLength] = React.useState(localStorage.getItem('vinterest_script_length') || 'long');
  const [generating, setGenerating] = React.useState(null);
  const [xpData, setXpData] = React.useState(() => XPSystem.get());
  React.useEffect(() => {
    const h = () => setXpData(XPSystem.get());
    window.addEventListener('vinterest:xp', h);
    return () => window.removeEventListener('vinterest:xp', h);
  }, []);
  const allWines = WineHistory.getAll();
  const isPro = !!localStorage.getItem('vinterest_pro');
  const scanCount = parseInt(localStorage.getItem('vinterest_scan_count') || '0');
  const FREE_SCANS = 10;
  const atLimit = !isPro && scanCount >= FREE_SCANS;
  const cats = [{
    col: '#8B1A2F',
    label: 'Reds',
    typeKey: 'red'
  }, {
    col: '#B8963E',
    label: 'Whites',
    typeKey: 'white'
  }, {
    col: '#C47A8A',
    label: 'Rosé',
    typeKey: 'rose'
  }, {
    col: '#5E8FA8',
    label: 'Sparkling',
    typeKey: 'sparkling'
  }, {
    col: '#C1652B',
    label: 'Orange',
    typeKey: 'orange'
  }, {
    col: '#8A5A2B',
    label: 'Dessert',
    typeKey: 'dessert'
  }, {
    col: '#5C2A1E',
    label: 'Fortified',
    typeKey: 'fortified'
  }];
  const _BASE_TYPES = ['red', 'white', 'rose', 'sparkling'];
  /* Explore suggestion based on dominant type */
  const typeCounts = {
    red: 0,
    white: 0,
    rose: 0,
    sparkling: 0,
    orange: 0,
    dessert: 0,
    fortified: 0
  };
  allWines.forEach(w => {
    const t = (w.type || '').toLowerCase().replace('é', 'e');
    if (typeCounts[t] !== undefined) typeCounts[t]++;
  });
  // The original four always show (greyed out if unscanned); Orange/Dessert/Fortified only appear once you've actually scanned one.
  const visibleCats = cats.filter(ct => _BASE_TYPES.includes(ct.typeKey) || typeCounts[ct.typeKey] > 0);
  const [activeType, setActiveType] = React.useState('red');
  const [tabToast, setTabToast] = React.useState(null);
  function pickType(ct) {
    if (typeCounts[ct.typeKey] === 0) {
      setTabToast(`You haven't scanned a ${ct.label.toLowerCase()} yet`);
      setTimeout(() => setTabToast(null), 1800);
      return;
    }
    setActiveType(ct.typeKey);
  }
  const c = cats.find(ct => ct.typeKey === activeType) || cats[0];
  const tabWines = allWines.filter(w => (w.type || '').toLowerCase().replace('é', 'e') === c.typeKey);
  const topWines = [...tabWines].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);

  /* Recently scanned — any type, by date, show even if dates missing */
  const recentWines = React.useMemo(() => [...allWines].sort((a, b) => new Date(b.last_scanned || b.scanned_at || 0) - new Date(a.last_scanned || a.scanned_at || 0)).slice(0, 3), [allWines.length]);
  const primaryType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'red';
  const exploreSuggestions = {
    red: {
      title: 'Try a White This Week',
      body: 'Your structured palate would suit a bone-dry Chablis or aged white Burgundy.'
    },
    white: {
      title: 'Venture into Reds',
      body: 'Your palate for whites points toward elegant Pinot Noir or light Beaujolais.'
    },
    rose: {
      title: 'Go Sparkling',
      body: 'Your dry rosé palate points to Champagne — similar freshness, better stories.'
    },
    sparkling: {
      title: 'Explore Still Wines',
      body: 'Your palate for fine bubbles translates beautifully to quality Burgundy stills.'
    },
    orange: {
      title: 'Try a Classic White',
      body: 'Your taste for skin-contact texture points to aged white Rioja — similar depth, without the funk.'
    },
    dessert: {
      title: 'Try a Fortified Wine',
      body: 'Your dessert wine palate points to Tawny Port — same richness, more nutty complexity.'
    },
    fortified: {
      title: 'Try a Dessert Wine',
      body: 'Your taste for Port or Sherry points to Sauternes or Tokaji — similar richness, without the fortification.'
    }
  };
  const explore = exploreSuggestions[primaryType] || exploreSuggestions.red;

  /* XP */
  const lv = XPSystem.getLevel(xpData.total);
  const nx = XPSystem.nextLevel(xpData.total);
  const pg = XPSystem.levelProgress(xpData.total);

  /* Script generation — the LONG script is the single source of truth; the SHORT script is always
     derived by condensing that exact long text (never generated independently), so facts like the
     budget range can never disagree between the two lengths. */
  React.useEffect(() => {
    if (!tabWines.length) return;
    const _rc = Regional.current();
    const _base = _rc.base;
    const _code = _rc.code;
    const keyLong = `vinterest_script_long_${c.typeKey}_n${tabWines.length}_${_rc.code}_v3`;
    const keyShort = `vinterest_script_short_${c.typeKey}_n${tabWines.length}_${_rc.code}_v3`;
    const cachedLong = localStorage.getItem(keyLong);
    const cachedShort = localStorage.getItem(keyShort);
    function makeShortFrom(longText) {
      if (generating === c.typeKey + '_short') return;
      setGenerating(c.typeKey + '_short');
      const prompt = `Condense this sommelier script into ONE ultra-concise sentence (under 20 words), keeping the SAME facts, style, regions and budget range verbatim — do not invent a new budget number, only reuse the one already stated (or omit it if none was stated). Script: ${longText} Return ONLY the condensed script text in double quotes — nothing else.`;
      window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      }).then(text => {
        const sc = text.trim();
        localStorage.setItem(keyShort, sc);
        if (scriptLength === 'short') setGenScripts(g => ({
          ...g,
          [c.typeKey]: sc
        }));
      }).catch(() => {}).finally(() => setGenerating(null));
    }
    if (scriptLength === 'long') {
      if (cachedLong) {
        setGenScripts(s => ({
          ...s,
          [c.typeKey]: cachedLong
        }));
        return;
      }
      if (generating === c.typeKey) return;
      setGenerating(c.typeKey);
      const wineList = tabWines.slice(0, 8).map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''} from ${w.region || w.country || 'unknown'}`).join('; ');
      const prompt = `I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a 2 sentences max natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_base} symbol plus the ${_code} code (e.g. "${_base}40–${_base}80 ${_code}") — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
      window.claude.complete({
        messages: [{
          role: 'user',
          content: prompt
        }]
      }).then(text => {
        const sc = text.trim();
        localStorage.setItem(keyLong, sc);
        setGenScripts(g => ({
          ...g,
          [c.typeKey]: sc
        }));
      }).catch(() => {}).finally(() => setGenerating(null));
      return;
    }

    // scriptLength==='short'
    if (cachedShort) {
      setGenScripts(s => ({
        ...s,
        [c.typeKey]: cachedShort
      }));
      return;
    }
    if (cachedLong) {
      makeShortFrom(cachedLong);
      return;
    }
    // No long script yet — generate it first, then derive short from it.
    if (generating === c.typeKey) return;
    setGenerating(c.typeKey);
    const wineList = tabWines.slice(0, 8).map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''} from ${w.region || w.country || 'unknown'}`).join('; ');
    const prompt = `I've scanned these ${c.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a 2 sentences max natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_base} symbol plus the ${_code} code (e.g. "${_base}40–${_base}80 ${_code}") — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      const sc = text.trim();
      localStorage.setItem(keyLong, sc);
      setGenerating(null);
      makeShortFrom(sc);
    }).catch(() => setGenerating(null));
  }, [activeType, allWines.length, scriptLength]);
  const typeColors = {
    red: '#8B1A2F',
    white: '#B8963E',
    rosé: '#C47A8A',
    rose: '#C47A8A',
    sparkling: '#5E8FA8',
    orange: '#C1652B',
    dessert: '#8A5A2B',
    fortified: '#5C2A1E'
  };
  const colFor = w => typeColors[(w.type || 'red').toLowerCase().replace('é', 'e')] || C.cr;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: C.bg,
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px 14px',
      paddingRight: '120px',
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('account'),
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "user",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("img", {
    src: "logo.png",
    alt: "Vinterest",
    style: {
      height: 28,
      width: 'auto',
      display: 'block',
      cursor: 'pointer'
    },
    onClick: () => {
      if (!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.getRegistration().then(function (reg) {
        if (!reg) return;
        reg.update().then(function () {
          if (reg.waiting) {
            var banner = document.getElementById('vinterest-update-banner');
            if (banner) banner.style.display = 'flex';
          } else {
            // Listen for a new SW found after update check
            reg.addEventListener('updatefound', function () {
              var nw = reg.installing;
              nw.addEventListener('statechange', function () {
                if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                  var banner = document.getElementById('vinterest-update-banner');
                  if (banner) banner.style.display = 'flex';
                }
              });
            });
          }
        });
      });
    }
  })), !isTablet && /*#__PURE__*/React.createElement(WineChatWidget, {
    wines: allWines
  })), travel && /*#__PURE__*/React.createElement("div", {
    onClick: () => nav('account'),
    style: {
      background: C.cr,
      padding: '6px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "compass",
    sz: 12,
    col: "#fff"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P
    }
  }, "Travel Mode On \u2014 ", travel.country)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      overscrollBehavior: 'none',
      WebkitOverflowScrolling: 'touch'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '8px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, recentWines.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden',
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px 7px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Recently Scanned"), /*#__PURE__*/React.createElement("span", {
    onClick: () => nav('mywines'),
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "All \u2192")), recentWines.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => {
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: false,
        wine: w,
        confidence: 0.9,
        existingRating: w.rating || 0
      }));
      nav('detail');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 14px',
      borderTop: `1px solid ${C.line}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 44,
      borderRadius: 7,
      background: colFor(w) + '15',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${colFor(w)}20`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 14,
    col: colFor(w)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, [w.region, w.vintage ? String(w.vintage) : null].filter(Boolean).join(' · '))), w.rating > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.amber,
      fontFamily: C.P,
      flexShrink: 0
    }
  }, w.rating) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.cr,
      fontFamily: C.P,
      flexShrink: 0,
      fontWeight: 600
    }
  }, "Rate \u2192")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, cats.slice(0, 4).map((ct, i) => {
    const disabled = typeCounts[ct.typeKey] === 0;
    const active = ct.typeKey === activeType;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => pickType(ct),
      style: {
        flex: 1,
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: 10,
        background: active ? ct.col + '18' : C.offWhite,
        border: `1.5px solid ${active ? ct.col + '55' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all .15s',
        opacity: disabled ? 0.4 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: ct.col,
        margin: '0 auto 3px'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? ct.col : C.mid,
        fontFamily: C.P
      }
    }, ct.label));
  })), visibleCats.length > 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6
    }
  }, visibleCats.slice(4).map((ct, i) => {
    const active = ct.typeKey === activeType;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => pickType(ct),
      style: {
        flex: 1,
        textAlign: 'center',
        padding: '8px 4px',
        borderRadius: 10,
        background: active ? ct.col + '18' : C.offWhite,
        border: `1.5px solid ${active ? ct.col + '55' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all .15s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: ct.col,
        margin: '0 auto 3px'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        color: active ? ct.col : C.mid,
        fontFamily: C.P
      }
    }, ct.label));
  }))), /*#__PURE__*/React.createElement(Card, {
    style: {
      background: c.col + '0D',
      border: `1.5px solid ${c.col}25`,
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "message",
    sz: 14,
    col: c.col
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your ", c.label, " Script")), tabWines.length > 0 && !generating && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      background: C.offWhite,
      borderRadius: 6,
      padding: '3px 4px',
      border: `1px solid ${C.line}`
    }
  }, ['short', 'long'].map(len => /*#__PURE__*/React.createElement("div", {
    key: len,
    onClick: () => {
      setScriptLength(len);
      localStorage.setItem('vinterest_script_length', len);
    },
    style: {
      padding: '4px 8px',
      borderRadius: 4,
      background: scriptLength === len ? C.cr : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: scriptLength === len ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, len.charAt(0).toUpperCase() + len.slice(1)))))), tabWines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.6
    }
  }, "Scan and rate some ", c.label.toLowerCase(), " to generate your personalised sommelier script.") : generating === c.typeKey || generating === c.typeKey + '_short' ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 7,
      border: '2px solid rgba(0,0,0,0.08)',
      borderTopColor: c.col,
      animation: 'homeSpin .8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Writing\u2026")) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.65
    }
  }, genScripts[c.typeKey] || 'Script generating…')), topWines.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '10px 14px 6px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Top ", c.label), /*#__PURE__*/React.createElement("span", {
    onClick: () => nav('mywines'),
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "See all \u2192")), topWines.map((w, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => {
      sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
        demo: false,
        wine: w,
        confidence: 0.9,
        existingRating: w.rating || 0
      }));
      nav('detail');
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '9px 14px',
      borderTop: `1px solid ${C.line}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 28,
      height: 38,
      borderRadius: 6,
      background: c.col + '15',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 12,
    col: c.col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, [w.region, w.vintage ? String(w.vintage) : null].filter(Boolean).join(' · '))), w.rating > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.amber,
      fontFamily: C.P,
      flexShrink: 0
    }
  }, w.rating))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      padding: 12,
      cursor: 'pointer'
    },
    onClick: () => nav('learn')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Take a Quiz"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 7
    }
  }, "Learn wine \xB7 Earn XP"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '3px 9px',
      borderRadius: 20,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, "+ XP"))), /*#__PURE__*/React.createElement(Card, {
    style: {
      flex: 1,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, lv.badge, " ", lv.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 7
    }
  }, xpData.total, " XP", nx ? ` · ${nx.min - xpData.total} to go` : ''), /*#__PURE__*/React.createElement(Prog, {
    val: pg,
    h: 5,
    col: C.cr
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))), tabToast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 14,
      left: 16,
      right: 16,
      textAlign: 'center',
      fontSize: 14.5,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      background: C.cr,
      borderRadius: 12,
      padding: '12px 16px',
      zIndex: 250,
      boxShadow: '0 6px 18px rgba(139,26,47,0.35)',
      animation: 'homeToast 1.8s ease forwards'
    }
  }, tabToast), /*#__PURE__*/React.createElement("style", null, `@keyframes homeSpin{to{transform:rotate(360deg)}}
@keyframes homeToast{0%{opacity:0;transform:translateY(-8px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
@keyframes homeCaret{50%{opacity:0}}`));
}
Object.assign(window, {
  HomeScreen
});

/* ---- pwa-screens-wineiq.jsx (precompiled) ---- */
/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s) {
  return (s || '').toLowerCase().replace('é', 'e');
}
function _avg(wines, field, fb) {
  const ws = wines.filter(w => w[field] != null);
  return ws.length ? ws.reduce((s, w) => s + w[field], 0) / ws.length : fb;
}
/* Rating-weighted average — wines you rated higher count for more of the profile than ones you scanned but rated low/not at all. */
function _wavg(wines, field, fb) {
  const ws = wines.filter(w => w[field] != null);
  if (!ws.length) return fb;
  let num = 0,
    den = 0;
  ws.forEach(w => {
    const wt = Math.max(w.rating || 55, 5) / 100;
    num += w[field] * wt;
    den += wt;
  });
  return den ? num / den : fb;
}
/* Rating-weighted tally — an attribute (grape/region/note) earns weight from every wine it appears in, scaled by that wine's rating, so one obscure low-rated bottle can't outrank several wines you actually rated well. */
function _topByWeightedCount(items) {
  const c = {};
  items.forEach(({
    v,
    rating
  }) => {
    if (v) c[v] = (c[v] || 0) + Math.max(rating || 55, 5);
  });
  return Object.entries(c).sort((a, b) => b[1] - a[1]).map(e => e[0]);
}
/* Traits (grapes/regions) that skew toward your lowest-rated bottles — used to keep "Explore Next" from recommending things anchored to what you don't like. */
function _lowTraits(wines, pluck) {
  const rated = wines.filter(w => w.rating > 0);
  if (rated.length < 4) return new Set();
  const sorted = [...rated].sort((a, b) => a.rating - b.rating);
  const cutoff = sorted[Math.max(0, Math.floor(sorted.length / 3) - 1)].rating;
  const low = sorted.filter(w => w.rating <= cutoff);
  const set = new Set();
  low.forEach(w => pluck(w).forEach(v => {
    if (v) set.add(v.toLowerCase());
  }));
  return set;
}
function _topGrapes(wines, n) {
  const all = [];
  wines.forEach(w => (w.grapes || []).forEach(g => {
    if (g) all.push({
      v: g,
      rating: w.rating
    });
  }));
  return _topByWeightedCount(all).slice(0, n);
}
function _topRegions(wines, n) {
  const all = wines.filter(w => w.region).map(w => ({
    v: w.region,
    rating: w.rating
  }));
  return _topByWeightedCount(all).slice(0, n);
}
function _topNotes(wines, n) {
  const all = [];
  wines.forEach(w => (w.tasting_notes || []).forEach(t => {
    if (t) all.push({
      v: t,
      rating: w.rating
    });
  }));
  return _topByWeightedCount(all).slice(0, n);
}

/* ── Personality labels ── */
function _personality(key, b, ta, ac, sw) {
  if (key === 'red') {
    if (b >= 0.72 && ta >= 0.68) return 'Bold & Structured';
    if (b >= 0.70 && ta < 0.52) return 'Full & Velvety';
    if (b < 0.48) return 'Light & Elegant';
    if (ac >= 0.68) return 'Bright & Earthy';
    return 'Classic & Balanced';
  }
  if (key === 'white') {
    if (ac >= 0.70 && b < 0.52) return 'Crisp & Mineral';
    if (b >= 0.68) return 'Rich & Textured';
    if (ac >= 0.65) return 'Zingy & Aromatic';
    return 'Clean & Precise';
  }
  if (key === 'rose') {
    if (sw < 0.18) return 'Bone Dry & Delicate';
    if (b >= 0.55) return 'Fruity & Expressive';
    return 'Fresh & Crisp';
  }
  if (key === 'sparkling') {
    if (b >= 0.60) return 'Classic & Toasty';
    if (ac >= 0.70) return 'Taut & Precise';
    return 'Elegant & Fine';
  }
  if (key === 'orange') {
    if (ta >= 0.50) return 'Textured & Tannic';
    if (ac >= 0.65) return 'Bright & Funky';
    return 'Amber & Aromatic';
  }
  if (key === 'dessert') {
    if (sw >= 0.70) return 'Lusciously Sweet';
    if (ac >= 0.65) return 'Honeyed & Vibrant';
    return 'Rich & Nectarous';
  }
  if (key === 'fortified') {
    if (sw >= 0.50) return 'Sweet & Fortified';
    return 'Dry & Nutty';
  }
  return 'Eclectic Palate';
}

/* ── DNA "why" lines ── */
function _dnaWhy(axis, val, topGrapes, topRegions) {
  const g = topGrapes.slice(0, 2);
  const r = topRegions[0];
  const gs = g.length ? g.join(' and ') : null;
  const hi = val >= 0.68,
    lo = val <= 0.38;
  const T = {
    body: {
      hi: gs ? `${gs} ${g.length > 1 ? 'are' : 'is'} a naturally full-bodied grape — your instinct for weight and presence runs deep.` : r ? `${r} wines are known for their presence — your ratings confirm the pattern.` : 'You consistently favour wines with body — it\'s become your comfort zone.',
      md: gs ? `${gs} sit in the middle of the body spectrum — you gravitate toward balance over extremes.` : 'Your palate finds medium body most satisfying — structured but never heavy.',
      lo: gs ? `${gs} ${g.length > 1 ? 'are' : 'is'} naturally light — you favour finesse and precision over power.` : 'Lighter body is a consistent thread — you reach for elegance over weight.'
    },
    tannins: {
      hi: gs ? `${gs} ${g.length > 1 ? 'are' : 'is'} grippy by nature — you gravitate toward wines built to age.` : 'Firm tannins run through your collection — you value structure and backbone.',
      md: gs ? `${gs} deliver just enough grip to be interesting without being stern.` : 'You sit in the moderate-tannin zone — structure without severity.',
      lo: gs ? `Silky tannins define your style — ${gs} ${g.length > 1 ? 'are' : 'is'} smooth by design, not dilution.` : 'You prefer wines that are smooth and approachable rather than grippy.'
    },
    acidity: {
      hi: gs ? `${gs} ${g.length > 1 ? 'are' : 'is'} high-acid by nature — you\'re drawn to tension, freshness, and wines that cut through food.` : 'High acidity is a running theme — you reach for wines with energy and bite.',
      md: gs ? `${gs} sit in a comfortable acid balance — enough freshness without bite.` : 'Balanced acidity is your sweet spot — not tart, not flat.',
      lo: gs ? `You favour rounder wines — ${gs} lean toward richness over tartness.` : 'Low acidity is the common thread — richer, rounder wines that don\'t bite.'
    },
    sweetness: {
      hi: gs ? `A touch of sweetness recurs in your highest-rated wines — ${gs} reflect that preference.` : 'Off-dry to sweet is clearly welcome — residual sugar is a positive in your book.',
      md: 'Off-dry is your comfort zone — a hint of sweetness that frames the acidity.',
      lo: gs ? `Bone dry is your default — ${gs} ${g.length > 1 ? 'are' : 'is'} grown for austerity, and you appreciate it.` : 'Bone dry, consistently — sweetness doesn\'t register as a positive for you.'
    },
    texture: {
      hi: 'Rich, creamy textures show up again and again — oak aging and lees contact are clearly a plus for you.',
      md: 'You land in the middle on texture — a little roundness without going fully creamy or oaky.',
      lo: 'Crisp, steely whites are your throughline — you favour precision and minerality over oak or creaminess.'
    },
    effervescence: {
      hi: 'Fine, persistent bubbles are your pattern — you gravitate toward traditional-method fizz built for texture and length.',
      md: 'A moderate, easy mousse suits you best — enough energy without demanding too much attention.',
      lo: 'Soft, gentle bubbles are your preference — approachable fizz over intense, aggressive mousse.'
    }
  };
  return T[axis]?.[hi ? 'hi' : lo ? 'lo' : 'md'] || '';
}

/* ── Gap map ── */
function _gaps(typeKey, avgB, avgT, avgA, avgS, topGrapes, topRegions, wines) {
  const rgs = new Set(topRegions.map(r => (r || '').toLowerCase()));
  const gps = new Set(topGrapes.map(g => (g || '').toLowerCase()));
  const lowRgs = _lowTraits(wines, w => [w.region]);
  const lowGps = _lowTraits(wines, w => w.grapes || []);
  const topG = topGrapes[0],
    topR = topRegions[0];
  // Every suggestion's copy names only your OWN top grape/region as the reason — never a comparison to a specific
  // third-party bottle, so it can't accidentally sell a wine by likening it to something you rated low.
  const pool = {
    red: [{
      wine: 'Aglianico from Taurasi',
      region: 'Campania, Italy',
      anchorGrapes: ['tempranillo', 'sangiovese', 'cabernet sauvignon', 'merlot'],
      why: `Similar grip and structure to your ${topG || 'favorite reds'}, with a smoky, volcanic character you haven't explored.`,
      cond: avgT >= 0.60 && !rgs.has('campania')
    }, {
      wine: 'Côte-Rôtie (Syrah)',
      region: 'Northern Rhône, France',
      anchorGrapes: ['syrah', 'shiraz'],
      why: `Builds on your love of ${topG || 'Syrah'} with violet and smoked-meat notes your current bottles don't have.`,
      cond: avgB >= 0.65 && (gps.has('syrah') || gps.has('shiraz'))
    }, {
      wine: 'Douro Red Blend',
      region: 'Portugal',
      anchorGrapes: ['tempranillo', 'touriga nacional'],
      why: `Rooted in the same grip and dark fruit as your ${topG || 'top reds'}, from a region you haven't scanned yet.`,
      cond: avgT >= 0.60 && !rgs.has('douro') && !rgs.has('portugal')
    }, {
      wine: 'Etna Rosso (Nerello Mascalese)',
      region: 'Sicily',
      anchorRegions: ['tuscany', 'piedmont'],
      why: `Shares the high-acid, earthy backbone of your ${topR || 'top region'} reds, with a volcanic mineral edge that's new.`,
      cond: avgA >= 0.60 && !rgs.has('sicily')
    }],
    white: [{
      wine: 'Grüner Veltliner Smaragd',
      region: 'Wachau, Austria',
      anchorRegions: ['burgundy', 'chablis', 'loire'],
      why: `Matches the piercing acidity you go for in ${topR || 'your top whites'}, with a white pepper note you haven't tried.`,
      cond: avgA >= 0.65 && !rgs.has('austria')
    }, {
      wine: 'Assyrtiko from Santorini',
      region: 'Greece',
      anchorRegions: ['chablis', 'burgundy'],
      why: `Takes the mineral drive of your ${topR || 'top whites'} to a bone-dry, volcanic extreme.`,
      cond: avgA >= 0.62 && !rgs.has('greece')
    }, {
      wine: 'Aged White Rioja',
      region: 'Spain',
      anchorRegions: ['rioja'],
      why: `From the same region as your ${topR || 'favorite'} reds, but oxidatively aged for a nutty, textural white style you haven't tried.`,
      cond: !rgs.has('rioja') && rgs.has('spain')
    }],
    rose: [{
      wine: 'Bandol Rosé (Mourvèdre)',
      region: 'Provence, France',
      anchorRegions: ['provence'],
      why: `Pushes your bone-dry ${topR || 'Provençal'} instinct into richer, more saline territory.`,
      cond: rgs.has('provence') && !lowGps.has('mourvèdre') && !lowGps.has('mourvedre')
    }, {
      wine: 'Tavel Rosé',
      region: 'Rhône Valley, France',
      why: 'The boldest dry rosé in France — challenges a lighter palate with real structure and food-worthiness.',
      cond: avgB < 0.55
    }],
    sparkling: [{
      wine: 'Blanc de Noirs (Meunier grower)',
      region: 'Vallée de la Marne',
      why: 'A grower Meunier Champagne takes a bready, toasty preference toward wilder, earthier complexity.',
      cond: avgB >= 0.55
    }, {
      wine: 'Aged Vintage Champagne',
      region: 'Champagne',
      why: 'Ten-plus years on lees pushes a toasty preference to its extreme — deep oxidative notes and extraordinary length.',
      cond: true
    }, {
      wine: 'Pét-Nat from Loire',
      region: 'France',
      why: 'A useful contrast to your polished picks — wild, cloudy, funky, and structurally the opposite.',
      cond: avgA >= 0.65
    }],
    orange: [{
      wine: 'Ramato Pinot Grigio',
      region: 'Friuli, Italy',
      anchorRegions: ['friuli', 'collio'],
      why: `Builds on your love of ${topR || 'Friulian skin-contact whites'} with a lighter, rosé-hued take on extended maceration.`,
      cond: avgT >= 0.40
    }, {
      wine: 'Rkatsiteli, Qvevri-aged',
      region: 'Georgia',
      anchorGrapes: ['rkatsiteli'],
      why: `Georgia is the birthplace of skin-contact winemaking, aged in buried clay qvevri instead of steel or oak.`,
      cond: !rgs.has('georgia')
    }, {
      wine: 'Amber Riesling',
      region: 'Wachau, Austria',
      anchorGrapes: ['riesling'],
      why: `Takes the acidity you like in ${topG || 'aromatic whites'} and adds real tannic grip from skin contact.`,
      cond: avgA >= 0.60 && gps.has('riesling')
    }],
    dessert: [{
      wine: 'Tokaji Aszú (5 Puttonyos)',
      region: 'Tokaj, Hungary',
      why: `Botrytis-affected and intensely honeyed, with the piercing acidity that keeps ${topR || 'great dessert wines'} from feeling cloying.`,
      cond: avgA >= 0.55
    }, {
      wine: 'Vin Santo',
      region: 'Tuscany, Italy',
      why: 'Dried-grape sweetness with a nutty, oxidative edge — a different path to richness than botrytis wines.',
      cond: avgB >= 0.5
    }, {
      wine: 'Eiswein',
      region: 'Mosel, Germany',
      why: 'Grapes frozen on the vine concentrate sugar and acid alike — searingly sweet but never flabby.',
      cond: avgA >= 0.65
    }],
    fortified: [{
      wine: 'Amontillado Sherry',
      region: 'Jerez, Spain',
      why: 'Starts biologically aged like a Fino, then oxidizes further in barrel — dry, nutty, and complex.',
      cond: avgS < 0.4
    }, {
      wine: '10-Year Tawny Port',
      region: 'Douro, Portugal',
      why: 'Barrel-aged oxidatively for a decade, trading Vintage Port\u2019s fruit for dried fig, caramel and walnut.',
      cond: avgS >= 0.3
    }, {
      wine: 'Rare Madeira',
      region: 'Madeira, Portugal',
      why: 'Deliberately heated and oxidized during production — the only fortified wine that improves for centuries once opened.',
      cond: true
    }]
  };
  return (pool[typeKey] || []).filter(s => {
    if (!s.cond) return false;
    if (s.anchorGrapes && !s.anchorGrapes.some(g => gps.has(g))) return false;
    if (s.anchorRegions && !s.anchorRegions.some(r => rgs.has(r))) return false;
    if (s.avoidGrapes && s.avoidGrapes.some(g => lowGps.has(g))) return false;
    if (s.avoidRegions && s.avoidRegions.some(r => lowRgs.has(r))) return false;
    return true;
  }).slice(0, 2);
}

/* ── Flavour clusters ── */
const _NOTE_CLUSTERS = [{
  name: 'Dark Fruit & Spice',
  kw: ['blackberry', 'blackcurrant', 'black cherry', 'plum', 'dark cherry', 'black fruit', 'blueberry', 'clove', 'pepper', 'spice', 'anise', 'liquorice']
}, {
  name: 'Red Fruit & Floral',
  kw: ['cherry', 'raspberry', 'strawberry', 'redcurrant', 'red fruit', 'pomegranate', 'violet', 'rose', 'hibiscus']
}, {
  name: 'Earth & Leather',
  kw: ['earth', 'leather', 'tobacco', 'truffle', 'forest floor', 'mushroom', 'barnyard', 'smoke', 'tar', 'graphite', 'iron']
}, {
  name: 'Citrus & Mineral',
  kw: ['lemon', 'lime', 'grapefruit', 'citrus', 'mineral', 'chalk', 'flint', 'oyster', 'saline', 'wet stone', 'slate']
}, {
  name: 'Oak & Vanilla',
  kw: ['vanilla', 'caramel', 'toast', 'oak', 'cedar', 'sandalwood', 'coconut', 'cream', 'butterscotch']
}, {
  name: 'Herb & Savour',
  kw: ['herb', 'thyme', 'rosemary', 'olive', 'green pepper', 'eucalyptus', 'menthol', 'garrigue', 'dried herb']
}, {
  name: 'Tropical & Stone Fruit',
  kw: ['peach', 'apricot', 'nectarine', 'mango', 'pineapple', 'passion fruit', 'melon', 'guava', 'lychee']
}, {
  name: 'Brioche & Yeast',
  kw: ['brioche', 'toast', 'biscuit', 'bread', 'yeast', 'pastry', 'almonds', 'hazelnut']
}];
const _FOOD_PAIRINGS = {
  'Dark Fruit & Spice': 'Grilled red meat, aged hard cheese, braised short rib',
  'Red Fruit & Floral': 'Duck breast, mushroom risotto, charcuterie',
  'Earth & Leather': 'Truffles, aged Parmigiano, roasted lamb',
  'Citrus & Mineral': 'Oysters, grilled white fish, goat cheese',
  'Oak & Vanilla': 'Lobster, roast chicken, crème brûlée',
  'Herb & Savour': 'Herb-roasted chicken, tapenade, grilled vegetables',
  'Tropical & Stone Fruit': 'Spiced Asian dishes, crab, soft fresh cheese',
  'Brioche & Yeast': 'Aged Gruyère, smoked salmon, caviar'
};
function _clusterNotes(notes) {
  const result = [];
  const used = new Set();
  _NOTE_CLUSTERS.forEach(cl => {
    const matches = notes.filter(n => {
      const nl = n.toLowerCase();
      return cl.kw.some(k => nl.includes(k)) && !used.has(n);
    });
    if (matches.length >= 1) {
      matches.forEach(m => used.add(m));
      result.push({
        name: cl.name,
        notes: matches.slice(0, 4)
      });
    }
  });
  return result.slice(0, 3);
}

/* ── Palate evolution ── */
function _evolution(wines) {
  const rated = wines.filter(w => w.rating > 0 && (w.scanned_at || w.last_scanned));
  if (rated.length < 3) return [];
  const sorted = [...rated].sort((a, b) => new Date(a.scanned_at || a.last_scanned || 0) - new Date(b.scanned_at || b.last_scanned || 0));
  const firstD = new Date(sorted[0].scanned_at || sorted[0].last_scanned || 0);
  const lastD = new Date(sorted[sorted.length - 1].scanned_at || sorted[sorted.length - 1].last_scanned || 0);
  const spanDays = (lastD - firstD) / 86400000;

  // Bucket by REAL calendar period (not by equal wine-count chunks) so bars always
  // reflect actual scan dates — a handful of new scans this month always shows up
  // as its own bar instead of getting merged into an old chunk's date range.
  function weekKey(d) {
    const onejan = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + wk;
  }
  const granularity = spanDays <= 10 ? 'day' : spanDays <= 70 ? 'week' : spanDays <= 700 ? 'month' : 'year';
  function bucketKey(d) {
    if (granularity === 'day') return d.toISOString().slice(0, 10);
    if (granularity === 'week') return weekKey(d);
    if (granularity === 'month') return d.getFullYear() + '-' + d.getMonth();
    return String(d.getFullYear());
  }
  function labelFor(d) {
    if (granularity === 'year') return d.toLocaleDateString('en', {
      year: 'numeric'
    });
    if (granularity === 'month') return d.toLocaleDateString('en', {
      month: 'short',
      year: '2-digit'
    });
    return d.toLocaleDateString('en', {
      month: 'short',
      day: 'numeric'
    });
  }
  const buckets = new Map();
  sorted.forEach(w => {
    const d = new Date(w.scanned_at || w.last_scanned);
    const key = bucketKey(d);
    if (!buckets.has(key)) buckets.set(key, {
      sum: 0,
      count: 0,
      lastDate: d,
      types: {
        red: 0,
        white: 0,
        rose: 0,
        sparkling: 0,
        orange: 0,
        dessert: 0,
        fortified: 0
      },
      order: d.getTime()
    });
    const b = buckets.get(key);
    b.sum += w.rating;
    b.count++;
    if (d > b.lastDate) b.lastDate = d;
    const t = _norm(w.type);
    if (b.types[t] !== undefined) b.types[t]++;else b.types.red++;
  });
  let chunks = [...buckets.values()].sort((a, b) => a.order - b.order).map(b => ({
    label: labelFor(b.lastDate),
    avgR: Math.round(b.sum / b.count),
    count: b.count,
    dom: Object.entries(b.types).sort((a, b2) => b2[1] - a[1])[0][0]
  }));

  // Keep the chart readable — cap to the most recent 6 periods.
  if (chunks.length > 6) chunks = chunks.slice(chunks.length - 6);
  return chunks;
}
const _TYPE_COLORS = {
  red: '#8B1A2F',
  white: '#B8963E',
  rose: '#C47A8A',
  sparkling: '#5E8FA8',
  orange: '#C1652B',
  dessert: '#8A5A2B',
  fortified: '#5C2A1E'
};
const _TYPES = [{
  key: 'red',
  label: 'Reds',
  col: '#8B1A2F'
}, {
  key: 'white',
  label: 'Whites',
  col: '#B8963E'
}, {
  key: 'rose',
  label: 'Rosé',
  col: '#C47A8A'
}, {
  key: 'sparkling',
  label: 'Sparkling',
  col: '#5E8FA8'
}, {
  key: 'orange',
  label: 'Orange',
  col: '#C1652B'
}, {
  key: 'dessert',
  label: 'Dessert',
  col: '#8A5A2B'
}, {
  key: 'fortified',
  label: 'Fortified',
  col: '#5C2A1E'
}];

/* Collapsible section header — collapsed state shows a short useful summary + expand CTA below the title */
function CSH({
  label,
  cKey,
  collapsed,
  toggle,
  summary
}) {
  const isC = collapsed[cKey];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      marginBottom: isC ? 12 : 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => toggle(cKey),
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      cursor: 'pointer',
      padding: '2px 0'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, label), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: 16,
    height: 16,
    style: {
      transform: isC ? 'none' : 'rotate(180deg)',
      transition: 'transform .2s',
      flexShrink: 0,
      marginLeft: 8,
      opacity: 0.45
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "4,7 10,13 16,7",
    stroke: C.mid,
    strokeWidth: "2",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), isC && summary && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55,
      textWrap: 'pretty'
    }
  }, summary), /*#__PURE__*/React.createElement("span", {
    onClick: () => toggle(cKey),
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer',
      display: 'inline-block',
      marginTop: 6
    }
  }, "Expand for full details \u2192")));
}

/* ──────────────────────────────────────────────────
   WineDNA Screen
────────────────────────────────────────────────── */
function WineDNAScreen({
  nav,
  back,
  showPro
}) {
  const [typeIdx, setTypeIdx] = React.useState(0);
  const [tabToast, setTabToast] = React.useState(null);
  const [genSummaries, setGenSummaries] = React.useState({});
  const [generatingSummary, setGeneratingSummary] = React.useState(null);
  const [genScripts, setGenScripts] = React.useState({});
  const [generatingScript, setGeneratingScript] = React.useState(null);
  const [copied, setCopied] = React.useState(null);
  const [scriptLength, setScriptLength] = React.useState(localStorage.getItem('vinterest_script_length') || 'long');
  const COLLAPSE_KEY = 'vinterest_dna_collapsed_v1';
  const [collapsed, setCollapsed] = React.useState(() => {
    const def = {
      taste: false,
      explore: false,
      flavour: false,
      journey: false,
      scripts: false,
      history: false
    };
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || 'null');
      if (saved) return {
        ...def,
        ...saved
      };
    } catch (e) {}
    return def;
  });
  const toggle = React.useCallback(k => setCollapsed(c => {
    const next = {
      ...c,
      [k]: !c[k]
    };
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next));
    } catch (e) {}
    return next;
  }), []);
  const touchX = React.useRef(null);
  const touchY = React.useRef(null);
  const allWines = WineHistory.getAll();
  /* Currency helpers */
  const _FX = {
    GBP: 0.79,
    CAD: 1.36,
    AUD: 1.53,
    NZD: 1.64,
    EUR: 0.92,
    USD: 1.0,
    JPY: 150,
    CNY: 7.2,
    CHF: 0.88,
    ZAR: 18.5,
    SGD: 1.34,
    HKD: 7.8,
    MXN: 18,
    BRL: 5.4,
    INR: 83,
    AED: 3.67,
    SEK: 10.4,
    NOK: 10.6,
    DKK: 6.9
  };
  const _rc = Regional.current();
  const _csym = _rc.sym;
  const _cbase = _rc.base;
  const _ccode = _rc.code;
  const _cfx = _FX[_rc.code] || 1.0;
  const xd = XPSystem.get();
  const lv = XPSystem.getLevel(xd.total);
  const nx = XPSystem.nextLevel(xd.total);
  const pg = XPSystem.levelProgress(xd.total);

  /* Per-type stats */
  const typeStats = React.useMemo(() => _TYPES.map(tp => {
    const wines = allWines.filter(w => _norm(w.type) === tp.key);
    const pct = allWines.length ? Math.round(wines.length / allWines.length * 100) : 0;
    const avgB = _wavg(wines, 'body', 0.65);
    const avgT = _wavg(wines, 'tannins', 0.55);
    const avgA = _wavg(wines, 'acidity', 0.60);
    const avgS = _wavg(wines, 'sweetness', 0.10);
    const avgX = _wavg(wines, 'texture', 0.3);
    const avgE = _wavg(wines, 'effervescence', 0.6);
    const topGrapes = _topGrapes(wines, 4);
    const topRegions = _topRegions(wines, 4);
    const topNotes = _topNotes(wines, 14);
    const noteClusters = _clusterNotes(topNotes);
    const personality = _personality(tp.key, avgB, avgT, avgA, avgS);
    const gaps = _gaps(tp.key, avgB, avgT, avgA, avgS, topGrapes, topRegions, wines);
    const topWines = [...wines].filter(w => w.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    return {
      ...tp,
      wines,
      pct,
      avgB,
      avgT,
      avgA,
      avgS,
      avgX,
      avgE,
      topGrapes,
      topRegions,
      topNotes,
      noteClusters,
      personality,
      gaps,
      topWines
    };
  }), [allWines.length]);
  const t = typeStats[typeIdx];
  const visibleIdxs = typeStats.reduce((arr, ts, i) => {
    if (i < 4 || ts.wines.length > 0) arr.push(i);
    return arr;
  }, []);
  function pickType(i) {
    if (i < 4 && typeStats[i].wines.length === 0) {
      setTabToast(`You haven't scanned a ${typeStats[i].label.toLowerCase()} yet`);
      setTimeout(() => setTabToast(null), 1800);
      return;
    }
    setTypeIdx(i);
  }
  function stepType(dir) {
    const pos = visibleIdxs.indexOf(typeIdx);
    const next = visibleIdxs[Math.min(visibleIdxs.length - 1, Math.max(0, pos + dir))];
    setTypeIdx(next);
  }

  /* LLM summary */
  React.useEffect(() => {
    if (!t.wines.length) return;
    const key = `vinterest_dna_v5_${t.key}_n${t.wines.length}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setGenSummaries(s => ({
        ...s,
        [t.key]: cached
      }));
      return;
    }
    if (genSummaries[t.key] || generatingSummary === t.key) return;
    setGeneratingSummary(t.key);
    const ratedAsc = [...t.wines].filter(w => w.rating > 0).sort((a, b) => (a.rating || 0) - (b.rating || 0));
    const hasLow = ratedAsc.length >= 4;
    const topWinesForPrompt = [...t.wines].filter(w => w.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
    const lowWinesForPrompt = hasLow ? ratedAsc.slice(0, 3) : [];
    const wineList = topWinesForPrompt.map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''}${w.region ? ' from ' + w.region : ''}${w.rating ? ' rated ' + w.rating + '/100' : ''}`).join('; ');
    const lowList = lowWinesForPrompt.map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''}${w.region ? ' from ' + w.region : ''}${w.rating ? ' rated ' + w.rating + '/100' : ''}`).join('; ');
    const prompt = `My ${t.label.toLowerCase()} wine personality is "${t.personality}". My computed top grapes are: ${t.topGrapes.join(', ') || 'none'}. My computed top regions are: ${t.topRegions.join(', ') || 'none'}. My highest-rated ${t.label.toLowerCase()} wines: ${wineList || 'none'}.${hasLow ? ` My lowest-rated ${t.label.toLowerCase()} wines: ${lowList}.` : ''} Return ONLY raw JSON — no markdown, no code fences, no extra text, just the JSON object: {"preference":"one sentence on what I gravitate toward — max 18 words","like":"one sentence on specifically what I like — you MUST only name grapes/regions from the computed top grapes/regions or highest-rated wines lists above, never invent or infer any other grape or region — max 18 words"${hasLow ? ',"dislike":"one sentence on what I tend to rate lower — you MUST only name grapes, regions, or style traits drawn from my lowest-rated wines list above, never invent others — max 18 words"' : ''}}`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      const s = text.trim();
      localStorage.setItem(key, s);
      setGenSummaries(g => ({
        ...g,
        [t.key]: s
      }));
    }).catch(() => {}).finally(() => setGeneratingSummary(null));
  }, [typeIdx, allWines.length]);

  /* LLM sommelier script — short + long variants (shared cache with Home) */
  React.useEffect(() => {
    if (!t.wines.length) return;
    const key = `vinterest_script_${scriptLength}_${t.key}_n${t.wines.length}_${_ccode}_v2`;
    const cached = localStorage.getItem(key);
    if (cached) {
      setGenScripts(s => ({
        ...s,
        [t.key]: cached
      }));
      return;
    }
    if (generatingScript === t.key) return;
    setGeneratingScript(t.key);
    const wineList = t.wines.slice(0, 8).map(w => `${w.name}${w.vintage ? ' ' + w.vintage : ''} from ${w.region || w.country || 'unknown'}${w.rating ? ' (rated ' + w.rating + '/100)' : ''}`).join('; ');
    const lengthInst = scriptLength === 'short' ? `1 sentence, ultra-concise (under 20 words), mention your typical budget range formatted EXACTLY like "${_cbase}40-${_cbase}80 ${_ccode}" (plain symbol, a number range, then the ${_ccode} currency code, never a country-prefixed symbol like CA$ or C$)` : '2 sentences max';
    const prompt = `I've scanned and rated these ${t.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a ${lengthInst} natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_cbase} symbol plus the ${_ccode} code, formatted like "${_cbase}40-${_cbase}80 ${_ccode}" — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({
      messages: [{
        role: 'user',
        content: prompt
      }]
    }).then(text => {
      const s = text.trim();
      localStorage.setItem(key, s);
      setGenScripts(g => ({
        ...g,
        [t.key]: s
      }));
    }).catch(() => {}).finally(() => setGeneratingScript(null));
  }, [typeIdx, allWines.length, scriptLength]);

  /* Swipe */
  function onTouchStart(e) {
    touchX.current = e.touches[0].clientX;
    touchY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = e.changedTouches[0].clientY - (touchY.current || 0);
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) stepType(1);else stepType(-1);
    }
    touchX.current = null;
    touchY.current = null;
  }

  /* Per-type stats */
  const tRated = t.wines.filter(w => w.rating > 0);
  const tAvgRating = tRated.length ? Math.round(tRated.reduce((s, w) => s + w.rating, 0) / tRated.length) : 0;
  const tCountries = new Set(t.wines.map(w => w.country).filter(Boolean)).size;
  const tAvgPrice = _avg(t.wines, 'price_usd', 0);
  const SH = ({
    label
  }) => /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: C.mid,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      fontFamily: C.P,
      marginTop: 6,
      marginBottom: -4
    }
  }, label);

  /* Empty state */
  if (!allWines.length) return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '16px 20px',
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P
    }
  }, "WineDNA")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginLeft: 46
    }
  }, "Your personal taste intelligence")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 88,
      height: 88,
      borderRadius: 22,
      background: C.crSoft,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: `1px solid ${C.crDim}`
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "brain",
    sz: 42,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 8,
      lineHeight: 1.2
    }
  }, "Your WineDNA is waiting"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      color: C.mid,
      fontFamily: C.P,
      lineHeight: 1.65,
      maxWidth: 280
    }
  }, "Scan and rate bottles to unlock your personal taste profile, sommelier scripts, and wine intelligence.")), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => nav('camera')
  }, "Scan Your First Bottle")));

  /* Global stats */
  const ratedAll = allWines.filter(w => w.rating > 0);
  const avgRatingAll = ratedAll.length ? Math.round(ratedAll.reduce((s, w) => s + w.rating, 0) / ratedAll.length) : 0;
  const ccounts = {};
  allWines.forEach(w => {
    if (w.country) ccounts[w.country] = (ccounts[w.country] || 0) + 1;
  });
  const uniqueCountries = Object.keys(ccounts).length;
  const topRated = [...allWines].filter(w => w.rating > 0).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
  const avgPrice = _avg(allWines, 'price_usd', 0);
  const evolution = _evolution(t.wines);

  /* Synthesis chips */
  const chips = [];
  if (t.topGrapes[0]) chips.push({
    label: 'Top grape',
    value: t.topGrapes[0]
  });
  if (t.topRegions[0]) chips.push({
    label: 'Lead region',
    value: t.topRegions[0]
  });
  chips.push({
    label: 'Body',
    value: t.avgB >= 0.72 ? 'Full' : t.avgB >= 0.42 ? 'Medium' : 'Light'
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: C.bg
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px 12px',
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.3px'
    }
  }, "WineDNA")), t.wines.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 11px',
      borderRadius: 20,
      background: `${t.col}15`,
      border: `1px solid ${t.col}35`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: t.col,
      fontFamily: C.P
    }
  }, t.personality))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 20,
      background: `${t.col}15`,
      border: `1px solid ${t.col}35`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 5,
      height: 5,
      borderRadius: 3,
      background: t.col,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: t.col,
      fontFamily: C.P,
      letterSpacing: '0.05em'
    }
  }, t.label.toUpperCase())), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, allWines.length, " bottle", allWines.length !== 1 ? 's' : '', " \xB7 ", lv.badge, " ", lv.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Prog, {
    val: pg,
    h: 5,
    col: C.cr
  }), nx && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 3
    }
  }, xd.total, " XP \xB7 ", nx.min - xd.total, " to ", nx.name))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    },
    onTouchStart: onTouchStart,
    onTouchEnd: onTouchEnd
  }, /*#__PURE__*/React.createElement(SH, {
    label: "Your WineDNA"
  }), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 5,
      background: `linear-gradient(90deg,#8B1A2F 0% ${typeStats[0].pct}%,#B8963E ${typeStats[0].pct}% ${typeStats[0].pct + typeStats[1].pct}%,#C47A8A ${typeStats[0].pct + typeStats[1].pct}% ${typeStats[0].pct + typeStats[1].pct + typeStats[2].pct}%,#5E8FA8 ${typeStats[0].pct + typeStats[1].pct + typeStats[2].pct}% 100%)`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 16px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5
    }
  }, _TYPES.slice(0, 4).map((tp, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => pickType(i),
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '7px 4px',
      borderRadius: 10,
      background: i === typeIdx ? tp.col + '18' : C.offWhite,
      border: `1.5px solid ${i === typeIdx ? tp.col + '55' : 'transparent'}`,
      cursor: 'pointer',
      transition: 'all .15s',
      opacity: typeStats[i].wines.length === 0 ? 0.4 : 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 4,
      background: tp.col,
      margin: '0 auto 3px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: i === typeIdx ? 700 : 500,
      color: i === typeIdx ? tp.col : C.mid,
      fontFamily: C.P
    }
  }, tp.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: i === typeIdx ? tp.col : C.mid,
      fontFamily: C.P,
      opacity: 0.75
    }
  }, typeStats[i].pct, "%")))), visibleIdxs.length > 4 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 5
    }
  }, visibleIdxs.filter(i => i >= 4).map(i => {
    const tp = _TYPES[i];
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => pickType(i),
      style: {
        flex: 1,
        textAlign: 'center',
        padding: '7px 4px',
        borderRadius: 10,
        background: i === typeIdx ? tp.col + '18' : C.offWhite,
        border: `1.5px solid ${i === typeIdx ? tp.col + '55' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'all .15s'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 7,
        height: 7,
        borderRadius: 4,
        background: tp.col,
        margin: '0 auto 3px'
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: i === typeIdx ? 700 : 500,
        color: i === typeIdx ? tp.col : C.mid,
        fontFamily: C.P
      }
    }, tp.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: i === typeIdx ? tp.col : C.mid,
        fontFamily: C.P,
        opacity: 0.75
      }
    }, typeStats[i].pct, "%"));
  })), tabToast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      left: 0,
      right: 0,
      textAlign: 'center',
      fontSize: 14,
      fontWeight: 700,
      color: '#fff',
      fontFamily: C.P,
      background: C.cr,
      borderRadius: 10,
      padding: '10px 14px',
      zIndex: 20,
      boxShadow: '0 6px 18px rgba(139,26,47,0.35)',
      animation: 'dnaToast 1.8s ease forwards'
    }
  }, tabToast)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => stepType(-1),
    style: {
      width: 30,
      height: 30,
      borderRadius: 15,
      background: visibleIdxs.indexOf(typeIdx) > 0 ? t.col + '15' : C.offWhite,
      border: `1px solid ${visibleIdxs.indexOf(typeIdx) > 0 ? t.col + '35' : C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: visibleIdxs.indexOf(typeIdx) > 0 ? 'pointer' : 'default',
      opacity: visibleIdxs.indexOf(typeIdx) > 0 ? 1 : 0.35,
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: 14,
    height: 14
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "12,4 6,10 12,16",
    stroke: t.col,
    strokeWidth: "1.8",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, visibleIdxs.indexOf(typeIdx) + 1, " of ", visibleIdxs.length, " \xB7 swipe or tap"), /*#__PURE__*/React.createElement("div", {
    onClick: () => stepType(1),
    style: {
      width: 30,
      height: 30,
      borderRadius: 15,
      background: visibleIdxs.indexOf(typeIdx) < visibleIdxs.length - 1 ? t.col + '15' : C.offWhite,
      border: `1px solid ${visibleIdxs.indexOf(typeIdx) < visibleIdxs.length - 1 ? t.col + '35' : C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: visibleIdxs.indexOf(typeIdx) < visibleIdxs.length - 1 ? 'pointer' : 'default',
      opacity: visibleIdxs.indexOf(typeIdx) < visibleIdxs.length - 1 ? 1 : 0.35,
      transition: 'all .15s'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 20 20",
    width: 14,
    height: 14
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "8,4 14,10 8,16",
    stroke: t.col,
    strokeWidth: "1.8",
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: C.line
    }
  }), t.wines.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '8px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.6
    }
  }, "No ", t.label.toLowerCase(), " scanned yet."), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true,
    onClick: () => nav('camera'),
    style: {
      background: t.col,
      boxShadow: `0 3px 12px ${t.col}40`,
      marginTop: 10
    }
  }, "Scan a Bottle")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: C.mid,
      fontFamily: C.P,
      letterSpacing: '0.09em',
      textTransform: 'uppercase'
    }
  }, "WineDNA"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      borderRadius: 20,
      background: `${t.col}15`,
      border: `1px solid ${t.col}35`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 5,
      height: 5,
      borderRadius: 3,
      background: t.col
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: t.col,
      fontFamily: C.P
    }
  }, t.label))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.3px',
      lineHeight: 1.15
    }
  }, t.personality))), generatingSummary === t.key ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 7,
      border: '2px solid rgba(0,0,0,0.08)',
      borderTopColor: t.col,
      animation: 'dnaSpin .8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Analysing your palate\u2026")) : (() => {
    const raw = genSummaries[t.key];
    let sections = null;
    if (raw) {
      try {
        sections = JSON.parse(raw.replace(/```json|```/g, '').trim());
      } catch (e) {
        sections = null;
      }
    }
    if (!sections) return /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 15,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.68,
        margin: 0
      }
    }, raw || 'Generating your WineDNA summary…');
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, [{
      label: 'Your Preference',
      text: sections.preference
    }, {
      label: 'What You Like',
      text: sections.like || sections.why
    }, {
      label: 'What You Don\u2019t Like',
      text: sections.dislike
    }, ...(t.gaps.length > 0 ? [{
      label: 'Try Next',
      text: `${t.gaps[0].wine}${t.gaps[0].region ? ' from ' + t.gaps[0].region : ''} \u2014 ${t.gaps[0].why}`
    }] : [])].filter(s => s.text).map((s, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        color: t.col,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        fontFamily: C.P,
        marginBottom: 2
      }
    }, s.label), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.ink2,
        fontFamily: C.P,
        lineHeight: 1.6,
        textWrap: 'pretty'
      }
    }, s.text))));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap'
    }
  }, chips.map((ch, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '5px 11px',
      borderRadius: 20,
      background: i === 0 ? `${t.col}10` : C.offWhite,
      border: `1px solid ${i === 0 ? t.col + '30' : C.line}`,
      display: 'flex',
      gap: 5,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      whiteSpace: 'nowrap'
    }
  }, ch.label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: i === 0 ? t.col : C.ink2,
      fontFamily: C.P,
      whiteSpace: 'nowrap'
    }
  }, ch.value)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, t.wines.length, " ", t.label.toLowerCase(), " scanned"))))), t.wines.length > 0 && /*#__PURE__*/React.createElement(CSH, {
    label: "Taste Breakdown",
    cKey: "taste",
    collapsed: collapsed,
    toggle: toggle,
    summary: `Your ${t.label.toLowerCase()} run ${t.avgB >= .72 ? 'full-bodied' : t.avgB >= .38 ? 'medium-bodied' : 'light-bodied'}${t.key === 'red' ? ` with ${t.avgT >= .72 ? 'grippy' : t.avgT >= .38 ? 'medium' : 'silky'} tannins` : ''} and ${t.avgA >= .72 ? 'zingy' : t.avgA >= .38 ? 'balanced' : 'mellow'} acidity${t.key === 'white' ? `, leaning ${t.avgX >= .55 ? 'rich and creamy' : 'crisp and steely'}` : ''}${t.key === 'sparkling' ? `, with ${t.avgE >= .55 ? 'fine, persistent' : 'soft, gentle'} bubbles` : ''}. That puts your palate in ${t.personality} territory.`
  }), t.wines.length > 0 && !collapsed.taste && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Wine DNA \xB7 ", t.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, [{
    l: 'Body',
    v: t.avgB,
    lo: 'Light',
    hi: 'Full',
    col: t.col,
    axis: 'body'
  }, ...(t.key === 'sparkling' ? [{
    l: 'Effervescence',
    v: t.avgE,
    lo: 'Soft & Delicate',
    hi: 'Vigorous',
    col: '#5E8FA8',
    axis: 'effervescence'
  }] : []), ...(['red', 'orange', 'fortified'].includes(t.key) ? [{
    l: 'Tannins',
    v: t.avgT,
    lo: 'Silky',
    hi: 'Grippy',
    col: '#7B5EA7',
    axis: 'tannins'
  }] : []), {
    l: 'Acidity',
    v: t.avgA,
    lo: 'Mellow',
    hi: 'Zingy',
    col: C.green,
    axis: 'acidity'
  }, ...(['white', 'orange', 'dessert', 'fortified'].includes(t.key) ? [{
    l: 'Texture',
    v: t.avgX,
    lo: 'Crisp & Steely',
    hi: 'Rich & Creamy',
    col: '#B8963E',
    axis: 'texture'
  }] : []), {
    l: 'Sweetness',
    v: t.avgS,
    lo: 'Bone Dry',
    hi: 'Sweet',
    col: C.amber,
    axis: 'sweetness'
  }].map((attr, i) => {
    const why = t.wines.length >= 2 ? _dnaWhy(attr.axis, attr.v, t.topGrapes, t.topRegions) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P
      }
    }, attr.l), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: attr.col,
        fontFamily: C.P
      }
    }, attr.v >= .72 ? attr.hi : attr.v >= .38 ? 'Medium' : attr.lo)), /*#__PURE__*/React.createElement(Prog, {
      val: attr.v,
      col: attr.col,
      h: 5
    }), why && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.mid,
        fontFamily: C.P,
        marginTop: 5,
        lineHeight: 1.55,
        fontStyle: 'italic',
        textWrap: 'pretty'
      }
    }, why));
  }))), t.wines.length >= 3 && t.gaps.length > 0 && /*#__PURE__*/React.createElement(CSH, {
    label: "Explore",
    cKey: "explore",
    collapsed: collapsed,
    toggle: toggle,
    summary: `We spotted ${t.gaps.length} new direction${t.gaps.length !== 1 ? 's' : ''} that share your ${t.label.toLowerCase()} DNA. Top pick: ${t.gaps[0].wine}${t.gaps[0].region ? ' from ' + t.gaps[0].region : ''}.`
  }), t.wines.length >= 3 && t.gaps.length > 0 && !collapsed.explore && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Explore Next"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Styles that share your ", t.label.toLowerCase(), " DNA but introduce new territory"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, t.gaps.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => {
      sessionStorage.setItem('vinterest_style_explore', JSON.stringify({
        wine: s.wine,
        region: s.region,
        why: s.why,
        typeKey: t.key
      }));
      nav('style-explore');
    },
    style: {
      padding: '10px 12px',
      borderRadius: 12,
      background: i === 0 ? `${t.col}08` : C.offWhite,
      border: `1px solid ${i === 0 ? t.col + '25' : C.line}`,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      flex: 1
    }
  }, s.wine), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      flexShrink: 0
    }
  }, s.region)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.55,
      textWrap: 'pretty',
      marginBottom: 6
    }
  }, s.why), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: t.col,
      fontFamily: C.P
    }
  }, "Explore wines \u2192"))))), t.wines.length >= 2 && t.noteClusters.length > 0 && /*#__PURE__*/React.createElement(CSH, {
    label: "Flavour Signatures",
    cKey: "flavour",
    collapsed: collapsed,
    toggle: toggle,
    summary: `${t.noteClusters[0].name} is your most common flavour signature across ${t.label.toLowerCase()} bottles.${t.noteClusters[1] ? ' ' + t.noteClusters[1].name + ' shows up often too.' : ''}`
  }), t.wines.length >= 2 && t.noteClusters.length > 0 && !collapsed.flavour && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 12
    }
  }, "Flavour Signatures"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, t.noteClusters.map((cl, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      padding: '10px 12px',
      borderRadius: 12,
      background: C.offWhite,
      border: `1px solid ${C.line}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 6
    }
  }, cl.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 4,
      marginBottom: 8
    }
  }, cl.notes.map((n, j) => /*#__PURE__*/React.createElement("span", {
    key: j,
    style: {
      padding: '3px 9px',
      borderRadius: 20,
      background: j === 0 ? `${t.col}10` : C.white,
      border: `1px solid ${j === 0 ? t.col + '30' : C.line}`,
      fontSize: 13,
      color: j === 0 ? t.col : C.ink2,
      fontFamily: C.P
    }
  }, n))), _FOOD_PAIRINGS[cl.name] && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      flexShrink: 0,
      marginTop: 1
    }
  }, "Pairs with"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, _FOOD_PAIRINGS[cl.name])))))), evolution.length >= 3 && /*#__PURE__*/React.createElement(CSH, {
    label: "Your Journey",
    cKey: "journey",
    collapsed: collapsed,
    toggle: toggle,
    summary: `Your most recent ${t.label.toLowerCase()} scans (${evolution[evolution.length - 1].label}) average ${evolution[evolution.length - 1].avgR}/100, across ${evolution.length} time periods. ${evolution[evolution.length - 1].avgR > evolution[0].avgR ? 'Your palate has been getting sharper over time.' : 'Your taste has stayed consistent throughout.'}`
  }), evolution.length >= 3 && !collapsed.journey && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "Palate Evolution"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      marginBottom: 14
    }
  }, "Average rating of your ", t.label.toLowerCase(), " wines, grouped by when you scanned them"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      alignItems: 'flex-end',
      height: 72,
      marginBottom: 6
    }
  }, evolution.map((e, i) => {
    const h = Math.round(e.avgR / 100 * 100);
    const col = _TYPE_COLORS[e.dom] || C.cr;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: col,
        fontFamily: C.P
      }
    }, e.avgR), /*#__PURE__*/React.createElement("div", {
      style: {
        width: '55%',
        height: `${h}%`,
        minHeight: 4,
        background: col,
        borderRadius: '4px 4px 0 0',
        opacity: 0.72,
        transition: 'height .3s'
      }
    }));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, evolution.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      flex: 1,
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.mid,
      fontFamily: C.P
    }
  }, e.label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 10,
      color: C.mid,
      fontFamily: C.P,
      opacity: 0.6
    }
  }, e.count, " bottle", e.count !== 1 ? 's' : '')))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 10,
      lineHeight: 1.55
    }
  }, evolution[evolution.length - 1].avgR > evolution[0].avgR ? `Your average rating has climbed from ${evolution[0].avgR} to ${evolution[evolution.length - 1].avgR} across these periods — your palate is getting sharper.` : `Consistent scores across these periods show a clear, settled sense of what you love.`, " Each bar is the average of just the ", t.label.toLowerCase(), " you rated in that period, so it can run higher or lower than your all-time average.")), t.wines.length > 0 && /*#__PURE__*/React.createElement(CSH, {
    label: "Scripts",
    cKey: "scripts",
    collapsed: collapsed,
    toggle: toggle,
    summary: genScripts[t.key] ? `Your ${t.label.toLowerCase()} sommelier script is ready to use at your next dinner. "${genScripts[t.key].replace(/^"|"$/g, '').slice(0, 90)}${genScripts[t.key].replace(/^"|"$/g, '').length > 90 ? '…' : ''}"` : `We're writing a personalised sommelier script based on your ${t.label.toLowerCase()} history — expand to see it.`
  }), t.wines.length > 0 && !collapsed.scripts && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "message",
    sz: 14,
    col: t.col
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Your ", t.label, " Script")), t.wines.length > 0 && !generatingScript && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      background: C.offWhite,
      borderRadius: 6,
      padding: '3px 4px',
      border: `1px solid ${C.line}`
    }
  }, ['short', 'long'].map(len => /*#__PURE__*/React.createElement("div", {
    key: len,
    onClick: () => {
      setScriptLength(len);
      localStorage.setItem('vinterest_script_length', len);
      setGenScripts(s => {
        const n = {
          ...s
        };
        delete n[t.key];
        return n;
      });
    },
    style: {
      padding: '4px 8px',
      borderRadius: 4,
      background: scriptLength === len ? C.cr : 'transparent',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: scriptLength === len ? '#fff' : C.mid,
      fontFamily: C.P
    }
  }, len.charAt(0).toUpperCase() + len.slice(1)))))), generatingScript === t.key ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 14,
      height: 14,
      borderRadius: 7,
      border: '2px solid rgba(0,0,0,0.08)',
      borderTopColor: t.col,
      animation: 'dnaSpin .8s linear infinite',
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P,
      fontStyle: 'italic'
    }
  }, "Writing\u2026")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      fontStyle: 'italic',
      lineHeight: 1.65,
      marginBottom: genScripts[t.key] ? 10 : 0
    }
  }, genScripts[t.key] || 'Generating…'), genScripts[t.key] && /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true,
    style: {
      background: t.col,
      boxShadow: `0 3px 12px ${t.col}40`,
      marginTop: 4
    },
    onClick: () => {
      try {
        navigator.clipboard.writeText((genScripts[t.key] || '').replace(/"/g, ''));
        setCopied(t.key);
        setTimeout(() => setCopied(null), 2000);
      } catch (e) {}
    }
  }, copied === t.key ? '✓ Copied' : 'Copy Script'))), /*#__PURE__*/React.createElement(CSH, {
    label: "Your History",
    cKey: "history",
    collapsed: collapsed,
    toggle: toggle,
    summary: `You've scanned ${t.wines.length} ${t.label.toLowerCase()} bottle${t.wines.length !== 1 ? 's' : ''} across ${tCountries} countr${tCountries !== 1 ? 'ies' : 'y'}, averaging ${tAvgRating || '—'}/100.${tAvgPrice > 0 ? ' You typically spend around ' + _csym + Math.round(tAvgPrice * _cfx) + ' per bottle.' : ''}`
  }), !collapsed.history && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8
    }
  }, [{
    icon: 'wine',
    label: `${t.label} Scanned`,
    val: t.wines.length,
    col: t.col,
    bg: t.col + '15'
  }, {
    icon: 'star',
    label: 'Avg Rating',
    val: tAvgRating ? `${tAvgRating}/100` : '—',
    col: C.amber,
    bg: C.amberBg
  }, {
    icon: 'globe',
    label: 'Countries',
    val: tCountries || '—',
    col: C.green,
    bg: C.greenBg
  }, {
    icon: 'trophy',
    label: 'XP Earned',
    val: `${xd.total} XP`,
    col: '#7B5EA7',
    bg: '#F0EBF8'
  }].map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: s.bg,
      borderRadius: 14,
      padding: '12px 14px',
      border: `1px solid ${s.col}20`,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 24,
      height: 24,
      borderRadius: 6,
      background: `${s.col}25`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: s.icon,
    sz: 13,
    col: s.col
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 800,
      color: s.col,
      fontFamily: C.P,
      lineHeight: 1
    }
  }, s.val)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, s.label)))), !collapsed.history && tAvgPrice > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.amberBg,
      border: `1px solid ${C.amber}25`,
      padding: 12,
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.amber,
      fontFamily: C.P,
      marginBottom: 2
    }
  }, "Avg Price \xB7 ", t.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      color: C.amber,
      fontFamily: C.P
    }
  }, _cbase, Math.round(tAvgPrice * _cfx)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: C.amber + '99',
      fontFamily: C.P,
      letterSpacing: '0.04em'
    }
  }, _ccode), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 400,
      color: C.mid,
      marginLeft: 2
    }
  }, "per bottle"))), !collapsed.history && t.topWines.length > 0 && /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 0,
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 14px 8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Top ", t.label), /*#__PURE__*/React.createElement("span", {
    onClick: () => nav('mywines'),
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      cursor: 'pointer'
    }
  }, "See all \u2192")), t.topWines.map((w, i) => {
    const col = _TYPE_COLORS[_norm(w.type)] || C.cr;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => {
        sessionStorage.setItem('vinterest_scan_result', JSON.stringify({
          demo: false,
          wine: w,
          confidence: 0.9,
          existingRating: w.rating || 0
        }));
        nav('detail');
      },
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderTop: `1px solid ${C.line}`,
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 24,
        height: 24,
        borderRadius: 12,
        background: C.crSoft,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 800,
        color: C.cr,
        fontFamily: C.P
      }
    }, "#", i + 1)), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 16,
        fontWeight: 600,
        color: C.ink,
        fontFamily: C.P,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, w.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.mid,
        fontFamily: C.P
      }
    }, [w.region, w.vintage ? String(w.vintage) : null].filter(Boolean).join(' · '))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 1,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        fontWeight: 800,
        color: C.amber,
        fontFamily: C.P
      }
    }, w.rating), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.mid,
        fontFamily: C.P
      }
    }, "/100")));
  })), /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P,
      marginBottom: 10
    }
  }, "Data Backup"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(Btn, {
    full: true,
    style: {
      flex: 1
    },
    onClick: () => {
      const data = {
        wines: WineHistory.getAll(),
        xp: XPSystem.get(),
        exported: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vinterest-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, "\u2B07 Export"), /*#__PURE__*/React.createElement(Btn, {
    full: true,
    style: {
      flex: 1
    },
    onClick: () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,application/json';
      inp.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const d = JSON.parse(ev.target.result);
            if (d.wines) WineHistory.save(d.wines);
            if (d.xp) localStorage.setItem(XPSystem.KEY, JSON.stringify(d.xp));
            alert('Restored! ' + (d.wines || []).length + ' wines imported.');
            window.location.reload();
          } catch (err) {
            alert('Could not read backup file.');
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    }
  }, "\u2B06 Import")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P,
      marginTop: 8,
      lineHeight: 1.5
    }
  }, "Export saves your wines & XP as a JSON file. Import restores from a previous backup.")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      padding: '12px 0 4px',
      opacity: 0.45
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Vinterest v1.0.91")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  }))), /*#__PURE__*/React.createElement("style", null, `@keyframes dnaSpin{to{transform:rotate(360deg)}}\n@keyframes dnaToast{0%{opacity:0;transform:translateY(-6px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}`));
}
Object.assign(window, {
  WineDNAScreen,
  WineIQScreen: WineDNAScreen
});

/* ---- pwa-app.jsx (precompiled) ---- */
/* Vinterest PWA — Main App with navigation */

function App() {
  const [screen, setScreen] = React.useState(() => {
    if (!localStorage.getItem('vinterest_onboarded')) return 'onboarding';
    const h = window.location.hash.replace('#', '').toLowerCase();
    return h && h !== 'onboarding' ? h : 'home';
  });
  const [stack, setStack] = React.useState(() => {
    const init = localStorage.getItem('vinterest_onboarded') ? 'home' : 'onboarding';
    return [init];
  });
  const [proGate, setProGate] = React.useState(null);

  // Tablet / iPad detection (localStorage 'vinterest_force_mobile'=1 overrides for preview)
  const forceMobile = () => localStorage.getItem('vinterest_force_mobile') === '1';
  const [isTablet, setIsTablet] = React.useState(() => !forceMobile() && window.innerWidth >= 768);
  React.useEffect(() => {
    const h = () => setIsTablet(!forceMobile() && window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  function nav(to) {
    window.location.hash = to;
    setStack(s => [...s, to]);
    setScreen(to);
  }
  function back() {
    if (stack.length <= 1) {
      setScreen('home');
      setStack(['home']);
      window.location.hash = 'home';
      return;
    }
    const ns = stack.slice(0, -1);
    setStack(ns);
    const prev = ns[ns.length - 1];
    setScreen(prev);
    window.location.hash = prev;
  }

  // Handle hardware back button / browser back
  React.useEffect(() => {
    const onPop = () => {
      const h = window.location.hash.replace('#', '') || 'home';
      setScreen(h);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const showNav = !['camera', 'onboarding', 'identified'].includes(screen);

  // XP Badge + overlay
  const [xpBadge, setXpBadge] = React.useState(() => XPSystem.get());
  const [showXpOverlay, setShowXpOverlay] = React.useState(false);
  React.useEffect(() => {
    const handler = () => setXpBadge(XPSystem.get());
    window.addEventListener('vinterest:xp', handler);
    return () => window.removeEventListener('vinterest:xp', handler);
  }, []);
  const showXpBadge = !['camera', 'onboarding', 'learn', 'quiz', 'article', 'gen-article', 'identified', 'detail', 'mywines', 'scan', 'profile', 'style-explore', 'winelist', 'account', 'settings', 'mastery-map'].includes(screen);

  // XP Toast
  const [xpToasts, setXpToasts] = React.useState([]);
  React.useEffect(() => {
    const handler = e => {
      const {
        awards
      } = e.detail || {};
      if (!awards || !awards.length) return;
      const id = Date.now() + Math.random();
      setXpToasts(t => [...t, {
        id,
        awards
      }]);
      setTimeout(() => setXpToasts(t => t.filter(x => x.id !== id)), 3200);
    };
    window.addEventListener('vinterest:xp', handler);
    return () => window.removeEventListener('vinterest:xp', handler);
  }, []);
  const ctx = {
    nav,
    back,
    showPro: setProGate,
    isTablet
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: isTablet ? '100%' : 430,
      height: '100dvh',
      margin: '0 auto',
      background: screen === 'camera' ? '#0A0A0A' : C.bg,
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      boxSizing: 'border-box',
      paddingTop: screen === 'onboarding' || screen === 'camera' ? 0 : 'env(safe-area-inset-top)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      minHeight: 0
    }
  }, screen === 'onboarding' && /*#__PURE__*/React.createElement(NewUserFlow, {
    onComplete: () => {
      localStorage.setItem('vinterest_onboarded', '1');
      nav('home');
    }
  }), screen === 'home' && /*#__PURE__*/React.createElement(HomeScreen, ctx), screen === 'scan' && /*#__PURE__*/React.createElement(ScanHomeScreen, ctx), screen === 'camera' && /*#__PURE__*/React.createElement(ScanScreen, ctx), screen === 'identified' && /*#__PURE__*/React.createElement(WineIdentifiedScreen, ctx), screen === 'winelist' && /*#__PURE__*/React.createElement(WineListScreen, ctx), screen === 'detail' && /*#__PURE__*/React.createElement(WineDetailScreen, ctx), screen === 'region' && /*#__PURE__*/React.createElement(RegionScreen, ctx), screen === 'varietal' && /*#__PURE__*/React.createElement(VarietalScreen, ctx), screen === 'similar' && /*#__PURE__*/React.createElement(SimilarWinesScreen, ctx), screen === 'style-explore' && /*#__PURE__*/React.createElement(StyleExploreScreen, ctx), screen === 'profile' && /*#__PURE__*/React.createElement(WineDNAScreen, ctx), screen === 'mywines' && /*#__PURE__*/React.createElement(MyWinesScreen, ctx), screen === 'learn' && /*#__PURE__*/React.createElement(QuizHubScreen, ctx), screen === 'quiz' && /*#__PURE__*/React.createElement(QuizScreen, ctx), screen === 'mastery-map' && /*#__PURE__*/React.createElement(MasteryMapScreen, ctx), screen === 'article' && /*#__PURE__*/React.createElement(LearnArticleScreen, ctx), screen === 'gen-article' && /*#__PURE__*/React.createElement(GenArticleScreen, ctx), screen === 'account' && /*#__PURE__*/React.createElement(AccountProfileScreen, ctx), screen === 'settings' && /*#__PURE__*/React.createElement(SettingsScreen, ctx)), showNav && /*#__PURE__*/React.createElement(BottomNav, {
    active: screen,
    nav: nav,
    showPro: setProGate
  }), showXpBadge && /*#__PURE__*/React.createElement("div", {
    onClick: () => setShowXpOverlay(true),
    style: {
      position: 'absolute',
      top: 'calc(env(safe-area-inset-top) + 15px)',
      right: 14,
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      padding: '5px 11px',
      borderRadius: 20,
      background: C.crSoft,
      border: `1px solid ${C.crDim}`,
      cursor: 'pointer',
      boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
      pointerEvents: 'auto'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      lineHeight: 1
    }
  }, XPSystem.getLevel(xpBadge.total).badge), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.cr,
      fontFamily: C.P
    }
  }, xpBadge.total, " XP"), !!localStorage.getItem('vinterest_pro') && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: '#fff',
      background: 'linear-gradient(135deg,#9B5E00,#C4870A)',
      borderRadius: 8,
      padding: '2px 6px',
      marginLeft: 2
    }
  }, "PRO")), showXpOverlay && (() => {
    const xd = XPSystem.get();
    const curLevel = XPSystem.getLevel(xd.total);
    const ACHIEVEMENTS = [{
      key: 'scan',
      label: 'Scan your first wine',
      icon: '🍷',
      done: xd.events.includes('type_red') || xd.events.includes('type_white') || xd.total > 0
    }, {
      key: 'rate',
      label: 'Rate 10 wines',
      icon: '⭐',
      done: xd.totalRatings >= 10
    }, {
      key: 'week5',
      label: '5 scans in one week',
      icon: '🚀',
      done: xd.events.some(e => e.startsWith('week5_'))
    }, {
      key: 'red',
      label: 'First red wine',
      icon: '🍇',
      done: xd.events.includes('type_red')
    }, {
      key: 'white',
      label: 'First white wine',
      icon: '🥂',
      done: xd.events.includes('type_white')
    }, {
      key: 'rose',
      label: 'First rosé wine',
      icon: '🌸',
      done: xd.events.includes('type_rosé') || xd.events.includes('type_rose')
    }, {
      key: 'sparkling',
      label: 'First sparkling wine',
      icon: '🍾',
      done: xd.events.includes('type_sparkling')
    }, {
      key: 'country',
      label: 'Wines from 3 countries',
      icon: '🌍',
      done: xd.events.filter(e => e.startsWith('country_')).length >= 3
    }, {
      key: 'grape',
      label: 'Discover 5 grape varieties',
      icon: '🔬',
      done: (xd.grapesSeen || []).length >= 5
    }, {
      key: 'expensive',
      label: 'Scan a premium wine (£100+)',
      icon: '💎',
      done: xd.events.some(e => e.startsWith('expensive_'))
    }, {
      key: 'streak',
      label: '3-answer quiz streak',
      icon: '🔥',
      done: xd.events.some(e => e.startsWith('streak')) || (() => {
        const s = xd.quizStreaks || {};
        return Object.values(s).some(v => v >= 3);
      })()
    }, {
      key: 'quiz',
      label: 'Complete a quiz',
      icon: '🎓',
      done: Object.keys(xd.quizCompleted || {}).length > 0
    }];
    const XP_LEVELS_LOCAL = [{
      name: 'Novice',
      min: 0,
      badge: '🍇'
    }, {
      name: 'Enthusiast',
      min: 150,
      badge: '🥂'
    }, {
      name: 'Explorer',
      min: 350,
      badge: '🌍'
    }, {
      name: 'Connoisseur',
      min: 650,
      badge: '🔍'
    }, {
      name: 'Aficionado',
      min: 1050,
      badge: '🏅'
    }, {
      name: 'Cru',
      min: 1600,
      badge: '🍾'
    }, {
      name: 'Sommelier',
      min: 2400,
      badge: '🎓'
    }, {
      name: 'Head Sommelier',
      min: 3500,
      badge: '⭐'
    }, {
      name: 'Master Sommelier',
      min: 5000,
      badge: '🏆'
    }, {
      name: 'Grand Master',
      min: 7000,
      badge: '👑'
    }];
    return /*#__PURE__*/React.createElement("div", {
      onClick: () => setShowXpOverlay(false),
      style: {
        position: 'absolute',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 500,
        display: 'flex',
        alignItems: 'flex-end',
        backdropFilter: 'blur(3px)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        background: C.white,
        borderRadius: '22px 22px 0 0',
        width: '100%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideUp .3s cubic-bezier(.34,1.2,.64,1)'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        justifyContent: 'center',
        padding: '10px 0 0'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 38,
        height: 4,
        borderRadius: 2,
        background: C.line
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${C.line}`,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: C.ink,
        fontFamily: C.P
      }
    }, curLevel.badge, " ", curLevel.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        color: C.mid,
        fontFamily: C.P
      }
    }, xd.total, " XP total")), /*#__PURE__*/React.createElement("div", {
      onClick: () => setShowXpOverlay(false),
      style: {
        width: 34,
        height: 34,
        borderRadius: 17,
        background: C.offWhite,
        border: `1px solid ${C.line}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        lineHeight: 1,
        color: C.ink
      }
    }, "\xD7"))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        overflowY: 'auto',
        padding: '14px 20px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.mid,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: C.P,
        marginBottom: 10
      }
    }, "Tiers"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        marginBottom: 20
      }
    }, XP_LEVELS_LOCAL.map((lv, i) => {
      const isActive = curLevel.name === lv.name;
      const isDone = xd.total >= lv.min;
      const next = XP_LEVELS_LOCAL[i + 1];
      const prog = next ? Math.min(1, (xd.total - lv.min) / (next.min - lv.min)) : 1;
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        style: {
          borderRadius: 12,
          padding: '10px 12px',
          background: isActive ? C.crSoft : C.offWhite,
          border: `1.5px solid ${isActive ? C.cr : C.line}`,
          opacity: isDone ? 1 : 0.45
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 20,
          flexShrink: 0
        }
      }, lv.badge), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 16,
          fontWeight: isActive ? 700 : 500,
          color: isActive ? C.cr : C.ink,
          fontFamily: C.P
        }
      }, lv.name), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          color: C.mid,
          fontFamily: C.P
        }
      }, lv.min, " XP", isActive ? ' ← you' : '')), isActive && next && /*#__PURE__*/React.createElement(Prog, {
        val: prog,
        h: 5,
        col: C.cr,
        style: {
          marginTop: 4
        }
      }))));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 15,
        fontWeight: 600,
        color: C.mid,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: C.P,
        marginBottom: 10
      }
    }, "Achievements"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        paddingBottom: 24
      }
    }, ACHIEVEMENTS.map((a, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        borderRadius: 12,
        padding: '10px 12px',
        background: a.done ? C.greenBg : C.offWhite,
        border: `1px solid ${a.done ? C.green + '40' : C.line}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        opacity: a.done ? 1 : 0.5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 22
      }
    }, a.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: a.done ? C.green : C.ink,
        fontFamily: C.P,
        lineHeight: 1.3
      }
    }, a.label), a.done && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: C.green,
        fontFamily: C.P
      }
    }, "\u2713 Completed"))))), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '10px 20px 28px',
        borderTop: `1px solid ${C.line}`,
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => {
        setShowXpOverlay(false);
        nav('learn');
      },
      style: {
        background: C.cr,
        borderRadius: 12,
        padding: '13px',
        textAlign: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 16,
        fontWeight: 700,
        color: '#fff',
        fontFamily: C.P
      }
    }, "Start a Quiz \u2014 Earn XP")))));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      pointerEvents: 'none',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      paddingTop: 'calc(env(safe-area-inset-top) + 12px)'
    }
  }, xpToasts.map(toast => /*#__PURE__*/React.createElement("div", {
    key: toast.id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      animation: 'xpIn .35s cubic-bezier(.34,1.56,.64,1) both'
    }
  }, toast.awards.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: a.levelUp ? '#0F0F0F' : a.bonus ? C.cr : 'rgba(15,15,15,0.88)',
      borderRadius: 30,
      padding: '8px 16px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
    }
  }, a.levelUp && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17
    }
  }, "\uD83C\uDFC6"), a.bonus && !a.levelUp && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15
    }
  }, "\u2B50"), !a.levelUp && !a.bonus && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.amber,
      fontFamily: C.P
    }
  }, "+", a.amount, " XP"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      fontFamily: C.P
    }
  }, a.label)))))), proGate && /*#__PURE__*/React.createElement(ProGate, {
    feature: proGate,
    onClose: () => setProGate(null)
  }), /*#__PURE__*/React.createElement("style", null, `@keyframes xpIn{from{opacity:0;transform:translateY(-16px) scale(.9)}to{opacity:1;transform:none}} @keyframes slideUp{from{transform:translateY(100%)}to{transform:none}}`));
}

/* ── Simple Discover placeholder ── */
function DiscoverScreen({
  nav,
  back
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 800,
      color: C.ink,
      fontFamily: C.P,
      letterSpacing: '-0.5px'
    }
  }, "Discover"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.mid,
      fontFamily: C.P
    }
  }, "Wines matched to your taste profile")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, "If You Like Pinot Grigio\u2026"), [{
    name: 'Pinot Gris',
    region: 'Alsace, France',
    note: 'Same grape, richer style — more body and texture',
    score: 95
  }, {
    name: 'Pinot Blanc',
    region: 'Alsace / Alto Adige',
    note: 'Crisp and clean with subtle apple notes',
    score: 91
  }, {
    name: 'Soave Classico',
    region: 'Veneto, Italy',
    note: 'Similar weight and minerality to Pinot Grigio',
    score: 88
  }, {
    name: 'Vermentino',
    region: 'Sardinia / Provence',
    note: 'Zesty and herbal — a Mediterranean cousin',
    score: 84
  }, {
    name: 'Albariño',
    region: 'Rías Baixas, Spain',
    note: 'Aromatic and crisp — a step toward Sauvignon Blanc',
    score: 80
  }].map((w, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    onClick: () => nav('detail'),
    style: {
      padding: 10,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 34,
      height: 46,
      borderRadius: 6,
      background: '#B8963E15',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 15,
    col: "#B8963E"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 8px',
      borderRadius: 7,
      background: C.greenBg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, w.score, "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, w.region), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      marginTop: 3,
      lineHeight: 1.4
    }
  }, w.note))))), /*#__PURE__*/React.createElement(Card, {
    style: {
      background: C.greenBg,
      border: `1px solid ${C.green}25`,
      padding: 12,
      boxShadow: 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P,
      marginBottom: 4
    }
  }, "\uD83D\uDCA1 Menu Tip"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.ink2,
      fontFamily: C.P,
      lineHeight: 1.5
    }
  }, "Don't see Pinot Grigio on the list? Ask for Soave or Vermentino \u2014 same flavour family and often better value.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  })));
}

/* ── Simple Shopping placeholder ── */
function ShoppingScreen({
  nav,
  back
}) {
  const [rating, setRating] = React.useState(0);
  const [hov, setHov] = React.useState(0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      padding: '14px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      borderBottom: `1px solid ${C.line}`,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: back,
    style: {
      width: 34,
      height: 34,
      borderRadius: 17,
      background: C.offWhite,
      border: `1px solid ${C.line}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "back",
    sz: 16,
    col: C.ink
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P,
      flex: 1
    }
  }, "Shopping Mode"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.cr,
      fontFamily: C.P,
      padding: '4px 10px',
      borderRadius: 20,
      background: C.crSoft
    }
  }, "In Store")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '14px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      padding: 14,
      border: `1.5px solid ${C.green}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 46,
      height: 64,
      borderRadius: 8,
      background: C.crSoft,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 22,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "Meiomi Pinot Noir"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, "California \xB7 Pinot Noir")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 8px',
      borderRadius: 7,
      background: C.greenBg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, "88%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 5,
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement(Pill, {
    active: true,
    sm: true
  }, "Red"), /*#__PURE__*/React.createElement(Pill, {
    sm: true
  }, "Medium Body")))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: `1px solid ${C.line}`,
      marginTop: 10,
      paddingTop: 10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 700,
      color: C.ink,
      fontFamily: C.P
    }
  }, "$18.99"), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    small: true
  }, "Add to Cart"))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.mid,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      fontFamily: C.P
    }
  }, "Also on This Shelf"), [{
    name: 'Elouan Pinot Noir',
    sub: 'Oregon · $22',
    score: 92,
    note: 'Higher match — try this one!'
  }, {
    name: 'La Crema Pinot Noir',
    sub: 'Sonoma · $19',
    score: 85,
    note: 'Similar style, great value'
  }].map((w, i) => /*#__PURE__*/React.createElement(Card, {
    key: i,
    style: {
      padding: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 32,
      height: 44,
      borderRadius: 6,
      background: C.crSoft,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: "wine",
    sz: 14,
    col: C.cr
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: C.ink,
      fontFamily: C.P
    }
  }, w.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.mid,
      fontFamily: C.P
    }
  }, w.sub), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.cr,
      fontFamily: C.P,
      marginTop: 2,
      fontWeight: 500
    }
  }, w.note)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 8px',
      borderRadius: 7,
      background: C.greenBg
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.green,
      fontFamily: C.P
    }
  }, w.score, "%"))))), /*#__PURE__*/React.createElement(Btn, {
    primary: true,
    full: true,
    onClick: () => nav('scan')
  }, "Scan Another Bottle"), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8
    }
  })));
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
