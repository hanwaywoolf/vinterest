/* Vinny writes the visit brief (docs/seller.md "Vinny writes the brief"). SellerMatch works out everything that is a
   fact or a figure, with no call: the openings, the shortlist, where each bottle lands and the dishes it suits. The
   words were written by hand for Eloise (data/seller-brief-eloise.json); this is the same brief written by one call
   (purpose seller_brief, prompts/seller-brief.txt) for whichever restaurant is open, in the same shape, so the screens
   and SellerMatch.writtenFor don't change.

   What comes back is never trusted as it stands (clean):
   - only the openings and bottles asked about are kept, and only the dishes each bottle suits;
   - the figures each bottle was written `against` are stamped here from the engine, never taken from the answer, so
     a later change in matching holds its words back as it does the hand-written ones;
   - a piece that states an amount of money the facts never gave is dropped (a made-up price is worse than a gap);
   - a piece that repeats six words in a row from an earlier piece is dropped (the rule the tests hold the brief to).
   A bottle whose one thing to say was dropped is left unwritten and shows its figures alone.

   The brief written in a visit is kept in memory only (seller-store.js): a prospect's brief belongs on a server once
   Seller has accounts. `npm run seller:brief -- <seed>` runs the same call and writes it to data/ for the build. */
const SellerVinny={
  PURPOSE:'seller_brief', WORDS:{opening:60,say:55,story:90,dish:42,q:30,a:70}, BASIS:['sheet','list','guide','estimate'],
  _doc:null, _busy:null, last:null,
  /* The brief written this visit for the restaurant that's open, if any. */
  held(){ const d=this._doc; return d&&d.venue===SellerMatch.venue().name?d:null; },
  set(doc){ this._doc=doc||null; try{ window.dispatchEvent(new CustomEvent('vinterest:seller-brief')); }catch(e){} },
  market(){ const a=SellerCatalogue.agency()||{}; return a.market||'Ontario'; },

  /* ---- what Vinny is told ---- */
  _opening(o){ const names=o.wines.slice(0,3).map(f=>SellerCatalogue.label(f.item)).join('; ');
    return `${o.k} | ${o.kind} | ${o.title} | ${o.engineFact||o.fact||''} | ${(o.facts||[]).map(x=>`${x.label}: ${x.text}`).join(' · ')}${names?` · Our bottles: ${names}`:''}`; },
  _bottle(f){ const i=f.item, L=f.landing, m=SellerMatch.maths(f), M=n=>TeamData.money(Math.round(n)), M2=n=>SellerCatalogue.money(n,2), n=i.notes||{}, b=i.basis||{}, est=k=>b[k]&&b[k]!=='sheet'?' (our estimate, not on the sheet)':'';
    const lines=[`BOTTLE ${i.id}: ${SellerCatalogue.label(i)}${i.vintage&&!SellerCatalogue.label(i).includes(String(i.vintage))?' '+i.vintage:''}, ${SellerCatalogue.format(i)||'750ml'}`,
      `What it is: ${SellerMatch.about(i)}${b.flavours&&b.flavours!=='sheet'?' (these flavours are our estimate of what such a wine tastes of, not the sheet\'s)':''}`,
      `From: ${SellerMatch.placeLine(i)}${est('region')}. Grapes: ${SellerMatch.grapeLine(i)||'not given'}${est('grapes')}. Style: ${SellerMatch.styleWords(i)}${est('style')}.${i.abv?` ${i.abv}% alcohol.`:''}${i.sugar!=null?` Sugar ${i.sugar} g/L.`:''}${i.ageing?` Ageing: ${i.ageing}.`:''}${(i.certs||[]).length?` ${i.certs.join(', ')}.`:''}`,
      n.taste?`Sheet, tasting: ${SellerMatch.sentences(n.taste,3)}`:'Sheet, tasting: nothing given',
      n.food?`Sheet, food: ${SellerMatch.sentences(n.food,2)}`:null, n.made?`Sheet, how it's made: ${SellerMatch.sentences(n.made,3)}`:null, n.vines?`Sheet, the vineyard: ${SellerMatch.sentences(n.vines,2)}`:null,
      `They pay ${M2(i.price)} a bottle, ${M2(m.cost)} for a case of ${i.ucs}. Supply: ${SellerCatalogue.supply(i).line}. ${i.listingLabel||''}`.trim(),
      `On their list it lands at ${M(L.bottle)} a bottle${L.glass?` and ${M(L.glass)} a glass`:''}, ${L.x.toFixed(1)} times cost${L.lifted?` (their usual ${L.usualX.toFixed(1)} times would put it under their cheapest, so it goes on at their entry price)`:''}.${L.beside?` Level with it: ${TeamData.short(L.beside.w)} at ${M(L.beside.p)}.`:''}${L.below?` Just below it: ${TeamData.short(L.below.w)} at ${M(L.below.p)}.`:''}${L.above?` Just above it: ${TeamData.short(L.above.w)} at ${M(L.above.p)}.`:''}`,
      m.sweet?`Poured by the 2oz glass: ${m.pours} pours a bottle at ${M2(m.pourCost)} cost each.`:m.pourCost&&L.glass?`By the glass: ${SellerMatch.POURS} pours a bottle, ${M2(m.pourCost)} cost a pour.`:null,
      `Answers: ${f.fills.filter(o=>o.kind!=='house').map(o=>o.title).join('; ')||'no single opening'}`,
      `Fit ${f.score}. For it: ${f.reasons.filter(r=>r.pts>0).map(r=>r.text).join('; ')}.${f.reasons.some(r=>r.pts<0)?` Against it: ${f.reasons.filter(r=>r.pts<0).map(r=>r.text).join('; ')}.`:''}`,
      f.suits.length?'Dishes it suits (dish id | dish | description | the nearest wine on their list for it, by our pairing):':'Dishes it suits: none found',
      ...f.suits.map(s=>`  ${s.dish.id} | ${s.dish.name} | ${s.dish.desc||''} | ${s.like?`${TeamData.short(s.like)}${s.like.bottle?' at '+s.like.bottle:''}`:'none'}`)];
    return lines.filter(Boolean).join('\n'); },
  /* Their list as printed and nothing else. A rep has the wine list, the cocktail list and the menu: never what sells
     (Teams' demo restaurants carry invented sales, and TeamBuyer's own list lines include them), and never what is
     poured with which dish, which is our pairing. */
  _list(){ return TeamBuyer.wines().map(w=>`${w.id} | ${TeamData.label(w)} | ${w.type} | ${(w.grapes||[]).join(', ')||'?'} | ${[w.region,w.country].filter(Boolean).join(', ')} | ${[w.glass&&'glass '+w.glass,w.bottle&&'bottle '+w.bottle].filter(Boolean).join(', ')||'no price printed'}`).join('\n'); },
  /* A line that claims to know what they sell or pour: nothing the rep was given says so. */
  SALES:/\b(sell-?through|best-?sell\w*|top-?sell\w*|sales (figures|data|numbers))\b|\b(sold|sells?|mov(?:e|es|ed)|pour(?:s|ed)?) (about |around |some |only )?\d+ (glasses|bottles|cases|covers)\b|\b\d+ (glasses|bottles|covers) (of (it|this|that|the \w+) )?(sold|lately|a week|a month|a night|last (week|month))\b|\b(pour(?:s|ed)?|suggest(?:s|ed)?) (it |this |that )?(here|there) (now|today)\b|\b(does|covers) (this|that) (job|plate|dish) (now|today)\b/i,
  ctx(){ const opens=SellerMatch.answered({plain:true}).filter(o=>o.wines.length), short=SellerMatch.shortlist(); return {opens,short}; },
  /* The prompt for one call: everything about the restaurant and its openings above the cache mark (the same for
     every call of a brief, so the Worker's prompt cache serves it to the later ones), then this call's own bottles. */
  PER_CALL:2,
  prompt(c=this.ctx(),part=null){ const v=SellerMatch.venue(), a=SellerCatalogue.agency()||{}, p=part||{openings:true,bottles:c.short};
    return _loadTextSync('prompts/seller-brief.txt').replace(/\{\{venue\}\}/g,v.name||'the restaurant').replace('{{agency}}',a.name||'the agency').replace('{{market}}',this.market()).replace('{{about}}',TeamData.about())
      .replace('{{list}}',this._list()).replace('{{cocktails}}',TeamData.cocktails&&TeamData.cocktails().length?TeamData._drinkLines():'(none uploaded)').replace('{{menu}}',TeamData._menuFull()).replace('{{openings}}',c.opens.map(o=>this._opening(o)).join('\n'))
      .replace('{{ask_openings}}',p.openings?'yes, every key in the table above':'none in this call').replace('{{bottles}}',p.bottles.map(f=>this._bottle(f)).join('\n\n')||'(none in this call)'); },
  /* The calls of one brief: the openings with the first bottles, then the rest a few at a time. */
  parts(c=this.ctx()){ const out=[]; for(let i=0;i<c.short.length;i+=this.PER_CALL) out.push({openings:i===0,bottles:c.short.slice(i,i+this.PER_CALL)}); return out.length?out:[{openings:true,bottles:[]}]; },

  /* ---- what comes back ---- */
  _amounts(text){ return (String(text||'').match(/[$£€]\s?\d[\d,]*(?:\.\d+)?/g)||[]).map(x=>+x.replace(/[^\d.]/g,'')); },
  _shingles(text){ const ws=String(text||'').toLowerCase().replace(/[$\d.,×%]+/g,'#').replace(/[^a-zà-ÿ#' ]+/g,' ').split(/\s+/).filter(Boolean), out=[]; for(let i=0;i+6<=ws.length;i++) out.push(ws.slice(i,i+6).join(' ')); return out; },
  _words(t){ return String(t||'').trim().split(/\s+/).filter(Boolean).length; },
  clean(j,c=this.ctx(),prompt=this.prompt(c)){ const s=x=>typeof x==='string'?x.replace(/\s+/g,' ').replace(/\s[—–]\s/g,', ').trim():'', dropped=[], seen=new Set();
    // Every amount of money the facts gave, to the cent and to the dollar: anything else in the answer was made up.
    const known=new Set(); this._amounts(prompt).forEach(n=>{ known.add(n); known.add(Math.round(n)); });
    // A run of six words is a repeat only when it's phrasing: not when it holds a figure ("they pay # a bottle") or
    // is mostly a name (a wine's, a dish's or its ingredients'), which a brief has to say more than once.
    const names=new Set(), nw=t=>String(t||'').toLowerCase().replace(/[^a-zà-ÿ' ]+/g,' ').split(/\s+/).filter(w=>w.length>=4).forEach(w=>names.add(w));
    TeamBuyer.wines().forEach(w=>nw(TeamData.label(w))); TeamData.dishes().forEach(x=>{ nw(x.name); nw(x.desc); }); c.short.forEach(f=>{ const i=f.item; nw(SellerCatalogue.label(i)); nw([i.region,i.sub,i.appellation,i.country].filter(Boolean).join(' ')); });
    const ok=(text,max,where,figures)=>{ const t=s(text); if(!t) return null;
      if(this._words(t)>max*1.5){ dropped.push({where,why:'too long'}); return null; }
      if(this.SALES.test(t)){ dropped.push({where,why:'says what they sell or pour, which nobody told us'}); return null; }
      const bad=this._amounts(t).find(n=>!known.has(n)); if(bad!=null){ dropped.push({where,why:`an amount the facts never gave (${bad})`}); return null; }
      const sh=this._shingles(t).filter(k=>!k.includes('#')&&k.split(' ').filter(w=>names.has(w)).length<2), rep=figures?null:sh.find(k=>seen.has(k)); if(rep){ dropped.push({where,why:`repeats "${rep}"`}); return null; }
      sh.forEach(k=>seen.add(k)); return t; };
    const out={venue:SellerMatch.venue().name,agency:(SellerCatalogue.agency()||{}).name||'',written:new Date().toISOString().slice(0,10),by:'Vinny',openings:{},bottles:{}}, W=this.WORDS;
    // Bottles first: their words are what the rep says, so they win a clash with an opening's line.
    const jb=(j&&j.bottles)||{};
    c.short.forEach(f=>{ const id=f.item.id, b=jb[id]; if(!b||typeof b!=='object') return; const say=ok(b.say,W.say,`${id} say`); if(!say) return;
      const L=f.landing, m=SellerMatch.maths(f), against={bottle:L.bottle}; if(L.glass!=null) against.glass=L.glass; if(m.sweet&&m.pourCost!=null) against.pourCost=Math.round(m.pourCost*100)/100;
      const story=(Array.isArray(b.story)?b.story:[]).slice(0,4).map((p,k)=>{ const t=p&&ok(p.t,W.story,`${id} story ${k+1}`,/price/i.test(p.h||'')); return t&&s(p.h)?{h:s(p.h),t,basis:this.BASIS.includes(p.basis)?p.basis:'estimate'}:null; }).filter(Boolean);
      const dishes={}; f.suits.forEach(x=>{ const t=ok((b.dishes||{})[x.dish.id],W.dish,`${id} ${x.dish.id}`); if(t) dishes[x.dish.id]=t; });
      const objections=(Array.isArray(b.objections)?b.objections:[]).slice(0,3).map((o,k)=>{ let q=o&&s(o.q).replace(/^["'“‘]+|["'”’]+$/g,''); if(!q||this._words(q)>W.q*1.5) return null; q=`"${q}"`; const a=ok(o.a,W.a,`${id} objection ${k+1}`); return a?{q,a}:null; }).filter(Boolean);
      out.bottles[id]={against,say,story,dishes,objections}; });
    const jo=(j&&j.openings)||{}; c.opens.forEach(o=>{ const t=ok(jo[o.k],W.opening,`opening ${o.k}`); if(t) out.openings[o.k]=t; });
    const missing=c.short.filter(f=>!out.bottles[f.item.id]).map(f=>f.item.id), dishesAsked=c.short.reduce((a,f)=>a+f.suits.length,0), dishesGot=Object.values(out.bottles).reduce((a,b)=>a+Object.keys(b.dishes).length,0);
    return {doc:out,report:{bottles:Object.keys(out.bottles).length,asked:c.short.length,missing,openings:Object.keys(out.openings).length,openingsAsked:c.opens.length,dishes:dishesGot,dishesAsked,dropped}}; },

  /* A few calls: the first alone (it writes the prompt cache the others read), then the rest together. A call that
     fails or can't be read leaves its bottles unwritten; the rest still stand. Resolves to {doc, report, calls}; the
     brief is in place for the visit once it does. */
  write(){ if(this._busy) return this._busy;
    const run=async()=>{ const c=this.ctx(), parts=this.parts(c), calls=[], j={openings:{},bottles:{}}, hear=e=>{ if(e.detail&&e.detail.purpose===this.PURPOSE) calls.push({model:e.detail.model,usage:e.detail.usage,ms:e.detail.ms}); };
      const one=async part=>{ try{ const got=TeamData._json(await window.claude.complete({purpose:this.PURPOSE,messages:[{role:'user',content:this.prompt(c,part)}]})); if(got&&typeof got==='object'){ Object.assign(j.openings,got.openings||{}); Object.assign(j.bottles,got.bottles||{}); return true; } }catch(e){ this.lastError=(e&&e.message)||String(e); } return false; };
      window.addEventListener('vinterest:claude-usage',hear);
      try{ const first=await one(parts[0]), rest=await Promise.all(parts.slice(1).map(one)), failed=[first,...rest].filter(x=>!x).length;
        const r=this.clean(j,c,this.prompt(c)); r.report.calls=parts.length; r.report.failed=failed; r.raw=j;
        if(!r.report.bottles){ this.last={calls}; throw new Error(failed?"Vinny couldn't write the brief just now. Try again in a minute.":"Vinny's brief didn't pass its checks. Try again in a minute."); }
        this.last={...r,calls}; this.set(r.doc); return this.last; }
      finally{ window.removeEventListener('vinterest:claude-usage',hear); } };
    this._busy=run().finally(()=>{ this._busy=null; }); return this._busy; },
};
