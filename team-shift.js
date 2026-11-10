/* The shift: tonight's specials and the pre-shift briefing (docs/business.md "The pre-shift briefing").

   Management sets what's 86'd and on feature (TeamData.tonight) and adds the kitchen's specials here, from a photo of
   the chef's handwriting, a typed line or a spoken one. One call (purpose team_special, prompts/team-special.txt)
   reads them and pairs each from the restaurant's own list; nothing reaches the team until the manager approves it,
   with the allergens confirmed by the kitchen. "Send briefing" then puts all of it in front of every person, who
   reads and accepts it before the app opens that day (TeamShift.needsAck, the layer in team-app.jsx). A special marked
   sold out shows on everyone's Today at once, with no second acceptance; a new special or a changed one is a new
   version, accepted again with what's new marked.

   Kept on this device in a key of its own (vbiz_shift_v1), as rows a server will hold once restaurants have accounts:
   specials, the briefing as sent, who accepted which version, and the log of what sold out. A special is never part
   of the list or menu, never drilled and never counts towards readiness: it's gone by the end of its run. */
const TeamShift={
  KEY:'vbiz_shift_v1',
  _empty(){ return {specials:[],sent:null,acks:{},log:[]}; },
  get(){ const d=Store.getJSON(this.KEY,null); return d&&Array.isArray(d.specials)?{...this._empty(),...d}:this._empty(); },
  save(d){ Store.setJSON(this.KEY,d); try{ window.dispatchEvent(new Event('vbiz:data')); }catch(e){} },
  reset(){ Store.remove(this.KEY); },
  _day(now=Date.now()){ return TeamData._day(now); },
  /* The end of the phone's calendar day, `days` on from today: how long a special runs. */
  endOf(days=0,now=Date.now()){ const x=new Date(now); x.setHours(23,59,59,999); x.setDate(x.getDate()+days); return x.getTime(); },
  RUNS:[{k:'tonight',label:'Tonight only',days:0},{k:'week',label:'Through Sunday',days:null},{k:'open',label:'Until I take it off',days:-1}],
  untilOf(run,now=Date.now()){ if(run==='open') return null; if(run==='week'){ const dow=new Date(now).getDay(); return this.endOf(dow===0?0:7-dow,now); } return this.endOf(0,now); },
  runLine(s,now=Date.now()){ if(s.until==null) return 'Until taken off'; if(s.until<=this.endOf(0,now)) return 'Tonight only';
    return 'Until '+new Date(s.until).toLocaleDateString(undefined,{weekday:'long'}); },

  /* ── Specials ── */
  _id(){ return 'sp-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); },
  _running(s,now=Date.now()){ return (s.status==='live'||s.status==='soldout')&&(s.until==null||s.until>=now); },
  /* What the team sees: approved and still running, sold out or not. */
  specials(now=Date.now()){ return this.get().specials.filter(s=>this._running(s,now)); },
  special(id){ return this.get().specials.find(s=>s.id===id)||null; },
  /* Waiting for the manager: read from a photo or typed, not yet approved. */
  drafts(){ return this.get().specials.filter(s=>s.status==='draft'); },
  /* Ones that have run out or been taken off, newest first, one per name: "Bring back" brings Friday's fish back with
     its pairing kept. Never one that's running again. */
  past(now=Date.now()){ const d=this.get(), live=new Set(d.specials.filter(s=>s.status==='draft'||this._running(s,now)).map(s=>this._norm(s.name))), seen=new Set();
    return d.specials.filter(s=>s.status!=='draft'&&!this._running(s,now)).sort((a,b)=>(b.at||0)-(a.at||0)).filter(s=>{ const k=this._norm(s.name); if(live.has(k)||seen.has(k)) return false; seen.add(k); return true; }).slice(0,8); },
  _norm(x){ return String(x||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim(); },
  _wine(id){ const w=id&&TeamData.wine(id); return w&&w.onList?w:null; },
  /* What Claude sent, made safe: wines that are on the list (a glass pick only if it's poured by the glass), allergens
     from the restaurant's own list, a price that's a number. */
  _clean(x,source){ const codes=new Set(TeamData.allergenList().map(a=>a.code)), pick=p=>p&&this._wine(p.id)?{id:p.id,why:String(p.why||'').trim()}:null;
    const name=String(x.name||'').trim(); if(!name) return null;
    const bottle=pick(x.bottle), g=pick(x.glass), glass=g&&TeamData.byGlass(TeamData.wine(g.id))?g:null, used=new Set([bottle&&bottle.id,glass&&glass.id]);
    const price=x.price==null||x.price===''?null:Number(String(x.price).replace(/[^0-9.]/g,''));
    return {id:this._id(),name,description:String(x.description||'').trim(),price:Number.isFinite(price)&&price>0?price:null,section:String(x.section||'other'),
      allergens:(x.allergens||[]).filter(a=>a&&codes.has(a.code)).map(a=>({code:a.code,sure:a.sure==='stated'?'stated':'likely'})),confirmed:false,
      pairing:{bottle,glass,alts:(x.alts||[]).map(pick).filter(p=>p&&!used.has(p.id)).slice(0,3),say:String(x.say||'').trim()},
      unclear:String(x.unclear||'').trim(),status:'draft',run:'tonight',until:null,source,at:Date.now()}; },
  /* A photo of the chef's board (base64 JPEG) or a typed or spoken note -> drafts, each paired from the list. Throws
     with words the manager can read when the call fails; `typed` then keeps what they wrote as a draft with no
     pairing, so a special can still go out when the connection is down (the manager picks the wine). */
  async read({b64,text}={}){
    const tpl=_loadTextSync('prompts/team-special.txt'), v=TeamData.get().venue||{};
    const input=b64?`The specials are in the photo.${text?' The manager adds: '+text:''}`:`The manager's note:\n${String(text||'').trim()}`;
    const prompt=tpl.replace(/\{\{venue\}\}/g,v.name||'the restaurant').replace('{{about}}',TeamData.about()).replace('{{list}}',TeamData._listLines()).replace('{{menu}}',TeamData._menuLines())
      .replace('{{allergens}}',TeamData.allergenList().map(a=>`${a.code} (${a.name})`).join(', ')).replace('{{input}}',input);
    const content=b64?[{type:'text',text:prompt},{type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}}]:prompt;
    const j=TeamData._json(await window.claude.complete({purpose:'team_special',messages:[{role:'user',content}]}))||{};
    const items=(j.specials||[]).map(x=>this._clean(x,b64?'photo':'typed')).filter(Boolean);
    if(!items.length) throw new Error(b64?"We couldn't read a special in that photo. Try again closer, or type it in.":"We couldn't make a special out of that. Give the dish's name and what's in it.");
    const d=this.get(); d.specials.push(...items); this.save(d); return items; },
  /* A special typed in with no call: its name (and a price at the end of the line, "Halibut, brown butter 34"). */
  typed(text){ const line=String(text||'').trim(); if(!line) return null; const m=line.match(/^(.*?)[\s,·-]+[£$€]?\s?(\d+(?:\.\d{1,2})?)$/);
    const body=m?m[1]:line, i=body.search(/[,:(]| with /i), name=(i>0?body.slice(0,i):body).trim(), rest=i>0?body.slice(i).replace(/^[,:(\s]+|with\s+/i,'').replace(/\)$/,'').trim():'';
    const s=this._clean({name:name.charAt(0).toUpperCase()+name.slice(1),description:rest?rest.charAt(0).toUpperCase()+rest.slice(1)+'.':'',price:m?m[2]:null},'typed'); if(!s) return null;
    const d=this.get(); d.specials.push(s); this.save(d); return s; },
  update(id,fields){ const d=this.get(), s=d.specials.find(x=>x.id===id); if(!s) return null; Object.assign(s,fields); this.save(d); return s; },
  /* The kitchen's word on an allergen: tap one to add or take it off; either way the kitchen has to confirm again. */
  toggleAllergen(id,code){ const s=this.special(id); if(!s) return; const has=s.allergens.some(a=>a.code===code);
    this.update(id,{allergens:has?s.allergens.filter(a=>a.code!==code):[...s.allergens,{code,sure:'stated'}],confirmed:false}); },
  /* Which wine is poured with it: `slot` is bottle or glass; the wine it replaces joins the alternatives. */
  setWine(id,slot,wineId,why=''){ const s=this.special(id), w=this._wine(wineId); if(!s||!w||(slot==='glass'&&!TeamData.byGlass(w))) return false;
    const p={...s.pairing}, old=p[slot], from=(p.alts||[]).find(a=>a.id===wineId); p[slot]={id:wineId,why:why||(from&&from.why)||''};
    p.alts=[...(p.alts||[]).filter(a=>a.id!==wineId),...(old&&old.id!==wineId?[old]:[])].slice(0,3); p.say=''; this.update(id,{pairing:p}); return true; },
  /* Approve: on everyone's Today and in the briefing from now until its run ends. Only with the allergens confirmed. */
  approve(id,now=Date.now()){ const s=this.special(id); if(!s||!s.confirmed) return false;
    this.update(id,{status:'live',until:this.untilOf(s.run||'tonight',now),at:now,soldAt:null}); return true; },
  discard(id){ const d=this.get(), s=d.specials.find(x=>x.id===id); if(!s) return; if(s.status==='draft') d.specials=d.specials.filter(x=>x.id!==id); else { s.status='ended'; s.endedAt=Date.now(); } this.save(d); },
  /* Sold out (or back on): on every Today at once, with the time. Never asks for the briefing to be accepted again. */
  soldOut(id,on=true,now=Date.now()){ const d=this.get(), s=d.specials.find(x=>x.id===id); if(!s||!this._running(s,now)) return false;
    s.status=on?'soldout':'live'; s.soldAt=on?now:null; d.log=[...(d.log||[]).filter(e=>this._day(e.at)===this._day(now)),{kind:on?'soldout':'back',id,name:s.name,at:now}].slice(-40); this.save(d); return true; },
  /* A past special again, as a draft with its pairing and allergens kept; the kitchen confirms the allergens afresh. */
  bringBack(id){ const d=this.get(), s=d.specials.find(x=>x.id===id); if(!s) return null;
    const n={...s,id:this._id(),status:'draft',confirmed:false,run:'tonight',until:null,soldAt:null,endedAt:null,at:Date.now(),source:'again'}; d.specials.push(n); this.save(d); return n; },
  /* What sold out since this person accepted the briefing (or today, if there's none), still sold out. */
  soldSince(pid,now=Date.now()){ const d=this.get(), a=(d.acks||{})[pid], from=a&&this._day(a.at)===this._day(now)?a.at:0, live=new Set(this.specials(now).filter(s=>s.status==='soldout').map(s=>s.id));
    return (d.log||[]).filter(e=>e.kind==='soldout'&&this._day(e.at)===this._day(now)&&e.at>=from&&live.has(e.id)); },
  time(at){ try{ return new Date(at).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } },
  price(s){ return s&&s.price!=null?TeamData.money(s.price,{dp:s.price%1?2:0}):''; },
  allergenLine(s){ return (s.allergens||[]).map(a=>TeamData.allergenName(a.code)).join(', '); },
  /* What to say at the table: Claude's line, else one built from the pick. */
  sayLine(s){ const p=s.pairing||{}; if(p.say) return p.say; const w=this._wine((p.glass||p.bottle||{}).id); return w?`Tonight's special is the ${s.name}; it's lovely with the ${TeamData.short(w)}.`:''; },

  /* ── The briefing ── */
  /* Everything tonight's briefing says, as plain data: what's off, the specials, what we're pushing, the note. The
     same for everyone; `look` (wines this person should glance at) is added per person by the screen. */
  content(now=Date.now()){ const tn=TeamData.tonight(now), line=id=>{ const c=TeamData.card(id)||TeamData.cocktailCard(id); return c&&c.pitch?String(c.pitch).split(/(?<=[.!?])\s+/)[0]:''; };
    return {off:tn.off.map(id=>TeamData.dish(id)).filter(Boolean),specials:this.specials(now),
      feature:tn.feature.map(id=>TeamData.wine(id)||TeamData.cocktail(id)).filter(Boolean).map(x=>({item:x,line:line(x.id)})),note:String(tn.note||'').trim()}; },
  empty(c){ return !c.off.length&&!c.specials.length&&!c.feature.length&&!c.note; },
  /* What a version of the briefing held, to tell what's new in the next. A special sold out is the same special. */
  _snap(c){ return {off:c.off.map(x=>x.id),feature:c.feature.map(f=>f.item.id),note:c.note,
    specials:Object.fromEntries(c.specials.map(s=>[s.id,[s.name,s.description,s.price,this.allergenLine(s),(s.pairing.bottle||{}).id,(s.pairing.glass||{}).id].join('|')]))}; },
  _sig(sn){ return JSON.stringify([[...sn.off].sort(),[...sn.feature].sort(),sn.note,Object.keys(sn.specials).sort().map(k=>sn.specials[k])]); },
  sent(now=Date.now()){ const s=this.get().sent; return s&&s.day===this._day(now)?s:null; },
  /* Where the briefing stands for the manager: nothing to send, ready to send, sent, or sent with changes since. */
  status(now=Date.now()){ const c=this.content(now), s=this.sent(now), sig=this._sig(this._snap(c));
    return {empty:this.empty(c),sent:!!s,at:s&&s.at,by:s&&s.by,v:s?s.v:0,changed:!!s&&s.sig!==sig,drafts:this.drafts().length}; },
  /* Send it (or send the update): a new version everyone accepts before the app opens. Whoever sends it has read it.
     In a demo restaurant the rest of the team accept over the next few minutes, as they would on their own phones;
     two never do, so the register has someone to chase. */
  send(pid,now=Date.now()){ const c=this.content(now); if(this.empty(c)) return false; const d=this.get(), prev=this.sent(now), snap=this._snap(c);
    const v=(prev?prev.v:0)+1; d.sent={day:this._day(now),v,at:now,by:pid,sig:this._sig(snap),snaps:{...(prev?prev.snaps:{}),[v]:snap}};
    d.acks=Object.fromEntries(Object.entries(d.acks||{}).filter(([,a])=>this._day(a.at)===this._day(now)||a.at>now)); d.acks[pid]={v,at:now};
    if((TeamData.get().venue||{}).sample){ const rest=TeamLearn.people().filter(p=>p.id!==pid), late=new Set(rest.filter(p=>!TeamLearn.canConsole(p)).slice(-2).map(p=>p.id));
      rest.filter(p=>!late.has(p.id)).forEach((p,i)=>{ d.acks[p.id]={v,at:now+(i+1)*25000,demo:true}; }); }
    this.save(d); return true; },
  _acked(pid,now=Date.now()){ const s=this.sent(now), a=(this.get().acks||{})[pid]; return !!(s&&a&&a.v>=s.v&&a.at<=now); },
  /* Must this person read the briefing before the app opens? Sent today, and not accepted at this version. */
  needsAck(pid,now=Date.now()){ return !!this.sent(now)&&!this._acked(pid,now); },
  ack(pid,now=Date.now()){ const s=this.sent(now); if(!s) return; const d=this.get(); d.acks={...(d.acks||{}),[pid]:{v:s.v,at:now}}; this.save(d); },
  /* What's new for this person since the version they last accepted today: ids of specials, 86'd dishes and features. */
  fresh(pid,now=Date.now()){ const s=this.sent(now), a=(this.get().acks||{})[pid], none={specials:new Set(),off:new Set(),feature:new Set(),note:false,update:false};
    if(!s||!a||a.at>now||this._day(a.at)!==this._day(now)||!s.snaps||!s.snaps[a.v]||a.v>=s.v) return none; const old=s.snaps[a.v], cur=s.snaps[s.v];
    return {update:true,specials:new Set(Object.keys(cur.specials).filter(k=>old.specials[k]!==cur.specials[k])),off:new Set(cur.off.filter(k=>!old.off.includes(k))),
      feature:new Set(cur.feature.filter(k=>!old.feature.includes(k))),note:cur.note!==old.note&&!!cur.note}; },
  /* Who has read it: everyone on the team, with when, for the console's line and the names still to chase. */
  register(now=Date.now()){ const s=this.sent(now), acks=this.get().acks||{};
    const rows=TeamLearn.people().map(p=>{ const a=acks[p.id], ok=!!(s&&a&&a.v>=s.v&&a.at<=now); return {person:p,read:ok,at:ok?a.at:null}; });
    return {sent:!!s,v:s?s.v:0,at:s&&s.at,rows,read:rows.filter(r=>r.read).length,total:rows.length,waiting:rows.filter(r=>!r.read).map(r=>r.person),demo:!!(TeamData.get().venue||{}).sample}; },
};
