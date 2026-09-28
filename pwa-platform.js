/* Vinterest — Platform: the web app or the Capacitor app (docs/native-migration-spec.md step 8).

   The same app.js runs in both. In the Capacitor app the page is bundled inside the app (served
   from capacitor://localhost or https://localhost), so there's no server behind it: the Worker's
   routes (/claude, /me, /account/delete) are called on the live site instead (API_ORIGIN, set at
   build time from VINTEREST_API_ORIGIN). Things only a browser needs (the service worker, the
   install card and the iOS "Add to Home Screen" hint) are skipped, and files are handed to the
   share sheet rather than downloaded, since a WebView has no downloads. The Capacitor bridge and
   its Share and Filesystem plugins are bundled into app.js with React (window.VinterestNative). */
const Platform = {
  API_ORIGIN:(typeof __API_ORIGIN__!=='undefined'&&__API_ORIGIN__)||'https://vinterest.pages.dev',
  native(){
    try{ const c=window.Capacitor; return !!(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform()); }catch(e){ return false; }
  },
  name(){ try{ return this.native()?window.Capacitor.getPlatform():'web'; }catch(e){ return 'web'; } },
  /* The URL for one of the Worker's routes: as is on the web, on the live site in the app. */
  api(path){ return this.native()?this.API_ORIGIN.replace(/\/+$/,'')+path:path; },

  /* Saves a text file the reader can keep: a download on the web; in the app, written to the
     app's cache and offered through the share sheet (Files, Drive, email…). Resolves 'saved',
     'shared', 'cancelled' or 'failed'. */
  async saveFile(name,text,type='application/json'){
    if(!this.native()){
      try{
        const url=URL.createObjectURL(new Blob([text],{type})), a=document.createElement('a');
        a.href=url; a.download=name; a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        return 'saved';
      }catch(e){ return 'failed'; }
    }
    const N=window.VinterestNative||{};
    if(!N.Filesystem||!N.Share) return 'failed';
    try{
      const r=await N.Filesystem.writeFile({path:name,data:text,directory:'CACHE',encoding:'utf8'});
      await N.Share.share({title:name,files:[r.uri]});
      return 'shared';
    }catch(e){ return /cancel/i.test(String(e&&e.message||e))?'cancelled':'failed'; }
  },
};
