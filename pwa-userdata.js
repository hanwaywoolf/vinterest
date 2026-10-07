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
  // Signed in, Pro is whatever the server says (Account.me(), from /me). Signed out, the device
  // flag the Pro sheet sets (no real purchases exist yet); the server never trusts it.
  /* While testing, before real purchases exist, everyone is Pro: every Pro feature is open and
     no Pro sheet or scan limit shows (the Worker's ALL_PRO_FOR_TESTING matches, for signed-in
     accounts). Set false to bring the free plan back. Tests set window.VINTEREST_REAL_PLANS to
     check the free plan as it will ship. */
  ALL_PRO_FOR_TESTING:true,
  allPro(){ return this.ALL_PRO_FOR_TESTING&&!(typeof window!=='undefined'&&window.VINTEREST_REAL_PLANS); },
  isPro(){
    if(this.allPro()) return true;
    if(typeof Account!=='undefined'&&Account.signedIn()) return Account.tier()==='pro';
    return !!Store.get(this.PRO_KEY);
  },
  /* The Pro sheet's "Start Pro" (no real purchases yet). Screens listening for vinterest:pro update. */
  startPro(){ Store.set(this.PRO_KEY,'1'); try{ window.dispatchEvent(new Event('vinterest:pro')); }catch(e){} },
  scanCount(){ return parseInt(Store.get(this.SCANS_KEY)||'0'); },
  addScan(){ Store.set(this.SCANS_KEY,this.scanCount()+1); },
  atScanLimit(){ return !this.isPro()&&this.scanCount()>=this.FREE_SCANS; },
  /* What wine list scanning still needs: null (go ahead), 'signin' or 'pro'. The Worker checks this
     itself (list_scan is PRO_ONLY in _worker.js) and never trusts the device flag, so with sign-in
     configured a signed-out phone needs to sign in even after "Start Pro", and a signed-in one needs
     Pro on the account. Without sign-in configured the Worker can't check, so the device flag counts. */
  listScanNeeds(){
    if(typeof Account!=='undefined'&&Account.available()){
      if(!Account.signedIn()) return 'signin';
      // While testing, any signed-in account may scan lists (OPEN_TO_SIGNED_IN in _worker.js).
      return null;
    }
    return this.isPro()?null:'pro';
  },
};

/* App settings that follow the user between devices. Location and the onboarding answers are
   UserPrefs (pwa-prefs.js); these are the rest. */
const Settings = {
  ONBOARDED_KEY:'vinterest_onboarded', REGION_KEY:'vinterest_region', CURRENCY_KEY:'vinterest_currency',
  SCRIPT_LENGTH_KEY:'vinterest_script_length', SCANCARD_STYLE_KEY:'vinterest_scancard_style',
  onboarded(){ return !!Store.get(this.ONBOARDED_KEY); },
  setOnboarded(){ Store.set(this.ONBOARDED_KEY,'1'); },
  region(){ return Store.get(this.REGION_KEY); },
  currency(){ return Store.get(this.CURRENCY_KEY); },
  /* How long sommelier scripts run: 'short' | 'long'. */
  scriptLength(){ return Store.get(this.SCRIPT_LENGTH_KEY)||'long'; },
  setScriptLength(len){ Store.set(this.SCRIPT_LENGTH_KEY,len); },
  /* Scan cards as a swipe deck or a list (set from the preview panel). */
  scancardStyle(){ return Store.get(this.SCANCARD_STYLE_KEY)||'deck'; },
};

/* Per-device choices that shouldn't follow the user: the phone-layout override used by the
   preview panel, which WineDNA sections are folded away, and what the grape cluster last showed. */
const Device = {
  FORCE_MOBILE_KEY:'vinterest_force_mobile', DNA_COLLAPSE_KEY:'vinterest_dna_collapsed_v1',
  forceMobile(){ return Store.get(this.FORCE_MOBILE_KEY)==='1'; },
  dnaCollapsed(){ return Store.getJSON(this.DNA_COLLAPSE_KEY,null); },
  setDnaCollapsed(v){ Store.setJSON(this.DNA_COLLAPSE_KEY,v); },
  /* Each grape's score when Mastery's grape cluster was last seen on this phone, so the berries
     grow from there to today's size. */
  GRAPES_SEEN_KEY:'vinterest_grape_cluster_seen',
  grapesSeen(){ return Store.getJSON(this.GRAPES_SEEN_KEY,{})||{}; },
  setGrapesSeen(v){ Store.setJSON(this.GRAPES_SEEN_KEY,v); },
  /* Which Mastery sections they've folded away on this phone ({id: true}), kept for next time. */
  MASTERY_COLLAPSE_KEY:'vinterest_mastery_collapsed_v1',
  masteryCollapsed(){ const v=Store.getJSON(this.MASTERY_COLLAPSE_KEY,{}); return v&&typeof v==='object'?v:{}; },
  setMasteryCollapsed(v){ Store.setJSON(this.MASTERY_COLLAPSE_KEY,v); },
  /* How Mastery's grapes and regions were last shown on this phone, kept for next time:
     {grapes: 'bunch'|'list', grapeSkin: 'red'|'white', regions: 'map'|'list', regionView: view id}. */
  MASTERY_VIEW_KEY:'vinterest_mastery_view_v1',
  masteryView(){ const v=Store.getJSON(this.MASTERY_VIEW_KEY,{}); return v&&typeof v==='object'?v:{}; },
  setMasteryView(patch){ Store.setJSON(this.MASTERY_VIEW_KEY,{...this.masteryView(),...patch}); },
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
  /* The wine types whose "Explore Next is ready" moment has been shown (ExploreNext.toCelebrate);
     null until the app first looks. */
  EXPLORE_READY_KEY:'vinterest_explore_ready_seen',
  exploreReadySeen(){ return Store.getJSON(this.EXPLORE_READY_KEY,null); },
  setExploreReadySeen(types){ Store.setJSON(this.EXPLORE_READY_KEY,types); },
  /* The camera's "you can pick a photo from your gallery too" tip: shown on the first
     GALLERY_HINT_TIMES visits to the camera, then never again. */
  GALLERY_HINT_KEY:'vinterest_gallery_hint_v1', GALLERY_HINT_TIMES:3,
  galleryHintDue(){ return (parseInt(Store.get(this.GALLERY_HINT_KEY)||'0')||0)<this.GALLERY_HINT_TIMES; },
  markGalleryHint(){ Store.set(this.GALLERY_HINT_KEY,(parseInt(Store.get(this.GALLERY_HINT_KEY)||'0')||0)+1); },
  BACKUP_OFFER_KEY:'vinterest_backup_offer_dismissed',
  backupOfferDismissed(){ return !!Store.get(this.BACKUP_OFFER_KEY); },
  dismissBackupOffer(){ Store.set(this.BACKUP_OFFER_KEY,'1'); },
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
  /* The grape whose page (GrapeScreen) to open. */
  get grapePage(){ return this._s('vinterest_grape_page'); },
  /* The region whose page (RegionPageScreen) to open. */
  get regionPage(){ return this._s('vinterest_region_page'); },
  /* The palate trait whose page (PalateTraitScreen) to open: body, acidity, tannins or texture. */
  get palateTrait(){ return this._s('vinterest_palate_trait'); },
  /* Where Mastery was when a grape's page opened ({top, view: 'bunch'|'list'}), so going back
     lands on the grapes, not the top of the screen. Read once. */
  masteryReturn:{ set:v=>Store.setJSON('vinterest_mastery_return',v,{session:true}),
    take(){ const v=Store.getJSON('vinterest_mastery_return',null,{session:true}); Store.remove('vinterest_mastery_return',{session:true}); return v; } },
  get onRampIdx(){ return this._s('vinterest_onramp_idx'); },
  get styleExplore(){ return this._j('vinterest_style_explore'); },
  /* How My Wines should open (type and sort), read once. */
  myWinesView:{ set:v=>Store.setJSON('vinterest_mywines_view',v,{session:true}),
    take(){ const v=Store.getJSON('vinterest_mywines_view',null,{session:true}); Store.remove('vinterest_mywines_view',{session:true}); return v||{}; } },
  /* Why Profile was opened: 'backup' (Home's backup offer) or 'listscan' (Wine List on the camera)
     opens the sign-in at the email step. Read once. */
  accountIntent:{ set:v=>Store.set('vinterest_account_intent',v,{session:true}),
    take(){ const v=Store.get('vinterest_account_intent',{session:true}); Store.remove('vinterest_account_intent',{session:true}); return v; } },
  /* The camera's starting mode: 'list' from Scan's Wine List card. Read once. */
  cameraMode:{ set:v=>Store.set('vinterest_camera_mode',v,{session:true}),
    take(){ const v=Store.get('vinterest_camera_mode',{session:true}); Store.remove('vinterest_camera_mode',{session:true}); return v; } },
  /* "Is this it?" answered for this scan. */
  confirmed(key){ return !!Store.get(key,{session:true}); },
  setConfirmed(key){ Store.set(key,'1',{session:true}); },
};
