import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const REMOTE_KEY = 'danfest:remote-commands';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') {
    const { command, effectId } = req.body;
    if (command === 'select-effect' && effectId) {
      await redis.rpush(REMOTE_KEY, JSON.stringify({ command, effectId, ts: Date.now() }));
      return res.status(200).json({ ok: true });
    }
    if (!command || !['next-palette', 'next-effect'].includes(command)) {
      return res.status(400).json({ error: 'Invalid command' });
    }
    await redis.rpush(REMOTE_KEY, JSON.stringify({ command, ts: Date.now() }));
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    // Pop all pending commands atomically
    const raw = await redis.lrange(REMOTE_KEY, 0, -1);
    if (raw.length > 0) {
      await redis.del(REMOTE_KEY);
    }
    const commands = raw.map((item) =>
      typeof item === 'string' ? JSON.parse(item) : item
    );
    return res.status(200).json({ commands });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
