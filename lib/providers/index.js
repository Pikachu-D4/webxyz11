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

const { hasBinary } = require('../binaries');

let mediaProviderInstance = null;
let upscaleProviderInstance = null;

function getMediaProvider() {
  if (mediaProviderInstance) {
    return mediaProviderInstance;
  }

  if (hasBinary('yt-dlp')) {
    console.info('[Eomeg] Initializing YtDlpMediaProvider (yt-dlp available)');
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

  if (hasBinary('ffmpeg')) {
    console.info('[Eomeg] Initializing FFmpegUpscaleProvider (ffmpeg available)');
    const FFmpegUpscaleProvider = require('./FFmpegUpscaleProvider');
    upscaleProviderInstance = new FFmpegUpscaleProvider();
    return upscaleProviderInstance;
  }

  const DemoUpscaleProvider = require('./DemoUpscaleProvider');
  upscaleProviderInstance = new DemoUpscaleProvider();
  return upscaleProviderInstance;
}

module.exports = { getMediaProvider, getUpscaleProvider };
