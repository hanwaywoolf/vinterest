/* Vinterest — the waiting screen for anything written or looked up for the reader: "Learn more
   about this wine", an article, the sommelier script, a price check. It says what is being done
   for them, draws a glass filling and settling (pen and wash, like the app's other sketches),
   and gives them something to read while they wait: a tidbit every few seconds, about the bottle
   in hand first and then general wine facts (WineDeep.tidbits). Poppins, nothing italic;
   reduced motion shows the glass still and the first tidbit. */
const _WAIT_CSS=`
@keyframes wtPour{0%{transform:translateY(10px)}50%{transform:translateY(-2px)}100%{transform:translateY(10px)}}
@keyframes wtSway{0%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}100%{transform:rotate(-2deg)}}
@keyframes wtIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.wt-pour{animation:wtPour 2.6s ease-in-out infinite}
.wt-sway{transform-origin:50% 90%;animation:wtSway 3.4s ease-in-out infinite}
.wt-tip{animation:wtIn .5s ease both}
@media (prefers-reduced-motion: reduce){.wt-pour,.wt-sway,.wt-tip{animation:none!important}}
`;
const WAIT_TIP_MS=5000;
function WritingWait({title='Writing something personalised for you…',sub,wine,col,compact=false}){
  const tips=React.useMemo(()=>WineDeep.tidbits(wine),[wine&&wine.name,wine&&wine.vintage]);
  const [i,setI]=React.useState(0);
  React.useEffect(()=>{ if(tips.length<2||_reducedMotion()) return; const t=setInterval(()=>setI(x=>(x+1)%tips.length),WAIT_TIP_MS); return()=>clearInterval(t); },[tips.length]);
  const T=typeof useTheme==='function'?useTheme():null, ink=T?T.ink:C.ink, ink2=T?T.ink2:C.ink2, mid=T?T.mid:C.mid, soft=T?T.soft:C.offWhite, line=T?T.line:C.line, pen=T&&T.dark?'rgba(255,255,255,0.9)':SKETCH_INK;
  const c=T&&T.dark?T.lift(col||C.cr):(col||C.cr);
  return <div data-testid="writing-wait" role="status" aria-live="polite" style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:compact?8:12,padding:compact?'10px 8px':'18px 12px'}}>
    <style>{_WAIT_CSS}</style>
    <svg className="wt-sway" viewBox="-20 -24 40 46" width={compact?44:64} height={compact?50:74} aria-hidden="true" style={{overflow:'visible'}}>
      <defs><clipPath id="wtBowl"><path d="M-11 -17 C-11 -4 -8 4 0 4 C8 4 11 -4 11 -17 Z"/></clipPath></defs>
      <g clipPath="url(#wtBowl)"><g className="wt-pour"><path d="M-14 -6 C-9 -9 -4 -3 0 -6 C4 -9 9 -3 14 -6 L14 12 L-14 12 Z" fill={c} opacity="0.7"/></g></g>
      <path d="M-11 -17 C-11 -4 -8 4 0 4 C8 4 11 -4 11 -17" fill="none" stroke={pen} strokeWidth="1.6" strokeLinecap="round"/>
      <path d="M-11 -17 C-5 -18.2 5 -18.2 11 -17" fill="none" stroke={pen} strokeWidth="1.1" opacity="0.7" strokeLinecap="round"/>
      <path d="M0 4 L0 15 M-8.5 16.5 C-4 14.6 4 14.6 8.5 16.5" fill="none" stroke={pen} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
    <div>
      <div style={{fontSize:compact?15:17,fontWeight:800,color:ink,fontFamily:C.P,lineHeight:1.3}}>{title}</div>
      {sub&&<div style={{fontSize:13,fontWeight:700,color:c,fontFamily:C.P,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:4}}>{sub}</div>}
    </div>
    {tips.length>0&&<div key={i} className="wt-tip" data-testid="writing-tip" style={{fontSize:14,color:ink2,fontFamily:C.P,lineHeight:1.5,maxWidth:340,padding:'10px 14px',borderRadius:12,background:soft,border:`1px solid ${line}`}}>
      <span style={{fontWeight:700,color:mid,fontSize:12,letterSpacing:'0.08em',textTransform:'uppercase',display:'block',marginBottom:3}}>While you wait</span>{tips[i]}
    </div>}
  </div>;
}
Object.assign(window,{WritingWait,WAIT_TIP_MS});
