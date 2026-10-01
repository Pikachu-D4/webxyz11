# Eomeg Downloader

**Download your media. Your way.**

A modern, production-ready media downloader web app that supports YouTube and Instagram content. Paste a public URL, choose your quality, and download — with optional AI upscaling.

![License](https://img.shields.io/badge/License-Private-red) ![Vercel](https://img.shields.io/badge/Deploy-Vercel-black)

---

## Features

- 🎬 **YouTube & Instagram** — Videos, Shorts, Reels, image posts
- 📊 **Format selection** — Resolution, FPS, codec, audio info, file size
- 🚀 **AI Upscale** — Enhance video resolution via AI super-resolution backend
- 🌗 **Dark / Light theme** — Toggle with persistence
- 📋 **Download history** — Local browser history via localStorage
- 🔒 **Security** — SSRF protection, rate limiting, input validation, CORS
- 📱 **Responsive** — Mobile-first, works on all screen sizes
- ♿ **Accessible** — Semantic HTML, ARIA labels, keyboard navigation

---

## Architecture

```
User Browser
    │
    ▼
Vercel Frontend (static HTML/CSS/JS)
    │
    ▼
Vercel API Routes (Node.js Serverless)
    │
    ├──▶ MediaProvider (analyze, download, job status)
    │
    └──▶ UpscaleProvider (AI super-resolution jobs)
         │
         ▼
    Temporary Storage → Expiring Download URLs
```

The media extraction and AI upscaling layers are **fully modular**. Each uses an abstract provider interface that can be swapped without touching the frontend or API routes.

---

## Project Structure

```
├── api/
│   ├── analyze/index.js     # POST /api/analyze
│   ├── download/index.js    # POST /api/download
│   ├── job/index.js         # GET  /api/job?id=xxx
│   └── upscale/index.js     # POST /api/upscale & GET /api/upscale?id=xxx
│
├── lib/
│   ├── apiHelpers.js        # CORS, rate limiting, JSON helpers
│   ├── rateLimit.js         # In-memory rate limiter
│   ├── validation.js        # URL & platform validation, SSRF protection
│   └── providers/
│       ├── MediaProvider.js      # Abstract interface
│       ├── UpscaleProvider.js    # Abstract interface
│       ├── DemoMediaProvider.js  # Mock provider for development
│       ├── DemoUpscaleProvider.js # Mock upscale provider
│       └── index.js              # Provider factory
│
├── public/
│   ├── index.html           # Main page
│   ├── styles.css           # Design system
│   └── app.js               # Client application
│
├── .env.example             # Environment variables template
├── package.json
├── vercel.json              # Vercel deployment config
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli) (optional, for local dev)

### Install

```bash
npm install
```

### Run Locally

```bash
npx vercel dev
```

The app will start at `http://localhost:3000` in **demo mode** (using mock providers).

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your provider credentials:

```env
# Media extraction backend
MEDIA_API_URL=https://your-media-api.example.com
MEDIA_API_KEY=your-secret-key

# AI upscaling backend
UPSCALE_API_URL=https://your-upscale-api.example.com
UPSCALE_API_KEY=your-secret-key

# Temporary file storage (S3, R2, GCS, etc.)
STORAGE_URL=https://your-storage.example.com
STORAGE_API_KEY=your-storage-key

# Rate limiting
RATE_LIMIT_RPM=30
MAX_FILE_SIZE=2147483648
MAX_PROCESSING_DURATION=600
```

When `MEDIA_API_URL` is not set, the app runs in **demo mode** with simulated data.

---

## Connecting a Real Media Provider

1. Create a new file, e.g. `lib/providers/YtDlpProvider.js`
2. Extend the `MediaProvider` abstract class
3. Implement `analyze()`, `createDownloadJob()`, and `getJobStatus()`
4. Update `lib/providers/index.js` to instantiate your provider when `MEDIA_API_URL` is set

```js
const MediaProvider = require('./MediaProvider');

class YtDlpProvider extends MediaProvider {
  constructor(apiUrl, apiKey) {
    super();
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  async analyze(url) {
    // Call your backend API
  }

  async createDownloadJob(url, formatId) {
    // Create a job on your backend
  }

  async getJobStatus(jobId) {
    // Poll your backend
  }
}

module.exports = YtDlpProvider;
```

---

## Connecting an AI Upscaling Provider

Same pattern — extend `UpscaleProvider` and implement `createJob()` and `getJobStatus()`.

The upscaling backend should perform **real AI super-resolution** (e.g., Real-ESRGAN, Topaz Video AI, or a custom ML model). The provider abstraction ensures the frontend never needs to change.

---

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
npx vercel --prod
```

### Option 2: Git Integration

1. Push this repo to GitHub/GitLab
2. Import the project in [vercel.com/new](https://vercel.com/new)
3. Add environment variables in the Vercel dashboard
4. Deploy

---

## API Reference

### POST /api/analyze

Analyze a URL and return metadata + available formats.

**Request:**
```json
{ "url": "https://youtube.com/watch?v=..." }
```

**Response:**
```json
{
  "success": true,
  "platform": "youtube",
  "type": "video",
  "title": "...",
  "thumbnail": "https://...",
  "duration": 151,
  "formats": [
    {
      "id": "yt-1080-av",
      "quality": "1080p",
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "format": "mp4",
      "codec": "h264",
      "hasAudio": true,
      "fileSize": 44040192
    }
  ]
}
```

### POST /api/download

Create a download processing job.

### GET /api/job?id=xxx

Poll download job status. Returns `status`, `progress`, and `downloadUrl` when complete.

### POST /api/upscale

Create an AI upscale job.

### GET /api/upscale?id=xxx

Poll upscale job status with stage-based progress.

---

## Security

- URL validation with supported-platform allowlist
- SSRF protection (blocks private/internal IPs)
- Per-IP rate limiting (configurable RPM)
- Input sanitization
- CORS headers
- No API keys exposed to the browser
- No arbitrary URL proxying

For production, consider adding:
- [Upstash Redis](https://upstash.com/) for distributed rate limiting
- Vercel WAF / Firewall rules
- Request signing between frontend and processing backend

---

## Legal / Usage Notes

This service is intended for **publicly accessible media** that the user has permission to download or reuse.

The application does **not**:
- Bypass login or authentication
- Access private accounts
- Circumvent DRM
- Permanently store user media

---

## License

Private. All rights reserved.
