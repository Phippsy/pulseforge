# Development Guide

> "Contributing to Pulseforge is like contributing to Dan's bar tab — always welcome, never questioned."

## Prerequisites

- Node.js 18+
- npm 9+
- A modern browser (Chrome/Edge recommended for Web Audio API support)
- A reasonable GPU (integrated is fine, but dedicated = more FPS = more party)

## Getting Started

```bash
# Clone
git clone https://github.com/Phippsy/pulseforge.git
cd pulseforge

# Install
npm install

# Run dev server
npm run dev
```

Open http://localhost:5173 in your browser.

## Tech Stack

| Layer            | Technology    | Version            |
| ---------------- | ------------- | ------------------ |
| UI Framework     | React         | 19.2.6             |
| Language         | TypeScript    | 5.x                |
| Build Tool       | Vite          | 8.x                |
| Styling          | Tailwind CSS  | 4.3.0              |
| 3D Rendering     | Three.js      | 0.184.0            |
| State Management | Zustand       | 5.0.14             |
| Hosting          | Vercel        | —                  |
| Database         | Upstash Redis | via @upstash/redis |
| File Storage     | Vercel Blob   | via @vercel/blob   |

## Project Structure

```
src/
├── App.tsx              # Main component + render loop
├── store.ts             # Global state (Zustand)
├── main.tsx             # Entry point
├── index.css            # Tailwind imports + custom CSS
├── audio/               # Audio capture & analysis
├── visual/              # Three.js engine + effects
├── phases/              # Phase sequencing system
├── hooks/               # Custom React hooks
├── ui/                  # All React UI components
└── types/               # Shared TypeScript types
```

## Key Conventions

### Effects

- One file per effect in `src/visual/effects/`
- Class-based, implementing `VisualEffect` interface
- Must implement `init()`, `update()`, and `dispose()`
- `dispose()` MUST clean up all Three.js resources (geometries, materials, textures)
- Shader effects use `PlaneGeometry(2, 2)` fullscreen quad with orthographic camera

### State

- Single Zustand store, flat structure (no nesting)
- Selectors for performance: `useStore((s) => s.fieldYouNeed)`
- Never subscribe to the whole store
- Actions are defined in the store, not in components

### Styling

- Tailwind CSS 4 utility classes everywhere
- Dark theme (black backgrounds, cyan/purple accents)
- Monospace font (`font-mono`) for the cyberpunk aesthetic
- Responsive: `md:` breakpoint for tablet, base for mobile
- No external UI libraries — everything is hand-crafted

### API Routes

- Vercel serverless functions in `api/`
- TypeScript with `@vercel/node` types
- Redis for persistence (Upstash REST client)
- Local dev uses in-memory mocks in `vite.config.ts`

## Development Workflow

### Adding a New Effect

See [EFFECTS.md](./EFFECTS.md) for the full guide and template.

Quick checklist:

1. Create the effect class
2. Register in `effects/index.ts` (type + registry + export)
3. Add to UI lists (`PhaseList.tsx`, `AdminPage.tsx`, `TopBar.tsx`)
4. Add to `useOrtho` check in `VisualEngine.ts` if it's a shader effect
5. Test with different palettes and audio levels

### Modifying the Store

1. Add the field to the `AppState` interface
2. Add the initial value in the `create()` call
3. Add the action function if needed
4. Use selectors to subscribe in components

### Adding an API Route

1. Create a handler in `api/your-route.ts`
2. Add rewrite rules in `vercel.json` if needed
3. Add a mock handler in the Vite config middleware
4. Test locally with `npm run dev`

## Build & Type Checking

```bash
# Full build (types + bundle)
npm run build

# Type check only (fast)
npx tsc --noEmit

# Lint
npm run lint
```

## Browser Compatibility

Pulseforge requires:

- Web Audio API with `AnalyserNode`
- WebGL 2.0 (for Three.js + GLSL shaders)
- `getDisplayMedia` (for system audio capture)
- ES2020+ features

Tested on:

- Chrome 120+ (primary target)
- Safari 17+ (iOS/macOS — works but no system audio capture)
- Edge 120+
- Firefox 120+ (limited `getDisplayMedia` support)

## Performance Targets

- 60fps minimum on integrated GPU (MacBook Air M1)
- 120fps on dedicated GPU
- < 16ms total frame time (audio analysis + render + post-processing)
- Adaptive quality: pixel ratio scales down if FPS drops

## Debugging

### FPS Counter

Always visible in the top bar. Red = bad (< 30fps), yellow = okay (30-50fps), invisible = good.

### Audio Meters

Toggle with the audio setup panel. Shows real-time band energies.

### Effect Name

Shown in the top bar so you know what's currently running.

### Console

Audio features, onset events, and effect switches are logged at debug level.

## Known Quirks

1. **Safari can't capture system audio** — Only mic input works. Use Chrome for the main display.
2. **HEIC conversion** — iPhone photos are HEIC format. The upload system auto-converts via `heic2any` but it's slow for large images.
3. **First audio frame** — The first frame after starting audio capture may have garbage data. The silence detection handles this gracefully.
4. **Hot reload + hooks** — Adding/removing hooks during HMR causes React hook order errors. Just refresh the page.
5. **Palette overrides are per-device** — They live in localStorage, so your iPad tweaks won't appear on the projector laptop.

---

_Developer's note: If you're reading this and thinking "I could optimise that shader", you're right. But remember: perfect is the enemy of good, and good is the enemy of a legendary party. Ship it._
