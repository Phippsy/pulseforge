import { useEffect, useState, useRef, useCallback } from 'react';
import type { Submission } from '../types/submission';
import { DynamicTextDisplay, type TextEffect } from './TextEffects';

interface AdminMsg {
  id: string;
  content: string;
  effect: TextEffect;
  type: 'heavy_rotation' | 'one_off';
  priority: boolean;
}

interface FloatingItem {
  submission: Submission;
  x: number;
  y: number;
  vx: number;
  vy: number;
  scale: number;
  targetScale: number;
  rotation: number;
  rotationSpeed: number;
  fontFamily: string;
  color: string;
  glowColor: string;
}

const MESSAGE_FONTS = [
  "'Bungee Shade', cursive",
  "'Monoton', display",
  "'Rubik Glitch', system-ui",
  "'VT323', monospace",
  "'Silkscreen', cursive",
  "'Orbitron', sans-serif",
];

const NEON_COLORS = [
  { text: '#ff00ff', glow: 'rgba(255,0,255,0.4)' },   // magenta
  { text: '#00ffff', glow: 'rgba(0,255,255,0.4)' },    // cyan
  { text: '#ffff00', glow: 'rgba(255,255,0,0.4)' },    // yellow
  { text: '#ff6600', glow: 'rgba(255,102,0,0.4)' },    // orange
  { text: '#00ff88', glow: 'rgba(0,255,136,0.4)' },    // mint
  { text: '#ff3366', glow: 'rgba(255,51,102,0.4)' },   // hot pink
  { text: '#66ffcc', glow: 'rgba(102,255,204,0.4)' },  // aqua
  { text: '#cc77ff', glow: 'rgba(204,119,255,0.4)' },  // purple
  { text: '#ffffff', glow: 'rgba(255,255,255,0.3)' },   // white
];

function getDisplayDuration() { return 15000 + Math.random() * 5000; } // 15-20s randomised
const NEW_MSG_INTERVAL = 8000; // 8s between new messages (prioritise)
const OLD_MSG_INTERVAL = 60000; // 60s between recycled messages (visuals take priority)
const POLL_INTERVAL = 8000; // poll API every 8s

export function SubmissionDisplay() {
  const [currentItem, setCurrentItem] = useState<FloatingItem | null>(null);
  const [visible, setVisible] = useState(false);
  const newQueueRef = useRef<Submission[]>([]);
  const shownQueueRef = useRef<Submission[]>([]);
  const rotateIndexRef = useRef(0);
  const animRef = useRef<number>(0);
  const itemRef = useRef<FloatingItem | null>(null);
  const lastShowRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const adminMessagesRef = useRef<AdminMsg[]>([]);
  const priorityQueueRef = useRef<AdminMsg[]>([]);
  const shownPriorityIdsRef = useRef<Set<string>>(new Set(
    JSON.parse(localStorage.getItem('shownPriorityIds') || '[]')
  ));
  const [activeAdminMsg, setActiveAdminMsg] = useState<AdminMsg | null>(null);

  // Fetch all submissions - separate into new (unshown) and shown
  const fetchQueue = useCallback(async () => {
    try {
      const [subRes, adminRes] = await Promise.all([
        fetch('/api/submissions'),
        fetch('/api/admin-messages'),
      ]);
      if (subRes.ok) {
        const data = await subRes.json();
        const all: Submission[] = data.submissions || [];
        // New submissions always jump the queue
        newQueueRef.current = all.filter(s => !s.shown);
        shownQueueRef.current = all.filter(s => s.shown);
      }
      if (adminRes.ok) {
        const data = await adminRes.json();
        const enabled = (data.messages || []).filter((m: { enabled: boolean }) => m.enabled);
        const mapped: AdminMsg[] = enabled.map((m: { id: string; content: string; effect?: string; type?: string; priority?: boolean }) => ({
          id: m.id,
          content: m.content,
          effect: (m.effect || 'impact') as TextEffect,
          type: (m.type || 'heavy_rotation') as 'heavy_rotation' | 'one_off',
          priority: Boolean(m.priority),
        }));
        // Heavy rotation goes into the rotation pool
        adminMessagesRef.current = mapped.filter(m => m.type === 'heavy_rotation');
        // One-off priority messages jump the queue (only new ones never shown before)
        const newPriority = mapped.filter(m => m.priority && !shownPriorityIdsRef.current.has(m.id));
        if (newPriority.length > 0) {
          priorityQueueRef.current.push(...newPriority);
          newPriority.forEach(m => shownPriorityIdsRef.current.add(m.id));
          localStorage.setItem('shownPriorityIds', JSON.stringify([...shownPriorityIdsRef.current]));
        }
      }
    } catch {
      // API not available yet - silent fail
    }
  }, []);

  // Poll for new submissions
  useEffect(() => {
    fetchQueue();
    pollRef.current = setInterval(fetchQueue, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchQueue]);

  const showingRef = useRef(false);

  // Queue processor - show next item every QUEUE_INTERVAL
  useEffect(() => {
    const checkQueue = setInterval(() => {
      const now = Date.now();

      // HIGHEST PRIORITY: one-off messages from DJ (skip all intervals)
      if (priorityQueueRef.current.length > 0 && !showingRef.current) {
        const priorityMsg = priorityQueueRef.current.shift()!;
        showingRef.current = true;
        setActiveAdminMsg(priorityMsg);
        setVisible(true);
        lastShowRef.current = now;
        // Disable one-off message server-side so it never reappears
        fetch(`/api/admin-messages/${priorityMsg.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: false }),
        }).catch(() => {});
        setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            setActiveAdminMsg(null);
            showingRef.current = false;
          }, 2000);
        }, getDisplayDuration());
        return;
      }

      // Don't show anything new while something is currently displayed
      if (showingRef.current) return;

      const hasNew = newQueueRef.current.length > 0;
      const interval = hasNew ? NEW_MSG_INTERVAL : OLD_MSG_INTERVAL;
      if (now - lastShowRef.current < interval && lastShowRef.current > 0) return;

      let submission: Submission | undefined;
      let adminPick: AdminMsg | undefined;

      // Priority: unshown submissions always jump the queue
      if (hasNew) {
        submission = newQueueRef.current.shift()!;
        // Mark as shown on server
        fetch(`/api/submissions/${submission.id}/shown`, { method: 'POST' }).catch(() => {});
        // Move to shown pool for future rotation
        shownQueueRef.current.push(submission);
      } else if (shownQueueRef.current.length > 0 || adminMessagesRef.current.length > 0) {
        // Rotate through previously shown submissions + admin messages (heavy rotation)
        const userPool = shownQueueRef.current;
        const adminPool = adminMessagesRef.current;
        const totalPool = userPool.length + adminPool.length;
        const idx = rotateIndexRef.current % totalPool;
        if (idx < userPool.length) {
          submission = userPool[idx];
        } else {
          adminPick = adminPool[idx - userPool.length];
        }
        rotateIndexRef.current = idx + 1;
      }

      if (!submission && !adminPick) return;
      lastShowRef.current = now;
      showingRef.current = true;

      // Admin message: show full-screen effect
      if (adminPick) {
        setActiveAdminMsg(adminPick);
        setVisible(true);
        setTimeout(() => {
          setVisible(false);
          setTimeout(() => {
            setActiveAdminMsg(null);
            showingRef.current = false;
          }, 2000);
        }, getDisplayDuration());
        return;
      }

      if (!submission) return;

      // Create floating item with random starting position and velocity
      const colorPick = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
      const item: FloatingItem = {
        submission,
        x: 20 + Math.random() * 60, // % from left (avoid edges)
        y: 20 + Math.random() * 60, // % from top
        vx: (Math.random() - 0.5) * 0.3, // slow drift
        vy: (Math.random() - 0.5) * 0.2,
        scale: 0.6 + Math.random() * 0.4,
        targetScale: 0.8 + Math.random() * 0.4,
        rotation: (Math.random() - 0.5) * 10, // slight tilt
        rotationSpeed: (Math.random() - 0.5) * 0.5,
        fontFamily: MESSAGE_FONTS[Math.floor(Math.random() * MESSAGE_FONTS.length)],
        color: colorPick.text,
        glowColor: colorPick.glow,
      };

      itemRef.current = item;
      setCurrentItem(item);
      setVisible(true);

      // Hide after display duration
      setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setCurrentItem(null);
          itemRef.current = null;
          showingRef.current = false;
        }, 2000); // fade out time
      }, getDisplayDuration());
    }, 5000); // check every 5s

    return () => clearInterval(checkQueue);
  }, []);

  // Animation loop for floating movement
  useEffect(() => {
    let lastTime = performance.now();

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const item = itemRef.current;
      if (!item) return;

      // Drift position
      item.x += item.vx * dt * 10;
      item.y += item.vy * dt * 10;

      // Bounce off edges
      if (item.x < 10 || item.x > 90) item.vx *= -1;
      if (item.y < 10 || item.y > 90) item.vy *= -1;
      item.x = Math.max(5, Math.min(95, item.x));
      item.y = Math.max(5, Math.min(95, item.y));

      // Slowly change scale
      item.scale += (item.targetScale - item.scale) * dt * 0.5;
      if (Math.abs(item.scale - item.targetScale) < 0.01) {
        item.targetScale = 0.6 + Math.random() * 0.6;
      }

      // Slow rotation
      item.rotation += item.rotationSpeed * dt;

      // Trigger re-render
      setCurrentItem({ ...item });
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  if (!currentItem && !activeAdminMsg) return null;

  // Admin message: full-screen dynamic text effect
  if (activeAdminMsg) {
    return (
      <div
        className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-[2000ms] ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <DynamicTextDisplay text={activeAdminMsg.content} effect={activeAdminMsg.effect} visible={visible} />
      </div>
    );
  }

  const { submission, x, y, scale, rotation, fontFamily, color, glowColor } = currentItem!;

  return (
    <div
      className={`fixed inset-0 z-30 pointer-events-none transition-opacity duration-[2000ms] ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="absolute transition-none"
        style={{
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
        }}
      >
        {submission.type === 'photo' && (
          <div className="relative shadow-[0_0_40px_rgba(0,0,0,0.7)] opacity-65">
            <img
              src={submission.content}
              alt={`From ${submission.name}`}
              className="max-w-[40vw] max-h-[50vh] rounded-sm border border-cyan-500/30"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md px-4 py-2">
              <p className="text-cyan-300 text-sm font-mono tracking-wider">▶ {submission.name.toUpperCase()}</p>
            </div>
          </div>
        )}

        {submission.type === 'message' && (
          <div className="bg-black/50 backdrop-blur-md rounded-sm px-8 py-6 max-w-[50vw] border shadow-[0_0_40px_rgba(0,0,0,0.7)] opacity-85" style={{ borderColor: `${color}40` }}>
            <p
              className="text-2xl md:text-4xl font-bold leading-relaxed uppercase tracking-wider"
              style={{
                fontFamily,
                color,
                textShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}, 0 2px 4px rgba(0,0,0,0.8)`,
              }}
            >
              {submission.content}
            </p>
            <p className="text-sm mt-4 text-right tracking-[0.3em] uppercase opacity-80" style={{ fontFamily: "'Press Start 2P', cursive", color: `${color}cc` }}>— {submission.name}</p>
          </div>
        )}

        {submission.type === 'video' && (
          <div className="relative shadow-[0_0_40px_rgba(0,0,0,0.7)]">
            <video
              src={submission.content}
              autoPlay
              muted
              loop
              playsInline
              className="max-w-[50vw] max-h-[60vh] rounded-sm border border-cyan-500/30"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md px-4 py-2">
              <p className="text-cyan-300 text-sm font-mono tracking-wider">▶ {submission.name.toUpperCase()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
