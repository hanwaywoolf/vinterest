/* ── SCAN HOME (Scan tab content) ── */
function ScanHomeScreen({nav,showPro}){
  const wines=WineHistory.getAll();
  const isPro=!!localStorage.getItem('vinterest_pro');
  const scanCount=parseInt(localStorage.getItem('vinterest_scan_count')||'0');
  const FREE_SCANS=10;
  const atLimit=!isPro&&scanCount>=FREE_SCANS;
  const scansLeft=Math.max(0,FREE_SCANS-scanCount);
  const typeColors={red:C.cr,white:'#B8963E',rosé:'#C47A8A',rose:'#C47A8A',sparkling:'#5E8FA8'};
  const colFor=w=>typeColors[(w.type||'red').toLowerCase().replace('é','e')]||C.cr;
  function handleScanCTA(){ if(atLimit){showPro('unlimited-scans');return;} nav('camera'); }
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflowY:'auto',background:C.bg}}>
      <div style={{padding:'18px 20px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',background:C.white,borderBottom:`1px solid ${C.line}`}}>
        <div style={{fontSize:28,fontWeight:900,color:C.ink,fontFamily:C.P,letterSpacing:'-0.8px'}}>Vinterest</div>
        {!isPro&&!atLimit&&scansLeft<=3&&scansLeft>0&&(
          <div style={{fontSize:13,color:C.amber,fontWeight:600,fontFamily:C.P,background:C.amberBg,padding:'4px 10px',borderRadius:20,border:`1px solid ${C.amber}30`}}>{scansLeft} scan{scansLeft!==1?'s':''} left</div>
        )}
        {!isPro&&atLimit&&(
          <div onClick={()=>showPro('unlimited-scans')} style={{fontSize:13,fontWeight:700,fontFamily:C.P,background:'linear-gradient(135deg,#9B5E00,#C4870A)',padding:'5px 12px',borderRadius:20,cursor:'pointer',color:'#fff'}}>Upgrade</div>
        )}
        {isPro&&<span style={{fontSize:13,fontWeight:700,fontFamily:C.P,background:'linear-gradient(135deg,#9B5E00,#C4870A)',padding:'4px 10px',borderRadius:20,color:'#fff'}}>PRO</span>}
      </div>
      <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        {/* Primary scan CTA */}
        <div onClick={handleScanCTA} style={{background:C.ink,borderRadius:20,padding:'20px 22px',display:'flex',alignItems:'center',gap:16,cursor:'pointer',position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',right:-24,top:-24,width:140,height:140,borderRadius:70,background:`${C.cr}28`,pointerEvents:'none'}}/>
          <div style={{width:58,height:58,borderRadius:16,background:atLimit?'#444':C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,zIndex:1,boxShadow:atLimit?'none':`0 6px 24px ${C.cr}55`}}>
            {atLimit?<Icon n="lock" sz={24} col="#888"/>:<Icon n="camera" sz={28} col="#fff"/>}
          </div>
          <div style={{flex:1,zIndex:1}}>
            <div style={{fontSize:22,fontWeight:700,color:atLimit?'rgba(255,255,255,0.4)':'#fff',fontFamily:C.P,lineHeight:1.2}}>{atLimit?'Free scans used up':'Scan a Bottle'}</div>
            <div style={{fontSize:16,color:'rgba(255,255,255,0.4)',fontFamily:C.P,marginTop:3}}>{atLimit?'Upgrade for unlimited scans':'Point at any wine label to identify'}</div>
          </div>
          {!atLimit&&<Icon n="chevron" sz={16} col="rgba(255,255,255,0.3)"/>}
        </div>
        {/* Wine List – Pro locked */}
        <div onClick={()=>showPro('wine-list')} style={{background:C.white,borderRadius:14,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,border:`1px solid ${C.line}`,cursor:'pointer',opacity:0.75}}>
          <div style={{width:40,height:40,borderRadius:10,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <Icon n="list" sz={18} col={C.mid}/>
          </div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:17,fontWeight:600,color:C.ink2,fontFamily:C.P}}>Wine List Scan</span>
              <ProBadge/>
            </div>
            <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>Snap a restaurant menu for instant picks</div>
          </div>
          <Icon n="lock" sz={14} col={C.mid}/>
        </div>
        {/* My Wines / empty state */}
        {wines.length===0?(
          <div style={{background:C.white,borderRadius:16,padding:'28px 20px',textAlign:'center',border:`1px solid ${C.line}`}}>
            <div style={{fontSize:46,marginBottom:10}}>🍷</div>
            <div style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P,marginBottom:6}}>Your cellar is empty</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.65,marginBottom:16}}>Scan and rate your first bottle to start building your personal taste profile.</div>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <Btn primary onClick={handleScanCTA}>Scan First Bottle</Btn>
              <Btn onClick={()=>nav('learn')}>Take a Quiz</Btn>
            </div>
          </div>
        ):(
          <>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:4}}>
              <span style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>My Wines</span>
              <span onClick={()=>nav('mywines')} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{wines.length} bottles →</span>
            </div>
            {wines.slice(0,3).map((w,i)=>(
              <Card key={i} style={{padding:10,cursor:'pointer'}} onClick={()=>{
                sessionStorage.setItem('vinterest_scan_result',JSON.stringify({demo:false,wine:w,confidence:0.9,existingRating:w.rating||0}));
                nav('identified');
              }}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:38,height:52,borderRadius:8,background:colFor(w)+'15',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',border:`1px solid ${colFor(w)}25`}}>
                    <Icon n="wine" sz={17} col={colFor(w)}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{w.name}</div>
                    <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{[w.region,w.country].filter(Boolean)[0]||''} · {w.vintage||'NV'}</div>
                  </div>
                  {w.rating>0&&<div style={{display:'flex',alignItems:'baseline',gap:1,flexShrink:0}}>
                    <span style={{fontSize:17,fontWeight:700,color:C.amber,fontFamily:C.P}}>{w.rating}</span>
                    <span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>/100</span>
                  </div>}
                </div>
              </Card>
            ))}
          </>
        )}
        {wines.length===0&&(
          <>
            <div style={{fontSize:15,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>Get Started</div>
            {[
              {emoji:'🎓',t:'Take a Wine Quiz',s:'Earn XP and learn something new',dest:'learn'},
              {emoji:'📖',t:'5 taste terms to know',s:'Understand any wine in 2 minutes',dest:'article'},
            ].map((a,i)=>(
              <Card key={i} onClick={()=>nav(a.dest)} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer'}}>
                <div style={{width:44,height:44,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{a.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:600,color:C.ink,fontFamily:C.P}}>{a.t}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:1}}>{a.s}</div>
                </div>
                <Icon n="chevron" sz={14} col={C.mid}/>
              </Card>
            ))}
          </>
        )}
        <div style={{height:8}}/>
      </div>
    </div>
  );
}
