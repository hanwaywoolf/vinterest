/* Vinterest — Vinny: the "Ask Vinny" wine guide at the top of Home.

   Vinny answers from what the app knows about the person (their WineDNA, best wines, usual spend
   and recent bottles: profile()), keeps the last couple of turns so a follow-up makes sense, and
   every answer ends with one "Learn more" link into the app's own content (a grape or region
   quiz, a Wine Skills guide), picked here without another Claude call. The prompt is
   prompts/vinny.txt. Recent questions are kept so they can be asked again. */
let VINNY_PROMPT='';
try{ VINNY_PROMPT=_loadTextSync('prompts/vinny.txt')||''; }catch(e){ console.error('[Vinterest] vinny.txt failed to load — Ask Vinny is unavailable until it is deployed.',e); }

const Vinny = Object.assign(_accountStore('vinterest_vinny_v1'), {
  fresh(){ return {recent:[]}; },
  RECENT:5, TURNS:2,
  recent(){ return this.get().recent||[]; },
  remember(q){ const d=this.get(); d.recent=[q,...(d.recent||[]).filter(x=>x.toLowerCase()!==q.toLowerCase())].slice(0,this.RECENT); this.save(d); },

  /* Questions to suggest, from their own wines first, then general ones. */
  GENERIC:["What does 'tannic' mean?","What's the difference between Malbec and Merlot?","Should red wine be chilled?","What does 'dry' mean for wine?","How long should wine breathe before drinking?","What's the difference between Old World and New World wine?","How do I pick a wine for a gift?","What wine goes with a curry?"],
  suggestions(wines){
    wines=(wines||[]).filter(w=>WineDNA.chosen(w));
    const pool=[];
    if(wines.length>=3){
      const count=(pick)=>{ const m={}; wines.forEach(w=>pick(w).forEach(k=>{ if(k) m[k]=(m[k]||0)+1; })); return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(e=>e[0]); };
      const grapes=count(w=>[...new Set((w.grapes||[]).map(g=>WineDNA.grape(g)))]).slice(0,2);
      const regions=count(w=>[Regions.of(w)]).slice(0,2);
      const best=[...wines].filter(w=>w.rating>0).sort((a,b)=>b.rating-a.rating)[0];
      grapes.forEach(g=>pool.push(`Why do I keep picking ${g}?`));
      if(best) pool.push(`What should I eat with ${best.name}?`);
      regions.forEach(r=>pool.push(`What should I try if I like ${r}?`));
      if(grapes[0]) pool.push(`What's like ${grapes[0]} but different?`);
    }
    return [...new Set([...pool,...this.GENERIC])].slice(0,10);
  },

  /* The facts Vinny may use, kept short (a few hundred characters per type they drink). */
  profile(wines){
    wines=wines||WineHistory.getAll();
    const rc=Regional.current(), chosen=wines.filter(w=>WineDNA.chosen(w));
    if(!chosen.length) return 'They have not scanned any wines yet.';
    const counts={}; chosen.forEach(w=>{ const t=WineDNA._t(w.type); if(t) counts[t]=(counts[t]||0)+1; });
    const lines=[];
    Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([k])=>{
      const p=WineDNA.profile(k,wines,ContentEngine._typeLabel(k)), L=p.label.toLowerCase();
      const best=[...p.scored].sort((a,b)=>b.rating-a.rating).slice(0,3).map(w=>`${w.name} (${w.rating})`);
      const bits=[`${WineDNA.noun(k,p.wines.length)} scanned, ${p.scored.length} scored`];
      if(p.scored.length) bits.push(`style they choose: ${p.personality}`);
      if(p.topGrapes.length) bits.push(`grapes they pick most: ${p.topGrapes.slice(0,3).join(', ')}`);
      if(p.favourites.regions.length) bits.push(`best-scoring regions: ${p.favourites.regions.map(r=>r.name).join(', ')}`);
      if(best.length) bits.push(`top scores: ${best.join(', ')}`);
      if(p.favourites.disliked.length) bits.push(`scored under 80: ${p.favourites.disliked.map(w=>w.name).join(', ')}`);
      if(p.favourites.buyAgain.length) bits.push(`would buy again: ${p.favourites.buyAgain.map(w=>w.name).join(', ')}`);
      const b=SommelierScript.budget(p.wines,rc); if(b) bits.push(`usual spend: ${b}`);
      lines.push(`${p.label}: ${bits.join('; ')}.`);
    });
    const recent=[...chosen].sort((a,b)=>new Date(b.last_scanned||b.scanned_at||0)-new Date(a.last_scanned||a.scanned_at||0)).slice(0,3);
    lines.push(`Most recent bottles: ${recent.map(w=>w.name+(w.rating>0?` (${w.rating})`:'')).join(', ')}.`);
    return lines.join('\n');
  },

  prompt(question,turns,wines){
    const hist=(turns||[]).slice(-this.TURNS).filter(t=>t.a);
    return _fillTpl(VINNY_PROMPT,{profile:this.profile(wines),depth:UserPrefs.depthLine(),question,
      history:hist.length?'Conversation so far:\n'+hist.map(t=>`They asked: "${t.q}"\nYou said: "${t.a}"`).join('\n')+'\n\n':''});
  },
  ask(question,turns,wines){
    return window.claude.complete({purpose:'wine_qa',messages:[{role:'user',content:this.prompt(question,turns,wines)}]}).then(t=>String(t||'').trim());
  },

  /* One "Learn more" link for an answer: a grape, then a region, then a guide on the topic. The
     question is checked before the answer, so the link follows what they asked about. */
  GUIDE_WORDS:[
    [/\b(pair|pairing|food|eat|dinner|cheese|curry|pizza|pasta|steak|fish|chicken|dessert|spicy)\b/i,'pairing'],
    [/\b(restaurant|wine list|sommelier|order|ordering|corked|send it back)\b/i,'ordering'],
    [/\b(gift|price|cheap|expensive|worth|buy|buying|label|vintage|reserva)\b/i,'buying'],
    [/\b(party|serve|serving|temperature|chill|chilled|decant|breathe|open bottle|leftover|glass(es)?)\b/i,'hosting'],
    [/\b(taste|tasting|tannin|tannic|acidity|acid|body|dry|sweet|oak|oaky|buttery|describe|finish|legs)\b/i,'tasting'],
  ],
  _grapeIn(text){
    const t=' '+WineDNA._fold(text).replace(/[^a-z0-9]+/g,' ')+' ';
    const names=[...GRAPE_ALLOWLIST,...Object.keys(WineDNA.GRAPE_SYNONYMS)].sort((a,b)=>b.length-a.length);
    const hit=names.find(n=>t.includes(' '+WineDNA._fold(n).replace(/[^a-z0-9]+/g,' ')+' '));
    return hit?GrapeUnlocks.key(hit):null;
  },
  learnLink(question,answer){
    for(const text of [question,answer||'']){
      // An unlocked grape or region gets its quiz; one held back only by the free allowance gets
      // the Pro offer; one they haven't met yet falls through to a guide on the topic.
      const free=!localStorage.getItem('vinterest_pro');
      const g=this._grapeIn(text);
      if(g&&GrapeUnlocks.isUnlocked(g)) return {kind:'grape',grape:g,label:`${g} quiz`};
      if(g&&free&&GrapeUnlocks.count()>=FREE_GRAPE_CAP) return {kind:'pro',feature:'grape-library',label:`${g} quiz`};
      const r=Regions._match(text);
      if(r&&RegionUnlocks.isUnlocked(r)) return {kind:'region',region:r,label:`${r} quiz`};
      if(r&&free&&RegionUnlocks.count()>=FREE_REGION_CAP) return {kind:'pro',feature:'regions',label:`${r} quiz`};
    }
    for(const text of [question,answer||'']){
      const m=this.GUIDE_WORDS.find(([re])=>re.test(text));
      if(m){ const g=Guides.inGroup(m[1]).find(x=>!Guides.done(x.id))||Guides.inGroup(m[1])[0]; if(g) return {kind:'guide',guide:g.id,label:g.title}; }
    }
    return null;
  },
});
