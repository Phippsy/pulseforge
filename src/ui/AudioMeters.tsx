import { useStore } from '../store';

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-cyan-500/70 text-[10px] w-8 font-mono tracking-wider">{label}</span>
      <div className="w-24 h-2 bg-white/5 border border-white/10 overflow-hidden">
        <div
          className="h-full transition-all duration-75"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function AudioMeters() {
  const signals = useStore((s) => s.controlSignals);
  const sensitivity = useStore((s) => s.sensitivity);
  const setSensitivity = useStore((s) => s.setSensitivity);

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md p-3 self-start font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <h3 className="text-yellow-400 text-[10px] font-bold uppercase tracking-[0.25em] mb-2 border-b border-cyan-500/20 pb-1">SIGNAL</h3>
      <div className="space-y-1.5">
        <Meter label="Bass" value={signals.bassEnergy} color="#ff4444" />
        <Meter label="Mid" value={signals.midEnergy} color="#44ff44" />
        <Meter label="High" value={signals.highEnergy} color="#4488ff" />
        <Meter label="Pulse" value={signals.transientPulse} color="#ffaa00" />
      </div>
      <div className="mt-3 pt-2 border-t border-cyan-500/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-cyan-500/70 text-[10px] tracking-wider">GAIN</span>
          <span className="text-cyan-300 text-[10px]">{sensitivity.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="5"
          step="0.1"
          value={sensitivity}
          onChange={(e) => setSensitivity(parseFloat(e.target.value))}
          className="w-full h-1.5 appearance-none bg-white/10 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-400 [&::-webkit-slider-thumb]:rounded-full"
        />
      </div>
    </div>
  );
}
