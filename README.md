# Vinterest — Wine Education & Scanning PWA

A single-file React progressive web app for wine lovers. Scan labels, build your taste profile, get personalized recommendations.

## 🚀 Quick Deploy

### Netlify
```bash
netlify deploy --prod
```

### Cloudflare Pages
1. Push to GitHub
2. Connect repo at dash.cloudflare.com/pages
3. Deploy (no build step needed)

## 🔐 Environment Variables

Set these in your deployment platform:

| Variable | Required | Source |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | console.anthropic.com |
| `WINE_SEARCHER_API_KEY` | Optional | api.wine-searcher.com |

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

```
.
├── index.html              # Main PWA (all React components)
├── manifest.json           # PWA metadata
├── sw.js                   # Service Worker
├── wines-db.json           # Local fallback database
├── netlify.toml            # Deployment config
├── netlify/functions/      # Serverless API routes
│   ├── claude.js           # Label recognition
│   └── lcbo.js             # Ontario pricing
├── icons/                  # PWA icons (maskable)
├── pwa-*.jsx               # Component source files
└── DEPLOYMENT_PACKAGE.md   # Full deployment guide
```

## 🛠️ Local Development

1. Clone this repo
2. Open `index.html` in a browser (uses React from CDN, no build step)
3. Set `ANTHROPIC_API_KEY` in localStorage for label scanning:
   ```javascript
   localStorage.setItem('anthropic_key', 'your-key-here');
   ```

## 📚 Documentation

- **DEPLOYMENT_PACKAGE.md** — Complete deployment instructions
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

See DEPLOYMENT_PACKAGE.md for troubleshooting and next steps.

---

**Vinterest** — Made with 🍷 for wine lovers everywhere.
