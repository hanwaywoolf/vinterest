/* Vinterest PWA — WineDNA Screen */

/* ── helpers ── */
function _norm(s){return(s||'').toLowerCase().replace('é','e');}
function _avg(wines,field,fb){const ws=wines.filter(w=>w[field]!=null);return ws.length?ws.reduce((s,w)=>s+w[field],0)/ws.length:fb;}
function _topByCount(arr){const c={};arr.forEach(v=>{if(v)c[v]=(c[v]||0)+1});return Object.entries(c).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);}
function _topGrapes(wines,n){const all=[];wines.forEach(w=>(w.grapes||[]).forEach(g=>{if(g)all.push(g)}));return _topByCount(all).slice(0,n);}
function _topRegions(wines,n){return _topByCount(wines.map(w=>w.region).filter(Boolean)).slice(0,n);}
function _topNotes(wines,n){const all=[];wines.forEach(w=>(w.tasting_notes||[]).forEach(t=>{if(t)all.push(t)}));return _topByCount(all).slice(0,n);}

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
  };
  return T[axis]?.[hi?'hi':lo?'lo':'md']||'';
}

/* ── Gap map ── */
function _gaps(typeKey,avgB,avgT,avgA,topGrapes,topRegions){
  const rgs=new Set(topRegions.map(r=>(r||'').toLowerCase()));
  const gps=new Set(topGrapes.map(g=>(g||'').toLowerCase()));
  const pool={
    red:[
      {wine:'Ribera del Duero Reserva',region:'Spain',why:'Shares Barolo\'s grip and earthy depth with brighter red fruit and a more sun-baked savannah note.',cond:avgT>=0.60&&!rgs.has('ribera del duero')},
      {wine:'Côte-Rôtie (Syrah)',region:'Northern Rhône, France',why:'If you love structured reds, Côte-Rôtie Syrah adds violet and smoked-meat complexity entirely absent from your collection.',cond:avgB>=0.65&&!gps.has('syrah')},
      {wine:'Baga from Bairrada',region:'Portugal',why:'High tannins and acidity like Nebbiolo, but with a wild Atlantic character completely new to your cellar.',cond:avgT>=0.65&&!rgs.has('portugal')},
      {wine:'Etna Rosso (Nerello Mascalese)',region:'Sicily',why:'Volcanic reds with Burgundy elegance — earthy, high-acid, with a mineral lift none of your current picks have.',cond:avgA>=0.60&&!rgs.has('sicily')},
    ],
    white:[
      {wine:'Grüner Veltliner Smaragd',region:'Wachau, Austria',why:'Same piercing acidity as your Chablis, with a white pepper and herb dimension you haven\'t tried yet.',cond:avgA>=0.65&&!rgs.has('austria')},
      {wine:'Assyrtiko from Santorini',region:'Greece',why:'Bone-dry, volcanic, searingly precise — takes your mineral instinct beyond what Burgundy offers.',cond:avgA>=0.62&&!rgs.has('greece')},
      {wine:'Aged White Rioja',region:'Spain',why:'If you\'ve never tried oxidatively-aged white wine, White Rioja is a revelation — nutty, complex, textural.',cond:!rgs.has('rioja')},
    ],
    rose:[
      {wine:'Bandol Rosé (Mourvèdre)',region:'Provence, France',why:'Pushes your bone-dry Provençal instinct into richer, more saline, garrigue-scented territory.',cond:!gps.has('mourvèdre')},
      {wine:'Tavel Rosé',region:'Rhône Valley, France',why:'The boldest dry rosé in France — challenges your light Provençal palette with real structure and food-worthiness.',cond:avgB<0.55},
    ],
    sparkling:[
      {wine:'Blanc de Noirs (Meunier grower)',region:'Vallée de la Marne',why:'A grower Meunier Champagne takes your bready instinct toward wilder, earthier complexity.',cond:avgB>=0.55},
      {wine:'Aged Vintage Champagne',region:'Champagne',why:'Ten-plus years on lees pushes your toasty preference to its extreme — deep oxidative notes and extraordinary length.',cond:true},
      {wine:'Pét-Nat from Loire',region:'France',why:'The structural opposite of your picks — wild, cloudy, funky. A useful contrast to define what you love about your favourites.',cond:avgA>=0.65},
    ],
  };
  return (pool[typeKey]||[]).filter(s=>s.cond).slice(0,2);
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
  const sz=Math.max(2,Math.ceil(sorted.length/4));
  const chunks=[];
  for(let i=0;i<sorted.length;i+=sz){
    const ch=sorted.slice(i,i+sz);
    const avgR=Math.round(ch.reduce((s,w)=>s+w.rating,0)/ch.length);
    const date=new Date(ch[0].scanned_at||ch[0].last_scanned);
    const label=date.toLocaleDateString('en',{month:'short',year:'2-digit'});
    const tc={red:0,white:0,rose:0,sparkling:0};
    ch.forEach(w=>{const t=_norm(w.type);if(tc[t]!==undefined)tc[t]++;else tc.red++;});
    const dom=Object.entries(tc).sort((a,b)=>b[1]-a[1])[0][0];
    chunks.push({label,avgR,dom,count:ch.length});
  }
  return chunks;
}

const _TYPE_COLORS={red:'#8B1A2F',white:'#B8963E',rose:'#C47A8A',sparkling:'#5E8FA8'};
const _TYPES=[
  {key:'red',       label:'Reds',     col:'#8B1A2F'},
  {key:'white',     label:'Whites',   col:'#B8963E'},
  {key:'rose',      label:'Rosé',     col:'#C47A8A'},
  {key:'sparkling', label:'Sparkling',col:'#5E8FA8'},
];

/* ──────────────────────────────────────────────────
   WineDNA Screen
────────────────────────────────────────────────── */
function WineDNAScreen({nav,back,showPro}){
  const [typeIdx,setTypeIdx]=React.useState(0);
  const [genSummaries,setGenSummaries]=React.useState({});
  const [generatingSummary,setGeneratingSummary]=React.useState(null);
  const [genScripts,setGenScripts]=React.useState({});
  const [generatingScript,setGeneratingScript]=React.useState(null);
  const [copied,setCopied]=React.useState(null);
  const touchX=React.useRef(null);
  const touchY=React.useRef(null);

  const allWines=WineHistory.getAll();
  const xd=XPSystem.get();
  const lv=XPSystem.getLevel(xd.total);
  const nx=XPSystem.nextLevel(xd.total);
  const pg=XPSystem.levelProgress(xd.total);

  /* Per-type stats */
  const typeStats=React.useMemo(()=>_TYPES.map(tp=>{
    const wines=allWines.filter(w=>_norm(w.type)===tp.key);
    const pct=allWines.length?Math.round(wines.length/allWines.length*100):0;
    const avgB=_avg(wines,'body',0.65);
    const avgT=_avg(wines,'tannins',0.55);
    const avgA=_avg(wines,'acidity',0.60);
    const avgS=_avg(wines,'sweetness',0.10);
    const topGrapes=_topGrapes(wines,4);
    const topRegions=_topRegions(wines,4);
    const topNotes=_topNotes(wines,14);
    const noteClusters=_clusterNotes(topNotes);
    const personality=_personality(tp.key,avgB,avgT,avgA,avgS);
    const gaps=_gaps(tp.key,avgB,avgT,avgA,topGrapes,topRegions);
    const topWines=[...wines].filter(w=>w.rating>0).sort((a,b)=>(b.rating||0)-(a.rating||0)).slice(0,3);
    return{...tp,wines,pct,avgB,avgT,avgA,avgS,topGrapes,topRegions,topNotes,noteClusters,personality,gaps,topWines};
  }),[allWines.length]);

  const t=typeStats[typeIdx];

  /* LLM summary */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_dna_v3_${t.key}_n${t.wines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenSummaries(s=>({...s,[t.key]:cached}));return;}
    if(genSummaries[t.key]||generatingSummary===t.key) return;
    setGeneratingSummary(t.key);
    const wineList=t.wines.slice(0,10).map(w=>`${w.name}${w.vintage?' '+w.vintage:''}${w.region?' from '+w.region:''}${w.rating?' rated '+w.rating+'/100':''}`).join('; ');
    const prompt=`My ${t.label.toLowerCase()} wine personality is "${t.personality}". I've rated: ${wineList}. Return ONLY raw JSON — no markdown, no code fences, no extra text, just the JSON object: {"preference":"one sentence on what I gravitate toward — max 18 words","why":"one sentence on why using specific grape or region names from my list — max 18 words","next":"one specific wine or region to explore next and a brief reason — max 18 words"}`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenSummaries(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingSummary(null));
  },[typeIdx,allWines.length]);

  /* LLM sommelier script */
  React.useEffect(()=>{
    if(!t.wines.length) return;
    const key=`vinterest_script_v2_${t.key}_n${t.wines.length}`;
    const cached=localStorage.getItem(key);
    if(cached){setGenScripts(s=>({...s,[t.key]:cached}));return;}
    if(genScripts[t.key]||generatingScript===t.key) return;
    setGeneratingScript(t.key);
    const wineList=t.wines.slice(0,8).map(w=>`${w.name}${w.vintage?' '+w.vintage:''} from ${w.region||w.country||'unknown'}${w.rating?' (rated '+w.rating+'/100)':''}`).join('; ');
    const prompt=`I've scanned and rated these ${t.label.toLowerCase()} wines: ${wineList}. Based only on this data, write a short natural first-person sommelier script (2 sentences max) I could say to a restaurant sommelier. Reflect my apparent style, preferred regions, and price range. Return ONLY the script text in double quotes — nothing else.`;
    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{const s=text.trim();localStorage.setItem(key,s);setGenScripts(g=>({...g,[t.key]:s}));})
      .catch(()=>{})
      .finally(()=>setGeneratingScript(null));
  },[typeIdx,allWines.length]);

  /* Swipe */
  function onTouchStart(e){touchX.current=e.touches[0].clientX;touchY.current=e.touches[0].clientY;}
  function onTouchEnd(e){
    if(touchX.current===null)return;
    const dx=e.changedTouches[0].clientX-touchX.current;
    const dy=e.changedTouches[0].clientY-(touchY.current||0);
    if(Math.abs(dx)>Math.abs(dy)&&Math.abs(dx)>40){
      if(dx<0)setTypeIdx(i=>Math.min(i+1,_TYPES.length-1));
      else setTypeIdx(i=>Math.max(i-1,0));
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
        <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>WineDNA</div>
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>Your personal taste intelligence</div>
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
  const evolution=_evolution(allWines);

  /* Synthesis chips */
  const chips=[];
  if(t.topGrapes[0]) chips.push({label:'Top grape',value:t.topGrapes[0]});
  if(t.topRegions[0]) chips.push({label:'Lead region',value:t.topRegions[0]});
  chips.push({label:'Body',value:t.avgB>=0.72?'Full':t.avgB>=0.42?'Medium':'Light'});

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.bg}}>

      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {/* Title row: WineDNA ←→ personality badge, baseline aligned */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
          <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.3px'}}>WineDNA</div>
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

            {/* Type tabs */}
            <div style={{display:'flex',gap:5}}>
              {_TYPES.map((tp,i)=>(
                <div key={i} onClick={()=>setTypeIdx(i)} style={{flex:1,textAlign:'center',padding:'7px 4px',borderRadius:10,background:i===typeIdx?tp.col+'18':C.offWhite,border:`1.5px solid ${i===typeIdx?tp.col+'55':'transparent'}`,cursor:'pointer',transition:'all .15s'}}>
                  <div style={{width:7,height:7,borderRadius:4,background:tp.col,margin:'0 auto 3px'}}/>
                  <div style={{fontSize:13,fontWeight:i===typeIdx?700:500,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P}}>{tp.label}</div>
                  <div style={{fontSize:12,color:i===typeIdx?tp.col:C.mid,fontFamily:C.P,opacity:0.75}}>{typeStats[i].pct}%</div>
                </div>
              ))}
            </div>

            {/* Nav arrows */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div onClick={()=>setTypeIdx(i=>Math.max(i-1,0))} style={{width:30,height:30,borderRadius:15,background:typeIdx>0?t.col+'15':C.offWhite,border:`1px solid ${typeIdx>0?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:typeIdx>0?'pointer':'default',opacity:typeIdx>0?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="12,4 6,10 12,16" stroke={typeIdx>0?t.col:C.mid} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{typeIdx+1} of {_TYPES.length} · swipe or tap</span>
              <div onClick={()=>setTypeIdx(i=>Math.min(i+1,_TYPES.length-1))} style={{width:30,height:30,borderRadius:15,background:typeIdx<_TYPES.length-1?t.col+'15':C.offWhite,border:`1px solid ${typeIdx<_TYPES.length-1?t.col+'35':C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:typeIdx<_TYPES.length-1?'pointer':'default',opacity:typeIdx<_TYPES.length-1?1:0.35,transition:'all .15s'}}>
                <svg viewBox="0 0 20 20" width={14} height={14}><polyline points="8,4 14,10 8,16" stroke={typeIdx<_TYPES.length-1?t.col:C.mid} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                        {label:'Your Preference',text:sections.preference},
                        {label:'Why You Like It', text:sections.why},
                        {label:'Try Next',         text:sections.next},
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
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                  <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{t.wines.length} {t.label.toLowerCase()} scanned</span>
                  <span style={{fontSize:13,fontWeight:600,color:t.col,fontFamily:C.P,cursor:'pointer'}} onClick={()=>{
                    const key=`vinterest_dna_v3_${t.key}_n${t.wines.length}`;
                    localStorage.removeItem(key);
                    setGenSummaries(s=>{const n={...s};delete n[t.key];return n;});
                  }}>↺ Regenerate</span>
                </div>
              </>
            )}
          </div>
        </Card>

        {t.wines.length>0&&<SH label="Taste Breakdown"/>}
        {/* ── Wine DNA attributes + why lines ── */}
        {t.wines.length>0&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:12}}>Wine DNA · {t.label}</div>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {[
                {l:'Body',     v:t.avgB, lo:'Light',    hi:'Full',   col:t.col,     axis:'body'},
                {l:'Tannins',  v:t.avgT, lo:'Silky',    hi:'Grippy', col:'#7B5EA7', axis:'tannins'},
                {l:'Acidity',  v:t.avgA, lo:'Mellow',   hi:'Zingy',  col:C.green,   axis:'acidity'},
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

        {t.wines.length>=3&&t.gaps.length>0&&<SH label="Explore"/>}
        {/* ── Explore Next / Gap Map ── */}
        {t.wines.length>=3&&t.gaps.length>0&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Explore Next</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:12}}>Styles that share your {t.label.toLowerCase()} DNA but introduce new territory</div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {t.gaps.map((s,i)=>(
                <div key={i} style={{padding:'10px 12px',borderRadius:12,background:i===0?`${t.col}08`:C.offWhite,border:`1px solid ${i===0?t.col+'25':C.line}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>{s.wine}</div>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P,flexShrink:0}}>{s.region}</span>
                  </div>
                  <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.55,textWrap:'pretty'}}>{s.why}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Flavour Signatures ── */}
        {t.wines.length>=2&&t.noteClusters.length>0&&(
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

        {evolution.length>=3&&<SH label="Your Journey"/>}
        {/* ── Palate Evolution ── */}
        {evolution.length>=3&&(
          <Card style={{padding:14}}>
            <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:4}}>Palate Evolution</div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:14}}>How your ratings have shifted over time</div>
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
                </div>
              ))}
            </div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:10,lineHeight:1.55}}>
              {evolution[evolution.length-1].avgR>evolution[0].avgR
                ?`Your average rating has climbed from ${evolution[0].avgR} to ${evolution[evolution.length-1].avgR} — your palate is getting sharper.`
                :`Consistent scores across your collection show a clear, settled sense of what you love.`}
            </div>
          </Card>
        )}

        {t.wines.length>0&&<SH label="At the Restaurant"/>}
        {/* ── Sommelier Script ── */}
        {t.wines.length>0&&(
          <Card style={{padding:14}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <Icon n="message" sz={14} col={t.col}/>
              <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {t.label} Script</span>
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
                  <div style={{display:'flex',gap:8}}>
                    <Btn primary small style={{background:t.col,boxShadow:`0 3px 12px ${t.col}40`}} onClick={()=>{
                      try{navigator.clipboard.writeText((genScripts[t.key]||'').replace(/"/g,''));setCopied(t.key);setTimeout(()=>setCopied(null),2000);}catch(e){}
                    }}>{copied===t.key?'Copied!':'Copy Script'}</Btn>
                    <Btn small onClick={()=>{
                      const key=`vinterest_script_v2_${t.key}_n${t.wines.length}`;
                      localStorage.removeItem(key);
                      setGenScripts(s=>{const n={...s};delete n[t.key];return n;});
                    }}>Regenerate</Btn>
                  </div>
                )}
              </>
            )}
          </Card>
        )}

        <SH label="Your Collection"/>
        {/* ── Stats grid ── */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
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
        </div>

        {/* ── Average price if available ── */}
        {tAvgPrice>0&&(
          <Card style={{background:C.amberBg,border:`1px solid ${C.amber}25`,padding:12,boxShadow:'none'}}>
            <div style={{fontSize:15,fontWeight:600,color:C.amber,fontFamily:C.P,marginBottom:2}}>Avg Price · {t.label}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.amber,fontFamily:C.P}}>${Math.round(tAvgPrice)}<span style={{fontSize:15,fontWeight:400,color:C.mid,marginLeft:4}}>per bottle</span></div>
          </Card>
        )}

        {t.topWines.length>0&&(
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
          <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Vinterest v1.0.39</span>
        </div>

        <div style={{height:8}}/>
      </div>
      </div>
      <style>{`@keyframes dnaSpin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

Object.assign(window,{WineDNAScreen,WineIQScreen:WineDNAScreen});
