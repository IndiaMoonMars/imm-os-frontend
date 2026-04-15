# IMM-OS Frontend 🛰️

Mission Control Dashboard built with React 18, Vite, and TypeScript.
Displays real-time telemetry from habitat and compute nodes.

## Development

```bash
# 1. Install dependencies
npm install

# 2. Run development server (proxies /api to backend on port 8000)
npm run dev
```

## Production Build

```bash
npm run build
```
Creates a production SPA in the `dist/` directory.

## Architecture

- Theme: Space Dark with Deep Navy & Cyan Palette (custom CSS design system in `index.css`)
- Routing: SPA driven
- API usage: Queries `imm-os-backend` at `/api/telemetry/latest`
