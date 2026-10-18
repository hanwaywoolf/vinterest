/* Vinterest — Billing: buying Pro through RevenueCat (docs/revenuecat.md).

   RevenueCat's Capacitor plugin (window.VinterestNative.Purchases, bundled into app.js) shows the
   App Store or Google Play purchase sheet. Only the native apps can sell Pro; the web build has no
   purchases. Pro belongs to the account: RevenueCat's app user id is the Supabase user id, so the
   app asks for sign-in before it sells anything, and a subscription follows the person to a new
   phone. RevenueCat is the record of what they bought, but it is not what the app trusts: right
   after a purchase or a restore the Worker's POST /billing/sync copies RevenueCat's answer into
   `entitlements` (and RevenueCat's webhook keeps it right through renewals, cancellations and
   refunds), and the app reads Pro from /me as it always has (Account.tier()). The public SDK keys
   and the "everyone is Pro while testing" switch come from the Worker's GET /config, so neither
   needs an app update. Screens use this module, never the plugin. */
const Billing = {
  CONFIG_KEY:'vinterest_billing_config',
  config(){ return Store.getJSON(this.CONFIG_KEY,null); },
  /* The Worker's word on "everyone is Pro while testing" (its ALL_PRO variable), or null before
     it has been heard: Entitlement.allPro then uses its own constant. */
  allPro(){ const c=this.config(); return c&&typeof c.allPro==='boolean'?c.allPro:null; },
  sdk(){ return Platform.native()?((window.VinterestNative||{}).Purchases||null):null; },
  key(){ const c=this.config(); return (c&&c[Platform.name()])||null; },
  /* True when this phone can sell Pro: the app, the plugin, this store's key and sign-in. */
  available(){ return !!(this.sdk()&&this.key()&&typeof Account!=='undefined'&&Account.available()); },

  async loadConfig(){
    try{
      const r=await fetch(Platform.api('/config')); if(!r.ok) return this.config();
      const j=await r.json(), b=j&&j.billing||{}, before=this.allPro();
      Store.setJSON(this.CONFIG_KEY,{ios:b.ios||null,android:b.android||null,allPro:typeof j.allPro==='boolean'?j.allPro:null});
      if(before!==this.allPro()){ try{ window.dispatchEvent(new Event('vinterest:pro')); }catch(e){} }
    }catch(e){}
    return this.config();
  },

  /* Configures RevenueCat once, with the signed-in user's id when there is one. */
  _ready(){
    if(this._p) return this._p;
    this._p=(async()=>{
      const P=this.sdk(); if(!P||!this.key()) throw new Error('billing_off');
      const id=Account.userId();
      await P.configure({apiKey:this.key(),appUserID:id||undefined});
      this._user=id||null;
    })().catch(e=>{ this._p=null; throw e; });
    return this._p;
  },
  /* Keeps RevenueCat's user the signed-in one (sign-in, sign-out, a different account). */
  async identify(){
    if(!this.available()) return;
    try{
      await this._ready();
      const P=this.sdk(), id=Account.userId()||null;
      if(id&&this._user!==id){ await P.logIn({appUserID:id}); this._user=id; }
      else if(!id&&this._user){ await P.logOut(); this._user=null; }
    }catch(e){}
  },
  /* Once, when the app opens (Platform.start): the keys, then the user, then a quiet check that
     catches a purchase made on another phone or one that couldn't be confirmed at the time. */
  async start(){
    await this.loadConfig();
    if(!this.available()) return;
    window.addEventListener('vinterest:account',()=>{ this.identify(); });
    await this.identify();
    if(Account.signedIn()&&Account.tier()!=='pro') this.sync();
  },

  /* What's for sale, from the store (so the price is in the person's own currency):
     [{pkg, label:'Monthly'|'Yearly'|…, price:'£4.99', per:'month'|'year'|''}], or null. */
  async offers(){
    try{
      await this._ready();
      const o=await this.sdk().getOfferings(), cur=o&&o.current;
      const pk=(cur&&cur.availablePackages)||[]; if(!pk.length) return null;
      const NAME={MONTHLY:['Monthly','month'],ANNUAL:['Yearly','year'],WEEKLY:['Weekly','week'],TWO_MONTH:['2 months','2 months'],THREE_MONTH:['3 months','3 months'],SIX_MONTH:['6 months','6 months'],LIFETIME:['Lifetime','']};
      return pk.map(p=>{ const n=NAME[p.packageType]||[(p.product&&p.product.title)||'Pro','']; return {pkg:p,label:n[0],per:n[1],price:(p.product&&p.product.priceString)||''}; });
    }catch(e){ return null; }
  },
  /* Copies RevenueCat's answer into the account (the Worker), then re-reads /me. */
  async sync(){
    if(!Account.signedIn()) return {ok:false,error:'Sign in first.'};
    const t=await Account.token(); if(!t) return {ok:false,error:'Your sign-in has expired. Sign in again.'};
    let r; try{ r=await fetch(Platform.api('/billing/sync'),{method:'POST',headers:{authorization:'Bearer '+t}}); }
    catch(e){ return {ok:false,error:'We couldn\'t reach Vinterest to confirm it. Check your connection: Pro will turn on when you\'re back online.'}; }
    let j=null; try{ j=await r.json(); }catch(e){}
    if(r.status===401) Account.signOut({localOnly:true});
    if(!r.ok) return {ok:false,error:(j&&j.error)||'We couldn\'t confirm your purchase just now. It will turn on shortly; if it doesn\'t, tap Restore purchases.'};
    await Account.refreshMe();
    return {ok:true,tier:j.tier};
  },
  /* Buys one of the offers. {ok}, {cancelled:true} when they closed the sheet, or {error} in words. */
  async buy(offer){
    try{ await this._ready(); await this.identify(); await this.sdk().purchasePackage({aPackage:offer.pkg}); }
    catch(e){
      if(e&&(e.userCancelled||/cancel/i.test(String(e.message||'')))) return {ok:false,cancelled:true};
      return {ok:false,error:'The purchase didn\'t go through, and you haven\'t been charged. Try again in a moment.'};
    }
    const s=await this.sync();
    return s.ok?(s.tier==='pro'?{ok:true}:{ok:false,error:'Your purchase went through but Pro isn\'t showing yet. Tap Restore purchases in a minute.'}):{ok:true,late:true,error:s.error};
  },
  /* "Restore purchases" (Apple requires it): asks the store what this Apple or Google account bought, then confirms. */
  async restore(){
    try{ await this._ready(); await this.identify(); await this.sdk().restorePurchases(); }
    catch(e){ return {ok:false,error:'We couldn\'t reach the store to restore your purchases. Check your connection and try again.'}; }
    const s=await this.sync();
    if(!s.ok) return s;
    return s.tier==='pro'?{ok:true}:{ok:false,error:'There\'s no Pro subscription on this Apple or Google account to restore.'};
  },
  /* The store's own page for changing or cancelling a subscription. */
  async manage(){ try{ await this._ready(); await this.sdk().showManageSubscriptions(); }catch(e){} },
};
