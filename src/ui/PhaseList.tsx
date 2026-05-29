import { useStore } from '../store';
import { PhaseManager } from '../phases/PhaseManager';

const phaseManager = new PhaseManager();

export function PhaseList() {
  const genre = useStore((s) => s.currentGenre);
  const currentIndex = useStore((s) => s.currentPhaseIndex);
  const setPhase = useStore((s) => s.setPhase);

  const journey = phaseManager.getJourney(genre);

  return (
    <div className="pointer-events-auto bg-black/50 border border-cyan-500/20 backdrop-blur-md p-3 self-start font-mono shadow-[0_0_20px_rgba(0,0,0,0.6)]">
      <h3 className="text-yellow-400 text-[10px] font-bold uppercase tracking-[0.25em] mb-2 border-b border-cyan-500/20 pb-1">PHASES</h3>
      <ul className="space-y-0.5">
        {journey.phases.map((phase, i) => (
          <li key={phase.id}>
            <button
              onClick={() => setPhase(i)}
              className={`w-full text-left px-2 py-1 text-xs transition-all duration-200 ${
                i === currentIndex
                  ? 'bg-cyan-900/40 text-cyan-200 border-l-2 border-cyan-400'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04] border-l-2 border-transparent'
              }`}
            >
              <span className="text-[10px] text-yellow-500/60 mr-2">{String(i + 1).padStart(2, '0')}</span>
              <span className="tracking-wide">{phase.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
