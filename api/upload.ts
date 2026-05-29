import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const filename = req.headers['x-filename'] as string;
    const contentType = (req.headers['content-type'] as string) || 'image/jpeg';

    if (!filename) {
      return res.status(400).json({ error: 'Missing x-filename header' });
    }

    const blob = await put(`danfest/${Date.now()}-${filename}`, req, {
      access: 'public',
      contentType,
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    const msg = (error as Error).message;
    console.error('Upload error:', msg);
    return res.status(500).json({ error: msg });
  }
}
