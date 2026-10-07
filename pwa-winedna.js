/* Vinterest — WineDNA: every number and sentence on the WineDNA tab, computed from the user's
   scans and scores. The screen only renders what this returns.

   Two kinds of data meet here. A wine's body/tannins/acidity/etc. are Claude's estimates of that
   wine's typical style, read from the label at scan time; the only first-hand input is the
   user's score. So "what you choose" (averages over everything scanned) and "what you love"
   (what separates the wines they score highest) are kept apart, and the profile leads with the
   second once there's enough scored data to say something true. */

/* Robert Parker's 100-point scale, the one the app scores on. */
const ParkerScale = {
  BANDS:[
    {min:96,label:'Extraordinary'},{min:90,label:'Outstanding'},{min:80,label:'Very good'},
    {min:70,label:'Average'},{min:60,label:'Below average'},{min:1,label:'Poor'}
  ],
  PRESETS:[70,80,85,90,95],
  MIN:50,
  LOVED:90,     // Outstanding and up
  DISLIKED:80,  // below "very good": average or worse
  /* A score's colour band: 'good' (loved, 90+), 'neutral' (80-89), 'bad' (below 80). */
  tone(score){ return score>=this.LOVED?'good':score>=this.DISLIKED?'neutral':'bad'; },
  label(score){ if(!score) return ''; const b=this.BANDS.find(x=>score>=x.min); return b?b.label:''; }
};

const WineDNA = {
  // One scale for every label on the tab (bars, chips, personality, Explore Next).
  HIGH:0.67, LOW:0.40,
  level(v){ return v==null?null:v>=this.HIGH?'high':v<=this.LOW?'low':'mid'; },
  /* The everyday word for where a trait sits, for the taste tiles at the top of WineDNA: what a
     casual drinker would say ("Rich", "Mouth-watering"), with the wine term shown small beneath. */
  EVERYDAY:{
    body:{low:'Light',mid:'Rounded',high:'Rich'},
    tannins:{low:'Silky',mid:'Gentle grip',high:'Grippy'},
    acidity:{low:'Mellow',mid:'Fresh',high:'Mouth-watering'},
    sweetness:{low:'Dry',mid:'Off-dry',high:'Sweet'},
    texture:{low:'Crisp',mid:'Smooth',high:'Creamy'},
    effervescence:{low:'Gentle',mid:'Lively',high:'Vigorous'},
  },
  everyday(axis,v){ const l=this.level(v); return l&&this.EVERYDAY[axis]?this.EVERYDAY[axis][l]:null; },
  AXES:{
    body:         {name:'Body',         low:'Light',          mid:'Medium',        high:'Full',          lowAdj:'lighter',        highAdj:'fuller'},
    tannins:      {name:'Tannins',      low:'Silky',          mid:'Medium',        high:'Grippy',        lowAdj:'softer-tannin',  highAdj:'firmer-tannin'},
    acidity:      {name:'Acidity',      low:'Mellow',         mid:'Medium',        high:'Zingy',         lowAdj:'softer-acid',    highAdj:'fresher, higher-acid'},
    sweetness:    {name:'Sweetness',    low:'Bone dry',       mid:'Off-dry',       high:'Sweet',         lowAdj:'drier',          highAdj:'sweeter'},
    texture:      {name:'Texture',      low:'Crisp & steely', mid:'Medium',        high:'Rich & creamy', lowAdj:'crisper',        highAdj:'richer, creamier'},
    effervescence:{name:'Bubbles',      low:'Soft & delicate',mid:'Medium',        high:'Vigorous',      lowAdj:'softer-bubbled', highAdj:'livelier'},
  },
  AXES_FOR:{red:['body','tannins','acidity','sweetness'],white:['body','acidity','texture','sweetness'],rose:['body','acidity','sweetness'],
    sparkling:['body','acidity','effervescence','sweetness'],orange:['body','tannins','acidity','texture'],dessert:['body','acidity','sweetness','texture'],
    fortified:['body','tannins','sweetness','texture']},
  // Where to look when a preference shows up — practical buying guidance, by axis and direction.
  /* Flavour families and the words that place a tasting note in one (Flavour Signatures, and the
     flavours What You Love names). Longer words are matched first, so "black cherry" isn't also
     "cherry". */
  NOTE_CLUSTERS:[
    {name:'Dark Fruit & Spice',    kw:['blackberry','blackcurrant','black cherry','plum','dark cherry','black fruit','blueberry','clove','pepper','spice','anise','liquorice']},
    {name:'Red Fruit & Floral',    kw:['cherry','raspberry','strawberry','redcurrant','red fruit','pomegranate','violet','rose','hibiscus']},
    {name:'Earth & Leather',       kw:['earth','leather','tobacco','truffle','forest floor','mushroom','barnyard','smoke','tar','graphite','iron']},
    {name:'Citrus & Mineral',      kw:['lemon','lime','grapefruit','citrus','mineral','chalk','flint','oyster','saline','wet stone','slate']},
    {name:'Oak & Vanilla',         kw:['vanilla','caramel','toast','oak','cedar','sandalwood','coconut','cream','butterscotch']},
    {name:'Herb & Savour',         kw:['herb','thyme','rosemary','olive','green pepper','eucalyptus','menthol','garrigue','dried herb']},
    {name:'Tropical & Stone Fruit',kw:['peach','apricot','nectarine','mango','pineapple','passion fruit','melon','guava','lychee']},
    {name:'Brioche & Yeast',       kw:['brioche','toast','biscuit','bread','yeast','pastry','almonds','hazelnut']},
  ],
  /* The flavour words that come up in at least two of these bottles' tasting notes, most first. */
  flavourWords(ws,max=3){
    const kws=[...new Set(this.NOTE_CLUSTERS.flatMap(c=>c.kw))].sort((a,b)=>b.length-a.length), c={};
    ws.forEach(w=>{ const seen=new Set(); let t=(w.tasting_notes||[]).join(' ').toLowerCase();
      kws.forEach(k=>{ if(t.includes(k)){ seen.add(k); t=t.split(k).join(' '); } }); seen.forEach(k=>{ c[k]=(c[k]||0)+1; }); });
    return Object.entries(c).filter(([,n])=>n>=Math.min(2,ws.length)).sort((a,b)=>b[1]-a[1]).slice(0,max).map(([k])=>k);
  },
  /* A set of bottles' style in words ("full-bodied and firm"), from the traits that aren't middling. */
  styleWords(ws,axes){
    const W={body:['light','full-bodied'],tannins:['silky','firm'],acidity:['soft','fresh'],texture:['crisp','rich'],sweetness:['dry','sweet']};
    const out=[]; (axes||Object.keys(W)).forEach(k=>{ if(!W[k]) return; const v=this._mean(ws.map(w=>this.axisValue(w,k)).filter(x=>typeof x==='number'));
      const l=this.level(v); if(l==='high') out.push(W[k][1]); else if(l==='low'&&k!=='sweetness') out.push(W[k][0]); });
    return out;
  },
  /* A wine's name with its vintage, unless the name already carries the year ("Mlavac 2016"). */
  nameYear(w){ const n=String(w&&w.name||''), v=w&&w.vintage; return v&&!n.includes(String(v))?`${n} ${v}`:n; },
  _list(xs){ return xs.length<2?(xs[0]||''):xs.slice(0,-1).join(', ')+' and '+xs[xs.length-1]; },
  TIPS:{
    body:{high:'Fuller wines come from warmer places and riper grapes: look at Barossa, Napa, Priorat or Châteauneuf-du-Pape.',
          low:'Lighter styles come from cooler places: Burgundy, Beaujolais, Oregon Pinot Noir or Etna.'},
    tannins:{high:'For more grip, reach for Nebbiolo, Cabernet Sauvignon or Aglianico, and pair them with steak or hard cheese.',
             low:'For silky reds, look for Pinot Noir, Gamay, Grenache or Merlot.'},
    acidity:{high:'Cool climates keep acidity high: Chianti, Barbera, Burgundy, the Loire and the Mosel.',
             low:'Warm climates soften acidity: Barossa, Napa, Mendoza, the southern Rhône and Puglia.'},
    sweetness:{high:'For a touch of sweetness, try German Kabinett or Spätlese Riesling, Vouvray demi-sec or Moscato d\'Asti.',
               low:'On labels, "brut", "trocken", "sec" and "dry" mark the driest styles.'},
    texture:{high:'Richer whites come from oak, lees ageing and malolactic fermentation: think white Burgundy or Rioja blanco.',
             low:'For crisp, steely whites, look for "unoaked" or stainless steel: Chablis, Albariño, Assyrtiko.'},
    effervescence:{high:'Traditional-method sparkling (Champagne, Crémant, Cava) has the finest, most persistent bubbles.',
                   low:'Gentler bubbles: Moscato d\'Asti, Pét-Nat or a softer Prosecco.'},
  },
  GRAPE_SYNONYMS:{'garnacha':'Grenache','garnacha tinta':'Grenache','cannonau':'Grenache','shiraz':'Syrah','tinta roriz':'Tempranillo','tinto fino':'Tempranillo',
    'tinta de toro':'Tempranillo','cencibel':'Tempranillo','pinot gris':'Pinot Grigio','grauburgunder':'Pinot Grigio','monastrell':'Mourvèdre','mataro':'Mourvèdre',
    'mourvedre':'Mourvèdre','cot':'Malbec','côt':'Malbec','spätburgunder':'Pinot Noir','spatburgunder':'Pinot Noir','pinot nero':'Pinot Noir',
    'mazuelo':'Carignan','cariñena':'Carignan','carignane':'Carignan','montepulciano d\'abruzzo':'Montepulciano','plavac':'Plavac Mali','mlavac':'Plavac Mali',
    'blaufränkisch':'Blaufränkisch','lemberger':'Blaufränkisch','alvarinho':'Albariño','albarino':'Albariño','gruner veltliner':'Grüner Veltliner',
    'ugni blanc':'Trebbiano','moscato':'Muscat','moscatel':'Muscat','sémillon':'Sémillon','semillon':'Sémillon',
    // Local names and clones: Brunello's "Sangiovese Grosso" and Montepulciano's "Prugnolo Gentile" are Sangiovese.
    'sangiovese grosso':'Sangiovese','brunello':'Sangiovese','prugnolo gentile':'Sangiovese','prugnolo':'Sangiovese','morellino':'Sangiovese',
    'nielluccio':'Sangiovese','sangioveto':'Sangiovese','sangiovese piccolo':'Sangiovese','chiavennasca':'Nebbiolo','spanna':'Nebbiolo',
    'tinta del pais':'Tempranillo','tinta del país':'Tempranillo','tinta fina':'Tempranillo','ull de llebre':'Tempranillo','aragonez':'Tempranillo',
    'grenache noir':'Grenache','garnacha negra':'Grenache','blauburgunder':'Pinot Noir','pinot noir précoce':'Pinot Noir','weissburgunder':'Pinot Blanc',
    'pinot bianco':'Pinot Blanc','fumé blanc':'Sauvignon Blanc','fume blanc':'Sauvignon Blanc','steen':'Chenin Blanc','pinot grigio ramato':'Pinot Grigio'},
  /* The region a wine counts under whenever wines are grouped, counted or compared by region: the
     knowledge-base region (Regions.of: Côtes de Provence and Bandol are Provence, Brunello di
     Montalcino is Tuscany), else the label's own region. The label's appellation is still what a
     wine's own screens show; only grouping goes through here, so one region never splits in two. */
  region(w){ return typeof Regions!=='undefined'?Regions.of(w):((w&&w.region)||null); },
  /* The one name a grape goes by everywhere (WineDNA, matching, unlocks, quizzes, articles, XP):
     label synonyms first ("Shiraz" is Syrah, "Pinot Gris" is Pinot Grigio), then the spelling
     on the 50-grape Learn list, ignoring case and accents ("Gewurztraminer", "Albarino"), so a
     grape never shows under one name in WineDNA and another in Learn. */
  _fold(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); },
  _grapeMemo:new Map(),
  grape(g){
    const k=String(g||'');
    if(this._grapeMemo.has(k)) return this._grapeMemo.get(k);
    const v=this._grape(g);
    if(this._grapeMemo.size>5000) this._grapeMemo.clear();
    this._grapeMemo.set(k,v);
    return v;
  },
  _grape(g){
    const raw=(g||'').trim(), k=raw.toLowerCase(); if(!k) return null;
    const syn=this.GRAPE_SYNONYMS[k]||this.GRAPE_SYNONYMS[this._fold(k)];
    const name=syn||(raw===k?raw.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '):raw);
    const list=typeof GRAPE_ALLOWLIST!=='undefined'?GRAPE_ALLOWLIST:[];
    return list.find(x=>this._fold(x)===this._fold(name))||name;
  },
  /* Grapes are variety names only. Scans sometimes return phrases ("Blend - likely Grenache,
     Syrah, or Cinsault", "Red blend", "Mostly Merlot"): split them into varieties, and note
     whether the wine is a blend and whether the grapes were guessed ("typical" for that wine
     or appellation) rather than printed on the label. Idempotent. */
  _NOT_GRAPE:/^(blend|blends|red|white|rose|rosé|wine|grapes?|varieties|variety|various|unknown|other|others|field|cuvee|cuvée|assemblage|traditional|local|indigenous|mostly|mainly|primarily|predominantly|likely|probably|possibly|typically|usually|based|led|e\.?g\.?|etc\.?|of|with|the|a|an|some|may|include|includes|including)$/i,
  cleanGrapes(list){
    const raw=(Array.isArray(list)?list:list?[list]:[]).filter(g=>typeof g==='string'&&g.trim());
    const text=raw.join(', ');
    const blend=/\bblend|assemblage|cuv[ée]e\b/i.test(text)||raw.length>1;
    const typical=/\b(likely|probably|possibly|typically|usually|may include|e\.?g\.?)\b/i.test(text);
    const out=[];
    raw.forEach(g=>{
      g.replace(/\([^)]*\)/g,' ').replace(/\d+\s*%/g,' ').split(/,|;|\/|&|\+|\bor\b|\band\b|\s[-–—]\s|:/i).forEach(part=>{
        const words=part.trim().split(/\s+/).filter(w=>w&&!this._NOT_GRAPE.test(w.replace(/[.'"]/g,'')));
        const name=words.join(' ').replace(/^[-–—\s]+|[-–—\s.]+$/g,'').trim();
        if(name.length>=3&&!out.some(x=>x.toLowerCase()===name.toLowerCase())) out.push(name);
      });
    });
    return {grapes:out,blend,typical};
  },
  /* Tasting notes read as one style everywhere: first letter capitalised ("Dried cherry and
     plum"), since Claude sometimes returns them all lower case. */
  capNotes(notes){ return (Array.isArray(notes)?notes:[]).map(n=>{ const t=String(n||'').trim(); return t?t.charAt(0).toUpperCase()+t.slice(1):t; }).filter(Boolean); },
  cleanWine(w){
    if(w&&Array.isArray(w.tasting_notes)&&w.tasting_notes.some(n=>typeof n==='string'&&/^\s*[a-z]/.test(n))) w={...w,tasting_notes:this.capNotes(w.tasting_notes)};
    if(!w||!Array.isArray(w.grapes)||!w.grapes.some(g=>/[,;/&+]|\b(or|and|blend|likely|probably|possibly|typically|usually|mostly)\b|\s[-–—]\s|:|\(|%/i.test(g||''))) return w;
    const c=this.cleanGrapes(w.grapes);
    return {...w,grapes:c.grapes,blend:w.blend||c.blend,grapes_basis:w.grapes_basis||(c.typical?'typical':undefined)};
  },
  /* "Grenache, Syrah, Cinsault" / "Usually Grenache, Syrah and Cinsault" for display. */
  grapeLine(w){
    const g=(w&&w.grapes||[]).filter(Boolean);
    if(!g.length) return '';
    const list=g.length>1?g.slice(0,-1).join(', ')+' and '+g[g.length-1]:g[0];
    return w.grapes_basis==='typical'?`Usually ${list}`:g.join(', ');
  },
  _t(v){ return (v||'').toLowerCase().replace('é','e'); },
  /* A wine's value on one axis: Claude's label estimate, nudged by the user's own tasting where
     they told us it was lighter/fuller (etc.) than the label suggested (w.tasted[k] = -1, 0 or 1). */
  TASTED_STEP:0.15,
  axisValue(w,k){
    const v=w&&w[k]; if(typeof v!=='number') return null;
    const d=w.tasted&&typeof w.tasted[k]==='number'?w.tasted[k]:0;
    return Math.max(0,Math.min(1,v+d*this.TASTED_STEP));
  },
  /* Scans that count as the user's choices: everything except a shelf check they didn't buy
     (a "just checking" scan counts once they say they bought it, or once they score it). */
  chosen(w){ return w.scan_intent!=='checking'||w.bought===true||w.rating>0; },
  // "1 white", "3 whites", "7 sparkling wines": wine-type nouns for counts in copy.
  NOUNS:{red:['red','reds'],white:['white','whites'],rose:['rosé','rosés'],sparkling:['sparkling wine','sparkling wines'],
    orange:['orange wine','orange wines'],dessert:['dessert wine','dessert wines'],fortified:['fortified wine','fortified wines']},
  noun(typeKey,n){ const x=this.NOUNS[typeKey]||['wine','wines']; return `${n} ${n===1?x[0]:x[1]}`; },
  _mean(a){ return a.length?a.reduce((s,x)=>s+x,0)/a.length:null; },
  _r(xs,ys){ const n=xs.length; if(n<3) return 0; const mx=this._mean(xs),my=this._mean(ys); let a=0,b=0,c=0;
    for(let i=0;i<n;i++){ a+=(xs[i]-mx)*(ys[i]-my); b+=(xs[i]-mx)**2; c+=(ys[i]-my)**2; } return b&&c?a/Math.sqrt(b*c):0; },
  // Changes whenever a wine is added or re-scored, so cached summaries and memoised views refresh.
  signature(wines){ let h=0; const s=wines.map(w=>`${w.name}|${w.vintage||''}|${w.rating||0}|${this._t(w.type)}`).sort().join(';');
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36); },

  /* Everything the tab shows for one wine type. */
  profile(typeKey,allWines,label){
    const wines=allWines.filter(w=>this._t(w.type)===typeKey);
    const scored=wines.filter(w=>w.rating>0);
    const loved=scored.filter(w=>w.rating>=ParkerScale.LOVED);
    const disliked=scored.filter(w=>w.rating<ParkerScale.DISLIKED);
    const axes=this.AXES_FOR[typeKey]||['body','acidity','sweetness'];
    const chosen=wines.filter(w=>this.chosen(w));
    const avgOf=(ws,k)=>this._mean(ws.map(w=>this.axisValue(w,k)).filter(v=>typeof v==='number'));
    const avg={}, lovedAvg={};
    axes.forEach(k=>{ avg[k]=avgOf(chosen,k); lovedAvg[k]=loved.length>=3?avgOf(loved,k):null; });
    // The personality describes what they love once there are 3+ Outstanding wines to go on.
    const basis=loved.length>=3?'loved':'chosen';
    const dnaAvg=basis==='loved'?lovedAvg:avg;
    const stats=(pairs)=>{ const m={}; pairs.forEach(([k,r])=>{ if(!k) return; const e=m[k]=m[k]||{name:k,count:0,scores:[]}; e.count++; if(r>0) e.scores.push(r); });
      return Object.values(m).map(e=>({name:e.name,count:e.count,avg:e.scores.length?Math.round(this._mean(e.scores)):null,scored:e.scores.length})); };
    const grapeStats=stats(wines.flatMap(w=>[...new Set((w.grapes||[]).map(g=>this.grape(g)).filter(Boolean))].map(g=>[g,w.rating])));
    const regionStats=stats(wines.map(w=>[this.region(w),w.rating]));
    const byCount=(a,b)=>b.count-a.count||(b.avg||0)-(a.avg||0);
    const p={typeKey,label,wines,chosen,scored,loved,disliked,axes,avg,lovedAvg,dnaAvg,basis,
      topGrapes:[...grapeStats].sort(byCount).map(g=>g.name).slice(0,4),
      topRegions:[...regionStats].sort(byCount).map(r=>r.name).slice(0,4),
      grapeStats,regionStats};
    p.showAxis=k=>avg[k]!=null&&(k!=='sweetness'||['dessert','fortified'].includes(typeKey)||this.level(avg[k])!=='low');
    p.personality=this.personality(typeKey,dnaAvg);
    p.signals=this.signals(p);
    p.favourites=this.favourites(p);
    p.loves=this.loves(p);
    p.house=this.houseWines(p);
    p.value=this.value(p);
    p.blindCall=this.blindCall(wines);
    p.confidence=this.confidence(p);
    p.journey=this.journey(wines);
    p.axisNotes=Object.fromEntries(axes.map(k=>[k,this.axisNote(p,k)]));
    return p;
  },

  personality(typeKey,a){
    const L=k=>this.level(a[k]);
    const b=L('body'),t=L('tannins'),ac=L('acidity'),s=L('sweetness'),x=L('texture');
    if(typeKey==='red'){
      if(b==='high'&&t==='high') return 'Bold & Structured';
      if(b==='high') return 'Full & Velvety';
      if(b==='low') return 'Light & Elegant';
      if(ac==='high') return 'Bright & Fresh';
      return 'Classic & Balanced';
    }
    if(typeKey==='white'){
      if(ac==='high'&&b!=='high') return 'Crisp & Mineral';
      if(b==='high'||x==='high') return 'Rich & Textured';
      if(ac==='high') return 'Zingy & Aromatic';
      return 'Clean & Precise';
    }
    if(typeKey==='rose') return s==='low'?(b==='high'?'Dry & Structured':'Bone Dry & Delicate'):'Fruity & Expressive';
    if(typeKey==='sparkling') return b==='high'?'Classic & Toasty':ac==='high'?'Taut & Precise':'Elegant & Fine';
    if(typeKey==='orange') return t==='high'?'Textured & Tannic':ac==='high'?'Bright & Wild':'Amber & Aromatic';
    if(typeKey==='dessert') return s==='high'&&ac==='high'?'Honeyed & Vibrant':s==='high'?'Lusciously Sweet':'Rich & Nectarous';
    if(typeKey==='fortified') return s==='low'?'Dry & Nutty':'Sweet & Fortified';
    return 'Eclectic Palate';
  },

  // How much weight to put on what the tab says, and what would sharpen it.
  confidence(p){
    const n=p.scored.length;
    const level=n>=12?'strong':n>=8?'good':n>=3?'early':'none';
    const next=level==='strong'?null:level==='good'?`Score ${12-n} more to firm it up`:`Score ${this.noun(p.typeKey,8-n)} more to unlock your preference signals`;
    return {n,level,next,unscored:p.wines.length-n};
  },

  /* What separates the wines they score highest from the rest, axis by axis: a correlation
     between the estimated trait and their score, shown as the means of their Outstanding
     wines vs the others. Needs 8+ scored wines, 3+ on each side, and a real relationship. */
  signals(p){
    if(p.scored.length<8) return [];
    const out=[];
    p.axes.forEach(k=>{
      const ws=p.scored.filter(w=>typeof this.axisValue(w,k)==='number');
      const hi=ws.filter(w=>w.rating>=ParkerScale.LOVED), rest=ws.filter(w=>w.rating<ParkerScale.LOVED);
      if(ws.length<8||hi.length<3||rest.length<3) return;
      const r=this._r(ws.map(w=>this.axisValue(w,k)),ws.map(w=>w.rating));
      const hiM=this._mean(hi.map(w=>this.axisValue(w,k))), restM=this._mean(rest.map(w=>this.axisValue(w,k)));
      if(Math.abs(r)<0.3||Math.abs(hiM-restM)<0.03) return;
      const dir=hiM>restM?'high':'low', A=this.AXES[k];
      out.push({axis:k,dir,r,strength:Math.abs(r)>=0.5?'consistently':'tend to',
        lovedMean:hiM,restMean:restM,adj:dir==='high'?A.highAdj:A.lowAdj,
        text:`You ${Math.abs(r)>=0.5?'consistently':'tend to'} score ${dir==='high'?A.highAdj:A.lowAdj} ${p.label.toLowerCase()} higher.`,
        detail:`Your ${hi.length} Outstanding (90+) ${p.label.toLowerCase()} average ${this.AXES[k].name.toLowerCase()} ${Math.round(hiM*100)}/100, against ${Math.round(restM*100)}/100 for the rest.`,
        tip:this.TIPS[k][dir]});
    });
    return out.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));
  },

  /* "What you love", measured on their own scale rather than a fixed 90: someone who scores most
     reds 90+ still has a best third and a lowest third. From LOVES_MIN scored wines of the type:
     - their average, and the cut-offs of their best and lowest thirds;
     - style: each estimated trait whose relationship with their score is real (|r| >= STYLE_R),
       as their best third's mean against their lowest third's;
     - lifts: every grape, region, country, producer, price band and age that their scores rise
       or fall with, as points above or below their average. Each is shrunk toward the average
       by SHRINK_K phantom average bottles and listed by the evidence behind it, so two bottles at 98
       don't head the list over nine at 95, and
       a grape and the region it comes from that are the same bottles show as one line;
     - price and age: whether their score climbs with what a bottle costs, or with its years.
     The headline is the single strongest of these. */
  LOVES_MIN:6, SHRINK_K:3, LIFT_MIN:1, STYLE_R:0.25,
  _q(xs,f){ const a=[...xs].sort((x,y)=>x-y); if(!a.length) return null; const i=(a.length-1)*f, lo=Math.floor(i); return a[lo]+(a[Math.min(a.length-1,lo+1)]-a[lo])*(i-lo); },
  _producerKey(w){
    const stop=typeof TasteMatch!=='undefined'?TasteMatch._PRODUCER_STOP:new Set();
    return String(w&&w.producer||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(x=>x.length>2&&!stop.has(x)).sort().join(' ');
  },
  loves(p){
    const sc=p.scored, n=sc.length;
    if(n<this.LOVES_MIN) return {n,ready:false};
    const rs=sc.map(w=>w.rating), avg=this._mean(rs);
    const hiCut=Math.round(this._q(rs,2/3)), loCut=Math.round(this._q(rs,1/3));
    const best=sc.filter(w=>w.rating>=hiCut), low=sc.filter(w=>w.rating<=loCut);
    const flat=hiCut-loCut<2;
    // The style of their best third, per trait (Explore Next builds on it).
    const bestAvg={}; Object.keys(this.AXES).forEach(k=>{ const v=this._mean(best.map(w=>this.axisValue(w,k)).filter(x=>typeof x==='number')); if(v!=null) bestAvg[k]=v; });
    const L=p.label.toLowerCase();
    // Style, on their own scale.
    const style=[];
    if(!flat) p.axes.forEach(k=>{
      const ws=sc.filter(w=>typeof this.axisValue(w,k)==='number'); if(ws.length<8) return;
      const r=this._r(ws.map(w=>this.axisValue(w,k)),ws.map(w=>w.rating));
      const b=best.filter(w=>typeof this.axisValue(w,k)==='number'), l=low.filter(w=>typeof this.axisValue(w,k)==='number');
      if(b.length<3||l.length<3||Math.abs(r)<this.STYLE_R) return;
      const bm=this._mean(b.map(w=>this.axisValue(w,k))), lm=this._mean(l.map(w=>this.axisValue(w,k)));
      if(Math.abs(bm-lm)<0.06) return;
      const A=this.AXES[k], dir=bm>lm?'high':'low';
      style.push({axis:k,r,dir,text:`Your best ${L} are ${dir==='high'?A.highAdj:A.lowAdj}.`,
        detail:`${A.name} averages ${Math.round(bm*100)}/100 in your top third (${hiCut}+) against ${Math.round(lm*100)}/100 in your lowest (${loCut} and under). It's an estimate from each label, so a guide.`,
        tip:this.TIPS[k]&&this.TIPS[k][dir]});
    });
    style.sort((a,b)=>Math.abs(b.r)-Math.abs(a.r));
    // Where the match engine's own style signals (90+ against the rest) exist, they lead, so this
    // card and "Why N%?" never disagree; the own-scale comparison fills in when they don't.
    const sig=(p.signals||[]).map(x=>({axis:x.axis,r:x.r,dir:x.dir,text:x.text,detail:x.detail,tip:x.tip}));
    const styleAll=[...sig,...style.filter(x=>!sig.some(y=>y.axis===x.axis))];
    // Lifts: what their scores rise or fall with.
    const K=this.SHRINK_K, groups={};
    const add=(kind,key,name,w)=>{ if(!key) return; const g=groups[kind+'|'+key]=groups[kind+'|'+key]||{kind,key,names:{},ws:[]}; g.names[name]=(g.names[name]||0)+1; g.ws.push(w); };
    const prices=sc.map(w=>this.priceOf(w)).filter(x=>x>0), year=new Date().getFullYear();
    const pq=prices.length>=8?[this._q(prices,1/3),this._q(prices,2/3)]:null, cur=typeof Regional!=='undefined'?Regional.current().base:'';
    sc.forEach(w=>{
      new Set((w.grapes||[]).map(g=>this.grape(g)).filter(Boolean)).forEach(g=>add('Grape',g,g,w));
      const rg=this.region(w); if(rg) add('Region',rg,rg,w);
      if(w.country) add('Country',String(w.country).toLowerCase(),w.country,w);
      const pk=this._producerKey(w); if(pk) add('Producer',pk,w.producer,w);
      const pr=this.priceOf(w);
      if(pq&&pr>0){ const band=pr<pq[0]?'under':pr>pq[1]?'over':'mid';
        add('Price',band,band==='under'?`Under ${cur}${Math.round(pq[0])}`:band==='over'?`Over ${cur}${Math.round(pq[1])}`:`${cur}${Math.round(pq[0])}–${Math.round(pq[1])}`,w); }
      const v=parseInt(w.vintage); if(v>1900&&v<=year){ const age=year-v, b=age<5?'young':age<=10?'5to10':'old';
        add('Age',b,b==='young'?'Under 5 years old':b==='5to10'?'5–10 years old':'Over 10 years old',w); }
    });
    let lifts=Object.values(groups).filter(g=>g.ws.length>=2).map(g=>{
      const m=g.ws.length, sum=g.ws.reduce((a,w)=>a+w.rating,0), shrunk=(sum+K*avg)/(m+K);
      const name=Object.entries(g.names).sort((a,b)=>b[1]-a[1])[0][0];
      return {kind:g.kind,name,count:m,avg:Math.round(sum/m),lift:Math.round((shrunk-avg)*10)/10,set:g.ws.map(w=>w.name+'|'+(w.vintage||'')).sort().join(';'),ws:g.ws};
    }).filter(x=>Math.abs(x.lift)>=this.LIFT_MIN&&!(x.kind==='Country'&&x.count===n));
    // The same bottles under two names (Brunello the grape and Tuscany the region): keep the more specific line.
    const order={Producer:0,Grape:1,Region:2,Country:3,Price:4,Age:5};
    lifts.sort((a,b)=>Math.abs(b.lift)-Math.abs(a.lift)||order[a.kind]-order[b.kind]);
    const seen=new Map(); lifts=lifts.filter(x=>{ const o=seen.get(x.set); if(o){ o.also=o.also||x.name; return false; } seen.set(x.set,x); return true; });
    // Listed by how much evidence is behind each lift (its size × √bottles), so nine bottles a
    // couple of points up come before two bottles a few points up; the number shown is the lift.
    const weight=x=>Math.abs(x.lift)*Math.sqrt(x.count);
    const up=lifts.filter(x=>x.lift>0).sort((a,b)=>weight(b)-weight(a)).slice(0,5), down=lifts.filter(x=>x.lift<0).sort((a,b)=>weight(b)-weight(a)).slice(0,3);
    // Price and age as a whole.
    const pw=sc.filter(w=>this.priceOf(w)>0), aw=sc.filter(w=>{ const v=parseInt(w.vintage); return v>1900&&v<=year; });
    const pr=pw.length>=8?this._r(pw.map(w=>Math.log(this.priceOf(w))),pw.map(w=>w.rating)):null;
    const ar=aw.length>=8?this._r(aw.map(w=>year-parseInt(w.vintage)),aw.map(w=>w.rating)):null;
    const money=pr==null?null:pr>=0.3?`Your scores climb with price: the more a ${L.replace(/s$/,'')} costs, the more you tend to like it.`
      :pr<=-0.2?`Price doesn't buy your favourites: your cheaper ${L} score as well as or better than the dear ones.`
      :`Price barely moves your scores, so the best value is where your top scores and lower prices meet.`;
    const age=ar==null?null:ar>=0.3?`You score older ${L} higher: bottle age suits you.`:ar<=-0.3?`You score younger ${L} higher: you like them fresh rather than aged.`:null;
    // In words: what each favourite is like, and the bottles that show it.
    const one=L.replace(/s$/,''), usual=Math.round(avg);
    const title=x=>x.kind==='Grape'?x.name:x.kind==='Region'?`${L.charAt(0).toUpperCase()+L.slice(1)} from ${x.name}`:x.kind==='Producer'?`${x.name}'s ${L}`
      :x.kind==='Country'?`${x.name} ${L}`:x.kind==='Price'?`${L.charAt(0).toUpperCase()+L.slice(1)} ${x.name.toLowerCase()}`:`${L.charAt(0).toUpperCase()+L.slice(1)} ${x.name.toLowerCase()}`;
    const strength=x=>Math.abs(x.lift)>=2.5?(x.lift>0?'Your clearest favourite':'Clearly not your thing'):Math.abs(x.lift)>=1.5?(x.lift>0?'A real favourite':'Usually not your thing'):(x.lift>0?'A gentle lean':'A slight drag');
    const describe=x=>{
      const st=this.styleWords(x.ws,p.axes), fl=this.flavourWords(x.ws);
      const character=st.length||fl.length?`${st.length?this._list(st).charAt(0).toUpperCase()+this._list(st).slice(1):'Often'}${fl.length?`${st.length?', with':''} ${this._list(fl)}`:''}.`:null;
      const pts=Math.round(Math.abs(x.avg-usual));
      const evidence=x.lift>0?`${x.count} bottles, usually around ${x.avg}${pts>=1?`: about ${pts} point${pts===1?'':'s'} above your usual ${usual}`:''}.`
        :`${x.count} bottles, usually around ${x.avg}${pts>=1?`: about ${pts} point${pts===1?'':'s'} below your usual ${usual}`:''}.`;
      const ex=[...x.ws].sort((a,b)=>x.lift>0?b.rating-a.rating:a.rating-b.rating).slice(0,2);
      return {...x,title:title(x),strength:strength(x),character,evidence,examples:ex,ws:undefined};
    };
    // Things you'd name on a wine list (a grape, a region, a producer) come before a price band,
    // an age or a whole country, which only fill in when nothing more specific stands out.
    const named=x=>['Grape','Region','Producer'].includes(x.kind)?0:1;
    const favs=[...up].sort((a,b)=>named(a)-named(b)).slice(0,3).map(describe), nots=[...down].sort((a,b)=>named(a)-named(b)).slice(0,2).map(describe);
    // The portrait: what their best third is like, and the favourites by name.
    const bStyle=this.styleWords(best,p.axes), bFl=this.flavourWords(best,3);
    const names=favs.filter(f=>named(f)===0).slice(0,2).map(f=>f.kind==='Producer'?`${f.name}'s bottles`:f.name);
    const portrait=(bStyle.length||bFl.length||names.length)?`You love ${bStyle.length?this._list(bStyle)+' ':''}${L}${bFl.length?` with ${this._list(bFl)}`:''}${names.length?`, ${names.length>1?'above all':'especially'} ${this._list(names)}`:''}.`:null;
    const headline=portrait||(styleAll[0]?styleAll[0].text:null)||(up[0]?`${up[0].name} lifts your scores most: ${up[0].count} bottles averaging ${up[0].avg}, ${up[0].lift>0?'+':''}${up[0].lift} on your average.`
      :flat?`You score your ${L} very evenly, mostly between ${loCut} and ${hiCut}.`:null);
    return {ready:true,n,avg:Math.round(avg*10)/10,usual,bestAvg,hiCut,loCut,flat,style:styleAll,up:up.map(({ws,...x})=>x),down:down.map(({ws,...x})=>x),favs,nots,portrait,money,age,headline};
  },

  /* Their house wines: the bottles they keep coming back to, rather than just their top scores.
     A wine earns a place by being had more than once (times_consumed), marked to buy again, or
     hearted (Favorites); more of those, then a higher score, rank it higher. A wine they scored
     under 80 never counts. */
  HOUSE_MAX:6,
  houseWines(p){
    return p.wines.filter(w=>!(w.rating>0&&w.rating<ParkerScale.DISLIKED)).map(w=>{ // one they scored under 80 isn't a house wine, however often it's been opened
      const times=w.times_consumed||1, fav=typeof Favorites!=='undefined'&&Favorites.has(w), again=w.buy_again===true;
      const why=[]; if(times>=2) why.push(`had ${times} times`); if(again) why.push("you'd buy it again"); if(fav) why.push('a favourite');
      return why.length?{wine:w,times,fav,again,why,rank:(times-1)*2+(again?2:0)+(fav?2:0)+(w.rating||0)/50}:null;
    }).filter(Boolean).sort((a,b)=>b.rank-a.rank).slice(0,this.HOUSE_MAX);
  },

  // Where they drink a lot vs where they score highest, and what to rethink.
  favourites(p){
    const rank=list=>list.filter(x=>x.scored>=2&&x.avg!=null);
    const regions=rank(p.regionStats), grapes=rank(p.grapeStats);
    const bottles=x=>p.wines.filter(w=>x.kind==='region'?this.region(w)===x.name:(w.grapes||[]).some(g=>this.grape(g)===x.name)).map(w=>w.name).sort().join('|');
    const best=list=>[...list].filter(x=>x.avg>=ParkerScale.LOVED-5).sort((a,b)=>b.avg-a.avg||b.count-a.count).slice(0,3);
    return {
      regions:best(regions), grapes:best(grapes),
      mostScanned:[...p.regionStats].sort((a,b)=>b.count-a.count)[0]||null,
      // A low-scoring region and the grape that makes it are usually the same bottles: show one line.
      rethink:(()=>{ const out=[]; const low=[...regions.map(x=>({...x,kind:'region'})),...grapes.map(x=>({...x,kind:'grape'}))].filter(x=>x.avg<ParkerScale.DISLIKED).sort((a,b)=>a.avg-b.avg);
        low.forEach(x=>{ const same=out.find(o=>bottles(o)===bottles(x)); if(same){ same.also=x.name; } else if(out.length<2) out.push({...x}); }); return out; })(),
      disliked:[...p.disliked].sort((a,b)=>a.rating-b.rating).slice(0,3),
      // Bottles they said they'd buy again: their own shortlist for the next shop.
      buyAgain:p.wines.filter(w=>w.buy_again===true).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,4)
    };
  },

  /* A wine's price in the user's currency: what they paid when they told us, otherwise Claude's
     shop-price estimate from the scan. */
  priceOf(w,rc){
    rc=rc||Regional.current(); const fx=USD_FX[rc.code]||1;
    const pp=w.price_paid;
    if(pp&&pp.amount>0) return pp.code===rc.code?pp.amount:pp.amount/(USD_FX[pp.code]||1)*fx;
    // Then the shop price the Price tab showed (fetchRetailEstimate saves it), then the label guess.
    const sp=w.shop_price;
    if(sp&&sp.amount>0) return sp.code===rc.code?sp.amount:sp.amount/(USD_FX[sp.code]||1)*fx;
    return w.price_usd>0?w.price_usd*fx:null;
  },

  /* Price against score, in local currency. Prices are what the user paid where they said,
     otherwise estimates, and are labelled that way. Needs 6+ scored, priced wines. */
  value(p){
    const rc=Regional.current();
    const ws=p.scored.map(w=>({w,price:this.priceOf(w,rc)})).filter(x=>x.price>0);
    if(ws.length<6) return null;
    const hi=ws.filter(x=>x.w.rating>=ParkerScale.LOVED), rest=ws.filter(x=>x.w.rating<ParkerScale.LOVED);
    const money=v=>`${rc.base}${Math.round(v)}`;
    const sorted=[...ws].sort((a,b)=>a.price-b.price);
    const median=sorted[Math.floor(sorted.length/2)].price;
    const bestValue=hi.filter(x=>x.price<=median).sort((a,b)=>b.w.rating-a.w.rating||a.price-b.price).slice(0,3)
      .map(x=>({wine:x.w,price:money(x.price),paid:!!(x.w.price_paid&&x.w.price_paid.amount>0)}));
    const r=this._r(ws.map(x=>x.price),ws.map(x=>x.w.rating));
    let verdict=null;
    if(hi.length>=2&&rest.length>=2){
      const hiP=this._mean(hi.map(x=>x.price)), restP=this._mean(rest.map(x=>x.price));
      const L=p.label.toLowerCase(), cmp=`(${money(hiP)} vs ${money(restP)})`;
      verdict=hiP<restP*0.9
        ?{kind:'cheaper',text:`Your Outstanding ${L} actually cost less than the rest on average ${cmp}. Price is no guide to what you'll love, so trust your own picks.`}
        :hiP<=restP*1.15
          ?{kind:'flat',text:`Your Outstanding ${L} cost about the same as the rest ${cmp}. Spending more hasn't bought you more enjoyment, so there's no need to trade up to find wines you love.`}
          :r>=0.3
            ?{kind:'pays',text:`Your Outstanding ${L} cost more on average ${cmp}, and higher prices have tended to mean higher scores for you. Stepping up can pay off, especially within your sweet spot.`}
            :{kind:'loose',text:`Your Outstanding ${L} cost a little more on average ${cmp}, but across all your ${L} price and score barely move together. A higher price hasn't reliably meant a better bottle for you.`};
    }
    return {n:ws.length,paid:ws.filter(x=>x.w.price_paid&&x.w.price_paid.amount>0).length,code:rc.code,sweetSpot:hi.length>=2?SommelierScript.budget(hi.map(x=>x.w),rc):null,bestValue,verdict};
  },

  // Blind Call guesses made after scanning these wines (accuracy 0–1 per wine).
  blindCall(wines){
    const acc=[];
    wines.forEach(w=>{
      const key='vinterest_blindcall_result_'+((w.name||'')+'_'+(w.vintage||'nv')).replace(/\s/g,'_');
      try{ const r=JSON.parse(Store.get(key)||'null'); if(r&&typeof r.accuracy==='number') acc.push(r.accuracy); }catch(e){}
    });
    return acc.length?{played:acc.length,accuracy:Math.round(this._mean(acc)*100)}:null;
  },

  // One plain sentence per bar, from the user's own wines only (no generic grape claims).
  axisNote(p,k){
    const ws=p.chosen.filter(w=>typeof this.axisValue(w,k)==='number');
    if(ws.length<2) return null;
    const A=this.AXES[k], lvl=this.level(p.avg[k]);
    const sorted=[...ws].sort((a,b)=>this.axisValue(b,k)-this.axisValue(a,k));
    const top=sorted[0], bottom=sorted[sorted.length-1];
    const word={high:A.high.toLowerCase(),mid:'medium',low:A.low.toLowerCase()}[lvl];
    let s=`The ${p.label.toLowerCase()} you choose are ${word} on average, from ${bottom.name} at the ${A.lowAdj.split(',')[0]} end to ${top.name} at the ${A.highAdj.split(',')[0]} end.`;
    const sig=p.signals.find(x=>x.axis===k);
    if(sig) s+=` Your Outstanding ones lean ${sig.adj}.`;
    return s;
  },

  // How their choices are changing: bottles per period, and places/grapes new to them.
  journey(wines){
    const dated=wines.filter(w=>w.scanned_at||w.last_scanned).map(w=>({w,d:new Date(w.scanned_at||w.last_scanned)})).filter(x=>!isNaN(x.d)).sort((a,b)=>a.d-b.d);
    if(dated.length<3) return [];
    const span=(dated[dated.length-1].d-dated[0].d)/86400000;
    const g=span<=10?'day':span<=70?'week':span<=700?'month':'year';
    const key=d=>g==='day'?d.toISOString().slice(0,10):g==='week'?d.getFullYear()+'-'+Math.ceil(((d-new Date(d.getFullYear(),0,1))/86400000+1)/7):g==='month'?d.getFullYear()+'-'+d.getMonth():String(d.getFullYear());
    const lab=d=>g==='year'?String(d.getFullYear()):g==='month'?d.toLocaleDateString('en',{month:'short',year:'2-digit'}):d.toLocaleDateString('en',{month:'short',day:'numeric'});
    const seenR=new Set(), seenG=new Set(), buckets=new Map();
    dated.forEach(({w,d})=>{
      const k=key(d); if(!buckets.has(k)) buckets.set(k,{label:lab(d),count:0,newRegions:[],newGrapes:[],scores:[]});
      const b=buckets.get(k); b.count++; if(w.rating>0) b.scores.push(w.rating);
      const r=this.region(w); if(r&&!seenR.has(r)){ seenR.add(r); b.newRegions.push(r); }
      (w.grapes||[]).map(x=>this.grape(x)).filter(Boolean).forEach(x=>{ if(!seenG.has(x)){ seenG.add(x); b.newGrapes.push(x); } });
    });
    return [...buckets.values()].slice(-6).map(b=>({...b,unit:g,avgScore:b.scores.length?Math.round(this._mean(b.scores)):null}));
  },

  /* The facts the Claude-written summary is allowed to use, so it can only restate what's true. */
  summaryFacts(p){
    const f=[];
    f.push(`Wine type: ${p.label}. ${p.wines.length} scanned, ${p.scored.length} scored on the 100-point scale, ${p.loved.length} scored 90+ (Outstanding).`);
    f.push(`Personality label: ${p.personality} (based on ${p.basis==='loved'?'their 90+ wines':'all the wines they chose'}).`);
    f.push(`Style of the wines they choose: ${p.axes.filter(k=>p.avg[k]!=null).map(k=>`${this.AXES[k].name.toLowerCase()} ${this.level(p.avg[k])}`).join(', ')}.`);
    p.signals.forEach(s=>f.push(`Preference signal: ${s.text} ${s.detail}`));
    // What they love, on their own scale (WineDNA.loves): the summary's "What You Love" is built from this.
    const lv=p.loves;
    if(lv&&lv.ready){
      f.push(`Their usual score for ${p.label.toLowerCase()} is ${lv.usual}; their best third score ${lv.hiCut}+.`);
      if(lv.portrait) f.push(`What they love, in a line: ${lv.portrait}`);
      lv.favs.forEach(x=>f.push(`What they love: ${x.title}${x.also?` (also ${x.also})`:''}. ${x.strength}. ${x.character||''} ${x.evidence} Best bottles: ${x.examples.map(w=>`${w.name} (${w.rating})`).join(', ')}.`));
      lv.nots.forEach(x=>f.push(`Less their thing: ${x.title}${x.also?` (also ${x.also})`:''}. ${x.character||''} ${x.evidence} Lowest: ${x.examples.map(w=>`${w.name} (${w.rating})`).join(', ')}.`));
      [lv.money,lv.age].filter(Boolean).forEach(x=>f.push(x));
    } else {
      if(p.favourites.regions.length) f.push(`Highest-scoring regions: ${p.favourites.regions.map(r=>`${r.name} (${r.count} bottles, avg ${r.avg})`).join('; ')}.`);
      if(p.favourites.grapes.length) f.push(`Highest-scoring grapes: ${p.favourites.grapes.map(g=>`${g.name} (${g.count}, avg ${g.avg})`).join('; ')}.`);
    }
    if(p.favourites.disliked.length) f.push(`Scored below 80: ${p.favourites.disliked.map(w=>`${w.name}${w.region?' from '+w.region:''} (${w.rating})`).join('; ')}.`);
    if(p.value&&p.value.verdict) f.push(`Value: ${p.value.verdict.text}`);
    return f.join('\n');
  }
};
