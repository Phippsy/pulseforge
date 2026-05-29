import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
  }

  try {
    const body = req.body as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      token,
      onBeforeGenerateToken: async (pathname) => {
        return {
          maximumSizeInBytes: 50 * 1024 * 1024, // 50MB max
          token,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Could store metadata here if needed
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    const msg = (error as Error).message;
    console.error('Upload error:', msg);
    return res.status(400).json({ error: msg });
  }
}
