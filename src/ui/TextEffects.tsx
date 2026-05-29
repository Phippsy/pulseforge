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
          style={{ fontSize: 'clamp(3rem, 12vw, 10rem)' }}
        >
          {text}
        </h1>
      </div>
    </div>
  );
}

// Scattered letters at random positions with glow
function ScatteredEffect({ text, visible }: EffectProps) {
  const letters = useMemo(() => {
    return text.split('').filter(c => c !== ' ').map((char, i) => ({
      char,
      x: 10 + Math.random() * 80,
      y: 15 + Math.random() * 70,
      size: 2 + Math.random() * 6,
      delay: i * 0.08,
      glow: Math.random() > 0.5,
      color: ['#ffffff', '#ffdd44', '#ffaa00', '#ffffff', '#ffffcc'][Math.floor(Math.random() * 5)],
    }));
  }, [text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {letters.map((l, i) => (
        <span
          key={i}
          className="absolute font-black uppercase"
          style={{
            left: `${l.x}%`,
            top: `${l.y}%`,
            fontSize: `${l.size}rem`,
            color: l.color,
            textShadow: l.glow ? `0 0 20px ${l.color}, 0 0 40px ${l.color}80` : 'none',
            transform: 'translate(-50%, -50%)',
            animation: `scatterIn 0.5s ease-out ${l.delay}s both`,
          }}
        >
          {l.char}
        </span>
      ))}
    </div>
  );
}

// Constructivist grid with colored accent lines
function GridEffect({ text, visible }: EffectProps) {
  const words = text.split(/\s+/);
  const lineColors = ['#ffdd00', '#0044ff', '#ff0044', '#00ff88', '#ff8800'];

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
                    ...(item.vertical
                      ? { width: '2px', height: '120%', top: '-10%', left: '-12px' }
                      : { width: '100%', height: '2px', top: '-8px', left: 0 }),
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
    return words.map((word, i) => ({
      word,
      x: 10 + (i % 3) * 30 + Math.random() * 10,
      y: 20 + Math.floor(i / 2) * 20 + Math.random() * 10,
      size: word.length <= 3 ? '4rem' : word.length <= 5 ? '3.5rem' : '2.5rem',
      delay: i * 0.12,
    }));
  }, [text]);

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none transition-opacity duration-1000 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {positions.map((p, i) => (
        <span
          key={i}
          className="absolute font-black uppercase text-white"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            fontSize: p.size,
            animation: `staggerIn 0.5s ease-out ${p.delay}s both`,
            textShadow: '2px 2px 0 rgba(0,0,0,0.8)',
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
          style={{ fontSize: 'clamp(2rem, 8vw, 6rem)' }}
        >
          {text.slice(0, charCount)}
          <span className="animate-pulse text-cyan-400">_</span>
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
            animation: visible ? 'zoomIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'none',
          }}
        >
          {text}
        </h1>
      </div>
    </div>
  );
}

// Digital glitch effect
function GlitchEffect({ text, visible }: EffectProps) {
  const [glitchFrame, setGlitchFrame] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setGlitchFrame(f => f + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [visible]);

  const offset1 = glitchFrame % 3 === 0 ? Math.random() * 8 - 4 : 0;
  const offset2 = glitchFrame % 5 === 0 ? Math.random() * 8 - 4 : 0;

  return (
    <div className={`fixed inset-0 z-40 pointer-events-none flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="relative px-[5vw] text-center">
        {/* Glitch layers */}
        <h1
          className="absolute inset-0 text-white font-black uppercase leading-[0.9] opacity-80"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            transform: `translate(${offset1}px, ${offset2}px)`,
            color: '#ff0044',
            mixBlendMode: 'screen',
            clipPath: glitchFrame % 4 === 0 ? `inset(${Math.random() * 40}% 0 ${Math.random() * 40}% 0)` : 'none',
          }}
        >
          {text}
        </h1>
        <h1
          className="absolute inset-0 text-white font-black uppercase leading-[0.9] opacity-80"
          style={{
            fontSize: 'clamp(3rem, 10vw, 8rem)',
            transform: `translate(${-offset1}px, ${-offset2}px)`,
            color: '#00ffff',
            mixBlendMode: 'screen',
            clipPath: glitchFrame % 3 === 0 ? `inset(${Math.random() * 40}% 0 ${Math.random() * 40}% 0)` : 'none',
          }}
        >
          {text}
        </h1>
        <h1
          className="relative text-white font-black uppercase leading-[0.9]"
          style={{ fontSize: 'clamp(3rem, 10vw, 8rem)' }}
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
