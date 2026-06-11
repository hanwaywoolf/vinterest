/* Vinterest — Education, Social, Discovery Screens */

/* ═══════════════════════════════════════════
   EDUCATION / QUIZ
   ═══════════════════════════════════════════ */

function LearnHub() {
  return (
    <Phone active={3}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 12 }}>
        {/* Header with streak */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: WK.dark, fontFamily: WK.fontClean }}>Learn</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <WIcon name="flame" size={18} color="#E8A838" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E8A838", fontFamily: WK.fontClean }}>5 day streak</span>
          </div>
        </div>

        {/* Level Card */}
        <WCard style={{ background: `linear-gradient(135deg, ${WK.accent}15, ${WK.accentLight})`, border: `1px solid ${WK.accent}30` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: WK.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WIcon name="trophy" size={22} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Wine Explorer — Level 3</div>
              <WProgress value={0.65} height={6} />
              <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean, marginTop: 3 }}>180 / 280 XP to Level 4 — "Connoisseur"</div>
            </div>
          </div>
        </WCard>

        {/* Daily Challenge */}
        <WCard style={{ background: "#FFF8E1", border: "1px solid #F5E6B8", padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#E8A838", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WIcon name="star" size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Daily Challenge</div>
              <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Can you name the 5 Bordeaux grapes?</div>
            </div>
            <WBtn small primary>Start</WBtn>
          </div>
        </WCard>

        {/* Topics */}
        <WSection title="Topics" action="See All" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { title: "Red Grapes", progress: 0.8, lessons: "8/10", color: "#9B4D6A", xp: "+40 XP" },
            { title: "White Grapes", progress: 0.5, lessons: "5/10", color: "#D4B95E", xp: "+30 XP" },
            { title: "French Regions", progress: 0.3, lessons: "3/10", color: "#6B8E6B", xp: "+20 XP" },
            { title: "Tasting Technique", progress: 0.1, lessons: "1/10", color: "#8FBECC", xp: "+10 XP" },
            { title: "Food Pairing", progress: 0, lessons: "0/8", color: "#E8A838", xp: "NEW", locked: true },
          ].map((t, i) => (
            <WCard key={i} style={{ padding: 10, opacity: t.locked ? 0.5 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: t.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {t.locked ? <WIcon name="lock" size={16} color={t.color} /> : <WIcon name="book" size={16} color={t.color} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{t.title}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: t.color, fontFamily: WK.fontClean }}>{t.xp}</span>
                  </div>
                  <WProgress value={t.progress} color={t.color} height={4} />
                  <span style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{t.lessons} lessons</span>
                </div>
              </div>
            </WCard>
          ))}
        </div>
      </div>
    </Phone>
  );
}

function QuizActive() {
  return (
    <Phone noNav noBar>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fff" }}>
        {/* Top bar */}
        <div style={{ padding: "48px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <div style={{ flex: 1 }}>
            <WProgress value={0.6} height={6} color={WK.accent} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: WK.mid, fontFamily: WK.fontClean }}>6/10</span>
        </div>

        {/* Question */}
        <div style={{ padding: "20px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ textAlign: "center" }}>
            <WTag active>Red Grapes · +20 XP</WTag>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, textAlign: "center", lineHeight: 1.3, padding: "0 8px" }}>
            Which grape is the primary variety in Barolo wines?
          </div>

          {/* Answer options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
            {[
              { label: "Sangiovese", state: "wrong" },
              { label: "Nebbiolo", state: "correct" },
              { label: "Barbera", state: "default" },
              { label: "Dolcetto", state: "default" },
            ].map((a, i) => (
              <div key={i} style={{
                padding: "14px 16px",
                borderRadius: 12,
                border: `2px solid ${a.state === "correct" ? "#4CAF50" : a.state === "wrong" ? "#E57373" : WK.light}`,
                background: a.state === "correct" ? "#E8F5E9" : a.state === "wrong" ? "#FFEBEE" : "#fff",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{a.label}</span>
                {a.state === "correct" && <WIcon name="check" size={18} color="#4CAF50" />}
                {a.state === "wrong" && <span style={{ fontSize: 14, color: "#E57373" }}>✕</span>}
              </div>
            ))}
          </div>

          {/* Explanation */}
          <WCard style={{ background: "#E8F5E9", border: "1px solid #C8E6C9", padding: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#2E7D32", fontFamily: WK.fontClean, marginBottom: 4 }}>Correct! Nebbiolo 🎉</div>
            <div style={{ fontSize: 10, color: "#444", fontFamily: WK.fontClean, lineHeight: 1.5 }}>Nebbiolo is the sole grape in Barolo and Barbaresco. It's known for high tannins, high acidity, and complex aromas of tar and roses.</div>
          </WCard>

          <div style={{ marginTop: "auto" }}>
            <WBtn primary full>Next Question →</WBtn>
          </div>
        </div>
      </div>
    </Phone>
  );
}

function QuizResult() {
  return (
    <Phone noNav noBar>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "48px 16px 24px", alignItems: "center", gap: 16, textAlign: "center" }}>
        {/* Trophy */}
        <div style={{ width: 80, height: 80, borderRadius: 40, background: "#FFF8E1", border: "3px solid #E8A838", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <WIcon name="trophy" size={40} color="#E8A838" />
        </div>

        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: WK.dark, fontFamily: WK.fontClean }}>Great Work!</div>
          <div style={{ fontSize: 13, color: WK.mid, fontFamily: WK.fontClean, marginTop: 4 }}>Red Grapes Quiz Complete</div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 16, width: "100%" }}>
          {[{ label: "Score", value: "8/10", color: "#4CAF50" }, { label: "XP Earned", value: "+45", color: "#E8A838" }, { label: "Streak", value: "5 🔥", color: "#FF7043" }].map((s, i) => (
            <WCard key={i} style={{ flex: 1, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: WK.fontClean }}>{s.value}</div>
              <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>{s.label}</div>
            </WCard>
          ))}
        </div>

        {/* Level Progress */}
        <WCard style={{ width: "100%", padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Level Progress</div>
          <WProgress value={0.8} height={8} />
          <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean, marginTop: 4 }}>225 / 280 XP — Almost "Connoisseur"!</div>
        </WCard>

        {/* Unlocked */}
        <WCard style={{ width: "100%", background: "#FFF8E1", border: "1px solid #F5E6B8", padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#E8A838", fontFamily: WK.fontClean }}>🎉 New Content Unlocked</div>
          <div style={{ fontSize: 10, color: WK.dark, fontFamily: WK.fontClean, marginTop: 4 }}>Italian Regions quiz is now available!</div>
        </WCard>

        {/* Leaderboard snippet */}
        <WCard style={{ width: "100%", padding: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>Friends Leaderboard</div>
          {["You — 1,240 XP", "Sarah M. — 1,180 XP", "James K. — 980 XP"].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? WK.accent : WK.mid, fontFamily: WK.fontClean, width: 18 }}>#{i + 1}</span>
              <span style={{ fontSize: 11, color: i === 0 ? WK.dark : WK.mid, fontWeight: i === 0 ? 600 : 400, fontFamily: WK.fontClean }}>{f}</span>
            </div>
          ))}
        </WCard>

        <div style={{ display: "flex", gap: 8, width: "100%", marginTop: "auto" }}>
          <WBtn full style={{ flex: 1 }}>Back to Learn</WBtn>
          <WBtn primary full style={{ flex: 1 }}>Share Result</WBtn>
        </div>
      </div>
    </Phone>
  );
}


/* ═══════════════════════════════════════════
   SOCIAL / SHARING
   ═══════════════════════════════════════════ */

function SocialProfile() {
  return (
    <Phone active={4}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 10 }}>
        {/* Profile Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: WK.accentLight, margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <WIcon name="user" size={28} color={WK.accent} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Alex Chen</div>
          <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean }}>Wine Explorer · Level 3</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 8 }}>
            {[{ n: "32", l: "Wines" }, { n: "12", l: "Following" }, { n: "8", l: "Followers" }].map((s, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>{s.n}</div>
                <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `2px solid ${WK.light}` }}>
          {["My Wines", "Lists", "Activity"].map((tab, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? WK.accent : WK.mid, fontFamily: WK.fontClean, borderBottom: i === 0 ? `2px solid ${WK.accent}` : "none", marginBottom: -2 }}>{tab}</div>
          ))}
        </div>

        {/* Wine Lists */}
        <div style={{ display: "flex", gap: 8 }}>
          {[{ title: "Favorites", count: "12 wines", color: "#E57373" }, { title: "Want to Try", count: "8 wines", color: "#81C784" }].map((list, i) => (
            <WCard key={i} style={{ flex: 1, padding: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: list.color + "20", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 6 }}>
                <WIcon name={i === 0 ? "heart" : "star"} size={14} color={list.color} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{list.title}</div>
              <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{list.count}</div>
            </WCard>
          ))}
        </div>

        {/* Recent wines */}
        <WSection title="Recent Wines" />
        {[
          { name: "Château Margaux 2018", sub: "Bordeaux", rating: 5 },
          { name: "Kim Crawford Sauv Blanc", sub: "Marlborough", rating: 4 },
          { name: "Whispering Angel Rosé", sub: "Provence", rating: 3 },
        ].map((w, i) => (
          <div key={i}>
            <WWineRow name={w.name} sub={w.sub} rating={w.rating} compact />
            {i < 2 && <WDivider margin={2} />}
          </div>
        ))}
      </div>
    </Phone>
  );
}

function ShareWine() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Share Wine</span>
        </div>

        <div style={{ padding: "0 16px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Wine Preview Card */}
          <WCard style={{ background: `linear-gradient(135deg, ${WK.accent}10, ${WK.accentLight})`, padding: 14 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <div style={{ width: 48, height: 64, borderRadius: 6, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WIcon name="wine" size={22} color={WK.accent} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Château Margaux 2018</div>
                <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Bordeaux · Cabernet Blend</div>
                <WStars rating={5} size={12} />
              </div>
            </div>
            <div style={{ fontSize: 11, color: WK.dark, fontFamily: WK.fontClean, marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>"Absolutely incredible — one of the best wines I've ever had. Perfect for a special occasion."</div>
          </WCard>

          {/* Share options */}
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Send via</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "iMessage", color: "#34C759", icon: "message" },
              { label: "WhatsApp", color: "#25D366", icon: "message" },
              { label: "Copy Link", color: WK.mid, icon: "share" },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: s.color + "15", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name={s.icon} size={22} color={s.color} />
                </div>
                <span style={{ fontSize: 10, color: WK.dark, fontFamily: WK.fontClean, fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Message preview */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Preview</div>
            <WCard style={{ background: "#F0F0F0", padding: 12, borderRadius: 16 }}>
              <div style={{ fontSize: 11, color: WK.dark, fontFamily: WK.fontClean, lineHeight: 1.5 }}>
                Check out this wine I discovered on Vinterest! 🍷
              </div>
              <div style={{ marginTop: 8, background: "#fff", borderRadius: 10, padding: 10, border: `1px solid ${WK.light}` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Château Margaux 2018</div>
                <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>vinterest.app/wine/chateau-margaux-2018</div>
                <div style={{ fontSize: 9, color: WK.accent, fontFamily: WK.fontClean, marginTop: 4, fontWeight: 600 }}>Download Vinterest to explore wines →</div>
              </div>
            </WCard>
          </div>

          {/* Friends to send to */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 6 }}>Quick Send</div>
            <div style={{ display: "flex", gap: 12 }}>
              {["Sarah M.", "James K.", "Priya R."].map((f, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: WK.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <WIcon name="user" size={18} color={WK.mid} />
                  </div>
                  <span style={{ fontSize: 9, color: WK.dark, fontFamily: WK.fontClean }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Phone>
  );
}

/* ═══════════════════════════════════════════
   DISCOVERY — Similar Wines Deep Dive
   ═══════════════════════════════════════════ */

function DiscoverSimilar() {
  return (
    <Phone active={1}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>If You Like Pinot Grigio...</div>
            <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Based on your taste profile</div>
          </div>
        </div>

        {/* Your go-to */}
        <WCard style={{ background: WK.accentLight, border: `1px solid ${WK.accent}30`, padding: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: WK.accent, fontFamily: WK.fontClean, marginBottom: 4 }}>YOUR GO-TO</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 44, borderRadius: 4, background: "#D4B95E20", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WIcon name="wine" size={14} color="#D4B95E" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Pinot Grigio</div>
              <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Light, crisp, dry white · Scanned 6× · Avg rating 4.2★</div>
            </div>
          </div>
        </WCard>

        {/* Similar varieties */}
        <WSection title="Try These Instead" action="Why?" />
        {[
          { name: "Pinot Gris", region: "Alsace, France", note: "Same grape, richer style — more body and texture", score: 95, color: "#D4B95E" },
          { name: "Pinot Blanc", region: "Alsace / Alto Adige", note: "Close relative — crisp and clean with subtle apple notes", score: 91, color: "#D4B95E" },
          { name: "Soave Classico", region: "Veneto, Italy", note: "Garganega grape — similar weight and minerality to Pinot Grigio", score: 88, color: "#D4B95E" },
          { name: "Vermentino", region: "Sardinia / Provence", note: "Zesty and herbal — a Mediterranean cousin", score: 84, color: "#D4B95E" },
          { name: "Albariño", region: "Rías Baixas, Spain", note: "Aromatic and crisp — a step toward Sauvignon Blanc", score: 80, color: "#D4B95E" },
        ].map((w, i) => (
          <WCard key={i} style={{ padding: 10 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ width: 32, height: 44, borderRadius: 4, background: w.color + "20", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WIcon name="wine" size={14} color={w.color} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{w.name}</span>
                  <WMatch score={w.score} />
                </div>
                <div style={{ fontSize: 9, color: WK.mid, fontFamily: WK.fontClean }}>{w.region}</div>
                <div style={{ fontSize: 10, color: "#555", fontFamily: WK.fontClean, marginTop: 3, lineHeight: 1.4 }}>{w.note}</div>
              </div>
            </div>
          </WCard>
        ))}

        {/* Pivot tip */}
        <WCard style={{ background: "#E8F5E9", border: "1px solid #C8E6C9", padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#2E7D32", fontFamily: WK.fontClean, marginBottom: 4 }}>💡 Menu Tip</div>
          <div style={{ fontSize: 10, color: "#444", fontFamily: WK.fontClean, lineHeight: 1.5 }}>Don't see Pinot Grigio on the list? Ask for Soave or Vermentino — they're in the same flavor family and often better value.</div>
        </WCard>
      </div>
    </Phone>
  );
}

Object.assign(window, { LearnHub, QuizActive, QuizResult, SocialProfile, ShareWine, DiscoverSimilar });
