/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s){return(s||'').toLowerCase().replace('é','e');}
function _avg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;}
/* Rating-weighted average — wines you rated higher count for more of the profile than ones you scanned but rated low/not at all. */
function _wavg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);if(!ws.length)return fb;let num=0,den=0;ws.forEach(w=>{const wt=Math.max(w.rating||55,5)/100;num+=w[field]*wt;den+=wt;});return den?num/den:fb;}
/* Rating-weighted tally — an attribute (grape/region/note) earns weight from every wine it appears in, scaled by that wine's rating, so one obscure low-rated bottle can't outrank several wines you actually rated well. */
function _topByWeightedCount(items){const c={};items.forEach(({v,rating})=>{if(v)c[v]=(c[v]||0)+Math.max(rating||55,5);});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
/* Traits (grapes/regions) that skew toward your lowest-rated bottles — used to keep "Explore Next" from recommending things anchored to what you don't like. */
function _lowTraits(wines,pluck){const rated=wines.filter(w=>w.rating>0);if(rated.length<4)return new Set();const sorted=[...rated].sort((a,b)=>a.rating-b.rating);const cutoff=sorted[Math.max(0,Math.floor(sorted.length/3)-1)].rating;const low=sorted.filter(w=>w.rating<=cutoff);const set=new Set();low.forEach(w=>pluck(w).forEach(v=>{if(v)set.add(v.toLowerCase());}));return set;}
function _topGrapes(wines,n){const all=[];wines.forEach(w=>(w.grapes||[]).forEach(g=>{if(g)all.push({v:g,rating:w.rating});}));return _topByWeightedCount(all).slice(0,n);}
function _topRegions(wines,n){const all=wines.filter(w=>w.region).map(w=>({v:w.region,rating:w.rating}));return _topByWeightedCount(all).slice(0,n);}
function _topNotes(wines,n){const all=[];wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{if(t)all.push({v:t,rating:w.rating});}));return _topByWeightedCount(all).slice(0,n);}

/* ── Personality labels ── */
function _personality(key,b,ta,ac,sw){
  if(key==='red'){
    if(b>=0.72&&ta>=0.68) return 'Bold & Structured';
    if(b>=0.70&&ta<0.52)  return 'Full & Velvety';
    if(b<0.48)            return 'Light & Elegant';
    if(ac>=0.68)          return 'Bright & Earthy';
    return 'Classic & Balanced';
  }
  if(key==='white'){
    if(ac>=0.70&&b<0.52)  return 'Crisp & Mineral';
    if(b>=0.68)           return 'Rich & Textured';
    if(ac>=0.65)          return 'Zingy & Aromatic';
    return 'Clean & Precise';
  }
  if(key==='rose'){
    if(sw<0.18)           return 'Bone Dry & Delicate';
    if(b>=0.55)           return 'Fruity & Expressive';
    return 'Fresh & Crisp';
  }
  if(key==='sparkling'){
    if(b>=0.60)           return 'Classic & Toasty';
    if(ac>=0.70)          return 'Taut & Precise';
    return 'Elegant & Fine';
  }
  if(key==='orange'){
    if(ta>=0.50)          return 'Textured & Tannic';
    if(ac>=0.65)          return 'Bright & Funky';
    return 'Amber & Aromatic';
  }
  if(key==='dessert'){
    if(sw>=0.70)          return 'Lusciously Sweet';
    if(ac>=0.65)          return 'Honeyed & Vibrant';
    return 'Rich & Nectarous';
  }
  if(key==='fortified'){
    if(sw>=0.50)          return 'Sweet & Fortified';
    return 'Dry & Nutty';
  }
  return 'Eclectic Palate';
}

/* ── DNA "why" lines ── */
function _dnaWhy(axis,val,topGrapes,topRegions){
  const g=topGrapes.slice(0,2);
  const r=topRegions[0];
  const gs=g.length?g.join(' and '):null;
  const hi=val>=0.68,lo=val<=0.38;
  const T={
    body:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} a naturally full-bodied grape — your instinct for weight and presence runs deep.`
           :r?`${r} wines are known for their presence — your ratings confirm the pattern.`
             :'You consistently favour wines with body — it\'s become your comfort zone.',
      md:gs?`${gs} sit in the middle of the body spectrum — you gravitate toward balance over extremes.`
           :'Your palate finds medium body most satisfying — structured but never heavy.',
      lo:gs?`${gs} ${g.length>1?'are':'is'} naturally light — you favour finesse and precision over power.`
           :'Lighter body is a consistent thread — you reach for elegance over weight.',
    },
    tannins:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} grippy by nature — you gravitate toward wines built to age.`
           :'Firm tannins run through your collection — you value structure and backbone.',
      md:gs?`${gs} deliver just enough grip to be interesting without being stern.`
           :'You sit in the moderate-tannin zone — structure without severity.',
      lo:gs?`Silky tannins define your style — ${gs} ${g.length>1?'are':'is'} smooth by design, not dilution.`
           :'You prefer wines that are smooth and approachable rather than grippy.',
    },
    acidity:{
      hi:gs?`${gs} ${g.length>1?'are':'is'} high-acid by nature — you\'re drawn to tension, freshness, and wines that cut through food.`
           :'High acidity is a running theme — you reach for wines with energy and bite.',
      md:gs?`${gs} sit in a comfortable acid balance — enough freshness without bite.`
           :'Balanced acidity is your sweet spot — not tart, not flat.',
      lo:gs?`You favour rounder wines — ${gs} lean toward richness over tartness.`
           :'Low acidity is the common thread — richer, rounder wines that don\'t bite.',
    },
    sweetness:{
      hi:gs?`A touch of sweetness recurs in your highest-rated wines — ${gs} reflect that preference.`
           :'Off-dry to sweet is clearly welcome — residual sugar is a positive in your book.',
      md:'Off-dry is your comfort zone — a hint of sweetness that frames the acidity.',
      lo:gs?`Bone dry is your default — ${gs} ${g.length>1?'are':'is'} grown for austerity, and you appreciate it.`
           :'Bone dry, consistently — sweetness doesn\'t register as a positive for you.',
    },
    texture:{
      hi:'Rich, creamy textures show up again and again — oak aging and lees contact are clearly a plus for you.',
      md:'You land in the middle on texture — a little roundness without going fully creamy or oaky.',
      lo:'Crisp, steely whites are your throughline — you favour precision and minerality over oak or creaminess.',
    },
    effervescence:{
      hi:'Fine, persistent bubbles are your pattern — you gravitate toward traditional-method fizz built for texture and length.',
      md:'A moderate, easy mousse suits you best — enough energy without demanding too much attention.',
      lo:'Soft, gentle bubbles are your preference — approachable fizz over intense, aggressive mousse.',
    },
  };
  return T[axis]?.[hi?'hi':lo?'lo':'md']||'';
}

/* ── Gap map ── */
function _gaps(typeKey,avgB,avgT,avgA,avgS,topGrapes,topRegions,wines){
  const rgs=new Set(topRegions.map(r=>(r||'').toLowerCase()));
  const gps=new Set(topGrapes.map(g=>(g||'').toLowerCase()));
  const lowRgs=_lowTraits(wines,w=>[w.region]);
  const lowGps=_lowTraits(wines,w=>w.grapes||[]);
  const topG=topGrapes[0],topR=topRegions[0];
  // Every suggestion's copy names only your OWN top grape/region as the reason — never a comparison to a specific
  // third-party bottle, so it can't accidentally sell a wine by likening it to something you rated low.
  const pool={
    red:[
      {wine:'Aglianico from Taurasi',region:'Campania, Italy',anchorGrapes:['tempranillo','sangiovese','cabernet sauvignon','merlot'],why:`Similar grip and structure to your ${topG||'favorite reds'}, with a smoky, volcanic character you haven't explored.`,cond:avgT>=0.60&&!rgs.has('campania')},
      {wine:'Côte-Rôtie (Syrah)',region:'Northern Rhône, France',anchorGrapes:['syrah','shiraz'],why:`Builds on your love of ${topG||'Syrah'} with violet and smoked-meat notes your current bottles don't have.`,cond:avgB>=0.65&&(gps.has('syrah')||gps.has('shiraz'))},
      {wine:'Douro Red Blend',region:'Portugal',anchorGrapes:['tempranillo','touriga nacional'],why:`Rooted in the same grip and dark fruit as your ${topG||'top reds'}, from a region you haven't scanned yet.`,cond:avgT>=0.60&&!rgs.has('douro')&&!rgs.has('portugal')},
      {wine:'Etna Rosso (Nerello Mascalese)',region:'Sicily',anchorRegions:['tuscany','piedmont'],why:`Shares the high-acid, earthy backbone of your ${topR||'top region'} reds, with a volcanic mineral edge that's new.`,cond:avgA>=0.60&&!rgs.has('sicily')},
    ],
    white:[
      {wine:'Grüner Veltliner Smaragd',region:'Wachau, Austria',anchorRegions:['burgundy','chablis','loire'],why:`Matches the piercing acidity you go for in ${topR||'your top whites'}, with a white pepper note you haven't tried.`,cond:avgA>=0.65&&!rgs.has('austria')},
      {wine:'Assyrtiko from Santorini',region:'Greece',anchorRegions:['chablis','burgundy'],why:`Takes the mineral drive of your ${topR||'top whites'} to a bone-dry, volcanic extreme.`,cond:avgA>=0.62&&!rgs.has('greece')},
      {wine:'Aged White Rioja',region:'Spain',anchorRegions:['rioja'],why:`From the same region as your ${topR||'favorite'} reds, but oxidatively aged for a nutty, textural white style you haven't tried.`,cond:!rgs.has('rioja')&&rgs.has('spain')},
    ],
    rose:[
      {wine:'Bandol Rosé (Mourvèdre)',region:'Provence, France',anchorRegions:['provence'],why:`Pushes your bone-dry ${topR||'Provençal'} instinct into richer, more saline territory.`,cond:rgs.has('provence')&&!lowGps.has('mourvèdre')&&!lowGps.has('mourvedre')},
      {wine:'Tavel Rosé',region:'Rhône Valley, France',why:'The boldest dry rosé in France — challenges a lighter palate with real structure and food-worthiness.',cond:avgB<0.55},
    ],
    sparkling:[
      {wine:'Blanc de Noirs (Meunier grower)',region:'Vallée de la Marne',why:'A grower Meunier Champagne takes a bready, toasty preference toward wilder, earthier complexity.',cond:avgB>=0.55},
      {wine:'Aged Vintage Champagne',region:'Champagne',why:'Ten-plus years on lees pushes a toasty preference to its extreme — deep oxidative notes and extraordinary length.',cond:true},
      {wine:'Pét-Nat from Loire',region:'France',why:'A useful contrast to your polished picks — wild, cloudy, funky, and structurally the opposite.',cond:avgA>=0.65},
    ],
    orange:[
      {wine:'Ramato Pinot Grigio',region:'Friuli, Italy',anchorRegions:['friuli','collio'],why:`Builds on your love of ${topR||'Friulian skin-contact whites'} with a lighter, rosé-hued take on extended maceration.`,cond:avgT>=0.40},
      {wine:'Rkatsiteli, Qvevri-aged',region:'Georgia',anchorGrapes:['rkatsiteli'],why:`Georgia is the birthplace of skin-contact winemaking, aged in buried clay qvevri instead of steel or oak.`,cond:!rgs.has('georgia')},
      {wine:'Amber Riesling',region:'Wachau, Austria',anchorGrapes:['riesling'],why:`Takes the acidity you like in ${topG||'aromatic whites'} and adds real tannic grip from skin contact.`,cond:avgA>=0.60&&(gps.has('riesling'))},
    ],
    dessert:[
      {wine:'Tokaji Aszú (5 Puttonyos)',region:'Tokaj, Hungary',why:`Botrytis-affected and intensely honeyed, with the piercing acidity that keeps ${topR||'great dessert wines'} from feeling cloying.`,cond:avgA>=0.55},
      {wine:'Vin Santo',region:'Tuscany, Italy',why:'Dried-grape sweetness with a nutty, oxidative edge — a different path to richness than botrytis wines.',cond:avgB>=0.5},
      {wine:'Eiswein',region:'Mosel, Germany',why:'Grapes frozen on the vine concentrate sugar and acid alike — searingly sweet but never flabby.',cond:avgA>=0.65},
    ],
    fortified:[
      {wine:'Amontillado Sherry',region:'Jerez, Spain',why:'Starts biologically aged like a Fino, then oxidizes further in barrel — dry, nutty, and complex.',cond:avgS<0.4},
      {wine:'10-Year Tawny Port',region:'Douro, Portugal',why:'Barrel-aged oxidatively for a decade, trading Vintage Port\u2019s fruit for dried fig, caramel and walnut.',cond:avgS>=0.3},
      {wine:'Rare Madeira',region:'Madeira, Portugal',why:'Deliberately heated and oxidized during production — the only fortified wine that improves for centuries once opened.',cond:true},
    ],
  };
  return (pool[typeKey]||[]).filter(s=>{
    if(!s.cond) return false;
    if(s.anchorGrapes&&!s.anchorGrapes.some(g=>gps.has(g))) return false;
    if(s.anchorRegions&&!s.anchorRegions.some(r=>rgs.has(r))) return false;
    if(s.avoidGrapes&&s.avoidGrapes.some(g=>lowGps.has(g))) return false;
    if(s.avoidRegions&&s.avoidRegions.some(r=>lowRgs.has(r))) return false;
    return true;
  }).slice(0,2);
}

/* ── Flavour clusters ── */
const _NOTE_CLUSTERS=[
  {name:'Dark Fruit & Spice',    kw:['blackberry','blackcurrant','black cherry','plum','dark cherry','black fruit','blueberry','clove','pepper','spice','anise','liquorice']},
  {name:'Red Fruit & Floral',    kw:['cherry','raspberry','strawberry','redcurrant','red fruit','pomegranate','violet','rose','hibiscus']},
  {name:'Earth & Leather',       kw:['earth','leather','tobacco','truffle','forest floor','mushroom','barnyard','smoke','tar','graphite','iron']},
  {name:'Citrus & Mineral',      kw:['lemon','lime','grapefruit','citrus','mineral','chalk','flint','oyster','saline','wet stone','slate']},
  {name:'Oak & Vanilla',         kw:['vanilla','caramel','toast','oak','cedar','sandalwood','coconut','cream','butterscotch']},
  {name:'Herb & Savour',         kw:['herb','thyme','rosemary','olive','green pepper','eucalyptus','menthol','garrigue','dried herb']},
  {name:'Tropical & Stone Fruit',kw:['peach','apricot','nectarine','mango','pineapple','passion fruit','melon','guava','lychee']},
  {name:'Brioche & Yeast',       kw:['brioche','toast','biscuit','bread','yeast','pastry','almonds','hazelnut']},
];
const _FOOD_PAIRINGS={
  'Dark Fruit & Spice':   'Grilled red meat, aged hard cheese, braised short rib',
  'Red Fruit & Floral':   'Duck breast, mushroom risotto, charcuterie',
  'Earth & Leather':      'Truffles, aged Parmigiano, roasted lamb',
  'Citrus & Mineral':     'Oysters, grilled white fish, goat cheese',
  'Oak & Vanilla':        'Lobster, roast chicken, crème brûlée',
  'Herb & Savour':        'Herb-roasted chicken, tapenade, grilled vegetables',
  'Tropical & Stone Fruit':'Spiced Asian dishes, crab, soft fresh cheese',
  'Brioche & Yeast':      'Aged Gruyère, smoked salmon, caviar',
};
function _clusterNotes(notes){
  const result=[];const used=new Set();
  _NOTE_CLUSTERS.forEach(cl=>{
    const matches=notes.filter(n=>{const nl=n.toLowerCase();return cl.kw.some(k=>nl.includes(k))&&!used.has(n);});
    if(matches.length>=1){matches.forEach(m=>used.add(m));result.push({name:cl.name,notes:matches.slice(0,4)});}
  });
  return result.slice(0,3);
}

/* ── Palate evolution ── */
function _evolution(wines){
  const rated=wines.filter(w=>w.rating>0&&(w.scanned_at||w.last_scanned));
  if(rated.length<3) return [];
  const sorted=[...rated].sort((a,b)=>new Date(a.scanned_at||a.last_scanned||0)-new Date(b.scanned_at||b.last_scanned||0));
  const firstD=new Date(sorted[0].scanned_at||sorted[0].last_scanned||0);
  const lastD=new Date(sorted[sorted.length-1].scanned_at||sorted[sorted.length-1].last_scanned||0);
  const spanDays=(lastD-firstD)/86400000;

  // Bucket by REAL calendar period (not by equal wine-count chunks) so bars always
  // reflect actual scan dates — a handful of new scans this month always shows up
  // as its own bar instead of getting merged into an old chunk's date range.
  function weekKey(d){
    const onejan=new Date(d.getFullYear(),0,1);
    const wk=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7);
    return d.getFullYear()+'-W'+wk;
  }
  const granularity=spanDays<=10?'day':spanDays<=70?'week':spanDays<=700?'month':'year';
  function bucketKey(d){
    if(granularity==='day')   return d.toISOString().slice(0,10);
    if(granularity==='week')  return weekKey(d);
    if(granularity==='month') return d.getFullYear()+'-'+d.getMonth();
    return String(d.getFullYear());
  }
  function labelFor(d){
    if(granularity==='year') return d.toLocaleDateString('en',{year:'numeric'});
    if(granularity==='month') return d.toLocaleDateString('en',{month:'short',year:'2-digit'});
    return d.toLocaleDateString('en',{month:'short',day:'numeric'});
  }

  const buckets=new Map();
  sorted.forEach(w=>{
    const d=new Date(w.scanned_at||w.last_scanned);
    const key=bucketKey(d);
    if(!buckets.has(key)) buckets.set(key,{sum:0,count:0,lastDate:d,types:{red:0,white:0,rose:0,sparkling:0,orange:0,dessert:0,fortified:0},order:d.getTime()});
    const b=buckets.get(key);
    b.sum+=w.rating; b.count++;
    if(d>b.lastDate) b.lastDate=d;
    const t=_norm(w.type); if(b.types[t]!==undefined) b.types[t]++; else b.types.red++;
  });

  let chunks=[...buckets.values()].sort((a,b)=>a.order-b.order).map(b=>({
    label:labelFor(b.lastDate),
    avgR:Math.round(b.sum/b.count),
    count:b.count,
    dom:Object.entries(b.types).sort((a,b2)=>b2[1]-a[1])[0][0],
  }));

  // Keep the chart readable — cap to the most recent 6 periods.
  if(chunks.length>6) chunks=chunks.slice(chunks.length-6);
  return chunks;
}

const _TYPE_COLORS={red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8',orange:'#C1652B',dessert:'#8A5A2B',fortified:'#5C2A1E'};
const _TYPES=[
  {key:'red',       label:'Reds',     col:'#8B1A2F'},
  {key:'white',     label:'Whites',   col:'#B8963E'},
  {key:'rose',      label:'Rosé',     col:'#C47A8A'},
  {key:'sparkling', label:'Sparkling',col:'#5E8FA8'},
  {key:'orange',    label:'Orange',   col:'#C1652B'},
  {key:'dessert',   label:'Dessert',  col:'#8A5A2B'},
  {key:'fortified', label:'Fortified',col:'#5C2A1E'},
];

/* Collapsible section header — collapsed state shows a short useful summary + expand CTA below the title */
function CSH({label,cKey,collapsed,toggle,summary}){
  const isC=collapsed[cKey];
  return(
    <div style={{marginTop:6,marginBottom:isC?12:6}}>
      <div onClick={()=>toggle(cKey)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:'2px 0'}}>
        <span style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P}}>{label}</span>
        <svg viewBox="0 0 20 20" width={16} height={16} style={{transform:isC?'none':'rotate(180deg)',transition:'transform .2s',flexShrink:0,marginLeft:8,opacity:0.45}}>
          <polyline points="4,7 10,13 16,7" stroke={C.mid} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {isC&&summary&&(
        <div style={{marginTop:4}}>
          <div style={{fontSize:14.5,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty'}}>{summary}</div>
          <span onClick={()=>toggle(cKey)} style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer',display:'inline-block',marginTop:6}}>Expand for full details →</span>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────
   WineDNA Screen
────────────────────────────────────────────────── */
function WineDNAScreen({nav,back,showPro}){
  const [typeIdx,setTypeIdx]=React.useState(0);
  const [tabToast,setTabToast]=React.useState(null);
  const [genSummaries,setGenSummaries]=React.useState({});
  const [generatingSummary,setGeneratingSummary]=React.useState(null);
  const [genScripts,setGenScripts]=React.useState({});
  const [generatingScript,setGeneratingScript]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const [scriptLength,setScriptLength]=React.useState(localStorage.getItem('vinterest_script_length')||'long');
  const COLLAPSE_KEY='vinterest_dna_collapsed_v1';
  const [collapsed,setCollapsed]=React.useState(()=>{
    const def={taste:false,explore:false,flavour:false,journey:false,scripts:false,history:false};
    try{
      const saved=JSON.parse(localStorage.getItem(COLLAPSE_KEY)||'null');
      if(saved) return {...def,...saved};
    }catch(e){}
    return def;
  });
  const toggle=React.useCallback(k=>setCollapsed(c=>{
    const next={...c,[k]:!c[k]};
    try{localStorage.setItem(COLLAPSE_KEY,JSON.stringify(next));}catch(e){}
    return next;
  }),[]);
  const touchX=React.useRef(null);
  const touchY=React.useRef(null);

  const allWines=WineHistory.getAll();
  /* Currency helpers */
  const _FX={GBP:0.79,CAD:1.36,AUD:1.53,NZD:1.64,EUR:0.92,USD:1.0,JPY:150,CNY:7.2,CHF:0.88,ZAR:18.5,SGD:1.34,HKD:7.8,MXN:18,BRL:5.4,INR:83,AED:3.67,SEK:10.4,NOK:10.6,DKK:6.9};
  const _rc=Regional.current();
  const _csym=_rc.sym;
  const _cbase=_rc.base;
  const _ccode=_rc.code;
  const _cfx=_FX[_rc.code]||1.0;
  const xd=XPSystem.get();
  const lv=XPSystem.getLevel(xd.total);
  const nx=XPSystem.nextLevel(xd.total);
  const pg=XPSystem.levelProgress(xd.total);

  /* Per-type stats */
  const typeStats=React.useMemo(()=>_TYPES.map(tp=>{
    const wines=allWines.filter(w=>_norm(w.type)===tp.key);
    const pct=allWines.length?Math.round(wines.length/allWines.length*100):0;
    const avgB=_wavg(wines,'body',0.65);
    const avgT=_wavg(wines,'tannins',0.55);
    const avgA=_wavg(wines,'acidity',0.60);
    const avgS=_wavg(wines,'sweetness',0.10);
    const avgX=_wavg(wines,'texture',0.3);
    const avgE=_wavg(wines,'effervescence',0.6);
    const topGrapes=_topGrapes(wines,4);
    const topRegions=_topRegions(wines,4);
    const topNotes=_topNotes(wines,14);
    const noteClusters=_clusterNotes(topNotes);
    const personality=_personality(tp.key,avgB,avgT,avgA,avgS);
    const gaps=_gaps(tp.key,avgB,avgT,avgA,avgS,topGrapes,topRegions,wines);
    const topWines=[...wines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);
    return{...tp,wines,pct,avgB,avgT,avgA,avgS,avgX,avgE,topGrapes,topRegions,topNotes,noteClusters,personality,gaps,topWines};
  }),[allWines.length]);

  const t=typeStats[typeIdx];
  const visibleIdxs=typeStats.reduce((arr,ts,i)=>{ if(i<4||ts.wines.length>0) arr.push(i); return arr; },[]);
  function pickType(i){
    if(i<4&&typeStats[i].wines.length===0){ setTabToast(`You haven't scanned a ${typeStats[i].label.toLowerCase()} yet`); setTimeout(()=>setTabToast(null),1800); return; }
    setTypeIdx(i);
  }
  function stepType(dir){
    const pos=visibleIdxs.indexOf(typeIdx);
    const next=visibleIdxs[Math.min(visibleIdxs.length-1,Math.max(0,pos+dir))];
    setTypeIdx(next);
  }

  /* LLM summary */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_dna_v5_${t.key}_n${t.wines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenSummaries(s=>({...s,[t.key]:cached}));return;}
    if(genSummaries[t.key]||generatingSummary===t.key) return;
    setGeneratingSummary(t.key);
    const ratedAsc=[...t.wines].filter(w=>w.rating>0).sort((a,b)=>(a.rating||0)-(b.rating||0));
    const hasLow=ratedAsc.length>=4;
    const topWinesForPrompt=[...t.wines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,5);
    const lowWinesForPrompt=hasLow?ratedAsc.slice(0,3):[];
    const wineList=topWinesForPrompt.map(w=>`${w.name}${w.vintage?' '+w.vintage:''}${w.region?' from '+w.region:''}${w.rating?' rated '+w.rating+'/100':''}`).join('; ');
    const lowList=lowWinesForPrompt.map(w=>`${w.name}${w.vintage?' '+w.vintage:''}${w.region?' from '+w.region:''}${w.rating?' rated '+w.rating+'/100':''}`).join('; ');
    const prompt=`My ${t.label.toLowerCase()} wine personality is "${t.personality}". My computed top grapes are: ${t.topGrapes.join(', ')||'none'}. My computed top regions are: ${t.topRegions.join(', ')||'none'}. My highest-rated ${t.label.toLowerCase()} wines: ${wineList||'none'}.${hasLow?` My lowest-rated ${t.label.toLowerCase()} wines: ${lowList}.`:''} Return ONLY raw JSON — no markdown, no code fences, no extra text, just the JSON object: {"preference":"one sentence on what I gravitate toward — max 18 words","like":"one sentence on specifically what I like — you MUST only name grapes/regions from the computed top grapes/regions or highest-rated wines lists above, never invent or infer any other grape or region — max 18 words"${hasLow?',"dislike":"one sentence on what I tend to rate lower — you MUST only name grapes, regions, or style traits drawn from my lowest-rated wines list above, never invent others — max 18 words"':''}}`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenSummaries(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingSummary(null));
  },[typeIdx,allWines.length]);

  /* LLM sommelier script — short + long variants (shared cache with Home) */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_script_${scriptLength}_${t.key}_n${t.wines.length}_${_ccode}_v2`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[t.key]:cached}));return;}
    if(generatingScript===t.key) return;
    setGeneratingScript(t.key);
    const wineList=t.wines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const lengthInst=scriptLength==='short'?`1 sentence, ultra-concise (under 20 words), mention your typical budget range formatted EXACTLY like "${_cbase}40-${_cbase}80 ${_ccode}" (plain symbol, a number range, then the ${_ccode} currency code, never a country-prefixed symbol like CA$ or C$)`:'2 sentences max';
    const prompt=`I've scanned and rated these ${t.label.toLowerCase()} wines: ${wineList}. Based ONLY on the wines I've chosen and their regions, write a ${lengthInst} natural first-person sommelier script I could say to a restaurant sommelier. Reflect my apparent style and preferred regions. If you mention a budget or price range, it MUST use the plain ${_cbase} symbol plus the ${_ccode} code, formatted like "${_cbase}40-${_cbase}80 ${_ccode}" — never a country-prefixed symbol. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenScripts(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingScript(null));
  },[typeIdx,allWines.length,scriptLength]);

  /* Swipe */
  function onTouchStart(e){touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;}
  function onTouchEnd(e){
    if(touchX.current===null)return;
    const dx=e.changedTouches[0].clientX-touchX.current;
    const dy=e.changedTouches[0].clientY-(touchY.current||0);
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0)stepType(1);
      else stepType(-1);
    }
    touchX.current=null;touchY.current=null;
  }

  /* Per-type stats */
  const tRated=t.wines.filter(w=>w.rating>0);
  const tAvgRating=tRated.length?Math.round(tRated.reduce((s,w)=>s+w.rating,0)/tRated.length):0;
  const tCountries=new Set(t.wines.map(w=>w.country).filter(Boolean)).size;
  const tAvgPrice=_avg(t.wines,'price_usd',0);
  const SH=({label})=>(<div style={{fontSize:13,fontWeight:700,color:C.mid,letterSpacing:'0.09em',textTransform:'uppercase',fontFamily:C.P,marginTop:6,marginBottom:-4}}>{label}</div>);

  /* Empty state */
  if(!allWines.length) return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>
      <div style={{background:C.white,padding:'16px 20px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:2}}>
          <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
            <Icon n="back" sz={16} col={C.ink}/>
          </div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>WineDNA</div>
        </div>
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginLeft:46}}>Your personal taste intelligence</div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px',textAlign:'center',gap:16}}>
        <div style={{width:88,height:88,borderRadius:22,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${C.crDim}`}}>
          <Icon n="brain" sz={42} col={C.cr}/>
        </div>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:8,lineHeight:1.2}}>Your WineDNA is waiting</div>
          <div style={{fontSize:17,color:C.mid,fontFamily:C.P,lineHeight:1.65,maxWidth:280}}>Scan and rate bottles to unlock your personal taste profile, sommelier scripts, and wine intelligence.</div>
        </div>
        <Btn primary full onClick={()=>nav('camera')}>Scan Your First Bottle</Btn>
      </div>
    </div>
  );

  /* Global stats */
  const ratedAll=allWines.filter(w=>w.rating>0);
  const avgRatingAll=ratedAll.length?Math.round(ratedAll.reduce((s,w)=>s+w.rating,0)/ratedAll.length):0;
  const ccounts={};allWines.forEach(w=>{if(w.country)ccounts[w.country]=(ccounts[w.country]||0)+1;});
  const uniqueCountries=Object.keys(ccounts).length;
  const topRated=[...allWines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,5);
  const avgPrice=_avg(allWines,'price_usd',0);
  const evolution=_evolution(t.wines);

  /* Synthesis chips */
  const chips=[];
  if(t.topGrapes[0]) chips.push({label:'Top grape',value:t.topGrapes[0]});
  if(t.topRegions[0]) chips.push({label:'Lead region',value:t.topRegions[0]});
  chips.push({label:'Body',value:t.avgB>=0.72?'Full':t.avgB>=0.42?'Medium':'Light'});

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {/* Title row: back ←→ WineDNA ←→ personality badge, baseline aligned */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4,gap:10}}>
          <div style={{display:'flex',alignItems:'center',gap:12,minWidth:0}}>
            <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
              <Icon n="back" sz={16} col={C.ink}/>
            </div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px'}}>WineDNA</div>
          </div>
          {t.wines.length>0&&(
            <div style={{padding:'4px 11px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`,flexShrink:0}}>
              <span style={{fontSize:15,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.personality}</span>
            </div>
          )}
        </div>
        {/* Subtitle row: type pill + bottle count */}
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
            <div style={{width:5,height:5,borderRadius:3,background:t.col,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:700,color:t.col,fontFamily:C.P,letterSpacing:'0.05em'}}>{t.label.toUpperCase()}</span>
          </div>
          <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{allWines.length} bottle{allWines.length!==1?'s':''} · {lv.badge} {lv.name}</span>
        </div>
        <div style={{marginTop:10}}>
          <Prog val={pg} h={5} col={C.cr}/>
          {nx&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:3}}>{xd.total} XP · {nx.min-xd.total} to {nx.name}</div>}
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
      <div style={{padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

        <SH label="Your WineDNA"/>
        {/* ── Synthesis Card ── */}
        <Card style={{padding:0,overflow:'hidden'}}>

          {/* Type-distribution bar */}
          <div style={{height:5,background:`linear-gradient(90deg,#8B1A2F 0% ${typeStats[0].pct}%,#B8963E ${typeStats[0].pct}% ${typeStats[0].pct+typeStats[1].pct}%,#C47A8A ${typeStats[0].pct+typeStats[1].pct}% ${typeStats[0].pct+typeStats[1].pct+typeStats[2].pct}%,#5E8FA8 ${typeStats[0].pct+typeStats[1].pct+typeStats[2].pct}% 100%)`}}/>

          <div style={{padding:'14px 16px 16px',display:'flex',flexDirection:'column',gap:12}}>

            {/* Type tabs — base four always shown (greyed out + toast if unscanned, matching Home); Orange/Dessert/Fortified only appear, on a second row, once scanned */}
            <div style={{position:'relative'}}>
              <div style={{display:'flex',gap:5}}>
                {_TYPES.slice(0,4).map((tp,i)=>(
                  <div key={i} onClick={()=>pickType(i)} style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:10,background:i===typeIdx?tp.col+'18':C.offWhite,border:`1.5px solid ${i===typeIdx?tp.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s',opacity:typeStats[i].wines.length===0?0.4:1}}>
                    <div style={{width:7,height:7,borderRadius:4,background:tp.col,margin:'0 auto 3px'}}/>
                    <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.label}</div>
                    <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                  </div>
                ))}
              </div>
              {visibleIdxs.length>4&&<div style={{display:'flex',gap:5,marginTop:5}}>
                {visibleIdxs.filter(i=>i>=4).map(i=>{
                  const tp=_TYPES[i];
                  return <div key={i} onClick={()=>pickType(i)} style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:10,background:i===typeIdx?tp.col+'18':C.offWhite,border:`1.5px solid ${i===typeIdx?tp.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                    <div style={{width:7,height:7,borderRadius:4,background:tp.col,margin:'0 auto 3px'}}/>
                    <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.label}</div>
                    <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                  </div>;
                })}
              </div>}
              {tabToast&&<div style={{position:'absolute',top:'calc(100% + 8px)',left:0,right:0,textAlign:'center',fontSize:14,fontWeight:700,color:'#fff',fontFamily:C.P,background:C.cr,borderRadius:10,padding:'10px 14px',zIndex:20,boxShadow:'0 6px 18px rgba(139,26,47,0.35)',animation:'dnaToast 1.8s ease forwards'}}>{tabToast}</div>}
            </div>

            {/* Nav arrows */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div onClick={()=>stepType(-1)} style={{width:30,height:30,borderRadius:15,background:visibleIdxs.indexOf(typeIdx)>0?t.col+'15':C.offWhite,border:`1px solid ${visibleIdxs.indexOf(typeIdx)>0?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:visibleIdxs.indexOf(typeIdx)>0?'pointer':'default',opacity:visibleIdxs.indexOf(typeIdx)>0?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="12,4 6,10 12,16" stroke={t.col} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{visibleIdxs.indexOf(typeIdx)+1} of {visibleIdxs.length} · swipe or tap</span>
              <div onClick={()=>stepType(1)} style={{width:30,height:30,borderRadius:15,background:visibleIdxs.indexOf(typeIdx)<visibleIdxs.length-1?t.col+'15':C.offWhite,border:`1px solid ${visibleIdxs.indexOf(typeIdx)<visibleIdxs.length-1?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:visibleIdxs.indexOf(typeIdx)<visibleIdxs.length-1?'pointer':'default',opacity:visibleIdxs.indexOf(typeIdx)<visibleIdxs.length-1?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="8,4 14,10 8,16" stroke={t.col} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            <div style={{height:1,background:C.line}}/>

            {t.wines.length===0?(
              <div style={{textAlign:'center',padding:'8px 0'}}>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6}}>No {t.label.toLowerCase()} scanned yet.</div>
                <Btn primary small onClick={()=>nav('camera')} style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:10}}>Scan a Bottle</Btn>
              </div>
            ):(
              <>
                {/* WineDNA label + type pill + personality */}
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,letterSpacing:'0.09em',textTransform:'uppercase'}}>WineDNA</span>
                      <div style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:20,background:`${t.col}15`,border:`1px solid ${t.col}35`}}>
                        <div style={{width:5,height:5,borderRadius:3,background:t.col}}/>
                        <span style={{fontSize:12,fontWeight:700,color:t.col,fontFamily:C.P}}>{t.label}</span>
                      </div>
                    </div>
                    <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px',lineHeight:1.15}}>{t.personality}</div>
                  </div>
                </div>

                {/* Narrative — 3 labelled sections */}
                {generatingSummary===t.key?(
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                    <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Analysing your palate…</span>
                  </div>
                ):(()=>{
                  const raw=genSummaries[t.key];
                  let sections=null;
                  if(raw){try{sections=JSON.parse(raw.replace(/```json|```/g,'').trim());}catch(e){sections=null;}}
                  if(!sections) return <p style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.68,margin:0}}>{raw||'Generating your WineDNA summary…'}</p>;
                  return(
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {[
                        {label:'Your Preference',    text:sections.preference},
                        {label:'What You Like',      text:sections.like||sections.why},
                        {label:'What You Don\u2019t Like', text:sections.dislike},
                        ...(t.gaps.length>0?[{label:'Try Next', text:`${t.gaps[0].wine}${t.gaps[0].region?' from '+t.gaps[0].region:''} \u2014 ${t.gaps[0].why}`}]:[]),
                      ].filter(s=>s.text).map((s,i)=>(
                        <div key={i}>
                          <div style={{fontSize:12,fontWeight:700,color:t.col,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginBottom:2}}>{s.label}</div>
                          <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.6,textWrap:'pretty'}}>{s.text}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Fact chips */}
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                  {chips.map((ch,i)=>(
                    <div key={i} style={{padding:'5px 11px',borderRadius:20,background:i===0?`${t.col}10`:C.offWhite,border:`1px solid ${i===0?t.col+'30':C.line}`,display:'flex',gap:5,alignItems:'center'}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.label}</span>
                      <span style={{fontSize:13,fontWeight:700,color:i===0?t.col:C.ink2,fontFamily:C.P,whiteSpace:'nowrap'}}>{ch.value}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{marginTop:2}}>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{t.wines.length} {t.label.toLowerCase()} scanned</span>
                </div>
              </>
            )}
          </div>
        </Card>

        {t.wines.length>0&&<CSH label="Taste Breakdown" cKey="taste" collapsed={collapsed} toggle={toggle} summary={`Your ${t.label.toLowerCase()} run ${t.avgB>=.72?'full-bodied':t.avgB>=.38?'medium-bodied':'light-bodied'}${t.key==='red'?` with ${t.avgT>=.72?'grippy':t.avgT>=.38?'medium':'silky'} tannins`:''} and ${t.avgA>=.72?'zingy':t.avgA>=.38?'balanced':'mellow'} acidity${t.key==='white'?`, leaning ${t.avgX>=.55?'rich and creamy':'crisp and steely'}`:''}${t.key==='sparkling'?`, with ${t.avgE>=.55?'fine, persistent':'soft, gentle'} bubbles`:''}. That puts your palate in ${t.personality} territory.`}/>}
        {/* ── Wine DNA attributes + why lines ── */}
        {t.wines.length>0&&!collapsed.taste&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:12}}>Wine DNA · {t.label}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {l:'Body',     v:t.avgB, lo:'Light',    hi:'Full',   col:t.col,     axis:'body'},
                ...(t.key==='sparkling'?[{l:'Effervescence', v:t.avgE, lo:'Soft & Delicate', hi:'Vigorous', col:'#5E8FA8', axis:'effervescence'}]:[]),
                ...(['red','orange','fortified'].includes(t.key)?[{l:'Tannins',  v:t.avgT, lo:'Silky',    hi:'Grippy', col:'#7B5EA7', axis:'tannins'}]:[]),
                {l:'Acidity',  v:t.avgA, lo:'Mellow',   hi:'Zingy',  col:C.green,   axis:'acidity'},
                ...(['white','orange','dessert','fortified'].includes(t.key)?[{l:'Texture', v:t.avgX, lo:'Crisp & Steely', hi:'Rich & Creamy', col:'#B8963E', axis:'texture'}]:[]),
                {l:'Sweetness',v:t.avgS, lo:'Bone Dry', hi:'Sweet',  col:C.amber,   axis:'sweetness'},
              ].map((attr,i)=>{
                const why=t.wines.length>=2?_dnaWhy(attr.axis,attr.v,t.topGrapes,t.topRegions):null;
                return(
                  <div key={i}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{attr.l}</span>
                      <span style={{fontSize:13,fontWeight:600,color:attr.col,fontFamily:C.P}}>{attr.v>=.72?attr.hi:attr.v>=.38?'Medium':attr.lo}</span>
                    </div>
                    <Prog val={attr.v} col={attr.col} h={5}/>
                    {why&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:5,lineHeight:1.55,fontStyle:'italic',textWrap:'pretty'}}>{why}</div>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {t.wines.length>=3&&t.gaps.length>0&&<CSH label="Explore" cKey="explore" collapsed={collapsed} toggle={toggle} summary={`We spotted ${t.gaps.length} new direction${t.gaps.length!==1?'s':''} that share your ${t.label.toLowerCase()} DNA. Top pick: ${t.gaps[0].wine}${t.gaps[0].region?' from '+t.gaps[0].region:''}.`}/>}
        {/* ── Explore Next / Gap Map ── */}
        {t.wines.length>=3&&t.gaps.length>0&&!collapsed.explore&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Explore Next</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:12}}>Styles that share your {t.label.toLowerCase()} DNA but introduce new territory</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.gaps.map((s,i)=>(
                <div key={i}
                  onClick={()=>{sessionStorage.setItem('vinterest_style_explore',JSON.stringify({wine:s.wine,region:s.region,why:s.why,typeKey:t.key}));nav('style-explore');}}
                  style={{padding:'10px 12px',borderRadius:12,background:i===0?`${t.col}08`:C.offWhite,border:`1px solid ${i===0?t.col+'25':C.line}`,cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{s.wine}</div>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>{s.region}</span>
                  </div>
                  <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty',marginBottom:6}}>{s.why}</div>
                  <div style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P}}>Explore wines →</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Flavour Signatures ── */}
        {t.wines.length>=2&&t.noteClusters.length>0&&<CSH label="Flavour Signatures" cKey="flavour" collapsed={collapsed} toggle={toggle} summary={`${t.noteClusters[0].name} is your most common flavour signature across ${t.label.toLowerCase()} bottles.${t.noteClusters[1]?' '+t.noteClusters[1].name+' shows up often too.':''}`}/>}
        {t.wines.length>=2&&t.noteClusters.length>0&&!collapsed.flavour&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:12}}>Flavour Signatures</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.noteClusters.map((cl,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:12,background:C.offWhite,border:`1px solid ${C.line}`}}>
                  <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>{cl.name}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:8}}>
                    {cl.notes.map((n,j)=>(
                      <span key={j} style={{padding:'3px 9px',borderRadius:20,background:j===0?`${t.col}10`:C.white,border:`1px solid ${j===0?t.col+'30':C.line}`,fontSize:13,color:j===0?t.col:C.ink2,fontFamily:C.P}}>{n}</span>
                    ))}
                  </div>
                  {_FOOD_PAIRINGS[cl.name]&&(
                    <div style={{display:'flex',alignItems:'flex-start',gap:6}}>
                      <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0,marginTop:1}}>Pairs with</span>
                      <span style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{_FOOD_PAIRINGS[cl.name]}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {evolution.length>=3&&<CSH label="Your Journey" cKey="journey" collapsed={collapsed} toggle={toggle} summary={`Your most recent ${t.label.toLowerCase()} scans (${evolution[evolution.length-1].label}) average ${evolution[evolution.length-1].avgR}/100, across ${evolution.length} time periods. ${evolution[evolution.length-1].avgR>evolution[0].avgR?'Your palate has been getting sharper over time.':'Your taste has stayed consistent throughout.'}`}/>}
        {/* ── Palate Evolution ── */}
        {evolution.length>=3&&!collapsed.journey&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Palate Evolution</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:14}}>Average rating of your {t.label.toLowerCase()} wines, grouped by when you scanned them</div>
            <div style={{display:'flex',gap:4,alignItems:'flex-end',height:72,marginBottom:6}}>
              {evolution.map((e,i)=>{
                const h=Math.round((e.avgR/100)*100);
                const col=_TYPE_COLORS[e.dom]||C.cr;
                return(
                  <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
                    <span style={{fontSize:13,fontWeight:600,color:col,fontFamily:C.P}}>{e.avgR}</span>
                    <div style={{width:'55%',height:`${h}%`,minHeight:4,background:col,borderRadius:'4px 4px 0 0',opacity:0.72,transition:'height .3s'}}/>
                  </div>
                );
              })}
            </div>
            <div style={{display:'flex',gap:4}}>
              {evolution.map((e,i)=>(
                <div key={i} style={{flex:1,textAlign:'center'}}>
                  <span style={{fontSize:12,color:C.mid,fontFamily:C.P}}>{e.label}</span>
                  <div style={{fontSize:10,color:C.mid,fontFamily:C.P,opacity:0.6}}>{e.count} bottle{e.count!==1?'s':''}</div>
                </div>
              ))}
            </div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:10,lineHeight:1.55}}>
              {evolution[evolution.length-1].avgR>evolution[0].avgR
                ?`Your average rating has climbed from ${evolution[0].avgR} to ${evolution[evolution.length-1].avgR} across these periods — your palate is getting sharper.`
                :`Consistent scores across these periods show a clear, settled sense of what you love.`} Each bar is the average of just the {t.label.toLowerCase()} you rated in that period, so it can run higher or lower than your all-time average.
            </div>
          </Card>
        )}

        {t.wines.length>0&&<CSH label="Scripts" cKey="scripts" collapsed={collapsed} toggle={toggle} summary={genScripts[t.key]?`Your ${t.label.toLowerCase()} sommelier script is ready to use at your next dinner. "${genScripts[t.key].replace(/^"|"$/g,'').slice(0,90)}${genScripts[t.key].replace(/^"|"$/g,'').length>90?'…':''}"`:`We're writing a personalised sommelier script based on your ${t.label.toLowerCase()} history — expand to see it.`}/>}
        {/* ── Sommelier Script ── */}
        {t.wines.length>0&&!collapsed.scripts&&(
          <Card style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <Icon n="message" sz={14} col={t.col}/>
                <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {t.label} Script</span>
              </div>
              {t.wines.length>0&&!generatingScript&&(
                <div style={{display:'flex',gap:4,background:C.offWhite,borderRadius:6,padding:'3px 4px',border:`1px solid ${C.line}`}}>
                  {['short','long'].map(len=>(
                    <div key={len} onClick={()=>{setScriptLength(len);localStorage.setItem('vinterest_script_length',len);setGenScripts(s=>{const n={...s};delete n[t.key];return n;});}} style={{padding:'4px 8px',borderRadius:4,background:scriptLength===len?C.cr:'transparent',cursor:'pointer'}}>
                      <span style={{fontSize:13,fontWeight:600,color:scriptLength===len?'#fff':C.mid,fontFamily:C.P}}>{len.charAt(0).toUpperCase()+len.slice(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {generatingScript===t.key?(
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:14,height:14,borderRadius:7,border:'2px solid rgba(0,0,0,0.08)',borderTopColor:t.col,animation:'dnaSpin .8s linear infinite',flexShrink:0}}/>
                <span style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Writing…</span>
              </div>
            ):(
              <>
                <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.65,marginBottom:genScripts[t.key]?10:0}}>{genScripts[t.key]||'Generating…'}</div>
                {genScripts[t.key]&&(
                  <Btn primary small style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`,marginTop:4}} onClick={()=>{
                    try{navigator.clipboard.writeText((genScripts[t.key]||'').replace(/"/g,''));setCopied(t.key);setTimeout(()=>setCopied(null),2000);}catch(e){}
                  }}>{copied===t.key?'✓ Copied':'Copy Script'}</Btn>
                )}
              </>
            )}
          </Card>
        )}

        <CSH label="Your History" cKey="history" collapsed={collapsed} toggle={toggle} summary={`You've scanned ${t.wines.length} ${t.label.toLowerCase()} bottle${t.wines.length!==1?'s':''} across ${tCountries} countr${tCountries!==1?'ies':'y'}, averaging ${tAvgRating||'—'}/100.${tAvgPrice>0?' You typically spend around '+_csym+Math.round(tAvgPrice*_cfx)+' per bottle.':''}`} />
        {/* ── Stats grid ── */}
        {!collapsed.history&&<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {[
            {icon:'wine',  label:`${t.label} Scanned`, val:t.wines.length,                    col:t.col,     bg:t.col+'15'},
            {icon:'star',  label:'Avg Rating',           val:tAvgRating?`${tAvgRating}/100`:'—', col:C.amber,  bg:C.amberBg},
            {icon:'globe', label:'Countries',            val:tCountries||'—',                   col:C.green,  bg:C.greenBg},
            {icon:'trophy',label:'XP Earned',            val:`${xd.total} XP`,                  col:'#7B5EA7', bg:'#F0EBF8'},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:14,padding:'12px 14px',border:`1px solid ${s.col}20`,display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',gap:7}}>
                <div style={{width:24,height:24,borderRadius:6,background:`${s.col}25`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n={s.icon} sz={13} col={s.col}/>
                </div>
                <div style={{fontSize:20,fontWeight:800,color:s.col,fontFamily:C.P,lineHeight:1}}>{s.val}</div>
              </div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{s.label}</div>
            </div>
          ))}
        </div>}

        {/* ── Average price if available ── */}
        {!collapsed.history&&tAvgPrice>0&&(
          <Card style={{background:C.amberBg,border:`1px solid ${C.amber}25`,padding:12,boxShadow:'none'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:2}}>Avg Price · {t.label}</div>
            <div style={{display:'flex',alignItems:'baseline',gap:6}}>
              <div style={{fontSize:19,fontWeight:800,color:C.amber,fontFamily:C.P}}>{_cbase}{Math.round(tAvgPrice*_cfx)}</div>
              <span style={{fontSize:11,fontWeight:700,color:C.amber+'99',fontFamily:C.P,letterSpacing:'0.04em'}}>{_ccode}</span>
              <span style={{fontSize:15,fontWeight:400,color:C.mid,marginLeft:2}}>per bottle</span>
            </div>
          </Card>
        )}

        {!collapsed.history&&t.topWines.length>0&&(
          <Card style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'12px 14px 8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Top {t.label}</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>See all →</span>
            </div>
            {t.topWines.map((w,i)=>{
              const col=_TYPE_COLORS[_norm(w.type)]||C.cr;
              return(
                <div key={i} onClick={()=>{
                  sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                  nav('detail');
                }} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <div style={{width:24,height:24,borderRadius:12,background:C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:13,fontWeight:800,color:C.cr,fontFamily:C.P}}>#{i+1}</span>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{[w.region,w.vintage?String(w.vintage):null].filter(Boolean).join(' · ')}</div>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:1,flexShrink:0}}>
                    <span style={{fontSize:18,fontWeight:800,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>/100</span>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

        {/* ── Data Backup ── */}
        <Card style={{padding:14}}>
          <div style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:10}}>Data Backup</div>
          <div style={{display:'flex',gap:8}}>
            <Btn full style={{flex:1}} onClick={()=>{
              const data={wines:WineHistory.getAll(),xp:XPSystem.get(),exported:new Date().toISOString()};
              const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
              const url=URL.createObjectURL(blob);
              const a=document.createElement('a');a.href=url;a.download='vinterest-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();
              URL.revokeObjectURL(url);
            }}>⬇ Export</Btn>
            <Btn full style={{flex:1}} onClick={()=>{
              const inp=document.createElement('input');inp.type='file';inp.accept='.json,application/json';
              inp.onchange=e=>{
                const file=e.target.files[0];if(!file)return;
                const reader=new FileReader();
                reader.onload=ev=>{
                  try{
                    const d=JSON.parse(ev.target.result);
                    if(d.wines)WineHistory.save(d.wines);
                    if(d.xp)localStorage.setItem(XPSystem.KEY,JSON.stringify(d.xp));
                    alert('Restored! '+((d.wines||[]).length)+' wines imported.');
                    window.location.reload();
                  }catch(err){alert('Could not read backup file.');}
                };
                reader.readAsText(file);
              };
              inp.click();
            }}>⬆ Import</Btn>
          </div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8,lineHeight:1.5}}>Export saves your wines &amp; XP as a JSON file. Import restores from a previous backup.</div>
        </Card>

        {/* App version */}
        <div style={{textAlign:'center',padding:'12px 0 4px',opacity:0.45}}>
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v1.0.91</span>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes dnaSpin{to{transform:rotate(360deg)}}\n@keyframes dnaToast{0%{opacity:0;transform:translateY(-6px)}12%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}`}</style>
    </div>
  );
}

Object.assign(window,{WineDNAScreen,WineIQScreen:WineDNAScreen});
