/* Vinterest — Core Screens: Home Variations, Scan Flow, Taste Profile */

/* ═══════════════════════════════════════════
   HOME SCREEN VARIATIONS
   ═══════════════════════════════════════════ */

/* A) "The Scanner" — action-first, scan dominates */
function HomeScanner() {
  return (
    <Phone active={0}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px", gap: 14, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean }}>Good evening</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Ready to discover?</div>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="user" size={18} color={WK.accent} />
          </div>
        </div>

        {/* Big Scan CTA */}
        <div style={{ background: `linear-gradient(135deg, ${WK.accent}, #6B2D4A)`, borderRadius: 16, padding: "24px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="camera" size={28} color="#fff" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: WK.fontClean }}>Scan a Bottle</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: WK.fontClean, textAlign: "center" }}>Point your camera at any wine label</div>
        </div>

        {/* Secondary action */}
        <div style={{ display: "flex", gap: 10 }}>
          <WCard style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
            <WIcon name="list" size={18} color={WK.accent} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Wine List</div>
              <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>Scan a menu</div>
            </div>
          </WCard>
          <WCard style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
            <WIcon name="search" size={18} color={WK.accent} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Search</div>
              <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>Find a wine</div>
            </div>
          </WCard>
        </div>

        {/* Recent Scans */}
        <WSection title="Recent Scans" action="See All" />
        <div style={{ display: "flex", gap: 10, overflow: "hidden" }}>
          {["Château Margaux", "Cloudy Bay Sauv Blanc", "Whispering Angel"].map((w, i) => (
            <div key={i} style={{ minWidth: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ width: 52, height: 70, borderRadius: 6, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WIcon name="wine" size={22} color={WK.accent} />
              </div>
              <div style={{ fontSize: 9, color: WK.dark, fontFamily: WK.fontClean, textAlign: "center", fontWeight: 500 }}>{w}</div>
              <WStars rating={4 - i % 2} size={8} />
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/* B) "The Journal" — personal wine diary, timeline feel */
function HomeJournal() {
  return (
    <Phone active={0}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: WK.dark, fontFamily: WK.fontClean, letterSpacing: -0.5 }}>Vinterest</div>
          <div style={{ display: "flex", gap: 12 }}>
            <WIcon name="search" size={20} color={WK.dark} />
            <WIcon name="user" size={20} color={WK.dark} />
          </div>
        </div>

        {/* Taste Summary Card */}
        <div style={{ padding: "12px 16px" }}>
          <WCard style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Your Taste Profile</span>
              <WTag active>12 wines scanned</WTag>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ label: "Reds", pct: 0.6, color: "#9B4D6A" }, { label: "Whites", pct: 0.25, color: "#D4B95E" }, { label: "Rosé", pct: 0.1, color: "#E8A0B4" }, { label: "Sparkling", pct: 0.05, color: "#8FBECC" }].map((t, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: t.color, fontFamily: WK.fontClean }}>{Math.round(t.pct * 100)}%</div>
                  <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{t.label}</div>
                  <WProgress value={t.pct} color={t.color} height={4} />
                </div>
              ))}
            </div>
          </WCard>
        </div>

        {/* Timeline / Feed */}
        <div style={{ padding: "0 16px" }}>
          <WSection title="Recent Activity" action="All History" style={{ marginBottom: 10 }} />
        </div>
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { name: "Château Margaux 2018", sub: "Bordeaux · Cabernet Blend", rating: 5, note: "Special occasion — incredible" },
            { name: "Kim Crawford Sauvignon Blanc", sub: "Marlborough · Sauvignon Blanc", rating: 4, note: "Weeknight go-to" },
            { name: "Whispering Angel Rosé", sub: "Provence · Grenache Blend", rating: 3, note: "" },
          ].map((w, i) => (
            <WCard key={i}>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ width: 36, height: 48, borderRadius: 4, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name="wine" size={16} color={WK.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{w.name}</div>
                  <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>{w.sub}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <WStars rating={w.rating} size={10} />
                    {w.note && <span style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean, fontStyle: "italic" }}>"{w.note}"</span>}
                  </div>
                </div>
              </div>
            </WCard>
          ))}
        </div>
      </div>
    </Phone>
  );
}

/* C) "The Guide" — education & discovery forward */
function HomeGuide() {
  return (
    <Phone active={0}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: WK.dark, fontFamily: WK.fontClean, letterSpacing: -0.5 }}>Vinterest</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <WIcon name="flame" size={16} color="#E8A838" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#E8A838", fontFamily: WK.fontClean }}>5</span>
            <div style={{ width: 30, height: 30, borderRadius: 15, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
              <WIcon name="user" size={14} color={WK.accent} />
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div style={{ display: "flex", gap: 8 }}>
          {[{ icon: "camera", label: "Scan Bottle" }, { icon: "list", label: "Scan Menu" }, { icon: "search", label: "Search" }].map((a, i) => (
            <div key={i} style={{ flex: 1, background: i === 0 ? WK.accent : "#fff", borderRadius: 10, border: i === 0 ? "none" : `1px solid ${WK.light}`, padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <WIcon name={a.icon} size={18} color={i === 0 ? "#fff" : WK.dark} />
              <span style={{ fontSize: 10, fontWeight: 600, color: i === 0 ? "#fff" : WK.dark, fontFamily: WK.fontClean }}>{a.label}</span>
            </div>
          ))}
        </div>

        {/* Daily Learning */}
        <WCard style={{ background: "#FFF8E1", border: "1px solid #F5E6B8" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <WIcon name="book" size={22} color="#E8A838" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Today's Lesson</div>
              <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>What makes a wine "dry"?</div>
            </div>
            <WIcon name="chevron" size={14} color={WK.mid} />
          </div>
        </WCard>

        {/* Your Level */}
        <WCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Wine Explorer</span>
            <span style={{ fontSize: 10, color: WK.accent, fontWeight: 600, fontFamily: WK.fontClean }}>Level 3</span>
          </div>
          <WProgress value={0.65} height={6} />
          <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean, marginTop: 4 }}>180 / 280 XP to Level 4</div>
        </WCard>

        {/* Discover */}
        <WSection title="Wines You'll Love" action="More" />
        <div style={{ display: "flex", gap: 10 }}>
          {[{ name: "Pinot Gris", sub: "Alsace", score: 94 }, { name: "Soave Classico", sub: "Veneto", score: 89 }].map((w, i) => (
            <WCard key={i} style={{ flex: 1, padding: 10 }}>
              <div style={{ width: "100%", height: 50, borderRadius: 6, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <WIcon name="wine" size={20} color={WK.accent} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{w.name}</div>
              <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{w.sub}</div>
              <WMatch score={w.score} />
            </WCard>
          ))}
        </div>
      </div>
    </Phone>
  );
}


/* ═══════════════════════════════════════════
   SCAN FLOW
   ═══════════════════════════════════════════ */

function ScanCamera() {
  return (
    <Phone noNav noBar>
      <div style={{ flex: 1, background: "#1a1a1a", position: "relative", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "48px 20px 12px", position: "relative", zIndex: 2 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="back" size={16} color="#fff" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff", fontFamily: WK.fontClean }}>Scan Wine</div>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 20 20"><circle cx="10" cy="10" r="4" stroke="#fff" strokeWidth="1.5" fill="none"/><line x1="10" y1="2" x2="10" y2="5" stroke="#fff" strokeWidth="1.2"/><line x1="10" y1="15" x2="10" y2="18" stroke="#fff" strokeWidth="1.2"/><line x1="2" y1="10" x2="5" y2="10" stroke="#fff" strokeWidth="1.2"/><line x1="15" y1="10" x2="18" y2="10" stroke="#fff" strokeWidth="1.2"/></svg>
          </div>
        </div>

        {/* Viewfinder */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 200, height: 280, position: "relative" }}>
            {/* Corner brackets */}
            {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y], i) => (
              <div key={i} style={{ position: "absolute", [y ? "bottom" : "top"]: -2, [x ? "right" : "left"]: -2, width: 28, height: 28, border: `2.5px solid ${WK.accent}`, borderRadius: 4, [y ? "borderTop" : "borderBottom"]: "none", [x ? "borderLeft" : "borderRight"]: "none" }}></div>
            ))}
            {/* Scan line */}
            <div style={{ position: "absolute", top: "35%", left: 0, right: 0, height: 2, background: WK.accent, opacity: 0.6, boxShadow: `0 0 12px ${WK.accent}` }}></div>
            {/* Placeholder bottle shape */}
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: 50, height: 160, borderRadius: "8px 8px 4px 4px", border: "1.5px dashed rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WIcon name="wine" size={30} color="rgba(255,255,255,0.2)" />
            </div>
          </div>
        </div>

        {/* Bottom instruction */}
        <div style={{ padding: "16px 20px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", fontFamily: WK.fontClean, fontWeight: 500 }}>Position the wine label in the frame</div>
          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 0, justifyContent: "center", marginTop: 14, background: "rgba(255,255,255,0.1)", borderRadius: 8, overflow: "hidden", width: "fit-content", margin: "14px auto 0" }}>
            <div style={{ padding: "8px 20px", background: WK.accent, fontSize: 11, fontWeight: 600, color: "#fff", fontFamily: WK.fontClean }}>Bottle</div>
            <div style={{ padding: "8px 20px", fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.5)", fontFamily: WK.fontClean }}>Wine List</div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

function ScanResult() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        {/* Top: identified */}
        <div style={{ background: WK.accent, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="check" size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", fontFamily: WK.fontClean }}>Wine Identified!</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: WK.fontClean }}>Tap to see full details</div>
          </div>
        </div>

        {/* Wine card */}
        <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <WCard style={{ padding: 16 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <div style={{ width: 52, height: 72, borderRadius: 6, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <WIcon name="wine" size={24} color={WK.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Château Margaux 2018</div>
                <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean, marginTop: 2 }}>Bordeaux, France · Cabernet Blend</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <WTag active>Red</WTag>
                  <WTag>Full Body</WTag>
                  <WTag>Dry</WTag>
                </div>
              </div>
            </div>
          </WCard>

          {/* Quick stats */}
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Match", value: "94%", color: "#4CAF50" }, { label: "Rating", value: "4.7★", color: "#E8A838" }, { label: "Price", value: "$$$", color: WK.accent }].map((s, i) => (
              <WCard key={i} style={{ flex: 1, textAlign: "center", padding: 10 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color, fontFamily: WK.fontClean }}>{s.value}</div>
                <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{s.label}</div>
              </WCard>
            ))}
          </div>

          {/* Why you'll like it */}
          <WCard style={{ background: "#F5FFF5", border: "1px solid #C8E6C9" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Why you'll like this</div>
            <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean, lineHeight: 1.5 }}>Based on your profile, you enjoy full-bodied reds with earthy notes. This Bordeaux blend matches your taste for structured tannins.</div>
          </WCard>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            <WBtn primary full>See Full Details</WBtn>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <WBtn full style={{ flex: 1 }}>Rate It</WBtn>
            <WBtn full style={{ flex: 1 }}>Share</WBtn>
          </div>
        </div>
      </div>
    </Phone>
  );
}


/* ═══════════════════════════════════════════
   TASTE PROFILE
   ═══════════════════════════════════════════ */

function TasteProfile() {
  return (
    <Phone active={4}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 12 }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 50, height: 50, borderRadius: 25, background: WK.accentLight, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="user" size={24} color={WK.accent} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Your Taste Profile</div>
          <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean }}>Wine Explorer · Level 3 · 12 wines scanned</div>
        </div>

        {/* Category Breakdown */}
        <WCard>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, fontFamily: WK.fontClean, color: WK.dark }}>Wine Preferences</div>
          {[{ label: "Reds", pct: 58, color: "#9B4D6A" }, { label: "Whites", pct: 25, color: "#D4B95E" }, { label: "Rosé", pct: 12, color: "#E8A0B4" }, { label: "Sparkling", pct: 5, color: "#8FBECC" }].map((c, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: WK.dark, fontFamily: WK.fontClean, width: 55, fontWeight: 500 }}>{c.label}</span>
              <div style={{ flex: 1 }}><WProgress value={c.pct / 100} color={c.color} height={8} /></div>
              <span style={{ fontSize: 10, fontWeight: 600, color: c.color, fontFamily: WK.fontClean, width: 28, textAlign: "right" }}>{c.pct}%</span>
            </div>
          ))}
        </WCard>

        {/* Flavor Profile */}
        <WCard>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, fontFamily: WK.fontClean, color: WK.dark }}>Your Flavor DNA</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Earthy", "Structured Tannins", "Dark Fruit", "Vanilla", "Mineral", "Citrus", "Crisp Acidity"].map((f, i) => (
              <WTag key={i} active={i < 4}>{f}</WTag>
            ))}
          </div>
        </WCard>

        {/* Sommelier Script — per category */}
        <WCard style={{ padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <WIcon name="message" size={15} color={WK.accent} />
            <span style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Your Sommelier Script</span>
          </div>
          {/* Category tabs */}
          <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${WK.light}`, marginBottom: 10 }}>
            {[
              { label: "Reds", color: "#9B4D6A", active: true },
              { label: "Whites", color: "#D4B95E" },
              { label: "Rosé", color: "#E8A0B4" },
              { label: "Sparkling", color: "#8FBECC" },
            ].map((t, i) => (
              <div key={i} style={{ flex: 1, padding: "7px 4px", textAlign: "center", background: t.active ? t.color : "#fff", borderRight: i < 3 ? `1px solid ${WK.light}` : "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: t.active ? "#fff" : t.color, margin: "0 auto 3px" }}></div>
                <span style={{ fontSize: 9, fontWeight: 700, color: t.active ? "#fff" : WK.mid, fontFamily: WK.fontClean }}>{t.label}</span>
              </div>
            ))}
          </div>
          {/* Active script — Reds */}
          <div style={{ background: WK.accentLight, borderRadius: 8, padding: 10, border: `1px solid ${WK.accent}25` }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: WK.accent, fontFamily: WK.fontClean, marginBottom: 4 }}>When ordering reds, say:</div>
            <div style={{ fontSize: 11, color: WK.dark, fontFamily: WK.fontClean, lineHeight: 1.6, fontStyle: "italic" }}>
              "I enjoy full-bodied reds with earthy notes and structured tannins — Bordeaux blends and Barolo are favorites. I prefer dry wines in the $40–80 range."
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <WBtn small primary>Copy Script</WBtn>
            <WBtn small>Edit Preferences</WBtn>
          </div>
        </WCard>
      </div>
    </Phone>
  );
}

Object.assign(window, { HomeScanner, HomeJournal, HomeGuide, ScanCamera, ScanResult, TasteProfile });
