import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SUBMISSIONS_KEY = 'danfest:submissions';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing submission id' });
  }

  const all = await redis.lrange(SUBMISSIONS_KEY, 0, -1);

  // Find and update the submission
  for (let i = 0; i < all.length; i++) {
    const item = typeof all[i] === 'string' ? JSON.parse(all[i] as string) : all[i];
    if (item.id === id) {
      item.shown = true;
      await redis.lset(SUBMISSIONS_KEY, i, JSON.stringify(item));
      return res.status(200).json({ success: true });
    }
  }

  return res.status(404).json({ error: 'Submission not found' });
}
