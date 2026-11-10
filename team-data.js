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
  PITCH_BATCH:8,      // wines per short-card call (a pitch demo's cards carry no questions)
  PAIR_BATCH:12,      // dishes per pairing call
  PDF_PAGES:2,        // PDF pages read per call, so no single answer runs long
  _empty(){ return {venue:{name:'',created:Date.now()},wines:{},dishes:{},cards:{},pairings:{},cocktails:{},cocktailCards:{},dishCards:{},versions:[],draft:null,settings:{dueDays:7}}; },
  DISH_BATCH:8,       // dishes per dish-notes call
  /* The venue is one 300KB document once the cards are written, and the screens and TeamLearn read
     it many times a render, so the parsed copy is kept until the stored text changes (the text is
     compared, never trusted by reference, so a write from anywhere else is seen). */
  // Kept until the stored text is written again: every write goes through Store, which says so (Store.subscribe), and
  // another tab's write arrives as a storage event. Comparing the whole stored text on every call, as before, cost
  // seconds a screen on a long list (The Princess Royal's restaurant is over a megabyte, read thousands of times).
  get(){ if(this._fresh&&this._val) return this._val;
    const raw=Store.get(this.KEY);
    if(raw!==null&&raw===this._raw&&this._val){ this._fresh=true; return this._val; }
    const d=raw?Store.getJSON(this.KEY,null):null, v=d&&d.wines?d:this._empty(); this._raw=raw; this._val=v; this._fresh=raw!==null; return v; },
  _fresh:false,
  save(d){ this._relist(); Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  reset(){ Store.remove(this.KEY); Store.remove(this.TONIGHT); if(typeof TeamShift!=='undefined') TeamShift.reset(); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  setVenue(fields){ const d=this.get(); d.venue={...d.venue,...fields}; this.save(d); },
  setSetting(k,v){ const d=this.get(); d.settings={...(d.settings||{}),[k]:v}; this.save(d); },
  isDemo(){ return (this.get().venue||{}).sample==='demo'; },
  /* Tonight (docs/business.md, "Pre-shift"): what's 86'd and what's on feature, set at four o'clock by whoever runs the
     floor (the manager's phone or the console) and gone at the end of the phone's calendar day. Nothing here is scored:
     it feeds the Tonight card on every Today, Vinny's suggestions and the guest's tables, not readiness. */
  _day(now=Date.now()){ const x=new Date(now); return `${x.getFullYear()}-${x.getMonth()+1}-${x.getDate()}`; },
  /* Tonight has a key of its own (vbiz_tonight_v1): kept on the venue's document, every tap rewrote and re-read the
     whole list (300KB at The Princess Royal) and threw away everything worked out from it, 2 to 5 seconds a tap. */
  TONIGHT:'vbiz_tonight_v1',
  tonight(now=Date.now()){ const d=this.get(), t=Store.getJSON(this.TONIGHT,null)||d.tonight||null; const empty={day:this._day(now),off:[],feature:[],note:''};
    if(!t||t.day!==this._day(now)) return empty; return {...empty,...t,off:(t.off||[]).filter(id=>(d.dishes[id]||{}).onMenu),feature:(t.feature||[]).filter(id=>(d.wines[id]||{}).onList||((d.cocktails||{})[id]||{}).onList)}; },
  setTonight(fields,now=Date.now()){ const t=this.tonight(now); Store.setJSON(this.TONIGHT,{...t,...fields,day:this._day(now),at:now}); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  toggleTonight(kind,id,now=Date.now()){ const t=this.tonight(now), list=[...(t[kind]||[])], i=list.indexOf(id); if(i>=0) list.splice(i,1); else list.push(id); this.setTonight({[kind]:list},now); return i<0; },
  isOff(dishId){ return this.tonight().off.includes(dishId); },
  isFeature(id){ return this.tonight().feature.includes(id); },
  /* A restaurant installed from its own file carries its currency (The Social Corner: CAD); otherwise the device's. */
  /* An amount in the restaurant's currency, thousands grouped with commas ("$8,774", "£1,250.50"), the one way
     every screen writes money it works out. dp is the decimal places (0 by default). */
  money(n,{dp=0}={}){ const sym=this.currency().sym||'£', v=Number(n)||0;
    return (v<0?'-':'')+sym+Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:dp,maximumFractionDigits:dp}); },
  currency(){ const c=(this.get().venue||{}).currency; if(c&&c.sym) return c; try{ return Regional.current(); }catch(e){ return {sym:'£',code:'GBP'}; } },
  /* The restaurant's own branding when it was installed with it (venue.brand: logo, logoDark, mark, accent). */
  brand(){ const v=this.get().venue||{}, b=v.brand; if(!b) return null;
    // The images keep their names when a restaurant's logo changes, so each address carries the seed's stamp:
    // a new logo is never shown from a browser's earlier copy.
    const tag=v.seeded?'?v='+encodeURIComponent(v.seeded):'', at=x=>x&&!/[?]/.test(x)?x+tag:x;
    return {...b,logo:at(b.logo),logoDark:at(b.logoDark),mark:at(b.mark),full:at(b.full)}; },
  /* What the training is written for: the restaurant in its own words, for every prompt's {{about}}. */
  about(){ const v=this.get().venue||{}; return v.about||[v.name,v.style,v.city].filter(Boolean).join(', ')||'A restaurant. Write in British English.'; },

  /* What's on the list, in order. Kept per parsed document until the end of the running task (a redraw asks hundreds
     of times, and nothing between two saves changes it in between); a copy each time, since callers sort and filter
     what they're given. A function that changes the document in place and reads the list before saving calls _relist. */
  _listMemo:new WeakMap(), _listTick:false,
  _relist(){ this._listMemo=new WeakMap(); },
  _listed(key,flag){ const d=this.get(); let m=this._listMemo.get(d); if(!m){ m={}; this._listMemo.set(d,m); }
    if(!this._listTick){ this._listTick=true; Promise.resolve().then(()=>{ this._listTick=false; this._relist(); }); }
    if(!m[key]) m[key]=Object.values(d[key]||{}).filter(x=>x[flag]).sort((a,b)=>a.order-b.order);
    return m[key].slice(); },
  wines(){ return this._listed('wines','onList'); },
  dishes(){ return this._listed('dishes','onMenu'); },
  wine(id){ return this.get().wines[id]||null; },
  dish(id){ return this.get().dishes[id]||null; },
  card(id){ return this.get().cards[id]||null; },
  pairing(dishId){ return this.get().pairings[dishId]||null; },
  /* The cocktail list, where the restaurant has one (The Social Corner's, from its drinks page): each with its
     ingredients as the list prints them, and a card written by prompts/team-cocktail-cards.txt. */
  cocktails(){ return this._listed('cocktails','onList'); },
  cocktail(id){ return (this.get().cocktails||{})[id]||null; },
  cocktailCard(id){ return (this.get().cocktailCards||{})[id]||null; },
  /* A dish's front-of-house notes (prompts/team-dish-cards.txt, purpose team_dishes): the dish in a sentence (with three near-miss descriptions of the same dish, `wrong`, for the know-it question), its
     allergens as drafted (the kitchen confirms them on the console before any server is asked; a draft is never
     shown as fact), what can change, what guests ask. {say, allergens:{draft:[{code,sure}], note, confirmed:[codes]|null,
     confirmedAt, by}, mods:[{ask,can,say}], ask:[{q,a}], at} */
  dishCard(id){ return (this.get().dishCards||{})[id]||null; },
  /* The statutory allergen list for the venue's country (venue.country, else its currency): Canada's eleven, the UK and
     EU's fourteen, the US's nine. Codes are what the drill and the register use; names are what people read. */
  ALLERGENS:{
    CA:[['milk','Milk'],['egg','Egg'],['fish','Fish'],['shellfish','Crustaceans and molluscs'],['peanut','Peanuts'],['treenut','Tree nuts'],['wheat','Wheat and gluten'],['soy','Soy'],['sesame','Sesame'],['mustard','Mustard'],['sulphite','Sulphites']],
    GB:[['gluten','Cereals containing gluten'],['crustacean','Crustaceans'],['mollusc','Molluscs'],['egg','Egg'],['fish','Fish'],['peanut','Peanuts'],['treenut','Tree nuts'],['soy','Soya'],['milk','Milk'],['celery','Celery'],['mustard','Mustard'],['sesame','Sesame'],['sulphite','Sulphites'],['lupin','Lupin']],
    US:[['milk','Milk'],['egg','Egg'],['fish','Fish'],['shellfish','Crustacean shellfish'],['treenut','Tree nuts'],['peanut','Peanuts'],['wheat','Wheat'],['soy','Soybeans'],['sesame','Sesame']],
  },
  allergenCountry(){ const v=this.get().venue||{}; if(v.country&&this.ALLERGENS[v.country]) return v.country; const code=(v.currency||{}).code||(typeof Regional!=='undefined'&&Regional.currency&&Regional.currency().code)||''; return code==='CAD'?'CA':code==='USD'?'US':'GB'; },
  allergenList(){ return this.ALLERGENS[this.allergenCountry()].map(([code,name])=>({code,name})); },
  allergenName(code){ const a=this.allergenList().find(x=>x.code===code); return a?a.name:code; },
  /* The allergens a server is taught for a dish: only what the kitchen confirmed. null until then. */
  allergensOf(id){ const c=this.dishCard(id); return c&&c.allergens&&Array.isArray(c.allergens.confirmed)?c.allergens.confirmed:null; },
  confirmAllergens(id,codes,by){ const doc=this.get(); doc.dishCards=doc.dishCards||{}; const c=doc.dishCards[id]||{say:'',allergens:{draft:[],note:''},mods:[],ask:[]};
    doc.dishCards[id]={...c,allergens:{...(c.allergens||{}),confirmed:[...new Set((codes||[]).filter(Boolean))],confirmedAt:Date.now(),by:by||null}}; this.save(doc);
    if(typeof TeamLearn!=='undefined') TeamLearn.assignAllergen(id); },
  /* Writes the dish notes, DISH_BATCH dishes a call. */
  async writeDishCards(ids,onStep){
    const tpl=_loadTextSync('prompts/team-dish-cards.txt'), venue=this.get().venue.name||'the restaurant';
    const line=x=>`${x.id} | ${x.section||''} | ${x.name} | ${x.desc||''} | ${x.price||''} | ${(x.diet||[]).join(', ')}`;
    let done=0; onStep&&onStep(0,ids.length);
    for(let i=0;i<ids.length;i+=this.DISH_BATCH){
      const xs=ids.slice(i,i+this.DISH_BATCH).map(id=>this.dish(id)).filter(Boolean);
      const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{allergens}}',this.allergenList().map(a=>`${a.code} (${a.name})`).join(', ')).replace('{{dishes}}',this.dishes().map(line).join('\n')).replace('{{batch}}',xs.map(line).join('\n'));
      const j=this._json(await window.claude.complete({purpose:'team_dishes',messages:[{role:'user',content:prompt}]}))||{};
      const doc=this.get(); doc.dishCards=doc.dishCards||{};
      (j.dishes||[]).forEach(c=>{ if(c&&doc.dishes[c.id]) doc.dishCards[c.id]={...this._cleanDishCard(c),...(doc.dishCards[c.id]&&doc.dishCards[c.id].allergens&&doc.dishCards[c.id].allergens.confirmed?{allergens:{...this._cleanDishCard(c).allergens,confirmed:doc.dishCards[c.id].allergens.confirmed,confirmedAt:doc.dishCards[c.id].allergens.confirmedAt,by:doc.dishCards[c.id].allergens.by}}:{}),at:Date.now()}; });
      this.save(doc); done+=xs.length; onStep&&onStep(done,ids.length);
    }
  },
  _cleanDishCard(c){ const codes=new Set(this.allergenList().map(a=>a.code));
    const draft=(Array.isArray(c.allergens)?c.allergens:[]).map(a=>typeof a==='string'?{code:a,sure:'likely'}:a).filter(a=>a&&codes.has(a.code)).map(a=>({code:a.code,sure:a.sure==='printed'?'printed':'likely'}));
    return {say:String(c.say||'').trim(),allergens:{draft,note:String(c.note||'').trim(),confirmed:Array.isArray(c.allergens&&c.allergens.confirmed)?c.allergens.confirmed:(c.confirmed||null)},
      mods:(c.mods||[]).filter(m=>m&&m.ask&&m.say).map(m=>({ask:String(m.ask).trim(),can:['yes','no','ask'].includes(m.can)?m.can:'ask',say:String(m.say).trim()})).slice(0,4),
      ask:(c.ask||[]).filter(a=>a&&a.q&&a.a).map(a=>({q:String(a.q).trim(),a:String(a.a).trim()})).slice(0,3),
      wrong:(Array.isArray(c.wrong)?c.wrong:[]).map(x=>String(x||'').trim()).filter(x=>x&&x!==c.say).slice(0,3)}; },
  /* Which cocktails a dish suits, from the cocktails' own cards (no extra call). [{cocktail, why}] */
  cocktailsFor(dishName){ return this.cocktails().map(c=>{ const k=this.cocktailCard(c.id), d=k&&(k.dishes||[]).find(x=>x.dish===dishName); return d?{cocktail:c,why:d.why}:null; }).filter(Boolean); },
  byGlass(w){ return !!(w&&w.glass); },
  /* A mixed drink on the list (a cocktail, a spritz, a sangria, an alcohol-free one) rather than a wine:
     it has a recipe instead of a grape and a vintage, its own card (prompts/team-cocktail-cards.txt), its
     own part of readiness (TeamLearn 'drinks') and its own pick on each dish. */
  isDrink(w){ return !!w&&w.type==='cocktail'; },
  label(w){ return this.isDrink(w)?w.name:[w.producer,w.name,w.vintage||'NV'].filter(Boolean).join(' '); },
  short(w){ return [w.producer,w.name].filter(Boolean).join(' '); },
  /* A wine's name where a long one won't fit (a list row's "Best with", a suggestion): the producer when the full
     name runs past four words ("Mionetto" for "Mionetto Prosecco DOC Treviso"), else the short name. */
  nick(w){ const s=this.short(w); return s.split(/\s+/).length>4&&w.producer?String(w.producer):s; },

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
        if((m.section||'')!==(it.section||'')&&it.section) what.push(`section ${m.section||'none'} → ${it.section}`);
        if(what.length) changed.push({id:m.id,item:it,what}); else same++;
      });
      return {kind:'list',added,removed:live.filter(w=>!used.has(w.id)),changed,same,match};
    }
    const live=this.dishes(), used=new Set(), added=[], changed=[]; let same=0;
    dr.items.forEach(it=>{
      const m=live.find(x=>!used.has(x.id)&&x.id===this.dishId(it));
      if(!m){ added.push(it); return; }
      used.add(m.id);
      const what=[]; if(m.desc!==it.desc) what.push('description changed'); if(String(m.price||'')!==String(it.price||'')&&it.price) what.push(`price ${m.price||'none'} → ${it.price}`);
      if(what.length) changed.push({id:m.id,item:it,what}); else same++;
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
  _listLines(){ return this.wines().filter(w=>!this.isDrink(w)).map(w=>`${w.id} | ${this.label(w)} | ${w.type} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}`).join('\n'); },
  // The drinks list as the cocktail prompts see it: every ingredient as the menu lists it, and the price.
  _drinkLines(){ return this.cocktails().map(c=>`${c.id} | ${c.name} | ${c.section||''} | base: ${c.spirit||'not given'} | ${(c.ingredients||[]).join(', ')} | ${c.price||''}${c.by?` | created by ${c.by}`:''}`).join('\n')||'(no cocktails)'; },
  _menuLines(){ return this.dishes().map(x=>`${x.name} | ${x.main} | ${x.cook} | ${(x.flav||[]).join(', ')}`).join('\n')||'(no menu uploaded yet)'; },
  // The menu as printed (section, description, price) for the sommelier review, which checks prices and what a dish is:
  // given only the short lines above it held The Princess Royal's fudge for a £4 price it couldn't see.
  _menuFull(){ return this.dishes().map(x=>`${x.name} | ${x.section||''} | ${x.desc||''} | ${x.price||'no price printed'}`).join('\n')||'(no menu uploaded yet)'; },

  /* One Claude call, tried a second time after a short pause if the first fails. */
  // A busy moment upstream comes back as a 502; it passes in seconds, so the waits grow (RETRY_WAITS).
  RETRY_WAITS:[3000,8000,20000],
  async _callRetry(purpose,content){ let last;
    for(let i=0;i<=this.RETRY_WAITS.length;i++){
      try{ return await window.claude.complete({purpose,messages:[{role:'user',content}]}); }
      catch(e){ last=e; if(e&&(e.code==='pro'||e.status===402||e.status===429||e.code==='refused')) throw e; if(i<this.RETRY_WAITS.length) await new Promise(r=>setTimeout(r,(window.VINTEREST_RETRY_FAST?10:this.RETRY_WAITS[i]))); } }
    throw last; },
  /* Staff cards and their questions for these wines, a few a call (prompts/team-cards.txt). */
  /* opts.short: the pitch demo's short card (prompts/team-pitch-cards.txt, docs/business.md "Pitch demos"): what a server
     reads and says, with no written questions, so more wines fit a call (PITCH_BATCH). The app builds its Essentials
     questions from such a card itself (TeamLearn.lightQs). */
  async writeCards(ids,onStep,opts){
    const short=!!(opts&&opts.short), size=short?this.PITCH_BATCH:this.CARD_BATCH;
    const tpl=short?_loadTextSync('prompts/team-pitch-cards.txt'):_loadTextSync('prompts/team-cards.txt');
    const venue=this.get().venue.name||'the restaurant';
    let done=0; onStep&&onStep(0,ids.length);
    for(let i=0;i<ids.length;i+=size){
      const ws=ids.slice(i,i+size).map(id=>this.wine(id)).filter(Boolean);
      const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{facts}}',ws.map(w=>this.facts(w)).join('\n'))
        .replace('{{list}}',this._listLines()).replace('{{menu}}',this._menuLines())
        .replace('{{wines}}',ws.map(w=>`${w.id} | ${this.label(w)} | ${w.type} | ${w.region}, ${w.country} | grapes: ${(w.grapes||[]).join(', ')||'unknown'} (${w.grapes_basis}) | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}`).join('\n'))
        .replace('{{example}}',this.short(ws[0]));
      // A long answer (four wines, six questions each) can fail on the way back; one failed batch shouldn't
      // stop a publish, so it's tried again, then one wine at a time, before the error stands.
      let j;
      try{ j=this._json(await this._callRetry('team_cards',prompt))||{}; }
      catch(e){ if(ws.length<2) throw e; j={cards:[]};
        for(const one of ws){ const p1=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{facts}}',this.facts(one))
            .replace('{{list}}',this._listLines()).replace('{{menu}}',this._menuLines())
            .replace('{{wines}}',`${one.id} | ${this.label(one)} | ${one.type} | ${one.region}, ${one.country} | grapes: ${(one.grapes||[]).join(', ')||'unknown'} (${one.grapes_basis}) | ${[one.glass&&'glass '+one.glass,one.bottle&&'bottle '+one.bottle].filter(Boolean).join(', ')}`)
            .replace('{{example}}',this.short(one));
          const j1=this._json(await this._callRetry('team_cards',p1))||{}; (j1.cards||[]).forEach(c=>j.cards.push(c)); } }
      const d=this.get();
      (j.cards||[]).forEach(c=>{ if(c&&d.wines[c.id]) d.cards[c.id]={...this._cleanCard(c,d),at:Date.now()}; });
      this.save(d);
      done+=ws.length; onStep&&onStep(done,ids.length);
    }
  },
  /* The publish check (docs/business.md "Checking the questions"): every question on these wines' cards is
     put through what the drill does with it (TeamLearn.audit), and the ones that would be left out or asked
     badly are sent back to be rewritten (prompts/team-fix.txt, purpose team_fix, FIX_BATCH a call), each
     with why it failed and the facts to write it from. A rewrite replaces the question under the same id,
     so nobody's progress moves, and is checked again; one that still fails stays out of the drill, as it
     would have anyway. The result is kept as venue.checked {at, asked, failed, fixed, left} for the job
     chip and the console. The demo restaurant runs offline, so it's only counted there. */
  /* The check in words for the job chip: "180 questions checked · 6 rewritten". */
  checkedLine(){ const c=(this.get().venue||{}).checked; if(!c) return 'Training is up to date';
    return `${c.asked} questions checked${c.fixed?` · ${c.fixed} rewritten`:''}${c.left?` · ${c.left} held back`:''}${c.flagged?` · ${c.flagged} to look at`:''}${(()=>{ const r=this.reviewed(); return r?` · sommelier: ${r.fixed} rewritten${r.held.length?`, ${r.held.length} held`:''}`:''; })()}`; },
  /* One batch of rewrites (prompts/team-fix.txt): each {q, wine, why, note} sent back with the wine's card and the dishes
     it suits; a rewrite takes the question's place under the same id and kind, so nobody's progress moves. */
  async _rewrite(part,tpl,venue){
        const items=part.map(f=>{ const w=this.wine(f.wine), c=this.card(f.wine)||{};
          const suits=this.dishes().filter(x=>{ const p=this.pairing(x.id); return p&&[...(p.best||[]),p.glass].filter(Boolean).some(b=>b.id===w.id); }).map(x=>x.name);
          return `ID ${f.q.id}\nWINE ${this.label(w)} | ${w.type} | ${w.region}, ${w.country} | grapes: ${(w.grapes||[]).join(', ')||'unknown'} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}\nCARD taste: ${c.taste||''} | style: body ${(c.style||{}).body}/5, acidity ${(c.style||{}).acid}/5, tannin ${(c.style||{}).tannin}/5, sweetness ${(c.style||{}).sweet}/5 | grape: ${c.grape||''} | place: ${c.place||''}\nDISHES IT SUITS ${suits.join('; ')||'none listed'}\nPROBLEM ${f.why}: ${f.note}\nQUESTION ${JSON.stringify(f.q)}`; }).join('\n\n');
        const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{facts}}',[...new Set(part.map(f=>f.wine))].map(id=>this.facts(this.wine(id))).join('\n'))
          .replace('{{list}}',this._listLines()).replace('{{menu}}',this._menuLines()).replace('{{items}}',items);
        let j=null; try{ j=this._json(await window.claude.complete({purpose:'team_fix',messages:[{role:'user',content:prompt}]})); }catch(e){}
        const d=this.get();
        (j&&j.fixes||[]).forEach(fx=>{ const f=part.find(x=>x.q.id===fx.id); if(!f||!fx.q) return; const c=d.cards[f.wine]; if(!c) return;
          const nq={...fx.q,k:f.q.k,id:f.q.id};
          const ok=nq.q&&(nq.k==='recognise'?Array.isArray(nq.opts)&&nq.opts.length===4&&nq.opts[nq.a]:nq.k==='apply'?Array.isArray(nq.key)&&nq.key.length:!!nq.ans);
          if(ok) c.qs=c.qs.map(q=>q.id===f.q.id?nq:q); });
        this.save(d);
  },
  /* The sommelier review (prompts/team-review.txt, purpose team_review): after the rule check, a head sommelier reads
     every question exactly as the drill shows it (the question, the options as dealt, the one marked right, the line
     after the answer) and says whether it's fit to ask: no second right answer, no wrong answer marked right, no false
     fact, no giveaway, nothing off the subject, nothing unclear or useless. A wine card's question it doubts goes back to
     be rewritten (team_fix, problem `sommelier`, its note) and is read again; anything still doubted, and any question
     built from the list (a dish's, a cocktail's, Low's) it doubts, is held out of the drill (`venue.reviewed.held`)
     until the next review. The pre-handover gate for a new install (docs/business.md, "Handing over an install"):
     `npm run team:review` runs it on a seed and writes the result into its file. The demo restaurant is never sent. */
  REVIEW_BATCH:10, REVIEW_AT_ONCE:1,
  _reviewItem(q){ const d=TeamLearn.deal(q,'review'), c=TeamLearn.shown(d), opts=c.opts, right=c.right;
    const about=q.wine?`WINE ${this.label(this.wine(q.wine)||{})}`:q.cocktail?`COCKTAIL ${(this.cocktail(q.cocktail)||{}).name||''}`:q.dish?`DISH ${(this.dish(q.dish)||{}).name||''}`:'';
    const ax=TeamLearn.aside(d,right.map(i=>opts[i]).join(' ')||d.ans);
    const groups=c&&c.groups&&c.groups.length>1?' (in '+c.groups.map(g=>`"${g.label}": choose ${g.n}`).join(', ')+')':c&&c.n>1?` (choose ${c.n})`:'';
    return `ID ${q.id}\n${about}\nQUESTION ${d.q}${groups}\nOPTIONS\n${opts.map((o,i)=>`${right.includes(i)?'[marked right]':'[wrong]'} ${o}`).join('\n')}${opts.length?'':`\nANSWER ${d.ans||''}`}\nAFTER ${ax?(ax.text||ax.list.map(x=>`${x.name}: ${x.text}`).join(' / ')):'(nothing)'}`; },
  async sommelierReview({onStep,only}={}){
    const all=[...this.wines().flatMap(w=>[...TeamLearn.wineQs(w.id,{all:true}),...TeamLearn.lightQs(w.id,{all:true})]),...this.cocktails().flatMap(c=>TeamLearn.cocktailQs(c.id,{all:true})),...this.dishes().flatMap(x=>TeamLearn.dishQs(x.id,{all:true}))]
      .filter(q=>!only||only.includes(q.id));
    if(this.isDemo()) return null;
    const tpl=_loadTextSync('prompts/team-review.txt'), venue=this.get().venue.name||'the restaurant';
    const cock=this.cocktails().length?`The cocktail list:\n${this._drinkLines()}`:'';
    // REVIEW_AT_ONCE batches are read at the same time (one on a phone; npm run team:review raises it for a long list).
    const ask=async qs=>{ const out={}, starts=[]; for(let i=0;i<qs.length;i+=this.REVIEW_BATCH) starts.push(i); let done=0;
      const lane=async()=>{ while(starts.length){ const i=starts.shift(), part=qs.slice(i,i+this.REVIEW_BATCH);
        const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{list}}',this._listLines()).replace('{{menu}}',this._menuFull()).replace('{{cocktails}}',cock).replace('{{items}}',part.map(q=>this._reviewItem(q)).join('\n\n'));
        let j=null; try{ j=this._json(await this._callRetry('team_review',prompt)); }catch(e){}
        (j&&j.reviews||[]).forEach(r=>{ if(r&&r.id&&part.some(q=>q.id===r.id)) out[r.id]=r; });
        done+=part.length; onStep&&onStep(done,qs.length); } };
      await Promise.all(Array.from({length:Math.max(1,Math.min(this.REVIEW_AT_ONCE||1,starts.length))},lane));
      return out; };
    const first=await ask(all), doubted=all.filter(q=>first[q.id]&&first[q.id].fit===false);
    // A wine card's own question is rewritten and read again; the rest are built from the list and can only be held.
    const card=doubted.filter(q=>q.wine&&!q.light&&!q.dish), fixTpl=_loadTextSync('prompts/team-fix.txt');
    for(let i=0;i<card.length;i+=this.FIX_BATCH) await this._rewrite(card.slice(i,i+this.FIX_BATCH).map(q=>({q,wine:q.wine,why:'sommelier',note:`${first[q.id].problem}: ${first[q.id].note}`})),fixTpl,venue);
    const again=card.length?await ask(card.map(q=>TeamLearn.wineQs(q.wine,{all:true}).find(x=>x.id===q.id)).filter(Boolean)):{};
    // A rewrite that disputes the list ("Check the list:") isn't a fix: it stays held, with the note, for the manager.
    const disputes=q=>{ const n=TeamLearn.wineQs(q.wine,{all:true}).find(x=>x.id===q.id); return !!(n&&/^check the list:/i.test(String(n.why||''))); };
    const held=doubted.filter(q=>!(card.includes(q)&&again[q.id]&&again[q.id].fit!==false&&!disputes(q))).map(q=>q.id);
    const d=this.get(); d.venue.reviewed={at:Date.now(),asked:all.length,doubted:doubted.length,fixed:doubted.length-held.length,held,
      notes:Object.fromEntries(held.map(id=>[id,{problem:(again[id]||first[id]).problem,note:(again[id]||first[id]).note}]))};
    this.save(d); return d.venue.reviewed; },
  reviewed(){ return (this.get().venue||{}).reviewed||null; },
  FIX_BATCH:8, FIX_ROUNDS:2,
  async checkQuestions(ids,onStep){
    const all=ids||this.wines().map(w=>w.id), asked=all.reduce((n,id)=>n+((this.card(id)||{}).qs||[]).length,0);
    const failed=TeamLearn.audit(all);
    let fixed=0;
    if(failed.length&&!this.isDemo()){
      const tpl=_loadTextSync('prompts/team-fix.txt'), venue=this.get().venue.name||'the restaurant';
      onStep&&onStep(0,failed.length);
      // Up to FIX_ROUNDS goes: a rewrite that fails the check again is sent back once more with its new reason.
      let todo=failed;
      for(let round=0;round<this.FIX_ROUNDS&&todo.length;round++){
      for(let i=0;i<todo.length;i+=this.FIX_BATCH){
        const part=todo.slice(i,i+this.FIX_BATCH);
        await this._rewrite(part,tpl,venue);
        if(!round) onStep&&onStep(Math.min(failed.length,i+this.FIX_BATCH),failed.length);
      }
      const ids2=new Set(todo.map(f=>f.q.id)); todo=TeamLearn.audit([...new Set(todo.map(f=>f.wine))]).filter(f=>ids2.has(f.q.id));
      }
      const still=new Set(TeamLearn.audit([...new Set(failed.map(f=>f.wine))]).map(f=>f.q.id));
      fixed=failed.filter(f=>!still.has(f.q.id)).length;
    }
    // Then the review of every question as the drill shows it (TeamLearn.review), listed on the console's Wines section.
    let flagged=0; try{ flagged=TeamLearn.review().length; }catch(e){}
    const d=this.get(); d.venue.checked={at:Date.now(),asked,failed:failed.length,fixed,left:failed.length-fixed,flagged}; this.save(d);
    return d.venue.checked;
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
    const list=this.wines().filter(w=>!this.isDrink(w)).map(w=>{ const c=this.card(w.id), s=c&&c.style; return `${w.id} | ${this.label(w)} | ${w.type} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}${s?` | body ${s.body}/5, acidity ${s.acid}/5, tannin ${s.tannin}/5, sweetness ${s.sweet}/5`:''}`; }).join('\n');
    let done=0; onStep&&onStep(0,dishIds.length);
    // The batches run at once (a 27-dish menu is three calls: 15 seconds together rather than 45 in a row).
    const batches=[]; for(let i=0;i<dishIds.length;i+=this.PAIR_BATCH) batches.push(dishIds.slice(i,i+this.PAIR_BATCH).map(id=>this.dish(id)).filter(Boolean));
    await Promise.all(batches.map(async xs=>{
      const ask=ys=>tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{list}}',list).replace('{{cocktails}}',this._drinkLines())
        .replace('{{dishes}}',ys.map(x=>`${x.name} | ${x.desc} | main: ${x.main} | ${x.cook} | ${(x.flav||[]).join(', ')}`).join('\n'));
      // As with the cards: a batch that fails is tried again, then one dish at a time.
      let j;
      try{ j=this._json(await this._callRetry('team_pairings',ask(xs)))||{}; }
      catch(e){ if(xs.length<2) throw e; j={pairings:[]}; for(const one of xs){ const j1=this._json(await this._callRetry('team_pairings',ask([one])))||{}; (j1.pairings||[]).forEach(p=>j.pairings.push(p)); } }
      const d=this.get();
      (j.pairings||[]).forEach(p=>{
        const x=xs.find(x=>x.name===p.dish); if(!x) return;
        const ok=id=>id&&d.wines[id]&&d.wines[id].onList;
        const wine=id=>ok(id)&&!this.isDrink(d.wines[id]), drink=id=>!!(d.cocktails||{})[id];
        d.pairings[x.id]={best:(p.best||[]).filter(b=>wine(b.id)),glass:p.glass&&wine(p.glass.id)?p.glass:null,avoid:p.avoid&&wine(p.avoid.id)?p.avoid:null,cocktail:p.cocktail&&drink(p.cocktail.id)?p.cocktail:null,at:Date.now()};
      });
      this.save(d);
      done+=xs.length; onStep&&onStep(done,dishIds.length);
    }));
  },
  /* Cocktail cards, CARD_BATCH a call, with the whole cocktail list and the menu (purpose team_cocktails). */
  async writeCocktailCards(ids,onStep){
    const tpl=_loadTextSync('prompts/team-cocktail-cards.txt'), venue=this.get().venue.name||'the restaurant';
    const line=c=>`${c.id} | ${c.name} | ${c.section} | ${c.price}${c.note?' ('+c.note+')':''} | ${(c.ingredients||[]).join(', ')}${c.by?' | by '+c.by:''}`;
    const list=this.cocktails().map(line).join('\n');
    let done=0; onStep&&onStep(0,ids.length);
    for(let i=0;i<ids.length;i+=this.CARD_BATCH){
      const cs=ids.slice(i,i+this.CARD_BATCH).map(id=>this.cocktail(id)).filter(Boolean);
      const prompt=tpl.replace(/\{\{venue\}\}/g,venue).replace('{{about}}',this.about()).replace('{{list}}',list).replace('{{menu}}',this._menuLines()).replace('{{cocktails}}',cs.map(line).join('\n'));
      const j=this._json(await window.claude.complete({purpose:'team_cocktails',messages:[{role:'user',content:prompt}]}))||{};
      const d=this.get(); d.cocktailCards=d.cocktailCards||{};
      const onMenu=new Set(this.dishes().map(x=>x.name));
      (j.cards||[]).forEach(c=>{ if(!c||!d.cocktails||!d.cocktails[c.id]) return;
        const qs=(c.qs||[]).filter(q=>q&&q.q&&Array.isArray(q.opts)&&q.opts.length===4&&q.opts[q.a]!=null).map((q,k)=>({...q,id:c.id+'#'+k}));
        d.cocktailCards[c.id]={...c,dishes:(c.dishes||[]).filter(x=>onMenu.has(x.dish)),alts:(c.alts||[]).filter(a=>d.cocktails[a.id]&&a.id!==c.id),qs,at:Date.now()}; });
      this.save(d);
      done+=cs.length; onStep&&onStep(done,ids.length);
    }
  },
  /* After a publish: cards for wines without one, then pairings for every dish (a new wine can be the
     best match for a dish that hasn't changed), then the new wines and dishes assigned to staff.
     onStep(label, done, total). */
  async refresh(res,onStep){
    // The demo's prepared arrivals (TeamSample.ARRIVALS) carry their card, pairings and window already,
    // so a bottle from that set publishes with no call at all; anything else is written here.
    const prepared=[...(res.added||[]),...(res.changed||[])].filter(id=>TeamSample.applyPrepared(id));
    const missing=this.wines().filter(w=>!this.card(w.id)).map(w=>w.id);
    if(missing.length) await this.writeCards(missing,(a,b)=>onStep&&onStep('Writing staff cards',a,b));
    const mixes=this.cocktails().filter(c=>!this.cocktailCard(c.id)).map(c=>c.id);
    if(mixes.length) await this.writeCocktailCards(mixes,(a,b)=>onStep&&onStep('Writing cocktail cards',a,b));
    const dishes=this.dishes().map(x=>x.id);
    const onlyPrepared=res.kind==='list'&&prepared.length&&prepared.length===(res.added||[]).length+(res.changed||[]).length&&!(res.removed||[]).length;
    const needPairs=dishes.length&&this.wines().length&&!onlyPrepared&&(res.kind==='list'||res.added.length||res.changed.length||res.removed.length||dishes.some(id=>!this.pairing(id)));
    const dated=this.wines().filter(w=>w.vintage&&!w.peak).map(w=>w.id);
    // Pairings and windows don't depend on each other, so they're written at the same time, reported as one step.
    const prog={p:0,w:0}, total=(needPairs?dishes.length:0)+dated.length, tell=()=>onStep&&onStep(needPairs&&dated.length?'Matching the menu and checking drinking windows':needPairs?'Matching wines to the menu':'Checking drinking windows',prog.p+prog.w,total);
    const jobs=[];
    if(needPairs) jobs.push(this.writePairings(dishes,(a)=>{ prog.p=a; tell(); }));
    if(dated.length) jobs.push(this.writeWindows(dated,(a)=>{ prog.w=a; tell(); }));
    if(jobs.length){ tell(); await Promise.all(jobs); }
    // Dish notes are written when the menu is published (or asked for from Upload), never on a list publish, so a new
    // bottle at the demo still publishes with no call.
    const noNotes=res.kind==='menu'||res.notes?this.dishes().filter(x=>!this.dishCard(x.id)).map(x=>x.id):[];
    if(noNotes.length) await this.writeDishCards(noNotes,(a,b)=>onStep&&onStep('Writing the dish notes',a,b));
    // Last, once the pairings are in (a table question is checked against them): every question checked
    // and the ones that fail rewritten, before anyone is assigned them.
    if(typeof TeamLearn!=='undefined'&&this.wines().length) await this.checkQuestions(null,(a,b)=>onStep&&onStep('Checking every question',a,b));
    // Then the sommelier's read of every question as the drill shows it; anything still doubted is held out of the drill.
    if(typeof TeamLearn!=='undefined'&&this.wines().length) await this.sommelierReview({onStep:(a,b)=>onStep&&onStep('A sommelier is reading every question',a,b)});
    if(typeof TeamLearn!=='undefined') TeamLearn.assign(res);
  },
  /* The drinking window for each dated wine (the consumer app's vintage_info, open to every account),
     kept on the wine as `peak` {from,to,rating,note}; the Wines tab and the card say where it is today. */
  async writeWindows(ids,onStep){
    const yr=new Date().getFullYear(); let done=0; onStep&&onStep(0,ids.length);
    const queue=[...ids], one=async()=>{ while(queue.length){ const id=queue.shift(); await this._window(id,yr); done++; onStep&&onStep(done,ids.length); } };
    await Promise.all(Array.from({length:Math.min(this.WINDOW_AT_ONCE,ids.length)},one));
  },
  WINDOW_AT_ONCE:3,
  async _window(id,yr){
      const w=this.wine(id);
      if(w&&w.vintage&&!w.peak){
        const prompt=`You are a sommelier. Assess the vintage quality and realistic drinking window for this specific wine. Wine: ${this.label(w)}. Type: ${w.type||'red'}, Region: ${w.region||''}, Country: ${w.country||''}. Grapes: ${(w.grapes||[]).join(', ')||'unknown'}. Return ONLY valid JSON (no markdown): {"vintage_rating":"Exceptional|Outstanding|Very Good|Good|Average","drink_from":${yr},"drink_to":2032,"peak_from":2025,"peak_to":2029,"note":"one concrete sentence on how this wine is developing right now and why, with no numbers in it"}.`;
        try{ const j=this._json(await window.claude.complete({purpose:'vintage_info',messages:[{role:'user',content:prompt}]}));
          if(j&&j.peak_from>0&&j.peak_to>=j.peak_from){ const d=this.get(); if(d.wines[id]) d.wines[id].peak={from:+j.peak_from,to:+j.peak_to,until:+j.drink_to||+j.peak_to,rating:j.vintage_rating||'',note:j.note||''}; this.save(d); } }catch(e){}
      }
  },
  /* Where a wine is in its life today: {stage:'young'|'ready'|'old', word, line}, from its window
     when written, else the consumer app's estimate from type (ScanFlow.drinkWindow). */
  window(w){
    if(!w||!w.vintage) return null;
    const yr=new Date().getFullYear();
    if(w.peak){ const {from,to,until}=w.peak, stage=yr<from?'young':yr<=(until||to)?'ready':'old';
      return {stage,from,to,until:until||to,source:'claude',word:stage==='young'?'Still young':stage==='ready'?(yr<=to?'At its peak':'Drinking well'):'Past its best',
        line:stage==='young'?`Best from ${from} to ${to}`:stage==='ready'?`At its best until about ${to}${until>to?`, drinking well to ${until}`:''}`:`Was at its best up to ${to}`}; }
    const e=ScanFlow.drinkWindow({vintage:w.vintage,type:w.type}); if(!e) return null;
    return {stage:e.stage,from:e.from,to:e.to,until:e.to,source:'estimate',word:e.word,line:e.line+' (an estimate)'};
  },
  /* The whole restaurant as one JSON file (what data/team-demo.json holds for the demo), downloaded. */
  async exportFile(){
    const d=this.get();
    const out={venue:{name:d.venue.name},wines:Object.values(d.wines).filter(w=>w.onList).sort((a,b)=>a.order-b.order),dishes:Object.values(d.dishes).filter(x=>x.onMenu).sort((a,b)=>a.order-b.order),cards:d.cards,pairings:d.pairings,
      ...(this.cocktails().length?{cocktails:this.cocktails(),cocktailCards:d.cocktailCards||{}}:{}),...(Object.keys(d.dishCards||{}).length?{dishCards:d.dishCards}:{}),...(d.venue.reviewed?{reviewed:d.venue.reviewed}:{}),exported:new Date().toISOString()};
    const name=`vinterest-team-${this._slug(d.venue.name||'restaurant')}.json`;
    try{ await Platform.saveFile(name,JSON.stringify(out,null,1)); }catch(e){ const a=document.createElement('a'); a.href='data:application/json;charset=utf-8,'+encodeURIComponent(JSON.stringify(out)); a.download=name; a.click(); }
    return out;
  },
  /* A single bottle from its label (the consumer app's label_scan), as a list item ready for a draft. */
  async readLabel(b64){
    const text=await window.claude.complete({purpose:'label_scan',messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},{type:'text',text:_loadTextSync('prompts/label-scan.txt')}]}]});
    const w=WineDNA.cleanWine(JSON.parse(String(text).replace(/```json|```/g,'').trim()));
    if(!w||w.error==='no_wine_label'||!w.name) return null;
    // The year belongs in `vintage`, never in the name, or "Viña Ardanza Reserva 2016" is a different wine from the list's "Viña Ardanza Reserva".
    const yr=/^\d{4}$/.test(String(w.vintage))?String(w.vintage):null; if(yr) w.name=w.name.replace(new RegExp('\\s*\\b'+yr+'\\b\\s*$'),'').trim()||w.name;
    return {producer:w.producer||'',name:w.name,vintage:/^\d{4}$/.test(String(w.vintage))?+w.vintage:null,type:String(w.type||'red').toLowerCase().replace('rose','rosé'),
      region:w.region||'',country:w.country||'',grapes:w.grapes||[],grapes_basis:w.grapes_basis||'typical',section:'',glass:'',bottle:'',other:'',bin:'',confidence:w.confidence||'medium',price_usd:w.price_usd||null};
  },
  /* Adds one wine to a draft of the live list (so the review says "1 new"), for Add a wine from a label. */
  draftAdd(item){
    const live=this.wines().map(w=>({...w}));
    const next={...item,section:item.section||this._sectionFor(item.type)};
    // The same wine already on the list (another vintage, say) is replaced in the draft, so the review
    // says "vintage 2015 → 2016" rather than "1 new" for a wine the floor already knows.
    const i=live.findIndex(w=>this._same(w,next));
    if(i>=0){ live[i]={...live[i],...next,id:live[i].id,section:next.section||live[i].section}; return this.setDraft('list',live); }
    return this.setDraft('list',[...live,{...next,order:live.length}]);
  },
  /* The console's edits go through the same draft and Publish as an upload, so one audit trail (versions)
     holds every change: a wine's prices, section or glass/bottle; a wine taken off; a dish's price or words. */
  draftEdit(id,fields){ const live=this.wines().map(w=>({...w})), i=live.findIndex(w=>w.id===id); if(i<0) return null; live[i]={...live[i],...fields}; return this.setDraft('list',live.map((w,k)=>({...w,order:k}))); },
  draftRemove(id){ if(!this.wine(id)) return null; return this.setDraft('list',this.wines().filter(w=>w.id!==id).map((w,k)=>({...w,order:k}))); },
  draftEditDish(id,fields){ const live=this.dishes().map(x=>({...x})), i=live.findIndex(x=>x.id===id); if(i<0) return null; live[i]={...live[i],...fields}; return this.setDraft('menu',live.map((x,k)=>({...x,order:k}))); },
  /* A manager's own words on a card replace Claude's; the card remembers it was edited. */
  setCard(id,fields){ const d=this.get(); if(!d.cards[id]) return; d.cards[id]={...d.cards[id],...fields,edited:Date.now()}; this.save(d); },
  _sectionFor(type){ const secs=this.wines().map(w=>w.section).filter(Boolean); const t=String(type||'').toLowerCase();
    const want=t==='sparkling'?/spark|champ|fizz/i:t==='white'?/white/i:t==='rosé'||t==='rose'||t==='orange'?/ros|orange/i:t==='dessert'||t==='fortified'?/sweet|dessert|fortif|port|sherry/i:/red/i;
    return secs.find(s=>want.test(s))||secs[0]||''; },
  /* What still needs writing (an upload that was interrupted): wines without cards, dishes without pairings. */
  pending(){ return {dishNotes:this.dishes().filter(x=>!this.dishCard(x.id)).length,cocktails:this.cocktails().filter(c=>!this.cocktailCard(c.id)).length,cards:this.wines().filter(w=>!this.card(w.id)).length,pairings:this.wines().length?this.dishes().filter(x=>!this.pairing(x.id)).length:0,windows:this.wines().filter(w=>w.vintage&&!w.peak).length}; },
};
/* The sample restaurant (data/team-sample.json): a ten-wine list, a seven-dish menu, their staff cards
   and pairings written ahead, and four staff, so the app can be shown without an upload or a call. */
// TeamData.get's kept copy is dropped whenever its key is written, here or in another tab.
try{ Store.subscribe(k=>{ if(k===TeamData.KEY) TeamData._fresh=false; }); window.addEventListener('storage',e=>{ if(!e.key||e.key===TeamData.KEY) TeamData._fresh=false; }); }catch(e){}
const TeamSample = {
  /* `which`: 'sample' (The Copper Pan, small, written by hand) or 'demo' (The Larkspur, 60 wines and 27
     dishes for the wine-show demo: data/team-demo.json once it has been written by a publish and
     exported, else just its list and menu, data/team-demo-list.json, for the training to be written). */
  /* `social`: The Social Corner, Vancouver (Per Se Hospitality Group), a real restaurant's install from its
     website (intake/perse/): its list and menu (data/team-social-list.json), its branding and currency, and
     its training once written and exported (data/team-social.json). No invented staff: whoever opens it
     sets themselves up as its manager (TeamSetup). `princess-royal`: The Princess Royal, Notting Hill (Cubitt House), the
     same kind of install from the menus and wine list on its site (intake/princess-royal/), in pounds, for a sales pitch. */
  /* Every seed the build carries. `kind` is how it behaves (a real install's copy, 'social', or a demo, 'demo'); the
     paths are literal in file() and list() because the build collects _loadJSON's paths by scanning for them. */
  SEEDS:{sample:{kind:'sample'},demo:{kind:'demo'},social:{kind:'social',label:'The Social Corner'},'princess-royal':{kind:'social',label:'The Princess Royal'}},
  kind(which){ return (this.SEEDS[which]||{}).kind||null; },
  social(which){ return this.kind(which)==='social'; },
  file(which){ return which==='demo'?_loadJSON('data/team-demo.json'):which==='social'?_loadJSON('data/team-social.json'):which==='princess-royal'?_loadJSON('data/team-princess-royal.json'):_loadJSON('data/team-sample.json'); },
  /* The list file: where an installed restaurant's venue details, cocktails and staff live. */
  list(which){ return which==='demo'?_loadJSON('data/team-demo-list.json'):which==='social'?_loadJSON('data/team-social-list.json'):which==='princess-royal'?_loadJSON('data/team-princess-royal-list.json'):null; },
  // ?seed=perse was The Social Corner's first name on another branch; ?seed=princess is The Princess Royal's short address.
  ALIAS:{perse:'social',princess:'princess-royal'},
  load(which='sample'){ which=this.ALIAS[which]||which;
    let s=this.file(which);
    if(which==='demo'&&(!s||s.pending)) s={..._loadJSON('data/team-demo-list.json'),cards:{},pairings:{},staff:null};
    if(this.social(which)&&(!s||s.pending)) s={...this.list(which),cards:{},pairings:{},staff:[]};
    if(!s) return false;
    const now=Date.now(), d=TeamData._empty();
    // A newer copy of the restaurant already on this phone (a build with rewritten training or a new list) replaces
    // the list, cards and pairings but keeps the team, everyone's progress and the sales: answers are keyed by wine
    // and question id, which a new copy keeps, so testing carries on where it was instead of starting again.
    // The Larkspur is invented from end to end, so an older copy of it is replaced whole (its team, progress and
    // sales seeded again): a visitor from the website always meets the demo as it now is.
    const keep=which!=='demo'&&(TeamData.get().venue||{}).sample===which&&TeamLearn.people().length>0;
    // A changed demo story (TeamDemo.STORY) re-invents a kept restaurant's sales, which are demo data too; its team's progress stays.
    const story=s=>(String(s||'').match(/\|story(\d+)$/)||[])[1]||null, newStory=keep&&story((TeamData.get().venue||{}).seeded)!==String(TeamDemo.STORY);
    // The installed restaurant's own details (city, style, currency, brand) come with it; the list file is
    // where they're kept, so a training file exported later doesn't need to carry them.
    const meta=(this.list(which)||{}).venue||{};
    d.venue={...meta,name:s.venue.name,created:now,sample:which,seeded:this.stamp(which)};
    if(s.reviewed) d.venue.reviewed=s.reviewed; // the sommelier review the file was handed over with (npm run team:review) // seeded: which copy of the files this is, so a newer build reloads it
    s.wines.forEach((w,i)=>{ d.wines[w.id]={...w,onList:true,order:i,addedAt:now-30*86400000}; });
    s.dishes.forEach((x,i)=>{ d.dishes[x.id]={...x,onMenu:true,order:i,addedAt:now}; });
    Object.values(s.cards).forEach(c=>{ d.cards[c.id]={...TeamData._cleanCard(c,d),at:now}; });
    Object.entries(s.pairings).forEach(([id,p])=>{ d.pairings[id]={...p,at:now}; });
    // The Social Corner's cocktails come from its list file; their cards, once written, from its training file.
    const mixes=s.cocktails||(this.social(which)?(this.list(which)||{}).cocktails:null)||[];
    mixes.forEach((c,i)=>{ d.cocktails[c.id]={...c,onList:true,order:i,addedAt:now}; });
    Object.entries(s.cocktailCards||{}).forEach(([id,c])=>{ if(d.cocktails[id]) d.cocktailCards[id]={...c,at:now}; });
    d.dishCards={}; Object.entries(s.dishCards||{}).forEach(([id,c])=>{ if(d.dishes[id]) d.dishCards[id]={...c,at:now}; });
    d.versions.push({kind:'list',at:now,added:Object.keys(d.wines),removed:[],changed:[]});
    if(mixes.length) d.versions.push({kind:'cocktails',at:now,added:Object.keys(d.cocktails),removed:[],changed:[]});
    TeamData.save(d);
    // The install's training depth (venue.training in its list file: the tier, and a tier per role) applies to a
    // restaurant that hasn't set one yet, on a fresh load or a kept team alike; a manager's own choice is never undone.
    const training=meta.training||{}; const applyTier=()=>{ if(TeamLearn.team().tier!=null) return; if(training.tier) TeamLearn.setTier(training.tier); Object.entries(training.roleTiers||{}).forEach(([r,t])=>TeamLearn.setRoleTier(r,t)); };
    if(keep){ // anyone the new copy's team adds joins (by name), and the demo sales are written if there are none
      applyTier();
      const have=new Set(TeamLearn.people().map(p=>p.name.toLowerCase()));
      (s.staff||(this.social(which)?(this.list(which)||{}).staff||[]:[])).filter(p=>!have.has(String(p.name).toLowerCase())).forEach(p=>TeamLearn.addPerson(p.name,p.role,p.photo||null));
      TeamLearn.people().forEach(p=>TeamLearn.assignExisting(p.id));
      if(newStory&&typeof TeamSales!=='undefined') TeamSales.clear();
      if((which==='demo'||this.social(which))&&typeof TeamSales!=='undefined'&&!(TeamSales.get().rows||[]).length) TeamSales.seedDemo();
      return true; }
    Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); if(typeof TeamSales!=='undefined') TeamSales.clear(); Store.remove(TeamData.TONIGHT); if(typeof TeamShift!=='undefined') TeamShift.reset();
    // The Social Corner's demo team is the Larkspur's people and photos in its own roles (data/team-social-list.json staff).
    (s.staff||(this.social(which)?(this.list(which)||{}).staff||[]:this.DEMO_STAFF)).forEach(p=>TeamLearn.addPerson(p.name,p.role,p.photo||null));
    applyTier();
    if((which==='demo'||this.social(which))&&Object.keys(d.cards).length) TeamDemo.seedProgress();
    return true;
  },
  /* The demo's size in words for the button that opens it, from its own files. */
  demoLine(){ const s=_loadJSON('data/team-demo-list.json')||{}, d=_loadJSON('data/team-demo.json')||{}, n=k=>(s[k]||[]).length;
    const staff=((d.staff&&d.staff.length)?d.staff:this.DEMO_STAFF).length;
    return `${n('wines')} wines, ${n('dishes')} dishes, a team of ${['','one','two','three','four','five','six','seven','eight','nine','ten'][staff]||staff}`; },
  /* The Social Corner's size in words for its button on the setup screen. */
  socialLine(which='social'){ const s=this.list(which)||{}, n=k=>(s[k]||[]).length;
    return `Vancouver · ${n('wines')} wines, ${n('cocktails')} cocktails, ${n('dishes')} dishes, a team of ${n('staff')}`; },
  /* The Copper Pan is no longer offered (the setup screen has only The Larkspur); it stays for the tests,
     which open it with ?seed=sample. A device left on it without asking goes back to the setup screen. */
  retire(){ const v=TeamData.get().venue||{}; if(v.sample!=='sample') return false;
    TeamData.reset(); Store.remove(TeamLearn.KEY); TeamLearn.resetProgress(); if(typeof TeamSales!=='undefined') TeamSales.clear(); return true; },
  // The Larkspur's team (photos in team/faces/). The manager is first, so the demo opens as her.
  /* The restaurant a demo address opens (socialcorner.vinterest.team → The Social Corner), as ?seed would; the
     Worker's VENUE_HOSTS sends that address's root to /team/. Null anywhere else. */
  HOSTS:{'socialcorner.vinterest.team':'social','princessroyal.vinterest.team':'princess-royal','demo.vinterest.team':'demo'},
  hostSeed(host){ try{ return this.HOSTS[String(host==null?location.hostname:host).toLowerCase()]||null; }catch(e){ return null; } },
  /* Whether the restaurant on the device is this seed as the build now carries it. */
  current(which){ which=this.ALIAS[which]||which; const v=TeamData.get().venue||{}; if(v.sample!==which) return false;
    return (v.seeded||null)===this.stamp(which); },
  /* Which copy of a seed's files this build carries: the training file's export time, and for The Social Corner
     the list file's `rev` too, since its team, cocktails and staff live there (a new team with the same training
     must still reload a device that opened the old one). */
  stamp(which){ const s=this.file(which), base=(s&&s.exported)||null; if(!this.social(which)&&which!=='demo') return base;
    const rev=(this.list(which)||{}).rev||null; return `${base||''}|${rev||''}|story${TeamDemo.STORY}`; },
  /* The demo's prepared new arrivals (data/team-demo-arrivals.json, photos in team/labels/): two real
     bottles whose label reading, staff card, pairings and drinking window were written once through
     the Worker, so "Add a wine from its label" can run with no network and in seconds. Live reading
     of any other bottle stays as it is. */
  ARRIVALS(){ const j=_loadJSON('data/team-demo-arrivals.json'); return j&&Array.isArray(j.arrivals)?j.arrivals.filter(a=>a.label):[]; },
  arrival(id){ return this.ARRIVALS().find(a=>TeamData.wineId(a.label)===id)||null; },
  /* Puts a prepared arrival's card, window and pairings in place for a wine just published (TeamData.refresh).
     Only in the demo restaurant: the card talks about The Larkspur's menu. Returns whether it did. */
  applyPrepared(id){ if(!TeamData.isDemo()) return false; const a=this.arrival(id); if(!a) return false; const d=TeamData.get(); if(!d.wines[id]||!d.wines[id].onList) return false;
    if(a.card) d.cards[id]={...TeamData._cleanCard({...a.card,id},d),at:Date.now(),prepared:true};
    if(a.peak&&d.wines[id].vintage===a.peakVintage) d.wines[id].peak={...a.peak}; else if(a.peak&&d.wines[id].vintage) delete d.wines[id].peak;
    const ok=x=>x&&d.wines[x.id]&&d.wines[x.id].onList;
    Object.entries(a.pairings||{}).forEach(([did,p])=>{ if(!d.dishes[did]||!d.dishes[did].onMenu) return; const mentions=[...(p.best||[]),p.glass,p.avoid].some(x=>x&&x.id===id); if(!mentions) return;
      d.pairings[did]={best:(p.best||[]).filter(ok),glass:ok(p.glass)?p.glass:null,avoid:ok(p.avoid)?p.avoid:null,at:Date.now()}; });
    TeamData.save(d); return true; },
  DEMO_STAFF:[{name:'Elena Ruiz',role:'manager',photo:'faces/1.png'},{name:'Claire Whitfield',role:'sommelier',photo:'faces/3.png'},{name:'David Chen',role:'buyer',photo:'faces/6.png'},
    {name:'Marco Delgado',role:'bartender',photo:'faces/5.png'},{name:'Dani Haddad',role:'server',photo:'faces/2.png'},{name:'Priya Nair',role:'server',photo:'faces/7.png'},{name:'Amara Okafor',role:'server',photo:'faces/4.png'}],
};
/* The demo's staff at different stages of training (docs/business.md), seeded with dated answers so
   readiness, Slipping, overdue assignments and the retention checks all show something true. */
const TeamDemo = {
  DAY:86400000,
  /* The demo story's own version, part of every demo seed's stamp (TeamSample.stamp). Raise it whenever the code
     that seeds a demo changes what it shows (who has learnt what, the sales, the logo files), since only a
     changed stamp reloads a device that already has the restaurant. */
  STORY:3,
  /* A list in the order a restaurant teaches it and pushes it: dry before sweet, cheapest first. The demo's
     sales favour the first half (TeamSales.seedDemo), so the house pours sell most and are the ones a
     working team already knows. */
  house(list,k){ const price=w=>{ const m=/\d+(?:\.\d+)?/.exec(String(w[k]||'')); return m?+m[0]:999; }, sweet=w=>/sweet|fortif|dessert/i.test(w.section||'')||/fortified|dessert/.test(w.type||'');
    return [...list].sort((a,b)=>(sweet(a)-sweet(b))||(price(a)-price(b))); },
  seedProgress(){
    const now=Date.now(), ppl=TeamLearn.people(), by=role=>ppl.find(p=>p.role===role), srv=ppl.filter(p=>p.role==='server');
    const P=TeamLearn._batchP=TeamLearn._all(); // every answer below lands here; saved once at the end
    const learn=(pid,wines,kinds,at,sure='sure')=>wines.forEach(w=>[...TeamLearn.wineQs(w.id),...TeamLearn.lightQs(w.id)].filter(q=>kinds.includes(q.k)).forEach(q=>TeamLearn.record(pid,q,true,sure,at)));
    // Dishes learned at `at` and kept fresh since (a single old answer would have faded by today).
    const dishes=(pid,xs,at,keep=true)=>xs.forEach(x=>TeamLearn.dishQs(x.id).forEach(q=>{ let t=at, it=TeamLearn.record(pid,q,true,'sure',t);
      for(let i=0;keep&&i<12&&it.due<now+this.DAY;i++){ t=Math.min(now-this.DAY/2,it.due); it=TeamLearn.record(pid,q,true,'sure',t); } }));
    // Each list in the order a restaurant teaches it: the house pours first (dry before sweet, cheapest first, as
    // they sell most), so whoever has started knows the best sellers before the rest, as a working team would.
    const all=TeamData.wines(), glass=this.house(all.filter(TeamData.byGlass),'glass'), bottle=this.house(all.filter(w=>!TeamData.byGlass(w)),'bottle'), menu=TeamData.dishes();
    const spaced=(pid,wines,kinds,firstDaysAgo,steps)=>{ // learned long ago and refreshed on schedule, so it's known today
      wines.forEach(w=>[...TeamLearn.wineQs(w.id),...TeamLearn.lightQs(w.id)].filter(q=>kinds.includes(q.k)).forEach(q=>{ let t=now-firstDaysAgo*this.DAY, it=null;
        for(let i=0;i<12&&(i<steps||(it&&it.due<now+this.DAY));i++){ it=TeamLearn.record(pid,q,true,'sure',t); t=Math.min(now-this.DAY/2,it.due); } })); };
    const check=(pid,n,okShare)=>{ const m=TeamLearn._mine(P,pid); for(let i=0;i<n;i++) m.checks.push({at:now-Math.round(Math.random()*25)*this.DAY,ok:i<Math.round(n*okShare),id:'x'+i}); };
    // Each person knows a share of the list in the order it's taught (house glasses first, then bottles), at the rungs
    // their role needs, so every restaurant, 30 wines or 132, shows the same working team: two ready, the manager and one more nearly
    // there, one slipping, one behind and one new this week. A person the plan doesn't name knows half.
    const order=[...glass,...bottle], mixes=TeamData.cocktails();
    const spacedQs=(pid,qs,firstDaysAgo,steps)=>qs.forEach(q=>{ let t=now-firstDaysAgo*this.DAY, it=null;
      for(let i=0;i<12&&(i<steps||(it&&it.due<now+this.DAY));i++){ it=TeamLearn.record(pid,q,true,'sure',t); t=Math.min(now-this.DAY/2,it.due); } });
    const qsOf=(p,id,cocktail)=>{ const ks=TeamLearn.kindsFor(p.role,id); return (cocktail?TeamLearn.cocktailQs(id):[...TeamLearn.wineQs(id),...TeamLearn.lightQs(id)]).filter(q=>ks.includes(q.k)); };
    // A readiness to reach, not a share of the list: a server's minimum is mostly the glass list and a sommelier's the whole of
    // it, so the same share lands differently by role and by restaurant. Wines are learnt in teaching order, checked every few.
    const PLAN={Claire:{to:100,checks:[14,0.93]},Elena:{to:76,checks:[8,0.88]},David:{to:100,checks:[9,0.89]},Dani:{to:82,checks:[7,0.86]},
      Marco:{to:62,stale:0.35,wasReady:20,checks:[6,0.5]},Priya:{to:36,overdue:true,checks:[3,0.67]},Amara:{to:18,newbie:true}};
    const pct=pid=>TeamLearn.readiness(pid).pct;
    ppl.forEach(p=>{ const plan=PLAN[String(p.name).split(' ')[0]]||{to:60}, days=plan.newbie?4:40, steps=plan.newbie?1:3;
      dishes(p.id,menu.slice(0,Math.round(menu.length*Math.min(1,plan.to/100+0.1))),now-(plan.newbie?2:5)*this.DAY);
      if(mixes.length) mixes.slice(0,Math.round(mixes.length*plan.to/100)).forEach(c=>spacedQs(p.id,qsOf(p,c.id,true),days,steps));
      // Someone meant to be ready learns until they are (a figure that rounds to 100% can still be one part short).
      const short=()=>plan.to>=100?TeamLearn.readiness(p.id).state!=='ready':pct(p.id)<plan.to;
      let n=0; while(n<order.length&&short()){ order.slice(n,n+3).forEach(w=>spacedQs(p.id,qsOf(p,w.id),days,steps)); n+=3; }
      if(plan.to>=100&&short()){ mixes.forEach(c=>spacedQs(p.id,qsOf(p,c.id,true),days,steps)); dishes(p.id,menu,now-5*this.DAY); }
      // Slipping: the next part of the list learnt once, weeks ago, and not drilled since, so it has faded.
      if(plan.stale) order.slice(n,n+Math.round(order.length*plan.stale)).forEach(w=>qsOf(p,w.id).forEach(q=>TeamLearn.record(p.id,q,true,'sure',now-24*this.DAY)));
      const m=TeamLearn._mine(P,p.id);
      if(plan.wasReady) m.wasReady=now-plan.wasReady*this.DAY;
      // Behind: the list was assigned twelve days ago and was due five days ago. New: assigned two days ago, due in five.
      if(plan.overdue) Object.values(m.assigned).forEach(a=>{ a.at=now-12*this.DAY; a.due=now-5*this.DAY; });
      if(plan.newbie) Object.values(m.assigned).forEach(a=>{ a.at=now-2*this.DAY; a.due=now+5*this.DAY; });
      if(plan.checks) check(p.id,...plan.checks); });
    TeamLearn._batchP=null; TeamLearn._saveAll(P);
    ppl.forEach(p=>TeamLearn.note(p.id));
    // Three wines went on the list nine days ago, so new-wine adoption has something to show; then the till.
    const d=TeamData.get(), recent=[...glass.slice(-2),...bottle.slice(-1)]; recent.forEach(w=>{ if(d.wines[w.id]) d.wines[w.id].addedAt=now-9*this.DAY; }); TeamData.save(d);
    if(typeof TeamSales!=='undefined') TeamSales.seedDemo();
  },
};
/* The writing after a publish, run in the background (docs/business.md): a manager publishes and
   carries on with the console or the app while the cards, pairings and windows are written; a chip
   says where it is (team-screens.jsx TeamJobChip) and what's written lands as it's saved. One job
   at a time; a job that stops keeps what it wrote, and the Upload tab's "Write them now" resumes. */
const TeamJobs = {
  _cur:null,
  current(){ return this._cur; },
  _emit(){ try{ window.dispatchEvent(new Event('vbiz:job')); }catch(e){} },
  start(res,{label}={}){ if(this._cur&&this._cur.running) return this._cur;
    const job=this._cur={id:Date.now(),running:true,label:label||'Writing the training',step:'Starting',a:0,b:0,error:null,done:false,kind:res&&res.kind,added:(res&&res.added||[]).length};
    this._emit();
    Promise.resolve().then(()=>TeamData.refresh(res,(step,a,b)=>{ Object.assign(job,{step,a,b}); this._emit(); }))
      .then(()=>{ job.running=false; job.done=true; job.step='Published'; this._emit(); },e=>{ job.running=false; job.error=(e&&e.message)||'Writing the training stopped.'; this._emit(); });
    return job; },
  dismiss(){ if(this._cur&&!this._cur.running) this._cur=null; this._emit(); },
};
/* How each person has laid out the console's dashboard: the order of its cards and which are folded, kept per
   person on this device (vbiz_console_layout_v1, never synced). A card the console adds later joins at the end in
   its default place; one it drops is forgotten. */
const TeamLayout = {
  KEY:'vbiz_console_layout_v1',
  _all(){ return Store.getJSON(this.KEY,{})||{}; },
  get(pid,ids){ const d=(this._all()[pid])||{}, seen=(d.order||[]).filter(k=>ids.includes(k));
    return {order:[...seen,...ids.filter(k=>!seen.includes(k))],folded:new Set((d.folded||[]).filter(k=>ids.includes(k)))}; },
  _save(pid,order,folded){ const all=this._all(); all[pid]={order,folded:[...folded]}; Store.setJSON(this.KEY,all); },
  move(pid,ids,id,to){ const {order,folded}=this.get(pid,ids), from=order.indexOf(id); if(from<0) return; order.splice(from,1); order.splice(Math.max(0,Math.min(order.length,to)),0,id); this._save(pid,order,folded); },
  toggle(pid,ids,id){ const {order,folded}=this.get(pid,ids); folded.has(id)?folded.delete(id):folded.add(id); this._save(pid,order,folded); },
  reset(pid){ const all=this._all(); delete all[pid]; Store.setJSON(this.KEY,all); },
};
Object.assign(window,{TeamDemo,TeamJobs,TeamLayout});
Object.assign(window,{TeamData,TeamSample});

/* A restaurant's own accent (venue.brand.accent, from its list file) in place of Vinterest's crimson. apply()
   runs on every render of the team app, so changing restaurant changes the look at once; with no brand it
   puts the crimson back. Its logo and mark are drawn by the header and console (TeamData.brand). */
const TeamBrand = {
  _crimson:null,
  get(){ return TeamData.brand(); },
  apply(){ if(this._crimson==null) this._crimson=C.cr; const b=this.get(); C.cr=b&&b.accent?b.accent:this._crimson; return b; },
};
Object.assign(window,{TeamBrand});

/* Which sections of a wine's or cocktail's card this person keeps folded, on this device (vbiz_fold_v1, never
   synced): someone checking a price or a pairing in service gets straight to it, and the sections they never use
   stay out of the way. {section key: true when folded}; a section not yet touched takes its default. */
const TeamFold = {
  KEY:'vbiz_fold_v1',
  _all(){ return Store.getJSON(this.KEY,{})||{}; },
  folded(k,def=false){ const v=this._all()[k]; return typeof v==='boolean'?v:def; },
  set(k,v){ const a=this._all(); a[k]=!!v; Store.setJSON(this.KEY,a); },
};
Object.assign(window,{TeamFold});
