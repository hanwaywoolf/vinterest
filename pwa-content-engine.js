/* Vinterest — Content Engine. Event-triggered archetype queue for the Learn shelf.
   Deterministic: stub metadata (title/subtitle) is template-filled from WineDNA, never LLM-invented.
   Only the article body (GenArticleScreen) calls the model, and only with retrieved facts attached. */

let KNOWLEDGE={descriptors:{},regions:{},grapes:{}},ARTICLE_ARCHETYPES=[],TRIGGERS=[];
try{ KNOWLEDGE=_loadJSON('data/knowledge.json')||KNOWLEDGE; }catch(e){ console.error('[Vinterest] knowledge.json failed to load — generated Learn content will be generic until it is deployed.',e); }
try{ ARTICLE_ARCHETYPES=_loadJSON('data/archetypes.json')||[]; }catch(e){ console.error('[Vinterest] archetypes.json failed to load — the Learn shelf will stay empty until it is deployed.',e); }
try{ TRIGGERS=_loadJSON('data/triggers.json')||[]; }catch(e){ console.error('[Vinterest] triggers.json failed to load — the Learn shelf will stay empty until it is deployed.',e); }

const ExposureLedger = Object.assign(_accountStore('vinterest_exposure_v1'), {
  fresh(){ return {keys:{}}; },
  has(key){ return !!this.get().keys[key]; },
  mark(key){ const d=this.get(); d.keys[key]=Date.now(); this.save(d); }
});

/* Tracks which region quizzes a user has aced (100%) so QuizHubScreen can retire them and
   surface the next newly-eligible region instead of re-serving an already-mastered one. */
const RegionQuizLedger = Object.assign(_accountStore('vinterest_region_quiz_v1'), {
  fresh(){ return {aced:{}}; },
  isAced(region){ return !!this.get().aced[region]; },
  markAced(region){ const d=this.get(); d.aced[region]=Date.now(); this.save(d); }
});

/* Regions with 2+ scans that haven't been aced yet — most-scanned first. A region drops off
   this list the moment its quiz is aced, and a newly-scanned region (e.g. a first Bordeaux)
   slots in on its own once it crosses the 2-scan threshold. */
function regionQuizCandidates(wines){
  const counts={};
  wines.forEach(w=>{ if(w.region) counts[w.region]=(counts[w.region]||0)+1; });
  return Object.entries(counts)
    .filter(([region,n])=>n>=2&&!RegionQuizLedger.isAced(region))
    .sort((a,b)=>b[1]-a[1])
    .map(([region])=>region);
}

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
      const match=wines.find(w=>w.region===ev.subject&&w.country);
      if(match) s.country=match.country;
      else if(KNOWLEDGE.regions[ev.subject]) s.country=KNOWLEDGE.regions[ev.subject].country;
      const others={};
      wines.forEach(w=>{ if(w.region&&w.region!==ev.subject) others[w.region]=(others[w.region]||0)+1; });
      const entries=Object.entries(others);
      if(entries.length){ const pick=entries[Math.floor(Math.random()*entries.length)]; s.regionB=pick[0]; }
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

  /* Pushed directly when a grape gets unlocked (via rating or manual Pro unlock) — reuses the
     grape_thread archetype rather than the trigger/event queue, since unlocking is the event. */
  addGrapeArticle(grape, wines){
    const archetype=ARTICLE_ARCHETYPES.find(a=>a.id==='grape_unlock_intro');
    if(!archetype) return;
    const key='grapeunlock:'+grape;
    if(ExposureLedger.has(key)) return;
    const slots={grape,count:Math.max(1,wines.filter(w=>(w.grapes||[]).includes(grape)).length)};
    const stub={
      id:'ev_'+key.replace(/[^a-z0-9]+/gi,'_'),
      archetypeId:archetype.id,
      iconName:archetype.iconName,
      readTime:archetype.readTime,
      title:this.fillTpl(archetype.titleTpl,slots),
      subtitle:this.fillTpl(archetype.subtitleTpl,slots),
      brief:archetype.brief,
      slots,
      facts:this.retrieveFacts(archetype,slots)
    };
    let stubs=[];
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    stubs.push(stub);
    localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    ExposureLedger.mark(key);
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

  /* Re-fills title/subtitle from stored slots for every stub — heals any stub persisted before a
     template or slot-resolution fix, without needing to wipe the user's saved article list.
     Also backfills any `needs` slot the stub's saved slots are missing (e.g. `country`, added to
     buildSlots after some stubs already existed) — otherwise re-filling with the current template
     just swaps in a fresh, still-unresolved {{placeholder}} instead of fixing it. */
  _healStubs(stubs, wines){
    let changed=false;
    stubs.forEach(stub=>{
      if(!stub.slots) return;
      const archetype=ARTICLE_ARCHETYPES.find(a=>a.id===stub.archetypeId);
      if(!archetype) return;
      (archetype.needs||[]).forEach(n=>{
        if(stub.slots[n]!=null&&stub.slots[n]!=='') return;
        if(n==='country'&&stub.slots.region){
          const match=(wines||[]).find(w=>w.region===stub.slots.region&&w.country);
          stub.slots.country=match?match.country:KNOWLEDGE.regions[stub.slots.region]?.country;
        }
      });
      const title=this.fillTpl(archetype.titleTpl,stub.slots);
      const subtitle=this.fillTpl(archetype.subtitleTpl,stub.slots);
      if(title!==stub.title||subtitle!==stub.subtitle){ stub.title=title; stub.subtitle=subtitle; changed=true; }
    });
    return changed;
  },

  refreshShelf(wines, maxUnread){
    maxUnread=maxUnread||6;
    let stubs=[];
    try{ stubs=JSON.parse(localStorage.getItem('vinterest_gen_stubs')||'[]')||[]; }catch(e){}
    let healed=this._healStubs(stubs,wines);
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
    if(added>0||healed) localStorage.setItem('vinterest_gen_stubs',JSON.stringify(stubs));
    return stubs;
  }
};
