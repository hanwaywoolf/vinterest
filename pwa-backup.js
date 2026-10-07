/* Vinterest — Backup: the file a user keeps (and later restores) of everything that's theirs.

   Format v2 (docs/native-migration-spec.md, step 3):
     {format:'vinterest-backup', version:2, exported, app, wines:[…], xp:{…},
      settings:{key: stored value}, progress:{key: stored value}}
   wines and xp are the owners' own shapes; settings and progress are the device keys as stored,
   so nothing is lost in translation. Not in a backup: Pro and the scan count (the server will own
   them), generated caches (safe to lose), and per-device choices (Device, session handoffs).

   Import accepts v2 and the original unversioned files ({wines, xp, exported}, whose xp is the bare
   account object, the shape the old import wrote straight into the envelope key). It never loses
   what's already on the phone: wines are merged bottle by bottle (WineHistory.importWines), XP only
   goes up (XPSystem.mergeImport), progress is combined (unlocks, answers and reads from both), and
   settings come from the backup, since restoring them is the point. `read` checks a file and says
   what would change without touching anything; `apply` does it. */
const Backup = {
  FORMAT:'vinterest-backup', VERSION:2,
  SETTINGS_KEYS:['vinterest_prefs','vinterest_age_ok','vinterest_country','vinterest_state','vinterest_city','vinterest_region','vinterest_currency',
    'vinterest_onboarded','vinterest_script_length','vinterest_scancard_style','vinterest_text_size','vinterest_travel'],
  PROGRESS_KEYS:['vinterest_favorites','vinterest_wineDNA_unlock_seen','vinterest_explore_ready_seen','vinterest_gen_stubs','vinterest_grape_unlocks_v1',
    'vinterest_region_unlocks_v1','vinterest_region_quiz_v1','vinterest_quiz_mastery_v1','vinterest_exposure_v1','vinterest_mastery_v1',
    'vinterest_guides_v1','vinterest_qexp_v1','vinterest_vocab_v1','vinterest_vinny_v1','vinterest_mastery_history','vinterest_milestones'],
  // Families of keys: read articles, Blind Call guesses, and the generated quiz banks the quiz
  // progress refers to (lose a bank and its progress points at questions that no longer exist).
  PROGRESS_PREFIXES:['vinterest_gen_article_','vinterest_blindcall_','vinterest_grape_quiz_','vinterest_region_quiz_bank_'],
  // Read markers for beginner articles are 'vinterest_<id>_done'.
  _isProgressKey(k){
    if(this.PROGRESS_KEYS.includes(k)) return true;
    if(k.startsWith('vinterest_gen_article_')) return k.endsWith('_done'); // not the article text cache
    if(this.PROGRESS_PREFIXES.some(p=>k.startsWith(p))) return true;
    return /^vinterest_[a-z0-9-]+_done$/.test(k)&&!k.startsWith('vinterest_gen_article_');
  },
  // Generated content, not counters: never combined field by field. _settleContent picks or joins them.
  _fillOnly(k){ return this._isBank(k)||k===this.STUBS_KEY; },
  _isBank(k){ return k.startsWith('vinterest_grape_quiz_')||k.startsWith('vinterest_region_quiz_bank_'); },
  STUBS_KEY:'vinterest_gen_stubs', QUIZ_KEY:'vinterest_quiz_mastery_v1', SHELF_UNREAD:6,

  /* Generated content when both sides have it ({key: stored text}, `out` already holding the
     combined counters). A new phone makes its own quiz bank the moment its first scan unlocks a
     grape or region, so keeping the phone's bank would leave every saved answer pointing at
     questions that no longer exist and put their most-studied grape back at 0%: each bank goes to
     the side more of the saved answers belong to (the phone's on a tie). Written for you shelves
     join by piece: the phone's, then every one from the other side they've read (their library),
     then its unread ones while the shelf has room. Writes the choices into `out`. */
  _settleContent(out,mine,theirs){
    let answered={};
    try{ const q=JSON.parse(out[this.QUIZ_KEY]||'null'); Object.values((q&&q.accounts)||{}).forEach(a=>Object.values((a&&a.sets)||{}).forEach(s=>Object.keys((s&&s.correct)||{}).forEach(t=>{ answered[t]=1; }))); }catch(e){}
    const known=text=>{ try{ const b=JSON.parse(text); return Array.isArray(b)?b.filter(x=>x&&answered[x.q]).length:-1; }catch(e){ return -1; } };
    Object.keys(theirs).filter(k=>this._isBank(k)&&k in mine&&mine[k]!==theirs[k]).forEach(k=>{
      out[k]=known(theirs[k])>known(mine[k])?theirs[k]:mine[k];
    });
    const k=this.STUBS_KEY;
    if(k in mine&&k in theirs&&mine[k]!==theirs[k]){
      let a,b; try{ a=JSON.parse(mine[k]); b=JSON.parse(theirs[k]); }catch(e){ return out; }
      if(!Array.isArray(a)||!Array.isArray(b)) return out;
      const read=st=>!!out['vinterest_gen_article_'+st.id+'_done'];
      const ids=new Set(a.map(st=>st&&st.id)), joined=[...a];
      let unread=a.filter(st=>st&&!read(st)).length;
      b.filter(st=>st&&st.id&&!ids.has(st.id)).forEach(st=>{
        if(read(st)) joined.push(st);
        else if(unread<this.SHELF_UNREAD){ joined.push(st); unread++; }
      });
      out[k]=JSON.stringify(joined);
    }
    return out;
  },

  exportData(){
    const settings={}, progress={};
    this.SETTINGS_KEYS.forEach(k=>{ const v=Store.get(k); if(v!=null) settings[k]=v; });
    Store.keys('vinterest_').filter(k=>this._isProgressKey(k)).forEach(k=>{ const v=Store.get(k); if(v!=null) progress[k]=v; });
    return {format:this.FORMAT,version:this.VERSION,exported:new Date().toISOString(),
      app:typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:null,
      wines:WineHistory.getAll(),xp:XPSystem.get(),settings,progress};
  },
  fileName(){ return 'vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json'; },

  /* Checks a backup file's text. {ok:true, data, summary} or {ok:false, error} with an error a
     person can act on. Changes nothing. */
  read(text){
    let d;
    try{ d=JSON.parse(text); }catch(e){ return {ok:false,error:'This file isn\'t a Vinterest backup: it isn\'t readable as a backup file at all.'}; }
    if(!d||typeof d!=='object'||Array.isArray(d)) return {ok:false,error:'This file isn\'t a Vinterest backup.'};
    const versioned=d.format===this.FORMAT;
    if(versioned&&typeof d.version==='number'&&d.version>this.VERSION)
      return {ok:false,error:'This backup was made by a newer version of Vinterest. Update the app, then try again.'};
    if(!versioned&&d.wines===undefined&&d.xp===undefined)
      return {ok:false,error:'This file isn\'t a Vinterest backup: it has no wines or XP in it.'};
    if(d.wines!==undefined&&!Array.isArray(d.wines)) return {ok:false,error:'The wines in this backup are damaged, so nothing was restored.'};
    const xp=d.xp==null?null:this._flatXP(d.xp);
    if(d.xp!=null&&!xp) return {ok:false,error:'The XP in this backup is damaged, so nothing was restored.'};
    const wines=(d.wines||[]).filter(w=>w&&typeof w==='object'&&typeof w.name==='string'&&w.name.trim());
    const obj=o=>o&&typeof o==='object'&&!Array.isArray(o)?Object.fromEntries(Object.entries(o).filter(([k,v])=>k.startsWith('vinterest_')&&typeof v==='string')):{};
    const settings=versioned?Object.fromEntries(Object.entries(obj(d.settings)).filter(([k])=>this.SETTINGS_KEYS.includes(k))):{};
    const progress=versioned?Object.fromEntries(Object.entries(obj(d.progress)).filter(([k])=>this._isProgressKey(k))):{};
    const data={version:versioned?d.version:1,exported:d.exported||null,wines,xp,settings,progress};
    const plan=WineHistory.planImport(wines);
    const before=XPSystem.get().total||0, after=xp?XPSystem.mergedXP(XPSystem.get(),xp).total:before;
    return {ok:true,data,summary:{version:data.version,exported:data.exported,newWines:plan.added,updatedWines:plan.updated,
      skippedWines:(d.wines||[]).length-wines.length,xpFrom:before,xpTo:after,
      settings:Object.keys(settings).length,progress:Object.keys(progress).length}};
  },
  /* One line for the confirmation: what restoring will do. */
  describe(s){
    const parts=[];
    if(s.newWines||s.updatedWines) parts.push(`${s.newWines} new wine${s.newWines===1?'':'s'}${s.updatedWines?`, ${s.updatedWines} merged with ones you have`:''}`);
    else parts.push('no new wines');
    if(s.xpTo>s.xpFrom) parts.push(`XP ${s.xpFrom} → ${s.xpTo}`);
    if(s.settings) parts.push('your settings');
    if(s.progress) parts.push(`learning progress (${s.progress} item${s.progress===1?'':'s'})`);
    const when=s.exported?` from ${String(s.exported).slice(0,10)}`:'';
    return `Backup${when}: ${parts.join(', ')}.${s.skippedWines?` ${s.skippedWines} damaged entr${s.skippedWines===1?'y':'ies'} will be skipped.`:''} Nothing on this phone is lost.`;
  },
  /* Restores a file `read` accepted. Returns the summary. */
  apply(data){
    const plan=WineHistory.importWines(data.wines||[]);
    if(data.xp) XPSystem.mergeImport(data.xp);
    Object.entries(data.settings||{}).forEach(([k,v])=>Store.set(k,v));
    const theirs=data.progress||{}, mine={}, out={};
    Object.keys(theirs).forEach(k=>{ const v=Store.get(k); if(v!=null) mine[k]=v; });
    Object.entries(theirs).forEach(([k,v])=>{
      if(!(k in mine)){ out[k]=v; return; }
      if(this._fillOnly(k)) return;
      let a,b; try{ a=JSON.parse(mine[k]); b=JSON.parse(v); }catch(e){ return; }
      out[k]=JSON.stringify(this._combine(a,b));
    });
    // Read markers and quiz answers this phone has but the file doesn't still count when choosing.
    const all={...mine,...out};
    Store.keys('vinterest_').filter(k=>!(k in all)&&this._isProgressKey(k)).forEach(k=>{ all[k]=Store.get(k); });
    this._settleContent(all,mine,theirs);
    Object.keys(theirs).forEach(k=>{ if(all[k]!=null&&all[k]!==mine[k]) Store.set(k,all[k]); });
    return plan;
  },
  /* Progress from two phones, combined without losing either: numbers take the larger, flags stay
     set once set, lists keep every entry, objects combine key by key; text keeps this phone's. */
  _combine(a,b){
    if(a==null) return b; if(b==null) return a;
    if(typeof a==='number'&&typeof b==='number') return Math.max(a,b);
    if(typeof a==='boolean'&&typeof b==='boolean') return a||b;
    if(Array.isArray(a)&&Array.isArray(b)){ const seen=new Set(a.map(x=>JSON.stringify(x))); return a.concat(b.filter(x=>!seen.has(JSON.stringify(x)))); }
    if(typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
      const out={...a}; Object.keys(b).forEach(k=>{ out[k]=k in a?this._combine(a[k],b[k]):b[k]; }); return out;
    }
    return a;
  },
  /* The bare XP account object, whether the file holds it bare (old backups, legacy v2) or in
     the accounts envelope. null if it isn't XP at all. */
  _flatXP(x){
    if(!x||typeof x!=='object'||Array.isArray(x)) return null;
    const flat=x.accounts&&typeof x.accounts==='object'?(x.accounts[XPSystem.ACCOUNT_ID]||Object.values(x.accounts)[0]):x;
    return flat&&typeof flat==='object'&&typeof flat.total==='number'?flat:null;
  },
  /* The old entry point, kept for callers: read and apply in one go. */
  importData(d){ const r=this.read(JSON.stringify(d)); if(!r.ok) throw new Error(r.error); this.apply(r.data); return r.data.wines.length; },
};
