/* Vinterest — Wine Detail Variations */

/* ═══════════════════════════════════════════
   A) "The Card" — stacked info cards, scannable
   ═══════════════════════════════════════════ */
function WineDetailCard() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Hero */}
        <div style={{ background: `linear-gradient(180deg, #2D1B2E 0%, ${WK.accent} 100%)`, padding: "12px 16px 20px", display: "flex", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", width: "100%" }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WIcon name="back" size={14} color="#fff" />
            </div>
            <div style={{ flex: 1 }}></div>
            <div style={{ display: "flex", gap: 8 }}>
              <WIcon name="heart" size={20} color="#fff" />
              <WIcon name="share" size={20} color="#fff" />
            </div>
          </div>
        </div>
        <div style={{ background: `linear-gradient(180deg, ${WK.accent} 0%, ${WK.accent}00 100%)`, marginTop: -1, padding: "0 16px 16px", display: "flex", gap: 14 }}>
          <div style={{ width: 56, height: 80, borderRadius: 8, background: "rgba(255,255,255,0.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="wine" size={28} color="rgba(255,255,255,0.7)" />
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#fff", fontFamily: WK.fontClean, lineHeight: 1.2 }}>Château Margaux</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: WK.fontClean, marginTop: 2 }}>2018 · Bordeaux, France</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <WTag active>Red</WTag>
              <WTag>Cabernet Blend</WTag>
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Match + Stats Row */}
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Your Match", value: "94%", color: "#4CAF50" }, { label: "Community", value: "4.7★", color: "#E8A838" }, { label: "Price Range", value: "$180–220", color: WK.dark }].map((s, i) => (
              <WCard key={i} style={{ flex: 1, textAlign: "center", padding: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: s.color, fontFamily: WK.fontClean }}>{s.value}</div>
                <div style={{ fontSize: 8, color: WK.mid, fontFamily: WK.fontClean }}>{s.label}</div>
              </WCard>
            ))}
          </div>

          {/* Why You'll Like It */}
          <WCard style={{ background: "#F5FFF5", border: "1px solid #C8E6C9", padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 4 }}>Why This Matches You</div>
            <div style={{ fontSize: 10, color: "#555", fontFamily: WK.fontClean, lineHeight: 1.5 }}>Full-bodied with dark fruit and earthy notes — aligns with your preference for structured Bordeaux-style reds.</div>
          </WCard>

          {/* Taste Profile — educational */}
          <WCard style={{ padding: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>What Does This Taste Like?</span>
              <span style={{ fontSize: 9, color: WK.accent, fontWeight: 600, fontFamily: WK.fontClean }}>Tap any term to learn more</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {[
                { name: "Body", plain: "How heavy it feels in your mouth", lo: "Light", hi: "Full", value: 0.85, color: "#9B4D6A" },
                { name: "Tannins", plain: "That drying, grippy sensation on your gums", lo: "Silky", hi: "Grippy", value: 0.8, color: "#7B5EA7" },
                { name: "Acidity", plain: "How zingy and fresh it tastes", lo: "Mellow", hi: "Zingy", value: 0.6, color: "#3D9E6B" },
                { name: "Sweetness", plain: "Sugar level — dry means barely any", lo: "Bone Dry", hi: "Sweet", value: 0.1, color: "#D4B95E" },
              ].map((t, i) => (
                <div key={i} style={{ background: "#F8F8F8", borderRadius: 8, padding: "8px 8px 6px", border: `1px solid ${WK.light}` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>{t.name}</span>
                    <div style={{ width: 14, height: 14, borderRadius: 7, background: WK.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 9, color: WK.mid, fontWeight: 700, fontFamily: WK.fontClean }}>?</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 8.5, color: WK.mid, fontFamily: WK.fontClean, lineHeight: 1.3, marginBottom: 6 }}>{t.plain}</div>
                  <WProgress value={t.value} height={5} color={t.color} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                    <span style={{ fontSize: 8, color: WK.mid, fontFamily: WK.fontClean }}>{t.lo}</span>
                    <span style={{ fontSize: 8, color: t.color, fontWeight: 700, fontFamily: WK.fontClean }}>{t.value >= 0.7 ? t.hi : t.value >= 0.4 ? "Med" : t.lo}</span>
                    <span style={{ fontSize: 8, color: WK.mid, fontFamily: WK.fontClean }}>{t.hi}</span>
                  </div>
                </div>
              ))}
            </div>
          </WCard>

          {/* Deep Dive Links */}
          <WCard noPad>
            {[{ title: "Bordeaux Region", sub: "Explore 48 wines from this region" }, { title: "Cabernet Sauvignon", sub: "Your most scanned grape varietal" }, { title: "Similar Wines", sub: "12 wines you haven't tried" }].map((link, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: i < 2 ? `1px solid ${WK.light}` : "none" }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{link.title}</div>
                  <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{link.sub}</div>
                </div>
                <WIcon name="chevron" size={12} color={WK.mid} />
              </div>
            ))}
          </WCard>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <WBtn primary full style={{ flex: 1 }}>Rate This Wine</WBtn>
            <WBtn full style={{ flex: 1 }}>Add to List</WBtn>
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* ═══════════════════════════════════════════
   B) "The Story" — narrative, readable format
   ═══════════════════════════════════════════ */
function WineDetailStory() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", padding: "4px 16px 8px", gap: 12 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <div style={{ flex: 1 }}></div>
          <WIcon name="heart" size={20} color={WK.mid} />
          <WIcon name="share" size={20} color={WK.mid} />
        </div>

        {/* Image area */}
        <WPlaceholder height={130} style={{ margin: "0 16px", borderRadius: 12 }}>
          <WIcon name="wine" size={40} color={WK.mid} />
          <span style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Vineyard / Bottle Photo</span>
        </WPlaceholder>

        {/* Content */}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
              <WTag active>94% Match</WTag>
              <WTag>Red</WTag>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: WK.dark, fontFamily: WK.fontClean, lineHeight: 1.1 }}>Château Margaux</div>
            <div style={{ fontSize: 12, color: WK.mid, fontFamily: WK.fontClean }}>2018 · Bordeaux, France</div>
          </div>

          {/* Narrative */}
          <div style={{ fontSize: 12, color: "#444", fontFamily: WK.fontClean, lineHeight: 1.6 }}>
            A flagship Bordeaux blend with layers of dark cassis, violets, and subtle cedar. The structured tannins and long finish make it ideal for cellaring, but it's beautifully approachable now.
          </div>

          {/* Key Facts as inline chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Full Body", "Dry", "High Tannin", "Cabernet Blend", "Pairs with Red Meat", "Cellar 10+ yrs"].map((f, i) => (
              <WTag key={i}>{f}</WTag>
            ))}
          </div>

          {/* Your Connection */}
          <WCard style={{ background: WK.accentLight, border: `1px solid ${WK.accent}30`, padding: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: WK.accent, fontFamily: WK.fontClean, marginBottom: 4 }}>Your Connection to This Wine</div>
            <div style={{ fontSize: 10, color: WK.dark, fontFamily: WK.fontClean, lineHeight: 1.5 }}>You rated Pauillac (same region) 4.5★ and love structured tannins. Cabernet Sauvignon is your #2 grape. This is a natural fit.</div>
          </WCard>

          {/* Explore More */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>Go Deeper</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ icon: "globe", label: "Bordeaux Region" }, { icon: "wine", label: "Cab. Sauvignon" }, { icon: "compass", label: "Similar Wines" }].map((l, i) => (
                <WCard key={i} style={{ flex: 1, padding: 8, textAlign: "center" }}>
                  <WIcon name={l.icon} size={18} color={WK.accent} style={{ margin: "0 auto 4px" }} />
                  <div style={{ fontSize: 9, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{l.label}</div>
                </WCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* ═══════════════════════════════════════════
   C) "The Dashboard" — data-forward, tabbed
   ═══════════════════════════════════════════ */
function WineDetailDash() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", padding: "4px 16px 6px", gap: 12 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, textAlign: "center" }}>Château Margaux 2018</div>
          <WIcon name="share" size={20} color={WK.mid} />
        </div>

        {/* Big Match Score */}
        <div style={{ textAlign: "center", padding: "8px 16px 12px" }}>
          <div style={{ width: 72, height: 72, borderRadius: 36, border: `3px solid #4CAF50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", background: "#4CAF5010" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#4CAF50", fontFamily: WK.fontClean }}>94</div>
              <div style={{ fontSize: 8, color: WK.mid, fontFamily: WK.fontClean, marginTop: -2 }}>% match</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean }}>Bordeaux · Cabernet Blend · Red · Dry</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><WIcon name="heart" size={14} color={WK.mid} /><span style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Save</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><WIcon name="share" size={14} color={WK.mid} /><span style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Share</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}><WIcon name="cart" size={14} color={WK.mid} /><span style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Buy</span></div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `2px solid ${WK.light}`, padding: "0 16px" }}>
          {["Overview", "Deep Dive", "Similar"].map((tab, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? WK.accent : WK.mid, fontFamily: WK.fontClean, borderBottom: i === 0 ? `2px solid ${WK.accent}` : "none", marginBottom: -2 }}>{tab}</div>
          ))}
        </div>

        {/* Tab Content: Overview */}
        <div style={{ flex: 1, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Taste Bars */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Taste Profile</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
              {[{ label: "Body", value: 0.85 }, { label: "Tannins", value: 0.8 }, { label: "Acidity", value: 0.6 }, { label: "Sweetness", value: 0.1 }, { label: "Alcohol", value: 0.7 }, { label: "Fruit", value: 0.75 }].map((t, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{t.label}</span>
                    <span style={{ fontSize: 9, color: WK.dark, fontFamily: WK.fontClean, fontWeight: 600 }}>{t.value >= 0.7 ? "High" : t.value >= 0.4 ? "Med" : "Low"}</span>
                  </div>
                  <WProgress value={t.value} height={4} color={WK.accent} />
                </div>
              ))}
            </div>
          </div>

          {/* Tasting Notes */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Tasting Notes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {["Black Cassis", "Cedar", "Violets", "Tobacco", "Graphite", "Dark Plum"].map((n, i) => (
                <WTag key={i} active={i < 3}>{n}</WTag>
              ))}
            </div>
          </div>

          {/* Food Pairing */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Pairs With</div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Grilled Steak", "Lamb", "Hard Cheese"].map((f, i) => (
                <div key={i} style={{ flex: 1, background: "#F8F8F8", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, marginBottom: 2 }}>{["🥩", "🍖", "🧀"][i]}</div>
                  <div style={{ fontSize: 9, color: WK.dark, fontFamily: WK.fontClean }}>{f}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate */}
          <WBtn primary full>Rate This Wine</WBtn>
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { WineDetailCard, WineDetailStory, WineDetailDash });
