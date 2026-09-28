/* Vinterest — Account / Profile screen: onboarding summary (editable) + Travel Mode */

const ACC_TYPE_OPTS=[{id:'red',label:'Red',col:'#8B1A2F'},{id:'white',label:'White',col:'#B8963E'},{id:'rose',label:'Rosé',col:'#C47A8A'},{id:'sparkling',label:'Sparkling',col:'#5E8FA8'},{id:'orange',label:'Orange',col:'#C1652B'},{id:'dessert',label:'Dessert',col:'#8A5A2B'},{id:'fortified',label:'Fortified',col:'#5C2A1E'}];
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

function AccountProfileScreen({nav,back,showPro}){
  const [prefs,setPrefs]=React.useState(()=>UserPrefs.get());
  const [editSection,setEditSection]=React.useState(null);
  const [country,setCountry]=React.useState(()=>UserPrefs.location().country||'');
  const [region,setRegionField]=React.useState(()=>UserPrefs.location().state||'');

  const [travel,setTravelState]=React.useState(()=>Regional.travel());
  const [travelForm,setTravelForm]=React.useState({country:'',until:'',code:''});
  const [travelEditing,setTravelEditing]=React.useState(false);

  function refreshTravel(){ setTravelState(Regional.travel()); }
  React.useEffect(()=>{
    const h=()=>refreshTravel();
    window.addEventListener('vinterest:travel',h);
    return()=>window.removeEventListener('vinterest:travel',h);
  },[]);

  function savePrefField(key,val){ setPrefs(UserPrefs.set(key,val)); }
  function toggleMulti(key,id){
    const cur=prefs[key]||[];
    savePrefField(key,cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);
  }
  function saveLocation(){ UserPrefs.setLocation({country,state:region}); setEditSection(null); }

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

        <AccountCard showPro={showPro}/>

        <BackupCard/>

        <InstallCard/>

        <TextSizeControl/>

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

        {/* Each preference says what it changes: only answers the app uses are asked or shown. */}
        <AccSection title="Where You Buy Wine" onEdit={()=>setEditSection(editSection==='loc'?null:'loc')} editing={editSection==='loc'}>
          {editSection==='loc'?(
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <select value={country} onChange={e=>setCountry(e.target.value)} aria-label="Country" style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none',appearance:'none',WebkitAppearance:'none'}}>
                <option value="" disabled>Select country</option>
                {UserPrefs.COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
              {(UserPrefs.country(country)||{}).stateLabel&&<input value={region} onChange={e=>setRegionField(e.target.value)} placeholder={`${UserPrefs.country(country).stateLabel} (optional)`}
                style={{width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:11,border:`1px solid ${C.line}`,background:C.white,fontSize:15,fontFamily:C.P,color:C.ink,outline:'none'}}/>}
              <Btn primary full onClick={saveLocation}>Save</Btn>
            </div>
          ):(
            <div style={{fontSize:15,color:C.ink,fontFamily:C.P}}>
              {[region,country].filter(Boolean).join(', ')||'Not set'}
              <div style={{fontSize:13,color:C.mid,marginTop:4}}>Prices show in {home.sym} ({home.code}).</div>
            </div>
          )}
        </AccSection>

        <AccSection title="What You Drink" onEdit={()=>setEditSection(editSection==='types'?null:'types')} editing={editSection==='types'}>
          <AccChips opts={ACC_TYPE_OPTS} sel={prefs.types||[]} editing={editSection==='types'} onToggle={id=>toggleMulti('types',id)}/>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8}}>Home and WineDNA open on your first pick.</div>
        </AccSection>

        <AccSection title="Usual Spend" onEdit={()=>setEditSection(editSection==='budget'?null:'budget')} editing={editSection==='budget'}>
          <AccChips opts={UserPrefs.budgetOptions()} sel={prefs.budget} editing={editSection==='budget'} onToggle={id=>savePrefField('budget',id)}/>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8}}>Used for price suggestions until you've scored a few wines with prices.</div>
        </AccSection>

        <AccSection title="Wine Knowledge" onEdit={()=>setEditSection(editSection==='experience'?null:'experience')} editing={editSection==='experience'}>
          <AccChips opts={UserPrefs.EXPERIENCE} sel={prefs.experience} editing={editSection==='experience'} onToggle={id=>savePrefField('experience',id)}/>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P,marginTop:8}}>Sets where Learn starts and how deep articles go.</div>
        </AccSection>

        {/* What went wrong recently, for when something misbehaves (ErrorLog, written by index.html). */}
        <div onClick={()=>{
          const errors=ErrorLog.list();
          alert(errors.length?'Recent errors:\n\n'+errors.slice(-5).map(e=>e.context+': '+e.message).join('\n'):'No errors logged.');
        }} style={{padding:'14px 4px 4px',fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer',textAlign:'center'}}>View error log</div>
        {/* For layout problems only a real phone shows: what this phone reports (InstallApp.screenInfo). */}
        <div onClick={()=>{ const i=InstallApp.screenInfo();
          alert(`Showing: ${i.mode}\nScreen: ${i.screen}\nWindow: ${i.window}\nVisible: ${i.visual}\nPage height: ${i.page}\nReserved by iOS: ${i.inset}\nApp area: ${i.root}\nBottom nav: ${i.nav}\n${i.ua}`); }}
          style={{padding:'4px 4px 14px',fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer',textAlign:'center'}}>Screen details</div>
        <div style={{height:8}}/>
      </div>
    </div>
  );
}

Object.assign(window,{AccountProfileScreen});

/* Text size: Standard, Large (+10%) or Extra large (+20%). Only the text grows (TextSize). */
function TextSizeControl(){
  const [cur,setCur]=React.useState(()=>TextSize.get().id);
  return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
    <div>
      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Text size</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Make the words across the app a little bigger.</div>
    </div>
    <div role="radiogroup" aria-label="Text size" style={{display:'flex',gap:6}}>
      {TextSize.SIZES.map((s,i)=>{
        const on=cur===s.id;
        return <div key={s.id} role="radio" aria-checked={on} onClick={()=>{ TextSize.set(s.id); setCur(s.id); }}
          style={{flex:1,textAlign:'center',padding:'10px 4px',borderRadius:10,cursor:'pointer',background:on?C.crSoft:C.offWhite,border:`1.5px solid ${on?C.cr:'transparent'}`}}>
          <div style={{fontSize:14+i*2,fontWeight:800,color:on?C.cr:C.ink,fontFamily:C.P,lineHeight:1.1}}>Aa</div>
          {/* The labels stay one size so the three tiles line up; the Aa above shows the difference. */}
          <div style={{fontSize:'13px',fontWeight:on?700:500,color:on?C.cr:C.mid,fontFamily:C.P,marginTop:3,whiteSpace:'nowrap'}}>{s.label}</div>
        </div>;
      })}
    </div>
  </Card>;
}

Object.assign(window,{TextSizeControl});

/* Optional sign-in (Account, pwa-account.js): an email, then the 6-digit code Supabase emails.
   Nothing in the app needs it; signed in, Pro and the weekly fair-use limits are checked by the
   server, and (next) their wines back up to it. Hidden when the build has no sign-in configured. */
function AccountCard({showPro}){
  const [,tick]=React.useState(0);
  // Opened from Home's backup offer: go straight to the email, and say that's the step left.
  const [intent]=React.useState(()=>Handoff.accountIntent.take());
  const [step,setStep]=React.useState(()=>intent==='backup'&&!Account.signedIn()?'email':'idle'); // idle | email | code
  const [email,setEmail]=React.useState('');
  const [code,setCode]=React.useState('');
  const [busy,setBusy]=React.useState(false);
  const [err,setErr]=React.useState('');
  const [confirmDelete,setConfirmDelete]=React.useState(false);
  React.useEffect(()=>{ const h=()=>tick(t=>t+1); window.addEventListener('vinterest:account',h); window.addEventListener('vinterest:sync',h);
    return()=>{ window.removeEventListener('vinterest:account',h); window.removeEventListener('vinterest:sync',h); }; },[]);
  if(!Account.available()) return null;

  const box={width:'100%',boxSizing:'border-box',padding:'12px 14px',borderRadius:12,border:`1.5px solid ${C.line}`,fontSize:16,fontFamily:C.P,color:C.ink,background:C.white,outline:'none'};
  const primary={width:'100%',padding:'13px',borderRadius:12,background:C.cr,color:'#fff',fontSize:15,fontWeight:700,fontFamily:C.P,textAlign:'center',cursor:busy?'default':'pointer',opacity:busy?0.6:1};
  const link={fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'};
  async function send(){
    if(busy) return; setBusy(true); setErr('');
    const r=await Account.requestCode(email); setBusy(false);
    if(r.ok){ setStep('code'); setCode(''); } else setErr(r.error);
  }
  async function verify(){
    if(busy) return; setBusy(true); setErr('');
    const r=await Account.verifyCode(email,code); setBusy(false);
    if(r.ok){ setStep('idle'); setEmail(''); setCode(''); } else setErr(r.error);
  }

  async function deleteAccount(){
    if(busy) return; setBusy(true); setErr('');
    const r=await Account.deleteAccount();
    if(r.ok){ window.location.replace('/'); return; } // nothing left on the phone: start again at onboarding
    setBusy(false); setErr(r.error);
  }

  if(Account.signedIn()){
    const me=Account.me(), pro=Account.tier()==='pro';
    return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:8}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Your account</div>
          <div style={{fontSize:14,color:C.mid,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis'}}>{Account.email()}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <Pill active={pro} sm>{pro?'Pro':'Free'}</Pill>
          {/* Upgrade in the Pro badge's gold, so it reads as the way to Pro. */}
          {!pro&&showPro&&<span role="button" onClick={()=>showPro('upgrade')} style={{display:'inline-flex',alignItems:'center',padding:'3px 11px',borderRadius:20,
            background:'linear-gradient(135deg,#9B5E00,#C4870A)',color:'#fff',fontSize:13,fontWeight:700,fontFamily:C.P,cursor:'pointer',boxShadow:'0 1px 4px rgba(155,94,0,0.3)'}}>Upgrade</span>}
        </div>
      </div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>
        {pro?'You have Pro on any phone you sign in on. ':''}Sign in on another phone and your wines, WineDNA and progress are there too.
      </div>
      {me&&me.usage&&me.caps&&me.usage.label_scan>0&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>This week: {me.usage.label_scan} of {me.caps.label_scan} label scans.</div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
        <span onClick={()=>Account.signOut()} style={link}>Sign out</span>
        {!confirmDelete&&<span onClick={()=>{setConfirmDelete(true);setErr('');}} style={{fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer'}}>Delete account</span>}
      </div>
      {confirmDelete&&<DeleteAccountPanel busy={busy} err={err} onCancel={()=>{setConfirmDelete(false);setErr('');}} onDelete={deleteAccount}/>}
    </Card>;
  }

  return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
    {intent==='backup'
      ?<div>
        <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>One step left: sign in to back up</div>
        <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Your wines aren't backed up yet. Enter your email, type in the code we send, and they're backed up straight away.</div>
      </div>
      :<div>
        <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Sign in (optional)</div>
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>Everything works without an account. Signing in backs up your wines and progress, so a new phone picks up where this one left off.</div>
      </div>}
    {step==='idle'&&<div onClick={()=>{setStep('email');setErr('');}} style={primary}>Sign in with email</div>}
    {step==='email'&&<>
      <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label="Email address" value={email}
        onChange={e=>setEmail(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send(); }} style={box}/>
      <div onClick={send} style={primary}>{busy?'Sending…':'Email me a code'}</div>
      <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>No password: we email a 6-digit code to type in here.</div>
    </>}
    {step==='code'&&<>
      <div style={{fontSize:14,color:C.ink2,fontFamily:C.P}}>We sent a code to <b>{email.trim()}</b>. It can take a minute; check spam too.</div>
      <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" aria-label="Sign-in code" value={code}
        onChange={e=>setCode(e.target.value.replace(/\D/g,''))} onKeyDown={e=>{ if(e.key==='Enter') verify(); }} style={{...box,letterSpacing:4,fontSize:20,textAlign:'center'}}/>
      <div onClick={verify} style={primary}>{busy?'Checking…':'Sign in'}</div>
      <div style={{display:'flex',justifyContent:'space-between'}}>
        <span onClick={send} style={link}>Send a new code</span>
        <span onClick={()=>{setStep('email');setErr('');}} style={link}>Different email</span>
      </div>
    </>}
    {err&&<div role="alert" style={{fontSize:14,color:'#B04A3A',fontFamily:C.P}}>{err}</div>}
    {step!=='idle'&&<span onClick={()=>{setStep('idle');setErr('');}} style={{fontSize:14,color:C.mid,fontFamily:C.P,cursor:'pointer',alignSelf:'center'}}>Not now</span>}
  </Card>;
}

/* The confirmation before Account.deleteAccount: what goes (the account, its backup, and everything
   on this phone), that it can't be undone, and a backup file first for anyone who wants a copy. */
function DeleteAccountPanel({busy,err,onCancel,onDelete}){
  const red='#B04A3A';
  return <div role="dialog" aria-label="Delete your account" style={{marginTop:6,padding:12,borderRadius:12,background:'#FBEFEC',border:`1px solid ${red}40`,display:'flex',flexDirection:'column',gap:10}}>
    <div style={{fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Delete your account?</div>
    <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
      This deletes your account and everything backed up to it, and clears Vinterest from this phone: your wines, scores, WineDNA, XP and learning progress. It can't be undone.
    </div>
    <div style={{fontSize:13,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
      Want a copy first? <span onClick={saveBackupFile} style={{fontWeight:700,color:C.cr,cursor:'pointer'}}>Save a backup file</span> to your phone. You can import it later, with or without an account.
    </div>
    <div onClick={onDelete} role="button" style={{width:'100%',boxSizing:'border-box',padding:'13px',borderRadius:12,background:red,color:'#fff',fontSize:15,fontWeight:700,fontFamily:C.P,textAlign:'center',cursor:busy?'default':'pointer',opacity:busy?0.6:1}}>
      {busy?'Deleting…':'Delete my account'}
    </div>
    {err&&<div role="alert" style={{fontSize:14,color:red,fontFamily:C.P}}>{err}</div>}
    {!busy&&<span onClick={onCancel} style={{fontSize:14,fontWeight:600,color:C.ink2,fontFamily:C.P,cursor:'pointer',alignSelf:'center'}}>Keep my account</span>}
  </div>;
}

Object.assign(window,{AccountCard,DeleteAccountPanel});

/* Install to the home screen (InstallApp, pwa-install.js). Offers Chrome's own install dialog when
   Chrome allows it, and otherwise says plainly why not, so a missing menu option isn't a mystery.
   Hidden once the app is opened from the home screen. */
function InstallCard(){
  const [,tick]=React.useState(0);
  const [note,setNote]=React.useState('');
  const [why,setWhy]=React.useState(false);
  const [checks,setChecks]=React.useState(null);
  React.useEffect(()=>{ if(why&&!checks) InstallApp.selfCheck().then(setChecks); },[why]);
  React.useEffect(()=>{ const h=()=>tick(t=>t+1); window.addEventListener('vinterest:install',h); return()=>window.removeEventListener('vinterest:install',h); },[]);
  const st=InstallApp.status();
  if(st==='running') return null;
  const link={fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'};
  const body={fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5};
  async function install(){
    const r=await InstallApp.prompt();
    setNote(r==='accepted'?'Installing. Vinterest will appear on your home screen in a moment.':r==='dismissed'?'No problem. You can install it from here any time.':'Chrome didn\'t show the install this time. Reload the page and try again.');
  }
  return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:10}}>
    <div>
      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Put Vinterest on your home screen</div>
      <div style={body}>It opens full screen like any other app, straight to the camera when you need it.</div>
    </div>
    {st==='available'&&<div onClick={install} style={{width:'100%',padding:'13px',borderRadius:12,background:C.cr,color:'#fff',fontSize:15,fontWeight:700,fontFamily:C.P,textAlign:'center',cursor:'pointer'}}>Install Vinterest</div>}
    {st==='installed'&&<div style={{...body,color:C.ink2}}>It's already installed on this phone. Open Vinterest from your home screen or app list.</div>}
    {st==='ios'&&<div style={{...body,color:C.ink2}}>In Safari, tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>.</div>}
    {st==='waiting'&&<>
      <div style={{...body,color:C.ink2}}>Chrome hasn't offered to install Vinterest on this phone yet.</div>
      <span onClick={()=>setWhy(w=>!w)} style={link}>{why?'Hide details':'Why not?'}</span>
      {why&&<div style={{display:'flex',flexDirection:'column',gap:6}}>
        {InstallApp.why().map((w,i)=><div key={i} style={body}>• {w}</div>)}
        <div style={body}>You can also try Chrome's menu (⋮) → <b>Add to home screen</b>, if it's there.</div>
        <div style={{...body,fontWeight:700,color:C.ink2,marginTop:4}}>What this phone sees</div>
        {!checks&&<div style={body}>Checking…</div>}
        {checks&&checks.map((c,i)=><div key={i} style={{...body,color:c.ok?C.mid:'#B04A3A'}}>{c.ok?'✓':'✗'} {c.text}</div>)}
      </div>}
    </>}
    {note&&<div role="status" style={{...body,color:C.ink2}}>{note}</div>}
  </Card>;
}

Object.assign(window,{InstallCard});

/* Backup (Sync, pwa-sync.js), its own section once signed in: on or not, when it last ran, what's
   waiting. "Back up now" runs a sync straight away. */
function BackupCard(){
  const [,tick]=React.useState(0);
  React.useEffect(()=>{ const h=()=>tick(t=>t+1); window.addEventListener('vinterest:sync',h); window.addEventListener('vinterest:account',h);
    const id=setInterval(h,30000);
    return()=>{ window.removeEventListener('vinterest:sync',h); window.removeEventListener('vinterest:account',h); clearInterval(id); }; },[]);
  const s=Sync.summary();
  if(!s) return null;
  const col={on:C.green,working:C.amber,problem:'#B04A3A'}[s.tone];
  return <Card style={{padding:14,display:'flex',flexDirection:'column',gap:6}}>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
      <div style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>Backup</div>
      <span role="status" style={{display:'inline-flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:20,background:s.tone==='on'?C.greenBg:C.offWhite,border:`1px solid ${col}40`}}>
        <span style={{width:8,height:8,borderRadius:4,background:col,flexShrink:0}}/>
        <span style={{fontSize:13,fontWeight:700,color:col,fontFamily:C.P}}>{s.label}</span>
      </span>
    </div>
    <div style={{fontSize:14,color:C.ink2,fontFamily:C.P}}>{s.last}</div>
    {s.detail&&<div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>{s.detail}</div>}
    <span onClick={()=>Sync.syncNow()} style={{fontSize:14,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer',alignSelf:'flex-start',marginTop:2}}>Back up now</span>
  </Card>;
}

Object.assign(window,{BackupCard});
