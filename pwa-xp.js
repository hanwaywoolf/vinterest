/* Vinterest — XP Engine */

const XP_LEVELS = [
  {name:'Novice',          min:0,    badge:'🍇', color:'#8A8A8A'},
  {name:'Enthusiast',      min:150,  badge:'🥂', color:'#B8963E'},
  {name:'Explorer',        min:350,  badge:'🌍', color:'#5E8FA8'},
  {name:'Connoisseur',     min:650,  badge:'🔍', color:'#7B5EA7'},
  {name:'Aficionado',      min:1050, badge:'🏅', color:'#1E7B4B'},
  {name:'Cru',             min:1600, badge:'🍾', color:'#C47A8A'},
  {name:'Sommelier',       min:2400, badge:'🎓', color:'#8B1A2F'},
  {name:'Head Sommelier',  min:3500, badge:'⭐', color:'#8B2252'},
  {name:'Master Sommelier',min:5000, badge:'🏆', color:'#B06C00'},
  {name:'Grand Master',    min:7000, badge:'👑', color:'#0F0F0F'},
];

const XPSystem = {
  KEY:'vinterest_xp_v2',
  get(){
    try{ return JSON.parse(localStorage.getItem(this.KEY)||'null') || this.fresh(); }
    catch(e){ return this.fresh(); }
  },
  fresh(){
    return {total:0,events:[],scansThisWeek:[],totalRatings:0,grapesSeen:[],quizCompleted:{},quizStreaks:{}};
  },
  save(d){ localStorage.setItem(this.KEY, JSON.stringify(d)); },

  getLevel(xp){
    for(let i=XP_LEVELS.length-1;i>=0;i--){
      if(xp>=XP_LEVELS[i].min) return {...XP_LEVELS[i], index:i};
    }
    return {...XP_LEVELS[0], index:0};
  },
  nextLevel(xp){
    const cur=this.getLevel(xp);
    return XP_LEVELS[cur.index+1]||null;
  },
  levelProgress(xp){
    const cur=this.getLevel(xp);
    const nxt=this.nextLevel(xp);
    if(!nxt) return 1;
    return (xp-cur.min)/(nxt.min-cur.min);
  },

  award(reasons){
    const d=this.get();
    const awards=[];
    const prevLevel=this.getLevel(d.total).name;

    reasons.forEach(r=>{
      switch(r.type){
        case 'scan':
          d.total+=10;
          awards.push({label:'Wine scanned',amount:10});
          // weekly scan bonus
          {const now=Date.now(), wAgo=now-7*24*60*60*1000;
          d.scansThisWeek=[(d.scansThisWeek||[]).filter(t=>t>wAgo),now].flat();
          const wk='week5_'+Math.floor(now/(7*24*60*60*1000));
          if(d.scansThisWeek.length>=5 && !d.events.includes(wk)){
            d.events.push(wk); d.total+=50;
            awards.push({label:'5 scans this week! 🚀',amount:50,bonus:true});
          }}
          break;

        case 'rate':
          d.total+=15;
          d.totalRatings=(d.totalRatings||0)+1;
          awards.push({label:'Wine rated',amount:15});
          if(d.totalRatings===10 && !d.events.includes('ratings_10')){
            d.events.push('ratings_10'); d.total+=100;
            awards.push({label:'10 wines rated! 🏅',amount:100,bonus:true});
          }
          break;

        case 'quiz_correct':
          d.total+=10;
          // track streak per topic+difficulty
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=(d.quizStreaks[sk]||0)+1;
          awards.push({label:'Correct!',amount:10});
          if(d.quizStreaks[sk]===3){
            d.total+=30;
            awards.push({label:'3-answer streak! 🔥',amount:30,bonus:true});
          }}
          break;

        case 'quiz_wrong':
          {const sk=(r.topic||'')+'_'+(r.difficulty||'');
          d.quizStreaks=d.quizStreaks||{};
          d.quizStreaks[sk]=0;}
          break;

        case 'quiz_complete':
          {const k=(r.topic||'')+'_'+(r.difficulty||'');
          if(!d.quizCompleted) d.quizCompleted={};
          if(!d.quizCompleted[k]){
            const bonus={beginner:50,intermediate:100,expert:200}[r.difficulty]||50;
            d.quizCompleted[k]=bonus; d.total+=bonus;
            awards.push({label:'Quiz complete! 🎉',amount:bonus,bonus:true});
          }}
          break;

        case 'first_type':
          if(r.value && !d.events.includes('type_'+r.value)){
            d.events.push('type_'+r.value); d.total+=25;
            awards.push({label:'First '+r.value+' wine! 🆕',amount:25,bonus:true});
          }
          break;

        case 'first_country':
          if(r.value){
            const ck='country_'+(r.value).toLowerCase().replace(/\s/g,'_');
            if(!d.events.includes(ck)){
              d.events.push(ck); d.total+=20;
              awards.push({label:'First from '+r.value+'! 🌍',amount:20,bonus:true});
            }
          }
          break;

        case 'new_grape':
          if(r.value){
            const g=(r.value).toLowerCase();
            if(!(d.grapesSeen||[]).includes(g)){
              d.grapesSeen=(d.grapesSeen||[]);
              d.grapesSeen.push(g); d.total+=15;
              awards.push({label:'New grape: '+r.value+' 🍇',amount:15,bonus:true});
            }
          }
          break;

        case 'expensive_wine':
          if(r.wineKey && !d.events.includes('expensive_'+r.wineKey)){
            d.events.push('expensive_'+r.wineKey); d.total+=50;
            awards.push({label:'Premium wine scanned! 💎',amount:50,bonus:true});
          }
          break;
      }
    });

    this.save(d);
    // Check level-up
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
