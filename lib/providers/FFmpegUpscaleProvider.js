/**
 * FFmpegUpscaleProvider — Real video upscaler & enhancer using FFmpeg & libx264.
 *
 * Uses:
 * - lanczos scaling + unsharp filter
 * - H.264 (libx264) with CRF 18 (visually lossless / master quality)
 * - 320kbps AAC audio
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const UpscaleProvider = require('./UpscaleProvider');
const { findBinary, getFfmpegDir } = require('../binaries');

const DOWNLOADS_DIR = path.resolve(__dirname, '../../downloads');

if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

const jobs = new Map();

class FFmpegUpscaleProvider extends UpscaleProvider {
  async createJob(sourceUrl, targetResolution, title = null) {
    const jobId = uuidv4();
    const cleanRes = (targetResolution || '1080p').toLowerCase();

    const job = {
      id: jobId,
      status: 'processing',
      stage: 'preparing',
      progress: 0,
      downloadUrl: null,
      error: null,
      targetResolution: cleanRes,
      title: title || 'upscaled_video',
      _startedAt: Date.now(),
    };

    jobs.set(jobId, job);

    this._runProcess(job, sourceUrl, cleanRes);

    return { jobId };
  }

  async getJobStatus(jobId) {
    const job = jobs.get(jobId);
    if (!job) {
      if (fs.existsSync(DOWNLOADS_DIR)) {
        const matches = fs.readdirSync(DOWNLOADS_DIR).filter((f) => f.startsWith(jobId) && !f.includes('_temp'));
        if (matches.length > 0) {
          return {
            status: 'completed',
            stage: 'completed',
            progress: 100,
            downloadUrl: `/api/serve/${jobId}/${encodeURIComponent(matches[0])}`,
            title: 'upscaled_video',
          };
        }
      }
      return { status: 'failed', stage: 'failed', progress: 0, downloadUrl: null, error: 'Job not found' };
    }

    return {
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      downloadUrl: job.downloadUrl,
      error: job.error,
      title: job.title,
      _real: true,
    };
  }

  async _runProcess(job, sourceUrl, targetResolution) {
    try {
      job.stage = 'preparing';
      job.progress = 5;

      const tempSrc = path.join(DOWNLOADS_DIR, `${job.id}_src.mp4`);
      const finalOut = path.join(DOWNLOADS_DIR, `${job.id}.mp4`);

      // Determine height
      let targetHeight = 1080;
      if (targetResolution.includes('4k') || targetResolution.includes('2160')) targetHeight = 2160;
      else if (targetResolution.includes('1440') || targetResolution.includes('2k')) targetHeight = 1440;
      else if (targetResolution.includes('1080')) targetHeight = 1080;

      // Check if sourceUrl is a web URL
      if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
        job.stage = 'downloading';
        job.progress = 10;

        await this._downloadSource(sourceUrl, tempSrc, (pct) => {
          job.progress = Math.min(30, 10 + Math.round(pct * 0.2));
        });
      } else {
        // Find existing source in downloads if any
        const existing = fs.readdirSync(DOWNLOADS_DIR).filter((f) => !f.startsWith(job.id) && f.endsWith('.mp4'));
        if (existing.length > 0) {
          fs.copyFileSync(path.join(DOWNLOADS_DIR, existing[0]), tempSrc);
        } else {
          throw new Error('Source media not found.');
        }
      }

      job.stage = 'upscaling';
      job.progress = 35;

      // Get video duration for progress
      const durationSec = await this._getDuration(tempSrc);

      // Run FFmpeg: Lanczos scale + deband + CAS sharpening, libx264 CRF 18
      const vf = `scale=-2:${targetHeight}:flags=lanczos,deband,cas=0.55`;
      const args = [
        '-y',
        '-i', tempSrc,
        '-vf', vf,
        '-c:v', 'libx264',
        '-crf', '18',
        '-preset', 'slow',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '320k',
        '-movflags', '+faststart',
        finalOut,
      ];

      job.stage = 'encoding';
      await this._execFfmpeg(args, durationSec, (pct) => {
        job.progress = Math.min(98, 35 + Math.round(pct * 0.63));
      });

      // Cleanup temp source
      try {
        if (fs.existsSync(tempSrc)) fs.unlinkSync(tempSrc);
      } catch (_) {}

      job.status = 'completed';
      job.stage = 'completed';
      job.progress = 100;

      const safeTitle = (job.title || 'video').replace(/[\\/:*?"<>|]/g, '').trim() || 'video';
      const outFilename = `${safeTitle} [${targetResolution.toUpperCase()}-CRF18].mp4`;
      job.downloadUrl = `/api/serve/${job.id}/${encodeURIComponent(outFilename)}`;
    } catch (err) {
      console.error('[FFmpegUpscaleProvider] Error:', err);
      job.status = 'failed';
      job.stage = 'failed';
      job.error = err.message || 'Upscaling failed.';
    }
  }

  _downloadSource(url, outPath, onProgress) {
    return new Promise((resolve, reject) => {
      const ytdlpBin = findBinary('yt-dlp');
      const ffmpegDir = getFfmpegDir();

      const args = [
        '--js-runtimes', 'node',
        '-f', 'bestvideo+bestaudio/best',
        '--format-sort', 'res,vbr,tbr',
        '--no-playlist',
        '--merge-output-format', 'mp4',
        '-o', outPath,
        '--newline',
      ];

      if (ffmpegDir) {
        args.unshift('--ffmpeg-location', ffmpegDir);
      }

      args.push(url);

      const proc = spawn(ytdlpBin, args, { windowsHide: true });

      proc.stdout.on('data', (d) => {
        const text = d.toString();
        const m = text.match(/(\d+\.?\d*)%/);
        if (m && onProgress) onProgress(parseFloat(m[1]));
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outPath)) resolve();
        else reject(new Error(`Failed to download source video (code ${code}).`));
      });

      proc.on('error', reject);
    });
  }

  _getDuration(filePath) {
    return new Promise((resolve) => {
      const ffprobeBin = findBinary('ffprobe');
      const args = [
        '-v', 'error',
        '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1',
        filePath,
      ];
      const proc = spawn(ffprobeBin, args, { windowsHide: true });
      let out = '';
      proc.stdout.on('data', (d) => (out += d));
      proc.on('close', () => {
        const sec = parseFloat(out.trim());
        resolve(!isNaN(sec) && sec > 0 ? sec : 30);
      });
      proc.on('error', () => resolve(30));
    });
  }

  _execFfmpeg(args, durationSec, onProgress) {
    return new Promise((resolve, reject) => {
      const ffmpegBin = findBinary('ffmpeg');
      const proc = spawn(ffmpegBin, args, { windowsHide: true });
      let stderr = '';

      proc.stderr.on('data', (d) => {
        const text = d.toString();
        stderr += text;
        const timeMatch = text.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d+)/);
        if (timeMatch) {
          const hours = parseFloat(timeMatch[1]);
          const mins = parseFloat(timeMatch[2]);
          const secs = parseFloat(timeMatch[3]);
          const currentSec = hours * 3600 + mins * 60 + secs;
          if (durationSec > 0) {
            const pct = Math.min(100, Math.round((currentSec / durationSec) * 100));
            if (onProgress) onProgress(pct);
          }
        }
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr.slice(-500) || `FFmpeg failed with exit code ${code}`));
      });

      proc.on('error', reject);
    });
  }
}

module.exports = FFmpegUpscaleProvider;
