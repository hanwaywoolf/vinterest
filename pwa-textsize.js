/* Vinterest — TextSize: the reader's text size (Profile and Settings) and the smallest size any
   text may be.

   Every screen sets font sizes inline (style={{fontSize:15}}). The build compiles JSX to _h, not
   React.createElement, and _h passes each HTML element's numeric fontSize through TextSize.px:
   raised to at least MIN (13px), then scaled by the chosen size. Only text grows; spacing,
   buttons and cards keep their size. Components (Card, Btn…) are left alone so nothing is
   scaled twice; the HTML they render is scaled once. A fontSize given as a string ('15px') is
   left exactly as written: only for text that must fit a fixed graphic (the score ring, the XP
   badge beside the logo). */
const TextSize = {
  KEY:'vinterest_text_size',
  MIN:13,
  SIZES:[{id:'standard',label:'Standard',scale:1},{id:'large',label:'Large',scale:1.1},{id:'xl',label:'Extra large',scale:1.2}],
  get(){ let id=null; try{ id=localStorage.getItem(this.KEY); }catch(e){} return this.SIZES.find(s=>s.id===id)||this.SIZES[0]; },
  _scale:null,
  scale(){ if(this._scale==null) this._scale=this.get().scale; return this._scale; },
  set(id){
    const s=this.SIZES.find(x=>x.id===id)||this.SIZES[0];
    try{ localStorage.setItem(this.KEY,s.id); }catch(e){}
    this._scale=s.scale;
    try{ window.dispatchEvent(new Event('vinterest:textsize')); }catch(e){}
  },
  px(n){ return Math.round(Math.max(this.MIN,n)*this.scale()*2)/2; },
};

function _h(type,props){
  if(typeof type==='string'&&props&&props.style&&typeof props.style.fontSize==='number'){
    arguments[1]={...props,style:{...props.style,fontSize:TextSize.px(props.style.fontSize)}};
  }
  return React.createElement.apply(React,arguments);
}
