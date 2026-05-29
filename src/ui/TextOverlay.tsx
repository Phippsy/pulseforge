import { useStore } from '../store';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';

type TextAnimation = 'shimmer' | 'typewriter' | 'glitch' | 'breathe' | 'wave' | 'dissolve';

const animations: TextAnimation[] = ['shimmer', 'typewriter', 'glitch', 'breathe', 'wave', 'dissolve'];

const danfestMessages = [
  'Happy Birthday Dan! 🎉',
  'Welcome to DanFest!',
  'DanFest 2026',
  'Happy Birthday, Legend!',
  'DanFest — The Main Event',
  'Cheers to Dan! 🥂',
  'DanFest is LIVE',
  'Here\'s to you, Dan! 🎂',
  'DanFest — All Night Long',
  'Happy Birthday, mate!',
];

function getRandomAnimation(): TextAnimation {
  return animations[Math.floor(Math.random() * animations.length)];
}

function getRandomDanfestMessage(): string {
  return danfestMessages[Math.floor(Math.random() * danfestMessages.length)];
}

export function TextOverlay() {
  const showText = useStore((s) => s.showText);

  const [displayText, setDisplayText] = useState('');
  const [visible, setVisible] = useState(false);
  const [animation, setAnimation] = useState<TextAnimation>('shimmer');
  const [typewriterProgress, setTypewriterProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showMessage = useCallback((text: string) => {
    const anim = getRandomAnimation();
    setAnimation(anim);
    setDisplayText(text);
    setVisible(true);
    setTypewriterProgress(0);

    if (anim === 'typewriter') {
      let progress = 0;
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      typewriterRef.current = setInterval(() => {
        progress++;
        setTypewriterProgress(progress);
        if (progress >= text.length) {
          if (typewriterRef.current) clearInterval(typewriterRef.current);
        }
      }, 50);
    }

    // Auto-hide after 8s
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    }, 8000);
  }, []);

  // Cycle DanFest messages every 25-40s
  useEffect(() => {
    if (!showText) {
      setVisible(false);
      return;
    }

    // Show first message after 5s
    timerRef.current = setTimeout(() => {
      showMessage(getRandomDanfestMessage());
    }, 5000);

    // Then cycle every 25-40s
    intervalRef.current = setInterval(() => {
      showMessage(getRandomDanfestMessage());
    }, 25000 + Math.random() * 15000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [showText, showMessage]);

  // Per-character styling for wave animation
  const waveChars = useMemo(() => {
    if (animation !== 'wave' || !displayText) return null;
    return displayText.split('').map((char, i) => (
      <span
        key={i}
        className="inline-block animate-text-wave"
        style={{ animationDelay: `${i * 0.05}s` }}
      >
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  }, [animation, displayText]);

  if (!displayText) return null;

  const baseClasses = 'fixed inset-0 z-20 flex items-center justify-center pointer-events-none';
  const textBaseClasses = 'text-center max-w-3xl px-8';

  const getTextContent = () => {
    if (animation === 'typewriter') {
      return displayText.slice(0, typewriterProgress) + (typewriterProgress < displayText.length ? '▌' : '');
    }
    if (animation === 'wave') {
      return waveChars;
    }
    return displayText;
  };

  const getAnimationClasses = () => {
    switch (animation) {
      case 'shimmer':
        return 'animate-text-shimmer bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-white bg-[length:200%_100%]';
      case 'glitch':
        return 'animate-text-glitch text-white';
      case 'breathe':
        return 'animate-text-breathe text-white/80';
      case 'dissolve':
        return 'animate-text-dissolve text-white';
      case 'wave':
        return 'text-white';
      case 'typewriter':
        return 'text-green-300 font-mono';
      default:
        return 'text-white';
    }
  };

  return (
    <div
      className={`${baseClasses} transition-opacity duration-[2000ms] ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className={textBaseClasses}>
        <p
          className={`text-4xl md:text-5xl font-light tracking-wide leading-relaxed drop-shadow-[0_0_30px_rgba(255,255,255,0.4)] ${getAnimationClasses()}`}
        >
          {getTextContent()}
        </p>
      </div>
    </div>
  );
}
