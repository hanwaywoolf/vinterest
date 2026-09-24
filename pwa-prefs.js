/* Vinterest — UserPrefs: the few onboarding answers the app actually uses.

   Location sets the price region and currency (Regional reads vinterest_region). The wine types
   they drink pick which type Home and WineDNA open on. Their usual spend stands in for a price
   range until WineDNA has priced wines of its own (the sommelier script, the scan result). How
   well they know wine decides whether Learn opens with the beginner on-ramp and how deep
   generated articles go. Age confirmation is stored so it's asked once. */
const UserPrefs = {
  KEY:'vinterest_prefs',
  AGE_KEY:'vinterest_age_ok',

  get(){ try{ return JSON.parse(localStorage.getItem(this.KEY)||'{}')||{}; }catch(e){ return {}; } },
  save(p){ try{ localStorage.setItem(this.KEY,JSON.stringify(p)); }catch(e){} },
  set(key,val){ const p=this.get(); if(val==null) delete p[key]; else p[key]=val; this.save(p); return p; },

  ageConfirmed(){ return !!localStorage.getItem(this.AGE_KEY); },
  confirmAge(){ try{ localStorage.setItem(this.AGE_KEY,new Date().toISOString()); }catch(e){} },

  /* Countries the app prices in. `region` is the Regional home key. */
  COUNTRIES:[
    {name:'United Kingdom',iso:'GB',region:'uk'},
    {name:'United States',iso:'US',region:'us',stateLabel:'State'},
    {name:'Canada',iso:'CA',region:'canada',stateLabel:'Province'},
    {name:'Australia',iso:'AU',region:'australia'},
    {name:'New Zealand',iso:'NZ',region:'nz'},
    {name:'Ireland',iso:'IE',region:'eu'},
    {name:'France',iso:'FR',region:'france'},
    {name:'Germany',iso:'DE',region:'germany'},
    {name:'Italy',iso:'IT',region:'italy'},
    {name:'Spain',iso:'ES',region:'spain'},
    {name:'Somewhere else',iso:'',region:'us'},
  ],
  country(name){ return this.COUNTRIES.find(c=>c.name===name)||null; },

  /* A best guess from the phone's settings (no location permission needed): the time zone first,
     then the language's region, e.g. en-GB. The user confirms it. */
  guessCountry(){
    let tz=''; try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
    const byTz=[[/^Europe\/(London|Belfast|Guernsey|Jersey|Isle_of_Man)$/,'GB'],[/^Europe\/Dublin$/,'IE'],[/^Europe\/Paris$/,'FR'],[/^Europe\/Berlin$/,'DE'],
      [/^Europe\/Rome$/,'IT'],[/^Europe\/Madrid$|^Atlantic\/Canary$/,'ES'],[/^Pacific\/Auckland$/,'NZ'],[/^Australia\//,'AU'],
      [/^America\/(Toronto|Vancouver|Montreal|Edmonton|Winnipeg|Halifax|Regina|St_Johns|Moncton|Whitehorse)$/,'CA'],
      [/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.*|Kentucky\/.*)$|^Pacific\/Honolulu$/,'US']];
    let iso=(byTz.find(([re])=>re.test(tz))||[])[1];
    if(!iso){ const lang=((navigator.languages&&navigator.languages[0])||navigator.language||''); const m=/[-_]([A-Za-z]{2})$/.exec(lang); if(m) iso=m[1].toUpperCase(); }
    const c=this.COUNTRIES.find(x=>x.iso&&x.iso===iso);
    return c?c.name:null;
  },

  location(){ return {country:localStorage.getItem('vinterest_country')||'',state:localStorage.getItem('vinterest_state')||''}; },
  setLocation({country,state}){
    const c=this.country(country)||this.COUNTRIES[this.COUNTRIES.length-1];
    try{
      localStorage.setItem('vinterest_country',c.name);
      if(state&&c.stateLabel) localStorage.setItem('vinterest_state',state.trim()); else localStorage.removeItem('vinterest_state');
      localStorage.removeItem('vinterest_city'); // never used
      localStorage.setItem('vinterest_region',c.region);
      localStorage.setItem('vinterest_currency',(HOME_REGION_CURRENCY[c.region]||{}).code||'USD');
    }catch(e){}
  },

  /* Usual spend per bottle, as bands in the home currency: [min, max) with max null for "and up". */
  BUDGETS:{
    GBP:[[0,12],[12,25],[25,50],[50,null]], USD:[[0,15],[15,30],[30,60],[60,null]],
    CAD:[[0,20],[20,40],[40,70],[70,null]], AUD:[[0,20],[20,40],[40,70],[70,null]], NZD:[[0,20],[20,40],[40,70],[70,null]],
    EUR:[[0,12],[12,30],[30,60],[60,null]],
  },
  BUDGET_IDS:['value','mid','premium','splurge'],
  BUDGET_NOTES:['Everyday value','A reliable step up','Something special','Going all out'],
  _homeCur(){ const h=Regional.home(); return {code:h.code,base:h.sym}; },
  budgetOptions(cur){
    cur=cur||this._homeCur();
    const bands=this.BUDGETS[cur.code]||this.BUDGETS.USD;
    return bands.map(([lo,hi],i)=>({id:this.BUDGET_IDS[i],note:this.BUDGET_NOTES[i],
      label:lo===0?`Under ${cur.base}${hi}`:hi==null?`${cur.base}${lo}+`:`${cur.base}${lo} – ${cur.base}${hi}`}));
  },
  /* Their usual spend in the currency `rc` (converted when travelling): {min, max, label} or null. */
  budget(rc){
    const id=this.get().budget; const i=this.BUDGET_IDS.indexOf(id); if(i<0) return null;
    const home=this._homeCur(); rc=rc||Regional.current();
    const [lo,hi]=(this.BUDGETS[home.code]||this.BUDGETS.USD)[i];
    const k=(USD_FX[rc.code]||1)/(USD_FX[home.code]||1);
    const r=v=>v==null?null:Math.round(v*k);
    const min=r(lo), max=r(hi), b=rc.base||rc.sym||'';
    return {min,max,label:min===0?`under ${b}${max}`:max==null?`${b}${min} and up`:`${b}${min}–${b}${max}`};
  },
  /* How a price sits against their usual spend: 'below' | 'within' | 'above', or null. */
  spendFit(price,rc){
    const b=this.budget(rc); if(!b||!(price>0)) return null;
    if(price<b.min) return 'below';
    if(b.max!=null&&price>b.max) return 'above';
    return 'within';
  },

  TYPES:['red','white','rose','sparkling','orange','dessert','fortified'],
  types(){ return (this.get().types||[]).filter(t=>this.TYPES.includes(t)); },
  preferredType(){ return this.types()[0]||null; },
  /* The wine type WineDNA opens on: the one they've actually chosen most (their scans), with
     their onboarding answer breaking ties and covering someone with no wines yet. A tab they
     pick is remembered for the rest of the session. */
  TYPE_TAB_KEY:'vinterest_dna_type',
  openingType(wines){
    try{ const s=sessionStorage.getItem(this.TYPE_TAB_KEY); if(s&&(wines||[]).some(w=>WineDNA._t(w.type)===s)) return s; }catch(e){}
    const counts={}; (wines||[]).filter(w=>WineDNA.chosen(w)).forEach(w=>{ const t=WineDNA._t(w.type); if(t) counts[t]=(counts[t]||0)+1; });
    const prefs=this.types(), rank=t=>{ const i=prefs.indexOf(t); return i<0?99:i; };
    const top=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]||rank(a)-rank(b))[0];
    return top||this.preferredType()||'red';
  },
  rememberType(t){ try{ sessionStorage.setItem(this.TYPE_TAB_KEY,t); }catch(e){} },
  /* Opening WineDNA from elsewhere (Home): straight to a type's tab and, optionally, one section
     (e.g. 'scripts'), opened and scrolled into view. takeDNASection() reads it once. */
  DNA_SECTION_KEY:'vinterest_dna_section',
  openDNA(type,section){ if(type) this.rememberType(type); try{ if(section) sessionStorage.setItem(this.DNA_SECTION_KEY,section); else sessionStorage.removeItem(this.DNA_SECTION_KEY); }catch(e){} },
  takeDNASection(){ try{ const s=sessionStorage.getItem(this.DNA_SECTION_KEY); sessionStorage.removeItem(this.DNA_SECTION_KEY); return s; }catch(e){ return null; } },

  EXPERIENCE:[{id:'novice',label:'Just getting started',note:'Keep it simple and clear'},{id:'casual',label:'I know what I like',note:'A little more detail'},
    {id:'enthusiast',label:'Pretty into it',note:'Bring on the nuance'},{id:'expert',label:'Borderline obsessed',note:'Full depth, no hand-holding'}],
  experience(){ return this.get().experience||null; },
  /* Enthusiasts and experts skip the beginner on-ramp as the gate to their Learn shelf. */
  skipsOnRamp(){ return ['enthusiast','expert'].includes(this.experience()); },
  /* One line for article prompts, so depth matches the reader. */
  depthLine(){
    const e=this.experience();
    return e==='novice'?'The reader is new to wine: explain every term plainly, keep it simple.'
      :e==='casual'?'The reader knows what they like: explain technical terms briefly.'
      :e==='enthusiast'?'The reader is an enthusiast: go into real detail and nuance.'
      :e==='expert'?'The reader is very knowledgeable: full technical depth, no basics.'
      :'Pitch it for an interested non-expert.';
  },
};
