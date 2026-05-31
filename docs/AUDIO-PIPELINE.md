# Audio Pipeline

> "The audio system listens to music with maximum sensitivity and immediate physical response."

## Overview

Pulseforge captures system audio (or microphone input) and transforms it into a set of smoothed control signals that drive every visual effect. The pipeline is designed for ultra-low latency party visuals — you should see the bass hit the screen within 1-2 frames of hearing it.

## Pipeline Stages

### Stage 1: Audio Capture (`AudioCapture.ts`)

```
getDisplayMedia() or getUserMedia()
    → MediaStreamSource
    → AnalyserNode (fftSize: 2048, smoothing: 0.4)
```

Two capture modes:

- **System audio** (`getDisplayMedia`): Captures whatever is playing on the computer. Ideal for the party setup where music comes from Spotify/etc.
- **Microphone** (`getUserMedia`): Captures from a mic/line-in. Useful for live instrument/vinyl setups.

The `AudioCapture` class handles the Web Audio API setup and provides the raw `AnalyserNode` to the analysis stage.

### Stage 2: Frequency Analysis (`AudioAnalyzer.ts`)

The analyser runs every frame and produces `AudioFeatures`:

```typescript
interface AudioFeatures {
  sub: number; // 20-60 Hz (sub-bass rumble)
  bass: number; // 60-150 Hz (kick drums, bass guitar)
  lowMid: number; // 150-400 Hz (bass instruments upper harmonics)
  mid: number; // 400-2000 Hz (vocals, synths)
  highMid: number; // 2000-6000 Hz (presence, clarity)
  treble: number; // 6000-20000 Hz (cymbals, air)
  energy: number; // overall RMS energy (0-1)
  spectralFlux: number; // frame-to-frame spectral change
  onset: boolean; // true when a transient is detected
  onsetStrength: number; // magnitude of the onset
  bpm: number; // estimated beats per minute
  beatPhase: number; // 0-1 position within current beat
}
```

#### Band Energy Calculation

FFT bins are grouped into 6 frequency bands. Each bin's dB value is converted to linear amplitude, averaged across the band, and normalised against a rolling maximum (adaptive gain).

#### Onset Detection

Uses spectral flux (sum of positive frame-to-frame magnitude changes). When flux exceeds `mean + 1.5 * stddev` of recent history, an onset is triggered. Minimum inter-onset interval prevents double-triggers.

#### BPM Estimation

Maintains a rolling window of onset timestamps. Computes inter-onset intervals, clusters them, and picks the dominant cluster as the BPM. Uses EMA smoothing to prevent jitter.

### Stage 3: Control Signal Processing (`ControlSignals.ts`)

Raw audio features are too noisy for direct visual control. The `ControlSignalProcessor` applies exponential moving average (EMA) smoothing with different time constants per signal:

```
bassPulse:   attack 0.8 (near-instant), decay 0.2 (fast)
bassEnergy:  alpha 0.3 (smooth bass average)
midEnergy:   alpha 0.2 (medium smoothing)
highEnergy:  alpha 0.2
overall:     alpha 0.08 (very smooth, for ambient effects)
transient:   instant on onset, decay 0.18
```

The bass pulse uses asymmetric smoothing — near-instant attack means you see the kick drum the moment it hits, but the fast decay means each hit is distinct rather than smearing together.

#### Silence Detection

If overall energy stays below a noise floor (0.02) for more than 1 second, `isSilent` is set to true. Effects can use this to enter an idle/ambient animation rather than sitting dead still.

### Stage 4: Store Update

Every frame, the processed `ControlSignals` are written to the Zustand store:

```typescript
store.setState({ controlSignals: signals });
```

Effects read these signals in their `update()` method, typically multiplied by per-phase reactivity values (`bassReactivity`, `midReactivity`, etc.) to tune how much each signal influences the visual.

## Sensitivity Control

The user-facing sensitivity slider (1-5x range) is applied as a gain multiplier to the raw audio features before processing. This allows the system to work in both quiet living rooms and thundering nightclub PA systems.

```typescript
// In AudioAnalyzer
const amplified = bandEnergy * this.sensitivity;
```

## FFT Data Pass-through

For effects that want raw frequency data (e.g., the Graphic Equaliser), the full FFT float array is also passed to `VisualEngine.setFFTData()` each frame. Effects can access this for fine-grained frequency visualisation.

## Performance Notes

- The `AnalyserNode` runs on the audio thread (native browser code) — no JavaScript overhead for the FFT itself
- Only the 6-band extraction and onset detection run per frame on the main thread
- Total audio processing overhead: < 0.5ms per frame
- The EMA smoothing is essentially free (6 multiply-adds)

---

_Pro tip: If the visuals aren't reacting enough, turn up the sensitivity slider. If they're reacting too much... turn up the actual music. Problem solved._
