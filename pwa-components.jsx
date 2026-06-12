/* Vinterest PWA — Shared tokens, icons, primitives */

const C = {
  cr:'#8B1A2F', crL:'#B02440', crDim:'rgba(139,26,47,0.13)', crSoft:'rgba(139,26,47,0.07)',
  ink:'#0F0F0F', ink2:'#3A3A3A', mid:'#8A8A8A', line:'#E8E8E8',
  bg:'#FAFAFA', white:'#FFFFFF', offWhite:'#F5F3F0',
  green:'#1E7B4B', greenBg:'#EAF7F0', amber:'#B06C00', amberBg:'#FFF4E0',
  P:"'Poppins',sans-serif",
};

function Icon({n,sz=20,col=C.ink,style:s}){
  const d={
    scan:<><rect x="3" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="11" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="3" y="11" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="14" cy="14" r="2.5" stroke={col} strokeWidth="1.6" fill="none"/><line x1="16.5" y1="16.5" x2="18.5" y2="18.5" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    fork:<><path d="M7 2v5c0 1.5.8 2.5 2 3v8" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M9 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M14 2v4l2-1v-3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6c0 2.5 2 3 2 5v7" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    cart:<><path d="M2 3h2.5l2.2 10h8.6l1.8-7H6.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="17" r="1.2" fill={col}/><circle cx="14.5" cy="17" r="1.2" fill={col}/></>,
    home:<><path d="M3 9.5L10 3l7 6.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M5 8.5V17h4v-4.5h2V17h4V8.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    compass:<><circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.6" fill="none"/><polygon points="10,5.5 12,9.5 10,10.5 8,9.5" fill={col}/><polygon points="10,14.5 8,10.5 10,10.5 12,10.5" fill={col} opacity=".35"/></>,
    book:<><path d="M4 4.5C4 4.5 7 3.5 10 5C13 3.5 16 4.5 16 4.5V15C16 15 13 14 10 15.5C7 14 4 15 4 15V4.5Z" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/><line x1="10" y1="5" x2="10" y2="15.5" stroke={col} strokeWidth="1.2"/></>,
    user:<><circle cx="10" cy="7.5" r="3.2" stroke={col} strokeWidth="1.6" fill="none"/><path d="M3.5 18C3.5 14 6.5 12 10 12s6.5 2 6.5 6" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    back:<polyline points="12,4 5,10 12,16" stroke={col} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevron:<polyline points="7,4 13,10 7,16" stroke={col} strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    heart:<path d="M10 16.5C10 16.5 3 12 3 7.5C3 5 5 3.2 7.2 3.2c1.5 0 2.5 1 2.8 1.8.3-.8 1.3-1.8 2.8-1.8C15 3.2 17 5 17 7.5c0 4.5-7 9-7 9z" stroke={col} strokeWidth="1.6" fill="none"/>,
    share:<><circle cx="14.5" cy="4.5" r="2" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="5.5" cy="10" r="2" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="14.5" cy="15.5" r="2" stroke={col} strokeWidth="1.5" fill="none"/><line x1="7.4" y1="9" x2="12.6" y2="5.5" stroke={col} strokeWidth="1.5"/><line x1="7.4" y1="11" x2="12.6" y2="14.5" stroke={col} strokeWidth="1.5"/></>,
    camera:<><rect x="2.5" y="6" width="15" height="11" rx="2" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="10" cy="11.5" r="3" stroke={col} strokeWidth="1.6" fill="none"/><path d="M7.5 6L8.5 4h3l1 2" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/></>,
    check:<polyline points="3.5,10 7.5,14.5 16.5,5" stroke={col} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    wine:<><path d="M7.5 2.5h5v5c0 3.5-1.8 5-2.5 5S7.5 11 7.5 8V2.5z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><line x1="10" y1="12.5" x2="10" y2="17" stroke={col} strokeWidth="1.5"/><line x1="7" y1="17" x2="13" y2="17" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    globe:<><circle cx="10" cy="10" r="7.5" stroke={col} strokeWidth="1.5" fill="none"/><ellipse cx="10" cy="10" rx="3.5" ry="7.5" stroke={col} strokeWidth="1.2" fill="none"/><line x1="2.5" y1="10" x2="17.5" y2="10" stroke={col} strokeWidth="1.2"/></>,
    message:<><path d="M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 2V6a1 1 0 011-1z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    flame:<path d="M10 2C10 2 14.5 6.5 14.5 10.5C14.5 13.5 12.5 16 10 16C7.5 16 5.5 13.5 5.5 10.5C5.5 6.5 10 2 10 2Z" stroke={col} strokeWidth="1.5" fill="none"/>,
    trophy:<><path d="M5.5 3h9v5c0 3-2 5-4.5 5S5.5 11 5.5 8V3z" stroke={col} strokeWidth="1.5" fill="none"/><path d="M5.5 5H3c0 3 1.5 4.5 2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><path d="M14.5 5H17c0 3-1.5 4.5-2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><line x1="10" y1="13" x2="10" y2="16.5" stroke={col} strokeWidth="1.5"/><line x1="7" y1="16.5" x2="13" y2="16.5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    lock:<><rect x="5.5" y="9.5" width="9" height="7.5" rx="1.5" stroke={col} strokeWidth="1.5" fill="none"/><path d="M7.5 9.5V7C7.5 5 8.5 3.5 10 3.5S12.5 5 12.5 7v2.5" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="10" cy="13" r="1" fill={col}/></>,
    star:<polygon points="10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6" fill={col}/>,
    list:<><line x1="7" y1="5" x2="17" y2="5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="10" x2="17" y2="10" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="15" x2="17" y2="15" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="5" r="1" fill={col}/><circle cx="4" cy="10" r="1" fill={col}/><circle cx="4" cy="15" r="1" fill={col}/></>,
  };
  return <svg viewBox="0 0 20 20" width={sz} height={sz} style={{display:'block',flexShrink:0,...s}}>{d[n]||<circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.5" fill="none"/>}</svg>;
}

function BottomNav({active=0, nav}){
  const items=[
    {l:'Home',   i:'home',s:'home'},
    {l:'My Wines',i:'list',s:'mywines'},
    {l:'',       i:'scan',fab:true,s:'scan'},
    {l:'Learn',  i:'book',s:'learn'},
    {l:'Profile',i:'user',s:'profile'}
  ];
  return(
    <div style={{display:'flex',alignItems:'flex-end',padding:'8px 8px env(safe-area-inset-bottom, 12px)',background:C.white,borderTop:`1px solid ${C.line}`,flexShrink:0,position:'sticky',bottom:0,zIndex:100}}>
      {items.map((it,i)=>(
        <div key={i} onClick={()=>it.s&&nav(it.s)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,cursor:'pointer'}}>
          {it.fab?(
            <div style={{width:50,height:50,borderRadius:25,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-20,boxShadow:`0 4px 20px ${C.cr}60`}}>
              <Icon n="scan" sz={22} col="#fff"/>
            </div>
          ):(
            <Icon n={it.i} sz={20} col={i===active?C.cr:C.mid}/>
          )}
          {it.l&&<span style={{fontSize:13,fontWeight:500,color:i===active?C.cr:C.mid,fontFamily:C.P}}>{it.l}</span>}
        </div>
      ))}
    </div>
  );
}

function Pill({children,active,sm,style:s}){
  return <span style={{display:'inline-flex',alignItems:'center',padding:sm?'3px 9px':'5px 12px',borderRadius:20,background:active?C.cr:'transparent',color:active?'#fff':C.mid,border:`1px solid ${active?C.cr:C.line}`,fontSize:sm?9:11,fontWeight:500,fontFamily:C.P,...s}}>{children}</span>;
}
function Prog({val=0.5,col,h=4,style:s}){
  return <div style={{height:h,borderRadius:h,background:'rgba(0,0,0,0.07)',overflow:'hidden',...s}}><div style={{height:'100%',width:`${Math.min(1,val)*100}%`,borderRadius:h,background:col||C.cr}}/></div>;
}
function Card({children,style:s,onClick}){
  return <div onClick={onClick} style={{background:C.white,borderRadius:16,padding:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',...s}}>{children}</div>;
}
function Btn({children,primary,full,small,style:s,onClick}){
  return <div onClick={onClick} style={{padding:small?'8px 14px':'12px 20px',borderRadius:12,background:primary?C.cr:C.white,color:primary?'#fff':C.ink,border:primary?'none':`1px solid ${C.line}`,fontFamily:C.P,fontSize:small?11:13,fontWeight:600,textAlign:'center',width:full?'100%':'auto',boxShadow:primary?`0 4px 16px ${C.cr}40`:'none',cursor:'pointer',boxSizing:'border-box',...s}}>{children}</div>;
}

/* ── Wine History ── */
const WineHistory = {
  KEY: 'vinterest_wines',
  getAll(){ try{ return JSON.parse(localStorage.getItem(this.KEY)||'[]'); }catch(e){ return []; } },
  save(wines){ localStorage.setItem(this.KEY, JSON.stringify(wines.slice(0,500))); },
  add(wine, rating){
    // Only persist wines that have been scored
    if(!rating || rating <= 0) return this.getAll();
    const wines = this.getAll();
    const idx = wines.findIndex(w => w.name===wine.name && String(w.vintage)===String(wine.vintage));
    const now = new Date().toISOString();
    if(idx>=0){
      wines[idx].times_consumed = (wines[idx].times_consumed||1) + 1;
      wines[idx].last_scanned = now;
      wines[idx].rating = rating;
    } else {
      wines.unshift({...wine, rating, times_consumed:1, scanned_at:now, last_scanned:now});
    }
    this.save(wines);
    return wines;
  },
  rate(name, vintage, rating){
    const wines = this.getAll();
    const w = wines.find(w => w.name===name && String(w.vintage)===String(vintage));
    if(w){ w.rating=rating; this.save(wines); }
  },
  getProfile(){
    const wines = this.getAll();
    if(!wines.length) return {red:0,white:0,rose:0,sparkling:0,total:0};
    const counts={red:0,white:0,rose:0,sparkling:0};
    wines.forEach(w=>{ const t=(w.type||'').toLowerCase().replace('é','e'); if(counts[t]!==undefined) counts[t]++; else counts.red++; });
    const total=wines.length;
    return {...counts,total,redPct:counts.red/total,whitePct:counts.white/total,rosePct:counts.rose/total,sparklingPct:counts.sparkling/total};
  }
};

Object.assign(window,{C,Icon,BottomNav,Pill,Prog,Card,Btn,WineHistory});
