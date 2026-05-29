import { useStore } from '../store';
import { type EffectName } from '../visual/effects/index';

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
];

export function PhaseList() {
  const directEffect = useStore((s) => s.directEffect);
  const randomMode = useStore((s) => s.randomMode);
  const setDirectEffect = useStore((s) => s.setDirectEffect);

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md p-3 self-start font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)] max-h-[85vh] overflow-y-auto">
      <h3 className="text-yellow-400 text-[10px] font-bold uppercase tracking-[0.25em] mb-2 border-b border-cyan-500/20 pb-1">EFFECTS</h3>
      <ul className="space-y-0.5">
        {ALL_EFFECTS.map((effect, i) => (
          <li key={effect.id}>
            <button
              onClick={() => setDirectEffect(effect.id)}
              className={`w-full text-left px-2 py-1 text-xs transition-all duration-200 ${
                directEffect === effect.id && !randomMode
                  ? 'bg-cyan-900/40 text-cyan-200 border-l-2 border-cyan-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-l-2 border-transparent'
              }`}
            >
              <span className="text-[10px] text-yellow-500/60 mr-2">{String(i + 1).padStart(2, '0')}</span>
              <span className="tracking-wide">{effect.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
