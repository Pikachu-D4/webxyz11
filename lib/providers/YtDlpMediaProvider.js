/**
 * YtDlpMediaProvider — Production-grade media extractor using local yt-dlp & ffmpeg.
 *
 * Supports YouTube (videos, shorts) and Instagram (reels, videos, posts).
 * Features async job processing with real-time download progress tracking.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const MediaProvider = require('./MediaProvider');
const { findBinary, getFfmpegDir } = require('../binaries');
const { getCookieFilePath } = require('../cookies');

const DOWNLOADS_DIR = path.resolve(__dirname, '../../downloads');

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// In-memory job store
const jobs = new Map();

class YtDlpMediaProvider extends MediaProvider {
  /**
   * Analyze a public URL using yt-dlp --dump-json
   */
  async analyze(url) {
    const trimmed = (url || '').trim();
    const platform = this._detectPlatform(trimmed);
    const ytdlpBin = findBinary('yt-dlp');
    const ffmpegDir = getFfmpegDir();
    const cookiePath = getCookieFilePath();

    const attempts = [];

    if (platform === 'youtube') {
      // Strategy 1: Android client unauthenticated (FASTEST — bypasses datacenter blocks over IPv4)
      attempts.push({
        desc: 'android unauthenticated',
        timeout: 25000,
        args: [
          '--force-ipv4',
          '--retries', '1',
          '--socket-timeout', '10',
          '--dump-json',
          '--no-playlist',
          '--no-warnings',
          '--extractor-args', 'youtube:player_client=android',
        ],
      });

      // Strategy 2: Android + mweb with sanitized cookies (fallback if unauthenticated is blocked)
      if (cookiePath) {
        attempts.push({
          desc: 'android,mweb with cookies',
          timeout: 20000,
          args: [
            '--force-ipv4',
            '--retries', '1',
            '--socket-timeout', '10',
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            '--js-runtimes', 'node',
            '--extractor-args', 'youtube:player_client=android,mweb',
            '--cookies', cookiePath,
          ],
        });
      }
    } else {
      // Instagram / other platforms
      const baseArgs = [
        '--force-ipv4',
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--socket-timeout', '15',
        '--js-runtimes', 'node',
      ];
      if (cookiePath) {
        attempts.push({ desc: 'with cookies', timeout: 25000, args: [...baseArgs, '--cookies', cookiePath] });
      }
      attempts.push({ desc: 'without cookies', timeout: 25000, args: baseArgs });
    }

    let jsonStr = null;
    let lastError = null;

    for (const attempt of attempts) {
      const fullArgs = [...attempt.args];
      if (ffmpegDir) {
        fullArgs.push('--ffmpeg-location', ffmpegDir);
      }
      fullArgs.push(trimmed);

      try {
        console.log(`[Eomeg Analyzer] Trying: ${attempt.desc}`);
        jsonStr = await this._execYtDlp(ytdlpBin, fullArgs, attempt.timeout);
        if (jsonStr && jsonStr.trim().startsWith('{')) {
          console.log(`[Eomeg Analyzer] Succeeded with: ${attempt.desc}`);
          break;
        }
      } catch (err) {
        console.warn(`[Eomeg Analyzer] Attempt failed (${attempt.desc}):`, (err.message || '').split('\n')[0]);
        lastError = err;
      }
    }

    if (!jsonStr) {
      throw lastError || new Error('Failed to analyze media. Please try again.');
    }
    let meta;
    try {
      meta = JSON.parse(jsonStr);
    } catch (e) {
      throw new Error('Failed to parse media metadata.');
    }

    const duration = meta.duration ? Math.round(meta.duration) : null;
    const rawFormats = meta.formats || [];
    const formats = this._buildCleanFormats(rawFormats, platform, duration);

    const maxHeight = meta.height || (formats.length > 0 ? formats[0].height : 1080);
    const isShort = /shorts/i.test(trimmed);
    const isReel = /reel/i.test(trimmed);

    let type = 'video';
    if (platform === 'youtube' && isShort) type = 'short';
    else if (platform === 'instagram' && isReel) type = 'reel';

    return {
      platform,
      type,
      title: meta.title || 'Media',
      thumbnail: meta.thumbnail || (meta.thumbnails && meta.thumbnails.length ? meta.thumbnails[meta.thumbnails.length - 1].url : null),
      duration,
      originalResolution: maxHeight ? `${maxHeight}p` : '1080p',
      formats,
      _real: true,
    };
  }

  /**
   * Create an async download job using yt-dlp
   */
  async createDownloadJob(url, formatId, title = null) {
    const jobId = uuidv4();
    const isAudio = formatId.startsWith('ba') || formatId === 'bestaudio';

    const job = {
      id: jobId,
      status: 'processing',
      progress: 0,
      downloadUrl: null,
      error: null,
      formatId,
      isAudio,
      title: title || 'media',
      resolvedFile: null,
      _startedAt: Date.now(),
    };

    jobs.set(jobId, job);

    // Launch yt-dlp in background
    this._runDownloadProcess(job, url, formatId);

    return { jobId };
  }

  /**
   * Get job progress and download URL
   */
  async getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      if (fs.existsSync(DOWNLOADS_DIR)) {
        const matches = fs.readdirSync(DOWNLOADS_DIR).filter((f) => f.startsWith(jobId));
        if (matches.length > 0) {
          return {
            status: 'completed',
            progress: 100,
            downloadUrl: `/api/serve/${jobId}/${encodeURIComponent(matches[0])}`,
            resolvedFile: path.join(DOWNLOADS_DIR, matches[0]),
            title: 'video',
          };
        }
      }
      return { status: 'failed', progress: 0, downloadUrl: null, error: 'Job not found' };
    }

    return {
      status: job.status,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      error: job.error,
      title: job.title,
      resolvedFile: job.resolvedFile,
    };
  }

  /* ── Private Helpers ───────────────────────────────────────── */

  _detectPlatform(url) {
    if (/youtu\.?be/i.test(url) || /youtube\.com/i.test(url)) return 'youtube';
    if (/instagram\.com/i.test(url) || /instagr\.am/i.test(url)) return 'instagram';
    return 'unknown';
  }

  _execYtDlp(binPath, args, timeoutMs = 50000) {
    const finalArgs = [...args];
    if (!finalArgs.includes('--force-ipv4') && !finalArgs.includes('-4')) {
      finalArgs.unshift('--force-ipv4');
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(binPath, finalArgs, {
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d));
      proc.stderr.on('data', (d) => (stderr += d));

      const timer = setTimeout(() => {
        try { proc.kill(); } catch (_) {}
        reject(new Error('Media analysis timed out.'));
      }, timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  _buildCleanFormats(rawFormats, platform, duration = null) {
    const clean = [];
    const seenQualities = new Set();

    // Standard video qualities to match (from high to low)
    const targetHeights = [2160, 1440, 1080, 720, 480, 360, 240, 144];

    // Find available video heights in the formats
    const availableHeights = new Set();
    rawFormats.forEach((f) => {
      if (f.height && f.vcodec && f.vcodec !== 'none') {
        availableHeights.add(f.height);
      }
    });

    // Approximate audio size
    const audioSample = rawFormats.find((f) => f.vcodec === 'none' && (f.filesize || f.filesize_approx)) || {};
    const audioSize = audioSample.filesize || audioSample.filesize_approx || (duration ? Math.round((128 * 1000 / 8) * duration) : 0);

    targetHeights.forEach((h) => {
      // Check if this resolution or higher exists
      const hasRes = Array.from(availableHeights).some((vh) => vh >= h);
      if (hasRes && !seenQualities.has(h)) {
        seenQualities.add(h);

        // Find the best format info for estimation - prefer one with filesize or calculate from tbr/vbr
        const sample = rawFormats.find((f) => f.height === h && (f.filesize || f.filesize_approx))
          || rawFormats.find((f) => f.height === h)
          || {};

        let approxSize = sample.filesize || sample.filesize_approx;
        if (!approxSize && (sample.vbr || sample.tbr) && duration) {
          approxSize = Math.round(((sample.vbr || sample.tbr) * 1000 / 8) * duration);
        }

        if (clean.length === 0 && h >= 720) {
          clean.push({
            id: `crf18_${h}`,
            quality: `${h}p Ultra (H.264 CRF 18 Master)`,
            width: sample.width || Math.round((h * 16) / 9),
            height: h,
            fps: sample.fps || 30,
            format: 'mp4',
            codec: 'h264 (crf 18)',
            hasAudio: true,
            fileSize: approxSize ? Math.round((approxSize + audioSize) * 2.1) : null,
          });
        }

        clean.push({
          id: `bv*[height<=${h}]+ba/b[height<=${h}]/best`,
          quality: `${h}p`,
          width: sample.width || Math.round((h * 16) / 9),
          height: h,
          fps: sample.fps || 30,
          format: 'mp4',
          codec: 'h264',
          hasAudio: true,
          fileSize: approxSize ? Math.round(approxSize + audioSize) : null,
        });
      }
    });

    // If no target heights matched (e.g. Instagram direct streams), use raw formats
    if (clean.length === 0) {
      rawFormats.forEach((f, idx) => {
        if (f.vcodec !== 'none' || f.acodec !== 'none') {
          const isAudioOnly = f.vcodec === 'none';
          clean.push({
            id: f.format_id || String(idx),
            quality: isAudioOnly ? 'Audio' : (f.height ? `${f.height}p` : 'HD'),
            width: f.width || null,
            height: f.height || null,
            fps: f.fps || null,
            format: f.ext || 'mp4',
            codec: f.vcodec || f.acodec || null,
            hasAudio: f.acodec && f.acodec !== 'none',
            fileSize: f.filesize || f.filesize_approx || null,
          });
        }
      });
    }

    // Always add high quality audio-only option
    clean.push({
      id: 'ba/bestaudio',
      quality: 'Audio (MP3/M4A)',
      width: null,
      height: null,
      fps: null,
      format: 'm4a',
      codec: 'aac',
      hasAudio: true,
      fileSize: 4 * 1024 * 1024, // ~4 MB avg
    });

    return clean;
  }

  _runDownloadProcess(job, url, formatId, allowCookieFallback = true) {
    const ytdlpBin = findBinary('yt-dlp');
    const ffmpegBin = findBinary('ffmpeg');
    const ffmpegDir = getFfmpegDir();
    const cookiePath = allowCookieFallback ? getCookieFilePath() : null;

    if (formatId.startsWith('crf18_')) {
      const matchHeight = formatId.split('_')[1] || '1080';
      const actualYtFormat = `bv*[height<=${matchHeight}]+ba/b[height<=${matchHeight}]/best`;
      const tempTemplate = path.join(DOWNLOADS_DIR, `${job.id}_raw.%(ext)s`);

      const dlArgs = [
        '--force-ipv4',
        '--js-runtimes', 'node',
        '-f', actualYtFormat,
        '--format-sort', 'res,vbr,tbr',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=android,mweb',
        '-o', tempTemplate,
        '--merge-output-format', 'mp4',
        '--newline',
        '--progress-template', 'DOWNLOAD_PCT:%(progress._percent_str)s',
      ];

      if (cookiePath) {
        dlArgs.unshift('--cookies', cookiePath);
      }

      if (ffmpegDir) {
        dlArgs.unshift('--ffmpeg-location', ffmpegDir);
      }

      dlArgs.push(url);

      const dlProc = spawn(ytdlpBin, dlArgs, { windowsHide: true });

      dlProc.stdout.on('data', (data) => {
        const text = data.toString();
        const m = text.match(/DOWNLOAD_PCT:\s*([\d.]+)%/);
        if (m) {
          const pct = Math.min(50, Math.round(parseFloat(m[1]) * 0.5));
          job.progress = Math.max(job.progress, pct);
        }
      });

      dlProc.on('close', (code) => {
        if (code !== 0) {
          if (cookiePath && allowCookieFallback) {
            console.warn(`[Eomeg Downloader] CRF18 download failed with cookies (code ${code}), retrying without cookies...`);
            return this._runDownloadProcess(job, url, formatId, false);
          }
          job.status = 'failed';
          job.error = `Download failed with exit code ${code}.`;
          return;
        }

        const rawFiles = fs.readdirSync(DOWNLOADS_DIR).filter((f) => f.startsWith(`${job.id}_raw`));
        if (rawFiles.length === 0) {
          job.status = 'failed';
          job.error = 'Source file could not be found.';
          return;
        }

        const rawPath = path.join(DOWNLOADS_DIR, rawFiles[0]);
        const finalPath = path.join(DOWNLOADS_DIR, `${job.id}.mp4`);

        const ffmpegArgs = [
          '-y',
          '-i', rawPath,
          '-vf', 'deband,cas=0.55',
          '-c:v', 'libx264',
          '-crf', '18',
          '-preset', 'slow',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '320k',
          '-movflags', '+faststart',
          finalPath,
        ];

        const ffProc = spawn(ffmpegBin, ffmpegArgs, { windowsHide: true });

        ffProc.stderr.on('data', (d) => {
          const text = d.toString();
          const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
          if (timeMatch) {
            job.progress = Math.min(98, Math.max(job.progress, 50 + 40));
          }
        });

        ffProc.on('close', (fCode) => {
          try { if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath); } catch (_) {}

          if (fCode === 0 && fs.existsSync(finalPath)) {
            job.resolvedFile = finalPath;
            job.status = 'completed';
            job.progress = 100;
            const safeTitle = (job.title || 'video').replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
            const finalFilename = `${safeTitle} [CRF18-Master].mp4`;
            job.downloadUrl = `/api/serve/${job.id}/${encodeURIComponent(finalFilename)}`;
          } else {
            job.status = 'failed';
            job.error = `CRF18 encoding failed with code ${fCode}.`;
          }
        });

        ffProc.on('error', (err) => {
          job.status = 'failed';
          job.error = err.message || 'FFmpeg encoding failed.';
        });
      });

      dlProc.on('error', (err) => {
        job.status = 'failed';
        job.error = err.message || 'Download process encountered an error.';
      });

      return;
    }

    const isAudio = job.isAudio;
    const outTemplate = path.join(DOWNLOADS_DIR, `${job.id}.%(ext)s`);

    const args = [
      '--force-ipv4',
      '--js-runtimes', 'node',
      '-f', formatId,
      '--format-sort', 'res,vbr,tbr',
      '--no-playlist',
      '--extractor-args', 'youtube:player_client=android,mweb',
      '-o', outTemplate,
      '--newline',
      '--progress-template', 'DOWNLOAD_PCT:%(progress._percent_str)s',
    ];

    if (cookiePath) {
      args.unshift('--cookies', cookiePath);
    }

    if (ffmpegDir) {
      args.unshift('--ffmpeg-location', ffmpegDir);
    }

    if (!isAudio) {
      args.push('--merge-output-format', 'mp4');
    }

    args.push(url);

    const proc = spawn(ytdlpBin, args, {
      windowsHide: true,
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      const match = text.match(/DOWNLOAD_PCT:\s*([\d.]+)%/);
      if (match) {
        const pct = Math.min(99, Math.round(parseFloat(match[1])));
        job.progress = Math.max(job.progress, pct);
      }
    });

    proc.stderr.on('data', (data) => {
      // yt-dlp logs info/warnings to stderr
      const text = data.toString();
      const match = text.match(/(\d+\.?\d*)%/);
      if (match) {
        const pct = Math.min(99, Math.round(parseFloat(match[1])));
        job.progress = Math.max(job.progress, pct);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        // Find the resulting file
        const files = fs.readdirSync(DOWNLOADS_DIR).filter((f) => f.startsWith(job.id));
        if (files.length > 0) {
          const resolved = path.join(DOWNLOADS_DIR, files[0]);
          job.resolvedFile = resolved;
          job.status = 'completed';
          job.progress = 100;
          const safeTitle = (job.title || 'video').replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
          const ext = path.extname(files[0]) || (job.isAudio ? '.m4a' : '.mp4');
          const finalFilename = `${safeTitle}${ext}`;
          job.downloadUrl = `/api/serve/${job.id}/${encodeURIComponent(finalFilename)}`;
        } else {
          job.status = 'failed';
          job.error = 'Downloaded file could not be located.';
        }
      } else {
        if (cookiePath && allowCookieFallback) {
          console.warn(`[Eomeg Downloader] Download failed with cookies (code ${code}), retrying without cookies...`);
          return this._runDownloadProcess(job, url, formatId, false);
        }
        job.status = 'failed';
        job.error = `Download process exited with code ${code}.`;
      }
    });

    proc.on('error', (err) => {
      job.status = 'failed';
      job.error = err.message || 'Download process encountered an error.';
    });
  }
}

module.exports = YtDlpMediaProvider;
