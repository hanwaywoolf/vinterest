/* Vinterest — New User Flow: setup (age + location) and the three taste questions.
   Only questions the app uses: see UserPrefs in pwa-prefs.js for what each answer drives. */

function OnboardHeader({step,total,onBack,onSkip}){
  return(
    <div style={{padding:'calc(env(safe-area-inset-top) + 16px) 22px 8px',flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <div onClick={onBack||undefined} style={{opacity:onBack?1:0.25,cursor:onBack?'pointer':'default',padding:4,marginLeft:-4}}>
          <Icon n="back" sz={22} col={C.ink}/>
        </div>
        <div style={{flex:1,display:'flex',gap:5}}>
          {Array.from({length:total}).map((_,i)=>(
            <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<=step?C.cr:C.line,transition:'background .3s'}}></div>
          ))}
        </div>
        {onSkip?<span onClick={onSkip} style={{fontSize:14,color:C.mid,fontFamily:C.P,fontWeight:500,cursor:'pointer'}}>Skip</span>:<span style={{width:28}}/>}
      </div>
    </div>
  );
}

function OnboardFooter({label,enabled,onClick,note}){
  return(
    <div style={{padding:'12px 24px 36px',flexShrink:0,background:C.white,borderTop:`1px solid ${C.line}`}}>
      <div onClick={enabled?onClick:undefined} role="button" aria-disabled={!enabled}
        style={{background:enabled?C.cr:'#C9C9C9',borderRadius:14,padding:'16px',textAlign:'center',cursor:enabled?'pointer':'default',boxShadow:enabled?`0 8px 26px ${C.cr}45`:'none',transition:'all .2s'}}>
        <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>{label}</span>
      </div>
      {note&&<div style={{textAlign:'center',marginTop:10,fontSize:13,color:C.mid,fontFamily:C.P}}>{note}</div>}
    </div>
  );
}

/* ── Step 1: legal drinking age + where they buy wine (sets prices and currency) ── */
function OnboardSetup({step,total,onBack,onDone}){
  const [age,setAge]=React.useState(UserPrefs.ageConfirmed());
  const [underage,setUnderage]=React.useState(false);
  const [country,setCountry]=React.useState(()=>UserPrefs.location().country||UserPrefs.guessCountry()||'');
  const [state,setState]=React.useState(()=>UserPrefs.location().state||'');
  const c=UserPrefs.country(country);
  const cur=c?HOME_REGION_CURRENCY[c.region]:null;
  const ready=age&&!!c;
  function done(){ UserPrefs.confirmAge(); UserPrefs.setLocation({country,state}); onDone(); }
  const field={width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:`1px solid ${C.line}`,background:C.white,fontSize:16,fontFamily:C.P,color:C.ink,outline:'none'};

  if(underage) return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:32,textAlign:'center',gap:12}}>
      <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P}}>Sorry, not yet</div>
      <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Vinterest is only for people of legal drinking age where they live.</div>
      <span onClick={()=>setUnderage(false)} style={{fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer',marginTop:8}}>Go back</span>
    </div>
  );

  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <OnboardHeader step={step} total={total} onBack={onBack}/>
      <div style={{flex:1,overflowY:'auto',padding:'8px 22px 16px',display:'flex',flexDirection:'column',gap:22}}>
        <div>
          <div style={{fontSize:26,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',lineHeight:1.15}}>Two quick checks</div>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginTop:6,lineHeight:1.45}}>Then you'll scan your first bottle.</div>
        </div>

        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Your age</div>
          <div onClick={()=>setAge(a=>!a)} role="checkbox" aria-checked={age}
            style={{display:'flex',alignItems:'center',gap:12,padding:'15px 16px',borderRadius:14,border:`2px solid ${age?C.cr:C.line}`,background:age?C.crSoft:C.white,cursor:'pointer'}}>
            <div style={{width:24,height:24,borderRadius:7,border:`2px solid ${age?C.cr:C.line}`,background:age?C.cr:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{age&&<Icon n="check" sz={13} col="#fff"/>}</div>
            <span style={{fontSize:16,fontWeight:600,color:C.ink,fontFamily:C.P,lineHeight:1.35}}>I'm of legal drinking age where I live</span>
          </div>
          <span onClick={()=>setUnderage(true)} style={{display:'inline-block',marginTop:8,fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>I'm not</span>
        </div>

        <div>
          <div style={{fontSize:13,fontWeight:700,color:C.mid,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Where you buy wine</div>
          <div style={{position:'relative'}}>
            <select value={country} onChange={e=>setCountry(e.target.value)} aria-label="Country"
              style={{...field,border:`1px solid ${c?C.cr:C.line}`,color:c?C.ink:C.mid,appearance:'none',WebkitAppearance:'none'}}>
              <option value="" disabled>Select your country</option>
              {UserPrefs.COUNTRIES.map(x=><option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
            <div style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}><Icon n="chevron" sz={15} col={C.mid} style={{transform:'rotate(90deg)'}}/></div>
          </div>
          {c&&c.stateLabel&&<input value={state} onChange={e=>setState(e.target.value)} placeholder={`${c.stateLabel} (optional)`} aria-label={c.stateLabel} style={{...field,marginTop:10}}/>}
          {cur&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.45,marginTop:8}}>Prices will show in {cur.sym} ({cur.code}). Travelling? Turn on Travel Mode in your profile.</div>}
        </div>
      </div>
      <OnboardFooter label="Continue" enabled={ready} onClick={done} note="No account needed. Your wines stay on this device."/>
    </div>
  );
}

/* ── Steps 3–5: what they drink, what they spend, how well they know wine ── */
function OnboardTaste({step,total,onBack,onDone,scanned}){
  const [q,setQ]=React.useState(0);
  const [answers,setAnswers]=React.useState(()=>{ const p=UserPrefs.get(); return {types:p.types||[],budget:p.budget||null,experience:p.experience||null}; });
  const TYPE_OPTS=[
    {id:'red',label:'Red',col:'#8B1A2F'},{id:'white',label:'White',col:'#B8963E'},{id:'rose',label:'Rosé',col:'#C47A8A'},
    {id:'sparkling',label:'Sparkling',col:'#5E8FA8'},{id:'orange',label:'Orange',col:'#C1652B'},{id:'dessert',label:'Dessert',col:'#8A5A2B'},{id:'fortified',label:'Fortified',col:'#5C2A1E'}];
  const QS=[
    {key:'types',multi:true,title:'What do you usually drink?',sub:'Your first pick is what Home and WineDNA open on.',
      opts:TYPE_OPTS.map(o=>({id:o.id,label:o.label,col:o.col}))},
    {key:'budget',title:'What do you usually spend on a bottle?',sub:'Until you\'ve scored a few wines, this is the price range we suggest around.',
      opts:UserPrefs.budgetOptions().map(o=>({id:o.id,label:o.label,d:o.note}))},
    {key:'experience',title:'How well do you know wine?',sub:'This sets where Learn starts and how deep it goes.',
      opts:UserPrefs.EXPERIENCE.map(o=>({id:o.id,label:o.label,d:o.note}))},
  ];
  const Q=QS[q];
  const sel=answers[Q.key];
  const has=Q.multi?sel.length>0:!!sel;
  function choose(id){
    setAnswers(a=>({...a,[Q.key]:Q.multi?(a[Q.key].includes(id)?a[Q.key].filter(x=>x!==id):[...a[Q.key],id]):id}));
  }
  function saveAll(a){ Object.entries(a).forEach(([k,v])=>{ if(Array.isArray(v)?v.length:v) UserPrefs.set(k,v); }); }
  function advance(){ if(q<QS.length-1) setQ(q+1); else { saveAll(answers); onDone(); } }
  const on=id=>Q.multi?sel.includes(id):sel===id;
  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <OnboardHeader step={step+q} total={total} onBack={q>0?()=>setQ(q-1):onBack} onSkip={()=>{ saveAll(answers); onDone(); }}/>
      <div style={{flex:1,overflowY:'auto',padding:'8px 22px 16px'}}>
        {scanned&&q===0&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:12,background:C.greenBg,border:`1px solid ${C.green}30`,marginBottom:18}}>
          <Icon n="check" sz={16} col={C.green}/>
          <span style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.4}}><b>{scanned.name}</b> is saved in My Wines.</span>
        </div>}
        <div style={{fontSize:26,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',lineHeight:1.15}}>{Q.title}</div>
        <div style={{fontSize:15,color:C.mid,fontFamily:C.P,margin:'6px 0 20px',lineHeight:1.45}}>{Q.sub}</div>
        <div style={Q.multi?{display:'flex',flexWrap:'wrap',gap:10}:{display:'flex',flexDirection:'column',gap:10}}>
          {Q.opts.map(opt=>(
            <div key={opt.id} onClick={()=>choose(opt.id)} role={Q.multi?'checkbox':'radio'} aria-checked={on(opt.id)}
              style={{display:'flex',alignItems:'center',gap:10,padding:Q.multi?'12px 16px':'15px 16px',borderRadius:14,border:`2px solid ${on(opt.id)?(opt.col||C.cr):C.line}`,
                background:on(opt.id)?(opt.col||C.cr)+'14':C.white,cursor:'pointer',transition:'all .14s'}}>
              {opt.col&&<span style={{width:12,height:12,borderRadius:6,background:opt.col,flexShrink:0}}/>}
              <div style={{flex:Q.multi?'none':1,minWidth:0}}>
                <div style={{fontSize:16,fontWeight:on(opt.id)?700:600,color:C.ink,fontFamily:C.P,lineHeight:1.2}}>{opt.label}</div>
                {opt.d&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,marginTop:3,lineHeight:1.35}}>{opt.d}</div>}
              </div>
              {!Q.multi&&on(opt.id)&&<div style={{width:22,height:22,borderRadius:11,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="check" sz={12} col="#fff"/></div>}
            </div>
          ))}
        </div>
      </div>
      <OnboardFooter label={q<QS.length-1?'Continue':'Start exploring'} enabled={has} onClick={advance}/>
    </div>
  );
}

Object.assign(window,{OnboardSetup,OnboardTaste});
