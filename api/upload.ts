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

  const filename = req.query.filename as string;
  if (!filename) {
    return res.status(400).json({ error: 'Missing filename query parameter' });
  }

  // Stream the body directly to Vercel Blob
  const blob = await put(`danfest/${Date.now()}-${filename}`, req, {
    access: 'public',
  });

  return res.status(200).json({ url: blob.url });
}
