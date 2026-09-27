/* Vinterest — Store: the one place the app reads and writes the browser's storage.

   Every logic module keeps its data through Store rather than touching localStorage or
   sessionStorage itself, and no screen touches either. That gives cloud sync one seam: a write to
   device storage (Store.set / setJSON / remove, never session writes) calls every subscriber with
   the key that changed, and the sync engine decides which keys it cares about.

   Reads and writes never throw: a private window, a full quota or blocked storage behaves like an
   empty store, the way each screen already treated it with its own try/catch. */
const Store = {
  _subs:new Set(),
  _area(session){ try{ return session?window.sessionStorage:window.localStorage; }catch(e){ return null; } },

  get(key,{session=false}={}){ try{ const s=this._area(session); return s?s.getItem(key):null; }catch(e){ return null; } },
  set(key,value,{session=false}={}){
    if(value==null) return this.remove(key,{session});
    try{ const s=this._area(session); if(!s) return false; s.setItem(key,String(value)); }catch(e){ return false; }
    if(!session) this._emit(key);
    return true;
  },
  remove(key,{session=false}={}){
    try{ const s=this._area(session); if(s) s.removeItem(key); }catch(e){ return false; }
    if(!session) this._emit(key);
    return true;
  },
  getJSON(key,fallback=null,opts){
    const raw=this.get(key,opts); if(raw==null) return fallback;
    try{ const v=JSON.parse(raw); return v==null?fallback:v; }catch(e){ return fallback; }
  },
  setJSON(key,value,opts){ return this.set(key,JSON.stringify(value),opts); },
  /* Every device-storage key starting with `prefix`. */
  keys(prefix='',{session=false}={}){
    const out=[]; try{ const s=this._area(session); if(!s) return out; for(let i=0;i<s.length;i++){ const k=s.key(i); if(k&&k.startsWith(prefix)) out.push(k); } }catch(e){}
    return out;
  },

  /* Called with the key after every device-storage write made through Store. Returns an unsubscribe. */
  subscribe(cb){ this._subs.add(cb); return ()=>this._subs.delete(cb); },
  _emit(key){ this._subs.forEach(cb=>{ try{ cb(key); }catch(e){} }); },
};

/* Local caches of generated content (scan cards, articles, prices, Explore results): safe to lose,
   never synced. JSON in, JSON out. */
const Cache = {
  get(key,fallback=null,{session=false}={}){ return Store.getJSON(key,fallback,{session}); },
  set(key,value,{session=false}={}){ return Store.setJSON(key,value,{session}); },
  getText(key,{session=false}={}){ return Store.get(key,{session}); },
  setText(key,value,{session=false}={}){ return Store.set(key,value,{session}); },
  remove(key,{session=false}={}){ return Store.remove(key,{session}); },
};

/* Errors the page caught (written by the error handler in index.html), shown on Profile (View error log). */
const ErrorLog = {
  KEY:'vinterest_errors',
  list(){ const v=Store.getJSON(this.KEY,[]); return Array.isArray(v)?v:[]; },
};
