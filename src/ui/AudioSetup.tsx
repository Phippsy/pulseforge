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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="bg-gray-900 rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl border border-white/10">
        <h1 className="text-2xl font-bold text-white mb-1">🎉 DANFEST 50 🎉</h1>
        <p className="text-white/50 text-sm mb-6">Dan's Birthday Visualiser • 8 Aug 2026</p>

        {error && (
          <div className="bg-red-900/50 border border-red-500/50 rounded p-3 mb-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="text-white/70 text-sm block mb-2">Audio Input</label>
          <select
            value={selectedDevice}
            onChange={(e) => setSelectedDevice(e.target.value)}
            className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-white/50"
          >
            <option value="">Default Microphone</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Input ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        <details className="mb-4 text-white/50 text-xs">
          <summary className="cursor-pointer hover:text-white/70 mb-2">Setup tips for Traktor</summary>
          <div className="space-y-2 pl-2 border-l border-white/10">
            <p><strong className="text-white/70">Quick Start:</strong> Select Built-in Microphone and play music through speakers.</p>
            <p><strong className="text-white/70">Recommended:</strong> Install BlackHole 2ch, create a Multi-Output Device in Audio MIDI Setup, route Traktor through it, then select BlackHole here.</p>
            <p><strong className="text-white/70">Pro:</strong> Route mixer record output to audio interface input.</p>
          </div>
        </details>

        <button
          onClick={handleStart}
          className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-white/90 transition-colors"
        >
          Start Visualiser
        </button>
      </div>
    </div>
  );
}
