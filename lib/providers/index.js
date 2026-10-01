/**
 * Provider factory — resolves the configured providers at runtime.
 *
 * Checks for:
 * 1. Local yt-dlp binary (bin/yt-dlp.exe) → YtDlpMediaProvider (real local downloads)
 * 2. External MEDIA_API_URL → remote provider
 * 3. Fallback → DemoMediaProvider
 */
const path = require('path');
const fs = require('fs');

let mediaProviderInstance = null;
let upscaleProviderInstance = null;

function hasCommand(cmd) {
  try {
    const isWin = process.platform === 'win32';
    require('child_process').execSync(isWin ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function getMediaProvider() {
  if (mediaProviderInstance) {
    return mediaProviderInstance;
  }

  const isWin = process.platform === 'win32';
  const ytdlpPath = path.resolve(__dirname, `../../bin/yt-dlp${isWin ? '.exe' : ''}`);
  if (fs.existsSync(ytdlpPath) || hasCommand('yt-dlp')) {
    console.info('[Eomeg] Initializing YtDlpMediaProvider (yt-dlp & ffmpeg ready)');
    const YtDlpMediaProvider = require('./YtDlpMediaProvider');
    mediaProviderInstance = new YtDlpMediaProvider();
    return mediaProviderInstance;
  }

  if (process.env.MEDIA_API_URL) {
    console.info('[Eomeg] MEDIA_API_URL is configured');
  }

  console.info('[Eomeg] Using DemoMediaProvider (no yt-dlp binary found)');
  const DemoMediaProvider = require('./DemoMediaProvider');
  mediaProviderInstance = new DemoMediaProvider();
  return mediaProviderInstance;
}

function getUpscaleProvider() {
  if (upscaleProviderInstance) {
    return upscaleProviderInstance;
  }

  const isWin = process.platform === 'win32';
  const ffmpegPath = path.resolve(__dirname, `../../bin/ffmpeg${isWin ? '.exe' : ''}`);
  if (fs.existsSync(ffmpegPath) || hasCommand('ffmpeg')) {
    console.info('[Eomeg] Initializing FFmpegUpscaleProvider with local ffmpeg (H.264 CRF 18)');
    const FFmpegUpscaleProvider = require('./FFmpegUpscaleProvider');
    upscaleProviderInstance = new FFmpegUpscaleProvider();
    return upscaleProviderInstance;
  }

  const DemoUpscaleProvider = require('./DemoUpscaleProvider');
  upscaleProviderInstance = new DemoUpscaleProvider();
  return upscaleProviderInstance;
}

module.exports = { getMediaProvider, getUpscaleProvider };
