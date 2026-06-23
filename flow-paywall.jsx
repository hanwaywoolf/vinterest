/* Vinterest — New User Flow: Paywall. Two variations.
   Free: 30 scans/mo. Pro: $4.99/mo or $39.99/yr.
   Hero conversion: Sommelier Scripts + Restaurant Mode. */

const SAMPLE_SCRIPT = "I usually go for medium-bodied reds — a Rhône Grenache blend or a good Chianti, nothing too oaky, around the $40 mark. What would you recommend?";

/* Every Pro feature, with Free vs Pro values and a tap-to-expand explanation. */
const PRO_FEATURES=[
  {icon:'message',t:'Sommelier scripts',free:'Example',pro:'Personalized by wine type',
   detail:'First-person talking points, written from your taste — so you can order and talk wine with total confidence. Free gives you a worked example; Pro writes scripts personalized to each wine type you drink.'},
  {icon:'list',t:'Restaurant mode',free:'Not included',pro:'Included',
   detail:'Snap a restaurant’s wine list and instantly see which bottles match your palate, your top picks within budget, and a script to order them.'},
  {icon:'brain',t:'Match scores',free:'Score only',pro:'Score + why',
   detail:'Every wine gets a personal match score. Pro reveals the reasoning — how its body, tannin, acidity and sweetness line up with your profile.'},
  {icon:'camera',t:'Wine scans',free:'30 / month',pro:'Unlimited',
   detail:'Scan any label for instant identification and tasting notes. Free covers 30 scans a month — about a bottle a day.'},
  {icon:'book',t:'Lessons & articles',free:'Basic quizzes & generic articles',pro:'WSET-inspired tests & personalized articles',
   detail:'Build your wine knowledge as you go. Free includes basic quizzes and generic articles; Pro unlocks personalized, WSET-inspired tests and articles tuned to the wines you actually scan.'},
  {icon:'fork',t:'Food pairings',free:'1 pairing',pro:'All pairings',
   detail:'What to eat with any wine. Free shows the top pairing; Pro unlocks the full list.'},
];

/* Sample sommelier script card — the bait. */
function SampleScriptCard({dark}){
  const cardBg=dark?'rgba(255,255,255,0.05)':C.white;
  const border=dark?'rgba(255,255,255,0.1)':C.line;
  const quote=dark?'rgba(255,255,255,0.9)':C.ink2;
  const head=dark?'#fff':C.ink;
  return(
    <div style={{borderRadius:16,padding:'16px 17px',background:cardBg,border:`1px solid ${border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:11}}>
        <Icon n="message" sz={16} col={C.crL}/>
        <span style={{fontSize:13,fontWeight:700,color:C.crL,fontFamily:C.P,letterSpacing:'0.03em',textTransform:'uppercase'}}>Sample sommelier script</span>
      </div>
      <div style={{fontSize:15.5,color:quote,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6,marginBottom:12}}>“{SAMPLE_SCRIPT}”</div>
      <div style={{display:'flex',alignItems:'center',gap:9,paddingTop:12,borderTop:`1px solid ${border}`}}>
        <Icon n="lock" sz={15} col={dark?'rgba(255,255,255,0.5)':C.mid}/>
        <span style={{fontSize:13.5,color:dark?'rgba(255,255,255,0.5)':C.mid,fontFamily:C.P,lineHeight:1.35}}>Pro writes these from <b style={{color:head,fontWeight:600}}>your</b> taste — for any wine, any occasion.</span>
      </div>
    </div>
  );
}

/* Expandable Free-vs-Pro feature list. Tap a row to read what it is. */
function ProFeatureList({dark}){
  const [open,setOpen]=React.useState(null);
  const line=dark?'rgba(255,255,255,0.1)':C.line;
  const titleC=dark?'#fff':C.ink;
  const subFree=dark?'rgba(255,255,255,0.45)':C.mid;
  const detailC=dark?'rgba(255,255,255,0.6)':C.ink2;
  const cardBg=dark?'rgba(255,255,255,0.04)':C.white;
  const proC=dark?C.crL:C.cr;
  return(
    <div style={{borderRadius:16,overflow:'hidden',border:`1px solid ${line}`,background:cardBg}}>
      {PRO_FEATURES.map((f,i)=>{
        const isOpen=open===i;
        return(
          <div key={i} style={{borderBottom:i<PRO_FEATURES.length-1?`1px solid ${line}`:'none'}}>
            <div onClick={()=>setOpen(isOpen?null:i)} style={{display:'flex',alignItems:'center',gap:12,padding:'13px 15px',cursor:'pointer'}}>
              <div style={{width:36,height:36,borderRadius:10,background:dark?'rgba(139,26,47,0.3)':C.crSoft,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={f.icon} sz={18} col={proC}/>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,color:titleC,fontFamily:C.P}}>{f.t}</div>
                <div style={{fontSize:12.5,fontFamily:C.P,marginTop:3,lineHeight:1.5}}>
                  <div style={{color:subFree}}>Free: {f.free}</div>
                  <div style={{color:proC,fontWeight:600}}>Pro: {f.pro}</div>
                </div>
              </div>
              <div style={{transform:isOpen?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>
                <Icon n="chevron" sz={15} col={subFree}/>
              </div>
            </div>
            {isOpen&&(
              <div style={{padding:'0 15px 14px 63px'}}>
                <div style={{fontSize:13.5,color:detailC,fontFamily:C.P,lineHeight:1.5}}>{f.detail}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── VARIATION A: Sample-script hero + feature list + selectable plan cards ── */
function PaywallVariantA({next}){
  const [plan,setPlan]=React.useState('annual');
  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'calc(env(safe-area-inset-top) + 18px) 24px 16px'}}>
        <div style={{textAlign:'right',marginBottom:8}}>
          <span onClick={next} style={{fontSize:14,color:C.mid,fontFamily:C.P,fontWeight:500,cursor:'pointer'}}>Not now</span>
        </div>
        <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,background:C.crSoft,marginBottom:14}}>
          <span style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,letterSpacing:'0.03em'}}>VINTEREST PRO</span>
        </div>
        <div style={{fontSize:27,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.6px',lineHeight:1.13,marginBottom:18}}>Order like you’ve<br/>been doing it for years.</div>

        <SampleScriptCard/>

        <div style={{fontSize:13,fontWeight:600,color:C.mid,fontFamily:C.P,letterSpacing:'0.04em',textTransform:'uppercase',margin:'24px 0 11px'}}>What you get · tap to learn more</div>
        <ProFeatureList/>

        {/* plan cards */}
        <div style={{display:'flex',flexDirection:'column',gap:11,marginTop:22}}>
          <div onClick={()=>setPlan('annual')} style={{position:'relative',borderRadius:16,padding:'17px 18px',border:`2px solid ${plan==='annual'?C.cr:C.line}`,background:plan==='annual'?C.crSoft:C.white,cursor:'pointer',transition:'all .15s'}}>
            <div style={{position:'absolute',top:-11,left:18,background:C.cr,borderRadius:20,padding:'3px 11px'}}>
              <span style={{fontSize:11.5,fontWeight:700,color:'#fff',fontFamily:C.P,letterSpacing:'0.03em'}}>SAVE 33%</span>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:16.5,fontWeight:700,color:C.ink,fontFamily:C.P}}>Annual</div>
                <div style={{fontSize:13.5,color:C.mid,fontFamily:C.P,marginTop:2}}>$3.33 / month, billed yearly</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px'}}>$39.99</div>
                <div style={{fontSize:12.5,color:C.mid,fontFamily:C.P}}>per year</div>
              </div>
            </div>
          </div>
          <div onClick={()=>setPlan('monthly')} style={{borderRadius:16,padding:'17px 18px',border:`2px solid ${plan==='monthly'?C.cr:C.line}`,background:plan==='monthly'?C.crSoft:C.white,cursor:'pointer',transition:'all .15s'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:16.5,fontWeight:700,color:C.ink,fontFamily:C.P}}>Monthly</div>
                <div style={{fontSize:13.5,color:C.mid,fontFamily:C.P,marginTop:2}}>Cancel anytime</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px'}}>$4.99</div>
                <div style={{fontSize:12.5,color:C.mid,fontFamily:C.P}}>per month</div>
              </div>
            </div>
          </div>
        </div>
        <div style={{textAlign:'center',marginTop:13,fontSize:12.5,color:C.mid,fontFamily:C.P}}>Upgrade anytime · cancel anytime on monthly</div>
      </div>

      <div style={{padding:'12px 24px 40px',flexShrink:0,background:C.white,borderTop:`1px solid ${C.line}`}}>
        <div onClick={next} style={{background:C.cr,borderRadius:14,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 8px 26px ${C.cr}45`}}>
          <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>{plan==='annual'?'Start Pro · $39.99/yr':'Start Pro · $4.99/mo'}</span>
        </div>
        <div style={{textAlign:'center',marginTop:12}}>
          <span onClick={next} style={{fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Continue with Free · 30 scans/mo</span>
        </div>
      </div>
    </div>
  );
}

/* ── VARIATION B: Dark hero, sample script + expandable feature list + billing toggle ── */
function PaywallVariantB({next}){
  const [billing,setBilling]=React.useState('annual');
  return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',top:-80,right:-80,width:280,height:280,borderRadius:140,background:`${C.cr}26`,pointerEvents:'none'}}></div>

      <div style={{flex:1,overflowY:'auto',padding:'calc(env(safe-area-inset-top) + 18px) 24px 16px',position:'relative',zIndex:1}}>
        <div style={{textAlign:'right',marginBottom:10}}>
          <span onClick={next} style={{fontSize:14,color:'rgba(255,255,255,0.45)',fontFamily:C.P,fontWeight:500,cursor:'pointer'}}>Not now</span>
        </div>
        <div style={{fontSize:29,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.7px',lineHeight:1.1,marginBottom:8}}>Never freeze at the<br/>wine list again.</div>
        <div style={{fontSize:15.5,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.5,marginBottom:20}}>Pro scans the list, picks for your taste, and hands you the words.</div>

        <SampleScriptCard dark/>

        <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.45)',fontFamily:C.P,letterSpacing:'0.04em',textTransform:'uppercase',margin:'22px 0 11px'}}>What you get · tap to learn more</div>
        <ProFeatureList dark/>

        {/* billing toggle */}
        <div style={{display:'flex',gap:8,padding:4,borderRadius:13,background:'rgba(255,255,255,0.06)',marginTop:22}}>
          {[['annual','Annual','$39.99/yr'],['monthly','Monthly','$4.99/mo']].map(([id,label,price])=>{
            const on=billing===id;
            return(
              <div key={id} onClick={()=>setBilling(id)} style={{flex:1,borderRadius:10,padding:'11px 8px',textAlign:'center',background:on?'#fff':'transparent',cursor:'pointer',transition:'all .15s'}}>
                <div style={{fontSize:14.5,fontWeight:700,color:on?C.ink:'rgba(255,255,255,0.7)',fontFamily:C.P}}>{label}</div>
                <div style={{fontSize:12.5,color:on?C.mid:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:2}}>{price}{id==='annual'&&<span style={{color:C.green,fontWeight:600}}> · save 33%</span>}</div>
              </div>
            );
          })}
        </div>
        <div style={{textAlign:'center',marginTop:13,fontSize:12.5,color:'rgba(255,255,255,0.4)',fontFamily:C.P}}>Upgrade anytime · cancel anytime on monthly</div>
      </div>

      <div style={{padding:'14px 24px 40px',flexShrink:0,position:'relative',zIndex:1}}>
        <div onClick={next} style={{background:C.cr,borderRadius:14,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 8px 30px ${C.cr}60`}}>
          <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>Start Pro · {billing==='annual'?'$39.99/yr':'$4.99/mo'}</span>
        </div>
        <div style={{textAlign:'center',marginTop:12}}>
          <span onClick={next} style={{fontSize:14,color:'rgba(255,255,255,0.45)',fontFamily:C.P,cursor:'pointer'}}>Continue with Free · 30 scans/mo</span>
        </div>
      </div>
    </div>
  );
}

function PaywallScreen({next,variant}){
  return variant==='B'?<PaywallVariantB next={next}/>:<PaywallVariantA next={next}/>;
}

/* ── Done screen ── */
function DoneScreen({restart}){
  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 32px',textAlign:'center'}}>
      <div style={{width:84,height:84,borderRadius:42,background:C.green,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:26,boxShadow:`0 12px 36px ${C.green}45`}}>
        <Icon n="check" sz={40} col="#fff"/>
      </div>
      <div style={{fontSize:27,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',marginBottom:10}}>You’re all set</div>
      <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55,maxWidth:280,marginBottom:32}}>Your account is ready and your first scan is saved. Time to explore.</div>
      <div onClick={restart} style={{background:C.cr,borderRadius:14,padding:'15px 32px',cursor:'pointer',boxShadow:`0 8px 26px ${C.cr}45`}}>
        <span style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Replay the flow</span>
      </div>
    </div>
  );
}

Object.assign(window,{PaywallScreen,DoneScreen,SampleScriptCard});
