/* Vinterest — installing the web app to the home screen.

   Chrome only offers "Add to home screen" from its own menu when it decides the site can be
   installed, and it hides the option when it believes the app is already installed. This module
   lets the app offer the install itself (Chrome's beforeinstallprompt event, caught early by an
   inline script in index.html so none is missed while app.js loads) and says why it can't when it
   can't, so a missing option isn't guesswork. No storage: this is the browser's state, read live. */
const InstallApp = {
  _event:null, _installed:false, _relatedInstalled:null,

  init(){
    if(typeof window==='undefined') return;
    if(window.__vinterestInstallEvent) this._event=window.__vinterestInstallEvent;
    window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); this._event=e; this._emit(); });
    window.addEventListener('appinstalled',()=>{ this._installed=true; this._event=null; this._emit(); });
    // Asks Chrome whether this web app is installed (manifest related_applications, platform webapp).
    if(navigator.getInstalledRelatedApps){
      navigator.getInstalledRelatedApps().then(apps=>{ this._relatedInstalled=apps.length>0; this._emit(); }).catch(()=>{});
    }
  },
  _emit(){ try{ window.dispatchEvent(new Event('vinterest:install')); }catch(e){} },

  standalone(){
    try{ return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true; }catch(e){ return false; }
  },
  ios(){ return /iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1); },

  /* 'running'   opened from the home screen already
     'available' Chrome will install it: show the button
     'installed' Chrome says it's installed on this phone (just not opened from there)
     'ios'       Safari: only Share → Add to Home Screen works
     'waiting'   Chrome hasn't offered it (yet): see why() */
  status(){
    if(this.standalone()) return 'running';
    if(this._installed||this._relatedInstalled) return 'installed';
    if(this._event) return 'available';
    if(this.ios()) return 'ios';
    return 'waiting';
  },

  /* Shows Chrome's install dialog. Resolves 'accepted', 'dismissed' or 'unavailable'. */
  async prompt(){
    const e=this._event; if(!e) return 'unavailable';
    this._event=null; // Chrome allows each event to be used once
    try{ await e.prompt(); const c=await e.userChoice; if(c&&c.outcome==='accepted') this._installed=true; this._emit(); return (c&&c.outcome)||'dismissed'; }
    catch(err){ this._emit(); return 'unavailable'; }
  },

  /* What the browser reports, in words, for when the button doesn't appear. */
  why(){
    const out=[];
    if(!window.isSecureContext) out.push('The page isn\'t on a secure (https) address.');
    if(!('serviceWorker' in navigator)) out.push('This browser can\'t install web apps.');
    else if(!navigator.serviceWorker.controller) out.push('The app hasn\'t finished setting up offline support yet. Reload the page once.');
    if(this._relatedInstalled===true) out.push('Chrome says Vinterest is already installed on this phone.');
    if(!out.length) out.push('Chrome hasn\'t offered an install for this site. It does this when it thinks the app is already installed, or after the install was turned down or removed recently.');
    return out;
  },
};
InstallApp.init();
