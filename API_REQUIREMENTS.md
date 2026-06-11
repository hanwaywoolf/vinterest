# Vinterest — API & Backend Requirements

## Architecture Overview

```
User Device (PWA)
    │
    ├── Wine Label Recognition  ──► Google Cloud Vision API
    ├── Wine Database           ──► Wine-Searcher API + own DB
    ├── AI Sommelier Scripts    ──► Claude API (Anthropic)
    ├── Auth & User Profiles    ──► Supabase Auth
    ├── Taste Profile Storage   ──► Supabase (PostgreSQL)
    ├── Social / Sharing        ──► Web Share API + Dynamic Links
    └── Wine Ordering           ──► Retailer Affiliate APIs
```

---

## 1. Wine Label Recognition

### Primary: Claude Vision API (Anthropic)
- **Model:** `claude-opus-4-5` (or `claude-sonnet-4-5` for faster/cheaper)
- **Docs:** [docs.anthropic.com](https://docs.anthropic.com)
- **Cost:** ~$15 per million input tokens — a label scan is ~1,000 tokens (~$0.015/scan)
- **Env var:** `ANTHROPIC_API_KEY`

**Why Claude over Google Vision:**
- Single API call returns structured wine data (name, region, grapes, tasting notes, food pairings, ABV, price estimate)
- Generates plain-English descriptions ready for display — no post-processing needed
- Personalises "why you'll like this" when taste profile is passed with the request
- No separate OCR + matching pipeline required

**Request flow:**
1. Capture JPEG frame from camera → strip `data:image/jpeg;base64,` prefix
2. `POST /api/recognise` with base64 image + optional taste profile
3. Netlify Function sends to `api.anthropic.com/v1/messages` with vision prompt
4. Claude returns structured JSON — wine name, region, grapes, taste scores, notes, pairings
5. Client displays result on Wine Identified screen

**Fallback:** If no API key is configured, the function returns a demo wine result so the UI never breaks.

### Alternative: Google Cloud Vision + matching
- Still viable if cost is a concern at scale
- Requires separate OCR → text extraction → fuzzy match against wine DB
- Less accurate for complex or multi-language labels

---

## 2. Wine Database

### Primary: Wine-Searcher API
- **Docs:** [api.wine-searcher.com](https://api.wine-searcher.com)
- **Data:** 15M+ wines, pricing across 100k+ retailers, tasting notes, ratings
- **Pricing:** Commercial license required — contact Wine-Searcher
- **Key endpoints:**
  - `GET /wine/search?q={name}` — search wines by name
  - `GET /wine/{id}` — full wine record
  - `GET /wine/{id}/prices` — live pricing by country/region

### Secondary: Vivino (restricted)
- No public API — requires partnership agreement
- Alternative: scrape-free access via Vivino for Business

### Open/Free Wine Data Sources
- **Open Food Facts** — barcode data for some wines: `openfoodfacts.org/api`
- **LCBO API** (Canada) — `lcbo.com/en/api` — full product catalog, pricing
- **Wine of the Month Club API** — US-focused

### Self-hosted Wine DB
Recommend seeding a **Supabase PostgreSQL** table with:
```sql
wines (
  id, name, producer, vintage, region, country, sub_region,
  grape_varieties text[], wine_type, style, abv,
  tasting_notes text, body, tannins, acidity, sweetness,  -- 0.0-1.0 scales
  food_pairings text[], avg_price_usd, community_rating,
  vivino_id, wine_searcher_id, barcode
)
```
Populate via Wine-Searcher or a wine data broker like **Bottlenotes** or **WineDirect**.

---

## 3. AI Sommelier Scripts (Claude API)

### Anthropic Claude API
- **Docs:** [docs.anthropic.com](https://docs.anthropic.com)
- **Model:** `claude-opus-4-5` or `claude-sonnet-4-5` for cost/quality balance
- **Cost:** ~$3–15 per million tokens (well within budget for summaries)

**Sommelier script generation prompt:**
```
System: You are a friendly, non-pretentious sommelier helping a casual wine drinker
        articulate their preferences. Generate a 2-3 sentence natural-language script
        they can say to a server or sommelier. Be specific but approachable.

User: Wine type: Red
      Top preferences: full-bodied, earthy, structured tannins
      Favourite regions: Bordeaux, Barolo
      Favourite grapes: Cabernet Sauvignon, Nebbiolo
      Budget: $40-80
      Context: date night, steak dinner

Response: "I enjoy full-bodied reds with earthy character and firm tannins —
           Bordeaux blends and Barolo are favourites. I'm having the steak tonight,
           so something structured in the $50–80 range would be ideal."
```

**Wine description enrichment:**
- Pass wine name + region + grape → Claude generates accessible tasting notes
- Adds "why you'll like this" personalised paragraph based on user profile

### Fallback: OpenAI GPT-4o
- Drop-in replacement for script generation if Anthropic unavailable

---

## 4. Authentication & User Profiles

### Supabase Auth
- **Docs:** [supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
- **Providers:** Email/password, Google OAuth, Apple Sign-In
- **Free tier:** Up to 50,000 MAU
- **Key tables:**

```sql
-- Supabase managed
auth.users (id, email, created_at)

-- App-managed
profiles (
  id uuid references auth.users,
  display_name, avatar_url,
  country, preferred_currency,
  level int default 1,
  xp int default 0,
  streak_days int default 0,
  last_scan_at timestamptz
)

wine_scans (
  id, user_id, wine_id,
  scanned_at timestamptz,
  rating smallint,           -- 1-5 stars
  notes text,
  times_consumed int default 1,
  occasion text
)

taste_profile (
  user_id,
  red_pct, white_pct, rose_pct, sparkling_pct,  -- sum to 100
  red_script text, white_script text,
  rose_script text, sparkling_script text,
  flavour_tags text[],
  last_updated_at timestamptz
)

wine_lists (id, user_id, name, is_public, wines uuid[])
```

---

## 5. Restaurant Mode — Wine List Scanning

### Multi-page menu scanning
- User photographs each page of the wine list
- Send each image to **Google Vision API** (`DOCUMENT_TEXT_DETECTION`)
- Parse the extracted text to identify wine names, vintages, prices
- Match each entry against the wine database
- Score each match against the user's taste profile

**Parsing approach:**
```
Page OCR text → split by newlines → regex for wine patterns
→ fuzzy match against wine DB → scored + annotated list
```

**Fallback (no scan):** User enters restaurant name → search partner database for digital wine lists (Presto, OpenTable, SevenRooms integrations).

---

## 6. Social & Sharing

### Web Share API (built-in, no cost)
```javascript
navigator.share({
  title: 'Château Margaux 2018 on Vinterest',
  text: 'I rated this 5 stars — you need to try this! 🍷',
  url: 'https://vinterest.app/wine/chateau-margaux-2018?ref=share&from=user123'
})
```

### Dynamic / Deep Links
- **Firebase Dynamic Links** (free) — `https://vinterest.app/wine/{id}?ref=share`
- If recipient has app installed → opens wine detail screen
- If not installed → opens App Store / Play Store with deferred deep link

### WhatsApp / iMessage
- WhatsApp: `https://wa.me/?text={encodedMessage}` (no API needed)
- iMessage: `sms:&body={encodedMessage}` (no API needed)

---

## 7. Wine Purchasing Integration

### Wine-Searcher Affiliate
- Display live pricing from local retailers
- Affiliate commission on clicks/purchases
- `GET /wine/{id}/prices?country=US` → retailer list with price + buy URL

### Country-Specific Integrations
| Country | API/Partner |
|---------|-------------|
| UK | Vivino, Majestic Wine API |
| USA | Wine.com Affiliate, Total Wine |
| Canada | LCBO API (public) |
| Australia | Dan Murphy's, Cellar Masters |
| EU | Vivino for Business, Winestyr |

### Direct Order (future)
- Partner with wine distributors via **WineDirect API** or **Commerce7**
- Enable in-app purchase with Stripe for direct wine club orders

---

## 8. Push Notifications

### Web Push (free, built-in PWA)
```javascript
// Request permission + get subscription
const sub = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: VAPID_PUBLIC_KEY
});
// Store sub in Supabase, send via web-push npm package server-side
```

**Use cases:**
- Daily quiz reminders (streak protection)
- "Your friend just scanned a wine"
- Price drop alerts on saved wines
- Seasonal wine recommendations

---

## 9. Suggested Tech Stack Summary

| Layer | Recommendation | Cost |
|-------|---------------|------|
| Hosting | **Netlify** (static PWA) | Free |
| Auth | **Supabase Auth** | Free / $25/mo |
| Database | **Supabase PostgreSQL** | Free / $25/mo |
| Wine recognition | **Google Vision API** | ~$1.50/1k scans |
| Wine data | **Wine-Searcher API** | License required |
| AI scripts | **Claude API (Anthropic)** | ~$0.01/script |
| Storage (photos) | **Supabase Storage** or Cloudinary | Free tier |
| Push notifications | **Web Push (VAPID)** | Free |
| Payments | **Stripe** | 2.9% + 30¢/txn |
| Deep links | **Firebase Dynamic Links** | Free |

**Estimated monthly cost (10k MAU):** $100–200/month

---

## 10. Development Roadmap

### Phase 1 — MVP (Weeks 1–8)
- [ ] Supabase project setup (auth + DB schema)
- [ ] Google Vision API integration for label OCR
- [ ] Wine-Searcher API integration (or seed DB manually with top 10k wines)
- [ ] Basic scan → identify → detail flow (live, not mocked)
- [ ] Star rating saved to `wine_scans` table
- [ ] Taste profile calculated from scan history

### Phase 2 — Smart Features (Weeks 9–16)
- [ ] Claude API for sommelier script generation
- [ ] Restaurant mode: wine list scanning + scoring
- [ ] Shopping mode: match score vs taste profile
- [ ] Social: share links + friend profiles
- [ ] Education / quiz engine with XP system

### Phase 3 — Commerce (Weeks 17–24)
- [ ] Wine-Searcher affiliate pricing
- [ ] Country-specific retailer integrations
- [ ] Push notifications (streaks, alerts)
- [ ] Premium subscription (Stripe)

---

*Vinterest — API Requirements v1.0 — June 2026*
