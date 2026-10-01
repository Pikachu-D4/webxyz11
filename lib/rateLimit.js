/**
 * Lightweight in-memory rate limiter.
 *
 * On Vercel serverless functions, each instance has its own memory,
 * so this is a per-instance limiter — enough to slow down casual abuse.
 * For production-grade limits, use Vercel's built-in WAF or an
 * external rate-limiter like Upstash Redis.
 */

const store = new Map();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_RPM, 10) || 300;

/**
 * Check and record a request for an IP.
 * @param {string} ip
 * @returns {{ allowed: boolean, remaining: number }}
 */
function checkRateLimit(ip) {
  const now = Date.now();
  let entry = store.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    store.set(ip, entry);
  }

  entry.count++;

  // Garbage-collect old entries periodically
  if (store.size > 5000) {
    for (const [key, val] of store) {
      if (now - val.windowStart > WINDOW_MS) store.delete(key);
    }
  }

  return {
    allowed: entry.count <= MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - entry.count),
  };
}

module.exports = { checkRateLimit };
