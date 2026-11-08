/* TeamLearn: how a restaurant's staff learn its list and menu, and whether each of them is ready
   to work the floor (docs/business.md). Built for retention, not points:

   - A ladder per wine: recognise (four options, first exposure only), recall (typed), apply (a guest
     at a table, answered in their own words and marked against the list and menu) and contrast
     (telling it from the most similar wine on the list). Each rung opens once the one below has been
     answered right, and a role needs the rungs it sells with (ROLES).
   - Every question has its own review date, from how this person has answered it: a stability in
     days that grows with each right answer (more when it was answered late and still right), shrinks
     on a miss, and is capped at MAX_DAYS. Before answering they say how sure they are; a confident
     wrong answer comes back within hours, since that's the mistake that reaches a guest.
   - Readiness is the share of the live list and menu they know now (every question their role needs
     for it answered right and not yet due), against their role's minimum. Below it after having
     been above is Slipping, not Not ready.
   - A wine or dish added at publish (TeamData.publish) is assigned to every role that sells it, due
     in the venue's dueDays. CHECK_SHARE of drill questions re-ask something they already know without
     warning, to measure retention honestly (retention()).
   The pilot keeps people and progress on this device (Store, vbiz_*). */
const TeamLearn = {
  KEY:'vbiz_team_v1', PROGRESS:'vbiz_learn_v1',
  DAY:86400000, MAX_DAYS:60, RETAIN:0.9, DRILL_SIZE:5, CHECK_SHARE:0.1, PASS:0.67,
  LADDER:['recognise','recall','apply','contrast'],
  // Who runs the wine programme: they get the management console on a tablet or laptop, Upload and Team on the
  // phone, the team figures on Today, and may edit what to say on a card. Everyone else gets the training app.
  MANAGES:['manager','buyer','sommelier'],
  manages(role){ return this.MANAGES.includes(role); },
  /* Who may open the management console, person by person: set when they're added or on their row in the console's
     Team section (`console` on the person), else what their role allows (MANAGES). The console's Upload and Team tabs
     on the phone, Today's team figures and the way into the console all follow it. */
  canConsole(p){ return !!p&&(typeof p.console==='boolean'?p.console:this.manages(p.role)); },
  setConsole(pid,on){ const t=this.team(); if(!t.people[pid]) return; t.people[pid]={...t.people[pid],console:!!on}; this._saveTeam(t); },
  ROLES:{
    server:{label:'Server',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8,cocktails:0.5,allergens:1}},
    bartender:{label:'Bartender',kinds:['recognise','recall','apply'],cocktailKinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0,dishes:0.5,cocktails:0.9,allergens:1}},
    sommelier:{label:'Sommelier',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9,cocktails:0.5,allergens:1}},
    buyer:{label:'Buyer',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9,cocktails:0,allergens:1}},
    manager:{label:'Manager',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8,cocktails:0.5,allergens:1}},
  },
  // Cocktails count only where the restaurant has a cocktail list (The Social Corner); everywhere else the part doesn't exist.
  // Allergens is the one hard gate: every dish the kitchen has confirmed, at 100%, whatever else a person knows.
  PART_LABEL:{glass:'By the glass',bottle:'Bottles',dishes:'Menu pairings',cocktails:'Cocktails',allergens:'Allergens'},
  /* The rungs a role needs for one item: a cocktail's for the bartender all four (it's their list), a wine's by role. */
  kindsFor(role,id){ const r=this.ROLES[role]; return this.isCocktail(id)&&r.cocktailKinds?r.cocktailKinds:r.kinds; },
  isCocktail(id){ return /^c-/.test(String(id||'')); },
  /* A wine's or a cocktail's questions, by its id. */
  qsOf(id){ return this.isCocktail(id)?this.cocktailQs(id):/^d-/.test(String(id||''))&&TeamData.dish(id)?this.dishQs(id):this.wineQs(id); },
  /* Training levels: how much each wine asks of the staff, set by management for the restaurant (`level`)
     with a level per role over it (`roleLevels`), kept in vbiz_team_v1 beside the minimums. A level only
     filters what's already written (cards, questions), never rewrites it, so a restaurant moves between
     levels at once and keeps every answer it holds.
     low: one thing to say about it and what it pours with (lightQs, built from the card, no Claude call),
       the card's table questions, and one fact to read; a cocktail adds its base spirit.
     medium: low's table questions plus recognising it, its grape, where it's from and how it tastes
       (a cocktail: its spirit, what's in it, its flavours, who created it).
     high: every question the card has, rules, methods, vintages and telling similar wines apart. */
  LEVELS:['low','medium','high'],
  LEVEL_LABEL:{low:'Low',medium:'Medium',high:'High'},
  LEVEL_ABOUT:{low:"One thing to say about each wine, what it pours with, and one fact to know.",medium:"Adds each wine's grape, where it's from and how it tastes.",high:"Everything: rules, how it's made, vintages and telling similar wines apart."},
  level(role){ const t=this.team(), r=role&&(t.roleLevels||{})[role]; return this.LEVELS.includes(r)?r:this.LEVELS.includes(t.level)?t.level:'high'; },
  roleLevel(role){ const r=(this.team().roleLevels||{})[role]; return this.LEVELS.includes(r)?r:null; },
  setLevel(lv){ if(!this.LEVELS.includes(lv)) return; const t=this.team(); t.level=lv; this._saveTeam(t); },
  setRoleLevel(role,lv){ const t=this.team(); t.roleLevels={...(t.roleLevels||{})}; if(this.LEVELS.includes(lv)) t.roleLevels[role]=lv; else delete t.roleLevels[role]; this._saveTeam(t); },
  // What a card shows at a level: staff are only asked about what they've been shown.
  cardShows(lv){ const hi=lv==='high', mid=hi||lv==='medium';
    return {fact:lv==='low',grapes:mid,style:mid,grape:mid,place:mid,serve:mid,alts:mid,spec:mid,story:mid,producer:hi,window:hi,usually:hi}; },
  // Low's one fact to read: the producer, else the place, else the grape; a cocktail's story.
  cardFact(id){ if(this.isCocktail(id)){ const c=TeamData.cocktailCard(id); return c&&(c.story||c.spirit&&`Made with ${c.spirit}.`)||null; } const c=TeamData.card(id); if(!c) return null; return c.producer||c.place||c.grape||null; },
  MEDIUM_TOPICS:new Set(['wine','grape','place','country','flavour']),
  MEDIUM_DRINK:new Set(['spirit','ingredient','flavour','creator']),
  HIGH_ONLY:/classif|\btiers?\b|quality (label|level)|\brules?\b|\blaws?\b|\bminimum\b|designation|appellation|\blees\b|\bvintage\b|\bmonths\b|\byears\b/i,
  atLevel(q,lv,drink){ if(lv==='high'||q.dish) return true; if(q.k==='contrast') return false; if(q.k==='apply') return true;
    const t=this._topic(q.q,drink);
    if(lv==='low') return drink?t==='spirit':t==='wine';
    if(drink) return this.MEDIUM_DRINK.has(t);
    if(this.HIGH_ONLY.test(q.q)) return false; // rules and systems stay at High, whatever they mention
    if(this.MEDIUM_TOPICS.has(t)) return true;
    return q.k==='recognise'&&!t&&/describ|style|best fits|which of these/i.test(q.q); },
  levelQs(id,lv){ const base=this.qsOf(id); if(lv==='high') return base; const drink=this.isCocktail(id)||TeamData.isDrink(TeamData.wine(id));
    const kept=base.filter(q=>this.atLevel(q,lv,drink)); return lv==='low'?[...this.lightQs(id),...kept]:kept; },
  // A role's questions on a wine: its level, then the rungs the role climbs.
  qsFor(role,id){ const kinds=this.kindsFor(role,id); return this.levelQs(id,this.level(role)).filter(q=>kinds.includes(q.k)); },

  team(){ const raw=Store.get(this.KEY); if(raw!==null&&raw===this._teamRaw) return this._teamVal;
    const t=raw?Store.getJSON(this.KEY,null):null, v=t&&t.people?t:{people:{},me:null,targets:{}}; this._teamRaw=raw; this._teamVal=v; return v; },
  _saveTeam(t){ Store.setJSON(this.KEY,t); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  people(){ return Object.values(this.team().people).sort((a,b)=>a.created-b.created); },
  person(id){ return this.team().people[id]||null; },
  me(){ const t=this.team(); return t.people[t.me]||null; },
  addPerson(name,role,photo,console){ const t=this.team(), id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    t.people[id]={id,name:String(name).trim(),role,photo:photo||null,created:Date.now(),...(typeof console==='boolean'?{console}:{})}; if(!t.me) t.me=id; this._saveTeam(t);
    this.assignExisting(id); return id; },
  removePerson(id){ const t=this.team(); delete t.people[id]; if(t.me===id) t.me=Object.keys(t.people)[0]||null; this._saveTeam(t); const p=this._all(); delete p[id]; this._saveAll(p); },
  setMe(id){ const t=this.team(); t.me=id; this._saveTeam(t); },
  need(role){ const t=this.team(); return {...this.ROLES[role].need,...((t.targets||{})[role]||{})}; },
  setNeed(role,part,v){ const t=this.team(); t.targets=t.targets||{}; t.targets[role]={...(t.targets[role]||{}),[part]:v}; this._saveTeam(t); },

  // Progress is read per question in the drill and the readiness figures; parsed once per stored text, as TeamData.get.
  _all(){ const raw=Store.get(this.PROGRESS); if(raw!==null&&raw===this._allRaw) return this._allVal;
    const v=(raw?Store.getJSON(this.PROGRESS,{}):null)||{}; this._allRaw=raw; this._allVal=v; return v; },
  _saveAll(p){ Store.setJSON(this.PROGRESS,p); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} }, // so Today redraws its figures after a drill
  _mine(p,pid){ p[pid]=p[pid]||{items:{},checks:[],assigned:{}}; return p[pid]; },
  /* Today's drill, done: the daily drill (not a part's practice or Vinny's test) finished on this phone's calendar
     day, so Today can say it's done and offer more rather than ask again as if it hadn't been. {n, right, of} or null. */
  _day(now=Date.now()){ const d=new Date(now); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; },
  drillDone(pid,right,of,now=Date.now()){ const p=this._all(), m=this._mine(p,pid), k=this._day(now), was=(m.drills||{})[k]||{n:0,right:0,of:0};
    m.drills={[k]:{n:was.n+1,right:was.right+right,of:was.of+of,at:now}}; this._saveAll(p); },
  doneToday(pid,now=Date.now()){ const m=(this._all()[pid]||{}); return ((m.drills||{})[this._day(now)])||null; },

  /* Every question for a wine (its card's) and for a dish (written here from its pairing: no call). */
  // Four options are shown in an order fixed per question, so the right one isn't always where it was written.
  // A wine's questions as the drill asks them, built once per version of the restaurant's data (TeamData.get
  // keeps one parsed document until the stored text changes) and handed out as copies.
  _qsCache:new WeakMap(),
  // Questions the sommelier review still doubts (TeamData.reviewed().held) stay out of the drill until the next review;
  // {all:true} is the review's own view of everything.
  // The held questions as a set, made once per review result (TeamData.get keeps the same object until the data is written):
  // the demo's sales setup asks for it hundreds of thousands of times, and The Princess Royal holds 407.
  _held(){ const r=typeof TeamData!=='undefined'&&TeamData.reviewed&&TeamData.reviewed();
    if(this._heldFor&&this._heldFor.r===r) return this._heldFor.set;
    const set=new Set(r&&r.held||[]); this._heldFor={r,set}; return set; },
  _keep(qs,all){ if(all) return qs; const h=this._held(); return h.size?qs.filter(q=>!h.has(q.id)):qs; },
  wineQs(id,{all=false}={}){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    if(!m.has(id)) m.set(id,this._buildQs(id));
    // A recall or comparison question with nothing of its own to offer as wrong answers (only the mixed pool) isn't
    // asked: the publish check sends it back as thin. Worked out once per list, outside the choices it calls.
    if(!m.has('pool:'+id)&&!this._poolBusy){ this._poolBusy=true;
      try{ m.set('pool:'+id,new Set(m.get(id).filter(q=>q.k==='recall'||q.k==='contrast').filter(q=>{ try{ const c=this.choices(q); return c&&c.via==='pool'; }catch(e){ return false; } }).map(q=>q.id))); }
      finally{ this._poolBusy=false; } }
    const pooled=m.get('pool:'+id)||new Set();
    return this._keep(m.get(id).filter(q=>all||!pooled.has(q.id)).map(q=>({...q})),all); },
  /* Which questions ask how sure they are: a price (a wrong price reaches the bill), an allergen (a wrong one reaches a
     guest). Everywhere else the drill reads confidence from how fast a right answer came (TeamDrill), so a grape
     question is one tap, not two. */
  asksConfidence(q){ return !!(q&&(q.conf||(q.k==='recall'&&/[£$€]/.test(String(q.ans||'')))||q.allergen)); },
  /* A card question that asks what an earlier one on the same card already asks: the same answer ("What grape…" and
     "Which grape… 2021", both Cabernet Sauvignon), or an answer that sits inside an earlier one ("Blackcurrant and cedar"
     after "Full and weighty, firmly grippy, with blackcurrant and cedar"). Left out of the drill; the publish check
     sends it back to be rewritten about something else (reason `repeat`). Set of question ids. */
  _ansOf(q){ return String(q.opts&&q.a!=null?q.opts[q.a]:q.k==='apply'?'':q.ans||''); },
  _repeats(id){ const c=TeamData.card(id); return c?this._repeatsIn(c.qs||[],id):new Set(); },
  _repeatsIn(qs,id){ const seen=[], out=new Set();
    qs.forEach((q,i)=>{ const a=this._ansOf(q), n=this._norm(a), ws=this._words(a).filter(w=>w.length>2); if(!n){ return; }
      const dup=seen.some(p=>p.n===n||(ws.length>=2&&ws.every(w=>p.ws.includes(w)))||(p.ws.length>=2&&p.ws.every(w=>ws.includes(w))));
      if(dup) out.add(q.id||`${id}#${i}`); else seen.push({n,ws}); });
    return out; },
  _buildQs(id){ const rep=this._repeats(id); const c=TeamData.card(id); return (c&&c.qs||[]).filter(q=>!rep.has(q.id)).map(q=>this._unspoil({...q,wine:id})).filter(Boolean).map(q=>this._plainPlace(q)).map(x=>{
    // A table question whose answers can't be built from what the list says (too few believable wrong ones)
    // isn't asked; the publish check sends it back to be rewritten.
    if(x.k==='apply'){ const d=this._decide(x); let c=null; try{ c=this._applyChoices(d); }catch(e){ return d; } if(!c) return null;
      // No fair choice of wine here (nothing on the list the guest's request and the dish both rule out): the
      // question says which wine it is, so "Why it works" has something to be about.
      const w=TeamData.wine(id), named=w&&[TeamData.short(w),w.name].some(n=>n&&this._norm(d.q).includes(this._norm(n)));
      if(w&&!named&&!c.steer&&c.groups&&c.groups.length===1&&c.groups[0].label==='Why it works'){ const sents=(String(d.q).match(/[^.?!]+[.?!]*/g)||[d.q]).map(t=>t.trim()).filter(Boolean);
        const scen=sents.length>1&&/\?$/.test(sents[sents.length-1])?sents.slice(0,-1).join(' '):sents.join(' ');
        return {...d,q:`${/[.?!]$/.test(scen)?scen:scen+'.'} You suggest the ${TeamData.short(w)}. Why does it work?`}; }
      return d; }
    if(x.k!=='recognise') return x;
    x=this._sameKind(x); if(!x||this.givesAway(x)||this.lengthCue(x)) return null; // the publish check rewrites these (reasons giveaway, cue)
    const order=this._shuffle(x.opts.map((_,i)=>i),x.id); return {...x,opts:order.map(i=>this._cap(x.opts[i])),a:order.indexOf(x.a)}; }).filter(Boolean); },
  /* Low's own questions, built from the card with no Claude call: which line you'd tell a guest about it
     (its taste line against three other wines of the same kind, as unlike it as the list allows) and which
     dish you'd suggest it with (one of its own dishes against three it doesn't suit). Kept per document
     like wineQs, with ids of their own so progress on them is theirs. */
  lightQs(id,{all=false}={}){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    const k='light:'+id; if(!m.has(k)) m.set(k,this._buildLight(id)); return this._keep(m.get(k).map(q=>({...q})),all); },
  /* Each question has to have one answer a trained server would stand behind, so the wrong ones are
     plainly wrong: another wine's line only when that wine is clearly different (SAY_GAP apart in style and
     sharing few words), a dish only when the pairings say this wine doesn't suit it (tableFit). Without three
     such wrong answers the question isn't asked. */
  SAY_GAP:4, SAY_OVERLAP:0.4,
  /* What the answer screen adds under a right or wrong answer (TeamDrill): something the server can use that the
     answer didn't already say. The question's own why when it adds to the answer; when it only says the answer again
     ("It's usually a fresh white with citrus…" under "Fresh and savoury, with citrus…"), the card's hook, a dish to
     pour it with, how to serve it or a term explained instead. Never a line already shown in the same drill (`used`). {label, text} | null */
  _first(t,max=22){ const one=(String(t||'').match(/^[^.!?]+[.!?]?/)||[''])[0].trim(), w=one.split(/\s+/);
    return w.length>max?w.slice(0,max).join(' ').replace(/[,;:]$/,'')+'…':one; },
  // `used`: the lines already shown in this drill, so the same dish or fact never comes up twice in a row of questions;
  // the first choice also turns with the question, so two questions on one wine start from different lines.
  aside(q,answer,used=new Set()){
    if(!q) return null; const ans=String(answer||q.ans||(q.opts&&q.a!=null?q.opts[q.a]:'')||'');
    const adds=t=>t&&this._overlap(t,ans)<0.45&&!this._norm(t).includes(this._norm(ans));
    const trim=t=>{ const ss=String(t).match(/[^.!?]+[.!?]*/g)||[String(t)]; let o=''; for(const x of ss){ if((o+x).split(/\s+/).filter(Boolean).length>this.REVIEW_WORDS) break; o+=x; } return (o||this._first(t,this.REVIEW_WORDS)).trim(); };
    const fresh=t=>!used.has(trim(t))&&![...used].some(u=>this._overlap(u,t)>=0.6);
    if(q.why&&adds(q.why)&&fresh(q.why)) return {label:null,text:trim(q.why)};
    const more=[];
    if(q.wine){ const c=TeamData.card(q.wine)||{};
      if(c.hook) more.push(c.hook);
      (c.dishes||[]).forEach(d=>d&&d.dish&&more.push(`Pour it with the ${d.dish}: ${this._first(d.why).replace(/^./,ch=>ch.toLowerCase())}`));
      if(c.serve&&(c.serve.temp||c.serve.glass)) more.push(`Serve it ${[c.serve.temp,c.serve.glass&&`in ${c.serve.glass.replace(/^an? /i,'a ')}`].filter(Boolean).join(', ')}.`);
      if(c.place) more.push(this._first(c.place,30)); if(c.grape) more.push(this._first(c.grape,30)); }
    if(q.cocktail){ const c=TeamData.cocktailCard(q.cocktail)||{};
      (c.explain||[]).forEach(e=>e&&e.term&&more.push(`${e.term}: ${e.means}`));
      (c.dishes||[]).forEach(d=>d&&d.dish&&more.push(`Good with the ${d.dish}: ${this._first(d.why).replace(/^./,ch=>ch.toLowerCase())}`)); }
    if(q.dish){ const c=TeamData.dishCard(q.dish)||{}; (c.ask||[]).forEach(a=>a&&a.q&&more.push(`Guests ask "${a.q}" ${a.a}`)); }
    const cand=more.map(t=>String(t).trim()).filter(Boolean).filter(t=>adds(t)&&(!q.why||this._overlap(t,q.why)<0.45)&&fresh(t)), off=cand.length?Math.abs(this._hash(String(q.id)))%cand.length:0;
    const pick=cand.length?cand[off]:null;
    return pick?{label:'Good to know',text:trim(pick)}:null; },
  _overlap(a,b){ const A=new Set(this._words(a).filter(x=>x.length>3)), B=new Set(this._words(b).filter(x=>x.length>3)); let n=0; A.forEach(x=>{ if(B.has(x)) n++; }); return n/Math.max(1,Math.min(A.size,B.size)); },
  // Where a wine stands at a dish: 0 its first pick, 1 its second…, 99 not one of its picks.
  rankAt(wineId,dishId){ const p=TeamData.pairing(dishId)||{}; const i=(p.best||[]).findIndex(b=>b.id===wineId); if(i>=0) return i; if(p.cocktail&&p.cocktail.id===wineId) return 0; if(p.glass&&p.glass.id===wineId) return 1; return 99; },
  _buildLight(id){ const w=TeamData.wine(id), c=TeamData.card(id); if(!w||!c) return []; const out=[], name=TeamData.short(w), drink=TeamData.isDrink(w), kind=this.kindOf(w);
    const st=c.style||{}, gap=o=>{ const s=(TeamData.card(o.id)||{}).style||{}; return Object.keys(st).reduce((a,k)=>a+Math.abs((st[k]||0)-(s[k]||0)),0); };
    const others=TeamData.wines().filter(o=>o.id!==id&&this.kindOf(o)===kind&&(TeamData.card(o.id)||{}).taste).sort((a,b)=>gap(b)-gap(a)||(a.id<b.id?-1:1));
    const tastes=[]; for(const o of others){ const t=TeamData.card(o.id).taste; if(gap(o)<this.SAY_GAP) break;
      if(this._overlap(t,c.taste)<this.SAY_OVERLAP&&!tastes.some(x=>this._overlap(x,t)>=0.5)) tastes.push(t); if(tastes.length===3) break; }
    if(c.taste&&tastes.length===3) out.push(this._light(id+'#say',`Which of these would you tell a guest about the ${name}?`,[c.taste,...tastes],c.pitch,id));
    // What it pours with: the dish it ranks highest at in the pairings (its first pick if it is one), against
    // three the pairings say it doesn't suit.
    const menu=TeamData.dishes(), byName=n=>menu.find(x=>this._norm(x.name)===this._norm(n));
    const own=new Set((c.dishes||[]).map(x=>byName(x.dish)).filter(Boolean).map(x=>x.id));
    const ranked=menu.filter(x=>this.rankAt(id,x.id)<99).sort((a,b)=>this.rankAt(id,a.id)-this.rankAt(id,b.id)||((TeamData.pairing(a.id)||{}).best||[]).length-((TeamData.pairing(b.id)||{}).best||[]).length||this._hash(id+a.id)-this._hash(id+b.id));
    const top=ranked[0]||menu.find(x=>own.has(x.id));
    if(top){ const p=TeamData.pairing(top.id)||{}, pick=[...(p.best||[]),p.cocktail,p.glass].filter(Boolean).find(b=>b.id===id), cw=(c.dishes||[]).find(x=>byName(x.dish)===top);
      const wrongFor=x=>x.id!==top.id&&!own.has(x.id)&&this.rankAt(id,x.id)===99&&(drink||this.clearlyWrong(id,x.id));
      // The wrong dishes nearest the right one in the length of their names, so the answer never stands out by length.
      const wrong=this._shuffle(menu.filter(wrongFor),id).sort((a,b)=>Math.abs(a.name.length-top.name.length)-Math.abs(b.name.length-top.name.length)).slice(0,3);
      if(wrong.length===3) out.push(this._light(id+'#pair',`Which dish on our menu is the best match for the ${name}?`,[top.name,...wrong.map(x=>x.name)],(pick&&pick.why)||(cw&&cw.why)||'',id)); }
    return out.filter(q=>!this.givesAway(q)&&!this.lengthCue(q)); },
  _light(qid,q,opts,why,wine){ const order=this._shuffle(opts.map((_,i)=>i),qid); return {id:qid,k:'recognise',q,opts:order.map(i=>this._cap(opts[i])),a:order.indexOf(0),why,wine,light:true}; },
  /* At the table the decision comes first. A card's table question often names its own wine ("A guest is
     having the venison and wants a bottle with character. How would you recommend the Bandol?"), which hands
     over the pairing and leaves only the reason to test. Where the scenario stands without the wine's name
     and names a dish the wine suits, it's asked as the guest would ask it: "…What would you suggest, and
     why?", so the server picks the wine from four (three the pairings rule out) and then says why. The id is
     unchanged, so progress on it carries over. A key that steers to another wine is left as written. */
  // The wrong wines for a table: on the list (never invented, never another price), ones the pairings rule out
  // for this dish, of the nearest plausible kinds (a rosé or a white beside a red; a dessert or fortified wine
  // only for one), wines and cocktails apart.
  NEAR:{red:['red','orange','rosé','white'],white:['white','orange','sparkling','rosé'],'rosé':['rosé','white','sparkling','red'],sparkling:['sparkling','white','rosé'],orange:['orange','white','red','rosé'],sweet:['sweet','fortified','white'],fortified:['fortified','sweet','red'],cocktail:['cocktail']},
  /* Clearly wrong at a dish, the standard for a wrong answer: the dish's own avoid, or far from every pick in
     body, tannin and sweetness together (DECOY_GAP), or a colour none of its picks has. A Barolo beside a Brunello at a Bolognese is neither: a sommelier would pour it, so it's
     never offered as wrong. */
  DECOY_GAP:5,
  clearlyWrong(wineId,dishId){ const pr=TeamData.pairing(dishId); if(!pr) return false; if(pr.avoid&&pr.avoid.id===wineId) return true;
    // A cocktail is never "another colour" from the dish's wine picks: only a drink the writer named as wrong, or
    // one that fails what the guest asked for, is a wrong cocktail.
    if(TeamData.isDrink(TeamData.wine(wineId))) return false;
    const picks=[...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id].filter(Boolean); if(!picks.length||picks.includes(wineId)) return false;
    const st=id=>(TeamData.card(id)||{}).style||{}, a=st(wineId); if(a.body==null) return false;
    const gap=Math.min(...picks.map(id=>{ const b=st(id); return b.body==null?99:Math.abs(a.body-b.body)+Math.abs((a.tannin||0)-(b.tannin||0))+Math.abs((a.sweet||0)-(b.sweet||0)); }));
    const w=TeamData.wine(wineId), otherColour=w&&picks.every(id=>{ const p=TeamData.wine(id); return p&&this.kindOf(p)!==this.kindOf(w); });
    // A colour none of the dish's picks has is a deliberate "no" (a Sancerre with venison whose picks are all
    // red, a red with oysters), whatever the figures say: a light Pinot pick sits near a crisp white on paper.
    return gap>=this.DECOY_GAP||otherColour; },
  // What the guest asked for, read from the question: a colour or kind, and a glass or a bottle. Every wrong
  // wine honours it, or the request alone would point at the answer.
  wishIn(text,rw){ const t=String(text||'').toLowerCase(); if(rw&&TeamData.isDrink(rw)) return {kind:'cocktail',side:null};
    const kind=/\bcocktail|\bmocktail|\bspritz\b/.test(t)?'cocktail':/\bsparkling|\bfizz|\bbubbl|champagne/.test(t)?'sparkling':/\bros[eé]\b|\bpink\b/.test(t)?'rosé':/\bwhite\b/.test(t)?'white':/\bred\b/.test(t)?'red':/\bsweet\b|\bdessert wine|\bsticky\b/.test(t)?'sweet':/\bport\b|\bsherry\b|fortified/.test(t)?'fortified':null;
    return {kind,side:/\bglass\b/.test(t)?'glass':/\bbottle\b/.test(t)?'bottle':null}; },
  /* What the guest's request rules out beyond the dish, read from the scenario with the dish's own words taken
     out (so "fresh oysters" isn't a wish for something fresh): a style ("isn't heavy", "crisp", "soft", "dry",
     "sweet") and a price limit ("under $60"). breaksWish says whether a wine on the list fails it, by its card's
     figures and the list's own price; a wine that fails the request is a wrong answer however well it suits the
     dish, which is what makes "a red that isn't heavy, with the duck" a real choice among reds. */
  wishStyle(text,dish){ let t=' '+String(text||'').toLowerCase()+' ';
    if(dish) this._words(dish.name+' '+(dish.desc||'')).forEach(w=>{ t=t.split(w).join(' '); });
    const lim=t.match(/(?:under|below|less than|up to|no more than|at most|(?:spend|pay|go) more than|max(?:imum)?(?: of)?)\s*[£$€]?\s*(\d+)/);
    return {light:/n['’]?t (too )?heavy|not (too )?heavy|\blight(er)?\b|won['’]?t overpower|not overpower|delicate|easy[- ]drinking/.test(t),
      full:/\bfull(-bodied)?\b|\bfuller\b|\bbold\b|\bbig\b|stands? up|\bpowerful\b|\brobust\b|\bricher\b|\brounder\b|(some|real|more|plenty of|with) body\b/.test(t),
      soft:/\bsoft\b|\bsmooth\b|not (too )?tannic|n['’]?t (too )?tannic|gentle tannin|\bsilky\b/.test(t),
      crisp:/\bcrisp\b|\bzesty\b|\brefreshing\b|\bzingy\b/.test(t),
      dry:/\bdry\b|not (too )?sweet|n['’]?t (too )?sweet|nothing (too )?sweet|too sweet/.test(t),
      sweet:/\bsweet\b/.test(t)&&!/not (too )?sweet|n['’]?t (too )?sweet|nothing (too )?sweet|too sweet|sweeter than/.test(t),
      under:lim?Number(lim[1]):null}; },
  overPrice(w,ws,side){ if(!ws||ws.under==null) return false; const price=s=>{ const m=String(s||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; };
    const cost=side==='glass'?price(w.glass):side==='bottle'?price(w.bottle):(price(w.bottle)!=null?price(w.bottle):price(w.glass)); return cost!=null&&cost>ws.under; },
  breaksWish(w,ws,side){ const st=(TeamData.card(w.id)||{}).style||{}, v=k=>typeof st[k]==='number'?st[k]:null;
    const price=s=>{ const m=String(s||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; };
    const cost=side==='glass'?price(w.glass):side==='bottle'?price(w.bottle):(price(w.bottle)!=null?price(w.bottle):price(w.glass));
    return !!((ws.light&&v('body')!=null&&v('body')>=4)||(ws.full&&v('body')!=null&&v('body')<=2)||(ws.soft&&v('tannin')!=null&&v('tannin')>=4)
      ||(ws.crisp&&v('acid')!=null&&v('acid')<=2)||(ws.dry&&v('sweet')!=null&&v('sweet')>=3)||(ws.sweet&&v('sweet')!=null&&v('sweet')<=1)
); },
  // A wrong wine for this table: on the list, of the kind asked for and sold as asked, none of the dish's picks,
  // and either clearly wrong for the dish or failing what the guest asked for (which the right wine meets).
  tableWrong(w,rw,dish,wish,ws){ const pr=TeamData.pairing(dish.id)||{}, picks=new Set([...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id,pr.cocktail&&pr.cocktail.id].filter(Boolean));
    if(!w||w.id===rw.id||picks.has(w.id)||TeamData.isDrink(w)!==TeamData.isDrink(rw)) return false;
    if(wish.kind&&this.kindOf(w)!==wish.kind) return false; if(wish.side==='glass'&&!w.glass) return false; if(wish.side==='bottle'&&!w.bottle) return false;
    // What the guest asked for out loud is never what rules a wrong wine out: one over their price, or of another
    // kind than the one asked for (or than the right wine, when they didn't say), gives the answer away at a glance.
    if(ws&&this.overPrice(w,ws,wish.side)) return false; if(!wish.kind&&this.kindOf(w)!==this.kindOf(rw)) return false;
    return this.clearlyWrong(w.id,dish.id)||(!!ws&&!this.breaksWish(rw,ws,wish.side)&&this.breaksWish(w,ws,wish.side)); },
  tableDecoys(rw,dish,seed,fit=()=>0,wish={},text='',authored=[]){
    const order=wish.kind?[wish.kind]:(this.NEAR[this.kindOf(rw)]||[this.kindOf(rw)]), plaus=w=>order.indexOf(this.kindOf(w)), ws=this.wishStyle(text,dish);
    // The card writer's own wrong wines first (`decoys`), each checked the same way.
    // The writer's wrong wines are trusted for a reason the request reader can't see ("that's the everyday
    // bottle, they want a special one") only within hard limits: on the list, of the kind asked for and sold as
    // asked, none of the dish's picks, and clearly apart from the right wine in style or price.
    const pr=TeamData.pairing(dish.id)||{}, picks=new Set([...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id,pr.cocktail&&pr.cocktail.id].filter(Boolean));
    const num=s=>{ const m=String(s||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; };
    const apart=w=>{ const a=(TeamData.card(w.id)||{}).style||{}, b=(TeamData.card(rw.id)||{}).style||{};
      const gap=Object.keys(a).filter(k=>typeof a[k]==='number'&&typeof b[k]==='number').reduce((n,k)=>n+Math.abs(a[k]-b[k]),0); // a wine's body, acid, tannin, sweet; a cocktail's sweet, sour, bitter, strong
      const pa=num(wish.side==='glass'?w.glass:w.bottle||w.glass), pb=num(wish.side==='glass'?rw.glass:rw.bottle||rw.glass);
      return gap>=2||(pa&&pb&&Math.abs(pa-pb)/Math.min(pa,pb)>=0.25); };
    const kindOk=w=>wish.kind?this.kindOf(w)===wish.kind:this.kindOf(w)===this.kindOf(rw);
    const writerOk=w=>w&&w.id!==rw.id&&!picks.has(w.id)&&TeamData.isDrink(w)===TeamData.isDrink(rw)&&kindOk(w)&&(wish.side!=='glass'||w.glass)&&(wish.side!=='bottle'||w.bottle)&&!this.overPrice(w,ws,wish.side)
      &&!(ws&&this.breaksWish(rw,ws,wish.side))&&(this.tableWrong(w,rw,dish,wish,ws)||apart(w));
    const own=(authored||[]).map(d=>TeamData.wine(d&&d.id)).filter((w,i,a)=>w&&a.indexOf(w)===i&&writerOk(w));
    const rest=this._shuffle(TeamData.wines().filter(w=>plaus(w)>=0&&!own.includes(w)&&this.tableWrong(w,rw,dish,wish,ws)),seed).sort((a,b)=>plaus(a)-plaus(b)||fit(a)-fit(b));
    return [...own,...rest].slice(0,3); },
  _decide(q){ const w=TeamData.wine(q.wine); if(!w) return q;
    const names=[TeamData.short(w),w.name].filter(Boolean).map(n=>this._norm(n)), names_in=s=>names.some(n=>n.length>3&&this._norm(s).includes(n));
    const sents=(String(q.q).match(/[^.?!]+[.?!]*/g)||[q.q]).map(x=>x.trim()).filter(Boolean);
    if(!sents.some(names_in)) return q;
    const others=TeamData.wines().filter(o=>o.id!==w.id).map(o=>this._norm(TeamData.short(o))).filter(n=>n.length>3);
    if((q.key||[]).some(k=>others.some(n=>this._norm(k).includes(n)))) return q;
    const kept=sents.filter(x=>!names_in(x)); if(!kept.length) return q;
    const scen=kept.join(' ').replace(/[,;:\s]+$/,''), d=this.dishIn(scen); if(!d||this.tableFit(w.id,d.id)!=='good'||this.tableDecoys(w,d,q.id,undefined,this.wishIn(scen,w),scen,q.decoys).length<2) return q;
    return {...q,q:`${/[.?!]$/.test(scen)?scen:scen+'.'} What would you suggest, and why?`,decided:true}; },
  /* A server always knows what kind of wine it is (the list says so), so a wrong answer describing another
     kind ("Full-bodied oaky white" for a rosé, "Golden with honey" for a Barolo) gives the answer away.
     Each one is swapped for a description of the same kind with this wine's style turned round
     (kindDecoys). */
  /* The publish check: every question on these wines' cards put through what the drill does with it,
     before anyone is asked it. A question fails when the drill would leave it out or ask it badly:
       giveaway  its answer is in the question, or one telling word picks it (_unspoil, givesAway), or its
                 wrong answers are another kind of wine with nothing of this kind to put in their place
       thin      fewer than three believable wrong answers to choose from
       mismatch  a guest at a dish this wine doesn't suit (tableFit), which the card set as a good match
     [{wine, q, why, note}] with the card's own question as written. TeamData.checkQuestions rewrites them. */
  MIN_WRONG:3,
  audit(ids){ const out=[];
    (ids||TeamData.wines().map(w=>w.id)).forEach(id=>{ const c=TeamData.card(id); (c&&c.qs||[]).forEach(raw=>{ const q={...raw,wine:id};
      const fail=(why,note)=>out.push({wine:id,q:raw,why,note});
      if(this._repeats(id).has(raw.id)) return fail('repeat','it asks what another question on this card already asks (the same answer, or one inside it): ask about something else about this wine');
      const un=this._unspoil(q); if(!un) return fail('giveaway',/\bor\b/i.test(q.q)?'it offers its own answer as one of two choices in the question':'the answer is in the question');
      if(q.k==='recognise'){ const k=this._sameKind(un); if(!k) return fail('giveaway','the wrong answers are another kind of wine'); if(this.givesAway(k)) return fail('giveaway','a word in the question is only in the right answer');
        if(this.lengthCue(k)) return fail('cue','the right answer stands out by its length: make every option about as long'); return; }
      let c2=null; try{ c2=this.choices(un.k==='apply'?this._decide(un):un); }catch(e){}
      const wrong=c2?c2.opts.length-c2.right.length:0;
      if(!c2||wrong<this.MIN_WRONG) return fail('thin','too few believable wrong answers');
      if(c2.via==='pool') return fail('thin','nothing on the list or in the card gives wrong answers of its kind, so they would come from other wines\' questions: ask about something with answers of its own kind (a grape, a place, a flavour, a price)');
      // A guest at a dish this wine doesn't suit is fine when the key already steers them to another wine
      // on the list; it fails only where the card set it as a good match.
      if(q.k==='apply'){ const d=this.dishIn(q.q); if(d&&this.tableFit(id,d.id)!=='good'){ const others=TeamData.wines().filter(w=>w.id!==id).map(w=>this._norm(TeamData.short(w)));
        const steers=(q.key||[]).some(k=>{ const t=this._norm(k); return /\b(steer|instead|rather)\b/.test(t)&&others.some(n=>n.length>3&&t.includes(n)); });
        if(!steers) return fail('mismatch',`the guest's dish, the ${d.name}, doesn't suit this wine`); } }
      // A table question that hands over its wine (or whose request every wine of the kind on the list meets)
      // tests only the reason: it goes back to be set as a real choice.
      if(q.k==='apply'&&!c2.steer&&!(c2.groups&&c2.groups[0].label==='What do you suggest?')) return fail('nochoice','it names its wine, or nothing on the list of the kind asked for is wrong for this guest, so it tests only the reason');
    }); });
    return out; },
  // The right option much longer or much shorter than every wrong one picks itself out.
  /* The review: every question of the restaurant put through what a person sees (the options as dealt, the answer
     screen's extra line), against the faults found by hand in testing, so a new list is checked by the app rather
     than by whoever drills first. Runs in tests on every seed, from `npm run team:audit`, and on the console's Wines
     section. [{q, code, note}], where code is:
       offsubject  a wrong answer about another dish (the lemon tart answered about the venison)
       kind        an answer of another kind (a region among countries, a country among regions)
       request     at the table, a wrong wine ruled out by what the guest said: over their price, or another kind
       echo        the extra line after the answer only says the answer again
       long        the extra line is too long to read and keep (over REVIEW_WORDS words, or a list line over 30)
       dupe        two options that say the same thing
       cue         the right option stands out by its length (four options)
       giveaway    a telling word of the question is in the right option alone (four options)
       repeat      two questions on the same wine, dish or cocktail with the same answer, or one inside the other
       aside       the line after the answer comes round again within one wine's questions
       empty       nothing to show: no options or no right answer
       pool        wrong answers drawn from whatever other wines were asked (the "mixed pool") */
  REVIEW_WORDS:45,
  /* The review as the console's Wines section shows it: worked out once and kept until the restaurant's list, cards or
     training levels change (TeamData.get and team() hand back the same objects until their stored text does), since a
     long list's review takes seconds and the section redraws on every click. */
  _reviewKept:null,
  reviewIfKept(){ const k=this._reviewKept; return k&&k.doc===TeamData.get()&&k.team===this.team()?k.out:null; },
  reviewKept(){ const doc=TeamData.get(), team=this.team(), k=this._reviewKept;
    if(k&&k.doc===doc&&k.team===team) return k.out;
    const out=this.review(); this._reviewKept={doc,team,out}; return out; },
  review(){ const out=[]; let flag=(q,code,note)=>out.push({q,code,note});
    const dishes=TeamData.dishes(), names=dishes.map(d=>d.name), wines=TeamData.wines();
    const countries=new Set([...wines.map(w=>w.country),...this.DECOYS.country].filter(Boolean).map(x=>this._norm(x)));
    const words=t=>String(t||'').split(/\s+/).filter(Boolean).length;
    const qs=[...wines.flatMap(w=>[...this.wineQs(w.id),...this.lightQs(w.id)]),...TeamData.cocktails().flatMap(c=>this.cocktailQs(c.id)),...dishes.flatMap(d=>this.dishQs(d.id))];
    for(const q0 of qs){ const q=this.deal(q0,'review'), c=this.shown(q);
      const opts=c.opts, right=c.right, wrong=opts.filter((o,i)=>!right.includes(i));
      if(!opts.length||!right.length){ flag(q,'empty','No options or no right answer to show.'); continue; }
      if(c.via==='pool') flag(q,'pool','Its wrong answers come from other wines\' questions, not about this one.');
      const n=opts.map(o=>this._norm(o)); if(new Set(n).size<n.length) flag(q,'dupe','Two options say the same thing.');
      if(q.dish&&/#(mod|know)$/.test(q.id)){ const d=TeamData.dish(q.dish); wrong.forEach(o=>{ const other=names.find(x=>x!==d.name&&!d.name.includes(x)&&o.includes(x)); if(other) flag(q,'offsubject',`A wrong answer is about the ${other}: "${o}"`); }); }
      if(q.k==='recall'&&this._topic(q.q,TeamData.isDrink(TeamData.wine(q.wine)))==='wine'){ const names=[...wines.map(w=>TeamData.short(w)),...Object.values(this.OFF_LIST).flat()].map(x=>this._norm(x).replace(/^the /,''));
        wrong.forEach(o=>{ const n=this._norm(o); if(!names.some(x=>n.includes(x))) flag(q,'kind',`Not a wine: "${o}"`); }); }
      if(q.k==='recall'&&!q.dish){ const t=this._topic(q.q,TeamData.isDrink(TeamData.wine(q.wine)));
        const inC=this._countryIn(q.q); if(t==='place'&&inC) wrong.forEach(o=>{ const oc=this._placeCountry(o); if(oc&&oc!==inC) flag(q,'kind',`Not in ${inC}: "${o}"`); });
        if(t==='country') opts.forEach(o=>{ if(!countries.has(this._norm(o))) flag(q,'kind',`Not a country: "${o}"`); });
        if(t==='place') opts.forEach(o=>{ if(countries.has(this._norm(o))) flag(q,'kind',`A country among regions: "${o}"`); }); }
      if(q.k==='apply'&&q.wine&&c&&c.groups&&c.groups[0]&&c.groups[0].label==='What do you suggest?'){ const rw=TeamData.wine(q.wine), dish=this.dishIn(q.q), wish=this.wishIn(q.q,rw), ws=this.wishStyle(q.q,dish);
        const g=c.groups[0]; c.opts.slice(g.from,g.to).forEach((o,i)=>{ if(c.right.includes(g.from+i)) return; const ow=wines.find(w=>{ const nm=TeamData.short(w); return o.startsWith((/^the /i.test(nm)?'':'The ')+nm)||o.startsWith(nm); }); if(!ow) return;
          if(this.overPrice(ow,ws,wish.side)) flag(q,'request',`${TeamData.short(ow)} is over the guest's price`);
          const k=wish.kind||this.kindOf(rw); if(this.kindOf(ow)!==k) flag(q,'request',`${TeamData.short(ow)} isn't the kind asked for`); }); }
      if((q.k==='recognise'||q.mc)&&q.opts&&q.a!=null){ if(this.lengthCue(q)) flag(q,'cue','The right option stands out by its length.'); if(this.givesAway(q)) flag(q,'giveaway','A word of the question is in the right option alone.'); }
      const ans=right.map(i=>opts[i]).join(' ')||q.ans, ax=this.aside(q,ans);
      if(ax&&ax.text){ if(this._overlap(ax.text,ans)>=0.45) flag(q,'echo','The line after the answer says the answer again.'); if(words(ax.text)>this.REVIEW_WORDS) flag(q,'long',`The line after the answer is ${words(ax.text)} words.`); }
      if(ax&&ax.list) ax.list.forEach(x=>{ if(words(x.text)>30) flag(q,'long',`"${x.name}" has ${words(x.text)} words.`); });
    }
    // Repetition across a set, as someone practising one wine (or dish, or cocktail) meets it: two questions with the
    // same answer or one inside another (`repeat`), and the line after the answer coming round again (`aside`).
    // Each wine and cocktail at each training level (Low's own questions and High's are never asked together), each dish as it is.
    const groups=[...wines.flatMap(w=>this.LEVELS.map(lv=>this.levelQs(w.id,lv))),...TeamData.cocktails().flatMap(c=>this.LEVELS.map(lv=>this.levelQs(c.id,lv))),...dishes.map(d=>this.dishQs(d.id))];
    const once=new Set(), flag0=flag; flag=(q,code,note)=>{ const k=q.id+code; if(once.has(k)) return; once.add(k); flag0(q,code,note); };
    groups.forEach(g=>{ const seen=[];
      g.forEach(q=>{ if(q.k==='apply'||q.pills) return; const a=this._ansOf(q), n=this._norm(a), ws=this._words(a).filter(w=>w.length>2); if(!n) return;
        const hit=seen.find(p=>p.n===n||(ws.length>=2&&ws.every(w=>p.ws.includes(w)))||(p.ws.length>=2&&p.ws.every(w=>ws.includes(w))));
        if(hit) flag(q,'repeat',`Asks what "${hit.q.q.slice(0,60)}" already asks (${a}).`); else seen.push({n,ws,q}); });
      const used=new Set(); g.forEach(q=>{ const d=this.deal(q,'review'), c=this.shown(d), o=c.opts, r=c.right;
        const ax=this.aside(d,r.map(i=>o[i]).join(' ')||d.ans,used); if(!ax||!ax.text) return;
        if([...used].some(u=>u===ax.text||this._overlap(u,ax.text)>=0.6)) flag(q,'aside','The line after the answer repeats one shown earlier for the same thing.'); used.add(ax.text); }); });
    return out; },
  // Length only gives an answer away when it's long enough to read as a sentence and clearly apart from every wrong one:
  // "Blanco tequila" beside "Gin" is two names, not a cue.
  lengthCue(q){ if(!q.opts||q.a==null) return false; const L=q.opts.map(o=>String(o).length), r=L[q.a], w=L.filter((_,i)=>i!==q.a);
    const words=String(q.opts[q.a]).split(/\s+/).length, gap=Math.min(...w.map(x=>Math.abs(r-x)));
    return (r>1.6*Math.max(...w)||r<0.6*Math.min(...w))&&(words>=4||gap>=15); },
  /* How each question does in use, from every person's first answer to it (`first`, set in record): right
     first time by nearly everyone, and surely, means a clue in it or nothing worth asking; missed by most
     means a doubtful answer or an unfair question. The console lists both for the manager to look at. */
  HEALTH_MIN:4,
  questionHealth(){ const all=this._all(), by={};
    Object.values(all).forEach(m=>Object.entries((m&&m.items)||{}).forEach(([id,it])=>{ if(!it||!it.first) return; const b=by[id]=by[id]||{n:0,right:0,sure:0}; b.n++; if(it.first.ok){ b.right++; if(it.first.sure==='sure') b.sure++; } }));
    const qs=new Map(); TeamData.wines().forEach(w=>[...this.wineQs(w.id),...this.lightQs(w.id)].forEach(q=>qs.set(q.id,q))); TeamData.cocktails().forEach(c=>this.cocktailQs(c.id).forEach(q=>qs.set(q.id,q))); TeamData.dishes().forEach(d=>this.dishQs(d.id).forEach(q=>qs.set(q.id,q)));
    return Object.entries(by).filter(([id,b])=>b.n>=this.HEALTH_MIN&&qs.has(id)).map(([id,b])=>{ const share=b.right/b.n;
      return {q:qs.get(id),n:b.n,share,flag:share>=0.95&&b.sure/b.n>=0.75?'easy':share<=0.3?'missed':null}; })
      .filter(x=>x.flag).sort((a,b)=>(a.flag===b.flag?0:a.flag==='missed'?-1:1)||b.n-a.n); },
  /* A last check on any four-option question: a telling word of the question that the right option holds
     and no wrong option does ("rosé" in "…Côtes de Provence Rosé?" and only in "Pale, dry rosé…") picks
     the answer without knowing anything. Such a question is left out rather than asked. */
  GIVEAWAY_SKIP:new Set(['wine','wines','which','what','does','best','describes','description','fits','this','that','usually','style','guest','would','your','list','made','from','with','they','colour','smell','smells','taste','tastes','flavour','flavours','describe','would']),
  givesAway(q){ if(!q.opts||q.a==null) return false; const stem=new Set(this._words(q.q).filter(w=>w.length>3&&!this.GIVEAWAY_SKIP.has(w)));
    const ws=o=>new Set(this._words(o)), right=ws(q.opts[q.a]), wrong=q.opts.filter((_,i)=>i!==q.a).map(ws);
    return [...right].some(w=>stem.has(w)&&!wrong.some(x=>x.has(w))); },
  KIND_TAGS:[
    ['red',/\breds?\b(?!\s*(berr|fruit|cherr|currant|apple|onion|pepper|plum|flower|meat|wine vinegar))|\bdeep purple\b|\bruby\b/],
    ['white',/\bwhites?\b(?!\s*(pepper|flower|peach|fruit|truffle|blossom|stone|meat|fish))|\bgolden\b|\bstraw[- ]coloured\b/],
    ['rosé',/\brosés?(?![a-z])|\brose wine\b|\bpink\b|\bsalmon[- ]coloured\b/],
    ['sparkling',/\bsparkling\b|\bfizzy\b|\bfizz\b|\bbubbles\b|\bbubbly\b/],
    ['sweet',/\bdessert wine\b|\bsweet wine\b|\bsyrupy\b|^sweet\b|\bsweet (and|with|fortified)\b|\bluscious\b/],
    ['fortified',/\bfortified\b|\bport\b|\bsherry\b|\bmadeira\b|\braisin/],
  ],
  KIND_FITS:{red:['red'],white:['white'],rosé:['rosé'],orange:['white'],sparkling:['sparkling','white','rosé'],sweet:['sweet','white'],fortified:['fortified','sweet','red']},
  _kindsIn(t){ const x=String(t||'').toLowerCase(); return this.KIND_TAGS.filter(([,re])=>re.test(x)).map(([k])=>k); },
  _sameKind(q){ const w=TeamData.wine(q.wine); if(!w||!q.opts) return q; const kind=this.kindOf(w), fits=this.KIND_FITS[kind]||[kind];
    // Only where the right answer names the kind itself ("Pale, dry rosé…"): that's when a wrong answer of
    // another kind is ruled out by the wine's name alone. A flavour or method question is left as it is.
    if(!this._kindsIn(q.opts[q.a]).length) return q;
    const bad=i=>i!==q.a&&(()=>{ const ks=this._kindsIn(q.opts[i]); return ks.length&&!ks.some(k=>fits.includes(k)); })();
    if(!q.opts.some((_,i)=>bad(i))) return q;
    const st=(TeamData.card(w.id)||{}).style||{}, spare=this.kindDecoys(st,kind).filter(d=>!q.opts.some(o=>this._norm(o)===this._norm(d)));
    const opts=q.opts.map((o,i)=>bad(i)?(spare.shift()||null):o);
    if(opts.some(o=>o==null)) return null;
    return {...q,opts}; },
  /* Descriptions of this kind of wine that this one isn't: its style turned round on body, sweetness,
     acidity and tannin, each with flavours that go with that style. */
  kindDecoys(st,kind){ const v=k=>typeof st[k]==='number'?st[k]:null, noun={red:'red',white:'white',rosé:'rosé',orange:'orange wine',sparkling:'sparkling wine',sweet:'dessert wine',fortified:'fortified wine'}[kind]||'wine';
    const fl={rosé:{rich:'ripe strawberry and spice',sweet:'candied strawberry and cream',soft:'watermelon and peach',light:'redcurrant and grapefruit'},red:{rich:'jammy black fruit and vanilla',sweet:'raisins and chocolate',soft:'ripe plum and soft spice',light:'tart red cherry and cranberry'},
      white:{rich:'ripe tropical fruit and buttery oak',sweet:'honey and apricot',soft:'peach and melon',light:'green apple and lime'},sparkling:{rich:'toasty brioche and baked apple',sweet:'sweet pear and honey',soft:'soft pear and cream',light:'lemon and green apple'},
      sweet:{rich:'raisins and toffee',sweet:'honey and apricot',soft:'peach and melon',light:'lemon and green apple'},fortified:{rich:'raisins and toffee',sweet:'honey and fig',soft:'soft plum',light:'citrus peel and almond'}}[kind]||{rich:'ripe dark fruit',sweet:'honey',soft:'soft fruit',light:'crisp citrus'};
    // Only a trait this wine is clearly at one end of is turned round: a middling one could be either.
    const out=[];
    if(v('body')!=null&&v('body')<=2) out.push(`Deep-coloured, full-bodied ${noun} with ${fl.rich}`);
    if(v('body')!=null&&v('body')>=4) out.push(`Pale, light-bodied ${noun} with ${fl.light}`);
    if(v('sweet')!=null&&v('sweet')<=1) out.push(`Off-dry, soft ${noun} with ${fl.sweet}`);
    if(v('sweet')!=null&&v('sweet')>=4) out.push(`Bone-dry, lean ${kind==='sweet'?'white':noun} with ${fl.light}`);
    if(v('acid')!=null&&v('acid')>=4) out.push(`Round, low-acid ${noun} with ${fl.soft}`);
    if(v('acid')!=null&&v('acid')<=2) out.push(`Sharp, high-acid ${noun} with ${fl.light}`);
    if(kind==='red'&&v('tannin')!=null&&v('tannin')>=4) out.push(`Silky, barely tannic red with ${fl.light}`);
    if(kind==='red'&&v('tannin')!=null&&v('tannin')<=1) out.push(`Firmly tannic, powerful red with ${fl.rich}`);
    if(kind!=='sparkling'&&kind!=='fortified') out.push(`Sparkling ${noun} with fine bubbles, ${fl.light}`);
    return out; },
  /* A question mustn't hold its own answer: "Which grape is the Louis Jadot Bourgogne Pinot Noir made from?".
     When the answer is in the wine's name, the name is said without those words ("the Louis Jadot Bourgogne
     Couvent des Jacobins"); when it's still in the question after that, the question is left out. */
  _words(s){ return this._norm(s).split(' ').filter(w=>w.length>2&&!['the','and','wine','with','from'].includes(w)); },
  _unspoil(q){
    const w=TeamData.wine(q.wine); if(!w) return q;
    // A comparison's answer is checked whole and without the wines' own names: "Which is lighter: the Jadot or
    // the Malbec?" answered "The Jadot" is a fair question, while an answer whose substance is in the question isn't.
    // Only when the question names a second wine: a "comparison" that names one ("Which fruit gives The Pear Se
    // its flavour?") is checked like any question, its own name included.
    const others=TeamData.wines().filter(x=>x.id!==q.wine&&this._norm(q.q).includes(this._norm(TeamData.short(x))));
    const nameWords=q.k==='contrast'&&others.length?new Set(TeamData.wines().flatMap(x=>this._words(TeamData.short(x)+' '+(x.name||'')))):null;
    const plain=a=>nameWords?this._words(a).filter(x=>!nameWords.has(x)).join(' '):a;
    const answers=q.k==='recognise'?[q.opts[q.a]]:q.k==='recall'?String(q.ans||'').split(/,|\band\b|;/).map(x=>x.trim()).filter(Boolean):q.k==='contrast'&&q.ans?(nameWords?[plain(q.ans)]:String(q.ans).split(/,|\band\b|;/).map(x=>x.trim())).filter(Boolean):[];
    // An answer with a figure in it ("£9 a glass, £45 a bottle") is given away only if its figures are too.
    const nums=x=>String(x||'').match(/\d+(?:\.\d+)?/g)||[];
    const gives=text=>{ const t=new Set(this._words(text)), tn=new Set(nums(text)); return answers.some(a=>{ const ws=this._words(a); return ws.length&&ws.every(x=>t.has(x))&&nums(a).every(n=>tn.has(n)); }); };
    if(!answers.length||!gives(q.q)) return q;
    const drop=new Set(answers.flatMap(a=>this._words(a)));
    const esc=x=>String(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    let text=q.q;
    for(const nm of [`${TeamData.short(w)}${w.vintage?' '+w.vintage:''}`,TeamData.short(w),w.name].filter(Boolean)){
      const masked=nm.split(/\s+/).filter(x=>!drop.has(this._norm(x))).join(' ');
      text=text.replace(new RegExp(esc(nm),'gi'),masked); }
    // A name masked down to one word ("The Pear Se" to "The Se") reads as nonsense: the question is left out.
    const masked=[TeamData.short(w),w.name].filter(Boolean).map(nm=>nm.split(/\s+/).filter(x=>!drop.has(this._norm(x))&&!/^the$/i.test(x)));
    if(text!==q.q&&masked.some(ws=>ws.length&&ws.every(x=>this._norm(x).length<=3))) return null;
    return gives(text)?null:{...q,q:text};
  },
  /* A cocktail's questions (prompts/team-cocktail-cards.txt): every one four options with one right, the
     wrong ones from this bar's own other cocktails, so they're asked as written (mc), shuffled by their id. */
  cocktailQs(id,{all=false}={}){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    if(!m.has(id)){ const c=TeamData.cocktailCard(id);
      const cq=(c&&c.qs||[]).filter(q=>q&&q.q&&Array.isArray(q.opts)&&q.opts.length===4&&q.opts[q.a]!=null), rp=this._repeatsIn(cq,id);
      m.set(id,cq.filter(q=>!rp.has(q.id)).map(q=>({...q,cocktail:id,mc:true}))
        .filter(q=>!this.givesAway(q)&&!this.lengthCue(q)).map(q=>{ const order=this._shuffle(q.opts.map((_,i)=>i),q.id); return {...q,opts:order.map(i=>this._cap(q.opts[i])),a:order.indexOf(q.a)}; })); }
    return this._keep(m.get(id).map(q=>({...q})),all); },
  /* A dish's ladder (docs/business.md, "The menu"): know it (what it is, from the dish notes), its allergens (a
     choose-all against the venue's list, only once the kitchen has confirmed them; asked with confidence, a miss back
     within the shift), a change a guest asks for (what do you say), then its pairings (which wine, name a wine).
     Pills on the allergen and change questions are built here (q.pills), so choices() hands them straight back. */
  // Kept per restaurant document, as wineQs is: the dashboard asks for every dish's questions once per person.
  dishQs(id,{allergen=true,all=false}={}){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    const k=`dish:${id}:${allergen?1:0}`; if(!m.has(k)) m.set(k,this._dishQs(id,{allergen}));
    return this._keep(m.get(k),all); },
  _dishQs(id,{allergen=true}={}){
    const x=TeamData.dish(id); if(!x) return [];
    const out=[], c=TeamData.dishCard(id), dishes=TeamData.dishes();
    // Know it: the dish's own sentence against three near-misses of the same dish (a wrong sauce, cut or richness,
    // written with the notes). Never another dish's description: the dish is named in the question, so that taught nothing.
    if(c&&c.say&&(c.wrong||[]).length>=3){ const opts=[c.say,...c.wrong.slice(0,3)], order=this._shuffle([0,1,2,3],id+'k');
      out.push({id:'d:'+id+'#know',dish:id,k:'recognise',q:`A guest asks what the ${x.name} is.`,opts:order.map(i=>opts[i]),a:order.indexOf(0),why:x.desc?`The menu says: ${x.desc}.`:''}); }
    const conf=TeamData.allergensOf(id);
    if(allergen&&conf){ const list=TeamData.allergenList(), names=conf.map(code=>TeamData.allergenName(code));
      const opts=[...list.map(a=>a.name),'None of these'], right=conf.length?conf.map(code=>list.findIndex(a=>a.code===code)).filter(i=>i>=0):[opts.length-1];
      out.push({id:'d:'+id+'#allergen',dish:id,k:'recall',allergen:true,conf:true,q:`Which of these are in the ${x.name}? Choose all that apply.`,ans:names.join(', ')||'None of these',
        pills:{opts,right,n:right.length,groups:[{label:'Allergens in it',from:0,to:opts.length,n:right.length,all:true}]},
        why:conf.length?`${names.join(', ')}. A guest with ${conf.length===1?'that':'one of those'} allerg${conf.length===1?'y':'ies'} needs to know before they order${c&&c.allergens&&c.allergens.note?`. ${c.allergens.note}`:'.'}`:'None of the listed allergens, as the kitchen confirmed it.'}); }
    if(c&&(c.mods||[]).length){ const m=c.mods.find(z=>z.can!=='ask')||c.mods[0];
      // Every wrong answer is about this dish and this change: the two stances the kitchen didn't take, and
      // guessing on the kitchen's behalf (never right). Never another dish's change, which the name gives away.
      const ask=m.ask, stance={yes:`Of course, the kitchen can do the ${x.name} ${ask}.`,no:`I'm afraid the kitchen can't do the ${x.name} ${ask}.`,
        ask:`Let me check with the kitchen whether they can do it ${ask}, and I'll come straight back to you.`};
      const wrongs=[...Object.keys(stance).filter(k=>k!==(m.can||'ask')).map(k=>stance[k]),`It should be fine; I'll put it through ${ask} and let the kitchen sort it out.`];
      const all=[{x:m.say,ok:true},...wrongs.map(t=>({x:t,ok:false}))], order=this._shuffle(all.map((_,i)=>i),id+'c'), opts=order.map(i=>this._cap(all[i].x));
      out.push({id:'d:'+id+'#mod',dish:id,k:'apply',q:`A guest asks for the ${x.name} ${m.ask}. What do you say?`,key:[m.say],ans:m.say,
        pills:{opts,right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:1,groups:[{label:'What do you say?',from:0,to:opts.length,n:1}]},why:m.can==='no'?'It can\'t change, so say so plainly and offer something that works; never guess for the kitchen.':m.can==='yes'?'The kitchen can do it; say so and say what changes.':'Only the kitchen knows: say you\'ll ask, and come back with the answer.'}); }
    const p=TeamData.pairing(id); if(!p||!p.best||!p.best.length) return out;
    const best=TeamData.wine(p.best[0].id); if(!best) return out;
    const drink=TeamData.isDrink(best), picks=new Set([...p.best.map(b=>b.id),p.glass&&p.glass.id,p.cocktail&&p.cocktail.id].filter(Boolean));
    const clear=TeamData.wines().filter(w=>!picks.has(w.id)&&TeamData.isDrink(w)===drink&&this.clearlyWrong(w.id,id));
    const bl=TeamData.short(best).length, near=(a,b)=>Math.abs(TeamData.short(a).length-bl)-Math.abs(TeamData.short(b).length-bl); // names near the right one's length
    const pick=[...(p.avoid&&TeamData.wine(p.avoid.id)&&!picks.has(p.avoid.id)?[TeamData.wine(p.avoid.id)]:[]),...this._shuffle(clear.filter(w=>w.type===best.type),id).sort(near),...this._shuffle(clear,id+'x').sort(near)]
      .filter((w,i,a)=>a.indexOf(w)===i).slice(0,3);
    if(pick.length<3) return out;
    const opts=[best,...pick].map(w=>TeamData.short(w)), order=this._shuffle([0,1,2,3],id);
    out.push(
      {id:'d:'+id+'#0',dish:id,k:'recognise',q:`A guest orders the ${x.name}. Which wine on our list suits it best?`,opts:order.map(i=>opts[i]),a:order.indexOf(0),why:p.best[0].why},
      // Name a wine for it asks for the glass pick: "which wine suits it best" already asks for the first one, and asking
      // for it twice is a repeat (without a separate glass pick it isn't asked). Any of the dish's picks is accepted.
      ...((()=>{ const gw=p.glass&&TeamData.wine(p.glass.id); if(!gw||gw.id===best.id) return [];
        return [{id:'d:'+id+'#1',dish:id,k:'recall',q:`Name a wine by the glass for a guest having the ${x.name}.`,ans:TeamData.short(gw),acc:[gw,...p.best.map(b=>TeamData.wine(b.id))].filter(w=>w&&w.glass).flatMap(w=>[TeamData.short(w),w.name]),why:p.glass.why}]; })()),
    );
    return out;
  },
  allergenQ(id){ return this.dishQs(id).find(q=>q.allergen)||null; },
  knowsAllergens(pid,id,items){ const q=this.allergenQ(id); return !!q&&this.known(items[q.id]); },
  // The same order every time for a question, so a re-draw doesn't reshuffle what they've seen.
  /* A shuffle seeded by a string: an FNV-1a hash of the seed into mulberry32, then Fisher-Yates. The old
     linear generator took its low bits for the position, and those repeat in a short cycle, so the right
     answer kept landing in the same place (most often last). */
  _shuffle(arr,seed){ let h=2166136261>>>0; for(const c of String(seed)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; }
    const rnd=()=>{ h=(h+0x6D2B79F5)>>>0; let t=h; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; };
    const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; },
  /* Each time a question is shown it's dealt afresh: its options in a new order (and, for pills, a new
     draw of wrong ones), fixed for that showing so the screen and the marking agree. Progress is keyed to
     the question's id, never the deal. */
  _seed(q){ return q.id+(q.deal?':'+q.deal:''); },
  deal(q,nonce){ const d={...q,deal:String(nonce)}; if((q.k!=='recognise'&&!q.mc)||!q.opts) return d;
    const order=this._shuffle(q.opts.map((_,i)=>i),this._seed(d)); return {...d,opts:order.map(i=>q.opts[i]),a:order.indexOf(q.a)}; },
  /* Putting a set of questions together (Vinny's test, the drill): never the same right answer twice, and
     no two in a row on the same wine or dish, of the same shape (its "what would you say", its dish, a grape
     question, a table) or with the same answer. Candidates arrive in priority order; the first `size` with
     different answers are kept, then dealt so each one differs from the one before. */
  answerKey(q){ if(q.opts&&q.a!=null) return 'o:'+this._norm(q.opts[q.a]); if(q.k==='apply'){ const d=this.dishIn(q.q); return d?'dish:'+d.id:'q:'+q.id; } return 'a:'+this._norm(q.ans||q.id); },
  // The shape is what a question asks about: a grape, a place, a flavour, a dish, a table; recognise and recall
  // of one topic count as the same shape, since "Which grape…" twice in a row reads as a repeat either way.
  shapeKey(q){ if(q.light) return q.id.split('#')[1]; if(q.dish) return 'dish'; if(q.k==='apply'||q.k==='contrast') return q.k;
    const t=this._topic(q.q,TeamData.isDrink(TeamData.wine(q.wine))); return t?'t-'+t:/describ|style|tastes? like|best fits/i.test(q.q)?'t-style':q.k; },
  answerText(q){ return q.opts&&q.a!=null?q.opts[q.a]:q.ans||''; },
  subjectKey(q){ return q.dish?'d:'+q.dish:'w:'+q.wine; },
  spread(cands,size){
    const keep=[], seen=new Set();
    // Two answers that say nearly the same thing ("Tar and rose petal aromas…" for a Barolo and a Barbaresco) count as one.
    const alike=q=>{ const t=this.answerText(q); return t.split(/\s+/).length>=4&&keep.some(k=>this._overlap(this.answerText(k),t)>=0.6); };
    for(const q of cands){ if(keep.length>=size) break; const a=this.answerKey(q); if(seen.has(a)||alike(q)) continue; seen.add(a); keep.push(q); }
    for(const q of cands){ if(keep.length>=size) break; if(!keep.includes(q)) keep.push(q); } // a short list repeats an answer rather than ask fewer
    const out=[], pool=[...keep], differs=(q,p,all)=>!p||(this.subjectKey(q)!==this.subjectKey(p)&&(!all||(this.shapeKey(q)!==this.shapeKey(p)&&this.answerKey(q)!==this.answerKey(p))));
    while(pool.length){ const prev=out[out.length-1]; let i=pool.findIndex(q=>differs(q,prev,true)); if(i<0) i=pool.findIndex(q=>differs(q,prev,false)); if(i<0) i=0; out.push(pool.splice(i,1)[0]); }
    return out; },
  allQs(){ return [...TeamData.wines().flatMap(w=>this.wineQs(w.id)),...TeamData.cocktails().flatMap(c=>this.cocktailQs(c.id)),...TeamData.dishes().flatMap(x=>this.dishQs(x.id))]; },

  /* How likely they are to remember a question now: 1 just after a right answer, RETAIN at its due date. */
  recall(it,now=Date.now()){ if(!it||!it.reps||!it.s) return 0; const days=(now-it.last)/this.DAY; return Math.exp(Math.log(this.RETAIN)*days/it.s); },
  known(it,now=Date.now()){ return !!(it&&it.reps&&!it.wrong&&now<it.due); },

  /* Which wines and dishes a role sells: a bartender the by-the-glass list, everyone else all of it. */
  scope(role){
    const need=this.need(role), ws=TeamData.wines();
    return {glass:need.glass>0?ws.filter(w=>TeamData.byGlass(w)):[],bottle:need.bottle>0?ws.filter(w=>!TeamData.byGlass(w)):[],dishes:need.dishes>0?TeamData.dishes():[],cocktails:need.cocktails>0?TeamData.cocktails():[],allergens:need.allergens>0?TeamData.dishes().filter(x=>TeamData.allergensOf(x.id)!=null):[]};
  },
  // A rung opens once every question on the rung below has been answered right at least once.
  _open(qs,items,kind,kinds){
    const idx=this.LADDER.indexOf(kind); if(!kinds.includes(kind)) return false;
    for(let r=0;r<idx;r++){ const k=this.LADDER[r]; if(!kinds.includes(k)) continue; const below=qs.filter(q=>q.k===k); if(below.some(q=>!(items[q.id]&&items[q.id].reps))) return false; }
    return true;
  },
  knowsWine(pid,role,id,items){ const qs=this.qsFor(role,id); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },
  knowsDish(pid,id,items){ const qs=this.dishQs(id,{allergen:false}); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },
  /* How much of a wine (the role's questions) or a dish they hold today: {known, total, rungs:[{k,label,done}]}.
     The drill's summary shows it per wine, and readiness counts it as partial credit. */
  progress(pid,id,{dish=false}={}){
    const person=this.person(pid); if(!person) return {known:0,total:0,rungs:[]};
    const items=this._mine(this._all(),pid).items;
    if(dish){ const qs=this.dishQs(id,{allergen:false}); return {known:qs.filter(q=>this.known(items[q.id])).length,total:qs.length,rungs:[]}; }
    const kinds=this.kindsFor(person.role,id), qs=this.qsFor(person.role,id);
    const rungs=this.LADDER.filter(k=>kinds.includes(k)&&qs.some(q=>q.k===k)).map(k=>{ const rq=qs.filter(q=>q.k===k); return {k,label:this.KIND_LABEL[k],done:rq.length>0&&rq.every(q=>this.known(items[q.id]))}; });
    return {known:qs.filter(q=>this.known(items[q.id])).length,total:qs.length,rungs};
  },
  KIND_LABEL:{recognise:'Recognise',recall:'Recall',apply:'At the table',contrast:'Tell them apart'},
  /* Where a person stands with one wine, for its card: the rungs, the next one to climb, how many answers are
     fading or missed, and a word for it (new | learning | fading | known). */
  standing(pid,id){
    const person=this.person(pid); if(!person) return null;
    const pr=this.progress(pid,id), items=this._mine(this._all(),pid).items, now=Date.now();
    const qs=this.qsFor(person.role,id);
    const seen=qs.filter(q=>items[q.id]&&items[q.id].reps).length, due=qs.filter(q=>{ const it=items[q.id]; return it&&it.reps&&(it.wrong||it.due<=now); }).length;
    const next=pr.rungs.find(r=>!r.done)||null, nextDue=qs.map(q=>items[q.id]).filter(it=>it&&it.reps&&!it.wrong&&it.due>now).reduce((a,it)=>Math.min(a,it.due),Infinity);
    const state=!seen?'new':pr.total&&pr.known===pr.total?'known':due?'fading':'learning';
    return {...pr,seen,due,next,nextDue:isFinite(nextDue)?nextDue:null,state,role:person.role};
  },

  /* The wines to look at before service (the Tonight card): by-the-glass wines this person is slipping on (answers due or
     missed), the most due first, then the glass wines they haven't started that sell most. [{wine, why}] up to n. */
  slippingOn(pid,n=2){ const person=this.person(pid); if(!person) return []; const sc=this.scope(person.role), out=[];
    sc.glass.map(w=>({w,st:this.standing(pid,w.id)})).filter(x=>x.st&&x.st.state==='fading').sort((a,b)=>b.st.due-a.st.due).slice(0,n).forEach(x=>out.push({wine:x.w,why:`${x.st.due} answer${x.st.due===1?'':'s'} fading`}));
    if(out.length<n){ let pri=[]; try{ pri=TeamSales.has()?TeamReport.priority(28,8).map(x=>x.wine.id):[]; }catch(e){}
      const fresh=sc.glass.filter(w=>!out.some(o=>o.wine.id===w.id)).map(w=>({w,st:this.standing(pid,w.id)})).filter(x=>x.st&&x.st.state==='new').sort((a,b)=>(pri.indexOf(a.w.id)<0?99:pri.indexOf(a.w.id))-(pri.indexOf(b.w.id)<0?99:pri.indexOf(b.w.id)));
      fresh.slice(0,n-out.length).forEach(x=>out.push({wine:x.w,why:pri.includes(x.w.id)?'a top seller you haven\'t started':'not started yet'})); }
    return out; },
  /* {pct, parts:{glass:{known,total,need,share}}, state:'ready'|'slipping'|'not', overdue, due} */
  readiness(pid){
    const person=this.person(pid); if(!person) return null;
    const role=person.role, need=this.need(role), sc=this.scope(role), mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const parts={};
    ['glass','bottle','dishes','cocktails','allergens'].forEach(k=>{
      if(!need[k]) return;
      if(k==='cocktails'&&!sc.cocktails.length) return; // no cocktail list, no cocktail part
      if(k==='allergens'&&!(sc.allergens||[]).length) return; // nothing confirmed by the kitchen yet, no allergen part
      const list=sc[k], known=list.filter(x=>k==='dishes'?this.knowsDish(pid,x.id,items):k==='allergens'?this.knowsAllergens(pid,x.id,items):this.knowsWine(pid,role,x.id,items)).length;
      // partial: every answer they hold counts, so the figure moves with each drill; a wine is known (for the minimum) only whole.
      const partial=k==='allergens'?known:list.reduce((a,x)=>{ const pr=this.progress(pid,x.id,{dish:k==='dishes'}); return a+(pr.total?pr.known/pr.total:0); },0);
      parts[k]={known,total:list.length,need:need[k],share:list.length?known/list.length:1,partial:list.length?partial/list.length:1};
    });
    const ks=Object.keys(parts), met=ks.every(k=>parts[k].share>=parts[k].need-1e-9);
    const pct=ks.length?Math.round(100*ks.reduce((a,k)=>a+Math.min(1,parts[k].partial/parts[k].need),0)/ks.length):0;
    const overdue=Object.values(mine.assigned||{}).filter(a=>!a.done&&a.due<now).length;
    const due=Object.values(items).filter(it=>it.reps&&it.due<=now).length;
    const behind=Object.values(mine.assigned||{}).filter(a=>!a.done&&a.due<now).reduce((a,x)=>Math.max(a,Math.floor((now-x.due)/this.DAY)),0);
    return {pct,parts,state:met?'ready':mine.wasReady?'slipping':'not',overdue,behind,due,role};
  },
  /* Remembers that they've been ready, so dropping below the minimum later reads as Slipping. */
  note(pid){ const r=this.readiness(pid); if(!r) return r; const p=this._all(), m=this._mine(p,pid);
    if(r.state==='ready'&&!m.wasReady){ m.wasReady=Date.now(); this._saveAll(p); } return this.readiness(pid); },

  /* Today's drill for a person, five questions dealt in this order (docs/business.md, "The drill"):
       1. answers that are due, the least remembered first (a missed one before a faded one), one question per wine,
          dish or cocktail, so a bad day on one bottle doesn't fill the drill;
       2. things new to them (assigned and not started), at most NEW_MAX once anything is due (a day off never
          becomes a forty-question Monday: what doesn't fit rolls forward without being late), in the order the till
          says they matter (TeamReport.priority: what sells most that they don't know), then assignment date, then
          the list's own order, taking one per list section, so a first week isn't five sparkling wines;
       3. now and then an unannounced re-ask of something they know (CHECK_SHARE, a retention check);
       4. if there's still room, the next rungs on things they've started, nearest due first.
     `part` ('glass' | 'bottle' | 'dishes' | 'cocktails') drills one part of the role's minimum alone, from Today's rows. */
  NEW_MAX:2,
  // Candidates come in that order, twice as many as asked for; spread keeps the first with different answers and deals them so no two in a row match.
  drill(pid,size=this.DRILL_SIZE,part=null){ return this.spread(this._drillPool(pid,size*2,part),size); },
  _drillPool(pid,size,part){
    const person=this.person(pid); if(!person) return [];
    const role=person.role, kinds=this.ROLES[role].kinds, mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const sc0=this.scope(role), sc=part?{glass:part==='glass'?sc0.glass:[],bottle:part==='bottle'?sc0.bottle:[],dishes:part==='dishes'||part==='allergens'?sc0.dishes:[],cocktails:part==='cocktails'?sc0.cocktails:[]}:sc0, wines=[...sc.glass,...sc.bottle], dishes=sc.dishes, cocktails=sc.cocktails||[];
    // A part's practice is its questions alone: allergens drills the allergen question of every confirmed dish, dishes everything else.
    const dqs=x=>part==='allergens'?this.dishQs(x.id).filter(q=>q.allergen):part==='dishes'?this.dishQs(x.id,{allergen:false}):this.dishQs(x.id);
    const inPart=key=>{ if(!part) return true; const t=key[0]; if(part==='allergens') return t==='a'; if(t==='a') return false; return t==='w'?wines.some(w=>w.id===key.slice(2)):t==='c'?cocktails.some(c=>c.id===key.slice(2)):dishes.some(x=>x.id===key.slice(2)); };
    // A wine's or a cocktail's questions at the rungs this role needs for it.
    const qsFor=w=>this.qsFor(role,w.id), out=[], used=new Set();
    const itemOf=q=>q.wine||q.cocktail||q.dish, has=id=>out.some(q=>q.id===id);
    // A surprise re-check doesn't take the item's one place: the next rung on that wine can still be dealt beside it.
    const push=(q,{check=false}={})=>{ if(!q||out.length>=size||has(q.id)||(!check&&used.has(itemOf(q)))) return false; out.push(q); if(!check) used.add(itemOf(q)); return true; };
    const nextFor=(qs)=>{ // the lowest open rung's first question not yet answered right (a dish has no ladder: its first unanswered)
      if(qs.length&&qs[0].dish) return qs.find(q=>!(items[q.id]&&items[q.id].reps))||null;
      const kk=qs.length&&qs[0].cocktail?this.kindsFor(role,qs[0].cocktail):kinds;
      for(const k of this.LADDER){ if(!this._open(qs,items,k,kk)) continue; const q=qs.find(q=>q.k===k&&!(items[q.id]&&items[q.id].reps)); if(q) return q; }
      return null;
    };
    const pool=[...wines.flatMap(qsFor),...cocktails.flatMap(qsFor),...dishes.flatMap(dqs)];
    const byId=Object.fromEntries(pool.map(q=>[q.id,q]));
    // 1. Due, least remembered first, one per item.
    const due=Object.entries(items).filter(([id,it])=>byId[id]&&it.reps&&(it.wrong||it.due<=now)).sort((a,b)=>this.recall(a[1],now)-this.recall(b[1],now));
    due.forEach(([id])=>push(byId[id]));
    // 2. New: assigned and not started, capped once anything is due, in the till's order, one per section.
    const assigned=Object.entries(mine.assigned||{}).filter(([k,a])=>!a.done&&inPart(k));
    const qsOfKey=k=>{ const [t,id]=[k.slice(0,1),k.slice(2)]; return t==='a'?this.dishQs(id).filter(q=>q.allergen):t==='d'?this.dishQs(id,{allergen:false}):qsFor({id}); };
    const started=k=>qsOfKey(k).some(q=>items[q.id]&&items[q.id].reps);
    let rank={}; try{ if(typeof TeamReport!=='undefined'&&typeof TeamSales!=='undefined'&&TeamSales.has()) TeamReport.priority(28,12).forEach((x,i)=>{ rank['w:'+x.wine.id]=i; }); }catch(e){}
    const fresh=assigned.filter(([k])=>!started(k)).sort((a,b)=>((rank[a[0]]??99)-(rank[b[0]]??99))||(a[1].at-b[1].at)||(a[1].due-b[1].due));
    const newCap=due.length?this.NEW_MAX:size, sections=new Set(); let added=0;
    const sectionOf=k=>{ const [t,id]=[k.slice(0,1),k.slice(2)]; const x=t==='w'?TeamData.wine(id):t==='c'?TeamData.cocktail(id):TeamData.dish(id); return t==='a'?'allergens':(x&&x.section)||t; };
    for(const pass of [0,1]){ // first one per section, then whatever's left
      for(const [k] of fresh){ if(added>=newCap||out.length>=size) break; const sec=sectionOf(k); if(pass===0&&sections.has(sec)) continue;
        const q=nextFor(qsOfKey(k)); if(push(q)){ added++; sections.add(sec); } } }
    // 3. A surprise re-check of something known.
    if(out.length<size){
      const knownIds=Object.entries(items).filter(([id,it])=>byId[id]&&this.known(it,now)).map(([id])=>id);
      if(knownIds.length&&Math.random()<this.CHECK_SHARE*size){ const id=knownIds[Math.floor(Math.random()*knownIds.length)]; push({...byId[id],check:true},{check:true}); }
    }
    // 4. The next rung on things already started (assigned or not), nearest due first; then anything not started.
    const things=[...wines.map(w=>({id:w.id,qs:qsFor(w)})),...cocktails.map(c=>({id:c.id,qs:qsFor(c)})),...dishes.map(x=>({id:x.id,qs:dqs(x)}))];
    const soon=t=>Math.min(...t.qs.map(q=>items[q.id]&&items[q.id].reps?items[q.id].due:Infinity));
    const begun=things.filter(t=>isFinite(soon(t))).sort((a,b)=>soon(a)-soon(b)), notYet=things.filter(t=>!isFinite(soon(t)));
    for(const t of [...begun,...notYet]){ if(out.length>=size) break; push(nextFor(t.qs)); }
    return out.slice(0,size);
  },

  /* The drill's summary in words (TeamDrill): what they now know from the answers they got right, as a sentence
     ("You know the Lambrusco's grape and the Veuve Brut's price now"), and when the first of them comes back. The
     mechanism (every answer has its own review date) stays behind a tap; the words are the result. */
  _what(q){ const nm=q.wine?TeamData.nick(TeamData.wine(q.wine)||{}):q.cocktail?(TeamData.cocktail(q.cocktail)||{}).name:q.dish?(TeamData.dish(q.dish)||{}).name:'it';
    if(q.allergen) return `the ${nm}'s allergens`;
    if(q.dish&&/#mod$/.test(q.id)) return `what to say when the ${nm} has to change`;
    if(q.dish&&/#know$/.test(q.id)) return `what the ${nm} is`;
    if(q.dish) return `what to pour with the ${nm}`;
    if(q.k==='recognise') return `what the ${nm} is like`;
    if(q.k==='apply') return `what to say about the ${nm} at the table`;
    if(q.k==='contrast') return `the ${nm} from its neighbour`;
    if(q.k==='recall'||q.mc){ if(/[£$€]/.test(String(q.ans||''))) return `the ${nm}'s price`; const t=this._topic(q.q);
      return t==='grape'?`the ${nm}'s grape`:t==='place'||t==='country'?`where the ${nm} is from`:t==='flavour'?`how the ${nm} tastes`:t==='duration'||t==='change'?`how the ${nm} ages`:t==='method'||t==='stopper'?`how the ${nm} is made`:`the ${nm}`; }
    return `the ${nm}`; },
  knownLine(right){ const ws=[...new Set(right.map(q=>this._what(q)))]; if(!ws.length) return '';
    const head=ws.slice(0,3), rest=ws.length-head.length;
    const join=head.length===1?head[0]:head.slice(0,-1).join(', ')+' and '+head[head.length-1];
    return `You know ${join} now${rest?`, and ${rest} more`:''}.`; },
  comesBack(pid,right,now=Date.now()){ const items=this._mine(this._all(),pid).items;
    const dues=right.map(q=>items[q.id]&&items[q.id].due).filter(d=>d&&d>now).sort((a,b)=>a-b); if(!dues.length) return '';
    const first=dues[0], days=Math.round((first-now)/this.DAY), same=dues.filter(d=>Math.round((d-now)/this.DAY)===days).length;
    const when=days<=0?'later today':days===1?'tomorrow':days<7?`on ${new Date(first).toLocaleDateString(undefined,{weekday:'long'})}`:`in ${days} days`;
    return `${same===1?'One of these comes':same===right.length?'They come':`${['','One','Two','Three','Four','Five'][same]||same} of these come`} back ${when}.`; },

  /* Marks a typed answer: locally when it plainly matches the answer or a wording that counts,
     else by Claude against the key (prompts/team-grade.txt). {ok, score, verdict, say, missing}. */
  // Remembered: the review and the table questions clean the same wine names and reasons many thousands of times on a
  // long list (The Princess Royal's 132 wines took 10 seconds here when the console's Wines section opened).
  _normMemo:new Map(),
  _norm(s){ const k=String(s||''), m=this._normMemo; let v=m.get(k); if(v!==undefined) return v;
    v=k.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
    if(m.size>50000) m.clear(); m.set(k,v); return v; },
  _lev(a,b){ const m=a.length,n=b.length, d=Array.from({length:m+1},(_,i)=>[i]); for(let j=1;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; },
  localMatch(q,answer){
    const a=this._norm(answer); if(!a) return false;
    return [q.ans,...(q.acc||[])].filter(Boolean).map(x=>this._norm(x)).some(k=>k===a||(k.length>3&&(a.includes(k)||(a.length>3&&k.includes(a)&&a.length>=k.length*0.6)))||(k.length>4&&this._lev(k,a)<=Math.floor(k.length/6)+1));
  },
  /* Typed answers were hard on a phone, so every recall, apply and contrast question is answered by
     picking from CHOICES (10) pills, several right (the three grapes, the three things to say) and the
     rest wrong but believable, drawn from the same kind of answer on the other wines of this list.
     {opts, right: indices, n}. Fixed per question (seeded by its id). */
  CHOICES:10, WRONG_MAX:4, // pills on a recall question: the right ones plus at most WRONG_MAX wrong (five for one answer; ten was eight 13px pills to read for one grape)
  /* The pills a question offers, never the same thing twice: a spelling with and without its accent ("Bründlmayer",
     "Brundlmayer") is one pill, the first kept (a right one before a wrong one); groups and the right indexes follow. */
  /* What the drill puts on screen for a dealt question: a four-option one as it is, anything else through choices().
     The review and the sommelier review read questions through this, so they see what a person sees. */
  shown(q){ if(q.k==='recognise'||q.mc) return {opts:q.opts||[],right:q.a!=null?[q.a]:[],n:1};
    let c=null; try{ c=this.choices(q); }catch(e){} return c&&c.opts&&c.opts.length?c:{opts:[],right:[],n:0}; },
  choices(q){ const c=this._choices(q); if(!c||!c.opts) return c;
    const key=o=>this._norm(o).replace(/^the /,''), keep=[], seen=new Map();
    c.opts.forEach((o,i)=>{ const k=key(o); if(!seen.has(k)){ seen.set(k,keep.length); keep.push(i); } else if(c.right.includes(i)&&!c.right.includes(keep[seen.get(k)])) keep[seen.get(k)]=i; });
    if(keep.length===c.opts.length) return c;
    const map=new Map(keep.map((oi,ni)=>[oi,ni])), at=i=>{ let n=0; for(const oi of keep) if(oi<i) n++; return n; };
    return {...c,opts:keep.map(i=>c.opts[i]),right:c.right.filter(i=>map.has(i)).map(i=>map.get(i)),n:Math.min(c.n||1,c.right.filter(i=>map.has(i)).length),
      groups:c.groups&&c.groups.map(g=>({...g,from:at(g.from),to:at(g.to)}))}; },
  _choices(q){
    if(q.pills) return q.pills;
    if(q.k==='apply'){ const g=this._applyChoices(q); if(g) return g; }
    if(q.k==='contrast'){ const g=this._contrastChoices(q); if(g) return g; }
    const norm=x=>String(x).toLowerCase().replace(/[^a-z0-9£$€%]+/g,' ').trim();
    // A list answer ("Chardonnay, Pinot Noir and Pinot Meunier") becomes one pill per item; a sentence with a comma stays one pill.
    const split=a=>{ const ps=String(a||'').split(/,|\band\b|;/).map(x=>x.trim()).filter(Boolean); return ps.length>=2&&ps.every(x=>x.split(/\s+/).length<=3)?ps:[String(a||'').trim()].filter(Boolean); };
    let right;
    if(q.k==='apply') right=[...(q.key||[])];
    else if(q.k==='contrast') right=[q.ans,...(q.acc||[])].filter(Boolean);
    else { right=split(q.ans); }
    right=right.filter((x,i,a)=>a.findIndex(y=>norm(y)===norm(x))===i).slice(0,3);
    const seen=new Set(right.map(norm)), pool=[], wines=TeamData.wines();
    const add=x=>{ const n=norm(x); if(!n||seen.has(n)) return; seen.add(n); pool.push(String(x).trim()); };
    // Wrong answers of the same kind as the right ones: a grape for a grape, a place for a place, a price
    // for a price, a figure for a figure; then the other wines' answers to this kind of question.
    const grapes=new Set(wines.flatMap(w=>w.grapes||[]).map(norm)), places=new Set(wines.flatMap(w=>[w.region,w.country]).filter(Boolean).map(norm));
    const cls=x=>grapes.has(norm(x))?'grape':places.has(norm(x))?'place':/[£$€]/.test(x)?'money':/\d/.test(x)?'figure':'text';
    const want=cls(right[0]||'');
    // A recall question's wrong answers are the same kind of answer as its right one: flavours for a
    // flavour question, climates for a climate one. Taken from the other wines' questions of that kind and a
    // short checked list per kind (DECOYS), never from whatever the other wines happened to be asked.
    if(q.k==='recall'&&want!=='money'){ const t=this._topic(q.q,TeamData.isDrink(TeamData.wine(q.wine))); if(t){ const r=this._topicChoices(q,t,right,split); if(r) return r; } }
    // Anything else draws wrong answers only from questions asked the same way (the same first words), never
    // from whatever the other wines happened to be asked.
    const stem=x=>this._words(x).slice(0,3).join(' ');
    // A price is asked one way: every pill in the same form ("£14 a glass"), the wrong ones the list's own
    // prices of that kind, the nearest first, so a glass question never offers a bottle price or a bare figure.
    if(want==='money'&&q.k==='recall'){ const m=this._moneyChoices(q,right); if(m) return m; }
    if(want==='grape') wines.flatMap(w=>w.grapes||[]).forEach(add);
    if(want==='place') wines.flatMap(w=>[w.region,w.country]).filter(Boolean).forEach(add);
    const alike=[...pool];
    for(const w of wines){ if(w.id===q.wine) continue; for(const o of this.wineQs(w.id)){ if(o.k!==q.k) continue; if(q.k==='recall'&&stem(o.q)!==stem(q.q)) continue;
      if(o.k==='apply') (o.key||[]).forEach(add); else if(o.k==='contrast') [o.ans,...(o.acc||[])].forEach(add); else split(o.ans).forEach(add); } }
    const same=pool.filter(x=>!alike.includes(x)&&cls(x)===want), rest=pool.filter(x=>!alike.includes(x)&&!same.includes(x));
    const wrong=[...this._shuffle(alike,this._seed(q)+'a'),...this._shuffle(same,this._seed(q)+'b'),...(q.k==='recall'?[]:this._shuffle(rest,this._seed(q)+'d'))].slice(0,Math.max(0,Math.min(this.WRONG_MAX,this.CHOICES-right.length)));
    const all=[...right.map(x=>({x,ok:true})),...wrong.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
    const opts=order.map(i=>this._cap(all[i].x)), rightIdx=order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0);
    return {opts,right:rightIdx,n:rightIdx.length,via:'pool'};
  },
  /* What a recall question asks about, read from its words; null when it isn't one of these. */
  _topic(text,drink=false){ const t=String(text).toLowerCase();
    // A cocktail is asked about its own things: the base spirit, what's in it, who created it, its flavours.
    if(drink){
      if(/\bcreated\b|\binvented\b|\bbartender\b|who (made|created|came up)/.test(t)) return 'creator';
      if(/\bspirit\b|\bbase\b|which (gin|rum|tequila|vodka|whisk)/.test(t)) return 'spirit';
      if(/garnish/.test(t)) return 'garnish';
      if(/\bshaken\b|\bstirred\b|\bmethod\b/.test(t)) return 'cmethod';
      if(/served in|which glass\b|glassware/.test(t)) return 'glassware';
      if(/liqueur|bitter|amaro|vermouth|ingredient|goes into|made with|what's in|what is in|syrup|juice|purée|cordial|tincture|foam/.test(t)) return 'ingredient';
      if(/flavou?r|aroma|\btaste|\bnotes?\b/.test(t)) return 'flavour';
      return null; }
    if(/\bname a wine\b|\bwhich (famous |other )?wines?\b(?! (region|country|area|valley|county|grape|style|term|word))|\bwhat wine\b(?! (region|country|area|valley|county|grape|style|term|word))|\bwine (from|on) (our|the) list\b/.test(t)) return 'wine';
    if(/\b(which|what) country\b|\bcountry (is|does)\b/.test(t)&&!/\bregion\b|\barea\b/.test(t)) return 'country'; // before 'valley': "Which country is the Similkameen Valley Syrah from?"
    if(/\bword for\b/.test(t)) return 'word';
    if(/vintage year|which year|what year/.test(t)) return 'year';
    if(/what stops/.test(t)) return 'stopper';
    if(/\bvalley\b/.test(t)) return 'place';
    if(/\bmean\b|in plain words|what is botrytis/.test(t)) return 'term';
    if(/\bbank\b/.test(t)) return 'bank';
    if(/flavou?r|aroma|\btaste|\badd\b|\bnotes?\b/.test(t)) return 'flavour';
    if(/\briver\b|\bwinds?\b|\binfluence\b|\bcools?\b|moderates|what gives/.test(t)) return 'influence';
    if(/climate/.test(t)) return 'climate';
    if(/\bferment|keep the sweetness|stays sweet|\bstop/.test(t)) return 'method';
    if(/\bgrapes?\b/.test(t)) return 'grape';
    if(/\bcountry\b|which nation/.test(t)&&!/\bregion\b|\barea\b|\bvalley\b/.test(t)) return 'country'; // countries against countries, never a region among them
    if(/\bregion\b|\bcountry\b|\bvalley\b|\barea\b|\bcounty\b|\bwhere\b/.test(t)) return 'place';
    if(/what happens/.test(t)) return 'change';
    if(/\bage\b|\bages\b|\baged\b|\bageing\b|\byoung\b|\bkept\b|how long|\bminimum\b|\btime\b/.test(t)) return 'duration';
    return null; },
  // Only lists of names are split into one pill each ("Chardonnay, Pinot Noir and Pinot Meunier"); a
  // climate, a meaning or a change is one answer, commas and all.
  SPLIT_TOPICS:['grape','flavour','ingredient'],
  COUNTRY_WORDS:{English:'England',British:'England',Italian:'Italy',French:'France',Spanish:'Spain',Portuguese:'Portugal',German:'Germany',Austrian:'Austria',American:'United States',Canadian:'Canada',Argentine:'Argentina',Argentinian:'Argentina',Chilean:'Chile',Australian:'Australia','New Zealand':'New Zealand','South African':'South Africa',Hungarian:'Hungary',Greek:'Greece'},
  // The country a question names ("Which Italian region…", "…region of Italy"), else null.
  // "Name the Argentine region…" where the list and the guide know too few other Argentine regions for fair wrong answers:
  // the question loses the country word ("Name the region…"), so its wrong regions can come from anywhere.
  _plainPlace(q){ if(q.k!=='recall'||this._topic(q.q)!=='place') return q; const c=this._countryIn(q.q); if(!c) return q;
    const ans=this._norm(q.ans||''), others=new Set(this._regionsOf(c).map(x=>this._norm(x)).filter(x=>x&&!ans.includes(x)&&!x.includes(ans)));
    if(others.size>=3) return q;
    const word=Object.keys(this.COUNTRY_WORDS).find(w=>this.COUNTRY_WORDS[w]===c&&new RegExp(`\\b${w}\\b`).test(q.q));
    const text=word?q.q.replace(new RegExp(`\\b${word} `),''):q.q.replace(new RegExp(`\\s*(wine )?region of ${c}\\b`),' wine region').replace(/\s+/g,' ');
    return {...q,q:text}; },
  _countryIn(text){ const t=String(text||''); for(const [w,c] of Object.entries(this.COUNTRY_WORDS)) if(new RegExp(`\\b${w}\\b`).test(t)) return c;
    const m=t.match(/\bregion of ([A-Z][a-z]+(?: [A-Z][a-z]+)?)/); return m&&Object.values(this.COUNTRY_WORDS).includes(m[1])?m[1]:null; },
  // Which country a place is in: the list's own wines first, then the regions guide (its names and aliases).
  _placeCountry(x){ const n=this._norm(x).replace(/^the /,''); const w=TeamData.wines().find(w=>w.region&&this._norm(w.region).replace(/^the /,'')===n); if(w&&w.country) return w.country;
    const K=(typeof KNOWLEDGE!=='undefined'&&KNOWLEDGE&&KNOWLEDGE.regions)||{};
    for(const [name,r] of Object.entries(K)) if(this._norm(name)===n||(r.aliases||[]).some(a=>this._norm(a)===n)) return r.country||null;
    return null; },
  _regionsOf(country){ const K=(typeof KNOWLEDGE!=='undefined'&&KNOWLEDGE&&KNOWLEDGE.regions)||{};
    return [...TeamData.wines().filter(w=>w.country===country&&w.region).map(w=>w.region),...Object.entries(K).filter(([,r])=>r.country===country).map(([n])=>n)]; },
  DECOYS:{
    country:['France','Italy','Spain','Portugal','Germany','Austria','United States','Canada','Argentina','Chile','Australia','New Zealand','South Africa'],
    flavour:['Blackcurrant','Cedar','Lemon','Green apple','Peach','Black pepper','Plum','Honey','Toast','Gooseberry','Leather','Vanilla','Violet','Grapefruit','Dried fig','Liquorice','Mint','Smoke','Pineapple','Chocolate'],
    climate:['Hot, dry Mediterranean','Cool continental','Cool maritime','Warm continental','High-altitude desert','Mild Atlantic','Tropical and humid'],
    influence:['The Atlantic','The Mediterranean Sea','The Gironde estuary','The Pacific','The Andes','Altitude in the hills','Fog from the coast'],
    term:['Wine from a single vineyard','Wine aged in new oak barrels','Sweet wine made from frozen grapes','Wine made only from red grapes','Wine aged on its lees for extra texture','Wine from a single year'],
    word:['Ripasso','Riserva','Classico','Superiore','Frizzante'],
    stopper:['Adding sugar','Chilling the tank','Adding sulphur','Filtering out the yeast','Grain spirit'],
    method:['Sugar is added before bottling','The grapes are frozen on the vine','The grapes are dried before pressing','Fermentation runs until the wine is dry','The wine is aged in new oak'],
    duration:['Drunk young','A decade or more','Two to three years','Twenty years or more','Within a year of the vintage','Five to eight years'],
    change:['It softens','It gets more tannic','It turns sweeter','It loses its fruit within a year','It turns savoury and gamey','It gets darker in colour'],
    bank:['The Right Bank','Entre-Deux-Mers','The Graves'],
    // The grapes sparkling wines are made from, for a sparkling wine's grape question.
    sparklingGrape:['Chardonnay','Pinot Noir','Pinot Meunier','Pinot Blanc','Chenin Blanc','Glera','Xarel·lo','Macabeo','Parellada','Arbane','Petit Meslier'],
    // Cocktails: checked general answers of each kind, after the list's own.
    spirit:['Gin','Vodka','White rum','Aged rum','Blanco tequila','Mezcal','Bourbon','Rye whiskey','Scotch whisky','Cognac','Pisco'],
    ingredient:['Campari','Aperol','Sweet vermouth','Dry vermouth','Cointreau','Elderflower liqueur','Simple syrup','Fresh lime juice','Fresh lemon juice','Egg white','Angostura bitters','Soda water','Prosecco','Ginger beer','Agave syrup','Grenadine','Coffee liqueur','Maraschino liqueur'],
    garnish:['A lemon twist','An orange peel','A lime wedge','A maraschino cherry','A sprig of rosemary','A dried orange wheel','Three coffee beans','A salted rim','Fresh mint','A cucumber ribbon'],
    glassware:['A coupe','A rocks glass','A highball','A Nick & Nora','A wine glass','A martini glass','A copper mug','A flute'],
    cmethod:['Shaken','Stirred','Built in the glass','Blended'],
  },
  // Word sets with a plural or "-s" verb ending dropped, so "It softens" and "They soften" are one answer.
  _stems(s){ return this._words(s).filter(w=>!['it','they','its','their'].includes(w)).map(w=>w.length>4?w.replace(/(es|s)$/,''):w); },
  _topicChoices(q,topic,right,split){
    const sp=this.SPLIT_TOPICS.includes(topic)?split:(a=>[String(a||'').trim()].filter(Boolean));
    right=sp(q.ans).slice(0,3);
    // A country question whose written answer carries its region too ("Okanagan Valley, Canada") is answered with the
    // country alone, so it stands among countries.
    if(topic==='country'){ const cs=[...new Set([...TeamData.wines().map(w=>w.country),...this.DECOYS.country].filter(Boolean))].sort((x,y)=>y.length-x.length);
      const hit=cs.find(c=>this._norm(q.ans).includes(this._norm(c))); if(hit) right=[hit]; }
    const norm=x=>this._norm(x).replace(/^the /,''), seen=new Set(right.map(norm)), wines=TeamData.wines(), pool=[];
    const rightWords=new Set(right.flatMap(r=>this._words(r)));
    // A wrong pill that says the same as a right one in fewer or other words ("Grape spirit" beside
    // "Fermentation is stopped with grape spirit") isn't wrong: it's left out.
    const nums=x=>(String(x).match(/\d+/g)||[]).join(' ');
    const same=x=>{ const a=this._stems(x); return a.length&&right.some(r=>{ if(nums(r)!==nums(x)) return false; const b=new Set(this._stems(r)); return a.every(w=>b.has(w))||[...b].every(w=>a.includes(w)); }); };
    const add=x=>{ const n=norm(x); if(!n||seen.has(n)||same(x)) return; seen.add(n); pool.push(String(x).trim()); };
    // The other wines' answers to questions of this kind come first: the list's own flavours, climates, places.
    // A cocktail's wrong answers come from the other cocktails, a wine's from the other wines.
    const own=TeamData.wine(q.wine), drink=TeamData.isDrink(own);
    // Nothing that's in this drink is offered as a wrong answer about it, even when the question asks for one part.
    if(drink&&topic==='ingredient') (own.spec||[]).forEach(x=>seen.add(norm(x)));
    // (A wine for a dish draws only wines, below: other questions' "which wines" answers are as often places.)
    if(topic!=='wine') for(const w of wines){ if(w.id===q.wine||TeamData.isDrink(w)!==drink) continue; for(const o of this.wineQs(w.id)) if(o.k==='recall'&&this._topic(o.q,drink)===topic) sp(o.ans).forEach(add); }
    if(drink&&topic==='ingredient') wines.filter(w=>TeamData.isDrink(w)&&w.id!==q.wine).flatMap(w=>w.spec||[]).forEach(add);
    if(drink&&topic==='spirit') wines.filter(w=>TeamData.isDrink(w)&&w.id!==q.wine).map(w=>w.spirit).filter(Boolean).forEach(add);
    if(drink&&topic==='creator') wines.filter(w=>w.credit&&w.id!==q.wine).map(w=>w.credit).forEach(add);
    // A wine for a dish: the other wines on the list, the one to steer away from first, then the nearest
    // styles; never one of the dish's own pairings, which would be right too.
    if(topic==='wine'){
      const p=q.dish?TeamData.pairing(q.dish):null, ok=new Set([...(p&&p.best||[]).map(b=>b.id),p&&p.glass&&p.glass.id,p&&p.cocktail&&p.cocktail.id].filter(Boolean));
      const rw=wines.find(w=>right.some(r=>norm(r)===norm(TeamData.short(w)))), near=['sparkling','white','rosé','orange','red','sweet','fortified'];
      const dist=w=>rw?Math.abs(near.indexOf(w.type)-near.indexOf(rw.type)):0;
      const avoid=p&&p.avoid&&TeamData.wine(p.avoid.id); if(avoid&&!ok.has(avoid.id)) add(TeamData.short(avoid));
      // Only wines this dish plainly doesn't suit (tableFit), so a wine that would also work never sits among the
      // wrong answers; a short list is made up from well-known bottles that aren't on it.
      const drinkQ=rw?TeamData.isDrink(rw):false;
      this._shuffle(wines.filter(w=>!ok.has(w.id)&&w.id!==q.wine&&TeamData.isDrink(w)===drinkQ&&(!q.dish||this.clearlyWrong(w.id,q.dish))),this._seed(q)+'n').sort((a,b)=>dist(a)-dist(b)).forEach(w=>add(TeamData.short(w)));
      if(pool.length<4) this.offList(rw?this.kindOf(rw):'red',4-pool.length,this._seed(q)+'f').forEach(add);
      const keep=pool.slice(0,this.WRONG_MAX), all=[...right.map(x=>({x,ok:true})),...keep.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
      return {opts:order.map(i=>this._cap(all[i].x)),right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:right.length};
    }
    if(topic==='year'){ const y=this._num(right[0]); if(y) [y-1,y+1,y-2,y+2,y-3,y+3].forEach(v=>add(String(v))); }
    if(topic==='duration'&&/month/i.test(right[0])) ['6 months','12 months','18 months','24 months','36 months'].forEach(add);
    if(topic==='place') wines.map(w=>w.region).filter(Boolean).forEach(add); // regions against regions; a country question has its own kind
    // "Which Italian region…": the wrong regions are Italian too (the list's, then the guide's), never Rhône or Okanagan.
    const inC=topic==='place'&&this._countryIn(q.q); if(inC) this._regionsOf(inC).forEach(add);
    if(topic==='grape') wines.flatMap(w=>w.grapes||[]).forEach(add);
    if(topic==='country') wines.filter(w=>w.id!==q.wine).map(w=>w.country).filter(Boolean).forEach(add);
    (this.DECOYS[topic]||[]).forEach(add);
    if(topic==='grape'){ const known=new Set([...wines.flatMap(w=>w.grapes||[]),...(typeof GRAPE_ALLOWLIST!=='undefined'?GRAPE_ALLOWLIST:[])].map(norm)); const g=pool.map(x=>String(x).replace(/^(usually|mostly|mainly)\s+/i,'')).filter(x=>known.has(norm(x))); pool.length=0; pool.push(...[...new Set(g)]); }
    // Grapes a server could believe for this wine (the sommelier review held a Champagne asked against Montepulciano and
    // Tempranillo): for a sparkling wine, the grapes sparkling wines are made from; otherwise grapes of the same skin
    // colour as the right ones (red against red, white against white), as the list's own wines and the grape guide say.
    if(topic==='grape'&&!drink&&own){
      const skin={}, mark=(g,c)=>{ const n=norm(g); if(!skin[n]) skin[n]=c; };
      wines.forEach(w=>(w.grapes||[]).forEach(g=>{ if(w.type==='red') mark(g,'red'); else if(w.type==='white') mark(g,'white'); }));
      const skinOf=g=>skin[norm(g)]||(typeof grapeSkin==='function'&&typeof GRAPE_TYPES!=='undefined'&&GRAPE_TYPES[g]?(grapeSkin(g)==='red'?'red':'white'):null);
      let fit=null;
      if(own.type==='sparkling'){ const sp=new Set([...this.DECOYS.sparklingGrape,...wines.filter(w=>w.type==='sparkling').flatMap(w=>w.grapes||[])].map(norm)); this.DECOYS.sparklingGrape.forEach(add); fit=x=>sp.has(norm(x)); }
      else { const want=new Set(right.map(skinOf).filter(Boolean)); if(want.size===1){ const c=[...want][0]; fit=x=>skinOf(x)===c; } }
      if(fit){ const f=pool.filter(fit); if(f.length>=3){ pool.length=0; pool.push(...f); } }
    }
    // Like for like within a kind: a months answer against months, a valley against valleys.
    if(/month/i.test(right[0])){ const m=pool.filter(x=>/month/i.test(x)); pool.length=0; pool.push(...m); }
    // A place inside a place ("Lalande-de-Pomerol, Bordeaux") isn't offered against a whole region ("The Loire Valley"),
    // or the other way round: a question asking for a region gets regions, one asking for a commune gets communes.
    if(topic==='place'){ const inner=x=>/,/.test(String(x)), r0=inner(right[0]), f=pool.filter(x=>inner(x)===r0); if(f.length>=3){ pool.length=0; pool.push(...f); } }
    if(inC){ const keep=pool.filter(x=>this._placeCountry(x)===inC); pool.length=0; pool.push(...keep); }
    else if(topic==='place'&&/valley/i.test(right[0])){ ['The Rhône Valley','The Douro Valley','The Napa Valley','The Mosel Valley','The Barossa Valley'].forEach(add); const v=pool.filter(x=>/valley/i.test(x)); pool.length=0; pool.push(...v); }
    // A flavour pill that shares a word with a right one ("Black cherry" beside "Red cherry") would be unfair either way.
    const wrong=this._shuffle(pool.filter(x=>topic!=='flavour'||!this._words(x).some(w=>rightWords.has(w))),this._seed(q)+'t');
    if(wrong.length<3) return null;
    const total=Math.min(this.CHOICES,right.length+Math.max(3,Math.min(this.WRONG_MAX,wrong.length)));
    const all=[...right.map(x=>({x,ok:true})),...wrong.slice(0,total-right.length).map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
    return {opts:order.map(i=>this._cap(all[i].x)),right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:right.length};
  },
  /* Telling two wines apart: the right answers are the card's; the wrong ones are about the same two
     wines, built from the list itself with one thing turned round (their places, grapes, prices, which
     is poured by the glass, which is older), so every option is about the question and only the facts
     decide it. Null when the question doesn't name a second wine on the list. */
  _contrastChoices(q){
    const norm=x=>this._norm(x), A=TeamData.wine(q.wine); if(!A) return null;
    // The second wine is the one the question names as the list does (producer and name), never a bare
    // grape ("Riesling" is Trimbach's name too).
    // Its list name with or without a quoted or bracketed part ("Faustino Rioja Crianza" for 'Faustino Rioja Crianza "Art Collection"').
    const callsB=w=>[TeamData.short(w),w.name,TeamData.short(w).replace(/\s*["“(][^"”)]*["”)]\s*/g,' ')].filter(Boolean).map(x=>norm(x)).filter(x=>x.split(' ').length>=2);
    // By its full list name first: a bare name ("Brut Rosé") sits inside other wines' names ("Coates & Seely Brut Rosé"),
    // and once picked Charles Heidsieck's for a question about Gusbourne and Coates & Seely. A bare name counts only where
    // it isn't part of this wine's own name or another wine's full name in the question.
    const text=norm(q.q), others=TeamData.wines().filter(w=>w.id!==A.id);
    const byShort=others.filter(w=>text.includes(norm(TeamData.short(w)))).sort((x,y)=>TeamData.short(y).length-TeamData.short(x).length)[0];
    const fulls=[A,...others].filter(w=>text.includes(norm(TeamData.short(w)))).map(w=>norm(TeamData.short(w)));
    const B=byShort||others.filter(w=>callsB(w).some(x=>{ if(!text.includes(x)) return false; return !fulls.some(f=>f.includes(x)&&f!==x); })).sort((x,y)=>TeamData.short(y).length-TeamData.short(x).length)[0];
    if(!B) return null;
    // One right answer: the card's own. Its other wordings (acc) are for marking a typed answer; as pills they were the
    // same fact three times over ("choose 3"), with the wrong ones the same swap three times.
    const forms0=[...new Set([q.ans,...(q.acc||[])].filter(Boolean).map(x=>String(x).trim()))].slice(0,3), right=forms0.slice(0,1);
    const said=' '+norm(forms0.join(' '))+' ', GENERIC=new Set(['chateau','domaine','domaines','bodegas','tenuta','weingut','maison','cave','the','les','des','del','della','de','du','la','le','classico','reserva','riserva','premier','cru','grand','late','harvest','old','year','brut','reserve','nv']);
    // Every way the card calls each wine ("Cloudy Bay", "Louis Jadot", "Jadot"): runs of words from its name that
    // appear in the answers, longest first, leaving out words both names share ("Pinot Noir") or that say nothing alone.
    const words=w=>TeamData.short(w).split(/\s+/);
    const shared=new Set(words(A).map(norm).filter(x=>words(B).map(norm).includes(x)));
    // A grape or place inside a name ("Santa Barbara County", "Riesling") is about the grape or place in an
    // answer, so it is never swapped as if it were the wine.
    const facts=w=>new Set([...(w.grapes||[]),w.region,w.country].filter(Boolean).flatMap(x=>norm(x).split(' ')));
    const forms=w=>{ const ws=words(w), fx=facts(w), out=[]; for(let i=0;i<ws.length;i++) for(let j=ws.length;j>i;j--){ const run=ws.slice(i,j), n=norm(run.join(' '));
      if(run.every(x=>GENERIC.has(norm(x))||shared.has(norm(x)))||run.some(x=>fx.has(norm(x)))||n.length<3) continue; if(said.includes(' '+n+' ')) out.push(run.join(' ')); }
      return [...new Set(out)].sort((x,y)=>y.length-x.length); };
    const fa=forms(A), fb=forms(B);
    // Unnamed in the answers: the producer's surname ("Fèvre", "Jadot").
    const nick=(w,f)=>f[0]||String(w.producer||'').split(/\s+/).filter(x=>!GENERIC.has(norm(x))).pop()||words(w).find(x=>!GENERIC.has(norm(x))&&!shared.has(norm(x)))||TeamData.short(w);
    const a=nick(A,fa), b=nick(B,fb), sym=TeamData.currency().sym||'£', price=w=>this._num(w.bottle)||this._num(w.glass);
    const place=w=>[w.region,w.country].filter(Boolean)[0]||'', grapes=w=>(w.grapes||[]).join(' and ');
    const wrong=[];
    if(place(A)&&place(B)&&norm(place(A))!==norm(place(B))) wrong.push(`${a} is from ${place(B)}; ${b} is from ${place(A)}`,`They're both from ${place(A)}`);
    if(grapes(A)&&grapes(B)&&norm(grapes(A))!==norm(grapes(B))) wrong.push(`${a} is ${grapes(B)}; ${b} is ${grapes(A)}`,`They're made from the same grapes`);
    if(price(A)&&price(B)&&price(A)!==price(B)){ const hi=price(A)>price(B)?a:b, lo=hi===a?b:a, gap=Math.abs(price(A)-price(B));
      wrong.push(price(A)>price(B)?`${a} is the cheaper of the two`:`${a} costs more than ${b}`,`${lo} costs ${sym}${gap} more than ${hi}`,`They cost the same`); }
    if(!!A.glass!==!!B.glass) wrong.push(A.glass?`${a} is bottle only; ${b} is poured by the glass`:`${a} is poured by the glass; ${b} is bottle only`);
    else wrong.push(A.glass?`Only ${b} is poured by the glass`:`Both are poured by the glass`);
    const ya=this._num(A.vintage), yb=this._num(B.vintage);
    if(ya&&yb&&ya!==yb) wrong.push(ya<yb?`${a} is the younger vintage`:`${a} is the older vintage`);
    if(A.type!==B.type) wrong.push(`They're both ${A.type} wines`);
    // Style, from each card's own figures (1 to 5), said the wrong way round.
    const sa=(TeamData.card(A.id)||{}).style||{}, sb=(TeamData.card(B.id)||{}).style||{};
    const AX={body:['fuller-bodied','lighter-bodied'],tannin:['more tannic, with more grip','softer, with less tannin'],acid:['fresher, with more acidity','softer, with less acidity'],sweet:['sweeter','drier']};
    Object.entries(AX).forEach(([k,[more,less]])=>{ const x=sa[k], y=sb[k]; if(x!=null&&y!=null&&Math.abs(x-y)>=1) wrong.push(x>y?`${a} is ${less} than ${b}`:`${a} is ${more} than ${b}`); });
    // The best wrong answer is a right one with the two wines swapped ("Barbaresco needs 38 months; Barolo
    // needs 26"): the same point, the same words, turned the wrong way round.
    const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), alts=[...fa.map(f=>[f,b]),...fb.map(f=>[f,a])].sort((x,y)=>y[0].length-x[0].length);
    const swap=t=>{ if(!alts.length) return t; const re=new RegExp(`(?<![\\p{L}])(${alts.map(x=>esc(x[0])).join('|')})(?![\\p{L}])`,'gu'); return t.replace(re,m=>(alts.find(x=>x[0]===m)||[0,m])[1]); };
    const swapped=forms0.map(swap).filter(t=>!forms0.some(r=>norm(r)===norm(t)));
    // Only decoys about what the question asks: its grapes, its place, its price, how it's sold, its age.
    const ASPECT={style:/style|taste|flavour|body|bodied|rich|lighter|tannin|acid|sweet|dry/,grape:/grape|blend|variet/,place:/origin|where|place|region|country|come from|comes from/,price:/price|cost|cheap|dear|expensive|spend/,sold:/sold|glass|bottle|bought|pour/,age:/vintage|older|younger|age/};
    const want=Object.keys(ASPECT).filter(k=>ASPECT[k].test(norm(q.q)));
    const aspectOf=t=>{ const n=norm(t); return /bodied|tannic|tannin|acidity|sweeter|drier/.test(n)?'style':/grape/.test(n)?'grape':/ from |both from/.test(' '+n)?'place':/cheaper|costs more/.test(n)?'price':/glass|bottle only/.test(n)?'sold':/vintage/.test(n)?'age':'type'; };
    // A question about something the list can't speak to (style, legal ageing) gets its swaps alone.
    const onTopic=want.length?wrong.filter(t=>want.includes(aspectOf(t))):(swapped.length>=2?[]:wrong);
    // Nor two wrong answers that say the same thing: one whose words all sit inside another's is the same claim.
    // (Against the other wrong answers only: a swap has the right answer's words by design.)
    const kept=[], st=t=>this._stems(t).filter(w=>w.length>2), inside=(x,y)=>{ const b=new Set(st(y)); const a=st(x); return a.length&&a.every(w=>b.has(w)); };
    const seen=new Set(right.map(norm)), take=x=>{ const n=norm(x); if(seen.has(n)) return false;
      if(kept.some(k=>inside(x,k)||inside(k,x))) return false; seen.add(n); kept.push(x); return true; };
    // A question about one thing (price, how it's sold) is never made up with answers about another (grapes): the
    // sommelier review held those as off the subject. Only a question about nothing the list can speak to borrows them.
    let wr=[...swapped,...onTopic,...(!want.length&&onTopic.length+swapped.length<2?wrong:[])].filter(take);
    if(wr.length<2&&!want.length) wr=[...wr,...wrong.filter(take)]; // short of distinct claims: the list's facts turned round make up the rest
    if(wr.length<2) return null;
    const keep=[...wr.slice(0,swapped.length),...this._shuffle(wr.slice(swapped.length),this._seed(q)+'x')].slice(0,Math.max(3,6-right.length));
    const all=[...right.map(x=>({x,ok:true})),...keep.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
    return {opts:order.map(i=>this._cap(all[i].x)),right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:right.length};
  },
  /* When the list itself is too short to make a question hard, well-known wines that aren't on it make up
     the numbers: knowing which bottles are yours is part of the job. */
  OFF_LIST:{
    red:['Marqués de Riscal Reserva','Guigal Côtes du Rhône','Penfolds Bin 28 Shiraz','Antinori Peppoli Chianti Classico','Louis Latour Beaujolais-Villages','Concha y Toro Casillero del Diablo Cabernet Sauvignon'],
    white:['Hugel Gentil','Villa Maria Sauvignon Blanc','Louis Jadot Mâcon-Villages','Pieropan Soave Classico','Dr. Loosen Riesling','Domaine Huet Vouvray Le Haut-Lieu'],
    rosé:['Whispering Angel','Miraval Rosé','Mateus Rosé','Domaine Tempier Bandol Rosé'],
    sparkling:['Moët & Chandon Brut Impérial','Veuve Clicquot Yellow Label','Bollinger Special Cuvée','Ridgeview Bloomsbury','Freixenet Cordon Negro Cava'],
    sweet:['Royal Tokaji 5 Puttonyos','Inniskillin Vidal Icewine','Château Rieussec Sauternes','Dr. Loosen Beerenauslese'],
    fortified:["Graham's Six Grapes","Dow's 20 Year Old Tawny","Tio Pepe Fino","Blandy's 10 Year Old Malmsey Madeira"],
    orange:['Gravner Ribolla Gialla','Radikon Oslavje'],
  },
  offList(type,n,seed){ const pool=this.OFF_LIST[type]||this.OFF_LIST.red, mine=new Set(TeamData.wines().map(w=>this._norm(TeamData.short(w))));
    return this._shuffle(pool.filter(x=>!mine.has(this._norm(x))),seed).slice(0,n); },
  _cap(x){ const t=String(x||'').trim(); return t.charAt(0).toUpperCase()+t.slice(1); },
  _num(s){ const m=String(s||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; },
  _moneyChoices(q,right){
    const sym=TeamData.currency().sym||'£', drink=TeamData.isDrink(TeamData.wine(q.wine)), wines=TeamData.wines().filter(w=>TeamData.isDrink(w)===drink);
    const side=drink?'glass':/\bglass\b/i.test(q.q)?'glass':/\bbottle\b/i.test(q.q)?'bottle':/glass/i.test(right[0])?'glass':'bottle';
    // A cocktail's price is just its price ("$22"), against the other cocktails' prices.
    const fmt=n=>drink?TeamData.money(n,{dp:n%1?2:0}):`${TeamData.money(n,{dp:n%1?2:0})} a ${side}`, n=this._num(right[0]); if(n==null) return null;
    // A glass question about a wine sold only by the bottle has that as its answer, said in words.
    const own=TeamData.wine(q.wine), bottleOnly=side==='glass'&&own&&!own.glass&&/bottle|not by the glass/i.test(right[0]);
    const rightText=bottleOnly?`Not by the glass: ${TeamData.money(n,{dp:n%1?2:0})} a bottle`:fmt(n);
    const prices=[...new Set(wines.map(w=>this._num(side==='glass'?w.glass:w.bottle)).filter(x=>x!=null&&x!==n))]
      .sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,this.WRONG_MAX);
    if(prices.length<3) return null;
    const all=[{x:rightText,ok:true},...this._shuffle(prices,this._seed(q)+'m').map(p=>({x:fmt(p),ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
    return {opts:order.map(i=>all[i].x),right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:1};
  },
  /* At the table: two short lists instead of one mixed one. First the wine to suggest (one of four wines of
     the same kind, each with its price said the same way), then why it works (the card's reasons and ones
     from other wines' tables, said as things to tell the guest). A point that's only a price is part of the
     suggestion, so it's not a pill of its own. {opts, right, n, groups:[{label, from, to, n}]}. */
  // What kind of wine it is for a server: the list's section first (a Sauternes is filed as white under
  // "Sweet"), then its type.
  /* Whether a reason claims something this wine's style rules out (the card's figures, 0 to 5): firm tannin
     for a wine with next to none, a full body for a light one, sweetness for a dry one, bubbles for a still
     one, high acidity for a soft one and the reverse. Only such a reason is safe to offer as wrong. */
  contradicts(t,st,kind){ const x=String(t||'').toLowerCase(), v=k=>typeof st[k]==='number'?st[k]:null;
    // A cocktail by its own figures: sweet, sour, bitter, strong, and whether it has bubbles.
    if(kind==='cocktail'){
      const sweet=/\bsweet|sugary|syrupy|dessert-like|\bluscious/.test(x)&&!/not (too )?sweet|less sweet|no sweetness/.test(x), dry=/bone[- ]dry|\bnot sweet\b|\bdry\b/.test(x);
      const bitter=/\bbitter|campari|\bamaro\b/.test(x)&&!/no bitter|not bitter/.test(x), sour=/\bsour\b|\btart\b|sharp citrus|zesty|citrusy/.test(x);
      const strong=/\bstrong\b|boozy|spirit-forward|powerful|stands up/.test(x), light=/low in alcohol|alcohol-free|\blight\b|gentle/.test(x), fizz=/\bbubbles?\b|\bfizz|sparkling|spritz/.test(x);
      return (sweet&&v('sweet')!=null&&v('sweet')<=1)||(dry&&v('sweet')!=null&&v('sweet')>=4)||(bitter&&v('bitter')!=null&&v('bitter')<=1)||(sour&&v('sour')!=null&&v('sour')<=1)
        ||(strong&&v('strong')!=null&&v('strong')<=1)||(light&&v('strong')!=null&&v('strong')>=4)||(fizz&&st.fizz===false); }
    const claims=this.claimsIn(x);
    return (claims.tannin&&v('tannin')!=null&&v('tannin')<=1)||(claims.full&&v('body')!=null&&v('body')<=2)||(claims.light&&v('body')!=null&&v('body')>=4)
      ||(claims.sweet&&v('sweet')!=null&&v('sweet')<=1)||(claims.dry&&v('sweet')!=null&&v('sweet')>=4)||(claims.bubbles&&kind!=='sparkling')
      ||(claims.acid&&v('acid')!=null&&v('acid')<=2)||(claims.soft&&v('acid')!=null&&v('acid')>=4)||(claims.untannic&&v('tannin')!=null&&v('tannin')>=4)||(claims.still&&kind==='sparkling'); },
  // What a reason claims about a wine's style, as flags; contradicts checks them against the card, and a table
  // question keeps one wrong reason per claim.
  claimsIn(t){ const x=String(t||'').toLowerCase(); return {
      tannin:/\btannin|\bgrip|\bgrippy|\bstructured?\b/.test(x)&&!/(soft|low|no|gentle|silky|light|little|without)\s+(\w+\s+)?tannin|tannin[- ]free|almost no tannin/.test(x),
      full:/full[- ]bodied|full body|\b(its|a) (full|big|bold|heavy|powerful|weighty)\b|\bheavyweight\b|\bweight to\b|\bweighty\b/.test(x),
      light:/\b(light|delicate|lean)[- ](bodied|and|wine)|\bit'?s light\b|\bit is light\b|light body|being light|light, fresh body/.test(x),
      sweet:/\b(its|the|of|a) (gentle |rich |honeyed )?sweetness\b|\bit'?s sweet\b|\bit is sweet\b|\bsweet wine\b|\bhoneyed\b|\bluscious\b|\boff-dry\b|hint of sweetness|touch of sweetness/.test(x)&&!/not (too )?sweet/.test(x),
      dry:/bone[- ]dry|\bit'?s dry\b|\bit is dry\b|\bdry wine\b|\bdry finish\b/.test(x),
      bubbles:/\bbubble|\bfizz|\bsparkl|\bmousse\b/.test(x),
      acid:/high acid|\bcrisp\b|\bzesty\b|\bzippy\b|\bsharp\b|bright acid|acidity cuts|racy/.test(x),
      soft:/soft acid|low acid|gentle acid|low in acidity|round acidity|soft, round acidity|mellow and low|low acidity/.test(x),
      untannic:/almost no tannin|tannin[- ]free|no tannin|soft tannin|low tannin|low in tannin|gentle tannins|soft, gentle tannins/.test(x),
      still:/\bstill\b/.test(x),
    }; },
  /* This wine's style turned round at this table, one line per trait it sits at an end of. */
  styleWrong(st,kind,dish,seed=''){ const v=k=>typeof st[k]==='number'?st[k]:null, out=[], d='the food';
    const one=(...xs)=>out.push(xs[Math.abs(this._hash(String(seed)+xs[0]))%xs.length]);
    if(kind==='cocktail'){
      if(v('sweet')!=null&&v('sweet')<=1) one(`Its rich sweetness balances the savoury flavours of ${d}`,`It's a sweet, dessert-like drink that softens ${d}`);
      if(v('sweet')!=null&&v('sweet')>=4) one(`It's bone dry, so it cuts straight through ${d}`);
      if(v('bitter')!=null&&v('bitter')<=1) one(`Its bitter Campari edge cuts the richness of ${d}`);
      if(v('bitter')!=null&&v('bitter')>=3) one(`It's soft and sweet with no bitterness, so it stays gentle with ${d}`);
      if(v('strong')!=null&&v('strong')>=4) one(`It's light and low in alcohol, so it won't overpower ${d}`);
      if(v('strong')!=null&&v('strong')<=1) one(`It's a strong, spirit-forward drink that stands up to ${d}`);
      if(v('sour')!=null&&v('sour')<=1) one(`Its sharp, tart citrus cuts through ${d}`);
      if(st.fizz===false) one(`Its bubbles scrub the palate clean between bites of ${d}`);
      return out; }
    // A wine is wrong about itself only in ways a server could believe of it: a red's tannin, body and
    // acidity; a white's, rosé's or sparkling wine's body, acidity and a touch of sweetness. Never another kind
    // of wine (fizz for a Bandol, sweetness for a Barolo), which anyone can rule out. No dish name either, since
    // a wrong answer that names the dish when the right one doesn't is a clue in itself.
    const red=kind==='red'||kind==='fortified'||kind==='orange', white=['white','rosé','sparkling'].includes(kind);
    if(red&&v('tannin')!=null&&v('tannin')<=1) one(`Its firm tannins give it the grip a rich dish needs`,`It has plenty of tannin to stand up to the meat`,`Its grippy structure holds its own against the food`);
    if(red&&v('tannin')!=null&&v('tannin')>=4) one(`Its soft, gentle tannins keep it smooth with the food`,`It's low in tannin, so it stays silky alongside the food`,`Soft tannins mean it won't clash with the dish`);
    if(v('body')!=null&&v('body')<=2) one(`It's full-bodied, with the weight to match a rich dish`,`Its big, powerful body matches the weight of the food`,`A weighty wine for a weighty plate`);
    if(v('body')!=null&&v('body')>=4) one(`It's light-bodied, so it won't overpower the food`,`Its light, fresh body lets the dish take the lead`,`Being light, it keeps the pairing delicate`);
    if(v('acid')!=null&&v('acid')<=2) one(`Its high acidity cuts through the richness`,`It's crisp and fresh, so it lifts every bite`,`Bright, zesty acidity refreshes the palate between bites`);
    if(v('acid')!=null&&v('acid')>=4) one(`Its soft, round acidity keeps it gentle with the food`,`It's mellow and low in acidity, so it never fights the dish`,`Low acidity keeps it smooth against the sauce`);
    if(white&&v('sweet')!=null&&v('sweet')<=1) one(`A touch of sweetness balances the salt and spice`,`Its hint of sweetness softens any heat in the dish`,`Being off-dry, it rounds out the savoury flavours`);
    if((white||kind==='sweet')&&v('sweet')!=null&&v('sweet')>=4) one(`It's bone dry, so it cleanses the palate`,`Its dry finish cuts straight through the food`);
    return out; },
  _hash(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; },
  /* The dish a question is about: the menu dish with the largest share of its name's telling words in the
     question ("pan-roast cod" is the cod, not the roast beetroot; "lamb rump" is not the lamb shoulder). */
  DISH_STOP:new Set(['with','and','the','roast','roasted','pan','sauce','crispy','braised','grilled','fried','aged','fresh','served']),
  dishIn(text){ const words=new Set(this._words(text)); let best=null, bs=0, bh=0;
    TeamData.dishes().forEach(d=>{ const ws=this._words(String(d.name).split(',')[0]).filter(w=>w.length>2&&!this.DISH_STOP.has(w)); if(!ws.length) return;
      const hit=ws.filter(w=>words.has(w)).length, sc=hit/ws.length; if(hit&&(sc>bs||(sc===bs&&hit>bh))){ best=d; bs=sc; bh=hit; } });
    return bs>=0.5?best:null; },
  /* Whether a wine suits a dish by the list's own pairing: 'good' (one of its picks, or close in style to
     them), 'avoid' (the one to steer from) or 'steer' (body, tannin and sweetness together STEER_GAP or more
     from the nearest of its picks, as a pale rosé is from the reds a braised lamb shoulder wants). */
  STEER_GAP:3,
  tableFit(wineId,dishId){ const pr=TeamData.pairing(dishId); if(!pr) return 'good';
    if(pr.avoid&&pr.avoid.id===wineId) return 'avoid';
    const picks=[...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id].filter(Boolean); if(!picks.length||picks.includes(wineId)) return 'good';
    const st=id=>(TeamData.card(id)||{}).style||{}, a=st(wineId); if(a.body==null) return 'good';
    const gap=Math.min(...picks.map(id=>{ const b=st(id); return b.body==null?99:Math.abs(a.body-b.body)+Math.abs((a.tannin||0)-(b.tannin||0))+Math.abs((a.sweet||0)-(b.sweet||0)); }));
    return gap>=this.STEER_GAP?'steer':'good'; },
  /* "What do you say?" when the guest's wine doesn't suit their dish: steer to the dish's own pick (the
     by-the-glass one when they asked for a glass) with its reason, and offer their wine with a dish it does
     suit. Wrong answers: the card's own claims that it works here, this wine's style turned round at this
     dish, and a steer to a wine that suits the dish no better. */
  _steerChoices(q,rw,dish,side,cardReasons){
    const pr=TeamData.pairing(dish.id)||{}, short=w=>TeamData.short(w), dn=String(dish.name).split(',')[0].trim().toLowerCase();
    const pick=(side==='glass'&&pr.glass&&pr.glass.id!==rw.id&&TeamData.wine(pr.glass.id))?pr.glass:(pr.best||[]).find(b=>b.id!==rw.id&&TeamData.wine(b.id));
    if(!pick) return null;
    const tw=TeamData.wine(pick.id), why=String(pick.why||'').trim().replace(/\.$/,'');
    const low=t=>t?t.charAt(0).toLowerCase()+t.slice(1):t;
    const rights=[`Steer them to the ${short(tw)}: ${low(why)||`it suits the ${dn}`}`];
    const alt=TeamData.dishes().find(d=>d.id!==dish.id&&(()=>{ const p2=TeamData.pairing(d.id); return p2&&([...(p2.best||[]),p2.glass].filter(Boolean).some(b=>b.id===rw.id)); })());
    rights.push(alt?`Offer the ${short(rw)} with the ${String(alt.name).split(',')[0].trim().toLowerCase()} instead`:`Say it's lovely, but the ${dn} will overpower it`);
    const st=(TeamData.card(rw.id)||{}).style||{}, kind=this.kindOf(rw), seen=new Set(rights.map(x=>this._norm(x))), wrongs=[];
    const take=t=>{ if(!t||seen.has(this._norm(t))||wrongs.length>=4) return; seen.add(this._norm(t)); wrongs.push(this._cap(t)); };
    // The card's own reasons that say it works with this dish.
    cardReasons.filter(t=>/\b(works?|goes|pairs?|suits?|match|matches|stands? up)\b/i.test(t)||this._words(t).some(w=>this._words(dish.name).includes(w)&&w.length>3)).forEach(take);
    // A steer to a wine no better suited.
    const worse=this._shuffle(TeamData.wines().filter(w=>w.id!==rw.id&&w.id!==tw.id&&this.tableFit(w.id,dish.id)!=='good'),this._seed(q)+'s')[0];
    if(worse) take(`Steer them to the ${short(worse)}: it's an easy match for the ${dn}`);
    take(`Pour it gladly: it's a classic match for the ${dn}`);
    this._shuffle(this.styleWrong(st,kind,dn,this._seed(q)),this._seed(q)+'g').forEach(take);
    const all=[...rights.map(x=>({x,ok:true})),...wrongs.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c2').map(i=>all[i]);
    return {opts:order.map(a=>a.x),right:order.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:rights.length,steer:true,groups:[{label:'What do you say?',from:0,to:order.length,n:rights.length}]};
  },
  kindOf(w){ if(TeamData.isDrink(w)) return 'cocktail'; const sec=String(w&&w.section||'').toLowerCase(); return /sweet|dessert|pudding/.test(sec)?'sweet':/fortified|port|sherry|madeira/.test(sec)?'fortified':/sparkling|fizz|champagne/.test(sec)?'sparkling':(w&&w.type)||'red'; },
  _applyChoices(q){
    const wines=TeamData.wines(), norm=x=>this._norm(x), key=(q.key||[]).map(String);
    // A sentence offers a wine when it names the wine as the list does (producer and name); a grape alone
    // ("Sauvignon Blanc", "Malbec") is a reason's word, not an offer.
    const shorts=wines.map(w=>[w,norm(TeamData.short(w))]).filter(([,n])=>n.length>3);
    const named=s=>{ const t=norm(s); return shorts.filter(([,n])=>t.includes(n)).map(([w])=>w); };
    const own=TeamData.wine(q.wine), offered=key.flatMap(named).filter(w=>w.id!==q.wine);
    // The question naming its own wine ("…wants a glass of the Minuty") makes it that wine, whatever other
    // wine the key steers to.
    const ownInQ=own&&[TeamData.short(own),own.name].some(n=>n&&norm(q.q).includes(norm(n)));
    const rw=ownInQ||key.some(k=>named(k).some(w=>w.id===q.wine))||!offered.length?own:offered[0]; if(!rw) return null;
    const side=/\bglass\b/i.test(q.q)?'glass':/\bbottle\b/i.test(q.q)?'bottle':rw.glass?'glass':'bottle';
    // "£8 (75ml)" reads "£8 a glass (75ml)": the measure after the unit, never inside it.
    const per=(p,u)=>{ const m=String(p).match(/^(.*?)\s*(\([^)]*\))\s*$/); return m?`${m[1]} a ${u} ${m[2]}`:`${p} a ${u}`; };
    const offer=w=>{ const pr=TeamData.isDrink(w)?String(w.glass||'').replace(/\s*\([^)]*\)\s*$/,''):side==='glass'&&w.glass?per(w.glass,'glass'):w.bottle?`${per(w.bottle,'bottle')}${side==='glass'?', not by the glass':''}`:w.glass?per(w.glass,'glass'):'';
      const nm=TeamData.short(w); return `${/^the\s/i.test(nm)?'':'The '}${nm}${pr?`, ${pr}`:''}`; };
    // Decoys a guest could believe: the nearest styles first (sparkling beside white, rosé beside both), and
    // for a glass, wines poured by the glass, so the price alone never gives the right one away.
    // A cocktail is offered among cocktails and a wine among wines, never one for the other.
    const near=['sparkling','white','rosé','orange','red','sweet','fortified'], dist=w=>TeamData.isDrink(w)!==TeamData.isDrink(rw)?9:TeamData.isDrink(w)?0:Math.abs(near.indexOf(this.kindOf(w))-near.indexOf(this.kindOf(rw)));
    const fit=w=>side==='glass'&&!w.glass?1:0;
    // With a dish in the question, a wrong wine is one the pairings rule out for it (never another of its
    // picks, which a sommelier would pour too), of the nearest kind so it's a mistake a server could make.
    const tableDish=this.dishIn(q.q), pr0=tableDish?TeamData.pairing(tableDish.id)||{}:{}, picks0=new Set([...(pr0.best||[]).map(b=>b.id),pr0.glass&&pr0.glass.id,pr0.cocktail&&pr0.cocktail.id].filter(Boolean));
    const ruledOut=w=>!tableDish||(!picks0.has(w.id)&&this.tableFit(w.id,tableDish.id)!=='good');
    const listDecoys=(tableDish?this.tableDecoys(rw,tableDish,this._seed(q)+'o',fit,this.wishIn(q.q,rw),q.q,q.decoys):this._shuffle(wines.filter(w=>w.id!==rw.id&&dist(w)<=1),this._seed(q)+'o').sort((a,b)=>dist(a)-dist(b)||fit(a)-fit(b)).slice(0,3)).map(w=>({x:offer(w),ok:false}));
    // Too few wines of the kind on the list, away from a table: a well-known bottle that isn't on it, priced
    // like the list's own. At a table the list's own ruled-out wines are enough; three options beat an invented one.
    const priceLike=side==='glass'&&rw.glass?`${rw.glass} a glass`:rw.bottle?`${rw.bottle} a bottle`:'';
    const extra=tableDish?[]:this.offList(this.kindOf(rw),3-listDecoys.length,this._seed(q)+'f').map(n=>({x:`The ${n}${priceLike?`, ${priceLike}`:''}`,ok:false}));
    const offers=[{x:offer(rw),ok:true},...listDecoys,...extra];
    // A choice of one isn't a choice: with fewer than two wrong wines, the question asks only why.
    const choose=offers.length>=3;
    // A reason as something to say: "Say it's dry" → "It's dry"; price clauses and offers dropped.
    // Serving notes (decant, temperature) and bare instructions ("Link the wine to the dish") aren't reasons.
    const reason=s=>{ if(/^(offer|suggest|recommend|pour|go for|link|name|serve)\b/i.test(s)||/\bdecant|°C|\bserve at\b/i.test(s)||/^if they('re| are)? (want|fancy|feel)|treat (themselves|yourself)/i.test(s)||named(s).length) return '';
      let t=s.split(/;\s*/).filter(p=>!/[£$€]\s?\d/.test(p)).join('; ').trim();
      t=t.replace(/^describe it as\s+/i,"It's ").replace(/^(say|mention|explain|tell them|point out|add)\s+(that\s+)?/i,'').trim();
      return norm(t).split(' ').length>=3?this._cap(t):''; };
    // A question that already names the wine ("How do you suggest the William Fèvre…?") asks only why.
    const inQ=[TeamData.short(rw),rw.name].some(n=>n&&norm(q.q).includes(norm(n)));
    // A guest asking for a wine that doesn't suit their dish (a pale rosé with a braised lamb shoulder) is
    // steered, whatever the card's own question assumed: the right answers are the dish's own pick and the
    // wine with a dish it does suit.
    const fitDish=this.dishIn(q.q);
    if(inQ&&fitDish&&this.tableFit(rw.id,fitDish.id)!=='good'){ const g=this._steerChoices(q,rw,fitDish,side,key.map(reason).filter(Boolean)); if(g) return g; }
    // The right reasons lead with the sommelier's own reason for this wine at this dish (the pairing's why, else
    // the card's), a full sentence and the thing worth being able to say; then the card's longest point. Terse
    // points alone ("It is dry") would stand out beside full-sentence wrong ones by their length.
    const atDish=this.dishIn(q.q), prw=atDish?TeamData.pairing(atDish.id)||{}:{}, rc=TeamData.card(rw.id)||{};
    const dishWhy=atDish&&(([...(prw.best||[]),prw.glass,prw.cocktail].filter(Boolean).find(b=>b.id===rw.id)||{}).why||((rc.dishes||[]).find(x=>this._norm(x.dish)===this._norm(atDish.name))||{}).why);
    const keyR=[...new Set(key.map(reason).filter(Boolean))].sort((a,b)=>b.length-a.length);
    const rights=[...(dishWhy?[this._cap(String(dishWhy).replace(/\.\s*$/,''))]:[]),...keyR].filter((x,i,a)=>a.findIndex(y=>this._overlap(x,y)>=0.6)===i).slice(0,2);
    if(!rights.length) return null;
    // Wrong reasons a server could believe are about this same table and wrong for this wine: what a wine of
    // another style is said to do with this dish ("Firm tannins grip the lamb" offered for a rosé), and,
    // where those run short, this wine's own style turned round at this dish (STYLE_WRONG). Never a reason
    // about another dish, another grape or a style this wine also has, since those are wrong for the wrong
    // reason or not wrong at all.
    const dishes=TeamData.dishes(), hereDish=this.dishIn(q.q), here=hereDish?[hereDish]:[];
    const hereWords=new Set(here.flatMap(d=>this._words(d.name+' '+(d.desc||''))));
    const foodWords=new Set(dishes.flatMap(d=>this._words(d.name+' '+(d.desc||''))).filter(w=>w.length>3&&!hereWords.has(w)));
    // Grape names only (a card's grape line is a sentence, whose everyday words would rule out every reason).
    const ownGrapes=new Set(this._words([...(rw.grapes||[]),rw.name].join(' ')));
    const grapeWords=new Set(wines.flatMap(w=>this._words((w.grapes||[]).join(' '))).filter(w=>w.length>3&&!ownGrapes.has(w)));
    const offTable=t=>this._words(t).some(w=>foodWords.has(w)||grapeWords.has(w));
    const style={...((TeamData.card(rw.id)||{}).style||{}),fizz:/soda|prosecco|fizz|sprite|sparkling|champagne|lemonade|tonic|rosé\b/i.test((rw.spec||[]).join(' '))}, kind=this.kindOf(rw);
    const wrongFor=t=>this.contradicts(t,style,kind);
    const seen=new Set(rights.map(norm)), wrongs=[], kept=[...rights];
    // Two reasons that say much the same thing ("Its high acidity cuts through rich fried pork" twice) count once.
    const alike=(x,y)=>{ const p=new Set(this._stems(x)), q2=this._stems(y); if(!p.size||!q2.length) return false; const both=q2.filter(w=>p.has(w)).length; return both/Math.min(p.size,q2.length)>=0.6; };
    // Each wrong reason is a different mistake: two that both claim it's light and low in tannin are ruled out
    // together by anyone who knows it's big and tannic, which makes the question easier than it looks.
    const claimed=new Set(), claimKey=t=>{ const c=this.claimsIn(t); return Object.keys(c).filter(k=>c[k]); };
    // A claim no wine of this kind could make (bubbles for a still wine, sweetness for a red) is ruled out by
    // anyone who can read the list, so it's never a wrong answer.
    const offKind=ks=>ks.includes('bubbles')||ks.includes('still')||(['red','orange','fortified'].includes(kind)&&ks.includes('sweet'))||(['white','rosé','sparkling','sweet'].includes(kind)&&(ks.includes('tannin')||ks.includes('untannic')));
    const take=t=>{ t=t&&String(t).replace(/\.\s*$/,''); if(!t||seen.has(norm(t))||/^(yes|no)\b/i.test(t)||kept.some(k=>alike(k,t))) return;
      const ks=claimKey(t); if(kind!=='cocktail'&&offKind(ks)) return; if(ks.length&&ks.every(k=>claimed.has(k))) return; ks.forEach(k=>claimed.add(k)); seen.add(norm(t)); kept.push(t); wrongs.push(t); };
    // Wrong reasons the card writer authored for this question (`wrong`, each a different mistake), checked like
    // any other: never alike to a right one, never a claim no wine of this kind could make.
    (q.wrong||[]).forEach(t=>{ if(wrongs.length<4) take(this._cap(String(t).replace(/^(say|mention|tell them|explain|point out)\s+(that\s+)?/i,''))); });
    // Written for this question and passing the checks: nothing borrowed from other tables or templates beside
    // them, since a reason lifted from another dish ("a step up in finesse…") reads as out of place.
    const authored=wrongs.length>=3;
    const borrowed=[];
    const sameSide=b=>{ const w=TeamData.wine(b.id); return w&&TeamData.isDrink(w)===TeamData.isDrink(rw); };
    here.forEach(d=>{ const pr=TeamData.pairing(d.id)||{}; [...(pr.best||[]),pr.glass,pr.cocktail].filter(Boolean).forEach(b=>{ if(b.id!==rw.id&&b.why&&sameSide(b)) borrowed.push(b.why); }); });
    wines.filter(w=>w.id!==rw.id).forEach(w=>((TeamData.card(w.id)||{}).qs||[]).forEach(o=>{ if(o.k==='apply'&&here.some(d=>this._words(d.name).some(x=>x.length>3&&norm(o.q).split(' ').includes(x)))) (o.key||[]).forEach(k=>borrowed.push(k)); }));
    if(!authored) this._shuffle(borrowed,this._seed(q)+'r').forEach(k=>{ if(wrongs.length>=4) return; const t=reason(k); if(t&&!offTable(t)&&wrongFor(t)) take(t); });
    // Then what other wines of the same kind are said to do anywhere on the menu, where it names no other food
    // and claims a style this wine doesn't have: real reasons in a server's words, wrong only for this wine.
    if(wrongs.length<4&&!authored){ const wide=[]; wines.filter(w=>w.id!==rw.id&&this.kindOf(w)===kind).forEach(w=>{ ((TeamData.card(w.id)||{}).qs||[]).forEach(o=>{ if(o.k==='apply') (o.key||[]).forEach(k=>wide.push(k)); });
        TeamData.dishes().forEach(d=>{ const pr=TeamData.pairing(d.id)||{}; [...(pr.best||[]),pr.glass,pr.cocktail].filter(Boolean).forEach(b=>{ if(b.id===w.id&&b.why) wide.push(b.why); }); }); });
      this._shuffle(wide,this._seed(q)+'v').forEach(k=>{ if(wrongs.length>=4) return; const t=reason(k); if(t&&!offTable(t)&&wrongFor(t)) take(t); }); }
    // A cocktail is also told apart by how it tastes: the taste lines of drinks clearly unlike it (3 or more
    // apart on sweet, sour, bitter and strong together) are wrong descriptions of this one.
    if(kind==='cocktail'&&wrongs.length<4&&!authored){ const gap=o=>['sweet','sour','bitter','strong'].reduce((a,k)=>a+Math.abs((o[k]||0)-(style[k]||0)),0);
      this._shuffle(wines.filter(w=>w.id!==rw.id&&TeamData.isDrink(w)),this._seed(q)+'k').forEach(w=>{ const c=TeamData.card(w.id); if(wrongs.length>=4||!c||!c.taste||!c.style||gap(c.style)<3) return;
        // Taste words ("lemon", "coffee") are on the menu too, so only another dish's name rules a line out here.
        const t=String(c.taste).replace(/\.\s*$/,''), dishNames=new Set(dishes.filter(x=>!here.includes(x)).flatMap(x=>this._words(String(x.name).split(',')[0])).filter(x=>x.length>3));
        if(!this._words(t).some(x=>dishNames.has(x)||grapeWords.has(x))&&!this._words(t).some(x=>this._words(w.name).includes(x)&&x.length>3)) take(t); }); }
    const dishName=here.length?String(here[0].name).split(',')[0].trim().toLowerCase():'dish';
    if(wrongs.length<4&&!authored) this._shuffle(this.styleWrong(style,kind,dishName,this._seed(q)),this._seed(q)+'g').forEach(t=>wrongs.length<4&&take(t));
    // Too few believable wrong reasons: a question that asks for the wine still tests the choice alone.
    if(wrongs.length<2){ if(inQ||!choose) return null; const o1=this._shuffle(offers.map((_,i)=>i),this._seed(q)+'c1').map(i=>offers[i]);
      return {opts:o1.map(a=>a.x),right:o1.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:1,groups:[{label:'What do you suggest?',from:0,to:o1.length,n:1}]}; }
    // No answer stands out by its length: the wrong reasons kept are the ones nearest the right ones in length.
    const L=rights.reduce((a,x)=>a+x.length,0)/rights.length;
    const chosenW=this._shuffle(wrongs,this._seed(q)+'w').sort((a,b)=>Math.abs(a.length-L)-Math.abs(b.length-L)).slice(0,6-rights.length);
    // A right reason under half the length of every wrong one is a clue in itself; with another right one to
    // stand on, it's left out.
    // Nor one far longer than every wrong one (the review held "If they want to treat themselves, this Champagne's toasty,
    // bready richness…" beside three short reasons).
    const minW=Math.min(...chosenW.map(x=>x.length)), maxW=Math.max(...chosenW.map(x=>x.length)), keepR=rights.filter(x=>x.length>=0.5*minW&&x.length<=1.8*maxW), rs=keepR.length?keepR:rights;
    const reasons=[...rs.map(x=>({x,ok:true})),...chosenW.map(x=>({x,ok:false}))];
    const o1=inQ||!choose?[]:this._shuffle(offers.map((_,i)=>i),this._seed(q)+'c1').map(i=>offers[i]), o2=this._shuffle(reasons.map((_,i)=>i),this._seed(q)+'c2').map(i=>reasons[i]);
    const all=[...o1,...o2];
    if(inQ||!choose) return {opts:all.map(a=>a.x),right:all.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:rs.length,groups:[{label:'Why it works',from:0,to:all.length,n:rs.length}]};
    return {opts:all.map(a=>a.x),right:all.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:1+rs.length,
      groups:[{label:'What do you suggest?',from:0,to:o1.length,n:1},{label:'Why it works',from:o1.length,to:all.length,n:rs.length}]};
  },
  /* Marks a set of picked pills: right only when it's exactly the right set; partly when some of it is. */
  gradeChoices(q,picked){
    const {right}=this.choices(q), a=new Set(picked||[]), hit=right.filter(i=>a.has(i)).length, extra=[...a].filter(i=>!right.includes(i)).length;
    if(hit===right.length&&!extra) return {ok:true,score:1,verdict:'right'};
    return {ok:false,score:right.length?Math.max(0,hit-extra)/right.length:0,verdict:hit>0&&hit>=extra?'partly':'wrong'};
  },
  async grade(q,answer){
    if(q.k==='recognise'||q.mc) return answer===q.a?{ok:true,score:1,verdict:'right'}:{ok:false,score:0,verdict:'wrong'};
    if(!String(answer||'').trim()) return {ok:false,score:0,verdict:'wrong'};
    if(q.k!=='apply'&&this.localMatch(q,answer)) return {ok:true,score:1,verdict:'right'};
    const key=q.k==='apply'?q.key:[q.ans,...(q.acc||[]).map(x=>`(also right: ${x})`)];
    try{
      const tpl=_loadTextSync('prompts/team-grade.txt');
      const text=await window.claude.complete({purpose:'team_grade',messages:[{role:'user',content:tpl.replace('{{q}}',q.q).replace('{{key}}',key.join('; ')).replace('{{answer}}',String(answer).slice(0,600))}]});
      const j=TeamData._json(text)||{}; const score=Math.max(0,Math.min(1,Number(j.score)||0));
      return {ok:score>=this.PASS,score,verdict:j.verdict||(score>=this.PASS?'right':score>0.3?'partly':'wrong'),say:j.say||'',missing:j.missing||''};
    }catch(e){ return {ok:false,score:0,verdict:'unmarked',say:'We couldn\'t mark that just now, so it will come back.',offline:true}; }
  },

  /* Records an answer and moves the question's review date. sure: 'sure' | 'think' | 'guess'. */
  record(pid,q,ok,sure='think',now=Date.now()){
    // _batchP: many answers at once (the demo's seeding) write to one object, saved once at the end.
    const p=this._batchP||this._all(), m=this._mine(p,pid), fresh=!m.items[q.id], it=m.items[q.id]||{s:0,d:5,reps:0,lapses:0,last:0,due:0};
    // The first answer anyone gives a question is what questionHealth reads (a seeded demo answer isn't one).
    if(fresh&&!this._batchP) it.first={ok:!!ok,sure,at:now};
    const R=this.recall(it,now);
    if(q.check) m.checks.push({at:now,ok:!!ok,id:q.id});
    if(!ok){
      it.lapses++; it.d=Math.min(10,it.d+1.5); it.wrong=true;
      // Confidently wrong comes back within hours; a known answer forgotten keeps a little of its stability.
      it.s=sure==='sure'?0.1:it.reps?Math.max(0.25,it.s*0.25):0.25;
      if(q.allergen) it.s=Math.min(it.s,0.05); // a wrong allergen comes back within the shift, whatever they said
    } else {
      it.wrong=false;
      if(!it.reps) it.s=sure==='guess'?0.5:sure==='sure'?2:1;
      else if(sure==='guess') it.s=it.s*1.2;
      else it.s=it.s*(2+(5-it.d)*0.15)*(1+Math.max(0,this.RETAIN-R)); // later and still right earns more
      it.d=Math.max(1,it.d-(sure==='sure'?0.4:0.2)); it.reps++;
    }
    it.s=Math.min(this.MAX_DAYS,it.s); it.last=now; it.due=now+it.s*this.DAY;
    m.items[q.id]=it;
    // An assignment is done once the wine or dish is known at the level their role needs.
    const key=q.wine?'w:'+q.wine:q.cocktail?'c:'+q.cocktail:q.allergen?'a:'+q.dish:q.dish?'d:'+q.dish:null, person=this.person(pid);
    if(key&&m.assigned[key]&&!m.assigned[key].done&&person){
      const done=q.wine||q.cocktail?this.knowsWine(pid,person.role,q.wine||q.cocktail,m.items):q.allergen?this.knowsAllergens(pid,q.dish,m.items):this.knowsDish(pid,q.dish,m.items);
      if(done) m.assigned[key].done=now;
    }
    if(!this._batchP) this._saveAll(p);
    return it;
  },

  /* After a publish: new wines and dishes become assignments for everyone whose role sells them;
     ones taken off drop out. */
  assign(res){
    if(!res) return; const due=Date.now()+(TeamData.get().settings.dueDays||7)*this.DAY, p=this._all();
    this.people().forEach(person=>{
      const m=this._mine(p,person.id), sc=this.scope(person.role);
      const pre=res.kind==='list'?'w:':res.kind==='cocktails'?'c:':'d:';
      const ids=res.kind==='list'?[...sc.glass,...sc.bottle].map(w=>w.id):res.kind==='cocktails'?(sc.cocktails||[]).map(c=>c.id):sc.dishes.map(x=>x.id);
      (res.added||[]).filter(id=>ids.includes(id)).forEach(id=>{ const k=pre+id; if(!m.assigned[k]) m.assigned[k]={at:Date.now(),due}; });
      (res.removed||[]).forEach(id=>{ delete m.assigned[pre+id]; });
    });
    this._saveAll(p);
  },
  /* Someone new learns the list in waves, not as one assignment due in a week (which made every new server 120
     "overdue" on day eight): the part their role sells with first, each wave with its own days, the next starting
     when the one before ends. WAVES is the order per role; a part the role doesn't need is skipped. */
  WAVES:{
    server:[['glass',10],['allergens',7],['bottle',10],['dishes',10],['cocktails',7]], manager:[['glass',10],['allergens',7],['bottle',10],['dishes',10],['cocktails',7]],
    bartender:[['cocktails',7],['allergens',7],['glass',10],['dishes',10]], sommelier:[['glass',7],['allergens',7],['bottle',10],['dishes',10],['cocktails',7]], buyer:[['glass',7],['allergens',7],['bottle',10],['dishes',10]],
  },
  waves(role){ const need=this.need(role), sc=this.scope(role); return (this.WAVES[role]||this.WAVES.server).filter(([k])=>need[k]>0&&(sc[k]||[]).length>0).map(([k,days],i)=>({n:i+1,part:k,days,label:this.PART_LABEL[k]})); },
  _keyPart(key){ const [t,id]=[key.slice(0,1),key.slice(2)]; if(t==='a') return 'allergens'; if(t==='d') return 'dishes'; if(t==='c') return 'cocktails'; const w=TeamData.wine(id); return w&&TeamData.byGlass(w)?'glass':'bottle'; },
  assignExisting(pid,now=Date.now()){ const person=this.person(pid); if(!person) return; const p=this._all(), m=this._mine(p,pid), sc=this.scope(person.role);
    let start=now; this.waves(person.role).forEach(w=>{ const due=start+w.days*this.DAY, pre=w.part==='allergens'?'a:':w.part==='dishes'?'d:':w.part==='cocktails'?'c:':'w:';
      (sc[w.part]||[]).forEach(x=>{ const k=pre+x.id; m.assigned[k]=m.assigned[k]||{at:now,from:start,due,wave:w.n}; }); start=due; }); // from: when its wave starts
    this._saveAll(p); },
  /* Where someone is in their waves (Today's plan, the console's "on track"): each wave with what's done, the one
     they're on, the day they're on in it, and how many days behind it is. An assignment from before waves existed
     is put in its part's wave. {waves:[{n,part,label,total,done,start,due,day,days,behind}], current, behind, started} */
  plan(pid,now=Date.now()){ const person=this.person(pid); if(!person) return null; const m=this._mine(this._all(),pid), items=m.items;
    const ws=this.waves(person.role).map(w=>({...w,total:0,done:0,start:Infinity,due:0}));
    Object.entries(m.assigned||{}).forEach(([k,a])=>{ const part=this._keyPart(k), w=ws.find(x=>x.part===part); if(!w) return; w.total++; if(a.done) w.done++; w.start=Math.min(w.start,a.from||Infinity,a.at||now); w.due=Math.max(w.due,a.due||now); });
    const out=ws.filter(w=>w.total).map(w=>{ const days=Math.max(1,Math.round((w.due-w.start)/this.DAY)), day=Math.min(days,Math.max(1,Math.floor((now-w.start)/this.DAY)+1)), behind=w.done<w.total?Math.max(0,Math.floor((now-w.due)/this.DAY)):0; return {...w,days,day,behind}; });
    const current=out.find(w=>w.done<w.total)||null, started=Object.values(items).some(it=>it.reps);
    return {waves:out,current,behind:out.reduce((a,w)=>Math.max(a,w.behind),0),started}; },
  /* The kitchen confirming a dish's allergens assigns its allergen question to everyone, due in a week. */
  assignAllergen(dishId,now=Date.now()){ const p=this._all(); this.people().forEach(person=>{ const m=this._mine(p,person.id); const k='a:'+dishId; if(!m.assigned[k]) m.assigned[k]={at:now,from:now,due:now+7*this.DAY,wave:0}; }); this._saveAll(p); },
  assignments(pid){ const m=this._mine(this._all(),pid), now=Date.now();
    return Object.entries(m.assigned||{}).filter(([,a])=>!a.done).map(([k,a])=>({key:k,kind:k[0]==='w'?'wine':k[0]==='c'?'cocktail':k[0]==='a'?'allergen':'dish',id:k.slice(2),due:a.due,overdue:a.due<now})).sort((a,b)=>a.due-b.due); },

  /* Retention from the unannounced checks over the last `days`: {asked, right, rate}. */
  retention(pid,days=30){ const since=Date.now()-days*this.DAY, all=this._all();
    const cs=(pid?[this._mine(all,pid)]:this.people().map(x=>this._mine(all,x.id))).flatMap(m=>m.checks||[]).filter(c=>c.at>=since);
    return {asked:cs.length,right:cs.filter(c=>c.ok).length,rate:cs.length?cs.filter(c=>c.ok).length/cs.length:null}; },
  /* For the manager: each wine with how many of the staff who sell it know it, weakest first. */
  weakWines(){ const all=this._all(), ppl=this.people();
    return TeamData.wines().map(w=>{ const sellers=ppl.filter(x=>{ const sc=this.scope(x.role); return [...sc.glass,...sc.bottle].some(y=>y.id===w.id); });
      const knows=sellers.filter(x=>this.knowsWine(x.id,x.role,w.id,this._mine(all,x.id).items)).length;
      return {wine:w,knows,of:sellers.length,share:sellers.length?knows/sellers.length:1}; }).sort((a,b)=>a.share-b.share); },
  resetProgress(){ Store.remove(this.PROGRESS); },
};
Object.assign(window,{TeamLearn});
