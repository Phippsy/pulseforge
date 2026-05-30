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
    <div className="pointer-events-auto bg-black/60 border border-cyan-500/20 backdrop-blur-md px-4 py-2.5 flex items-center gap-3 text-xs font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <button
        onClick={toggleBlackout}
        title="Kill all visuals (B)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          isBlackout ? 'bg-red-900/80 border-red-500/50 text-red-200 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Blackout
      </button>
      <button
        onClick={toggleFreeze}
        title="Freeze current frame (Z)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          isFreeze ? 'bg-blue-900/80 border-blue-500/50 text-blue-200 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Freeze
      </button>
      <button
        onClick={toggleAutoProgress}
        title="Auto-cycle phases (A)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          autoProgress ? 'bg-green-900/80 border-green-500/50 text-green-200 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Auto
      </button>
      <button
        onClick={toggleRandomMode}
        title="Random effect shuffle (R)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          randomMode ? 'bg-violet-900/80 border-violet-500/50 text-violet-200 shadow-[0_0_10px_rgba(139,92,246,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Random
      </button>

      <div className="w-px h-5 bg-cyan-500/20 mx-1" />

      <span className="text-cyan-500/60 text-[11px] tracking-wider">INT</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={intensity}
        onChange={(e) => setIntensity(parseFloat(e.target.value))}
        className="w-24 accent-cyan-400"
        title="Visual intensity ([ / ])"
      />
      <span className="text-cyan-300/70 text-[11px] w-7 text-right">{Math.round(intensity * 100)}</span>

      <div className="w-px h-5 bg-cyan-500/20 mx-1" />

      <button
        onClick={toggleFullscreen}
        title="Fullscreen mode (F)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          fullscreenMode ? 'bg-amber-900/80 border-amber-500/50 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Full
      </button>
      <button
        onClick={togglePaletteCycling}
        title="Toggle palette auto-cycling (C)"
        className={`px-3 py-2 font-bold tracking-wider uppercase text-[11px] transition-all duration-200 border ${
          paletteCycling ? 'bg-pink-900/80 border-pink-500/50 text-pink-200 shadow-[0_0_10px_rgba(236,72,153,0.3)]' : 'border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        Palette
      </button>
      <button
        onClick={nextPalette}
        title="Skip to next palette (P)"
        className="px-3 py-2 border border-white/20 text-white/60 hover:bg-white/10 hover:text-white/90 transition-all text-[11px] tracking-wider"
      >
        {currentPalette.name}
      </button>
      <div className="flex gap-1 ml-1">
        {currentPalette.colors.map((c, i) => (
          <div key={i} className="w-3 h-3 border border-white/20 rounded-sm" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}60` }} />
        ))}
      </div>
    </div>
  );
}
