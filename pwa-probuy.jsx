/* The buying part of the Pro sheet (ProGate, pwa-components.jsx) in the iPhone and Android apps:
   what's for sale from the store, in the person's own currency, with Apple's and Google's required
   wording and Restore purchases. All of it goes through Billing (pwa-billing.js). Signed out, it asks
   for sign-in first, because Pro belongs to the account. Elsewhere (the web) Billing isn't available
   and ProGate keeps its own text. */
function ProBuy({onClose}){
  const [offers,setOffers]=React.useState(undefined); // undefined: loading, null: none
  const [busy,setBusy]=React.useState('');
  const [msg,setMsg]=React.useState('');
  const signedIn=Account.signedIn();
  React.useEffect(()=>{ let on=true; if(signedIn) Billing.offers().then(o=>{ if(on) setOffers(o); }); return()=>{ on=false; }; },[signedIn]);
  const store=Platform.name()==='ios'?'Apple ID':'Google Play account';
  const primary={background:`linear-gradient(135deg,${C.cr},${C.crL})`,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 28px ${C.cr}45`};
  const link={fontSize:15,fontWeight:600,color:C.cr,fontFamily:C.P,cursor:'pointer'};
  const run=async(key,fn)=>{
    if(busy) return; setBusy(key); setMsg('');
    const r=await fn(); setBusy('');
    if(r.cancelled) return;
    if(r.ok&&!r.late){ onClose(); return; }
    setMsg(r.error||'');
    if(r.ok) setTimeout(onClose,2500);
  };
  if(!signedIn) return <>
    <div style={{fontSize:14,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>Pro belongs to your account, so it follows you to a new phone. Sign in first, then choose a plan.</div>
    <div role="button" onClick={()=>{ Handoff.accountIntent.set('subscribe'); onClose(); window.location.hash='#account'; }} style={primary}>
      <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>Sign in to go Pro</div>
    </div>
  </>;
  return <>
    {offers===undefined&&<div style={{fontSize:15,color:C.mid,fontFamily:C.P,textAlign:'center'}}>Loading prices…</div>}
    {offers===null&&<div role="alert" style={{fontSize:15,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>
      Subscriptions aren't available just now. Check your connection and <span onClick={()=>{ setOffers(undefined); Billing.offers().then(setOffers); }} style={link}>try again</span>.
    </div>}
    {offers&&offers.map(o=>
      <div key={o.pkg.identifier||o.label} role="button" data-testid="pro-offer" onClick={()=>run('buy',()=>Billing.buy(o))} style={{...primary,opacity:busy&&busy!=='buy'?0.6:1}}>
        <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>{busy==='buy'?'Opening…':`Subscribe · ${o.price}${o.per?' / '+o.per:''}`}</div>
        <div style={{fontSize:15,color:'rgba(255,255,255,0.68)',fontFamily:C.P,marginTop:2}}>{o.label} · Cancel anytime</div>
      </div>)}
    {msg&&<div role="alert" data-testid="pro-msg" style={{fontSize:14,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>{msg}</div>}
    <div style={{textAlign:'center'}}>
      <span role="button" data-testid="pro-restore" onClick={()=>run('restore',()=>Billing.restore())} style={link}>{busy==='restore'?'Restoring…':'Restore purchases'}</span>
    </div>
    <div style={{fontSize:12,color:C.mid,fontFamily:C.P,lineHeight:1.5,textAlign:'center'}}>
      Payment is charged to your {store} when you confirm. The subscription renews automatically unless you cancel it at least 24 hours before the end of the period, in your {Platform.name()==='ios'?'Apple ID settings':'Google Play settings'}. By subscribing you agree to the <a href="https://vinterest.app/terms/" target="_blank" rel="noopener" style={{color:C.cr}}>Terms</a> and <a href="https://vinterest.app/privacy/" target="_blank" rel="noopener" style={{color:C.cr}}>Privacy notice</a>.
    </div>
  </>;
}
