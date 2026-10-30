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
    return {...c,total:ps.length,avg,overdue,due,retention:TeamLearn.retention(null),adoption:this.adoption(),coverage:this.coverage(),idle:ps.filter(x=>!x.lastDrill||Date.now()-x.lastDrill>7*this.DAY).length}; },
  byRole(){ const ps=this.people(), out={};
    ps.forEach(x=>{ const o=out[x.r.role]||(out[x.r.role]={role:x.r.role,label:TeamLearn.ROLES[x.r.role].label,n:0,sum:0,ready:0}); o.n++; o.sum+=x.r.pct; if(x.r.state==='ready') o.ready++; });
    return Object.values(out).map(o=>({...o,avg:Math.round(o.sum/o.n)})).sort((a,b)=>b.n-a.n); },
  /* Who is below their minimum and why: answers that have faded, new wines not yet learnt, nothing started. */
  slipping(){ const now=Date.now(), recent=new Set(this.adoption().map(a=>a.wine.id));
    return this.people().filter(x=>x.r.state!=='ready').map(x=>{ const as=TeamLearn.assignments(x.person.id), newW=as.filter(a=>a.kind==='wine'&&recent.has(a.id)).length, why=[];
      if(x.r.due) why.push(`${x.r.due} answer${x.r.due===1?'':'s'} faded`);
      if(newW) why.push(`${newW} new wine${newW===1?'':'s'} not learnt yet`);
      if(x.r.overdue) why.push(`${x.r.overdue} overdue`);
      if(!x.lastDrill) why.push('no drill yet'); else if(now-x.lastDrill>7*this.DAY) why.push(`last drill ${Math.round((now-x.lastDrill)/this.DAY)} days ago`);
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
  /* A person's ladder: every wine their role sells with the rungs done, and every dish. */
  ladder(pid){ const p=TeamLearn.person(pid); if(!p) return {wines:[],dishes:[]}; const sc=TeamLearn.scope(p.role);
    return {wines:[...sc.glass,...sc.bottle].map(w=>({wine:w,...TeamLearn.progress(pid,w.id)})),dishes:sc.dishes.map(x=>({dish:x,...TeamLearn.progress(pid,x.id,{dish:true})}))}; },

  /* ── Sales (TeamSales): what sold, who sold it, and what that says about what to learn first. ── */
  _money(x){ const m=/\d+(?:\.\d+)?/.exec(String(x||'')); return m?+m[0]:0; },
  _sum(rows){ return rows.reduce((a,r)=>({revenue:a.revenue+r.q*r.p,lines:a.lines+r.q,glasses:a.glasses+(r.s==='glass'?r.q:0),bottles:a.bottles+(r.s==='bottle'?r.q:0)}),{revenue:0,lines:0,glasses:0,bottles:0}); },
  _covers(nights){ return nights.reduce((a,n)=>a+(n.covers||0),0); },
  /* This period against the one before it. */
  salesSummary(days=7){ if(!TeamSales.has()) return null; const now=Date.now(), rows=TeamSales.rows(0), nights=TeamSales.nights(0);
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
    TeamLearn.people().forEach(p=>{ by[p.id]={person:p,shifts:nights.filter(n=>(n.shifts||[]).includes(p.id)).length,lines:0,bottles:0,revenue:0}; });
    rows.forEach(r=>{ if(!r.v||!by[r.v]) return; const x=by[r.v]; x.lines+=r.q; x.revenue+=r.q*r.p; if(r.s==='bottle') x.bottles+=r.q; });
    return Object.values(by).filter(x=>x.lines>0||x.shifts>0).map(x=>({...x,perShift:x.shifts?x.lines/x.shifts:null,bottlesPerShift:x.shifts?x.bottles/x.shifts:null,readiness:TeamLearn.readiness(x.person.id)})).sort((a,b)=>(b.perShift||0)-(a.perShift||0)); },
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
  /* Weekly wine revenue, oldest first, for the sparkline. */
  weeklyTrend(weeks=8){ const rows=TeamSales.rows(0), now=Date.now(), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY, rs=rows.filter(r=>r.t>=from&&r.t<to), s=this._sum(rs); out.push({from,to,...s}); }
    return out; },
  /* Each person's by-the-glass lines per shift, week by week: the shape of Marco's dip. */
  serverTrend(pid,weeks=8){ const rows=TeamSales.rows(0), nights=TeamSales.nights(0), now=Date.now(), out=[];
    for(let i=weeks-1;i>=0;i--){ const to=now-i*7*this.DAY, from=to-7*this.DAY; const sh=nights.filter(n=>{ const t=new Date(n.night).getTime(); return t>=from&&t<to&&(n.shifts||[]).includes(pid); }).length;
      const q=rows.filter(r=>r.v===pid&&r.t>=from&&r.t<to).reduce((a,r)=>a+r.q,0); out.push({from,to,shifts:sh,lines:q,perShift:sh?q/sh:null}); }
    return out; },
  newOnTill(){ return TeamSales.has()?TeamSales.unmapped():[]; },
};
Object.assign(window,{TeamReport});
