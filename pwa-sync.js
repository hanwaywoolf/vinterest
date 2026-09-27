/* Vinterest — Sync: keeps this phone's data and the signed-in user's cloud copy in step
   (docs/native-migration-spec.md §4, step 6).

   Local-first. Every screen keeps reading and writing the phone's storage exactly as before; this
   module watches those writes (Store.subscribe), and when someone is signed in it pulls the cloud
   copy, merges, and pushes what changed: about 3 seconds after the last change, when the app
   opens or comes back to the front, on sign-in, and every few minutes while it's open. A failed
   sync (offline, say) keeps its changes and tries again.

   What syncs, and how two phones' changes combine:
   - Wines: one row per bottle (`wines`, keyed by `key(wine)`). A bottle changed on one side only
     takes that side. Changed on both, the two are merged the way a backup restore merges them
     (WineHistory._merge: the more recently scanned side's details, the higher score, the larger
     times_consumed). A delete travels as a tombstone and wins over an edit made before it, but not
     over one made after it.
   - XP: combined, never lower than either side (XPSystem.mergedXP).
   - Progress (the backup's progress keys: unlocks, quiz answers, reads…): combined key by key
     (Backup._combine), except favourites, where the latest change wins so a removed one stays
     removed.
   - Settings (the backup's settings keys): the latest change to each one wins.
   Nothing else is synced: Pro and usage are the server's, caches are safe to lose, and Device,
   session handoffs, the sign-in itself and this module's own state stay on the phone.

   The first time a user signs in on a phone, everything on it is copied to
   vinterest_premigration_backup before anything is merged (the same shape as a backup file), so a
   bad merge can always be undone with WineDNA → Data Backup.

   Talks to Supabase's REST API directly with the user's own token; row-level security keeps every
   row to its owner. The database stamps each row's updated_at itself (0003_sync_times.sql), and
   "changed since" is asked from the latest stamp seen, so one phone's clock never hides another
   phone's changes. When a change happened (a delete against an edit) uses the phone's clock,
   clamped to a minute ahead. */
const Sync = {
  STATE_KEY:'vinterest_sync_v1', SNAPSHOT_KEY:'vinterest_premigration_backup',
  DEBOUNCE_MS:3000, INTERVAL_MS:5*60*1000, RETRY_MS:30*1000, FUTURE_MS:60*1000, PAGE:1000,
  LWW_PROGRESS:['vinterest_favorites'],

  /* ---- device-only state: what each synced thing looked like when it last matched the cloud ---- */
  // {user, lastPull, lastSynced, error, wines:{key:{h, s, t}}, deleted:{key:t}, times:{storeKey:t}}
  //   h: the wine as it is here (hash), s: as it was when last in step with the cloud, t: when it changed.
  _state(){ const s=Store.getJSON(this.STATE_KEY,null); return s&&typeof s==='object'?s:this._fresh(null); },
  _fresh(user){ return {user,lastPull:null,lastSynced:null,error:null,wines:{},deleted:{},times:{}}; },
  _save(s){ this._writing=true; try{ Store.setJSON(this.STATE_KEY,s); }finally{ this._writing=false; } },

  _now(){ return Date.now(); },
  _iso(t){ return new Date(t).toISOString(); },
  _ms(iso){ const t=new Date(iso||0).getTime()||0; return Math.min(t,this._now()+this.FUTURE_MS); },
  _hash(w){ return JSON.stringify(w); },

  /* A wine's row key: lower-case name and vintage ('nv' when missing), WineHistory's identity.
     Two different producers' wines of the same name and year on one phone get the producer added. */
  key(w){ return String(w.name||'').toLowerCase().trim()+'|'+WineHistory._vintageKey(w.vintage); },
  _keyed(list){
    const out=new Map();
    list.forEach(w=>{ let k=this.key(w); if(out.has(k)) k+='|'+WineHistory._squash(w.producer); if(!out.has(k)) out.set(k,w); });
    return out;
  },
  _settingsKey(k){ return Backup.SETTINGS_KEYS.includes(k); },
  _progressKey(k){ return Backup._isProgressKey(k); },

  /* ---- watching local writes ---- */
  // Signed out, nothing is recorded or sent: a first sync treats the phone's data as new.
  _onWrite(key){
    if(this._writing||this._applying||!this.enabled()) return;
    if(key===WineHistory.KEY){ this._noteWines(); this.schedule(); }
    else if(key===XPSystem.KEY){ this.schedule(); }
    else if(this._settingsKey(key)||this._progressKey(key)){
      const s=this._state(); s.times[key]=this._now(); this._save(s); this.schedule();
    }
  },
  /* Compares the wine list with what the state last saw: changed or new bottles get a change
     time, removed ones a tombstone. */
  _noteWines(s){
    const own=!s; s=s||this._state();
    const now=this._now(), here=this._keyed(Store.getJSON(WineHistory.KEY,[])||[]);
    here.forEach((w,k)=>{
      const h=this._hash(w), e=s.wines[k];
      if(!e){ s.wines[k]={h,s:null,t:now}; delete s.deleted[k]; }
      else if(e.h!==h){ e.h=h; e.t=now; }
    });
    Object.keys(s.wines).forEach(k=>{ if(!here.has(k)){ if(s.wines[k].s!=null) s.deleted[k]=now; delete s.wines[k]; } });
    if(own) this._save(s);
    return s;
  },

  /* ---- talking to Supabase ---- */
  async _rest(path,{method='GET',body,prefer}={}){
    const c=Account.config(), token=await Account.token();
    if(!c||!token) throw new Error('signed_out');
    const r=await fetch(c.url+'/rest/v1/'+path,{method,headers:{apikey:c.key,authorization:'Bearer '+token,'content-type':'application/json',
      ...(prefer?{prefer}:{})},body:body==null?undefined:JSON.stringify(body)});
    if(r.status===401){ Account.expired(); throw new Error('signed_out'); }
    if(!r.ok) throw new Error('HTTP '+r.status);
    return r.status===204||method!=='GET'?null:r.json();
  },
  async _pullWines(since){
    const rows=[]; let from=0;
    const filter=since?'&updated_at=gte.'+encodeURIComponent(since):'';
    for(;;){
      const page=await this._rest(`wines?select=wine_key,data,updated_at,deleted_at${filter}&order=updated_at.asc&offset=${from}&limit=${this.PAGE}`);
      rows.push(...page); if(page.length<this.PAGE) return rows; from+=this.PAGE;
    }
  },

  /* ---- the merge ---- */
  /* Applies the cloud's wine rows to the local list. Returns {list, push:[rows], taken:{key:t}}. */
  _mergeWines(s,cloudRows,uid){
    const here=this._keyed(Store.getJSON(WineHistory.KEY,[])||[]);
    const taken={};
    cloudRows.forEach(r=>{
      const k=r.wine_key, e=s.wines[k], mine=here.get(k);
      const rt=this._ms(r.deleted_at||r.updated_at);
      const dirty=!!(e&&e.h!==e.s);
      if(r.deleted_at){
        if(!mine){ delete s.deleted[k]; return; }
        if(dirty&&e.t>rt) return;                    // changed here after it was deleted there: keep it
        here.delete(k); delete s.wines[k]; delete s.deleted[k]; return;
      }
      const theirs=WineDNA.cleanWine(r.data||{});
      if(!mine){
        if(s.deleted[k]!=null&&s.deleted[k]>=rt) return; // deleted here after their last change
        delete s.deleted[k]; here.set(k,theirs); taken[k]=rt; return;
      }
      if(this._hash(mine)===this._hash(theirs)){ taken[k]=rt; return; }
      if(!dirty){ here.set(k,theirs); taken[k]=rt; return; }
      // Changed on both sides: combine, the more recently scanned side's details first.
      const at=w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0;
      here.set(k,at(mine)>=at(theirs)?WineHistory._merge(mine,theirs):WineHistory._merge(theirs,mine));
    });
    const t=w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0;
    const list=[...here.values()].sort((a,b)=>t(b)-t(a)).slice(0,500);
    return {list,taken};
  },
  _wineRow(uid,k,w,t){
    return {user_id:uid,wine_key:k,data:w,rating:w.rating>0?Math.min(100,Math.round(w.rating)):null,times_consumed:w.times_consumed||0,
      scan_intent:w.scan_intent||null,last_scanned:w.last_scanned||w.scanned_at||null,updated_at:this._iso(t),deleted_at:null};
  },

  _localDoc(keys){ const o={}; keys.forEach(k=>{ const v=Store.get(k); if(v!=null) o[k]=v; }); return o; },
  _settingsNow(){ return this._localDoc(Backup.SETTINGS_KEYS); },
  _progressNow(){ return this._localDoc(Store.keys('vinterest_').filter(k=>this._progressKey(k))); },
  /* Settings and favourites: per key, the later change wins. Progress: combined. */
  _mergeDoc(kind,s,cloud){
    const mineVals=kind==='settings'?this._settingsNow():this._progressNow();
    const theirVals=(cloud&&cloud.values)||{}, theirTimes=(cloud&&cloud.times)||{};
    const out={...mineVals}, times={};
    new Set([...Object.keys(mineVals),...Object.keys(theirVals)]).forEach(k=>{
      const mt=s.times[k]||0, tt=Math.min(theirTimes[k]||0,this._now()+this.FUTURE_MS);
      const lww=kind==='settings'||this.LWW_PROGRESS.includes(k);
      times[k]=Math.max(mt,tt);
      if(!(k in theirVals)) return;
      if(!(k in mineVals)){ out[k]=theirVals[k]; return; }
      if(lww){ if(tt>mt) out[k]=theirVals[k]; return; }
      if(Backup._fillOnly(k)) return;
      let a,b; try{ a=JSON.parse(mineVals[k]); b=JSON.parse(theirVals[k]); }catch(e){ return; }
      out[k]=JSON.stringify(Backup._combine(a,b));
    });
    return {values:out,times};
  },

  /* ---- one full sync ---- */
  async syncNow(){
    if(!this.enabled()) return {ok:false,reason:'signed_out'};
    if(this._running){ this._again=true; return this._running; }
    this._running=this._run().finally(()=>{ this._running=null; if(this._again){ this._again=false; this.schedule(0); } });
    return this._running;
  },
  async _run(){
    const uid=Account.session().user.id;
    let s=this._state();
    if(s.user!==uid){
      // First sync for this user on this phone: keep a copy of everything first.
      try{ Store.setJSON(this.SNAPSHOT_KEY,{...Backup.exportData(),snapshot_for:uid}); }catch(e){}
      s=this._fresh(uid);
    }
    this._noteWines(s);
    try{
      const since=s.lastPull?this._iso(this._ms(s.lastPull)-60*1000):null; // a little overlap: rows are idempotent
      const [rows,docs]=await Promise.all([this._pullWines(since),this._rest('user_docs?select=doc_key,data,updated_at')]);
      const doc=k=>{ const d=(docs||[]).find(x=>x.doc_key===k); return d?d.data:null; };

      // Wines
      const {list,taken}=this._mergeWines(s,rows,uid);
      const before=Store.get(WineHistory.KEY);
      this._applying=true;
      try{ if(JSON.stringify(list)!==before) WineHistory.save(list); }finally{ this._applying=false; }
      this._noteWines(s);
      Object.entries(taken).forEach(([k,t])=>{ const e=s.wines[k]; if(e&&this._hash(this._keyed(list).get(k))===e.h){ e.s=e.h; e.t=t; } });

      // XP, settings, progress
      const xpHere=XPSystem.get(), xpCloud=doc('xp');
      const xp=xpCloud?XPSystem.mergedXP(xpHere,xpCloud):xpHere;
      const settings=this._mergeDoc('settings',s,doc('settings'));
      const progress=this._mergeDoc('progress',s,doc('progress'));
      this._applying=true;
      try{
        if(JSON.stringify(xp)!==JSON.stringify(xpHere)) XPSystem.save(xp);
        [settings,progress].forEach(d=>Object.entries(d.values).forEach(([k,v])=>{ if(Store.get(k)!==v) Store.set(k,v); }));
      }finally{ this._applying=false; }
      Object.assign(s.times,settings.times,progress.times);

      // Push what the cloud doesn't have yet.
      const now=this._now(), pushW=[];
      const here=this._keyed(list);
      Object.entries(s.wines).forEach(([k,e])=>{ if(e.h!==e.s) pushW.push(this._wineRow(uid,k,here.get(k),now)); });
      Object.entries(s.deleted).forEach(([k,t])=>pushW.push({user_id:uid,wine_key:k,data:{},rating:null,times_consumed:0,scan_intent:null,last_scanned:null,updated_at:this._iso(now),deleted_at:this._iso(t)}));
      for(let i=0;i<pushW.length;i+=200)
        await this._rest('wines?on_conflict=user_id,wine_key',{method:'POST',body:pushW.slice(i,i+200),prefer:'resolution=merge-duplicates,return=minimal'});
      const docRows=[];
      if(!xpCloud||JSON.stringify(xpCloud)!==JSON.stringify(xp)) docRows.push({user_id:uid,doc_key:'xp',data:xp,updated_at:this._iso(now)});
      [['settings',settings],['progress',progress]].forEach(([k,d])=>{ if(JSON.stringify(doc(k))!==JSON.stringify(d)) docRows.push({user_id:uid,doc_key:k,data:d,updated_at:this._iso(now)}); });
      if(docRows.length) await this._rest('user_docs?on_conflict=user_id,doc_key',{method:'POST',body:docRows,prefer:'resolution=merge-duplicates,return=minimal'});

      Object.values(s.wines).forEach(e=>{ e.s=e.h; });
      s.deleted={};
      const newest=rows.reduce((m,r)=>r.updated_at>m?r.updated_at:m,s.lastPull||'');
      s.lastPull=newest||null; s.lastSynced=this._now(); s.error=null;
      this._save(s);
      const changed=JSON.stringify(list)!==before||JSON.stringify(xp)!==JSON.stringify(xpHere);
      this._emit(changed);
      return {ok:true,pulled:rows.length,pushed:pushW.length+docRows.length,changed};
    }catch(e){
      const msg=String(e&&e.message||e);
      if(msg!=='signed_out'){ s.error=msg; this._save(s); this.schedule(this.RETRY_MS); }
      this._emit(false);
      return {ok:false,reason:msg};
    }
  },

  /* ---- scheduling ---- */
  enabled(){ return typeof Account!=='undefined'&&Account.available()&&Account.signedIn()&&!!(Account.session().user||{}).id; },
  schedule(ms=this.DEBOUNCE_MS){
    if(!this.enabled()) return;
    clearTimeout(this._timer);
    this._timer=setTimeout(()=>this.syncNow(),ms);
    this._emit(false);
  },
  _emit(changed){ try{ window.dispatchEvent(new CustomEvent('vinterest:sync',{detail:{changed}})); }catch(e){} },

  /* For the account card: {enabled, lastSynced, pending (bottles/changes waiting), error, running}. */
  status(){
    const s=this._state(), en=this.enabled();
    const pending=en&&s.user===Account.session().user.id?Object.values(s.wines).filter(e=>e.h!==e.s).length+Object.keys(s.deleted).length:0;
    return {enabled:en,lastSynced:s.lastSynced,pending,error:s.error,running:!!this._running};
  },

  /* Home offers a backup (sign-in) once there's something worth losing: OFFER_AFTER bottles,
     sign-in available, not signed in, and not turned down before (spec D1: offered later). */
  OFFER_AFTER:3,
  offerBackup(wines){
    return typeof Account!=='undefined'&&Account.available()&&!Account.signedIn()&&(wines||[]).length>=this.OFFER_AFTER&&!Flags.backupOfferDismissed();
  },

  /* The account card's one line about backup, in words. */
  line(now=this._now()){
    const st=this.status();
    if(!st.enabled) return '';
    if(st.running&&!st.lastSynced) return 'Backing up your wines…';
    if(st.error) return st.pending?`${st.pending} change${st.pending===1?'':'s'} waiting to back up. We couldn't reach your account just now; trying again shortly.`:'We couldn\'t reach your account just now; trying again shortly.';
    if(!st.lastSynced) return 'Backing up your wines…';
    const mins=Math.floor((now-st.lastSynced)/60000);
    const ago=mins<1?'just now':mins<60?`${mins} minute${mins===1?'':'s'} ago`:mins<48*60?`${Math.floor(mins/60)} hour${mins<120?'':'s'} ago`:`${Math.floor(mins/1440)} days ago`;
    return st.pending?`Backed up ${ago}. ${st.pending} change${st.pending===1?'':'s'} waiting.`:`Your wines and progress are backed up to your account (${ago}).`;
  },

  start(){
    if(this._started||typeof window==='undefined') return;
    this._started=true;
    Store.subscribe(k=>this._onWrite(k));
    window.addEventListener('vinterest:account',()=>{ if(this.enabled()) this.schedule(0); });
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible'&&this.enabled()) this.schedule(0); });
    window.addEventListener('online',()=>{ if(this.enabled()) this.schedule(0); });
    setInterval(()=>{ if(document.visibilityState==='visible'&&this.enabled()) this.syncNow(); },this.INTERVAL_MS);
    if(this.enabled()) this.schedule(0);
  },
};
Sync.start();
