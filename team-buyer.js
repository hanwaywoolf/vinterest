/* The list as a buyer reads it (docs/business.md "The Wines page for the buyer"): its balance against what sells,
   its prices, how hard each wine works on the menu, what to sell through, what overlaps, and, with one call, what a
   shop would charge, the dishes the list could sell that the menu lacks and the wines the menu lacks. Everything
   but `review` is worked out from the list, the pairings and the POS with no call. Nothing here is about training:
   that is the Training page. */
const TeamBuyer = {
  KEY:'vbiz_buyer_v1',
  get(){ const d=Store.getJSON(this.KEY,null); return d&&typeof d==='object'?d:{}; },
  save(d){ Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  clear(){ Store.remove(this.KEY); },
  _m(x){ const r=/\d+(?:\.\d+)?/.exec(String(x||'').replace(/,/g,'')); return r?+r[0]:0; },
  wines(){ return TeamData.wines().filter(w=>!TeamData.isDrink(w)); },
  _sold(days=28){ return TeamSales.has()?Object.fromEntries(TeamReport.salesByWine(days).map(x=>[x.id,x])):null; },
  _colour(w){ const k=TeamLearn.kindOf(w); return {sparkling:'Sparkling',white:'White','rosé':'Rosé',rose:'Rosé',orange:'Orange',red:'Red',sweet:'Sweet',fortified:'Fortified'}[k]||(w.type?w.type.charAt(0).toUpperCase()+w.type.slice(1):'Other'); },
  DIMS:[['colour','Colour'],['country','Country'],['region','Region'],['grape','Grape']],
  _key(w,dim){ return dim==='colour'?this._colour(w):dim==='country'?(w.country||'Unknown'):dim==='region'?(w.region||w.country||'Unknown'):((w.grapes||[])[0]||'Blend'); },
  /* Share of the list against share of sales, by colour, country, region or lead grape. A group is `over` when it
     takes a good deal more of the list than of the sales (BAL_GAP), `under` the other way round. */
  BAL_GAP:0.1,
  balance(dim='colour'){ const ws=this.wines(), sold=this._sold(), tot=sold?ws.reduce((a,w)=>a+((sold[w.id]||{}).revenue||0),0):0, by={};
    ws.forEach(w=>{ const k=this._key(w,dim), g=by[k]||(by[k]={key:k,n:0,sales:0,wines:[]}); g.n++; g.wines.push(w); g.sales+=sold?((sold[w.id]||{}).revenue||0):0; });
    return Object.values(by).map(g=>{ const share=g.n/ws.length, salesShare=tot?g.sales/tot:null, d=salesShare==null?0:share-salesShare; return {...g,share,salesShare,flag:salesShare==null?null:d>this.BAL_GAP&&g.n>=3?'over':d<-this.BAL_GAP?'under':null}; }).sort((a,b)=>b.n-a.n); },
  /* The bottle prices of each colour in order, with the gaps a guest would notice (the next bottle up costs GAP_X
     times as much) and the pile-ups (three or more within a tenth of each other). */
  GAP_X:1.45,
  ladder(){ const by={}; this.wines().forEach(w=>{ const p=this._m(w.bottle); if(!p) return; (by[this._colour(w)]||(by[this._colour(w)]=[])).push({w,p}); });
    return Object.entries(by).map(([colour,xs])=>{ xs.sort((a,b)=>a.p-b.p); const gaps=[], piles=[];
      for(let i=1;i<xs.length;i++) if(xs[i].p>=xs[i-1].p*this.GAP_X&&xs[i].p-xs[i-1].p>=10) gaps.push({from:xs[i-1],to:xs[i]});
      for(let i=0;i<xs.length;i++){ const run=xs.filter(y=>y.p>=xs[i].p&&y.p<=xs[i].p*1.1); if(run.length>=3&&!piles.some(p=>p.some(y=>run.includes(y)))) piles.push(run); }
      return {colour,wines:xs,min:xs[0].p,max:xs[xs.length-1].p,gaps,piles}; }).filter(l=>l.wines.length>1).sort((a,b)=>b.wines.length-a.wines.length); },
  /* A glass priced out of line with its own bottle: most lists keep one ratio, so one far from it is a slip. */
  glassOdd(){ const xs=this.wines().filter(w=>this._m(w.glass)&&this._m(w.bottle)).map(w=>({w,r:this._m(w.bottle)/this._m(w.glass)})); if(xs.length<4) return [];
    const s=xs.map(x=>x.r).sort((a,b)=>a-b), med=s[Math.floor(s.length/2)]; return xs.filter(x=>Math.abs(x.r-med)/med>0.2).map(x=>({...x,med,dear:x.r<med})).sort((a,b)=>Math.abs(b.r-b.med)-Math.abs(a.r-a.med)); },
  /* How hard each wine works on the menu: the dishes it's suggested with. `orphans` are suggested with nothing;
     `heavy` carry a fifth of the menu or more. */
  workload(){ const n={}, ds=TeamData.dishes(); ds.forEach(x=>{ const p=TeamData.pairing(x.id)||{}; [...new Set([...(p.best||[]).map(b=>b.id),p.glass&&p.glass.id].filter(Boolean))].forEach(id=>{ (n[id]||(n[id]=[])).push(x); }); });
    const rows=this.wines().map(w=>({wine:w,dishes:n[w.id]||[]})), lim=Math.max(5,Math.ceil(ds.length/5)); return {rows,by:Object.fromEntries(rows.map(r=>[r.wine.id,r.dishes])),orphans:rows.filter(r=>!r.dishes.length),heavy:rows.filter(r=>r.dishes.length>=lim).sort((a,b)=>b.dishes.length-a.dishes.length)}; },
  /* Dishes the list serves thinly: fewer than two wines suggested, nothing by the glass, or nothing by the bottle alone. */
  thinDishes(){ return TeamData.dishes().map(x=>{ const p=TeamData.pairing(x.id)||{}, picks=(p.best||[]).map(b=>TeamData.wine(b.id)).filter(Boolean), why=[];
      if(picks.length<2) why.push(picks.length?'only one wine suggested':'no wine suggested'); if(!p.glass&&!picks.some(TeamData.byGlass)) why.push('nothing by the glass'); if(picks.length&&!picks.some(w=>!TeamData.byGlass(w))) why.push('no bottle to step up to');
      return why.length?{dish:x,why}:null; }).filter(Boolean); },
  /* The glass list: bottles selling well enough to pour (GLASS_FROM a week or more, under the dearest glass wine's
     bottle price), and glasses that barely move. */
  GLASS_FROM:1.5,
  glassProgramme(){ const sold=this._sold(); if(!sold) return {add:[],slow:[]}; const cap=Math.max(0,...this.wines().filter(TeamData.byGlass).map(w=>this._m(w.bottle)));
    const add=this.wines().filter(w=>!TeamData.byGlass(w)&&sold[w.id]&&sold[w.id].bottles/4>=this.GLASS_FROM&&this._m(w.bottle)<=cap*1.15).map(w=>({wine:w,perWeek:sold[w.id].bottles/4})).sort((a,b)=>b.perWeek-a.perWeek);
    const g=TeamReport.slowMovers(28,Infinity), mid=g.length?g[Math.floor(g.length/2)].perNight:0; return {add,slow:g.filter(x=>x.perNight<mid*0.5)}; },
  concentration(n=5){ const sold=this._sold(); if(!sold) return null; const ws=this.wines(), rev=ws.map(w=>({wine:w,rev:(sold[w.id]||{}).revenue||0})).sort((a,b)=>b.rev-a.rev), tot=rev.reduce((a,x)=>a+x.rev,0);
    return {total:tot,top:rev.slice(0,n),share:tot?rev.slice(0,n).reduce((a,x)=>a+x.rev,0)/tot:0,dead:rev.filter(x=>!x.rev).map(x=>x.wine)}; },
  windows(){ const yr=new Date().getFullYear(), out={past:[],soon:[],peak:[],young:[]}; this.wines().forEach(w=>{ const x=TeamData.window(w); if(!x) return; if(x.stage==='old') out.past.push(w); else if(x.stage==='young') out.young.push(w); else if(x.until<=yr+1) out.soon.push(w); else out.peak.push(w); }); return out; },
  /* Wines that compete with each other: the same lead grape, colour and country within a fifth on the bottle. */
  overlap(){ const ws=this.wines().filter(w=>(w.grapes||[])[0]&&this._m(w.bottle)), seen=new Set(), out=[];
    ws.forEach(a=>{ if(seen.has(a.id)) return; const grp=ws.filter(b=>b.grapes[0]===a.grapes[0]&&this._colour(b)===this._colour(a)&&(b.country||'')===(a.country||'')&&Math.abs(this._m(b.bottle)-this._m(a.bottle))/this._m(a.bottle)<=0.2);
      if(grp.length>1){ grp.forEach(w=>seen.add(w.id)); out.push({grape:a.grapes[0],country:a.country,wines:grp}); } }); return out; },
  /* What a shop would charge for the bottle: Vinny's estimate from the review, else (a demo restaurant only) an
     invented figure so the column isn't empty, said to be demo data. {price, source:'estimate'|'demo'} or null. */
  retail(w){ const r=(this.get().retail||{})[w.id]; if(r>0) return {price:r,source:'estimate'}; const b=this._m(w.bottle); if(!b||!TeamData.isDemo()) return null; let h=0; for(const ch of w.id) h=(h*33+ch.charCodeAt(0))%1009; return {price:Math.round(b/(2.1+(h%19)/10)),source:'demo'}; },
  markup(w){ const r=this.retail(w), b=this._m(w.bottle); return r&&b?{x:b/r.price,retail:r.price,source:r.source}:null; },
  MARK_HIGH:3.6, MARK_LOW:2,
  markups(){ const xs=this.wines().map(w=>({wine:w,...(this.markup(w)||{})})).filter(x=>x.x); if(!xs.length) return null; const s=xs.map(x=>x.x).sort((a,b)=>a-b);
    return {n:xs.length,median:s[Math.floor(s.length/2)],high:xs.filter(x=>x.x>=this.MARK_HIGH).sort((a,b)=>b.x-a.x),low:xs.filter(x=>x.x<=this.MARK_LOW).sort((a,b)=>a.x-b.x),source:xs.some(x=>x.source==='estimate')?'estimate':'demo'}; },
  /* Needs you on the list, as the buyer reads it: what's so, then what to do. */
  actions(){ const out=[], m=n=>TeamData.money(Math.round(n)), nick=w=>TeamData.nick(w), list=ws=>ws.slice(0,3).map(nick).join(', ')+(ws.length>3?` and ${ws.length-3} more`:''), c=this.concentration(), win=this.windows(), wl=this.workload(), gp=this.glassProgramme(), mk=this.markups(), ov=this.overlap();
    if(win.past.length) out.push({tag:'Window',tone:'bad',fact:`${win.past.length} wine${win.past.length===1?' is':'s are'} past ${win.past.length===1?'its':'their'} best: ${list(win.past)}.`,act:'Pour by the glass this week to sell through, or take off the list.',open:{view:'wine',id:win.past[0].id}});
    if(c&&c.dead.length) out.push({tag:'Unsold',tone:'bad',fact:`${c.dead.length} wine${c.dead.length===1?' hasn\'t':'s haven\'t'} sold in four weeks: ${list(c.dead)}.`,act:`Feature the ${nick(c.dead[0])} tonight, or replace it at the next order.`,open:{view:'plan',kind:'slow',id:c.dead[0].id}});
    if(gp.add[0]) out.push({tag:'Glass',tone:'good',fact:`${TeamData.short(gp.add[0].wine)} sells ${gp.add[0].perWeek.toFixed(1)} bottles a week at ${gp.add[0].wine.bottle} without being poured by the glass.`,act:'Try it by the glass for a fortnight: it already has takers.',open:{view:'wine',id:gp.add[0].wine.id}});
    if(mk&&mk.high[0]) out.push({tag:'Price',tone:'note',fact:`${TeamData.short(mk.high[0].wine)} is on at ${mk.high[0].wine.bottle}, about ${mk.high[0].x.toFixed(1)} times its ${m(mk.high[0].retail)} in a shop; your list's usual is ${mk.median.toFixed(1)} times.`,act:'A guest who has seen it in a shop will notice. Bring it nearer your usual, or make sure it sells on its story.',open:{view:'wine',id:mk.high[0].wine.id}});
    if(mk&&mk.low[0]) out.push({tag:'Price',tone:'good',fact:`${TeamData.short(mk.low[0].wine)} is ${mk.low[0].x.toFixed(1)} times its shop price at ${mk.low[0].wine.bottle}: the best value on your list.`,act:'Tell the team: it\'s the bottle to offer a guest who knows wine. Or there\'s room in its price.',open:{view:'wine',id:mk.low[0].wine.id}});
    if(wl.orphans.length) out.push({tag:'Menu',tone:'note',fact:`${wl.orphans.length} wine${wl.orphans.length===1?' is':'s are'} suggested with no dish: ${list(wl.orphans.map(r=>r.wine))}.`,act:'Nobody has a reason to offer one. Ask Vinny below for a dish that would sell it, or give it a pairing on the Menu page.',open:{view:'wine',id:wl.orphans[0].wine.id}});
    if(wl.heavy[0]) out.push({tag:'Menu',tone:'note',fact:`${TeamData.short(wl.heavy[0].wine)} is suggested with ${wl.heavy[0].dishes.length} dishes, more than any other wine.`,act:'If it runs out, a lot of the menu loses its pairing: keep it in depth, or spread the pairings on the Menu page.',open:{view:'wine',id:wl.heavy[0].wine.id}});
    if(ov[0]) out.push({tag:'Overlap',tone:'note',fact:`${ov[0].wines.map(nick).join(' and ')} are both ${ov[0].grape}${ov[0].country?` from ${ov[0].country}`:''} within a few pounds of each other.`.replace('a few pounds',TeamData.currency().code==='GBP'?'a few pounds':'a few dollars'),act:'They compete for the same guest. Keep the one that sells and use the place for something the list lacks.',open:{view:'wine',id:ov[0].wines[0].id}});
    return out; },
  _lines(){ const sold=this._sold()||{}, wl=this.workload().by;
    return this.wines().map(w=>`${w.id} | ${TeamData.label(w)} | ${w.type} | ${(w.grapes||[]).join(', ')||'?'} | ${[w.region,w.country].filter(Boolean).join(', ')} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')} | ${sold[w.id]?`${sold[w.id].glasses} glasses, ${sold[w.id].bottles} bottles`:'none'} | ${(wl[w.id]||[]).map(x=>x.name.split(',')[0]).join('; ')||'no dish'}`).join('\n'); },
  _menuLines(){ return TeamData.dishes().map(x=>{ const p=TeamData.pairing(x.id)||{}; return `${x.id} | ${x.name}${x.price?' '+x.price:''} | ${(p.best||[]).map(b=>TeamData.wine(b.id)).filter(Boolean).map(w=>TeamData.short(w)).join('; ')||'none'}`; }).join('\n'); },
  /* Vinny reads the list as a buyer: one call (purpose team_buyer, prompts/team-buyer.txt). Kept until asked again. */
  async review(){ const v=TeamData.get().venue||{}, cur=TeamData.currency(), tpl=_loadTextSync('prompts/team-buyer.txt');
    const prompt=tpl.replace(/\{\{venue\}\}/g,v.name||'the restaurant').replace('{{about}}',TeamData.about()).replace('{{market}}',cur.code==='GBP'?'the UK':cur.code==='CAD'?'Canada':cur.code==='USD'?'the US':'this market').replace('{{currency}}',cur.code||'local currency').replace('{{list}}',this._lines()).replace('{{menu}}',this._menuLines());
    const j=TeamData._json(await window.claude.complete({purpose:'team_buyer',messages:[{role:'user',content:prompt}]})); if(!j||typeof j!=='object') throw new Error('Vinny couldn\'t read the list just now. Try again in a minute.');
    const W=id=>TeamData.wine(String(id||'')), D=id=>TeamData.dish(String(id||'')), s=x=>String(x||'').trim(), names=new Set(TeamData.dishes().map(x=>TeamLearn._norm(x.name.split(',')[0])));
    const d={at:Date.now(),retail:Object.fromEntries((j.retail||[]).filter(r=>W(r.id)&&+r.price>0).map(r=>[r.id,Math.round(+r.price)])),
      missing:(j.missing_dishes||[]).filter(x=>W(x.wine)&&s(x.dish)&&!names.has(TeamLearn._norm(x.dish))).slice(0,4).map(x=>({wine:x.wine,dish:s(x.dish),why:s(x.why)})),
      weak:(j.weak_dishes||[]).filter(x=>D(x.dish)).slice(0,4).map(x=>({dish:x.dish,why:s(x.why),wants:s(x.wants)})),
      gaps:(j.gaps||[]).filter(x=>s(x.what)).slice(0,4).map(x=>({what:s(x.what),why:s(x.why)})),
      cut:(j.cut||[]).filter(x=>W(x.wine)).slice(0,3).map(x=>({wine:x.wine,why:s(x.why)}))};
    this.save(d); return d; },
  reviewed(){ const d=this.get(); return d.at?d:null; },
};
Object.assign(window,{TeamBuyer});
