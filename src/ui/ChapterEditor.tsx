import { useState } from 'react';
import { useStore } from '../store';
import type { Chapter } from '../store';

export function ChapterEditor() {
  const chapters = useStore((s) => s.chapters);
  const overlayText = useStore((s) => s.overlayText);
  const showText = useStore((s) => s.showText);
  const addChapter = useStore((s) => s.addChapter);
  const removeChapter = useStore((s) => s.removeChapter);
  const updateChapter = useStore((s) => s.updateChapter);
  const setOverlayText = useStore((s) => s.setOverlayText);
  const toggleShowText = useStore((s) => s.toggleShowText);

  const [newText, setNewText] = useState('');
  const [newPhase, setNewPhase] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const handleAdd = () => {
    if (!newText.trim()) return;
    const chapter: Chapter = {
      id: crypto.randomUUID(),
      text: newText.trim(),
      phaseIndex: newPhase,
    };
    addChapter(chapter);
    setNewText('');
  };

  return (
    <div className="pointer-events-auto bg-black/60 backdrop-blur-sm rounded-lg p-3 text-white text-xs w-64">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="font-medium text-sm hover:text-cyan-300 transition-colors"
        >
          Text & Chapters {expanded ? '▼' : '▶'}
        </button>
        <button
          onClick={toggleShowText}
          className={`px-2 py-0.5 rounded text-xs ${showText ? 'bg-cyan-600' : 'bg-gray-600'}`}
        >
          {showText ? 'ON' : 'OFF'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3">
          {/* Global overlay text */}
          <div>
            <label className="text-gray-400 block mb-1">Default Text</label>
            <input
              type="text"
              value={overlayText}
              onChange={(e) => setOverlayText(e.target.value)}
              placeholder="Text shown during all phases..."
              className="w-full bg-white/10 rounded px-2 py-1 text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          {/* Chapter list */}
          <div>
            <label className="text-gray-400 block mb-1">Chapters (per phase)</label>
            {chapters.map((ch) => (
              <div key={ch.id} className="flex items-center gap-1 mb-1">
                <span className="text-gray-500 w-6">P{ch.phaseIndex + 1}</span>
                <input
                  type="text"
                  value={ch.text}
                  onChange={(e) => updateChapter(ch.id, e.target.value, ch.phaseIndex)}
                  className="flex-1 bg-white/10 rounded px-1 py-0.5 text-white outline-none text-xs"
                />
                <button
                  onClick={() => removeChapter(ch.id)}
                  className="text-red-400 hover:text-red-300 px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add new chapter */}
          <div className="flex gap-1">
            <select
              value={newPhase}
              onChange={(e) => setNewPhase(parseInt(e.target.value))}
              className="bg-white/10 rounded px-1 py-0.5 text-white w-14 outline-none"
            >
              {Array.from({ length: 15 }, (_, i) => (
                <option key={i} value={i}>P{i + 1}</option>
              ))}
            </select>
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Chapter text..."
              className="flex-1 bg-white/10 rounded px-1 py-0.5 text-white placeholder-gray-500 outline-none text-xs"
            />
            <button
              onClick={handleAdd}
              className="bg-cyan-600 hover:bg-cyan-500 rounded px-2 py-0.5 text-xs"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
