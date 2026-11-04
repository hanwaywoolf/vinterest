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
  ROLES:{
    server:{label:'Server',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8,cocktails:0.5}},
    bartender:{label:'Bartender',kinds:['recognise','recall','apply'],cocktailKinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0,dishes:0.5,cocktails:0.9}},
    sommelier:{label:'Sommelier',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9,cocktails:0.5}},
    buyer:{label:'Buyer',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9,cocktails:0}},
    manager:{label:'Manager',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8,cocktails:0.5}},
  },
  // Cocktails count only where the restaurant has a cocktail list (The Social Corner); everywhere else the part doesn't exist.
  PART_LABEL:{glass:'By the glass',bottle:'Bottles',dishes:'Menu pairings',cocktails:'Cocktails'},
  /* The rungs a role needs for one item: a cocktail's for the bartender all four (it's their list), a wine's by role. */
  kindsFor(role,id){ const r=this.ROLES[role]; return this.isCocktail(id)&&r.cocktailKinds?r.cocktailKinds:r.kinds; },
  isCocktail(id){ return /^c-/.test(String(id||'')); },
  /* A wine's or a cocktail's questions, by its id. */
  qsOf(id){ return this.isCocktail(id)?this.cocktailQs(id):this.wineQs(id); },

  team(){ const raw=Store.get(this.KEY); if(raw!==null&&raw===this._teamRaw) return this._teamVal;
    const t=raw?Store.getJSON(this.KEY,null):null, v=t&&t.people?t:{people:{},me:null,targets:{}}; this._teamRaw=raw; this._teamVal=v; return v; },
  _saveTeam(t){ Store.setJSON(this.KEY,t); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  people(){ return Object.values(this.team().people).sort((a,b)=>a.created-b.created); },
  person(id){ return this.team().people[id]||null; },
  me(){ const t=this.team(); return t.people[t.me]||null; },
  addPerson(name,role,photo){ const t=this.team(), id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    t.people[id]={id,name:String(name).trim(),role,photo:photo||null,created:Date.now()}; if(!t.me) t.me=id; this._saveTeam(t);
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
  wineQs(id){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    if(!m.has(id)) m.set(id,this._buildQs(id));
    return m.get(id).map(q=>({...q})); },
  _buildQs(id){ const c=TeamData.card(id); return (c&&c.qs||[]).map(q=>this._unspoil({...q,wine:id})).filter(Boolean).map(x=>{ if(x.k!=='recognise') return x;
    x=this._sameKind(x); if(!x||this.givesAway(x)) return null;
    const order=this._shuffle(x.opts.map((_,i)=>i),x.id); return {...x,opts:order.map(i=>this._cap(x.opts[i])),a:order.indexOf(x.a)}; }).filter(Boolean); },
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
      const un=this._unspoil(q); if(!un) return fail('giveaway',/\bor\b/i.test(q.q)?'it offers its own answer as one of two choices in the question':'the answer is in the question');
      if(q.k==='recognise'){ const k=this._sameKind(un); if(!k) return fail('giveaway','the wrong answers are another kind of wine'); if(this.givesAway(k)) return fail('giveaway','a word in the question is only in the right answer'); return; }
      let c2=null; try{ c2=this.choices(un); }catch(e){}
      const wrong=c2?c2.opts.length-c2.right.length:0;
      if(!c2||wrong<this.MIN_WRONG) return fail('thin','too few believable wrong answers');
      // A guest at a dish this wine doesn't suit is fine when the key already steers them to another wine
      // on the list; it fails only where the card set it as a good match.
      if(q.k==='apply'){ const d=this.dishIn(q.q); if(d&&this.tableFit(id,d.id)!=='good'){ const others=TeamData.wines().filter(w=>w.id!==id).map(w=>this._norm(TeamData.short(w)));
        const steers=(q.key||[]).some(k=>{ const t=this._norm(k); return /\b(steer|instead|rather)\b/.test(t)&&others.some(n=>n.length>3&&t.includes(n)); });
        if(!steers) return fail('mismatch',`the guest's dish, the ${d.name}, doesn't suit this wine`); } }
    }); });
    return out; },
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
    const nameWords=q.k==='contrast'?new Set(TeamData.wines().flatMap(x=>this._words(TeamData.short(x)+' '+(x.name||'')))):null;
    const plain=a=>nameWords?this._words(a).filter(x=>!nameWords.has(x)).join(' '):a;
    const answers=q.k==='recognise'?[q.opts[q.a]]:q.k==='recall'?String(q.ans||'').split(/,|\band\b|;/).map(x=>x.trim()).filter(Boolean):q.k==='contrast'&&q.ans?[plain(q.ans)].filter(Boolean):[];
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
    return gives(text)?null:{...q,q:text};
  },
  /* A cocktail's questions (prompts/team-cocktail-cards.txt): every one four options with one right, the
     wrong ones from this bar's own other cocktails, so they're asked as written (mc), shuffled by their id. */
  cocktailQs(id){ const doc=TeamData.get(); let m=this._qsCache.get(doc); if(!m){ m=new Map(); this._qsCache.set(doc,m); }
    if(!m.has(id)){ const c=TeamData.cocktailCard(id);
      m.set(id,(c&&c.qs||[]).filter(q=>q&&q.q&&Array.isArray(q.opts)&&q.opts.length===4&&q.opts[q.a]!=null).map(q=>({...q,cocktail:id,mc:true}))
        .filter(q=>!this.givesAway(q)).map(q=>{ const order=this._shuffle(q.opts.map((_,i)=>i),q.id); return {...q,opts:order.map(i=>this._cap(q.opts[i])),a:order.indexOf(q.a)}; })); }
    return m.get(id).map(q=>({...q})); },
  dishQs(id){
    const x=TeamData.dish(id), p=TeamData.pairing(id); if(!x||!p||!p.best||!p.best.length) return [];
    const best=TeamData.wine(p.best[0].id); if(!best) return [];
    const others=TeamData.wines().filter(w=>!p.best.some(b=>b.id===w.id));
    const pick=[...(p.avoid&&TeamData.wine(p.avoid.id)?[TeamData.wine(p.avoid.id)]:[]),...others.filter(w=>w.type===best.type),...others]
      .filter((w,i,a)=>a.indexOf(w)===i).slice(0,3);
    if(pick.length<3) return [];
    const opts=[best,...pick].map(w=>TeamData.short(w)), order=this._shuffle([0,1,2,3],id);
    return [
      {id:'d:'+id+'#0',dish:id,k:'recognise',q:`A guest orders the ${x.name}. Which wine on our list suits it best?`,opts:order.map(i=>opts[i]),a:order.indexOf(0),why:p.best[0].why},
      {id:'d:'+id+'#1',dish:id,k:'recall',q:`Name a wine from our list for a guest having the ${x.name}.`,ans:TeamData.short(best),acc:p.best.map(b=>TeamData.wine(b.id)).filter(Boolean).flatMap(w=>[TeamData.short(w),w.name]),why:p.best.map(b=>{ const w=TeamData.wine(b.id); return w?`${TeamData.short(w)}: ${b.why}`:''; }).filter(Boolean).join(' ')},
    ];
  },
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
  allQs(){ return [...TeamData.wines().flatMap(w=>this.wineQs(w.id)),...TeamData.cocktails().flatMap(c=>this.cocktailQs(c.id)),...TeamData.dishes().flatMap(x=>this.dishQs(x.id))]; },

  /* How likely they are to remember a question now: 1 just after a right answer, RETAIN at its due date. */
  recall(it,now=Date.now()){ if(!it||!it.reps||!it.s) return 0; const days=(now-it.last)/this.DAY; return Math.exp(Math.log(this.RETAIN)*days/it.s); },
  known(it,now=Date.now()){ return !!(it&&it.reps&&!it.wrong&&now<it.due); },

  /* Which wines and dishes a role sells: a bartender the by-the-glass list, everyone else all of it. */
  scope(role){
    const need=this.need(role), ws=TeamData.wines();
    return {glass:need.glass>0?ws.filter(w=>TeamData.byGlass(w)):[],bottle:need.bottle>0?ws.filter(w=>!TeamData.byGlass(w)):[],dishes:need.dishes>0?TeamData.dishes():[],cocktails:need.cocktails>0?TeamData.cocktails():[]};
  },
  // A rung opens once every question on the rung below has been answered right at least once.
  _open(qs,items,kind,kinds){
    const idx=this.LADDER.indexOf(kind); if(!kinds.includes(kind)) return false;
    for(let r=0;r<idx;r++){ const k=this.LADDER[r]; if(!kinds.includes(k)) continue; const below=qs.filter(q=>q.k===k); if(below.some(q=>!(items[q.id]&&items[q.id].reps))) return false; }
    return true;
  },
  knowsWine(pid,role,id,items){ const kinds=this.kindsFor(role,id), qs=this.qsOf(id).filter(q=>kinds.includes(q.k)); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },
  knowsDish(pid,id,items){ const qs=this.dishQs(id); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },
  /* How much of a wine (the role's questions) or a dish they hold today: {known, total, rungs:[{k,label,done}]}.
     The drill's summary shows it per wine, and readiness counts it as partial credit. */
  progress(pid,id,{dish=false}={}){
    const person=this.person(pid); if(!person) return {known:0,total:0,rungs:[]};
    const items=this._mine(this._all(),pid).items;
    if(dish){ const qs=this.dishQs(id); return {known:qs.filter(q=>this.known(items[q.id])).length,total:qs.length,rungs:[]}; }
    const kinds=this.kindsFor(person.role,id), qs=this.qsOf(id).filter(q=>kinds.includes(q.k));
    const rungs=this.LADDER.filter(k=>kinds.includes(k)).map(k=>{ const rq=qs.filter(q=>q.k===k); return {k,label:this.KIND_LABEL[k],done:rq.length>0&&rq.every(q=>this.known(items[q.id]))}; });
    return {known:qs.filter(q=>this.known(items[q.id])).length,total:qs.length,rungs};
  },
  KIND_LABEL:{recognise:'Recognise',recall:'Recall',apply:'At the table',contrast:'Tell them apart'},
  /* Where a person stands with one wine, for its card: the rungs, the next one to climb, how many answers are
     fading or missed, and a word for it (new | learning | fading | known). */
  standing(pid,id){
    const person=this.person(pid); if(!person) return null;
    const pr=this.progress(pid,id), items=this._mine(this._all(),pid).items, now=Date.now();
    const qs=this.qsOf(id).filter(q=>this.kindsFor(person.role,id).includes(q.k));
    const seen=qs.filter(q=>items[q.id]&&items[q.id].reps).length, due=qs.filter(q=>{ const it=items[q.id]; return it&&it.reps&&(it.wrong||it.due<=now); }).length;
    const next=pr.rungs.find(r=>!r.done)||null, nextDue=qs.map(q=>items[q.id]).filter(it=>it&&it.reps&&!it.wrong&&it.due>now).reduce((a,it)=>Math.min(a,it.due),Infinity);
    const state=!seen?'new':pr.total&&pr.known===pr.total?'known':due?'fading':'learning';
    return {...pr,seen,due,next,nextDue:isFinite(nextDue)?nextDue:null,state,role:person.role};
  },

  /* {pct, parts:{glass:{known,total,need,share}}, state:'ready'|'slipping'|'not', overdue, due} */
  readiness(pid){
    const person=this.person(pid); if(!person) return null;
    const role=person.role, need=this.need(role), sc=this.scope(role), mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const parts={};
    ['glass','bottle','dishes','cocktails'].forEach(k=>{
      if(!need[k]) return;
      if(k==='cocktails'&&!sc.cocktails.length) return; // no cocktail list, no cocktail part
      const list=sc[k], known=list.filter(x=>k==='dishes'?this.knowsDish(pid,x.id,items):this.knowsWine(pid,role,x.id,items)).length;
      // partial: every answer they hold counts, so the figure moves with each drill; a wine is known (for the minimum) only whole.
      const partial=list.reduce((a,x)=>{ const pr=this.progress(pid,x.id,{dish:k==='dishes'}); return a+(pr.total?pr.known/pr.total:0); },0);
      parts[k]={known,total:list.length,need:need[k],share:list.length?known/list.length:1,partial:list.length?partial/list.length:1};
    });
    const ks=Object.keys(parts), met=ks.every(k=>parts[k].share>=parts[k].need-1e-9);
    const pct=ks.length?Math.round(100*ks.reduce((a,k)=>a+Math.min(1,parts[k].partial/parts[k].need),0)/ks.length):0;
    const overdue=Object.values(mine.assigned||{}).filter(a=>!a.done&&a.due<now).length;
    const due=Object.values(items).filter(it=>it.reps&&it.due<=now).length;
    return {pct,parts,state:met?'ready':mine.wasReady?'slipping':'not',overdue,due,role};
  },
  /* Remembers that they've been ready, so dropping below the minimum later reads as Slipping. */
  note(pid){ const r=this.readiness(pid); if(!r) return r; const p=this._all(), m=this._mine(p,pid);
    if(r.state==='ready'&&!m.wasReady){ m.wasReady=Date.now(); this._saveAll(p); } return this.readiness(pid); },

  /* Today's drill for a person: assigned new wines and dishes first, then what's due (least
     remembered first), then the next new questions in list order (by the glass first), and now and
     then an unannounced re-ask of something they know (a retention check). */
  // `part` ('glass' | 'bottle' | 'dishes') drills one part of the role's minimum alone, from Today's rows.
  drill(pid,size=this.DRILL_SIZE,part=null){
    const person=this.person(pid); if(!person) return [];
    const role=person.role, kinds=this.ROLES[role].kinds, mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const sc0=this.scope(role), sc=part?{glass:part==='glass'?sc0.glass:[],bottle:part==='bottle'?sc0.bottle:[],dishes:part==='dishes'?sc0.dishes:[],cocktails:part==='cocktails'?sc0.cocktails:[]}:sc0, wines=[...sc.glass,...sc.bottle], dishes=sc.dishes, cocktails=sc.cocktails||[];
    const inPart=key=>!part||(key.startsWith('w:')?wines.some(w=>w.id===key.slice(2)):key.startsWith('c:')?cocktails.some(c=>c.id===key.slice(2)):dishes.some(x=>x.id===key.slice(2)));
    // A wine's or a cocktail's questions at the rungs this role needs for it.
    const qsFor=w=>this.qsOf(w.id).filter(q=>this.kindsFor(role,w.id).includes(q.k)), out=[], has=id=>out.some(q=>q.id===id);
    const nextFor=(qs)=>{ // the lowest open rung's first question not yet answered right
      const kk=qs.length&&qs[0].cocktail?this.kindsFor(role,qs[0].cocktail):kinds;
      for(const k of this.LADDER){ if(!this._open(qs,items,k,kk)) continue; const q=qs.find(q=>q.k===k&&!(items[q.id]&&items[q.id].reps)); if(q) return q; }
      return null;
    };
    const assigned=Object.entries(mine.assigned||{}).filter(([,a])=>!a.done).sort((a,b)=>a[1].due-b[1].due);
    assigned.forEach(([key])=>{ if(out.length>=size||!inPart(key)) return; const [t,id]=[key.slice(0,1),key.slice(2)];
      const q=nextFor(t==='w'||t==='c'?qsFor({id}):this.dishQs(id)); if(q&&!has(q.id)) out.push(q); });
    const pool=[...wines.flatMap(qsFor),...cocktails.flatMap(qsFor),...dishes.flatMap(x=>this.dishQs(x.id))];
    const byId=Object.fromEntries(pool.map(q=>[q.id,q]));
    Object.entries(items).filter(([id,it])=>byId[id]&&it.reps&&(it.wrong||it.due<=now)).sort((a,b)=>this.recall(a[1],now)-this.recall(b[1],now))
      .forEach(([id])=>{ if(out.length<size&&!has(id)) out.push(byId[id]); });
    if(out.length<size){
      const knownIds=Object.entries(items).filter(([id,it])=>byId[id]&&this.known(it,now)).map(([id])=>id);
      if(knownIds.length&&Math.random()<this.CHECK_SHARE*size){ const id=knownIds[Math.floor(Math.random()*knownIds.length)]; if(!has(id)) out.push({...byId[id],check:true}); }
    }
    for(const w of [...wines.map(w=>({qs:qsFor(w)})),...cocktails.map(c=>({qs:qsFor(c)})),...dishes.map(x=>({qs:this.dishQs(x.id)}))]){
      if(out.length>=size) break; const q=nextFor(w.qs); if(q&&!has(q.id)) out.push(q);
    }
    return out.slice(0,size);
  },

  /* Marks a typed answer: locally when it plainly matches the answer or a wording that counts,
     else by Claude against the key (prompts/team-grade.txt). {ok, score, verdict, say, missing}. */
  _norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim(); },
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
  CHOICES:10,
  choices(q){
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
    if(q.k==='recall'&&want!=='money'){ const t=this._topic(q.q); if(t){ const r=this._topicChoices(q,t,right,split); if(r) return r; } }
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
    const wrong=[...this._shuffle(alike,this._seed(q)+'a'),...this._shuffle(same,this._seed(q)+'b'),...(q.k==='recall'?[]:this._shuffle(rest,this._seed(q)+'d'))].slice(0,Math.max(0,this.CHOICES-right.length));
    const all=[...right.map(x=>({x,ok:true})),...wrong.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
    const opts=order.map(i=>this._cap(all[i].x)), rightIdx=order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0);
    return {opts,right:rightIdx,n:rightIdx.length,via:'pool'};
  },
  /* What a recall question asks about, read from its words; null when it isn't one of these. */
  _topic(text){ const t=String(text).toLowerCase();
    if(/\bname a wine\b|\bwhich wine\b|\bwhat wine\b|\bwine from (our|the) list\b/.test(t)) return 'wine';
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
    if(/\bregion\b|\bcountry\b|\bvalley\b|\barea\b|\bcounty\b|\bwhere\b/.test(t)) return 'place';
    if(/what happens/.test(t)) return 'change';
    if(/\bage\b|\bages\b|\baged\b|\bageing\b|\byoung\b|\bkept\b|how long|\bminimum\b|\btime\b/.test(t)) return 'duration';
    return null; },
  // Only lists of names are split into one pill each ("Chardonnay, Pinot Noir and Pinot Meunier"); a
  // climate, a meaning or a change is one answer, commas and all.
  SPLIT_TOPICS:['grape','flavour'],
  DECOYS:{
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
  },
  // Word sets with a plural or "-s" verb ending dropped, so "It softens" and "They soften" are one answer.
  _stems(s){ return this._words(s).filter(w=>!['it','they','its','their'].includes(w)).map(w=>w.length>4?w.replace(/(es|s)$/,''):w); },
  _topicChoices(q,topic,right,split){
    const sp=this.SPLIT_TOPICS.includes(topic)?split:(a=>[String(a||'').trim()].filter(Boolean));
    right=sp(q.ans).slice(0,3);
    const norm=x=>this._norm(x).replace(/^the /,''), seen=new Set(right.map(norm)), wines=TeamData.wines(), pool=[];
    const rightWords=new Set(right.flatMap(r=>this._words(r)));
    // A wrong pill that says the same as a right one in fewer or other words ("Grape spirit" beside
    // "Fermentation is stopped with grape spirit") isn't wrong: it's left out.
    const nums=x=>(String(x).match(/\d+/g)||[]).join(' ');
    const same=x=>{ const a=this._stems(x); return a.length&&right.some(r=>{ if(nums(r)!==nums(x)) return false; const b=new Set(this._stems(r)); return a.every(w=>b.has(w))||[...b].every(w=>a.includes(w)); }); };
    const add=x=>{ const n=norm(x); if(!n||seen.has(n)||same(x)) return; seen.add(n); pool.push(String(x).trim()); };
    // The other wines' answers to questions of this kind come first: the list's own flavours, climates, places.
    for(const w of wines){ if(w.id===q.wine) continue; for(const o of this.wineQs(w.id)) if(o.k==='recall'&&this._topic(o.q)===topic) sp(o.ans).forEach(add); }
    // A wine for a dish: the other wines on the list, the one to steer away from first, then the nearest
    // styles; never one of the dish's own pairings, which would be right too.
    if(topic==='wine'){
      const p=q.dish?TeamData.pairing(q.dish):null, ok=new Set([...(p&&p.best||[]).map(b=>b.id),p&&p.glass&&p.glass.id].filter(Boolean));
      const rw=wines.find(w=>right.some(r=>norm(r)===norm(TeamData.short(w)))), near=['sparkling','white','rosé','orange','red','sweet','fortified'];
      const dist=w=>rw?Math.abs(near.indexOf(w.type)-near.indexOf(rw.type)):0;
      const avoid=p&&p.avoid&&TeamData.wine(p.avoid.id); if(avoid&&!ok.has(avoid.id)) add(TeamData.short(avoid));
      this._shuffle(wines.filter(w=>!ok.has(w.id)&&w.id!==q.wine),this._seed(q)+'n').sort((a,b)=>dist(a)-dist(b)).forEach(w=>add(TeamData.short(w)));
      if(pool.length<4) this.offList(rw?this.kindOf(rw):'red',4-pool.length,this._seed(q)+'f').forEach(add);
      const keep=pool.slice(0,7), all=[...right.map(x=>({x,ok:true})),...keep.map(x=>({x,ok:false}))], order=this._shuffle(all.map((_,i)=>i),this._seed(q)+'c');
      return {opts:order.map(i=>this._cap(all[i].x)),right:order.map((i,j)=>all[i].ok?j:-1).filter(j=>j>=0),n:right.length};
    }
    if(topic==='year'){ const y=this._num(right[0]); if(y) [y-1,y+1,y-2,y+2,y-3,y+3].forEach(v=>add(String(v))); }
    if(topic==='duration'&&/month/i.test(right[0])) ['6 months','12 months','18 months','24 months','36 months'].forEach(add);
    if(topic==='place') wines.flatMap(w=>[w.region,w.country]).filter(Boolean).forEach(add);
    if(topic==='grape') wines.flatMap(w=>w.grapes||[]).forEach(add);
    (this.DECOYS[topic]||[]).forEach(add);
    // Like for like within a kind: a months answer against months, a valley against valleys.
    if(/month/i.test(right[0])){ const m=pool.filter(x=>/month/i.test(x)); pool.length=0; pool.push(...m); }
    if(topic==='place'&&/valley/i.test(right[0])){ ['The Rhône Valley','The Douro Valley','The Napa Valley','The Mosel Valley','The Barossa Valley'].forEach(add); const v=pool.filter(x=>/valley/i.test(x)); pool.length=0; pool.push(...v); }
    // A flavour pill that shares a word with a right one ("Black cherry" beside "Red cherry") would be unfair either way.
    const wrong=this._shuffle(pool.filter(x=>topic!=='flavour'||!this._words(x).some(w=>rightWords.has(w))),this._seed(q)+'t');
    if(wrong.length<3) return null;
    const total=Math.min(this.CHOICES,right.length+Math.max(3,Math.min(7,wrong.length)));
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
    const text=norm(q.q), B=TeamData.wines().filter(w=>w.id!==A.id&&text.includes(norm(TeamData.short(w)))).sort((x,y)=>TeamData.short(y).length-TeamData.short(x).length)[0];
    if(!B) return null;
    const right=[...new Set([q.ans,...(q.acc||[])].filter(Boolean).map(x=>String(x).trim()))].slice(0,3);
    const said=' '+norm(right.join(' '))+' ', GENERIC=new Set(['chateau','domaine','domaines','bodegas','tenuta','weingut','maison','cave','the','les','des','del','della','de','du','la','le','classico','reserva','riserva','premier','cru','grand','late','harvest','old','year','brut','reserve','nv']);
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
    if(price(A)&&price(B)&&price(A)!==price(B)) wrong.push(price(A)>price(B)?`${a} is the cheaper of the two`:`${a} costs more than ${b}`);
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
    const swapped=right.map(swap).filter(t=>!right.some(r=>norm(r)===norm(t)));
    // Only decoys about what the question asks: its grapes, its place, its price, how it's sold, its age.
    const ASPECT={style:/style|taste|flavour|body|bodied|rich|lighter|tannin|acid|sweet|dry/,grape:/grape|blend|variet/,place:/origin|where|place|region|country|come from|comes from/,price:/price|cost|cheap|dear|expensive|spend/,sold:/sold|glass|bottle|bought|pour/,age:/vintage|older|younger|age/};
    const want=Object.keys(ASPECT).filter(k=>ASPECT[k].test(norm(q.q)));
    const aspectOf=t=>{ const n=norm(t); return /bodied|tannic|tannin|acidity|sweeter|drier/.test(n)?'style':/grape/.test(n)?'grape':/ from |both from/.test(' '+n)?'place':/cheaper|costs more/.test(n)?'price':/glass|bottle only/.test(n)?'sold':/vintage/.test(n)?'age':'type'; };
    // A question about something the list can't speak to (style, legal ageing) gets its swaps alone.
    const onTopic=want.length?wrong.filter(t=>want.includes(aspectOf(t))):(swapped.length>=2?[]:wrong);
    const seen=new Set(right.map(norm)), wr=[...swapped,...onTopic,...(onTopic.length+swapped.length<2?wrong:[])].filter(x=>{ const n=norm(x); if(seen.has(n)) return false; seen.add(n); return true; });
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
    const sym=TeamData.currency().sym||'£', wines=TeamData.wines();
    const side=/\bglass\b/i.test(q.q)?'glass':/\bbottle\b/i.test(q.q)?'bottle':/glass/i.test(right[0])?'glass':'bottle';
    const fmt=n=>`${TeamData.money(n,{dp:n%1?2:0})} a ${side}`, n=this._num(right[0]); if(n==null) return null;
    // A glass question about a wine sold only by the bottle has that as its answer, said in words.
    const own=TeamData.wine(q.wine), bottleOnly=side==='glass'&&own&&!own.glass&&/bottle|not by the glass/i.test(right[0]);
    const rightText=bottleOnly?`Not by the glass: ${TeamData.money(n,{dp:n%1?2:0})} a bottle`:fmt(n);
    const prices=[...new Set(wines.map(w=>this._num(side==='glass'?w.glass:w.bottle)).filter(x=>x!=null&&x!==n))]
      .sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,this.CHOICES-1);
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
    const claims={
      tannin:/\btannin|\bgrip|\bgrippy|\bstructured?\b/.test(x)&&!/(soft|low|no|gentle|silky|light|little|without)\s+(\w+\s+)?tannin|tannin[- ]free|almost no tannin/.test(x),
      full:/full[- ]bodied|full body|\b(its|a) (full|big|bold|heavy|powerful|weighty)\b|\bheavyweight\b|\bweight to\b/.test(x),
      light:/\b(light|delicate|lean)[- ](bodied|and|wine)|\bit'?s light\b|\bit is light\b|light body/.test(x),
      sweet:/\b(its|the|of) (gentle |rich |honeyed )?sweetness\b|\bit'?s sweet\b|\bit is sweet\b|\bsweet wine\b|\bhoneyed\b|\bluscious\b/.test(x)&&!/not (too )?sweet|off-dry/.test(x),
      dry:/bone[- ]dry|\bit'?s dry\b|\bit is dry\b|\bdry wine\b/.test(x),
      bubbles:/\bbubble|\bfizz|\bsparkl|\bmousse\b/.test(x),
      acid:/high acid|\bcrisp\b|\bzesty\b|\bzippy\b|\bsharp\b|bright acid|acidity cuts|racy/.test(x),
      soft:/soft acid|low acid|gentle acid|low in acidity/.test(x),
      untannic:/almost no tannin|tannin[- ]free|no tannin|soft tannin|low tannin/.test(x),
      still:/\bstill\b/.test(x),
    };
    return (claims.tannin&&v('tannin')!=null&&v('tannin')<=1)||(claims.full&&v('body')!=null&&v('body')<=2)||(claims.light&&v('body')!=null&&v('body')>=4)
      ||(claims.sweet&&v('sweet')!=null&&v('sweet')<=1)||(claims.dry&&v('sweet')!=null&&v('sweet')>=4)||(claims.bubbles&&kind!=='sparkling')
      ||(claims.acid&&v('acid')!=null&&v('acid')<=2)||(claims.soft&&v('acid')!=null&&v('acid')>=4)||(claims.untannic&&v('tannin')!=null&&v('tannin')>=4)||(claims.still&&kind==='sparkling'); },
  /* This wine's style turned round at this table, one line per trait it sits at an end of. */
  styleWrong(st,kind,dish,seed=''){ const v=k=>typeof st[k]==='number'?st[k]:null, out=[], d=`the ${dish}`;
    const one=(...xs)=>out.push(xs[Math.abs(this._hash(String(seed)+xs[0]))%xs.length]);
    if(v('tannin')!=null&&v('tannin')<=1) one(`Its firm tannins grip the richness of ${d}`,`It has the grippy tannin to stand up to ${d}`);
    if(v('tannin')!=null&&v('tannin')>=4) one(`It has almost no tannin, so it stays soft beside ${d}`,`Its silky, tannin-free texture is gentle with ${d}`);
    if(v('body')!=null&&v('body')<=2) one(`Its full, heavy body matches the weight of ${d}`,`It's a big, powerful wine with the weight for ${d}`);
    if(v('body')!=null&&v('body')>=4) one(`It's light and delicate, so it won't overpower ${d}`,`Its light body lets ${d} take the lead`);
    if(v('sweet')!=null&&v('sweet')<=1) one(`Its sweetness balances the savoury flavours of ${d}`,`It's a sweet wine, so it softens the salt in ${d}`);
    if(v('sweet')!=null&&v('sweet')>=4) one(`It's bone dry, so it cuts straight through ${d}`,`Its dry, lean finish refreshes after ${d}`);
    if(v('acid')!=null&&v('acid')<=2) one(`Its sharp, high acidity cuts through ${d}`,`It's crisp and zesty, so it lifts ${d}`);
    if(v('acid')!=null&&v('acid')>=4) one(`Its soft, low acidity keeps it gentle with ${d}`,`It's round and low in acidity, so it never fights ${d}`);
    if(kind!=='sparkling') one(`Its bubbles scrub the palate clean between bites of ${d}`,`Its fine fizz refreshes the palate after ${d}`);
    if(kind==='sparkling') one(`It's a still, rich wine that lets ${d} take the lead`);
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
  kindOf(w){ const sec=String(w&&w.section||'').toLowerCase(); return /sweet|dessert|pudding/.test(sec)?'sweet':/fortified|port|sherry|madeira/.test(sec)?'fortified':/sparkling|fizz|champagne/.test(sec)?'sparkling':(w&&w.type)||'red'; },
  _applyChoices(q){
    const wines=TeamData.wines(), norm=x=>this._norm(x), key=(q.key||[]).map(String);
    // A sentence offers a wine when it names the wine as the list does (producer and name); a grape alone
    // ("Sauvignon Blanc", "Malbec") is a reason's word, not an offer.
    const named=s=>wines.filter(w=>{ const t=norm(s), n=norm(TeamData.short(w)); return n.length>3&&t.includes(n); });
    const own=TeamData.wine(q.wine), offered=key.flatMap(named).filter(w=>w.id!==q.wine);
    // The question naming its own wine ("…wants a glass of the Minuty") makes it that wine, whatever other
    // wine the key steers to.
    const ownInQ=own&&[TeamData.short(own),own.name].some(n=>n&&norm(q.q).includes(norm(n)));
    const rw=ownInQ||key.some(k=>named(k).some(w=>w.id===q.wine))||!offered.length?own:offered[0]; if(!rw) return null;
    const side=/\bglass\b/i.test(q.q)?'glass':/\bbottle\b/i.test(q.q)?'bottle':rw.glass?'glass':'bottle';
    // "£8 (75ml)" reads "£8 a glass (75ml)": the measure after the unit, never inside it.
    const per=(p,u)=>{ const m=String(p).match(/^(.*?)\s*(\([^)]*\))\s*$/); return m?`${m[1]} a ${u} ${m[2]}`:`${p} a ${u}`; };
    const offer=w=>{ const pr=side==='glass'&&w.glass?per(w.glass,'glass'):w.bottle?`${per(w.bottle,'bottle')}${side==='glass'?', not by the glass':''}`:w.glass?per(w.glass,'glass'):'';
      return `The ${TeamData.short(w)}${pr?`, ${pr}`:''}`; };
    // Decoys a guest could believe: the nearest styles first (sparkling beside white, rosé beside both), and
    // for a glass, wines poured by the glass, so the price alone never gives the right one away.
    const near=['sparkling','white','rosé','orange','red','sweet','fortified'], dist=w=>Math.abs(near.indexOf(this.kindOf(w))-near.indexOf(this.kindOf(rw)));
    const fit=w=>side==='glass'&&!w.glass?1:0;
    const listDecoys=this._shuffle(wines.filter(w=>w.id!==rw.id&&dist(w)<=1),this._seed(q)+'o').sort((a,b)=>dist(a)-dist(b)||fit(a)-fit(b)).slice(0,3).map(w=>({x:offer(w),ok:false}));
    // Too few wines of the kind on the list: a well-known bottle that isn't on it, priced like the list's own.
    const priceLike=side==='glass'&&rw.glass?`${rw.glass} a glass`:rw.bottle?`${rw.bottle} a bottle`:'';
    const extra=this.offList(this.kindOf(rw),3-listDecoys.length,this._seed(q)+'f').map(n=>({x:`The ${n}${priceLike?`, ${priceLike}`:''}`,ok:false}));
    const offers=[{x:offer(rw),ok:true},...listDecoys,...extra];
    // A reason as something to say: "Say it's dry" → "It's dry"; price clauses and offers dropped.
    // Serving notes (decant, temperature) and bare instructions ("Link the wine to the dish") aren't reasons.
    const reason=s=>{ if(/^(offer|suggest|recommend|pour|go for|link|name|serve)\b/i.test(s)||/\bdecant|°C|\bserve at\b/i.test(s)||named(s).length) return '';
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
    const rights=[...new Set(key.map(reason).filter(Boolean))].slice(0,2);
    if(!rights.length) return null;
    // Wrong reasons a server could believe are about this same table and wrong for this wine: what a wine of
    // another style is said to do with this dish ("Firm tannins grip the lamb" offered for a rosé), and,
    // where those run short, this wine's own style turned round at this dish (STYLE_WRONG). Never a reason
    // about another dish, another grape or a style this wine also has, since those are wrong for the wrong
    // reason or not wrong at all.
    const dishes=TeamData.dishes(), hereDish=this.dishIn(q.q), here=hereDish?[hereDish]:[];
    const hereWords=new Set(here.flatMap(d=>this._words(d.name+' '+(d.desc||''))));
    const foodWords=new Set(dishes.flatMap(d=>this._words(d.name+' '+(d.desc||''))).filter(w=>w.length>3&&!hereWords.has(w)));
    const ownGrapes=new Set(this._words([rw.grape,rw.name,(TeamData.card(rw.id)||{}).grape].join(' ')));
    const grapeWords=new Set(wines.flatMap(w=>this._words([w.grape,(TeamData.card(w.id)||{}).grape].join(' '))).filter(w=>w.length>3&&!ownGrapes.has(w)));
    const offTable=t=>this._words(t).some(w=>foodWords.has(w)||grapeWords.has(w));
    const style=(TeamData.card(rw.id)||{}).style||{}, kind=this.kindOf(rw);
    const wrongFor=t=>this.contradicts(t,style,kind);
    const seen=new Set(rights.map(norm)), wrongs=[], kept=[...rights];
    // Two reasons that say much the same thing ("Its high acidity cuts through rich fried pork" twice) count once.
    const alike=(x,y)=>{ const p=new Set(this._stems(x)), q2=this._stems(y); if(!p.size||!q2.length) return false; const both=q2.filter(w=>p.has(w)).length; return both/Math.min(p.size,q2.length)>=0.6; };
    const take=t=>{ t=t&&String(t).replace(/\.\s*$/,''); if(!t||seen.has(norm(t))||/^(yes|no)\b/i.test(t)||kept.some(k=>alike(k,t))) return; seen.add(norm(t)); kept.push(t); wrongs.push(t); };
    const borrowed=[];
    here.forEach(d=>{ const pr=TeamData.pairing(d.id)||{}; [...(pr.best||[]),pr.glass].filter(Boolean).forEach(b=>{ if(b.id!==rw.id&&b.why) borrowed.push(b.why); }); });
    wines.filter(w=>w.id!==rw.id).forEach(w=>this.wineQs(w.id).forEach(o=>{ if(o.k==='apply'&&here.some(d=>this._words(d.name).some(x=>x.length>3&&norm(o.q).split(' ').includes(x)))) (o.key||[]).forEach(k=>borrowed.push(k)); }));
    this._shuffle(borrowed,this._seed(q)+'r').forEach(k=>{ if(wrongs.length>=4) return; const t=reason(k); if(t&&!offTable(t)&&wrongFor(t)) take(t); });
    const dishName=here.length?String(here[0].name).split(',')[0].trim().toLowerCase():'dish';
    if(wrongs.length<4) this._shuffle(this.styleWrong(style,kind,dishName,this._seed(q)),this._seed(q)+'g').forEach(t=>wrongs.length<4&&take(t));
    if(wrongs.length<2) return null;
    const reasons=[...rights.map(x=>({x,ok:true})),...this._shuffle(wrongs,this._seed(q)+'w').slice(0,6-rights.length).map(x=>({x,ok:false}))];
    const o1=inQ?[]:this._shuffle(offers.map((_,i)=>i),this._seed(q)+'c1').map(i=>offers[i]), o2=this._shuffle(reasons.map((_,i)=>i),this._seed(q)+'c2').map(i=>reasons[i]);
    const all=[...o1,...o2];
    if(inQ) return {opts:all.map(a=>a.x),right:all.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:rights.length,groups:[{label:'Why it works',from:0,to:all.length,n:rights.length}]};
    return {opts:all.map(a=>a.x),right:all.map((a,j)=>a.ok?j:-1).filter(j=>j>=0),n:1+rights.length,
      groups:[{label:'What do you suggest?',from:0,to:o1.length,n:1},{label:'Why it works',from:o1.length,to:all.length,n:rights.length}]};
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
    const p=this._batchP||this._all(), m=this._mine(p,pid), it=m.items[q.id]||{s:0,d:5,reps:0,lapses:0,last:0,due:0};
    const R=this.recall(it,now);
    if(q.check) m.checks.push({at:now,ok:!!ok,id:q.id});
    if(!ok){
      it.lapses++; it.d=Math.min(10,it.d+1.5); it.wrong=true;
      // Confidently wrong comes back within hours; a known answer forgotten keeps a little of its stability.
      it.s=sure==='sure'?0.1:it.reps?Math.max(0.25,it.s*0.25):0.25;
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
    const key=q.wine?'w:'+q.wine:q.cocktail?'c:'+q.cocktail:q.dish?'d:'+q.dish:null, person=this.person(pid);
    if(key&&m.assigned[key]&&!m.assigned[key].done&&person){
      const done=q.wine||q.cocktail?this.knowsWine(pid,person.role,q.wine||q.cocktail,m.items):this.knowsDish(pid,q.dish,m.items);
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
  // Someone new starts with the whole list and menu as their first assignments.
  assignExisting(pid){ const person=this.person(pid); if(!person) return; const due=Date.now()+(TeamData.get().settings.dueDays||7)*this.DAY, p=this._all(), m=this._mine(p,pid), sc=this.scope(person.role);
    [...sc.glass,...sc.bottle].forEach(w=>{ m.assigned['w:'+w.id]=m.assigned['w:'+w.id]||{at:Date.now(),due}; });
    sc.dishes.forEach(x=>{ m.assigned['d:'+x.id]=m.assigned['d:'+x.id]||{at:Date.now(),due}; });
    (sc.cocktails||[]).forEach(c=>{ m.assigned['c:'+c.id]=m.assigned['c:'+c.id]||{at:Date.now(),due}; });
    this._saveAll(p); },
  assignments(pid){ const m=this._mine(this._all(),pid), now=Date.now();
    return Object.entries(m.assigned||{}).filter(([,a])=>!a.done).map(([k,a])=>({key:k,kind:k[0]==='w'?'wine':k[0]==='c'?'cocktail':'dish',id:k.slice(2),due:a.due,overdue:a.due<now})).sort((a,b)=>a.due-b.due); },

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
