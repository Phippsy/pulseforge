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

  isBlackout: boolean;
  isFreeze: boolean;
  intensity: number;

  showUI: boolean;
  fps: number;

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

  setAudioDevice: (id: string) => void;
  startCapture: () => void;
  stopCapture: () => void;
  setGenre: (genre: Genre) => void;
  setPhase: (index: number) => void;
  nextPhase: () => void;
  prevPhase: () => void;
  toggleBlackout: () => void;
  toggleFreeze: () => void;
  toggleAutoProgress: () => void;
  toggleRandomMode: () => void;
  setIntensity: (value: number) => void;
  toggleUI: () => void;
  toggleFullscreen: () => void;
  setPaletteIndex: (index: number) => void;
  nextPalette: () => void;
  togglePaletteCycling: () => void;
  updateControlSignals: (signals: ControlSignals) => void;
  updateFps: (fps: number) => void;
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
  randomMode: false,

  isBlackout: false,
  isFreeze: false,
  intensity: 1.0,

  showUI: true,
  fps: 0,

  userImages: [],
  activeImageIndex: -1,

  chapters: [],
  overlayText: '',
  showText: true,

  fullscreenMode: false,
  paletteIndex: 0,
  paletteCycling: true,

  setAudioDevice: (id) => set({ audioDeviceId: id }),
  startCapture: () => set({ isCapturing: true }),
  stopCapture: () => set({ isCapturing: false }),
  setGenre: (genre) => set({ currentGenre: genre, currentPhaseIndex: 0 }),
  setPhase: (index) => set({ currentPhaseIndex: index }),
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
  toggleUI: () => set((s) => ({ showUI: !s.showUI })),
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
  updateControlSignals: (signals) => set({ controlSignals: signals }),
  updateFps: (fps) => set({ fps }),
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
