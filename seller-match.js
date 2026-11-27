/* Vinterest Seller: the agency's catalogue, and which of its bottles fit a prospect restaurant (docs/seller.md).

   SellerCatalogue is the agency's listings as data/seller-awsm.json holds them (scripts/seller-catalogue.mjs).
   SellerMatch reads the prospect through the Teams modules (TeamData: its list, menu, cards and pairings; TeamBuyer:
   its price ladder, markups and drinking windows) and works out, with no Claude call:

     openings   what the list and menu leave room for: a gap in a colour's price ladder, a wine guests ask for by name
                that isn't there (or only far up the list), something missing by the glass, a dish with no good
                pairing, a bottle near the end of its drinking window, a house already on the list, large formats.
     fit        each catalogue wine against those openings, as counted reasons that add up to a fit score.
     shortlist  the bottles to lead with, spread over openings and producers, each with where it lands on their list.

   The fit score is NOT a chance of a sale: there are no outcomes behind it yet (an agency's sales history comes
   later, and is what would let the weights be fitted). It is the reasons added up, and every reason says what it
   rests on: `list` (the restaurant's own list or menu), `sheet` (the agency's product sheet) or `estimate` (ours:
   a style figure the sheet lacks, or the price it would land at). The screens show that beside each reason. */
const SellerCatalogue = {
  data(){ return _loadJSON('data/seller-awsm.json'); },
  agency(){ return this.data().agency; },
  items(){ return this.data().items; },
  item(id){ return this.items().find(i=>i.id===id)||null; },
  wines(){ return this.items().filter(i=>i.kind==='wine'); },
  spirits(){ return this.items().filter(i=>i.kind==='spirit'); },
  /* The house then the wine, without saying the house twice ("Domaines Ott" + "Domaines Ott Rosé Coeur de Grain"). */
  short(i){ const n=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''), pw=String(i.producer||'').split(/\s+/).filter(Boolean), nw=String(i.name||'').split(/\s+/); let k=0;
    while(k<pw.length&&k<nw.length-1&&n(pw[k])===n(nw[k])) k++; const last=pw[pw.length-1]; if(!k&&last&&nw.length>1&&n(nw[0])===n(last)) k=1;
    return [i.producer,nw.slice(k).join(' ')].filter(Boolean).join(' '); },
  label(i){ return this.short(i)+(i.vintage?' '+i.vintage:''); },
  money(n,dp){ const v=Number(n)||0; return this.agency().currency.sym+v.toLocaleString('en-CA',{minimumFractionDigits:dp==null?(v%1?2:0):dp,maximumFractionDigits:dp==null?2:dp}); },
  format(i){ return i.ml===750?'':i.ml>=1000?`${i.ml/1000}L`:`${i.ml}ml`; },
  caseCost(i){ return Math.round(i.price*i.ucs*100)/100; },
  /* What can be delivered: cases in the agency's warehouse, else what's on the way, else the LCBO's shelves. */
  supply(i){ const s=i.stock||{}, t=(s.transit||[]).reduce((a,x)=>a+x.qty,0);
    if(s.warehouse>0) return {k:'now',n:s.warehouse,line:`${s.warehouse} case${s.warehouse===1?'':'s'} in the warehouse`};
    if(t>0) return {k:'transit',n:t,line:`${t} cases on the way`};
    if(i.status==='on-order') return {k:'order',n:0,line:'On order'};
    if(s.store>0) return {k:'store',n:s.store,line:'LCBO stores only'};
    return {k:'none',n:0,line:'Nothing in stock'}; },
};

const SellerMatch = {
  _m(x){ return TeamBuyer._m(x); },
  _norm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); },
  HOUSE_STOP:new Set(['tenuta','tenute','domaine','domaines','chateau','bodegas','bodega','cantine','cantina','casa','wines','wine','estates','estate','family','vineyards','the','di','de','del','des','les','la','le','et','and','vins','vini','porto','cognac','distilling','liquor','corp']),
  _tokens(s){ return this._norm(s).split(' ').filter(t=>t.length>3&&!this.HOUSE_STOP.has(t)); },
  venue(){ return TeamData.get().venue||{}; },
  HOME:{CA:'Canada',GB:'United Kingdom',US:'United States'},
  home(){ return this.HOME[this.venue().country]||null; },
  list(){ return TeamBuyer.wines(); },
  /* One shape for a wine on their list and a wine in the catalogue, under one name per grape and region (CLAUDE.md:
     "One name per thing when grouping"): Garnacha and Grenache are one grape, Barolo is Piedmont. */
  shape(x){ const ours=!!x.cspc, grapes=(x.grapes||[]).map(g=>WineDNA.grape(String(g).replace(/\s*\(.*\)/,''))).filter(Boolean);
    const kind=ours?x.type:TeamLearn.kindOf(x), place=ours?{region:x.appellation||x.region,sub_region:x.sub,name:x.name,country:x.country}:x;
    let region=null; try{ region=WineDNA.region(place)||null; }catch(e){}
    if(ours&&x.region&&(!region||region===x.appellation)){ try{ region=WineDNA.region({region:x.region,country:x.country})||region||x.region; }catch(e){ region=x.region; } }
    const style=ours?x.style:(TeamData.card(x.id)||{}).style||null;
    return {ours,kind:kind==='dessert'?'sweet':kind,colour:this.colour(kind),grapes,lead:grapes[0]||null,country:x.country||'',region:region||(ours?x.region:x.region)||'',style,text:this._norm([x.producer,x.name,x.region,x.appellation,x.sub].join(' '))}; },
  colour(kind){ return {sparkling:'Sparkling',white:'White','rosé':'Rosé',rose:'Rosé',orange:'Orange',red:'Red',sweet:'Sweet',dessert:'Sweet',fortified:'Fortified'}[kind]||'Other'; },

  /* ---- what they charge ---- */
  /* The restaurant's multiple on a bottle that costs about this much, from its own list: the K_NEAR wines nearest in
     shop price whose shop price we know (Vinny's estimate from the buyer review, or exactly, where the bottle is one
     of ours). Lists mark up cheap bottles more than dear ones, so one multiple for the whole list would put a $20
     wine too low and a $100 wine too high. */
  K_NEAR:7, X_DEFAULT:3, COLOUR_FAR:0.35,
  _points(){ if(this._pts&&this._ptsFor===TeamData.get()) return this._pts; const own=Object.fromEntries(this.ours().map(o=>[o.wine.id,o.item.price]));
    const pts=this.list().map(w=>{ const b=this._m(w.bottle), colour=this.colour(TeamLearn.kindOf(w)); if(!b) return null; if(own[w.id]) return {w,colour,cost:own[w.id],x:b/own[w.id],exact:true}; const mk=TeamBuyer.markup(w); return mk&&mk.source==='estimate'?{w,colour,cost:mk.retail,x:mk.x}:null; }).filter(Boolean);
    this._pts=pts; this._ptsFor=TeamData.get(); return pts; },
  multipleAt(cost,colour){ const pts=this._points(); if(pts.length<3) return {x:this.X_DEFAULT,n:0};
    // Nearest in cost, a bottle of another colour counting as a little further off (COLOUR_FAR): sparkling is marked up less than still wine on most lists.
    const d=p=>Math.abs(Math.log(p.cost/cost))+(colour&&p.colour!==colour?this.COLOUR_FAR:0), near=[...pts].sort((a,b)=>d(a)-d(b)).slice(0,this.K_NEAR).map(p=>p.x).sort((a,b)=>a-b);
    return {x:near[Math.floor(near.length/2)],n:near.length}; },
  /* The most they put on any bottle whose cost we know. A wine that would need more than that to reach their cheapest
     bottle is too cheap for the list; one that needs less can go on at their entry price, and earns them more. */
  maxMultiple(){ const xs=this._points().map(p=>p.x); return xs.length>=3?Math.max(...xs):this.X_DEFAULT*1.4; },
  glassRatio(){ const rs=this.list().filter(w=>this._m(w.glass)&&this._m(w.bottle)).map(w=>this._m(w.bottle)/this._m(w.glass)).sort((a,b)=>a-b); return rs.length?rs[Math.floor(rs.length/2)]:5; },
  _round(p){ return p<200?Math.round(p/5)*5:Math.round(p/10)*10; },
  /* Where a catalogue bottle would land on their list: its price at their multiple, the glass that goes with it, and
     the bottles of its colour it would sit between. An estimate, and said to be one. */
  landing(i){ const sh=this.shape(i), per=750/i.ml, m=this.multipleAt(i.price*per,sh.colour), lane=this.list().filter(w=>this.shape(w).colour===sh.colour&&this._m(w.bottle)).map(w=>({w,p:this._m(w.bottle)})).sort((a,b)=>a.p-b.p);
    const all=this.list().map(w=>this._m(w.bottle)).filter(Boolean), entry=lane.length?lane[0].p:Math.min(...all), usual=this._round(i.price*m.x);
    // Under their cheapest bottle at their usual multiple, but within the most they put on anything: it goes on at their entry price.
    const lifted=i.ml===750&&usual<entry&&i.price*this.maxMultiple()>=entry, bottle=lifted?entry:usual, x=bottle/i.price;
    const below=[...lane].reverse().find(y=>y.p<=bottle&&!(lifted&&y.p===bottle))||null, above=lane.find(y=>y.p>bottle)||(lifted?lane[0]:null);
    const gl=this.list().filter(TeamData.byGlass).map(w=>this._m(w.glass)), glass=i.ml===750?Math.max(Math.round(bottle/this.glassRatio()),lifted&&gl.length?Math.min(...gl):0):null;
    return {bottle,per750:bottle*per,glass,x,usualX:m.x,lifted,entry,below:lifted?null:below,above:lifted?(lane[1]||null):above,beside:lifted?lane[0]:null,lane,min:entry,max:lane.length?lane[lane.length-1].p:null}; },

  /* ---- what's already ours ---- */
  /* Catalogue wines already on their list (the same house and the same wine's name), and houses of ours on it. */
  ours(){ if(this._ours&&this._oursFor===TeamData.get()) return this._ours; const out=[];
    this.list().forEach(w=>{ const wp=this._tokens(w.producer), wn=this._tokens(w.name.split(',')[0]);
      const hit=SellerCatalogue.wines().filter(i=>i.ml===750).find(i=>{ const ip=this._tokens(i.producer), inn=this._tokens(i.name); if(!ip.some(t=>wp.includes(t))) return false;
        const a=wn.length<=inn.length?wn:inn, b=a===wn?inn:wn; return a.length>0&&a.every(t=>b.includes(t)); });
      if(hit) out.push({wine:w,item:hit}); });
    this._ours=out; this._oursFor=TeamData.get(); return out; },
  houseOn(i){ const ip=this._tokens(i.producer).concat(this._tokens(i.supplier)); return this.list().find(w=>this._tokens(w.producer).some(t=>ip.includes(t)))||null; },

  /* ---- what the list leaves room for ---- */
  /* Wines a guest asks for by name. An opening when the list has none, or only well above what most of that colour costs. */
  CALLS:[
    {k:'champagne',label:'Champagne',t:s=>s.kind==='sparkling'&&s.region==='Champagne'},
    {k:'prosecco',label:'Prosecco',t:s=>s.kind==='sparkling'&&s.lead==='Glera'},
    {k:'nzsb',label:'New Zealand Sauvignon Blanc',t:s=>s.kind==='white'&&s.lead==='Sauvignon Blanc'&&s.country==='New Zealand'},
    {k:'pg',label:'Pinot Grigio',t:s=>s.kind==='white'&&/^Pinot Gri/.test(s.lead||'')},
    {k:'chard',label:'New World Chardonnay',t:s=>s.kind==='white'&&s.lead==='Chardonnay'&&!['France','Italy'].includes(s.country)},
    {k:'provrose',label:'Provence rosé',t:s=>s.kind==='rosé'&&s.region==='Provence'},
    {k:'pinot',label:'New World Pinot Noir',t:s=>s.kind==='red'&&s.lead==='Pinot Noir'&&!['France','Italy'].includes(s.country)},
    {k:'cab',label:'New World Cabernet Sauvignon',t:s=>s.kind==='red'&&s.lead==='Cabernet Sauvignon'&&!['France','Italy'].includes(s.country)},
    {k:'malbec',label:'Malbec',t:s=>s.kind==='red'&&s.lead==='Malbec'},
    {k:'rioja',label:'Rioja',t:s=>s.kind==='red'&&s.region==='Rioja'},
    {k:'amarone',label:'Amarone',t:s=>s.kind==='red'&&/amarone|amaron\b/.test(s.text)},
    {k:'barolo',label:'Barolo',t:s=>s.kind==='red'&&/barolo/.test(s.text)},
    {k:'port',label:'Port',t:s=>s.kind==='fortified'},
    {k:'icewine',label:'Icewine',t:s=>s.kind==='sweet'&&/icewine|ice wine/.test(s.text)},
  ],
  FAR_X:1.6, GLASS_ROOM:1.3, MIX_SHARE:0.2,
  openings(){ if(this._open&&this._openFor===TeamData.get()) return this._open;
    const out=[], M=n=>TeamData.money(Math.round(n)), ws=this.list(), sh=new Map(ws.map(w=>[w.id,this.shape(w)])), S=w=>sh.get(w.id), bottles=ws.filter(w=>this._m(w.bottle)), pours=ws.filter(TeamData.byGlass);
    const med=xs=>{ const s=[...xs].sort((a,b)=>a-b); return s.length?s[Math.floor(s.length/2)]:0; }, nick=w=>TeamData.nick(w), home=this.home();
    // 1. A gap in a colour's prices: the next bottle up costs half as much again or more.
    TeamBuyer.ladder().forEach(l=>l.gaps.forEach(g=>out.push({k:'ladder:'+l.colour+':'+g.from.p,kind:'ladder',pts:16,tag:'Price gap',colour:l.colour,lo:g.from.p,hi:g.to.p,
      title:`${l.colour}: nothing between ${M(g.from.p)} and ${M(g.to.p)}`,fact:`Their ${l.colour.toLowerCase()} list steps from ${nick(g.from.w)} at ${M(g.from.p)} straight to ${nick(g.to.w)} at ${M(g.to.p)}. A guest who won't go that far has nowhere to land.`,basis:'list'})));
    // 2. Wines guests ask for by name.
    this.CALLS.forEach(c=>{ const has=ws.filter(w=>c.t(S(w))), col=has[0]?S(has[0]).colour:null, ps=has.map(w=>this._m(w.bottle)).filter(Boolean), cheapest=ps.length?Math.min(...ps):null;
      const lane=col?med(bottles.filter(w=>S(w).colour===col).map(w=>this._m(w.bottle))):0;
      if(!has.length) out.push({k:'call:'+c.k,kind:'call',pts:18,tag:'Missing',call:c,title:`No ${c.label} on the list`,fact:`Guests ask for ${c.label} by name, and there isn't one on the list.`,basis:'list'});
      else if(cheapest&&lane&&cheapest>=lane*this.FAR_X&&!has.some(TeamData.byGlass)) out.push({k:'call:'+c.k,kind:'call',pts:14,tag:'Out of reach',call:c,under:cheapest,title:`${c.label} starts at ${M(cheapest)}`,fact:`The only ${c.label} is ${nick(has[0])}${has.length>1?` and ${has.length-1} more`:''}, from ${M(cheapest)}; most of their ${col.toLowerCase()} bottles are around ${M(lane)}.`,basis:'list'}); });
    // 3. By the glass: local wine, a proper sparkling, something sweet for the desserts.
    const gmax=Math.max(0,...pours.map(w=>this._m(w.glass))), gmin=pours.length?Math.min(...pours.map(w=>this._m(w.glass))):0, room=Math.round(gmax*this.GLASS_ROOM);
    if(pours.length){
      const local=home?ws.filter(w=>w.country===home):[];
      if(home&&!pours.some(w=>w.country===home)) out.push({k:'glass:local',kind:'glass',pts:16,tag:'By the glass',say:`${home==='Canada'?'An Ontario':'A local'} wine by the glass`,t:s=>s.country===home&&['white','red','rosé','sparkling'].includes(s.kind),room,floor:gmin,title:`No ${home==='Canada'?'Ontario':'local'} wine by the glass`,
        fact:`${local.length?`All ${local.length} ${home==='Canada'?'Canadian':'local'} wines are bottle only`:`There is no ${home==='Canada'?'Canadian':'local'} wine on the list`}, so a guest can't order a local glass. Their glasses run ${M(gmin)} to ${M(gmax)}.`,basis:'list'});
      const fizz=pours.filter(w=>S(w).kind==='sparkling');
      if(fizz.length&&fizz.every(w=>S(w).lead==='Glera')&&ws.some(w=>S(w).kind==='sparkling'&&S(w).lead!=='Glera')) out.push({k:'glass:fizz',kind:'glass',pts:16,tag:'By the glass',say:'A traditional-method sparkling by the glass',t:s=>s.kind==='sparkling'&&(s.region==='Champagne'||/traditionnelle|traditional|classico|franciacorta|cremant|\bcava\b/.test(s.text)),room,floor:gmin,title:'Prosecco is the only sparkling by the glass',
        fact:`They sell ${ws.filter(w=>S(w).kind==='sparkling'&&S(w).lead!=='Glera').length} Champagnes and traditional-method sparkling wines by the bottle, but the only bubbles by the glass is ${nick(fizz[0])} at ${fizz[0].glass}.`,basis:'list'});
      const desserts=TeamData.dishes().filter(d=>/dessert|pudding|sweet/i.test(d.section||'')), sweetPours=pours.filter(w=>['sweet','fortified'].includes(S(w).kind));
      if(desserts.length>=2&&sweetPours.length<2) out.push({k:'glass:sweet',kind:'glass',pts:16,tag:'By the glass',t:s=>['sweet','fortified'].includes(s.kind),room,sweet:true,title:`${desserts.length} desserts, ${sweetPours.length?'one sweet pour':'no sweet pour'}`,
        fact:`There are ${desserts.length} desserts and ${sweetPours.length?`one sweet wine by the glass (${nick(sweetPours[0])})`:'nothing sweet by the glass'}, so there's no second thing to offer after dinner.`,basis:'list'}); }
    // 4. Desserts the list can't pour for: chocolate, coffee and caramel want a fortified wine, and there is none.
    const dark=TeamData.dishes().filter(d=>/dessert|pudding|sweet/i.test(d.section||'')&&/chocolate|coffee|caramel|toffee|nut/i.test([d.name,d.desc,d.main,(d.flav||[]).join(' ')].join(' ')));
    const review=(TeamBuyer.reviewed()||{}).weak||[];
    if(dark.length&&!ws.some(w=>S(w).kind==='fortified')) out.push({k:'dish:dark',kind:'dish',pts:18,tag:'Menu',dishes:dark,t:s=>s.kind==='fortified',title:`Nothing to pour with ${dark.map(d=>d.name).join(' or ')}`,
      fact:`${dark.map(d=>d.name).join(' and ')} want a fortified wine, and the list has none: their own suggestions for ${dark.length>1?'them':'it'} are a Sauternes and a dry wine.`,vinny:review.filter(r=>dark.some(d=>d.id===r.dish)).map(r=>r.why),basis:'list'});
    // 5. Bottles near or past the end of their drinking window.
    const win=TeamBuyer.windows(), yr=new Date().getFullYear(); [...win.past.map(w=>[w,'past its best']),...win.soon.filter(w=>{ const x=TeamData.window(w); return x&&x.to<yr; }).map(w=>[w,'past its peak'])].forEach(([w,word])=>{ const p=this._m(w.bottle); if(!p) return;
      out.push({k:'window:'+w.id,kind:'window',pts:12,tag:'Window',wine:w,word,title:`${nick(w)} ${w.vintage} is ${word}`,fact:`${TeamData.label(w)} at ${M(p)} is ${word} (${(TeamData.window(w)||{}).line||'an estimate'}). It needs a successor at about that price.`,basis:TeamData.window(w)&&TeamData.window(w).source==='claude'?'estimate':'estimate'}); });
    // 6. A country they plainly buy from, with one of its regions missing in a colour the catalogue has.
    const byC={}; ws.forEach(w=>{ (byC[w.country]||(byC[w.country]=[])).push(w); });
    Object.entries(byC).filter(([c,xs])=>c&&xs.length/ws.length>=this.MIX_SHARE).forEach(([c,xs])=>{ const have=new Set(xs.map(w=>S(w).region+'|'+S(w).colour)), seen=new Set();
      SellerCatalogue.wines().filter(i=>i.country===c&&i.ml===750).forEach(i=>{ const s=this.shape(i), key=s.region+'|'+s.colour; if(!s.region||have.has(key)||seen.has(key)||!['Red','White'].includes(s.colour)) return; seen.add(key);
        out.push({k:'mix:'+key,kind:'mix',pts:10,tag:'Region',country:c,region:s.region,colour:s.colour,title:`${c==='Italy'?'Italian':c==='France'?'French':c} list, no ${s.colour.toLowerCase()} from ${s.region}`,
          fact:`${xs.length} of their ${ws.length} wines are from ${c}, across ${new Set(xs.map(w=>S(w).region)).size} regions, and there is no ${s.colour.toLowerCase()} from ${s.region}.`,basis:'list'}); }); });
    // 7. Large formats: they sell them, so a magnum has a place.
    const large=ws.filter(w=>/large|magnum/i.test(w.section||''));
    if(large.length) out.push({k:'format',kind:'format',pts:8,tag:'Format',title:`A large-format section of ${large.length}`,fact:`They list ${large.length} large-format bottle${large.length===1?'':'s'} (${large.map(nick).join(', ')}), so a magnum has somewhere to go.`,basis:'list'});
    this._open=out; this._openFor=TeamData.get(); return out; },

  /* ---- pairing ---- */
  /* The dishes a catalogue wine would suit, by the restaurant's own pairings: the dish already takes a wine of its
     kind, and this one is within PAIR_GAP of that wine in body, tannin and sweetness together (Teams' own measure,
     TeamLearn.tableFit). Desserts follow the kitchen rule instead: dark and nutty wants fortified, fruit wants a sweet
     white with acidity. */
  PAIR_GAP:1,
  suits(i){ const sh=this.shape(i), st=sh.style; if(!st) return [];
    return TeamData.dishes().map(d=>{ const pr=TeamData.pairing(d.id)||{}, dessert=/dessert|pudding|sweet/i.test(d.section||'');
      if(dessert){ const darkish=/chocolate|coffee|caramel|toffee|nut/i.test([d.name,d.desc,d.main,(d.flav||[]).join(' ')].join(' '));
        if(sh.kind==='fortified'&&darkish) return {dish:d,gap:0,rule:'dark'}; if(sh.kind==='sweet'&&!darkish&&st.acid>=4) return {dish:d,gap:0,rule:'fruit'}; return null; }
      if(['sweet','fortified'].includes(sh.kind)) return null;
      const picks=[...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id].filter(Boolean).map(id=>TeamData.wine(id)).filter(Boolean); let best=null;
      picks.forEach(w=>{ const ps=this.shape(w); if(ps.kind!==sh.kind||!ps.style) return; const gap=Math.abs(st.body-ps.style.body)+Math.abs((st.tannin||0)-(ps.style.tannin||0))+Math.abs((st.sweet||0)-(ps.style.sweet||0)); if(!best||gap<best.gap) best={dish:d,gap,like:w}; });
      return best&&best.gap<=this.PAIR_GAP&&!(pr.avoid&&this.shape(TeamData.wine(pr.avoid.id)||{}).kind===sh.kind&&best.gap>0&&false)?best:null; }).filter(Boolean).sort((a,b)=>a.gap-b.gap); },

  /* ---- fit ---- */
  FLOOR:0.9, CEIL:1.1, DUP_NEAR:0.25,
  /* Why a catalogue wine can't go on this list at all, or null. */
  ruledOut(i){ const sh=this.shape(i), L=this.landing(i), opens=this.openings();
    if(i.kind!=='wine') return 'A spirit: see the back bar';
    if(this.ours().some(o=>o.item.id===i.id)) return 'Already on their list';
    if(i.ml>=3000) return 'Too large a format for this list';
    if(i.ml>=1500&&!opens.some(o=>o.kind==='format')) return 'They list no large formats';
    if(i.ml<750&&!['sweet','fortified'].includes(sh.kind)) return 'They list no half bottles';
    const sweet=['sweet','fortified'].includes(sh.kind), gl=this.list().filter(TeamData.byGlass).map(w=>this._m(w.glass)), gmin=gl.length?Math.min(...gl):0;
    if(sweet) return null; // poured by the small glass: the bottle ladder doesn't apply
    const all=this.list().map(w=>this._m(w.bottle)).filter(Boolean), top=Math.max(...all)*this.CEIL;
    if(L.per750<L.entry*this.FLOOR) return `Too cheap for this list: about ${TeamData.money(L.bottle)}${i.ml!==750?` for a ${SellerCatalogue.format(i)}`:''} at their usual multiple, and their cheapest ${sh.colour.toLowerCase()} bottle is ${TeamData.money(L.entry)}`;
    if(L.bottle>top) return `Would land at about ${TeamData.money(L.bottle)}, above anything on their list`;
    return null; },
  fit(i){ const out=this.ruledOut(i), sh=this.shape(i), L=this.landing(i), M=n=>TeamData.money(Math.round(n)), nick=w=>TeamData.nick(w), reasons=[], fills=[];
    if(out) return {item:i,out,score:0,reasons:[],fills:[],landing:L,shape:sh,suits:[]};
    const add=(pts,text,basis,o)=>{ reasons.push({pts,text,basis}); if(o) fills.push(o); }, sweet=['sweet','fortified'].includes(sh.kind), std=i.ml===750;
    const suits=this.suits(i), opens=this.openings();
    opens.forEach(o=>{
      if(o.kind==='ladder'&&std&&sh.colour===o.colour&&L.bottle>o.lo*1.08&&L.bottle<o.hi*0.92) add(o.pts,`Lands at about ${M(L.bottle)}, in the gap between ${M(o.lo)} and ${M(o.hi)} on their ${o.colour.toLowerCase()} list`,'estimate',o);
      if(o.kind==='call'&&o.call.t(sh)&&(std||sweet)){ if(!o.under) add(o.pts,`${this._a(o.call.label)} ${o.call.label}, and they don't list one`,'sheet',o); else if(L.bottle<o.under*0.85) add(o.pts,`${this._a(o.call.label)} ${o.call.label} at about ${M(L.bottle)}, where theirs starts at ${M(o.under)}`,'estimate',o); }
      if(o.kind==='glass'&&o.t(sh)&&(std||sweet)){ const g=sweet?null:L.glass, again=fills.some(x=>x.kind==='glass'); if(sweet||(g<=o.room&&g>=o.floor*0.9)) add(again?o.pts/2:o.pts,sweet?`A sweet wine to pour by the small glass with dessert`:`${o.say}, at about ${M(g)} (theirs run ${M(o.floor)} to ${M(Math.round(o.room/this.GLASS_ROOM))})`,sweet?'sheet':'estimate',o); }
      if(o.kind==='dish'&&o.t(sh)) add(o.pts,`The fortified wine ${o.dishes.map(d=>d.name).join(' and ')} need${o.dishes.length===1?'s':''}`,'sheet',o);
      if(o.kind==='window'&&std){ const ws=this.shape(o.wine), p=this._m(o.wine.bottle); if(ws.kind===sh.kind&&ws.style&&sh.style){ const gap=Math.abs(sh.style.body-ws.style.body)+Math.abs((sh.style.tannin||0)-(ws.style.tannin||0))+Math.abs((sh.style.sweet||0)-(ws.style.sweet||0));
        const like=(ws.lead&&ws.lead===sh.lead)||(ws.region&&ws.region===sh.region)||gap===0;
        if(gap<=1&&like&&Math.abs((sh.style.acid||0)-(ws.style.acid||0))<=1&&L.bottle>=p*0.7&&L.bottle<=p*1.3) add(o.pts+(/long|1\d|2\d|3\d/i.test(i.ageing||'')?4:0),`A successor to ${nick(o.wine)} ${o.wine.vintage} (${M(p)}), which is ${o.word}: the same style at about ${M(L.bottle)}`,'estimate',o); } }
      if(o.kind==='mix'&&std&&sh.country===o.country&&sh.region===o.region&&sh.colour===o.colour) add(o.pts,`A ${o.colour.toLowerCase()} from ${o.region}, which their ${o.country==='Italy'?'Italian':o.country==='France'?'French':o.country} list doesn't have`,'sheet',o);
      if(o.kind==='format'&&i.ml>=1500) add(o.pts,`A ${SellerCatalogue.format(i)} for their large-format section`,'sheet',o);
    });
    if(L.lifted) add(4,`At their entry price of ${M(L.bottle)} it's ${L.x.toFixed(1)} times its cost, where they usually put ${L.usualX.toFixed(1)} on a bottle like it`,'estimate');
    // A house they already buy: the conversation is half had.
    const house=this.houseOn(i), mine=house&&this.ours().find(o=>o.wine.id===house.id);
    if(house) add(mine?16:12,mine?`They already sell ${TeamData.short(house)} at ${M(this._m(house.bottle))}, and it's ours: this is the next wine from the same house`:`They already list ${TeamData.short(house)}, from the same house`,'list',{k:'house:'+this._tokens(i.producer)[0],kind:'house',pts:mine?16:12,tag:'Relationship',wine:house,title:`${i.supplier||i.producer} is already on the list`});
    // The dishes it would be suggested with.
    const savoury=suits.filter(s=>!s.rule); if(savoury.length) add(Math.min(12,savoury.length*3),`Suits ${savoury.length} dish${savoury.length===1?'':'es'} on the menu: ${savoury.slice(0,3).map(s=>s.dish.name).join(', ')}${savoury.length>3?' and more':''}`,'estimate');
    if(suits.some(s=>s.rule==='fruit')) add(4,`Sweet with the acidity for ${suits.filter(s=>s.rule==='fruit').map(s=>s.dish.name).join(' and ')}`,'estimate');
    // What counts against it.
    const same=this.list().filter(w=>{ const s=this.shape(w); return s.kind===sh.kind&&sh.lead&&s.lead===sh.lead&&(s.region&&sh.region?s.region===sh.region:s.country===sh.country); }), near=same.filter(w=>{ const p=this._m(w.bottle); return p&&Math.abs(p-L.bottle)/L.bottle<=this.DUP_NEAR; });
    if(near.length) add(-18,`They already list ${nick(near[0])} at ${M(this._m(near[0].bottle))}: the same grape from the same place at about the same price`,'list');
    else if(same.length&&!fills.some(o=>['ladder','glass','call','mix'].includes(o.kind))) add(-6,`They already list ${sh.lead} from ${sh.region||sh.country} (${nick(same[0])})`,'list');
    if(std&&!sweet&&!fills.some(o=>['call','glass','dish'].includes(o.kind))){ const pile=L.lane.filter(y=>Math.abs(y.p-L.bottle)/L.bottle<=0.08); if(pile.length>=3) add(-6,`${pile.length} of their ${sh.colour.toLowerCase()} bottles are already within a few dollars of ${M(L.bottle)}`,'estimate'); }
    const sup=SellerCatalogue.supply(i); if(sup.k==='now') add(sup.n>=5?6:3,sup.line,'sheet'); else if(sup.k==='transit') add(1,sup.line,'sheet'); else if(sup.k==='store') add(-2,'LCBO stores only: nothing in the agency warehouse','sheet'); else add(-8,sup.line,'sheet');
    if(i.basis.grapes!=='sheet'&&!sh.lead) add(-4,'The sheet gives no grapes, so less of this could be checked','sheet');
    const openPts=reasons.filter(r=>r.pts>0).reduce((a,r)=>a+r.pts,0), score=fills.length?Math.max(0,Math.min(99,30+reasons.reduce((a,r)=>a+r.pts,0))):Math.max(0,Math.min(45,20+reasons.reduce((a,r)=>a+r.pts,0)));
    return {item:i,out:null,score,word:this.word(score),reasons:reasons.sort((a,b)=>b.pts-a.pts),fills,landing:L,shape:sh,suits,supply:sup,house}; },
  _a(word){ return /^[aeiou]/i.test(word)?'An':'A'; },
  LEAD:70, SHOW:55,
  word(score){ return score>=this.LEAD?'Lead with it':score>=this.SHOW?'Worth showing':'Back pocket'; },
  all(){ if(this._all&&this._allFor===TeamData.get()) return this._all; this._all=SellerCatalogue.items().map(i=>this.fit(i)).sort((a,b)=>b.score-a.score||a.item.price-b.item.price); this._allFor=TeamData.get(); return this._all; },
  /* The bottles to take to the meeting: best fit first, but no more than PER_HOUSE from one house or PER_OPEN for one
     opening, so the visit covers the list rather than making one point six times. */
  N:8, PER_HOUSE:2, PER_OPEN:2,
  shortlist(n=this.N){ const picked=[], house={}, open={};
    this.all().filter(f=>!f.out&&f.fills.length&&f.score>=this.SHOW-10).forEach(f=>{ if(picked.length>=n) return; const h=f.item.supplier||f.item.producer, first=f.fills.find(o=>o.kind!=='house')||f.fills[0];
      if((house[h]||0)>=this.PER_HOUSE||(open[first.k]||0)>=this.PER_OPEN) return; if(picked.some(p=>p.item.producer===f.item.producer&&p.item.name===f.item.name)) return; if(picked.some(p=>(p.item.supplier||p.item.producer)===h&&p.primary.k===first.k)) return; // one house answers an opening once
      house[h]=(house[h]||0)+1; open[first.k]=(open[first.k]||0)+1; picked.push({...f,primary:first}); });
    return picked; },
  /* Each opening with the catalogue wines that fill it, best first: what the visit can answer, and what it can't. */
  answered(){ const all=this.all().filter(f=>!f.out); return this.openings().map(o=>({...o,wines:all.filter(f=>f.fills.some(x=>x.k===o.k))})).filter(o=>o.wines.length||o.kind!=='mix').sort((a,b)=>(b.wines.length?1:0)-(a.wines.length?1:0)||b.pts-a.pts); },

  /* ---- the pitch for one bottle ---- */
  POURS:5,
  maths(f){ const i=f.item, L=f.landing, cost=SellerCatalogue.caseCost(i), sweet=['sweet','fortified'].includes(f.shape.kind), glass=f.fills.some(o=>o.kind==='glass')&&!sweet;
    const take=glass?i.ucs*this.POURS*L.glass:i.ucs*L.bottle; return sweet?{cost,units:i.ucs}:{cost,units:i.ucs,take,gross:take-cost,by:glass?'glass':'bottle',pours:glass?i.ucs*this.POURS:null}; },
  first(text){ const s=String(text||'').split(/(?<=[.!?])\s+/)[0]||''; return s.length>220?s.slice(0,217).replace(/\s+\S*$/,'')+'…':s; },
  pitch(f){ const i=f.item, L=f.landing, M=n=>TeamData.money(Math.round(n)), nick=w=>TeamData.nick(w), sweet=['sweet','fortified'].includes(f.shape.kind), p=f.primary||f.fills.find(o=>o.kind!=='house')||f.fills[0];
    const where=sweet?`Poured by the 2oz glass after dinner.`:`About ${M(L.bottle)} on the list${f.fills.some(o=>o.kind==='glass')?`, ${M(L.glass)} a glass`:''}${L.lifted&&L.beside?`, their entry price, beside ${nick(L.beside.w)}`:L.below&&L.above?`, between ${nick(L.below.w)} (${M(L.below.p)}) and ${nick(L.above.w)} (${M(L.above.p)})`:L.above?`, under ${nick(L.above.w)} (${M(L.above.p)})`:L.below?`, above ${nick(L.below.w)} (${M(L.below.p)})`:''}.`;
    const together=[]; if(f.house) together.push(`They already buy ${TeamData.short(f.house)}: this is the same house, so it's an addition to an order, not a new supplier.`);
    const sav=f.suits.filter(s=>!s.rule); if(sav[0]) together.push(`With ${sav[0].dish.name}${sav[0].dish.price?` (${sav[0].dish.price})`:''} it does the job of ${nick(sav[0].like)}, which they already suggest there${this._m(sav[0].like.bottle)&&!sweet?` at ${M(this._m(sav[0].like.bottle))}`:''}.`);
    if(f.fills.some(o=>o.kind==='glass')&&!sweet){ const up=L.lane.find(y=>y.p>L.bottle*1.15&&!TeamData.byGlass(y.w)); if(up) together.push(`By the glass it's the way in; ${nick(up.w)} at ${M(up.p)} is the bottle to step up to.`); }
    f.suits.filter(s=>s.rule).forEach(s=>together.push(`${s.dish.name}${s.dish.price?` (${s.dish.price})`:''}: ${s.rule==='dark'?'a fortified wine carries chocolate, coffee and caramel where a dry wine turns bitter':'sweetness with enough acidity to stay fresh against the fruit'}.`));
    const say=[this.first(i.notes.taste),i.shares?Object.entries(i.shares).map(([g,n])=>`${g} ${n}%`).join(', '):null,i.certs.length?i.certs.join(', '):null,this.first(i.notes.made)].filter(Boolean).slice(0,3);
    const objections=[]; const dup=f.reasons.find(r=>r.pts<0&&/already list/.test(r.text));
    if(dup) objections.push({q:`"We already have one of those."`,a:`${dup.text}. Don't argue with it: offer this as the glass pour or the step beside it, not a replacement.`});
    if(p&&p.kind==='ladder') objections.push({q:`"Our list is long enough."`,a:`It's long at the top and bottom of ${p.colour.toLowerCase()} and empty between ${M(p.lo)} and ${M(p.hi)}. This fills a rung; it doesn't add a competitor to a bottle they sell.`});
    if(p&&p.kind==='glass') objections.push({q:`"We can't open another bottle by the glass."`,a:`A case is ${i.ucs*this.POURS} pours. At about ${M(L.glass||0)} a glass that's ${M((L.glass||0)*i.ucs*this.POURS)} from a ${SellerCatalogue.money(SellerCatalogue.caseCost(i))} case, and it's the glass they can't currently sell.`});
    if(p&&p.kind==='call') objections.push({q:`"Nobody asks for it."`,a:`They can't order what isn't listed. It's one of the wines guests name before they open the list, and it would be the only one here${p.under?` under ${M(p.under)}`:''}.`});
    if(SellerCatalogue.supply(i).k!=='now') objections.push({q:`"Can you get it to us?"`,a:`${SellerCatalogue.supply(i).line}. Check the delivery date before the meeting.`});
    return {where,together,say,objections,maths:this.maths(f),primary:p}; },

  /* ---- the back bar ---- */
  SPIRIT:[['bourbon',/bourbon/],['rum',/\brum\b/],['Scotch',/scotch|single malt/],['Cognac',/cognac|brandy/],['ouzo',/ouzo|anise/]],
  backBar(){ const cs=TeamData.cocktails?TeamData.cocktails():[]; return SellerCatalogue.spirits().map(i=>{ const cat=this.SPIRIT.find(([,re])=>re.test((i.family+' '+i.name).toLowerCase())); if(!cat) return null;
      const uses=cs.map(c=>{ const ing=(c.ingredients||[]).find(x=>cat[1].test(String(x).toLowerCase())); return ing?{cocktail:c,ingredient:ing}:null; }).filter(Boolean);
      return {item:i,category:cat[0],uses}; }).filter(Boolean); },
  /* Wine in their cocktails: a French 75 made with prosecco is a pour of ours if the prosecco is. */
  cocktailWines(){ const cs=TeamData.cocktails?TeamData.cocktails():[], out=[]; cs.forEach(c=>(c.ingredients||[]).forEach(x=>{ const call=this.CALLS.find(k=>new RegExp('\\b'+k.label.toLowerCase()+'\\b').test(String(x).toLowerCase())); if(!call) return;
      const wines=SellerCatalogue.wines().filter(i=>i.ml===750&&call.t(this.shape(i))).sort((a,b)=>a.price-b.price); if(wines.length) out.push({cocktail:c,ingredient:x,call,wines}); })); return out; },

  /* ---- the brief ---- */
  brief(){ const v=this.venue(), ours=this.ours(), opens=this.answered(), short=this.shortlist(), all=this.all(), fit=all.filter(f=>!f.out&&f.fills.some(o=>o.kind!=='house'));
    const next=o=>all.filter(f=>!f.out&&f.house&&f.house.id===o.wine.id);
    return {venue:v,agency:SellerCatalogue.agency(),ours:ours.map(o=>({...o,bottle:this._m(o.wine.bottle),x:this._m(o.wine.bottle)/o.item.price,next:next(o)})),openings:opens,answered:opens.filter(o=>o.wines.length).length,shortlist:short.map(f=>({...f,pitch:this.pitch(f)})),fits:fit.length,ruled:all.filter(f=>f.out).length,catalogue:all.length,
      multiple:{low:this.multipleAt(20).x,high:this.multipleAt(100).x,points:this._points().length,exact:this._points().filter(p=>p.exact).length},glassRatio:this.glassRatio(),backBar:this.backBar(),cocktailWines:this.cocktailWines()}; },
};
Object.assign(window,{SellerCatalogue,SellerMatch});
