/* Vinterest — Notices: the inbox behind the bell on Home.
   One record per thing the app has to tell them (a new piece written for them, a milestone, answers
   fading, a bottle waiting for its rating, a while since their last scan), written by `check()` from
   the engines that already know it, kept until read. Push and the weekly email (the native apps,
   later) deliver the same records; this is the complete list whatever they swiped away.
   Kept as progress (synced and backed up): {items: {id: {type, title, text, at, read, link}}},
   so two phones combine key by key (Backup._combine) and a read on one is read on both.
   Categories are settings (PREFS_KEY, synced): a category switched off writes nothing new. */
const Notices = {
  KEY:'vinterest_notices', PREFS_KEY:'vinterest_notify',
  TYPES:{
    content:{label:'New content',desc:'Pieces written for you and picks ready to explore.',icon:'read'},
    progress:{label:'Your progress',desc:'Milestones reached and answers fading.',icon:'trophy'},
    reminder:{label:'Reminders',desc:'Bottles waiting for a rating, and a nudge when it\'s been a while.',icon:'wine'},
  },
  KEEP:60, LAPSE_DAYS:14,

  /* ---- preferences ---- */
  prefs(){ const v=Store.getJSON(this.PREFS_KEY,{}); const p={}; Object.keys(this.TYPES).forEach(t=>{ p[t]=!(v&&v[t]===false); }); return p; },
  allows(type){ return this.prefs()[type]!==false; },
  setPref(type,on){ if(!(type in this.TYPES)) return; const v=Store.getJSON(this.PREFS_KEY,{})||{}; v[type]=!!on; Store.setJSON(this.PREFS_KEY,v); this._fire(); },

  /* ---- the records ---- */
  _get(){ const v=Store.getJSON(this.KEY,null); return v&&typeof v==='object'&&v.items&&typeof v.items==='object'?v:{items:{}}; },
  _save(s){ Store.setJSON(this.KEY,s); this._fire(); },
  _fire(){ try{ window.dispatchEvent(new Event('vinterest:notices')); }catch(e){} },
  /* Adds one (id, type, title, text, link, at). Returns true if it's new. A category switched
     off, or an id already there, writes nothing. */
  add(n,now=Date.now()){
    if(!n||!n.id||!(n.type in this.TYPES)||!this.allows(n.type)) return false;
    const s=this._get(); if(s.items[n.id]) return false;
    s.items[n.id]={type:n.type,title:String(n.title||''),text:String(n.text||''),at:n.at||now,read:false,link:n.link||null};
    this._trim(s); this._save(s); return true;
  },
  remove(id){ const s=this._get(); if(!s.items[id]) return; delete s.items[id]; this._save(s); },
  _trim(s){ const ids=Object.keys(s.items).sort((a,b)=>s.items[b].at-s.items[a].at); ids.slice(this.KEEP).forEach(id=>{ delete s.items[id]; }); },
  list(){ const s=this._get(); return Object.entries(s.items).map(([id,n])=>({id,...n})).sort((a,b)=>b.at-a.at); },
  unread(){ return this.list().filter(n=>!n.read).length; },
  markRead(id){ const s=this._get(); if(!s.items[id]||s.items[id].read) return; s.items[id].read=true; this._save(s); },
  markAllRead(){ const s=this._get(); let ch=false; Object.values(s.items).forEach(n=>{ if(!n.read){ n.read=true; ch=true; } }); if(ch) this._save(s); },
  /* Opening one: marks it read and returns where it points ({learn}, {screen}, {wine}, {dna}). */
  open(id){ const n=this._get().items[id]; if(!n) return null; this.markRead(id); return n.link; },
  /* "2h ago", "Yesterday", "Mon", "3 Oct". */
  when(at,now=Date.now()){
    const d=now-at; if(d<60*1000) return 'Just now'; if(d<3600*1000) return `${Math.floor(d/60000)}m ago`; if(d<24*3600*1000) return `${Math.floor(d/3600000)}h ago`;
    if(d<48*3600*1000) return 'Yesterday'; const dt=new Date(at);
    if(d<7*24*3600*1000) return dt.toLocaleDateString('en-GB',{weekday:'short'});
    return dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  },

  /* ---- what the app has to say, from what it already knows ----
     Run on calm screens (pwa-app.jsx). Each record's id says what it's about, so a thing is
     told once; a fading set told and then refreshed is forgotten, so it can be told again. */
  check(now=Date.now()){
    if(!Settings.onboarded()) return;
    try{ this._content(now); }catch(e){}
    try{ this._progress(now); }catch(e){}
    try{ this._reminders(now); }catch(e){}
  },
  _content(now){
    const wines=WineHistory.getAll();
    ContentEngine.openShelf(wines).filter(s=>!LearnProgress.articleDone(s.id)&&!ContentEngine.stubLocked(s)).forEach(s=>{
      this.add({id:'article:'+s.id,type:'content',title:s.title,text:`Written for you${s.readTime?` · ${s.readTime}`:''}. ${s.subtitle||''}`.trim(),link:{learn:{kind:'article',id:s.id}}},now);
    });
    const seen=Flags.exploreReadySeen();
    if(seen) ExploreNext.readyTypes(wines).filter(k=>!seen.includes(k)).forEach(k=>{
      const tp=(typeof _TYPES!=='undefined'&&_TYPES.find(t=>t.key===k)||{}).label||k;
      this.add({id:'explore:'+k,type:'content',title:`Explore Next is ready for your ${tp.toLowerCase()}`,text:'Styles chosen from the ones you rate highest.',link:{dna:{type:k,section:'explore'}}},now);
    });
  },
  _progress(now){
    Milestones.list().filter(m=>m.at>0).forEach(m=>this.add({id:'milestone:'+m.id,type:'progress',title:m.title,text:'A milestone in your Mastery.',at:m.at,link:{screen:'mastery-map'}},now));
    const fading=KnowledgeMap.refreshers(now), labels=new Set(fading.map(f=>f.label));
    fading.forEach(f=>this.add({id:'refresh:'+f.label,type:'progress',title:`${f.fading} answers fading in ${f.label}`,text:'A quick quiz brings them back.',link:{learn:f.learn}},now));
    this.list().filter(n=>n.id.startsWith('refresh:')&&!labels.has(n.id.slice(8))).forEach(n=>this.remove(n.id));
  },
  _wineKey(w){ return `${String(w.name||'').toLowerCase()}|${WineHistory._vintageKey(w.vintage)}`; },
  _reminders(now){
    const wines=WineHistory.getAll();
    WineHistory.pending(now).toScore.forEach(w=>this.add({id:'rate:'+this._wineKey(w),type:'reminder',title:`Rate the ${WineDNA.nameYear(w)}`,text:'Every rating sharpens your matches.',link:{wine:{name:w.name,vintage:w.vintage}}},now));
    this.list().filter(n=>n.id.startsWith('rate:')).forEach(n=>{ const w=wines.find(x=>'rate:'+this._wineKey(x)===n.id); if(!w||w.rating>0) this.remove(n.id); });
    const last=Math.max(0,...wines.map(w=>new Date(w.last_scanned||w.scanned_at||0).getTime()||0));
    if(last&&now-last>=this.LAPSE_DAYS*24*3600*1000){
      const days=Math.floor((now-last)/(24*3600*1000));
      this.add({id:'lapse:'+new Date(last).toISOString().slice(0,10),type:'reminder',title:`${days} days since your last scan`,text:'The next bottle you open is a match waiting to be checked.',link:{screen:'camera'}},now);
    }
  },
};
