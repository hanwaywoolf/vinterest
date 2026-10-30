/* TeamLearn: how a restaurant's staff learn its list and menu, and whether each of them is ready
   to work the floor (docs/business.md). Built for retention, not points:

   - A ladder per wine: recognise (four options, first exposure only), recall (typed), apply (a guest
     at a table, answered in their own words and marked against the list and menu) and contrast
     (telling it from the most similar wine on the list). Each rung opens once the one below has been
     answered right, and a role needs the rungs it sells with (ROLES).
   - Every question has its own review date, from how this person has answered it: a stability in
     days that grows with each right answer (more when it was answered late and still right), shrinks
     on a miss, and is capped at MAX_DAYS. Before answering they say how sure they are; a confident
     wrong answer comes back within hours, since that's the mistake that reaches a guest.
   - Readiness is the share of the live list and menu they know now (every question their role needs
     for it answered right and not yet due), against their role's minimum. Below it after having
     been above is Slipping, not Not ready.
   - A wine or dish added at publish (TeamData.publish) is assigned to every role that sells it, due
     in the venue's dueDays. CHECK_SHARE of drill questions re-ask something they already know without
     warning, to measure retention honestly (retention()).
   The pilot keeps people and progress on this device (Store, vbiz_*). */
const TeamLearn = {
  KEY:'vbiz_team_v1', PROGRESS:'vbiz_learn_v1',
  DAY:86400000, MAX_DAYS:60, RETAIN:0.9, DRILL_SIZE:5, CHECK_SHARE:0.1, PASS:0.67,
  LADDER:['recognise','recall','apply','contrast'],
  ROLES:{
    server:{label:'Server',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8}},
    bartender:{label:'Bartender',kinds:['recognise','recall','apply'],need:{glass:0.9,bottle:0,dishes:0.5}},
    sommelier:{label:'Sommelier',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9}},
    buyer:{label:'Buyer',kinds:['recognise','recall','apply','contrast'],need:{glass:0.9,bottle:0.9,dishes:0.9}},
    manager:{label:'Manager',kinds:['recognise','recall','apply'],need:{glass:0.8,bottle:0.6,dishes:0.8}},
  },
  PART_LABEL:{glass:'By the glass',bottle:'Bottles',dishes:'Menu pairings'},

  team(){ const t=Store.getJSON(this.KEY,null); return t&&t.people?t:{people:{},me:null,targets:{}}; },
  _saveTeam(t){ Store.setJSON(this.KEY,t); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  people(){ return Object.values(this.team().people).sort((a,b)=>a.created-b.created); },
  person(id){ return this.team().people[id]||null; },
  me(){ const t=this.team(); return t.people[t.me]||null; },
  addPerson(name,role){ const t=this.team(), id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
    t.people[id]={id,name:String(name).trim(),role,created:Date.now()}; if(!t.me) t.me=id; this._saveTeam(t);
    this.assignExisting(id); return id; },
  removePerson(id){ const t=this.team(); delete t.people[id]; if(t.me===id) t.me=Object.keys(t.people)[0]||null; this._saveTeam(t); const p=this._all(); delete p[id]; this._saveAll(p); },
  setMe(id){ const t=this.team(); t.me=id; this._saveTeam(t); },
  need(role){ const t=this.team(); return {...this.ROLES[role].need,...((t.targets||{})[role]||{})}; },
  setNeed(role,part,v){ const t=this.team(); t.targets=t.targets||{}; t.targets[role]={...(t.targets[role]||{}),[part]:v}; this._saveTeam(t); },

  _all(){ return Store.getJSON(this.PROGRESS,{})||{}; },
  _saveAll(p){ Store.setJSON(this.PROGRESS,p); },
  _mine(p,pid){ p[pid]=p[pid]||{items:{},checks:[],assigned:{}}; return p[pid]; },

  /* Every question for a wine (its card's) and for a dish (written here from its pairing: no call). */
  // Four options are shown in an order fixed per question, so the right one isn't always where it was written.
  wineQs(id){ const c=TeamData.card(id); return (c&&c.qs||[]).map(q=>{ const x={...q,wine:id}; if(q.k!=='recognise') return x;
    const order=this._shuffle(q.opts.map((_,i)=>i),q.id); return {...x,opts:order.map(i=>q.opts[i]),a:order.indexOf(q.a)}; }); },
  dishQs(id){
    const x=TeamData.dish(id), p=TeamData.pairing(id); if(!x||!p||!p.best||!p.best.length) return [];
    const best=TeamData.wine(p.best[0].id); if(!best) return [];
    const others=TeamData.wines().filter(w=>!p.best.some(b=>b.id===w.id));
    const pick=[...(p.avoid&&TeamData.wine(p.avoid.id)?[TeamData.wine(p.avoid.id)]:[]),...others.filter(w=>w.type===best.type),...others]
      .filter((w,i,a)=>a.indexOf(w)===i).slice(0,3);
    if(pick.length<3) return [];
    const opts=[best,...pick].map(w=>TeamData.short(w)), order=this._shuffle([0,1,2,3],id);
    return [
      {id:'d:'+id+'#0',dish:id,k:'recognise',q:`A guest orders the ${x.name}. Which wine on our list suits it best?`,opts:order.map(i=>opts[i]),a:order.indexOf(0),why:p.best[0].why},
      {id:'d:'+id+'#1',dish:id,k:'recall',q:`Name a wine from our list for a guest having the ${x.name}.`,ans:TeamData.short(best),acc:p.best.map(b=>TeamData.wine(b.id)).filter(Boolean).flatMap(w=>[TeamData.short(w),w.name]),why:p.best.map(b=>{ const w=TeamData.wine(b.id); return w?`${TeamData.short(w)}: ${b.why}`:''; }).filter(Boolean).join(' ')},
    ];
  },
  // The same order every time for a question, so a re-draw doesn't reshuffle what they've seen.
  _shuffle(arr,seed){ let h=0; for(const c of String(seed)) h=(h*31+c.charCodeAt(0))|0; const a=[...arr];
    for(let i=a.length-1;i>0;i--){ h=(h*1103515245+12345)|0; const j=Math.abs(h)%(i+1); [a[i],a[j]]=[a[j],a[i]]; } return a; },
  allQs(){ return [...TeamData.wines().flatMap(w=>this.wineQs(w.id)),...TeamData.dishes().flatMap(x=>this.dishQs(x.id))]; },

  /* How likely they are to remember a question now: 1 just after a right answer, RETAIN at its due date. */
  recall(it,now=Date.now()){ if(!it||!it.reps||!it.s) return 0; const days=(now-it.last)/this.DAY; return Math.exp(Math.log(this.RETAIN)*days/it.s); },
  known(it,now=Date.now()){ return !!(it&&it.reps&&!it.wrong&&now<it.due); },

  /* Which wines and dishes a role sells: a bartender the by-the-glass list, everyone else all of it. */
  scope(role){
    const need=this.need(role), ws=TeamData.wines();
    return {glass:need.glass>0?ws.filter(w=>TeamData.byGlass(w)):[],bottle:need.bottle>0?ws.filter(w=>!TeamData.byGlass(w)):[],dishes:need.dishes>0?TeamData.dishes():[]};
  },
  // A rung opens once every question on the rung below has been answered right at least once.
  _open(qs,items,kind,kinds){
    const idx=this.LADDER.indexOf(kind); if(!kinds.includes(kind)) return false;
    for(let r=0;r<idx;r++){ const k=this.LADDER[r]; if(!kinds.includes(k)) continue; const below=qs.filter(q=>q.k===k); if(below.some(q=>!(items[q.id]&&items[q.id].reps))) return false; }
    return true;
  },
  knowsWine(pid,role,id,items){ const kinds=this.ROLES[role].kinds, qs=this.wineQs(id).filter(q=>kinds.includes(q.k)); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },
  knowsDish(pid,id,items){ const qs=this.dishQs(id); return qs.length>0&&qs.every(q=>this.known(items[q.id])); },

  /* {pct, parts:{glass:{known,total,need,share}}, state:'ready'|'slipping'|'not', overdue, due} */
  readiness(pid){
    const person=this.person(pid); if(!person) return null;
    const role=person.role, need=this.need(role), sc=this.scope(role), mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const parts={};
    ['glass','bottle','dishes'].forEach(k=>{
      if(!need[k]) return;
      const list=sc[k], known=list.filter(x=>k==='dishes'?this.knowsDish(pid,x.id,items):this.knowsWine(pid,role,x.id,items)).length;
      parts[k]={known,total:list.length,need:need[k],share:list.length?known/list.length:1};
    });
    const ks=Object.keys(parts), met=ks.every(k=>parts[k].share>=parts[k].need-1e-9);
    const pct=ks.length?Math.round(100*ks.reduce((a,k)=>a+Math.min(1,parts[k].share/parts[k].need),0)/ks.length):0;
    const overdue=Object.values(mine.assigned||{}).filter(a=>!a.done&&a.due<now).length;
    const due=Object.values(items).filter(it=>it.reps&&it.due<=now).length;
    return {pct,parts,state:met?'ready':mine.wasReady?'slipping':'not',overdue,due,role};
  },
  /* Remembers that they've been ready, so dropping below the minimum later reads as Slipping. */
  note(pid){ const r=this.readiness(pid); if(!r) return r; const p=this._all(), m=this._mine(p,pid);
    if(r.state==='ready'&&!m.wasReady){ m.wasReady=Date.now(); this._saveAll(p); } return this.readiness(pid); },

  /* Today's drill for a person: assigned new wines and dishes first, then what's due (least
     remembered first), then the next new questions in list order (by the glass first), and now and
     then an unannounced re-ask of something they know (a retention check). */
  drill(pid,size=this.DRILL_SIZE){
    const person=this.person(pid); if(!person) return [];
    const role=person.role, kinds=this.ROLES[role].kinds, mine=this._mine(this._all(),pid), items=mine.items, now=Date.now();
    const sc=this.scope(role), wines=[...sc.glass,...sc.bottle], dishes=sc.dishes;
    const qsFor=w=>this.wineQs(w.id), out=[], has=id=>out.some(q=>q.id===id);
    const nextFor=(qs)=>{ // the lowest open rung's first question not yet answered right
      for(const k of this.LADDER){ if(!this._open(qs,items,k,kinds)) continue; const q=qs.find(q=>q.k===k&&!(items[q.id]&&items[q.id].reps)); if(q) return q; }
      return null;
    };
    const assigned=Object.entries(mine.assigned||{}).filter(([,a])=>!a.done).sort((a,b)=>a[1].due-b[1].due);
    assigned.forEach(([key])=>{ if(out.length>=size) return; const [t,id]=[key.slice(0,1),key.slice(2)];
      const q=nextFor(t==='w'?qsFor({id}).filter(q=>kinds.includes(q.k)):this.dishQs(id)); if(q&&!has(q.id)) out.push(q); });
    const pool=[...wines.flatMap(qsFor),...dishes.flatMap(x=>this.dishQs(x.id))].filter(q=>kinds.includes(q.k)||q.dish);
    const byId=Object.fromEntries(pool.map(q=>[q.id,q]));
    Object.entries(items).filter(([id,it])=>byId[id]&&it.reps&&(it.wrong||it.due<=now)).sort((a,b)=>this.recall(a[1],now)-this.recall(b[1],now))
      .forEach(([id])=>{ if(out.length<size&&!has(id)) out.push(byId[id]); });
    if(out.length<size){
      const knownIds=Object.entries(items).filter(([id,it])=>byId[id]&&this.known(it,now)).map(([id])=>id);
      if(knownIds.length&&Math.random()<this.CHECK_SHARE*size){ const id=knownIds[Math.floor(Math.random()*knownIds.length)]; if(!has(id)) out.push({...byId[id],check:true}); }
    }
    for(const w of [...wines.map(w=>({qs:qsFor(w).filter(q=>kinds.includes(q.k))})),...dishes.map(x=>({qs:this.dishQs(x.id)}))]){
      if(out.length>=size) break; const q=nextFor(w.qs); if(q&&!has(q.id)) out.push(q);
    }
    return out.slice(0,size);
  },

  /* Marks a typed answer: locally when it plainly matches the answer or a wording that counts,
     else by Claude against the key (prompts/team-grade.txt). {ok, score, verdict, say, missing}. */
  _norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim(); },
  _lev(a,b){ const m=a.length,n=b.length, d=Array.from({length:m+1},(_,i)=>[i]); for(let j=1;j<=n;j++) d[0][j]=j;
    for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; },
  localMatch(q,answer){
    const a=this._norm(answer); if(!a) return false;
    return [q.ans,...(q.acc||[])].filter(Boolean).map(x=>this._norm(x)).some(k=>k===a||(k.length>3&&(a.includes(k)||(a.length>3&&k.includes(a)&&a.length>=k.length*0.6)))||(k.length>4&&this._lev(k,a)<=Math.floor(k.length/6)+1));
  },
  async grade(q,answer){
    if(q.k==='recognise') return answer===q.a?{ok:true,score:1,verdict:'right'}:{ok:false,score:0,verdict:'wrong'};
    if(!String(answer||'').trim()) return {ok:false,score:0,verdict:'wrong'};
    if(q.k!=='apply'&&this.localMatch(q,answer)) return {ok:true,score:1,verdict:'right'};
    const key=q.k==='apply'?q.key:[q.ans,...(q.acc||[]).map(x=>`(also right: ${x})`)];
    try{
      const tpl=_loadTextSync('prompts/team-grade.txt');
      const text=await window.claude.complete({purpose:'team_grade',messages:[{role:'user',content:tpl.replace('{{q}}',q.q).replace('{{key}}',key.join('; ')).replace('{{answer}}',String(answer).slice(0,600))}]});
      const j=TeamData._json(text)||{}; const score=Math.max(0,Math.min(1,Number(j.score)||0));
      return {ok:score>=this.PASS,score,verdict:j.verdict||(score>=this.PASS?'right':score>0.3?'partly':'wrong'),say:j.say||'',missing:j.missing||''};
    }catch(e){ return {ok:false,score:0,verdict:'unmarked',say:'We couldn\'t mark that just now, so it will come back.',offline:true}; }
  },

  /* Records an answer and moves the question's review date. sure: 'sure' | 'think' | 'guess'. */
  record(pid,q,ok,sure='think',now=Date.now()){
    const p=this._all(), m=this._mine(p,pid), it=m.items[q.id]||{s:0,d:5,reps:0,lapses:0,last:0,due:0};
    const R=this.recall(it,now);
    if(q.check) m.checks.push({at:now,ok:!!ok,id:q.id});
    if(!ok){
      it.lapses++; it.d=Math.min(10,it.d+1.5); it.wrong=true;
      // Confidently wrong comes back within hours; a known answer forgotten keeps a little of its stability.
      it.s=sure==='sure'?0.1:it.reps?Math.max(0.25,it.s*0.25):0.25;
    } else {
      it.wrong=false;
      if(!it.reps) it.s=sure==='guess'?0.5:sure==='sure'?2:1;
      else if(sure==='guess') it.s=it.s*1.2;
      else it.s=it.s*(2+(5-it.d)*0.15)*(1+Math.max(0,this.RETAIN-R)); // later and still right earns more
      it.d=Math.max(1,it.d-(sure==='sure'?0.4:0.2)); it.reps++;
    }
    it.s=Math.min(this.MAX_DAYS,it.s); it.last=now; it.due=now+it.s*this.DAY;
    m.items[q.id]=it;
    // An assignment is done once the wine or dish is known at the level their role needs.
    const key=q.wine?'w:'+q.wine:q.dish?'d:'+q.dish:null, person=this.person(pid);
    if(key&&m.assigned[key]&&!m.assigned[key].done&&person){
      const done=q.wine?this.knowsWine(pid,person.role,q.wine,m.items):this.knowsDish(pid,q.dish,m.items);
      if(done) m.assigned[key].done=now;
    }
    this._saveAll(p);
    return it;
  },

  /* After a publish: new wines and dishes become assignments for everyone whose role sells them;
     ones taken off drop out. */
  assign(res){
    if(!res) return; const due=Date.now()+(TeamData.get().settings.dueDays||7)*this.DAY, p=this._all();
    this.people().forEach(person=>{
      const m=this._mine(p,person.id), sc=this.scope(person.role);
      const ids=res.kind==='list'?[...sc.glass,...sc.bottle].map(w=>w.id):sc.dishes.map(x=>x.id);
      (res.added||[]).filter(id=>ids.includes(id)).forEach(id=>{ const k=(res.kind==='list'?'w:':'d:')+id; if(!m.assigned[k]) m.assigned[k]={at:Date.now(),due}; });
      (res.removed||[]).forEach(id=>{ delete m.assigned[(res.kind==='list'?'w:':'d:')+id]; });
    });
    this._saveAll(p);
  },
  // Someone new starts with the whole list and menu as their first assignments.
  assignExisting(pid){ const person=this.person(pid); if(!person) return; const due=Date.now()+(TeamData.get().settings.dueDays||7)*this.DAY, p=this._all(), m=this._mine(p,pid), sc=this.scope(person.role);
    [...sc.glass,...sc.bottle].forEach(w=>{ m.assigned['w:'+w.id]=m.assigned['w:'+w.id]||{at:Date.now(),due}; });
    sc.dishes.forEach(x=>{ m.assigned['d:'+x.id]=m.assigned['d:'+x.id]||{at:Date.now(),due}; });
    this._saveAll(p); },
  assignments(pid){ const m=this._mine(this._all(),pid), now=Date.now();
    return Object.entries(m.assigned||{}).filter(([,a])=>!a.done).map(([k,a])=>({key:k,kind:k[0]==='w'?'wine':'dish',id:k.slice(2),due:a.due,overdue:a.due<now})).sort((a,b)=>a.due-b.due); },

  /* Retention from the unannounced checks over the last `days`: {asked, right, rate}. */
  retention(pid,days=30){ const since=Date.now()-days*this.DAY, all=this._all();
    const cs=(pid?[this._mine(all,pid)]:this.people().map(x=>this._mine(all,x.id))).flatMap(m=>m.checks||[]).filter(c=>c.at>=since);
    return {asked:cs.length,right:cs.filter(c=>c.ok).length,rate:cs.length?cs.filter(c=>c.ok).length/cs.length:null}; },
  /* For the manager: each wine with how many of the staff who sell it know it, weakest first. */
  weakWines(){ const all=this._all(), ppl=this.people();
    return TeamData.wines().map(w=>{ const sellers=ppl.filter(x=>{ const sc=this.scope(x.role); return [...sc.glass,...sc.bottle].some(y=>y.id===w.id); });
      const knows=sellers.filter(x=>this.knowsWine(x.id,x.role,w.id,this._mine(all,x.id).items)).length;
      return {wine:w,knows,of:sellers.length,share:sellers.length?knows/sellers.length:1}; }).sort((a,b)=>a.share-b.share); },
  resetProgress(){ Store.remove(this.PROGRESS); },
};
Object.assign(window,{TeamLearn});
