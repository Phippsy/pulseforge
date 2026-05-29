import { useStore } from '../store';

export function TopBar() {
  const isBlackout = useStore((s) => s.isBlackout);
  const isFreeze = useStore((s) => s.isFreeze);

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md px-5 py-2 flex items-center gap-4 text-white font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <span className="text-cyan-400 text-xs">■</span>
      <span className="text-sm tracking-[0.3em] uppercase text-cyan-100 font-medium">DANFEST</span>
      <span className="text-cyan-400 text-xs">■</span>
      {isBlackout && <span className="ml-auto bg-red-900/80 border border-red-500/50 px-3 py-1 text-[10px] font-bold tracking-widest uppercase animate-pulse text-red-200">BLACKOUT</span>}
      {isFreeze && !isBlackout && <span className="ml-auto bg-blue-900/80 border border-blue-500/50 px-3 py-1 text-[10px] font-bold tracking-widest uppercase text-blue-200">FREEZE</span>}
    </div>
  );
}
