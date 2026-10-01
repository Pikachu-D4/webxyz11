/**
 * DemoMediaProvider — A development / demonstration provider.
 *
 * When no real MEDIA_API_URL is configured this provider returns
 * realistic-looking mock data so the UI can be fully tested.
 *
 * It clearly marks responses as demo data and never pretends
 * a real download or processing happened.
 */
const { v4: uuidv4 } = require('uuid');
const MediaProvider = require('./MediaProvider');

// In-memory job store (per-instance, reset on cold start)
const jobs = new Map();

class DemoMediaProvider extends MediaProvider {
  async analyze(url) {
    const platform = this._detectPlatform(url);

    if (platform === 'youtube') {
      return this._youtubeResult(url);
    }
    if (platform === 'instagram') {
      return this._instagramResult(url);
    }

    return null;
  }

  async createDownloadJob(url, formatId) {
    const jobId = uuidv4();
    const job = {
      id: jobId,
      status: 'processing',
      progress: 0,
      downloadUrl: null,
      error: null,
      _formatId: formatId,
      _startedAt: Date.now(),
      _duration: 5000 + Math.random() * 3000, // 5–8 s simulated
    };
    jobs.set(jobId, job);
    return { jobId };
  }

  async getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      return { status: 'failed', progress: 0, downloadUrl: null, error: 'Job not found' };
    }

    const elapsed = Date.now() - job._startedAt;
    const progress = Math.min(100, Math.round((elapsed / job._duration) * 100));

    if (progress >= 100) {
      job.status = 'completed';
      job.progress = 100;
      // Use a real same-origin URL that the /api/serve endpoint handles
      job.downloadUrl = `/api/serve?id=${jobId}`;
    } else {
      job.progress = progress;
    }

    return {
      status: job.status,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      error: job.error,
      _formatId: job._formatId,
      _demo: true,
    };
  }

  /* ── private helpers ────────────────────────────────────────── */

  _detectPlatform(url) {
    if (/youtu\.?be/i.test(url) || /youtube\.com/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url) || /instagr\.am/i.test(url)) return 'instagram';
    return null;
  }

  _youtubeResult(url) {
    const isShort = /shorts/i.test(url);
    return {
      platform: 'youtube',
      type: isShort ? 'short' : 'video',
      title: isShort ? 'Demo YouTube Short' : 'Demo YouTube Video — Eomeg Test',
      thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      duration: isShort ? 58 : 151,
      originalResolution: '1080p',
      formats: [
        { id: 'yt-1080-av', quality: '1080p', width: 1920, height: 1080, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 44040192 },
        { id: 'yt-720-av', quality: '720p', width: 1280, height: 720, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 25165824 },
        { id: 'yt-480-av', quality: '480p', width: 854, height: 480, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 11534336 },
        { id: 'yt-360-av', quality: '360p', width: 640, height: 360, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 6291456 },
        { id: 'yt-1080-vo', quality: '1080p', width: 1920, height: 1080, fps: 60, format: 'webm', codec: 'vp9', hasAudio: false, fileSize: 52428800 },
        { id: 'yt-audio', quality: 'Audio', width: null, height: null, fps: null, format: 'm4a', codec: 'aac', hasAudio: true, fileSize: 3145728 },
      ],
      _demo: true,
    };
  }

  _instagramResult(url) {
    const isReel = /reel/i.test(url);
    return {
      platform: 'instagram',
      type: isReel ? 'reel' : 'video',
      title: isReel ? 'Demo Instagram Reel' : 'Demo Instagram Post',
      thumbnail: 'https://placekitten.com/640/640',
      duration: isReel ? 30 : 62,
      originalResolution: '1080p',
      formats: [
        { id: 'ig-1080', quality: '1080p', width: 1080, height: 1920, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 15728640 },
        { id: 'ig-720', quality: '720p', width: 720, height: 1280, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 8388608 },
        { id: 'ig-480', quality: '480p', width: 480, height: 854, fps: 30, format: 'mp4', codec: 'h264', hasAudio: true, fileSize: 4194304 },
      ],
      _demo: true,
    };
  }
}

module.exports = DemoMediaProvider;
