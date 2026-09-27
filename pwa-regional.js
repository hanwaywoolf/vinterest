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
  url(wine){ const gl=this.country(); return 'https://www.google.com/search?q='+encodeURIComponent(this.query(wine))+(gl?'&gl='+gl:''); },
  // A real link click, not window.open with window features: installed apps hand a plain
  // target=_blank link to the platform's in-app browser (Safari's sheet with Done on iOS, a
  // Custom Tab with a close button on Android), whereas a "popup" request can open a bare
  // window with no way back.
  open(wine){
    const a=document.createElement('a');
    a.href=this.url(wine); a.target='_blank'; a.rel='noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
  }
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

