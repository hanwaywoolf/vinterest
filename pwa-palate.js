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

  /* Each trait's own page (PalateTraitScreen): what it is, how to notice it, wines at either end,
     a tip, and the words for its scale (low end, high end). Fixed text, checked; no Claude call. */
  TRAITS:{
    body:{words:['light','full'],
      what:'Body is how heavy a wine feels in your mouth, from watery to rich and mouth-filling.',
      notice:['Think of skimmed milk, whole milk and cream: that is light, medium and full body.','Alcohol is the biggest driver: the more alcohol, the more weight. Sugar and oak add to it too.','Hold a sip for a moment and notice whether it feels thin or coats your tongue.'],
      low:'Pinot Noir, Beaujolais, Vinho Verde', high:'Barossa Shiraz, Amarone, oaked California Chardonnay',
      tip:'A warm wine feels heavier than a cold one, so judge it at the temperature it is served.'},
    acidity:{words:['soft','fresh'],
      what:'Acidity is the fresh, tart side of a wine: the part that makes your mouth water.',
      notice:['After you swallow, tip your head forward a little: the more your mouth waters, the higher the acidity.','High acidity feels crisp and zesty, like lemon or green apple; low acidity feels soft and round.','Cool climates keep more acidity in the grapes; hot ones give softer wines.'],
      low:'Viognier, warm-climate Merlot, Grenache', high:'Riesling, Sauvignon Blanc, Chablis, Barbera',
      tip:'Sweetness hides acidity: a sweet Riesling can be very acidic without tasting sharp.'},
    tannins:{words:['silky','grippy'],
      what:'Tannin is the drying grip in red wine. It comes from grape skins, seeds and oak barrels.',
      notice:['After you swallow, feel your gums and the inside of your cheeks: dry and grippy means more tannin.','Strong black tea left to stew is the classic comparison.','Tannin softens as a wine ages, and with fatty food such as steak or hard cheese.'],
      low:'Pinot Noir, Gamay, Grenache', high:'Nebbiolo, Cabernet Sauvignon, Tannat',
      tip:"Don't mix it up with acidity: tannin dries your mouth, acidity makes it water."},
    texture:{words:['crisp','rich'],
      what:'Texture is how a white wine feels in your mouth: lean and crisp, or round and creamy.',
      notice:['Crisp feels like biting a cold apple; rich feels closer to a spoonful of yoghurt.','Oak, time on the lees (the spent yeast) and a softening second fermentation make a white rounder.','Roll the wine around your mouth and notice whether it feels sharp-edged or smooth.'],
      low:'Sauvignon Blanc, Albariño, Muscadet', high:'Oaked Chardonnay, Viognier, white Rhône',
      tip:'Very cold wine feels crisper; let a rich white warm up a little to feel its texture.'},
  },
  /* A 0-1 reading as words on the trait's own scale ("medium", "quite grippy", "very light"). */
  word(id,v){
    const [lo,hi]=this.TRAITS[id].words;
    return v<0.2?`very ${lo}`:v<0.4?`quite ${lo}`:v<0.6?'medium':v<0.8?`quite ${hi}`:`very ${hi}`;
  },
  /* One trait for its page: the axis from compute() (score, lean, how) plus every Blind Call on
     it, newest first, each with their guess and the label's profile in words and how close it was. */
  trait(id,wines){
    wines=wines||WineHistory.getAll();
    const p=this.compute(wines), a=p.axes.find(x=>x.id===id)||null;
    const calls=this.calls(wines).filter(c=>id in c.miss).map(c=>{
      const label=typeof c.wine[id]==='number'?c.wine[id]:0.5, guess=label+c.miss[id];
      return {wine:c.wine,at:c.at,guess,label,miss:c.miss[id],accuracy:Math.round(this._acc(c.miss[id])*100),
        said:this.word(id,guess),labelSaid:this.word(id,label)};
    }).reverse();
    const score=a?a.score:null;
    return {id,name:this.NAMES[id],...this.TRAITS[id],how:this.HOW[id],score,n:calls.length,lean:a?a.lean:null,
      level:score==null?null:typeof KnowledgeMap!=='undefined'?KnowledgeMap.level(score):'',calls,
      guide:typeof Guides!=='undefined'?Guides.byId(this.GUIDE[id]):null};
  },

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
