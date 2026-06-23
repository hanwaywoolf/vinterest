/* Vinterest — New User Flow: Auth (Sign up to save). Two layout variations. */

/* Brand marks for social sign-in buttons */
function GoogleMark({sz=20}){
  return(
    <svg width={sz} height={sz} viewBox="0 0 48 48" style={{display:'block',flexShrink:0}}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}
function AppleMark({sz=20,col='#000'}){
  return(
    <svg width={sz} height={sz} viewBox="0 0 24 24" style={{display:'block',flexShrink:0}}>
      <path fill={col} d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.46 7.83 1.3 10.39.86 1.25 1.88 2.66 3.22 2.61 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.28 3.12-2.54.98-1.46 1.39-2.87 1.41-2.94-.03-.01-2.71-1.04-2.74-4.13zM14.53 4.4c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44z"/>
    </svg>
  );
}

function SocialButtons({dark}){
  const border=dark?'rgba(255,255,255,0.16)':C.line;
  const txt=dark?'#fff':C.ink;
  const bg=dark?'rgba(255,255,255,0.06)':C.white;
  const row=(mark,label)=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:11,padding:'14px',borderRadius:13,border:`1px solid ${border}`,background:bg,cursor:'pointer'}}>
      {mark}
      <span style={{fontSize:15.5,fontWeight:600,color:txt,fontFamily:C.P}}>{label}</span>
    </div>
  );
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {row(<GoogleMark/>,'Continue with Google')}
      {row(<AppleMark col={dark?'#fff':'#000'}/>,'Continue with Apple')}
    </div>
  );
}

function Divider({label,dark}){
  const ln=dark?'rgba(255,255,255,0.14)':C.line;
  const tx=dark?'rgba(255,255,255,0.4)':C.mid;
  return(
    <div style={{display:'flex',alignItems:'center',gap:12,margin:'4px 0'}}>
      <div style={{flex:1,height:1,background:ln}}></div>
      <span style={{fontSize:13,color:tx,fontFamily:C.P}}>{label}</span>
      <div style={{flex:1,height:1,background:ln}}></div>
    </div>
  );
}

function EmailFields({mode}){
  const field=(ph,type)=>(
    <input type={type} placeholder={ph} style={{width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:`1px solid ${C.line}`,background:C.white,fontSize:15.5,fontFamily:C.P,color:C.ink,outline:'none'}}/>
  );
  return(
    <div style={{display:'flex',flexDirection:'column',gap:10}}>
      {field('Email address','email')}
      {field('Password','password')}
    </div>
  );
}

/* ── VARIATION A: Social-first (stacked) ── */
function AuthVariantA({next,mode,setMode}){
  const signup=mode==='signup';
  return(
    <div style={{flex:1,background:C.bg,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{flex:1,overflowY:'auto',padding:'60px 26px 16px'}}>
        <img src="logo.png" alt="Vinterest" style={{height:26,width:'auto',display:'block',marginBottom:30}}/>
        <div style={{fontSize:28,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.6px',lineHeight:1.12,marginBottom:8}}>
          {signup?'Save your scans':'Welcome back'}
        </div>
        <div style={{fontSize:15.5,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:28}}>
          {signup?'Create a free account to keep your wines, taste profile and progress.':'Sign in to pick up where you left off.'}
        </div>

        <SocialButtons/>
        <div style={{height:18}}></div>
        <Divider label="or"/>
        <div style={{height:18}}></div>
        <EmailFields mode={mode}/>

        {!signup&&<div style={{textAlign:'right',marginTop:10}}>
          <span style={{fontSize:13.5,color:C.cr,fontFamily:C.P,fontWeight:600,cursor:'pointer'}}>Forgot password?</span>
        </div>}
      </div>

      <div style={{padding:'12px 26px 40px',flexShrink:0,background:C.white,borderTop:`1px solid ${C.line}`}}>
        <div onClick={next} style={{background:C.cr,borderRadius:14,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 8px 26px ${C.cr}45`}}>
          <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>{signup?'Create account':'Sign in'}</span>
        </div>
        <div style={{textAlign:'center',marginTop:14}}>
          <span style={{fontSize:14,color:C.mid,fontFamily:C.P}}>{signup?'Already have an account? ':'New to Vinterest? '}</span>
          <span onClick={()=>setMode(signup?'signin':'signup')} style={{fontSize:14,color:C.cr,fontFamily:C.P,fontWeight:700,cursor:'pointer'}}>{signup?'Sign in':'Create one'}</span>
        </div>
      </div>
    </div>
  );
}

/* ── VARIATION B: Dark hero, email-first ── */
function AuthVariantB({next,mode,setMode}){
  const signup=mode==='signup';
  return(
    <div style={{flex:1,background:'#0F0F0F',display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
      <div style={{position:'absolute',top:-70,right:-70,width:260,height:260,borderRadius:130,background:`${C.cr}28`,pointerEvents:'none'}}></div>

      <div style={{flex:1,overflowY:'auto',padding:'64px 26px 16px',position:'relative',zIndex:1}}>
        <img src="logo.png" alt="Vinterest" style={{height:26,width:'auto',display:'block',marginBottom:30,filter:'invert(1) brightness(2)'}}/>
        <div style={{fontSize:30,fontWeight:800,color:'#fff',fontFamily:C.P,letterSpacing:'-0.7px',lineHeight:1.1,marginBottom:8}}>
          {signup?'Keep your wines\nforever.':'Welcome back.'}
        </div>
        <div style={{fontSize:15.5,color:'rgba(255,255,255,0.45)',fontFamily:C.P,lineHeight:1.5,marginBottom:30,whiteSpace:'pre-line'}}>
          {signup?'One free account saves every scan, rating and your taste profile.':'Sign in to continue.'}
        </div>

        {/* email-first, on dark */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <input type="email" placeholder="Email address" style={{width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:'1px solid rgba(255,255,255,0.16)',background:'rgba(255,255,255,0.07)',fontSize:15.5,fontFamily:C.P,color:'#fff',outline:'none'}}/>
          <input type="password" placeholder="Password" style={{width:'100%',boxSizing:'border-box',padding:'15px 16px',borderRadius:13,border:'1px solid rgba(255,255,255,0.16)',background:'rgba(255,255,255,0.07)',fontSize:15.5,fontFamily:C.P,color:'#fff',outline:'none'}}/>
        </div>

        <div onClick={next} style={{marginTop:14,background:C.cr,borderRadius:14,padding:'16px',textAlign:'center',cursor:'pointer',boxShadow:`0 8px 30px ${C.cr}60`}}>
          <span style={{fontSize:16.5,fontWeight:700,color:'#fff',fontFamily:C.P}}>{signup?'Create account':'Sign in'}</span>
        </div>

        {!signup&&<div style={{textAlign:'center',marginTop:12}}>
          <span style={{fontSize:13.5,color:'rgba(255,255,255,0.5)',fontFamily:C.P,cursor:'pointer'}}>Forgot password?</span>
        </div>}

        <div style={{height:20}}></div>
        <Divider label="or continue with" dark/>
        <div style={{height:16}}></div>
        <SocialButtons dark/>
      </div>

      <div style={{padding:'14px 26px 40px',flexShrink:0,position:'relative',zIndex:1}}>
        <div style={{textAlign:'center'}}>
          <span style={{fontSize:14,color:'rgba(255,255,255,0.45)',fontFamily:C.P}}>{signup?'Already have an account? ':'New here? '}</span>
          <span onClick={()=>setMode(signup?'signin':'signup')} style={{fontSize:14,color:'#fff',fontFamily:C.P,fontWeight:700,cursor:'pointer'}}>{signup?'Sign in':'Create one'}</span>
        </div>
      </div>
    </div>
  );
}

function AuthScreen({next,variant}){
  const [mode,setMode]=React.useState('signup');
  return variant==='B'
    ? <AuthVariantB next={next} mode={mode} setMode={setMode}/>
    : <AuthVariantA next={next} mode={mode} setMode={setMode}/>;
}

Object.assign(window,{AuthScreen,GoogleMark,AppleMark});
