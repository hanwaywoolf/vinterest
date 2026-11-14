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
  _sum(rows){ return rows.reduce((a,r)=>({revenue:a.revenue+r.q*r.p,lines:a.lines+r.q,glasses:a.glasses+(r.s==='glass'?r.q:0),bottles:a.bottles+(r.s==='bottle'?r.q:0),bottleRevenue:a.bottleRevenue+(r.s==='bottle'?r.q*r.p:0)}),{revenue:0,lines:0,glasses:0,bottles:0,bottleRevenue:0}); },
  _covers(nights){ return nights.reduce((a,n)=>a+(n.covers||0),0); },
  /* This period against the one before it. */
  // Windows end at last midnight, so "the last 7 nights" is seven whole days against the seven before, never a part-night.
  salesSummary(days=7){ if(!TeamSales.has()) return null; const now=new Date().setHours(0,0,0,0), rows=TeamSales.rows(0), nights=TeamSales.nights(0);
    const cut=(from,to)=>rows.filter(r=>r.t>=from&&r.t<to), nk=(from,to)=>nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to; });
    const a=cut(now-days*this.DAY,now), b=cut(now-2*days*this.DAY,now-days*this.DAY), sa=this._sum(a), sb=this._sum(b), ca=this._covers(nk(now-days*this.DAY,now)), cb=this._covers(nk(now-2*days*this.DAY,now-days*this.DAY));
    const pct=(x,y)=>y>0?Math.round(100*(x-y)/y):null;
    // Glasses and bottles are counted apart everywhere: a bottle is several glasses' revenue, so one blended count of
    // "glasses or bottles" hides what moved.
    const per=(x,c)=>c?x/c:null;
    return {days,...sa,covers:ca,nights:nk(now-days*this.DAY,now).length,attach:per(sa.lines,ca),glassesPerCover:per(sa.glasses,ca),bottlesPerCover:per(sa.bottles,ca),bottleShare:sa.lines?sa.bottles/sa.lines:null,bottleTakings:sa.revenue?sa.bottleRevenue/sa.revenue:null,perCover:per(sa.revenue,ca),
      delta:{revenue:pct(sa.revenue,sb.revenue),lines:pct(sa.lines,sb.lines),attach:ca&&cb?pct(sa.lines/ca,sb.lines/cb):null,glasses:pct(sa.glasses,sb.glasses),bottles:pct(sa.bottles,sb.bottles),
        perCover:ca&&cb?pct(sa.revenue/ca,sb.revenue/cb):null,glassesPerCover:ca&&cb?pct(sa.glasses/ca,sb.glasses/cb):null,bottlesPerCover:ca&&cb?pct(sa.bottles/ca,sb.bottles/cb):null},prev:{...sb,covers:cb}}; },
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
      // In money, not lines: a bottle and a glass of the same wine are different sales.
      const q=ps=>rows.filter(r=>r.w===w.id&&ps.some(p=>p.id===r.v)).reduce((a,r)=>a+r.q*r.p,0), s=ps=>ps.reduce((a,p)=>a+shifts[p.id],0);
      kn.q+=q(k); kn.s+=s(k); un.q+=q(u); un.s+=s(u); });
    const a=kn.s?kn.q/kn.s:0, b=un.s?un.q/un.s:0;
    // `x`: how many times as much a server who knows a wine takes on it as one who doesn't (3.1×), the plainer figure.
    return {wines,known:a,unknown:b,pct:b>0?Math.round(100*(a-b)/b):null,x:b>0?Math.round(10*a/b)/10:null}; },
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
  /* Each person's glasses per shift, week by week (bottles apart, as everywhere): the shape of Marco's dip. */
  serverTrend(pid,weeks=8){ const rows=TeamSales.rows(0), nights=TeamSales.nights(0), now=Date.now(), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY; const sh=nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to&&(n.shifts||[]).includes(pid); }).length;
      const q=rows.filter(r=>r.v===pid&&r.s!=='bottle'&&r.t>=from&&r.t<to).reduce((a,r)=>a+r.q,0); out.push({from,to,shifts:sh,lines:q,perShift:sh?q/sh:null}); }
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
    const gb=(g,b)=>`${g} glass${g===1?'':'es'} and ${b} bottle${b===1?'':'s'}`, dl=x=>x==null?'':`${x>=0?'up':'down'} ${Math.abs(x)}%`;
    out.push({k:'week',tone:d==null?'note':d>=0?'good':'bad',title:`${m(s.revenue)} of wine over 7 nights`,text:d==null?`${gb(s.glasses,s.bottles)} to ${s.covers} guests.`:`${d>=0?'Up':'Down'} ${Math.abs(d)}% on the week before (${m(s.prev.revenue||0)}): ${gb(s.glasses,s.bottles)} to ${s.covers} guests.`});
    if(s.perCover!=null){ const dg=s.delta.glassesPerCover, db=s.delta.bottlesPerCover;
      out.push({k:'cover',tone:s.delta.perCover==null?'note':s.delta.perCover>=0?'good':'bad',title:`${m(s.perCover)} of wine per guest`,text:`${s.glassesPerCover.toFixed(2)} glasses and ${s.bottlesPerCover.toFixed(2)} bottles a guest${dg==null&&db==null?'':` (glasses ${dl(dg)}, bottles ${dl(db)} on the week before)`}; bottles bring in ${Math.round(100*(s.bottleTakings||0))}% of wine takings.`}); }
    const top=byWine[0];
    if(top) out.push({k:'top',tone:top.of&&top.knows<top.of?'bad':'good',title:`Best seller: ${TeamData.short(top.wine)}`,text:`${m(top.revenue)} over 28 nights, ${Math.round(100*top.share)}% of wine sales. ${top.of?(top.knows<top.of?`Only ${top.knows} of the ${top.of} on the team who serve it know it.`:`Everyone on the team who serves it knows it.`):''}`,open:{view:'wine',id:top.wine.id}});
    const gaps=byWine.slice(0,8).filter(x=>x.of&&x.knows<Math.ceil(x.of/2));
    // One row per wine (its name, then how many of those who serve it know it), not one long sentence of them.
    if(gaps.length) out.push({k:'gaps',tone:'bad',title:gaps.length===1?`1 of your top 8 sellers isn't known yet`:`${gaps.length} of your top 8 sellers aren't known yet`,
      text:`Most of the team who serve ${gaps.length===1?'it don\'t know it':'them don\'t know them'}. Drill ${gaps.length===1?'it':'these'} first.`,
      rows:gaps.map(x=>({label:TeamData.short(x.wine),value:`${x.knows} of ${x.of} know it`,open:{view:'wine',id:x.wine.id}})),open:{view:'wine',id:gaps[0].wine.id}});
    // Said as what was compared: servers who know a wine against servers who don't, on the same wine, per shift; never
    // "before", since it isn't the same person before and after training.
    if(lift.pct!=null&&lift.wines) out.push({k:'lift',tone:lift.pct>0?'good':'note',title:lift.pct>0?`A wine sells ${lift.x>=1.95?Math.round(lift.x)+'×':lift.x+'×'} better with a server who knows it`:`No sales lift from training yet`,text:lift.pct>0?`On the shifts of servers who know a wine, it sells about ${lift.x} times as much as on the shifts of servers who don't (${lift.wines} wines compared over 28 nights: ${TeamData.money(lift.known,{dp:2})} against ${TeamData.money(lift.unknown,{dp:2})} a shift, per wine). Other things move this too, like who works the busy nights, so treat it as a pointer rather than a measurement.`:`Across ${lift.wines} wines, servers who know a wine don't yet sell more of it.`});
    const seller=this.salesByServer(28).filter(x=>x.shifts>0&&['server','bartender'].includes(x.person.role));
    if(seller.length>2){ const low=[...seller].sort((a,b)=>(a.revenuePerShift||0)-(b.revenuePerShift||0))[0];
      if(low&&low.readiness&&low.readiness.state!=='ready') out.push({k:'drill',tone:'bad',title:`${low.person.name.split(' ')[0]} sells the least wine per shift`,text:`${m(low.revenuePerShift||0)} a shift: ${[(low.glassesPerShift||0)>=0.05?`${low.glassesPerShift.toFixed(1)} glasses`:'',(low.bottlesPerShift||0)>=0.05?`${low.bottlesPerShift.toFixed(1)} bottles`:''].filter(Boolean).join(' and ')||'nothing yet'}, and ${low.readiness.pct}% ready. A few drills on what sells is the quickest lift.`,open:{view:'person',id:low.person.id}}); }
    // The other way round: a glass most of its sellers can talk about that still sells little. Training isn't the
    // fix there, so it points at the price, the pour or where it sits on the list.
    const glassAll=this.slowMovers(28,Infinity), mid=glassAll.length?glassAll[Math.floor(glassAll.length/2)].perNight:0;
    const known=glassAll.find(x=>x.of>=3&&x.knows>=Math.ceil(x.of/2)&&x.perNight<mid);
    if(known) out.push({k:'known',tone:'note',title:`${TeamData.short(known.wine)}: known, but not selling`,text:`${known.knows} of the ${known.of} on the team who serve it know it, and it sells ${known.perNight.toFixed(1)} glasses a night. The floor can talk about it, so look at its price, its pour or where it sits on the list.`,open:{view:'wine',id:known.wine.id}});
    const dead=slow.filter(x=>x.perNight<0.5&&(!known||x.wine.id!==known.wine.id));
    if(dead.length) out.push({k:'slow',tone:'note',title:`${dead.length} by-the-glass wine${dead.length===1?'':'s'} barely moving`,text:dead.slice(0,3).map(x=>TeamData.short(x.wine)).join(', ')+`: under one glass every two nights. Give the floor the line to say, or rethink the pour.`,open:{view:'wine',id:dead[0].wine.id}});
    if(till.length) out.push({k:'till',tone:'note',title:`${till.length} POS item${till.length===1?'':'s'} not matched to the list`,text:`${till.slice(0,2).map(x=>x.item).join(', ')}: a new arrival nobody has uploaded, or a name to map.`,open:{tab:'pos'}});
    return out; },
  /* ── The console's new look (team-console2.jsx, docs/business.md "The console's new look") ── */
  /* Who can sell a wine: of those whose role serves it, the people who hold it now. */
  knownBy(w){ const s=this._sellers(w), all=TeamLearn._all(); return {of:s.of,people:s.who.filter(p=>TeamLearn.knowsWine(p.id,p.role,w.id,(all[p.id]||{items:{}}).items))}; },
  /* Sales Insights' "What you need to know" in the new look: each item is what the sales say (`fact`) and what to do
     about it (`act`), in words a new owner follows without the console's vocabulary. "Trained on a wine" is the one
     term: that person has passed the wine's questions in the drill to their role's minimum. */
  salesActions(){ if(!TeamSales.has()) return []; const s=this.salesSummary(7); if(!s) return [];
    const out=[], m=n=>TeamData.money(Math.round(n)), byWine=this.salesByWine(28), lift=this.trainedLift(28), till=this.newOnTill(), d=s.delta.revenue, n=x=>x===1?'1 person':`${x} people`;
    const gaps=byWine.slice(0,8).filter(x=>x.of&&x.knows<Math.ceil(x.of/2));
    gaps.slice(0,2).forEach(x=>out.push({tag:'Train',tone:'bad',fact:`${TeamData.short(x.wine)} is one of your top sellers, but only ${x.knows} of the ${n(x.of)} who serve it ${x.knows===1?'is':'are'} trained on it.`,act:`Assign it to the other ${x.of-x.knows} so they learn it this week.`,open:{view:'wine',id:x.wine.id}}));
    out.push({tag:'Sales',tone:d==null?'note':d>=0?'good':'bad',fact:d==null?`You sold ${m(s.revenue)} of wine in the last 7 nights.`:`You sold ${m(s.revenue)} of wine in the last 7 nights, ${d>=0?'up':'down'} ${Math.abs(d)}% on the week before.`,
      act:d!=null&&d<0?'See Best sellers below for the wines that fell.':'See Best sellers below for the wines behind it.'});
    if(s.perCover!=null){ const dp=s.delta.perCover; out.push({tag:'Guests',tone:dp==null?'note':dp>=0?'good':'bad',fact:`Each guest spent ${TeamData.money(s.perCover,{dp:2})} on wine${dp==null?'':`, ${dp>=0?'up':'down'} ${Math.abs(dp)}% on the week before`}.`,
      act:dp!=null&&dp<0?'Have servers offer the bottle when a table orders a second glass of the same wine.':'Keep offering the bottle when a table orders a second glass.'}); }
    if(lift.pct>0&&lift.wines) out.push({tag:'Training',tone:'good',fact:`A server trained on a wine sells about ${lift.x>=1.95?Math.round(lift.x):lift.x} times as much of it as one who isn't.`,act:gaps.length?`Start with the ${TeamData.nick(gaps[0].wine)}: it sells and few are trained on it.`:'Keep new arrivals assigned as they come in.'});
    const seller=this.salesByServer(28).filter(x=>x.shifts>0&&['server','bartender'].includes(x.person.role));
    if(seller.length>2){ const low=[...seller].sort((a,b)=>(a.revenuePerShift||0)-(b.revenuePerShift||0))[0];
      if(low&&low.readiness&&low.readiness.state!=='ready'){ const f=low.person.name.split(' ')[0]; out.push({tag:'Team',tone:'bad',fact:`${f} sells the least wine a shift (${m(low.revenuePerShift||0)}) and has finished ${low.readiness.pct}% of the training for the role.`,act:`Ask ${f} to do today's drill before service.`,open:{view:'person',id:low.person.id}}); } }
    const glassAll=this.slowMovers(28,Infinity), mid=glassAll.length?glassAll[Math.floor(glassAll.length/2)].perNight:0, known=glassAll.find(x=>x.of>=3&&x.knows>=Math.ceil(x.of/2)&&x.perNight<mid);
    if(known) out.push({tag:'Slow',tone:'note',fact:`${TeamData.short(known.wine)} sells ${known.perNight.toFixed(1)} glasses a night, though most of its servers are trained on it.`,act:'Training isn\'t the problem here: look at its price or pour size.',open:{view:'wine',id:known.wine.id}});
    if(till.length) out.push({tag:'POS',tone:'note',fact:`${till.length} item${till.length===1?'':'s'} in your sales ${till.length===1?'isn\'t':'aren\'t'} matched to a wine on your list (${till[0].item}).`,act:'Match it in Integrations so its sales count.',open:{tab:'pos'}});
    return out; },
  /* Wine takings a guest, week by week, oldest first: [{from,to,revenue,covers,perCover}]. */
  perCoverTrend(weeks=8){ const rows=TeamSales.rows(0), nights=TeamSales.nights(0), now=new Date().setHours(0,0,0,0), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY, rev=rows.filter(r=>r.t>=from&&r.t<to).reduce((a,r)=>a+r.q*r.p,0);
      const cov=this._covers(nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to; })); out.push({from,to,revenue:rev,covers:cov,perCover:cov?rev/cov:null}); }
    return out; },
  /* The share of wine takings rung up by someone who knows the wine they sold, this period and the one before. */
  soldKnowing(days=7){ const rows=TeamSales.rows(0), now=new Date().setHours(0,0,0,0), all=TeamLearn._all(), ppl=Object.fromEntries(TeamLearn.people().map(p=>[p.id,p]));
    const part=(from,to)=>{ let k=0,t=0; rows.forEach(r=>{ if(r.t<from||r.t>=to||!r.w||!r.v||!ppl[r.v]) return; const m=r.q*r.p; t+=m; if(TeamLearn.knowsWine(r.v,ppl[r.v].role,r.w,(all[r.v]||{items:{}}).items)) k+=m; }); return t?k/t:null; };
    const a=part(now-days*this.DAY,now), b=part(now-2*days*this.DAY,now-days*this.DAY); return {share:a,prev:b,delta:a!=null&&b!=null?Math.round(100*(a-b)):null}; },
  /* Each wine's takings this period against the one before, as a percentage: {wineId: pct}. */
  wineDelta(days=7){ const rows=TeamSales.rows(0), now=new Date().setHours(0,0,0,0), a={}, b={};
    rows.forEach(r=>{ if(!r.w) return; if(r.t>=now-days*this.DAY&&r.t<now) a[r.w]=(a[r.w]||0)+r.q*r.p; else if(r.t>=now-2*days*this.DAY&&r.t<now-days*this.DAY) b[r.w]=(b[r.w]||0)+r.q*r.p; });
    return Object.fromEntries(Object.keys({...a,...b}).map(id=>[id,b[id]>0?Math.round(100*((a[id]||0)-b[id])/b[id]):null])); },
  /* What is still on the table: for each of the top sellers, what a week would add if the servers who don't know it
     sold it at the rate of those who do (trainedLift's comparison, per wine, in money). A pointer, never a promise:
     {total, rows:[{wine, extra, knows, of}]} a week, biggest first; null without enough sales. */
  upside(days=28,n=8){ if(!TeamSales.has()) return null; const rows=TeamSales.rows(days), nights=TeamSales.nights(days), all=TeamLearn._all(), weeks=Math.max(1,nights.length/7);
    const servers=TeamLearn.people().filter(p=>['server','bartender','sommelier'].includes(p.role)), shifts=Object.fromEntries(servers.map(p=>[p.id,nights.filter(x=>(x.shifts||[]).includes(p.id)).length]));
    const out=this.salesByWine(days).slice(0,n).map(x=>{ const w=x.wine, k=servers.filter(p=>shifts[p.id]&&TeamLearn.knowsWine(p.id,p.role,w.id,(all[p.id]||{items:{}}).items)), u=servers.filter(p=>shifts[p.id]&&!k.includes(p));
      const money=ps=>rows.filter(r=>r.w===w.id&&ps.some(p=>p.id===r.v)).reduce((a,r)=>a+r.q*r.p,0), sh=ps=>ps.reduce((a,p)=>a+shifts[p.id],0);
      const gap=k.length&&u.length?Math.max(0,money(k)/sh(k)-money(u)/sh(u)):0; return {wine:w,extra:gap*sh(u)/weeks,knows:x.knows,of:x.of,missing:u}; }).filter(x=>x.extra>=1).sort((a,b)=>b.extra-a.extra);
    return {total:out.reduce((a,x)=>a+x.extra,0),rows:out}; },
  /* Readiness week by week isn't kept yet, so only a demo restaurant draws it: a rise to where the team stands today,
     the same every time, labelled Demo data on screen. null for a real restaurant. */
  readinessTrend(weeks=8){ if(!(TeamData.get().venue||{}).sample) return null; const cur=this.overview().avg; if(!cur) return null;
    return Array.from({length:weeks},(_,i)=>Math.round(cur*(0.55+0.45*Math.pow(i/(weeks-1),0.85))+(i%3===1&&i<weeks-1?-1.5:0))); },
  /* Each dish and the wine poured with it: its first pick, its glass pick, and who can offer it (the people who know
     the first pick). `sold` is how often the dish went out with that wine: check-level sales the console doesn't have
     yet, so a demo restaurant shows an invented share (the same every time, higher where more of the team know the
     pairing) and a real one shows none. */
  pairings(){ const demo=!!(TeamData.get().venue||{}).sample&&TeamSales.demo();
    return TeamData.dishes().map(x=>{ const p=TeamData.pairing(x.id), first=p&&p.best&&p.best[0]&&TeamData.wine(p.best[0].id), glass=p&&p.glass&&TeamData.wine(p.glass.id); if(!first) return {dish:x,first:null};
      const kb=this.knownBy(first); let h=0; for(const ch of x.id) h=(h*31+ch.charCodeAt(0))%997;
      const sold=demo?Math.round(100*Math.min(0.72,0.1+0.5*(kb.of?kb.people.length/kb.of:0)+(h%17)/100))/100:null;
      return {dish:x,first,glass,why:p.best[0].why,...kb,sold,perWeek:demo?8+(h%34):null}; }); },
  /* One standout fact and up to three quick ones for the top of a console page: {pre, strong, post, bullets:[{tone,
     text}]} with tone good|note|bad. Every figure is from the restaurant's own sales and training. */
  headline(section){ const m=(n,dp=0)=>TeamData.money(n,{dp}), out={pre:'',strong:'',post:'',bullets:[]}, add=(tone,text)=>{ if(text&&out.bullets.length<3) out.bullets.push({tone,text}); };
    const s=TeamSales.has()?this.salesSummary(7):null, byWine=s?this.salesByWine(7):[], delta=s?this.wineDelta(7):{};
    const gap=byWine.slice(0,8).filter(x=>x.of&&x.knows<Math.ceil(x.of/2))[0], sold=x=>x.glasses>=x.bottles?`${x.glasses} glasses`:`${x.bottles} bottles`;
    if(section==='dash'){ const t=s?this.perCoverTrend(8).filter(x=>x.perCover!=null):[];
      const lift=s?this.trainedLift(28):null;
      if(lift&&lift.x>=1.2){ out.pre='A wine sells '; out.strong=`${lift.x>=2?Math.round(lift.x):lift.x}× better`; out.post=' with a server trained on it.'; }
      else if(t.length>1){ const d=t[t.length-1].perCover-t[0].perCover; out.pre='Wine per guest is '+(d>=0?'up ':'down '); out.strong=m(Math.abs(d),2); out.post=` in ${t.length===8?'eight':t.length} weeks.`; }
      else { const o=this.overview(); out.pre='Your team is '; out.strong=`${o.avg}% ready`; out.post=' for tonight.'; }
      if(byWine[0]) add('good',`${TeamData.nick(byWine[0].wine)} leads the week${delta[byWine[0].wine.id]>0?`, up ${delta[byWine[0].wine.id]}%`:''}`);
      if(gap) add('note',`${TeamData.nick(gap.wine)} sold ${sold(gap)}; ${gap.knows} of ${gap.of} servers trained on it`);
      if(s&&s.delta.revenue!=null) add(s.delta.revenue>=0?'good':'bad',`Wine sales ${s.delta.revenue>=0?'up':'down'} ${Math.abs(s.delta.revenue)}% on last week`); }
    else if(section==='sales'&&s){ const d=s.delta.revenue, w=this.weeklyTrend(8), k=this.soldKnowing(7);
      out.pre='Wine sales are '; out.strong=d==null?m(s.revenue):`${d>=0?'up':'down'} ${Math.abs(d)}%`; out.post=' this week.';
      if(w.length>1&&w[0].revenue>0){ const p=Math.round(100*(w[w.length-1].revenue-w[0].revenue)/w[0].revenue); add(p>=0?'good':'bad',`${p>=0?'Up':'Down'} ${Math.abs(p)}% on eight weeks ago`); }
      if(k.share!=null) add(k.share>=0.6?'good':'note',`${Math.round(100*k.share)}% of wine takings came from servers trained on the wine they sold`);
      const fall=byWine.slice(0,10).filter(x=>delta[x.wine.id]!=null&&delta[x.wine.id]<0).sort((a,b)=>delta[a.wine.id]-delta[b.wine.id])[0];
      if(fall) add('bad',`${TeamData.nick(fall.wine)} sales down ${Math.abs(delta[fall.wine.id])}% on last week`); else if(gap) add('note',`${TeamData.nick(gap.wine)} sold ${sold(gap)}; ${gap.knows} of ${gap.of} servers trained on it`); }
    else if(section==='wines'){ const rows=this.coverage().rows.filter(x=>x.of>0), ok=rows.filter(x=>x.knows>=Math.ceil(x.of/2)), gaps=rows.filter(x=>x.knows<Math.ceil(x.of/2));
      out.pre='The floor can sell '; out.strong=`${ok.length} of ${rows.length}`; out.post=' wines.';
      if(s){ const by=Object.fromEntries(byWine.map(x=>[x.wine.id,x.revenue])), g=gaps.reduce((a,x)=>a+(by[x.wine.id]||0),0); if(g>0) add('note',`The ${gaps.length} it can't bring in ${m(g)} a week`); }
      const ad=this.adoption(); if(ad.length) add('note',`${ad.length} new arrival${ad.length===1?'':'s'}: ${TeamData.nick(ad[0].wine)}, ${ad[0].knows} of ${ad[0].of} trained on it`);
      const old=TeamData.wines().filter(w=>{ const x=TeamData.window(w); return x&&x.stage==='old'; }).length; if(old) add('bad',`${old} past ${old===1?'its':'their'} best`);
      const hole=this.coverage().holes[0]; if(hole) add('note',`${TeamData.nick(hole.wine)} by the glass: ${hole.knows} of ${hole.of} trained on it`); }
    else if(section==='menu'){ const ps=this.pairings().filter(x=>x.first), all=ps.filter(x=>x.of&&x.people.length>=Math.ceil(x.of/2)), withSold=ps.filter(x=>x.sold!=null);
      if(withSold.length){ const avg=withSold.reduce((a,x)=>a+x.sold,0)/withSold.length, frac=avg>=0.45?'One table in two':avg>=0.29?'One table in three':avg>=0.22?'One table in four':'One table in five';
        out.strong=frac; out.post=' orders the pairing.'; const best=[...withSold].sort((a,b)=>b.sold*b.perWeek-a.sold*a.perWeek)[0], worst=[...withSold].filter(x=>x.perWeek>=20).sort((a,b)=>a.sold-b.sold)[0];
        if(best) add('good',`${best.dish.name.split(',')[0]} with the ${TeamData.nick(best.first)}: ${Math.round(best.sold*best.perWeek)} this week`);
        if(worst&&worst!==best) add('bad',`${worst.dish.name.split(',')[0]} sells ${worst.perWeek} a week; ${worst.people.length} can offer its ${TeamData.nick(worst.first)}`); }
      else { out.pre='The floor can offer the wine for '; out.strong=`${all.length} of ${ps.length}`; out.post=' dishes.'; }
      add(all.length===ps.length?'good':'note',`The floor can offer ${all.length} of ${ps.length} pairings`); }
    return out; },
};
Object.assign(window,{TeamReport});
