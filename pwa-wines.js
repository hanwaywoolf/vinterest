/* Vinterest — WineHistory: the wines a user has scanned, scored and saved (vinterest_wines).
   Moved out of pwa-components.jsx so the UI file holds only UI atoms. */
const WineHistory = {
  KEY: 'vinterest_wines',
  // Grapes are cleaned on the way out, so older scans saved as "Blend - likely Grenache, Syrah, or
  // Cinsault" read as real varieties everywhere (see WineDNA.cleanGrapes).
  getAll(){
    let list; try{ list=Store.getJSON(this.KEY,[]).map(w=>WineDNA.cleanWine(w)); }catch(e){ return []; }
    // Two entries for the same bottle (same name and vintage, matching producer) become one.
    const merged=this._mergeDupes(list);
    if(merged.length!==list.length){ try{ this.save(merged); }catch(e){} }
    return merged;
  },
  _mergeDupes(list){
    const seen=new Map(), out=[];
    list.forEach(w=>{
      const k=String(w.name||'').toLowerCase()+'|'+this._vintageKey(w.vintage);
      const i=seen.get(k);
      if(i!=null&&this.same(out[i],w)) out[i]=this._merge(out[i],w);
      else { seen.set(k,out.length); out.push(w); }
    });
    // An entry saved without a vintage folds into the one dated entry of the same wine.
    const nv=w=>this._vintageKey(w.vintage)==='nv';
    if(!out.some(nv)) return out;
    const drop=new Set();
    out.forEach((w,i)=>{
      if(!nv(w)) return;
      const dated=out.map((d,j)=>j).filter(j=>!drop.has(j)&&!nv(out[j])&&this.same(out[j],w));
      if(dated.length!==1) return;
      const j=dated[0], newer=i<j;
      out[j]={...(newer?this._merge(w,out[j]):this._merge(out[j],w)),vintage:out[j].vintage};
      drop.add(i);
    });
    return out.filter((w,i)=>!drop.has(i));
  },
  /* One entry from two: the newer one's filled-in fields win, the score is the higher one, the
     scan dates span both, and a "Save for later" doesn't override tasting it or scoring it. */
  _merge(a,b){
    const filled=o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!=null&&v!==''&&v!==0));
    const m={...b,...filled(a)};
    m.rating=Math.max(a.rating||0,b.rating||0);
    m.times_consumed=Math.max(a.times_consumed||1,b.times_consumed||1);
    const t=x=>new Date(x||0).getTime()||0;
    m.scanned_at=t(a.scanned_at)&&t(b.scanned_at)?(t(a.scanned_at)<t(b.scanned_at)?a.scanned_at:b.scanned_at):(a.scanned_at||b.scanned_at);
    m.last_scanned=t(a.last_scanned)>=t(b.last_scanned)?a.last_scanned:b.last_scanned;
    if(a.scan_intent!==b.scan_intent&&[a.scan_intent,b.scan_intent].includes('checking')) m.scan_intent=a.scan_intent==='checking'?b.scan_intent:a.scan_intent;
    if(m.rating>0&&m.scan_intent==='checking') m.scan_intent='tasted';
    if(a.buy_again||b.buy_again) m.buy_again=true;
    return m;
  },
  save(wines){ Store.setJSON(this.KEY, wines.slice(0,500)); },

  /* Identity. Claude doesn't always name a bottle the same way twice ("Muga Reserva" vs "Muga
     Rioja Reserva"), so a rescan matches an existing entry when the vintage agrees, the producers
     share a word, and neither name has a word the other wine doesn't account for in its own
     name, producer, region, country or grapes. "Muga Gran Reserva" stays a different wine. */
  _STOP: new Set(['de','du','des','la','le','les','di','del','della','da','do','the','and','of','y','e','et','wine','vino','vin','wines','doc','docg','aoc','aop','igt','igp','doca','dop']),
  _tokens(...parts){
    const out=new Set();
    parts.flat().filter(Boolean).forEach(p=>String(p).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,' ').split(' ').forEach(t=>{ if(t&&!this._STOP.has(t)) out.add(t); }));
    return out;
  },
  // "Biondi-Santi", "Biondi Santi" and "BiondiSanti" are one producer.
  _squash(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); },
  _vintageKey(v){ return (!v||v===0||String(v).toUpperCase()==='NV')?'nv':String(v); },
  _t(w){ return (w.type||'').toLowerCase().replace('é','e'); },
  same(a,b){
    if(!a||!b) return false;
    const pa=this._tokens(a.producer), pb=this._tokens(b.producer);
    if(pa.size&&pb.size&&![...pa].some(t=>pb.has(t))){
      const sa=this._squash(a.producer), sb=this._squash(b.producer);
      if(!(sa.length>=4&&sb.length>=4&&(sa.includes(sb)||sb.includes(sa)))) return false;
    }
    if(a.name===b.name&&String(a.vintage)===String(b.vintage)) return true;
    // A scan that didn't read a vintage matches the same wine saved with one (it takes that
    // year: ScanFlow.resolve); two different years stay two wines.
    const va=this._vintageKey(a.vintage), vb=this._vintageKey(b.vintage);
    if(va!==vb&&va!=='nv'&&vb!=='nv') return false;
    if(this._t(a)&&this._t(b)&&this._t(a)!==this._t(b)) return false;
    const na=this._tokens(a.name), nb=this._tokens(b.name);
    if(![...na].some(t=>nb.has(t))) return false;
    const ctx=w=>this._tokens(w.name,w.producer,w.region,w.sub_region,w.country,w.grapes||[]);
    const ca=ctx(a), cb=ctx(b);
    return [...nb].every(t=>ca.has(t))&&[...na].every(t=>cb.has(t));
  },
  /* The same wine from a different year (both dated): what TasteMatch leans on hardest, since
     their score for the 2019 is the best guide to the 2022. Never the same entry: two years stay
     two wines in My Wines. */
  otherVintage(a,b){
    if(!a||!b) return false;
    const va=this._vintageKey(a.vintage), vb=this._vintageKey(b.vintage);
    return va!=='nv'&&vb!=='nv'&&va!==vb&&this.same(a,{...b,vintage:a.vintage});
  },
  _index(wines,wine){
    const i=wines.findIndex(w=>w.name===wine.name&&String(w.vintage)===String(wine.vintage)&&this.same(w,wine));
    return i>=0?i:wines.findIndex(w=>this.same(w,wine));
  },
  /* The saved entry for this wine (exact or a rescan under a slightly different name), or null. */
  find(wine){ if(!wine||!wine.name) return null; const wines=this.getAll(); const i=this._index(wines,wine); return i>=0?wines[i]:null; },

  track(wine){
    // Save a scanned wine immediately, even before rating
    if(!wine||!wine.name) return;
    const wines = this.getAll();
    const idx = this._index(wines,wine);
    const now = new Date().toISOString();
    if(idx>=0){
      // times_consumed is how many times they've had the wine, not how many times the camera saw
      // it: rescanning the same bottle within a few hours (a scan left half-way and done again)
      // is the same occasion.
      const last=new Date(wines[idx].last_scanned||wines[idx].scanned_at||0).getTime();
      if(!(Date.now()-last<this.SAME_OCCASION_MS)) wines[idx].times_consumed = (wines[idx].times_consumed||1) + 1;
      wines[idx].last_scanned = now;
    } else {
      wines.unshift({...wine, rating:0, times_consumed:1, scanned_at:now, last_scanned:now});
    }
    this.save(wines);
  },
  SAME_OCCASION_MS: 12*3600*1000,
  add(wine, rating){
    const wines = this.getAll();
    const idx = this._index(wines,wine);
    const now = new Date().toISOString();
    if(idx>=0){
      // Scoring a wine that's already saved (the usual case: it was saved when scanned) is not
      // another scan, so times_consumed stays put. Only track() counts scans.
      if(rating>0) wines[idx].rating = rating;
    } else {
      wines.unshift({...wine, rating:rating||0, times_consumed:1, scanned_at:now, last_scanned:now});
    }
    this.save(wines);
    if(rating>0){ try{ GrapeUnlocks.unlockViaRating((wine.grapes||[])[0]); }catch(e){} }
    return wines;
  },
  rate(name, vintage, rating){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(w){ w.rating=rating; this.save(wines); if(rating>0){ try{ GrapeUnlocks.unlockViaRating((w.grapes||[])[0]); }catch(e){} } }
  },
  /* Merge fields into a saved wine: corrections to a misread label (name, vintage, grapes...),
     tasting details, a purchase. Returns the updated entry. */
  update(name, vintage, patch){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(!w) return null;
    Object.assign(w, patch);
    this.save(wines);
    return w;
  },
  /* What the user noticed when they drank it: tasted[axis] is -1 / 0 / 1 against the label
     estimate (lighter / as expected / fuller, and so on), price_paid {amount, code}, buy_again,
     and where_had (where they drank it: shown on the wine, searched in My Wines, told to Vinny). */
  setTasting(name, vintage, {tasted, price_paid, buy_again, where_had}={}){
    const patch={};
    if(where_had!==undefined) patch.where_had=where_had;
    if(tasted) patch.tasted=tasted;
    if(price_paid!==undefined) patch.price_paid=price_paid;
    if(buy_again!==undefined) patch.buy_again=buy_again;
    return this.update(name, vintage, patch);
  },
  setBought(name, vintage, bought){ return this.update(name, vintage, {bought, bought_answered_at:new Date().toISOString()}); },
  /* Bottles waiting on the user: ones they've drunk (or bought) but not scored, and shelf checks
     from a while ago that we should ask about. `now` is injectable for tests. */
  pending(now=Date.now()){
    const wines=this.getAll();
    const age=w=>now-new Date(w.last_scanned||w.scanned_at||0).getTime();
    return {
      toScore:wines.filter(w=>!(w.rating>0)&&((w.scan_intent==='tasting'||w.scan_intent==='tasted')||w.bought===true)),
      toAsk:wines.filter(w=>!(w.rating>0)&&w.scan_intent==='checking'&&w.bought==null&&age(w)>=3*3600*1000),
    };
  },
  /* Optional, user-entered scan location — manual text only for now (no geolocation/reverse-geocoding yet). */
  setLocation(name, vintage, location){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(!w) return;
    if(location&&location.trim()) w.scan_location={name:location.trim(),added_at:new Date().toISOString()};
    else delete w.scan_location;
    this.save(wines);
  },
  /* 'checking' (deciding whether to buy), 'tasting' (about to drink), 'tasted' (already had it) \u2014 lets Wine Detail
     phrase the location prompt as \"where did you see/buy this\" vs \"where did you have this\". */
  setScanIntent(name, vintage, intent){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(w){ w.scan_intent=intent; this.save(wines); }
  },
  /* Put a removed wine back where it was (My Wines' Undo). */
  /* A backup's wines against this phone's: which are new and which are bottles already here. */
  planImport(list){
    const all=this.getAll(); let added=0, updated=0;
    (list||[]).forEach(w=>{ if(this._index(all,WineDNA.cleanWine(w))>=0) updated++; else added++; });
    return {added,updated};
  },
  /* Restoring a backup: new bottles are added, ones already here are merged (the more recently
     scanned side's details win, the higher score and the scan dates from both are kept), and the
     list stays newest first. */
  importWines(list){
    const all=this.getAll(); let added=0, updated=0;
    const t=w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0;
    (list||[]).map(w=>WineDNA.cleanWine(w)).forEach(w=>{
      const i=this._index(all,w);
      if(i<0){ all.push(w); added++; return; }
      all[i]=t(w)>t(all[i])?this._merge(w,all[i]):this._merge(all[i],w); updated++;
    });
    all.sort((a,b)=>t(b)-t(a));
    this.save(all);
    return {added,updated};
  },
  restore(wine, index){
    if(!wine||this.find(wine)) return;
    const wines = this.getAll();
    wines.splice(Math.max(0,Math.min(index==null?0:index,wines.length)),0,wine);
    this.save(wines);
  },
  /* Permanently remove a scan (e.g. an accidental scan) from history. */
  remove(name, vintage){
    const wines = this.getAll().filter(w => !(w.name===name && String(w.vintage)===String(vintage)));
    this.save(wines);
  },
  getProfile(){
    const wines = this.getAll();
    if(!wines.length) return {red:0,white:0,rose:0,sparkling:0,orange:0,dessert:0,fortified:0,total:0};
    const counts={red:0,white:0,rose:0,sparkling:0,orange:0,dessert:0,fortified:0};
    wines.forEach(w=>{ const t=(w.type||'').toLowerCase().replace('é','e'); if(counts[t]!==undefined) counts[t]++; else counts.red++; });
    const total=wines.length;
    return {...counts,total,redPct:counts.red/total,whitePct:counts.white/total,rosePct:counts.rose/total,sparklingPct:counts.sparkling/total,orangePct:counts.orange/total,dessertPct:counts.dessert/total,fortifiedPct:counts.fortified/total};
  }
};

