/* Vinterest PWA — Shared tokens, icons, primitives */

const C = {
  cr:'#8B1A2F', crL:'#B02440', crDim:'rgba(139,26,47,0.13)', crSoft:'rgba(139,26,47,0.07)',
  ink:'#0F0F0F', ink2:'#3A3A3A', mid:'#8A8A8A', line:'#E8E8E8',
  bg:'#FAFAFA', white:'#FFFFFF', offWhite:'#F5F3F0',
  green:'#1E7B4B', greenBg:'#EAF7F0', amber:'#B06C00', amberBg:'#FFF4E0',
  P:"'Poppins',sans-serif",
  serif:"'Instrument Serif',serif",
};

/* A country's flag, for colour on quiz and region containers only (region quiz rows and titles,
   Keep learning region tiles, Mastery's regions, WineDNA's best regions), not wherever a place
   is mentioned. By wine (its country, else its
   region's), by region name (Regions.nameFlag) or by country. Nothing when the country isn't known.
   A string size: a flag is a picture, so the reader's text size leaves it alone. Decorative: the
   place is always named beside it, so screen readers skip it (and previews stay one picture). */
function Flag({wine,region,country,size=15,style}){
  const f=wine?Regions.wineFlag(wine):region?Regions.nameFlag(region):Regions.countryFlag(country);
  if(!f) return null;
  return <span className="vflag" aria-hidden="true" style={{fontSize:size+'px',lineHeight:1,flexShrink:0,...style}}>{f}</span>;
}
/* A Parker score's colour, the same everywhere: green 90+, amber 80-89, red below 80 (ParkerScale.tone). */
const _SCORE_COL={good:C.green,neutral:C.amber,bad:'#B04A3A'};
function scoreCol(score){ return _SCORE_COL[ParkerScale.tone(score)]; }
function Icon({n,sz=20,col=C.ink,style:s}){
  const d={
    scan:<><rect x="3" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="11" y="3" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><rect x="3" y="11" width="6" height="6" rx="1" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="14" cy="14" r="2.5" stroke={col} strokeWidth="1.6" fill="none"/><line x1="16.5" y1="16.5" x2="18.5" y2="18.5" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    fork:<><path d="M7 2v5c0 1.5.8 2.5 2 3v8" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M9 2v3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/><path d="M14 2v4l2-1v-3" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 6c0 2.5 2 3 2 5v7" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round"/></>,
    cart:<><path d="M2 3h2.5l2.2 10h8.6l1.8-7H6.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="9" cy="17" r="1.2" fill={col}/><circle cx="14.5" cy="17" r="1.2" fill={col}/></>,
    torch:<><path d="M11.5 2L4.5 11h5l-1 7 7-9h-5l1-7z" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>,
    torchOn:<path d="M11.5 2L4.5 11h5l-1 7 7-9h-5l1-7z" fill={col} stroke={col} strokeWidth="1.2" strokeLinejoin="round"/>,
    gallery:<><rect x="2.5" y="4" width="15" height="12" rx="2" stroke={col} strokeWidth="1.6" fill="none"/><circle cx="7" cy="8.2" r="1.4" fill={col}/><path d="M3 14.5l4.2-4 3 2.8 2.6-2.3L17 14.5" stroke={col} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
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
    search:<><circle cx="9" cy="9" r="5.5" stroke={col} strokeWidth="1.6" fill="none"/><path d="M13 13l4 4" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    bookmark:<><path d="M6 3.5h8a1 1 0 011 1V17l-5-3.2L5 17V4.5a1 1 0 011-1z" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>,
    edit:<><path d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/></>,
    sort:<><path d="M4 6h12M6 10h8M8 14h4" stroke={col} strokeWidth="1.6" strokeLinecap="round"/></>,
    trash:<><path d="M4 6h12" stroke={col} strokeWidth="1.6" strokeLinecap="round"/><path d="M8 6V4.5a1 1 0 011-1h2a1 1 0 011 1V6" stroke={col} strokeWidth="1.6" fill="none"/><path d="M5.5 6l.7 9.5a1.5 1.5 0 001.5 1.4h4.6a1.5 1.5 0 001.5-1.4L14.5 6" stroke={col} strokeWidth="1.6" fill="none" strokeLinejoin="round"/><line x1="8.3" y1="9" x2="8.6" y2="14" stroke={col} strokeWidth="1.3" strokeLinecap="round"/><line x1="11.7" y1="9" x2="11.4" y2="14" stroke={col} strokeWidth="1.3" strokeLinecap="round"/></>,
    wine:<><path d="M7.5 2.5h5v5c0 3.5-1.8 5-2.5 5S7.5 11 7.5 8V2.5z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/><line x1="10" y1="12.5" x2="10" y2="17" stroke={col} strokeWidth="1.5"/><line x1="7" y1="17" x2="13" y2="17" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    globe:<><circle cx="10" cy="10" r="7.5" stroke={col} strokeWidth="1.5" fill="none"/><ellipse cx="10" cy="10" rx="3.5" ry="7.5" stroke={col} strokeWidth="1.2" fill="none"/><line x1="2.5" y1="10" x2="17.5" y2="10" stroke={col} strokeWidth="1.2"/></>,
    message:<><path d="M3 5h14a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 2V6a1 1 0 011-1z" stroke={col} strokeWidth="1.5" fill="none" strokeLinejoin="round"/></>,
    flame:<path d="M10 2C10 2 14.5 6.5 14.5 10.5C14.5 13.5 12.5 16 10 16C7.5 16 5.5 13.5 5.5 10.5C5.5 6.5 10 2 10 2Z" stroke={col} strokeWidth="1.5" fill="none"/>,
    bolt:<path d="M11 2L4.5 11.5H9.5L8.5 18L15.5 8H10.5L11 2Z" stroke={col} strokeWidth="1.4" strokeLinejoin="round" fill="none"/>,
    trophy:<><path d="M5.5 3h9v5c0 3-2 5-4.5 5S5.5 11 5.5 8V3z" stroke={col} strokeWidth="1.5" fill="none"/><path d="M5.5 5H3c0 3 1.5 4.5 2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><path d="M14.5 5H17c0 3-1.5 4.5-2.5 4.5" stroke={col} strokeWidth="1.3" fill="none"/><line x1="10" y1="13" x2="10" y2="16.5" stroke={col} strokeWidth="1.5"/><line x1="7" y1="16.5" x2="13" y2="16.5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/></>,
    lock:<><rect x="5.5" y="9.5" width="9" height="7.5" rx="1.5" stroke={col} strokeWidth="1.5" fill="none"/><path d="M7.5 9.5V7C7.5 5 8.5 3.5 10 3.5S12.5 5 12.5 7v2.5" stroke={col} strokeWidth="1.5" fill="none"/><circle cx="10" cy="13" r="1" fill={col}/></>,
    star:<polygon points="10,2 12.4,7.6 18.5,8.2 14,12.3 15.4,18.3 10,15.1 4.6,18.3 6,12.3 1.5,8.2 7.6,7.6" fill={col}/>,
    list:<><line x1="7" y1="5" x2="17" y2="5" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="10" x2="17" y2="10" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><line x1="7" y1="15" x2="17" y2="15" stroke={col} strokeWidth="1.5" strokeLinecap="round"/><circle cx="4" cy="5" r="1" fill={col}/><circle cx="4" cy="10" r="1" fill={col}/><circle cx="4" cy="15" r="1" fill={col}/></>,
    brain:<><path d="M10 15V7.5" stroke={col} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="1.2 1.8" opacity=".4"/><path d="M10 7.5C10 5.5 8.5 4 7 4C5.3 4 4 5.2 4 6.8C3.1 7.1 2.4 8 2.4 9.2C2.4 10.4 3.2 11.4 4.3 11.7C4.1 12.2 4 12.7 4 13.3C4 14.9 5.3 16.1 7 16.2L10 16.3" stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 7.5C10 5.5 11.5 4 13 4C14.7 4 16 5.2 16 6.8C16.9 7.1 17.6 8 17.6 9.2C17.6 10.4 16.8 11.4 15.7 11.7C15.9 12.2 16 12.7 16 13.3C16 14.9 14.7 16.1 13 16.2L10 16.3" stroke={col} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M5.5 8.2C6 7.8 7 7.7 7.8 8.2" stroke={col} strokeWidth="1" strokeLinecap="round" opacity=".55"/><path d="M5.5 11C6 10.6 7 10.6 7.8 11" stroke={col} strokeWidth="1" strokeLinecap="round" opacity=".55"/></>,
    // Food pairing icons — clean 1px line art
    'food-lamb':<>
      {/* sheep body */}
      <ellipse cx="9" cy="10" rx="5.5" ry="3.5" stroke={col} strokeWidth="1.4" fill="none"/>
      {/* head */}
      <circle cx="15" cy="8.5" r="2" stroke={col} strokeWidth="1.3" fill="none"/>
      {/* ear */}
      <path d="M14 6.8L13.5 5.5" stroke={col} strokeWidth="1.2" strokeLinecap="round"/>
      {/* legs */}
      <line x1="6" y1="13.5" x2="5.5" y2="17" stroke={col} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="9" y1="13.5" x2="9" y2="17" stroke={col} strokeWidth="1.3" strokeLinecap="round"/>
      <line x1="12" y1="13.5" x2="12.5" y2="17" stroke={col} strokeWidth="1.3" strokeLinecap="round"/>
    </>,
    'food-beef':<>
      {/* steak cut */}
      <path d="M5.5 6C4.8 7 4.5 9 5 12C5.5 15 7.5 16 10 16C12.5 16 14.5 15 15 12C15.5 9 15.2 7 14.5 6C13.5 5 11.5 4.5 10 4.5C8.5 4.5 6.5 5 5.5 6Z" stroke={col} strokeWidth="1.4" fill="none"/>
      {/* T-bone */}
      <line x1="10" y1="4.5" x2="10" y2="16" stroke={col} strokeWidth="1.1" strokeLinecap="round" opacity=".45"/>
      <path d="M7.5 8.5C8.5 8 11.5 8 12.5 8.5" stroke={col} strokeWidth="1" strokeLinecap="round" opacity=".35"/>
    </>,
    'food-meat':<>
      {/* generic meat / drumstick */}
      <path d="M8 4.5C8 4.5 5.5 5.5 5 8C4.5 10.5 6 13 8.5 13.5L10 16.5" stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 16.5C10 16.5 9 17.5 10.5 18C12 18.5 13 17 13 17L14.5 14.5C14.5 14.5 15 13 14 12.5L11.5 11.5C10 11 8.5 13.5 8.5 13.5" stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </>,
    'food-cheese':<>
      {/* wedge from side */}
      <path d="M2.5 15.5L10 4.5L17.5 15.5H2.5Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/>
      {/* holes */}
      <circle cx="9" cy="12" r="1.1" fill={col} opacity=".45"/>
      <circle cx="12.5" cy="12.5" r="0.9" fill={col} opacity=".45"/>
      <circle cx="7" cy="13.5" r="0.7" fill={col} opacity=".35"/>
    </>,
    'food-fish':<><path d="M3 10C3 10 5.5 5.5 10 5.5C14.5 5.5 17 10 17 10C17 10 14.5 14.5 10 14.5C5.5 14.5 3 10 3 10Z" stroke={col} strokeWidth="1.4" fill="none"/><circle cx="13" cy="9.5" r="0.9" fill={col}/><path d="M3 10L1 7.5M3 10L1 12.5" stroke={col} strokeWidth="1.3" strokeLinecap="round"/></>,
    'food-pasta':<><ellipse cx="10" cy="9" rx="6.5" ry="3" stroke={col} strokeWidth="1.4" fill="none"/><path d="M3.5 9v2c0 2 3 3.5 6.5 3.5s6.5-1.5 6.5-3.5V9" stroke={col} strokeWidth="1.4" fill="none"/><path d="M7 9.5c.8 1 2 1.5 3 1.5s2.2-.5 3-1.5" stroke={col} strokeWidth="1.2" fill="none" strokeLinecap="round"/></>,
    'food-veg':<><path d="M10 16V8" stroke={col} strokeWidth="1.4" strokeLinecap="round"/><path d="M10 11C10 11 7 9 6 6C8 5.5 10 7 10 7" stroke={col} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 9C10 9 13 7 14 4C12 3.5 10 5 10 5" stroke={col} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
    'food-chicken':<><path d="M8 4.5C8 4.5 6 5 5.5 7C5 9 6.5 10.5 8 11L12 15.5" stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 15.5C12 15.5 10.5 17 12 17.5C13.5 18 14.5 16.5 14.5 16.5L16 14C16 14 16.5 12.5 15.5 12L13 11C11.5 10.5 8 11 8 11" stroke={col} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></>,
    'food-bread':<><path d="M4 13.5C4 13.5 3 12 3 10C3 7.5 5 5.5 7.5 5.5H12.5C15 5.5 17 7.5 17 10C17 12 16 13.5 16 13.5H4Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="4" y1="13.5" x2="16" y2="13.5" stroke={col} strokeWidth="1.4" strokeLinecap="round"/></>,
    'food-generic':<><circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.4" fill="none"/><path d="M7 10h6M10 7v6" stroke={col} strokeWidth="1.3" strokeLinecap="round" opacity=".5"/></>,
    // Article/reading icons
    'read':<><path d="M4 5h12v11a1 1 0 01-1 1H5a1 1 0 01-1-1V5Z" stroke={col} strokeWidth="1.4" fill="none"/><line x1="7" y1="9" x2="13" y2="9" stroke={col} strokeWidth="1.2" strokeLinecap="round"/><line x1="7" y1="12" x2="11" y2="12" stroke={col} strokeWidth="1.2" strokeLinecap="round"/><path d="M7.5 5V3.5" stroke={col} strokeWidth="1.2" strokeLinecap="round"/><path d="M12.5 5V3.5" stroke={col} strokeWidth="1.2" strokeLinecap="round"/></>,
    'map':<><path d="M7 3.5L3 5.5v11l4-2 6 2 4-2v-11l-4 2-6-2Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="7" y1="3.5" x2="7" y2="14.5" stroke={col} strokeWidth="1.2"/><line x1="13" y1="5.5" x2="13" y2="16.5" stroke={col} strokeWidth="1.2"/></>,
    'leaf':<><path d="M10 17C10 17 4 14 4 8C4 8 8 5 14 6C14 6 15 12 10 17Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/><path d="M10 17C10 17 10 12 7 9" stroke={col} strokeWidth="1.2" strokeLinecap="round"/></>,
    'glass':<><path d="M6 3h8l-1 7.5c-.3 2.3-2.2 4-3 4s-2.7-1.7-3-4L6 3Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/><line x1="10" y1="14.5" x2="10" y2="17.5" stroke={col} strokeWidth="1.4"/><line x1="6.5" y1="17.5" x2="13.5" y2="17.5" stroke={col} strokeWidth="1.4" strokeLinecap="round"/></>,
    'grape':<><circle cx="7" cy="8" r="2" stroke={col} strokeWidth="1.3" fill="none"/><circle cx="10.5" cy="6" r="2" stroke={col} strokeWidth="1.3" fill="none"/><circle cx="10.5" cy="10" r="2" stroke={col} strokeWidth="1.3" fill="none"/><circle cx="14" cy="8" r="2" stroke={col} strokeWidth="1.3" fill="none"/><circle cx="10.5" cy="14" r="2" stroke={col} strokeWidth="1.3" fill="none"/><path d="M10.5 4V2" stroke={col} strokeWidth="1.3" strokeLinecap="round"/></>,
    'drop':<path d="M10 3C10 3 5.5 9 5.5 12.5C5.5 15.5 7.5 17.5 10 17.5C12.5 17.5 14.5 15.5 14.5 12.5C14.5 9 10 3 10 3Z" stroke={col} strokeWidth="1.4" fill="none" strokeLinejoin="round"/>,
  };
  return <svg viewBox="0 0 20 20" width={sz} height={sz} style={{display:'block',flexShrink:0,...s}}>{d[n]||<circle cx="10" cy="10" r="7" stroke={col} strokeWidth="1.5" fill="none"/>}</svg>;
}

/* Tab labels are a fixed 13px (a string size, so Text size doesn't scale them) on one line:
   five tabs share the width of a small phone, and a wrapped label pushes the whole bar up. */
function BottomNav({active, nav, showPro}){
  const homeActive=active==='home'||active==='scan';
  const cellarActive=active==='mywines';
  const learnActive=active==='learn'||active==='quiz'||active==='article';
  const profileActive=active==='profile';
  return(
    <div style={{flexShrink:0,position:'relative',zIndex:50,overflow:'visible'}}>
      <div style={{display:'flex',background:C.white,borderTop:`1px solid ${C.line}`,zIndex:100,overflow:'visible'}}>
        {/* Home */}
        <div onClick={()=>nav('home')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="home" sz={22} col={homeActive?C.cr:C.mid}/>
          <span style={{fontSize:'13px',whiteSpace:'nowrap',fontWeight:homeActive?600:400,color:homeActive?C.cr:C.mid,fontFamily:C.P}}>Home</span>
        </div>
        {/* My Wines */}
        <div onClick={()=>nav('mywines')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="wine" sz={22} col={cellarActive?C.cr:C.mid}/>
          <span style={{fontSize:'13px',whiteSpace:'nowrap',fontWeight:cellarActive?600:400,color:cellarActive?C.cr:C.mid,fontFamily:C.P}}>My Wines</span>
        </div>
        {/* Scan FAB */}
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',cursor:'pointer',paddingBottom:'max(env(safe-area-inset-bottom,9px),9px)'}} onClick={()=>nav('camera')}>
          <div style={{width:54,height:54,borderRadius:27,background:C.cr,display:'flex',alignItems:'center',justifyContent:'center',marginTop:-20,boxShadow:`0 4px 22px ${C.cr}60`,border:'3px solid #fff'}}>
            <Icon n="camera" sz={22} col="#fff"/>
          </div>
          <span style={{fontSize:'13px',whiteSpace:'nowrap',fontWeight:600,color:C.cr,fontFamily:C.P,marginTop:3}}>Scan</span>
        </div>
        {/* Learn */}
        <div onClick={()=>nav('learn')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="book" sz={22} col={learnActive?C.cr:C.mid}/>
          <span style={{fontSize:'13px',whiteSpace:'nowrap',fontWeight:learnActive?600:400,color:learnActive?C.cr:C.mid,fontFamily:C.P}}>Learn</span>
        </div>
        {/* WineDNA */}
        <div onClick={()=>nav('profile')} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,cursor:'pointer',padding:'9px 0 max(env(safe-area-inset-bottom,9px),9px)'}}>
          <Icon n="brain" sz={22} col={profileActive?C.cr:C.mid}/>
          <span style={{fontSize:'13px',whiteSpace:'nowrap',fontWeight:profileActive?600:400,color:profileActive?C.cr:C.mid,fontFamily:C.P}}>WineDNA</span>
        </div>
      </div>
    </div>
  );
}

/* ── Sidebar navigation (tablet/iPad) ── */
function SideNav({active,nav,showPro,xpBadge,onXpClick}){
  const homeActive=['home','scan'].includes(active);
  const cellarActive=active==='mywines';
  const learnActive=['learn','quiz','article','gen-article','guide','mastery-map'].includes(active);
  const profileActive=active==='profile';
  const isPro=Entitlement.isPro();
  const atLimit=!isPro&&Entitlement.scanCount()>=10;
  const lv=xpBadge?XPSystem.getLevel(xpBadge.total):null;
  const items=[
    {key:'home',   icon:'home',  label:'Home',     isActive:homeActive},
    {key:'scan',   icon:'camera',label:'Scan',     isActive:active==='scan'||active==='camera'},
    {key:'mywines',icon:'wine',  label:'My Wines', isActive:cellarActive},
    {key:'learn',  icon:'book',  label:'Learn',    isActive:learnActive},
    {key:'profile',icon:'brain', label:'WineDNA',  isActive:profileActive},
  ];
  const navItems=items.filter(i=>i.key!=='scan');
  return(
    <div style={{width:200,flexShrink:0,height:'100%',background:C.white,borderRight:`1px solid ${C.line}`,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Logo + XP */}
      <div style={{padding:'18px 16px 12px'}}>
        <img src="logo.png" alt="Vinterest" style={{height:26,width:'auto',display:'block',marginBottom:10}}/>
        {xpBadge&&lv&&(
          <div onClick={onXpClick} style={{padding:'6px 8px',borderRadius:8,background:C.crSoft,border:`1px solid ${C.crDim}`,cursor:'pointer',display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:15,lineHeight:1}}>{lv.badge}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700,color:C.cr,fontFamily:C.P,lineHeight:1.2}}>{xpBadge.total} XP</div>
              <div style={{fontSize:11,fontWeight:400,color:C.mid,fontFamily:C.P,lineHeight:1.3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{lv.name}</div>
            </div>
            {Entitlement.isPro()&&<span style={{fontSize:10,fontWeight:700,color:'#fff',background:'linear-gradient(135deg,#9B5E00,#C4870A)',borderRadius:6,padding:'2px 5px',flexShrink:0}}>PRO</span>}
          </div>
        )}
      </div>
      {/* Divider */}
      <div style={{height:1,background:C.line,margin:'0 0 8px'}}/>
      {/* Nav items */}
      <div style={{padding:'2px 10px 0',display:'flex',flexDirection:'column',gap:2}}>
        {navItems.map(item=>(
          <div key={item.key} onClick={()=>nav(item.key)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:10,background:item.isActive?C.crSoft:'transparent',cursor:'pointer',transition:'background .15s'}}>
            <Icon n={item.icon} sz={19} col={item.isActive?C.cr:C.mid}/>
            <span style={{fontSize:14,fontWeight:item.isActive?600:400,color:item.isActive?C.cr:C.ink2,fontFamily:C.P}}>{item.label}</span>
          </div>
        ))}
      </div>
      {/* Spacer */}
      <div style={{flex:1}}/>
      {/* Scan CTA at bottom */}
      <div style={{padding:'0 10px 20px'}}>
        <div onClick={()=>atLimit?showPro('unlimited-scans'):nav('camera')} style={{background:atLimit?'#999':C.cr,borderRadius:8,padding:'10px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer',boxShadow:atLimit?'none':`0 3px 10px ${C.cr}40`}}>
          <Icon n={atLimit?'lock':'camera'} sz={19} col="#fff"/>
          <span style={{fontSize:14,fontWeight:500,color:'#fff',fontFamily:C.P}}>Scan</span>
        </div>
      </div>
    </div>
  );
}

function ProBadge({style:s}){
  return(
    <span style={{display:'inline-flex',alignItems:'center',padding:'2px 7px',borderRadius:8,background:'linear-gradient(135deg,#9B5E00,#C4870A)',fontSize:12,fontWeight:700,color:'#fff',fontFamily:C.P,letterSpacing:'0.05em',flexShrink:0,...s}}>PRO</span>
  );
}

function ProGate({feature,onClose}){
  const FEAT={
    'wine-list':{icon:'📋',title:'Wine List Scanning',desc:'Snap any restaurant menu and get instant match scores for every bottle.',bullets:['Scan full wine lists in seconds','AI ranks every wine by your taste profile','Works at any restaurant worldwide']},
    'unlimited-scans':{icon:'♾️',title:'Unlimited Scans',desc:"You've used your 10 free scans. Pro gives you unlimited.",bullets:['Scan as many bottles as you like','Your full scan history never expires','Priority AI label recognition']},
    'taste-depth':{icon:'🎭',title:'Full Taste Profile',desc:'Unlock your complete taste breakdown across all wine types.',bullets:['Whites, Rosé & Sparkling profiles','Personalised sommelier scripts for each','Full food pairing analysis']},
    'grape-library':{icon:'🍇',title:'Every Grape',desc:`You've unlocked your ${typeof FREE_GRAPE_CAP!=='undefined'?FREE_GRAPE_CAP:5} free grapes. Pro opens all 50.`,bullets:['A quiz and article for every grape you meet','Learn what each grape tastes like, and why','New grapes unlock the moment you scan them']},
    'mastery-map':{icon:'🏆',title:'Your Mastery',desc:'See how rounded your wine knowledge is, built from what you\'ve read and the quizzes you\'ve passed.',bullets:['A score for every wine type, region, grape and skill','Your strongest areas and your biggest gaps','The next thing to read or pass in each one']},
    'regions':{icon:'🗺️',title:'Every Region',desc:`You've unlocked your ${typeof FREE_REGION_CAP!=='undefined'?FREE_REGION_CAP:5} free regions. Pro opens every region you scan.`,bullets:['Region quizzes and articles for every wine you scan','How each place shapes the wine in your glass','Personalised pieces on the regions you drink']},
    'upgrade':{icon:'🍷',title:'Vinterest Pro',desc:'Everything in Vinterest, with nothing held back.',bullets:['Unlimited label scans, and wine list scanning','Every grape and region you meet, with quizzes and articles','Your full Mastery map and every wine type in WineDNA']},
    'expert-quiz':{icon:'🎓',title:'Expert Quizzes',desc:'Advanced wine knowledge questions with bigger XP rewards.',bullets:['WSET-inspired question sets','200 XP per completed quiz','Unlock Expert badge on your profile']},
  };
  const f=FEAT[feature]||FEAT['wine-list'];
  return(
    <div onClick={onClose} style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.62)',zIndex:600,display:'flex',alignItems:'flex-end',backdropFilter:'blur(4px)'}}>
      {/* A floating card, rounded all round with a gap below, so its end is plain to see; it
          scrolls inside when a small phone at large text can't fit it. */}
      <div data-sheet="pro" onClick={e=>e.stopPropagation()} style={{background:C.white,borderRadius:22,width:'calc(100% - 20px)',margin:'0 10px calc(10px + env(safe-area-inset-bottom,0px))',maxHeight:'calc(100% - 30px)',overflowY:'auto',boxSizing:'border-box',paddingBottom:18,boxShadow:'0 10px 40px rgba(0,0,0,0.25)',animation:'slideUp .3s cubic-bezier(.34,1.2,.64,1)'}}>
        <div style={{display:'flex',justifyContent:'center',padding:'10px 0 0'}}>
          <div style={{width:36,height:4,borderRadius:2,background:C.line}}/>
        </div>
        <div style={{textAlign:'center',padding:'6px 0 8px'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 14px',borderRadius:20,background:'linear-gradient(135deg,#9B5E00,#C4870A)'}}>
            <span style={{fontSize:15,fontWeight:700,color:'#fff',fontFamily:C.P,letterSpacing:'0.08em'}}>VINTEREST PRO</span>
          </span>
        </div>
        <div style={{padding:'6px 24px 4px',display:'flex',flexDirection:'column',gap:14}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:42,marginBottom:8}}>{f.icon}</div>
            <div style={{fontSize:22,fontWeight:800,color:C.ink,fontFamily:C.P,lineHeight:1.2,marginBottom:6}}>{f.title}</div>
            <div style={{fontSize:16,color:C.mid,fontFamily:C.P,lineHeight:1.55}}>{f.desc}</div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {f.bullets.map((b,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:20,height:20,borderRadius:10,background:C.greenBg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Icon n="check" sz={12} col={C.green}/>
                </div>
                <span style={{fontSize:16,color:C.ink2,fontFamily:C.P}}>{b}</span>
              </div>
            ))}
          </div>
          {Account.signedIn()?<div style={{fontSize:14,color:C.mid,fontFamily:C.P,textAlign:'center',lineHeight:1.5}}>You're signed in, so Pro goes on your account. It isn't on sale yet: we'll let you know when it is.</div>:
          <div onClick={()=>{Entitlement.startPro();onClose();}}
            style={{background:`linear-gradient(135deg,${C.cr},${C.crL})`,borderRadius:14,padding:'15px',textAlign:'center',cursor:'pointer',boxShadow:`0 6px 28px ${C.cr}45`,marginTop:2}}>
            <div style={{fontSize:18,fontWeight:700,color:'#fff',fontFamily:C.P}}>Upgrade to Pro</div>
            <div style={{fontSize:15,color:'rgba(255,255,255,0.68)',fontFamily:C.P,marginTop:2}}>£4.99/month · Cancel anytime</div>
          </div>}
          <div onClick={onClose} style={{textAlign:'center',cursor:'pointer',paddingBottom:4}}>
            <span style={{fontSize:16,color:C.mid,fontFamily:C.P}}>Maybe later</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Pill({children,active,sm,style:s}){
  return <span style={{display:'inline-flex',alignItems:'center',padding:sm?'3px 9px':'5px 12px',borderRadius:20,background:active?C.cr:'transparent',color:active?'#fff':C.mid,border:`1px solid ${active?C.cr:C.line}`,fontSize:sm?12:13,fontWeight:500,fontFamily:C.P,...s}}>{children}</span>;
}
function Prog({val=0.5,col,h=4,style:s}){
  return <div style={{height:h,borderRadius:h,background:'rgba(0,0,0,0.07)',overflow:'hidden',...s}}><div style={{height:'100%',width:`${Math.min(1,val)*100}%`,borderRadius:h,background:col||C.cr}}/></div>;
}
function Card({children,style:s,onClick}){
  return <div onClick={onClick} style={{background:C.white,borderRadius:16,padding:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',...s}}>{children}</div>;
}
function Btn({children,primary,full,small,style:s,onClick}){
  return <div onClick={onClick} style={{padding:small?'8px 14px':'12px 20px',borderRadius:12,background:primary?C.cr:C.white,color:primary?'#fff':C.ink,border:primary?'none':`1px solid ${C.line}`,fontFamily:C.P,fontSize:small?13:15,fontWeight:600,textAlign:'center',width:full?'100%':'auto',boxShadow:primary?`0 4px 16px ${C.cr}40`:'none',cursor:'pointer',boxSizing:'border-box',...s}}>{children}</div>;
}

/* Catches a render-time exception in a screen (e.g. static data that failed to load) so the
   screen shows a recoverable message instead of leaving the app permanently blank — there's no
   page refresh to fall back on once this is wrapped in a native shell. "Try Again" just re-attempts
   the render; it doesn't re-fetch anything, so pair it with safe fallback values at the data layer. */
class ScreenErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  componentDidCatch(err,info){ console.error('[Vinterest] screen failed to render:',err,info); }
  render(){
    if(this.state.hasError){
      return <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:32}}>
        <div style={{fontSize:16,color:C.mid,fontFamily:C.P,textAlign:'center'}}>Something didn't load right.</div>
        <Btn primary onClick={()=>this.setState({hasError:false})}>Try Again</Btn>
      </div>;
    }
    return this.props.children;
  }
}

Object.assign(window,{C,Icon,BottomNav,SideNav,Pill,Prog,Card,Btn,ScreenErrorBoundary,WineHistory,ProBadge,ProGate,calcMatchScore,Regional,FindOnline,CURRENCY_LIST,lookupCountryCurrency,fetchRetailEstimate,retailPriceCacheKey,PRICE_SEARCH_FROM_USD});
