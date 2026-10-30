/* TeamSales: what the till says the restaurant sold, for the management console (docs/business.md,
   "POS and stock integration"). One rule above everything here: sales never move anyone's
   readiness. They change what the team is asked to learn first and what the manager is shown.

   Rows are wine lines sold: {i: id from the till (idempotent), t: ms, n: the till's item name,
   w: our wine id or null, s: 'glass'|'bottle', q: quantity, p: unit price, v: who sold it (a person
   id) or null}. Nights hold the covers and who worked, when the source knows them. The item map
   (till item name -> our wine id, '' for "not a wine") is made once per venue and confirmed by the
   manager; an item that appears with no match is the "new on the list?" signal.

   Sources: a CSV any till can export (importCSV), the demo's invented sales (seedDemo, labelled
   "Demo data" wherever they show), and later Square's Orders API through the Worker. The pilot keeps
   it on this device (Store, vbiz_sales_v1), capped to KEEP_DAYS. */
const TeamSales = {
  KEY:'vbiz_sales_v1', KEEP_DAYS:90, DAY:86400000,
  _empty(){ return {v:1,source:null,rows:[],nights:{},map:{}}; },
  get(){ const raw=Store.get(this.KEY); if(raw!==null&&raw===this._raw) return this._val;
    const d=raw?Store.getJSON(this.KEY,null):null, v=d&&Array.isArray(d.rows)?d:this._empty(); this._raw=raw; this._val=v; return v; },
  save(d){ Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  clear(){ Store.remove(this.KEY); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  has(){ return this.get().rows.length>0; },
  source(){ return this.get().source; },
  demo(){ const s=this.source(); return !!(s&&s.kind==='demo'); },
  night(ms){ const d=new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; },
  /* Rows in the last `days` (all when 0), mapped to wines through the item map as it stands now. */
  rows(days=0){ const d=this.get(), since=days?Date.now()-days*this.DAY:0, map=d.map||{};
    return d.rows.filter(r=>r.t>=since).map(r=>({...r,w:r.w||(map[r.n]||null)})); },
  nights(days=0){ const d=this.get(), since=days?this.night(Date.now()-days*this.DAY):''; return Object.entries(d.nights||{}).filter(([k])=>k>=since).map(([k,n])=>({night:k,...n})); },
  /* Adds rows, never twice (the till's own line id), drops anything older than KEEP_DAYS, and
     notes the source. Unknown item names get a proposed match (suggest) but no mapping until the
     manager confirms it: a wrong match would send sales to the wrong wine. */
  ingest(rows,{source,nights}={}){
    const d=this.get(), seen=new Set(d.rows.map(r=>r.i)), cut=Date.now()-this.KEEP_DAYS*this.DAY; let added=0;
    rows.forEach(r=>{ if(!r||!r.i||seen.has(r.i)||!(r.t>0)||r.t<cut) return; seen.add(r.i); d.rows.push({i:String(r.i),t:+r.t,n:String(r.n||'').trim(),w:r.w||null,s:r.s==='bottle'?'bottle':'glass',q:+r.q||1,p:+r.p||0,v:r.v||null}); added++; });
    d.rows=d.rows.filter(r=>r.t>=cut).sort((a,b)=>a.t-b.t);
    if(nights) Object.assign(d.nights,nights);
    Object.keys(d.nights).forEach(k=>{ if(new Date(k).getTime()<cut) delete d.nights[k]; });
    d.source={...(source||d.source||{kind:'csv'}),at:Date.now(),rows:d.rows.length};
    this.save(d); return added;
  },
  /* The item map. items(): every till item name with its rows, mapping and a suggestion, unmapped first. */
  map(){ return this.get().map||{}; },
  setMap(item,wineId){ const d=this.get(); d.map=d.map||{}; d.map[item]=wineId||''; d.rows.forEach(r=>{ if(r.n===item) r.w=wineId||null; }); this.save(d); },
  items(){ const d=this.get(), map=d.map||{}, by={};
    d.rows.forEach(r=>{ const x=by[r.n]||(by[r.n]={item:r.n,qty:0,sales:0,last:0,size:r.s}); x.qty+=r.q; x.sales+=r.q*r.p; x.last=Math.max(x.last,r.t); });
    return Object.values(by).map(x=>{ const mapped=x.item in map, wine=mapped&&map[x.item]?TeamData.wine(map[x.item]):null;
      return {...x,mapped,wine,ignored:mapped&&!map[x.item],suggest:mapped?null:this.suggest(x.item)}; })
      .sort((a,b)=>(a.mapped?1:0)-(b.mapped?1:0)||b.sales-a.sales); },
  unmapped(){ return this.items().filter(x=>!x.mapped); },
  /* The wine a till item most likely is: every telling word of the item in the wine's producer and
     name (sizes, "Btl", "glass" and the like ignored), the most words matched first. */
  _words(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\b(\d+ ?ml|\d{2,3}|btl|bottle|glass|gls|carafe|wine|the|de|la|le|du|des|di|da|del|nv|house)\b/g,' ').replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>2); },
  suggest(item){ const ws=this._words(item); if(!ws.length) return null; let best=null;
    TeamData.wines().forEach(w=>{ const hay=new Set(this._words(TeamData.short(w))); const hit=ws.filter(x=>hay.has(x)).length; if(hit&&(!best||hit>best.hit)) best={wine:w,hit}; });
    return best&&best.hit>=Math.min(2,ws.length)?best.wine:null; },
  size(item){ return /\b(btl|bottle|75 ?cl|750)\b/i.test(item)?'bottle':'glass'; },

  /* A CSV from any till: the first row names the columns. We read the ones we need by name (date or
     time, item or product, qty or quantity, price or amount, server or staff) and ignore the rest.
     Returns {added, rows, skipped, columns}. */
  importCSV(text,{source}={}){
    const lines=String(text||'').split(/\r?\n/).filter(l=>l.trim()); if(lines.length<2) return {added:0,rows:0,skipped:0,columns:[]};
    const split=l=>{ const out=[]; let cur='', q=false; for(const ch of l){ if(ch==='"'){ q=!q; continue; } if(ch===','&&!q){ out.push(cur); cur=''; continue; } cur+=ch; } out.push(cur); return out.map(x=>x.trim()); };
    const head=split(lines[0]).map(h=>h.toLowerCase()), col=(...names)=>head.findIndex(h=>names.some(n=>h===n||h.includes(n)));
    const ci={t:col('date','time','closed','created'),n:col('item','product','name','description'),q:col('qty','quantity','count'),p:col('price','amount','net','total'),v:col('server','staff','employee','user','cashier'),id:col('line id','order id','id','receipt','check')};
    if(ci.t<0||ci.n<0) return {added:0,rows:0,skipped:lines.length-1,columns:head,error:'No date or item column found.'};
    const people=TeamLearn.people(), who=name=>{ const n=String(name||'').toLowerCase().trim(); if(!n) return null; const p=people.find(x=>x.name.toLowerCase()===n)||people.find(x=>x.name.toLowerCase().split(/\s+/)[0]===n.split(/\s+/)[0]); return p?p.id:null; };
    const rows=[]; let skipped=0;
    lines.slice(1).forEach((l,k)=>{ const c=split(l), t=Date.parse(c[ci.t]); if(!(t>0)||!c[ci.n]){ skipped++; return; }
      const q=ci.q>=0?+String(c[ci.q]).replace(/[^0-9.-]/g,'')||1:1, amt=ci.p>=0?+String(c[ci.p]).replace(/[^0-9.-]/g,'')||0:0;
      rows.push({i:'csv-'+(ci.id>=0&&c[ci.id]?c[ci.id]+'-'+k:t+'-'+k),t,n:c[ci.n],s:this.size(c[ci.n]),q,p:q?amt/q:amt,v:ci.v>=0?who(c[ci.v]):null}); });
    const added=this.ingest(rows,{source:source||{kind:'csv',label:'Sales file (CSV)'}});
    return {added,rows:rows.length,skipped,columns:head};
  },

  /* The demo's invented sales (docs/business.md): eight weeks at The Larkspur, shaped so the console
     tells a true story about this team: Claire sells more bottles than anyone, wines nobody has learnt
     don't move, Marco's by-the-glass sales dipped the weeks he stopped drilling, Priya sells less wine
     per cover than Dani, Amara has only worked her first nights, and a Picpoul the till knows that the
     list doesn't. Seeded, so it's the same every time. */
  seedDemo(weeks=8){
    const wines=TeamData.wines(); if(!wines.length) return 0;
    const ppl=TeamLearn.people(), by=role=>ppl.filter(p=>p.role===role), first=n=>ppl.find(p=>p.name.split(' ')[0]===n);
    const claire=first('Claire')||by('sommelier')[0], marco=first('Marco')||by('bartender')[0], dani=first('Dani')||by('server')[0], priya=first('Priya')||by('server')[1], amara=first('Amara')||by('server')[2];
    let s=0x5eed; const rnd=()=>{ s=(s+0x6d2b79f5)|0; let t=Math.imul(s^(s>>>15),1|s); t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; };
    const pick=(items,weights)=>{ const tot=weights.reduce((a,b)=>a+b,0); let r=rnd()*tot; for(let i=0;i<items.length;i++){ r-=weights[i]; if(r<=0) return items[i]; } return items[items.length-1]; };
    const money=x=>{ const m=/\d+(?:\.\d+)?/.exec(String(x||'')); return m?+m[0]:0; }; // "£55 (37.5cl)" is 55
    const all=TeamLearn._all(), knows=(p,w)=>!!p&&TeamLearn.knowsWine(p.id,p.role,w.id,(all[p.id]||{items:{}}).items);
    const glass=wines.filter(TeamData.byGlass), bottle=wines.filter(w=>money(w.bottle)>0);
    // How much each wine would sell on its own merits: cheaper and by the glass sell more, sweet wines least.
    const merit=(w,size)=>{ const price=money(size==='glass'?w.glass:w.bottle)||20; let m=(size==='glass'?60:160)/Math.max(6,price); if(/sweet|fortif/i.test(w.section)) m*=0.35; if(w.type==='rosé'||w.type==='orange') m*=0.7; const sellers=ppl.filter(p=>['server','bartender','sommelier'].includes(p.role)); if(sellers.length&&!sellers.some(p=>knows(p,w))) m*=0.55; return m; };
    const rows=[], nights={}; const now=new Date(); now.setHours(0,0,0,0);
    for(let d=weeks*7;d>=1;d--){
      const day=new Date(now.getTime()-d*this.DAY), dow=day.getDay(); if(dow===1) continue; // closed Mondays
      const covers=Math.round([90,0,55,65,80,105,120][dow]*(0.85+rnd()*0.3)), key=this.night(day.getTime());
      const shifts=[]; if(dani&&dow!==2) shifts.push(dani); if(priya&&dow!==0) shifts.push(priya); if(amara&&d<=4) shifts.push(amara); if(claire&&dow>=3) shifts.push(claire); if(marco) shifts.push(marco);
      nights[key]={covers,shifts:shifts.map(p=>p.id)};
      const servers=shifts.filter(p=>p.role==='server');
      const agg={}; const add=(w,size,p,qty,price,item)=>{ const k=`${item}|${p?p.id:'-'}`; const x=agg[k]||(agg[k]={w,size,p,qty:0,price,item}); x.qty+=qty; };
      // By the glass: about half the covers take a glass; the bar pours a share of them (less in Marco's slipping weeks).
      const glassLines=Math.round(covers*(0.5+rnd()*0.12)), barShare=marco?(d<=21?0.2:0.34):0;
      for(let i=0;i<glassLines;i++){
        const w=pick(glass,glass.map(x=>merit(x,'glass'))); const bar=rnd()<barShare;
        let p=bar?marco:servers.length?pick(servers,servers.map(x=>(x===priya?0.7:1)*(knows(x,w)?1.45:1))):null;
        const ml=rnd()<0.15?125:175, price=money(w.glass)*(ml===125?0.72:1);
        add(w,'glass',p,1,Math.round(price*100)/100,`${TeamData.short(w)} ${ml}`);
      }
      // Bottles: the sommelier sells most of them when she's on.
      const bottleLines=Math.round(covers*(0.1+rnd()*0.05));
      for(let i=0;i<bottleLines;i++){
        const w=pick(bottle,bottle.map(x=>merit(x,'bottle'))); const som=claire&&shifts.includes(claire)&&rnd()<0.45;
        const p=som?claire:servers.length?pick(servers,servers.map(x=>(x===priya?0.6:1)*(knows(x,w)?1.6:1))):null;
        add(w,'bottle',p,1,money(w.bottle),`${TeamData.short(w)} Btl`);
      }
      // A wine the till knows and the list doesn't: the kitchen's new Picpoul, on since last week.
      if(d<=10){ const n=1+Math.floor(rnd()*4); for(let i=0;i<n;i++) add(null,'glass',servers[0]||marco,1,9.5,'Picpoul de Pinet 175'); }
      Object.values(agg).forEach((x,k)=>rows.push({i:`demo-${key}-${k}`,t:day.getTime()+19*3600000+Math.floor(rnd()*4*3600000),n:x.item,w:x.w?x.w.id:null,s:x.size,q:x.qty,p:x.price,v:x.p?x.p.id:null}));
    }
    const d=this._empty(); d.map={}; rows.forEach(r=>{ if(r.w) d.map[r.n]=r.w; }); // the demo's map is confirmed, bar the Picpoul
    this.save(d);
    return this.ingest(rows,{source:{kind:'demo',label:'Demo data (invented)',note:'Eight weeks of invented sales for The Larkspur, shaped for the demo. Nothing here came from a till.'},nights});
  },
};
Object.assign(window,{TeamSales});
