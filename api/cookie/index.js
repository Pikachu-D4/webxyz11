/**
 * /api/cookie
 *
 * GET    — Returns current cookie status (active, entry count, last updated)
 * POST   — Uploads/saves new cookies and verifies with yt-dlp
 * DELETE — Removes stored cookies
 */
const { spawn } = require('child_process');
const { parseBody, sendJSON, sendError, withMiddleware } = require('../../lib/apiHelpers');
const { saveCookies, getCookieStatus, deleteCookies, getCookieFilePath } = require('../../lib/cookies');
const { findBinary } = require('../../lib/binaries');

function testYtDlpWithCookies(cookiePath, testUrl) {
  return new Promise((resolve) => {
    const ytdlpBin = findBinary('yt-dlp');
    const args = [
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--extractor-args', 'youtube:player_client=ios,android,web',
      '--cookies', cookiePath,
      testUrl,
    ];

    const proc = spawn(ytdlpBin, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => (stdout += d));
    proc.stderr.on('data', (d) => (stderr += d));

    const timer = setTimeout(() => {
      try { proc.kill(); } catch (_) {}
      resolve({ success: false, error: 'Verification timed out after 30s.' });
    }, 30000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        try {
          const meta = JSON.parse(stdout.trim());
          resolve({ success: true, title: meta.title || 'Video verified' });
        } catch (_) {
          resolve({ success: true, title: 'Verified (Metadata parsed)' });
        }
      } else {
        const cleanErr = (stderr || stdout || `Process exited with code ${code}`).trim();
        resolve({ success: false, error: cleanErr.split('\n')[0] });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: err.message });
    });
  });
}

module.exports = withMiddleware(async (req, res) => {
  // ── GET: Cookie status ─────────────────────────────────────────
  if (req.method === 'GET') {
    const status = getCookieStatus();
    return sendJSON(res, 200, {
      success: true,
      ...status,
    });
  }

  // ── DELETE: Clear cookies ──────────────────────────────────────
  if (req.method === 'DELETE') {
    deleteCookies();
    return sendJSON(res, 200, {
      success: true,
      message: 'Cookies cleared successfully.',
    });
  }

  // ── POST: Save & verify cookies ────────────────────────────────
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const cookieText = (body.cookieText || body.cookies || '').trim();

    if (!cookieText) {
      return sendError(res, 400, 'Cookie content cannot be empty. Please upload or paste cookies.txt.');
    }

    if (cookieText.length < 20) {
      return sendError(res, 400, 'Cookie content is too short. Please provide a valid cookies.txt file.');
    }

    // Save cookies to disk
    const savedPath = saveCookies(cookieText);
    const status = getCookieStatus();

    // Verify cookies with a live test video
    const testUrl = (body.testUrl || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ').trim();
    const testResult = await testYtDlpWithCookies(savedPath, testUrl);

    if (testResult.success) {
      return sendJSON(res, 200, {
        success: true,
        verified: true,
        message: 'Cookies saved and verified! YouTube download is now active.',
        testVideo: testResult.title,
        status,
      });
    } else {
      return sendJSON(res, 200, {
        success: true,
        verified: false,
        warning: testResult.error,
        message: `Cookies saved, but verification reported: ${testResult.error}`,
        status,
      });
    }
  }

  return sendError(res, 405, 'Method not allowed.');
});
