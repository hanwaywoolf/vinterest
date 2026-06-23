/* Vinterest — New user onboarding flow
   welcome → demo scan → sign up → setup questions → Pro, then into the app.
   Composes the flow-*.jsx screens (WelcomeScreen, DemoScanScreen, AuthScreen,
   OnboardQuestions, PaywallScreen) used in the New User Flow prototype. */

function NewUserFlow({onComplete}){
  const [step,setStep]=React.useState('welcome');
  const go=k=>{ try{ window.scrollTo(0,0); }catch(e){} setStep(k); };

  // Save the answers from the setup questions so the rest of the app is personalized.
  function persist(answers){
    try{
      if(!answers) return;
      localStorage.setItem('vinterest_prefs', JSON.stringify(answers));
      const loc=answers.location||{};
      const c=(loc.country||'').toLowerCase();
      // App supports these retail regions: uk · us · ontario · australia
      const map={'united states':'us','canada':'ontario','united kingdom':'uk','australia':'australia'};
      localStorage.setItem('vinterest_region', map[c]||'uk');
      const curMap={'united kingdom':'GBP','united states':'USD','canada':'CAD','australia':'AUD','france':'EUR','germany':'EUR','italy':'EUR','spain':'EUR'};
      localStorage.setItem('vinterest_currency', curMap[c]||'USD');
      if(loc.country) localStorage.setItem('vinterest_country', loc.country);
      if(loc.region)  localStorage.setItem('vinterest_state', loc.region);
      if(loc.city)    localStorage.setItem('vinterest_city', loc.city);
      const types=answers.types||[];
      if(types.length) localStorage.setItem('vinterest_initial_pref', types[0]);
    }catch(e){}
  }

  function finish(){
    if(!localStorage.getItem('vinterest_region')) localStorage.setItem('vinterest_region','uk');
    onComplete();
  }

  switch(step){
    case 'welcome': return <WelcomeScreen next={()=>go('scan')}/>;
    case 'scan':    return <ScanScreen nav={()=>{}} back={()=>go('welcome')} onComplete={()=>go('auth')}/>;
    case 'auth':    return <AuthScreen variant="A" next={()=>go('onboard')}/>;
    case 'onboard': return <OnboardQuestions next={()=>go('paywall')} onAnswers={a=>{persist(a);go('paywall');}}/>;
    case 'paywall': return <PaywallScreen variant="A" next={finish}/>;
    default: return null;
  }
}

Object.assign(window,{NewUserFlow});
