import type { AudioFeatures } from './AudioAnalyzer';
import type { ControlSignals } from '../store';

export class ControlSignalProcessor {
  private signals: ControlSignals = {
    bassPulse: 0,
    bassEnergy: 0,
    midEnergy: 0,
    highEnergy: 0,
    overallIntensity: 0,
    transientPulse: 0,
    beatPhase: 0,
    bpm: 120,
    isSilent: true,
  };

  private silentSince = 0;
  private noiseFloor = 0.02;

  update(features: AudioFeatures, time: number): ControlSignals {
    // Exponential moving average smoothing
    const ema = (current: number, target: number, alpha: number) =>
      current * (1 - alpha) + target * alpha;

    // Bass pulse: VERY fast attack, fast decay for punchy explosive response
    const bassRaw = Math.min(1.0, ((features.sub + features.bass) / 2) * 1.8); // amplify bass
    if (bassRaw > this.signals.bassPulse) {
      this.signals.bassPulse = ema(this.signals.bassPulse, bassRaw, 0.8); // near-instant attack
    } else {
      this.signals.bassPulse = ema(this.signals.bassPulse, bassRaw, 0.2); // fast decay so each hit pops
    }

    this.signals.bassEnergy = ema(this.signals.bassEnergy, bassRaw, 0.3); // faster tracking
    this.signals.midEnergy = ema(this.signals.midEnergy, features.mid, 0.2);
    this.signals.highEnergy = ema(
      this.signals.highEnergy,
      (features.highMid + features.treble) / 2,
      0.2
    );
    this.signals.overallIntensity = ema(
      this.signals.overallIntensity,
      features.energy,
      0.08
    );

    // Transient pulse: onset-triggered, instant attack, faster decay for snappiness
    if (features.onset) {
      this.signals.transientPulse = Math.min(1, features.onsetStrength * 1.5);
    } else {
      this.signals.transientPulse = ema(this.signals.transientPulse, 0, 0.18);
    }

    this.signals.beatPhase = features.beatPhase;
    this.signals.bpm = ema(this.signals.bpm, features.bpm, 0.05);

    // Silence detection
    if (features.energy < this.noiseFloor) {
      if (this.silentSince === 0) this.silentSince = time;
      this.signals.isSilent = (time - this.silentSince) > 1;
    } else {
      this.silentSince = 0;
      this.signals.isSilent = false;
    }

    return { ...this.signals };
  }
}
