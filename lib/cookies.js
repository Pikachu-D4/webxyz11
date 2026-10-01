const path = require('path');
const fs = require('fs');

const DOWNLOADS_DIR = path.resolve(__dirname, '../downloads');
const PRIMARY_COOKIE_FILE = path.join(DOWNLOADS_DIR, 'cookies.txt');
const ROOT_COOKIE_FILE = path.resolve(__dirname, '../cookies.txt');

/**
 * Resolves the path to an active cookies file if available.
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
    PRIMARY_COOKIE_FILE,
    ROOT_COOKIE_FILE,
    path.resolve(__dirname, '../../cookies.txt'),
    path.resolve(__dirname, '../bin/cookies.txt'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p) && fs.statSync(p).size > 10) {
      return p;
    }
  }

  return null;
}

/**
 * Saves uploaded cookie content to disk.
 * @param {string} rawContent
 * @returns {string} Path to saved cookie file
 */
function saveCookies(rawContent) {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  let content = (rawContent || '').trim();

  // If base64 encoded, decode it
  if (!content.startsWith('#') && !content.includes('\t') && content.length > 50) {
    try {
      const decoded = Buffer.from(content, 'base64').toString('utf-8');
      if (decoded.includes('\t') || decoded.includes('youtube.com')) {
        content = decoded;
      }
    } catch (_) {}
  }

  // Ensure file begins with Netscape header if missing
  if (!content.startsWith('# Netscape HTTP Cookie File')) {
    content = '# Netscape HTTP Cookie File\n' + content;
  }

  fs.writeFileSync(PRIMARY_COOKIE_FILE, content, 'utf-8');
  try {
    fs.writeFileSync(ROOT_COOKIE_FILE, content, 'utf-8');
  } catch (_) {}

  return PRIMARY_COOKIE_FILE;
}

/**
 * Returns summary status of current cookies.
 */
function getCookieStatus() {
  const filePath = getCookieFilePath();
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      active: false,
      message: 'No cookies configured.',
      size: 0,
      entries: 0,
      domains: [],
      lastUpdated: null,
    };
  }

  const stat = fs.statSync(filePath);
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));

  const domainSet = new Set();
  lines.forEach((l) => {
    const parts = l.split('\t');
    if (parts[0]) domainSet.add(parts[0]);
  });

  return {
    active: true,
    path: filePath,
    size: stat.size,
    entries: lines.length,
    domains: Array.from(domainSet).slice(0, 8),
    lastUpdated: stat.mtime.toISOString(),
  };
}

/**
 * Deletes local cookies file.
 */
function deleteCookies() {
  const targets = [PRIMARY_COOKIE_FILE, ROOT_COOKIE_FILE];
  for (const t of targets) {
    try {
      if (fs.existsSync(t)) fs.unlinkSync(t);
    } catch (_) {}
  }
}

module.exports = {
  getCookieFilePath,
  saveCookies,
  getCookieStatus,
  deleteCookies,
};
