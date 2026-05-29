import { useEffect, useState, useMemo } from 'react';

export type TextEffect = 'impact' | 'scattered' | 'grid' | 'stagger' | 'typewriter' | 'kinetic' | 'zoom' | 'glitch';

export const TEXT_EFFECTS: { id: TextEffect; name: string; description: string }[] = [
  { id: 'impact', name: 'IMPACT', description: 'Full-width bold text, maximum presence' },
  { id: 'scattered', name: 'SCATTERED', description: 'Letters at random positions with glow' },
  { id: 'grid', name: 'GRID', description: 'Constructivist grid with colored accent lines' },
  { id: 'stagger', name: 'STAGGER', description: 'Words appear at staggered positions' },
  { id: 'typewriter', name: 'TYPEWRITER', description: 'Characters reveal one by one' },
  { id: 'kinetic', name: 'KINETIC', description: 'Words fly in from different directions' },
  { id: 'zoom', name: 'ZOOM', description: 'Text zooms in from nothing to fill screen' },
  { id: 'glitch', name: 'GLITCH', description: 'Digital glitch distortion effect' },
];

interface EffectProps {
  text: string;
  visible: boolean;
}

// Full-width bold impact text - like "EAT SLEEP RAVE REPEAT"
function ImpactEffect({ text, visible }: EffectProps) {
  return (
    <div className={`fixed inset-0 flex items-center justify-center z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="px-[5vw] w-full text-center">
        <h1
          className="text-white font-black uppercase leading-[0.9] tracking-tight animate-[impactIn_0.6s_ease-out]"
          style={{ fontSize: 'clamp(3rem, 12vw, 10rem)', fontFamily: "'Bungee Shade', cursive", textShadow: '0 0 40px rgba(255,0,255,0.6), 0 0 80px rgba(255,0,255,0.3)' }}
        >
          {text}
        </h1>
      </div>
    </div>
  );
}

// Scattered words at random positions with glow - keeps words readable
function ScatteredEffect({ text, visible }: EffectProps) {
  const words = useMemo(() => {
    const colors = ['#ff00ff', '#00ffff', '#ffff00', '#ff6600', '#00ff88', '#ff3366', '#cc77ff'];
    const parts = text.split(/\s+/).filter(Boolean);
    // Distribute words across screen zones to avoid overlap
    const zones = parts.map((word, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const totalRows = Math.ceil(parts.length / 2);
      return {
        word,
        x: 15 + col * 40 + (Math.random() * 20 - 10),
        y: 15 + (row / Math.max(totalRows - 1, 1)) * 55 + (Math.random() * 10 - 5),
        size: word.length <= 3 ? 4.5 : word.length <= 6 ? 3.5 : 2.5,
        delay: i * 0.15,
        color: colors[i % colors.length],
        rotation: (Math.random() - 0.5) * 12,
      };
    });
    return zones;
  }, [text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {words.map((w, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: `${w.x}%`,
            top: `${w.y}%`,
            transform: `translate(-50%, -50%) rotate(${w.rotation}deg)`,
          }}
        >
          <span
            className="font-black uppercase whitespace-nowrap inline-block"
            style={{
              fontSize: `${w.size}rem`,
              fontFamily: "'Monoton', display",
              color: w.color,
              textShadow: `0 0 20px ${w.color}, 0 0 40px ${w.color}80, 0 2px 8px rgba(0,0,0,0.9)`,
              animation: `scatterWordIn 0.5s ease-out ${w.delay}s both`,
            }}
          >
            {w.word}
          </span>
        </div>
      ))}
    </div>
  );
}

// Constructivist grid with colored accent lines
function GridEffect({ text, visible }: EffectProps) {
  const words = text.split(/\s+/);
  const lineColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff3366', '#00ff88', '#cc77ff', '#ff6600'];

  const layout = useMemo(() => {
    return words.map((word, i) => ({
      word,
      row: Math.floor(i / 2),
      col: i % 2,
      vertical: i > 0 && Math.random() > 0.7,
      lineColor: lineColors[i % lineColors.length],
      size: word.length <= 3 ? 'text-5xl sm:text-7xl' : word.length <= 6 ? 'text-4xl sm:text-6xl' : 'text-3xl sm:text-5xl',
    }));
  }, [text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative p-8 max-w-[80vw]">
          {layout.map((item, i) => (
            <div
              key={i}
              className="relative inline-block m-2"
              style={{ animation: `gridIn 0.4s ease-out ${i * 0.15}s both` }}
            >
              {/* Accent line */}
              {i > 0 && (
                <div
                  className="absolute"
                  style={{
                    backgroundColor: item.lineColor,
                    boxShadow: `0 0 8px ${item.lineColor}, 0 0 16px ${item.lineColor}80`,
                    ...(item.vertical
                      ? { width: '3px', height: '130%', top: '-15%', left: '-14px' }
                      : { width: '110%', height: '3px', top: '-10px', left: '-5%' }),
                  }}
                />
              )}
              <span
                className={`font-black uppercase text-white block ${item.size} ${item.vertical ? 'writing-mode-vertical' : ''}`}
                style={item.vertical ? { writingMode: 'vertical-rl', textOrientation: 'mixed' } : {}}
              >
                {item.word}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Words at staggered positions and sizes
function StaggerEffect({ text, visible }: EffectProps) {
  const words = text.split(/\s+/);

  const positions = useMemo(() => {
    const colors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff88', '#ff3366', '#cc77ff'];
    return words.map((word, i) => ({
      word,
      x: 10 + (i % 3) * 30 + Math.random() * 10,
      y: 20 + Math.floor(i / 2) * 20 + Math.random() * 10,
      size: word.length <= 3 ? '4rem' : word.length <= 5 ? '3.5rem' : '2.5rem',
      delay: i * 0.12,
      color: colors[i % colors.length],
    }));
  }, [text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {positions.map((p, i) => (
        <span
          key={i}
          className="absolute font-black uppercase"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.size,
            fontFamily: "'Orbitron', sans-serif",
            color: p.color,
            animation: `staggerIn 0.5s ease-out ${p.delay}s both`,
            textShadow: `0 0 20px ${p.color}80, 2px 2px 0 rgba(0,0,0,0.8)`,
          }}
        >
          {p.word}
        </span>
      ))}
    </div>
  );
}

// Typewriter - characters appear one by one
function TypewriterEffect({ text, visible }: EffectProps) {
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (!visible) { setCharCount(0); return; }
    const interval = setInterval(() => {
      setCharCount(c => {
        if (c >= text.length) { clearInterval(interval); return c; }
        return c + 1;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [visible, text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="px-[5vw] max-w-[80vw]">
        <span
          className="text-white font-black uppercase tracking-wider"
          style={{ fontSize: 'clamp(2rem, 8vw, 6rem)', fontFamily: "'VT323', monospace" }}
        >
          {text.slice(0, charCount)}
          <span className="animate-pulse text-[#00ff88]">_</span>
        </span>
      </div>
    </div>
  );
}

// Words fly in from different directions
function KineticEffect({ text, visible }: EffectProps) {
  const words = text.split(/\s+/);
  const directions = ['translateX(-100vw)', 'translateX(100vw)', 'translateY(-100vh)', 'translateY(100vh)'];

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none flex items-center justify-center transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="flex flex-wrap items-center justify-center gap-x-[2vw] gap-y-0 px-[5vw]">
        {words.map((word, i) => (
          <span
            key={i}
            className="font-black uppercase text-white inline-block"
            style={{
              fontSize: 'clamp(2rem, 8vw, 6rem)',
              fontFamily: "'Silkscreen', cursive",
              textShadow: '0 0 30px rgba(0,255,136,0.5), 0 0 60px rgba(0,255,136,0.2)',
              animation: visible ? `kineticIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s both` : 'none',
              '--from-direction': directions[i % directions.length],
            } as React.CSSProperties}
          >
            {word}
          </span>
        ))}
      </div>
    </div>
  );
}

// Zoom from nothing to fill
function ZoomEffect({ text, visible }: EffectProps) {
  return (
    <div className={`fixed inset-0 z-40 pointer-events-none flex items-center justify-center transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="px-[5vw] text-center">
        <h1
          className="text-white font-black uppercase leading-[0.9]"
          style={{
            fontSize: 'clamp(3rem, 12vw, 10rem)',
            fontFamily: "'Rubik Glitch', system-ui",
            textShadow: '0 0 40px rgba(255,102,0,0.6), 0 0 80px rgba(255,255,0,0.3)',
            animation: visible ? 'zoomIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          }}
        >
          {text}
        </h1>
      </div>
    </div>
  );
}

// Digital glitch effect - aggressive with scanlines and distortion
function GlitchEffect({ text, visible }: EffectProps) {
  const [glitchFrame, setGlitchFrame] = useState(0);
  const [scanlineOffset, setScanlineOffset] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setGlitchFrame(f => f + 1);
      // Random scanline jumps
      if (Math.random() > 0.6) {
        setScanlineOffset(Math.random() * 100);
      }
    }, 60); // faster frame rate for more intense glitch
    return () => clearInterval(interval);
  }, [visible]);

  // More aggressive random offsets
  const isHeavyGlitch = glitchFrame % 7 < 2; // ~30% of frames are heavy glitches
  const isMediumGlitch = glitchFrame % 4 < 2;
  const offset1x = isHeavyGlitch ? (Math.random() * 30 - 15) : isMediumGlitch ? (Math.random() * 10 - 5) : 0;
  const offset1y = isHeavyGlitch ? (Math.random() * 12 - 6) : 0;
  const offset2x = isHeavyGlitch ? (Math.random() * 30 - 15) : isMediumGlitch ? (Math.random() * 10 - 5) : 0;
  const offset2y = isHeavyGlitch ? (Math.random() * 12 - 6) : 0;
  const baseSkew = isHeavyGlitch ? (Math.random() * 4 - 2) : 0;
  const baseShift = isMediumGlitch ? (Math.random() * 6 - 3) : 0;

  // Random clip paths for slice effect
  const slice1Top = Math.random() * 60;
  const slice1Bottom = slice1Top + 10 + Math.random() * 30;
  const slice2Top = Math.random() * 60;
  const slice2Bottom = slice2Top + 10 + Math.random() * 30;

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Background scanlines and noise */}
      {isHeavyGlitch && (
        <div className="absolute inset-0" style={{
          background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,68,0.03) 2px, rgba(255,0,68,0.03) 4px)`,
          transform: `translateY(${scanlineOffset}%)`,
        }} />
      )}
      {/* Horizontal glitch bars */}
      {isHeavyGlitch && Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0"
          style={{
            top: `${20 + Math.random() * 60}%`,
            height: `${2 + Math.random() * 8}px`,
            backgroundColor: Math.random() > 0.5 ? 'rgba(0,255,255,0.15)' : 'rgba(255,0,68,0.15)',
            transform: `translateX(${(Math.random() - 0.5) * 20}px)`,
          }}
        />
      ))}

      <div className="relative w-full h-full flex items-center justify-center px-[5vw] text-center">
        {/* Red/magenta offset layer */}
        <h1
          className="absolute font-black uppercase leading-[0.9] opacity-80"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            transform: `translate(${offset1x}px, ${offset1y}px)`,
            color: '#ff0044',
            mixBlendMode: 'screen',
            clipPath: isMediumGlitch ? `inset(${slice1Top}% 0 ${100 - slice1Bottom}% 0)` : 'none',
          }}
        >
          {text}
        </h1>
        {/* Cyan offset layer */}
        <h1
          className="absolute font-black uppercase leading-[0.9] opacity-80"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            transform: `translate(${offset2x}px, ${offset2y}px)`,
            color: '#00ffff',
            mixBlendMode: 'screen',
            clipPath: isMediumGlitch ? `inset(${slice2Top}% 0 ${100 - slice2Bottom}% 0)` : 'none',
          }}
        >
          {text}
        </h1>
        {/* White base layer with its own jitter */}
        <h1
          className="relative font-black uppercase leading-[0.9]"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            color: '#ffffff',
            transform: `translate(${baseShift}px, 0) skewX(${baseSkew}deg)`,
            textShadow: isHeavyGlitch
              ? '2px 0 #ff0044, -2px 0 #00ffff, 0 0 20px rgba(255,255,255,0.5)'
              : '0 0 10px rgba(255,255,255,0.3)',
          }}
        >
          {text}
        </h1>
      </div>
    </div>
  );
}

// Main component that renders the appropriate effect
export function DynamicTextDisplay({ text, effect, visible }: { text: string; effect: TextEffect; visible: boolean }) {
  switch (effect) {
    case 'impact': return <ImpactEffect text={text} visible={visible} />;
    case 'scattered': return <ScatteredEffect text={text} visible={visible} />;
    case 'grid': return <GridEffect text={text} visible={visible} />;
    case 'stagger': return <StaggerEffect text={text} visible={visible} />;
    case 'typewriter': return <TypewriterEffect text={text} visible={visible} />;
    case 'kinetic': return <KineticEffect text={text} visible={visible} />;
    case 'zoom': return <ZoomEffect text={text} visible={visible} />;
    case 'glitch': return <GlitchEffect text={text} visible={visible} />;
    default: return <ImpactEffect text={text} visible={visible} />;
  }
}
