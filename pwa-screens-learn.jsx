/* Vinterest — On-Ramp Article Screen (data-driven from data/onramp.json) */
function _loadText(path){ return _loadTextSync(path); }
function _fillTpl(tpl,vars){ let s=tpl; Object.keys(vars).forEach(k=>{ s=s.split('{{'+k+'}}').join(vars[k]??''); }); return s; }
let ON_RAMP=[];
try{ ON_RAMP=_loadJSON('data/onramp.json')||[]; }catch(e){ console.error('[Vinterest] onramp.json failed to load — the Learn tab will be missing its on-ramp articles until it is deployed.',e); }
function onRampDone(id){ return LearnProgress.onRampDone(id); }
function onRampProgress(){ return ON_RAMP.filter(a=>onRampDone(a.id)).length; }

/* Side panels for reading screens on an iPad (ReadingLayout): cards of context beside the text. */
const _asideCard={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8};
const _asideHead=t=><div style={{fontSize:12,fontWeight:700,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P}}>{t}</div>;
function _AsideWines({wines,nav,title}){
  if(!wines||!wines.length) return null;
  const open=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };
  return <div style={_asideCard} data-testid="aside-wines">
    {_asideHead(title)}
    {wines.map((w,i)=><div key={(w.name||'')+i} role="button" onClick={()=>open(w)} style={{display:'flex',alignItems:'center',gap:8,paddingTop:i?8:0,borderTop:i?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{WineDNA.nameYear(w)}</div>
        <div style={{fontSize:12,color:C.mid,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{[w.producer,w.region].filter(Boolean).join(' · ')}</div>
      </div>
      {w.rating>0&&<span style={{fontSize:15,fontWeight:800,color:scoreCol(w.rating),fontFamily:C.P}}>{w.rating}</span>}
    </div>)}
  </div>;
}
function _AsideLinks({links}){
  links=(links||[]).filter(Boolean);
  if(!links.length) return null;
  return <div style={_asideCard} data-testid="aside-links">
    {_asideHead('Go deeper')}
    {links.map(l=><div key={l.t} role="button" onClick={l.go} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P}}>
      {l.icon&&<Icon n={l.icon} sz={15} col={C.cr}/>}<span style={{flex:1}}>{l.t}</span><Icon n="chevron" sz={12} col={C.cr}/>
    </div>)}
  </div>;
}

function LearnArticleScreen({nav,back}){
  const wide=useWide();
  const idx=React.useMemo(()=>{ const i=parseInt(Handoff.onRampIdx.get()||'0',10); return isNaN(i)?0:Math.min(i,ON_RAMP.length-1); },[]);
  const article=ON_RAMP[idx];
  const [completed,setCompleted]=React.useState(()=>onRampDone(article.id));

  function markRead(){
    if(completed) return;
    XPSystem.awardAndToast([{type:'article',articleKey:article.id}]);
    LearnProgress.markOnRamp(article.id);
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
        <div style={{background:C.ink,padding:wide?'32px max(20px, calc((100% - 760px) / 2)) 28px':'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n="book" sz={12} col="rgba(255,255,255,0.55)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Quick Read</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{article.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.42)',fontFamily:C.P,lineHeight:1.65}}>{article.subtitle}</div>
        </div>

        {/* Sections: on an iPad in a reading column, with the beginner series beside it */}
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <ReadingLayout aside={wide?<>
            <div style={_asideCard} data-testid="aside-series">
              {_asideHead(`Beginner articles · ${ON_RAMP.filter(a=>onRampDone(a.id)).length} of ${ON_RAMP.length} read`)}
              {ON_RAMP.map((a,i)=><div key={a.id} role="button" onClick={()=>{ if(i===idx) return; Handoff.onRampIdx.set(String(i)); nav('article'); }} style={{display:'flex',alignItems:'center',gap:8,cursor:i===idx?'default':'pointer'}}>
                <Icon n={onRampDone(a.id)?'check':'book'} sz={14} col={onRampDone(a.id)?C.green:i===idx?C.cr:C.mid}/>
                <span style={{flex:1,fontSize:14,fontWeight:i===idx?800:500,color:i===idx?C.ink:C.ink2,fontFamily:C.P,lineHeight:1.35}}>{a.title}</span>
                <span style={{fontSize:12,color:C.mid,fontFamily:C.P,whiteSpace:'nowrap'}}>{a.readTime}</span>
              </div>)}
            </div>
            <div style={_asideCard}>{_asideHead('Why read these')}<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Each one takes a couple of minutes and explains one thing wine people take for granted. Finish the first and your Written for you shelf opens.</div></div>
          </>:null}>
          {article.sections.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={s.iconName} sz={22} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:10}}>{s.plain}</div>
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
                  {nextArticle&&<Btn primary onClick={()=>{Handoff.onRampIdx.set(String(ON_RAMP.indexOf(nextArticle)));nav('article');}}>Next read</Btn>}
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
          </ReadingLayout>
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{LearnArticleScreen});

/* ── WINE SKILLS GUIDE ──
   A fixed guide (Guides, pwa-guides.js): a line from the reader's own wines, the sections, then
   three questions and something to try. Read + every question right = finished. */
function GuideScreen({nav,back}){
  const wide=useWide();
  const guide=React.useMemo(()=>Guides.byId(Handoff.guide.get()||''),[]);
  const [read,setRead]=React.useState(()=>!!guide&&Guides.isRead(guide.id));
  const personal=React.useMemo(()=>guide?Guides.personal(guide):null,[guide&&guide.id]);
  if(!guide) return(
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32}}>
      <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Guide not found.</span>
    </div>
  );
  const p=Guides.progress(guide.id), passed=p.total>0&&p.correct===p.total;
  function markRead(){ if(read) return; Guides.markRead(guide.id); XPSystem.awardAndToast([{type:'article',articleKey:'guide_'+guide.id}]); setRead(true); }
  function check(){ markRead(); Handoff.quiz.set({mode:'guide',guideId:guide.id}); nav('quiz'); }
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}><Icon n="back" sz={16} col={C.ink}/></div>
        <div style={{flex:1,fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>Wine Skills · {Guides.group(guide.group).label} · {guide.readTime}</div>
        {read&&passed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ Done</span>}
      </div>
      <div style={{flex:1,overflowY:'auto'}}>
        <div style={{background:C.ink,padding:wide?'32px max(20px, calc((100% - 760px) / 2)) 28px':'24px 20px 22px'}}>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{guide.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.55)',fontFamily:C.P,lineHeight:1.6}}>{guide.subtitle}</div>
        </div>
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          <ReadingLayout aside={wide?<>
            {personal&&<div style={{padding:'12px 14px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.cr,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>For you</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{personal}</div>
          </div>}
          <div style={{background:passed?C.greenBg:C.crSoft,borderRadius:16,padding:'16px',border:`1px solid ${passed?C.green+'30':C.crDim}`,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:17,fontWeight:700,color:passed?C.green:C.cr,fontFamily:C.P}}>{passed?'You\'ve got this one':'Check yourself'}</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{passed?'Every question answered. It counts towards your Mastery.':`${p.total} quick questions on this guide${p.correct?` · ${p.correct}/${p.total} answered so far`:''}. Reading it and passing them counts towards your Mastery.`}</div>
            <Btn primary full onClick={check}>{passed?'Practise again':'Answer the questions'}</Btn>
            {!read&&<Btn full onClick={markRead}>Mark as read · +50 XP</Btn>}
          </div>
          {guide.tryIt&&<div role="button" onClick={()=>{ markRead(); nav(guide.tryIt.nav); }} style={{padding:'12px 14px',borderRadius:14,background:C.white,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <Icon n="bolt" sz={18} col={C.cr}/>
            <span style={{flex:1,fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Try it: {guide.tryIt.label}</span>
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>}
          </>:null}>
          {!wide&&personal&&<div style={{padding:'12px 14px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.cr,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>For you</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{personal}</div>
          </div>}
          {guide.sections.map((sec,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={sec.iconName||'read'} sz={20} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:C.P}}>{sec.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P}}>{sec.plain}</div>
                </div>
              </div>
              <div style={{fontSize:16,color:C.ink2,fontFamily:C.P,lineHeight:1.7}}>{sec.detail}</div>
              {sec.examples&&sec.examples.length>0&&<div style={{background:C.offWhite,borderRadius:10,padding:'10px 14px'}}>
                {sec.examples.map((ex,j)=>(
                  <div key={j} style={{display:'flex',gap:8,alignItems:'flex-start',marginBottom:j<sec.examples.length-1?6:0}}>
                    <div style={{width:4,height:4,borderRadius:2,background:C.cr,marginTop:10,flexShrink:0}}/>
                    <span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{ex}</span>
                  </div>
                ))}
              </div>}
            </div>
          ))}
          {!wide&&<>
          <div style={{background:passed?C.greenBg:C.crSoft,borderRadius:16,padding:'16px',border:`1px solid ${passed?C.green+'30':C.crDim}`,display:'flex',flexDirection:'column',gap:10}}>
            <div style={{fontSize:17,fontWeight:700,color:passed?C.green:C.cr,fontFamily:C.P}}>{passed?'You\'ve got this one':'Check yourself'}</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{passed?'Every question answered. It counts towards your Mastery.':`${p.total} quick questions on this guide${p.correct?` · ${p.correct}/${p.total} answered so far`:''}. Reading it and passing them counts towards your Mastery.`}</div>
            <Btn primary full onClick={check}>{passed?'Practise again':'Answer the questions'}</Btn>
            {!read&&<Btn full onClick={markRead}>Mark as read · +50 XP</Btn>}
          </div>
          {guide.tryIt&&<div role="button" onClick={()=>{ markRead(); nav(guide.tryIt.nav); }} style={{padding:'12px 14px',borderRadius:14,background:C.white,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
            <Icon n="bolt" sz={18} col={C.cr}/>
            <span style={{flex:1,fontSize:15,fontWeight:700,color:C.ink,fontFamily:C.P}}>Try it: {guide.tryIt.label}</span>
            <Icon n="chevron" sz={13} col={C.mid}/>
          </div>}
          </>}
          </ReadingLayout>
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{GuideScreen});

/* ── GENERATED ARTICLE SCREEN ── */
function GenArticleScreen({nav,back,showPro}){
  const wide=useWide();
  const stub=React.useMemo(()=>{
    try{ return Handoff.genArticle.get(); }catch(e){ return null; }
  },[]);

  const cacheKey=stub?`vinterest_gen_article_${stub.id}_content`:null;

  const [completed,setCompleted]=React.useState(()=>!!stub&&LearnProgress.articleDone(stub.id));
  // Cached as {sections, forYou}; articles written before forYou existed are a bare array.
  const [cached,setCached]=React.useState(()=>{
    if(!cacheKey) return null;
    // v2: articles written by the first personal brief (a forYou line, no v) could pull in a
    // different wine type than the piece's, so they're rewritten once.
    const c=Cache.get(cacheKey,null); return Array.isArray(c)?{sections:c}:c&&c.forYou&&!c.v?null:c;
  });
  const sections=cached&&cached.sections;
  const because=React.useMemo(()=>stub?ContentEngine.because(stub):null,[stub&&stub.id]);
  const ctx=React.useMemo(()=>stub?ContentEngine.context(stub):{bottles:[]},[stub&&stub.id]);
  const [generating,setGenerating]=React.useState(false);

  React.useEffect(()=>{
    if(!stub||sections||generating) return;
    setGenerating(true);
    const wines=WineHistory.getAll();
    const types=[...new Set(wines.map(w=>(w.type||'red').toLowerCase()))].join(', ');
    const regions=[...new Set(wines.map(w=>WineDNA.region(w)||w.country).filter(Boolean))].slice(0,5).join(', ');
    const grapes=[...new Set(wines.flatMap(w=>w.grapes||[]).filter(Boolean))].slice(0,6).join(', ');
    const prompt=_fillTpl(_loadText('prompts/gen-article.txt'),{depth:UserPrefs.depthLine(),types,regions,grapes,reader:ContentEngine.readerBrief(stub,wines),because:ContentEngine.because(stub,wines),title:stub.title,brief:stub.brief||'Write a clear, specific educational piece on the title above.',facts:stub.facts||'No specific retrieved facts — keep claims general and hedge appropriately.'});

    window.claude.complete({purpose:'learn_article',messages:[{role:'user',content:prompt}]})
      .then(text=>{
        try{
          let clean=text.replace(/```json|```/g,'').trim();
          const s=clean.indexOf('{'),e=clean.lastIndexOf('}');
          if(s>=0&&e>s) clean=clean.slice(s,e+1);
          const parsed=JSON.parse(clean);
          const out={v:2,sections:parsed.sections||[],forYou:typeof parsed.forYou==='string'?parsed.forYou:null};
          Cache.set(cacheKey,out);
          setCached(out);
        }catch(err){}
      })
      .catch(()=>{})
      .finally(()=>setGenerating(false));
  },[stub?.id]);

  function markRead(){
    if(completed||!stub) return;
    XPSystem.awardAndToast([{type:'article',articleKey:stub.id}]);
    LearnProgress.markArticle(stub.id);
    setCompleted(true);
  }

  const forYou=(cached&&stub&&ContentEngine.forYouLine(stub,cached.forYou))||'Nobody else gets this article. It\'s written from your WineDNA: the wines you\'ve scanned, how you rated them and what you paid.';
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
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>Written for you · {stub.readTime}</div>
        </div>
        {completed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ +50 XP</span>}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* Hero */}
        <div style={{background:C.ink,padding:wide?'32px max(20px, calc((100% - 760px) / 2)) 28px':'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n={stub.iconName||'read'} sz={14} col="rgba(255,255,255,0.6)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Written for you</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{stub.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.65}}>{stub.subtitle}</div>
          {because&&<div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.75)',fontFamily:C.P,marginTop:12}}>{because}.</div>}
        </div>
        {!wide&&<div style={{margin:'14px 20px 0',padding:'12px 14px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{forYou}</div>
        </div>}

        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {/* On an iPad: why it's for them, their bottles it draws on and where to go deeper, beside the text. */}
          <ReadingLayout aside={wide?<>
            <div style={{..._asideCard,background:C.crSoft,border:`1px solid ${C.crDim}`}} data-testid="aside-why">{_asideHead('Why this is for you')}<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{forYou}</div></div>
            <_AsideWines wines={ctx.bottles} nav={nav} title="Your bottles in this piece"/>
            <_AsideLinks links={[ctx.grape&&{t:`${ctx.grape}: the grape's page`,icon:'grape',go:()=>openGrapePage(ctx.grape,nav)},
              ctx.region&&{t:`${ctx.region}: the region's page`,icon:'map',go:()=>openRegionPage(ctx.region,nav)},
              ctx.grape&&{t:`Take the ${ctx.grape} quiz`,icon:'trophy',go:()=>_openLearn({kind:'grape',grape:ctx.grape},nav,showPro||(()=>{}))},
              ctx.region&&{t:`Take the ${ctx.region} quiz`,icon:'trophy',go:()=>_openLearn({kind:'region',region:ctx.region},nav,showPro||(()=>{}))}]}/>
          </>:null}>
          {/* Loading state */}
          {generating&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:14}}>
              <WritingWait sub="Your article" wine={null}/>
            </div>
          )}

          {/* Sections */}
          {sections&&sections.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={s.iconName||'read'} sz={22} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:21,fontWeight:800,color:C.ink,fontFamily:C.P,marginBottom:3}}>{s.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,marginBottom:10}}>{s.plain}</div>
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
                    <Btn primary onClick={()=>nav('learn')}>Reading List</Btn>
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
          </ReadingLayout>
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{LearnArticleScreen,GenArticleScreen});

/* ── A grape's own page ──
   Opened from Mastery's grape bunches. An annotated ink-and-wash sketch of the grape's bunch
   (pwa-sketch.jsx; its berry size, how tight the bunch is and what stands out, from
   data/knowledge.json's `look`), where they stand with it and the next step, then what it
   tastes like, where it comes from and grows, the wines made from it, and how climate,
   winemaking, food and age change it (GrapeInfo in pwa-grape-learning.js). */
const _SKIN_LABEL={red:'Red-skinned',white:'White-skinned',pink:'Pink-skinned'};
function _wrapWords(text,max){ const out=[]; let line=''; String(text).split(' ').forEach(w=>{ if((line+' '+w).trim().length>max&&line){ out.push(line); line=w; } else line=(line+' '+w).trim(); }); if(line) out.push(line); return out; }
/* `notes` replaces the callouts (the reveal writes two: skin and bunch); `ink` is the pen's colour
   (a light one on the reveal's dark stage, where it's drawn straight onto the background); `animate` draws it in:
   the berries pop in one by one, then each arrow draws and its words appear (the reveal's
   rv-pop, rv-draw and rv-in classes; on the grape page it stands still). */
function GrapeSketch({info,notes:givenNotes,animate=false,ink=SKETCH_INK}){
  const {n,fill}=GrapeInfo.sketch(info.look);
  const L=KnowledgeMap.bunchSlots(n,{fill,seed:info.name});
  const W=340, H=260, BW=150, TOP=46;
  const k=Math.min(BW/L.w,(H-TOP-14)/L.h), xs=L.slots.map(p=>p.x), x0=20+BW/2-(Math.max(...xs)+Math.min(...xs))/2*k;
  const rnd=KnowledgeMap._rng('look'+info.name);
  const berries=[...L.slots].map((p,i)=>({...p,i,green:info.look.uneven&&rnd()<0.35,ripe:rnd()<0.3})).sort((a,b)=>a.y-b.y);
  const wash=b=>b.green?SKETCH_WASH.green:info.look.russet&&b.i%2?SKETCH_WASH.russet:null;
  const notes=givenNotes||[_SKIN_LABEL[info.skin],...(info.look.notes||[])].slice(0,4);
  const berryDelay=i=>animate?{animationDelay:`${(0.2+i*0.07).toFixed(2)}s`}:undefined, noteAt=i=>0.4+berries.length*0.07+i*0.9;
  const ys=notes.map((_,i)=>TOP+18+i*((H-TOP-30)/Math.max(1,notes.length)));
  const edge=y=>{ const near=L.slots.filter(p=>Math.abs(TOP+k+p.y*k-y)<k*1.4); const p=near.length?near.reduce((a,b)=>b.x>a.x?b:a):L.slots[0]; return [x0+p.x*k+k*0.9,TOP+k+p.y*k]; };
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Sketch of ${info.name}: ${notes.join('; ')}.`} data-testid="grape-sketch" style={{display:'block',maxWidth:460,margin:'0 auto',overflow:'visible'}}>
      <SketchVine x={x0} y={TOP-k*0.2} s={1.5} leafRed={info.look.leaf==='red'} ink={ink}/>
      {berries.map((b,j)=><g key={b.i} transform={`translate(${(x0+b.x*k).toFixed(1)} ${(TOP+k+b.y*k).toFixed(1)})`}>
        <g className={animate?'rv-pop':undefined} style={berryDelay(j)}><g transform={`scale(${k.toFixed(2)})`}>
          <SketchBerry seed={info.name+b.i} skin={info.skin} state={b.ripe?'ripe':'grow'} wash={wash(b)} ink={ink}/>
        </g></g>
      </g>)}
      {notes.map((t,i)=>{ const [ex,ey]=edge(ys[i]), tx=196, lines=_wrapWords(t,22);
        return <g key={i}>
          <path d={`M${tx-6} ${ys[i]-4} Q ${(tx+ex)/2} ${ys[i]-10} ${ex+2} ${ey}`} fill="none" stroke={ink} strokeWidth="0.8" opacity="0.7" pathLength="1" className={animate?'rv-draw':undefined} style={animate?{animationDelay:`${noteAt(i)}s`}:undefined}/>
          <circle cx={ex+2} cy={ey} r="1.6" fill={ink} className={animate?'rv-in':undefined} style={animate?{animationDelay:`${noteAt(i)+0.5}s`}:undefined}/>
          <text x={tx} y={ys[i]} className={animate?'rv-in':undefined} style={{fontSize:'12px',fill:ink,fontFamily:C.P,...(animate?{animationDelay:`${noteAt(i)+0.2}s`}:{})}}>
            {lines.map((l,j)=><tspan key={j} x={tx} dy={j?15:0}>{l}</tspan>)}
          </text>
        </g>; })}
    </svg>
  );
}
function GrapeScreen({nav,back,showPro}){
  const name=Handoff.grapePage.get();
  const info=React.useMemo(()=>name?GrapeInfo.get(name):null,[name]);
  const card={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8};
  const head=t=><div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>{t}</div>;
  const para=t=><div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{t}</div>;
  if(!info) return <div style={{flex:1,padding:24,fontFamily:C.P,color:C.mid}}>That grape isn't in the guide yet. <span role="button" onClick={back} style={{color:C.cr,fontWeight:700,cursor:'pointer'}}>Back</span></div>;
  const ms=info.mastery;
  const act=()=>{
    if(ms.state==='open') return _openLearn({kind:'grape',grape:info.name},nav,showPro);
    if(ms.state==='held') return showPro('grape-library');
    if(!Entitlement.isPro()) return;
    GrapeUnlocks.unlockManual(info.name); _openLearn({kind:'grape',grape:info.name},nav,showPro);
  };
  const actLabel=ms.state==='open'?(ms.fading?`Refresh the ${info.name} quiz`:ms.score>=100?null:`Take the ${info.name} quiz`):ms.state==='held'?'Unlock with Pro':!Entitlement.isPro()?null:`Unlock and take the quiz`;
  const openMine=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };
  const rows=[['Climate',info.climate],['In the winery',info.winemaking],['With food',info.food],['Ageing',info.ageing],['Often compared with',info.lookalike],['In blends',info.blends]].filter(r=>r[1]);
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><Icon n="back" sz={16} col={C.ink}/></div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>{info.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{_SKIN_LABEL[info.skin]} grape{info.type==='fortified'?' · best known in Port':info.type==='dessert'?' · famous for sweet wines':''}</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{...card,background:'#FBF8F3',padding:'10px 10px 6px'}}><GrapeSketch info={info}/></div>

        <div style={card} data-testid="grape-progress">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline'}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{ms.state==='open'?`${ms.level} · ${ms.score}%`:ms.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet'}<RiseTag n={ms.rise} style={{marginLeft:8,fontSize:13}}/></span>
            {ms.fading>0&&<span style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P}}>{ms.fading} answer{ms.fading===1?'':'s'} fading</span>}
          </div>
          {ms.state==='open'&&<MasteryBar score={ms.score} col={grapeTypeColor(info.name)}/>}
          {info.mine.count>0&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
            You've had {info.mine.count===1?'one bottle':`${info.mine.count} bottles`} of it{info.mine.best?`; your best was ${info.mine.best.name} (${info.mine.best.rating})`:''}.
          </div>}
          {ms.state==='locked'&&!actLabel&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>The next bottle of it you scan unlocks its quiz.</div>}
          {actLabel&&<div role="button" onClick={act} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{actLabel} →</div>}
        </div>

        {head('What it tastes like')}
        <div style={card}>{para(info.profile+'.')}</div>

        {head('Where it comes from')}
        <div style={card}>
          {para(info.origin+'.')}
          {info.aka&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>{info.aka}.</div>}
        </div>

        {head('Where it grows')}
        <div style={{...card,flexDirection:'row',flexWrap:'wrap',gap:6}}>
          {[...new Set([...(info.famousIn||[]),...info.regions])].map(r=>(
            <span key={r} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:999,border:`1px solid ${C.line}`,fontSize:13,color:C.ink2,fontFamily:C.P}}><Flag region={r} size={13}/>{r}</span>
          ))}
        </div>

        {head('Wines made from it')}
        <div style={{...card,flexDirection:'row',flexWrap:'wrap',gap:6}}>
          {(info.wines||[]).map(w=><span key={w} style={{padding:'5px 10px',borderRadius:999,background:C.offWhite,fontSize:13,color:C.ink2,fontFamily:C.P}}>{w}</span>)}
        </div>

        {info.mine.count>0&&<>
          {head(`Your bottles of ${info.name}`)}
          <div data-testid="grape-my-wines" style={{...card,gap:0,padding:'4px 16px'}}>
            {info.mine.wines.map((w,i)=>(
              <div key={(w.name||'')+'|'+(w.vintage||'')+'|'+i} role="button" tabIndex={0} onClick={()=>openMine(w)}
                onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openMine(w); } }}
                style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:i?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.name}</div>
                  <div style={{display:'flex',alignItems:'center',gap:5,fontSize:13,color:C.mid,fontFamily:C.P,minWidth:0}}>
                    <Flag wine={w} size={13}/>
                    <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{[w.producer,w.region,w.vintage].filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
                {w.rating>0?<span style={{fontSize:16,fontWeight:800,color:scoreCol(w.rating),fontFamily:C.P}}>{w.rating}</span>
                  :<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Not rated</span>}
                <Icon n="chevron" sz={14} col={C.mid}/>
              </div>
            ))}
          </div>
        </>}

        {head('From vine to glass')}
        <div style={{...card,gap:12}}>
          {rows.map(([l,t])=><div key={l}>
            <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P}}>{l}</div>
            <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{t}.</div>
          </div>)}
        </div>
        <div style={{height:12}}/>
      </div>
    </div>
  );
}

/* ── A region's own page ──
   Opened from the wine map's card ("More about …") or the region list, like a grape's page: where
   they stand with it and its next step, then its checked facts from the knowledge base (rules and
   classification, climate, ageing, the producers to know), the grapes it's known for (each opens
   its own page), the places inside it, and every bottle of theirs from it, best score first, each
   opening its wine (RegionInfo in pwa-content-engine.js). */
function RegionPageScreen({nav,back,showPro}){
  const name=Handoff.regionPage.get();
  const info=React.useMemo(()=>name?RegionInfo.get(name):null,[name]);
  const card={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8};
  const head=t=><div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>{t}</div>;
  if(!info) return <div style={{flex:1,padding:24,fontFamily:C.P,color:C.mid}}>That region isn't in the guide yet. <span role="button" onClick={back} style={{color:C.cr,fontWeight:700,cursor:'pointer'}}>Back</span></div>;
  const ms=info.mastery;
  const act=()=>{
    if(ms.state==='open') return _openLearn({kind:'region',region:info.name},nav,showPro);
    if(ms.state==='held') return showPro('regions');
  };
  const actLabel=ms.state==='open'?(ms.fading?`Refresh the ${info.name} quiz`:ms.score>=100?null:`Take the ${info.name} quiz`):ms.state==='held'?'Unlock with Pro':null;
  const openMine=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };
  const facts=[['How it\'s classified',info.classification],['Climate',info.climate],['Ageing rules',info.agingRules],['Producers to know',(info.classicProducers||[]).join(', ')]].filter(r=>r[1]);
  const wide=useWide();
  const mineCard=info.mine.count>0&&<div>
    {head(`Your bottles from ${info.name}`)}
    <div data-testid="region-my-wines" style={{...card,gap:0,padding:'4px 16px',marginTop:8}}>
      {info.mine.wines.map((w,i)=>(
        <div key={(w.name||'')+'|'+(w.vintage||'')+'|'+i} role="button" tabIndex={0} onClick={()=>openMine(w)}
          onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openMine(w); } }}
          style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:i?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{w.name}</div>
            <div style={{fontSize:13,color:C.mid,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{[w.producer,w.sub_region||w.region,w.vintage].filter(Boolean).join(' · ')}</div>
          </div>
          {w.rating>0?<span style={{fontSize:16,fontWeight:800,color:scoreCol(w.rating),fontFamily:C.P}}>{w.rating}</span>
            :<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Not rated</span>}
          <Icon n="chevron" sz={14} col={C.mid}/>
        </div>
      ))}
    </div>
  </div>;
  const factsCard=<div>
    {head('At a glance')}
    <div style={{...card,gap:12,marginTop:8}}>
      {facts.map(([l,t])=><div key={l}>
        <div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P}}>{l}</div>
        <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{String(t).replace(/\.+$/,'')}.</div>
      </div>)}
    </div>
  </div>;
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><Icon n="back" sz={16} col={C.ink}/></div>
        <Flag region={info.name} size={24}/>
        <div style={{minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>{info.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>{info.country} · wine region</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
        <div style={{maxWidth:wide?1100:undefined,margin:'0 auto',display:'flex',flexDirection:'column',gap:12}}>
        <div style={card} data-testid="region-progress">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:8,flexWrap:'wrap'}}>
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{ms.state==='open'?`${ms.level} · ${ms.score}%`:ms.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet'}<RiseTag n={ms.rise} style={{marginLeft:8,fontSize:13}}/></span>
            {ms.fading>0&&<span style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P}}>{ms.fading} answer{ms.fading===1?'':'s'} fading</span>}
          </div>
          {ms.state==='open'&&<MasteryBar score={ms.score} col={C.cr}/>}
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
            {info.mine.count>0?<>You've had {info.mine.count===1?'one bottle':`${info.mine.count} bottles`} from {info.name}{info.mine.avg!=null?`, rated ${info.mine.avg} on average`:''}{info.mine.best?`; your best was ${info.mine.best.name} (${info.mine.best.rating})`:''}.</>
              :`You haven't had a bottle from ${info.name} yet.`}
          </div>
          {ms.state==='locked'&&!actLabel&&<div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5}}>{`The next bottle from ${info.name} you scan unlocks its quiz.`}</div>}
          {actLabel&&<div role="button" onClick={act} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>{actLabel} →</div>}
        </div>

        <div style={{display:'grid',gridTemplateColumns:wide?'minmax(0,1fr) minmax(0,1fr)':'minmax(0,1fr)',gap:12,alignItems:'start'}}>
          {factsCard}
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div>
              {head('The grapes it\'s known for')}
              <div style={{...card,flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8}}>
                {info.grapes.map(g=>{ const known=typeof KNOWLEDGE!=='undefined'&&KNOWLEDGE.grapes&&KNOWLEDGE.grapes[g];
                  return <span key={g} role={known?'button':undefined} onClick={known?()=>openGrapePage(g,nav):undefined}
                    style={{display:'inline-flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:999,background:grapeTypeColor(g)+'15',border:`1px solid ${grapeTypeColor(g)}40`,fontSize:14,fontWeight:600,color:grapeTypeColor(g),fontFamily:C.P,cursor:known?'pointer':'default'}}>{g}{known&&<Icon n="chevron" sz={11} col={grapeTypeColor(g)}/>}</span>; })}
              </div>
            </div>
            {info.places.length>0&&<div>
              {head('Places inside it')}
              <div style={{...card,flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:8}}>
                {info.places.slice(0,16).map(r=><span key={r} style={{padding:'5px 10px',borderRadius:999,background:info.theirs.includes(r)?C.crSoft:C.offWhite,fontSize:13,color:info.theirs.includes(r)?C.cr:C.ink2,fontWeight:info.theirs.includes(r)?700:400,fontFamily:C.P}}>{r}</span>)}
              </div>
              {info.theirs.length>0&&<div style={{fontSize:12,color:C.mid,fontFamily:C.P,marginTop:4}}>Highlighted: the ones on your own labels.</div>}
            </div>}
          </div>
        </div>
        {mineCard}
        <div style={{height:12}}/>
        </div>
      </div>
    </div>
  );
}

/* ── A palate trait's own page ──
   Opened from Mastery's palate tiles, like a grape's page from the bunches: the trait sketched
   in its ring with how close their Blind Calls come on it, any habit, then what it is, how to
   notice it, wines at either end of its scale and a tip (Palate.TRAITS), then every Blind Call
   on it: their guess and the label's profile in words, and how close it was, each opening its
   wine. The next step is another Blind Call, or the tasting guide that teaches it. */
function PalateTraitScreen({nav,back}){
  const id=Handoff.palateTrait.get();
  const t=React.useMemo(()=>id&&Palate.TRAITS[id]?Palate.trait(id):null,[id]);
  const card={background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8};
  const head=x=><div style={{fontSize:13,fontWeight:600,color:C.mid,letterSpacing:'0.08em',textTransform:'uppercase',fontFamily:C.P,marginTop:4}}>{x}</div>;
  if(!t) return <div style={{flex:1,padding:24,fontFamily:C.P,color:C.mid}}>That trait isn't here. <span role="button" onClick={back} style={{color:C.cr,fontWeight:700,cursor:'pointer'}}>Back</span></div>;
  const R=44, circ=2*Math.PI*R, ring=SKETCH_TRAIT[t.id];
  const openWine=w=>{ Handoff.openWine({demo:false,wine:w,existingRating:w.rating||0}); nav('detail'); };
  const [lo,hi]=t.words;
  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div role="button" aria-label="Back" onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}><Icon n="back" sz={16} col={C.ink}/></div>
        <div style={{minWidth:0}}>
          <div style={{fontSize:20,fontWeight:800,color:C.ink,fontFamily:C.P,letterSpacing:'-0.4px'}}>{t.name}</div>
          <div style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Your palate · from {lo} to {hi}</div>
        </div>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
        <div data-testid="trait-hero" style={{...card,background:'#FBF8F3',flexDirection:'row',alignItems:'center',gap:14}}>
          <svg width="110" height="110" viewBox="-55 -55 110 110" aria-hidden="true" style={{flexShrink:0,overflow:'visible'}}>
            <circle r={R} fill="none" stroke={SKETCH_PENCIL} strokeWidth="3.5" strokeDasharray="1 5" strokeLinecap="round"/>
            {t.score!=null&&<circle r={R} fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ*(1-t.score/100)} transform="rotate(-90)"/>}
            <g transform="scale(1.35)"><SketchTraitIcon id={t.id}/></g>
          </svg>
          <div style={{display:'flex',flexDirection:'column',gap:2,minWidth:0}}>
            <span style={{fontSize:34,fontWeight:800,color:t.score==null?C.mid:C.ink,fontFamily:C.P,lineHeight:1.05}}>{t.score==null?'–':`${t.score}%`}</span>
            <span style={{fontSize:14,fontWeight:600,color:C.ink2,fontFamily:C.P}}>{t.score==null?'No Blind Calls yet':`${t.level} · ${t.n} call${t.n===1?'':'s'}`}</span>
            <span style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>{t.score==null?`Your Blind Calls on ${t.name.toLowerCase()} will show here.`:`How close your calls come to the label on ${t.name.toLowerCase()}.`}</span>
          </div>
        </div>
        {t.lean&&<div style={{...card,background:'#FFF4E0',border:'none'}}><span style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}><b>Your habit:</b> you tend to call {t.name.toLowerCase()} {t.lean} than the label's profile. Next time, try calling it a little {Palate.LEAN[t.id][0]===t.lean?Palate.LEAN[t.id][1]:Palate.LEAN[t.id][0]}.</span></div>}

        {head('What it is')}
        <div style={card}><span style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{t.what}</span></div>

        {head('How to notice it')}
        <div style={{...card,gap:10}}>
          {t.notice.map((x,i)=><div key={i} style={{display:'flex',gap:10}}>
            <span style={{width:22,height:22,borderRadius:11,background:'#FBF8F3',border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:C.ink2,fontFamily:C.P,flexShrink:0}}>{i+1}</span>
            <span style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{x}</span>
          </div>)}
        </div>

        {head(`From ${lo} to ${hi}`)}
        <div style={{...card,gap:10}}>
          <div><div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,textTransform:'capitalize'}}>{lo}</div><div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{t.low}</div></div>
          <div><div style={{fontSize:13,fontWeight:700,color:C.ink,fontFamily:C.P,textTransform:'capitalize'}}>{hi}</div><div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>{t.high}</div></div>
          <div style={{fontSize:14,color:C.mid,fontFamily:C.P,lineHeight:1.5,borderTop:`1px solid ${C.line}`,paddingTop:10}}><b style={{color:C.ink2}}>Tip:</b> {t.tip}</div>
        </div>

        {head('Your Blind Calls')}
        {t.calls.length?<div data-testid="trait-calls" style={{...card,gap:0,padding:'4px 16px'}}>
          <ShowMore items={t.calls} limit={DNA_TRAIT_BOTTLES} noun={t.calls.length-DNA_TRAIT_BOTTLES===1?'call':'calls'} render={(c,i)=><div key={i} role="button" tabIndex={0} onClick={()=>openWine(c.wine)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openWine(c.wine); } }}
            style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:i?`1px solid ${C.line}`:'none',cursor:'pointer'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:600,color:C.ink,fontFamily:C.P,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.wine.name}{c.wine.vintage?` ${c.wine.vintage}`:''}</div>
              <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.4}}>You: {c.said} · Label: {c.labelSaid}</div>
            </div>
            <span style={{fontSize:16,fontWeight:800,color:c.accuracy>=80?C.green:c.accuracy>=50?C.amber:'#B04A3A',fontFamily:C.P}}>{c.accuracy}%</span>
            <Icon n="chevron" sz={14} col={C.mid}/>
          </div>}/>
        </div>:<div style={card}><span style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>Blind Call asks you to taste before you see the label's profile. Play it on your next bottle and your call on {t.name.toLowerCase()} lands here.</span></div>}
        <div style={{fontSize:13,color:C.mid,fontFamily:C.P,lineHeight:1.45}}>The label's profile is an estimate from the wine's details, so treat these as a guide, not a verdict on your palate.</div>

        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div role="button" onClick={()=>nav('camera')} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Play Blind Call on your next bottle →</div>
          {t.guide&&<div role="button" onClick={()=>{ Handoff.guide.set(t.guide.id); nav('guide'); }} style={{fontSize:14,fontWeight:700,color:C.cr,fontFamily:C.P,cursor:'pointer'}}>Read "{t.guide.title}" →</div>}
        </div>
        <div style={{height:12}}/>
      </div>
    </div>
  );
}
