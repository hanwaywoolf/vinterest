/* Vinterest PWA — Taste Profile, Restaurant, Learn screens */

function TasteProfileScreen({nav,back}){
  const [tab,setTab]=React.useState(0);
  const cats=[
    {col:'#8B1A2F',label:'Reds',pct:58,
     script:'"I enjoy full-bodied reds with earthy notes and structured tannins — Bordeaux blends and Barolo are favourites. Dry, $40–80."',
     tags:['Full Body','Earthy','Dark Fruit','High Tannins','Dry','Cedar'],
     top:['Château Margaux','Barolo','Pauillac']},
    {col:'#B8963E',label:'Whites',pct:25,
     script:'"I love crisp, dry whites with citrus and mineral notes — Sancerre and white Burgundy are my go-tos. $25–60."',
     tags:['Crisp','Mineral','Citrus','Dry','Light Body','Herbaceous'],
     top:['Kim Crawford Sauv Blanc','Sancerre','Chablis']},
    {col:'#C47A8A',label:'Rosé',pct:12,
     script:'"I prefer bone-dry Provençal rosé with delicate red fruit — light, elegant, refreshing. $20–40."',
     tags:['Bone Dry','Delicate','Red Fruit','Light Body','Crisp'],
     top:['Whispering Angel','Miraval','Château d\'Esclans']},
    {col:'#5E8FA8',label:'Sparkling',pct:5,
     script:'"I enjoy Champagne and Crémant — dry (Brut), with brioche and citrus notes. Not too sweet. $40–90."',
     tags:['Brut','Brioche','Citrus','Fine Bubbles','Toasty'],
     top:['Veuve Clicquot','Billecart-Salmon','Gosset']},
  ];
  const c=cats[tab];

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px 12px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Taste Profile</div>
          <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>Wine Explorer · Level 3 · 32 wines scanned</div>
        </div>
      </div>

      {/* Category tabs */}
      <div style={{display:'flex',background:C.white,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        {cats.map((ct,i)=>(
          <div key={i} onClick={()=>setTab(i)} style={{flex:1,textAlign:'center',padding:'10px 4px',cursor:'pointer',borderBottom:i===tab?`2px solid ${ct.col}`:'2px solid transparent',marginBottom:-1}}>
            <div style={{width:8,height:8,borderRadius:4,background:ct.col,margin:'0 auto 3px'}}/>
            <div style={{fontSize:9.5,fontWeight:i===tab?700:400,color:i===tab?ct.col:C.mid,fontFamily:C.P}}>{ct.label}</div>
            <div style={{fontSize:8,color:C.mid,fontFamily:C.P}}>{ct.pct}%</div>
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        {/* Sommelier script */}
        <Card style={{background:c.col+'0D',border:`1.5px solid ${c.col}30`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <Icon n="message" sz={15} col={c.col}/>
            <span style={{fontSize:12,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your {c.label} Script</span>
          </div>
          <div style={{fontSize:11.5,color:C.ink2,fontFamily:C.P,fontStyle:'italic',lineHeight:1.6,marginBottom:10}}>{c.script}</div>
          <div style={{display:'flex',gap:8}}>
            <Btn primary small onClick={()=>{try{navigator.clipboard.writeText(c.script.replace(/"/g,''))}catch(e){}}}
              style={{background:c.col,boxShadow:`0 3px 12px ${c.col}40`}}>Copy Script</Btn>
            <Btn small>Edit</Btn>
          </div>
        </Card>

        {/* Flavour tags */}
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Flavour Profile</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
            {c.tags.map((t,i)=>(
              <span key={i} style={{padding:'4px 10px',borderRadius:20,background:i<3?c.col+'15':C.offWhite,color:i<3?c.col:C.ink2,fontSize:10,fontWeight:500,fontFamily:C.P,border:`1px solid ${i<3?c.col+'30':C.line}`}}>{t}</span>
            ))}
          </div>
        </Card>

        {/* Top wines */}
        <Card style={{padding:0,overflow:'hidden'}}>
          <div style={{padding:'12px 14px 8px',fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P}}>Your Top {c.label}</div>
          {c.top.map((w,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:12,padding:'9px 14px',borderTop:`1px solid ${C.line}`}}>
              <div style={{width:32,height:44,borderRadius:6,background:c.col+'12',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={c.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w}</div>
                <div style={{display:'flex',gap:2,marginTop:2}}>
                  {[1,2,3,4,5].map(s=><svg key={s} width="10" height="10" viewBox="0 0 20 20"><polygon points="10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6" fill={s<=4+i%2?C.amber:'#E0E0E0'}/></svg>)}
                </div>
              </div>
              <Icon n="chevron" sz={12} col={C.mid}/>
            </div>
          ))}
        </Card>

        {/* Progress */}
        <Card style={{padding:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P}}>Wine Explorer — Level 3</span>
            <span style={{fontSize:10,color:C.cr,fontWeight:600,fontFamily:C.P}}>180/280 XP</span>
          </div>
          <Prog val={0.65} h={7}/>
          <div style={{fontSize:9,color:C.mid,fontFamily:C.P,marginTop:4}}>55 more XP to unlock "Connoisseur"</div>
        </Card>

        {/* API Key management */}
        <Card style={{padding:12}}>
          <div style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Scanning</div>
          {(()=>{
            const k=localStorage.getItem('vinterest_api_key');
            const isDemo=!k||k==='demo';
            return(
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:10,height:10,borderRadius:5,background:isDemo?'#E57373':C.green,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500,color:C.ink,fontFamily:C.P}}>{isDemo?'Demo Mode — no API key':'Claude Vision active'}</div>
                  <div style={{fontSize:9.5,color:C.mid,fontFamily:C.P}}>{isDemo?'Add Anthropic key to scan real labels':`Key: ${k?.slice(0,14)}...`}</div>
                </div>
                <div onClick={()=>{localStorage.removeItem('vinterest_api_key');window.location.reload();}} style={{padding:'6px 12px',borderRadius:8,background:C.offWhite,border:`1px solid ${C.line}`,cursor:'pointer'}}>
                  <span style={{fontSize:10,fontWeight:600,color:C.ink2,fontFamily:C.P}}>{isDemo?'Add Key':'Change'}</span>
                </div>
              </div>
            );
          })()}
        </Card>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

/* ── RESTAURANT SCREEN ── */
function RestaurantScreen({nav,back}){
  const [step,setStep]=React.useState(0); // 0=entry 1=setup 2=script
  const [budget,setBudget]=React.useState(1);
  const [foods,setFoods]=React.useState([0]);
  const foodItems=['Red Meat','Poultry','Seafood','Pasta','Salad','Cheese','Spicy Food'];
  const toggleFood=i=>setFoods(f=>f.includes(i)?f.filter(x=>x!==i):[...f,i]);

  if(step===2) return <RestaurantScript back={()=>setStep(1)}/>;

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={step>0?()=>setStep(s=>s-1):back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{step===0?'Restaurant Mode':'Your Preferences'}</span>
      </div>

      {step===0&&(
        <div style={{flex:1,overflowY:'auto',padding:'20px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:C.ink,borderRadius:20,padding:'20px',textAlign:'center'}}>
            <Icon n="fork" sz={32} col="rgba(255,255,255,0.5)" style={{margin:'0 auto 10px'}}/>
            <div style={{fontSize:16,fontWeight:700,color:'#fff',fontFamily:C.P}}>Dining Tonight?</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:C.P,marginTop:4}}>Get confident wine recommendations tailored to your meal and budget.</div>
          </div>
          {[
            {i:'camera',col:C.cr,t:'Scan Wine List',s:'Take a photo of the menu for instant picks',action:()=>setStep(1)},
            {i:'message',col:'#B06C00',t:'Quick Script',s:'No menu? Get a script to say to the sommelier',action:()=>setStep(1)},
          ].map((a,i)=>(
            <Card key={i} onClick={a.action} style={{display:'flex',alignItems:'center',gap:12,padding:14,cursor:'pointer'}}>
              <div style={{width:44,height:44,borderRadius:11,background:a.col+'12',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={a.i} sz={22} col={a.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P}}>{a.t}</div>
                <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>{a.s}</div>
              </div>
              <Icon n="chevron" sz={14} col={C.mid}/>
            </Card>
          ))}
        </div>
      )}

      {step===1&&(
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>Budget per bottle</div>
            <div style={{display:'flex',gap:8}}>
              {['$20–40','$40–70','$70–120','$120+'].map((b,i)=>(
                <div key={i} onClick={()=>setBudget(i)} style={{flex:1,padding:'10px 4px',borderRadius:10,border:`1.5px solid ${i===budget?C.cr:C.line}`,background:i===budget?C.crSoft:'#fff',textAlign:'center',cursor:'pointer'}}>
                  <div style={{fontSize:11,fontWeight:600,color:i===budget?C.cr:C.ink2,fontFamily:C.P}}>{b}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P,marginBottom:8}}>What are you eating?</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {foodItems.map((f,i)=>(
                <span key={i} onClick={()=>toggleFood(i)} style={{padding:'6px 12px',borderRadius:20,background:foods.includes(i)?C.cr:'#fff',color:foods.includes(i)?'#fff':C.mid,border:`1px solid ${foods.includes(i)?C.cr:C.line}`,fontSize:11,fontWeight:500,fontFamily:C.P,cursor:'pointer'}}>{f}</span>
              ))}
            </div>
          </div>
          <div style={{flex:1}}/>
          <Btn primary full onClick={()=>setStep(2)}>Get Recommendations</Btn>
          <div style={{height:8}}/>
        </div>
      )}
    </div>
  );
}

function RestaurantScript({back}){
  const copied=React.useRef(false);
  const [c,setC]=React.useState(false);
  const script='"I\'m looking for a full-bodied red in the $40–70 range. I typically enjoy wines with earthy notes and structured tannins — Bordeaux blends are a favourite. I\'m having the steak tonight. What would you recommend?"';
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your Script</span>
        <div style={{flex:1}}/>
        <Icon n="share" sz={18} col={C.mid}/>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{background:C.crSoft,border:`1.5px solid ${C.crDim}`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
            <Icon n="message" sz={16} col={C.cr}/>
            <span style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P}}>Say This to Your Server</span>
          </div>
          <div style={{fontSize:12,color:C.ink2,fontFamily:C.P,lineHeight:1.6,fontStyle:'italic',marginBottom:10}}>{script}</div>
          <Btn primary small onClick={()=>{try{navigator.clipboard.writeText(script.replace(/"/g,''));setC(true);setTimeout(()=>setC(false),2000)}catch(e){}}}
            style={{width:'100%'}}>{c?'Copied!':'Copy Script'}</Btn>
        </Card>
        <div style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P}}>Best Matches on This List</div>
        {[{name:'Clos du Val Cabernet',sub:'Napa Valley · $58',score:96,note:'Best match · In your budget'},
          {name:'Barolo Giacomo Conterno',sub:'Piedmont · $65',score:91,note:'Try something new — similar style'},
          {name:'Sancerre Henri Bourgeois',sub:'Loire Valley · $42',score:82,note:'White option · Pairs with seafood'}].map((w,i)=>(
          <Card key={i} style={{padding:10}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:32,height:44,borderRadius:4,background:C.crSoft,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <Icon n="wine" sz={14} col={C.cr}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P}}>{w.name}</div>
                <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>{w.sub}</div>
              </div>
              <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3}}>
                <div style={{display:'inline-flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:7,background:C.greenBg}}>
                  <span style={{fontSize:11,fontWeight:700,color:C.green,fontFamily:C.P}}>{w.score}%</span>
                </div>
              </div>
            </div>
            <div style={{fontSize:9,color:i===0?C.green:C.cr,fontFamily:C.P,marginTop:5,paddingLeft:42,fontWeight:500}}>{w.note}</div>
          </Card>
        ))}
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

/* ── LEARN SCREEN ── */
function LearnScreen({nav,back}){
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>Learn</span>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <Icon n="flame" sz={16} col="#E8A838"/>
          <span style={{fontSize:13,fontWeight:700,color:'#E8A838',fontFamily:C.P}}>5</span>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <Card style={{background:C.crSoft,border:`1px solid ${C.crDim}`,padding:14}}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:42,height:42,borderRadius:21,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="trophy" sz={20} col="#fff"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P}}>Wine Explorer — Level 3</div>
              <Prog val={0.65} h={5} style={{marginTop:5}}/>
              <div style={{fontSize:9,color:C.mid,fontFamily:C.P,marginTop:3}}>180 / 280 XP — 55 XP to "Connoisseur"</div>
            </div>
          </div>
        </Card>
        <Card style={{background:'#FFF8E1',border:'1px solid #F5E6B8',padding:12}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:9,background:'#E8A838',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="star" sz={18} col="#fff"/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:C.ink,fontFamily:C.P}}>Daily Challenge</div>
              <div style={{fontSize:10,color:C.mid,fontFamily:C.P}}>Can you name the 5 Bordeaux grapes?</div>
            </div>
            <Btn primary small style={{background:'#E8A838',boxShadow:'none',whiteSpace:'nowrap'}}>Start</Btn>
          </div>
        </Card>
        <div style={{fontSize:11,fontWeight:600,color:C.ink,fontFamily:C.P}}>Topics</div>
        {[{t:'Red Grapes',p:.8,col:'#8B1A2F',n:'8/10'},{t:'White Grapes',p:.5,col:'#B8963E',n:'5/10'},{t:'French Regions',p:.3,col:'#3D6B3D',n:'3/10'},{t:'Tasting Technique',p:.1,col:'#5E8FA8',n:'1/10'},{t:'Food Pairing',p:0,col:'#E8A838',n:'0/8',locked:true}].map((tp,i)=>(
          <Card key={i} style={{padding:10,opacity:tp.locked?.5:1}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{width:36,height:36,borderRadius:9,background:tp.col+'18',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <Icon n={tp.locked?'lock':'book'} sz={16} col={tp.col}/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:12,fontWeight:600,color:C.ink,fontFamily:C.P}}>{tp.t}</span>
                  <span style={{fontSize:9,fontWeight:600,color:tp.col,fontFamily:C.P}}>{tp.locked?'Locked':'+20 XP'}</span>
                </div>
                <Prog val={tp.p} col={tp.col} h={4} style={{marginTop:4}}/>
                <span style={{fontSize:9,color:C.mid,fontFamily:C.P}}>{tp.n} lessons</span>
              </div>
            </div>
          </Card>
        ))}
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

Object.assign(window,{TasteProfileScreen,RestaurantScreen,LearnScreen});
