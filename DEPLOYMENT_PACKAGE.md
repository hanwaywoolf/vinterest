# Vinterest — Deployment Package

**Date:** June 16, 2026  
**Version:** 1.0  
**Status:** Ready for Production

---

## 📦 What's Included

### Core App Files
- `index.html` — Main PWA entry point (single-file React app via CDN)
- `manifest.json` — PWA manifest (app metadata, icons, shortcuts)
- `sw.js` — Service Worker (offline support, caching)
- `wines-db.json` — Local wine database (fallback when no API)

### Configuration
- `netlify.toml` — Netlify deployment config (redirects, headers, functions)
- `_headers` — Cache control headers (for Netlify)
- `_redirects` — URL redirects (SPA routing)
- `_worker.js` — Cloudflare Worker config (if using CF)

### API Bridge
- `claude-bridge.js` — Client-side Claude API proxy (handles authentication)

### Assets
- `logo.png` — App logo
- `/icons/` — PWA icons (192px, 512px, maskable variants)

### Development Files (do not deploy)
- `pwa-*.jsx` — Component source files (bundled into index.html)
- `Vinterest-App-Bundle.jsx` — Developer export
- Design/wireframe files (`*.html`)

---

## 🚀 Deployment Steps

### Option 1: Netlify (Recommended)

1. **Connect repository to Netlify**
   ```bash
   # Or use Netlify UI: https://app.netlify.com
   netlify deploy --prod
   ```

2. **Configure environment variables** in Netlify UI:
   - `ANTHROPIC_API_KEY` — Claude API key (for label recognition)
   - `WINE_SEARCHER_API_KEY` — Wine-Searcher API key (optional, for live pricing)

3. **Netlify Functions** (serverless API routes):
   - Deploy `/netlify/functions/claude` for AI label recognition
   - Deploy `/netlify/functions/lcbo` for LCBO pricing (Ontario)
   - See `netlify/functions/` folder for implementation

4. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

### Option 2: Cloudflare Pages

1. **Upload to Git** (GitHub/GitLab/Gitea)

2. **Connect to Cloudflare Pages**:
   - Go to https://dash.cloudflare.com → Pages
   - Select your repo, branch
   - Build: leave empty (static site)
   - Publish directory: `.` (root)

3. **Configure Workers** (if using `_worker.js`):
   - Set `_worker.js` as your root worker

---

## 🔐 Required Environment Variables

| Variable | Purpose | Obtain From |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Claude API for wine label recognition | console.anthropic.com |
| `WINE_SEARCHER_API_KEY` | Live wine pricing (optional) | api.wine-searcher.com |

**Note:** Client never sees these keys. They're only used server-side in Netlify Functions.

---

## 📱 PWA Features (Built-in)

- ✅ Installable on mobile (manifest.json)
- ✅ Works offline (Service Worker)
- ✅ Home screen icon + splash
- ✅ Camera access for label scanning
- ✅ Local storage for user data (wine history, taste profile)
- ✅ Deep linking (`/#scan`, `/#restaurant`, etc.)

---

## 🧪 Pre-Deployment Checklist

- [ ] All 13 JSX component files bundled into `index.html`
- [ ] Environment variables configured in deployment platform
- [ ] Service Worker (`sw.js`) loads without errors
- [ ] Manifest file references correct icon paths
- [ ] CORS headers configured for Claude API calls
- [ ] Cache-Control headers set (index.html: no-cache, assets: 3600s)
- [ ] Test on mobile (iOS home screen, Android install)
- [ ] Test offline mode (open DevTools → Application → Service Workers)

---

## 📊 Architecture at Deployment

```
User Device (PWA)
    ↓
    index.html (single React app, ~200KB gzipped)
    ├── sw.js (Service Worker)
    ├── wines-db.json (local DB, fallback)
    └── /icons/ (PWA assets)
    ↓
    Netlify / Cloudflare Pages (Static Hosting)
    ├── /.netlify/functions/claude (Label recognition)
    ├── /.netlify/functions/lcbo (Ontario pricing)
    └── /claude redirect → proxy endpoint
    ↓
    External APIs (optional)
    ├── Claude API (label recognition, pricing suggestions)
    ├── Wine-Searcher API (live retailer pricing)
    └── LCBO API (Ontario wine availability)
```

---

## 🚨 Known Limitations & Next Steps

### Current State (MVP)
- Wine database is **static** (`wines-db.json`)
- AI pricing is **Claude-generated** (not live retailer data yet)
- No user authentication (all local storage)
- No social/sharing backend
- No purchase integration

### To Launch Fully
1. **Connect real wine database** (Wine-Searcher API or Supabase)
2. **Set up Supabase** for user auth + cloud storage
3. **Implement payment** (Stripe for wine ordering)
4. **Add push notifications** (Web Push API + service)
5. **Create backend functions** for restaurant mode (OCR + matching)

See `API_REQUIREMENTS.md` for full roadmap.

---

## 📞 Support & Troubleshooting

### Service Worker Not Updating
- Hard refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)
- DevTools → Application → Service Workers → Unregister + reload

### Claude API Calls Failing
- Check `ANTHROPIC_API_KEY` is set in Netlify env
- Check API key has sufficient credits (console.anthropic.com)
- Check browser console for CORS errors

### Icons Not Showing
- Verify `/icons/` folder exists and contains `icon-192.png`, `icon-512.png`
- Check manifest.json paths match actual file locations

---

## 📦 File Size Estimates

| Asset | Size |
|-------|------|
| index.html (with all JSX) | ~180 KB |
| wines-db.json | ~150 KB |
| Service Worker (sw.js) | ~5 KB |
| Icons (all sizes) | ~100 KB |
| Logo | ~20 KB |
| **Total** | **~455 KB** |

(Gzip compression will reduce to ~120 KB)

---

## ✅ Deployment Readiness

**Status:** ✅ READY FOR PRODUCTION

All core features implemented:
- Wine scanning (via Claude Vision API)
- Taste profile tracking (local storage)
- Wine detail screens (Overview, Story, Data tabs)
- Restaurant mode (basic version)
- Learning / Quiz mode
- XP system & progression
- Regional pricing (UK, US, Ontario, Australia)

**Next milestone:** Connect live retailer APIs + user authentication backend.

---

*Vinterest Deployment Package v1.0*  
*Last updated: June 16, 2026*
