import { create } from 'zustand';

export interface ControlSignals {
  bassPulse: number;
  bassEnergy: number;
  midEnergy: number;
  highEnergy: number;
  overallIntensity: number;
  transientPulse: number;
  beatPhase: number;
  bpm: number;
  isSilent: boolean;
}

export type Genre = 'deep-house' | 'future-disco' | 'peak-techno';

export interface Chapter {
  id: string;
  text: string;
  phaseIndex: number; // shows when this phase is active
}

export interface AppState {
  audioDeviceId: string | null;
  isCapturing: boolean;
  controlSignals: ControlSignals;

  currentGenre: Genre;
  currentPhaseIndex: number;
  autoProgress: boolean;
  randomMode: boolean; // random effect cycling mode
  directEffect: string | null; // when set, overrides phase-based effect selection

  isBlackout: boolean;
  isFreeze: boolean;
  intensity: number;
  sensitivity: number; // audio gain multiplier (1 = default, higher = more reactive)

  showUI: boolean;
  showHelp: boolean;
  fps: number;
  activeEffectName: string | null; // currently playing effect for display

  userImages: string[]; // data URLs of loaded images
  activeImageIndex: number;

  // Text/chapter system
  chapters: Chapter[];
  overlayText: string; // free-form text users can set
  showText: boolean;

  // Fullscreen mode (hides all UI except text overlay)
  fullscreenMode: boolean;
  // Palette cycling
  paletteIndex: number;
  paletteCycling: boolean;

  // Effect weights for random selection (1 = normal, higher = more likely)
  effectWeights: Record<string, number>;
  // Per-effect duration in seconds (default ~22s from the 15-30 random range)
  effectDurations: Record<string, number>;
  // Incremented to force an immediate effect change (used by remote control)
  forceNextEffect: number;

  setAudioDevice: (id: string) => void;
  startCapture: () => void;
  stopCapture: () => void;
  setGenre: (genre: Genre) => void;
  setPhase: (index: number) => void;
  setDirectEffect: (effect: string | null) => void;
  nextPhase: () => void;
  prevPhase: () => void;
  toggleBlackout: () => void;
  toggleFreeze: () => void;
  toggleAutoProgress: () => void;
  toggleRandomMode: () => void;
  setIntensity: (value: number) => void;
  setSensitivity: (value: number) => void;
  toggleUI: () => void;
  toggleHelp: () => void;
  toggleFullscreen: () => void;
  setPaletteIndex: (index: number) => void;
  nextPalette: () => void;
  togglePaletteCycling: () => void;
  setEffectWeight: (effectId: string, weight: number) => void;
  setEffectDuration: (effectId: string, duration: number) => void;
  triggerNextEffect: () => void;
  updateControlSignals: (signals: ControlSignals) => void;
  updateFps: (fps: number) => void;
  setActiveEffectName: (name: string | null) => void;
  addImage: (dataUrl: string) => void;
  removeImage: (index: number) => void;
  setActiveImage: (index: number) => void;
  setOverlayText: (text: string) => void;
  addChapter: (chapter: Chapter) => void;
  removeChapter: (id: string) => void;
  updateChapter: (id: string, text: string, phaseIndex: number) => void;
  toggleShowText: () => void;
}

const defaultSignals: ControlSignals = {
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

export const useStore = create<AppState>((set, get) => ({
  audioDeviceId: null,
  isCapturing: false,
  controlSignals: defaultSignals,

  currentGenre: 'deep-house',
  currentPhaseIndex: 0,
  autoProgress: true,
  randomMode: true,
  directEffect: null,

  isBlackout: false,
  isFreeze: false,
  intensity: 1.0,
  sensitivity: 2.0,

  showUI: true,
  showHelp: false,
  fps: 0,
  activeEffectName: null,

  userImages: [],
  activeImageIndex: -1,

  chapters: [],
  overlayText: '',
  showText: true,

  fullscreenMode: false,
  paletteIndex: 0,
  paletteCycling: true,

  effectWeights: JSON.parse(localStorage.getItem('effectWeights') || '{"ceefax":3}'),
  effectDurations: JSON.parse(localStorage.getItem('effectDurations') || '{}'),
  forceNextEffect: 0,

  setAudioDevice: (id) => set({ audioDeviceId: id }),
  startCapture: () => set({ isCapturing: true }),
  stopCapture: () => set({ isCapturing: false }),
  setGenre: (genre) => set({ currentGenre: genre, currentPhaseIndex: 0, directEffect: null }),
  setPhase: (index) => set({ currentPhaseIndex: index, directEffect: null }),
  setDirectEffect: (effect) => set({ directEffect: effect, randomMode: false }),
  nextPhase: () => {
    const { currentPhaseIndex } = get();
    set({ currentPhaseIndex: currentPhaseIndex + 1 });
  },
  prevPhase: () => {
    const { currentPhaseIndex } = get();
    set({ currentPhaseIndex: Math.max(0, currentPhaseIndex - 1) });
  },
  toggleBlackout: () => set((s) => ({ isBlackout: !s.isBlackout })),
  toggleFreeze: () => set((s) => ({ isFreeze: !s.isFreeze })),
  toggleAutoProgress: () => set((s) => ({ autoProgress: !s.autoProgress })),
  toggleRandomMode: () => set((s) => ({ randomMode: !s.randomMode })),
  setIntensity: (value) => set({ intensity: Math.max(0, Math.min(1, value)) }),
  setSensitivity: (value) => set({ sensitivity: Math.max(0.5, Math.min(5, value)) }),
  toggleUI: () => set((s) => ({ showUI: !s.showUI })),
  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
  toggleFullscreen: () => {
    const next = !get().fullscreenMode;
    set({ fullscreenMode: next });
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  },
  setPaletteIndex: (index) => set({ paletteIndex: index }),
  nextPalette: () => set((s) => ({ paletteIndex: s.paletteIndex + 1 })),
  togglePaletteCycling: () => set((s) => ({ paletteCycling: !s.paletteCycling })),
  setEffectWeight: (effectId, weight) => {
    const effectWeights = { ...get().effectWeights, [effectId]: weight };
    localStorage.setItem('effectWeights', JSON.stringify(effectWeights));
    set({ effectWeights });
  },
  setEffectDuration: (effectId, duration) => {
    const effectDurations = { ...get().effectDurations, [effectId]: duration };
    localStorage.setItem('effectDurations', JSON.stringify(effectDurations));
    set({ effectDurations });
  },
  triggerNextEffect: () => set((s) => ({ forceNextEffect: s.forceNextEffect + 1 })),
  updateControlSignals: (signals) => set({ controlSignals: signals }),
  updateFps: (fps) => set({ fps }),
  setActiveEffectName: (name) => set({ activeEffectName: name }),
  addImage: (dataUrl) => set((s) => ({ userImages: [...s.userImages, dataUrl], activeImageIndex: s.userImages.length })),
  removeImage: (index) => set((s) => {
    const images = s.userImages.filter((_, i) => i !== index);
    return { userImages: images, activeImageIndex: Math.min(s.activeImageIndex, images.length - 1) };
  }),
  setActiveImage: (index) => set({ activeImageIndex: index }),
  setOverlayText: (text) => set({ overlayText: text }),
  addChapter: (chapter) => set((s) => ({ chapters: [...s.chapters, chapter] })),
  removeChapter: (id) => set((s) => ({ chapters: s.chapters.filter((c) => c.id !== id) })),
  updateChapter: (id, text, phaseIndex) => set((s) => ({
    chapters: s.chapters.map((c) => c.id === id ? { ...c, text, phaseIndex } : c),
  })),
  toggleShowText: () => set((s) => ({ showText: !s.showText })),
}));
