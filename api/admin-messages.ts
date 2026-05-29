import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getRedis } from './_lib/redis.js';

const ADMIN_MESSAGES_KEY = 'danfest:admin-messages';

interface AdminMessage {
  id: string;
  content: string;
  enabled: boolean;
  effect: string;
  type: 'heavy_rotation' | 'one_off';
  priority: boolean;
  createdAt: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const redis = getRedis();

  // Route: /api/admin-messages/[id] — extract id from URL
  const url = req.url || '';
  const idMatch = url.match(/\/api\/admin-messages\/([^/?]+)/);
  const targetId = idMatch?.[1];

  if (req.method === 'GET') {
    const raw = await redis.lrange(ADMIN_MESSAGES_KEY, 0, -1);
    const messages: AdminMessage[] = raw.map((item) =>
      typeof item === 'string' ? JSON.parse(item) : item
    );
    return res.status(200).json({ messages });
  }

  if (req.method === 'POST' && !targetId) {
    const { content, enabled, effect, type } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing content' });
    }

    const msgType = type === 'one_off' ? 'one_off' : 'heavy_rotation';
    const msg: AdminMessage = {
      id: `admin-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      content: String(content).slice(0, 500),
      enabled: enabled !== false,
      effect: effect || 'impact',
      type: msgType,
      priority: msgType === 'one_off',
      createdAt: Date.now(),
    };

    await redis.rpush(ADMIN_MESSAGES_KEY, JSON.stringify(msg));
    return res.status(201).json({ message: msg });
  }

  if (req.method === 'PUT' && targetId) {
    const body = req.body;
    const raw = await redis.lrange(ADMIN_MESSAGES_KEY, 0, -1);

    for (let i = 0; i < raw.length; i++) {
      const item: AdminMessage = typeof raw[i] === 'string' ? JSON.parse(raw[i] as string) : raw[i] as AdminMessage;
      if (item.id === targetId) {
        if (body.content !== undefined) item.content = String(body.content).slice(0, 500);
        if (body.enabled !== undefined) item.enabled = Boolean(body.enabled);
        if (body.effect !== undefined) item.effect = String(body.effect);
        if (body.type !== undefined) item.type = body.type === 'one_off' ? 'one_off' : 'heavy_rotation';
        if (body.priority !== undefined) item.priority = Boolean(body.priority);
        await redis.lset(ADMIN_MESSAGES_KEY, i, JSON.stringify(item));
        return res.status(200).json({ message: item });
      }
    }
    return res.status(404).json({ error: 'Message not found' });
  }

  if (req.method === 'DELETE' && targetId) {
    const raw = await redis.lrange(ADMIN_MESSAGES_KEY, 0, -1);

    for (let i = 0; i < raw.length; i++) {
      const item: AdminMessage = typeof raw[i] === 'string' ? JSON.parse(raw[i] as string) : raw[i] as AdminMessage;
      if (item.id === targetId) {
        // Remove by setting to a tombstone then removing it
        await redis.lset(ADMIN_MESSAGES_KEY, i, '__DELETED__');
        await redis.lrem(ADMIN_MESSAGES_KEY, 1, '__DELETED__');
        return res.status(200).json({ success: true });
      }
    }
    return res.status(404).json({ error: 'Message not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
