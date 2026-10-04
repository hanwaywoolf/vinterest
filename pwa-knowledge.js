/* Vinterest — KnowledgeMap: Mastery, from what the user has studied and passed.

   Every area scores 0–100 from the same two things the Learn tab offers: reading (Written for you
   articles, beginner articles, Wine Skills guides) and quizzes (Wine Basics, region, grape and
   guide questions answered correctly). Nothing else counts, so the map shows how rounded their
   knowledge is, where the gaps are, and the next thing to read or pass in each area.

   Areas: one per wine type (its basics quiz, the grape quizzes of that colour they've unlocked,
   articles about that type), Regions and Grapes (each unlocked one: its quiz and its articles),
   and one per Wine Skills group (its guides read and questions passed, plus the matching
   beginner articles). The full map is Pro; summary() is the free teaser.

   Also here: focus() (what to study next, weighted by what they drink), the weekly history
   behind the radar's "a month ago" outline, and regionMap() for the map of regions. */
const KnowledgeMap = {
  TYPES:[
    {id:'red',label:'Red',types:['red'],topic:'red_grapes',colours:['red']},
    {id:'white',label:'White',types:['white'],topic:'white_grapes',colours:['white']},
    {id:'rose',label:'Rosé',types:['rose'],topic:'rose',colours:[]},
    {id:'sparkling',label:'Sparkling',types:['sparkling'],topic:'sparkling',colours:[]},
    {id:'orange',label:'Orange',types:['orange'],topic:'orange',colours:[]},
    {id:'sweet',label:'Sweet & Fortified',types:['dessert','fortified'],topic:'sweet_fortified',colours:['dessert','fortified']},
  ],
  // The beginner (on-ramp) articles, filed under the skill each one teaches.
  ONRAMP_GROUP:{onramp_1:'tasting',onramp_2:'tasting',onramp_3:'buying',onramp_4:'buying',onramp_5:'hosting',onramp_6:'buying',onramp_7:'hosting',onramp_8:'ordering'},
  READ_TARGET:3, // articles about a type that count as having read around it

  level(score){ return score>=100?'Mastered':score>=67?'Confident':score>=34?'Developing':score>0?'Getting started':'Not started'; },
  _frac(p){ return p&&p.total?p.correct/p.total:0; },
  _pct(x){ return Math.round(Math.max(0,Math.min(1,x))*100); },
  _read(stub){ return LearnProgress.articleDone(stub.id); },
  _shelf(wines){ try{ return ContentEngine.shelf(wines)||[]; }catch(e){ return []; } },
  // A quiz's strength (QuizMastery.freshness): answers known, fading ones at half.
  _grapeFresh(g){ const bank=grapeQuizBank(g); return bank?QuizMastery.freshness('grape:'+g,bank):{strength:0,fading:0}; },
  _grapeFrac(g){ return this._grapeFresh(g).strength; },

  _typeArea(T,wines,shelf){
    const topicP=QuizMastery.progress('topic:'+T.topic,QuizMastery.topicPool(T.topic)), topicF=QuizMastery.freshness('topic:'+T.topic,QuizMastery.topicPool(T.topic));
    const grapes=Object.keys(GrapeUnlocks.all()).filter(g=>T.colours.includes(GRAPE_TYPES[g]));
    const grapeF=grapes.length?WineDNA._mean(grapes.map(g=>this._grapeFrac(g))):0;
    const reads=shelf.filter(s=>this._read(s)&&T.types.includes(ContentEngine._subjectType(s.slots,ContentEngine._related(s.slots,wines)))).length;
    const readF=Math.min(1,reads/this.READ_TARGET);
    // Rosé, sparkling and orange have no grapes of their own colour on the list: basics and reading carry it.
    const parts=T.colours.length?[[topicF.strength,.5],[grapeF,.25],[readF,.25]]:[[topicF.strength,.6],[readF,.4]];
    const score=this._pct(parts.reduce((a,[f,w])=>a+f*w,0));
    const next=topicP.correct<topicP.total?{label:`Take the ${T.label} basics quiz`,quiz:{mode:'practice',topicId:T.topic}}
      :T.colours.length&&!grapes.length?{label:`Scan a ${T.label.toLowerCase()} to unlock its grape quiz`,nav:'camera'}
      :T.colours.length&&grapeF<1?{label:`Finish your ${T.label.toLowerCase()} grape quizzes`,nav:'learn'}
      :readF<1?{label:`Read more about your ${T.label.toLowerCase()} wines`,nav:'learn'}:null;
    return {id:T.id,group:'types',label:T.label,score,level:this.level(score),next,
      detail:`Basics ${topicP.correct}/${topicP.total}${T.colours.length?` · ${grapes.length} grape quiz${grapes.length===1?'':'zes'}`:''} · ${reads} article${reads===1?'':'s'} read`};
  },

  /* Per region or grape: 70% its quiz, 30% reading (two articles about it counts as read around it). */
  _items(kind,wines,shelf){
    const names=kind==='region'?Object.keys(RegionUnlocks.all()):Object.keys(GrapeUnlocks.all());
    return names.map(n=>{
      const f=kind==='region'?(RegionQuizBank.get(n)?QuizMastery.freshness(RegionQuizBank.setId(n),RegionQuizBank.pool(n)):{strength:0,fading:0}):this._grapeFresh(n);
      const reads=shelf.filter(s=>this._read(s)&&s.slots&&s.slots[kind]===n).length;
      const score=this._pct(f.strength*.7+Math.min(1,reads/2)*.3);
      return {name:n,score,level:this.level(score),quiz:Math.round(f.strength*100),reads,fading:f.fading||0};
    }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
  },
  _listArea(kind,wines,shelf){
    const items=this._items(kind,wines,shelf);
    const score=items.length?this._pct(WineDNA._mean(items.map(i=>i.score))/100):0;
    const weakest=[...items].sort((a,b)=>a.score-b.score)[0];
    const label=kind==='region'?'Regions':'Grapes';
    const next=!items.length?{label:`Scan a bottle to unlock your first ${kind}`,nav:'camera'}
      :weakest.score<100?{label:`Next: the ${weakest.name} quiz`,nav:'learn'}:null;
    return {id:kind+'s',group:'places',label,score,level:this.level(score),next,items,
      detail:`${items.length} of ${kind==='region'?Object.keys(KNOWLEDGE.regions).length:GRAPE_ALLOWLIST.length} unlocked`+(items.length?` · ${items.filter(i=>i.score>0).length} studied`:'')};
  },

  _skillArea(G){
    const guides=Guides.inGroup(G.id);
    const onramp=(typeof ON_RAMP!=='undefined'?ON_RAMP:[]).filter(a=>this.ONRAMP_GROUP[a.id]===G.id);
    const readN=guides.filter(g=>Guides.isRead(g.id)).length+onramp.filter(a=>onRampDone(a.id)).length;
    const readTotal=guides.length+onramp.length;
    const ps=guides.map(g=>Guides.progress(g.id)), fs=guides.map(g=>QuizMastery.freshness(Guides.setId(g.id),Guides.pool(g.id)));
    const correct=ps.reduce((a,p)=>a+p.correct,0), total=ps.reduce((a,p)=>a+p.total,0), known=fs.reduce((a,f)=>a+f.strength*f.total,0);
    const score=this._pct((readTotal?readN/readTotal:0)*.5+(total?known/total:0)*.5);
    const g=guides.find(x=>!Guides.done(x.id));
    return {id:'skill_'+G.id,group:'skills',label:G.label,score,level:this.level(score),
      next:g?{label:`${Guides.isRead(g.id)?'Answer the questions in':'Read'} "${g.title}"`,guide:g.id}:null,
      detail:`${readN}/${readTotal} read · ${correct}/${total} questions`};
  },

  compute(wines){
    wines=wines||WineHistory.getAll();
    const shelf=this._shelf(wines);
    const areas=[
      ...this.TYPES.map(T=>this._typeArea(T,wines,shelf)),
      this._listArea('region',wines,shelf), this._listArea('grape',wines,shelf),
      ...Guides.groups().map(G=>this._skillArea(G)),
    ];
    const overall=areas.length?Math.round(WineDNA._mean(areas.map(a=>a.score))):0;
    return {areas,overall,level:this.level(overall)};
  },

  /* The free teaser: overall, strongest and the biggest gap. The gap is focus(): what they drink
     most and know least, not just the lowest score. */
  summary(wines){
    wines=wines||WineHistory.getAll();
    const m=this.compute(wines);
    this.note(m);
    const sorted=[...m.areas].sort((a,b)=>b.score-a.score);
    const strongest=sorted[0]&&sorted[0].score>0?sorted[0]:null;
    return {overall:m.overall,level:m.level,strongest,gap:this.focus(wines,m)};
  },

  /* ── What to study next, weighted by what they drink ──
     Each wine type, and each region and grape they've had (open to study), is a candidate:
     the share of their wines it covers × how far from mastered it is. A region or grape counts
     ITEM_X more than a whole type once they've started studying, since "Rioja" is a clearer next
     step than "Red"; before that their type's basics come first (on a tie, the type). With no wines
     (or everything they drink mastered) it's the lowest-scoring area, as before. Returns
     {label, score, level, why, next, area}. */
  ITEM_X:1.5,
  focus(wines,m){
    wines=wines||WineHistory.getAll(); m=m||this.compute(wines);
    const n=wines.length, cands=[];
    if(n){
      this.TYPES.forEach(T=>{
        const c=wines.filter(w=>T.types.includes(WineDNA._t(w.type))).length, a=m.areas.find(x=>x.id===T.id);
        if(c&&a&&a.score<100) cands.push({area:a,label:T.label,score:a.score,level:a.level,w:c/n*(100-a.score),next:a.next,
          why:`${c} of your ${n} wine${n===1?' is':'s are'} ${T.label.toLowerCase()}${a.score?`, and you're at ${a.score}% there`:`, and you haven't studied ${T.label.toLowerCase()} yet`}.`});
      });
      [['region','regions'],['grape','grapes']].forEach(([kind,id])=>{
        const a=m.areas.find(x=>x.id===id); if(!a) return;
        const counts={};
        wines.forEach(w=>{
          const names=kind==='region'?[WineDNA.region(w)]:[...new Set((w.grapes||[]).map(g=>WineDNA.grape(g)))];
          names.filter(Boolean).forEach(x=>{ counts[x]=(counts[x]||0)+1; });
        });
        Object.entries(counts).forEach(([name,c])=>{
          const it=a.items.find(i=>i.name===name); if(!it||it.score>=100) return;
          const had=c===1?(kind==='region'?`a wine from ${name}`:`a ${name}`):`${c} ${kind==='region'?`wines from ${name}`:`${name} wines`}`;
          cands.push({area:a,label:name,kind,score:it.score,level:it.level,w:c/n*(100-it.score)*(m.overall>0?this.ITEM_X:1),
            next:{label:`Take the ${name} quiz`,[kind]:name},
            why:`You've had ${had}${it.score?`, and you're at ${it.score}% there`:` and haven't studied it yet`}.`});
        });
      });
    }
    const best=cands.sort((a,b)=>b.w-a.w||!!a.kind-!!b.kind||a.score-b.score)[0];
    if(best&&best.w>0){ const {w,...out}=best; return out; }
    const drinks=new Set(wines.map(w=>WineDNA._t(w.type)));
    const mine=a=>{ const T=this.TYPES.find(t=>t.id===a.id); return T&&T.types.some(t=>drinks.has(t))?0:1; };
    const a=[...m.areas].sort((x,y)=>x.score-y.score||mine(x)-mine(y))[0];
    return a?{area:a,label:a.label,score:a.score,level:a.level,next:a.next,why:null}:null;
  },

  /* ── History: one snapshot a week, so Mastery can show how their shape has changed ──
     vinterest_mastery_history: {"<Monday, YYYY-MM-DD>": {t, o (overall), a: {areaId: score}}}.
     Written when Mastery's numbers are worked out (Learn, Home, the Mastery screen), only when
     this week's entry would change. Synced and backed up as progress (Backup._combine keeps the
     higher of each number when two phones disagree). */
  HISTORY_KEY:'vinterest_mastery_history', HISTORY_WEEKS:52, THEN_DAYS:28, DAY:864e5,
  _week(t){ const d=new Date(t); d.setDate(d.getDate()-(d.getDay()+6)%7); const z=x=>String(x).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`; },
  history(){ const h=Store.getJSON(this.HISTORY_KEY,{}); return h&&typeof h==='object'&&!Array.isArray(h)?h:{}; },
  note(m,now=Date.now()){
    const h=this.history(), wk=this._week(now), a={};
    m.areas.forEach(x=>{ a[x.id]=x.score; });
    const cur=h[wk];
    if(cur&&cur.o===m.overall&&JSON.stringify(cur.a)===JSON.stringify(a)) return;
    h[wk]={t:now,o:m.overall,a};
    const keep=Object.keys(h).sort().slice(-this.HISTORY_WEEKS), out={};
    keep.forEach(k=>{ out[k]=h[k]; });
    Store.setJSON(this.HISTORY_KEY,out);
  },
  /* The snapshot to compare with: the latest at least THEN_DAYS old, else (for someone newer)
     the oldest at least a week old. Null in their first week. */
  then(now=Date.now()){
    const all=Object.values(this.history()).filter(e=>e&&e.t>0&&e.a).sort((x,y)=>x.t-y.t);
    const old=all.filter(e=>e.t<=now-this.THEN_DAYS*this.DAY);
    const e=old.length?old[old.length-1]:all.find(x=>x.t<=now-7*this.DAY);
    return e?{...e,weeks:Math.max(1,Math.round((now-e.t)/(7*this.DAY)))}:null;
  },
  /* How they've moved since then(): the overall change and the areas that rose, biggest first. */
  progress(m,now=Date.now()){
    const p=this.then(now); if(!p) return null;
    const rises=m.areas.map(a=>({id:a.id,label:a.label,delta:a.score-(p.a[a.id]||0)})).filter(x=>x.delta>0).sort((x,y)=>y.delta-x.delta);
    return {then:p,weeks:p.weeks,overall:m.overall-(p.o||0),rises};
  },
  /* Question sets with answers fading (QuizMastery.isDue), most first: Home's "Refresh" step and
     the map's faded pins. Only sets with at least FADE_SUGGEST_AT fading, so one stray answer
     doesn't nag. Each carries the learn item that opens its quiz (Home's _openLearn). */
  FADE_SUGGEST_AT:2,
  refreshers(now=Date.now()){
    const out=[], add=(label,setId,pool,learn,extra)=>{ if(!pool||!pool.length) return; const f=QuizMastery.freshness(setId,pool,now);
      if(f.fading>=this.FADE_SUGGEST_AT) out.push({label,fading:f.fading,total:f.total,learn,...(extra||{})}); };
    (typeof QUIZ_TOPICS!=='undefined'?QUIZ_TOPICS:[]).forEach(t=>add(`${t.label} basics`,'topic:'+t.id,QuizMastery.topicPool(t.id),{kind:'mastery',next:{quiz:{mode:'practice',topicId:t.id}}}));
    Object.keys(RegionUnlocks.all()).forEach(r=>{ if(RegionQuizBank.get(r)) add(r,RegionQuizBank.setId(r),RegionQuizBank.pool(r),{kind:'region',region:r},{region:r}); });
    Object.keys(GrapeUnlocks.all()).forEach(g=>{ const bank=grapeQuizBank(g); if(bank) add(g,'grape:'+g,bank,{kind:'grape',grape:g}); });
    Guides.all().forEach(g=>add(g.title,Guides.setId(g.id),Guides.pool(g.id),{kind:'mastery',next:{quiz:{mode:'guide',guideId:g.id}}}));
    return out.sort((a,b)=>b.fading-a.fading||a.label.localeCompare(b.label));
  },

  /* Radar labels: short enough to sit around the shape on a phone. */
  short(a){ return {sweet:'Sweet',skill_ordering:'Ordering',skill_pairing:'Pairing'}[a.id]||a.label; },

  /* ── The region map ──
     data/world-map.json holds one drawing per view (scripts/world-map.mjs), Mercator in a w-wide
     box; each knowledge-base region has its pin at `at` [lat, lng]. A pin is 'open' (unlocked:
     its score and level), 'held' (unlocked past the free allowance, kept for Pro) or 'locked'
     (scan a bottle from there), and `drunk` counts their wines from it. */
  _map:null,
  views(){ if(!this._map){ try{ this._map=_loadJSON('data/world-map.json').views; }catch(e){ this._map=[]; } } return this._map; },
  project(v,at){
    const rad=d=>d*Math.PI/180, Y=lat=>Math.log(Math.tan(Math.PI/4+rad(lat)/2));
    const [w,,e,n]=v.box, k=v.w/rad(e-w);
    return [k*rad(at[1]-w), k*(Y(n)-Y(at[0]))];
  },
  _inside(v,at){ return at[1]>=v.box[0]&&at[1]<=v.box[2]&&at[0]>=v.box[1]&&at[0]<=v.box[3]; },
  regionMap(wines,m){
    wines=wines||WineHistory.getAll(); m=m||this.compute(wines);
    const area=m.areas.find(a=>a.id==='regions'), items={};
    (area?area.items:[]).forEach(i=>{ items[i.name]=i; });
    const held=new Set(RegionUnlocks.held()), drunk={};
    wines.forEach(w=>{ const r=WineDNA.region(w); if(r) drunk[r]=(drunk[r]||0)+1; });
    const regions=Object.entries(KNOWLEDGE.regions).filter(([,r])=>Array.isArray(r.at));
    return this.views().map(v=>{
      const pins=regions.filter(([,r])=>this._inside(v,r.at)).map(([name,r])=>{
        const it=items[name], [x,y]=this.project(v,r.at);
        return {name,country:r.country,x,y,state:it?'open':held.has(name)?'held':'locked',
          score:it?it.score:0,level:it?it.level:'Not started',drunk:drunk[name]||0,fading:it?it.fading:0};
      });
      return {...v,pins,open:pins.filter(p=>p.state==='open').length,drunk:pins.filter(p=>p.drunk).length};
    });
  },
  /* ── The grape cluster ──
     Every grape on the Learn list as a berry, in two bunches by skin (red; white with the
     pink-skinned ones), each berry sized by its mastery. grapeCluster() is the data: per grape
     its state ('open' unlocked, 'held' kept for Pro, 'locked' not yet met), score, level,
     fading answers and profile, placed in a fixed spot of its bunch. Spots come from
     bunchSlots(n): berries scattered inside a bunch outline (not rows), in units of one berry's
     radius, seeded so the same every time; grapes take spots in an order seeded by their name,
     so nothing reshuffles between visits and a berry grows in its own place without moving its
     neighbours. Works the same for a few hundred grapes. */
  _seed(str){ let h=2166136261; for(const ch of String(str)){ h^=ch.codePointAt(0); h=Math.imul(h,16777619); } return h>>>0; },
  _rng(seed){ let x=this._seed(seed)||1; return ()=>{ x^=x<<13; x^=x>>>17; x^=x<<5; return (x>>>0)/4294967296; }; },
  /* A bunch's outline: its half-width at depth t (0 the shoulders, 1 the tip), rounded at the
     top and tapering to a point. */
  _bunchW(t){ return Math.sin(Math.PI/2*Math.min(1,(t+0.04)/0.26))*Math.pow(Math.max(0,1-t),0.85); },
  /* n berries (radius 1) scattered inside a bunch outline sized so they cover `fill` of it:
     each placed in the most open of a few seeded candidate spots, then nudged apart until
     neighbours just touch. Organic, not rows, and the same every time for the same n and seed. */
  _bunchCache:{},
  bunchSlots(n,opts={}){
    const fill=opts.fill||0.8, seed=opts.seed||'bunch', key=n+'|'+fill+'|'+seed;
    if(this._bunchCache[key]) return this._bunchCache[key];
    if(!n) return {slots:[],w:0,h:0};
    let I=0; for(let i=0;i<100;i++) I+=this._bunchW((i+0.5)/100)/100;
    const ASPECT=2.3, a=Math.sqrt(n*Math.PI/fill/(2*ASPECT*I)), h=ASPECT*a, rnd=this._rng(seed+n);
    const room=y=>a*this._bunchW(y/h)-0.6;
    const inside=(x,y)=>y>=0.6&&y<=h-0.6&&Math.abs(x)<=Math.max(0,room(y));
    const pts=[{x:0,y:1}];
    const sample=()=>{ for(let i=0;i<200;i++){ const x=(rnd()*2-1)*a, y=rnd()*h; if(inside(x,y)) return {x,y}; } return {x:0,y:h/2}; };
    while(pts.length<n){
      let best=null, bd=-1;
      for(let c=0;c<24;c++){ const p=sample(); let d=1e9; for(const q of pts){ const e=(p.x-q.x)**2+(p.y-q.y)**2; if(e<d) d=e; } if(d>bd){ bd=d; best=p; } }
      pts.push(best);
    }
    const GAP=1.86;
    for(let it=0;it<60;it++){
      for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
        const p=pts[i], q=pts[j], dx=q.x-p.x, dy=q.y-p.y, d=Math.hypot(dx,dy)||0.01;
        if(d<GAP){ const m=(GAP-d)/2, ux=dx/d, uy=dy/d; p.x-=ux*m; p.y-=uy*m; q.x+=ux*m; q.y+=uy*m; }
      }
      pts.forEach(p=>{ p.y=Math.min(h-0.6,Math.max(0.6,p.y)); const r=Math.max(0,room(p.y)); p.x=Math.max(-r,Math.min(r,p.x)); });
    }
    const minY=Math.min(...pts.map(p=>p.y)), maxY=Math.max(...pts.map(p=>p.y)), xs=pts.map(p=>p.x);
    const out={slots:pts.map(p=>({x:+p.x.toFixed(3),y:+(p.y-minY).toFixed(3)})),w:Math.max(...xs)-Math.min(...xs)+2,h:maxY-minY+2};
    return this._bunchCache[key]=out;
  },
  /* Mastery's list view of the same grapes: each bunch's grapes in order of progress (highest
     score first, then unlocked but not started, then kept for Pro, then not unlocked), by name
     within each. */
  grapeRows(c){
    const rank=g=>g.state==='open'?(g.score>0?0:1):g.state==='held'?2:3;
    return (c||this.grapeCluster()).bunches.map(b=>({id:b.id,label:b.label,
      grapes:[...b.grapes].sort((p,q)=>rank(p)-rank(q)||q.score-p.score||p.name.localeCompare(q.name))}));
  },
  grapeCluster(m){
    m=m||this.compute();
    const area=m.areas.find(a=>a.id==='grapes'), items={};
    (area?area.items:[]).forEach(i=>{ items[i.name]=i; });
    const held=new Set(GrapeUnlocks.held());
    const grapes=GRAPE_ALLOWLIST.map(g=>{
      const it=items[g], K=KNOWLEDGE.grapes&&KNOWLEDGE.grapes[g];
      return {name:g,skin:grapeSkin(g),state:it?'open':held.has(g)?'held':'locked',score:it?it.score:0,
        level:it?it.level:'Not started',fading:it?it.fading||0:0,profile:K?K.profile:null};
    });
    const bunch=(id,label,list)=>{
      const sorted=[...list].sort((a,b)=>this._seed(a.name)-this._seed(b.name)), L=this.bunchSlots(sorted.length,{seed:id});
      return {id,label,...L,grapes:sorted.map((g,i)=>({...g,...L.slots[i]}))};
    };
    const studied=grapes.filter(g=>g.score>0).length, mastered=grapes.filter(g=>g.score>=100).length;
    return {bunches:[bunch('red','Red grapes',grapes.filter(g=>g.skin==='red')),bunch('white','White grapes',grapes.filter(g=>g.skin!=='red'))],
      total:grapes.length,studied,mastered,open:grapes.filter(g=>g.state==='open').length};
  },

  /* The view to open on: the one with the most regions they've unlocked or drunk. */
  /* Mastery's region list for one map view: most progress first (as grapeRows), then kept for
     Pro, then not unlocked, by name within each. */
  regionRows(view){
    const rank=p=>p.state==='open'?(p.score>0?0:1):p.state==='held'?2:3;
    return [...((view&&view.pins)||[])].sort((a,b)=>rank(a)-rank(b)||(b.score||0)-(a.score||0)||a.name.localeCompare(b.name));
  },
  /* Regions on the map overall (a region can sit in more than one view): {open, total}. */
  mapCount(views){
    const all={}; (views||[]).forEach(v=>v.pins.forEach(p=>{ all[p.name]=all[p.name]||p.state==='open'; }));
    const names=Object.keys(all); return {open:names.filter(n=>all[n]).length,total:names.length};
  },
  homeView(views){ return [...views].sort((a,b)=>(b.open+b.drunk)-(a.open+a.drunk))[0]||null; },
};

/* Milestones: the moments worth marking in Mastery and Palate, worked out from the same numbers
   (nothing new is asked): a wine type or skill reaching Confident or Mastered, a region or grape mastered, regions
   studied (1, 5, 10, 20), overall knowledge at 25/50/75/100%, and a palate that counts in full
   (Palate.FULL_AT Blind Calls) or reaches Confident. vinterest_milestones holds {id: {at, title,
   icon}}, synced and backed up as progress; check() records new ones and returns them so the
   screen can mark the moment once (the quiz result, or Mastery). The first check on a phone
   files what they'd already reached at 0 ("earlier"), so nobody is flooded with old news. */
const Milestones = {
  KEY:'vinterest_milestones',
  REGION_STEPS:[1,5,10,20], OVERALL_STEPS:[25,50,75,100],
  seen(){ const v=Store.getJSON(this.KEY,null); return v&&typeof v==='object'&&!Array.isArray(v)?v:null; },
  /* Every milestone reached now: {id, title, sub, icon}. */
  reached(m,palate){
    const out=[];
    // Regions and Grapes average only what's unlocked, so one studied region would read as
    // "Confident in Regions": they get counts and per-item mastery instead.
    m.areas.filter(a=>!a.items).forEach(a=>{
      const what=a.group==='types'?`${a.label} wine`:a.label;
      if(a.score>=67) out.push({id:`area:${a.id}:confident`,title:`Confident in ${what}`,sub:a.detail,icon:'star'});
      if(a.score>=100) out.push({id:`area:${a.id}:mastered`,title:`Mastered ${what}`,sub:a.detail,icon:'trophy'});
    });
    const regions=(m.areas.find(a=>a.id==='regions')||{items:[]}).items;
    regions.filter(i=>i.score>=100).forEach(i=>out.push({id:`region:${i.name}:mastered`,title:`Mastered ${i.name}`,sub:'Its quiz passed and read around',icon:'globe',region:i.name}));
    const grapes=(m.areas.find(a=>a.id==='grapes')||{items:[]}).items;
    grapes.filter(i=>i.score>=100).forEach(i=>out.push({id:`grape:${i.name}:mastered`,title:`Mastered ${i.name}`,sub:'Its quiz passed and read around',icon:'star'}));
    const studied=regions.filter(i=>i.score>0).map(i=>i.name), names=xs=>xs.length>3?`${xs.slice(0,3).join(', ')} and ${xs.length-3} more`:xs.join(', ');
    this.REGION_STEPS.filter(k=>studied.length>=k).forEach(k=>out.push({id:`regions:${k}`,title:k===1?'Your first region studied':`${k} regions studied`,sub:names(studied.slice(0,k)),icon:'globe',...(k===1?{region:studied[0]}:{})}));
    this.OVERALL_STEPS.filter(k=>m.overall>=k).forEach(k=>out.push({id:`overall:${k}`,title:`Wine knowledge ${k}%`,sub:KnowledgeMap.level(k),icon:'book'}));
    if(palate){
      if(palate.n>=Palate.FULL_AT) out.push({id:'palate:full',title:`${Palate.FULL_AT} Blind Calls played`,sub:'Your palate score now counts in full',icon:'wine'});
      if(palate.score>=67) out.push({id:'palate:confident',title:'A confident palate',sub:`Your Blind Calls average ${palate.accuracy}% accurate`,icon:'wine'});
    }
    return out;
  },
  /* Records what's newly reached and returns it (empty on the very first check). Each is kept
     with its title, so it stays earned even if a score later falls (a quiz reset). */
  check(m,palate,now=Date.now()){
    const all=this.reached(m,palate), seen=this.seen(), first=!seen, s=seen||{};
    const fresh=all.filter(x=>!(x.id in s));
    if(!fresh.length&&!first) return [];
    fresh.forEach(x=>{ s[x.id]={at:first?0:now,title:x.title,icon:x.icon,...(x.region?{region:x.region}:{})}; });
    Store.setJSON(this.KEY,s);
    return first?[]:fresh;
  },
  /* What they've reached, newest first, with when (0: before milestones were kept). */
  list(){
    const s=this.seen()||{};
    return Object.entries(s).filter(([,v])=>v&&v.title).map(([id,v])=>({id,...v})).sort((a,b)=>b.at-a.at||a.title.localeCompare(b.title));
  },
  shareText(x){ return `${x.title} on Vinterest 🍷`; },
};

