/* Vinterest Wireframe Kit — reusable lo-fi components */
/* Exports: Phone, WBar, WNav, WBtn, WScan, WSearch, WCard, WPlaceholder, WTag, WProgress, WStars, WIcon, WDivider, WSection */

const WK = {
  font: "'Caveat', cursive",
  fontClean: "'DM Sans', sans-serif",
  accent: "#9B4D6A",
  accentLight: "#F3E5EC",
  bg: "#FAFAFA",
  border: "#BDBDBD",
  dark: "#333",
  mid: "#888",
  light: "#E0E0E0",
  radius: "10px",
};

/* ── Phone Frame ── */
const phoneStyles = {
  outer: {
    background: "#fff",
    borderRadius: 32,
    border: `2px solid ${WK.dark}`,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    position: "relative",
    fontFamily: WK.fontClean,
  },
  body: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: WK.bg,
  },
};

function Phone({ children, noNav, noBar }) {
  return (
    <div style={phoneStyles.outer}>
      {!noBar && <WBar />}
      <div style={phoneStyles.body}>{children}</div>
      {!noNav && <WNav />}
    </div>
  );
}

/* ── Status Bar ── */
function WBar() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 20px 4px", fontSize: 11, fontFamily: WK.fontClean, color: WK.dark, background: "#fff", flexShrink: 0 }}>
      <span style={{ fontWeight: 600 }}>9:41</span>
      <div style={{ width: 80, height: 22, borderRadius: 12, background: WK.dark, margin: "0 auto", position: "absolute", left: "50%", transform: "translateX(-50%)" }}></div>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <svg width="14" height="10" viewBox="0 0 14 10"><rect x="0" y="5" width="2.5" height="5" rx="0.5" fill={WK.dark}/><rect x="3.5" y="3" width="2.5" height="7" rx="0.5" fill={WK.dark}/><rect x="7" y="1" width="2.5" height="9" rx="0.5" fill={WK.dark}/><rect x="10.5" y="0" width="2.5" height="10" rx="0.5" fill={WK.light}/></svg>
        <svg width="16" height="10" viewBox="0 0 16 10"><rect x="0.5" y="0.5" width="13" height="9" rx="1.5" stroke={WK.dark} strokeWidth="1" fill="none"/><rect x="14" y="3" width="1.5" height="4" rx="0.5" fill={WK.dark}/><rect x="1.5" y="1.5" width="9" height="7" rx="0.5" fill={WK.dark}/></svg>
      </div>
    </div>
  );
}

/* ── Bottom Navigation ── */
function WNav({ active = 0, items }) {
  const defaultItems = [
    { label: "Home", icon: "home" },
    { label: "Discover", icon: "compass" },
    { label: "Scan", icon: "scan", center: true },
    { label: "Learn", icon: "book" },
    { label: "Profile", icon: "user" },
  ];
  const navItems = items || defaultItems;
  return (
    <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", padding: "6px 8px 16px", background: "#fff", borderTop: `1px solid ${WK.light}`, flexShrink: 0 }}>
      {navItems.map((item, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1 }}>
          {item.center ? (
            <div style={{ width: 44, height: 44, borderRadius: 22, background: WK.accent, display: "flex", alignItems: "center", justifyContent: "center", marginTop: -16, border: "2px solid #fff", boxShadow: "0 2px 8px rgba(155,77,106,0.25)" }}>
              <WIcon name={item.icon} size={22} color="#fff" />
            </div>
          ) : (
            <WIcon name={item.icon} size={20} color={i === active ? WK.accent : WK.mid} />
          )}
          <span style={{ fontSize: 9, color: i === active ? WK.accent : WK.mid, fontWeight: i === active ? 600 : 400 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Icons (simple SVG) ── */
function WIcon({ name, size = 20, color = WK.dark, style: extraStyle }) {
  const s = { width: size, height: size, display: "block", ...extraStyle };
  const paths = {
    home: <><path d="M3 9.5L10 3l7 6.5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M5 8.5V16h4v-4h2v4h4V8.5" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round"/></>,
    compass: <><circle cx="10" cy="10" r="7.5" stroke={color} strokeWidth="1.5" fill="none"/><polygon points="10,5 12,9 10,10 8,9" fill={color} opacity="0.7"/><polygon points="10,15 8,11 10,10 12,11" fill={color} opacity="0.3"/></>,
    scan: <><rect x="3" y="3" width="14" height="14" rx="3" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="10" cy="10" r="3" stroke={color} strokeWidth="1.5" fill="none"/><line x1="10" y1="6" x2="10" y2="3.5" stroke={color} strokeWidth="1.2"/><line x1="10" y1="14" x2="10" y2="16.5" stroke={color} strokeWidth="1.2"/></>,
    book: <><path d="M4 4C4 4 7 3 10 4.5C13 3 16 4 16 4V15C16 15 13 14 10 15.5C7 14 4 15 4 15V4Z" stroke={color} strokeWidth="1.5" fill="none"/><line x1="10" y1="4.5" x2="10" y2="15.5" stroke={color} strokeWidth="1"/></>,
    user: <><circle cx="10" cy="7" r="3.5" stroke={color} strokeWidth="1.5" fill="none"/><path d="M3.5 17.5C3.5 13.5 6.5 11.5 10 11.5C13.5 11.5 16.5 13.5 16.5 17.5" stroke={color} strokeWidth="1.5" fill="none"/></>,
    camera: <><rect x="2" y="5" width="16" height="11" rx="2" stroke={color} strokeWidth="1.5" fill="none"/><circle cx="10" cy="10.5" r="3" stroke={color} strokeWidth="1.5" fill="none"/><path d="M7 5L8 3h4l1 2" stroke={color} strokeWidth="1.2" fill="none"/></>,
    star: <polygon points="10,2 12.5,7.5 18,8 14,12 15,18 10,15 5,18 6,12 2,8 7.5,7.5" fill={color} />,
    starOutline: <polygon points="10,2 12.5,7.5 18,8 14,12 15,18 10,15 5,18 6,12 2,8 7.5,7.5" stroke={color} strokeWidth="1.2" fill="none" />,
    wine: <><path d="M7 3h6v4c0 3-1.5 4-3 4s-3-1-3-4V3z" stroke={color} strokeWidth="1.3" fill="none"/><line x1="10" y1="11" x2="10" y2="16" stroke={color} strokeWidth="1.3"/><line x1="7" y1="16" x2="13" y2="16" stroke={color} strokeWidth="1.3" strokeLinecap="round"/></>,
    heart: <path d="M10 16C10 16 3 11 3 7C3 4.5 5 3 7 3C8.5 3 9.5 4 10 5C10.5 4 11.5 3 13 3C15 3 17 4.5 17 7C17 11 10 16 10 16Z" stroke={color} strokeWidth="1.3" fill="none" />,
    share: <><circle cx="14" cy="4" r="2.5" stroke={color} strokeWidth="1.2" fill="none"/><circle cx="5" cy="10" r="2.5" stroke={color} strokeWidth="1.2" fill="none"/><circle cx="14" cy="16" r="2.5" stroke={color} strokeWidth="1.2" fill="none"/><line x1="7.2" y1="8.8" x2="11.8" y2="5.2" stroke={color} strokeWidth="1.2"/><line x1="7.2" y1="11.2" x2="11.8" y2="14.8" stroke={color} strokeWidth="1.2"/></>,
    check: <polyline points="4,10 8,14 16,5" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    chevron: <polyline points="6,4 14,10 6,16" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    back: <polyline points="12,4 5,10 12,16" stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>,
    search: <><circle cx="8.5" cy="8.5" r="5" stroke={color} strokeWidth="1.5" fill="none"/><line x1="12.5" y1="12.5" x2="17" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/></>,
    trophy: <><path d="M6 3h8v5c0 3-2 5-4 5s-4-2-4-5V3z" stroke={color} strokeWidth="1.3" fill="none"/><path d="M6 5H3c0 3 1.5 4 3 4" stroke={color} strokeWidth="1.2" fill="none"/><path d="M14 5h3c0 3-1.5 4-3 4" stroke={color} strokeWidth="1.2" fill="none"/><line x1="10" y1="13" x2="10" y2="16" stroke={color} strokeWidth="1.2"/><line x1="7" y1="16" x2="13" y2="16" stroke={color} strokeWidth="1.2" strokeLinecap="round"/></>,
    flame: <path d="M10 2C10 2 14 6 14 10C14 13 12 15 10 15C8 15 6 13 6 10C6 6 10 2 10 2Z" stroke={color} strokeWidth="1.3" fill="none"/>,
    list: <><line x1="7" y1="5" x2="17" y2="5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><line x1="7" y1="10" x2="17" y2="10" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><line x1="7" y1="15" x2="17" y2="15" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><circle cx="4" cy="5" r="1" fill={color}/><circle cx="4" cy="10" r="1" fill={color}/><circle cx="4" cy="15" r="1" fill={color}/></>,
    cart: <><path d="M3 3h2l2 10h8l2-7H6.5" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="8" cy="16" r="1.5" stroke={color} strokeWidth="1" fill="none"/><circle cx="14" cy="16" r="1.5" stroke={color} strokeWidth="1" fill="none"/></>,
    fork: <><line x1="6" y1="3" x2="6" y2="17" stroke={color} strokeWidth="1.3" strokeLinecap="round"/><path d="M4 3v4c0 1.5 1 2.5 2 2.5s2-1 2-2.5V3" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/><path d="M12 3v3c0 2 1 3 2 3v8" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/><path d="M14 9c1 0 2-1 2-3V3" stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round"/></>,
    lock: <><rect x="5" y="9" width="10" height="8" rx="1.5" stroke={color} strokeWidth="1.3" fill="none"/><path d="M7 9V6.5C7 4.5 8.5 3 10 3C11.5 3 13 4.5 13 6.5V9" stroke={color} strokeWidth="1.3" fill="none"/><circle cx="10" cy="13" r="1" fill={color}/></>,
    globe: <><circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.3" fill="none"/><ellipse cx="10" cy="10" rx="3.5" ry="7" stroke={color} strokeWidth="1" fill="none"/><line x1="3" y1="10" x2="17" y2="10" stroke={color} strokeWidth="1"/></>,
    message: <><rect x="3" y="4" width="14" height="10" rx="2" stroke={color} strokeWidth="1.3" fill="none"/><path d="M3 7l7 4 7-4" stroke={color} strokeWidth="1.2" fill="none"/></>,
  };
  return (
    <svg viewBox="0 0 20 20" style={s}>
      {paths[name] || <circle cx="10" cy="10" r="7" stroke={color} strokeWidth="1.5" fill="none" />}
    </svg>
  );
}

/* ── Button ── */
function WBtn({ children, primary, small, full, style: extraStyle }) {
  return (
    <div style={{
      padding: small ? "6px 12px" : "10px 18px",
      borderRadius: 8,
      background: primary ? WK.accent : "#fff",
      color: primary ? "#fff" : WK.dark,
      border: primary ? "none" : `1.5px solid ${WK.border}`,
      fontFamily: WK.fontClean,
      fontSize: small ? 11 : 13,
      fontWeight: 600,
      textAlign: "center",
      width: full ? "100%" : "auto",
      boxSizing: "border-box",
      ...extraStyle,
    }}>{children}</div>
  );
}

/* ── Search Bar ── */
function WSearch({ placeholder = "Search wines..." }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#F0F0F0", margin: "0" }}>
      <WIcon name="search" size={16} color={WK.mid} />
      <span style={{ fontSize: 13, color: WK.mid, fontFamily: WK.fontClean }}>{placeholder}</span>
    </div>
  );
}

/* ── Card ── */
function WCard({ children, style: extraStyle, noPad }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${WK.light}`, padding: noPad ? 0 : 12, ...extraStyle }}>{children}</div>
  );
}

/* ── Placeholder (image/content area) ── */
function WPlaceholder({ height = 80, label, style: extraStyle, children }) {
  return (
    <div style={{
      height, borderRadius: 8, background: `repeating-linear-gradient(45deg, ${WK.light}, ${WK.light} 4px, #ECECEC 4px, #ECECEC 8px)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4,
      ...extraStyle,
    }}>
      {children}
      {label && <span style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean, fontWeight: 500 }}>{label}</span>}
    </div>
  );
}

/* ── Tag / Chip ── */
function WTag({ children, active, color }) {
  const bg = active ? (color || WK.accentLight) : "#F0F0F0";
  const fg = active ? WK.accent : WK.mid;
  return (
    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 20, background: bg, color: fg, fontSize: 10, fontWeight: 600, fontFamily: WK.fontClean }}>{children}</span>
  );
}

/* ── Progress Bar ── */
function WProgress({ value = 0.5, color, height = 6 }) {
  return (
    <div style={{ height, borderRadius: height, background: WK.light, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${value * 100}%`, borderRadius: height, background: color || WK.accent }}></div>
    </div>
  );
}

/* ── Star Rating ── */
function WStars({ rating = 3, max = 5, size = 14 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <WIcon key={i} name={i < rating ? "star" : "starOutline"} size={size} color={i < rating ? "#E8A838" : WK.light} />
      ))}
    </div>
  );
}

/* ── Divider ── */
function WDivider({ margin = 8 }) {
  return <div style={{ height: 1, background: WK.light, margin: `${margin}px 0` }}></div>;
}

/* ── Section Header ── */
function WSection({ title, action, style: extraStyle }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", ...extraStyle }}>
      <span style={{ fontSize: 14, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>{title}</span>
      {action && <span style={{ fontSize: 11, color: WK.accent, fontWeight: 600, fontFamily: WK.fontClean }}>{action}</span>}
    </div>
  );
}

/* ── Match Score Badge ── */
function WMatch({ score = 92 }) {
  const color = score >= 85 ? "#4CAF50" : score >= 70 ? "#FFA726" : WK.mid;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 6, background: color + "18", border: `1px solid ${color}40` }}>
      <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: WK.fontClean }}>{score}%</span>
      <span style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>match</span>
    </div>
  );
}

/* ── Wine List Item ── */
function WWineRow({ name = "Wine Name", sub = "Region · Grape", score, rating, price, compact }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: compact ? "6px 0" : "8px 0" }}>
      <div style={{ width: compact ? 32 : 40, height: compact ? 44 : 52, borderRadius: 4, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <WIcon name="wine" size={compact ? 14 : 18} color={WK.accent} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
        <div style={{ fontSize: compact ? 10 : 11, color: WK.mid, fontFamily: WK.fontClean }}>{sub}</div>
        {rating && <WStars rating={rating} size={10} />}
      </div>
      {score && <WMatch score={score} />}
      {price && <span style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{price}</span>}
    </div>
  );
}

/* ── Exports ── */
Object.assign(window, { WK, Phone, WBar, WNav, WBtn, WSearch, WCard, WPlaceholder, WTag, WProgress, WStars, WIcon, WDivider, WSection, WMatch, WWineRow });
