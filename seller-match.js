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
  /* What the list has where a wine guests ask for by name would be: the same colour from the same country, or the
     same grape from somewhere else. */
  CALL_HOME:{rioja:['red','Spain'],amarone:['red','Italy'],port:['sweet',null],icewine:['sweet',null],provrose:['rosé',null],chard:['white',null],cab:['red',null],malbec:['red',null],nzsb:['white',null],pg:['white',null],pinot:['red',null],prosecco:['sparkling',null],champagne:['sparkling',null],barolo:['red','Italy']},
  CALL_GRAPE:{chard:'Chardonnay',cab:'Cabernet Sauvignon',malbec:'Malbec',nzsb:'Sauvignon Blanc',pg:'Pinot Grigio',pinot:'Pinot Noir'},
  _callFact(c,ws,S){ const M=n=>TeamData.money(Math.round(n)), h=this.CALL_HOME[c.k]||[], g=this.CALL_GRAPE[c.k], price=w=>this._m(w.bottle), span=xs=>{ const ps=xs.map(price).filter(Boolean); return ps.length?(Math.min(...ps)===Math.max(...ps)?M(ps[0]):`${M(Math.min(...ps))} to ${M(Math.max(...ps))}`):''; };
    if(g){ const same=ws.filter(w=>S(w).lead===g&&S(w).kind===h[0]); if(same.length) return `Their ${same.length} ${g}${same.length===1?' is':'s are'} from ${[...new Set(same.map(w=>w.country))].join(' and ')}, at ${span(same)}. A guest asking for ${this._a(c.label).toLowerCase()} ${c.label} has nothing to order.`; return `There is no ${g} of any kind on the list, and it's one guests ask for by name.`; }
    if(h[1]){ const same=ws.filter(w=>S(w).kind===h[0]&&w.country===h[1]); const regs=[...new Set(same.map(w=>S(w).region).filter(Boolean))]; if(same.length) return `They list ${same.length} ${h[1]==='Spain'?'Spanish':'Italian'} ${h[0]}s (${regs.slice(0,4).join(', ')}${regs.length>4?' and more':''}) at ${span(same)}, and no ${c.label}.`; }
    if(h[0]==='sweet'){ const sw=ws.filter(w=>['sweet','fortified'].includes(S(w).kind)); return sw.length?`Their only sweet wine is ${sw.map(w=>TeamData.nick(w)).join(', ')}${sw[0].glass?` at ${sw[0].glass} a glass`:''}. There is no ${c.label}.`:`There is nothing sweet or fortified on the list, and no ${c.label}.`; }
    if(h[0]){ const same=ws.filter(w=>S(w).kind===h[0]); if(same.length) return `Their ${same.length} ${h[0]==='rosé'?'rosés':h[0]+' wines'} are from ${[...new Set(same.map(w=>S(w).region||w.country))].slice(0,4).join(', ')}, at ${span(same)}. None is ${this._a(c.label).toLowerCase()} ${c.label}.`; }
    return `Guests ask for ${c.label} by name, and there isn't one on the list.`; },
  openings(){ if(this._open&&this._openFor===TeamData.get()) return this._open;
    const out=[], M=n=>TeamData.money(Math.round(n)), ws=this.list(), sh=new Map(ws.map(w=>[w.id,this.shape(w)])), S=w=>sh.get(w.id), bottles=ws.filter(w=>this._m(w.bottle)), pours=ws.filter(TeamData.byGlass);
    const med=xs=>{ const s=[...xs].sort((a,b)=>a-b); return s.length?s[Math.floor(s.length/2)]:0; }, nick=w=>TeamData.nick(w), home=this.home();
    // 1. A gap in a colour's prices: the next bottle up costs half as much again or more.
    TeamBuyer.ladder().forEach(l=>l.gaps.forEach(g=>out.push({k:'ladder:'+l.colour+':'+g.from.p,kind:'ladder',pts:16,tag:'Price gap',colour:l.colour,lo:g.from.p,hi:g.to.p,
      title:`${l.colour}: nothing between ${M(g.from.p)} and ${M(g.to.p)}`,fact:`Their ${l.colour.toLowerCase()} list steps from ${nick(g.from.w)} at ${M(g.from.p)} straight to ${nick(g.to.w)} at ${M(g.to.p)}. A guest who won't go that far has nowhere to land.`,basis:'list'})));
    // 2. Wines guests ask for by name.
    this.CALLS.forEach(c=>{ const has=ws.filter(w=>c.t(S(w))), col=has[0]?S(has[0]).colour:null, ps=has.map(w=>this._m(w.bottle)).filter(Boolean), cheapest=ps.length?Math.min(...ps):null;
      const lane=col?med(bottles.filter(w=>S(w).colour===col).map(w=>this._m(w.bottle))):0;
      if(!has.length) out.push({k:'call:'+c.k,kind:'call',pts:18,tag:'Missing',call:c,title:`No ${c.label} on the list`,fact:`${this._callFact(c,ws,S)}`,basis:'list'});
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
  PAIR_GAP:1, ACID_GAP:1,
  suits(i){ const sh=this.shape(i), st=sh.style; if(!st) return [];
    return TeamData.dishes().map(d=>{ const pr=TeamData.pairing(d.id)||{}, dessert=/dessert|pudding|sweet/i.test(d.section||'');
      if(dessert){ const darkish=/chocolate|coffee|caramel|toffee|nut/i.test([d.name,d.desc,d.main,(d.flav||[]).join(' ')].join(' '));
        if(sh.kind==='fortified'&&darkish) return {dish:d,gap:0,rule:'dark'}; if(sh.kind==='sweet'&&!darkish&&st.acid>=4) return {dish:d,gap:0,rule:'fruit'}; return null; }
      if(['sweet','fortified'].includes(sh.kind)) return null;
      const picks=[...(pr.best||[]).map(b=>b.id),pr.glass&&pr.glass.id].filter(Boolean).map(id=>TeamData.wine(id)).filter(Boolean); let best=null;
      picks.forEach(w=>{ const ps=this.shape(w); if(ps.kind!==sh.kind||!ps.style) return; const gap=Math.abs(st.body-ps.style.body)+Math.abs((st.tannin||0)-(ps.style.tannin||0))+Math.abs((st.sweet||0)-(ps.style.sweet||0)); if(Math.abs((st.acid||3)-(ps.style.acid||3))>this.ACID_GAP) return; if(!best||gap<best.gap) best={dish:d,gap,like:w}; });
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
      if(o.kind==='ladder'&&std&&sh.colour===o.colour&&L.bottle>o.lo*1.08&&L.bottle<o.hi*0.92) add(o.pts,o.title,'estimate',o);
      if(o.kind==='call'&&o.call.t(sh)&&(std||sweet)){ if(!o.under) add(o.pts,o.title,'sheet',o); else if(L.bottle<o.under*0.85) add(o.pts,o.title,'estimate',o); }
      if(o.kind==='glass'&&o.t(sh)&&(std||sweet)){ const g=sweet?null:L.glass, again=fills.some(x=>x.kind==='glass'); if(sweet||(g<=o.room&&g>=o.floor*0.9)) add(again?o.pts/2:o.pts,o.title,sweet?'sheet':'estimate',o); }
      if(o.kind==='dish'&&o.t(sh)) add(o.pts,o.title,'sheet',o);
      if(o.kind==='window'&&std){ const ws=this.shape(o.wine), p=this._m(o.wine.bottle); if(ws.kind===sh.kind&&ws.style&&sh.style){ const gap=Math.abs(sh.style.body-ws.style.body)+Math.abs((sh.style.tannin||0)-(ws.style.tannin||0))+Math.abs((sh.style.sweet||0)-(ws.style.sweet||0));
        const like=(ws.lead&&ws.lead===sh.lead)||(ws.region&&ws.region===sh.region)||gap===0;
        if(gap<=1&&like&&Math.abs((sh.style.acid||0)-(ws.style.acid||0))<=1&&L.bottle>=p*0.7&&L.bottle<=p*1.3) add(o.pts+(/long|1\d|2\d|3\d/i.test(i.ageing||'')?4:0),o.title,'estimate',o); } }
      if(o.kind==='mix'&&std&&sh.country===o.country&&sh.region===o.region&&sh.colour===o.colour) add(o.pts,o.title,'sheet',o);
      if(o.kind==='format'&&i.ml>=1500) add(o.pts,o.title,'sheet',o);
    });
    if(L.lifted) add(4,`Earns ${L.x.toFixed(1)}× at their entry price; their usual is ${L.usualX.toFixed(1)}×`,'estimate');
    // A house they already buy: the conversation is half had.
    const house=this.houseOn(i), mine=house&&this.ours().find(o=>o.wine.id===house.id);
    if(house) add(mine?16:12,`Same house as ${TeamData.short(house)}, already on their list`,'list',{k:'house:'+this._tokens(i.producer)[0],kind:'house',pts:mine?16:12,tag:'Relationship',wine:house,title:`${i.supplier||i.producer} is already on the list`});
    // The dishes it would be suggested with.
    const savoury=suits.filter(s=>!s.rule); if(savoury.length) add(Math.min(12,savoury.length*3),`${savoury.length} dish${savoury.length===1?'':'es'} on the menu`,'estimate');
    if(suits.some(s=>s.rule==='fruit')) add(4,`A sweet pour for ${suits.filter(s=>s.rule==='fruit').map(s=>s.dish.name).join(' and ')}`,'estimate');
    // What counts against it.
    const same=this.list().filter(w=>{ const s=this.shape(w); return s.kind===sh.kind&&sh.lead&&s.lead===sh.lead&&(s.region&&sh.region?s.region===sh.region:s.country===sh.country); }), near=same.filter(w=>{ const p=this._m(w.bottle); return p&&Math.abs(p-L.bottle)/L.bottle<=this.DUP_NEAR; });
    if(near.length) add(-18,`Doubles up on ${nick(near[0])} (${M(this._m(near[0].bottle))})`,'list');
    else if(same.length&&!fills.some(o=>['ladder','glass','call','mix'].includes(o.kind))) add(-6,`${sh.lead} from ${sh.region||sh.country} is already listed`,'list');
    if(std&&!sweet&&!fills.some(o=>['call','glass','dish'].includes(o.kind))){ const pile=L.lane.filter(y=>Math.abs(y.p-L.bottle)/L.bottle<=0.08); if(pile.length>=3) add(-6,`Crowded price: ${pile.length} bottles near ${M(L.bottle)}`,'estimate'); }
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
  N:8, PER_HOUSE:2, PER_OPEN:1,
  shortlist(n=this.N){ const picked=[], house={}, open={};
    this.all().filter(f=>!f.out&&f.fills.length&&f.score>=this.SHOW-10).forEach(f=>{ if(picked.length>=n) return; const h=f.item.supplier||f.item.producer, first=f.fills.find(o=>o.kind!=='house')||f.fills[0];
      if((house[h]||0)>=this.PER_HOUSE||(open[first.k]||0)>=this.PER_OPEN) return; if(picked.some(p=>p.item.producer===f.item.producer&&p.item.name===f.item.name)) return; if(picked.some(p=>(p.item.supplier||p.item.producer)===h&&p.primary.k===first.k)) return; // one house answers an opening once
      house[h]=(house[h]||0)+1; open[first.k]=(open[first.k]||0)+1; picked.push({...f,primary:first}); });
    return picked; },
  /* Each opening with the catalogue wines that fill it, best first: what the visit can answer, and what it can't. */
  answered(opt){ const all=this.all().filter(f=>!f.out), M=n=>TeamData.money(Math.round(n)), list=this.list();
    return this.openings().map(o=>{ const wines=all.filter(f=>f.fills.some(x=>x.k===o.k)), top=wines[0], facts=[];
      if(top){ const st=top.shape.style, sweet=['sweet','fortified'].includes(top.shape.kind);
        // What a guest is handed today instead: the wine on their list nearest the one we'd bring.
        if(['call','mix','dish'].includes(o.kind)&&st){ const near=list.filter(w=>{ const s=this.shape(w); return s.style&&(s.kind===top.shape.kind||(sweet&&['sweet','fortified'].includes(s.kind))); }).map(w=>{ const s=this.shape(w); return {w,s,gap:Math.abs(st.body-s.style.body)+Math.abs((st.tannin||0)-(s.style.tannin||0))+Math.abs((st.sweet||0)-(s.style.sweet||0))-(s.country===top.shape.country?1.5:0)-(top.shape.lead&&s.lead===top.shape.lead?6:0)}; }).filter(x=>x.w.bottle||x.w.glass).sort((a,b)=>a.gap-b.gap||this._m(a.w.bottle)-this._m(b.w.bottle))[0];
          if(near) facts.push({label:'Closest today',text:`${TeamData.short(near.w)} (${[near.s.lead,near.s.region].filter(Boolean).join(', ')})${near.w.bottle?` at ${near.w.bottle}`:near.w.glass?` at ${near.w.glass} a glass`:''}`}); }
        if(o.kind==='glass'){ const pours=list.filter(TeamData.byGlass).filter(w=>o.sweet?['sweet','fortified'].includes(this.shape(w).kind):o.k==='glass:fizz'?this.shape(w).kind==='sparkling':true); facts.push({label:o.k==='glass:local'?'Poured today':'Poured today',text:pours.slice(0,6).map(w=>`${TeamData.nick(w)} ${w.glass}`).join(', ')+(pours.length>6?` and ${pours.length-6} more`:'')}); }
        const ps=wines.filter(f=>!['sweet','fortified'].includes(f.shape.kind)).map(f=>f.landing.bottle); facts.push({label:'We have',text:`${wines.length} ${wines.length===1?'bottle':'bottles'}${ps.length?`, landing ${ps.length>1&&Math.min(...ps)!==Math.max(...ps)?`${M(Math.min(...ps))} to ${M(Math.max(...ps))}`:`at about ${M(ps[0])}`} on their list`:', poured by the 2oz glass'}`});
        if(top.suits.length) facts.push({label:'Pours with',text:top.suits.slice(0,5).map(s=>s.dish.name).join(', ')+(top.suits.length>5?` and ${top.suits.length-5} more`:'')}); }
      const said=opt&&opt.plain?null:((this.written()||{}).openings||{})[o.k];
      return {...o,engineFact:o.fact,fact:said||o.fact,wines,facts}; }).filter(o=>o.wines.length||o.kind!=='mix').sort((a,b)=>(b.wines.length?1:0)-(a.wines.length?1:0)||b.pts-a.pts); },

  /* ---- how to talk about a wine ---- */
  WORDS:{body:['light','light','medium-bodied','full-bodied','very full'],acid:['soft','soft','balanced','fresh','crisp'],tannin:['no tannin','silky','soft tannin','medium tannin','firm tannin','grippy tannin']},
  styleWords(i){ const st=i.style; if(!st) return ''; const red=['red','fortified'].includes(i.type); return [this.WORDS.body[Math.max(0,st.body-1)],this.WORDS.acid[Math.max(0,st.acid-1)],red?this.WORDS.tannin[st.tannin]:null,st.sweet>=4?'sweet':st.sweet>=2?'off-dry':'dry'].filter(Boolean).join(', '); },
  grapeLine(i){ if(!i.grapes.length) return ''; return i.shares?i.grapes.map(g=>i.shares[g]?`${g} ${i.shares[g]}%`:g).join(', '):i.grapes.join(', '); },
  placeLine(i){ return [i.appellation||i.sub||i.region,i.appellation&&i.region&&i.appellation!==i.region?i.region:null,i.country].filter(Boolean).filter((x,k,a)=>a.indexOf(x)===k).join(', '); },
  sentences(text,n=1){ const out=String(text||'').split(/(?<=[.!?])\s+/).filter(s=>s.length>8).slice(0,n).join(' '); return out.length>320?out.slice(0,317).replace(/\s+\S*$/,'')+'…':out; },
  /* One line that says what the wine is, for anyone, whatever the restaurant. */
  /* A sentence someone could say out loud: what kind of wine, where from, what it tastes of. Never the blend's
     percentages or a row of style figures: those have their own lines (talk's The blend, the taste profile). */
  NAMED:[[/amarone|amaron\b/,'Amarone'],[/barolo/,'Barolo'],[/valpolicella/,'Valpolicella'],[/rioja/,'Rioja'],[/\bgavi\b/,'Gavi'],[/cotes? du rhone/,'Côtes du Rhône'],[/prosecco|valdobbia/,'Prosecco'],[/icewine|ice wine/,'icewine']],
  kindWord(i){ const sh=this.shape(i), t=sh.text, pink=/ros[eé]|pink/i.test(i.name), named=(this.NAMED.find(([re])=>re.test(t))||[])[1];
    if(i.kind!=='wine') return String(i.family||'spirit').toLowerCase();
    if(sh.kind==='fortified') return /port/.test(t)?(/tawny/i.test(i.notes.taste)||i.flavours.some(x=>/toffee|walnut|nut/.test(x))?'tawny port':'port'):'fortified wine';
    if(sh.kind==='sparkling') return sh.region==='Champagne'?(pink?'rosé Champagne':'Champagne'):named==='Prosecco'?'Prosecco':/traditionnelle|traditional|classico/.test(t)?'traditional-method sparkling wine':pink?'sparkling rosé':'sparkling wine';
    if(named) return sh.kind==='white'&&['Côtes du Rhône','Rioja'].includes(named)?`white ${named}`:named;
    if(sh.kind==='rosé') return 'rosé';
    if(sh.grapes.length===1||(i.shares&&i.shares[i.grapes[0]]>=85)) { const own=i.grapes[0]||sh.lead; return sh.kind==='red'||sh.kind==='white'?own:`${own} ${sh.kind}`; }
    return sh.lead?`${sh.lead}-led ${sh.kind} blend`:`${sh.kind} wine`; },
  about(i){ const sh=this.shape(i), st=i.style||{}, what=this.kindWord(i), red=['red','fortified'].includes(sh.kind);
    const adj=[st.sweet>=4?'sweet':st.sweet>=2&&sh.kind!=='sparkling'?'off-dry':null, st.body>=5?'rich':st.body===4?'full-bodied':st.body<=2?(sh.kind==='sparkling'?'crisp':'light'):null, red&&sh.kind==='red'?(st.tannin>=4?'firm':st.tannin<=2?'soft':null):(!red&&st.acid>=4&&st.body>2?'fresh':!red&&st.acid>=4&&st.body<=2&&sh.kind!=='sparkling'?'crisp':null)].filter(Boolean).slice(0,2);
    const lead=(adj.length?adj.join(', ')+' ':'')+what;
    const where=(()=>{ const p=i.appellation||i.sub||i.region, n=this._norm(p); if(!p) return i.country; return this._norm(what).includes(n)||n.includes(this._norm(what))?[i.region&&this._norm(i.region)!==n?i.region:null,i.country].filter(Boolean).join(', '):[p,this._norm(p).includes(this._norm(i.country))?null:i.country].filter(Boolean).join(', '); })();
    const fl=i.flavours.slice(0,3), taste=fl.length?`, with ${fl.length>1?fl.slice(0,-1).join(', ')+' and '+fl[fl.length-1]:fl[0]}`:'';
    return `${this._a(lead)} ${lead} from ${/^(Douro|Rhône Valley|Niagara Peninsula|Valle Central|Peloponnese)$/.test(where.split(',')[0])?'the ':''}${where}${taste}.`; },
  /* What a seller can say about a wine before any restaurant comes into it: each line with where it comes from
     (the product sheet, Vinterest's checked grape and region notes, or an estimate). */
  talk(i){ const out=[], K=typeof KNOWLEDGE!=='undefined'?KNOWLEDGE:{grapes:{},regions:{}}, sh=this.shape(i), add=(label,text,basis)=>{ if(text) out.push({label,text,basis}); };
    if(i.kind==='wine') add('In a sentence',this.about(i),'estimate');
    add('How it tastes',this.sentences(i.notes.taste,3),'sheet');
    if(i.kind==='wine'&&i.grapes.length>1) add('The blend',this.grapeLine(i)+'.',i.basis.grapes==='sheet'?'sheet':'estimate');
    const G=sh.lead&&K.grapes[sh.lead]; if(G) add(`The grape: ${sh.lead}`,`${G.profile}.${G.climate?' '+G.climate+'.':''}`,'guide');
    const R=sh.region&&K.regions[sh.region]; if(R) add(`The place: ${sh.region}`,[R.climate&&R.climate+'.',R.classification&&`Classification: ${R.classification}.`,R.agingRules&&/reserva|riserva|crianza|barolo|amarone/i.test(i.name+' '+i.appellation)?R.agingRules:null].filter(Boolean).join(' '),'guide');
    add('How it is made',this.sentences(i.notes.made,2),'sheet');
    add('In the vineyard',this.sentences(i.notes.vines,2),'sheet');
    add('The house',this.sentences(i.house,2),'sheet');
    const still=['red','white','rosé'].includes(i.type); // the grape's own notes are about still wine: not said of a sparkling, sweet or fortified one
    add('With food',this.sentences(i.notes.food,2)||(G&&G.food&&still?G.food+'.':''),i.notes.food?'sheet':'guide');
    if(i.certs.length) add('Worth mentioning',i.certs.join(', ')+'.','sheet');
    if(i.ageing) add('Keeping',/\d/.test(i.ageing)?`Ageing potential: ${i.ageing}.`:`${i.ageing}.`,'sheet'); else if(G&&G.ageing&&still) add('Keeping',G.ageing+'.','guide');
    if(i.temp) add('Serve',`At about ${i.temp}°C.`,'sheet');
    return out; },
  /* The other sizes and years of the same wine in the catalogue. */
  siblings(i){ return SellerCatalogue.items().filter(x=>x.id!==i.id&&x.producer===i.producer&&this._norm(x.name)===this._norm(i.name)); },

  /* ---- the written brief ---- */
  /* The words of a pitch are written, never assembled: a sentence built by filling a wine's name into a phrase reads
     the same for every bottle, and a rep can hear it. data/seller-brief-eloise.json is the brief written for this
     restaurant (for the prototype by hand, against the figures below; Vinny writes it per prospect once that call
     exists): what to say about each opening, and for each shortlisted bottle one thing to say, the pitch, a line
     for every dish it suits and what the buyer will say back. This module supplies only facts and figures. A written
     bottle carries the figures it was written `against`; if matching now lands it somewhere else, its words are
     held back rather than shown beside different numbers. A bottle nobody has written about shows its facts alone. */
  /* Who wrote the words: by hand (the file, for Eloise) or Vinny (seller-vinny.js: written this visit, or a brief
     the script saved). `pick` chooses when both exist; otherwise whichever there is. */
  _pick:null,
  briefs(){ const v=this.venue().name, hand=_loadJSON('data/seller-brief-eloise.json'), held=typeof SellerVinny!=='undefined'?SellerVinny.held():null, saved=_loadJSON('data/seller-brief-eloise-vinny.json'); return {hand:hand&&hand.venue===v?hand:null,vinny:held||(saved&&saved.venue===v?saved:null)}; },
  pick(k){ this._pick=k||null; try{ window.dispatchEvent(new CustomEvent('vinterest:seller-brief')); }catch(e){} },
  writer(){ const b=this.briefs(); return this._pick&&b[this._pick]?this._pick:b.hand?'hand':b.vinny?'vinny':null; },
  written(){ const k=this.writer(); return k?this.briefs()[k]:null; },
  writtenFor(f){ const w=this.written(), b=w&&w.bottles[f.item.id]; if(!b) return null; const a=b.against||{}, L=f.landing, m=this.maths(f);
    if(a.bottle!=null&&a.bottle!==L.bottle) return null; if(a.glass!=null&&a.glass!==L.glass) return null; if(a.pourCost!=null&&Math.abs(a.pourCost-(m.pourCost||0))>0.005) return null; return b; },
  POURS:5,
  maths(f){ const i=f.item, L=f.landing, cost=SellerCatalogue.caseCost(i), sweet=['sweet','fortified'].includes(f.shape.kind), pours2=Math.floor(i.ml/59);
    if(sweet) return {cost,units:i.ucs,sweet:true,pours:pours2,pourCost:i.price/pours2};
    const glass=f.fills.some(o=>o.kind==='glass'), pourCost=i.ml===750?i.price/this.POURS:null;
    return {cost,units:i.ucs,by:glass?'glass':'bottle',bottleTake:i.ucs*L.bottle,glassTake:L.glass?i.ucs*this.POURS*L.glass:null,take:glass?i.ucs*this.POURS*L.glass:i.ucs*L.bottle,pours:i.ucs*this.POURS,pourCost,perBottle:L.bottle-i.price}; },
  first(text){ return this.sentences(text,1); },
  /* One bottle at this restaurant: its figures always, and its words where they have been written. */
  pitch(f){ const W=this.writtenFor(f), p=f.primary||f.fills.find(o=>o.kind!=='house')||f.fills[0];
    const pairings=f.suits.map(s=>({dish:s.dish,why:W&&W.dishes?W.dishes[s.dish.id]||null:null,like:s.like||null,likePrice:s.like?this._m(s.like.bottle):null}));
    return {written:!!W,say:W?W.say:null,story:W?W.story:[],pairings,objections:W?W.objections:[],maths:this.maths(f),primary:p}; },

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
  /* ---- what to bring ---- */
  /* The bottles to carry into the meeting for tasting: every wine with a place on their list whose fit is at least
     `min`, best first, one bottle per wine (a magnum or half is tasted from its 750ml where the catalogue has one).
     Each says what it is there to answer, whether it needs chilling, and whether the agency has it to hand. */
  BRING_STEPS:[70,60,50,40,0], BRING_DEFAULT:55,
  CHILL:{sparkling:'Chill well',white:'Chill',rosé:'Chill',sweet:'Chill',fortified:'Cool',red:'No chilling'},
  bring(min=this.BRING_DEFAULT){ const short=new Set(this.shortlist().map(f=>f.item.id)), seen=new Set(), rows=[];
    this.all().filter(f=>!f.out&&f.fills.some(o=>o.kind!=='house')).forEach(f=>{ const i=f.item, key=this._norm(i.producer+' '+i.name); if(seen.has(key)) return; seen.add(key);
      const sample=i.ml===750?i:(this.siblings(i).find(x=>x.ml===750)||i), sup=SellerCatalogue.supply(sample);
      rows.push({f,item:i,sample,score:f.score,word:f.word,shortlisted:short.has(i.id),answers:f.fills.filter(o=>o.kind!=='house').map(o=>o.title),chill:this.CHILL[f.shape.kind]||'No chilling',cold:!['red'].includes(f.shape.kind),temp:sample.temp||null,supply:sup,toHand:sup.k==='now'}); });
    const list=rows.filter(r=>r.score>=min);
    return {min,rows:list,all:rows,counts:Object.fromEntries(this.BRING_STEPS.map(t=>[t,rows.filter(r=>r.score>=t).length])),cold:list.filter(r=>r.cold).length,cost:list.reduce((a,r)=>a+r.sample.price,0),missing:list.filter(r=>!r.toHand)}; },
  /* One bottle with its fit and pitch, for the wine card. */
  card(id){ const f=this.all().find(x=>x.item.id===id); if(!f) return null; const short=this.shortlist().find(x=>x.item.id===id); return f.out?{...f,pitch:null}:{...f,primary:short?short.primary:undefined,pitch:this.pitch(short||f)}; },
};
Object.assign(window,{SellerCatalogue,SellerMatch});
