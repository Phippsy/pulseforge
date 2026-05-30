import { useStore } from '../store';

const shortcuts = [
  { key: 'H', desc: 'Toggle UI visibility' },
  { key: 'F', desc: 'Fullscreen mode' },
  { key: 'R', desc: 'Toggle random mode' },
  { key: 'A', desc: 'Toggle auto-progress' },
  { key: 'P', desc: 'Next palette' },
  { key: 'C', desc: 'Toggle palette cycling' },
  { key: 'G', desc: 'Cycle genre' },
  { key: '[ / ]', desc: 'Intensity down / up' },
  { key: '← / →', desc: 'Previous / next phase' },
  { key: 'Space', desc: 'Manual beat pulse' },
  { key: '1-9', desc: 'Jump to phase' },
  { key: '?', desc: 'Toggle this help' },
];

export function HelpOverlay() {
  const showHelp = useStore((s) => s.showHelp);
  const toggleHelp = useStore((s) => s.toggleHelp);

  if (!showHelp) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" onClick={toggleHelp}>
      <div className="bg-black/90 border border-cyan-500/30 backdrop-blur-xl p-8 max-w-md w-full mx-4 font-mono shadow-[0_0_40px_rgba(0,200,255,0.1)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-cyan-300 text-sm font-bold tracking-[0.3em] uppercase mb-6 border-b border-cyan-500/20 pb-3">Keyboard Shortcuts</h2>
        <div className="space-y-2">
          {shortcuts.map(({ key, desc }) => (
            <div key={key} className="flex items-center gap-4">
              <kbd className="bg-white/10 border border-white/20 px-2 py-0.5 text-xs text-cyan-200 min-w-[3rem] text-center">{key}</kbd>
              <span className="text-white/70 text-xs">{desc}</span>
            </div>
          ))}
        </div>
        <p className="text-white/30 text-[10px] mt-6 text-center">Press ? or click outside to close</p>
      </div>
    </div>
  );
}
