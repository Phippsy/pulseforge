import { useState, useEffect } from 'react';
import { TEXT_EFFECTS, DynamicTextDisplay, type TextEffect } from './TextEffects';

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

type AdminTab = 'system' | 'submissions' | 'settings';

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
      <div className="flex justify-between items-center px-4 py-2 bg-black/80 border-b border-cyan-500/30">
        <span className="text-cyan-400">■ ADMIN</span>
        <span className="text-cyan-100 tracking-[0.3em] font-medium">DANFEST CONTROL</span>
        <a href="/" className="text-cyan-400/60 hover:text-cyan-300 text-xs">← VISUALS</a>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-cyan-500/20 px-4">
        {(['system', 'submissions', 'settings'] as AdminTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-xs font-bold tracking-wider border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'system' ? '▶ SYSTEM MSGS' : tab === 'submissions' ? '▶ USER MSGS' : '▶ SETTINGS'}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-6">
        {/* SYSTEM MESSAGES TAB */}
        {activeTab === 'system' && (
          <>
            <div className="mb-8">
              <h1 className="text-xl text-cyan-300 tracking-wider mb-1">▶ SYSTEM MESSAGES</h1>
              <p className="text-white/40 text-xs">Manage rotating display messages with cinematic effects</p>
            </div>

            {/* Add new message */}
            <div className="mb-8 border border-cyan-500/20 p-4 bg-black/50">
              <label className="block text-yellow-400 text-xs mb-2 tracking-widest">NEW MESSAGE:</label>

              {/* Type selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setNewType('heavy_rotation')}
                  className={`flex-1 px-3 py-2 text-[10px] font-bold tracking-wider border transition-colors ${
                    newType === 'heavy_rotation'
                      ? 'border-green-400 bg-green-900/40 text-green-200'
                      : 'border-white/10 text-white/40 hover:border-white/30'
                  }`}
                >
                  🔁 HEAVY ROTATION
                </button>
                <button
                  onClick={() => setNewType('one_off')}
                  className={`flex-1 px-3 py-2 text-[10px] font-bold tracking-wider border transition-colors ${
                    newType === 'one_off'
                      ? 'border-orange-400 bg-orange-900/40 text-orange-200'
                      : 'border-white/10 text-white/40 hover:border-white/30'
                  }`}
                >
                  ⚡ ONE-OFF (PRIORITY)
                </button>
              </div>
              <p className="text-white/30 text-[9px] mb-3">
                {newType === 'heavy_rotation'
                  ? 'Always interspersed with user messages in rotation'
                  : 'Shown ASAP as priority — perfect for track-specific shoutouts'}
              </p>

              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={newType === 'one_off' ? 'THIS TUNE IS FOR...' : 'WELCOME TO DANFEST...'}
                  className="flex-1 px-3 py-2 bg-black/50 border border-cyan-500/30 text-cyan-100 placeholder-cyan-900 text-sm focus:outline-none focus:border-cyan-400 uppercase tracking-wide"
                  maxLength={500}
                  onKeyDown={(e) => e.key === 'Enter' && addMessage()}
                />
                <button
                  onClick={addMessage}
                  disabled={!newContent.trim()}
                  className={`px-4 py-2 border text-xs font-bold tracking-wider transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    newType === 'one_off'
                      ? 'bg-orange-900/80 border-orange-500/50 text-orange-200 hover:bg-orange-800'
                      : 'bg-green-900/80 border-green-500/50 text-green-200 hover:bg-green-800'
                  }`}
                >
                  {newType === 'one_off' ? '⚡ SEND NOW' : '+ ADD'}
                </button>
              </div>
              <label className="block text-yellow-400/70 text-[10px] mb-1 tracking-widest">EFFECT:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                {TEXT_EFFECTS.map(eff => (
                  <button
                    key={eff.id}
                    onClick={() => setNewEffect(eff.id)}
                    className={`px-2 py-1.5 text-[10px] font-bold tracking-wider border transition-colors ${
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
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="flex-1 px-3 py-2 bg-black border border-cyan-500/30 text-cyan-100 text-sm focus:outline-none focus:border-cyan-400 uppercase tracking-wide"
                            maxLength={500}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(msg.id)}
                            autoFocus
                          />
                          <button
                            onClick={() => saveEdit(msg.id)}
                            className="px-3 py-2 bg-green-900/80 border border-green-500/50 text-green-200 text-xs font-bold"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 border border-white/20 text-white/60 text-xs"
                          >
                            ESC
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {TEXT_EFFECTS.map(eff => (
                            <button
                              key={eff.id}
                              onClick={() => setEditEffect(eff.id)}
                              className={`px-2 py-1 text-[10px] font-bold tracking-wider border transition-colors ${
                                editEffect === eff.id
                                  ? 'border-cyan-400 bg-cyan-900/40 text-cyan-200'
                                  : 'border-white/10 text-white/40 hover:border-white/30'
                              }`}
                            >
                              {eff.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleEnabled(msg)}
                          className={`w-8 h-5 border flex items-center transition-colors ${
                            msg.enabled
                              ? 'border-green-500/50 bg-green-900/50 justify-end'
                              : 'border-white/20 bg-black justify-start'
                          }`}
                        >
                          <div className={`w-3 h-3 mx-0.5 ${msg.enabled ? 'bg-green-400' : 'bg-white/30'}`} />
                        </button>
                        <span className={`text-[9px] font-bold tracking-wider px-1.5 py-0.5 border ${
                          msg.type === 'one_off'
                            ? 'text-orange-400/80 border-orange-500/30'
                            : 'text-green-400/60 border-green-500/20'
                        }`}>
                          {msg.type === 'one_off' ? '⚡' : '🔁'}
                        </span>
                        <span className={`flex-1 text-sm tracking-wide ${msg.enabled ? 'text-cyan-100' : 'text-white/40'}`}>
                          {msg.content}
                        </span>
                        <span className="text-[9px] text-yellow-500/60 font-bold tracking-wider border border-yellow-500/20 px-1.5 py-0.5">
                          {(msg.effect || 'impact').toUpperCase()}
                        </span>
                        <button
                          onClick={() => setPreviewEffect({ text: msg.content, effect: msg.effect || 'impact' })}
                          className="px-2 py-1 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/30 text-[10px] font-bold tracking-wider"
                        >
                          ▶
                        </button>
                        <button
                          onClick={() => { setEditingId(msg.id); setEditContent(msg.content); setEditEffect(msg.effect || 'impact'); }}
                          className="px-2 py-1 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/30 text-[10px] font-bold tracking-wider"
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => deleteMessage(msg.id)}
                          className="px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-900/30 text-[10px] font-bold tracking-wider"
                        >
                          DEL
                        </button>
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
              <h1 className="text-xl text-cyan-300 tracking-wider mb-1">▶ USER SUBMISSIONS</h1>
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
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePaused(sub)}
                        className={`w-8 h-5 border flex items-center transition-colors ${
                          !sub.paused
                            ? 'border-green-500/50 bg-green-900/50 justify-end'
                            : 'border-orange-500/30 bg-black justify-start'
                        }`}
                        title={sub.paused ? 'Unpause' : 'Pause'}
                      >
                        <div className={`w-3 h-3 mx-0.5 ${!sub.paused ? 'bg-green-400' : 'bg-orange-400'}`} />
                      </button>
                      <span className="text-[10px] text-yellow-400/80 font-bold border border-yellow-500/20 px-1.5 py-0.5 uppercase">
                        {sub.type}
                      </span>
                      <span className="text-cyan-400/60 text-xs font-bold">{sub.name}</span>
                      <span className={`flex-1 text-sm tracking-wide truncate ${sub.paused ? 'text-white/30' : 'text-cyan-100'}`}>
                        {sub.type === 'photo' ? '📷 [photo]' : sub.content}
                      </span>
                      {sub.paused && (
                        <span className="text-[9px] text-orange-400 font-bold tracking-wider">PAUSED</span>
                      )}
                      <button
                        onClick={() => deleteSubmission(sub.id)}
                        className="px-2 py-1 border border-red-500/30 text-red-400 hover:bg-red-900/30 text-[10px] font-bold tracking-wider"
                      >
                        DEL
                      </button>
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
              <h1 className="text-xl text-cyan-300 tracking-wider mb-1">▶ DISPLAY SETTINGS</h1>
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
