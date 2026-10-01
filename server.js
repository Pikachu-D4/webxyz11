/**
 * Local development server — emulates Vercel's routing.
 *
 * Serves static files from /public and routes /api/* to the serverless functions.
 * Run with: node server.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// ── API route handler map ─────────────────────────────────
const apiRoutes = {
  '/api/analyze': require('./api/analyze/index'),
  '/api/download': require('./api/download/index'),
  '/api/job': require('./api/job/index'),
  '/api/upscale': require('./api/upscale/index'),
  '/api/serve': require('./api/serve/index'),
};

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API routes ────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    let handler = apiRoutes[pathname];
    if (!handler && pathname.startsWith('/api/serve')) {
      handler = apiRoutes['/api/serve'];
    }

    if (handler) {
      try {
        console.log(`[API] ${req.method} ${req.url}`);
        await handler(req, res);
      } catch (err) {
        console.error('API Error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
    return;
  }

  // ── Static files from /public ─────────────────────────────
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, 'public', filePath);

  // Security: prevent path traversal
  if (!fullPath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(fullPath);
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    res.end(data);
  } catch {
    // Fallback to index.html for SPA-style routing
    if (!ext) {
      const indexData = fs.readFileSync(path.join(__dirname, 'public', 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(indexData);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n  🚀 Eomeg Downloader running at http://localhost:${PORT}\n`);
  console.log('  Mode: DEMO (no media provider configured)');
  console.log('  Set MEDIA_API_URL to connect a real provider.\n');
});
