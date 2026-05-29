import { useStore } from '../store';
import { palettes } from '../visual/palettes';

export function TransportBar() {
  const isBlackout = useStore((s) => s.isBlackout);
  const isFreeze = useStore((s) => s.isFreeze);
  const autoProgress = useStore((s) => s.autoProgress);
  const randomMode = useStore((s) => s.randomMode);
  const intensity = useStore((s) => s.intensity);
  const fullscreenMode = useStore((s) => s.fullscreenMode);
  const paletteCycling = useStore((s) => s.paletteCycling);
  const paletteIndex = useStore((s) => s.paletteIndex);
  const toggleBlackout = useStore((s) => s.toggleBlackout);
  const toggleFreeze = useStore((s) => s.toggleFreeze);
  const toggleAutoProgress = useStore((s) => s.toggleAutoProgress);
  const toggleRandomMode = useStore((s) => s.toggleRandomMode);
  const toggleFullscreen = useStore((s) => s.toggleFullscreen);
  const togglePaletteCycling = useStore((s) => s.togglePaletteCycling);
  const nextPalette = useStore((s) => s.nextPalette);
  const setIntensity = useStore((s) => s.setIntensity);

  const currentPalette = palettes[paletteIndex % palettes.length];

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md px-4 py-2 flex items-center gap-2 text-xs font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <button
        onClick={toggleBlackout}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          isBlackout ? 'bg-red-900/80 border-red-500/50 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Blackout
      </button>
      <button
        onClick={toggleFreeze}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          isFreeze ? 'bg-blue-900/80 border-blue-500/50 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Freeze
      </button>
      <button
        onClick={toggleAutoProgress}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          autoProgress ? 'bg-green-900/80 border-green-500/50 text-green-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Auto
      </button>
      <button
        onClick={toggleRandomMode}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          randomMode ? 'bg-violet-900/80 border-violet-500/50 text-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Random
      </button>

      <div className="w-px h-4 bg-cyan-500/20 mx-1" />

      <span className="text-cyan-500/50 text-[10px] tracking-wider">INT</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={intensity}
        onChange={(e) => setIntensity(parseFloat(e.target.value))}
        className="w-20 accent-cyan-400"
      />
      <span className="text-cyan-300/60 text-[10px] w-6">{Math.round(intensity * 100)}</span>

      <div className="w-px h-4 bg-cyan-500/20 mx-1" />

      <button
        onClick={toggleFullscreen}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          fullscreenMode ? 'bg-amber-900/80 border-amber-500/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Full
      </button>
      <button
        onClick={togglePaletteCycling}
        className={`px-3 py-1.5 font-bold tracking-wider uppercase text-[10px] transition-all duration-200 border ${
          paletteCycling ? 'bg-pink-900/80 border-pink-500/50 text-pink-200 shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80'
        }`}
      >
        Palette
      </button>
      <button
        onClick={nextPalette}
        className="px-3 py-1.5 border border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80 transition-all text-[10px] tracking-wider"
      >
        {currentPalette.name}
      </button>
      <div className="flex gap-0.5 ml-1">
        {currentPalette.colors.map((c, i) => (
          <div key={i} className="w-2 h-2 border border-white/20" style={{ backgroundColor: c, boxShadow: `0 0 4px ${c}40` }} />
        ))}
      </div>
    </div>
  );
}
