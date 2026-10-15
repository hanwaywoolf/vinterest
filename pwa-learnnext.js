/* Vinterest — LearnNext: what to learn after a scan, from the wine in hand.

   Shown on the "Keep learning" step after rating or saving a wine. In order, and only what isn't
   finished: the Wine Basics topic for its type, its region, its grape, the next beginner article,
   then unread articles about this region or grape. A region or grape past the free allowance
   comes back as a Pro tile ("Unlock with Pro"). Each tile says why it's there. */
const LearnNext = {
  TYPE_TOPIC:{red:'red_grapes',white:'white_grapes',rose:'rose',sparkling:'sparkling',orange:'orange',dessert:'sweet_fortified',fortified:'sweet_fortified'},
  MAX:5,

  _topicTile(wine){
    const t=WineDNA._t(wine.type), id=this.TYPE_TOPIC[t];
    const topic=id&&QUIZ_TOPICS.find(x=>x.id===id);
    if(!topic) return null;
    const pool=QuizMastery.topicPool(id), p=QuizMastery.progress('topic:'+id,pool);
    if(p.total&&p.correct===p.total) return null;
    return {kind:'topic',key:'topic:'+id,icon:topic.iconName||'wine',col:topic.color,title:`${topic.label}: the basics`,
      why:`You're drinking ${t==='rose'?'a rosé':t==='sparkling'?'a sparkling wine':`a ${t==='dessert'||t==='fortified'?t+' wine':t}`}. ${topic.desc}.`,
      progress:p.correct?`${p.correct}/${p.total} answered`:`${p.total} questions`,config:{mode:'practice',topicId:id}};
  },

  _regionTile(wine){
    const r=Regions.resolve(wine); if(!r) return null;
    const K=KNOWLEDGE.regions[r]||{};
    if(!RegionUnlocks.isUnlocked(r)) return {kind:'region',key:'region:'+r,locked:'regions',icon:'map',title:r,why:`Where this wine is from. You've used your ${FREE_REGION_CAP} free regions.`};
    if(RegionQuizBank.isComplete(r)) return null;
    const p=RegionQuizBank.get(r)&&RegionQuizBank.progress(r);
    return {kind:'region',key:'region:'+r,region:r,icon:'map',title:`${r} quiz`,
      why:`Where this wine is from: ${[(K.keyGrapes||[]).slice(0,2).join(' and '),K.classification].filter(Boolean).join(', ')}.`,
      progress:p&&p.correct?`${p.correct}/${p.total} answered`:null};
  },

  _grapeTile(wine){
    const g=GrapeUnlocks.key((wine.grapes||[])[0]); if(!g) return null;
    const lead=wine.blend||(wine.grapes||[]).length>1?' leads this blend':' is the grape in this wine';
    if(!GrapeUnlocks.isUnlocked(g)){
      // A guessed grape isn't unlocked by the scan; only offer Pro when the free allowance is the reason.
      const capped=!Entitlement.isPro()&&GrapeUnlocks.count()>=FREE_GRAPE_CAP;
      return capped&&wine.grapes_basis!=='typical'?{kind:'grape',key:'grape:'+g,locked:'grape-library',icon:'grape',title:g,why:`${g}${lead}. You've used your ${FREE_GRAPE_CAP} free grapes.`}:null;
    }
    if(grapeQuizComplete(g)) return null;
    const bank=grapeQuizBank(g), p=bank&&QuizMastery.progress('grape:'+g,bank);
    return {kind:'grape',key:'grape:'+g,grape:g,icon:'grape',title:`${g} quiz`,why:`${g}${lead}: what it tastes like, and why.`,
      progress:p&&p.correct?`${p.correct}/${p.total} answered`:null};
  },

  _onRampTile(){
    const list=typeof ON_RAMP!=='undefined'?ON_RAMP:[];
    const i=list.findIndex(a=>!LearnProgress.onRampDone(a.id));
    if(i<0) return null;
    const a=list[i];
    return {kind:'onramp',key:'onramp:'+a.id,idx:i,icon:'book',title:a.title,why:a.subtitle,progress:a.readTime?`${a.readTime} read`:null};
  },

  _articleTiles(wine,wines){
    try{ ContentEngine.refreshShelf(wines,6); }catch(e){}
    const r=Regions.resolve(wine)||wine.region, g=GrapeUnlocks.key((wine.grapes||[])[0]);
    const shelf=ContentEngine.openShelf(wines);
    return shelf.filter(s=>!LearnProgress.articleDone(s.id)&&!ContentEngine.stubLocked(s)
        &&s.slots&&((r&&s.slots.region===r)||(g&&s.slots.grape===g)))
      .map(s=>({kind:'article',key:'article:'+s.id,stub:s,icon:s.iconName||'read',title:s.title,why:s.subtitle,progress:`Written for you${s.readTime?` · ${s.readTime} read`:''}`}));
  },

  /* Home's "Up next": one main thing to do and two more. A first scan for someone with no wines;
     then the next unread Written for you piece, the next beginner article (unless they skip the
     on-ramp), a refresher for the set whose answers have faded most (KnowledgeMap.refreshers), the step that closes their biggest Mastery gap (KnowledgeMap.focus: what they drink most and know least), and the next Wine Skills guide. */
  home(wines){
    wines=wines||WineHistory.getAll();
    const out=[];
    if(!wines.length) out.push({kind:'scan',key:'scan',icon:'camera',title:'Scan your first bottle',why:'Your match, your WineDNA and the pieces written for you all start from a label.'});
    // The match is the reason to scan, so until the type they drink most has TasteMatch.MIN_SCORED
    // rated wines the first thing on Home is that meter: rate what's waiting, or scan a bottle.
    const m=this._matchTile(wines); if(m) out.push(m);
    const unread=(()=>{ try{ return ContentEngine.openShelf(wines).filter(s=>!LearnProgress.articleDone(s.id)&&!ContentEngine.stubLocked(s)); }catch(e){ return []; } })();
    if(unread[0]) out.push({kind:'article',key:'article:'+unread[0].id,stub:unread[0],icon:unread[0].iconName||'read',title:unread[0].title,why:ContentEngine.because(unread[0],wines),progress:`Written for you${unread[0].readTime?` · ${unread[0].readTime}`:''}`});
    // The beginner series leads for a beginner; someone who has rated MIN_SCORED wines of a type
    // is past "what is acidity", so for them it waits behind the pieces written for them and their gap.
    const onRamp=UserPrefs.skipsOnRamp()?null:this._onRampTile();
    if(onRamp&&!this._seasoned(wines)) out.push(onRamp);
    // Answers fading (past their review date): the set that's faded most, as a quick refresher.
    const fade=(()=>{ try{ return KnowledgeMap.refreshers()[0]; }catch(e){ return null; } })();
    if(fade) out.push({...fade.learn,key:'refresh:'+fade.label,icon:'bolt',title:`Refresh ${fade.label}`,
      why:`${fade.fading} of its ${fade.total} answers are fading. A quick quiz brings them back.`});
    const gap=wines.length?KnowledgeMap.summary(wines).gap:null;
    if(gap&&gap.next) out.push({kind:'mastery',key:'gap:'+gap.label,icon:'trophy',title:gap.next.label,why:gap.why?`${gap.why} It counts towards your Mastery.`:`Your biggest gap: ${gap.label}. Closing it counts towards your Mastery.`,next:gap.next});
    const g=Guides.queue()[0];
    if(g) out.push({kind:'guide',key:'guide:'+g.id,guide:g.id,icon:g.iconName||'book',title:g.title,why:`Wine Skills · ${Guides.group(g.group).label}`,progress:`${g.readTime} read`});
    if(onRamp&&this._seasoned(wines)) out.push(onRamp);
    return {primary:out[0]||null,more:out.slice(1,3),unread};
  },
  /* Rated at least TasteMatch.MIN_SCORED wines of one type: their match is live, so they're not a beginner here. */
  _seasoned(wines){
    const n={}; (wines||[]).forEach(w=>{ if(w.rating>0){ const t=TasteMatch._typeKey(w); n[t]=(n[t]||0)+1; } });
    return Object.values(n).some(c=>c>=TasteMatch.MIN_SCORED);
  },
  /* "1 of 3 reds rated" for the type they have most of, until its match is live. Opens the unrated
     bottles of that type in My Wines when there are any, else the camera. */
  _matchTile(wines){
    const c={}; (wines||[]).forEach(w=>{ const t=TasteMatch._typeKey(w); if(t) c[t]=(c[t]||0)+1; });
    const type=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0])[0];
    if(!type) return null;
    const p=FirstScan.progress({type},wines);
    if(p.ready) return null;
    const unrated=wines.filter(w=>TasteMatch._typeKey(w)===type&&!(w.rating>0)).length;
    const noun=p.left===1?p.one:p.many;
    return {kind:'match',key:'match:'+type,type,icon:'wine',n:p.n,need:p.need,unrated,
      progress:`${p.n} of ${p.need} ${p.many} rated`,
      title:`Rate ${p.left} more ${noun} and every ${p.one} comes with a match`,
      why:unrated?`${unrated} of your ${p.many} ${unrated===1?'is':'are'} waiting for a rating.`:`Worked out from your own ratings, not a critic's.`};
  },

  forWine(wine,wines){
    if(!wine) return [];
    wines=wines||WineHistory.getAll();
    const tiles=[this._topicTile(wine),this._regionTile(wine),this._grapeTile(wine),this._onRampTile(),...this._articleTiles(wine,wines)].filter(Boolean);
    const seen=new Set();
    const out=tiles.filter(t=>!seen.has(t.key)&&seen.add(t.key)).slice(0,this.MAX);
    if(!out.length) out.push({kind:'explore',key:'explore',icon:'compass',title:'Explore Next',why:'You\'ve covered everything about this wine. Find a new style that shares its DNA.'});
    return out;
  },
};
