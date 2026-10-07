/* Vinterest — XP Engine. Data-driven from data/xp-curve.json (source of truth for native port). */

/* Static data (data/*.json, prompts/*.txt) is inlined into the bundle by scripts/build.mjs as
   __VINTEREST_ASSETS__ (path → file text), so these stay synchronous with no network request. The
   build fails if a call passes a path it can't resolve at build time. */
function _loadTextSync(path){
  if(!Object.prototype.hasOwnProperty.call(__VINTEREST_ASSETS__,path)) throw new Error('[Vinterest] '+path+' was not inlined at build time');
  return __VINTEREST_ASSETS__[path];
}
function _loadJSON(path){ return JSON.parse(_loadTextSync(path)); }
const XP_CURVE = _loadJSON('data/xp-curve.json');
const XP_LEVELS = XP_CURVE.levels; // finite tiers only — Cellar Master is computed, not listed

function _romanize(n){
  const vals=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
  let r='',v=n; for(const [num,sym] of vals){ while(v>=num){ r+=sym; v-=num; } } return r;
}
function _cellarMaster(n){
  const {base,ratio,badge,color}=XP_CURVE.cellarMaster;
  return {name:'Cellar Master '+_romanize(n), min:Math.round(base*Math.pow(ratio,n-1)), badge, color, roman:n};
}

// Emoji→Icon map: xp-curve.json still stores legacy emoji as a data value; this is the single
// place that translates them to the line-icon set so no component hardcodes its own table.
const LEVEL_ICON_MAP={'🍇':'wine','🥂':'glass','🌍':'globe','🔍':'compass','🏅':'star','🍾':'grape','🎓':'book','⭐':'flame','🏆':'trophy'};

const XPSystem = {
  /* Finishing a whole question set (every question answered right at least once): the top of the quiz_complete range, once per set. */
  QUIZ_SET_BONUS(){ return XP_CURVE.awards.quiz_complete.max; },
  KEY:'vinterest_xp_v3',
  LEGACY_KEY:'vinterest_xp_v2',
  ACCOUNT_ID:'local', // single implicit local account for the POC; native port swaps the key, not the shape

  get(){
    let all;
    try{ all=JSON.parse(Store.get(this.KEY)||'null'); }catch(e){}
    if(all&&all.accounts&&all.accounts[this.ACCOUNT_ID]) return all.accounts[this.ACCOUNT_ID];
    return this._migrate();
  },
  _migrate(){
    let legacy=null;
    try{ legacy=JSON.parse(Store.get(this.LEGACY_KEY)||'null'); }catch(e){}
    const d=legacy||this.fresh();
    this.save(d);
    return d;
  },
  fresh(){
    return {total:0,events:[],scansThisWeek:[],totalRatings:0,grapesSeen:[],quizCompleted:{},quizStreaks:{}};
  },
  save(d){
    let all;
    try{ all=JSON.parse(Store.get(this.KEY)||'null'); }catch(e){}
    if(!all||!all.accounts) all={version:1,accounts:{}};
    all.accounts[this.ACCOUNT_ID]=d;
    Store.set(this.KEY, JSON.stringify(all));
  },
  /* Start over (the XP screen's reset). */
  reset(){ Store.remove(this.KEY); },
  /* XP from two places (a backup and this phone), never lower than either: totals take the
     larger, lists keep every entry, per-quiz records take the larger (spec D3). */
  mergedXP(a,b){
    a=a||this.fresh(); b=b||this.fresh();
    const union=(x,y)=>[...new Set([...(x||[]),...(y||[])])];
    const maxMap=(x,y)=>{ const o={...(x||{})}; Object.entries(y||{}).forEach(([k,v])=>{ o[k]=typeof v==='number'&&typeof o[k]==='number'?Math.max(o[k],v):(o[k]??v); }); return o; };
    return {...b,...a,total:Math.max(a.total||0,b.total||0),totalRatings:Math.max(a.totalRatings||0,b.totalRatings||0),
      events:union(a.events,b.events),grapesSeen:union(a.grapesSeen,b.grapesSeen),scansThisWeek:union(a.scansThisWeek,b.scansThisWeek),
      quizCompleted:maxMap(a.quizCompleted,b.quizCompleted),quizStreaks:maxMap(a.quizStreaks,b.quizStreaks)};
  },
  /* Restoring a backup's XP (the bare account object): merged into this phone's. */
  mergeImport(flat){ this.save(this.mergedXP(this.get(),flat)); },

  getLevel(xp){
    if(xp>=XP_CURVE.cellarMaster.base){
      const {base,ratio}=XP_CURVE.cellarMaster;
      const n=Math.max(1, Math.floor(Math.log(xp/base)/Math.log(ratio))+1);
      // guard against float rounding landing one tier short/long
      let lvl=_cellarMaster(n);
      while(xp<lvl.min){ lvl=_cellarMaster(--lvl.roman); }
      while(xp>=_cellarMaster(lvl.roman+1).min){ lvl=_cellarMaster(lvl.roman+1); }
      return {...lvl, index:XP_LEVELS.length+lvl.roman-1};
    }
    for(let i=XP_LEVELS.length-1;i>=0;i--){
      if(xp>=XP_LEVELS[i].min) return {...XP_LEVELS[i], index:i};
    }
    return {...XP_LEVELS[0], index:0};
  },
  iconFor(level){ return LEVEL_ICON_MAP[level.badge]||'wine'; },
  // Finite ladder plus enough Cellar Master ranks to always show a couple ahead of wherever xp is.
  tierList(xp){
    const list=XP_LEVELS.map((l,i)=>({...l,index:i}));
    const curN=xp>=XP_CURVE.cellarMaster.base?this.getLevel(xp).roman:0;
    for(let n=1;n<=Math.max(3,curN+2);n++) list.push(_cellarMaster(n));
    return list;
  },
  nextLevel(xp){
    const cur=this.getLevel(xp);
    if(cur.roman) return _cellarMaster(cur.roman+1);
    if(cur.index+1<XP_LEVELS.length) return XP_LEVELS[cur.index+1];
    return _cellarMaster(1); // Head Sommelier -> Cellar Master I
  },
  levelProgress(xp){
    const cur=this.getLevel(xp);
    const nxt=this.nextLevel(xp);
    if(!nxt) return 1;
    return (xp-cur.min)/(nxt.min-cur.min);
  },

  award(reasons){
    const d=this.get();
    const A=XP_CURVE.awards;
    const awards=[];
    const prevLevel=this.getLevel(d.total).name;

    reasons.forEach(r=>{
      switch(r.type){
        case 'scan':
          d.total+=A.scan;
          awards.push({label:'Wine scanned',amount:A.scan});
          {const now=Date.now(), wAgo=now-7*24*60*60*1000;
          d.scansThisWeek=[(d.scansThisWeek||[]).filter(t=>t>wAgo),now].flat();
          const wk='week5_'+Math.floor(now/(7*24*60*60*1000));
          if(d.scansThisWeek.length>=5 && !d.events.includes(wk)){
            d.events.push(wk); d.total+=A.weekly_scan_bonus;
            awards.push({label:'5 scans this week!',amount:A.weekly_scan_bonus,bonus:true});
          }}
          break;

        case 'rate':
          d.total+=A.rate;
          d.totalRatings=(d.totalRatings||0)+1;
          awards.push({label:'Wine rated',amount:A.rate});
          if(d.totalRatings===10 && !d.events.includes('ratings_10')){
            d.events.push('ratings_10'); d.total+=A.ratings_10_bonus;
            awards.push({label:'10 wines rated!',amount:A.ratings_10_bonus,bonus:true});
          }
          break;

        case 'quiz_correct':
          d.total+=A.quiz_correct;
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=(d.quizStreaks[sk]||0)+1;
          awards.push({label:'Correct!',amount:A.quiz_correct});
          if(d.quizStreaks[sk]===3){
            d.total+=A.quiz_streak_bonus;
            awards.push({label:'3-answer streak!',amount:A.quiz_streak_bonus,bonus:true});
          }}
          break;

        case 'quiz_wrong':
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=0;}
          break;

        // A question-set quiz (Wine Basics, region, grape, guide): XP for each question answered
        // right for the first time (QuizMastery.recordAnswer says when), so a replay of questions
        // they already know earns nothing, but every new one does, whatever round it's in.
        case 'question_learned':
          d.total+=A.quiz_correct;
          awards.push({label:'New answer learned',amount:A.quiz_correct});
          break;

        // A fading answer (QuizMastery: past its review date) answered right again: a little XP,
        // only then, so replaying fresh answers still earns nothing.
        case 'question_refreshed':
          d.total+=A.question_refreshed||5;
          awards.push({label:'Answer refreshed',amount:A.question_refreshed||5});
          break;

        case 'quiz_complete':
          {const k=(r.quizKey||((r.topic||'')+'_'+(r.difficulty||'')));
          if(!d.quizCompleted) d.quizCompleted={};
          if(!d.quizCompleted[k]){
            const bonus=r.amount!=null?r.amount:Math.round(A.quiz_complete.min+(r.derivedDifficulty||0)*(A.quiz_complete.max-A.quiz_complete.min));
            d.quizCompleted[k]=bonus; d.total+=bonus;
            awards.push({label:'Quiz complete!',amount:bonus,bonus:true});
          }}
          break;

        case 'concept_mastered':
          if(r.conceptId && !d.events.includes('mastered_'+r.conceptId)){
            d.events.push('mastered_'+r.conceptId); d.total+=A.concept_mastered;
            awards.push({label:'Concept mastered',amount:A.concept_mastered,bonus:true});
          }
          break;

        case 'first_type':
          if(r.value && !d.events.includes('type_'+r.value)){
            d.events.push('type_'+r.value); d.total+=A.first_type;
            awards.push({label:'First '+r.value+' wine!',amount:A.first_type,bonus:true,wineType:r.value});
          }
          break;

        case 'first_country':
          if(r.value){
            const ck='country_'+(r.value).toLowerCase().replace(/\s/g,'_');
            if(!d.events.includes(ck)){
              d.events.push(ck); d.total+=A.first_country;
              awards.push({label:'First from '+r.value+'!',amount:A.first_country,bonus:true,country:r.value});
            }
          }
          break;

        case 'new_grape':
          if(r.value){
            // One grape, one award: Shiraz after Syrah isn't new.
            const g=WineDNA.grape(r.value).toLowerCase();
            if(!(d.grapesSeen||[]).some(x=>WineDNA.grape(x).toLowerCase()===g)){
              d.grapesSeen=(d.grapesSeen||[]);
              d.grapesSeen.push(g); d.total+=A.new_grape;
              awards.push({label:'New grape: '+r.value,amount:A.new_grape,bonus:true,grape:r.value});
            }
          }
          break;

        case 'rarity':
          if(r.wineKey && !d.events.includes('rarity_'+r.wineKey)){
            d.events.push('rarity_'+r.wineKey); d.total+=A.rarity;
            awards.push({label:'Rare bottle',amount:A.rarity,bonus:true});
          }
          break;

        case 'article':
          if(r.articleKey && !d.events.includes('article_'+r.articleKey)){
            d.events.push('article_'+r.articleKey); d.total+=A.article;
            awards.push({label:'Article completed',amount:A.article,bonus:true});
          }
          break;

        case 'blind_call':
          {const acc=Math.max(0,Math.min(1,r.accuracy||0));
          const amount=Math.round(A.blind_call.min + acc*(A.blind_call.max-A.blind_call.min));
          d.total+=amount;
          awards.push({label:'Blind Call scored',amount,bonus:true});}
          break;

        case 'track_complete':
          if(r.trackId && !d.events.includes('track_'+r.trackId)){
            d.events.push('track_'+r.trackId); d.total+=A.track_complete;
            awards.push({label:'Track completed',amount:A.track_complete,bonus:true});
          }
          break;
      }
    });

    this.save(d);
    const newLevel=this.getLevel(d.total).name;
    if(newLevel!==prevLevel){
      awards.push({label:'Level up: '+newLevel+'!',amount:0,levelUp:true,level:newLevel});
    }
    return awards;
  },

  /* Tells the app what was earned (XPDelivery in pwa-moments.jsx). opts.quiet: the screen shows
     all of it itself (the quiz result); opts.xpShown: the screen shows the XP (Blind Call's
     result) but moments like a level-up still come through. */
  toast(awards,opts){
    if(!awards||!awards.length) return;
    window.dispatchEvent(new CustomEvent('vinterest:xp',{detail:{awards,...(opts||{})}}));
  },

  /* How awards reach the user: plain XP adds up into one quiet "+N XP" chip (with the biggest
     bonus's label), and what changes something for them becomes a moment card with a next step:
     a new level, a new grape (its quiz), a first country (the wine map), a first wine type (its
     basics). Moments wait for a calm screen (Home, Learn…), never over a scan or a quiz. */
  present(awards){
    let xp=0, label=null, best=0; const moments=[];
    const an=w=>/^[aeiou]/i.test(w)?'an':'a';
    (awards||[]).forEach(a=>{
      // How much detail the app shows (DetailLevel, pwa-detail.js): a rise, or the one-time
      // explanation for someone who used the app before levels existed.
      if(a.detailLevel){
        moments.push({id:'detail:'+a.detailLevel,icon:'brain',kicker:'More to see',title:'Your WineDNA shows more now',
          body:(typeof DetailLevel!=='undefined'&&DetailLevel.ADDS[a.detailLevel])||'',action:{label:'See your WineDNA',screen:'profile'}});
        return;
      }
      if(a.detailIntro){
        moments.push({id:'detail-intro',icon:'brain',kicker:'Made for you',title:a.detailIntro==='everything'?'Vinterest shows you everything':'Vinterest keeps it simple for now',
          body:a.detailIntro==='everything'?'You told us you know wine well, so every screen shows its full detail.'
            :'WineDNA and your scans show the essentials first, and more as you learn. Want it all now? Turn on "Show all details" on Profile.',
          action:a.detailIntro==='everything'?null:{label:'Open Profile',screen:'account'}});
        return;
      }
      if(a.levelUp){
        const total=this.get().total, nxt=this.nextLevel(total);
        moments.push({id:'level:'+a.level,icon:'trophy',kicker:'New level',title:`You're now ${an(a.level)} ${a.level}`,
          body:nxt?`${nxt.min-total} XP to ${nxt.name}. Scanning, scoring, reading and quizzes all count.`:'',action:{label:'See your level',level:true}});
        return;
      }
      xp+=a.amount||0;
      if(a.bonus&&(a.amount||0)>=best){ best=a.amount||0; label=a.label.replace(/!$/,''); }
      if(a.grape){
        const key=typeof GrapeUnlocks!=='undefined'?GrapeUnlocks.key(a.grape):null, open=key&&GrapeUnlocks.isUnlocked(key);
        moments.push({id:'grape:'+(key||a.grape),icon:'grape',kicker:'New grape',title:a.grape,
          body:!key?'One more grape in your WineDNA.':open?`Its quiz is open on Learn: ten questions on where it grows and what it tastes like.`:'Its quiz is part of Pro.',
          action:!key?null:open?{label:`Take the ${key} quiz`,learn:{kind:'grape',grape:key}}:{label:'See Pro',pro:'grape-library'}});
      }
      if(a.country) moments.push({id:'country:'+a.country,icon:'globe',kicker:'New country',title:`Your first wine from ${a.country}`,
        body:'Its regions are on your wine map in Mastery.',action:{label:'See your wine map',screen:'mastery-map'}});
      if(a.wineType){
        const T=typeof KnowledgeMap!=='undefined'&&KnowledgeMap.TYPES.find(t=>t.types.includes(WineDNA._t(a.wineType)));
        moments.push({id:'type:'+a.wineType,icon:'wine',kicker:'New wine type',title:`Your first ${String(a.wineType).toLowerCase()} wine`,
          body:`Score ${TasteMatch.MIN_SCORED} and your match for them starts.`,
          action:T?{label:`Take the ${T.label} basics quiz`,learn:{kind:'mastery',next:{quiz:{mode:'practice',topicId:T.topic}}}}:null});
      }
    });
    return {xp,label,moments};
  },

  awardAndToast(reasons,opts){
    const a=this.award(reasons);
    this.toast(a,opts);
    return a;
  }
};
