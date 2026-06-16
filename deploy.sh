#!/bin/bash
# Vinterest Deployment Script

echo "Vinterest - Deployment Setup"
echo "=============================="

# Check for required environment variables
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️  ANTHROPIC_API_KEY not set. Label recognition will not work."
  echo "   Get your key from: https://console.anthropic.com"
fi

# For Netlify
if [ -f "netlify.toml" ]; then
  echo "✅ Netlify configuration found"
  echo ""
  echo "To deploy to Netlify:"
  echo "  1. netlify login"
  echo "  2. netlify deploy --prod"
fi

# For Cloudflare Pages
echo ""
echo "To deploy to Cloudflare Pages:"
echo "  1. Push to GitHub"
echo "  2. Go to dash.cloudflare.com/pages"
echo "  3. Connect your repo and deploy"

echo ""
echo "Next steps:"
echo "  - Copy .env.example to .env.local"
echo "  - Set ANTHROPIC_API_KEY in your deployment platform"
echo "  - Run: npm install -g netlify-cli"
echo "  - Or use Cloudflare Pages UI"
