/**
 * URL validation & platform detection utilities.
 */

const YOUTUBE_PATTERNS = [
  /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/i,
  /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]{11}/i,
  /^https?:\/\/youtu\.be\/[\w-]{11}/i,
  /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11}/i,
  /^https?:\/\/m\.youtube\.com\/watch\?v=[\w-]{11}/i,
];

const INSTAGRAM_PATTERNS = [
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|reels|tv)\/[\w-]+/i,
  /^https?:\/\/(www\.)?instagr\.am\/(p|reel|reels|tv)\/[\w-]+/i,
];

/**
 * Detect which platform a URL belongs to.
 * @param {string} url
 * @returns {'youtube'|'instagram'|null}
 */
function detectPlatform(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (YOUTUBE_PATTERNS.some((p) => p.test(trimmed))) return 'youtube';
  if (INSTAGRAM_PATTERNS.some((p) => p.test(trimmed))) return 'instagram';
  return null;
}

/**
 * Validate that a URL is an acceptable, safe HTTP(S) URL.
 * Rejects non-HTTP schemes and private/internal network targets.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'Please enter a valid URL.' };
  }

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Please enter a valid URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  // Block private / internal network addresses (SSRF protection)
  const hostname = parsed.hostname.toLowerCase();
  const blocked = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '[::1]',
    '169.254.',
    '10.',
    '192.168.',
    '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.',
  ];
  if (blocked.some((b) => hostname.startsWith(b) || hostname === b)) {
    return { valid: false, error: 'This URL is not allowed.' };
  }

  const platform = detectPlatform(trimmed);
  if (!platform) {
    return { valid: false, error: 'Please enter a valid YouTube or Instagram URL.' };
  }

  return { valid: true };
}

module.exports = { detectPlatform, validateUrl };
