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
  N:8, PER_HOUSE:2, PER_OPEN:1,
  shortlist(n=this.N){ const picked=[], house={}, open={};
    this.all().filter(f=>!f.out&&f.fills.length&&f.score>=this.SHOW-10).forEach(f=>{ if(picked.length>=n) return; const h=f.item.supplier||f.item.producer, first=f.fills.find(o=>o.kind!=='house')||f.fills[0];
      if((house[h]||0)>=this.PER_HOUSE||(open[first.k]||0)>=this.PER_OPEN) return; if(picked.some(p=>p.item.producer===f.item.producer&&p.item.name===f.item.name)) return; if(picked.some(p=>(p.item.supplier||p.item.producer)===h&&p.primary.k===first.k)) return; // one house answers an opening once
      house[h]=(house[h]||0)+1; open[first.k]=(open[first.k]||0)+1; picked.push({...f,primary:first}); });
    return picked; },
  /* Each opening with the catalogue wines that fill it, best first: what the visit can answer, and what it can't. */
  answered(){ const all=this.all().filter(f=>!f.out), M=n=>TeamData.money(Math.round(n)), list=this.list();
    return this.openings().map(o=>{ const wines=all.filter(f=>f.fills.some(x=>x.k===o.k)), top=wines[0], facts=[];
      if(top){ const st=top.shape.style, sweet=['sweet','fortified'].includes(top.shape.kind);
        // What a guest is handed today instead: the wine on their list nearest the one we'd bring.
        if(['call','mix','dish'].includes(o.kind)&&st){ const near=list.filter(w=>{ const s=this.shape(w); return s.style&&(s.kind===top.shape.kind||(sweet&&['sweet','fortified'].includes(s.kind))); }).map(w=>{ const s=this.shape(w); return {w,s,gap:Math.abs(st.body-s.style.body)+Math.abs((st.tannin||0)-(s.style.tannin||0))+Math.abs((st.sweet||0)-(s.style.sweet||0))-(s.country===top.shape.country?1.5:0)-(top.shape.lead&&s.lead===top.shape.lead?6:0)}; }).filter(x=>x.w.bottle||x.w.glass).sort((a,b)=>a.gap-b.gap||this._m(a.w.bottle)-this._m(b.w.bottle))[0];
          if(near) facts.push({label:'Closest today',text:`${TeamData.short(near.w)} (${[near.s.lead,near.s.region].filter(Boolean).join(', ')})${near.w.bottle?` at ${near.w.bottle}`:near.w.glass?` at ${near.w.glass} a glass`:''}`}); }
        if(o.kind==='glass'){ const pours=list.filter(TeamData.byGlass).filter(w=>o.sweet?['sweet','fortified'].includes(this.shape(w).kind):o.k==='glass:fizz'?this.shape(w).kind==='sparkling':true); facts.push({label:o.k==='glass:local'?'Poured today':'Poured today',text:pours.slice(0,6).map(w=>`${TeamData.nick(w)} ${w.glass}`).join(', ')+(pours.length>6?` and ${pours.length-6} more`:'')}); }
        const ps=wines.filter(f=>!['sweet','fortified'].includes(f.shape.kind)).map(f=>f.landing.bottle); facts.push({label:'We have',text:`${wines.length} ${wines.length===1?'bottle':'bottles'}${ps.length?`, landing ${ps.length>1&&Math.min(...ps)!==Math.max(...ps)?`${M(Math.min(...ps))} to ${M(Math.max(...ps))}`:`at about ${M(ps[0])}`} on their list`:', poured by the 2oz glass'}`});
        if(top.suits.length) facts.push({label:'Pours with',text:top.suits.slice(0,5).map(s=>s.dish.name).join(', ')+(top.suits.length>5?` and ${top.suits.length-5} more`:'')}); }
      return {...o,wines,facts}; }).filter(o=>o.wines.length||o.kind!=='mix').sort((a,b)=>(b.wines.length?1:0)-(a.wines.length?1:0)||b.pts-a.pts); },

  /* ---- how to talk about a wine ---- */
  WORDS:{body:['light','light','medium-bodied','full-bodied','very full'],acid:['soft','soft','balanced','fresh','crisp'],tannin:['no tannin','silky','soft tannin','medium tannin','firm tannin','grippy tannin']},
  styleWords(i){ const st=i.style; if(!st) return ''; const red=['red','fortified'].includes(i.type); return [this.WORDS.body[Math.max(0,st.body-1)],this.WORDS.acid[Math.max(0,st.acid-1)],red?this.WORDS.tannin[st.tannin]:null,st.sweet>=4?'sweet':st.sweet>=2?'off-dry':'dry'].filter(Boolean).join(', '); },
  grapeLine(i){ if(!i.grapes.length) return ''; return i.shares?i.grapes.map(g=>i.shares[g]?`${g} ${i.shares[g]}%`:g).join(', '):i.grapes.join(', '); },
  placeLine(i){ return [i.appellation||i.sub||i.region,i.appellation&&i.region&&i.appellation!==i.region?i.region:null,i.country].filter(Boolean).filter((x,k,a)=>a.indexOf(x)===k).join(', '); },
  sentences(text,n=1){ const out=String(text||'').split(/(?<=[.!?])\s+/).filter(s=>s.length>8).slice(0,n).join(' '); return out.length>320?out.slice(0,317).replace(/\s+\S*$/,'')+'…':out; },
  /* One line that says what the wine is, for anyone, whatever the restaurant. */
  about(i){ const g=this.grapeLine(i), fl=i.flavours.length?i.flavours.join(', '):''; return `${g?g+' from ':'From '}${this.placeLine(i)}. ${this.styleWords(i).replace(/^./,c=>c.toUpperCase())}${fl?`: ${fl}`:''}.`; },
  /* What a seller can say about a wine before any restaurant comes into it: each line with where it comes from
     (the product sheet, Vinterest's checked grape and region notes, or an estimate). */
  talk(i){ const out=[], K=typeof KNOWLEDGE!=='undefined'?KNOWLEDGE:{grapes:{},regions:{}}, sh=this.shape(i), add=(label,text,basis)=>{ if(text) out.push({label,text,basis}); };
    if(i.kind==='wine') add('In a sentence',this.about(i),i.basis.flavours==='sheet'&&i.basis.grapes==='sheet'?'estimate':'estimate');
    add('How it tastes',this.sentences(i.notes.taste,3),'sheet');
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

  /* ---- why a wine suits a dish, in words a rep can say ---- */
  ECHO:[[/mushroom|earthy|truffle/,/earth|forest|leather|tobacco|balsamic|resin/,'earthiness'],[/charcoal|grill|smok|roast/,/oak|toast|smok|spice|cocoa|mocha|cedar|vanilla|liquorice|pepper/,'char'],[/butter|squash|nutty|brown|sage|parmesan|caesar/,/butter|brioche|almond|hazelnut|nut|toast|vanilla|honey/,'nutty, buttery side'],[/herb|parsley|rosemary|thyme|dill|chive|basil/,/herb|grass|thyme|garrigue|green pepper/,'herbs'],[/citrus|lemon|lime|vinaigrette|caper|tomato/,/lemon|lime|citrus|grapefruit|zest/,'citrus'],[/chilli|chili|spic|'nduja|pepper/,/peach|apricot|pineapple|passion|pear|ripe/,'heat']],
  pairWhy(i,s){ const d=s.dish, sh=this.shape(i), st=sh.style, f=new Set(d.flav||[]), t=[d.name,d.desc,d.main,d.cook,(d.flav||[]).join(' ')].join(' ').toLowerCase(), main=/lettuce|greens/.test(d.main||'')||!d.main?(/salad/i.test(d.name)?'salad':d.name.toLowerCase()):d.main, out=[], fl2=i.flavours.map(x=>x.replace(/^ripe /,'')), bit=String(d.desc||'').split(/[,.]/)[0].trim().toLowerCase(), plate=bit&&bit.length<34&&!/serves/.test(bit)?`${main} with ${bit}`:main;
    const rich=f.has('rich')||f.has('creamy'), richWord=f.has('creamy')?'creaminess':'richness', beef=/beef|steak|boeuf|cheek/.test(t);
    if(s.rule==='dark') out.push(`It is sweeter than the dessert, which matters: a wine less sweet than the dish tastes sour beside it. Its ${i.flavours.slice(-2).join(' and ')} sit naturally with ${/coffee/.test(t)?'coffee and caramel':'dark chocolate'}`);
    else if(s.rule==='fruit') out.push(`Sweet enough for the dessert, with the acidity to stay fresh against the ${/citrus/.test(t)?'citrus':'fruit'} where a softer sweet wine would cloy`);
    else if(sh.kind==='sparkling'){ if(rich||f.has('salty')) out.push(`The bubbles and high acidity clean the palate after the ${rich?richWord:'salt'} of the ${plate}, so the next bite tastes like the first`); if(f.has('delicate')) out.push(`it is light enough that the ${main} still leads`); else if(f.has('earthy')) out.push(`the toasty note from its time on the lees meets the ${main}'s savoury depth`); if(!out.length) out.push(`Freshness and bubbles lift the ${main} without adding weight`); }
    else if(sh.kind==='white'||sh.kind==='orange'){ if(st.acid>=4&&rich) out.push(`Its acidity cuts through the ${richWord} of the ${plate}`); else if(st.body>=3&&(rich||f.has('nutty')||f.has('sweet'))) out.push(`It has the weight to stand beside the ${f.has('nutty')?'nutty, sweet':richWord==='creaminess'?'creamy':'rich'} ${main} without being flattened`);
      if(f.has('acidic')&&st.acid>=4) out.push(`it has the acidity to match the dish's own sharpness, so the wine doesn't taste flat`); if(f.has('delicate')&&st.body<=3) out.push(`it won't cover the ${main}`); if(f.has('salty')&&!out.length) out.push(`Its fruit and freshness play against the salt`); if(f.has('spicy')&&st.sweet>=2) out.push(`a touch of sweetness takes the edge off the heat`);
      if(!out.length) out.push(`${st.body<=2?'Light and fresh':'Round'} enough to sit with the ${main} rather than over it`); }
    else if(sh.kind==='rosé'){ out.push(`Dry and fresh, with enough fruit to meet the ${plate} and not enough weight to cover it`); if(f.has('spicy')) out.push(`served cold it cools the heat`); }
    else { if(st.tannin>=4&&(beef||f.has('rich'))) out.push(`Its firm tannin binds to the fat and protein of the ${plate}, so the wine tastes smoother and the meat richer`); else if(st.tannin===3&&(beef||rich)) out.push(`It has enough tannin for the ${plate} without drying it out`); else if(st.tannin<=2) out.push(`Soft tannin and bright acidity lift the ${plate} where a heavier red would flatten it`);
      if(/brais|slow|ragu|cheek/.test(t)&&st.acid>=3) out.push(`its acidity keeps a slow-cooked dish from feeling heavy`); if(!out.length) out.push(`Its weight matches the ${main}`); }
    const echo=this.ECHO.find(([dr,wr,what])=>dr.test(what==='char'?String(d.cook||'')+(/charcoal/.test(t)?' charcoal':''):what==='heat'?(f.has('spicy')?'spic':''):t)&&fl2.some(x=>wr.test(x))); if(echo&&!s.rule){ const hits=fl2.filter(x=>echo[1].test(x)).slice(0,2), fl=hits.join(' and '), v=hits.length>1?'pick':'picks'; out.push(echo[2]==='heat'?`its ripe ${fl} ${hits.length>1?'soften':'softens'} the heat`:`its ${fl} ${v} up the ${echo[2]==='char'?'char from the grill':echo[2]==='nutty, buttery side'?`${main}'s nutty, buttery side`:echo[2]==='earthiness'?`earthiness of the ${main}`:`${echo[2]} in the dish`}`); }
    if(out.length<2&&!s.rule&&fl2.length>1) out.push(`${fl2.slice(0,2).join(' and ')} are the flavours a guest will notice beside it`);
    const why=out.slice(0,3).join('; ').replace(/^./,c=>c.toUpperCase())+'.';
    const pr=TeamData.pairing(d.id)||{}, theirs=s.like&&[...(pr.best||[]),pr.glass].filter(Boolean).find(b=>b.id===s.like.id);
    return {dish:d,why,like:s.like||null,likePrice:s.like?this._m(s.like.bottle):null,theirWhy:theirs?theirs.why:null}; },

  /* ---- the pitch for one bottle ---- */
  POURS:5,
  /* What each kind of wine has going for it with a buyer, and what a buyer says back. Trade knowledge, written once
     and checked; `t` picks the wines it applies to. {{…}} are filled from the bottle and the restaurant's list. */
  ANGLES:[
    {k:'port',t:s=>s.kind==='fortified',sell:`A tawny has already spent years in wood, so once it's open it keeps for weeks rather than days. A slow night doesn't cost them a bottle, and a 750ml bottle is about twelve 2oz pours.`,
      obj:[[`"Nobody orders port."`,`Nobody is offered it. It needs one line on the dessert menu beside {{dish}} and one sentence from the server: "the tawny with that?" The pour costs them about {{pour2}}.`],[`"An open bottle will go off."`,`Not a tawny. It's aged in contact with air before bottling, which is why it holds for weeks once opened.`]]},
    {k:'icewine',t:s=>s.kind==='sweet'&&/icewine|ice wine/.test(s.text),sell:`Icewine is the Ontario wine visitors have heard of, made from grapes picked frozen on the vine. A half bottle is about six 2oz pours, so it's sold by the small glass, not the bottle.`,
      obj:[[`"It's too sweet for our guests."`,`It is sweet, with the acidity to carry it: that's what stops it cloying. Pour 2oz with {{dish}}, as a dessert in its own right.`],[`"It's expensive."`,`By the bottle, yes. By the 2oz pour it costs them about {{pour2}}.`]]},
    {k:'tradfizz',t:s=>s.kind==='sparkling'&&s.region!=='Champagne'&&/traditionnelle|traditional|classico|franciacorta|cremant|\bcava\b/.test(s.text),sell:`Traditional method means the second fermentation happens in the bottle, as in Champagne; Prosecco's happens in a tank. That's where the finer bubbles and the toasty, bready note come from, at a price well under Champagne.`,
      obj:[[`"Guests who want bubbles want Prosecco or Champagne."`,`They do, at {{theirGlass}} or from {{champFrom}} a bottle. This is for the guest in between: a proper sparkling by the glass at about {{glass}}, and the natural step up to their Champagne.`],[`"Will a sparkling keep once it's open?"`,`With a stopper, a day or two. A case here is only {{ucs}} bottles, and each is five glasses.`]]},
    {k:'champagne',t:s=>s.kind==='sparkling'&&s.region==='Champagne',sell:`A house guests know by name does the selling on a list: nobody needs it explained.`,obj:[[`"We already have Champagne."`,`They have {{sameCount}}, from {{sameFrom}}. This sits at about {{bottle}}.`]]},
    {k:'chard',t:s=>s.kind==='white'&&s.lead==='Chardonnay',sell:`Chardonnay is the white a guest orders without opening the list. Theirs are all from France and Italy, from {{sameFrom}}: a guest asking for "a Chardonnay" today is steered to a Chablis.`,
      obj:[[`"Our guests have moved on from big oaky Chardonnay."`,`Some have, and they have the Chablis. This is for the guest who asks for the round one by name: {{flav}}. Having both is the point.`]]},
    {k:'cab',t:s=>s.kind==='red'&&s.lead==='Cabernet Sauvignon'&&!['France','Italy'].includes(s.country),sell:`Cabernet with steak is the easiest sale on a grill menu, and a guest who asks for one usually means the riper, softer New World style, not Bordeaux.`,
      obj:[[`"We do Bordeaux for that."`,`Bordeaux is the same grape and a different wine: firmer, drier, more savoury. Their own New World Cabernets start at {{under}}, so the guest who asks has nothing to order.`]]},
    {k:'rioja',t:s=>s.kind==='red'&&s.region==='Rioja',sell:`A Reserva has been aged at least three years before release, one of them in oak, so it arrives ready: soft tannin, vanilla and leather, no decanting. It's the Spanish red guests ask for by name.`,
      obj:[[`"We already have Spanish reds."`,`They do: {{sameCountry}}. Those are lighter, modern wines for a guest who wants to explore. Rioja is for the one who wants what they know.`]]},
    {k:'amarone',t:s=>s.kind==='red'&&/amarone|amaron\b/.test(s.text),sell:`Amarone is made from grapes dried for about three months before pressing, which concentrates everything: it's dry, but tastes of dried cherry, cocoa and spice. It's a bottle a table orders for an occasion.`,
      obj:[[`"It's too big for most tables."`,`It is big, which is why it belongs with {{dish}} and not by the glass. Sell it as the bottle for the table sharing the largest cut.`],[`"We have Barolo and Brunello at that price."`,`Those are firm and savoury. Amarone is the rich, rounder one, for the guest who finds Barolo too dry.`]]},
    {k:'provrose',t:s=>s.kind==='rosé'&&s.region==='Provence',sell:`Provence is the rosé guests name, and this is one of its reference estates: pale, dry, more about texture than sweetness.`,
      obj:[[`"Rosé is a summer wine."`,`Their list carries four all year, and the 2023s are past their best. This replaces one; it doesn't add one.`]]},
    {k:'pinot',t:s=>s.kind==='red'&&s.lead==='Pinot Noir',sell:`Pinot Noir is the red for the table split between fish and meat: light enough for one, enough fruit for the other.`,obj:[[`"We have Burgundy."`,`From {{sameFrom}}. This is the fruit-forward one at a price a table says yes to without thinking.`]]},
    {k:'ontario',t:s=>s.country==='Canada',sell:`Estate-grown in Niagara, an hour and a half from the door. A local wine is something a server can talk about without any training.`,
      obj:[[`"Ontario wine at our prices?"`,`Their own list already has five Canadian wines from {{homeFrom}}, all by the bottle. This is the one a guest can try by the glass first.`]]},
  ],
  angle(i){ const s=this.shape(i); return this.ANGLES.filter(a=>a.t(s)); },
  maths(f){ const i=f.item, L=f.landing, cost=SellerCatalogue.caseCost(i), sweet=['sweet','fortified'].includes(f.shape.kind), pours2=Math.floor(i.ml/59);
    if(sweet) return {cost,units:i.ucs,sweet:true,pours:pours2,pourCost:i.price/pours2};
    const glass=f.fills.some(o=>o.kind==='glass'), pourCost=i.ml===750?i.price/this.POURS:null;
    return {cost,units:i.ucs,by:glass?'glass':'bottle',bottleTake:i.ucs*L.bottle,glassTake:L.glass?i.ucs*this.POURS*L.glass:null,take:glass?i.ucs*this.POURS*L.glass:i.ucs*L.bottle,pours:i.ucs*this.POURS,pourCost,perBottle:L.bottle-i.price}; },
  first(text){ return this.sentences(text,1); },
  pitch(f){ const i=f.item, L=f.landing, sh=f.shape, M=n=>TeamData.money(Math.round(n)), A=(n,dp=2)=>SellerCatalogue.money(n,dp), nick=w=>TeamData.nick(w), sweet=['sweet','fortified'].includes(sh.kind), std=i.ml===750;
    const p=f.primary||f.fills.find(o=>o.kind!=='house')||f.fills[0], m=this.maths(f), name=SellerCatalogue.short(i), glassy=f.fills.some(o=>o.kind==='glass')&&!sweet;
    const pairings=f.suits.map(s=>this.pairWhy(i,s)), top=pairings[0], dishName=top?top.dish.name:'dessert';
    const list=this.list(), S=w=>this.shape(w), same=list.filter(w=>S(w).kind===sh.kind&&sh.lead&&S(w).lead===sh.lead), samePs=same.map(w=>this._m(w.bottle)).filter(Boolean);
    const gl=list.filter(TeamData.byGlass), fizzGlass=gl.find(w=>S(w).kind==='sparkling'), champ=list.filter(w=>S(w).region==='Champagne').map(w=>this._m(w.bottle)).filter(Boolean);
    const home=this.home(), homeWs=list.filter(w=>w.country===home).map(w=>this._m(w.bottle)).filter(Boolean), countryWs=list.filter(w=>w.country===i.country&&S(w).kind===sh.kind);
    const fillIn=t=>t.replace('{{dish}}',top?`the ${top.dish.name}`:'dessert').replace('{{pour2}}',A(m.pourCost||i.price/Math.floor(i.ml/59))).replace('{{theirGlass}}',fizzGlass?fizzGlass.glass:'their glass price').replace('{{champFrom}}',champ.length?M(Math.min(...champ)):'well over $100')
      .replace('{{glass}}',M(L.glass||0)).replace('{{ucs}}',i.ucs).replace('{{bottle}}',M(L.bottle)).replace('{{sameCount}}',same.length).replace('{{sameFrom}}',samePs.length?M(Math.min(...samePs)):'a higher price').replace('{{flav}}',i.flavours.join(', '))
      .replace('{{under}}',p&&p.under?M(p.under):'a price few tables reach').replace('{{sameCountry}}',countryWs.slice(0,3).map(w=>`${nick(w)} (${S(w).lead||S(w).region}, ${w.bottle})`).join(', ')||'a few').replace('{{homeFrom}}',homeWs.length?M(Math.min(...homeWs)):'$75');
    // One thing to say: the opening, as a sentence to the buyer.
    const say=!p?`${name} would sit at about ${M(L.bottle)} on your list.`
      :p.kind==='call'&&!p.under?`You don't list ${this._a(p.call.label).toLowerCase()} ${p.call.label}, and it's one guests ask for by name. ${name} would be your only one${sweet?', poured by the 2oz glass':`, at about ${M(L.bottle)}`}.`
      :p.kind==='call'?`Your ${p.call.label} starts at ${M(p.under)}. ${name} is one at about ${M(L.bottle)}, for the table that wants it with ${top?`the ${top.dish.name}`:'dinner'} and won't spend ${M(p.under)}.`
      :p.kind==='ladder'?`Between ${nick(L.below?L.below.w:{producer:'your'})} at ${M(p.lo)} and ${nick(L.above?L.above.w:{producer:'the next'})} at ${M(p.hi)} your ${p.colour.toLowerCase()} list has nothing. ${name} lands at about ${M(L.bottle)}${glassy?`, and pours at ${M(L.glass)}`:''}.`
      :p.kind==='glass'&&p.k==='glass:local'?`Every ${home==='Canada'?'Ontario':'local'} wine you list is bottle only. ${name} gives you a local glass at about ${M(L.glass)}.`
      :p.kind==='glass'&&p.k==='glass:fizz'?`The only bubbles you pour by the glass is Prosecco${fizzGlass?` at ${fizzGlass.glass}`:''}. ${name} is a traditional-method sparkling at about ${M(L.glass)} a glass.`
      :p.kind==='glass'||p.kind==='dish'?`You have ${TeamData.dishes().filter(d=>/dessert|pudding|sweet/i.test(d.section||'')).length} desserts and one sweet pour. A 2oz glass of ${name} with ${top?`the ${top.dish.name}`:'dessert'} is a second sale after dinner.`
      :p.kind==='window'?`${nick(p.wine)} ${p.wine.vintage} is ${p.word}. ${name} is the same style at about ${M(L.bottle)}, ready now.`
      :p.kind==='mix'?`Your ${p.country==='Italy'?'Italian':p.country==='France'?'French':p.country} list covers most of the country and has no ${p.colour.toLowerCase()} from ${p.region}. ${name} is one at about ${M(L.bottle)}.`
      :p.kind==='format'?`You already sell large formats. ${name} in ${SellerCatalogue.format(i)} is one for a table of six at about ${M(L.bottle)}.`
      :`You already sell ${TeamData.short(p.wine)}. ${name} is the next wine from the same house, at about ${M(L.bottle)}.`;
    // The pitch, in the order a rep would give it.
    const story=[], angles=this.angle(i);
    story.push({h:'The wine',t:`${this.about(i)}${i.notes.taste?' '+this.sentences(i.notes.taste,1):''}${i.certs.length?` ${i.certs.join(', ')}.`:''}`,basis:i.basis.flavours==='sheet'?'sheet':'estimate'});
    if(angles[0]) story.push({h:'Why it sells',t:fillIn(angles[0].sell),basis:'guide'});
    if(top) story.push({h:'At the table',t:`Lead with ${top.dish.name}${top.dish.price?` (${top.dish.price})`:''}. ${top.why}${top.like?` It does the job of ${nick(top.like)}, which they suggest there${top.likePrice?` at ${M(top.likePrice)}`:''}${top.likePrice&&!sweet&&L.bottle<top.likePrice*0.8?`, for ${M(top.likePrice-L.bottle)} less`:''}.`:''}${pairings.length>1?` It also works with ${pairings.slice(1).map(x=>x.dish.name).join(', ')}.`:''}`,basis:'estimate'});
    if(sweet) story.push({h:'The price',t:`It costs them ${A(i.price)} a bottle, about ${A(m.pourCost)} for a 2oz pour (${m.pours} to a bottle). Their one dessert pour is on the list at $16, so the same price here returns ${M(16*m.pours)} from a ${A(i.price)} bottle.`,basis:'estimate'});
    else story.push({h:'The price',t:`It costs them ${A(i.price)}. ${L.lifted?`At their entry price of ${M(L.bottle)} that's ${L.x.toFixed(1)} times cost, better than the ${L.usualX.toFixed(1)} they usually take on a bottle like it`:`At about ${M(L.bottle)} it carries ${L.x.toFixed(1)} times cost, what they usually put on a bottle at this price`}: ${M(m.perBottle)} a bottle to them.${std&&L.glass?` By the glass at ${M(L.glass)}, a pour costs them ${A(m.pourCost)} and a case of ${i.ucs} is ${m.pours} glasses, ${M(m.glassTake)}.`:''}${L.below&&L.above?` It sits between ${nick(L.below.w)} (${M(L.below.p)}) and ${nick(L.above.w)} (${M(L.above.p)}).`:L.lifted&&L.beside?` It sits beside ${nick(L.beside.w)}, their cheapest ${sh.colour.toLowerCase()}.`:''}`,basis:'estimate'});
    if(f.house) story.push({h:'The relationship',t:`They already buy ${TeamData.short(f.house)} from the same house, so this is a line added to an order they place anyway.`,basis:'list'});
    // What they'll say back: the wine's own category first, then what this list and this bottle raise.
    const objections=[]; angles.forEach(a=>(a.obj||[]).forEach(([q,a2])=>objections.push({q,a:fillIn(a2)})));
    const dup=f.reasons.find(r=>r.pts<0&&/already list/.test(r.text)); if(dup) objections.unshift({q:`"We already have one of those."`,a:`${dup.text}. Don't argue with it: offer this as the glass pour or the step beside it, never as a replacement.`});
    if(L.lifted) objections.push({q:`"Is a ${A(i.price)} wine good enough for our list?"`,a:`The guest sees ${M(L.bottle)}, not the cost. Taste it beside ${L.beside?nick(L.beside.w):'their entry wine'} at the same price; if it holds up, it earns them ${M(m.perBottle)} a bottle.`});
    if(p&&p.kind==='ladder'&&!objections.length) objections.push({q:`"Our list is long enough."`,a:`It's long at both ends of ${p.colour.toLowerCase()} and empty between ${M(p.lo)} and ${M(p.hi)}. This fills a rung; it doesn't compete with a bottle they sell.`});
    if(glassy&&m.pours) objections.push({q:`"A case is a lot to commit to for a new glass pour."`,a:`A case is ${i.ucs} bottles, ${m.pours} glasses. At five glasses a night that's ${Math.round(m.pours/5)} nights, and ${M(m.glassTake)} against ${A(m.cost)} in.`});
    const sup=SellerCatalogue.supply(i); if(sup.k!=='now') objections.push({q:`"Can you get it to us?"`,a:`${sup.line}. Check the delivery date before the meeting; don't promise it across the table.`});
    return {say,story,pairings,objections:objections.slice(0,4),maths:m,primary:p,sell:angles[0]?fillIn(angles[0].sell):''}; },

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
  /* One bottle with its fit and pitch, for the wine card. */
  card(id){ const f=this.all().find(x=>x.item.id===id); if(!f) return null; const short=this.shortlist().find(x=>x.item.id===id); return f.out?{...f,pitch:null}:{...f,primary:short?short.primary:undefined,pitch:this.pitch(short||f)}; },
};
Object.assign(window,{SellerCatalogue,SellerMatch});
