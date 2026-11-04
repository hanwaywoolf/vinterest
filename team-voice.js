/* TeamVoice: Vinny out loud at the table, and the server answering out loud (docs/business.md).

   - Speaking (speak): a cloud voice from the Worker's /tts when the server has one (four diners' voices, so
     tables don't all sound alike), else the phone's own voice: the Capacitor text-to-speech plugin in the
     iPhone and Android apps, else the browser's speechSynthesis. A sounds-like spelling (a card's `say`,
     "doh-MEN la-ROSH") is spoken as written, so a name comes out right even from a plain voice.
   - Listening (listen): the phone's own recognition, the Capacitor speech-recognition plugin in the apps
     (their web views have no SpeechRecognition), else the browser's (Chrome, Safari). Words come back as
     they're heard; nothing is recorded or stored, only the words.
   - Delivery (delivery): how they said it, worked out here from the words and the timings, with no call:
     pace, how long before they started, fillers, hedges, length, and whether each wine's name came through.
     It coaches; it never moves readiness or the guest's mark.

   Settings on this device only (vbiz_voice_v1): voice on or off, and whether the note on where speech goes
   has been seen. */
const TeamVoice = {
  KEY:'vbiz_voice_v1',
  PACE:{slow:110, fast:175},     // words a minute: under is slow, over is rushed
  WAIT_SLOW_MS:4000,             // a pause this long before starting reads as hesitant
  LONG_WORDS:70, SHORT_WORDS:8,  // longer than a guest wants to hear; too short to sell anything
  FILLERS:['um','umm','uh','uhh','er','erm','ah','you know','sort of','kind of','basically','literally'],
  HEDGES:["i think","i guess","maybe","perhaps","probably","i'm not sure","im not sure","not sure","might be","could be","i suppose"],

  _doc(){ return Store.getJSON(this.KEY,{})||{}; },
  _save(d){ Store.setJSON(this.KEY,d); },
  native(){ const n=window.VinterestNative||{}; return {tts:n.TextToSpeech||null,sr:n.SpeechRecognition||null}; },
  _SR(){ return window.SpeechRecognition||window.webkitSpeechRecognition||null; },
  canListen(){ return !!(this.native().sr||this._SR()); },
  canSpeak(){ return !!(this.native().tts||window.speechSynthesis||this._cloud); },
  on(){ const d=this._doc(); return d.on==null?this.canListen():!!d.on; },
  setOn(v){ const d=this._doc(); d.on=!!v; this._save(d); if(!v) this.stop(); },
  noticeSeen(){ return !!this._doc().notice; },
  markNotice(){ const d=this._doc(); d.notice=Date.now(); this._save(d); },
  // Where the words go, said plainly once: the phone's or browser's speech service turns them into text.
  where(){ if(this.native().sr) return 'Your phone turns what you say into text. Vinterest keeps only the words, never the recording.';
    const ua=navigator.userAgent||''; const who=/Chrome|CriOS|Android/.test(ua)&&!/Edg\//.test(ua)?'Google':/Safari/.test(ua)?'Apple':'your browser\'s speech service';
    return `Your browser turns what you say into text using ${who}. Vinterest keeps only the words, never the recording.`; },

  /* ── Speaking ── */
  _cloud:null, _audio:null, _cache:{},
  async cloudReady(){
    if(this._cloud!=null) return this._cloud;
    try{ const r=await fetch(Platform.api('/config')); const j=await r.json(); this._cloud=!!(j&&j.tts); }catch(e){ this._cloud=false; }
    return this._cloud; },
  // A tap is needed before a phone will play sound; the first tap at a table calls this.
  unlock(){ try{ if(!this._audio){ this._audio=new Audio(); this._audio.playsInline=true; }
      this._audio.src=this._silence(); this._audio.play().catch(()=>{}); }catch(e){}
    try{ if(window.speechSynthesis){ const u=new SpeechSynthesisUtterance(' '); u.volume=0; speechSynthesis.speak(u); } }catch(e){} },
  // A tenth of a second of silence as a WAV, made here, to play inside the first tap.
  _silence(){ if(this._sil) return this._sil; const n=800, b=new ArrayBuffer(44+n*2), v=new DataView(b), w=(o,str)=>{ for(let i=0;i<str.length;i++) v.setUint8(o+i,str.charCodeAt(i)); };
    w(0,'RIFF'); v.setUint32(4,36+n*2,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,8000,true); v.setUint32(28,16000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); w(36,'data'); v.setUint32(40,n*2,true);
    return this._sil=URL.createObjectURL(new Blob([b],{type:'audio/wav'})); },
  stop(){ try{ this._audio&&this._audio.pause(); }catch(e){} try{ window.speechSynthesis&&speechSynthesis.cancel(); }catch(e){} try{ const t=this.native().tts; t&&t.stop&&t.stop(); }catch(e){} },
  _lang(){ return (navigator.language||'en-GB').startsWith('en')?navigator.language||'en-GB':'en-GB'; },
  /* Says text; resolves when it has been said (or couldn't be). voice: 0-3, a table's diner. */
  // pace 'slow' for a name said on its own (Say it, the names check), so it can be heard and copied.
  async speak(text,{voice=0,cloud=true,pace}={}){
    const t=String(text||'').trim(); if(!t) return;
    this.stop();
    if(cloud&&await this.cloudReady()){
      try{
        const key=voice+'|'+(pace||'')+'|'+t; let url=this._cache[key];
        if(!url){ const r=await fetch(Platform.api('/tts'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:t,voice,pace})});
          if(r.status===404) this._cloud=false; if(!r.ok) throw new Error('tts '+r.status);
          url=URL.createObjectURL(await r.blob()); this._cache[key]=url; }
        if(!this._audio){ this._audio=new Audio(); this._audio.playsInline=true; }
        const a=this._audio; a.src=url;
        await new Promise(res=>{ a.onended=res; a.onerror=res; a.play().catch(res); });
        return;
      }catch(e){ /* fall through to the phone's own voice */ }
    }
    const n=this.native().tts;
    if(n){ try{ await n.speak({text:t,lang:this._lang(),rate:pace==='slow'?0.8:0.9,pitch:1.0,volume:1.0,category:'playback'}); return; }catch(e){} }
    if(window.speechSynthesis){
      await new Promise(res=>{ try{ const u=new SpeechSynthesisUtterance(t); u.lang=this._lang(); u.rate=pace==='slow'?0.8:0.9; u.onend=res; u.onerror=res;
        const vs=speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.startsWith('en')); if(vs.length) u.voice=vs[voice%vs.length];
        speechSynthesis.speak(u); setTimeout(res,Math.max(4000,t.length*90)); }catch(e){ res(); } });
    }
  },

  /* ── Listening ──
     listen({onWords}) starts the microphone and returns {stop(): Promise<{text, firstAt, lastAt, startedAt}>}.
     onWords(text) is called as words are heard. firstAt/lastAt are when the first and last words came, for pace. */
  listen({onWords}={}){
    const startedAt=Date.now(); let firstAt=0, lastAt=0, text='', finals='', done=null, stopped=false;
    const heard=(t)=>{ t=this.dedupe(t); const now=Date.now(); if(!firstAt&&t.trim()) firstAt=now; if(t.trim()) lastAt=now; text=t; onWords&&onWords(t); };
    // When the words come back in one piece there's no last-word time, so the moment they stopped speaking counts.
    const finish=()=>({text:text.trim(),firstAt,lastAt:lastAt>firstAt?lastAt:(firstAt?Date.now():0),startedAt});
    const n=this.native().sr;
    if(n){
      let sub=null;
      const go=async()=>{ try{ const p=await n.checkPermissions?.(); if(!p||p.speechRecognition!=='granted') await n.requestPermissions?.(); }catch(e){}
        try{ sub=await n.addListener('partialResults',d=>{ const m=(d&&d.matches)||[]; if(m[0]) heard(m[0]); }); }catch(e){}
        try{ await n.start({language:this._lang(),partialResults:true,popup:false,maxResults:1}); }catch(e){} };
      go();
      return {stop:async()=>{ if(!stopped){ stopped=true; try{ await n.stop(); }catch(e){} try{ sub&&sub.remove&&sub.remove(); }catch(e){} } return finish(); }};
    }
    const SR=this._SR(); if(!SR) return {stop:async()=>finish(),unsupported:true};
    const rec=new SR(); rec.lang=this._lang(); rec.interimResults=true; rec.continuous=true; rec.maxAlternatives=1;
    // Each event is read whole (every result of this session, rebuilt from scratch), never added onto the last: Android
    // Chrome sends every result as the whole utterance so far and repeats finals, and summing them ("finals +=")
    // filled the box with the same sentence twenty times over. A result that grows the one before replaces it.
    let session='';
    rec.onresult=e=>{ session=this.joinResults(Array.from(e.results).map(r=>r[0]&&r[0].transcript||'')); heard((finals+' '+session).replace(/\s+/g,' ').trim()); };
    rec.onend=()=>{ finals=(finals+' '+session).trim(); session='';  // what this session heard is kept when Chrome restarts it
      if(done){ done(finish()); done=null; } else if(!stopped){ try{ rec.start(); }catch(e){} } };  // Chrome stops after a pause; keep listening until they tap
    rec.onerror=()=>{};
    try{ rec.start(); }catch(e){}
    return {stop:()=>new Promise(res=>{ stopped=true; done=res; try{ rec.stop(); }catch(e){ res(finish()); } setTimeout(()=>{ if(done){ done(finish()); done=null; } },1500); })};
  },

  /* The results of one recognition session as one line: a result that starts with (or repeats) what came before
     replaces or is dropped rather than appended, so a recogniser that sends cumulative text doesn't duplicate it. */
  joinResults(parts){ let acc=''; for(const raw of parts){ const t=String(raw||'').trim(); if(!t) continue; const a=this._norm(acc), b=this._norm(t);
      if(!a||b.startsWith(a)) acc=t; else if(a.endsWith(b)||a.includes(b)) continue; else acc=acc+' '+t; }
    return acc.trim(); },
  /* Takes out a run of words said again straight after itself ("it's about 67 dollars a bottle it's about 67 dollars a
     bottle"), longest first, so a recogniser's echo never reaches the guest or the delivery coaching. */
  dedupe(text){ let w=String(text||'').split(/\s+/).filter(Boolean); if(w.length<6||w.length>600) return w.join(' ');
    const n=x=>x.toLowerCase().replace(/[^a-z0-9']/g,'');
    for(let changed=true;changed;){ changed=false;
      outer: for(let k=Math.floor(w.length/2);k>=3;k--) for(let i=0;i+2*k<=w.length;i++){ let same=true; for(let j=0;j<k;j++) if(n(w[i+j])!==n(w[i+k+j])){ same=false; break; }
          if(same){ w.splice(i+k,k); changed=true; break outer; } } }
    return w.join(' '); },

  /* ── Delivery ── */
  _norm(s){ return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim(); },
  _lev(a,b){ const m=a.length,n=b.length; if(!m) return n; if(!n) return m; let p=[...Array(n+1).keys()];
    for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; },
  _count(text,list){ const t=' '+this._norm(text)+' '; return list.reduce((a,w)=>{ const re=new RegExp(' '+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' ','g'); return a+((t.match(re)||[]).length); },0); },
  GENERIC:new Set(['chateau','domaine','domaines','the','les','des','del','della','de','du','la','le','classico','reserva','riserva','premier','cru','grand','late','harvest','old','year','brut','reserve','rose','blanc','rouge','bourgogne','pinot','noir','sauvignon','riesling','chablis','port','tawny','vintage','county']),
  /* Whether a wine's name came through: any telling word of it heard, allowing for how speech-to-text spells
     names it doesn't know ("Dönnhoff" as "don hof"), by closeness to single words and to pairs run together. */
  heardName(text,name){
    const tokens=this._norm(text).split(' ').filter(Boolean), cands=[...tokens,...tokens.slice(1).map((t,i)=>tokens[i]+t)].map(x=>x.replace(/'/g,''));
    const telling=this._norm(name).split(' ').map(x=>x.replace(/'/g,'')).filter(w=>w.length>3&&!this.GENERIC.has(w));
    if(!telling.length) return true;
    return telling.some(w=>cands.some(c=>c===w||(Math.abs(c.length-w.length)<=3&&this._lev(c,w)<=Math.max(1,Math.floor(w.length/4)))));
  },
  /* {words, wpm, waitMs, fillers, hedges, names:[{name, say, heard}], notes:[{good, text}]} */
  /* names: every wine on the list {name, say}; expected: the names a good answer would use. A wrong choice is the
     guest's mark to judge, so a name is only flagged when no wine on the list came through at all. */
  delivery({text,firstAt,lastAt,startedAt,askedAt,names=[],expected=[]}){
    const words=this._norm(text).split(' ').filter(Boolean).length;
    const speakMs=firstAt&&lastAt&&lastAt>firstAt?lastAt-firstAt:0;
    const wpm=speakMs>=1500&&words>=4?Math.round(words/(speakMs/60000)):null;
    const from=askedAt&&askedAt<=(startedAt||Infinity)?askedAt:startedAt;
    const waitMs=firstAt&&from?Math.max(0,firstAt-from):null;
    const fillers=this._count(text,this.FILLERS), hedges=this._count(text,this.HEDGES);
    const named=names.map(n=>({...n,heard:this.heardName(text,n.name)}));
    const notes=[];
    if(wpm!=null) notes.push(wpm>this.PACE.fast?{good:false,k:'pace',text:`Quick, at ${wpm} words a minute. Slow down a little so the name lands.`}:wpm<this.PACE.slow?{good:false,k:'pace',text:`Slow, at ${wpm} words a minute. A little more pace sounds surer.`}:{good:true,k:'pace',text:`A good pace, ${wpm} words a minute.`});
    if(waitMs!=null) notes.push(waitMs>this.WAIT_SLOW_MS?{good:false,k:'wait',text:`${(waitMs/1000).toFixed(1)} seconds before you started. Lead with the wine's name, then the reason.`}:{good:true,k:'wait',text:`Started in ${(waitMs/1000).toFixed(1)} seconds.`});
    if(fillers) notes.push({good:false,k:'fillers',text:`${fillers} filler${fillers===1?'':'s'} ("um", "sort of"). A short pause sounds more confident.`});
    if(hedges) notes.push({good:false,k:'hedges',text:`${hedges} hedge${hedges===1?'':'s'} ("I think", "maybe"). Say it as a recommendation: "I'd go for…".`});
    if(!fillers&&!hedges&&words>=this.SHORT_WORDS) notes.push({good:true,k:'clean',text:'No fillers or hedges: it sounded sure.'});
    if(words>this.LONG_WORDS) notes.push({good:false,k:'length',text:`${words} words is a lot at a table. Name it, give one reason, stop.`});
    else if(words&&words<this.SHORT_WORDS) notes.push({good:false,k:'length',text:'Very short. Add one reason the guest will want it.'});
    const heard=named.filter(n=>n.heard);
    if(heard.length) notes.push({good:true,k:'name',text:`"${heard[0].name}" came through clearly.`});
    else if(words>=this.SHORT_WORDS) named.filter(n=>expected.includes(n.name)).slice(0,1).forEach(n=>notes.push({good:false,k:'name',text:n.say?`No wine's name came through. If you meant the ${n.name}, try it as "${n.say}".`:`No wine's name came through. Say it clearly: the ${n.name}.`}));
    return {words,wpm,waitMs,fillers,hedges,names:named,notes};
  },
};
Object.assign(window,{TeamVoice});
