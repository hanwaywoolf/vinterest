/* Vinterest — MyWines: what the My Wines list shows, and in what order.

   Filtering (wine type, status, search), sorting, month groups and the summary line are here so
   the screen only renders them. Statuses come from the scan flow: a "Save for later" scan is a
   shelf check (scan_intent 'checking') until they buy or score it, and buy_again comes from the
   optional tasting details after a score. */
const MyWines = {
  STATUSES:[
    {id:'unscored',label:'Unscored',test:w=>!(w.rating>0)&&!MyWines.isSaved(w)},
    {id:'saved',label:'Saved for later',test:w=>MyWines.isSaved(w)},
    {id:'again',label:'Buy again',test:w=>w.buy_again===true},
  ],
  SORTS:[{id:'recent',label:'Recent'},{id:'rating',label:'Top scored'},{id:'name',label:'A–Z'},{id:'price',label:'Price'}],

  isSaved(w){ return w.scan_intent==='checking'&&!(w.rating>0)&&w.bought!==true; },
  type(w){ return WineDNA._t(w.type)||'red'; },
  _norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); },

  counts(wines){
    const types={}, status={};
    wines.forEach(w=>{ const t=this.type(w); types[t]=(types[t]||0)+1; });
    this.STATUSES.forEach(s=>{ status[s.id]=wines.filter(s.test).length; });
    return {types,status};
  },

  /* Every word typed must appear in the wine's name, producer, grapes, region, country or vintage. */
  matches(w,q){
    const words=this._norm(q).split(/\s+/).filter(Boolean);
    if(!words.length) return true;
    const hay=this._norm([w.name,w.producer,(w.grapes||[]).join(' '),w.region,w.sub_region,w.country,w.vintage>0?w.vintage:'',w.type].join(' '));
    return words.every(x=>hay.includes(x));
  },

  _when(w){ return new Date(w.last_scanned||w.scanned_at||0).getTime()||0; },
  query(wines,{type='all',status=null,q='',sort='recent'}={}){
    const st=this.STATUSES.find(s=>s.id===status);
    const list=wines.filter(w=>(type==='all'||this.type(w)===type)&&(!st||st.test(w))&&this.matches(w,q));
    const rc=Regional.current();
    const cmp={
      recent:(a,b)=>this._when(b)-this._when(a),
      rating:(a,b)=>(b.rating||0)-(a.rating||0)||this._when(b)-this._when(a),
      name:(a,b)=>String(a.name||'').localeCompare(String(b.name||'')),
      price:(a,b)=>(WineDNA.priceOf(b,rc)||-1)-(WineDNA.priceOf(a,rc)||-1),
    }[sort]||((a,b)=>0);
    return list.sort(cmp);
  },

  /* Recent is grouped by month ("September 2026"); the other sorts are one list. */
  groups(list,sort){
    if(sort!=='recent') return [{label:null,wines:list}];
    const out=[];
    list.forEach(w=>{
      const t=this._when(w), label=t?new Date(t).toLocaleDateString('en',{month:'long',year:'numeric'}):'Earlier';
      const g=out[out.length-1];
      if(g&&g.label===label) g.wines.push(w); else out.push({label,wines:[w]});
    });
    return out;
  },

  /* "68 bottles · 12 countries · average 90 · about £32 a bottle", for what's on screen. */
  summary(list){
    const rc=Regional.current();
    const n=list.length, countries=new Set(list.map(w=>w.country).filter(Boolean)).size;
    const scored=list.filter(w=>w.rating>0), prices=list.map(w=>WineDNA.priceOf(w,rc)).filter(p=>p>0);
    const parts=[`${n} ${n===1?'bottle':'bottles'}`];
    if(countries) parts.push(`${countries} ${countries===1?'country':'countries'}`);
    if(scored.length) parts.push(`average ${Math.round(WineDNA._mean(scored.map(w=>w.rating)))}`);
    if(prices.length) parts.push(`about ${rc.base}${Math.round(WineDNA._mean(prices))} a bottle`);
    return parts.join(' · ');
  },

  /* The line under a wine's name: producer · region · vintage (no repeats, NV for non-vintage). */
  subline(w){
    const region=w.region&&w.region!==w.country?w.region:w.country;
    const producer=w.producer&&!this._norm(w.name).includes(this._norm(w.producer))?w.producer:null;
    return [producer,region,w.vintage>0?String(w.vintage):'NV'].filter(Boolean).join(' · ');
  },

  /* The score colour by Parker band, as WineDNA and the scan screens use. */
  scoreTone(r){ return r>=ParkerScale.LOVED?'good':r>=ParkerScale.DISLIKED?'neutral':'bad'; },
};
