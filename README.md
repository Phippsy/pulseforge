# PULSEFORGE

### Real-time audio-reactive visual synthesiser for DANFEST 50

> Built for Dan's 50th birthday party. Because turning 50 deserves more than a cake and a Spotify playlist.

---

## What Is This?

Pulseforge is a browser-based visual engine that listens to whatever music is playing and generates real-time, GPU-accelerated visuals synchronised to the beat. Think Winamp visualisations, but from 2026 and running at 120fps with concert-quality laser shows, fractal zooms, and procedural fire.

**Live**: https://pulseforge-lyart.vercel.app  
**Admin**: https://pulseforge-lyart.vercel.app/admin  
**Guest Submissions**: https://pulseforge-lyart.vercel.app/submit

## Features

- **42 visual effects** — From psychedelic fractals to retro Ceefax pages, from laser shows to Space Invaders. Each reacts uniquely to bass, mids, highs, and beat transients.
- **60 colour palettes** — Auto-cycling every 30 seconds. Psychedelic, rave, cosmic, retro, and everything between.
- **Real-time audio analysis** — 6-band FFT, onset detection, BPM estimation, all with sub-frame latency.
- **Remote control** — Switch effects and palettes from your phone while visuals run on the big screen.
- **Guest interaction** — Party guests submit messages and photos that appear as floating overlays.
- **Admin panel** — Full control over messages, effects, palettes, and timing from an iPad/phone.
- **Post-processing** — Bloom, chromatic aberration, and vignette for that filmic party quality.
- **120fps performance** — Adaptive quality keeps things buttery smooth even on integrated GPUs.

## Quick Start

```bash
git clone https://github.com/Phippsy/pulseforge.git
cd pulseforge
npm install
npm run dev
```

Open http://localhost:5173, click Start, and share your system audio.

## Tech Stack

|               |                                        |
| ------------- | -------------------------------------- |
| **Frontend**  | React 19 + TypeScript + Tailwind CSS 4 |
| **3D Engine** | Three.js 0.184 + custom GLSL shaders   |
| **State**     | Zustand 5                              |
| **Build**     | Vite 8                                 |
| **Hosting**   | Vercel (auto-deploy from main)         |
| **Database**  | Upstash Redis (Vercel KV)              |
| **Storage**   | Vercel Blob                            |

## Architecture

```
Audio In → FFT Analysis → Control Signals → Visual Effects → Post-Processing → Screen
              ↕                    ↕                ↕
           BPM/Onset          Zustand Store     Remote Control
           Detection          (single truth)    (Redis queue)
```

The render loop runs at display refresh rate via `requestAnimationFrame`, completely independent of React's render cycle. Audio analysis adds < 0.5ms overhead per frame.

## The Effects

42 effects spanning every visual style imaginable:

| Category        | Examples                                                |
| --------------- | ------------------------------------------------------- |
| **Shaders**     | Tunnel, Fractal, Plasma, Metaballs, Voronoi, Laser Show |
| **3D Geometry** | Particles, Blob, Helix, Warped Torus, Terrain           |
| **Retro**       | Matrix Rain, Ceefax, Space Invaders, Pac-Man, Tetris    |
| **Party**       | Disco Ball, Fireworks 50, Laser Show, Neon Signs        |
| **Nature**      | Aurora, Nebula, Lightning, Fire, Water Ripple           |
| **Abstract**    | Rorschach, Kaleidoscope, Lava Lamp, Vortex              |

See [docs/EFFECTS.md](docs/EFFECTS.md) for the complete catalogue.

## Documentation

Comprehensive docs in the `docs/` folder:

| Document                                          | Contents                                        |
| ------------------------------------------------- | ----------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)           | System design, data flow, directory structure   |
| [EFFECTS.md](docs/EFFECTS.md)                     | All 42 effects, how to write new ones           |
| [AUDIO-PIPELINE.md](docs/AUDIO-PIPELINE.md)       | FFT analysis, onset detection, signal smoothing |
| [PALETTES-AND-POST.md](docs/PALETTES-AND-POST.md) | Colour system + post-processing chain           |
| [ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)             | Admin panel, remote control, party DJ guide     |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md)               | Vercel, Redis, Blob, environment setup          |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md)             | Dev setup, conventions, adding features         |
| [PARTY-SETUP.md](docs/PARTY-SETUP.md)             | Night-of setup checklist + troubleshooting      |

## Environment Variables

For production (Vercel):

```
KV_REST_API_URL=        # Upstash Redis
KV_REST_API_TOKEN=      # Upstash Redis
BLOB_READ_WRITE_TOKEN=  # Vercel Blob
```

Local dev needs none — Vite provides in-memory mocks.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # TypeScript check + Vite production build
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

## Deployment

Push to `main`. That's it. Vercel auto-deploys in ~30 seconds.

## Browser Support

- Chrome/Edge 120+ (recommended — full system audio capture)
- Safari 17+ (works, but no system audio — mic only)
- Firefox 120+ (limited getDisplayMedia support)

Requires: WebGL 2.0, Web Audio API, ES2020+

---

## Credits

Built by Donal for DANFEST 50, 2026.

Because every legend deserves a legendary party.

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },

},
])

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
