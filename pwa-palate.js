/* Vinterest — Palate: how well they can taste a wine's structure, from their Blind Calls.

   Mastery (KnowledgeMap) is what they've read and passed; this is what they can taste. Each
   Blind Call (ScanFlow.blindResult: their guess at body, acidity and tannins or texture before
   seeing the label's profile) is compared with that profile, axis by axis, the same way the
   Blind Call result scores it (accuracy = 1 − 1.6 × the miss). The label's profile is Claude's
   estimate, not a measurement, so the screens call it a guide, never a verdict on their palate.

   No new storage: every call is already saved per wine. Nothing here is asked of the user. */
const Palate = {
  FULL_AT:5,      // calls before the score can reach its full value: one lucky call isn't a palate
  LEAN_FROM:0.12, // an average miss in one direction at least this big is a habit worth naming
  AXES:['body','acidity','tannins','texture'],
  NAMES:{body:'Body',acidity:'Acidity',tannins:'Tannins',texture:'Texture'},
  LEAN:{body:['lighter','fuller'],acidity:['softer','fresher'],tannins:['silkier','grippier'],texture:['crisper','richer']},
  // How to notice each one, said wherever an axis is (Teach while asking).
  HOW:{body:'Body is weight in the mouth: skimmed milk against cream.',
    acidity:'Acidity makes your mouth water; the more it does, the fresher the wine.',
    tannins:'Tannin dries your gums and the inside of your cheeks, like strong black tea.',
    texture:'Texture is how a white feels: crisp like a cold apple, or round and creamy.'},
  // The guide that teaches each axis.
  GUIDE:{body:'taste_four_steps',acidity:'taste_four_steps',tannins:'taste_oak_and_tannin',texture:'taste_oak_and_tannin'},

  _acc(miss){ return Math.max(0,1-Math.abs(miss)*1.6); },
  _mean(xs){ return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0; },

  /* Every Blind Call they've played, oldest first: {wine, at, miss: {axis: guess − label}, accuracy}. */
  calls(wines){
    wines=wines||WineHistory.getAll();
    return wines.map(w=>{
      const r=ScanFlow.blindResult(w); if(!r||!r.guess) return null;
      const miss={};
      this.AXES.forEach(k=>{ const g=r.guess[k]; if(typeof g==='number') miss[k]=g-(typeof w[k]==='number'?w[k]:0.5); });
      const ks=Object.keys(miss); if(!ks.length) return null;
      const accuracy=typeof r.accuracy==='number'?r.accuracy:Math.max(0,1-this._mean(ks.map(k=>Math.abs(miss[k])))*1.6);
      return {wine:w,at:r.at||new Date(w.last_scanned||w.scanned_at||0).getTime()||0,miss,accuracy};
    }).filter(Boolean).sort((a,b)=>a.at-b.at);
  },

  /* {score, level, n, accuracy, axes:[{id,name,n,score,lean,how}], trend, next}. score is their
     average accuracy, scaled by how many calls back it up (n / FULL_AT, up to 1). trend is the
     last three calls against the ones before, in points, from four calls. */
  compute(wines){
    const calls=this.calls(wines), n=calls.length;
    const accuracy=this._mean(calls.map(c=>c.accuracy));
    const score=Math.round(accuracy*100*Math.min(1,n/this.FULL_AT));
    const axes=this.AXES.map(k=>{
      const m=calls.filter(c=>k in c.miss).map(c=>c.miss[k]); if(!m.length) return null;
      const bias=this._mean(m);
      return {id:k,name:this.NAMES[k],n:m.length,score:Math.round(this._mean(m.map(x=>this._acc(x)))*100),how:this.HOW[k],
        lean:m.length>=2&&Math.abs(bias)>=this.LEAN_FROM?this.LEAN[k][bias>0?1:0]:null};
    }).filter(Boolean);
    const trend=n>=4?Math.round((this._mean(calls.slice(-3).map(c=>c.accuracy))-this._mean(calls.slice(0,-3).map(c=>c.accuracy)))*100):null;
    const weakest=[...axes].sort((a,b)=>a.score-b.score)[0];
    const guide=weakest&&weakest.score<80&&typeof Guides!=='undefined'?Guides.byId(this.GUIDE[weakest.id]):null;
    const next=n<this.FULL_AT?{label:n?`Play Blind Call on your next bottle (${n} of ${this.FULL_AT})`:'Play Blind Call on your next bottle',nav:'camera'}
      :guide&&!Guides.done(guide.id)?{label:`Read "${guide.title}"`,guide:guide.id}
      :{label:'Play Blind Call on your next bottle',nav:'camera'};
    return {score,level:typeof KnowledgeMap!=='undefined'?KnowledgeMap.level(score):'',n,accuracy:Math.round(accuracy*100),axes,trend,weakest:weakest||null,next};
  },

  /* "You tend to call tannins grippier than the label's profile." One line per habit. */
  leans(p){ return p.axes.filter(a=>a.lean).map(a=>`You tend to call ${a.name.toLowerCase()} ${a.lean} than the label's profile.`); },
};
