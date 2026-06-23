/* Vinterest — New User Flow: Onboarding questions (post-signup, minimal) */

function OnboardQuestions({next,onAnswers}){
  const [step,setStep]=React.useState(0);
  const [answers,setAnswers]=React.useState({});

  // Currency + budget bands follow the country chosen in the location step (asked before budget).
  const CURRENCIES={
    'United Kingdom':{sym:'£',code:'GBP',bands:['Under £12','£12 – £25','£25 – £50','£50+']},
    'United States' :{sym:'$',code:'USD',bands:['Under $15','$15 – $30','$30 – $60','$60+']},
    'Canada'        :{sym:'$',code:'CAD',bands:['Under $20','$20 – $40','$40 – $70','$70+']},
    'Australia'     :{sym:'$',code:'AUD',bands:['Under $20','$20 – $40','$40 – $70','$70+']},
    'France'        :{sym:'€',code:'EUR',bands:['Under €12','€12 – €30','€30 – €60','€60+']},
    'Germany'       :{sym:'€',code:'EUR',bands:['Under €12','€12 – €30','€30 – €60','€60+']},
    'Italy'         :{sym:'€',code:'EUR',bands:['Under €12','€12 – €30','€30 – €60','€60+']},
    'Spain'         :{sym:'€',code:'EUR',bands:['Under €12','€12 – €30','€30 – €60','€60+']},
    'Other'         :{sym:'$',code:'USD',bands:['Under $15','$15 – $30','$30 – $60','$60+']},
  };
  const cur=CURRENCIES[(answers.location&&answers.location.country)||'']||CURRENCIES['Other'];
  const budgetDescs=['Everyday value','A reliable step up','Something special','Going all out'];
  const budgetOpts=cur.bands.map((b,i)=>({id:['value','mid','premium','splurge'][i],label:b,d:budgetDescs[i]}));

  // Address fields depend on the country (UK: city only · US: state+city · Canada: province+city · etc.)
  const LOC_FIELDS=(country)=>{
    if(!country) return [];
    if(country==='United States')  return [{k:'region',label:'State',ph:'e.g. California'},{k:'city',label:'City',ph:'e.g. San Francisco'}];
    if(country==='Canada')         return [{k:'region',label:'Province',ph:'e.g. Ontario'},{k:'city',label:'City',ph:'e.g. Toronto'}];
    if(country==='Australia')      return [{k:'region',label:'State / Territory',ph:'e.g. Victoria'},{k:'city',label:'City',ph:'e.g. Melbourne'}];
    if(country==='United Kingdom') return [{k:'city',label:'City / Town',ph:'e.g. Manchester'}];
    return [{k:'city',label:'City',ph:'e.g. your city'}]; // France / Germany / Italy / Spain / Other
  };

  const QS=[
    { key:'types', multi:true, title:'What do you drink?', sub:'Pick any — or all of them.',
      opts:[
        {id:'red',label:'Red',icon:'wine',col:'#8B1A2F'},
        {id:'white',label:'White',icon:'wine',col:'#B8963E'},
        {id:'rose',label:'Rosé',icon:'wine',col:'#C47A8A'},
        {id:'sparkling',label:'Sparkling',icon:'wine',col:'#5E8FA8'},
      ],
    },
    { key:'experience', multi:false, title:'How well do you know wine?', sub:'No wrong answer — it just tunes the depth.',
      opts:[
        {id:'novice',label:'Just getting started',d:'Keep it simple and clear'},
        {id:'casual',label:'I know what I like',d:'A little more detail'},
        {id:'enthusiast',label:'Pretty into it',d:'Bring on the nuance'},
        {id:'expert',label:'Borderline obsessed',d:'Full depth, no hand-holding'},
      ],
    },
    { key:'frequency', multi:false, title:'How often do you drink wine?', sub:'No judgement — we’ll never tell.',
      opts:[
        {id:'daily',label:'Most days'},
        {id:'weekly',label:'A few times a week'},
        {id:'occasion',label:'Weekends & occasions'},
        {id:'rarely',label:'Now and then'},
      ],
    },
    { key:'location', type:'location', title:'Where are you based?', sub:'So we can show where to buy — and price everything in your local currency.' },
    { key:'budget', multi:false, title:'Typical spend per bottle?', sub:`We’ll point you to the sweet spot in ${cur.sym}.`,
      opts:budgetOpts,
    },
    { key:'goals', multi:true, title:'What are you here for?', sub:'Pick all that apply.',
      opts:[
        {id:'learn',label:'Learn about wine',icon:'book',col:'#1E7B4B'},
        {id:'value',label:'Find great value',icon:'cart',col:'#B06C00'},
        {id:'pair',label:'Pair with food',icon:'fork',col:'#8B1A2F'},
        {id:'impress',label:'Impress at dinner',icon:'trophy',col:'#3B6FB0'},
      ],
    },
  ];
  const q=QS[step];
  const isLoc=q.type==='location';
  const sel=answers[q.key]||(isLoc?{}:(q.multi?[]:null));
  const hasAnswer=isLoc?!!sel.country:(q.multi?sel.length>0:!!sel);

  function choose(id){
    setAnswers(a=>{
      if(q.multi){
        const cur=a[q.key]||[];
        return {...a,[q.key]:cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]};
      }
      return {...a,[q.key]:id};
    });
  }
  function setLoc(field,val){
    setAnswers(a=>({...a,[q.key]:{...(a[q.key]||{}),[field]:val}}));
  }
  function advance(){ if(step<QS.length-1){ setStep(step+1); } else { if(onAnswers){ onAnswers(answers); } else { next(); } } }
  function isSel(id){ return q.multi?sel.includes(id):sel===id; }

  const COUNTRIES=['United States','Canada','United Kingdom','Australia','France','Germany','Italy','Spain','Other'];

  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* header: progress + back */}
      <div style={{padding:'calc(env(safe-area-inset-top) + 16px) 22px 8px',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:18}}>
          <div onClick={()=>step>0?setStep(step-1):null} style={{opacity:step>0?1:0.25,cursor:step>0?'pointer':'default',padding:4,marginLeft:-4}}>
            <Icon n="back" sz={22} col={C.ink}/>
          </div>
          <div style={{flex:1,display:'flex',gap:5}}>
            {QS.map((_,i)=>(
              <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<=step?C.cr:C.line,transition:'background .3s'}}></div>
            ))}
          </div>
          <span onClick={next} style={{fontSize:14,color:C.mid,fontFamily:C.P,fontWeight:500,cursor:'pointer'}}>Skip</span>
        </div>
      </div>

      {/* question */}
      <div style={{flex:1,overflowY:'auto',padding:'8px 22px 16px'}}>
        <div style={{fontSize:26,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.5px',lineHeight:1.15,marginBottom:q.sub?6:22}}>{q.title}</div>
        {q.sub&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:22,lineHeight:1.45}}>{q.sub}</div>}

        {isLoc?(
          /* ── Location fields ── */
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginBottom:7}}>Country</div>
              <div style={{position:'relative'}}>
                <select value={sel.country||''} onChange={e=>setLoc('country',e.target.value)}
                  style={{width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:`1px solid ${sel.country?C.cr:C.line}`,background:C.white,fontSize:15.5,fontFamily:C.P,color:sel.country?C.ink:C.mid,outline:'none',appearance:'none',WebkitAppearance:'none',cursor:'pointer'}}>
                  <option value="" disabled>Select your country</option>
                  {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <div style={{position:'absolute',right:16,top:'50%',transform:'translateY(-50%)',pointerEvents:'none'}}>
                  <Icon n="chevron" sz={15} col={C.mid} style={{transform:'rotate(90deg)'}}/>
                </div>
              </div>
            </div>
            {LOC_FIELDS(sel.country).map(f=>(
              <div key={f.k}>
                <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginBottom:7}}>{f.label}</div>
                <input value={sel[f.k]||''} onChange={e=>setLoc(f.k,e.target.value)} placeholder={f.ph}
                  style={{width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:`1px solid ${C.line}`,background:C.white,fontSize:15.5,fontFamily:C.P,color:C.ink,outline:'none'}}/>
              </div>
            ))}
            {sel.country&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>Prices and retailers will show in {cur.sym} ({cur.code}).</div>}
          </div>
        ):(
          /* ── Option rows ── */
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {q.opts.map(opt=>{
              const on=isSel(opt.id);
              return(
                <div key={opt.id} onClick={()=>choose(opt.id)}
                  style={{display:'flex',alignItems:'center',gap:13,padding:'15px 16px',borderRadius:14,minWidth:0,
                    border:`2px solid ${on?C.cr:C.line}`,background:on?C.crSoft:C.white,cursor:'pointer',transition:'all .14s'}}>
                  {opt.emoji&&<span style={{fontSize:23,flexShrink:0}}>{opt.emoji}</span>}
                  {opt.icon&&<Icon n={opt.icon} sz={22} col={opt.col||C.mid} style={{flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:opt.d?16:15.5,fontWeight:on?700:600,color:on?C.cr:C.ink,fontFamily:C.P,lineHeight:1.2}}>{opt.label}</div>
                    {opt.d&&<div style={{fontSize:13.5,color:on?C.crL:C.mid,fontFamily:C.P,marginTop:3,lineHeight:1.35}}>{opt.d}</div>}
                  </div>
                  {q.multi
                    ? <div style={{width:22,height:22,borderRadius:7,border:`2px solid ${on?C.cr:C.line}`,background:on?C.cr:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{on&&<Icon n="check" sz={12} col="#fff"/>}</div>
                    : (on&&<div style={{width:22,height:22,borderRadius:11,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n="check" sz={12} col="#fff"/></div>)
                  }
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* continue */}
      <div style={{padding:'12px 24px 42px',flexShrink:0,background:C.white,borderTop:`1px solid ${C.line}`}}>
        <div onClick={hasAnswer?advance:null}
          style={{background:hasAnswer?C.cr:'#C9C9C9',borderRadius:14,padding:'16px',textAlign:'center',cursor:hasAnswer?'pointer':'default',
            boxShadow:hasAnswer?`0 8px 26px ${C.cr}45`:'none',transition:'all .2s'}}>
          <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>{step<QS.length-1?'Continue':'Finish setup'}</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{OnboardQuestions});
