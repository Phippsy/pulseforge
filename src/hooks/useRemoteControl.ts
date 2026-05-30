import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useRemoteControl() {
  const nextPalette = useStore((s) => s.nextPalette);
  const nextPhase = useStore((s) => s.nextPhase);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/remote-control');
        if (!res.ok) return;
        const data = await res.json();
        if (data.commands && data.commands.length > 0) {
          for (const cmd of data.commands) {
            if (cmd.command === 'next-palette') {
              nextPalette();
            } else if (cmd.command === 'next-effect') {
              nextPhase();
            }
          }
        }
      } catch {
        // ignore network errors
      }
    };

    intervalRef.current = setInterval(poll, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [nextPalette, nextPhase]);
}
