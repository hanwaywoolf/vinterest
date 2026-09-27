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

  /* Checks the live site the way Chrome does before offering an install, from this phone:
     the manifest (reachable, the right type, readable, the fields Chrome needs), every icon
     (loads as an image of its stated size) and the service worker. Resolves [{ok, text}]. */
  async selfCheck(){
    const out=[], add=(ok,text)=>out.push({ok,text});
    let m=null;
    try{
      const r=await fetch('/manifest.json',{cache:'no-store'});
      const type=r.headers.get('content-type')||'';
      add(r.ok,`Manifest: ${r.status}, ${type||'no type'}`);
      m=await r.json();
      add(true,'Manifest reads correctly');
    }catch(e){ add(false,'Manifest can\'t be read: '+(e&&e.message||e)); }
    if(m){
      add(!!(m.name||m.short_name),'Name: '+(m.short_name||m.name||'missing'));
      add(!!m.start_url,'Start page: '+(m.start_url||'missing'));
      add(['standalone','fullscreen','minimal-ui'].includes(m.display),'Display: '+(m.display||'missing'));
      add(m.prefer_related_applications!==true,'Prefers another app: '+(m.prefer_related_applications?'yes':'no'));
      for(const ic of (m.icons||[])){
        const [w]=String(ic.sizes||'').split('x').map(Number);
        const got=await new Promise(res=>{ const img=new Image(); img.onload=()=>res(img.naturalWidth); img.onerror=()=>res(0); img.src=ic.src+(ic.src.includes('?')?'&':'?')+'check='+Date.now(); });
        add(got>0&&(!w||got===w),`Icon ${ic.sizes} ${ic.purpose||'any'}: ${got?got+'px':'didn\'t load'}`);
      }
    }
    try{
      const reg=navigator.serviceWorker&&await navigator.serviceWorker.getRegistration();
      add(!!(reg&&reg.active),'Offline support: '+(reg?(reg.active?'running, scope '+new URL(reg.scope).pathname:'installing'):'not registered'));
      add(!!(navigator.serviceWorker&&navigator.serviceWorker.controller),'This page is using it: '+(navigator.serviceWorker&&navigator.serviceWorker.controller?'yes':'no (reload once)'));
    }catch(e){ add(false,'Offline support: '+(e&&e.message||e)); }
    add(this._relatedInstalled!==true,'Chrome thinks it\'s installed: '+(this._relatedInstalled===null?'unknown':this._relatedInstalled?'yes':'no'));
    add(true,'Install offer from Chrome this visit: '+(this._event?'yes':'no'));
    add(true,'Browser: '+((navigator.userAgent.match(/(Chrome|CriOS|Firefox|SamsungBrowser|EdgA|Version)\/[\d.]+/)||['unknown'])[0]));
    return out;
  },

  /* What the browser reports, in words, for when the button doesn't appear. */
  why(){
    const out=[];
    if(!window.isSecureContext) out.push('The page isn\'t on a secure (https) address.');
    if(!('serviceWorker' in navigator)) out.push('This browser can\'t install web apps.');
    else if(!navigator.serviceWorker.controller) out.push('The app hasn\'t finished setting up offline support yet. Reload the page once.');
    if(this._relatedInstalled===true) out.push('Chrome says Vinterest is already installed on this phone.');
    if(!out.length){
      out.push('Chrome hasn\'t offered an install for this site. It does this when it thinks the app is already installed, or after the install was turned down or removed recently.');
      // Seen on a real phone: every check passed, Chrome offered no install for any site, and
      // clearing Chrome's cache (not its data) brought "Add to home screen" back.
      out.push('If every line below has a tick, Chrome itself is stuck: go to your phone\'s Settings → Apps → Chrome → Storage and tap Clear cache (not Clear storage, which would delete your wines). Then reopen Vinterest in Chrome.');
    }
    return out;
  },
};
InstallApp.init();
