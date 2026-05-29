import type { PostProcessParams } from '../visual/PostProcessing';
import type { EffectName } from '../visual/effects/index';

export interface Phase {
  id: string;
  name: string;
  effect: EffectName;
  colors: [string, string, string, string];
  backgroundColor: string;
  bassReactivity: number;
  midReactivity: number;
  highReactivity: number;
  onsetReactivity: number;
  intensity: number;
  speed: number;
  complexity: number;
  postProcess: PostProcessParams;
  effectParams: Record<string, number>;
  transitionDuration: number;
}

export interface Journey {
  id: string;
  name: string;
  genre: 'deep-house' | 'future-disco' | 'peak-techno';
  phases: Phase[];
  autoProgressInterval: number;
}
