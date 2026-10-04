/* Vinterest — On-Ramp Article Screen (data-driven from data/onramp.json) */
function _loadText(path){ return _loadTextSync(path); }
function _fillTpl(tpl,vars){ let s=tpl; Object.keys(vars).forEach(k=>{ s=s.split('{{'+k+'}}').join(vars[k]??''); }); return s; }
let ON_RAMP=[];
try{ ON_RAMP=_loadJSON('data/onramp.json')||[]; }catch(e){ console.error('[Vinterest] onramp.json failed to load — the Learn tab will be missing its on-ramp articles until it is deployed.',e); }
function onRampDone(id){ return LearnProgress.onRampDone(id); }
function onRampProgress(){ return ON_RAMP.filter(a=>onRampDone(a.id)).length; }

function LearnArticleScreen({nav,back}){
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
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n="book" sz={12} col="rgba(255,255,255,0.55)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Quick Read</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{article.title}</div>
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
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{guide.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.55)',fontFamily:C.P,lineHeight:1.6}}>{guide.subtitle}</div>
        </div>
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {personal&&<div style={{padding:'12px 14px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
            <div style={{fontSize:12,fontWeight:700,color:C.cr,fontFamily:C.P,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>For you</div>
            <div style={{fontSize:15,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{personal}</div>
          </div>}
          {guide.sections.map((sec,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,border:`1px solid ${C.line}`,padding:'14px 16px',display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:42,height:42,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Icon n={sec.iconName||'read'} sz={20} col={C.cr}/></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:19,fontWeight:800,color:C.ink,fontFamily:C.P}}>{sec.term}</div>
                  <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontStyle:'italic'}}>{sec.plain}</div>
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
          <div style={{height:16}}/>
        </div>
      </div>
    </div>
  );
}

Object.assign(window,{GuideScreen});

/* ── GENERATED ARTICLE SCREEN ── */
function GenArticleScreen({nav,back}){
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
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n={stub.iconName||'read'} sz={14} col="rgba(255,255,255,0.6)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Written for you</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>{stub.title}</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.5)',fontFamily:C.P,lineHeight:1.65}}>{stub.subtitle}</div>
          {because&&<div style={{fontSize:14,fontWeight:600,color:'rgba(255,255,255,0.75)',fontFamily:C.P,marginTop:12}}>{because}.</div>}
        </div>
        <div style={{margin:'14px 20px 0',padding:'12px 14px',borderRadius:14,background:C.crSoft,border:`1px solid ${C.crDim}`}}>
          <div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.55}}>{(cached&&ContentEngine.forYouLine(stub,cached.forYou))||'Nobody else gets this article. It\'s written from your WineDNA: the wines you\'ve scanned, how you scored them and what you paid.'}</div>
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

/* ── A grape's own page ──
   Opened from Mastery's grape bunches. An annotated ink-and-wash sketch of the grape's bunch
   (pwa-sketch.jsx; its berry size, how tight the bunch is and what stands out, from
   data/knowledge.json's `look`), where they stand with it and the next step, then what it
   tastes like, where it comes from and grows, the wines made from it, and how climate,
   winemaking, food and age change it (GrapeInfo in pwa-grape-learning.js). */
const _SKIN_LABEL={red:'Red-skinned',white:'White-skinned',pink:'Pink-skinned'};
function _wrapWords(text,max){ const out=[]; let line=''; String(text).split(' ').forEach(w=>{ if((line+' '+w).trim().length>max&&line){ out.push(line); line=w; } else line=(line+' '+w).trim(); }); if(line) out.push(line); return out; }
function GrapeSketch({info}){
  const {n,fill}=GrapeInfo.sketch(info.look);
  const L=KnowledgeMap.bunchSlots(n,{fill,seed:info.name});
  const W=340, H=260, BW=150, TOP=46;
  const k=Math.min(BW/L.w,(H-TOP-14)/L.h), xs=L.slots.map(p=>p.x), x0=20+BW/2-(Math.max(...xs)+Math.min(...xs))/2*k;
  const rnd=KnowledgeMap._rng('look'+info.name);
  const berries=[...L.slots].map((p,i)=>({...p,i,green:info.look.uneven&&rnd()<0.35,ripe:rnd()<0.3})).sort((a,b)=>a.y-b.y);
  const wash=b=>b.green?SKETCH_WASH.green:info.look.russet&&b.i%2?SKETCH_WASH.russet:null;
  const notes=[_SKIN_LABEL[info.skin],...(info.look.notes||[])].slice(0,4);
  const ys=notes.map((_,i)=>TOP+18+i*((H-TOP-30)/Math.max(1,notes.length)));
  const edge=y=>{ const near=L.slots.filter(p=>Math.abs(TOP+k+p.y*k-y)<k*1.4); const p=near.length?near.reduce((a,b)=>b.x>a.x?b:a):L.slots[0]; return [x0+p.x*k+k*0.9,TOP+k+p.y*k]; };
  return(
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Sketch of ${info.name}: ${notes.join('; ')}.`} data-testid="grape-sketch" style={{display:'block',maxWidth:460,margin:'0 auto',overflow:'visible'}}>
      <SketchVine x={x0} y={TOP-k*0.2} s={1.5} leafRed={info.look.leaf==='red'}/>
      {berries.map(b=><g key={b.i} transform={`translate(${(x0+b.x*k).toFixed(1)} ${(TOP+k+b.y*k).toFixed(1)}) scale(${k.toFixed(2)})`}>
        <SketchBerry seed={info.name+b.i} skin={info.skin} state={b.ripe?'ripe':'grow'} wash={wash(b)}/>
      </g>)}
      {notes.map((t,i)=>{ const [ex,ey]=edge(ys[i]), tx=196, lines=_wrapWords(t,22);
        return <g key={i}>
          <path d={`M${tx-6} ${ys[i]-4} Q ${(tx+ex)/2} ${ys[i]-10} ${ex+2} ${ey}`} fill="none" stroke={SKETCH_INK} strokeWidth="0.8" opacity="0.7"/>
          <circle cx={ex+2} cy={ey} r="1.6" fill={SKETCH_INK}/>
          <text x={tx} y={ys[i]} style={{fontSize:'12px',fill:SKETCH_INK,fontFamily:C.P}}>
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
    if(!Entitlement.isPro()) return nav('camera');
    GrapeUnlocks.unlockManual(info.name); _openLearn({kind:'grape',grape:info.name},nav,showPro);
  };
  const actLabel=ms.state==='open'?(ms.fading?`Refresh the ${info.name} quiz`:ms.score>=100?null:`Take the ${info.name} quiz`):ms.state==='held'?'Unlock with Pro':!Entitlement.isPro()?'Scan a bottle of it to unlock':`Unlock and take the quiz`;
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
            <span style={{fontSize:16,fontWeight:700,color:C.ink,fontFamily:C.P}}>{ms.state==='open'?`${ms.level} · ${ms.score}%`:ms.state==='held'?'Unlocked, kept for Pro':'Not unlocked yet'}</span>
            {ms.fading>0&&<span style={{fontSize:13,fontWeight:600,color:C.amber,fontFamily:C.P}}>{ms.fading} answer{ms.fading===1?'':'s'} fading</span>}
          </div>
          {ms.state==='open'&&<MasteryBar score={ms.score} col={grapeTypeColor(info.name)}/>}
          {info.mine.count>0&&<div style={{fontSize:14,color:C.ink2,fontFamily:C.P,lineHeight:1.5}}>
            You've had {info.mine.count===1?'one bottle':`${info.mine.count} bottles`} of it{info.mine.best?`; your best was ${info.mine.best.name} (${info.mine.best.rating})`:''}.
          </div>}
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
                  :<span style={{fontSize:13,color:C.mid,fontFamily:C.P}}>Not scored</span>}
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
