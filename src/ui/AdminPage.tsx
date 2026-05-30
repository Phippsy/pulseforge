import { useState, useEffect } from 'react';
import { TEXT_EFFECTS, DynamicTextDisplay, type TextEffect } from './TextEffects';
import { palettes, type ColorPalette } from '../visual/palettes';
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
  { id: 'spaceInvaders', label: 'Space Invaders' },
  { id: 'ceefax', label: 'Ceefax' },
  { id: 'fireworks', label: 'Fireworks 50' },
  { id: 'discoBall', label: 'Disco Ball' },
  { id: 'pacman', label: 'Pac-Man' },
  { id: 'lavaLamp', label: 'Lava Lamp' },
  { id: 'acidSmiley', label: 'Acid Smiley' },
  { id: 'neonSigns', label: 'Neon Signs' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'tetris', label: 'Tetris Effect' },
];

interface AdminMessage {
  id: string;
  content: string;
  enabled: boolean;
  effect: TextEffect;
  type: 'heavy_rotation' | 'one_off';
  priority: boolean;
  createdAt: number;
}

interface UserSubmission {
  id: string;
  type: string;
  content: string;
  name: string;
  timestamp: number;
  shown: boolean;
  paused: boolean;
}

type AdminTab = 'system' | 'submissions' | 'settings' | 'palettes' | 'remote';

function RemoteControlPanel() {
  const [sending, setSending] = useState<string | null>(null);
  const [lastSent, setLastSent] = useState<{ command: string; time: number } | null>(null);

  const sendCommand = async (command: string, effectId?: string) => {
    setSending(effectId || command);
    try {
      const body: Record<string, string> = { command };
      if (effectId) body.effectId = effectId;
      const res = await fetch('/api/remote-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setLastSent({ command: effectId || command, time: Date.now() });
      }
    } catch {
      // ignore
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      <div className="mb-5">
        <h1 className="text-lg md:text-xl text-cyan-300 tracking-wider mb-1">REMOTE CONTROL</h1>
        <p className="text-white/40 text-xs">Push commands to the live visualiser in real-time</p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
        <button
          onClick={() => sendCommand('next-palette')}
          disabled={sending !== null}
          className="py-3.5 md:py-5 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 border border-purple-400/30 text-white font-bold text-xs md:text-sm tracking-wider transition-all active:scale-95"
        >
          {sending === 'next-palette' ? 'SENDING...' : 'NEXT PALETTE'}
        </button>
        <button
          onClick={() => sendCommand('next-effect')}
          disabled={sending !== null}
          className="py-3.5 md:py-5 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 border border-cyan-400/30 text-white font-bold text-xs md:text-sm tracking-wider transition-all active:scale-95"
        >
          {sending === 'next-effect' ? 'SENDING...' : 'NEXT EFFECT'}
        </button>
      </div>

      {/* Effect selector grid */}
      <div className="mb-5">
        <h2 className="text-sm text-yellow-400/80 tracking-widest mb-3 font-bold">SELECT EFFECT</h2>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-1.5 md:gap-2">
          {ALL_EFFECTS.map(effect => (
            <button
              key={effect.id}
              onClick={() => sendCommand('select-effect', effect.id)}
              disabled={sending !== null}
              className={`px-1.5 py-2.5 md:py-3 text-[10px] md:text-[11px] font-bold tracking-wide border transition-all active:scale-95 disabled:opacity-50 truncate ${
                sending === effect.id
                  ? 'border-green-400 bg-green-900/50 text-green-200'
                  : lastSent?.command === effect.id
                    ? 'border-cyan-400/60 bg-cyan-900/30 text-cyan-200'
                    : 'border-white/10 bg-black/40 text-white/60 hover:border-cyan-400/40 hover:text-white/90 hover:bg-cyan-950/30'
              }`}
              title={effect.label}
            >
              {sending === effect.id ? 'SENT' : effect.label}
            </button>
          ))}
        </div>
      </div>

      {lastSent && (
        <div className="mb-4 text-center text-white/40 text-xs">
          Last: <span className="text-cyan-300">{lastSent.command}</span> at {new Date(lastSent.time).toLocaleTimeString()}
        </div>
      )}
      <div className="border border-cyan-500/20 p-3 md:p-4 bg-black/50 text-white/40 text-xs space-y-1.5">
        <p>Commands are pushed to all running visualiser instances</p>
        <p>The visualiser polls every 2 seconds for new commands</p>
        <p>Works across devices -- control from phone while visuals run on big screen</p>
      </div>
    </>
  );
}

export function AdminPage() {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('system');
  const [newContent, setNewContent] = useState('');
  const [newEffect, setNewEffect] = useState<TextEffect>('impact');
  const [newType, setNewType] = useState<'heavy_rotation' | 'one_off'>('heavy_rotation');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editEffect, setEditEffect] = useState<TextEffect>('impact');
  const [previewEffect, setPreviewEffect] = useState<{ text: string; effect: TextEffect } | null>(null);
  const [displayFrequency, setDisplayFrequency] = useState<number>(8); // seconds between items
  const [paletteOverrides, setPaletteOverrides] = useState<Record<string, Partial<ColorPalette>>>(() => {
    try { return JSON.parse(localStorage.getItem('paletteOverrides') || '{}'); } catch { return {}; }
  });
  const [editingPaletteId, setEditingPaletteId] = useState<string | null>(null);
  const [paletteFilter, setPaletteFilter] = useState('');

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/admin-messages');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* ignore */ }
  };

  const fetchSubmissions = async () => {
    try {
      const res = await fetch('/api/submissions?all=true');
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    fetchMessages();
    fetchSubmissions();
    const interval = setInterval(fetchSubmissions, 10000);
    return () => clearInterval(interval);
  }, []);

  const addMessage = async () => {
    if (!newContent.trim()) return;
    const res = await fetch('/api/admin-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newContent.trim(), effect: newEffect, type: newType }),
    });
    if (res.ok) {
      setNewContent('');
      setNewEffect('impact');
      setNewType('heavy_rotation');
      fetchMessages();
    }
  };

  const toggleEnabled = async (msg: AdminMessage) => {
    await fetch(`/api/admin-messages/${msg.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !msg.enabled }),
    });
    fetchMessages();
  };

  const saveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    await fetch(`/api/admin-messages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: editContent.trim(), effect: editEffect }),
    });
    setEditingId(null);
    setEditContent('');
    fetchMessages();
  };

  const deleteMessage = async (id: string) => {
    await fetch(`/api/admin-messages/${id}`, { method: 'DELETE' });
    fetchMessages();
  };

  const togglePaused = async (sub: UserSubmission) => {
    await fetch(`/api/submissions/${sub.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paused: !sub.paused }),
    });
    fetchSubmissions();
  };

  const deleteSubmission = async (id: string) => {
    await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
    fetchSubmissions();
  };

  return (
    <div className="min-h-screen bg-black font-mono text-white">
      {/* Header */}
      <div className="flex justify-between items-center px-4 md:px-6 py-3 bg-black/80 border-b border-cyan-500/30">
        <span className="text-cyan-400 text-sm md:text-base tracking-wider">ADMIN</span>
        <span className="text-cyan-100 tracking-[0.3em] font-medium text-sm md:text-base">DANFEST CONTROL</span>
        <a href="/" className="text-cyan-400/60 hover:text-cyan-300 text-xs md:text-sm">VISUALS</a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cyan-500/20">
        {(['system', 'submissions', 'palettes', 'settings', 'remote'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-2 py-3 md:py-4 text-[10px] md:text-xs font-bold tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'system' ? 'SYSTEM' : tab === 'submissions' ? 'USER' : tab === 'palettes' ? 'PALETTES' : tab === 'remote' ? 'REMOTE' : 'SETTINGS'}
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 md:px-8 md:py-6">
        {/* SYSTEM MESSAGES TAB */}
        {activeTab === 'system' && (
          <>
            <div className="mb-8">
              <h1 className="text-lg md:text-xl text-cyan-300 tracking-wider mb-1">SYSTEM MESSAGES</h1>
              <p className="text-white/40 text-xs">Manage rotating display messages with cinematic effects</p>
            </div>

            {/* Add new message */}
            <div className="mb-8 border border-cyan-500/20 p-3 sm:p-4 bg-black/50">
              <label className="block text-yellow-400 text-xs mb-2 tracking-widest">NEW MESSAGE:</label>

              {/* Type selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setNewType('heavy_rotation')}
                  className={`flex-1 px-2 py-2.5 text-[10px] font-bold tracking-wider border transition-colors active:scale-95 ${
                    newType === 'heavy_rotation'
                      ? 'border-green-400 bg-green-900/40 text-green-200'
                      : 'border-white/10 text-white/40 hover:border-white/30'
                  }`}
                >
                  ROTATION
                </button>
                <button
                  onClick={() => setNewType('one_off')}
                  className={`flex-1 px-2 py-2.5 text-[10px] font-bold tracking-wider border transition-colors active:scale-95 ${
                    newType === 'one_off'
                      ? 'border-orange-400 bg-orange-900/40 text-orange-200'
                      : 'border-white/10 text-white/40 hover:border-white/30'
                  }`}
                >
                  ONE-OFF
                </button>
              </div>
              <p className="text-white/30 text-[9px] mb-3">
                {newType === 'heavy_rotation'
                  ? 'Always interspersed with user messages in rotation'
                  : 'Shown ASAP as priority — perfect for track-specific shoutouts'}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={newType === 'one_off' ? 'THIS TUNE IS FOR...' : 'WELCOME TO DANFEST...'}
                  className="flex-1 px-3 py-3 bg-black/50 border border-cyan-500/30 text-cyan-100 placeholder-cyan-900 text-base focus:outline-none focus:border-cyan-400 uppercase tracking-wide"
                  maxLength={500}
                  onKeyDown={(e) => e.key === 'Enter' && addMessage()}
                />
                <button
                  onClick={addMessage}
                  disabled={!newContent.trim()}
                  className={`px-4 py-3 border text-xs font-bold tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 ${
                    newType === 'one_off'
                      ? 'bg-orange-900/80 border-orange-500/50 text-orange-200 hover:bg-orange-800'
                      : 'bg-green-900/80 border-green-500/50 text-green-200 hover:bg-green-800'
                  }`}
                >
                  {newType === 'one_off' ? 'SEND' : '+ ADD'}
                </button>
              </div>
              <label className="block text-yellow-400/70 text-[10px] mb-1 tracking-widest">EFFECT:</label>
              <div className="grid grid-cols-4 gap-1">
                {TEXT_EFFECTS.map(eff => (
                  <button
                    key={eff.id}
                    onClick={() => setNewEffect(eff.id)}
                    className={`px-2 py-2 text-[10px] font-bold tracking-wider border transition-colors active:scale-95 ${
                      newEffect === eff.id
                        ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                        : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/60'
                    }`}
                    title={eff.description}
                  >
                    {eff.name}
                  </button>
                ))}
              </div>
              {newContent.trim() && (
                <button
                  onClick={() => setPreviewEffect({ text: newContent.trim(), effect: newEffect })}
                  className="mt-3 px-3 py-1.5 border border-yellow-500/40 text-yellow-400 hover:bg-yellow-900/20 text-[10px] font-bold tracking-wider transition-colors"
                >
                  ▶ PREVIEW
                </button>
              )}
            </div>

            {/* Message list */}
            <div className="space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-cyan-700 py-8 text-sm">NO SYSTEM MESSAGES. ADD ONE ABOVE.</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`border p-3 transition-colors ${
                      msg.enabled
                        ? 'border-cyan-500/30 bg-black/50'
                        : 'border-white/10 bg-black/30 opacity-50'
                    }`}
                  >
                    {editingId === msg.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-3 py-3 bg-black border border-cyan-500/30 text-cyan-100 text-base focus:outline-none focus:border-cyan-400 uppercase tracking-wide"
                          maxLength={500}
                          onKeyDown={(e) => e.key === 'Enter' && saveEdit(msg.id)}
                          autoFocus
                        />
                        <div className="grid grid-cols-4 gap-1">
                          {TEXT_EFFECTS.map(eff => (
                            <button
                              key={eff.id}
                              onClick={() => setEditEffect(eff.id)}
                              className={`px-2 py-2 text-[10px] font-bold tracking-wider border transition-colors active:scale-95 ${
                                editEffect === eff.id
                                  ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                                  : 'border-white/10 text-white/40 hover:border-white/30'
                              }`}
                            >
                              {eff.name}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveEdit(msg.id)}
                            className="flex-1 px-3 py-2.5 bg-green-900/80 border border-green-500/50 text-green-200 text-xs font-bold active:scale-95"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-4 py-2.5 border border-white/20 text-white/60 text-xs active:scale-95"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Top row: toggle, type, content */}
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => toggleEnabled(msg)}
                            className={`w-10 h-6 border flex items-center transition-colors shrink-0 mt-0.5 ${
                              msg.enabled
                                ? 'border-green-500/50 bg-green-900/50 justify-end'
                                : 'border-white/20 bg-black justify-start'
                            }`}
                          >
                            <div className={`w-4 h-4 mx-0.5 ${msg.enabled ? 'bg-green-400' : 'bg-white/30'}`} />
                          </button>
                          <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 border shrink-0 mt-0.5 ${
                            msg.type === 'one_off'
                              ? 'text-orange-400/80 border-orange-500/30'
                              : 'text-green-400/60 border-green-500/20'
                          }`}>
                            {msg.type === 'one_off' ? '1x' : 'ROT'}
                          </span>
                          <span className={`flex-1 text-sm tracking-wide break-words ${msg.enabled ? 'text-cyan-100' : 'text-white/40'}`}>
                            {msg.content}
                          </span>
                        </div>
                        {/* Bottom row: effect badge + actions */}
                        <div className="flex items-center gap-2 pl-12">
                          <span className="text-[9px] text-yellow-500/60 font-bold tracking-wider border border-yellow-500/20 px-1.5 py-0.5">
                            {(msg.effect || 'impact').toUpperCase()}
                          </span>
                          <div className="flex-1" />
                          <button
                            onClick={() => setPreviewEffect({ text: msg.content, effect: msg.effect || 'impact' })}
                            className="px-3 py-1.5 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/30 text-[10px] font-bold tracking-wider active:scale-95"
                          >
                            ▶
                          </button>
                          <button
                            onClick={() => { setEditingId(msg.id); setEditContent(msg.content); setEditEffect(msg.effect || 'impact'); }}
                            className="px-3 py-1.5 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/30 text-[10px] font-bold tracking-wider active:scale-95"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-900/30 text-[10px] font-bold tracking-wider active:scale-95"
                          >
                            DEL
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* USER SUBMISSIONS TAB */}
        {activeTab === 'submissions' && (
          <>
            <div className="mb-6">
              <h1 className="text-lg md:text-xl text-cyan-300 tracking-wider mb-1">USER SUBMISSIONS</h1>
              <p className="text-white/40 text-xs">Moderate user-submitted messages and photos. Pause or delete items.</p>
            </div>

            <div className="mb-4 flex items-center gap-4 border border-cyan-500/20 p-3 bg-black/50">
              <span className="text-yellow-400 text-[10px] tracking-widest">DISPLAY FREQUENCY:</span>
              <input
                type="range"
                min={3}
                max={30}
                value={displayFrequency}
                onChange={(e) => setDisplayFrequency(Number(e.target.value))}
                className="flex-1 accent-cyan-400"
              />
              <span className="text-cyan-300 text-xs font-bold w-14 text-right">{displayFrequency}s</span>
            </div>

            <div className="space-y-2">
              {submissions.length === 0 ? (
                <p className="text-center text-cyan-700 py-8 text-sm">NO USER SUBMISSIONS YET</p>
              ) : (
                submissions.map((sub) => (
                  <div
                    key={sub.id}
                    className={`border p-3 transition-colors ${
                      sub.paused
                        ? 'border-orange-500/30 bg-orange-950/20 opacity-60'
                        : 'border-cyan-500/30 bg-black/50'
                    }`}
                  >
                    <div className="space-y-2">
                      {/* Top row: toggle + meta */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePaused(sub)}
                          className={`w-10 h-6 border flex items-center transition-colors shrink-0 active:scale-95 ${
                            !sub.paused
                              ? 'border-green-500/50 bg-green-900/50 justify-end'
                              : 'border-orange-500/30 bg-black justify-start'
                          }`}
                          title={sub.paused ? 'Unpause' : 'Pause'}
                        >
                          <div className={`w-4 h-4 mx-0.5 ${!sub.paused ? 'bg-green-400' : 'bg-orange-400'}`} />
                        </button>
                        <span className="text-[10px] text-yellow-400/80 font-bold border border-yellow-500/20 px-1.5 py-0.5 uppercase">
                          {sub.type}
                        </span>
                        <span className="text-cyan-400/60 text-xs font-bold truncate">{sub.name}</span>
                        {sub.paused && (
                          <span className="text-[9px] text-orange-400 font-bold tracking-wider ml-auto">PAUSED</span>
                        )}
                      </div>
                      {/* Content + delete */}
                      <div className="flex items-center gap-2 pl-12">
                        <span className={`flex-1 text-sm tracking-wide truncate ${sub.paused ? 'text-white/30' : 'text-cyan-100'}`}>
                          {sub.type === 'photo' ? '[photo]' : sub.content}
                        </span>
                        <button
                          onClick={() => deleteSubmission(sub.id)}
                          className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-900/30 text-[10px] font-bold tracking-wider active:scale-95 shrink-0"
                        >
                          DEL
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 text-white/30 text-xs">
              <p>■ {submissions.filter(s => !s.paused).length} active / {submissions.filter(s => s.paused).length} paused / {submissions.length} total</p>
            </div>
          </>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <>
            <div className="mb-6">
              <h1 className="text-lg md:text-xl text-cyan-300 tracking-wider mb-1">DISPLAY SETTINGS</h1>
              <p className="text-white/40 text-xs">Control timing and frequency of on-screen messages</p>
            </div>
            <div className="space-y-4 border border-cyan-500/20 p-4 bg-black/50">
              <div className="flex items-center justify-between">
                <span className="text-white/60 text-xs tracking-wider">QUEUE INTERVAL (new msgs)</span>
                <span className="text-cyan-300 text-xs font-bold">{displayFrequency}s</span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                value={displayFrequency}
                onChange={(e) => setDisplayFrequency(Number(e.target.value))}
                className="w-full accent-cyan-400"
              />
              <p className="text-white/30 text-[10px]">How quickly new submissions appear. Lower = more frequent.</p>
            </div>
          </>
        )}

        {/* PALETTES TAB */}
        {activeTab === 'palettes' && (
          <>
            <div className="mb-6">
              <h1 className="text-lg md:text-xl text-cyan-300 tracking-wider mb-1">PALETTES</h1>
              <p className="text-white/40 text-xs">{palettes.length} colour palettes — click to edit colours, names and backgrounds</p>
            </div>

            <input
              type="text"
              value={paletteFilter}
              onChange={(e) => setPaletteFilter(e.target.value)}
              placeholder="Filter palettes..."
              className="w-full mb-4 px-3 py-2 bg-black/50 border border-cyan-500/30 text-cyan-100 placeholder-cyan-900 text-xs focus:outline-none focus:border-cyan-400 tracking-wide"
            />

            {Object.keys(paletteOverrides).length > 0 && (
              <button
                onClick={() => { setPaletteOverrides({}); localStorage.removeItem('paletteOverrides'); }}
                className="mb-4 px-3 py-2 border border-orange-500/40 text-orange-400 hover:bg-orange-900/20 text-[10px] font-bold tracking-wider"
              >
                RESET ALL OVERRIDES ({Object.keys(paletteOverrides).length})
              </button>
            )}

            <div className="space-y-2">
              {palettes
                .filter(pal => !paletteFilter || pal.name.toLowerCase().includes(paletteFilter.toLowerCase()) || pal.id.toLowerCase().includes(paletteFilter.toLowerCase()))
                .map((pal, idx) => {
                  const override = paletteOverrides[pal.id] || {};
                  const effectivePal = { ...pal, ...override, colors: override.colors || pal.colors };
                  const isEditing = editingPaletteId === pal.id;
                  const hasOverride = !!paletteOverrides[pal.id];

                  return (
                    <div
                      key={pal.id}
                      className={`border p-3 transition-colors ${
                        isEditing ? 'border-cyan-400/50 bg-cyan-950/20' : hasOverride ? 'border-yellow-500/30 bg-yellow-950/10' : 'border-cyan-500/20 bg-black/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-white/30 text-[10px] w-6 text-right">{idx + 1}</span>
                        {/* Color swatches */}
                        <div className="flex gap-1">
                          {effectivePal.colors.map((c: string, ci: number) => (
                            <div
                              key={ci}
                              className="w-6 h-6 border border-white/20 rounded-sm cursor-pointer hover:scale-110 transition-transform"
                              style={{ backgroundColor: c, boxShadow: `0 0 8px ${c}40` }}
                              title={c}
                            />
                          ))}
                          <div
                            className="w-6 h-6 border border-white/10 rounded-sm"
                            style={{ backgroundColor: effectivePal.backgroundColor }}
                            title={`BG: ${effectivePal.backgroundColor}`}
                          />
                        </div>
                        <span className={`text-xs tracking-wide flex-1 ${hasOverride ? 'text-yellow-300' : 'text-cyan-100'}`}>
                          {effectivePal.name}
                          {hasOverride && <span className="text-yellow-500/60 text-[9px] ml-2">EDITED</span>}
                        </span>
                        <button
                          onClick={() => setEditingPaletteId(isEditing ? null : pal.id)}
                          className={`px-2 py-1 text-[10px] font-bold tracking-wider border transition-colors ${
                            isEditing ? 'border-cyan-400 text-cyan-300' : 'border-white/20 text-white/40 hover:text-white/70'
                          }`}
                        >
                          {isEditing ? 'CLOSE' : 'EDIT'}
                        </button>
                        {hasOverride && (
                          <button
                            onClick={() => {
                              const next = { ...paletteOverrides };
                              delete next[pal.id];
                              setPaletteOverrides(next);
                              localStorage.setItem('paletteOverrides', JSON.stringify(next));
                            }}
                            className="px-2 py-1 text-[10px] font-bold tracking-wider border border-red-500/30 text-red-400 hover:bg-red-900/20"
                          >
                            RESET
                          </button>
                        )}
                      </div>

                      {isEditing && (
                        <div className="mt-3 pt-3 border-t border-cyan-500/10 space-y-3">
                          {/* Name */}
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] tracking-wider w-12">NAME</span>
                            <input
                              type="text"
                              defaultValue={effectivePal.name}
                              onBlur={(e) => {
                                const val = e.target.value.trim();
                                if (val && val !== pal.name) {
                                  const next = { ...paletteOverrides, [pal.id]: { ...override, name: val } };
                                  setPaletteOverrides(next);
                                  localStorage.setItem('paletteOverrides', JSON.stringify(next));
                                }
                              }}
                              className="flex-1 px-2 py-1 bg-black/50 border border-cyan-500/30 text-cyan-100 text-xs focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                          {/* Colors */}
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] tracking-wider w-12">COLS</span>
                            {effectivePal.colors.map((c: string, ci: number) => (
                              <div key={ci} className="flex items-center gap-1">
                                <input
                                  type="color"
                                  value={c}
                                  onChange={(e) => {
                                    const newColors = [...effectivePal.colors] as [string, string, string, string];
                                    newColors[ci] = e.target.value;
                                    const next = { ...paletteOverrides, [pal.id]: { ...override, colors: newColors } };
                                    setPaletteOverrides(next);
                                    localStorage.setItem('paletteOverrides', JSON.stringify(next));
                                  }}
                                  className="w-8 h-8 border-0 cursor-pointer bg-transparent"
                                />
                                <span className="text-white/30 text-[9px] hidden sm:inline">{c}</span>
                              </div>
                            ))}
                          </div>
                          {/* Background */}
                          <div className="flex items-center gap-2">
                            <span className="text-white/40 text-[10px] tracking-wider w-12">BG</span>
                            <input
                              type="color"
                              value={effectivePal.backgroundColor}
                              onChange={(e) => {
                                const next = { ...paletteOverrides, [pal.id]: { ...override, backgroundColor: e.target.value } };
                                setPaletteOverrides(next);
                                localStorage.setItem('paletteOverrides', JSON.stringify(next));
                              }}
                              className="w-8 h-8 border-0 cursor-pointer bg-transparent"
                            />
                            <span className="text-white/30 text-[9px]">{effectivePal.backgroundColor}</span>
                          </div>
                          {/* Preview strip */}
                          <div className="flex h-4 rounded overflow-hidden border border-white/10">
                            {effectivePal.colors.map((c: string, ci: number) => (
                              <div key={ci} className="flex-1" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}

        {/* REMOTE CONTROL TAB */}
        {activeTab === 'remote' && (
          <RemoteControlPanel />
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-cyan-500/20 pt-4 text-white/30 text-xs space-y-1">
          <p>■ User submissions: <a href="/submit" className="text-cyan-500 hover:text-cyan-300">/submit</a></p>
          <p>■ Main display: <a href="/" className="text-cyan-500 hover:text-cyan-300">/</a></p>
        </div>
      </div>

      {/* Preview overlay */}
      {previewEffect && (
        <div className="fixed inset-0 z-50 bg-black" onClick={() => setPreviewEffect(null)}>
          <DynamicTextDisplay text={previewEffect.text} effect={previewEffect.effect} visible={true} />
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[60]">
            <button
              onClick={() => setPreviewEffect(null)}
              className="px-4 py-2 bg-black/80 border border-white/30 text-white/80 text-xs font-mono tracking-wider hover:bg-white/10"
            >
              CLOSE PREVIEW (click anywhere)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
