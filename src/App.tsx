import { useEffect, useRef, useCallback, useState } from 'react';
import { useStore } from './store';
import type { ControlSignals } from './store';
import { AudioCapture } from './audio/AudioCapture';
import { AudioAnalyzer } from './audio/AudioAnalyzer';
import { ControlSignalProcessor } from './audio/ControlSignals';
import { VisualEngine } from './visual/VisualEngine';
import { PhaseManager } from './phases/PhaseManager';
import { effectRegistry } from './visual/effects/index';
import type { EffectName } from './visual/effects/index';
import { getPalette, lerpColors } from './visual/palettes';
import { Overlay } from './ui/Overlay';
import { SubmissionDisplay } from './ui/SubmissionDisplay';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VisualEngine | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const analyzerRef = useRef<AudioAnalyzer | null>(null);
  const signalProcessorRef = useRef(new ControlSignalProcessor());
  const phaseManagerRef = useRef(new PhaseManager());
  const prevPhaseIndexRef = useRef(-1);
  const prevGenreRef = useRef('');
  const prevDirectEffectRef = useRef<string | null>(null);
  const autoProgressTimerRef = useRef(0);
  const randomTimerRef = useRef(0);
  const randomIntervalRef = useRef(0);
  const randomEffectRef = useRef<EffectName | null>(null);
  const frameCountRef = useRef(0);
  const fpsTimeRef = useRef(0);
  const paletteCycleTimerRef = useRef(0);
  const paletteTransitionRef = useRef(0);
  const shuffledPhasesRef = useRef<number[]>([]);
  const shufflePositionRef = useRef(0);

  const isCapturing = useStore((s) => s.isCapturing);
  const audioDeviceId = useStore((s) => s.audioDeviceId);

  const startAudio = useCallback(async () => {
    const capture = new AudioCapture();
    await capture.start({
      deviceId: audioDeviceId || undefined,
      fftSize: 2048,
      smoothingTimeConstant: 0.8,
    });
    captureRef.current = capture;
    if (capture.analyser && capture.context) {
      analyzerRef.current = new AudioAnalyzer(capture.analyser, capture.context.sampleRate);
    }
  }, [audioDeviceId]);

  useEffect(() => {
    if (!isCapturing) return;
    startAudio();
    return () => {
      captureRef.current?.stop();
    };
  }, [isCapturing, startAudio]);

  useEffect(() => {
    if (!isCapturing || !canvasRef.current) return;

    const engine = new VisualEngine(canvasRef.current);
    engineRef.current = engine;

    let lastTime = performance.now() / 1000;
    let animId: number;
    let lowFpsStart = 0;
    let reducedQuality = false;

    const loop = () => {
      animId = requestAnimationFrame(loop);

      const now = performance.now() / 1000;
      const dt = Math.min(now - lastTime, 0.1);
      lastTime = now;

      // FPS counter
      frameCountRef.current++;
      if (now - fpsTimeRef.current >= 1) {
        const currentFps = frameCountRef.current;
        useStore.getState().updateFps(currentFps);
        frameCountRef.current = 0;
        fpsTimeRef.current = now;

        // Adaptive quality
        if (currentFps < 45) {
          if (lowFpsStart === 0) lowFpsStart = now;
          else if (now - lowFpsStart > 2 && !reducedQuality) {
            engine.getRenderer().setPixelRatio(1);
            reducedQuality = true;
          }
        } else {
          lowFpsStart = 0;
        }
      }

      const state = useStore.getState();

      // Blackout: skip rendering
      if (state.isBlackout) {
        const ctx = canvasRef.current?.getContext('webgl2') || canvasRef.current?.getContext('webgl');
        if (ctx) {
          ctx.clearColor(0, 0, 0, 1);
          ctx.clear(ctx.COLOR_BUFFER_BIT);
        }
        return;
      }

      // Audio analysis
      let signals: ControlSignals = state.controlSignals;
      if (analyzerRef.current && !state.isFreeze) {
        analyzerRef.current.sensitivity = state.sensitivity;
        const features = analyzerRef.current.analyze(now);
        signals = signalProcessorRef.current.update(features, now);
        useStore.getState().updateControlSignals(signals);
      }

      // Ensure signals always have minimum values so effects are always visible
      // Even with real audio, if it's quiet, we still want to see SOMETHING
      if (!signals.isSilent) {
        signals = {
          ...signals,
          bassPulse: Math.max(0.15, signals.bassPulse),
          bassEnergy: Math.max(0.12, signals.bassEnergy),
          midEnergy: Math.max(0.1, signals.midEnergy),
          highEnergy: Math.max(0.08, signals.highEnergy),
          overallIntensity: Math.max(0.2, signals.overallIntensity),
        };
      }

      // Ambient mode: inject strong time-based signals when silent
      // These need to be HIGH enough to make effects clearly visible
      if (signals.isSilent) {
        signals = {
          ...signals,
          bassPulse: Math.sin(now * 0.8) * 0.3 + 0.4,
          bassEnergy: Math.sin(now * 0.6) * 0.2 + 0.35,
          midEnergy: Math.sin(now * 1.2 + 1.0) * 0.2 + 0.3,
          highEnergy: Math.sin(now * 1.5 + 2.0) * 0.15 + 0.25,
          overallIntensity: 0.5 + Math.sin(now * 0.4) * 0.15,
          transientPulse: Math.max(0, Math.sin(now * 0.3) * Math.sin(now * 2.5)) * 0.4,
          beatPhase: (now * 1.0) % 1,
        };
      }

      // Phase management
      const pm = phaseManagerRef.current;
      const genre = state.currentGenre;
      let phaseIndex = state.currentPhaseIndex;

      // Clamp phase index
      const phaseCount = pm.getPhaseCount(genre);
      if (phaseIndex >= phaseCount) {
        phaseIndex = 0;
        useStore.getState().setPhase(0);
      }

      // Detect phase/genre change OR direct effect override
      const directEffect = state.directEffect;
      if (directEffect && directEffect !== prevDirectEffectRef.current) {
        engine.setEffect(directEffect as EffectName);
        prevDirectEffectRef.current = directEffect;
        autoProgressTimerRef.current = now;
      } else if (!directEffect && (genre !== prevGenreRef.current || phaseIndex !== prevPhaseIndexRef.current)) {
        const fromPhase = prevGenreRef.current
          ? pm.getPhase(prevGenreRef.current as any, prevPhaseIndexRef.current)
          : pm.getPhase(genre, phaseIndex);
        const toPhase = pm.getPhase(genre, phaseIndex);

        if (prevGenreRef.current) {
          pm.startTransition(fromPhase, toPhase, now);
        } else {
          // First frame - initialize PhaseManager state
          pm.startTransition(toPhase, toPhase, now);
        }

        // Switch effect
        engine.setEffect(toPhase.effect as EffectName);

        prevGenreRef.current = genre;
        prevPhaseIndexRef.current = phaseIndex;
        prevDirectEffectRef.current = null;
        autoProgressTimerRef.current = now;
      }

      // Auto-progress with shuffle - every 90 seconds, pick next from shuffled order
      if (state.autoProgress && !state.randomMode && !pm.transitioning) {
        const phaseInterval = 90; // Fixed 90 seconds between phase changes
        if (now - autoProgressTimerRef.current > phaseInterval) {
          // Initialize or reshuffle if needed
          if (shuffledPhasesRef.current.length !== phaseCount) {
            const indices = Array.from({ length: phaseCount }, (_, i) => i);
            // Fisher-Yates shuffle
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            shuffledPhasesRef.current = indices;
            shufflePositionRef.current = 0;
          }
          
          // Get next phase from shuffled order
          shufflePositionRef.current = (shufflePositionRef.current + 1) % phaseCount;
          // If we've gone through all phases, reshuffle
          if (shufflePositionRef.current === 0) {
            const indices = Array.from({ length: phaseCount }, (_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            shuffledPhasesRef.current = indices;
          }
          
          const nextIndex = shuffledPhasesRef.current[shufflePositionRef.current];
          useStore.getState().setPhase(nextIndex);
          autoProgressTimerRef.current = now;
        }
      }

      // Random mode - pick a random effect every 15-30 seconds
      if (state.randomMode && !pm.transitioning) {
        if (now - randomTimerRef.current > randomIntervalRef.current || randomTimerRef.current === 0) {
          const allEffects = Object.keys(effectRegistry) as EffectName[];
          let next: EffectName;
          do {
            next = allEffects[Math.floor(Math.random() * allEffects.length)];
          } while (next === randomEffectRef.current && allEffects.length > 1);
          randomEffectRef.current = next;
          engine.setEffect(next);
          randomTimerRef.current = now;
          randomIntervalRef.current = 15 + Math.random() * 15;
        }
      }

      // Get interpolated params
      if (!state.isFreeze) {
        const { effectParams, postParams } = pm.getCurrentParams(now);

        // Apply intensity multiplier - with a HIGH brightness floor
        effectParams.intensity *= state.intensity;
        effectParams.intensity = Math.max(0.85, effectParams.intensity); // always clearly visible
        // Bass reactivity is BOOSTED so movement is explosive and obvious
        effectParams.bassReactivity *= state.intensity * 2.0;
        effectParams.midReactivity *= state.intensity * 1.3;
        effectParams.highReactivity *= state.intensity;
        effectParams.onsetReactivity *= state.intensity * 1.5;

        // PROCEDURAL PARAMETER DRIFT - makes every moment feel unique
        // Parameters slowly evolve within their phase using multi-frequency noise
        const drift = (freq: number, offset: number) => 
          Math.sin(now * freq + offset) * Math.cos(now * freq * 0.7 + offset * 2.3) * 0.5 + 0.5;
        
        // Speed varies ±30%
        effectParams.speed *= 0.85 + drift(0.07, 0) * 0.3;
        // Complexity varies ±20%
        effectParams.complexity *= 0.9 + drift(0.05, 1.7) * 0.2;
        // Reactivity varies ±15% (keeps things feeling different each beat)
        effectParams.bassReactivity *= 0.92 + drift(0.09, 3.1) * 0.16;
        effectParams.midReactivity *= 0.92 + drift(0.11, 5.3) * 0.16;
        effectParams.highReactivity *= 0.92 + drift(0.08, 7.7) * 0.16;
        
        // Post-processing drifts more dramatically
        postParams.feedbackAmount = Math.min(0.92, postParams.feedbackAmount * (0.9 + drift(0.06, 2.0) * 0.2));
        postParams.chromaticAberration *= 0.7 + drift(0.13, 4.5) * 0.6;
        postParams.bloomStrength *= 0.85 + drift(0.04, 6.2) * 0.3;
        // Boost bloom to keep things bright
        postParams.bloomStrength = Math.max(1.0, postParams.bloomStrength);
        // Warp intensity drifts for constantly evolving motion feel - MORE aggressive
        postParams.warpSpeed = Math.max(1.0, (postParams.warpSpeed ?? 1.0) * (0.8 + drift(0.03, 8.1) * 0.8));
        postParams.warpIntensity = Math.max(0.4, (postParams.warpIntensity ?? 0.5) * (0.7 + drift(0.05, 9.3) * 0.9));

        // Pass FFT data for waveform ring
        if (analyzerRef.current) {
          engine.setFFTData(analyzerRef.current.getFrequencyData());
        }

        // Palette cycling: ALWAYS override colors with active palette
        // Colors constantly shift even within a palette using time-based hue rotation
        const cycleInterval = 25; // seconds per palette (offset from 90s phase changes)
        const transitionDuration = 3; // smooth blend between palettes
        const elapsed = now - paletteCycleTimerRef.current;
        
        if (state.paletteCycling && (elapsed > cycleInterval || paletteCycleTimerRef.current === 0)) {
          paletteCycleTimerRef.current = now;
          paletteTransitionRef.current = now;
          useStore.getState().nextPalette();
        }
        
        const currentPalette = getPalette(state.paletteIndex);
        const prevPalette = getPalette(state.paletteIndex - 1);
        const transElapsed = now - paletteTransitionRef.current;
        const t = Math.min(1, transElapsed / transitionDuration);
        
        const baseColors = t < 1
          ? lerpColors(prevPalette.colors, currentPalette.colors, t)
          : currentPalette.colors;
        
        // Always apply palette colors - they ARE the effect colors
        effectParams.colors = baseColors;
        
        // Additionally: boost brightness of all colors to avoid dark visualizations
        // Apply a brightness floor - never let colors be too dim
        effectParams.colors = effectParams.colors.map(c => {
          const r = parseInt(c.slice(1, 3), 16);
          const g = parseInt(c.slice(3, 5), 16);
          const b = parseInt(c.slice(5, 7), 16);
          // Boost: ensure at least one channel is bright
          const maxC = Math.max(r, g, b);
          const boost = maxC < 128 ? 1.5 : 1.0;
          const br = Math.min(255, Math.round(r * boost));
          const bg = Math.min(255, Math.round(g * boost));
          const bb = Math.min(255, Math.round(b * boost));
          return `#${br.toString(16).padStart(2, '0')}${bg.toString(16).padStart(2, '0')}${bb.toString(16).padStart(2, '0')}`;
        }) as [string, string, string, string];

        engine.update(signals, effectParams, postParams, dt, now);
      }
    };

    // Init with first phase
    const genre = useStore.getState().currentGenre;
    const phaseIndex = useStore.getState().currentPhaseIndex;
    const phase = phaseManagerRef.current.getPhase(genre, phaseIndex);
    engine.setEffect(phase.effect as EffectName);
    prevGenreRef.current = genre;
    prevPhaseIndexRef.current = phaseIndex;
    autoProgressTimerRef.current = performance.now() / 1000;

    // Subscribe to image changes
    let lastImageUrl = '';
    const unsubImage = useStore.subscribe((s) => {
      const img = s.userImages[s.activeImageIndex];
      if (img && img !== lastImageUrl && engineRef.current) {
        lastImageUrl = img;
        engineRef.current.setImageTexture(img);
      }
    });

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      unsubImage();
      engine.dispose();
      engineRef.current = null;
    };
  }, [isCapturing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const state = useStore.getState();
      const pm = phaseManagerRef.current;

      switch (e.key.toLowerCase()) {
        case 'h':
          state.toggleUI();
          break;
        case 'b':
          state.toggleBlackout();
          break;
        case 'f':
          if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            if (document.fullscreenElement) {
              document.exitFullscreen();
            } else {
              document.documentElement.requestFullscreen?.();
            }
          } else {
            state.toggleFullscreen();
          }
          break;
        case 'z':
          state.toggleFreeze();
          break;
        case 'p':
          state.nextPalette();
          break;
        case 'c':
          state.togglePaletteCycling();
          break;
        case 'a':
          state.toggleAutoProgress();
          break;
        case 'g': {
          const genres = ['deep-house', 'future-disco', 'peak-techno'] as const;
          const idx = genres.indexOf(state.currentGenre);
          state.setGenre(genres[(idx + 1) % 3]);
          break;
        }
        case 'arrowright':
          state.nextPhase();
          break;
        case 'arrowleft':
          state.prevPhase();
          break;
        case '[':
          state.setIntensity(state.intensity - 0.1);
          break;
        case ']':
          state.setIntensity(state.intensity + 0.1);
          break;
        case ' ':
          e.preventDefault();
          // Manual onset pulse
          state.updateControlSignals({ ...state.controlSignals, transientPulse: 1 });
          break;
        case 'f11':
          document.documentElement.requestFullscreen?.();
          break;
        default:
          // Number keys 1-9
          if (e.key >= '1' && e.key <= '9') {
            const idx = parseInt(e.key) - 1;
            const count = pm.getPhaseCount(state.currentGenre);
            if (idx < count) state.setPhase(idx);
          }
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Canvas opacity cycling - reveals submissions beneath
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const canvasOpacityRef = useRef(1);

  useEffect(() => {
    // Slowly pulse the canvas opacity to reveal submissions underneath
    let opacityTime = 0;
    const opacityInterval = setInterval(() => {
      opacityTime += 0.05;
      // Mostly fully opaque, only very slight dips
      const base = 0.95;
      const wave = Math.sin(opacityTime * 0.15) * 0.05;
      const opacity = Math.max(0.8, Math.min(1, base + wave));
      canvasOpacityRef.current = opacity;
      setCanvasOpacity(opacity);
    }, 50);
    return () => clearInterval(opacityInterval);
  }, []);

  return (
    <>
      {/* Submission layer - sits BEHIND the visualization */}
      <SubmissionDisplay />
      {/* Visualization canvas - variable opacity reveals submissions */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-screen h-screen z-[1]"
        style={{ opacity: canvasOpacity }}
      />
      <Overlay />
    </>
  );
}
