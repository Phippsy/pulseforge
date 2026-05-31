# Deployment & Infrastructure

> "This party infrastructure is more sophisticated than most startups."

## Hosting

Pulseforge is deployed on **Vercel** with automatic deployments from the `main` branch of `github.com/Phippsy/pulseforge`.

- **Live URL**: https://pulseforge-lyart.vercel.app
- **Admin**: https://pulseforge-lyart.vercel.app/admin
- **Submit**: https://pulseforge-lyart.vercel.app/submit

Every push to `main` triggers an automatic build and deployment. No CI/CD configuration needed — Vercel handles it.

## Services

### Upstash Redis (Vercel KV)

Used for:

- **Remote control command queue** (`danfest:remote-commands`): RPUSH to add commands, LRANGE+DEL to consume them
- **Admin messages** (`danfest:admin-messages`): System messages managed from the admin panel
- **User submissions** (`danfest:submissions`): Messages and photos from party guests

Environment variables:

```
KV_REST_API_URL=https://your-instance.upstash.io
KV_REST_API_TOKEN=your-token
```

### Vercel Blob Storage

Used for user-uploaded photos. HEIC images from iPhones are auto-converted to JPEG before upload.

Environment variable:

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

## Vercel Configuration (`vercel.json`)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/admin-messages/:id",
      "destination": "/api/admin-messages"
    },
    {
      "source": "/api/submissions/:id/shown",
      "destination": "/api/submissions/[id]/shown"
    },
    {
      "source": "/api/submissions/:id",
      "destination": "/api/submissions/[id]"
    },
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/submit", "destination": "/index.html" },
    { "source": "/admin", "destination": "/index.html" },
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Key points:

- SPA routing: `/submit` and `/admin` are client-side routes served by `index.html`
- API routes live in `/api/` and are deployed as Vercel serverless functions
- Dynamic routes use the `[id]` folder convention

## API Endpoints

### `POST /api/remote-control`

Push a command to the visualiser.

```json
{ "command": "next-palette" }
{ "command": "next-effect" }
{ "command": "select-effect", "effectId": "laserShow" }
```

### `GET /api/remote-control`

Consume all pending commands (destructive read — commands are deleted after retrieval).

Returns: `{ "commands": [{ "command": "...", "ts": 1234567890 }] }`

### `POST /api/admin-messages`

Create a system message.

```json
{
  "content": "HAPPY BIRTHDAY DAN",
  "effect": "impact",
  "type": "heavy_rotation"
}
```

### `GET /api/admin-messages`

List all system messages.

### `PUT /api/admin-messages/:id`

Update a message (toggle enabled, change text/effect).

### `DELETE /api/admin-messages/:id`

Delete a message.

### `POST /api/submissions`

Submit a user message.

```json
{ "type": "message", "content": "Happy Birthday!", "name": "Alice" }
```

### `POST /api/upload`

Upload a photo (multipart form data). Returns a blob URL.

## Local Development

```bash
npm run dev
```

The Vite dev server includes mock API handlers in `vite.config.ts`:

- In-memory arrays simulate Redis for admin messages and remote control
- No Redis/Blob credentials needed for local dev
- All API routes are mocked with the same request/response shapes as production

## Environment Variables

| Variable                | Required   | Purpose                   |
| ----------------------- | ---------- | ------------------------- |
| `KV_REST_API_URL`       | Production | Upstash Redis endpoint    |
| `KV_REST_API_TOKEN`     | Production | Upstash Redis auth token  |
| `BLOB_READ_WRITE_TOKEN` | Production | Vercel Blob storage token |

For local dev, none are required — the Vite config provides in-memory mocks.

## Build

```bash
npm run build   # tsc -b && vite build
```

TypeScript is compiled in build mode (`tsc -b`) which uses project references from `tsconfig.json`. The Vite build produces optimised static assets in `dist/`.

## Deployment Checklist

1. Push to `main` branch
2. Vercel auto-deploys (typically ~30 seconds)
3. Check the deployment URL works
4. Verify remote control from admin panel on your phone
5. Pour a celebratory beer (critical step)

---

_Infrastructure principle: If it takes more than 30 seconds to deploy, you've already lost your audience. So we keep deploys fast._
