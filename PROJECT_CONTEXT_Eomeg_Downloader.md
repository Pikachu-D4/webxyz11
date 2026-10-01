# Eomeg Downloader — Project Context for Claude / Antigravity

## 1. What I Want to Build

I want to build a simple, modern web application called **Eomeg Downloader**.

The main purpose is:

1. User pastes a publicly accessible YouTube or Instagram URL.
2. The app analyzes the URL.
3. It detects the media type and available formats/qualities.
4. The user chooses a quality.
5. The app processes the media through a backend/provider.
6. The user gets a downloadable file.
7. There should also be an **AI Upscale** option for increasing the resolution of a video.

Supported content should include publicly accessible:

- YouTube videos
- YouTube Shorts
- Instagram Reels
- Instagram video posts
- Instagram image posts where technically supported
- Instagram carousel posts where technically supported

The app must **not** bypass login requirements, private-account restrictions, DRM, or other access controls.

---

## 2. Deployment Target

The frontend will be deployed on **Vercel**.

Keep the project Vercel-friendly.

I want the frontend and normal API/orchestration logic to work well with Vercel, but **heavy video downloading, FFmpeg processing, and AI upscaling should not be forced into a normal short web request**.

Use an architecture that can delegate heavy work to a separate media-processing service/worker.

### Preferred high-level architecture

```text
User Browser
    |
    v
Vercel Frontend
    |
    v
Vercel API / Server Function
    |
    +--------------------+
    |                    |
    v                    v
Media Provider      Upscaling Provider
    |                    |
    v                    v
Download/Process     AI Super Resolution
    |
    v
Temporary Storage
    |
    v
Temporary Download URL
    |
    v
User Browser
```

The exact provider can remain configurable.

---

## 3. Important Architecture Rule

Do NOT build a fake frontend-only downloader.

Do NOT make the browser simply download the original page URL.

The application needs a real provider/backend abstraction.

The media extraction/download layer should be replaceable later without rebuilding the UI.

Create something conceptually similar to:

```text
MediaProvider
  - analyze(url)
  - getFormats(url)
  - createDownloadJob(url, formatId)
  - getJobStatus(jobId)

UpscaleProvider
  - createJob(sourceUrl, targetResolution)
  - getJobStatus(jobId)
```

Keep provider-specific implementation separate from the frontend.

---

# 4. Frontend

Keep the UI simple.

Tech preference:

- HTML
- CSS
- JavaScript

A small framework can be used if it genuinely improves maintainability, but do not add unnecessary complexity.

The website should feel like a small premium SaaS tool rather than a large dashboard.

## Visual direction

- Minimal
- Modern
- Clean
- Dark theme by default
- Responsive
- Fast
- Good spacing
- Subtle animations
- No heavy 3D
- No unnecessary decoration

Brand:

**Eomeg**

Main heading:

> Download your media. Your way.

Subtitle:

> Paste a YouTube or Instagram link and choose the quality you need.

Main input:

```text
[ Paste YouTube / Instagram URL                 ] [ Analyze ]
```

Small supported-platform text:

```text
YouTube • Shorts • Instagram • Reels • Posts
```

---

# 5. Main User Flow

## State 1 — Empty

Show only:

- Logo/brand
- Main heading
- Subtitle
- URL input
- Analyze button
- Supported platforms
- Small legal/use note

---

## State 2 — Analyzing

When the user clicks Analyze:

- Disable Analyze button
- Show loading state
- Show subtle spinner/skeleton
- Do not reload the page

Example:

```text
Analyzing media...
```

---

## State 3 — Analysis Result

After successful analysis, show a result card containing:

- Thumbnail
- Platform
- Media type
- Title/caption if available
- Duration if available
- Original resolution if available
- File type
- Available formats

Example:

```text
[ THUMBNAIL ]

YouTube
Video

Example Video Title
02:31

Available qualities:

1080p   MP4   30 FPS   Audio   42 MB     [ Download ]
720p    MP4   30 FPS   Audio   24 MB     [ Download ]
480p    MP4   30 FPS   Audio   11 MB     [ Download ]
360p    MP4   30 FPS   Audio    6 MB     [ Download ]
```

Only display formats that the provider actually reports.

Do NOT invent unavailable qualities.

---

# 6. Format Information

Whenever information is available, show:

- Resolution
- Width
- Height
- FPS
- Codec
- File format
- Audio availability
- Estimated file size

Examples:

```text
1080p • 60 FPS • H.264 • Audio • MP4
720p  • 30 FPS • H.264 • Audio • MP4
```

If a format has no audio:

```text
Video only
```

If audio-only formats are available:

```text
Audio only
```

---

# 7. Download Flow

When the user selects Download:

1. Create a server-side processing/download job.
2. Show processing state.
3. Poll the job status or use a suitable callback/webhook approach.
4. Once complete, return a temporary download URL.
5. Let the user explicitly click the final download button.

Example states:

```text
Preparing...
Downloading...
Processing...
Finalizing...
Complete
```

When complete:

```text
Your download is ready

[ Download MP4 ]
[ Choose another quality ]
```

Do not automatically force a download without a user action.

---

# 8. AI Upscaling Feature

This is an important feature.

Add a clearly visible:

## AI Upscale

button/section after the source video has been analyzed.

The purpose is to actually process the video through a video super-resolution/upscaling backend.

It must NOT simply change the resolution metadata.

For example:

```text
Source
720p

Upscale to:

[ 1080p ]
[ 1440p ]
[ 4K ]
```

The available upscale targets should depend on the source resolution.

Example:

### Source is 720p

Allow:

- 1080p
- 1440p
- 4K

### Source is 1080p

Allow:

- 1440p
- 4K

Do not show nonsensical targets.

The UI should clearly indicate that AI upscaling enhances/super-resolves the source; it does not recreate all original missing detail.

---

# 9. Upscaling Job Architecture

Upscaling can be expensive and slow.

Do not run an AI video upscale directly inside a normal frontend request.

Use an asynchronous job:

```text
Source video
    |
    v
Create upscale job
    |
    v
Upscale provider
    |
    v
Processing
    |
    v
Encoding
    |
    v
Temporary output
    |
    v
Temporary download URL
```

UI should show progress.

Example:

```text
Preparing video       ✓
Uploading             ✓
AI Upscaling          62%
Encoding              81%
Finalizing            96%
Complete              ✓
```

If the provider exposes real progress, use it.

If it only exposes job status, show accurate stage-based progress instead of pretending the percentage is exact.

---

# 10. FFmpeg

FFmpeg can be used for backend media processing where appropriate.

Possible tasks:

- Container conversion
- Audio/video merging
- Transcoding
- Codec normalization
- Thumbnail generation
- Basic processing before/after upscaling

But do not make the client browser run large FFmpeg jobs.

Do not make Vercel frontend functions perform long/heavy video processing if it can be delegated to a worker/service.

---

# 11. Temporary Storage

Do not permanently store downloaded videos by default.

Use temporary storage where needed.

Requirements:

- Temporary objects only
- Expiring download URLs
- Automatic cleanup/expiration
- No unnecessary retention

Never expose provider API credentials to the browser.

---

# 12. API Design

Use clean JSON APIs.

## POST /api/analyze

Input:

```json
{
  "url": "https://example.com/..."
}
```

Expected conceptual response:

```json
{
  "success": true,
  "platform": "youtube",
  "type": "video",
  "title": "Example Video",
  "thumbnail": "https://...",
  "duration": 123,
  "originalResolution": "1080p",
  "formats": [
    {
      "id": "format-id",
      "quality": "1080p",
      "width": 1920,
      "height": 1080,
      "fps": 60,
      "format": "mp4",
      "codec": "h264",
      "hasAudio": true,
      "fileSize": 42000000
    }
  ]
}
```

---

## POST /api/download

Input:

```json
{
  "url": "https://example.com/...",
  "formatId": "format-id"
}
```

Return a job identifier.

Example:

```json
{
  "success": true,
  "jobId": "abc123"
}
```

---

## GET /api/job/:id

Example:

```json
{
  "status": "processing",
  "progress": 65,
  "downloadUrl": null
}
```

Completed:

```json
{
  "status": "completed",
  "progress": 100,
  "downloadUrl": "https://temporary-url.example/..."
}
```

---

## POST /api/upscale

Input:

```json
{
  "sourceUrl": "https://temporary-url.example/video.mp4",
  "targetResolution": "1080p"
}
```

Return:

```json
{
  "success": true,
  "jobId": "upscale-123"
}
```

---

## GET /api/upscale/:jobId

Example:

```json
{
  "status": "processing",
  "stage": "upscaling",
  "progress": 62,
  "downloadUrl": null
}
```

Completed:

```json
{
  "status": "completed",
  "stage": "complete",
  "progress": 100,
  "downloadUrl": "https://temporary-url.example/upscaled.mp4"
}
```

---

# 13. Environment Variables

Create `.env.example`.

Use variables such as:

```env
MEDIA_API_URL=
MEDIA_API_KEY=

UPSCALER_API_URL=
UPSCALER_API_KEY=

STORAGE_URL=
STORAGE_API_KEY=
```

Do not hard-code secrets.

Do not expose secret environment variables to client-side JavaScript.

---

# 14. Validation and Security

Implement:

- URL validation
- Supported platform validation
- Rate limiting
- Request size limits
- Processing limits
- Input sanitization
- Proper CORS configuration
- Secure server-to-provider communication
- SSRF protections where applicable
- Temporary URL validation
- Error handling
- Timeouts
- Job expiration/cleanup

The server must not become an unrestricted proxy for arbitrary URLs.

---

# 15. Error States

Create polished user-friendly errors.

### Invalid URL

```text
Please enter a valid YouTube or Instagram URL.
```

### Unsupported URL

```text
This type of media is not currently supported.
```

### Private/unavailable media

```text
This media is private or unavailable.
```

### Processing failed

```text
We couldn't process this media. Please try again.
```

### File too large

```text
This file exceeds the current processing limit.
```

### Provider unavailable

```text
The processing service is temporarily unavailable.
Please try again later.
```

Do not expose internal stack traces to users.

---

# 16. Recent Downloads

Add a lightweight local history.

Use `localStorage`.

Store only metadata such as:

- Title
- Thumbnail URL if appropriate
- Platform
- Quality
- Date
- Status

Do not permanently store the actual video in localStorage.

Add a small section:

```text
Recent Downloads
```

with a clear-history option.

---

# 17. Extra UI Features

Add:

- Clear input button
- Copy link button
- Theme toggle
- Format filtering
- Sort by resolution
- File size display
- FPS display
- Audio indicator
- Skeleton loading
- Download progress
- Upscale progress
- Success state
- Mobile responsive layout
- Keyboard accessibility

Keep all of these visually lightweight.

---

# 18. Responsive Design

The app should look good on:

- Desktop
- Laptop
- Tablet
- Mobile

Desktop:

- Centered main container
- Maximum width around 900–1100px

Mobile:

- Full-width URL input
- Stacked format cards
- Large touch-friendly buttons
- No horizontal overflow

Target comfortable use on a 1366px-wide desktop screen.

---

# 19. Accessibility

Include:

- Semantic HTML
- Proper labels
- Keyboard navigation
- Visible focus states
- Accessible buttons
- ARIA labels where necessary
- Good contrast
- Reduced-motion support

---

# 20. Footer

Footer text:

```text
Eomeg Downloader

Download and enhance publicly accessible media.

Use this service only for media you have permission to download or reuse.
```

---

# 21. Suggested Project Structure

Use a clean structure appropriate for the chosen Vercel setup.

Conceptually:

```text
/
├── app/
│   ├── api/
│   │   ├── analyze/
│   │   ├── download/
│   │   ├── job/
│   │   └── upscale/
│   ├── components/
│   ├── lib/
│   └── styles/
│
├── providers/
│   ├── media/
│   │   └── MediaProvider
│   └── upscale/
│       └── UpscaleProvider
│
├── public/
│
├── .env.example
├── README.md
└── package.json
```

The exact structure can be adapted to the chosen framework.

---

# 22. Coding Style

I want the implementation to be:

- Clean
- Readable
- Modular
- Maintainable
- Production-oriented
- Easy to deploy
- Easy to modify later

Avoid:

- Unnecessary dependencies
- Huge UI frameworks
- Overengineering
- Hard-coded provider logic
- Hard-coded API keys
- Fake functionality

Use reusable functions/components.

Keep provider integrations isolated.

---

# 23. README Requirements

Generate a proper `README.md` explaining:

1. What the project does
2. Architecture
3. Local development
4. Environment variables
5. How to connect a real media provider
6. How to connect an AI upscaling provider
7. Vercel deployment
8. Temporary storage requirements
9. Rate limits / processing limits
10. Important usage/legal considerations

---

# 24. Development Strategy

Build in this order:

### Phase 1
Create the complete frontend UI and states using mocked API responses.

### Phase 2
Create API routes and provider interfaces.

### Phase 3
Connect a real media extraction/download provider.

### Phase 4
Implement asynchronous download jobs.

### Phase 5
Add temporary storage and expiring URLs.

### Phase 6
Integrate the AI upscaling provider.

### Phase 7
Implement real job polling/webhooks and progress handling.

### Phase 8
Add security, rate limiting, validation and cleanup.

### Phase 9
Test desktop + mobile + failure states.

### Phase 10
Deploy to Vercel.

---

# 25. Very Important: Do Not Fake Features

The final application must NOT:

- Pretend a download succeeded when it did not
- Show fake quality options
- Show fake progress percentages
- Claim AI upscaling happened when only a resize happened
- Expose API keys
- Use a frontend-only trick as the actual backend
- Permanently retain user media without a clear reason

When an external provider is not configured yet, show a clear configuration error rather than silently pretending it works.

---

# 26. Legal / Usage Boundary

The application is intended for publicly accessible media that the user has permission to download or reuse.

Do not implement:

- Private-account bypass
- Login/session theft
- DRM bypass
- Authentication bypass
- Access-control circumvention

Do not design the application around circumventing platform protections.

---

# 27. Final Goal

The finished product should feel like a small, polished tool:

```text
               EOMEG

     Download your media.
          Your way.

 Paste YouTube / Instagram URL
 [__________________________] [Analyze]

          ↓

       Media Result

      [ Thumbnail ]

      YouTube • Video
      1080p • MP4 • Audio

  Available qualities

  1080p  MP4  42 MB      [Download]
  720p   MP4  24 MB      [Download]
  480p   MP4  11 MB      [Download]

             [ AI Upscale ]

       Upscale selected video

       1080p   1440p   4K

             [ Start Upscale ]

       Processing...
       AI Upscaling 62%

             ↓

       Your download is ready

             [Download]
```

The UI should stay simple even though the backend architecture is robust.

---

# 28. Instructions to Claude in Antigravity

Treat this document as the project specification.

Before making implementation decisions:

1. Understand the complete user flow.
2. Keep the frontend simple.
3. Keep external providers modular.
4. Keep heavy processing outside normal frontend requests.
5. Never expose secrets.
6. Do not create fake downloader/upscaler behavior.
7. Prefer real asynchronous jobs for video processing.
8. Make the code Vercel-deployable.
9. Keep the project easy to modify later.
10. When a provider-specific implementation is required, isolate it behind the provider interface.

When making changes, preserve existing working functionality and avoid unnecessary rewrites.
