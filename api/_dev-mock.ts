import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Local development mock for the submissions API
 * Uses in-memory storage - no Redis/Blob needed
 * 
 * To use locally, run: npx ts-node --esm api/_dev-server.ts
 * Or the Vite dev server proxies to this automatically
 */

interface Submission {
  id: string;
  type: 'photo' | 'message' | 'video';
  content: string;
  name: string;
  timestamp: number;
  shown: boolean;
}

// In-memory store for local dev
const submissions: Submission[] = [
  // Seed with some test data
  {
    id: 'test-1',
    type: 'message',
    content: 'Happy Birthday Dan! Hope you have an amazing night! 🎉',
    name: 'Sarah',
    timestamp: Date.now() - 60000,
    shown: false,
  },
  {
    id: 'test-2',
    type: 'message',
    content: 'DanFest is LEGENDARY. Love you mate!',
    name: 'Mike',
    timestamp: Date.now() - 30000,
    shown: false,
  },
  {
    id: 'test-3',
    type: 'message',
    content: 'Another year older, another year wiser. Happy birthday! 🥂',
    name: 'Emma',
    timestamp: Date.now(),
    shown: false,
  },
];

export { submissions };

export function handleSubmissions(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    let result = [...submissions];
    if (req.query.unshown === 'true') {
      result = result.filter((s) => !s.shown);
    }
    return res.status(200).json({ submissions: result });
  }

  if (req.method === 'POST') {
    const { type, content, name } = req.body;
    if (!type || !content || !name) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const submission: Submission = {
      id: crypto.randomUUID(),
      type,
      content: String(content).slice(0, 500),
      name: String(name).slice(0, 100),
      timestamp: Date.now(),
      shown: false,
    };
    submissions.push(submission);
    return res.status(201).json({ submission });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export function handleShown(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { id } = req.query;
  const sub = submissions.find((s) => s.id === id);
  if (sub) {
    sub.shown = true;
    return res.status(200).json({ success: true });
  }
  return res.status(404).json({ error: 'Not found' });
}

export function handleUpload(req: VercelRequest, res: VercelResponse) {
  // In local dev, just return a fake URL
  const filename = req.query.filename as string || 'upload.jpg';
  return res.status(200).json({ url: `/dev-uploads/${filename}` });
}
