# Effects Reference

> "42 effects. One for each year of Dan's life that he actually remembers." — DANFEST Archives

Pulseforge ships with 42 audio-reactive visual effects. Each responds to beat, bass, mids, highs, and transients in its own unique way.

## Effect Categories

### Shader-Based (Fullscreen GLSL)

These render a single fullscreen quad with a fragment shader. They use an orthographic camera and get uniforms for time, audio signals, and palette colours.

| # | ID | Name | Description |
|---|---|---|---|
| 1 | `tunnel` | Tunnel | Infinite tunnel fly-through with pulsing rings |
| 7 | `fractal` | Fractal | Mandelbrot-style fractal zoom, audio-reactive iteration depth |
| 9 | `metaballs` | Metaballs | Organic blobs that merge and split to bass |
| 12 | `plasma` | Plasma | Classic demoscene plasma with warping sine waves |
| 13 | `voronoi` | Voronoi | Crystalline Voronoi cells that shatter on beats |
| 14 | `aurora` | Aurora | Northern lights shimmer with audio-driven curtains |
| 15 | `geoKaleidoscope` | Kaleidoscope | Geometric kaleidoscope that rotates with the beat |
| 16 | `rings` | Rings | Concentric expanding rings, pulse on bass hits |
| 17 | `equaliser` | EQ | Graphic equaliser bars — classic Winamp vibes |
| 18 | `soundwaves` | Sound Waves | Undulating sound wave lines across the screen |
| 22 | `laserShow` | Laser Show | Concert-quality laser beams with atmospheric haze (5 patterns: dual fan sweep, rotating scanners, geometric shapes, Lissajous curves, full chaos) |
| 23 | `fire` | Fire | Procedural fire simulation reacting to bass |
| 24 | `superscope` | Oscilloscope | Retro oscilloscope trace (inspired by Winamp SuperScope) |
| 25 | `milkdrop` | Milkdrop | Warp-mesh distortion in the spirit of Milkdrop |
| 26 | `waterRipple` | Water Ripple | Rippling water surface disturbed by beat transients |
| 28 | `matrixRain` | Matrix | Green character rain — faster on louder audio |
| 29 | `rorschach` | Rorschach | Symmetric ink blot patterns evolving in real-time |
| 30 | `spiralVortex` | Vortex | Spiral vortex that accelerates on bass |
| 31 | `nebula` | Nebula | Deep space nebula clouds with volumetric lighting |
| 32 | `electricArc` | Electric Arc | Lightning arcs between dynamic charge points |
| 33 | `spaceInvaders` | Space Invaders | Retro arcade invaders that march to the beat |
| 34 | `ceefax` | Ceefax | BBC Ceefax/Teletext style pages — peak nostalgia |
| 35 | `fireworks` | Fireworks 50 | Birthday fireworks spelling "50" — for the man himself |
| 36 | `discoBall` | Disco Ball | Rotating mirror ball with light beams |
| 37 | `pacman` | Pac-Man | Pac-Man chasing ghosts through a maze |
| 38 | `lavaLamp` | Lava Lamp | 70s lava lamp with rising/falling blobs |
| 39 | `acidSmiley` | Acid Smiley | Classic rave smiley face, pulsing and morphing |
| 40 | `neonSigns` | Neon Signs | Flickering neon signs (custom messages) |
| 41 | `lightning` | Lightning | Branching lightning bolts triggered by beats |
| 42 | `tetris` | Tetris Effect | Falling Tetris pieces that stack to the rhythm |

### 3D Geometry Effects (Perspective Camera)

These create Three.js meshes/geometries and animate them in 3D space.

| # | ID | Name | Description |
|---|---|---|---|
| 2 | `particles` | Particles | Thousands of particles forming reactive clouds |
| 3 | `grid` | Grid | Wireframe grid landscape that warps with bass |
| 4 | `blob` | Blob | Organic metaball blob with vertex displacement |
| 5 | `flowlines` | Flow Lines | Perlin noise flow field with streaming lines |
| 6 | `waveformRing` | Waveform | Audio waveform displayed as a ring |
| 8 | `imageShatter` | Shatter | User-uploaded image explodes into fragments on beat |
| 10 | `helix` | Helix | DNA-style double helix rotating in 3D |
| 11 | `starfield` | Starfield | Warp-speed starfield (speed = energy level) |
| 19 | `morphPoly` | Morph Poly | Polyhedron morphing between shapes |
| 20 | `warpedTorus` | Warped Torus | Torus with vertex noise warping |
| 21 | `psychedelicEQ` | Psych EQ | 3D frequency bars in psychedelic colours |
| 27 | `terrain` | Terrain | Wireframe terrain flyover (audio-driven height map) |

## Effect Interface

Every effect implements:

```typescript
interface VisualEffect {
  name: string;
  init(scene: THREE.Scene, camera: THREE.Camera): void;
  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void;
  dispose(): void;
}
```

### ControlSignals

```typescript
interface ControlSignals {
  bassPulse: number;     // 0-1, fast attack/decay, punchy
  bassEnergy: number;    // 0-1, smoother bass average
  midEnergy: number;     // 0-1, vocal/instrument range
  highEnergy: number;    // 0-1, hats/cymbals
  overallIntensity: number; // 0-1, total energy
  transientPulse: number;   // 0-1, onset-triggered spike
  beatPhase: number;     // 0-1, position within current beat
  bpm: number;           // estimated BPM
  isSilent: boolean;     // true if no audio for >1 second
}
```

### EffectParams

```typescript
interface EffectParams {
  colors: [string, string, string, string];  // from active palette
  backgroundColor: string;
  intensity: number;        // 0-1
  speed: number;            // multiplier
  complexity: number;       // detail level
  bassReactivity: number;   // how much bass drives the effect
  midReactivity: number;
  highReactivity: number;
  onsetReactivity: number;
  effectParams: Record<string, number>; // effect-specific overrides
}
```

## Writing a New Effect

1. Create `src/visual/effects/YourEffect.ts`
2. Implement the `VisualEffect` interface
3. Register in `src/visual/effects/index.ts`:
   - Add to the `EffectName` type union
   - Add to `effectRegistry`
   - Add to exports
4. Add to `ALL_EFFECTS` in `src/ui/PhaseList.tsx` and `src/ui/AdminPage.tsx`
5. Add to `EFFECT_LABELS` in `src/ui/TopBar.tsx`
6. If it uses orthographic camera, add to the `useOrtho` check in `VisualEngine.ts`

### Shader Effect Template

```typescript
import * as THREE from 'three';
import type { ControlSignals } from '../../store';
import type { VisualEffect, EffectParams } from './types';

export class MyEffect implements VisualEffect {
  name = 'My Effect';
  private mesh!: THREE.Mesh;
  private material!: THREE.ShaderMaterial;

  init(scene: THREE.Scene, _camera: THREE.Camera): void {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uHigh: { value: 0 },
        uColor1: { value: new THREE.Color() },
        uColor2: { value: new THREE.Color() },
        uColor3: { value: new THREE.Color() },
        uColor4: { value: new THREE.Color() },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uHigh;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uColor4;
        uniform vec2 uResolution;
        varying vec2 vUv;
        void main() {
          vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;
          // Your shader magic here
          gl_FragColor = vec4(uColor1, 1.0);
        }
      `,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    scene.add(this.mesh);
  }

  update(signals: ControlSignals, params: EffectParams, _dt: number, time: number): void {
    const u = this.material.uniforms;
    u.uTime.value = time;
    u.uBass.value = signals.bassPulse * params.bassReactivity;
    u.uMid.value = signals.midEnergy * params.midReactivity;
    u.uHigh.value = signals.highEnergy * params.highReactivity;
    u.uColor1.value.set(params.colors[0]);
    u.uColor2.value.set(params.colors[1]);
    u.uColor3.value.set(params.colors[2]);
    u.uColor4.value.set(params.colors[3]);
  }

  dispose(): void {
    this.material.dispose();
    this.mesh.geometry.dispose();
  }
}
```

## Effect Weighting

In random mode, effects are selected based on weights stored in `effectWeights` (persisted to localStorage). Default weight is 1. The Ceefax effect has a default weight of 3 because Dan loves Ceefax and who are we to argue with the birthday boy.

Per-effect display durations can also be configured in `effectDurations`. Default is a random interval of 15-30 seconds.

---

*Fun fact: The number 42 effects is not a coincidence. It's the answer to life, the universe, and everything — which also happens to be Dan's philosophy on beer consumption at his own birthday party.*
