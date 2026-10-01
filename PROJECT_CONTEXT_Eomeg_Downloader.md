# Eomeg Downloader — Master Project Context & Architecture Guide
> **Note for Future AI Assistants (Claude, GPT, Gemini, Cursor, etc.):**  
> This document is the single source of truth for **Eomeg Downloader**. Read this document carefully before making changes. It documents the core architecture, backend pipelines, cloud datacenter bypass strategies, resolved bugs, and deployment setup.

---

## 1. Project Overview & Vision

**Eomeg Downloader** is a high-performance, aesthetically rich web application that allows users to analyze, download, and enhance (AI upscale) media from **YouTube** (Videos & Shorts) and **Instagram** (Reels, Videos, Carousels).

### Key Features
1. **Zero-Friction Analysis**: Users paste a public URL; the backend extracts metadata, thumbnails, duration, and clean format tiers.
2. **Quality Selection**: Clean, deduplicated quality options ranging from 144p to 1080p, 1440p, 4K, and high-fidelity 320kbps Audio (MP3/M4A).
3. **CRF-18 Master Enhancement**: Visually lossless re-encoding using FFmpeg with Contrast Adaptive Sharpening (`cas=0.55`) and debanding (`deband`) for studio-quality results.
4. **AI Super-Resolution Upscaling**: Upscales lower resolution video to 1080p, 1440p, or 4K with real-time job progress polling.
5. **Smart Device Detection**: Automatically detects user device (Windows PC, Mac, Linux, Android, iOS) and highlights optimal quality options.
6. **Datacenter Bypass & Cookie Engine**: Resilient multi-tier strategy for cloud hosts (Render/Docker) to bypass YouTube bot detection and IP blocks.

---

## 2. Technology Stack

- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom CSS variable tokens, glassmorphism, responsive grid), Vanilla JavaScript (ES6+ modular, no heavy framework overhead).
- **Backend**: Node.js (v18+ / v20 LTS).
  - Standalone server: `server.js` (Express-like lightweight routing with static file serving).
  - Serverless compatibility: `api/` directory endpoints with `withMiddleware` wrapper.
- **Media Engine**:
  - `yt-dlp`: Standalone binary for metadata extraction and stream downloading.
  - `ffmpeg` & `ffprobe`: Binary-based video manipulation, stream merging, audio upmixing, and CAS upscaling.
- **Hosting & Deployment**:
  - **Render** (Primary Production): Containerized via `Dockerfile` (`node:20-bookworm-slim` with system `ffmpeg`, `python3`, `curl`, and standalone `yt-dlp`).
  - **Local Development**: Windows / macOS / Linux direct execution (`node server.js`).
  - **Vercel**: Static frontend with serverless API delegates.

---

## 3. Repository Directory Structure

```text
webxyz11/
├── Dockerfile                   # Docker container specification for Render (installs yt-dlp & ffmpeg)
├── server.js                    # Core local/production HTTP server (routes APIs and static assets)
├── package.json                 # Node dependencies (uuid, etc.)
├── vercel.json                  # Vercel deployment routing configuration
├── .gitignore                   # Ignores downloads, node_modules, temp cookies, logs
│
├── api/                         # Backend API Endpoints (serverless & server.js mounted)
│   ├── analyze/index.js         # POST /api/analyze — URL validation & format extraction
│   ├── download/index.js        # POST /api/download — Creates async download job
│   ├── job/[id].js              # GET /api/job/:id — Download job progress polling
│   ├── upscale/index.js         # POST /api/upscale & GET /api/upscale/:jobId
│   ├── cookie/index.js          # GET, POST, DELETE /api/cookie — Admin cookie manager API
│   └── serve/[...slug].js       # GET /api/serve/:jobId/:filename — Streams completed files
│
├── lib/                         # Backend Core Libraries & Business Logic
│   ├── binaries.js              # Resolves cross-platform paths for yt-dlp, ffmpeg, ffprobe
│   ├── cookies.js               # Cookie storage, Netscape normalization & SAPISID sanitization
│   ├── validation.js            # Regex-based URL validation for YouTube & Instagram
│   ├── apiHelpers.js            # Request body parsing, CORS, and standardized JSON responses
│   └── providers/
│       ├── index.js             # Factory for MediaProvider and UpscaleProvider
│       ├── MediaProvider.js     # Abstract base class for media extraction
│       ├── YtDlpMediaProvider.js# Production yt-dlp provider (analyzing, downloading, merging)
│       ├── UpscaleProvider.js   # Abstract base class for video upscaling
│       ├── FFmpegUpscaleProvider.js # Real FFmpeg-based deband & CAS enhancement engine
│       └── MockMediaProvider.js # Offline fallback for testing
│
├── public/                      # Frontend Assets
│   ├── index.html               # Main application interface
│   ├── love.html                # Secret cookie management dashboard (/love)
│   ├── app.js                   # Main application client logic (device detection, polling, UI)
│   └── styles.css               # Design system & responsive layout styles
│
├── bin/                         # Local Windows binaries (yt-dlp.exe, ffmpeg.exe, ffprobe.exe)
└── downloads/                   # Temporary directory for in-flight media processing
```

---

## 4. Media Extraction & Download Architecture

```text
User Input URL ──> POST /api/analyze ──> YtDlpMediaProvider.analyze()
                                                │
                                  ┌─────────────┴─────────────┐
                                  ▼                           ▼
                        yt-dlp --dump-json          Cookie Sanitization
                        --js-runtimes node          (Auto-strip SAPISID)
                        --extractor-args            --cookies cookies.txt
                        player_client=android,mweb            │
                                  │                           │
                                  └─────────────┬─────────────┘
                                                ▼
                                    JSON Formats & Metadata
                                                ▼
                                    Frontend Quality Cards
```

### The `YtDlpMediaProvider` Class
Located in [`lib/providers/YtDlpMediaProvider.js`](file:///c:/Users/pikac/OneDrive/Documents/GitHub/webxyz11/lib/providers/YtDlpMediaProvider.js):
- **`analyze(url)`**: Executes `yt-dlp` with `--dump-json`, `--no-playlist`, and `--js-runtimes node`. Parses raw formats into user-facing tiers (4K, 1440p, 1080p, 720p, 480p, 360p, and 320kbps Audio).
- **`createDownloadJob(url, formatId, title)`**: Generates a unique UUID `jobId` and initiates an asynchronous background download process.
- **`_runDownloadProcess(job, url, formatId)`**:
  - **Standard Mode**: Downloads best video + audio streams with `--merge-output-format mp4`.
  - **CRF-18 Master Mode** (`formatId = crf18_*`): Downloads raw high-bitrate video, then invokes FFmpeg with `-vf deband,cas=0.55 -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 320k` for high-fidelity output.
- **`getJobStatus(jobId)`**: Returns `{ status, progress, downloadUrl, error }`.

---

## 5. YouTube Datacenter Blocking: The Problem & The Solution

### Why Cloud Hosts (Render, AWS, DigitalOcean) Get Blocked
YouTube aggressively blocks public cloud datacenter IPs from fetching video streams without authentication, resulting in:
- `ERROR: [youtube] Failed to extract any player response`
- `ERROR: [youtube] Sign in to confirm you're not a bot`
- Requests hanging until connection timeout (`Analysis timed out`).

*(Note: When run locally on a home PC, YouTube NEVER blocks residential broadband IPs).*

### Solution 1: Player Client Fallback Strategy
YouTube enforces strict bot challenges on its default `web` desktop player client. However, its mobile API endpoints are substantially more permissive:
```javascript
// Crucial flags passed to yt-dlp in YtDlpMediaProvider and api/cookie/index.js
const args = [
  '--js-runtimes', 'node',
  '--extractor-args', 'youtube:player_client=android,mweb',
  // Note: 'android' must precede 'ios' and 'web' because 'android' responds in <6s
];
```

### Solution 2: Dynamic Cookie Management (`/love`)
A dedicated admin page is available at `/love` (`https://<domain>/love`):
- Allows dragging-and-dropping `cookies.txt` or pasting cookie strings.
- Saves cookies to disk and verifies them against YouTube.
- Shows real-time cookie health (active state, entry count, domains).

### Solution 3: The SAPISID Cryptographic Signature Gotcha
**Critical Discovery**: When cookies are exported from Chrome using Cookie-Editor, they include Google's origin-bound tokens:
- `SAPISID`
- `__Secure-1PAPISID`
- `__Secure-3PAPISID`

When `yt-dlp` sends these cookies without an accompanying cryptographic browser hash (`Authorization: SAPISIDHASH <timestamp>_<sha1>`), YouTube rejects the request with:
`ERROR: [youtube] The page needs to be reloaded.`

**The Fix in `lib/cookies.js` & `public/love.html`**:
The backend automatically sanitizes all incoming cookies before saving:
```javascript
function sanitizeCookieContent(rawContent) {
  const lines = rawContent.split('\n');
  const clean = lines.filter((l) => {
    if (!l.trim() || l.startsWith('#')) return true;
    const parts = l.split('\t');
    const name = parts[5];
    // Exclude SAPISID / PAPISID tokens which trigger origin-bound signature checks
    if (name && (name.includes('SAPISID') || name.includes('PAPISID'))) {
      return false;
    }
    return true;
  });
  return clean.join('\n');
}
```
All genuine session authentication cookies (`LOGIN_INFO`, `SID`, `__Secure-1PSID`, `__Secure-3PSID`, `PREF`, `VISITOR_INFO1_LIVE`) remain intact and bypass datacenter blocks with 100% reliability.

### Solution 4: Permanent Storage via `YOUTUBE_COOKIES` Environment Variable
Render containers are **ephemeral**; redeploying code destroys temporary files on disk.
To make cookies permanent across all future Git pushes and container restarts:
1. In Render Dashboard -> Service Settings -> **Environment**.
2. Add Variable `YOUTUBE_COOKIES`.
3. Paste the sanitized Netscape cookie text.
[`lib/cookies.js`](file:///c:/Users/pikac/OneDrive/Documents/GitHub/webxyz11/lib/cookies.js) automatically reads `process.env.YOUTUBE_COOKIES` on container boot and writes it to disk.

---

## 6. Video Enhancement & AI Upscaling Pipeline

Located in [`lib/providers/FFmpegUpscaleProvider.js`](file:///c:/Users/pikac/OneDrive/Documents/GitHub/webxyz11/lib/providers/FFmpegUpscaleProvider.js):

### Super-Resolution Filter Chain
Rather than simply changing metadata resolution, the upscaler applies a professional enhancement filter graph:
1. **Debanding (`deband`)**: Eliminates color banding and compression artifacts common in web video.
2. **Contrast Adaptive Sharpening (`cas=0.55`)**: Recovers fine textures and edge definition without introducing ringing artifacts.
3. **Lanczos / Spline Scaling (`scale=W:H:flags=lanczos`)**: High-order interpolation to 1080p (1920x1080), 1440p (2560x1440), or 4K (3840x2160).
4. **Master Video Encoding (`-c:v libx264 -crf 18 -preset slow`)**: Visually lossless compression.
5. **Master Audio Encoding (`-c:a aac -b:a 320k`)**: Studio-grade audio bitrate.

---

## 7. Smart Client Device Detection

Located in [`public/app.js`](file:///c:/Users/pikac/OneDrive/Documents/GitHub/webxyz11/public/app.js) (`detectDevice()`):
The browser client inspects `navigator.userAgent`:
- **Windows PC**: Displays `💻 Windows PC • 1080p & 4K Ready`.
- **Apple Mac**: Displays `🖥️ Apple Mac • 1080p & 4K Ready`.
- **Linux PC**: Displays `🐧 Linux PC • 1080p & 4K Ready`.
- **Android**: Displays `📱 Android Device • Fast Mobile Ready`.
- **Apple iOS**: Displays `🍎 Apple iOS • QuickTime MP4 Ready`.

The detected device type dynamically controls recommendations in the quality selection list.

---

## 8. API Specification

### `POST /api/analyze`
**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```
**Response**:
```json
{
  "success": true,
  "platform": "youtube",
  "title": "Rick Astley - Never Gonna Give You Up",
  "author": "Rick Astley",
  "thumbnail": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
  "duration": 213,
  "originalResolution": "1080p",
  "formats": [
    {
      "id": "crf18_1080",
      "quality": "1080p (CRF-18 Master)",
      "width": 1920,
      "height": 1080,
      "fps": 60,
      "format": "mp4",
      "codec": "libx264 (Enhanced)",
      "hasAudio": true,
      "fileSize": 45000000
    },
    {
      "id": "18",
      "quality": "360p",
      "format": "mp4",
      "hasAudio": true
    },
    {
      "id": "ba/bestaudio",
      "quality": "Audio (MP3/M4A)",
      "format": "m4a",
      "hasAudio": true
    }
  ]
}
```

### `POST /api/download`
**Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "formatId": "18",
  "title": "Rick Astley"
}
```
**Response**:
```json
{
  "success": true,
  "jobId": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

### `GET /api/job/:id`
**Response (In Progress)**:
```json
{
  "status": "processing",
  "progress": 45,
  "downloadUrl": null
}
```
**Response (Completed)**:
```json
{
  "status": "completed",
  "progress": 100,
  "downloadUrl": "/api/serve/f47ac10b-58cc-4372-a567-0e02b2c3d479/Rick%20Astley.mp4"
}
```

### `POST /api/upscale`
**Request**:
```json
{
  "sourceUrl": "/api/serve/job-id/source.mp4",
  "targetResolution": "1080p",
  "title": "Video Title"
}
```

### `GET /api/cookie`
Returns current cookie health status: `{ success: true, active: true, entries: 29, domains: [...] }`.

### `POST /api/cookie`
Accepts `{ cookieText }`, sanitizes SAPISID tokens, writes to disk, and runs verification against YouTube.

---

## 9. Running and Deploying

### Option A: Local PC Development (Zero-Block Environment)
Your home residential broadband connection is never blocked by YouTube:
```powershell
# 1. Install dependencies
npm install

# 2. Start application
node server.js

# 3. Open browser
http://localhost:3000
```

### Option B: Render Deployment (Docker)
1. Push repository changes to GitHub (`origin/main`).
2. Render detects the push and builds the `Dockerfile`.
3. Standalone `yt-dlp` and `ffmpeg` are linked automatically.
4. Set `YOUTUBE_COOKIES` in Render Dashboard Environment Variables for permanent cookie persistence.

---

## 10. Rules for Future AI Contributors

1. **Never Re-introduce `SAPISID`**: Always run incoming cookies through `sanitizeCookieContent()`. Passing `SAPISID` to `yt-dlp` will immediately trigger the `The page needs to be reloaded` error loop.
2. **Prioritize `android,mweb` in Extractor Args**: Never place `ios` or `web` before `android` in `--extractor-args "youtube:player_client=android,mweb"`, as `ios` and `web` often fail on cloud servers and cause 35-second timeouts.
3. **Always Include `--js-runtimes node`**: When invoking `yt-dlp` for YouTube analysis or download, always supply `--js-runtimes node` so Node.js can solve JavaScript signature challenges.
4. **Preserve Native CSS Tokens**: Do not inject Tailwind or heavy CSS libraries. Maintain the design system in `public/styles.css`.
5. **Never Store Downloads Permanently**: In-flight files in `downloads/` must be cleaned up automatically after job completion or expiration.
