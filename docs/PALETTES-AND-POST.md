# Palettes & Post-Processing

> "60 palettes. Because variety is the spice of a good party."

## Colour Palette System

### Structure

Each palette defines 4 accent colours and a background:

```typescript
interface ColorPalette {
  id: string;
  name: string;
  colors: [string, string, string, string]; // accent colours
  backgroundColor: string; // scene background
}
```

### The 60 Palettes

Organised into thematic groups:

**Originals (20)**: Neon Cyber, Sunset, Deep Ocean, Emerald, Vaporwave, Fire & Ice, Aurora, Molten, Cosmic, Electric, Rose Gold, Arctic, Candy, Matrix, Blood Moon, Tropical, Midnight Jazz, Ultraviolet, Sakura, Thunderstorm

**Psychedelic & Acid (14)**: Acid Trip, DMT Realm, Lysergic, Mushroom Vision, Peyote Sun, Kaleidoscope, Tie Dye, Fractal Deep, Third Eye, Astral Plane, Rainbow Serpent, Ego Death, Synesthesia, and more...

**Rave & Club (13)**: Warehouse Rave, Strobe, Acid House, Gabber, Trance Gate, UV Reactive, Laser Green, Bass Face, Pill Press, Ketamine Sunset, After Hours, Dawn Patrol, Ibiza Sunset

**Nature & Cosmic (8)**: Bioluminescent, Deep Reef, Magma Core, Permafrost, Solar Flare, Event Horizon, Quantum Foam, Dark Matter

**Retro & Pop (5)**: Miami Vice, Outrun, Blade Runner, Akira, Tron

### Palette Cycling

By default, palettes auto-cycle every 30 seconds. The cycling can be:

- Toggled on/off with `togglePaletteCycling()`
- Advanced manually with `nextPalette()` or the remote control
- Set to a specific palette via `setPaletteIndex()`

### How Effects Use Palettes

Every frame, the active palette's colours are passed to effects via `EffectParams.colors`. Shader effects convert these hex strings to `THREE.Color` uniforms. 3D effects use them for material colours, light colours, particle tints, etc.

The background colour sets the Three.js scene clear colour, giving each palette a unique mood even in dark/sparse scenes.

### Admin Overrides

The admin panel allows per-palette colour editing. Overrides are stored in `localStorage` under the key `paletteOverrides`:

```json
{
  "neon-cyber": {
    "colors": ["#FF00FF", "#00FFFF", "#FF0080", "#80FF00"],
    "name": "Custom Name"
  },
  "sunset": { "backgroundColor": "#1A0000" }
}
```

These overrides are device-specific and can be reset individually or all at once.

## Post-Processing Pipeline

After each frame is rendered, it passes through a post-processing chain:

```
Scene Render
    → Bloom (UnrealBloomPass)
    → Chromatic Aberration (custom shader)
    → Vignette (custom shader)
    → Screen Output
```

### Bloom

Uses Three.js `UnrealBloomPass`:

- **Strength**: How bright the glow is (0-3, typically 0.5-1.5)
- **Threshold**: Minimum brightness to bloom (0-1)
- **Radius**: How far bloom spreads (0-2)

Bloom is what makes the visuals feel "alive" — bright elements glow and bleed into surrounding areas, simulating how a projector or TV actually renders bright content.

### Chromatic Aberration

A custom fragment shader that separates RGB channels based on distance from center:

- Red channel shifts outward
- Blue channel shifts inward
- Creates a "lens distortion" effect at the edges
- Amount varies with audio intensity and phase settings
- Includes time-based rotation for psychedelic movement

### Vignette

Darkens the edges of the screen, drawing attention to the centre:

- Amount typically 0.3-0.8
- Creates a natural "spotlight" focus
- Helps mask any edge artifacts from effects

### Phase-Controlled Parameters

Each genre phase can specify its own post-processing settings:

```typescript
postProcess: {
  bloomStrength: 1.2,
  bloomThreshold: 0.3,
  bloomRadius: 0.8,
  chromaticAberration: 0.005,
  kaleidoscopeSegments: 0,
  feedbackAmount: 0,
  vignetteAmount: 0.5,
}
```

In random mode, default post-processing values are used but can be influenced by audio signals — e.g., bloom strength kicks up on bass hits.

### Performance Impact

Post-processing adds ~2-4ms per frame on integrated GPUs. On dedicated GPUs it's < 1ms. The bloom pass is the most expensive as it requires multiple texture samples.

---

_Design philosophy: Every palette should elicit an audible "oooh" at least once during the night. If it doesn't get an "oooh", it gets replaced with one that does._
