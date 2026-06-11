/* Vinterest — Restaurant Mode & Shopping Mode */

/* ═══════════════════════════════════════════
   RESTAURANT MODE
   ═══════════════════════════════════════════ */

function RestaurantEntry() {
  return (
    <Phone>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Restaurant Mode</span>
        </div>

        {/* Hero Card */}
        <div style={{ background: `linear-gradient(135deg, #2D1B2E, ${WK.accent})`, borderRadius: 16, padding: 20, textAlign: "center" }}>
          <WIcon name="fork" size={32} color="#fff" style={{ margin: "0 auto 8px" }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: WK.fontClean }}>Dining Tonight?</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: WK.fontClean, marginTop: 4 }}>Get confident wine recommendations tailored to your meal and budget.</div>
        </div>

        {/* Options */}
        <WCard style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: WK.accentLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <WIcon name="camera" size={22} color={WK.accent} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Scan Wine List</div>
            <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Take a photo of the menu and get instant recommendations</div>
          </div>
          <WIcon name="chevron" size={14} color={WK.mid} />
        </WCard>

        <WCard style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#FFF8E1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <WIcon name="message" size={22} color="#E8A838" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Quick Script</div>
            <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>No menu? Get a sommelier script for what to ask for</div>
          </div>
          <WIcon name="chevron" size={14} color={WK.mid} />
        </WCard>

        <WCard style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#E8F5E9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <WIcon name="search" size={22} color="#4CAF50" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Search Restaurant</div>
            <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Find a restaurant and browse their wine list</div>
          </div>
          <WIcon name="chevron" size={14} color={WK.mid} />
        </WCard>

        {/* Recent restaurants */}
        <WSection title="Recent Restaurants" style={{ marginTop: 4 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {["Le Bistro · 2 days ago", "Osteria Francescana · 1 week ago"].map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: WK.light, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WIcon name="fork" size={14} color={WK.mid} />
              </div>
              <span style={{ fontSize: 11, color: WK.dark, fontFamily: WK.fontClean }}>{r}</span>
              <div style={{ flex: 1 }}></div>
              <WIcon name="chevron" size={12} color={WK.mid} />
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

function RestaurantSetup() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "12px 16px", gap: 14 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Your Preferences</span>
        </div>
        <div style={{ fontSize: 11, color: WK.mid, fontFamily: WK.fontClean }}>Help us recommend the perfect wine for tonight.</div>

        {/* Budget */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>Budget per bottle</div>
          <div style={{ display: "flex", gap: 8 }}>
            {["$20–40", "$40–70", "$70–120", "$120+"].map((b, i) => (
              <div key={i} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1.5px solid ${i === 1 ? WK.accent : WK.light}`, background: i === 1 ? WK.accentLight : "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: i === 1 ? WK.accent : WK.dark, fontFamily: WK.fontClean }}>{b}</div>
              </div>
            ))}
          </div>
        </div>

        {/* What are you eating? */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>What are you eating?</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[{ label: "Red Meat", active: true }, { label: "Poultry" }, { label: "Seafood", active: true }, { label: "Pasta" }, { label: "Salad" }, { label: "Cheese" }, { label: "Spicy Food" }, { label: "Dessert" }].map((f, i) => (
              <WTag key={i} active={f.active}>{f.label}</WTag>
            ))}
          </div>
        </div>

        {/* Mood / Occasion */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>Occasion</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[{ label: "Date Night", active: true }, { label: "Business" }, { label: "Friends" }, { label: "Solo" }, { label: "Celebration" }].map((o, i) => (
              <WTag key={i} active={o.active}>{o.label}</WTag>
            ))}
          </div>
        </div>

        {/* Wine type preference */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean, marginBottom: 8 }}>Open to trying</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ label: "Reds", color: "#9B4D6A", active: true }, { label: "Whites", color: "#D4B95E", active: true }, { label: "Rosé", color: "#E8A0B4" }, { label: "Sparkling", color: "#8FBECC" }].map((t, i) => (
              <div key={i} style={{ flex: 1, padding: "10px 4px", borderRadius: 8, border: `1.5px solid ${t.active ? t.color : WK.light}`, background: t.active ? t.color + "15" : "#fff", textAlign: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: t.color, margin: "0 auto 4px" }}></div>
                <div style={{ fontSize: 10, fontWeight: 600, color: t.active ? t.color : WK.mid, fontFamily: WK.fontClean }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ flex: 1 }}></div>
        <WBtn primary full>Get Recommendations</WBtn>
        <div style={{ height: 8 }}></div>
      </div>
    </Phone>
  );
}

function RestaurantScript() {
  return (
    <Phone noNav>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Your Script</span>
          <div style={{ flex: 1 }}></div>
          <WIcon name="share" size={18} color={WK.mid} />
        </div>

        <div style={{ flex: 1, padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Sommelier Script */}
          <WCard style={{ background: WK.accentLight, border: `1.5px solid ${WK.accent}40`, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <WIcon name="message" size={16} color={WK.accent} />
              <span style={{ fontSize: 13, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Say This to Your Server</span>
            </div>
            <div style={{ fontSize: 12, color: WK.dark, fontFamily: WK.fontClean, lineHeight: 1.6, fontStyle: "italic" }}>
              "I'm looking for a full-bodied red in the $40–70 range. I typically enjoy wines with earthy notes and structured tannins — Bordeaux blends are a favorite. I'm having the steak tonight. What would you recommend?"
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <WBtn small primary>Copy Script</WBtn>
              <WBtn small>Regenerate</WBtn>
            </div>
          </WCard>

          {/* From the wine list */}
          <WSection title="From the Wine List" action="See all 14" />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <WCard style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 44, borderRadius: 4, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name="wine" size={14} color={WK.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Clos du Val Cabernet</div>
                  <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Napa Valley · $58</div>
                </div>
                <WMatch score={96} />
              </div>
              <div style={{ fontSize: 9, color: "#4CAF50", fontFamily: WK.fontClean, marginTop: 4, fontWeight: 500, paddingLeft: 42 }}>★ Best match on the list · In your budget</div>
            </WCard>
            <WCard style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 44, borderRadius: 4, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name="wine" size={14} color={WK.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Barolo Giacomo Conterno</div>
                  <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Piedmont · $65</div>
                </div>
                <WMatch score={91} />
              </div>
              <div style={{ fontSize: 9, color: WK.accent, fontFamily: WK.fontClean, marginTop: 4, fontWeight: 500, paddingLeft: 42 }}>Try something new — similar to wines you love</div>
            </WCard>
            <WCard style={{ padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 44, borderRadius: 4, background: "#D4B95E20", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name="wine" size={14} color="#D4B95E" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>Sancerre Henri Bourgeois</div>
                  <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>Loire Valley · $42</div>
                </div>
                <WMatch score={82} />
              </div>
              <div style={{ fontSize: 9, color: "#888", fontFamily: WK.fontClean, marginTop: 4, fontWeight: 500, paddingLeft: 42 }}>White option · Pairs well with your seafood</div>
            </WCard>
          </div>
        </div>
      </div>
    </Phone>
  );
}


/* ═══════════════════════════════════════════
   SHOPPING MODE
   ═══════════════════════════════════════════ */

function ShoppingScan() {
  return (
    <Phone>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "8px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <WIcon name="back" size={20} color={WK.dark} />
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Shopping Mode</span>
          <div style={{ flex: 1 }}></div>
          <WTag active>In Store</WTag>
        </div>

        {/* Scanned bottle result */}
        <div style={{ padding: "0 16px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Current scan result */}
          <WCard style={{ padding: 14, border: `1.5px solid #4CAF50` }}>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ width: 48, height: 66, borderRadius: 6, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <WIcon name="wine" size={22} color={WK.accent} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Meiomi Pinot Noir</div>
                    <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>California · Pinot Noir</div>
                  </div>
                  <WMatch score={88} />
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                  <WTag active>Red</WTag>
                  <WTag>Medium Body</WTag>
                </div>
                <div style={{ fontSize: 10, color: "#4CAF50", fontWeight: 500, fontFamily: WK.fontClean, marginTop: 6 }}>Similar to your Pinot Noirs from Oregon</div>
              </div>
            </div>
            <WDivider margin={10} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>$18.99</span>
              <div style={{ display: "flex", gap: 8 }}>
                <WBtn small>Details</WBtn>
                <WBtn small primary>Add to Cart</WBtn>
              </div>
            </div>
          </WCard>

          {/* Also consider */}
          <WSection title="Also on This Shelf" action="More" />
          {[
            { name: "Elouan Pinot Noir", sub: "Oregon · $22", score: 92, note: "Higher match — try this one!" },
            { name: "La Crema Pinot Noir", sub: "Sonoma · $19", score: 85, note: "Similar style, great value" },
          ].map((w, i) => (
            <WCard key={i} style={{ padding: 10 }}>
              <WWineRow name={w.name} sub={w.sub} score={w.score} compact />
              <div style={{ fontSize: 9, color: WK.accent, fontFamily: WK.fontClean, marginTop: 2, paddingLeft: 42, fontWeight: 500 }}>{w.note}</div>
            </WCard>
          ))}

          {/* Scan another */}
          <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingBottom: 8 }}>
            <WBtn primary full style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span>Scan Another Bottle</span>
            </WBtn>
          </div>
        </div>
      </div>
    </Phone>
  );
}

function ShoppingHistory() {
  return (
    <Phone active={4}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "12px 16px", gap: 10 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: WK.dark, fontFamily: WK.fontClean }}>Wine History</span>
          <div style={{ display: "flex", gap: 8 }}>
            <WTag active>All</WTag>
            <WTag>Favorites</WTag>
            <WTag>To Buy</WTag>
          </div>
        </div>

        <WSearch placeholder="Search your wines..." />

        {/* Wine list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { name: "Château Margaux 2018", sub: "Bordeaux · Scanned 3×", rating: 5, price: "$195" },
            { name: "Kim Crawford Sauv Blanc", sub: "Marlborough · Scanned 8×", rating: 4, price: "$14" },
            { name: "Meiomi Pinot Noir", sub: "California · Scanned 2×", rating: 4, price: "$19" },
            { name: "Whispering Angel Rosé", sub: "Provence · Scanned 5×", rating: 3, price: "$22" },
            { name: "Veuve Clicquot", sub: "Champagne · Scanned 1×", rating: 5, price: "$52" },
          ].map((w, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                <div style={{ width: 38, height: 50, borderRadius: 6, background: WK.accentLight, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <WIcon name="wine" size={16} color={WK.accent} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{w.name}</div>
                  <div style={{ fontSize: 10, color: WK.mid, fontFamily: WK.fontClean }}>{w.sub}</div>
                  <WStars rating={w.rating} size={10} />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: WK.dark, fontFamily: WK.fontClean }}>{w.price}</div>
                  <div style={{ fontSize: 9, color: WK.accent, fontFamily: WK.fontClean, fontWeight: 500 }}>Reorder →</div>
                </div>
              </div>
              {i < 4 && <WDivider margin={0} />}
            </div>
          ))}
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { RestaurantEntry, RestaurantSetup, RestaurantScript, ShoppingScan, ShoppingHistory });
