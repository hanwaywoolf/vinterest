/* Vinterest — how XP and the moments behind it reach the user (XPSystem.toast/present, pwa-xp.js).

   Plain XP is one quiet chip at the top right ("+15 XP · Wine scanned") that adds up a burst of
   awards instead of stacking a pill for each, and never sits over a screen's title. What changes
   something for them (a new level, a new grape, a first country, a first wine type) is a moment
   card just above the bottom navigation with one next step, shown one at a time and only on a
   calm screen (MOMENT_SCREENS): one earned mid-scan or mid-quiz waits until they're back on Home,
   Learn or another tab, so it never covers what they're doing. A screen that shows its own XP
   passes {xpShown}; one that shows everything (the quiz result) passes {quiet}. */
const MOMENT_SCREENS=['home','mywines','learn','profile','scan','mastery-map','account'];
const _MOMENT_CSS=`@keyframes xpChipIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
@keyframes momentIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.xp-chip{animation:xpChipIn .25s ease both}.moment-card{animation:momentIn .35s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion:reduce){.xp-chip,.moment-card{animation:none}}`;

function useXPDelivery(){
  const [chip,setChip]=React.useState(null);
  const [queue,setQueue]=React.useState([]);
  const timer=React.useRef(0);
  React.useEffect(()=>{
    const h=e=>{
      const d=e.detail||{}; if(d.quiet) return;
      const p=XPSystem.present(d.awards);
      if(p.xp>0&&!d.xpShown){
        setChip(c=>({xp:(c?c.xp:0)+p.xp,label:p.label||(c&&c.label)||null}));
        clearTimeout(timer.current); timer.current=setTimeout(()=>setChip(null),2600);
      }
      if(p.moments.length) setQueue(q=>[...q,...p.moments.filter(m=>!q.some(x=>x.id===m.id))]);
    };
    window.addEventListener('vinterest:xp',h);
    return()=>{ window.removeEventListener('vinterest:xp',h); clearTimeout(timer.current); };
  },[]);
  const dismiss=()=>setQueue(q=>q.slice(1));
  return {chip,moment:queue[0]||null,more:Math.max(0,queue.length-1),dismiss};
}

/* Where there's an XP badge (Home), the gain shows in the badge itself (XPBadgeGain); elsewhere
   this chip sits just above the navigation (or the bottom of a screen without one), centred,
   clear of titles and the buttons a screen keeps at its foot. */
function XPChip({chip,overNav}){
  if(!chip) return null;
  const pill=<div key={chip.xp} className="xp-chip" data-testid="xp-chip" aria-live="polite" style={{display:'inline-flex',alignItems:'center',gap:7,background:'rgba(15,15,15,0.9)',borderRadius:999,padding:'6px 12px',boxShadow:'0 4px 14px rgba(0,0,0,0.18)'}}>
    <span style={{fontSize:14,fontWeight:800,color:'#E7C66B',fontFamily:C.P}}>+{chip.xp} XP</span>
    {chip.label&&<span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.85)',fontFamily:C.P,maxWidth:190,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{chip.label}</span>}
  </div>;
  const row={position:'absolute',left:0,right:0,display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:999};
  return overNav?<div style={{position:'relative',height:0}}><div style={{...row,bottom:46}}>{pill}</div></div> // clear of the raised Scan button
    :<div style={{...row,bottom:'calc(env(safe-area-inset-bottom) + 96px)'}}>{pill}</div>;
}
/* The gain inside the header's XP badge: "+15" in gold beside the total, for as long as the chip would show. */
function XPBadgeGain({chip}){
  if(!chip) return null;
  return <span key={chip.xp} className="xp-chip" data-testid="xp-chip" aria-live="polite" style={{fontSize:'13px',fontWeight:800,color:'#fff',background:'#B8963E',borderRadius:8,padding:'1px 6px',marginLeft:2,fontFamily:C.P}}>+{chip.xp}</span>;
}

/* Sits in a zero-height slot just above the bottom navigation, so it never covers a title or a
   button. Stays until dismissed or acted on (it's worth reading), one at a time. */
function MomentCard({m,more,onAct,onClose}){
  if(!m) return null;
  return <div style={{position:'relative',height:0,zIndex:60}}>
    <div key={m.id} className="moment-card" role="status" data-testid="moment-card" style={{position:'absolute',bottom:10,left:12,right:12,background:C.ink,borderRadius:16,padding:'14px 14px 12px',boxShadow:'0 10px 30px rgba(0,0,0,0.28)',display:'flex',gap:12}}>
      <div style={{width:40,height:40,borderRadius:20,background:'rgba(231,198,107,0.16)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={m.icon} sz={19} col="#E7C66B"/></div>
      <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:3}}>
        <div style={{fontSize:13,fontWeight:600,color:'#E7C66B',fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em'}}>{m.kicker}{more?` · ${more} more`:''}</div>
        <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>{m.title}</div>
        {m.body&&<div style={{fontSize:14,color:'rgba(255,255,255,0.7)',fontFamily:C.P,lineHeight:1.45}}>{m.body}</div>}
        {m.action&&<div role="button" onClick={()=>onAct(m.action)} style={{alignSelf:'flex-start',marginTop:6,padding:'7px 13px',borderRadius:999,background:'#fff',cursor:'pointer'}}>
          <span style={{fontSize:14,fontWeight:700,color:C.ink,fontFamily:C.P}}>{m.action.label} →</span>
        </div>}
      </div>
      <div role="button" aria-label="Dismiss" onClick={onClose} style={{width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0,marginTop:-4,marginRight:-4}}>
        <span style={{fontSize:'20px',lineHeight:1,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>×</span>
      </div>
    </div>
  </div>;
}
