/* Bespoke training (docs/business.md "Bespoke training"): a plan a manager has Vinny write for one person, in their own
   words ("Priya is struggling with her reds, mostly prices and pairings: a three-part quiz"), reads, then pushes to
   that person's phone, where it sits apart from the daily drill as its own training and is tracked to completion.

   A plan is parts of four-option questions, each about one wine or dish on the list. Vinny writes new questions
   (one call, purpose `team_plan`, prompts/team-plan.txt) from the same cards the team is taught from, and says which
   of the person's own questions each one teaches the fact of (`covers`). That is how a plan counts: a bespoke question
   answered right is recorded for itself and for the question it covers (TeamLearn.record), so the wine or dish moves
   towards known in whichever area it sits in (by the glass, bottles, pairings). A question that covers nothing is
   extra practice and moves nothing.

   With no connection (or in a demo with no network) `fromCards` makes a plan from the questions the person already
   has, with no call, so the screen is never a dead end. Kept on this device with the rest of the pilot (`vbiz_plans_v1`). */
const TeamPlans = {
  KEY:'vbiz_plans_v1', MAX_WINES:8, MAX_DISHES:5,
  get(){ const d=Store.getJSON(this.KEY,null); return d&&Array.isArray(d.plans)?d:{v:1,plans:[]}; },
  save(d){ Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  clear(){ Store.remove(this.KEY); },
  plan(id){ return this.get().plans.find(p=>p.id===id)||null; },
  all(){ return this.get().plans.filter(p=>TeamLearn.person(p.pid)).sort((a,b)=>(b.pushedAt||b.at)-(a.pushedAt||a.at)); },
  forPerson(pid,{drafts=false}={}){ return this.all().filter(p=>p.pid===pid&&(drafts||p.status==='pushed')); },
  /* What the plan is built from: the wines and dishes the request is about (a colour, the glass list, the bottles, the
     menu, read the way Vinny's test reads a request), else the person's own gaps, best sellers first. */
  subjects(pid,ask){ const c=TeamVinny._ctx(pid); if(!c) return {wines:[],dishes:[]}; const n=TeamVinny.narrow(c,ask), a=String(ask||'').toLowerCase();
    const rank=TeamSales.has()?Object.fromEntries(TeamReport.salesByWine(28).map((y,i)=>[y.wine.id,i])):{}, by=(x,y)=>(rank[x.id]==null?999:rank[x.id])-(rank[y.id]==null?999:rank[y.id]);
    const knownW=w=>TeamLearn.knowsWine(pid,c.role,w.id,c.items), gapsFirst=(list,known)=>[...list.filter(x=>!known(x)),...list.filter(known)];
    const ok=w=>TeamData.card(w.id)&&TeamLearn.qsFor(c.role,w.id).length, picks=x=>{ const p=TeamData.pairing(x.id)||{}; return [...(p.best||[]).slice(0,2),p.glass].filter(Boolean).map(y=>TeamData.wine(y.id)).filter(Boolean); };
    const pairing=!!(n&&n.pairing), mixed=!!(n&&n.mixed), pool=(n&&n.wines.length&&n.wines.length<c.wines.length?n.wines:c.wines).filter(ok).sort(by), inPool=new Set(pool.map(w=>w.id));
    // A pairing plan starts from the dishes: the ones whose pairing they don't hold yet, each with the wines poured
    // with it, so every question can be about a wine for a dish. Never the menu on its own.
    if(pairing){ const holds=x=>TeamLearn.dishQsFor(c.role,x.id,{allergen:false}).filter(q=>TeamLearn.isPairing(q)).every(q=>TeamLearn.known(c.items[q.id]));
      const dishes=gapsFirst(((n.dishes.length?n.dishes:c.dishes)).filter(x=>picks(x).some(w=>inPool.has(w.id))),holds).slice(0,mixed?this.MAX_DISHES:this.MAX_DISHES+2);
      const wines=[...new Map(dishes.flatMap(picks).filter(w=>inPool.has(w.id)&&ok(w)).map(w=>[w.id,w])).values()];
      return {wines:(mixed?[...new Map([...wines,...gapsFirst(pool,knownW)].map(w=>[w.id,w])).values()]:wines).slice(0,this.MAX_WINES),dishes,pairing,mixed}; }
    const onlyFood=n&&!n.wines.length&&n.dishes.length;
    if(onlyFood) return {wines:[],dishes:n.dishes.slice(0,this.MAX_WINES),pairing:false,mixed:false,menu:true};
    return {wines:gapsFirst(pool,knownW).slice(0,this.MAX_WINES),dishes:[],pairing:false,mixed:false}; },
  /* Whether a written question is about a pairing: it names a wine from the list and a dish from the menu between
     its words and its options. A question about a dish that names no wine is a menu question. */
  _names(text){ const t=' '+TeamLearn._norm(text)+' ', has=x=>{ const k=TeamLearn._norm(x); return k.length>3&&t.includes(' '+k+' '); };
    return {wine:TeamData.wines().some(w=>has(TeamData.short(w))||has(TeamData.nick(w))||has(w.name)||has(w.producer)),dish:TeamData.dishes().some(x=>has(x.name.split(',')[0]))}; },
  isPairText(q){ const n=this._names([q.q,...(q.opts||[])].join(' . ')); return n.wine&&n.dish; },
  _wineLines(pid,c,w){ const card=TeamData.card(w.id)||{}, s=card.style||{}, qs=TeamLearn.qsFor(c.role,w.id);
    const dishes=TeamData.dishes().filter(x=>{ const p=TeamData.pairing(x.id)||{}; return [...(p.best||[]),p.glass].filter(Boolean).some(y=>y.id===w.id); }).map(x=>x.name.split(',')[0]);
    return [`${w.id} | WINE: ${TeamData.label(w)} | ${w.type}${w.section?' · '+w.section:''} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')}`,
      `  ${[(w.grapes||[]).length&&'grapes: '+w.grapes.join(', '),[w.region,w.country].filter(Boolean).length&&'from: '+[w.region,w.country].filter(Boolean).join(', '),s.body&&`body ${s.body}/5, acidity ${s.acid}/5, tannin ${s.tannin}/5, sweetness ${s.sweet}/5`].filter(Boolean).join(' · ')}`,
      card.say&&`  to say: ${card.say}`,card.taste&&`  taste: ${card.taste}`,dishes.length&&`  poured with: ${dishes.join(', ')}`,
      ...qs.slice(0,8).map(q=>`  ${q.id} | ${TeamLearn.known(c.items[q.id])?'known':'not known'} | ${q.q} → ${this._answer(q)}`)].filter(Boolean).join('\n'); },
  _dishLines(pid,c,x,pairing){ const p=TeamData.pairing(x.id)||{}, qs=TeamLearn.dishQsFor(c.role,x.id,{allergen:false}).filter(q=>!pairing||TeamLearn.isPairing(q)), name=y=>{ const w=TeamData.wine(y.id); return w?`${TeamData.short(w)} (${y.why||''})`:null; };
    return [`${x.id} | DISH: ${x.name}${x.price?' | '+x.price:''}`,(p.best||[]).length&&`  pour with: ${p.best.map(name).filter(Boolean).join('; ')}`,p.glass&&TeamData.wine(p.glass.id)&&`  by the glass: ${TeamData.short(TeamData.wine(p.glass.id))}`,
      ...qs.slice(0,5).map(q=>`  ${q.id} | ${TeamLearn.known(c.items[q.id])?'known':'not known'} | ${q.q} → ${this._answer(q)}`)].filter(Boolean).join('\n'); },
  _answer(q){ try{ const s=TeamLearn.shown(q); return (s.right||[]).map(i=>typeof i==='number'?(s.opts||[])[i]:i).filter(Boolean).join('; ')||q.ans||''; }catch(e){ return q.ans||''; } },
  _who(pid){ const x=TeamReport.people().find(y=>y.person.id===pid); if(!x) return ''; const r=x.r;
    return `${x.person.name}, ${TeamLearn.ROLES[x.person.role].label.toLowerCase()}. ${r.pct}% of the training the role needs. ${Object.entries(r.parts).map(([k,p])=>`${TeamLearn.PART_LABEL[k]}: trained on ${p.known} of ${p.total} (needs ${Math.ceil(p.need*p.total-1e-9)})`).join('; ')}.`; },
  /* What Vinny would write for this one person, from their own answers and sales: up to `n` plans a manager can
     start with one tap, each {kind, title, why, ask}: `why` is the evidence in words and `ask` the request the plan is
     written from, naming the wines and dishes so the plan is about them. In order: what they miss, what they sell
     without training, the team's best sellers they aren't trained on, answers that have faded, the area furthest
     from its minimum, and selling under the role's average. Nobody gets a suggestion their own data doesn't make. */
  suggest(pid,n=3,row){ const c=TeamVinny._ctx(pid); if(!c) return []; const x=row||TeamReport.teamRows().find(y=>y.person.id===pid); if(!x) return [];
    const f=c.person.name.split(' ')[0], out=[], used=new Set(), nick=w=>TeamData.nick(w), and=a=>a.length>1?a.slice(0,-1).join(', ')+' and '+a[a.length-1]:a[0]||'';
    const add=(kind,title,why,ask,ids)=>{ if(out.length<n&&!out.some(o=>o.kind===kind)){ out.push({kind,title,why,ask}); (ids||[]).forEach(i=>used.add(i)); } };
    const qsW=w=>TeamLearn.qsFor(c.role,w.id), qsD=d=>TeamLearn.dishQsFor(c.role,d.id,{allergen:false}), it=q=>c.items[q.id], trained=w=>TeamLearn.knowsWine(pid,c.role,w.id,c.items);
    // 1. Missed last time they were asked.
    const missW=c.wines.map(w=>({w,n:qsW(w).filter(q=>it(q)&&it(q).wrong).length})).filter(y=>y.n).sort((a,b)=>b.n-a.n), missD=c.dishes.map(d=>({d,n:qsD(d).filter(q=>it(q)&&it(q).wrong).length})).filter(y=>y.n).sort((a,b)=>b.n-a.n);
    const missN=missW.reduce((a,y)=>a+y.n,0)+missD.reduce((a,y)=>a+y.n,0);
    if(missN>=2){ const names=[...missW.slice(0,3).map(y=>nick(y.w)),...missD.slice(0,missW.length?1:3).map(y=>y.d.name)].slice(0,3);
      add('missed',`Fix what ${f} keeps missing`,`${missN} answers missed last time, most on ${and(names)}.`,`${f} keeps getting questions wrong on ${and(names)}. Write a short course that teaches those again from another angle, then checks them.`,missW.slice(0,3).map(y=>y.w.id)); }
    // 2. What they sell without being trained on it; else the team's best sellers they aren't trained on.
    if(TeamSales.has()){ const by={}; TeamSales.rows(28).filter(y=>y.v===pid&&y.w).forEach(y=>{ by[y.w]=(by[y.w]||0)+y.q*y.p; });
      const blind=Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([id,rev])=>({w:TeamData.wine(id),rev})).filter(y=>y.w&&qsW(y.w).length&&!trained(y.w)&&!used.has(y.w.id)).slice(0,3);
      if(blind.length) add('blind',`Train ${f} on what ${f} already sells`,`${f} sold ${and(blind.map(y=>`${nick(y.w)} (${TeamData.money(Math.round(y.rev/4))} a week)`))} without being trained on ${blind.length===1?'it':'them'}.`,`${f} already sells ${and(blind.map(y=>nick(y.w)))} but isn't trained on ${blind.length===1?'it':'them'}. Write a course on ${blind.length===1?'that wine':'those wines'}: what to say, the price and what to pour ${blind.length===1?'it':'them'} with.`,blind.map(y=>y.w.id));
      const top=TeamReport.salesByWine(28).slice(0,10).filter(y=>c.wines.some(w=>w.id===y.wine.id)&&qsW(y.wine).length&&!trained(y.wine)&&!used.has(y.wine.id)).slice(0,3);
      if(top.length) add('sellers',`The best sellers ${f} can't sell yet`,`${and(top.map(y=>nick(y.wine)))} ${top.length===1?'is':'are'} among the team's best sellers and ${f} isn't trained on ${top.length===1?'it':'them'}.`,`Get ${f} ready to sell ${and(top.map(y=>nick(y.wine)))}, the team's best sellers ${f} isn't trained on yet: the line to say, the price and the dish for each.`,top.map(y=>y.wine.id)); }
    // 3. Answers held once and now faded.
    const fade=c.wines.map(w=>({w,n:qsW(w).filter(q=>it(q)&&it(q).reps&&!it(q).wrong&&c.now>=it(q).due).length})).filter(y=>y.n&&!used.has(y.w.id)).sort((a,b)=>b.n-a.n), fadeN=fade.reduce((a,y)=>a+y.n,0);
    if(fadeN>=3) add('faded',`Refresh what ${f} has let slip`,`${fadeN} answers ${f} once held have faded, most on ${and(fade.slice(0,3).map(y=>nick(y.w)))}.`,`${f} used to know ${and(fade.slice(0,3).map(y=>nick(y.w)))} and the answers have faded. Write a quick refresher on them.`,fade.slice(0,3).map(y=>y.w.id));
    // 4. The area furthest from the role's minimum, with what it would start on.
    const weak=[...x.areas].filter(a=>!a.met).sort((a,b)=>(b.needs-b.known)-(a.needs-a.known))[0];
    if(weak){ const names=((TeamReport.whatsLeft(pid,3).find(y=>y.k===weak.k)||{}).names||[]).slice(0,3), lab=weak.k==='menu'?'the menu':weak.label.toLowerCase();
      add('area',`Close the gap on ${lab}`,`${weak.label}: trained on ${weak.known} of ${weak.total}, and a ${TeamLearn.ROLES[c.role].label.toLowerCase()} needs ${weak.needs}.`,`${f} is furthest behind on ${lab}: trained on ${weak.known} of ${weak.total} and needs ${weak.needs}.${names.length?` Start with ${and(names)}.`:''} Build a three-part course that gets there.`); }
    // 5. Selling under the role's average: the step up to a bottle.
    const sl=x.sales; if(sl&&sl.roleAvg&&sl.peers>1&&sl.perShift<sl.roleAvg*0.85) add('sales',`Lift what ${f} sells a shift`,`${f} sells ${TeamData.money(Math.round(sl.perShift))} of wine a shift against ${TeamData.money(Math.round(sl.roleAvg))} for the role.`,`${f} sells ${TeamData.money(Math.round(sl.perShift))} of wine a shift against ${TeamData.money(Math.round(sl.roleAvg))} for the role. Write a course on offering the bottle when a table orders two glasses, and the next wine up in price for the best sellers.`);
    // Nothing to fix: keep the best sellers fresh.
    if(!out.length){ const top=TeamSales.has()?TeamReport.salesByWine(28).slice(0,3).filter(y=>c.wines.some(w=>w.id===y.wine.id)).map(y=>nick(y.wine)):[];
      add('sharp',`Keep ${f} sharp`,`${f} is trained on everything the role needs.`,`${f} is trained on everything the role needs. Write a two-part refresher${top.length?` on ${and(top)}, the wines that sell most`:' on the wines that sell most'}, from angles ${f} hasn't been asked.`); }
    return out; },
  _id(){ return 'pl'+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36); },
  /* One question as the drill takes it: four options, the index of the right one, and what it's about. */
  _q(planId,n,raw,ok){ const on=String(raw.on||''), w=TeamData.wine(on), dish=!w&&TeamData.dish(on); if(!w&&!dish) return null;
    const opts=(raw.opts||[]).map(x=>String(x||'').trim()).filter(Boolean), uniq=new Set(opts.map(x=>TeamLearn._norm(x))), a=+raw.a, text=String(raw.q||'').trim();
    if(!text||opts.length!==4||uniq.size!==4||!(a>=0&&a<4)) return null;
    const covers=ok.has(String(raw.covers||''))?String(raw.covers):'';
    return {id:`${planId}#${n}`,k:'recognise',mc:true,q:text,opts,a,why:String(raw.why||'').trim(),covers,bespoke:planId,...(w?{wine:w.id}:{dish:dish.id})}; },
  /* Vinny writes it: one call. Saved as a draft the manager reads before pushing. Throws in words when it can't. */
  async write(pid,ask,by){ const c=TeamVinny._ctx(pid); if(!c) throw new Error('Pick someone first.'); const text=String(ask||'').trim(); if(text.length<8) throw new Error('Say who it\'s for and what they need, in a sentence.');
    const s=this.subjects(pid,text); if(!s.wines.length&&!s.dishes.length) throw new Error('Nothing on the list matches that. Try a colour, the glass list, the bottles or the menu.');
    const v=TeamData.get().venue||{}, tpl=_loadTextSync('prompts/team-plan.txt');
    const prompt=tpl.replace(/\{\{venue\}\}/g,v.name||'the restaurant').replace('{{about}}',TeamData.about()).replace('{{person}}',this._who(pid)).replace('{{ask}}',text).replace('{{kind}}',s.pairing&&!s.mixed?'This is a PAIRING plan. Every question in every part is a pairing question, as defined above. Give the parts different angles on it: the wine for the dish, the dish for the wine, by the glass, why it works, steering a guest from a poor match.':s.pairing?'The manager asked for pairings among other things. At least one whole part is pairing questions, as defined above, and no question anywhere asks what a dish is, how it is cooked or what is in it.':s.menu?'This plan is about the menu itself.':'No question asks what a dish is, how it is cooked or what is in it.')
      .replace('{{subjects}}',[...s.wines.map(w=>this._wineLines(pid,c,w)),...s.dishes.map(x=>this._dishLines(pid,c,x,s.pairing))].join('\n\n'));
    const res=await window.claude.complete({purpose:'team_plan',messages:[{role:'user',content:prompt}]}), j=TeamData._json(res)||{};
    const id=this._id(), ok=new Set([...s.wines.flatMap(w=>TeamLearn.qsFor(c.role,w.id)),...s.dishes.flatMap(x=>TeamLearn.dishQsFor(c.role,x.id,{allergen:false}))].map(q=>q.id)); let n=0;
    const seen=new Set(), parts=(j.parts||[]).map(p=>({title:String(p.title||'').trim()||'Practice',why:String(p.why||'').trim(),qs:(p.qs||[]).map(r=>this._q(id,n++,r,ok)).filter(q=>{ if(!q) return false; const k=TeamLearn._norm(q.q); if(seen.has(k)) return false;
      // Asked for pairings, a question that is only about a dish (or, in a pairing-only plan, only about a wine) is left out.
      if(s.pairing&&(q.dish||!s.mixed)&&!this.isPairText(q)) return false; seen.add(k); return true; })})).filter(p=>p.qs.length>=2);
    if(!parts.length) throw new Error('Vinny couldn\'t write a plan from that. Say what they\'re struggling with: a colour, prices, pairings, the bottles.');
    const plan={id,pid,ask:text,by:by||null,at:Date.now(),status:'draft',source:'vinny',title:String(j.title||'').trim()||'Bespoke training',summary:String(j.summary||'').trim(),parts};
    const d=this.get(); d.plans.push(plan); this.save(d); return plan; },
  /* The same shape with no call, from the questions the person already has on those wines and dishes (each covers
     itself): the fallback when Vinny can't be reached, and how the demo's plans are made. */
  fromCards(pid,ask,by,{title,status='draft',at=Date.now()}={}){ const c=TeamVinny._ctx(pid); if(!c) return null; const s=this.subjects(pid,ask), id=this._id(); let n=0;
    const four=q=>(q.k==='recognise'||q.mc)&&Array.isArray(q.opts)&&q.opts.length>=3&&q.a!=null;
    const mk=(list,qsOf,key)=>list.flatMap(x=>qsOf(x).filter(four).slice(0,2).map(q=>({...q,id:`${id}#${n++}`,covers:q.id,bespoke:id,mc:true,[key]:x.id})));
    const wq=s.pairing&&!s.mixed?[]:mk(s.wines,w=>TeamLearn.qsFor(c.role,w.id),'wine'), dq=mk(s.dishes,x=>TeamLearn.dishQsFor(c.role,x.id,{allergen:false}).filter(q=>s.menu||TeamLearn.isPairing(q)),'dish');
    const half=Math.ceil(wq.length/2), parts=[wq.length&&{title:'The wines, one fact each',why:'What each is and where it\'s from.',qs:wq.slice(0,half)},wq.length>3&&{title:'The same wines, a step further',why:'What sets each apart.',qs:wq.slice(half)},dq.length&&{title:'What to pour with the menu',why:'The wine for each dish.',qs:dq}].filter(p=>p&&p.qs.length);
    if(!parts.length) return null;
    const plan={id,pid,ask:String(ask||'').trim(),by:by||null,at,status,source:'cards',title:title||'Practice from their own questions',summary:'Built from the questions already written for these wines and dishes, the ones they don\'t hold yet first.',parts,...(status==='pushed'?{pushedAt:at}:{})};
    const d=this.get(); d.plans.push(plan); this.save(d); return plan; },
  dropPart(id,i){ const d=this.get(), p=d.plans.find(x=>x.id===id); if(!p||p.status!=='draft'||p.parts.length<2) return; p.parts.splice(i,1); this.save(d); },
  discard(id){ const d=this.get(); d.plans=d.plans.filter(x=>x.id!==id); this.save(d); },
  push(id){ const d=this.get(), p=d.plans.find(x=>x.id===id); if(!p) return null; p.status='pushed'; p.pushedAt=Date.now(); this.save(d); return p; },
  /* How far along: a question is done once it's been answered right. {done, total, parts:[{done,total}], next (the
     first part with something left), finished} */
  progress(plan){ const items=(TeamLearn._all()[plan.pid]||{items:{}}).items||{}, ok=q=>!!(items[q.id]&&items[q.id].reps&&!items[q.id].wrong);
    const parts=plan.parts.map(p=>({done:p.qs.filter(ok).length,total:p.qs.length})), done=parts.reduce((a,p)=>a+p.done,0), total=parts.reduce((a,p)=>a+p.total,0), next=parts.findIndex(p=>p.done<p.total);
    return {done,total,parts,next,finished:total>0&&done>=total,counts:plan.parts.reduce((a,p)=>a+p.qs.filter(q=>q.covers).length,0)}; },
  /* The questions of a part for the drill: what's left of it first, the whole part again once it's done. */
  questions(id,part){ const plan=this.plan(id); if(!plan) return []; const pr=this.progress(plan), i=part!=null?part:pr.next<0?0:pr.next, p=plan.parts[i]; if(!p) return [];
    const items=(TeamLearn._all()[plan.pid]||{items:{}}).items||{}, left=p.qs.filter(q=>!(items[q.id]&&items[q.id].reps&&!items[q.id].wrong)); return (left.length?left:p.qs).map(q=>({...q})); },
  /* For the console's figure and the phone: what's running. */
  running(){ return this.all().filter(p=>p.status==='pushed').map(p=>({plan:p,person:TeamLearn.person(p.pid),...this.progress(p)})); },
  /* The demo restaurant opens with two plans in flight (built with no call) so the tracker shows what it's for. */
  seedDemo(){ if(!TeamData.isDemo()||this.get().plans.length||Store.get('vbiz_plans_demo')) return false; Store.set('vbiz_plans_demo','1');
    const who=n=>TeamLearn.people().find(p=>p.name.split(' ')[0]===n), priya=who('Priya'), dani=who('Dani'), by=(who('Elena')||{}).id, day=86400000;
    if(priya){ const p=this.fromCards(priya.id,'the reds: prices and pairings',by,{title:'Reds: what they are and what to pour them with',status:'pushed',at:Date.now()-3*day});
      if(p){ TeamLearn._batchP=TeamLearn._all(); try{ p.parts[0].qs.slice(0,Math.max(1,p.parts[0].qs.length-1)).forEach(q=>TeamLearn.record(priya.id,q,true,'think',Date.now()-2*day)); } finally{ const all=TeamLearn._batchP; TeamLearn._batchP=null; TeamLearn._saveAll(all); } } }
    if(dani) this.fromCards(dani.id,'the bottles',by,{title:'Bottles: the last few to ready',status:'pushed',at:Date.now()-day});
    return true; },
};
Object.assign(window,{TeamPlans});
