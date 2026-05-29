import { useState, useRef, useEffect } from 'react';

interface Submission {
  id: string;
  type: 'message' | 'photo' | 'video';
  content: string;
  name: string;
  shown: boolean;
  timestamp: number;
}

async function compressImage(file: File, maxBytes: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  // Scale down iteratively until under the size limit
  let quality = 0.85;
  let scale = 1;
  const MAX_DIM = 2048;

  // Cap dimensions first
  if (width > MAX_DIM || height > MAX_DIM) {
    scale = MAX_DIM / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Try progressively lower quality until under limit
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > maxBytes && quality > 0.3) {
    quality -= 0.15;
    blob = await canvasToBlob(canvas, quality);
  }

  // If still too large, scale down further
  while (blob.size > maxBytes && width > 400) {
    width = Math.round(width * 0.7);
    height = Math.round(height * 0.7);
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(await createImageBitmap(file), 0, 0, width, height);
    blob = await canvasToBlob(canvas, quality);
  }

  return blob;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality);
  });
}

function TeletextHeader() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const fmt = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = time.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' });
  return (
    <div className="flex justify-between items-center px-4 py-2 bg-black/80 border-b border-cyan-500/30 text-white font-mono text-xs sm:text-sm">
      <span className="text-cyan-400">■ P888</span>
      <span className="text-cyan-100 tracking-[0.3em] font-medium">DANFEST</span>
      <span className="text-cyan-400/60">{date} {fmt}</span>
    </div>
  );
}

function TeletextFooter() {
  return (
    <div className="px-4 py-2 bg-black/80 border-t border-cyan-500/30 text-white font-mono text-xs sm:text-sm flex justify-between">
      <span className="text-yellow-400">■ TRANSMISSIONS</span>
      <span className="hidden sm:inline text-cyan-500/60">SEND YOUR MESSAGE INTO THE VOID</span>
    </div>
  );
}

export function SubmitPage() {
  const [mode, setMode] = useState<'choose' | 'message' | 'photo'>('choose');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [queue, setQueue] = useState<Submission[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Poll for queue updates
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch('/api/submissions');
        if (res.ok) {
          const data = await res.json();
          const list = data.submissions || data;
          setQueue(list.sort((a: Submission, b: Submission) => b.timestamp - a.timestamp));
        }
      } catch { /* ignore */ }
    };
    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (mode === 'message') {
        if (!message.trim()) {
          setError('Please enter a message');
          setSubmitting(false);
          return;
        }

        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'message',
            content: message.trim(),
            name: name.trim(),
          }),
        });

        if (!res.ok) throw new Error('Failed to submit');
      } else if (mode === 'photo' && file) {
        // Determine content type (Chrome doesn't assign MIME to HEIC/HEIF)
        let contentType = file.type;
        const ext = file.name.split('.').pop()?.toLowerCase();
        const isHeic = ext === 'heic' || ext === 'heif';
        if (!contentType || contentType === 'application/octet-stream' || isHeic) {
          contentType = 'image/jpeg';
        }

        // Always convert images through canvas to ensure browser-compatible format
        // (HEIC/HEIF can't be displayed by most browsers) and fit within 4.5MB limit
        const MAX_BYTES = 4.5 * 1024 * 1024;
        let uploadBody: Blob | File = file;
        if (contentType.startsWith('image/') && (file.size > MAX_BYTES || isHeic)) {
          uploadBody = await compressImage(file, MAX_BYTES);
          contentType = 'image/jpeg';
        }

        // Upload file directly to server which streams to Vercel Blob
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: {
            'content-type': contentType,
            'x-filename': file.name,
          },
          body: uploadBody,
        });

        if (!uploadRes.ok) throw new Error('Failed to upload file');
        const { url } = await uploadRes.json();

        const type = file.type.startsWith('video/') ? 'video' : 'photo';
        const res = await fetch('/api/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type,
            content: url,
            name: name.trim(),
          }),
        });

        if (!res.ok) throw new Error('Failed to submit');
      }

      setSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col font-mono">
        <TeletextHeader />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md w-full border border-green-500/30 p-6 bg-black">
            <div className="text-green-400 text-4xl mb-4 animate-pulse">█ TRANSMITTED █</div>
            <p className="text-cyan-300 text-lg mb-2">
              ▶ SIGNAL RECEIVED FROM: <span className="text-yellow-300">{name}</span>
            </p>
            <p className="text-green-300 mb-6">
              Your {mode === 'message' ? 'message' : 'photo'} will appear on the main display shortly.
            </p>
            <div className="text-white/40 text-xs mb-6">
              ════════════════════════════════════
            </div>
            <button
              onClick={() => {
                setSubmitted(false);
                setMode('choose');
                setMessage('');
                setFile(null);
                setPreview(null);
              }}
              className="px-6 py-3 bg-cyan-800 hover:bg-cyan-700 text-cyan-100 border border-cyan-500/50 font-mono text-sm transition-colors"
            >
              ◀◀ TRANSMIT ANOTHER ▶▶
            </button>
          </div>
        </div>
        <TeletextFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-mono">
      <TeletextHeader />
      
      {/* Starfield background effect */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-px h-px bg-white rounded-full animate-pulse"
            style={{
              left: `${(i * 37 + 13) % 100}%`,
              top: `${(i * 53 + 7) % 100}%`,
              opacity: 0.3 + (i % 5) * 0.15,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + (i % 3)}s`,
            }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center px-3 py-3 sm:p-4 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md">
          
          {/* Title block - Ceefax style */}
          <div className="mb-4 sm:mb-6 text-center">
            <div className="bg-yellow-500 text-black px-3 py-1 inline-block font-bold text-xs mb-2">
              PAGE 888
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-cyan-300 tracking-wider">
              ◀ DANFEST ▶
            </h1>
            <h2 className="text-yellow-400 text-sm mt-1">
              ■ TRANSMIT A MESSAGE TO THE BIG SCREEN ■
            </h2>
            <div className="text-white/30 text-xs mt-2">
              ────────────────────────────────
            </div>
          </div>

          {/* Name input - teletext style */}
          <div className="mb-4">
            <label className="block text-green-400 text-xs mb-1 tracking-widest">▶ CALL SIGN:</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ENTER YOUR NAME"
              className="w-full px-3 py-3 bg-black/50 border border-cyan-500/30 text-cyan-100 placeholder-cyan-900 font-mono text-base focus:outline-none focus:border-cyan-400 uppercase tracking-wider"
              maxLength={100}
            />
          </div>

          {/* Mode selection - chunky teletext buttons */}
          {mode === 'choose' && (
            <div className="space-y-3">
              <button
                onClick={() => setMode('message')}
                className="w-full px-4 py-5 bg-magenta-900 border-2 border-magenta-500 hover:bg-magenta-800 text-white text-left transition-colors group active:scale-[0.98]"
                style={{ borderColor: '#ff00ff55', backgroundColor: '#1a001a' }}
              >
                <span className="text-yellow-300 text-xs block mb-1">OPTION 1</span>
                <span className="text-xl text-magenta-200 group-hover:text-white" style={{ color: '#ff88ff' }}>
                  ✍ WRITE A MESSAGE
                </span>
                <span className="block text-xs text-white/40 mt-1">Text will appear on the party display</span>
              </button>
              <button
                onClick={() => setMode('photo')}
                className="w-full px-4 py-5 text-left transition-colors group active:scale-[0.98]"
                style={{ borderWidth: '2px', borderColor: '#00ffff55', backgroundColor: '#001a1a' }}
              >
                <span className="text-yellow-300 text-xs block mb-1">OPTION 2</span>
                <span className="text-xl group-hover:text-white" style={{ color: '#88ffff' }}>
                  📡 BEAM A PHOTO
                </span>
                <span className="block text-xs text-white/40 mt-1">Image will be projected into the visuals</span>
              </button>
            </div>
          )}

          {/* Message form */}
          {mode === 'message' && (
            <div className="space-y-4">
              <div>
                <label className="block text-green-400 text-xs mb-1 tracking-widest">▶ YOUR TRANSMISSION:</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="HAPPY BIRTHDAY DAN..."
                  className="w-full px-3 py-3 bg-black/50 border border-cyan-500/30 text-cyan-100 placeholder-cyan-900 font-mono text-base focus:outline-none focus:border-cyan-400 h-28 resize-none uppercase tracking-wide"
                  maxLength={500}
                />
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-white/30">MAX 500 CHARS</span>
                  <span className="text-yellow-400">{message.length}/500</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setMode('choose')}
                  className="px-4 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm transition-colors active:scale-95"
                >
                  ◀ BACK
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 px-4 py-4 bg-green-900 border-2 border-green-500 text-green-200 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed text-base transition-colors font-bold tracking-wider active:scale-95"
                >
                  {submitting ? '▶ TRANSMITTING...' : '▶▶ TRANSMIT ▶▶'}
                </button>
              </div>
            </div>
          )}

          {/* Photo/video upload form */}
          {mode === 'photo' && (
            <div className="space-y-4">
              <div>
                <label className="block text-green-400 text-xs mb-1 tracking-widest">▶ SELECT SIGNAL:</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,video/*,.heic,.heif"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {preview ? (
                  <div className="relative border-2 border-cyan-700">
                    {file?.type.startsWith('video/') ? (
                      <video src={preview} className="w-full max-h-[30vh] object-contain" controls />
                    ) : (
                      <img src={preview} alt="Preview" className="w-full max-h-[30vh] object-contain" />
                    )}
                    <button
                      onClick={() => { setFile(null); setPreview(null); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-900 border border-red-500 flex items-center justify-center text-red-200 hover:bg-red-700 font-mono text-xs"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-green-400 text-xs px-2 py-1">
                      ▶ SIGNAL LOCKED
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full py-10 border-2 border-dashed border-cyan-700 text-cyan-400 hover:border-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    <div className="text-3xl mb-2">📡</div>
                    <div className="text-sm tracking-wider">TAP TO CAPTURE / SELECT</div>
                    <div className="text-xs text-white/30 mt-1">PHOTO OR VIDEO</div>
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setMode('choose'); setFile(null); setPreview(null); }}
                  className="px-4 py-3 border border-white/20 text-white/60 hover:text-white hover:border-white/40 text-sm transition-colors active:scale-95"
                >
                  ◀ BACK
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !file}
                  className="flex-1 px-4 py-4 bg-green-900 border-2 border-green-500 text-green-200 hover:bg-green-800 disabled:opacity-40 disabled:cursor-not-allowed text-base transition-colors font-bold tracking-wider active:scale-95"
                >
                  {submitting ? '▶ BEAMING...' : '▶▶ BEAM IT ▶▶'}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 px-3 py-2 bg-red-900/50 border border-red-500 text-red-300 text-center text-sm">
              ⚠ {error}
            </div>
          )}

          {/* Queue section */}
          <div className="mt-8 border-t border-cyan-500/20 pt-4">
            <button
              onClick={() => setShowQueue(!showQueue)}
              className="w-full flex items-center justify-between px-3 py-2 bg-black/50 border border-cyan-500/20 text-cyan-200 hover:bg-cyan-900/20 transition-colors text-sm"
            >
              <span>
                ■ TRANSMISSION LOG ({queue.length} signals)
              </span>
              <span>{showQueue ? '▾' : '▸'}</span>
            </button>

            {showQueue && (
              <div className="mt-3 space-y-2 max-h-[50vh] overflow-y-auto pb-4">
                {queue.length === 0 ? (
                  <p className="text-center text-cyan-700 py-4 text-sm">NO SIGNALS DETECTED. BE THE FIRST.</p>
                ) : (
                  queue.map((item) => (
                    <div
                      key={item.id}
                      className="px-3 py-2 border-l-4 bg-black/50"
                      style={{ borderLeftColor: item.shown ? '#22c55e' : '#eab308' }}
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-yellow-400">{item.name.toUpperCase()}</span>
                        <span className="text-white/20">│</span>
                        <span className="text-white/40">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="ml-auto text-xs">
                          {item.shown ? (
                            <span className="text-green-500">■ SHOWN</span>
                          ) : (
                            <span className="text-yellow-500 animate-pulse">■ QUEUED</span>
                          )}
                        </span>
                      </div>
                      {item.type === 'message' ? (
                        <p className="text-cyan-200 text-xs mt-1 leading-relaxed">{item.content}</p>
                      ) : (
                        <div className="mt-1 text-xs text-white/40">
                          [{item.type === 'video' ? '🎬 VIDEO' : '📸 PHOTO'}]
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <TeletextFooter />
    </div>
  );
}
