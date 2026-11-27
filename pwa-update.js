/* Vinterest — AppUpdate: "A new version is out" on Home, for the phone apps.

   The Worker's GET /config carries `update` (appUpdate in _worker.js): for each store the newest
   version, optionally the oldest still supported (`min`) and a line on what's new, and the store's
   page. It comes down with the billing settings when the app opens (Billing.loadConfig), so
   announcing a release is a Cloudflare variable (APP_LATEST), never an app build, and every
   install from 1.11.4 on hears about every later one. The web app (testing only) never shows it.
   Dismissing hides it until the next version is announced; below `min` it can't be dismissed. */
const AppUpdate = {
  DISMISSED_KEY:'vinterest_update_dismissed', // device-only: the version they said "Not now" to
  /* "1.11.4 (214 · 2ba108e)" → [1, 11, 4] */
  parse(v){ const m=String(v||'').match(/(\d+)\.(\d+)(?:\.(\d+))?/); return m?[+m[1],+m[2],+(m[3]||0)]:null; },
  older(a,b){ a=this.parse(a); b=this.parse(b); if(!a||!b) return false;
    for(let i=0;i<3;i++){ if(a[i]!==b[i]) return a[i]<b[i]; } return false; },
  installed(){ return typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:null; },
  /* What Home shows: null, or {latest, note, url, required}. */
  offer(){
    if(!Platform.native()) return null;
    const c=(typeof Billing!=='undefined'&&Billing.config())||{}, u=c.update&&c.update[Platform.name()];
    const have=this.installed();
    if(!u||!u.latest||!u.url||!this.older(have,u.latest)) return null;
    const required=!!(u.min&&this.older(have,u.min));
    if(!required&&Store.get(this.DISMISSED_KEY)===u.latest) return null;
    return {latest:u.latest,note:u.note||null,url:u.url,required};
  },
  dismiss(latest){ Store.set(this.DISMISSED_KEY,latest); },
  /* A plain navigation, not a _blank link: Capacitor hands a page outside the app to the system,
     which opens the App Store or Play Store app on it, where a _blank link would get the in-app
     browser's web page of the listing. */
  open(url){ try{ window.location.href=url; }catch(e){} },
};
