/* TeamData: one restaurant's wine list, menu and the training written from them, for the staff
   training app (docs/business.md). The pilot keeps it on this device (Store, keys vbiz_*); the
   shape is what the Supabase tables will hold once restaurants have accounts.

   A list or menu is never changed in place: an upload becomes a draft, `diff` says what changed
   against what's live (wines added and gone, a new vintage, a price), and only `publish` makes it
   live, writes the staff cards and pairings the change needs and assigns the new wines to staff
   (TeamLearn.assign). A wrong reading that reaches the floor is the thing that loses a restaurant's
   trust, so a person always approves it first. */
const TeamData = {
  KEY:'vbiz_venue_v1',
  CARD_BATCH:4,       // wines per staff-card call: six questions each fit well inside team_cards' tokens
  PAIR_BATCH:12,      // dishes per pairing call
  PDF_PAGES:2,        // PDF pages read per call, so no single answer runs long
  _empty(){ return {venue:{name:'',created:Date.now()},wines:{},dishes:{},cards:{},pairings:{},versions:[],draft:null,settings:{dueDays:7}}; },
  get(){ const d=Store.getJSON(this.KEY,null); return d&&d.wines?d:this._empty(); },
  save(d){ Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  reset(){ Store.remove(this.KEY); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  setVenue(fields){ const d=this.get(); d.venue={...d.venue,...fields}; this.save(d); },
  currency(){ try{ return Regional.current(); }catch(e){ return {sym:'£',code:'GBP'}; } },

  wines(){ return Object.values(this.get().wines).filter(w=>w.onList).sort((a,b)=>a.order-b.order); },
  dishes(){ return Object.values(this.get().dishes).filter(x=>x.onMenu).sort((a,b)=>a.order-b.order); },
  wine(id){ return this.get().wines[id]||null; },
  dish(id){ return this.get().dishes[id]||null; },
  card(id){ return this.get().cards[id]||null; },
  pairing(dishId){ return this.get().pairings[dishId]||null; },
  byGlass(w){ return !!(w&&w.glass); },
  label(w){ return [w.producer,w.name,w.vintage||'NV'].filter(Boolean).join(' '); },
  short(w){ return [w.producer,w.name].filter(Boolean).join(' '); },

  // One id per wine whatever the vintage, so a new vintage on the list is the same wine moving on.
  _slug(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); },
  wineId(w){ return 'w-'+this._slug([w.producer,w.name].filter(Boolean).join(' ')).slice(0,60); },
  dishId(x){ return 'd-'+this._slug(x.name).slice(0,60); },
  // The consumer app's identity rule (Reserva vs Gran Reserva, a producer spelled two ways), with the vintage left out.
  _same(a,b){ return WineHistory.same({...a,vintage:0},{...b,vintage:0}); },

  /* From the model's short keys (prompts/team-list.txt, team-menu.txt) to the stored shape. */
  _wine(r,i){
    const w={producer:(r.p||'').trim(),name:(r.n||'').trim(),vintage:/^\d{4}$/.test(String(r.v))?Number(r.v):null,
      type:String(r.t||'red').toLowerCase().replace('rose','rosé'),region:r.r||'',country:r.c||'',
      grapes:Array.isArray(r.g)?r.g.filter(Boolean):[],grapes_basis:r.gb||'typical',section:r.sec||'',
      glass:String(r.gl||'').trim(),bottle:String(r.bt||'').trim(),other:String(r.o||'').trim(),bin:String(r.bin||'').trim(),order:i};
    if(!w.name&&w.producer){ w.name=w.producer; w.producer=''; }
    return w;
  },
  _dish(r,i){ return {section:r.sec||'',name:(r.n||'').trim(),desc:r.d||'',price:String(r.pr||''),main:r.main||'',cook:r.cook||'',
    flav:Array.isArray(r.flav)?r.flav:[],diet:Array.isArray(r.diet)?r.diet:[],order:i}; },
  _json(text){ const m=String(text||'').match(/\{[\s\S]*\}/); return m?JSON.parse(m[0]):null; },

  /* A PDF's page count, read from its page objects: enough to split a long list into calls. */
  pdfPages(b64){
    try{ const raw=atob(b64); const n=(raw.match(/\/Type\s*\/Page(?!s)/g)||[]).length; return Math.max(1,n); }catch(e){ return 1; }
  },
  /* Reads uploads (photos as JPEG data, PDFs as base64) into a draft. kind: 'list' | 'menu'.
     files: [{kind:'image'|'pdf', data:base64}]. onStep(done, total) for the progress line. */
  async read(kind,files,onStep,{append=false}={}){
    const tpl=kind==='list'?_loadTextSync('prompts/team-list.txt'):_loadTextSync('prompts/team-menu.txt');
    const cur=this.currency();
    const jobs=[];
    files.forEach(f=>{
      if(f.kind==='pdf'){ const n=this.pdfPages(f.data); for(let p=1;p<=n;p+=this.PDF_PAGES) jobs.push({f,scope:`This PDF has ${n} page${n===1?'':'s'}. Read ONLY page${this.PDF_PAGES>1&&p<n?'s':''} ${p}${this.PDF_PAGES>1&&p<n?' to '+Math.min(n,p+this.PDF_PAGES-1):''}; another reader covers the rest.`}); }
      else jobs.push({f,scope:'Read the whole image.'});
    });
    const out=[]; let done=0;
    onStep&&onStep(0,jobs.length);
    for(const j of jobs){
      const block=j.f.kind==='pdf'?{type:'document',source:{type:'base64',media_type:'application/pdf',data:j.f.data}}
        :{type:'image',source:{type:'base64',media_type:'image/jpeg',data:j.f.data}};
      const text=await window.claude.complete({purpose:kind==='list'?'team_list':'team_menu',
        messages:[{role:'user',content:[block,{type:'text',text:tpl.replace('{{currency}}',`${cur.code} (${cur.sym})`).replace('{{scope}}',j.scope)}]}]});
      const j2=this._json(text)||{};
      (kind==='list'?(j2.wines||[]):(j2.dishes||[])).forEach(r=>out.push(r));
      done++; onStep&&onStep(done,jobs.length);
    }
    const items=kind==='list'?out.map((r,i)=>this._wine(r,i)).filter(w=>w.name):out.map((r,i)=>this._dish(r,i)).filter(x=>x.name);
    // More pages of the same list join the draft already being reviewed.
    const prev=append&&this.get().draft&&this.get().draft.kind===kind?this.get().draft.items:[];
    return this.setDraft(kind,[...prev,...items.map((it,i)=>({...it,order:prev.length+i}))]);
  },
  /* A draft from items already in the stored shape (the sample restaurant, or a test). */
  setDraft(kind,items){
    // Two pages can repeat a wine (a page break mid-section): keep the first reading.
    const seen=[];
    items=items.filter(it=>{ const dup=kind==='list'?seen.some(s=>this._same(s,it)&&s.vintage===it.vintage):seen.some(s=>this.dishId(s)===this.dishId(it)); if(!dup) seen.push(it); return !dup; });
    const d=this.get(); d.draft={kind,items,at:Date.now()}; this.save(d);
    return this.diff();
  },
  dropDraft(){ const d=this.get(); d.draft=null; this.save(d); },

  /* What the draft changes against what's live: {kind, added, removed, changed:[{id,item,what:[…]}], same}. */
  diff(){
    const d=this.get(), dr=d.draft; if(!dr) return null;
    if(dr.kind==='list'){
      const live=this.wines(), used=new Set(), added=[], changed=[], match=[]; let same=0;
      dr.items.forEach((it,i)=>{
        const m=live.find(w=>!used.has(w.id)&&w.id===this.wineId(it))||live.find(w=>!used.has(w.id)&&this._same(w,it));
        match[i]=m?m.id:null;
        if(!m){ added.push(it); return; }
        used.add(m.id);
        const what=[];
        if((m.vintage||null)!==(it.vintage||null)) what.push(`vintage ${m.vintage||'NV'} → ${it.vintage||'NV'}`);
        if(m.glass!==it.glass) what.push(it.glass?(m.glass?`glass ${m.glass} → ${it.glass}`:`now by the glass (${it.glass})`):'no longer by the glass');
        if(m.bottle!==it.bottle&&m.bottle&&it.bottle) what.push(`bottle ${m.bottle} → ${it.bottle}`);
        if(what.length) changed.push({id:m.id,item:it,what}); else same++;
      });
      return {kind:'list',added,removed:live.filter(w=>!used.has(w.id)),changed,same,match};
    }
    const live=this.dishes(), used=new Set(), added=[], changed=[]; let same=0;
    dr.items.forEach(it=>{
      const m=live.find(x=>!used.has(x.id)&&x.id===this.dishId(it));
      if(!m){ added.push(it); return; }
      used.add(m.id);
      if(m.desc!==it.desc) changed.push({id:m.id,item:it,what:['description changed']}); else same++;
    });
    return {kind:'menu',added,removed:live.filter(x=>!used.has(x.id)),changed,same};
  },

  /* Makes the draft live. Returns {added, removed, changed} ids, for the cards, pairings and
     assignments that follow (TeamData.refresh). */
  publish(){
    const diff=this.diff(); if(!diff) return null;
    const d=this.get(), now=Date.now(), res={kind:diff.kind,added:[],removed:diff.removed.map(x=>x.id),changed:[]};
    if(diff.kind==='list'){
      diff.removed.forEach(w=>{ d.wines[w.id]={...d.wines[w.id],onList:false,removedAt:now}; });
      d.draft.items.forEach((it,i)=>{
        const keepId=diff.match[i];
        if(keepId){ d.wines[keepId]={...d.wines[keepId],...it,id:keepId,onList:true,order:i}; if(diff.changed.some(c=>c.id===keepId)) res.changed.push(keepId); return; }
        const id=this.wineId(it), was=d.wines[id];
        d.wines[id]={...it,id,onList:true,order:i,addedAt:now};
        // A wine back on the list keeps its card; a new vintage of it is still the same wine.
        if(!was||!d.cards[id]) res.added.push(id); else if(was) res.changed.push(id);
      });
    } else {
      diff.removed.forEach(x=>{ d.dishes[x.id]={...d.dishes[x.id],onMenu:false,removedAt:now}; delete d.pairings[x.id]; });
      d.draft.items.forEach((it,i)=>{
        const id=this.dishId(it), was=d.dishes[id];
        d.dishes[id]={...it,id,onMenu:true,order:i,addedAt:was&&was.onMenu?was.addedAt:now};
        if(!was||!was.onMenu) res.added.push(id); else if(diff.changed.some(c=>c.id===id)) res.changed.push(id);
      });
    }
    d.versions.push({kind:diff.kind,at:now,added:res.added,removed:res.removed,changed:res.changed});
    d.draft=null;
    this.save(d);
    return res;
  },

  /* The checked facts for a wine, from the consumer app's knowledge base (WineDeep.facts). */
  facts(w){
    const f=WineDeep.facts({name:w.name,producer:w.producer,region:w.region,country:w.country,grapes:w.grapes});
    return [
      f.region?`${this.label(w)}: region ${f.region}, ${f.country}.`:`${this.label(w)}: ${w.region||'region not in our guide'}, ${w.country||''}.`,
      f.classification?`${f.region} classification: ${f.classification}.`:'',
      f.agingRules?`${f.region} ageing rules (verbatim): ${f.agingRules}`:'',
      f.climate?`${f.region} climate: ${f.climate}.`:'',
      f.classic.length?`Classic producers of ${f.region}: ${f.classic.join(', ')}${f.isClassic?' (this producer is one of them)':''}.`:'',
      f.grapeKnown?`${f.grape}: ${(KNOWLEDGE.grapes[f.grape]||{}).profile||''} Winemaking: ${f.winemaking} Ageing: ${f.ageing} Food: ${f.food}`:'',
    ].filter(Boolean).join(' ');
  },
  _listLines(){ return this.wines().map(w=>`${w.id} | ${this.label(w)} | ${w.type} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}`).join('\n'); },
  _menuLines(){ return this.dishes().map(x=>`${x.name} | ${x.main} | ${x.cook} | ${(x.flav||[]).join(', ')}`).join('\n')||'(no menu uploaded yet)'; },

  /* Staff cards and their questions for these wines, a few a call (prompts/team-cards.txt). */
  async writeCards(ids,onStep){
    const tpl=_loadTextSync('prompts/team-cards.txt');
    const venue=this.get().venue.name||'the restaurant';
    let done=0; onStep&&onStep(0,ids.length);
    for(let i=0;i<ids.length;i+=this.CARD_BATCH){
      const ws=ids.slice(i,i+this.CARD_BATCH).map(id=>this.wine(id)).filter(Boolean);
      const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{facts}}',ws.map(w=>this.facts(w)).join('\n'))
        .replace('{{list}}',this._listLines()).replace('{{menu}}',this._menuLines())
        .replace('{{wines}}',ws.map(w=>`${w.id} | ${this.label(w)} | ${w.type} | ${w.region}, ${w.country} | grapes: ${(w.grapes||[]).join(', ')||'unknown'} (${w.grapes_basis}) | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}`).join('\n'))
        .replace('{{example}}',this.short(ws[0]));
      const j=this._json(await window.claude.complete({purpose:'team_cards',messages:[{role:'user',content:prompt}]}))||{};
      const d=this.get();
      (j.cards||[]).forEach(c=>{ if(c&&d.wines[c.id]) d.cards[c.id]={...this._cleanCard(c,d),at:Date.now()}; });
      this.save(d);
      done+=ws.length; onStep&&onStep(done,ids.length);
    }
  },
  // Keeps only what the card may hold: dishes that are on the menu, alternatives that are on the list,
  // and questions that have what their kind needs.
  _cleanCard(c,d){
    const onMenu=new Set(Object.values(d.dishes).filter(x=>x.onMenu).map(x=>x.name));
    const qs=(c.qs||[]).filter(q=>q&&q.q&&(q.k==='recognise'?Array.isArray(q.opts)&&q.opts.length===4&&q.opts[q.a]:q.k==='apply'?Array.isArray(q.key)&&q.key.length:!!q.ans))
      .map((q,i)=>({...q,id:c.id+'#'+i}));
    return {...c,dishes:(c.dishes||[]).filter(x=>onMenu.has(x.dish)),alts:(c.alts||[]).filter(a=>d.wines[a.id]&&d.wines[a.id].onList&&a.id!==c.id),qs};
  },
  /* The list's best matches for each dish (prompts/team-pairings.txt). */
  async writePairings(dishIds,onStep){
    const tpl=_loadTextSync('prompts/team-pairings.txt');
    const venue=this.get().venue.name||'the restaurant';
    const list=this.wines().map(w=>{ const c=this.card(w.id), s=c&&c.style; return `${w.id} | ${this.label(w)} | ${w.type} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}${s?` | body ${s.body}/5, acidity ${s.acid}/5, tannin ${s.tannin}/5, sweetness ${s.sweet}/5`:''}`; }).join('\n');
    let done=0; onStep&&onStep(0,dishIds.length);
    for(let i=0;i<dishIds.length;i+=this.PAIR_BATCH){
      const xs=dishIds.slice(i,i+this.PAIR_BATCH).map(id=>this.dish(id)).filter(Boolean);
      const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{list}}',list)
        .replace('{{dishes}}',xs.map(x=>`${x.name} | ${x.desc} | main: ${x.main} | ${x.cook} | ${(x.flav||[]).join(', ')}`).join('\n'));
      const j=this._json(await window.claude.complete({purpose:'team_pairings',messages:[{role:'user',content:prompt}]}))||{};
      const d=this.get();
      (j.pairings||[]).forEach(p=>{
        const x=xs.find(x=>x.name===p.dish); if(!x) return;
        const ok=id=>id&&d.wines[id]&&d.wines[id].onList;
        d.pairings[x.id]={best:(p.best||[]).filter(b=>ok(b.id)),glass:p.glass&&ok(p.glass.id)?p.glass:null,avoid:p.avoid&&ok(p.avoid.id)?p.avoid:null,at:Date.now()};
      });
      this.save(d);
      done+=xs.length; onStep&&onStep(done,dishIds.length);
    }
  },
  /* After a publish: cards for wines without one, then pairings for every dish (a new wine can be the
     best match for a dish that hasn't changed), then the new wines and dishes assigned to staff.
     onStep(label, done, total). */
  async refresh(res,onStep){
    const missing=this.wines().filter(w=>!this.card(w.id)).map(w=>w.id);
    if(missing.length) await this.writeCards(missing,(a,b)=>onStep&&onStep('Writing staff cards',a,b));
    const dishes=this.dishes().map(x=>x.id);
    if(dishes.length&&this.wines().length&&(res.kind==='list'||res.added.length||res.changed.length||res.removed.length||dishes.some(id=>!this.pairing(id))))
      await this.writePairings(dishes,(a,b)=>onStep&&onStep('Matching wines to the menu',a,b));
    if(typeof TeamLearn!=='undefined') TeamLearn.assign(res);
  },
  /* What still needs writing (an upload that was interrupted): wines without cards, dishes without pairings. */
  pending(){ return {cards:this.wines().filter(w=>!this.card(w.id)).length,pairings:this.wines().length?this.dishes().filter(x=>!this.pairing(x.id)).length:0}; },
};
/* The sample restaurant (data/team-sample.json): a ten-wine list, a seven-dish menu, their staff cards
   and pairings written ahead, and four staff, so the app can be shown without an upload or a call. */
const TeamSample = {
  load(){
    const s=_loadJSON('data/team-sample.json'); if(!s) return false;
    const now=Date.now(), d=TeamData._empty();
    d.venue={name:s.venue.name,created:now,sample:true};
    s.wines.forEach((w,i)=>{ d.wines[w.id]={...w,onList:true,order:i,addedAt:now}; });
    s.dishes.forEach((x,i)=>{ d.dishes[x.id]={...x,onMenu:true,order:i,addedAt:now}; });
    Object.values(s.cards).forEach(c=>{ d.cards[c.id]={...TeamData._cleanCard(c,d),at:now}; });
    Object.entries(s.pairings).forEach(([id,p])=>{ d.pairings[id]={...p,at:now}; });
    d.versions.push({kind:'list',at:now,added:Object.keys(d.wines),removed:[],changed:[]});
    TeamData.save(d);
    Store.remove(TeamLearn.KEY); TeamLearn.resetProgress();
    s.staff.forEach(p=>TeamLearn.addPerson(p.name,p.role));
    return true;
  },
};
Object.assign(window,{TeamData,TeamSample});
