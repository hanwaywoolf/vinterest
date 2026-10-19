/* Vinterest — Push: notifications to the phone when the app is closed (docs/push.md).

   The native apps only. Apple's APNs and Google's FCM, through Capacitor's PushNotifications plugin
   (window.VinterestNative.PushNotifications, bundled into app.js). The phone is asked for permission
   when the person switches notifications on in Profile (never at launch), and its token is sent to
   the Worker (POST /push/register) so the server can reach it. It needs an account, because what
   the server reminds about (a bottle waiting for its rating, a long gap, Pro ending) it works out
   from the wines Sync keeps. What to send is the server's; what the person wants is Notices.prefs()
   (the Reminders switch) plus the master switch here. A tap on one opens the same place the bell's
   record would (_openLink in pwa-screens-notices.jsx), through the `vinterest:push-open` event or,
   when the app was closed, the link held until the app is ready (takePending).
   On when: this build has push (VINTEREST_PUSH at build time, since Android's plugin needs the
   Firebase file), the Worker has keys (/config `push`), and there's an account. */
const Push = {
  KEY:'vinterest_push', // this phone only: {on, token, platform}
  // Built in by VINTEREST_PUSH=1 at build time (the release workflows), or window.VINTEREST_PUSH (tests).
  built(){ return (typeof __PUSH__!=='undefined'&&!!__PUSH__)||(typeof window!=='undefined'&&!!window.VINTEREST_PUSH); },
  _link:null,
  plugin(){ return Platform.native()?((window.VinterestNative||{}).PushNotifications||null):null; },
  state(){ return Store.getJSON(this.KEY,null)||{on:false}; },
  isOn(){ return !!this.state().on; },
  available(){ const c=(typeof Billing!=='undefined'&&Billing.config())||{}; return !!(this.built()&&this.plugin()&&Account.available()&&c.push); },
  _emit(){ try{ window.dispatchEvent(new Event('vinterest:push')); }catch(e){} },
  _tz(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone||null; }catch(e){ return null; } },

  /* 'unavailable' | 'signin' | 'on' | 'off' | 'blocked' (turned off in the phone's own settings). */
  async status(){
    if(!this.available()) return 'unavailable';
    if(!Account.signedIn()) return 'signin';
    let perm='prompt'; try{ perm=(await this.plugin().checkPermissions()).receive; }catch(e){}
    if(perm==='denied') return 'blocked';
    return this.isOn()&&perm==='granted'?'on':'off';
  },

  /* Once, when the app opens (Platform.start): listeners always, then a quiet re-register if they
     had it on, so a token the phone changed reaches the server. */
  async start(){
    const P=this.plugin(); if(!this.built()||!P||this._started) return; this._started=true;
    try{
      P.addListener('registration',t=>{ this._upload(t&&t.value); });
      P.addListener('registrationError',()=>{});
      P.addListener('pushNotificationActionPerformed',a=>{
        const d=(a&&a.notification&&a.notification.data)||{}; let link=d.link;
        if(typeof link==='string'){ try{ link=JSON.parse(link); }catch(e){ link=null; } }
        this.open(link&&typeof link==='object'?link:{screen:'home'});
      });
    }catch(e){}
    if(this.isOn()&&Account.signedIn()&&this.available()){
      try{ if((await P.checkPermissions()).receive==='granted') await P.register(); }catch(e){}
    }
  },
  SCREENS:['home','mywines','camera','profile','mastery-map','learn','notices'],
  /* A tapped notification's link, kept to places the app has (the server is ours, but a payload is input). */
  _clean(link){
    if(!link||typeof link!=='object') return {screen:'home'};
    if(link.screen&&!this.SCREENS.includes(link.screen)) return {screen:'home'};
    return link;
  },
  open(link){ link=this._clean(link); this._link=link; try{ window.dispatchEvent(new CustomEvent('vinterest:push-open',{detail:link})); }catch(e){} },
  /* A tap that opened the app: the link, once, for pwa-app.jsx to act on when it's ready. */
  takePending(){ const l=this._link; this._link=null; return l; },

  async _api(path,body){
    const t=await Account.token(); if(!t) return {ok:false,status:401};
    try{
      const r=await fetch(Platform.api(path),{method:'POST',headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:JSON.stringify(body||{})});
      let j=null; try{ j=await r.json(); }catch(e){}
      return {ok:r.ok,status:r.status,body:j};
    }catch(e){ return {ok:false,status:0}; }
  },
  async _upload(token){
    if(!token||!Account.signedIn()) return;
    const r=await this._api('/push/register',{token,platform:Platform.name(),tz:this._tz(),app_version:typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:''});
    if(r.ok) Store.setJSON(this.KEY,{on:true,token,platform:Platform.name()});
  },

  /* Switches notifications on: asks the phone, registers, and tells the server. {ok} or {error}. */
  async enable(){
    if(!this.available()) return {ok:false,error:'Notifications aren\'t available on this phone yet.'};
    if(!Account.signedIn()) return {ok:false,error:'Sign in first, so we can reach this phone.'};
    const P=this.plugin();
    try{
      let perm=(await P.checkPermissions()).receive;
      if(perm!=='granted') perm=(await P.requestPermissions()).receive;
      if(perm!=='granted'){ this._emit(); return {ok:false,blocked:true,error:'Notifications are off for Vinterest in your phone\'s settings. Turn them on there, then come back.'}; }
      Store.setJSON(this.KEY,{...this.state(),on:true});
      await P.register();
    }catch(e){ return {ok:false,error:'We couldn\'t turn notifications on. Try again in a moment.'}; }
    this._emit();
    return {ok:true};
  },
  /* Off: the server forgets this phone, and the phone stops listening. */
  async disable(){
    const s=this.state();
    await this.unlink();
    Store.setJSON(this.KEY,{on:false});
    try{ await this.plugin().unregister(); }catch(e){}
    this._emit();
    return {ok:true};
  },
  /* The server forgets this phone's token (sign-out, or switched off). */
  async unlink(){ const s=this.state(); if(s.token) await this._api('/push/unregister',{token:s.token}); },
  /* A notification to this person's own phones, to check it all works. */
  async test(){
    const r=await this._api('/push/test',{});
    return r.ok?{ok:true}:{ok:false,error:(r.body&&r.body.error)||'We couldn\'t send that just now.'};
  },
};
