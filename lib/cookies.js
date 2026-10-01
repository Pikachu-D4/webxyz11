const path = require('path');
const fs = require('fs');

const DOWNLOADS_DIR = path.resolve(__dirname, '../downloads');

/**
 * Resolves the path to a cookies file if available.
 * Checks:
 * 1. Process environment variable YOUTUBE_COOKIES (raw text or base64)
 * 2. File in project root: cookies.txt
 * 3. File in bin/: cookies.txt
 * 4. File in downloads/: cookies.txt
 *
 * @returns {string | null} Absolute path to valid cookies file, or null
 */
function getCookieFilePath() {
  // 1. Check environment variable YOUTUBE_COOKIES
  if (process.env.YOUTUBE_COOKIES) {
    if (!fs.existsSync(DOWNLOADS_DIR)) {
      fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
    }
    const envCookiePath = path.join(DOWNLOADS_DIR, 'env_cookies.txt');
    try {
      let content = process.env.YOUTUBE_COOKIES.trim();
      // Handle base64 encoded cookies to prevent newline corruption in cloud dashboards
      if (!content.startsWith('#') && !content.includes('\t') && content.length > 50) {
        try {
          const decoded = Buffer.from(content, 'base64').toString('utf-8');
          if (decoded.includes('\t') || decoded.includes('youtube.com')) {
            content = decoded;
          }
        } catch (_) {}
      }
      fs.writeFileSync(envCookiePath, content, 'utf-8');
      return envCookiePath;
    } catch (err) {
      console.error('[Eomeg Cookies] Failed to create cookie file from YOUTUBE_COOKIES:', err);
    }
  }

  // 2. Check local cookies.txt files
  const candidatePaths = [
    path.resolve(__dirname, '../cookies.txt'),
    path.resolve(__dirname, '../../cookies.txt'),
    path.resolve(__dirname, '../bin/cookies.txt'),
    path.join(DOWNLOADS_DIR, 'cookies.txt'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 10) {
      return p;
    }
  }

  return null;
}

module.exports = { getCookieFilePath };
