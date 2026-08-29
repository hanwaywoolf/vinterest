/* Vinterest — XP Engine. Data-driven from data/xp-curve.json (source of truth for native port). */

function _loadJSON(path){ const x=new XMLHttpRequest(); x.open('GET',path,false); x.send(); return JSON.parse(x.responseText); }
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

const XPSystem = {
  KEY:'vinterest_xp_v3',
  LEGACY_KEY:'vinterest_xp_v2',
  ACCOUNT_ID:'local', // single implicit local account for the POC; native port swaps the key, not the shape

  get(){
    let all;
    try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){}
    if(all&&all.accounts&&all.accounts[this.ACCOUNT_ID]) return all.accounts[this.ACCOUNT_ID];
    return this._migrate();
  },
  _migrate(){
    let legacy=null;
    try{ legacy=JSON.parse(localStorage.getItem(this.LEGACY_KEY)||'null'); }catch(e){}
    const d=legacy||this.fresh();
    this.save(d);
    return d;
  },
  fresh(){
    return {total:0,events:[],scansThisWeek:[],totalRatings:0,grapesSeen:[],quizCompleted:{},quizStreaks:{}};
  },
  save(d){
    let all;
    try{ all=JSON.parse(localStorage.getItem(this.KEY)||'null'); }catch(e){}
    if(!all||!all.accounts) all={version:1,accounts:{}};
    all.accounts[this.ACCOUNT_ID]=d;
    localStorage.setItem(this.KEY, JSON.stringify(all));
  },

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
            awards.push({label:'First '+r.value+' wine!',amount:A.first_type,bonus:true});
          }
          break;

        case 'first_country':
          if(r.value){
            const ck='country_'+(r.value).toLowerCase().replace(/\s/g,'_');
            if(!d.events.includes(ck)){
              d.events.push(ck); d.total+=A.first_country;
              awards.push({label:'First from '+r.value+'!',amount:A.first_country,bonus:true});
            }
          }
          break;

        case 'new_grape':
          if(r.value){
            const g=(r.value).toLowerCase();
            if(!(d.grapesSeen||[]).includes(g)){
              d.grapesSeen=(d.grapesSeen||[]);
              d.grapesSeen.push(g); d.total+=A.new_grape;
              awards.push({label:'New grape: '+r.value,amount:A.new_grape,bonus:true});
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

  toast(awards){
    if(!awards||!awards.length) return;
    window.dispatchEvent(new CustomEvent('vinterest:xp',{detail:{awards}}));
  },

  awardAndToast(reasons){
    const a=this.award(reasons);
    this.toast(a);
    return a;
  }
};
