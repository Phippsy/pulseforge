import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { IncomingMessage, ServerResponse } from 'http'

// In-memory store for local dev submissions
interface DevSubmission {
  id: string;
  type: string;
  content: string;
  name: string;
  timestamp: number;
  shown: boolean;
  paused: boolean;
  source?: 'user' | 'admin';
}

interface AdminMessage {
  id: string;
  content: string;
  enabled: boolean;
  effect: string;
  type: 'heavy_rotation' | 'one_off';
  priority: boolean; // one_off messages are auto-prioritised
  createdAt: number;
}

const devSubmissions: DevSubmission[] = [
  { id: 'test-1', type: 'message', content: 'Happy Birthday Dan! Hope you have an amazing night! 🎉', name: 'Sarah', timestamp: Date.now() - 60000, shown: false, paused: false, source: 'user' },
  { id: 'test-2', type: 'message', content: 'DanFest is LEGENDARY. Love you mate!', name: 'Mike', timestamp: Date.now() - 30000, shown: false, paused: false, source: 'user' },
  { id: 'test-3', type: 'message', content: 'Another year older, another year wiser. Happy birthday! 🥂', name: 'Emma', timestamp: Date.now(), shown: false, paused: false, source: 'user' },
];

const adminMessages: AdminMessage[] = [
  { id: 'admin-1', content: 'WELCOME TO DANFEST', enabled: true, effect: 'impact', type: 'heavy_rotation', priority: false, createdAt: Date.now() - 120000 },
  { id: 'admin-2', content: 'HAPPY BIRTHDAY DAN', enabled: true, effect: 'zoom', type: 'heavy_rotation', priority: false, createdAt: Date.now() - 60000 },
  { id: 'admin-3', content: 'EAT SLEEP RAVE REPEAT', enabled: true, effect: 'kinetic', type: 'heavy_rotation', priority: false, createdAt: Date.now() - 30000 },
];

// In-memory queue for remote control commands (local dev)
const remoteCommands: Array<{ command: string; ts: number }> = [];

function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'local-api-and-spa',
      configureServer(server) {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
          const url = req.url || '';

          // API: GET/POST /api/submissions
          if (url.startsWith('/api/submissions') && !url.includes('/shown')) {
            if (req.method === 'GET') {
              const unshown = url.includes('unshown=true');
              const all = url.includes('all=true');
              // Admin view gets all; display gets non-paused only
              const pool = all ? devSubmissions : devSubmissions.filter(s => !s.paused);
              const result = unshown ? pool.filter(s => !s.shown) : pool;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ submissions: result }));
              return;
            }
            if (req.method === 'POST') {
              const body = await parseBody(req);
              const sub: DevSubmission = {
                id: `dev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                type: body.type || 'message',
                content: body.type === 'message' ? String(body.content || '').slice(0, 500) : String(body.content || ''),
                name: String(body.name || '').slice(0, 100),
                timestamp: Date.now(),
                shown: false,
                paused: false,
              };
              devSubmissions.push(sub);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 201;
              res.end(JSON.stringify({ submission: sub }));
              return;
            }
          }

          // API: POST /api/submissions/:id/shown
          if (url.includes('/shown') && req.method === 'POST') {
            const match = url.match(/\/api\/submissions\/([^/]+)\/shown/);
            if (match) {
              const sub = devSubmissions.find(s => s.id === match[1]);
              if (sub) sub.shown = true;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
              return;
            }
          }

          // API: DELETE /api/submissions/:id
          if (url.match(/\/api\/submissions\/[^/]+$/) && req.method === 'DELETE') {
            const match = url.match(/\/api\/submissions\/([^/]+)$/);
            if (match) {
              const idx = devSubmissions.findIndex(s => s.id === match[1]);
              if (idx >= 0) devSubmissions.splice(idx, 1);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
              return;
            }
          }

          // API: PUT /api/submissions/:id (pause/unpause)
          if (url.match(/\/api\/submissions\/[^/]+$/) && req.method === 'PUT') {
            const match = url.match(/\/api\/submissions\/([^/]+)$/);
            if (match) {
              const body = await parseBody(req);
              const sub = devSubmissions.find(s => s.id === match[1]);
              if (sub) {
                if (body.paused !== undefined) (sub as any).paused = Boolean(body.paused);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ submission: sub }));
              return;
            }
          }

          // API: POST /api/upload - store as base64 data URL in dev
          if (url.startsWith('/api/upload') && req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('end', () => {
              const buffer = Buffer.concat(chunks);
              const ext = (url.match(/filename=([^&]+)/) || ['', 'file.bin'])[1];
              const mime = ext.match(/\.mp4$/) ? 'video/mp4'
                : ext.match(/\.webm$/) ? 'video/webm'
                : ext.match(/\.png$/) ? 'image/png'
                : ext.match(/\.gif$/) ? 'image/gif'
                : 'image/jpeg';
              const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ url: dataUrl }));
            });
            return;
          }

          // API: GET/POST/PUT/DELETE /api/admin-messages
          if (url.startsWith('/api/admin-messages')) {
            const idMatch = url.match(/\/api\/admin-messages\/([^/]+)$/);
            if (req.method === 'GET') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ messages: adminMessages }));
              return;
            }
            if (req.method === 'POST' && !idMatch) {
              const body = await parseBody(req);
              const msgType = body.type === 'one_off' ? 'one_off' : 'heavy_rotation';
              const msg: AdminMessage = {
                id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                content: String(body.content || '').slice(0, 500),
                enabled: body.enabled !== false,
                effect: body.effect || 'impact',
                type: msgType,
                priority: msgType === 'one_off',
                createdAt: Date.now(),
              };
              adminMessages.push(msg);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 201;
              res.end(JSON.stringify({ message: msg }));
              return;
            }
            if (req.method === 'PUT' && idMatch) {
              const body = await parseBody(req);
              const msg = adminMessages.find(m => m.id === idMatch[1]);
              if (msg) {
                if (body.content !== undefined) msg.content = String(body.content).slice(0, 500);
                if (body.enabled !== undefined) msg.enabled = Boolean(body.enabled);
                if (body.effect !== undefined) msg.effect = String(body.effect);
                if (body.type !== undefined) msg.type = body.type === 'one_off' ? 'one_off' : 'heavy_rotation';
                if (body.priority !== undefined) msg.priority = Boolean(body.priority);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ message: msg }));
              return;
            }
            if (req.method === 'DELETE' && idMatch) {
              const idx = adminMessages.findIndex(m => m.id === idMatch[1]);
              if (idx >= 0) adminMessages.splice(idx, 1);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
              return;
            }
          }

          // API: GET/POST /api/remote-control
          if (url.startsWith('/api/remote-control')) {
            if (req.method === 'POST') {
              const body = await parseBody(req);
              if (body.command && ['next-palette', 'next-effect'].includes(body.command)) {
                remoteCommands.push({ command: body.command, ts: Date.now() });
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true }));
              return;
            }
            if (req.method === 'GET') {
              const commands = remoteCommands.splice(0);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ commands }));
              return;
            }
          }

          // SPA fallback for /submit and /admin
          if (url.startsWith('/submit') || url.startsWith('/admin')) {
            req.url = '/index.html';
          }

          next();
        });
      },
    },
  ],
})
