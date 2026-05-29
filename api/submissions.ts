import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis, SUBMISSIONS_KEY } from './_lib/redis';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();

  if (req.method === 'GET') {
    // Fetch all submissions, optionally filter unshown
    const all = await redis.lrange(SUBMISSIONS_KEY, 0, -1);
    let submissions = all.map((item) =>
      typeof item === 'string' ? JSON.parse(item) : item
    );

    if (req.query.unshown === 'true') {
      submissions = submissions.filter((s: any) => !s.shown);
    }

    return res.status(200).json({ submissions });
  }

  if (req.method === 'POST') {
    // Add a new submission
    const { type, content, name } = req.body;

    if (!type || !content || !name) {
      return res.status(400).json({ error: 'Missing required fields: type, content, name' });
    }

    if (!['photo', 'message', 'video'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be photo, message, or video' });
    }

    // Sanitize inputs
    const sanitizedName = String(name).slice(0, 100);
    const sanitizedContent = type === 'message' ? String(content).slice(0, 500) : String(content);

    const submission = {
      id: crypto.randomUUID(),
      type,
      content: sanitizedContent,
      name: sanitizedName,
      timestamp: Date.now(),
      shown: false,
    };

    await redis.rpush(SUBMISSIONS_KEY, JSON.stringify(submission));

    return res.status(201).json({ submission });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
