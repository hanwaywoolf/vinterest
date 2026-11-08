/* TeamVinny: Vinny in the staff app (docs/business.md). Three things, each grounded in this
   restaurant's own list, menu, staff cards and pairings:

   - Vinny's test (test): a drill aimed at what this person needs to work on, from what TeamLearn
     already knows about them: answers that have faded or were missed, the parts of their role's
     minimum they're short of, wines and dishes assigned and not yet learnt, and what the till sells
     most that they don't know. A request ("the reds under £50", "the dessert wines", "the menu")
     narrows it, read here without a call. The questions are the cards' own, answered in the drill,
     so they count like any drill. No Claude call: the reason is written here too.
   - Ask Vinny (ask): a quick answer to anything about the list, a bottle, a grape, the menu, a
     pairing or a price, from the list and menu (every wine and dish as one line) and the cards of
     the wines the question is about (prompts/team-vinny.txt, purpose team_vinny). It names the wines
     and dishes it talks about, so the screen can open their cards.
   - A guest at the table (scenario, guest): Vinny plays a diner with a dish, a wish and sometimes a
     wrong idea, built here from the pairings so there's a right answer; the server replies in their
     own words, and Vinny answers as the guest, then marks the exchange against that answer
     (prompts/team-guest.txt, purpose team_guest). It never moves readiness: that comes from drills.
   Stored on this device (vbiz_vinny_v1): the last few questions asked, and each person's step of help at
   the table (choices, hints or on their own) with the tables that moved it. */
const TeamVinny = {
  KEY:'vbiz_vinny_v1', TEST_SIZE:10, TURNS:2, GUEST_TURNS:3, LIST_MAX:150, CARDS_MAX:4,

  /* ── Vinny's test ── */
  _ctx(pid){
    const person=TeamLearn.person(pid); if(!person) return null;
    const role=person.role, kinds=TeamLearn.ROLES[role].kinds, items=TeamLearn._mine(TeamLearn._all(),pid).items, sc=TeamLearn.scope(role);
    return {person,role,kinds,items,sc,wines:[...sc.glass,...sc.bottle],dishes:sc.dishes,now:Date.now()};
  },
  // The questions on a wine or dish this person may be asked now: rungs open to them, unknown first.
  _qsFor(c,{wine,dish}){
    const qs=wine?TeamLearn.qsFor(c.role,wine.id):TeamLearn.dishQsFor(c.role,dish.id);
    const open=qs.filter(q=>q.dish||TeamLearn._open(qs,c.items,q.k,c.kinds,TeamLearn.tier(c.role)));
    const unknown=open.filter(q=>!TeamLearn.known(c.items[q.id],c.now)), known=open.filter(q=>TeamLearn.known(c.items[q.id],c.now));
    return {unknown,known:known.sort((a,b)=>(c.items[a.id].last||0)-(c.items[b.id].last||0))};
  },
  _price(s){ const m=String(s||'').replace(/,/g,'').match(/(\d+(?:\.\d+)?)/); return m?Number(m[1]):null; },
  _words(s){ return TeamLearn._norm(s).split(' ').filter(w=>w.length>3&&!this._STOP.has(w)); },
  _STOP:new Set(['what','which','with','that','this','from','have','about','wine','wines','glass','bottle','bottles','under','over','than','less','more','test','quiz','tonight','list','menu','dish','dishes','food','some','them','they','their','does','should','would','could','there','here','into','your','ours','best','good']),
  TYPE_NAME:{red:'the reds',white:'the whites','rosé':'the rosés',sparkling:'the sparkling wines',sweet:'the sweet wines',fortified:'the fortified wines',orange:'the orange wines'},
  TYPES:{red:/\breds?\b/,white:/\bwhites?\b/,'rosé':/\bros[eé]s?\b/,sparkling:/\b(sparkling|fizz|bubbles|champagne)\b/,sweet:/\b(sweet|dessert|pudding)\b/,fortified:/\b(fortified|port|sherry|madeira)\b/,orange:/\borange wines?\b/},
  /* What a request asks to be tested on, read without a call: {wines, dishes, label} or null for no request. */
  narrow(c,ask){
    const a=String(ask||'').toLowerCase().trim(); if(!a) return null;
    let wines=[...c.wines], dishes=[...c.dishes], label=[];
    const types=Object.entries(this.TYPES).filter(([,re])=>re.test(a)).map(([t])=>t);
    const wantMenu=/\b(menu|food|dish|dishes|pairings?|starters?|mains?|desserts?|snacks?)\b/.test(a)&&!types.length;
    if(types.length){ wines=wines.filter(w=>types.includes(w.type)||(types.includes('sweet')&&/sweet|dessert/i.test(w.section||''))||(types.includes('fortified')&&/fortified|port|sherry/i.test(w.section||''))); dishes=[]; label.push(types.map(t=>this.TYPE_NAME[t]||t).join(' and ')); }
    if(/\bby the glass\b|\bglass(es)?\b/.test(a)){ wines=wines.filter(w=>TeamData.byGlass(w)); dishes=[]; label.push('by the glass'); }
    else if(/\bbottles?\b/.test(a)){ wines=wines.filter(w=>!TeamData.byGlass(w)); dishes=[]; label.push('the bottles'); }
    const under=a.match(/(?:under|below|less than|up to)\s*[£$€]?\s*(\d+)/), over=a.match(/(?:over|above|more than)\s*[£$€]?\s*(\d+)/);
    const cost=w=>this._price(w.bottle)||this._price(w.glass);
    if(under){ wines=wines.filter(w=>cost(w)!=null&&cost(w)<=+under[1]); dishes=[]; label.push(`under ${TeamData.money(+under[1])}`); }
    if(over){ wines=wines.filter(w=>cost(w)!=null&&cost(w)>=+over[1]); dishes=[]; label.push(`over ${TeamData.money(+over[1])}`); }
    if(/\bnew\b|\bassigned\b|\bjust arrived\b/.test(a)){ const as=new Set(TeamLearn.assignments(c.person.id).map(x=>x.id)); wines=wines.filter(w=>as.has(w.id)); dishes=dishes.filter(x=>as.has(x.id)); label.push('what\'s new'); }
    if(wantMenu){ wines=[]; label.push('the menu'); }
    // Names: a producer, wine, grape, region, country or section word; a dish's words.
    const words=this._words(a);
    if(words.length&&!types.length&&!under&&!over){
      const hitW=w=>words.some(x=>TeamLearn._norm([w.producer,w.name,(w.grapes||[]).join(' '),w.region,w.country,w.section].join(' ')).split(' ').includes(x));
      const hitD=x=>words.some(y=>TeamLearn._norm([x.name,x.section,x.desc].join(' ')).split(' ').includes(y));
      const nw=wines.filter(hitW), nd=dishes.filter(hitD);
      if(nw.length||nd.length){ wines=nw; dishes=wantMenu?dishes:nd; label.push(ask.trim()); }
      else if(!label.length){ wines=[]; dishes=[]; } // names nothing on the list or menu
    }
    if(!label.length) label.push(ask.trim());
    return {wines,dishes,label:label.join(', ')};
  },
  /* The test: {qs, title, why, none}. Questions round-robin across the wines and dishes in it, so ten
     questions don't all land on one bottle; faded and missed answers lead. */
  test(pid,{ask='',size=this.TEST_SIZE}={}){
    const c=this._ctx(pid); if(!c) return {qs:[],none:true,why:'Pick who you are first.'};
    const n=this.narrow(c,ask), wines=n?n.wines:c.wines, dishes=n?n.dishes:c.dishes;
    if(n&&!wines.length&&!dishes.length) return {qs:[],none:true,title:'Vinny\'s test',why:`Nothing you sell matches "${ask.trim()}". Try a type, a price, a grape or a dish.`};
    const r=TeamLearn.readiness(pid), short=Object.entries(r.parts).filter(([k,p])=>p.share<p.need&&k!=='cocktails').map(([k])=>k); // Vinny's test is the wine list and menu; cocktails drill on Today
    const inShort=x=>!n&&short.length?(short.includes('dishes')&&x.dish)||(x.wine&&((short.includes('glass')&&TeamData.byGlass(x.wine))||(short.includes('bottle')&&!TeamData.byGlass(x.wine)))):true;
    const assigned=new Set(TeamLearn.assignments(pid).map(a=>a.id));
    const sells=(!n&&typeof TeamSales!=='undefined'&&TeamSales.has()&&typeof TeamReport!=='undefined')?TeamReport.priority(28,10).map(x=>x.wine.id):[];
    // Each wine or dish with its questions, ranked: faded or missed first, then the till's priorities and
    // what's assigned, then the parts of the minimum they're short of, then the rest of the list in order.
    const things=[...wines.map(w=>({wine:w,id:w.id})),...dishes.map(x=>({dish:x,id:x.id}))].map((t,order)=>{
      const {unknown,known}=this._qsFor(c,t);
      const faded=[...unknown,...known].filter(q=>{ const it=c.items[q.id]; return it&&it.reps&&(it.wrong||it.due<=c.now); });
      const rank=(faded.length?0:sells.includes(t.id)?1:assigned.has(t.id)?2:inShort(t)?3:4)*1000+order;
      return {...t,faded,unknown:unknown.filter(q=>!faded.includes(q)),known,rank};
    }).filter(t=>t.faded.length||t.unknown.length||t.known.length).sort((a,b)=>a.rank-b.rank);
    // Three candidates for every question asked, in priority order; TeamLearn.spread keeps one per right
    // answer and deals them so no two in a row share a wine, a dish, a shape or an answer.
    const cap=size*3, out=[], has=id=>out.some(q=>q.id===id), take=key=>{ let added=true; while(out.length<cap&&added){ added=false; for(const t of things){ if(out.length>=cap) break; const q=t[key].find(q=>!has(q.id)); if(q){ out.push(q); added=true; } } } };
    take('faded'); take('unknown');
    const review=out.length===0; if(out.length<cap) take('known'); // nothing to learn or refresh: the ones asked longest ago, as review
    const qs=TeamLearn.spread(out,size);
    return {qs,title:n?`Vinny's test: ${n.label}`:'Vinny\'s test',why:this.why(c,qs,{n,short,sells,review}),none:!qs.length};
  },
  /* The reason, in a sentence or two: what it covers and why these. */
  why(c,qs,{n,short,sells,review}){
    if(!qs.length) return 'Nothing to test yet: the list needs its staff cards first.';
    const faded=qs.filter(q=>{ const it=c.items[q.id]; return it&&it.reps&&(it.wrong||it.due<=c.now); }).length;
    const fresh=qs.filter(q=>!(c.items[q.id]&&c.items[q.id].reps)).length;
    // The area most of it is about: a list section, or the menu.
    const area={}; qs.forEach(q=>{ const k=q.dish?'the menu':((TeamData.wine(q.wine)||{}).section||'').toLowerCase(); if(k) area[k]=(area[k]||0)+1; });
    const top=Object.entries(area).sort((a,b)=>b[1]-a[1])[0], topLine=top&&top[1]>=Math.ceil(qs.length/2)?(top[0]==='the menu'?' mostly on the menu':` mostly on the ${top[0]}`):'';
    if(review) return `Nothing's slipping${n?` in ${n.label}`:''}. Here are ${qs.length} you haven't been asked in a while.`;
    const bits=[];
    if(faded) bits.push(`${faded} answer${faded===1?' has':'s have'} faded or ${faded===1?'was':'were'} missed${topLine}`);
    if(fresh) bits.push(`${fresh} ${fresh===1?'is':'are'} new to you${!faded?topLine:''}`);
    const lead=bits.length?bits.join(', and ')+'.':'';
    const why2=n?` All on ${n.label}.`:sells.some(id=>qs.some(q=>q.wine===id))?' What sells most and you know least comes first.':short.length?` You're short of your minimum on ${short.map(k=>TeamLearn.PART_LABEL[k].toLowerCase()).join(' and ')}.`:'';
    return (lead.charAt(0).toUpperCase()+lead.slice(1)+why2).trim();
  },

  /* ── The practice hub ──
     The one thing to do now, chosen for this person, so the Vinny tab leads with a decision made rather than three
     doors of equal weight: today's drill until it's done; then a guest table aimed at what they're weakest on
     (TeamVinny.scenario's why); then the test when answers have faded; else another table. {kind, title, why, cta, open}. */
  next(pid){
    const person=TeamLearn.person(pid); if(!person||!TeamData.wines().length) return null;
    const r=TeamLearn.readiness(pid), as=TeamLearn.assignments(pid), done=TeamLearn.doneToday(pid);
    if(!done){ const parts=[]; if(r&&r.due) parts.push(`${r.due} answer${r.due===1?' is':'s are'} due`); if(as.length) parts.push(`${as.length} ${as.length===1?'thing is':'things are'} new to you`);
      return {kind:'drill',title:"Today's drill · 5 questions",why:parts.length?parts.join(' and ')+'. Two to three minutes.':'Nothing is due; five questions keep it fresh. Two to three minutes.',cta:'Start',open:{view:'drill'}}; }
    const sc=this.scenario(pid); const t=this.test(pid);
    if(sc){ const dish=String(sc.dishName||'').split(',')[0].trim(); const why=(sc.why||[]).length?sc.why.join(', and ')+'.':'Answer as you would at the table.';
      return {kind:'guest',title:`A guest having the ${dish}`,why:why.charAt(0).toUpperCase()+why.slice(1),cta:'Take the table',open:{view:'guest'}}; }
    if(t&&!t.none) return {kind:'test',title:`Vinny's test · ${t.qs.length} questions`,why:t.why,cta:'Start',open:{view:'drill',qs:t.qs,intro:{title:t.title,why:t.why}}};
    return null;
  },
  /* Three suggestions for the Ask screen, each short and about a different thing: tonight's feature or an 86'd dish
     once the venue sets them (status on an item), the top seller they haven't learnt, a dish, a price. Never two about
     the same wine, never a long name: a wine with more than four words goes by its producer. */
  _nick(w){ return TeamData.nick(w); },
  suggest(pid){
    const ws=TeamData.wines(), ds=TeamData.dishes(), out=[], used=new Set();
    const add=(s,id)=>{ if(out.length>=3||!s||(id&&used.has(id))) return; if(id) used.add(id); out.push(s); };
    const tn=TeamData.tonight(), feat=ws.find(w=>tn.feature.includes(w.id)), off=ds.find(x=>tn.off.includes(x.id));
    if(feat) add(`What do I say about the ${this._nick(feat)}?`,feat.id);
    if(off) add(`What's off tonight?`);
    let sells=[]; try{ if(TeamSales.has()) sells=TeamReport.priority(28,4).map(x=>x.wine); }catch(e){}
    const me=pid&&TeamLearn.person(pid), items=me?TeamLearn._mine(TeamLearn._all(),pid).items:{};
    const unknown=sells.find(w=>!me||!TeamLearn.knowsWine(pid,me.role,w.id,items)); if(unknown) add(`How do I sell the ${this._nick(unknown)}?`,unknown.id);
    const main=ds.find(x=>/main/i.test(x.section||''))||ds[Math.floor(ds.length/2)]||ds[0]; if(main) add(`What goes with the ${main.name.split(',')[0]}?`);
    const glass=ws.filter(w=>TeamData.byGlass(w)).map(w=>this._price(w.glass)).filter(Boolean).sort((a,b)=>a-b);
    if(glass.length) add(`By the glass under ${TeamData.money(Math.ceil(glass[Math.floor(glass.length/2)]))}?`);
    const reds=ws.filter(w=>w.type==='red'&&this._price(w.bottle)); if(reds.length) add(`Reds under ${TeamData.money(Math.ceil(this._price(reds.sort((a,b)=>this._price(a.bottle)-this._price(b.bottle))[Math.floor(reds.length/2)].bottle)/10)*10)}?`);
    add('What should I say about our house red?');
    return out.slice(0,3);
  },

  /* ── Ask Vinny ── */
  recent(){ return (Store.getJSON(this.KEY,{})||{}).recent||[]; },
  remember(q){ const d=Store.getJSON(this.KEY,{})||{}; d.recent=[q,...(d.recent||[]).filter(x=>x.toLowerCase()!==q.toLowerCase())].slice(0,5); Store.setJSON(this.KEY,d); },
  /* Questions to suggest, from this list and menu. */
  suggestions(){
    const ws=TeamData.wines(), ds=TeamData.dishes(), sym=TeamData.currency().sym||'£', out=[];
    const glass=ws.filter(w=>TeamData.byGlass(w)).map(w=>this._price(w.glass)).filter(Boolean).sort((a,b)=>a-b);
    if(glass.length) out.push(`What's by the glass under ${TeamData.money(Math.ceil(glass[Math.floor(glass.length/2)]))}?`);
    const main=ds.find(x=>/main/i.test(x.section||''))||ds[0]; if(main) out.push(`What goes with the ${main.name.split(',')[0].toLowerCase()}?`);
    const sp=ws.find(w=>w.type==='sparkling'); if(sp) out.push(`How do I serve the ${TeamData.short(sp)}?`);
    const reds=ws.filter(w=>w.type==='red'&&w.vintage); if(reds.length) out.push('Which of our reds are ready to drink?');
    const by={}; ws.forEach(w=>(w.grapes||[]).forEach(g=>{ (by[g]=by[g]||[]).push(w); }));
    const pair=Object.values(by).find(a=>a.length>=2); if(pair) out.push(`${TeamData.short(pair[0])} or ${TeamData.short(pair[1])}: the difference?`);
    out.push('What should I say about our house red?');
    return [...new Set(out)].slice(0,6);
  },
  /* The list and menu as one line each, tagged W1… and D1… so an answer can name them. */
  _lines(){
    const sym=TeamData.currency().sym||'£', ws=TeamData.wines().slice(0,this.LIST_MAX), ds=TeamData.dishes();
    const wl=ws.map((w,i)=>{ const win=TeamData.window(w); return `W${i+1} ${TeamData.short(w)} ${w.vintage||'NV'} · ${w.type}${w.section?` · ${w.section}`:''} · ${[w.region,w.country].filter(Boolean).join(', ')}${(w.grapes||[]).length?` · ${w.grapes.join(', ')}`:''}${w.glass?` · glass ${w.glass}`:''}${w.bottle?` · bottle ${w.bottle}`:''}${win?` · ${win.word} (${win.line})`:''}`; });
    const tag=id=>{ const i=ws.findIndex(w=>w.id===id); return i>=0?`W${i+1}`:''; };
    // A dish's pairing names one by-the-glass pick, which Vinny once read as the only glass that goes
    // ("nothing else comes by the glass", with another glass among the best). So each wine in "best
    // with" says whether it's poured by the glass, and the pick is labelled the first choice.
    const dl=ds.map((x,i)=>{ const p=TeamData.pairing(x.id), nm=(id,mark)=>{ const w=TeamData.wine(id); return w?`${TeamData.short(w)} (${tag(id)})${mark&&TeamData.byGlass(w)?' also by the glass':''}`:''; };
      return `D${i+1} ${x.name}${x.section?` · ${x.section}`:''}${x.price?` · ${x.price}`:''}${x.desc?` · ${x.desc}`:''}${p&&p.best&&p.best.length?` · best with ${p.best.map(b=>nm(b.id,true)).filter(Boolean).join('; ')}`:''}${p&&p.glass?` · first pick by the glass ${nm(p.glass.id)}`:''}${p&&p.avoid?` · steer away from ${nm(p.avoid.id)}`:''}`; });
    return {ws,ds,text:`WINE LIST (${sym}):\n${wl.join('\n')}\n\nMENU:\n${dl.join('\n')}`,sym};
  },
  // The wines a question is about: named in it, or paired with a dish named in it.
  _about(q,ws,ds){
    const words=this._words(q); if(!words.length) return [];
    const score=s=>{ const t=TeamLearn._norm(s).split(' '); return words.filter(x=>t.includes(x)).length; };
    const wines=ws.map(w=>({w,s:score([w.producer,w.name,w.region,(w.grapes||[]).join(' ')].join(' '))})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.w);
    const dish=ds.map(x=>({x,s:score(x.name+' '+(x.desc||''))})).filter(y=>y.s>0).sort((a,b)=>b.s-a.s)[0];
    const fromDish=dish?((TeamData.pairing(dish.x.id)||{}).best||[]).map(b=>TeamData.wine(b.id)).filter(Boolean):[];
    return [...new Set([...wines,...fromDish])].slice(0,this.CARDS_MAX);
  },
  _cardText(w){ const c=TeamData.card(w.id); if(!c) return '';
    return `${TeamData.short(w)}: say "${c.pitch}" Tastes: ${c.taste} Serve: ${c.serve?[c.serve.temp,c.serve.glass,c.serve.decant&&c.serve.decant!=='no'?`decant ${c.serve.decant}`:''].filter(Boolean).join(', '):''}. ${c.grape||''} ${c.place||''}${(c.alts||[]).length?` Instead: ${c.alts.map(a=>{ const x=TeamData.wine(a.id); return x?`${TeamData.short(x)} (${a.when})`:''; }).filter(Boolean).join('; ')}.`:''}`; },
  prompt(question,turns=[]){
    const tpl=_loadTextSync('prompts/team-vinny.txt'), {ws,ds,text}=this._lines(), about=this._about(question,ws,ds);
    const history=turns.slice(-this.TURNS).filter(t=>t.a).map(t=>`Earlier question: "${t.q}"\nYour answer: "${t.a}"`).join('\n');
    return tpl.replace('{{venue}}',TeamData.get().venue.name||'the restaurant').replace('{{about}}',TeamData.about()).replace('{{list}}',text)
      .replace('{{cards}}',about.length?about.map(w=>this._cardText(w)).join('\n\n'):'(none named)')
      .replace('{{history}}',history?history+'\n\n':'').replace('{{question}}',String(question).slice(0,400));
  },
  /* The answer with the list's tags taken out: "the Chablis (W3)" and "cod (D12, D13)" lose their brackets whole, a bare
     W3 goes too, and a space left before a comma or full stop is closed up, so no "cod ()" reaches a server. */
  clean(text){ return String(text||'').replace(/\s*\(\s*[WD]\d+(?:\s*[,;\/]\s*[WD]\d+)*\s*\)/gi,'').replace(/\s*\b[WD]\d+\b/g,'').replace(/\(\s*\)/g,'').replace(/\s+([,.;:!?])/g,'$1').replace(/  +/g,' ').trim(); },
  /* {answer, wines:[id], dishes:[id]}; throws when Claude can't be reached. */
  async ask(question,turns=[]){
    const text=await window.claude.complete({purpose:'team_vinny',messages:[{role:'user',content:this.prompt(question,turns)}]});
    const {ws,ds}=this._lines(); let j=null; try{ j=TeamData._json(text); }catch(e){}
    const ids=(tags,arr,p)=>[...new Set((tags||[]).map(t=>{ const m=String(t).match(new RegExp('^'+p+'(\\d+)$','i')); return m&&arr[+m[1]-1]?arr[+m[1]-1].id:null; }).filter(Boolean))];
    // An answer cut off before its JSON closed still shows its words, never the raw {"answer": … (TeamVinny.loose).
    const answer=this.clean((j&&j.answer)||this.loose(text,'answer')||text);
    this.remember(question);
    return {answer,wines:ids(j&&j.wines,ws,'W'),dishes:ids(j&&j.dishes,ds,'D')};
  },

  /* ── A guest at the table ── */
  WISHES:['budget','light','bottle','avoid','glass'],
  /* A table aimed at this person (tableWhy says why it was picked). Every dish they serve, with every
     request it allows, is a possible table; each is scored on what this person needs (pickTable), and one of
     the best few is taken, so it stays varied. {dish, wish, guest, key, wines:[id], why:[…], help}. */
  /* A field's text from JSON that was cut off before it closed: {"answer": "Our list… → Our list… */
  loose(text,field){ const m=new RegExp('"'+field+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)').exec(String(text||'')); if(!m) return '';
    try{ return JSON.parse('"'+m[1].replace(/\\$/,'')+'"'); }catch(e){ return m[1]; } },
  /* The listening check in the app: every wine, cocktail and dish as a guest would say it, numbered in the order
     scripts/tts-check.mjs uses (wines, cocktails, dishes), so a number heard here is the number to fix. */
  sayLines(){ let n=0; const out=[];
    TeamData.wines().forEach(w=>{ const nm=TeamData.short(w); out.push({n:++n,kind:'Wines',name:nm,line:`Could we get a bottle of the ${nm}, please?`,hint:(TeamData.card(w.id)||{}).say||''}); });
    TeamData.cocktails().forEach(c=>out.push({n:++n,kind:'Cocktails',name:c.name,line:`I'll start with a ${c.name}.`,hint:''}));
    TeamData.dishes().forEach(d=>out.push({n:++n,kind:'Dishes',name:d.name,line:`I'm having the ${d.name}.`,hint:''}));
    return out; },
  scenario(pid,seed=Date.now()){
    const c=this._ctx(pid); if(!c) return null;
    const pool=c.dishes.map(x=>({x,p:TeamData.pairing(x.id)})).filter(d=>d.p&&d.p.best&&d.p.best.length);
    if(!pool.length) return null;
    const cands=[];
    pool.forEach(({x,p})=>this.wishesFor(p).forEach(wish=>{ const t=this._build(x,p,wish,seed); if(t&&t.wines.length) cands.push(t); }));
    if(!cands.length) return null;
    return this.pickTable(c.person.id,cands,seed);
  },
  // The requests a dish's pairing can carry: a steer away needs a wine to avoid, a glass a by-the-glass pick, a bottle or budget a bottle.
  wishesFor(p){ const best=(p.best||[]).map(b=>TeamData.wine(b.id)).filter(Boolean);
    return this.WISHES.filter(k=>k!=='avoid'||(p.avoid&&TeamData.wine(p.avoid.id))).filter(k=>k!=='glass'||(p.glass&&TeamData.wine(p.glass.id))).filter(k=>!['bottle','budget'].includes(k)||best.some(w=>w.bottle)); },
  /* What makes a table worth practising for this person, each 0 to 1, weighted (TABLE_W):
     weak — the wines a good answer needs, by how much of each they hold from drills (none yet counts as weak);
     missed — tables with this request they haven't landed lately; sells — how much those wines sell
     (TeamReport.salesByWine); assigned — wines or the dish assigned to them and not learnt; and a repeat
     of a recent table counts against it. */
  TABLE_W:{weak:3,missed:2,sells:1,assigned:1.5,dish:1,repeat:-4},
  TABLE_TOP:3,
  WISH_WORDS:{budget:'a bottle on a budget',light:'something lighter',bottle:'one bottle for the table',avoid:'steering a guest away from a wine',glass:'a glass at the bar'},
  pickTable(pid,cands,seed){
    const W=this.TABLE_W, log=(this.tableState(pid).log||[]).slice(-12), recent=log.slice(-3);
    const held=id=>{ const pr=TeamLearn.progress(pid,id); return pr.total?pr.known/pr.total:0; };
    const dishHeld=id=>{ const pr=TeamLearn.progress(pid,id,{dish:true}); return pr.total?pr.known/pr.total:0; };
    let sold={}; try{ sold=Object.fromEntries(TeamReport.salesByWine(28).map(x=>[x.id,x.qty||0])); }catch(e){}
    const topSold=Math.max(1,...Object.values(sold));
    const assigned=new Set(TeamLearn.assignments(pid).map(a=>a.id));
    const missedBy={}; log.forEach(x=>{ if(x.wish&&x.score<this.LAND) missedBy[x.wish]=(missedBy[x.wish]||0)+1; });
    const scored=cands.map(t=>{
      const weak=t.wines.reduce((a,id)=>a+(1-held(id)),0)/t.wines.length;
      const missed=Math.min(1,(missedBy[t.wish]||0)/2);
      const sells=t.wines.reduce((a,id)=>Math.max(a,(sold[id]||0)/topSold),0);
      const asg=t.wines.some(id=>assigned.has(id))||assigned.has(t.dish)?1:0;
      const dish=1-dishHeld(t.dish);
      const rep=recent.some(x=>x.dish===t.dish&&x.wish===t.wish)?1:recent.slice(-1).some(x=>x.dish===t.dish)?0.5:0;
      const parts={weak:W.weak*weak,missed:W.missed*missed,sells:W.sells*sells,assigned:W.assigned*asg,dish:W.dish*dish,repeat:W.repeat*rep};
      return {...t,score:Object.values(parts).reduce((a,b)=>a+b,0),parts,raw:{weak,missed,sells,asg,missedN:missedBy[t.wish]||0}};
    }).sort((a,b)=>b.score-a.score);
    // One of the best few dishes, so the next table isn't always the same one, then one of that dish's
    // requests that scores close to its best (a missed request wins outright, being worth two points).
    const dishes=[]; scored.forEach(t=>{ if(!dishes.includes(t.dish)) dishes.push(t.dish); });
    const h=k=>{ let x=(Math.abs(seed)^k)>>>0; x=Math.imul(x^(x>>>16),2246822507)>>>0; x=Math.imul(x^(x>>>13),3266489909)>>>0; return (x^(x>>>16))>>>0; };
    const dish=dishes.slice(0,this.TABLE_TOP)[h(1)%Math.min(this.TABLE_TOP,dishes.length)];
    const mine=scored.filter(t=>t.dish===dish), near=mine.filter(t=>t.score>=mine[0].score-0.5), pick=near[h(2)%near.length];
    return {...pick,why:this.tableWhy(pick)};
  },
  /* Why this table, in words: its two strongest reasons. */
  tableWhy(t){
    const w=TeamData.wine(t.wines[0]), full=w?TeamData.short(w):'', name=!w?'this wine':w.producer&&(full.split(/\s+/).length>4||String(w.producer).toLowerCase().includes(String(w.name||'').toLowerCase()))?w.producer:full, out=[];
    const dishShort=String(t.dishName||'').split(',')[0].trim();
    const order=Object.entries(t.parts).filter(([k,v])=>v>0.4&&k!=='repeat').sort((a,b)=>b[1]-a[1]).map(([k])=>k);
    for(const k of order){
      if(k==='weak') out.push(t.raw.weak>=0.99?`you haven't started on the ${name} yet`:`you're still learning the ${name}`);
      else if(k==='missed') out.push(`${this.WISH_WORDS[t.wish]} hasn't landed for you ${t.raw.missedN===1?'once lately':`${t.raw.missedN} times lately`}`);
      else if(k==='sells') out.push(`the ${name} is one of your best sellers`);
      else if(k==='assigned') out.push(`it's on your list to learn`);
      else if(k==='dish') out.push(`you're still learning what goes with the ${dishShort.toLowerCase()}`);
      if(out.length>=2) break;
    }
    return out;
  },
  /* One table from a dish, its pairing and a request. */
  _build(x,p,wish,seed){
    const sym=TeamData.currency().sym||'£';
    const best=p.best.map(b=>({...b,w:TeamData.wine(b.id)})).filter(b=>b.w), cost=w=>this._price(w.bottle)||this._price(w.glass)||0;
    const avoid=p.avoid&&TeamData.wine(p.avoid.id), glass=p.glass&&TeamData.wine(p.glass.id);
    let guest, key, wines;
    if(wish==='budget'){ const ok=best.filter(b=>b.w.bottle).sort((a,b)=>cost(a.w)-cost(b.w)); const cap=ok.length?Math.ceil((cost(ok[0].w)+5)/5)*5:null;
      guest=`A table of two, ordering the ${x.name}; they want a bottle${cap?` and don't want to spend more than about ${TeamData.money(cap)}`:''}.`;
      const fit=ok.filter(b=>!cap||cost(b.w)<=cap); wines=fit.map(b=>b.w.id);
      key=[`Recommend ${fit.map(b=>`${TeamData.short(b.w)} (bottle ${b.w.bottle})`).join(' or ')}`,`Say why it suits the dish: ${fit[0].why}`,'Stay within their budget']; }
    else if(wish==='light'){ const lt=[...best].sort((a,b)=>((TeamData.card(a.id)||{}).style||{}).body-((TeamData.card(b.id)||{}).style||{}).body)[0];
      guest=`A guest on their own, having the ${x.name}; they like something lighter and not too heavy, and ask what you'd suggest.`;
      wines=[lt.w.id]; key=[`Suggest ${TeamData.short(lt.w)}${lt.w.glass?` (glass ${lt.w.glass})`:''}`,`Explain it in plain words: ${lt.why}`,'Describe how it tastes, not just its name']; }
    else if(wish==='bottle'){ const b=best.find(b=>b.w.bottle)||best[0];
      guest=`A table of four sharing the ${x.name} and other dishes; they'd like one bottle that works and ask for your pick.`;
      wines=[b.w.id]; key=[`Recommend ${TeamData.short(b.w)} (bottle ${b.w.bottle||b.w.glass})`,`Say why: ${b.why}`,'Sound confident: name it, then the reason']; }
    else if(wish==='avoid'){
      guest=`A guest ordering the ${x.name} says they were thinking of the ${TeamData.short(avoid)}.`;
      wines=[best[0].w.id]; key=[`Steer them away from the ${TeamData.short(avoid)} politely: ${p.avoid.why}`,`Offer ${TeamData.short(best[0].w)} instead: ${best[0].why}`,'Offer the first wine with another dish if it suits one, so it isn\'t a no'];
      const alt=TeamData.dishes().find(d=>{ const q=TeamData.pairing(d.id); return q&&(q.best||[]).some(b=>b.id===avoid.id); }); if(alt) key[2]=`Suggest the ${TeamData.short(avoid)} with the ${alt.name} instead, so it isn't a no`; }
    else { guest=`A guest at the bar with the ${x.name}; they'd like just a glass of something that goes with it.`;
      wines=[glass.id]; key=[`Offer the ${TeamData.short(glass)} by the glass (${glass.glass})`,`Say why: ${p.glass.why}`,'Keep it short: one line on the taste']; }
    const sc={dish:x.id,dishName:x.name,wish,guest,key,wines,seed};
    return {...sc,help:this._help(sc,{x,p,best,avoid,glass,cost,sym,seed})};
  },

  /* ── Help at the table: choices, hints, or none ──
     Someone new to the list gets choices (three wines to pick from, then three reasons, built into a reply
     they can change before saying it); someone part way gets hints they can ask for one at a time (what the
     guest wants, the wines worth a look, the reason to give); someone who knows it gets nothing. It starts
     from readiness (a sommelier or buyer starts on their own) and then follows the tables: two in a row that
     land move them up a step (with hints, only if they used at most one), a table that doesn't land moves them
     down one. They can pick a step themselves; the next table carries on from there. The mark never changes
     with the help: the guest is marked on what was said. */
  LEVELS:['choices','hints','own'],
  LEVEL_LABEL:{choices:'Choices',hints:'Hints',own:'On your own'},
  LEVEL_FROM:{hints:40,own:75},   // readiness % to start at that step
  UP_AFTER:2,                     // tables in a row that land, to move up
  LAND:0.67, MISS:0.34,           // a mark's score for "landed" and "didn't"
  _guestDoc(){ const d=Store.getJSON(this.KEY,{})||{}; d.tables=d.tables||{}; return d; },
  _startLevel(pid){
    const person=TeamLearn.person(pid); if(person&&['sommelier','buyer'].includes(person.role)) return 'own';
    const r=TeamLearn.readiness(pid), pct=r?r.pct:0;
    return pct>=this.LEVEL_FROM.own?'own':pct>=this.LEVEL_FROM.hints?'hints':'choices';
  },
  /* {level, streak, picked, log:[{at, level, score, hints, dish, wish, wines, d}]} for this person (the table's dish, request and wines steer the next table). */
  tableState(pid){ const t=this._guestDoc().tables[pid]; return t&&this.LEVELS.includes(t.level)?t:{level:this._startLevel(pid),streak:0,log:[]}; },
  level(pid){ return this.tableState(pid).level; },
  setLevel(pid,level){ if(!this.LEVELS.includes(level)) return; const d=this._guestDoc(), t=this.tableState(pid);
    d.tables[pid]={...t,level,streak:0,picked:true}; Store.setJSON(this.KEY,d); },
  /* Records a marked table and moves the step: returns {level, moved:'up'|'down'|null}. */
  /* How their spoken delivery is moving: the last three spoken tables against the three before them
     (fillers and hedges per table, and how long before they started). Private to them; never readiness. */
  deliveryTrend(pid){
    const log=(this.tableState(pid).log||[]).filter(x=>x.d); if(log.length<4) return null;
    const avg=(xs,f)=>xs.reduce((a,x)=>a+f(x),0)/xs.length, now=log.slice(-3), was=log.slice(-6,-3);
    const tics=x=>(x.d.fillers||0)+(x.d.hedges||0), wait=x=>x.d.waitMs==null?null:x.d.waitMs;
    const t1=avg(now,tics), t0=avg(was,tics), w1=avg(now.filter(x=>wait(x)!=null),wait)||0, w0=avg(was.filter(x=>wait(x)!=null),wait)||0;
    const bits=[];
    if(t0-t1>=0.5) bits.push('fewer fillers and hedges than before'); else if(t1-t0>=0.5) bits.push('more fillers and hedges creeping in');
    if(w0&&w1&&w0-w1>=700) bits.push('starting sooner'); else if(w0&&w1&&w1-w0>=700) bits.push('taking longer to start');
    return bits.length?`Over your last tables: ${bits.join(', ')}.`:'Over your last tables: steady.';
  },
  noteTable(pid,{level,score,hints=0,delivery=null,table=null}){
    const d=this._guestDoc(), t=this.tableState(pid), i=this.LEVELS.indexOf(level);
    const landed=score>=this.LAND&&(level!=='hints'||hints<=1);
    let next=level, streak=landed?(t.level===level?t.streak:0)+1:0, moved=null;
    if(landed&&streak>=this.UP_AFTER&&i<this.LEVELS.length-1){ next=this.LEVELS[i+1]; streak=0; moved='up'; }
    else if(score<this.MISS&&i>0){ next=this.LEVELS[i-1]; streak=0; moved='down'; }
    d.tables[pid]={level:next,streak,picked:t.picked&&!moved,log:[...(t.log||[]),{at:Date.now(),level,score,hints,...(table?{dish:table.dish,wish:table.wish,wines:table.wines}:{}),...(delivery?{d:{wpm:delivery.wpm,waitMs:delivery.waitMs,fillers:delivery.fillers,hedges:delivery.hedges,words:delivery.words}}:{})}].slice(-30)};
    Store.setJSON(this.KEY,d); return {level:next,moved};
  },
  /* What the screen shows for each step, built from the same pairing as the marking key, so the choices
     and hints always agree with how the table is marked.
     wines: three to pick from [{id, ok, note}] (note says why a wrong one is wrong);
     reasons: three [{text, ok}]; hints: three lines, gentlest first; say(wineId, reason): a reply to start from. */
  _help(sc,{x,p,best,avoid,glass,cost,sym,seed}){
    const short=id=>{ const w=TeamData.wine(id); return w?TeamData.short(w):''; };
    const rightIds=sc.wines, right=TeamData.wine(rightIds[0]);
    const priceOf=w=>sc.wish==='glass'||(sc.wish==='light'&&w.glass)?(w.glass?`${w.glass} a glass`:''):(w.bottle?`${w.bottle} a bottle`:w.glass?`${w.glass} a glass`:'');
    const bestIds=new Set(best.map(b=>b.id)), all=TeamData.wines();
    const rot=(arr,n)=>arr.length?arr.map((_,i)=>arr[(i+Math.abs(n))%arr.length]):arr;
    // Decoys: first the wrong idea this table holds, then a near miss, then something that doesn't suit.
    const decoys=[];
    const add=(w,note)=>{ if(w&&!rightIds.includes(w.id)&&!decoys.some(d=>d.id===w.id)) decoys.push({id:w.id,ok:false,note}); };
    if(sc.wish==='avoid'&&avoid) add(avoid,`This is the one to steer them away from: ${p.avoid.why}`);
    if(sc.wish==='budget'){ const over=best.filter(b=>b.w.bottle&&!rightIds.includes(b.id)).sort((a,b)=>cost(b.w)-cost(a.w))[0]; if(over) add(over.w,`It suits the dish, but at ${over.w.bottle} it's over what they want to spend.`); }
    if(sc.wish==='light'){ const heavy=best.filter(b=>!rightIds.includes(b.id))[0]; if(heavy) add(heavy.w,'It suits the dish, but it\'s the fuller choice; they asked for something lighter.'); }
    if(sc.wish==='glass'){ const btl=best.find(b=>!b.w.glass); if(btl) add(btl.w,'It suits the dish, but it isn\'t poured by the glass.'); }
    if(avoid) add(avoid,`It's the wine to steer away from with this dish: ${p.avoid.why}`);
    const others=rot(all.filter(w=>!bestIds.has(w.id)&&(!avoid||w.id!==avoid.id)&&(!right||w.type===right.type)),seed);
    const elsewhere=rot(all.filter(w=>!bestIds.has(w.id)&&(!avoid||w.id!==avoid.id)),seed>>2);
    for(const w of [...others,...elsewhere]){ if(decoys.length>=2) break; add(w,`A good wine, but not one of the pairings for the ${x.name}.`); }
    const okWine=rightIds.map(id=>TeamData.wine(id)).filter(Boolean)[0];
    const wines=okWine?[{id:okWine.id,ok:true,note:''},...decoys.slice(0,2)]:[];
    // Three orders, so the right one isn't always in the same place.
    const order=[[0,1,2],[1,0,2],[2,0,1],[1,2,0]][Math.abs(seed)%4].filter(i=>i<wines.length);
    // Step one asks what the guest's request asks. A guest who has named a wine that doesn't suit gets
    // "They want the Hito: what do you suggest?", with the wine they named as one answer ("Go with it, as they asked")
    // and the others offered in its place; never "Which wine?" as if they hadn't asked for one.
    const named=sc.wish==='avoid'&&avoid?TeamData.short(avoid):'';
    const pickedWines=order.map(i=>wines[i]).map(o=>named?{...o,label:o.id===avoid.id?`Go with the ${named}, as they asked`:`Suggest the ${short(o.id)} instead`}:o);
    const ask=named?`They want the ${named}. What do you suggest?`:({budget:'Which bottle fits their budget?',light:'Which lighter wine?',bottle:'Which bottle for the table?',glass:'Which wine by the glass?'}[sc.wish]||'Which wine?');
    const askWhy=named?`Why is it better with the ${x.name}?`:`Why does it suit the ${x.name}?`;
    // Reasons, all about the wine they picked: the pairing's own reason for it, and two that sound right but its own
    // card rules out at this dish (TeamLearn.styleWrong: light where it's full, no tannin where it's firm), so the
    // second step is about the first answer, never another wine's reason from another dish.
    const whyRight=(()=>{ if(!okWine) return ''; if(sc.wish==='glass'&&p.glass) return p.glass.why; const b=best.find(b=>b.id===okWine.id); return b?b.why:''; })();
    // Wrong reasons from the same course first (a main against other mains), so they can't be ruled out at a glance.
    const whysOf=ds=>ds.flatMap(d=>{ const q=TeamData.pairing(d.id); return q?[...(q.best||[]),q.glass].filter(Boolean).map(b=>b.why):[]; }).filter(w=>w&&w!==whyRight);
    const others2=TeamData.dishes().filter(d=>d.id!==x.id), same=others2.filter(d=>d.section&&d.section===x.section);
    const otherWhys=[...new Set([...rot(whysOf(same),seed>>1),...rot(whysOf(others2.filter(d=>!same.includes(d))),seed>>1)])].slice(0,2);
    const card=okWine&&TeamData.card(okWine.id), st=(card&&card.style)||{};
    const sentence=t=>{ const s=String(t||'').trim(); return s?s.charAt(0).toUpperCase()+s.slice(1)+(/[.!?]$/.test(s)?'':'.'):''; };
    const notTrue=card&&card.taste?`Not the ${short(okWine.id)}: its card says "${card.taste.replace(/\.$/,'')}".`:`That isn't how the ${short(okWine.id)} tastes: check its card.`;
    // Then the reasons its card's own table questions were written to be wrong with (`wrong`), still about this wine.
    const authored=card?(card.qs||[]).filter(q=>q.k==='apply').flatMap(q=>q.wrong||[]):[];
    const ownWrong=okWine?[...new Set([...TeamLearn.styleWrong(st,TeamLearn.kindOf(okWine),x.name,seed),...rot(authored,seed>>2)].map(sentence))].filter(t=>t&&t!==whyRight):[];
    const wrongs=[...ownWrong.map(t=>({text:t,ok:false,note:notTrue})),...otherWhys.map(t=>({text:t,ok:false,note:'That reason is about another wine and dish on the menu.'}))].slice(0,2);
    const reasons=whyRight?[{text:whyRight,ok:true},...wrongs]:[];
    const rOrder=[[1,0,2],[0,2,1],[2,1,0]][Math.abs(seed>>1)%3].filter(i=>i<reasons.length);
    const wishLine={budget:`They want a bottle and have a budget: keep under it.`,light:'They want something lighter: think body, not colour.',bottle:'One bottle for the whole table: pick the one that works with most of it, and say it with confidence.',avoid:`They've named a wine that doesn't suit the ${x.name}: steer them, kindly, and offer something better.`,glass:'Just a glass: look at what\'s poured by the glass.'}[sc.wish];
    const look=rot(pickedWines.map(w=>short(w.id)),0).filter(Boolean);
    const hints=[wishLine,`Worth a look: ${look.join(', ')}.`,okWine?`The reason to give for the ${short(okWine.id)}: ${whyRight}`:''].filter(Boolean);
    const say=(id,reason)=>{ const w=TeamData.wine(id); if(!w) return ''; const pr=priceOf(w);
      const steer=sc.wish==='avoid'&&avoid?`I'd steer you away from the ${TeamData.short(avoid)} with this. `:'';
      return `${steer}I'd go for the ${TeamData.short(w)}${pr?` at ${pr}`:''}.${reason?` ${reason}`:''}`; };
    return {wines:pickedWines,reasons:rOrder.map(i=>reasons[i]),hints,say,ask,askWhy};
  },
  /* One turn: the guest's next line, and once the table's served, the mark. turns: [{who:'guest'|'you', text}].
     {line, done, mark:{score, verdict, good, missing, better}|null} */
  /* Help on a follow-up line, written with it (the opening line's help is built from the pairing, _GuestChoices):
     choices, three replies the server could give, one right and two believable but weaker, each with why; hints,
     one nudge toward a good reply. Never for the opening line or a closing one. */
  _HELP:{
    choices:'The server is learning with choices. With every line except your opening and closing ones, also write three short replies the server could give to it, in the server\'s voice: exactly one is a good answer (it uses a wine from the list with its real price where it matters, and answers what you just asked, from the staff cards), and two are believable but weaker (the wrong wine for what you asked, a price or fact that isn\'t right, or one that doesn\'t answer the question). Give each one line on why it works or doesn\'t, as a trainer would say it.',
    hints:'The server is learning with hints. With every line except your opening and closing ones, also write one short hint that points them toward a good reply to it (what to mention, from the staff cards and the list), without writing the reply for them.',
  },
  _HELPFIELDS:{ choices:', "replies": [{"text": "a reply", "ok": true, "why": "why it works"}, {"text": "…", "ok": false, "why": "why it falls short"}, {"text": "…", "ok": false, "why": "…"}]', hints:', "hint": "the hint"' },
  async guest(sc,turns,level){
    const tpl=_loadTextSync('prompts/team-guest.txt'), {text}=this._lines();
    const yours=turns.filter(t=>t.who==='you').length, last=yours>=this.GUEST_TURNS;
    const script=turns.map(t=>`${t.who==='guest'?'GUEST':'SERVER'}: ${t.text}`).join('\n');
    const content=tpl.replace('{{venue}}',TeamData.get().venue.name||'the restaurant').replace('{{about}}',TeamData.about()).replace('{{list}}',text)
      .replace('{{cards}}',sc.wines.map(id=>TeamData.wine(id)).filter(Boolean).map(w=>this._cardText(w)).join('\n\n')||'(none)')
      .replace('{{scenario}}',sc.guest).replace('{{key}}',sc.key.map(k=>`- ${k}`).join('\n'))
      .replace('{{transcript}}',script||'(the guest hasn\'t spoken yet)').replace('{{last}}',last?'This was the server\'s last reply: end the table now and mark it.':'')
      .replace('{{help}}',yours&&!last&&this._HELP[level]?this._HELP[level]:'').replace('{{helpfields}}',yours&&!last&&this._HELPFIELDS[level]?this._HELPFIELDS[level]:'');
    const raw=await window.claude.complete({purpose:'team_guest',messages:[{role:'user',content}]});
    let j=null; try{ j=TeamData._json(raw); }catch(e){}
    if(!j) return {line:String(raw||'').trim(),done:last,mark:null};
    const m=j.mark&&typeof j.mark==='object'?{score:Math.max(0,Math.min(1,Number(j.mark.score)||0)),verdict:j.mark.verdict||'',good:j.mark.good||'',missing:j.mark.missing||'',better:j.mark.better||''}:null;
    const done=!!(j.done||last||m);
    // A follow-up's help, kept only when it's whole: three replies with exactly one right, shuffled; or a hint.
    let replies=null, hint=null;
    if(!done&&Array.isArray(j.replies)){ const rs=j.replies.filter(r=>r&&String(r.text||'').trim()).map(r=>({text:String(r.text).trim(),ok:!!r.ok,why:String(r.why||'').trim()}));
      if(rs.length>=2&&rs.filter(r=>r.ok).length===1) replies=TeamLearn._shuffle(rs,sc.seed+':'+turns.length); }
    if(!done&&j.hint) hint=String(j.hint).trim()||null;
    return {line:String(j.guest||'').trim(),done,mark:m,replies,hint};
  },
};
Object.assign(window,{TeamVinny});
