/**
 * Shared helpers for Vercel API routes.
 */
const { checkRateLimit } = require('./rateLimit');

/**
 * Parse JSON body from an incoming Vercel request.
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    // Vercel may have already parsed the body
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Standard JSON response helpers.
 */
function sendJSON(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = statusCode;
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, { success: false, error: message });
}

/**
 * Extract client IP from Vercel headers.
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

/**
 * CORS middleware — allows same-origin and configurable origins.
 */
function setCORS(req, res) {
  const origin = req.headers.origin || '';
  // In production, restrict this to your domain
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['*'];

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/**
 * Wrap an API handler with common middleware (CORS, rate limiting, error handling).
 */
function withMiddleware(handler) {
  return async (req, res) => {
    try {
      setCORS(req, res);

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      // Rate limiting
      const ip = getClientIP(req);
      const { allowed, remaining } = checkRateLimit(ip);
      res.setHeader('X-RateLimit-Remaining', String(remaining));

      if (!allowed) {
        return sendError(res, 429, 'Too many requests. Please try again later.');
      }

      await handler(req, res);
    } catch (err) {
      console.error('[Eomeg API Error]', err);
      sendError(res, 500, 'An internal error occurred. Please try again.');
    }
  };
}

module.exports = { parseBody, sendJSON, sendError, getClientIP, withMiddleware };
