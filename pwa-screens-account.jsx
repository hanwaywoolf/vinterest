/* Vinterest — Account / Profile screen: onboarding summary (editable) + Travel Mode */

const ACC_TYPE_OPTS=[{id:'red',label:'Red',col:'#8B1A2F'},{id:'white',label:'White',col:'#B8963E'},{id:'rose',label:'Rosé',col:'#C47A8A'},{id:'sparkling',label:'Sparkling',col:'#5E8FA8'},{id:'orange',label:'Orange',col:'#C1652B'},{id:'dessert',label:'Dessert',col:'#8A5A2B'},{id:'fortified',label:'Fortified',col:'#5C2A1E'}];
const ACC_EXP_OPTS=[{id:'novice',label:'Just getting started'},{id:'casual',label:'I know what I like'},{id:'enthusiast',label:'Pretty into it'},{id:'expert',label:'Borderline obsessed'}];
const ACC_FREQ_OPTS=[{id:'daily',label:'Most days'},{id:'weekly',label:'A few times a week'},{id:'occasion',label:'Weekends & occasions'},{id:'rarely',label:'Now and then'}];
const ACC_GOAL_OPTS=[{id:'learn',label:'Learn about wine',icon:'book',col:'#1E7B4B'},{id:'value',label:'Find great value',icon:'cart',col:'#B06C00'},{id:'pair',label:'Pair with food',icon:'fork',col:'#8B1A2F'},{id:'impress',label:'Impress at dinner',icon:'trophy',col:'#3B6FB0'}];
const ACC_COUNTRIES=['United States','Canada','United Kingdom','Australia','France','Germany','Italy','Spain','Other'];
const ACC_COUNTRY_TO_REGION={'united states':'us','canada':'ontario','united kingdom':'uk','australia':'australia','new zealand':'nz','france':'eu','germany':'eu','italy':'eu','spain':'eu'};
const ACC_COUNTRY_TO_CUR={'united states':'USD','canada':'CAD','united kingdom':'GBP','australia':'AUD','new zealand':'NZD','france':'EUR','germany':'EUR','italy':'EUR','spain':'EUR'};

function AccSection({title,children,onEdit,editing}){
  return(
    <Card style={{padding:14}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
        <span style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>{title}</span>
        {onEdit&&<span onClick={onEdit} style={{fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{editing?'Done':'Edit'}</span>}
      </div>
      {children}
    </Card>
  );
}

function AccChips({opts,sel,editing,onToggle}){
  const active=Array.isArray(sel)?sel:(sel?[sel]:[]);
  if(!editing){
    return active.length
      ?<div style={{display:'flex',flexWrap:'wrap',gap:6}}>{active.map(id=>{const o=opts.find(x=>x.id===id);return o?<Pill key={id} active sm>{o.label}</Pill>:null;})}</div>
      :<div style={{fontSize:14,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>Not set</div>;
  }
  return(
    <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
      {opts.map(o=>{
        const on=active.includes(o.id);
        return(
          <div key={o.id} onClick={()=>onToggle(o.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 12px',borderRadius:10,border:`1.5px solid ${on?C.cr:C.line}`,background:on?C.crSoft:C.white,cursor:'pointer'}}>
            {o.icon&&<Icon n={o.icon} sz={14} col={o.col||C.mid}/>}
            <span style={{fontSize:14,fontWeight:on?700:500,color:on?C.cr:C.ink2,fontFamily:C.P}}>{o.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function AccountProfileScreen({nav,back}){
  const [prefs,setPrefs]=React.useState(()=>{try{return JSON.parse(localStorage.getItem('vinterest_prefs')||'{}');}catch(e){return {};}});
  const [editSection,setEditSection]=React.useState(null);
  const [country,setCountry]=React.useState(()=>localStorage.getItem('vinterest_country')||'');
  const [region,setRegionField]=React.useState(()=>localStorage.getItem('vinterest_state')||'');
  const [city,setCity]=React.useState(()=>localStorage.getItem('vinterest_city')||'');

  const [travel,setTravelState]=React.useState(()=>Regional.travel());
  const [travelForm,setTravelForm]=React.useState({country:'',until:'',code:''});
  const [travelEditing,setTravelEditing]=React.useState(false);

  function refreshTravel(){ setTravelState(Regional.travel()); }
  React.useEffect(()=>{
    const h=()=>refreshTravel();
    window.addEventListener('vinterest:travel',h);
    return()=>window.removeEventListener('vinterest:travel',h);
  },[]);

  function savePrefField(key,val){
    setPrefs(p=>{const np={...p,[key]:val};localStorage.setItem('vinterest_prefs',JSON.stringify(np));return np;});
  }
  function toggleMulti(key,id){
    const cur=prefs[key]||[];
    const next=cur.includes(id)?cur.filter(x=>x!==id):[...cur,id];
    savePrefField(key,next);
  }

  function saveLocation(){
    localStorage.setItem('vinterest_country',country);
    localStorage.setItem('vinterest_state',region);
    localStorage.setItem('vinterest_city',city);
    savePrefField('location',{country,region,city});
    const k=country.trim().toLowerCase();
    localStorage.setItem('vinterest_region',ACC_COUNTRY_TO_REGION[k]||'us');
    localStorage.setItem('vinterest_currency',ACC_COUNTRY_TO_CUR[k]||'USD');
    setEditSection(null);
  }

  function enableTravel(){
    if(!travelForm.country.trim()) return;
    Regional.setTravel(travelForm.country,travelForm.until,travelForm.code||null);
    refreshTravel();
    setTravelEditing(false);
    setTravelForm({country:'',until:'',code:''});
  }
  function disableTravel(){ Regional.disableTravel(); refreshTravel(); }

  const home=Regional.home();

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',background:C.bg,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 20px',background:C.white,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <span style={{fontSize:20,fontWeight:700,color:C.ink,fontFamily:C.P,flex:1}}>Profile</span>
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'14px 20px',display:'flex',flexDirection:'column',gap:12}}>

        {/* Travel Mode */}
        <Card style={{padding:14,border:travel?`1.5px solid ${C.cr}`:`1px solid ${C.line}`}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:38,height:38,borderRadius:19,background:travel?C.crSoft:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <Icon n="compass" sz={19} col={travel?C.cr:C.mid}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Travel Mode</div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{travel?`On — ${travel.country} (${travel.code})`:'Temporarily price in a different currency'}</div>
            </div>
            <div onClick={()=>travel?disableTravel():setTravelEditing(e=>!e)} style={{width:46,height:27,borderRadius:14,background:travel?C.cr:C.line,position:'relative',cursor:'pointer',flexShrink:0,transition:'background .15s'}}>
              <div style={{position:'absolute',top:2,left:travel?21:2,width:23,height:23,borderRadius:12,background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.25)',transition:'left .15s'}}/>
            </div>
          </div>
          {travel&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.line}`,fontSize:13,color:C.mid,fontFamily:C.P}}>
              {travel.until?`Turns off automatically on ${travel.until}`:'On until you turn it off'} · prices show in {travel.sym}
            </div>
          )}
          {!travel&&travelEditing&&(
            <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.line}`,display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginBottom:6}}>Where are you travelling to?</div>
                <input value={travelForm.country} onChange={e=>setTravelForm(f=>({...f,country:e.target.value}))} placeholder="e.g. United States"
                  style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none'}}/>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginBottom:6}}>Currency</div>
                <select value={travelForm.code||(lookupCountryCurrency(travelForm.country)||{}).code||''} onChange={e=>setTravelForm(f=>({...f,code:e.target.value}))}
                  style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none',appearance:'none',WebkitAppearance:'none'}}>
                  {CURRENCY_LIST.map(c=><option key={c.code} value={c.code}>{c.code} ({c.sym})</option>)}
                </select>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.ink2,fontFamily:C.P,marginBottom:6}}>Return date (optional)</div>
                <input type="date" value={travelForm.until} onChange={e=>setTravelForm(f=>({...f,until:e.target.value}))}
                  style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none'}}/>
                <div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:5}}>Leave blank to turn it off manually.</div>
              </div>
              <Btn primary full onClick={enableTravel}>Enable Travel Mode</Btn>
            </div>
          )}
        </Card>

        {/* Home location */}
        <AccSection title="Home Location" onEdit={()=>setEditSection(editSection==='loc'?null:'loc')} editing={editSection==='loc'}>
          {editSection==='loc'?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <select value={country} onChange={e=>setCountry(e.target.value)} style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none',appearance:'none',WebkitAppearance:'none'}}>
                <option value="" disabled>Select country</option>
                {ACC_COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <input value={region} onChange={e=>setRegionField(e.target.value)} placeholder="State / Province (optional)"
                style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none'}}/>
              <input value={city} onChange={e=>setCity(e.target.value)} placeholder="City"
                style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none'}}/>
              <Btn primary full onClick={saveLocation}>Save</Btn>
            </div>
          ):(
            <div style={{fontSize:15,color:C.ink,fontFamily:C.P}}>
              {[city,region,country].filter(Boolean).join(', ')||'Not set'}
              <div style={{fontSize:13,color:C.mid,marginTop:4}}>Home currency: {home.sym} ({home.code})</div>
            </div>
          )}
        </AccSection>

        {/* Wine types */}
        <AccSection title="What You Drink" onEdit={()=>setEditSection(editSection==='types'?null:'types')} editing={editSection==='types'}>
          <AccChips opts={ACC_TYPE_OPTS} sel={prefs.types||[]} editing={editSection==='types'} onToggle={id=>toggleMulti('types',id)}/>
        </AccSection>

        {/* Experience */}
        <AccSection title="Wine Knowledge" onEdit={()=>setEditSection(editSection==='experience'?null:'experience')} editing={editSection==='experience'}>
          {editSection==='experience'
            ?<AccChips opts={ACC_EXP_OPTS} sel={prefs.experience} editing onToggle={id=>savePrefField('experience',id)}/>
            :<div style={{fontSize:15,color:C.ink,fontFamily:C.P}}>{(ACC_EXP_OPTS.find(o=>o.id===prefs.experience)||{}).label||'Not set'}</div>}
        </AccSection>

        {/* Frequency */}
        <AccSection title="How Often You Drink" onEdit={()=>setEditSection(editSection==='frequency'?null:'frequency')} editing={editSection==='frequency'}>
          {editSection==='frequency'
            ?<AccChips opts={ACC_FREQ_OPTS} sel={prefs.frequency} editing onToggle={id=>savePrefField('frequency',id)}/>
            :<div style={{fontSize:15,color:C.ink,fontFamily:C.P}}>{(ACC_FREQ_OPTS.find(o=>o.id===prefs.frequency)||{}).label||'Not set'}</div>}
        </AccSection>

        {/* Goals */}
        <AccSection title="Why You're Here" onEdit={()=>setEditSection(editSection==='goals'?null:'goals')} editing={editSection==='goals'}>
          <AccChips opts={ACC_GOAL_OPTS} sel={prefs.goals||[]} editing={editSection==='goals'} onToggle={id=>toggleMulti('goals',id)}/>
        </AccSection>

        <div onClick={()=>nav('settings')} style={{padding:'14px 4px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
          <span style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P}}>Settings</span>
          <Icon n="chevron" sz={14} col={C.mid}/>
        </div>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

Object.assign(window,{AccountProfileScreen});
