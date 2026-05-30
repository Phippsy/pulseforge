import { useStore } from '../store';
import { type EffectName } from '../visual/effects/index';
import { useState } from 'react';

const ALL_EFFECTS: { id: EffectName; label: string }[] = [
  { id: 'tunnel', label: 'Tunnel' },
  { id: 'particles', label: 'Particles' },
  { id: 'grid', label: 'Grid' },
  { id: 'blob', label: 'Blob' },
  { id: 'flowlines', label: 'Flow Lines' },
  { id: 'waveformRing', label: 'Waveform' },
  { id: 'fractal', label: 'Fractal' },
  { id: 'imageShatter', label: 'Shatter' },
  { id: 'metaballs', label: 'Metaballs' },
  { id: 'helix', label: 'Helix' },
  { id: 'starfield', label: 'Starfield' },
  { id: 'plasma', label: 'Plasma' },
  { id: 'voronoi', label: 'Voronoi' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'geoKaleidoscope', label: 'Kaleidoscope' },
  { id: 'rings', label: 'Rings' },
  { id: 'equaliser', label: 'EQ' },
  { id: 'soundwaves', label: 'Sound Waves' },
  { id: 'morphPoly', label: 'Morph Poly' },
  { id: 'warpedTorus', label: 'Warped Torus' },
  { id: 'psychedelicEQ', label: 'Psych EQ' },
  { id: 'laserShow', label: 'Laser Show' },
  { id: 'fire', label: 'Fire' },
  { id: 'superscope', label: 'Oscilloscope' },
  { id: 'milkdrop', label: 'Milkdrop' },
  { id: 'waterRipple', label: 'Water Ripple' },
  { id: 'terrain', label: 'Terrain' },
  { id: 'matrixRain', label: 'Matrix' },
  { id: 'rorschach', label: 'Rorschach' },
  { id: 'spiralVortex', label: 'Vortex' },
  { id: 'nebula', label: 'Nebula' },
  { id: 'electricArc', label: 'Electric Arc' },
  { id: 'spaceInvaders', label: 'Space Invaders' },
  { id: 'ceefax', label: 'Ceefax' },
  { id: 'fireworks', label: 'Fireworks 50' },
  { id: 'discoBall', label: 'Disco Ball' },
  { id: 'pacman', label: 'Pac-Man' },
  { id: 'lavaLamp', label: 'Lava Lamp' },
  { id: 'acidSmiley', label: 'Acid Smiley' },
  { id: 'neonSigns', label: 'Neon Signs' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'donkeyKong', label: 'Donkey Kong' },
  { id: 'tetris', label: 'Tetris Effect' },
];

export function PhaseList() {
  const directEffect = useStore((s) => s.directEffect);
  const randomMode = useStore((s) => s.randomMode);
  const activeEffectName = useStore((s) => s.activeEffectName);
  const setDirectEffect = useStore((s) => s.setDirectEffect);
  const effectWeights = useStore((s) => s.effectWeights);
  const setEffectWeight = useStore((s) => s.setEffectWeight);
  const effectDurations = useStore((s) => s.effectDurations);
  const setEffectDuration = useStore((s) => s.setEffectDuration);
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md p-3 self-start font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2 border-b border-cyan-500/20 pb-1">
        <h3 className="text-yellow-400 text-[10px] font-bold uppercase tracking-[0.25em]">EFFECTS</h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={`text-[9px] px-1.5 py-0.5 rounded ${showSettings ? 'bg-cyan-700/40 text-cyan-200' : 'text-white/40 hover:text-white/70'}`}
          title="Toggle weight & duration sliders"
        >
          ⚙
        </button>
      </div>
      {showSettings && (
        <div className="flex items-center gap-3 mb-1.5 text-[9px] text-white/40 px-2">
          <span className="flex-1"></span>
          <span className="w-12 text-center text-cyan-400/60">freq</span>
          <span className="w-14 text-center text-yellow-400/60">secs</span>
        </div>
      )}
      <ul className="space-y-0.5">
        {ALL_EFFECTS.map((effect, i) => {
          const weight = effectWeights[effect.id] ?? 1;
          const duration = effectDurations[effect.id];
          const isActive = (directEffect === effect.id && !randomMode) || (randomMode && activeEffectName === effect.id);
          return (
            <li key={effect.id}>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDirectEffect(effect.id)}
                  className={`flex-1 text-left px-2 py-1 text-xs transition-all duration-200 ${
                    isActive
                      ? 'bg-cyan-900/40 text-cyan-200 border-l-2 border-cyan-400'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/[0.06] border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-[10px] text-yellow-500/60 mr-2">{String(i + 1).padStart(2, '0')}</span>
                  <span className="tracking-wide">{effect.label}</span>
                  {weight !== 1 && <span className="ml-1 text-[9px] text-cyan-400/70">×{weight}</span>}
                  {duration && <span className="ml-1 text-[9px] text-yellow-400/70">{duration}s</span>}
                </button>
                {showSettings && (
                  <>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      step="0.5"
                      value={weight}
                      onChange={(e) => setEffectWeight(effect.id, parseFloat(e.target.value))}
                      className="w-12 h-3 accent-cyan-400 cursor-pointer opacity-70 hover:opacity-100"
                      title={`Frequency: ${weight}× (0=never, 5=very frequent)`}
                    />
                    <input
                      type="range"
                      min="5"
                      max="120"
                      step="5"
                      value={duration ?? 22}
                      onChange={(e) => setEffectDuration(effect.id, parseInt(e.target.value))}
                      className="w-14 h-3 accent-yellow-400 cursor-pointer opacity-70 hover:opacity-100"
                      title={`Duration: ${duration ?? 22}s (how long this effect plays)`}
                    />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
