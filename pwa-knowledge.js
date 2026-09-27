/* Vinterest — KnowledgeMap: Mastery, from what the user has studied and passed.

   Every area scores 0–100 from the same two things the Learn tab offers: reading (Written for you
   articles, beginner articles, Wine Skills guides) and quizzes (Wine Basics, region, grape and
   guide questions answered correctly). Nothing else counts, so the map shows how rounded their
   knowledge is, where the gaps are, and the next thing to read or pass in each area.

   Areas: one per wine type (its basics quiz, the grape quizzes of that colour they've unlocked,
   articles about that type), Regions and Grapes (each unlocked one: its quiz and its articles),
   and one per Wine Skills group (its guides read and questions passed, plus the matching
   beginner articles). The full map is Pro; summary() is the free teaser. */
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
  _read(stub){ return !!localStorage.getItem('vinterest_gen_article_'+stub.id+'_done'); },
  _shelf(wines){ try{ return ContentEngine.shelf(wines)||[]; }catch(e){ return []; } },
  _grapeFrac(g){ const bank=grapeQuizBank(g); return bank?this._frac(QuizMastery.progress('grape:'+g,bank)):0; },

  _typeArea(T,wines,shelf){
    const topicP=QuizMastery.progress('topic:'+T.topic,QuizMastery.topicPool(T.topic));
    const grapes=Object.keys(GrapeUnlocks.all()).filter(g=>T.colours.includes(GRAPE_TYPES[g]));
    const grapeF=grapes.length?WineDNA._mean(grapes.map(g=>this._grapeFrac(g))):0;
    const reads=shelf.filter(s=>this._read(s)&&T.types.includes(ContentEngine._subjectType(s.slots,ContentEngine._related(s.slots,wines)))).length;
    const readF=Math.min(1,reads/this.READ_TARGET);
    // Rosé, sparkling and orange have no grapes of their own colour on the list: basics and reading carry it.
    const parts=T.colours.length?[[topicP.total?this._frac(topicP):0,.5],[grapeF,.25],[readF,.25]]:[[this._frac(topicP),.6],[readF,.4]];
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
      const quiz=kind==='region'?this._frac(RegionQuizBank.get(n)&&RegionQuizBank.progress(n)):this._grapeFrac(n);
      const reads=shelf.filter(s=>this._read(s)&&s.slots&&s.slots[kind]===n).length;
      const score=this._pct(quiz*.7+Math.min(1,reads/2)*.3);
      return {name:n,score,level:this.level(score),quiz:Math.round(quiz*100),reads};
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
    const ps=guides.map(g=>Guides.progress(g.id));
    const correct=ps.reduce((a,p)=>a+p.correct,0), total=ps.reduce((a,p)=>a+p.total,0);
    const score=this._pct((readTotal?readN/readTotal:0)*.5+(total?correct/total:0)*.5);
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

  /* The free teaser: overall, strongest and the biggest gap. */
  summary(wines){
    const m=this.compute(wines);
    const sorted=[...m.areas].sort((a,b)=>b.score-a.score);
    const strongest=sorted[0]&&sorted[0].score>0?sorted[0]:null;
    // On a tie (everything at 0% for someone new), the gap is a type they actually drink.
    const drinks=new Set((wines||WineHistory.getAll()).map(w=>WineDNA._t(w.type)));
    const mine=a=>{ const T=this.TYPES.find(t=>t.id===a.id); return T&&T.types.some(t=>drinks.has(t))?0:1; };
    const gap=[...m.areas].sort((a,b)=>a.score-b.score||mine(a)-mine(b))[0]||null;
    return {overall:m.overall,level:m.level,strongest,gap};
  },
};
