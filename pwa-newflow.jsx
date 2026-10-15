/* Vinterest — New user onboarding flow
   welcome → age + location → first scan → that bottle's story (FirstScanStory: what the app will
   do, shown on the bottle in hand) → three taste questions, then into the app.
   No sign-up or paywall here: accounts don't exist yet, and Pro is offered when someone reaches
   the free scan limit or taps a Pro feature. Answers are stored through UserPrefs. */

function NewUserFlow({onComplete}){
  const [step,setStep]=React.useState('welcome');
  const [scanned,setScanned]=React.useState(null);
  const tasteSeen=React.useRef(false);
  const go=k=>{ try{ window.scrollTo(0,0); }catch(e){} setStep(k); };
  // Progress dots: setup, scan, then the three questions.
  const TOTAL=5;

  switch(step){
    case 'welcome': return <WelcomeScreen next={()=>go('setup')} returning={onComplete}/>;
    // Onboarding is dark from end to end, whatever Appearance later says: the welcome slides,
    // these checks, the camera, the story and the questions all sit on the one stage.
    case 'setup':   return <DeckTheme.Provider value={_DECK_DARK}><OnboardSetup step={0} total={TOTAL} onBack={()=>go('welcome')} onDone={()=>go('scan')}/></DeckTheme.Provider>;
    case 'scan':    return <ScanScreen nav={()=>{}} back={()=>go('setup')} onSkip={()=>go('taste')} onComplete={w=>{ setScanned(w||null); go(w?'story':'taste'); }}/>;
    case 'story':   return <FirstScanStory wine={scanned} onDone={()=>go('taste')}/>;
    case 'taste':   { const first=!tasteSeen.current; tasteSeen.current=true;
                      return <DeckTheme.Provider value={_DECK_DARK}><OnboardTaste step={2} total={TOTAL} scanned={first?scanned:null} onBack={()=>go(scanned?'story':'scan')} onDone={()=>{ onComplete(); ScanFlow.flushToasts(); }}/></DeckTheme.Provider>; }
    default: return null;
  }
}

Object.assign(window,{NewUserFlow});
