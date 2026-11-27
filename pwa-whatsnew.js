/* Vinterest — WhatsNew: what changed, shown once on the first open of a new version.

   The notes ship inside each build (data/whats-new.json, newest version first), so they always
   describe the build that shows them and need no network. pending() is every version newer than
   the one this phone last saw, up to the installed one, newest first; the sheet (WhatsNewSheet in
   pwa-moments.jsx) waits for a calm screen once onboarding is done. Someone new never sees it:
   finishing onboarding marks the installed version as seen (markSeen), so they're never told about
   "new" things they've never used. Someone who had the app before this existed (onboarded, nothing
   seen yet) gets the installed version's notes. The version seen is this phone's own (device-only,
   never synced or backed up), so a second phone shows it once too. */
const WhatsNew = {
  KEY:'vinterest_whatsnew_seen',
  _data(){ return (_loadJSON('data/whats-new.json')||{}).versions||[]; },
  installed(){ return typeof __APP_VERSION__!=='undefined'?(AppUpdate.parse(__APP_VERSION__)||[]).join('.'):null; },
  seen(){ return Store.get(this.KEY)||null; },
  /* The versions to show, newest first: newer than the one last seen, no newer than this build. */
  pending(){
    const have=this.installed(); if(!have||!Settings.onboarded()) return [];
    if(typeof window!=='undefined'&&window.VINTEREST_WHATSNEW==='off') return []; // tests, unless they ask for it
    const seen=this.seen();
    return this._data().filter(e=>e&&e.v&&(e.items||[]).length&&!AppUpdate.older(have,e.v)&&(!seen||AppUpdate.older(seen,e.v)));
  },
  /* What the sheet lists: every item of the pending versions, newest version first. */
  items(){ return this.pending().reduce((a,e)=>a.concat(e.items.map(i=>({...i,v:e.v}))),[]); },
  markSeen(){ const v=this.installed(); if(v) Store.set(this.KEY,v); },
};
