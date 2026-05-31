import { useEffect, useRef } from 'react';
import { useStore } from '../store';

export function useRemoteControl() {
  const nextPalette = useStore((s) => s.nextPalette);
  const triggerNextEffect = useStore((s) => s.triggerNextEffect);
  const selectEffect = useStore((s) => s.selectEffect);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    const poll = async () => {
      // Prevent overlapping polls (e.g. if previous fetch is still in flight)
      if (pollingRef.current) return;
      pollingRef.current = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`/api/remote-control?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) return;
        const data = await res.json();
        if (data.commands && data.commands.length > 0) {
          console.log('[RemoteControl] received:', data.commands.length, 'commands');
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
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          console.warn('[RemoteControl] poll error:', e);
        }
      } finally {
        pollingRef.current = false;
      }
    };

    // Poll immediately on mount, then every 1 second
    poll();
    intervalRef.current = setInterval(poll, 1000);

    // When tab becomes visible again (after being backgrounded), poll immediately
    // This handles the case where setInterval was throttled by the browser
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [nextPalette, triggerNextEffect, selectEffect]);
}
