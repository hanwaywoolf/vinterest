# Vinterest Project Instructions

## Deployment packaging
When generating a deployment package (user asks for "package", "download", "deploy", etc.):
- Auto-increment the `?v=N` version parameter on ALL script tags in `index.html` before presenting the download
- Read the current version number from `index.html` first, then bump it by 1
- Apply this every time without being asked
