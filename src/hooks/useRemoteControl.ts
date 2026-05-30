import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useRemoteControl() {
  const nextPalette = useStore((s) => s.nextPalette);
  const triggerNextEffect = useStore((s) => s.triggerNextEffect);
  const selectEffect = useStore((s) => s.selectEffect);
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
              triggerNextEffect();
            } else if (cmd.command === 'select-effect' && cmd.effectId) {
              selectEffect(cmd.effectId);
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
  }, [nextPalette, triggerNextEffect, selectEffect]);
}
