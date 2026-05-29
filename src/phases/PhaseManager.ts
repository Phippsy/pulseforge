import type { Phase, Journey } from './types';
import type { EffectParams } from '../visual/effects/types';
import type { PostProcessParams } from '../visual/PostProcessing';
import type { Genre } from '../store';
import { deepHouse } from './presets/deepHouse';
import { futureDisco } from './presets/futureDisco';
import { peakTechno } from './presets/peakTechno';

const journeys: Record<Genre, Journey> = {
  'deep-house': deepHouse,
  'future-disco': futureDisco,
  'peak-techno': peakTechno,
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const parseHex = (hex: string) => {
    const c = hex.replace('#', '');
    return [
      parseInt(c.slice(0, 2), 16),
      parseInt(c.slice(2, 4), 16),
      parseInt(c.slice(4, 6), 16),
    ];
  };
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  const r = Math.round(lerpNum(ar, br, t));
  const g = Math.round(lerpNum(ag, bg, t));
  const bv = Math.round(lerpNum(ab, bb, t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bv.toString(16).padStart(2, '0')}`;
}

export class PhaseManager {
  private fromPhase: Phase | null = null;
  private toPhase: Phase | null = null;
  private transitionStart = 0;
  private transitionDuration = 2;
  private isTransitioning = false;

  getJourney(genre: Genre): Journey {
    return journeys[genre];
  }

  getPhase(genre: Genre, index: number): Phase {
    const journey = journeys[genre];
    const clamped = Math.max(0, Math.min(index, journey.phases.length - 1));
    return journey.phases[clamped];
  }

  getPhaseCount(genre: Genre): number {
    return journeys[genre].phases.length;
  }

  startTransition(from: Phase, to: Phase, time: number): void {
    this.fromPhase = from;
    this.toPhase = to;
    this.transitionStart = time;
    this.transitionDuration = to.transitionDuration;
    this.isTransitioning = true;
  }

  getCurrentParams(time: number): { effectParams: EffectParams; postParams: PostProcessParams; phase: Phase; progress: number } {
    if (!this.isTransitioning || !this.fromPhase || !this.toPhase) {
      const phase = this.toPhase || this.fromPhase || journeys['deep-house'].phases[0];
      return {
        effectParams: this.phaseToEffectParams(phase),
        postParams: phase.postProcess,
        phase,
        progress: 1,
      };
    }

    const elapsed = time - this.transitionStart;
    const rawT = Math.min(elapsed / this.transitionDuration, 1);
    const t = easeInOutCubic(rawT);

    if (rawT >= 1) {
      this.isTransitioning = false;
      this.fromPhase = this.toPhase;
    }

    const from = this.fromPhase;
    const to = this.toPhase;

    const effectParams: EffectParams = {
      colors: [
        lerpColor(from.colors[0], to.colors[0], t),
        lerpColor(from.colors[1], to.colors[1], t),
        lerpColor(from.colors[2], to.colors[2], t),
        lerpColor(from.colors[3], to.colors[3], t),
      ],
      backgroundColor: lerpColor(from.backgroundColor, to.backgroundColor, t),
      intensity: lerpNum(from.intensity, to.intensity, t),
      speed: lerpNum(from.speed, to.speed, t),
      complexity: lerpNum(from.complexity, to.complexity, t),
      bassReactivity: lerpNum(from.bassReactivity, to.bassReactivity, t),
      midReactivity: lerpNum(from.midReactivity, to.midReactivity, t),
      highReactivity: lerpNum(from.highReactivity, to.highReactivity, t),
      onsetReactivity: lerpNum(from.onsetReactivity, to.onsetReactivity, t),
      effectParams: this.lerpEffectParams(from.effectParams, to.effectParams, t),
    };

    const postParams: PostProcessParams = {
      bloomStrength: lerpNum(from.postProcess.bloomStrength, to.postProcess.bloomStrength, t),
      bloomThreshold: lerpNum(from.postProcess.bloomThreshold, to.postProcess.bloomThreshold, t),
      bloomRadius: lerpNum(from.postProcess.bloomRadius, to.postProcess.bloomRadius, t),
      chromaticAberration: lerpNum(from.postProcess.chromaticAberration, to.postProcess.chromaticAberration, t),
      kaleidoscopeSegments: lerpNum(from.postProcess.kaleidoscopeSegments, to.postProcess.kaleidoscopeSegments, t),
      feedbackAmount: lerpNum(from.postProcess.feedbackAmount, to.postProcess.feedbackAmount, t),
      vignetteAmount: lerpNum(from.postProcess.vignetteAmount, to.postProcess.vignetteAmount, t),
      warpSpeed: lerpNum(from.postProcess.warpSpeed ?? 1.0, to.postProcess.warpSpeed ?? 1.0, t),
      warpIntensity: lerpNum(from.postProcess.warpIntensity ?? 0.5, to.postProcess.warpIntensity ?? 0.5, t),
    };

    return { effectParams, postParams, phase: t < 0.5 ? from : to, progress: rawT };
  }

  get transitioning(): boolean {
    return this.isTransitioning;
  }

  private phaseToEffectParams(phase: Phase): EffectParams {
    return {
      colors: [...phase.colors],
      backgroundColor: phase.backgroundColor,
      intensity: phase.intensity,
      speed: phase.speed,
      complexity: phase.complexity,
      bassReactivity: phase.bassReactivity,
      midReactivity: phase.midReactivity,
      highReactivity: phase.highReactivity,
      onsetReactivity: phase.onsetReactivity,
      effectParams: { ...phase.effectParams },
    };
  }

  private lerpEffectParams(from: Record<string, number>, to: Record<string, number>, t: number): Record<string, number> {
    const result: Record<string, number> = {};
    const keys = new Set([...Object.keys(from), ...Object.keys(to)]);
    for (const key of keys) {
      const a = from[key] ?? 0;
      const b = to[key] ?? 0;
      result[key] = lerpNum(a, b, t);
    }
    return result;
  }
}
