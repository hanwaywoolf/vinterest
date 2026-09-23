/* Vinterest — New user onboarding flow
   welcome → age + location → first scan → three taste questions, then into the app.
   No sign-up or paywall here: accounts don't exist yet, and Pro is offered when someone reaches
   the free scan limit or taps a Pro feature. Answers are stored through UserPrefs. */

function NewUserFlow({onComplete}){
  const [step,setStep]=React.useState('welcome');
  const [scanned,setScanned]=React.useState(null);
  const go=k=>{ try{ window.scrollTo(0,0); }catch(e){} setStep(k); };
  // Progress dots: setup, scan, then the three questions.
  const TOTAL=5;

  switch(step){
    case 'welcome': return <WelcomeScreen next={()=>go('setup')}/>;
    case 'setup':   return <OnboardSetup step={0} total={TOTAL} onBack={()=>go('welcome')} onDone={()=>go('scan')}/>;
    case 'scan':    return <ScanScreen nav={()=>{}} back={()=>go('setup')} onSkip={()=>go('taste')} onComplete={w=>{ setScanned(w||null); go('taste'); }}/>;
    case 'taste':   return <OnboardTaste step={2} total={TOTAL} scanned={scanned} onBack={()=>go('scan')} onDone={()=>{ onComplete(); ScanFlow.flushToasts(); }}/>;
    default: return null;
  }
}

Object.assign(window,{NewUserFlow});
