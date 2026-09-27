/* Vinterest — owners for the small bits of user state the screens used to read and write
   themselves. Each keeps its keys exactly as before (so nothing on a device changes) and goes
   through Store, so sync sees every write.

   Synced (per docs/native-migration-spec.md §4): Settings, Favorites, Flags, LearnProgress.
   Server truth later, local for now: Entitlement. Device-only: Device, Handoff. */

/* Pro and the free scan allowance. For now these live on the device, which anyone can edit; the
   server will own them (entitlements and usage_counters) and this becomes a read-only cache of
   /me. Nothing else in the app reads vinterest_pro or vinterest_scan_count. */
const Entitlement = {
  PRO_KEY:'vinterest_pro', SCANS_KEY:'vinterest_scan_count',
  FREE_SCANS:10,
  isPro(){ return !!Store.get(this.PRO_KEY); },
  /* The Pro sheet's "Start Pro" (no real purchases yet). Screens listening for vinterest:pro update. */
  startPro(){ Store.set(this.PRO_KEY,'1'); try{ window.dispatchEvent(new Event('vinterest:pro')); }catch(e){} },
  scanCount(){ return parseInt(Store.get(this.SCANS_KEY)||'0'); },
  addScan(){ Store.set(this.SCANS_KEY,this.scanCount()+1); },
  atScanLimit(){ return !this.isPro()&&this.scanCount()>=this.FREE_SCANS; },
};

/* App settings that follow the user between devices. Location and the onboarding answers are
   UserPrefs (pwa-prefs.js); these are the rest. */
const Settings = {
  ONBOARDED_KEY:'vinterest_onboarded', REGION_KEY:'vinterest_region', CURRENCY_KEY:'vinterest_currency',
  SCRIPT_LENGTH_KEY:'vinterest_script_length', SCANCARD_STYLE_KEY:'vinterest_scancard_style',
  onboarded(){ return !!Store.get(this.ONBOARDED_KEY); },
  setOnboarded(){ Store.set(this.ONBOARDED_KEY,'1'); },
  region(){ return Store.get(this.REGION_KEY); },
  setRegion(r){ Store.set(this.REGION_KEY,r); },
  currency(){ return Store.get(this.CURRENCY_KEY); },
  /* How long sommelier scripts run: 'short' | 'long'. */
  scriptLength(){ return Store.get(this.SCRIPT_LENGTH_KEY)||'long'; },
  setScriptLength(len){ Store.set(this.SCRIPT_LENGTH_KEY,len); },
  /* Scan cards as a swipe deck or a list (set from the preview panel). */
  scancardStyle(){ return Store.get(this.SCANCARD_STYLE_KEY)||'deck'; },
};

/* Per-device choices that shouldn't follow the user: the phone-layout override used by the
   preview panel, and which WineDNA sections are folded away. */
const Device = {
  FORCE_MOBILE_KEY:'vinterest_force_mobile', DNA_COLLAPSE_KEY:'vinterest_dna_collapsed_v1',
  forceMobile(){ return Store.get(this.FORCE_MOBILE_KEY)==='1'; },
  dnaCollapsed(){ return Store.getJSON(this.DNA_COLLAPSE_KEY,null); },
  setDnaCollapsed(v){ Store.setJSON(this.DNA_COLLAPSE_KEY,v); },
};

/* Wines hearted on the detail screen, by name and vintage. */
const Favorites = {
  KEY:'vinterest_favorites',
  list(){ const v=Store.getJSON(this.KEY,[]); return Array.isArray(v)?v:[]; },
  _is(f,w){ return f.name===(w&&w.name)&&String(f.vintage)===String(w&&w.vintage); },
  has(w){ return this.list().some(f=>this._is(f,w)); },
  /* Adds or removes the wine; returns whether it's now a favourite. */
  toggle(w){
    const favs=this.list(), i=favs.findIndex(f=>this._is(f,w));
    if(i>=0) favs.splice(i,1); else favs.push({name:w&&w.name,vintage:w&&w.vintage});
    Store.setJSON(this.KEY,favs);
    return i<0;
  },
};

/* One-off moments the user has already seen. */
const Flags = {
  WINEDNA_UNLOCK_SEEN_KEY:'vinterest_wineDNA_unlock_seen',
  wineDNAUnlockSeen(){ return !!Store.get(this.WINEDNA_UNLOCK_SEEN_KEY); },
  markWineDNAUnlockSeen(){ Store.set(this.WINEDNA_UNLOCK_SEEN_KEY,'1'); },
};

/* What they've read: beginner articles (vinterest_<id>_done) and Written for you pieces
   (vinterest_gen_article_<id>_done). */
const LearnProgress = {
  onRampDone(id){ return !!Store.get('vinterest_'+id+'_done'); },
  markOnRamp(id){ Store.set('vinterest_'+id+'_done','1'); },
  articleKey(id){ return 'vinterest_gen_article_'+id+'_done'; },
  articleDone(id){ return !!Store.get(this.articleKey(id)); },
  markArticle(id){ Store.set(this.articleKey(id),'1'); },
};

/* What one screen hands the next for this visit (session storage, never synced): the wine to
   show, the quiz to start, the article or guide to open. */
const Handoff = {
  _j(key){ return { get:(fallback=null)=>Store.getJSON(key,fallback,{session:true}), set:v=>Store.setJSON(key,v,{session:true}) }; },
  _s(key){ return { get:()=>Store.get(key,{session:true}), set:v=>Store.set(key,v,{session:true}) }; },
  get scanResult(){ return this._j('vinterest_scan_result'); },
  /* Open a wine: `data` is the scan_result shape ({wine, demo, source, view, existingRating…}). */
  openWine(data){ this.scanResult.set(data); },
  /* Change one part of the current scan result (tracked, the corrected wine…). */
  updateScanResult(patch){ this.scanResult.set({...this.scanResult.get({}),...patch}); },
  get wineList(){ return this._j('vinterest_winelist_result'); },
  get quiz(){ return this._j('vinterest_quiz_config2'); },
  get genArticle(){ return this._j('vinterest_gen_article'); },
  get guide(){ return this._s('vinterest_guide'); },
  get onRampIdx(){ return this._s('vinterest_onramp_idx'); },
  get styleExplore(){ return this._j('vinterest_style_explore'); },
  /* How My Wines should open (type and sort), read once. */
  myWinesView:{ set:v=>Store.setJSON('vinterest_mywines_view',v,{session:true}),
    take(){ const v=Store.getJSON('vinterest_mywines_view',null,{session:true}); Store.remove('vinterest_mywines_view',{session:true}); return v||{}; } },
  /* "Is this it?" answered for this scan. */
  confirmed(key){ return !!Store.get(key,{session:true}); },
  setConfirmed(key){ Store.set(key,'1',{session:true}); },
};
