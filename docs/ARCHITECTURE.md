# Architecture Overview

> "If Dan built the party, Pulseforge built the vibes." — Ancient Proverb, 2026

## High-Level Design

Pulseforge is a real-time audio-reactive visual synthesiser built for Dan's 50th birthday party (DANFEST 50). It captures system audio, analyses it in real-time, and drives a GPU-accelerated visual engine that produces concert-quality visuals synchronised to whatever music is playing.

```
┌─────────────────────────────────────────────────────┐
│                    Browser (Main Display)            │
├─────────┬──────────┬───────────┬───────────────────-┤
│  Audio  │  Control │  Visual   │  UI / Text         │
│ Capture │  Signals │  Engine   │  Overlay           │
│         │          │           │                    │
│ Web     │  FFT →   │  Three.js │  React DOM         │
│ Audio   │  Features│  + GLSL   │  + CSS Animations  │
│ API     │  → EMA   │  + Post   │                    │
│         │          │  Process  │                    │
└─────────┴──────────┴───────────┴────────────────────┘
         │                │                │
         ▼                ▼                ▼
┌─────────────────────────────────────────────────────┐
│              Zustand Global Store                    │
│  (state: signals, palette, effect, mode, etc.)      │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│            Vercel Serverless API                     │
│  /api/remote-control  (Redis-backed command queue)   │
│  /api/admin-messages  (system message CRUD)          │
│  /api/submissions     (user message/photo upload)    │
│  /api/upload          (Vercel Blob image storage)    │
└─────────────────────────────────────────────────────┘
```

## Application Flow

### 1. Audio Pipeline

```
System Audio (via getDisplayMedia/getUserMedia)
    → AnalyserNode (FFT 2048, Blackman window)
    → AudioAnalyzer.analyze()
        → 6-band frequency decomposition (sub/bass/lowMid/mid/highMid/treble)
        → Spectral flux onset detection
        → BPM estimation via inter-onset intervals
    → ControlSignalProcessor.update()
        → Exponential moving average smoothing
        → Bass pulse (fast attack 0.8, fast decay 0.2)
        → Transient pulse (onset-triggered)
        → Silence detection
    → ControlSignals (written to store every frame)
```

### 2. Visual Render Loop (requestAnimationFrame)

```
Every frame (~60-120fps):
    1. Read audio signals from store
    2. PhaseManager interpolates effect params (if transitioning between phases)
    3. Active VisualEffect.update(signals, params, dt, time)
       → GLSL uniforms updated, geometry animated
    4. PostProcessing chain:
       → RenderPass → UnrealBloomPass → ChromaticAberration → Vignette
    5. React UI layer renders on top (text overlays, admin, etc.)
```

### 3. State Management (Zustand)

Single flat store (`src/store.ts`) with:

- Audio state (device, capturing, signals)
- Visual state (genre, phase, effect, palette, mode)
- UI state (help, overlay, freeze, blackout)
- User content (images, chapters, text)
- Remote control (forceNextEffect, forceSpecificEffect)

### 4. Effect System

Each effect implements the `VisualEffect` interface:

```typescript
interface VisualEffect {
  name: string;
  init(scene: THREE.Scene, camera: THREE.Camera): void;
  update(
    signals: ControlSignals,
    params: EffectParams,
    dt: number,
    time: number,
  ): void;
  dispose(): void;
}
```

Effects come in two camera types:

- **Perspective camera**: 3D geometry effects (particles, blob, helix, etc.)
- **Orthographic camera**: Fullscreen GLSL shader effects (tunnel, fractal, laser show, etc.)

The `VisualEngine` auto-detects which camera to use per effect.

### 5. Palette & Phase System

- **60 colour palettes** cycle automatically every 30 seconds
- **3 genre presets** (Deep House, Future Disco, Peak Techno) define phase journeys
- **Random mode** (default): weighted random effect selection every 15-30 seconds
- **Phase mode**: effects progress through a curated sequence per genre

### 6. Remote Control Architecture

```
Admin iPad/Phone                    Big Screen (TV/Projector)
      │                                       │
      │ POST /api/remote-control              │
      │ { command, effectId? }                │
      └──────────────────────┐                │
                             ▼                │
                    ┌─────────────┐           │
                    │ Redis Queue │           │
                    │ (Upstash)   │           │
                    └──────┬──────┘           │
                           │                  │
                           │ GET /api/remote-control
                           │ (polled every 2s)│
                           └──────────────────┘
                                              │
                                              ▼
                                    Store: forceNextEffect++
                                    or forceSpecificEffect = id
                                              │
                                              ▼
                                    Render loop detects change
                                    → immediate effect switch
```

## Directory Structure

```
pulseforge/
├── api/                    # Vercel serverless functions
│   ├── remote-control.ts   # Command queue (Redis)
│   ├── admin-messages.ts   # System message CRUD
│   ├── submissions.ts      # User submissions
│   ├── submissions/[id]/   # Per-submission operations
│   └── upload.ts           # Vercel Blob image upload
├── src/
│   ├── App.tsx             # Main render loop + keyboard shortcuts
│   ├── store.ts            # Zustand global state
│   ├── main.tsx            # React entry point
│   ├── audio/
│   │   ├── AudioAnalyzer.ts    # FFT analysis, onset detection, BPM
│   │   ├── AudioCapture.ts     # Web Audio API setup
│   │   └── ControlSignals.ts   # Signal smoothing processor
│   ├── visual/
│   │   ├── VisualEngine.ts     # Three.js renderer, effect switching
│   │   ├── PostProcessing.ts   # Bloom, chromatic aberration, vignette
│   │   ├── palettes.ts         # 60 colour palettes
│   │   └── effects/            # 42 visual effects (see EFFECTS.md)
│   │       ├── types.ts        # VisualEffect interface
│   │       ├── index.ts        # Effect registry
│   │       └── *.ts            # Individual effect implementations
│   ├── phases/
│   │   ├── PhaseManager.ts     # Phase interpolation & transitions
│   │   ├── types.ts            # Phase/Journey types
│   │   └── presets/            # Genre-specific phase sequences
│   ├── hooks/
│   │   └── useRemoteControl.ts # Polling hook for remote commands
│   ├── ui/
│   │   ├── AdminPage.tsx       # Full admin panel (messages, palettes, remote)
│   │   ├── SubmitPage.tsx      # Public submission form
│   │   ├── SubmissionDisplay.tsx # Floating user messages display
│   │   ├── TextEffects.tsx     # 8 cinematic text display effects
│   │   ├── TextOverlay.tsx     # Auto-cycling DANFEST messages
│   │   ├── TopBar.tsx          # FPS + current effect display
│   │   ├── TransportBar.tsx    # Bottom control bar
│   │   ├── PhaseList.tsx       # Phase/effect selection panel
│   │   ├── HelpOverlay.tsx     # Keyboard shortcuts reference
│   │   ├── AudioSetup.tsx      # Audio source selection
│   │   ├── AudioMeters.tsx     # Real-time frequency meters
│   │   ├── ImageLoader.tsx     # Image upload for Shatter effect
│   │   ├── ChapterEditor.tsx   # Chapter/text management
│   │   └── Overlay.tsx         # HUD composition
│   └── types/
│       └── submission.ts       # Submission type definitions
├── vite.config.ts          # Vite config + dev API mocks
├── vercel.json             # Vercel deployment config
├── package.json
└── tsconfig.*.json
```

## Performance Considerations

- **Adaptive pixel ratio**: Auto-scales down if FPS drops below threshold
- **No antialias on renderer**: Post-processing bloom handles edge smoothing
- **Shader-based effects**: Most effects run entirely on the GPU via fragment shaders
- **requestAnimationFrame loop**: Runs outside React's render cycle
- **Zustand**: Minimal re-renders (selector-based subscriptions)
- **Three.js dispose**: All effects clean up GPU resources on switch

## Key Design Decisions

1. **Fullscreen GLSL for complex effects** — Rather than composing many meshes, mathematically complex visuals (laser show, fractal, metaballs, etc.) use a single fullscreen quad with a fragment shader. This gives pixel-perfect control and better performance.

2. **Random mode as default** — The visualiser was built for a party where nobody will be manually controlling it most of the time. Random mode ensures variety without intervention.

3. **Control signals, not raw FFT** — Effects receive pre-processed, smoothed control signals rather than raw frequency data. This ensures consistent visual behaviour regardless of volume levels.

4. **Everything is a party** — No dark mode, no "professional" UI. The admin panel itself has the DANFEST cyberpunk aesthetic because even setting up the party should feel like a party.

---

_Built with blood, sweat, and questionable Spotify playlists. May the 50th decade be as energetic as a Peak Techno phase at 3am._
