/* Vinterest — where the user is and what things cost there: currencies, Travel Mode (Regional),
   "Find it online" (FindOnline) and the shop-price lookup (fetchRetailEstimate). Moved out of
   pwa-components.jsx so the UI file holds only UI atoms. */
const CURRENCY_LIST=[{code:'USD',sym:'$'},{code:'GBP',sym:'£'},{code:'EUR',sym:'€'},{code:'CAD',sym:'CA$'},{code:'AUD',sym:'A$'},{code:'NZD',sym:'NZ$'},{code:'JPY',sym:'¥'},{code:'CNY',sym:'¥'},{code:'CHF',sym:'CHF'},{code:'ZAR',sym:'R'},{code:'SGD',sym:'S$'},{code:'HKD',sym:'HK$'},{code:'MXN',sym:'MX$'},{code:'BRL',sym:'R$'},{code:'INR',sym:'₹'},{code:'AED',sym:'AED'},{code:'SEK',sym:'kr'},{code:'NOK',sym:'kr'},{code:'DKK',sym:'kr'}];
const COUNTRY_CURRENCY={'united states':'USD','usa':'USD','us':'USD','united kingdom':'GBP','uk':'GBP','england':'GBP','scotland':'GBP','wales':'GBP','canada':'CAD','australia':'AUD','new zealand':'NZD','france':'EUR','germany':'EUR','italy':'EUR','spain':'EUR','portugal':'EUR','ireland':'EUR','netherlands':'EUR','belgium':'EUR','austria':'EUR','greece':'EUR','japan':'JPY','china':'CNY','switzerland':'CHF','south africa':'ZAR','singapore':'SGD','hong kong':'HKD','mexico':'MXN','brazil':'BRL','india':'INR','uae':'AED','united arab emirates':'AED','dubai':'AED','sweden':'SEK','norway':'NOK','denmark':'DKK'};
function lookupCountryCurrency(name){
  const key=(name||'').trim().toLowerCase();
  const code=COUNTRY_CURRENCY[key];
  if(!code) return null;
  return CURRENCY_LIST.find(c=>c.code===code)||null;
}
const HOME_REGION_CURRENCY={uk:{sym:'£',code:'GBP',label:'United Kingdom'},us:{sym:'$',code:'USD',label:'United States'},ontario:{sym:'CA$',code:'CAD',label:'Canada'},canada:{sym:'CA$',code:'CAD',label:'Canada'},australia:{sym:'A$',code:'AUD',label:'Australia'},nz:{sym:'NZ$',code:'NZD',label:'New Zealand'},eu:{sym:'€',code:'EUR',label:'Europe'},france:{sym:'€',code:'EUR',label:'France'},germany:{sym:'€',code:'EUR',label:'Germany'},italy:{sym:'€',code:'EUR',label:'Italy'},spain:{sym:'€',code:'EUR',label:'Spain'}};
/* "Find it online" for any bottle, from anywhere in the app: one query recipe and one way of
   opening it. The query leads with what a retailer lists (producer once, wine name, vintage),
   adds "wine" and "buy", and leaves out "near me", which makes Google answer with a map of
   shops instead of listings for the bottle. Local results come from Google's gl (country)
   parameter, following the user's region or travel mode. */
const FindOnline={
  GL_BY_LABEL:{'united kingdom':'gb','united states':'us','canada':'ca','australia':'au','new zealand':'nz','france':'fr','germany':'de','italy':'it','spain':'es','portugal':'pt','ireland':'ie','japan':'jp','switzerland':'ch','south africa':'za','singapore':'sg','hong kong':'hk','mexico':'mx','brazil':'br','india':'in','united arab emirates':'ae','sweden':'se','norway':'no','denmark':'dk','china':'cn'},
  GL_BY_CURRENCY:{GBP:'gb',USD:'us',CAD:'ca',AUD:'au',NZD:'nz',JPY:'jp',CHF:'ch',ZAR:'za',SGD:'sg',HKD:'hk',MXN:'mx',BRL:'br',INR:'in',AED:'ae',SEK:'se',NOK:'no',DKK:'dk',CNY:'cn'},
  country(){ const rc=Regional.current(); return this.GL_BY_LABEL[(rc.label||'').toLowerCase()]||this.GL_BY_CURRENCY[rc.code]||null; },
  _fold(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); },
  query(wine){
    const clean=s=>(s||'').replace(/\([^)]*\)/g,' ').replace(/\s+/g,' ').trim();
    const name=clean(wine.name), producer=clean(wine.producer);
    const parts=[];
    if(producer&&!this._fold(name).includes(this._fold(producer))) parts.push(producer);
    parts.push(name);
    const vintage=String(wine.vintage||'').match(/\b(19|20)\d{2}\b/);
    if(vintage&&!name.includes(vintage[0])) parts.push(vintage[0]);
    if(!/\bwine\b/i.test(parts.join(' '))) parts.push('wine');
    parts.push('buy');
    return parts.join(' ');
  },
  /* A shop's own search gets the producer and name only: "wine", "buy" and the vintage are for
     Google, and a shop search can come back empty with them (the shop page has the vintages).
     The same as shopWords in _worker.js. */
  shopQuery(q){ return q.replace(/\s+buy$/i,'').replace(/\s+wine$/i,'').replace(/\s+(19|20)\d{2}$/,''); },
  url(wine){ const gl=this.country(); return 'https://www.google.com/search?q='+encodeURIComponent(this.query(wine))+(gl?'&gl='+gl:''); },
  /* Where "Find it for me" goes: a partner shop's own search when one is switched on for the
     user's country (Shops, tracked when its Awin IDs are set), else Google, by way of /go.
     {url, name, partner}. */
  target(wine,placement){
    // The tap goes to the Worker's /go, which picks the shop from the list as deployed today (an
    // installed app's own copy may be older); the name and Partner label come from this copy.
    const gl=this.country(), shop=Shops.forCountry(gl)[0];
    const url=Shops.goUrl({w:this.query(wine),c:gl,p:placement||'find'});
    if(shop){ const q=this.shopQuery(this.query(wine)); return {url,name:shop.name,partner:Shops._track(shop.search.replace('{q}',encodeURIComponent(q)),placement).partner}; }
    return {url,name:null,partner:false};
  },
  label(wine,verb){ const t=this.target(wine); return t.name?`${verb||'Find it'} at ${t.name}`:(verb?`${verb} online`:'Find it online'); },
  open(wine,placement){ Shops.go(this.target(wine,placement||'find').url); }
};
/* Partner shops (data/retailers.json) and the one way any shop link is built. Links go by way of
   the Worker's /go, which tracks them through Awin (clickref = where in the app it was tapped)
   when the publisher ID and that shop's awinMid are both set, else Skimlinks when it's switched
   on, else leaves them plain. Money never moves a match, a verdict or a pick: shop links sit
   beside them, labelled "Partner" and explained in words (ShopDisclosure). */
const Shops={
  _cfg:null,
  config(){ if(!this._cfg){ let c={}; try{ c=(typeof window!=='undefined'&&window.VINTEREST_RETAILERS)||_loadJSON('data/retailers.json')||{}; }catch(e){} this._cfg={awin:c.awin||{},skimlinks:c.skimlinks||{},retailers:c.retailers||[]}; } return this._cfg; },
  _host(url){ try{ return new URL(url).host.replace(/^www\./,''); }catch(e){ return ''; } },
  byUrl(url){ const h=this._host(url); return this.config().retailers.find(r=>(r.domains||[]).some(d=>h===d||h.endsWith('.'+d)))||null; },
  // Switched-on shops with a search link, for a country ('gb', from FindOnline.country()).
  forCountry(gl){ return this.config().retailers.filter(r=>r.enabled&&r.search&&r.country===gl); },
  /* The Worker's /go link (_worker.js handleGo), absolute in the installed apps (Platform.api). */
  goUrl(params){ return Platform.api('/go?'+Object.entries(params).filter(([,v])=>v!=null&&v!=='').map(([k,v])=>k+'='+encodeURIComponent(v)).join('&')); },
  /* How this copy of the list would track a link: Awin when the shop has approved us (joined) and
     has an awinMid, and the publisher ID is set (an Awin link to a shop that hasn't approved us can
     land on Awin's error page instead of the shop), else Skimlinks when it's switched on, else plain. Says whether it's a
     partner link (the Partner label); /go does the same with the deployed list. */
  _track(url,placement){
    const c=this.config(), r=this.byUrl(url), pub=c.awin.publisherId, sk=c.skimlinks||{};
    if(r&&r.joined&&r.awinMid&&pub) return {url:'https://www.awin1.com/cread.php?awinmid='+encodeURIComponent(r.awinMid)+'&awinaffid='+encodeURIComponent(pub)+'&clickref='+encodeURIComponent(placement||'app')+'&ued='+encodeURIComponent(url),partner:true};
    if(sk.enabled&&sk.id) return {url:'https://go.skimresources.com/?id='+encodeURIComponent(sk.id)+'&xs=1&xcust='+encodeURIComponent(placement||'app')+'&sref='+encodeURIComponent(sk.sref||'https://vinterest.app/')+'&url='+encodeURIComponent(url),partner:true};
    return {url,partner:false};
  },
  /* A shop page's link. A known retailer's page, or one the Worker signed (`sig`, the price
     search's own listings), goes by way of /go; anything else is tracked here (Skimlinks) or
     opened as it is, since /go only follows links it can vouch for. */
  link(url,placement,sig){
    const r=this.byUrl(url), t=this._track(url,placement);
    return {url:(r||sig)?this.goUrl({u:url,p:placement||'app',s:sig}):t.url,partner:t.partner,name:r?r.name:null};
  },
  // The Price tab's "In shops now": the shops the live price search found the wine at.
  listings(priceData,placement){ return ((priceData&&priceData.shops)||[]).map(s=>({...s,...this.link(s.url,placement,s.sig),name:s.name})); },
  /* A real link click, not window.open with window features: installed apps hand a plain
     target=_blank link to the platform's in-app browser (Safari's sheet with Done on iOS, a
     Custom Tab with a close button on Android), whereas a "popup" request can open a bare
     window with no way back. */
  go(url){
    const a=document.createElement('a');
    a.href=url; a.target='_blank'; a.rel='noopener noreferrer sponsored';
    document.body.appendChild(a); a.click(); a.remove();
  }
};
/* LCBO stock near an Ontario user (beta, Pro). The Worker's /lcbo (handleLcbo in _worker.js) finds
   the LCBO product a wine is and which stores near their city (UserPrefs city, asked only in
   Ontario) have it, from LCBO.dev's public data, updated daily. It's off on the server until
   LCBO_ENABLED is set; until then, and whenever it can't answer, the card is two links: the
   bottle searched on lcbo.com and the LCBO stores in their city on a map. Each answer is kept on the phone for CACHE_MS. */
const Lcbo={
  CACHE_PREFIX:'vinterest_lcbo_', CACHE_MS:20*60*1000,
  city(){ const l=UserPrefs.location(); return UserPrefs.askCity(l.country,l.state)&&l.city?l.city:null; },
  // Ontario: the Price tab's "At the LCBO" (its buttons need no city; the stock list does).
  ontario(){ const l=UserPrefs.location(); return UserPrefs.askCity(l.country,l.state); },
  // Ontario with a city: the stock lookup (the Worker's /lcbo).
  applies(){ return !!this.city(); },
  /* lcbo.com's own search for the bottle, from the label: producer and name, each word once, no
     vintage (the LCBO lists most wines without one). Its product page has "Check store inventory".
     lcbo.com's terms forbid collecting its data, so the app only links to it. */
  searchUrl(wine){
    const seen=new Set(), words=`${wine&&wine.producer||''} ${wine&&wine.name||''}`.split(/\s+/)
      .filter(w=>w&&!/^(19|20)\d{2}$/.test(w)&&!seen.has(w.toLowerCase())&&seen.add(w.toLowerCase()));
    return 'https://www.lcbo.com/en/catalogsearch/result/?q='+encodeURIComponent(words.join(' ')).replace(/%20/g,'+');
  },
  /* The LCBO stores in their city on a map. lcbo.com's store finder can't be opened on a city
     (it ignores anything in its address), so this is a Google Maps search. */
  storesUrl(city){ return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(`LCBO, ${city}, ON`); },
  openSearch(wine){ Shops.go(Shops.link(this.searchUrl(wine),'lcbo').url); },
  openStores(city){ Shops.go(this.storesUrl(city)); },
  /* What it still needs: null, 'signin' (sign-in configured and signed out: the Worker answers
     402 there) or 'pro'. Mirrors PRO_ONLY.lcbo; the Worker checks for itself. */
  needs(){
    if(typeof Account!=='undefined'&&Account.available()&&!Account.signedIn()) return 'signin';
    return Entitlement.isPro()?null:'pro';
  },
  _key(wine,city){ return this.CACHE_PREFIX+[wine.producer,wine.name,city].map(x=>String(x||'').toLowerCase().replace(/[^a-z0-9]+/g,'-')).join('|').slice(0,160); },
  /* {enabled, available, cityFound, found, product:{sku,name,price,url}, stores:[{name,address,city,km,quantity,updatedAt}], checkedAt}
     or null when the request didn't get through (offline). */
  async stock(wine){
    const city=this.city();
    if(!city||!wine||!wine.name) return null;
    const k=this._key(wine,city), hit=Cache.get(k,null);
    if(hit&&hit.at&&Date.now()-hit.at<this.CACHE_MS) return hit.data;
    const body=JSON.stringify({wine:{name:wine.name,producer:wine.producer||'',vintage:wine.vintage||null},city});
    const send=async(token)=>fetch(Platform.api('/lcbo'),{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body});
    try{
      const acct=typeof Account!=='undefined'&&Account.signedIn()?Account:null;
      const token=acct?await acct.token():null;
      let r=await send(token);
      if(r.status===401&&token){ acct.expired(); r=await send(null); }
      const d=await r.json().catch(()=>null);
      if(r.status===402) return {enabled:true,needs:d&&d.signIn?'signin':'pro'};
      if(!r.ok||!d) return {enabled:true,available:false};
      if(d.enabled&&d.available) Cache.set(k,{at:Date.now(),data:d});
      return d;
    }catch(e){ return null; }
  },
  // "Updated today", "Updated yesterday", "Updated 3 days ago": how fresh LCBO.dev's count is.
  freshness(stores){
    const t=Math.max(0,...(stores||[]).map(s=>Date.parse(s.updatedAt)||0));
    if(!t) return null;
    const days=Math.floor((Date.now()-t)/864e5);
    return days<=0?'Stock as of today':days===1?'Stock as of yesterday':`Stock as of ${days} days ago`;
  },
  link(product){ return product&&product.url?Shops.link(product.url,'lcbo'):null; },
};
const Regional={
  TRAVEL_KEY:'vinterest_travel',
  travel(){
    let t;
    t=Store.getJSON(this.TRAVEL_KEY,null);
    if(!t||!t.active) return null;
    if(t.until){
      const untilEnd=new Date(t.until+'T23:59:59');
      if(!isNaN(untilEnd.getTime())&&Date.now()>untilEnd.getTime()){
        t.active=false; Store.setJSON(this.TRAVEL_KEY,t);
        window.dispatchEvent(new Event('vinterest:travel'));
        return null;
      }
    }
    return t;
  },
  home(){
    const region=(Store.get('vinterest_region')||'uk').toLowerCase();
    return HOME_REGION_CURRENCY[region]||HOME_REGION_CURRENCY.uk;
  },
  current(){
    const t=this.travel();
    if(t) return {sym:t.sym,base:t.sym,code:t.code,label:t.country,isTravel:true};
    const h=this.home();
    return {sym:h.sym,base:h.sym,code:h.code,label:h.label,isTravel:false};
  },
  setTravel(country,until,codeOverride){
    const match=codeOverride?CURRENCY_LIST.find(c=>c.code===codeOverride):lookupCountryCurrency(country);
    const cur=match||{code:'USD',sym:'$'};
    const t={active:true,country:(country||'').trim(),sym:cur.sym,code:cur.code,until:until||''};
    Store.setJSON(this.TRAVEL_KEY,t);
    window.dispatchEvent(new Event('vinterest:travel'));
    return t;
  },
  disableTravel(){
    let t=Store.getJSON(this.TRAVEL_KEY,null);
    if(t){ t.active=false; Store.setJSON(this.TRAVEL_KEY,t); }
    window.dispatchEvent(new Event('vinterest:travel'));
  }
};

/* ── Shared retail-price estimate: single source of truth used by both the
   Wine Detail price tab and the wine-list value/markup badges, so the two
   screens never disagree on what a wine "should" cost. Cached per wine+currency. */
function retailPriceCacheKey(wine,code){
  return 'vinterest_price_v3_'+((wine&&wine.name)||'').replace(/\s/g,'_')+'_'+((wine&&wine.vintage)||'nv')+'_'+code;
}
/* The shop price for a wine, in the user's currency, cached on the device.
   Premium wines (a label estimate of PRICE_SEARCH_FROM_USD or more: about £30 / €37) get a real
   search of current shop listings through the Worker (window.claude.priceSearch: web search,
   shared between users for 30 days), because that's where remembered prices go most wrong.
   Everything else, and any search that finds nothing, gets Claude's estimate. */
const PRICE_SEARCH_FROM_USD=40;
function _priceMarket(curr){ return {code:curr.code,label:curr.label,country:(FindOnline.country()||'').toUpperCase()}; }
function fetchRetailEstimate(wine,curr){
  return _fetchRetailEstimate(wine,curr).then(d=>{ _keepShopPrice(wine,curr,d); return d; });
}
/* The shop price is saved onto the wine (shop_price {amount, code, source}), so WineDNA's average,
   Value and the sommelier script's budget use the same figure the Price tab shows, not the rough
   label guess (price_usd) the scan started with. What they paid still comes first (WineDNA.priceOf). */
function _keepShopPrice(wine,curr,d){
  try{
    if(!d||!(d.mid>0)) return;
    const e=WineHistory.find(wine); if(!e) return;
    const sp=e.shop_price;
    if(sp&&sp.amount===d.mid&&sp.code===curr.code) return;
    WineHistory.update(e.name,e.vintage,{shop_price:{amount:d.mid,code:curr.code,source:d.source||'estimate'}});
  }catch(err){}
}
function _fetchRetailEstimate(wine,curr){
  const cacheKey=retailPriceCacheKey(wine,curr.code);
  const premium=!!(wine&&wine.price_usd>=PRICE_SEARCH_FROM_USD&&window.claude&&window.claude.priceSearch);
  let cached=Cache.get(cacheKey,null);
  // A premium wine only estimated so far is looked up again: straight away if its search was
  // still running last time (the Worker has usually saved the answer since), after a week if
  // the search found nothing, so a miss isn't paid for on every open.
  const recentMiss=cached&&cached.searchedAt&&Date.now()-cached.searchedAt<SEARCH_MISS_RETRY_MS;
  if(cached&&(!premium||cached.source==='search'||recentMiss)) return Promise.resolve(cached);
  const save=d=>{ Cache.set(cacheKey,d); return d; };
  const search=premium
    ?window.claude.priceSearch({name:wine.name,producer:wine.producer,vintage:wine.vintage,region:wine.region,country:wine.country,type:wine.type},_priceMarket(curr)).catch(()=>null)
    :Promise.resolve(null);
  return search.then(found=>found&&found.mid>0?save(found)
    :_estimatePrice(wine,curr).then(d=>save(premium&&!(found&&found.pending)?{...d,searchedAt:Date.now()}:d)));
}
const SEARCH_MISS_RETRY_MS=7*24*3600*1000;
function _estimatePrice(wine,curr){
  const prompt=
    'You are a wine market pricing expert. Estimate what ONE 75cl bottle of this SPECIFIC wine costs today in wine shops in '+(curr.label||'the user\'s market')+', in '+(curr.label?curr.code:'local currency')+' ('+curr.code+').'+
    ' Price this exact producer and label, not an average for its region or appellation.'+
    ' Your memory of prices may be a year or more old: prestige and cult wines (Super Tuscans, classed-growth Bordeaux, top Burgundy, Napa cult Cabernet, prestige Champagne, Barolo and Brunello from famous producers) have risen sharply in recent years, so price them at today\'s levels, not the ones you remember. Everyday wines have moved much less.'+
    ' Price the '+(wine.vintage?wine.vintage+' vintage':'current release')+' at shop prices (not auction, en primeur or restaurant).'+
    ' Wine: '+(wine.name||'')+(wine.vintage?' '+wine.vintage:'')+'.'+
    (wine.producer?' Producer: '+wine.producer+'.':'')+
    ' If the name looks misspelled, price the wine it most plausibly is (e.g. "Cevero della Salla" is Antinori\'s Cervaro della Sala).'+
    ' Type: '+(wine.type||'red')+'.'+
    ' Region: '+(wine.region||'')+', '+(wine.country||'')+'.'+
    ' Grapes: '+((wine.grapes||[]).join(', ')||'unknown')+'.'+
    (wine.abv?' ABV: '+wine.abv+'%.':'')+
    ' Return ONLY valid JSON, no markdown: {"low":NUMBER,"mid":NUMBER,"high":NUMBER,"currency":"'+curr.code+'","tier":"entry|everyday|premium|luxury|ultra-luxury","note":"one sentence on what drives this wine\'s price (producer, rarity, appellation)"}.'+
    ' Integers only. Return null values only if the wine is genuinely unidentifiable.';
  return window.claude.complete({purpose:'price',messages:[{role:'user',content:prompt}]}).then(text=>{
    let c=text.replace(/```json|```/g,'').trim();
    const s=c.indexOf('{'),e=c.lastIndexOf('}');
    if(s>=0&&e>s) c=c.slice(s,e+1);
    return {...JSON.parse(c),source:'estimate'};
  });
}

