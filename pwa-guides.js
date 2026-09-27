/* Vinterest — Guides: the Wine Skills guides on the Learn tab.

   Short practical guides for the moments people feel unsure about (tasting, ordering out, buying,
   food pairing, hosting), written once with checked facts in data/guides.json, so they cost
   nothing per reader. Each has three questions (a QuizMastery set, 'guide:<id>'), one line
   computed from the reader's own wines (personal()), and something to try in the app. A guide is
   finished once it's read and every question has been answered correctly. */
let GUIDE_DATA={groups:[],guides:[]};
try{ GUIDE_DATA=_loadJSON('data/guides.json')||GUIDE_DATA; }catch(e){ console.error('[Vinterest] guides.json failed to load — Wine Skills will be empty until it is deployed.',e); }

const Guides = Object.assign(_accountStore('vinterest_guides_v1'), {
  fresh(){ return {read:{}}; },
  groups(){ return GUIDE_DATA.groups||[]; },
  group(id){ return this.groups().find(g=>g.id===id)||{id,label:id}; },
  all(){ return GUIDE_DATA.guides||[]; },
  byId(id){ return this.all().find(g=>g.id===id)||null; },
  inGroup(groupId){ return this.all().filter(g=>g.group===groupId); },

  isRead(id){ return !!this.get().read[id]; },
  markRead(id){ const d=this.get(); if(!d.read[id]){ d.read[id]=Date.now(); this.save(d); } },
  setId(id){ return 'guide:'+id; },
  pool(id){ const g=this.byId(id); return g?g.questions:[]; },
  progress(id){ return QuizMastery.progress(this.setId(id),this.pool(id)); },
  passed(id){ return QuizMastery.isComplete(this.setId(id),this.pool(id)); },
  done(id){ return this.isRead(id)&&this.passed(id); },

  /* Unfinished guides, taking one from each group in turn so the first few cover different skills. */
  queue(){
    const lists=this.groups().map(g=>this.inGroup(g.id).filter(x=>!this.done(x.id)));
    const out=[];
    for(let i=0;lists.some(l=>l[i]);i++) lists.forEach(l=>{ if(l[i]) out.push(l[i]); });
    return out;
  },
  finished(){ return this.all().filter(g=>this.done(g.id)); },

  /* The type they drink most, and its WineDNA profile: the personal lines speak about that. */
  _main(wines){
    const counts={}; wines.filter(w=>WineDNA.chosen(w)).forEach(w=>{ const t=WineDNA._t(w.type); if(t) counts[t]=(counts[t]||0)+1; });
    const k=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(e=>e[0])[0];
    return k?WineDNA.profile(k,wines,ContentEngine._typeLabel(k)):null;
  },
  /* What goes with a wine, from its type and style. */
  foodsFor(w){
    const t=WineDNA._t(w.type), v=k=>WineDNA.level(WineDNA.axisValue(w,k));
    if(t==='red') return v('tannins')==='high'?'steak, lamb or a hard cheese':v('body')==='low'?'roast chicken, mushrooms or salmon':'roast pork, pizza or a burger';
    if(t==='white') return v('body')==='high'||v('texture')==='high'?'roast chicken or a creamy pasta':v('acidity')==='high'?'seafood, goat\'s cheese or a salad':'white fish, chicken or a soft cheese';
    return {rose:'salads, grilled fish or tapas',sparkling:'fried food, salty snacks or sushi',orange:'spiced dishes or a hard cheese',
      dessert:'blue cheese or a fruit tart',fortified:'nuts, chocolate or blue cheese'}[t]||'a meal of similar weight';
  },
  /* One line about the reader, from their own wines, or null when there's nothing to say yet. */
  personal(guide,wines){
    wines=wines||WineHistory.getAll();
    const p=this._main(wines), rc=Regional.current();
    if(!guide||!guide.personal||!p) return null;
    const L=p.label.toLowerCase();
    if(guide.personal==='palate'){
      const words=p.axes.filter(p.showAxis).map(k=>`${WineDNA.AXES[k].name.toLowerCase()} ${WineDNA.AXES[k][WineDNA.level(p.avg[k])].toLowerCase()}`);
      return words.length?`The ${L} you choose read as ${p.personality}: ${words.join(', ')}. Those are your words to use.`:null;
    }
    if(guide.personal==='budget'||guide.personal==='value'){
      const verdict=guide.personal==='value'&&p.value&&p.value.verdict;
      if(verdict) return verdict.text;
      const b=SommelierScript.budget(p.wines,rc);
      return b?`You usually spend ${b} on ${L}.`:null;
    }
    if(guide.personal==='script') return `Your ${L} sommelier script is ready in WineDNA, under Scripts: it says all of this for you.`;
    if(guide.personal==='pairing'){
      const top=[...p.scored].sort((a,b)=>b.rating-a.rating)[0];
      return top?`Your top-scored ${(WineDNA.NOUNS[p.typeKey]||['wine'])[0]}, ${top.name} (${top.rating}): try it with ${this.foodsFor(top)}.`:null;
    }
    return null;
  },
});
