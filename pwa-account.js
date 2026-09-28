/* Vinterest — Account: optional sign-in (docs/native-migration-spec.md step 5, decision D1).

   Sign-in is a 6-digit code emailed by Supabase, typed into the app. A code rather than a magic
   link, because a link opened from the mail app lands in the browser, not in the installed app.
   Nothing needs an account: signed out, the app works as it always has. Signed in, Pro and
   fair-use limits come from the server (/me in _worker.js), and cloud sync follows in step 6.

   The session (tokens) and the last /me answer are kept on this device only: never synced and
   never in a backup. The project URL and publishable key are public; the build fills them in
   from Cloudflare's SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (window.VINTEREST_SUPABASE lets a
   test set them). Without them, sign-in simply isn't offered. */
const Account = {
  SESSION_KEY:'vinterest_session', ME_KEY:'vinterest_me',
  REFRESH_EARLY_S:60,

  config(){
    const built=typeof __SUPABASE__!=='undefined'?__SUPABASE__:null;
    const c=built||(typeof window!=='undefined'&&window.VINTEREST_SUPABASE)||null;
    return c&&c.url&&c.key?c:null;
  },
  available(){ return !!this.config(); },
  session(){ return Store.getJSON(this.SESSION_KEY,null); },
  signedIn(){ const s=this.session(); return !!(s&&s.refresh_token); },
  email(){ const s=this.session(); return (s&&s.user&&s.user.email)||null; },
  /* The server's last word on their plan and this week's usage: {tier, usage, caps, …}. */
  me(){ return this.signedIn()?Store.getJSON(this.ME_KEY,null):null; },
  tier(){ const m=this.me(); return (m&&m.tier)||'free'; },

  async _auth(path,body,token){
    const c=this.config(); if(!c) return {ok:false,status:0,body:null};
    let r; try{
      r=await fetch(c.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:c.key,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
    }catch(e){ return {ok:false,status:0,body:null}; }
    let j=null; try{ j=await r.json(); }catch(e){}
    return {ok:r.ok,status:r.status,body:j};
  },
  _save(j){
    const exp=j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600);
    Store.setJSON(this.SESSION_KEY,{access_token:j.access_token,refresh_token:j.refresh_token,expires_at:exp,
      user:{id:j.user&&j.user.id,email:j.user&&j.user.email}});
    this._emit();
  },
  _emit(){ try{ window.dispatchEvent(new Event('vinterest:account')); }catch(e){} },
  _cleanEmail(e){ return String(e||'').trim().toLowerCase(); },

  /* Emails a sign-in code. {ok} or {ok:false, error} in words a person can act on. */
  async requestCode(email){
    email=this._cleanEmail(email);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return {ok:false,error:'That doesn\'t look like an email address.'};
    const r=await this._auth('otp',{email,create_user:true});
    if(r.ok) return {ok:true};
    if(r.status===429) return {ok:false,error:'Too many codes asked for. Wait a minute, then try again.'};
    if(r.status===0) return {ok:false,error:'We couldn\'t reach the sign-in service. Check your connection and try again.'};
    return {ok:false,error:'We couldn\'t send a code to that address. Check it and try again.'};
  },
  /* Checks the code from the email; signed in on success. */
  async verifyCode(email,code){
    email=this._cleanEmail(email); code=String(code||'').replace(/\D/g,'');
    if(code.length<6) return {ok:false,error:'Enter the 6-digit code from the email.'};
    const r=await this._auth('verify',{type:'email',email,token:code});
    if(!r.ok||!r.body||!r.body.access_token){
      if(r.status===0) return {ok:false,error:'We couldn\'t reach the sign-in service. Check your connection and try again.'};
      return {ok:false,error:'That code didn\'t work. It may have expired: check it, or send a new one.'};
    }
    this._save(r.body);
    await this.refreshMe();
    return {ok:true};
  },
  /* A current access token for the Worker (refreshed when it's about to run out), or null. */
  async token(){
    const s=this.session(); if(!s||!s.refresh_token) return null;
    if(s.access_token&&s.expires_at-this.REFRESH_EARLY_S>Date.now()/1000) return s.access_token;
    const r=await this._auth('token?grant_type=refresh_token',{refresh_token:s.refresh_token});
    if(r.ok&&r.body&&r.body.access_token){ this._save(r.body); return r.body.access_token; }
    // Refused (revoked or long expired): signed out. Offline: try again next time.
    if(r.status>=400&&r.status<500) this.signOut({localOnly:true});
    return null;
  },
  /* Asks the Worker for their plan and usage, and keeps the answer for display and Pro checks. */
  async refreshMe(){
    if(!this.signedIn()) return null;
    const t=await this.token(); if(!t) return this.me();
    try{
      const r=await fetch(Platform.api('/me'),{headers:{authorization:'Bearer '+t}});
      if(r.status===401){ this.signOut({localOnly:true}); return null; }
      if(!r.ok) return this.me();
      const j=await r.json();
      Store.setJSON(this.ME_KEY,{...j,at:Date.now()});
      this._emit();
      return j;
    }catch(e){ return this.me(); }
  },
  /* Deletes their account for good (Worker /account/delete: the Supabase user and every row of
     theirs), then everything Vinterest keeps on this phone, so the app starts again at onboarding.
     Nothing is removed from the phone unless the server confirms the account is gone. Sync stays
     off while it runs (Sync.enabled checks `deleting`), so nothing is pushed back up meanwhile. */
  deleting:false,
  async deleteAccount(){
    if(!this.signedIn()) return {ok:false,error:'You\'re not signed in.'};
    this.deleting=true;
    try{
      const t=await this.token();
      if(!t) return {ok:false,error:'Your sign-in has expired. Sign in again, then delete your account.'};
      let r; try{ r=await fetch(Platform.api('/account/delete'),{method:'POST',headers:{authorization:'Bearer '+t}}); }
      catch(e){ return {ok:false,error:'We couldn\'t reach your account. Check your connection and try again.'}; }
      let j=null; try{ j=await r.json(); }catch(e){}
      if(!r.ok){
        if(r.status===401) this.signOut({localOnly:true});
        return {ok:false,error:(j&&j.error)||'Your account couldn\'t be deleted just now. Try again in a minute.'};
      }
      this.clearDevice();
      this._emit();
      return {ok:true};
    }finally{ this.deleting=false; }
  },
  /* Everything Vinterest keeps in this browser, the session first. */
  clearDevice(){
    Store.remove(this.SESSION_KEY);
    for(const session of [false,true]) Store.keys('vinterest_',{session}).forEach(k=>Store.remove(k,{session}));
  },
  /* The Worker said the sign-in is no longer valid. */
  expired(){ this.signOut({localOnly:true}); },
  async signOut({localOnly=false}={}){
    const s=this.session();
    if(!localOnly&&s&&s.access_token) await this._auth('logout',{},s.access_token);
    Store.remove(this.SESSION_KEY); Store.remove(this.ME_KEY);
    this._emit();
  },
};
