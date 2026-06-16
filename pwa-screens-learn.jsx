/* Vinterest — Learn Article Screen */

function LearnArticleScreen({nav,back}){
  const [completed,setCompleted]=React.useState(()=>!!localStorage.getItem('vinterest_article_1_done'));

  const SECTIONS=[
    {term:'Body',emoji:'⚖️',plain:'How heavy a wine feels in your mouth',
     detail:"Think of it like milk: skimmed versus whole. A light-bodied wine feels delicate and clean; a full-bodied wine feels rich and coat-your-mouth weighty. Alcohol is the main driver — wines above 13.5% ABV typically feel fuller.",
     examples:['Light: Pinot Grigio, Pinot Noir, Vinho Verde','Medium: Merlot, Grenache, Viognier','Full: Cabernet Sauvignon, Barolo, oaked Chardonnay']},
    {term:'Tannins',emoji:'🪵',plain:'That drying grip on your gums after you swallow',
     detail:"Tannins come from grape skins, seeds, stems, and oak barrels. They create that dry, slightly astringent sensation — like biting into an unripe banana or drinking strong black tea. High-tannin wines age brilliantly; low-tannin wines are approachable young.",
     examples:['High: Barolo, Nebbiolo, Cabernet Sauvignon, Tannat','Medium: Merlot, Syrah, Sangiovese, Malbec','Low: Pinot Noir, Grenache, Gamay, Barbera']},
    {term:'Acidity',emoji:'⚡',plain:'How zingy and fresh the wine tastes',
     detail:"Acidity is what makes your mouth water. High-acid wines feel bright, crisp, and food-friendly — they cut through fat and cleanse the palate. Low-acid wines feel softer, rounder, and more plush. If you love Sauvignon Blanc, you love high acidity.",
     examples:['High: Riesling, Sauvignon Blanc, Chablis, Pinot Grigio','Medium: Chardonnay (oaked), Grenache, Sangiovese','Low: Viognier, Gewürztraminer, Muscat Blanc']},
    {term:'Sweetness',emoji:'🍯',plain:'From bone dry to lusciously sweet',
     detail:"Most table wines are dry — yeast converts nearly all grape sugar into alcohol during fermentation. Off-dry wines have a subtle sweetness. Dessert wines are intentionally sweet, either from late harvest, noble rot, or stopping fermentation early.",
     examples:['Bone dry: Muscadet, Chablis, most Champagne (Brut)','Off-dry: Spätlese Riesling, Vouvray demi-sec, Gewürztraminer','Sweet: Sauternes, Tokaji, Port, Moscato d\'Asti']},
    {term:'Finish',emoji:'🎵',plain:'How long the flavour lingers after you swallow',
     detail:"The finish is the aftertaste — how long the wine's flavours persist after swallowing. A great wine has a long, evolving finish. Sommeliers measure this in caudalies: each cauda equals one second of lingering flavour. 10 seconds is good; 30+ is exceptional.",
     examples:['Short: Most entry-level wines (under £12)','Medium: Mid-range bottles — a pleasant 5–10 seconds','Long: Premier Cru Burgundy, Barolo Riserva, Grand Cru Alsace']},
  ];

  function markRead(){
    if(completed) return;
    const d=XPSystem.get();
    if(!d.events.includes('article_read_1')){
      d.events.push('article_read_1');
      d.total+=25;
      XPSystem.save(d);
      XPSystem.toast([{label:'Article completed! 📚',amount:25,bonus:true}]);
    }
    localStorage.setItem('vinterest_article_1_done','1');
    setCompleted(true);
  }

  return(
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:C.white,padding:'14px 20px',display:'flex',alignItems:'center',gap:12,borderBottom:`1px solid ${C.line}`,flexShrink:0}}>
        <div onClick={back} style={{width:34,height:34,borderRadius:17,background:C.offWhite,border:`1px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
          <Icon n="back" sz={16} col={C.ink}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:15,color:C.mid,fontFamily:C.P,fontWeight:500}}>Tasting Fundamentals · 2 min</div>
        </div>
        {completed&&<span style={{fontSize:15,fontWeight:700,color:C.green,fontFamily:C.P}}>✓ +25 XP</span>}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {/* Hero */}
        <div style={{background:C.ink,padding:'24px 20px 22px'}}>
          <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 12px',borderRadius:20,background:'rgba(255,255,255,0.1)',marginBottom:12}}>
            <Icon n="book" sz={12} col="rgba(255,255,255,0.55)"/>
            <span style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.55)',fontFamily:C.P}}>Quick Read</span>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:'#fff',fontFamily:C.P,lineHeight:1.2,marginBottom:10}}>5 taste terms every wine drinker should know</div>
          <div style={{fontSize:16,color:'rgba(255,255,255,0.42)',fontFamily:C.P,lineHeight:1.65}}>These are the words sommeliers use. Here's what they actually mean for your glass.</div>
        </div>

        {/* Sections */}
        <div style={{padding:'16px 20px',display:'flex',flexDirection:'column',gap:12}}>
          {SECTIONS.map((s,i)=>(
            <div key={i} style={{background:C.white,borderRadius:16,overflow:'hidden',border:`1px solid ${C.line}`}}>
              <div style={{padding:'14px 16px 0',display:'flex',gap:12,alignItems:'flex-start'}}>
                <div style={{width:46,height:46,borderRadius:12,background:C.offWhite,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{s.emoji}</div>
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
                <div style={{fontSize:32,marginBottom:8}}>🎓</div>
                <div style={{fontSize:19,fontWeight:700,color:C.green,fontFamily:C.P,marginBottom:4}}>Nice work!</div>
                <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55,marginBottom:14}}>Next time you scan a bottle, you'll know exactly what those tasting notes mean.</div>
                <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                  <Btn onClick={()=>nav('learn')}>More quizzes</Btn>
                  <Btn primary onClick={()=>nav('camera')}>Scan a bottle</Btn>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:17,fontWeight:700,color:C.cr,fontFamily:C.P,marginBottom:4}}>Finished reading?</div>
                <div style={{fontSize:15,color:C.mid,fontFamily:C.P,lineHeight:1.5,marginBottom:14}}>Mark as complete to earn +25 XP</div>
                <Btn primary full onClick={markRead}>Mark as Read · +25 XP</Btn>
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
