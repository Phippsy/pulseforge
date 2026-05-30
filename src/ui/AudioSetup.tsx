import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { AudioCapture } from '../audio/AudioCapture';

interface Props {
  audioCapture?: AudioCapture;
}

export function AudioSetup(_props?: Props) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const setAudioDevice = useStore((s) => s.setAudioDevice);
  const startCapture = useStore((s) => s.startCapture);

  useEffect(() => {
    // Request permission first to get device labels
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return AudioCapture.listDevices();
      })
      .then(setDevices)
      .catch(() => setError('Microphone permission denied'));
  }, []);

  const handleStart = () => {
    setAudioDevice(selectedDevice);
    startCapture();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      <div className="relative bg-gray-950/80 backdrop-blur-xl rounded-2xl p-10 max-w-lg w-full mx-4 shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/[0.06]">
        {/* Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
            DANFEST <span className="text-cyan-400">50</span>
          </h1>
          <div className="w-12 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent mx-auto mb-3" />
          <p className="text-white/40 text-sm font-mono tracking-wider uppercase">
            Dan's Birthday Visualiser &middot; 8 Aug 2026
          </p>
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-lg p-3 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Audio input selector */}
        <div className="mb-8">
          <label className="text-white/50 text-xs font-mono uppercase tracking-wider block mb-3">
            Audio Input
          </label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-cyan-500/40 transition-colors appearance-none cursor-pointer"
          >
            <option value="">Default Microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Input ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {/* Setup tips */}
        <details className="mb-8 group">
          <summary className="text-white/35 text-xs font-mono uppercase tracking-wider cursor-pointer hover:text-white/55 transition-colors select-none">
            Setup tips for Traktor
          </summary>
          <div className="mt-4 space-y-3 pl-4 border-l border-white/[0.06] text-[13px] leading-relaxed">
            <p className="text-white/40">
              <span className="text-white/60 font-medium">Quick Start</span> — Select Built-in Microphone and play music through speakers.
            </p>
            <p className="text-white/40">
              <span className="text-white/60 font-medium">Recommended</span> — Install BlackHole 2ch, create a Multi-Output Device in Audio MIDI Setup, route Traktor through it, then select BlackHole here.
            </p>
            <p className="text-white/40">
              <span className="text-white/60 font-medium">Pro</span> — Route mixer record output to audio interface input.
            </p>
          </div>
        </details>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full bg-gradient-to-r from-cyan-500 to-cyan-400 text-black font-bold py-3.5 rounded-lg hover:from-cyan-400 hover:to-cyan-300 transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:shadow-[0_0_30px_rgba(6,182,212,0.35)] active:scale-[0.98]"
        >
          Start Visualiser
        </button>
      </div>
    </div>
  );
}
