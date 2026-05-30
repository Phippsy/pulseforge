import { useStore } from '../store';

// Map effect IDs to friendly display names
const EFFECT_LABELS: Record<string, string> = {
  tunnel: 'Tunnel', particles: 'Particles', grid: 'Grid', blob: 'Blob',
  flowlines: 'Flow Lines', waveformRing: 'Waveform', fractal: 'Fractal',
  imageShatter: 'Shatter', metaballs: 'Metaballs', helix: 'Helix',
  starfield: 'Starfield', plasma: 'Plasma', voronoi: 'Voronoi',
  aurora: 'Aurora', geoKaleidoscope: 'Kaleidoscope', rings: 'Rings',
  equaliser: 'EQ', soundwaves: 'Sound Waves', morphPoly: 'Morph Poly',
  warpedTorus: 'Warped Torus', psychedelicEQ: 'Psych EQ', laserShow: 'Laser Show',
  fire: 'Fire', superscope: 'Oscilloscope', milkdrop: 'Milkdrop',
  waterRipple: 'Water Ripple', terrain: 'Terrain', matrixRain: 'Matrix',
  rorschach: 'Rorschach', spiralVortex: 'Vortex', nebula: 'Nebula',
  electricArc: 'Electric Arc', spaceInvaders: 'Space Invaders', ceefax: 'Ceefax',
  fireworks: 'Fireworks 50', discoBall: 'Disco Ball', pacman: 'Pac-Man',
  lavaLamp: 'Lava Lamp', vhs: 'VHS', synthwave: 'Synthwave',
  acidSmiley: 'Acid Smiley', neonSigns: 'Neon Signs', lightning: 'Lightning',
  chuckieEgg: 'Chuckie Egg', donkeyKong: 'Donkey Kong', arkanoid: 'Arkanoid',
};

export function TopBar() {
  const fps = useStore((s) => s.fps);
  const activeEffectName = useStore((s) => s.activeEffectName);
  const randomMode = useStore((s) => s.randomMode);

  const effectLabel = activeEffectName ? (EFFECT_LABELS[activeEffectName] || activeEffectName) : '—';

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md px-5 py-2 flex items-center gap-4 text-white font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <span className="text-cyan-400 text-xs">■</span>
      <span className="text-sm tracking-[0.3em] uppercase text-cyan-100 font-medium">DANFEST</span>
      <span className="text-cyan-400 text-xs">■</span>

      {/* Now playing */}
      <div className="ml-4 flex items-center gap-2">
        {randomMode && <span className="text-violet-400/60 text-[10px] tracking-wider">RND</span>}
        <span className="text-white/80 text-xs tracking-wide">{effectLabel}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* FPS */}
      <span className={`text-[10px] tracking-wider ${fps < 30 ? 'text-red-400' : fps < 50 ? 'text-yellow-400/70' : 'text-white/30'}`}>
        {fps}fps
      </span>

      {/* Help hint */}
      <span className="text-white/20 text-[10px]" title="Press ? for keyboard shortcuts">?</span>
    </div>
  );
}
