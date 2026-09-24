# Vinterest — Wine Education & Scanning PWA

A single-file React progressive web app for wine lovers. Scan labels, build your taste profile, get personalized recommendations.

## 🚀 Deploy

Cloudflare Pages is the only host. Pushing to GitHub builds it:

- Build command: `npm run build`
- Output directory: `dist`
- Secret: `ANTHROPIC_API_KEY` (Settings → Variables and Secrets). `_worker.js` is the only code that reads it.
- KV binding: `PRICE_CACHE` for shared shop prices (see `docs/price-cache-setup.md`).

## 📱 Features

✅ Scan wine labels with Claude Vision API  
✅ Track taste profile from your scan history  
✅ Personalized "why you'll like this" explanations  
✅ Regional pricing (UK, US, Ontario, Australia)  
✅ Offline support (Service Worker)  
✅ Installable PWA (home screen icon)  
✅ Quiz mode with XP progression  
✅ Restaurant mode for wine list recommendations  

## 📁 Project Structure

See `CLAUDE.md`: `scripts/build.mjs` writes the site to `dist/`, `_worker.js` is the whole backend
(the `/claude` proxy), and `scripts/app-sources.mjs` lists the sources that ship.

## 🛠️ Local Development

```bash
npm install
npm run build   # writes dist/
npm test        # build, then the Playwright tests
```

## 📚 Documentation

- **API_REQUIREMENTS.md** — Backend architecture & API integration guide
- **CLAUDE.md** — Project-specific notes

## 🎯 Architecture

Single-page React app (no build step):
- React 18.3 + React-DOM (via CDN)
- Babel for JSX transpilation (via CDN)
- All components as global functions
- LocalStorage for persistence
- Service Worker for offline + caching

## 🚀 Status

✅ MVP Ready for Production  
- Wine label recognition
- Taste profile tracking
- Wine detail screens
- Quiz engine with XP system
- Regional pricing (Claude-generated)

⏳ Coming Soon
- Live retailer integration (Wine-Searcher API)
- User authentication (Supabase)
- Payment processing (Stripe)
- Social features & sharing

## 📞 Support

See `CLAUDE.md` for how the app is put together.

---

**Vinterest** — Made with 🍷 for wine lovers everywhere.
