/* Vinterest — On-Ramp Article Screen (data-driven from data/onramp.json) */
function _loadText(path){ const x=new XMLHttpRequest(); x.open('GET',path,false); x.send(); return x.responseText; }
function _fillTpl(tpl,vars){ let s=tpl; Object.keys(vars).forEach(k=>{ s=s.split('{{'+k+'}}').join(vars[k]??''); }); return s; }
const ON_RAMP=_loadJSON('data/onramp.json');
function onRampDone(id){ return !!localStorage.getItem('vinterest_'+id+'_done'); }
function onRampProgress(){ return ON_RAMP.filter(a=>onRampDone(a.id)).length; }

function LearnArticleScreen({nav,back}){
  const idx=React.useMemo(()=>{ const i=parseInt(sessionStorage.getItem('vinterest_onramp_idx')||'0',10); return isNaN(i)?0:Math.min(i,ON_RAMP.length-1); },[]);
  const article=ON_RAMP[idx];
  const [completed,setCompleted]=React.useState(()=>onRampDone(article.id));

  function markRead(){
    if(completed) return;
    XPSystem.awardAndToast([{type:'article',articleKey:article.id}]);
    localStorage.setItem('vinterest_'+article.id+'_done','1');
    setCompleted(true);
  }

  const nextArticle=ON_RAMP.find(a=>!onRampDone(a.id)&&a.id!==article.id);

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>On-Ramp · {article.readTime}</div>
        </div>
        {completed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ +50 XP</span>}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* Hero */}
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n="book" sz={12} col="rgba(255,255,255,0.55)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Quick Read</span>
          </div>
          <div style={{fontSize:28,fontWeight:400,color:'#fff',fontFamily:C.serif,lineHeight:1.2,marginBottom:10}}>{article.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.42)',fontFamily:C.P,lineHeight:1.65}}>{article.subtitle}</div>
        </div>

        {/* Sections */}
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {article.sections.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={s.iconName} sz={22} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',marginBottom:10}}>{s.plain}</div>
                </div>
              </div>
              <div style={{padding:'0 16px 14px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.7}}>{s.detail}</div>
                <div style={{background:C.offWhite,borderRadius:10,padding:'10px 14px'}}>
                  {s.examples.map((ex,j)=>(
                    <div key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:j<s.examples.length-1?6:0}}>
                      <div style={{width:4,height:4,borderRadius:2,background:C.cr,marginTop:9,flexShrink:0}}/>
                      <span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{ex}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          {/* Completion CTA */}
          <div style={{background:completed?C.greenBg:C.crSoft,borderRadius:16,padding:'18px 16px',textAlign:'center',border:`1px solid ${completed?C.green+'30':C.crDim}`}}>
            {completed?(
              <>
                <div style={{width:56,height:56,borderRadius:28,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}><Icon n="check" sz={26} col={C.green}/></div>
                <div style={{fontSize:19,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>Nice work!</div>
                <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:14}}>{nextArticle?'On to the next one whenever you\'re ready.':'That\'s the whole on-ramp — your shelf takes it from here.'}</div>
                <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                  <Btn onClick={()=>nav('learn')}>Back to Learn</Btn>
                  {nextArticle&&<Btn primary onClick={()=>{sessionStorage.setItem('vinterest_onramp_idx',String(ON_RAMP.indexOf(nextArticle)));nav('article');}}>Next read</Btn>}
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P,marginBottom:4}}>Finished reading?</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:14}}>Mark as complete to earn +50 XP</div>
                <Btn primary full onClick={markRead}>Mark as Read · +50 XP</Btn>
              </>
            )}
          </div>
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{LearnArticleScreen});

/* ── GENERATED ARTICLE SCREEN ── */
function GenArticleScreen({nav,back}){
  const stub=React.useMemo(()=>{
    try{ return JSON.parse(sessionStorage.getItem('vinterest_gen_article')||'null'); }catch(e){ return null; }
  },[]);

  const doneKey=stub?`vinterest_gen_article_${stub.id}_done`:null;
  const cacheKey=stub?`vinterest_gen_article_${stub.id}_content`:null;

  const [completed,setCompleted]=React.useState(()=>!!localStorage.getItem(doneKey));
  const [sections,setSections]=React.useState(()=>{
    if(!cacheKey) return null;
    try{ return JSON.parse(localStorage.getItem(cacheKey)||'null'); }catch(e){ return null; }
  });
  const [generating,setGenerating]=React.useState(false);

  React.useEffect(()=>{
    if(!stub||sections||generating) return;
    setGenerating(true);
    const wines=WineHistory.getAll();
    const types=[...new Set(wines.map(w=>(w.type||'red').toLowerCase()))].join(', ');
    const regions=[...new Set(wines.map(w=>w.region||w.country).filter(Boolean))].slice(0,5).join(', ');
    const grapes=[...new Set(wines.flatMap(w=>w.grapes||[]).filter(Boolean))].slice(0,6).join(', ');
    const prompt=_fillTpl(_loadText('prompts/gen-article.txt'),{types,regions,grapes,title:stub.title,brief:stub.brief||'Write a clear, specific educational piece on the title above.',facts:stub.facts||'No specific retrieved facts — keep claims general and hedge appropriately.'});

    window.claude.complete({messages:[{role:'user',content:prompt}]})
      .then(text=>{
        try{
          let clean=text.replace(/```json|```/g,'').trim();
          const s=clean.indexOf('{'),e=clean.lastIndexOf('}');
          if(s>=0&&e>s) clean=clean.slice(s,e+1);
          const parsed=JSON.parse(clean);
          const secs=parsed.sections||[];
          localStorage.setItem(cacheKey,JSON.stringify(secs));
          setSections(secs);
        }catch(err){}
      })
      .catch(()=>{})
      .finally(()=>setGenerating(false));
  },[stub?.id]);

  function markRead(){
    if(completed||!doneKey) return;
    XPSystem.awardAndToast([{type:'article',articleKey:stub.id}]);
    localStorage.setItem(doneKey,'1');
    setCompleted(true);
  }

  if(!stub) return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Article not found.</span>
    </div>
  );

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>Your Reading List · {stub.readTime}</div>
        </div>
        {completed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ +50 XP</span>}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* Hero */}
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n={stub.iconName||'read'} sz={14} col="rgba(255,255,255,0.6)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Personalised for You</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{stub.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.65}}>{stub.subtitle}</div>
        </div>

        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {/* Loading state */}
          {generating&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:14}}>
              <div style={{width:18,height:18,borderRadius:9,border:`2px solid ${C.cr}`,borderTopColor:'transparent',animation:'storySpin .8s linear infinite'}}/>
              <span style={{fontSize:16,color:C.mid,fontFamily:C.P,fontStyle:'italic',textAlign:'center'}}>Writing your personalised article…</span>
            </div>
          )}

          {/* Sections */}
          {sections&&sections.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={s.iconName||'read'} sz={22} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic',marginBottom:10}}>{s.plain}</div>
                </div>
              </div>
              <div style={{padding:'0 16px 14px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.7}}>{s.detail}</div>
                {s.examples&&s.examples.length>0&&(
                  <div style={{background:C.offWhite,borderRadius:10,padding:'10px 14px'}}>
                    {s.examples.map((ex,j)=>(
                      <div key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:j<s.examples.length-1?6:0}}>
                        <div style={{width:4,height:4,borderRadius:2,background:C.cr,marginTop:9,flexShrink:0}}/>
                        <span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{ex}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Completion CTA */}
          {sections&&(
            <div style={{background:completed?C.greenBg:C.crSoft,borderRadius:16,padding:'18px 16px',textAlign:'center',border:`1px solid ${completed?C.green+'30':C.crDim}`}}>
              {completed?(
                <>
                  <div style={{width:56,height:56,borderRadius:28,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px'}}><Icon n="check" sz={26} col={C.green}/></div>
                  <div style={{fontSize:19,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>Article complete!</div>
                  <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:14}}>Keep exploring your reading list for more personalised content.</div>
                  <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                    <Btn onClick={()=>nav('learn')}>Reading List</Btn>
                    <Btn primary onClick={()=>nav('camera')}>Scan a bottle</Btn>
                  </div>
                </>
              ):(
                <>
                  <div style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P,marginBottom:4}}>Finished reading?</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:14}}>Mark as complete to earn +50 XP</div>
                  <Btn primary full onClick={markRead}>Mark as Read · +50 XP</Btn>
                </>
              )}
            </div>
          )}
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{LearnArticleScreen,GenArticleScreen});
