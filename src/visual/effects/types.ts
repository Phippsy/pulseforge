import type * as THREE from 'three';
import type { ControlSignals } from '../../store';

export interface EffectParams {
  colors: [string, string, string, string];
  backgroundColor: string;
  intensity: number;
  speed: number;
  complexity: number;
  bassReactivity: number;
  midReactivity: number;
  highReactivity: number;
  onsetReactivity: number;
  effectParams: Record<string, number>;
}

export interface VisualEffect {
  name: string;
  init(scene: THREE.Scene, camera: THREE.Camera): void;
  update(signals: ControlSignals, params: EffectParams, dt: number, time: number): void;
  dispose(): void;
}
