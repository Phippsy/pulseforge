import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const SUBMISSIONS_KEY = 'danfest:submissions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing submission id' });
  }

  if (req.method === 'DELETE') {
    const all = await redis.lrange(SUBMISSIONS_KEY, 0, -1);

    for (let i = 0; i < all.length; i++) {
      const item = typeof all[i] === 'string' ? JSON.parse(all[i] as string) : all[i];
      if (item.id === id) {
        await redis.lset(SUBMISSIONS_KEY, i, '__DELETED__');
        await redis.lrem(SUBMISSIONS_KEY, 1, '__DELETED__');
        return res.status(200).json({ success: true });
      }
    }

    return res.status(404).json({ error: 'Submission not found' });
  }

  if (req.method === 'GET') {
    const all = await redis.lrange(SUBMISSIONS_KEY, 0, -1);
    for (const raw of all) {
      const item = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (item.id === id) {
        return res.status(200).json({ submission: item });
      }
    }
    return res.status(404).json({ error: 'Submission not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
