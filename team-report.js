/* TeamReport: every figure on the management console (team-console.jsx, docs/business.md), as pure
   functions of TeamLearn, TeamData and TeamSales. Screens render these and compute nothing. Two
   kinds of figure, kept apart: what the team knows (readiness, fading answers, adoption, coverage,
   retention) from the learning, and what the till says sold (sales). Sales set learning priority
   and nothing else: a person's readiness is the same with or without them. */
const TeamReport = {
  DAY:86400000, NEW_DAYS:30, HOLE_MIN:2,
  FLOOR:['server','bartender','sommelier','buyer','manager'],
  /* Everyone who trains, with their readiness, last drill and re-check record. */
  people(){ const all=TeamLearn._all();
    return TeamLearn.people().map(p=>{ const r=TeamLearn.readiness(p.id), m=all[p.id]||{items:{},checks:[]}, last=Object.values(m.items||{}).reduce((a,it)=>Math.max(a,it.last||0),0);
      return {person:p,r,lastDrill:last||null,checks:TeamLearn.retention(p.id),due:r?r.due:0}; }).filter(x=>x.r); },
  overview(){ const ps=this.people(), c={ready:0,slipping:0,not:0}; ps.forEach(x=>c[x.r.state]++);
    const avg=ps.length?Math.round(ps.reduce((a,x)=>a+x.r.pct,0)/ps.length):0, overdue=ps.reduce((a,x)=>a+x.r.overdue,0), due=ps.reduce((a,x)=>a+x.r.due,0);
    const behind=ps.filter(x=>x.r.behind>0).length;
    return {...c,total:ps.length,avg,overdue,behind,due,retention:TeamLearn.retention(null),adoption:this.adoption(),coverage:this.coverage(),idle:ps.filter(x=>!x.lastDrill||Date.now()-x.lastDrill>7*this.DAY).length}; },
  byRole(){ const ps=this.people(), out={};
    ps.forEach(x=>{ const o=out[x.r.role]||(out[x.r.role]={role:x.r.role,label:TeamLearn.ROLES[x.r.role].label,n:0,sum:0,ready:0}); o.n++; o.sum+=x.r.pct; if(x.r.state==='ready') o.ready++; });
    return Object.values(out).map(o=>({...o,avg:Math.round(o.sum/o.n)})).sort((a,b)=>b.n-a.n); },
  /* Who is below their minimum and why: answers that have faded, new wines not yet learnt, nothing started. */
  slipping(){ const now=Date.now(), recent=new Set(this.adoption().map(a=>a.wine.id));
    // why: [{k, n, label}] with k one of faded | new | overdue | idle, so a screen can colour each.
    return this.people().filter(x=>x.r.state!=='ready').map(x=>{ const as=TeamLearn.assignments(x.person.id), newW=as.filter(a=>a.kind==='wine'&&recent.has(a.id)).length, why=[];
      if(x.r.due) why.push({k:'faded',n:x.r.due,label:`${x.r.due} faded`});
      if(newW) why.push({k:'new',n:newW,label:`${newW} new wine${newW===1?'':'s'}`});
      if(x.r.behind) why.push({k:'overdue',n:x.r.behind,label:`${x.r.behind} day${x.r.behind===1?'':'s'} behind`});
      if(!x.lastDrill) why.push({k:'idle',n:0,label:'no drill yet'}); else if(now-x.lastDrill>7*this.DAY) why.push({k:'idle',n:Math.round((now-x.lastDrill)/this.DAY),label:`last drill ${Math.round((now-x.lastDrill)/this.DAY)}d ago`});
      return {...x,why}; }).sort((a,b)=>(a.r.state==='slipping'?0:1)-(b.r.state==='slipping'?0:1)||a.r.pct-b.r.pct); },
  /* Who sells a wine (the roles whose scope has it) and how many of them know it. */
  _sellers(w){ const all=TeamLearn._all(); const ps=TeamLearn.people().filter(p=>{ const sc=TeamLearn.scope(p.role); return [...sc.glass,...sc.bottle].some(x=>x.id===w.id); });
    return {of:ps.length,knows:ps.filter(p=>TeamLearn.knowsWine(p.id,p.role,w.id,(all[p.id]||{items:{}}).items)).length,who:ps}; },
  /* Wines published in the last NEW_DAYS: how many of the people who sell each one know it. */
  adoption(days=this.NEW_DAYS){ const since=Date.now()-days*this.DAY;
    return TeamData.wines().filter(w=>w.addedAt>=since).map(w=>({wine:w,...this._sellers(w),days:Math.max(0,Math.round((Date.now()-w.addedAt)/this.DAY))})).sort((a,b)=>b.wine.addedAt-a.wine.addedAt); },
  /* How much of the list the floor can sell: a wine is covered when at least half its sellers (and
     at least HOLE_MIN people) know it; the holes are by-the-glass wines under that. */
  coverage(){ const rows=TeamData.wines().map(w=>({wine:w,...this._sellers(w)})).map(x=>({...x,covered:x.of>0&&x.knows>=Math.max(Math.min(this.HOLE_MIN,x.of),Math.ceil(x.of/2))}));
    const part=f=>{ const xs=rows.filter(f); return {covered:xs.filter(x=>x.covered).length,total:xs.length}; };
    return {glass:part(x=>TeamData.byGlass(x.wine)),bottle:part(x=>!TeamData.byGlass(x.wine)),holes:rows.filter(x=>!x.covered&&TeamData.byGlass(x.wine)).sort((a,b)=>a.knows/Math.max(1,a.of)-b.knows/Math.max(1,b.of)),rows}; },
  /* Who knows each cocktail, among the people whose role needs cocktails: [{cocktail, knows, of, card}]. */
  cocktailCoverage(){ const all=TeamLearn._all(), ppl=TeamLearn.people().filter(p=>TeamLearn.need(p.role).cocktails>0);
    return TeamData.cocktails().map(c=>({cocktail:c,of:ppl.length,card:!!TeamData.cocktailCard(c.id),
      knows:ppl.filter(p=>TeamLearn.knowsWine(p.id,p.role,c.id,(all[p.id]||{}).items||{})).length})); },
  /* A person's ladder: every wine their role sells with the rungs done, and every dish. */
  ladder(pid){ const p=TeamLearn.person(pid); if(!p) return {wines:[],dishes:[]}; const sc=TeamLearn.scope(p.role);
    return {wines:[...sc.glass,...sc.bottle].map(w=>({wine:w,...TeamLearn.progress(pid,w.id)})),dishes:sc.dishes.map(x=>({dish:x,...TeamLearn.progress(pid,x.id,{dish:true})}))}; },

  /* ── Sales (TeamSales): what sold, who sold it, and what that says about what to learn first. ── */
  _money(x){ const m=/\d+(?:\.\d+)?/.exec(String(x||'')); return m?+m[0]:0; },
  _sum(rows){ return rows.reduce((a,r)=>({revenue:a.revenue+r.q*r.p,lines:a.lines+r.q,glasses:a.glasses+(r.s==='glass'?r.q:0),bottles:a.bottles+(r.s==='bottle'?r.q:0)}),{revenue:0,lines:0,glasses:0,bottles:0}); },
  _covers(nights){ return nights.reduce((a,n)=>a+(n.covers||0),0); },
  /* This period against the one before it. */
  // Windows end at last midnight, so "the last 7 nights" is seven whole days against the seven before, never a part-night.
  salesSummary(days=7){ if(!TeamSales.has()) return null; const now=new Date().setHours(0,0,0,0), rows=TeamSales.rows(0), nights=TeamSales.nights(0);
    const cut=(from,to)=>rows.filter(r=>r.t>=from&&r.t<to), nk=(from,to)=>nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to; });
    const a=cut(now-days*this.DAY,now), b=cut(now-2*days*this.DAY,now-days*this.DAY), sa=this._sum(a), sb=this._sum(b), ca=this._covers(nk(now-days*this.DAY,now)), cb=this._covers(nk(now-2*days*this.DAY,now-days*this.DAY));
    const pct=(x,y)=>y>0?Math.round(100*(x-y)/y):null;
    return {days,...sa,covers:ca,nights:nk(now-days*this.DAY,now).length,attach:ca?sa.lines/ca:null,bottleShare:sa.lines?sa.bottles/sa.lines:null,perCover:ca?sa.revenue/ca:null,
      delta:{revenue:pct(sa.revenue,sb.revenue),lines:pct(sa.lines,sb.lines),attach:ca&&cb?pct(sa.lines/ca,sb.lines/cb):null,bottles:pct(sa.bottles,sb.bottles)},prev:{...sb,covers:cb}}; },
  /* Each wine's sales, with how many of its sellers know it beside it. */
  salesByWine(days=28){ const rows=TeamSales.rows(days), by={};
    rows.forEach(r=>{ if(!r.w) return; const x=by[r.w]||(by[r.w]={id:r.w,qty:0,revenue:0,glasses:0,bottles:0}); x.qty+=r.q; x.revenue+=r.q*r.p; if(r.s==='glass') x.glasses+=r.q; else x.bottles+=r.q; });
    const tot=Object.values(by).reduce((a,x)=>a+x.revenue,0), nights=Math.max(1,TeamSales.nights(days).length);
    return Object.values(by).map(x=>{ const w=TeamData.wine(x.id); return w&&{...x,wine:w,share:tot?x.revenue/tot:0,perNight:x.qty/nights,...this._sellers(w)}; }).filter(Boolean).sort((a,b)=>b.revenue-a.revenue); },
  /* By-the-glass wines selling least per night, each with the card's line to say to a guest. */
  slowMovers(days=28,n=5){ const sold=Object.fromEntries(this.salesByWine(days).map(x=>[x.id,x])), nights=Math.max(1,TeamSales.nights(days).length);
    return TeamData.wines().filter(TeamData.byGlass).map(w=>{ const s=sold[w.id], c=TeamData.card(w.id); return {wine:w,qty:s?s.qty:0,perNight:(s?s.qty:0)/nights,pitch:c&&c.pitch||'',...this._sellers(w)}; }).sort((a,b)=>a.qty-b.qty).slice(0,n); },
  /* Each person's selling: shifts worked (from the nights), lines and bottles, and per shift. */
  salesByServer(days=28){ const rows=TeamSales.rows(days), nights=TeamSales.nights(days), by={};
    TeamLearn.people().forEach(p=>{ by[p.id]={person:p,shifts:nights.filter(n=>(n.shifts||[]).includes(p.id)).length,lines:0,glasses:0,bottles:0,revenue:0}; });
    rows.forEach(r=>{ if(!r.v||!by[r.v]) return; const x=by[r.v]; x.lines+=r.q; x.revenue+=r.q*r.p; if(r.s==='bottle') x.bottles+=r.q; else x.glasses+=r.q; });
    return Object.values(by).filter(x=>x.lines>0||x.shifts>0).map(x=>({...x,perShift:x.shifts?x.lines/x.shifts:null,glassesPerShift:x.shifts?x.glasses/x.shifts:null,bottlesPerShift:x.shifts?x.bottles/x.shifts:null,revenuePerShift:x.shifts?x.revenue/x.shifts:null,readiness:TeamLearn.readiness(x.person.id)})).sort((a,b)=>(b.perShift||0)-(a.perShift||0)); },
  /* Trained against untrained: for each wine, how much of it a server sells per shift when they know
     it against when they don't, across the servers who worked. An honest caveat goes with it on
     screen: shifts and sections confound it. */
  trainedLift(days=28){ const rows=TeamSales.rows(days), nights=TeamSales.nights(days), all=TeamLearn._all();
    const servers=TeamLearn.people().filter(p=>['server','bartender','sommelier'].includes(p.role)), shifts=Object.fromEntries(servers.map(p=>[p.id,nights.filter(n=>(n.shifts||[]).includes(p.id)).length]));
    let kn={q:0,s:0}, un={q:0,s:0}, wines=0;
    TeamData.wines().forEach(w=>{ const k=servers.filter(p=>shifts[p.id]&&TeamLearn.knowsWine(p.id,p.role,w.id,(all[p.id]||{items:{}}).items)), u=servers.filter(p=>shifts[p.id]&&!k.includes(p));
      if(!k.length||!u.length) return; wines++;
      const q=ps=>rows.filter(r=>r.w===w.id&&ps.some(p=>p.id===r.v)).reduce((a,r)=>a+r.q,0), s=ps=>ps.reduce((a,p)=>a+shifts[p.id],0);
      kn.q+=q(k); kn.s+=s(k); un.q+=q(u); un.s+=s(u); });
    const a=kn.s?kn.q/kn.s:0, b=un.s?un.q/un.s:0;
    return {wines,known:a,unknown:b,pct:b>0?Math.round(100*(a-b)/b):null}; },
  /* What to learn first: the wines that sell most and that the fewest of their sellers know. */
  priority(days=28,n=6){ const sold=Object.fromEntries(this.salesByWine(days).map(x=>[x.id,x]));
    return TeamData.wines().map(w=>{ const s=sold[w.id], sel=this._sellers(w), gap=sel.of?1-sel.knows/sel.of:0; return {wine:w,qty:s?s.qty:0,...sel,gap,score:(s?s.qty:0)*(0.25+gap)}; })
      .filter(x=>x.gap>0&&x.qty>0).sort((a,b)=>b.score-a.score).slice(0,n); },
  /* What one wine sells here, for the drill's summary: {perWeek, glasses, bottles, demo} over the last 28 nights, or null. */
  sells(wineId,days=28){ if(!TeamSales.has()) return null; const x=this.salesByWine(days).find(y=>y.id===wineId); if(!x||!x.qty) return null;
    const weeks=Math.max(1,TeamSales.nights(days).length/7); return {perWeek:x.qty/weeks,glasses:x.glasses/weeks,bottles:x.bottles/weeks,revenue:x.revenue/weeks,demo:TeamSales.demo()}; },
  sellsLine(wineId){ const s=this.sells(wineId); if(!s) return ''; const w=TeamData.wine(wineId); if(!w) return '';
    const g=Math.round(s.glasses), b=Math.round(s.bottles), bits=[g&&`${g} glass${g===1?'':'es'}`,b&&`${b} bottle${b===1?'':'s'}`].filter(Boolean);
    return bits.length?`The ${TeamData.nick(w)} sells ${bits.join(' and ')} a week here${s.demo?' (demo data)':''}.`:''; },
  /* Weekly wine revenue, oldest first, for the sparkline. */
  weeklyTrend(weeks=8){ const rows=TeamSales.rows(0), now=Date.now(), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY, rs=rows.filter(r=>r.t>=from&&r.t<to), s=this._sum(rs); out.push({from,to,...s}); }
    return out; },
  /* Each person's by-the-glass lines per shift, week by week: the shape of Marco's dip. */
  serverTrend(pid,weeks=8){ const rows=TeamSales.rows(0), nights=TeamSales.nights(0), now=Date.now(), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY; const sh=nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to&&(n.shifts||[]).includes(pid); }).length;
      const q=rows.filter(r=>r.v===pid&&r.t>=from&&r.t<to).reduce((a,r)=>a+r.q,0); out.push({from,to,shifts:sh,lines:q,perShift:sh?q/sh:null}); }
    return out; },
  /* What knowing the list is worth to one person, in their own money, from this venue's till: the wines among the top
     sellers they don't yet know, each at the gap between what a server sells of it per shift when they know it and when
     they don't (trainedLift's per-wine form), at its price; tips at TIP_LOW to TIP_HIGH of the extra. Honest about its
     floor: WORTH_NIGHTS of sales and two servers a side, else null and the screen says the research figure instead.
     Never a promise; the caveat goes with it. {perShift, tipLow, tipHigh, wines, demo, caveat} */
  TIP_LOW:0.15, TIP_HIGH:0.2, WORTH_NIGHTS:28,
  worth(pid,days=28){ if(!TeamSales.has()) return null; const p=TeamLearn.person(pid); if(!p) return null;
    const nights=TeamSales.nights(days); if(nights.length<this.WORTH_NIGHTS) return null;
    const rows=TeamSales.rows(days), all=TeamLearn._all(), servers=TeamLearn.people().filter(x=>['server','bartender','sommelier'].includes(x.role));
    const shifts=Object.fromEntries(servers.map(x=>[x.id,nights.filter(n=>(n.shifts||[]).includes(x.id)).length]));
    const items=(all[pid]||{items:{}}).items, top=this.salesByWine(days).slice(0,8);
    let extra=0, n=0;
    top.forEach(x=>{ const w=x.wine; if(TeamLearn.knowsWine(pid,p.role,w.id,items)) return;
      const k=servers.filter(s=>shifts[s.id]&&TeamLearn.knowsWine(s.id,s.role,w.id,(all[s.id]||{items:{}}).items)), u=servers.filter(s=>shifts[s.id]&&!k.includes(s));
      if(k.length<2||u.length<2) return;
      const q=ps=>rows.filter(rw=>rw.w===w.id&&ps.some(s=>s.id===rw.v)).reduce((a,rw)=>a+rw.q,0), sh=ps=>ps.reduce((a,s)=>a+shifts[s.id],0);
      const gap=q(k)/sh(k)-q(u)/sh(u); if(gap<=0) return;
      const price=rows.filter(rw=>rw.w===w.id).reduce((a,rw)=>a+rw.p*rw.q,0)/Math.max(1,rows.filter(rw=>rw.w===w.id).reduce((a,rw)=>a+rw.q,0));
      extra+=gap*price; n++; });
    if(!n) return null;
    return {perShift:extra,tipLow:extra*this.TIP_LOW,tipHigh:extra*this.TIP_HIGH,wines:n,demo:TeamSales.demo(),
      caveat:`From this restaurant's sales data over ${days} nights: what servers who know each of your best-selling wines sell of it per shift, against those who don't, over the ${n} you don't know yet. Sections and nights vary; some of it replaces other sales. Not a promise.`}; },
  /* The allergen sign-off register (docs/business.md, "The menu"): for each person, how many of the kitchen-confirmed
     dishes' allergen questions they hold now, when they last held them all (passed), and the soonest one falls due;
     plus the register as CSV for an inspector or HR. Only the kitchen's confirmed allergens are ever counted. */
  allergenRegister(){ const all=TeamLearn._all(), dishes=TeamData.dishes().filter(x=>TeamData.allergensOf(x.id)!=null);
    return TeamLearn.people().map(p=>{ const items=(all[p.id]||{items:{}}).items, qs=dishes.map(x=>TeamLearn.allergenQ(x.id)).filter(Boolean);
      const known=qs.filter(q=>TeamLearn.known(items[q.id])).length, lasts=qs.map(q=>items[q.id]&&items[q.id].reps&&!items[q.id].wrong?items[q.id].last:0), dues=qs.map(q=>items[q.id]&&TeamLearn.known(items[q.id])?items[q.id].due:Infinity);
      const passed=qs.length&&known===qs.length?Math.max(...lasts):null, due=qs.length&&known===qs.length?Math.min(...dues):null;
      return {person:p,known,total:qs.length,passed,due,state:!qs.length?'none':known===qs.length?'passed':known?'partial':'none'}; }); },
  allergenCsv(){ const venue=TeamData.get().venue.name||'', d=ms=>ms?new Date(ms).toISOString().slice(0,10):'';
    const rows=[['Venue','Person','Role','Dishes confirmed','Held now','Passed on','Falls due'],...this.allergenRegister().map(x=>[venue,x.person.name,TeamLearn.ROLES[x.person.role].label,x.total,x.known,d(x.passed),d(x.due)])];
    return rows.map(r=>r.map(v=>/[",\n]/.test(String(v))?'"'+String(v).replace(/"/g,'""')+'"':String(v)).join(',')).join('\n')+'\n'; },
  newOnTill(){ return TeamSales.has()?TeamSales.unmapped():[]; },
  /* What a manager needs to know from the till, in a few sentences, most telling first: the week against the one
     before, wine per guest, the best seller and whether the floor knows it, top sellers known by too few, a glass the floor
     knows that still doesn't sell, slow glasses,
     what training is worth in sales, who to drill, till items with no wine behind them. Each {k, tone: good|bad|note,
     title, text, open?} where open is what tapping it should show. Never moves readiness; null without sales. */
  salesBrief(){ if(!TeamSales.has()) return null; const s=this.salesSummary(7); if(!s) return null;
    const out=[], m=n=>TeamData.money(Math.round(n)), byWine=this.salesByWine(28), slow=this.slowMovers(28,5), lift=this.trainedLift(28), till=this.newOnTill();
    const d=s.delta.revenue;
    out.push({k:'week',tone:d==null?'note':d>=0?'good':'bad',title:`${m(s.revenue)} of wine over 7 nights`,text:d==null?`${s.lines} glasses and bottles to ${s.covers} guests.`:`${d>=0?'Up':'Down'} ${Math.abs(d)}% on the week before (${m(s.prev.revenue||0)}), ${s.lines} glasses and bottles to ${s.covers} guests.`});
    if(s.perCover!=null) out.push({k:'cover',tone:s.delta.attach==null?'note':s.delta.attach>=0?'good':'bad',title:`${m(s.perCover)} of wine per guest`,text:`${s.attach.toFixed(2)} glasses or bottles each${s.delta.attach==null?'':`, ${s.delta.attach>=0?'up':'down'} ${Math.abs(s.delta.attach)}% on the week before`}; ${Math.round(100*(s.bottleShare||0))}% of wine sold by the bottle.`});
    const top=byWine[0];
    if(top) out.push({k:'top',tone:top.of&&top.knows<top.of?'bad':'good',title:`Best seller: ${TeamData.short(top.wine)}`,text:`${m(top.revenue)} over 28 nights, ${Math.round(100*top.share)}% of wine sales. ${top.of?(top.knows<top.of?`Only ${top.knows} of the ${top.of} on the team who serve it know it.`:`Everyone on the team who serves it knows it.`):''}`,open:{view:'wine',id:top.wine.id}});
    const gaps=byWine.slice(0,8).filter(x=>x.of&&x.knows<Math.ceil(x.of/2));
    if(gaps.length) out.push({k:'gaps',tone:'bad',title:`${gaps.length} of your 8 best-selling wines: most of the team who serve them don't know them yet`,text:gaps.slice(0,3).map(x=>`${TeamData.short(x.wine)}, known by ${x.knows} of the ${x.of} on the team who serve it`).join('; ')+'. Drill these first.',open:{view:'wine',id:gaps[0].wine.id}});
    if(lift.pct!=null&&lift.wines) out.push({k:'lift',tone:lift.pct>0?'good':'note',title:lift.pct>0?`Training is worth ${lift.pct}% more sales`:`No sales lift from training yet`,text:lift.pct>0?`A server sells ${lift.known.toFixed(2)} of a wine per shift once they know it, against ${lift.unknown.toFixed(2)} before. Shifts and sections affect this too, so read it as a pointer.`:`Across ${lift.wines} wines, servers who know a wine don't yet sell more of it.`});
    const seller=this.salesByServer(28).filter(x=>x.shifts>0&&['server','bartender'].includes(x.person.role));
    if(seller.length>2){ const low=[...seller].sort((a,b)=>(a.perShift||0)-(b.perShift||0))[0];
      if(low&&low.readiness&&low.readiness.state!=='ready') out.push({k:'drill',tone:'bad',title:`${low.person.name.split(' ')[0]} sells the least wine per shift`,text:`${(low.perShift||0).toFixed(1)} glasses and bottles a shift, and ${low.readiness.pct}% ready. A few drills on what sells is the quickest lift.`,open:{view:'person',id:low.person.id}}); }
    // The other way round: a glass most of its sellers can talk about that still sells little. Training isn't the
    // fix there, so it points at the price, the pour or where it sits on the list.
    const glassAll=this.slowMovers(28,Infinity), mid=glassAll.length?glassAll[Math.floor(glassAll.length/2)].perNight:0;
    const known=glassAll.find(x=>x.of>=3&&x.knows>=Math.ceil(x.of/2)&&x.perNight<mid);
    if(known) out.push({k:'known',tone:'note',title:`${TeamData.short(known.wine)}: known, but not selling`,text:`${known.knows} of the ${known.of} on the team who serve it know it, and it sells ${known.perNight.toFixed(1)} a night. The floor can talk about it, so look at its price, its pour or where it sits on the list.`,open:{view:'wine',id:known.wine.id}});
    const dead=slow.filter(x=>x.perNight<0.5&&(!known||x.wine.id!==known.wine.id));
    if(dead.length) out.push({k:'slow',tone:'note',title:`${dead.length} by-the-glass wine${dead.length===1?'':'s'} barely moving`,text:dead.slice(0,3).map(x=>TeamData.short(x.wine)).join(', ')+`: under one glass every two nights. Give the floor the line to say, or rethink the pour.`,open:{view:'wine',id:dead[0].wine.id}});
    if(till.length) out.push({k:'till',tone:'note',title:`${till.length} POS item${till.length===1?'':'s'} not matched to the list`,text:`${till.slice(0,2).map(x=>x.item).join(', ')}: a new arrival nobody has uploaded, or a name to map.`,open:{tab:'pos'}});
    return out; },
};
Object.assign(window,{TeamReport});
